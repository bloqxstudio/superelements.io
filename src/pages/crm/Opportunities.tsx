import React, { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleAlert, Loader2, Plus, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { useOpportunityFeed } from '@/features/crm/live'
import { NewClientDialog } from '@/features/crm/NewClientDialog'
import { listOpportunities } from '@/features/crm/opportunities'
import { Page, PageHeader } from '@/features/crm/ui'
import { rescore } from '@/features/prospects/api'
import { Funnel } from '@/features/prospects/FunnelBoard'
import type { Opportunity } from '@/features/prospects/funnel'

/** A nota da empresa sempre pela regra atual, como na Prospecção. */
const prepare = (o: Opportunity): Opportunity => ({ ...o, lead: rescore(o.lead) })

/**
 * Oportunidades: o funil da equipe em colunas, o mesmo quadro da Prospecção
 * (oferta, roteiro, ▶ da página), agora nas tabelas do CRM e ao vivo para
 * toda a equipe.
 */
const Opportunities: React.FC = () => {
  const team = useCrm((s) => s.team)
  const pipeline = useCrm((s) => s.pipeline)
  const [items, setItems] = useState<Opportunity[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  // Vindo da ficha do cliente (?oportunidade=): abre o cartão
  const [params] = useSearchParams()
  const initialOpen = params.get('oportunidade') ?? undefined

  const read = useCallback(() => {
    if (!pipeline) return
    setFailed(false)
    listOpportunities(pipeline.id)
      .then((list) => setItems(list.map(prepare)))
      .catch((error) => {
        console.error('[crm] falha ao ler o funil', error)
        setFailed(true)
      })
  }, [pipeline])

  useEffect(read, [read])

  const setList = useCallback<React.Dispatch<React.SetStateAction<Opportunity[]>>>(
    (update) => setItems((prev) => (prev ? (typeof update === 'function' ? update(prev) : update) : prev)),
    []
  )
  useOpportunityFeed(pipeline?.id, team?.id, setList, prepare)

  return (
    <Page wide>
      <PageHeader
        title="Oportunidades"
        text={
          <>
            Funil {pipeline?.name} da equipe {team?.name}. O que alguém da equipe muda aparece aqui na hora.
          </>
        }
      >
        <Button variant="outline" asChild className="gap-1.5">
          <Link to="/prospeccao">
            <Radar className="h-4 w-4" /> Buscar empresas
          </Link>
        </Button>
        <Button onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova oportunidade
        </Button>
      </PageHeader>

      {failed ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center" role="alert">
          <CircleAlert className="h-5 w-5 text-destructive" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-gray-900">Não foi possível ler o funil</h2>
          <p className="mt-1 max-w-sm text-sm text-gray-500">Confira a internet e tente de novo.</p>
          <Button onClick={read} className="mt-5">
            Tentar de novo
          </Button>
        </div>
      ) : items === null ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo o funil
        </p>
      ) : (
        <Funnel items={items} onChange={setList} initialOpen={initialOpen} />
      )}

      <NewClientDialog
        open={adding}
        onOpenChange={setAdding}
        toFunnel
        onCreated={(_, opportunity) => {
          if (opportunity) setList((prev) => (prev.some((o) => o.id === opportunity.id) ? prev : [...prev, prepare(opportunity)]))
        }}
      />
    </Page>
  )
}

export default Opportunities
