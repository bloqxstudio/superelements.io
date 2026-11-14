import { supabase } from '@/integrations/supabase/client'
import { publicAppUrl } from '@/features/approval/shares'

/**
 * Google Agenda da conta (tela `/crm/agenda`, 2026-11-14): quem fala com o Google é a função `google-calendar`
 * (o token fica só lá). Daqui: o estado da conexão, o login, a lista de eventos, criar reunião com Meet e
 * convite, cancelar, e manter o evento de uma reserva de formulário em dia quando ela é cancelada na tela.
 */

export const GOOGLE_CALLBACK_PATH = '/agenda/retorno'

export class GoogleAgendaError extends Error {
  constructor(
    message: string,
    readonly code = 'error'
  ) {
    super(message)
  }
}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  let result: { data: unknown; error: unknown }
  try {
    result = await supabase.functions.invoke('google-calendar', { body: { action, ...body } })
  } catch {
    throw new GoogleAgendaError('A função google-calendar não respondeu.', 'unavailable')
  }
  const { data, error } = result
  if (!error && data && typeof data === 'object' && !('error' in data)) return data as T
  const context = (error as { context?: unknown } | null)?.context
  const response = context instanceof Response ? context : undefined
  const failure = response ? await response.json().then((b: { error?: unknown; code?: unknown }) => b, () => undefined) : (data as { error?: unknown; code?: unknown } | null)
  if (response?.status === 404 && !failure?.error) throw new GoogleAgendaError('A função google-calendar não está publicada no Supabase.', 'unavailable')
  if (typeof failure?.error === 'string') throw new GoogleAgendaError(failure.error, typeof failure.code === 'string' ? failure.code : 'error')
  throw new GoogleAgendaError('Não consegui falar com o Google Agenda agora.', 'error')
}

export interface GoogleStatus {
  configured: boolean
  connected?: { email: string; connectedAt: string; lastError?: string }
}

export interface AgendaEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  link?: string
  meet?: string
  location?: string
  description?: string
  attendees: { email: string; name?: string; status?: string; self?: boolean; organizer?: boolean }[]
  bookingId?: string
  clients: { clientId: string; name: string }[]
}

export const googleStatus = (teamId: string) => call<GoogleStatus>('status', { teamId })

const redirectUri = () => `${/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.origin) ? window.location.origin : publicAppUrl()}${GOOGLE_CALLBACK_PATH}`

/** Abre o login do Google nesta aba; a volta cai em `/agenda/retorno`. */
export async function startGoogleConnect(teamId: string) {
  const { url } = await call<{ url: string }>('auth_url', { teamId, redirectUri: redirectUri() })
  window.location.assign(url)
}

export const finishGoogleConnect = (code: string, state: string) => call<{ email: string; teamId: string }>('connect', { code, state, redirectUri: `${window.location.origin}${GOOGLE_CALLBACK_PATH}` })

export const disconnectGoogle = (teamId: string) => call<{ ok: true }>('disconnect', { teamId })

export const listAgenda = (teamId: string, from: Date, to: Date) => call<{ events: AgendaEvent[] }>('events', { teamId, from: from.toISOString(), to: to.toISOString() }).then((r) => r.events)

export interface NewMeeting {
  title: string
  /** `YYYY-MM-DDTHH:MM`, horário de Brasília */
  start: string
  durationMin: number
  emails: string[]
  description?: string
  meet: boolean
  clientId?: string
  opportunityId?: string
}

export const createMeeting = (teamId: string, meeting: NewMeeting) => call<{ event: AgendaEvent }>('create', { teamId, ...meeting }).then((r) => r.event)

export const cancelMeeting = (teamId: string, eventId: string) => call<{ ok: true }>('cancel', { teamId, eventId })

/** Reserva de formulário cancelada ou reativada na tela: apaga ou recria o evento no Google (quando ligado). */
export const syncBooking = (bookingId: string) => call<{ ok: true; removed?: boolean; created?: boolean; skipped?: string }>('booking_sync', { bookingId })

/** Busca de clientes para convidar (nome ou e-mail), só os campos do convite. */
export async function searchClients(teamId: string, term: string) {
  const q = term.trim().replace(/[%,()]/g, ' ')
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('crm_clients')
    .select('id, name, email')
    .eq('team_id', teamId)
    .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(8)
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; name: string; email: string | null }[]
}
