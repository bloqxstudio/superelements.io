import type { ExplainerBeat, ExplainerData, ExplainerWord } from './types'

/**
 * Cortes na fala (2026-11-08, o usuário: "cortes também nos áudios podem ser necessários"). No modo
 * narração a fala original fica intacta no conjunto; `data.cuts` guarda os trechos tirados, em
 * segundos da fala original. Daqui saem os trechos mantidos e a conversão entre o tempo da fala
 * (`src`) e o tempo do vídeo (`out`): palavras, momentos do roteiro e o quadro do vídeo da pessoa
 * (que vira corte seco, o "jump cut" dos vídeos falados). No modo briefing não há fala no vídeo:
 * os momentos já estão no tempo do vídeo.
 */

export interface Segment {
  /** Início e fim na fala original. */
  s: number
  e: number
  /** Onde o trecho começa no vídeo. */
  at: number
}

const r2 = (n: number) => Math.round(n * 1000) / 1000

/** Junta e ordena os cortes, dentro da fala. */
export function cleanCuts(cuts: { s: number; e: number }[] | undefined, total: number) {
  const list = (cuts ?? []).map((c) => ({ s: Math.max(0, Math.min(c.s, c.e)), e: Math.min(total, Math.max(c.s, c.e)) })).filter((c) => c.e - c.s > 0.02).sort((a, b) => a.s - b.s)
  const out: { s: number; e: number }[] = []
  for (const c of list) {
    const last = out[out.length - 1]
    if (last && c.s <= last.e + 0.01) last.e = Math.max(last.e, c.e)
    else out.push({ ...c })
  }
  return out
}

/** Os trechos mantidos da fala, em ordem, com onde cada um entra no vídeo. */
export function segments(data: ExplainerData): Segment[] {
  const total = data.media?.duration ?? 0
  const cuts = cleanCuts(data.cuts, total)
  const out: Segment[] = []
  let from = 0
  let at = 0
  for (const c of [...cuts, { s: total, e: total }]) {
    if (c.s - from > 0.01) {
      out.push({ s: r2(from), e: r2(c.s), at: r2(at) })
      at += c.s - from
    }
    from = c.e
  }
  return out
}

export const keptLength = (segs: Segment[]) => segs.reduce((a, g) => a + (g.e - g.s), 0)

/** Tempo da fala → tempo do vídeo (dentro de um corte: o começo do trecho seguinte). */
export function toOut(segs: Segment[], t: number): number {
  for (const g of segs) {
    if (t < g.s) return g.at
    if (t <= g.e) return g.at + (t - g.s)
  }
  const last = segs[segs.length - 1]
  return last ? last.at + (last.e - last.s) : t
}

/** Tempo do vídeo → tempo da fala (para tocar e mostrar o quadro certo do vídeo da pessoa). */
export function toSrc(segs: Segment[], t: number): number {
  for (const g of segs) if (t < g.at + (g.e - g.s)) return g.s + Math.max(0, t - g.at)
  const last = segs[segs.length - 1]
  return last ? last.e : t
}

const isNarration = (data: ExplainerData) => (data.mode ?? 'narracao') === 'narracao'

/** As palavras faladas no tempo do vídeo, sem as cortadas. */
export function outWords(data: ExplainerData): ExplainerWord[] {
  if (!isNarration(data)) return []
  const segs = segments(data)
  const cuts = cleanCuts(data.cuts, data.media?.duration ?? 0)
  const inCut = (w: ExplainerWord) => cuts.some((c) => (w.s + w.e) / 2 >= c.s && (w.s + w.e) / 2 < c.e)
  return data.words.filter((w) => !inCut(w)).map((w) => ({ ...w, s: r2(toOut(segs, w.s)), e: r2(toOut(segs, w.e)) }))
}

