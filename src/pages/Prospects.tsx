import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, Download, Loader2, Radar, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { byScore, getConfig, getSearch, listSearches, removeSearch, rescore, startSearch } from '@/features/prospects/api'
import { AgencyList } from '@/features/prospects/AgencyList'
import { leadsToCsv } from '@/features/prospects/csv'
import { LeadTable } from '@/features/prospects/LeadTable'
import { nicheFor } from '@/features/prospects/niches'
import { agenciesOf, PLATFORM_LABEL, statsOf } from '@/features/prospects/score'
import { SearchForm } from '@/features/prospects/SearchForm'
import type { Lead, Platform, SearchInput, SearchRecord, SearchSummary } from '@/features/prospects/types'
import { Chip, StatTile, SURFACE } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const nicheNames = (ids: string[]) => ids.map((id) => nicheFor(id).label).join(', ')
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

interface Running {
  input: SearchInput
  stage: string
  businesses?: number
  done: number
  total: number
  leads: Lead[]
  controller: AbortController
}

const PLATFORM_FILTERS: Platform[] = ['wp-elementor', 'wordpress', 'construtor', 'outro', 'sem-site', 'fora-do-ar', 'indefinido']

const SavedSearches: React.FC<{
  items: SearchSummary[]
  currentId?: string
  disabled: boolean
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}> = ({ items, currentId, disabled, onOpen, onDelete }) => {
  const [confirm, setConfirm] = useState<string | null>(null)
  return (
    <aside className={cn(SURFACE, 'flex max-h-[520px] flex-col p-4')}>
      <h2 className="text-sm font-semibold text-gray-900">Buscas salvas</h2>
      {!items.length ? (
        <p className="mt-2 text-sm text-gray-500">As buscas ficam guardadas neste computador para você reabrir e baixar a planilha.</p>
      ) : (
        <ul className="-mx-2 mt-2 space-y-0.5 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className={cn('group flex items-start gap-1 rounded-lg', item.id === currentId ? 'bg-gray-100' : 'hover:bg-gray-50')}>
              <button type="button" disabled={disabled} onClick={() => onOpen(item.id)} className="min-w-0 flex-1 px-2 py-2 text-left disabled:opacity-50">
                <span className="block truncate text-sm font-medium text-gray-900">
                  {item.input.region}
                  {item.input.areas?.length ? ` · ${item.input.areas.length} bairros` : ''}
                </span>
                <span className="block truncate text-xs text-gray-500">{nicheNames(item.input.niches)}</span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-gray-400">
                  {when(item.createdAt)} · {item.stats.businesses} empresas · {item.stats.elementor} Elementor
                </span>
              </button>
              {confirm === item.id ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirm(null)
                    onDelete(item.id)
                  }}
                  onBlur={() => setConfirm(null)}
                  autoFocus
                  className="mr-1 mt-2 rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
                >
                  Apagar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirm(item.id)}
                  aria-label={`Apagar a busca de ${item.input.region}`}
                  className="mr-1 mt-2 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 hover:bg-gray-200 hover:text-gray-900 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

/**
 * Prospecção: empresas de uma cidade e de um nicho, com o que o site delas
 * usa e a nota de oportunidade para o Superelements. O motor roda no
 * servidor de dev (`scripts/prospects`), que abre os sites; a tela só pede e mostra.
 */
const Prospects: React.FC = () => {
  const [config, setConfig] = useState<{ google: boolean } | null | undefined>(undefined)
  const [saved, setSaved] = useState<SearchSummary[]>([])
  const [record, setRecord] = useState<SearchRecord | null>(null)
  const [running, setRunning] = useState<Running | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'empresas' | 'agencias'>('empresas')
  const [platform, setPlatform] = useState<Platform | 'todas'>('todas')
  const [niche, setNiche] = useState('todos')
  const [contactOnly, setContactOnly] = useState(false)
  const [text, setText] = useState('')
  const runningRef = useRef<Running | null>(null)

  const reloadSaved = useCallback(() => {
    listSearches().then(setSaved).catch(() => {})
  }, [])

  useEffect(() => {
    getConfig().then((value) => {
      setConfig(value)
      if (value) reloadSaved()
    })
    return () => runningRef.current?.controller.abort()
  }, [reloadSaved])

  const open = async (id: string) => {
    try {
      setRecord(await getSearch(id))
      setError(null)
      setPlatform('todas')
      setNiche('todos')
    } catch (e) {
      toast.error('Não deu para abrir a busca', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const remove = async (id: string) => {
    try {
      await removeSearch(id)
      if (record?.id === id) setRecord(null)
      reloadSaved()
    } catch (e) {
      toast.error('Não deu para apagar a busca', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const search = async (input: SearchInput) => {
    const controller = new AbortController()
    const state: Running = { input, stage: 'Começando', done: 0, total: 0, leads: [], controller }
    runningRef.current = state
    setRunning(state)
    setRecord(null)
    setError(null)
    setPlatform('todas')
    setNiche('todos')
    const update = (patch: Partial<Running>) => {
      Object.assign(state, patch)
      setRunning({ ...state })
    }
    try {
      await startSearch(
        input,
        (event) => {
          if (event.type === 'stage') update({ stage: event.text })
          else if (event.type === 'businesses') update({ businesses: event.count })
          else if (event.type === 'lead') update({ leads: [...state.leads, rescore(event.lead)], done: event.done, total: event.total })
          else if (event.type === 'error') setError(event.message)
          else if (event.type === 'done') {
            setRecord({ ...event.record, leads: event.record.leads.map(rescore).sort(byScore) })
            toast.success(`${plural(event.record.stats.businesses, 'empresa', 'empresas')} em ${event.record.input.region}`, {
              description: `${event.record.stats.elementor} com WordPress + Elementor`,
            })
          }
        },
        controller.signal
      )
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e))
    } finally {
      runningRef.current = null
      setRunning(null)
      reloadSaved()
    }
  }

  const leads = useMemo(() => (record ? record.leads : running ? [...running.leads].sort(byScore) : []), [record, running])
  const niches = useMemo(() => [...new Set(leads.map((l) => l.niche))], [leads])
  const counts = useMemo(() => {
    const by = new Map<Platform, number>()
    for (const lead of leads) {
      const key = lead.scan?.platform ?? 'sem-site'
      by.set(key, (by.get(key) ?? 0) + 1)
    }
    return by
  }, [leads])

  const filtered = useMemo(() => {
    const query = text.trim().toLowerCase()
    return leads.filter((lead) => {
      if (platform !== 'todas' && (lead.scan?.platform ?? 'sem-site') !== platform) return false
      if (niche !== 'todos' && lead.niche !== niche) return false
      if (contactOnly && !(lead.email || lead.scan?.emails.length || lead.scan?.whatsapp)) return false
      if (query && ![lead.name, lead.domain, lead.neighborhood, lead.scan?.agency?.name].some((v) => v?.toLowerCase().includes(query))) return false
      return true
    })
  }, [leads, platform, niche, contactOnly, text])

  const agencies = useMemo(() => agenciesOf(leads), [leads])
  const stats = statsOf(leads)
  const input = record?.input ?? running?.input

  const download = () => {
    if (!record) return
    const blob = new Blob([leadsToCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = Object.assign(document.createElement('a'), { href: url, download: `prospeccao-${record.id}.csv` })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="min-h-[calc(100vh-57px)] bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Prospecção</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Encontre empresas por cidade e nicho, veja quem já tem WordPress com Elementor e quem é oportunidade para o Superelements.
        </p>

        {config === undefined ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo
          </div>
        ) : config === null ? (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
            <Radar className="h-5 w-5 text-gray-400" aria-hidden />
            <h2 className="mt-3 text-sm font-semibold text-gray-900">A prospecção roda no app aberto neste computador</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              É o computador que abre o site de cada empresa. Abra o app pelo npm run dev (ou o preview do Ship Studio), ou use o terminal: npm run prospectar.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <SearchForm google={config.google} running={Boolean(running)} onSearch={search} />
              <SavedSearches items={saved} currentId={record?.id} disabled={Boolean(running)} onOpen={open} onDelete={remove} />
            </div>

            {running && (
              <div className={cn(SURFACE, 'mt-6 p-4')} role="status" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 text-sm text-gray-900">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-500" aria-hidden />
                    <span className="truncate">
                      {running.total ? `Lendo os sites: ${running.done} de ${running.total}` : running.stage}
                    </span>
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => running.controller.abort()} className="gap-1.5 text-gray-600">
                    <X className="h-4 w-4" /> Parar
                  </Button>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-900 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                    style={{ width: running.total ? `${Math.max(4, (running.done / running.total) * 100)}%` : '4%' }}
                  />
                </div>
                {running.businesses !== undefined && (
                  <p className="mt-2 text-xs text-gray-500">{plural(running.businesses, 'empresa encontrada', 'empresas encontradas')}; as notas aparecem abaixo enquanto os sites são lidos.</p>
                )}
              </div>
            )}

            {error && (
              <div className="mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>{error}</p>
              </div>
            )}

            {input && leads.length > 0 && (
              <section className="mt-8" aria-label="Resultado da busca">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                      {input.region}
                      {input.areas?.length ? ` · ${input.areas.join(', ')}` : ''}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {nicheNames(input.niches)} · {input.source === 'google' ? 'Google Maps' : 'mapa aberto'}
                      {record && ` · ${when(record.createdAt)}`}
                    </p>
                  </div>
                  {record && (
                    <Button variant="outline" size="sm" onClick={download} className="gap-1.5">
                      <Download className="h-4 w-4" /> Baixar planilha ({filtered.length})
                    </Button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <StatTile label="Empresas" value={stats.businesses} />
                  <StatTile label="Com site próprio" value={stats.withSite} of={leads.length} />
                  <StatTile label="WordPress" value={stats.wordpress} of={stats.withSite} hint="dos sites" />
                  <StatTile label="WordPress + Elementor" value={stats.elementor} of={stats.withSite} hint="dos sites" />
                  <StatTile label="Quentes" value={stats.hot} of={leads.length} hint="nota 70 ou mais" />
                </div>

                {record?.notes.map((note) => (
                  <p key={note} className="mt-3 text-xs text-amber-800">{note}</p>
                ))}

                <div className="mt-6 flex items-center gap-1 border-b border-gray-200" role="tablist">
                  {(
                    [
                      ['empresas', `Empresas (${leads.length})`],
                      ['agencias', `Agências (${agencies.length})`],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={cn(
                        '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                        tab === id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {tab === 'empresas' ? (
                  <>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Chip active={platform === 'todas'} onClick={() => setPlatform('todas')}>
                        Todas
                      </Chip>
                      {PLATFORM_FILTERS.filter((p) => counts.get(p)).map((p) => (
                        <Chip key={p} active={platform === p} onClick={() => setPlatform(p)}>
                          {PLATFORM_LABEL[p]} <span className="tabular-nums opacity-60">{counts.get(p)}</span>
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Procurar por nome, site, bairro ou agência"
                        aria-label="Procurar nos resultados"
                        className="h-9 w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {niches.length > 1 && (
                        <select
                          value={niche}
                          onChange={(e) => setNiche(e.target.value)}
                          aria-label="Nicho"
                          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="todos">Todos os nichos</option>
                          {niches.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={contactOnly} onChange={(e) => setContactOnly(e.target.checked)} className="h-4 w-4 accent-gray-900" />
                        Só com e-mail ou WhatsApp
                      </label>
                    </div>
                    <div className="mt-4">
                      {filtered.length ? (
                        <LeadTable leads={filtered} />
                      ) : (
                        <p className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">Nenhuma empresa com esses filtros.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-4">
                    <AgencyList agencies={agencies} />
                  </div>
                )}
              </section>
            )}

            {record && !leads.length && (
              <p className="mt-8 rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
                O mapa não trouxe empresas desse nicho nessa região. Tente outra cidade, outro nicho ou o Google Maps.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Prospects
