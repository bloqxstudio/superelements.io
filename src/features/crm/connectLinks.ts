/**
 * Quem volta do Instagram ou do Facebook pelo link enviado ao cliente não tem login aqui: o retorno
 * decide qual tela mostrar pelo segredo guardado na sessão. Fica num módulo pequeno porque o roteador
 * precisa disso na primeira tela, sem carregar o código do Instagram e dos anúncios.
 */

/** Onde a página pública do link do Instagram guarda o segredo enquanto o cliente está na Meta. */
export const LINK_KEY = 'ig-link-conexao'
/** Onde a página pública do link de anúncios guarda o segredo enquanto o cliente está no Facebook. */
export const ADS_LINK_KEY = 'ads-link-conexao'

const has = (key: string) => {
  try {
    return !!sessionStorage.getItem(key)
  } catch {
    return false
  }
}

export const comesFromLink = () => has(LINK_KEY)
export const comesFromAdsLink = () => has(ADS_LINK_KEY)
