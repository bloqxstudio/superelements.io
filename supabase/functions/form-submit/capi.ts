import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { pixelActive, pixelEvents, type FormPixel } from '../_shared/forms.ts'

/**
 * API de Conversões da Meta para o pixel do formulário: os mesmos eventos que o navegador dispara
 * (envio, Lead, agendamento) saem também do servidor, com o mesmo `event_id`, e a Meta junta os dois
 * (deduplicação). Só sai com o token gravado pelo gestor em `crm_form_pixel_tokens`. E-mail, telefone
 * e nome vão em SHA-256, como a Meta pede; IP e navegador vêm da requisição do visitante.
 */

const GRAPH = 'https://graph.facebook.com/v26.0'

export interface CapiUser {
  email?: string
  phone?: string
  name?: string
  fbp?: string
  fbc?: string
  ip?: string
  userAgent?: string
  url?: string
}

export interface CapiEvent {
  name: string
  id: string
  data?: Record<string, unknown>
}

const sha = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

async function userData(u: CapiUser) {
  const out: Record<string, unknown> = {}
  if (u.email) out.em = [await sha(u.email.trim().toLowerCase())]
  if (u.phone) {
    const digits = u.phone.replace(/\D/g, '')
    out.ph = [await sha(digits.length <= 11 ? `55${digits}` : digits)]
  }
  if (u.name) {
    const [first, ...rest] = u.name.trim().split(/\s+/)
    if (first) out.fn = [await sha(normalize(first))]
    if (rest.length) out.ln = [await sha(normalize(rest[rest.length - 1]))]
  }
  out.country = [await sha('br')]
  if (u.fbp) out.fbp = u.fbp
  if (u.fbc) out.fbc = u.fbc
  if (u.ip) out.client_ip_address = u.ip
  if (u.userAgent) out.client_user_agent = u.userAgent
  return out
}

/** O cookie `_fbc` quando o navegador não tem, montado do `fbclid` do anúncio (formato da Meta). */
export const fbcFrom = (fbclid: string | undefined, at = Date.now()) => (fbclid ? `fb.1.${at}.${fbclid}` : undefined)

/** IP e navegador de quem respondeu, a partir da requisição. */
export function requestUser(request: Request): Pick<CapiUser, 'ip' | 'userAgent'> {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return { ip: forwarded || request.headers.get('cf-connecting-ip') || undefined, userAgent: request.headers.get('user-agent') ?? undefined }
}

/** Manda os eventos (falha só vai ao log: nunca atrapalha o lead). */
export async function sendCapi(admin: SupabaseClient, formId: string, pixel: FormPixel | undefined, events: CapiEvent[], user: CapiUser) {
  if (!pixelActive(pixel) || !events.length) return
  const { data: secret } = await admin.from('crm_form_pixel_tokens').select('access_token, test_event_code').eq('form_id', formId).maybeSingle()
  const token = (secret?.access_token as string | undefined)?.trim()
  if (!token) return
  const user_data = await userData(user)
  const time = Math.floor(Date.now() / 1000)
  const body: Record<string, unknown> = {
    data: events.map((e) => ({ event_name: e.name, event_id: e.id, event_time: time, action_source: 'website', event_source_url: user.url, user_data, custom_data: e.data ?? {} })),
  }
  if (secret?.test_event_code) body.test_event_code = secret.test_event_code
  try {
    const response = await fetch(`${GRAPH}/${pixel.id}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) console.error(`capi ${pixel.id}: ${response.status} ${(await response.text()).slice(0, 300)}`)
  } catch (e) {
    console.error(`capi ${pixel.id}:`, e instanceof Error ? e.message : String(e))
  }
}

/** Os eventos do envio, com os ids que o navegador também usa. */
export function submitEvents(pixel: FormPixel, submissionId: string, qualified: boolean | null, data: Record<string, unknown>): CapiEvent[] {
  const names = pixelEvents(pixel)
  const out: CapiEvent[] = [{ name: pixel.submitEvent === 'custom' ? names.submit : pixel.submitEvent, id: `${submissionId}:submit`, data }]
  // Lead padrão só para quem passou no filtro (e sem repetir se o evento do envio já é o Lead)
  if (pixel.standardLead && qualified !== false && pixel.submitEvent !== 'Lead') out.push({ name: 'Lead', id: `${submissionId}:lead`, data })
  return out
}

export function scheduleEvents(pixel: FormPixel, bookingId: string, data: Record<string, unknown>): CapiEvent[] {
  const out: CapiEvent[] = [{ name: pixelEvents(pixel).scheduled, id: `${bookingId}:scheduled`, data }]
  if (pixel.standardSchedule) out.push({ name: 'Schedule', id: `${bookingId}:schedule`, data })
  return out
}

/** Roda depois da resposta quando o runtime deixa (Supabase Edge), senão espera. */
export async function background(task: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(task)
  else await task
}
