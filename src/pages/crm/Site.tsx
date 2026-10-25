import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ExternalLink, Globe, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { BarList, Sparkline, Stat, TrendChart } from '@/features/crm/InstagramCharts'
import { compact, percent } from '@/features/crm/instagram'
import { useCrm } from '@/features/crm/crmStore'
import { ServerSteps, SiteSetup, SiteStart } from '@/features/crm/SiteSetup'
import { VisitsList } from '@/features/crm/SiteVisits'
import {
  CONTACT_EVENTS,
  NoSiteTablesError,
  PERIOD_LABEL,
  SITE_PERIODS,
  contactLabel,
  countLive,
  countryLabel,
  dailySeries,
  duration,
  eventLabel,
  loadReport,
  loadTrackers,
  pathLabel,
  shareOf,
  tzLabel,
  type Cut,
  type SessionFilter,
  type SitePeriod,
  type SiteReport,
  type SiteTotals,
  type SiteTracker,
} from '@/features/crm/site'
import { FIELD, Page, Surface, whenLabel } from '@/features/crm/ui'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

/**
 * Site (CRM › Site): as visitas do site da equipe, contadas por um script
 * próprio colado uma vez no WordPress (sem Google Analytics). Visão geral
 * com visitantes, visitas, contatos (WhatsApp, ligação, e-mail, formulário),
 * tempo em uso, rejeição, visitas por dia, de onde vêm, o que fizeram, os
 * botões mais clicados, as páginas, aparelhos, lugares e horários; a aba
 * Visitas mostra cada visita com a jornada inteira; Instalação tem o código
 * e os passos. Quem está no site agora aparece no topo e se atualiza sozinho.
 */

type Tab = 'geral' | 'visitas' | 'instalacao'
type Metric = 'visitors' | 'sessions' | 'pageviews' | 'converted'

const METRIC_LABEL: Record<Metric, { chip: string; unit: string; title: string; hint: string }> = {
  visitors: { chip: 'Visitantes', unit: 'visitantes', title: 'Visitantes por dia', hint: 'Pessoas diferentes (cada navegador conta uma vez por dia)' },
  sessions: { chip: 'Visitas', unit: 'visitas', title: 'Visitas por dia', hint: 'Uma visita acaba depois de 30 minutos parada' },
  pageviews: { chip: 'Páginas vistas', unit: 'páginas', title: 'Páginas vistas por dia', hint: 'Todas as páginas abertas nas visitas do dia' },
  converted: { chip: 'Contatos', unit: 'visitas com contato', title: 'Contatos por dia', hint: 'Visitas que chamaram no WhatsApp, ligaram, mandaram e-mail ou o formulário' },
}

const REFRESH_MS = 2 * 60_000
const LIVE_POLL_MS = 20_000
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const visible = () => document.visibilityState === 'visible'

// ---------- peças ----------

/** A mudança contra o período anterior, do mesmo tamanho. `lowerIsBetter` para a rejeição. */
const Delta: React.FC<{ now: number; before: number; lowerIsBetter?: boolean; dark?: boolean }> = ({ now, before, lowerIsBetter, dark }) => {
  if (!before) return null
  const change = (now - before) / before
  if (Math.abs(change) < 0.005) return <span className={dark ? 'text-zinc-400' : 'text-gray-400'}>igual ao período anterior</span>
  const up = change > 0
  const good = lowerIsBetter ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium', good ? (dark ? 'text-emerald-300' : 'text-emerald-700') : dark ? 'text-rose-300' : 'text-rose-700')} title="Contra o período anterior, do mesmo tamanho">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {percent(Math.abs(change), 0)}
    </span>
  )
}

const bounceRate = (t: SiteTotals) => shareOf(t.bounces, t.sessions)
const contactRate = (t: SiteTotals) => shareOf(t.converted, t.sessions)

