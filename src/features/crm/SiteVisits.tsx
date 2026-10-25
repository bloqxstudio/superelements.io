import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CircleHelp, ExternalLink, FileText, Loader2, Mail, MapPin, Megaphone, MessageCircle, Monitor, MousePointerClick, Phone, Smartphone, Tablet, Trash2, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  CONTACT_EVENTS,
  SESSIONS_PAGE,
  contactLabel,
  duration,
  eventLabel,
  isLiveSession as isLive,
  loadSessionEvents,
  loadSessions,
  pathLabel,
  periodRange,
  placeLabel,
  removeSession,
  tzLabel,
  type SessionFilter,
  type SiteEvent,
  type SitePeriod,
  type SiteSession,
} from '@/features/crm/site'
import { SessionAd } from '@/features/crm/SiteAds'
import type { MetaView } from '@/features/crm/siteMeta'
import { FIELD, plural, whenLabel } from '@/features/crm/ui'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

/**
 * As visitas uma a uma (aba Visitas do painel Site): a lista com origem,
 * lugar, aparelho, páginas, tempo e contato, e o painel de uma visita com a
 * jornada inteira (cada página, cada clique, cada formulário), o resumo da
 * pessoa (todas as visitas dela), o anúncio de onde veio com o perfil de quem
 * clica nele, e as outras visitas. Ao vivo: o que a Realtime manda entra na
 * lista na hora.
 */

const DEVICE_ICON: Record<string, React.ElementType> = { Celular: Smartphone, Tablet, Computador: Monitor }

/** O site de onde veio já está no nome da origem? (`l.instagram.com` em Instagram, `chatgpt.com` em IAs) */
const sourceInChannel = (source: string, channel: string) => {
  const name = channel.toLowerCase()
  return source
    .toLowerCase()
    .split('.')
    .some((part) => part.length > 2 && part !== 'com' && name.includes(part))
}

/** `Instagram · bio`, `Google Ads · Sites São Leopoldo`, `Sites · processbase.com.br` */
function originText(s: Pick<SiteSession, 'channel' | 'source' | 'medium' | 'campaign'>) {
  const parts = [s.channel]
  const detail = s.campaign ?? (s.source && !sourceInChannel(s.source, s.channel) ? s.source : undefined)
  if (detail) parts.push(detail)
  else if (s.medium && s.medium !== 'cpc') parts.push(s.medium)
  return parts.join(' · ')
}

/** `Samsung SM-A546E · Android 14` ou `Celular · iOS 17.5 · Safari` */
function deviceText(s: SiteSession) {
  const os = s.os && s.details.osv ? `${s.os} ${s.details.osv}` : s.os
  return [s.details.model ?? s.device, os, s.browser].filter(Boolean).join(' · ')
}

const ContactBadges: React.FC<{ names: string[] }> = ({ names }) =>
  names.length ? (
    <span className="flex flex-wrap gap-1">
      {names.map((name) => (
        <span key={name} className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
          {contactLabel(name)}
        </span>
      ))}
    </span>
  ) : null

const LiveDot: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" /> agora
  </span>
)

