import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useCrm } from '@/features/crm/crmStore'
import { moduleOn } from '@/features/crm/modules'
import { loadAdAccounts, loadAdReport, NoAdTablesError, resultLabel, type AdAccount, type AdPreset, type AdReport } from '@/features/crm/ads'
import { loadAccounts as loadIgAccounts, loadMedia, NoTablesError, type IgAccount, type IgMedia } from '@/features/crm/instagram'
import { listOpportunities } from '@/features/crm/opportunities'
import { useOpportunityFeed } from '@/features/crm/live'
import { loadNumber, useNumberFeed, type WaNumber } from '@/features/crm/whatsapp'
import { listStories, NoStoryTablesError, useStoryFeed, type Story } from '@/features/crm/stories'
import { loadReport, loadSessions, loadTrackers, NoSiteTablesError, type SiteReport, type SiteSession, type SiteTracker } from '@/features/crm/site'
import { listProjects } from '@/features/projects/storage'
import type { Project } from '@/features/projects/types'
import { rescore } from '@/features/prospects/api'
import { DEFAULT_SETTINGS, type FunnelSettings, type Opportunity, type Stage } from '@/features/prospects/funnel'
import type { ActivityInput, MetaCampaignInput } from './derive'

/**
 * Tudo que a Home lê, cada fonte com o seu estado: `off` (módulo desligado na conta),
 * `none` (nada conectado ainda), `error` (a leitura falhou), `ready` (com a hora em
 * que o dado foi lido). Nenhuma fonte inventa valor: a tela só mostra o que veio, e
 * uma leitura que falha depois de ter funcionado mantém o dado anterior com o aviso,
 * para a tela não saltar. As telas de origem seguem donas dos dados e das conexões.
 */

export type Source<T> =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'none'; reason: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T; at: number; error?: string }

class Absent extends Error {}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Lê uma fonte quando ligada; relê ao pedido e de tempos em tempos (só com a aba visível). */
function useSource<T>(enabled: boolean, load: () => Promise<T>, key: string, every?: number): [Source<T>, () => void] {
  const [state, setState] = useState<Source<T>>(enabled ? { status: 'loading' } : { status: 'off' })
  const loader = useRef(load)
  loader.current = load
  const alive = useRef(true)
  const run = useCallback(() => {
    if (!enabled) return
    loader.current()
      .then((data) => alive.current && setState({ status: 'ready', data, at: Date.now() }))
      .catch((e) => {
        if (!alive.current) return
        if (e instanceof Absent) return setState({ status: 'none', reason: e.message })
        console.error('[home] falha ao ler uma fonte', e)
        setState((prev) => (prev.status === 'ready' ? { ...prev, error: errorText(e) } : { status: 'error', message: errorText(e) }))
      })
  }, [enabled])

  useEffect(() => {
    alive.current = true
    // Mudou de período ou de conta: a leitura nova começa, mas o dado de antes só sai quando o novo chega
    setState((prev) => (!enabled ? { status: 'off' } : prev.status === 'off' ? { status: 'loading' } : prev))
    run()
    if (!every || !enabled) return () => void (alive.current = false)
    const timer = setInterval(() => document.visibilityState === 'visible' && run(), every)
    return () => {
      alive.current = false
      clearInterval(timer)
    }
  }, [run, key, every, enabled])
  return [state, run]
}

/** Atraso curto para várias mudanças seguidas virarem uma leitura só. */
function useSoon(run: () => void, ms: number) {
  const latest = useRef(run)
  latest.current = run
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  return useCallback(() => {
    timer.current ??= setTimeout(() => {
      timer.current = null
      latest.current()
    }, ms)
  }, [ms])
}

/** 1 é "Hoje". A Meta só entrega até ontem, então os anúncios de "Hoje" mostram os últimos 7 dias. */
export type Days = 1 | 7 | 30

const PRESET: Record<Days, AdPreset> = { 1: 'last_7d', 7: 'last_7d', 30: 'last_30d' }
export const sitePeriod = (days: Days) => (days === 1 ? ('hoje' as const) : days)

