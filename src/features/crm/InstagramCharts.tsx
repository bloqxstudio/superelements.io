import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { compact } from './instagram'

/**
 * Gráficos da tela do Instagram, sem biblioteca: uma linha por dia (alcance,
 * seguidores) com cruz e dica ao passar o mouse ou com as setas, e barras
 * horizontais para formatos e público. Uma série por gráfico, um tom só.
 */

export interface Point {
  /** `2026-10-24` */
  day: string
  value: number
}

const dayDate = (day: string) => new Date(`${day}T12:00:00`)
export const shortDay = (day: string) => dayDate(day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
const longDay = (day: string) => {
  const text = dayDate(day).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Topo do eixo e as marcas, em números redondos (até 4 faixas). */
function scale(max: number, min = 0) {
  const span = Math.max(1, max - min)
  const raw = span / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => span / s <= 4) ?? 10 * magnitude
  const low = Math.floor(min / step) * step
  const high = Math.max(low + step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let t = low; t <= high + step / 2; t += step) ticks.push(t)
  return { low, high, ticks }
}

const TONES = {
  dark: { line: '#FAFAFA', fill: 'rgba(250,250,250,0.10)', grid: 'rgba(255,255,255,0.08)', axis: '#a1a1aa', surface: '#18181b' },
  light: { line: '#18181b', fill: 'rgba(24,24,27,0.08)', grid: '#f1f1f3', axis: '#71717a', surface: '#ffffff' },
}

export const TrendChart: React.FC<{
  points: Point[]
  /** "contas alcançadas" */
  unit: string
  /** Nome do gráfico para leitores de tela. */
  label: string
  tone?: keyof typeof TONES
  area?: boolean
  height?: number
  /** Eixo começa no menor valor (seguidores), não no zero. */
  fromMin?: boolean
  /** Valor na dica (dinheiro); sem ele, o número com `unit` ao lado. */
  format?: (n: number) => string
  className?: string
}> = ({ points, unit, label, tone = 'light', area = true, height = 240, fromMin, format, className }) => {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const colors = TONES[tone]

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => setActive(null), [points])

  const values = points.map((p) => p.value)
  const max = Math.max(...values, 1)
  const min = fromMin ? Math.min(...values) : 0
  const { low, high, ticks } = scale(max, fromMin ? min : 0)
  const pad = { left: 44, right: 14, top: 14, bottom: 26 }
  const innerW = Math.max(1, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const x = (i: number) => pad.left + (points.length < 2 ? innerW / 2 : (i * innerW) / (points.length - 1))
  const y = (v: number) => pad.top + (1 - (v - low) / (high - low || 1)) * innerH

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const fill = points.length > 1 ? `${line}L${x(points.length - 1).toFixed(1)},${y(low).toFixed(1)}L${x(0).toFixed(1)},${y(low).toFixed(1)}Z` : ''
  const labels = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i)

  const pick = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || !points.length) return
    const rel = clientX - rect.left - pad.left
    const i = points.length < 2 ? 0 : Math.round((rel / innerW) * (points.length - 1))
    setActive(Math.max(0, Math.min(points.length - 1, i)))
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!points.length) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const step = e.key === 'ArrowRight' ? 1 : -1
      setActive((a) => Math.max(0, Math.min(points.length - 1, (a ?? (step > 0 ? -1 : points.length)) + step)))
    }
    if (e.key === 'Escape') setActive(null)
  }

  const current = active !== null ? points[active] : undefined
  const tipLeft = active !== null ? x(active) : 0
  const flip = tipLeft > width - 170

  return (
    <div
      ref={box}
      className={cn('relative select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}
      style={{ height }}
      tabIndex={points.length ? 0 : -1}
      role="img"
      aria-label={`${label}. Use as setas para ler cada dia.`}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={colors.grid} strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={colors.axis} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {compact(t)}
              </text>
            </g>
          ))}
          {labels.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'} fontSize={11} fill={colors.axis}>
              {shortDay(points[i].day)}
            </text>
          ))}
          {area && fill && <path d={fill} fill={colors.fill} />}
          {points.length > 1 && <path d={line} fill="none" stroke={colors.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {points.length === 1 && <circle cx={x(0)} cy={y(points[0].value)} r={4} fill={colors.line} stroke={colors.surface} strokeWidth={2} />}
          {current && active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} stroke={colors.axis} strokeWidth={1} />
              <circle cx={x(active)} cy={y(current.value)} r={4.5} fill={colors.line} stroke={colors.surface} strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {current && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg bg-white px-3 py-2 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_8px_24px_-8px_rgb(0_0_0/0.3)]"
          style={flip ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}
        >
          <p className="text-sm font-semibold tabular-nums text-gray-900">
            {format ? format(current.value) : current.value.toLocaleString('pt-BR')} {unit && <span className="font-normal text-gray-500">{unit}</span>}
          </p>
          <p className="text-xs text-gray-500">{longDay(current.day)}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <th scope="row">{longDay(p.day)}</th>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Um número grande com o rótulo em cima e o contexto embaixo (o primeiro da fileira vem escuro). */
export const Stat: React.FC<{ label: string; value: string; sub?: React.ReactNode; dark?: boolean; children?: React.ReactNode }> = ({ label, value, sub, dark, children }) => (
  <div className={cn('flex min-h-[124px] flex-col rounded-xl p-4', dark ? 'bg-zinc-900 text-white' : 'bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]')}>
    <p className={cn('text-xs font-medium', dark ? 'text-zinc-300' : 'text-gray-500')}>{label}</p>
    <p className={cn('mt-1 text-[28px] font-semibold leading-tight tracking-tight', dark ? 'text-white' : 'text-gray-900')}>{value}</p>
    {sub && <p className={cn('mt-auto pt-2 text-xs', dark ? 'text-zinc-400' : 'text-gray-500')}>{sub}</p>}
    {children}
  </div>
)

/** Linha mínima, sem eixos, para a tendência dentro de um cartão de número. */
export const Sparkline: React.FC<{ values: number[]; color?: string; className?: string }> = ({ values, color = 'currentColor', className }) => {
  if (values.length < 2) return null
  // Larga como o cartão: o viewBox na proporção dele preenche a largura sem distorcer o ponto
  const w = 240
  const h = 32
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i * w) / (values.length - 1)).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join('')
  const last = values.length - 1
  return (
    <svg viewBox={`-4 -4 ${w + 8} ${h + 8}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={w} cy={h - 2 - ((values[last] - min) / span) * (h - 4)} r={3} fill={color} />
    </svg>
  )
}

/** Uma barra por linha, com o nome e o valor ao lado (a lista já é a tabela). */
export const BarList: React.FC<{ rows: { label: string; value: number; note?: string }[]; format?: (n: number) => string; className?: string }> = ({ rows, format = compact, className }) => {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className={cn('grid gap-3', className)}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-gray-700">
              {row.label}
              {row.note && <span className="ml-1.5 text-xs text-gray-400">{row.note}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-gray-900">{format(row.value)}</span>
          </div>
          <div className="h-2 rounded-r bg-gray-100" aria-hidden>
            <div className="h-2 rounded-r bg-gray-900" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
