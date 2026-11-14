import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, CalendarPlus, ExternalLink, Loader2, LogOut, RefreshCw, Search, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/integrations/supabase/client'
import { useCrm } from '@/features/crm/crmStore'
import { FIELD, Page, PageHeader, Surface } from '@/features/crm/ui'
import {
  cancelMeeting,
  createMeeting,
  disconnectGoogle,
  googleStatus,
  listAgenda,
  searchClients,
  startGoogleConnect,
  type AgendaEvent,
  type GoogleStatus,
} from '@/features/crm/googleAgenda'
import { cn } from '@/lib/utils'

/**
 * Agenda (CRM › Agenda, 2026-11-14): o Google Agenda da conta dentro da plataforma. Mostra as reuniões dos
 * próximos dias (com Meet e o cliente do CRM de cada convidado), cria reunião com Meet e convite (o Google
 * manda o e-mail, saindo da conta conectada) e cancela. Conectar e desconectar é do gestor.
 */

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const INPUT = cn(FIELD, 'h-9')
const LABEL = 'mb-1 block text-xs font-medium text-gray-600'

type Range = 'next7' | 'next30' | 'past7'
const RANGES: { id: Range; label: string }[] = [
  { id: 'next7', label: 'Próximos 7 dias' },
  { id: 'next30', label: 'Próximos 30 dias' },
  { id: 'past7', label: 'Últimos 7 dias' },
]

function spanOf(range: Range): [Date, Date] {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const day = 86_400_000
  if (range === 'past7') return [new Date(start.getTime() - 7 * day), new Date(start.getTime() + day)]
  return [start, new Date(start.getTime() + (range === 'next7' ? 7 : 30) * day)]
}

const dayKey = (e: AgendaEvent) => (e.allDay ? e.start : new Date(e.start).toLocaleDateString('sv-SE'))
const dayTitle = (key: string) => {
  const d = new Date(`${key}T12:00:00`)
  const today = new Date().toLocaleDateString('sv-SE')
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('sv-SE')
  const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return key === today ? `Hoje · ${label}` : key === tomorrow ? `Amanhã · ${label}` : label.charAt(0).toUpperCase() + label.slice(1)
}
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const STATUS: Record<string, string> = { accepted: 'confirmou', declined: 'recusou', tentative: 'talvez', needsAction: 'sem resposta' }

