import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  GOOGLE_SCOPES,
  GoogleError,
  accessToken,
  createEvent,
  deleteEvent,
  exchangeCode,
  googleApp,
  listEvents,
  revoke,
} from '../_shared/googleCalendar.ts'
import { HttpError, checkRedirect as checkRedirectWith, dbErrorFor, errorResponse, packState, teamGuards, unpackState, type Ctx, type LoginStateBase } from '../_shared/metaAuth.ts'
import { cleanSettings } from '../_shared/forms.ts'

/**
 * Google Agenda da conta (`/crm/agenda`, 2026-11-14). Com login (verify_jwt): o gestor conecta e desconecta;
 * quem é da equipe vê os eventos, cria reuniões (Meet e convite por e-mail, mandado pelo próprio Google) e
 * cancela. O token fica em `crm_google_tokens` (sem acesso do navegador); o código comum com a `form-submit`
 * está em `_shared/googleCalendar.ts`.
 *
 *   status        { teamId }                            → { configured, connected? }
 *   auth_url      { teamId, redirectUri }               → { url }          (gestor)
 *   connect       { code, state, redirectUri }          → { email }        (gestor)
 *   disconnect    { teamId }                            → { ok }           (gestor)
 *   events        { teamId, from, to }                  → { events }
 *   create        { teamId, title, start, durationMin, emails, description?, meet?, clientId?, opportunityId? } → { event }
 *   cancel        { teamId, eventId }                   → { ok }
 *   booking_sync  { bookingId }                         → { ok }  (reserva de formulário cancelada/reativada na tela)
 */

const VERSION = 1
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })

const RETURN_PATH = '/agenda/retorno'
const REDIRECTS = (Deno.env.get('GOOGLE_REDIRECT_URIS') || `https://app.avencestudio.com${RETURN_PATH},http://localhost:8080${RETURN_PATH}`).split(',').map((v) => v.trim())
const checkRedirect = (value: unknown) => checkRedirectWith(value, { path: RETURN_PATH, allowed: REDIRECTS, local: true, message: 'Use o endereço publicado da plataforma para conectar o Google Agenda.', code: 'redirect' })

