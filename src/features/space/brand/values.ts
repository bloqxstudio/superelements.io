import { parseColor, toHex } from './color'

/**
 * Leitura de valores soltos de um guia de marca: medidas, pesos, caixa,
 * espaçamento, sombra, borda e movimento, escritos em CSS, em tokens ou em
 * frases ("1px dashed line in Cork Border (#40372e)").
 */

export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize'
export type StrokeStyle = 'solid' | 'dashed' | 'dotted' | 'double'

export interface Stroke {
  /** px */
  width: number
  style: StrokeStyle
  /** #rrggbb, ou rgba() quando a borda é translúcida */
  color?: string
}

export interface Shadow {
  x: number
  y: number
  blur: number
  spread: number
  /** Cor em CSS (hex ou rgba). */
  color: string
  inset?: boolean
}

/** Entradas que o Space sabe aplicar; viram animações do Elementor. */
export type Entrance = 'none' | 'fade' | 'fade-up' | 'fade-down' | 'slide-up' | 'zoom'
export type HoverEffect = 'none' | 'lift' | 'grow'

const WEIGHT_WORDS: [RegExp, number][] = [
  [/\b(thin|hairline)\b/i, 100],
  [/\bextra[\s-]?light\b/i, 200],
  [/\b(light|leves?)\b/i, 300],
  [/\b(regular|regulares|normal|book)\b/i, 400],
  [/\b(medium|m[eé]di[oa]s?)\b/i, 500],
  [/\b(semi[\s-]?bold|demi[\s-]?bold)\b/i, 600],
  [/\b(extra[\s-]?bold|heavy|pesad[oa]s?)\b/i, 800],
  [/\b(black)\b/i, 900],
  [/\b(bold|negrito)\b/i, 700],
]

export function parseWeight(value: unknown): number | undefined {
  if (typeof value === 'number') return value >= 100 && value <= 1000 ? value : undefined
  if (typeof value !== 'string') return undefined
  const n = value.match(/\b([1-9]00)\b/)
  if (n) return +n[1]
  return WEIGHT_WORDS.find(([re]) => re.test(value))?.[1]
}

/** Comprimento de CSS para canto: "11.52px", "20–28px" (média), "cápsula" → 9999px. */
export function parseLength(value: unknown): string | undefined {
  if (typeof value === 'number') return `${value}px`
  if (typeof value !== 'string') return undefined
  if (/c[aá]psula|capsule|pill|full|totalmente arredondad|redond/i.test(value)) return '9999px'
  const range = value.match(/(\d+(?:\.\d+)?)\s*(?:–|—|-|to|a|até)\s*(\d+(?:\.\d+)?)\s*(px|rem|em)/)
  if (range) return `${+((+range[1] + +range[2]) / 2).toFixed(2)}${range[3]}`
  const single = value.match(/(\d+(?:\.\d+)?)\s*(px|rem|em|%)/)
  if (single) return `${single[1]}${single[2]}`
  return /^\s*\d+(\.\d+)?\s*$/.test(value) ? `${value.trim()}px` : undefined
}

/** Comprimento em px (rem/em contam 16px). */
export function lengthPx(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const m = value.match(/(-?\d*\.?\d+)\s*(px|rem|em)?/)
  if (!m) return undefined
  return m[2] === 'rem' || m[2] === 'em' ? +m[1] * 16 : +m[1]
}

export function parseTransform(value: unknown): TextTransform | undefined {
  if (typeof value !== 'string') return undefined
  if (/\b(uppercase|all[- ]caps|caixa[- ]alta|versal|versais|mai[uú]sculas)\b/i.test(value)) return 'uppercase'
  if (/\b(lowercase|caixa[- ]baixa|min[uú]sculas)\b/i.test(value)) return 'lowercase'
  if (/\b(capitalize|title[- ]case)\b/i.test(value)) return 'capitalize'
  if (/\b(none|normal|sentence[- ]case|mixed[- ]case|frase comum)\b/i.test(value)) return 'none'
  return undefined
}

/**
 * Espaçamento de letra em em. "0.15em" → 0.15; "-2px" num texto de 48px → -0.042;
 * "-2%" (Figma) → -0.02; "normal" → 0. Sem tamanho, px conta sobre 16px.
 */
export function parseLetterSpacing(value: unknown, fontSizePx?: number): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  if (/^(normal|none|0)$/i.test(v) || /^0\s*(px|em|rem|%)?$/.test(v)) return 0
  // Número solto num texto é ambíguo (px? em?): só vale com unidade
  const m = v.match(/^(-?\d*\.?\d+)\s*(em|rem|px|%)$/)
  if (!m) return undefined
  const n = +m[1]
  if (m[2] === 'px') return +(n / (fontSizePx || 16)).toFixed(4)
  if (m[2] === '%') return +(n / 100).toFixed(4)
  return n
}

/** Entrelinha como proporção. "1.05" → 1.05; "120%" → 1.2; "24px" num texto de 16px → 1.5. */
export function parseLineHeight(value: unknown, fontSizePx?: number): number | undefined {
  if (typeof value === 'number') return value > 0 && value < 4 ? value : undefined
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  const m = v.match(/^(\d*\.?\d+)\s*(%|px|em)?$/)
  if (!m) return undefined
  const n = +m[1]
  if (m[2] === '%') return +(n / 100).toFixed(3)
  if (m[2] === 'px') return fontSizePx ? +(n / fontSizePx).toFixed(3) : undefined
  return n > 0 && n < 4 ? n : undefined
}

const SHADOW_COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/i