const AgendaPage: React.FC = () => {
  const { team } = useCrm()
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [statusError, setStatusError] = useState<string>()
  const [range, setRange] = useState<Range>('next7')
  const [events, setEvents] = useState<AgendaEvent[] | null>(null)
  const [eventsError, setEventsError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<AgendaEvent>()
  const [disconnecting, setDisconnecting] = useState(false)
  const [params, setParams] = useSearchParams()

  const loadStatus = useCallback(async () => {
    if (!team) return
    try {
      setStatus(await googleStatus(team.id))
      setStatusError(undefined)
    } catch (e) {
      setStatusError(errorText(e))
    }
  }, [team])

  const loadEvents = useCallback(async () => {
    if (!team || !status?.connected) return
    setEvents(null)
    try {
      const [from, to] = spanOf(range)
      const list = await listAgenda(team.id, from, to)
      setEvents(range === 'past7' ? [...list].reverse() : list)
      setEventsError(undefined)
    } catch (e) {
      setEventsError(errorText(e))
      setEvents([])
    }
  }, [team, status?.connected, range])

  useEffect(() => {
    setStatus(null)
    void loadStatus()
  }, [loadStatus])
  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  // Vindo do card do cliente (`?nova=1&cliente=…`): abre o formulário de reunião
  useEffect(() => {
    if (params.get('nova') && status?.connected) setCreating(true)
  }, [params, status?.connected])

  const groups = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>()
    for (const e of events ?? []) map.set(dayKey(e), [...(map.get(dayKey(e)) ?? []), e])
    return [...map.entries()]
  }, [events])

  const connect = async () => {
    if (!team) return
    setBusy(true)
    try {
      await startGoogleConnect(team.id)
    } catch (e) {
      toast.error(errorText(e))
      setBusy(false)
    }
  }

  if (!team) return null
  const connected = status?.connected

  return (
    <Page>
      <PageHeader title="Agenda" text="Suas reuniões do Google Agenda na plataforma: veja as calls, crie uma reunião com Meet e mande o convite direto para o cliente.">
        {connected && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadEvents()} aria-label="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Nova reunião
            </Button>
          </>
        )}
      </PageHeader>

      <div className="mt-6 grid gap-4">
        {statusError && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{statusError}</p>}

        {!status && !statusError && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
          </p>
        )}

        {status && !status.configured && (
          <Surface title="Falta configurar o Google">
            <p className="text-sm text-gray-600">O app do Google ainda não foi cadastrado no Supabase (segredos GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET). Depois disso, o botão de conectar aparece aqui.</p>
          </Surface>
        )}

        {status?.configured && !connected && (
          <Surface title="Conectar o Google Agenda">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm text-gray-600">
                Conecte a agenda onde você marca as calls. As reuniões aparecem aqui, você cria reunião com Meet e o Google manda o convite ao cliente. Nos formulários com agenda, dá para ligar o Google para não oferecer horários em que você já está ocupado.
              </p>
              {manager ? (
                <Button type="button" onClick={() => void connect()} disabled={busy}>
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-1.5 h-4 w-4" />} Conectar Google Agenda
                </Button>
              ) : (
                <p className="text-sm text-gray-500">Peça a quem gerencia a equipe para conectar.</p>
              )}
            </div>
          </Surface>
        )}

        {connected && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRange(r.id)}
                    className={cn('rounded-md px-3 py-1.5 text-xs font-medium', range === r.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900')}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="truncate">Conectado: {connected.email}</span>
                {manager && (
                  <button type="button" className="inline-flex items-center gap-1 hover:text-rose-600" onClick={() => setDisconnecting(true)}>
                    <LogOut className="h-3.5 w-3.5" /> Desconectar
                  </button>
                )}
              </div>
            </div>

            {connected.lastError && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>{connected.lastError}</span>
                {manager && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void connect()} disabled={busy}>
                    Conectar de novo
                  </Button>
                )}
              </div>
            )}

            {eventsError && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{eventsError}</p>}

            {events === null ? (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Lendo a agenda…
              </p>
            ) : !events.length && !eventsError ? (
              <Surface title="Nada na agenda">
                <p className="text-sm text-gray-500">Nenhum compromisso neste período.</p>
              </Surface>
            ) : (
              groups.map(([key, list]) => (
                <Surface key={key} title={dayTitle(key)}>
                  <ul className="divide-y divide-gray-100">
                    {list.map((e) => (
                      <EventRow key={e.id} event={e} onCancel={() => setCancelling(e)} />
                    ))}
                  </ul>
                </Surface>
              ))
            )}
          </>
        )}
      </div>

      {creating && connected && (
        <NewMeetingDialog
          teamId={team.id}
          from={connected.email}
          initialClient={params.get('cliente') ?? undefined}
          opportunityId={params.get('oportunidade') ?? undefined}
          onClose={() => {
            setCreating(false)
            if (params.get('nova')) setParams({}, { replace: true })
          }}
          onCreated={() => void loadEvents()}
        />
      )}

      <Dialog open={!!cancelling} onOpenChange={(open) => !open && setCancelling(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar a reunião?</DialogTitle>
            <DialogDescription>
              “{cancelling?.title}” sai do Google Agenda e os convidados recebem o aviso de cancelamento por e-mail.{cancelling?.bookingId ? ' Era uma reserva de formulário: o horário volta a ficar livre.' : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelling(undefined)}>
              Manter
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const event = cancelling
                if (!event) return
                setCancelling(undefined)
                cancelMeeting(team.id, event.id).then(
                  () => {
                    toast.success('Reunião cancelada')
                    void loadEvents()
                  },
                  (e) => toast.error(errorText(e))
                )
              }}
            >
              Cancelar reunião
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disconnecting} onOpenChange={setDisconnecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar o Google Agenda?</DialogTitle>
            <DialogDescription>Os eventos continuam no seu Google. A plataforma para de ler a agenda, e os formulários voltam a oferecer horários só pelas reservas deles.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDisconnecting(false)}>
              Manter
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDisconnecting(false)
                disconnectGoogle(team.id).then(
                  () => {
                    toast.success('Google Agenda desconectado')
                    setEvents(null)
                    void loadStatus()
                  },
                  (e) => toast.error(errorText(e))
                )
              }}
            >
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

