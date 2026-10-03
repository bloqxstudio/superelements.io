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

/** Dono criou o projeto; editor entrou por convite e faz tudo menos excluir e convidar. */
export type ProjectRole = 'owner' | 'editor'

/** Um projeto por cliente: nome, contexto e o resumo do que está no canvas. */
export interface Project {
  id: string
  /** Sem papel, o projeto é de quem está na conta (os criados antes do compartilhamento). */
  role?: ProjectRole
  name: string
  /** Briefing do cliente (negócio, público, tom, ofertas) para usar depois. */
  context: string
  createdAt: number
  /** Última mudança no conteúdo; mexer só no zoom não conta. */
  updatedAt: number
  summary: ProjectSummary
}

/** O conteúdo pesado do projeto (todas as páginas do canvas), guardado à parte num arquivo da conta. */
export interface ProjectDoc {
  canvas: SpaceCanvas
  brand: BrandSnapshot
  /** Cores e fontes globais do WordPress do cliente, para as páginas importadas. */
  site?: SiteKit | null
}

/** O conteúdo que uma página do site tinha antes de cada atualização feita daqui, o mais novo primeiro. */
export interface PublishBackup {
  elementorData: string
  modifiedGmt: string
  savedAt: number
  /** Layout que a página tinha no site; ausente nas versões guardadas antes de o layout ir junto. */
  template?: string
}
