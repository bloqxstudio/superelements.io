import { create } from 'zustand'
import { toast } from 'sonner'
import { loadDoc, saveDoc } from './storage'
import { mergePatch, type CopyPatch } from './patch'
import type { Block, CopyDoc } from './types'

/**
 * Estado do documento aberto: o texto, o que está em foco, o histórico para
 * desfazer e o salvamento automático. Digitar vira rascunho (sem histórico) e
 * um passo do histórico quando a pessoa para por um instante.
 */

const HISTORY = 80

interface CopyState {
  doc?: CopyDoc
  status: 'loading' | 'ready' | 'missing' | 'error'
  /** O bloco onde a pessoa está escrevendo. */
  focusId?: string
  /** Os blocos escolhidos (para pedir algo a um agente só sobre eles). */
  selection: string[]
  past: CopyDoc[]
  future: CopyDoc[]
  saving: 'saved' | 'dirty' | 'saving' | 'error'

  open: (id: string, projectId?: string) => Promise<void>
  close: () => void
  setFocus: (id?: string) => void
  select: (ids: string[]) => void
  /** Troca o documento sem abrir passo no histórico (digitação, agente escrevendo). */
  draft: (fn: (doc: CopyDoc) => CopyDoc) => void
  /** Grava o rascunho atual como um passo desfazível. */
  checkpoint: (before: CopyDoc) => void
  edit: (fn: (doc: CopyDoc) => CopyDoc) => void
  undo: () => void
  redo: () => void
  flush: () => Promise<void>
  persist: () => void
  /** Uma mudança de outra pessoa: entra sem histórico nem salvamento daqui. */
  applyRemote: (patch: CopyPatch) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useCopy = create<CopyState>()((set, get) => {
  const schedule = () => {
    set({ saving: 'dirty' })
    clearTimeout(timer)
    timer = setTimeout(() => void get().flush(), 1200)
  }
  const stamp = (d: CopyDoc): CopyDoc => ({ ...d, updatedAt: Date.now() })

  return {
    status: 'loading',
    selection: [],
    past: [],
    future: [],
    saving: 'saved',

    open: async (id, projectId) => {
      set({ status: 'loading', doc: undefined, past: [], future: [], selection: [], focusId: undefined, saving: 'saved' })
      try {
        const loaded = await loadDoc(id, projectId)
        if (!loaded) return set({ status: 'missing' })
        set({ doc: loaded, status: 'ready' })
      } catch (err) {
        console.error('[copy]', err)
        set({ status: 'error' })
      }
    },
    close: () => {
      void get().flush()
      set({ doc: undefined, status: 'loading' })
    },
    setFocus: (focusId) => set({ focusId }),
    select: (selection) => set({ selection }),
    draft: (fn) => {
      const doc = get().doc
      if (doc) set({ doc: stamp(fn(doc)) })
    },
    checkpoint: (before) => {
      set((s) => ({ past: [...s.past, before].slice(-HISTORY), future: [] }))
      set((s) => ({ doc: s.doc ? stamp(s.doc) : s.doc }))
      schedule()
    },
    edit: (fn) => {
      const doc = get().doc
      if (!doc) return
      set((s) => ({ past: [...s.past, doc].slice(-HISTORY), future: [], doc: stamp(fn(doc)) }))
      schedule()
    },
    undo: () => {
      const { past, doc } = get()
      const previous = past.at(-1)
      if (!previous || !doc) return
      set((s) => ({ past: s.past.slice(0, -1), future: [doc, ...s.future], doc: stamp(previous) }))
      schedule()
    },
    redo: () => {
      const { future, doc } = get()
      const next = future[0]
      if (!next || !doc) return
      set((s) => ({ future: s.future.slice(1), past: [...s.past, doc], doc: stamp(next) }))
      schedule()
    },
    persist: () => schedule(),
    applyRemote: (patch) => {
      const doc = get().doc
      if (!doc) return
      // O desfazer e o refazer também recebem, para não desfazer o trabalho dos outros
      set((s) => ({ doc: mergePatch(doc, patch), past: s.past.map((x) => mergePatch(x, patch)), future: s.future.map((x) => mergePatch(x, patch)) }))
    },
    flush: async () => {
      clearTimeout(timer)
      const { doc, saving } = get()
      if (!doc || saving === 'saved' || saving === 'saving') return
      set({ saving: 'saving' })
      try {
        await saveDoc(doc)
        set((s) => ({ saving: s.doc?.updatedAt === doc.updatedAt ? 'saved' : 'dirty' }))
      } catch (err) {
        console.error('[copy] salvar', err)
        toast.error('Não consegui salvar o documento. Vou tentar de novo.')
        set({ saving: 'error' })
        timer = setTimeout(() => void get().flush(), 5000)
      }
    },
  }
})

export const blockById = (doc: CopyDoc | undefined, id: string | undefined): Block | undefined => doc?.blocks.find((b) => b.id === id)
