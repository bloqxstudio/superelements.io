import { resolveIa } from '@/features/ia/porTarefa'
import { accountContext } from '@/features/cerebro/accountContext'
import { useCrm } from '@/features/crm/crmStore'
import { standardBlock } from '@/features/cerebro/standard'
import { callAiQuiet } from '../link'
import type { CreativeSet, SetBrand } from '../types'
import { ICON_NAMES } from './icons'
import { BRIEFING_SYSTEM, EFFECT_RULES, NARRATION_SYSTEM, NARRATION_WRITER } from './prompts'
import { cleanCuts } from './timeline'
import { EFFECTS, PATTERNS, SFX, TRANSITIONS, type EffectId, type ExplainerBeat, type ExplainerData, type ExplainerWord, type PatternId, type SfxId, type TransitionId } from './types'

/**
 * O roteiro do vídeo explicativo, nos dois modos (`types.ts`, `MODES`):
 * - **narração** (`writeScript`): a fala é o áudio do vídeo; a IA divide em momentos que começam
 *   em palavras faladas e sugere cortes (repetições, falsos começos, trechos fora do assunto).
 * - **briefing** (`writeBriefing`): a fala, o vídeo ou o texto são só o briefing; a IA escreve o
 *   roteiro inteiro, com os textos e o tempo de cada momento, sem seguir a fala passo a passo.
 * Nos dois a IA usa o design system e a voz da marca (DESIGN.md e os padrões do Cérebro), os
 * ícones de traço e a palavra de destaque, em frase normal (não tudo em maiúsculas). Sem IA, o
 * roteiro automático (`autoScript`) corta nas pausas e escolhe por regra.
 */

const uid = () => Math.random().toString(36).slice(2, 10)

const STOP = new Set('a o e é de da do das dos em no na nos nas um uma uns umas que se por para pra pro com como mais mas ou ao aos à às eu você vc voce ele ela eles elas isso esse essa este esta aqui ali lá la não nao sim já ja tem ter ser foi vai vou então entao tipo né ne só so muito muita bem também tambem quando porque pq qual quais seu sua seus suas meu minha nosso nossa faz fazia fazem fica ficar tá ta está esta estão era vem vêm até ate pode the and to of is'.split(' '))
const clean = (w: string) => w.replace(/[^\p{L}\p{N}%$,.-]/gu, '').replace(/[.,]+$/, '')
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Ícone pelo assunto da frase (roteiro automático). */
const ICON_BY: [RegExp, string][] = [
  [/dinheiro|real|reais|grana|lucro|venda|vend|fatur|preço|preco|pagar|custo/i, 'dinheiro'],
  [/tempo|hora|minuto|rápido|rapido|prazo|demor/i, 'relogio'],
  [/client|pessoa|gente|públic|public|seguidor/i, 'pessoas'],
  [/ideia|dica|segredo|truque/i, 'ideia'],
  [/erro|errad|problema|cuidado|nunca/i, 'alerta'],
  [/cresc|aument|result|meta|subir/i, 'grafico'],
  [/celular|app|instagram|rede|post|reels|vídeo|video/i, 'celular'],
  [/direct|mensag|respond|convers|whats/i, 'conversa'],
  [/comida|fome|lanche|burger|pizza|restaurante/i, 'comida'],
  [/loja|empresa|negócio|negocio/i, 'loja'],
  [/alvo|foco|objetivo/i, 'alvo'],
  [/nome|pessoal/i, 'pessoa'],
  [/salv/i, 'salvar'],
  [/segu/i, 'curtir'],
]
const iconFor = (text: string) => ICON_BY.find(([re]) => re.test(text))?.[1] ?? 'brilho'

