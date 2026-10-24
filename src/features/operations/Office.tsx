import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { agentStatus, useAgents } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'
import { AgentRequest } from './AgentRequest'
import { elapsed, JobFeed, useSeconds } from './JobFeed'
import { AREAS, useJobs, type Area, type Job } from './jobs'

/**
 * O escritório, uma planta de verdade (no estilo de The Office): recepção, sala
 * de reunião, sala do gestor, o salão com uma ilha de mesas por área (Copy,
 * Criativos, Landing pages, Sites) e a copa. Quem tem trabalho senta na mesa,
 * digita com a tela acesa e um balão mostra o passo; quem está livre vai para a
 * copa; o estrategista que planeja uma pasta vai para a sala de reunião. Os
 * trabalhos vêm de `jobs` e os agentes dos projetos, do Space.
 */

interface Seat {
  key: string
  name: string
  role: string
  skin: string
  hair: string
  shirt: string
  job?: Job
  /** Agente do Space (projeto), em vez de job. */
  space?: { project: string; now?: string; since: number; waiting: boolean; href: string }
}

const SKINS = ['#F2C9A5', '#E0A982', '#C68863', '#8D5A3B', '#F6D7BC']
const HAIRS = ['#2B1B12', '#4A2C17', '#111827', '#B5651D', '#6B7280']

const ROSTER: Record<Area, { role: string; name: string; shirt: string; match: (j: Job) => boolean }[]> = {
  criativos: [
    { role: 'Designer', name: 'Dani', shirt: '#7C3AED', match: (j) => j.kind !== 'Imagem' },
    { role: 'Ilustradora', name: 'Lia', shirt: '#EC4899', match: (j) => j.kind === 'Imagem' },
  ],
  copy: [
    { role: 'Pesquisador', name: 'Caio', shirt: '#0EA5E9', match: (j) => /^Pesquisador/.test(j.agent) || j.kind === 'Pesquisa' },
    { role: 'Redator', name: 'Bia', shirt: '#F59E0B', match: (j) => /^Redator/.test(j.agent) },
    { role: 'Editor', name: 'Teo', shirt: '#10B981', match: (j) => /^Editor/.test(j.agent) },
    { role: 'Estrategista', name: 'Nina', shirt: '#EF4444', match: (j) => /^Estrategista/.test(j.agent) },
  ],
  landing: [{ role: 'Redator de LP', name: 'Rafa', shirt: '#6366F1', match: () => true }],
  sites: [{ role: 'Construtor', name: 'Gabi', shirt: '#14B8A6', match: () => true }],
}

const pick = <T,>(list: T[], seed: string) => list[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % list.length]

const CSS = `
@keyframes of-type { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }
@keyframes of-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1.5px) } }
@keyframes of-z { 0% { opacity: 0; transform: translate(0,4px) scale(.7) } 40% { opacity: 1 } 100% { opacity: 0; transform: translate(6px,-12px) scale(1) } }
@keyframes of-glow { 0%,100% { opacity: .75 } 50% { opacity: 1 } }
@keyframes of-pop { from { opacity: 0; transform: translateY(4px) scale(.96) } to { opacity: 1; transform: none } }
.of-work .of-hand-l { animation: of-type .32s ease-in-out infinite }
.of-work .of-hand-r { animation: of-type .32s ease-in-out .16s infinite }
.of-work .of-body { animation: of-bob 1.1s ease-in-out infinite }
.of-work .of-screen { animation: of-glow 1.6s ease-in-out infinite }
.of-z { animation: of-z 2.4s ease-in-out infinite }
.of-z2 { animation: of-z 2.4s ease-in-out 1.2s infinite }
.of-bubble { animation: of-pop .25s ease-out }
.of-walk { transition: left 1.6s cubic-bezier(.4,0,.2,1), top 1.6s cubic-bezier(.4,0,.2,1) }
@media (prefers-reduced-motion: reduce) { .of-work .of-hand-l, .of-work .of-hand-r, .of-work .of-body, .of-work .of-screen, .of-z, .of-z2, .of-bubble { animation: none } .of-walk { transition: none } }
`


const W = 1000
const H = 700

