import React from 'react'
import { NavLink } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { agentStatus, useAgents } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'
import { AGENT_COLOR } from './agentStatus'
import { useTick } from './useTick'

/** Atalho para a tela Agentes no header, com quantos trabalham e quantos esperam uma resposta. */
export const AgentsButton: React.FC = () => {
  const connected = useAgents((s) => s.connected)
  const agents = useAgents((s) => s.agents)
  const now = useTick()
  if (!connected) return null

  const working = agents.filter((a) => agentStatus(a, now) === 'working').length
  const asking = agents.filter((a) => agentStatus(a, now) === 'question').length
  const label = [working && `${working} trabalhando`, asking && `${asking} esperando você`].filter(Boolean).join(', ')

  return (
    <NavLink
      to="/agentes"
      title={label ? `Agentes: ${label}` : 'Agentes'}
      aria-label={label ? `Agentes: ${label}` : 'Agentes'}
      className={({ isActive }) =>
        cn(
          'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]',
          isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )
      }
    >
      <Bot className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Agentes</span>
      {working > 0 && (
        <span className="flex items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold tabular-nums text-white" style={{ background: AGENT_COLOR }}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
          {working}
        </span>
      )}
      {asking > 0 && <span className="rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold tabular-nums text-white">{asking}</span>}
    </NavLink>
  )
}
