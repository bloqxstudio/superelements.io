import React from 'react'
import { ExternalLink, Search, Trash2 } from 'lucide-react'
import type { Research } from './pesquisa'

/** O que a pesquisa achou: a curiosidade, o gancho e cada fato com a fonte, para conferir antes de publicar. */
export const ResearchCard: React.FC<{ research: Research; onClear?: () => void }> = ({ research, onClear }) => {
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '')
    } catch {
      return u
    }
  }
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Search className="h-3.5 w-3.5 text-emerald-700" /> {research.title}</p>
        {onClear && <button type="button" aria-label="Tirar a pesquisa" onClick={onClear} className="text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
      {research.hook && <p className="mt-1 text-xs italic text-gray-700">“{research.hook}”</p>}
      {research.angle && <p className="mt-1 text-[11px] text-gray-500">{research.angle}</p>}
      <ul className="mt-2 space-y-1.5">
        {research.facts.map((f, i) => (
          <li key={i} className="text-xs leading-snug text-gray-800">
            {f.text} <a href={f.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium text-emerald-800 hover:underline">{host(f.source)} <ExternalLink className="h-2.5 w-2.5" /></a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-gray-500">Confira as fontes antes de publicar: o roteiro usa só estes fatos.</p>
    </div>
  )
}
