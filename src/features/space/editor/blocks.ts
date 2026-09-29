import { create } from 'zustand'
import type { SectionElement } from '@/features/space/landingPage'
import type { PinnedSettings } from './pinned'

/**
 * Meus blocos: camadas salvas para reusar em outras seções e projetos, como os
 * templates salvos do Elementor. Ficam neste navegador; inserir cria uma cópia
 * com ids novos (não é um componente ligado: mudar a cópia não muda o bloco).
 */
export interface SavedBlock {
  id: string
  name: string
  element: SectionElement
  pinned: PinnedSettings
  savedAt: number
}

const STORAGE_KEY = 'space-editor-blocks'

const load = (): SavedBlock[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((b) => b && typeof b.id === 'string' && b.element) : []
  } catch {
    return []
  }
}

const save = (blocks: SavedBlock[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks))
    return true
  } catch {
    return false
  }
}

interface BlocksState {
  blocks: SavedBlock[]
  /** Devolve false quando o navegador não deixou guardar (cheio ou bloqueado). */
  add: (block: Omit<SavedBlock, 'id' | 'savedAt'>) => boolean
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}

export const useBlocks = create<BlocksState>((set, get) => ({
  blocks: load(),
  add: (block) => {
    const next = [{ ...block, id: crypto.randomUUID(), savedAt: Date.now() }, ...get().blocks]
    if (!save(next)) return false
    set({ blocks: next })
    return true
  },
  rename: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const next = get().blocks.map((b) => (b.id === id ? { ...b, name: trimmed } : b))
    save(next)
    set({ blocks: next })
  },
  remove: (id) => {
    const next = get().blocks.filter((b) => b.id !== id)
    save(next)
    set({ blocks: next })
  },
}))
