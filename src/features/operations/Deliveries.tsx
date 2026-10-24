import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { elapsed, useSeconds } from './JobFeed'
import { AREAS, useJobs, type Area } from './jobs'

/** Há quanto tempo, em português curto. */
const ago = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * As últimas entregas: tudo o que os agentes terminaram (e o que foi enviado
 * para Criativos e Projetos), do mais novo ao mais antigo, cada uma com o
 * caminho direto para abrir. Fica guardado neste navegador.
 */
export const Deliveries: React.FC = () => {
  const jobs = useJobs((s) => s.jobs)
  const now = useSeconds(true)
  const [area, setArea] = useState<Area | 'todas'>('todas')
  const done = jobs.filter((j) => j.status !== 'running' && (area === 'todas' || j.area === area)).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))

  return (
    <section aria-label="Últimas entregas" className="mt-10">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Últimas entregas</h2>
        <div className="ml-auto flex flex-wrap gap-1" role="group" aria-label="Filtrar por área">
          {(['todas', ...(Object.keys(AREAS) as Area[])] as const).map((a) => (
            <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(a)} className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', area === a ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50')}>{a === 'todas' ? 'Todas' : AREAS[a].label}</button>
          ))}
        </div>
      </div>
      {done.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">Nenhuma entrega ainda. O que os agentes terminarem aparece aqui, com o link para abrir.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
          {done.slice(0, 40).map((j) => {
            const body = (
              <>
                {j.status === 'error' ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-label="Não terminou" /> : <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Entregue" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{j.kind} · {j.label}</span>
                  <span className="block truncate text-xs text-gray-500">{AREAS[j.area].label} · {j.agent}{j.status === 'error' ? ` · ${j.error ?? 'não terminou'}` : j.endedAt && j.endedAt - j.startedAt > 4000 ? ` · levou ${elapsed(j.startedAt, j.endedAt)}` : ''}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">{ago(j.endedAt ?? j.startedAt, now)}</span>
                {j.href && <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />}
              </>
            )
            return (
              <li key={j.id}>
                {j.href ? (
                  <Link to={j.href} className="flex items-start gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none">{body}</Link>
                ) : (
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
