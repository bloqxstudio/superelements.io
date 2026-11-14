import React, { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FIELD } from '@/features/crm/ui'
import { deleteTag, saveTag, type ContentTag, type TagColor } from './api'

/**
 * Tipos de conteúdo da conta (Educativo, Família, Produto novo, Evento...), com cor, visíveis nos
 * cards da Pauta. Migração 20261112120000_crm_content_tags.sql.
 */

export const TAG_COLORS: { id: TagColor; label: string; chip: string; dot: string }[] = [
  { id: 'violet', label: 'Roxo', chip: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  { id: 'sky', label: 'Azul', chip: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  { id: 'emerald', label: 'Verde', chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  { id: 'amber', label: 'Amarelo', chip: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
  { id: 'orange', label: 'Laranja', chip: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  { id: 'rose', label: 'Rosa', chip: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' },
  { id: 'teal', label: 'Turquesa', chip: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500' },
  { id: 'slate', label: 'Cinza', chip: 'bg-slate-200 text-slate-800', dot: 'bg-slate-500' },
]

export const tagTone = (color: TagColor) => TAG_COLORS.find((c) => c.id === color) ?? TAG_COLORS[0]

/** Sugestões quando a conta ainda não tem tipos (exemplos do usuário, 2026-11-12). */
export const TAG_SUGGESTIONS: { name: string; color: TagColor }[] = [
  { name: 'Educativo', color: 'sky' },
  { name: 'Família', color: 'rose' },
  { name: 'Produto novo', color: 'emerald' },
  { name: 'Evento', color: 'amber' },
]

export const TagChip: React.FC<{ tag: ContentTag; size?: 'xs' | 'sm'; className?: string }> = ({ tag, size = 'sm', className }) => (
  <span className={cn('inline-flex max-w-full shrink-0 items-center truncate rounded-full font-medium', tagTone(tag.color).chip, size === 'xs' ? 'h-4 px-1.5 text-[9px] leading-4' : 'h-5 px-2 text-[11px]', className)} title={tag.name}>
    <span className="truncate">{tag.name}</span>
  </span>
)

/** Os tipos de um conteúdo, na ordem do catálogo. */
export const tagsOf = (ids: string[] | undefined, tags: ContentTag[]) => (ids?.length ? tags.filter((t) => ids.includes(t.id)) : [])

/**
 * Escolher os tipos de um conteúdo, criar um tipo novo e apagar um tipo da conta.
 * `onChange` grava a lista nova (o painel chama `setContentTags`).
 */
export const TagPicker: React.FC<{
  teamId: string
  tags: ContentTag[]
  value: string[]
  onChange: (ids: string[]) => Promise<void>
  onTagsChanged: (tags: ContentTag[]) => void
}> = ({ teamId, tags, value, onChange, onTagsChanged }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<TagColor>('violet')
  const [busy, setBusy] = useState<string>()
  const chosen = tagsOf(value, tags)
  const suggestions = TAG_SUGGESTIONS.filter((s) => !tags.some((t) => t.name.toLowerCase() === s.name.toLowerCase()))

  const toggle = async (id: string) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id]
    if (next.length > 5) return void toast.error('No máximo 5 tipos por conteúdo.')
    setBusy(id)
    try {
      await onChange(next)
    } finally {
      setBusy(undefined)
    }
  }

  const create = async (n: string, c: TagColor) => {
    const clean = n.trim()
    if (!clean) return
    setBusy('novo')
    try {
      const tag = await saveTag(teamId, null, clean, c)
      onTagsChanged([...tags, tag])
      setName('')
      if (value.length < 5) await onChange([...value, tag.id])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui criar o tipo.')
    } finally {
      setBusy(undefined)
    }
  }

  const remove = async (tag: ContentTag) => {
    setBusy(tag.id)
    try {
      await deleteTag(tag.id)
      onTagsChanged(tags.filter((t) => t.id !== tag.id))
      toast.success(`"${tag.name}" saiu da conta e dos conteúdos.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui apagar o tipo.')
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
      {chosen.map((t) => (
        <TagChip key={t.id} tag={t} />
      ))}
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 text-[11px] font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900">
            <TagIcon className="h-3 w-3" aria-hidden /> {open ? 'Fechar' : chosen.length ? 'Mudar' : 'Escolher tipo'}
          </button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2">
          {tags.length > 0 && (
            <ul className="grid max-h-60 gap-0.5 overflow-y-auto" aria-label="Tipos da conta">
              {tags.map((t) => {
                const on = value.includes(t.id)
                return (
                  <li key={t.id} className="group flex items-center gap-1">
                    <button type="button" role="checkbox" aria-checked={on} disabled={!!busy} onClick={() => void toggle(t.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-gray-50 disabled:opacity-60">
                      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300')}>
                        {busy === t.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : on && <Check className="h-3 w-3" aria-hidden />}
                      </span>
                      <TagChip tag={t} />
                    </button>
                    <button type="button" aria-label={`Apagar o tipo ${t.name} da conta`} disabled={!!busy} onClick={() => void remove(t)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-red-700 md:focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {suggestions.length > 0 && (
            <div className={cn(tags.length > 0 && 'mt-2 border-t border-gray-100 pt-2')}>
              <p className="px-1.5 text-[11px] text-gray-500">Sugestões</p>
              <div className="mt-1 flex flex-wrap gap-1 px-1.5">
                {suggestions.map((s) => (
                  <button key={s.name} type="button" disabled={!!busy} onClick={() => void create(s.name, s.color)} className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium opacity-80 hover:opacity-100 disabled:opacity-50', tagTone(s.color).chip)}>
                    <Plus className="h-3 w-3" aria-hidden /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form
            className="mt-2 border-t border-gray-100 pt-2"
            onSubmit={(e) => {
              e.preventDefault()
              void create(name, color)
            }}
          >
            <label className="block px-1.5 text-[11px] text-gray-500">
              Novo tipo
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bastidores" className={cn(FIELD, 'mt-1 h-8 text-sm')} />
            </label>
            <div className="mt-1.5 flex items-center gap-1 px-1.5" role="radiogroup" aria-label="Cor">
              {TAG_COLORS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={color === c.id} aria-label={c.label} onClick={() => setColor(c.id)} className={cn('h-5 w-5 rounded-full', c.dot, color === c.id ? 'ring-2 ring-gray-900 ring-offset-1' : 'opacity-70 hover:opacity-100')} />
              ))}
              <button type="submit" disabled={!name.trim() || !!busy} className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-gray-900 px-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-40">
                {busy === 'novo' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Plus className="h-3 w-3" aria-hidden />} Criar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
