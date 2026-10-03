import { textKind } from '@/features/space/brand/apply/classify'
import { fontPx, stripTags, type Settings } from '@/features/space/brand/apply/elementor'

/**
 * Os textos de uma seção como espaços a preencher: título, rótulo, texto,
 * botão e item de lista, com o tamanho da fonte. Cada espaço diz se o texto é
 * de preenchimento (lorem ipsum, "Sample Subtitle", "Learn More") e se é dado
 * que fica (contato, número, preço, nome de pessoa, item de menu): trocar um
 * dado por outro texto inventaria informação.
 */

export type SlotRole = 'title' | 'eyebrow' | 'text' | 'button' | 'item'

export interface CopySlot {
  /** Caminho do elemento na seção (índices) e a chave do texto: "0.1.2/title", "0.3/icon_list.2.text". */
  id: string
  role: SlotRole
  /** Texto sem tags. */
  text: string
  /** px no desktop; títulos grandes pedem títulos grandes. */
  size?: number
  /** Lorem ipsum ou texto de exemplo: não serve de texto do projeto. */
  filler: boolean
  /** Dado que fica como está: contato, número, preço, nome de pessoa, menu. */
  keep: boolean
  /** Caixa alta (no texto ou no estilo). */
  caps: boolean
}

interface Element {
  widgetType?: string
  settings?: Record<string, unknown> | unknown[]
  elements?: Element[]
}

// Palavras do lorem ipsum do pack (latim de mentira e o latim do lorem clássico)
const LATIN = new Set(
  `sed sit natus tatem volur accus iste omnis antium laudan unde ut totam aperiam tium veritatis rem enderit repreh sunt eaque
  inventore illo ipsa explicabo ab dicta vitae et velit quis autem architecto dolor esse beatae fugiat nulla pariatur nihil
  dolorem vel illum irure aute tetur veleum cillum amet duis consec molestiae ipsum iure voluptas lorem labore enim sint elit
  culpa proident adipis officia cing tempor magna aliqua exceur est eiusmod veniam exceurs deserunt asper nisi sante ullamco eu
  laboris adipisci nostrud ratione natur mollit minim modi exercitation non commodo magnam quia magni dolores beata serui
  incidunt numsuam laborum tempora ullam consequat porro eos suscipit molestia nesciunt alisuam amnis velem anim nostrum mini
  exercita tionem nemo norun corporis eum uta ute red quae voluptatem accusantium doloremque laudantium consectetur adipiscing
  sint occaecat cupidatat aliquip ex ea do`.split(/\s+/)
)

// Textos de exemplo em inglês que o pack e o Elementor usam no lugar do conteúdo
const ENGLISH_FILLER =
  /^(sample subtitle|subtitle|sample title|new block title|block title|website hero|heading|title|your title|add your heading text here|click here|this is the heading|i am a text|text|description)$/i
