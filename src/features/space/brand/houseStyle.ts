import { isPackSection } from '@/features/section-pack/categories'
import type { SectionNodeData, SpaceNode } from '@/types/space'
import { textKind, typographyGroups } from './apply/classify'
import { fontPx, isSet, sliderAt, type Settings } from './apply/elementor'
import { hash, type Brand, type BrandFont } from './designMd'
import type { TextTransform } from './values'

/**
 * Estilo da casa: como as páginas do próprio projeto tratam títulos e textos
 * (peso, caixa, espaçamento de letra e entrelinha). Uma marca que só diz a
 * família da fonte deixa as seções do pack com o tratamento delas, feito para
 * a Manrope: a Syne da MSA saía em 800, minúscula e apertada. Nas seções do
 * pack, o que o guia não diz vem das páginas do projeto. As seções do projeto
 * não recebem nada disso, porque elas são o estilo.
 */

type Role = 'heading' | 'body'
type Treatment = Omit<BrandFont, 'family'>
export type HouseStyle = Partial<Record<Role, Treatment>>

interface Sample {
  role: Role
  /** Vazio quando o texto herda a fonte do kit. */
  family: string
  weight?: number
  transform: TextTransform
  /** em */
  letter: number
  /** Proporção do tamanho da fonte. */
  line?: number
  size: number
}

interface Element {
  widgetType?: string
  settings?: Record<string, unknown> | unknown[]
  elements?: Element[]
}

/** Abaixo disso o papel não tem amostra suficiente para virar estilo. */
const MIN_SAMPLES = 3

const TRANSFORMS = new Set<TextTransform>(['none', 'uppercase', 'lowercase', 'capitalize'])

function sampleOf(s: Settings, group: string, role: Role): Sample | null {
  const size = fontPx(s, group)
  if (!size) return null
  const weight = Number(s[`${group}_font_weight`])
  const transform = String(s[`${group}_text_transform`] || 'none') as TextTransform
  const tracking = sliderAt(s, `${group}_letter_spacing`, '')
  const letter = !tracking ? 0 : tracking.unit === 'px' ? tracking.size / size : tracking.unit === 'em' ? tracking.size : NaN
  const leading = sliderAt(s, `${group}_line_height`, '')
  const line = !leading ? undefined : leading.unit === 'px' ? leading.size / size : leading.unit === 'em' || leading.unit === '' ? leading.size : undefined
  if (!Number.isFinite(letter)) return null
  return {
    role,
    family: isSet(s[`${group}_font_family`]) ? String(s[`${group}_font_family`]) : '',
    weight: Number.isFinite(weight) && weight > 0 ? weight : undefined,
    transform: TRANSFORMS.has(transform) ? transform : 'none',
    letter,
    line,
    size,
  }
}

function collect(elements: Element[], out: Sample[]) {
  for (const el of elements) {
    const s = el.settings && !Array.isArray(el.settings) ? (el.settings as Settings) : null
    if (s && el.widgetType) {
      for (const group of typographyGroups(s)) {
        const kind = textKind(el.widgetType, group, s)
        if (kind !== 'heading' && kind !== 'body') continue
        const sample = sampleOf(s, group, kind)
        if (sample) out.push(sample)
      }
    }
    if (el.elements?.length) collect(el.elements, out)
  }
  return out
}

// Amostras por JSON de seção: arrastar no canvas troca a lista de nós, não as seções
const samplesByJson = new Map<string, Sample[]>()

function sectionSamples(json: string): Sample[] {
  const cached = samplesByJson.get(json)
  if (cached) return cached
  let samples: Sample[] = []
  try {
    const data = JSON.parse(json)
    const elements = Array.isArray(data) ? data : data?.content ?? data?.elements
    if (Array.isArray(elements)) samples = collect(elements, [])
  } catch {
    // JSON inválido não entra no estilo
  }
  if (samplesByJson.size > 400) samplesByJson.clear()
  samplesByJson.set(json, samples)
  return samples
}