/** Os momentos do roteiro no tempo do vídeo (no modo narração eles ficam guardados no tempo da fala). */
export function outBeats(data: ExplainerData, total: number): ExplainerBeat[] {
  if (!isNarration(data)) return data.beats
  const segs = segments(data)
  const mapped = data.beats.map((b) => ({ ...b, start: r2(toOut(segs, b.start)), end: r2(toOut(segs, b.end)) }))
  const endAt = data.endCard ? r2(keptLength(segs)) : total
  // Momento que ficou inteiro dentro de um corte some; os outros fecham os buracos
  const kept = mapped.filter((b, i) => i === 0 || b.end - b.start > 0.3)
  kept.forEach((b, i) => {
    if (i === 0) b.start = 0
    b.end = i < kept.length - 1 ? kept[i + 1].start : endAt
  })
  if (data.endCard) kept.push({ id: 'end-card', start: endAt, end: total, pattern: 'cta', headline: data.endCard.headline, sub: data.endCard.sub, fullScreen: true, transition: 'corte', sfx: 'swish' })
  return kept
}

/** Duração do vídeo: a fala mantida (narração) ou o fim do último momento (briefing). */
export function videoLength(data: ExplainerData): number {
  if (!isNarration(data)) return r2(Math.max(3, data.beats.at(-1)?.end ?? 10))
  return r2(keptLength(segments(data)) + (data.endCard ? Math.max(1, Math.min(15, data.endCard.duration)) : 0.25))
}

// ——— Cortes automáticos ———

/** Vícios de linguagem: palavras que saem sem perder sentido. */
const FILLERS = new Set(['é', 'éé', 'ééé', 'eh', 'ehh', 'hum', 'humm', 'hmm', 'ahn', 'ah', 'ãh', 'uh', 'tipo', 'né', 'então', 'assim', 'enfim', 'basicamente', 'ok'])
const bare = (w: string) => w.toLowerCase().replace(/[.,!?;:…]+/g, '').trim()

/** Encurta as pausas entre as frases para `keep` segundos (o ritmo dos vídeos curtos). */
export function pauseCuts(words: ExplainerWord[], total: number, min = 0.45, keep = 0.18): { s: number; e: number }[] {
  const out: { s: number; e: number }[] = []
  const pad = keep / 2
  if (words[0] && words[0].s > min) out.push({ s: 0, e: r2(words[0].s - pad) })
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].s - words[i - 1].e
    if (gap > min) out.push({ s: r2(words[i - 1].e + pad), e: r2(words[i].s - pad) })
  }
  const last = words[words.length - 1]
  if (last && total - last.e > min) out.push({ s: r2(last.e + 0.25), e: r2(total) })
  return out
}

/** Corta os vícios de linguagem ("é", "tipo", "né", "hum"…) que vêm soltos entre pausas ou no começo da frase. */
export function fillerCuts(words: ExplainerWord[]): { s: number; e: number }[] {
  return words
    .filter((w, i) => {
      const b = bare(w.w)
      if (!FILLERS.has(b)) return false
      // "então" e "assim" só quando soltos (pausa antes ou depois): no meio da frase eles têm sentido
      if (b === 'então' || b === 'assim' || b === 'tipo' || b === 'ok') {
        const before = i ? w.s - words[i - 1].e : 1
        const after = words[i + 1] ? words[i + 1].s - w.e : 1
        return before > 0.25 || after > 0.25 || /[,.]$/.test(w.w)
      }
      return true
    })
    .map((w) => ({ s: r2(Math.max(0, w.s - 0.02)), e: r2(w.e + 0.02) }))
}

/** Liga ou desliga o corte de uma palavra (clicar na transcrição). */
export function toggleWordCut(data: ExplainerData, w: ExplainerWord): { s: number; e: number }[] {
  const cuts = cleanCuts(data.cuts, data.media?.duration ?? 0)
  const mid = (w.s + w.e) / 2
  const hit = cuts.find((c) => mid >= c.s && mid < c.e)
  if (!hit) return [...cuts, { s: r2(Math.max(0, w.s - 0.02)), e: r2(w.e + 0.02) }]
  // Tira só o pedaço desta palavra do corte
  const out = cuts.filter((c) => c !== hit)
  if (w.s - 0.02 - hit.s > 0.02) out.push({ s: hit.s, e: r2(w.s - 0.02) })
  if (hit.e - (w.e + 0.02) > 0.02) out.push({ s: r2(w.e + 0.02), e: hit.e })
  return out
}
