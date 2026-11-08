/** Coordenadas em porcentagem do quadro, independentes do formato e da resolução. */
export interface FrameBox { x: number; y: number; w: number; h: number; visible: boolean }
export type Part = 'video' | 'animation' | 'captions'
export interface Composition {
  video: FrameBox
  animation: FrameBox
  captions: FrameBox
  captionScale: number
  videoOnTop: boolean
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
export function fitBox(box: FrameBox): FrameBox {
  const w = clamp(box.w, 8, 100), h = clamp(box.h, 4, 100)
  return { ...box, w, h, x: clamp(box.x, 0, 100 - w), y: clamp(box.y, 0, 100 - h) }
}

export function compositionPreset(layout = 'dividido', hasVideo = true): Composition {
  const box = (x: number, y: number, w: number, h: number, visible = true): FrameBox => ({ x, y, w, h, visible })
  const base: Composition = {
    video: box(0, 56, 100, 44, hasVideo),
    animation: box(0, 0, 100, 56),
    captions: box(5, 59, 90, 12),
    captionScale: 1,
    videoOnTop: false,
  }
  if (!hasVideo || layout === 'animacao') return { ...base, video: { ...base.video, visible: false }, animation: box(0, 0, 100, 100), captions: box(5, 78, 90, 12) }
  if (layout === 'rosto') return { ...base, video: box(0, 0, 100, 100), animation: box(4, 5, 92, 46), captions: box(5, 72, 90, 12) }
  if (layout === 'janela') return { ...base, video: box(65, 66, 30, 29), animation: box(0, 0, 100, 100), captions: box(5, 53, 90, 12), videoOnTop: true }
  return base
}
