import { createClient } from 'jsr:@supabase/supabase-js@2'
import { campaignSnapshot, leadOrigin, alertText, type AdReports } from './origin.ts'
import { hasContact, nestForm, parseLead } from './parse.ts'

/**
 * Webhook de leads: `POST /functions/v1/lead-webhook?key=<chave da conta>` (ou o cabeçalho `x-lead-key`).
 * Público (sem login): a chave da conta, gerada em Oportunidades › Receber leads, é quem autoriza.
 * Cria o cliente e a oportunidade "Novo lead" com a origem e a campanha, e enfileira o aviso no WhatsApp.
 */

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.avencestudio.com'
const MAX_BODY = 64 * 1024

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-lead-key', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })

const sha = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  const url = new URL(request.url)
  const key = url.searchParams.get('key') ?? request.headers.get('x-lead-key') ?? ''
  if (!/^[0-9a-f]{64}$/.test(key)) return json({ error: 'Chave inválida.' }, 401)

  const { data: hook } = await admin.from('crm_lead_hooks').select('team_id, enabled').eq('token', key).maybeSingle()
  if (!hook || !hook.enabled) return json({ error: 'Chave inválida.' }, 401)
  const teamId = hook.team_id as string

  const text = await request.text()
  if (text.length > MAX_BODY) return json({ error: 'Corpo grande demais.' }, 413)
  const type = request.headers.get('content-type') ?? ''
  let payload: unknown
  try {
    payload = type.includes('json') || text.trim().startsWith('{') ? JSON.parse(text) : nestForm(new URLSearchParams(text))
  } catch {
    return json({ error: 'Não consegui ler o corpo.' }, 400)
  }
  // Parâmetros na própria URL (utm_*, gclid…) valem como campos
  if (payload && typeof payload === 'object') for (const [k, v] of url.searchParams) if (k !== 'key' && !(k in (payload as object))) (payload as Record<string, unknown>)[k] = v

  const lead = parseLead(payload)
  if (!hasContact(lead)) return json({ error: 'O lead precisa de e-mail ou telefone.' }, 422)

  // Relatórios de anúncios da conta (último de cada período): a campanha e o quanto já gastou
  const { data: reports } = await admin.from('crm_ad_reports').select('preset, data, fetched_at').eq('team_id', teamId)
  const campaign = campaignSnapshot((reports ?? []) as AdReports, lead)
  const hash = await sha([lead.email, lead.phone, lead.message, lead.page].join('|'))
  const origin = leadOrigin(lead, campaign, hash)

  // Quem recebe aviso: ao menos um número marcado nesta conta (senão não enfileira)
  const { count } = await admin.from('crm_whatsapp_client_contacts').select('phone', { count: 'exact', head: true }).eq('account_id', teamId).eq('leads', true).eq('enabled', true)
  const alert = count ? alertText(lead, campaign, `${APP_URL}/crm?oportunidade={id}`) : null

  const { data, error } = await admin.rpc('crm_receive_lead', { p_team: teamId, p_lead: { name: lead.name, email: lead.email, phone: lead.phone, message: lead.message }, p_origin: origin, p_alert: alert })
  if (error) {
    console.error('crm_receive_lead:', error.message)
    return json({ error: 'Não consegui guardar o lead.' }, 500)
  }
  return json({ ok: true, ...(data as object) })
})
