import React, { useRef, useCallback, useEffect } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import { SectionNode } from './nodes/SectionNode'
import { TextNode } from './nodes/TextNode'
import { ColorPaletteNode } from './nodes/ColorPaletteNode'
import { ConnectionLayer } from './ConnectionLayer'

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
  const { nodes, canvasTransform, updatePendingConnection, cancelConnection, setCanvasTransform, panCanvas } =
    useSpaceStore()

  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan if clicking directly on canvas background (not on a node)
      const target = e.target as HTMLElement
      if (target !== e.currentTarget && !target.classList.contains('canvas-background')) return
      isPanning.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }

      const handleMouseMove = (e: MouseEvent) => {
        if (!isPanning.current) return
        const dx = e.clientX - lastPos.current.x
        const dy = e.clientY - lastPos.current.y
        panCanvas(dx, dy)
        lastPos.current = { x: e.clientX, y: e.clientY }
      }

      const handleMouseUp = () => {
        isPanning.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [panCanvas]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.2, Math.min(2.5, canvasTransform.zoom * delta))

      // Zoom toward cursor position
      const worldX = (e.clientX - canvasTransform.x) / canvasTransform.zoom
      const worldY = (e.clientY - canvasTransform.y) / canvasTransform.zoom
      const newX = e.clientX - worldX * newZoom
      const newY = e.clientY - worldY * newZoom

      setCanvasTransform({ zoom: newZoom, x: newX, y: newY })
    },
    [canvasTransform, setCanvasTransform]
  )

  return (
    <div
      ref={viewportRef}
      className="canvas-background absolute inset-0 overflow-hidden"
      style={{
        cursor: 'grab',
        backgroundColor: '#f4f4f5',
      }}
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
        {nodes.map((node) => {
          if (node.type === 'section') return <SectionNode key={node.id} node={node} />
          if (node.type === 'text') return <TextNode key={node.id} node={node} />
          if (node.type === 'color-palette') return <ColorPaletteNode key={node.id} node={node} />
          return null
        })}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm text-xs text-gray-500 font-medium px-2 py-1 rounded-lg border border-gray-200 pointer-events-none">
        {Math.round(canvasTransform.zoom * 100)}%
      </div>
    </div>
  )
}
