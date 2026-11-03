import type { Brand } from '@/features/space/brand/designMd'
import { parseColor, contrast, mix } from '@/features/space/brand/color'
import type { SetBrand } from './types'

/** A serifa dos destaques da Avence. Só entra quando a marca a pede no DESIGN.md. */
const AVENCE_SERIF = 'Instrument Serif'

const radiusPx = (css?: string) => {
  const n = css ? parseFloat(css) : NaN
  return Number.isFinite(n) ? n : undefined
}

/** A marca de um projeto do Space no tamanho que o conjunto precisa. */
export function setBrandFrom(brand: Brand | null, fallbackName: string): SetBrand {
  const heading = brand?.fonts.heading?.family ?? 'Inter'
  return {
    name: brand?.name || fallbackName,
    colors: brand?.colors.map((c) => ({ name: c.name, hex: c.hex })) ?? [],
    headingFont: heading,
    bodyFont: brand?.fonts.body?.family ?? heading,
    // O destaque em serifa itálica é da Avence: as outras marcas destacam na própria fonte, pela cor
    emphasisFont: brand?.guidelines.includes(AVENCE_SERIF) ? AVENCE_SERIF : heading,
    buttonRadius: radiusPx(brand?.radius.button) ?? 0,
    logoOnLight: brand?.logo?.onLight ?? brand?.logo?.symbol,
    logoOnDark: brand?.logo?.onDark ?? brand?.logo?.symbolOnDark,
    // Conjuntos novos já nascem na linguagem da direção criativa (26/10/2026)
    look: 'editorial',
  }
}

const lum = (hex: string) => {
  const c = parseColor(hex)
  return c ? 0.299 * c.r + 0.587 * c.g + 0.114 * c.b : 128
}
const sat = (hex: string) => {
  const c = parseColor(hex)
  if (!c) return 0
  const max = Math.max(c.r, c.g, c.b)
  const min = Math.min(c.r, c.g, c.b)
  return max === 0 ? 0 : (max - min) / max
}
const ratio = (a: string, b: string) => {
  const x = parseColor(a)
  const y = parseColor(b)
  return x && y ? contrast(x, y) : 21
}

export interface Palette {
  /** O mais escuro: fundo escuro e texto sobre o claro. */
  ink: string
  /** O mais claro: fundo claro e texto sobre o escuro. */
  paper: string
  /** O mais saturado: botão, destaque. */
  accent: string
  /** Texto sobre o destaque. */
  onAccent: string
  /** O destaque como texto sobre o papel (a marca pode ter um tom próprio, como o `accent-ink` da Sinfy). */
  accentOnLight: string
  /** O destaque como texto sobre a tinta. */
  accentOnDark: string
  /** Texto apagado sobre o papel. */
  muted: string
  /** Texto apagado sobre a tinta. */
  mutedOnDark: string
}

/**
 * Tinta, papel e destaque da marca. Primeiro pelos papéis do DESIGN.md (`primary`, `background`,
 * `accent`, `accent-ink`, `muted`…); sem eles, pela luz e saturação das cores. Sem marca, um
 * padrão cinza neutro: nunca as cores de outra marca.
 */
export function paletteOf(brand: SetBrand): Palette {
  const valid = brand.colors.filter((c) => parseColor(c.hex))
  const hexes = valid.map((c) => c.hex)
  const named = (...names: string[]) => names.map((n) => valid.find((c) => c.name.toLowerCase() === n)?.hex).find(Boolean)
  const byLum = [...hexes].sort((a, b) => lum(a) - lum(b))

  const namedInk = named('primary', 'ink', 'text', 'foreground')
  const ink = namedInk && lum(namedInk) < 110 ? namedInk : byLum[0] && lum(byLum[0]) < 110 ? byLum[0] : '#171717'
  const namedPaper = named('background', 'paper', 'canvas')
  const paper = namedPaper && lum(namedPaper) > 190 ? namedPaper : byLum.at(-1) && lum(byLum.at(-1)!) > 190 ? byLum.at(-1)! : '#f4f4f4'
  const accent = named('accent', 'brand', 'highlight') ?? [...hexes].filter((h) => h !== ink && h !== paper && sat(h) > 0.15).sort((a, b) => sat(b) - sat(a))[0] ?? ink
  const onAccent = named('on-accent') ?? (ratio(accent, '#ffffff') >= ratio(accent, ink) ? '#ffffff' : ink)
  const accentOnLight = named('accent-ink', 'accent-on-light') ?? (ratio(accent, paper) >= 3 ? accent : mix(accent, ink, 0.45))
  const accentOnDark = ratio(accent, ink) >= 3 ? accent : mix(accent, '#ffffff', 0.5)
  const muted = named('muted', 'text-muted') ?? mix(ink, paper, 0.45)
  const mutedOnDark = named('on-dark-muted') ?? mix(paper, ink, 0.4)
  return { ink, paper, accent, onAccent, accentOnLight, accentOnDark, muted, mutedOnDark }
}

/** Canto do botão desta marca, limitado à metade da altura (pílula). */
export const buttonRadiusOf = (brand: SetBrand, h: number) => Math.min(brand.buttonRadius ?? 0, h / 2)

/** Botão em pílula ou arredondado fala em frase normal; o quadrado em maiúsculas espaçadas. */
export const capsButton = (brand: SetBrand) => (brand.buttonRadius ?? 0) < 4
