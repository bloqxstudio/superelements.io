import type { MotionSpec } from '@/features/space/brand/layers'

export type NodeType = 'section' | 'text' | 'color-palette'

/**
 * Movimento de uma seção, escolhido no nível Movimento: seguir a marca, manter
 * o que a seção trouxe ou um movimento próprio. Sem valor, segue a marca.
 */
export type SectionMotion = { source: 'brand' } | { source: 'original' } | { source: 'custom'; spec: MotionSpec }

/** Ajustes de uma seção feitos nos níveis de edição; entram depois da marca. */
export interface SectionLevels {
  motion?: SectionMotion
}

/** Camada que o Space está editando. 'structure' é o canvas de sempre (ordem e conteúdo das seções). */
export type EditLevel = 'structure' | 'motion' | 'colors' | 'typography' | 'shape' | 'photos'

export interface SectionNodeData {
  title: string
  elementorJson: string
  /** Id da seção no pack Section Express, quando veio da biblioteca. */
  sourceId?: string
  levels?: SectionLevels
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

/**
 * Página do canvas: agrupa seções numa coluna, na ordem em que vão para o site.
 * Seção de uma página não se arrasta sozinha; fora de página, fica solta.
 */
export interface SpacePage {
  id: string
  name: string
  /** Canto de cima à esquerda do quadro da página, no mundo do canvas. */
  x: number
  y: number
  /** Seções da página, de cima para baixo. */
  sectionIds: string[]
}

/** Onde uma seção arrastada entraria: página e posição na coluna (contada sem a própria seção). */
export interface PageDropTarget {
  pageId: string
  index: number
  /** Seção do canvas sendo arrastada; sem ela, vem da biblioteca. */
  sectionId?: string
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
