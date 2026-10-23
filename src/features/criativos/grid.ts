import { sizeOf, type FormatId, type Layer, type Post, type Slide } from './types'

/**
 * Grades de boas práticas de um post: margens de segurança, colunas, terços,
 * centro e as zonas que o Instagram cobre ou corta (o recorte do perfil, nos
 * posts, e a interface por cima, nos stories). São só guias de edição: não vão
 * para a imagem exportada. O encaixe magnético ao arrastar usa as mesmas linhas.
 */

export interface PostGrid {
  /** Mostra as guias nos cards deste post. */
  show: boolean
  margins: boolean
  /** Número de colunas (0 desliga). */
  columns: number
  thirds: boolean
  center: boolean
  /** Zonas do Instagram: o corte do perfil (posts) ou a interface (stories). */
  safe: boolean
  /** Ímã: o componente arrastado encaixa nas guias e nos outros componentes. */
  snap: boolean
}

/** O que cada post usa até alguém mudar: margens, 4 colunas e o centro. */
export const DEFAULT_GRID: PostGrid = { show: false, margins: true, columns: 4, thirds: false, center: true, safe: false, snap: true }

export const gridOf = (post: Pick<Post, 'grid'> | undefined): PostGrid => ({ ...DEFAULT_GRID, ...post?.grid })

/** Margem de segurança: 84 px num card de 1080 (cerca de 8% do menor lado). */
export const marginOf = (format: FormatId) => {
  const { width, height } = sizeOf(format)
  return Math.round(Math.min(width, height) * 0.0778)
}

/** Espaço entre colunas: um terço da margem. */
export const gutterOf = (format: FormatId) => Math.round(marginOf(format) / 3)

export interface Guides {
  /** Linhas verticais (posição x), com o que são. */
  v: { at: number; kind: 'margin' | 'column' | 'third' | 'center' }[]
  /** Linhas horizontais (posição y). */
  h: { at: number; kind: 'margin' | 'third' | 'center' }[]
  /** Faixas das colunas, para o desenho. */
  columns: [number, number][]
  /** Áreas que o Instagram corta ou cobre. */
  covered: { x: number; y: number; w: number; h: number; label: string }[]
}

export function guidesOf(format: FormatId, grid: PostGrid): Guides {
  const { width: W, height: H } = sizeOf(format)
  const m = marginOf(format)
  const out: Guides = { v: [], h: [], columns: [], covered: [] }
  if (grid.margins) {
    out.v.push({ at: m, kind: 'margin' }, { at: W - m, kind: 'margin' })
    out.h.push({ at: m, kind: 'margin' }, { at: H - m, kind: 'margin' })
  }
  if (grid.columns > 0) {
    const g = gutterOf(format)
    const colW = (W - m * 2 - g * (grid.columns - 1)) / grid.columns
    for (let i = 0; i < grid.columns; i++) {
      const x0 = m + i * (colW + g)
      out.columns.push([x0, x0 + colW])
      out.v.push({ at: Math.round(x0), kind: 'column' }, { at: Math.round(x0 + colW), kind: 'column' })
    }
  }
  if (grid.thirds) {
    out.v.push({ at: W / 3, kind: 'third' }, { at: (W * 2) / 3, kind: 'third' })
    out.h.push({ at: H / 3, kind: 'third' }, { at: (H * 2) / 3, kind: 'third' })
  }
  if (grid.center) {
    out.v.push({ at: W / 2, kind: 'center' })
    out.h.push({ at: H / 2, kind: 'center' })
  }
  if (grid.safe) {
    if (H / W > 1.6) {
      // Story e reels: a barra do perfil por cima (topo) e a caixa de resposta e os botões (base)
      const top = Math.round(H * 0.13)
      const bottom = Math.round(H * 0.18)
      out.covered.push({ x: 0, y: 0, w: W, h: top, label: 'Perfil e barra do story' }, { x: 0, y: H - bottom, w: W, h: bottom, label: 'Resposta e botões' })
    } else {
      // Post: a grade do perfil mostra o centro em 3:4, e as laterais somem
      const visible = Math.min(W, (H * 3) / 4)
      const side = Math.round((W - visible) / 2)
      if (side > 0) out.covered.push({ x: 0, y: 0, w: side, h: H, label: 'Fora do recorte do perfil' }, { x: W - side, y: 0, w: side, h: H, label: 'Fora do recorte do perfil' })
    }
  }
  return out
}

/** A caixa que a camada ocupa (o texto passa a altura medida pelo desenho). */
export type Box = { x: number; y: number; w: number; h: number }

const full = (b: Box, W: number, H: number) => b.w >= W * 0.9 && b.h >= H * 0.9

/**
 * Pontos de encaixe de um slide: as guias do post (as ligadas), as margens, o
 * centro e as bordas e o meio dos outros componentes (menos os de tela cheia,
 * que são fundo).
 */
export function snapTargets(format: FormatId, grid: PostGrid, slide: Slide, skipId: string, boxOf: (l: Layer) => Box) {
  const { width: W, height: H } = sizeOf(format)
  const g = guidesOf(format, { ...grid, margins: true, center: true })
  const xs = new Map<number, 'guide' | 'layer'>()
  const ys = new Map<number, 'guide' | 'layer'>()
  for (const l of g.v) xs.set(Math.round(l.at), 'guide')
  for (const l of g.h) ys.set(Math.round(l.at), 'guide')
  xs.set(0, 'guide')
  xs.set(W, 'guide')
  ys.set(0, 'guide')
  ys.set(H, 'guide')
  for (const layer of slide.layers) {
    if (layer.id === skipId) continue
    const b = boxOf(layer)
    if (full(b, W, H) || b.w <= 0) continue
    for (const x of [b.x, b.x + b.w / 2, b.x + b.w]) if (!xs.has(Math.round(x))) xs.set(Math.round(x), 'layer')
    for (const y of [b.y, b.y + b.h / 2, b.y + b.h]) if (!ys.has(Math.round(y))) ys.set(Math.round(y), 'layer')
  }
  return { xs: [...xs.keys()], ys: [...ys.keys()] }
}

/** O ajuste que leva uma das referências (borda, meio) mais perto do alvo, se estiver a menos de `limit`. */
export function snapAxis(refs: number[], targets: number[], limit: number): { delta: number; at: number } | undefined {
  let best: { delta: number; at: number } | undefined
  for (const r of refs)
    for (const t of targets) {
      const d = t - r
      if (Math.abs(d) <= limit && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: t }
    }
  return best
}
