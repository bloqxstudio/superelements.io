/**
 * Vídeo MP4 do motion, gerado no próprio navegador: cada quadro é desenhado
 * pelo `MotionRenderer` num canvas do tamanho do formato, codificado em H.264
 * pelo WebCodecs e empacotado com o `mp4-muxer`. Vai junto uma faixa de áudio
 * AAC em silêncio quando o navegador sabe gerar, porque algumas telas da Meta
 * recusam vídeo sem áudio. Nada sai deste computador.
 */

import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { FPS, MotionRenderer } from './motion'
import type { ImageMap } from './render'
import { sizeOf, type Post } from './types'

export const videoSupported = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window

/** Perfil H.264 que o navegador aceita para esse tamanho (nível 4.0 até 1080×1920, 5.1 acima). */
async function pickCodec(width: number, height: number, bitrate: number): Promise<string | undefined> {
  const blocks = Math.ceil(width / 16) * Math.ceil(height / 16)
  const levels = blocks <= 8192 ? ['28', '2a', '32', '33'] : ['32', '33', '34']
  const profiles = ['64', '4d', '42']
  for (const level of levels)
    for (const profile of profiles) {
      const codec = `avc1.${profile}00${level}`
      try {
        const { supported } = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: FPS })
        if (supported) return codec
      } catch {
        // perfil desconhecido: tenta o próximo
      }
    }
  return undefined
}

async function silentAudio(): Promise<boolean> {
  if (!('AudioEncoder' in window) || !('AudioData' in window)) return false
  try {
    const { supported } = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 96000 })
    return !!supported
  } catch {
    return false
  }
}

export interface VideoOptions {
  onProgress?: (done: number) => void
  signal?: AbortSignal
}

export async function postToMp4(post: Post, images: ImageMap, opts: VideoOptions = {}): Promise<Blob> {
  if (!videoSupported()) throw new Error('Este navegador não gera vídeo. Use o Chrome ou o Edge atualizados.')
  const size = sizeOf(post.format)
  // H.264 pede lados pares
  const width = size.width - (size.width % 2)
  const height = size.height - (size.height % 2)
  const bitrate = Math.round(Math.min(16_000_000, Math.max(4_000_000, width * height * FPS * 0.15)))
  const codec = await pickCodec(width, height, bitrate)
  if (!codec) throw new Error('O navegador não codifica H.264 nesse tamanho.')
  const audio = await silentAudio()

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: FPS },
    ...(audio ? { audio: { codec: 'aac' as const, numberOfChannels: 2, sampleRate: 48000 } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  })

  let failure: unknown
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) })
  encoder.configure({ codec, width, height, bitrate, framerate: FPS, avc: { format: 'avc' } })

  const renderer = new MotionRenderer(post, images)
  const total = renderer.total
  const frames = Math.max(1, Math.round(total * FPS))
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d', { alpha: false })!

  try {
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
      if (failure) throw failure
      renderer.draw(ctx, i / FPS)
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
      encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 })
      frame.close()
      // Não deixa a fila crescer: o codificador vai no ritmo dele
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4))
      if (i % 10 === 0) {
        opts.onProgress?.(i / frames)
        await new Promise((r) => setTimeout(r, 0))
      }
    }
    await encoder.flush()
  } finally {
    if (encoder.state !== 'closed') encoder.close()
  }
  if (failure) throw failure

  if (audio) {
    let audioFailure: unknown
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => (audioFailure = e) })
    aenc.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 96000 })
    const chunk = 4800
    const samples = Math.ceil(total * 48000)
    const silence = new Float32Array(chunk * 2)
    for (let at = 0; at < samples; at += chunk) {
      const n = Math.min(chunk, samples - at)
      const data = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((at * 1e6) / 48000), data: silence.subarray(0, n * 2) })
      aenc.encode(data)
      data.close()
    }
    await aenc.flush()
    aenc.close()
    if (audioFailure) throw audioFailure
  }

  muxer.finalize()
  opts.onProgress?.(1)
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}
