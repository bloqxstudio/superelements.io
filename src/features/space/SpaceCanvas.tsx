import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import { SectionNode } from './nodes/SectionNode'
import { TextNode } from './nodes/TextNode'
import { ColorPaletteNode } from './nodes/ColorPaletteNode'
import { ConnectionLayer } from './ConnectionLayer'
import { PagesLayer } from './pages/PageFrame'
import { MAX_ZOOM, MIN_ZOOM } from './SpaceCanvasBar'

/** Altura de uma linha quando a roda vem em linhas (Firefox). */
const WHEEL_LINE = 16

/** Foco num campo ou num controle: ali o Espaço digita ou aciona o botão, não arrasta o canvas. */
const ownsSpace = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest('input, textarea, select, button, a[href], [contenteditable="true"], [role="button"], [role="menuitem"], [role="dialog"], [role="menu"]')

// Dot grid pattern for the canvas background
const DotPattern: React.FC<{ transform: { x: number; y: number; zoom: number } }> = ({ transform }) => {
  const spacing = 24 * transform.zoom
  const dotSize = Math.max(1, transform.zoom * 1.5)
  const offsetX = transform.x % spacing
  const offsetY = transform.y % spacing

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <pattern
          id="dot-pattern"
          x={offsetX}
          y={offsetY}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={spacing / 2} cy={spacing / 2} r={dotSize} fill="#d1d5db" opacity={0.6} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pattern)" />
    </svg>
  )
}

