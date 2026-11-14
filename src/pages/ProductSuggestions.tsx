import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CircleAlert, Download, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { subscribeTopic } from '@/lib/realtimeTopic'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { FIELD, Page, PageHeader } from '@/features/crm/ui'
import { KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL, listSuggestions, suggestionsCsv, updateSuggestion, type Suggestion, type SuggestionKind, type SuggestionPriority, type SuggestionStatus } from '@/features/sugestoes/api'

/**
 * /sugestoes — o que as pessoas pediram ao time de produto pela Iara, como planilha: uma linha por
 * sugestão, com a tela e a conta de onde veio. O time muda status, prioridade e nota na própria
 * linha, filtra e exporta CSV (abre no Excel e no Google Planilhas). Só o admin da plataforma.
 */

const STATUS_TONE: Record<SuggestionStatus, string> = {
  nova: 'bg-violet-50 text-violet-800',
  avaliando: 'bg-amber-50 text-amber-900',
  planejada: 'bg-sky-50 text-sky-800',
  feita: 'bg-emerald-50 text-emerald-800',
  descartada: 'bg-gray-100 text-gray-600',
}

const NoteCell: React.FC<{ s: Suggestion; onSave: (note: string) => void }> = ({ s, onSave }) => {
  const [v, setV] = useState(s.note)
  useEffect(() => setV(s.note), [s.note])
  return (
    <textarea
      aria-label={`Nota sobre ${s.title}`}
      rows={2}
      value={v}
      maxLength={2000}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== s.note && onSave(v)}
      placeholder="Nota do produto"
      className="w-full min-w-[160px] resize-y rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-gray-800 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
    />
  )
}

