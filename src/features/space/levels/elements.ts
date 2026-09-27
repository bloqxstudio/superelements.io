import { stripTags, type Settings } from '../brand/apply/elementor'

/**
 * Leitura dos elementos de uma seção para os níveis de edição: percorrer a
 * seção antes e depois de uma camada lado a lado, e dar um nome legível a
 * cada peça ("Título “Seu cardápio…”", "Card", "Botão “Começar”").
 */

export interface LevelElement {
  id?: string
  elType?: string
  widgetType?: string
  settings?: Record<string, unknown> | unknown[]
  elements?: LevelElement[]
  [key: string]: unknown
}

export const settingsOf = (el: LevelElement): Settings | null =>
  el.settings && !Array.isArray(el.settings) ? (el.settings as Settings) : null

export const isWidget = (el: LevelElement) => el.elType === 'widget' || !!el.widgetType

/**
 * Visita a seção antes e depois de uma camada, elemento a elemento. As
 * camadas só mudam settings, então as duas árvores têm a mesma forma.
 */
export function pairElements(before: LevelElement[], after: LevelElement[], visit: (b: LevelElement, a: LevelElement) => void) {
  after.forEach((a, i) => {
    const b = before[i]
    if (!b) return
    visit(b, a)
    if (a.elements?.length && b.elements?.length) pairElements(b.elements, a.elements, visit)
  })
}

export function walk(elements: LevelElement[], visit: (el: LevelElement) => void) {
  for (const el of elements) {
    visit(el)
    if (el.elements?.length) walk(el.elements, visit)
  }
}

const WIDGET_NAMES: Record<string, string> = {
  heading: 'Título',
  'text-editor': 'Texto',
  button: 'Botão',
  image: 'Imagem',
  'icon-box': 'Ícone com texto',
  'image-box': 'Imagem com texto',
  'icon-list': 'Lista',
  icon: 'Ícone',
  counter: 'Número',
  testimonial: 'Depoimento',
  form: 'Formulário',
  video: 'Vídeo',
  'star-rating': 'Avaliação',
  'image-carousel': 'Carrossel',
  'social-icons': 'Redes sociais',
  accordion: 'Perguntas',
  toggle: 'Perguntas',
  tabs: 'Abas',
  'price-table': 'Preço',
  'call-to-action': 'Chamada',
  'nav-menu': 'Menu',
  divider: 'Divisor',
}

const TEXT_KEYS = ['title', 'text', 'editor', 'title_text', 'description_text', 'testimonial_content', 'ending_number']

function snippet(s: Settings): string {
  for (const key of TEXT_KEYS) {
    const text = stripTags(s[key])
    if (text) return text.length > 28 ? `${text.slice(0, 27).trimEnd()}…` : text
  }
  const alt = (s.image as { alt?: string } | undefined)?.alt
  return alt ? (alt.length > 28 ? `${alt.slice(0, 27).trimEnd()}…` : alt) : ''
}

/** Nome da peça para as listas do painel. Cards são os containers que a marca marcou como card. */
export function elementLabel(el: LevelElement): string {
  const s = settingsOf(el) ?? {}
  if (!isWidget(el)) {
    const card = typeof s.custom_css === 'string' && /\/\*se-brand:(card|pill)\*\//.test(s.custom_css)
    return card ? 'Card' : 'Bloco'
  }
  const name = WIDGET_NAMES[String(el.widgetType)] ?? String(el.widgetType)
  const text = snippet(s)
  return text ? `${name} “${text}”` : name
}
