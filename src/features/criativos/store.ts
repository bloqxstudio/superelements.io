import { create } from 'zustand'
import { toast } from 'sonner'
import { EMPHASIS_FONT, loadFont, loadImage, type ImageMap } from './render'
import { loadSet, saveSet, assetUrl } from './storage'
import { mergePatch, type SyncPatch } from './syncPatch'
import { syncSpans } from './spanOps'
import type { CreativeSet, FormatId, Layer, Post, Slide } from './types'
import { sizeOf } from './types'

/**
 * Estado do editor aberto: o conjunto, o que está selecionado, o histórico para
 * desfazer e o salvamento automático. Mexer numa camada ou arrastar vira um
 * passo do histórico; `commit: false` serve ao arrasto, que só grava ao soltar.
 */

const HISTORY = 60

interface EditorState {
  set?: CreativeSet
  status: 'loading' | 'ready' | 'missing' | 'error'
  postId?: string
  slideId?: string
  layerId?: string
  /** Os componentes escolhidos no slide (um ou mais); `layerId` é o último escolhido. */
  layerIds: string[]
  /** O post inteiro está escolhido (todos os cards da fileira), não só um slide. */
  row?: boolean
  images: ImageMap
  past: CreativeSet[]
  future: CreativeSet[]
  saving: 'saved' | 'dirty' | 'saving' | 'error'

