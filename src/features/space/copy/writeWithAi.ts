import { supabase } from '@/integrations/supabase/client'
import { useProjectStore } from '@/features/projects/projectStore'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { getActiveBrand } from '@/features/space/brand/brandStore'
import { parseSectionElements } from '@/features/space/landingPage'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionNodeData } from '@/types/space'
import { projectCopy } from './projectCopy'
import { sectionSlots, writeSlots } from './slots'

/**
 * "Escrever com IA" numa seção da biblioteca: manda os espaços de texto da
 * seção, o contexto do projeto, a voz do DESIGN.md e os textos das páginas
 * para a função `space-section-copy`, e grava a resposta na seção (um passo do
 * Ctrl+Z). Contato, números e nomes não vão: ficam como estão.
 */

interface Reply {
  texts?: { id: string; text: string }[]
  error?: string
}

/** Escreve e grava; devolve quantos textos mudaram. */
export async function writeSectionWithAi(sectionId: string): Promise<number> {
  const { nodes, updateNodeData } = useSpaceStore.getState()
  const node = nodes.find((n) => n.id === sectionId)
  const data = node?.data as SectionNodeData | undefined
  const elements = data ? parseSectionElements(data.elementorJson) : null
  if (!node || !data || !elements) throw new Error('A seção não tem um JSON válido.')

  const slots = sectionSlots(elements).filter((s) => !s.keep)
  if (!slots.length) throw new Error('Esta seção não tem textos para escrever.')

  const { openId, projectId: syncing } = useProjectSync.getState()
  const projectId = openId ?? syncing
  const project = useProjectStore.getState().projects.find((p) => p.id === projectId)
  const { data: reply, error } = await supabase.functions.invoke<Reply>('space-section-copy', {
    body: {
      project: { name: project?.name, context: project?.context },
      voice: getActiveBrand()?.guidelines,
      examples: projectCopy(nodes)?.entries.map(({ role, text }) => ({ role, text })),
      section: { title: data.title },
      slots: slots.map(({ id, role, text, size }) => ({ id, role, text, size })),
    },
  })
  if (error) {
    // A função responde o motivo no corpo; o cliente do Supabase só diz o status
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detail?.error ?? error.message)
  }
  if (!reply?.texts?.length) throw new Error(reply?.error ?? 'A IA não devolveu textos.')

  // A seção pode ter mudado enquanto a IA escrevia: grava sobre o JSON atual, se os espaços ainda batem
  const current = useSpaceStore.getState().nodes.find((n) => n.id === sectionId)?.data as SectionNodeData | undefined
  const now = current ? parseSectionElements(current.elementorJson) : null
  if (!now) throw new Error('A seção saiu do canvas.')
  const ids = new Set(sectionSlots(now).map((s) => s.id))
  const values = Object.fromEntries(reply.texts.filter((t) => ids.has(t.id)).map((t) => [t.id, t.text]))
  if (!Object.keys(values).length) throw new Error('A seção mudou enquanto a IA escrevia. Tente de novo.')

  updateNodeData(sectionId, { elementorJson: JSON.stringify(writeSlots(now, values)) }, { merge: false })
  return Object.keys(values).length
}
