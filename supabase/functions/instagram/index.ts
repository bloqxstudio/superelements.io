import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * O Instagram da equipe pela API oficial da Meta (Instagram API com login
 * pelo Instagram, `graph.instagram.com`): conecta a conta, lê seguidores,
 * alcance, o desempenho de cada post e o público, publica (foto, carrossel,
 * story, reels) e modera comentários (`/crm/instagram`).
 *
 * O token da conta fica só aqui no servidor (`crm_instagram_tokens`, sem
 * acesso do navegador) e se renova sozinho antes dos 60 dias. A leitura grava
 * nas tabelas do CRM; a tela lê de lá. Conectar e desconectar é do gestor da
 * equipe; ler, publicar e responder, de quem é da equipe.
 *
 * Segredos (Supabase › Edge Functions › Secrets): `INSTAGRAM_APP_ID` e
 * `INSTAGRAM_APP_SECRET`, do app da Meta (Instagram › Configuração da API com
 * login pelo Instagram). Sem eles, ainda dá para colar um token gerado no
 * painel da Meta.
 */

const VERSION = 'v26.0'
const GRAPH = `https://graph.instagram.com/${VERSION}`
const SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights', 'instagram_business_content_publish', 'instagram_business_manage_comments']
const BUCKET = 'space-projects'
const DAY = 86_400

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
  error_user_title?: string
}

/** A recusa da Meta em português, com o código que a tela entende (`token`: conectar de novo). */
function metaError(error: MetaError | undefined, status: number): HttpError {
  const code = error?.code
  const sub = error?.error_subcode
  if (code === 190) return new HttpError('A conexão com o Instagram expirou ou foi revogada. Conecte a conta de novo.', 401, 'token')
  if (code === 4 || code === 17 || code === 32 || code === 613) return new HttpError('O Instagram pediu uma pausa (muitas chamadas seguidas). Tente de novo em alguns minutos.', 429, 'rate')
  if (sub === 2207042) return new HttpError('A conta chegou ao limite de posts publicados pela API nas últimas 24 horas.', 429, 'quota')
  if (sub === 2207009 || code === 36003) return new HttpError('O Instagram não aceita essa proporção no feed: use de 4:5 (vertical) a 1,91:1 (paisagem).', 400, 'ratio')
  if (sub === 2207052 || code === 9004) return new HttpError('O Instagram não conseguiu baixar o arquivo enviado. Tente de novo.', 400, 'fetch')
  if (sub === 2207026) return new HttpError('O vídeo não está num formato que o Instagram aceita (MP4 ou MOV, H.264, até 15 min).', 400, 'video')
  if (sub === 2207027 || code === 9007) return new HttpError('O arquivo ainda está sendo processado pelo Instagram.', 409, 'processing')
  if (code === 10 || (code !== undefined && code >= 200 && code < 300))
    return new HttpError(`Falta uma permissão do app da Meta para isso${error?.message ? ` (${error.message})` : ''}.`, 403, 'permission')
  const text = error?.error_user_msg || error?.message || `O Instagram respondeu com erro ${status}.`
  return new HttpError(text, status >= 400 && status < 600 ? status : 400, 'meta')
}

type Params = Record<string, string | number | boolean | undefined>

/** Uma chamada à API do Instagram. `path` é relativo à versão (`me/media`, `<id>/comments`). */
async function ig<T>(path: string, token: string, init: { method?: 'GET' | 'POST' | 'DELETE'; params?: Params } = {}): Promise<T> {
  const method = init.method ?? 'GET'
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(init.params ?? {})) if (value !== undefined) params.set(key, String(value))
  params.set('access_token', token)
  const url = new URL(`${GRAPH}/${path.replace(/^\/+/, '')}`)
  let body: string | undefined
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method === 'POST') {
    body = params.toString()
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  } else {
    url.search = params.toString()
  }
  const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(30_000) })
  const data = (await response.json().catch(() => null)) as ({ error?: MetaError } & T) | null
  if (!response.ok || data?.error) throw metaError(data?.error, response.status)
  return data as T
}

