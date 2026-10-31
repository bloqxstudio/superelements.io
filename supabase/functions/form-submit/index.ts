import { createClient } from 'jsr:@supabase/supabase-js@2'
import { alertText, campaignSnapshot, leadOrigin, type AdReports } from '../lead-webhook/origin.ts'
import { hasContact, parseLead } from '../lead-webhook/parse.ts'
import { checkAnswers, cleanDefinition, cleanSettings, cleanTheme, resultFor, scoreOf, summaryOf, allFields, answerText, type FormField } from '../_shared/forms.ts'

/**
 * Formulários e quizzes do CRM (`/crm/formularios`), lado público: o script `forms.js` que roda no
 * site do cliente (Elementor) busca a definição aqui e manda as respostas. Sem login
 * (`verify_jwt = false`): o id do formulário, que só vale se ele estiver publicado, é quem autoriza.
 *
 *   GET  ?id=<form>[&view=1]  → { id, name, definition, theme, settings } (conta a visualização com `view=1`)
 *   POST (texto ou JSON)      → { id, answers, meta: { page, referrer, utm_*, gclid… }, hp }
 *
 * Tudo é refeito no servidor (validação, pontuação, faixa do quiz e qualificação). O lead entra pelo
 * mesmo caminho do webhook (`crm_receive_lead`): cliente, oportunidade "Novo lead", origem e aviso.
 */

const VERSION = 1
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

/** A conta está ativa e com o módulo Formulários ligado? (a página pública também para) */
async function formsOn(teamId: string): Promise<boolean> {
  const { data } = await admin.from('crm_teams').select('status, modules').eq('id', teamId).maybeSingle()
  if (!data || data.status !== 'ativa') return false
  return (data.modules as Record<string, unknown> | null)?.formularios !== false
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const url = new URL(request.url)

  if (request.method === 'GET') {
    const id = url.searchParams.get('id') ?? ''
    if (!id) return json({ ok: true, version: VERSION })
    if (!UUID.test(id)) return json({ error: 'Formulário não encontrado.' }, 404)
    const { data: form } = await admin.from('crm_forms').select('id, team_id, name, status, definition, theme, settings').eq('id', id).maybeSingle()
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
  // Campo-isca que só robô preenche: finge sucesso e não grava
  if (typeof body.hp === 'string' && body.hp) return json({ ok: true })

  const { data: form } = await admin.from('crm_forms').select('id, team_id, name, status, definition, settings').eq('id', id).maybeSingle()
  if (!form || form.status !== 'published' || !(await formsOn(form.team_id as string))) return json({ error: 'Formulário não encontrado.' }, 404)
  const teamId = form.team_id as string
  const definition = cleanDefinition(form.definition)
  const settings = cleanSettings(form.settings)

  const { count: recent } = await admin.from('crm_form_submissions').select('id', { count: 'exact', head: true }).eq('form_id', id).gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((recent ?? 0) >= 40) return json({ error: 'Muitos envios agora. Tente de novo em instantes.' }, 429)

  const { answers, errors } = checkAnswers(definition, body.answers)
  if (Object.keys(errors).length) return json({ error: 'Confira os campos.', errors }, 422)

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
  const qualified = definition.kind === 'quiz' ? Boolean(result?.qualified) : null

  // O cartão do lead mostra a mensagem escrita e, abaixo, as respostas do quiz ou formulário
  const lines = extra.map((row) => `${row.label}: ${row.value}`)
  if (score !== null) lines.push(`Pontuação: ${score}${result ? ` · ${result.title}` : ''}`)
  payload.message = [payload.message, ...lines].filter(Boolean).join(' | ').slice(0, 1500)

  const lead = parseLead(payload)
  if (!hasContact(lead)) return json({ error: 'Faltou um e-mail ou telefone para a equipe responder.', errors: {} }, 422)

  const { data: reports } = await admin.from('crm_ad_reports').select('preset, data, fetched_at').eq('team_id', teamId)
  const campaign = campaignSnapshot((reports ?? []) as AdReports, lead)
  const hash = await sha([id, lead.email, lead.phone, JSON.stringify(answers)].join('|'))
  const origin = { ...leadOrigin(lead, campaign, hash), form: form.name as string, formId: id, ...(score !== null ? { score, result: result?.title, qualified } : {}) }

  const { count } = await admin.from('crm_whatsapp_client_contacts').select('phone', { count: 'exact', head: true }).eq('account_id', teamId).eq('leads', true).eq('enabled', true)
  const alert = count ? alertText(lead, campaign, `${APP_URL}/crm?oportunidade={id}`) : null

  const { data: received, error } = await admin.rpc('crm_receive_lead', { p_team: teamId, p_lead: { name: lead.name, email: lead.email, phone: lead.phone, message: payload.message }, p_origin: origin, p_alert: alert })
  if (error) {
    console.error('crm_receive_lead:', error.message)
    return json({ error: 'Não consegui guardar suas respostas. Tente de novo.' }, 500)
  }
  const got = received as { opportunityId?: string; clientId?: string; duplicate?: boolean }

  if (!got.duplicate) {
    const { error: saveError } = await admin.from('crm_form_submissions').insert({
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
    })
    if (saveError) console.error('crm_form_submissions:', saveError.message)
  }

  const wa = settings.whatsapp
  const whatsappUrl = wa
    ? `https://wa.me/${wa.number}?text=${encodeURIComponent([wa.text, ...summary.map((r) => `${r.label}: ${r.value}`)].filter(Boolean).join('\n'))}`
    : undefined
  return json({
    ok: true,
    qualified,
    score,
    result: result ? { title: result.title, text: result.text, ctaLabel: result.ctaLabel, ctaUrl: result.ctaUrl } : undefined,
    redirectUrl: settings.redirectUrl,
    whatsappUrl,
  })
})
