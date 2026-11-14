import React, { useMemo, useState } from 'react'
import { CalendarCheck, CircleAlert, Eye, Loader2, Monitor, Radio, Send, Smartphone, Tablet } from 'lucide-react'
import { Surface, plural, whenLabel } from '@/features/crm/ui'
import { byOrigin, funnelOf, isLive, placeLabel, useFormVisits, useNow, worstDrop, type FormVisit, type FunnelRow } from '@/features/crm/formVisits'
import type { CrmForm } from '@/features/crm/forms'
import { cn } from '@/lib/utils'

/**
 * Acompanhamento de um formulário (CRM › Formulários › editor › Ao vivo): quem está nele agora e em
 * que etapa, o funil do período (abriu → etapas → enviou → agenda) com a maior queda, e de onde
 * vêm as pessoas. Tudo de `crm_form_visits`, ao vivo pela Realtime.
 */

type Period = 'hoje' | '7' | '30'
const PERIODS: { id: Period; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
]

const sinceOf = (p: Period) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (p !== 'hoje') d.setDate(d.getDate() - (Number(p) - 1))
  return d.getTime()
}

const pct = (n: number, of: number) => (of > 0 ? `${String(Math.round((n / of) * 1000) / 10).replace('.', ',')}%` : '—')
const fmt = (n: number) => n.toLocaleString('pt-BR')

