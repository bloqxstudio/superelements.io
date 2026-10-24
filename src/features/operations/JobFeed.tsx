import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Job } from './jobs'

/** Relógio que avança a cada segundo enquanto há algo rodando. */
export const useSeconds = (active = true) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export const elapsed = (from: number, to: number) => {
  const s = Math.max(0, Math.round((to - from) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** O trabalho de um agente ao vivo: quem, há quanto tempo, o passo de agora e o diário. */
export const JobFeed: React.FC<{ job: Job; lines?: number; className?: string }> = ({ job, lines = 5, className }) => {
  const now = useSeconds(job.status === 'running')
  const log = (job.log ?? []).slice(-lines)
  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-2.5', className)} role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-xs font-semibold text-gray-900">
        {job.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: job.color }} /> : <span className="h-2 w-2 rounded-full bg-emerald-500" />}
        <span className="min-w-0 flex-1 truncate">{job.agent}</span>
        <span className="tabular-nums text-gray-500">{elapsed(job.startedAt, job.endedAt ?? now)}</span>
      </p>
      {job.status === 'running' && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-1/3 rounded-full motion-safe:animate-[jobbar_1.4s_ease-in-out_infinite]" style={{ background: job.color ?? '#7c3aed' }} /></div>
      )}
      <ul className="mt-2 space-y-0.5">
        {log.map((l, i) => (
          <li key={`${l.at}-${i}`} className={cn('flex gap-1.5 text-[11px] leading-snug', i === log.length - 1 && job.status === 'running' ? 'font-medium text-gray-900' : 'text-gray-500')}>
            <span className="tabular-nums text-gray-400">{elapsed(job.startedAt, l.at)}</span>
            <span className="min-w-0 break-words">{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
