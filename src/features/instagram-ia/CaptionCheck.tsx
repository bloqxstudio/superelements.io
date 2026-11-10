import { useDeferredValue, useMemo, useState } from 'react'
import { ChevronDown, Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'
import { lintCaption, type CheckStatus } from './legenda.ts'
import { detect, humanize, HUMAN_CHECK_LABEL } from './humanizar.ts'

/**
 * Revisão da legenda embaixo do campo (publicar no Instagram, Motion, cena): o que o feed mostra
 * antes do "mais", as checagens (primeira linha, uma chamada, até 5 hashtags, link morto, emoji),
 * a nota de "cara de IA" e o botão que tira travessão, invisíveis e clichês na hora.
 * Tudo local, sem IA: roda a cada tecla.
 */

const DOT: Record<CheckStatus, string> = { OK: 'bg-emerald-500', ATENCAO: 'bg-amber-500', CORRIGIR: 'bg-rose-500' }
const VERDICT = {
  PRONTA: { label: 'Pronta', cls: 'text-emerald-700' },
  REVISAR: { label: 'Revisar', cls: 'text-amber-700' },
  CORRIGIR: { label: 'Corrigir', cls: 'text-rose-700' },
} as const
const HUMAN = { PASSA: 'text-emerald-700', REVISAR: 'text-amber-700', SINALIZADO: 'text-rose-700' } as const

export function CaptionCheck({ value, onChange, disabled, className }: { value: string; onChange?: (next: string) => void; disabled?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const [cleaned, setCleaned] = useState<number | null>(null)
  const text = useDeferredValue(value)
  const lint = useMemo(() => (text.trim() ? lintCaption(text) : null), [text])
  const human = useMemo(() => (text.trim() ? detect(text) : null), [text])
  const clean = useMemo(() => (text.trim() ? humanize(text) : null), [text])
  if (!lint || !human || !clean) return null

  const v = VERDICT[lint.veredito]
  const issues = lint.checks.filter((c) => c.status !== 'OK')
  const canClean = !!onChange && clean.total > 0 && clean.texto !== value.trim()

  return (
    <div className={cn('rounded-md border border-gray-200 bg-gray-50/70 text-[11px] text-gray-600', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-1.5 text-left hover:text-gray-900" aria-expanded={open}>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')} />
          <span className={cn('font-semibold', v.cls)}>{v.label}</span>
          <span className="truncate">
            {issues.length ? `${issues.length} ponto${issues.length > 1 ? 's' : ''} a ver` : 'tudo certo'} · {Math.min(lint.caracteres, lint.corte)} de {lint.corte} antes do "mais"
          </span>
        </button>
        <span className={cn('tabular-nums', HUMAN[human.veredito])} title="Heurística local (ritmo, concreto, clichês, caracteres, voz). Não é um detector de IA de terceiros.">
          Cara de IA: {Math.round(100 - human.nota)}%
        </span>
        {canClean && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange?.(clean.texto)
              setCleaned(clean.total)
            }}
            className="ml-auto inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 font-medium text-gray-700 hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
            title={clean.mudancas.map((m) => `${m.de} → ${m.para}`).join('\n')}
          >
            <Eraser className="h-3 w-3" /> Tirar cara de IA ({clean.total})
          </button>
        )}
        {!canClean && cleaned !== null && <span className="ml-auto text-emerald-700">Tirei {cleaned} marca{cleaned > 1 ? 's' : ''}.</span>}
      </div>
      {open && (
        <div className="space-y-2 border-t border-gray-200 px-2 py-2">
          <div>
            <p className="mb-1 font-medium text-gray-700">O que o feed mostra</p>
            <p className="whitespace-pre-wrap break-words rounded border border-gray-200 bg-white px-2 py-1.5 text-xs leading-snug text-gray-800">
              {lint.visivel}
              {lint.cortada && <span className="text-gray-400">… mais</span>}
            </p>
          </div>
          <ul className="space-y-0.5">
            {lint.checks.map((c) => (
              <li key={c.id} className="flex gap-1.5">
                <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', DOT[c.status])} />
                <span>
                  <b className="font-medium text-gray-700">{c.nome}:</b> {c.detalhe}
                </span>
              </li>
            ))}
          </ul>
          {clean.estruturas.length > 0 && (
            <div>
              <p className="mb-0.5 font-medium text-gray-700">Reescreva à mão</p>
              <ul className="space-y-0.5">
                {clean.estruturas.map((e) => (
                  <li key={e.id}>
                    <b className="font-medium text-gray-700">{e.nome}</b>: {e.correcao}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-gray-500">
            A nota de "cara de IA" é uma heurística local (a mais fraca: {HUMAN_CHECK_LABEL[human.pior].toLowerCase()}). Peça à Iara ("revise esta legenda") para reescrever o que ficou fraco.
          </p>
        </div>
      )}
    </div>
  )
}
