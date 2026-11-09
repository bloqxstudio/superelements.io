import { rememberVoice } from './explicativo/media'
import { transcribe } from './explicativo/transcribe'
import { directionFor, elevenSettings, type VoiceAI } from './explicativo/voiceDirection'
import { DEFAULT_VOICE } from './explicativo/VoicePicker'
import { speakViaLink, transcribeViaLink, useCreativeLink } from './link'
import { uploadAsset } from './storage'
import type { CreativeSet, SetAsset } from './types'

/**
 * O que dá para editar numa animação em código sem pedir outra à IA (2026-11-09; o usuário: "parece que cria
 * algo fechado, onde não consigo trocar legenda, mudar o tipo etc. conforme temos em vídeo explicativo…
 * quero conseguir editar, trocar efeitos").
 *
 * Tudo mora em `CodeScene.data` (o `env.data` da cena):
 *   - `parts` e `words`: a narração em partes e o tempo de cada palavra. Mudar a fala refaz a voz
 *     (`narrateParts`) e as partes ganham os tempos novos; a cena acompanha porque lê `parts[i].start`.
 *   - `captions`: a legenda da fala, desenhada pelo motor por cima de qualquer animação (`sceneWorker.ts`).
 *   - `fields`: os campos que a IA expõe ao escrever a cena (textos da tela, cores, tipo de efeito,
 *     intensidade). O motor entrega os valores em `env.data.params[chave]`; mudar um campo redesenha na hora.
 */

export interface NarrationPart { label: string; text: string; start: number; end: number }
export interface SpokenWord { w: string; s: number; e: number }

export type CaptionStyle = 'nenhuma' | 'pop' | 'karaoke' | 'caixa' | 'contorno'
export const CAPTION_STYLES: { id: CaptionStyle; label: string }[] = [
  { id: 'nenhuma', label: 'Sem legenda' },
  { id: 'pop', label: 'Pop' },
  { id: 'karaoke', label: 'Karaokê' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'contorno', label: 'Contorno' },
]
export interface SceneCaptions {
  style: CaptionStyle
  /** Altura do centro da legenda, de 0 (topo) a 1 (base). */
  y?: number
  /** Escala do texto (1 = o tamanho padrão). */
  size?: number
  /** Cor de destaque da palavra falada; sem ela, a 2ª cor da marca. */
  color?: string
}

export type FieldType = 'texto' | 'cor' | 'numero' | 'opcao' | 'liga'
export interface SceneField {
  key: string
  label: string
  type: FieldType
  value: string | number | boolean
  options?: string[]
  min?: number
  max?: number
  step?: number
  /** O grupo do campo no painel (ex.: "Parte 2", "Cores", "Efeitos"). */
  group?: string
}

export interface SceneData {
  parts?: NarrationPart[]
  words?: SpokenWord[]
  captions?: SceneCaptions
  fields?: SceneField[]
  voice?: VoiceAI
  [k: string]: unknown
}

export const sceneDataOf = (data: unknown): SceneData => (data && typeof data === 'object' ? (data as SceneData) : {})

const KEY = /^[a-zA-Z_][\w]{0,39}$/
const TYPES: FieldType[] = ['texto', 'cor', 'numero', 'opcao', 'liga']

/** Os campos que a IA devolveu (JSON), conferidos: chave válida, tipo conhecido, valor coerente. */
export function parseFields(raw: string | undefined): SceneField[] | undefined {
  if (!raw?.trim()) return undefined
  let list: unknown
  try {
    list = JSON.parse(raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, ''))
  } catch {
    return undefined
  }
  if (!Array.isArray(list)) return undefined
  const seen = new Set<string>()
  const out: SceneField[] = []
  for (const f of list as Record<string, unknown>[]) {
    const key = String(f?.key ?? '')
    const type = String(f?.type ?? '') as FieldType
    if (!KEY.test(key) || seen.has(key) || !TYPES.includes(type)) continue
    seen.add(key)
    const field: SceneField = { key, label: String(f.label ?? key).slice(0, 48), type, value: '' }
    if (typeof f.group === 'string' && f.group.trim()) field.group = f.group.trim().slice(0, 32)
    if (type === 'numero') {
      field.min = Number.isFinite(Number(f.min)) ? Number(f.min) : 0
      field.max = Number.isFinite(Number(f.max)) ? Number(f.max) : 1
      field.step = Number.isFinite(Number(f.step)) && Number(f.step) > 0 ? Number(f.step) : (field.max - field.min) / 100
      const v = Number(f.value)
      field.value = Number.isFinite(v) ? Math.min(field.max, Math.max(field.min, v)) : field.min
    } else if (type === 'liga') {
      field.value = f.value === true || f.value === 'true'
    } else if (type === 'opcao') {
      const options = Array.isArray(f.options) ? f.options.map(String).filter(Boolean).slice(0, 8) : []
      if (options.length < 2) continue
      field.options = options
      field.value = options.includes(String(f.value)) ? String(f.value) : options[0]
    } else if (type === 'cor') {
      const v = String(f.value ?? '')
      field.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#FFFFFF'
    } else {
      field.value = String(f.value ?? '').slice(0, 200)
    }
    out.push(field)
    if (out.length >= 40) break
  }
  return out.length ? out : undefined
}

