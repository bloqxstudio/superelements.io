import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleAlert, Eye, Maximize2, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { agentStatus, useAgents } from '@/features/space/bridge/agentsStore'
import { cn } from '@/lib/utils'
import { AgentRequest } from './AgentRequest'
import { openPreview } from './Preview'
import { elapsed, JobFeed, useSeconds } from './JobFeed'
import { profileOfBase, useProfileList } from '@/features/ia/perfis'
import { AREAS, stopJob, useJobs, type Area, type Job } from './jobs'

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
  /** O cargo de fábrica: o que o escritório usa para achar o agente, mesmo que o perfil mude o nome do cargo. */
  base: string
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
  comercial: [
    { role: 'Prospector', name: 'Léo', shirt: '#0891B2', match: (j) => /^Prospector/.test(j.agent) },
    { role: 'Redator de abordagem', name: 'Duda', shirt: '#DB2777', match: (j) => /^Redator de abordagem/.test(j.agent) },
    { role: 'Analista de funil', name: 'Ana', shirt: '#65A30D', match: (j) => /^Analista de funil/.test(j.agent) },
  ],
  sites: [{ role: 'Construtor', name: 'Gabi', shirt: '#14B8A6', match: () => true }],
}

const pick = <T,>(list: T[], seed: string) => list[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % list.length]

const CSS = `
@keyframes of-type { 0%,100% { transform: translateY(0) } 50% { transform: translateY(3px) } }
@keyframes of-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1px) } }
@keyframes of-glow { 0%,100% { opacity: .5 } 50% { opacity: .9 } }
@keyframes of-pop { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
@keyframes of-ring { 0% { transform: scale(.85); opacity: .7 } 100% { transform: scale(1.25); opacity: 0 } }
.of-work .of-hand-l { animation: of-type .3s ease-in-out infinite }
.of-work .of-hand-r { animation: of-type .3s ease-in-out .15s infinite }
.of-screen { animation: of-glow 1.6s ease-in-out infinite }
.of-ring { animation: of-ring 1.8s ease-out infinite; transform-box: fill-box; transform-origin: center }
.of-bubble { animation: of-pop .25s ease-out }
.of-walk { transition: transform 1.6s cubic-bezier(.4,0,.2,1) }
.of-chip { transition: transform 1.6s cubic-bezier(.4,0,.2,1) }
@media (prefers-reduced-motion: reduce) { .of-work .of-hand-l, .of-work .of-hand-r, .of-screen, .of-ring, .of-bubble { animation: none } .of-walk, .of-chip { transition: none } }
`


const W = 1200
const H = 680

/** As ilhas de mesas do salão, uma por área: duas fileiras de mesas frente a frente, como no escritório da série. */
const PODS: Record<Area, { x: number; y: number; slots: number; rows: number; cols?: number }> = {
  criativos: { x: 330, y: 250, slots: 4, rows: 2 },
  sites: { x: 620, y: 250, slots: 4, rows: 2 },
  copy: { x: 210, y: 440, slots: 4, rows: 2 },
  comercial: { x: 500, y: 520, slots: 3, rows: 1, cols: 3 },
  landing: { x: 1000, y: 84, slots: 2, rows: 2, cols: 1 },
}
const DESK = { w: 100, h: 46 }
/** A mesa e o assento (a cadeira) de cada vaga; a segunda fileira senta do lado oposto. */
const slotAt = (area: Area, i: number) => {
  const p = PODS[area]
  const cols = p.cols ?? 2
  const col = i % cols
  const row = Math.floor(i / cols)
  const x = p.x + col * 130
  const y = p.y + row * 90
  return { x, y, row, seat: { x: x + 50, y: row === 0 ? y - 16 : y + DESK.h + 16 } }
}
/** Onde ficam os livres: a copa (em volta das mesas redondas) e a cozinha. */
const BREAK = [
  { x: 752, y: 120 }, { x: 790, y: 84 }, { x: 790, y: 160 }, { x: 826, y: 120 }, { x: 860, y: 84 },
  { x: 860, y: 160 }, { x: 896, y: 120 }, { x: 700, y: 176 }, { x: 650, y: 170 }, { x: 800, y: 190 },
]
/** As cadeiras da sala de reunião (quem planeja uma pasta vai para lá). */
const MEETING = [{ x: 392, y: 66 }, { x: 432, y: 66 }, { x: 472, y: 66 }, { x: 512, y: 66 }, { x: 392, y: 150 }, { x: 432, y: 150 }, { x: 472, y: 150 }, { x: 512, y: 150 }]

const short = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

