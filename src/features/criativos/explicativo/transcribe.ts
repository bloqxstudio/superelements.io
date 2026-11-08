import type { ExplainerWord } from './types'

/**
 * Fala → palavras com o tempo de cada uma. Whisper rodando no navegador (`transcribeWorker.ts`):
 * sem chave, sem serviço novo e sem mandar a voz para fora. Os agentes desta máquina não ouvem
 * áudio (ver `useDictation.ts`), por isso a transcrição fica aqui.
 */

export const MODELS = {
  rapida: { id: 'onnx-community/whisper-base_timestamped', label: 'Rápida', size: '77 MB' },
  precisa: { id: 'onnx-community/whisper-small_timestamped', label: 'Mais precisa', size: '250 MB' },
} as const
export type ModelId = keyof typeof MODELS

export type TranscribeStep = { kind: 'decoding' } | { kind: 'download'; loaded: number; total: number } | { kind: 'running' }

/** O áudio de um arquivo (áudio ou vídeo) em 16 kHz mono, como o Whisper quer. */
export async function decode16k(data: ArrayBuffer): Promise<Float32Array> {
  const probe = new AudioContext()
  let buffer: AudioBuffer
  try {
    buffer = await probe.decodeAudioData(data.slice(0))
  } catch {
    throw new Error('Não consegui ler o áudio desse arquivo. Use MP3, M4A, WAV, MP4, MOV ou WEBM.')
  } finally {
    void probe.close()
  }
  const rate = 16000
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buffer.duration * rate)), rate)
  const src = off.createBufferSource()
  src.buffer = buffer
  src.connect(off.destination)
  src.start()
  const out = await off.startRendering()
  return out.getChannelData(0).slice()
}

export async function transcribe(data: ArrayBuffer, opts: { model?: ModelId; onStep?: (s: TranscribeStep) => void; signal?: AbortSignal } = {}): Promise<{ text: string; words: ExplainerWord[] }> {
  opts.onStep?.({ kind: 'decoding' })
  const audio = await decode16k(data)
  if (audio.length < 16000 * 0.5) throw new Error('O áudio é curto demais.')
  const worker = new Worker(new URL('./transcribeWorker.ts', import.meta.url), { type: 'module' })
  try {
    return await new Promise((resolve, reject) => {
      opts.signal?.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')))
      worker.onerror = (e) => reject(new Error(e.message || 'A transcrição falhou.'))
      worker.onmessage = (ev) => {
        const m = ev.data
        if (m.type === 'download') opts.onStep?.({ kind: 'download', loaded: m.loaded, total: m.total })
        else if (m.type === 'running') opts.onStep?.({ kind: 'running' })
        else if (m.type === 'error') reject(new Error(`A transcrição falhou: ${m.message}`))
        else if (m.type === 'done') resolve({ text: String(m.text ?? '').trim(), words: toWords(m.chunks) })
      }
      worker.postMessage({ audio, model: MODELS[opts.model ?? 'rapida'].id, language: 'portuguese' }, [audio.buffer])
    })
  } finally {
    worker.terminate()
  }
}

function toWords(chunks: { text: string; timestamp: [number, number | null] }[]): ExplainerWord[] {
  const out: ExplainerWord[] = []
  for (const c of chunks) {
    const w = c.text.trim()
    if (!w) continue
    const s = Math.max(0, c.timestamp[0] ?? 0)
    const e = Math.max(s + 0.05, c.timestamp[1] ?? s + 0.3)
    out.push({ w, s: round(s), e: round(e) })
  }
  // Whisper às vezes devolve tempos fora de ordem nas emendas dos trechos de 30 s
  for (let i = 1; i < out.length; i++) if (out[i].s < out[i - 1].s) out[i].s = out[i - 1].s
  return out
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * O texto corrigido pela pessoa de volta nos tempos: com o mesmo número de palavras, só troca o
 * texto; senão redistribui o novo texto no mesmo intervalo, pelo tamanho de cada palavra.
 */
export function retime(words: ExplainerWord[], text: string): ExplainerWord[] {
  const next = text.split(/\s+/).filter(Boolean)
  if (!next.length || !words.length) return words
  if (next.length === words.length) return words.map((w, i) => ({ ...w, w: next[i] }))
  // Mantém as pausas: distribui dentro de cada frase original (separadas por pausas > 0,6 s)
  const start = words[0].s
  const end = words[words.length - 1].e
  const total = next.reduce((a, w) => a + w.length + 1, 0)
  let at = start
  return next.map((w) => {
    const d = ((w.length + 1) / total) * (end - start)
    const item = { w, s: round(at), e: round(at + d * 0.92) }
    at += d
    return item
  })
}