/** Uma linha por item, com barra; cada linha pode abrir as visitas daquele item. */
const RankList: React.FC<{ rows: { key: string; label: string; value: number; note?: string; onClick?: () => void }[]; format?: (n: number) => string; empty: string }> = ({
  rows,
  format = compact,
  empty,
}) => {
  if (!rows.length) return <p className="text-sm text-gray-500">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="grid gap-0.5">
      {rows.map((row) => {
        const body = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-gray-700">
                {row.label}
                {row.note && <span className="ml-1.5 text-xs text-gray-400">{row.note}</span>}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-gray-900">{format(row.value)}</span>
            </div>
            <div className="h-2 rounded-r bg-gray-100" aria-hidden>
              <div className="h-2 rounded-r bg-gray-900" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
            </div>
          </>
        )
        return (
          <li key={row.key}>
            {row.onClick ? (
              <button type="button" onClick={row.onClick} className="-mx-2 block w-[calc(100%+16px)] rounded-lg px-2 py-1 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {body}
              </button>
            ) : (
              <div className="py-1">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Partes com troca por botões (Aparelho | Navegador | Sistema), em porcentagem das visitas. */
const CutCard: React.FC<{ title: string; cuts: { key: string; label: string; rows: Cut[]; name?: (key: string) => string }[]; total: number }> = ({ title, cuts, total }) => {
  const available = cuts.filter((c) => c.rows.length)
  const [current, setCurrent] = useState(available[0]?.key)
  const cut = available.find((c) => c.key === current) ?? available[0]
  return (
    <Surface title={title}>
      {cut ? (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {available.map((c) => (
              <Chip key={c.key} active={c.key === cut.key} onClick={() => setCurrent(c.key)} className="h-7 px-2.5 text-xs">
                {c.label}
              </Chip>
            ))}
          </div>
          <BarList rows={cut.rows.slice(0, 7).map((r) => ({ label: cut.name ? cut.name(r.key) : r.key || 'Não identificado', value: r.sessions }))} format={(n) => percent(shareOf(n, total), 0)} />
        </>
      ) : (
        <p className="text-sm text-gray-500">Sem visitas neste período.</p>
      )}
    </Surface>
  )
}

/** Visitas por dia da semana e hora: quando o site é visitado. */
const Hours: React.FC<{ hours: SiteReport['hours'] }> = ({ hours }) => {
  const grid = useMemo(() => {
    const cells = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
    for (const h of hours) if (h.dow >= 1 && h.dow <= 7 && h.hour >= 0 && h.hour < 24) cells[h.dow - 1][h.hour] += h.sessions
    return cells
  }, [hours])
  const max = Math.max(1, ...grid.flat())
  const peak = hours.length ? hours.reduce((a, b) => (b.sessions > a.sessions ? b : a)) : undefined
  return (
    <Surface title="Quando visitam" action={peak && <span className="text-xs text-gray-500">mais visitas: {WEEKDAYS[peak.dow - 1].toLowerCase()} às {peak.hour}h</span>}>
      {hours.length ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="grid min-w-[560px] grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[3px]" role="img" aria-label={peak ? `Visitas por dia da semana e hora. Mais visitas ${WEEKDAYS[peak.dow - 1]} às ${peak.hour}h.` : 'Visitas por dia da semana e hora'}>
            {grid.map((row, d) => (
              <div key={d} className="contents">
                <span className="pr-1 text-right text-[11px] leading-5 text-gray-500">{WEEKDAYS[d]}</span>
                {row.map((n, h) => (
                  <span
                    key={h}
                    title={`${WEEKDAYS[d]}, ${h}h: ${n} ${n === 1 ? 'visita' : 'visitas'}`}
                    className="h-5 rounded-[3px]"
                    style={{ background: n ? `rgba(24,24,27,${0.12 + 0.88 * (n / max)})` : '#f4f4f5' }}
                  />
                ))}
              </div>
            ))}
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center text-[10px] text-gray-400">
                {h % 3 === 0 ? `${h}h` : ''}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Sem visitas neste período.</p>
      )}
    </Surface>
  )
}

// ---------- visão geral ----------

const Overview: React.FC<{ report: SiteReport; period: SitePeriod; tracker: SiteTracker; onVisits: (filter: Partial<SessionFilter>) => void; onSetup: () => void }> = ({
  report,
  period,
  tracker,
  onVisits,
  onSetup,
}) => {
  const [metric, setMetric] = useState<Metric>('visitors')
  const t = report.totals
  const p = report.previous
  const today = period === 'hoje'
  const label = PERIOD_LABEL[period].toLowerCase()

  const series = useMemo(() => dailySeries(report, period, (d) => d[metric]), [report, period, metric])
  const visitorsLine = useMemo(() => dailySeries(report, period, (d) => d.visitors).map((d) => d.value), [report, period])
  const hourly = useMemo(() => {
    const now = new Date().getHours()
    const counts = Array<number>(24).fill(0)
    for (const h of report.hours) counts[h.hour] += h.sessions
    return counts.slice(0, now + 1).map((value, hour) => ({ day: String(hour), value }))
  }, [report.hours])

  const contacts = report.events.filter((e) => CONTACT_EVENTS.includes(e.name))
  const otherEvents = report.events.filter((e) => !CONTACT_EVENTS.includes(e.name))
  const topClicks = report.clicks.filter((c) => c.name !== 'formulario_inicio').slice(0, 10)

  const pages = useMemo(() => {
    const entries = new Map(report.landings.map((l) => [l.path, l]))
    const converts = new Map(report.conversionPages.map((c) => [c.path, c]))
    return report.pages.map((page) => ({ ...page, entries: entries.get(page.path)?.sessions ?? 0, contacts: converts.get(page.path)?.sessions ?? 0 }))
  }, [report])

  if (t.sessions === 0 && !p.sessions)
    return (
      <Surface className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-gray-900">{tracker.lastSeenAt ? `Nenhuma visita ${today ? 'hoje' : `nos últimos ${label}`}.` : 'Nenhuma visita ainda.'}</p>
        <p className="mt-1 text-sm text-gray-500">
          {tracker.lastSeenAt ? `O último sinal do site foi ${whenLabel(tracker.lastSeenAt)}.` : 'Os números aparecem aqui assim que o código estiver no site e alguém visitar.'}
        </p>
        {!tracker.lastSeenAt && (
          <Button size="sm" variant="outline" onClick={onSetup} className="mt-4">
            Ver a instalação
          </Button>
        )}
      </Surface>
    )

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          dark
          label="Visitantes"
          value={compact(t.visitors)}
          sub={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>{compact(t.newVisitors)} pela primeira vez</span>
              <Delta now={t.visitors} before={p.visitors} dark />
            </span>
          }
        >
          {!today && visitorsLine.length > 1 && <Sparkline values={visitorsLine} color="#fafafa" className="mt-2 h-8 w-full" />}
        </Stat>
        <Stat
          label="Visitas"
          value={compact(t.sessions)}
          sub={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>{t.sessions ? (t.pageviews / t.sessions).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0} páginas por visita</span>
              <Delta now={t.sessions} before={p.sessions} />
            </span>
          }
        />
        <Stat
          label="Contatos"
          value={compact(t.converted)}
          sub={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>{percent(contactRate(t))} das visitas</span>
              <Delta now={t.converted} before={p.converted} />
            </span>
          }
        />
        <Stat
          label="Tempo médio"
          value={duration(t.activeMs)}
          sub={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>em uso, por visita</span>
              <Delta now={t.activeMs} before={p.activeMs} />
            </span>
          }
        />
        <Stat
          label="Rejeição"
          value={percent(bounceRate(t), 0)}
          sub={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>saíram sem interagir</span>
              {p.sessions > 0 && <Delta now={bounceRate(t)} before={bounceRate(p)} lowerIsBetter />}
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl bg-zinc-900 p-4 text-white md:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{today ? 'Visitas por hora' : METRIC_LABEL[metric].title}</h2>
              <p className="text-xs text-zinc-400">{today ? 'Hoje, no seu fuso' : METRIC_LABEL[metric].hint}</p>
            </div>
            {!today && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Métrica do gráfico">
                {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={metric === m}
                    onClick={() => setMetric(m)}
                    className={cn('h-7 rounded-full px-2.5 text-xs font-medium transition-colors', metric === m ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:bg-white/10 hover:text-white')}
                  >
                    {METRIC_LABEL[m].chip}
                  </button>
                ))}
              </div>
            )}
          </div>
          {today ? (
            <TrendChart points={hourly} unit="visitas" label="Visitas por hora hoje" tone="dark" height={260} short={(h) => `${h}h`} long={(h) => `Das ${h}h às ${h}h59`} />
          ) : (
            <TrendChart points={series} unit={METRIC_LABEL[metric].unit} label={`${METRIC_LABEL[metric].title} nos últimos ${label}`} tone="dark" height={260} />
          )}
        </section>
        <Surface title="De onde vêm" action={<span className="text-xs text-gray-400">visitas</span>}>
          <RankList
            empty="Sem visitas neste período."
            rows={report.channels.map((c) => ({
              key: c.channel,
              label: c.channel,
              value: c.sessions,
              note: c.converted ? `${c.converted} ${c.converted === 1 ? 'contato' : 'contatos'}` : undefined,
              onClick: () => onVisits({ channel: c.channel }),
            }))}
          />
        </Surface>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Surface title="Contatos" action={t.converted > 0 && <button type="button" onClick={() => onVisits({ converted: true })} className="text-xs font-medium text-gray-600 hover:text-gray-900">Ver as visitas</button>}>
          {contacts.length ? (
            <ul className="grid gap-2">
              {contacts.map((e) => (
                <li key={e.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-gray-700">{contactLabel(e.name)}</span>
                  <span className="tabular-nums text-gray-900">
                    <span className="font-medium">{compact(e.sessions)}</span> <span className="text-xs text-gray-500">{e.sessions === 1 ? 'visita' : 'visitas'}</span>
                    {e.total > e.sessions && <span className="ml-1 text-xs text-gray-400">({compact(e.total)} cliques)</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Ninguém chamou no WhatsApp, ligou ou mandou o formulário neste período.</p>
          )}
          {report.events.find((e) => e.name === 'formulario_inicio') && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
              {(() => {
                const started = report.events.find((e) => e.name === 'formulario_inicio')?.sessions ?? 0
                const sent = report.events.find((e) => e.name === 'formulario')?.sessions ?? 0
                return `${started} ${started === 1 ? 'visita começou' : 'visitas começaram'} a preencher um formulário e ${sent} ${sent === 1 ? 'enviou' : 'enviaram'}.`
              })()}
            </p>
          )}
        </Surface>
        <Surface title="Botões e links mais clicados">
          {topClicks.length ? (
            <ul className="grid gap-2">
              {topClicks.map((c, i) => (
                <li key={`${c.name}-${c.label}-${c.section}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className={cn('block truncate', CONTACT_EVENTS.includes(c.name) ? 'font-medium text-emerald-800' : 'text-gray-800')}>{c.label || eventLabel(c.name)}</span>
                    <span className="block truncate text-xs text-gray-500">{[eventLabel(c.name), c.section].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-gray-900">{compact(c.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nenhum clique neste período.</p>
          )}
        </Surface>
        <Surface title="Outros eventos">
          {otherEvents.length ? (
            <ul className="grid gap-2">
              {otherEvents.slice(0, 12).map((e) => (
                <li key={e.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-gray-700">{eventLabel(e.name)}</span>
                  <span className="shrink-0 tabular-nums text-gray-900">
                    <span className="font-medium">{compact(e.total)}</span> <span className="text-xs text-gray-500">em {compact(e.sessions)} {e.sessions === 1 ? 'visita' : 'visitas'}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Sem outros eventos neste período.</p>
          )}
        </Surface>
      </div>

      <Surface title="Páginas">
        {pages.length ? (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-3 font-medium">Página</th>
                  <th className="px-3 pb-2 text-right font-medium">Vistas</th>
                  <th className="px-3 pb-2 text-right font-medium">Pessoas</th>
                  <th className="px-3 pb-2 text-right font-medium">Entradas</th>
                  <th className="px-3 pb-2 text-right font-medium">Tempo médio</th>
                  <th className="px-3 pb-2 text-right font-medium">Rolagem</th>
                  <th className="pb-2 pl-3 text-right font-medium">Contatos</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.path} className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-zinc-50" onClick={() => onVisits({ path: page.path })}>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onVisits({ path: page.path })
                        }}
                        className="block max-w-[340px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Ver as visitas que entraram ou saíram por aqui"
                      >
                        <span className="block truncate text-sm text-gray-900">{page.title || pathLabel(page.path)}</span>
                        <span className="block truncate text-xs text-gray-500">{pathLabel(page.path)}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium tabular-nums text-gray-900">{compact(page.views)}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-700">{compact(page.visitors)}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-700">{compact(page.entries)}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-700">{page.activeMs ? duration(page.activeMs) : '—'}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-700">{page.scroll ? `${page.scroll}%` : '—'}</td>
                    <td className={cn('py-2 pl-3 text-right text-sm tabular-nums', page.contacts ? 'font-medium text-emerald-700' : 'text-gray-400')}>{page.contacts || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-gray-400">Rolagem: até onde, em média, as pessoas desceram. Contatos: visitas que fizeram contato nesta página.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Sem páginas vistas neste período.</p>
        )}
      </Surface>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <CutCard
          title="Aparelhos"
          total={t.sessions}
          cuts={[
            { key: 'device', label: 'Aparelho', rows: report.devices },
            { key: 'browser', label: 'Navegador', rows: report.browsers },
            { key: 'os', label: 'Sistema', rows: report.os },
          ]}
        />
        <CutCard
          title="Onde estão"
          total={t.sessions}
          cuts={[
            { key: 'country', label: 'País', rows: report.countries, name: countryLabel },
            { key: 'tz', label: 'Fuso', rows: report.tzs, name: tzLabel },
            { key: 'lang', label: 'Idioma', rows: report.langs },
          ]}
        />
        <Surface title="Sites e campanhas">
          <RankList
            empty="Nenhuma visita veio de outro site ou de campanha com UTM neste período."
            rows={[
              ...report.campaigns.map((c) => ({ key: `c:${c.campaign}:${c.source}`, label: c.campaign, value: c.sessions, note: [c.source, c.medium].filter(Boolean).join(' / ') || c.channel, onClick: () => onVisits({ channel: c.channel }) })),
              ...report.sources
                .filter((s) => !report.campaigns.some((c) => c.source === s.source && c.channel === s.channel))
                .map((s) => ({ key: `s:${s.channel}:${s.source}`, label: s.source, value: s.sessions, note: s.channel, onClick: () => onVisits({ channel: s.channel }) })),
            ].slice(0, 10)}
          />
        </Surface>
      </div>

      <Hours hours={report.hours} />

      {report.notFound.length > 0 && (
        <Surface title="Páginas não encontradas (erro 404)">
          <ul className="grid gap-1.5">
            {report.notFound.map((n) => (
              <li key={n.path} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-mono text-xs text-gray-700">{n.path}</span>
                <span className="shrink-0 tabular-nums text-gray-900">{compact(n.views)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-gray-400">Alguém chegou num endereço que não existe: vale um redirecionamento para a página certa.</p>
        </Surface>
      )}
    </div>
  )
}

// ---------- painel ----------

const Dashboard: React.FC<{ tracker: SiteTracker; trackers: SiteTracker[]; manager: boolean; onSelect: (id: string) => void; onReload: () => Promise<void> }> = ({
  tracker,
  trackers,
  manager,
  onSelect,
  onReload,
}) => {
  const [params, setParams] = useSearchParams()
  const tab = (['geral', 'visitas', 'instalacao'].includes(params.get('aba') ?? '') ? params.get('aba') : tracker.lastSeenAt ? 'geral' : 'instalacao') as Tab
  const [period, setPeriod] = useState<SitePeriod>(7)
  const [report, setReport] = useState<SiteReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [live, setLive] = useState<number | null>(null)
  const [visitsFilter, setVisitsFilter] = useState<Partial<SessionFilter>>({})

  const setTab = useCallback(
    (next: Tab) =>
      setParams(
        (current) => {
          const p = new URLSearchParams(current)
          p.set('aba', next)
          return p
        },
        { replace: true }
      ),
    [setParams]
  )

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        setReport(await loadReport(tracker.id, period))
      } catch (e) {
        if (!quiet) toast.error(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [tracker.id, period]
  )

  useEffect(() => {
    setReport(null)
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => visible() && void load(true), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    let stop = false
    const poll = () => {
      if (!visible()) return
      countLive(tracker.id)
        .then((n) => !stop && setLive(n))
        .catch(() => undefined)
    }
    poll()
    const timer = window.setInterval(poll, LIVE_POLL_MS)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [tracker.id])

  const openVisits = (filter: Partial<SessionFilter>) => {
    setVisitsFilter(filter)
    setTab('visitas')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <Globe className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Site</h1>
            {trackers.length > 1 && (
              <select value={tracker.id} onChange={(e) => onSelect(e.target.value)} className={cn(FIELD, 'h-8 w-auto py-0 text-xs')} aria-label="Site">
                {trackers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 truncate text-sm text-gray-500">
            <a href={`https://${tracker.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-gray-700 hover:underline">
              {tracker.domain} <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <span>· {tracker.lastSeenAt ? `último sinal ${whenLabel(tracker.lastSeenAt)}` : 'nenhum sinal do site ainda'}</span>
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {live !== null && (
            <button
              type="button"
              onClick={() => openVisits({ live: true })}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset transition-colors',
                live > 0 ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 hover:bg-emerald-100' : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
              )}
              title="Quem teve atividade nos últimos 5 minutos"
            >
              <span aria-hidden className={cn('h-2 w-2 rounded-full', live > 0 ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-gray-300')} />
              {live === 0 ? 'Ninguém no site agora' : `${live} no site agora`}
            </button>
          )}
          <Button variant="outline" size="sm" onClick={() => void Promise.all([load(), onReload()])} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Atualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={tab === 'geral'} onClick={() => setTab('geral')}>
          Visão geral
        </Chip>
        <Chip
          active={tab === 'visitas'}
          onClick={() => {
            setVisitsFilter({})
            setTab('visitas')
          }}
        >
          Visitas {report && <span className="tabular-nums opacity-60">{compact(report.totals.sessions)}</span>}
        </Chip>
        <Chip active={tab === 'instalacao'} onClick={() => setTab('instalacao')}>
          Instalação
        </Chip>
        {tab !== 'instalacao' && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200" role="group" aria-label="Período">
            {SITE_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={cn('h-7 rounded-full px-3 text-xs font-medium transition-colors', period === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900')}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'instalacao' ? (
        <SiteSetup tracker={tracker} manager={manager} onReload={onReload} />
      ) : tab === 'visitas' ? (
        <VisitsList
          siteId={tracker.id}
          period={period}
          channels={report?.channels.map((c) => c.channel) ?? []}
          manager={manager}
          initial={visitsFilter}
          onFilterChange={setVisitsFilter}
        />
      ) : !report ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo as visitas…
        </p>
      ) : (
        <div className={cn('transition-opacity', loading && 'opacity-70')}>
          <Overview report={report} period={period} tracker={tracker} onVisits={openVisits} onSetup={() => setTab('instalacao')} />
        </div>
      )}
    </div>
  )
}

// ---------- tela ----------

const SitePage: React.FC = () => {
  const { team } = useCrm()
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [trackers, setTrackers] = useState<SiteTracker[] | null>(null)
  const [error, setError] = useState<'sem-tabelas' | string | null>(null)
  const [selected, setSelected] = useState<string>()

  const reload = useCallback(async () => {
    if (!team) return
    try {
      setTrackers(await loadTrackers(team.id))
      setError(null)
    } catch (e) {
      setError(e instanceof NoSiteTablesError ? 'sem-tabelas' : e instanceof Error ? e.message : String(e))
      setTrackers([])
    }
  }, [team])

  useEffect(() => {
    setTrackers(null)
    void reload()
  }, [reload])

  const tracker = trackers?.find((t) => t.id === selected) ?? trackers?.[0]

  return (
    <Page wide>
      {!team || trackers === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo as visitas do site…
        </p>
      ) : error === 'sem-tabelas' ? (
        <Surface className="mx-auto max-w-2xl">
          <h1 className="text-lg font-semibold text-gray-900">Falta preparar o Supabase</h1>
          <p className="mt-1 text-sm text-gray-600">As tabelas das visitas do site ainda não existem. Uma vez só:</p>
          <ServerSteps className="mt-4" />
          <p className="mt-4 text-sm text-gray-600">Depois abra esta tela de novo para cadastrar o site e pegar o código do WordPress.</p>
        </Surface>
      ) : error ? (
        <Surface className="mx-auto max-w-2xl">
          <p className="text-sm text-rose-700">{error}</p>
        </Surface>
      ) : tracker ? (
        <Dashboard tracker={tracker} trackers={trackers} manager={manager} onSelect={setSelected} onReload={reload} />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Site</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Quem visita o site da equipe, de onde veio e o que fez.</p>
          </div>
          <SiteStart teamId={team.id} manager={manager} onDone={() => void reload()} />
        </>
      )}
    </Page>
  )
}

export default SitePage