/** Ids da Meta são só dígitos: nada que vire outro caminho da API. */
const metaId = (value: unknown, what: string) => {
  if (typeof value !== 'string' || !/^\d{1,40}$/.test(value)) throw new HttpError(`Id inválido: ${what}.`)
  return value
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
  if (!body || !mac || !sameText(mac, await sign(body, secret))) throw new HttpError('Este retorno do Instagram não veio desta plataforma. Conecte de novo pela tela do Instagram.', 400, 'state')
  let state: LoginState
  try {
    state = JSON.parse(new TextDecoder().decode(fromB64(body))) as LoginState
  } catch {
    throw new HttpError('Retorno do Instagram ilegível. Conecte de novo.', 400, 'state')
  }
  if (state.e < Date.now()) throw new HttpError('O login no Instagram demorou demais. Conecte de novo.', 400, 'state')
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
  if ((url.protocol !== 'https:' && !local) || url.pathname !== '/instagram/retorno' || url.search || url.hash) throw new HttpError('Endereço de volta inválido.')
  return url.toString()
}

// ---------- token ----------

interface Grant {
  token: string
  expiresAt: string | null
  permissions: string[]
}

async function exchangeCode(code: string, redirectUri: string, appId: string, secret: string) {
  const form = new URLSearchParams({ client_id: appId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: redirectUri, code })
  const response = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) })
  const data = (await response.json().catch(() => null)) as
    | { data?: { access_token: string; permissions?: string | string[] }[]; access_token?: string; permissions?: string | string[]; error_message?: string; error?: MetaError }
    | null
  const row = data?.data?.[0] ?? data
  if (!response.ok || !row?.access_token) {
    if (data?.error) throw metaError(data.error, response.status)
    throw new HttpError(data?.error_message || 'O Instagram não aceitou o código do login. Conecte de novo.', 400, 'code')
  }
  const permissions = Array.isArray(row.permissions) ? row.permissions : (row.permissions ?? '').split(',').filter(Boolean)
  return { token: row.access_token, permissions }
}

const expiresFrom = (seconds?: number) => (seconds ? new Date(Date.now() + seconds * 1000).toISOString() : null)

/** Token curto (1 hora) vira longo (60 dias). Só no servidor: pede o segredo do app. */
async function longLived(token: string, secret: string) {
  const url = new URL('https://graph.instagram.com/access_token')
  url.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: secret, access_token: token }).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  const data = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: MetaError } | null
  if (!response.ok || !data?.access_token) throw metaError(data?.error, response.status)
  return { token: data.access_token, expiresAt: expiresFrom(data.expires_in) }
}

/** Mais 60 dias para um token longo com pelo menos 24 horas. */
async function refreshed(token: string) {
  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.search = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token }).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  const data = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: MetaError } | null
  if (!response.ok || !data?.access_token) throw metaError(data?.error, response.status)
  return { token: data.access_token, expiresAt: expiresFrom(data.expires_in) }
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
  ig_user_id: string
  username: string
}

const dbError = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || error.code === 'PGRST205'
    ? new HttpError('As tabelas do Instagram ainda não existem: aplique a migração 20261024120000_crm_instagram.sql.', 503, 'no_tables')
    : new HttpError(error.message ?? 'Falha no banco.', 500, 'db')

async function requireRole(ctx: Ctx, teamId: unknown, manager: boolean) {
  if (typeof teamId !== 'string' || !/^[0-9a-f-]{36}$/.test(teamId)) throw new HttpError('Equipe inválida.')
  const { data, error } = await ctx.user.rpc(manager ? 'is_crm_manager' : 'is_crm_member', { p_team: teamId })
  if (error) throw dbError(error)
  if (!data) throw new HttpError(manager ? 'Só quem gerencia a equipe conecta ou desconecta o Instagram.' : 'Você não é desta equipe.', 403, 'forbidden')
  return teamId
}

/** A conta, lida com o acesso de quem chamou (as regras do banco dizem se é da equipe). */
async function accountOf(ctx: Ctx, accountId: unknown): Promise<AccountRow> {
  if (typeof accountId !== 'string' || !/^[0-9a-f-]{36}$/.test(accountId)) throw new HttpError('Conta inválida.')
  const { data, error } = await ctx.user.from('crm_instagram_accounts').select('id, team_id, ig_user_id, username').eq('id', accountId).maybeSingle()
  if (error) throw dbError(error)
  if (!data) throw new HttpError('Essa conta do Instagram não está ligada à sua equipe.', 404, 'not_found')
  return data as AccountRow
}

