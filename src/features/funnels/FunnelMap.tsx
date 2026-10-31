import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertCircle, ChevronLeft, ChevronRight, Link2Off, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'
import { money } from '@/features/crm/ads'
import { cn } from '@/lib/utils'
import { KIND_LABEL, isConnected, transitionOf, type FunnelStep, type Reading } from './rules'

/**
 * O funil como mapa: cada etapa é um cartão num canvas, ligado à próxima por uma linha com a conversão
 * (só quando as duas etapas contam as mesmas pessoas, como em `transitionOf`; nos outros casos a linha
 * é tracejada e diz que não há divisão). Os cartões se arrastam, o fundo se move, o zoom é por botões
 * ou Ctrl/⌘ + roda. As posições ficam neste navegador, por funil.
 */

const nf = new Intl.NumberFormat('pt-BR')
const pct = (n: number) => `${String(n).replace('.', ',')}%`

const W = 248
const H = 176
const GAP = 120
const ORIGIN = 40
const defaultPos = (i: number) => ({ x: ORIGIN + i * (W + GAP), y: ORIGIN })

type Pos = { x: number; y: number }
type View = { x: number; y: number; k: number }

const storeKey = (id: string) => `superelements-funil-mapa:${id}`
const readPositions = (id: string): Record<string, Pos> => {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey(id)) ?? '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

const SOURCE_LINK: Partial<Record<FunnelStep['kind'], { to: string; label: string }>> = {
  campaign: { to: '/crm/anuncios', label: 'Anúncios' },
  page: { to: '/crm/site', label: 'Site' },
  event: { to: '/crm/site', label: 'Site' },
  form: { to: '/crm/formularios', label: 'Respostas' },
  opportunity: { to: '/crm', label: 'Oportunidades' },
}

const KIND_TONE: Record<FunnelStep['kind'], string> = {
  campaign: 'bg-violet-500',
  page: 'bg-sky-500',
  event: 'bg-sky-500',
  form: 'bg-amber-500',
  opportunity: 'bg-emerald-500',
  stage: 'bg-emerald-600',
  manual: 'bg-gray-300',
}

export interface FunnelMapProps {
  funnelId: string
  steps: FunnelStep[]
  readings: Reading[]
  /** Posições guardadas no funil (compartilhadas com a equipe), por índice da etapa */
  layout?: Record<string, Pos>
  /** Quem pode gravar a organização para todos (gestor); os outros arrastam só para si */
  onSaveLayout?: (layout: Record<string, Pos>) => Promise<void>
  /** Trocar a etapa de lugar com a vizinha (gestor): recebe as posições já trocadas */
  onReorder?: (from: number, to: number, layout: Record<string, Pos>) => Promise<void>
}

