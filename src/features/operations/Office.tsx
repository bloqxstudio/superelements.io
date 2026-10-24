import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Coffee, Flower2 } from 'lucide-react'
import { agentStatus, useAgents } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'
import { elapsed, JobFeed, useSeconds } from './JobFeed'
import { AREAS, useJobs, type Area, type Job } from './jobs'

/**
 * O escritório: uma planta com uma sala por área (Criativos, Copy, Landing
 * pages, Sites). Cada agente tem a sua mesa: trabalhando, digita com a tela
 * acesa e um balão com o que está fazendo; sem trabalho, cochila. Os trabalhos
 * vêm de `jobs` e os agentes dos projetos, do Space.
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
@media (prefers-reduced-motion: reduce) { .of-work .of-hand-l, .of-work .of-hand-r, .of-work .of-body, .of-work .of-screen, .of-z, .of-z2, .of-bubble { animation: none } .of-z, .of-z2 { opacity: .8 } }
`

const Person: React.FC<{ seat: Seat; working: boolean; color: string }> = ({ seat, working, color }) => (
  <svg viewBox="0 0 80 84" className="h-[92px] w-[88px]" aria-hidden>
    <g className="of-body" style={{ transformOrigin: '40px 60px' }}>
      <rect x="20" y="44" width="40" height="34" rx="14" fill={seat.shirt} />
      <rect x="34" y="40" width="12" height="9" rx="3" fill={seat.skin} />
      <circle cx="40" cy="30" r="15" fill={seat.skin} />
      <path d="M25 29c0-11 7-17 15-17s15 6 15 17c-4-5-9-7-15-7s-11 2-15 7z" fill={seat.hair} />
      {working ? (
        <>
          <circle cx="34.5" cy="31" r="1.7" fill="#1F2937" />
          <circle cx="45.5" cy="31" r="1.7" fill="#1F2937" />
          <path d="M36 38c2 1.6 6 1.6 8 0" stroke="#7C2D12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M32.5 31.5c1.5 1.2 3.5 1.2 5 0M42.5 31.5c1.5 1.2 3.5 1.2 5 0" stroke="#1F2937" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="40" cy="39" r="1.6" fill="#7C2D12" opacity=".7" />
        </>
      )}
    </g>
    <g>
      <rect className="of-hand-l" x="22" y="66" width="12" height="7" rx="3.5" fill={seat.skin} />
      <rect className="of-hand-r" x="46" y="66" width="12" height="7" rx="3.5" fill={seat.skin} />
    </g>
    <circle cx="68" cy="14" r="4" fill={color} opacity={working ? 1 : 0.25} />
  </svg>
)

const Desk: React.FC<{ seat: Seat; now: number; selected: boolean; onSelect: () => void }> = ({ seat, now, selected, onSelect }) => {
  const working = !!seat.job || !!seat.space
  const color = seat.job?.color ?? '#F97316'
  const since = seat.job?.startedAt ?? seat.space?.since ?? now
  const bubble = seat.job ? seat.job.step : seat.space ? (seat.space.waiting ? 'Esperando você' : seat.space.now ?? 'Montando a página') : ''
  const what = seat.job ? `${seat.job.kind} · ${seat.job.label}` : seat.space?.project ?? ''
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`${seat.name}, ${seat.role}: ${working ? `trabalhando em ${what}` : 'livre'}`} className={cn('group relative flex w-[122px] flex-col items-center rounded-xl px-0.5 pb-1 pt-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500', selected ? 'bg-white/70' : 'hover:bg-white/40', working ? 'of-work' : '')}>
      <div className="relative flex h-[34px] w-full items-end justify-center">
        {working ? (
          <span key={bubble} className="of-bubble absolute bottom-0 max-w-[122px] truncate rounded-lg bg-white px-2 py-1 text-[10px] font-medium leading-tight text-gray-800 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_2px_6px_-2px_rgb(0_0_0/0.18)]">{bubble}</span>
        ) : (
          <span className="absolute bottom-1 right-5 text-[11px] font-bold text-sky-500"><span className="of-z inline-block">z</span><span className="of-z2 ml-0.5 inline-block text-[9px]">z</span></span>
        )}
      </div>
      <div className="relative -mb-3 flex justify-center">
        <Person seat={seat} working={working} color={color} />
      </div>
      {/* a mesa, o monitor e o teclado */}
      <div className="relative z-10 h-[42px] w-[120px]">
        <div className="absolute left-1/2 top-0 h-[22px] w-[52px] -translate-x-1/2 rounded-[4px] bg-slate-700 p-[2px]">
          <div className="of-screen h-full w-full rounded-[2px]" style={{ background: working ? `linear-gradient(135deg, ${color}, ${color}99)` : '#0F172A' }} />
        </div>
        <div className="absolute left-1/2 top-[22px] h-[4px] w-[10px] -translate-x-1/2 bg-slate-600" />
        <div className="absolute inset-x-0 bottom-0 h-[18px] rounded-lg bg-amber-800/90 shadow-[inset_0_2px_0_rgb(255_255_255/0.25)]" />
        <div className="absolute bottom-[4px] left-1/2 h-[5px] w-[34px] -translate-x-1/2 rounded-[2px] bg-slate-200/90" />
        <div className="absolute bottom-[3px] right-3 h-[7px] w-[7px] rounded-b-md rounded-t-sm bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.15)]" />
      </div>
      <p className="mt-1 truncate text-xs font-semibold text-gray-900">{seat.name} <span className="font-normal text-gray-500">· {seat.role}</span></p>
      <p className="h-4 max-w-full truncate text-[10px] text-gray-500">{working ? `${what} · ${elapsed(since, now)}` : 'livre'}</p>
    </button>
  )
}

