/**
 * Conteúdo de qualquer widget, lido das próprias settings: textos, links,
 * imagens, galerias e listas (repeaters, como os slides ou as abas). Serve aos
 * widgets que o painel não conhece um a um, inclusive os de terceiros (Jet,
 * Essential Addons…). Chaves de estilo e de comportamento ficam de fora: são
 * ajustadas nos grupos de aparência ou no JSON.
 */

export type ContentFieldKind = 'text' | 'longtext' | 'html' | 'link' | 'image' | 'gallery' | 'list'

export interface ContentField {
  key: string
  label: string
  kind: ContentFieldKind
  /** Vem de uma tag dinâmica do WordPress: o valor salvo não é o que o site mostra. */
  dynamic?: boolean
  /** Lista: os campos de cada item (a união das chaves de todos os itens). */
  fields?: ContentField[]
  /** Lista: nome de um item ("Slide", "Aba"). */
  itemName?: string
  /** Campo de item que aparece mesmo quando o item ainda não tem a chave. */
  always?: boolean
}

type Settings = Record<string, unknown>

const isRecord = (value: unknown): value is Settings => !!value && typeof value === 'object' && !Array.isArray(value)

// Palavras de estilo ou de comportamento no nome da chave: title_color, button_size, text_align, link_click…
const STYLE =
  /(^|_)(colou?r|colors|typography|font|size|sizes|padding|margin|border|radius|shadow|width|height|gap|spacing|space|align|alignment|position|overlay|opacity|transition|animation|duration|delay|speed|hover|css|class|classes|z_index|offset|orientation|direction|justify|layout|columns?|skin|style|effect|ratio|fit|blend|filter|icon|indent|weight|transform|decoration|tag|view|shape|unit|id|ken_burns|zoom|autoplay|infinite|loop|lazy|navigation|arrows|dots|pagination|order|orderby|query|source|type|mode|show|hide|display|enable|enabled|sticky|scroll|motion|parallax|mask|blur|click|target|rel|nofollow|external|lightbox|open|toggle|trigger)(_|$)/
// Palavras de conteúdo: o que a pessoa lê na página
const CONTENT =
  /(^|_)(title|heading|headline|subtitle|subheading|text|content|description|desc|editor|label|caption|name|message|html|quote|testimonial|author|job|company|prefix|suffix|placeholder|before|after|highlighted|rotating|alert|price|period|feature|item|button|cta|badge|ribbon|note|info|excerpt|question|answer|shortcode|address|phone|email|copyright)(_|$)/
const LONG = /(^|_)(description|desc|content|editor|message|quote|testimonial|answer|excerpt|rotating|options)(_|$)/
const IMAGE_KEY = /(^|_)(image|img|photo|logo|thumbnail|avatar|media|picture|poster|bg)(_|$)/
const LINK_KEY = /(^|_)(link|url|href)(_|$)/

const LABELS: Record<string, string> = {
  title: 'Título',
  heading: 'Título',
  subtitle: 'Subtítulo',
  description: 'Descrição',
  text: 'Texto',
  content: 'Conteúdo',
  editor: 'Texto',
  button_text: 'Texto do botão',
  link: 'Link',
  url: 'Link',
  image: 'Imagem',
  background_image: 'Imagem de fundo',
  caption: 'Legenda',
  name: 'Nome',
  job: 'Cargo',
  prefix: 'Prefixo',
  suffix: 'Sufixo',
  placeholder: 'Texto de exemplo',
  price: 'Preço',
  period: 'Período',
  html: 'HTML',
  shortcode: 'Shortcode',
  tab_title: 'Título da aba',
  tab_content: 'Conteúdo da aba',
  item_title: 'Título',
  before_text: 'Texto antes',
  highlighted_text: 'Texto destacado',
  rotating_text: 'Textos que giram (um por linha)',
  after_text: 'Texto depois',
  testimonial_content: 'Depoimento',
  testimonial_name: 'Nome',
  testimonial_job: 'Cargo',
  ribbon_title: 'Faixa',
  field_label: 'Rótulo',
  field_options: 'Opções (uma por linha)',
  not_found_message: 'Mensagem sem resultados',
  gallery: 'Imagens',
  carousel: 'Imagens',
  wp_gallery: 'Imagens',
  slides: 'Slides',
  tabs: 'Abas',
  items: 'Itens',
  icon_list: 'Itens',
  price_list: 'Itens',
  social_icon_list: 'Redes sociais',
  form_name: 'Nome do formulário',
  form_fields: 'Campos',
  email_to: 'Enviar para (e-mail)',
  email_subject: 'Assunto do e-mail',
  success_message: 'Mensagem de envio',
  error_message: 'Mensagem de erro',
  address: 'Endereço',
}

