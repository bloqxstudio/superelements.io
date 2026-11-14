import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { iaraEnabled, useMcpConnect } from '@/features/mcp/connect'

/**
 * Iara: a assistente que conversa e mexe nas telas (2026-11-05). O usuário: "um chat, aonde
 * consiga falar ali, uma assistente, e ela preenche as coisas, traz novas ideias, muda algum
 * status, muda coisas na tela, cria posts…". Roda na IA desta máquina (o conector), por escolha
 * dele. Rascunhos e mudanças de tela acontecem direto; aprovar, descartar, enviar ao cliente e
 * publicar viram uma proposta que a pessoa confirma.
 *
 * Aqui: a conversa (por conta, guardada neste navegador) e o registro da tela aberta, que diz à
 * Iara o que a pessoa está vendo e que ações de tela existem.
 */

export interface IaraDone {
  label: string
  ok: boolean
  /** Endereço para abrir o que foi feito. */
  to?: string
  /** Id do que foi criado (um conteúdo), para o agente seguir trabalhando nele. */
  ref?: string
}

export interface IaraProposal {
  id: string
  action: string
  args: unknown
  label: string
  state: 'pendente' | 'feito' | 'recusado' | 'erro'
  result?: string
  /** Troca de bastão: o agente que vai fazer (codex, claude). */
  handoff?: string
  /** Por que a Iara quer passar o bastão. */
  reason?: string
}

/** Uma parte do trabalho da equipe de agentes (orquestração). */
/** Uma tentativa de imagem da equipe: a pessoa vê todas e escolhe (2026-11-05). */
export interface GalleryItem {
  id: string
  /** Miniatura (JPEG pequeno; a imagem inteira fica na memória da aba, `galleryFull`). */
  thumb: string
  /** Para qual foto (ex.: "Foto 1 · slide 2"). */
  group: string
  attempt: number
  /** O que o revisor de IA achou. */
  verdict?: 'aprovado' | 'refazer' | 'duvida'
  note?: string
  /** A escolha da pessoa. */
  pick?: 'usar' | 'nao'
  /** O que a pessoa disse dela. */
  feedback?: string
}

export type LaneKind = 'texto' | 'imagem' | 'icones' | 'layout' | 'livre'

export interface SquadLane {
  id: string
  kind: LaneKind
  /** "Textos", "Foto", "Ícones"… */
  label: string
  agent: string
  color: string
  status: 'fila' | 'trabalhando' | 'pronto' | 'erro' | 'parado'
  /** A conversa da faixa: o pedido, os passos e a resposta (criativo). No site, a conversa vive no chat (`chat`). */
  turns: { role: 'pessoa' | 'agente'; text: string }[]
  steps: string[]
  preview?: string
  /** Faixa de site: a conversa `<projeto>#faixa-N` do chat do Space. */
  chat?: string
  slide?: number
  /** Camadas que a faixa pode mudar (criativo). */
  layerIds?: string[]
}

export interface Squad {
  title: string
  surface: 'criativo' | 'site'
  setId?: string
  postId?: string
  projectId?: string
  open?: string
  lanes: SquadLane[]
  final: 'trabalhando' | 'pronto' | 'parado'
}

export interface TeamPart {
  key: string
  label: string
  /** Quem faz: codex, claude, ou "imagens" (o serviço de imagens desta máquina). */
  agent: string
  /** `escolha`: esperando a pessoa escolher entre as tentativas. */
  status: 'fila' | 'trabalhando' | 'revisao' | 'refazendo' | 'escolha' | 'aprovado' | 'duvida' | 'falhou'
  attempt: number
  preview?: string
  note?: string
  /** Todas as tentativas de imagem desta parte, com o que o revisor achou. */
  gallery?: GalleryItem[]
  /** A foto que espera a escolha da pessoa (o `group` dos itens). */
  waiting?: string
}

