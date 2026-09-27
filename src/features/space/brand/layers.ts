import { toHex } from './color'
import {
  lengthPx,
  parseDuration,
  parseEasing,
  parseEntrance,
  parseHover,
  parseLength,
  parseLetterSpacing,
  parseLineHeight,
  parseShadow,
  parseStroke,
  parseTransform,
  parseWeight,
  type Entrance,
  type HoverEffect,
  type Shadow,
  type Stroke,
  type TextTransform,
} from './values'

/**
 * Camadas da marca além de cores e fontes: tratamento de texto, botões,
 * cards, campos, divisores, sombra, imagens e movimento. `undefined` em
 * qualquer campo quer dizer "o guia não fala disso; a seção fica como está".
 */

export type TextRole = 'heading' | 'body' | 'label'

export interface TextStyle {
  transform?: TextTransform
  /** em */
  letterSpacing?: number
  /** proporção do tamanho da fonte */
  lineHeight?: number
  weight?: number
}

export interface ButtonSpec {
  /** #rrggbb ou 'transparent' */
  background?: string
  text?: string
  border?: Stroke | 'none'
  radius?: string
  /** Guardado para referência; não é aplicado, porque muda o tamanho do botão. */
  padding?: string
  weight?: number
  transform?: TextTransform
  hover?: { background?: string; text?: string; border?: string }
}

export interface CardSpec {
  background?: string
  border?: Stroke | 'none'
  shadow?: Shadow | 'none'
  /** px de desfoque do fundo (vidro) */
  blur?: number
}

export interface InputSpec {
  background?: string
  border?: Stroke | 'none'
  /** Só a borda de baixo. */
  underline?: boolean
  text?: string
}

/** Filtros que o Elementor tem para imagem (em %, exceto hue em graus e blur em px). */
export interface ImageFilter {
  brightness?: number
  contrast?: number
  saturate?: number
  hue?: number
  blur?: number
}

export interface MotionSpec {
  entrance?: Entrance
  /** ms */
  duration?: number
  easing?: string
  /** ms entre elementos que entram juntos */
  stagger?: number
  /** Hover de botões (e de cards, se `cardHover` não vier). */
  hover?: HoverEffect
  cardHover?: HoverEffect
  /**
   * O que recebe a entrada: 'existing' (padrão) troca só as animações que a
   * seção já tinha; 'content' anima títulos, textos, botões, imagens e cards
   * (o card entra inteiro) e tira a animação dos blocos que só embrulham.
   */
  animate?: 'existing' | 'content'
}

