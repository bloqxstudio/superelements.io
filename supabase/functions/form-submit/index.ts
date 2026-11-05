import { createClient } from 'jsr:@supabase/supabase-js@2'
import { alertText, campaignSnapshot, leadOrigin, type AdReports } from '../lead-webhook/origin.ts'
import { hasContact, parseLead } from '../lead-webhook/parse.ts'
import {
  WEEKDAYS,
  allFields,
  answerText,
  bookingDays,
  bookingEligible,
  checkAnswers,
  cleanDefinition,
  cleanSettings,
  cleanTheme,
  localDay,
  localTime,
  resultFor,
  scoreOf,
  slotInstant,
  summaryOf,
  type Answers,
  type FormBooking,
  type FormField,
} from '../_shared/forms.ts'
import { background, fbcFrom, requestUser, scheduleEvents, sendCapi, submitEvents } from './capi.ts'
import { markVisit, track } from './track.ts'

/**
 * Formulários e quizzes do CRM (`/crm/formularios`), lado público: o script `forms.js` que roda no
 * site do cliente (Elementor) busca a definição aqui e manda as respostas. Sem login
 * (`verify_jwt = false`): o id do formulário, que só vale se ele estiver publicado, é quem autoriza.
 *
 *   GET  ?id=<form>[&view=1]  → { id, name, definition, theme, settings } (conta a visualização com `view=1`)
 *   POST (texto ou JSON)      → { id, answers, meta: { page, referrer, utm_*, gclid… }, hp }
 *   POST { action: 'book', id, submission, token, start } → reserva um horário da agenda
 *   POST { action: 'track', id, visit, kind, screen, step… } → batida da visita (Ao vivo e funil, `track.ts`)
 *
 * Tudo é refeito no servidor (validação, pontuação, faixa do quiz e qualificação). O lead entra pelo
 * mesmo caminho do webhook (`crm_receive_lead`): cliente, oportunidade "Novo lead", origem e aviso.
 * Quem passa no filtro da agenda recebe junto os horários livres e um `token` (HMAC da resposta com a
 * chave de serviço) que só serve para reservar com aquela resposta.
 */

const VERSION = 3
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.avencestudio.com'
const MAX_BODY = 64 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400' }
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors, ...extra } })

const sha = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

const META_KEYS = ['page', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'campaign_id', 'adset_id', 'ad_id', 'placement']

const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const bookingToken = async (submissionId: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`form-booking:${submissionId}`))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

/** Horários livres da agenda do formulário agora (sem os reservados). */
async function freeDays(formId: string, booking: FormBooking) {
  const { data } = await admin.from('crm_form_bookings').select('starts_at').eq('form_id', formId).eq('status', 'confirmado').gte('starts_at', new Date().toISOString())
  return bookingDays(booking, new Date(), (data ?? []).map((r) => r.starts_at as string))
}

const dayLabel = (at: Date) => {
  const { date, weekday } = localDay(at)
  return `${WEEKDAYS[weekday]}, ${date.slice(8, 10)}/${date.slice(5, 7)} às ${localTime(at)}`
}

/** A conta está ativa e com o módulo Formulários ligado? (a página pública também para) */
async function formsOn(teamId: string): Promise<boolean> {
  const { data } = await admin.from('crm_teams').select('status, modules').eq('id', teamId).maybeSingle()
  if (!data || data.status !== 'ativa') return false
  return (data.modules as Record<string, unknown> | null)?.formularios !== false
}

/**
 * A versão no ar: as colunas definition/theme/settings são o rascunho do editor; `live` é o que foi
 * publicado (migração 20261105020000). Sem `live` (antes da migração), vale o rascunho.
 */
function onAir(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null
  const live = row.live && typeof row.live === 'object' ? (row.live as Record<string, unknown>) : null
  return live ? { ...row, name: live.name ?? row.name, definition: live.definition, theme: live.theme, settings: live.settings } : row
}

