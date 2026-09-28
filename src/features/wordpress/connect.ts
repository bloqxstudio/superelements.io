import { deleteWordPressConnection, loadWordPressConnection, saveWordPressConnection } from '@/features/projects/storage'
import { INDEX_FIELDS, siteFromIndex, wpRequest, WordPressError, type Credentials, type WordPressSite, type WpIndex } from './rest'
import type { WordPressConnection } from './types'

/**
 * Conexão pelas senhas de aplicação do WordPress (nativas desde a 5.6): a
 * pessoa aprova o acesso na tela do próprio site, que devolve usuário e senha
 * para a rota de retorno. A senha de login nunca passa pela plataforma.
 */

export const CALLBACK_PATH = '/wordpress/retorno'

/** Identifica a plataforma na lista de senhas de aplicação do usuário no WordPress. */
const APP_ID = 'b5d7e0c2-4f1a-4c8e-9d3b-6a2f1e8c7d45'

/** Pedido de aprovação aberto; não guarda segredo, só liga o retorno ao projeto. */
export interface PendingConnection {
  state: string
  projectId: string
  site: WordPressSite
  /** Na janela à parte o retorno fecha a janela; na mesma aba ele volta ao projeto. */
  mode: 'popup' | 'redirect'
  createdAt: number
}

const PENDING_KEY = 'superelements-wordpress-pending'
const PENDING_TTL = 30 * 60_000

const readPending = (): Record<string, PendingConnection> => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '{}')
  } catch {
    return {}
  }
}

const writePending = (all: Record<string, PendingConnection>) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(all))
  } catch {
    // Sem o pedido guardado o retorno avisa que expirou, e a pessoa conecta de novo
  }
}

const alive = (pending: PendingConnection) => Date.now() - pending.createdAt < PENDING_TTL

/** Tira o pedido da lista: cada retorno só vale uma vez. */
export function takePending(state: string): PendingConnection | undefined {
  const all = readPending()
  const pending = all[state]
  delete all[state]
  writePending(all)
  return pending && alive(pending) ? pending : undefined
}

/**
 * O WordPress só devolve a senha para um endereço https, a menos que o próprio
 * site seja local. Site em http que aceita senhas de aplicação só pode ser local.
 */
export const canReturnHere = (site: WordPressSite) => window.location.protocol === 'https:' || site.siteUrl.startsWith('http:')

interface AuthorizationRequest {
  projectId: string
  projectName: string
  site: WordPressSite
  mode: PendingConnection['mode']
  /** Sem retorno, o WordPress mostra a senha na tela para ser copiada. */
  returnHere: boolean
}

/** Endereço da tela de aprovação no WordPress; com retorno, guarda o pedido para a volta. */
export function authorizationUrl({ projectId, projectName, site, mode, returnHere }: AuthorizationRequest): string {
  if (!site.authorizeUrl) throw new WordPressError('Este site não aceita senhas de aplicação.')
  const url = new URL(site.authorizeUrl)
  url.searchParams.set('app_name', `Superelements · ${projectName}`)
  url.searchParams.set('app_id', APP_ID)

  if (returnHere) {
    const state = crypto.randomUUID()
    const all = Object.fromEntries(Object.entries(readPending()).filter(([, p]) => alive(p)))
    all[state] = { state, projectId, site, mode, createdAt: Date.now() }
    writePending(all)
    // Sem `#` no retorno: o WordPress emenda os parâmetros no fim do endereço
    const back = `${window.location.origin}${CALLBACK_PATH}?state=${state}`
    url.searchParams.set('success_url', back)
    // Com reject_url próprio o WordPress volta sem dizer que foi recusa
    url.searchParams.set('reject_url', `${back}&success=false`)
  }
  return url.toString()
}

interface WpUser {
  id: number
  name: string
  roles?: string[]
  capabilities?: Record<string, boolean>
}

