/** Cores em hex ou rgba(), com as contas de luminosidade e contraste que a marca usa. */

export interface Rgba {
  /** 0–255 */
  r: number
  g: number
  b: number
  /** 0–1 */
  a: number
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGBA = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i

export function parseColor(value: unknown): Rgba | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  const hex = v.match(HEX)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex
    const byte = (i: number) => parseInt(full.slice(i, i + 2), 16)
    return { r: byte(0), g: byte(2), b: byte(4), a: full.length === 8 ? byte(6) / 255 : 1 }
  }
  const m = v.match(RGBA)
  if (!m) return null
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return { r: +m[1], g: +m[2], b: +m[3], a }
}

const toHexString = ({ r, g, b }: Pick<Rgba, 'r' | 'g' | 'b'>) => {
  const h = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Hex de 6 dígitos em minúsculas, ou null se não for uma cor. */
export function normalizeHex(value: unknown): string | null {
  const c = parseColor(value)
  if (!c || !String(value).trim().startsWith('#')) return null
  return toHexString(c)
}

const num = (v: string) => parseFloat(v)
// "50%" → 0.5 de `scale`; "0.5" → 0.5
const part = (v: string, scale: number) => (v.endsWith('%') ? (num(v) / 100) * scale : num(v))

function hslToRgb(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 }
}

function oklchToRgb(L: number, C: number, H: number) {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const gamma = (x: number) => 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055)
  return {
    r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  }
}

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000', branco: '#ffffff', preto: '#000000' }

/**
 * Cor escrita de qualquer jeito comum em CSS e em arquivos de tokens (hex,
 * rgb(), hsl(), oklch() ou o "H S% L%" das variáveis do shadcn) em #rrggbb.
 */
export function toHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().replace(/^["'`]|["'`]$/g, '').trim()
  if (NAMED[v.toLowerCase()]) return NAMED[v.toLowerCase()]
  if (v.startsWith('#')) return normalizeHex(v)

  const fn = v.match(/^(rgba?|hsla?|oklch)\(\s*([^)]*)\)$/i)
  // "222.2 47.4% 11.2%" (shadcn) é um hsl sem o nome da função
  const bare = !fn && v.match(/^(-?[\d.]+)(?:deg)?\s+([\d.]+%)\s+([\d.]+%)$/)
  const kind = fn ? fn[1].toLowerCase().replace(/a$/, '') : bare ? 'hsl' : null
  const args = fn ? fn[2].split(/[\s,/]+/).filter(Boolean) : bare ? bare.slice(1, 4) : []
  if (!kind || args.length < 3) return null

  if (kind === 'rgb') return toHexString({ r: part(args[0], 255), g: part(args[1], 255), b: part(args[2], 255) })
  if (kind === 'hsl') return toHexString(hslToRgb(num(args[0]), part(args[1], 1) / (args[1].endsWith('%') ? 1 : 100), part(args[2], 1) / (args[2].endsWith('%') ? 1 : 100)))
  return toHexString(oklchToRgb(part(args[0], 1), part(args[1], 0.4), num(args[2])))
}

/**
 * Troca a cor de `original` por `hex`, mantendo a transparência e o formato
 * (hex continua hex, rgba continua rgba).
 */
export function recolor(original: string, hex: string): string {
  const source = parseColor(original)
  const target = parseColor(hex)
  if (!source || !target) return original
  if (original.trim().startsWith('#')) {
    if (source.a === 1) return hex
    return hex + Math.round(source.a * 255).toString(16).padStart(2, '0')
  }
  return `rgba(${target.r}, ${target.g}, ${target.b}, ${+source.a.toFixed(3)})`
}

const linear = (channel: number) => {
  const x = channel / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

/** Luminosidade (0–1) e croma do OKLCH: o quanto a cor é clara e o quanto é viva. */
export function oklch({ r, g, b }: Rgba): { l: number; c: number } {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(A, B) }
}

/** Mistura `a` com `b` (t = 0 → a, t = 1 → b), em hex. */
export function mix(a: string, b: string, t: number): string {
  const x = parseColor(a)
  const y = parseColor(b)
  if (!x || !y) return a
  return toHexString({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t })
}

/** Um passo mais escuro (cor clara) ou mais claro (cor escura): o estado de hover de um fundo. */
export function hoverShade(color: string): string {
  const c = parseColor(color)
  if (!c) return color
  return oklch(c).l > 0.6 ? mix(color, '#000000', 0.12) : mix(color, '#ffffff', 0.14)
}

const luminance = ({ r, g, b }: Rgba) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)

/** Razão de contraste do WCAG (1–21), ignorando a transparência. */
export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