export const SpaceCanvas: React.FC = () => {
  const { nodes, canvasTransform, updatePendingConnection, cancelConnection, setCanvasTransform, panCanvas, setViewport, clearSelection } =
    useSpaceStore()

  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)

  // Tamanho visível do canvas, usado para centralizar as seções adicionadas pela biblioteca
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewport(el.clientWidth, el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [setViewport])

  // Track pending connection state via ref to avoid stale closures in document listeners
  const pendingRef = useRef(useSpaceStore.getState().pendingConnection)
  useEffect(() => {
    return useSpaceStore.subscribe((state) => {
      pendingRef.current = state.pendingConnection
    })
  }, [])

  // Document-level handlers for connection drag (so mouseup on ports fires before cancel)
  useEffect(() => {
    const handleDocMouseMove = (e: MouseEvent) => {
      if (pendingRef.current) {
        updatePendingConnection(e.clientX, e.clientY)
      }
    }

    const handleDocMouseUp = () => {
      // Only cancel if the mouseup didn't hit a port (ports call completeConnection first)
      // We use a small timeout so port onMouseUp fires first
      if (pendingRef.current) {
        setTimeout(() => {
          if (useSpaceStore.getState().pendingConnection) {
            cancelConnection()
          }
        }, 0)
      }
    }

    document.addEventListener('mousemove', handleDocMouseMove)
    document.addEventListener('mouseup', handleDocMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleDocMouseMove)
      document.removeEventListener('mouseup', handleDocMouseUp)
    }
  }, [updatePendingConnection, cancelConnection])

  /** Arrasta o canvas até soltar o mouse; clique sem arrastar no fundo desfaz a seleção. */
  const startPan = useCallback(
    (e: React.MouseEvent, clickClears: boolean) => {
      isPanning.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
      const start = { x: e.clientX, y: e.clientY }

      const handleMouseMove = (e: MouseEvent) => {
        if (!isPanning.current) return
        const dx = e.clientX - lastPos.current.x
        const dy = e.clientY - lastPos.current.y
        panCanvas(dx, dy)
        lastPos.current = { x: e.clientX, y: e.clientY }
      }

      const handleMouseUp = (e: MouseEvent) => {
        isPanning.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        // Clique no fundo (sem arrastar o canvas) desfaz a seleção
        if (clickClears && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) clearSelection()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [panCanvas, clearSelection]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan if clicking directly on canvas background (not on a node)
      const target = e.target as HTMLElement
      if (target !== e.currentTarget && !target.classList.contains('canvas-background')) return
      startPan(e, true)
    },
    [startPan]
  )

  // Espaço segurado (ou o botão do meio) arrasta o canvas por cima de qualquer coisa,
  // já que arrastar uma seção leva a seção; com o Espaço, os previews deixam de receber o mouse
  const spaceHeld = useRef(false)
  const [handMode, setHandMode] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || ownsSpace(e.target)) return
      e.preventDefault()
      if (!spaceHeld.current) {
        spaceHeld.current = true
        setHandMode(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceHeld.current = false
      setHandMode(false)
    }
    const reset = () => {
      spaceHeld.current = false
      setHandMode(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [])

  const handleMouseDownCapture = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 1 && !(e.button === 0 && spaceHeld.current)) return
      e.preventDefault()
      e.stopPropagation()
      document.body.style.cursor = 'grabbing'
      startPan(e, false)
    },
    [startPan]
  )

  // Roda e pinça dão zoom em direção ao cursor, também por cima das seções (o preview devolve a roda).
  // Ouvinte nativo: o onWheel do React é passivo e não impediria a pinça de dar zoom na página inteira.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let pending: { factor: number; x: number; y: number } | null = null
    let frame = 0

    // Um passo por quadro, sempre a partir do zoom atual, para os eventos rápidos não se perderem
    const apply = () => {
      frame = 0
      if (!pending) return
      const { factor, x, y } = pending
      pending = null
      const t = useSpaceStore.getState().canvasTransform
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, t.zoom * factor))
      if (zoom === t.zoom) return
      setCanvasTransform({ zoom, x: x - ((x - t.x) / t.zoom) * zoom, y: y - ((y - t.y) / t.zoom) * zoom })
    }

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      // O JSON da seção rola; com Ctrl o gesto volta a ser zoom
      const scroller = !e.ctrlKey && target.closest?.('textarea')
      if (scroller && scroller.scrollHeight > scroller.clientHeight) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const pixels = e.deltaY * (e.deltaMode === 1 ? WHEEL_LINE : e.deltaMode === 2 ? rect.height : 1)
      // A roda do mouse anda em degraus de ~100px; a pinça do trackpad chega com Ctrl e passos curtos
      const limit = e.ctrlKey ? 25 : 100
      const step = Math.max(-limit, Math.min(limit, pixels)) * (e.ctrlKey ? 0.006 : 0.001)
      // O canvas não começa na origem da janela (menu lateral e cabeçalho)
      pending = { factor: (pending?.factor ?? 1) * Math.exp(-step), x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (!frame) frame = requestAnimationFrame(apply)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame)
    }
  }, [setCanvasTransform])

  return (
    <div
      ref={viewportRef}
      data-space-canvas
      className={`canvas-background absolute inset-0 overflow-hidden ${handMode ? '[&_*]:!cursor-grab [&_iframe]:pointer-events-none' : ''}`}
      style={{
        cursor: 'grab',
        backgroundColor: '#f4f4f5',
      }}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseDown={handleMouseDown}
    >
      {/* Dot grid background */}
      <DotPattern transform={canvasTransform} />

      {/* Connection lines (SVG overlay, always covers viewport) */}
      <ConnectionLayer />

      {/* World div: transformed space for all nodes */}
      <div
        className="canvas-background absolute top-0 left-0"
        style={{
          transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.zoom})`,
          transformOrigin: '0 0',
          width: 0,
          height: 0,
          overflow: 'visible',
        }}
      >
        {/* Páginas por baixo: as seções delas são nós como os outros, posicionados na coluna */}
        <PagesLayer />
        {nodes.map((node) => {
          if (node.type === 'section') return <SectionNode key={node.id} node={node} />
          if (node.type === 'text') return <TextNode key={node.id} node={node} />
          if (node.type === 'color-palette') return <ColorPaletteNode key={node.id} node={node} />
          return null
        })}
      </div>

    </div>
  )
}