/** As ilhas de mesas do salão, uma por área. */
const PODS: Record<Area, { x: number; y: number; slots: number; rows: number }> = {
  copy: { x: 56, y: 268, slots: 4, rows: 2 },
  criativos: { x: 404, y: 268, slots: 4, rows: 2 },
  landing: { x: 56, y: 498, slots: 2, rows: 1 },
  sites: { x: 404, y: 498, slots: 4, rows: 2 },
}
const slotAt = (area: Area, i: number) => ({ x: PODS[area].x + (i % 2) * 150, y: PODS[area].y + Math.floor(i / 2) * 92 })
/** Onde ficam os livres: a copa. */
const BREAK = [
  { x: 770, y: 290 }, { x: 842, y: 286 }, { x: 912, y: 292 },
  { x: 776, y: 390 }, { x: 912, y: 394 },
  { x: 770, y: 500 }, { x: 842, y: 516 }, { x: 912, y: 500 },
  { x: 800, y: 580 }, { x: 876, y: 584 },
]
/** As cadeiras da sala de reunião (quem planeja uma pasta vai para lá). */
const MEETING = [{ x: 286, y: 78 }, { x: 356, y: 78 }, { x: 426, y: 78 }, { x: 496, y: 78 }]

const Person: React.FC<{ seat: Seat; mode: 'work' | 'idle'; color: string }> = ({ seat, mode, color }) => (
  <svg viewBox="0 0 80 84" className="h-[63px] w-[60px]" aria-hidden>
    <g className="of-body" style={{ transformOrigin: '40px 60px' }}>
      <rect x="20" y="44" width="40" height="34" rx="14" fill={seat.shirt} />
      <rect x="34" y="40" width="12" height="9" rx="3" fill={seat.skin} />
      <circle cx="40" cy="30" r="15" fill={seat.skin} />
      <path d="M25 29c0-11 7-17 15-17s15 6 15 17c-4-5-9-7-15-7s-11 2-15 7z" fill={seat.hair} />
      <circle cx="34.5" cy="31" r="1.7" fill="#1F2937" />
      <circle cx="45.5" cy="31" r="1.7" fill="#1F2937" />
      <path d={mode === 'work' ? 'M36 38c2 1.6 6 1.6 8 0' : 'M35 37c3 3.4 7 3.4 10 0'} stroke="#7C2D12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
    {mode === 'work' ? (
      <g>
        <rect className="of-hand-l" x="22" y="66" width="12" height="7" rx="3.5" fill={seat.skin} />
        <rect className="of-hand-r" x="46" y="66" width="12" height="7" rx="3.5" fill={seat.skin} />
      </g>
    ) : (
      <g>
        <rect x="14" y="56" width="10" height="9" rx="4" fill={seat.skin} />
        <rect x="56" y="54" width="10" height="9" rx="4" fill={seat.skin} />
        <rect x="58" y="46" width="9" height="9" rx="2" fill="#fff" stroke="#9CA3AF" strokeWidth="1" />
      </g>
    )}
    <circle cx="68" cy="12" r="4" fill={color} opacity={mode === 'work' ? 1 : 0.25} />
  </svg>
)

const glass = 'absolute rounded-md border-2 border-sky-300/70 bg-white/40 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.6)]'
const label = 'absolute text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500'

const Plant: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <div aria-hidden className="absolute" style={{ left: x, top: y }}>
    <div className="h-5 w-5 rounded-full bg-emerald-500" style={{ boxShadow: '-5px 4px 0 -1px #10B981, 5px 3px 0 -1px #059669' }} />
    <div className="mx-auto -mt-1 h-3 w-4 rounded-b-md bg-amber-700" />
  </div>
)

const Chair: React.FC<{ x: number; y: number; on?: boolean }> = ({ x, y, on }) => <div aria-hidden className={cn('absolute h-3.5 w-6 rounded-md', on ? 'bg-slate-600' : 'bg-slate-400')} style={{ left: x, top: y }} />

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(1, el.clientWidth / W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className="w-full" style={{ height: H * scale }}>
      <div className="relative origin-top-left overflow-hidden rounded-2xl bg-stone-300 shadow-[0_0_0_1px_rgb(0_0_0/0.1)]" style={{ width: W, height: H, transform: `scale(${scale})` }}>{children}</div>
    </div>
  )
}

