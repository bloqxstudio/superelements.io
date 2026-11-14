import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Stat } from '@/features/crm/InstagramCharts'
import { compact, percent } from '@/features/crm/instagram'
import { byOrigin, isLive, placeLabel as formPlace, useNow, type FormVisit } from '@/features/crm/formVisits'
import { FormsMap } from '@/features/crm/FormsMap'
import type { CrmForm } from '@/features/crm/forms'
import { duration, moneyText, periodPhrase, type SitePeriod, type SiteReport } from '@/features/crm/site'
import { campaignRows, costPer, countsAsVisit, formWhere, funnelTotals, type SpendCampaign } from '@/features/crm/siteFunnel'
import { matchCampaign, type MetaState } from '@/features/crm/siteMeta'
import { JourneyFunnel } from '@/features/crm/SiteForms'
import { Surface, whenLabel } from '@/features/crm/ui'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

/**
 * Os relatórios dos ativos da empresa (Resultados › Visitas, 2026-11-14, o usuário: "é o canal pós anúncio,
 * pode ser várias fontes… Visitas, ativos da empresa: Site - Formulários… a parte de relatórios, tanto do site
 * quanto formulário, com clareza de origem, métricas, campanhas, valores gastos para ambos"). Resumo junta
 * os dois (sem contar duas vezes: `siteFunnel.ts`), Formulários é o relatório só deles, e as campanhas põem
 * o gasto da Meta ao lado do que cada ativo recebeu.
 */

export interface FormsData {
  current: FormVisit[]
  previous: FormVisit[]
  forms: Map<string, CrmForm>
  ready: boolean
}

const Delta: React.FC<{ now: number; before: number; lowerIsBetter?: boolean }> = ({ now, before, lowerIsBetter }) => {
  if (!before) return null
  const change = (now - before) / before
  if (Math.abs(change) < 0.005) return <span className="text-gray-400">igual</span>
  const good = lowerIsBetter ? change < 0 : change > 0
  return <span className={cn('font-medium', good ? 'text-emerald-700' : 'text-rose-700')}>{`${change > 0 ? '+' : '−'}${percent(Math.abs(change), 0)}`}</span>
}

/** O gasto da Meta no período e um jeito de achar a campanha pelo nome no link */
function useSpend(metaState: MetaState) {
  return useMemo(() => {
    if (metaState.status !== 'ready') return { total: undefined, currency: undefined, resolve: () => undefined, list: [] as SpendCampaign[] }
    const meta = metaState.meta
    const list: SpendCampaign[] = meta.campaigns.map((c) => ({ id: `${c.accountId}:${c.id}`, name: c.name, spend: c.metrics.spend, clicks: c.metrics.linkClicks }))
    const resolve = (name: string) => {
      const c = matchCampaign(meta, { campaign: name })
      return c ? list.find((l) => l.id === `${c.accountId}:${c.id}`) : undefined
    }
    return { total: list.reduce((sum, c) => sum + c.spend, 0), currency: meta.currency, resolve, list }
  }, [metaState])
}

const MetaNote: React.FC<{ state: MetaState }> = ({ state }) =>
  state.status === 'loading' ? (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
      <Loader2 className="h-3 w-3 animate-spin" /> lendo os anúncios…
    </span>
  ) : state.status === 'none' ? (
    <span className="text-xs text-gray-400">
      Sem conta de anúncios conectada: <Link to="/crm/anuncios" className="underline">conectar em Anúncios</Link>
    </span>
  ) : state.status === 'error' ? (
    <span className="text-xs text-rose-600">{state.error}</span>
  ) : (
    <span className="text-xs text-gray-400">gasto da Meta no mesmo período{state.refreshing ? ' · atualizando…' : ''}</span>
  )