const ITEM_NAMES: Record<string, string> = {
  slides: 'Slide',
  tabs: 'Aba',
  items: 'Item',
  form_fields: 'Campo',
  social_icon_list: 'Rede',
  icon_list: 'Item',
  price_list: 'Item',
  features_list: 'Recurso',
  testimonials: 'Depoimento',
  slides_list: 'Slide',
}

// Prefixo do pacote no nome das chaves de widgets de terceiros (eael_fancy_text_prefix)
const VENDOR_PREFIX = /^(eael|jet|premium|ha|uael|ua|wpr|ekit|elementskit|pp)_/

/** Campos que todo item de uma lista conhecida tem, com o valor vazio de cada um. */
const ITEM_FIELDS: Record<string, Settings> = {
  slides: { heading: '', description: '', button_text: '', link: { url: '', is_external: '', nofollow: '' }, background_image: { url: '', id: '' } },
}

export const fieldLabel = (key: string) => {
  if (LABELS[key]) return LABELS[key]
  const words = key.replace(/^_+/, '').replace(VENDOR_PREFIX, '').replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const itemNameOf = (key: string) => ITEM_NAMES[key] ?? (key.endsWith('s') ? fieldLabel(key.slice(0, -1)) : 'Item')

/** Controle de mídia do Elementor ({ url, id, alt, source }), como em pageImages.ts. */
const isMedia = (value: unknown): value is Settings => isRecord(value) && typeof value.url === 'string' && ('id' in value || 'alt' in value || 'source' in value)
const isLink = (key: string, value: unknown): value is Settings =>
  isRecord(value) && 'url' in value && ('is_external' in value || 'nofollow' in value || 'custom_attributes' in value || LINK_KEY.test(key))

const isProse = (value: string) => /\S\s+\S/.test(value) && /\p{L}/u.test(value)

const hidden = (key: string) => key.startsWith('_') || key === '__dynamic__' || key === '__globals__'

/** Que tipo de campo de conteúdo é esta chave, ou null se for estilo ou comportamento. */
function kindOf(key: string, value: unknown): ContentFieldKind | null {
  if (hidden(key)) return null
  if (isMedia(value)) return IMAGE_KEY.test(key) || !LINK_KEY.test(key) ? 'image' : null
  if (isLink(key, value)) return 'link'
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    if (value.every((item) => isRecord(item) && '_id' in item)) return 'list'
    if (value.every(isMedia)) return 'gallery'
    return null
  }
  if (typeof value !== 'string' || STYLE.test(key)) return null
  if (!CONTENT.test(key) && !isProse(value)) return null
  if (key === 'html' || key.endsWith('_html') || key === 'shortcode') return 'html'
  return LONG.test(key) || value.length > 80 || /\n|<\w/.test(value) ? 'longtext' : 'text'
}

/** Campos de conteúdo das settings, na ordem em que aparecem no JSON. */
export function contentFields(settings: Settings, depth = 0): ContentField[] {
  const dynamic = isRecord(settings.__dynamic__) ? settings.__dynamic__ : {}
  const fields: ContentField[] = []
  for (const [key, value] of Object.entries(settings)) {
    const kind = kindOf(key, value)
    if (!kind) continue
    if (kind === 'list') {
      // Lista dentro de item não entra: o painel edita um nível de itens
      if (depth > 0) continue
      const items = value as Settings[]
      // Os campos conhecidos da lista entram mesmo que nenhum item os tenha (slide sem imagem ainda pode ganhar uma)
      const merged: Settings = { ...ITEM_FIELDS[key] }
      for (const item of items) for (const [k, v] of Object.entries(item)) if (!(k in merged) || (merged[k] === '' && v !== '')) merged[k] = v
      const inner = contentFields(merged, depth + 1).map((f) => (ITEM_FIELDS[key] && f.key in ITEM_FIELDS[key] ? { ...f, always: true } : f))
      if (inner.length) fields.push({ key, label: fieldLabel(key), kind, fields: inner, itemName: itemNameOf(key) })
      continue
    }
    fields.push({ key, label: fieldLabel(key), kind, dynamic: key in dynamic && !!dynamic[key] })
  }
  return fields
}

/** Texto curto que nomeia um item da lista: o primeiro texto preenchido dele. */
export function itemTitle(item: Settings, fields: ContentField[]) {
  for (const field of fields) {
    const value = item[field.key]
    if ((field.kind === 'text' || field.kind === 'longtext') && typeof value === 'string' && value.trim()) {
      const text = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (text) return text.length > 34 ? `${text.slice(0, 33)}…` : text
    }
  }
  return ''
}

/** Id novo de item de repeater, no formato do Elementor (7 caracteres). */
export const newRepeaterId = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0')
