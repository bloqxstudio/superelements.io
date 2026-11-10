import { useMemo, useState } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/features/crm/ui'
import type { IgMedia } from '@/features/crm/instagram'
import { useIara } from '@/features/iara/store'
import { cn } from '@/lib/utils'
import { auditPosts, type AuditRow } from './auditoria.ts'

/**
 * "O que funcionou" na Análise do Instagram (o `/ig-audit` do instagram-agent-skill): os posts
 * reais da conta ordenados pelo múltiplo sobre a mediana, com envios e salvos a cada mil de
 * alcance, os achados e o que parar e fazer mais. Sem IA; "Pedir à Iara" abre o chat com o
 * pedido escrito (skill Instagram · O que funcionou).
 */

const PERIODS = [30, 90, 180] as const
const br = (n: number | undefined, digits = 1) => (n === undefined ? '—' : n.toFixed(digits).replace('.', ',').replace(/,0$/, ''))
const CONF = { alta: 'text-emerald-700', média: 'text-amber-700', baixa: 'text-gray-500' } as const

const askIara = (text: string) => {
  useIara.setState({ open: true })
  for (const ms of [0, 300]) setTimeout(() => window.dispatchEvent(new CustomEvent('iara:draft', { detail: text })), ms)
}

const Row = ({ r }: { r: AuditRow }) => (
  <li className="flex items-start gap-3 py-2 text-xs">
    <span className={cn('w-12 shrink-0 text-sm font-semibold tabular-nums', r.multiplo >= 1.5 ? 'text-emerald-600' : r.multiplo < 0.7 ? 'text-rose-600' : 'text-gray-700')}>{br(r.multiplo)}x</span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-gray-900" title={r.primeira_linha}>{r.primeira_linha || '(sem legenda)'}</p>
      <p className="mt-0.5 text-gray-500">
        {r.data} · {r.formato} · {r.views.toLocaleString('pt-BR')} views · {br(r.envios_mil)} envios e {br(r.salvos_mil)} salvos /mil
        {r.assistido_s !== undefined ? ` · ${br(r.assistido_s)} s assistidos` : ''}
        {r.formula ? ` · #${r.formula.id} ${r.formula.nome}` : ''}
      </p>
    </div>
    {r.link && (
      <a href={r.link} target="_blank" rel="noreferrer" className="mt-0.5 text-gray-400 hover:text-gray-700" aria-label="Abrir no Instagram">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    )}
  </li>
)

export function WhatWorked({ media }: { media: IgMedia[] }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(90)
  const audit = useMemo(() => auditPosts(media, { dias: days }), [media, days])

  return (
    <Surface
      title="O que funcionou"
      action={
        <div className="flex items-center gap-1">
          {PERIODS.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={cn('rounded-md px-2 py-0.5 text-xs', d === days ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
              {d} dias
            </button>
          ))}
        </div>
      }
    >
      {!audit ? (
        <p className="text-sm text-gray-500">Sem posts com números nos últimos {days} dias.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            {audit.n} posts de {audit.periodo} · mediana de {audit.mediana_views.toLocaleString('pt-BR')} views. Ordem pelo múltiplo sobre a {audit.base}, não por views: um post pequeno que rodou 5x diz mais que um grande num dia normal.
          </p>

          <ul className="space-y-1.5">
            {audit.achados.map((a, i) => (
              <li key={i} className="text-sm text-gray-800">
                {a.texto} <span className={cn('text-xs', CONF[a.confianca])}>confiança {a.confianca}</span>
              </li>
            ))}
            {audit.parar && (
              <li className="text-sm">
                <b className="text-rose-700">Pare:</b> {audit.parar}
              </li>
            )}
            {audit.fazer_mais && (
              <li className="text-sm">
                <b className="text-emerald-700">Faça mais:</b> {audit.fazer_mais}
              </li>
            )}
          </ul>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Acima da curva</h3>
              <ul className="divide-y divide-gray-100">{audit.topo.map((r) => <Row key={r.id} r={r} />)}</ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Abaixo</h3>
              <ul className="divide-y divide-gray-100">{audit.baixo.map((r) => <Row key={r.id} r={r} />)}</ul>
            </div>
          </div>

          {audit.por_formato.length > 1 && (
            <p className="text-xs text-gray-600">
              {audit.por_formato.map((f) => `${f.formato}: ${br(f.multiplo_medio)}x (${f.posts})`).join(' · ')}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => askIara(`Instagram · O que funcionou: leia os últimos ${days} dias, diga o padrão com a confiança, o que parar e o que fazer mais, e monte a próxima semana a partir disso.`)}>
              <Sparkles className="h-3.5 w-3.5 text-violet-600" /> Pedir à Iara
            </Button>
            <p className="text-[11px] text-gray-500">{audit.aviso}</p>
          </div>
        </div>
      )}
    </Surface>
  )
}