/** Corta as palavras em trechos nas pausas, na pontuação e a cada ~3 s. */
export function segments(words: ExplainerWord[]): ExplainerWord[][] {
  const out: ExplainerWord[][] = []
  let cur: ExplainerWord[] = []
  words.forEach((w, i) => {
    cur.push(w)
    const next = words[i + 1]
    const gap = next ? next.s - w.e : 1
    const dur = w.e - cur[0].s
    if (!next || gap > 0.45 || (/[.!?]$/.test(w.w) && dur > 1.2) || dur > 3.4 || cur.length >= 11) {
      out.push(cur)
      cur = []
    }
  })
  const merged: ExplainerWord[][] = []
  for (const seg of out) {
    const prev = merged[merged.length - 1]
    if (prev && seg[seg.length - 1].e - seg[0].s < 1.1 && prev[prev.length - 1].e - prev[0].s < 3.2) prev.push(...seg)
    else merged.push(seg)
  }
  return merged
}

const TRANS: TransitionId[] = ['chicote', 'circulo', 'chicote', 'zoom', 'corte', 'chicote']
const SFX_OF: Record<PatternId, SfxId> = { gancho: 'impacto', titulo: 'whoosh', icone: 'pop', lista: 'clique', numero: 'subida', comparar: 'whoosh', processo: 'clique', foto: 'swish', pergunta: 'digitar', citacao: 'swish', cta: 'ding' }

/** Roteiro sem IA (modo narração): corta nas pausas e escolhe os padrões por regra. */
export function autoScript(words: ExplainerWord[], total: number, photos: string[] = []): ExplainerBeat[] {
  const segs = segments(words)
  if (!segs.length) return [{ id: uid(), start: 0, end: total, pattern: 'titulo', headline: 'Sua ideia aqui', transition: 'corte', sfx: 'whoosh' }]
  let photo = 0
  return segs.map((seg, i) => {
    const text = seg.map((w) => w.w).join(' ')
    const keys = seg.map((w) => clean(w.w)).filter((w) => w && !STOP.has(w.toLowerCase()))
    // O título é a própria frase falada (até 7 palavras, até a primeira pausa de pontuação): entra junto com a voz
    const phrase: string[] = []
    for (const w of seg) {
      phrase.push(w.w.replace(/[.,!?;:]+$/, ''))
      if (phrase.length >= 7 || (phrase.length >= 3 && /[.,!?;:]$/.test(w.w))) break
    }
    const longest = [...keys].sort((a, b) => b.length - a.length)[0]
    const num = text.match(/(R\$\s?)?(\d+(?:[.,]\d+)?)\s?(%|mil|x|vezes|reais)?/i)
    const last = i === segs.length - 1
    let pattern: PatternId = i === 0 ? 'gancho' : last && /segu|salv|coment|compart|link|chama|clica/i.test(text) ? 'cta' : num ? 'numero' : /\?$/.test(text) ? 'pergunta' : photos.length && i % 3 === 2 ? 'foto' : i % 2 ? 'icone' : 'titulo'
    if (last && pattern !== 'cta' && segs.length > 2 && /segu|salv|coment/i.test(text)) pattern = 'cta'
    const beat: ExplainerBeat = {
      id: uid(),
      start: i === 0 ? 0 : seg[0].s,
      end: last ? total : segs[i + 1][0].s,
      pattern,
      headline: sentence(phrase.join(' ')),
      highlight: longest ? [longest.toLowerCase()] : [],
      icon: iconFor(text),
      transition: i === 0 ? 'corte' : TRANS[i % TRANS.length],
      sfx: SFX_OF[pattern],
    }
    if (pattern === 'numero' && num) beat.number = { value: Number(num[2].replace(',', '.')), prefix: num[1]?.trim() || undefined, suffix: num[3] && num[3] !== 'reais' ? num[3] : undefined }
    if (pattern === 'foto') beat.photo = photos[photo++ % photos.length]
    if (pattern === 'cta') beat.headline = /segu/i.test(text) ? 'Segue para mais' : /salv/i.test(text) ? 'Salva esse vídeo' : beat.headline
    return beat
  })
}

type RawBeat = Partial<ExplainerBeat> & { duration?: number; emoji?: string }

