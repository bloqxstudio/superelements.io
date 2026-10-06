import React, { useEffect, useMemo, useRef } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { StepIcon } from '@/features/agents/AgentRunCard'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { useSpaceStore } from '@/store/spaceStore'
import { agentStatus, RECENT_FOR, useAgents, useProjectAgents, type AgentStep } from './agentsStore'
import { useClaudeBridge } from './bridgeStore'
import { focusSection } from './focus'

/** Cor do agente no canvas (Claude ou Codex): o ponto do painel e a marca das seções que ele mexeu. */
export const CLAUDE_COLOR = '#D97757'

const PANEL_WIDTH = 300
/** Depois disso sem mensagem nova, o ponto para de pulsar. */
const WORKING_FOR = 45_000
const MAX_STEPS = 40

const time = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

type PanelStep = AgentStep & { agent: string }

/**
 * O que o agente (Claude ou Codex) está fazendo no projeto, no canto do canvas: o que leu, o que
 * vai fazer, o que mudou. Clicar numa mudança leva até as seções dela. Só
 * aparece quando o agente escreve alguma coisa (ponte do `npm run dev`).
 * O diário vem da ponte, que o guarda por projeto: o que o agente fez em
 * segundo plano, antes de a pessoa abrir o projeto, também aparece aqui.
 */
export const ClaudePanel: React.FC<{ rightInset?: number; inline?: boolean }> = ({ rightInset = 0, inline = false }) => {
  const projectId = useProjectSync((s) => s.openId)
  const runs = useProjectAgents(projectId)
  const localSteps = useClaudeBridge((s) => s.steps)
  const collapsed = useClaudeBridge((s) => s.collapsed)
  const { clear, setCollapsed } = useClaudeBridge.getState()
  const listRef = useRef<HTMLOListElement>(null)
  const shared = useMemo(
    () =>
      runs
        .filter((run) => Date.now() - run.lastAt < RECENT_FOR)
        .flatMap((run) => run.steps.map((step): PanelStep => ({ ...step, agent: run.agent })))
        .sort((a, b) => a.at - b.at)
        .slice(-MAX_STEPS),
    [runs]
  )
  const steps: PanelStep[] = shared.length ? shared : localSteps
  const last = steps[steps.length - 1]
  const agent = last?.agent ?? runs[0]?.agent ?? 'Claude'
  // O que ele está fazendo agora (work/plan); sem marca daqui, vale a do diário da ponte
  const marks = useClaudeBridge((s) => s.working)
  const mark = Object.values(marks).sort((a, b) => b.since - a.since)[0]
  const sharedNow = runs.find((run) => run.now && agentStatus(run) === 'working')
  const now = mark ?? (sharedNow ? { agent: sharedNow.agent, text: sharedNow.now!, since: sharedNow.lastAt } : undefined)
  const working = !!now || (!!last && last.kind !== 'done' && last.kind !== 'question' && last.kind !== 'error' && Date.now() - last.at < WORKING_FOR)
  // O Ctrl+Z daqui só alcança o que o agente mudou com o projeto aberto nesta aba
  const hasChange = localSteps.some((s) => s.kind === 'change')
  // Claude e Codex no mesmo diário: cada linha diz quem foi
  const severalAgents = new Set(steps.map((s) => s.agent)).size > 1

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [steps.length, collapsed])

  if (!last && !now) return null

  /** Limpa as marcas daqui e o diário do projeto na ponte (ele some também da tela Agentes). */
  const clearAll = () => {
    clear()
    if (projectId) useAgents.getState().dismiss?.({ projectId })
  }

  const goTo = (step: PanelStep) => {
    const [first] = step.sectionIds ?? []
    if (!first || !focusSection(first)) return
    useSpaceStore.getState().setSelection(step.sectionIds!)
  }

  const dot = (
    <span aria-hidden className="relative flex h-2 w-2 shrink-0">
      {working && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping" style={{ background: CLAUDE_COLOR }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: CLAUDE_COLOR }} />
    </span>
  )

  return (
    <aside
      data-claude-panel
      aria-label={`${agent} no projeto`}
      aria-live="polite"
      // Na aba Agente fica em cima da conversa; fora dela, flutua no canto do canvas
      className={inline ? 'flex max-h-[42%] shrink-0 flex-col overflow-hidden border-b border-gray-100' : `pointer-events-auto absolute bottom-3 z-40 flex flex-col overflow-hidden rounded-xl ${ISLAND_SURFACE}`}
      style={inline ? undefined : { right: 12 + rightInset, width: PANEL_WIDTH }}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-center gap-2 px-3 py-2">
        {dot}
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900">
          {agent}
          {collapsed && <span className="ml-1.5 font-normal text-gray-500">{now?.text ?? last?.text}</span>}
        </p>
        <button
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title={collapsed ? 'Mostrar' : 'Recolher'}
          aria-label={collapsed ? `Mostrar o que o ${agent} fez` : 'Recolher'}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <button
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title="Limpar"
          aria-label={`Limpar o diário e as marcas do ${agent}`}
          onClick={clearAll}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>
      {!collapsed && (
        <>
          {now && (
            <p className="flex items-center gap-2 border-t border-gray-100 px-3 py-2 text-[12px] font-medium text-gray-900">
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D97757] motion-safe:animate-pulse" />
              <span className="min-w-0 truncate">{now.text}</span>
              <span aria-hidden className="se-agent-dots -ml-1.5 text-gray-500" />
            </p>
          )}
          <ol ref={listRef} className="max-h-64 space-y-0.5 overflow-y-auto border-t border-gray-100 px-1.5 py-1.5">
            {steps.map((step) => {
              const clickable = !!step.sectionIds?.length
              const body = (
                <>
                  <StepIcon step={step} />
                  <span className={`min-w-0 flex-1 text-[12px] leading-snug ${step.kind === 'note' ? 'text-gray-600' : step.kind === 'error' ? 'text-red-700' : 'text-gray-900'}`}>
                    {severalAgents && <span className="font-medium text-gray-900">{step.agent}: </span>}
                    {step.text}
                  </span>
                  <time className="shrink-0 pt-px text-[10px] tabular-nums text-gray-400">{time(step.at)}</time>
                </>
              )
              return (
                <li key={step.id}>
                  {clickable ? (
                    <button
                      className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
                      title="Ir até a seção"
                      onClick={() => goTo(step)}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex items-start gap-2 px-1.5 py-1">{body}</div>
                  )}
                </li>
              )
            })}
          </ol>
          {hasChange && <p className="border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400">Ctrl+Z desfaz a última mudança do {agent}, como qualquer edição.</p>}
        </>
      )}
    </aside>
  )
}
