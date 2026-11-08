/**
 * Cena de motion escrita em código: o caminho "avançado" do Motion, em que a IA
 * (ou alguém) escreve uma função que desenha cada quadro num canvas. O teto é o
 * de um After Effects feito em código: máscaras, câmera contínua, rastro de
 * velocidade do quadro inteiro, texto escrito à mão, rotas que se desenham. O
 * código roda num worker isolado (`sceneWorker.ts`), sem DOM, sem sessão e sem
 * rede; o MP4 sai pelo mesmo codificador dos posts (`encodeMp4`).
 */

import { FPS } from './motion'
import { SCENE_WORKER_SOURCE } from './sceneWorker'
import type { ScenePost } from './scenePost'
import { encodeMp4 } from './video'
import { sizeOf, type CodeScene, type MotionAudio } from './types'

/** O contrato que a IA recebe para escrever a cena. */
export const SCENE_CONTRACT = `O código é JavaScript puro (sem import, sem DOM, sem rede) e termina chamando scene({...}):

scene({
  fonts: ['Montserrat', 'Permanent Marker'],   // famílias do Google Fonts que a cena usa (carregadas antes do primeiro quadro)
  setup(env) { return { /* estado pré-calculado, opcional */ } },
  draw(ctx, t, env) { /* desenha o quadro do segundo t (0 até env.duration) */ },
})

- ctx é um CanvasRenderingContext2D de env.width × env.height (1080×1920 no 9:16). O quadro começa transparente: pinte o fundo inteiro.
- draw precisa ser uma função pura de t: o mesmo t sempre gera o mesmo quadro (a prévia pula para qualquer ponto). Não guarde nada entre quadros. Math.random é semeado por quadro; para valores estáveis use lib.rand(n).
- env: width, height, duration, fps, bpm, beats (segundos das batidas da trilha, pode ser vazio), beat(t) → {index, at, phase, step}, images (objeto nome → imagem pronta para ctx.drawImage, com width e height), brand ({name, colors: [hex], font}), state (o que setup devolveu), lib.
- lib (use à vontade):
  clamp(v, a=0, b=1), lerp(a, b, t), ease.{linear,inQuad,outQuad,inOutQuad,inCubic,outCubic,inOutCubic,outQuart,inOutQuart,inExpo,outExpo,inOutExpo,inBack,outBack,outElastic,outBounce},
  prog(t, a, b, ease) → 0..1, tween(t, a, b, from, to, ease), keys(t, [[t, valor], [t, valor, 'outBack'], ...]) (valor número ou lista),
  pulse(t, at, dur) → 1 caindo a 0, shake(t, at, dur, amp, seed) → {x, y, r}, rand(n), noise(x), mix(hexA, hexB, t) → cor,
  roundRect(ctx, x, y, w, h, r), circle(ctx, x, y, r), star(ctx, x, y, pontas, rFora, rDentro) (só o caminho: depois ctx.fill()),
  at(ctx, x, y, {scale, sx, sy, rotate (rad), alpha}, (ctx) => {...}) desenha em volta do ponto (x, y),
  text(ctx, str, x, y, {font, size, weight, italic, color, align, baseline, spacing, stroke, strokeWidth}), measure(ctx, str, opts), fit(ctx, str, larguraMax, opts) → tamanho,
  letters(ctx, str, x, y, p, {...opts de text, mode: 'pop' | 'write', span}) texto entrando letra a letra conforme p (0..1),
  image(ctx, img, cx, cy, w, h, 'contain' | 'cover'), path(ctx, [[x, y], ...], p, {color, width, dash}) linha desenhada até a fração p,
  blurFrame(ctx, t, amostras, segundos, (ctx, t) => desenhaTudo(ctx, t)) motion blur do quadro inteiro (média de amostras; 4 amostras e 1/30 s bastam).
- env.post (quando a cena nasce de um criativo; senão null): { name, width, height, slides: [{ index, background (cor), start, dur (o tempo de cada slide no vídeo que o post já tinha), camera, layers: [peça] }] }.
  Cada peça é uma camada do criativo pronta para desenhar, idêntica ao editor (fonte, destaque, foto, moldura): { id, name, type ('text'|'image'|'rect'|'ring'|'dots'), x, y, w, h, cx, cy (centro), background (cobre o slide), order (ordem de leitura, -1 no fundo), text, font, weight, size, color, align, italic, upper, fill, motion (a animação que já tinha: fx, start, dur, exit, loop, keys) }.
  lib.layer(ctx, peça, { x, y (deslocamento a partir do lugar dela), scale, sx, sy, rotate (rad), alpha, blur (px), reveal (0..1), from ('left'|'right'|'up'|'down', de onde a revelação vem) }) desenha a peça no lugar dela com essas transformações em volta do centro. Para texto cinético (letra a letra, palavra a palavra) use lib.letters/lib.text com peça.text, peça.font, peça.size, peça.color e a caixa dela, em vez da peça.
  Quando há env.post, a cena é ESTE criativo elevado: use todas as peças (nenhum texto, foto ou logo some, nada inventado), mantenha a ordem dos slides e a hierarquia, e trabalhe o movimento: entradas coreografadas, transições contínuas entre slides, câmera, profundidade, impactos na batida.
Linguagem publicitária: cortes e impactos na batida, entradas com outExpo/outBack, saídas com inExpo, rastro de velocidade (blurFrame) nos movimentos rápidos, squash and stretch no pouso (sx/sy), tremida no impacto, transições que empurram a cena (a próxima entra enquanto a outra sai), máscaras circulares que abrem, títulos gigantes que atravessam a tela. Nada parado mais de 1 s.`

