import React from 'react'
import type { ChatAgentId, ChatAgentModel } from '@/features/space/chat/protocol'
import { cn } from '@/lib/utils'
import { modelName, modelOptions } from './modelos'

/**
 * Escolha do modelo de um agente: os fixos do Claude Code ou os que o Codex desta máquina lista. `fallback` é a
 * primeira opção (valor `''`): "Padrão" no chat, "Do chat (Sonnet)" numa tarefa.
 */
export const ModelSelect: React.FC<{
  agent: ChatAgentId
  value: string
  onChange: (model: string) => void
  listed?: ChatAgentModel[]
  /** Texto da opção vazia; sem ele não há opção vazia. */
  fallback?: string
  disabled?: boolean
  label: string
  className?: string
}> = ({ agent, value, onChange, listed, fallback, disabled, label, className }) => {
  const options = modelOptions(agent, listed)
  // Um modelo guardado que a máquina não lista mais continua aparecendo, para não trocar sozinho
  const known = !value || options.some((m) => m.id === value)
  const hint = options.find((m) => m.id === value)?.hint
  // Agrupado por família (Fable, Opus, Sonnet, Haiku) quando a lista diz a família, na ordem em que aparecem
  const groups: [string, typeof options][] = []
  for (const m of options) {
    const last = groups[groups.length - 1]
    if (last && last[0] === (m.group ?? '')) last[1].push(m)
    else groups.push([m.group ?? '', [m]])
  }
  if (!options.length && !fallback) return null
  return (
    <label
      className={cn('relative inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100', className)}
      title={`${label}: ${value ? modelName(agent, value, listed) : fallback}${hint ? `. ${hint}` : ''}`}
    >
      <span className="shrink-0 text-gray-400">Modelo</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 max-w-[9.5rem] cursor-pointer appearance-none truncate bg-transparent pr-3 font-semibold text-gray-900 outline-none disabled:cursor-default disabled:opacity-60"
      >
        {fallback !== undefined && <option value="">{fallback}</option>}
        {!known && <option value={value}>{value}</option>}
        {groups.map(([group, items]) =>
          group ? (
            <optgroup key={group} label={group}>
              {items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ) : (
            items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))
          )
        )}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-1.5 text-[8px] text-gray-400">
        ▼
      </span>
    </label>
  )
}
