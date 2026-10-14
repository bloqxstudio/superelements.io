import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleAlert, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listClients } from '@/features/crm/clients'
import { useCrm } from '@/features/crm/crmStore'
import { NewClientDialog } from '@/features/crm/NewClientDialog'
import { listOpportunities } from '@/features/crm/opportunities'
import { SOURCE_LABEL, SOURCES, STATUS_LABEL, STATUSES, type Client, type ClientSource, type ClientStatus } from '@/features/crm/types'
import { FIELD, Page, PageHeader, StatusBadge, dayLabel, plural } from '@/features/crm/ui'
import { OPEN_STAGES, STAGE_LABEL, type Opportunity } from '@/features/prospects/funnel'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

const PAGE = 100

/** A oportunidade que diz onde o cliente está: a aberta mais recente, senão a última. */
const currentOf = (list: Opportunity[]) =>
  [...list].sort((a, b) => Number(OPEN_STAGES.includes(b.stage)) - Number(OPEN_STAGES.includes(a.stage)) || b.updatedAt.localeCompare(a.updatedAt))[0]

/** Clientes da equipe: todos os cadastros, de onde vieram e onde estão no funil. */
const Clients: React.FC = () => {
  const navigate = useNavigate()
  const team = useCrm((s) => s.team)
  const pipeline = useCrm((s) => s.pipeline)
  const [clients, setClients] = useState<Client[] | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [failed, setFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<ClientStatus | 'todos'>('todos')
  const [source, setSource] = useState<ClientSource | 'todas'>('todas')
  const [limit, setLimit] = useState(PAGE)

  const read = useCallback(() => {
    if (!team || !pipeline) return
    setFailed(false)
    Promise.all([listClients(), listOpportunities(pipeline.id)])
      .then(([list, opps]) => {
        setClients(list)
        setOpportunities(opps)
      })
      .catch((error) => {
        console.error('[crm] falha ao ler os clientes', error)
        setFailed(true)
      })
  }, [team, pipeline])

  useEffect(read, [read])

  const stageOf = useMemo(() => {
    const by = new Map<string, Opportunity[]>()
    for (const o of opportunities) by.set(o.clientId, [...(by.get(o.clientId) ?? []), o])
    return new Map([...by].map(([id, list]) => [id, currentOf(list)]))
  }, [opportunities])

  const counts = useMemo(() => {
    const by: Record<string, number> = {}
    for (const c of clients ?? []) by[c.status] = (by[c.status] ?? 0) + 1
    return by
  }, [clients])

  const visible = useMemo(() => {
    const query = text.trim().toLowerCase()
    return (clients ?? []).filter(
      (c) =>
        (status === 'todos' || c.status === status) &&
        (source === 'todas' || c.source === source) &&
        (!query || [c.name, c.segment, c.city, c.email, c.domain, c.whatsapp, c.phone].some((v) => v?.toLowerCase().includes(query)))
    )
  }, [clients, text, status, source])

  return (
    <Page>
      <PageHeader title="Clientes" text={`Todos os cadastros da equipe ${team?.name ?? ''}: quem veio da Prospecção e quem chegou por indicação, Instagram ou anúncio.`}>
        <Button onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </PageHeader>

      {failed ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center" role="alert">
          <CircleAlert className="h-5 w-5 text-destructive" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-gray-900">Não foi possível ler os clientes</h2>
          <Button onClick={read} className="mt-5">
            Tentar de novo
          </Button>
        </div>
      ) : clients === null ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo os clientes
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Procurar cliente</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setLimit(PAGE)
                }}
                placeholder="Nome, segmento, cidade, e-mail…"
                className={cn(FIELD, 'h-9 pl-9')}
              />
            </label>
            <Chip active={status === 'todos'} onClick={() => setStatus('todos')}>
              Todos <span className="tabular-nums opacity-60">{clients.length}</span>
            </Chip>
            {STATUSES.map((s) => (
              <Chip key={s.id} active={status === s.id} onClick={() => setStatus(s.id)}>
                {s.label} <span className="tabular-nums opacity-60">{counts[s.id] ?? 0}</span>
              </Chip>
            ))}
            <select value={source} onChange={(e) => setSource(e.target.value as ClientSource | 'todas')} aria-label="Como chegou" className={cn(FIELD, 'h-8 w-auto rounded-full text-sm')}>
              <option value="todas">Todas as origens</option>
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {!clients.length ? (
            <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
              <h2 className="text-sm font-semibold text-gray-900">Nenhum cliente ainda</h2>
              <p className="mt-1 max-w-md text-sm text-gray-500">Cadastre o primeiro, ou ponha empresas no funil pela Prospecção: cada uma vira um cliente.</p>
            </div>
          ) : !visible.length ? (
            <p className="mt-6 text-sm text-gray-500">Nenhum cliente com esse filtro.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
              <table className="w-full text-left text-sm">
                <thead className="hidden border-b border-gray-100 text-xs text-gray-500 md:table-header-group">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Cliente</th>
                    <th className="px-4 py-2.5 font-medium">Contato</th>
                    <th className="px-4 py-2.5 font-medium">Situação</th>
                    <th className="px-4 py-2.5 font-medium">No funil</th>
                    <th className="px-4 py-2.5 font-medium">Origem</th>
                    <th className="px-4 py-2.5 text-right font-medium">Atualizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.slice(0, limit).map((c) => {
                    const opp = stageOf.get(c.id)
                    return (
                      <tr key={c.id} onClick={() => navigate(`/crm/clientes/${c.id}`)} className="cursor-pointer align-top transition-colors hover:bg-zinc-50 md:align-middle">
                        <td className="px-4 py-3">
                          <Link to={`/crm/clientes/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-gray-900 hover:underline">
                            {c.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-gray-500">{[c.segment, c.city].filter(Boolean).join(' · ') || '—'}</p>
                          {/* No celular, o resto vem em linha embaixo do nome */}
                          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 md:hidden">
                            <StatusBadge status={c.status} label={STATUS_LABEL[c.status]} />
                            {opp && <span>{STAGE_LABEL[opp.stage]}</span>}
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-gray-600 md:table-cell">
                          <p className="truncate">{c.whatsapp ?? c.phone ?? '—'}</p>
                          {c.email && <p className="truncate text-gray-400">{c.email}</p>}
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <StatusBadge status={c.status} label={STATUS_LABEL[c.status]} />
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-gray-700 md:table-cell">{opp ? STAGE_LABEL[opp.stage] : <span className="text-gray-400">fora do funil</span>}</td>
                        <td className="hidden px-4 py-3 text-xs text-gray-600 md:table-cell">{SOURCE_LABEL[c.source]}</td>
                        <td className="hidden px-4 py-3 text-right text-xs tabular-nums text-gray-500 md:table-cell">{dayLabel(c.updatedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {visible.length > limit && (
                <div className="border-t border-gray-100 p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                    Mostrar mais ({plural(visible.length - limit, 'cliente', 'clientes')})
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <NewClientDialog open={adding} onOpenChange={setAdding} onCreated={(client) => navigate(`/crm/clientes/${client.id}`)} />
    </Page>
  )
}

export default Clients
