import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Link2, Link2Off, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Sides } from './settingsModel'

/**
 * Controles compactos do painel de propriedades: uma linha por ajuste, rótulo
 * à esquerda. Número aceita digitar, setas (Shift = 10) e arrastar o rótulo.
 */

export const inputClass =
  'h-7 w-full min-w-0 rounded-md border border-transparent bg-gray-100 px-2 text-[11px] text-gray-900 outline-none transition-[border-color,background-color,box-shadow] placeholder:text-gray-400 hover:bg-gray-200/70 focus:border-violet-400 focus:bg-white focus:shadow-[0_0_0_2px_rgb(124_58_237/0.15)]'

export const Group: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode; defaultOpen?: boolean }> = ({
  title,
  children,
  action,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-gray-100 px-3 py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1 rounded text-[11px] font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <ChevronDown className={cn('h-3 w-3 text-gray-400 transition-transform', !open && '-rotate-90')} />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-2 space-y-1.5">{children}</div>}
    </section>
  )
}

interface RowProps {
  label: string
  children: React.ReactNode
  /** O tamanho de tela tem valor próprio: marca e botão para voltar a herdar. */
  own?: boolean
  onReset?: () => void
  hint?: string
  /** Arrastar o rótulo muda o número (como no Framer). */
  onScrub?: (delta: number) => void
}

export const Row: React.FC<RowProps> = ({ label, children, own, onReset, hint, onScrub }) => {
  const scrub = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!onScrub || event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    let lastX = event.clientX
    let carry = 0
    const move = (ev: PointerEvent) => {
      carry += (ev.clientX - lastX) * (ev.shiftKey ? 10 : 1)
      lastX = ev.clientX
      const step = Math.trunc(carry / 2)
      if (step) {
        carry -= step * 2
        onScrub(step)
      }
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = 'ew-resize'
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn('flex w-[76px] shrink-0 select-none items-center gap-1 text-[11px] text-gray-500', onScrub && 'cursor-ew-resize')}
        onPointerDown={scrub}
        title={hint}
      >
        <span className="truncate">{label}</span>
        {own && (
          <button
            type="button"
            onClick={onReset}
            className="group/reset relative flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
            aria-label={`${label}: voltar a herdar da tela maior`}
            title="Ajustado nesta tela. Clique para voltar a herdar da tela maior."
          >
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 group-hover/reset:hidden" />
            <RotateCcw className="hidden h-3 w-3 text-violet-600 group-hover/reset:block" />
          </button>
        )}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  )
}

/** Número com unidade opcional; vazio = herdar. Commit ao digitar (o desfazer junta os passos). */
export const NumberInput: React.FC<{
  value: number | null
  placeholder?: string
  unit?: string
  min?: number
  max?: number
  step?: number
  onChange: (value: number | null) => void
  label: string
  className?: string
}> = ({ value, placeholder, unit, min, max, step = 1, onChange, label, className }) => {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value === null ? '' : String(value))
  }, [value])
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
  const commit = (text: string) => {
    const trimmed = text.trim().replace(',', '.')
    if (!trimmed) return onChange(null)
    const n = Number(trimmed)
    if (Number.isFinite(n)) onChange(clamp(n))
  }
  return (
    <label className={cn('relative flex min-w-0 flex-1 items-center', className)}>
      <span className="sr-only">{label}</span>
      <input
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          setDraft(value === null ? '' : String(value))
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          commit(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          const base = value ?? (placeholder ? Number(placeholder) || 0 : 0)
          const next = clamp(Math.round((base + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)) * 100) / 100)
          setDraft(String(next))
          onChange(next)
        }}
        className={cn(inputClass, unit && 'pr-6', 'tabular-nums')}
      />
      {unit && <span className="pointer-events-none absolute right-2 text-[10px] text-gray-400">{unit}</span>}
    </label>
  )
}

export const TextInput: React.FC<{ value: string; placeholder?: string; onChange: (value: string) => void; label: string; mono?: boolean }> = ({
  value,
  placeholder,
  onChange,
  label,
  mono,
}) => (
  <label className="flex min-w-0 flex-1">
    <span className="sr-only">{label}</span>
    <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, mono && 'font-mono')} spellCheck={!mono} />
  </label>
)

export const TextArea: React.FC<{ value: string; placeholder?: string; onChange: (value: string) => void; label: string; rows?: number; mono?: boolean }> = ({
  value,
  placeholder,
  onChange,
  label,
  rows = 3,
  mono,
}) => (
  <label className="block">
    <span className="mb-1 block text-[11px] text-gray-500">{label}</span>
    <textarea
      value={value}
      placeholder={placeholder}
      rows={rows}
      spellCheck={!mono}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, 'h-auto resize-y py-1.5 leading-relaxed', mono && 'font-mono text-[10.5px]')}
    />
  </label>
)