function beatFrom(b: RawBeat, start: number, photos: string[]): ExplainerBeat {
  const pattern = (b.pattern && b.pattern in PATTERNS ? b.pattern : 'titulo') as PatternId
  return {
    id: b.id || uid(),
    start: Math.round(start * 100) / 100,
    end: 0,
    pattern,
    headline: String(b.headline ?? '').slice(0, 80) || '…',
    highlight: Array.isArray(b.highlight) ? b.highlight.map(String).slice(0, 3) : [],
    sub: b.sub ? String(b.sub).slice(0, 120) : undefined,
    fala: b.fala ? String(b.fala).slice(0, 400) : undefined,
    kicker: b.kicker ? String(b.kicker).slice(0, 30) : undefined,
    items: Array.isArray(b.items) ? b.items.map(String).slice(0, 5) : undefined,
    labels: Array.isArray(b.labels) ? b.labels.map(String).slice(0, 2) : undefined,
    number: b.number && Number.isFinite(Number(b.number.value)) ? { value: Number(b.number.value), prefix: b.number.prefix || undefined, suffix: b.number.suffix || undefined } : undefined,
    icon: b.icon && ICON_NAMES.includes(b.icon) ? b.icon : undefined,
    emoji: b.icon ? undefined : b.emoji ? String(b.emoji).slice(0, 8) : undefined,
    photo: b.photo && photos.includes(b.photo) ? b.photo : undefined,
    transition: (b.transition && b.transition in TRANSITIONS ? b.transition : 'chicote') as TransitionId,
    sfx: (b.sfx && b.sfx in SFX ? b.sfx : SFX_OF[pattern]) as SfxId,
    effect: b.effect && b.effect in EFFECTS ? (b.effect as EffectId) : undefined,
  }
}

/** Ajusta um roteiro de narração (da IA ou editado): em ordem, começando em palavras faladas, sem buracos. */
export function normalizeBeats(raw: RawBeat[], total: number, words: ExplainerWord[], photos: string[]): ExplainerBeat[] {
  const list = raw.filter((b) => b && Number.isFinite(Number(b.start))).map((b) => ({ ...b, start: Math.max(0, Math.min(total - 0.3, Number(b.start))) })).sort((a, b) => a.start! - b.start!)
  const out: ExplainerBeat[] = []
  for (const b of list) {
    const near = words.reduce<ExplainerWord | undefined>((best, w) => (!best || Math.abs(w.s - b.start!) < Math.abs(best.s - b.start!) ? w : best), undefined)
    let start = near && Math.abs(near.s - b.start!) < 0.6 ? near.s : b.start!
    if (!out.length) start = 0
    if (out.length && start - out[out.length - 1].start < 0.6) continue
    out.push(beatFrom(b, start, photos))
  }
  out.forEach((b, i) => (b.end = i < out.length - 1 ? out[i + 1].start : total))
  return out
}

/** Roteiro do modo briefing: cada momento com a duração que a IA deu (1,5 a 6 s). */
export function briefingBeats(raw: RawBeat[], photos: string[]): ExplainerBeat[] {
  let at = 0
  return raw.slice(0, 16).map((b) => {
    const dur = Math.min(6, Math.max(1.5, Number(b.duration) || 2.8))
    const beat = beatFrom(b, at, photos)
    at += dur
    beat.end = Math.round(at * 100) / 100
    return beat
  })
}


async function brandContext(brand: SetBrand) {
  const voice = (await accountContext('9x16').catch(() => undefined))?.context || (await standardBlock(useCrm.getState().team?.id, '9x16'))
  return [`## Marca\n${brand.name || '(sem nome)'}; fontes ${brand.headingFont} / ${brand.bodyFont}${brand.emphasisFont && brand.emphasisFont !== brand.headingFont ? `, destaque em ${brand.emphasisFont}` : ''}. As cores e o logo o vídeo já aplica.`, voice ? `## Voz e regras da marca\n${voice}` : ''].filter(Boolean).join('\n\n')
}

