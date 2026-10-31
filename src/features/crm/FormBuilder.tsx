import React, { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, CircleHelp, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { FIELD, Surface } from '@/features/crm/ui'
import {
  FIELD_TYPES,
  allFields,
  hasOptions,
  newId,
  optionsOf,
  type FieldOption,
  type FieldType,
  type FormDefinition,
  type FormField,
  type FormSettings,
  type FormStep,
  type FormTheme,
  type QuizResult,
} from '@/features/crm/forms'
import { cn } from '@/lib/utils'

/**
 * O construtor de formulário e quiz: etapas com campos, lógica ("só aparece se…"), pontuação por
 * opção e faixas de resultado. A prévia ao lado é o próprio `public/forms.js` (o que o visitante
 * vê no site), então o que se vê aqui é o que vai ao ar.
 */

const INPUT = `${FIELD} h-9`
const LABEL = 'mb-1 block text-xs font-medium text-gray-600'

const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

const typeLabel = (type: FieldType) => FIELD_TYPES.find((t) => t.type === type)?.label ?? type

// ---------- prévia ----------

declare global {
  interface Window {
    AvenceForms?: { mount: (host: HTMLElement, config: unknown, opts?: { preview?: boolean; endpoint?: string }) => { update: (config: unknown) => void; destroy: () => void } }
  }
}

let scriptPromise: Promise<void> | null = null
const loadRenderer = () =>
  (scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.AvenceForms) return resolve()
    const script = document.createElement('script')
    script.src = '/forms.js'
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Não consegui carregar o forms.js'))
    }
    document.head.appendChild(script)
  }))

