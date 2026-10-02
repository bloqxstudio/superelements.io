import { create } from 'zustand'

/**
 * O que o agente (Claude ou Codex) está fazendo no projeto aberto, para quem
 * olha o canvas: um diário curto (o que leu, o que vai fazer, o que mudou),
 * onde ele está mexendo agora, as seções ainda em esqueleto e as que ele mexeu
 * por último. Vive só nesta aba; não vai para a conta.
 */

export type ClaudeStepKind = 'note' | 'change' | 'question' | 'done'

export interface ClaudeStep {
  id: string
  at: number
  kind: ClaudeStepKind
  text: string
  /** Quem escreveu: "Claude", "Codex"… */
  agent: string
  /** Seções da mudança, para ir até elas com um clique. */
  sectionIds?: string[]
}

export type TouchKind = 'created' | 'changed'

/** Seção ou página em que o agente está trabalhando agora. */
export interface WorkMark {
  agent: string
  text: string
  since: number
}

/** Nome mostrado quando o comando não diz quem é. */
export const DEFAULT_AGENT = 'Claude'

interface ClaudeBridgeState {
  /** A ponte com o servidor de dev está no ar (só no `npm run dev`). */
  connected: boolean
  steps: ClaudeStep[]
  /** Quem falou por último; dá o nome do painel. */
  agent: string
  /** Seções da última mudança do agente, marcadas no canvas até a próxima. */
  touched: Record<string, TouchKind>
  /** Quem fez a última mudança (as seções marcadas). */
  touchedBy: string
  /** Onde o agente está mexendo agora, por id de seção ou de página: o canvas mostra borrado, com a varredura. */
  working: Record<string, WorkMark>
  /** Seções em esqueleto: o plano da página, borrado até o agente construir cada uma. */
  pending: Record<string, true>
  /** Sobe a cada vez que o agente grava a seção: o canvas mostra ela saindo do borrado. */
  reveals: Record<string, number>
  /** Painel recolhido por quem está olhando. */
  collapsed: boolean
  log: (kind: ClaudeStepKind, text: string, sectionIds?: string[], agent?: string) => void
  touch: (touched: Record<string, TouchKind>, agent?: string) => void
  setWorking: (ids: string[], mark: WorkMark) => void
  /** Sem ids, para tudo (o agente terminou ou fez uma pergunta). */
  clearWorking: (ids?: string[]) => void
  markPending: (ids: string[]) => void
  /** As seções gravadas saem do esqueleto e da varredura e aparecem nítidas. */
  reveal: (ids: string[]) => void
  clear: () => void
  setCollapsed: (collapsed: boolean) => void
}

/** Passos guardados no diário. */
const MAX_STEPS = 40

const without = <T,>(record: Record<string, T>, ids: string[]) => {
  const next = { ...record }
  for (const id of ids) delete next[id]
  return next
}

export const useClaudeBridge = create<ClaudeBridgeState>()((set) => ({
  connected: false,
  steps: [],
  agent: DEFAULT_AGENT,
  touched: {},
  touchedBy: DEFAULT_AGENT,
  working: {},
  pending: {},
  reveals: {},
  collapsed: false,
  log: (kind, text, sectionIds, agent = DEFAULT_AGENT) =>
    set((s) => ({
      steps: [...s.steps.slice(-(MAX_STEPS - 1)), { id: crypto.randomUUID(), at: Date.now(), kind, text, agent, sectionIds }],
      agent,
      // Mensagem nova abre o painel de novo
      collapsed: false,
    })),
  touch: (touched, agent = DEFAULT_AGENT) => set({ touched, touchedBy: agent }),
  setWorking: (ids, mark) => set((s) => ({ working: { ...s.working, ...Object.fromEntries(ids.map((id) => [id, mark])) } })),
  clearWorking: (ids) => set((s) => ({ working: ids ? without(s.working, ids) : {} })),
  markPending: (ids) => set((s) => ({ pending: { ...s.pending, ...Object.fromEntries(ids.map((id) => [id, true as const])) } })),
  reveal: (ids) =>
    set((s) => ({
      pending: without(s.pending, ids),
      working: without(s.working, ids),
      reveals: { ...s.reveals, ...Object.fromEntries(ids.map((id) => [id, (s.reveals[id] ?? 0) + 1])) },
    })),
  clear: () => set({ steps: [], touched: {}, working: {}, pending: {} }),
  setCollapsed: (collapsed) => set({ collapsed }),
}))
