import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAdReport, loadAdAccounts, loadAdReport, NoAdTablesError, type AdAudienceRow, type AdCampaign, type AdCreative, type AdCut, type AdMetrics, type AdPreset, type AdReport } from './ads'
import { sumMetrics } from './adsMetrics'
import type { SiteAdRow, SitePeriod, SiteSession } from './site'
import { UF_NAME, ufOf } from './siteGeo'

/**
 * O painel Site cruzado com os anúncios da Meta (aba Anúncios do Instagram):
 * cada visita que veio de um anúncio acha a campanha e o anúncio dela pelo
 * link (`utm_campaign` com o nome da campanha, `utm_content` com o do anúncio,
 * `utm_term` com o do conjunto, ou os ids `utm_id`/`ad_id`), e daí vêm o
 * perfil de quem clica naquela campanha (idade, gênero, estado, plataforma,
 * que a Meta só dá em totais) e, por campanha, o que a Meta conta (valor
 * usado, cliques no link) ao lado do que o site conta (visitas que chegaram,
 * tempo, contatos, leads qualificados). Lê os relatórios que a aba Anúncios
 * guarda e relê da Meta quando o guardado tem mais de 30 minutos.
 */

const STALE = 30 * 60_000

/** O período do site no relatório da Meta (hoje cai nos 7 dias: a Meta não tem "hoje") */
export const presetOf = (period: SitePeriod): AdPreset => (period === 30 ? 'last_30d' : period === 90 ? 'last_90d' : 'last_7d')

export interface MetaCampaign extends AdCampaign {
  accountId: string
  currency: string
}

export interface MetaView {
  preset: AdPreset
  /** Os dias do relatório (no fuso da conta de anúncios) */
  since: string | null
  until: string | null
  currency: string
  /** O mais antigo dos relatórios das contas */
  fetchedAt: number
  campaigns: MetaCampaign[]
  ads: AdCreative[]
  audience: AdAudienceRow[]
  regions: AdCut[]
  platforms: AdCut[]
}

function combine(preset: AdPreset, reports: { accountId: string; report: AdReport }[]): MetaView | undefined {
  if (!reports.length) return undefined
  const first = reports[0].report
  return {
    preset,
    since: reports.map((r) => r.report.since).filter(Boolean).sort()[0] ?? null,
    until: reports.map((r) => r.report.until).filter(Boolean).sort().pop() ?? null,
    currency: first.currency,
    fetchedAt: Math.min(...reports.map((r) => r.report.fetchedAt)),
    campaigns: reports.flatMap((r) => r.report.campaigns.map((c) => ({ ...c, accountId: r.accountId, currency: r.report.currency }))),
    ads: reports.flatMap((r) => r.report.ads),
    audience: reports.flatMap((r) => r.report.audience),
    regions: reports.flatMap((r) => r.report.regions),
    platforms: reports.flatMap((r) => r.report.platforms),
  }
}

export type MetaState =
  | { status: 'loading' }
  /** Sem conta de anúncios conectada (ou sem as tabelas dos anúncios) */
  | { status: 'none' }
  | { status: 'ready'; meta: MetaView; refreshing: boolean; error?: string }
  | { status: 'error'; error: string }

