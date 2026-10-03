import React, { useMemo } from 'react'
import { Bot } from 'lucide-react'
import { AgentRunCard, AgentRunRow } from '@/features/agents/AgentRunCard'
import { useTick } from '@/features/agents/useTick'
import { useProjectList } from '@/features/projects/projectStore'
import { agentStatus, RECENT_FOR, useAgents, type AgentRun } from '@/features/space/bridge/agentsStore'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { cn } from '@/lib/utils'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="mt-8">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
    {children}
  </section>
)

/**
 * Os agentes trabalhando agora, cada um no seu projeto e ao mesmo tempo: o
 * que perguntou primeiro (é onde a pessoa entra), depois quem está
 * trabalhando, com a página sendo montada ao vivo, e por fim quem terminou.
 */
const Agents: React.FC = () => {
  // Nomes dos projetos e o projeto para abrir o segundo plano vêm da lista da conta
  useProjectList()
  const connected = useAgents((s) => s.connected)
  const agents = useAgents((s) => s.agents)
  const now = useTick()

  const groups = useMemo(() => {
    const recent = agents.filter((a) => now - a.lastAt < RECENT_FOR)
    const by = (status: ReturnType<typeof agentStatus>) => recent.filter((a) => agentStatus(a, now) === status)
    return { question: by('question'), working: by('working'), finished: [...by('done'), ...by('idle')].sort((a, b) => b.lastAt - a.lastAt) }
  }, [agents, now])

  const active = groups.question.length + groups.working.length
  const projects = new Set([...groups.question, ...groups.working].map((a) => a.projectId)).size

  const cards = (runs: AgentRun[]) => (
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      {runs.map((run) => (
        <AgentRunCard key={run.key} run={run} />
      ))}
    </div>
  )

  return (
    <div className="min-h-[calc(100vh-57px)] bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Agentes</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Cada agente trabalha no seu projeto, todos ao mesmo tempo. Você acompanha as páginas sendo montadas, responde quando um deles pergunta e aprova antes de ir para o cliente.
        </p>
        {connected && active > 0 && (
          <p className="mt-4 text-sm text-gray-700">
            {plural(active, 'agente ativo', 'agentes ativos')} em {plural(projects, 'projeto', 'projetos')}
            {groups.question.length > 0 && <span className="text-violet-700"> · {plural(groups.question.length, 'esperando você', 'esperando você')}</span>}
          </p>
        )}

        {!connected ? (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
            <Bot className="h-5 w-5 text-gray-400" aria-hidden />
            <h2 className="mt-3 text-sm font-semibold text-gray-900">A ponte dos agentes não está no ar</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Os agentes trabalham pelo app rodando neste computador (npm run dev, ou o preview do Ship Studio). Abra o app por ele para acompanhar.
            </p>
          </div>
        ) : !active && !groups.finished.length ? (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
              <Bot className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-gray-900">Nenhum agente trabalhando agora</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Peça a um agente (Claude Code ou Codex) para cuidar de um projeto. Ele abre o projeto sem mexer na sua tela e aparece aqui, com a página sendo montada.
            </p>
            <code className="mt-4 rounded-md bg-white px-2.5 py-1 text-xs text-gray-600 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">node scripts/space/space.mjs open "&lt;projeto&gt;"</code>
          </div>
        ) : (
          <>
            {groups.question.length > 0 && <Section title="Esperando você">{cards(groups.question)}</Section>}
            {groups.working.length > 0 && <Section title="Trabalhando agora">{cards(groups.working)}</Section>}
            {groups.finished.length > 0 && (
              <Section title="Terminaram ou pararam" hint="Últimas 3 horas">
                <ul className={cn('mt-3 divide-y divide-gray-100 overflow-hidden rounded-xl', ISLAND_SURFACE)}>
                  {groups.finished.map((run) => (
                    <AgentRunRow key={run.key} run={run} />
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Agents
