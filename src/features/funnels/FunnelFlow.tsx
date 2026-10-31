import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { STAGES, STAGE_LABEL, type Stage } from '@/features/prospects/funnel'
import { cn } from '@/lib/utils'
import type { OppLite } from './rules'

/**
 * Jornada: por onde as oportunidades do funil realmente passaram, lido do histórico de estados
 * (`history`). Cada faixa é a quantidade de oportunidades que foram de um estado a outro; um salto
 * (A → C sem passar por B) aparece como salto. Nada é estimado: só vale o que o CRM registrou.
 */

const nf = new Intl.NumberFormat('pt-BR')
const ORDER = STAGES.map((s) => s.id) as string[]
const label = (s: string) => STAGE_LABEL[s as Stage] ?? s

/** A sequência de estados de uma oportunidade, em ordem de tempo, sem repetir o mesmo seguido. */
export function journeyOf(o: Pick<OppLite, 'stage' | 'history'>): string[] {
  const seq = [...o.history].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map((h) => h.stage as string)
  if (seq[seq.length - 1] !== o.stage) seq.push(o.stage)
  return seq.filter((s, i) => s !== seq[i - 1])
}

const COL_W = 210
const NODE_W = 22
const TOP = 58
const AREA = 250

export const FunnelFlow: React.FC<{ cohort: OppLite[] }> = ({ cohort }) => {
  const [hover, setHover] = useState<string>()

  const data = useMemo(() => {
    const through = new Map<string, number>()
    const now = new Map<string, number>()
    const links = new Map<string, number>()
    const paths = new Map<string, number>()
    for (const o of cohort) {
      const seq = journeyOf(o)
      for (const s of new Set(seq)) through.set(s, (through.get(s) ?? 0) + 1)
      now.set(o.stage, (now.get(o.stage) ?? 0) + 1)
      for (let i = 1; i < seq.length; i++) links.set(`${seq[i - 1]}>${seq[i]}`, (links.get(`${seq[i - 1]}>${seq[i]}`) ?? 0) + 1)
      const key = seq.map(label).join(' → ')
      paths.set(key, (paths.get(key) ?? 0) + 1)
    }
    // Do primeiro estado com gente até o fechamento: etapas vazias no meio aparecem com zero, para o caminho ficar inteiro
    const present = ORDER.map((s, i) => (through.has(s) ? i : -1)).filter((i) => i >= 0)
    const from = present.length ? present[0] : 0
    const to = Math.max(present.length ? present[present.length - 1] : 0, ORDER.indexOf('fechado'))
    const stages = ORDER.slice(from, to + 1).filter((s) => s !== 'perdido')
    if (through.has('perdido')) stages.push('perdido')
    return { through, now, links, stages, paths: [...paths.entries()].sort((a, b) => b[1] - a[1]) }
  }, [cohort])

  if (!cohort.length) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">Este funil não tem oportunidades no período para desenhar a jornada. Ela precisa de uma etapa de oportunidades com fonte.</p>
  }

  const { through, now, links, stages } = data
  const max = Math.max(...through.values())
  // Raiz quadrada: um estado com 150 não esmaga os que têm 1 ou 2. A altura é só visual; os números estão escritos.
  const heightOf = (n: number) => (n > 0 ? Math.max(16, Math.sqrt(n / max) * (AREA - 20)) : 4)
  const width = stages.length * COL_W
  const height = TOP + AREA + 16

  const node = new Map<string, { x: number; y: number; h: number; out: number; inn: number }>()
  stages.forEach((s, i) => {
    const h = heightOf(through.get(s) ?? 0)
    node.set(s, { x: 8 + i * COL_W, y: TOP + (AREA - h) / 2, h, out: 0, inn: 0 })
  })
  const sorted = [...links.entries()]
    .map(([k, n]) => ({ k, n, from: k.split('>')[0], to: k.split('>')[1] }))
    .filter((l) => node.has(l.from) && node.has(l.to))
    .sort((a, b) => stages.indexOf(a.to) - stages.indexOf(b.to) || stages.indexOf(a.from) - stages.indexOf(b.from))
  const ribbons = sorted.map((l) => {
    const a = node.get(l.from)!
    const b = node.get(l.to)!
    // A faixa ocupa em cada ponta a fatia do nó que lhe cabe
    const wa = Math.max(2.5, a.h * (l.n / (through.get(l.from) || 1)))
    const wb = Math.max(2.5, b.h * (l.n / (through.get(l.to) || 1)))
    const ya = a.y + a.out
    const yb = b.y + b.inn
    a.out += wa
    b.inn += wb
    const x1 = a.x + NODE_W
    const x2 = b.x
    const mx = (x1 + x2) / 2
    const d = `M${x1},${ya} C${mx},${ya} ${mx},${yb} ${x2},${yb} L${x2},${yb + wb} C${mx},${yb + wb} ${mx},${ya + wa} ${x1},${ya + wa} Z`
    return { ...l, d, lost: l.to === 'perdido' }
  })

  return (
    <div className="grid gap-4">
      <div className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Jornada das oportunidades entre os estados do CRM. A lista abaixo traz os mesmos números em texto." className="block h-auto w-full" style={{ minWidth: Math.min(width, 640) }}>
          {stages.map((s, i) => (
            <line key={s} x1={8 + i * COL_W + NODE_W / 2} x2={8 + i * COL_W + NODE_W / 2} y1={TOP} y2={TOP + AREA} stroke="#e5e7eb" strokeDasharray="3 5" />
          ))}
          {ribbons.map((r) => (
            <path
              key={r.k}
              d={r.d}
              fill={r.lost ? '#f43f5e' : '#8b5cf6'}
              opacity={hover ? (hover === r.k ? 0.75 : 0.12) : 0.35}
              onMouseEnter={() => setHover(r.k)}
              onMouseLeave={() => setHover(undefined)}
            >
              <title>{`${label(r.from)} → ${label(r.to)}: ${nf.format(r.n)}`}</title>
            </path>
          ))}
          {stages.map((s) => {
            const n = node.get(s)!
            const total = through.get(s) ?? 0
            const lost = s === 'perdido'
            const won = s === 'fechado'
            return (
              <g key={s}>
                <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx={4} fill={total === 0 ? '#d1d5db' : lost ? '#e11d48' : won ? '#059669' : '#4c1d95'} />
                <text x={n.x} y={TOP - 34} className="fill-gray-900 text-[13px] font-semibold">
                  {label(s)}
                </text>
                <text x={n.x} y={TOP - 18} className="fill-gray-600 text-[12px] tabular-nums">
                  {nf.format(total)} {total === 1 ? 'passou' : 'passaram'}
                </text>
                <text x={n.x} y={TOP - 4} className="fill-gray-400 text-[11px] tabular-nums">
                  agora: {nf.format(now.get(s) ?? 0)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-label="Caminhos mais comuns" className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          <h3 className="text-sm font-semibold text-gray-900">Caminhos mais comuns</h3>
          <ol className="mt-2 grid gap-1.5">
            {data.paths.slice(0, 6).map(([path, n]) => (
              <li key={path} className={cn('flex items-baseline justify-between gap-3 text-sm', path.endsWith('Perdido') && 'text-rose-800')}>
                <span className="min-w-0 [overflow-wrap:anywhere]">{path}</span>
                <span className="shrink-0 font-semibold tabular-nums">{nf.format(n)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-label="Passagens entre estados" className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          <h3 className="text-sm font-semibold text-gray-900">Passagens entre estados</h3>
          <ul className="mt-2 grid gap-1.5">
            {[...sorted].sort((a, b) => b.n - a.n).slice(0, 8).map((l) => (
              <li key={l.k} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {label(l.from)} → {label(l.to)}
                </span>
                <span className="font-semibold tabular-nums">{nf.format(l.n)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="text-xs text-gray-500">
        A altura das barras usa escala suave (raiz quadrada) para os estados pequenos aparecerem; os números escritos são os reais. Lido do histórico de estados do CRM; saltos (de um estado para outro mais adiante) aparecem como saltos. <Link to="/crm" className="font-medium text-violet-700 hover:underline">Abrir Oportunidades</Link>
      </p>
    </div>
  )
}