/** Grava o arquivo público da configuração (`crm-forms/<conta>/<formulário>.json`) com a versão do banco. */
async function refreshPublic(form: Record<string, unknown>) {
  const body = JSON.stringify({ id: form.id, name: form.name, definition: cleanDefinition(form.definition), theme: cleanTheme(form.theme), settings: cleanSettings(form.settings) })
  const { error } = await admin.storage
    .from('crm-forms')
    .upload(`${form.team_id}/${form.id}.json`, new Blob([body], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '30' })
  if (error) console.warn('form-submit: arquivo público não regravado:', error.message)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const url = new URL(request.url)

  if (request.method === 'GET') {
    const id = url.searchParams.get('id') ?? ''
    if (!id) return json({ ok: true, version: VERSION })
    if (!UUID.test(id)) return json({ error: 'Formulário não encontrado.' }, 404)
    const form = onAir((await admin.from('crm_forms').select('id, team_id, name, status, definition, theme, settings, live').eq('id', id).maybeSingle()).data)
    if (!form || form.status !== 'published' || !(await formsOn(form.team_id as string))) return json({ error: 'Formulário não encontrado.' }, 404)
    if (url.searchParams.get('view') === '1') await admin.rpc('crm_form_view', { p_form: id })
    return json(
      { id: form.id, name: form.name, definition: cleanDefinition(form.definition), theme: cleanTheme(form.theme), settings: cleanSettings(form.settings) },
      200,
      { 'cache-control': 'public, max-age=30' }
    )
  }

  if (request.method !== 'POST') return json({ error: 'Use GET ou POST.' }, 405)
  const text = await request.text()
  if (text.length > MAX_BODY) return json({ error: 'Corpo grande demais.' }, 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return json({ error: 'Não consegui ler o corpo.' }, 400)
  }
  const id = String(body.id ?? '')
  if (!UUID.test(id)) return json({ error: 'Formulário não encontrado.' }, 404)
  if (body.action === 'book') return book(id, body, request)
  if (body.action === 'track') return track(admin, id, body, request, json)
  // Campo-isca que só robô preenche: finge sucesso e não grava
  if (typeof body.hp === 'string' && body.hp) return json({ ok: true })

  const form = onAir((await admin.from('crm_forms').select('id, team_id, name, status, definition, theme, settings, live').eq('id', id).maybeSingle()).data)
  if (!form || form.status !== 'published' || !(await formsOn(form.team_id as string))) return json({ error: 'Formulário não encontrado.' }, 404)
  const teamId = form.team_id as string
  const definition = cleanDefinition(form.definition)
  const settings = cleanSettings(form.settings)

  const { count: recent } = await admin.from('crm_form_submissions').select('id', { count: 'exact', head: true }).eq('form_id', id).gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((recent ?? 0) >= 40) return json({ error: 'Muitos envios agora. Tente de novo em instantes.' }, 429)

  const { answers, errors } = checkAnswers(definition, body.answers)
  if (Object.keys(errors).length) {
    // Erro num campo que a pessoa nem recebeu: a página abriu o arquivo público antigo. Regrava o arquivo
    // com a versão do banco, para quem recarregar (o forms.js pede isso) já receber a certa.
    const sent = body.answers && typeof body.answers === 'object' ? Object.keys(body.answers as Record<string, unknown>) : []
    if (Object.keys(errors).some((k) => !sent.includes(k))) await refreshPublic(form)
    return json({ error: 'Confira os campos.', errors }, 422)
  }

  const fields = allFields(definition)
  const byMap = (map: FormField['map'], fallback?: FormField['type']) => {
    const field = fields.find((f) => f.map === map && answers[f.id]) ?? (fallback ? fields.find((f) => f.type === fallback && answers[f.id]) : undefined)
    return field ? answerText(field, answers[field.id]) : undefined
  }
  const meta = body.meta && typeof body.meta === 'object' ? (body.meta as Record<string, unknown>) : {}
  const payload: Record<string, string> = { name: byMap('name') ?? '', email: byMap('email', 'email') ?? '', phone: byMap('phone', 'phone') ?? '', message: byMap('message') ?? '' }
  for (const key of META_KEYS) if (typeof meta[key] === 'string' && meta[key]) payload[key === 'page' ? 'page_url' : key] = (meta[key] as string).slice(0, 500)

  const summary = summaryOf(definition, answers)
  const contactFields = new Set(fields.filter((f) => f.map || (f.type === 'email' && answers[f.id]) || f.type === 'phone').map((f) => f.id))
  const extra = summary.filter((row) => !fields.some((f) => contactFields.has(f.id) && f.label === row.label))

  const score = definition.kind === 'quiz' ? scoreOf(definition, answers) : null
  const result = score === null ? undefined : resultFor(definition, score)
  const quizQualified = definition.kind === 'quiz' ? Boolean(result?.qualified) : null
  const booking = settings.booking
  const eligible = bookingEligible(definition, booking, answers, quizQualified)
  // Num formulário comum com filtro por resposta, o filtro é a qualificação (a Meta só recebe Lead de quem passa)
  const qualified = quizQualified ?? (booking?.enabled && booking.gate.mode === 'answer' ? eligible : null)

  // O cartão do lead mostra a mensagem escrita e, abaixo, as respostas do quiz ou formulário
  const lines = extra.map((row) => `${row.label}: ${row.value}`)
  if (score !== null) lines.push(`Pontuação: ${score}${result ? ` · ${result.title}` : ''}`)
  payload.message = [payload.message, ...lines].filter(Boolean).join(' | ').slice(0, 1500)

  const lead = parseLead(payload)
  if (!hasContact(lead)) return json({ error: 'Faltou um e-mail ou telefone para a equipe responder.', errors: {} }, 422)

  const { data: reports } = await admin.from('crm_ad_reports').select('preset, data, fetched_at').eq('team_id', teamId)
  const campaign = campaignSnapshot((reports ?? []) as AdReports, lead)
  const hash = await sha([id, lead.email, lead.phone, JSON.stringify(answers)].join('|'))
  // `meta`: o que a API de Conversões precisa para mandar o ganho de volta quando o card fechar
  const cookies = metaCookies(meta)
  const metaMatch = settings.pixel?.id ? { pixel: settings.pixel.id, fbp: cookies.fbp, fbc: cookies.fbc, url: cookies.url } : undefined
  const origin = { ...leadOrigin(lead, campaign, hash), form: form.name as string, formId: id, ...(metaMatch ? { meta: metaMatch } : {}), ...(score !== null ? { score, result: result?.title, qualified } : {}) }

  const { count } = await admin.from('crm_whatsapp_client_contacts').select('phone', { count: 'exact', head: true }).eq('account_id', teamId).eq('leads', true).eq('enabled', true)
  const { count: groupCount } = await admin.from('crm_whatsapp_groups').select('jid', { count: 'exact', head: true }).eq('leads_account_id', teamId)
  const alert = count || groupCount ? alertText(lead, campaign, `${APP_URL}/crm?oportunidade={id}`) : null

  const { data: received, error } = await admin.rpc('crm_receive_lead', { p_team: teamId, p_lead: { name: lead.name, email: lead.email, phone: lead.phone, message: payload.message }, p_origin: origin, p_alert: alert })
  if (error) {
    console.error('crm_receive_lead:', error.message)
    return json({ error: 'Não consegui guardar suas respostas. Tente de novo.' }, 500)
  }
  const got = received as { opportunityId?: string; clientId?: string; duplicate?: boolean }

  let submissionId: string | undefined
  if (got.duplicate && got.opportunityId) {
    // Reenvio: a resposta de antes continua valendo (inclusive para a agenda)
    const { data: before } = await admin.from('crm_form_submissions').select('id').eq('form_id', id).eq('opportunity_id', got.opportunityId).order('created_at', { ascending: false }).limit(1)
    submissionId = before?.[0]?.id as string | undefined
  }
  if (!got.duplicate) {
    const { data: saved, error: saveError } = await admin.from('crm_form_submissions').insert({
      form_id: id,
      team_id: teamId,
      answers,
      summary,
      name: lead.name ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      score,
      result: result?.title ?? null,
      qualified,
      client_id: got.clientId ?? null,
      opportunity_id: got.opportunityId ?? null,
      origin,
    }).select('id').single()
    if (saveError) console.error('crm_form_submissions:', saveError.message)
    submissionId = saved?.id as string | undefined
  }

  if (submissionId) await markVisit(admin, id, body.visit, { submitted: true, qualified, submission_id: submissionId, screen: 'result', left_at: null })

  // Passou no filtro: os horários livres e a chave para reservar vão junto
  let agenda: { token: string; submission: string; days: Awaited<ReturnType<typeof freeDays>> } | undefined
  if (eligible && booking && submissionId) {
    const { count: booked } = await admin.from('crm_form_bookings').select('id', { count: 'exact', head: true }).eq('submission_id', submissionId).eq('status', 'confirmado')
    if (!booked) agenda = { token: await bookingToken(submissionId), submission: submissionId, days: await freeDays(id, booking) }
  }

  // Pixel pelo servidor: os mesmos ids do navegador, a Meta junta os dois (reenvio duplicado não dispara de novo)
  if (settings.pixel && submissionId && !got.duplicate) {
    const data = { form_id: id, form_name: form.name as string, content_name: form.name as string, ...(score !== null ? { score } : {}), qualified }
    await background(sendCapi(admin, id, settings.pixel, submitEvents(settings.pixel, submissionId, qualified, data), { email: lead.email, phone: lead.phone, name: lead.name, ...cookies, ...requestUser(request) }))
  }

  const wa = settings.whatsapp
  // Só a mensagem de abertura: as respostas já estão no CRM (o card da oportunidade), não vão na conversa
  const whatsappUrl = wa
    ? `https://wa.me/${wa.number}${wa.text?.trim() ? `?text=${encodeURIComponent(wa.text.trim())}` : ''}`
    : undefined
  return json({
    ok: true,
    qualified,
    score,
    result: result ? { title: result.title, text: result.text, ctaLabel: result.ctaLabel, ctaUrl: result.ctaUrl } : undefined,
    // Com agenda, o redirecionamento e o WhatsApp esperam a reserva (a tela de agradecimento é a da agenda)
    redirectUrl: agenda ? undefined : settings.redirectUrl,
    whatsappUrl,
    submissionId,
    booking: agenda,
  })
})

