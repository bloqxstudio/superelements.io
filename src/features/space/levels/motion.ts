import type { SectionMotion } from '@/types/space'
import type { Brand } from '../brand/designMd'
import type { MotionSpec } from '../brand/layers'
import { elementLabel, isWidget, pairElements, settingsOf, walk, type LevelElement } from './elements'

/**
 * Nível Movimento: o movimento que cada seção recebe (o da marca, o original
 * ou um próprio) e a leitura do movimento que cada peça tem, para o painel
 * mostrar o antes e depois e o canvas marcar as peças que animam.
 */

export interface MotionPreset {
  id: string
  label: string
  description: string
  spec: MotionSpec
}

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'soft',
    label: 'Suave',
    description: 'Sobe devagar, uma peça depois da outra',
    spec: { entrance: 'fade-up', duration: 700, easing: EASE_OUT, stagger: 90, hover: 'lift', cardHover: 'lift', animate: 'content' },
  },
  {
    id: 'quick',
    label: 'Rápido',
    description: 'Aparece logo, sem deslocamento',
    spec: { entrance: 'fade', duration: 400, easing: 'ease-out', stagger: 50, hover: 'lift', cardHover: 'lift', animate: 'content' },
  },
  {
    id: 'zoom',
    label: 'Zoom',
    description: 'Cresce até o tamanho final',
    spec: { entrance: 'zoom', duration: 600, easing: EASE_OUT, stagger: 80, hover: 'grow', cardHover: 'grow', animate: 'content' },
  },
  {
    id: 'still',
    label: 'Sem movimento',
    description: 'Tira entradas e hovers',
    spec: { entrance: 'none', hover: 'none', cardHover: 'none', animate: 'content' },
  },
]

export const presetOf = (spec: MotionSpec) => MOTION_PRESETS.find((p) => JSON.stringify(p.spec) === JSON.stringify(spec))

/** Marca sem nada além do movimento: aplicar ela numa seção só mexe nas animações. */
const MOTION_ONLY: Omit<Brand, 'layers'> = { key: 'motion-only', name: '', colors: [], fonts: {}, radius: {}, photos: [], guidelines: '' }

/**
 * Marca que vale para uma seção: a da página, com o movimento que a seção
 * escolheu no lugar do movimento da marca. `null` quando não há o que aplicar.
 */
export function sectionBrand(brand: Brand | null, motion: SectionMotion | undefined): Brand | null {
  if (!motion || motion.source === 'brand') return brand
  const spec = motion.source === 'custom' ? motion.spec : undefined
  if (!brand) return spec ? { ...MOTION_ONLY, layers: { motion: spec } } : null
  return { ...brand, layers: { ...brand.layers, motion: spec } }
}

export const sameMotion = (a: SectionMotion | undefined, b: SectionMotion | undefined) =>
  JSON.stringify(a ?? { source: 'brand' }) === JSON.stringify(b ?? { source: 'brand' })

// ---------------------------------------------------------------------------
// Movimento de cada peça

export interface MotionState {
  /** Nome da animação do Elementor (fadeInUp), ou null sem entrada. */
  entrance: string | null
  /** ms */
  delay: number
  /** ms */
  duration: number
  easing?: string
  hover?: string
}

/** Duração das classes do Elementor: normal 1,25s, fast 0,75s, slow 2s. */
const CLASS_DURATION: Record<string, number> = { fast: 750, slow: 2000 }

export function motionOf(el: LevelElement): MotionState | null {
  const s = settingsOf(el)
  if (!s) return null
  const widget = isWidget(el)
  const anim = s[widget ? '_animation' : 'animation']
  const entrance = typeof anim === 'string' && anim && anim !== 'none' ? anim : null
  // Duração e curva exatas vêm no CSS da marca; hover de subir também
  const css = typeof s.custom_css === 'string' ? s.custom_css : ''
  const exact = css.match(/animation-duration:(\d+)ms/)?.[1]
  const duration = exact ? +exact : (CLASS_DURATION[String(s.animation_duration)] ?? 1250)
  const easing = css.match(/animation-timing-function:([^;}]+)/)?.[1]
  let hover: string | undefined
  if (/:hover\{translate:0 -\d+px\}/.test(css)) hover = 'lift'
  else if (/:hover\{scale:/.test(css)) hover = 'grow'
  else if (typeof s.hover_animation === 'string' && s.hover_animation) hover = s.hover_animation
  if (!entrance && !hover) return null
  return { entrance, delay: entrance ? Number(s[widget ? '_animation_delay' : 'animation_delay']) || 0 : 0, duration, easing, hover }
}