interface TokenRow {
  access_token: string
  issued_at: string
  expires_at: string | null
}

/** O token da conta, renovado quando faltam menos de 20 dias. Conexão caída: marca na conta. */
async function tokenOf(ctx: Ctx, account: AccountRow): Promise<string> {
  const { data, error } = await ctx.admin.from('crm_instagram_tokens').select('access_token, issued_at, expires_at').eq('account_id', account.id).maybeSingle()
  if (error) throw dbError(error)
  const row = data as TokenRow | null
  if (!row) throw new HttpError('A conta precisa ser conectada de novo.', 401, 'token')
  const age = Date.now() - Date.parse(row.issued_at)
  const left = row.expires_at ? Date.parse(row.expires_at) - Date.now() : Infinity
  if (left <= 0) {
    await markBroken(ctx, account.id)
    throw new HttpError('A conexão com o Instagram expirou. Conecte a conta de novo.', 401, 'token')
  }
  const due = left < 20 * DAY * 1000 || (!row.expires_at && age > 30 * DAY * 1000)
  if (due && age > DAY * 1000) {
    try {
      const next = await refreshed(row.access_token)
      await ctx.admin.from('crm_instagram_tokens').update({ access_token: next.token, issued_at: new Date().toISOString(), expires_at: next.expiresAt }).eq('account_id', account.id)
      await ctx.admin.from('crm_instagram_accounts').update({ token_expires_at: next.expiresAt }).eq('id', account.id)
      return next.token
    } catch (error) {
      console.warn('[instagram] não renovou o token', error)
    }
  }
  return row.access_token
}

const markBroken = (ctx: Ctx, accountId: string) => ctx.admin.from('crm_instagram_accounts').update({ sync_error: 'token' }).eq('id', accountId)

/** Chama a Meta; se a conexão caiu, marca a conta para a tela pedir uma nova. */
async function guarded<T>(ctx: Ctx, account: AccountRow, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof HttpError && error.code === 'token') await markBroken(ctx, account.id)
    throw error
  }
}

// ---------- leitura ----------

const PROFILE_FIELDS = 'user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count,biography,website'
const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count'

interface Profile {
  id: string
  user_id?: string
  username?: string
  name?: string
  account_type?: string
  profile_picture_url?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  biography?: string
  website?: string
}

interface Insight {
  name: string
  values?: { value: unknown; end_time?: string }[]
  total_value?: { value?: number; breakdowns?: { dimension_keys?: string[]; results?: { dimension_values: string[]; value: number }[] }[] }
}

interface MediaItem {
  id: string
  caption?: string
  media_type: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

const profileColumns = (p: Profile) => ({
  username: p.username ?? '',
  name: p.name ?? null,
  account_type: p.account_type ?? null,
  profile_picture_url: p.profile_picture_url ?? null,
  biography: p.biography ?? null,
  website: p.website ?? null,
  followers_count: p.followers_count ?? null,
  follows_count: p.follows_count ?? null,
  media_count: p.media_count ?? null,
})

/** Data do dia em São Paulo (`2026-10-24`). */
const spDay = (at = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(at)

/** Faz até `size` de cada vez. */
async function pool<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await run(items[i])
      }
    })
  )
  return out
}

const TOTAL_METRICS = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'replies', 'profile_links_taps']

const MEDIA_METRICS: Record<string, string[][]> = {
  REELS: [
    ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time'],
    ['reach', 'likes', 'comments', 'shares', 'saved'],
  ],
  FEED: [
    ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'profile_visits', 'follows'],
    ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions'],
    ['reach', 'likes', 'comments', 'saved'],
  ],
  STORY: [
    ['reach', 'views', 'replies', 'shares', 'total_interactions', 'follows', 'profile_visits'],
    ['reach', 'replies'],
  ],
}

const numberOf = (item: Insight) => {
  const value = item.total_value?.value ?? item.values?.[0]?.value
  return typeof value === 'number' ? value : undefined
}

