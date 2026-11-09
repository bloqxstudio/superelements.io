import type { Post, Slide } from './types'

/**
 * Se o post sai animado (2026-11-09). Sem imports de código: roda no navegador e nos testes do Node
 * (scripts/tests/motion-estatico.test.mjs). `motion.ts` reexporta tudo.
 */

/** O slide anda: alguma camada tem entrada ou a câmera se move. */
export const slideHasMotion = (slide: Slide) => !!slide.camera || !!slide.flashes?.length || !!slide.shakes?.length || slide.layers.some((l) => l.motion && !l.hidden)

/** O post sai animado: tem animação e não está marcado como estático. */
export const hasMotion = (post: Post | undefined) => !!post && !post.motion?.paused && post.slides.some(slideHasMotion)

/** O post tem animação guardada (mesmo marcado como estático): para a tela de edição. */
export const hasMotionData = (post: Post | undefined) => !!post?.slides.some(slideHasMotion)

/**
 * Estático ou animado, sem perder a animação (o usuário: "um criativo clicado no motion sempre será um
 * motion… permitir voltar e tornar estático novamente").
 */
export const setPostStatic = (post: Post, still: boolean): Post => ({ ...post, motion: { ...post.motion, paused: still || undefined } })