/** Uma pessoa vista de cima: sombra, ombros, cabeça, cabelo e, trabalhando, os braços no teclado. */
const Avatar: React.FC<{ seat: Seat; working: boolean; facing: 'down' | 'up'; color: string }> = ({ seat, working, facing, color }) => (
  <g transform={facing === 'up' ? 'rotate(180)' : undefined}>
    {working && <circle r="19" fill="none" stroke={color} strokeWidth="2" opacity=".55" className="of-ring" />}
    <ellipse cx="0" cy="3" rx="15" ry="9" fill="#000" opacity=".16" />
    <rect x="-14" y="-6" width="28" height="14" rx="7" fill={seat.shirt} />
    {working ? (
      <g>
        <rect className="of-hand-l" x="-12" y="6" width="5" height="11" rx="2.5" fill={seat.skin} />
        <rect className="of-hand-r" x="7" y="6" width="5" height="11" rx="2.5" fill={seat.skin} />
      </g>
    ) : (
      <g>
        <rect x="9" y="-1" width="5" height="9" rx="2.5" fill={seat.skin} />
        <circle cx="16" cy="4" r="4" fill="#fff" stroke="#9CA3AF" strokeWidth="1" />
      </g>
    )}
    <circle cx="0" cy="-3" r="9" fill={seat.skin} />
    <path d="M-9 -3a9 9 0 0 1 18 0c-3-3-6-4-9-4s-6 1-9 4z" fill={seat.hair} transform="rotate(180)" />
    <path d="M-9 -3a9 9 0 0 1 18 0z" fill={seat.hair} opacity=".0" />
  </g>
)

const Chip: React.FC<{ x: number; y: number; text: string; hot?: boolean }> = ({ x, y, text, hot }) => {
  const w = Math.max(30, text.length * 5.6 + 12)
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <rect x={-w / 2} y={-8} width={w} height={15} rx={7.5} fill="#fff" stroke={hot ? '#8B5CF6' : '#CBD5E1'} strokeWidth="1" />
      <text textAnchor="middle" y="3" fontSize="9.5" fontWeight="700" fill="#1F2937" fontFamily="Inter, system-ui, sans-serif">{text}</text>
    </g>
  )
}

const Bubble: React.FC<{ x: number; y: number; text: string; below?: boolean }> = ({ x, y, text, below }) => {
  const t = short(text, 30)
  const w = Math.min(190, t.length * 5.3 + 18)
  return (
    <g className="of-bubble" transform={`translate(${x},${y})`} pointerEvents="none">
      <rect x={-w / 2} y={-11} width={w} height={20} rx="7" fill="#fff" stroke="#000" strokeOpacity=".12" />
      <path d={below ? 'M-4 -11l4 -5 4 5z' : 'M-4 9l4 5 4 -5z'} fill="#fff" stroke="#000" strokeOpacity=".12" />
      <path d={below ? 'M-3.4 -10.6h6.8' : 'M-3.4 8.6h6.8'} stroke="#fff" strokeWidth="2" />
      <text textAnchor="middle" y="3.5" fontSize="10" fontWeight="500" fill="#1F2937" fontFamily="Inter, system-ui, sans-serif">{t}</text>
    </g>
  )
}

const Plant: React.FC<{ x: number; y: number; r?: number }> = ({ x, y, r = 11 }) => (
  <g transform={`translate(${x},${y})`} aria-hidden>
    <circle r={r + 2} fill="#000" opacity=".12" cy="2" />
    <circle r={r} fill="#16A34A" />
    <circle r={r * 0.62} cx={-r * 0.2} cy={-r * 0.2} fill="#22C55E" />
    <circle r={r * 0.28} cx={r * 0.25} cy={r * 0.2} fill="#15803D" />
  </g>
)

const Desk: React.FC<{ x: number; y: number; flip: boolean; busy: boolean; color: string }> = ({ x, y, flip, busy, color }) => (
  <g transform={flip ? `translate(${x},${y + DESK.h}) scale(1,-1)` : `translate(${x},${y})`} aria-hidden>
    <rect x="3" y="4" width={DESK.w} height={DESK.h} rx="6" fill="#000" opacity=".14" />
    <rect width={DESK.w} height={DESK.h} rx="6" fill="#D9AE74" stroke="#B88A50" />
    <rect x="3" y="3" width={DESK.w - 6} height="3" rx="1.5" fill="#fff" opacity=".35" />
    {/* teclado do lado de quem senta, monitor do lado oposto */}
    <rect x="34" y="7" width="32" height="9" rx="2" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth=".6" />
    <rect x="72" y="9" width="6" height="8" rx="3" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth=".6" />
    <rect x="28" y="30" width="44" height="6" rx="2" fill="#1F2937" />
    <rect x="46" y="36" width="8" height="5" fill="#374151" />
    <rect x="30" y="22" width="40" height="9" rx="2" fill={busy ? color : '#0F172A'} opacity={busy ? 0.55 : 0.5} className={busy ? 'of-screen' : undefined} />
    <circle cx="14" cy="14" r="5" fill="#fff" stroke="#D1D5DB" />
    <circle cx="14" cy="14" r="2.6" fill="#7C2D12" opacity=".75" />
    <rect x="82" y="26" width="12" height="9" rx="1.5" fill="#fff" opacity=".85" transform="rotate(-8 88 30)" />
  </g>
)