// ---------- as formas de cada fonte ----------

export interface SiteData {
  trackers: SiteTracker[]
  totals: SiteReport['totals']
  previous: SiteReport['totals']
  ads: SiteReport['ads']
  /** Quem teve atividade nos últimos 5 minutos (leitura de agora, não histórico) */
  live: SiteSession[]
  /** Visitas do período que chegaram a um contato, as mais recentes primeiro */
  contacts: SiteSession[]
  /** O último evento que o código do site mandou */
  lastEventAt?: number
}

export interface AdsData {
  accounts: AdAccount[]
  /** Uma leitura por conta; `null` quando a conta ainda não tem relatório do período */
  reports: { account: AdAccount; report: AdReport | null }[]
}

export interface ProductionData {
  projects: Project[]
  shares: ShareState[]
}

export interface ShareState {
  id: string
  projectId: string
  projectName: string
  pageName: string
  sharedAt: number
  /** `aguardando`: o cliente ainda não respondeu a versão atual; `ajustes`: pediu mudanças; `aprovada` */
  state: 'aguardando' | 'ajustes' | 'aprovada'
  respondedAt?: number
}

export interface InstagramData {
  accounts: IgAccount[]
  media: IgMedia[]
  stories: Story[]
}

interface ShareRow {
  id: string
  project_id: string
  project_name: string
  page_name: string
  version: number
  shared_at: string
  space_page_share_responses: { decision: string; version: number; created_at: string }[] | null
}

const stateOfShare = (row: ShareRow): ShareState => {
  const current = (row.space_page_share_responses ?? []).filter((r) => r.version === row.version).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    pageName: row.page_name,
    sharedAt: Date.parse(row.shared_at),
    state: !current ? 'aguardando' : current.decision === 'approved' ? 'aprovada' : 'ajustes',
    respondedAt: current ? Date.parse(current.created_at) : undefined,
  }
}

const sumTotals = (list: SiteReport['totals'][]): SiteReport['totals'] =>
  list.reduce((a, b) => ({ sessions: a.sessions + b.sessions, visitors: a.visitors + b.visitors, newVisitors: a.newVisitors + b.newVisitors, pageviews: a.pageviews + b.pageviews, activeMs: a.activeMs + b.activeMs, bounces: a.bounces + b.bounces, converted: a.converted + b.converted }))

export function metaCampaigns(data: AdsData | undefined): MetaCampaignInput[] {
  return (data?.reports ?? []).flatMap(({ report }) =>
    (report?.campaigns ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      currency: report!.currency,
      status: c.status,
      spend: c.metrics.spend,
      impressions: c.metrics.impressions,
      linkClicks: c.metrics.linkClicks,
      result: c.result ? { label: resultLabel(c.result.type, c.result.value), value: c.result.value } : undefined,
    }))
  )
}

// ---------- o hook ----------

