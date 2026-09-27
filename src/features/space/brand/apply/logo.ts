import { LOGO_VARIANTS, type LogoVariant } from '../assets'
import { oklch, type Rgba } from '../color'
import type { Brand } from '../designMd'
import { slider, sliderAt, stripTags, type Settings } from './elementor'

/**
 * Logo da marca no lugar do logo do site (cabeçalho, rodapé, login, página
 * "em breve"). Logos de clientes e parceiros ficam como estão.
 *
 * A versão segue o fundo: a de fundo escuro onde a faixa é escura. O tamanho
 * segue o espaço que a seção reservou: um logo mais largo que o original fica
 * um pouco mais baixo, mas não tanto quanto se mantivesse a largura (meio
 * caminho entre manter a altura e manter a área). Se ficar baixo demais para
 * ler, entra o símbolo.
 */

interface Element {
  widgetType?: string
  settings?: Record<string, unknown> | unknown[]
  elements?: Element[]
}

/** Logos de site do pack, com o tamanho do arquivo. */
const PACK_SITE_LOGOS: [RegExp, number, number][] = [
  [/\/king-logo-(dark|light)\.png$/i, 187, 95],
  [/\/logo-new-black-2\.png$/i, 512, 105],
]

/** Logo de cliente, parceiro, selo ou forma de pagamento. */
const NOT_SITE_LOGO = /logo-container|logo-fix-size|clients?\b|clientes?|partners?|parceir|sponsors?|patrocin|selos?\b|badges?|payments?|pagamentos?|awards?|pr[eê]mios?/i

/** Menor altura em que o logo inteiro ainda se lê; abaixo disso vai o símbolo. */
const MIN_HEIGHT = 20
/** Proporção de um logo de site desconhecido. */
const DEFAULT_RATIO = 3
/** Proporção do logo da marca enquanto o arquivo não foi medido. */
const DEFAULT_BRAND_RATIO = 4
/** Altura de um logo sem largura definida nem tamanho conhecido. */
const DEFAULT_HEIGHT = 32

/** Palavras do nome do arquivo que dizem a cor do logo original: quem montou a seção viu o fundo real. */
const LIGHT_INK = new Set(['white', 'branco', 'branca', 'light', 'claro', 'clara', 'negativo', 'negative', 'reverse', 'reverso', 'inverse', 'inverted'])
const DARK_INK = new Set(['black', 'preto', 'preta', 'dark', 'escuro', 'escura'])

