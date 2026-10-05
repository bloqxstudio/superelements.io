import React from 'react'
import { CHAT_AGENTS, type ChatAgentId } from './protocol'

/**
 * Selo redondo de cada agente, no chat e no cursor: o Claude Code com a
 * faísca, o Codex com a bolinha em degradê. Desenhos nossos, não os logos.
 */
export const AgentMark: React.FC<{ agent: ChatAgentId | undefined; size?: number; className?: string }> = ({ agent, size = 18, className }) => {
  if (agent === 'codex') {
    return (
      <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white ${className ?? ''}`} style={{ width: size, height: size }}>
        <span
          className="rounded-full"
          style={{ width: size * 0.62, height: size * 0.62, background: 'radial-gradient(circle at 32% 30%, #E0E7FF 0%, #818CF8 34%, #4F46E5 64%, #1E1B4B 100%)' }}
        />
      </span>
    )
  }
  const color = agent ? CHAT_AGENTS[agent].color : '#7C3AED'
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 16 16" width={size * 0.66} height={size * 0.66} fill={color}>
        {[0, 45, 90, 135].map((angle) => (
          <rect key={angle} x="7.1" y="1" width="1.8" height="14" rx="0.9" transform={`rotate(${angle} 8 8)`} />
        ))}
      </svg>
    </span>
  )
}
