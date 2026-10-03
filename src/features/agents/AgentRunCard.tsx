import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, CircleAlert, CircleHelp, PencilLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { agentStatus, useAgents, type AgentRun, type AgentStep } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'
import { AgentPreview } from './AgentPreview'
import { AGENT_COLOR, ago, clock, STATUS, WHERE } from './agentStatus'

/** Passos do diário mostrados no card (o resto fica no painel do canvas). */
const CARD_STEPS = 4

export const StepIcon: React.FC<{ step: AgentStep }> = ({ step }) => {
  const className = 'mt-0.5 h-3.5 w-3.5 shrink-0'
  if (step.kind === 'change') return <PencilLine className={className} style={{ color: AGENT_COLOR }} aria-hidden />
  if (step.kind === 'question') return <CircleHelp className={`${className} text-violet-600`} aria-hidden />
  if (step.kind === 'done') return <Check className={`${className} text-emerald-600`} aria-hidden />
  if (step.kind === 'error') return <CircleAlert className={`${className} text-red-600`} aria-hidden />
  return <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
}

export const StatusDot: React.FC<{ run: AgentRun; className?: string }> = ({ run, className }) => {
  const status = STATUS[agentStatus(run)]
  return (
    <span aria-hidden className={cn('relative flex h-2 w-2 shrink-0', className)}>
      {status.pulse && <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping', status.dot)} />}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', status.dot)} />
    </span>
  )
}

const dismiss = (run: AgentRun) => useAgents.getState().dismiss?.({ key: run.key })

/** Onde o projeto está e se ele salvou: "no canvas", "em segundo plano · sem internet"… */
const placeLabel = (run: AgentRun) => {
  const where = run.where ? WHERE[run.where] : null
  const sync = run.sync === 'conflict' ? 'conflito ao salvar' : run.sync === 'offline' ? 'sem salvar na conta' : null
  return [where, sync].filter(Boolean).join(' · ')
}

/**
 * Um agente num projeto, enquanto trabalha ou espera uma resposta: quem é, o
 * que está fazendo, a página sendo montada ao vivo e o diário recente.
 */
export const AgentRunCard: React.FC<{ run: AgentRun }> = ({ run }) => {
  const [pageName, setPageName] = useState<string>()
  const status = agentStatus(run)
  const meta = STATUS[status]
  const question = status === 'question' ? [...run.steps].reverse().find((s) => s.kind === 'question') : undefined
  // A pergunta aparece em destaque: não se repete no diário
  const steps = run.steps.filter((s) => s !== question).slice(-CARD_STEPS).reverse()
  const place = placeLabel(run)

  return (
    <article className={cn('flex flex-col overflow-hidden rounded-xl', ISLAND_SURFACE)} aria-label={`${run.agent} em ${run.projectName ?? 'projeto'}`}>
      <header className="flex items-start gap-2.5 px-4 pb-3 pt-3.5">
        <StatusDot run={run} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {run.agent}
            <span className="font-normal text-gray-400"> em </span>
            {run.projectName ?? 'Projeto'}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            <span className={cn('font-medium', meta.text)}>{meta.label}</span>
            {pageName && ` · página ${pageName}`}
            {' · '}
            {ago(run.lastAt)}
            {place && ` · ${place}`}
          </p>
        </div>
        <button
          type="button"
          className="-mr-1.5 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Tirar da lista"
          aria-label={`Tirar ${run.agent} em ${run.projectName ?? 'projeto'} da lista`}
          onClick={() => dismiss(run)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <Link
        to={`/projetos/${run.projectId}`}
        className="block border-y border-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`Abrir ${run.projectName ?? 'o projeto'} no canvas`}
      >
        <AgentPreview run={run} onPage={setPageName} />
      </Link>

      {question && (
        <div className="mx-4 mt-3 rounded-lg bg-violet-50 px-3 py-2 text-[13px] leading-snug text-violet-950">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Pergunta para você</p>
          <p className="mt-0.5">{question.text}</p>
          <p className="mt-1 text-[11px] text-violet-700">Responda no chat do {run.agent}.</p>
        </div>
      )}

      <ol className="flex-1 space-y-0.5 px-2.5 py-2.5" aria-label="Diário">
        {steps.length ? (
          steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2 rounded-lg px-1.5 py-1">
              <StepIcon step={step} />
              <span className={cn('min-w-0 flex-1 text-[12px] leading-snug', step.kind === 'note' ? 'text-gray-600' : step.kind === 'error' ? 'text-red-700' : 'text-gray-900')}>
                {step.text}
              </span>
              <time className="shrink-0 pt-px text-[10px] tabular-nums text-gray-400">{clock(step.at)}</time>
            </li>
          ))
        ) : (
          <li className="px-1.5 py-1 text-[12px] text-gray-500">Lendo o projeto…</li>
        )}
      </ol>

      <footer className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5">
        <p className="min-w-0 truncate text-[11px] text-gray-400">Começou {ago(run.startedAt)}</p>
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
          <Link to={`/projetos/${run.projectId}`}>
            Abrir no canvas
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </footer>
    </article>
  )
}

/** Agente que terminou ou parou: uma linha, com o último passo. */
export const AgentRunRow: React.FC<{ run: AgentRun }> = ({ run }) => {
  const status = agentStatus(run)
  const last = run.steps[run.steps.length - 1]
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <StatusDot run={run} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-900">
          <span className="font-medium">{run.agent}</span>
          <span className="text-gray-400"> em </span>
          <span className="font-medium">{run.projectName ?? 'Projeto'}</span>
          <span className={cn('ml-2 text-xs', STATUS[status].text)}>{STATUS[status].label}</span>
        </p>
        {last && <p className="mt-0.5 truncate text-xs text-gray-500">{last.text}</p>}
      </div>
      <span className="hidden shrink-0 text-xs tabular-nums text-gray-400 sm:inline">{ago(run.lastAt)}</span>
      <Button asChild size="sm" variant="ghost" className="h-8 shrink-0">
        <Link to={`/projetos/${run.projectId}`}>Abrir</Link>
      </Button>
      <button
        type="button"
        className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Tirar da lista"
        aria-label={`Tirar ${run.agent} em ${run.projectName ?? 'projeto'} da lista`}
        onClick={() => dismiss(run)}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}
