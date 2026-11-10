import { loadSet } from '@/features/criativos/storage'
import { sizeOf, type CreativeSet, type Layer, type Post } from '@/features/criativos/types'
import { callAiQuiet, useCreativeLink } from '@/features/criativos/link'
import { iaFor } from '@/features/ia/porTarefa'
import { loadStandard } from './standard'

/**
 * Lê um post dos Criativos e escreve o padrão dele (2026-11-07, o usuário: "consegui criar o padrão de
 * post mas vem genérico, pode ser gerado automático? já entendendo o padrão, foto etc?"). Duas leituras:
 *   - as medidas das camadas (`measurePost`): grade, fontes, tamanhos, cores, onde fica a foto. Exatas e
 *     sem IA, servem também quando a IA desta máquina não está conectada;
 *   - a IA (o agente dos Criativos pelo conector) olha a imagem de cada slide junto com as medidas e
 *     escreve as regras do que se repete, quando usar e um nome.
 */

export interface PatternDraft { name: string; rules: string[]; when: string[]; byAi: boolean }

/** `/criativos/<conjunto>?projeto=<id>&post=<id>` → onde está o post. */
export function parseCreativeHref(href?: string): { setId: string; projectId?: string; postId?: string } | null {
  const m = href?.match(/\/criativos\/([^?#/]+)(?:\?([^#]*))?/)
  if (!m) return null
  const q = new URLSearchParams(m[2] ?? '')
  return { setId: decodeURIComponent(m[1]), projectId: q.get('projeto') ?? undefined, postId: q.get('post') ?? undefined }
}

export async function loadPost(href?: string): Promise<{ set: CreativeSet; post: Post } | null> {
  const where = parseCreativeHref(href)
  if (!where) return null
  const set = await loadSet(where.setId, where.projectId).catch(() => undefined)
  const post = set?.posts.find((p) => p.id === where.postId) ?? set?.posts[0]
  return set && post ? { set, post } : null
}

const pct = (v: number, total: number) => Math.round((v / total) * 100)
const zone = (y: number, h: number, H: number) => {
  const mid = (y + h / 2) / H
  return mid < 0.34 ? 'em cima' : mid > 0.66 ? 'embaixo' : 'no meio'
}
const side = (x: number, w: number, W: number) => {
  if (w / W > 0.7) return 'largura toda'
  const mid = (x + w / 2) / W
  return mid < 0.4 ? 'à esquerda' : mid > 0.6 ? 'à direita' : 'centralizado'
}

function describeLayer(l: Layer, W: number, H: number, fonts: { heading: string; body: string }): string | null {
  if (l.hidden) return null
  const where = `${zone(l.y, l.h, H)}, ${side(l.x, l.w, W)} (x ${pct(l.x, W)}%, y ${pct(l.y, H)}%, ${pct(l.w, W)}%×${pct(l.h, H)}%)`
  const op = l.opacity !== undefined && l.opacity < 1 ? `, opacidade ${Math.round(l.opacity * 100)}%` : ''
  if (l.type === 'text') {
    const role = l.font === fonts.heading ? 'fonte de título' : l.font === fonts.body ? 'fonte de texto' : 'outra fonte'
    const text = l.text.replace(/\s+/g, ' ').trim()
    return `texto "${text.length > 90 ? text.slice(0, 90) + '…' : text}" — ${l.font} ${l.weight}${l.italic ? ' itálico' : ''} (${role}), ${l.size}px (${pct(l.size, W)}% da largura), ${l.color}, alinhado ${l.align}${l.upper ? ', maiúsculas' : ''}${l.letterSpacing ? `, espaçamento ${l.letterSpacing}em` : ''}; ${where}${op}`
  }
  if (l.type === 'image') {
    const area = pct(l.w * l.h, W * H)
    return `${/logo|marca/i.test(l.name) ? 'logo' : /[íi]cone/i.test(l.name) ? 'ícone' : 'foto'} "${l.name}" ${l.fit === 'cover' ? 'recortada para preencher' : 'inteira'}, ${area}% da área${l.radius ? `, cantos ${l.radius}px` : ''}${l.frame && l.frame !== 'none' ? `, moldura ${l.frame}` : ''}; ${where}${op}`
  }
  if (l.type === 'rect') {
    const area = pct(l.w * l.h, W * H)
    const fill = l.fill2 ? `degradê ${l.fill} → ${l.fill2}${l.angle !== undefined ? ` (${l.angle}°)` : ''}` : l.fill
    return `${area > 60 ? 'véu/fundo' : area < 3 ? 'marca pequena/linha' : 'forma'} ${fill}, ${area}% da área${l.radius ? `, cantos ${l.radius}px` : ''}${l.stroke ? `, contorno ${l.stroke}` : ''}; ${where}${op}`
  }
  return `${l.type} "${l.name}"; ${where}${op}`
}

/** As medidas de cada slide, em texto. */
export function measurePost(set: CreativeSet, post: Post): string {
  const { width: W, height: H } = sizeOf(post.format)
  const fonts = { heading: set.brand.headingFont, body: set.brand.bodyFont }
  const lines = [`Formato ${post.format} (${W}×${H}), ${post.slides.length} slide(s). Fontes da marca: título ${fonts.heading}, texto ${fonts.body}.`]
  post.slides.slice(0, 10).forEach((s, i) => {
    lines.push(`\nSlide ${i + 1} — fundo ${s.background}:`)
    for (const l of s.layers) {
      const d = describeLayer(l, W, H, fonts)
      if (d) lines.push(`- ${d}`)
    }
  })
  return lines.join('\n')
}

/** Regras sem IA, tiradas só das medidas. Ficam curtas e verificáveis. */
export function rulesFromLayers(set: CreativeSet, post: Post): string[] {
  const { width: W, height: H } = sizeOf(post.format)
  const all = post.slides.flatMap((s) => s.layers.filter((l) => !l.hidden))
  const texts = all.filter((l): l is Extract<Layer, { type: 'text' }> => l.type === 'text')
  const rules: string[] = []
  const title = [...texts].sort((a, b) => b.size - a.size)[0]
  if (title) rules.push(`Título em ${title.font} ${title.weight}${title.upper ? ' em maiúsculas' : ''}, cerca de ${title.size}px, ${zone(title.y, title.h, H)} e ${side(title.x, title.w, W)}, na cor ${title.color}.`)
  const body = texts.filter((t) => t !== title && t.size < (title?.size ?? 0) * 0.6).sort((a, b) => b.text.length - a.text.length)[0]
  if (body) rules.push(`Texto de apoio em ${body.font} ${body.weight}, cerca de ${body.size}px, alinhado ${body.align}, logo ${body.y > (title?.y ?? 0) ? 'abaixo' : 'acima'} do título.`)
  const photo = all.filter((l) => l.type === 'image' && !/logo|marca|[íi]cone/i.test(l.name)).sort((a, b) => b.w * b.h - a.w * a.h)[0]
  if (photo) {
    const area = pct(photo.w * photo.h, W * H)
    rules.push(area > 70 ? `Foto ocupando o slide inteiro, com o texto por cima.` : `Foto ${zone(photo.y, photo.h, H)}, ocupando cerca de ${area}% do slide.`)
  }
  const veil = all.find((l) => l.type === 'rect' && l.w * l.h > W * H * 0.4 && (l.fill2 || (l.opacity ?? 1) < 1))
  if (veil && veil.type === 'rect') rules.push(`Véu ${veil.fill2 ? `em degradê de ${veil.fill} para ${veil.fill2}` : `${veil.fill}`} sobre a foto para o texto ler.`)
  const logo = all.find((l) => l.type === 'image' && /logo|marca/i.test(l.name))
  if (logo) rules.push(`Logo ${zone(logo.y, logo.h, H)}, ${side(logo.x, logo.w, W)}, pequeno.`)
  const bgs = [...new Set(post.slides.map((s) => s.background))]
  if (bgs.length) rules.push(`Fundo ${bgs.length === 1 ? bgs[0] : bgs.join(' / ')}.`)
  if (post.slides.length > 1) rules.push(`Carrossel de ${post.slides.length} slides.`)
  return rules
}

const SYSTEM = `Você é diretor de arte de uma agência de social media. Recebe um post que a empresa aprovou como modelo e escreve o PADRÃO dele: as regras que um designer (ou outra IA) deve seguir para fazer novos posts iguais em estrutura, mudando só o assunto.

Regras do padrão:
- Concretas e verificáveis, nunca genéricas ("design limpo", "cores da marca" e "boa hierarquia" não servem). Diga onde, quanto, qual fonte, qual cor (hex), quantas linhas, que tipo de foto.
- Cubra: grade e margens; título (fonte, peso, caixa, tamanho, linhas, cor, palavra em destaque se houver); texto de apoio; a foto (assunto, enquadramento, luz, ângulo, onde fica, quanto ocupa, véu ou degradê); logo e marcações pequenas; fundo; ritmo dos slides num carrossel (capa, miolo, último) e a chamada final; o tom do texto (tamanho das frases, como fala).
- Use as medidas exatas do material, mas fale como gente: "título em Barlow Condensed 800 em maiúsculas, 2 linhas, no terço de cima".
- Não copie os textos do post como regra; diga o tipo de frase.
- De 7 a 12 regras, uma frase cada.

Responda no formato pedido, com estes itens:
- ref "nome": um nome curto do padrão (até 5 palavras, ex.: "Foto de painel com título forte").
- ref "regra": uma regra por item.
- ref "quando": 1 a 3 itens dizendo para que tipo de conteúdo este padrão serve.
"reply": uma frase dizendo o que define este padrão.`

/** A IA desta máquina está conectada para ler o post? */
export const aiReady = () => { const l = useCreativeLink.getState(); return l.connected && l.ia !== false }

/**
 * O padrão de um post. Com a IA conectada: olha os slides e escreve; sem ela (ou se falhar), as regras
 * tiradas das medidas.
 */
export async function draftPattern(o: { teamId: string; href?: string; coverUrl?: string; signal?: AbortSignal; onStep?: (s: string) => void }): Promise<PatternDraft> {
  o.onStep?.('Abrindo o post')
  const found = await loadPost(o.href)
  const fallback = (): PatternDraft => ({ name: found?.post.name ?? '', rules: found ? rulesFromLayers(found.set, found.post) : [], when: [], byAi: false })
  if (!aiReady()) return fallback()
  const images: string[] = []
  if (found) {
    o.onStep?.('Desenhando os slides')
    const { creativeImages } = await import('@/features/crm/instagram')
    const { slidePreview } = await import('@/features/criativos/ai')
    const map = await creativeImages(found.set, found.post.slides.slice(0, 8))
    for (const s of found.post.slides.slice(0, 8)) images.push(slidePreview(s, found.post.format, map, 720))
  } else if (o.coverUrl) {
    const blob = await (await fetch(o.coverUrl)).blob()
    images.push(await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(blob) }))
  }
  if (!images.length) return fallback()
  const { brand } = await loadStandard(o.teamId).catch(() => ({ brand: '' }))
  const prompt = [
    found ? `## O post\n"${found.post.name}" do conjunto "${found.set.name}".${found.post.caption ? `\nLegenda: ${found.post.caption.slice(0, 600)}` : ''}` : '## O post\nSó a capa (o post não foi encontrado nos Criativos).',
    found ? `## Medidas das camadas (exatas)\n${measurePost(found.set, found.post)}` : '',
    `## Imagens\n${images.map((_, i) => `Imagem ${i + 1}: slide ${i + 1}.`).join('\n')}`,
    brand ? `## Marca da conta (DESIGN.md, para os nomes das cores e fontes)\n${brand.slice(0, 4000)}` : '',
  ].filter(Boolean).join('\n\n')
  try {
    o.onStep?.('A IA está lendo o padrão')
    const out = await callAiQuiet<{ reply: string; items: { ref: string; text: string }[] }>('agent', { ...iaFor('criativos'), system: SYSTEM, prompt, images }, o.signal)
    const of = (ref: string) => (out.items ?? []).filter((x) => x.ref.toLowerCase().startsWith(ref)).map((x) => x.text.trim()).filter(Boolean)
    const rules = of('regra')
    if (!rules.length) return fallback()
    return { name: of('nome')[0] ?? found?.post.name ?? '', rules: rules.slice(0, 14), when: of('quando').slice(0, 3), byAi: true }
  } catch (e) {
    if (o.signal?.aborted) throw e
    return fallback()
  }
}