const dbError = dbErrorFor('As tabelas do Google Agenda ainda não existem: aplique a migração 20261114120000_crm_google_agenda.sql.')
const { requireRole } = teamGuards({ module: 'crm', moduleOff: 'O CRM está desligado para esta conta.', managerOnly: 'Só quem gerencia a equipe conecta ou desconecta o Google Agenda.', dbError })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Data e hora de Brasília, como a tela manda (o Brasil não tem horário de verão desde 2019: −03:00 fixo, como em `forms.ts`) */
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Liga cada convidado ao cliente do CRM com o mesmo e-mail (no cliente ou num contato dele). */
async function clientsByEmail(ctx: Ctx, teamId: string, emails: string[]) {
  const list = [...new Set(emails.map((e) => e.toLowerCase()).filter((e) => EMAIL.test(e)))].slice(0, 200)
  const out: Record<string, { clientId: string; name: string }> = {}
  if (!list.length) return out
  const [clients, contacts] = await Promise.all([
    ctx.user.from('crm_clients').select('id, name, email').eq('team_id', teamId).in('email', list),
    ctx.user.from('crm_contacts').select('client_id, email, crm_clients(name)').eq('team_id', teamId).in('email', list),
  ])
  for (const c of (contacts.data ?? []) as unknown as { client_id: string; email: string; crm_clients: { name: string } | { name: string }[] | null }[]) {
    const parent = Array.isArray(c.crm_clients) ? c.crm_clients[0] : c.crm_clients
    out[c.email.toLowerCase()] = { clientId: c.client_id, name: parent?.name ?? '' }
  }
  for (const c of (clients.data ?? []) as { id: string; name: string; email: string }[]) out[c.email.toLowerCase()] = { clientId: c.id, name: c.name }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: auth } = await user.auth.getUser()
    if (!auth?.user) return json({ error: 'Entre na conta para usar o Google Agenda.', code: 'auth' }, 401)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const ctx: Ctx = { user, admin, userId: auth.user.id }
    const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
    const app = googleApp()
    const needsApp = () => {
      if (!app.id || !app.secret) throw new HttpError('Falta configurar o app do Google no Supabase (segredos GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).', 503, 'not_configured')
    }

    switch (body.action) {
      case 'status': {
        const teamId = await requireRole(ctx, body.teamId, false)
        const { data, error } = await ctx.user.from('crm_google_calendars').select('email, connected_at, last_error').eq('team_id', teamId).maybeSingle()
        if (error) throw dbError(error)
        return json({ configured: !!app.id && !!app.secret, version: VERSION, connected: data ? { email: data.email, connectedAt: data.connected_at, lastError: data.last_error ?? undefined } : undefined })
      }

      case 'auth_url': {
        needsApp()
        const teamId = await requireRole(ctx, body.teamId, true)
        const redirectUri = checkRedirect(body.redirectUri)
        const state = await packState({ t: teamId, u: ctx.userId, r: redirectUri, e: Date.now() + 15 * 60_000, n: crypto.randomUUID() }, app.secret)
        const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        // offline + consent: o Google sempre devolve o refresh_token (sem ele a conexão cairia em 1 hora)
        auth.search = new URLSearchParams({ client_id: app.id, redirect_uri: redirectUri, response_type: 'code', scope: GOOGLE_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state }).toString()
        return json({ url: auth.toString() })
      }

      case 'connect': {
        needsApp()
        const state = await unpackState<LoginStateBase>(body.state, app.secret, 'Google', 'pela tela Agenda')
        if (state.u !== ctx.userId) throw new HttpError('O login no Google foi começado por outra pessoa. Conecte de novo.', 403, 'state')
        if (checkRedirect(body.redirectUri) !== state.r) throw new HttpError('Endereço de volta diferente do pedido.', 400, 'state')
        const teamId = await requireRole(ctx, state.t, true)
        if (typeof body.code !== 'string' || !body.code) throw new HttpError('O Google não devolveu o código do login.')
        const grant = await exchangeCode(body.code, state.r)
        if (!grant.scopes.includes('https://www.googleapis.com/auth/calendar.events')) throw new HttpError('Na tela do Google, marque a permissão de ver e editar os eventos da agenda e conecte de novo.', 400, 'scope')
        if (!grant.refreshToken) throw new HttpError('O Google não deu o acesso permanente. Conecte de novo.', 400, 'refresh')
        const now = new Date().toISOString()
        const { error } = await admin.from('crm_google_calendars').upsert({ team_id: teamId, email: grant.email || 'Google Agenda', calendar_id: 'primary', connected_by: ctx.userId, connected_at: now, last_error: null, updated_at: now })
        if (error) throw dbError(error)
        const { error: tokenError } = await admin.from('crm_google_tokens').upsert({ team_id: teamId, refresh_token: grant.refreshToken, access_token: grant.accessToken, expires_at: grant.expiresAt, scopes: grant.scopes })
        if (tokenError) throw dbError(tokenError)
        return json({ email: grant.email, teamId })
      }

      case 'disconnect': {
        const teamId = await requireRole(ctx, body.teamId, true)
        const { data } = await admin.from('crm_google_tokens').select('refresh_token').eq('team_id', teamId).maybeSingle()
        if (data?.refresh_token) await revoke(data.refresh_token as string)
        const { error } = await admin.from('crm_google_calendars').delete().eq('team_id', teamId)
        if (error) throw dbError(error)
        return json({ ok: true })
      }

      case 'events': {
        const teamId = await requireRole(ctx, body.teamId, false)
        const from = new Date(String(body.from ?? ''))
        const to = new Date(String(body.to ?? ''))
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 62 * 86_400_000) throw new HttpError('Período inválido (até 62 dias).')
        const events = await listEvents(admin, teamId, from, to)
        if (!events) throw new HttpError('Conecte o Google Agenda primeiro.', 409, 'not_connected')
        const clients = await clientsByEmail(ctx, teamId, events.flatMap((e) => e.attendees.map((a) => a.email)))
        return json({ events: events.map((e) => ({ ...e, clients: [...new Map(e.attendees.map((a) => clients[a.email.toLowerCase()]).filter(Boolean).map((c) => [c.clientId, c])).values()] })) })
      }

      case 'create': {
        const teamId = await requireRole(ctx, body.teamId, false)
        const title = text(body.title, 200)
        if (!title) throw new HttpError('Dê um título à reunião.')
        const start = String(body.start ?? '')
        if (!LOCAL.test(start)) throw new HttpError('Data ou hora inválida.')
        const at = new Date(`${start}:00-03:00`)
        if (Number.isNaN(at.getTime())) throw new HttpError('Data ou hora inválida.')
        if (at.getTime() < Date.now() - 5 * 60_000) throw new HttpError('Esse horário já passou.')
        const minutes = Math.round(Number(body.durationMin))
        if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) throw new HttpError('Duração inválida.')
        const emails = (Array.isArray(body.emails) ? body.emails : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean)
        const bad = emails.find((e) => !EMAIL.test(e))
        if (bad) throw new HttpError(`E-mail inválido: ${bad}`)
        if (emails.length > 20) throw new HttpError('No máximo 20 convidados.')

        // O cliente e o card precisam ser desta conta (lidos com o acesso de quem chamou)
        let clientId: string | undefined
        let opportunityId: string | undefined
        if (typeof body.clientId === 'string' && UUID.test(body.clientId)) {
          const { data } = await ctx.user.from('crm_clients').select('id').eq('id', body.clientId).eq('team_id', teamId).maybeSingle()
          if (!data) throw new HttpError('Cliente não encontrado nesta conta.', 404)
          clientId = data.id as string
        }
        if (typeof body.opportunityId === 'string' && UUID.test(body.opportunityId)) {
          const { data } = await ctx.user.from('crm_opportunities').select('id, client_id').eq('id', body.opportunityId).eq('team_id', teamId).maybeSingle()
          if (!data) throw new HttpError('Card não encontrado nesta conta.', 404)
          opportunityId = data.id as string
          clientId ??= (data.client_id as string | null) ?? undefined
        }

        const event = await createEvent(admin, teamId, {
          title,
          start: at.toISOString(),
          end: new Date(at.getTime() + minutes * 60_000).toISOString(),
          description: text(body.description, 4000),
          attendees: [...new Set(emails)].map((email) => ({ email })),
          meet: body.meet !== false,
        })

        // Na linha do tempo do cliente e como próximo passo do card (falhar aqui não desfaz o evento)
        const label = at.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        if (clientId) {
          const { error } = await ctx.user.from('crm_activities').insert({
            team_id: teamId,
            client_id: clientId,
            opportunity_id: opportunityId ?? null,
            kind: 'meeting',
            body: `${title}: ${label} (${minutes} min)${event.meet ? ` · Meet: ${event.meet}` : ''}${emails.length ? ` · convite para ${emails.join(', ')}` : ''}`,
            data: { google_event_id: event.id, starts_at: at.toISOString(), meet: event.meet },
            created_by: ctx.userId,
          })
          if (error) console.warn('[google-calendar] atividade não gravada:', error.message)
        }
        if (opportunityId) {
          const { error } = await ctx.user.from('crm_opportunities').update({ next_step: `Reunião: ${label}`, next_date: start.slice(0, 10) }).eq('id', opportunityId)
          if (error) console.warn('[google-calendar] card não atualizado:', error.message)
        }
        return json({ event })
      }

      case 'cancel': {
        const teamId = await requireRole(ctx, body.teamId, false)
        const eventId = text(body.eventId, 1024)
        if (!eventId) throw new HttpError('Evento inválido.')
        await deleteEvent(admin, teamId, eventId)
        // Era uma reserva de formulário: o horário volta a ficar livre
        await admin.from('crm_form_bookings').update({ status: 'cancelado', google_event_id: null }).eq('team_id', teamId).eq('google_event_id', eventId)
        return json({ ok: true })
      }

      case 'booking_sync': {
        if (typeof body.bookingId !== 'string' || !UUID.test(body.bookingId)) throw new HttpError('Reserva inválida.')
        // Lida com o acesso de quem chamou: só aparece para a equipe da conta
        const { data, error } = await ctx.user.from('crm_form_bookings').select('id, team_id, form_id, status, starts_at, ends_at, name, email, phone, google_event_id').eq('id', body.bookingId).maybeSingle()
        if (error) throw dbError(error)
        if (!data) throw new HttpError('Reserva não encontrada.', 404)
        const teamId = await requireRole(ctx, data.team_id, true)
        if (!(await accessToken(admin, teamId))) return json({ ok: true, skipped: 'not_connected' })
        if (data.status === 'cancelado' && data.google_event_id) {
          await deleteEvent(admin, teamId, data.google_event_id as string)
          await admin.from('crm_form_bookings').update({ google_event_id: null, meet_url: null }).eq('id', data.id)
          return json({ ok: true, removed: true })
        }
        if (data.status === 'confirmado' && !data.google_event_id && Date.parse(data.ends_at as string) > Date.now()) {
          const { data: form } = await admin.from('crm_forms').select('settings, live').eq('id', data.form_id).maybeSingle()
          const live = (form?.live as { settings?: unknown } | null)?.settings ?? form?.settings
          const booking = cleanSettings(live).booking
          if (!booking?.google) return json({ ok: true, skipped: 'off' })
          const email = typeof data.email === 'string' && EMAIL.test(data.email) ? data.email : ''
          const event = await createEvent(admin, teamId, {
            title: `${booking.meetingName} · ${data.name ?? 'Lead'}`.slice(0, 200),
            start: data.starts_at as string,
            end: data.ends_at as string,
            description: [data.name, data.phone && `Telefone: ${data.phone}`, email && `E-mail: ${email}`].filter(Boolean).join('\n'),
            attendees: email ? [{ email, name: (data.name as string | null) ?? undefined }] : [],
            meet: true,
            bookingId: data.id as string,
          })
          await admin.from('crm_form_bookings').update({ google_event_id: event.id, meet_url: event.meet ?? null }).eq('id', data.id)
          return json({ ok: true, created: true })
        }
        return json({ ok: true })
      }

      default:
        return json({ error: 'Ação desconhecida.' }, 400)
    }
  } catch (error) {
    if (error instanceof GoogleError) {
      console.error('[google-calendar]', error.code, error.message)
      return json({ error: error.message, code: error.code }, error.status)
    }
    return errorResponse(error, '[google-calendar]', json)
  }
})
