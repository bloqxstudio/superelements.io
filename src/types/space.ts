export type NodeType = 'section' | 'text' | 'color-palette'

export interface SectionNodeData {
  title: string
  elementorJson: string
}

export interface TextNodeData {
  content: string
}

export interface ColorPaletteNodeData {
  name: string
  colors: string[]
}

export type SpaceNodeData = SectionNodeData | TextNodeData | ColorPaletteNodeData

export interface SpaceNode {
  id: string
  type: NodeType
  x: number
  y: number
  width: number
  height: number
  data: SpaceNodeData
}

export interface SpaceConnection {
  id: string
  sourceId: string
  targetId: string
  type: 'apply-copy' | 'apply-colors'
}

export interface CanvasTransform {
  x: number
  y: number
  zoom: number
}

export interface PendingConnection {
  sourceId: string
  sourceX: number
  sourceY: number
  currentX: number
  currentY: number
}
