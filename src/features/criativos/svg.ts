import { layerBox, placeText } from './render'
import { sizeOf, type FormatId, type ImageLayer, type Layer, type ShapeLayer, type Slide, type TextLayer } from './types'

/**
 * Um slide como SVG, com as mesmas contas do `drawSlide` (render.ts): serve onde não há canvas, como
 * a prévia que o MCP da Sinfy manda para o chat da IA (o servidor rasteriza com resvg). O texto sai já
 * quebrado e posicionado por `placeText`, com o contexto de medida que o servidor registrou.
 */

export interface SvgImage {
  /** data: URL (o rasterizador não busca nada sozinho). */
  href: string
  width: number
  height: number
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (v: number) => (Math.round(v * 100) / 100).toString()

/** rgba(…) e #rrggbbaa viram cor + opacidade, que todo rasterizador entende. */
function paint(color: string): { c: string; o?: number } {
  const m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/i.exec(color.trim())
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { c: `rgb(${m[1]},${m[2]},${m[3]})`, o: a < 1 ? a : undefined }
  }
  const h = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(color.trim())
  if (h) return { c: `#${h[1]}`, o: parseInt(h[2], 16) / 255 }
  if (color.trim() === 'transparent') return { c: '#000', o: 0 }
  return { c: color }
}
const fillAttr = (color: string, name = 'fill') => {
  const p = paint(color)
  return `${name}="${esc(p.c)}"${p.o !== undefined ? ` ${name}-opacity="${n(p.o)}"` : ''}`
}

const rectPath = (x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) => {
  const [tl, tr, br, bl] = (Array.isArray(r) ? r : [r, r, r, r]).map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  return `M${n(x + tl)},${n(y)}H${n(x + w - tr)}${tr ? `A${n(tr)},${n(tr)} 0 0 1 ${n(x + w)},${n(y + tr)}` : ''}V${n(y + h - br)}${br ? `A${n(br)},${n(br)} 0 0 1 ${n(x + w - br)},${n(y + h)}` : ''}H${n(x + bl)}${bl ? `A${n(bl)},${n(bl)} 0 0 1 ${n(x)},${n(y + h - bl)}` : ''}V${n(y + tl)}${tl ? `A${n(tl)},${n(tl)} 0 0 1 ${n(x + tl)},${n(y)}` : ''}Z`
}

class Defs {
  items: string[] = []
  private i = 0
  id(prefix: string) {
    return `${prefix}${++this.i}`
  }
}

function textSvg(layer: TextLayer) {
  return placeText(layer)
    .map((r) => {
      const p = paint(r.color)
      return `<text x="${n(r.x)}" y="${n(r.y)}" font-family="${esc(r.font)}" font-size="${n(r.size)}" font-weight="${r.weight}"${r.italic ? ' font-style="italic"' : ''}${r.letterSpacing ? ` letter-spacing="${n(r.letterSpacing)}"` : ''} fill="${esc(p.c)}"${p.o !== undefined ? ` fill-opacity="${n(p.o)}"` : ''} xml:space="preserve">${esc(r.text)}</text>`
    })
    .join('')
}

function shadow(defs: Defs, color: string, blur: number, dy: number) {
  const id = defs.id('s')
  const p = paint(color)
  defs.items.push(`<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${n(dy)}" stdDeviation="${n(blur / 2)}" flood-color="${esc(p.c)}" flood-opacity="${n(p.o ?? 1)}"/></filter>`)
  return id
}

