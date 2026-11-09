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
 * (ou em português: `123 curtidas, 4 comentários - usuario em 1 de novembro de 2026: "legenda"`).
 */
export function metaOf(description: string | undefined): PostMeta {
  if (!description) return {}
  const author = /-\s+([A-Za-z0-9._]{1,30})\s+(?:on|em)\s/.exec(description)?.[1]
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
