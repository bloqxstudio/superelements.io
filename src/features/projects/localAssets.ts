/**
 * Os modelos gravam as imagens do próprio app com o endereço completo
 * (`http://localhost:62251/sections/...`), porque o Elementor e o WordPress
 * precisam de URL absoluta. Só que a porta do servidor local muda de uma
 * sessão para outra, e o app publicado tem outro endereço: o que foi gravado
 * antes deixava de abrir. Ao ler um projeto, as imagens do app gravadas com um
 * endereço local passam para o endereço de agora.
 *
 * Só as pastas de `public/` entram: um WordPress local (Playground em outra
 * porta, com `/wp-content/`) continua com o endereço dele.
 */
const APP_FOLDERS = ['sections', 'brands', 'inpel', 'zelo', 'menuzito', 'uglycash', 'pdv-light', 'lovable-uploads', 'wordpress']

const LOCAL_APP_ASSET = new RegExp(`https?://(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?(?=/(?:${APP_FOLDERS.join('|')})/)`, 'g')

/**
 * Imagens do app gravadas com um endereço local viram caminho da raiz
 * (`/sections/...`). Num iframe `srcdoc` o caminho resolve pelo endereço da
 * página que o mostra, então a foto do link de aprovação abre em qualquer porta,
 * num túnel ou no app publicado.
 */
export const rootRelativeAssets = (html: string) => html.replace(LOCAL_APP_ASSET, '')

// Qualquer origem antes de uma pasta do app (local, túnel ou publicado)
const ANY_APP_ASSET = new RegExp(`https?://[^/"'\\s)\\\\]+(?=/(?:${APP_FOLDERS.join('|')})/)`, 'g')

/** Para comparar conteúdo salvo de endereços diferentes: as imagens do app ficam só com o caminho. */
export const withoutAppOrigin = (text: string) => text.replace(ANY_APP_ASSET, '')

/** O endereço de uma imagem do app com a origem de agora; qualquer outro fica como está. */
export const currentAssetUrl = (url: string) => url.replace(LOCAL_APP_ASSET, window.location.origin)

/** O mesmo valor (seções, marca, resumo) com as imagens do app no endereço de agora. */
export function withCurrentOrigin<T>(value: T): T {
  if (value === undefined || value === null) return value
  const json = JSON.stringify(value)
  const next = json.replace(LOCAL_APP_ASSET, window.location.origin)
  return next === json ? value : (JSON.parse(next) as T)
}