export interface BrandLayers {
  buttons?: { primary?: ButtonSpec; secondary?: ButtonSpec }
  cards?: CardSpec
  inputs?: InputSpec
  divider?: Stroke
  /** Elevação de tudo que tem sombra; `cards.shadow` vale só para cards. */
  shadow?: Shadow | 'none'
  images?: { filter?: ImageFilter }
  motion?: MotionSpec
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** Copia só os campos que ainda não têm valor: a primeira fonte que fala de algo vence. */
function fill<T extends object>(target: T, patch: Partial<T>): T {
  for (const [k, v] of Object.entries(patch) as [keyof T, T[keyof T]][]) {
    if (v === undefined) continue
    if (target[k] === undefined) target[k] = v
    else if (isObj(target[k]) && isObj(v)) fill(target[k] as object, v as object)
  }
  return target
}

const compact = <T extends object>(o: T): T | undefined => {
  const entries = Object.entries(o).filter(([, v]) => v !== undefined && !(isObj(v) && !Object.keys(v).length))
  return entries.length ? (Object.fromEntries(entries) as T) : undefined
}

// ---------------------------------------------------------------------------
// Filtros de imagem

export function parseFilter(value: unknown): ImageFilter | undefined {
  if (isObj(value)) {
    const n = (x: unknown) => (typeof x === 'number' ? x : typeof x === 'string' ? parseFloat(x) : undefined)
    return compact({ brightness: n(value.brightness), contrast: n(value.contrast), saturate: n(value.saturate ?? value.saturation), hue: n(value.hue), blur: n(value.blur) })
  }
  if (typeof value !== 'string') return undefined
  const f: ImageFilter = {}
  for (const m of value.matchAll(/(brightness|contrast|saturate|grayscale|hue-rotate|blur)\(\s*(-?\d*\.?\d+)\s*(%|deg|px)?\s*\)/gi)) {
    const n = +m[2]
    const pct = m[3] === '%' ? n : n <= 3 ? n * 100 : n
    const fn = m[1].toLowerCase()
    if (fn === 'brightness') f.brightness = pct
    else if (fn === 'contrast') f.contrast = pct
    else if (fn === 'saturate') f.saturate = pct
    else if (fn === 'grayscale') f.saturate = 100 - Math.min(100, pct)
    else if (fn === 'hue-rotate') f.hue = n
    else if (fn === 'blur') f.blur = n
  }
  return compact(f)
}

export const filterCss = (f: ImageFilter) =>
  [
    f.brightness !== undefined && `brightness(${f.brightness}%)`,
    f.contrast !== undefined && `contrast(${f.contrast}%)`,
    f.saturate !== undefined && `saturate(${f.saturate}%)`,
    f.hue !== undefined && `hue-rotate(${f.hue}deg)`,
    f.blur !== undefined && `blur(${f.blur}px)`,
  ]
    .filter(Boolean)
    .join(' ')

// ---------------------------------------------------------------------------
// Frases de componente

interface ComponentValues {
  radius?: string
  background?: string
  text?: string
  border?: Stroke | 'none'
  underline?: boolean
  padding?: string
  weight?: number
  transform?: TextTransform
  shadow?: Shadow | 'none'
  blur?: number
}

const NEG = /\b(no|not|without|never|avoid|sem|nunca|nenhum[a]?|evite|jamais|rejects?)\b/i
/** Uso pontual, que o guia registra mas não quer como regra. */
const EXCEPTION = /\b([uú]nico uso|single use|only once|one[- ]off|n[aã]o [eé] (um )?padr[aã]o|not a pattern|exce[cç][aã]o|exception)\b/i
const SHADOW_LITERAL = /(?:-?\d*\.?\d+px\s+){2,4}(?:rgba?\([^)]*\)|#[0-9a-f]{3,8}\b)/i

/**
 * "36px border-radius, Bark Brown (#382416) background, Warm Cream (#ffedd7)
 * text, 14px 24px vertical/horizontal padding, weight 500, uppercase".
 */
export function parseComponentSentence(text: string, colorOf: (text: string) => string | undefined): ComponentValues {
  const out: ComponentValues = {}
  let vertical: string | undefined
  let horizontal: string | undefined
  for (const raw of text.split(/[,;]\s*|\.\s+|\n+/)) {
    const c = raw.trim()
    if (!c) continue
    const weight = c.match(/\bweight\s*(\d00)\b|\b(\d00)\s*weight\b|\bpeso\s*(\d00)\b/i)
    if (weight) out.weight ??= +(weight[1] ?? weight[2] ?? weight[3])
    if (/\b(uppercase|all[- ]caps|caixa[- ]alta)\b/i.test(c)) out.transform ??= 'uppercase'
    else if (/\b(mixed[- ]case|sentence[- ]case)\b/i.test(c)) out.transform ??= 'none'

    if (/\b(border[- ]radius|radius|rounded|corners?|cantos?|raio)\b/i.test(c)) {
      out.radius ??= parseLength(c)
    } else if (/\b(shadow|sombra)s?\b/i.test(c)) {
      out.shadow ??= NEG.test(c) ? 'none' : (parseShadow(c.match(SHADOW_LITERAL)?.[0]) as Shadow | undefined)
    } else if (/\b(borders?|outline|stroke|bordas?|contorno)\b/i.test(c) && !/\bborderless\b/i.test(c)) {
      out.border ??= NEG.test(c) ? 'none' : parseStroke(c, colorOf)
      if (/\b(bottom|underline|inferior|de baixo)\b/i.test(c)) out.underline ??= true
    } else if (/\bborderless\b/i.test(c)) {
      out.border ??= 'none'
    } else if (/\b(background|fill|bg|fundo)\b/i.test(c)) {
      if (/\b(transparent|transparente|no fill|sem fundo)\b/i.test(c) && !/semi[- ]?transparent/i.test(c)) out.background ??= 'transparent'
      else if (!/semi[- ]?transparent|low opacity|\bor\b|\bou\b/i.test(c)) out.background ??= colorOf(c)
    } else if (/\bpadding\b/i.test(c)) {
      const px = c.match(/\d*\.?\d+px/g) ?? []
      if (/vertical\s*\/\s*horizontal/i.test(c) && px.length >= 2) out.padding ??= `${px[0]} ${px[1]}`
      else if (/\bvertical\b/i.test(c)) vertical ??= px[0]
      else if (/\bhorizontal\b/i.test(c)) horizontal ??= px[0]
      else if (px.length) out.padding ??= px.slice(0, 4).join(' ')
    } else if (/\b(text|label|texto|r[oó]tulo|type|font)\b/i.test(c) && !/\b(size|tamanho)\b/i.test(c)) {
      out.text ??= colorOf(c)
    }
    const blur = c.match(/blur\(\s*(\d+)px\s*\)|(\d+)px\s+(?:backdrop[- ])?blur/i)
    if (blur) out.blur ??= +(blur[1] ?? blur[2])
  }
  if (!out.padding && (vertical || horizontal)) out.padding = `${vertical ?? '0px'} ${horizontal ?? '0px'}`
  return out
}

type ComponentKind = 'primary' | 'secondary' | 'card' | 'input' | 'divider' | null

function componentKind(name: string, role = '', values?: ComponentValues): ComponentKind {
  const n = name.replace(/[-_]/g, ' ')
  if (/\b(divider|separator|rule|hairline|divisor|separador)\b/i.test(n)) return 'divider'
  if (/\b(input|field|campo|textarea|select)\b/i.test(n)) return 'input'
  if (/\b(buttons?|bot[aã]o|bot[oõ]es|btn|cta)\b/i.test(n)) {
    if (/\b(hover|active|focus|disabled|header|nav|icon)\b/i.test(n)) return null
    if (/\b(secondary|ghost|outlined?|secund[aá]ri[ao]|contorno|vazado|tertiary)\b/i.test(n) || /\bsecondary\b/i.test(role)) return 'secondary'
    if (/\b(primary|filled|solid|prim[aá]ri[ao]|principal|cheio|s[oó]lido|pill)\b/i.test(n) || /\bprimary\b/i.test(role)) return 'primary'
    return values?.background === 'transparent' && values.border && values.border !== 'none' ? 'secondary' : 'primary'
  }
  if (/\b(link)\b/i.test(n)) return null
  if (/\b(cards?|tiles?|panels?|cart[aã]o|cart[oõ]es|painel|surface)\b/i.test(n)) return 'card'
  return null
}

// ---------------------------------------------------------------------------
// Coleta

const TEXT_ROLES: TextRole[] = ['heading', 'body', 'label']

export class LayerCollector {
  text: Record<TextRole, TextStyle> = { heading: {}, body: {}, label: {} }
  /** Cantos vistos em componentes e tabelas; o leitor de fontes e cantos decide o que vale. */
  radius: { card?: string; button?: string; input?: string; image?: string } = {}
  layers: BrandLayers = {}
  /** Textos do Markdown lidos no fim, quando todas as cores (e seus nomes) já são conhecidas. */
  private pending: (() => void)[] = []
  private colorOf: (text: string) => string | undefined = (t) => toHex(t.match(/#[0-9a-f]{3,8}\b/i)?.[0] ?? '') ?? undefined

  setText(role: TextRole, style: TextStyle) {
    fill(this.text[role], style)
  }

  private button(kind: 'primary' | 'secondary', spec: ButtonSpec) {
    this.layers.buttons ??= {}
    this.layers.buttons[kind] = fill(this.layers.buttons[kind] ?? {}, spec)
  }

  private apply(kind: ComponentKind, v: ComponentValues) {
    if (kind === 'primary' || kind === 'secondary') {
      this.button(kind, { background: v.background, text: v.text, border: v.border, radius: v.radius, padding: v.padding, weight: v.weight, transform: v.transform })
      if (kind === 'primary') this.radius.button ??= v.radius
    } else if (kind === 'card') {
      this.layers.cards = fill(this.layers.cards ?? {}, { background: v.background, border: v.border, shadow: v.shadow, blur: v.blur })
      this.radius.card ??= v.radius
    } else if (kind === 'input') {
      this.layers.inputs = fill(this.layers.inputs ?? {}, { background: v.background, border: v.border, underline: v.underline, text: v.text })
      this.radius.input ??= v.radius
    } else if (kind === 'divider') {
      const stroke = v.border && v.border !== 'none' ? v.border : undefined
      if (stroke) this.layers.divider ??= stroke
    }
  }

  // --- Markdown ------------------------------------------------------------

  /** Título de componente e o texto abaixo dele ("### Pill Button (Filled)"). */
  component(name: string, text: string) {
    this.pending.push(() => {
      const role = text.match(/\*{0,2}(?:role|papel)\*{0,2}\s*:\s*\*{0,2}([^\n]*)/i)?.[1] ?? ''
      const body = text.replace(/^.*\*{0,2}(?:role|papel)\*{0,2}\s*:.*$/gim, '')
      const values = componentKind(name, role) === 'divider'
        ? { border: parseStroke(body, this.colorOf) }
        : parseComponentSentence(body, this.colorOf)
      this.apply(componentKind(name, role, values), values)
    })
  }

  /** Seção de texto livre: elevação, imagem, movimento, o que fazer e o que evitar. */
  section(heading: string, text: string) {
    this.pending.push(() => this.readSection(heading, text))
  }

  /** O texto todo: frases que valem para a tipografia inteira ("every text element is uppercase"). */
  voice(text: string) {
    this.pending.push(() => this.readVoice(text))
  }

  /** Linha de uma tabela de escala tipográfica (Role, Size, Line Height, Letter Spacing). */
  scaleRow(roleText: string, size?: string, lineHeight?: string, letterSpacing?: string) {
    const role = scaleRole(roleText)
    if (!role) return
    const px = lengthPx(size)
    this.scale.push({ role: role.role, priority: role.priority, style: { lineHeight: parseLineHeight(lineHeight, px), letterSpacing: parseLetterSpacing(letterSpacing, px) } })
  }

  private scale: { role: TextRole; priority: number; style: TextStyle }[] = []

  /** Cantos em tabela ("buttons-outlined | 22.5px"). */
  radiusRow(element: string, value: string) {
    const len = parseLength(value)
    if (!len) return
    const e = element.replace(/[-_]/g, ' ')
    if (/\b(inputs?|fields?|campos?)\b/i.test(e)) this.radius.input ??= len
    else if (/\b(images?|imagens?|photos?|fotos?|media)\b/i.test(e)) this.radius.image ??= len
    else if (/\b(buttons?|bot[oõ]es|bot[aã]o|btn)\b/i.test(e)) {
      if (/\b(outlined?|ghost|secondary|secund)/i.test(e)) this.button('secondary', { radius: len })
      else {
        this.button('primary', { radius: len })
        this.radius.button ??= len
      }
    }
  }

  private readSection(heading: string, text: string) {
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
    const h = heading.toLowerCase()

    if (/elevation|eleva[cç]|shadows?|sombras?|depth|profundidade|surfaces?|superf/.test(h) || /don'?t|evite|n[aã]o fa[cç]a|avoid/.test(h)) {
      for (const s of sentences) {
        if (/\b(shadows?|sombras?)\b|elevation/i.test(s) && NEG.test(s)) this.layers.shadow ??= 'none'
        else if (SHADOW_LITERAL.test(s) && !NEG.test(s)) this.layers.shadow ??= parseShadow(s.match(SHADOW_LITERAL)?.[0]) as Shadow | undefined
      }
      // Vidro por linha: "há um único uso de glassmorphism (...). Não é um padrão do site" não vira regra
      for (const line of text.split(/\n+/)) {
        const glass = line.match(/\b(glass\w*|frosted|vidro|fosco|backdrop)\b[^.]*?(\d+)\s*px/i) ?? line.match(/blur\(\s*(\d+)px\s*\)/i)
        if (glass && !NEG.test(line) && !EXCEPTION.test(line)) this.layers.cards = fill(this.layers.cards ?? {}, { blur: +(glass[2] ?? glass[1]) })
      }
    }

    if (/imagery|images?|imagens?|imagem|fotografia|photography|fotos/.test(h)) {
      const all = sentences.join(' ')
      if (/sharp[- ]edged|no rounded|square corners|cantos retos|sem arredondamento|sem cantos arredondados/i.test(all)) this.radius.image ??= '0px'
      const filter: ImageFilter = {}
      if (/\b(grayscale|black[- ]and[- ]white|preto e branco|monochrom\w*|monocrom\w*)\b/i.test(all)) filter.saturate = 0
      else if (/\b(desaturat\w*|dessatur\w*|muted tones|tons apagados)\b/i.test(all)) filter.saturate = 80
      if (/\b(high contrast|alto contraste)\b/i.test(all)) filter.contrast = 110
      if (Object.keys(filter).length) this.layers.images = { filter: fill(this.layers.images?.filter ?? {}, filter) }
    }

    if (/motion|animat|anima[cç]|movimento|transi|interac|intera[cç]/.test(h)) {
      const m: MotionSpec = {}
      const all = sentences.join(' ')
      if (/\b(no (motion|animation)s?|sem (movimento|anima[cç][aã]o)|static|est[aá]tic[ao])\b/i.test(all)) m.entrance = 'none'
      for (const s of sentences) {
        if (/\bhover\b/i.test(s)) {
          const effect = NEG.test(s) ? 'none' : parseHover(s)
          if (/\b(cards?|cart[aã]o|cart[oõ]es|tiles?)\b/i.test(s)) m.cardHover ??= effect
          else if (/\b(buttons?|bot[aã]o|bot[oõ]es|cta)\b/i.test(s) || !/\b(menu|links?|images?|imagem|itens?|items?)\b/i.test(s)) m.hover ??= effect
        } else if (/\b(entrance|reveal\w*|on scroll|on load|entrada das? se[cç]|entram|revela\w*)\b/i.test(s) || /^\W*(entrance|entrada)\b/i.test(s)) {
          m.entrance ??= parseEntrance(s)
        }
        const stagger = s.match(/\b(?:stagger\w*|escalonad\w*|cascata)\b[^.]*?(\d+)\s*ms|(\d+)\s*ms[^.]*\b(?:stagger|escalon)/i)
        if (stagger) m.stagger ??= +(stagger[1] ?? stagger[2])
      }
      m.duration = parseDuration(all.replace(/\b(?:stagger\w*|escalonad\w*)\b[^.]*?\d+\s*ms/gi, ''))
      m.easing = parseEasing(all)
      const spec = compact(m)
      if (spec) this.layers.motion = fill(this.layers.motion ?? {}, spec)
    }
  }

  private readVoice(text: string) {
    const upper =
      /\b(every|all)\s+(ui\s+)?(text|type|copy)\b[^.]{0,60}\buppercase\b/i.test(text) ||
      /\buppercase\b[^.]{0,60}\b(across the entire|for everything|default for everything|everywhere)\b/i.test(text) ||
      /\bset (all )?type in uppercase\b/i.test(text) ||
      /\btodo o texto\b[^.]{0,40}\bcaixa alta\b/i.test(text)
    if (upper) {
      const weight = text.match(/\buppercase\s+(?:at\s+)?weight\s+(\d00)\b/i)?.[1]
      for (const role of ['heading', 'label'] as TextRole[]) this.setText(role, { transform: 'uppercase', weight: weight ? +weight : undefined })
    }
    const mixedBody = /\b(mixed[- ]case|sentence[- ]case)\b[^.]{0,100}\bbody\b|\bbody\b[^.]{0,100}\b(mixed[- ]case|sentence[- ]case)\b/i.test(text)
    if (mixedBody) {
      const weight = text.match(/\bmixed[- ]case\s+weight\s+(\d00)\b|\bweight\s+(\d00)\s*\/\s*mixed/i)
      this.setText('body', { transform: 'none', weight: weight ? +(weight[1] ?? weight[2]) : undefined })
    }
    const headingWeight = text.match(/\bweight\s+(\d00)\b[^.]{0,40}\b(display|headlines?|headings?)\b/i)?.[1]
    if (headingWeight) this.setText('heading', { weight: +headingWeight })
    const bodyWeight = text.match(/\bweight\s+(\d00)\s*\/\s*\d+px[^.]{0,80}\bbody\b/i)?.[1]
    if (bodyWeight) this.setText('body', { weight: +bodyWeight })
    if (/\b(letter[- ]spacing|tracking)\b[^.]{0,40}\b(stays normal|normal across|no adjustment)|\bno letter[- ]spacing adjustment\b|\bno negative tracking\b/i.test(text)) {
      for (const role of TEXT_ROLES) this.setText(role, { letterSpacing: 0 })
    }
  }

  // --- Objetos: front matter, tokens, Stitch ---------------------------------

  /** Chaves de camada no topo do arquivo (modelo do Space) e `components` do Stitch. */
  fromObject(root: Obj, resolve: (v: unknown) => unknown) {
    const color = (v: unknown) => {
      const r = resolve(v)
      if (typeof r !== 'string') return undefined
      if (/^transparent$/i.test(r.trim())) return 'transparent'
      return toHex(r) ?? undefined
    }
    const stroke = (v: unknown) => {
      const r = resolve(v)
      if (typeof r !== 'string') return undefined
      // "1.5px solid {colors.primary}" ou "1px solid rgba(...)"
      const text = r.replace(/\{[^}]+\}/g, (ref) => String(resolve(ref) ?? ref))
      return parseStroke(text)
    }
    const button = (v: unknown): ButtonSpec | undefined => {
      if (!isObj(v)) return undefined
      return compact({
        background: color(v.background ?? v.backgroundColor ?? v.bg),
        text: color(v.text ?? v.textColor ?? v.color),
        border: stroke(v.border),
        radius: parseLength(resolve(v.radius ?? v.rounded ?? v.borderRadius)),
        padding: typeof v.padding === 'string' ? v.padding : undefined,
        weight: parseWeight(resolve(v.weight ?? v.fontWeight)),
        transform: parseTransform(resolve(v.transform ?? v.textTransform)),
        hover: isObj(v.hover) ? compact({ background: color(v.hover.background ?? v.hover.backgroundColor), text: color(v.hover.text ?? v.hover.textColor), border: color(v.hover.border ?? v.hover.borderColor) }) : undefined,
      })
    }

    if (isObj(root.buttons)) {
      const primary = button(root.buttons.primary)
      const secondary = button(root.buttons.secondary)
      if (primary) this.button('primary', primary)
      if (secondary) this.button('secondary', secondary)
    }
    const card = root.cards ?? root.card
    if (isObj(card)) {
      this.layers.cards = fill(this.layers.cards ?? {}, {
        background: color(card.background ?? card.backgroundColor),
        border: stroke(card.border),
        shadow: parseShadow(resolve(card.shadow)),
        blur: lengthPx(resolve(card.blur ?? card.backdropBlur)),
      })
    }
    const inputs = root.inputs ?? root.input
    if (isObj(inputs)) {
      this.layers.inputs = fill(this.layers.inputs ?? {}, {
        background: color(inputs.background ?? inputs.backgroundColor),
        border: stroke(inputs.border),
        underline: inputs.underline === true || undefined,
        text: color(inputs.text ?? inputs.textColor),
      })
    }
    const divider = stroke(root.divider ?? root.dividers)
    if (divider && divider !== 'none') this.layers.divider ??= divider
    const shadow = root.shadow ?? root.elevation ?? root.shadows
    const shadowValue = isObj(shadow) ? (shadow.card ?? shadow.md ?? shadow.default ?? shadow.base ?? Object.values(shadow)[0]) : shadow
    const parsedShadow = parseShadow(resolve(shadowValue))
    if (parsedShadow) this.layers.shadow ??= parsedShadow
    const images = root.images ?? root.imagery
    if (isObj(images)) {
      const filter = parseFilter(resolve(images.filter))
      if (filter) this.layers.images = { filter: fill(this.layers.images?.filter ?? {}, filter) }
      this.radius.image ??= parseLength(resolve(images.radius ?? images.rounded))
    }
    const motion = root.motion ?? root.animation ?? root.animations ?? root.transitions
    if (isObj(motion)) {
      const pick = (v: unknown) => (isObj(v) ? (v.normal ?? v.base ?? v.default ?? v.medium ?? v.standard ?? Object.values(v)[0]) : v)
      const spec = compact<MotionSpec>({
        entrance: parseEntrance(resolve(motion.entrance ?? motion.enter ?? motion.reveal)),
        duration: parseDuration(resolve(pick(motion.duration ?? motion.durations))),
        easing: parseEasing(resolve(pick(motion.easing ?? motion.ease ?? motion.timing))),
        stagger: parseDuration(resolve(motion.stagger)),
        hover: parseHover(resolve(motion.hover)),
        cardHover: parseHover(resolve(motion.cardHover ?? motion['card-hover'])),
      })
      if (spec) this.layers.motion = fill(this.layers.motion ?? {}, spec)
    }
    const effects = root.effects
    if (isObj(effects)) {
      const blur = lengthPx(resolve(effects.blur ?? effects.backdropBlur ?? effects.glass))
      if (blur) this.layers.cards = fill(this.layers.cards ?? {}, { blur })
    }

    const components = root.components
    if (isObj(components)) {
      for (const [name, comp] of Object.entries(components)) {
        if (!isObj(comp)) continue
        const values: ComponentValues = {
          background: color(comp.backgroundColor ?? comp.background),
          text: color(comp.textColor ?? comp.color),
          border: stroke(comp.border),
          radius: parseLength(resolve(comp.rounded ?? comp.borderRadius ?? comp.radius)),
          padding: typeof comp.padding === 'string' ? comp.padding : undefined,
          shadow: parseShadow(resolve(comp.shadow ?? comp.boxShadow)),
          blur: lengthPx(resolve(comp.backdropBlur ?? comp.blur)) ?? lengthPx(String(resolve(comp.backdropFilter) ?? '').match(/blur\(([^)]+)\)/)?.[1]),
        }
        const hover = name.match(/^(.*?)[-_ ]hover$/i)
        if (hover) {
          const kind = componentKind(hover[1])
          if (kind === 'primary' || kind === 'secondary') {
            this.button(kind, { hover: compact({ background: values.background, text: values.text, border: values.border && values.border !== 'none' ? values.border.color : undefined }) })
          }
          continue
        }
        this.apply(componentKind(name, '', values), values)
      }
    }
  }

