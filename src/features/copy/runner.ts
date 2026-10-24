import { create } from 'zustand'
import { callAi } from '@/features/criativos/link'
import type { ChatAgentId } from '@/features/space/chat/protocol'
import { agentById, type CopyAgentId } from './agents'
import { engineInfo, useCopyAgent } from './agentStore'
import { escapeHtml, htmlToMark } from './html'
import { applyCopyOps } from './ops'
import type { CopyOp, CopyRequest, CopyResponse } from './protocol'
import { folderReferences } from './folder'
import { useCopy } from './store'
import { plainOf, type CopyDoc, type Person } from './types'

/**
 * Pede ao agente (Claude Code ou Codex desta máquina, pelo conector) e aplica o
 * que ele devolve com ele à vista: o cursor vai de bloco em bloco e o texto novo
 * é digitado enquanto os outros acompanham. Tudo vira um passo só do desfazer.
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  /** O papel, a skill e a seleção deste pedido, em texto (a IA lembra deles nas próximas mensagens). */
  note?: string
  /** O que a resposta mudou, resumido. */
  ops?: string
  changed?: number
  skipped?: string[]
  error?: boolean
}

const KEY = (docId: string) => `copy-conversa:${docId}`

const read = (docId: string): ChatMessage[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY(docId)) ?? '[]')
  } catch {
    return []
  }
}
const write = (docId: string, list: ChatMessage[]) => {
  try {
    localStorage.setItem(KEY(docId), JSON.stringify(list.slice(-80)))
  } catch {
    // sem armazenamento: vale até fechar a aba
  }
}

/** A conversa de cada documento: volta ao reabrir. */
export const useCopyChat = create<{ byDoc: Record<string, ChatMessage[]>; ensure: (id: string) => void; push: (id: string, m: ChatMessage) => void; clear: (id: string) => void }>((set, get) => ({
  byDoc: {},
  ensure: (id) => {
    if (!get().byDoc[id]) set((s) => ({ byDoc: { ...s.byDoc, [id]: read(id) } }))
  },
  push: (id, m) => {
    const list = [...(get().byDoc[id] ?? read(id)), m]
    write(id, list)
    set((s) => ({ byDoc: { ...s.byDoc, [id]: list } }))
  },
  clear: (id) => {
    write(id, [])
    set((s) => ({ byDoc: { ...s.byDoc, [id]: [] } }))
  },
}))

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface RunInput {
  message: string
  role: CopyAgentId
  engine: ChatAgentId
  /** Os blocos que o pedido tem como alvo (sem eles, o documento todo). */
  blockIds?: string[]
  skill?: { name: string; instructions: string }
  references?: CopyRequest['references']
  web?: boolean
}

const summarize = (ops: CopyOp[]) =>
  ops
    .slice(0, 12)
    .map((op) => (op.op === 'insert' ? `inseriu ${op.blocks?.length ?? 0} bloco(s)` : op.op === 'replace' ? `reescreveu o bloco ${op.blockId}` : op.op === 'delete' ? `apagou o bloco ${op.blockId}` : op.op === 'comment' ? `comentou o bloco ${op.blockId}` : 'mudou o título'))
    .join('; ')

export function buildRequest(doc: CopyDoc, input: RunInput, history: ChatMessage[]): CopyRequest {
  return {
    engine: input.engine,
    role: input.role,
    message: input.message,
    doc: {
      title: doc.title,
      format: doc.format,
      niche: doc.niche,
      brief: doc.brief,
      blocks: doc.blocks.map((b) => ({ id: b.id, type: b.type, text: htmlToMark(b.html), ...(b.label ? { label: b.label } : {}) })),
      comments: doc.comments.filter((c) => !c.resolved).map((c) => ({ blockId: c.blockId, text: c.text, author: c.author.name })),
    },
    selection: input.blockIds?.length ? { blockIds: input.blockIds } : undefined,
    skill: input.skill,
    references: input.references,
    web: input.web,
    history: history
      .filter((m) => !m.error)
      .slice(-30)
      .map((m) => ({ role: m.role, text: m.role === 'user' ? (m.note ? `${m.text}\n[${m.note}]` : m.text) : m.ops ? `${m.text}\n[Mudanças feitas: ${m.ops}]` : m.text })),
  }
}

