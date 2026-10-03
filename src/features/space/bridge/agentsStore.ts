import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { ClaudeStepKind } from './bridgeStore'

/**
 * Os agentes trabalhando agora, em todos os projetos: a ponte do servidor de
 * dev guarda o diário de cada sessão (Claude, Codex…) em cada projeto e manda
 * para todas as abas. Alimenta a tela Agentes, o botão do header, o selo dos
 * cards de projeto e o painel do agente no canvas. Fora do `npm run dev`
 * fica vazio.
 */

export type AgentStepKind = ClaudeStepKind | 'error'

export interface AgentStep {
  id: string
  at: number
  kind: AgentStepKind
  text: string
  sectionIds?: string[]
}

export interface AgentRun {
  /** Sessão + projeto. */
  key: string
  session: string
  /** Claude, Codex, ou o nome em SPACE_AGENT. */
  agent: string
  projectId: string
  projectName?: string
  startedAt: number
  lastAt: number
  state: 'working' | 'question' | 'done'
  /** O que ele disse que está fazendo agora. */
  now?: string
  pageId?: string
  sectionId?: string
  /** Sobe a cada mudança no canvas. */
  rev: number
  steps: AgentStep[]
  /** Onde o projeto está aberto: na tela de uma pessoa, em segundo plano, ou em lugar nenhum agora. */
  where: 'canvas' | 'background' | null
  /** Salvamento na conta de quem tem o projeto aberto. */
  sync: 'saved' | 'saving' | 'offline' | 'conflict' | null
}

/** A página como o player mostra, para a prévia da tela Agentes. */
export interface AgentView {
  html: string
  pageId: string
  pageName: string
  /** `data-id` do primeiro elemento da seção em que o agente mexeu por último. */
  anchor?: string
  /** A seção marcada agora com `work` (o mesmo tipo de id). */
  working?: string
  /** Seções do plano ainda em esqueleto. */
  pending: string[]
}

export interface ViewRequest {
  projectId: string
  page?: string
  section?: string
  /** Abrir o projeto em segundo plano se ninguém o tem aberto. */
  open?: boolean
}

interface AgentsState {
  /** A ponte está no ar (só no `npm run dev`). */
  connected: boolean
  agents: AgentRun[]
  /** Diferença entre o relógio do servidor e o daqui. */
  skew: number
  requestView?: (request: ViewRequest) => Promise<AgentView>
  dismiss?: (target: { key?: string; projectId?: string }) => void
}

export const useAgents = create<AgentsState>()(() => ({ connected: false, agents: [], skew: 0 }))

/** Sem pedido nenhum por esse tempo, o agente que dizia estar trabalhando parou. */
export const IDLE_AFTER = 5 * 60_000
/** A tela Agentes mostra quem passou por aqui nas últimas horas. */
export const RECENT_FOR = 3 * 60 * 60_000

export type AgentStatus = 'working' | 'question' | 'done' | 'idle'

export const agentStatus = (run: AgentRun, now = Date.now()): AgentStatus => {
  if (run.state === 'question' || run.state === 'done') return run.state
  return now - run.lastAt > IDLE_AFTER ? 'idle' : 'working'
}

/** Agentes trabalhando num projeto agora (para o selo do card e o painel do canvas). */
export const useProjectAgents = (projectId: string | undefined) =>
  useAgents(useShallow((s) => s.agents.filter((a) => a.projectId === projectId)))
