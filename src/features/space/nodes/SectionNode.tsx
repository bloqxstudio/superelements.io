import React, { useRef, useEffect, useCallback } from 'react'
import { X, LayoutTemplate } from 'lucide-react'
import { useSpaceStore } from '@/store/spaceStore'
import type { SpaceNode, SectionNodeData } from '@/types/space'

interface SectionNodeProps {
  node: SpaceNode
}

export const SectionNode: React.FC<SectionNodeProps> = ({ node }) => {
  const { updateNodePosition, updateNodeData, updateNodeSize, removeNode, startConnection, completeConnection, canvasTransform } = useSpaceStore()
  const data = node.data as SectionNodeData
  const cardRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Track node height for accurate port positioning
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

  const handleInputPortMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      completeConnection(node.id)
    },
    [node.id, completeConnection]
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
      className="rounded-xl border border-gray-200 bg-white shadow-md"
    >
      {/* Input port */}
      <div
        className="absolute w-3 h-3 rounded-full bg-gray-400 border-2 border-white shadow-sm cursor-crosshair hover:bg-blue-400 transition-colors z-10"
        style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
        onMouseUp={handleInputPortMouseUp}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="h-3 w-3 text-gray-400" />
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Seção</span>
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => removeNode(node.id)}
          className="text-gray-300 hover:text-red-400 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={data.title}
          onChange={(e) => updateNodeData(node.id, { title: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Título da seção"
          className="w-full text-xs font-medium text-gray-700 bg-transparent border-0 border-b border-gray-100 pb-1 focus:outline-none focus:border-blue-300 placeholder-gray-300"
        />
        <textarea
          value={data.elementorJson}
          onChange={(e) => updateNodeData(node.id, { elementorJson: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder='Cole o JSON do Elementor aqui...'
          rows={4}
          className="w-full text-[10px] font-mono text-gray-600 bg-gray-50 rounded-lg border border-gray-100 px-2 py-1.5 focus:outline-none focus:border-blue-300 resize-none placeholder-gray-300"
        />
        {data.elementorJson && (() => {
          try {
            JSON.parse(data.elementorJson)
            return <p className="text-[10px] text-emerald-500 font-medium">✓ JSON válido</p>
          } catch {
            return <p className="text-[10px] text-red-400 font-medium">⚠ JSON inválido</p>
          }
        })()}
      </div>

      {/* Output port */}
      <div
        className="absolute w-3 h-3 rounded-full bg-blue-400 border-2 border-white shadow-sm cursor-crosshair hover:bg-blue-600 transition-colors z-10"
        style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        onMouseDown={handleOutputPortMouseDown}
      />
    </div>
  )
}