const GENERIC_CTA =
  /^(learn more( details)?|read more|discover( more)?|get started|start now|contact( us)?|get in touch|book now|buy now|shop now|order now|view (more|all|details)|see (more|all)|explore( more)?|more details|make a request|request a quote|get a quote|subscribe( now)?|sign up|join( us| now)?|watch now|try (it )?(now|free)|download( now)?|apply now|send( message)?|submit|let'?s talk|click here)$/i
// Dado de verdade: telefone, e-mail, endereço, preço, número, link
const DATA = /[@\d]|https?:|www\.|\.com\b/i
// Navegação e redes: não são conteúdo da seção
const NAV = /^(menu|search|buscar|login|log in|sign in|my account|account|cart|your cart|checkout|home|follow us|share)$/i
const JOB = /^(ceo|cto|cfo|founder|co-founder|designer|developer|engineer|architect|manager|director|consultant|photographer|marketing|ux|ui)\b/i

/** Contato, número, rede social ou menu. */
const isData = (text: string) => DATA.test(text) || text.length <= 3 || NAV.test(text)

export function isFiller(text: string, role: SlotRole): boolean {
  const t = text.trim()
  if (!t || DATA.test(t)) return false
  const words = t.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  const latin = words.filter((w) => LATIN.has(w)).length
  if (words.length >= 2 && latin / words.length >= 0.5) return true
  if (ENGLISH_FILLER.test(t)) return true
  return role === 'button' && GENERIC_CTA.test(t)
}

const plain = (html: unknown) => stripTags(html).replace(/\s+/g, ' ').trim()

const LIST_ITEM = /(<li[^>]*>)([\s\S]*?)(<\/li>)/gi

function headingRole(widgetType: string, s: Settings): SlotRole | null {
  const kind = textKind(widgetType, 'typography', s)
  if (kind === 'numeric' || kind === 'button') return null
  return kind === 'label' ? 'eyebrow' : kind === 'body' ? 'text' : 'title'
}

function widgetSlots(el: Element, path: string, out: CopySlot[]) {
  const s = el.settings && !Array.isArray(el.settings) ? (el.settings as Settings) : null
  if (!s || !el.widgetType) return
  const upper = (group: string) => s[`${group}_text_transform`] === 'uppercase'
  const push = (key: string, role: SlotRole | null, value: unknown, size?: number, group = 'typography', keep = false) => {
    const text = plain(value)
    if (!role || !text) return
    out.push({
      id: `${path}/${key}`,
      role,
      text,
      size,
      filler: isFiller(text, role),
      keep: keep || isData(text),
      caps: upper(group) || (/[A-Z]/.test(text) && text === text.toUpperCase()),
    })
  }
  switch (el.widgetType) {
    case 'heading':
      push('title', headingRole('heading', s), s.title, fontPx(s, 'typography'))
      break
    case 'text-editor': {
      // Lista dentro do texto: cada item é um espaço
      const items = [...String(s.editor ?? '').matchAll(LIST_ITEM)].map((m) => m[2])
      if (items.length) items.forEach((item, i) => push(`editor.li.${i}`, 'item', item))
      else push('editor', 'text', s.editor, fontPx(s, 'typography'))
      break
    }
    case 'button':
      push('text', 'button', s.text)
      break
    case 'icon-box':
    case 'image-box': {
      // Card de pessoa (nome e cargo) fica como está
      const person = JOB.test(plain(s.description_text))
      push('title_text', 'title', s.title_text, fontPx(s, 'title_typography'), 'title', person)
      push('description_text', 'text', s.description_text, fontPx(s, 'description_typography'), 'description', person)
      break
    }
    case 'icon-list':
      ;(Array.isArray(s.icon_list) ? s.icon_list : []).forEach((item, i) =>
        push(`icon_list.${i}.text`, 'item', (item as Record<string, unknown>)?.text)
      )
      break
  }
}

function walk(elements: Element[], prefix: string, out: CopySlot[]) {
  elements.forEach((el, i) => {
    const path = prefix ? `${prefix}.${i}` : String(i)
    widgetSlots(el, path, out)
    if (el.elements?.length) walk(el.elements, path, out)
  })
  return out
}

/** Todos os textos da seção, na ordem do documento. */
export const sectionSlots = (elements: unknown[]): CopySlot[] => walk(elements as Element[], '', [])

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Cópia da seção com os textos trocados, por id de espaço. */
export function writeSlots<T>(elements: T[], values: Record<string, string>): T[] {
  const result = JSON.parse(JSON.stringify(elements)) as Element[]
  for (const [id, value] of Object.entries(values)) {
    const [path, key] = id.split('/')
    let el: Element | undefined
    for (const i of path.split('.').map(Number)) el = (el ? el.elements : result)?.[i]
    const s = el?.settings && !Array.isArray(el.settings) ? (el.settings as Settings) : null
    if (!s || !key) continue
    if (key === 'editor') s.editor = value.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('')
    else if (key.startsWith('editor.li.')) {
      const target = Number(key.split('.')[2])
      let n = -1
      s.editor = String(s.editor ?? '').replace(LIST_ITEM, (m, open: string, _inner, close: string) =>
        ++n === target ? open + escapeHtml(value) + close : m
      )
    } else if (key.startsWith('icon_list.')) {
      const item = (s.icon_list as Record<string, unknown>[] | undefined)?.[Number(key.split('.')[1])]
      if (item) item.text = value
    } else s[key] = escapeHtml(value)
  }
  return result as T[]
}
