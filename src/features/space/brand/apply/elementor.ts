import { parseColor, type Rgba } from '../color'

/**
 * Leitura e escrita dos formatos de valor do Elementor, como o pack grava:
 * dims `{unit, top, right, bottom, left, isLinked}` com números em string,
 * sliders `{unit, size, sizes}` e variantes responsivas com sufixo.
 */

export type Settings = Record<string, unknown>

export const DEVICE_SUFFIXES = ['', '_tablet', '_mobile'] as const
export type DeviceSuffix = (typeof DEVICE_SUFFIXES)[number]

const SIDES = ['top', 'right', 'bottom', 'left'] as const
type Side = (typeof SIDES)[number]

export interface Dims {
  unit: string
  top: number
  right: number
  bottom: number
  left: number
}

export function readDims(value: unknown): Dims | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const n = (x: unknown) => (x === '' || x === undefined || x === null ? 0 : Number(x))
  const dims = { unit: String(v.unit || 'px'), top: n(v.top), right: n(v.right), bottom: n(v.bottom), left: n(v.left) }
  return SIDES.every((s) => Number.isFinite(dims[s])) ? dims : null
}

export function writeDims(d: Dims) {
  const str = (n: number) => String(+n.toFixed(2))
  return {
    unit: d.unit,
    top: str(d.top),
    right: str(d.right),
    bottom: str(d.bottom),
    left: str(d.left),
    isLinked: SIDES.every((s) => d[s] === d.top),
  }
}

/** "12px" / "1.5rem" / "50%" → valor e unidade do Elementor. */
export function cssLength(value: string): { size: number; unit: string } | null {
  const m = value.trim().match(/^(-?\d*\.?\d+)\s*(px|rem|em|%)?$/)
  if (!m) return null
  if (m[2] === 'rem' || m[2] === 'em') return { size: +m[1] * 16, unit: 'px' }
  return { size: +m[1], unit: m[2] || 'px' }
}

export const uniformDims = (size: number, unit = 'px') => writeDims({ unit, top: size, right: size, bottom: size, left: size })

/** Remove as variantes de tablet e mobile de uma chave, para o valor do desktop valer em todos. */
export function clearResponsive(s: Settings, key: string) {
  delete s[`${key}_tablet`]
  delete s[`${key}_mobile`]
}

/** Valor de slider num device, herdando do desktop como o Elementor. */
export function sliderAt(s: Settings, key: string, device: DeviceSuffix): { size: number; unit: string } | null {
  const order = device === '_mobile' ? ['_mobile', '_tablet', ''] : device === '_tablet' ? ['_tablet', ''] : ['']
  for (const d of order) {
    const v = s[`${key}${d}`] as Record<string, unknown> | undefined
    if (v && typeof v === 'object' && v.size !== '' && v.size !== undefined && v.size !== null) {
      const size = Number(v.size)
      if (Number.isFinite(size)) return { size, unit: String(v.unit || 'px') }
    }
  }
  return null
}

/** Tamanho da fonte em px num device (em/rem contam 16px; vw conta como grande). */
export function fontPx(s: Settings, group: string, device: DeviceSuffix = ''): number | undefined {
  const v = sliderAt(s, `${group}_font_size`, device)
  if (!v) return undefined
  if (v.unit === 'px') return v.size
  if (v.unit === 'em' || v.unit === 'rem') return v.size * 16
  if (v.unit === 'vw') return v.size * 14.4
  return undefined
}

export const slider = (size: number, unit = 'px') => ({ unit, size: +size.toFixed(3), sizes: [] })

/** Cor com transparência de um setting; null se não for cor. */
export const colorOf = (value: unknown): Rgba | null => parseColor(value)

/** Cor `top` sobre `bottom`, com a transparência de `top`. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 }
}

export const toCss = (c: Rgba) => (c.a >= 1 ? `#${[c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}` : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+c.a.toFixed(3)})`)

/** A mesma cor com outra transparência. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color)
  return c ? toCss({ ...c, a: alpha }) : color
}

// ---------------------------------------------------------------------------
// CSS da marca dentro do custom_css (Elementor Pro)

const BRAND_CSS = /\/\*se-brand(?::[\w-]+)?\*\/[\s\S]*?\/\*\/se-brand\*\//g

export type BrandRole = 'card' | 'pill'

/**
 * Escreve o CSS da marca num bloco marcado, trocando o bloco anterior. O CSS
 * que a seção já tinha fica como está, e reaplicar a marca não duplica nada.
 * `role` fica no marcador: um card cuja sombra a marca tirou continua card
 * se a marca for aplicada de novo.
 */
export function setBrandCss(s: Settings, css: string, role?: BrandRole) {
  const own = typeof s.custom_css === 'string' ? s.custom_css.replace(BRAND_CSS, '').trim() : ''
  const block = css || role ? `/*se-brand${role ? `:${role}` : ''}*/${css}/*/se-brand*/` : ''
  const next = [own, block].filter(Boolean).join('\n')
  if (next) s.custom_css = next
  else delete s.custom_css
}

/** Papel que uma aplicação anterior da marca registrou no elemento. */
export function brandRole(s: Settings): BrandRole | undefined {
  const m = typeof s.custom_css === 'string' ? s.custom_css.match(/\/\*se-brand:(card|pill)\*\//) : null
  return (m?.[1] as BrandRole | undefined) ?? undefined
}

export const isSet = (v: unknown) => v !== undefined && v !== null && v !== ''

export function sideCount(d: Dims | null): number {
  return d ? SIDES.filter((side: Side) => d[side] > 0).length : 0
}

/** Troca os cantos arredondados pelo raio da marca; cantos retos continuam retos, a menos que todos sejam. */
export function mapCorners(current: Dims | null, size: number, unit: string): Dims {
  if (!current || SIDES.every((s) => current[s] === 0)) return { unit, top: size, right: size, bottom: size, left: size }
  const pick = (side: Side) => (current[side] > 0 ? size : 0)
  return { unit, top: pick('top'), right: pick('right'), bottom: pick('bottom'), left: pick('left') }
}

/** Raio de círculo ou cápsula (avatar, pílula): fica como está. Canto de card quase nunca passa de 50px. */
export const isRound = (d: Dims | null) => !!d && ((d.unit === '%' && d.top >= 50) || (d.unit === 'px' && d.top >= 50))

export const stripTags = (html: unknown) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim()
