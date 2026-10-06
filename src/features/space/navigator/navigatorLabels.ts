import type { SectionElement } from '@/features/space/landingPage'
import { widgetName } from '@/engine/elementor'

export interface LayerContext {
  sectionTitle: string
  depth: number
  index: number
  siblings: SectionElement[]
  parent?: SectionElement
  customLabels?: Record<string, string>
}

export interface LayerDescriptor {
  id: string
  parentId: string | null
  type: string
  widgetType: string | null
  currentLabel: string
  contentHint: string
  classes: string
  depth: number
  index: number
}

const WIDGET_LABELS: Record<string, string> = {
  heading: 'Título',
  'text-editor': 'Texto',
  image: 'Imagem',
  button: 'Botão',
  icon: 'Ícone',
  'icon-list': 'Lista de ícones',
  form: 'Formulário',
  video: 'Vídeo',
  google_maps: 'Mapa',
  html: 'HTML',
  'nested-accordion': 'Perguntas frequentes',
  accordion: 'Perguntas frequentes',
  'nested-carousel': 'Carrossel',
  'image-carousel': 'Galeria',
  nav_menu: 'Menu de navegação',
  social_icons: 'Redes sociais',
}

const settingsOf = (element: SectionElement): Record<string, unknown> =>
  element.settings && !Array.isArray(element.settings) ? element.settings : {}

export const plainLayerText = (value: unknown) =>
  typeof value === 'string'
    ? value
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
    : ''

