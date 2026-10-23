import { markToHtml } from './html'
import type { CopyOp, NewBlock } from './protocol'
import { block as makeBlock, uid, type Block, type CopyComment, type CopyDoc, type Person, type Source } from './types'

/**
 * Aplica o que o agente devolveu ao documento: inserir, trocar, apagar e
 * comentar blocos, e mudar o título. As operações são conferidas contra o
 * documento (ids que existem, tipos válidos); o que não passa é pulado e contado.
 */

const TYPES = new Set(['h1', 'h2', 'h3', 'p', 'bullet', 'number', 'quote', 'hook', 'cta', 'note', 'divider'])

export const toBlock = (b: NewBlock): Block | undefined => (TYPES.has(b.type) ? makeBlock(b.type, markToHtml(String(b.text ?? '').slice(0, 6000)), b.label?.slice(0, 60)) : undefined)

export interface Applied {
  doc: CopyDoc
  applied: number
  skipped: string[]
  /** Os blocos novos, na ordem, para a tela mostrar o agente escrevendo neles. */
  created: string[]
  /** Os blocos que mudaram. */
  touched: string[]
}

export function applyCopyOps(start: CopyDoc, ops: CopyOp[], author: Person, sources?: Source[]): Applied {
  let doc = start
  let applied = 0
  const skipped: string[] = []
  const created: string[] = []
  const touched = new Set<string>()
  const has = (id?: string) => !!id && doc.blocks.some((b) => b.id === id)

  ops.forEach((op, i) => {
    const label = `${i + 1}. ${op.op}`
    if (op.op === 'title') {
      if (!op.text?.trim()) return void skipped.push(`${label}: sem título`)
      doc = { ...doc, title: op.text.trim().slice(0, 140) }
      return void applied++
    }
    if (op.op === 'comment') {
      if (!has(op.blockId) || !op.text?.trim()) return void skipped.push(`${label}: bloco ou texto faltando`)
      const comment: CopyComment = { id: uid(), blockId: op.blockId!, quote: op.quote?.slice(0, 300), author, text: op.text.trim().slice(0, 2000), at: Date.now(), replies: [] }
      doc = { ...doc, comments: [...doc.comments, comment] }
      touched.add(op.blockId!)
      return void applied++
    }
    if (op.op === 'delete') {
      if (!has(op.blockId)) return void skipped.push(`${label}: bloco não existe`)
      doc = { ...doc, blocks: doc.blocks.filter((b) => b.id !== op.blockId), comments: doc.comments.filter((c) => c.blockId !== op.blockId) }
      return void applied++
    }
    const fresh = (op.blocks ?? []).flatMap((b) => toBlock(b) ?? [])
    if (!fresh.length) return void skipped.push(`${label}: sem blocos`)
    if (op.op === 'replace') {
      if (!has(op.blockId)) return void skipped.push(`${label}: bloco não existe`)
      const at = doc.blocks.findIndex((b) => b.id === op.blockId)
      const old = doc.blocks[at]
      // O primeiro bloco novo ocupa o lugar do antigo (mantém o id, e com ele os comentários); o rótulo antigo vale se o novo não trouxe
      const first = { ...fresh[0], id: old.id, label: fresh[0].label ?? old.label }
      const rest = fresh.slice(1)
      doc = { ...doc, blocks: [...doc.blocks.slice(0, at), first, ...rest, ...doc.blocks.slice(at + 1)] }
      touched.add(old.id)
      for (const r of rest) created.push(r.id)
      return void applied++
    }
    // insert
    const after = op.after ?? 'end'
    const at = after === 'start' ? 0 : after === 'end' ? doc.blocks.length : doc.blocks.findIndex((b) => b.id === after) + 1
    if (after !== 'start' && after !== 'end' && at === 0) return void skipped.push(`${label}: bloco "${after}" não existe`)
    doc = { ...doc, blocks: [...doc.blocks.slice(0, at), ...fresh, ...doc.blocks.slice(at)] }
    for (const f of fresh) created.push(f.id)
    applied++
  })

  if (sources?.length) {
    const known = new Set((doc.sources ?? []).map((s) => s.url))
    doc = { ...doc, sources: [...(doc.sources ?? []), ...sources.filter((s) => /^https?:\/\//i.test(s.url) && !known.has(s.url)).map((s) => ({ title: s.title.slice(0, 160), url: s.url }))] }
  }
  return { doc, applied, skipped, created, touched: [...touched] }
}
