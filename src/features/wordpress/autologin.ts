import { adminUrl, credentialsOf } from './connect'
import { wpRequest, WordPressError } from './rest'
import type { WordPressConnection } from './types'

/**
 * Entrar no painel do WordPress sem digitar a senha: o plugin Superelements Connector (0.4 ou mais novo)
 * devolve um link de uso único, válido por 60 segundos, para o usuário da conexão. Sem o plugin (ou velho
 * demais) a rota não existe e a pessoa cai no painel comum, onde o WordPress pede o login.
 */

export const CONNECTOR_ZIP = '/wordpress/superelements-connector.zip'

export class ConnectorMissing extends Error {
  constructor() {
    super('O plugin Superelements Connector do site não tem o login automático (precisa do 0.4 ou mais novo).')
  }
}

/** Link de entrada. `to`: caminho dentro do wp-admin (ex.: `post.php?post=7&action=elementor`). */
export async function autologinUrl(connection: WordPressConnection, to = ''): Promise<string> {
  try {
    const result = await wpRequest<{ url?: string }>(credentialsOf(connection), 'superelements/v1/login', { method: 'POST', body: { redirect: to } })
    if (!result.url) throw new WordPressError('O site não devolveu o link de entrada.')
    return result.url
  } catch (error) {
    if (error instanceof WordPressError && (error.status === 404 || error.code === 'rest_no_route')) throw new ConnectorMissing()
    throw error
  }
}

/**
 * Abre o painel já logado em outra aba. A aba abre antes da chamada (o navegador só deixa abrir janela
 * em resposta direta ao clique) e vai para o link quando ele chega.
 */
export async function openAdmin(connection: WordPressConnection, to = ''): Promise<'auto' | 'manual'> {
  const tab = window.open('', '_blank')
  const plain = `${adminUrl(connection.site)}${to}`
  try {
    const url = await autologinUrl(connection, to)
    if (tab) tab.location.href = url
    else window.location.href = url
    return 'auto'
  } catch (error) {
    if (tab) tab.location.href = plain
    else window.open(plain, '_blank', 'noopener')
    if (error instanceof ConnectorMissing) return 'manual'
    throw error
  }
}
