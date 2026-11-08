import { speakViaLink, transcribeViaLink, useCreativeLink } from '../link'
import { uploadAsset } from '../storage'
import type { CreativeSet, SetAsset, SetBrand } from '../types'
import { writeNarration } from './roteiro'
import { rememberVoice } from './media'
import { transcribe, type TranscribeStep } from './transcribe'
import type { ExplainerBeat, ExplainerData, ExplainerWord } from './types'

/**
 * Narração por IA (2026-11-08, o usuário: "podemos conectar alguma voz para fazer a narração?";
 * escolheu a OpenAI, `gpt-4o-mini-tts`). O texto falado de cada cena (`fala`, escrito pela IA no
 * roteiro; sem ele, o texto da tela) vira uma narração só, pela voz escolhida, no conector deste
 * computador (`scripts/criativos/voz.ts`, a mesma chave das imagens). O MP3 sobe ao conjunto, é
 * transcrito no navegador para ter o tempo de cada palavra, e cada cena passa a começar quando a
 * voz começa a falar dela. Daí em diante o vídeo é uma narração como as gravadas (legenda, cortes,
 * sincronia), com `voiceAI` guardando a voz para refazer.
 */

/** marin e cedar primeiro: são as que a OpenAI indica como as mais naturais no gpt-4o-mini-tts. */
export const VOICES = [
  { id: 'marin', label: 'Marin', hint: 'feminina, natural (recomendada)' },
  { id: 'cedar', label: 'Cedar', hint: 'masculina, natural (recomendada)' },
  { id: 'coral', label: 'Coral', hint: 'feminina, calorosa' },
  { id: 'nova', label: 'Nova', hint: 'feminina, animada' },
  { id: 'shimmer', label: 'Shimmer', hint: 'feminina, suave' },
  { id: 'sage', label: 'Sage', hint: 'feminina, calma' },
  { id: 'ash', label: 'Ash', hint: 'masculina, clara' },
  { id: 'verse', label: 'Verse', hint: 'masculina, expressiva' },
  { id: 'ballad', label: 'Ballad', hint: 'masculina, suave' },
  { id: 'echo', label: 'Echo', hint: 'masculina, firme' },
  { id: 'onyx', label: 'Onyx', hint: 'masculina, grave' },
  { id: 'alloy', label: 'Alloy', hint: 'neutra' },
] as const

export { TONES, directionFor, elevenSettings, type ToneId, type VoiceAI, type VoiceProvider } from './voiceDirection'
import { directionFor, elevenSettings, type VoiceAI } from './voiceDirection'

/** O que a voz diz numa cena: a fala do roteiro, ou o texto da tela. */
export function spokenText(b: ExplainerBeat): string {
  if (b.fala?.trim()) return b.fala.trim()
  const parts = [b.headline.replace(/\*/g, '')]
  if (b.pattern === 'numero' && b.number) parts[0] = `${b.number.prefix ?? ''} ${b.number.value}${b.number.suffix ?? ''} ${parts[0]}`.trim()
  if (b.items?.length && (b.pattern === 'lista' || b.pattern === 'processo')) parts.push(b.items.join(', '))
  if (b.items?.length === 2 && b.pattern === 'comparar') parts.push(`${b.items[0]}? Não: ${b.items[1]}.`)
  if (b.sub && b.pattern !== 'cta') parts.push(b.sub)
  return parts.map((p) => p.trim().replace(/([^.!?])$/, '$1.')).join(' ')
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const tokens = (s: string) => s.split(/\s+/).map(norm).filter(Boolean)

/**
 * Onde cada cena começa na narração: procura a primeira palavra da fala da cena na transcrição,
 * andando sempre para a frente; sem achar, usa a proporção de palavras faladas até ali.
 */
export function alignBeats(beats: ExplainerBeat[], words: ExplainerWord[], duration: number): ExplainerBeat[] {
  const texts = beats.map((b) => tokens(spokenText(b)))
  const total = texts.reduce((a, t) => a + t.length, 0) || 1
  const spoken = words.map((w) => norm(w.w))
  let ptr = 0
  let before = 0
  const starts = texts.map((t, i) => {
    const expected = Math.round((before / total) * words.length)
    before += t.length
    if (i === 0) return 0
    const first = t.slice(0, 2)
    let hit = -1
    // Sempre a partir da última cena achada (uma frase que a transcrição perdeu não desloca as outras)
    const lo = ptr
    const hi = Math.min(words.length, Math.max(expected, ptr) + 24)
    // 1) as duas primeiras palavras juntas; 2) só a primeira; 3) a segunda (o Whisper errou a primeira): volta uma
    for (let j = lo; j < hi && hit < 0; j++) if (spoken[j] === first[0] && (first.length < 2 || spoken[j + 1] === first[1])) hit = j
    for (let j = lo; j < hi && hit < 0; j++) if (spoken[j] === first[0]) hit = j
    if (first[1]) for (let j = lo + 1; j < hi && hit < 0; j++) if (spoken[j] === first[1] || spoken[j].startsWith(first[1]) || first[1].startsWith(spoken[j])) hit = Math.max(ptr, j - 1)
    const idx = hit >= 0 ? hit : Math.min(words.length - 1, Math.max(ptr, expected))
    ptr = idx + 1
    return words[idx] ? Math.max(0, words[idx].s - 0.05) : (before / total) * duration
  })
  // Sempre em ordem, com pelo menos 0,8 s por cena
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 0.8)
  return beats.map((b, i) => ({ ...b, start: Math.round(starts[i] * 100) / 100, end: Math.round((i < beats.length - 1 ? starts[i + 1] : duration) * 100) / 100 }))
}

