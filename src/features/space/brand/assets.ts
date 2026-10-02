import { parseDocument, isMap, isSeq, type Document } from 'yaml'

/**
 * Logo e banco de fotos da marca, escritos no front matter do DESIGN.md:
 *
 *   logo:
 *     on-light: /brands/processbase/logo/processbase-logo.svg
 *     on-dark: /brands/processbase/logo/processbase-logo-reverse.svg
 *     symbol: /brands/processbase/logo/processbase-symbol.svg
 *     symbol-on-dark: /brands/processbase/logo/processbase-symbol-reverse.svg
 *     alt: ProcessBase
 *   photos:
 *     - url: https://exemplo.com/fabrica.jpg
 *       alt: Equipe na linha de produção
 *
 * Os endereços podem ser URL, caminho do site (/brands/...) ou data URL. O logo
 * substitui o logo do site nas seções; as fotos ficam guardadas com a marca.
 */

export type LogoVariant = 'onLight' | 'onDark' | 'symbol' | 'symbolOnDark'

export const LOGO_VARIANTS: LogoVariant[] = ['onLight', 'onDark', 'symbol', 'symbolOnDark']

/** Chave de cada versão no DESIGN.md. */
export const LOGO_KEYS: Record<LogoVariant, string> = {
  onLight: 'on-light',
  onDark: 'on-dark',
  symbol: 'symbol',
  symbolOnDark: 'symbol-on-dark',
}

export const LOGO_LABELS: Record<LogoVariant, string> = {
  onLight: 'Fundo claro',
  onDark: 'Fundo escuro',
  symbol: 'Símbolo',
  symbolOnDark: 'Símbolo no escuro',
}

export interface BrandLogo {
  onLight?: string
  onDark?: string
  symbol?: string
  symbolOnDark?: string
  alt?: string
  /** Largura ÷ altura de cada arquivo, medida no navegador ao carregar a marca. */
  ratios?: Partial<Record<LogoVariant, number>>
}

