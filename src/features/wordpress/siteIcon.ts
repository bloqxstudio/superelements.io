import { credentialsOf } from './connect'
import { uploadDataUrl } from './media'
import { wpRequest, WordPressError } from './rest'
import type { WordPressConnection } from './types'

/**
 * Troca o ícone do site (favicon): o PNG vai para a biblioteca de mídia e a
 * configuração `site_icon` do WordPress passa a apontar para ele. É a mesma
 * configuração que o Elementor mostra em Configurações do site, Identidade.
 */
export async function saveSiteIcon(connection: WordPressConnection, image: string) {
  const media = await uploadDataUrl(connection, image, 'icone-do-site')
  let settings: { site_icon?: number }
  try {
    settings = await wpRequest(credentialsOf(connection), 'wp/v2/settings', {
      method: 'POST',
      params: { _fields: 'site_icon' },
      body: { site_icon: media.id },
    })
  } catch (error) {
    if (error instanceof WordPressError && (error.status === 401 || error.status === 403)) {
      throw new WordPressError('Só um administrador do WordPress pode trocar o ícone do site. Conecte com um usuário administrador.', error.code, error.status)
    }
    throw error
  }
  if (settings.site_icon !== media.id) throw new WordPressError('O WordPress não gravou o ícone do site (a versão dele pode não aceitar pela API).')
  return media
}
