import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Os anúncios da equipe pela API de anúncios da Meta (Marketing API,
 * `graph.facebook.com`): conecta uma ou mais contas de anúncios e lê as
 * campanhas de Facebook e Instagram (aba Anúncios de `/crm/instagram`). A
 * leitura não muda nada. A única escrita é "Turbinar post" (2026-11-11, seção
 * `turbinar`): com o login que aceitou `ads_management`, cria campanha, conjunto
 * e anúncio de um post do Instagram da conta, sempre PAUSADOS; só quem gerencia
 * a equipe ativa (`boost_activate`). Nada mais é criado, pausado ou alterado.
 *
 * Conectar: quem tem acesso à conta de anúncios entra com o Facebook (login
 * do Facebook para empresas) ou cola um token, e escolhe só as contas desta
 * equipe; o login fica 30 minutos em `crm_ad_pending` até a escolha. Com uma
 * configuração de login de "token de usuário do sistema" (`META_LOGIN_CONFIG_ID`)
 * o acesso não expira; sem ela, o token de usuário vale 60 dias.
 *
 * O token fica só aqui no servidor (`crm_ad_tokens`, sem acesso do
 * navegador). Cada relatório é gravado em `crm_ad_reports` com os números da
 * conta e de cada campanha (por dia, plataforma, público e região), para a
 * tela filtrar campanhas sem nova leitura. `preview` devolve o quadro de
 * prévia nativo da Meta de um anúncio desta conta.
 * Conectar e ler é de quem é da equipe; desconectar, do gestor.
 *
 * Segredos (Supabase › Edge Functions › Secrets): `META_APP_ID` e
 * `META_APP_SECRET` (app da Meta › Configurações do app › Informação básica)
 * e, se houver, `META_LOGIN_CONFIG_ID`. Sem eles, ainda dá para colar um token.
 */

const VERSION = 'v26.0'
const GRAPH = `https://graph.facebook.com/${VERSION}`
const SCOPES = ['ads_read']
/**
 * Turbinar post: criar anúncios (`ads_management`), anunciar com a Página ligada ao Instagram
 * (`pages_manage_ads`, `pages_show_list`, `pages_read_engagement`) e listar os posts do perfil
 * (`instagram_basic`). Sem `business_management`: serve a conta de anúncios pessoal, a mesma que o
 * perfil usa quando turbina pelo app, sem Gerenciador de Negócios.
 */