/** As imagens inteiras das tentativas, por id (pesam demais para guardar no navegador). */
export const galleryFull = new Map<string, string>()

export interface IaraMessage {
  id: string
  /** `note`: linha do sistema na conversa (o bastão voltou, por exemplo). */
  role: 'user' | 'iara' | 'note'
  /** Quem escreveu, quando não foi a Iara (o Codex com o bastão). */
  agent?: string
  /** A mensagem é o trabalho de um agente que recebeu o bastão. */
  handoff?: { to: string; task: string; self?: boolean }
  text: string
  at: number
  done?: IaraDone[]
  proposals?: IaraProposal[]
  /** Passos do agente enquanto trabalha ("Vendo o criativo", "Pesquisando na web"…). */
  steps?: string[]
  /** Imagens que a Iara mostrou (prévia de slides). */
  images?: string[]
  /** Imagens que a pessoa anexou (colou, arrastou ou escolheu): miniatura e o nome que a Iara usa ("anexo 1"). */
  attachments?: { ref: string; name: string; preview: string }[]
  /** Quadro da equipe de agentes (orquestração de um criativo). */
  team?: {
    title: string
    parts: TeamPart[]
    final: 'trabalhando' | 'aguardando' | 'aprovado' | 'ajuste' | 'descartado' | 'falhou'
    setId?: string
    postId?: string
    open?: string
  }
  /** A equipe rápida: várias faixas pequenas ao mesmo tempo, cada uma com o seu minichat (`squad.ts`). */
  squad?: Squad
  /** Fluxo sem IA dentro do chat (o formulário de sugestão ao time de produto). */
  form?: { kind: 'sugestao'; state: 'aberto' | 'enviado' | 'cancelado'; text?: string }
  /** Ainda respondendo. */
  live?: boolean
  error?: boolean
}

/** Uma ação que a tela aberta oferece à Iara. */
export interface IaraAction {
  name: string
  /** Para a IA: o que faz e os campos do JSON. */
  doc: string
  /** Precisa de confirmação da pessoa? */
  risky?: boolean | ((args: Record<string, unknown>) => boolean)
  /** Frase da proposta (quando precisa confirmar). */
  label?: (args: Record<string, unknown>) => string
  /** Leva mais que os 30 s da ponte (gerar imagem, ler a Meta agora): roda como trabalho na aba e o resultado volta à conversa. */
  long?: boolean | ((args: Record<string, unknown>) => boolean)
  /** A ação vai para outro agente (troca de bastão, confirmada pela pessoa): devolve o id dele. */
  handoff?: (args: Record<string, unknown>) => string | undefined
  run: (args: Record<string, unknown>) => Promise<IaraDone | IaraDone[]>
}

export interface IaraScreen {
  id: string
  title: string
  /** O que está na tela agora (texto curto para a IA). */
  describe: () => string
  /** O item escolhido nesta tela agora, em poucas palavras (vira o chip da caixa e vai com o pedido). */
  selection?: () => string
  actions: IaraAction[]
}

/** Uma conversa da Iara (a conta tem várias; cada uma com a própria sessão do agente). */
export interface IaraConversation {
  id: string
  title: string
  at: number
}

interface IaraState {
  open: boolean
  busy: boolean
  step?: string
  teamId?: string
  /** A conversa aberta no painel. */
  convId?: string
  conversations: IaraConversation[]
  /** A conversa em que a Iara está trabalhando agora (pode não ser a aberta). */
  busyConv?: string
  /** As mensagens da conversa aberta. */
  messages: IaraMessage[]
  screen?: IaraScreen
  /** Pedido feito de fora (um botão "Pedir à Iara"): o painel envia e limpa. */
  queued?: string
  setOpen: (open: boolean) => void
  ask: (text: string) => void
  /** O id da mensagem da Iara que está sendo escrita agora (modo agente). */
  liveId?: string
}

export const uid = () => Math.random().toString(36).slice(2, 10)

