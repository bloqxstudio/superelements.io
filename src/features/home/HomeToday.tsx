import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, MousePointerClick, Radio, Users } from 'lucide-react'
import { Block } from '@/features/home/HomeParts'
import { Area, Boundary, PALETTE } from '@/features/home/HomeCharts'
import { SiteMap } from '@/features/crm/SiteMap'
import { loadReport, type SiteReport, type SiteSession, type SiteTracker } from '@/features/crm/site'

/** Hoje: a visão do dia no Início, com os números, as visitas por hora e o mapa do Brasil. Lê só o relatório do site de hoje. */
const Tile: React.FC<{ icon: React.ElementType; label: string; value: string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-[14px] p-3.5" style={{ background: `linear-gradient(150deg, ${color}1f, ${color}0a)`, boxShadow: `inset 0 0 0 1px ${color}26` }}>
    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: color }}><Icon className="h-4 w-4" aria-hidden /></span>
    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
)

const Inner: React.FC<{ trackers: SiteTracker[]; live: SiteSession[] }> = ({ trackers, live }) => {
  const navigate = useNavigate()
  const [report, setReport] = useState<SiteReport | null>(null)
  const siteId = trackers[0]?.id
  useEffect(() => {
    if (!siteId) return
    let alive = true
    const read = () => loadReport(siteId, 'hoje').then((r) => alive && setReport(r), () => undefined)
    void read()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void read() }, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [siteId])

  const hourly = useMemo(() => {
    const dow = new Date().getDay() || 7
    const by = new Array(24).fill(0) as number[]
    for (const h of report?.hours ?? []) if (h.dow === dow && h.hour >= 0 && h.hour < 24) by[h.hour] += Number(h.sessions) || 0
    const upTo = new Date().getHours() + 1
    return by.slice(0, upTo)
  }, [report])

  if (!report) return null
  const t = report.totals
  const go = () => navigate('/crm/site?aba=visitas')
  return (
    <Block id="hoje" title="Hoje" hint="O que aconteceu no site desde a meia-noite. Atualiza sozinho.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Eye} label="Visitas hoje" value={t.sessions.toLocaleString('pt-BR')} color={PALETTE[0]} />
        <Tile icon={MousePointerClick} label="Chegaram a um contato" value={t.converted.toLocaleString('pt-BR')} color={PALETTE[2]} />
        <Tile icon={Radio} label="No site agora" value={live.length.toLocaleString('pt-BR')} color={PALETTE[4]} />
        <Tile icon={Users} label="Pessoas diferentes" value={t.visitors.toLocaleString('pt-BR')} color={PALETTE[1]} />
      </div>
      {hourly.length > 1 && (
        <div className="mt-4 rounded-[14px] bg-[#f5f5f7] p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.04)]">
          <p className="text-[13px] font-semibold text-gray-900">Visitas por hora</p>
          <p className="mb-3 text-xs text-gray-500">Do início do dia até agora</p>
          <Area values={hourly} labels={hourly.map((_, i) => `${i}h`)} color={PALETTE[0]} />
        </div>
      )}
      <div className="mt-4">
        <SiteMap report={report} live={live} onVisits={go} onOpenSession={go} />
      </div>
    </Block>
  )
}

export const HomeToday: React.FC<{ trackers?: SiteTracker[]; live?: SiteSession[] }> = ({ trackers, live }) =>
  trackers?.length ? <Boundary><Inner trackers={trackers} live={live ?? []} /></Boundary> : null
