import { discoverSite, unsupportedReason, type WordPressSite } from '@/features/wordpress/rest'
import { readShopifyStore, type ShopifyStore } from './shopify'

/**
 * Que tipo de site é o endereço que o cliente tem: WordPress (conectar, plugin e importar) ou loja
 * Shopify (o onboarding da loja, sem plugin). Outro tipo entra aqui (um detector e um fluxo) sem
 * mudar o assistente.
 */
export type SiteKind =
  | { kind: 'wordpress'; site: WordPressSite; blocked: string | null }
  | { kind: 'shopify'; store: ShopifyStore }
  | { kind: 'other' }

export async function detectSiteKind(url: string): Promise<SiteKind> {
  const [wordpress, store] = await Promise.all([discoverSite(url).catch(() => null), readShopifyStore(url)])
  if (store) return { kind: 'shopify', store }
  if (wordpress) return { kind: 'wordpress', site: wordpress, blocked: unsupportedReason(wordpress) }
  return { kind: 'other' }
}
