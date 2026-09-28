import { create } from 'zustand'
import { createShare, deleteShare, listShares, updateShare, type PageShare } from './shares'

/** Os links de aprovação do projeto aberto, por página. */
interface ApprovalState {
  projectId?: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  shares: Record<string, PageShare>
  /** O player abre com o painel de aprovação à mostra (o selo da página pede isso). */
  panelOpen: boolean
  load: (projectId: string) => Promise<void>
  /** Cria o link da página ou troca a foto dele pela página de agora. */
  publish: (pageId: string, fields: { projectName: string; pageName: string; html: string }) => Promise<PageShare>
  revoke: (pageId: string) => Promise<void>
  setPanelOpen: (open: boolean) => void
}

const byPage = (shares: PageShare[]) => Object.fromEntries(shares.map((s) => [s.pageId, s]))

export const useApprovalStore = create<ApprovalState>()((set, get) => ({
  status: 'idle',
  shares: {},
  panelOpen: false,

  load: async (projectId) => {
    // Trocar de projeto esvazia antes; reler o mesmo mantém o que já está na tela
    if (get().projectId !== projectId) set({ projectId, shares: {}, status: 'loading' })
    try {
      const shares = await listShares(projectId)
      if (get().projectId === projectId) set({ shares: byPage(shares), status: 'ready' })
    } catch (error) {
      console.warn('[aprovação] links não lidos', error)
      if (get().projectId === projectId && get().status !== 'ready') set({ status: 'error' })
    }
  },

  publish: async (pageId, fields) => {
    const projectId = get().projectId
    if (!projectId) throw new Error('Abra um projeto para criar o link.')
    const current = get().shares[pageId]
    const share = current ? await updateShare(current, fields) : await createShare(projectId, pageId, fields)
    if (get().projectId === projectId) set({ shares: { ...get().shares, [pageId]: share } })
    return share
  },

  revoke: async (pageId) => {
    const share = get().shares[pageId]
    if (!share) return
    await deleteShare(share)
    const shares = { ...get().shares }
    delete shares[pageId]
    set({ shares })
  },

  setPanelOpen: (panelOpen) => set({ panelOpen }),
}))

export const loadApprovals = (projectId: string) => useApprovalStore.getState().load(projectId)

/** Situação do link para o selo e o painel: a resposta mais nova da versão que o cliente está vendo. */
export const shareState = (share: PageShare | undefined) => {
  if (!share) return { kind: 'none' as const }
  const latest = share.responses.find((r) => r.version === share.version)
  if (!latest) return { kind: 'waiting' as const, share }
  return { kind: latest.decision, share, latest }
}
