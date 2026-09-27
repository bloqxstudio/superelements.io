import { parse as parseYaml } from 'yaml'
import { LOGO_KEYS, LOGO_VARIANTS, readLogo, readPhotos, type BrandLogo, type BrandPhoto } from './assets'
import { toHex } from './color'
import { googleFont } from './googleFonts'
import { filterCss, LayerCollector, type BrandLayers, type ButtonSpec } from './layers'
import {
  lengthPx,
  parseLength,
  parseLetterSpacing,
  parseLineHeight,
  parseTransform,
  parseWeight,
  shadowCss,
  strokeCss,
  type Stroke,
  type TextTransform,
} from './values'

/**
 * Lê guias de marca escritos de qualquer jeito comum e devolve um rascunho no
 * modelo do Space (cores, fonte de título e de texto, cantos e as regras em
 * texto), que `toDesignMd` escreve de volta como o DESIGN.md do Space.
 *
 * Formatos: o próprio modelo do Space, front matter no estilo do Google Stitch
 * (typography, rounded, components, referências {colors.x}), design tokens em
 * JSON (W3C, Style Dictionary, Tokens Studio) ou YAML, variáveis CSS (shadcn,
 * Tailwind v4) e Markdown em texto livre, com tabelas, listas e blocos de código.
 */

export type DesignFormat = 'space' | 'stitch' | 'front-matter' | 'tokens-json' | 'yaml' | 'css' | 'markdown'

export const FORMAT_LABELS: Record<DesignFormat, string> = {
  space: 'modelo do Space',
  stitch: 'DESIGN.md do Google Stitch',
  'front-matter': 'Markdown com front matter',
  'tokens-json': 'design tokens em JSON',
  yaml: 'design tokens em YAML',
  css: 'variáveis CSS',
  markdown: 'guia de marca em Markdown',
}

type ColorRole = 'background' | 'surface' | 'text' | 'muted' | 'primary' | 'secondary' | 'accent'
/** `minor`: fonte de apoio (texto legal, fallback) que não disputa título nem texto. */
type FontRole = 'heading' | 'body' | 'label' | 'minor'

export interface DraftColor {
  name: string
  hex: string
  /** Nome que o arquivo dava à cor, quando `name` virou o papel dela. */
  label?: string
  role?: ColorRole
}

export interface DraftFont {
  family: string
  weight?: number
  transform?: TextTransform
  /** em */
  letterSpacing?: number
  lineHeight?: number
  /** Fonte do arquivo, quando trocada por uma substituta do Google Fonts. */
  original?: string
}

export interface DesignDraft {
  name?: string
  description?: string
  colors: DraftColor[]
  fonts: { heading?: DraftFont; body?: DraftFont; label?: DraftFont }
  radius: { card?: string; button?: string; input?: string; image?: string }
  layers: BrandLayers
  logo?: BrandLogo
  /** Banco de fotos da marca. */
  photos: BrandPhoto[]
  /** Regras em texto: voz, princípios, o que fazer e o que evitar. */
  body: string
}

export interface DesignRead {
  draft: DesignDraft
  format: DesignFormat
  /** O que a conversão fez ou deixou de fora. */
  notes: string[]
  error?: string
}

// ---------------------------------------------------------------------------
// Utilitários

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 4)
    .join('-')

