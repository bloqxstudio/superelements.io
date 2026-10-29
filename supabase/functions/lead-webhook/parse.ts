/**
 * Lê o que o site manda para o webhook de leads e devolve o lead normalizado.
 * Aceita o webhook do Elementor Pro (campos em `fields`, com ou sem "dados avançados"),
 * JSON simples e formulário (`application/x-www-form-urlencoded`, inclusive chaves `fields[email][value]`).
 * Sem imports: roda na função (Deno) e nos testes (Node).
 */

export interface ParsedLead {
  name?: string
  email?: string
  /** Só dígitos, com o país quando der para saber */
  phone?: string
  message?: string
  utm: { source?: string; medium?: string; campaign?: string; content?: string; term?: string; id?: string }
  clickIds: { gclid?: string; gbraid?: string; wbraid?: string; fbclid?: string }
  ids: { campaignId?: string; adsetId?: string; adId?: string; placement?: string }
  page?: string
  referrer?: string
  form?: string
  /** Os outros campos do formulário (texto, no máximo 30) */
  fields: Record<string, string>
  channel: string
  paid: boolean
}

const clip = (value: unknown, max = 500): string | undefined => {
  if (value === null || value === undefined) return undefined
  const text = Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, max) : undefined
}

const norm = (key: string) =>
  key
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** `a[b][c]=1` → { a: { b: { c: '1' } } } (o que o PHP do Elementor manda) */
export function nestForm(params: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [raw, value] of params) {
    const path = raw.split(/\]\[|\[|\]/).filter((part) => part !== '')
    if (!path.length) continue
    let node = out
    path.forEach((part, index) => {
      if (['__proto__', 'constructor', 'prototype'].includes(part)) return
      if (index === path.length - 1) node[part] = value
      else node = (typeof node[part] === 'object' && node[part] !== null ? node[part] : (node[part] = {})) as Record<string, unknown>
    })
  }
  return out
}

/** Une os objetos de nível único e os campos do Elementor (`fields`) numa lista chave → texto */
function flatten(body: Record<string, unknown>): { entries: Map<string, string>; meta: Record<string, string>; form?: string } {
  const entries = new Map<string, string>()
  const meta: Record<string, string> = {}
  const add = (key: string, value: unknown) => {
    const k = norm(key)
    const text = clip(value)
    if (k && text !== undefined && !entries.has(k)) entries.set(k, text)
  }
  const fields = body.fields
  if (fields && typeof fields === 'object') {
    for (const [id, field] of Object.entries(fields as Record<string, unknown>)) {
      if (field && typeof field === 'object' && ('value' in field || 'raw_value' in field)) {
        const f = field as Record<string, unknown>
        add(String(f.id ?? id), f.value ?? f.raw_value)
        // O título do campo ("Qual o seu telefone?") ajuda a achar campos de nome livre
        if (typeof f.title === 'string' && !entries.has(norm(f.title))) add(f.title, f.value ?? f.raw_value)
      } else add(id, field)
    }
  }
  for (const [key, value] of Object.entries(body)) {
    if (key === 'fields') continue
    if (key === 'meta' && value && typeof value === 'object') {
      for (const [mk, mv] of Object.entries(value as Record<string, unknown>)) {
        const text = clip(mv)
        if (text !== undefined) meta[norm(mk)] = text
      }
      continue
    }
    if (key === 'form' && value && typeof value === 'object') continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) add(k, v)
      continue
    }
    add(key, value)
  }
  const form = body.form && typeof body.form === 'object' ? clip((body.form as Record<string, unknown>).name) : clip(body.form_name)
  return { entries, meta, form }
}

const pick = (entries: Map<string, string>, names: string[]) => {
  for (const name of names) {
    const hit = entries.get(name)
    if (hit) return { key: name, value: hit }
  }
  // Nome parecido ("seu_telefone", "telefone_whatsapp")
  for (const [key, value] of entries) if (names.some((n) => n.length > 3 && key.includes(n))) return { key, value }
  return undefined
}

