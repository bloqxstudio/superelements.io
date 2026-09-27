import { create } from 'zustand'
import { LOGO_VARIANTS, measureLogo } from './assets'
import { hash, parseDesignMd, type Brand } from './designMd'

/** O que o projeto guarda da marca; `brand` é sempre relido do texto. */
export interface BrandSnapshot {
  source: string
  enabled: boolean
  logoRatios: Record<string, number>
}

/**
 * A marca do projeto aberto: o DESIGN.md colado ou importado. Fica fora do
 * spaceStore porque não é parte do canvas; limpar o canvas não apaga a marca.
 */
interface BrandState {
  /** Texto do DESIGN.md. */
  source: string
  enabled: boolean
  /** Lido de `source`; null se o arquivo estiver vazio ou inválido. */
  brand: Brand | null
  /** Largura ÷ altura dos arquivos de logo já medidos, pela chave de `ratioKey`. */
  logoRatios: Record<string, number>
  /** Troca a marca pela de um projeto (ou por nenhuma). */
  load: (snapshot?: BrandSnapshot) => void
  setSource: (source: string) => void
  setEnabled: (enabled: boolean) => void
  /** Mede os arquivos do logo que ainda não têm proporção (também os de um rascunho). */
  measureLogos: (brand: Brand | null | undefined) => void
}

// Data URLs são longas demais para servir de chave
const ratioKey = (url: string) => (url.length > 200 ? `${url.length}:${hash(url)}` : url)

const logoUrls = (brand: Brand | null | undefined) =>
  [...new Set(LOGO_VARIANTS.map((v) => brand?.logo?.[v]).filter((u): u is string => !!u))]

/** A marca com as proporções medidas do logo. A chave muda junto, para refazer os previews. */
export function withLogoRatios(brand: Brand | null, ratios: Record<string, number>): Brand | null {
  const logo = brand?.logo
  if (!brand || !logo) return brand
  const measured = Object.fromEntries(
    LOGO_VARIANTS.flatMap((v) => {
      const ratio = logo[v] ? ratios[ratioKey(logo[v]!)] : undefined
      return ratio ? [[v, ratio]] : []
    })
  )
  if (!Object.keys(measured).length) return brand
  const signature = Object.values(measured).map((r) => r.toFixed(3)).join('-')
  return { ...brand, key: `${brand.key}.${signature}`, logo: { ...logo, ratios: measured } }
}

const readBrand = (source: string, ratios: Record<string, number>) =>
  withLogoRatios(source.trim() ? parseDesignMd(source).brand : null, ratios)

const measuring = new Set<string>()

export const useBrandStore = create<BrandState>()((set, get) => ({
  source: '',
  enabled: true,
  brand: null,
  logoRatios: {},
  // A marca é relida do texto: muda junto com o leitor, sem versão salva velha
  load: ({ source, enabled, logoRatios } = { source: '', enabled: true, logoRatios: {} }) => {
    const brand = readBrand(source, logoRatios)
    set({ source, enabled, logoRatios, brand })
    get().measureLogos(brand)
  },
  setSource: (source) => {
    const parsed = source.trim() ? parseDesignMd(source).brand : null
    // Só as proporções do logo atual ficam guardadas
    const keep = new Set(logoUrls(parsed).map(ratioKey))
    const logoRatios = Object.fromEntries(Object.entries(get().logoRatios).filter(([k]) => keep.has(k)))
    set({ source, logoRatios, brand: withLogoRatios(parsed, logoRatios) })
    get().measureLogos(parsed)
  },
  setEnabled: (enabled) => set({ enabled }),
  measureLogos: (brand) => {
    for (const url of logoUrls(brand)) {
      const key = ratioKey(url)
      if (get().logoRatios[key] || measuring.has(key)) continue
      measuring.add(key)
      measureLogo(url).then((ratio) => {
        measuring.delete(key)
        if (!ratio) return
        set((state) => {
          const logoRatios = { ...state.logoRatios, [key]: ratio }
          return { logoRatios, brand: readBrand(state.source, logoRatios) }
        })
      })
    }
  },
}))

const active = (s: BrandState) => (s.enabled ? s.brand : null)

/** Marca ligada, ou null. */
export const useActiveBrand = () => useBrandStore(active)

export const getActiveBrand = () => active(useBrandStore.getState())
