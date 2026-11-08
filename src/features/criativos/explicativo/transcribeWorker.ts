/// <reference lib="webworker" />
/**
 * Whisper no navegador (transformers.js), num worker para não travar a tela. O modelo vem do
 * Hugging Face na primeira vez e fica no cache do navegador; o áudio não sai do computador.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

env.allowLocalModels = false
// O runtime (WASM, ~21 MB) vem do CDN na versão exata do pacote: não depende do tipo MIME da hospedagem do app
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/'

let asr: AutomaticSpeechRecognitionPipeline | null = null
let loaded = ''

self.onmessage = async (ev: MessageEvent<{ audio: Float32Array; model: string; language: string }>) => {
  const { audio, model, language } = ev.data
  try {
    if (!asr || loaded !== model) {
      const files = new Map<string, { loaded: number; total: number }>()
      // A assinatura genérica do pipeline é complexa demais para o TypeScript: chama sem os tipos
      const make = pipeline as unknown as (task: string, model: string, opts: object) => Promise<AutomaticSpeechRecognitionPipeline>
      asr = await make('automatic-speech-recognition', model, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status !== 'progress' || !p.file) return
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 })
          let a = 0
          let b = 0
          for (const f of files.values()) {
            a += f.loaded
            b += f.total
          }
          self.postMessage({ type: 'download', loaded: a, total: b })
        },
      })
      loaded = model
    }
    self.postMessage({ type: 'running' })
    const out = (await asr(audio, { language, task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 })) as { text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }
    self.postMessage({ type: 'done', text: out.text, chunks: out.chunks ?? [] })
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err as Error)?.message ?? err) })
  }
}
