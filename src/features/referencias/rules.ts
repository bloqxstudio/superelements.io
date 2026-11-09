/**
 * Referências visuais da conta (2026-11-09). O link vira a plataforma, o tipo provável e, quando a rede
 * oferece, o endereço do embed oficial (o post aparece na tela pelo próprio Instagram, YouTube ou TikTok;
 * nada é baixado: o Instagram nunca é raspado, AGENTS.md). Sem imports: roda nos testes do Node.
 */

export type RefPlatform = 'instagram' | 'tiktok' | 'youtube' | 'pinterest' | 'behance' | 'site' | 'outro'
export type RefKind = 'estatico' | 'carrossel' | 'video' | 'motion' | 'reels' | 'story'

export const KIND_LABEL: Record<RefKind, string> = {
  estatico: 'Estático', carrossel: 'Carrossel', video: 'Vídeo', motion: 'Motion', reels: 'Reels', story: 'Story',
}
export const PLATFORM_LABEL: Record<RefPlatform, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest', behance: 'Behance', site: 'Site', outro: 'Link',
}

export interface ParsedRef {
  url: string
  platform: RefPlatform
  /** O embed oficial, quando a rede tem. */
  embed?: string
  /** O tipo provável pelo link (a pessoa pode trocar). */
  kind?: RefKind
}

/** Lê o link colado. Devolve undefined quando não é um endereço web. */
export function parseRefUrl(raw: string): ParsedRef | undefined {
  const text = raw.trim()
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return undefined
  }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return undefined
  const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase()
  const parts = u.pathname.split('/').filter(Boolean)

  if (host === 'instagram.com' || host === 'instagr.am') {
    // /p/<código>, /reel/<código>, /reels/<código>, /tv/<código> (também com /<usuário>/ na frente)
    const at = parts.findIndex((p) => ['p', 'reel', 'reels', 'tv'].includes(p))
    const code = at >= 0 ? parts[at + 1] : undefined
    if (code && /^[A-Za-z0-9_-]{5,40}$/.test(code)) {
      const reel = parts[at] !== 'p'
      const clean = `https://www.instagram.com/${reel ? 'reel' : 'p'}/${code}/`
      return { url: clean, platform: 'instagram', embed: `${clean}embed/`, kind: reel ? 'reels' : 'estatico' }
    }
    if (parts[0] === 'stories') return { url: u.toString(), platform: 'instagram', kind: 'story' }
    return { url: u.toString(), platform: 'instagram' }
  }
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? parts[0] : parts[0] === 'shorts' || parts[0] === 'embed' ? parts[1] : u.searchParams.get('v') ?? undefined
    if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) {
      return { url: `https://www.youtube.com/watch?v=${id}`, platform: 'youtube', embed: `https://www.youtube.com/embed/${id}`, kind: parts[0] === 'shorts' ? 'reels' : 'video' }
    }
    return { url: u.toString(), platform: 'youtube', kind: 'video' }
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const at = parts.indexOf('video')
    const id = at >= 0 ? parts[at + 1] : undefined
    if (id && /^\d{8,25}$/.test(id)) return { url: u.toString(), platform: 'tiktok', embed: `https://www.tiktok.com/embed/v2/${id}`, kind: 'reels' }
    return { url: u.toString(), platform: 'tiktok', kind: 'reels' }
  }
  if (host.endsWith('pinterest.com') || host === 'pin.it') return { url: u.toString(), platform: 'pinterest', kind: 'estatico' }
  if (host === 'behance.net') return { url: u.toString(), platform: 'behance', kind: 'estatico' }
  return { url: u.toString(), platform: 'site' }
}

/** Etiquetas: separadas por vírgula, sem repetir, até 12, cada uma até 30 letras. */
export const parseTags = (raw: string) =>
  [...new Set(raw.split(',').map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].map((t) => t.slice(0, 30)).slice(0, 12)

export interface RefForContext { title: string; kind: RefKind; url: string; notes: string; tags: string[] }

/** As melhores referências da conta, para a IA criar na mesma linha (entra no contexto do Cérebro). */
export function referencesText(refs: RefForContext[]): string {
  if (!refs.length) return ''
  return refs
    .slice(0, 8)
    .map((r) => `- ${KIND_LABEL[r.kind]}${r.title ? `: ${r.title}` : ''} (${r.url})${r.notes ? ` — o que aproveitar: ${r.notes.replace(/\s+/g, ' ').slice(0, 300)}` : ''}${r.tags.length ? ` [${r.tags.join(', ')}]` : ''}`)
    .join('\n')
}

/** O formato do conteúdo da Pauta que combina com a referência. */
export const contentFormatOf = (kind: RefKind) => (kind === 'reels' || kind === 'video' || kind === 'motion' ? 'reels' : kind === 'carrossel' ? 'carrossel' : kind === 'story' ? 'story' : 'post-instagram')
