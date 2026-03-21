import React, { useRef, useEffect, useCallback } from 'react'
import { X, Type } from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpaceNode, TextNodeData } from '@/types/space'

interface TextNodeProps {
  node: SpaceNode
}

export const TextNode: React.FC<TextNodeProps> = ({ node }) => {
  const { updateNodePosition, updateNodeData, updateNodeSize, removeNode, startConnection, canvasTransform } = useSpaceStore()
  const data = node.data as TextNodeData
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
      className="rounded-xl border border-amber-200 bg-amber-50 shadow-md"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-amber-100 bg-amber-100/50 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Type className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Texto / Copy</span>
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => removeNode(node.id)}
          className="text-amber-300 hover:text-red-400 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        <textarea
          value={data.content}
          onChange={(e) => updateNodeData(node.id, { content: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Cole sua copy aqui..."
          rows={5}
          className="w-full text-xs text-gray-700 bg-white/60 rounded-lg border border-amber-100 px-2 py-1.5 focus:outline-none focus:border-amber-300 resize-none placeholder-amber-300"
        />
        {data.content && (
          <p className="mt-1 text-[10px] text-amber-500 font-medium">
            {data.content.length} caracteres
          </p>
        )}
      </div>

      {/* Output port */}
      <div
        className="absolute w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow-sm cursor-crosshair hover:bg-amber-600 transition-colors z-10"
        style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        onMouseDown={handleOutputPortMouseDown}
      />
    </div>
  )
}