/** Digita o texto novo no bloco, aos poucos (quem acompanha vê o agente escrevendo). */
async function typeInto(id: string, finalHtml: string, quick: boolean, signal: AbortSignal) {
  const plain = plainOf(finalHtml)
  const set = (html: string) => useCopy.getState().draft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, html } : b)) }))
  if (quick || plain.length < 24) return set(finalHtml)
  const steps = Math.min(14, Math.max(4, Math.ceil(plain.length / 36)))
  for (let k = 1; k < steps && !signal.aborted; k++) {
    set(escapeHtml(plain.slice(0, Math.round((plain.length * k) / steps))).replace(/\n/g, '<br>'))
    await sleep(55)
  }
  set(finalHtml)
}

export async function runCopyAgent(input: RunInput, signal: AbortSignal): Promise<{ reply: string; applied: number; skipped: string[]; summary: string }> {
  const store = useCopy.getState()
  const doc = store.doc
  if (!doc) throw new Error('Abra um documento.')
  const history = useCopyChat.getState().byDoc[doc.id] ?? []
  const agentState = useCopyAgent.getState()
  const role = agentById(input.role)
  const target = input.blockIds?.[0] ?? store.focusId
  agentState.begin(input.engine, input.role)
  agentState.point({ blockId: target })
  try {
    // O pedido já está na conversa: a IA recebe o histórico sem ele
    const folderRefs = await folderReferences(doc)
    const answer = await callAi<CopyResponse>('copy', buildRequest(doc, { ...input, references: [...folderRefs, ...(input.references ?? [])] }, history.slice(0, -1)), signal, (step) => useCopyAgent.getState().phase(step))
    if (!Array.isArray(answer.ops)) throw new Error('A IA não respondeu no formato esperado.')
    useCopyAgent.getState().phase('applying')

    const author: Person = { id: `agent:${input.engine}:${input.role}`, name: `${role.name} (${engineInfo(input.engine).name})`, color: engineInfo(input.engine).color }
    const before = useCopy.getState().doc!
    let applied = 0
    const skipped: string[] = []
    const touched = new Set<string>()
    const quick = answer.ops.length > 14
    for (const [i, op] of answer.ops.entries()) {
      if (signal.aborted) break
      const current = useCopy.getState().doc!
      const at = op.op === 'insert' ? (op.after && op.after !== 'end' && op.after !== 'start' ? op.after : current.blocks.at(-1)?.id) : op.blockId
      useCopyAgent.getState().point({ blockId: at, text: op.op === 'comment' ? 'Comentando' : op.op === 'delete' ? 'Apagando' : 'Escrevendo' })
      await sleep(i === 0 ? 500 : quick ? 40 : 260)
      const result = applyCopyOps(current, [op], author)
      skipped.push(...result.skipped)
      if (!result.applied) continue
      applied += result.applied
      // Os blocos com texto novo entram vazios e são digitados
      const typed = [...result.created, ...(op.op === 'replace' && op.blockId ? [op.blockId] : [])]
      const finals = new Map(result.doc.blocks.filter((b) => typed.includes(b.id)).map((b) => [b.id, b.html]))
      useCopy.getState().draft(() => ({ ...result.doc, blocks: result.doc.blocks.map((b) => (finals.has(b.id) ? { ...b, html: '' } : b)) }))
      for (const id of typed) {
        if (signal.aborted) break
        useCopyAgent.getState().point({ blockId: id, text: 'Escrevendo' })
        await typeInto(id, finals.get(id) ?? '', quick, signal)
      }
      for (const id of [...typed, ...result.touched]) touched.add(id)
    }
    // As fontes de uma pesquisa e o fecho da edição
    if (answer.sources?.length) useCopy.getState().draft((d) => applyCopyOps(d, [], author, answer.sources).doc)
    if (applied || answer.sources?.length) useCopy.getState().checkpoint(before)
    useCopyAgent.getState().highlight([...touched])
    await sleep(400)
    return { reply: answer.reply, applied, skipped, summary: summarize(answer.ops) }
  } finally {
    useCopyAgent.getState().end()
  }
}