const ProductSuggestions: React.FC = () => {
  const { profile } = useAuth()
  const admin = profile?.role === 'admin'
  const [list, setList] = useState<Suggestion[] | null>(null)
  const [error, setError] = useState<string>()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'' | SuggestionStatus>('')
  const [kind, setKind] = useState<'' | SuggestionKind>('')
  const [open, setOpen] = useState<string>()

  const load = useCallback(async () => {
    try {
      setList(await listSuggestions())
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui ler as sugestões.')
      setList([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Ao vivo: sugestão nova chega sem recarregar
  const timer = useRef<number>()
  useEffect(() => {
    // Tópico fixo: o helper espera o canal antigo com esse tópico sair antes de entrar (revisão de 2026-11-13)
    const leave = subscribeTopic('product-suggestions', (channel) =>
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'product_suggestions' }, () => {
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => void load(), 500)
        })
    )
    return () => {
      window.clearTimeout(timer.current)
      leave()
    }
  }, [load])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (list ?? []).filter(
      (s) =>
        (!status || s.status === status) &&
        (!kind || s.kind === kind) &&
        (!needle || [s.title, s.description, s.area, s.teamName, s.userName, s.screenTitle, s.original].some((t) => t.toLowerCase().includes(needle)))
    )
  }, [list, q, status, kind])

  const counts = useMemo(() => {
    const out = { nova: 0, avaliando: 0, planejada: 0, feita: 0, descartada: 0 } as Record<SuggestionStatus, number>
    for (const s of list ?? []) out[s.status] += 1
    return out
  }, [list])

  const patch = async (s: Suggestion, change: { status?: SuggestionStatus; priority?: SuggestionPriority | ''; note?: string }) => {
    const before = list
    setList((l) => (l ?? []).map((x) => (x.id === s.id ? { ...x, ...(change.status ? { status: change.status } : {}), ...(change.priority !== undefined ? { priority: change.priority || undefined } : {}), ...(change.note !== undefined ? { note: change.note } : {}) } : x)))
    try {
      await updateSuggestion(s.id, change)
    } catch (e) {
      setList(before)
      toast.error(e instanceof Error ? e.message : 'Não consegui salvar.')
    }
  }

  const exportCsv = () => {
    const blob = new Blob([suggestionsCsv(shown)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sugestoes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <Page wide>
      <PageHeader title="Sugestões do produto" text={admin ? 'O que as pessoas pediram ao time pela Iara, com a tela e a conta de onde veio.' : 'As sugestões que você mandou ao time de produto pela Iara e o status de cada uma.'}>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!shown.length}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden /> Exportar CSV
        </Button>
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={cn(FIELD, 'h-8 w-56 pl-8 text-sm')} />
        </label>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as SuggestionStatus | '')} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')}>
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as SuggestionStatus[]).map((k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]} ({counts[k]})
            </option>
          ))}
        </select>
        <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as SuggestionKind | '')} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')}>
          <option value="">Todos os tipos</option>
          {(Object.keys(KIND_LABEL) as SuggestionKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs tabular-nums text-gray-500">{shown.length} de {list?.length ?? 0}</span>
      </div>

      {list === null ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo
        </p>
      ) : error ? (
        <p role="alert" className="mt-8 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="h-4 w-4" aria-hidden /> {error}
        </p>
      ) : shown.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-800">Nenhuma sugestão {list.length ? 'neste filtro' : 'ainda'}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">Abra a Iara (⌘J) em qualquer tela e diga o que pode melhorar. Ela escreve a sugestão, você confere e ela chega aqui.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-24 px-3 py-2">Data</th>
                <th className="w-24 px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Sugestão</th>
                <th className="w-40 px-3 py-2">Tela / área</th>
                <th className="w-40 px-3 py-2">Conta · pessoa</th>
                <th className="w-32 px-3 py-2">Status</th>
                {admin && <th className="w-28 px-3 py-2">Prioridade</th>}
                <th className="w-56 px-3 py-2">Nota do produto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 align-top">
              {shown.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/60">
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-500">{new Date(s.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{KIND_LABEL[s.kind]}</td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => setOpen(open === s.id ? undefined : s.id)} aria-expanded={open === s.id} className="text-left font-medium text-gray-900 hover:underline">
                      {s.title}
                    </button>
                    <p className={cn('mt-0.5 text-xs text-gray-600', open === s.id ? 'whitespace-pre-line' : 'line-clamp-2')}>{s.description}</p>
                    {open === s.id && (
                      <div className="mt-2 grid gap-1 text-xs text-gray-600">
                        {s.impact && (
                          <p>
                            <strong className="font-medium text-gray-800">Impacto:</strong> {s.impact}
                          </p>
                        )}
                        {s.original && (
                          <p>
                            <strong className="font-medium text-gray-800">O que a pessoa disse:</strong> “{s.original}”
                          </p>
                        )}
                        <p className="text-gray-400">{s.screenPath} · via {s.via === 'iara' ? 'Iara' : 'tela'}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {s.area || s.screenTitle}
                    {s.area && s.screenTitle && s.area !== s.screenTitle && <span className="block text-gray-400">{s.screenTitle}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {s.teamName || '—'}
                    <span className="block text-gray-400">{s.userName}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {admin ? (
                      <select aria-label="Status" value={s.status} onChange={(e) => void patch(s, { status: e.target.value as SuggestionStatus })} className={cn('h-7 rounded-full border-0 px-2 text-[11px] font-medium focus:ring-2 focus:ring-ring', STATUS_TONE[s.status])}>
                        {(Object.keys(STATUS_LABEL) as SuggestionStatus[]).map((k) => (
                          <option key={k} value={k}>
                            {STATUS_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn('inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium', STATUS_TONE[s.status])}>{STATUS_LABEL[s.status]}</span>
                    )}
                  </td>
                  {admin && (
                    <td className="px-3 py-2.5">
                      <select aria-label="Prioridade" value={s.priority ?? ''} onChange={(e) => void patch(s, { priority: e.target.value as SuggestionPriority | '' })} className={cn(FIELD, 'h-7 w-auto py-0 text-xs')}>
                        <option value="">—</option>
                        {(Object.keys(PRIORITY_LABEL) as SuggestionPriority[]).map((k) => (
                          <option key={k} value={k}>
                            {PRIORITY_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-2 py-1.5">{admin ? <NoteCell s={s} onSave={(note) => void patch(s, { note })} /> : <p className="px-1 py-1 text-xs text-gray-700">{s.note || '—'}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  )
}

export default ProductSuggestions
