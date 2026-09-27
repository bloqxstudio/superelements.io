import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Brand } from '@/features/space/brand/designMd'
import type { SpaceNode, SpacePage } from '@/types/space'
import { deleteProjectDoc } from './storage'
import type { Project, ProjectSummary } from './types'

interface ProjectState {
  projects: Project[]
  create: (fields: { name: string; context?: string }) => Project
  update: (id: string, fields: Partial<Pick<Project, 'name' | 'context'>>) => void
  /** Apaga o projeto da lista e o canvas e a marca dele. */
  remove: (id: string) => Promise<void>
  /** Chamado a cada salvamento do canvas; `edited` diz se o conteúdo mudou. */
  saved: (id: string, summary: ProjectSummary, edited: boolean) => void
}

const EMPTY_SUMMARY: ProjectSummary = { sections: 0, colors: [] }

// Logo em data URL muito grande não entra na lista (localStorage)
const MAX_LOGO_LENGTH = 20_000

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
}

/**
 * Cores do card, a principal primeiro: a chamada de primária, ou a primeira
 * que não é quase branca nem quase preta (fundos e texto costumam vir antes).
 */
const cardColors = (brand: Brand | null) => {
  const colors = brand?.colors ?? []
  const main =
    colors.find((c) => /primar|principal|brand|marca/i.test(c.name)) ??
    colors.find((c) => luminance(c.hex) > 24 && luminance(c.hex) < 232) ??
    colors[0]
  const ordered = main ? [main, ...colors.filter((c) => c !== main)] : colors
  return [...new Set(ordered.map((c) => c.hex.toLowerCase()))].slice(0, 5)
}

export const summarize = (nodes: SpaceNode[], brand: Brand | null, pages?: SpacePage[]): ProjectSummary => {
  const logo = brand?.logo?.onLight ?? brand?.logo?.symbol
  return {
    sections: nodes.filter((n) => n.type === 'section').length,
    pages: pages?.length,
    brandName: brand?.name || undefined,
    colors: cardColors(brand),
    logo: logo && logo.length <= MAX_LOGO_LENGTH ? logo : undefined,
  }
}

/** A lista de projetos, pequena o bastante para o localStorage. */
export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],

      create: ({ name, context = '' }) => {
        const now = Date.now()
        const project: Project = {
          id: crypto.randomUUID(),
          name: name.trim() || 'Projeto sem nome',
          context,
          createdAt: now,
          updatedAt: now,
          summary: EMPTY_SUMMARY,
        }
        set({ projects: [...get().projects, project] })
        return project
      },

      update: (id, fields) => {
        set({
          projects: get().projects.map((p) =>
            p.id === id
              ? { ...p, ...fields, name: fields.name?.trim() || p.name, updatedAt: Date.now() }
              : p
          ),
        })
      },

      remove: async (id) => {
        set({ projects: get().projects.filter((p) => p.id !== id) })
        await deleteProjectDoc(id)
      },

      saved: (id, summary, edited) => {
        set({
          projects: get().projects.map((p) =>
            p.id === id ? { ...p, summary, updatedAt: edited ? Date.now() : p.updatedAt } : p
          ),
        })
      },
    }),
    { name: 'superelements-projects' }
  )
)

export const useProject = (id: string | undefined) =>
  useProjectStore((s) => s.projects.find((p) => p.id === id))
