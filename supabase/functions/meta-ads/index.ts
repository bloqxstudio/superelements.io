import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Os anúncios da equipe pela API de anúncios da Meta (Marketing API,
 * `graph.facebook.com`): conecta uma ou mais contas de anúncios e lê as
 * campanhas de Facebook e Instagram (aba Anúncios de `/crm/instagram`). Só
 * leitura: nada aqui cria, pausa ou muda campanha ou orçamento.
 *
 * Conectar: quem tem acesso à conta de anúncios entra com o Facebook (login
 * do Facebook para empresas) ou cola um token, e escolhe só as contas desta
 * equipe; o login fica 30 minutos em `crm_ad_pending` até a escolha. Com uma
 * configuração de login de "token de usuário do sistema" (`META_LOGIN_CONFIG_ID`)
 * o acesso não expira; sem ela, o token de usuário vale 60 dias.
 *
 * O token fica só aqui no servidor (`crm_ad_tokens`, sem acesso do
 * navegador). Cada relatório é gravado em `crm_ad_reports`; a tela lê de lá.
 * Conectar e ler é de quem é da equipe; desconectar, do gestor.
 *
 * Segredos (Supabase › Edge Functions › Secrets): `META_APP_ID` e
 * `META_APP_SECRET` (app da Meta › Configurações do app › Informação básica)
 * e, se houver, `META_LOGIN_CONFIG_ID`. Sem eles, ainda dá para colar um token.
 */

const VERSION = 'v26.0'
const GRAPH = `https://graph.facebook.com/${VERSION}`
const SCOPES = ['ads_read']
const CALLBACK_PATH = '/anuncios/retorno'
const PRESETS = ['last_7d', 'last_30d', 'last_90d', 'this_month'] as const
type Preset = (typeof PRESETS)[number]
const DAY = 86_400_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'error'
  ) {
    super(message)
  }
}

// ---------- Meta ----------

interface MetaError {
  message?: string
  code?: number
  error_subcode?: number
  error_user_msg?: string
}

/** A recusa da Meta em português, com o código que a tela entende (`token`: conectar de novo). */
function metaError(error: MetaError | undefined, status: number): HttpError {
  const code = error?.code
  const sub = error?.error_subcode
  if (code === 190) return new HttpError('A conexão com a conta de anúncios expirou ou foi revogada. Conecte de novo.', 401, 'token')
  if (code === 4 || code === 17 || code === 32 || code === 613 || (code !== undefined && code >= 80000 && code <= 80014) || sub === 2446079)
    return new HttpError('A Meta pediu uma pausa (muitas leituras seguidas desta conta de anúncios). Tente de novo em alguns minutos.', 429, 'rate')
  if (code === 100 && sub === 33) return new HttpError('Esse acesso não enxerga a conta de anúncios (ela saiu do acesso de quem conectou?). Conecte de novo.', 403, 'token')
  if (code === 10 || code === 200 || code === 294 || (code !== undefined && code > 200 && code < 300))
    return new HttpError(`Falta permissão para ler os anúncios (ads_read)${error?.message ? `: ${error.message}` : ''}.`, 403, 'permission')
  const text = error?.error_user_msg || error?.message || `A Meta respondeu com erro ${status}.`
  return new HttpError(text, status >= 400 && status < 600 ? status : 400, code === 100 ? 'field' : 'meta')
}

type Params = Record<string, string | number | boolean | undefined>

async function getJson<T>(url: URL | string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(45_000) })
  const data = (await response.json().catch(() => null)) as ({ error?: MetaError } & T) | null
  if (!response.ok || !data || data.error) throw metaError(data?.error, response.status)
  return data as T
}

