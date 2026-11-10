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
- env.data (vídeo narrado, quando houver): { parts: [{ label, text, start, end }] (cada parte da narração e o segundo em que ela começa e termina), words: [{ w, s, e }] (cada palavra falada, início e fim em segundos) }. Sincronize as cenas com parts[i].start: a animação de cada parte entra quando a voz começa a falar dela. Use sempre um valor de reserva (ex.: env.data?.parts?.[1]?.start ?? 6) para a cena rodar sem dados.
- env.data.params: os valores dos campos editáveis da cena (texto da tela, cores, efeitos), pela chave de cada campo. Leia sempre com reserva: const P = env.data?.params || {}; P.titulo1 ?? 'TEXTO'. A legenda da fala é do motor (desenhada por cima quando ligada): não desenhe legenda, frase de rodapé nem a fala na tela.
- env.images.logo (o logo da marca para fundo claro) e env.images.logo_escuro (para fundo escuro), quando a marca tem logo: onde a marca aparece, desenhe o logo de verdade com lib.image(..., 'contain'), nunca o nome escrito no lugar; só sem imagem use o nome em texto.
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
Fluidez (obrigatório): todo movimento de câmera e de destaque é uma curva contínua com aceleração e desaceleração (lib.tween/lib.prog com inOutCubic ou outExpo, ou uma interpolação entre o alvo anterior e o novo); nunca média de amostras passadas, nunca valor que muda em degraus, nunca Math.sin/cos de frequência alta (acima de ~6) para tremer: a 30 fps isso vira micro-tremida. Câmera que respira = seno lento (0,3 a 1 por segundo) e pequeno.`

/** A parte 3D do contrato: entra só quando o 3D foi escolhido ou pedido (`videoDirection.ts`, `wants3d`). */
export const SCENE_CONTRACT_3D = `- lib.d3: motor 3D pronto (perspectiva, luz, sombras, profundidade, ícones). Para vídeos 3D (cidade tecnológica, mini componente, ecossistema conectado), use-o em vez de escrever projeção à mão. Padrão:
  const CAM = [[0, { at: [0, 0.5, 0], yaw: -40, pitch: 70, dist: 24, fov: 50 }], [parts[1].start, { at: [-3, 1.6, -2], yaw: -128, pitch: 17, dist: 9 }], ...]  // um ângulo por parte; campos omitidos repetem o anterior; yaw/pitch em graus; yaw contínuo (-40 → -128 → -210…, sem voltar a 0) para a câmera girar sempre para o mesmo lado
  lib.d3.run(ctx, t, env, CAM, (c, time) => { const w = lib.d3.world(c, time, env, { camera: CAM, background: '#070912', accent: '#2B3CF0' }); ...; w.render() })  // run aplica rastro de velocidade só quando a câmera anda rápido; desenhe SEMPRE em c e com time
  Mundo (unidades: a placa tem 11,2 de lado, centro em 0,0; y para cima; chão em y=0):
  w.plate({ size, open (0..1), layers: [{ kind: 'texto'|'grade'|'botao'|'vazio', lit (0..1), at (segundo em que acende) }] }) a placa do mini componente com trilhas de circuito; open abre as camadas de baixo em escada ("o que sustenta").
  w.city({ seed, rise (segundo em que sobe), avoid: [[x, z, raio]], roads: [[ax, az, bx, bz]] }) quarteirões baixos preenchendo a placa. w.road([x, z], [x, z], largura).
  w.node({ x, z, h, shape: 'nucleo'|'torre'|'recuo'|'estudio'|'largo'|'cilindro'|'caixa', icon, grow (0..1 sobe), pop (0..1 plaquinha), focus (0..1 destaque), band (cor), tileW, tileScale, lift }) → { top, tile, screen }: prédio com plaquinha de ícone em cima. 'nucleo' é o centro (use icon 'logo'); 'largo' devolve screen (fachada) para w.panel.
  Ícones (icon; a lista fica em lib.d3.icons): anuncio, instagram, site, atendimento, whatsapp, criativo, loja, agenda, email, busca, grafico, video, pagamento, logo, logo_escuro; e msg_in, msg_out, digitando (balões de conversa). Também aceita uma imagem de env.images.
  w.link(a, b, { grow, focus, dim, flash, pulses }) → { at(s) }: arco de luz com pulsos entre dois pontos (use node.top). w.comet(link, p) pulso grande com rastro na fração p.
  w.tile({ at: [x, y, z], icon, w, scale, halo, haloColor, sway }) plaquinha solta virada para a câmera. w.panel({ id, corners, draw(g, largura, altura) }) tela viva; lib.d3.browser(g, largura, altura, p, cor, time) pinta um site montando (p 0..1: página, depois estrelas e selo).
  w.people({ from: [x, z], to: [x, z], count, alpha }), w.ripple({ at, phase (0..1), r0, r1, ground }), w.floaters({ at, kind: 'coracao'|'estrela', alpha }), w.glow(p, raio, cor, alfa), w.line(pontos, cor, largura, alfa), w.sprite(p, (g, x, y, escala) => {...}) desenho 2D livre na ordem de profundidade. w.cam (right, yaw…) para posicionar coisas ao lado do que a câmera vê.
  lib.d3.wordAt(env, 'palavra', aPartirDe, reserva) → segundo em que a palavra é falada (acende cada coisa na palavra certa).
  No 3D: ponha a parte da narração em foco com a câmera (perto, 6 a 10 de distância) e abra o plano (17 a 25) nas transições e no fecho; cada nó com prédio + ícone + conexões; nada de texto na tela se o pedido não pedir.`

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
        else if (m.type === 'data-ok') {
          const w = this.waiting.get(m.id)
          if (!w) return
          this.waiting.delete(m.id)
          clearTimeout(w.timer)
          if (m.message) w.reject(new SceneError(m.message))
          else w.resolve(null as unknown as ImageBitmap)
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
  async frame(t: number, video?: ImageBitmap, broll?: ImageBitmap, mask?: ImageBitmap): Promise<ImageBitmap> {
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
      // mask: o recorte da pessoa no quadro do vídeo (explicativo/recorte.ts), alfa = pessoa
      this.worker.postMessage({ type: 'frame', id, t, video, broll, mask }, [video, broll, mask].filter(Boolean) as ImageBitmap[])
    })
  }

  /** Troca o env.data (campos, legenda, narração) sem recarregar a cena: o setup roda de novo. */
  async setData(data: unknown): Promise<void> {
    await this.ready
    if (this.dead) throw new SceneError('A cena parou.')
    const id = ++this.seq
    await new Promise<ImageBitmap>((resolve, reject) => {
      const timer = setTimeout(() => { this.waiting.delete(id); reject(new SceneError('A cena não respondeu à troca dos campos.')) }, 8000)
      this.waiting.set(id, { resolve, reject, timer })
      this.worker.postMessage({ type: 'data', id, data: data ?? null })
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
export async function sceneBitmaps(scene: CodeScene, images: Map<string, CanvasImageSource & { width: number; height: number }>, brand?: { logoOnLight?: string; logoOnDark?: string }): Promise<Record<string, ImageBitmap>> {
  const out: Record<string, ImageBitmap> = {}
  // O logo de verdade da marca, sempre à mão (a cena escrevia o nome no lugar dele)
  for (const [name, src] of [['logo', brand?.logoOnLight ?? brand?.logoOnDark], ['logo_escuro', brand?.logoOnDark ?? brand?.logoOnLight]] as const) {
    const img = src ? images.get(src) : undefined
    if (img && !(img instanceof HTMLVideoElement)) out[name] = await createImageBitmap(img as ImageBitmapSource)
  }
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