const excerpt = (value: unknown, max = 38) => {
  const text = plainLayerText(value)
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

const firstDescendant = (element: SectionElement, widgetType: string): SectionElement | undefined => {
  for (const child of element.elements ?? []) {
    if (child.widgetType === widgetType) return child
    const nested = firstDescendant(child, widgetType)
    if (nested) return nested
  }
  return undefined
}

const descendantTypes = (element: SectionElement, out = new Set<string>()) => {
  for (const child of element.elements ?? []) {
    if (child.widgetType) out.add(child.widgetType)
    descendantTypes(child, out)
  }
  return out
}

const contentOf = (element: SectionElement) => {
  const settings = settingsOf(element)
  if (element.widgetType === 'heading') return excerpt(settings.title)
  if (element.widgetType === 'button') return excerpt(settings.text)
  if (element.widgetType === 'text-editor') return excerpt(settings.editor)
  if (element.widgetType === 'image') return excerpt((settings.image as Record<string, unknown> | undefined)?.alt ?? settings.caption)
  const heading = firstDescendant(element, 'heading')
  return heading ? excerpt(settingsOf(heading).title) : ''
}

const sectionSubject = (title: string) => title.split('·').at(-1)?.trim() || title.trim() || 'Seção'

const explicitTitle = (element?: SectionElement) => element ? excerpt(settingsOf(element)._title) : ''

const usefulExplicitTitle = (element: SectionElement, context: LayerContext) => {
  const explicit = explicitTitle(element)
  if (!explicit) return ''

  const normalized = explicit.toLocaleLowerCase('pt-BR')
  // Pai sem papel reconhecido não tem nome (namedRole devolve undefined)
  const parentNames = [explicitTitle(context.parent), context.parent ? namedRole(context.parent) ?? '' : '']
  const repeatsParent = parentNames.some((name) => !!name && name.toLocaleLowerCase('pt-BR') === normalized)
  const repeatedSiblings = context.siblings.filter(
    (sibling) => explicitTitle(sibling).toLocaleLowerCase('pt-BR') === normalized,
  ).length > 1

  return repeatsParent || repeatedSiblings ? '' : explicit
}

const namedRole = (element: SectionElement) => {
  const settings = settingsOf(element)
  const source = [settings._element_id, settings.css_id, settings.css_classes, settings._css_classes, settings.html_tag]
    .map(plainLayerText)
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const roles: Array<[RegExp, string]> = [
    [/\b(header|cabecalho|navbar)\b/, 'Cabeçalho'],
    [/\b(nav|menu)\b/, 'Navegação'],
    [/\b(hero|banner)\b/, 'Hero'],
    [/\b(footer|rodape)\b/, 'Rodapé'],
    [/\b(faq|duvida|accordion)\b/, 'Perguntas frequentes'],
    [/\b(contact|contato)\b/, 'Contato'],
    [/\b(testimonial|review|depoimento)\b/, 'Depoimentos'],
    [/\b(price|pricing|plan|plano)\b/, 'Planos'],
    [/\b(service|servico)\b/, 'Serviços'],
    [/\b(feature|benefit|beneficio|recurso)\b/, 'Benefícios'],
    [/\b(gallery|galeria)\b/, 'Galeria'],
    [/\b(team|equipe)\b/, 'Equipe'],
    [/\b(form|formulario)\b/, 'Formulário'],
    [/\b(cta|call.to.action)\b/, 'Chamada para ação'],
  ]
  return roles.find(([pattern]) => pattern.test(source))?.[1]
}

const containerLabel = (element: SectionElement, context: LayerContext) => {
  const explicit = usefulExplicitTitle(element, context)
  const role = namedRole(element)
  const content = contentOf(element)
  const types = descendantTypes(element)
  const children = element.elements ?? []
  const childContainers = children.filter((child) => child.elType === 'container' || child.elType === 'column')
  const signature = [...types].sort().join('|')
  const repeated = context.siblings.length >= 3
    && !!signature
    && context.siblings.every((sibling) =>
      (sibling.elType === 'container' || sibling.elType === 'column')
      && [...descendantTypes(sibling)].sort().join('|') === signature,
    )

  // Um título explícito só vence quando não repete o pai nem os irmãos.
  if (explicit) return explicit
  // O papel amplo pertence ao contêiner raiz. Nos filhos, o conteúdo é mais útil.
  if (role && context.depth === 1) return role
  if (types.has('form')) return content ? `Formulário · ${content}` : 'Formulário'
  if (types.has('nested-accordion') || types.has('accordion')) return 'Perguntas frequentes'
  if (types.has('nested-carousel') || types.has('image-carousel')) return content ? `Carrossel · ${content}` : 'Carrossel'
  if (childContainers.length >= 3) return content ? `Grade · ${content}` : 'Grade de cards'
  if (repeated && content) return `Card · ${content}`
  if (types.has('image') && content) return `Bloco visual · ${content}`
  if (types.has('icon-list')) return content ? `Benefícios · ${content}` : 'Lista de benefícios'
  if (types.has('button') && !types.has('heading') && !types.has('text-editor')) return 'Ações'
  if (content) return `Conteúdo · ${content}`

  if (role) {
    const subject = role.toLocaleLowerCase('pt-BR')
    if (types.has('button')) return `Ações do ${subject}`
    if (types.has('image')) return `Visual do ${subject}`
    if (types.has('heading') || types.has('text-editor')) return `Texto do ${subject}`
    return `Grupo do ${subject} ${context.index + 1}`
  }

  if (context.depth === 1) return `${sectionSubject(context.sectionTitle)} · estrutura`
  const parentDirection = context.parent ? plainLayerText(settingsOf(context.parent).flex_direction) : ''
  if (parentDirection === 'row' && context.siblings.length === 2) return context.index === 0 ? 'Coluna esquerda' : 'Coluna direita'
  if (parentDirection === 'row') return `Coluna ${context.index + 1}`
  return `Grupo ${context.index + 1}`
}

export const layerKind = (element: SectionElement) => {
  if (element.widgetType) return WIDGET_LABELS[element.widgetType] ?? widgetName(element.widgetType)
  if (element.elType === 'column') return 'Coluna'
  if (element.elType === 'section') return 'Seção interna'
  return 'Container'
}

export const layerName = (element: SectionElement, context: LayerContext) => {
  const custom = element.id ? excerpt(context.customLabels?.[element.id], 48) : ''
  if (custom) return custom
  if (!element.widgetType) return containerLabel(element, context)
  const content = contentOf(element)
  return content || WIDGET_LABELS[element.widgetType] || widgetName(element.widgetType)
}

export const layerSearchText = (element: SectionElement, context: LayerContext) =>
  `${layerName(element, context)} ${layerKind(element)} ${element.id ?? ''}`.toLocaleLowerCase('pt-BR')

/**
 * Escreve os nomes exibidos pelo Navigator do Space no campo que o Navigator
 * clássico do Elementor reconhece. A árvore recebida já é uma cópia lida do
 * JSON da seção, então esta operação não altera o JSON salvo no projeto.
 */
export function applyNavigatorTitles(
  elements: SectionElement[],
  sectionTitle: string,
  customLabels?: Record<string, string>,
): SectionElement[] {
  const visit = (siblings: SectionElement[], parent?: SectionElement, depth = 1) => {
    siblings.forEach((element, index) => {
      const title = layerName(element, { sectionTitle, depth, index, siblings, parent, customLabels })
      element.settings = { ...settingsOf(element), _title: title }
      visit(element.elements ?? [], element, depth + 1)
    })
  }

  visit(elements)
  return elements
}

export function collectLayerDescriptors(
  elements: SectionElement[],
  sectionTitle: string,
  customLabels?: Record<string, string>,
  parent?: SectionElement,
  depth = 1,
): LayerDescriptor[] {
  const output: LayerDescriptor[] = []
  elements.forEach((element, index) => {
    if (!element.id) return
    const context = { sectionTitle, depth, index, siblings: elements, parent, customLabels }
    const settings = settingsOf(element)
    output.push({
      id: element.id,
      parentId: parent?.id ?? null,
      type: element.elType ?? 'element',
      widgetType: element.widgetType ?? null,
      currentLabel: layerName(element, context),
      contentHint: contentOf(element),
      classes: [settings._element_id, settings.css_id, settings.css_classes, settings._css_classes].map(plainLayerText).filter(Boolean).join(' ').slice(0, 160),
      depth,
      index,
    })
    output.push(...collectLayerDescriptors(element.elements ?? [], sectionTitle, customLabels, element, depth + 1))
  })
  return output
}
