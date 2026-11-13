import { FPS } from '../motion'
import { SceneRunner } from '../scene'
import { audioOfSrc, encodeMp4 } from '../video'
import { assetUrl } from '../storage'
import type { ImageMap } from '../render'
import { sizeOf, type CodeScene, type CreativeSet } from '../types'
import { paletteOf } from '../brand'
import type { SetBrand } from '../types'
import { useEditor } from '../store'
import { EXPLAINER_SCENE } from './engine'
import { personMask } from './recorte'
import { COMMERCIAL_SCENE } from './comercial'
import { ICONS } from './icons'
import { outBeats, outWords, segments, toSrc } from './timeline'
import { mixExplainer } from './sfx'
import type { BrandTokens, ExplainerBeat, ExplainerData, ExplainerEnvData } from './types'

/**
 * A mídia do vídeo explicativo: a fala (áudio ou vídeo do conjunto) em memória, os quadros do
 * vídeo da pessoa para o motor e o MP4 final (quadros da cena + voz e efeitos mixados).
 */

export interface Voice {
  data: ArrayBuffer
  url: string
  kind: 'audio' | 'video'
}

/** A fala desta sessão: guardada para não baixar de novo a cada abertura (egress). */
const cache = new Map<string, Promise<Voice>>()

export function rememberVoice(src: string, blob: Blob, kind: 'audio' | 'video') {
  cache.set(src, blob.arrayBuffer().then((data) => ({ data, url: URL.createObjectURL(blob), kind })))
}

export function loadVoice(set: CreativeSet, data: ExplainerData): Promise<Voice> | undefined {
  const media = data.media
  if (!media) return undefined
  const hit = cache.get(media.src)
  if (hit) return hit
  const asset = set.assets.find((a) => `asset:${a.id}` === media.src)
  if (!asset) return undefined
  const p = (async () => {
    const res = await fetch(await assetUrl(asset))
    if (!res.ok) throw new Error('Não consegui baixar a fala do vídeo.')
    const blob = await res.blob()
    return { data: await blob.arrayBuffer(), url: URL.createObjectURL(blob), kind: media.kind }
  })()
  cache.set(media.src, p)
  p.catch(() => cache.delete(media.src))
  return p
}

export const usesVideo = (data: ExplainerData) => (data.mode ?? 'narracao') === 'narracao' && data.media?.kind === 'video' && (data.composition ? data.composition.video.visible : data.layout !== 'animacao' || (!!data.look && data.look !== 'editorial' && data.look !== 'comercial'))
/** No modo briefing a fala não vai para o vídeo. */
export const usesVoice = (data: ExplainerData) => (data.mode ?? 'narracao') === 'narracao' && !!data.media

const SERIF = /serif|garamond|playfair|instrument|fraunces|lora|cormorant|libre baskerville|dm serif|crimson|merriweather|bodoni|newsreader/i

/** O design system da marca em tokens para o motor: cores pelos papéis do DESIGN.md (`paletteOf`) e as fontes. */
export function brandTokens(brand: SetBrand): BrandTokens {
  const p = paletteOf(brand)
  const heading = brand.headingFont?.trim() || 'Inter'
  const emphasis = brand.emphasisFont?.trim() || heading
  return { ...p, name: brand.name, heading, body: brand.bodyFont?.trim() || heading, emphasis, emphasisItalic: emphasis !== heading && SERIF.test(emphasis), radius: brand.buttonRadius ?? 0 }
}

export const brandOfExplainer = (set: CreativeSet, data: ExplainerData): SetBrand => data.brand ?? set.brand