/** Os anúncios da Meta da equipe no período do painel; relê da Meta quando o guardado está velho. */
export function useMetaAds(teamId: string | undefined, period: SitePeriod) {
  const preset = presetOf(period)
  const [state, setState] = useState<MetaState>({ status: 'loading' })
  const accountsRef = useRef<{ id: string }[]>([])
  const reportsRef = useRef<Map<string, AdReport>>(new Map())

  const publish = useCallback(
    (refreshing: boolean, error?: string) => {
      const reports = [...reportsRef.current.entries()].map(([accountId, report]) => ({ accountId, report }))
      const meta = combine(preset, reports)
      if (meta) setState({ status: 'ready', meta, refreshing, error })
      else if (refreshing) setState({ status: 'loading' })
      else setState(error ? { status: 'error', error } : { status: 'none' })
    },
    [preset]
  )

  const refresh = useCallback(
    async (onlyStale: boolean) => {
      const accounts = accountsRef.current.filter((a) => !onlyStale || Date.now() - (reportsRef.current.get(a.id)?.fetchedAt ?? 0) > STALE)
      if (!accounts.length) return
      publish(true)
      let error: string | undefined
      await Promise.all(
        accounts.map((a) =>
          fetchAdReport(a.id, preset)
            .then((report) => void reportsRef.current.set(a.id, report))
            .catch((e) => {
              error = e instanceof Error ? e.message : String(e)
            })
        )
      )
      publish(false, error)
    },
    [preset, publish]
  )

  useEffect(() => {
    if (!teamId) return
    let alive = true
    setState({ status: 'loading' })
    reportsRef.current = new Map()
    ;(async () => {
      try {
        const accounts = await loadAdAccounts(teamId)
        if (!alive) return
        accountsRef.current = accounts
        if (!accounts.length) return setState({ status: 'none' })
        const saved = await Promise.all(accounts.map((a) => loadAdReport(a.id, preset).catch(() => null)))
        if (!alive) return
        saved.forEach((report, i) => report && reportsRef.current.set(accounts[i].id, report))
        publish(false)
        await refresh(true)
      } catch (e) {
        if (!alive) return
        if (e instanceof NoAdTablesError) setState({ status: 'none' })
        else setState({ status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return () => {
      alive = false
    }
  }, [teamId, preset, publish, refresh])

  return { state, refresh: () => refresh(false) }
}

// ---------- achar a campanha e o anúncio da visita ----------

const norm = (value: string | null | undefined) => (value ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

/** O que o link trouxe: o nome ou o id da campanha e do anúncio */
export interface AdKey {
  campaign?: string | null
  campaignId?: string | null
  ad?: string | null
  adId?: string | null
}

export const adKeyOfSession = (s: SiteSession): AdKey => ({ campaign: s.campaign, campaignId: s.details.campaignId, ad: s.content, adId: s.details.adId })
export const adKeyOfRow = (r: SiteAdRow): AdKey => ({ campaign: r.campaign, campaignId: r.campaignId, ad: r.ad, adId: r.adId })

export function matchCampaign(meta: MetaView, key: AdKey): MetaCampaign | undefined {
  const id = key.campaignId?.trim()
  if (id) {
    const byId = meta.campaigns.find((c) => c.id === id)
    if (byId) return byId
  }
  const name = norm(key.campaign)
  if (!name) return undefined
  return meta.campaigns.find((c) => c.id === key.campaign?.trim()) ?? meta.campaigns.find((c) => norm(c.name) === name)
}

export function matchAd(meta: MetaView, key: AdKey, campaign?: MetaCampaign): AdCreative | undefined {
  const id = key.adId?.trim()
  if (id) {
    const byId = meta.ads.find((a) => a.id === id)
    if (byId) return byId
  }
  const name = norm(key.ad)
  if (!name) return undefined
  const pool = campaign ? meta.ads.filter((a) => a.campaignId === campaign.id) : meta.ads
  return pool.find((a) => a.id === key.ad?.trim()) ?? pool.find((a) => norm(a.name) === name)
}

// ---------- quem clica na campanha ----------

export interface Share {
  key: string
  label: string
  value: number
  share: number
}

export interface AudienceProfile {
  /** Sobre o quê: cliques no link (quando há bastantes) ou impressões */
  basis: 'linkClicks' | 'impressions'
  total: number
  gender: Share[]
  ages: Share[]
  regions: (Share & { uf?: string })[]
  platforms: Share[]
}

const GENDER_LABEL: Record<string, string> = { female: 'Mulheres', male: 'Homens', unknown: 'Não informado' }
const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', messenger: 'Messenger', audience_network: 'Audience Network', whatsapp: 'WhatsApp', threads: 'Threads' }
export const platformLabel = (key: string) => PLATFORM_LABEL[key] ?? key

/** Com menos cliques que isso, a divisão por idade e gênero dos cliques não diz muito: usa as impressões. */
const MIN_CLICKS = 20

function shares(rows: { key: string; label: string; value: number }[]): Share[] {
  const merged = new Map<string, { key: string; label: string; value: number }>()
  for (const row of rows) {
    const current = merged.get(row.key)
    if (current) current.value += row.value
    else merged.set(row.key, { ...row })
  }
  const total = [...merged.values()].reduce((sum, r) => sum + r.value, 0)
  return [...merged.values()]
    .filter((r) => r.value > 0)
    .map((r) => ({ ...r, share: total ? r.value / total : 0 }))
    .sort((a, b) => b.value - a.value)
}

/** O perfil de quem a Meta diz que viu ou clicou nestas campanhas (todas, sem ids). */
export function audienceOf(meta: MetaView, campaignIds?: string[]): AudienceProfile | undefined {
  const pick = <T extends { campaignId: string }>(rows: T[]) => (campaignIds ? rows.filter((r) => campaignIds.includes(r.campaignId)) : rows)
  const audience = pick(meta.audience)
  if (!audience.length) return undefined
  const clicks = audience.reduce((sum, r) => sum + r.metrics.linkClicks, 0)
  const basis: AudienceProfile['basis'] = clicks >= MIN_CLICKS ? 'linkClicks' : 'impressions'
  const value = (m: AdMetrics) => (basis === 'linkClicks' ? m.linkClicks : m.impressions)
  const total = audience.reduce((sum, r) => sum + value(r.metrics), 0)
  if (!total) return undefined
  return {
    basis,
    total,
    gender: shares(audience.map((r) => ({ key: r.gender, label: GENDER_LABEL[r.gender] ?? r.gender, value: value(r.metrics) }))),
    ages: shares(audience.map((r) => ({ key: r.age, label: r.age === '65+' ? '65 ou mais' : r.age.replace('-', ' a '), value: value(r.metrics) }))).sort((a, b) => a.key.localeCompare(b.key)),
    regions: shares(pick(meta.regions).map((r) => ({ key: r.key, label: r.key, value: value(r.metrics) }))).map((r) => {
      const uf = ufOf(r.key)
      return { ...r, uf, label: uf ? UF_NAME[uf] : r.label }
    }),
    platforms: shares(pick(meta.platforms).map((r) => ({ key: r.key, label: platformLabel(r.key), value: value(r.metrics) }))),
  }
}

/** "Homens · 35 a 44 anos · RS": o mais comum de cada parte */
export function profileLine(p: AudienceProfile) {
  const top = <T extends Share>(list: T[]) => list.reduce<T | undefined>((best, s) => (!best || s.value > best.value ? s : best), undefined)
  const gender = top(p.gender.filter((g) => g.key !== 'unknown'))
  const age = top(p.ages)
  const region = top(p.regions)
  return [gender && `${gender.label} (${Math.round(gender.share * 100)}%)`, age && `${age.label} anos (${Math.round(age.share * 100)}%)`, region && `${region.uf ?? region.label} (${Math.round(region.share * 100)}%)`]
    .filter(Boolean)
    .join(' · ')
}

// ---------- Meta × site por campanha ----------

export interface CrossNumbers {
  /** Da Meta */
  metrics?: AdMetrics
  /** Do site */
  sessions: number
  visitors: number
  converted: number
  forms: number
  qualified: number
  unqualified: number
  bounces: number
  /** Soma do tempo médio × visitas (para a média ponderada) */
  activeTotal: number
}

export interface CrossAd extends CrossNumbers {
  key: string
  name: string
  adset?: string
  creative?: AdCreative
}

export interface CrossCampaign extends CrossNumbers {
  key: string
  name: string
  campaign?: MetaCampaign
  ads: CrossAd[]
}

const emptyNumbers = (): CrossNumbers => ({ sessions: 0, visitors: 0, converted: 0, forms: 0, qualified: 0, unqualified: 0, bounces: 0, activeTotal: 0 })

function addRow(target: CrossNumbers, row: SiteAdRow) {
  target.sessions += row.sessions
  target.visitors += row.visitors
  target.converted += row.converted
  target.forms += row.forms
  target.qualified += row.qualified
  target.unqualified += row.unqualified
  target.bounces += row.bounces
  target.activeTotal += (row.activeMs ?? 0) * row.sessions
}

const META_CHANNELS = new Set(['Meta Ads', 'Instagram ou Facebook'])
export const NO_CAMPAIGN_NAME = 'Sem nome de campanha no link'

/**
 * Uma linha por campanha da Meta (as que gastaram no período e as que mandaram
 * visitas), com os anúncios dentro. Visitas de anúncio da Meta cujo link não
 * achou a campanha ficam numa linha própria, pelo nome que veio no link.
 */
export function crossCampaigns(meta: MetaView, rows: SiteAdRow[]): CrossCampaign[] {
  const byKey = new Map<string, CrossCampaign>()
  const campaignRow = (key: string, name: string, campaign?: MetaCampaign) => {
    let row = byKey.get(key)
    if (!row) {
      row = { key, name, campaign, ads: [], ...emptyNumbers(), metrics: campaign?.metrics }
      byKey.set(key, row)
    }
    return row
  }
  const adRow = (parent: CrossCampaign, key: string, name: string, creative?: AdCreative, adset?: string) => {
    let row = parent.ads.find((a) => a.key === key)
    if (!row) {
      row = { key, name, adset: adset ?? creative?.adsetName, creative, metrics: creative?.metrics, ...emptyNumbers() }
      parent.ads.push(row)
    }
    return row
  }

  for (const c of meta.campaigns) if (c.metrics.spend > 0 || c.metrics.linkClicks > 0) campaignRow(`c:${c.id}`, c.name, c)
  for (const a of meta.ads) {
    const parent = a.campaignId ? byKey.get(`c:${a.campaignId}`) : undefined
    if (parent && (a.metrics.spend > 0 || a.metrics.linkClicks > 0)) adRow(parent, `a:${a.id}`, a.name, a)
  }

  for (const row of rows) {
    const key = adKeyOfRow(row)
    const campaign = matchCampaign(meta, key)
    if (!campaign && !META_CHANNELS.has(row.channel)) continue
    const parent = campaign ? campaignRow(`c:${campaign.id}`, campaign.name, campaign) : campaignRow(`n:${norm(row.campaign) || '?'}`, row.campaign || NO_CAMPAIGN_NAME)
    addRow(parent, row)
    const creative = matchAd(meta, key, campaign)
    if (creative) addRow(adRow(parent, `a:${creative.id}`, creative.name, creative, row.adset ?? undefined), row)
    else if (row.ad) addRow(adRow(parent, `n:${norm(row.ad)}`, row.ad, undefined, row.adset ?? undefined), row)
  }

  const order = (a: CrossNumbers, b: CrossNumbers) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0) || b.sessions - a.sessions
  return [...byKey.values()].map((c) => ({ ...c, ads: c.ads.sort(order) })).sort(order)
}

/** A soma das campanhas que a Meta conhece (as do link que não estão no relatório ficam fora, sem gasto para dividir) */
export function crossTotals(list: CrossCampaign[]): CrossNumbers {
  const out = emptyNumbers()
  const metrics: AdMetrics[] = []
  for (const c of list) {
    if (!c.campaign) continue
    out.sessions += c.sessions
    out.visitors += c.visitors
    out.converted += c.converted
    out.forms += c.forms
    out.qualified += c.qualified
    out.unqualified += c.unqualified
    out.bounces += c.bounces
    out.activeTotal += c.activeTotal
    if (c.metrics) metrics.push(c.metrics)
  }
  return { ...out, metrics: metrics.length ? sumMetrics(metrics) : undefined }
}

/** Tempo médio em uso das visitas */
export const avgActive = (n: CrossNumbers) => (n.sessions ? n.activeTotal / n.sessions : undefined)
/** Visitas que chegaram por clique no link (a Meta conta o clique; o site conta quem abriu a página) */
export const arrivalOf = (n: CrossNumbers) => (n.metrics?.linkClicks ? n.sessions / n.metrics.linkClicks : undefined)
export const perOf = (spend: number | undefined, count: number) => (spend !== undefined && count > 0 ? spend / count : undefined)

/** Meta por estado: cliques no link, impressões e valor usado de todas as campanhas */
export function metaByUf(meta: MetaView) {
  const out = new Map<string, AdMetrics>()
  for (const r of meta.regions) {
    const uf = ufOf(r.key)
    if (!uf) continue
    out.set(uf, sumMetrics([out.get(uf) ?? { spend: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: 0, conversations: 0, actions: {} }, r.metrics]))
  }
  return out
}

/** `Instagram_Stories` vira `Instagram Stories` */
export const placementLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b(\w)/g, (m) => m.toUpperCase())