/*
 * Guardado neste navegador: a lista de conversas da conta (`iara-conversas:<conta>`) e as
 * mensagens de cada uma (`iara:<conta>:<conversa>`). A conversa única de antes (`iara:<conta>`)
 * vira a primeira da lista na primeira leitura.
 */
const LIST_KEY = (team: string) => `iara-conversas:${team}`
const KEY = (team: string, conv: string) => `iara:${team}:${conv}`
const MAX_CONVERSATIONS = 30

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const readMessages = (team: string, conv: string): IaraMessage[] => {
  const raw = readJson<IaraMessage[]>(KEY(team, conv), [])
  return Array.isArray(raw) ? raw : []
}

export const writeMessages = (team: string, conv: string, list: IaraMessage[]) => {
  try {
    // Prévias de slides pesam: só as das últimas 3 mensagens ficam guardadas
    const keep = list.slice(-50)
    const light = keep.map((m, i) => (m.images && i < keep.length - 3 ? { ...m, images: undefined } : m))
    localStorage.setItem(KEY(team, conv), JSON.stringify(light))
  } catch {
    // sem armazenamento: a conversa vale até fechar a aba
  }
}

const writeList = (team: string, list: IaraConversation[]) => {
  try {
    localStorage.setItem(LIST_KEY(team), JSON.stringify(list))
  } catch {
    // vale até recarregar
  }
}

export const readConversations = (team: string): IaraConversation[] => {
  const list = readJson<IaraConversation[]>(LIST_KEY(team), [])
  if (Array.isArray(list) && list.length) return list
  // A conversa única de antes vira a primeira
  const old = readJson<IaraMessage[]>(`iara:${team}`, [])
  if (!Array.isArray(old) || !old.length) return []
  const id = uid()
  const first: IaraConversation = { id, title: titleOf(old), at: old.at(-1)?.at ?? Date.now() }
  writeMessages(team, id, old)
  writeList(team, [first])
  try {
    localStorage.removeItem(`iara:${team}`)
    const session = localStorage.getItem(`iara-sessao:${team}`)
    if (session) localStorage.setItem(`iara-sessao:${team}:${id}`, session)
    localStorage.removeItem(`iara-sessao:${team}`)
  } catch {
    // segue
  }
  return [first]
}

/** O título vem do primeiro pedido da pessoa. */
export const titleOf = (list: IaraMessage[]) => {
  const text = list.find((m) => m.role === 'user' && m.text.trim())?.text.trim()
  if (text) return text.length > 60 ? `${text.slice(0, 58).trimEnd()}…` : text
  return list.some((m) => m.role === 'user' && m.attachments?.length) ? 'Imagem anexada' : 'Nova conversa'
}

/** Mensagens das conversas que não estão abertas, enquanto a Iara ainda trabalha nelas (evita reler o localStorage a cada passo). */
const background = new Map<string, IaraMessage[]>()

/** Grava a lista de uma conversa (aberta ou não) e atualiza o título e a hora dela. */
function store(conv: string, list: IaraMessage[]) {
  const s = useIara.getState()
  if (!s.teamId) return
  writeMessages(s.teamId, conv, list)
  const conversations = s.conversations.map((c) => (c.id === conv ? { ...c, title: titleOf(list), at: list.at(-1)?.at ?? c.at } : c))
  if (conv === s.convId) {
    background.delete(conv)
    useIara.setState({ messages: list, conversations })
  } else {
    background.set(conv, list)
    useIara.setState({ conversations })
  }
  writeList(s.teamId, conversations)
}

const listOf = (conv: string): IaraMessage[] => {
  const s = useIara.getState()
  if (conv === s.convId) return s.messages
  return background.get(conv) ?? (s.teamId ? readMessages(s.teamId, conv) : [])
}

/**
 * Desde 2026-11-12 a Iara fechada já é um chat aberto (a caixa "Pergunte à Iara" no pé de cada tela),
 * então o painel lateral só começa expandido se a pessoa o deixou assim (`iara-aberta` = 1).
 * No celular começa fechada (ele cobriria a tela inteira).
 */
