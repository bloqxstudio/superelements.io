import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, MapPinOff, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inBrazil } from './siteGeo'
import { SiteMap } from './SiteMap'
import type { SiteReport, SiteSession, SiteTotals } from './site'

/**
 * A vista "Ao vivo" da Operação: quem está no site agora (no mapa e sem
 * localização), o funil do período em faixas que afinam a cada etapa, o mapa
 * real do painel Site só com quem está agora e os aparelhos dessas pessoas.
 * Nada é simulado: sem site conectado, os blocos dizem isso.
 */

export interface FunnelStep {
  id: string
  label: string
  value: number | undefined
  hint: string
}

const ZERO: SiteTotals = { sessions: 0, visitors: 0, newVisitors: 0, pageviews: 0, activeMs: 0, bounces: 0, converted: 0, orders: 0, revenue: 0, buyers: 0 }

const located = (s: SiteSession) => Number.isFinite(s.lat) && Number.isFinite(s.lon)

/** Um relatório do mapa feito só de quem está no site agora: estados e cidades contam pessoas, não o período */
export function liveReport(live: SiteSession[]): SiteReport {
  const regions = new Map<string, SiteReport['regions'][number]>()
  const cities = new Map<string, SiteReport['cities'][number]>()
  const countries = new Map<string, number>()
  for (const s of live) {
    if (s.country) countries.set(s.country, (countries.get(s.country) ?? 0) + 1)
    if (s.country && s.region) {
      const key = `${s.country}:${s.region}`
      const r = regions.get(key) ?? { country: s.country, region: s.region, name: s.regionName ?? null, sessions: 0, visitors: 0, converted: 0, meta: 0 }
      r.sessions++
      r.visitors++
      if (s.converted) r.converted++
      if (s.channel === 'Meta Ads') r.meta++
      regions.set(key, r)
    }
    if (s.country && s.city && located(s)) {
      const key = `${s.country}:${s.region ?? ''}:${s.city}`
      const c = cities.get(key) ?? { country: s.country, region: s.region ?? null, city: s.city, lat: s.lat!, lon: s.lon!, sessions: 0, visitors: 0, converted: 0 }
      c.sessions++
      c.visitors++
      if (s.converted) c.converted++
      cities.set(key, c)
    }
  }
  return {
    totals: { ...ZERO, sessions: live.length, visitors: live.length, converted: live.filter((s) => s.converted).length },
    previous: ZERO,
    days: [],
    channels: [],
    sources: [],
    campaigns: [],
    pages: [],
    landings: [],
    events: [],
    clicks: [],
    conversionPages: [],
    devices: [],
    browsers: [],
    os: [],
    countries: [...countries].map(([key, sessions]) => ({ key, sessions })),
    tzs: [],
    langs: [],
    hours: [],
    notFound: [],
    regions: [...regions.values()],
    cities: [...cities.values()],
    ads: [],
    products: [],
    mapReady: true,
  }
}