export interface SceneInput {
  code: string
  width: number
  height: number
  duration: number
  images: Record<string, ImageBitmap>
  beats?: number[]
  bpm?: number
  brand?: { name: string; colors: string[]; font?: string }
  /** As peças do criativo de origem (`scenePost`). */
  post?: ScenePost
  /** Fontes a carregar além das que a cena pede (as das camadas do criativo). */
  fonts?: string[]
  /** Dados livres da cena (`env.data`): o roteiro e as palavras do vídeo explicativo. */
  data?: unknown
}

export class SceneError extends Error {
  constructor(message: string, readonly stack2?: string) {
    super(message)
  }
}

/** Um worker com uma cena carregada. Um quadro por vez. */
export class SceneRunner {
  private worker: Worker
  private url: string
  private seq = 0
  private waiting = new Map<number, { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  private ready: Promise<void>
  dead = false

  constructor(input: SceneInput) {
    this.url = URL.createObjectURL(new Blob([SCENE_WORKER_SOURCE], { type: 'text/javascript' }))
    this.worker = new Worker(this.url)
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new SceneError('A cena demorou demais para carregar (fontes ou código em laço).')), 20000)
      this.worker.onmessage = (ev) => {
        const m = ev.data
        if (m.type === 'ready') {
          clearTimeout(timer)
          resolve()
        } else if (m.type === 'error') {
          clearTimeout(timer)
          reject(new SceneError(m.message, m.stack))
        }
        else if (m.type === 'frame' || m.type === 'frame-error') {
          const w = this.waiting.get(m.id)
          if (!w) return
          this.waiting.delete(m.id)
          clearTimeout(w.timer)
          if (m.type === 'frame') w.resolve(m.bitmap)
          else w.reject(new SceneError(m.message, m.stack))
        }
      }
      this.worker.onerror = (e) => {
        clearTimeout(timer)
        reject(new SceneError(e.message || 'O código da cena tem um erro.'))
      }
    })
    this.worker.postMessage({ type: 'init', code: input.code, width: input.width, height: input.height, duration: input.duration, fps: FPS, images: input.images, beats: input.beats ?? [], bpm: input.bpm ?? 120, brand: input.brand, post: input.post ?? null, fonts: input.fonts ?? [], data: input.data ?? null })
  }

  load() {
    return this.ready
  }

  /** O quadro do segundo `t`. Mais de 8 s num quadro = laço infinito: o worker é derrubado. */
  async frame(t: number, video?: ImageBitmap, broll?: ImageBitmap): Promise<ImageBitmap> {
    await this.ready
    if (this.dead) throw new SceneError('A cena parou.')
    const id = ++this.seq
    return new Promise<ImageBitmap>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id)
        this.dispose()
        reject(new SceneError('Um quadro levou mais de 8 s: o código deve estar em laço. A cena foi parada.'))
      }, 8000)
      this.waiting.set(id, { resolve, reject, timer })
      this.worker.postMessage({ type: 'frame', id, t, video, broll }, [video, broll].filter(Boolean) as ImageBitmap[])
    })
  }

  dispose() {
    if (this.dead) return
    this.dead = true
    this.worker.terminate()
    URL.revokeObjectURL(this.url)
    for (const w of this.waiting.values()) {
      clearTimeout(w.timer)
      w.reject(new SceneError('A cena parou.'))
    }
    this.waiting.clear()
  }
}

/** As imagens que a cena usa, prontas para o worker. */
export async function sceneBitmaps(scene: CodeScene, images: Map<string, CanvasImageSource & { width: number; height: number }>): Promise<Record<string, ImageBitmap>> {
  const out: Record<string, ImageBitmap> = {}
  for (const { src, name } of scene.images) {
    const img = images.get(src)
    if (img && !(img instanceof HTMLVideoElement)) out[name] = await createImageBitmap(img as ImageBitmapSource)
  }
  return out
}

export interface SceneVideoOptions {
  audio?: { data: ArrayBuffer; cfg: MotionAudio }
  onProgress?: (p: number) => void
  signal?: AbortSignal
}

/** A cena inteira em MP4, quadro a quadro. */
export async function sceneToMp4(scene: CodeScene, input: Omit<SceneInput, 'code' | 'width' | 'height' | 'duration'>, opts: SceneVideoOptions = {}): Promise<Blob> {
  const { width, height } = sizeOf(scene.format)
  const runner = new SceneRunner({ ...input, code: scene.code, width, height, duration: scene.duration })
  try {
    await runner.load()
    let last: ImageBitmap | undefined
    return await encodeMp4({
      width,
      height,
      frames: Math.max(1, Math.round(scene.duration * FPS)),
      audio: opts.audio,
      onProgress: opts.onProgress,
      signal: opts.signal,
      frame: async (i) => {
        last?.close()
        last = await runner.frame(i / FPS)
        return last
      },
    })
  } finally {
    runner.dispose()
  }
}

export const newScene = (code: string, name = 'Cena nova'): CodeScene => ({ id: Math.random().toString(36).slice(2, 10), name, format: '9x16', duration: 20, code, images: [], updatedAt: Date.now() })
