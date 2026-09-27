import type { SpaceCanvas } from '@/store/spaceStore'
import type { BrandSnapshot } from '@/features/space/brand/brandStore'
import type { SiteKit } from '@/features/wordpress/siteKitStore'

/** O que o card mostra sem abrir o projeto; refeito a cada salvamento. */
export interface ProjectSummary {
  sections: number
  /** Projetos salvos antes das páginas não têm; contam como uma. */
  pages?: number
  brandName?: string
  /** Até cinco cores da marca, em #rrggbb, a principal primeiro. */
  colors: string[]
  /** Logo para fundo claro (ou o símbolo), se couber na lista. */
  logo?: string
}

/** Um projeto por cliente: nome, contexto e o resumo do que está no canvas. */
export interface Project {
  id: string
  name: string
  /** Briefing do cliente (negócio, público, tom, ofertas) para usar depois. */
  context: string
  createdAt: number
  /** Última mudança no conteúdo; mexer só no zoom não conta. */
  updatedAt: number
  summary: ProjectSummary
}

/** O conteúdo pesado do projeto, guardado à parte no IndexedDB. */
export interface ProjectDoc {
  canvas: SpaceCanvas
  brand: BrandSnapshot
  /** Cores e fontes globais do WordPress do cliente, para as páginas importadas. */
  site?: SiteKit | null
}
