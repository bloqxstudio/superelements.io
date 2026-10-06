import { create } from 'zustand'

interface WordPressUi {
  importOpen: boolean
  /** Página do canvas no diálogo de publicar. */
  publishPageId: string | null
  /** Página de onde se foi publicar o cabeçalho (ou rodapé) do site: fechar volta para ela. */
  publishReturnId: string | null
  /** Página do canvas nos detalhes (título, endereço, SEO, imagem destacada). */
  detailsPageId: string | null
  /** Nos detalhes, o editor da imagem destacada no lugar do formulário. */
  editingFeatured: boolean
  /** Gravando no site: o diálogo não fecha. */
  busy: boolean
  openImport: () => void
  /** `returnTo`: a página que volta ao fechar (publicar o cabeçalho a partir dela). */
  openPublish: (pageId: string, returnTo?: string) => void
  /** Abre por cima do publicar, que volta quando os detalhes fecham. */
  openDetails: (pageId: string) => void
  closeDetails: () => void
  setEditingFeatured: (editing: boolean) => void
  setBusy: (busy: boolean) => void
  /** Volta um passo: do editor para os detalhes, dos detalhes para o publicar, e fecha. */
  back: () => void
  close: () => void
}

/**
 * Diálogos de importar, publicar e detalhes. Publicar, detalhes e o editor da
 * imagem trocam de conteúdo dentro de um diálogo só: dois diálogos do Radix
 * trocando de lugar deixam o `pointer-events: none` preso no body.
 */
export const useWordPressUi = create<WordPressUi>()((set, get) => ({
  importOpen: false,
  publishPageId: null,
  publishReturnId: null,
  detailsPageId: null,
  editingFeatured: false,
  busy: false,
  openImport: () => set({ importOpen: true, publishPageId: null, detailsPageId: null }),
  openPublish: (pageId, returnTo) => set({ publishPageId: pageId, publishReturnId: returnTo ?? null, importOpen: false }),
  openDetails: (pageId) => set({ detailsPageId: pageId, editingFeatured: false }),
  closeDetails: () => set({ detailsPageId: null, editingFeatured: false }),
  setEditingFeatured: (editingFeatured) => set({ editingFeatured }),
  setBusy: (busy) => set({ busy }),
  back: () => {
    const { busy, editingFeatured, detailsPageId, publishReturnId, close, closeDetails } = get()
    if (busy) return
    if (editingFeatured) set({ editingFeatured: false })
    else if (detailsPageId) closeDetails()
    else if (publishReturnId) set({ publishPageId: publishReturnId, publishReturnId: null })
    else close()
  },
  close: () => set({ importOpen: false, publishPageId: null, publishReturnId: null, detailsPageId: null, editingFeatured: false }),
}))

/** Data do WordPress em GMT (sem fuso no texto), no formato curto daqui. */
export const wpDate = (gmt: string) => {
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(gmt) ? gmt : `${gmt}Z`)
  return Number.isNaN(date.getTime()) ? gmt : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export const STATUS_LABELS: Record<string, string> = {
  publish: 'Publicada',
  draft: 'Rascunho',
  pending: 'Pendente',
  private: 'Privada',
  future: 'Agendada',
}
