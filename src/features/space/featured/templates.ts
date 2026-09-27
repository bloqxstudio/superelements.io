/**
 * Modelos de imagem destacada (1200×630, o tamanho que as redes usam no
 * compartilhamento). Cada modelo desenha num canvas com o que a marca e a
 * página têm: cores, fontes, logo, uma foto e o título. Um modelo sob medida
 * de um cliente é mais uma entrada nesta lista.
 */

export const FEATURED_WIDTH = 1200
export const FEATURED_HEIGHT = 630

export interface TemplateInput {
  title: string
  subtitle?: string
  photo?: HTMLImageElement
  /** Logo na versão que contrasta com o fundo do modelo. */
  logoFor: (dark: boolean) => HTMLImageElement | undefined
  /** Fundo escolhido e as cores que saem dele. */
  background: string
  backgroundDark: boolean
  /** Cor de destaque da marca (barra, detalhe). */
  accent: string
  headingFont: string
  headingWeight: string | number
  bodyFont: string
}

export interface FeaturedTemplate {
  id: string
  name: string
  hint: string
  /** Usa foto: sem ela, o modelo avisa e desenha só o fundo. */
  photo: boolean
  draw: (ctx: CanvasRenderingContext2D, input: TemplateInput) => void
}

const W = FEATURED_WIDTH
const H = FEATURED_HEIGHT
const PAD = 72

/** Cobre a área com a imagem, cortando o que sobra (como object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  const sx = (image.naturalWidth - sw) / 2
  const sy = (image.naturalHeight - sh) / 2
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h)
}

/** Logo com altura fixa, a largura pela proporção do arquivo (limitada). */
function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | undefined, x: number, y: number, height: number, maxWidth: number, align: 'left' | 'center' = 'left') {
  if (!logo?.naturalWidth) return
  let h = height
  let w = (logo.naturalWidth / logo.naturalHeight) * h
  if (w > maxWidth) {
    w = maxWidth
    h = (logo.naturalHeight / logo.naturalWidth) * w
  }
  ctx.drawImage(logo, align === 'center' ? x - w / 2 : x, y, w, h)
}

const font = (weight: string | number, size: number, family: string) => `${weight} ${size}px "${family}", system-ui, sans-serif`

/** Quebra o texto em linhas que cabem na largura. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Título no maior tamanho em que cabe em até `maxLines` linhas; o que ainda
 * sobrar no menor tamanho termina em reticências. Devolve a altura usada.
 */
function drawTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  input: TemplateInput,
  box: { x: number; y: number; width: number; maxLines: number; sizes: [number, number]; color: string; align?: CanvasTextAlign; anchor?: 'top' | 'bottom' }
) {
  const [max, min] = box.sizes
  let size = max
  let lines: string[] = []
  for (; size >= min; size -= 4) {
    ctx.font = font(input.headingWeight, size, input.headingFont)
    lines = wrap(ctx, text, box.width)
    if (lines.length <= box.maxLines) break
  }
  size = Math.max(size, min)
  ctx.font = font(input.headingWeight, size, input.headingFont)
  if (lines.length > box.maxLines) {
    lines = lines.slice(0, box.maxLines)
    let last = lines[box.maxLines - 1]
    while (last && ctx.measureText(`${last}…`).width > box.width) last = last.slice(0, -1)
    lines[box.maxLines - 1] = `${last.trimEnd()}…`
  }
  const lineHeight = Math.round(size * 1.08)
  const height = lineHeight * lines.length
  const top = box.anchor === 'bottom' ? box.y - height : box.y
  ctx.fillStyle = box.color
  ctx.textAlign = box.align ?? 'left'
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, box.x, top + i * lineHeight))
  return { top, height }
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string | undefined,
  input: TemplateInput,
  box: { x: number; y: number; width: number; color: string; size?: number; align?: CanvasTextAlign }
) {
  if (!text?.trim()) return 0
  const size = box.size ?? 28
  ctx.font = font(400, size, input.bodyFont)
  const lines = wrap(ctx, text.trim(), box.width).slice(0, 2)
  ctx.fillStyle = box.color
  ctx.textAlign = box.align ?? 'left'
  ctx.textBaseline = 'top'
  const lineHeight = Math.round(size * 1.35)
  lines.forEach((l, i) => ctx.fillText(l, box.x, box.y + i * lineHeight))
  return lineHeight * lines.length
}

const onColor = (dark: boolean) => (dark ? '#FFFFFF' : '#111111')
const softOn = (dark: boolean) => (dark ? 'rgba(255,255,255,0.78)' : 'rgba(17,17,17,0.72)')

