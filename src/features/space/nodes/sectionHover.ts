import { create } from 'zustand'

/**
 * Seção com o mouse em cima, para o contorno e as alças. O `:hover` do CSS não
 * atravessa o iframe da seção (ele roda em outro processo), então quem avisa é
 * o movimento que o iframe repassa (`se-preview-pointer`) e o das alças.
 */
export const useSectionHover = create<{ id: string | null; set: (id: string | null) => void }>()((set, get) => ({
  id: null,
  set: (id) => {
    if (get().id !== id) set({ id })
  },
}))
