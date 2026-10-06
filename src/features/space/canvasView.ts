import { create } from 'zustand'
import { useSpaceStore } from '@/store/spaceStore'
import { canvasBounds, pageFrame } from './pages/pages'

// Limites do zoom pelos botões e pela roda do mouse no canvas
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2.5
const ZOOM_STEP = 1.25
/** Respiro em volta do que é enquadrado; em cima cabe o rótulo das páginas. */
const FIT_PADDING = 40
const FIT_TOP = 64

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

/** Troca o zoom mantendo parado o centro do canvas. */
export function zoomTo(next: number) {
  const { canvasTransform: t, viewport, setCanvasTransform } = useSpaceStore.getState()
  const z = clampZoom(next)
  const cx = viewport.width / 2
  const cy = viewport.height / 2
  setCanvasTransform({ zoom: z, x: cx - ((cx - t.x) / t.zoom) * z, y: cy - ((cy - t.y) / t.zoom) * z })
}

export const zoomIn = () => zoomTo(useSpaceStore.getState().canvasTransform.zoom * ZOOM_STEP)
export const zoomOut = () => zoomTo(useSpaceStore.getState().canvasTransform.zoom / ZOOM_STEP)

/** Enquadra um retângulo do mundo na tela, sem passar de 100%; uma página longa mostra o topo. */
function fitRect(bounds: { x: number; y: number; width: number; height: number }, maxZoom = 1) {
  const { viewport, setCanvasTransform } = useSpaceStore.getState()
  const areaW = viewport.width - FIT_PADDING * 2
  const areaH = viewport.height - FIT_TOP - FIT_PADDING
  const z = clampZoom(Math.min(maxZoom, areaW / bounds.width, areaH / bounds.height))
  setCanvasTransform({
    zoom: z,
    x: FIT_PADDING + Math.max(0, (areaW - bounds.width * z) / 2) - bounds.x * z,
    y: FIT_TOP + Math.max(0, (areaH - bounds.height * z) / 2) - bounds.y * z,
  })
}

/** Todas as páginas e nós do canvas na tela. */
export function fitToScreen() {
  const { nodes, pages } = useSpaceStore.getState()
  const bounds = canvasBounds(pages, nodes)
  if (bounds) fitRect(bounds)
}

/** Uma página na largura da tela, do topo dela. */
export function fitPageWidth(pageId: string) {
  const { nodes, pages, viewport, setCanvasTransform, setActivePage } = useSpaceStore.getState()
  const page = pages.find((p) => p.id === pageId)
  if (!page) return
  setActivePage(page.id)
  const frame = pageFrame(page, nodes)
  const z = clampZoom(Math.min(1.6, (viewport.width - FIT_PADDING * 2) / frame.width))
  setCanvasTransform({ zoom: z, x: (viewport.width - frame.width * z) / 2 - frame.x * z, y: FIT_TOP - 40 - frame.y * z })
}

/** Ferramenta da barrinha de baixo: selecionar (o padrão) ou a mão, que arrasta o canvas com o clique. */
export const useCanvasTool = create<{ tool: 'select' | 'hand'; setTool: (tool: 'select' | 'hand') => void }>()((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
}))
