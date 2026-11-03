import React, { useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { BarList, Stat, TrendChart } from '@/features/crm/InstagramCharts'
import { compact, percent } from '@/features/crm/instagram'
import { Surface } from '@/features/crm/ui'
import { SHOP_EVENTS, dailySeries, isOneDay, eventLabel, moneyText, shareOf, type SessionFilter, type SitePeriod, type SiteReport } from '@/features/crm/site'
import { cn } from '@/lib/utils'

/**
 * Loja (CRM › Site, visão geral): vendas, faturamento, o caminho do produto à
 * compra e de onde vem o dinheiro. As compras chegam do pixel da Shopify
 * (`shopifyPixelOf`) ou do `purchase` do GA4 no dataLayer (`visitas.js`); cada
 * pedido conta uma vez (migração `20261101120000_site_visitas_loja.sql`). Só
 * aparece quando o site tem algum evento de loja no período ou no anterior.
 */

export const hasShop = (report: SiteReport) =>
  report.totals.orders > 0 || report.previous.orders > 0 || report.events.some((e) => SHOP_EVENTS.includes(e.name))

const Delta: React.FC<{ now: number; before: number; dark?: boolean }> = ({ now, before, dark }) => {
  if (!before) return null
  const change = (now - before) / before
  if (Math.abs(change) < 0.005) return <span className={dark ? 'text-zinc-400' : 'text-gray-400'}>igual ao período anterior</span>
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium', change > 0 ? (dark ? 'text-emerald-300' : 'text-emerald-700') : dark ? 'text-rose-300' : 'text-rose-700')} title="Contra o período anterior, do mesmo tamanho">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {percent(Math.abs(change), 0)}
    </span>
  )
}

const STEPS = SHOP_EVENTS.filter((name) => name !== 'pagamento')

