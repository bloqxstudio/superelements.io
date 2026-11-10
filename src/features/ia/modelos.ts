import { create } from 'zustand'
import { useChat } from '@/features/space/chat/chatStore'
import { CHAT_MODELS, CHAT_MODEL_IDS, claudeModelId, type ChatAgentId, type ChatAgentModel } from '@/features/space/chat/protocol'

/**
 * O modelo de cada agente em cada tipo de trabalho (2026-11-10, o usuário: "seletor de qual modelo e agente vai
 * executar qual ação, permitir selecionar no chat qual modelo quer usar"). Sem escolha na tarefa, vale o modelo
 * escolhido no chat para aquele agente; sem escolha no chat, o padrão da máquina (Sonnet no Claude Code, o do
 * `config.toml` no Codex). Fica neste navegador, como a escolha do agente (`porTarefa.ts`).
 *
 * Sem import de `criativos/link.ts` (ele usa este módulo para pôr o modelo em cada pedido).
 */

/** Os tipos de trabalho com IA (o mesmo `IaTask` de `porTarefa.ts`). */
export type IaTaskId = 'criativos' | 'video' | 'copy' | 'sites' | 'comercial' | 'stories' | 'perfil'

const KEY = 'ia-modelo-por-tarefa'
type Choice = Partial<Record<IaTaskId, Partial<Record<ChatAgentId, string>>>>

const read = (): Choice => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown
    if (!v || typeof v !== 'object') return {}
    const choice = v as Choice
    // O que foi salvo com o apelido (`opus`) vira a versão exata (`claude-opus-5-5`)
    for (const t of Object.values(choice)) if (t?.claude) t.claude = claudeModelId(t.claude) ?? undefined
    return choice
  } catch {
    return {}
  }
}

interface State {
  choice: Choice
  /** `''` volta para o modelo do chat. */
  set: (task: IaTaskId, agent: ChatAgentId, model: string) => void
}

export const useIaModels = create<State>()((set, get) => ({
  choice: read(),
  set: (task, agent, model) => {
    const choice: Choice = { ...get().choice, [task]: { ...get().choice[task], [agent]: model || undefined } }
    try {
      localStorage.setItem(KEY, JSON.stringify(choice))
    } catch {
      // vale até recarregar
    }
    set({ choice })
    // Sites e páginas são o chat do Space: o modelo é o mesmo da caixa
    if (task === 'sites') useChat.getState().setModel(agent, model)
  },
}))

/** Os modelos que dá para escolher para um agente: os fixos do Claude Code e os que o Codex desta máquina lista. */
export const modelOptions = (agent: ChatAgentId, listed?: ChatAgentModel[]): ChatAgentModel[] =>
  agent === 'claude' ? CHAT_MODEL_IDS.map((id) => ({ ...CHAT_MODELS[id] })) : (listed ?? [])

/** O nome curto de um modelo (`gpt-6.1-sol` → o nome que o Codex dá; `opus` → Opus). */
export const modelName = (agent: ChatAgentId, id: string | undefined, listed?: ChatAgentModel[]) =>
  !id ? 'Padrão' : (modelOptions(agent, listed).find((m) => m.id === id)?.name ?? id)

/**
 * A IA forçada enquanto um trabalho roda (a Iara passa o bastão a um agente: tudo o que esse trabalho pedir à IA
 * vai para ele, com o modelo escolhido no chat para ele). Um trabalho por vez.
 */
let forced: ChatAgentId | undefined
export const forcedIa = () => forced
export async function withIa<T>(id: ChatAgentId, fn: () => Promise<T>): Promise<T> {
  const before = forced
  forced = id
  try {
    return await fn()
  } finally {
    forced = before
  }
}

/** O modelo escolhido no chat para um agente (`''` = o padrão da máquina). */
export const chatModel = (agent: ChatAgentId) => useChat.getState().models[agent] || undefined

/** O modelo para um trabalho: o da tarefa, senão o do chat, senão nenhum (o servidor usa o padrão). */
export const modelFor = (task: IaTaskId | undefined, agent: ChatAgentId): string | undefined => {
  if (forced === agent && task !== 'sites') return chatModel(agent)
  if (task === 'sites') return chatModel(agent)
  return (task && useIaModels.getState().choice[task]?.[agent]) || chatModel(agent)
}

/** Que tarefa cada tipo de pedido serve, quando quem chama não diz (o `agent` genérico serve a várias). */
const KIND_TASK: Record<string, IaTaskId> = { edit: 'criativos', plan: 'criativos', 'copy-slides': 'criativos', copy: 'copy', 'copy-plan': 'copy', 'story-plan': 'stories' }

/** Põe o modelo no pedido à IA desta máquina, se quem chamou ainda não pôs (`criativos/link.ts`). */
export function withChosenModel(kind: string, request: unknown): unknown {
  const r = request as Record<string, unknown> | undefined
  if (!r || typeof r !== 'object' || r.model !== undefined) return request
  const agent = r.engine ?? r.agent
  if (agent !== 'claude' && agent !== 'codex') return request
  const model = modelFor(KIND_TASK[kind], agent)
  return model ? { ...r, model } : request
}