export const Office: React.FC = () => {
  const jobs = useJobs((s) => s.jobs)
  const spaceRuns = useAgents((s) => s.agents)
  const running = jobs.filter((j) => j.status === 'running')
  const now = useSeconds(true)
  const [selected, setSelected] = useState<string | null>(null)

  const seats = useMemo(() => {
    const out: (Seat & { area: Area; slot: number })[] = []
    ;(Object.keys(AREAS) as Area[]).forEach((area) => {
      const roster = ROSTER[area]
      const mine = running.filter((j) => j.area === area)
      const used = new Set<string>()
      const list: Seat[] = roster.map((r, i) => {
        const job = mine.find((j) => !used.has(j.id) && r.match(j))
        if (job) used.add(job.id)
        return { key: `${area}:${r.role}`, name: r.name, role: r.role, skin: pick(SKINS, r.name + i), hair: pick(HAIRS, r.name), shirt: r.shirt, job }
      })
      mine.filter((j) => !used.has(j.id)).forEach((job, i) => list.push({ key: `${area}:extra:${job.id}`, name: `Reforço ${i + 1}`, role: job.agent.split(' · ')[0], skin: pick(SKINS, job.id), hair: pick(HAIRS, job.id), shirt: '#64748B', job }))
      if (area === 'sites') {
        spaceRuns.filter((a) => ['working', 'question'].includes(agentStatus(a, now))).forEach((a, i) =>
          list.push({ key: `space:${a.key}`, name: a.agent.split(' ')[0] || 'Agente', role: 'no projeto', skin: pick(SKINS, a.key + i), hair: pick(HAIRS, a.key), shirt: '#F97316', space: { project: a.projectName ?? 'Projeto', now: a.now, since: a.startedAt, waiting: a.state === 'question', href: `/projetos/${a.projectId}` } })
        )
      }
      list.forEach((s, slot) => out.push({ ...s, area, slot }))
    })
    return out
  }, [running, spaceRuns, now])

  // Onde cada um está: na mesa (trabalhando), na reunião (planejando a pasta) ou na copa (livre)
  const placed = useMemo(() => {
    let rest = 0
    let meeting = 0
    return seats.map((s) => {
      const working = !!s.job || !!s.space
      if (s.job?.kind === 'Pasta' && meeting < MEETING.length) return { s, at: MEETING[meeting++], where: 'meeting' as const, working }
      if (working && s.slot < PODS[s.area].slots) return { s, at: slotAt(s.area, s.slot), where: 'desk' as const, working }
      if (working) return { s, at: BREAK[(rest++ + 4) % BREAK.length], where: 'break' as const, working }
      return { s, at: BREAK[rest++ % BREAK.length], where: 'break' as const, working }
    })
  }, [seats])

  const picked = placed.find((p) => p.s.key === selected)?.s
  const total = placed.filter((p) => p.working).length
  const asking = spaceRuns.filter((a) => agentStatus(a, now) === 'question').length
  const finishedToday = jobs.filter((j) => j.status === 'done' && j.endedAt && now - j.endedAt < 86_400_000).length
  const seatBusy = (area: Area, slot: number) => placed.some((p) => p.where === 'desk' && p.s.area === area && p.s.slot === slot)

  return (
    <section aria-label="Escritório">
      <style>{CSS}</style>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Escritório</h2>
        <p className="text-xs text-gray-500">{total > 0 ? `${total} ${total === 1 ? 'agente trabalhando' : 'agentes trabalhando'} agora` : 'Todos na copa: nenhum trabalho agora'}</p>
      </div>
      <div className="mt-3">
        <Stage>
          {/* piso do salão e da copa */}
          <div aria-hidden className="absolute inset-0" style={{ background: 'repeating-linear-gradient(90deg,#E7E1D6 0 2px,transparent 2px 40px),repeating-linear-gradient(0deg,#E7E1D6 0 2px,transparent 2px 40px),#F1ECE2' }} />
          <div aria-hidden className="absolute rounded-lg bg-slate-300/70" style={{ left: 20, top: 196, width: 704, height: 484 }} />
          <div aria-hidden className="absolute rounded-lg bg-amber-100/80" style={{ left: 744, top: 196, width: 236, height: 484 }} />
          {(Object.keys(AREAS) as Area[]).map((a) => (
            <div key={a} aria-hidden className="absolute rounded-xl bg-white/45 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]" style={{ left: PODS[a].x - 20, top: PODS[a].y - 60, width: 316, height: PODS[a].rows === 2 ? 230 : 140 }}>
              <span className={label} style={{ left: 14, top: 8 }}>{AREAS[a].label}</span>
              <span className="absolute text-[9px] text-slate-400" style={{ left: 14, top: 22 }}>{AREAS[a].hint}</span>
            </div>
          ))}

          {/* recepção */}
          <div className={cn(glass, 'border-stone-400/70 bg-orange-50/70')} style={{ left: 20, top: 20, width: 200, height: 156 }}>
            <span className={label} style={{ left: 10, top: 8 }}>Recepção</span>
            <div className="absolute rounded-lg bg-amber-800/90" style={{ left: 28, top: 76, width: 144, height: 34 }} />
            <div className="absolute rounded-md bg-slate-800 p-1.5 text-center" style={{ left: 46, top: 92, width: 108, height: 54 }}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-sky-300">Avence Studio</p>
              <p className="text-[11px] font-semibold tabular-nums text-white">{total} trabalhando</p>
              <p className="text-[9px] tabular-nums text-slate-300">{finishedToday} prontos hoje</p>
            </div>
            <Plant x={166} y={106} />
            <Plant x={14} y={30} />
          </div>

          {/* sala de reunião */}
          <div className={glass} style={{ left: 240, top: 20, width: 320, height: 156 }}>
            <span className={label} style={{ left: 10, top: 8 }}>Sala de reunião</span>
            <div className="absolute rounded-xl bg-amber-900/85 shadow-[inset_0_2px_0_rgb(255_255_255/0.2)]" style={{ left: 28, top: 82, width: 264, height: 50 }} />
            <div className="absolute right-3 top-8 h-12 w-1.5 rounded bg-slate-700" />
          </div>

          {/* sala do gestor */}
          <div className={glass} style={{ left: 780, top: 20, width: 200, height: 156 }}>
            <span className={label} style={{ left: 10, top: 8 }}>Sala do gestor</span>
            <div className="absolute rounded-lg bg-stone-700" style={{ left: 40, top: 86, width: 120, height: 34 }} />
            <div className="absolute rounded bg-slate-800" style={{ left: 82, top: 70, width: 36, height: 18 }}><div className="h-full w-full rounded-sm" style={{ background: asking ? '#8B5CF6' : '#1E293B' }} /></div>
            <div className="absolute flex flex-col items-center" style={{ left: 70, top: 18 }}>
              <svg viewBox="0 0 80 84" className="h-[56px] w-[54px]" aria-hidden><rect x="20" y="44" width="40" height="34" rx="14" fill="#111827" /><rect x="34" y="40" width="12" height="9" rx="3" fill="#E0A982" /><circle cx="40" cy="30" r="15" fill="#E0A982" /><path d="M25 29c0-11 7-17 15-17s15 6 15 17c-4-5-9-7-15-7s-11 2-15 7z" fill="#2B1B12" /><circle cx="34.5" cy="31" r="1.7" fill="#1F2937" /><circle cx="45.5" cy="31" r="1.7" fill="#1F2937" /><path d="M36 38c2 1.6 6 1.6 8 0" stroke="#7C2D12" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
            </div>
            <p className="absolute w-full text-center text-[10px] font-semibold text-slate-700" style={{ top: 126 }}>Você {asking > 0 && <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-white">{asking} esperando</span>}</p>
            <Plant x={168} y={104} />
          </div>

          {/* salão: mesas de cada área */}
          {(Object.keys(AREAS) as Area[]).flatMap((a) =>
            Array.from({ length: PODS[a].slots }, (_, i) => {
              const p = slotAt(a, i)
              const busy = seatBusy(a, i)
              const job = placed.find((x) => x.where === 'desk' && x.s.area === a && x.s.slot === i)?.s
              const color = job?.job?.color ?? (job?.space ? '#F97316' : '#64748B')
              return (
                <div key={`${a}${i}`} aria-hidden className="absolute" style={{ left: p.x, top: p.y }}>
                  <Chair x={32} y={46} on={busy} />
                  <div className="absolute rounded-lg bg-amber-800/90 shadow-[inset_0_2px_0_rgb(255_255_255/0.25)]" style={{ left: 0, top: 44, width: 90, height: 28 }} />
                  <div className="absolute rounded-[3px] bg-slate-700 p-[2px]" style={{ left: 25, top: 30, width: 40, height: 22 }}>
                    <div className={cn('h-full w-full rounded-[2px]', busy && 'of-screen')} style={{ background: busy ? `linear-gradient(135deg, ${color}, ${color}88)` : '#0F172A' }} />
                  </div>
                  <div className="absolute rounded-[2px] bg-slate-200" style={{ left: 30, top: 62, width: 30, height: 5 }} />
                </div>
              )
            })
          )}

          {/* copa */}
          <span className={label} style={{ left: 764, top: 210 }}>Copa</span>
          <div aria-hidden className="absolute rounded-md bg-slate-700" style={{ left: 764, top: 232, width: 46, height: 22 }} />
          <div aria-hidden className="absolute rounded-md bg-slate-100 shadow-[0_0_0_1px_rgb(0_0_0/0.15)]" style={{ left: 930, top: 230, width: 36, height: 64 }} />
          <div aria-hidden className="absolute rounded-full bg-amber-800/80 shadow-[inset_0_2px_0_rgb(255_255_255/0.2)]" style={{ left: 812, top: 410, width: 100, height: 56 }} />
          <div aria-hidden className="absolute rounded-xl bg-rose-300/80" style={{ left: 760, top: 632, width: 150, height: 26 }} />
          <Plant x={950} y={630} />
          <Plant x={728} y={630} />

          {/* as pessoas */}
          {placed.map(({ s, at, where, working }) => {
            const bubble = s.job ? s.job.step : s.space ? (s.space.waiting ? 'Esperando você' : s.space.now ?? 'Montando a página') : ''
            const color = s.job?.color ?? '#F97316'
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelected(selected === s.key ? null : s.key)}
                aria-pressed={selected === s.key}
                aria-label={`${s.name}, ${s.role}: ${working ? `trabalhando em ${s.job ? `${s.job.kind} ${s.job.label}` : s.space?.project}` : 'livre, na copa'}`}
                className={cn('of-walk absolute flex w-[84px] translate-x-[3px] flex-col items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500', working && 'of-work', selected === s.key && 'bg-white/60')}
                style={{ left: at.x, top: at.y - (where === 'desk' ? 4 : 0), zIndex: Math.round(at.y) + 10 }}
              >
                {working && <span key={bubble} className="of-bubble absolute -top-6 max-w-[150px] truncate whitespace-nowrap rounded-lg bg-white px-2 py-0.5 text-[10px] font-medium text-gray-800 shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_2px_6px_-2px_rgb(0_0_0/0.2)]">{bubble}</span>}
                <Person seat={s} mode={working ? 'work' : 'idle'} color={color} />
                <span className="-mt-0.5 whitespace-nowrap rounded bg-white/85 px-1 text-[10px] font-semibold leading-4 text-gray-900">{s.name}</span>
              </button>
            )
          })}
        </Stage>
      </div>

      {picked && (
        <div className="mt-3 rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{picked.name} <span className="font-normal text-gray-500">· {picked.role}</span></p>
            {(picked.job?.href || picked.space?.href) && <Link to={(picked.job?.href ?? picked.space?.href)!} className="ml-auto text-xs font-medium text-violet-700 underline-offset-2 hover:underline">Abrir o trabalho</Link>}
          </div>
          {picked.job ? (
            <>
              <p className="mt-1 text-xs text-gray-600">{picked.job.kind} · {picked.job.label} · {elapsed(picked.job.startedAt, now)}</p>
              <JobFeed job={picked.job} lines={8} className="mt-2" />
            </>
          ) : picked.space ? (
            <p className="mt-1 text-xs text-gray-600">{picked.space.project}: {picked.space.waiting ? 'esperando a sua resposta' : picked.space.now ?? 'montando a página'}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">Na copa, livre. Peça algo abaixo e ele vai para a mesa.</p>
          )}
          {!picked.space && !picked.job && !picked.key.includes(':extra:') && <AgentRequest who={{ area: picked.key.split(':')[0] as Area, role: picked.role, name: picked.name }} />}
        </div>
      )}
    </section>
  )
}
