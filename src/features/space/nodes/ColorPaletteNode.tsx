import React, { useRef, useEffect, useCallback } from 'react'
import { X, Palette, Plus, Trash2 } from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpaceNode, ColorPaletteNodeData } from '@/types/space'

interface ColorPaletteNodeProps {
  node: SpaceNode
}

export const ColorPaletteNode: React.FC<ColorPaletteNodeProps> = ({ node }) => {
  const { updateNodePosition, updateNodeData, updateNodeSize, removeNode, startConnection, canvasTransform } = useSpaceStore()
  const data = node.data as ColorPaletteNodeData
  const cardRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        updateNodeSize(node.id, node.width, entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [node.id, node.width, updateNodeSize])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      isDragging.current = true
      dragOffset.current = {
        x: e.clientX - node.x * canvasTransform.zoom - canvasTransform.x,
        y: e.clientY - node.y * canvasTransform.zoom - canvasTransform.y,
      }

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const newX = (e.clientX - canvasTransform.x - dragOffset.current.x) / canvasTransform.zoom
        const newY = (e.clientY - canvasTransform.y - dragOffset.current.y) / canvasTransform.zoom
        updateNodePosition(node.id, newX, newY)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [node.id, node.x, node.y, canvasTransform, updateNodePosition]
  )

  const handleOutputPortMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const portCenterX = rect.left + rect.width / 2
      const portCenterY = rect.top + rect.height / 2
      startConnection(node.id, portCenterX, portCenterY)
    },
    [node.id, startConnection]
  )

  const updateColor = (index: number, color: string) => {
    const newColors = [...data.colors]
    newColors[index] = color
    updateNodeData(node.id, { colors: newColors })
  }

  const addColor = () => {
    if (data.colors.length >= 8) return
    updateNodeData(node.id, { colors: [...data.colors, '#94a3b8'] })
  }

  const removeColor = (index: number) => {
    if (data.colors.length <= 1) return
    const newColors = data.colors.filter((_, i) => i !== index)
    updateNodeData(node.id, { colors: newColors })
  }

  return (
    <div
      ref={cardRef}
      onMouseDown={handleDragStart}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        cursor: 'grab',
        userSelect: 'none',
      }}
      className="rounded-xl border border-violet-200 bg-violet-50 shadow-md"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-violet-100 bg-violet-100/50 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Palette className="h-3 w-3 text-violet-500" />
          <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">Paleta de Cores</span>
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => removeNode(node.id)}
          className="text-violet-300 hover:text-red-400 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={data.name}
          onChange={(e) => updateNodeData(node.id, { name: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Nome da paleta"
          className="w-full text-xs font-medium text-gray-700 bg-transparent border-0 border-b border-violet-100 pb-1 focus:outline-none focus:border-violet-300 placeholder-violet-300"
        />

        {/* Color swatches */}
        <div className="flex flex-wrap gap-1.5">
          {data.colors.map((color, i) => (
            <div key={i} className="relative group" onMouseDown={(e) => e.stopPropagation()}>
              <input
                type="color"
                value={color}
                onChange={(e) => updateColor(i, e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border-2 border-white shadow-sm"
                style={{ backgroundColor: color }}
                title={color}
              />
              {data.colors.length > 1 && (
                <button
                  onClick={() => removeColor(i)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-400 text-white rounded-full items-center justify-center hidden group-hover:flex transition-all"
                >
                  <Trash2 className="h-2 w-2" />
                </button>
              )}
            </div>
          ))}
          {data.colors.length < 8 && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={addColor}
              className="w-8 h-8 rounded-lg border-2 border-dashed border-violet-200 text-violet-300 hover:border-violet-400 hover:text-violet-500 transition-colors flex items-center justify-center"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Hex values */}
        <div className="flex flex-wrap gap-1">
          {data.colors.map((color, i) => (
            <span key={i} className="text-[9px] font-mono text-violet-400 bg-violet-100 px-1 rounded">
              {color}
            </span>
          ))}
        </div>
      </div>

      {/* Output port */}
      <div
        className="absolute w-3 h-3 rounded-full bg-violet-400 border-2 border-white shadow-sm cursor-crosshair hover:bg-violet-600 transition-colors z-10"
        style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        onMouseDown={handleOutputPortMouseDown}
      />
    </div>
  )
}
