import { pageOf, PAGE_WIDTH } from '@/features/space/pages/pages'
import { useSpaceStore } from '@/store/spaceStore'

/** Mesma margem do topo que o canvas usa ao levar até uma página. */
const FOCUS_TOP = 80
/** Um pouco da seção de cima aparece, para ver onde a seção está na página. */
const CONTEXT_ABOVE = 40

/** Leva o canvas até a seção, sem mudar o zoom; a página dela fica ativa. */
export function focusSection(id: string) {
  const space = useSpaceStore.getState()
  const node = space.nodes.find((n) => n.id === id)
  if (!node) return false
  const page = pageOf(space.pages, node.id)
  if (page) space.setActivePage(page.id)
  const { zoom } = space.canvasTransform
  const centerX = page ? page.x + PAGE_WIDTH / 2 : node.x + node.width / 2
  space.setCanvasTransform({ zoom, x: space.viewport.width / 2 - centerX * zoom, y: FOCUS_TOP - (node.y - CONTEXT_ABOVE) * zoom })
  return true
}
