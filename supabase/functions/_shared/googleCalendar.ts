import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Google Agenda da conta (2026-11-14): o token, a leitura dos eventos, os horários ocupados e a criação de
 * eventos com Meet e convite. Usado pela função `google-calendar` (a tela `/crm/agenda`) e pela `form-submit`
 * (a agenda do formulário com `booking.google`). O token só existe aqui, lido com a chave de serviço.
 *
 * Escopos: `calendar.events` (ler, criar e apagar eventos; os ocupados vêm da própria lista de eventos, sem
 * pedir o escopo de freebusy) e `openid email` (o e-mail da conta, que a tela mostra).
 */

export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events']
export const TIME_ZONE = 'America/Sao_Paulo'
const API = 'https://www.googleapis.com/calendar/v3'

export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly code = 'google'
  ) {
    super(message)
  }
}

export const googleApp = () => ({ id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '', secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '' })

interface TokenRow {
  team_id: string
  refresh_token: string
  access_token: string | null
  expires_at: string | null
}

/** Troca o código do login pelos tokens; devolve também o e-mail (do id_token, que veio direto do Google por HTTPS). */
export async function exchangeCode(code: string, redirectUri: string) {
  const app = googleApp()
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: app.id, client_secret: app.secret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || typeof body.access_token !== 'string') throw new GoogleError('O Google recusou o login. Conecte de novo.', 400, 'exchange')
  let email = ''
  if (typeof body.id_token === 'string') {
    try {
      const payload = body.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      email = String(JSON.parse(atob(payload)).email ?? '')
    } catch {
      // sem e-mail: a tela mostra "Google Agenda"
    }
  }
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : '',
    expiresAt: new Date(Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60_000).toISOString(),
    scopes: typeof body.scope === 'string' ? body.scope.split(' ') : [],
    email,
  }
}

/** O token de acesso da conta, renovado quando falta menos de 1 minuto. `null`: a conta não conectou. */
export async function accessToken(admin: SupabaseClient, teamId: string): Promise<string | null> {
  const { data } = await admin.from('crm_google_tokens').select('team_id, refresh_token, access_token, expires_at').eq('team_id', teamId).maybeSingle()
  const row = data as TokenRow | null
  if (!row) return null
  if (row.access_token && row.expires_at && Date.parse(row.expires_at) > Date.now()) return row.access_token
  const app = googleApp()
  if (!app.id || !app.secret) throw new GoogleError('Falta configurar o app do Google no Supabase (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).', 503, 'not_configured')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: app.id, client_secret: app.secret, refresh_token: row.refresh_token, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || typeof body.access_token !== 'string') {
    // invalid_grant: a pessoa tirou o acesso no Google, ou o app ainda está em "Teste" (o Google derruba em 7 dias)
    const revoked = body.error === 'invalid_grant'
    const message = revoked ? 'O Google tirou o acesso desta agenda. Conecte de novo.' : 'O Google não renovou o acesso agora.'
    await admin.from('crm_google_calendars').update({ last_error: message, updated_at: new Date().toISOString() }).eq('team_id', teamId)
    throw new GoogleError(message, revoked ? 401 : 502, revoked ? 'revoked' : 'google')
  }
  const expiresAt = new Date(Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60_000).toISOString()
  await admin.from('crm_google_tokens').update({ access_token: body.access_token, expires_at: expiresAt }).eq('team_id', teamId)
  return body.access_token
}

async function google(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) })
  // 410/404 num DELETE: o evento já não existe (apagado no Google), o que conta como feito
  if (response.status === 204 || response.status === 410 || (init.method === 'DELETE' && response.status === 404)) return null
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const message = ((body.error as Record<string, unknown> | undefined)?.message as string | undefined) ?? `HTTP ${response.status}`
    console.error('[google]', path.split('?')[0], response.status, message)
    throw new GoogleError(response.status === 403 ? 'O Google não deixou mexer nesta agenda (permissão).' : 'O Google Agenda não respondeu como esperado.', 502, 'google')
  }
  return body
}

const calendarOf = async (admin: SupabaseClient, teamId: string) => {
  const { data } = await admin.from('crm_google_calendars').select('calendar_id').eq('team_id', teamId).maybeSingle()
  return encodeURIComponent((data?.calendar_id as string | undefined) ?? 'primary')
}

export interface GoogleEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  status: string
  link?: string
  meet?: string
  location?: string
  description?: string
  attendees: { email: string; name?: string; status?: string; self?: boolean; organizer?: boolean }[]
  /** Reserva de formulário que criou o evento (`extendedProperties.private.booking`) */
  bookingId?: string
  busy: boolean
}