const breakdownOf = (item: Insight | undefined) =>
  Object.fromEntries((item?.total_value?.breakdowns?.[0]?.results ?? []).map((r) => [r.dimension_values.join(' · '), r.value]))

async function mediaInsights(token: string, media: MediaItem) {
  const kind = media.media_product_type === 'REELS' ? 'REELS' : media.media_product_type === 'STORY' ? 'STORY' : 'FEED'
  for (const metrics of MEDIA_METRICS[kind]) {
    try {
      const res = await ig<{ data: Insight[] }>(`${metaId(media.id, 'post')}/insights`, token, { params: { metric: metrics.join(',') } })
      const out: Record<string, number> = {}
      for (const item of res.data ?? []) {
        const n = numberOf(item)
        if (n !== undefined) out[item.name] = n
      }
      return out
    } catch (error) {
      if (error instanceof HttpError && (error.code === 'token' || error.code === 'rate')) throw error
      // Métrica que esse tipo de post não tem: tenta o conjunto menor
    }
  }
  return {}
}

const mediaRow = (account: AccountRow, m: MediaItem, insights: Record<string, number>) => ({
  account_id: account.id,
  team_id: account.team_id,
  media_id: m.id,
  media_type: m.media_type,
  product_type: m.media_product_type ?? null,
  caption: m.caption ?? null,
  permalink: m.permalink ?? null,
  thumbnail_url: m.thumbnail_url ?? (m.media_type === 'VIDEO' ? null : (m.media_url ?? null)),
  media_url: m.media_url ?? null,
  posted_at: m.timestamp,
  like_count: m.like_count ?? null,
  comments_count: m.comments_count ?? null,
  insights,
  updated_at: new Date().toISOString(),
})

/**
 * Lê tudo da conta e grava: perfil, alcance por dia (30 dias), totais de 7 e
 * 30 dias, público, os últimos 50 posts com os números de cada um, os stories
 * no ar e o limite de publicação. O que a Meta não devolve fica em `missing`.
 */
