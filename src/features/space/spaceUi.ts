import { create } from 'zustand'
import type { LibraryKind } from './library/LibraryPanel'

export type LeftTab = 'pages' | 'layers' | 'library'
export type RightTab = 'agent' | 'style'

/** Abas abertas da última vez, neste navegador. */
const remembered = <T extends string>(key: string, fallback: T, allowed: readonly T[]): T => {
  try {
    const value = localStorage.getItem(key) as T | null
    return value && allowed.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Sem armazenamento a escolha vale só nesta visita
  }
}

interface SpaceUiState {
  left: LeftTab
  library: LibraryKind
  right: RightTab
  /** Ctrl+\ esconde os dois painéis e deixa só o canvas. */
  panels: boolean
  /** Aba da esquerda antes de abrir a Biblioteca, para o Inserir voltar a ela. */
  beforeLibrary: Exclude<LeftTab, 'library'>
  setLeft: (tab: LeftTab) => void
  setRight: (tab: RightTab) => void
  setLibrary: (kind: LibraryKind) => void
  /** Abre a Biblioteca num tipo (Seções, Modelos, Elementos), de qualquer lugar da tela. */
  openLibrary: (kind?: LibraryKind) => void
  /** O "+" da barra: abre a Biblioteca ou, aberta, volta para a aba de antes. */
  toggleInsert: () => void
  togglePanels: () => void
}

/** O que está aberto nos painéis do Space: as abas, o tipo da Biblioteca e se os painéis aparecem. */
export const useSpaceUi = create<SpaceUiState>()((set, get) => {
  const left = remembered<LeftTab>('se-space-left', 'pages', ['pages', 'layers', 'library'])
  return {
    left,
    library: remembered<LibraryKind>('se-space-library', 'sections', ['sections', 'templates', 'elements']),
    right: remembered<RightTab>('se-space-right', 'agent', ['agent', 'style']),
    panels: true,
    beforeLibrary: left === 'library' ? 'pages' : left,
    setLeft: (tab) => {
      remember('se-space-left', tab)
      set(tab === 'library' ? { left: tab } : { left: tab, beforeLibrary: tab })
    },
    setRight: (tab) => {
      remember('se-space-right', tab)
      set({ right: tab })
    },
    setLibrary: (kind) => {
      remember('se-space-library', kind)
      set({ library: kind })
    },
    openLibrary: (kind) => {
      if (kind) get().setLibrary(kind)
      get().setLeft('library')
      set({ panels: true })
    },
    toggleInsert: () => {
      const { left, panels, beforeLibrary } = get()
      if (left === 'library' && panels) get().setLeft(beforeLibrary)
      else get().openLibrary()
    },
    togglePanels: () => set((s) => ({ panels: !s.panels })),
  }
})
