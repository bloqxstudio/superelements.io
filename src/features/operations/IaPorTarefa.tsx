import React from 'react'
import { useCreativeLink } from '@/features/criativos/link'
import { IA_TASKS, useIa, type IaTask } from '@/features/ia/porTarefa'
import { CHAT_AGENTS, type ChatAgentId } from '@/features/space/chat/protocol'
import { cn } from '@/lib/utils'

const Row: React.FC<{ task: IaTask; label: string; hint: string }> = ({ task, label, hint }) => {
  const agents = useCreativeLink((s) => s.agents)
  const { ia, pick } = useIa(task)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5" role="group" aria-label={`IA para ${label}`}>
        {(['claude', 'codex'] as ChatAgentId[]).map((id) => {
          const ok = !!agents.find((a) => a.id === id)?.available
          return (
            <button
              key={id}
              type="button"
              disabled={!ok}
              onClick={() => pick(id)}
              title={ok ? CHAT_AGENTS[id].name : `${CHAT_AGENTS[id].name} não foi encontrado neste computador`}
              className={cn('h-7 rounded-md px-3 text-xs font-semibold disabled:opacity-40', ia === id && ok ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
            >
              {CHAT_AGENTS[id].name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Qual IA faz cada tipo de trabalho: vale para tudo o que roda daqui em diante, inclusive em segundo plano. */
export const IaPorTarefa: React.FC = () => (
  <section className="rounded-xl border border-gray-200 bg-white p-4">
    <h2 className="text-sm font-semibold text-gray-900">IA de cada trabalho</h2>
    <p className="text-xs text-gray-500">Escolha qual IA faz cada tipo de tarefa. As imagens geradas seguem a configuração do editor de criativos.</p>
    <div className="mt-1 divide-y divide-gray-100">
      {IA_TASKS.map((t) => (
        <Row key={t.id} task={t.id} label={t.label} hint={t.hint} />
      ))}
    </div>
  </section>
)
