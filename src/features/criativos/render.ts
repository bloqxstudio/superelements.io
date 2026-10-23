import { sizeOf, type FormatId, type ImageLayer, type Layer, type ShapeLayer, type Slide, type TextLayer } from './types'

/**
 * Desenho de um slide no canvas 2D, no tamanho real do formato. A tela do
 * editor e a exportação chamam a mesma função: o que se vê é o que se baixa.
 */

export type ImageMap = Map<string, CanvasImageSource & { width: number; height: number }>

// Fontes

const loadedFonts = new Set<string>()

/** Carrega uma família do Google Fonts (pesos 400–800) e espera ela ficar pronta para o canvas. */
export async function loadFont(family: string): Promise<void> {
  const name = family.trim()
  if (!name || loadedFonts.has(name)) return
  loadedFonts.add(name)
  const id = `criativos-font-${name.replace(/\W+/g, '-')}`
  if (!document.getElementById(id)) {
    const q = encodeURIComponent(name).replace(/%20/g, '+')
    const add = (spec: string) =>
      new Promise<boolean>((resolve) => {
        const link = document.createElement('link')
        link.id = id
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${q}${spec}&display=swap`
        link.onload = () => resolve(true)
        link.onerror = () => {
          link.remove()
          resolve(false)
        }
        document.head.appendChild(link)
        setTimeout(() => resolve(false), 4000)
      })
    // Famílias de um peso só (Instrument Serif) recusam a lista de pesos: tenta com itálico e depois sem nada
    if (!(await add(':ital,wght@0,400;0,500;0,600;0,700;0,800;1,400'))) if (!(await add(':ital@0;1'))) await add('')
  }
  await Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "${name}"`).catch(() => [])))
  await document.fonts.load(`italic 400 40px "${name}"`).catch(() => [])
}

export const fontCss = (layer: Pick<TextLayer, 'weight' | 'size' | 'font'>) => `${layer.weight} ${layer.size}px "${layer.font}", system-ui, sans-serif`

// Imagens

