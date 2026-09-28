import { useEffect } from 'react'
import { create } from 'zustand'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import type { Brand } from '@/features/space/brand/designMd'
import type { SpaceNode, SpacePage } from '@/types/space'
import { revokeApplicationPassword } from '@/features/wordpress/connect'
import { forgetBrowserProject } from './browserDb'
import { deleteProject, insertProject, listProjects, loadWordPressConnection, updateProject } from './storage'
import type { Project, ProjectSummary } from './types'

export type ListStatus = 'loading' | 'ready' | 'error'

interface ProjectState {
  /** Conta da lista carregada. */
  userId?: string
  status: ListStatus
  projects: Project[]
  /** Lê a lista da conta; trocar de conta esvazia a lista antes. */
  load: (userId: string) => Promise<void>
  create: (fields: { name: string; context?: string }) => Promise<Project>
  update: (id: string, fields: Partial<Pick<Project, 'name' | 'context'>>) => Promise<void>
  /** Apaga da conta o projeto, o canvas, a marca e a conexão com o WordPress (revogada no site). */
  remove: (id: string) => Promise<void>
  /** Chamado a cada mudança no canvas; `edited` diz se o conteúdo mudou. Só atualiza o card daqui. */
  saved: (id: string, summary: ProjectSummary, edited: boolean) => void
}

const EMPTY_SUMMARY: ProjectSummary = { sections: 0, colors: [] }

// Logo em data URL muito grande não entra no resumo, que vem junto com a lista
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

const replace = (projects: Project[], project: Project) => projects.map((p) => (p.id === project.id ? project : p))

/** A lista de projetos da conta aberta. O conteúdo de cada um só é lido ao abrir. */
export const useProjectStore = create<ProjectState>()((set, get) => ({
  status: 'loading',
  projects: [],

  load: async (userId) => {
    if (get().userId !== userId) set({ userId, projects: [], status: 'loading' })
    else if (get().status === 'error') set({ status: 'loading' })
    try {
      const listed = await listProjects()
      if (get().userId !== userId) return
      // O projeto que acabou de ser fechado pode ainda estar subindo: o card daqui é mais novo
      const local = new Map(get().projects.map((p) => [p.id, p]))
      const projects = listed.map((p) => {
        const mine = local.get(p.id)
        return mine && mine.updatedAt > p.updatedAt ? { ...p, summary: mine.summary, updatedAt: mine.updatedAt } : p
      })
      set({ projects, status: 'ready' })
    } catch (error) {
      console.error('[projetos] falha ao ler a lista', error)
      if (get().userId === userId && get().status !== 'ready') set({ status: 'error' })
    }
  },

  create: async ({ name, context = '' }) => {
    const now = Date.now()
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Projeto sem nome',
      context,
      createdAt: now,
      updatedAt: now,
      summary: EMPTY_SUMMARY,
    }
    await insertProject(project)
    set({ projects: [...get().projects, project] })
    return project
  },

  update: async (id, fields) => {
    const before = get().projects.find((p) => p.id === id)
    if (!before) return
    const next = { ...before, ...fields, name: fields.name?.trim() || before.name, updatedAt: Date.now() }
    set({ projects: replace(get().projects, next) })
    try {
      await updateProject(id, next)
    } catch (error) {
      console.error('[projetos] falha ao salvar nome e contexto', error)
      const current = get().projects.find((p) => p.id === id)
      if (current) set({ projects: replace(get().projects, { ...current, name: before.name, context: before.context }) })
      toast.error('Não foi possível salvar o nome e o contexto', { description: 'Confira a internet e tente de novo.' })
    }
  },

  remove: async (id) => {
    const index = get().projects.findIndex((p) => p.id === id)
    const project = get().projects[index]
    // A conexão sai junto com o projeto: lida antes, para revogar a senha no site depois
    const connection = await loadWordPressConnection(id).catch(() => undefined)
    set({ projects: get().projects.filter((p) => p.id !== id) })
    try {
      await deleteProject(id)
    } catch (error) {
      if (project) {
        const projects = [...get().projects]
        projects.splice(index, 0, project)
        set({ projects })
      }
      throw error
    }
    // Sem esperar o site: se ele não responder, a conexão some daqui do mesmo jeito
    if (connection) revokeApplicationPassword(connection).catch((error) => console.error('[wordpress] falha ao revogar', error))
    forgetBrowserProject(id).catch((error) => console.warn('[projetos] cópia do navegador não apagada', error))
  },

  saved: (id, summary, edited) => {
    set({
      projects: get().projects.map((p) =>
        p.id === id ? { ...p, summary, updatedAt: edited ? Date.now() : p.updatedAt } : p
      ),
    })
  },
}))

/** Lê de novo a lista da conta carregada (depois de uma falha, por exemplo). */
export const reloadProjects = () => {
  const { userId, load } = useProjectStore.getState()
  if (userId) void load(userId)
}

export const useProject = (id: string | undefined) =>
  useProjectStore((s) => s.projects.find((p) => p.id === id))

/**
 * Carrega a lista da conta aberta e diz em que pé ela está. `refresh` relê
 * mesmo já carregada: outro aparelho pode ter mudado a lista.
 */
export function useProjectList({ refresh = false } = {}): ListStatus {
  const userId = useAuth().user?.id
  const status = useProjectStore((s) => (s.userId === userId ? s.status : 'loading'))

  useEffect(() => {
    if (!userId) return
    const state = useProjectStore.getState()
    if (refresh || state.userId !== userId || state.status === 'error') state.load(userId)
  }, [userId, refresh])

  return status
}
