import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronDown, Link2Off, Minus } from 'lucide-react'
import { STAGE_LABEL } from '@/features/prospects/funnel'
import { money } from '@/features/crm/ads'
import { cn } from '@/lib/utils'
import { KIND_LABEL, isConnected, reachedStage, transitionOf, type FunnelStep, type OppLite, type Reading } from './rules'

/**
 * A sequência do funil, uma etapa por linha. Entre duas etapas aparece a conversão só quando as duas
 * contam as mesmas pessoas (`transitionOf`); nos outros casos fica o motivo, sem divisão.
 */

const nf = new Intl.NumberFormat('pt-BR')
const pct = (n: number) => `${String(n).replace('.', ',')}%`

const SOURCE_LINK: Partial<Record<FunnelStep['kind'], { to: string; label: string }>> = {
  campaign: { to: '/crm/anuncios', label: 'Abrir Anúncios' },
  page: { to: '/crm/site', label: 'Abrir Site' },
  event: { to: '/crm/site', label: 'Abrir Site' },
}

const Detail: React.FC<{ step: FunnelStep; reading: Reading; cohort: OppLite[] }> = ({ step, reading, cohort }) => {
  const [open, setOpen] = useState(false)
  const records =
    step.kind === 'opportunity'
      ? cohort
      : step.kind === 'stage' && step.source.stage
        ? cohort.filter((o) => reachedStage(o, step.source.stage as string))
        : []
  const link = SOURCE_LINK[step.kind]
  const formId = step.kind === 'form' && step.source.formIds?.length === 1 ? step.source.formIds[0] : undefined
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {link && (
        <Link to={link.to} className="font-medium text-violet-700 hover:underline">
          {link.label}
        </Link>
      )}
      {step.kind === 'form' && (
        <Link to={formId ? `/crm/formularios/${formId}` : '/crm/formularios'} className="font-medium text-violet-700 hover:underline">
          Abrir respostas
        </Link>
      )}
      {records.length > 0 && reading.state === 'ok' && (
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
          Ver oportunidades ({records.length}) <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      )}
      {open && (
        <ul className="basis-full divide-y divide-gray-100 rounded-lg border border-gray-100">
          {records.slice(0, 50).map((o) => (
            <li key={o.id}>
              <Link to={`/crm?oportunidade=${o.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-zinc-50">
                <span className="truncate text-gray-900">{o.name ?? 'Sem nome'}</span>
                <span className="shrink-0 text-gray-500">agora: {STAGE_LABEL[o.stage as keyof typeof STAGE_LABEL] ?? o.stage}</span>
              </Link>
            </li>
          ))}
          {records.length > 50 && <li className="px-3 py-2 text-gray-500">Mostrando 50 de {records.length}. O restante está em Oportunidades.</li>}
        </ul>
      )}
    </div>
  )
}

const StepCard: React.FC<{ index: number; step: FunnelStep; reading: Reading; cohort: OppLite[] }> = ({ index, step, reading, cohort }) => (
  <li className="relative rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white" aria-hidden>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{KIND_LABEL[step.kind]}</p>
        <h3 className="text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]">{step.name}</h3>

        {reading.state === 'ok' && (
          <>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{nf.format(reading.value)}</span>
              <span className="text-sm text-gray-600">{step.kind === 'stage' ? `${reading.unit} atingiram este estado ou um posterior` : reading.unit}</span>
            </p>
            {reading.current !== undefined && (
              <p className="mt-0.5 text-xs text-gray-500">
                Agora neste estado: <span className="font-medium tabular-nums text-gray-700">{nf.format(reading.current)}</span>
                <span className="text-gray-400"> · os outros estão em estados diferentes (adiante, atrás ou perdidos)</span>
              </p>
            )}
            {reading.spend !== undefined && (
              <p className="mt-1 text-xs text-gray-600">
                Investimento no período: <span className="font-medium tabular-nums">{money(reading.spend, reading.currency)}</span>
                {step.kind === 'opportunity' && reading.value > 0 && (
                  <>
                    {' '}
                    · <span className="font-medium tabular-nums">{money(reading.spend / reading.value, reading.currency)}</span> por oportunidade (leads ligados às campanhas pelo id)
                    {!reading.spendExact && <span className="font-medium text-amber-800"> · aproximado: o gasto cobre só parte do período ou foi lido há mais de 24 h</span>}
                  </>
                )}
              </p>
            )}
            {reading.sales && step.kind === 'stage' && step.source.stage === 'fechado' && (
              <p className="mt-1 text-xs text-gray-600">
                {reading.sales.withValue > 0 ? (
                  <>
                    Valor informado nas oportunidades fechadas: <span className="font-medium tabular-nums">{money(reading.sales.total)}</span>
                    {reading.sales.withValue < reading.sales.closed && ` (${reading.sales.closed - reading.sales.withValue} sem valor informado)`}
                  </>
                ) : (
                  reading.sales.closed > 0 && 'As oportunidades fechadas ainda não têm valor informado na oferta.'
                )}
              </p>
            )}
            {reading.sales && step.kind === 'opportunity' && reading.sales.lost > 0 && <p className="mt-1 text-xs text-gray-500">{nf.format(reading.sales.lost)} perdidas, fora do caminho de venda.</p>}
            {reading.note && <p className="mt-1 text-xs text-gray-500">{reading.note}</p>}
          </>
        )}

        {reading.state === 'unavailable' && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800" role="status">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">Indisponível.</span> {reading.reason}
            </span>
          </p>
        )}

        {reading.state === 'unconnected' && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">
            <Link2Off className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{isConnected(step) ? 'Sem leitura.' : 'Sem fonte conectada: esta etapa não tem número. Escolha a fonte em Configurar.'}</span>
          </p>
        )}

        <Detail step={step} reading={reading} cohort={cohort} />
      </div>
    </div>
  </li>
)

export const FunnelTrack: React.FC<{ steps: FunnelStep[]; readings: Reading[]; cohort: OppLite[] }> = ({ steps, readings, cohort }) => (
  <ol className="grid gap-0" aria-label="Etapas do funil">
    {steps.map((step, i) => {
      const reading = readings[i] ?? { state: 'unconnected' as const }
      const t = i > 0 ? transitionOf(steps[i - 1], step, readings[i - 1] ?? { state: 'unconnected' }, reading) : undefined
      return (
        <React.Fragment key={step.id ?? i}>
          {t && (
            <li aria-hidden={false} className="flex items-center gap-3 py-1.5 pl-3">
              <span className="h-6 w-px bg-gray-300" aria-hidden />
              {t.rate !== undefined ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-800">
                  {pct(t.rate)}{' '}
                  <span className="font-normal">
                    {t.basis === 'respostas'
                      ? `das respostas têm oportunidade ligada (etapa ${i} → ${i + 1})`
                      : `dos que atingiram a etapa ${i} atingiram também a ${i + 1} (estado atual ou posterior; não prova a passagem por cada etapa)`}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Minus className="h-3 w-3 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium">Sem conversão.</span> {t.reason}
                  </span>
                </span>
              )}
            </li>
          )}
          <StepCard index={i} step={step} reading={reading} cohort={cohort} />
        </React.Fragment>
      )
    })}
  </ol>
)
