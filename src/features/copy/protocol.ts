import type { BlockType, Brief, FormatId, Source } from './types.ts'
import type { CopyAgentId } from './agents.ts'

/**
 * O pedido que a aba manda ao agente de copy (Claude Code ou Codex da máquina
 * de quem usa, pelo conector) e o que ele devolve: operações sobre os blocos do
 * documento. Sem imports de `@/`: o servidor lê este arquivo.
 */

export interface CopyRequest {
  /** Qual IA da máquina faz o trabalho. */
  engine?: 'claude' | 'codex'
  /** O papel que ela assume. */
  role: CopyAgentId
  message: string
  doc: {
    title: string
    format: FormatId
    niche?: string
    brief: Brief
    blocks: { id: string; type: BlockType; text: string; label?: string }[]
    /** Comentários em aberto (para o editor responder). */
    comments?: { blockId: string; text: string; author: string }[]
  }
  /** Os blocos selecionados: o pedido é sobre eles. */
  selection?: { blockIds: string[] }
  skill?: { name: string; instructions: string }
  /** O que a pessoa marcou para trazer (um post, um projeto, um outro documento), já resumido. */
  references?: { kind: string; label: string; text: string }[]
  history?: { role: 'user' | 'ai'; text: string }[]
  /** Pesquisa na web (o papel Pesquisador, o formato Pesquisa ou um link no pedido ligam sozinhos). */
  web?: boolean
}

/** Um bloco novo: o texto aceita **negrito**, *itálico* e [texto](endereço). */
export interface NewBlock {
  type: BlockType
  text: string
  label?: string
}

export interface CopyOp {
  op: 'insert' | 'replace' | 'delete' | 'comment' | 'title'
  /** replace, delete, comment: o bloco. */
  blockId?: string
  /** insert: depois de qual bloco ("start" e "end" também valem). */
  after?: string
  /** insert e replace: os blocos que entram (replace troca o bloco pelos novos). */
  blocks?: NewBlock[]
  /** comment: o comentário; title: o título novo. */
  text?: string
  /** comment: o trecho comentado. */
  quote?: string
}

export interface CopyResponse {
  reply: string
  ops: CopyOp[]
  sources?: Source[]
}

const BLOCK_TYPES = ['h1', 'h2', 'h3', 'p', 'bullet', 'number', 'quote', 'hook', 'cta', 'note', 'divider'] as const

const newBlock = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'text'],
  properties: { type: { type: 'string', enum: [...BLOCK_TYPES] }, text: { type: 'string' }, label: { type: 'string' } },
} as const

export const COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'ops'],
  properties: {
    reply: { type: 'string' },
    ops: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op'],
        properties: {
          op: { type: 'string', enum: ['insert', 'replace', 'delete', 'comment', 'title'] },
          blockId: { type: 'string' },
          after: { type: 'string' },
          blocks: { type: 'array', maxItems: 60, items: newBlock },
          text: { type: 'string' },
          quote: { type: 'string' },
        },
      },
    },
    sources: { type: 'array', maxItems: 30, items: { type: 'object', additionalProperties: false, required: ['title', 'url'], properties: { title: { type: 'string' }, url: { type: 'string' } } } },
  },
} as const
