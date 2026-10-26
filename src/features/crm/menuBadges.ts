import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { create } from 'zustand'
import { supabase } from '@/integrations/supabase/client'
import { useCrm } from './crmStore'
import { refreshProfile } from './instagram'
import { CONTACT_EVENTS, LIVE_MS } from './site'

/**
 * Os avisos ao lado dos nomes no menu do CRM: o que chegou desde a última vez
 * que a pessoa abriu cada tela. Instagram: seguidores ganhos; Site: quem está
 * no site agora e as visitas que entraram em contato (WhatsApp, ligação,
 * e-mail, formulário); Oportunidades: cartões novos e comentários de outras
 * pessoas da equipe. O "visto" fica neste navegador, por pessoa e equipe, e
 * abrir a tela zera o aviso dela. Quem busca é o `useMenuFeed`, uma vez no menu.
 */

export interface MenuBadges {
  /** Seguidores ganhos desde a última visita ao Instagram */
  followers: number
  /** Pessoas no site agora */
  live: number
  /** Visitas que entraram em contato desde a última visita ao Site */
  contacts: number
  /** Cartões novos e comentários de outras pessoas desde a última visita às Oportunidades */
  opportunities: number
}

const EMPTY: MenuBadges = { followers: 0, live: 0, contacts: 0, opportunities: 0 }

export const useMenuBadges = create<MenuBadges>(() => EMPTY)

/** Há o que ver (o ponto no botão do menu, no celular). */
export const hasNews = (b: MenuBadges) => b.followers > 0 || b.live > 0 || b.contacts > 0 || b.opportunities > 0

type Area = 'instagram' | 'site' | 'oportunidades'

interface Seen {
  /** Os seguidores na última visita ao Instagram */
  followers?: number
  site?: number
  oportunidades?: number
}

const areaOf = (pathname: string): Area | undefined =>
  pathname === '/crm' ? 'oportunidades' : pathname.startsWith('/crm/instagram') ? 'instagram' : pathname.startsWith('/crm/site') ? 'site' : undefined

function readJsonText<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? readJsonText<T>(raw) : undefined
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem armazenamento: o visto vale enquanto a aba está aberta
  }
}

const SITE_EVERY = 30_000
const CRM_EVERY = 2 * 60_000
const IG_EVERY = 5 * 60_000
/** A Meta é perguntada no máximo a cada 10 minutos por conta, somando as abas deste navegador. */
const IG_PROFILE_EVERY = 10 * 60_000
const TRACKERS_EVERY = 10 * 60_000

const missingTable = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205'

/** A vez desta aba de perguntar à Meta os seguidores da conta. */
function profileDue(accountId: string) {
  const key = `superelements-ig-perfil:${accountId}`
  const last = readJson<number>(key) ?? 0
  if (Date.now() - last < IG_PROFILE_EVERY) return false
  writeJson(key, Date.now())
  return true
}