/** Por campanha: gasto, cliques e o que cada ativo recebeu (site, formulário) até o agendamento */
export const CampaignsSpend: React.FC<{
  site?: SiteReport['campaigns']
  forms: FormVisit[]
  metaState: MetaState
  /** Só as colunas do formulário (relatório Formulários) */
  formsOnly?: boolean
}> = ({ site = [], forms, metaState, formsOnly }) => {
  const spend = useSpend(metaState)
  const rows = useMemo(() => campaignRows(formsOnly ? [] : site, forms, spend.resolve, spend.list), [site, forms, spend, formsOnly])
  const money = (n: number | undefined) => (n === undefined ? '—' : moneyText(n, spend.currency, n < 100))
  const shown = rows.filter((r) => (formsOnly ? r.formOpened > 0 || (r.spend ?? 0) > 0 : true)).slice(0, 15)
  return (
    <Surface title="Campanhas: gasto e o que chegou" action={<MetaNote state={metaState} />}>
      {shown.length ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="se-table w-full min-w-[720px] text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-3 font-medium">Campanha</th>
                <th className="px-2 pb-2 text-right font-medium">Gasto</th>
                <th className="px-2 pb-2 text-right font-medium">Cliques</th>
                {!formsOnly && <th className="px-2 pb-2 text-right font-medium">Site</th>}
                <th className="px-2 pb-2 text-right font-medium" title={formsOnly ? 'Abriram o formulário' : 'Pelo link do formulário ou num site sem o código de visitas'}>{formsOnly ? 'Abriram' : 'Só formulário'}</th>
                <th className="px-2 pb-2 text-right font-medium">Enviaram</th>
                <th className="px-2 pb-2 text-right font-medium">Agendaram</th>
                <th className="px-2 pb-2 text-right font-medium">{formsOnly ? 'Custo por envio' : 'Custo por visita'}</th>
                <th className="pb-2 pl-2 text-right font-medium">Custo por agendamento</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} className="border-t border-gray-100">
                  <td className="max-w-[260px] py-2 pr-3">
                    <span className="block truncate text-sm text-gray-900" title={r.name}>{r.name}</span>
                    {r.spend === undefined && <span className="block text-[11px] text-gray-400">sem gasto achado (nome do link)</span>}
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-gray-900">{money(r.spend)}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{r.clicks ? compact(r.clicks) : '—'}</td>
                  {!formsOnly && <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{r.site || '—'}</td>}
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{(formsOnly ? r.formOpened : r.formOnly) || '—'}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{r.submitted || '—'}</td>
                  <td className={cn('px-2 py-2 text-right text-sm tabular-nums', r.scheduled ? 'font-medium text-emerald-700' : 'text-gray-400')}>{r.scheduled || '—'}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{money(costPer(r.spend, formsOnly ? r.submitted : r.visits))}</td>
                  <td className="py-2 pl-2 text-right text-sm tabular-nums text-gray-700">{money(costPer(r.spend, r.scheduled))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-gray-400">A campanha é achada pelo nome no link do anúncio (utm_campaign). Gasto e cliques vêm da Meta; o resto, do que o site e os formulários contaram.</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nenhuma visita veio de campanha com nome no link neste período.</p>
      )}
    </Surface>
  )
}

/** Resumo: os dois ativos juntos, sem contar duas vezes, com o gasto */
export const AssetsSummary: React.FC<{
  report: SiteReport
  period: SitePeriod
  forms: FormsData
  metaState: MetaState
  hasSite: boolean
  onChannel: (channel: string) => void
}> = ({ report, period, forms, metaState, hasSite, onChannel }) => {
  const spend = useSpend(metaState)
  const t = funnelTotals(report.totals.sessions, forms.current)
  const p = funnelTotals(report.previous.sessions, forms.previous)
  const money = (n: number | undefined) => (n === undefined ? '—' : moneyText(n, spend.currency, n < 100))
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          dark
          label="Visitas"
          value={compact(t.visits)}
          sub={
            <span className="flex flex-wrap gap-x-2">
              <span>{compact(t.site)} no site · {compact(t.formLink)} só no formulário</span>
              <Delta now={t.visits} before={p.visits} />
            </span>
          }
        />
        <Stat
          label="Contatos no site"
          value={compact(report.totals.converted)}
          sub={
            <span className="flex flex-wrap gap-x-2">
              <span>WhatsApp, ligação, e-mail</span>
              <Delta now={report.totals.converted} before={report.previous.converted} />
            </span>
          }
        />
        <Stat
          label="Enviaram formulário"
          value={compact(t.submitted)}
          sub={
            <span className="flex flex-wrap gap-x-2">
              <span>de {compact(t.formOpened)} que abriram</span>
              <Delta now={t.submitted} before={p.submitted} />
            </span>
          }
        />
        <Stat
          label="Agendaram"
          value={compact(t.scheduled)}
          sub={
            <span className="flex flex-wrap gap-x-2">
              <span>{compact(t.scheduleView)} viram a agenda</span>
              <Delta now={t.scheduled} before={p.scheduled} />
            </span>
          }
        />
        <Stat
          label="Gasto em anúncios"
          value={money(spend.total)}
          sub={
            spend.total !== undefined ? (
              <span>
                {money(costPer(spend.total, t.visits))} por visita · {money(costPer(spend.total, t.scheduled))} por agendamento
              </span>
            ) : (
              <MetaNote state={metaState} />
            )
          }
        />
      </div>
      {!hasSite && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sem site cadastrado: as visitas aqui são só dos formulários. Cadastre o site na aba Site para somar os dois.
        </p>
      )}
      {forms.current.length || forms.previous.length ? (
        <JourneyFunnel siteSessions={report.totals.sessions} previousSiteSessions={report.previous.sessions} siteChannels={report.channels} current={forms.current} previous={forms.previous} onChannel={onChannel} />
      ) : (
        <Surface title="Funil: campanha → site ou formulário → agendamento">
          <p className="text-sm text-gray-500">Nenhuma visita a formulário {periodPhrase(period)}. O funil aparece quando alguém abrir um formulário publicado.</p>
        </Surface>
      )}
      <CampaignsSpend site={report.campaigns} forms={forms.current} metaState={metaState} />
    </div>
  )
}