const imageOf = (s: Settings) => (s.image && typeof s.image === 'object' ? (s.image as Record<string, unknown>) : undefined)
const urlOf = (s: Settings) => String(imageOf(s)?.url ?? '')
const fileName = (url: string) => url.split(/[?#]/)[0].split('/').pop() ?? ''

const brandLogoUrls = (brand: Brand) => new Set(LOGO_VARIANTS.map((v) => brand.logo?.[v]).filter(Boolean) as string[])

/**
 * URLs que são o logo do site dentro de uma seção. Três ou mais logos
 * diferentes na mesma seção são uma faixa de clientes, não o logo do site
 * (os do pack e os da marca contam sempre).
 */
export function siteLogoUrls(section: Element, brand: Brand): Set<string> {
  const own = brandLogoUrls(brand)
  const known = new Set<string>()
  const others = new Set<string>()
  const walk = (el: Element) => {
    const s = el.settings && !Array.isArray(el.settings) ? (el.settings as Settings) : null
    if (s && el.widgetType === 'image') {
      const url = urlOf(s)
      const described = `${fileName(url)} ${imageOf(s)?.alt ?? ''} ${stripTags(s.caption)}`
      if (own.has(url) || PACK_SITE_LOGOS.some(([re]) => re.test(url))) known.add(url)
      else if (url && /logo/i.test(described) && !NOT_SITE_LOGO.test(described)) others.add(url)
    }
    el.elements?.forEach(walk)
  }
  walk(section)
  return others.size <= 2 ? new Set([...known, ...others]) : known
}

const pxOf = (v: { size: number; unit: string } | null) => (v && v.unit === 'px' && v.size > 0 ? v.size : undefined)

/**
 * Troca a imagem pelo logo da marca. A versão (fundo claro ou escuro) vem do
 * nome do arquivo original quando ele diz a cor do logo; senão, do fundo em
 * volta (`around`, já com a marca; null sobre foto). `parent`: settings do
 * container do logo. Devolve se trocou.
 */
export function applyLogo(s: Settings, brand: Brand, around: Rgba | null, parent: Settings | null): boolean {
  const logo = brand.logo
  const image = imageOf(s)
  if (!logo || !image) return false
  const url = urlOf(s)

  const variantOf = (u: string) => LOGO_VARIANTS.find((v) => logo[v] === u)
  const ratioOf = (v: LogoVariant | undefined) => (v && logo.ratios?.[v]) || (v?.startsWith('symbol') ? 1 : DEFAULT_BRAND_RATIO)
  const current = variantOf(url)

  const words = fileName(url).toLowerCase().split(/[^a-z0-9]+/)
  const ink = words.some((w) => LIGHT_INK.has(w)) ? 'light' : words.some((w) => DARK_INK.has(w)) ? 'dark' : undefined
  const dark = current
    ? current === 'onDark' || current === 'symbolOnDark'
    : ink
      ? ink === 'light'
      : around
        ? oklch(around).l < 0.6
        : true
  const full = dark ? (logo.onDark ?? logo.onLight) : (logo.onLight ?? logo.onDark)
  const symbol = dark ? (logo.symbolOnDark ?? logo.symbol) : (logo.symbol ?? logo.symbolOnDark)
  if (!full && !symbol) return false

  // Espaço que a seção deu ao logo original
  const pack = PACK_SITE_LOGOS.find(([re]) => re.test(url))
  const originalRatio = current ? ratioOf(current) : pack ? pack[1] / pack[2] : DEFAULT_RATIO
  const custom = s.image_size === 'custom' ? Number((s.image_custom_dimension as { width?: unknown } | undefined)?.width) || undefined : undefined
  const originalWidth = pxOf(sliderAt(s, 'width', '')) ?? custom
  const originalHeight = originalWidth ? originalWidth / originalRatio : pack ? pack[2] : DEFAULT_HEIGHT

  let chosen: string
  let height: number
  if (current) {
    // A marca já está aqui: mantém o tipo (logo ou símbolo) e o tamanho
    chosen = (current.startsWith('symbol') ? symbol : full) ?? (full ?? symbol)!
    height = originalHeight
  } else {
    const balanced = full ? Math.min(originalHeight * (originalRatio / ratioOf(variantOf(full))) ** 0.25, originalHeight * 1.25) : 0
    const useSymbol = !full || (balanced < MIN_HEIGHT && !!symbol)
    chosen = useSymbol ? symbol! : full!
    height = useSymbol ? originalHeight : balanced
  }
  const width = Math.round(height * ratioOf(variantOf(chosen)))

  s.image = { ...image, url: chosen, id: '', alt: logo.alt ?? brand.name }
  // Largura em CSS: o recorte `custom` do Elementor não vale para imagem por URL
  s.image_size = 'full'
  delete s.image_custom_dimension
  s.width = slider(width)
  for (const d of ['_tablet', '_mobile']) {
    const raw = s[`width${d}`] as { size?: unknown; unit?: unknown } | undefined
    const v = raw?.unit === 'px' && Number(raw.size) > 0 ? Number(raw.size) : undefined
    if (v && originalWidth) s[`width${d}`] = slider(Math.round((v * width) / originalWidth))
  }
  // Altura fixa deformaria um logo de outra proporção
  for (const d of ['', '_tablet', '_mobile']) {
    delete s[`height${d}`]
    delete s[`object-fit${d}`]
  }
  // Com `max-width: 100%`, a imagem é a primeira coisa a encolher numa linha flex (o container
  // do logo no cabeçalho vira um fiapo). Se o container não tem largura própria, o logo
  // segura a largura; no celular volta a caber na coluna.
  const parentWidth = parent && (parent.width as { size?: unknown } | undefined)?.size
  if ((parentWidth === undefined || parentWidth === '') && !sliderAt(s, 'space', '')) {
    s.space = slider(width)
    s.space_mobile = slider(100, '%')
  }
  return true
}
