import { freshCopy, tagElement, walk } from '@/features/space/components/components'
import { parseSectionElements, type SectionElement } from '@/features/space/landingPage'
import { useSpaceStore } from '@/store/spaceStore'
import type { ComponentRole, PageWordPressLink, SectionNodeData } from '@/types/space'
import { componentContentHash } from './publish'
import { parseElementorData, sectionsFromElementor } from './site'
import { fetchSitePart, listSiteParts, partsSupport, type SitePart } from './siteParts'
import type { WordPressConnection } from './types'

/**
 * Seções globais do site para o canvas, já como componentes ligados ao modelo
 * de origem (publicar daqui atualiza o mesmo modelo):
 *
 * - cabeçalho e rodapé do Theme Builder: componentes de seção com esse papel,
 *   postos no topo (ou no fim) das páginas que o modelo mostra;
 * - widget Modelo (um modelo salvo): o conteúdo verdadeiro do modelo entra no
 *   lugar do widget, como componente (a seção inteira, ou um grupo dentro dela);
 * - Global Widget (botão, título salvo): o widget verdadeiro entra no lugar,
 *   como componente de widget.
 *
 * O conteúdo dos modelos vem pelo servidor (ou pelo plugin): ver \`siteParts\`.
 */

export type GlobalKind = ComponentRole

