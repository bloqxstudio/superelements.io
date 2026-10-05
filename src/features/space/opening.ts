import { create } from 'zustand'
import type { SpaceNode } from '@/types/space'

/**
 * Seções do canvas com o preview já carregado (documento, fontes e altura
 * final). A tela de abertura do projeto espera as que aparecem na tela antes
 * de sair da frente. Cada seção entra quando o preview dela carrega e sai ao
 * desmontar, então reabrir o mesmo projeto começa do zero.
 */
interface OpeningState {
  loaded: Record<string, true>
  markLoaded: (id: string) => void
  forget: (id: string) => void
}

export const useSectionLoading = create<OpeningState>()((set) => ({
  loaded: {},
  markLoaded: (id) => set((s) => (s.loaded[id] ? s : { loaded: { ...s.loaded, [id]: true } })),
  forget: (id) =>
    set((s) => {
      if (!s.loaded[id]) return s
      const loaded = { ...s.loaded }
      delete loaded[id]
      return { loaded }
    }),
}))

/** Seções que cruzam a área visível do canvas (largura e altura dela em px da tela). */
export function sectionsInView(
  nodes: SpaceNode[],
  transform: { x: number; y: number; zoom: number },
  width: number,
  height: number
): string[] {
  const { x, y, zoom } = transform
  return nodes
    .filter((n) => n.type === 'section')
    .filter((n) => {
      const left = n.x * zoom + x
      const top = n.y * zoom + y
      return left < width && left + n.width * zoom > 0 && top < height && top + n.height * zoom > 0
    })
    .map((n) => n.id)
}
