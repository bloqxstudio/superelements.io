import React, { useEffect, useId, useRef, useState } from 'react'
import { Block } from '@/features/home/HomeParts'
import type { SiteReport } from '@/features/crm/site'

/** Gráficos do Início: SVG puro, cores do sistema, lidos dos mesmos relatórios dos blocos acima. */
export const PALETTE = ['#2D83EE', '#8B5CF6', '#34C759', '#FF9F0A', '#FF375F', '#14B8A6', '#64748B']

export const Card: React.FC<{ title: string; sub?: string; children: React.ReactNode; className?: string }> = ({ title, sub, children, className }) => (
  <div className={`rounded-[14px] bg-[#f5f5f7] p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.04)] ${className ?? ''}`}>
    <p className="text-[13px] font-semibold text-gray-900">{title}</p>
    {sub && <p className="mb-3 text-xs text-gray-500">{sub}</p>}
    {children}
  </div>
)

/** Área com linha suave e ponto de leitura ao passar o mouse. */
export const Area: React.FC<{ values: number[]; labels: string[]; color: string; second?: { values: number[]; color: string }; fmt?: (n: number) => string }> = ({ values, labels, color, second, fmt = (n) => n.toLocaleString('pt-BR') }) => {
  const id = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  // Desenha no tamanho real do cartão: o viewBox fixo deixava o gráfico pequeno e centrado em telas largas.
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(320)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const read = () => setW(Math.max(160, Math.round(el.getBoundingClientRect().width)))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 150, P = 8
  const max = Math.max(1, ...values, ...(second?.values ?? []))
  const step = values.length > 1 ? (W - P * 2) / (values.length - 1) : 0
  const pt = (v: number, i: number) => [P + i * step, H - P - (v / max) * (H - P * 2 - 8)] as const
  const line = (vs: number[]) => vs.map((v, i) => { const [x, y] = pt(v, i); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
  const area = `${line(values)} L${P + (values.length - 1) * step},${H} L${P},${H} Z`
  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block overflow-visible" role="img" aria-label={`Gráfico de ${labels[0] ?? ''} a ${labels[labels.length - 1] ?? ''}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left) / r.width * W - P) / (step || 1))))) }}>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".38" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={P} x2={W - P} y1={H - P - g * (H - P * 2 - 8)} y2={H - P - g * (H - P * 2 - 8)} stroke="#0000000d" />)}
        <path d={area} fill={`url(#${id})`} />
        <path d={line(values)} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {second && <path d={line(second.values)} fill="none" stroke={second.color} strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />}
        {hover === null && values.length > 0 && <circle cx={pt(values[values.length - 1], values.length - 1)[0]} cy={pt(values[values.length - 1], values.length - 1)[1]} r="3.5" fill="#fff" stroke={color} strokeWidth="2.2" />}
        <text x={W - P} y="9" textAnchor="end" fontSize="10" fill="#9ca3af">{`máx. ${fmt(max)}`}</text>
        {hover !== null && <><line x1={pt(0, hover)[0]} x2={pt(0, hover)[0]} y1="0" y2={H} stroke="#00000022" /><circle cx={pt(values[hover], hover)[0]} cy={pt(values[hover], hover)[1]} r="4" fill="#fff" stroke={color} strokeWidth="2.2" /></>}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-gray-400"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>
      {hover !== null && <div className="pointer-events-none absolute right-0 top-0 rounded-lg bg-gray-900/90 px-2 py-1 text-[11px] text-white backdrop-blur">{labels[hover]} · {fmt(values[hover])}{second ? ` · ${fmt(second.values[hover])}` : ''}</div>}
    </div>
  )
}

export const Donut: React.FC<{ items: { label: string; value: number }[] }> = ({ items }) => {
  const total = items.reduce((s, i) => s + i.value, 0) || 1
  const R = 38, C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label="Visitas por origem">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#0000000a" strokeWidth="14" />
        {items.map((it, i) => { const len = (it.value / total) * C; const el = <circle key={it.label} cx="50" cy="50" r={R} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} />; acc += len; return el })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {items.map((it, i) => <li key={it.label} className="flex items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="min-w-0 flex-1 truncate text-gray-700">{it.label}</span><b className="tabular-nums text-gray-900">{Math.round((it.value / total) * 100)}%</b></li>)}
      </ul>
    </div>
  )
}

export const Bars: React.FC<{ items: { label: string; value: number }[]; offset?: number }> = ({ items, offset = 0 }) => {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={it.label} className="grid grid-cols-[88px_1fr_36px] items-center gap-2 text-xs">
          <span className="truncate text-gray-600">{it.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-black/5"><span className="block h-full rounded-full transition-all duration-700" style={{ width: `${(it.value / max) * 100}%`, background: `linear-gradient(90deg, ${PALETTE[(i + offset) % PALETTE.length]}, ${PALETTE[(i + offset) % PALETTE.length]}99)` }} /></span>
          <b className="text-right tabular-nums text-gray-900">{it.value.toLocaleString('pt-BR')}</b>
        </li>
      ))}
    </ul>
  )
}

const HomeChartsInner: React.FC<{
  site?: SiteReport
  adDays?: { day: string; spend: number }[]
  stages?: { label: string; count: number }[]
  currency?: string
}> = ({ site, adDays, stages, currency = 'BRL' }) => {
  const dl = (d: unknown) => String(d ?? '').slice(0, 10).split('-').reverse().slice(0, 2).join('/')
  const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency, maximumFractionDigits: 0 })
  const siteDays = Array.isArray(site?.days) ? site!.days : []
  const hasSite = siteDays.length > 1
  const hasAds = Array.isArray(adDays) && adDays.length > 1
  const channels = (Array.isArray(site?.channels) ? site!.channels : []).slice(0, 6).map((c) => ({ label: c.channel, value: c.sessions })).filter((c) => c.value > 0)
  const states = (Array.isArray(site?.regions) ? site!.regions : []).filter((r) => r.country === 'BR').slice(0, 6).map((r) => ({ label: r.name ?? r.region, value: r.sessions }))
  const funnel = (Array.isArray(stages) ? stages : []).filter((s) => s.count > 0).map((s) => ({ label: s.label, value: s.count }))
  if (!hasSite && !hasAds && !funnel.length) return null
  return (
    <Block id="graficos" title="Gráficos" hint="Visitas, gasto, origem e funil do período, lidos das mesmas fontes do resumo.">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {hasSite && <Card title="Visitas por dia" sub="Linha tracejada: chegaram a um contato"><Area values={siteDays.map((d) => Number(d.sessions) || 0)} labels={siteDays.map((d) => dl(d.day))} color={PALETTE[0]} second={{ values: siteDays.map((d) => Number(d.converted) || 0), color: PALETTE[2] }} /></Card>}
        {hasAds && <Card title="Valor usado por dia" sub="Meta Ads"><Area values={adDays!.map((d) => d.spend)} labels={adDays!.map((d) => dl(d.day))} color={PALETTE[3]} fmt={money} /></Card>}
        {channels.length > 0 && <Card title="De onde vêm as visitas" sub="Por origem"><Donut items={channels} /></Card>}
        {states.length > 0 && <Card title="Visitas por estado"><Bars items={states} /></Card>}
        {funnel.length > 0 && <Card title="Oportunidades por etapa" sub="Funil atual"><Bars items={funnel} offset={1} /></Card>}
      </div>
    </Block>
  )
}

export class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

/** Um gráfico com dado inesperado nunca derruba o Início. */
export const HomeCharts: React.FC<React.ComponentProps<typeof HomeChartsInner>> = (props) => <Boundary><HomeChartsInner {...props} /></Boundary>