/** Emoji do roteiro antigo → ícone de traço do mesmo assunto. */
const EMOJI_ICON: Record<string, string> = { '💰': 'dinheiro', '⏱️': 'relogio', '⏰': 'relogio', '👥': 'pessoas', '💡': 'ideia', '⚠️': 'alerta', '📈': 'grafico', '📱': 'celular', '❤️': 'coracao', '🍔': 'comida', '🏪': 'loja', '🚀': 'foguete', '🎯': 'alvo', '🔥': 'fogo', '✨': 'brilho', '✅': 'check', '❌': 'erro', '💬': 'conversa', '⭐': 'estrela' }
export const iconOfBeat = (b: ExplainerBeat) => (b.icon && ICONS[b.icon] ? b.icon : b.emoji ? EMOJI_ICON[b.emoji] : undefined)

export function envData(data: ExplainerData, brand: SetBrand, total: number, video?: { width: number; height: number }): ExplainerEnvData {
  const hasVideo = usesVideo(data)
  const clips = new Set(data.photos.filter((p) => p.kind === 'video').map((p) => p.name))
  const beats = outBeats(data, total).map((b) => ({ ...b, icon: iconOfBeat(b), ...(b.photo && clips.has(b.photo) ? { clip: true } : {}) }))
  const icons: ExplainerEnvData['icons'] = {}
  for (const name of new Set([...beats.map((b) => b.icon).filter(Boolean) as string[], 'brilho', 'seta', 'check', 'erro'])) if (ICONS[name]) icons[name] = ICONS[name] as ExplainerEnvData['icons'][string]
  const theme = data.theme === 'marca' ? 'alternado' : data.theme
  return { composition: data.composition, look: data.look ?? 'editorial', words: outWords(data), beats, layout: hasVideo ? (data.layout === 'animacao' ? 'dividido' : data.layout) : 'animacao', captions: data.captions, theme, brand: brandTokens(brand), icons, treatment: data.treatment, mirror: !!data.mirror, videoPositionY: data.videoPositionY, hasVideo, videoSize: video, photos: data.photos.filter((p) => p.kind !== 'video').map((p) => p.name) }
}

/** Uma imagem pelo endereço do conjunto (`asset:`) ou pública (`/brands/...`), para o worker. */
async function bitmapOf(src: string | undefined, images: ImageMap): Promise<ImageBitmap | undefined> {
  if (!src) return undefined
  try {
    let img = images.get(src)
    if (!img && src.startsWith('asset:')) {
      await useEditor.getState().ensureImage(src)
      img = useEditor.getState().images.get(src)
    }
    if (img && !(img instanceof HTMLVideoElement)) return await createImageBitmap(img as ImageBitmapSource)
    if (!src.startsWith('asset:')) {
      // Pela imagem do navegador: aceita SVG (createImageBitmap de um blob SVG falha) e rasteriza nítido
      const el = new Image()
      el.crossOrigin = 'anonymous'
      el.src = src
      await el.decode()
      const k = Math.max(1, 1200 / Math.max(1, el.naturalWidth || 1200))
      return await createImageBitmap(el, { resizeWidth: Math.round((el.naturalWidth || 1200) * k), resizeHeight: Math.round((el.naturalHeight || 400) * k), resizeQuality: 'high' })
    }
  } catch {
    // Sem logo: o motor escreve o nome da marca
  }
  return undefined
}

/** As fotos do roteiro e o logo da marca (para fundo claro e escuro), prontos para o worker. */
export async function photoBitmaps(data: ExplainerData, images: ImageMap, brand?: SetBrand): Promise<Record<string, ImageBitmap>> {
  const out: Record<string, ImageBitmap> = {}
  if (brand) {
    const light = await bitmapOf(brand.logoOnLight, images)
    const dark = await bitmapOf(brand.logoOnDark, images)
    if (light) out.__logo_light = light
    if (dark) out.__logo_dark = dark
  }
  for (const p of data.photos) {
    const img = images.get(p.src)
    if (img && !(img instanceof HTMLVideoElement)) out[p.name] = await createImageBitmap(img as ImageBitmapSource)
    // Imagem pública do app (as telas dos cases da marca, `/brands/...`)
    else if (p.src.startsWith('/') && p.kind !== 'video') {
      const bmp = await bitmapOf(p.src, images)
      if (bmp) out[p.name] = bmp
    }
  }
  return out
}

