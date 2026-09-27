import type { MotionSpec } from '../layers'
import type { Entrance, HoverEffect } from '../values'
import { clearResponsive, isSet, type Settings } from './elementor'

/**
 * Movimento da marca: troca a animação de entrada que a seção já usa (sem
 * criar animação onde não havia), escalona os atrasos e define o hover de
 * botões e cards. Duração e curva exatas saem no CSS da marca.
 */

const ENTRANCE: Record<Entrance, string> = {
  none: 'none',
  fade: 'fadeIn',
  'fade-up': 'fadeInUp',
  'fade-down': 'fadeInDown',
  'slide-up': 'slideInUp',
  zoom: 'zoomIn',
}

const animationKey = (isWidget: boolean) => (isWidget ? '_animation' : 'animation')
const delayKey = (isWidget: boolean) => (isWidget ? '_animation_delay' : 'animation_delay')

export function isAnimated(s: Settings, isWidget: boolean): boolean {
  const v = s[animationKey(isWidget)]
  return isSet(v) && v !== 'none'
}

export const originalDelay = (s: Settings, isWidget: boolean) => Number(s[delayKey(isWidget)]) || 0

/**
 * Posição de cada atraso original na faixa: quem entrava junto continua junto,
 * e a ordem do autor da seção vira a cadência da marca.
 */
export function delayRanks(delays: number[]): Map<number, number> {
  return new Map([...new Set(delays)].sort((a, b) => a - b).map((d, i) => [d, i]))
}

/**
 * `target` vem do alcance 'content': true anima o elemento mesmo sem animação
 * na seção, false tira a animação dele. Sem `target`, só troca a que já existe.
 */
export function applyEntrance(s: Settings, isWidget: boolean, motion: MotionSpec, rank: number | undefined, target?: boolean): string {
  if (!motion.entrance) return ''
  const animated = isAnimated(s, isWidget)
  if (target === undefined ? !animated : !target && !animated) return ''
  const key = animationKey(isWidget)
  const original = String(s[key] ?? '')
  clearResponsive(s, key)
  if (motion.entrance === 'none' || target === false) {
    s[key] = 'none'
    return ''
  }
  // Entrada lateral continua lateral quando a marca pede só um fade
  const sideways = /Left|Right/.exec(original)?.[0]
  s[key] = sideways && (motion.entrance === 'fade' || motion.entrance === 'fade-up') ? `fadeIn${sideways}` : ENTRANCE[motion.entrance]
  if (motion.duration) s.animation_duration = motion.duration <= 900 ? 'fast' : motion.duration <= 1600 ? '' : 'slow'
  if (motion.stagger !== undefined && rank !== undefined) s[delayKey(isWidget)] = Math.min(rank, 8) * motion.stagger
  const decls = [motion.duration && `animation-duration:${motion.duration}ms`, motion.easing && `animation-timing-function:${motion.easing}`].filter(Boolean)
  return decls.length ? `selector.animated{${decls.join(';')}}` : ''
}

/** Transição de hover: a duração da marca se for de interface (até 400ms), senão 250ms. */
const timing = (m: MotionSpec) => `${m.duration && m.duration <= 400 ? m.duration : 250}ms ${m.easing ?? 'ease'}`

export function buttonHover(s: Settings, motion: MotionSpec): string {
  const effect: HoverEffect | undefined = motion.hover
  if (!effect) return ''
  if (effect === 'grow') {
    s.hover_animation = 'grow'
    return ''
  }
  if (s.hover_animation) s.hover_animation = ''
  if (effect !== 'lift') return ''
  const t = timing(motion)
  return `selector .elementor-button{transition:translate ${t},background-color ${t},color ${t},border-color ${t}}selector .elementor-button:hover{translate:0 -2px}`
}

export function cardHover(motion: MotionSpec): string {
  const effect = motion.cardHover ?? motion.hover
  const t = timing(motion)
  if (effect === 'lift') return `selector{transition:translate ${t},box-shadow ${t}}selector:hover{translate:0 -4px}`
  if (effect === 'grow') return `selector{transition:scale ${t}}selector:hover{scale:1.02}`
  return ''
}