export const SiteShop: React.FC<{ report: SiteReport; period: SitePeriod; onVisits: (filter: Partial<SessionFilter>) => void }> = ({ report, period, onVisits }) => {
  const t = report.totals
  const p = report.previous
  const money = (n: number, cents = false) => moneyText(n, report.currency, cents)
  const ticket = t.orders ? t.revenue / t.orders : 0
  const ticketBefore = p.orders ? p.revenue / p.orders : 0
  const rate = shareOf(t.orders, t.sessions)
  const today = isOneDay(period)

  const revenueLine = useMemo(() => dailySeries(report, period, (d) => Number(d.revenue ?? 0) || 0), [report, period])
  const funnel = STEPS.map((name) => ({ name, sessions: report.events.find((e) => e.name === name)?.sessions ?? 0 }))
  const top = Math.max(...funnel.map((f) => f.sessions), 1)
  const byChannel = report.channels
    .filter((c) => Number(c.revenue ?? 0) > 0)
    .map((c) => ({ label: c.channel, value: Number(c.revenue), note: `${c.orders} ${c.orders === 1 ? 'venda' : 'vendas'}` }))
    .sort((a, b) => b.value - a.value)
  const byCampaign = report.campaigns
    .filter((c) => Number(c.revenue ?? 0) > 0)
    .map((c) => ({ label: c.campaign, value: Number(c.revenue), note: [c.source, `${c.orders} ${c.orders === 1 ? 'venda' : 'vendas'}`].filter(Boolean).join(' · ') }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat dark label="Faturamento" value={money(t.revenue)} sub={<span className="flex flex-wrap items-center gap-x-2"><span>vendido no site</span><Delta now={t.revenue} before={p.revenue} dark /></span>} />
        <Stat
          label="Vendas"
          value={compact(t.orders)}
          sub={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>{t.buyers} {t.buyers === 1 ? 'pessoa comprou' : 'pessoas compraram'}</span>
              <Delta now={t.orders} before={p.orders} />
            </span>
          }
        />
        <Stat label="Ticket médio" value={t.orders ? money(ticket, true) : '—'} sub={<span className="flex flex-wrap items-center gap-x-2"><span>por venda</span><Delta now={ticket} before={ticketBefore} /></span>} />
        <Stat
          label="Conversão em venda"
          value={percent(rate, rate < 0.1 ? 1 : 0)}
          sub={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>das visitas</span>
              {p.sessions > 0 && <Delta now={rate} before={shareOf(p.orders, p.sessions)} />}
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {today ? (
          <Surface title="Do produto à compra">
            <Funnel funnel={funnel} top={top} onVisits={onVisits} />
          </Surface>
        ) : (
          <section className="rounded-xl bg-zinc-900 p-4 text-white md:p-5">
            <h2 className="text-sm font-semibold">Faturamento por dia</h2>
            <p className="mb-3 text-xs text-zinc-400">As compras de cada dia, pelo pedido</p>
            <TrendChart points={revenueLine} unit="vendidos" label="Faturamento por dia" tone="dark" height={220} format={(n) => money(n, true)} />
          </section>
        )}
        <Surface title="De onde vem o faturamento">
          {byChannel.length ? <BarList rows={byChannel} format={(n) => money(n)} /> : <p className="text-sm text-gray-500">Nenhuma venda neste período.</p>}
        </Surface>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {!today && (
          <Surface title="Do produto à compra">
            <Funnel funnel={funnel} top={top} onVisits={onVisits} />
          </Surface>
        )}
        <Surface title="Campanhas que venderam">
          {byCampaign.length ? (
            <BarList rows={byCampaign} format={(n) => money(n)} />
          ) : (
            <p className="text-sm text-gray-500">Nenhuma venda de visita com campanha (utm_campaign) neste período.</p>
          )}
        </Surface>
        <Surface title="Produtos">
          {report.products.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Produto</th>
                  <th className="pb-2 text-right font-medium" title="Visitas que viram o produto">Viram</th>
                  <th className="pb-2 text-right font-medium" title="Visitas que puseram no carrinho">Carrinho</th>
                  <th className="pb-2 text-right font-medium" title="Pedidos em que foi o primeiro item">Vendas</th>
                </tr>
              </thead>
              <tbody>
                {report.products.slice(0, 10).map((row) => (
                  <tr key={row.name} className="border-t border-gray-100">
                    <td className="max-w-0 truncate py-1.5 pr-2 text-gray-800" title={row.name}>
                      {row.name}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-600">{compact(row.views)}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-600">{compact(row.carts)}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums text-gray-900">{compact(row.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">Nenhum produto visto neste período.</p>
          )}
        </Surface>
      </div>
    </div>
  )
}

const Funnel: React.FC<{ funnel: { name: string; sessions: number }[]; top: number; onVisits: (filter: Partial<SessionFilter>) => void }> = ({ funnel, top, onVisits }) => (
  <ol className="grid gap-3">
    {funnel.map((step, i) => {
      const before = i > 0 ? funnel[i - 1].sessions : 0
      return (
        <li key={step.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-gray-700">{eventLabel(step.name)}</span>
            <span className="tabular-nums text-gray-900">
              <span className="font-medium">{compact(step.sessions)}</span> <span className="text-xs text-gray-500">{step.sessions === 1 ? 'visita' : 'visitas'}</span>
              {i > 0 && before > 0 && <span className="ml-1 text-xs text-gray-400">({percent(shareOf(step.sessions, before), 0)})</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className={cn('h-full rounded-full', step.name === 'compra' ? 'bg-emerald-500' : 'bg-zinc-800')} style={{ width: `${(step.sessions / top) * 100}%` }} />
          </div>
        </li>
      )
    })}
    {funnel[funnel.length - 1].sessions > 0 && (
      <li>
        <button type="button" onClick={() => onVisits({ converted: true })} className="text-xs font-medium text-gray-600 hover:text-gray-900">
          Ver as visitas que converteram
        </button>
      </li>
    )}
  </ol>
)
