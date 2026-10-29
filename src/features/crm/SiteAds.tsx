import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { campaignStatus, money, OBJECTIVE_LABEL } from './ads'
import { compact, percent } from './instagram'
import { duration, loadReportRange, type SessionFilter, type SiteReport, type SiteSession } from './site'
import {
  adKeyOfSession,
  arrivalOf,
  audienceOf,
  avgActive,
  crossCampaigns,
  crossTotals,
  matchAd,
  matchCampaign,
  NO_CAMPAIGN_NAME as NO_NAME,
  perOf,
  placementLabel,
  platformLabel,
  profileLine,
  type AudienceProfile,
  type CrossNumbers,
  type MetaState,
  type MetaView,
} from './siteMeta'
import { Surface, plural, whenLabel } from './ui'
import { cn } from '@/lib/utils'

/**
 * O site cruzado com os anúncios da Meta: por campanha e por anúncio, o que a
 * Meta conta (valor usado, cliques no link) ao lado do que o site conta
 * (visitas que chegaram, tempo, contatos, leads qualificados), o custo de
 * cada visita, contato e lead qualificado, e o perfil de quem clica (idade,
 * gênero, estado, plataforma) que a Meta dá por campanha. A visita acha a
 * campanha pelo link do anúncio (os parâmetros de URL).
 */

/** Os parâmetros de URL que ligam cada visita ao anúncio (Meta › anúncio › Rastreamento › Parâmetros de URL) */
export const META_URL_PARAMS =
  'utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&utm_id={{campaign.id}}&ad_id={{ad.id}}&placement={{placement}}'

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success('Parâmetros copiados'),
    () => toast.error('Não deu para copiar')
  )

const day = (iso: string | null) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '')

/** De meia-noite do primeiro dia à meia-noite depois do último (no fuso de quem abre) */
function rangeOf(meta: MetaView) {
  if (!meta.since || !meta.until) return undefined
  const [y0, m0, d0] = meta.since.split('-').map(Number)
  const [y1, m1, d1] = meta.until.split('-').map(Number)
  return { from: new Date(y0, m0 - 1, d0), to: new Date(y1, m1 - 1, d1 + 1) }
}

// ---------- perfil de quem clica ----------

