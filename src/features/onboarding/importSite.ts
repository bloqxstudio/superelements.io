import { useBrandStore } from '@/features/space/brand/brandStore'
import { useSpaceStore } from '@/store/spaceStore'
import { designMdFromSite } from '@/features/wordpress/brand'
import { detectSeo } from '@/features/wordpress/seo'
import { fetchSiteKit, fetchSiteLogo, fetchSitePage, listSitePages } from '@/features/wordpress/site'
import { importSiteGlobal, listSiteGlobals, markSynced, resolveTemplates } from '@/features/wordpress/siteImport'
import { partsSupport } from '@/features/wordpress/siteParts'
import { useSiteKitStore } from '@/features/wordpress/siteKitStore'
import type { WordPressConnection } from '@/features/wordpress/types'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

export interface SiteImportResult {
  pages: number
  globals: number
  failed: string[]
}

/**
 * Traz o site inteiro para o canvas sem abrir o editor: todas as páginas do Elementor, o cabeçalho e o
 * rodapé do Theme Builder e a marca (cores e fontes globais). O canvas é o do projeto aberto em segundo
 * plano pela sessão, que salva sozinha.
 */
export async function importWholeSite(connection: WordPressConnection, progress: (text: string) => void): Promise<SiteImportResult> {
  const result: SiteImportResult = { pages: 0, globals: 0, failed: [] }

  progress('Lendo as páginas do site…')
  const [list, kit, logo] = await Promise.all([listSitePages(connection), fetchSiteKit(connection).catch(() => null), fetchSiteLogo(connection).catch(() => null)])
  if (kit) {
    useSiteKitStore.getState().setKit(kit)
    const brand = useBrandStore.getState()
    // Projeto novo, sem marca: a do site vira a do projeto
    if (!brand.brand) {
      brand.setSource(designMdFromSite(connection.site.name, kit, logo))
      brand.setEnabled(true)
    }
  }

  const seo = await detectSeo(connection).catch(() => undefined)
  const wanted = list.pages.filter((p) => p.elementor && p.status !== 'trash')
  for (const [index, page] of wanted.entries()) {
    progress(`Importando a página ${index + 1} de ${wanted.length}…`)
    try {
      const fetched = await fetchSitePage(connection, page.id, seo)
      const resolved = await resolveTemplates(connection, fetched.sections)
      const { setPageDetails, loadSitePage } = useSpaceStore.getState()
      setPageDetails(loadSitePage(fetched.name, resolved.sections, fetched.link), fetched.details)
      resolved.componentIds.forEach(markSynced)
      result.pages++
    } catch (error) {
      result.failed.push(`${page.title}: ${errorText(error)}`)
    }
  }

  const support = await partsSupport(connection, true).catch(() => null)
  if (support?.mode === 'theme') {
    const found = (await listSiteGlobals(connection).catch(() => null)) ?? []
    for (const kind of ['header', 'footer'] as const) {
      const first = found.find((g) => g.kind === kind)
      if (!first) continue
      progress(`Trazendo o ${kind === 'header' ? 'cabeçalho' : 'rodapé'}…`)
      try {
        await importSiteGlobal(connection, first.part.id, kind)
        result.globals++
      } catch (error) {
        result.failed.push(`${first.part.title}: ${errorText(error)}`)
      }
    }
  }
  return result
}
