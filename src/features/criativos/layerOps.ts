import { layerBox } from './render'
import { useEditor } from './store'
import { sizeOf, uid, type Layer } from './types'
import { marginOf } from './grid'
import { spreadLayer, unspreadLayer } from './spanOps'

/**
 * Edição de vários componentes de uma vez, no slide escolhido: grupo, apagar,
 * duplicar, mover, alinhar, distribuir e reordenar. Cada função é um passo só
 * do desfazer.
 */

/** Muda a lista de camadas do slide escolhido. */
function editLayers(fn: (layers: Layer[]) => Layer[]) {
  const { postId, slideId } = useEditor.getState()
  useEditor.getState().edit((s) => ({
    ...s,
    posts: s.posts.map((p) => (p.id !== postId ? p : { ...p, slides: p.slides.map((sl) => (sl.id !== slideId ? sl : { ...sl, layers: fn(sl.layers) })) })),
  }))
}

export const currentLayers = (): Layer[] => {
  const { set, postId, slideId } = useEditor.getState()
  return set?.posts.find((p) => p.id === postId)?.slides.find((s) => s.id === slideId)?.layers ?? []
}

/** Os ids com todos os que são do mesmo grupo (escolher um do grupo escolhe o grupo). */
export function withGroups(layers: Layer[], ids: string[]): string[] {
  const groups = new Set(layers.filter((l) => ids.includes(l.id) && l.group).map((l) => l.group))
  return layers.filter((l) => ids.includes(l.id) || (l.group && groups.has(l.group))).map((l) => l.id)
}

export function boundsOf(layers: Layer[]) {
  const boxes = layers.map(layerBox)
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const r = Math.max(...boxes.map((b) => b.x + b.w))
  const b = Math.max(...boxes.map((bx) => bx.y + bx.h))
  return { x, y, w: r - x, h: b - y }
}

/** Junta os escolhidos num grupo; eles ficam lado a lado na ordem de empilhamento, no lugar do mais alto. */
export function groupLayers(ids: string[]) {
  const layers = currentLayers()
  const chosen = layers.filter((l) => ids.includes(l.id))
  if (chosen.length < 2) return
  const group = uid()
  editLayers((all) => {
    const top = Math.max(...chosen.map((c) => all.findIndex((l) => l.id === c.id)))
    const rest = all.filter((l) => !ids.includes(l.id))
    const before = all.slice(0, top + 1).filter((l) => !ids.includes(l.id)).length
    const members = all.filter((l) => ids.includes(l.id)).map((l) => ({ ...l, group }))
    return [...rest.slice(0, before), ...members, ...rest.slice(before)]
  })
}

/** Desfaz os grupos a que os escolhidos pertencem. */
export function ungroupLayers(ids: string[]) {
  const layers = currentLayers()
  const groups = new Set(layers.filter((l) => ids.includes(l.id) && l.group).map((l) => l.group))
  if (!groups.size) return
  editLayers((all) => all.map((l) => (l.group && groups.has(l.group) ? { ...l, group: undefined } : l)))
}

export function removeLayers(ids: string[]) {
  editLayers((all) => all.filter((l) => !ids.includes(l.id)))
  useEditor.getState().selectLayers([])
}

/** Copia os escolhidos um pouco ao lado (os grupos copiados viram grupos novos) e escolhe as cópias. */
export function duplicateLayers(ids: string[]) {
  const layers = currentLayers()
  const chosen = layers.filter((l) => ids.includes(l.id))
  if (!chosen.length) return
  const groups = new Map<string, string>()
  const groupOf = (g?: string) => {
    if (!g) return undefined
    if (!groups.has(g)) groups.set(g, uid())
    return groups.get(g)
  }
  const copies = chosen.map((l) => ({ ...l, id: uid(), name: `${l.name} (cópia)`, x: l.x + 30, y: l.y + 30, group: groupOf(l.group) }))
  editLayers((all) => [...all, ...copies])
  useEditor.getState().selectLayers(copies.map((c) => c.id))
}

export function moveLayers(ids: string[], dx: number, dy: number) {
  editLayers((all) => all.map((l) => (ids.includes(l.id) ? { ...l, x: l.x + dx, y: l.y + dy } : l)))
}

export type AlignHow = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/**
 * Alinha os escolhidos entre si (pela caixa que todos formam); um só se alinha
 * ao card, nas margens da grade. Texto também ajusta o alinhamento das letras.
 */
