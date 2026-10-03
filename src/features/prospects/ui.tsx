import React from 'react'
import { cn } from '@/lib/utils'
import { PLATFORM_LABEL, TEMPERATURE_LABEL } from './score'
import type { Platform, Temperature } from './types'

/** Superfície branca das telas do app (a mesma da tela Agentes). */
export const SURFACE = 'rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]'

const PLATFORM_TONE: Record<Platform, string> = {
  'wp-elementor': 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  wordpress: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  construtor: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  outro: 'bg-gray-50 text-gray-700 ring-gray-500/20',
  'sem-site': 'bg-violet-50 text-violet-800 ring-violet-600/20',
  'fora-do-ar': 'bg-rose-50 text-rose-800 ring-rose-600/20',
  indefinido: 'bg-gray-50 text-gray-500 ring-gray-500/20',
}

export const PlatformBadge: React.FC<{ platform: Platform; className?: string }> = ({ platform, className }) => (
  <span className={cn('inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', PLATFORM_TONE[platform], className)}>
    {PLATFORM_LABEL[platform]}
  </span>
)

const SCORE_TONE: Record<Temperature, string> = {
  quente: 'bg-gray-900 text-white',
  morna: 'bg-gray-200 text-gray-900',
  fria: 'bg-gray-100 text-gray-500',
}

export const ScorePill: React.FC<{ score: number; temperature: Temperature }> = ({ score, temperature }) => (
  <div className="flex flex-col items-start gap-1">
    <span className={cn('inline-flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 text-sm font-semibold tabular-nums', SCORE_TONE[temperature])}>{score}</span>
    <span className="text-[11px] text-gray-500">{TEMPERATURE_LABEL[temperature]}</span>
  </div>
)

export const StatTile: React.FC<{ label: string; value: number; of?: number; hint?: string }> = ({ label, value, of, hint }) => (
  <div className={cn(SURFACE, 'px-4 py-3')}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-1 flex items-baseline gap-1.5">
      <span className="text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{value}</span>
      {of !== undefined && of > 0 && <span className="text-xs tabular-nums text-gray-500">{Math.round((value / of) * 100)}%</span>}
    </p>
    {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
  </div>
)

/** Botão de escolha (nicho, filtro): fica escuro quando está ligado. */
export const Chip: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }> = ({ active, className, ...props }) => (
  <button
    type="button"
    aria-pressed={active}
    className={cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50',
      active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-gray-900',
      className
    )}
    {...props}
  />
)
