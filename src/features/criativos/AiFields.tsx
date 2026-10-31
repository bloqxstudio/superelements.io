import React from 'react'
import { Sparkles } from 'lucide-react'
import { AV_CASES } from '@/features/avence/cases'
import { cn } from '@/lib/utils'
import { AI_EXAMPLES, type AiForm } from './ai'

/** Os campos do pedido para a IA: briefing, cases que ela pode usar, formato e tamanho. */
export const AiFields: React.FC<{ form: AiForm; onChange: (form: AiForm) => void; disabled?: boolean; /** Esconde os cases da Avence (conjunto de outra marca). */ hideCases?: boolean }> = ({ form, onChange, disabled, hideCases }) => {
  const set = (fields: Partial<AiForm>) => onChange({ ...form, ...fields })
  const toggle = (slug: string) => set({ cases: form.cases.includes(slug) ? form.cases.filter((s) => s !== slug) : [...form.cases, slug] })
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-800"><Sparkles className="h-4 w-4 text-violet-600" /> O que o post precisa dizer?</span>
        <textarea value={form.brief} disabled={disabled} onChange={(e) => set({ brief: e.target.value })} rows={4} placeholder="Para quem é, o que mostrar e o que a pessoa deve fazer depois." className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm leading-snug" />
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {(hideCases ? [] : AI_EXAMPLES).map((e) => (
            <button key={e} type="button" disabled={disabled} onClick={() => set({ brief: e })} className="rounded-full bg-gray-100 px-2.5 py-1 text-left text-[11px] text-gray-600 hover:bg-gray-200">{e.slice(0, 54)}…</button>
          ))}
        </span>
      </label>
      {!hideCases && (
      <fieldset disabled={disabled}>
        <legend className="mb-1 text-sm font-medium text-gray-800">Cases que ela pode usar</legend>
        <div className="flex flex-wrap gap-1.5">
          {AV_CASES.map((c) => {
            const on = form.cases.includes(c.slug)
            return (
              <button key={c.slug} type="button" onClick={() => toggle(c.slug)} aria-pressed={on} className={cn('rounded-full border px-3 py-1 text-xs font-medium', on ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>{c.name}</button>
            )
          })}
        </div>
      </fieldset>
      )}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <label>
          <span className="mb-1 block font-medium text-gray-800">Formato</span>
          <select value={form.format} disabled={disabled} onChange={(e) => set({ format: e.target.value as AiForm['format'] })} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2">
            <option value="4x5">Feed 4:5</option>
            <option value="1x1">Quadrado 1:1</option>
            <option value="9x16">Story 9:16</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block font-medium text-gray-800">Slides</span>
          <input type="number" min={1} max={10} value={form.slides} disabled={disabled} onChange={(e) => set({ slides: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} className="h-9 w-full rounded-md border border-gray-200 px-2" />
        </label>
        <label>
          <span className="mb-1 block font-medium text-gray-800">Posts</span>
          <input type="number" min={1} max={4} value={form.posts} disabled={disabled} onChange={(e) => set({ posts: Math.min(4, Math.max(1, Number(e.target.value) || 1)) })} className="h-9 w-full rounded-md border border-gray-200 px-2" />
        </label>
      </div>
    </div>
  )
}

/**
 * O pedido inicial para a IA de um conjunto aberto. Um conjunto vindo de Conteúdos leva o briefing
 * do Plano e nenhum case da Avence; os demais conjuntos mantêm o pedido de sempre.
 */
export const aiFormFor = (set: { source?: unknown; brief?: string } | undefined): AiForm => (set?.source ? { ...EMPTY_AI, brief: set.brief ?? '', cases: [] } : EMPTY_AI)

export const EMPTY_AI: AiForm ={ brief: '', format: '4x5', slides: 5, posts: 1, cases: AV_CASES.slice(0, 3).map((c) => c.slug) }