const ENTRANCE_LABELS: Record<string, string> = {
  fadeIn: 'fade',
  fadeInUp: 'fade subindo',
  fadeInDown: 'fade descendo',
  fadeInLeft: 'fade da esquerda',
  fadeInRight: 'fade da direita',
  zoomIn: 'zoom',
  slideInUp: 'desliza para cima',
  slideInDown: 'desliza para baixo',
  slideInLeft: 'desliza da esquerda',
  slideInRight: 'desliza da direita',
}

const HOVER_LABELS: Record<string, string> = { lift: 'sobe', grow: 'cresce', shrink: 'encolhe', float: 'flutua', pulse: 'pulsa' }

export const entranceLabel = (name: string) => ENTRANCE_LABELS[name] ?? name
export const hoverLabel = (name: string) => HOVER_LABELS[name] ?? name

/** "fade subindo · 700ms · +90ms · hover sobe" */
export function motionText(m: MotionState | null): string {
  if (!m) return 'sem movimento'
  return [
    m.entrance && entranceLabel(m.entrance),
    m.entrance && `${m.duration}ms`,
    m.entrance && m.delay > 0 && `+${m.delay}ms`,
    m.hover && `hover ${hoverLabel(m.hover)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Rótulo curto para o marcador no canvas. */
export function motionTag(m: MotionState): string {
  if (!m.entrance) return `hover ${hoverLabel(m.hover!)}`
  return `${entranceLabel(m.entrance)}${m.delay > 0 ? ` +${m.delay}` : ''}`
}

export type RowStatus = 'new' | 'removed' | 'changed' | 'same'

export interface MotionRow {
  id: string
  label: string
  before: MotionState | null
  after: MotionState | null
  status: RowStatus
}

/** Peças que animam antes ou depois, na ordem da seção. */
export function motionRows(before: LevelElement[], after: LevelElement[]): MotionRow[] {
  const rows: MotionRow[] = []
  pairElements(before, after, (b, a) => {
    const was = motionOf(b)
    const will = motionOf(a)
    if (!was && !will) return
    const status: RowStatus = !was ? 'new' : !will ? 'removed' : JSON.stringify(was) === JSON.stringify(will) ? 'same' : 'changed'
    rows.push({ id: String(a.id ?? ''), label: elementLabel(a), before: was, after: will, status })
  })
  return rows
}

/** Movimento de cada peça que anima, sem comparação (canvas sem rascunho). */
export function motionMarks(elements: LevelElement[]): { id: string; label: string }[] {
  const marks: { id: string; label: string }[] = []
  walk(elements, (el) => {
    const m = motionOf(el)
    if (m && el.id) marks.push({ id: String(el.id), label: motionTag(m) })
  })
  return marks
}

// ---------------------------------------------------------------------------
// Textos do painel

export const ENTRANCE_OPTIONS: { value: NonNullable<MotionSpec['entrance']>; label: string }[] = [
  { value: 'fade-up', label: 'Fade subindo' },
  { value: 'fade', label: 'Fade' },
  { value: 'fade-down', label: 'Fade descendo' },
  { value: 'slide-up', label: 'Deslizar para cima' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'none', label: 'Sem entrada' },
]

export const EASING_OPTIONS: { value: string; label: string }[] = [
  { value: EASE_OUT, label: 'Suave (desacelera no fim)' },
  { value: 'ease-out', label: 'ease-out' },
  { value: 'ease-in-out', label: 'ease-in-out' },
  { value: 'linear', label: 'linear' },
]

const SPEC_ENTRANCE: Record<string, string> = { none: 'sem entrada', fade: 'fade', 'fade-up': 'fade subindo', 'fade-down': 'fade descendo', 'slide-up': 'deslizar para cima', zoom: 'zoom' }

/** "fade subindo · 700ms · 90ms entre peças · hover sobe" */
export function motionSpecText(spec: MotionSpec): string {
  const moves = spec.entrance && spec.entrance !== 'none'
  return [
    spec.entrance && SPEC_ENTRANCE[spec.entrance],
    moves && spec.duration && `${spec.duration}ms`,
    moves && spec.stagger && `${spec.stagger}ms entre peças`,
    spec.hover && spec.hover !== 'none' && `hover ${hoverLabel(spec.hover)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Selo do nó no canvas quando a seção não segue o movimento da marca. */
export function sectionMotionLabel(motion: SectionMotion | undefined): string | null {
  if (!motion || motion.source === 'brand') return null
  if (motion.source === 'original') return 'Movimento original'
  return `Movimento: ${presetOf(motion.spec)?.label ?? 'próprio'}`
}
