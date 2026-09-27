import { toast } from 'sonner'
import { renderElementorDocument } from '@/engine/elementor'
import { PACK_SITE_URL } from '@/features/section-pack/pack'
import { formatElementorClipboard } from '@/utils/directElementorExtractor'
import { copyToClipboardEnhanced } from '@/utils/enhancedRobustClipboard'
import { useSpaceStore } from '@/store/spaceStore'
import { buildLandingPage } from './landingPage'
import { applyMediaReplacements, collectImageUrls, dropCustomImageSizes, type MediaReplacement } from './pageImages'
import { brandKit } from './brand/applyBrand'
import { getActiveBrand } from './brand/brandStore'
import { pageSections, pageSlug } from './pages/pages'

/** A página indicada, ou a ativa, montada com a marca. */
const buildPage = (pageId?: string | null) => {
  const { nodes, connections, pages, activePageId } = useSpaceStore.getState()
  const page = pages.find((p) => p.id === (pageId ?? activePageId)) ?? pages[0]
  const sections = page ? pageSections(page, nodes) : []
  return { name: page?.name ?? 'Página', ...buildLandingPage(sections, nodes, connections, getActiveBrand()) }
}

const emptyPageError = (name: string) => toast.error(`A página ${name} não tem seção com JSON válido`)

const skippedNote = (skipped: number) =>
  skipped ? ` ${skipped} seção(ões) sem JSON válido ficaram de fora.` : ''

/** Imagens da página (sem id, a ativa), sem repetição. */
export const landingImageUrls = (pageId?: string) => collectImageUrls(buildPage(pageId).elements)

interface CopyOptions {
  /** Página a copiar; sem ela vai a ativa. */
  pageId?: string | null
  /** Imagens já enviadas para a biblioteca de mídia do site de destino. */
  replacements?: Map<string, MediaReplacement>
  /** Site de destino; sem ele vai o do pack. */
  siteUrl?: string
}

/**
 * Copia a página inteira no formato de colagem do Elementor. O Elementor não
 * traz as imagens ao colar de outro site: as que não foram enviadas para o
 * destino seguem pela URL, sem o id do site de origem.
 */
export async function copyLandingToElementor({ pageId, replacements = new Map(), siteUrl = PACK_SITE_URL }: CopyOptions = {}) {
  const page = buildPage(pageId)
  if (!page.elements.length) {
    emptyPageError(page.name)
    return false
  }

  applyMediaReplacements(page.elements, replacements)
  dropCustomImageSizes(page.elements)
  // JSON vindo do Elementor: a forma é a que o formatador espera
  const elements = page.elements as unknown as Parameters<typeof formatElementorClipboard>[0]
  const data = formatElementorClipboard(elements, siteUrl)
  const result = await copyToClipboardEnhanced(JSON.stringify(data))
  if (result.success) {
    toast.success(`${page.name} copiada para o Elementor`, {
      description: `${page.sectionCount} seção(ões) na ordem da página. No editor, clique na página e cole com Ctrl+V.${skippedNote(page.skipped)}`,
    })
  } else {
    toast.error('Não foi possível copiar', { description: result.error })
  }
  return result.success
}

/** HTML estático da página, gerado pelo motor, para mostrar a alguém sem o Elementor. */
export function downloadLandingHtml(pageId?: string | null) {
  const page = buildPage(pageId)
  if (!page.elements.length) {
    emptyPageError(page.name)
    return
  }

  const brand = getActiveBrand()
  const { document } = renderElementorDocument(page.elements, { title: page.name, kit: brand ? brandKit(brand) : undefined, motion: 'play' })
  const url = URL.createObjectURL(new Blob([document], { type: 'text/html;charset=utf-8' }))
  const link = window.document.createElement('a')
  link.href = url
  link.download = `${pageSlug(page.name)}.html`
  link.click()
  URL.revokeObjectURL(url)
}