export interface Option<T extends string> {
  value: T
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T | ''; options: Option<T>[]; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-1 rounded-md bg-gray-100 p-0.5">
      {options.map((option) => {
        const Icon = option.icon
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-6 min-w-0 flex-1 items-center justify-center rounded px-1 text-[10.5px] font-medium transition-[color,background-color,box-shadow,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="truncate">{option.label}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Select<T extends string>({ value, options, onChange, label, placeholder }: { value: T | ''; options: Option<T>[]; onChange: (value: T | '') => void; label: string; placeholder?: string }) {
  return (
    <label className="relative flex min-w-0 flex-1 items-center">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T | '')} className={cn(inputClass, 'appearance-none pr-6')}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-gray-400" />
    </label>
  )
}

export const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative h-4 w-7 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1',
      checked ? 'bg-violet-600' : 'bg-gray-300'
    )}
  >
    <span className={cn('absolute left-0 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-3.5' : 'translate-x-0.5')} />
  </button>
)

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** Cor: amostra (seletor do sistema), hexadecimal e as cores da marca a um clique. */
export const ColorInput: React.FC<{ value: string; placeholder?: string; swatches: { name: string; hex: string }[]; onChange: (value: string | null) => void; label: string }> = ({
  value,
  placeholder,
  swatches,
  onChange,
  label,
}) => {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const shown = value || placeholder || ''
  const solid = /^#[0-9a-f]{6}$/i.test(shown) ? shown : '#000000'
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <label
          className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]"
          style={{ background: shown || 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 8px 8px' }}
          title="Escolher cor"
        >
          <span className="sr-only">{label}</span>
          <input type="color" value={solid} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <input
          value={draft}
          placeholder={placeholder || 'Sem cor'}
          aria-label={`${label} em hexadecimal`}
          onChange={(e) => {
            setDraft(e.target.value)
            const v = e.target.value.trim()
            if (HEX.test(v)) onChange(v.startsWith('#') ? v : `#${v}`)
          }}
          onBlur={() => setDraft(value)}
          className={cn(inputClass, 'font-mono uppercase')}
          spellCheck={false}
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} className="rounded p-0.5 text-gray-300 hover:text-gray-600" aria-label={`Tirar ${label}`} title="Tirar a cor (volta ao padrão)">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {swatches.length > 0 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Cores da marca">
          {swatches.slice(0, 10).map((swatch) => (
            <button
              key={swatch.name + swatch.hex}
              type="button"
              title={`${swatch.name} ${swatch.hex}`}
              aria-label={`Usar ${swatch.name}`}
              onClick={() => onChange(swatch.hex)}
              className={cn(
                'h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)] transition-transform hover:scale-110 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                value.toLowerCase() === swatch.hex.toLowerCase() && 'ring-2 ring-violet-500 ring-offset-1'
              )}
              style={{ background: swatch.hex }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Quatro lados (padding, margem); ligados, um número vale para todos. */
export const SidesInput: React.FC<{ value: Sides | null; placeholder: Sides | null; onChange: (value: Sides | null) => void; label: string }> = ({ value, placeholder, onChange, label }) => {
  const current = value ?? placeholder ?? [0, 0, 0, 0]
  const uniform = current.every((n) => n === current[0])
  const [linked, setLinked] = useState(uniform)
  useEffect(() => {
    if (!uniform) setLinked(false)
  }, [uniform])
  const set = (side: number, n: number | null) => {
    if (n === null) return onChange(null)
    const next = [...current] as Sides
    if (linked) next.fill(n)
    else next[side] = n
    onChange(next)
  }
  const names = ['Cima', 'Direita', 'Baixo', 'Esquerda']
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {linked ? (
        <NumberInput label={`${label} em todos os lados`} value={value ? value[0] : null} placeholder={placeholder ? String(placeholder[0]) : '0'} min={0} onChange={(n) => set(0, n)} />
      ) : (
        names.map((name, i) => (
          <NumberInput key={name} label={`${label}: ${name}`} value={value ? value[i] : null} placeholder={placeholder ? String(placeholder[i]) : '0'} min={0} onChange={(n) => set(i, n)} className="[&_input]:px-1 [&_input]:text-center" />
        ))
      )}
      <button
        type="button"
        onClick={() => setLinked((v) => !v)}
        aria-pressed={linked}
        className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        title={linked ? 'Separar os lados (cima, direita, baixo, esquerda)' : 'Um valor para todos os lados'}
        aria-label={linked ? 'Separar os lados' : 'Ligar os lados'}
      >
        {linked ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

/** Grade 3×3 de alinhamento: linha e coluna escolhidas (0 início, 1 centro, 2 fim). */
export const AlignGrid: React.FC<{ value: { row: number | null; col: number | null }; onChange: (row: number, col: number) => void; label: string }> = ({ value, onChange, label }) => (
  <div role="group" aria-label={label} className="grid h-[54px] w-[54px] shrink-0 grid-cols-3 grid-rows-3 gap-px rounded-md bg-gray-100 p-1">
    {[0, 1, 2].map((row) =>
      [0, 1, 2].map((col) => {
        const active = (value.row === null || value.row === row) && (value.col === null || value.col === col) && (value.row !== null || value.col !== null)
        const exact = value.row === row && value.col === col
        return (
          <button
            key={`${row}-${col}`}
            type="button"
            aria-pressed={exact}
            aria-label={`${['Em cima', 'No meio', 'Embaixo'][row]}, ${['à esquerda', 'no centro', 'à direita'][col]}`}
            onClick={() => onChange(row, col)}
            className="group flex items-center justify-center rounded-sm hover:bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
          >
            <span className={cn('rounded-full transition-colors', exact ? 'h-2 w-2 bg-violet-600' : active ? 'h-1.5 w-1.5 bg-violet-300' : 'h-1 w-1 bg-gray-400 group-hover:bg-gray-600')} />
          </button>
        )
      })
    )}
  </div>
)