const Glass: React.FC<{ x: number; y: number; w: number; h: number; label: string; door?: 'bottom' | 'none'; tint?: string }> = ({ x, y, w, h, label, door = 'bottom', tint = '#EFF6FF' }) => (
  <g aria-hidden>
    <rect x={x} y={y} width={w} height={h} rx="6" fill={tint} stroke="#7DD3FC" strokeWidth="3" strokeOpacity=".9" />
    <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx="4" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".7" />
    {door === 'bottom' && (
      <g>
        <rect x={x + w / 2 - 20} y={y + h - 4} width="40" height="8" fill="#F3EFE6" />
        <path d={`M${x + w / 2 - 20} ${y + h} a20 20 0 0 1 20 -18`} fill="none" stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 2" />
      </g>
    )}
    <text x={x + 12} y={y + 18} fontSize="10" fontWeight="800" letterSpacing="1.6" fill="#64748B" fontFamily="Inter, system-ui, sans-serif">{label.toUpperCase()}</text>
  </g>
)

export const Office: React.FC = () => {
  const jobs = useJobs((s) => s.jobs)
  const spaceRuns = useAgents((s) => s.agents)
  const running = jobs.filter((j) => j.status === 'running')
  const profiles = useProfileList()
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
        const prof = profileOfBase(profiles, area, r.role)
        return { key: `${area}:${r.role}`, name: prof?.name ?? r.name, role: prof?.role ?? r.role, base: r.role, skin: pick(SKINS, r.name + i), hair: pick(HAIRS, r.name), shirt: r.shirt, job }
      })
      mine.filter((j) => !used.has(j.id)).forEach((job, i) => list.push({ key: `${area}:extra:${job.id}`, name: `Reforço ${i + 1}`, role: job.agent.split(' · ')[0], base: job.agent.split(' · ')[0], skin: pick(SKINS, job.id), hair: pick(HAIRS, job.id), shirt: '#64748B', job }))
      if (area === 'sites') {
        spaceRuns.filter((a) => ['working', 'question'].includes(agentStatus(a, now))).forEach((a, i) =>
          list.push({ key: `space:${a.key}`, name: a.agent.split(' ')[0] || 'Agente', role: 'no projeto', base: 'no projeto', skin: pick(SKINS, a.key + i), hair: pick(HAIRS, a.key), shirt: '#F97316', space: { project: a.projectName ?? 'Projeto', now: a.now, since: a.startedAt, waiting: a.state === 'question', href: `/projetos/${a.projectId}` } })
        )
      }
      list.forEach((s, slot) => out.push({ ...s, area, slot }))
    })
    return out
  }, [running, spaceRuns, now, profiles])

  // Posições soltas (arrastadas) de quem está livre; quem trabalha volta para a mesa
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('escritorio-posicoes') ?? '{}')
    } catch {
      return {}
    }
  })
  const [drag, setDrag] = useState<{ key: string; x: number; y: number } | null>(null)
  const saveMoved = (next: Record<string, { x: number; y: number }>) => {
    setMoved(next)
    try {
      localStorage.setItem('escritorio-posicoes', JSON.stringify(next))
    } catch {
      // vale até recarregar
    }
  }

  // Onde cada um está: na própria mesa (livre ou trabalhando), na reunião (planejando a pasta) ou, sem mesa, na copa
  const placed = useMemo(() => {
    let rest = 0
    let meeting = 0
    return seats.map((s) => {
      const working = !!s.job || !!s.space
      if (s.job?.kind === 'Pasta' && meeting < MEETING.length) {
        const at = MEETING[meeting++]
        return { s, at, where: 'meeting' as const, working, facing: (at.y < 100 ? 'down' : 'up') as 'down' | 'up', chip: { x: at.x, y: at.y + 24 }, bubble: { x: at.x, y: at.y - 32, below: false } }
      }
      const custom = !working ? moved[s.key] : undefined
      if (custom) return { s, at: custom, where: 'free' as const, working, facing: 'down' as const, chip: { x: custom.x, y: custom.y + 24 }, bubble: { x: custom.x, y: custom.y - 32, below: false } }
      if (s.slot < PODS[s.area].slots) {
        const slot = slotAt(s.area, s.slot)
        const top = slot.row === 0
        return { s, at: slot.seat, where: 'desk' as const, working, facing: (top ? 'down' : 'up') as 'down' | 'up', chip: { x: slot.x + 50, y: top ? slot.y + DESK.h + 8 : slot.y - 7 }, bubble: { x: slot.seat.x, y: top ? slot.seat.y - 32 : slot.seat.y + 30, below: !top } }
      }
      const at = BREAK[rest++ % BREAK.length]
      return { s, at, where: 'break' as const, working, facing: 'down' as const, chip: { x: at.x, y: at.y + 24 }, bubble: { x: at.x, y: at.y - 32, below: false } }
    })
  }, [seats, moved])

  const picked = placed.find((p) => p.s.key === selected)?.s
  const total = placed.filter((p) => p.working).length
  const asking = spaceRuns.filter((a) => agentStatus(a, now) === 'question').length
  const finishedToday = jobs.filter((j) => j.status === 'done' && j.endedAt && now - j.endedAt < 86_400_000).length
  const pickedAt = placed.find((p) => p.s.key === selected)
  const mine = picked ? jobs.filter((j) => j.status !== 'running' && new RegExp(`^${picked.base}`).test(j.agent)).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)).slice(0, 4) : []
  const svgRef = useRef<SVGSVGElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // Navegação: zoom (1 a 3,5×) e o canto da área visível; arrastar o fundo move a planta
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const vw = W / zoom
  const vh = H / zoom
  const clampPan = (x: number, y: number, z: number) => ({ x: Math.min(W - W / z, Math.max(0, x)), y: Math.min(H - H / z, Math.max(0, y)) })
  const zoomAt = (next: number, at: { x: number; y: number }) => {
    const z = Math.min(3.5, Math.max(1, next))
    setPan((p) => clampPan(at.x - ((at.x - p.x) * zoom) / z, at.y - ((at.y - p.y) * zoom) / z, z))
    setZoom(z)
  }
  const grab = useRef<{ cx: number; cy: number; px: number; py: number } | null>(null)
  const press = useRef<{ key: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; working: boolean } | null>(null)
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }
  // Ctrl/⌘ + rolagem (ou o pinça do trackpad) dá zoom; com zoom, a rolagem move a planta; sem zoom, a página rola normalmente
  const live = useRef({ zoom, pan, vw, vh })
  live.current = { zoom, pan, vw, vh }
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onWheel = (e: WheelEvent) => {
      const svg = svgRef.current
      const ctm = svg?.getScreenCTM()
      if (!svg || !ctm) return
      const { zoom: z, pan: p, vw: w, vh: h } = live.current
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const pt = svg.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const at = pt.matrixTransform(ctm.inverse())
        const next = Math.min(3.5, Math.max(1, z * Math.exp(-e.deltaY * 0.01)))
        setPan(clampPan(at.x - ((at.x - p.x) * z) / next, at.y - ((at.y - p.y) * z) / next, next))
        setZoom(next)
      } else if (z > 1) {
        e.preventDefault()
        const r = svg.getBoundingClientRect()
        setPan(clampPan(p.x + (e.deltaX * w) / r.width, p.y + (e.deltaY * h) / r.height, z))
      }
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.PointerEvent, key: string, at: { x: number; y: number }, working: boolean) => {
    if (e.button !== 0) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const p = toSvg(e)
    press.current = { key, sx: p.x, sy: p.y, ox: at.x - p.x, oy: at.y - p.y, moved: false, working }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = press.current
    if (!d || d.working) return
    const p = toSvg(e)
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) < 5) return
    d.moved = true
    setDrag({ key: d.key, x: Math.min(W - 30, Math.max(30, p.x + d.ox)), y: Math.min(H - 40, Math.max(40, p.y + d.oy)) })
  }
  const onUp = () => {
    const d = press.current
    press.current = null
    if (!d) return
    if (d.moved && drag) saveMoved({ ...moved, [d.key]: { x: Math.round(drag.x), y: Math.round(drag.y) } })
    else setSelected((cur) => (cur === d.key ? null : d.key))
    setDrag(null)
  }
  const deskOf = (a: Area, slot: number) => placed.find((p) => p.where === 'desk' && p.s.area === a && p.s.slot === slot)

  return (
    <section aria-label="Escritório">
      <style>{CSS}</style>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Escritório</h2>
        <p className="text-xs text-gray-500">{total > 0 ? `${total} ${total === 1 ? 'agente trabalhando' : 'agentes trabalhando'} agora` : 'Todos na copa: nenhum trabalho agora'}</p>
      </div>
      <div ref={boxRef} className="relative mt-3 rounded-2xl bg-stone-200 shadow-[0_0_0_1px_rgb(0_0_0/0.1)]">
        <svg
          ref={svgRef}
          viewBox={`${pan.x} ${pan.y} ${vw} ${vh}`}
          className="block h-auto w-full select-none overflow-hidden rounded-2xl"
          style={{ touchAction: zoom > 1 ? 'none' : 'pan-y', cursor: zoom > 1 ? (grab.current ? 'grabbing' : 'grab') : undefined }}
          role="img"
          aria-label="Planta do escritório com os agentes"
          onPointerDown={(e) => {
            // O fundo move a planta (as pessoas tratam o próprio toque antes)
            if (press.current || e.button !== 0 || zoom <= 1) return
            ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
            grab.current = { cx: e.clientX, cy: e.clientY, px: pan.x, py: pan.y }
          }}
          onPointerMove={(e) => {
            const g = grab.current
            if (g && svgRef.current) {
              const r = svgRef.current.getBoundingClientRect()
              setPan(clampPan(g.px - ((e.clientX - g.cx) * vw) / r.width, g.py - ((e.clientY - g.cy) * vh) / r.height, zoom))
              return
            }
            onMove(e)
          }}
          onPointerUp={() => {
            grab.current = null
            onUp()
          }}
          onPointerCancel={() => {
            grab.current = null
            onUp()
          }}
        >
          <defs>
            <pattern id="of-carpet" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="#CBD2DC" /><path d="M0 0h26v26H0z" fill="none" stroke="#C0C8D4" strokeWidth="1" /><circle cx="13" cy="13" r="1" fill="#B9C2CF" /></pattern>
            <pattern id="of-tile" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#F3EBD8" /><path d="M0 0h30v30H0z" fill="none" stroke="#E6DABF" strokeWidth="1.2" /></pattern>
            <pattern id="of-wood" width="48" height="16" patternUnits="userSpaceOnUse"><rect width="48" height="16" fill="#E9D8B8" /><path d="M0 15.5h48M24 0v15.5" stroke="#DCC79F" strokeWidth="1" /></pattern>
          </defs>

          {/* a construção */}
          <rect x="6" y="6" width={W - 12} height={H - 12} rx="14" fill="#F3EFE6" stroke="#64748B" strokeWidth="8" />
          {Array.from({ length: 10 }, (_, i) => <rect key={i} x={200 + i * 78} y={H - 10} width="46" height="7" rx="2" fill="#BAE6FD" stroke="#7DD3FC" />)}

          {/* pisos */}
          <rect x="170" y="200" width="1006" height="456" rx="4" fill="url(#of-carpet)" />
          <rect x="24" y="24" width="146" height="632" rx="4" fill="url(#of-tile)" />
          <rect x="180" y="24" width="150" height="166" rx="4" fill="url(#of-wood)" />
          <rect x="340" y="24" width="232" height="166" rx="4" fill="url(#of-carpet)" />
          <rect x="582" y="24" width="150" height="166" rx="4" fill="url(#of-wood)" />
          <rect x="740" y="24" width="220" height="176" rx="4" fill="url(#of-tile)" />
          <rect x="970" y="24" width="206" height="236" rx="4" fill="url(#of-carpet)" />
          <rect x="910" y="560" width="266" height="96" rx="4" fill="#E5E7EB" />

          {/* entrada e recepção */}
          <text x="36" y="170" fontSize="10" fontWeight="800" letterSpacing="1.6" fill="#7C6A4D" fontFamily="Inter, system-ui, sans-serif">ENTRADA</text>
          <rect x="20" y="70" width="10" height="58" rx="2" fill="#C2410C" /><path d="M24 128 a58 58 0 0 1 58 -58" fill="none" stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 2" />
          <rect x="60" y="28" width="104" height="18" rx="3" fill="#0F172A" /><text x="112" y="41" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#7DD3FC" letterSpacing="1" fontFamily="Inter, system-ui, sans-serif">AVENCE STUDIO</text>
          <rect x="34" y="300" width="42" height="96" rx="10" fill="#94A3B8" stroke="#64748B" /><rect x="40" y="306" width="14" height="84" rx="6" fill="#CBD5E1" />
          <rect x="94" y="332" width="30" height="30" rx="4" fill="#C08A4F" stroke="#9A6A36" />
          <Plant x={60} y={200} r={13} /><Plant x={140} y={250} r={11} /><Plant x={150} y={630} r={12} />
          <Glass x={36} y={560} w={118} h={86} label="Elevador" door="none" />
          <rect x="196" y="224" width="136" height="32" rx="15" fill="#B8864B" stroke="#8F6633" /><rect x="196" y="224" width="32" height="96" rx="15" fill="#B8864B" stroke="#8F6633" /><rect x="198" y="230" width="132" height="5" rx="2.5" fill="#fff" opacity=".28" />
          <rect x="238" y="232" width="86" height="16" rx="3" fill="#0F172A" /><text x="281" y="243" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#7DD3FC" letterSpacing="1" fontFamily="Inter, system-ui, sans-serif">RECEPÇÃO</text>
          <text x="240" y="276" fontSize="8.5" fill="#475569" fontFamily="Inter, system-ui, sans-serif">{`${total} trabalhando`}</text><text x="240" y="288" fontSize="8.5" fill="#475569" fontFamily="Inter, system-ui, sans-serif">{`${finishedToday} prontos hoje`}</text>

          {/* sala do gestor */}
          <Glass x={180} y={24} w={150} h={166} label="Sala do gestor" />
          <rect x="212" y="90" width="86" height="38" rx="6" fill="#4B5563" stroke="#374151" />
          <rect x="242" y="97" width="26" height="6" rx="2" fill={asking ? '#8B5CF6' : '#0F172A'} />
          <rect x="222" y="148" width="22" height="14" rx="7" fill="#64748B" /><rect x="264" y="148" width="22" height="14" rx="7" fill="#64748B" />
          <g transform="translate(255,64)"><ellipse cy="3" rx="15" ry="9" fill="#000" opacity=".16" /><rect x="-14" y="-6" width="28" height="14" rx="7" fill="#111827" /><circle cy="-3" r="9" fill="#E0A982" /><path d="M-9 -3a9 9 0 0 1 18 0c-3-3-6-4-9-4s-6 1-9 4z" fill="#2B1B12" transform="rotate(180)" /></g>
          <Chip x={255} y={84} text={asking > 0 ? `Você · ${asking} esperando` : 'Você'} hot={asking > 0} />
          <Plant x={312} y={172} />

          {/* sala de reunião */}
          <Glass x={340} y={24} w={232} h={166} label="Sala de reunião" />
          <rect x="372" y="86" width="168" height="44" rx="22" fill="#7C4A21" stroke="#5B3517" strokeWidth="1.5" />
          <rect x="380" y="90" width="152" height="7" rx="3.5" fill="#fff" opacity=".18" />
          {MEETING.map((m, i) => <circle key={i} cx={m.x} cy={m.y} r="12" fill={placed.some((p) => p.where === 'meeting' && p.at === m) ? '#475569' : '#94A3B8'} />)}
          <rect x="556" y="44" width="10" height="72" rx="3" fill="#0F172A" /><rect x="558" y="48" width="6" height="64" rx="2" fill="#1E3A5F" />

          {/* escada para o depósito e cozinha */}
          <text x="592" y="44" fontSize="10" fontWeight="800" letterSpacing="1.6" fill="#64748B" fontFamily="Inter, system-ui, sans-serif">ESCADA</text>
          {Array.from({ length: 9 }, (_, i) => <rect key={i} x={592} y={54 + i * 14} width="62" height="10" rx="2" fill="#D6C7A8" stroke="#B9A57F" />)}
          <path d="M600 190 v-8 l8 4z" fill="#64748B" />
          <rect x="672" y="40" width="54" height="118" rx="5" fill="#9CA3AF" stroke="#6B7280" /><rect x="680" y="50" width="30" height="20" rx="3" fill="#E5E7EB" /><rect x="684" y="100" width="22" height="48" rx="3" fill="#F8FAFC" stroke="#94A3B8" />
          <text x="676" y="176" fontSize="8.5" fontWeight="800" letterSpacing="1.2" fill="#64748B" fontFamily="Inter, system-ui, sans-serif">COZINHA</text>

          {/* copa */}
          <text x="752" y="44" fontSize="10" fontWeight="800" letterSpacing="1.8" fill="#92700C" fontFamily="Inter, system-ui, sans-serif">COPA</text>
          {[790, 860].map((cx) => <g key={cx}><circle cx={cx + 2} cy="124" r="26" fill="#000" opacity=".12" /><circle cx={cx} cy="120" r="24" fill="#C08A4F" stroke="#9A6A36" strokeWidth="2" /><circle cx={cx} cy="120" r="17" fill="none" stroke="#fff" opacity=".25" /></g>)}
          <rect x="924" y="56" width="32" height="50" rx="5" fill="#1D4ED8" stroke="#1E3A8A" /><rect x="929" y="63" width="22" height="22" rx="2" fill="#BFDBFE" /><rect x="924" y="112" width="32" height="50" rx="5" fill="#B91C1C" stroke="#7F1D1D" /><rect x="929" y="119" width="22" height="22" rx="2" fill="#FECACA" />

          {/* anexo */}
          <Glass x={970} y={24} w={206} h={236} label="" />

          {/* sala reservada, banheiros e almoxarifado */}
          <Glass x={910} y={270} w={100} h={120} label="Reservada" tint="#FDF2F8" />
          <rect x="926" y="318" width="68" height="28" rx="5" fill="#4B5563" stroke="#374151" /><circle cx="960" cy="366" r="9" fill="#64748B" />
          <rect x="1024" y="270" width="70" height="56" rx="4" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="2" /><rect x="1024" y="330" width="70" height="60" rx="4" fill="#FCE7F3" stroke="#F9A8D4" strokeWidth="2" />
          <text x="1059" y="302" textAnchor="middle" fontSize="9" fontWeight="800" fill="#2563EB" fontFamily="Inter, system-ui, sans-serif">WC</text><text x="1059" y="364" textAnchor="middle" fontSize="9" fontWeight="800" fill="#DB2777" fontFamily="Inter, system-ui, sans-serif">WC</text>
          <rect x="1110" y="290" width="52" height="38" rx="5" fill="#9CA3AF" stroke="#6B7280" /><rect x="1118" y="296" width="36" height="12" rx="2" fill="#E5E7EB" />
          <text x="922" y="578" fontSize="10" fontWeight="800" letterSpacing="1.6" fill="#64748B" fontFamily="Inter, system-ui, sans-serif">ALMOXARIFADO</text>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={924 + i * 62} y="592" width="50" height="50" rx="3" fill="#B45309" opacity=".75" stroke="#7C2D12" />)}
          <Plant x={890} y={640} r={13} /><Plant x={900} y={228} r={12} /><Plant x={180} y={520} r={11} />

          {/* salão: as ilhas de mesas */}
          {(Object.keys(AREAS) as Area[]).map((a) => (
            <g key={a} aria-hidden>
              <rect x={PODS[a].x - 24} y={PODS[a].y - 52} width={(PODS[a].cols ?? 2) * 130 + 28} height={PODS[a].rows === 2 ? 212 : 130} rx="14" fill="#fff" opacity=".28" />
              <text x={PODS[a].x - 8} y={PODS[a].y - 34} fontSize="10.5" fontWeight="800" letterSpacing="1.8" fill="#475569" fontFamily="Inter, system-ui, sans-serif">{AREAS[a].label.toUpperCase()}</text>
            </g>
          ))}
          {(Object.keys(AREAS) as Area[]).flatMap((a) =>
            Array.from({ length: PODS[a].slots }, (_, i) => {
              const slot = slotAt(a, i)
              const who = deskOf(a, i)
              const color = who?.s.job?.color ?? (who?.s.space ? '#F97316' : '#64748B')
              return (
                <g key={`${a}${i}`}>
                  <circle cx={slot.seat.x} cy={slot.seat.y} r="12" fill={who ? '#475569' : '#94A3B8'} />
                  <Desk x={slot.x} y={slot.y} flip={slot.row === 1} busy={!!who?.working} color={color} />
                </g>
              )
            })
          )}

          {/* as pessoas, de trás para a frente: arraste quem está livre, clique para pedir algo */}
          {[...placed].sort((a, b) => a.at.y - b.at.y).map(({ s, at, working, facing, chip }) => {
            const dragging = drag?.key === s.key
            const x = dragging ? drag.x : at.x
            const y = dragging ? drag.y : at.y
            return (
              <g key={s.key} className={dragging ? undefined : 'of-walk'} style={{ transform: `translate(${x}px, ${y}px)`, touchAction: 'none' }}>
                <g
                  className={cn(working && 'of-work')}
                  style={{ cursor: working ? 'pointer' : dragging ? 'grabbing' : 'grab' }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.name}, ${s.role}: ${working ? `trabalhando em ${s.job ? `${s.job.kind} ${s.job.label}` : s.space?.project}` : 'livre'}. ${working ? 'Clique para ver' : 'Clique para pedir algo, ou arraste para mudar de lugar'}`}
                  onPointerDown={(e) => onDown(e, s.key, { x, y }, working)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(selected === s.key ? null : s.key)}
                >
                  <circle r="22" fill="transparent" />
                  {selected === s.key && <circle r="23" fill="#8B5CF6" opacity=".16" stroke="#8B5CF6" strokeWidth="1.5" />}
                  <Avatar seat={s} working={working} facing={dragging ? 'down' : facing} color={s.job?.color ?? '#F97316'} />
                </g>
                <g className={dragging ? undefined : 'of-chip'} style={{ transform: `translate(${chip.x - at.x}px, ${chip.y - at.y}px)` }}><Chip x={0} y={0} text={s.name} /></g>
              </g>
            )
          })}
          {placed.filter((p) => p.working && !(selected === p.s.key)).map(({ s, bubble }) => (
            <g key={`b-${s.key}`} className="of-walk" style={{ transform: `translate(${bubble.x}px, ${bubble.y}px)` }}>
              <Bubble key={s.job?.step ?? s.space?.now} x={0} y={0} below={bubble.below} text={s.job ? s.job.step : s.space ? (s.space.waiting ? 'Esperando você' : s.space.now ?? 'Montando a página') : ''} />
            </g>
          ))}
        </svg>
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-lg bg-white/90 p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.1)] backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Afastar" disabled={zoom <= 1} onClick={() => zoomAt(zoom / 1.4, { x: pan.x + vw / 2, y: pan.y + vh / 2 })} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
          <span className="w-10 text-center text-[11px] font-semibold tabular-nums text-gray-600">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Aproximar" disabled={zoom >= 3.5} onClick={() => zoomAt(zoom * 1.4, { x: pan.x + vw / 2, y: pan.y + vh / 2 })} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="Ver a planta inteira" disabled={zoom === 1} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40"><Maximize2 className="h-3.5 w-3.5" /></button>
        </div>
        {zoom === 1 && <p className="pointer-events-none absolute bottom-2 left-3 z-10 hidden text-[10px] text-gray-500 sm:block">Ctrl + rolagem ou os botões dão zoom; com zoom, arraste o fundo para andar pelo escritório</p>}
        {picked && pickedAt && (() => {
          const px = Math.min(100, Math.max(0, (((drag?.key === picked.key ? drag.x : pickedAt.at.x) - pan.x) / vw) * 100))
          const py = Math.min(100, Math.max(0, (((drag?.key === picked.key ? drag.y : pickedAt.at.y) - pan.y) / vh) * 100))
          const below = py < 50
          const left = Math.min(Math.max(px, 17), 83)
          return (
            <div role="dialog" aria-label={`Conversar com ${picked.name}`} className="absolute z-30 w-[min(330px,92%)] -translate-x-1/2 rounded-2xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_12px_32px_-8px_rgb(0_0_0/0.3)]" style={{ left: `${left}%`, top: below ? `calc(${py}% + 34px)` : undefined, bottom: below ? undefined : `calc(${100 - py}% + 34px)`, maxHeight: '70%', overflowY: 'auto' }} onPointerDown={(e) => e.stopPropagation()}>
              <span aria-hidden className={cn('absolute h-3 w-3 rotate-45 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08)]', below ? '-top-1.5' : '-bottom-1.5')} style={{ left: `calc(50% + ${(px - left) * 3.3}px)`, marginLeft: -6 }} />
              <div className="relative flex items-center gap-2">
                <span className="h-7 w-7 shrink-0 rounded-full" style={{ background: picked.shirt }} />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{picked.name} <span className="font-normal text-gray-500">· {picked.role}</span></p>
                <button type="button" aria-label="Fechar" onClick={() => setSelected(null)} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
              {picked.job ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-600">{picked.job.kind} · {picked.job.label} · {elapsed(picked.job.startedAt, now)}</p>
                  <JobFeed job={picked.job} lines={6} />
                  <div className="flex gap-1.5">
                    {picked.job.href && <Button type="button" size="sm" variant="outline" className="h-7 gap-1 bg-white text-xs" onClick={() => openPreview({ href: picked.job!.href!, title: `${picked.job!.kind} · ${picked.job!.label}` })}><Eye className="h-3.5 w-3.5" /> Ver aqui</Button>}
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 bg-white text-xs" onClick={() => stopJob(picked.job!.id)}>Parar</Button>
                  </div>
                </div>
              ) : picked.space ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-600">{picked.space.project}: {picked.space.waiting ? 'esperando a sua resposta' : picked.space.now ?? 'montando a página'}</p>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 bg-white text-xs" onClick={() => openPreview({ href: picked.space!.href, title: picked.space!.project })}><Eye className="h-3.5 w-3.5" /> Ver aqui</Button>
                </div>
              ) : (
                <>
                  {mine.length > 0 && (
                    <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
                      {mine.slice(0, 3).map((j) => (
                        <li key={j.id} className="flex items-center gap-2 px-2 py-1.5">
                          {j.status === 'error' ? <CircleAlert className="h-4 w-4 shrink-0 text-red-500" /> : <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-gray-900">{j.kind} · {j.label}</span><span className="block truncate text-[11px] text-gray-500">{j.status === 'error' ? j.error ?? 'não terminou' : 'entregue'}</span></span>
                          {j.href && j.status !== 'error' && <Button type="button" size="sm" variant="outline" className="h-7 gap-1 bg-white px-2 text-xs" onClick={() => openPreview({ href: j.href!, title: `${j.kind} · ${j.label}` })}><Eye className="h-3.5 w-3.5" /> Ver</Button>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {picked.key.startsWith('comercial:') ? <p className="mt-2 text-xs text-gray-600">{picked.name} trabalha por rotina: dá para rodar agora ou agendar em <Link to="/agentes/configurar?aba=rotinas" className="font-medium underline">Rotinas</Link>.</p> : !picked.key.includes(':extra:') ? <AgentRequest compact who={{ area: picked.key.split(':')[0] as Area, role: picked.base, name: picked.name }} /> : <p className="mt-2 text-xs text-gray-500">Reforço temporário.</p>}
                  {!picked.key.includes(':extra:') && <Link to="/agentes/configurar?aba=perfis" className="mt-2 block text-[11px] font-medium text-gray-500 underline">Editar o perfil de {picked.name}</Link>}
                </>
              )}
            </div>
          )
        })()}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
        <span>Arraste quem está livre para outro lugar. Clique para pedir algo.</span>
        {Object.keys(moved).length > 0 && <button type="button" onClick={() => saveMoved({})} className="underline">Voltar todos para as mesas</button>}
      </div>
    </section>
  )
}
