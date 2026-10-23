import type { Block, CopyComment, CopyDoc, Source } from './types'

/**
 * O que uma pessoa manda para quem edita o mesmo documento: só o que mudou.
 * Blocos inteiros (o último a chegar vale), a ordem dos blocos, os comentários,
 * o título, o briefing e as fontes. Sem imports do app: lido pelos dois lados.
 */

export interface CopyPatch {
  /** Blocos que mudaram ou nasceram. */
  blocks?: Block[]
  /** A ordem de todos os blocos, quando mudou (criar, apagar, mover). */
  order?: string[]
  comments?: CopyComment[]
  title?: string
  brief?: CopyDoc['brief']
  niche?: string
  sources?: Source[]
}

export function diffDocs(before: CopyDoc, after: CopyDoc): CopyPatch | undefined {
  const patch: CopyPatch = {}
  const old = new Map(before.blocks.map((b) => [b.id, b]))
  const changed = after.blocks.filter((b) => old.get(b.id) !== b && (old.get(b.id)?.html !== b.html || old.get(b.id)?.type !== b.type || old.get(b.id)?.label !== b.label))
  if (changed.length) patch.blocks = changed
  if (before.blocks.length !== after.blocks.length || before.blocks.some((b, i) => b.id !== after.blocks[i]?.id)) patch.order = after.blocks.map((b) => b.id)
  if (before.comments !== after.comments && JSON.stringify(before.comments) !== JSON.stringify(after.comments)) patch.comments = after.comments
  if (before.title !== after.title) patch.title = after.title
  if (JSON.stringify(before.brief) !== JSON.stringify(after.brief)) patch.brief = after.brief
  if (before.niche !== after.niche) patch.niche = after.niche
  if (JSON.stringify(before.sources ?? []) !== JSON.stringify(after.sources ?? [])) patch.sources = after.sources ?? []
  return Object.keys(patch).length ? patch : undefined
}

export function mergePatch(doc: CopyDoc, patch: CopyPatch): CopyDoc {
  const incoming = new Map((patch.blocks ?? []).map((b) => [b.id, b]))
  let blocks = doc.blocks.map((b) => incoming.get(b.id) ?? b)
  if (patch.order) {
    const byId = new Map([...blocks, ...incoming.values()].map((b) => [b.id, b]))
    blocks = patch.order.flatMap((id) => byId.get(id) ?? [])
  } else {
    // Bloco novo sem ordem nova não acontece; mas se vier, entra no fim
    const have = new Set(blocks.map((b) => b.id))
    blocks = [...blocks, ...[...incoming.values()].filter((b) => !have.has(b.id))]
  }
  return { ...doc, blocks, comments: patch.comments ?? doc.comments, title: patch.title ?? doc.title, brief: patch.brief ?? doc.brief, niche: patch.niche ?? doc.niche, sources: patch.sources ?? doc.sources }
}