const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString('pt-BR'))
const pct = (part: number, whole: number) => {
  const v = whole > 0 ? (part / whole) * 100 : 0
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v > 0 && v < 10 ? 2 : 1 })}%`
}

export const OperacaoAoVivo: React.FC<{
  siteOn: boolean
  siteState: string
  live: SiteSession[]
  steps: FunnelStep[]
  pastDay?: string
  tall: boolean
}> = ({ siteOn, siteState, live, steps, pastDay, tall }) => {
  const navigate = useNavigate()
  const report = useMemo(() => liveReport(live), [live])
  const onMap = live.filter((s) => located(s) && (s.country !== 'BR' || inBrazil(s.lat!, s.lon!))).length
  const noSite = !siteOn || siteState === 'none' || siteState === 'off'

  return (
    <div className={cn('space-y-4 bg-[#F6F7F9] p-4 sm:p-5', tall && 'min-h-0 flex-1 overflow-y-auto')}>
      {/* quem está agora */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={Radio} live label="Pessoas no site agora" value={noSite ? '—' : fmt(live.length)} note={noSite ? 'Nenhum site conectado' : 'Atividade nos últimos 5 minutos'} />
        <Kpi icon={MapPin} label="No mapa" value={noSite ? '—' : fmt(onMap)} note="Com cidade aproximada pelo IP" />
        <Kpi icon={MapPinOff} label="Sem localização" value={noSite ? '—' : fmt(live.length - onMap)} note="Contam no total, fora do mapa" />
      </div>

      <Funnel steps={steps} pastDay={pastDay} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {noSite ? (
            <Empty title="Onde está o público agora" text="Conecte o site em Site › Instalação para ver quem está navegando, no mapa." />
          ) : (
            <SiteMap title="Onde está o público agora" report={report} live={live} onVisits={() => navigate('/crm/ao-vivo')} onOpenSession={() => navigate('/crm/ao-vivo')} />
          )}
        </div>
        <Devices live={live} empty={noSite} />
      </div>
    </div>
  )
}

const Kpi: React.FC<{ icon: React.ElementType; label: string; value: string; note: string; live?: boolean }> = ({ icon: Icon, label, value, note, live }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4">
    <p className="flex items-center gap-2 text-xs font-medium text-gray-600">
      <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', live ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600')}>
        <Icon className={cn('h-3.5 w-3.5', live && 'motion-safe:animate-pulse')} aria-hidden />
      </span>
      {label}
    </p>
    <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-gray-900">{value}</p>
    <p className="mt-1 text-xs text-gray-500">{note}</p>
  </div>
)

/** Do primeiro azul claro ao lima da venda */
const BAND = ['#C9D9F4', '#AFC7EF', '#93B4E8', '#B9D58A', '#A3CC4F', '#D2F525']

const Funnel: React.FC<{ steps: FunnelStep[]; pastDay?: string }> = ({ steps, pastDay }) => {
  // O topo é a primeira etapa com número; as faixas afinam pela raiz, para a venda não sumir
  const top = steps.find((s) => (s.value ?? 0) > 0)?.value ?? 0
  const W = 1200
  const H = 150
  const col = W / steps.length
  const heightOf = (v: number | undefined) => (top > 0 && v !== undefined ? Math.max(0.05, Math.sqrt(Math.min(v, top) / top)) * H : 0.05 * H)
  const hs = steps.map((s) => heightOf(s.value))

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" aria-label="Funil de conversão">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-gray-900">Funil de conversão</h2>
        <span className="text-[11px] text-gray-500">{pastDay ? (pastDay.includes('~') ? 'Das datas escolhidas' : 'Do dia escolhido') : 'Do período · atualiza sozinho'}</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => {
              const prev = i > 0 ? steps[i - 1].value : undefined
              return (
                <div key={s.id} title={s.hint} className={cn('pr-3', i > 0 && 'border-l border-dashed border-gray-200 pl-3')}>
                  <p className="text-xs font-medium text-gray-600">{s.label}</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{fmt(s.value)}</p>
                  <p className="text-[11px] tabular-nums text-gray-500">
                    {s.value !== undefined && top > 0 ? `${pct(s.value, top)} do topo` : ' '}
                    {s.value !== undefined && prev ? <span className="text-gray-400"> · {pct(s.value, prev)} da anterior</span> : null}
                  </p>
                </div>
              )
            })}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-[120px] w-full sm:h-[150px]" aria-hidden>
            {steps.map((s, i) => {
              const x0 = i * col
              const x1 = x0 + col
              const a = hs[i]
              const b = i < steps.length - 1 ? hs[i + 1] : hs[i]
              // a faixa fica cheia na metade esquerda e afina até a próxima na metade direita
              const mid = x0 + col * 0.45
              const d = `M${x0},${(H - a) / 2} L${mid},${(H - a) / 2} L${x1},${(H - b) / 2} L${x1},${(H + b) / 2} L${mid},${(H + a) / 2} L${x0},${(H + a) / 2} Z`
              return <path key={s.id} d={d} fill={s.value === undefined ? '#EEF0F3' : BAND[i % BAND.length]} className="transition-[d] duration-500" />
            })}
          </svg>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">Anúncio e visita vêm da Meta e do site; conversa, proposta e venda vêm do funil do CRM. As faixas afinam pela raiz, para as últimas etapas continuarem visíveis.</p>
    </section>
  )
}

const DEVICES: { key: string; label: string; color: string }[] = [
  { key: 'Computador', label: 'Computador', color: '#8B5CF6' },
  { key: 'Celular', label: 'Celular', color: '#2D83EE' },
  { key: 'Tablet', label: 'Tablet', color: '#F59E0B' },
  { key: '', label: 'Não identificado', color: '#D1D5DB' },
]

const Devices: React.FC<{ live: SiteSession[]; empty: boolean }> = ({ live, empty }) => {
  const counts = DEVICES.map((d) => ({ ...d, n: live.filter((s) => (d.key ? s.device === d.key : !DEVICES.some((x) => x.key && x.key === s.device))).length }))
  const total = live.length
  const R = 52
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <section className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" aria-label="Dispositivos agora">
      <h2 className="text-sm font-semibold text-gray-900">Dispositivos agora</h2>
      <div className="relative mx-auto mt-4 h-44 w-44">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="70" cy="70" r={R} fill="none" stroke="#EEF0F3" strokeWidth="16" />
          {!empty &&
            total > 0 &&
            counts.map((d) => {
              if (!d.n) return null
              const len = (d.n / total) * C
              const el = <circle key={d.label} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} className="transition-all duration-500" />
              offset += len
              return el
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-gray-900">{empty ? '—' : total.toLocaleString('pt-BR')}</span>
          <span className="text-[11px] text-gray-500">online</span>
        </div>
      </div>
      <ul className="mt-5 space-y-2.5">
        {counts.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-gray-700">{d.label}</span>
            <span className="tabular-nums font-medium text-gray-900">{empty ? '—' : d.n}</span>
            <span className="w-10 text-right text-xs tabular-nums text-gray-500">{empty || !total ? '' : `${Math.round((d.n / total) * 100)}%`}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const Empty: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <section className="flex h-full min-h-[300px] flex-col rounded-2xl border border-gray-200 bg-white p-5">
    <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
    <p className="m-auto max-w-xs text-center text-sm leading-relaxed text-gray-500">{text}</p>
  </section>
)
