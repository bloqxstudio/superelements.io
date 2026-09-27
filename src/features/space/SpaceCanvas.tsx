import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import { SectionNode } from './nodes/SectionNode'
import { TextNode } from './nodes/TextNode'
import { ColorPaletteNode } from './nodes/ColorPaletteNode'
import { ConnectionLayer } from './ConnectionLayer'
import { PagesLayer } from './pages/PageFrame'

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
  // já que arrastar uma seção leva a seção
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

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.2, Math.min(2.5, canvasTransform.zoom * delta))

      // Zoom toward cursor position; o canvas não começa na origem da janela (menu lateral e cabeçalho)
      const rect = e.currentTarget.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const worldX = (cursorX - canvasTransform.x) / canvasTransform.zoom
      const worldY = (cursorY - canvasTransform.y) / canvasTransform.zoom
      const newX = cursorX - worldX * newZoom
      const newY = cursorY - worldY * newZoom

      setCanvasTransform({ zoom: newZoom, x: newX, y: newY })
    },
    [canvasTransform, setCanvasTransform]
  )

  return (
    <div
      ref={viewportRef}
      data-space-canvas
      className={`canvas-background absolute inset-0 overflow-hidden ${handMode ? '[&_*]:!cursor-grab' : ''}`}
      style={{
        cursor: 'grab',
        backgroundColor: '#f4f4f5',
      }}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
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