export const FormPreview: React.FC<{ id: string; name: string; definition: FormDefinition; theme: FormTheme; settings: FormSettings; dark?: boolean }> = ({ id, name, definition, theme, settings, dark }) => {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<{ update: (c: unknown) => void; destroy: () => void }>()
  const [failed, setFailed] = useState(false)
  const config = { id, name, definition, theme, settings }

  useEffect(() => {
    let live = true
    const node = host.current
    loadRenderer()
      .then(() => {
        if (!live || !node || !window.AvenceForms) return
        handle.current = window.AvenceForms.mount(node, config, { preview: true })
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
      handle.current?.destroy()
      handle.current = undefined
      // O Shadow DOM fica no elemento: um novo mount precisa de um elemento limpo
      node?.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    handle.current?.update(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)])

  if (failed) return <p className="text-sm text-rose-700">Não consegui carregar a prévia (public/forms.js).</p>
  return (
    <div className={cn('rounded-xl p-5 md:p-8', dark ? 'bg-zinc-900' : 'bg-zinc-100')}>
      <div className="mx-auto max-w-[520px]">
        <div ref={host} />
      </div>
    </div>
  )
}

// ---------- campo ----------

const OptionsEditor: React.FC<{ field: FormField; quiz: boolean; onChange: (options: FieldOption[]) => void }> = ({ field, quiz, onChange }) => {
  const options = optionsOf(field)
  const fixed = field.type === 'yesno' || field.type === 'rating'
  const set = (i: number, patch: Partial<FieldOption>) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  return (
    <div>
      <span className={LABEL}>{fixed ? 'Pontos por resposta' : 'Opções'}</span>
      <ul className="grid gap-1.5">
        {options.map((o, i) => (
          <li key={o.id} className="flex items-center gap-1.5">
            {fixed ? (
              <span className="w-24 truncate text-sm text-gray-700">{o.label}</span>
            ) : (
              <input className={cn(INPUT, 'min-w-0 flex-1')} value={o.label} placeholder={`Opção ${i + 1}`} onChange={(e) => set(i, { label: e.target.value })} aria-label={`Texto da opção ${i + 1}`} />
            )}
            {quiz && (
              <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                pts
                <input type="number" className={cn(INPUT, 'w-16 px-2 tabular-nums')} value={o.score ?? ''} placeholder="0" onChange={(e) => set(i, { score: e.target.value === '' ? undefined : Number(e.target.value) })} aria-label={`Pontos da opção ${o.label || i + 1}`} />
              </label>
            )}
            {!fixed && (
              <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-rose-600" aria-label={`Tirar a opção ${i + 1}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!fixed && (
        <button type="button" onClick={() => onChange([...options, { id: newId('o'), label: '' }])} className="mt-2 text-sm font-medium text-violet-700 hover:underline">
          + Opção
        </button>
      )}
    </div>
  )
}

const FieldEditor: React.FC<{
  field: FormField
  earlier: FormField[]
  quiz: boolean
  onChange: (patch: Partial<FormField>) => void
}> = ({ field, earlier, quiz, onChange }) => {
  const textual = !hasOptions(field.type) && field.type !== 'yesno' && field.type !== 'rating'
  const pickable = earlier.filter((f) => hasOptions(f.type) || f.type === 'yesno' || f.type === 'rating')
  const target = pickable.find((f) => f.id === field.showIf?.field)
  const scored = hasOptions(field.type) || field.type === 'yesno' || field.type === 'rating'
  return (
    <div className="grid gap-3 border-t border-gray-100 bg-zinc-50/60 p-3">
      <div>
        <label className={LABEL}>Pergunta</label>
        <input className={INPUT} value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </div>
      <div>
        <label className={LABEL}>Texto de apoio (opcional)</label>
        <input className={INPUT} value={field.help ?? ''} onChange={(e) => onChange({ help: e.target.value || undefined })} />
      </div>
      {textual && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Texto de exemplo</label>
            <input className={INPUT} value={field.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value || undefined })} />
          </div>
          <div>
            <label className={LABEL}>Vai para o CRM como</label>
            <select className={INPUT} value={field.map ?? ''} onChange={(e) => onChange({ map: (e.target.value || undefined) as FormField['map'] })}>
              <option value="">Só nas respostas</option>
              <option value="name">Nome do contato</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone / WhatsApp</option>
              <option value="message">Mensagem</option>
            </select>
          </div>
        </div>
      )}
      {(hasOptions(field.type) || field.type === 'yesno' || field.type === 'rating') && <OptionsEditor field={field} quiz={quiz && scored} onChange={(options) => onChange({ options })} />}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <Switch checked={!!field.required} onCheckedChange={(required) => onChange({ required })} /> Obrigatório
        </label>
      </div>
      {pickable.length > 0 && (
        <div>
          <span className={LABEL}>Lógica</span>
          {field.showIf ? (
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
              <span>Mostrar se</span>
              <select className={cn(INPUT, 'w-auto max-w-[200px]')} value={field.showIf.field} onChange={(e) => onChange({ showIf: { ...field.showIf!, field: e.target.value, value: '' } })} aria-label="Campo que decide">
                {pickable.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label || typeLabel(f.type)}
                  </option>
                ))}
              </select>
              <select className={cn(INPUT, 'w-auto')} value={field.showIf.op} onChange={(e) => onChange({ showIf: { ...field.showIf!, op: e.target.value as 'eq' | 'neq' } })} aria-label="Condição">
                <option value="eq">for</option>
                <option value="neq">não for</option>
              </select>
              <select className={cn(INPUT, 'w-auto max-w-[200px]')} value={field.showIf.value} onChange={(e) => onChange({ showIf: { ...field.showIf!, value: e.target.value } })} aria-label="Resposta">
                <option value="">Escolha…</option>
                {target && optionsOf(target).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => onChange({ showIf: undefined })} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-rose-600" aria-label="Tirar a lógica">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => onChange({ showIf: { field: pickable[pickable.length - 1].id, op: 'eq', value: '' } })} className="text-sm font-medium text-violet-700 hover:underline">
              + Mostrar só se uma resposta anterior for…
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- etapas ----------

const AddField: React.FC<{ onAdd: (type: FieldType) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="px-3 pb-3">
      {open ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {FIELD_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => {
                onAdd(t.type)
                setOpen(false)
              }}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left hover:border-violet-300 hover:bg-violet-50/50"
            >
              <span className="block text-sm font-medium text-gray-900">{t.label}</span>
              <span className="block text-xs text-gray-500">{t.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-600 hover:border-violet-400 hover:text-violet-700">
          <Plus className="h-4 w-4" /> Campo
        </button>
      )}
    </div>
  )
}

const newField = (type: FieldType): FormField => ({
  id: newId('f'),
  type,
  label: '',
  required: false,
  options: hasOptions(type) ? [{ id: newId('o'), label: 'Opção 1' }, { id: newId('o'), label: 'Opção 2' }] : undefined,
})

export const StepsEditor: React.FC<{ definition: FormDefinition; onChange: (definition: FormDefinition) => void }> = ({ definition, onChange }) => {
  const [open, setOpen] = useState<string>()
  const quiz = definition.kind === 'quiz'
  const setStep = (id: string, patch: Partial<FormStep>) => onChange({ ...definition, steps: definition.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const everything = allFields(definition)

  return (
    <div className="grid gap-4">
      {definition.steps.map((step, si) => {
        const before = definition.steps.slice(0, si).flatMap((s) => s.fields)
        return (
          <Surface key={step.id} className="!p-0 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gray-600">Etapa {si + 1}</span>
              <input className={cn(INPUT, 'min-w-0 flex-1 border-transparent bg-transparent font-medium hover:border-gray-200')} value={step.title ?? ''} placeholder={quiz ? 'Título da pergunta (aparece na tela)' : 'Título da etapa (opcional)'} onChange={(e) => setStep(step.id, { title: e.target.value || undefined })} aria-label={`Título da etapa ${si + 1}`} />
              <button type="button" disabled={si === 0} onClick={() => onChange({ ...definition, steps: move(definition.steps, si, si - 1) })} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-gray-700 disabled:opacity-30" aria-label="Subir a etapa">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" disabled={si === definition.steps.length - 1} onClick={() => onChange({ ...definition, steps: move(definition.steps, si, si + 1) })} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-gray-700 disabled:opacity-30" aria-label="Descer a etapa">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={definition.steps.length === 1}
                onClick={() => onChange({ ...definition, steps: definition.steps.filter((s) => s.id !== step.id) })}
                className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-rose-600 disabled:opacity-30"
                aria-label="Apagar a etapa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {step.description !== undefined || step.title ? (
              <div className="px-3 pt-2">
                <input className={cn(INPUT, 'border-transparent bg-transparent text-gray-600 hover:border-gray-200')} value={step.description ?? ''} placeholder="Descrição (opcional)" onChange={(e) => setStep(step.id, { description: e.target.value || undefined })} aria-label={`Descrição da etapa ${si + 1}`} />
              </div>
            ) : null}
            <ul className="grid gap-2 p-3">
              {step.fields.map((field, fi) => {
                const expanded = open === field.id
                const setField = (patch: Partial<FormField>) => setStep(step.id, { fields: step.fields.map((f) => (f.id === field.id ? { ...f, ...patch } : f)) })
                return (
                  <li key={field.id} className={cn('overflow-hidden rounded-lg border bg-white', expanded ? 'border-violet-300 ring-1 ring-violet-200' : 'border-gray-200')}>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setOpen(expanded ? undefined : field.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left">
                        <GripVertical className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{field.label || <span className="text-gray-400">Sem pergunta</span>}{field.required && <span className="ml-1 text-violet-600">*</span>}</span>
                        <span className="shrink-0 text-xs text-gray-500">{typeLabel(field.type)}</span>
                        {field.showIf && <CircleHelp className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-label="Tem lógica" />}
                      </button>
                      <button type="button" disabled={fi === 0} onClick={() => setStep(step.id, { fields: move(step.fields, fi, fi - 1) })} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-gray-700 disabled:opacity-30" aria-label="Subir o campo">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" disabled={fi === step.fields.length - 1} onClick={() => setStep(step.id, { fields: move(step.fields, fi, fi + 1) })} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-gray-700 disabled:opacity-30" aria-label="Descer o campo">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Quem dependia deste campo perde a condição
                          onChange({
                            ...definition,
                            steps: definition.steps.map((s) => ({ ...s, fields: (s.id === step.id ? s.fields.filter((f) => f.id !== field.id) : s.fields).map((f) => (f.showIf?.field === field.id ? { ...f, showIf: undefined } : f)) })),
                          })
                        }}
                        className="mr-1 rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-rose-600"
                        aria-label="Apagar o campo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {expanded && <FieldEditor field={field} earlier={[...before, ...step.fields.slice(0, fi)]} quiz={quiz} onChange={setField} />}
                  </li>
                )
              })}
            </ul>
            <AddField
              onAdd={(type) => {
                const field = newField(type)
                setStep(step.id, { fields: [...step.fields, field] })
                setOpen(field.id)
              }}
            />
          </Surface>
        )
      })}
      <Button type="button" variant="outline" onClick={() => onChange({ ...definition, steps: [...definition.steps, { id: newId('s'), fields: [] }] })}>
        <Plus className="mr-1.5 h-4 w-4" /> {quiz ? 'Nova pergunta' : 'Nova etapa'}
      </Button>
      {everything.length === 0 && <p className="text-sm text-gray-500">Adicione um campo para começar.</p>}
    </div>
  )
}

// ---------- resultados do quiz ----------

export const ResultsEditor: React.FC<{ definition: FormDefinition; onChange: (definition: FormDefinition) => void }> = ({ definition, onChange }) => {
  const maxScore = definition.steps.reduce((sum, s) => sum + s.fields.reduce((m, f) => m + Math.max(0, ...optionsOf(f).map((o) => o.score ?? 0)), 0), 0)
  const set = (id: string, patch: Partial<QuizResult>) => onChange({ ...definition, results: definition.results.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const sorted = [...definition.results].sort((a, b) => a.min - b.min)
  return (
    <Surface title="Resultados do quiz" action={<span className="text-xs text-gray-500">Pontuação máxima possível: {maxScore}</span>}>
      <p className="mb-3 text-sm text-gray-600">Quem soma pelo menos a pontuação mínima cai na faixa. Marque as faixas que contam como lead qualificado: só elas disparam a conversão <code className="rounded bg-zinc-100 px-1 text-xs">lead_qualificado</code>.</p>
      <ul className="grid gap-3">
        {sorted.map((r) => (
          <li key={r.id} className="grid gap-2.5 rounded-lg border border-gray-200 p-3">
            <div className="flex items-end gap-2">
              <div className="w-24 shrink-0">
                <label className={LABEL}>A partir de</label>
                <input type="number" className={cn(INPUT, 'tabular-nums')} value={r.min} onChange={(e) => set(r.id, { min: Number(e.target.value) || 0 })} />
              </div>
              <div className="min-w-0 flex-1">
                <label className={LABEL}>Título do resultado</label>
                <input className={INPUT} value={r.title} onChange={(e) => set(r.id, { title: e.target.value })} />
              </div>
              <button type="button" disabled={definition.results.length === 1} onClick={() => onChange({ ...definition, results: definition.results.filter((x) => x.id !== r.id) })} className="mb-1 rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-rose-600 disabled:opacity-30" aria-label="Apagar o resultado">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className={LABEL}>Texto</label>
              <textarea className={cn(FIELD, 'min-h-[64px] py-2')} value={r.text ?? ''} onChange={(e) => set(r.id, { text: e.target.value || undefined })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Botão (opcional)</label>
                <input className={INPUT} value={r.ctaLabel ?? ''} placeholder="Agendar conversa" onChange={(e) => set(r.id, { ctaLabel: e.target.value || undefined })} />
              </div>
              <div>
                <label className={LABEL}>Link do botão</label>
                <input className={INPUT} value={r.ctaUrl ?? ''} placeholder="https://" onChange={(e) => set(r.id, { ctaUrl: e.target.value || undefined })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Switch checked={!!r.qualified} onCheckedChange={(qualified) => set(r.id, { qualified })} /> Lead qualificado
            </label>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onChange({ ...definition, results: [...definition.results, { id: newId('r'), min: Math.min(maxScore, (sorted[sorted.length - 1]?.min ?? 0) + 5), title: 'Novo resultado' }] })}>
        <Plus className="mr-1.5 h-4 w-4" /> Faixa de resultado
      </Button>
    </Surface>
  )
}

// ---------- design e configurações ----------

const Color: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
    {label}
    <span className="flex items-center gap-2">
      <input type="text" className={cn(INPUT, 'w-24 font-mono text-xs uppercase')} value={value} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)} aria-label={`${label} em hexadecimal`} />
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 cursor-pointer rounded border border-gray-200 bg-white p-0.5" aria-label={label} />
    </span>
  </label>
)

export const DesignEditor: React.FC<{ theme: FormTheme; onChange: (theme: FormTheme) => void }> = ({ theme, onChange }) => (
  <Surface title="Aparência">
    <div className="grid gap-3">
      <Color label="Cor principal (botões e destaque)" value={theme.primary} onChange={(primary) => onChange({ ...theme, primary })} />
      <Color label="Fundo" value={theme.background} onChange={(background) => onChange({ ...theme, background })} />
      <Color label="Texto" value={theme.text} onChange={(text) => onChange({ ...theme, text })} />
      <Color label="Fundo dos campos" value={theme.field} onChange={(field) => onChange({ ...theme, field })} />
      <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
        Arredondamento
        <span className="flex items-center gap-2">
          <input type="range" min={0} max={28} value={theme.radius} onChange={(e) => onChange({ ...theme, radius: Number(e.target.value) })} className="w-36 accent-violet-600" />
          <span className="w-9 text-right tabular-nums text-gray-500">{theme.radius}px</span>
        </span>
      </label>
      <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
        Fonte
        <select className={cn(INPUT, 'w-auto')} value={theme.font} onChange={(e) => onChange({ ...theme, font: e.target.value as FormTheme['font'] })}>
          <option value="inherit">A do site (recomendado)</option>
          <option value="Inter">Inter</option>
          <option value="system">Do sistema</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
        Moldura
        <select className={cn(INPUT, 'w-auto')} value={theme.frame} onChange={(e) => onChange({ ...theme, frame: e.target.value as FormTheme['frame'] })}>
          <option value="card">Cartão com borda</option>
          <option value="plain">Solto na página</option>
        </select>
      </label>
    </div>
  </Surface>
)

const Text: React.FC<{ label: string; value: string; onChange: (value: string) => void; area?: boolean; placeholder?: string }> = ({ label, value, onChange, area, placeholder }) => (
  <div>
    <label className={LABEL}>{label}</label>
    {area ? <textarea className={cn(FIELD, 'min-h-[64px] py-2')} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /> : <input className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
  </div>
)

export const SettingsEditor: React.FC<{ settings: FormSettings; kind: 'form' | 'quiz'; onKind: (kind: 'form' | 'quiz') => void; onChange: (settings: FormSettings) => void }> = ({ settings, kind, onKind, onChange }) => {
  const wa = settings.whatsapp
  return (
    <div className="grid gap-4">
      <Surface title="Tipo">
        <div className="inline-flex rounded-lg bg-zinc-100 p-1 text-sm" role="radiogroup" aria-label="Tipo">
          {(['form', 'quiz'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => onKind(k)} className={cn('rounded-md px-3 py-1.5 font-medium', kind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {k === 'form' ? 'Formulário' : 'Quiz com pontuação'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">{kind === 'quiz' ? 'Cada opção soma pontos; a soma decide o resultado e se o lead é qualificado.' : 'Os campos são enviados como estão, sem pontuação.'}</p>
      </Surface>
      <Surface title="Textos e comportamento">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Text label="Botão de continuar" value={settings.nextLabel} onChange={(nextLabel) => onChange({ ...settings, nextLabel })} />
            <Text label="Botão de enviar" value={settings.submitLabel} onChange={(submitLabel) => onChange({ ...settings, submitLabel })} />
          </div>
          <Text label="Título depois de enviar" value={settings.successTitle} onChange={(successTitle) => onChange({ ...settings, successTitle })} />
          <Text label="Mensagem depois de enviar" value={settings.successText} onChange={(successText) => onChange({ ...settings, successText })} area />
          <Text label="Ir para outra página depois de enviar (opcional)" value={settings.redirectUrl ?? ''} onChange={(redirectUrl) => onChange({ ...settings, redirectUrl: redirectUrl || undefined })} placeholder="https://seusite.com.br/obrigado" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Switch checked={settings.showProgress} onCheckedChange={(showProgress) => onChange({ ...settings, showProgress })} /> Barra de progresso nas etapas
          </label>
          {kind === 'quiz' && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Switch checked={!!settings.showScore} onCheckedChange={(showScore) => onChange({ ...settings, showScore })} /> Mostrar a pontuação para quem responde
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Switch checked={settings.autoAdvance} onCheckedChange={(autoAdvance) => onChange({ ...settings, autoAdvance })} /> Avançar sozinho ao escolher (uma pergunta por tela)
          </label>
        </div>
      </Surface>
      <Surface title="WhatsApp na tela final">
        <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
          <Switch checked={!!wa} onCheckedChange={(on) => onChange({ ...settings, whatsapp: on ? { number: '', text: 'Olá! Acabei de responder o formulário no site.' } : undefined })} /> Mostrar o botão “Falar no WhatsApp”
        </label>
        {wa && (
          <div className="grid gap-3">
            <Text label="Número da equipe (com DDD)" value={wa.number} onChange={(number) => onChange({ ...settings, whatsapp: { ...wa, number } })} placeholder="5551999999999" />
            <Text label="Mensagem inicial (as respostas vão junto)" value={wa.text} onChange={(text) => onChange({ ...settings, whatsapp: { ...wa, text } })} area />
          </div>
        )}
      </Surface>
    </div>
  )
}
