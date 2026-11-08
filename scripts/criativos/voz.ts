import { apiKey } from './imagem.ts'

/**
 * Narração por IA do vídeo explicativo (2026-11-08, o usuário: "podemos conectar alguma voz para
 * fazer a narração?"; escolheu a OpenAI). Roda no conector, com a mesma chave da OpenAI que os
 * Criativos já usam para imagens (`~/.superelements/chaves.json`): o navegador manda o texto e o
 * jeito de falar, recebe o MP3. A chave nunca sai deste computador.
 */

// A versão de dezembro de 2025 do gpt-4o-mini-tts soa mais natural; sem ela na conta, cai para o nome genérico
export const VOICE_MODEL = () => process.env.SE_OPENAI_TTS_MODEL || 'gpt-4o-mini-tts-2025-12-15'
// marin e cedar são as que a OpenAI indica como as mais naturais no gpt-4o-mini-tts
const VOICES = new Set(['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'])
const MAX_CHARS = 4000

export interface SpeakRequest {
  /** Sem o campo: OpenAI. */
  provider?: 'openai' | 'elevenlabs'
  text: string
  voice?: string
  /** Como falar (tom, ritmo, sotaque). */
  instructions?: string
  /** 0,25 a 4. Só nos modelos tts-1: no gpt-4o-mini-tts o ritmo vai na direção (o `speed` estica o áudio e deixa a voz metálica). */
  speed?: number
  /** ElevenLabs: modelo, estabilidade (menos = mais expressiva), estilo (exagero) e semelhança com a voz. */
  model?: string
  stability?: number
  style?: number
  similarity?: number
}

export async function speak(req: SpeakRequest, signal?: AbortSignal): Promise<{ data: string; type: string; model: string; voice: string }> {
  return req.provider === 'elevenlabs' ? speakEleven(req, signal) : speakOpenAI(req, signal)
}

