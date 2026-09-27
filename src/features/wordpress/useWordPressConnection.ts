import { useEffect } from 'react'
import { create } from 'zustand'
import { loadWordPressConnection } from '@/features/projects/storage'
import { listenConnections } from './connect'
import type { WordPressConnection } from './types'

interface WordPressSession {
  projectId?: string
  connection: WordPressConnection | null
  open: (projectId: string) => Promise<void>
  reload: () => Promise<void>
}

/**
 * A conexão do projeto aberto, num store para o canvas usar sem saber de
 * projetos (como a marca). O botão do header é quem abre a sessão.
 */
export const useWordPressSession = create<WordPressSession>()((set, get) => ({
  connection: null,
  open: async (projectId) => {
    if (get().projectId !== projectId) set({ projectId, connection: null })
    const connection = await loadWordPressConnection(projectId).catch((error) => {
      console.error('[wordpress] falha ao ler a conexão', error)
      return undefined
    })
    // Trocou de projeto enquanto lia: a leitura antiga não vale
    if (get().projectId === projectId) set({ connection: connection ?? null })
  },
  reload: async () => {
    const { projectId, open } = get()
    if (projectId) await open(projectId)
  },
}))

/** Conexão do projeto aberto, ou null. */
export const useActiveWordPress = () => useWordPressSession((s) => s.connection)

export const getActiveWordPress = () => useWordPressSession.getState().connection

/** Abre a conexão do projeto e relê quando outra janela (a de aprovação) avisa que mudou. */
export function useWordPressConnection(projectId: string | undefined) {
  const session = useWordPressSession()

  useEffect(() => {
    if (!projectId) return
    const { open } = useWordPressSession.getState()
    open(projectId)
    return listenConnections((message) => {
      if (message.projectId === projectId && (message.type === 'connected' || message.type === 'disconnected')) open(projectId)
    })
  }, [projectId])

  const current = session.projectId === projectId
  return { connection: current ? session.connection : null, reload: session.reload }
}