/** Uma leitura da API da Meta. `path` é relativo à versão (`act_123/insights`, `me/adaccounts`). */
function graph<T>(path: string, token: string, params: Params = {}): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\/+/, '')}`)
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value))
  url.searchParams.set('access_token', token)
  return getJson<T>(url)
}

interface Paged<T> {
  data: T[]
  paging?: { next?: string }
}

/** Todas as páginas de uma lista (até `max` itens). */
async function all<T>(path: string, token: string, params: Params, max = 1000): Promise<T[]> {
  let page = await graph<Paged<T>>(path, token, params)
  const rows = [...(page.data ?? [])]
  while (page.paging?.next && rows.length < max) {
    page = await getJson<Paged<T>>(page.paging.next)
    rows.push(...(page.data ?? []))
  }
  return rows.slice(0, max)
}

/** Número da conta de anúncios: só dígitos, sem o `act_`. */
const adAccountId = (value: unknown) => {
  const text = typeof value === 'string' ? value.replace(/^act_/, '') : ''
  if (!/^\d{1,40}$/.test(text)) throw new HttpError('Conta de anúncios inválida.')
  return text
}

// ---------- estado do login (assinado com o segredo do app) ----------

const encoder = new TextEncoder()
const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function sign(text: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toB64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(text))))
}

const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface LoginState {
  /** equipe */
  t: string
  /** quem pediu */
  u: string
  /** endereço de volta */
  r: string
  /** expira (ms) */
  e: number
  n: string
}

async function packState(state: LoginState, secret: string) {
  const body = toB64(encoder.encode(JSON.stringify(state)))
  return `${body}.${await sign(body, secret)}`
}

async function unpackState(text: unknown, secret: string): Promise<LoginState> {
  const [body = '', mac = ''] = typeof text === 'string' ? text.split('.') : []
  if (!body || !mac || !sameText(mac, await sign(body, secret))) throw new HttpError('Este retorno do Facebook não veio desta plataforma. Conecte de novo pela aba Anúncios.', 400, 'state')
  let state: LoginState
  try {
    state = JSON.parse(new TextDecoder().decode(fromB64(body))) as LoginState
  } catch {
    throw new HttpError('Retorno do Facebook ilegível. Conecte de novo.', 400, 'state')
  }
  if (state.e < Date.now()) throw new HttpError('O login no Facebook demorou demais. Conecte de novo.', 400, 'state')
  return state
}

/** Só a tela de retorno da própria plataforma: https, ou localhost no servidor de dev. */
function checkRedirect(value: unknown) {
  if (typeof value !== 'string') throw new HttpError('Falta o endereço de volta.')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new HttpError('Endereço de volta inválido.')
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if ((url.protocol !== 'https:' && !local) || url.pathname !== CALLBACK_PATH || url.search || url.hash) throw new HttpError('Endereço de volta inválido.')
  return url.toString()
}

// ---------- token ----------

interface Grant {
  token: string
  /** `user`: vale até `expiresAt`; `system`: não expira */
  kind: 'user' | 'system' | null
  expiresAt: string | null
}

interface App {
  id: string
  secret: string
}

async function exchangeCode(code: string, redirectUri: string, app: App): Promise<Grant> {
  const url = new URL(`${GRAPH}/oauth/access_token`)
  url.search = new URLSearchParams({ client_id: app.id, client_secret: app.secret, redirect_uri: redirectUri, code }).toString()
  const data = await getJson<{ access_token?: string; expires_in?: number }>(url)
  if (!data.access_token) throw new HttpError('O Facebook não devolveu o acesso. Conecte de novo.', 400, 'meta')
  return { token: data.access_token, kind: null, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null }
}

/** Como o token é: de usuário (com validade) ou de usuário do sistema (não expira). Precisa do app. */
async function describe(grant: Grant, app: App | null): Promise<Grant> {
  if (!app) return grant
  try {
    const url = new URL(`${GRAPH}/debug_token`)
    url.search = new URLSearchParams({ input_token: grant.token, access_token: `${app.id}|${app.secret}` }).toString()
    const { data } = await getJson<{ data?: { type?: string; expires_at?: number; is_valid?: boolean } }>(url)
    if (data?.is_valid === false) throw new HttpError('Esse token não vale mais. Gere outro.', 401, 'token')
    if (data?.expires_at === 0 || data?.type === 'SYSTEM_USER') return { ...grant, kind: 'system', expiresAt: null }
    if (data?.expires_at) return { ...grant, kind: 'user', expiresAt: new Date(data.expires_at * 1000).toISOString() }
  } catch (error) {
    if (error instanceof HttpError && error.code === 'token') throw error
    console.warn('[meta-ads] debug_token falhou', error)
  }
  return grant
}

/** Token de usuário curto (horas) vira longo (60 dias). Token do sistema fica como veio. */
async function lengthen(grant: Grant, app: App | null): Promise<Grant> {
  if (!app || grant.kind === 'system') return grant
  if (grant.expiresAt && Date.parse(grant.expiresAt) - Date.now() > 7 * DAY) return grant
  try {
    const url = new URL(`${GRAPH}/oauth/access_token`)
    url.search = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: app.id, client_secret: app.secret, fb_exchange_token: grant.token }).toString()
    const data = await getJson<{ access_token?: string; expires_in?: number }>(url)
    if (data.access_token)
      return { token: data.access_token, kind: 'user', expiresAt: new Date(Date.now() + (data.expires_in ?? 60 * 86_400) * 1000).toISOString() }
  } catch (error) {
    console.warn('[meta-ads] não alongou o token', error)
  }
  return grant
}

// ---------- banco ----------

interface Ctx {
  user: SupabaseClient
  admin: SupabaseClient
  userId: string
}

interface AccountRow {
  id: string
  team_id: string
  ad_account_id: string
  name: string
  currency: string
}

const dbError = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || error.code === 'PGRST205'
    ? new HttpError('As tabelas de anúncios ainda não existem: aplique a migração 20261025120000_crm_meta_ads.sql.', 503, 'no_tables')
    : new HttpError(error.message ?? 'Falha no banco.', 500, 'db')

const uuid = (value: unknown, what: string) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(value)) throw new HttpError(`${what} inválida.`)
  return value
}

async function requireRole(ctx: Ctx, teamId: unknown, manager: boolean) {
  const team = uuid(teamId, 'Equipe')
  const { data, error } = await ctx.user.rpc(manager ? 'is_crm_manager' : 'is_crm_member', { p_team: team })
  if (error) throw dbError(error)
  if (!data) throw new HttpError(manager ? 'Só quem gerencia a equipe desconecta uma conta de anúncios.' : 'Você não é desta equipe.', 403, 'forbidden')
  return team
}

/** A conta, lida com o acesso de quem chamou (as regras do banco dizem se é da equipe). */
async function accountOf(ctx: Ctx, accountId: unknown): Promise<AccountRow> {
  const id = uuid(accountId, 'Conta')
  const { data, error } = await ctx.user.from('crm_ad_accounts').select('id, team_id, ad_account_id, name, currency').eq('id', id).maybeSingle()
  if (error) throw dbError(error)
  if (!data) throw new HttpError('Essa conta de anúncios não está ligada à sua equipe.', 404, 'not_found')
  return data as AccountRow
}

const markBroken = (ctx: Ctx, accountId: string) => ctx.admin.from('crm_ad_accounts').update({ sync_error: 'token' }).eq('id', accountId)

async function tokenOf(ctx: Ctx, account: AccountRow): Promise<string> {
  const { data, error } = await ctx.admin.from('crm_ad_tokens').select('access_token, expires_at').eq('account_id', account.id).maybeSingle()
  if (error) throw dbError(error)
  const row = data as { access_token: string; expires_at: string | null } | null
  if (!row || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) {
    await markBroken(ctx, account.id)
    throw new HttpError('O acesso à conta de anúncios expirou. Conecte de novo.', 401, 'token')
  }
  return row.access_token
}

// ---------- conectar ----------

interface AdAccount {
  id: string
  account_id: string
  name?: string
  currency?: string
  timezone_name?: string
  account_status?: number
  business?: { name?: string }
}

interface PendingAccount {
  id: string
  name: string
  currency: string
  timezoneName?: string
  status?: number
  business?: string
  /** Já ligada a esta equipe */
  connected: boolean
}

// Business metadata requires business_management; ads_read is enough for accounts and reports.
const ACCOUNT_FIELDS = 'id,account_id,name,currency,timezone_name,account_status'

/** Guarda o login por 30 minutos e devolve as contas que ele enxerga, para a pessoa escolher. */
async function hold(ctx: Ctx, teamId: string, grant: Grant) {
  const me = await graph<{ name?: string }>('me', grant.token, { fields: 'name' }).catch(() => ({ name: undefined }) as { name?: string })
  const found = await all<AdAccount>('me/adaccounts', grant.token, { fields: ACCOUNT_FIELDS, limit: 200 }, 1000)
  if (!found.length)
    throw new HttpError(
      'Esse acesso não enxerga nenhuma conta de anúncios. Confira se quem entrou tem acesso à conta (no Gerenciador de Negócios) e se a permissão ads_read foi aceita.',
      404,
      'no_accounts'
    )
  const { data: linked } = await ctx.admin.from('crm_ad_accounts').select('ad_account_id').eq('team_id', teamId)
  const already = new Set(((linked ?? []) as { ad_account_id: string }[]).map((r) => r.ad_account_id))
  const accounts: PendingAccount[] = found.map((a) => ({
    id: a.account_id,
    name: a.name || `Conta ${a.account_id}`,
    currency: a.currency || 'BRL',
    timezoneName: a.timezone_name,
    status: a.account_status,
    business: a.business?.name,
    connected: already.has(a.account_id),
  }))
  await ctx.admin.from('crm_ad_pending').delete().eq('user_id', ctx.userId)
  const { data, error } = await ctx.admin
    .from('crm_ad_pending')
    .insert({ team_id: teamId, user_id: ctx.userId, access_token: grant.token, token_kind: grant.kind, token_expires_at: grant.expiresAt, connected_name: me.name ?? null, accounts })
    .select('id')
    .single()
  if (error) throw dbError(error)
  return { pendingId: (data as { id: string }).id, accounts, who: me.name ?? null, kind: grant.kind, expiresAt: grant.expiresAt }
}

async function choose(ctx: Ctx, body: Record<string, unknown>) {
  const pendingId = uuid(body.pendingId, 'Conexão')
  const ids = Array.isArray(body.accountIds) ? body.accountIds.map(adAccountId) : []
  if (!ids.length) throw new HttpError('Escolha ao menos uma conta de anúncios.')
  if (ids.length > 50) throw new HttpError('Escolha no máximo 50 contas de uma vez.')
  const { data, error } = await ctx.admin.from('crm_ad_pending').select('*').eq('id', pendingId).eq('user_id', ctx.userId).maybeSingle()
  if (error) throw dbError(error)
  const pending = data as { team_id: string; access_token: string; token_kind: string | null; token_expires_at: string | null; connected_name: string | null; accounts: PendingAccount[]; valid_until: string } | null
  if (!pending || Date.parse(pending.valid_until) < Date.now()) throw new HttpError('Essa conexão expirou (30 minutos). Entre com o Facebook de novo.', 410, 'expired')
  const teamId = await requireRole(ctx, pending.team_id, false)
  const chosen = pending.accounts.filter((a) => ids.includes(a.id))
  if (chosen.length !== ids.length) throw new HttpError('Uma das contas escolhidas não veio desse login.')

  const now = new Date().toISOString()
  const { data: rows, error: upsertError } = await ctx.admin
    .from('crm_ad_accounts')
    .upsert(
      chosen.map((a) => ({
        team_id: teamId,
        ad_account_id: a.id,
        name: a.name,
        currency: a.currency,
        timezone_name: a.timezoneName ?? null,
        account_status: a.status ?? null,
        business_name: a.business ?? null,
        connected_by: ctx.userId,
        connected_name: pending.connected_name,
        connected_at: now,
        token_kind: pending.token_kind,
        token_expires_at: pending.token_expires_at,
        sync_error: null,
      })),
      { onConflict: 'team_id,ad_account_id' }
    )
    .select('id, name')
  if (upsertError) throw dbError(upsertError)
  const saved = (rows ?? []) as { id: string; name: string }[]
  const { error: tokenError } = await ctx.admin
    .from('crm_ad_tokens')
    .upsert(saved.map((r) => ({ account_id: r.id, access_token: pending.access_token, issued_at: now, expires_at: pending.token_expires_at })), { onConflict: 'account_id' })
  if (tokenError) throw dbError(tokenError)
  await ctx.admin.from('crm_ad_pending').delete().eq('id', pendingId)
  return { accounts: saved }
}

// ---------- relatório ----------

interface Action {
  action_type: string
  value: string
}

interface ResultStat {
  indicator?: string
  values?: { value?: string | number }[]
}

interface InsightRow {
  date_start?: string
  date_stop?: string
  campaign_id?: string
  campaign_name?: string
  objective?: string
  ad_id?: string
  ad_name?: string
  spend?: string
  impressions?: string
  reach?: string
  frequency?: string
  clicks?: string
  inline_link_clicks?: string
  actions?: Action[]
  results?: ResultStat[]
  cost_per_result?: ResultStat[]
  publisher_platform?: string
  age?: string
  gender?: string
  region?: string
}

const num = (value: unknown) => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? n : undefined
}

interface Metrics {
  spend: number
  impressions: number
  reach?: number
  frequency?: number
  clicks: number
  linkClicks: number
  leads: number
  conversations: number
  actions?: Record<string, number>
}

const LEAD_TYPES = ['onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']
const CONVERSATION = 'onsite_conversion.messaging_conversation_started_7d'

function metricsOf(row: InsightRow | undefined, withActions = false): Metrics {
  const actions: Record<string, number> = {}
  for (const a of row?.actions ?? []) {
    const v = num(a.value)
    if (v !== undefined) actions[a.action_type] = v
  }
  // `lead` já soma os do formulário da Meta e os do site; sem ele, soma os dois
  const leads = actions.lead ?? LEAD_TYPES.reduce((sum, t) => sum + (actions[t] ?? 0), 0)
  return {
    spend: num(row?.spend) ?? 0,
    impressions: num(row?.impressions) ?? 0,
    reach: num(row?.reach),
    frequency: num(row?.frequency),
    clicks: num(row?.clicks) ?? 0,
    linkClicks: num(row?.inline_link_clicks) ?? actions.link_click ?? 0,
    leads,
    conversations: actions[CONVERSATION] ?? 0,
    ...(withActions ? { actions } : {}),
  }
}

function add(a: Metrics, b: Metrics): Metrics {
  return {
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    linkClicks: a.linkClicks + b.linkClicks,
    leads: a.leads + b.leads,
    conversations: a.conversations + b.conversations,
  }
}

const EMPTY: Metrics = { spend: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: 0, conversations: 0 }

interface Result {
  /** Tipo da ação da Meta (`lead`, `link_click`…) ou `reach` */
  type: string
  value: number
  cost?: number
}

/** O que conta como resultado quando a Meta não manda `results`, pelo objetivo da campanha. */
const BY_OBJECTIVE: Record<string, string[]> = {
  OUTCOME_LEADS: ['lead', ...LEAD_TYPES, CONVERSATION],
  LEAD_GENERATION: ['lead', ...LEAD_TYPES],
  OUTCOME_ENGAGEMENT: [CONVERSATION, 'post_engagement', 'video_view'],
  MESSAGES: [CONVERSATION],
  OUTCOME_TRAFFIC: ['link_click', 'landing_page_view'],
  LINK_CLICKS: ['link_click'],
  OUTCOME_SALES: ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', CONVERSATION],
  CONVERSIONS: ['purchase', 'offsite_conversion.fb_pixel_purchase', 'lead', 'offsite_conversion.fb_pixel_lead'],
  POST_ENGAGEMENT: ['post_engagement'],
  PAGE_LIKES: ['like'],
  VIDEO_VIEWS: ['video_view'],
  OUTCOME_APP_PROMOTION: ['mobile_app_install', 'app_install'],
  APP_INSTALLS: ['mobile_app_install', 'app_install'],
}
const BY_REACH = new Set(['OUTCOME_AWARENESS', 'REACH', 'BRAND_AWARENESS'])

function resultOf(row: InsightRow, metrics: Metrics, objective: string | undefined): Result | undefined {
  const stat = row.results?.[0]
  const value = num(stat?.values?.[0]?.value)
  if (stat?.indicator && value !== undefined) {
    const cost = num(row.cost_per_result?.[0]?.values?.[0]?.value)
    return { type: stat.indicator.replace(/^actions:/, ''), value, cost: cost ?? (value ? metrics.spend / value : undefined) }
  }
  if (objective && BY_REACH.has(objective) && metrics.reach) return { type: 'reach', value: metrics.reach, cost: metrics.spend / metrics.reach }
  for (const type of objective ? (BY_OBJECTIVE[objective] ?? []) : []) {
    const v = metrics.actions?.[type]
    if (v) return { type, value: v, cost: metrics.spend / v }
  }
  return undefined
}

const BASE_FIELDS = 'spend,impressions,reach,frequency,clicks,inline_link_clicks,actions'
const RESULT_FIELDS = 'results,cost_per_result'

/** Insights da conta; tenta com `results` (resultado como no Gerenciador) e, se a Meta recusar o campo, sem ele. */
async function insights(token: string, act: string, params: Params, missing: Set<string>, withResults = false): Promise<InsightRow[]> {
  const read = (fields: string) => all<InsightRow>(`act_${act}/insights`, token, { limit: 500, ...params, fields }, 5000)
  const fields = String(params.fields ?? BASE_FIELDS)
  if (!withResults || missing.has('results')) return read(fields)
  try {
    return await read(`${fields},${RESULT_FIELDS}`)
  } catch (error) {
    if (!(error instanceof HttpError) || error.code !== 'field') throw error
    missing.add('results')
    return read(fields)
  }
}

interface CampaignRow {
  id: string
  name: string
  objective?: string
  status?: string
  effective_status?: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
}

// Moedas sem centavos na Meta (o orçamento vem no valor cheio)
const NO_CENTS = new Set(['CLP', 'COP', 'CRC', 'HUF', 'ISK', 'IDR', 'JPY', 'KRW', 'PYG', 'TWD', 'VND'])

async function report(ctx: Ctx, account: AccountRow, token: string, preset: Preset) {
  const act = account.ad_account_id
  const missing = new Set<string>()
  const optional = async <T>(what: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run()
    } catch (error) {
      if (error instanceof HttpError && (error.code === 'token' || error.code === 'rate')) throw error
      console.warn(`[meta-ads] ${what}`, error)
      missing.add(what)
      return fallback
    }
  }

  const info = await graph<AdAccount & { disable_reason?: number }>(`act_${act}`, token, { fields: `${ACCOUNT_FIELDS},disable_reason` })
  const currency = info.currency || account.currency || 'BRL'
  const base: Params = { date_preset: preset }

  const [totalsRows, dayRows, campaignRows, campaignList] = await Promise.all([
    insights(token, act, { ...base, level: 'account' }, missing),
    insights(token, act, { ...base, level: 'account', time_increment: 1, fields: 'spend,impressions,reach,clicks,inline_link_clicks,actions' }, missing),
    insights(token, act, { ...base, level: 'campaign', fields: `campaign_id,campaign_name,objective,${BASE_FIELDS}` }, missing, true),
    optional('campanhas', () => all<CampaignRow>(`act_${act}/campaigns`, token, { fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time', limit: 200 }, 500), [] as CampaignRow[]),
  ])

  const [platformRows, ageRows, regionRows, adRows] = await Promise.all([
    optional('plataformas', () => insights(token, act, { ...base, level: 'account', breakdowns: 'publisher_platform', fields: 'spend,impressions,reach,clicks,inline_link_clicks,actions' }, missing), [] as InsightRow[]),
    optional('público', () => insights(token, act, { ...base, level: 'account', breakdowns: 'age,gender', fields: 'spend,impressions,clicks,inline_link_clicks,actions' }, missing), [] as InsightRow[]),
    optional('regiões', () => insights(token, act, { ...base, level: 'account', breakdowns: 'region', fields: 'spend,impressions,clicks,inline_link_clicks,actions' }, missing), [] as InsightRow[]),
    optional('anúncios', () => insights(token, act, { ...base, level: 'ad', fields: `ad_id,ad_name,campaign_id,campaign_name,objective,${BASE_FIELDS}` }, missing, true), [] as InsightRow[]),
  ])

  const totalsRow = totalsRows[0]
  const totals = metricsOf(totalsRow, true)

  const days = dayRows
    .filter((r) => r.date_start)
    .map((r) => {
      const m = metricsOf(r)
      return { day: r.date_start!, spend: m.spend, impressions: m.impressions, reach: m.reach ?? 0, linkClicks: m.linkClicks, contacts: m.leads + m.conversations }
    })
    .sort((a, b) => a.day.localeCompare(b.day))

  // Campanhas: as que gastaram no período e as ativas mesmo sem gasto
  const offset = NO_CENTS.has(currency) ? 1 : 100
  const listed = new Map(campaignList.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const campaigns = campaignRows
    .filter((r) => r.campaign_id)
    .map((r) => {
      seen.add(r.campaign_id!)
      const meta = listed.get(r.campaign_id!)
      const metrics = metricsOf(r, true)
      return {
        id: r.campaign_id!,
        name: r.campaign_name || meta?.name || r.campaign_id!,
        objective: r.objective || meta?.objective,
        status: meta?.effective_status || meta?.status,
        dailyBudget: num(meta?.daily_budget) !== undefined ? num(meta?.daily_budget)! / offset : undefined,
        lifetimeBudget: num(meta?.lifetime_budget) !== undefined ? num(meta?.lifetime_budget)! / offset : undefined,
        start: meta?.start_time,
        stop: meta?.stop_time,
        metrics,
        result: resultOf(r, metrics, r.objective || meta?.objective),
      }
    })
  for (const c of campaignList) {
    if (seen.has(c.id) || c.effective_status !== 'ACTIVE') continue
    campaigns.push({
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.effective_status,
      dailyBudget: num(c.daily_budget) !== undefined ? num(c.daily_budget)! / offset : undefined,
      lifetimeBudget: num(c.lifetime_budget) !== undefined ? num(c.lifetime_budget)! / offset : undefined,
      start: c.start_time,
      stop: c.stop_time,
      metrics: { ...EMPTY, actions: {} },
      result: undefined,
    })
  }
  campaigns.sort((a, b) => b.metrics.spend - a.metrics.spend || a.name.localeCompare(b.name))

  const platforms = platformRows
    .filter((r) => r.publisher_platform)
    .map((r) => ({ key: r.publisher_platform!, metrics: metricsOf(r) }))
    .sort((a, b) => b.metrics.spend - a.metrics.spend)

  // Idade e gênero vêm cruzados: soma por idade e por gênero (o alcance não soma, fica de fora)
  const group = (rows: InsightRow[], key: (r: InsightRow) => string | undefined) => {
    const map = new Map<string, Metrics>()
    for (const r of rows) {
      const k = key(r)
      if (!k) continue
      map.set(k, add(map.get(k) ?? EMPTY, metricsOf(r)))
    }
    return [...map.entries()].map(([k, metrics]) => ({ key: k, metrics }))
  }
  const ages = group(ageRows, (r) => r.age).sort((a, b) => a.key.localeCompare(b.key))
  const genders = group(ageRows, (r) => r.gender).sort((a, b) => b.metrics.spend - a.metrics.spend)
  const regions = group(regionRows, (r) => r.region)
    .sort((a, b) => b.metrics.spend - a.metrics.spend)
    .slice(0, 12)

  // Os anúncios que mais gastaram, com a miniatura do criativo
  const topAds = adRows
    .filter((r) => r.ad_id && (num(r.spend) ?? 0) > 0)
    .sort((a, b) => (num(b.spend) ?? 0) - (num(a.spend) ?? 0))
    .slice(0, 12)
  const creatives = topAds.length
    ? await optional(
        'criativos',
        () =>
          graph<Record<string, { creative?: { thumbnail_url?: string; image_url?: string; instagram_permalink_url?: string } }>>('', token, {
            ids: topAds.map((r) => r.ad_id).join(','),
            fields: 'creative{thumbnail_url,image_url,instagram_permalink_url}',
          }),
        {} as Record<string, { creative?: { thumbnail_url?: string; image_url?: string; instagram_permalink_url?: string } }>
      )
    : {}
  const ads = topAds.map((r) => {
    const metrics = metricsOf(r, true)
    const creative = creatives[r.ad_id!]?.creative
    return {
      id: r.ad_id!,
      name: r.ad_name || r.ad_id!,
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      thumbnail: creative?.image_url || creative?.thumbnail_url,
      permalink: creative?.instagram_permalink_url,
      metrics,
      result: resultOf(r, metrics, r.objective),
    }
  })

  const data = {
    preset,
    since: totalsRow?.date_start ?? days[0]?.day ?? null,
    until: totalsRow?.date_stop ?? days[days.length - 1]?.day ?? null,
    currency,
    accountStatus: info.account_status ?? null,
    disableReason: info.disable_reason ?? null,
    totals,
    days,
    campaigns,
    platforms,
    ages,
    genders,
    regions,
    ads,
    missing: [...missing],
  }

  const now = new Date().toISOString()
  const writes = [
    ctx.admin.from('crm_ad_reports').upsert({ account_id: account.id, team_id: account.team_id, preset, data, fetched_at: now }, { onConflict: 'account_id,preset' }),
    ctx.admin
      .from('crm_ad_accounts')
      .update({
        name: info.name || account.name,
        currency,
        timezone_name: info.timezone_name ?? null,
        account_status: info.account_status ?? null,
        business_name: info.business?.name ?? null,
        synced_at: now,
        sync_error: null,
      })
      .eq('id', account.id),
  ]
  for (const { error } of await Promise.all(writes)) if (error) throw dbError(error)
  return { ...data, fetchedAt: now }
}

// ---------- entrada ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: auth } = await user.auth.getUser()
    if (!auth?.user) return json({ error: 'Entre na conta para ver os anúncios da equipe.', code: 'auth' }, 401)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const ctx: Ctx = { user, admin, userId: auth.user.id }

    const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
    const appId = Deno.env.get('META_APP_ID') ?? ''
    const secret = Deno.env.get('META_APP_SECRET') ?? ''
    const configId = Deno.env.get('META_LOGIN_CONFIG_ID') ?? ''
    const app: App | null = appId && secret ? { id: appId, secret } : null
    const needsApp = () => {
      if (!app) throw new HttpError('Falta configurar o app da Meta no Supabase (segredos META_APP_ID e META_APP_SECRET).', 503, 'not_configured')
      return app
    }

    switch (body.action) {
      case 'status':
        return json({ configured: !!app, systemLogin: !!configId, version: VERSION })

      case 'auth_url': {
        const { id, secret: key } = needsApp()
        const teamId = await requireRole(ctx, body.teamId, false)
        const redirectUri = checkRedirect(body.redirectUri)
        const state = await packState({ t: teamId, u: ctx.userId, r: redirectUri, e: Date.now() + 15 * 60_000, n: crypto.randomUUID() }, key)
        const dialog = new URL(`https://www.facebook.com/${VERSION}/dialog/oauth`)
        const params = new URLSearchParams({ client_id: id, redirect_uri: redirectUri, response_type: 'code', state })
        // Com a configuração do login para empresas, o acesso é de usuário do sistema e não expira
        if (configId) params.set('config_id', configId)
        else params.set('scope', SCOPES.join(','))
        dialog.search = params.toString()
        return json({ url: dialog.toString() })
      }

      case 'connect': {
        const known = needsApp()
        const state = await unpackState(body.state, known.secret)
        if (state.u !== ctx.userId) throw new HttpError('O login no Facebook foi começado por outra pessoa. Conecte de novo.', 403, 'state')
        if (checkRedirect(body.redirectUri) !== state.r) throw new HttpError('Endereço de volta diferente do pedido.', 400, 'state')
        const teamId = await requireRole(ctx, state.t, false)
        const code = typeof body.code === 'string' ? body.code.replace(/#_=_$/, '') : ''
        if (!code) throw new HttpError('O Facebook não devolveu o código do login.')
        const grant = await lengthen(await describe(await exchangeCode(code, state.r, known), known), known)
        return json(await hold(ctx, teamId, grant))
      }

      case 'connect_token': {
        const teamId = await requireRole(ctx, body.teamId, false)
        const pasted = typeof body.token === 'string' ? body.token.trim() : ''
        if (pasted.length < 20 || /\s/.test(pasted)) throw new HttpError('Cole o token de acesso inteiro.')
        await graph<{ id: string }>('me', pasted, { fields: 'id' })
        const grant = await lengthen(await describe({ token: pasted, kind: null, expiresAt: null }, app), app)
        return json(await hold(ctx, teamId, grant))
      }

      case 'choose':
        return json(await choose(ctx, body))

      case 'report': {
        const account = await accountOf(ctx, body.accountId)
        const preset = (PRESETS as readonly string[]).includes(String(body.preset)) ? (body.preset as Preset) : 'last_30d'
        const token = await tokenOf(ctx, account)
        try {
          return json(await report(ctx, account, token, preset))
        } catch (error) {
          if (error instanceof HttpError && error.code === 'token') await markBroken(ctx, account.id)
          throw error
        }
      }

      case 'disconnect': {
        const account = await accountOf(ctx, body.accountId)
        await requireRole(ctx, account.team_id, true)
        const { error } = await admin.from('crm_ad_accounts').delete().eq('id', account.id)
        if (error) throw dbError(error)
        return json({ ok: true })
      }

      default:
        return json({ error: 'Ação desconhecida.' }, 400)
    }
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message, code: error.code }, error.status)
    console.error('[meta-ads]', error)
    return json({ error: error instanceof Error ? error.message : String(error), code: 'error' }, 500)
  }
})
