import { PART_LABEL, sitePages } from '@/features/space/pages/pages'
import { useSpaceStore } from '@/store/spaceStore'
import type { PageWordPressLink, SectionNodeData } from '@/types/space'
import { partContentHash } from './publish'
import { sectionsFromElementor, templateIdOf } from './site'
import { fetchSitePart, listSiteParts, partsSupport, type SitePart } from './siteParts'
import type { WordPressConnection } from './types'

/**
 * Seções globais do site para o canvas: o cabeçalho e o rodapé do Theme
 * Builder viram as folhas de cabeçalho e rodapé, e os modelos salvos que as
 * páginas mostram pelo widget Modelo viram componentes, com as páginas
 * apontando para eles por instâncias. Tudo fica ligado ao modelo de origem:
 * publicar daqui atualiza o mesmo modelo. Pede o Elementor Pro (ou o PRO Elements).
 */

export type GlobalKind = 'header' | 'footer'

/** Cabeçalhos e rodapés do Theme Builder que valem no site hoje (publicados e com condição). */
export async function listSiteGlobals(connection: WordPressConnection): Promise<{ kind: GlobalKind; part: SitePart }[] | null> {
  const support = await partsSupport(connection)
  if (support.mode !== 'theme') return null
  const kinds: GlobalKind[] = ['header', 'footer']
  const lists = await Promise.all(kinds.map((kind) => listSiteParts(connection, kind)))
  return kinds.flatMap((kind, i) => lists[i].filter((p) => p.status === 'publish' && p.conditions.length).map((part) => ({ kind, part })))
}

const linkOf = (connection: WordPressConnection, part: SitePart): PageWordPressLink => ({
  siteUrl: connection.site.siteUrl,
  postId: part.id,
  title: part.title,
  link: part.edit_url,
  status: part.status,
  modifiedGmt: part.modified_gmt,
  syncedAt: Date.now(),
})

/** A ligação passa a guardar o resumo do conteúdo trazido: logo depois de importar, nada está "desatualizado". */
function markSynced(partId: string) {
  const store = useSpaceStore.getState()
  const link = store.pages.find((p) => p.id === partId)?.wordpress
  if (!link) return
  try {
    store.setPageWordPress(partId, { ...link, contentHash: partContentHash(partId) })
  } catch {
    // Folha sem seção válida: fica sem o resumo
  }
}

export interface ImportedGlobal {
  partId: string
  name: string
  /** Condições do Elementor que o canvas não mostra; publicar daqui mantém. */
  kept: string[]
  /** O modelo não vale no site inteiro no Elementor (o canvas mostra em todas as páginas). */
  partial: boolean
}

/**
 * Traz um cabeçalho ou rodapé do Theme Builder como folha do canvas. As
 * páginas que o modelo deixa de fora e já estão no canvas ficam sem ele.
 */
export async function importSiteGlobal(connection: WordPressConnection, id: number, kind: GlobalKind): Promise<ImportedGlobal> {
  const part = await fetchSitePart(connection, id)
  const siteUrl = connection.site.siteUrl
  const pages = useSpaceStore.getState().pages
  const byPost = new Map(sitePages(pages).filter((p) => p.wordpress?.siteUrl === siteUrl).map((p) => [p.wordpress!.postId, p.id]))
  const exclude: string[] = []
  const kept: string[] = []
  for (const condition of part.conditions) {
    if (condition === 'include/general') continue
    const page = /^exclude\/singular\/page\/(\d+)$/.exec(condition)
    const pageId = page ? byPost.get(Number(page[1])) : undefined
    if (pageId) exclude.push(pageId)
    else kept.push(condition)
  }
  const { sections } = await resolveTemplateInstances(connection, sectionsFromElementor(part.elementor_data, siteUrl, id))
  const partId = useSpaceStore.getState().loadSitePart(kind, part.title || PART_LABEL[kind], sections, linkOf(connection, part), exclude)
  markSynced(partId)
  return { partId, name: part.title, kept, partial: !part.conditions.includes('include/general') }
}

/**
 * Seções que são só o widget Modelo do Elementor Pro viram instâncias do
 * componente daquele modelo: o que já está no canvas (ligado ao mesmo
 * modelo) é reaproveitado; senão, o modelo vira um componente novo. Sem o
 * Elementor Pro, as seções ficam como vieram.
 */
export async function resolveTemplateInstances(connection: WordPressConnection, sections: SectionNodeData[]): Promise<{ sections: SectionNodeData[]; components: string[] }> {
  const ids = [...new Set(sections.map(templateIdOf).filter((id): id is number => id !== null))]
  if (!ids.length || (await partsSupport(connection)).mode !== 'theme') return { sections, components: [] }

  const siteUrl = connection.site.siteUrl
  const componentOf = new Map<number, { id: string; name: string }>()
  const components: string[] = []
  for (const postId of ids) {
    const existing = useSpaceStore.getState().pages.find((p) => p.part?.kind === 'section' && p.wordpress?.siteUrl === siteUrl && p.wordpress.postId === postId)
    if (existing) {
      componentOf.set(postId, { id: existing.id, name: existing.name })
      continue
    }
    try {
      const part = await fetchSitePart(connection, postId)
      const inner = sectionsFromElementor(part.elementor_data, siteUrl, postId)
      if (!inner.length) continue
      const name = part.title || 'Componente'
      const id = useSpaceStore.getState().loadSitePart('section', name, inner, linkOf(connection, part))
      markSynced(id)
      componentOf.set(postId, { id, name })
      components.push(name)
    } catch (error) {
      // Modelo que não abre: a seção fica como veio
      console.warn('[wordpress] modelo não importado', postId, error)
    }
  }

  return {
    sections: sections.map((section) => {
      const component = componentOf.get(templateIdOf(section) ?? -1)
      return component ? { title: component.name, elementorJson: '', instanceOf: component.id } : section
    }),
    components,
  }
}