const Bars: React.FC<{ rows: { key: string; label: string; share: number }[]; max?: number }> = ({ rows, max = 6 }) => {
  const top = Math.max(...rows.map((r) => r.share), 0.0001)
  return (
    <ul className="grid gap-1">
      {rows.slice(0, max).map((r) => (
        <li key={r.key} className="grid grid-cols-[116px_minmax(0,1fr)_36px] items-center gap-2 text-xs">
          <span className="truncate text-gray-600">{r.label}</span>
          <span className="h-1.5 rounded-r bg-gray-100" aria-hidden>
            <span className="block h-1.5 rounded-r bg-blue-600" style={{ width: `${Math.max(3, (r.share / top) * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums text-gray-900">{Math.round(r.share * 100)}%</span>
        </li>
      ))}
    </ul>
  )
}

export const AudienceBlock: React.FC<{ profile: AudienceProfile; compactView?: boolean }> = ({ profile, compactView }) => (
  <div className="grid gap-3">
    <p className="text-xs text-gray-500">
      {profile.basis === 'linkClicks' ? `Pelos ${compact(profile.total)} cliques no link` : `Pelas ${compact(profile.total)} impressões (poucos cliques para dividir)`}, segundo a Meta.
    </p>
    <div className={cn('grid gap-4', !compactView && 'sm:grid-cols-2')}>
      <div>
        <h5 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Gênero</h5>
        <Bars rows={profile.gender} />
        <h5 className="mb-1.5 mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Idade</h5>
        <Bars rows={profile.ages} max={7} />
      </div>
      <div>
        {profile.regions.length > 0 && (
          <>
            <h5 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Estado</h5>
            <Bars rows={profile.regions} max={5} />
          </>
        )}
        {profile.platforms.length > 0 && (
          <>
            <h5 className="mb-1.5 mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Onde viu</h5>
            <Bars rows={profile.platforms} max={4} />
          </>
        )}
      </div>
    </div>
  </div>
)

// ---------- o anúncio de uma visita ----------

/** No painel de uma visita: a campanha e o anúncio de onde ela veio e o perfil de quem clica neles. */
export const SessionAd: React.FC<{ session: SiteSession; meta?: MetaView }> = ({ session, meta }) => {
  const key = adKeyOfSession(session)
  const campaign = meta ? matchCampaign(meta, key) : undefined
  const creative = meta ? matchAd(meta, key, campaign) : undefined
  const profile = meta && campaign ? audienceOf(meta, [campaign.id]) : undefined
  const fromAd = session.channel === 'Meta Ads' || !!campaign
  if (!fromAd) return null
  const d = session.details
  const currency = campaign?.currency ?? meta?.currency ?? 'BRL'
  return (
    <div className="rounded-lg p-3 ring-1 ring-inset ring-blue-600/15">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Veio de um anúncio da Meta</h3>
      <div className="flex gap-3">
        {creative?.thumbnail && <img src={creative.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" loading="lazy" />}
        <dl className="grid min-w-0 flex-1 gap-1 text-sm">
          <div className="min-w-0">
            <dt className="sr-only">Campanha</dt>
            <dd className="truncate font-medium text-gray-900" title={campaign?.name ?? session.campaign}>
              {campaign?.name ?? session.campaign ?? 'Campanha sem nome no link'}
            </dd>
            {campaign && (
              <dd className="text-xs text-gray-500">
                {[campaignStatus(campaign.status).label, campaign.objective && (OBJECTIVE_LABEL[campaign.objective] ?? campaign.objective), `${money(campaign.metrics.spend, currency, true)} no período`].filter(Boolean).join(' · ')}
              </dd>
            )}
          </div>
          {(creative || session.content) && (
            <div className="min-w-0 text-xs text-gray-600">
              <dt className="inline text-gray-400">Anúncio </dt>
              <dd className="inline">{creative?.name ?? session.content}</dd>
            </div>
          )}
          {session.term && (
            <div className="min-w-0 text-xs text-gray-600">
              <dt className="inline text-gray-400">Conjunto </dt>
              <dd className="inline">{session.term}</dd>
            </div>
          )}
          {(d.placement || d.siteSource) && (
            <div className="text-xs text-gray-600">
              <dt className="inline text-gray-400">Onde viu </dt>
              <dd className="inline">{d.placement ? placementLabel(d.placement) : platformLabel(d.siteSource === 'ig' ? 'instagram' : d.siteSource === 'fb' ? 'facebook' : (d.siteSource ?? ''))}</dd>
            </div>
          )}
        </dl>
      </div>
      {(creative?.previewLink || creative?.permalink) && (
        <a href={creative.permalink ?? creative.previewLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
          Ver o anúncio <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {profile ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-2 text-sm text-gray-800">
            <span className="font-medium">Perfil provável:</span> {profileLine(profile)}
          </p>
          <AudienceBlock profile={profile} compactView />
          <p className="mt-2 text-[11px] text-gray-400">A Meta não diz quem clicou: é o perfil de quem clica nesta campanha, não a idade desta pessoa.</p>
        </div>
      ) : (
        !campaign && (
          <p className="mt-2 text-xs text-gray-500">
            {meta ? 'A campanha do link não está no relatório da Meta deste período.' : 'Conecte a conta de anúncios (Instagram › Anúncios) para ver a campanha e quem clica nela.'}
          </p>
        )
      )}
    </div>
  )
}

// ---------- Meta × site ----------

const Tile: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="min-w-0 rounded-lg bg-zinc-50 p-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
    {sub && <p className="text-xs text-gray-500">{sub}</p>}
  </div>
)

const cost = (n: CrossNumbers, count: number, currency: string) => {
  const value = perOf(n.metrics?.spend, count)
  return value === undefined ? '—' : money(value, currency)
}

const Cells: React.FC<{ n: CrossNumbers; currency: string; strong?: boolean }> = ({ n, currency, strong }) => {
  const arrival = arrivalOf(n)
  const active = avgActive(n)
  const td = 'px-3 py-2 text-right text-sm tabular-nums'
  return (
    <>
      <td className={cn(td, strong ? 'font-medium text-gray-900' : 'text-gray-700')}>{n.metrics ? money(n.metrics.spend, currency) : '—'}</td>
      <td className={cn(td, 'text-gray-700')}>{n.metrics ? compact(n.metrics.linkClicks) : '—'}</td>
      <td className={cn(td, 'font-medium text-gray-900')}>
        {compact(n.sessions)}
        {arrival !== undefined && <span className="ml-1 text-xs font-normal text-gray-400" title="Visitas por clique no link">{arrival > 1 ? '>100%' : percent(arrival, 0)}</span>}
      </td>
      <td className={cn(td, 'text-gray-700')}>{active !== undefined ? duration(active) : '—'}</td>
      <td className={cn(td, n.converted ? 'font-medium text-emerald-700' : 'text-gray-400')}>{n.converted || '—'}</td>
      <td className={cn(td, n.qualified ? 'font-medium text-emerald-700' : 'text-gray-400')}>
        {n.qualified || n.unqualified ? (
          <>
            {n.qualified}
            {n.unqualified > 0 && <span className="ml-1 text-xs font-normal text-gray-400">+{n.unqualified} não</span>}
          </>
        ) : (
          '—'
        )}
      </td>
      <td className={cn(td, 'pr-0 text-gray-700')}>{cost(n, n.qualified || n.converted, currency)}</td>
    </>
  )
}

export const MetaCross: React.FC<{
  siteId: string
  state: MetaState
  onRefresh: () => void
  onVisits: (filter: Partial<SessionFilter>) => void
}> = ({ siteId, state, onRefresh, onVisits }) => {
  const meta = state.status === 'ready' ? state.meta : undefined
  const range = meta ? rangeOf(meta) : undefined
  const [report, setReport] = useState<SiteReport | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [showParams, setShowParams] = useState(false)

  useEffect(() => {
    if (!range) return setReport(null)
    let alive = true
    loadReportRange(siteId, range.from, range.to)
      .then((r) => alive && setReport(r))
      .catch(() => alive && setReport(null))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, range?.from.getTime(), range?.to.getTime(), meta?.fetchedAt])

  const rows = useMemo(() => (meta && report ? crossCampaigns(meta, report.ads) : []), [meta, report])
  const totals = useMemo(() => crossTotals(rows), [rows])
  const currency = meta?.currency ?? 'BRL'

  if (state.status === 'none') return null

  const unmatched = rows.filter((r) => !r.campaign && r.sessions > 0)
  const header = (
    <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      {meta && (
        <span>
          Meta de {day(meta.since)} a {day(meta.until)} · lida {whenLabel(meta.fetchedAt)}
        </span>
      )}
      {state.status === 'ready' && (
        <button type="button" onClick={onRefresh} disabled={state.refreshing} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60" title="Ler a Meta de novo">
          <RefreshCw className={cn('h-3.5 w-3.5', state.refreshing && 'animate-spin')} />
        </button>
      )}
      <Link to="/crm/anuncios" className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
        Anúncios <ExternalLink className="h-3 w-3" />
      </Link>
    </span>
  )

  return (
    <Surface title="Anúncios da Meta × site" action={header}>
      {state.status === 'loading' || (meta && !report) ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Juntando os anúncios com as visitas…
        </p>
      ) : state.status === 'error' ? (
        <p className="text-sm text-rose-700">{state.error}</p>
      ) : report && !report.mapReady ? (
        <p className="text-sm text-gray-500">Para juntar as visitas com as campanhas, falta aplicar a migração 20261025230000_site_visitas_mapa.sql no Supabase.</p>
      ) : !rows.length ? (
        <p className="text-sm text-gray-500">Nenhuma campanha gastou nem mandou visitas neste período.</p>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Valor usado" value={money(totals.metrics?.spend, currency)} />
            <Tile label="Cliques no link" value={compact(totals.metrics?.linkClicks ?? 0)} sub="pela Meta" />
            <Tile
              label="Chegaram ao site"
              value={compact(totals.sessions)}
              sub={arrivalOf(totals) !== undefined ? `${arrivalOf(totals)! > 1 ? 'mais que os cliques' : `${percent(arrivalOf(totals), 0)} dos cliques`} · ${cost(totals, totals.sessions, currency)} cada` : undefined}
            />
            <Tile label="Tempo médio" value={avgActive(totals) !== undefined ? duration(avgActive(totals)) : '—'} sub={totals.sessions ? `${percent(totals.bounces / totals.sessions, 0)} saíram sem interagir` : undefined} />
            <Tile label="Contatos" value={compact(totals.converted)} sub={totals.converted ? `${cost(totals, totals.converted, currency)} por contato` : undefined} />
            <Tile
              label="Leads qualificados"
              value={compact(totals.qualified)}
              sub={totals.qualified ? `${cost(totals, totals.qualified, currency)} cada` : totals.unqualified ? `${totals.unqualified} não qualificados` : 'pelo formulário da Proposta'}
            />
          </div>

          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-3 font-medium">Campanha</th>
                  <th className="px-3 pb-2 text-right font-medium">Valor usado</th>
                  <th className="px-3 pb-2 text-right font-medium">Cliques no link</th>
                  <th className="px-3 pb-2 text-right font-medium">Visitas</th>
                  <th className="px-3 pb-2 text-right font-medium">Tempo médio</th>
                  <th className="px-3 pb-2 text-right font-medium">Contatos</th>
                  <th className="px-3 pb-2 text-right font-medium">Qualificados</th>
                  <th className="pb-2 pl-3 text-right font-medium">Custo por lead</th>
                </tr>
              </thead>
                {rows.map((row) => {
                  const expanded = open === row.key
                  const status = row.campaign ? campaignStatus(row.campaign.status) : undefined
                  const profile = meta && row.campaign ? audienceOf(meta, [row.campaign.id]) : undefined
                  return (
                    <tbody key={row.key}>
                      <tr className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-zinc-50" onClick={() => setOpen(expanded ? null : row.key)}>
                        <td className="py-2 pr-3">
                          <button type="button" aria-expanded={expanded} className="flex max-w-[320px] items-start gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform', expanded && 'rotate-180')} aria-hidden />
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-gray-900" title={row.name}>
                                {row.name}
                              </span>
                              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                {status ? (
                                  <>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', status.live ? 'bg-emerald-500' : status.warn ? 'bg-amber-500' : 'bg-gray-300')} aria-hidden />
                                    {status.label}
                                    {row.campaign?.objective && ` · ${OBJECTIVE_LABEL[row.campaign.objective] ?? row.campaign.objective}`}
                                  </>
                                ) : (
                                  'Nome do link, sem campanha da Meta neste período'
                                )}
                              </span>
                            </span>
                          </button>
                        </td>
                        <Cells n={row} currency={currency} strong />
                      </tr>
                      {expanded &&
                        row.ads.map((ad) => (
                          <tr key={ad.key} className="bg-zinc-50/70">
                            <td className="py-2 pl-6 pr-3">
                              <span className="flex items-center gap-2">
                                {ad.creative?.thumbnail && <img src={ad.creative.thumbnail} alt="" className="h-8 w-8 shrink-0 rounded object-cover" loading="lazy" />}
                                <span className="min-w-0">
                                  <span className="block max-w-[260px] truncate text-sm text-gray-800" title={ad.name}>
                                    {ad.name}
                                  </span>
                                  {ad.adset && (
                                    <span className="block max-w-[260px] truncate text-xs text-gray-400" title={ad.adset}>
                                      {ad.adset}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </td>
                            <Cells n={ad} currency={currency} />
                          </tr>
                        ))}
                      {expanded && (
                        <tr className="bg-zinc-50/70">
                          <td colSpan={8} className="px-3 pb-4 pt-3">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                              <div className="min-w-0 max-w-2xl">
                                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Quem clica nesta campanha</h4>
                                {profile ? <AudienceBlock profile={profile} /> : <p className="text-sm text-gray-500">A Meta não mandou idade e gênero desta campanha.</p>}
                              </div>
                              {row.sessions > 0 && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => onVisits(row.campaign ? { campaign: row.campaign.name } : row.name === NO_NAME ? { channel: 'Meta Ads' } : { campaign: row.name })}
                                    className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                                  >
                                    Ver as {plural(row.sessions, 'visita', 'visitas')}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  )
                })}
            </table>
          </div>

          <div className="grid gap-1 text-[11px] text-gray-400">
            <p>
              Visitas: quem abriu o site vindo do anúncio (a porcentagem é sobre os cliques no link; o resto fechou antes de a página abrir ou bloqueia a contagem). Qualificados: o filtro do formulário da Proposta. Custo por lead:
              por lead qualificado, ou por contato quando não há qualificado.
            </p>
            {unmatched.length > 0 && <p>{plural(unmatched.length, 'campanha do link não está', 'campanhas do link não estão')} no relatório da Meta deste período.</p>}
            <button type="button" onClick={() => setShowParams((v) => !v)} className="w-fit font-medium text-gray-500 hover:text-gray-900">
              {showParams ? 'Fechar' : 'Como ligar cada visita ao anúncio'}
            </button>
          </div>
          {showParams && (
            <div className="rounded-lg bg-zinc-50 p-3 text-xs text-gray-600">
              <p>
                No Gerenciador de Anúncios, em cada anúncio › Rastreamento › Parâmetros de URL. Os nomes ligam a visita à campanha, ao conjunto e ao anúncio; os ids continuam ligando se alguém renomear; o placement diz se foi
                Stories, Feed ou Reels.
              </p>
              <button type="button" onClick={() => void copy(META_URL_PARAMS)} className="mt-2 flex w-full items-start gap-2 rounded-md bg-white p-2 text-left font-mono text-[11px] text-gray-800 ring-1 ring-inset ring-gray-200 hover:bg-gray-50">
                <span className="min-w-0 flex-1 break-all">{META_URL_PARAMS}</span>
                <Copy className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
    </Surface>
  )
}
