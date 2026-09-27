import { parseColor } from '../brand/color'
import { readDims } from '../brand/apply/elementor'
import { elementLabel, pairElements, settingsOf, type LevelElement } from './elements'

/**
 * O que a marca muda numa seção, camada por camada, lido da diferença entre
 * a seção sem a marca e com ela. Como a marca é aplicada por código, a
 * diferença é exatamente o que vai para o Elementor.
 */

export type DiffLevel = 'colors' | 'typography' | 'shape'

export interface PropChange {
  prop: string
  before: string
  after: string
}

export interface ElementDiff {
  id: string
  label: string
  changes: PropChange[]
}

export interface ColorSwap {
  from: string | null
  to: string
  count: number
}

/**
 * Chave → camada e nome da propriedade. A primeira regra que casa vence.
 * A margem que a tipografia ajusta junto com a entrelinha fica de fora: ela só
 * mantém o espaço visual igual.
 */
const PROPS: [RegExp, Exclude<DiffLevel, 'colors'>, string][] = [
  [/_font_family$/, 'typography', 'fonte'],
  [/_font_weight$/, 'typography', 'peso'],
  [/_text_transform$/, 'typography', 'caixa'],
  [/_letter_spacing$/, 'typography', 'espaçamento'],
  [/_line_height$/, 'typography', 'entrelinha'],
  [/radius$/, 'shape', 'canto'],
  [/border_width$/, 'shape', 'espessura da borda'],
  [/_border$/, 'shape', 'borda'],
  [/box_shadow_type$|box_shadow$/, 'shape', 'sombra'],
  [/^css_filters_brightness$/, 'shape', 'brilho'],
  [/^css_filters_contrast$/, 'shape', 'contraste'],
  [/^css_filters_saturate$/, 'shape', 'saturação'],
  [/^css_filters_hue$/, 'shape', 'matiz'],
  [/^css_filters_blur$/, 'shape', 'desfoque'],
  [/^(divider_)?(style|weight)$/, 'shape', 'filete'],
]

const TRANSFORM: Record<string, string> = { uppercase: 'caixa alta', lowercase: 'caixa baixa', capitalize: 'iniciais maiúsculas', none: 'normal' }
const BORDER: Record<string, string> = { solid: 'sólida', dashed: 'tracejada', dotted: 'pontilhada', double: 'dupla', none: 'sem borda' }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Sem as cores: sombra que só trocou de cor é mudança de cor, não de forma. */
const withoutColors = (v: unknown) =>
  JSON.stringify(isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => !/color/i.test(k))) : v)

function format(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (/_text_transform$/.test(key)) return TRANSFORM[String(value)] ?? String(value)
  if (/_border$/.test(key) || /style$/.test(key)) return BORDER[String(value)] ?? String(value)
  if (/box_shadow_type$/.test(key)) return value === 'yes' ? 'com sombra' : 'sem sombra'
  if (isObj(value)) {
    if (/^css_filters_/.test(key) && 'size' in value) return `${value.size}${key.endsWith('hue') ? '°' : key.endsWith('blur') ? 'px' : '%'}`
    if ('size' in value) return value.size === '' ? '—' : `${value.size}${value.unit ?? ''}`
    const dims = readDims(value)
    if (dims && 'top' in value) {
      const sides = [dims.top, dims.right, dims.bottom, dims.left]
      return sides.every((n) => n === dims.top) ? `${dims.top}${dims.unit}` : `${sides.join(' ')}${dims.unit}`
    }
    if ('blur' in value) return `${value.horizontal ?? 0} ${value.vertical ?? 0} ${value.blur ?? 0}px`
    return 'ajustado'
  }
  return String(value)
}

/** Chaves de tablet e mobile acompanham o desktop; o painel mostra só o desktop. */
const RESPONSIVE = /_(tablet|mobile)$/

export function elementDiffs(before: LevelElement[], after: LevelElement[], level: Exclude<DiffLevel, 'colors'>): ElementDiff[] {
  const out: ElementDiff[] = []
  pairElements(before, after, (b, a) => {
    const sb = settingsOf(b) ?? {}
    const sa = settingsOf(a) ?? {}
    const seen = new Map<string, PropChange>()
    for (const key of new Set([...Object.keys(sb), ...Object.keys(sa)])) {
      if (RESPONSIVE.test(key) || key === 'custom_css' || key === '__globals__') continue
      const rule = PROPS.find(([re]) => re.test(key))
      if (!rule || rule[1] !== level) continue
      if (withoutColors(sb[key]) === withoutColors(sa[key])) continue
      const change = { prop: rule[2], before: format(key, sb[key]), after: format(key, sa[key]) }
      if (change.before !== change.after) seen.set(`${change.prop}|${change.before}|${change.after}`, change)
    }
    if (seen.size) out.push({ id: String(a.id ?? ''), label: elementLabel(a), changes: [...seen.values()] })
  })
  return out
}

/** Texto do marcador no canvas: a fonte nova, ou a primeira propriedade que muda. */
export function diffTag(diff: ElementDiff): string {
  const font = diff.changes.find((c) => c.prop === 'fonte')
  const weight = diff.changes.find((c) => c.prop === 'peso')
  if (font) return weight ? `${font.after} ${weight.after}` : font.after
  const first = diff.changes[0]
  const more = diff.changes.length > 1 ? ` +${diff.changes.length - 1}` : ''
  return `${first.prop} ${first.after}${more}`
}

const normalize = (value: string) => value.trim().toLowerCase()

function collectSwaps(before: unknown, after: unknown, key: string, out: Map<string, ColorSwap>) {
  if (isObj(after)) {
    const b = isObj(before) ? before : {}
    for (const k of Object.keys(after)) if (k !== '__globals__') collectSwaps(b[k], after[k], k, out)
    return
  }
  if (typeof after !== 'string' || !/color/i.test(key) || !parseColor(after)) return
  const from = typeof before === 'string' && parseColor(before) ? normalize(before) : null
  const to = normalize(after)
  if (from === to) return
  const id = `${from}>${to}`
  const swap = out.get(id)
  if (swap) swap.count++
  else out.set(id, { from, to, count: 1 })
}

/** Trocas de cor da seção, agrupadas: "#ffffff → #f3f0e9 (12×)". */
export function colorSwaps(before: LevelElement[], after: LevelElement[]): ColorSwap[] {
  const out = new Map<string, ColorSwap>()
  pairElements(before, after, (b, a) => {
    const sb = settingsOf(b) ?? {}
    const sa = settingsOf(a) ?? {}
    for (const key of Object.keys(sa)) if (!RESPONSIVE.test(key)) collectSwaps(sb[key], sa[key], key, out)
  })
  return [...out.values()].sort((x, y) => y.count - x.count)
}
