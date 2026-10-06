import React, { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Copy, ImageIcon, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { isWidgetSupported, widgetSummary } from '@/engine/elementor'
import { readImageFile } from '@/features/space/featured/render'
import { Row, TextArea, TextInput, inputClass } from './controls'
import { contentFields, itemTitle, newRepeaterId, type ContentField } from './contentFields'
import type { SettingsPatch } from './tree'

/**
 * Conteúdo de um widget que o painel não conhece um a um: os textos, links,
 * imagens e listas que estão nas settings (ver contentFields.ts). Para o
 * widget que o canvas não desenha, um resumo em cima diz o que ele é e de
 * onde vem o conteúdo.
 */

type Settings = Record<string, unknown>

const isRecord = (value: unknown): value is Settings => !!value && typeof value === 'object' && !Array.isArray(value)

const smallButton =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 transition-[color,background-color,transform] hover:bg-gray-100 hover:text-gray-800 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'

/** Imagem: miniatura, endereço e botão para escolher do computador (vai para a mídia do WordPress ao publicar). */
const ImageField: React.FC<{ label: string; value: Settings; onChange: (value: Settings) => void; onRemove?: () => void }> = ({ label, value, onChange, onRemove }) => {
  const fileRef = useRef<HTMLInputElement>(null)
  const url = typeof value.url === 'string' ? value.url : ''
  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      onChange({ ...value, url: await readImageFile(file), id: '' })
      toast.success('Imagem adicionada', { description: 'Ela vai para a mídia do WordPress ao publicar.' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a imagem.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-7 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-3.5 w-3.5 text-gray-400" />}
      </span>
      <TextInput label={label} value={url.startsWith('data:') ? 'Imagem do computador' : url} placeholder="https://" onChange={(v) => onChange({ ...value, url: v, id: '' })} />
      <button type="button" className={smallButton} onClick={() => fileRef.current?.click()} title="Escolher do computador" aria-label={`Escolher ${label.toLowerCase()} do computador`}>
        <Upload className="h-3.5 w-3.5" />
      </button>
      {onRemove && (
        <button type="button" className={cn(smallButton, 'hover:bg-red-50 hover:text-red-600')} onClick={onRemove} title="Tirar a imagem" aria-label="Tirar a imagem">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

/** Rótulo à esquerda, como no resto do painel; o rótulo longo (dos widgets de terceiros) vai em cima, inteiro. */
const Labeled: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) =>
  label.length > 13 ? (
    <div className="space-y-1">
      <span className="block text-[11px] text-gray-500">{label}</span>
      <div className="flex">{children}</div>
    </div>
  ) : (
    <Row label={label}>{children}</Row>
  )

/** Um campo simples (texto, link, imagem, galeria). */
const Field: React.FC<{ field: ContentField; value: unknown; onChange: (value: unknown) => void }> = ({ field, value, onChange }) => {
  if (field.dynamic) {
    return (
      <Labeled label={field.label}>
        <span className={cn(inputClass, 'flex items-center truncate text-gray-400')} title="Vem de uma tag dinâmica do WordPress">
          Dinâmico (do WordPress)
        </span>
      </Labeled>
    )
  }
  if (field.kind === 'text') {
    return (
      <Labeled label={field.label}>
        <TextInput label={field.label} value={typeof value === 'string' ? value : ''} onChange={onChange} />
      </Labeled>
    )
  }
  if (field.kind === 'longtext' || field.kind === 'html') {
    return <TextArea label={field.label} value={typeof value === 'string' ? value : ''} onChange={onChange} rows={field.kind === 'html' ? 5 : 3} mono={field.kind === 'html'} />
  }
  if (field.kind === 'link') {
    const link = isRecord(value) ? value : {}
    return (
      <Labeled label={field.label}>
        <TextInput label={field.label} value={typeof link.url === 'string' ? link.url : ''} placeholder="https:// ou #secao" onChange={(url) => onChange({ ...link, url })} />
      </Labeled>
    )
  }
  if (field.kind === 'image') {
    return (
      <div className="space-y-1">
        <span className="block text-[11px] text-gray-500">{field.label}</span>
        <ImageField label={field.label} value={isRecord(value) ? value : {}} onChange={onChange} />
      </div>
    )
  }
  if (field.kind === 'gallery') {
    const images = Array.isArray(value) ? (value as Settings[]) : []
    return (
      <div className="space-y-1">
        <span className="block text-[11px] text-gray-500">
          {field.label} ({images.length})
        </span>
        {images.map((image, i) => (
          <ImageField
            key={i}
            label={`${field.label} ${i + 1}`}
            value={image}
            onChange={(next) => onChange(images.map((img, j) => (j === i ? next : img)))}
            onRemove={() => onChange(images.filter((_, j) => j !== i))}
          />
        ))}
        <button
          type="button"
          onClick={() => onChange([...images, { id: '', url: '' }])}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 text-[11px] font-medium text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar imagem
        </button>
      </div>
    )
  }
  return null
}

/** Lista de itens (repeater): cada item abre com os campos dele; dá para somar, duplicar, tirar e reordenar. */
const ListField: React.FC<{ field: ContentField; value: unknown; onChange: (value: Settings[]) => void }> = ({ field, value, onChange }) => {
  const items = Array.isArray(value) ? (value as Settings[]) : []
  const [open, setOpen] = useState<number | null>(0)
  const fields = field.fields ?? []
  const name = field.itemName ?? 'Item'

  const update = (index: number, key: string, next: unknown) => onChange(items.map((item, i) => (i === index ? { ...item, [key]: next } : item)))
  const move = (index: number, to: number) => {
    const list = [...items]
    const [item] = list.splice(index, 1)
    list.splice(to, 0, item)
    onChange(list)
    setOpen(to)
  }
  const copy = (index: number) => {
    const list = [...items]
    list.splice(index + 1, 0, { ...structuredClone(items[index]), _id: newRepeaterId() })
    onChange(list)
    setOpen(index + 1)
  }
  const add = () => {
    const base = items.at(-1)
    onChange([...items, base ? { ...structuredClone(base), _id: newRepeaterId() } : { _id: newRepeaterId() }])
    setOpen(items.length)
  }
  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
    setOpen(null)
  }

  return (
    <div className="space-y-1">
      <span className="block text-[11px] text-gray-500">
        {field.label} ({items.length})
      </span>
      {items.map((item, i) => {
        const expanded = open === i
        const title = itemTitle(item, fields)
        return (
          <div key={String(item._id ?? i)} className="rounded-md border border-gray-200 bg-white">
            <div className="flex items-center gap-0.5 pr-1">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : i)}
                aria-expanded={expanded}
                className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 text-left text-[11px] text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <ChevronDown className={cn('h-3 w-3 shrink-0 text-gray-400 transition-transform', !expanded && '-rotate-90')} />
                <span className="shrink-0 font-medium">
                  {name} {i + 1}
                </span>
                {title && <span className="truncate text-gray-400">· {title}</span>}
              </button>
              <button type="button" className={smallButton} onClick={() => move(i, i - 1)} disabled={i === 0} title="Subir" aria-label={`Subir ${name.toLowerCase()} ${i + 1}`}>
                <ArrowUp className="h-3 w-3" />
              </button>
              <button type="button" className={smallButton} onClick={() => move(i, i + 1)} disabled={i === items.length - 1} title="Descer" aria-label={`Descer ${name.toLowerCase()} ${i + 1}`}>
                <ArrowDown className="h-3 w-3" />
              </button>
              <button type="button" className={smallButton} onClick={() => copy(i)} title="Duplicar" aria-label={`Duplicar ${name.toLowerCase()} ${i + 1}`}>
                <Copy className="h-3 w-3" />
              </button>
              <button type="button" className={cn(smallButton, 'hover:bg-red-50 hover:text-red-600')} onClick={() => remove(i)} title="Tirar" aria-label={`Tirar ${name.toLowerCase()} ${i + 1}`}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {expanded && (
              <div className="space-y-1.5 border-t border-gray-100 p-2">
                {/* Só as chaves que o item tem: o campo de texto de um formulário não tem "Opções" */}
                {fields
                  .filter((f) => f.always || f.key in item)
                  .map((f) => (
                    <Field key={f.key} field={f} value={item[f.key]} onChange={(next) => update(i, f.key, next)} />
                  ))}
              </div>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={add}
        className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 text-[11px] font-medium text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-700"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar {name.toLowerCase()}
      </button>
    </div>
  )
}

export const GenericContent: React.FC<{ type: string; settings: Settings; onChange: (patch: SettingsPatch) => void }> = ({ type, settings, onChange }) => {
  const fields = useMemo(() => contentFields(settings), [settings])
  const supported = isWidgetSupported(type)
  const summary = useMemo(() => widgetSummary(type, settings), [type, settings])

  return (
    <>
      {(!supported || summary.dynamic) && (
        <div className="space-y-0.5 rounded-md bg-gray-50 px-2 py-1.5 text-[10.5px] leading-snug text-gray-600">
          <p>
            <strong className="font-semibold text-gray-900">{summary.name}</strong>
            {summary.details.length > 0 && <span> · {summary.details.join(' · ')}</span>}
          </p>
          <p className="text-gray-500">
            {summary.dynamic
              ? 'Os itens vêm do banco do WordPress: o canvas mostra o espaço deles, e o site publicado mostra os itens de verdade.'
              : 'O canvas ainda não desenha este widget. O que mudar aqui vai para o WordPress do jeito que está no JSON.'}
          </p>
        </div>
      )}
      {fields.map((field) =>
        field.kind === 'list' ? (
          <ListField key={field.key} field={field} value={settings[field.key]} onChange={(value) => onChange({ [field.key]: value })} />
        ) : (
          <Field key={field.key} field={field} value={settings[field.key]} onChange={(value) => onChange({ [field.key]: value })} />
        ),
      )}
      {fields.length === 0 && <p className="text-[10.5px] leading-relaxed text-gray-400">Este widget não tem texto, link ou imagem nas settings. O resto se ajusta em Configurações (JSON), abaixo.</p>}
    </>
  )
}

/**
 * Todas as settings do widget em JSON, para o que o painel não mostra. Só as
 * chaves que mudaram são gravadas (e ficam fixas por cima da marca).
 */
export const SettingsJson: React.FC<{ settings: Settings; onApply: (patch: SettingsPatch) => void }> = ({ settings, onApply }) => {
  const original = useMemo(() => JSON.stringify(settings, null, 2), [settings])
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const text = draft ?? original

  const apply = () => {
    let next: unknown
    try {
      next = JSON.parse(text)
    } catch (e) {
      setError(e instanceof Error ? `JSON inválido: ${e.message}` : 'JSON inválido.')
      return
    }
    if (!isRecord(next)) {
      setError('As settings precisam ser um objeto { … }.')
      return
    }
    const patch: SettingsPatch = {}
    for (const [key, value] of Object.entries(next)) if (JSON.stringify(settings[key]) !== JSON.stringify(value)) patch[key] = value
    for (const key of Object.keys(settings)) if (!(key in next)) patch[key] = undefined
    if (Object.keys(patch).length) onApply(patch)
    setDraft(null)
    setError('')
  }

  return (
    <div className="space-y-1.5">
      <TextArea label="Settings do Elementor" value={text} onChange={(v) => { setDraft(v); setError('') }} rows={12} mono />
      {error && <p className="text-[10.5px] text-red-600">{error}</p>}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={apply}
          disabled={draft === null || draft === original}
          className="h-7 flex-1 rounded-md bg-violet-600 px-3 text-[11px] font-semibold text-white transition-[background-color,transform] hover:bg-violet-700 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          Aplicar
        </button>
        <button
          type="button"
          onClick={() => { setDraft(null); setError('') }}
          disabled={draft === null}
          className="h-7 rounded-md px-3 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
        >
          Descartar
        </button>
      </div>
    </div>
  )
}
