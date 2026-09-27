import { renderElementorDocument } from '@/engine/elementor'
import type { EditLevel, SectionMotion, SectionNodeData, SpaceConnection, SpaceNode } from '@/types/space'
import { brandKit } from '../brand/applyBrand'
import type { Brand } from '../brand/designMd'
import { sectionBase, sectionWithTransforms } from '../landingPage'
import { diffTag, elementDiffs } from './brandDiff'
import { withMarkers, type Marker } from './markers'
import { motionMarks, motionRows, motionTag } from './motion'

/**
 * Miniatura de uma seção vista por um nível: em Movimento as animações rodam
 * e cada peça que anima ganha um marcador; com rascunho, a seção selecionada
 * já aparece como ficaria, e as peças que perdem a animação ficam em cinza.
 * Em Tipografia e Forma, os marcadores mostram o que a marca troca.
 */

interface LensInput {
  section: SpaceNode
  nodes: SpaceNode[]
  connections: SpaceConnection[]
  brand: Brand | null
  level: EditLevel
  /** Rascunho do nível Movimento, só para seções selecionadas. */
  draft?: SectionMotion
  replay?: number
}

export function sectionLensDocument({ section, nodes, connections, brand, level, draft, replay = 0 }: LensInput) {
  const motionDraft = level === 'motion' ? draft : undefined
  const elements = sectionWithTransforms(section, nodes, connections, brand, motionDraft)
  if (!elements) return null

  const title = (section.data as SectionNodeData).title
  const rendered = renderElementorDocument(elements, {
    title,
    kit: brand ? brandKit(brand) : undefined,
    motion: level === 'motion' ? 'play' : 'static',
  })
  if (level === 'structure' || level === 'colors' || level === 'photos') return rendered

  let markers: Marker[] = []
  if (level === 'motion') {
    if (motionDraft) {
      const saved = sectionWithTransforms(section, nodes, connections, brand) ?? elements
      markers = motionRows(saved, elements).map((row) =>
        row.after ? { id: row.id, label: motionTag(row.after) } : { id: row.id, label: motionTag(row.before!), tone: 'removed' as const },
      )
    } else markers = motionMarks(elements)
  } else if (brand) {
    const base = sectionBase(section, nodes, connections) ?? elements
    markers = elementDiffs(base, elements, level).map((diff) => ({ id: diff.id, label: diffTag(diff) }))
  }
  return { ...rendered, document: withMarkers(rendered.document, markers, replay) }
}