/** Para a IA ao ajustar: os campos de agora, com os valores que a pessoa escolheu. */
export const describeFields = (fields: SceneField[] | undefined) =>
  fields?.length ? JSON.stringify(fields.map(({ key, label, type, value, options, min, max, step, group }) => ({ key, label, type, value, options, min, max, step, group }))) : ''

const norm = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

/** O início de cada parte: a palavra falada que corresponde à primeira palavra da parte, contando em ordem. */
export function partTimes(parts: { label: string; text: string }[], words: SpokenWord[], duration: number): NarrationPart[] {
  let cursor = 0
  const starts = parts.map((p, i) => {
    if (i === 0) return 0
    const first = norm(p.text.split(/\s+/)[0] ?? '')
    // Conta as palavras das partes anteriores e procura a primeira desta perto dali
    const before = parts.slice(0, i).reduce((n, q) => n + q.text.split(/\s+/).filter(Boolean).length, 0)
    let k = Math.min(words.length - 1, Math.max(cursor, before - 3))
    for (let j = k; j < Math.min(words.length, before + 6); j++) if (norm(words[j].w) === first) { k = j; break }
    cursor = k
    return words[k]?.s ?? (duration * i) / parts.length
  })
  return parts.map((p, i) => ({ ...p, start: Math.max(0, starts[i] - (i ? 0.2 : 0)), end: i < parts.length - 1 ? starts[i + 1] - 0.2 : duration }))
}

/**
 * A voz da OpenAI vem em WAV "de transmissão", com o tamanho 0xFFFFFFFF no cabeçalho. Alguns tocadores leem além
 * do fim e dão estalo ao pular perto do final: grava os tamanhos de verdade (RIFF e data). Outros formatos passam.
 */
export function fixWav(buf: ArrayBuffer): ArrayBuffer {
  const v = new DataView(buf)
  if (buf.byteLength < 44 || v.getUint32(0, false) !== 0x52494646 || v.getUint32(8, false) !== 0x57415645) return buf
  let at = 12
  while (at + 8 <= buf.byteLength) {
    const id = v.getUint32(at, false), size = v.getUint32(at + 4, true)
    if (id === 0x64617461) {
      const data = buf.byteLength - (at + 8)
      if (size === 0xffffffff || size > data) v.setUint32(at + 4, data - (data % 2), true)
      v.setUint32(4, buf.byteLength - 8, true)
      return buf
    }
    at += 8 + size + (size % 2)
  }
  return buf
}

export interface Narration {
  parts: NarrationPart[]
  words: SpokenWord[]
  /** Segundos de voz. */
  seconds: number
  asset: SetAsset
  /** Para o painel de trilha: "Narração OpenAI (marin)". */
  name: string
  /** A narração em data URL (testes por comando). */
  dataUrl: string
}

/**
 * Narra as partes numa voz só (um parágrafo corrido, sem a voz "recomeçar" a cada parte), marca o tempo de
 * cada palavra e de cada parte e guarda o áudio no conjunto (`dryRun`: não guarda).
 */
export async function narrateParts(set: CreativeSet, parts: { label: string; text: string }[], voice: VoiceAI = DEFAULT_VOICE, opts: { onStep?: (s: string) => void; signal?: AbortSignal; dryRun?: boolean } = {}): Promise<Narration> {
  const text = parts.map((p) => p.text.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('As partes não têm fala para narrar.')
  opts.onStep?.('A voz está narrando…')
  const out = voice.provider === 'elevenlabs'
    ? await speakViaLink({ provider: 'elevenlabs', text, voice: voice.voice, model: voice.model, ...elevenSettings(voice) }, opts.signal)
    : await speakViaLink({ text, voice: voice.voice || 'marin', instructions: directionFor(voice, set.brand.name) }, opts.signal)
  const buf = fixWav(await (await fetch(out.data)).arrayBuffer())
  const blob = new Blob([buf], { type: out.type || 'audio/mpeg' })
  const ac = new AudioContext()
  const seconds = Math.round((await ac.decodeAudioData(buf.slice(0))).duration * 100) / 100
  void ac.close()
  opts.onStep?.('Marcando o tempo de cada palavra…')
  let words: SpokenWord[] = []
  if (useCreativeLink.getState().keys.openai) {
    try { words = (await transcribeViaLink(out.data, opts.signal)).words } catch { words = [] }
  }
  if (!words.length) words = (await transcribe(buf)).words
  const ext = out.type === 'audio/wav' ? 'wav' : 'mp3'
  const file = `narracao-${Date.now().toString(36)}.${ext}`
  let asset: SetAsset = { id: 'teste', name: file, path: '', width: 0, height: 0 }
  if (!opts.dryRun) {
    opts.onStep?.('Guardando a narração no conjunto…')
    asset = await uploadAsset(set, new File([blob], file, { type: out.type || 'audio/mpeg' }), file)
    rememberVoice(`asset:${asset.id}`, blob, 'audio')
  }
  const who = voice.provider === 'elevenlabs' ? `ElevenLabs (${voice.voiceName ?? out.voice})` : `OpenAI (${out.voice})`
  return { parts: partTimes(parts, words, seconds), words, seconds, asset, name: `Narração ${who}`, dataUrl: out.data }
}
