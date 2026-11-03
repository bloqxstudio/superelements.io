/**
 * Prévia dos criativos para o chat da IA: os modelos do editor (`_gerado/criativos.js`) montam os
 * slides com a medida de texto feita aqui (opentype.js sobre as mesmas fontes do Google Fonts que o
 * navegador usa), o slide vira SVG e o resvg rasteriza em PNG. Sem imports: a função (Deno) e o teste
 * (Node) entregam o opentype e o Resvg.
 */

export interface FontLib {
  parse: (buffer: ArrayBuffer) => { getAdvanceWidth: (text: string, size: number, options?: Record<string, unknown>) => number }
}
export interface ResvgLike {
  new (svg: string, options: Record<string, unknown>): { render: () => { asPng: () => Uint8Array } }
}

interface Face {
  weight: number
  italic: boolean
  bytes: Uint8Array
  font: ReturnType<FontLib['parse']>
}

const faces = new Map<string, Promise<Face[]>>()
const UA = 'curl/8.4.0' // o Google Fonts responde TTF (o resvg e o opentype não leem woff2)

async function fetchFamily(lib: FontLib, family: string): Promise<Face[]> {
  const q = encodeURIComponent(family).replace(/%20/g, '+')
  const specs = [':ital,wght@0,400;0,500;0,600;0,700;0,800;1,400', ':wght@400;500;600;700;800', ':ital@0;1', '']
  let css = ''
  for (const spec of specs) {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${q}${spec}`, { headers: { 'user-agent': UA } })
    if (res.ok) {
      css = await res.text()
      break
    }
  }
  const blocks = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1])
  const wanted = blocks
    .map((b) => ({ italic: /font-style:\s*italic/.test(b), weight: Number(/font-weight:\s*(\d+)/.exec(b)?.[1] ?? 400), url: /url\(([^)]+\.ttf)\)/.exec(b)?.[1], latin: !/unicode-range/.test(b) || /U\+0000-00FF/.test(b) }))
    .filter((f) => f.url && f.latin)
  const seen = new Set<string>()
  const out: Face[] = []
  await Promise.all(
    wanted.map(async (f) => {
      const key = `${f.weight}-${f.italic}`
      if (seen.has(key)) return
      seen.add(key)
      const res = await fetch(f.url!)
      if (!res.ok) return
      const buf = await res.arrayBuffer()
      try {
        out.push({ weight: f.weight, italic: f.italic, bytes: new Uint8Array(buf), font: lib.parse(buf) })
      } catch {
        // fonte que o opentype não lê: fica sem ela
      }
    })
  )
  return out
}

export function loadFamilies(lib: FontLib, families: string[]) {
  return Promise.all(
    [...new Set(families.map((f) => f.trim()).filter(Boolean))].map((family) => {
      let p = faces.get(family)
      if (!p) {
        p = fetchFamily(lib, family).catch(() => [])
        faces.set(family, p)
      }
      return p.then((list) => ({ family, list }))
    })
  )
}

const pick = (list: Face[], weight: number, italic: boolean) =>
  [...list].sort((a, b) => (a.italic === italic ? 0 : 1000) - (b.italic === italic ? 0 : 1000) + Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0]

/** Um contexto que só mede texto, com a mesma interface que os modelos usam do canvas. */
export function measureContext(families: Map<string, Face[]>, fallback = 'Inter') {
  const state = { font: '', letterSpacing: '0px' }
  const stack: (typeof state)[] = []
  const ctx = {
    get font() { return state.font },
    set font(v: string) { state.font = v },
    get letterSpacing() { return state.letterSpacing },
    set letterSpacing(v: string) { state.letterSpacing = v },
    textBaseline: 'alphabetic',
    textAlign: 'left',
    save() { stack.push({ ...state }) },
    restore() { Object.assign(state, stack.pop() ?? state) },
    measureText(text: string) {
      const m = /^(italic\s+)?(\d+)\s+([\d.]+)px\s+"([^"]+)"/.exec(state.font)
      const italic = !!m?.[1]
      const weight = Number(m?.[2] ?? 400)
      const size = Number(m?.[3] ?? 16)
      const list = families.get(m?.[4] ?? '')?.length ? families.get(m![4])! : families.get(fallback) ?? []
      const face = pick(list, weight, italic)
      const spacing = parseFloat(state.letterSpacing) || 0
      const base = face ? face.font.getAdvanceWidth(text, size, { kerning: true }) : text.length * size * 0.55
      return { width: base + spacing * [...text].length }
    },
  }
  return ctx
}

// ---------- imagens ----------

const b64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
export const toBase64 = b64

/** Tipo e tamanho de PNG, JPEG, GIF, WebP ou SVG, lidos do cabeçalho. */
export function sniff(bytes: Uint8Array): { mime: string; width: number; height: number } | undefined {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { mime: 'image/png', width: dv.getUint32(16), height: dv.getUint32(20) }
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return { mime: 'image/gif', width: dv.getUint16(6, true), height: dv.getUint16(8, true) }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) { i++; continue }
      const marker = bytes[i + 1]
      const len = dv.getUint16(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { mime: 'image/jpeg', height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) }
      i += 2 + len
    }
    return undefined
  }
  if (String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') {
    const chunk = String.fromCharCode(...bytes.subarray(12, 16))
    if (chunk === 'VP8X') return { mime: 'image/webp', width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) }
    if (chunk === 'VP8L') { const b = dv.getUint32(21, true); return { mime: 'image/webp', width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) } }
    if (chunk === 'VP8 ') return { mime: 'image/webp', width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff }
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 600))
  if (/<svg/i.test(head)) {
    const vb = /viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/.exec(head)
    const w = Number(/\swidth="([\d.]+)/.exec(head)?.[1] ?? vb?.[1] ?? 0)
    const h = Number(/\sheight="([\d.]+)/.exec(head)?.[1] ?? vb?.[2] ?? 0)
    if (w && h) return { mime: 'image/svg+xml', width: w, height: h }
  }
  return undefined
}

export function rasterize(Resvg: ResvgLike, svg: string, fontBytes: Uint8Array[], width: number): Uint8Array {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { fontBuffers: fontBytes, loadSystemFonts: false, defaultFontFamily: 'Inter' }, imageRendering: 0, shapeRendering: 2, textRendering: 1 })
  return r.render().asPng()
}