/** Formulários: o relatório só dos formulários da conta (por formulário, origem, campanha e gasto) */
export const FormsReport: React.FC<{ period: SitePeriod; forms: FormsData; metaState: MetaState; onOpenVisit: (v: FormVisit) => void }> = ({ period, forms, metaState, onOpenVisit }) => {
  const [originKey, setOriginKey] = useState<'channel' | 'campaign'>('channel')
  const list = forms.current
  const t = funnelTotals(0, list)
  const p = funnelTotals(0, forms.previous)
  const started = list.filter((v) => v.started || v.submitted).length
  const startedBefore = forms.previous.filter((v) => v.started || v.submitted).length
  const avgMs = list.length ? list.reduce((s, v) => s + v.activeMs, 0) / list.length : 0

  const byForm = useMemo(() => {
    const map = new Map<string, { id: string; name: string; opened: number; link: number; started: number; submitted: number; scheduled: number }>()
    for (const v of list) {
      const f = forms.forms.get(v.formId)
      const r = map.get(v.formId) ?? { id: v.formId, name: f?.live?.name || f?.name || 'Formulário apagado', opened: 0, link: 0, started: 0, submitted: 0, scheduled: 0 }
      r.opened++
      if (countsAsVisit(v)) r.link++
      if (v.started || v.submitted) r.started++
      if (v.submitted) r.submitted++
      if (v.scheduled) r.scheduled++
      map.set(v.formId, r)
    }
    return [...map.values()].sort((a, b) => b.opened - a.opened)
  }, [list, forms.forms])
  const origins = useMemo(() => byOrigin(list, originKey).slice(0, 10), [list, originKey])
  const recent = useMemo(() => [...list].sort((a, b) => b.startedAt - a.startedAt).slice(0, 15), [list])
  const now = useNow(10_000)
  const live = useMemo(() => list.filter((v) => isLive(v, now)), [list, now])
  const formName = (id: string) => forms.forms.get(id)?.live?.name || forms.forms.get(id)?.name || 'Formulário'

  if (!forms.ready)
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Lendo os formulários…
      </p>
    )
  if (!list.length && !forms.previous.length)
    return (
      <Surface className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-gray-900">Nenhuma visita a formulário {periodPhrase(period)}.</p>
        <p className="mt-1 text-sm text-gray-500">Os números aparecem quando alguém abrir um formulário publicado, pelo link ou dentro do site.</p>
        <Link to="/crm/formularios" className="mt-3 inline-block text-sm font-medium text-gray-700 underline">
          Ver os formulários
        </Link>
      </Surface>
    )

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat dark label="Abriram" value={compact(t.formOpened)} sub={<span className="flex flex-wrap gap-x-2"><span>{compact(t.formLink)} só no formulário</span><Delta now={t.formOpened} before={p.formOpened} /></span>} />
        <Stat label="Começaram" value={compact(started)} sub={<span className="flex flex-wrap gap-x-2"><span>{percent(t.formOpened ? started / t.formOpened : 0, 0)} de quem abriu</span><Delta now={started} before={startedBefore} /></span>} />
        <Stat label="Enviaram" value={compact(t.submitted)} sub={<span className="flex flex-wrap gap-x-2"><span>{percent(t.formOpened ? t.submitted / t.formOpened : 0, 0)} de quem abriu</span><Delta now={t.submitted} before={p.submitted} /></span>} />
        <Stat label="Agendaram" value={compact(t.scheduled)} sub={<span className="flex flex-wrap gap-x-2"><span>{percent(t.submitted ? t.scheduled / t.submitted : 0, 0)} de quem enviou</span><Delta now={t.scheduled} before={p.scheduled} /></span>} />
        <Stat label="Tempo médio" value={duration(avgMs)} sub="em uso, por visita" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Surface title="Por formulário">
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="se-table w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-3 font-medium">Formulário</th>
                  <th className="px-2 pb-2 text-right font-medium">Abriram</th>
                  <th className="px-2 pb-2 text-right font-medium">Começaram</th>
                  <th className="px-2 pb-2 text-right font-medium">Enviaram</th>
                  <th className="pb-2 pl-2 text-right font-medium">Agendaram</th>
                </tr>
              </thead>
              <tbody>
                {byForm.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="max-w-[220px] py-2 pr-3">
                      <Link to={`/crm/formularios/${r.id}?aba=aovivo`} className="block truncate text-sm text-gray-900 hover:underline">{r.name}</Link>
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-gray-900">{r.opened}</td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{r.started}</td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">
                      {r.submitted} <span className="text-[11px] text-gray-400">{percent(r.opened ? r.submitted / r.opened : 0, 0)}</span>
                    </td>
                    <td className={cn('py-2 pl-2 text-right text-sm tabular-nums', r.scheduled ? 'font-medium text-emerald-700' : 'text-gray-400')}>{r.scheduled || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
        <Surface
          title="De onde vêm"
          action={
            <div className="flex gap-1">
              <Chip active={originKey === 'channel'} onClick={() => setOriginKey('channel')} className="h-7 px-2.5 text-xs">Canal</Chip>
              <Chip active={originKey === 'campaign'} onClick={() => setOriginKey('campaign')} className="h-7 px-2.5 text-xs">Campanha</Chip>
            </div>
          }
        >
          {origins.length ? (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="se-table w-full min-w-[420px] text-left">
                <thead>
                  <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-3 font-medium">{originKey === 'channel' ? 'Canal' : 'Campanha'}</th>
                    <th className="px-2 pb-2 text-right font-medium">Abriram</th>
                    <th className="px-2 pb-2 text-right font-medium">Começaram</th>
                    <th className="px-2 pb-2 text-right font-medium">Enviaram</th>
                    <th className="pb-2 pl-2 text-right font-medium">Agendaram</th>
                  </tr>
                </thead>
                <tbody>
                  {origins.map((o) => (
                    <tr key={o.label} className="border-t border-gray-100">
                      <td className="max-w-[220px] truncate py-2 pr-3 text-sm text-gray-900" title={o.label}>{o.label}</td>
                      <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-gray-900">{o.visits}</td>
                      <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{o.started}</td>
                      <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{o.submitted}</td>
                      <td className={cn('py-2 pl-2 text-right text-sm tabular-nums', o.scheduled ? 'font-medium text-emerald-700' : 'text-gray-400')}>{o.scheduled || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{originKey === 'campaign' ? 'Nenhuma visita com nome de campanha no link.' : 'Sem visitas neste período.'}</p>
          )}
        </Surface>
      </div>

      <FormsMap visits={list} live={live} formName={formName} meta={metaState.status === 'ready' ? metaState.meta : undefined} title="Mapa: de onde abrem os formulários" />

      <CampaignsSpend forms={list} metaState={metaState} formsOnly />

      <Surface title="Últimas visitas aos formulários" action={<span className="text-xs text-gray-400">clique para ver a visita</span>}>
        <ul className="divide-y divide-gray-100">
          {recent.map((v) => {
            const f = forms.forms.get(v.formId)
            const place = [v.city, v.region || v.regionName].filter(Boolean).join(', ')
            return (
              <li key={v.id}>
                <button type="button" onClick={() => onOpenVisit(v)} className="-mx-2 flex w-[calc(100%+16px)] items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', v.scheduled ? 'bg-emerald-500' : v.submitted ? 'bg-violet-500' : 'bg-zinc-300')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {f?.live?.name || f?.name || 'Formulário'} · {f ? formPlace(f.live?.definition ?? f.definition, v) : v.screen}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {[[v.channel || 'Direto', v.campaign].filter(Boolean).join(' · '), place, v.device, formWhere(v)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-gray-500">
                  <span className="block">{whenLabel(v.startedAt)}</span>
                  <span className="block tabular-nums">{duration(v.activeMs)}</span>
                </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Surface>
    </div>
  )
}
