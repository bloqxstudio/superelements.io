/**
 * Loja Shopify no assistente de conta nova. Toda loja publica `/meta.json` com
 * `Access-Control-Allow-Origin: *` (nome, domínio principal, endereço
 * `.myshopify.com`, moeda, cidade), então o navegador confirma que é Shopify e
 * preenche o cadastro sem login nem app. O `/admin` da loja redireciona para o
 * painel certo, e daí saem os atalhos para onde se cola cada código.
 */

export interface ShopifyStore {
  name: string
  /** Domínio principal, sem `www.` (onde rodam a loja e o checkout): é o domínio cadastrado no Site */
  domain: string
  /** `loja.myshopify.com`; sem ele, a loja não foi confirmada pelo `/meta.json` */
  myshopify?: string
  /** A vitrine não é um tema da Shopify (Hydrogen, Next.js…): o domínio da Shopify é só o checkout */
  headless?: boolean
  currency?: string
  city?: string
  province?: string
}

/** `Loja.com.br/produtos` → `https://loja.com.br` (sem caminho) */
function originOf(input: string) {
  const text = input.trim()
  if (!text) return null
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
    if (!/\./.test(url.hostname)) return null
    return `https://${url.hostname.toLowerCase()}`
  } catch {
    return null
  }
}

const bare = (host: string) => host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#:].*$/, '').replace(/^www\./, '')

/** A loja do endereço, ou `null` quando não é Shopify (ou não respondeu em 6 s). */
export async function readShopifyStore(input: string): Promise<ShopifyStore | null> {
  const origin = originOf(input)
  if (!origin) return null
  try {
    const response = await fetch(`${origin}/meta.json`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) })
    if (!response.ok) return null
    const meta = (await response.json()) as Record<string, unknown>
    const myshopify = typeof meta.myshopify_domain === 'string' ? meta.myshopify_domain.toLowerCase() : undefined
    if (!myshopify?.endsWith('.myshopify.com')) return null
    const typed = bare(origin)
    const primary = typeof meta.domain === 'string' && meta.domain ? bare(meta.domain) : typed
    // Loja headless: a Shopify diz `us.checkout.loja.com`; vale o domínio digitado, que cobre a vitrine e o checkout
    const headless = primary !== typed && primary.endsWith(`.${typed}`) && !typed.endsWith('.myshopify.com')
    const domain = headless ? typed : primary
    const text = (key: string) => (typeof meta[key] === 'string' && (meta[key] as string).trim() ? (meta[key] as string).trim() : undefined)
    return { name: text('name') ?? domain, domain, myshopify, headless: headless || undefined, currency: text('currency'), city: text('city'), province: text('province') }
  } catch {
    return null
  }
}

/** Página do admin da loja (o `/admin` do `.myshopify.com` leva ao painel dela); sem ele, o admin geral da Shopify. */
export const shopifyAdmin = (store: Pick<ShopifyStore, 'myshopify'>, path: string) =>
  store.myshopify ? `https://${store.myshopify}/admin/${path.replace(/^\/+/, '')}` : 'https://admin.shopify.com/'

/**
 * Loja que o `/meta.json` não confirma (headless, como Hydrogen ou Next.js, ou bloqueada): segue
 * com o domínio digitado. O pixel vale do mesmo jeito no checkout; o código do tema vai no layout do site.
 */
export function manualStore(input: string, name: string): ShopifyStore | null {
  const domain = bare(input)
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain)) return null
  return { name: name.trim() || domain, domain, myshopify: domain.endsWith('.myshopify.com') ? domain : undefined, headless: true }
}