  open: (id: string, projectId?: string) => Promise<void>
  close: () => void
  selectPost: (id: string) => void
  /** Escolhe a fileira toda de um post: o agente passa a editar o post inteiro. */
  selectRow: (id: string) => void
  selectSlide: (id: string) => void
  selectLayer: (id?: string) => void
  /** Troca a seleção por estes componentes (do slide escolhido). */
  selectLayers: (ids: string[]) => void
  /** Entra ou sai da seleção (Shift ou ⌘ + clique, ou o painel de camadas). */
  toggleLayer: (id: string) => void
  /** Troca o conjunto inteiro (rascunho, sem histórico), como no arrasto. */
  draft: (fn: (set: CreativeSet) => CreativeSet) => void
  /** Grava o rascunho atual como um passo desfazível. */
  checkpoint: (before: CreativeSet) => void
  edit: (fn: (set: CreativeSet) => CreativeSet) => void
  undo: () => void
  redo: () => void
  ensureAssets: () => Promise<void>
  /** Marca o conjunto para salvar sem abrir um passo no histórico (um anexo que subiu, por exemplo). */
  persist: () => void
  /** Uma mudança que outra pessoa fez no mesmo conjunto: entra sem abrir passo no histórico nem salvar daqui. */
  applyRemote: (patch: SyncPatch) => void
  ensureImage: (src: string) => Promise<void>
  flush: () => Promise<void>
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useEditor = create<EditorState>()((set, get) => {
  const schedule = () => {
    set({ saving: 'dirty' })
    clearTimeout(timer)
    timer = setTimeout(() => void get().flush(), 1200)
  }

  const apply = (next: CreativeSet) => set({ set: { ...next, updatedAt: Date.now() } })

  return {
    status: 'loading',
    layerIds: [],
    images: new Map(),
    past: [],
    future: [],
    saving: 'saved',

    open: async (id, projectId) => {
      set({ status: 'loading', set: undefined, past: [], future: [], images: new Map(), saving: 'saved' })
      try {
        const loaded = await loadSet(id, projectId)
        if (!loaded) return set({ status: 'missing' })
        const post = loaded.posts[0]
        set({ set: loaded, status: 'ready', postId: post?.id, slideId: post?.slides[0]?.id, layerId: undefined, layerIds: [] })
        void get().ensureAssets()
      } catch (err) {
        console.error('[criativos]', err)
        set({ status: 'error' })
      }
    },
    close: () => {
      void get().flush()
      set({ set: undefined, status: 'loading' })
    },
    selectPost: (postId) => {
      const post = get().set?.posts.find((p) => p.id === postId)
      set({ postId, slideId: post?.slides[0]?.id, layerId: undefined, layerIds: [], row: false })
    },
    selectRow: (postId) => {
      const post = get().set?.posts.find((p) => p.id === postId)
      if (post) set({ postId, slideId: post.slides[0]?.id, layerId: undefined, layerIds: [], row: true })
    },
    selectSlide: (slideId) => set({ slideId, layerId: undefined, layerIds: [], row: false }),
    selectLayer: (layerId) => set({ layerId, layerIds: layerId ? [layerId] : [], row: false }),
    selectLayers: (ids) => set({ layerId: ids.at(-1), layerIds: ids, row: false }),
    toggleLayer: (id) => {
      const ids = get().layerIds
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
      set({ layerId: next.at(-1), layerIds: next, row: false })
    },

    draft: (fn) => {
      const current = get().set
      if (!current) return
      set({ set: syncSpans(current, fn(current)) })
    },
    checkpoint: (before) => {
      set((s) => ({ past: [...s.past, before].slice(-HISTORY), future: [] }))
      schedule()
    },
    edit: (fn) => {
      const current = get().set
      if (!current) return
      set((s) => ({ past: [...s.past, current].slice(-HISTORY), future: [] }))
      apply(syncSpans(current, fn(current)))
      schedule()
    },
    undo: () => {
      const { past, set: current } = get()
      const previous = past.at(-1)
      if (!previous || !current) return
      set((s) => ({ past: s.past.slice(0, -1), future: [current, ...s.future], set: previous }))
      schedule()
    },
    redo: () => {
      const { future, set: current } = get()
      const next = future[0]
      if (!next || !current) return
      set((s) => ({ future: s.future.slice(1), past: [...s.past, current], set: next }))
      schedule()
    },

    persist: () => schedule(),

    applyRemote: (patch) => {
      const current = get().set
      if (!current) return
      const next = mergePatch(current, patch)
      const postId = next.posts.some((p) => p.id === get().postId) ? get().postId : next.posts[0]?.id
      const post = next.posts.find((p) => p.id === postId)
      const slideId = post?.slides.some((s) => s.id === get().slideId) ? get().slideId : post?.slides[0]?.id
      const alive = new Set(post?.slides.find((s) => s.id === slideId)?.layers.map((l) => l.id))
      const layerIds = get().layerIds.filter((id) => alive.has(id))
      const layerId = layerIds.includes(get().layerId ?? '') ? get().layerId : layerIds.at(-1)
      // O desfazer e o refazer também recebem, para não desfazer o trabalho dos outros
      set((s) => ({ set: next, postId, slideId, layerId, layerIds, past: s.past.map((x) => mergePatch(x, patch)), future: s.future.map((x) => mergePatch(x, patch)) }))
      void get().ensureAssets()
    },

    ensureImage: async (src) => {
      const { images, set: current } = get()
      if (!src || images.has(src)) return
      try {
        let url = src
        if (src.startsWith('asset:')) {
          const asset = current?.assets.find((a) => a.id === src.slice(6))
          if (!asset) return
          url = await assetUrl(asset)
        }
        const img = await loadImage(url)
        set((s) => ({ images: new Map(s.images).set(src, img) }))
      } catch (err) {
        console.warn('[criativos] imagem', err)
      }
    },
    ensureAssets: async () => {
      const current = get().set
      if (!current) return
      const fonts = new Set<string>([current.brand.headingFont, current.brand.bodyFont, EMPHASIS_FONT])
      const srcs = new Set<string>()
      for (const post of current.posts)
        for (const slide of post.slides)
          for (const layer of slide.layers) {
            if (layer.type === 'text') fonts.add(layer.font)
            if (layer.type === 'image' && layer.src) srcs.add(layer.src)
          }
      for (const key of ['logoOnLight', 'logoOnDark'] as const) if (current.brand[key]) srcs.add(current.brand[key]!)
      await Promise.all([...fonts].map(loadFont))
      await Promise.all([...srcs].map((s) => get().ensureImage(s)))
      // Fontes prontas: força um novo desenho
      set((s) => ({ images: new Map(s.images) }))
    },

    flush: async () => {
      clearTimeout(timer)
      const { set: current, saving } = get()
      if (!current || saving === 'saved' || saving === 'saving') return
      set({ saving: 'saving' })
      try {
        await saveSet(current)
        set((s) => ({ saving: s.set?.updatedAt === current.updatedAt ? 'saved' : 'dirty' }))
      } catch (err) {
        console.error('[criativos] salvar', err)
        toast.error('Não consegui salvar o conjunto. Vou tentar de novo.')
        set({ saving: 'error' })
        timer = setTimeout(() => void get().flush(), 5000)
      }
    },
  }
})

// Seletores

export const currentPost = (s: Pick<EditorState, 'set' | 'postId'>): Post | undefined => s.set?.posts.find((p) => p.id === s.postId)
export const currentSlide = (s: Pick<EditorState, 'set' | 'postId' | 'slideId'>): Slide | undefined => currentPost(s)?.slides.find((x) => x.id === s.slideId)
export const currentLayer = (s: Pick<EditorState, 'set' | 'postId' | 'slideId' | 'layerId'>): Layer | undefined => currentSlide(s)?.layers.find((l) => l.id === s.layerId)

/** Troca de formato: as camadas acompanham a proporção nova. */
export function reformat(post: Post, format: FormatId): Post {
  const from = sizeOf(post.format)
  const to = sizeOf(format)
  const fx = to.width / from.width
  const fy = to.height / from.height
  const f = Math.min(fx, fy)
  return {
    ...post,
    format,
    slides: post.slides.map((slide) => ({
      ...slide,
      layers: slide.layers.map((l) => ({ ...l, x: l.x * fx, y: l.y * fy, w: l.w * fx, h: l.h * fy, ...(l.type === 'text' ? { size: l.size * f } : {}) })) as Layer[],
    })),
  }
}