export function useHome(days: Days) {
  const team = useCrm((s) => s.team)
  const pipeline = useCrm((s) => s.pipeline)
  const teamId = team?.id
  const on = (id: Parameters<typeof moduleOn>[1]) => !!team && moduleOn(team, id)
  const settings: FunnelSettings = { ...DEFAULT_SETTINGS, ...(pipeline?.settings ?? {}) }

  // ---- oportunidades: leitura inteira + Realtime do funil ----
  const [opps, setOpps] = useState<Opportunity[] | null>(null)
  const [oppsError, setOppsError] = useState<string>()
  const [oppsAt, setOppsAt] = useState<number>()
  const [realtime, setRealtime] = useState(false)
  const crmOn = on('crm')
  useEffect(() => {
    setOpps(null)
    setOppsError(undefined)
    if (!pipeline || !crmOn) return
    let alive = true
    listOpportunities(pipeline.id)
      .then((list) => alive && (setOpps(list.map((o) => ({ ...o, lead: rescore(o.lead) }))), setOppsAt(Date.now())))
      .catch((e) => alive && setOppsError(errorText(e)))
    return () => void (alive = false)
  }, [pipeline, crmOn])
  const setList = useCallback((update: (prev: Opportunity[]) => Opportunity[]) => {
    setOpps((prev) => (prev ? update(prev) : prev))
    setOppsAt(Date.now())
    setRealtime(true)
  }, [])
  useOpportunityFeed(crmOn ? pipeline?.id : undefined, crmOn ? teamId : undefined, setList, (o) => ({ ...o, lead: rescore(o.lead) }))

  // ---- linha do tempo do funil (entrou, mudou de etapa) ----
  const [acts, reloadActs] = useSource<ActivityInput[]>(
    crmOn,
    async () => {
      const since = new Date(Date.now() - 31 * 86_400_000).toISOString()
      const { data, error } = await supabase
        .from('crm_activities')
        .select('id, opportunity_id, kind, data, created_at')
        .eq('team_id', teamId!)
        .in('kind', ['created', 'stage'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(120)
      if (error) throw new Error(error.message)
      return (data ?? [])
        .filter((a) => a.opportunity_id)
        .map((a) => {
          const d = (a.data ?? {}) as { from?: Stage; to?: Stage }
          return { id: a.id, oppId: a.opportunity_id as string, kind: a.kind as 'created' | 'stage', at: Date.parse(a.created_at), from: d.from, to: d.to }
        })
    },
    `${teamId}`
  )
  const soonActs = useSoon(reloadActs, 600)
  useEffect(() => {
    if (!teamId || !crmOn) return
    const channel = supabase.channel(`home-atividades-${teamId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_activities', filter: `team_id=eq.${teamId}` }, soonActs).subscribe()
    return () => void supabase.removeChannel(channel)
  }, [teamId, crmOn, soonActs])

  // ---- site: relatório do período, quem está agora e os contatos ----
  const siteOn = on('site')
  const [site, reloadSite] = useSource<SiteData>(
    siteOn,
    async () => {
      let trackers: SiteTracker[]
      try {
        trackers = await loadTrackers(teamId!)
      } catch (e) {
        if (e instanceof NoSiteTablesError) throw new Absent('O módulo do site ainda não foi instalado.')
        throw e
      }
      if (!trackers.length) throw new Absent('Nenhum site conectado a esta conta.')
      const parts = await Promise.all(
        trackers.map(async (t) => {
          const [report, live, contacts] = await Promise.all([loadReport(t.id, sitePeriod(days)), loadSessions(t.id, { live: true }), loadSessions(t.id, { period: sitePeriod(days), converted: true })])
          return { report, live: live.sessions, contacts: contacts.sessions }
        })
      )
      return {
        trackers,
        totals: sumTotals(parts.map((p) => p.report.totals)),
        previous: sumTotals(parts.map((p) => p.report.previous)),
        ads: parts.flatMap((p) => p.report.ads),
        live: parts.flatMap((p) => p.live).sort((a, b) => b.lastAt - a.lastAt),
        contacts: parts.flatMap((p) => p.contacts).sort((a, b) => b.startedAt - a.startedAt),
        lastEventAt: Math.max(0, ...trackers.map((t) => t.lastSeenAt ?? 0)) || undefined,
      }
    },
    `${teamId}:${days}`,
    5 * 60_000
  )
  const [siteRealtime, setSiteRealtime] = useState(false)
  const soonSite = useSoon(reloadSite, 2500)
  useEffect(() => {
    setSiteRealtime(false)
    if (!teamId || !siteOn) return
    const channel = supabase
      .channel(`home-site-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_sessions', filter: `team_id=eq.${teamId}` }, soonSite)
      .subscribe((status) => setSiteRealtime(status === 'SUBSCRIBED'))
    return () => void supabase.removeChannel(channel)
  }, [teamId, siteOn, soonSite])

  // ---- anúncios: o último relatório guardado de cada conta (a Home não chama a Meta) ----
  const adsOn = on('instagram')
  const [ads] = useSource<AdsData>(
    adsOn,
    async () => {
      let accounts: AdAccount[]
      try {
        accounts = await loadAdAccounts(teamId!)
      } catch (e) {
        if (e instanceof NoAdTablesError) throw new Absent('O módulo de anúncios ainda não foi instalado.')
        throw e
      }
      if (!accounts.length) throw new Absent('Nenhuma conta de anúncios conectada.')
      const reports = await Promise.all(accounts.map(async (account) => ({ account, report: await loadAdReport(account.id, PRESET[days]).catch(() => null) })))
      return { accounts, reports }
    },
    `${teamId}:${days}`,
    10 * 60_000
  )

  // ---- produção: projetos da conta e links de aprovação ----
  const projOn = on('projetos')
  const [production] = useSource<ProductionData>(
    projOn,
    async () => {
      const crm = useCrm.getState()
      const projects = (await listProjects({ id: teamId!, isHome: !!team?.isHome, memberOf: crm.teams.map((t) => t.id) })).filter((p) => !p.archivedAt)
      if (!projects.length) return { projects, shares: [] }
      const { data, error } = await supabase
        .from('space_page_shares')
        .select('id, project_id, project_name, page_name, version, shared_at, space_page_share_responses(decision, version, created_at)')
        .in('project_id', projects.map((p) => p.id))
      // Sem o link de aprovação (ou sem acesso a ele) a lista de projetos continua valendo
      return { projects, shares: error ? [] : (data as unknown as ShareRow[]).map(stateOfShare) }
    },
    `${teamId}`,
    2 * 60_000
  )

  // ---- Instagram: conta, últimos posts e stories da pauta ----
  const [instagram, reloadInstagram] = useSource<InstagramData>(
    adsOn,
    async () => {
      let accounts: IgAccount[]
      try {
        accounts = await loadIgAccounts(teamId!)
      } catch (e) {
        if (e instanceof NoTablesError) throw new Absent('O módulo do Instagram ainda não foi instalado.')
        throw e
      }
      if (!accounts.length) throw new Absent('Nenhuma conta do Instagram conectada.')
      const [media, stories] = await Promise.all([
        Promise.all(accounts.map((a) => loadMedia(a.id, 8).catch(() => [] as IgMedia[]))).then((l) => l.flat().sort((a, b) => b.postedAt - a.postedAt).slice(0, 8)),
        listStories(teamId!, Date.now() - 7 * 86_400_000, Date.now() + 14 * 86_400_000).catch((e) => (e instanceof NoStoryTablesError ? ([] as Story[]) : Promise.reject(e))),
      ])
      return { accounts, media, stories }
    },
    `${teamId}`,
    5 * 60_000
  )
  useStoryFeed(adsOn ? teamId : undefined, reloadInstagram)

  // ---- WhatsApp: o número da conta (o assistente responde por ele) ----
  const waOn = on('whatsapp')
  const wa = useWhatsApp(waOn, teamId)

  return { team, pipeline, settings, opps, oppsError, oppsAt, realtime, acts, site, siteRealtime, ads, production, instagram, wa, crmOn, siteOn, adsOn, projOn, waOn, reloadSite, reloadActs }
}

function useWhatsApp(enabled: boolean, teamId: string | undefined) {
  const [wa, setWa] = useState<Source<WaNumber | undefined>>(enabled ? { status: 'loading' } : { status: 'off' })
  useEffect(() => {
    if (!enabled || !teamId) return void setWa({ status: 'off' })
    let alive = true
    loadNumber(teamId)
      .then((n) => alive && setWa({ status: 'ready', data: n, at: Date.now() }))
      .catch((e) => alive && setWa((e as { code?: string }).code === 'no_tables' ? { status: 'none', reason: 'O módulo do WhatsApp ainda não foi instalado.' } : { status: 'error', message: errorText(e) }))
    return () => void (alive = false)
  }, [enabled, teamId])
  useNumberFeed(enabled ? teamId : undefined, (n) => setWa({ status: 'ready', data: n, at: Date.now() }))
  return wa
}