const duration = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${Math.floor(m / 60)} h ${m % 60} min`
}

const ago = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  return whenLabel(at)
}

const DeviceIcon: React.FC<{ device?: string; className?: string }> = ({ device, className }) => {
  const Icon = device === 'Celular' || device === 'mobile' ? Smartphone : device === 'Tablet' || device === 'tablet' ? Tablet : Monitor
  return <Icon className={className} aria-label={device ?? 'Aparelho'} />
}

const placeOf = (v: FormVisit) => [v.city, v.region || v.regionName].filter(Boolean).join(', ') || (v.country && v.country !== 'BR' ? v.country : undefined)
const originOf = (v: FormVisit) => [v.channel || 'Direto', v.campaign].filter(Boolean).join(' · ')

const Tile: React.FC<{ icon: React.ElementType; label: string; value: string; sub?: string; live?: boolean }> = ({ icon: Icon, label, value, sub, live }) => (
  <div className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
    <span className="flex items-center gap-2 text-xs font-medium text-gray-500">
      {live ? (
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <Icon className="h-3.5 w-3.5" aria-hidden />
      )}
      {label}
    </span>
    <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
  </div>
)

const Funnel: React.FC<{ rows: FunnelRow[] }> = ({ rows }) => {
  const top = rows[0]?.value || 0
  return (
    <ol className="grid gap-2">
      {rows.map((row, i) => {
        const prev = i > 0 ? rows[i - 1] : undefined
        const width = top > 0 ? Math.max(2, (row.value / top) * 100) : 0
        const lost = prev && row.kind !== 'qualified' ? prev.value - row.value : 0
        return (
          <li key={row.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium text-gray-900">{row.label}</span>
                {row.hint && <span className="text-gray-500"> · {row.hint}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-gray-900">
                {fmt(row.value)} <span className="text-xs text-gray-500">{i > 0 ? pct(row.value, top) : ''}</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className={cn('h-full rounded-full', row.kind === 'scheduled' || row.kind === 'submit' ? 'bg-emerald-500' : 'bg-violet-500')} style={{ width: `${width}%` }} />
            </div>
            {lost > 0 && prev && prev.value > 0 && <p className="mt-0.5 text-[11px] text-gray-400">{fmt(lost)} pararam antes daqui ({pct(lost, prev.value)} de {prev.label.toLowerCase()})</p>}
          </li>
        )
      })}
    </ol>
  )
}

const VisitRow: React.FC<{ v: FormVisit; form: CrmForm; now: number; live?: boolean }> = ({ v, form, now, live }) => {
  const place = placeOf(v)
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', live ? 'bg-emerald-500' : v.scheduled ? 'bg-emerald-300' : v.submitted ? 'bg-violet-400' : 'bg-zinc-300')} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900">{placeLabel(form.definition, v)}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
          <span>{originOf(v)}</span>
          {place && <span>· {place}</span>}
          <span className="inline-flex items-center gap-1">· <DeviceIcon device={v.device} className="h-3 w-3" /> {[v.device, v.browser].filter(Boolean).join(', ')}</span>
          {v.embed === 'site' && <span>· no site</span>}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs text-gray-500">
        <span className="block">{live ? `entrou ${ago(v.startedAt, now)}` : ago(v.lastAt, now)}</span>
        <span className="block tabular-nums">{duration(v.activeMs)}</span>
      </span>
    </li>
  )
}

export const FormLive: React.FC<{ form: CrmForm }> = ({ form }) => {
  const [period, setPeriod] = useState<Period>('7')
  const since = useMemo(() => sinceOf(period), [period])
  const { visits, error } = useFormVisits(form.id, since)
  const now = useNow(5000)
  const [originKey, setOriginKey] = useState<'channel' | 'campaign'>('channel')

  const data = useMemo(() => {
    const list = visits ?? []
    const live = list.filter((v) => isLive(v, now)).sort((a, b) => b.startedAt - a.startedAt)
    const rows = funnelOf(form.definition, form.settings, list)
    return { list, live, rows, drop: worstDrop(rows), origins: byOrigin(list, originKey).slice(0, 8) }
  }, [visits, now, form.definition, form.settings, originKey])

  if (visits === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Abrindo o acompanhamento…
      </p>
    )
  }

  const { list, live, rows, drop, origins } = data
  const submitted = list.filter((v) => v.submitted).length
  const scheduled = list.filter((v) => v.scheduled).length
  const booking = !!form.settings.booking?.enabled
  const periodLabel = PERIODS.find((p) => p.id === period)?.label.toLowerCase()

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Período" className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)} className={cn('rounded-md px-3 py-1 font-medium', period === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">Atualiza sozinho. Para não contar a equipe, abra o link uma vez com <code className="rounded bg-zinc-100 px-1">?visitas=off</code>.</p>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <CircleAlert className="h-4 w-4" /> {error}
        </p>
      )}
      {form.status !== 'published' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">O formulário está em rascunho: só conta quem abrir depois de publicado.</p>}

      <div className={cn('grid gap-3 sm:grid-cols-2', booking ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
        <Tile icon={Radio} label="No formulário agora" value={fmt(live.length)} sub={live.length ? plural(live.filter((v) => v.started || v.submitted).length, 'já começou', 'já começaram') : 'Ninguém agora'} live />
        <Tile icon={Eye} label={`Abriram (${periodLabel})`} value={fmt(list.length)} sub={`${plural(new Set(list.map((v) => v.visitor ?? v.id)).size, 'pessoa', 'pessoas')}`} />
        <Tile icon={Send} label="Enviaram" value={fmt(submitted)} sub={`${pct(submitted, list.length)} de quem abriu`} />
        {booking && <Tile icon={CalendarCheck} label="Agendaram" value={fmt(scheduled)} sub={`${pct(scheduled, submitted)} de quem enviou`} />}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Surface title={live.length ? `${plural(live.length, 'pessoa', 'pessoas')} agora` : 'No formulário agora'}>
          {live.length ? (
            <ul className="divide-y divide-gray-100">
              {live.map((v) => <VisitRow key={v.id} v={v} form={form} now={now} live />)}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-gray-500">Ninguém com o formulário aberto agora. Quem abrir aparece aqui na hora.</p>
          )}
        </Surface>

        <Surface title={`Funil · ${periodLabel}`}>
          {list.length ? (
            <>
              <Funnel rows={rows} />
              {drop && (
                <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-gray-700">
                  A maior saída é entre <strong className="font-medium">{drop.from.label}</strong> e <strong className="font-medium">{drop.to.label}</strong>
                  {drop.to.hint ? ` (“${drop.to.hint}”)` : ''}: {pct(drop.lost, drop.from.value)} param ali.
                </p>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-gray-500">Ninguém abriu o formulário neste período.</p>
          )}
        </Surface>
      </div>

      {list.length > 0 && (
        <Surface
          title="De onde vêm"
          action={
            <div role="tablist" aria-label="Agrupar por" className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs">
              {(['channel', 'campaign'] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={originKey === k} onClick={() => setOriginKey(k)} className={cn('rounded-md px-2.5 py-1 font-medium', originKey === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
                  {k === 'channel' ? 'Canal' : 'Campanha'}
                </button>
              ))}
            </div>
          }
        >
          {origins.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pb-2 font-medium">{originKey === 'channel' ? 'Canal' : 'Campanha'}</th>
                    <th className="pb-2 text-right font-medium">Abriram</th>
                    <th className="pb-2 text-right font-medium">Começaram</th>
                    <th className="pb-2 text-right font-medium">Enviaram</th>
                    {booking && <th className="pb-2 text-right font-medium">Agendaram</th>}
                    <th className="pb-2 text-right font-medium">Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 tabular-nums">
                  {origins.map((o) => (
                    <tr key={o.label}>
                      <td className="max-w-[240px] truncate py-2 text-gray-900">{o.label}</td>
                      <td className="py-2 text-right">{fmt(o.visits)}</td>
                      <td className="py-2 text-right">{fmt(o.started)}</td>
                      <td className="py-2 text-right">{fmt(o.submitted)}</td>
                      {booking && <td className="py-2 text-right">{fmt(o.scheduled)}</td>}
                      <td className="py-2 text-right font-medium text-gray-900">{pct(o.submitted, o.visits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-500">Nenhuma visita com campanha no link (utm_campaign) neste período.</p>
          )}
        </Surface>
      )}

      {list.length > 0 && (
        <Surface title="Últimas visitas">
          <ul className="divide-y divide-gray-100">
            {list.slice(0, 25).map((v) => <VisitRow key={v.id} v={v} form={form} now={now} live={isLive(v, now)} />)}
          </ul>
        </Surface>
      )}
    </div>
  )
}