/** O motor do vídeo: o comercial animado tem o seu; os outros estilos, o motor do explicativo. */
export const sceneCodeOf = (data: ExplainerData) => (data.look === 'comercial' ? COMMERCIAL_SCENE : EXPLAINER_SCENE)

export function runnerFor(scene: CodeScene, set: CreativeSet, images: Record<string, ImageBitmap>) {
  const { width, height } = sizeOf(scene.format)
  const brand = brandOfExplainer(set, scene.explainer!)
  return new SceneRunner({ code: sceneCodeOf(scene.explainer!), width, height, duration: scene.duration, images, brand: { name: brand.name, colors: brand.colors.map((c) => c.hex), font: brand.headingFont }, data: envData(scene.explainer!, brand, scene.duration) })
}

/** As imagens do motor (fotos e logo) para este vídeo. */
export const sceneImages = (scene: CodeScene, set: CreativeSet, images: ImageMap) => photoBitmaps(scene.explainer!, images, brandOfExplainer(set, scene.explainer!))

export function openVideo(url: string): Promise<HTMLVideoElement> {
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  v.src = url
  return new Promise((resolve, reject) => {
    v.onloadeddata = () => resolve(v)
    v.onerror = () => reject(new Error('Não consegui abrir o vídeo gravado.'))
  })
}

export function seek(v: HTMLVideoElement, t: number): Promise<void> {
  const target = Math.max(0, Math.min(t, (Number.isFinite(v.duration) ? v.duration : t) - 0.001))
  if (Math.abs(v.currentTime - target) < 0.001 && v.readyState >= 2) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener('seeked', done)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, 3000)
    v.addEventListener('seeked', done)
    v.currentTime = target
  })
}

/** O estilo "Efeitos com recorte" precisa da máscara da pessoa em cada quadro (`recorte.ts`). */
export const usesMask = (data: ExplainerData) => data.look === 'recorte' && usesVideo(data)
/** A máscara do quadro, quando o estilo pede (antes de o quadro ir ao worker, que o fecha). */
export const maskFor = (data: ExplainerData, frame: ImageBitmap | undefined) => (frame && usesMask(data) ? personMask(frame) : Promise.resolve(undefined))

/** Um quadro do vídeo da pessoa, no máximo 1080 de largura (o que o motor desenha). */
export const grab = (v: HTMLVideoElement) => (v.videoWidth > 1080 ? createImageBitmap(v, { resizeWidth: 1080, resizeHeight: Math.round((v.videoHeight * 1080) / v.videoWidth), resizeQuality: 'medium' }) : createImageBitmap(v))

/** `mixed`: outro áudio no lugar da mixagem completa (o pacote do Edits sai sem a trilha de fundo, `edits.ts`). */
export async function explainerToMp4(scene: CodeScene, set: CreativeSet, images: ImageMap, opts: { onProgress?: (p: number) => void; signal?: AbortSignal; mixed?: AudioBuffer } = {}): Promise<Blob> {
  const data = scene.explainer!
  const voice = await loadVoice(set, data)
  const { width, height } = sizeOf(scene.format)
  const mixed = opts.mixed ?? (await mixExplainer(usesVoice(data) ? voice?.data : undefined, data, scene.duration, await mixOptions(set, data)))
  const segs = segments(data)
  const runner = runnerFor(scene, set, await sceneImages(scene, set, images))
  const video = voice && usesVideo(data) ? await openVideo(voice.url) : undefined
  const clips = await clipVideos(data, set)
  try {
    await runner.load()
    let last: ImageBitmap | undefined
    return await encodeMp4({
      width,
      height,
      frames: Math.max(1, Math.round(scene.duration * FPS)),
      mixed,
      onProgress: opts.onProgress,
      signal: opts.signal,
      frame: async (i) => {
        last?.close()
        let frame: ImageBitmap | undefined
        if (video) {
          await seek(video, toSrc(segs, i / FPS))
          frame = await grab(video)
        }
        const mask = await maskFor(data, frame)
        last = await runner.frame(i / FPS, frame, await clipFrame(clips, data, scene.duration, i / FPS), mask)
        return last
      },
    })
  } finally {
    runner.dispose()
    video?.removeAttribute('src')
  }
}

