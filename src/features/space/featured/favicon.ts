import type { Brand } from '../brand/designMd'
import { isDarkColor, loadImage } from './render'

/**
 * Ícone do site (favicon): PNG quadrado de 512 px, o tamanho que o WordPress
 * pede. O WordPress tira dele as versões da aba do navegador e do celular.
 */
export const ICON_SIZE = 512

export type IconShape = 'square' | 'rounded' | 'circle'

export interface IconOptions {
  /** Símbolo da marca, ou um arquivo enviado (data URL). */
  source: 'brand' | 'upload'
  upload?: string
  /** Cor de fundo em hex; sem ela, transparente. */
  background: string | null
  shape: IconShape
  /** Quanto do quadrado a imagem ocupa (0,4 a 1). */
  scale: number
}

export interface IconRender {
  image: string
  warnings: string[]
}

/** Qual arquivo do logo vai no ícone: o símbolo, na versão que contrasta com o fundo. */
function brandIconUrl(brand: Brand | null, background: string | null) {
  const logo = brand?.logo
  if (!logo) return { url: undefined, wide: false }
  const dark = background ? isDarkColor(background) : false
  const symbol = dark ? logo.symbolOnDark ?? logo.symbol : logo.symbol ?? logo.symbolOnDark
  if (symbol) return { url: symbol, wide: false }
  return { url: dark ? logo.onDark ?? logo.onLight : logo.onLight ?? logo.onDark, wide: true }
}

function shapePath(ctx: CanvasRenderingContext2D, shape: IconShape) {
  const s = ICON_SIZE
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
  else if (shape === 'rounded') ctx.roundRect(0, 0, s, s, s * 0.22)
  else ctx.rect(0, 0, s, s)
}

export async function renderIcon(options: IconOptions, brand: Brand | null): Promise<IconRender> {
  const warnings: string[] = []
  let url: string | undefined
  if (options.source === 'upload') {
    url = options.upload
    if (!url) warnings.push('Envie uma imagem, de preferência quadrada e com pelo menos 512 px.')
  } else {
    const pick = brandIconUrl(brand, options.background)
    url = pick.url
    if (!url) warnings.push('A marca do projeto não tem logo. Envie a imagem do ícone.')
    else if (pick.wide) warnings.push('A marca não tem símbolo: o logo inteiro fica pequeno no ícone. Coloque um símbolo na tela da Marca ou envie a imagem.')
  }

  const image = url
    ? await loadImage(url).catch(() => {
        warnings.push('A imagem não pôde entrar: o servidor dela não libera o uso em outro site. Envie o arquivo do computador.')
        return undefined
      })
    : undefined

  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('O navegador não conseguiu desenhar o ícone.')

  shapePath(ctx, options.shape)
  if (options.background) {
    ctx.fillStyle = options.background
    ctx.fill()
  }
  // A forma recorta a imagem também (círculo e cantos valem sem fundo)
  ctx.clip()

  if (image?.naturalWidth) {
    const box = ICON_SIZE * Math.min(1, Math.max(0.4, options.scale))
    const ratio = image.naturalWidth / image.naturalHeight
    const w = ratio >= 1 ? box : box * ratio
    const h = ratio >= 1 ? box / ratio : box
    ctx.drawImage(image, (ICON_SIZE - w) / 2, (ICON_SIZE - h) / 2, w, h)
  }

  return { image: canvas.toDataURL('image/png'), warnings }
}
