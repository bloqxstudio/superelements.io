import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * O que as funções `instagram` e `meta-ads` faziam igual, linha por linha (revisão de 2026-11-13: ~150
 * linhas duplicadas): o erro com status e código para a tela, o estado do login assinado com o segredo do
 * app, a comparação de segredos em tempo constante, o endereço de volta, o papel e o módulo de quem chama
 * e o link de conexão para o cliente. O que muda entre as duas (mensagens, tabela, caminho de retorno)
 * entra como parâmetro.
 */

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'error'
  ) {
    super(message)
  }
}

export interface Ctx {
  user: SupabaseClient
  admin: SupabaseClient
  userId: string
}

export type DbError = (error: { code?: string; message?: string }) => HttpError

/** Erro do banco: tabela que falta vira o aviso da migração; o resto é 500 (a mensagem crua só vai ao log). */
export const dbErrorFor =
  (missingTables: string): DbError =>
  (error) =>
    error.code === '42P01' || error.code === 'PGRST205' ? new HttpError(missingTables, 503, 'no_tables') : new HttpError(error.message ?? 'Falha no banco.', 500, 'db')

const GENERIC = 'Algo deu errado aqui do nosso lado. Tente de novo em instantes.'

/**
 * A resposta de erro de uma ação. Revisão de 2026-11-13: um 500 devolvia `error.message` cru (texto do banco
 * ou do runtime) para quem chamou; agora o detalhe vai só para o log e a tela recebe uma frase genérica.
 * Os `HttpError` escritos para a pessoa (4xx e os 5xx com código próprio, como `not_configured`) passam.
 */
export function errorResponse(error: unknown, tag: string, json: (body: unknown, status?: number) => Response, logAll = false) {
  const shown = error instanceof HttpError && !(error.status >= 500 && error.code === 'db')
  // `logAll`: o cron registra também as recusas previstas (token vencido, conta sumida)
  if (logAll || !shown) console.error(tag, error)
  if (shown) return json({ error: error.message, code: error.code }, error.status)
  return json({ error: GENERIC, code: error instanceof HttpError ? error.code : 'error' }, 500)
}

// ---------- segredos ----------

export const encoder = new TextEncoder()
export const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const fromB64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export async function sign(text: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toB64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(text))))
}

/** Compara dois segredos sem parar no primeiro caractere diferente (o tempo não revela o prefixo certo). */
export const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const sha256 = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))), (b) => b.toString(16).padStart(2, '0')).join('')

// ---------- estado do login (assinado com o segredo do app) ----------

export interface LoginStateBase {
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

export async function packState<T extends LoginStateBase>(state: T, secret: string) {
  const body = toB64(encoder.encode(JSON.stringify(state)))
  return `${body}.${await sign(body, secret)}`
}

/** `from`: quem devolveu o login ("Instagram", "Facebook"); `retry`: onde conectar de novo. */
export async function unpackState<T extends LoginStateBase>(text: unknown, secret: string, from: string, retry: string): Promise<T> {
  const [body = '', mac = ''] = typeof text === 'string' ? text.split('.') : []
  if (!body || !mac || !sameText(mac, await sign(body, secret))) throw new HttpError(`Este retorno do ${from} não veio desta plataforma. Conecte de novo ${retry}.`, 400, 'state')
  let state: T
  try {
    state = JSON.parse(new TextDecoder().decode(fromB64(body))) as T
  } catch {
    throw new HttpError(`Retorno do ${from} ilegível. Conecte de novo.`, 400, 'state')
  }
  if (state.e < Date.now()) throw new HttpError(`O login no ${from} demorou demais. Conecte de novo.`, 400, 'state')
  return state
}

/**
 * Só a tela de retorno da própria plataforma. `allowed`: a lista exata de endereços aceitos (Instagram);
 * sem ela, https no caminho certo, ou localhost no servidor de dev (`local`).
 */
export function checkRedirect(value: unknown, options: { path: string; allowed?: string[]; local?: boolean; message?: string; code?: string }) {
  if (typeof value !== 'string') throw new HttpError('Falta o endereço de volta.')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new HttpError('Endereço de volta inválido.')
  }
  const local = !!options.local && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  const ok = (url.protocol === 'https:' || local) && url.pathname === options.path && !url.search && !url.hash && (!options.allowed || options.allowed.includes(url.toString()))
  if (!ok) throw new HttpError(options.message ?? 'Endereço de volta inválido.', 400, options.code ?? 'error')
  return url.toString()
}

// ---------- papel e módulo ----------

const TEAM = /^[0-9a-f-]{36}$/

/**
 * O módulo precisa estar ligado na conta e quem chama precisa ser da equipe (gestor, quando `manager`).
 * `managerOnly`: a frase da recusa para quem não gerencia.
 */
export function teamGuards(options: { module: string; moduleOff: string; managerOnly: string; dbError: DbError }) {
  async function requireModule(ctx: Ctx, teamId: string) {
    const { data, error } = await ctx.user.rpc('crm_module_on', { p_team: teamId, p_module: options.module })
    // Sem a migração das contas a função não existe: nada é restrito
    if (error) {
      if (error.code === '42883' || error.code === 'PGRST202') return
      throw options.dbError(error)
    }
    if (data === false) throw new HttpError(options.moduleOff, 403, 'module_off')
  }

  async function requireRole(ctx: Ctx, teamId: unknown, manager: boolean) {
    if (typeof teamId !== 'string' || !TEAM.test(teamId)) throw new HttpError('Equipe inválida.')
    const { data, error } = await ctx.user.rpc(manager ? 'is_crm_manager' : 'is_crm_member', { p_team: teamId })
    if (error) throw options.dbError(error)
    if (!data) throw new HttpError(manager ? options.managerOnly : 'Você não é desta equipe.', 403, 'forbidden')
    await requireModule(ctx, teamId)
    return teamId
  }

  return { requireModule, requireRole }
}

// ---------- link para o cliente conectar ----------

export interface LinkBase {
  id: string
  team_id: string
  created_by: string | null
  expires_at: string
  used_at: string | null
  revoked_at: string | null
}

export type LinkState = 'ok' | 'used' | 'expired' | 'revoked'

export const LINK_PROBLEM: Record<Exclude<LinkState, 'ok'>, string> = {
  used: 'Este link já foi usado. Peça um novo a quem enviou.',
  expired: 'Este link venceu. Peça um novo a quem enviou.',
  revoked: 'Este link foi cancelado. Peça um novo a quem enviou.',
}

/** O link pelo segredo que veio no endereço (no banco só fica o hash); `state` diz se ainda vale e por quê. */
export async function linkOf<T extends LinkBase>(admin: SupabaseClient, table: string, columns: string, token: unknown, dbError: DbError): Promise<{ link: T; state: LinkState }> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,80}$/.test(token)) throw new HttpError('Link inválido. Peça um novo a quem enviou.', 404, 'link')
  const { data, error } = await admin.from(table).select(columns).eq('token_hash', await sha256(token)).maybeSingle()
  if (error) throw dbError(error)
  if (!data) throw new HttpError('Link inválido. Peça um novo a quem enviou.', 404, 'link')
  const link = data as unknown as T
  const state: LinkState = link.revoked_at ? 'revoked' : link.used_at ? 'used' : Date.parse(link.expires_at) < Date.now() ? 'expired' : 'ok'
  return { link, state }
}