/** Reserva um horário: confere a chave da resposta, o filtro e se o horário ainda está livre. */
/** Cookies da Meta e a página, que o `forms.js` manda em `meta` (para a API de Conversões). */
const metaCookies = (meta: Record<string, unknown>) => {
  const str = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 300) : undefined)
  return { fbp: str(meta.fbp), fbc: str(meta.fbc) ?? fbcFrom(str(meta.fbclid)), url: str(meta.url) ?? str(meta.page) }
}

async function book(id: string, body: Record<string, unknown>, request: Request) {
  const submission = String(body.submission ?? '')
  const token = String(body.token ?? '')
  const start = String(body.start ?? '')
  if (!UUID.test(submission) || !token || Number.isNaN(Date.parse(start))) return json({ error: 'Pedido de agendamento inválido.' }, 400)
  if (token !== (await bookingToken(submission))) return json({ error: 'Pedido de agendamento inválido.' }, 403)

  const form = onAir((await admin.from('crm_forms').select('id, team_id, name, status, definition, theme, settings, live').eq('id', id).maybeSingle()).data)
  if (!form || form.status !== 'published' || !(await formsOn(form.team_id as string))) return json({ error: 'Formulário não encontrado.' }, 404)
  const definition = cleanDefinition(form.definition)
  const booking = cleanSettings(form.settings).booking
  if (!booking?.enabled) return json({ error: 'A agenda deste formulário está fechada.' }, 409)

  const { data: sub } = await admin.from('crm_form_submissions').select('id, form_id, answers, qualified, name, phone, email, client_id, opportunity_id').eq('id', submission).maybeSingle()
  if (!sub || sub.form_id !== id) return json({ error: 'Resposta não encontrada.' }, 404)
  // O filtro vale na hora de reservar também (a configuração pode ter mudado)
  if (!bookingEligible(definition, booking, (sub.answers ?? {}) as Answers, definition.kind === 'quiz' ? (sub.qualified as boolean | null) : null)) {
    return json({ error: 'Esta resposta não abre a agenda.' }, 403)
  }

  const days = await freeDays(id, booking)
  const at = new Date(start)
  const valid = days.some((d) => d.times.some((t) => slotInstant(d.date, t).getTime() === at.getTime()))
  if (!valid) return json({ error: 'Este horário acabou de ser reservado. Escolha outro.', days }, 409)

  const ends = new Date(at.getTime() + booking.durationMin * 60_000)
  const { data: row, error } = await admin
    .from('crm_form_bookings')
    .insert({ form_id: id, team_id: form.team_id, submission_id: submission, client_id: sub.client_id, opportunity_id: sub.opportunity_id, starts_at: at.toISOString(), ends_at: ends.toISOString(), name: sub.name, phone: sub.phone, email: sub.email })
    .select('id')
    .single()
  if (error) {
    // Índice único: alguém pegou o horário no mesmo instante, ou esta resposta já reservou
    if (error.code === '23505') {
      const { count } = await admin.from('crm_form_bookings').select('id', { count: 'exact', head: true }).eq('submission_id', submission).eq('status', 'confirmado')
      if (count) return json({ error: 'Você já tem uma reunião marcada.' }, 409)
      return json({ error: 'Este horário acabou de ser reservado. Escolha outro.', days: await freeDays(id, booking) }, 409)
    }
    console.error('crm_form_bookings:', error.message)
    return json({ error: 'Não consegui reservar. Tente de novo.' }, 500)
  }

  // A visita que enviou esta resposta vira "agendou" (Ao vivo e funil)
  const { error: visitError } = await admin.from('crm_form_visits').update({ scheduled: true, screen: 'booked', last_at: new Date().toISOString() }).eq('submission_id', submission)
  if (visitError) console.error('crm_form_visits:', visitError.message)

  const label = dayLabel(at)
  if (sub.opportunity_id) {
    const { date } = localDay(at)
    await admin.from('crm_opportunities').update({ next_step: `Reunião agendada: ${label}`, next_date: date }).eq('id', sub.opportunity_id)
    if (sub.client_id) {
      await admin.from('crm_activities').insert({ client_id: sub.client_id, opportunity_id: sub.opportunity_id, kind: 'meeting', body: `${booking.meetingName} agendada pelo formulário "${form.name}": ${label} (${booking.durationMin} min)`, data: { booking: row.id, starts_at: at.toISOString(), form: id } })
    }
  }

  // O aviso sai pela mesma fila dos leads novos (o grupo da conta no WhatsApp)
  const teamId = form.team_id as string
  const { count: people } = await admin.from('crm_whatsapp_client_contacts').select('phone', { count: 'exact', head: true }).eq('account_id', teamId).eq('leads', true).eq('enabled', true)
  const { count: groups } = await admin.from('crm_whatsapp_groups').select('jid', { count: 'exact', head: true }).eq('leads_account_id', teamId)
  if (people || groups) {
    const phone = typeof sub.phone === 'string' ? sub.phone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : ''
    const lines = ['*📅 Reunião agendada*', '', `*${sub.name ?? 'Sem nome'}*`]
    if (phone) lines.push(`📱 ${phone}`)
    if (sub.email) lines.push(`✉️ ${sub.email}`)
    lines.push('', `🗓️ ${label} (${booking.durationMin} min)`, `📝 ${booking.meetingName} · ${form.name}`)
    if (sub.opportunity_id) lines.push('', `Abrir no CRM: ${APP_URL}/crm?oportunidade=${sub.opportunity_id}`)
    const { error: alertError } = await admin.from('crm_lead_alerts').insert({ team_id: teamId, opportunity_id: sub.opportunity_id, text: lines.join('\n') })
    if (alertError) console.error('crm_lead_alerts:', alertError.message)
  }

  const pixel = cleanSettings(form.settings).pixel
  if (pixel) {
    const meta = body.meta && typeof body.meta === 'object' ? (body.meta as Record<string, unknown>) : {}
    const data = { form_id: id, form_name: form.name, content_name: booking.meetingName, starts_at: at.toISOString() }
    await background(sendCapi(admin, id, pixel, scheduleEvents(pixel, row.id as string, data), { email: sub.email ?? undefined, phone: sub.phone ?? undefined, name: sub.name ?? undefined, ...metaCookies(meta), ...requestUser(request) }))
  }

  return json({ ok: true, bookingId: row.id, start: at.toISOString(), label })
}