const NAME = ['name', 'nome', 'full_name', 'nome_completo', 'your_name', 'first_name', 'primeiro_nome']
const EMAIL = ['email', 'e_mail', 'your_email', 'mail']
const PHONE = ['phone', 'telefone', 'whatsapp', 'celular', 'tel', 'fone', 'mobile', 'phone_number']
const MESSAGE = ['message', 'mensagem', 'msg', 'comments', 'comentario', 'observacao', 'duvida', 'descricao']

/** Só dígitos; 10 ou 11 dígitos viram Brasil (55…) */
export function cleanPhone(text: string | undefined): string | undefined {
  const digits = (text ?? '').replace(/\D/g, '').replace(/^00/, '')
  if (!digits) return undefined
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
  return /^[0-9]{10,15}$/.test(full) ? full : undefined
}

const host = (url: string | undefined) => {
  if (!url) return undefined
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/** De onde o lead veio, e se foi tráfego pago */
export function classify(utm: ParsedLead['utm'], clickIds: ParsedLead['clickIds'], referrer?: string): { channel: string; paid: boolean } {
  const source = (utm.source ?? '').toLowerCase()
  const medium = (utm.medium ?? '').toLowerCase()
  const paidMedium = /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|display|cpm|ads?)$/.test(medium)
  if (clickIds.gclid || clickIds.gbraid || clickIds.wbraid || (source === 'google' && paidMedium)) return { channel: 'Google Ads', paid: true }
  if (clickIds.fbclid || /(facebook|instagram|^ig$|^fb$|meta)/.test(source)) {
    const paid = Boolean(clickIds.fbclid) || paidMedium || !medium
    const insta = /(instagram|^ig$)/.test(source)
    return { channel: paid ? 'Meta Ads' : insta ? 'Instagram' : 'Facebook', paid }
  }
  if (source) return { channel: utm.source!, paid: paidMedium }
  const ref = host(referrer)
  if (ref) return { channel: /google\./.test(ref) ? 'Google (busca)' : ref, paid: false }
  return { channel: 'Direto', paid: false }
}

export function parseLead(raw: unknown): ParsedLead {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const { entries, meta, form } = flatten(body)
  const used = new Set<string>()
  const take = (names: string[]) => {
    const hit = pick(entries, names)
    if (hit) used.add(hit.key)
    return hit?.value
  }
  const name = take(NAME)
  const email = take(EMAIL)?.toLowerCase()
  const phoneRaw = take(PHONE)
  const message = take(MESSAGE)
  const utm = { source: take(['utm_source']), medium: take(['utm_medium']), campaign: take(['utm_campaign', 'campanha', 'campaign']), content: take(['utm_content']), term: take(['utm_term']), id: take(['utm_id']) }
  const clickIds = { gclid: take(['gclid']), gbraid: take(['gbraid']), wbraid: take(['wbraid']), fbclid: take(['fbclid']) }
  const ids = { campaignId: take(['campaign_id', 'hsa_cam']), adsetId: take(['adset_id', 'hsa_grp']), adId: take(['ad_id', 'hsa_ad']), placement: take(['placement']) }
  const page = take(['page_url', 'pagina', 'page', 'url']) ?? meta.page_url
  const referrer = take(['referrer', 'referer']) ?? meta.referrer
  const fields: Record<string, string> = {}
  for (const [key, value] of entries) {
    if (used.has(key) || key === 'submit' || key === 'form_name' || key === 'form_id' || key === 'post_id' || key === 'queried_id') continue
    if (Object.keys(fields).length >= 30) break
    fields[key] = value
  }
  const { channel, paid } = classify(utm, clickIds, referrer)
  return { name, email, phone: cleanPhone(phoneRaw) ?? (phoneRaw ? phoneRaw.replace(/\D/g, '') || undefined : undefined), message, utm, clickIds, ids, page, referrer, form, fields, channel, paid }
}

/** Sem nome, contato nem mensagem não é um lead (é um teste vazio ou lixo) */
export const hasContact = (lead: ParsedLead) => Boolean(lead.email || (lead.phone && lead.phone.length >= 10))