/** Endereço pronto para o canvas: o arquivo vira blob para a exportação não ficar "tainted". */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  let href = url
  let revoke = false
  if (!url.startsWith('data:') && !url.startsWith('blob:')) {
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (res.ok) {
        let blob = await res.blob()
        // SVG só com viewBox não tem tamanho próprio: dá o tamanho do viewBox para o canvas
        if (/svg/.test(blob.type) || /\.svg(\?|$)/i.test(url)) {
          const text = await blob.text()
          const vb = /viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/.exec(text)
          const sized = vb && !/<svg[^>]*\swidth=/.test(text) ? text.replace('<svg', `<svg width="${vb[1]}" height="${vb[2]}"`) : text
          blob = new Blob([sized], { type: 'image/svg+xml' })
        }
        href = URL.createObjectURL(blob)
        revoke = true
      }
    } catch {
      // cai no carregamento direto
    }
  }
  const img = new Image()
  if (!revoke) img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Imagem não carregou: ${url.slice(0, 80)}`))
    img.src = href
  })
  return img
}

// Texto

interface Run {
  text: string
  em: boolean
  /** Pontuação colada na palavra de antes, sem espaço. */
  glue?: boolean
}
interface Measured {
  lines: Run[][]
  lineHeight: number
  height: number
}

const scratch = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null

/** Fonte do destaque: a serifa da marca, itálico. */
export const EMPHASIS_FONT = 'Instrument Serif'

function setText(ctx: CanvasRenderingContext2D, layer: TextLayer, em = false) {
  ctx.font = em ? `italic 400 ${layer.size * 1.12}px "${EMPHASIS_FONT}", Georgia, serif` : fontCss(layer)
  ctx.letterSpacing = em ? '0px' : `${layer.letterSpacing * layer.size}px`
  ctx.textBaseline = 'alphabetic'
}

/** Palavras do parágrafo, com `*destaque*` marcado (pode cobrir mais de uma palavra). */
function words(paragraph: string, emphasis: boolean): Run[] {
  const out: Run[] = []
  let em = false
  for (const raw of paragraph.split(/\s+/).filter(Boolean)) {
    // `*palavra*` pode vir com pontuação colada: "*cheia*."
    const m = /^(\*?)(.*?)(\*?)([.,;:!?…)"”]*)$/.exec(raw)
    if (!emphasis || !m) {
      out.push({ text: raw, em: false })
      continue
    }
    const [, open, body, close, punct] = m
    if (open) em = true
    if (em) {
      out.push({ text: body, em: true })
      if (punct) out.push({ text: punct, em: false, glue: true })
    } else out.push({ text: body + close + punct, em: false })
    if (close) em = false
  }
  return out
}

const runWidth = (ctx: CanvasRenderingContext2D, layer: TextLayer, run: Run) => {
  setText(ctx, layer, run.em)
  return ctx.measureText(run.text).width
}

// Palavras curtas que não ficam sozinhas no fim da linha: vão junto com a próxima ("de casa", "o site")
const GLUE = new Set(['a', 'o', 'e', 'é', 'à', 'ao', 'as', 'os', 'da', 'de', 'do', 'em', 'na', 'no', 'um', 'se', 'ou', 'por', 'com', 'que', 'não', 'sua', 'seu', 'para', 'pela', 'pelo', 'das', 'dos', 'nas', 'nos', 'mais', 'mas', 'meu', 'minha', 'suas', 'seus', 'the', 'an', 'of', 'to', 'in', 'is', 'for', 'and'])
const bare = (t: string) => t.toLowerCase().replace(/[^\p{L}]/gu, '')

/**
 * Quebra o texto pela largura da caixa, como uma boa tipografia: as palavras
 * curtas vão com a seguinte, as duas últimas palavras do parágrafo ficam
 * juntas (nunca uma palavra sozinha na última linha) e os títulos grandes são
 * equilibrados (linhas de tamanho parecido, sem sobra no fim).
 */
function wrapParagraph(ctx: CanvasRenderingContext2D, layer: TextLayer, runs: Run[]): Run[][] {
  const space = (setText(ctx, layer), ctx.measureText(' ').width)
  // Unidades que não se separam: uma palavra (com a pontuação colada) ou um grupo preso
  let units: Run[][] = []
  for (const run of runs) {
    if (run.glue && units.length) units[units.length - 1].push(run)
    else units.push([run])
  }
  for (let i = 0; i < units.length - 1; ) {
    const unit = units[i]
    if (unit.length === 1 && !unit[0].em && GLUE.has(bare(unit[0].text)) && !/[.,;:!?…]$/.test(unit[0].text)) {
      units.splice(i, 2, [...unit, ...units[i + 1]])
    } else i++
  }
  const widthOf = (unit: Run[]) => unit.reduce((n, r, k) => n + runWidth(ctx, layer, r) + (k && !r.glue ? space : 0), 0)
  // As duas últimas palavras ficam juntas, desde que juntas ainda caibam na caixa
  if (units.length >= 3) {
    const tail = [...units[units.length - 2], ...units[units.length - 1]]
    if (widthOf(tail) <= layer.w * 0.9) units = [...units.slice(0, -2), tail]
  }
  const sizes = units.map(widthOf)
  const greedy = (max: number) => {
    const lines: Run[][] = []
    let line: Run[] = []
    let width = 0
    units.forEach((unit, i) => {
      const w = sizes[i]
      if (line.length && width + space + w > max) {
        lines.push(line)
        line = []
        width = 0
      }
      line.push(...unit)
      width += (width ? space : 0) + w
    })
    if (line.length) lines.push(line)
    return lines
  }

  const full = greedy(layer.w)
  // Título grande com mais de uma linha: procura a menor largura que mantém o mesmo número de linhas
  if (layer.size >= 60 && full.length > 1) {
    let lo = layer.w * 0.5
    let hi = layer.w
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2
      if (greedy(mid).length === full.length) hi = mid
      else lo = mid
    }
    return greedy(hi + 1)
  }
  return full
}

/** Quebra o texto pela largura da caixa e diz a altura que ele ocupa. */
export function measureText(layer: TextLayer, ctx: CanvasRenderingContext2D | null = scratch): Measured {
  const lineHeight = layer.size * layer.lineHeight
  if (!ctx) return { lines: [[{ text: layer.text, em: false }]], lineHeight, height: lineHeight }
  ctx.save()
  const source = layer.upper ? layer.text.toUpperCase() : layer.text
  const lines: Run[][] = []
  for (const paragraph of source.split('\n')) {
    const runs = words(paragraph, !!layer.emphasis)
    if (!runs.length) lines.push([])
    else lines.push(...wrapParagraph(ctx, layer, runs))
  }
  ctx.restore()
  return { lines, lineHeight, height: lines.length * lineHeight }
}

/** A linha mais larga do texto, depois da quebra: maior que a caixa quer dizer que uma palavra não coube. */
export function widestLine(layer: TextLayer, ctx: CanvasRenderingContext2D | null = scratch): number {
  if (!ctx) return 0
  const { lines } = measureText(layer, ctx)
  ctx.save()
  setText(ctx, layer)
  const space = ctx.measureText(' ').width
  let widest = 0
  for (const line of lines) {
    const total = line.reduce((n, r, k) => n + runWidth(ctx, layer, r) + (k && !r.glue ? space : 0), 0)
    if (total > widest) widest = total
  }
  ctx.restore()
  return widest
}

function drawText(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  const { lines, lineHeight } = measureText(layer, ctx)
  ctx.textAlign = 'left'
  // O espaço extra da entrelinha fica metade em cima e metade embaixo, como no CSS
  const ascent = layer.size * 0.8 + (lineHeight - layer.size) / 2
  lines.forEach((line, i) => {
    setText(ctx, layer)
    const space = ctx.measureText(' ').width
    const total = line.reduce((n, r, k) => n + runWidth(ctx, layer, r) + (k && !r.glue ? space : 0), 0)
    let x = layer.align === 'left' ? layer.x : layer.align === 'center' ? layer.x + (layer.w - total) / 2 : layer.x + layer.w - total
    line.forEach((run, k) => {
      if (k && !run.glue) x += space
      setText(ctx, layer, run.em)
      ctx.fillStyle = run.em ? layer.emphasisColor ?? layer.color : layer.color
      ctx.fillText(run.text, x, layer.y + ascent + i * lineHeight)
      x += ctx.measureText(run.text).width
    })
  })
}

// Formas e imagens

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
}

function paintImage(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, fit: 'cover' | 'contain', focusY = 0.5) {
  const scale = (fit === 'cover' ? Math.max : Math.min)(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = x + (w - dw) / 2
  const dy = fit === 'cover' ? y + (h - dh) * focusY : y + (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}

function drawImage(ctx: CanvasRenderingContext2D, layer: ImageLayer, images: ImageMap) {
  const img = images.get(layer.src)
  const { x, y, w, h } = layer
  // Imagem pedida à IA e ainda não pronta: um bloco listrado que diz que está vindo
  if (!img && !layer.src && layer.prompt) {
    ctx.save()
    roundRect(ctx, x, y, w, h, layer.radius)
    ctx.clip()
    ctx.fillStyle = '#cfcfca'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 36
    for (let k = -h; k < w; k += 90) {
      ctx.beginPath()
      ctx.moveTo(x + k, y + h)
      ctx.lineTo(x + k + h, y)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.font = `600 ${Math.max(24, Math.min(46, Math.round(w * 0.045)))}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(layer.genFailed ? 'Imagem não gerada' : 'Gerando imagem…', x + w / 2, y + h / 2)
    ctx.restore()
    return
  }
  ctx.save()

  let ix = x
  let iy = y
  let iw = w
  let ih = h
  let radius = layer.radius

  if (layer.frame === 'browser') {
    const bar = Math.max(34, Math.round(w * 0.045))
    radius = Math.round(w * 0.018)
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = w * 0.06
    ctx.shadowOffsetY = w * 0.02
    ctx.fillStyle = '#f3f3f1'
    roundRect(ctx, x, y, w, h, radius)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#e4e3df'
    ctx.save()
    roundRect(ctx, x, y, w, h, radius)
    ctx.clip()
    ctx.fillRect(x, y, w, bar)
    ctx.restore()
    const dot = bar * 0.12
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(x + bar * 0.5 + i * dot * 3, y + bar / 2, dot, 0, Math.PI * 2)
      ctx.fill()
    })
    iy = y + bar
    ih = h - bar
    ctx.beginPath()
    ctx.roundRect(ix, iy, iw, ih, [0, 0, radius, radius])
    ctx.clip()
  } else if (layer.frame === 'phone') {
    const bezel = Math.round(w * 0.035)
    radius = Math.round(w * 0.14)
    ctx.shadowColor = 'rgba(0,0,0,0.32)'
    ctx.shadowBlur = w * 0.08
    ctx.shadowOffsetY = w * 0.03
    ctx.fillStyle = '#121212'
    roundRect(ctx, x, y, w, h, radius)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ix = x + bezel
    iy = y + bezel
    iw = w - bezel * 2
    ih = h - bezel * 2
    roundRect(ctx, ix, iy, iw, ih, radius - bezel)
    ctx.clip()
  } else {
    roundRect(ctx, x, y, w, h, radius)
    ctx.clip()
  }

  if (!img) {
    ctx.fillStyle = '#d9d7d2'
    ctx.fillRect(ix, iy, iw, ih)
  }
  if (img) paintImage(ctx, img, ix, iy, iw, ih, layer.fit, layer.focusY ?? 0)
  ctx.restore()

  if (layer.frame === 'phone') {
    // Ilha da câmera
    ctx.save()
    ctx.fillStyle = '#121212'
    const pw = w * 0.26
    roundRect(ctx, x + (w - pw) / 2, y + w * 0.055, pw, w * 0.06, w * 0.03)
    ctx.fill()
    ctx.restore()
  }
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, images: ImageMap) {
  ctx.save()
  ctx.globalAlpha = layer.opacity ?? 1
  if (layer.rotation) {
    const box = layerBox(layer)
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2)
    ctx.rotate((layer.rotation * Math.PI) / 180)
    ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2))
  }
  if (layer.type === 'text') drawText(ctx, layer)
  else if (layer.type === 'image') drawImage(ctx, layer, images)
  else if (layer.type === 'ring') {
    ctx.strokeStyle = layer.stroke
    ctx.lineWidth = layer.strokeWidth
    ctx.beginPath()
    ctx.ellipse(layer.x + layer.w / 2, layer.y + layer.h / 2, layer.w / 2, layer.h / 2, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (layer.type === 'dots') {
    ctx.save()
    ctx.beginPath()
    ctx.rect(layer.x, layer.y, layer.w, layer.h)
    ctx.clip()
    ctx.fillStyle = layer.color
    for (let y = layer.y + layer.gap / 2; y < layer.y + layer.h; y += layer.gap)
      for (let x = layer.x + layer.gap / 2; x < layer.x + layer.w; x += layer.gap) ctx.fillRect(x - layer.dot / 2, y - layer.dot / 2, layer.dot, layer.dot)
    ctx.restore()
  } else {
    roundRect(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius)
    ctx.fillStyle = layer.fill2 ? gradientOf(ctx, layer) : layer.fill
    ctx.fill()
    if (layer.stroke && layer.strokeWidth) {
      ctx.strokeStyle = layer.stroke
      ctx.lineWidth = layer.strokeWidth
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** Degradê linear da forma, com a direção em graus do CSS (180 = de cima para baixo). */
function gradientOf(ctx: CanvasRenderingContext2D, layer: ShapeLayer) {
  const a = (((layer.angle ?? 180) % 360) * Math.PI) / 180
  const cx = layer.x + layer.w / 2
  const cy = layer.y + layer.h / 2
  const half = (Math.abs(layer.w * Math.sin(a)) + Math.abs(layer.h * Math.cos(a))) / 2
  const dx = Math.sin(a) * half
  const dy = -Math.cos(a) * half
  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
  g.addColorStop(0, layer.fill)
  g.addColorStop(1, layer.fill2 ?? layer.fill)
  return g
}

/** Desenha o slide inteiro; o canvas já deve ter o tamanho do formato. */
export function drawSlide(ctx: CanvasRenderingContext2D, slide: Slide, format: FormatId, images: ImageMap) {
  const { width, height } = sizeOf(format)
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = slide.background
  ctx.fillRect(0, 0, width, height)
  for (const layer of slide.layers) drawLayer(ctx, layer, images)
  ctx.restore()
}

/** Altura que a camada ocupa de verdade (o texto cresce com as linhas). */
export function layerBox(layer: Layer): { x: number; y: number; w: number; h: number } {
  if (layer.type === 'text') return { x: layer.x, y: layer.y, w: layer.w, h: Math.max(layer.h, measureText(layer).height) }
  return { x: layer.x, y: layer.y, w: layer.w, h: layer.h }
}

// Exportação

export type ExportType = 'png' | 'jpg'

export async function slideToBlob(slide: Slide, format: FormatId, images: ImageMap, type: ExportType): Promise<Blob> {
  const { width, height } = sizeOf(format)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  drawSlide(canvas.getContext('2d')!, slide, format, images)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não consegui gerar a imagem.'))), type === 'png' ? 'image/png' : 'image/jpeg', 0.95)
  )
}
