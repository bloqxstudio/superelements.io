/**
 * Vídeo MP4 do motion, gerado no próprio navegador: cada quadro é desenhado
 * pelo `MotionRenderer` num canvas do tamanho do formato, codificado em H.264
 * pelo WebCodecs e empacotado com o `mp4-muxer`. Vai junto uma faixa de áudio
 * AAC em silêncio quando o navegador sabe gerar, porque algumas telas da Meta
 * recusam vídeo sem áudio. Nada sai deste computador.
 */

import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { FPS, MotionRenderer, slideAsPost, slideHasMotion } from './motion'
import { slideToBlob, type ImageMap } from './render'
import { assetUrl } from './storage'
import { sizeOf, type MotionAudio, type Post, type SetAsset } from './types'

const RATE = 48000

/** O arquivo da trilha do post (para o MP4), ou nada quando o post não tem áudio. */
export async function audioFor(post: Post, assets: SetAsset[]): Promise<ArrayBuffer | undefined> {
  const src = post.motion?.audio?.src
  if (!src?.startsWith('asset:')) return undefined
  const asset = assets.find((a) => a.id === src.slice(6))
  if (!asset) return undefined
  const res = await fetch(await assetUrl(asset))
  if (!res.ok) throw new Error('Não consegui baixar o áudio do post.')
  return res.arrayBuffer()
}

/** A trilha já cortada, no volume e com as entradas e saídas suaves, do tamanho exato do vídeo. */
async function mixAudio(data: ArrayBuffer, audio: MotionAudio, total: number): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(total * RATE))
  const ctx = new OfflineAudioContext(2, length, RATE)
  const buffer = await ctx.decodeAudioData(data.slice(0))
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  const volume = Math.min(1, Math.max(0, audio.volume))
  const fadeIn = Math.min(total / 2, Math.max(0, audio.fadeIn))
  const fadeOut = Math.min(total / 2, Math.max(0, audio.fadeOut))
  gain.gain.setValueAtTime(fadeIn > 0 ? 0 : volume, 0)
  if (fadeIn > 0) gain.gain.linearRampToValueAtTime(volume, fadeIn)
  gain.gain.setValueAtTime(volume, Math.max(fadeIn, total - fadeOut))
  if (fadeOut > 0) gain.gain.linearRampToValueAtTime(0, total)
  source.connect(gain).connect(ctx.destination)
  source.start(0, Math.max(0, Math.min(buffer.duration - 0.01, audio.offset)))
  return ctx.startRendering()
}

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
  /** O arquivo da trilha (`audioFor`); sem ele, áudio em silêncio. */
  audio?: ArrayBuffer
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
  if (opts.audio && post.motion?.audio && !audio) throw new Error('Este navegador não codifica o áudio do vídeo. Use o Chrome ou o Edge atualizados, ou tire a trilha.')

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
      if (renderer.hasVideo) await renderer.seek(i / FPS)
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
    const samples = Math.ceil(total * RATE)
    const mixed = opts.audio && post.motion?.audio ? await mixAudio(opts.audio, post.motion.audio, total) : undefined
    const left = mixed?.getChannelData(0)
    const right = mixed ? mixed.getChannelData(Math.min(1, mixed.numberOfChannels - 1)) : undefined
    const planar = new Float32Array(chunk * 2)
    for (let at = 0; at < samples; at += chunk) {
      const n = Math.min(chunk, samples - at)
      const frame = planar.subarray(0, n * 2)
      if (left && right) {
        frame.set(left.subarray(at, at + n), 0)
        frame.set(right.subarray(at, at + n), n)
      } else frame.fill(0)
      const data = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((at * 1e6) / RATE), data: frame })
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

export interface CarouselItem {
  name: string
  blob: Blob
  type: 'image' | 'video'
}

/**
 * O post como carrossel: cada slide é um item, os animados em MP4 (cada um com a
 * trilha do post, se houver) e os parados em JPEG. A capa animada com os internos
 * em foto, por exemplo.
 */
export async function postToCarousel(post: Post, images: ImageMap, opts: { audio?: ArrayBuffer; onProgress?: (done: number) => void; base?: string } = {}): Promise<CarouselItem[]> {
  const animated = post.slides.filter(slideHasMotion).length
  let done = 0
  const items: CarouselItem[] = []
  const base = opts.base ?? 'slide'
  for (const [i, slide] of post.slides.entries()) {
    const n = String(i + 1).padStart(2, '0')
    if (slideHasMotion(slide)) {
      const at = done
      const blob = await postToMp4(slideAsPost(post, slide), images, { audio: opts.audio, onProgress: (p) => opts.onProgress?.((at + p) / Math.max(1, animated)) })
      done++
      items.push({ name: `${base}-${n}.mp4`, blob, type: 'video' })
    } else items.push({ name: `${base}-${n}.jpg`, blob: await slideToBlob(slide, post.format, images, 'jpg'), type: 'image' })
  }
  opts.onProgress?.(1)
  return items
}
