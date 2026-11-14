import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CalendarCheck, FileText, Globe, Monitor, Smartphone, Tablet } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { subscribeTopic } from '@/lib/realtimeTopic'
import { compact, percent } from '@/features/crm/instagram'
import { isLive, placeLabel as formPlace, toVisit, useNow, type FormVisit } from '@/features/crm/formVisits'
import { listForms, type CrmForm } from '@/features/crm/forms'
import { cleanDefinition, type FormDefinition } from '../../../supabase/functions/_shared/forms.ts'
import { duration, pathLabel, periodRange, placeLabel, type SitePeriod, type SiteSession } from '@/features/crm/site'
import { channelRows, funnelTotals, countsAsVisit, formWhere, splitByPeriod, type FunnelTotals } from '@/features/crm/siteFunnel'
import { Surface, plural } from '@/features/crm/ui'
import { cn } from '@/lib/utils'

/**
 * Formulários na tela Visitas do site (2026-11-14): quem está agora no site e nos formulários da
 * conta, numa lista só, e o funil campanha → site ou formulário → agendamento. Abrir o formulário
 * pelo link conta como visita; dentro do site já é a visita do site (regras em `siteFunnel.ts`).
 */

const db = supabase as unknown as SupabaseClient
const COLUMNS =
  'id, form_id, visitor, started_at, last_at, left_at, active_ms, screen, step_id, step_index, steps_total, steps_seen, started, submitted, qualified, schedule_view, scheduled, submission_id, page, embed, channel, source, medium, campaign, content, referrer_host, device, browser, os, country, region, region_name, city, site_session_id, site_tracked'

