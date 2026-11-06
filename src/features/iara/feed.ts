import { create } from 'zustand'
import { useChat } from '@/features/space/chat/chatStore'
import { setCardPatch, uid, type IaraMessage } from './store'

/**
 * O que as ações da Iara deixam no chat (2026-11-05: o chat do projeto virou o chat da Iara, com o
 * Claude Code ou o Codex). A conversa em si vive no servidor do chat; aqui ficam os cartões que só
 * a aba sabe desenhar: confirmar uma aprovação, a troca de bastão, o que foi feito, os slides que a
 * Iara olhou, o quadro da equipe de agentes e o formulário de sugestão. Cada cartão fica preso à
 * mensagem da conversa que estava por último quando ele nasceu (`after`), e aparece logo depois dela.
 */

export interface FeedItem extends IaraMessage {
  chat: string
  /** Id da mensagem da conversa depois da qual o cartão aparece ('' = no começo). */
  after: string
}

interface State {
  items: FeedItem[]
  /** A conversa da Iara aberta agora (o projeto, ou `conta-<id>`). */
  chat?: string
  /** Manda um texto à conversa aberta, como se a pessoa tivesse escrito (o bastão de volta, "Pedir à Iara"). */
  send?: (text: string) => void
  /** Começa um trabalho longo do agente escolhido na aba (criativos), com o cartão e o resultado de volta à conversa. */
  work?: (p: { action: string; args: Record<string, unknown>; label: string }, agent: string) => void
}

const KEY = 'iara-cartoes'
const MAX = 120

const read = (): FeedItem[] => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as FeedItem[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const write = (items: FeedItem[]) => {
  try {
    // Imagens pesam: só os cartões mais novos guardam as delas
    const keep = items.slice(-MAX)
    const old = (i: number) => i < keep.length - 6
    const light = keep.map((m, i) =>
      !old(i)
        ? m
        : {
            ...m,
            images: undefined,
            // As miniaturas das tentativas da equipe também só ficam nos cartões recentes
            team: m.team ? { ...m.team, parts: m.team.parts.map((p) => ({ ...p, preview: undefined, gallery: p.gallery?.map((g) => ({ ...g, thumb: '' })) })) } : m.team,
          }
    )
    localStorage.setItem(KEY, JSON.stringify(light))
  } catch {
    // vale até recarregar
  }
}

export const useIaraFeed = create<State>()(() => ({ items: read() }))

const set = (items: FeedItem[]) => {
  useIaraFeed.setState({ items })
  write(items)
}

/** A última mensagem da conversa aberta: a resposta que o agente está escrevendo, ou o último pedido. */
export function anchor(chat = useIaraFeed.getState().chat): string {
  if (!chat) return ''
  const messages = useChat.getState().conversations[chat]?.messages ?? []
  return messages.at(-1)?.id ?? ''
}

/** Um cartão novo na conversa aberta. Devolve o id. */
export function addCard(card: Omit<IaraMessage, 'id' | 'at'> & { id?: string }): string {
  const chat = useIaraFeed.getState().chat
  if (!chat) return ''
  const id = card.id ?? uid()
  set([...useIaraFeed.getState().items, { ...card, id, at: Date.now(), chat, after: anchor(chat) }])
  return id
}

/** O cartão desta resposta do agente (um por resposta: o que foi feito e as imagens se juntam nele). */
export function cardOfAnswer(): FeedItem | undefined {
  const { chat, items } = useIaraFeed.getState()
  const after = anchor(chat)
  return items.find((m) => m.chat === chat && m.after === after && !m.team && !m.form && !m.handoff)
}

export function patchCard(id: string, fn: (m: FeedItem) => FeedItem): boolean {
  const items = useIaraFeed.getState().items
  if (!items.some((m) => m.id === id)) return false
  set(items.map((m) => (m.id === id ? fn(m) : m)))
  return true
}

/**
 * Manda à conversa aberta assim que o agente dela estiver livre (a caixa ignora o envio enquanto ele responde):
 * o resultado de um trabalho longo volta mesmo que a pessoa tenha mandado outra coisa no meio. Desiste em 10 min.
 */
export async function sendWhenFree(text: string) {
  const until = Date.now() + 600_000
  while (Date.now() < until) {
    const { chat, send } = useIaraFeed.getState()
    const chatState = useChat.getState()
    const running = chat ? chatState.conversations[chat]?.running ?? [] : []
    if (send && !running.includes(chatState.agent)) return send(text)
    await new Promise((r) => setTimeout(r, 1500))
  }
}

/** Os cartões depois de uma mensagem da conversa. */
export const cardsAfter = (items: FeedItem[], chat: string, after: string) => items.filter((m) => m.chat === chat && m.after === after)

setCardPatch((id, fn) => patchCard(id, fn as (m: FeedItem) => FeedItem))
