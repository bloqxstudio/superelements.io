/**
 * Vídeo MP4 do motion, gerado no próprio navegador: cada quadro é desenhado
 * pelo `MotionRenderer` num canvas do tamanho do formato, codificado em H.264
 * pelo WebCodecs e empacotado com o `mp4-muxer`. Vai junto uma faixa de áudio
 * AAC em silêncio quando o navegador sabe gerar, porque algumas telas da Meta
 * recusam vídeo sem áudio. Nada sai deste computador.
 */

import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { FPS, MotionRenderer, entrancesEnd, slideAsPost, slideMoves, timeline } from './motion'
import { slideToBlob, type ImageMap } from './render'
import { assetUrl } from './storage'
import { sizeOf, type MotionAudio, type Post, type SetAsset } from './types'

const RATE = 48000

/** O arquivo da trilha do post (para o MP4), ou nada quando o post não tem áudio. */
export const audioFor = (post: Post, assets: SetAsset[]) => audioOfSrc(post.motion?.audio?.src, assets)

/** O arquivo de um áudio do conjunto (`asset:<id>`). */
export async function audioOfSrc(src: string | undefined, assets: SetAsset[]): Promise<ArrayBuffer | undefined> {
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
  /**
   * Um quadro de capa antes do vídeo (1/30 s com o post neste instante): no carrossel a
   * Meta usa o primeiro quadro como miniatura e ignora o `thumb_offset`.
   */
  coverAt?: number
}

export async function postToMp4(post: Post, images: ImageMap, opts: VideoOptions = {}): Promise<Blob> {
  const size = sizeOf(post.format)
  const renderer = new MotionRenderer(post, images)
  const lead = opts.coverAt !== undefined ? 1 : 0
  const width = size.width - (size.width % 2)
  const height = size.height - (size.height % 2)
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d', { alpha: false })!
  return encodeMp4({
    width: size.width,
    height: size.height,
    frames: Math.max(1, Math.round(renderer.total * FPS)) + lead,
    audio: opts.audio && post.motion?.audio ? { data: opts.audio, cfg: post.motion.audio } : undefined,
    onProgress: opts.onProgress,
    signal: opts.signal,
    frame: async (i) => {
      const t = lead && i === 0 ? opts.coverAt! : (i - lead) / FPS
      if (renderer.hasVideo) await renderer.seek(t)
      renderer.draw(ctx, t)
      return canvas
    },
  })
}

export interface EncodeOptions {
  width: number
  height: number
  frames: number
  /** O quadro `i` (o tempo é i / FPS), do tamanho do vídeo. */
  frame: (i: number) => Promise<CanvasImageSource & { width: number; height: number }>
  audio?: { data: ArrayBuffer; cfg: MotionAudio }
  /** Áudio já mixado (narração + efeitos do vídeo explicativo), no lugar de `audio`. */
  mixed?: AudioBuffer
  onProgress?: (done: number) => void
  signal?: AbortSignal
}