const firstClause = (text = '') => text.split(/[,;(—–]|\s-\s/)[0].trim()

const NEGATED = /\b(n[aã]o|nunca|evite|evitar|jamais|not|never|avoid|don'?t)\b/i

const ROLE_PATTERNS: [ColorRole, RegExp][] = [
  ['background', /\b(fundo|background|bg|canvas|page)\b/i],
  ['surface', /\b(superf[ií]cies?|surfaces?|cards?|cart[aã]o|cart[oõ]es|panels?|pain[eé]is|painel|paper|papel)\b/i],
  ['text', /\b(texto|textos|text|foreground|ink|tinta)\b/i],
  ['muted', /\b(muted|neutr[ao]s?|sutil|subtle)\b/i],
  ['primary', /\b(prim[aá]ri[ao]|primary|principal|brand|marca)\b/i],
  ['secondary', /\b(secund[aá]ri[ao]|secondary)\b/i],
  ['accent', /\b(acento|accent|destaque|highlight|cta)\b/i],
]

/** Papel da cor pela palavra-chave que aparece primeiro no texto. */
function colorRole(text?: string): ColorRole | undefined {
  if (!text) return undefined
  let best: { role: ColorRole; index: number } | undefined
  for (const [role, re] of ROLE_PATTERNS) {
    const m = re.exec(text)
    if (m && (!best || m.index < best.index)) best = { role, index: m.index }
  }
  return best?.role
}

const HEADING_WORDS = /\b(display|headlines?|headings?|titles?|t[ií]tulos?|hero|banners?|h[1-3])\b/i
const BODY_WORDS = /\b(body|text|texto|textos|corpo|paragraphs?|par[aá]grafos?|copy|nav|ui|interface|leitura|reading)\b/i

const MINOR_WORDS = /\b(fallback|legal|disclaimers?|compliance|footnotes?|rodap[eé] legal)\b/i
const LABEL_WORDS = /\b(labels?|eyebrows?|overlines?|captions?|legendas?|r[oó]tulos?|micro|kicker|tags?)\b/i
const LABEL_KEY = /^(label|eyebrow|overline|caption|micro|kicker|tag|button|btn)/i

function fontRole(text?: string): FontRole | undefined {
  if (!text) return undefined
  if (MINOR_WORDS.test(text)) return 'minor'
  const h = HEADING_WORDS.exec(text)
  const b = BODY_WORDS.exec(text)
  if (h && (!b || h.index <= b.index)) return 'heading'
  if (b) return 'body'
  return LABEL_WORDS.test(text) ? 'label' : undefined
}

const GENERIC_FAMILIES = /^(sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont|inherit|initial)$/i

/** "'Editorial New', ui-sans-serif, ..." → Editorial New */
function cleanFamily(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value.find((v) => typeof v === 'string') : value
  if (typeof raw !== 'string') return undefined
  const family = raw.split(',')[0].trim().replace(/^["'`]+|["'`]+$/g, '').trim()
  if (!family || GENERIC_FAMILIES.test(family) || /^\d|px$|rem$|em$|^var\(|^\{/.test(family)) return undefined
  return family
}

const NOT_FAMILIES = new Set(
  'a as o os um uma com em para use usar sem sempre nunca the with and for in on at of type scale escala sizes tamanhos pesos weights role papel substitute títulos titulos textos corpo body headings heading display regular bold light medium serif sans'.split(' ')
)

/** Nome de família no começo do texto: palavras com inicial maiúscula. */
function leadingFamily(text: string): string | undefined {
  const m = text.replace(/^[\s`"'*_]+/, '').match(/^([A-Z][A-Za-z0-9]*(?:[ -][A-Z0-9][A-Za-z0-9]*)*)/)
  const family = m?.[1].trim()
  if (!family || NOT_FAMILIES.has(family.toLowerCase())) return undefined
  return family
}

const CARD_WORDS = /\b(cards?|cart[aã]o|cart[oõ]es|superf\w*|surfaces?|panels?|pain\w*|containers?|tiles?|imagens?|editoria\w*|lg|large|xl)\b/i
const BUTTON_WORDS = /\b(buttons?|bot[aã]o|bot[oõ]es|btn|cta|pills?)\b/i

// ---------------------------------------------------------------------------
// Coleta: cores, fontes e cantos, sem repetição

interface CollectedFont {
  family: string
  weight?: number
  role?: FontRole
  substitutes?: { family: string; weight?: number }[]
  /** Chave de onde veio (ex.: "heading-section"), para escolher o tratamento mais típico do papel. */
  key?: string
  /** "The only typeface": vale para título e texto. */
  only?: boolean
  /** Peso tirado de uma lista ("400, 500"); cede ao peso que o texto do guia atribui ao papel. */
  weightFromList?: boolean
  transform?: TextTransform
  letterSpacing?: number
  lineHeight?: number
}

class Collected {
  colors: DraftColor[] = []
  fonts: CollectedFont[] = []
  radius: { card?: string; button?: string; cardHint?: string; buttonHint?: string } = {}
  layers = new LayerCollector()
  notes: string[] = []

  private uniqueName(base: string, self?: DraftColor) {
    let name = base || 'cor'
    for (let i = 2; this.colors.some((c) => c !== self && c.name === name); i++) name = `${base}-${i}`
    return name
  }

  /**
   * Cor com nome dado pelo arquivo (chave de token, variável CSS). O papel
   * serve só de informação.
   */
  addToken(hex: string | null, path: string[]) {
    if (!hex || this.colors.some((c) => c.hex === hex)) return
    const name = slug(path.filter((p) => !/^(colou?rs?|cores|palette|paleta|color-?tokens)$/i.test(p)).join('-'))
    this.colors.push({ name: this.uniqueName(name || hex.slice(1)), hex, role: colorRole(path.join(' ')) })
  }

  /**
   * Cor citada no texto ("Fundo mineral: #F3F0E9", linha de tabela). Vira o
   * nome do papel quando o texto indica um que ainda não foi usado.
   */
  addLabeled(hex: string | null, label: string, roleText?: string) {
    if (!hex) return
    const text = firstClause(label)
    const role = colorRole(text) ?? colorRole(firstClause(roleText)) ?? colorRole(roleText)
    const free = role && !this.colors.some((c) => c.role === role) ? role : undefined
    const existing = this.colors.find((c) => c.hex === hex)
    if (existing) {
      if (!existing.role && free) {
        existing.label ??= existing.name
        existing.role = free
        existing.name = this.uniqueName(free, existing)
      }
      return
    }
    const label5 = text.split(/\s+/).slice(0, 5).join(' ')
    this.colors.push({
      name: this.uniqueName(free ?? (slug(label5) || hex.slice(1))),
      hex,
      label: label5 || undefined,
      role: free,
    })
  }

  addFont(font: CollectedFont) {
    if (font.family) this.fonts.push(font)
    return font
  }

  setRadius(kind: 'card' | 'button' | 'cardHint' | 'buttonHint', value: string | undefined) {
    if (value && !this.radius[kind]) this.radius[kind] = value
  }

  get found() {
    return this.colors.length > 0 || this.fonts.length > 0
  }
}

// ---------------------------------------------------------------------------
// Objetos (front matter, JSON, YAML)

const COLOR_SECTION = /^(colors?|colou?rs?|cores|cor|palette|paleta|color-?palette|colou?r-?tokens)$/i
const FONT_SECTION = /^(fonts?|fontes?|typography|tipografia|typefaces?|font-?famil(y|ies))$/i
const RADIUS_SECTION = /^(rounded|radius|radii|border-?radius|corners?|cantos|shapes?)$/i
const COMPONENT_SECTION = /^(components?|componentes)$/i
const KNOWN_TOP = /^(name|title|description|voice|guidelines|version|\$schema|brand|meta|theme|tokens|extend|logo|photos|fotos)$/i
const LAYER_TOP = /^(buttons|cards?|inputs?|dividers?|shadows?|elevation|images|imagery|motion|animations?|transitions|effects)$/i

/** Primeira chave (em largura, até 3 níveis) cujo nome casa com `re`. */
function findSection(root: Obj, re: RegExp): unknown {
  let level: Obj[] = [root]
  for (let depth = 0; depth <= 3 && level.length; depth++) {
    const next: Obj[] = []
    for (const obj of level) {
      for (const [k, v] of Object.entries(obj)) {
        if (re.test(k)) return v
        if (isObj(v) && !COMPONENT_SECTION.test(k)) next.push(v)
      }
    }
    level = next
  }
  return undefined
}

const tokenValue = (v: unknown) => (isObj(v) && ('$value' in v || 'value' in v) ? (v.$value ?? v.value) : v)

function lookup(root: unknown, path: string[]): unknown {
  let cur = root
  for (const p of path) {
    if (!isObj(cur)) return undefined
    cur = cur[p]
  }
  return cur
}

/**
 * Resolve referências {colors.primary} / {color.base.red} do próprio arquivo,
 * a partir da raiz ou de um conjunto de tokens (o "global" do Tokens Studio).
 */
function resolve(value: unknown, root: unknown, depth = 0): unknown {
  const v = tokenValue(value)
  const ref = typeof v === 'string' ? v.match(/^\{([^}]+)\}$/)?.[1] : undefined
  if (ref && depth < 6) {
    const path = ref.split('.')
    const sets = isObj(root) ? Object.values(root) : []
    const target = [root, ...sets].map((base) => lookup(base, path)).find((t) => t !== undefined)
    if (target !== undefined) return resolve(target, root, depth + 1)
  }
  return v
}

const hasTokenSections = (data: unknown): boolean =>
  isObj(data) && [COLOR_SECTION, FONT_SECTION].some((re) => findSection(data, re) !== undefined)

function collectColors(node: unknown, path: string[], out: Collected, root: unknown) {
  const value = resolve(node, root)
  if (typeof value === 'string' || typeof value === 'number') return out.addToken(toHex(String(value)), path)
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (isObj(item) && typeof item.name === 'string') {
        collectColors(item.hex ?? item.value ?? item.$value ?? item.color, [...path, item.name], out, root)
      } else collectColors(item, [...path, String(i + 1)], out, root)
    })
    return
  }
  if (!isObj(value)) return
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('$') || /^(type|description|comment)$/i.test(k)) continue
    collectColors(v, k === 'DEFAULT' ? path : [...path, k], out, root)
  }
}

/** Tokens com tipo (W3C/Style Dictionary) em qualquer lugar do arquivo. */
function scanTyped(node: unknown, path: string[], visit: (type: string, value: unknown, path: string[]) => void, inherited?: string) {
  if (!isObj(node)) return
  const type = typeof node.$type === 'string' ? node.$type : typeof node.type === 'string' ? node.type : inherited
  if ('$value' in node || ('value' in node && typeof node.type === 'string')) {
    if (type) visit(type, node.$value ?? node.value, path)
    return
  }
  for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) scanTyped(v, [...path, k], visit, type)
}

type FontFields = Pick<CollectedFont, 'weight' | 'transform' | 'letterSpacing' | 'lineHeight'> & { family?: string }

function fontFrom(value: unknown, root: unknown): FontFields {
  const v = resolve(value, root)
  if (typeof v === 'string' || Array.isArray(v)) return { family: cleanFamily(v) }
  if (!isObj(v)) return {}
  const family = resolve(v.family ?? v.fontFamily ?? v['font-family'] ?? v.font, root)
  const size = lengthPx(resolve(v.size ?? v.fontSize ?? v['font-size'], root))
  const letter = resolve(v.letterSpacing ?? v['letter-spacing'] ?? v.tracking, root)
  return {
    family: cleanFamily(family),
    weight: parseWeight(resolve(v.weight ?? v.fontWeight ?? v['font-weight'], root)),
    transform: parseTransform(resolve(v.transform ?? v.textTransform ?? v['text-transform'] ?? v.textCase ?? v.case, root)),
    // Número sem unidade é em (é como o modelo do Space escreve)
    letterSpacing: parseLetterSpacing(letter, size),
    lineHeight: parseLineHeight(resolve(v.lineHeight ?? v['line-height'] ?? v.leading, root), size),
  }
}

const fontKeyRole = (key: string): FontRole | undefined =>
  /^(primary|h[1-3])\b/i.test(key)
    ? 'heading'
    : /^(sans|base|p)$/i.test(key)
      ? 'body'
      : LABEL_KEY.test(key)
        ? 'label'
        : fontRole(key.replace(/[-_]/g, ' '))

function collectFonts(node: unknown, role: FontRole | undefined, out: Collected, root: unknown, depth = 0, key?: string) {
  const direct = fontFrom(node, root)
  if (direct.family) {
    out.addFont({ ...direct, family: direct.family, role, key })
    return
  }
  const value = resolve(node, root)
  if (!isObj(value) || depth > 2) return
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('$')) continue
    collectFonts(v, role ?? fontKeyRole(k), out, root, depth + 1, k)
  }
}

function collectRadius(node: unknown, out: Collected, root: unknown) {
  const value = resolve(node, root)
  const single = parseLength(value)
  if (single) {
    out.setRadius('cardHint', single)
    out.setRadius('buttonHint', single)
    return
  }
  if (!isObj(value)) return
  const entries = Object.entries(value).map(([k, v]) => [k, parseLength(resolve(v, root))] as const)
  for (const [k, len] of entries) {
    if (!len) continue
    if (/(input|field)/i.test(k) || /(image|media|photo)/i.test(k)) out.layers.radiusRow(k, len)
    else if (BUTTON_WORDS.test(k.replace(/[-_]/g, ' ')) && /(outline|ghost|secondary)/i.test(k)) out.layers.radiusRow(k, len)
    else if (BUTTON_WORDS.test(k.replace(/[-_]/g, ' '))) out.setRadius('button', len)
    else if (/^(card|cards|surface|panel)$/i.test(k)) out.setRadius('card', len)
  }
  const pick = (...keys: string[]) => keys.map((key) => entries.find(([k]) => k.toLowerCase() === key)?.[1]).find(Boolean)
  out.setRadius('cardHint', pick('lg', 'large', 'md', 'medium', 'xl', 'default', 'base'))
  out.setRadius('buttonHint', pick('md', 'medium', 'sm', 'small', 'default', 'base'))
}

interface ObjectInfo {
  name?: string
  /** Descrição e textos de voz que vieram como campo do arquivo. */
  description?: string
  logo?: BrandLogo
  photos?: BrandPhoto[]
}

function fromObject(root: unknown, out: Collected): ObjectInfo {
  if (!isObj(root)) return {}

  const colors = findSection(root, COLOR_SECTION)
  if (colors !== undefined) collectColors(colors, [], out, root)

  const typedFonts: CollectedFont[] = []
  scanTyped(root, [], (type, value, path) => {
    if (colors === undefined && /^colou?r$/i.test(type)) out.addToken(toHex(String(resolve(value, root))), path)
    if (/^(typography|fontFamily|fontFamilies)$/i.test(type)) {
      const font = fontFrom(value, root)
      const last = path[path.length - 1] ?? ''
      if (font.family) typedFonts.push({ ...font, family: font.family, key: last, role: fontKeyRole(last) ?? fontKeyRole(path.join(' ')) ?? fontRole(path.join(' ')) })
    }
    if (/^shadow$/i.test(type)) out.layers.cssVar('shadow', resolve(value, root))
    if (/^duration$/i.test(type)) out.layers.cssVar('duration', resolve(value, root))
    if (/^cubicBezier$/i.test(type)) out.layers.cssVar('easing', resolve(value, root))
  })
  if (typedFonts.length) typedFonts.forEach((f) => out.addFont(f))
  else {
    const fonts = findSection(root, FONT_SECTION)
    if (fonts !== undefined) collectFonts(fonts, undefined, out, root)
  }

  const radius = findSection(root, RADIUS_SECTION)
  if (radius !== undefined) collectRadius(radius, out, root)
  const components = findSection(root, COMPONENT_SECTION)
  if (isObj(components)) {
    for (const [name, comp] of Object.entries(components)) {
      if (!isObj(comp)) continue
      const len = parseLength(resolve(comp.rounded ?? comp.borderRadius ?? comp['border-radius'] ?? comp.radius, root))
      const words = name.replace(/[-_]/g, ' ')
      if (/\b(hover|active|focus|secondary|ghost|outline|outlined|link)\b/i.test(words)) continue
      if (BUTTON_WORDS.test(words)) out.setRadius('button', len)
      else if (CARD_WORDS.test(words)) out.setRadius('card', len)
    }
  }
  out.layers.fromObject({ ...root, components }, (v) => resolve(v, root))

  // Um conjunto de tokens que embrulha as seções (ex.: "global") não conta como ignorado
  const unused = Object.keys(root).filter(
    (k) =>
      !KNOWN_TOP.test(k) &&
      !LAYER_TOP.test(k) &&
      ![COLOR_SECTION, FONT_SECTION, RADIUS_SECTION, COMPONENT_SECTION].some((re) => re.test(k)) &&
      !hasTokenSections(root[k])
  )
  if (unused.length) out.notes.push(`Ficaram de fora, porque o Space ainda não usa: ${unused.join(', ')}.`)

  const text = (v: unknown) => {
    const value = tokenValue(v)
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
  const name = [root.name, root.title, isObj(root.brand) ? root.brand.name : root.brand, isObj(root.meta) ? root.meta.name : undefined]
    .map(text)
    .find(Boolean)
  const description = [root.description, root.voice, root.guidelines].map(text).filter(Boolean).join('\n\n') || undefined
  const brand = isObj(root.brand) ? root.brand : {}
  const logo = readLogo(root.logo ?? brand.logo)
  const photos = readPhotos(root.photos ?? root.fotos ?? brand.photos)
  return { name, description, logo, photos }
}

// ---------------------------------------------------------------------------
// CSS

const looksLikeCss = (text: string) => /--[\w-]+\s*:[^;{}]+;/.test(text) || /[^{}\n]+\{[^{}]*\b(color|font-family|background)\s*:/.test(text)

function fromCss(css: string, out: Collected) {
  const vars = new Map<string, string>()
  let repeated = false
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([\w-]+)\s*:\s*([^;{}]+)/g)) {
    if (vars.has(m[1])) repeated = true
    else vars.set(m[1], m[2].trim())
  }
  const expand = (value: string, depth = 0): string =>
    value.replace(/var\(--([\w-]+)(?:\s*,[^)]*)?\)/g, (all, name) => (depth < 6 && vars.has(name) ? expand(vars.get(name)!, depth + 1) : all))

  for (const [name, raw] of vars) {
    const value = expand(raw)
    if (/radius|rounded/.test(name)) {
      const len = parseLength(value)
      const words = name.replace(/[-_]/g, ' ')
      if (/\b(inputs?|fields?|images?|media)\b/.test(words) || (BUTTON_WORDS.test(words) && /\b(outlined?|ghost|secondary)\b/.test(words))) {
        if (len) out.layers.radiusRow(words, len)
      } else if (/\bfull\b/.test(words) && len === '9999px') continue
      else if (BUTTON_WORDS.test(words)) out.setRadius('button', len)
      else if (/\b(cards?|surface|panel)\b/.test(words)) out.setRadius('card', len)
      else if (/\b(lg|xl|large)\b/.test(words)) out.setRadius('cardHint', len)
      else if (/\b(md|sm|medium|small)\b/.test(words)) out.setRadius('buttonHint', len)
      else {
        out.setRadius('cardHint', len)
        out.setRadius('buttonHint', len)
      }
      continue
    }
    if (/^(font|family|typeface)|-(font|family)(-|$)/.test(name)) {
      if (/size|weight|leading|tracking|height|spacing/.test(name)) continue
      const family = cleanFamily(value)
      const key = name.replace(/^font(-family)?-?/, '')
      if (family) out.addFont({ family, role: key ? fontKeyRole(key) : undefined })
      continue
    }
    // --leading-heading: 0.9 / --tracking-display: -0.02em (o tamanho vem de --text-<papel>)
    const scale = name.match(/^(leading|line-height|tracking|letter-spacing)-(.+)$/)
    if (scale) {
      const size = vars.get(`text-${scale[2]}`) ?? vars.get(`font-size-${scale[2]}`)
      const isLeading = /^(leading|line-height)$/.test(scale[1])
      out.layers.scaleRow(scale[2], size, isLeading ? value : undefined, isLeading ? undefined : value)
      continue
    }
    if (!/colou?r/.test(name) && /shadow|duration|motion|ease|blur|backdrop|glass/.test(name)) {
      out.layers.cssVar(name, value)
      continue
    }
    if (!/colou?r/.test(name) && /spacing|space|size|text-|leading|tracking|width|height|gap|z-index/.test(name)) continue
    out.addToken(toHex(value), [name.replace(/^(colou?rs?|clr|c)-/, '')])
  }

  // Regras: h1 { ... } é título, body { ... } é texto, .eyebrow { ... } é rótulo
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]
    const decl = (prop: string) => m[2].match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))?.[1].trim()
    const role: FontRole | undefined = /\bh[1-6]\b|heading|title|display|headline/.test(selector)
      ? 'heading'
      : /\b(body|html|p)\b|:root/.test(selector)
        ? 'body'
        : /eyebrow|label|overline|caption|kicker|\bbutton\b|\.btn/.test(selector)
          ? 'label'
          : undefined
    if (role === 'heading' || role === 'body' || role === 'label') {
      const size = lengthPx(decl('font-size'))
      out.layers.setText(role, {
        transform: parseTransform(decl('text-transform')),
        letterSpacing: parseLetterSpacing(decl('letter-spacing'), size),
        lineHeight: parseLineHeight(decl('line-height'), size),
      })
    }
    const family = decl('font-family')
    if (!family) continue
    const clean = cleanFamily(expand(family))
    if (clean) out.addFont({ family: clean, role })
  }
  if (repeated) out.notes.push('Variáveis definidas mais de uma vez (tema escuro?): valeu a primeira definição.')
}

// ---------------------------------------------------------------------------
// Markdown em texto livre

const COLOR_LITERAL = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/g
const TYPOGRAPHY_HEADING = /typograph|tipograf|\bfonts?\b|\bfontes?\b|typefaces?/i
const RADIUS_HEADING = /radius|raios?\b|cantos|rounded|corners?|shapes?|formas/i
const SKIP_HEADING = /shadow|sombra|elevation|eleva[cç]|gradient|gradiente|imagery|imagens|similar|refer[eê]ncias|don'?ts?\b|evite|avoid|n[aã]o fa[cç]a/i
const NOT_A_FONT_HEADING = /\b(scale|escala|sizes?|tamanhos|hierarch\w*|hierarquia|pesos|weights|pairings?|combina\w*)\b/i
const ONLY_TYPEFACE = /\b(only|sole|single|[uú]nica)\s+(typeface|font|fonte|family|fam[ií]lia)\b/i
const COMPONENT_CONTEXT = /\b(components?|componentes)\b/i
const COMPONENT_HEADING = /\b(buttons?|bot[aã]o|bot[oõ]es|cards?|cart[aã]o|inputs?|fields?|campos?|dividers?|divisor(es)?|separators?)\b/i
const LAYER_SECTION = /elevation|eleva[cç]|shadows?|sombras?|depth|profundidade|surfaces?|superf[ií]cies|imagery|images?|imagens?|imagem|fotografia|photography|motion|animat|anima[cç]|movimento|transi|interac|intera[cç]|don'?t|evite|avoid|n[aã]o fa[cç]a/i

const FONT_LINE = /^\s*(?:[-*+]|\d+\.)?\s*\**\s*(tipografia|typography|fontes?|fonts?|typefaces?|fam[ií]lias?(?:\s+tipogr[aá]ficas?)?)\s*\**\s*[:：—–]\s*\**\s*(.+)$/i
const ROLE_LINE = /^\s*(?:[-*+]|\d+\.)?\s*\**\s*(t[ií]tulos?|headings?|headlines?|display|corpo|body|textos?|par[aá]grafos?)\s*\**\s*[:：—–]\s*\**\s*(.+)$/i
const RADIUS_LINE = /^\s*(?:[-*+]|\d+\.)?\s*\**\s*(cantos?|raios?|border[- ]radius|radius|rounded|arredondamento|corners?)\b[^:]{0,30}:\s*\**\s*(.+)$/i
const FIELD_LINE = /^\s*(?:[-*+])?\s*\**\s*([\wÀ-ú ]+?)\s*\**\s*:\s*\**\s*(.+)$/

const stripInline = (text: string) =>
  text
    .replace(/`[^`]*--[\w-]+[^`]*`/g, '')
    .replace(/[*_`~>]/g, '')
    .trim()

const cleanLabel = (text: string) =>
  stripInline(text)
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
    .replace(/[\s(:=\-–—|]+$/g, '')
    .trim()

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())
}

function fontsFromSentence(rest: string, out: Collected) {
  // "Fraunces para títulos e Inter para textos"
  const pairs = [...rest.matchAll(/([A-Z][A-Za-z0-9]*(?:[ -][A-Z0-9][A-Za-z0-9]*)*)\s*(?:\([^)]*\))?\s+(?:para|for|nos|nas|em|in|on)\s+(?:os\s+|as\s+|the\s+)?([a-zà-ú]+)/g)]
    .map((m) => ({ family: m[1], role: fontRole(m[2]) }))
    .filter((p) => p.role && !NOT_FAMILIES.has(p.family.toLowerCase()))
  if (pairs.length) {
    pairs.forEach((p) => out.addFont({ family: p.family, role: p.role }))
    return
  }
  const family = leadingFamily(rest)
  if (!family) return
  // "Manrope, com títulos pesados e compactos; textos regulares e arejados"
  const headingWeight = parseWeight(rest.match(/(t[ií]tulos?|headings?|headlines?|display)[^.;,]*/i)?.[0])
  const bodyWeight = parseWeight(rest.match(/(textos?|corpo|body|par[aá]grafos?)[^.;,]*/i)?.[0])
  if (headingWeight || bodyWeight) {
    out.addFont({ family, role: 'heading', weight: headingWeight })
    out.addFont({ family, role: 'body', weight: bodyWeight })
  } else out.addFont({ family })
}

function substitutesFrom(text: string) {
  return text
    .split(/\s*(?:,|;|\/|\bor\b|\bou\b)\s*/)
    .map((part) => ({ family: leadingFamily(part.replace(/\b(at|em|com|with)\b.*$/i, '').trim()) ?? '', weight: parseWeight(part) }))
    .filter((s) => s.family)
}

/** `context`: os títulos da seção até a raiz; `current`: o título mais próximo. */
function tableRows(lines: string[], context: string, current: string, out: Collected) {
  const rows = lines.map(splitRow).filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c) || !c))
  const [header, ...body] = rows
  if (!header || !body.length) return
  const col = (re: RegExp) => header.findIndex((h) => re.test(h))

  if (TYPOGRAPHY_HEADING.test(context)) {
    const family = col(/famil|^font|fonte/i)
    const role = col(/role|papel|uso|n[ií]vel|level|element|estilo|style|name|nome/i)
    const weight = col(/weight|peso/i)
    const size = col(/^(size|tamanho)/i)
    const leading = col(/line[- ]?height|leading|entrelinha/i)
    const tracking = col(/letter[- ]?spacing|tracking|espa[cç]amento/i)
    // "Line-height / tracking" numa coluna só: "1.1 / -0.03em"
    const cell = (cells: string[], i: number, part: 0 | 1) => {
      if (i < 0) return undefined
      const text = stripInline(cells[i] ?? '')
      return leading === tracking ? text.split(/\s*\/\s*/)[part] : text
    }
    for (const cells of body) {
      const name = family >= 0 ? leadingFamily(cells[family] ?? '') : undefined
      const px = lengthPx(cells[size])
      if (name) {
        out.addFont({
          family: name,
          role: fontRole(cells[role]),
          key: cells[role],
          weight: parseWeight(cells[weight]),
          lineHeight: parseLineHeight(cell(cells, leading, 0), px),
          letterSpacing: parseLetterSpacing(cell(cells, tracking, 1), px),
        })
      } else if (role >= 0 && (leading >= 0 || tracking >= 0)) {
        // Escala sem família por linha (o formato do Refero): só o tratamento do papel
        out.layers.scaleRow(stripInline(cells[role] ?? ''), stripInline(cells[size] ?? ''), cell(cells, leading, 0), cell(cells, tracking, 1))
      }
    }
    return
  }

  if (RADIUS_HEADING.test(current)) {
    for (const cells of body) {
      // O valor é a célula com número: "buttons-pill" no nome não quer dizer 9999px
      const len = parseLength(cells.slice(1).find((c) => /\d/.test(c)) ?? '')
      const element = stripInline(cells[0] ?? '')
      if (!len) continue
      if (/\b(full|round|circle|c[ií]rculo)\b/i.test(element) && len === '9999px') continue
      out.layers.radiusRow(element, len)
      if (/\b(outlined?|ghost|secondary|secund)/i.test(element)) continue
      if (BUTTON_WORDS.test(element.replace(/[-_]/g, ' '))) out.setRadius('button', len)
      else if (/\b(cards?|cart[oõ]es|surfaces?|panels?)\b/i.test(element)) out.setRadius('card', len)
    }
    return
  }

  const nameCol = col(/^(name|nome|nome da cor|color name)$/i)
  const roleCol = col(/role|papel|uso|usage|fun[cç][aã]o|purpose|prop[oó]sito|descri/i)
  for (const cells of body) {
    const colorIndex = cells.findIndex((c) => !!toHex(stripInline(c)))
    if (colorIndex < 0) continue
    const label =
      (nameCol >= 0 && nameCol !== colorIndex ? cells[nameCol] : undefined) ??
      cells.find((c, i) => i !== colorIndex && i !== roleCol && c && !/^[\d.]+$/.test(c) && !/^`?--/.test(c)) ??
      ''
    out.addLabeled(toHex(stripInline(cells[colorIndex])), cleanLabel(label), roleCol >= 0 ? stripInline(cells[roleCol] ?? '') : undefined)
  }
}

function fromMarkdown(markdown: string, out: Collected): { name?: string; body: string } {
  // Blocos de código com tokens (CSS, JSON, YAML) entram depois do texto, que dá nomes melhores
  const blocks: { raw: string; code: string }[] = []
  const prose = markdown.replace(/```[^\n]*\n([\s\S]*?)```/g, (raw, code: string) => {
    blocks.push({ raw, code })
    return '\n'
  })

  const lines = prose.split(/\r?\n/)
  const stack: { level: number; text: string }[] = []
  let font: CollectedFont | null = null
  // Texto abaixo do título atual: componentes e seções de elevação, imagem e movimento
  let block: { heading: string; parents: string; lines: string[] } | null = null
  const flushBlock = () => {
    const text = block?.lines.join('\n').trim()
    if (block && text) {
      const heading = stripInline(block.heading)
      if (COMPONENT_CONTEXT.test(block.parents) || COMPONENT_HEADING.test(heading)) out.layers.component(heading, text)
      else if (LAYER_SECTION.test(heading)) out.layers.section(heading, text)
    }
    block = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushBlock()
      const level = heading[1].length
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
      const inTypography = stack.some((s) => TYPOGRAPHY_HEADING.test(s.text))
      block = { heading: heading[2], parents: stack.map((s) => s.text).join(' / '), lines: [] }
      stack.push({ level, text: heading[2] })
      font = null
      // "### Editorial New — Body text, nav, links · `--font-editorial-new`"
      if (inTypography) {
        const text = stripInline(heading[2])
        const [familyPart, ...desc] = text.split(/\s+[—–-]\s+|\s+·\s+|:\s+|\s*\(/)
        const kebab = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(familyPart.trim()) ? familyPart.trim() : undefined
        const family = !NOT_A_FONT_HEADING.test(familyPart) && (leadingFamily(familyPart) ?? kebab)
        const description = desc.join(' ')
        if (family && family === familyPart.trim()) {
          font = out.addFont({ family, role: fontRole(description), only: ONLY_TYPEFACE.test(description) || undefined })
        }
      }
      continue
    }
    block?.lines.push(line)

    const context = stack.map((s) => s.text).join(' / ')
    const current = stack[stack.length - 1]?.text ?? ''

    if (/^\s*\|/.test(line)) {
      const table: string[] = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) table.push(lines[i++])
      i--
      if (!SKIP_HEADING.test(context)) tableRows(table, context, current, out)
      continue
    }

    if (font) {
      const field = line.match(FIELD_LINE)
      if (field) {
        const [, key, value] = field
        if (/^(weights?|pesos?)$/i.test(key.trim())) {
          font.weight ??= parseWeight(value)
          // "400, 500": a lista não diz qual peso é de título e qual é de texto
          if ((value.match(/\b[1-9]00\b/g) ?? []).length > 1) font.weightFromList = true
        }
        else if (/substitut|fallback|alternativ|similar/i.test(key)) font.substitutes = substitutesFrom(stripInline(value))
        else if (/^(role|papel|uso|usage)$/i.test(key.trim())) font.role ??= fontRole(value)
        continue
      }
    }

    const negated = NEGATED.test(line)

    const fontLine = !negated && line.match(FONT_LINE)
    if (fontLine) {
      fontsFromSentence(stripInline(fontLine[2]), out)
      continue
    }

    const roleLine = !negated && line.match(ROLE_LINE)
    if (roleLine) {
      const value = stripInline(roleLine[2])
      const family = leadingFamily(value)
      if (family && (TYPOGRAPHY_HEADING.test(context) || googleFont(family))) {
        out.addFont({ family, role: fontRole(roleLine[1]), weight: parseWeight(value.slice(family.length)) })
        continue
      }
    }

    const field = RADIUS_HEADING.test(current) ? line.match(FIELD_LINE) : null
    const radiusLine = !negated && (line.match(RADIUS_LINE) ?? (field && !/spac|espa[cç]|gap|unit|densi|padding|margin/i.test(field[1]) ? field : null))
    if (radiusLine) {
      for (const segment of radiusLine[2].split(/;|\.\s/)) {
        const len = parseLength(segment)
        if (!len) continue
        if (BUTTON_WORDS.test(segment) || BUTTON_WORDS.test(radiusLine[1])) out.setRadius('button', len)
        else out.setRadius(CARD_WORDS.test(segment) || CARD_WORDS.test(radiusLine[1]) ? 'card' : 'cardHint', len)
      }
      continue
    }

    if (SKIP_HEADING.test(context)) continue
    const literals = [...line.matchAll(COLOR_LITERAL)]
    if (!literals.length) continue
    const first = literals[0].index ?? 0
    const before = cleanLabel(line.slice(0, first))
    const after = cleanLabel(line.slice(first + literals[0][0].length).split(/[,.;(]/)[0] ?? '')
    const label = /[A-Za-zÀ-ú]/.test(before) ? before : after
    for (const literal of literals) {
      const hex = toHex(literal[0])
      // Cor nova citada numa regra negativa ("evite #FF0000") não entra na marca
      if (negated && !out.colors.some((c) => c.hex === hex)) continue
      out.addLabeled(hex, label)
    }
  }
  flushBlock()
  out.layers.voice(prose)

  let body = markdown
  for (const block of blocks) {
    const before = out.colors.length + out.fonts.length
    readCode(block.code, out)
    if (out.colors.length + out.fonts.length > before || /--[\w-]+\s*:/.test(block.code)) body = body.replace(block.raw, '')
  }

  const title = markdown.match(/^#\s+(.+)$/m)?.[1]
  const name = title ? stripInline(title).split(/\s+[—–-]\s+|:\s|\s\|\s/)[0].trim() : undefined
  return { name, body: dropEmptySections(body).replace(/\n{3,}/g, '\n\n').trim() }
}

/** Tira títulos que ficaram sem conteúdo (ex.: o "Quick Start" depois de sair o CSS). */
function dropEmptySections(markdown: string): string {
  const lines = markdown.split('\n')
  const level = (line: string) => line.match(/^(#{1,6})\s/)?.[1].length ?? 0
  return lines
    .filter((line, i) => {
      const own = level(line)
      if (!own) return true
      for (let j = i + 1; j < lines.length; j++) {
        const next = level(lines[j])
        if (next && next <= own) return false
        if (!next && lines[j].trim()) return true
      }
      return false
    })
    .join('\n')
}

/** Bloco de código ou arquivo estruturado: JSON, CSS ou YAML. */
function readCode(code: string, out: Collected): DesignFormat | null {
  const text = code.trim()
  if (/^[{[]/.test(text)) {
    try {
      fromObject(JSON.parse(text), out)
      return 'tokens-json'
    } catch {
      // não é JSON
    }
  }
  if (looksLikeCss(text)) {
    fromCss(text, out)
    return 'css'
  }
  try {
    const data = parseYaml(text)
    if (isObj(data) && [COLOR_SECTION, FONT_SECTION].some((re) => findSection(data, re) !== undefined)) {
      fromObject(data, out)
      return 'yaml'
    }
  } catch {
    // não é YAML
  }
  return null
}

// ---------------------------------------------------------------------------
// Resultado

/** O quanto uma chave de tipografia representa o papel ("heading-section" antes de "display-hero"). */
const treatmentPriority = (key = '') =>
  /^(heading|headline|h2)\b|section/i.test(key) ? 3 : /^(body|text|p)\b/i.test(key) ? 3 : /^(label|eyebrow)\b/i.test(key) ? 3 : /^(display|hero|h1)/i.test(key) ? 2 : 1

function pickFonts(out: Collected): DesignDraft['fonts'] {
  const list = out.fonts.filter((f) => f.role !== 'minor')
  const only = list.find((f) => f.only)
  let heading = list.find((f) => f.role === 'heading') ?? only
  let body = list.find((f) => f.role === 'body') ?? only
  const labelFont = list.find((f) => f.role === 'label')
  const loose = list.filter((f) => !f.role)
  heading ??= loose.find((f) => f.family !== body?.family) ?? loose[0]
  body ??= loose.find((f) => f !== heading && f.family !== heading?.family) ?? heading
  heading ??= body

  const substituted: string[] = []
  const family = (font: CollectedFont): Pick<DraftFont, 'family' | 'original'> & { subWeight?: number } => {
    const official = googleFont(font.family)
    if (official) return { family: official }
    const sub = font.substitutes?.find((s) => googleFont(s.family))
    if (!sub) return { family: font.family }
    substituted.push(`${font.family} → ${googleFont(sub.family)}`)
    return { family: googleFont(sub.family)!, original: font.family, subWeight: sub.weight }
  }

  // Tratamento do papel: das entradas de tipografia do papel (a mais típica primeiro), depois das frases do guia
  const treatment = (role: 'heading' | 'body' | 'label', font?: CollectedFont) => {
    const sources = out.fonts.filter((f) => f.role === role || (f === font))
    sources.sort((a, b) => treatmentPriority(b.key) - treatmentPriority(a.key))
    const pick = <K extends 'transform' | 'letterSpacing' | 'lineHeight'>(k: K) => sources.find((f) => f[k] !== undefined)?.[k] ?? out.layers.text[role][k]
    return { transform: pick('transform'), letterSpacing: pick('letterSpacing'), lineHeight: pick('lineHeight') }
  }
  const build = (role: 'heading' | 'body' | 'label', font?: CollectedFont, fallback?: CollectedFont): DraftFont | undefined => {
    const base = font ?? fallback
    if (!base) return undefined
    const { subWeight, ...fam } = family(base)
    const described = out.layers.text[role].weight
    const own = font && !(font.weightFromList && described) ? font.weight : undefined
    const weight = (font ? subWeight ?? own : undefined) ?? described
    const t = treatment(role, font)
    return clean({ ...fam, weight, ...t })
  }

  const hasLabelStyle = Object.keys(out.layers.text.label).length > 0
  const result = {
    heading: build('heading', heading),
    body: build('body', body),
    label: labelFont || hasLabelStyle ? build('label', labelFont, body ?? heading) : undefined,
  }

  if (substituted.length) {
    out.notes.push(
      `Fontes que não são do Google Fonts foram trocadas pelas substitutas que o próprio arquivo sugere: ${[...new Set(substituted)].join(', ')}.`
    )
  }
  const used = new Set([heading?.family, body?.family, labelFont?.family])
  const others = [...new Set(out.fonts.map((f) => f.family).filter((f) => !used.has(f)))]
  if (others.length) out.notes.push(`O Space usa uma fonte de título, uma de texto e uma de rótulo; ficaram de fora: ${others.join(', ')}.`)
  return result
}

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

const ROLE_NAMES = new Set(['background', 'surface', 'text', 'muted', 'primary', 'secondary', 'accent', 'border'])
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Cor citada numa frase: hex/rgb literal ou o nome que o próprio guia dá a ela ("1px Warm Cream border"). */
function colorNamer(colors: DraftColor[]) {
  const named = colors
    .flatMap((c) => [c.label, ROLE_NAMES.has(c.name) ? undefined : c.name].filter(Boolean).map((n) => ({ re: new RegExp(`\\b${escapeRe(n!.toLowerCase().replace(/[-_]/g, ' '))}\\b`), len: n!.length, hex: c.hex })))
    .filter((x) => x.len > 2)
    .sort((a, b) => b.len - a.len)
  return (text: string) => {
    const literal = text.match(COLOR_LITERAL)?.[0]
    if (literal) return toHex(literal) ?? undefined
    const t = text.toLowerCase().replace(/[-_]/g, ' ')
    return named.find((x) => x.re.test(t))?.hex ?? (/\b(white|branco)\b/.test(t) ? '#ffffff' : /\b(black|preto)\b/.test(t) ? '#000000' : undefined)
  }
}

function finish(out: Collected, format: DesignFormat, info: ObjectInfo, body: string): DesignRead {
  out.layers.flush(colorNamer(out.colors))
  const r = out.radius
  const lr = out.layers.radius
  const read = out.layers.summary()
  if (read.length) out.notes.push(`Além de cores e fontes, o guia define: ${read.join(', ')}.`)
  return {
    draft: {
      name: info.name,
      description: info.description,
      colors: out.colors,
      fonts: pickFonts(out),
      radius: clean({ card: r.card ?? lr.card ?? r.cardHint, button: r.button ?? lr.button ?? r.buttonHint, input: lr.input, image: lr.image }),
      layers: out.layers.layers,
      logo: info.logo,
      photos: info.photos ?? [],
      body,
    },
    format,
    notes: out.notes,
  }
}

const FRONT_MATTER = /^\s*---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/
const SPACE_KEYS = new Set(['name', 'description', 'colors', 'fonts', 'radius', 'buttons', 'cards', 'inputs', 'divider', 'shadow', 'images', 'motion', 'logo', 'photos'])
const STITCH_KEYS = ['typography', 'rounded', 'components', 'spacing', 'version']

/** O front matter já está no modelo do Space, sem nada para converter? */
function isSpaceModel(data: Obj): boolean {
  if (!Object.keys(data).every((k) => SPACE_KEYS.has(k))) return false
  const { colors, fonts, radius } = data
  const hexOnly = (v: unknown) => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)
  if (colors !== undefined && !(isObj(colors) && Object.values(colors).every(hexOnly))) return false
  const fontOk = ([k, v]: [string, unknown]) => (k === 'heading' || k === 'body' || k === 'label') && (typeof v === 'string' || isObj(v))
  if (fonts !== undefined && !(isObj(fonts) && Object.entries(fonts).every(fontOk))) return false
  if (radius !== undefined && !(isObj(radius) && Object.keys(radius).every((k) => ['card', 'button', 'input', 'image'].includes(k)))) return false
  return true
}

function readFrontMatter(yamlText: string, body: string): DesignRead {
  const out = new Collected()
  let data: unknown
  try {
    data = parseYaml(yamlText) ?? {}
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
    return { ...finish(out, 'front-matter', {}, body), error: `O bloco entre "---" não é um YAML válido: ${message}` }
  }
  const info = fromObject(data, out)

  // O que faltar no front matter pode estar escrito no texto abaixo dele.
  // As camadas vão para o mesmo coletor: o front matter veio antes, então prevalece.
  const fromBody = new Collected()
  fromBody.layers = out.layers
  const prose = fromMarkdown(body, fromBody)
  let filled = false
  if (!out.colors.length && fromBody.colors.length) {
    out.colors.push(...fromBody.colors)
    filled = true
  }
  if (!out.fonts.length && fromBody.fonts.length) {
    out.fonts.push(...fromBody.fonts)
    filled = true
  }
  const r = out.radius
  const br = fromBody.radius
  if (!(r.card ?? r.cardHint) && (br.card ?? br.cardHint)) {
    r.card = br.card ?? br.cardHint
    filled = true
  }
  if (!(r.button ?? r.buttonHint) && (br.button ?? br.buttonHint)) {
    r.button = br.button ?? br.buttonHint
    filled = true
  }
  if (filled) out.notes.push('Parte das cores, fontes ou cantos veio do texto abaixo do front matter.')

  const format: DesignFormat = !isObj(data)
    ? 'front-matter'
    : isSpaceModel(data) && !filled
      ? 'space'
      : STITCH_KEYS.some((k) => k in data) || /\{colors\./.test(yamlText)
        ? 'stitch'
        : 'front-matter'
  return finish(out, format, { ...info, name: info.name ?? prose.name }, body)
}


export function readDesign(source: string): DesignRead {
  const text = source.replace(/^\uFEFF/, '').trim()

  const fm = text.match(FRONT_MATTER)
  if (fm) return readFrontMatter(fm[1], (fm[2] ?? '').trim())

  // Arquivo só de tokens: JSON, YAML ou CSS
  const out = new Collected()
  if (/^[{[]/.test(text)) {
    try {
      const info = fromObject(JSON.parse(text), out)
      if (out.found) return finish(out, 'tokens-json', info, info.description ?? '')
    } catch {
      // não é JSON
    }
  }
  try {
    const data = parseYaml(text)
    if (hasTokenSections(data)) {
      const info = fromObject(data, out)
      if (out.found) return finish(out, 'yaml', info, info.description ?? '')
    }
  } catch {
    // não é YAML
  }
  // CSS solto; um Markdown com CSS num bloco de código segue para o leitor de Markdown
  if (!/^#{1,6}\s|^\s*\|.*\|\s*$|```/m.test(text) && looksLikeCss(text)) {
    fromCss(text, out)
    if (out.found) return finish(out, 'css', {}, '')
  }

  const fresh = new Collected()
  const { name, body } = fromMarkdown(text, fresh)
  return finish(fresh, 'markdown', { name }, body)
}

// ---------------------------------------------------------------------------
// Escrita no modelo do Space

const yamlString = (value: string) => JSON.stringify(value)

/** Valor simples de YAML, entre aspas quando precisa (cores com #, vírgulas, dois-pontos). */
const yamlValue = (value: unknown): string => {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value && typeof value === 'object') return yamlInline(value as Obj)
  const v = String(value)
  return /[#:{}[\],&*!|>'"%@`]|^\s|\s$|^$/.test(v) ? yamlString(v) : v
}

const yamlInline = (o: Obj) =>
  `{ ${Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${yamlValue(v)}`)
    .join(', ')} }`

const strokeValue = (s: Stroke | 'none' | undefined) => (s === undefined ? undefined : s === 'none' ? 'none' : strokeCss(s))
const emValue = (n: number | undefined) => (n === undefined ? undefined : `${+n.toFixed(4)}em`)
const msValue = (n: number | undefined) => (n === undefined ? undefined : `${n}ms`)

const buttonValue = (b: ButtonSpec) => ({
  background: b.background,
  text: b.text,
  border: strokeValue(b.border),
  radius: b.radius,
  padding: b.padding,
  weight: b.weight,
  transform: b.transform,
  hover: b.hover && Object.values(b.hover).some(Boolean) ? b.hover : undefined,
})

export function toDesignMd(draft: DesignDraft): string {
  const lines = ['---', `name: ${yamlString(draft.name?.trim() || 'Marca')}`]
  if (draft.description && draft.description !== draft.body) lines.push(`description: ${yamlString(draft.description)}`)
  if (draft.colors.length) {
    lines.push('colors:')
    for (const c of draft.colors) {
      const comment = c.label && slug(c.label) !== c.name ? `  # ${c.label.replace(/#/g, '')}` : ''
      lines.push(`  ${c.name}: "${c.hex}"${comment}`)
    }
  }
  const font = (f: DraftFont) => {
    const comment = f.original ? `  # substituta de ${f.original}` : ''
    return `${yamlInline({ family: f.family, weight: f.weight, transform: f.transform, letterSpacing: emValue(f.letterSpacing), lineHeight: f.lineHeight })}${comment}`
  }
  const { heading, body, label } = draft.fonts
  if (heading || body || label) {
    lines.push('fonts:')
    if (heading) lines.push(`  heading: ${font(heading)}`)
    if (body) lines.push(`  body: ${font(body)}`)
    if (label) lines.push(`  label: ${font(label)}`)
  }
  const radius = Object.entries(draft.radius).filter(([, v]) => v)
  if (radius.length) {
    lines.push('radius:')
    for (const [k, v] of radius) lines.push(`  ${k}: ${v}`)
  }

  const l = draft.layers
  if (l.buttons?.primary || l.buttons?.secondary) {
    lines.push('buttons:')
    if (l.buttons.primary) lines.push(`  primary: ${yamlInline(buttonValue(l.buttons.primary))}`)
    if (l.buttons.secondary) lines.push(`  secondary: ${yamlInline(buttonValue(l.buttons.secondary))}`)
  }
  if (l.cards) {
    const shadow = l.cards.shadow === undefined ? undefined : l.cards.shadow === 'none' ? 'none' : shadowCss(l.cards.shadow)
    lines.push(`cards: ${yamlInline({ background: l.cards.background, border: strokeValue(l.cards.border), shadow, blur: l.cards.blur })}`)
  }
  if (l.inputs) lines.push(`inputs: ${yamlInline({ background: l.inputs.background, border: strokeValue(l.inputs.border), underline: l.inputs.underline, text: l.inputs.text })}`)
  if (l.divider) lines.push(`divider: ${yamlValue(strokeCss(l.divider))}`)
  if (l.shadow) lines.push(`shadow: ${yamlValue(l.shadow === 'none' ? 'none' : shadowCss(l.shadow))}`)
  if (l.images?.filter) lines.push(`images: ${yamlInline({ filter: filterCss(l.images.filter) })}`)
  if (l.motion) {
    const m = l.motion
    lines.push(`motion: ${yamlInline({ entrance: m.entrance, duration: msValue(m.duration), easing: m.easing, stagger: msValue(m.stagger), hover: m.hover, cardHover: m.cardHover })}`)
  }
  const logo = draft.logo
  if (logo && LOGO_VARIANTS.some((v) => logo[v])) {
    lines.push('logo:')
    for (const v of LOGO_VARIANTS) if (logo[v]) lines.push(`  ${LOGO_KEYS[v]}: ${yamlValue(logo[v])}`)
    if (logo.alt) lines.push(`  alt: ${yamlValue(logo.alt)}`)
  }
  if (draft.photos.length) {
    lines.push('photos:')
    for (const p of draft.photos) lines.push(`  - ${p.alt ? yamlInline({ url: p.url, alt: p.alt }) : yamlValue(p.url)}`)
  }
  lines.push('---')
  return `${lines.join('\n')}\n${draft.body ? `\n${draft.body}\n` : ''}`
}