const EventRow: React.FC<{ event: AgendaEvent; onCancel: () => void }> = ({ event: e, onCancel }) => {
  const guests = e.attendees.filter((a) => !a.self)
  const past = Date.parse(e.end) < Date.now()
  return (
    <li className={cn('flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4', past && 'opacity-60')}>
      <span className="w-28 shrink-0 text-sm font-medium tabular-nums text-gray-900">{e.allDay ? 'Dia inteiro' : `${hhmm(e.start)} – ${hhmm(e.end)}`}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
          <span className="min-w-0 break-words">{e.title}</span>
          {e.bookingId && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">Formulário</span>}
        </p>
        {e.clients.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-1.5">
            {e.clients.map((c) => (
              <Link key={c.clientId} to={`/crm/clientes/${c.clientId}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
                {c.name || 'Cliente'}
              </Link>
            ))}
          </p>
        )}
        {guests.length > 0 && (
          <p className="mt-1 break-words text-xs text-gray-500">
            {guests.map((a) => `${a.name || a.email}${a.status && STATUS[a.status] ? ` (${STATUS[a.status]})` : ''}`).join(' · ')}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {e.meet && !past && (
          <a href={e.meet} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
            <Video className="h-3.5 w-3.5" /> Meet
          </a>
        )}
        {e.link && (
          <a href={e.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
            Google <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {!past && (
          <button type="button" className="text-xs text-gray-500 hover:text-rose-600" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </li>
  )
}

const DURATIONS = [15, 30, 45, 60, 90, 120]
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const NewMeetingDialog: React.FC<{ teamId: string; from: string; initialClient?: string; opportunityId?: string; onClose: () => void; onCreated: () => void }> = ({ teamId, from, initialClient, opportunityId, onClose, onCreated }) => {
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('sv-SE')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(tomorrow)
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(30)
  const [meet, setMeet] = useState(true)
  const [description, setDescription] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [emailDraft, setEmailDraft] = useState('')
  const [client, setClient] = useState<{ id: string; name: string }>()
  const [term, setTerm] = useState('')
  const [found, setFound] = useState<{ id: string; name: string; email: string | null }[]>([])
  const [saving, setSaving] = useState(false)

  // Cliente vindo do card: já entra escolhido, com o e-mail dele
  useEffect(() => {
    if (!initialClient) return
    void supabase
      .from('crm_clients')
      .select('id, name, email')
      .eq('id', initialClient)
      .eq('team_id', teamId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const email = typeof data.email === 'string' ? data.email.toLowerCase() : ''
        setClient({ id: data.id as string, name: data.name as string })
        setTitle((t) => t || `Reunião · ${data.name}`)
        if (EMAIL.test(email)) setEmails((list) => [...new Set([...list, email])])
      })
  }, [initialClient, teamId])

  useEffect(() => {
    if (term.trim().length < 2) {
      setFound([])
      return
    }
    const timer = window.setTimeout(() => {
      searchClients(teamId, term).then(setFound, () => setFound([]))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [term, teamId])

  const addEmail = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)
    const good = parts.filter((p) => EMAIL.test(p))
    if (good.length) setEmails((list) => [...new Set([...list, ...good])])
    const bad = parts.filter((p) => !EMAIL.test(p))
    setEmailDraft(bad.join(' '))
  }

  const pick = (c: { id: string; name: string; email: string | null }) => {
    setClient({ id: c.id, name: c.name })
    setTitle((t) => t || `Reunião · ${c.name}`)
    if (c.email && EMAIL.test(c.email)) setEmails((list) => [...new Set([...list, c.email!.toLowerCase()])])
    setTerm('')
    setFound([])
  }

  const save = async () => {
    const pending = emailDraft.trim()
    if (pending && !EMAIL.test(pending)) {
      toast.error(`E-mail inválido: ${pending}`)
      return
    }
    const list = pending ? [...new Set([...emails, pending.toLowerCase()])] : emails
    if (!title.trim()) {
      toast.error('Dê um título à reunião.')
      return
    }
    setSaving(true)
    try {
      const event = await createMeeting(teamId, { title: title.trim(), start: `${date}T${time}`, durationMin: duration, emails: list, description: description.trim() || undefined, meet, clientId: client?.id, opportunityId })
      toast.success('Reunião criada', { description: list.length ? `O Google mandou o convite para ${list.join(', ')}.` : 'Sem convidados: só na sua agenda.' })
      if (event.meet) void navigator.clipboard?.writeText(event.meet).catch(() => undefined)
      onCreated()
      onClose()
    } catch (e) {
      toast.error(errorText(e))
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova reunião</DialogTitle>
          <DialogDescription>Entra no Google Agenda de {from}. Com convidados, o Google manda o convite por e-mail, com o link do Meet.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className={LABEL}>Título</label>
            <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunião de alinhamento" maxLength={200} />
          </div>

          <div className="relative">
            <label className={LABEL}>Cliente do CRM (opcional)</label>
            {client ? (
              <div className="flex h-9 items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm">
                <span className="truncate">{client.name}</span>
                <button type="button" aria-label="Tirar cliente" onClick={() => setClient(undefined)} className="text-gray-400 hover:text-gray-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input className={cn(INPUT, 'pl-9')} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar por nome ou e-mail" />
              </div>
            )}
            {found.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {found.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-gray-50" onClick={() => pick(c)}>
                      <span className="text-sm text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-500">{c.email || 'sem e-mail'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {client && <p className="mt-1 text-xs text-gray-500">A reunião entra na linha do tempo do cliente.</p>}
          </div>

          <div>
            <label className={LABEL}>Convidados</label>
            {emails.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {emails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {e}
                    <button type="button" aria-label={`Tirar ${e}`} onClick={() => setEmails((list) => list.filter((x) => x !== e))} className="text-gray-400 hover:text-gray-700">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              className={INPUT}
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addEmail(emailDraft)
                }
              }}
              onBlur={() => emailDraft.trim() && addEmail(emailDraft)}
              placeholder="email@cliente.com.br"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={LABEL}>Dia</label>
              <input className={INPUT} type="date" value={date} min={new Date().toLocaleDateString('sv-SE')} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Hora</label>
              <input className={INPUT} type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Duração</label>
              <select className={INPUT} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} min` : d === 60 ? '1 hora' : `${d / 60} h`.replace('.5', ',5')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="-mt-1 text-xs text-gray-500">Horário de Brasília.</p>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Switch checked={meet} onCheckedChange={setMeet} /> Criar link do Google Meet
          </label>

          <div>
            <label className={LABEL}>Descrição (o convidado vê)</label>
            <textarea className={cn(FIELD, 'py-2')} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="Pauta da conversa" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Voltar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} {emails.length || emailDraft.trim() ? 'Criar e mandar convite' : 'Criar reunião'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AgendaPage
