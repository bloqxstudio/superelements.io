import { discoverSite, unsupportedReason, type WordPressSite } from '@/features/wordpress/rest'

/**
 * Que tipo de site é o endereço que o cliente tem. Hoje só o WordPress tem caminho de implantação;
 * outro tipo entra aqui (um detector e um fluxo) sem mudar o assistente.
 */
export type SiteKind =
  | { kind: 'wordpress'; site: WordPressSite; blocked: string | null }
  | { kind: 'other' }

export async function detectSiteKind(url: string): Promise<SiteKind> {
  try {
    const site = await discoverSite(url)
    return { kind: 'wordpress', site, blocked: unsupportedReason(site) }
  } catch {
    return { kind: 'other' }
  }
}
