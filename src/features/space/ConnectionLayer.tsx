import React, { useRef } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import type { CanvasTransform, SpaceNode, SpaceConnection } from '@/types/space'

function worldToScreen(worldX: number, worldY: number, transform: CanvasTransform) {
  return {
    x: worldX * transform.zoom + transform.x,
    y: worldY * transform.zoom + transform.y,
  }
}

function getOutputPortScreenPos(node: SpaceNode, transform: CanvasTransform) {
  const worldX = node.x + node.width
  const worldY = node.y + node.height / 2
  return worldToScreen(worldX, worldY, transform)
}

function getInputPortScreenPos(node: SpaceNode, transform: CanvasTransform) {
  const worldX = node.x
  const worldY = node.y + node.height / 2
  return worldToScreen(worldX, worldY, transform)
}

function buildBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.5
  const cp1x = x1 + dx
  const cp1y = y1
  const cp2x = x2 - dx
  const cp2y = y2
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
}

interface ConnectionPathProps {
  connection: SpaceConnection
  nodes: SpaceNode[]
  transform: CanvasTransform
  onRemove: (id: string) => void
}

const ConnectionPath: React.FC<ConnectionPathProps> = ({ connection, nodes, transform, onRemove }) => {
  const sourceNode = nodes.find((n) => n.id === connection.sourceId)
  const targetNode = nodes.find((n) => n.id === connection.targetId)
  if (!sourceNode || !targetNode) return null

  const source = getOutputPortScreenPos(sourceNode, transform)
  const target = getInputPortScreenPos(targetNode, transform)
  const pathD = buildBezierPath(source.x, source.y, target.x, target.y)
  const color = connection.type === 'apply-copy' ? '#f59e0b' : '#8b5cf6'
  const midX = (source.x + target.x) / 2
  const midY = (source.y + target.y) / 2

  return (
    <g>
      {/* Invisible wider path for easier click target */}
      <path
        d={pathD}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={() => onRemove(connection.id)}
      />
      <path
        d={pathD}
        stroke={color}
        strokeWidth={2}
        fill="none"
        opacity={0.8}
        style={{ pointerEvents: 'none' }}
      />
      {/* Type label */}
      <rect
        x={midX - 24}
        y={midY - 8}
        width={48}
        height={16}
        rx={4}
        fill={color}
        opacity={0.9}
        style={{ pointerEvents: 'none' }}
      />
      <text
        x={midX}
        y={midY + 4}
        textAnchor="middle"
        fontSize={8}
        fill="white"
        fontWeight="600"
        style={{ pointerEvents: 'none' }}
      >
        {connection.type === 'apply-copy' ? 'copy' : 'cores'}
      </text>
    </g>
  )
}

export const ConnectionLayer: React.FC = () => {
  const { nodes, connections, pendingConnection, canvasTransform, removeConnection } = useSpaceStore()
  const svgRef = useRef<SVGSVGElement>(null)
  // A conexão pendente vem em coordenadas da janela; o SVG começa no canto do canvas
  const origin = pendingConnection ? svgRef.current?.getBoundingClientRect() : undefined
  const ox = origin?.left ?? 0
  const oy = origin?.top ?? 0

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* Rendered connections */}
      <g style={{ pointerEvents: 'all' }}>
        {connections.map((conn) => (
          <ConnectionPath
            key={conn.id}
            connection={conn}
            nodes={nodes}
            transform={canvasTransform}
            onRemove={removeConnection}
          />
        ))}
      </g>

      {/* Pending connection (while dragging) */}
      {pendingConnection && (
        <path
          d={buildBezierPath(
            pendingConnection.sourceX - ox,
            pendingConnection.sourceY - oy,
            pendingConnection.currentX - ox,
            pendingConnection.currentY - oy
          )}
          stroke="#94a3b8"
          strokeWidth={1.5}
          fill="none"
          strokeDasharray="5,5"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  )
}
