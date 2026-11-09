/**
 * Regras do leitor de referências (sem imports: testadas em tests/rules.test.mjs).
 * Acha os links de posts numa conversa do Instagram e lê os dados que a página do post mostra.
 */

const CODE = /instagram\.com\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/i

/** O endereço canônico do post (p/ ou reel/), ou undefined. */
export function postUrlOf(raw: string): string | undefined {
  const m = CODE.exec(raw.startsWith('/') ? `instagram.com${raw}` : raw)
  if (!m) return undefined
  return `https://www.instagram.com/${m[1].toLowerCase() === 'p' ? 'p' : 'reel'}/${m[2]}/`
}

/** Os posts citados numa conversa (links e textos), sem repetir, na ordem em que apareceram. */
export function postLinksIn(hrefs: string[], text: string): string[] {
  const found: string[] = []
  const add = (u: string | undefined) => { if (u && !found.includes(u)) found.push(u) }
  for (const h of hrefs) add(postUrlOf(h))
  for (const m of text.matchAll(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s"'<>]+/gi)) add(postUrlOf(m[0]))
  return found
}

/** O endereço do grupo como a tela guarda (instagram.com/direct/t/<id>/), ou undefined. */
export function threadUrlOf(raw: string): string | undefined {
  const m = /instagram\.com\/direct\/t\/(\d{5,40})/i.exec(raw.trim())
  return m ? `https://www.instagram.com/direct/t/${m[1]}/` : undefined
}

export interface PostMeta {
  author?: string
  caption?: string
}

/**
 * O og:description do Instagram: `123 likes, 4 comments - usuario on November 1, 2026: "legenda".`
 * (ou em português: `123 curtidas, 4 comentários - usuario em 1 de novembro de 2026: "legenda"`, ou misturado:
 * `5 likes, 0 comments - usuario no November 9, 2026: "legenda"`, como veio em 2026-11-09).
 */
export function metaOf(description: string | undefined): PostMeta {
  if (!description) return {}
  // "… - usuario on November 1", "… - usuario em 1 de novembro" ou misturado: "… - usuario no November 9"
  const author = /-\s+([A-Za-z0-9._]{1,30})\s+(?:on|em|no|el|le)\s/.exec(description)?.[1]
  const caption = /:\s*"([\s\S]*)"\.?\s*$/.exec(description)?.[1]?.trim()
  return { author, caption: caption ? caption.slice(0, 2200) : undefined }
}

export type RefKind = 'estatico' | 'carrossel' | 'video' | 'motion' | 'reels' | 'story'
const KINDS: RefKind[] = ['estatico', 'carrossel', 'video', 'motion', 'reels', 'story']

/** O tipo pelo que a página mostra (a IA pode corrigir para motion, por exemplo). */
export function kindOf(url: string, page: { video: boolean; slides: number }): RefKind {
  if (/\/reel\//.test(url)) return 'reels'
  if (page.slides > 1) return 'carrossel'
  return page.video ? 'video' : 'estatico'
}

export const validKind = (k: unknown, fallback: RefKind): RefKind => (KINDS.includes(k as RefKind) ? (k as RefKind) : fallback)

/** A pausa entre uma página e outra, como uma pessoa navegando (ms). */
export const humanPause = (min = 4000, max = 9000) => min + Math.floor(Math.random() * (max - min))

/** O grupo está na hora: pedido de "ver agora" depois da última volta, ou a rotina venceu. */
export function due(src: { enabled: boolean; every_minutes: number; last_run_at: string | null; run_requested_at: string | null }, now = Date.now()): boolean {
  if (!src.enabled) return false
  const last = src.last_run_at ? Date.parse(src.last_run_at) : 0
  if (src.run_requested_at && Date.parse(src.run_requested_at) > last) return true
  return now - last >= src.every_minutes * 60_000
}

/** Nome de arquivo seguro para o Cérebro (`referencias/<código>-<parte>.jpg`). */
export const shotName = (postUrl: string, part: string) => `referencias/${(postUrlOf(postUrl) ?? postUrl).split('/').filter(Boolean).pop()}-${part}.jpg`.replace(/[^A-Za-z0-9._/-]/g, '')

/** Um número como o Instagram escreve: 1,234 · 1.234 · 12K · 1.2M · 1,2 mil · 3 mi. */
export function parseCount(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const m = /^\s*([\d.,]+)\s*(k|m|mil|mi|mi\.)?\b/i.exec(raw)
  if (!m) return undefined
  const unit = (m[2] ?? '').toLowerCase()
  const mult = unit === 'k' || unit === 'mil' ? 1e3 : unit === 'm' || unit.startsWith('mi') ? 1e6 : 1
  const n = mult > 1 ? parseFloat(m[1].replace(',', '.')) : parseInt(m[1].replace(/[.,]/g, ''), 10)
  return Number.isFinite(n) ? Math.round(n * mult) : undefined
}

export interface Metrics { likes?: number; comments?: number; views?: number }

/**
 * O engajamento que a página mostra: curtidas e comentários pelo og:description ("12K likes, 345 comments - …"
 * ou "1.234 curtidas, 56 comentários - …") e as visualizações pelo texto da página, quando aparecem.
 */
export function metricsOf(description: string | undefined, pageText = ''): Metrics {
  const num = '([\\d.,]+\\s*(?:K|M|mil|mi)?)'
  const likes = parseCount(new RegExp(`${num}\\s+(?:likes?|curtidas?)`, 'i').exec(description ?? '')?.[1])
  const comments = parseCount(new RegExp(`${num}\\s+(?:comments?|comentários?)`, 'i').exec(description ?? '')?.[1])
  const views = parseCount(new RegExp(`${num}\\s+(?:views|visualizações|reproduções|plays)`, 'i').exec(pageText)?.[1])
  return { likes, comments, views }
}

/**
 * A ordem no grupo (maior = mandado mais recentemente). `links` vem do mais novo para o mais antigo, na
 * sequência exata da conversa: cada leitura refaz a ordem de todos os que leu (os novos e os já guardados).
 * Os mais antigos, fora desta leitura, ficam com a ordem de antes, que é menor (de uma leitura anterior).
 */
export const windowOrders = (links: string[], now = Date.now()): Record<string, number> =>
  Object.fromEntries(links.map((url, i) => [url, now - i]))
