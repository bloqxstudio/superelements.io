import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Presence } from './presence'

interface PresenceStackProps {
  presence: Presence[]
  /** Quantas bolinhas antes do "+N". */
  max?: number
  size?: number
  /** Cor do anel que separa uma bolinha da outra (a do fundo onde a fileira está). */
  ring?: string
  className?: string
}

/**
 * Bolinhas de quem está no projeto (ou na página), como no Framer e no Figma:
 * pessoas com a inicial, agentes com o nome no lugar do logo. A dica diz quem
 * é e o que está fazendo.
 */
export const PresenceStack: React.FC<PresenceStackProps> = ({ presence, max = 4, size = 26, ring = '#ffffff', className }) => {
  if (!presence.length) return null
  const shown = presence.slice(0, max)
  const rest = presence.length - shown.length
  return (
    <div className={cn('flex items-center', className)} aria-label={`No projeto agora: ${presence.map((p) => p.name).join(', ')}`}>
      {shown.map((p, i) => (
        <Tooltip key={p.key}>
          <TooltipTrigger asChild>
            <span
              className="relative flex shrink-0 select-none items-center justify-center rounded-full font-semibold"
              style={{
                width: size,
                height: size,
                fontSize: Math.round(size * 0.42),
                background: p.color,
                color: p.ink,
                marginLeft: i ? -Math.round(size * 0.28) : 0,
                boxShadow: `0 0 0 2px ${ring}`,
                zIndex: shown.length - i,
              }}
            >
              {p.kind === 'agent' ? <AgentGlyph name={p.name} /> : p.initial}
              {p.kind === 'agent' && (
                <span aria-hidden className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" style={{ boxShadow: `0 0 0 1.5px ${ring}` }} />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64 text-xs">
            <p className="font-medium">
              {p.name}
              {p.kind === 'agent' && <span className="font-normal text-muted-foreground"> · agente</span>}
            </p>
            {p.doing && <p className="text-muted-foreground">{p.doing}</p>}
          </TooltipContent>
        </Tooltip>
      ))}
      {rest > 0 && (
        <span
          className="relative flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-medium text-gray-700"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.38), marginLeft: -Math.round(size * 0.28), boxShadow: `0 0 0 2px ${ring}` }}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

/** Agente sem logo: as iniciais do nome ("CC" para Claude Code, "Cx" para Codex). */
const AgentGlyph: React.FC<{ name: string }> = ({ name }) => {
  const words = name.split(/\s+/)
  const text = words.length > 1 ? words.map((w) => w.charAt(0)).join('').slice(0, 2) : name.slice(0, 2)
  return <span className="text-[0.82em] tracking-[-0.04em]">{text}</span>
}