export async function narrate(set: CreativeSet, data: ExplainerData, opts: VoiceAI & { brand?: SetBrand; onStep?: (s: string) => void; signal?: AbortSignal }): Promise<{ patch: Partial<ExplainerData>; asset: SetAsset }> {
  // 1) A fala de cada cena como um monólogo falado e conectado (a voz soava robótica lendo texto de tela)
  let beatsIn = data.beats
  if (opts.rewrite !== false && opts.brand) {
    opts.onStep?.('A IA escreve a fala para soar natural…')
    try {
      const falas = await writeNarration(set, data, { brand: opts.brand, direction: opts.direction, signal: opts.signal, onStep: opts.onStep })
      beatsIn = data.beats.map((b, i) => ({ ...b, fala: falas[i] || b.fala }))
    } catch (err) {
      if (!data.beats.some((b) => b.fala)) throw err
      // Sem a IA, segue com as falas que o roteiro já tem
    }
  }
  // 2) Um parágrafo corrido, sem quebra de linha: a voz não "recomeça" a cada cena
  const text = beatsIn.map(spokenText).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('O roteiro não tem texto para narrar.')
  opts.onStep?.('A voz está narrando…')
  const out = opts.provider === 'elevenlabs'
    ? await speakViaLink({ provider: 'elevenlabs', text, voice: opts.voice, model: opts.model, ...elevenSettings(opts) }, opts.signal)
    : await speakViaLink({ text, voice: opts.voice, instructions: directionFor(opts, opts.brand?.name) }, opts.signal)
  const blob = await (await fetch(out.data)).blob()
  opts.onStep?.('Guardando a narração no conjunto…')
  const ext = out.type === 'audio/wav' ? 'wav' : 'mp3'
  const name = `narracao-ia-${out.voice}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`
  const asset = await uploadAsset(set, new File([blob], name, { type: out.type }), name)
  const src = `asset:${asset.id}`
  rememberVoice(src, blob, 'audio')
  const data2 = await blob.arrayBuffer()
  const probe = new AudioContext()
  const duration = Math.round((await probe.decodeAudioData(data2.slice(0))).duration * 100) / 100
  void probe.close()
  opts.onStep?.('Marcando o tempo de cada palavra…')
  // Com a chave da OpenAI, a transcrição precisa dela (o Whisper pequeno do navegador às vezes pula frases)
  let words: ExplainerWord[] | undefined
  if (useCreativeLink.getState().keys.openai) {
    try {
      words = (await transcribeViaLink(out.data, opts.signal)).words
      if (!words.length) words = undefined
    } catch {
      words = undefined
    }
  }
  if (!words) words = (await transcribe(data2, { onStep: (s: TranscribeStep) => s.kind === 'download' && opts.onStep?.(`Baixando o modelo de transcrição ${s.total ? Math.round((s.loaded / s.total) * 100) : 0}% (só na primeira vez)`) })).words
  const beats = alignBeats(beatsIn, words, duration)
  return {
    asset,
    patch: patchFor(beats, fixWords(beats, words), src, out.voice, duration, data, opts),
  }
}

/** A legenda com o texto exato do roteiro (o Whisper escreve "3" por "terceiro", erra acento): cena a cena, quando o número de palavras bate. */
export function fixWords(beats: ExplainerBeat[], words: ExplainerWord[]): ExplainerWord[] {
  const out = words.slice()
  for (const b of beats) {
    const idx = words.map((w, k) => (w.s >= b.start - 0.01 && w.s < b.end ? k : -1)).filter((k) => k >= 0)
    const toks = spokenText(b).split(/\s+/).filter(Boolean)
    if (idx.length && idx.length === toks.length) idx.forEach((k, i) => (out[k] = { ...out[k], w: toks[i] }))
  }
  return out
}

function patchFor(beats: ExplainerBeat[], words: ExplainerWord[], src: string, voice: string, duration: number, data: ExplainerData, opts: VoiceAI): Partial<ExplainerData> {
  return {
    mode: 'narracao',
    media: { src, name: `Narração por IA (${opts.voiceName ?? voice})`, kind: 'audio', duration },
    words,
    beats,
    cuts: [],
    layout: 'animacao',
    captions: data.captions === 'nenhuma' ? 'pop' : data.captions,
    enhanceVoice: true,
    gateVoice: false,
    voiceAI: { provider: opts.provider, voice: opts.voice, voiceName: opts.voiceName, model: opts.model, tone: opts.tone, speed: opts.speed, direction: opts.direction, rewrite: opts.rewrite },
  }
}