function imageInBox(defs: Defs, img: SvgImage | undefined, layer: ImageLayer, x: number, y: number, w: number, h: number, clip: string) {
  const id = defs.id('c')
  defs.items.push(`<clipPath id="${id}"><path d="${clip}"/></clipPath>`)
  if (!img) return `<path d="${clip}" fill="#d9d7d2"/>`
  const scale = (layer.fit === 'cover' ? Math.max : Math.min)(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = x + (w - dw) / 2
  const dy = layer.fit === 'cover' ? y + (h - dh) * (layer.focusY ?? 0) : y + (h - dh) / 2
  return `<g clip-path="url(#${id})"><image href="${img.href}" x="${n(dx)}" y="${n(dy)}" width="${n(dw)}" height="${n(dh)}" preserveAspectRatio="none"/></g>`
}

function imageSvg(defs: Defs, layer: ImageLayer, image: (src: string) => SvgImage | undefined) {
  const { x, y, w, h } = layer
  const img = layer.src ? image(layer.src) : undefined
  if (!img && !layer.src && layer.prompt) {
    // A foto pedida ainda não foi gerada: o mesmo bloco listrado do editor
    const id = defs.id('c')
    defs.items.push(`<clipPath id="${id}"><path d="${rectPath(x, y, w, h, layer.radius)}"/></clipPath>`)
    const stripes: string[] = []
    for (let k = -h; k < w; k += 90) stripes.push(`<line x1="${n(x + k)}" y1="${n(y + h)}" x2="${n(x + k + h)}" y2="${n(y)}"/>`)
    const size = Math.max(24, Math.min(46, Math.round(w * 0.045)))
    return `<g clip-path="url(#${id})"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#cfcfca"/><g stroke="#ffffff" stroke-opacity="0.35" stroke-width="36">${stripes.join('')}</g><text x="${n(x + w / 2)}" y="${n(y + h / 2 + size * 0.35)}" text-anchor="middle" font-family="Inter" font-weight="600" font-size="${size}" fill="#000" fill-opacity="0.55">${layer.genFailed ? 'Imagem não gerada' : 'Foto a gerar no editor'}</text></g>`
  }
  if (layer.frame === 'browser') {
    const bar = Math.max(34, Math.round(w * 0.045))
    const radius = Math.round(w * 0.018)
    const s = shadow(defs, 'rgba(0,0,0,0.28)', w * 0.06, w * 0.02)
    const dot = bar * 0.12
    return [
      `<path d="${rectPath(x, y, w, h, radius)}" fill="#f3f3f1" filter="url(#${s})"/>`,
      `<path d="${rectPath(x, y, w, bar, [radius, radius, 0, 0])}" fill="#e4e3df"/>`,
      ...['#ff5f57', '#febc2e', '#28c840'].map((c, i) => `<circle cx="${n(x + bar * 0.5 + i * dot * 3)}" cy="${n(y + bar / 2)}" r="${n(dot)}" fill="${c}"/>`),
      imageInBox(defs, img, layer, x, y + bar, w, h - bar, rectPath(x, y + bar, w, h - bar, [0, 0, radius, radius])),
    ].join('')
  }
  if (layer.frame === 'phone') {
    const bezel = Math.round(w * 0.035)
    const radius = Math.round(w * 0.14)
    const s = shadow(defs, 'rgba(0,0,0,0.32)', w * 0.08, w * 0.03)
    const pw = w * 0.26
    return [
      `<path d="${rectPath(x, y, w, h, radius)}" fill="#121212" filter="url(#${s})"/>`,
      imageInBox(defs, img, layer, x + bezel, y + bezel, w - bezel * 2, h - bezel * 2, rectPath(x + bezel, y + bezel, w - bezel * 2, h - bezel * 2, radius - bezel)),
      `<path d="${rectPath(x + (w - pw) / 2, y + w * 0.055, pw, w * 0.06, w * 0.03)}" fill="#121212"/>`,
    ].join('')
  }
  return imageInBox(defs, img, layer, x, y, w, h, rectPath(x, y, w, h, layer.radius))
}

function shapeSvg(defs: Defs, layer: ShapeLayer) {
  let fill = fillAttr(layer.fill)
  if (layer.fill2) {
    const a = (((layer.angle ?? 180) % 360) * Math.PI) / 180
    const cx = layer.x + layer.w / 2
    const cy = layer.y + layer.h / 2
    const half = (Math.abs(layer.w * Math.sin(a)) + Math.abs(layer.h * Math.cos(a))) / 2
    const dx = Math.sin(a) * half
    const dy = -Math.cos(a) * half
    const id = defs.id('g')
    const s0 = paint(layer.fill)
    const s1 = paint(layer.fill2)
    defs.items.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(cx - dx)}" y1="${n(cy - dy)}" x2="${n(cx + dx)}" y2="${n(cy + dy)}"><stop offset="0" stop-color="${esc(s0.c)}" stop-opacity="${n(s0.o ?? 1)}"/><stop offset="1" stop-color="${esc(s1.c)}" stop-opacity="${n(s1.o ?? 1)}"/></linearGradient>`)
    fill = `fill="url(#${id})"`
  }
  const stroke = layer.stroke && layer.strokeWidth ? ` ${fillAttr(layer.stroke, 'stroke')} stroke-width="${n(layer.strokeWidth)}"` : ''
  return `<path d="${rectPath(layer.x, layer.y, layer.w, layer.h, layer.radius)}" ${fill}${stroke}/>`
}

