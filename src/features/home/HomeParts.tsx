import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, TriangleAlert, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { freshnessOf, type Freshness } from './derive'
import type { Source } from './useHome'

/** Peças da Home: o estado de cada fonte, a variação, o cartão de número e o vazio honesto. */

export const LIME = '#D2F525'

/** Hora de agora, renovada de tempos em tempos, para "há 3 min" não ficar parado. */
export function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [every])
  return now
}

export function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'agora há pouco'
  const m = Math.round(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

export const clock = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const dayTime = (at: number, now: number) => {
  const d = new Date(at)
  return d.toDateString() === new Date(now).toDateString()
    ? `hoje, ${clock(at)}`
    : d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')
}

export type Condition = 'tempo-real' | 'atualizado' | 'atrasado' | 'indisponivel' | 'desconectado' | 'lendo'

const TONE: Record<Condition, string> = {
  'tempo-real': 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  atualizado: 'bg-gray-50 text-gray-700 ring-gray-500/20',
  atrasado: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  indisponivel: 'bg-red-50 text-red-800 ring-red-600/20',
  desconectado: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  lendo: 'bg-gray-50 text-gray-500 ring-gray-400/20',
}

/** Como está o dado: em tempo real, atualizado, atrasado, indisponível ou desconectado, com a hora e o porquê. */
export const Condition: React.FC<{ kind: Condition; label: string; title?: string }> = ({ kind, label, title }) => (
  <span title={title} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONE[kind])}>
    {kind === 'tempo-real' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />}
    {kind === 'atrasado' && <TriangleAlert aria-hidden className="h-3 w-3" />}
    {(kind === 'indisponivel' || kind === 'desconectado') && <WifiOff aria-hidden className="h-3 w-3" />}
    {label}
  </span>
)

/** A condição de uma fonte lida do banco, com o prazo em que ela conta como atualizada. */
export function conditionOf<T>(source: Source<T>, now: number, opts: { freshMs: number; realtime?: boolean; sync?: boolean }): { kind: Condition; label: string } {
  if (source.status === 'loading') return { kind: 'lendo', label: 'Lendo…' }
  if (source.status === 'off') return { kind: 'desconectado', label: 'Módulo desligado' }
  if (source.status === 'none') return { kind: 'desconectado', label: 'Não conectado' }
  if (source.status === 'error') return { kind: 'indisponivel', label: 'Indisponível' }
  if (source.error) return { kind: 'indisponivel', label: `Última leitura ${clock(source.at)}, falhou depois` }
  if (opts.realtime) return { kind: 'tempo-real', label: 'Tempo real' }
  const fresh: Freshness | undefined = freshnessOf(source.at, opts.freshMs, now)
  return fresh === 'atrasado' ? { kind: 'atrasado', label: `Atrasado · lido ${ago(source.at, now)}` } : { kind: 'atualizado', label: `Atualizado ${ago(source.at, now)}` }
}

/** Variação contra o período anterior de mesmo tamanho; sem base, não mostra percentual. */
export const Delta: React.FC<{ diff: number; pct?: number; good?: 'up' | 'down' | 'none' }> = ({ diff, pct }) => {
  if (diff === 0) return <span className="text-xs text-gray-500">igual ao período anterior</span>
  const up = diff > 0
  return (
    <span className="text-xs tabular-nums text-gray-600">
      <span aria-hidden>{up ? '↑' : '↓'}</span> {up ? '+' : '−'}
      {Math.abs(diff).toLocaleString('pt-BR')}
      {pct !== undefined && ` (${Math.round(Math.abs(pct) * 100)}%)`} <span className="text-gray-500">vs. período anterior</span>
    </span>
  )
}

/** Um número da síntese: abre a tela de origem; a explicação curta fica sempre à vista. */
export const Stat: React.FC<{ label: string; value: React.ReactNode; note?: React.ReactNode; to?: string; children?: React.ReactNode; muted?: boolean }> = ({ label, value, note, to, children, muted }) => {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {to && <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-gray-300 transition-colors group-hover:text-gray-700" />}
      </div>
      <p className={cn('mt-1 min-h-9 text-2xl font-semibold tabular-nums tracking-tight', muted ? 'text-gray-400' : 'text-gray-900')}>{value}</p>
      <div className="mt-1 min-h-4">{children}</div>
      {note && <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{note}</p>}
    </>
  )
  const cls = 'group block rounded-lg border border-gray-200 bg-white p-3.5'
  return to ? (
    <Link to={to} className={cn(cls, 'transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** O que dizer quando não há dado: o motivo e o caminho, nunca um zero no lugar. */
export const Empty: React.FC<{ title: string; text?: string; to?: string; action?: string }> = ({ title, text, to, action }) => (
  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center">
    <p className="text-sm font-medium text-gray-700">{title}</p>
    {text && <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500">{text}</p>}
    {to && action && (
      <Link to={to} className="mt-2 inline-block text-xs font-medium text-gray-900 underline underline-offset-2">
        {action}
      </Link>
    )}
  </div>
)

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => <div aria-hidden className={cn('rounded-md bg-gray-100 motion-safe:animate-pulse', className)} />

/** Título de bloco: o nome, a explicação de uma linha e o estado do dado. */
export const Block: React.FC<{ id: string; title: string; hint?: string; status?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ id, title, hint, status, children, className }) => (
  <section aria-labelledby={id} className={cn('se-surface min-w-0 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] md:p-5', className)}>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-gray-900">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
      {status}
    </div>
    {children}
  </section>
)
