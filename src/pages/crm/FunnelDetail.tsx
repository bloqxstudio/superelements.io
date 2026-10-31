import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { Page, PageHeader, Surface, dayLabel } from '@/features/crm/ui'
import { canManage } from '@/features/crm/types'
import { FunnelTrack } from '@/features/funnels/FunnelTrack'
import { FunnelWizard } from '@/features/funnels/FunnelWizard'
import { FUNNEL_PERIODS, FUNNEL_PERIOD_LABEL, loadFunnel, readFunnel, type Funnel, type FunnelPeriod, type FunnelReading } from '@/features/funnels/funnels'
import { cn } from '@/lib/utils'

/**
 * Um funil: Acompanhar (números do período, lidos na hora das fontes) e Configurar (o assistente).
 * `/crm/funis/novo` abre o assistente vazio.
 */

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

const Follow: React.FC<{ teamId: string; funnel: Funnel }> = ({ teamId, funnel }) => {
  const [period, setPeriod] = useState<FunnelPeriod>(30)
  const [reading, setReading] = useState<FunnelReading>()
  const [error, setError] = useState<string>()
  const [tick, setTick] = useState(0)

  // Um período ou funil novo descarta a leitura que ainda estiver voltando
  useEffect(() => {
    let live = true
    setReading(undefined)
    setError(undefined)
    readFunnel(teamId, funnel.steps, period).then(
      (r) => live && setReading(r),
      (e) => live && setError(errorText(e))
    )
    return () => {
      live = false
    }
  }, [teamId, funnel, period, tick])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Período" className="inline-flex rounded-lg bg-white p-0.5 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
          {FUNNEL_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', period === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900')}
            >
              {FUNNEL_PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {reading && (
            <span>
              {dayLabel(reading.from.getTime())} a {dayLabel(reading.to.getTime() - 60_000)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)} disabled={!reading && !error}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      <p className="max-w-3xl text-xs text-gray-500">
        Volumes vêm de cada fonte no mesmo período. A conversão só aparece entre etapas que contam as mesmas pessoas (formulário → oportunidade → estados do CRM); nos estados do CRM, a contagem é de quem atingiu aquele estado ou um posterior: não prova que passou por cada etapa do caminho e não é onde está hoje (o “agora” aparece à parte).
      </p>

      {error ? (
        <Surface>
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
          </Button>
        </Surface>
      ) : !reading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lendo as fontes…
        </p>
      ) : (
        <>
          {reading.cohortTruncated && <p className="text-xs text-amber-800">Há mais de 5.000 oportunidades no período: os números do CRM consideram só as mais recentes.</p>}
          <FunnelTrack steps={funnel.steps} readings={reading.readings} cohort={reading.cohort} />
        </>
      )}
    </div>
  )
}

const FunnelDetail: React.FC = () => {
  const { id } = useParams()
  const isNew = id === 'novo'
  const team = useCrm((s) => s.team)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const manager = canManage(team?.role)
  const tab = params.get('aba') === 'configurar' ? 'configurar' : 'acompanhar'
  const teamId = team?.id
  // O resultado guarda conta e id de onde veio; só vale se ainda forem os da tela
  const [result, setResult] = useState<{ teamId: string; id: string; funnel: Funnel | null; error?: string }>()
  const gen = useRef(0)
  const dirty = useRef(false)
  const current = result && result.teamId === teamId && result.id === id ? result : undefined
  const funnel = current ? current.funnel : undefined
  const error = current?.error

  const load = useCallback(() => {
    if (!teamId || isNew || !id) return
    const mine = ++gen.current
    setResult(undefined)
    loadFunnel(teamId, id).then(
      (f) => mine === gen.current && setResult({ teamId, id, funnel: f }),
      (e) => mine === gen.current && setResult({ teamId, id, funnel: null, error: errorText(e) })
    )
  }, [teamId, id, isNew])
  useEffect(() => {
    load()
    return () => {
      gen.current++
    }
  }, [load])

  const goTab = (t: 'acompanhar' | 'configurar') => {
    if (t === tab) return
    if (dirty.current && !window.confirm('Há alterações neste funil que ainda não foram salvas. Sair e descartar?')) return
    dirty.current = false
    setParams(t === 'acompanhar' ? {} : { aba: t }, { replace: true })
  }
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value
  }, [])

  const back = (
    <Link to="/crm/funis" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Funis
    </Link>
  )

  if (!team) return <Page>{back}</Page>

  if (isNew) {
    return (
      <Page>
        {back}
        <PageHeader title="Novo funil" />
        <div className="mt-6">
          {manager ? <FunnelWizard key={`${team.id}:novo`} teamId={team.id} onDirtyChange={onDirtyChange} onSaved={(newId) => navigate(`/crm/funis/${newId}`, { replace: true })} /> : <Surface><p className="text-sm text-gray-600">Só gestor da conta cria funis.</p></Surface>}
        </div>
      </Page>
    )
  }

  return (
    <Page>
      {back}
      {error ? (
        <Surface className="max-w-2xl">
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
          </Button>
        </Surface>
      ) : funnel === undefined ? (
        <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo o funil…
        </p>
      ) : funnel === null ? (
        <Surface className="max-w-2xl">
          <p className="text-sm text-gray-900">Este funil não existe nesta conta.</p>
          <p className="mt-1 text-sm text-gray-600">Se você trocou de conta, volte à lista: cada conta vê só os seus funis.</p>
        </Surface>
      ) : (
        <>
          <PageHeader title={funnel.name} text={funnel.objective || undefined} />
          <div role="tablist" aria-label="Funil" className="mt-5 flex gap-1 border-b border-gray-200">
            {(['acompanhar', 'configurar'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => goTab(t)}
                className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900')}
              >
                {t === 'acompanhar' ? 'Acompanhar' : 'Configurar'}
              </button>
            ))}
          </div>
          <div className="mt-5" role="tabpanel">
            {tab === 'acompanhar' ? (
              <Follow key={`${team.id}:${funnel.id}:${funnel.updatedAt}`} teamId={team.id} funnel={funnel} />
            ) : manager ? (
              <FunnelWizard
                key={`${team.id}:${funnel.id}:${funnel.updatedAt}`}
                teamId={team.id}
                initial={funnel}
                onDirtyChange={onDirtyChange}
                onSaved={() => {
                  dirty.current = false
                  setParams({}, { replace: true })
                  load()
                }}
              />
            ) : (
              <Surface>
                <p className="text-sm text-gray-600">Só gestor da conta edita funis. Você pode acompanhar os números na aba ao lado.</p>
              </Surface>
            )}
          </div>
        </>
      )}
    </Page>
  )
}

export default FunnelDetail
