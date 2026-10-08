import { useMemo } from 'react'
import { create } from 'zustand'
import { CHAT_SKILLS, type ChatSkill, type SkillDraft } from '@/features/space/chat/skills'
import { SkillsTableMissing, createSkill, deleteSkill, listSkills, updateSkill, type SkillScope } from './storage'

/**
 * As skills que o chat e a tela Skills mostram: as cadastradas na conta,
 * lidas uma vez e de novo quando a aba volta a ficar visível (alguém pode ter
 * criado uma em outra aba), mais as 7 padrão do código.
 */

/** Ler de novo ao voltar para a aba, no máximo a cada tanto. */
const STALE_AFTER = 30_000

interface SkillsState {
  custom: ChatSkill[]
  /** missing: a migração da tabela não foi aplicada (só as padrão funcionam). */
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
  error?: string
  loadedAt: number
  load: (force?: boolean) => Promise<void>
  save: (draft: SkillDraft, scope: SkillScope, id?: string) => Promise<ChatSkill>
  remove: (id: string) => Promise<void>
}

export const useSkills = create<SkillsState>()((set, get) => ({
  custom: [],
  status: 'idle',
  loadedAt: 0,
  load: async (force = false) => {
    const { status, loadedAt } = get()
    if (status === 'loading' || (!force && status !== 'idle' && status !== 'error' && Date.now() - loadedAt < STALE_AFTER)) return
    set({ status: status === 'ready' ? 'ready' : 'loading' })
    try {
      set({ custom: await listSkills(), status: 'ready', error: undefined, loadedAt: Date.now() })
    } catch (error) {
      if (error instanceof SkillsTableMissing) set({ custom: [], status: 'missing', loadedAt: Date.now() })
      else set({ status: 'error', error: error instanceof Error ? error.message : String(error), loadedAt: Date.now() })
    }
  },
  save: async (draft, scope, id) => {
    const saved = id ? await updateSkill(id, draft, scope) : await createSkill(draft, scope)
    set((s) => ({ custom: [saved, ...s.custom.filter((k) => k.id !== saved.id)] }))
    return saved
  },
  remove: async (id) => {
    await deleteSkill(id)
    set((s) => ({ custom: s.custom.filter((k) => k.id !== id) }))
  },
}))

/** Todas na ordem do menu: as suas, as globais da equipe e as padrão. */
export const orderSkills = (custom: ChatSkill[]): ChatSkill[] => [
  ...custom.filter((s) => s.source === 'personal'),
  ...custom.filter((s) => s.source === 'global'),
  ...CHAT_SKILLS,
]

export function useSkillList() {
  const custom = useSkills((s) => s.custom)
  return useMemo(() => orderSkills(custom), [custom])
}

/** Ler a lista ao abrir e quando a aba volta a ficar visível. */
export function watchSkills() {
  void useSkills.getState().load()
  const onVisible = () => document.visibilityState === 'visible' && void useSkills.getState().load()
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}
