import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { Page, PageHeader, Surface, plural, whenLabel } from '@/features/crm/ui'
import { canManage } from '@/features/crm/types'
import { FunnelTablesError, deleteFunnel, listFunnels, type Funnel } from '@/features/funnels/funnels'
import { isConnected } from '@/features/funnels/rules'

/** Funis (CRM › Funis): a lista dos funis da conta, do caminho da campanha à oportunidade ganha. */

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

const FunnelsPage: React.FC = () => {
  const team = useCrm((s) => s.team)
  const navigate = useNavigate()
  const manager = canManage(team?.role)
  const teamId = team?.id
  // O resultado guarda a conta de onde veio e só vale se ainda for a conta aberta
  const [result, setResult] = useState<{ teamId: string; funnels: Funnel[]; error?: string }>()
  const gen = useRef(0)
  const [removing, setRemoving] = useState<string>()
  const funnels = result && result.teamId === teamId ? result.funnels : null
  const error = result && result.teamId === teamId ? result.error : undefined

  const load = useCallback(() => {
    if (!teamId) return
    const mine = ++gen.current
    setResult(undefined)
    listFunnels(teamId).then(
      (list) => mine === gen.current && setResult({ teamId, funnels: list }),
      (e) => mine === gen.current && setResult({ teamId, funnels: [], error: errorText(e) })
    )
  }, [teamId])

  useEffect(() => {
    load()
    return () => {
      gen.current++
    }
  }, [load])

  const remove = (f: Funnel) => {
    if (!teamId || removing || !window.confirm(`Apagar o funil “${f.name}”? Só a configuração é apagada: oportunidades, formulários e relatórios continuam.`)) return
    const mine = gen.current
    setRemoving(f.id)
    deleteFunnel(f.id).then(
      () => {
        if (mine !== gen.current) return
        setResult((r) => (r && r.teamId === teamId ? { ...r, funnels: r.funnels.filter((x) => x.id !== f.id) } : r))
        setRemoving(undefined)
      },
      (e) => {
        if (mine !== gen.current) return
        toast.error(errorText(e))
        setRemoving(undefined)
      }
    )
  }

  return (
    <Page>
      <PageHeader title="Funis" text="Ligue o caminho da campanha à oportunidade ganha: cada etapa lê a sua fonte real, e o que não está conectado aparece como lacuna.">
        {manager && (
          <Button onClick={() => navigate('/crm/funis/novo')}>
            <Plus className="h-4 w-4" /> Novo funil
          </Button>
        )}
      </PageHeader>

      {!team || funnels === null ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo os funis…
        </p>
      ) : error ? (
        <Surface className="mt-6 max-w-2xl">
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
          {error === new FunnelTablesError().message ? (
            <p className="mt-2 text-sm text-gray-600">Aplique a migração e abra esta tela de novo.</p>
          ) : (
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
            </Button>
          )}
        </Surface>
      ) : !funnels.length ? (
        <Surface className="mt-6 max-w-2xl">
          <p className="text-sm font-medium text-gray-900">Nenhum funil ainda.</p>
          <p className="mt-1 text-sm text-gray-600">
            {manager ? 'Comece pelo modelo de captação (campanha até a venda) ou pelo de prospecção ativa.' : 'Peça a um gestor da conta para criar o primeiro funil.'}
          </p>
          {manager && (
            <Button className="mt-4" onClick={() => navigate('/crm/funis/novo')}>
              <Plus className="h-4 w-4" /> Criar o primeiro funil
            </Button>
          )}
        </Surface>
      ) : (
        <ul className="mt-6 grid gap-2">
          {funnels.map((f) => {
            const connected = f.steps.filter(isConnected).length
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
                <Link to={`/crm/funis/${f.id}`} className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="block truncate text-sm font-semibold text-gray-900">{f.name}</span>
                  {f.objective && <span className="mt-0.5 block truncate text-sm text-gray-600">{f.objective}</span>}
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {plural(f.steps.length, 'etapa', 'etapas')} · {connected === f.steps.length ? 'todas com fonte' : `${f.steps.length - connected} sem fonte`} · atualizado {whenLabel(f.updatedAt)}
                  </span>
                </Link>
                {manager && (
                  <button
                    type="button"
                    className="rounded p-2 text-gray-400 hover:bg-zinc-100 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Apagar ${f.name}`}
                    disabled={!!removing}
                    onClick={() => remove(f)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}

export default FunnelsPage
