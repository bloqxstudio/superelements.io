import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { initialsOf } from './people'

/** Peças das telas do CRM, no desenho das telas da conta (Prospecção, Agentes). */

export const FIELD =
  'se-field w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-gray-50 disabled:text-gray-500'

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const dayLabel = (at: number | string) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export const whenLabel = (at: number) => {
  const date = new Date(at)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? `hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Só os dígitos, com o 55 do Brasil quando falta: para o link do WhatsApp. */
export const whatsappUrl = (phone: string | undefined) => {
  const digits = phone?.replace(/\D/g, '') ?? ''
  if (digits.length < 10) return undefined
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`
}

export const siteUrl = (site: string | undefined) => (site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : undefined)

export const instagramUrl = (handle: string | undefined) => {
  if (!handle) return undefined
  if (/^https?:\/\//i.test(handle)) return handle
  return `https://instagram.com/${handle.replace(/^@/, '')}`
}

export const PageHeader: React.FC<{ title: string; text?: React.ReactNode; children?: React.ReactNode }> = ({ title, text, children }) => (
  <div className="se-page-header flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
      {text && <p className="mt-1 max-w-2xl text-sm text-gray-500">{text}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </div>
)

export const Page: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
  <div className="se-page min-h-[calc(100vh-57px)]">
    <div className={cn('se-page-inner mx-auto px-4 py-8 md:px-8 md:py-8', wide ? 'max-w-[1600px]' : 'max-w-6xl')}>{children}</div>
  </div>
)

/** Campo que grava sozinho quando a pessoa sai dele (como no painel do funil). */
export const AutoField: React.FC<{
  label: string
  value?: string
  placeholder?: string
  type?: 'text' | 'email' | 'tel' | 'url' | 'date' | 'area'
  rows?: number
  disabled?: boolean
  onSave: (value: string) => void
}> = ({ label, value, placeholder, type = 'text', rows = 4, disabled, onSave }) => {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  const save = () => {
    if (draft.trim() !== (value ?? '').trim()) onSave(draft)
  }
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      {type === 'area' ? (
        <textarea className={cn(FIELD, 'mt-1 py-2 leading-relaxed')} rows={rows} value={draft} placeholder={placeholder} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={save} />
      ) : (
        <input
          type={type}
          className={cn(FIELD, 'mt-1 h-9')}
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      )}
    </label>
  )
}

export const Surface: React.FC<{ title?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, action, className, children }) => (
  <section className={cn('se-surface rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] md:p-5', className)}>
    {(title || action) && (
      <div className="mb-3 flex items-center justify-between gap-3">
        {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
        {action}
      </div>
    )}
    {children}
  </section>
)

const AVATAR_TONES = [
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-violet-100 text-violet-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
  'bg-orange-100 text-orange-800',
  'bg-indigo-100 text-indigo-800',
]

/** A cor de cada pessoa, sempre a mesma (sai do id da conta). */
const toneOf = (id: string) => {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]
}

/** Iniciais da pessoa num círculo com a cor dela. `name` vazio: ninguém (tracejado). */
export const Avatar: React.FC<{ id?: string; name?: string; size?: 'sm' | 'md'; className?: string }> = ({ id, name, size = 'sm', className }) => (
  <span
    className={cn(
      'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
      size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-[11px]',
      id && name ? toneOf(id) : 'border border-dashed border-gray-300 text-gray-400',
      className
    )}
    aria-hidden
  >
    {id && name ? initialsOf(name) : ''}
  </span>
)

const STATUS_TONE: Record<string, string> = {
  lead: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  cliente: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  'ex-cliente': 'bg-gray-50 text-gray-600 ring-gray-500/20',
}

export const StatusBadge: React.FC<{ status: string; label: string }> = ({ status, label }) => (
  <span className={cn('inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', STATUS_TONE[status] ?? STATUS_TONE['ex-cliente'])}>{label}</span>
)
