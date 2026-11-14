import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addDays, dayKey, dayLong, dayStart, daySpan, spanBounds, spanLong, spanShort, todayKey, type DaySpan } from '@/lib/day'

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/**
 * O botão "Dia" dos seletores de período: abre um calendário de um mês e escolhe um dia ou um intervalo.
 * O primeiro clique marca o começo, o segundo o fim (o mesmo dia duas vezes é um dia só); dá para trocar de
 * mês entre os dois. Fica dentro do grupo de pílulas de período; com algo escolhido, a pílula mostra as datas
 * e fica ativa. O valor é o trecho de `@/lib/day` (`2026-10-30` ou `2026-10-25~2026-10-31`).
 */
export const DayPicker: React.FC<{
  value?: DaySpan | null
  onChange: (span: DaySpan) => void
  /** Primeiro dia possível (`YYYY-MM-DD`); antes dele os dias ficam apagados */
  min?: string
  /** Último dia possível; hoje quando não vem */
  max?: string
  /** Uma linha sob o calendário, como "A Meta guarda 37 meses" */
  hint?: string
  /** `pill`: grupo de pílulas das telas do CRM; `segment`: o seletor cinza do Início */
  variant?: 'pill' | 'segment'
  className?: string
}> = ({ value, onChange, min, max, hint, variant = 'pill', className }) => {
  const last = max ?? todayKey()
  const chosen = value ? spanBounds(value) : null
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => (chosen?.to ?? last).slice(0, 7))
  /** O começo marcado, à espera do fim */
  const [start, setStart] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (open) setMonth((chosen?.to ?? last).slice(0, 7))
    setStart(null)
    setHover(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, last])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const cells = useMemo(() => {
    const first = dayStart(`${month}-01`)
    const out: (string | null)[] = Array(first.getDay()).fill(null)
    for (const d = new Date(first); d.getMonth() === first.getMonth(); d.setDate(d.getDate() + 1)) out.push(dayKey(d))
    return out
  }, [month])

  const shift = (n: number) => {
    const d = dayStart(`${month}-01`)
    d.setMonth(d.getMonth() + n)
    setMonth(dayKey(d).slice(0, 7))
  }
  const canBack = !min || `${month}-01` > min
  const nextFirst = dayStart(`${month}-01`)
  nextFirst.setMonth(nextFirst.getMonth() + 1)
  const canNext = dayKey(nextFirst) <= last
  const title = dayStart(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const today = todayKey()
  const done = (span: DaySpan) => {
    onChange(span)
    setOpen(false)
  }
  const click = (key: string) => {
    if (!start) return setStart(key)
    done(daySpan(start, key))
  }
  // O que aparece marcado: o trecho sendo escolhido (começo até o dia sob o mouse) ou o escolhido
  const shown = start ? spanBounds(daySpan(start, hover ?? start)) : chosen
  const inShown = (key: string) => !!shown && key >= shown.from && key <= shown.to
  const isEdge = (key: string) => !!shown && (key === shown.from || key === shown.to)
  const clampFrom = (key: string) => (min && key < min ? min : key)
  const lastWeek = (() => {
    // De domingo a sábado da semana passada
    const sunday = addDays(today, -dayStart(today).getDay() - 7)
    return daySpan(clampFrom(sunday), addDays(sunday, 6))
  })()
  const lastMonth = (() => {
    const d = dayStart(`${today.slice(0, 7)}-01`)
    const end = addDays(dayKey(d), -1)
    return daySpan(clampFrom(`${end.slice(0, 7)}-01`), end)
  })()

  return (
    <span ref={box} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-pressed={!!value}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={value ? `Escolhido: ${spanLong(value)}` : 'Ver um dia ou um intervalo de datas'}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium transition-colors',
          variant === 'pill' ? 'h-7 rounded-full px-3 text-xs' : 'h-8 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          value ? (variant === 'pill' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 shadow-sm') : 'text-gray-600 hover:text-gray-900'
        )}
      >
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        {value ? spanShort(value) : 'Datas'}
      </button>
      {open && (
        <div role="dialog" aria-label="Escolher um dia ou um intervalo" className="absolute right-0 top-full z-50 mt-2 w-[264px] max-w-[calc(100vw-2rem)] rounded-xl bg-white p-3 text-gray-900 shadow-lg ring-1 ring-gray-200">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} disabled={!canBack} aria-label="Mês anterior" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize">{title}</span>
            <button type="button" onClick={() => shift(1)} disabled={!canNext} aria-label="Próximo mês" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center" onPointerLeave={() => setHover(null)}>
            {WEEK.map((w, i) => (
              <span key={i} className="pb-1 text-[11px] font-medium text-gray-400" aria-hidden>
                {w}
              </span>
            ))}
            {cells.map((key, i) =>
              key ? (
                <button
                  key={key}
                  type="button"
                  disabled={key > last || (!!min && key < min)}
                  onClick={() => click(key)}
                  onPointerEnter={() => start && setHover(key)}
                  onFocus={() => start && setHover(key)}
                  aria-label={dayLong(key)}
                  aria-pressed={inShown(key)}
                  aria-current={key === today ? 'date' : undefined}
                  className={cn(
                    'h-8 text-xs tabular-nums transition-colors disabled:cursor-default disabled:text-gray-300 disabled:hover:bg-transparent',
                    isEdge(key)
                      ? 'rounded-md bg-gray-900 font-semibold text-white'
                      : inShown(key)
                        ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                        : 'rounded-md hover:bg-gray-100',
                    key === today && !isEdge(key) && 'font-semibold text-violet-700'
                  )}
                >
                  {Number(key.slice(8))}
                </button>
              ) : (
                <span key={`v${i}`} />
              )
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-gray-500" aria-live="polite">
            {start ? 'Agora o último dia (ou o mesmo, para um dia só).' : 'Clique no primeiro e no último dia.'}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2">
            <button type="button" onClick={() => done(addDays(today, -1))} disabled={!!min && addDays(today, -1) < min} className="h-7 rounded-md px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30">
              Ontem
            </button>
            {last >= today && (
              <button type="button" onClick={() => done(today)} className="h-7 rounded-md px-2 text-xs font-medium text-gray-700 hover:bg-gray-100">
                Hoje
              </button>
            )}
            <button type="button" onClick={() => done(lastWeek)} disabled={!!min && spanBounds(lastWeek).to < min} className="h-7 rounded-md px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30">
              Semana passada
            </button>
            <button type="button" onClick={() => done(lastMonth)} disabled={!!min && spanBounds(lastMonth).to < min} className="h-7 rounded-md px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30">
              Mês passado
            </button>
          </div>
          {hint && <p className="mt-1.5 text-[11px] leading-snug text-gray-500">{hint}</p>}
        </div>
      )}
    </span>
  )
}
