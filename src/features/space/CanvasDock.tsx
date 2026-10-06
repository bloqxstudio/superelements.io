import React from 'react'
import { ChevronDown, Hand, MousePointer2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useSpaceStore } from '@/store/spaceStore'
import { VIEWPORT_WIDTH } from '@/features/elementor-preview/PreviewFrame'
import { MAX_ZOOM, MIN_ZOOM, fitPageWidth, fitToScreen, useCanvasTool, zoomIn, zoomOut, zoomTo } from './canvasView'
import { DEVICES } from './inspector/StyleTab'
import { ISLAND_SURFACE, Hint } from './ToolbarIsland'
import { MOD_KEY } from './pages/clipboard'
import { useSpaceUi } from './spaceUi'

const dockButton = (on: boolean) =>
  cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94]',
    on ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  )

/**
 * Barrinha flutuante embaixo do canvas, como a do Framer: selecionar ou
 * arrastar, a tela em que as páginas aparecem e o zoom.
 */
export const CanvasDock: React.FC = () => {
  const panels = useSpaceUi((s) => s.panels)
  const onPanels = useSpaceUi((s) => s.togglePanels)
  const tool = useCanvasTool((s) => s.tool)
  const setTool = useCanvasTool((s) => s.setTool)
  const device = useSpaceStore((s) => s.previewDevice)
  const setPreviewDevice = useSpaceStore((s) => s.setPreviewDevice)
  const zoom = useSpaceStore((s) => s.canvasTransform.zoom)
  const activePageId = useSpaceStore((s) => s.activePageId)

  return (
    <div
      data-canvas-bar
      role="toolbar"
      aria-label="Canvas"
      className={`pointer-events-auto absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 select-none items-center gap-0.5 rounded-xl p-1 ${ISLAND_SURFACE}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Hint label="Selecionar" hint="Clique para escolher seções e camadas" side="top">
        <button type="button" aria-pressed={tool === 'select'} aria-label="Selecionar" className={dockButton(tool === 'select')} onClick={() => setTool('select')}>
          <MousePointer2 className="h-4 w-4" />
        </button>
      </Hint>
      <Hint label="Mão" hint="Arrastar o canvas (ou segure Espaço)" side="top">
        <button type="button" aria-pressed={tool === 'hand'} aria-label="Mão" className={dockButton(tool === 'hand')} onClick={() => setTool('hand')}>
          <Hand className="h-4 w-4" />
        </button>
      </Hint>

      <div aria-hidden className="mx-1 h-5 w-px bg-gray-200" />

      <div role="radiogroup" aria-label="Tela" className="flex items-center gap-0.5">
        {DEVICES.map(({ id, label, icon: Icon }) => (
          <Hint key={id} label={`${label} · ${VIEWPORT_WIDTH[id]}px`} hint="As páginas e as propriedades nesta tela" side="top">
            <button
              type="button"
              role="radio"
              aria-checked={device === id}
              aria-label={label}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94]',
                device === id ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              )}
              onClick={() => setPreviewDevice(id)}
            >
              <Icon className="h-4 w-4" />
            </button>
          </Hint>
        ))}
      </div>

      <div aria-hidden className="mx-1 h-5 w-px bg-gray-200" />

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Zoom"
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium tabular-nums text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Math.round(zoom * 100)}%
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-52 rounded-xl p-1">
          <DropdownMenuItem className="rounded-lg text-xs" disabled={zoom >= MAX_ZOOM} onSelect={(e) => (e.preventDefault(), zoomIn())}>
            Aumentar
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg text-xs" disabled={zoom <= MIN_ZOOM} onSelect={(e) => (e.preventDefault(), zoomOut())}>
            Diminuir
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg text-xs" onSelect={() => zoomTo(1)}>
            100%
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="rounded-lg text-xs" onSelect={fitToScreen}>
            Ver todas as páginas
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg text-xs" disabled={!activePageId} onSelect={() => activePageId && fitPageWidth(activePageId)}>
            Página ativa na largura
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="rounded-lg text-xs" onSelect={onPanels}>
            {panels ? 'Esconder os painéis' : 'Mostrar os painéis'}
            <span className="ml-auto text-[10px] tracking-widest text-gray-400">{MOD_KEY}\</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
