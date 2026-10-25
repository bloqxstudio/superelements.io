import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CircleHelp, ExternalLink, FileText, Loader2, Mail, MessageCircle, Monitor, MousePointerClick, Phone, Smartphone, Tablet, Trash2, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  CONTACT_EVENTS,
  LIVE_MS,
  SESSIONS_PAGE,
  contactLabel,
  countryLabel,
  duration,
  eventLabel,
  loadSessionEvents,
  loadSessions,
  pathLabel,
  removeSession,
  tzLabel,
  type SessionFilter,
  type SiteEvent,
  type SitePeriod,
  type SiteSession,
} from '@/features/crm/site'
import { FIELD, plural, whenLabel } from '@/features/crm/ui'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

/**
 * As visitas uma a uma (aba Visitas do painel Site): a lista com origem,
 * aparelho, páginas, tempo e contato, e o painel de uma visita com a jornada
 * inteira (cada página, cada clique, cada formulário) e as outras visitas da
 * mesma pessoa.
 */

const DEVICE_ICON: Record<string, React.ElementType> = { Celular: Smartphone, Tablet, Computador: Monitor }

const isLive = (s: SiteSession) => Date.now() - s.lastAt < LIVE_MS

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
          <span className="flex items-center gap-1.5 truncate text-xs text-gray-500">
            <Device className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {[s.device, s.browser, s.country ? countryLabel(s.country) : undefined].filter(Boolean).join(' · ')}
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

export const VisitsList: React.FC<{
  siteId: string
  period: SitePeriod
  channels: string[]
  manager: boolean
  initial?: Partial<SessionFilter>
  onFilterChange?: (filter: Partial<SessionFilter>) => void
}> = ({ siteId, period, channels, manager, initial, onFilterChange }) => {
  const [mode, setMode] = useState<'todas' | 'contato' | 'agora'>(initial?.live ? 'agora' : initial?.converted ? 'contato' : 'todas')
  const [channel, setChannel] = useState(initial?.channel ?? '')
  const [path, setPath] = useState(initial?.path ?? '')
  const [sessions, setSessions] = useState<SiteSession[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [open, setOpen] = useState<SiteSession | null>(null)

  useEffect(() => {
    setMode(initial?.live ? 'agora' : initial?.converted ? 'contato' : 'todas')
    setChannel(initial?.channel ?? '')
    setPath(initial?.path ?? '')
  }, [initial])

  const filter: SessionFilter = { period, live: mode === 'agora', converted: mode === 'contato', channel: channel || undefined, path: path || undefined }
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

  // No site agora: a lista se atualiza sozinha
  useEffect(() => {
    if (mode !== 'agora') return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(0).catch(() => undefined)
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [mode, load])

  const change = (next: Partial<{ mode: typeof mode; channel: string; path: string }>) => {
    const m = next.mode ?? mode
    const c = next.channel ?? channel
    const p = next.path ?? path
    if (next.mode !== undefined) setMode(m)
    if (next.channel !== undefined) setChannel(c)
    if (next.path !== undefined) setPath(p)
    onFilterChange?.({ live: m === 'agora', converted: m === 'contato', channel: c || undefined, path: p || undefined })
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
        {path && (
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-zinc-900 pl-3 pr-1 text-sm text-white">
            Passou por {pathLabel(path)}
            <button type="button" onClick={() => change({ path: '' })} aria-label="Tirar o filtro de página" className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/15">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
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

const CLICK_ID_LABEL: Record<string, string> = { gclid: 'clique de anúncio do Google', gbraid: 'clique de anúncio do Google', wbraid: 'clique de anúncio do Google', fbclid: 'link do Facebook ou Instagram', msclkid: 'anúncio da Microsoft', ttclid: 'anúncio do TikTok', li_fat_id: 'anúncio do LinkedIn' }

export const VisitPanel: React.FC<{
  siteId: string
  session: SiteSession
  manager: boolean
  onOpen: (s: SiteSession) => void
  onClose: () => void
  onRemoved: () => void
}> = ({ siteId, session: s, manager, onOpen, onClose, onRemoved }) => {
  const [events, setEvents] = useState<SiteEvent[] | null>(null)
  const [others, setOthers] = useState<SiteSession[]>([])
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
    loadSessions(siteId, { visitorId: s.visitorId })
      .then((r) => setOthers(r.sessions.filter((o) => o.id !== s.id)))
      .catch(() => setOthers([]))
  }, [siteId, s.id, s.visitorId])

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
            {s.referrer && (
              <span className="block truncate text-xs text-gray-500" title={s.referrer}>
                {s.referrer}
              </span>
            )}
            {s.clickId && <span className="block text-xs text-gray-500">Pelo {CLICK_ID_LABEL[s.clickId] ?? s.clickId}</span>}
            {(s.medium || s.term || s.content) && (
              <span className="block text-xs text-gray-500">{[s.medium && `meio ${s.medium}`, s.term && `termo ${s.term}`, s.content && `conteúdo ${s.content}`].filter(Boolean).join(' · ')}</span>
            )}
          </Fact>
          <Fact label="Aparelho">
            <span className="flex items-center gap-1.5">
              <Device className="h-3.5 w-3.5 text-gray-500" aria-hidden />
              {[s.device, s.os, s.browser].filter(Boolean).join(' · ') || 'Não identificado'}
            </span>
            {s.screen && <span className="block text-xs text-gray-500">Tela {s.screen.replace('x', ' × ')}</span>}
          </Fact>
          <Fact label="Onde">
            {countryLabel(s.country)}
            <span className="block text-xs text-gray-500">{[s.tz && `fuso de ${tzLabel(s.tz)}`, s.lang].filter(Boolean).join(' · ')}</span>
          </Fact>
          <Fact label="Entrou e saiu">
            {pathLabel(s.landing)}
            {s.exit && s.exit !== s.landing && <span className="text-gray-500"> → {pathLabel(s.exit)}</span>}
            <span className="block text-xs text-gray-500">última atividade {whenLabel(s.lastAt)}</span>
          </Fact>
        </dl>

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