const startsOpen = () => {
  try {
    if (typeof window === 'undefined' || !window.matchMedia('(min-width: 768px)').matches) return false
    return localStorage.getItem('iara-aberta') === '1'
  } catch {
    return false
  }
}

export const useIara = create<IaraState>()((set) => ({
  open: startsOpen(),
  busy: false,
  messages: [],
  conversations: [],
  setOpen: (open) => set({ open }),
  // Iara fora das telas (o MCP é o caminho): o pedido vai copiado para a IA conectada da pessoa
  ask: (text) => (iaraEnabled() ? set({ open: true, queued: text }) : useMcpConnect.getState().show(text)),
}))

/**
 * Saiu da conta (revisão de 2026-11-13): esquece a conversa aberta e as da conta anterior, para a próxima
 * pessoa neste navegador não ver o histórico nem um pedido na fila. O guardado no navegador fica por conta.
 */
export function resetIara() {
  background.clear()
  useIara.setState({ busy: false, step: undefined, teamId: undefined, convId: undefined, conversations: [], busyConv: undefined, messages: [], queued: undefined, liveId: undefined })
}

/** Abre as conversas da conta: a mais recente fica aberta (ou uma nova, se não houver). */
export function loadConversations(team: string) {
  background.clear()
  const list = readConversations(team).sort((a, b) => b.at - a.at)
  if (!list.length) {
    const first: IaraConversation = { id: uid(), title: 'Nova conversa', at: Date.now() }
    writeList(team, [first])
    useIara.setState({ teamId: team, conversations: [first], convId: first.id, messages: [] })
    return
  }
  useIara.setState({ teamId: team, conversations: list, convId: list[0].id, messages: readMessages(team, list[0].id) })
}

/** Abre outra conversa da conta. */
export function openConversation(conv: string) {
  const s = useIara.getState()
  if (!s.teamId || conv === s.convId) return
  if (s.convId && s.convId === s.busyConv) background.set(s.convId, s.messages)
  useIara.setState({ convId: conv, messages: background.get(conv) ?? readMessages(s.teamId, conv) })
}

/** Começa uma conversa nova (reaproveita a aberta se ela ainda está vazia). */
export function newConversation() {
  const s = useIara.getState()
  if (!s.teamId) return
  if (!s.messages.length && s.convId) return
  const conv: IaraConversation = { id: uid(), title: 'Nova conversa', at: Date.now() }
  const conversations = [conv, ...s.conversations].slice(0, MAX_CONVERSATIONS)
  // As que saíram da lista (as mais antigas) saem do armazenamento também
  for (const old of s.conversations.filter((c) => !conversations.some((x) => x.id === c.id))) forget(s.teamId, old.id)
  if (s.convId && s.convId === s.busyConv) background.set(s.convId, s.messages)
  writeList(s.teamId, conversations)
  useIara.setState({ conversations, convId: conv.id, messages: [] })
}

const forget = (team: string, conv: string) => {
  background.delete(conv)
  try {
    localStorage.removeItem(KEY(team, conv))
    localStorage.removeItem(`iara-sessao:${team}:${conv}`)
  } catch {
    // segue
  }
}

/** Apaga uma conversa (não a que está trabalhando). */
export function deleteConversation(conv: string) {
  const s = useIara.getState()
  if (!s.teamId || conv === s.busyConv) return
  forget(s.teamId, conv)
  const conversations = s.conversations.filter((c) => c.id !== conv)
  writeList(s.teamId, conversations)
  useIara.setState({ conversations })
  if (conv === s.convId) {
    if (conversations.length) useIara.setState({ convId: conversations[0].id, messages: readMessages(s.teamId, conversations[0].id) })
    else {
      useIara.setState({ convId: undefined, messages: [] })
      newConversation()
    }
  }
}

