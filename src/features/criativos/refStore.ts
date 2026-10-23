import { create } from 'zustand'

/**
 * O que a pessoa marcou com @ (ou pelo botão "Referenciar" no canvas) para
 * trazer ao pedido: um post, um slide, um projeto da conta ou um case.
 */

export type RefKind = 'post' | 'slide' | 'project' | 'case'

export interface Ref {
  id: string
  kind: RefKind
  label: string
  postId?: string
  slideId?: string
  projectId?: string
  /** Slug do case; `*` são todos. */
  slug?: string
}

interface RefState {
  refs: Ref[]
  /** Sobe a cada pedido para focar a caixa do chat (o canvas manda e o chat abre). */
  focus: number
  add: (ref: Ref, focus?: boolean) => void
  remove: (id: string) => void
  clear: () => void
}

export const useRefs = create<RefState>()((set) => ({
  refs: [],
  focus: 0,
  add: (ref, focus = false) => set((s) => ({ refs: s.refs.some((r) => r.id === ref.id) ? s.refs : [...s.refs, ref], focus: focus ? s.focus + 1 : s.focus })),
  remove: (id) => set((s) => ({ refs: s.refs.filter((r) => r.id !== id) })),
  clear: () => set({ refs: [] }),
}))