async function sync(ctx: Ctx, account: AccountRow, token: string) {
  const missing: string[] = []
  const soft = async <T>(label: string, run: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await run()
    } catch (error) {
      if (error instanceof HttpError && (error.code === 'token' || error.code === 'rate')) throw error
      console.warn(`[instagram] ${label}`, error instanceof Error ? error.message : error)
      missing.push(label)
      return undefined
    }
  }
  const now = Math.floor(Date.now() / 1000)

  const profile = await ig<Profile>('me', token, { params: { fields: PROFILE_FIELDS } })

  // Alcance de cada dia: o valor que termina às 7h UTC (meia-noite no Pacífico) é do dia anterior
  const series = await soft('alcance por dia', () =>
    ig<{ data: Insight[] }>('me/insights', token, { params: { metric: 'reach', period: 'day', metric_type: 'time_series', since: now - 30 * DAY + 60, until: now } })
  )
  const daily = (series?.data?.[0]?.values ?? [])
    .filter((v) => typeof v.value === 'number' && v.end_time)
    .map((v) => ({ account_id: account.id, team_id: account.team_id, day: new Date(Date.parse(v.end_time!) - DAY * 1000).toISOString().slice(0, 10), reach: v.value as number }))

  const totals: Record<string, Record<string, number>> = {}
  for (const days of [7, 30]) {
    const range = { period: 'day', metric_type: 'total_value', since: now - days * DAY + 60, until: now }
    const out: Record<string, number> = {}
    const all = await soft(`totais de ${days} dias`, () => ig<{ data: Insight[] }>('me/insights', token, { params: { metric: TOTAL_METRICS.join(','), ...range } }))
    if (all) {
      for (const item of all.data ?? []) {
        const n = numberOf(item)
        if (n !== undefined) out[item.name] = n
      }
    } else {
      // Uma métrica recusada derruba o pedido todo: tira o grupo da lista e pede uma a uma
      missing.pop()
      await pool(TOTAL_METRICS, 4, async (metric) => {
        const one = await soft(`${metric} (${days} dias)`, () => ig<{ data: Insight[] }>('me/insights', token, { params: { metric, ...range } }))
        const first = one?.data?.[0]
        const n = first ? numberOf(first) : undefined
        if (n !== undefined) out[metric] = n
      })
    }
    const follows = await soft(`seguir e deixar de seguir (${days} dias)`, () =>
      ig<{ data: Insight[] }>('me/insights', token, { params: { metric: 'follows_and_unfollows', breakdown: 'follow_type', ...range } })
    )
    const split = breakdownOf(follows?.data?.[0])
    if (split.FOLLOWER !== undefined) out.follows = split.FOLLOWER
    if (split.NON_FOLLOWER !== undefined) out.unfollows = split.NON_FOLLOWER
    const reachSplit = await soft(`alcance de seguidores (${days} dias)`, () =>
      ig<{ data: Insight[] }>('me/insights', token, { params: { metric: 'reach', breakdown: 'follow_type', ...range } })
    )
    const bySplit = breakdownOf(reachSplit?.data?.[0])
    if (bySplit.FOLLOWER !== undefined) out.reach_followers = bySplit.FOLLOWER
    if (bySplit.NON_FOLLOWER !== undefined) out.reach_non_followers = bySplit.NON_FOLLOWER
    totals[String(days)] = out
  }

  const audience: Record<string, Record<string, number>> = {}
  if ((profile.followers_count ?? 0) >= 100) {
    await pool(['age', 'gender', 'city', 'country'], 4, async (breakdown) => {
      const res = await soft(`público por ${breakdown}`, () =>
        ig<{ data: Insight[] }>('me/insights', token, { params: { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', timeframe: 'this_month', breakdown } })
      )
      const values = breakdownOf(res?.data?.[0])
      if (Object.keys(values).length) audience[breakdown] = values
    })
  }

  const list = await soft('posts', () => ig<{ data: MediaItem[] }>('me/media', token, { params: { fields: MEDIA_FIELDS, limit: 50 } }))
  const stories = await soft('stories no ar', () => ig<{ data: MediaItem[] }>('me/stories', token, { params: { fields: MEDIA_FIELDS } }))
  const media = [...(list?.data ?? []), ...(stories?.data ?? []).map((s) => ({ ...s, media_product_type: 'STORY' }))]
  const rows = await pool(media, 6, async (m) => mediaRow(account, m, await mediaInsights(token, m)))

  const quota = await soft('limite de publicação', () => ig<{ data: { quota_usage?: number; config?: { quota_total?: number } }[] }>('me/content_publishing_limit', token, { params: { fields: 'quota_usage,config' } }))
  const usage = quota?.data?.[0]

  const today = spDay()
  const writes: PromiseLike<{ error: { code?: string; message?: string } | null }>[] = [
    ctx.admin
      .from('crm_instagram_accounts')
      .update({
        ...profileColumns(profile),
        totals,
        audience,
        publish_quota: usage ? { used: usage.quota_usage ?? 0, total: usage.config?.quota_total ?? 100 } : null,
        missing,
        synced_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq('id', account.id),
    ctx.admin
      .from('crm_instagram_daily')
      .upsert({ account_id: account.id, team_id: account.team_id, day: today, followers: profile.followers_count ?? null }, { onConflict: 'account_id,day' }),
  ]
  if (daily.length) writes.push(ctx.admin.from('crm_instagram_daily').upsert(daily, { onConflict: 'account_id,day' }))
  if (rows.length) writes.push(ctx.admin.from('crm_instagram_media').upsert(rows, { onConflict: 'account_id,media_id' }))
  for (const { error } of await Promise.all(writes)) if (error) throw dbError(error)

  return { posts: rows.length, missing }
}

// ---------- conectar ----------

async function saveConnection(ctx: Ctx, teamId: string, grant: Grant) {
  const profile = await ig<Profile>('me', grant.token, { params: { fields: PROFILE_FIELDS } })
  if (profile.account_type && !['BUSINESS', 'MEDIA_CREATOR'].includes(profile.account_type))
    throw new HttpError('Essa conta é pessoal. No app do Instagram, mude para conta profissional (Empresa ou Criador de conteúdo) e conecte de novo.', 400, 'personal')
  const { data, error } = await ctx.admin
    .from('crm_instagram_accounts')
    .upsert(
      {
        team_id: teamId,
        ig_user_id: profile.user_id ?? profile.id,
        ...profileColumns(profile),
        connected_by: ctx.userId,
        connected_at: new Date().toISOString(),
        token_expires_at: grant.expiresAt,
        sync_error: null,
      },
      { onConflict: 'team_id,ig_user_id' }
    )
    .select('id, team_id, ig_user_id, username')
    .single()
  if (error) throw dbError(error)
  const account = data as AccountRow
  const saved = await ctx.admin
    .from('crm_instagram_tokens')
    .upsert({ account_id: account.id, access_token: grant.token, permissions: grant.permissions, issued_at: new Date().toISOString(), expires_at: grant.expiresAt }, { onConflict: 'account_id' })
  if (saved.error) throw dbError(saved.error)
  let synced: { posts: number; missing: string[] } | { error: string }
  try {
    synced = await sync(ctx, account, grant.token)
  } catch (error) {
    synced = { error: error instanceof Error ? error.message : String(error) }
  }
  return { accountId: account.id, username: account.username, sync: synced }
}

// ---------- publicar ----------

interface PublishFile {
  path: string
  type: 'image' | 'video'
}

/** Arquivos enviados pela equipe para a pasta do Instagram dela, viram endereços temporários para a Meta baixar. */
async function filesOf(ctx: Ctx, account: AccountRow, files: unknown): Promise<(PublishFile & { url: string })[]> {
  if (!Array.isArray(files) || !files.length) throw new HttpError('Escolha o que publicar.')
  const prefix = `crm/${account.team_id}/instagram/`
  return Promise.all(
    files.map(async (file: Partial<PublishFile>) => {
      const path = String(file?.path ?? '')
      if (!path.startsWith(prefix) || path.includes('..') || !/^[\w/.-]+$/.test(path)) throw new HttpError('Arquivo fora da pasta do Instagram da equipe.')
      const type = file?.type === 'video' ? 'video' : 'image'
      const { data, error } = await ctx.admin.storage.from(BUCKET).createSignedUrl(path, 3600)
      if (error || !data?.signedUrl) throw new HttpError('Não encontrei o arquivo enviado. Tente de novo.', 404)
      return { path, type, url: data.signedUrl }
    })
  )
}

const cleanup = (ctx: Ctx, account: AccountRow, paths: unknown) => {
  const prefix = `crm/${account.team_id}/instagram/`
  const list = Array.isArray(paths) ? paths.map(String).filter((p) => p.startsWith(prefix) && !p.includes('..')) : []
  return list.length ? ctx.admin.storage.from(BUCKET).remove(list).then(() => undefined, () => undefined) : Promise.resolve()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Espera o contêiner ficar pronto por até `wait` ms. */
async function containerStatus(token: string, id: string, wait: number) {
  const until = Date.now() + wait
  for (;;) {
    const res = await ig<{ status_code?: string; status?: string }>(metaId(id, 'contêiner'), token, { params: { fields: 'status_code,status' } })
    const code = res.status_code ?? 'IN_PROGRESS'
    if (code === 'ERROR' || code === 'EXPIRED') throw new HttpError(`O Instagram não conseguiu preparar o post${res.status ? `: ${res.status}` : '.'}`, 400, 'container')
    if (code !== 'IN_PROGRESS' || Date.now() > until) return code
    await sleep(2500)
  }
}

async function finish(ctx: Ctx, account: AccountRow, token: string, containerId: string, paths: unknown, wait: number) {
  const code = await containerStatus(token, containerId, wait)
  if (code === 'IN_PROGRESS') return { status: 'processing' as const, containerId }
  const published = await ig<{ id: string }>('me/media_publish', token, { method: 'POST', params: { creation_id: containerId } })
  await cleanup(ctx, account, paths)
  // O post entra na lista com quem publicou; os números chegam na próxima leitura
  let permalink: string | undefined
  try {
    const media = await ig<MediaItem>(metaId(published.id, 'post'), token, { params: { fields: MEDIA_FIELDS } })
    permalink = media.permalink
    await ctx.admin.from('crm_instagram_media').upsert({ ...mediaRow(account, media, {}), published_by: ctx.userId }, { onConflict: 'account_id,media_id' })
  } catch (error) {
    console.warn('[instagram] publicado, mas não leu o post', error)
  }
  return { status: 'published' as const, mediaId: published.id, permalink }
}

async function publish(ctx: Ctx, account: AccountRow, token: string, body: Record<string, unknown>) {
  const kind = body.kind === 'story' ? 'story' : body.kind === 'reel' ? 'reel' : 'feed'
  const caption = typeof body.caption === 'string' ? body.caption.slice(0, 2200) : undefined
  const files = await filesOf(ctx, account, body.files)
  const paths = files.map((f) => f.path)
  const create = (params: Params) => ig<{ id: string }>('me/media', token, { method: 'POST', params })
  const media = (f: { type: string; url: string }) => (f.type === 'video' ? { video_url: f.url } : { image_url: f.url })

  let containerId: string
  if (kind === 'story') {
    if (files.length !== 1) throw new HttpError('O story é um arquivo só.')
    containerId = (await create({ media_type: 'STORIES', ...media(files[0]) })).id
  } else if (kind === 'reel' || (files.length === 1 && files[0].type === 'video')) {
    if (files.length !== 1 || files[0].type !== 'video') throw new HttpError('O reels é um vídeo só.')
    containerId = (await create({ media_type: 'REELS', video_url: files[0].url, caption, share_to_feed: body.shareToFeed !== false })).id
  } else if (files.length === 1) {
    containerId = (await create({ image_url: files[0].url, caption })).id
  } else {
    if (files.length > 20) throw new HttpError('O carrossel vai até 20 itens.')
    const children: string[] = []
    for (const f of files) children.push((await create({ is_carousel_item: true, ...(f.type === 'video' ? { media_type: 'VIDEO' } : {}), ...media(f) })).id)
    containerId = (await create({ media_type: 'CAROUSEL', children: children.join(','), caption })).id
  }
  // Foto fica pronta em segundos; vídeo pode levar minutos (a tela pergunta de novo)
  return finish(ctx, account, token, containerId, paths, files.some((f) => f.type === 'video') ? 20_000 : 30_000)
}

// ---------- comentários ----------

const COMMENT_FIELDS = 'id,text,username,timestamp,like_count,hidden'

async function comments(token: string, mediaId: string) {
  const id = metaId(mediaId, 'post')
  try {
    return await ig<{ data: unknown[] }>(`${id}/comments`, token, { params: { fields: `${COMMENT_FIELDS},replies{${COMMENT_FIELDS}}`, limit: 50 } })
  } catch (error) {
    if (error instanceof HttpError && (error.code === 'token' || error.code === 'rate' || error.code === 'permission')) throw error
    return ig<{ data: unknown[] }>(`${id}/comments`, token, { params: { fields: COMMENT_FIELDS, limit: 50 } })
  }
}

// ---------- entrada ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: auth } = await user.auth.getUser()
    if (!auth?.user) return json({ error: 'Entre na conta para usar o Instagram da equipe.', code: 'auth' }, 401)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const ctx: Ctx = { user, admin, userId: auth.user.id }

    const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
    const appId = Deno.env.get('INSTAGRAM_APP_ID') ?? ''
    const secret = Deno.env.get('INSTAGRAM_APP_SECRET') ?? ''
    const needsApp = () => {
      if (!appId || !secret) throw new HttpError('Falta configurar o app da Meta no Supabase (segredos INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET).', 503, 'not_configured')
    }

    switch (body.action) {
      case 'status':
        return json({ configured: !!appId && !!secret, version: VERSION, scopes: SCOPES })

      case 'auth_url': {
        needsApp()
        const teamId = await requireRole(ctx, body.teamId, true)
        const redirectUri = checkRedirect(body.redirectUri)
        const state = await packState({ t: teamId, u: ctx.userId, r: redirectUri, e: Date.now() + 15 * 60_000, n: crypto.randomUUID() }, secret)
        const auth = new URL('https://www.instagram.com/oauth/authorize')
        auth.search = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(','), state }).toString()
        return json({ url: auth.toString() })
      }

      case 'connect': {
        needsApp()
        const state = await unpackState(body.state, secret)
        if (state.u !== ctx.userId) throw new HttpError('O login no Instagram foi começado por outra pessoa. Conecte de novo.', 403, 'state')
        if (checkRedirect(body.redirectUri) !== state.r) throw new HttpError('Endereço de volta diferente do pedido.', 400, 'state')
        const teamId = await requireRole(ctx, state.t, true)
        const code = typeof body.code === 'string' ? body.code.replace(/#_$/, '') : ''
        if (!code) throw new HttpError('O Instagram não devolveu o código do login.')
        const short = await exchangeCode(code, state.r, appId, secret)
        const long = await longLived(short.token, secret)
        return json(await saveConnection(ctx, teamId, { token: long.token, expiresAt: long.expiresAt, permissions: short.permissions }))
      }

      case 'connect_token': {
        const teamId = await requireRole(ctx, body.teamId, true)
        const pasted = typeof body.token === 'string' ? body.token.trim() : ''
        if (pasted.length < 20 || /\s/.test(pasted)) throw new HttpError('Cole o token de acesso inteiro.')
        await ig<Profile>('me', pasted, { params: { fields: 'user_id,username' } })
        // Curto vira longo (com o segredo); longo com mais de 24 horas ganha mais 60 dias; senão fica como veio
        let grant: Grant = { token: pasted, expiresAt: new Date(Date.now() + 60 * DAY * 1000).toISOString(), permissions: [] }
        try {
          if (secret) grant = { ...grant, ...(await longLived(pasted, secret)) }
          else throw new Error('sem segredo')
        } catch {
          try {
            grant = { ...grant, ...(await refreshed(pasted)) }
          } catch {
            // Token longo recém-gerado: vale 60 dias e renova depois de 24 horas
          }
        }
        return json(await saveConnection(ctx, teamId, grant))
      }

      case 'sync': {
        const account = await accountOf(ctx, body.accountId)
        const token = await tokenOf(ctx, account)
        return json(await guarded(ctx, account, () => sync(ctx, account, token)))
      }

      case 'publish': {
        const account = await accountOf(ctx, body.accountId)
        const token = await tokenOf(ctx, account)
        return json(await guarded(ctx, account, () => publish(ctx, account, token, body)))
      }

      case 'publish_check': {
        const account = await accountOf(ctx, body.accountId)
        const token = await tokenOf(ctx, account)
        const containerId = metaId(body.containerId, 'contêiner')
        return json(await guarded(ctx, account, () => finish(ctx, account, token, containerId, body.paths, 0)))
      }

      case 'comments': {
        const account = await accountOf(ctx, body.accountId)
        const token = await tokenOf(ctx, account)
        return json(await guarded(ctx, account, () => comments(token, String(body.mediaId ?? ''))))
      }

      case 'reply': {
        const account = await accountOf(ctx, body.accountId)
        const token = await tokenOf(ctx, account)
        const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2200) : ''
        if (!message) throw new HttpError('Escreva a resposta.')
        const target = metaId(body.commentId, 'comentário')
        return json(await guarded(ctx, account, () => ig<{ id: string }>(`${target}/replies`, token, { method: 'POST', params: { message } })))
      }

      case 'hide': {
        const account = await accountOf(ctx, body.accountId)
        const token = await tokenOf(ctx, account)
        const target = metaId(body.commentId, 'comentário')
        return json(await guarded(ctx, account, () => ig<{ success: boolean }>(target, token, { method: 'POST', params: { hide: body.hide !== false } })))
      }

      case 'delete_comment': {
        const account = await accountOf(ctx, body.accountId)
        const token = await tokenOf(ctx, account)
        const target = metaId(body.commentId, 'comentário')
        return json(await guarded(ctx, account, () => ig<{ success: boolean }>(target, token, { method: 'DELETE' })))
      }

      case 'disconnect': {
        const account = await accountOf(ctx, body.accountId)
        await requireRole(ctx, account.team_id, true)
        const { error } = await admin.from('crm_instagram_accounts').delete().eq('id', account.id)
        if (error) throw dbError(error)
        return json({ ok: true })
      }

      default:
        return json({ error: 'Ação desconhecida.' }, 400)
    }
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message, code: error.code }, error.status)
    console.error('[instagram]', error)
    return json({ error: error instanceof Error ? error.message : String(error), code: 'error' }, 500)
  }
})