/** Cabeçalhos e rodapés do Theme Builder que valem no site hoje (publicados e com condição). */
export async function listSiteGlobals(connection: WordPressConnection): Promise<{ kind: GlobalKind; part: SitePart }[] | null> {
  const support = await partsSupport(connection)
  if (!support.themeBuilder) return null
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

/** A ligação passa a guardar o resumo do conteúdo trazido: logo depois de importar (com os usos já nas páginas), nada está "desatualizado". */
export function markSynced(componentId: string) {
  const store = useSpaceStore.getState()
  const link = store.components.find((c) => c.id === componentId)?.wordpress
  if (!link) return
  try {
    store.setComponentWordPress(componentId, { ...link, contentHash: componentContentHash(componentId) })
  } catch {
    // Sem conteúdo válido: fica sem o resumo
  }
}

export interface ImportedGlobal {
  componentId: string
  name: string
  /** Páginas do canvas que ganharam o componente. */
  placed: number
  /** Condições do Elementor que o canvas não mostra; publicar daqui mantém. */
  kept: string[]
  /** O modelo não vale no site inteiro no Elementor. */
  partial: boolean
}

/**
 * Traz um cabeçalho ou rodapé do Theme Builder como componente, posto no topo
 * (ou no fim) das páginas do canvas que o modelo mostra. As páginas que o
 * modelo deixa de fora ficam sem ele.
 */
export async function importSiteGlobal(connection: WordPressConnection, id: number, kind: GlobalKind): Promise<ImportedGlobal> {
  const part = await fetchSitePart(connection, id)
  const siteUrl = connection.site.siteUrl
  const resolved = await resolveTemplates(connection, sectionsFromElementor(part.elementor_data, siteUrl, id))
  const { sections } = resolved
  const elements = sections.flatMap((s) => parseSectionElements(s.elementorJson) ?? [])
  const store = useSpaceStore.getState()
  // Um cabeçalho (e um rodapé) por site: o que o projeto tinha perde o papel
  const componentId = store.loadSiteComponent({ name: part.title || (kind === 'header' ? 'Cabeçalho do site' : 'Rodapé do site'), level: 'section', role: kind, elementorJson: JSON.stringify(elements), wordpress: linkOf(connection, part) })
  useSpaceStore.getState().setComponentRole(componentId, kind)

  const excludedPosts = new Set<number>()
  const kept: string[] = []
  for (const condition of part.conditions) {
    if (condition === 'include/general') continue
    const page = /^exclude\/singular\/page\/(\d+)$/.exec(condition)
    if (page) excludedPosts.add(Number(page[1]))
    else kept.push(condition)
  }
  const pages = useSpaceStore.getState().pages.filter((p) => !(p.wordpress?.siteUrl === siteUrl && excludedPosts.has(p.wordpress.postId)))
  const placed = useSpaceStore.getState().placeComponent(componentId, pages.map((p) => p.id), kind === 'header' ? 'top' : 'bottom')
  markSynced(componentId)
  resolved.componentIds.forEach(markSynced)
  return { componentId, name: part.title, placed, kept: kept.filter((c) => !/^exclude\/singular\/page\/\d+$/.test(c)), partial: !part.conditions.includes('include/general') }
}

/** O widget que é uma referência a um modelo do site: o widget Modelo (modelo salvo) ou o Global Widget. */
function referenceOf(element: SectionElement): { kind: 'template' | 'global'; postId: number } | null {
  if (element.elType !== 'widget') return null
  if (element.widgetType === 'global') {
    const id = Number(element.templateID)
    return Number.isInteger(id) && id > 0 ? { kind: 'global', postId: id } : null
  }
  if (element.widgetType === 'template') {
    const settings = element.settings && !Array.isArray(element.settings) ? element.settings : {}
    const id = Number((settings as Record<string, unknown>).template_id)
    return Number.isInteger(id) && id > 0 ? { kind: 'template', postId: id } : null
  }
  return null
}

/**
 * As referências a modelos do site viram o conteúdo verdadeiro do modelo,
 * como componente ligado a ele: a seção que é só um widget Modelo vira a
 * seção do componente; um widget Modelo no meio da seção vira o grupo do
 * modelo; um Global Widget vira o widget dele. O componente que já está no
 * canvas (ligado ao mesmo modelo) é reaproveitado. Sem acesso ao conteúdo dos
 * modelos, as seções ficam como vieram.
 */
export async function resolveTemplates(connection: WordPressConnection, sections: SectionNodeData[]): Promise<{ sections: SectionNodeData[]; components: string[]; componentIds: string[] }> {
  const refs = new Map<number, 'template' | 'global'>()
  for (const section of sections) {
    walk(parseSectionElements(section.elementorJson) ?? [], (element) => {
      const ref = referenceOf(element)
      if (ref) refs.set(ref.postId, ref.kind)
    })
  }
  if (!refs.size || (await partsSupport(connection)).mode !== 'theme') return { sections, components: [], componentIds: [] }

  const siteUrl = connection.site.siteUrl
  // Modelo do site → componente do canvas (com o conteúdo trazido)
  const byPost = new Map<number, { id: string; name: string; elements: SectionElement[]; kind: 'template' | 'global' }>()
  const created: string[] = []
  for (const [postId, kind] of refs) {
    const store = useSpaceStore.getState()
    try {
      const existing = store.components.find((c) => c.wordpress?.siteUrl === siteUrl && c.wordpress.postId === postId)
      const part = await fetchSitePart(connection, postId)
      const elements = parseElementorData(part.elementor_data) as SectionElement[]
      if (!elements.length) continue
      const name = part.title || (kind === 'global' ? 'Widget global' : 'Modelo')
      // Global Widget: um widget; modelo salvo: a seção (um ou mais containers)
      const level = kind === 'global' ? 'element' : 'section'
      const content = kind === 'global' ? [elements[0]] : elements
      const componentId = store.loadSiteComponent({ name, level, elementorJson: JSON.stringify(content), wordpress: linkOf(connection, part) })
      byPost.set(postId, { id: componentId, name, elements: content, kind })
      if (!existing) created.push(name)
    } catch (error) {
      // Modelo que não abre: a referência fica como veio
      console.warn('[wordpress] modelo não importado', postId, error)
    }
  }

  const next = sections.map((section) => {
    const root = parseSectionElements(section.elementorJson) ?? []
    // A seção que é só o widget Modelo vira um uso da seção do componente
    const widgets: SectionElement[] = []
    walk(root, (element) => element.elType === 'widget' && widgets.push(element))
    const only = widgets.length === 1 ? referenceOf(widgets[0]) : null
    const whole = only?.kind === 'template' ? byPost.get(only.postId) : undefined
    if (whole) return { title: whole.name, elementorJson: JSON.stringify(freshCopy(whole.elements).elements), component: whole.id, origin: section.origin }

    let changed = false
    const swap = (list: SectionElement[]): SectionElement[] =>
      list.flatMap((element) => {
        const ref = referenceOf(element)
        const found = ref ? byPost.get(ref.postId) : undefined
        if (found) {
          changed = true
          const copy = freshCopy(found.elements).elements
          if (found.kind === 'global') return [tagElement(copy[0], found.id)]
          // Modelo salvo no meio da seção: o grupo dele (um container com marca), no lugar do widget
          const group: SectionElement = copy.length === 1 ? copy[0] : { id: copy[0].id, elType: 'container', isInner: true, settings: {}, elements: copy }
          return [tagElement({ ...group, isInner: true }, found.id)]
        }
        return [element.elements?.length ? { ...element, elements: swap(element.elements) } : element]
      })
    const replaced = swap(root)
    return changed ? { ...section, elementorJson: JSON.stringify(replaced) } : section
  })

  // Quem chama marca o resumo depois de pôr as seções no canvas (markSynced)
  return { sections: next, components: created, componentIds: [...byPost.values()].map((c) => c.id) }
}

/** Nome antigo, para quem já chamava: as referências a modelos viram componentes. */
export const resolveTemplateInstances = resolveTemplates