export function useMenuFeed() {
  const userId = useCrm((s) => s.userId)
  const teamId = useCrm((s) => s.team?.id)
  const area = areaOf(useLocation().pathname)
  const areaRef = useRef(area)
  areaRef.current = area
  const mark = useRef<((area: Area) => void) | null>(null)

  // Entrar numa tela e sair dela marca o que ela mostra como visto
  useEffect(() => {
    if (!area) return
    mark.current?.(area)
    return () => mark.current?.(area)
  }, [area])

  useEffect(() => {
    useMenuBadges.setState(EMPTY)
    if (!userId || !teamId) return
    const key = `superelements-menu-visto:${userId}:${teamId}`
    const opened = Date.now()
    // Primeira vez neste navegador: conta daqui para a frente
    if (!readJson<Seen>(key)) writeJson(key, { site: opened, oportunidades: opened } satisfies Seen)
    const seen = () => readJson<Seen>(key) ?? { site: opened, oportunidades: opened }
    let alive = true
    let followers: number | undefined

    const markSeen = (a: Area) => {
      const next = seen()
      if (a === 'instagram') {
        if (followers !== undefined) next.followers = followers
        useMenuBadges.setState({ followers: 0 })
      } else {
        next[a] = Date.now()
        useMenuBadges.setState(a === 'site' ? { contacts: 0 } : { opportunities: 0 })
      }
      writeJson(key, next)
    }
    mark.current = markSeen
    const here = (a: Area) => areaRef.current === a

    // ---------- Instagram: seguidores ganhos ----------
    let igOff = false
    const refreshInstagram = async () => {
      if (igOff) return
      const read = () => supabase.from('crm_instagram_accounts').select('id, followers_count, sync_error').eq('team_id', teamId)
      let { data, error } = await read()
      if (error) {
        igOff = missingTable(error)
        return
      }
      const due = (data ?? []).filter((a) => a.sync_error !== 'token' && profileDue(a.id))
      if (due.length) {
        // Função antiga ou sem o app da Meta: fica o número da última leitura da tela
        await Promise.all(due.map((a) => refreshProfile(a.id).catch(() => undefined)))
        ;({ data, error } = await read())
        if (error) return
      }
      const counted = (data ?? []).filter((a) => typeof a.followers_count === 'number')
      if (!alive || !counted.length) return
      followers = counted.reduce((sum, a) => sum + (a.followers_count ?? 0), 0)
      if (here('instagram') || seen().followers === undefined) markSeen('instagram')
      useMenuBadges.setState({ followers: Math.max(0, followers - (seen().followers ?? followers)) })
    }

    // ---------- Site: quem está agora e os contatos novos ----------
    let siteOff = false
    let sites: { ids: string[]; at: number } | undefined
    const refreshSite = async () => {
      if (siteOff) return
      if (!sites || Date.now() - sites.at > TRACKERS_EVERY) {
        const { data, error } = await supabase.from('site_trackers').select('id').eq('team_id', teamId)
        if (error) {
          siteOff = missingTable(error)
          return
        }
        sites = { ids: (data ?? []).map((t) => t.id), at: Date.now() }
      }
      if (!sites.ids.length) return
      if (here('site')) markSeen('site')
      const since = new Date(seen().site ?? opened).toISOString()
      const [live, contacts] = await Promise.all([
        supabase.from('site_sessions').select('id', { count: 'exact', head: true }).in('site_id', sites.ids).gte('last_at', new Date(Date.now() - LIVE_MS).toISOString()),
        supabase.from('site_events').select('session_id').in('site_id', sites.ids).eq('type', 'event').in('name', CONTACT_EVENTS).gt('at', since).limit(500),
      ])
      if (!alive) return
      // Duas chamadas no WhatsApp na mesma visita são um contato
      const people = new Set((contacts.data ?? []).map((e) => e.session_id)).size
      useMenuBadges.setState({ live: live.count ?? 0, contacts: here('site') ? 0 : people })
    }

    // ---------- Oportunidades: cartões novos e comentários dos outros ----------
    const refreshCrm = async () => {
      if (here('oportunidades')) markSeen('oportunidades')
      const since = new Date(seen().oportunidades ?? opened).toISOString()
      const { data, error } = await supabase
        .from('crm_activities')
        .select('kind, opportunity_id, created_by')
        .eq('team_id', teamId)
        .in('kind', ['created', 'note'])
        .gt('created_at', since)
        .limit(500)
      if (error || !alive) return
      const news = (data ?? []).filter((a) => a.created_by !== userId && (a.kind === 'created' || !!a.opportunity_id)).length
      useMenuBadges.setState({ opportunities: here('oportunidades') ? 0 : news })
    }

    void refreshInstagram()
    void refreshSite()
    void refreshCrm()

    // A Realtime avisa na hora; várias mudanças juntas viram uma leitura só
    const debounce = (run: () => Promise<void>, ms: number) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      const fire = () => {
        timer ??= setTimeout(() => {
          timer = null
          void run()
        }, ms)
      }
      return Object.assign(fire, { cancel: () => timer && clearTimeout(timer) })
    }
    const siteSoon = debounce(refreshSite, 2000)
    const crmSoon = debounce(refreshCrm, 800)
    // Um canal por tabela: sem a migração de uma, o canal dela falha sozinho
    const channels = [
      supabase
        .channel(`menu-site-${teamId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_sessions', filter: `team_id=eq.${teamId}` }, siteSoon)
        .subscribe(),
      supabase
        .channel(`menu-crm-${teamId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_activities', filter: `team_id=eq.${teamId}` }, crmSoon)
        .subscribe(),
    ]

    // E de tempos em tempos: quem sai do site não avisa, e sem Realtime é só isso
    const visible = () => document.visibilityState === 'visible'
    const every = (run: () => Promise<void>, ms: number) =>
      setInterval(() => {
        if (visible()) void run()
      }, ms)
    const timers = [every(refreshSite, SITE_EVERY), every(refreshCrm, CRM_EVERY), every(refreshInstagram, IG_EVERY)]
    const onVisible = () => {
      if (!visible()) return
      void refreshSite()
      void refreshCrm()
      void refreshInstagram()
    }
    // Outra aba abriu a tela: o aviso some aqui também (sem ler nem gravar, para as abas não se responderem)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return
      const before = (e.oldValue ? readJsonText<Seen>(e.oldValue) : undefined) ?? {}
      const after = (e.newValue ? readJsonText<Seen>(e.newValue) : undefined) ?? {}
      if ((after.site ?? 0) > (before.site ?? 0)) useMenuBadges.setState({ contacts: 0 })
      if ((after.oportunidades ?? 0) > (before.oportunidades ?? 0)) useMenuBadges.setState({ opportunities: 0 })
      if (followers !== undefined && after.followers !== undefined) useMenuBadges.setState({ followers: Math.max(0, followers - after.followers) })
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('storage', onStorage)

    return () => {
      alive = false
      mark.current = null
      siteSoon.cancel()
      crmSoon.cancel()
      timers.forEach(clearInterval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
      channels.forEach((c) => void supabase.removeChannel(c))
    }
  }, [userId, teamId])
}