export const FEATURED_TEMPLATES: FeaturedTemplate[] = [
  {
    id: 'cor',
    name: 'Título na cor',
    hint: 'Fundo na cor da marca, logo e título grande',
    photo: false,
    draw: (ctx, input) => {
      ctx.fillStyle = input.background
      ctx.fillRect(0, 0, W, H)
      drawLogo(ctx, input.logoFor(input.backgroundDark), PAD, PAD, 52, 320)
      const sub = input.subtitle?.trim()
      const bottom = H - PAD - (sub ? 84 : 0)
      const title = drawTitle(ctx, input.title, input, {
        x: PAD,
        y: bottom,
        width: W - PAD * 2,
        maxLines: 3,
        sizes: [84, 52],
        color: onColor(input.backgroundDark),
        anchor: 'bottom',
      })
      ctx.fillStyle = input.accent
      ctx.fillRect(PAD, title.top - 36, 72, 8)
      drawSubtitle(ctx, sub, input, { x: PAD, y: bottom + 24, width: W - PAD * 2, color: softOn(input.backgroundDark) })
    },
  },
  {
    id: 'foto',
    name: 'Foto com título',
    hint: 'Foto inteira, com o título por cima',
    photo: true,
    draw: (ctx, input) => {
      ctx.fillStyle = input.background
      ctx.fillRect(0, 0, W, H)
      if (input.photo) drawCover(ctx, input.photo, 0, 0, W, H)
      // Escurece embaixo para o título ler sobre qualquer foto
      const shade = ctx.createLinearGradient(0, H * 0.25, 0, H)
      shade.addColorStop(0, 'rgba(0,0,0,0)')
      shade.addColorStop(1, 'rgba(0,0,0,0.78)')
      ctx.fillStyle = shade
      ctx.fillRect(0, 0, W, H)
      const top = ctx.createLinearGradient(0, 0, 0, 180)
      top.addColorStop(0, 'rgba(0,0,0,0.45)')
      top.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = top
      ctx.fillRect(0, 0, W, 180)
      drawLogo(ctx, input.logoFor(true), PAD, PAD - 16, 48, 300)
      const sub = input.subtitle?.trim()
      const bottom = H - PAD + 8 - (sub ? 76 : 0)
      drawTitle(ctx, input.title, input, { x: PAD, y: bottom, width: W - PAD * 2, maxLines: 3, sizes: [76, 48], color: '#FFFFFF', anchor: 'bottom' })
      drawSubtitle(ctx, sub, input, { x: PAD, y: bottom + 20, width: W - PAD * 2, color: 'rgba(255,255,255,0.85)', size: 26 })
    },
  },
  {
    id: 'dividida',
    name: 'Foto ao lado',
    hint: 'Título na cor à esquerda, foto à direita',
    photo: true,
    draw: (ctx, input) => {
      const split = Math.round(W * 0.56)
      ctx.fillStyle = input.background
      ctx.fillRect(0, 0, W, H)
      if (input.photo) drawCover(ctx, input.photo, split, 0, W - split, H)
      drawLogo(ctx, input.logoFor(input.backgroundDark), PAD, PAD, 44, split - PAD * 2)
      const width = split - PAD * 2
      const title = drawTitle(ctx, input.title, input, {
        x: PAD,
        y: 190,
        width,
        maxLines: 4,
        sizes: [64, 40],
        color: onColor(input.backgroundDark),
      })
      drawSubtitle(ctx, input.subtitle, input, { x: PAD, y: title.top + title.height + 28, width, color: softOn(input.backgroundDark), size: 24 })
      ctx.fillStyle = input.accent
      ctx.fillRect(split - 8, 0, 8, H)
    },
  },
  {
    id: 'marca',
    name: 'Só a marca',
    hint: 'Logo no centro, título pequeno embaixo',
    photo: false,
    draw: (ctx, input) => {
      ctx.fillStyle = input.background
      ctx.fillRect(0, 0, W, H)
      const hasTitle = !!input.title.trim()
      drawLogo(ctx, input.logoFor(input.backgroundDark), W / 2, hasTitle ? 170 : 225, 150, 640, 'center')
      if (hasTitle) {
        drawTitle(ctx, input.title, input, {
          x: W / 2,
          y: 390,
          width: W - PAD * 4,
          maxLines: 2,
          sizes: [48, 34],
          color: onColor(input.backgroundDark),
          align: 'center',
        })
      }
      ctx.fillStyle = input.accent
      ctx.fillRect(0, H - 12, W, 12)
    },
  },
]

export const featuredTemplate = (id: string) => FEATURED_TEMPLATES.find((t) => t.id === id) ?? FEATURED_TEMPLATES[0]