/** As visitas aos formulários da conta no período e no anterior (para comparar), ao vivo */
export function useTeamFormVisits(teamId: string, period: SitePeriod) {
  const [visits, setVisits] = useState<FormVisit[]>([])
  const [forms, setForms] = useState<Map<string, CrmForm>>(new Map())
  const [ready, setReady] = useState(false)
  const range = useMemo(() => {
    const now = Date.now()
    const { from, to } = periodRange(period)
    return { from: from.getTime(), to: to.getTime(), openEnd: to.getTime() > now }
  }, [period])
  const sinceRef = useRef(0)
  sinceRef.current = range.from - (range.to - range.from)

  const load = useCallback(async () => {
    const since = new Date(range.from - (range.to - range.from)).toISOString()
    const [{ data, error }, list] = await Promise.all([
      db.from('crm_form_visits').select(COLUMNS).eq('team_id', teamId).gte('started_at', since).order('started_at', { ascending: false }).limit(5000),
      listForms(teamId).catch(() => [] as CrmForm[]),
    ])
    // Sem a tabela ou com o módulo Formulários desligado (RLS), a tela segue só com o site
    setVisits(error ? [] : (data ?? []).map((r) => toVisit(r as Record<string, unknown>)))
    setForms(new Map(list.map((f) => [f.id, f])))
    setReady(true)
  }, [teamId, range])

  useEffect(() => {
    setReady(false)
    void load()
  }, [load])

  useEffect(() => {
    const leave = subscribeTopic(`site-form-visits-${teamId}`, (channel) =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'crm_form_visits', filter: `team_id=eq.${teamId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          setVisits((list) => list.filter((v) => v.id !== id))
          return
        }
        const visit = toVisit(payload.new as Record<string, unknown>)
        if (visit.startedAt < sinceRef.current) return
        setVisits((list) => {
          const i = list.findIndex((v) => v.id === visit.id)
          if (i < 0) return [visit, ...list]
          const next = list.slice()
          next[i] = visit
          return next
        })
      })
    )
    // Reserva se a Realtime cair: uma leitura a cada 2 min com a aba à vista
    const t = window.setInterval(() => document.visibilityState === 'visible' && void load(), 120_000)
    return () => {
      window.clearInterval(t)
      leave()
    }
  }, [teamId, load])

  const split = useMemo(() => splitByPeriod(visits, range.from, range.to, range.openEnd), [visits, range])
  return { all: visits, current: split.current, previous: split.previous, forms, ready }
}

const formName = (forms: Map<string, CrmForm>, id: string) => forms.get(id)?.live?.name || forms.get(id)?.name || 'Formulário'

const DeviceIcon: React.FC<{ device?: string; className?: string }> = ({ device, className }) => {
  const Icon = device === 'Celular' || device === 'mobile' ? Smartphone : device === 'Tablet' || device === 'tablet' ? Tablet : Monitor
  return <Icon className={className} aria-label={device ?? 'Aparelho'} />
}

const ago = (at: number, now: number) => {
  const m = Math.floor(Math.max(0, now - at) / 60_000)
  return m < 1 ? 'agora' : `há ${m} min`
}

type LiveItem = { kind: 'site'; at: number; s: SiteSession } | { kind: 'form'; at: number; v: FormVisit }

/** Ao vivo agora: quem está no site e nos formulários, numa lista só */
export const LiveNow: React.FC<{
  site: SiteSession[]
  forms: FormVisit[]
  formsById: Map<string, CrmForm>
  onOpenSession: (s: SiteSession) => void
  onSiteVisits: () => void
}> = ({ site, forms, formsById, onOpenSession, onSiteVisits }) => {
  const now = useNow(5000)
  const items = useMemo<LiveItem[]>(
    () =>
      [...site.map((s) => ({ kind: 'site' as const, at: s.startedAt, s })), ...forms.filter((v) => isLive(v, now)).map((v) => ({ kind: 'form' as const, at: v.startedAt, v }))].sort((a, b) => b.at - a.at),
    [site, forms, now]
  )
  const inForm = items.filter((i) => i.kind === 'form').length
  return (
    <Surface
      title="Ao vivo agora"
      action={
        <span className="text-xs text-gray-500">
          {plural(site.length, 'no site', 'no site')} · {plural(inForm, 'no formulário', 'no formulário')}
        </span>
      }
    >
      {items.length ? (
        <ul className="divide-y divide-gray-100">
          {items.slice(0, 30).map((item) => {
            if (item.kind === 'site') {
              const s = item.s
              const place = placeLabel(s)
              return (
                <li key={`s:${s.id}`}>
                  <button type="button" onClick={() => onOpenSession(s)} className="-mx-2 flex w-[calc(100%+16px)] items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        Site · {pathLabel(s.exit || s.landing)}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        <span>{[s.channel, s.campaign].filter(Boolean).join(' · ')}</span>
                        {place && <span>· {place}</span>}
                        <span className="inline-flex items-center gap-1">· <DeviceIcon device={s.device} className="h-3 w-3" /> {s.device}</span>
                        {s.converted && <span className="font-medium text-emerald-700">· fez contato</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-gray-500">
                      <span className="block">entrou {ago(s.startedAt, now)}</span>
                      <span className="block tabular-nums">{plural(s.pageviews, 'página', 'páginas')}</span>
                    </span>
                  </button>
                </li>
              )
            }
            const v = item.v
            const form = formsById.get(v.formId)
            const place = [v.city, v.region || v.regionName].filter(Boolean).join(', ')
            return (
              <li key={`f:${v.id}`}>
                <Link to={`/crm/formularios/${v.formId}?aba=aovivo`} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {formName(formsById, v.formId)} · {form ? formPlace(form.live?.definition ?? form.definition, v) : v.screen}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                      <span>{[v.channel || 'Direto', v.campaign].filter(Boolean).join(' · ')}</span>
                      {place && <span>· {place}</span>}
                      <span className="inline-flex items-center gap-1">· <DeviceIcon device={v.device} className="h-3 w-3" /> {v.device}</span>
                      <span>· {formWhere(v)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-gray-500">
                    <span className="block">entrou {ago(v.startedAt, now)}</span>
                    <span className="block tabular-nums">{duration(v.activeMs)}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Ninguém no site nem nos formulários agora.</p>
      )}
      {site.length > 0 && (
        <button type="button" onClick={onSiteVisits} className="mt-2 text-xs font-medium text-gray-600 hover:text-gray-900">
          Ver as visitas do site agora, com a jornada
        </button>
      )}
      <p className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
        Site: atividade nos últimos 5 minutos. Formulário: sinal no último minuto. O formulário dentro de um site com o código de visitas é parte da visita do site e conta uma vez só.
      </p>
    </Surface>
  )
}

const Delta: React.FC<{ now: number; before: number }> = ({ now, before }) => {
  if (!before) return null
  const change = (now - before) / before
  if (Math.abs(change) < 0.005) return null
  return <span className={cn('text-[11px] font-medium', change > 0 ? 'text-emerald-700' : 'text-rose-700')}>{`${change > 0 ? '+' : '−'}${percent(Math.abs(change), 0)}`}</span>
}

/** Campanha → site ou formulário → enviou → agendou, com a quebra por canal */
export const JourneyFunnel: React.FC<{
  siteSessions: number
  previousSiteSessions: number
  siteChannels: { channel: string; sessions: number }[]
  current: FormVisit[]
  previous: FormVisit[]
  onChannel: (channel: string) => void
}> = ({ siteSessions, previousSiteSessions, siteChannels, current, previous, onChannel }) => {
  const t = funnelTotals(siteSessions, current)
  const p = funnelTotals(previousSiteSessions, previous)
  const rows = useMemo(() => channelRows(siteChannels, current).slice(0, 10), [siteChannels, current])
  if (!current.length && !previous.length) return null

  const steps: { key: keyof FunnelTotals; label: string; hint: string; tone: string }[] = [
    { key: 'visits', label: 'Visitas', hint: `${compact(t.site)} no site · ${compact(t.formLink)} só no formulário`, tone: 'bg-sky-500' },
    { key: 'formOpened', label: 'Abriram um formulário', hint: 'no site ou pelo link', tone: 'bg-violet-500' },
    { key: 'submitted', label: 'Enviaram', hint: 'o formulário', tone: 'bg-violet-500' },
    { key: 'scheduled', label: 'Agendaram', hint: `${compact(t.scheduleView)} viram a agenda`, tone: 'bg-emerald-500' },
  ]
  const top = t.visits || 1

  return (
    <Surface title="Funil: campanha → site ou formulário → agendamento" action={<span className="text-xs text-gray-400">no período, contra o anterior</span>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ol className="grid content-start gap-3">
          {steps.map((s, i) => {
            const value = t[s.key]
            const prev = i > 0 ? t[steps[i - 1].key] : 0
            return (
              <li key={s.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-gray-900">{s.label}</span> <span className="text-xs text-gray-500">{s.hint}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                    <span className="font-semibold text-gray-900">{compact(value)}</span>
                    {i > 0 && <span className="text-xs text-gray-500">{percent(prev ? value / prev : 0, 0)}</span>}
                    <Delta now={value} before={p[s.key]} />
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className={cn('h-full rounded-full', s.tone)} style={{ width: `${value ? Math.max(2, (value / top) * 100) : 0}%` }} />
                </div>
              </li>
            )
          })}
          <li className="text-[11px] text-gray-400">A porcentagem é sobre a etapa anterior. O formulário dentro de um site com o código de visitas já está na visita do site; pelo link (ou num site sem o código), conta como visita nova.</li>
        </ol>

        <div className="-mx-1 overflow-x-auto px-1">
          <table className="se-table w-full min-w-[480px] text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-3 font-medium">Origem</th>
                <th className="px-2 pb-2 text-right font-medium">Site</th>
                <th className="px-2 pb-2 text-right font-medium" title="Pelo link do formulário ou num site sem o código de visitas">Só formulário</th>
                <th className="px-2 pb-2 text-right font-medium">Visitas</th>
                <th className="px-2 pb-2 text-right font-medium">Enviaram</th>
                <th className="pb-2 pl-2 text-right font-medium">
                  <CalendarCheck className="ml-auto h-3.5 w-3.5" aria-label="Agendaram" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel} className="border-t border-gray-100">
                  <td className="py-2 pr-3">
                    <button type="button" onClick={() => onChannel(r.channel)} className="max-w-[200px] truncate text-left text-sm text-gray-900 hover:underline" title="Ver as visitas do site desta origem">
                      {r.channel}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{r.site || '—'}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{r.form || '—'}</td>
                  <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-gray-900">{r.visits}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-gray-700">{r.submitted || '—'}</td>
                  <td className={cn('py-2 pl-2 text-right text-sm tabular-nums', r.scheduled ? 'font-medium text-emerald-700' : 'text-gray-400')}>{r.scheduled || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Surface>
  )
}

/**
 * O trecho do formulário dentro de uma visita do site (painel da visita): em que formulário entrou, até
 * que etapa foi, quanto tempo ficou, se enviou e agendou. Ligado pelo `site_session_id` (forms.js v26).
 */
export const FormsInVisit: React.FC<{ sessionId: string; lastAt: number }> = ({ sessionId, lastAt }) => {
  const [rows, setRows] = useState<{ v: FormVisit; form?: { name: string; definition: FormDefinition } }[]>([])
  useEffect(() => {
    let alive = true
    void (async () => {
      const { data, error } = await db.from('crm_form_visits').select(COLUMNS).eq('site_session_id', sessionId).order('started_at').limit(20)
      if (error || !alive || !data?.length) return setRows([])
      const visits = data.map((r) => toVisit(r as Record<string, unknown>))
      const { data: forms } = await db.from('crm_forms').select('id, team_id, name, definition, live').in('id', [...new Set(visits.map((v) => v.formId))])
      if (!alive) return
      type Row = { id: string; name: string; definition: unknown; live?: { name?: string; definition?: unknown } | null }
      const byId = new Map(((forms ?? []) as Row[]).map((f) => [f.id, { name: f.live?.name || f.name, definition: cleanDefinition(f.live?.definition ?? f.definition) }]))
      setRows(visits.map((v) => ({ v, form: byId.get(v.formId) })))
    })()
    return () => {
      alive = false
    }
  }, [sessionId, lastAt])
  if (!rows.length) return null
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">No formulário</h3>
      <ul className="grid gap-1.5">
        {rows.map(({ v, form }) => {
          const definition = form?.definition
          return (
            <li key={v.id} className="flex items-start gap-3 rounded-lg bg-violet-50/60 px-3 py-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
              <span className="min-w-0 flex-1 text-sm">
                <Link to={`/crm/formularios/${v.formId}?aba=aovivo`} className="font-medium text-gray-900 hover:underline">
                  {form?.name || 'Formulário'}
                </Link>
                <span className="block text-xs text-gray-500">
                  {[
                    definition ? formPlace(definition, v) : undefined,
                    v.stepsSeen.length ? plural(v.stepsSeen.length, 'etapa vista', 'etapas vistas') : undefined,
                    `${duration(v.activeMs)} em uso`,
                    v.scheduleView && !v.scheduled ? 'viu a agenda' : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className={cn('shrink-0 text-xs font-medium', v.scheduled ? 'text-emerald-700' : v.submitted ? 'text-violet-700' : 'text-gray-400')}>
                {v.scheduled ? 'Agendou' : v.submitted ? 'Enviou' : 'Não enviou'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
