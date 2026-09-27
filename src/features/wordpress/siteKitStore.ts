import { create } from 'zustand'
import type { KitTypography } from '@/engine/elementor/types'

/**
 * Cores e fontes globais do Elementor do site do cliente (o Kit). As páginas
 * importadas apontam para elas por id (`__globals__`); sem o Kit, o motor
 * desenharia essas seções com as cores de uma instalação limpa do Elementor.
 */
export interface SiteKit {
  siteUrl: string
  colors: Record<string, string>
  typography: Record<string, KitTypography>
  /** Nome de cada cor e fonte no Elementor, por id. */
  titles: Record<string, string>
  importedAt: number
}

interface SiteKitState {
  kit: SiteKit | null
  load: (kit?: SiteKit | null) => void
  setKit: (kit: SiteKit) => void
}

/** O Kit do projeto aberto; o projeto guarda junto com o canvas. */
export const useSiteKitStore = create<SiteKitState>()((set) => ({
  kit: null,
  load: (kit) => set({ kit: kit ?? null }),
  setKit: (kit) => set({ kit }),
}))

export const useSiteKit = () => useSiteKitStore((s) => s.kit)

export const getSiteKit = () => useSiteKitStore.getState().kit
