import { focusSection } from '@/features/space/bridge/focus'
import { selectElement } from '@/features/space/editor/actions'
import { locate } from '@/features/space/editor/tree'
import { parseSectionElements } from '@/features/space/landingPage'
import type { SectionNodeData, SpaceNode } from '@/types/space'
import { elementComponent, type ComponentUse } from './components'

/** O componente que vale para a seleção: a camada é um uso, está dentro de um, ou a seção inteira é um. */
export function selectionComponent(nodes: SpaceNode[], sectionId: string, elementId?: string) {
  const node = nodes.find((n) => n.id === sectionId)
  if (!node || node.type !== 'section') return null
  const data = node.data as SectionNodeData
  if (elementId) {
    const location = locate(parseSectionElements(data.elementorJson) ?? [], elementId)
    if (location) {
      const own = elementComponent(location.element)
      if (own) return { componentId: own, sectionId, elementId, inside: false }
      for (let i = location.ancestors.length - 1; i >= 0; i--) {
        const ancestor = location.ancestors[i]
        const id = elementComponent(ancestor)
        if (id && ancestor.id) return { componentId: id, sectionId, elementId: ancestor.id, inside: true }
      }
    }
  }
  return data.component ? { componentId: data.component, sectionId, elementId: undefined, inside: !!elementId } : null
}

/** Leva o canvas até o uso e o seleciona. */
export function goToUse(use: ComponentUse) {
  focusSection(use.sectionId)
  selectElement(use.sectionId, use.elementId ?? null)
}