  /** Variável de CSS (ou token com tipo) que não é cor, fonte nem canto. */
  cssVar(name: string, value: unknown) {
    if (/shadow/.test(name)) {
      const s = parseShadow(value)
      if (s) this.layers.shadow ??= s
    } else if (/duration|motion-(fast|base|normal|slow|medium)/.test(name)) {
      const d = parseDuration(value)
      if (d) this.layers.motion = fill(this.layers.motion ?? {}, { duration: d })
    } else if (/ease|easing/.test(name)) {
      const e = parseEasing(value)
      if (e) this.layers.motion = fill(this.layers.motion ?? {}, { easing: e })
    } else if (/blur|backdrop|glass/.test(name)) {
      const b = lengthPx(value)
      if (b) this.layers.cards = fill(this.layers.cards ?? {}, { blur: b })
    }
  }

  /** Lê os textos guardados do Markdown, agora que as cores têm nome. */
  flush(colorOf: (text: string) => string | undefined) {
    this.colorOf = colorOf
    // Tabela de escala antes das frases: valor medido vale mais que descrição.
    // A linha mais típica de cada papel vem primeiro ("heading" antes de "display").
    for (const role of TEXT_ROLES) {
      for (const row of this.scale.filter((r) => r.role === role).sort((a, b) => b.priority - a.priority)) this.setText(role, row.style)
    }
    this.scale = []
    for (const run of this.pending.splice(0)) run()
    // Componente citado sem nenhum valor aproveitável não vira camada vazia
    for (const key of Object.keys(this.layers) as (keyof BrandLayers)[]) {
      const value = this.layers[key]
      if (value === undefined || (isObj(value) && !compact(value))) delete this.layers[key]
    }
  }