/** As mídias do vídeo para a IA: o nome (campo photo), o que é e de onde veio. */
function mediaList(data: ExplainerData): string {
  if (!data.photos.length) return '## Fotos\nNenhuma: não use o padrão foto.'
  const lines = data.photos.map((p) => `- ${p.name}: ${p.desc ?? 'foto enviada'}${p.kind === 'video' ? ' (VÍDEO curto, entra andando no cartão)' : ''}${p.origin === 'marca' ? ' — PRODUTO REAL DA MARCA' : ''}`)
  return `## Fotos e vídeos reais disponíveis (campo photo, pelo nome)\nUse-os nas cenas certas: o produto da marca no fecho ou na cena em que a marca aparece (pode citar o produto, ele existe); fotos reais da moto ou do assunto nas cenas que falam dele; os vídeos curtos nas cenas de ação ou transição. Cada mídia pode aparecer em mais de uma cena; use todas pelo menos uma vez.\n${lines.join('\n')}`
}

const STEP: Record<string, string> = { start: 'Começando…', thinking: 'Pensando no roteiro…', reading: 'Lendo o material…', writing: 'Escrevendo o roteiro…' }

function parseList(text: string): RawBeat[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim())
  } catch {
    throw new Error('A IA não devolveu o roteiro num formato que eu leia. Tente de novo.')
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { beats?: unknown[] })?.beats
  if (!Array.isArray(list) || !list.length) throw new Error('A IA devolveu um roteiro vazio. Tente de novo.')
  return list as RawBeat[]
}

// ——— Modo narração ———


function transcriptFor(words: ExplainerWord[]) {
  return segments(words).map((seg) => seg.map((w) => `${w.w}@${w.s.toFixed(2)}`).join(' ')).join('\n')
}

export async function writeScript(set: CreativeSet, data: ExplainerData, total: number, opts: { brand: SetBrand; reference?: string[]; signal?: AbortSignal; onStep?: (s: string) => void }): Promise<{ beats: ExplainerBeat[]; cuts: { s: number; e: number }[]; caption?: string; reply?: string }> {
  const photos = data.photos.map((p) => p.name)
  const prompt = [
    `## A fala (${total.toFixed(1)} s; cada palavra@segundo em que começa)\n${transcriptFor(data.words)}`,
    data.brief?.trim() ? `## O pedido\n${data.brief.trim()}` : '',
    await brandContext(opts.brand),
    mediaList(data),
    data.layout !== 'animacao' ? '## Formato\nA pessoa aparece no vídeo; as animações dividem a tela com ela. Headlines ainda mais curtos.' : '',
    data.look === 'recorte' ? EFFECT_RULES(data.photos.some((p) => p.kind !== 'video')) : '',
    opts.reference?.length ? `## Referência\n${opts.reference.length} quadros de um vídeo de referência vão anexados: siga o ritmo, o tipo de cena e o jeito de usar texto e elementos, mas nas fontes, cores e voz desta marca (nunca a marca nem os textos de outra pessoa).` : '',
  ].filter(Boolean).join('\n\n')
  const out = await callAiQuiet<{ reply?: string; items?: { ref: string; text: string }[] }>('agent', { engine: resolveIa('criativos'), system: NARRATION_SYSTEM(), prompt, images: (opts.reference ?? []).slice(0, 10) }, opts.signal, (step, detail) => opts.onStep?.(detail || STEP[step] || 'Trabalhando…'))
  const item = (ref: string) => (out.items ?? []).find((i) => i?.ref === ref)?.text ?? ''
  const beats = normalizeBeats(parseList(item('roteiro')), total, data.words, photos)
  let cuts: { s: number; e: number }[] = []
  try {
    const raw = JSON.parse(item('cortes').replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim() || '[]') as { de?: number; ate?: number }[]
    cuts = cleanCuts(raw.map((c) => ({ s: Number(c.de), e: Number(c.ate) })).filter((c) => Number.isFinite(c.s) && Number.isFinite(c.e) && c.e - c.s < total * 0.4), total)
  } catch {
    // Sem cortes legíveis: segue sem eles
  }
  return { beats, cuts, caption: item('legenda').trim() || undefined, reply: out.reply?.trim() || undefined }
}

// ——— Modo briefing ———


