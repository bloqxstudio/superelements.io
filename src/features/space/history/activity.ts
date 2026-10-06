import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { keepVersionBefore, loadVersionDoc, type ProjectVersion } from '@/features/projects/storage'
import { onCanvasRemoval, useSpaceStore, type CanvasRemoval } from '@/store/spaceStore'
import type { PageDetails, SectionNodeData, SpaceNode } from '@/types/space'

/**
 * Registro de atividades do projeto (tabela `space_project_events`): quem fez
 * o quê. O banco grava sozinho o que passa por ele (projeto excluído,
 * renomeado, pessoas, convites, WordPress, links de aprovação); daqui saem as
 * ações do canvas. Excluir uma página ou seção guarda a cópia inteira, que a
 * lixeira restaura.
 */

export interface ActivityEvent {
  id: string
  projectId: string
  actorId: string | null
  actorEmail: string
  action: string
  target: string
  details: Record<string, unknown>
  at: number
}

/** O que a lixeira guarda de uma página. */
interface TrashedPage {
  id: string
  name: string
  details?: PageDetails
  sections: SectionNodeData[]
}

export const TRASH_ACTIONS = ['page.deleted', 'section.deleted', 'canvas.cleared'] as const

const sectionData = (nodes: SpaceNode[]) => nodes.filter((n) => n.type === 'section').map((n) => n.data as SectionNodeData)

let warned = false
const missingFunction = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find/i.test(error.message ?? ''))

/** Grava uma ação no registro; sem a migração aplicada, avisa uma vez no console e segue. */
export async function logEvent(projectId: string, action: string, target: string, details: Record<string, unknown> = {}) {
  const { error } = await supabase.rpc('space_log_event', { p_project: projectId, p_action: action, p_target: target.slice(0, 200), p_details: details as Json })
  if (!error) return true
  if (missingFunction(error)) {
    if (!warned) console.warn('[histórico] o registro de atividades não está no banco: aplique a migração 20261006190000_space_activity_log.sql')
    warned = true
  } else console.warn('[histórico] ação não registrada', action, error)
  return false
}

/** O registro do projeto, o mais novo primeiro; null sem a migração aplicada. */
export async function listEvents(projectId: string): Promise<ActivityEvent[] | null> {
  const { data, error } = await supabase
    .from('space_project_events')
    .select('id, project_id, actor_id, actor_email, action, target, details, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(300)
  if (missingFunction(error)) return null
  if (error) throw error
  return data.map((e) => ({
    id: e.id,
    projectId: e.project_id,
    actorId: e.actor_id,
    actorEmail: e.actor_email,
    action: e.action,
    target: e.target,
    details: (e.details ?? {}) as Record<string, unknown>,
    at: Date.parse(e.created_at),
  }))
}

/** A cópia de uma exclusão, como vai para o registro. */
export function removalEvent(removal: CanvasRemoval): { action: string; target: string; details: Record<string, unknown> } {
  if (removal.kind === 'page') {
    const page: TrashedPage = { id: removal.page.id, name: removal.page.name, details: removal.page.details, sections: sectionData(removal.nodes) }
    return { action: 'page.deleted', target: removal.page.name, details: { page } }
  }
  if (removal.kind === 'section') {
    const section = removal.node.data as SectionNodeData
    return { action: 'section.deleted', target: section.title || 'Seção sem nome', details: { section, pageId: removal.pageId, pageName: removal.pageName, index: removal.index } }
  }
  const byId = new Map(removal.nodes.map((n) => [n.id, n]))
  const pages: TrashedPage[] = removal.pages.map((p) => ({
    id: p.id,
    name: p.name,
    details: p.details,
    sections: sectionData(p.sectionIds.map((id) => byId.get(id)).filter((n): n is SpaceNode => !!n)),
  }))
  return { action: 'canvas.cleared', target: `${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}`, details: { pages } }
}

/**
 * Liga o registro ao canvas aberto: cada exclusão vai para o histórico com a
 * cópia (a lixeira) e o próximo salvamento guarda a versão de antes dela.
 */
export function useActivityLog() {
  useEffect(
    () =>
      onCanvasRemoval((removal) => {
        const projectId = useProjectSync.getState().openId
        if (!projectId) return
        keepVersionBefore(projectId, 'delete')
        const { action, target, details } = removalEvent(removal)
        void logEvent(projectId, action, target, details)
      }),
    []
  )
}

/** Um nome que ainda não existe no canvas: "Sobre", "Sobre (restaurada)". */
const freeName = (name: string) => {
  const names = new Set(useSpaceStore.getState().pages.map((p) => p.name.trim().toLowerCase()))
  if (!names.has(name.trim().toLowerCase())) return name
  let candidate = `${name} (restaurada)`
  for (let n = 2; names.has(candidate.toLowerCase()); n++) candidate = `${name} (restaurada ${n})`
  return candidate
}

const restorePages = (pages: TrashedPage[]) => {
  let first: string | undefined
  for (const page of pages) {
    const store = useSpaceStore.getState()
    const pageId = store.addPage(freeName(page.name))
    first ??= pageId
    if (page.details) store.setPageDetails(pageId, page.details)
    if (page.sections.length) useSpaceStore.getState().addSections(page.sections, { pageId })
  }
  if (first) useSpaceStore.getState().focusPage(first)
}

/** Devolve ao canvas o que uma exclusão levou; a restauração também fica no registro. */
export function restoreFromTrash(event: ActivityEvent) {
  const projectId = useProjectSync.getState().openId
  if (!projectId) throw new Error('Abra o projeto para restaurar.')
  const details = event.details as {
    page?: TrashedPage
    pages?: TrashedPage[]
    section?: SectionNodeData
    pageId?: string
    index?: number
  }
  keepVersionBefore(projectId, 'restore')
  if (event.action === 'page.deleted' && details.page) restorePages([details.page])
  else if (event.action === 'canvas.cleared' && details.pages) restorePages(details.pages)
  else if (event.action === 'section.deleted' && details.section) {
    const store = useSpaceStore.getState()
    // Volta para a página de onde saiu, no mesmo lugar; sem ela, para o fim da página ativa
    const original = store.pages.find((p) => p.id === details.pageId)
    const page = original ?? store.pages.find((p) => p.id === store.activePageId) ?? store.pages[0]
    if (!page) throw new Error('O canvas não tem página para receber a seção.')
    store.addSections([details.section], { pageId: page.id, index: original && typeof details.index === 'number' && details.index >= 0 ? details.index : undefined })
  } else throw new Error('Esta exclusão não guardou a cópia.')
  void logEvent(projectId, event.action.replace(/\.(deleted|cleared)$/, '.restored'), event.target, { restores: event.id })
}

/** Volta o canvas inteiro para uma versão guardada; a de agora fica guardada antes. */
export async function restoreVersion(version: ProjectVersion) {
  const projectId = useProjectSync.getState().openId
  if (!projectId) throw new Error('Abra o projeto para restaurar.')
  const doc = await loadVersionDoc(version.path)
  if (!doc?.canvas) throw new Error('O arquivo desta versão não foi encontrado.')
  if (!doc.canvas.pages?.length) throw new Error('Esta versão é de antes das páginas e não pode ser aberta por aqui.')
  keepVersionBefore(projectId, 'restore')
  useSpaceStore.getState().commitCanvas({ pages: doc.canvas.pages, nodes: doc.canvas.nodes, connections: doc.canvas.connections })
  void logEvent(projectId, 'version.restored', new Date(version.savedAt).toLocaleString('pt-BR'), { version: version.id, revision: version.revision })
}