const BOOST_SCOPES = ['ads_read', 'ads_management', 'pages_show_list', 'pages_read_engagement', 'pages_manage_ads', 'instagram_basic']
const CALLBACK_PATH = '/anuncios/retorno'
const PRESETS = ['today', 'last_7d', 'last_30d', 'last_90d', 'this_month'] as const
/** Um dia escolhido no calendário da tela: `dia:2026-10-30` (no fuso da conta de anúncios) */
type DayPreset = `dia:${string}`
type Preset = (typeof PRESETS)[number] | DayPreset
const DAY_PRESET = /^dia:(\d{4}-\d{2}-\d{2})$/
function presetOf(value: unknown): Preset {
  const text = String(value)
  if ((PRESETS as readonly string[]).includes(text)) return text as Preset
  const day = DAY_PRESET.exec(text)?.[1]
  // A Meta guarda 37 meses; um dia que não existe (2026-02-31) ou futuro cai no padrão
  if (day && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day && Date.parse(day) <= Date.now() + 2 * DAY && Date.parse(day) >= Date.now() - 37 * 31 * DAY)
    return `dia:${day}`
  return 'last_30d'
}
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
function metaError(error: MetaError | undefined, status: number, writing = false): HttpError {
  const code = error?.code
  const sub = error?.error_subcode
  if (code === 190) return new HttpError('A conexão com a conta de anúncios expirou ou foi revogada. Conecte de novo.', 401, 'token')
  if (code === 4 || code === 17 || code === 32 || code === 613 || (code !== undefined && code >= 80000 && code <= 80014) || sub === 2446079)
    return new HttpError('A Meta pediu uma pausa (muitas leituras seguidas desta conta de anúncios). Tente de novo em alguns minutos.', 429, 'rate')
  if (code === 100 && sub === 33) return new HttpError('Esse acesso não enxerga a conta de anúncios (ela saiu do acesso de quem conectou?). Conecte de novo.', 403, 'token')
  if (code === 10 || code === 200 || code === 294 || (code !== undefined && code > 200 && code < 300))
    return writing
      ? new HttpError(`A Meta não deixou criar o anúncio com esse acesso${error?.error_user_msg || error?.message ? `: ${error.error_user_msg || error.message}` : ''}. Entre com o Facebook pelo "Turbinar post" e aceite todas as permissões.`, 403, 'boost_login')
      : new HttpError(`Falta permissão para ler os anúncios (ads_read)${error?.message ? `: ${error.message}` : ''}.`, 403, 'permission')
  // Recusa de criação (orçamento, público, post que não pode ser turbinado…): a frase da Meta para quem usa
  if (writing && error?.error_user_msg) return new HttpError(error.error_user_msg, 400, 'meta')
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

/** Uma escrita na API da Meta (POST com formulário; objetos e listas vão como JSON). */
async function graphPost<T>(path: string, token: string, params: Params | Record<string, unknown>, method: 'POST' | 'DELETE' = 'POST'): Promise<T> {
  const form = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    form.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
  }
  form.set('access_token', token)
  const response = await fetch(`${GRAPH}/${path.replace(/^\/+/, '')}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })
  const data = (await response.json().catch(() => null)) as ({ error?: MetaError } & T) | null
  if (!response.ok || !data || data.error) throw metaError(data?.error, response.status, true)
  return data as T
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
  /** `boost`: o login pediu as permissões de turbinar */
  m?: 'boost'
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

/** Anúncios fazem parte do módulo Instagram: precisa estar ligado na conta. */
async function requireModule(ctx: Ctx, teamId: string) {
  const { data, error } = await ctx.user.rpc('crm_module_on', { p_team: teamId, p_module: 'instagram' })
  // Sem a migração das contas a função não existe: nada é restrito
  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') return
    throw dbError(error)
  }
  if (data === false) throw new HttpError('O módulo Instagram e Anúncios está desligado para esta conta.', 403, 'module_off')
}

async function requireRole(ctx: Ctx, teamId: unknown, manager: boolean) {
  const team = uuid(teamId, 'Equipe')
  const { data, error } = await ctx.user.rpc(manager ? 'is_crm_manager' : 'is_crm_member', { p_team: team })
  if (error) throw dbError(error)
  if (!data) throw new HttpError(manager ? 'Só quem gerencia a equipe desconecta uma conta de anúncios.' : 'Você não é desta equipe.', 403, 'forbidden')
  await requireModule(ctx, team)
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
  const scopes = await grantedScopes(grant.token).catch(() => null)
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
    .insert({ team_id: teamId, user_id: ctx.userId, access_token: grant.token, token_kind: grant.kind, token_expires_at: grant.expiresAt, connected_name: me.name ?? null, accounts, scopes })
    .select('id')
    .single()
  if (error) throw dbError(error)
  return { pendingId: (data as { id: string }).id, accounts, who: me.name ?? null, kind: grant.kind, expiresAt: grant.expiresAt, canBoost: !!scopes && BOOST_NEEDS.every((p) => scopes.includes(p)) }
}

async function choose(ctx: Ctx, body: Record<string, unknown>) {
  const pendingId = uuid(body.pendingId, 'Conexão')
  const ids = Array.isArray(body.accountIds) ? body.accountIds.map(adAccountId) : []
  if (!ids.length) throw new HttpError('Escolha ao menos uma conta de anúncios.')
  if (ids.length > 50) throw new HttpError('Escolha no máximo 50 contas de uma vez.')
  const { data, error } = await ctx.admin.from('crm_ad_pending').select('*').eq('id', pendingId).eq('user_id', ctx.userId).maybeSingle()
  if (error) throw dbError(error)
  const pending = data as { team_id: string; access_token: string; token_kind: string | null; token_expires_at: string | null; connected_name: string | null; accounts: PendingAccount[]; scopes: string[] | null; valid_until: string } | null
  if (!pending || Date.parse(pending.valid_until) < Date.now()) throw new HttpError('Essa conexão expirou (30 minutos). Entre com o Facebook de novo.', 410, 'expired')
  const teamId = await requireRole(ctx, pending.team_id, false)
  const saved = await saveAccounts(ctx, teamId, pending, ids, ctx.userId)
  await ctx.admin.from('crm_ad_pending').delete().eq('id', pendingId)
  return { accounts: saved }
}

interface PendingRow {
  access_token: string
  token_kind: string | null
  token_expires_at: string | null
  connected_name: string | null
  accounts: PendingAccount[]
  scopes: string[] | null
}

/** Liga à equipe as contas escolhidas de um login, com o token dele. */
async function saveAccounts(ctx: Ctx, teamId: string, pending: PendingRow, ids: string[], connectedBy: string | null) {
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
        connected_by: connectedBy,
        connected_name: pending.connected_name,
        connected_at: now,
        token_kind: pending.token_kind,
        token_expires_at: pending.token_expires_at,
        scopes: pending.scopes,
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
  return saved
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
  adset_name?: string
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
  actions: Record<string, number>
}

const LEAD_TYPES = ['onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']
const CONVERSATION = 'onsite_conversion.messaging_conversation_started_7d'

// Ações guardadas nos números por dia e nos cortes (plataforma, público, região); o total e as campanhas guardam todas
const KEPT = new Set([
  'lead',
  ...LEAD_TYPES,
  CONVERSATION,
  'onsite_conversion.messaging_first_reply',
  'link_click',
  'landing_page_view',
  'post_engagement',
  'page_engagement',
  'post_reaction',
  'comment',
  'onsite_conversion.post_save',
  'video_view',
  'like',
  'purchase',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'complete_registration',
  'offsite_conversion.fb_pixel_complete_registration',
  'contact',
  'offsite_conversion.fb_pixel_contact',
  'schedule',
])

function metricsOf(row: InsightRow | undefined): Metrics {
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
    actions,
  }
}

/** Só as ações que a tela usa, para os números por dia e os cortes não pesarem. */
const lean = (m: Metrics): Metrics => ({ ...m, actions: Object.fromEntries(Object.entries(m.actions).filter(([type]) => KEPT.has(type))) })

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
    const v = metrics.actions[type]
    if (v) return { type, value: v, cost: metrics.spend / v }
  }
  return undefined
}

/** O resultado de um pedaço (um dia) da campanha, pelo tipo de resultado que ela tem no período. */
const resultIn = (m: Metrics, type: string | undefined) => (!type ? undefined : type === 'reach' ? m.reach : m.actions[type])

const BASE_FIELDS = 'spend,impressions,reach,frequency,clicks,inline_link_clicks,actions'
const CUT_FIELDS = 'campaign_id,spend,impressions,clicks,inline_link_clicks,actions'
const RESULT_FIELDS = 'results,cost_per_result'

/** Insights da conta; tenta com `results` (resultado como no Gerenciador) e, se a Meta recusar o campo, sem ele. */
async function insights(token: string, act: string, params: Params, missing: Set<string>, withResults = false): Promise<InsightRow[]> {
  // A mesma atribuição do Gerenciador de Anúncios (a de cada conjunto), para os números baterem com ele
  // e o total, os dias e os leads usarem a mesma janela (2026-11-09)
  const read = (fields: string) => all<InsightRow>(`act_${act}/insights`, token, { limit: 500, use_unified_attribution_setting: 'true', ...params, fields }, 5000)
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

interface CreativeInfo {
  preview_shareable_link?: string
  creative?: { thumbnail_url?: string; image_url?: string; instagram_permalink_url?: string }
}

/** Miniatura e links de cada anúncio; se a Meta recusar um campo, pede menos. */
async function creativesOf(token: string, ids: string[]): Promise<Record<string, CreativeInfo>> {
  const tries = [
    'preview_shareable_link,creative{thumbnail_url,image_url,instagram_permalink_url}',
    'creative{thumbnail_url,image_url,instagram_permalink_url}',
    'creative{thumbnail_url,image_url}',
    'creative{thumbnail_url}',
  ]
  let failure: unknown
  for (const fields of tries) {
    try {
      return await graph<Record<string, CreativeInfo>>('', token, { ids: ids.join(','), fields })
    } catch (error) {
      if (error instanceof HttpError && (error.code === 'token' || error.code === 'rate')) throw error
      console.warn('[meta-ads] criativos', fields, error)
      failure = error
    }
  }
  throw failure
}

// Moedas sem centavos na Meta (o orçamento vem no valor cheio)
const NO_CENTS = new Set(['CLP', 'COP', 'CRC', 'HUF', 'ISK', 'IDR', 'JPY', 'KRW', 'PYG', 'TWD', 'VND'])

/** Formato dos relatórios: a tela relê os guardados num formato antigo. */
const REPORT_VERSION = 2

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
  const day = DAY_PRESET.exec(preset)?.[1]
  const base: Params = day ? { time_range: JSON.stringify({ since: day, until: day }) } : { date_preset: preset }

  // A conta inteira (o alcance não soma entre campanhas) e cada campanha, no total e por dia
  const [totalsRows, dayRows, campaignRows, campaignList, campaignDayRows] = await Promise.all([
    insights(token, act, { ...base, level: 'account' }, missing),
    insights(token, act, { ...base, level: 'account', time_increment: 1 }, missing),
    insights(token, act, { ...base, level: 'campaign', fields: `campaign_id,campaign_name,objective,${BASE_FIELDS}` }, missing, true),
    optional('campanhas', () => all<CampaignRow>(`act_${act}/campaigns`, token, { fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time', limit: 200 }, 500), [] as CampaignRow[]),
    optional('dias por campanha', () => insights(token, act, { ...base, level: 'campaign', time_increment: 1, fields: `campaign_id,${BASE_FIELDS}` }, missing, true), [] as InsightRow[]),
  ])

  // Os cortes vêm por campanha, para o filtro de campanhas da tela somar só as escolhidas
  const [platformRows, ageRows, regionRows, adRows] = await Promise.all([
    optional('plataformas', () => insights(token, act, { ...base, level: 'campaign', breakdowns: 'publisher_platform', fields: CUT_FIELDS }, missing), [] as InsightRow[]),
    optional('público', () => insights(token, act, { ...base, level: 'campaign', breakdowns: 'age,gender', fields: CUT_FIELDS }, missing), [] as InsightRow[]),
    optional('regiões', () => insights(token, act, { ...base, level: 'campaign', breakdowns: 'region', fields: CUT_FIELDS }, missing), [] as InsightRow[]),
    optional('anúncios', () => insights(token, act, { ...base, level: 'ad', fields: `ad_id,ad_name,adset_name,campaign_id,campaign_name,objective,${BASE_FIELDS}` }, missing, true), [] as InsightRow[]),
  ])

  const totalsRow = totalsRows[0]
  const totals = metricsOf(totalsRow)

  const days = dayRows
    .filter((r) => r.date_start)
    .map((r) => ({ day: r.date_start!, metrics: lean(metricsOf(r)) }))
    .sort((a, b) => a.day.localeCompare(b.day))

  // Campanhas: as que gastaram no período e as ativas mesmo sem gasto
  const offset = NO_CENTS.has(currency) ? 1 : 100
  const budget = (value: string | undefined) => (num(value) !== undefined ? num(value)! / offset : undefined)
  const listed = new Map(campaignList.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const campaigns = campaignRows
    .filter((r) => r.campaign_id)
    .map((r) => {
      seen.add(r.campaign_id!)
      const meta = listed.get(r.campaign_id!)
      const metrics = metricsOf(r)
      return {
        id: r.campaign_id!,
        name: r.campaign_name || meta?.name || r.campaign_id!,
        objective: r.objective || meta?.objective,
        status: meta?.effective_status || meta?.status,
        dailyBudget: budget(meta?.daily_budget),
        lifetimeBudget: budget(meta?.lifetime_budget),
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
      dailyBudget: budget(c.daily_budget),
      lifetimeBudget: budget(c.lifetime_budget),
      start: c.start_time,
      stop: c.stop_time,
      metrics: metricsOf(undefined),
      result: undefined,
    })
  }
  campaigns.sort((a, b) => b.metrics.spend - a.metrics.spend || a.name.localeCompare(b.name))

  const resultType = new Map(campaigns.map((c) => [c.id, c.result?.type]))
  const campaignDays = campaignDayRows
    .filter((r) => r.campaign_id && r.date_start)
    .map((r) => {
      const metrics = metricsOf(r)
      // O resultado do dia sai do mesmo `results` da campanha (os dias somam o total); sem ele, pelas ações
      const type = resultType.get(r.campaign_id!)
      const stat = r.results?.[0]
      const own = stat?.indicator && stat.indicator.replace(/^actions:/, '') === type ? num(stat.values?.[0]?.value) : undefined
      return { campaignId: r.campaign_id!, day: r.date_start!, metrics: lean(metrics), result: own ?? resultIn(metrics, type) }
    })

  const cut = (rows: InsightRow[], key: (r: InsightRow) => string | undefined) =>
    rows.filter((r) => r.campaign_id && key(r)).map((r) => ({ campaignId: r.campaign_id!, key: key(r)!, metrics: lean(metricsOf(r)) }))
  const platforms = cut(platformRows, (r) => r.publisher_platform)
  const audience = ageRows.filter((r) => r.campaign_id).map((r) => ({ campaignId: r.campaign_id!, age: r.age ?? 'Unknown', gender: r.gender ?? 'unknown', metrics: lean(metricsOf(r)) }))
  const regions = cut(regionRows, (r) => r.region)

  // Os anúncios que mais gastaram, com a miniatura e os atalhos do criativo
  const topAds = adRows
    .filter((r) => r.ad_id && (num(r.spend) ?? 0) > 0)
    .sort((a, b) => (num(b.spend) ?? 0) - (num(a.spend) ?? 0))
    .slice(0, 40)
  const creatives = topAds.length ? await optional('criativos', () => creativesOf(token, topAds.map((r) => r.ad_id!)), {} as Record<string, CreativeInfo>) : {}
  const ads = topAds.map((r) => {
    const metrics = metricsOf(r)
    const found = creatives[r.ad_id!]
    return {
      id: r.ad_id!,
      name: r.ad_name || r.ad_id!,
      adsetName: r.adset_name,
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      thumbnail: found?.creative?.image_url || found?.creative?.thumbnail_url,
      permalink: found?.creative?.instagram_permalink_url,
      previewLink: found?.preview_shareable_link,
      metrics: lean(metrics),
      result: resultOf(r, metrics, r.objective),
    }
  })

  const data = {
    version: REPORT_VERSION,
    preset,
    since: totalsRow?.date_start ?? days[0]?.day ?? null,
    until: totalsRow?.date_stop ?? days[days.length - 1]?.day ?? null,
    currency,
    accountStatus: info.account_status ?? null,
    disableReason: info.disable_reason ?? null,
    totals,
    days,
    campaigns,
    campaignDays,
    platforms,
    audience,
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
        synced_at: now,
        sync_error: null,
      })
      .eq('id', account.id),
  ]
  for (const { error } of await Promise.all(writes)) if (error) throw dbError(error)
  return { ...data, fetchedAt: now }
}

// ---------- prévia do anúncio ----------

/** Os formatos de prévia que a tela oferece (`ad_format` da Meta). */
const PREVIEW_FORMATS = new Set(['INSTAGRAM_STANDARD', 'INSTAGRAM_STORY', 'INSTAGRAM_REELS', 'MOBILE_FEED_STANDARD', 'FACEBOOK_STORY_MOBILE', 'FACEBOOK_REELS_MOBILE'])

const attribute = (html: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(html)?.[1]?.replace(/&amp;/g, '&')

/** A prévia nativa da Meta (o mesmo quadro do Gerenciador), só de anúncio desta conta. */
async function preview(account: AccountRow, token: string, body: Record<string, unknown>) {
  const adId = typeof body.adId === 'string' && /^\d{1,40}$/.test(body.adId) ? body.adId : ''
  if (!adId) throw new HttpError('Anúncio inválido.')
  const format = typeof body.format === 'string' && PREVIEW_FORMATS.has(body.format) ? body.format : 'INSTAGRAM_STANDARD'
  const ad = await graph<{ account_id?: string }>(adId, token, { fields: 'account_id' })
  if (ad.account_id !== account.ad_account_id) throw new HttpError('Esse anúncio não é desta conta de anúncios.', 403, 'forbidden')
  const { data } = await graph<{ data?: { body?: string }[] }>(`${adId}/previews`, token, { ad_format: format })
  const html = data?.[0]?.body ?? ''
  const src = attribute(html, 'src')
  if (!src || !/^https:\/\/([a-z0-9-]+\.)*facebook\.com\//.test(src)) throw new HttpError('A Meta não gerou a prévia nesse formato.', 404, 'no_preview')
  return { src, width: num(attribute(html, 'width')) ?? null, height: num(attribute(html, 'height')) ?? null }
}

// ---------- turbinar ----------

/** O mínimo para turbinar: criar anúncios, anunciar com a Página e ver os posts do Instagram dela. */
const BOOST_NEEDS = ['ads_management', 'pages_manage_ads', 'pages_show_list', 'instagram_basic']

async function grantedScopes(token: string): Promise<string[]> {
  const { data } = await graph<{ data?: { permission: string; status: string }[] }>('me/permissions', token)
  return (data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission)
}

interface BoostPage {
  id: string
  name: string
  ig?: { id: string; username: string; picture?: string }
}

interface PageRow {
  id: string
  name?: string
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string }
}

const PAGE_FIELDS = 'id,name,instagram_business_account{id,username,profile_picture_url}'

/** As Páginas com que esta conta de anúncios pode anunciar (e o Instagram ligado a cada uma). */
async function boostPages(act: string, token: string): Promise<BoostPage[]> {
  const shape = (rows: PageRow[]) =>
    rows.map((p) => ({
      id: p.id,
      name: p.name || `Página ${p.id}`,
      ig: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username ?? '', picture: p.instagram_business_account.profile_picture_url } : undefined,
    }))
  const seen = new Map<string, BoostPage>()
  // `promote_pages`: as Páginas da conta de anúncios; `me/accounts`: as que quem entrou administra (conta pessoal sem Página ligada à conta)
  for (const read of [() => all<PageRow>(`act_${act}/promote_pages`, token, { fields: PAGE_FIELDS, limit: 100 }, 300), () => all<PageRow>('me/accounts', token, { fields: PAGE_FIELDS, limit: 100 }, 300)]) {
    try {
      for (const page of shape(await read())) if (!seen.has(page.id) || (!seen.get(page.id)!.ig && page.ig)) seen.set(page.id, page)
    } catch (error) {
      if (error instanceof HttpError && (error.code === 'token' || error.code === 'rate')) throw error
      console.warn('[meta-ads] páginas', error)
    }
  }
  return [...seen.values()]
}

/** O Instagram conectado na aba Perfil desta conta: o turbinar fica preso a ele. */
async function teamInstagram(ctx: Ctx, teamId: string): Promise<string[]> {
  const { data, error } = await ctx.admin.from('crm_instagram_accounts').select('username').eq('team_id', teamId)
  if (error) return []
  return ((data ?? []) as { username: string }[]).map((r) => r.username.toLowerCase()).filter(Boolean)
}

async function boostSetup(ctx: Ctx, account: AccountRow, token: string) {
  const scopes = await grantedScopes(token)
  await ctx.admin.from('crm_ad_accounts').update({ scopes }).eq('id', account.id)
  const missing = BOOST_NEEDS.filter((p) => !scopes.includes(p))
  const own = await teamInstagram(ctx, account.team_id)
  if (missing.length) return { ready: false, missing, pages: [] as BoostPage[], instagram: own }
  const pages = (await boostPages(account.ad_account_id, token)).filter((p) => p.ig && (!own.length || own.includes(p.ig.username.toLowerCase())))
  return { ready: true, missing, pages, instagram: own }
}

/** A Página e o Instagram escolhidos, conferidos de novo na Meta (e presos ao Instagram desta conta). */
async function boostTarget(ctx: Ctx, account: AccountRow, token: string, pageId: unknown, igUserId: unknown) {
  const page = typeof pageId === 'string' && /^\d{1,40}$/.test(pageId) ? pageId : ''
  const ig = typeof igUserId === 'string' && /^\d{1,40}$/.test(igUserId) ? igUserId : ''
  if (!page || !ig) throw new HttpError('Escolha o perfil do Instagram.')
  const setup = await boostSetup(ctx, account, token)
  if (!setup.ready) throw new HttpError('Falta entrar com o Facebook com as permissões de turbinar.', 403, 'boost_login')
  const found = setup.pages.find((p) => p.id === page && p.ig?.id === ig)
  if (!found?.ig) throw new HttpError('Esse perfil não está ligado a uma Página que esta conta de anúncios usa, ou não é o Instagram desta conta.', 403, 'forbidden')
  return found as BoostPage & { ig: NonNullable<BoostPage['ig']> }
}

interface MediaRow {
  id: string
  caption?: string
  media_type?: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  boost_eligibility_info?: { eligible_to_boost?: boolean; eligible?: boolean }
}

const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp'

async function boostMedia(ctx: Ctx, account: AccountRow, token: string, body: Record<string, unknown>) {
  const target = await boostTarget(ctx, account, token, body.pageId, body.igUserId)
  let rows: MediaRow[]
  try {
    rows = (await graph<Paged<MediaRow>>(`${target.ig.id}/media`, token, { fields: `${MEDIA_FIELDS},boost_eligibility_info`, limit: 30 })).data ?? []
  } catch (error) {
    if (!(error instanceof HttpError) || error.code !== 'field') throw error
    rows = (await graph<Paged<MediaRow>>(`${target.ig.id}/media`, token, { fields: MEDIA_FIELDS, limit: 30 })).data ?? []
  }
  return {
    media: rows.map((m) => {
      const eligible = m.boost_eligibility_info?.eligible_to_boost ?? m.boost_eligibility_info?.eligible
      return {
        id: m.id,
        caption: (m.caption ?? '').slice(0, 300),
        type: m.media_product_type === 'REELS' ? 'REELS' : m.media_type ?? 'IMAGE',
        thumbnail: m.thumbnail_url || (m.media_type === 'VIDEO' ? undefined : m.media_url),
        permalink: m.permalink,
        timestamp: m.timestamp,
        eligible: eligible ?? null,
      }
    }),
  }
}

async function boostGeo(token: string, body: Record<string, unknown>) {
  const q = typeof body.q === 'string' ? body.q.trim().slice(0, 60) : ''
  if (q.length < 2) return { places: [] }
  const { data } = await graph<{ data?: { key: string; name: string; type: string; region?: string; country_code?: string }[] }>('search', token, {
    type: 'adgeolocation',
    q,
    location_types: JSON.stringify(['city', 'region']),
    country_code: 'BR',
    limit: 8,
  })
  return { places: (data ?? []).filter((p) => p.type === 'city' || p.type === 'region').map((p) => ({ key: p.key, type: p.type, name: p.type === 'city' && p.region ? `${p.name}, ${p.region}` : p.name })) }
}

type Goal = 'engajamento' | 'alcance' | 'site'
const GOALS: Record<Goal, { objective: string; optimization: string; destination?: string; label: string }> = {
  engajamento: { objective: 'OUTCOME_ENGAGEMENT', optimization: 'POST_ENGAGEMENT', destination: 'ON_POST', label: 'Engajamento' },
  alcance: { objective: 'OUTCOME_AWARENESS', optimization: 'REACH', label: 'Alcance' },
  site: { objective: 'OUTCOME_TRAFFIC', optimization: 'LINK_CLICKS', destination: 'WEBSITE', label: 'Visitas ao site' },
}

/** Limites do turbinar pela plataforma (valor por dia na moeda da conta). */
const BOOST_MIN_DAILY = 6
const BOOST_MAX_DAILY = 1000
const BOOST_MAX_DAYS = 30

interface Place {
  key: string
  type: 'city' | 'region'
  name: string
  radius?: number
}

function boostInput(body: Record<string, unknown>) {
  const goal = (typeof body.goal === 'string' && body.goal in GOALS ? body.goal : '') as Goal | ''
  if (!goal) throw new HttpError('Escolha o objetivo.')
  let link: string | null = null
  if (goal === 'site') {
    try {
      const url = new URL(String(body.link ?? ''))
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
      link = url.toString()
    } catch {
      throw new HttpError('Informe o endereço do site (https://…).')
    }
  }
  const daily = Math.round(Number(body.dailyBudget) * 100) / 100
  if (!Number.isFinite(daily) || daily < BOOST_MIN_DAILY || daily > BOOST_MAX_DAILY) throw new HttpError(`O valor por dia vai de ${BOOST_MIN_DAILY} a ${BOOST_MAX_DAILY}.`)
  const days = Math.round(Number(body.days))
  if (!Number.isFinite(days) || days < 1 || days > BOOST_MAX_DAYS) throw new HttpError(`A duração vai de 1 a ${BOOST_MAX_DAYS} dias.`)
  const ageMin = Math.max(18, Math.min(65, Math.round(Number(body.ageMin) || 18)))
  const ageMax = Math.max(ageMin, Math.min(65, Math.round(Number(body.ageMax) || 65)))
  const genders = body.genders === 'mulheres' ? [2] : body.genders === 'homens' ? [1] : undefined
  const places: Place[] = (Array.isArray(body.places) ? body.places : []).slice(0, 10).map((raw) => {
    const p = raw as Partial<Place>
    if (typeof p.key !== 'string' || !/^\d{1,20}$/.test(p.key) || (p.type !== 'city' && p.type !== 'region')) throw new HttpError('Local inválido.')
    const radius = p.type === 'city' ? Math.max(10, Math.min(80, Math.round(Number(p.radius) || 17))) : undefined
    return { key: p.key, type: p.type, name: String(p.name ?? '').slice(0, 80), radius }
  })
  const mediaId = typeof body.mediaId === 'string' && /^\d{1,40}$/.test(body.mediaId) ? body.mediaId : ''
  if (!mediaId) throw new HttpError('Escolha o post.')
  return { goal, link, daily, days, ageMin, ageMax, genders, places, mediaId }
}

async function boostCreate(ctx: Ctx, account: AccountRow, token: string, body: Record<string, unknown>) {
  const input = boostInput(body)
  const target = await boostTarget(ctx, account, token, body.pageId, body.igUserId)
  const act = `act_${account.ad_account_id}`
  const goal = GOALS[input.goal]

  // O post precisa ser deste perfil
  const media = await graph<MediaRow & { owner?: { id?: string } }>(input.mediaId, token, { fields: `${MEDIA_FIELDS},owner` })
  if (media.owner?.id && media.owner.id !== target.ig.id) throw new HttpError('Esse post não é deste perfil.', 403, 'forbidden')

  const info = await graph<{ currency?: string; account_status?: number }>(act, token, { fields: 'currency,account_status' })
  if (info.account_status && info.account_status !== 1) throw new HttpError('A conta de anúncios não está ativa (pagamento pendente, em análise ou desativada). Resolva no Gerenciador de Anúncios.', 409, 'account')
  const currency = info.currency || account.currency || 'BRL'
  const cents = NO_CENTS.has(currency) ? Math.round(input.daily) : Math.round(input.daily * 100)

  const start = new Date(Date.now() + 10 * 60_000)
  const end = new Date(start.getTime() + input.days * DAY)
  const label = `Turbinar @${target.ig.username} · ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`

  const cities = input.places.filter((p) => p.type === 'city').map((p) => ({ key: p.key, radius: p.radius, distance_unit: 'kilometer' }))
  const regions = input.places.filter((p) => p.type === 'region').map((p) => ({ key: p.key }))
  const targeting = {
    geo_locations: input.places.length ? { ...(cities.length ? { cities } : {}), ...(regions.length ? { regions } : {}) } : { countries: ['BR'] },
    age_min: input.ageMin,
    age_max: input.ageMax,
    ...(input.genders ? { genders: input.genders } : {}),
    publisher_platforms: ['instagram'],
    instagram_positions: ['stream', 'story', 'reels', 'explore'],
    targeting_automation: { advantage_audience: 0 },
  }

  const created: string[] = []
  const undo = async () => {
    for (const id of created.reverse()) await graphPost(id, token, {}, 'DELETE').catch((e) => console.warn('[meta-ads] desfazer', id, e))
  }
  try {
    // Campanha sempre pausada: só quem gerencia a equipe ativa
    const campaignParams: Record<string, unknown> = { name: label, objective: goal.objective, status: 'PAUSED', special_ad_categories: [], is_adset_budget_sharing_enabled: false }
    let campaign: { id: string }
    try {
      campaign = await graphPost<{ id: string }>(`${act}/campaigns`, token, campaignParams)
    } catch (error) {
      if (!(error instanceof HttpError) || !/is_adset_budget_sharing_enabled/i.test(error.message)) throw error
      delete campaignParams.is_adset_budget_sharing_enabled
      campaign = await graphPost<{ id: string }>(`${act}/campaigns`, token, campaignParams)
    }
    created.push(campaign.id)

    const adset = await graphPost<{ id: string }>(`${act}/adsets`, token, {
      name: `${goal.label} · ${input.places.length ? input.places.map((p) => p.name).join(', ').slice(0, 80) : 'Brasil'}`,
      campaign_id: campaign.id,
      daily_budget: cents,
      billing_event: 'IMPRESSIONS',
      optimization_goal: goal.optimization,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      ...(goal.destination ? { destination_type: goal.destination } : {}),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      targeting,
      status: 'ACTIVE',
    })
    created.push(adset.id)

    const creative = await graphPost<{ id: string }>(`${act}/adcreatives`, token, {
      name: label,
      object_id: target.id,
      instagram_user_id: target.ig.id,
      source_instagram_media_id: input.mediaId,
      ...(input.link ? { call_to_action: { type: 'LEARN_MORE', value: { link: input.link } } } : {}),
    })
    created.push(creative.id)

    const ad = await graphPost<{ id: string }>(`${act}/ads`, token, { name: label, adset_id: adset.id, creative: { creative_id: creative.id }, status: 'ACTIVE' })
    created.push(ad.id)

    const { data, error } = await ctx.admin
      .from('crm_ad_boosts')
      .insert({
        team_id: account.team_id,
        account_id: account.id,
        campaign_id: campaign.id,
        adset_id: adset.id,
        creative_id: creative.id,
        ad_id: ad.id,
        page_id: target.id,
        ig_user_id: target.ig.id,
        ig_username: target.ig.username,
        ig_media_id: input.mediaId,
        permalink: media.permalink ?? null,
        thumbnail: media.thumbnail_url || (media.media_type === 'VIDEO' ? null : media.media_url) || null,
        caption: (media.caption ?? '').slice(0, 300) || null,
        goal: input.goal,
        link: input.link,
        daily_budget: input.daily,
        currency,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        audience: { places: input.places, ageMin: input.ageMin, ageMax: input.ageMax, genders: body.genders === 'mulheres' || body.genders === 'homens' ? body.genders : 'todos' },
        status: 'pausado',
        meta_status: 'CAMPAIGN_PAUSED',
        created_by: ctx.userId,
      })
      .select('id')
      .single()
    if (error) throw dbError(error)
    return { id: (data as { id: string }).id, campaignId: campaign.id, adId: ad.id }
  } catch (error) {
    await undo()
    throw error
  }
}

interface BoostRow {
  id: string
  team_id: string
  account_id: string
  campaign_id: string
  ad_id: string
  status: string
  daily_budget: number
  currency: string
  end_at: string
}

async function boostOf(ctx: Ctx, account: AccountRow, boostId: unknown): Promise<BoostRow> {
  const id = uuid(boostId, 'Turbinada')
  const { data, error } = await ctx.admin.from('crm_ad_boosts').select('id, team_id, account_id, campaign_id, ad_id, status, daily_budget, currency, end_at').eq('id', id).eq('account_id', account.id).maybeSingle()
  if (error) throw dbError(error)
  if (!data) throw new HttpError('Esse post turbinado não é desta conta de anúncios.', 404, 'not_found')
  return data as BoostRow
}

/** Liga ou pausa a campanha do post turbinado. Ligar é de quem gerencia e precisa repetir o valor confirmado. */
async function boostSwitch(ctx: Ctx, account: AccountRow, token: string, body: Record<string, unknown>, on: boolean) {
  const boost = await boostOf(ctx, account, body.boostId)
  if (on) {
    await requireRole(ctx, account.team_id, true)
    if (Number(body.confirmDaily) !== Number(boost.daily_budget)) throw new HttpError('Confirme o valor por dia para ativar.', 400, 'confirm')
    if (Date.parse(boost.end_at) <= Date.now()) throw new HttpError('O período desse anúncio já terminou. Turbine de novo.', 409, 'ended')
  }
  await graphPost(boost.campaign_id, token, { status: on ? 'ACTIVE' : 'PAUSED' })
  const patch: Record<string, unknown> = { status: on ? 'ativo' : 'pausado', meta_status: on ? 'ACTIVE' : 'CAMPAIGN_PAUSED' }
  if (on) Object.assign(patch, { activated_by: ctx.userId, activated_at: new Date().toISOString() })
  const { error } = await ctx.admin.from('crm_ad_boosts').update(patch).eq('id', boost.id)
  if (error) throw dbError(error)
  return { ok: true }
}

/** Relê na Meta a situação dos últimos posts turbinados (em análise, recusado, rodando, terminado). */
async function boostRefresh(ctx: Ctx, account: AccountRow, token: string) {
  const { data, error } = await ctx.admin.from('crm_ad_boosts').select('id, ad_id, status, end_at').eq('account_id', account.id).order('created_at', { ascending: false }).limit(20)
  if (error) throw dbError(error)
  const rows = (data ?? []) as { id: string; ad_id: string; status: string; end_at: string }[]
  if (!rows.length) return { ok: true }
  const found = await graph<Record<string, { effective_status?: string; ad_review_feedback?: { global?: Record<string, string> } }>>('', token, {
    ids: rows.map((r) => r.ad_id).join(','),
    fields: 'effective_status,ad_review_feedback',
  }).catch((e) => {
    if (e instanceof HttpError && (e.code === 'token' || e.code === 'rate')) throw e
    console.warn('[meta-ads] situação dos turbinados', e)
    return {} as Record<string, { effective_status?: string; ad_review_feedback?: { global?: Record<string, string> } }>
  })
  const now = new Date().toISOString()
  await Promise.all(
    rows.map((r) => {
      const ad = found[r.ad_id]
      if (!ad) return null
      const feedback = ad.ad_review_feedback?.global ? Object.values(ad.ad_review_feedback.global).join(' ').slice(0, 500) : null
      const ended = Date.parse(r.end_at) <= Date.now() || ad.effective_status === 'DELETED' || ad.effective_status === 'ARCHIVED'
      return ctx.admin
        .from('crm_ad_boosts')
        .update({ meta_status: ad.effective_status ?? null, meta_feedback: feedback, checked_at: now, ...(ended ? { status: 'encerrado' } : {}) })
        .eq('id', r.id)
    })
  )
  return { ok: true }
}

// ---------- link para o cliente ----------

/**
 * Link para o cliente ligar a conta de anúncios dele pelo celular (2026-11-11; o usuário: "podemos ter um
 * link publico pro cliente fazer essa conexao pelo celular dele? pra mandar no wpp e ele só clicar").
 * Alguém da conta cria (`link_create`, 7 dias, uso único); o cliente abre `/conectar/anuncios/<segredo>`
 * sem login, entra com o Facebook pedindo as permissões de ler e turbinar, e volta em `/anuncios/retorno`.
 * Uma conta de anúncios só: liga direto. Várias: ele marca qual (`link_choose`). O segredo só existe no
 * link; aqui fica o hash.
 */
const LINK_DAYS = 7
const sha256 = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))), (b) => b.toString(16).padStart(2, '0')).join('')

interface LinkRow {
  id: string
  team_id: string
  created_by: string | null
  expires_at: string
  used_at: string | null
  revoked_at: string | null
  pending_id: string | null
  account_ids: string[] | null
  connected_name: string | null
}

async function linkOf(admin: SupabaseClient, token: unknown): Promise<{ link: LinkRow; state: 'ok' | 'used' | 'expired' | 'revoked' }> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,80}$/.test(token)) throw new HttpError('Link inválido. Peça um novo a quem enviou.', 404, 'link')
  const { data, error } = await admin
    .from('crm_ad_connect_links')
    .select('id, team_id, created_by, expires_at, used_at, revoked_at, pending_id, account_ids, connected_name')
    .eq('token_hash', await sha256(token))
    .maybeSingle()
  if (error) throw dbError(error)
  if (!data) throw new HttpError('Link inválido. Peça um novo a quem enviou.', 404, 'link')
  const link = data as LinkRow
  const state = link.revoked_at ? 'revoked' : link.used_at ? 'used' : Date.parse(link.expires_at) < Date.now() ? 'expired' : 'ok'
  return { link, state }
}

const LINK_PROBLEM: Record<'used' | 'expired' | 'revoked', string> = {
  used: 'Este link já foi usado. Peça um novo a quem enviou.',
  expired: 'Este link venceu. Peça um novo a quem enviou.',
  revoked: 'Este link foi cancelado. Peça um novo a quem enviou.',
}

/** As ações sem login: quem abriu o link. Tudo é conferido pelo segredo do link. */
async function publicLink(admin: SupabaseClient, body: Record<string, unknown>, app: App | null) {
  const { link, state } = await linkOf(admin, body.token)
  const { data: team } = await admin.from('crm_teams').select('name').eq('id', link.team_id).maybeSingle()
  const teamName = (team as { name?: string } | null)?.name ?? ''
  const ctx: Ctx = { user: admin, admin, userId: link.created_by ?? '' }

  if (body.action === 'link_info') {
    let names: string[] = []
    if (link.account_ids?.length) {
      const { data } = await admin.from('crm_ad_accounts').select('name').in('id', link.account_ids)
      names = ((data ?? []) as { name: string }[]).map((r) => r.name)
    }
    return { team: teamName, state, accounts: names, choosing: !!link.pending_id && !link.account_ids?.length, expiresAt: link.expires_at }
  }

  if (body.action === 'link_choose') {
    // Volta do Facebook com várias contas: o link já está marcado como usado, esperando a escolha
    const pendingId = uuid(body.pendingId, 'Conexão')
    if (link.revoked_at || link.pending_id !== pendingId || link.account_ids?.length) throw new HttpError('Essa escolha não é deste link. Abra o link de novo.', 403, 'state')
    const { data, error } = await admin.from('crm_ad_pending').select('*').eq('id', pendingId).eq('team_id', link.team_id).maybeSingle()
    if (error) throw dbError(error)
    const pending = data as (PendingRow & { valid_until: string }) | null
    if (!pending || Date.parse(pending.valid_until) < Date.now()) {
      await admin.from('crm_ad_connect_links').update({ used_at: null, pending_id: null }).eq('id', link.id)
      throw new HttpError('A escolha demorou mais de 30 minutos. Abra o link de novo e entre com o Facebook outra vez.', 410, 'expired')
    }
    const ids = Array.isArray(body.accountIds) ? body.accountIds.map(adAccountId) : []
    if (!ids.length) throw new HttpError('Escolha ao menos uma conta de anúncios.')
    if (ids.length > 10) throw new HttpError('Escolha no máximo 10 contas.')
    await requireModule(ctx, link.team_id)
    const saved = await saveAccounts(ctx, link.team_id, pending, ids, link.created_by)
    await admin.from('crm_ad_pending').delete().eq('id', pendingId)
    await admin.from('crm_ad_connect_links').update({ pending_id: null, account_ids: saved.map((a) => a.id), connected_name: pending.connected_name, connected_at: new Date().toISOString() }).eq('id', link.id)
    return { team: teamName, accounts: saved.map((a) => a.name) }
  }

  if (state !== 'ok') throw new HttpError(LINK_PROBLEM[state], 410, 'link_' + state)
  if (!app) throw new HttpError('A conexão com a Meta ainda não está configurada. Avise quem mandou o link.', 503, 'not_configured')
  await requireModule(ctx, link.team_id)

  if (body.action === 'link_auth_url') {
    const redirectUri = checkRedirect(body.redirectUri)
    const packed = await packState({ t: link.team_id, u: `link:${link.id}`, r: redirectUri, e: Date.now() + 15 * 60_000, n: crypto.randomUUID(), m: 'boost' }, app.secret)
    const dialog = new URL(`https://www.facebook.com/${VERSION}/dialog/oauth`)
    const params = new URLSearchParams({ client_id: app.id, redirect_uri: redirectUri, response_type: 'code', state: packed })
    const boostConfig = Deno.env.get('META_BOOST_CONFIG_ID') ?? ''
    if (boostConfig) params.set('config_id', boostConfig)
    else {
      params.set('scope', BOOST_SCOPES.join(','))
      params.set('auth_type', 'rerequest')
    }
    dialog.search = params.toString()
    return { url: dialog.toString() }
  }

  // link_connect
  const login = await unpackState(body.state, app.secret)
  if (login.u !== `link:${link.id}` || login.t !== link.team_id) throw new HttpError('Este retorno do Facebook não é deste link. Abra o link de novo.', 403, 'state')
  if (checkRedirect(body.redirectUri) !== login.r) throw new HttpError('Endereço de volta diferente do pedido.', 400, 'state')
  const code = typeof body.code === 'string' ? body.code.replace(/#_=_$/, '') : ''
  if (!code) throw new HttpError('O Facebook não devolveu o código do login.')
  // Marca o link como usado antes de trocar o código: dois toques não ligam duas vezes
  const { data: claimed, error: claimError } = await admin.from('crm_ad_connect_links').update({ used_at: new Date().toISOString() }).eq('id', link.id).is('used_at', null).select('id')
  if (claimError) throw dbError(claimError)
  if (!claimed?.length) throw new HttpError(LINK_PROBLEM.used, 410, 'link_used')
  try {
    const grant = await lengthen(await describe(await exchangeCode(code, login.r, app), app), app)
    const me = await graph<{ name?: string }>('me', grant.token, { fields: 'name' }).catch(() => ({ name: undefined }) as { name?: string })
    const scopes = await grantedScopes(grant.token).catch(() => null)
    const found = await all<AdAccount>('me/adaccounts', grant.token, { fields: ACCOUNT_FIELDS, limit: 200 }, 1000)
    if (!found.length)
      throw new HttpError('Esse Facebook não tem nenhuma conta de anúncios. Turbine um post pelo Instagram uma vez (isso cria a conta) ou entre com o Facebook de quem cuida dos anúncios, e abra o link de novo.', 404, 'no_accounts')
    const accounts: PendingAccount[] = found.map((a) => ({
      id: a.account_id,
      name: a.name || `Conta ${a.account_id}`,
      currency: a.currency || 'BRL',
      timezoneName: a.timezone_name,
      status: a.account_status,
      connected: false,
    }))
    const pending: PendingRow = { access_token: grant.token, token_kind: grant.kind, token_expires_at: grant.expiresAt, connected_name: me.name ?? null, accounts, scopes }
    const canBoost = !!scopes && BOOST_NEEDS.every((p) => scopes.includes(p))
    if (accounts.length === 1) {
      const saved = await saveAccounts(ctx, link.team_id, pending, [accounts[0].id], link.created_by)
      await admin.from('crm_ad_connect_links').update({ account_ids: saved.map((a) => a.id), connected_name: me.name ?? null, connected_at: new Date().toISOString() }).eq('id', link.id)
      return { done: true, team: teamName, accounts: saved.map((a) => a.name), canBoost }
    }
    // Várias contas: guarda o login 30 minutos e o cliente marca a dele
    if (!link.created_by) throw new HttpError('Quem criou este link saiu da conta. Peça um novo.', 410, 'link')
    const { data, error } = await admin
      .from('crm_ad_pending')
      .insert({ team_id: link.team_id, user_id: link.created_by, ...pending })
      .select('id')
      .single()
    if (error) throw dbError(error)
    const pendingId = (data as { id: string }).id
    await admin.from('crm_ad_connect_links').update({ pending_id: pendingId }).eq('id', link.id)
    return { done: false, team: teamName, pendingId, who: me.name ?? null, accounts, canBoost }
  } catch (error) {
    // Não ligou: o link volta a valer para tentar de novo
    await admin.from('crm_ad_connect_links').update({ used_at: null, pending_id: null }).eq('id', link.id)
    throw error
  }
}

const PUBLIC_ACTIONS = new Set(['link_info', 'link_auth_url', 'link_connect', 'link_choose'])

// ---------- entrada ----------

/**
 * Sincronização agendada (2026-11-09; o usuário: "a sinc de dados para funcionar sempre em tempo real e
 * com dados reais"). O pg_cron chama `cron_report` com o cabeçalho `x-cron-secret` (o mesmo segredo dos
 * stories, `STORIES_CRON_SECRET`), uma conta e um período por chamada, e o relatório vai para
 * `crm_ad_reports`, de onde as telas leem sem esperar a Meta. A função continua com verify_jwt: o cron
 * manda a chave pública (anon) no Authorization, e quem decide é o segredo.
 */
async function cronReport(body: Record<string, unknown>) {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const ctx: Ctx = { user: admin, admin, userId: '' }
  const id = uuid(body.accountId, 'Conta')
  const { data, error } = await admin.from('crm_ad_accounts').select('id, team_id, ad_account_id, name, currency').eq('id', id).maybeSingle()
  if (error) throw dbError(error)
  if (!data) throw new HttpError('Conta não encontrada.', 404, 'not_found')
  const account = data as AccountRow
  const preset = presetOf(body.preset)
  const token = await tokenOf(ctx, account)
  try {
    const out = await report(ctx, account, token, preset)
    return { ok: true, account: account.id, preset, fetchedAt: out.fetchedAt }
  } catch (error) {
    if (error instanceof HttpError && error.code === 'token') await markBroken(ctx, account.id)
    throw error
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  if (req.headers.has('x-cron-secret')) {
    const expected = Deno.env.get('STORIES_CRON_SECRET') ?? ''
    const given = req.headers.get('x-cron-secret') ?? ''
    if (!expected || given.length !== expected.length || given !== expected) return json({ error: 'Segredo do cron inválido.', code: 'auth' }, 401)
    try {
      const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
      if (body.action !== 'cron_report') return json({ error: 'Ação desconhecida.' }, 400)
      return json(await cronReport(body))
    } catch (error) {
      console.error('[meta-ads] cron', error)
      if (error instanceof HttpError) return json({ error: error.message, code: error.code }, error.status)
      return json({ error: error instanceof Error ? error.message : String(error), code: 'error' }, 500)
    }
  }

  // O cliente que abriu o link: sem login, conferido pelo segredo do link
  const peek = await req.clone().json().catch(() => ({})) as Record<string, unknown>
  if (typeof peek.action === 'string' && PUBLIC_ACTIONS.has(peek.action)) {
    try {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
      const appId = Deno.env.get('META_APP_ID') ?? ''
      const secret = Deno.env.get('META_APP_SECRET') ?? ''
      return json(await publicLink(admin, peek, appId && secret ? { id: appId, secret } : null))
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message, code: error.code }, error.status)
      console.error('[meta-ads] link', error)
      return json({ error: error instanceof Error ? error.message : String(error), code: 'error' }, 500)
    }
  }

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
        const boost = body.mode === 'boost'
        const state = await packState({ t: teamId, u: ctx.userId, r: redirectUri, e: Date.now() + 15 * 60_000, n: crypto.randomUUID(), ...(boost ? { m: 'boost' as const } : {}) }, key)
        const dialog = new URL(`https://www.facebook.com/${VERSION}/dialog/oauth`)
        const params = new URLSearchParams({ client_id: id, redirect_uri: redirectUri, response_type: 'code', state })
        // Com a configuração do login para empresas, o acesso é de usuário do sistema e não expira.
        // Turbinar usa a configuração própria (`META_BOOST_CONFIG_ID`) ou pede as permissões direto.
        const boostConfig = Deno.env.get('META_BOOST_CONFIG_ID') ?? ''
        if (boost && boostConfig) params.set('config_id', boostConfig)
        else if (boost) {
          params.set('scope', BOOST_SCOPES.join(','))
          // Quem já recusou uma permissão vê a pergunta de novo
          params.set('auth_type', 'rerequest')
        } else if (configId) params.set('config_id', configId)
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
        const preset = presetOf(body.preset)
        const token = await tokenOf(ctx, account)
        try {
          return json(await report(ctx, account, token, preset))
        } catch (error) {
          if (error instanceof HttpError && error.code === 'token') await markBroken(ctx, account.id)
          throw error
        }
      }

      case 'preview': {
        const account = await accountOf(ctx, body.accountId)
        const token = await tokenOf(ctx, account)
        try {
          return json(await preview(account, token, body))
        } catch (error) {
          if (error instanceof HttpError && error.code === 'token') await markBroken(ctx, account.id)
          throw error
        }
      }

      case 'boost_setup':
      case 'boost_media':
      case 'boost_geo':
      case 'boost_create':
      case 'boost_activate':
      case 'boost_pause':
      case 'boost_refresh': {
        const account = await accountOf(ctx, body.accountId)
        await requireRole(ctx, account.team_id, false)
        const token = await tokenOf(ctx, account)
        try {
          if (body.action === 'boost_setup') return json(await boostSetup(ctx, account, token))
          if (body.action === 'boost_media') return json(await boostMedia(ctx, account, token, body))
          if (body.action === 'boost_geo') return json(await boostGeo(token, body))
          if (body.action === 'boost_create') return json(await boostCreate(ctx, account, token, body))
          if (body.action === 'boost_refresh') return json(await boostRefresh(ctx, account, token))
          return json(await boostSwitch(ctx, account, token, body, body.action === 'boost_activate'))
        } catch (error) {
          if (error instanceof HttpError && error.code === 'token') await markBroken(ctx, account.id)
          throw error
        }
      }

      case 'link_create': {
        needsApp()
        const teamId = await requireRole(ctx, body.teamId, false)
        const token = toB64(crypto.getRandomValues(new Uint8Array(32)))
        const expiresAt = new Date(Date.now() + LINK_DAYS * DAY).toISOString()
        const label = typeof body.label === 'string' ? body.label.slice(0, 120) : ''
        const { data, error } = await admin.from('crm_ad_connect_links').insert({ team_id: teamId, token_hash: await sha256(token), label, created_by: ctx.userId, expires_at: expiresAt }).select('id').single()
        if (error) throw dbError(error)
        return json({ id: (data as { id: string }).id, token, expiresAt })
      }

      case 'link_revoke': {
        const linkId = uuid(body.linkId, 'Link')
        const { data: row } = await admin.from('crm_ad_connect_links').select('team_id').eq('id', linkId).maybeSingle()
        if (!row) throw new HttpError('Link não encontrado.', 404)
        await requireRole(ctx, (row as { team_id: string }).team_id, false)
        const { error } = await admin.from('crm_ad_connect_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId).is('used_at', null)
        if (error) throw dbError(error)
        return json({ ok: true })
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
