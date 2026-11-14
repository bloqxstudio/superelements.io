import React, { useMemo } from 'react'
import type { FormVisit } from '@/features/crm/formFunnel'
import { emptyReport, type SiteReport, type SiteSession } from '@/features/crm/site'
import { FORM_WORDS, SiteMap } from '@/features/crm/SiteMap'
import type { MetaView } from '@/features/crm/siteMeta'

/**
 * Mapa de estados dos formulários (2026-11-14, o usuário: "podemos ter mapa de estados dentro do formulário
 * também?"). O mesmo mapa do site, com as visitas aos formulários: estado e cidade vêm da função `form-submit`
 * (MaxMind pelo IP na primeira batida, IP nunca guardado). Os formulários não guardam coordenadas, então as
 * cidades aparecem na lista do estado e não como bolinhas; quem está agora pulsa no meio do estado.
 */

/** As visitas aos formulários no formato do relatório do mapa (enviou = "contato") */
export function formsMapReport(visits: FormVisit[]): SiteReport {
  const report = emptyReport()
  const regions = new Map<string, SiteReport['regions'][number] & { people: Set<string> }>()
  const cities = new Map<string, SiteReport['cities'][number] & { people: Set<string> }>()
  const countries = new Map<string, number>()
  for (const v of visits) {
    const who = v.visitor ?? v.id
    if (v.country) countries.set(v.country, (countries.get(v.country) ?? 0) + 1)
    if (!v.country || !v.region) continue
    const rk = `${v.country}:${v.region}`
    const r = regions.get(rk) ?? { country: v.country, region: v.region, name: v.regionName ?? null, sessions: 0, visitors: 0, converted: 0, meta: 0, people: new Set<string>() }
    r.sessions++
    r.people.add(who)
    if (v.submitted) r.converted++
    if (v.channel === 'Meta Ads') r.meta++
    regions.set(rk, r)
    if (!v.city) continue
    const ck = `${rk}:${v.city}`
    const c = cities.get(ck) ?? { country: v.country, region: v.region, city: v.city, lat: NaN, lon: NaN, sessions: 0, visitors: 0, converted: 0, people: new Set<string>() }
    c.sessions++
    c.people.add(who)
    if (v.submitted) c.converted++
    cities.set(ck, c)
  }
  report.totals = { ...report.totals, sessions: visits.length, converted: visits.filter((v) => v.submitted).length }
  report.regions = [...regions.values()].map(({ people, ...r }) => ({ ...r, visitors: people.size }))
  report.cities = [...cities.values()].map(({ people, ...c }) => ({ ...c, visitors: people.size }))
  report.countries = [...countries.entries()].map(([key, sessions]) => ({ key, sessions }))
  report.mapReady = true
  return report
}

/** Quem está agora num formulário, no formato que o mapa pulsa (no meio do estado) */
const asLive = (v: FormVisit, formName: (id: string) => string): SiteSession =>
  ({
    id: v.id,
    visitorId: v.visitor ?? v.id,
    visitNumber: 1,
    startedAt: v.startedAt,
    lastAt: Date.now(),
    landing: formName(v.formId),
    channel: v.channel || 'Direto',
    device: v.device,
    country: v.country,
    region: v.region,
    regionName: v.regionName,
    city: v.city,
    details: {},
    pageviews: 0,
    events: 0,
    activeMs: v.activeMs,
    converted: v.submitted,
    conversions: [],
    orders: 0,
    revenue: 0,
  }) as SiteSession

export const FormsMap: React.FC<{
  visits: FormVisit[]
  live?: FormVisit[]
  formName: (id: string) => string
  meta?: MetaView
  title?: string
  onOpenLive?: () => void
}> = ({ visits, live = [], formName, meta, title = 'Mapa dos formulários', onOpenLive }) => {
  const report = useMemo(() => formsMapReport(visits), [visits])
  const liveSessions = useMemo(() => live.map((v) => asLive(v, formName)), [live, formName])
  if (!visits.length && !live.length) return null
  return <SiteMap title={title} report={report} live={liveSessions} meta={meta} words={FORM_WORDS} onOpenSession={() => onOpenLive?.()} />
}
