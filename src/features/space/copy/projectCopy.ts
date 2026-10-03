import { isPackSection } from '@/features/section-pack/categories'
import { hash } from '@/features/space/brand/designMd'
import type { SectionNodeData, SpaceNode } from '@/types/space'
import { sectionSlots, writeSlots, type CopySlot, type SlotRole } from './slots'

/**
 * Textos do projeto para as seções do pack: as miniaturas da biblioteca e a
 * seção que entra na página trocam o lorem ipsum pelos títulos, textos e
 * botões que já estão nas páginas do projeto. Sem IA: cada espaço recebe um
 * texto do mesmo papel e de tamanho parecido, e a mesma seção sai sempre com
 * os mesmos textos. Contato, números e nomes ficam como estão.
 */

export interface CopyEntry {
  role: SlotRole
  text: string
  size?: number
}

export interface ProjectCopy {
  /** Muda quando os textos mudam; refaz as miniaturas. */
  key: string
  entries: CopyEntry[]
}

// Nota de revisão deixada na página ("ainda será confirmada com Henrique para a versão final")
const REVIEW_NOTE = /(ser[áã]o? (confirmad|validad|revisad)|antes da publica|vers[ãa]o final|nesta pr[ée]via|a confirmar|em aberto)/i

/**
 * Texto do projeto que serve para outra seção: sem número nem contato (preço,
 * telefone, ano) e sem nota de revisão. Rótulo só em caixa alta: os outros
 * são links e etiquetas ("Voltar ao topo", "A agência").
 */
const usable = (slot: CopySlot) =>
  !slot.filler &&
  !slot.keep &&
  slot.text.length <= 420 &&
  !REVIEW_NOTE.test(slot.text) &&
  (slot.role !== 'eyebrow' || slot.caps)

const entriesByJson = new Map<string, CopyEntry[]>()

function sectionEntries(json: string): CopyEntry[] {
  const cached = entriesByJson.get(json)
  if (cached) return cached
  let entries: CopyEntry[] = []
  try {
    const data = JSON.parse(json)
    const elements = Array.isArray(data) ? data : data?.content ?? data?.elements
    if (Array.isArray(elements)) entries = sectionSlots(elements).filter(usable).map(({ role, text, size }) => ({ role, text, size }))
  } catch {
    // JSON inválido não entra no banco
  }
  if (entriesByJson.size > 400) entriesByJson.clear()
  entriesByJson.set(json, entries)
  return entries
}

const copyCache = new WeakMap<SpaceNode[], ProjectCopy | null>()

/** Textos das seções que são do projeto, sem repetição. Null quando ainda não há nenhuma. */
export function projectCopy(nodes: SpaceNode[]): ProjectCopy | null {
  if (copyCache.has(nodes)) return copyCache.get(nodes)!
  const seen = new Set<string>()
  const entries: CopyEntry[] = []
  for (const n of nodes) {
    if (n.type !== 'section') continue
    const data = n.data as SectionNodeData
    if (isPackSection(data.sourceId) || !data.elementorJson) continue
    for (const entry of sectionEntries(data.elementorJson)) {
      const k = `${entry.role}:${entry.text.toLowerCase()}`
      if (seen.has(k)) continue
      seen.add(k)
      entries.push(entry)
    }
  }
  const result = entries.length ? { key: hash(entries.map((e) => `${e.role}:${e.text}`).join('\n')), entries } : null
  copyCache.set(nodes, result)
  return result
}

/** Tamanho do título: de destaque, de seção ou de card. */
const titleClass = (size?: number) => (!size ? 1 : size >= 44 ? 2 : size >= 26 ? 1 : 0)

/** Quantos dos textos mais próximos em tamanho entram no sorteio fixo de cada espaço. */
const CHOICES = 4

/** Semente de uma seção do pack: o id do primeiro elemento, igual na miniatura e ao entrar na página. */
export const copySeed = (elements: unknown[]) => String((elements[0] as { id?: unknown } | undefined)?.id ?? '')

/**
 * Cópia de uma seção do pack com os textos trocados por textos do projeto.
 * Tudo no pack é exemplo (o lorem e o inglês de mentira); só os dados ficam.
 */
export function fillWithProjectCopy<T>(elements: T[], copy: ProjectCopy, seed = copySeed(elements)): T[] {
  const used = new Set<string>()
  const values: Record<string, string> = {}
  sectionSlots(elements)
    .filter((slot) => !slot.keep)
    .forEach((slot, i) => {
      const pool = copy.entries.filter((e) => e.role === slot.role && !used.has(e.text))
      const sameSize = slot.role === 'title' ? pool.filter((e) => titleClass(e.size) === titleClass(slot.size)) : pool
      // Texto bem mais longo que o espaço quebraria o layout da seção
      const fits = (sameSize.length ? sameSize : pool).filter((e) => e.text.length <= slot.text.length * 1.8 + 20)
      if (!fits.length) return
      const distance = (e: CopyEntry) => Math.abs(e.text.length - slot.text.length)
      const closest = fits.sort((a, b) => distance(a) - distance(b)).slice(0, CHOICES)
      const pick = closest[parseInt(hash(`${seed}:${i}`), 36) % closest.length]
      used.add(pick.text)
      values[slot.id] = pick.text
    })
  return Object.keys(values).length ? writeSlots(elements, values) : elements
}