/** Primeira camada de um box-shadow de CSS, ou um token de sombra (W3C). "none" vira 'none'. */
export function parseShadow(value: unknown): Shadow | 'none' | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>
    const n = (x: unknown) => lengthPx(x) ?? 0
    const color = typeof v.color === 'string' ? v.color : 'rgba(0,0,0,0.15)'
    return { x: n(v.offsetX ?? v.x), y: n(v.offsetY ?? v.y), blur: n(v.blur), spread: n(v.spread), color, inset: v.inset === true }
  }
  if (Array.isArray(value)) return parseShadow(value[0])
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  if (/^(none|0|no shadow|sem sombra)$/i.test(v)) return 'none'
  const first = v.split(/,(?![^(]*\))/)[0]
  const color = first.match(SHADOW_COLOR)?.[0]
  const lengths = first.replace(SHADOW_COLOR, ' ').match(/-?\d*\.?\d+(px)?/g)
  if (!lengths || lengths.length < 2) return undefined
  const [x, y, blur = 0, spread = 0] = lengths.map((l) => parseFloat(l))
  return { x, y, blur, spread, color: color ?? 'rgba(0,0,0,0.15)', inset: /\binset\b/.test(first) }
}

export const shadowCss = (s: Shadow) => `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`

/**
 * Borda: "1px dashed #40372e", "1.5px solid", "1px dashed line in Cork Border
 * (#40372e)". `color` resolve nomes de cor do próprio guia.
 */
export function parseStroke(value: unknown, color?: (text: string) => string | undefined): Stroke | 'none' | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  if (/^(none|0|no border|sem borda)$/i.test(v)) return 'none'
  const width = v.match(/(\d*\.?\d+)\s*px/)
  const style = v.match(/\b(solid|dashed|dotted|double|s[oó]lid[ao]|tracejad[ao]|pontilhad[ao])\b/i)?.[1].toLowerCase()
  if (!width && !style) return undefined
  const normalized = style?.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const styles: Record<string, StrokeStyle> = { solida: 'solid', solido: 'solid', tracejada: 'dashed', tracejado: 'dashed', pontilhada: 'dotted', pontilhado: 'dotted' }
  // Borda translúcida ("rgba(40,14,89,.15)") fica como está: em hex viraria uma linha forte
  const literal = v.match(SHADOW_COLOR)?.[0]
  const translucent = literal && (parseColor(literal)?.a ?? 1) < 1 ? literal.replace(/\s+/g, '') : undefined
  return {
    width: width ? +width[1] : 1,
    style: normalized ? (styles[normalized] ?? (normalized as StrokeStyle)) : 'solid',
    color: translucent ?? color?.(v) ?? toHex(literal ?? '') ?? undefined,
  }
}

export const strokeCss = (s: Stroke) => `${s.width}px ${s.style}${s.color ? ` ${s.color}` : ''}`

/** Duração em ms: "600ms", "0.3s", "300". */
export function parseDuration(value: unknown): number | undefined {
  if (typeof value === 'number') return value > 0 && value < 10 ? value * 1000 : value
  if (typeof value !== 'string') return undefined
  const m = value.match(/(\d*\.?\d+)\s*(ms|s)\b/i) ?? value.match(/^\s*(\d+)\s*$/)
  if (!m) return undefined
  return m[2]?.toLowerCase() === 's' ? Math.round(+m[1] * 1000) : Math.round(+m[1])
}

/** Easing de CSS: cubic-bezier() ou palavra-chave; tokens W3C trazem [x1, y1, x2, y2]. */
export function parseEasing(value: unknown): string | undefined {
  if (Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === 'number')) return `cubic-bezier(${value.join(', ')})`
  if (typeof value !== 'string') return undefined
  // A primeira curva citada: "`ease` e `ease-in-out` na maioria; cubic-bezier(...) no mega menu" → ease
  const bezier = value.match(/cubic-bezier\(\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*\)/i)
  const keyword = value.match(/(?<![\w-])(ease-in-out|ease-out|ease-in|linear|ease)(?![\w-])/i)
  if (bezier && (!keyword || (bezier.index ?? 0) < (keyword.index ?? 0))) return bezier[0].replace(/\s+/g, ' ')
  return keyword?.[1].toLowerCase()
}

export function parseEntrance(value: unknown): Entrance | undefined {
  if (typeof value !== 'string') return undefined
  if (/\b(none|no (entrance )?(motion|animation)|sem (movimento|anima[cç][aã]o)|static|est[aá]tic[ao])\b/i.test(value)) return 'none'
  if (/fade[- ]?(in[- ]?)?up|rise|rising|sobe|subindo|de baixo para cima|translatey\(\s*\d/i.test(value)) return 'fade-up'
  if (/fade[- ]?(in[- ]?)?down|de cima para baixo/i.test(value)) return 'fade-down'
  if (/slide[- ]?(in[- ]?)?up|desliza/i.test(value)) return 'slide-up'
  if (/zoom|scale[- ]?(in|up)|cresce/i.test(value)) return 'zoom'
  if (/fade|opacity|opacidade|dissolve|surge|aparece/i.test(value)) return 'fade'
  return undefined
}

export function parseHover(value: unknown): HoverEffect | undefined {
  if (typeof value !== 'string') return undefined
  if (/\b(lift|raise|elevat\w*|levanta\w*|sobe|translatey\(\s*-)/i.test(value)) return 'lift'
  if (/\b(grow|scale|aumenta\w*|cresce\w*)\b/i.test(value)) return 'grow'
  if (/\b(none|no hover|sem hover)\b/i.test(value)) return 'none'
  return undefined
}
