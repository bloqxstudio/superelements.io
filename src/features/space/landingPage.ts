import type { ColorPaletteNodeData, SectionMotion, SectionNodeData, SpaceConnection, SpaceNode, TextNodeData } from '@/types/space'
import { applyBrand } from './brand/applyBrand'
import type { Brand } from './brand/designMd'
import { sectionBrand } from './levels/motion'

/**
 * Monta a landing page do Space: as seções na ordem vertical do canvas, cada
 * uma com o texto e a paleta conectados a ela já aplicados, e a marca por cima.
 */

interface Element {
  id?: string
  widgetType?: string
  // O PHP do Elementor exporta settings vazio como []
  settings?: Record<string, unknown> | unknown[]
  elements?: Element[]
  [key: string]: unknown
}

function walkElements(elements: Element[], visitor: (el: Element) => void): void {
  for (const el of elements) {
    visitor(el)
    if (Array.isArray(el.elements) && el.elements.length > 0) walkElements(el.elements, visitor)
  }
}

/** Elementos de um JSON colado: template exportado, clipboard do Elementor ou array cru. */
export function parseSectionElements(json: string): Element[] | null {
  if (!json.trim()) return null
  try {
    const data = JSON.parse(json)
    const elements = Array.isArray(data) ? data : data?.content ?? data?.elements
    return Array.isArray(elements) ? elements : null
  } catch {
    return null
  }
}

// Mesmo formato de id do Elementor (7 caracteres hex).
const newElementId = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0')

/**
 * Cópia com ids novos: a mesma seção pode entrar duas vezes na página, e o
 * CSS gerado pelo motor (e o Elementor) identifica cada elemento pelo id.
 */
export function withFreshIds(elements: Element[]): Element[] {
  const copy: Element[] = JSON.parse(JSON.stringify(elements))
  walkElements(copy, (el) => {
    el.id = newElementId()
  })
  return copy
}

/** Troca background_color pelas cores da paleta, em ciclo; títulos e textos seguem a cor atual. */
export function applyColors(elements: Element[], colors: string[]): Element[] {
  if (!colors.length) return elements
  const result: Element[] = JSON.parse(JSON.stringify(elements))
  let colorIndex = 0

  walkElements(result, (el) => {
    const s = el.settings
    if (!s || Array.isArray(s)) return
    if (typeof s.background_color === 'string' && s.background_color.startsWith('#')) {
      s.background_color = colors[colorIndex % colors.length]
      colorIndex++
    }
    if (typeof s.title_color === 'string' && s.title_color.startsWith('#')) {
      s.title_color = colors[colorIndex % colors.length]
    }
    if (typeof s.text_color === 'string' && s.text_color.startsWith('#')) {
      s.text_color = colors[colorIndex % colors.length]
    }
  })

  return result
}

/** Distribui os parágrafos do texto (separados por linha em branco) pelos headings e text-editors. */
export function applyCopy(elements: Element[], copy: string): Element[] {
  if (!copy.trim()) return elements
  const result: Element[] = JSON.parse(JSON.stringify(elements))
  const chunks = copy
    .split(/\n\n+/)
    .map((c) => c.trim())
    .filter(Boolean)
  let chunkIndex = 0

  walkElements(result, (el) => {
    if (chunkIndex >= chunks.length) return
    const s = el.settings
    if (!s || Array.isArray(s)) return
    if (el.widgetType === 'heading' && s.title !== undefined) {
      s.title = chunks[chunkIndex++]
    } else if (el.widgetType === 'text-editor' && s.editor !== undefined) {
      s.editor = `<p>${chunks[chunkIndex++]}</p>`
    }
  })

  return result
}

/** Elementos de uma seção só com as conexões de texto e paleta, antes da marca e dos níveis. */
export function sectionBase(section: SpaceNode, nodes: SpaceNode[], connections: SpaceConnection[]): Element[] | null {
  let elements = parseSectionElements((section.data as SectionNodeData).elementorJson)
  if (!elements) return null

  for (const conn of connections) {
    if (conn.targetId !== section.id) continue
    const source = nodes.find((n) => n.id === conn.sourceId)
    if (!source) continue
    if (conn.type === 'apply-colors') elements = applyColors(elements, (source.data as ColorPaletteNodeData).colors)
    if (conn.type === 'apply-copy') elements = applyCopy(elements, (source.data as TextNodeData).content)
  }
  return elements
}

/**
 * Elementos de uma seção com as conexões de texto e paleta aplicadas. A marca
 * entra por último e prevalece sobre a paleta conectada; o movimento escolhido
 * para a seção no nível Movimento (ou `motion`, um rascunho) vale no lugar do
 * movimento da marca. Seção importada do site do cliente não recebe a marca:
 * a troca de cada cor pela cor da marca mais próxima desfiguraria o site ao
 * publicar de volta. Só o movimento escolhido para ela entra.
 */
export function sectionWithTransforms(
  section: SpaceNode,
  nodes: SpaceNode[],
  connections: SpaceConnection[],
  brand?: Brand | null,
  motion?: SectionMotion,
): Element[] | null {
  const elements = sectionBase(section, nodes, connections)
  if (!elements) return null
  const data = section.data as SectionNodeData
  const effective = sectionBrand(data.origin ? null : brand ?? null, motion ?? data.levels?.motion)
  return effective ? applyBrand(elements, effective) : elements
}

/** Seções do canvas de cima para baixo (as soltas se organizam assim). */
export const orderedSections = (nodes: SpaceNode[]) =>
  nodes.filter((n) => n.type === 'section').sort((a, b) => a.y - b.y)

export interface LandingPage {
  elements: Element[]
  sectionCount: number
  /** Seções sem JSON válido, que ficam de fora. */
  skipped: number
}

/**
 * Ids únicos na página inteira. Seções coladas, repetidas ou de modelos podem
 * trazer os mesmos ids; o CSS do motor (e o do Elementor) é por id, então um
 * id repetido faz o estilo de uma seção vazar para outra.
 */
function uniqueIds(elements: Element[]): Element[] {
  const seen = new Set<string>()
  walkElements(elements, (el) => {
    let id = typeof el.id === 'string' && el.id ? el.id : newElementId()
    while (seen.has(id)) id = newElementId()
    el.id = id
    seen.add(id)
  })
  return elements
}

/** Uma página do canvas pronta para o Elementor: as seções dela, na ordem dela. */
export function buildLandingPage(
  sections: SpaceNode[],
  nodes: SpaceNode[],
  connections: SpaceConnection[],
  brand?: Brand | null,
): LandingPage {
  const elements: Element[] = []
  let skipped = 0

  for (const section of sections) {
    // Elementos recém-lidos do JSON do nó: trocar ids aqui não altera o nó
    const sectionElements = sectionWithTransforms(section, nodes, connections, brand)
    if (sectionElements) elements.push(...sectionElements)
    else skipped++
  }

  return { elements: uniqueIds(elements), sectionCount: sections.length - skipped, skipped }
}