async function speakOpenAI(req: SpeakRequest, signal?: AbortSignal): Promise<{ data: string; type: string; model: string; voice: string }> {
  const key = apiKey('openai')
  if (!key) throw new Error('Sem chave da OpenAI neste computador. Guarde a chave (a mesma das imagens) e tente de novo.')
  const text = String(req.text ?? '').trim()
  if (!text) throw new Error('O texto da narração veio vazio.')
  if (text.length > MAX_CHARS) throw new Error(`A narração passa de ${MAX_CHARS} caracteres (uns 4 minutos). Encurte o roteiro.`)
  const wanted = VOICES.has(String(req.voice)) ? String(req.voice) : 'marin'
  let model = VOICE_MODEL()
  const legacy = model === 'tts-1' || model === 'tts-1-hd'
  const call = (voice: string) => fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    signal,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      // WAV: sem a perda do MP3 antes da mixagem (o MP4 já recomprime em AAC)
      response_format: 'wav',
      ...(req.instructions?.trim() && !legacy ? { instructions: req.instructions.trim().slice(0, 4000) } : {}),
      ...(legacy && req.speed && req.speed !== 1 ? { speed: Math.min(4, Math.max(0.25, Number(req.speed))) } : {}),
    }),
  })
  let voice = wanted
  let res = await call(voice)
  // Modelo que a conta não tem: tenta o nome genérico
  if ((res.status === 404 || res.status === 400) && model !== 'gpt-4o-mini-tts' && /model/i.test(await res.clone().text().catch(() => ''))) {
    model = 'gpt-4o-mini-tts'
    res = await call(voice)
  }
  // Voz que a conta ainda não tem (marin/cedar em modelo antigo): cai para a coral
  if (res.status === 400 && voice !== 'coral') {
    const body = await res.clone().text().catch(() => '')
    if (/voice/i.test(body)) {
      voice = 'coral'
      res = await call(voice)
    }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const message = (() => {
      try {
        return (JSON.parse(detail) as { error?: { message?: string } }).error?.message
      } catch {
        return undefined
      }
    })()
    if (res.status === 401) throw new Error('A OpenAI recusou a chave (401). Confira a chave guardada neste computador.')
    if (res.status === 429) throw new Error('A OpenAI recusou por limite ou saldo (429). Confira os créditos da conta.')
    throw new Error(`A OpenAI não gerou a voz (${res.status}): ${message ?? detail.slice(0, 200)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return { data: `data:audio/wav;base64,${buf.toString('base64')}`, type: 'audio/wav', model, voice }
}

// ——— ElevenLabs (2026-11-08, o usuário: "add suporte para elevenlabs também") ———

const ELEVEN = 'https://api.elevenlabs.io/v1'
const ELEVEN_MODELS = new Set(['eleven_multilingual_v2', 'eleven_v3', 'eleven_turbo_v2_5', 'eleven_flash_v2_5'])

async function elevenError(res: Response, what: string): Promise<never> {
  const detail = await res.text().catch(() => '')
  let message: string | undefined
  try {
    const j = JSON.parse(detail) as { detail?: { message?: string; status?: string } | string }
    message = typeof j.detail === 'string' ? j.detail : j.detail?.message ?? j.detail?.status
  } catch {
    // corpo sem JSON
  }
  if (res.status === 401) throw new Error('A ElevenLabs recusou a chave (401). Confira a chave guardada neste computador.')
  if (res.status === 402 || /quota|credits/i.test(detail)) throw new Error('A ElevenLabs recusou por créditos do plano. Confira o saldo da conta.')
  throw new Error(`A ElevenLabs não ${what} (${res.status}): ${message ?? detail.slice(0, 200)}`)
}

const elevenKey = () => {
  const key = apiKey('elevenlabs')
  if (!key) throw new Error('Sem chave da ElevenLabs neste computador. Guarde a chave e tente de novo.')
  return key
}

export interface ElevenVoice {
  id: string
  name: string
  /** premade, cloned, generated, professional */
  category: string
  description: string
  preview?: string
}

/** As vozes da conta da ElevenLabs (as prontas e as clonadas da pessoa). */
export async function elevenVoices(signal?: AbortSignal): Promise<ElevenVoice[]> {
  const res = await fetch(`${ELEVEN}/voices`, { signal, headers: { 'xi-api-key': elevenKey() } })
  if (!res.ok) await elevenError(res, 'listou as vozes')
  const j = (await res.json()) as { voices?: { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string; description?: string }[] }
  return (j.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category ?? 'premade',
    description: [v.labels?.gender, v.labels?.accent, v.labels?.age, v.labels?.description ?? v.labels?.descriptive, v.labels?.use_case].filter(Boolean).join(', ') || (v.description ?? '').slice(0, 80),
    preview: v.preview_url || undefined,
  }))
}

async function speakEleven(req: SpeakRequest, signal?: AbortSignal) {
  const key = elevenKey()
  const text = String(req.text ?? '').trim()
  if (!text) throw new Error('O texto da narração veio vazio.')
  const model = ELEVEN_MODELS.has(String(req.model)) ? String(req.model) : 'eleven_multilingual_v2'
  const limit = model === 'eleven_v3' ? 3000 : 9500
  if (text.length > limit) throw new Error(`A narração passa de ${limit} caracteres para esse modelo. Encurte o roteiro.`)
  const voice = String(req.voice ?? '').trim()
  if (!/^[A-Za-z0-9]{10,40}$/.test(voice)) throw new Error('Escolha uma voz da ElevenLabs.')
  const clamp = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : d)
  // O v3 só aceita estabilidade 0 (criativa), 0,5 (natural) ou 1 (robusta)
  const stability = model === 'eleven_v3' ? [0, 0.5, 1].reduce((a, b) => (Math.abs(b - clamp(req.stability, 0.5)) < Math.abs(a - clamp(req.stability, 0.5)) ? b : a)) : clamp(req.stability, 0.45)
  const res = await fetch(`${ELEVEN}/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    signal,
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability, similarity_boost: clamp(req.similarity, 0.8), style: clamp(req.style, 0.3), use_speaker_boost: true, ...(req.speed && req.speed !== 1 ? { speed: Math.min(1.2, Math.max(0.7, Number(req.speed))) } : {}) },
    }),
  })
  if (!res.ok) await elevenError(res, 'gerou a voz')
  const buf = Buffer.from(await res.arrayBuffer())
  return { data: `data:audio/mpeg;base64,${buf.toString('base64')}`, type: 'audio/mpeg', model, voice }
}

// ——— Transcrição com o tempo de cada palavra (OpenAI whisper-1) ———

