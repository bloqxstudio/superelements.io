import type { ElementorKit } from '@/engine/elementor/types'
import type { SiteKit } from '@/features/wordpress/siteKitStore'
import type { SectionNodeData, SpaceNode } from '@/types/space'
import { brandKit } from './brand/applyBrand'
import type { Brand } from './brand/designMd'

/** Seção importada do WordPress do cliente. */
export const isFromSite = (section: SpaceNode) => !!(section.data as SectionNodeData).origin

/**
 * Kit com que o motor desenha: o da marca e, quando há seção importada, o do
 * site por cima, porque ela aponta para as cores e fontes globais do cliente
 * pelo id delas.
 */
export function renderKit(brand: Brand | null, site: SiteKit | null, withSite: boolean): Partial<ElementorKit> | undefined {
  const base = brand ? brandKit(brand) : undefined
  if (!site || !withSite) return base
  return {
    ...base,
    colors: { ...base?.colors, ...site.colors },
    typography: { ...base?.typography, ...site.typography },
  }
}
