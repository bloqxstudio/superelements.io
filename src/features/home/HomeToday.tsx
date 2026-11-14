import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dayLong, dayStart, isSingleDay, spanIn, todayKey } from '@/lib/day'
import { Block } from '@/features/home/HomeParts'
import { Area, Boundary, PALETTE } from '@/features/home/HomeCharts'
import { SiteMap } from '@/features/crm/SiteMap'
import { sitePeriod, type Days } from '@/features/home/useHome'
import { loadReport, type SiteReport, type SiteSession, type SiteTracker } from '@/features/crm/site'

/** Hoje: a visão do dia no Início, com os números, as visitas por hora e o mapa do Brasil. Lê só o relatório do site de hoje. */
const Inner: React.FC<{ trackers: SiteTracker[]; live: SiteSession[]; days: Days; day?: string }> = ({ trackers, live, days, day }) => {
  const navigate = useNavigate()
  const [report, setReport] = useState<SiteReport | null>(null)
  const siteId = trackers[0]?.id
  useEffect(() => {
    if (!siteId) return
    let alive = true
    setReport(null)
    const read = () => loadReport(siteId, sitePeriod(days, day)).then((r) => alive && setReport(r), () => undefined)
    void read()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void read() }, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [siteId, days, day])

  const hourly = useMemo(() => {
    if (days !== 1 || (day && !isSingleDay(day))) return []
    const past = !!day && day !== todayKey()
    const dow = (past ? dayStart(day).getDay() : new Date().getDay()) || 7
    const by = new Array(24).fill(0) as number[]
    for (const h of report?.hours ?? []) if (h.dow === dow && h.hour >= 0 && h.hour < 24) by[h.hour] += Number(h.sessions) || 0
    return past ? by : by.slice(0, new Date().getHours() + 1)
  }, [report, days, day])

  if (!report) return null
  const go = () => navigate('/crm/site?aba=lista')
  return (
    <Block id="mapa" title="De onde vêm as visitas" hint={`Mapa do Brasil ${day ? `com as visitas ${spanIn(day)}` : days === 1 ? 'com as visitas de hoje' : `dos últimos ${days} dias`}, com quem está no site agora.`}>
      {hourly.length > 1 && (
        <div className="mb-4 rounded-[14px] bg-[#f5f5f7] p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.04)]">
          <p className="text-[13px] font-semibold text-gray-900">Visitas por hora</p>
          <p className="mb-3 text-xs text-gray-500">{day && day !== todayKey() ? `O dia todo, ${dayLong(day)}` : 'Do início do dia até agora'}</p>
          <Area values={hourly} labels={hourly.map((_, i) => `${i}h`)} color={PALETTE[0]} />
        </div>
      )}
      <SiteMap report={report} live={live} onVisits={go} onOpenSession={() => navigate('/crm/ao-vivo')} />
    </Block>
  )
}

export const HomeToday: React.FC<{ trackers?: SiteTracker[]; live?: SiteSession[]; days: Days; day?: string }> = ({ trackers, live, days, day }) =>
  trackers?.length ? <Boundary><Inner trackers={trackers} live={live ?? []} days={days} day={day} /></Boundary> : null