/**
 * Para a narração gerada por IA: o Whisper pequeno do navegador às vezes pula frases inteiras (no
 * teste da Tiger, a primeira frase sumiu), o que quebra a legenda e a sincronia das cenas. Com a
 * chave da OpenAI, a narração (que já foi gerada lá) é transcrita pela API, com o tempo de cada
 * palavra. A fala gravada pela pessoa continua no Whisper do navegador.
 */
export async function transcribeWords(dataUrl: string, signal?: AbortSignal): Promise<{ text: string; words: { w: string; s: number; e: number }[] }> {
  const key = apiKey('openai')
  if (!key) throw new Error('Sem chave da OpenAI neste computador.')
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
  if (!m) throw new Error('Áudio inválido para transcrever.')
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 24 * 1024 * 1024) throw new Error('O áudio passa de 24 MB para transcrever.')
  const ext = m[1].includes('wav') ? 'wav' : m[1].includes('mpeg') ? 'mp3' : m[1].includes('mp4') || m[1].includes('m4a') ? 'm4a' : 'webm'
  const form = new FormData()
  form.append('file', new Blob([buf], { type: m[1] }), `narracao.${ext}`)
  form.append('model', 'whisper-1')
  form.append('language', 'pt')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'word')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', signal, headers: { authorization: `Bearer ${key}` }, body: form })
  if (!res.ok) throw new Error(`A OpenAI não transcreveu (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const j = (await res.json()) as { text?: string; words?: { word: string; start: number; end: number }[] }
  return { text: j.text ?? '', words: (j.words ?? []).map((x) => ({ w: x.word.trim(), s: Math.round(x.start * 100) / 100, e: Math.round(Math.max(x.end, x.start + 0.05) * 100) / 100 })).filter((x) => x.w) }
}

// ——— Vozes brasileiras da biblioteca da ElevenLabs ———

/**
 * As vozes da OpenAI falam português com sotaque americano (o usuário, 2026-11-08: "preciso usar uma
 * voz de brasileiro, tá ruim essas vozes em inglês"). A biblioteca da ElevenLabs tem vozes nativas
 * do Brasil: lista as de sotaque brasileiro e, ao escolher, adiciona à conta (só assim a API usa).
 */
export interface SharedVoice { ownerId: string; id: string; name: string; gender?: string; age?: string; description: string; useCase?: string; preview?: string; added: boolean }

export async function elevenBrazilVoices(signal?: AbortSignal): Promise<SharedVoice[]> {
  const key = elevenKey()
  const mine = new Set((await elevenVoices(signal).catch(() => [])).map((v) => v.id))
  const res = await fetch(`${ELEVEN}/shared-voices?page_size=40&language=pt&accent=brazilian&sort=trending`, { signal, headers: { 'xi-api-key': key } })
  if (!res.ok) await elevenError(res, 'listou as vozes brasileiras')
  const j = (await res.json()) as { voices?: { public_owner_id: string; voice_id: string; name: string; gender?: string; age?: string; descriptive?: string; description?: string; use_case?: string; preview_url?: string; accent?: string }[] }
  return (j.voices ?? []).map((v) => ({ ownerId: v.public_owner_id, id: v.voice_id, name: v.name, gender: v.gender, age: v.age, description: [v.descriptive, v.use_case].filter(Boolean).join(', ') || (v.description ?? '').slice(0, 80), useCase: v.use_case, preview: v.preview_url || undefined, added: mine.has(v.voice_id) }))
}

/** Adiciona uma voz da biblioteca à conta (necessário para narrar com ela pela API). */
export async function elevenAddShared(ownerId: string, voiceId: string, name: string, signal?: AbortSignal): Promise<{ id: string }> {
  if (!/^[A-Za-z0-9]{10,80}$/.test(ownerId) || !/^[A-Za-z0-9]{10,40}$/.test(voiceId)) throw new Error('Voz inválida.')
  const res = await fetch(`${ELEVEN}/voices/add/${ownerId}/${voiceId}`, { method: 'POST', signal, headers: { 'xi-api-key': elevenKey(), 'content-type': 'application/json' }, body: JSON.stringify({ new_name: `${name.slice(0, 40)} (BR)` }) })
  if (!res.ok) await elevenError(res, 'adicionou a voz')
  const j = (await res.json()) as { voice_id?: string }
  return { id: j.voice_id ?? voiceId }
}