export async function writeBriefing(set: CreativeSet, data: ExplainerData, opts: { brand: SetBrand; reference?: string[]; signal?: AbortSignal; onStep?: (s: string) => void }): Promise<{ beats: ExplainerBeat[]; caption?: string; reply?: string }> {
  const photos = data.photos.map((p) => p.name)
  const spoken = data.words.map((w) => w.w).join(' ').trim()
  if (!spoken && !data.briefText?.trim()) throw new Error('Escreva o briefing ou grave/envie uma fala.')
  const prompt = [
    data.briefText?.trim() ? `## O briefing (texto)\n${data.briefText.trim()}` : '',
    spoken ? `## O briefing (fala transcrita)\n${spoken}` : '',
    data.brief?.trim() ? `## Pedido extra\n${data.brief.trim()}` : '',
    await brandContext(opts.brand),
    mediaList(data),
    opts.reference?.length ? `## Referência\n${opts.reference.length} quadros de um vídeo de referência vão anexados: siga o ritmo, a estrutura e o jeito de animar, nas fontes, cores e voz desta marca (nunca a marca nem os textos de outra pessoa).` : '',
  ].filter(Boolean).join('\n\n')
  const out = await callAiQuiet<{ reply?: string; items?: { ref: string; text: string }[] }>('agent', { engine: resolveIa('criativos'), system: BRIEFING_SYSTEM(), prompt, images: (opts.reference ?? []).slice(0, 10) }, opts.signal, (step, detail) => opts.onStep?.(detail || STEP[step] || 'Trabalhando…'))
  const item = (ref: string) => (out.items ?? []).find((i) => i?.ref === ref)?.text ?? ''
  const beats = briefingBeats(parseList(item('roteiro')), photos)
  if (beats.length) beats[0].transition = 'corte'
  return { beats, caption: item('legenda').trim() || undefined, reply: out.reply?.trim() || undefined }
}

// ——— Texto da narração por voz de IA ———


/** Reescreve a fala de cada cena como um monólogo natural (o que a voz de IA vai dizer). */
export async function writeNarration(set: CreativeSet, data: ExplainerData, opts: { brand: SetBrand; direction?: string; signal?: AbortSignal; onStep?: (s: string) => void }): Promise<string[]> {
  const scenes = data.beats.map((b, i) => {
    const parts = [`${i + 1}. [${b.pattern}, ${(b.end - b.start).toFixed(1)} s] tela: ${b.headline.replace(/\*/g, '')}`]
    if (b.sub) parts.push(`apoio: ${b.sub}`)
    if (b.items?.length) parts.push(`itens: ${b.items.join(' | ')}`)
    if (b.number) parts.push(`número: ${b.number.prefix ?? ''}${b.number.value}${b.number.suffix ?? ''}`)
    if (b.fala) parts.push(`fala atual: ${b.fala}`)
    return parts.join(' · ')
  })
  const prompt = [
    `## As cenas (${data.beats.length})\n${scenes.join('\n')}`,
    data.briefText?.trim() ? `## O briefing\n${data.briefText.trim()}` : '',
    opts.direction?.trim() ? `## Direção do usuário para a narração\n${opts.direction.trim()}` : '',
    await brandContext(opts.brand),
  ].filter(Boolean).join('\n\n')
  const out = await callAiQuiet<{ items?: { ref: string; text: string }[] }>('agent', { engine: resolveIa('criativos'), system: NARRATION_WRITER(), prompt }, opts.signal, (step, detail) => opts.onStep?.(detail || 'Escrevendo a fala…'))
  const raw = (out.items ?? []).find((i) => i?.ref === 'falas')?.text ?? ''
  let list: unknown
  try {
    list = JSON.parse(raw.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim())
  } catch {
    throw new Error('A IA não devolveu as falas num formato que eu leia.')
  }
  if (!Array.isArray(list) || list.length !== data.beats.length) throw new Error('A IA devolveu um número de falas diferente do número de cenas.')
  return list.map((t) => String(t ?? '').replace(/[*"“”()#]/g, '').replace(/\s+/g, ' ').trim())
}