function layerSvg(defs: Defs, layer: Layer, image: (src: string) => SvgImage | undefined) {
  let body = ''
  if (layer.type === 'text') body = textSvg(layer)
  else if (layer.type === 'image') body = imageSvg(defs, layer, image)
  else if (layer.type === 'ring') body = `<ellipse cx="${n(layer.x + layer.w / 2)}" cy="${n(layer.y + layer.h / 2)}" rx="${n(layer.w / 2)}" ry="${n(layer.h / 2)}" fill="none" ${fillAttr(layer.stroke, 'stroke')} stroke-width="${n(layer.strokeWidth)}"/>`
  else if (layer.type === 'dots') {
    const id = defs.id('p')
    const clip = defs.id('c')
    defs.items.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" x="${n(layer.x)}" y="${n(layer.y)}" width="${n(layer.gap)}" height="${n(layer.gap)}"><rect x="${n(layer.gap / 2 - layer.dot / 2)}" y="${n(layer.gap / 2 - layer.dot / 2)}" width="${n(layer.dot)}" height="${n(layer.dot)}" ${fillAttr(layer.color)}/></pattern>`)
    defs.items.push(`<clipPath id="${clip}"><rect x="${n(layer.x)}" y="${n(layer.y)}" width="${n(layer.w)}" height="${n(layer.h)}"/></clipPath>`)
    body = `<rect x="${n(layer.x)}" y="${n(layer.y)}" width="${n(layer.w)}" height="${n(layer.h)}" fill="url(#${id})" clip-path="url(#${clip})"/>`
  } else body = shapeSvg(defs, layer)
  const attrs: string[] = []
  if ((layer.opacity ?? 1) < 1) attrs.push(`opacity="${n(layer.opacity ?? 1)}"`)
  if (layer.rotation) {
    const b = layerBox(layer)
    attrs.push(`transform="rotate(${n(layer.rotation)} ${n(b.x + b.w / 2)} ${n(b.y + b.h / 2)})"`)
  }
  return attrs.length ? `<g ${attrs.join(' ')}>${body}</g>` : body
}

/** O slide inteiro em SVG, no tamanho real do formato. */
export function slideToSvg(slide: Slide, format: FormatId, image: (src: string) => SvgImage | undefined = () => undefined): string {
  const { width, height } = sizeOf(format)
  const defs = new Defs()
  const body = slide.layers.filter((l) => !l.hidden).map((l) => layerSvg(defs, l, image)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs.items.join('')}</defs><rect width="${width}" height="${height}" ${fillAttr(slide.background)}/>${body}</svg>`
}

/** Os endereços de imagem que o slide usa (para o servidor baixar antes de montar o SVG). */
export const slideImages = (slide: Slide) => slide.layers.filter((l): l is ImageLayer => l.type === 'image' && !l.hidden && !!l.src).map((l) => l.src)