  /** O que foi lido, para as notas da tela. */
  summary(): string[] {
    const l = this.layers
    return [
      TEXT_ROLES.some((r) => Object.keys(this.text[r]).length) && 'tratamento de texto',
      l.buttons && 'botões',
      l.cards && 'cards',
      l.inputs && 'campos',
      l.divider && 'divisores',
      l.shadow && 'sombra',
      (l.images || this.radius.image) && 'imagens',
      l.motion && 'movimento',
    ].filter(Boolean) as string[]
  }
}

/** Papel de uma linha da escala tipográfica e o quanto ela representa o papel. */
function scaleRole(text: string): { role: TextRole; priority: number } | undefined {
  const t = text.toLowerCase().replace(/[`*]/g, '').trim()
  if (/^(heading|headline|h2|t[ií]tulo)$/.test(t)) return { role: 'heading', priority: 3 }
  if (/^(display|h1|hero)/.test(t)) return { role: 'heading', priority: 2 }
  if (/^sub/.test(t)) return undefined
  if (/heading|headline|title|t[ií]tulo|h[1-4]\b/.test(t)) return { role: 'heading', priority: 1 }
  if (/^(body|paragraph|par[aá]grafo|texto|corpo)$/.test(t)) return { role: 'body', priority: 3 }
  if (/body|paragraph|lead|corpo/.test(t)) return { role: 'body', priority: 1 }
  if (/^(label|eyebrow|overline|r[oó]tulo)$/.test(t)) return { role: 'label', priority: 3 }
  if (/label|eyebrow|overline|caption|micro|legenda|r[oó]tulo/.test(t)) return { role: 'label', priority: 1 }
  return undefined
}