const SessionRow: React.FC<{ session: SiteSession; onOpen: () => void }> = ({ session: s, onOpen }) => {
  const Device = DEVICE_ICON[s.device ?? ''] ?? Monitor
  const where = s.city || s.region || s.country ? placeLabel(s) : undefined
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none md:grid-cols-[140px_minmax(0,1.3fr)_minmax(0,1.5fr)_160px]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium tabular-nums text-gray-900">{whenLabel(s.startedAt)}</span>
          <span className="flex items-center gap-2 text-xs text-gray-500">
            {duration(s.activeMs)}
            {isLive(s) && <LiveDot />}
          </span>
        </span>
        <span className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
          <span className="block truncate text-sm text-gray-800">{originText(s)}</span>
          {s.channel === 'Meta Ads' && s.content && (
            <span className="flex items-center gap-1 truncate text-xs text-blue-700">
              <Megaphone className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{s.content}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 truncate text-xs text-gray-500">
            <Device className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{[s.details.model ?? s.device, s.browser, where].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
        <span className="order-4 col-span-2 min-w-0 md:order-none md:col-span-1">
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-gray-800">
            <span className="truncate">{pathLabel(s.landing)}</span>
            {s.exit && s.exit !== s.landing && (
              <>
                <ArrowRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
                <span className="truncate">{pathLabel(s.exit)}</span>
              </>
            )}
          </span>
          <span className="block text-xs text-gray-500">
            {plural(s.pageviews, 'página', 'páginas')} · {plural(s.events, 'evento', 'eventos')}
            {s.visitNumber > 1 && ` · ${s.visitNumber}ª visita`}
          </span>
        </span>
        <span className="flex justify-end">
          <ContactBadges names={s.conversions} />
        </span>
      </button>
    </li>
  )
}

type Extra = Pick<SessionFilter, 'region' | 'city' | 'campaign'>

export const VisitsList: React.FC<{
  siteId: string
  period: SitePeriod
  channels: string[]
  manager: boolean
  meta?: MetaView
  /** A última visita que a Realtime mandou (nova ou mudada) */
  incoming?: SiteSession
  initial?: Partial<SessionFilter>
  onFilterChange?: (filter: Partial<SessionFilter>) => void
}> = ({ siteId, period, channels, manager, meta, incoming, initial, onFilterChange }) => {
  const [mode, setMode] = useState<'todas' | 'contato' | 'agora'>(initial?.live ? 'agora' : initial?.converted ? 'contato' : 'todas')
  const [channel, setChannel] = useState(initial?.channel ?? '')
  const [path, setPath] = useState(initial?.path ?? '')
  const [extra, setExtra] = useState<Extra>({ region: initial?.region, city: initial?.city, campaign: initial?.campaign })
  const [sessions, setSessions] = useState<SiteSession[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [open, setOpen] = useState<SiteSession | null>(null)

  useEffect(() => {
    setMode(initial?.live ? 'agora' : initial?.converted ? 'contato' : 'todas')
    setChannel(initial?.channel ?? '')
    setPath(initial?.path ?? '')
    setExtra({ region: initial?.region, city: initial?.city, campaign: initial?.campaign })
  }, [initial])

  const filter: SessionFilter = { period, live: mode === 'agora', converted: mode === 'contato', channel: channel || undefined, path: path || undefined, ...extra }
  const key = JSON.stringify(filter)

  const load = useCallback(
    async (nextPage: number) => {
      const result = await loadSessions(siteId, JSON.parse(key) as SessionFilter, nextPage)
      setTotal(result.total)
      setSessions((current) => (nextPage === 0 || !current ? result.sessions : [...current, ...result.sessions]))
      setPage(nextPage)
    },
    [siteId, key]
  )

  useEffect(() => {
    setSessions(null)
    load(0).catch((e) => {
      toast.error(e instanceof Error ? e.message : String(e))
      setSessions([])
    })
  }, [load])

  // No site agora: a lista se atualiza sozinha (a Realtime adianta; isto tira quem saiu)
  useEffect(() => {
    if (mode !== 'agora') return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(0).catch(() => undefined)
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [mode, load])

  // Ao vivo: a visita que mudou troca de lugar na lista; a nova entra no topo quando cabe no filtro
  const listRef = useRef(sessions)
  listRef.current = sessions
  useEffect(() => {
    const current = listRef.current
    if (!incoming || !current) return
    const f = JSON.parse(key) as SessionFilter
    setOpen((open) => (open?.id === incoming.id ? incoming : open))
    if (current.some((s) => s.id === incoming.id)) {
      setSessions(current.map((s) => (s.id === incoming.id ? incoming : s)))
      return
    }
    const fits =
        (f.live ? isLive(incoming) : incoming.startedAt >= periodRange(period).from.getTime()) &&
        (!f.converted || incoming.converted) &&
        (!f.channel || incoming.channel === f.channel) &&
        (!f.region || incoming.region === f.region) &&
        (!f.city || incoming.city === f.city) &&
        (!f.campaign || incoming.campaign === f.campaign) &&
        (!f.path || incoming.landing === f.path || incoming.exit === f.path)
    if (!fits) return
    setSessions([incoming, ...current])
    setTotal((t) => t + 1)
    // Só a visita nova muda a lista; a troca de filtro relê do banco
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming])

  const change = (next: Partial<{ mode: typeof mode; channel: string; path: string; extra: Extra }>) => {
    const m = next.mode ?? mode
    const c = next.channel ?? channel
    const p = next.path ?? path
    const x = next.extra ?? extra
    if (next.mode !== undefined) setMode(m)
    if (next.channel !== undefined) setChannel(c)
    if (next.path !== undefined) setPath(p)
    if (next.extra !== undefined) setExtra(x)
    onFilterChange?.({ live: m === 'agora', converted: m === 'contato', channel: c || undefined, path: p || undefined, ...x })
  }

  const more = async () => {
    setLoadingMore(true)
    try {
      await load(page + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingMore(false)
    }
  }

  const removable = [
    path && { key: 'path', label: `Passou por ${pathLabel(path)}`, clear: () => change({ path: '' }) },
    (extra.city || extra.region) && {
      key: 'place',
      label: `Em ${[extra.city, extra.region].filter(Boolean).join(', ')}`,
      clear: () => change({ extra: { ...extra, city: undefined, region: undefined } }),
    },
    extra.campaign && { key: 'campaign', label: `Campanha ${extra.campaign}`, clear: () => change({ extra: { ...extra, campaign: undefined } }) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={mode === 'todas'} onClick={() => change({ mode: 'todas' })}>
          Todas
        </Chip>
        <Chip active={mode === 'contato'} onClick={() => change({ mode: 'contato' })}>
          Fizeram contato
        </Chip>
        <Chip active={mode === 'agora'} onClick={() => change({ mode: 'agora' })}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> No site agora
        </Chip>
        {channels.length > 0 && (
          <select value={channel} onChange={(e) => change({ channel: e.target.value })} className={cn(FIELD, 'h-8 w-auto rounded-full py-0 text-sm')} aria-label="Origem">
            <option value="">Todas as origens</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {removable.map((r) => (
          <span key={r.key} className="inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-zinc-900 pl-3 pr-1 text-sm text-white">
            <span className="truncate">{r.label}</span>
            <button type="button" onClick={r.clear} aria-label="Tirar o filtro" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-white/15">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {sessions && <span className="ml-auto text-xs tabular-nums text-gray-500">{plural(total, 'visita', 'visitas')}</span>}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
        <div className="hidden grid-cols-[140px_minmax(0,1.3fr)_minmax(0,1.5fr)_160px] gap-x-4 border-b border-gray-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 md:grid">
          <span>Quando</span>
          <span>De onde</span>
          <span>Caminho</span>
          <span className="text-right">Contato</span>
        </div>
        {!sessions ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo as visitas…
          </p>
        ) : sessions.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            {mode === 'agora' ? 'Ninguém no site nos últimos 5 minutos.' : mode === 'contato' ? 'Nenhuma visita com contato neste período.' : 'Nenhuma visita neste período.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} onOpen={() => setOpen(s)} />
            ))}
          </ul>
        )}
      </div>
      {sessions && sessions.length < total && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void more()} disabled={loadingMore} className="gap-1.5">
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Ver mais {Math.min(SESSIONS_PAGE, total - sessions.length)}
          </Button>
        </div>
      )}

      {open && (
        <VisitPanel
          siteId={siteId}
          session={open}
          manager={manager}
          meta={meta}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
          onRemoved={() => {
            setOpen(null)
            void load(0).catch(() => undefined)
          }}
        />
      )}
    </div>
  )
}

// ---------- uma visita ----------

const EVENT_ICON: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  telefone: Phone,
  email: Mail,
  formulario: FileText,
  formulario_inicio: FileText,
  pergunta: CircleHelp,
  link_externo: ExternalLink,
  clique: MousePointerClick,
}

/** `+1:05` desde o começo da visita */
const offset = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes >= 60 ? `+${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}` : `+${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

const KNOWN_KEYS = new Set(['texto', 'secao', 'destino', 'formulario', 'nf'])

/** Para onde levou o clique: `/#cases` vira `Início #cases` */
const destination = (value: string) => {
  const [path, hash] = value.split('#')
  return `${pathLabel(path || '/')}${hash ? ` #${hash}` : ''}`
}

function eventText(e: SiteEvent) {
  const d = e.data
  const label = typeof d.texto === 'string' && d.texto ? `“${d.texto}”` : ''
  const where = typeof d.secao === 'string' && d.secao ? d.secao : ''
  switch (e.name) {
    case 'whatsapp':
    case 'telefone':
    case 'email':
      return { title: eventLabel(e.name), detail: [label, where].filter(Boolean).join(' · ') }
    case 'formulario':
    case 'formulario_inicio':
      return { title: eventLabel(e.name), detail: [typeof d.formulario === 'string' ? d.formulario : '', where].filter(Boolean).join(' · ') }
    case 'link_externo':
      return { title: `Saiu para ${d.destino ?? 'outro site'}`, detail: [label, where].filter(Boolean).join(' · ') }
    case 'clique':
      return { title: `Clicou em ${label || 'um botão'}`, detail: [where, typeof d.destino === 'string' ? `→ ${destination(d.destino)}` : ''].filter(Boolean).join(' ') }
    case 'pergunta':
      return { title: `Abriu a dúvida ${label}`, detail: where }
    default: {
      const extra = Object.entries(d)
        .filter(([k]) => !KNOWN_KEYS.has(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ')
      return { title: eventLabel(e.name ?? 'evento'), detail: extra }
    }
  }
}

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
    <dd className="mt-0.5 text-sm text-gray-800">{children}</dd>
  </div>
)

const Sub: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <span className="block truncate text-xs text-gray-500" title={title}>
    {children}
  </span>
)

const CLICK_ID_LABEL: Record<string, string> = { gclid: 'clique de anúncio do Google', gbraid: 'clique de anúncio do Google', wbraid: 'clique de anúncio do Google', fbclid: 'link do Facebook ou Instagram', msclkid: 'anúncio da Microsoft', ttclid: 'anúncio do TikTok', li_fat_id: 'anúncio do LinkedIn' }

const NET_LABEL: Record<string, string> = { '4g': '4G ou melhor', '3g': '3G', '2g': '2G', 'slow-2g': '2G lenta' }

const dateLabel = (at: number) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

/** Todas as visitas da pessoa (deste navegador): desde quando, quantas, quanto tempo, por onde chegou e que contato fez */
const PersonSummary: React.FC<{ visits: SiteSession[] }> = ({ visits }) => {
  const first = visits.reduce((a, b) => (b.startedAt < a.startedAt ? b : a))
  const active = visits.reduce((sum, v) => sum + v.activeMs, 0)
  const pages = visits.reduce((sum, v) => sum + v.pageviews, 0)
  const channels = [...new Set(visits.map((v) => v.channel))]
  const contacts = [...new Set(visits.flatMap((v) => v.conversions))]
  const firstContact = visits
    .filter((v) => v.converted)
    .sort((a, b) => a.startedAt - b.startedAt)[0]
  const places = [...new Set(visits.filter((v) => v.city || v.region).map((v) => placeLabel(v)))]
  const devices = [...new Set(visits.map((v) => v.details.model ?? v.device).filter(Boolean))]
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Esta pessoa</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Primeira visita">
          {dateLabel(first.startedAt)}
          <Sub>{first.channel}</Sub>
        </Fact>
        <Fact label="Visitas">
          {visits.length}
          <Sub>{plural(pages, 'página', 'páginas')}</Sub>
        </Fact>
        <Fact label="Tempo no site">
          {duration(active)}
          <Sub>somando as visitas</Sub>
        </Fact>
        <Fact label="Contato">
          {contacts.length ? contacts.map(contactLabel).join(', ') : 'Ainda não'}
          {firstContact && <Sub>na {firstContact.visitNumber}ª visita</Sub>}
        </Fact>
      </dl>
      {(channels.length > 1 || places.length > 1 || devices.length > 1) && (
        <p className="mt-2 text-xs text-gray-500">
          {[channels.length > 1 && `Chegou por ${channels.join(', ')}`, places.length > 1 && `esteve em ${places.join(', ')}`, devices.length > 1 && `usou ${devices.join(', ')}`].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}

export const VisitPanel: React.FC<{
  siteId: string
  session: SiteSession
  manager: boolean
  meta?: MetaView
  onOpen: (s: SiteSession) => void
  onClose: () => void
  onRemoved: () => void
}> = ({ siteId, session: s, manager, meta, onOpen, onClose, onRemoved }) => {
  const [events, setEvents] = useState<SiteEvent[] | null>(null)
  const [visits, setVisits] = useState<SiteSession[] | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    setEvents(null)
    setConfirm(false)
    loadSessionEvents(s.id)
      .then(setEvents)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : String(e))
        setEvents([])
      })
    // `lastAt` relê a jornada quando a visita muda ao vivo
  }, [s.id, s.lastAt])

  useEffect(() => {
    loadSessions(siteId, { visitorId: s.visitorId })
      .then((r) => setVisits(r.sessions))
      .catch(() => setVisits([]))
  }, [siteId, s.visitorId])

  const remove = async () => {
    try {
      await removeSession(s.id)
      toast.success('Visita apagada')
      onRemoved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const Device = DEVICE_ICON[s.device ?? ''] ?? Monitor
  const start = events?.[0]?.at ?? s.startedAt
  const others = (visits ?? []).filter((o) => o.id !== s.id)
  const all = visits && visits.some((v) => v.id === s.id) ? visits.map((v) => (v.id === s.id ? s : v)) : [s, ...others]
  const d = s.details

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            Visita de {whenLabel(s.startedAt)}
            {isLive(s) && <LiveDot />}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {duration(s.activeMs)} em uso · {plural(s.pageviews, 'página', 'páginas')}
            {s.visitNumber > 1 ? ` · ${s.visitNumber}ª visita desta pessoa` : ' · primeira visita'}
            <ContactBadges names={s.conversions} />
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-1 gap-3 rounded-lg bg-zinc-50 p-3 sm:grid-cols-2">
          <Fact label="De onde veio">
            {originText(s)}
            {s.referrer && <Sub title={s.referrer}>{s.referrer}</Sub>}
            {s.clickId && <Sub>Pelo {CLICK_ID_LABEL[s.clickId] ?? s.clickId}</Sub>}
            {(s.medium || s.term || s.content) && <Sub>{[s.medium && `meio ${s.medium}`, s.term && `termo ${s.term}`, s.content && `conteúdo ${s.content}`].filter(Boolean).join(' · ')}</Sub>}
          </Fact>
          <Fact label="Onde">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
              {placeLabel(s, true)}
            </span>
            {s.city && <Sub>{s.geoRadius ? `pelo IP, num raio de ~${s.geoRadius} km` : 'pelo IP'}</Sub>}
            {s.network && <Sub title={s.network}>Internet: {s.network}</Sub>}
            <Sub>{[s.tz && `fuso de ${tzLabel(s.tz)}`, s.lang].filter(Boolean).join(' · ')}</Sub>
          </Fact>
          <Fact label="Aparelho">
            <span className="flex items-start gap-1.5">
              <Device className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
              <span className="min-w-0">{deviceText(s) || 'Não identificado'}</span>
            </span>
            {(s.screen || d.vw) && (
              <Sub>
                {[s.screen && `tela ${s.screen.replace('x', ' × ')}`, d.vw && d.vh && `vê ${d.vw} × ${d.vh}`, d.dpr && d.dpr > 1 && `densidade ${String(d.dpr).replace('.', ',')}x`].filter(Boolean).join(' · ')}
              </Sub>
            )}
            {(d.net || d.theme || d.bv) && (
              <Sub>{[d.bv && s.browser && `${s.browser} ${d.bv}`, d.net && `conexão ${NET_LABEL[d.net] ?? d.net}`, d.theme === 'dark' && 'tema escuro'].filter(Boolean).join(' · ')}</Sub>
            )}
          </Fact>
          <Fact label="Entrou e saiu">
            {pathLabel(s.landing)}
            {s.exit && s.exit !== s.landing && <span className="text-gray-500"> → {pathLabel(s.exit)}</span>}
            <Sub>última atividade {whenLabel(s.lastAt)}</Sub>
          </Fact>
        </dl>

        <SessionAd session={s} meta={meta} />

        {visits && all.length > 1 && <PersonSummary visits={all} />}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">O que fez</h3>
          {!events ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo a visita…
            </p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum evento guardado.</p>
          ) : (
            <ol className="relative grid gap-0.5 before:absolute before:bottom-3 before:left-[80px] before:top-3 before:w-px before:bg-gray-200">
              {events.map((e) => {
                const page = e.type === 'pageview'
                const contact = !page && CONTACT_EVENTS.includes(e.name ?? '')
                const Icon = page ? FileText : (EVENT_ICON[e.name ?? ''] ?? Zap)
                const text = page
                  ? { title: `Viu ${e.title ? `“${e.title}”` : pathLabel(e.path)}`, detail: [e.title ? pathLabel(e.path) : '', e.activeMs ? `${duration(e.activeMs)} em uso` : '', e.scroll ? `rolou ${e.scroll}%` : '', e.data.nf ? 'página não encontrada (404)' : ''].filter(Boolean).join(' · ') }
                  : eventText(e)
                return (
                  <li key={e.id} className="relative grid grid-cols-[56px_32px_minmax(0,1fr)] items-start gap-x-2 py-1.5">
                    <span className="pt-1.5 text-right text-[11px] tabular-nums text-gray-400">{offset(e.at - start)}</span>
                    <span
                      className={cn(
                        'relative z-10 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white',
                        page ? 'bg-zinc-900 text-white' : contact ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-gray-600'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 pt-1">
                      <span className={cn('block text-sm', page ? 'font-medium text-gray-900' : contact ? 'font-medium text-emerald-800' : 'text-gray-800')}>{text.title}</span>
                      {text.detail && <span className="block break-words text-xs text-gray-500">{text.detail}</span>}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {others.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Outras visitas desta pessoa</h3>
            <ul className="grid gap-1">
              {others.slice(0, 10).map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => onOpen(o)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-50">
                    <span className="tabular-nums text-gray-900">{whenLabel(o.startedAt)}</span>
                    <span className="text-gray-500">{originText(o)}</span>
                    <span className="text-gray-500">{plural(o.pageviews, 'página', 'páginas')}</span>
                    <ContactBadges names={o.conversions} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {manager && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {confirm ? (
              <>
                <span>Apagar esta visita? Serve para tirar testes da equipe.</span>
                <button type="button" onClick={() => void remove()} className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700">
                  Apagar
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100">
                  Não
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-gray-600 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 className="h-3.5 w-3.5" /> Apagar visita
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