/** Codifica quadros em MP4 (H.264 30 fps + AAC, em silêncio sem trilha). Usado pelos posts e pelas cenas em código. */
export async function encodeMp4(opts: EncodeOptions): Promise<Blob> {
  if (!videoSupported()) throw new Error('Este navegador não gera vídeo. Use o Chrome ou o Edge atualizados.')
  // H.264 pede lados pares
  const width = opts.width - (opts.width % 2)
  const height = opts.height - (opts.height % 2)
  const bitrate = Math.round(Math.min(16_000_000, Math.max(4_000_000, width * height * FPS * 0.15)))
  const codec = await pickCodec(width, height, bitrate)
  if (!codec) throw new Error('O navegador não codifica H.264 nesse tamanho.')
  const audio = await silentAudio()
  if ((opts.audio || opts.mixed) && !audio) throw new Error('Este navegador não codifica o áudio do vídeo. Use o Chrome ou o Edge atualizados, ou tire a trilha.')

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

  const frames = Math.max(1, opts.frames)
  const total = frames / FPS
  // Um canvas do tamanho exato do vídeo: a fonte pode ter um pixel a mais (lado ímpar)
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d', { alpha: false })!

  try {
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
      if (failure) throw failure
      const source = await opts.frame(i)
      let input: CanvasImageSource = source
      if (source.width !== width || source.height !== height) {
        ctx.drawImage(source, 0, 0)
        input = canvas
      }
      const frame = new VideoFrame(input, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
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
    const mixed = opts.mixed ?? (opts.audio ? await mixAudio(opts.audio.data, opts.audio.cfg, total) : undefined)
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
  /** Vídeo: o quadro da capa em milissegundos (o slide já montado, ou a capa escolhida no primeiro). */
  thumbOffset?: number
}

/** O quadro da capa de cada vídeo do carrossel: a capa escolhida no primeiro slide, ou o slide já montado. */
export function carouselThumbAt(post: Post, slideIndex: number): number {
  const slide = post.slides[slideIndex]
  const single = slideAsPost(post, slide)
  const dur = timeline(single).total
  const chosen = slideIndex === 0 && post.cover && 'at' in post.cover && post.cover.at < dur ? post.cover.at : undefined
  return Math.min(Math.max(0, dur - 0.05), chosen ?? defaultCoverAt(single))
}

/**
 * O post como carrossel: cada slide é um item, os animados em MP4 (cada um com a
 * trilha do post, se houver) e os parados em JPEG. A capa animada com os internos
 * em foto, por exemplo.
 */
export async function postToCarousel(post: Post, images: ImageMap, opts: { audio?: ArrayBuffer; onProgress?: (done: number) => void; base?: string } = {}): Promise<CarouselItem[]> {
  // Post marcado como estático sai todo em foto, mesmo com a animação guardada (2026-11-10)
  const animated = post.slides.filter((s) => slideMoves(post, s)).length
  let done = 0
  const items: CarouselItem[] = []
  const base = opts.base ?? 'slide'
  for (const [i, slide] of post.slides.entries()) {
    const n = String(i + 1).padStart(2, '0')
    if (slideMoves(post, slide)) {
      const at = done
      // O primeiro quadro do arquivo é a capa (o Instagram ignora o thumb_offset no carrossel); o offset 0 aponta para ele
      const blob = await postToMp4(slideAsPost(post, slide), images, { audio: opts.audio, coverAt: carouselThumbAt(post, i), onProgress: (p) => opts.onProgress?.((at + p) / Math.max(1, animated)) })
      done++
      items.push({ name: `${base}-${n}.mp4`, blob, type: 'video', thumbOffset: 0 })
    } else items.push({ name: `${base}-${n}.jpg`, blob: await slideToBlob(slide, post.format, images, 'jpg'), type: 'image' })
  }
  opts.onProgress?.(1)
  return items
}

/** O momento padrão da capa: o primeiro slide já montado (no segundo zero quase nada entrou ainda). */
export function defaultCoverAt(post: Post): number {
  const first = timeline(post).segments[0]
  if (!first) return 0
  return Math.min(first.dur - 0.05, entrancesEnd(first.slide) + 0.3)
}

/** O momento da capa escolhida (ou o padrão), dentro do vídeo. */
export function coverAtOf(post: Post): number {
  const total = timeline(post).total
  const at = post.cover && 'at' in post.cover ? post.cover.at : defaultCoverAt(post)
  return Math.min(Math.max(0, total - 0.05), Math.max(0, at))
}

/** Um quadro do vídeo do post em JPEG, no tamanho do formato (a capa do reels). */
export async function frameAt(post: Post, images: ImageMap, time: number): Promise<Blob> {
  const { width, height } = sizeOf(post.format)
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d', { alpha: false })!
  const renderer = new MotionRenderer(post, images)
  if (renderer.hasVideo) await renderer.seek(time)
  renderer.draw(ctx, time)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não consegui gerar a capa.'))), 'image/jpeg', 0.92))
}

/** Uma imagem enviada como capa, cortada ao centro no tamanho do formato. */
export async function imageCover(post: Post, image: CanvasImageSource & { width: number; height: number }): Promise<Blob> {
  const { width, height } = sizeOf(post.format)
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d', { alpha: false })!
  const k = Math.max(width / image.width, height / image.height)
  const w = image.width * k
  const h = image.height * k
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não consegui gerar a capa.'))), 'image/jpeg', 0.92))
}