function toEvent(raw: Record<string, unknown>): GoogleEvent {
  const start = (raw.start ?? {}) as Record<string, string>
  const end = (raw.end ?? {}) as Record<string, string>
  const conf = raw.conferenceData as { entryPoints?: { entryPointType?: string; uri?: string }[] } | undefined
  const attendees = (Array.isArray(raw.attendees) ? raw.attendees : []) as Record<string, unknown>[]
  const self = attendees.find((a) => a.self)
  const priv = ((raw.extendedProperties as Record<string, unknown> | undefined)?.private ?? {}) as Record<string, string>
  return {
    id: String(raw.id ?? ''),
    title: String(raw.summary ?? '(sem título)'),
    start: start.dateTime ?? start.date ?? '',
    end: end.dateTime ?? end.date ?? '',
    allDay: !start.dateTime,
    status: String(raw.status ?? 'confirmed'),
    link: typeof raw.htmlLink === 'string' ? raw.htmlLink : undefined,
    meet: (typeof raw.hangoutLink === 'string' ? raw.hangoutLink : undefined) ?? conf?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri,
    location: typeof raw.location === 'string' ? raw.location : undefined,
    description: typeof raw.description === 'string' ? raw.description.slice(0, 600) : undefined,
    attendees: attendees.slice(0, 30).map((a) => ({
      email: String(a.email ?? ''),
      name: typeof a.displayName === 'string' ? a.displayName : undefined,
      status: typeof a.responseStatus === 'string' ? a.responseStatus : undefined,
      self: a.self === true || undefined,
      organizer: a.organizer === true || undefined,
    })),
    bookingId: priv.booking,
    // Ocupa o horário: não é "disponível" (transparent), não foi cancelado e eu não recusei
    busy: raw.transparency !== 'transparent' && raw.status !== 'cancelled' && self?.responseStatus !== 'declined',
  }
}

/** Os eventos entre dois instantes (recorrentes já abertos em ocorrências), até 250. */
export async function listEvents(admin: SupabaseClient, teamId: string, from: Date, to: Date): Promise<GoogleEvent[] | null> {
  const token = await accessToken(admin, teamId)
  if (!token) return null
  const query = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: TIME_ZONE })
  const body = await google(token, `/calendars/${await calendarOf(admin, teamId)}/events?${query}`)
  const items = (Array.isArray(body?.items) ? body.items : []) as Record<string, unknown>[]
  return items.map(toEvent).filter((e) => e.status !== 'cancelled')
}

/**
 * Os intervalos ocupados (ms) no Google entre dois instantes, para a agenda do formulário. `null`: a conta não
 * conectou. Dia inteiro marcado como ocupado (ex.: férias) bloqueia o dia todo.
 */
export async function busyRanges(admin: SupabaseClient, teamId: string, from: Date, to: Date): Promise<{ start: number; end: number }[] | null> {
  const events = await listEvents(admin, teamId, from, to)
  if (!events) return null
  return events
    .filter((e) => e.busy)
    .map((e) => (e.allDay ? { start: Date.parse(`${e.start}T00:00:00-03:00`), end: Date.parse(`${e.end}T00:00:00-03:00`) } : { start: Date.parse(e.start), end: Date.parse(e.end) }))
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
}

export interface NewEvent {
  title: string
  /** Instantes ISO */
  start: string
  end: string
  description?: string
  attendees: { email: string; name?: string }[]
  meet: boolean
  bookingId?: string
}

/** Cria o evento; com convidados, o Google manda o convite por e-mail (`sendUpdates=all`). */
export async function createEvent(admin: SupabaseClient, teamId: string, event: NewEvent): Promise<GoogleEvent> {
  const token = await accessToken(admin, teamId)
  if (!token) throw new GoogleError('Conecte o Google Agenda primeiro.', 409, 'not_connected')
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description || undefined,
    start: { dateTime: event.start, timeZone: TIME_ZONE },
    end: { dateTime: event.end, timeZone: TIME_ZONE },
    attendees: event.attendees.map((a) => ({ email: a.email, displayName: a.name || undefined })),
    reminders: { useDefault: true },
  }
  if (event.meet) body.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
  if (event.bookingId) body.extendedProperties = { private: { booking: event.bookingId } }
  const query = new URLSearchParams({ conferenceDataVersion: '1', sendUpdates: event.attendees.length ? 'all' : 'none' })
  const raw = await google(token, `/calendars/${await calendarOf(admin, teamId)}/events?${query}`, { method: 'POST', body: JSON.stringify(body) })
  return toEvent(raw ?? {})
}

/** Cancela o evento e avisa os convidados. Evento que já não existe conta como cancelado. */
export async function deleteEvent(admin: SupabaseClient, teamId: string, eventId: string): Promise<void> {
  const token = await accessToken(admin, teamId)
  if (!token) return
  await google(token, `/calendars/${await calendarOf(admin, teamId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'DELETE' })
}

/** Revoga o token no Google ao desconectar (sem esperar: falhar aqui não impede desconectar). */
export async function revoke(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', signal: AbortSignal.timeout(8_000) }).catch(() => undefined)
}
