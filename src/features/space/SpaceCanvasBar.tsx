import React from 'react'
import { AlignHorizontalSpaceAround, Minus, Plus, Scan, Trash2 } from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import { LIBRARY_PANEL_WIDTH } from './SpaceLibraryPanel'
import { LEVEL_PANEL_WIDTH } from './levels/LevelPanel'
import { canvasBounds, plural } from './pages/pages'
import { Hint, ToolButton, ToolDivider, ToolbarIsland } from './ToolbarIsland'

// Mesmos limites do zoom pela roda do mouse no canvas
const MIN_ZOOM = 0.2
const MAX_ZOOM = 2.5
const ZOOM_STEP = 1.25
const EDGE = 12
/** Altura ocupada pela barra de cima e por esta, somadas às margens. */
const TOP_INSET = 64
const BOTTOM_INSET = 60
const FIT_PADDING = 32
/** Largura livre abaixo da qual a barra fica só com ícones. */
const COMPACT_FREE_WIDTH = 440
/** Abaixo desta, nem a versão só com ícones cabe. */
export const MIN_FREE_WIDTH = 280

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

interface SpaceCanvasBarProps {
  libraryOpen: boolean
}

/** Ferramentas do próprio canvas, no rodapé da área livre: zoom, organizar, contagem e limpar. */
export const SpaceCanvasBar: React.FC<SpaceCanvasBarProps> = ({ libraryOpen }) => {
  const zoom = useSpaceStore((s) => s.canvasTransform.zoom)
  const nodes = useSpaceStore((s) => s.nodes)
  const pageCount = useSpaceStore((s) => s.pages.length)
  const connectionCount = useSpaceStore((s) => s.connections.length)
  const levelPanelOpen = useSpaceStore((s) => s.editLevel !== 'structure')
  const { setCanvasTransform, arrangePages, clearCanvas } = useSpaceStore.getState()

  const canvasWidth = useSpaceStore((s) => s.viewport.width)
  const sectionCount = nodes.filter((n) => n.type === 'section').length
  const leftInset = libraryOpen ? EDGE + LIBRARY_PANEL_WIDTH + EDGE : 0
  const rightInset = levelPanelOpen ? EDGE + LEVEL_PANEL_WIDTH + EDGE : 0
  // Entre os dois painéis abertos numa tela estreita, a barra perde os textos para caber
  const freeWidth = canvasWidth - leftInset - rightInset
  const compact = freeWidth < COMPACT_FREE_WIDTH

  /** Troca o zoom mantendo parado o ponto no centro da área livre. */
  const zoomTo = (next: number) => {
    const { canvasTransform: t, viewport } = useSpaceStore.getState()
    const z = clampZoom(next)
    const cx = leftInset + (viewport.width - leftInset - rightInset) / 2
    const cy = viewport.height / 2
    setCanvasTransform({ zoom: z, x: cx - ((cx - t.x) / t.zoom) * z, y: cy - ((cy - t.y) / t.zoom) * z })
  }

  /** Enquadra as páginas e os nós na área livre, sem passar de 100%. */
  const fitToScreen = () => {
    const { nodes, pages, viewport } = useSpaceStore.getState()
    const bounds = canvasBounds(pages, nodes)
    if (!bounds) return
    const areaW = viewport.width - leftInset - rightInset - FIT_PADDING * 2
    const areaH = viewport.height - TOP_INSET - BOTTOM_INSET - FIT_PADDING * 2
    const z = clampZoom(Math.min(1, areaW / bounds.width, areaH / bounds.height))
    // No zoom mínimo uma página longa não cabe: fica o topo (os cabeçalhos das páginas) à vista
    setCanvasTransform({
      zoom: z,
      x: leftInset + FIT_PADDING + Math.max(0, (areaW - bounds.width * z) / 2) - bounds.x * z,
      y: TOP_INSET + FIT_PADDING + Math.max(0, (areaH - bounds.height * z) / 2) - bounds.y * z,
    })
  }

  const counts = [
    plural(pageCount, 'página', 'páginas'),
    plural(sectionCount, 'seção', 'seções'),
    ...(connectionCount > 0 ? [plural(connectionCount, 'conexão', 'conexões')] : []),
  ].join(' · ')

  const handleClear = () => {
    if (confirm('Limpar o canvas? Todas as páginas, seções e conexões serão removidas; fica uma página Home vazia.')) clearCanvas()
  }

  // Sem espaço nem para os ícones, a barra passaria por baixo dos painéis; o zoom pela roda continua
  if (freeWidth < MIN_FREE_WIDTH) return null

  return (
    <ToolbarIsland aria-label="Canvas" className="absolute bottom-3 z-40 select-none" style={{ left: leftInset || EDGE }}>
      <Hint label="Diminuir zoom" side="top">
        <ToolButton icon={Minus} label="Diminuir zoom" showLabel={false} onClick={() => zoomTo(zoom / ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} />
      </Hint>
      <Hint label="Voltar para 100%" side="top">
        <ToolButton label="Zoom" static className="w-12 px-0 tabular-nums" onClick={() => zoomTo(1)}>
          {Math.round(zoom * 100)}%
        </ToolButton>
      </Hint>
      <Hint label="Aumentar zoom" side="top">
        <ToolButton icon={Plus} label="Aumentar zoom" showLabel={false} onClick={() => zoomTo(zoom * ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} />
      </Hint>
      <Hint label="Ajustar à tela" hint="Enquadrar tudo o que está no canvas" side="top">
        <ToolButton icon={Scan} label="Ajustar à tela" showLabel={false} onClick={fitToScreen} />
      </Hint>

      <ToolDivider />

      <Hint label="Organizar" hint="Alinhar as páginas lado a lado, na ordem atual" side="top">
        <ToolButton
          icon={AlignHorizontalSpaceAround}
          label="Organizar"
          showLabel={!compact}
          onClick={arrangePages}
          disabled={pageCount < 2}
        />
      </Hint>

      {(nodes.length > 0 || pageCount > 1) && (
        <>
          <ToolDivider />
          {!compact && <span className="whitespace-nowrap px-1.5 text-[11px] tabular-nums text-gray-500">{counts}</span>}
          <Hint label="Limpar canvas" hint={compact ? `${counts}. Remove tudo do canvas.` : 'Remove todas as páginas, seções e conexões'} side="top">
            <ToolButton icon={Trash2} label="Limpar canvas" showLabel={false} tone="danger" onClick={handleClear} />
          </Hint>
        </>
      )}
    </ToolbarIsland>
  )
}