export interface BrandPhoto {
  url: string
  alt?: string
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

const ALIASES: [RegExp, LogoVariant][] = [
  [/^(symbol|simbolo|símbolo|emblema|emblem|mark|icon|icone|ícone)[-_ ]?(on[-_ ]?dark|dark|reverse|reverso|inverse|negativo|negative|white|branco)$/i, 'symbolOnDark'],
  [/^(symbol|simbolo|símbolo|emblema|emblem|mark|icon|icone|ícone)$/i, 'symbol'],
  [/^(on[-_ ]?dark|dark[-_ ]?(bg|background)|reverse|reverso|inverse|negativo|negative|white|branco|sobre[-_ ]escuro)$/i, 'onDark'],
  [/^(on[-_ ]?light|light[-_ ]?(bg|background)|default|padrao|padrão|primary|principal|main|horizontal|full|sobre[-_ ]claro|url|src)$/i, 'onLight'],
]

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** `logo:` do arquivo: um endereço só ou um mapa de versões. */
export function readLogo(value: unknown): BrandLogo | undefined {
  const single = text(value)
  if (single) return { onLight: single }
  if (!isObj(value)) return undefined
  const logo: BrandLogo = {}
  for (const [key, raw] of Object.entries(value)) {
    if (/^(alt|name|nome|label)$/i.test(key)) {
      logo.alt = text(raw) ?? logo.alt
      continue
    }
    const variant = ALIASES.find(([re]) => re.test(key))?.[1]
    const url = text(raw) ?? (isObj(raw) ? text(raw.url ?? raw.src) : undefined)
    if (variant && url) logo[variant] ??= url
  }
  return LOGO_VARIANTS.some((v) => logo[v]) ? logo : undefined
}

/** `photos:` do arquivo: lista de endereços ou de `{ url, alt }`. */
export function readPhotos(value: unknown): BrandPhoto[] {
  if (!Array.isArray(value)) return []
  const photos: BrandPhoto[] = []
  for (const item of value) {
    const url = text(item) ?? (isObj(item) ? text(item.url ?? item.src) : undefined)
    if (!url || photos.some((p) => p.url === url)) continue
    const alt = isObj(item) ? text(item.alt ?? item.description) : undefined
    photos.push(alt ? { url, alt } : { url })
  }
  return photos
}

/** Caminho do site (/brands/...) vira URL completa: o preview, o HTML baixado e o envio ao WordPress precisam dela. */
export function assetUrl(url: string): string {
  if (!url.startsWith('/') || url.startsWith('//')) return url
  const origin = typeof window !== 'undefined' ? window.location?.origin : undefined
  return origin && origin !== 'null' ? `${origin}${url}` : url
}

// ---------------------------------------------------------------------------
// Edição do front matter pela tela da marca

const FRONT_MATTER = /^(\s*---\r?\n)([\s\S]*?)(\r?\n---[ \t]*)(\r?\n[\s\S]*)?$/

/** Aplica `edit` ao YAML do front matter, mantendo o resto do arquivo. Null se não houver front matter. */
function editFrontMatter(source: string, edit: (doc: Document) => void): string | null {
  const m = source.match(FRONT_MATTER)
  if (!m) return null
  const doc = parseDocument(m[2])
  if (doc.errors.length) return null
  edit(doc)
  const yaml = doc.toString({ lineWidth: 0 }).replace(/\n+$/, '')
  return `${m[1]}${yaml}${m[3]}${m[4] ?? ''}`
}

/** Troca (ou tira, com `url` vazio) uma versão do logo. */
export function setLogoVariant(source: string, variant: LogoVariant, url: string | null): string | null {
  return editFrontMatter(source, (doc) => {
    const current = doc.get('logo', true)
    // `logo: url` vira mapa para caber as outras versões
    if (!isMap(current)) {
      const single = typeof doc.get('logo') === 'string' ? String(doc.get('logo')) : undefined
      doc.set('logo', doc.createNode(single ? { [LOGO_KEYS.onLight]: single } : {}))
    }
    const logo = doc.get('logo', true)
    if (!isMap(logo)) return
    // Some a chave com outro nome que já apontava para a mesma versão
    for (const pair of [...logo.items]) {
      const key = String((pair.key as { value?: unknown })?.value ?? pair.key)
      if (ALIASES.find(([re]) => re.test(key))?.[1] === variant) logo.delete(key)
    }
    if (url) logo.set(LOGO_KEYS[variant], url)
    if (!logo.items.length) doc.delete('logo')
  })
}

export function addPhoto(source: string, photo: BrandPhoto): string | null {
  return editFrontMatter(source, (doc) => {
    const photos = doc.get('photos', true)
    const node = doc.createNode(photo.alt ? photo : photo.url)
    if (isSeq(photos)) photos.add(node)
    else doc.set('photos', doc.createNode([photo.alt ? photo : photo.url]))
  })
}

export function removePhoto(source: string, url: string): string | null {
  return editFrontMatter(source, (doc) => {
    const photos = doc.get('photos', true)
    if (!isSeq(photos)) return
    // A tela mostra o endereço completo; o guia pode ter o caminho do site
    const index = (photos.toJSON() as unknown[]).findIndex((item) => {
      const photo = readPhotos([item])[0]
      return !!photo && (photo.url === url || assetUrl(photo.url) === url)
    })
    if (index >= 0) photos.delete(index)
    if (!photos.items.length) doc.delete('photos')
  })
}

/**
 * O guia para levar a outro agente: logo e fotos com o endereço completo, que
 * abre fora do Space. Sem front matter (ou com YAML inválido) sai como está.
 */
export function withFullAssetUrls(source: string): string {
  const full = (v: unknown) => (typeof v === 'string' ? assetUrl(v) : v)
  return (
    editFrontMatter(source, (doc) => {
      const logo = doc.get('logo', true)
      if (isMap(logo)) for (const pair of logo.items) pair.value = doc.createNode(full((pair.value as { value?: unknown } | null)?.value ?? pair.value))
      else if (typeof doc.get('logo') === 'string') doc.set('logo', full(doc.get('logo')))
      for (const key of ['photos', 'fotos']) {
        const photos = doc.get(key, true)
        if (!isSeq(photos)) continue
        photos.items = photos.items.map((item) => {
          const value = (item as { toJSON?: () => unknown }).toJSON?.() ?? item
          if (typeof value === 'string') return doc.createNode(assetUrl(value))
          if (value && typeof value === 'object') {
            const photo = value as Record<string, unknown>
            return doc.createNode({ ...photo, ...(photo.url ? { url: full(photo.url) } : {}), ...(photo.src ? { src: full(photo.src) } : {}) })
          }
          return item
        }) as typeof photos.items
      }
    }) ?? source
  )
}

// ---------------------------------------------------------------------------
// Medida dos arquivos do logo

const SVG_TYPE = /^data:image\/svg\+xml|\.svg(\?|#|$)/i

/** Proporção de um SVG pelo `width`/`height` ou pelo `viewBox`. */
function svgRatio(svg: string): number | null {
  const tag = svg.match(/<svg\b[^>]*>/i)?.[0]
  if (!tag) return null
  const attr = (name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]
  const w = parseFloat(attr('width') ?? '')
  const h = parseFloat(attr('height') ?? '')
  if (w > 0 && h > 0 && !/%/.test(`${attr('width')}${attr('height')}`)) return w / h
  const box = attr('viewBox')?.trim().split(/[\s,]+/).map(Number)
  return box && box.length === 4 && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : null
}

function imageRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Largura ÷ altura de um arquivo de logo; null se não carregar. */
export async function measureLogo(url: string): Promise<number | null> {
  if (SVG_TYPE.test(url)) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const ratio = svgRatio(await response.text())
        if (ratio) return ratio
      }
    } catch {
      // Sem leitura do arquivo, a imagem ainda pode dizer o tamanho
    }
  }
  return imageRatio(url)
}