export const FunnelMap: React.FC<FunnelMapProps> = ({ funnelId, steps, readings, layout, onSaveLayout, onReorder }) => {
  const stepKey = (_s: FunnelStep, i: number) => String(i)
  const [busy, setBusy] = useState(false)
  const [positions, setPositions] = useState<Record<string, Pos>>(() => {
    const local = readPositions(funnelId)
    return Object.keys(local).length ? local : { ...(layout ?? {}) }
  })
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [moving, setMoving] = useState<string>()
  const box = useRef<HTMLDivElement>(null)
  const fitted = useRef(false)

  const posOf = useCallback((s: FunnelStep, i: number): Pos => positions[stepKey(s, i)] ?? defaultPos(i), [positions])

  const persist = (next: Record<string, Pos>) => {
    if (onSaveLayout) {
      onSaveLayout(next).then(
        () => {
          try {
            localStorage.removeItem(storeKey(funnelId))
          } catch {
            /* nada a limpar */
          }
        },
        (e) => {
          toast.error(`Não consegui salvar a organização para a equipe: ${e instanceof Error ? e.message : String(e)}. Ela vale só neste navegador.`)
          localOnly(next)
        }
      )
      return
    }
    localOnly(next)
  }
  const localOnly = (next: Record<string, Pos>) => {
    try {
      localStorage.setItem(storeKey(funnelId), JSON.stringify(next))
    } catch {
      /* sem armazenamento: as posições valem só nesta tela */
    }
  }

  const maxValue = useMemo(() => Math.max(1, ...readings.map((r) => (r.state === 'ok' ? r.value : 0))), [readings])

  // Enquadra tudo na primeira vez e quando o usuário pede
  const fit = useCallback(() => {
    const el = box.current
    if (!el || !steps.length) return
    const pts = steps.map((s, i) => posOf(s, i))
    const minX = Math.min(...pts.map((p) => p.x)) - ORIGIN
    const minY = Math.min(...pts.map((p) => p.y)) - ORIGIN
    const maxX = Math.max(...pts.map((p) => p.x)) + W + ORIGIN
    const maxY = Math.max(...pts.map((p) => p.y)) + H + ORIGIN
    const k = Math.min(1, el.clientWidth / (maxX - minX), el.clientHeight / (maxY - minY))
    setView({ k, x: (el.clientWidth - (maxX - minX) * k) / 2 - minX * k, y: (el.clientHeight - (maxY - minY) * k) / 2 - minY * k })
  }, [steps, posOf])

  useLayoutEffect(() => {
    if (fitted.current) return
    fitted.current = true
    fit()
  }, [fit])

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const el = box.current
      const px = cx ?? (el ? el.clientWidth / 2 : 0)
      const py = cy ?? (el ? el.clientHeight / 2 : 0)
      const k = Math.min(1.6, Math.max(0.35, v.k * factor))
      const f = k / v.k
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }
    })
  }, [])

  // Ctrl/⌘ + roda dá zoom; a roda sozinha continua rolando a página
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Arrastar o fundo move o canvas
  const panStart = useRef<{ px: number; py: number; vx: number; vy: number }>()
  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return
    e.currentTarget.setPointerCapture(e.pointerId)
    panStart.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }
  }
  const onBgMove = (e: React.PointerEvent) => {
    const s = panStart.current
    if (s) setView((v) => ({ ...v, x: s.vx + e.clientX - s.px, y: s.vy + e.clientY - s.py }))
  }
  const onBgUp = () => {
    panStart.current = undefined
  }

  // Arrastar um cartão
  const drag = useRef<{ key: string; px: number; py: number; ox: number; oy: number; moved: boolean }>()
  const onNodeDown = (e: React.PointerEvent, key: string, at: Pos) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('a,button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { key, px: e.clientX, py: e.clientY, ox: at.x, oy: at.y, moved: false }
    setMoving(key)
  }
  const onNodeMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const x = Math.round(d.ox + (e.clientX - d.px) / view.k)
    const y = Math.round(d.oy + (e.clientY - d.py) / view.k)
    d.moved = true
    setPositions((p) => ({ ...p, [d.key]: { x, y } }))
  }
  const onNodeUp = () => {
    if (drag.current?.moved) setPositions((p) => (persist(p), p))
    drag.current = undefined
    setMoving(undefined)
  }
  // Teclado: setas movem o cartão focado
  const onNodeKey = (e: React.KeyboardEvent, key: string, at: Pos) => {
    const step = e.shiftKey ? 40 : 10
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!d) return
    e.preventDefault()
    setPositions((p) => {
      const next = { ...p, [key]: { x: at.x + d[0], y: at.y + d[1] } }
      persist(next)
      return next
    })
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (!onReorder || j < 0 || j >= steps.length || busy) return
    const swapped = { ...Object.fromEntries(steps.map((s, k) => [String(k), posOf(s, k)])) }
    swapped[String(i)] = posOf(steps[j], j)
    swapped[String(j)] = posOf(steps[i], i)
    setBusy(true)
    onReorder(i, j, swapped).then(
      () => setBusy(false),
      (e) => {
        setBusy(false)
        toast.error(e instanceof Error ? e.message : String(e))
      }
    )
  }

  const reset = () => {
    setPositions({})
    onSaveLayout?.({}).catch(() => undefined)
    try {
      localStorage.removeItem(storeKey(funnelId))
    } catch {
      /* nada a limpar */
    }
    requestAnimationFrame(() => {
      const el = box.current
      if (!el) return
      const w = ORIGIN * 2 + steps.length * W + (steps.length - 1) * GAP
      const k = Math.min(1, el.clientWidth / w)
      setView({ k, x: (el.clientWidth - w * k) / 2, y: 24 })
    })
  }

  const worldW = Math.max(...steps.map((s, i) => posOf(s, i).x)) + W + ORIGIN
  const worldH = Math.max(...steps.map((s, i) => posOf(s, i).y)) + H + ORIGIN

  const edges = steps.slice(1).map((to, j) => {
    const i = j + 1
    const from = steps[j]
    const a = posOf(from, j)
    const b = posOf(to, i)
    const toRight = b.x + W / 2 >= a.x + W / 2
    const x1 = toRight ? a.x + W : a.x
    const x2 = toRight ? b.x : b.x + W
    const y1 = a.y + H / 2
    const y2 = b.y + H / 2
    const dx = Math.max(40, Math.abs(x2 - x1) / 2) * (toRight ? 1 : -1)
    const t = transitionOf(from, to, readings[j] ?? { state: 'unconnected' }, readings[i] ?? { state: 'unconnected' })
    const rA = readings[j]
    const rB = readings[i]
    const lost = t.rate !== undefined && rA?.state === 'ok' && rB?.state === 'ok' ? rA.value - rB.value : undefined
    return { key: stepKey(to, i), d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2, t, lost, index: i }
  })

  if (!steps.length) return null

  return (
    <div className="relative overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <div
        ref={box}
        className={cn('relative h-[min(68vh,560px)] min-h-[380px] touch-none select-none bg-[radial-gradient(circle,rgb(0_0_0/0.09)_1px,transparent_1px)] [background-size:22px_22px]', panStart.current ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${22 * view.k}px ${22 * view.k}px` }}
        onPointerDown={onBgDown}
        onPointerMove={onBgMove}
        onPointerUp={onBgUp}
        onPointerCancel={onBgUp}
        role="group"
        aria-label="Mapa do funil. Arraste os cartões para organizar; as setas movem o cartão selecionado."
      >
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: worldW, height: worldH }}>
          <svg className="absolute left-0 top-0 overflow-visible" width={worldW} height={worldH} aria-hidden>
            <defs>
              <marker id="fm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#9ca3af" />
              </marker>
              <marker id="fm-arrow-ok" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#059669" />
              </marker>
            </defs>
            {edges.map((e) => (
              <path
                key={e.key}
                d={e.d}
                fill="none"
                stroke={e.t.rate !== undefined ? '#059669' : '#9ca3af'}
                strokeWidth={e.t.rate !== undefined ? Math.max(2, Math.min(10, (e.t.rate / 100) * 10)) : 1.75}
                strokeDasharray={e.t.rate !== undefined ? undefined : '5 5'}
                strokeLinecap="round"
                markerEnd={`url(#${e.t.rate !== undefined ? 'fm-arrow-ok' : 'fm-arrow'})`}
                opacity={e.t.rate !== undefined ? 0.55 : 1}
              />
            ))}
          </svg>

          {edges.map((e) => (
            <div key={`l${e.key}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: e.mx, top: e.my }}>
              {e.t.rate !== undefined ? (
                <span
                  className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-800 shadow-[0_0_0_1px_rgb(5_150_105/0.25)]"
                  title={e.t.basis === 'respostas' ? 'Respostas que têm uma oportunidade ligada' : 'Atingiram a etapa anterior e também esta (estado atual ou posterior; não prova a passagem por cada etapa)'}
                >
                  {pct(e.t.rate)}
                  {e.lost !== undefined && e.lost > 0 && <span className="ml-1 font-normal text-emerald-900/70">−{nf.format(e.lost)}</span>}
                </span>
              ) : (
                <span className="flex max-w-[150px] items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] leading-tight text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]" title={e.t.reason}>
                  <Minus className="h-3 w-3 shrink-0" aria-hidden /> sem conversão
                </span>
              )}
            </div>
          ))}

          {steps.map((step, i) => {
            const key = stepKey(step, i)
            const at = posOf(step, i)
            const r = readings[i] ?? { state: 'unconnected' as const }
            const link = SOURCE_LINK[step.kind]
            return (
              <div
                key={key}
                tabIndex={0}
                role="group"
                aria-label={`Etapa ${i + 1}: ${step.name}`}
                onPointerDown={(e) => onNodeDown(e, key, at)}
                onPointerMove={onNodeMove}
                onPointerUp={onNodeUp}
                onPointerCancel={onNodeUp}
                onKeyDown={(e) => onNodeKey(e, key, at)}
                className={cn(
                  'pointer-events-auto absolute flex flex-col rounded-xl bg-white p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  moving === key ? 'z-10 cursor-grabbing shadow-[0_0_0_1px_rgb(139_92_246/0.5),0_12px_28px_-8px_rgb(0_0_0/0.25)]' : 'cursor-grab shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_3px_-1px_rgb(0_0_0/0.12)]'
                )}
                style={{ left: at.x, top: at.y, width: W, height: H }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="truncate text-[11px] font-medium uppercase tracking-wide text-gray-500">{KIND_LABEL[step.kind]}</span>
                </div>
                <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">{step.name}</h3>

                {r.state === 'ok' && (
                  <div className="mt-auto">
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-[28px] font-semibold leading-none tabular-nums tracking-tight text-gray-900">{nf.format(r.value)}</span>
                      <span className="truncate text-xs text-gray-600">{r.unit}</span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                      <div className={cn('h-full rounded-full', KIND_TONE[step.kind])} style={{ width: `${Math.max(2, (r.value / maxValue) * 100)}%` }} />
                    </div>
                    <p className="mt-1.5 truncate text-[11px] text-gray-500">
                      {r.spend !== undefined
                        ? `Investido ${money(r.spend, r.currency)}${step.kind === 'opportunity' && r.value > 0 ? ` · ${money(r.spend / r.value, r.currency)} cada` : ''}`
                        : r.current !== undefined
                          ? `Agora neste estado: ${nf.format(r.current)}`
                          : r.sales && step.kind === 'stage' && step.source.stage === 'fechado' && r.sales.withValue > 0
                            ? `Valor fechado ${money(r.sales.total)}`
                            : r.note ?? ' '}
                    </p>
                  </div>
                )}
                {r.state === 'unavailable' && (
                  <p className="mt-auto flex items-start gap-1.5 text-xs text-amber-800" role="status">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="line-clamp-3">{r.reason}</span>
                  </p>
                )}
                {r.state === 'unconnected' && (
                  <p className="mt-auto flex items-start gap-1.5 text-xs text-gray-500">
                    <Link2Off className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{isConnected(step) ? 'Sem leitura.' : 'Sem fonte conectada. Escolha em Configurar.'}</span>
                  </p>
                )}
                {onReorder && (
                  <div className="absolute bottom-2 right-2 flex gap-0.5">
                    <button type="button" aria-label={`Mover ${step.name} para antes`} disabled={busy || i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-gray-400 hover:bg-zinc-100 hover:text-gray-900 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label={`Mover ${step.name} para depois`} disabled={busy || i === steps.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 text-gray-400 hover:bg-zinc-100 hover:text-gray-900 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {link && (
                  <Link to={link.to} className="absolute right-3 top-3 text-[11px] font-medium text-violet-700 hover:underline">
                    {link.label}
                  </Link>
                )}
              </div>
            )
          })}
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-white p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_2px_6px_-2px_rgb(0_0_0/0.15)]">
          <button type="button" aria-label="Diminuir o zoom" className="rounded p-1.5 text-gray-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => zoomAt(1 / 1.2)}>
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-gray-600">{Math.round(view.k * 100)}%</span>
          <button type="button" aria-label="Aumentar o zoom" className="rounded p-1.5 text-gray-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => zoomAt(1.2)}>
            <Plus className="h-4 w-4" />
          </button>
          <span className="mx-0.5 h-5 w-px bg-gray-200" aria-hidden />
          <button type="button" aria-label="Enquadrar tudo" title="Enquadrar tudo" className="rounded p-1.5 text-gray-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={fit}>
            <Maximize2 className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Voltar à organização original" title="Reorganizar em linha" className="rounded p-1.5 text-gray-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 text-[11px] text-gray-500">Arraste os cartões e o fundo · Ctrl/⌘ + roda dá zoom{onReorder ? ' · ‹ › troca a ordem' : ''}</p>
      </div>
    </div>
  )
}
