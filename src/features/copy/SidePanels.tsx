import React from 'react'
import { ExternalLink } from 'lucide-react'
import { NICHES, formatById } from './knowledge'
import { useCopy } from './store'
import type { Brief } from './types'

/** O briefing (o que o agente lê antes de escrever) e as fontes de uma pesquisa. */

const input = 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
  </label>
)

export const BriefPanel: React.FC = () => {
  const doc = useCopy((s) => s.doc)!
  const set = (patch: Partial<Brief>) => useCopy.getState().draft((d) => ({ ...d, brief: { ...d.brief, ...patch } }))
  // O briefing vira um passo só do desfazer, ao sair do campo
  const commit = (before: typeof doc) => () => useCopy.getState().checkpoint(before)
  const area = (key: keyof Brief, rows = 2) => (
    <textarea rows={rows} value={doc.brief[key]} onFocus={(e) => ((e.currentTarget as unknown as { __b: typeof doc }).__b = useCopy.getState().doc!)} onChange={(e) => set({ [key]: e.target.value })} onBlur={(e) => commit((e.currentTarget as unknown as { __b: typeof doc }).__b)()} className={`${input} h-auto resize-none py-1.5 leading-snug`} />
  )
  const niche = NICHES.find((n) => n.id === doc.niche)
  return (
    <div className="h-full space-y-3.5 overflow-y-auto p-3" data-scroll>
      <p className="text-xs text-gray-500">O agente lê isto antes de escrever. Quanto mais específico, menos você precisa explicar no chat.</p>
      <Field label="Nicho" hint={niche ? 'As dores, desejos, objeções, a linguagem do público e as regras da profissão entram no pedido.' : 'Escolha um nicho para o agente usar o conhecimento dele.'}>
        <select value={niche ? niche.id : doc.niche ? '__outro' : ''} onChange={(e) => useCopy.getState().edit((d) => ({ ...d, niche: e.target.value === '__outro' ? 'Outro' : e.target.value || undefined }))} className={input}>
          <option value="">Sem nicho</option>
          {NICHES.map((n) => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
          <option value="__outro">Outro (descreva no público)</option>
        </select>
      </Field>
      <Field label="Objetivo" hint="O que a pessoa deve fazer depois de ler: chamar no WhatsApp, agendar, pedir orçamento.">{area('objective')}</Field>
      <Field label="Público">{area('audience')}</Field>
      <Field label="Tom">{area('tone')}</Field>
      <Field label="Oferta">{area('offer')}</Field>
      <Field label="Canal">{area('channel', 1)}</Field>
      <Field label="Observações" hint="Fatos que podem entrar (números, depoimentos, regras do cliente) e o que evitar.">{area('notes', 4)}</Field>
      <p className="text-[11px] text-gray-400">Formato: {formatById(doc.format).label}</p>
    </div>
  )
}

export const SourcesPanel: React.FC = () => {
  const doc = useCopy((s) => s.doc)!
  const sources = doc.sources ?? []
  return (
    <div className="h-full space-y-2 overflow-y-auto p-3" data-scroll>
      {sources.length === 0 ? (
        <p className="text-sm text-gray-500">As fontes que o Pesquisador ler aparecem aqui, com o endereço de cada uma. Peça uma pesquisa na aba Agente.</p>
      ) : (
        sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="block rounded-lg border border-gray-200 bg-white p-2.5 hover:border-violet-300">
            <span className="flex items-start gap-1.5 text-sm font-medium text-gray-900">
              <span className="min-w-0 flex-1">{s.title}</span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-gray-500">{s.url}</span>
          </a>
        ))
      )}
    </div>
  )
}
