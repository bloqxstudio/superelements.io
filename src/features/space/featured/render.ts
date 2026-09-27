import { googleFontsUrl } from '@/engine/elementor'
import type { FeaturedFields } from '@/types/space'
import { oklch, parseColor } from '../brand/color'
import type { Brand } from '../brand/designMd'
import { FEATURED_HEIGHT, FEATURED_WIDTH, featuredTemplate, type TemplateInput } from './templates'

/** Cores do modelo a partir da marca: as opções de fundo, o fundo padrão e o destaque. */
export function featuredPalette(brand: Brand | null) {
  const colors = [...new Set((brand?.colors ?? []).map((c) => c.hex.toUpperCase()))]
  if (!colors.length) return { colors: ['#111827', '#FFFFFF', '#2563EB'], background: '#111827', accent: '#2563EB' }
  const byName = (...names: string[]) => brand?.colors.find((c) => names.includes(c.name.toLowerCase()))?.hex.toUpperCase()
  const lightness = (hex: string) => oklch(parseColor(hex)!).l
  const chroma = (hex: string) => oklch(parseColor(hex)!).c
  const darkest = colors.reduce((a, b) => (lightness(a) <= lightness(b) ? a : b))
  const background = byName('primary') ?? darkest
  const vivid = colors.filter((c) => c !== background).sort((a, b) => chroma(b) - chroma(a))[0]
  return { colors, background, accent: byName('accent', 'secondary') ?? vivid ?? background }
}

export const isDarkColor = (hex: string) => {
  const color = parseColor(hex)
  return !!color && oklch(color).l < 0.62
}

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    // Imagem de outro endereço só entra no canvas exportável se o servidor dela liberar (CORS)
    if (!/^(data|blob):/.test(src)) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(src))
    image.src = src
  })

const stylesheets = new Map<string, Promise<void>>()

/** Carrega a fonte do Google Fonts na página, para o canvas desenhar com ela. */
async function ensureFont(family: string, weight: string | number) {
  const href = googleFontsUrl([family])
  if (href && !stylesheets.has(href)) {
    stylesheets.set(
      href,
      new Promise<void>((resolve) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        link.onload = link.onerror = () => resolve()
        document.head.appendChild(link)
        // Sem resposta, segue com a fonte do sistema
        setTimeout(resolve, 4000)
      })
    )
  }
  if (href) await stylesheets.get(href)
  await document.fonts.load(`${weight} 48px "${family}"`).catch(() => undefined)
}

export interface FeaturedRender {
  /** JPEG 1200×630 em data URL. */
  image: string
  warnings: string[]
}

/** Monta a imagem destacada com o modelo, os campos e a marca. */
export async function renderFeatured(templateId: string, fields: FeaturedFields, brand: Brand | null): Promise<FeaturedRender> {
  const template = featuredTemplate(templateId)
  const palette = featuredPalette(brand)
  const background = fields.color ?? palette.background
  const headingFont = brand?.fonts.heading?.family ?? brand?.fonts.body?.family ?? 'Inter'
  const headingWeight = brand?.fonts.heading?.weight ?? 700
  const bodyFont = brand?.fonts.body?.family ?? headingFont
  const warnings: string[] = []

  await Promise.all([ensureFont(headingFont, headingWeight), ensureFont(bodyFont, 400)])

  let photo: HTMLImageElement | undefined
  if (template.photo && fields.photo) {
    photo = await loadImage(fields.photo).catch(() => {
      warnings.push('A foto não pôde entrar: o servidor dela não libera o uso em outro site. Envie o arquivo do computador.')
      return undefined
    })
  } else if (template.photo) warnings.push('Este modelo usa uma foto: escolha uma.')

  const logos = new Map<string, HTMLImageElement>()
  const logo = brand?.logo
  if (fields.logo && logo) {
    const wanted = [logo.onLight ?? logo.symbol, logo.onDark ?? logo.symbolOnDark].filter((u): u is string => !!u)
    let failed = false
    await Promise.all(
      [...new Set(wanted)].map((url) =>
        loadImage(url).then(
          (image) => logos.set(url, image),
          () => (failed = true)
        )
      )
    )
    if (failed) warnings.push('O logo não pôde entrar: o servidor dele não libera o uso em outro site. Envie o logo do computador na tela da Marca.')
  } else if (fields.logo) warnings.push('A marca do projeto não tem logo.')

  const pick = (...urls: (string | undefined)[]) => urls.map((u) => (u ? logos.get(u) : undefined)).find(Boolean)
  const input: TemplateInput = {
    title: fields.title,
    subtitle: fields.subtitle,
    photo,
    logoFor: (dark) =>
      !fields.logo || !logo
        ? undefined
        : dark
          ? pick(logo.onDark, logo.symbolOnDark, logo.onLight, logo.symbol)
          : pick(logo.onLight, logo.symbol, logo.onDark, logo.symbolOnDark),
    background,
    backgroundDark: isDarkColor(background),
    accent: palette.accent === background ? (isDarkColor(background) ? '#FFFFFF' : '#111111') : palette.accent,
    headingFont,
    headingWeight,
    bodyFont,
  }

  const canvas = document.createElement('canvas')
  canvas.width = FEATURED_WIDTH
  canvas.height = FEATURED_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('O navegador não conseguiu desenhar a imagem.')
  template.draw(ctx, input)
  return { image: canvas.toDataURL('image/jpeg', 0.9), warnings }
}

/** Imagem do computador em data URL, reduzida para no máximo `maxWidth` de largura (o projeto guarda a imagem). */
export async function readImageFile(file: File, maxWidth = 1600): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('O arquivo não é uma imagem.')
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const scale = Math.min(1, maxWidth / image.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('O navegador não conseguiu ler a imagem.')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    // PNG com transparência (logo, recorte) continua PNG; foto vira JPEG, bem menor
    return file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88)
  } catch (error) {
    throw error instanceof Error && error.message !== url ? error : new Error('O navegador não conseguiu abrir essa imagem.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
