import type { AgentStatus } from '@/features/space/bridge/agentsStore'

/** Cor do agente (a mesma do painel no canvas). */
export const AGENT_COLOR = '#D97757'

export const STATUS: Record<AgentStatus, { label: string; dot: string; text: string; pulse: boolean }> = {
  working: { label: 'Trabalhando', dot: 'bg-[#D97757]', text: 'text-[#B4532F]', pulse: true },
  question: { label: 'Esperando você', dot: 'bg-violet-600', text: 'text-violet-700', pulse: true },
  done: { label: 'Terminou', dot: 'bg-emerald-600', text: 'text-emerald-700', pulse: false },
  idle: { label: 'Parado', dot: 'bg-gray-300', text: 'text-gray-500', pulse: false },
}

export const WHERE = {
  canvas: 'no canvas',
  background: 'em segundo plano',
} as const

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

/** "há 2 minutos", "agora mesmo". */
export const ago = (at: number, now = Date.now()) => {
  const seconds = Math.round((at - now) / 1000)
  if (seconds > -45) return 'agora mesmo'
  const minutes = Math.round(seconds / 60)
  if (minutes > -60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours > -24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

export const clock = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