const FLOOR: Record<Area, string> = {
  criativos: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)',
  copy: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
  landing: 'linear-gradient(135deg,#EEF2FF,#E0E7FF)',
  sites: 'linear-gradient(135deg,#F0FDFA,#CCFBF1)',
}

export const Office: React.FC = () => {
  const jobs = useJobs((s) => s.jobs)
  const spaceRuns = useAgents((s) => s.agents)
  const running = jobs.filter((j) => j.status === 'running')
  const now = useSeconds(true)
  const [selected, setSelected] = useState<string | null>(null)

  const rooms = useMemo(() => {
    return (Object.keys(AREAS) as Area[]).map((area) => {
      const roster = ROSTER[area]
      const mine = running.filter((j) => j.area === area)
      const used = new Set<string>()
      const seats: Seat[] = roster.map((r, i) => {
        const job = mine.find((j) => !used.has(j.id) && r.match(j))
        if (job) used.add(job.id)
        return { key: `${area}:${r.role}`, name: r.name, role: r.role, skin: pick(SKINS, r.name + i), hair: pick(HAIRS, r.name), shirt: r.shirt, job }
      })
      // Quem sobrou ganha uma mesa extra (dois trabalhos do mesmo papel ao mesmo tempo)
      mine.filter((j) => !used.has(j.id)).forEach((job, i) => seats.push({ key: `${area}:extra:${job.id}`, name: `Reforço ${i + 1}`, role: job.agent.split(' · ')[0], skin: pick(SKINS, job.id), hair: pick(HAIRS, job.id), shirt: '#64748B', job }))
      if (area === 'sites') {
        spaceRuns.filter((a) => ['working', 'question'].includes(agentStatus(a, now))).forEach((a, i) =>
          seats.push({ key: `space:${a.key}`, name: a.agent.split(' ')[0] || 'Agente', role: 'no projeto', skin: pick(SKINS, a.key + i), hair: pick(HAIRS, a.key), shirt: '#F97316', space: { project: a.projectName ?? 'Projeto', now: a.now, since: a.startedAt, waiting: a.state === 'question', href: `/projetos/${a.projectId}` } })
        )
      }
      return { area, seats, working: seats.filter((s) => s.job || s.space).length }
    })
  }, [running, spaceRuns, now])

  const picked = rooms.flatMap((r) => r.seats).find((s) => s.key === selected)
  const total = rooms.reduce((n, r) => n + r.working, 0)

  return (
    <section aria-label="Escritório">
      <style>{CSS}</style>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Escritório</h2>
        <p className="text-xs text-gray-500">{total > 0 ? `${total} ${total === 1 ? 'agente trabalhando' : 'agentes trabalhando'} agora` : 'Todos livres no momento'}</p>
      </div>
      <div className="mt-3 rounded-2xl bg-stone-200 p-2.5 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] sm:p-3">
        <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">
          {rooms.map(({ area, seats, working }) => (
            <div key={area} className="relative overflow-hidden rounded-xl p-3 pb-2 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: FLOOR[area] }}>
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'linear-gradient(rgb(0 0 0 / .05) 1px, transparent 1px), linear-gradient(90deg, rgb(0 0 0 / .05) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
              <div className="relative flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', working ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-gray-300')} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{AREAS[area].label}</h3>
                <span className="text-[11px] text-gray-500">{working > 0 ? `${working} em produção` : AREAS[area].hint}</span>
                <span className="ml-auto flex gap-1.5 text-gray-400" aria-hidden>{area === 'copy' ? <Coffee className="h-4 w-4" /> : <Flower2 className="h-4 w-4" />}</span>
              </div>
              <div className="relative mt-1 flex flex-wrap justify-center gap-x-0 gap-y-2">
                {seats.map((seat) => (
                  <Desk key={seat.key} seat={seat} now={now} selected={selected === seat.key} onSelect={() => setSelected(selected === seat.key ? null : seat.key)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {picked && (
        <div className="mt-3 rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{picked.name} <span className="font-normal text-gray-500">· {picked.role}</span></p>
            {(picked.job?.href || picked.space?.href) && <Link to={(picked.job?.href ?? picked.space?.href)!} className="ml-auto text-xs font-medium text-violet-700 underline-offset-2 hover:underline">Abrir o trabalho</Link>}
          </div>
          {picked.job ? <JobFeed job={picked.job} lines={8} className="mt-2" /> : picked.space ? <p className="mt-1 text-xs text-gray-600">{picked.space.project}: {picked.space.waiting ? 'esperando a sua resposta' : picked.space.now ?? 'montando a página'}</p> : <p className="mt-1 text-xs text-gray-500">Livre agora. Peça algo na área {AREAS[picked.key.split(':')[0] as Area]?.label ?? ''} e ele começa.</p>}
        </div>
      )}
    </section>
  )
}