export function alignLayers(ids: string[], how: AlignHow) {
  const { set, postId } = useEditor.getState()
  const post = set?.posts.find((p) => p.id === postId)
  const layers = currentLayers().filter((l) => ids.includes(l.id))
  if (!post || !layers.length) return
  const { width: W, height: H } = sizeOf(post.format)
  const m = marginOf(post.format)
  const area = layers.length > 1 ? boundsOf(layers) : { x: m, y: m, w: W - m * 2, h: H - m * 2 }
  const single = layers.length === 1
  const frame = single && (how === 'center' || how === 'middle') ? { x: 0, y: 0, w: W, h: H } : area
  editLayers((all) =>
    all.map((l) => {
      if (!ids.includes(l.id)) return l
      const b = layerBox(l)
      const text = l.type === 'text'
      if (how === 'left') return { ...l, x: l.x + (frame.x - b.x), ...(text && single ? { align: 'left' as const } : {}) } as Layer
      if (how === 'center') return { ...l, x: l.x + (frame.x + frame.w / 2 - (b.x + b.w / 2)), ...(text && single ? { align: 'center' as const } : {}) } as Layer
      if (how === 'right') return { ...l, x: l.x + (frame.x + frame.w - (b.x + b.w)), ...(text && single ? { align: 'right' as const } : {}) } as Layer
      if (how === 'top') return { ...l, y: l.y + (frame.y - b.y) }
      if (how === 'middle') return { ...l, y: l.y + (frame.y + frame.h / 2 - (b.y + b.h / 2)) }
      return { ...l, y: l.y + (frame.y + frame.h - (b.y + b.h)) }
    })
  )
}

/** Espaça os escolhidos por igual entre o primeiro e o último (três ou mais). */
export function distributeLayers(ids: string[], axis: 'x' | 'y') {
  const layers = currentLayers().filter((l) => ids.includes(l.id))
  if (layers.length < 3) return
  const boxes = layers.map((l) => ({ l, b: layerBox(l) })).sort((a, c) => (axis === 'x' ? a.b.x - c.b.x : a.b.y - c.b.y))
  const size = (b: { w: number; h: number }) => (axis === 'x' ? b.w : b.h)
  const start = axis === 'x' ? boxes[0].b.x : boxes[0].b.y
  const end = axis === 'x' ? boxes.at(-1)!.b.x + boxes.at(-1)!.b.w : boxes.at(-1)!.b.y + boxes.at(-1)!.b.h
  const gap = (end - start - boxes.reduce((n, x) => n + size(x.b), 0)) / (boxes.length - 1)
  let cursor = start
  const target = new Map<string, number>()
  for (const { l, b } of boxes) {
    target.set(l.id, cursor - (axis === 'x' ? b.x : b.y))
    cursor += size(b) + gap
  }
  editLayers((all) => all.map((l) => (target.has(l.id) ? (axis === 'x' ? { ...l, x: l.x + target.get(l.id)! } : { ...l, y: l.y + target.get(l.id)! }) : l)))
}

/** Move os escolhidos (com seus grupos) para antes ou depois de uma camada, na ordem de empilhamento. */
export function reorderLayers(ids: string[], targetId: string, after: boolean) {
  const layers = currentLayers()
  const moving = withGroups(layers, ids)
  if (moving.includes(targetId)) return
  editLayers((all) => {
    const block = all.filter((l) => moving.includes(l.id))
    const rest = all.filter((l) => !moving.includes(l.id))
    const at = rest.findIndex((l) => l.id === targetId)
    if (at < 0) return all
    return [...rest.slice(0, at + (after ? 1 : 0)), ...block, ...rest.slice(at + (after ? 1 : 0))]
  })
}

/** Ordem de empilhamento: para a frente ou para trás de tudo. */
export function stackLayers(ids: string[], where: 'front' | 'back') {
  editLayers((all) => {
    const moving = withGroups(all, ids)
    const block = all.filter((l) => moving.includes(l.id))
    const rest = all.filter((l) => !moving.includes(l.id))
    return where === 'front' ? [...rest, ...block] : [...block, ...rest]
  })
}

export function patchLayerFields(ids: string[], fields: Partial<Layer>) {
  editLayers((all) => all.map((l) => (ids.includes(l.id) ? ({ ...l, ...fields } as Layer) : l)))
}

/** Passa o componente por todos os cards do post, emendado (faixa contínua). */
export function spreadSelected(layerId: string) {
  const { postId, slideId } = useEditor.getState()
  if (!postId || !slideId) return
  useEditor.getState().edit((s) => spreadLayer(s, postId, slideId, layerId))
}

/** Solta o componente da faixa: cada cópia passa a valer sozinha. */
export function unspreadSelected(spanId: string) {
  const { postId } = useEditor.getState()
  if (!postId) return
  useEditor.getState().edit((s) => unspreadLayer(s, postId, spanId))
}