/** A tela registra o que está mostrando e as ações dela enquanto está aberta. */
export function useIaraScreen(screen: IaraScreen | null) {
  const ref = useRef(screen)
  ref.current = screen
  const id = screen?.id
  useEffect(() => {
    if (!id) return
    // A Iara sempre lê a versão mais nova da tela (o objeto muda a cada render)
    const live: IaraScreen = {
      id,
      get title() {
        return ref.current?.title ?? ''
      },
      describe: () => ref.current?.describe() ?? '',
      selection: () => ref.current?.selection?.() ?? '',
      get actions() {
        return ref.current?.actions ?? []
      },
    }
    useIara.setState({ screen: live })
    return () => {
      if (useIara.getState().screen === live) useIara.setState({ screen: undefined })
    }
  }, [id])
}

let cardPatch: ((id: string, fn: (m: IaraMessage) => IaraMessage) => boolean) | undefined
export const setCardPatch = (fn: typeof cardPatch) => {
  cardPatch = fn
}

/** Muda uma mensagem (em qualquer conversa: a que está aberta ou a que está trabalhando) e grava. */
export function patchMessage(id: string, fn: (m: IaraMessage) => IaraMessage) {
  // Os cartões que as ações deixam no chat da Iara (ver `feed.ts`)
  if (cardPatch?.(id, fn)) return
  const s = useIara.getState()
  const conv = s.messages.some((m) => m.id === id) ? s.convId : s.busyConv && listOf(s.busyConv).some((m) => m.id === id) ? s.busyConv : undefined
  if (!conv) return
  store(conv, listOf(conv).map((m) => (m.id === id ? fn(m) : m)))
}

/** Grava a conversa aberta. */
export function saveMessages(list: IaraMessage[]) {
  const conv = useIara.getState().convId
  if (conv) store(conv, list)
}

/** Acrescenta mensagens a uma conversa (a que pediu o trabalho, mesmo que a pessoa tenha trocado de conversa). */
export function appendMessages(conv: string | undefined, ...add: IaraMessage[]) {
  const target = conv ?? useIara.getState().convId
  if (target) store(target, [...listOf(target), ...add])
}

/** A conversa aberta passa a ser a que está trabalhando (até `endWork`). */
export function beginWork(liveId?: string, step?: string, inConv?: string) {
  const conv = inConv ?? useIara.getState().convId
  useIara.setState({ busy: true, busyConv: conv, liveId, step })
  return conv
}

export function endWork() {
  const conv = useIara.getState().busyConv
  useIara.setState({ busy: false, busyConv: undefined, liveId: undefined, step: undefined })
  if (conv && conv !== useIara.getState().convId) background.delete(conv)
}

/** Um passo do trabalho em andamento: aparece na mensagem que está sendo escrita. */
export function reportStep(text: string) {
  useIara.setState({ step: text })
  const id = useIara.getState().liveId
  if (id) patchMessage(id, (m) => ({ ...m, steps: (m.steps?.at(-1) === text ? m.steps : [...(m.steps ?? []), text]).slice(-14) }))
}

/**
 * As imagens anexadas nesta conversa, inteiras (só na memória da aba: pesam demais para o
 * localStorage). A Iara se refere a elas por "anexo-1", "anexo-2"…; as ações de criativo as usam.
 */
export const attachmentFiles = new Map<string, { name: string; data: string }>()
/** O próximo nome livre nesta conversa (depois de recarregar a aba, os nomes antigos continuam ocupados). */
export const nextAttachmentRef = () => {
  const used = useIara.getState().messages.flatMap((m) => m.attachments?.map((a) => Number(a.ref.split('-')[1]) || 0) ?? [])
  const top = Math.max(0, attachmentFiles.size, ...used, ...[...attachmentFiles.keys()].map((k) => Number(k.split('-')[1]) || 0))
  return `anexo-${top + 1}`
}