/** Os clipes do vídeo (vídeos curtos nas cenas), prontos para tirar quadros: nome → elemento de vídeo. */
export async function clipVideos(data: ExplainerData, set: CreativeSet): Promise<Map<string, HTMLVideoElement>> {
  const out = new Map<string, HTMLVideoElement>()
  for (const p of data.photos.filter((x) => x.kind === 'video')) {
    const asset = set.assets.find((a) => `asset:${a.id}` === p.src)
    if (!asset) continue
    try {
      out.set(p.name, await openVideo(await assetUrl(asset)))
    } catch {
      // clipe que não abriu: a cena mostra a animação
    }
  }
  return out
}

/** O quadro do clipe da cena no tempo `t` do vídeo (em loop desde o começo da cena). */
export async function clipFrame(clips: Map<string, HTMLVideoElement>, data: ExplainerData, total: number, t: number): Promise<ImageBitmap | undefined> {
  if (!clips.size) return undefined
  const beats = outBeats(data, total)
  const b = beats.find((x, i) => t >= x.start && (i === beats.length - 1 || t < beats[i + 1].start))
  const v = b?.photo ? clips.get(b.photo) : undefined
  if (!v || !b) return undefined
  const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 4
  await seek(v, (t - b.start) % d)
  return v.readyState >= 2 ? createImageBitmap(v, v.videoWidth > 720 ? { resizeWidth: 720, resizeHeight: Math.round((v.videoHeight * 720) / v.videoWidth) } : undefined) : undefined
}

/** A trilha de fundo (baixada uma vez por sessão) e as opções de voz para a mixagem. */
const musicCache = new Map<string, Promise<ArrayBuffer | undefined>>()
export async function mixOptions(set: CreativeSet, data: ExplainerData) {
  let music: ArrayBuffer | undefined
  if (data.music) {
    const src = data.music.src
    if (!musicCache.has(src)) musicCache.set(src, audioOfSrc(src, set.assets).catch(() => undefined))
    music = await musicCache.get(src)
  }
  return { voiceVolume: data.voiceVolume, sfxVolume: data.sfxVolume, enhance: data.enhanceVoice !== false, gate: data.gateVoice !== false, music: music && data.music ? { data: music, volume: data.music.volume } : undefined }
}

/** A capa do reels: o quadro em que o gancho já está inteiro na tela. */
export async function coverJpeg(scene: CodeScene, set: CreativeSet, images: ImageMap): Promise<Blob> {
  const data = scene.explainer!
  const beats = outBeats(data, scene.duration)
  const t = beats[0] ? Math.min(beats[0].end - 0.1, beats[0].start + 1.6) : 1
  const voice = await loadVoice(set, data)
  const runner = runnerFor(scene, set, await sceneImages(scene, set, images))
  const video = voice && usesVideo(data) ? await openVideo(voice.url) : undefined
  try {
    await runner.load()
    let frame: ImageBitmap | undefined
    if (video) {
      await seek(video, toSrc(segments(data), t))
      frame = await grab(video)
    }
    const bmp = await runner.frame(t, frame, undefined, await maskFor(data, frame))
    const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height })
    c.getContext('2d')!.drawImage(bmp, 0, 0)
    bmp.close()
    return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Sem capa.'))), 'image/jpeg', 0.9))
  } finally {
    runner.dispose()
  }
}