/** Valor que pesa mais, com o tamanho da fonte como peso: o título grande diz mais que o pequeno. */
function weightedMode<T>(samples: Sample[], pick: (s: Sample) => T | undefined): T | undefined {
  const totals = new Map<T, number>()
  for (const s of samples) {
    const v = pick(s)
    if (v !== undefined) totals.set(v, (totals.get(v) ?? 0) + s.size)
  }
  let best: T | undefined
  for (const [v, total] of totals) if (best === undefined || total > totals.get(best)!) best = v
  return best
}

function weightedMedian(samples: Sample[], pick: (s: Sample) => number | undefined): number | undefined {
  const values = samples.flatMap((s) => {
    const v = pick(s)
    return v === undefined ? [] : [{ v, w: s.size }]
  })
  if (!values.length) return undefined
  values.sort((a, b) => a.v - b.v)
  const half = values.reduce((sum, x) => sum + x.w, 0) / 2
  let acc = 0
  for (const x of values) {
    acc += x.w
    if (acc >= half) return x.v
  }
  return values[values.length - 1].v
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function treatment(samples: Sample[]): Treatment | undefined {
  if (samples.length < MIN_SAMPLES) return undefined
  const letter = weightedMedian(samples, (s) => s.letter)
  const line = weightedMedian(samples, (s) => s.line)
  return {
    weight: weightedMode(samples, (s) => s.weight),
    transform: weightedMode(samples, (s) => s.transform),
    letterSpacing: letter === undefined ? undefined : +letter.toFixed(3),
    lineHeight: line === undefined ? undefined : +line.toFixed(2),
  }
}

const styleCache = new WeakMap<SpaceNode[], Map<string, HouseStyle | null>>()

/**
 * Estilo das seções que são do projeto (modelos, importadas do site, feitas à
 * mão), só dos textos na fonte que a marca dá para cada papel. Null quando o
 * projeto ainda não tem páginas próprias.
 */
export function projectHouseStyle(nodes: SpaceNode[], brand: Brand): HouseStyle | null {
  const families = { heading: brand.fonts.heading?.family, body: brand.fonts.body?.family }
  const familiesKey = `${families.heading ?? ''}|${families.body ?? ''}`
  const byFamilies = styleCache.get(nodes) ?? new Map<string, HouseStyle | null>()
  styleCache.set(nodes, byFamilies)
  if (byFamilies.has(familiesKey)) return byFamilies.get(familiesKey)!

  const samples = nodes.flatMap((n) => {
    if (n.type !== 'section') return []
    const data = n.data as SectionNodeData
    return isPackSection(data.sourceId) || !data.elementorJson ? [] : sectionSamples(data.elementorJson)
  })
  const style: HouseStyle = {}
  for (const role of ['heading', 'body'] as const) {
    const family = families[role]
    if (!family) continue
    const t = treatment(samples.filter((s) => s.role === role && (!s.family || same(s.family, family))))
    if (t) style[role] = t
  }
  const result = Object.keys(style).length ? style : null
  byFamilies.set(familiesKey, result)
  return result
}

const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

/**
 * A marca para uma seção do pack: em cada papel com fonte na marca, o que o
 * guia não diz (peso, caixa, espaçamento, entrelinha) vem do estilo da casa.
 * O que o guia diz sempre vale.
 */
export function withHouseStyle(brand: Brand, house: HouseStyle | null): Brand {
  if (!house) return brand
  const fonts = { ...brand.fonts }
  for (const role of ['heading', 'body'] as const) {
    const own = brand.fonts[role]
    const style = house[role]
    if (own && style) fonts[role] = { ...defined(style), ...defined(own) } as BrandFont
  }
  return { ...brand, key: `${brand.key}.casa-${hash(JSON.stringify(house))}`, fonts }
}