/** Confere a senha no site e lê quem é o usuário, o que ele pode fazer e o que o site tem. */
async function inspect(site: WordPressSite, creds: Credentials, passwordUuid?: string): Promise<WordPressConnection> {
  const [user, index, current] = await Promise.all([
    wpRequest<WpUser>(creds, 'wp/v2/users/me', { params: { context: 'edit' } }),
    // Logado, o índice responde mesmo quando o site fecha a API para visitantes
    wpRequest<WpIndex>(creds, '', { params: { _fields: INDEX_FIELDS } }).catch(() => null),
    passwordUuid
      ? null
      : wpRequest<{ uuid?: string }>(creds, 'wp/v2/users/me/application-passwords/introspect').catch(() => null),
  ])

  const caps = user.capabilities ?? {}
  const fresh = index && siteFromIndex(index, site.restRoot, site.siteUrl)
  const now = Date.now()
  return {
    site: fresh ? { ...fresh, authorizeUrl: fresh.authorizeUrl ?? site.authorizeUrl, restricted: site.restricted } : site,
    userLogin: creds.userLogin,
    password: creds.password,
    passwordUuid: passwordUuid ?? current?.uuid,
    user: { id: user.id, name: user.name, roles: user.roles ?? [] },
    can: {
      editPages: !!caps.edit_pages,
      publishPages: !!caps.publish_pages,
      uploadFiles: !!caps.upload_files,
      unfilteredHtml: !!caps.unfiltered_html,
      manageOptions: !!caps.manage_options,
    },
    connectedAt: now,
    checkedAt: now,
  }
}

export const credentialsOf = (connection: Pick<WordPressConnection, 'site' | 'userLogin' | 'password'>): Credentials => ({
  restRoot: connection.site.restRoot,
  userLogin: connection.userLogin,
  password: connection.password,
})

/** Guarda a conexão depois de conferir a senha aprovada no site. */
export async function completeConnection(projectId: string, site: WordPressSite, userLogin: string, password: string) {
  // O WordPress mostra a senha em blocos com espaço e ignora o que não é letra ou número
  const creds = { restRoot: site.restRoot, userLogin: userLogin.trim(), password: password.replace(/\s+/g, '') }
  if (!creds.userLogin || !creds.password) throw new WordPressError('Preencha o usuário e a senha de aplicação.')
  const connection = await inspect(site, creds)
  await saveWordPressConnection(projectId, connection)
  announce({ type: 'connected', projectId })
  return connection
}

/** Confere de novo a senha guardada e atualiza o que o site tem. */
export async function refreshConnection(projectId: string, connection: WordPressConnection) {
  const fresh = await inspect(connection.site, credentialsOf(connection), connection.passwordUuid)
  const next = { ...fresh, connectedAt: connection.connectedAt }
  await saveWordPressConnection(projectId, next)
  announce({ type: 'connected', projectId })
  return next
}

/** Apaga a senha de aplicação no WordPress; `false` se o site não respondeu. */
export async function revokeApplicationPassword(connection: WordPressConnection): Promise<boolean> {
  try {
    const creds = credentialsOf(connection)
    const uuid =
      connection.passwordUuid ?? (await wpRequest<{ uuid?: string }>(creds, 'wp/v2/users/me/application-passwords/introspect')).uuid
    if (!uuid) return false
    await wpRequest(creds, `wp/v2/users/me/application-passwords/${uuid}`, { method: 'DELETE' })
    return true
  } catch (error) {
    // Senha já apagada no site: não há o que revogar
    return error instanceof WordPressError && (error.code === 'incorrect_password' || error.status === 404)
  }
}

/**
 * Revoga a senha no WordPress e apaga a conexão do projeto. Se o site não
 * responder, apaga mesmo assim e devolve `false` para avisar.
 */
export async function disconnectWordPress(projectId: string): Promise<boolean> {
  const connection = await loadWordPressConnection(projectId)
  if (!connection) return true

  const revoked = await revokeApplicationPassword(connection)
  await deleteWordPressConnection(projectId)
  announce({ type: 'disconnected', projectId })
  return revoked
}

/** Painel do site, tirado da tela de aprovação (que fica dentro dele, mesmo com wp-admin em outro lugar). */
export const adminUrl = (site: WordPressSite) =>
  site.authorizeUrl?.replace(/authorize-application\.php.*$/, '') ?? `${site.siteUrl}/wp-admin/`

/** Perfil do usuário no WordPress, onde a pessoa apaga uma senha de aplicação à mão. */
export const profileUrl = (site: WordPressSite) => `${adminUrl(site)}profile.php#application-passwords-section`

// Avisos entre abas e janelas: o retorno roda na janela de aprovação, o projeto em outra
const CHANNEL = 'superelements-wordpress'

export type ConnectionMessage =
  | { type: 'connected' | 'disconnected' | 'rejected'; projectId: string }
  | { type: 'failed'; projectId: string; error: string }

export function announce(message: ConnectionMessage) {
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage(message)
    channel.close()
  } catch {
    // Navegador sem BroadcastChannel: o projeto relê a conexão ao abrir o diálogo
  }
}

export function listenConnections(onMessage: (message: ConnectionMessage) => void) {
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event) => onMessage(event.data as ConnectionMessage)
    return () => channel.close()
  } catch {
    return () => {}
  }
}
