import React, { useEffect, useRef } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import { AgentMark } from './AgentMark'
import { useAgentCursors, type AgentCursor, type CursorTarget } from './cursorStore'
import { agentInfoByName } from './protocol'

/**
 * Os cursores dos agentes por cima do canvas. Cada um segue o alvo dele (a
 * camada selecionada, a seção ou a página), medido na tela a cada quadro,
 * então acompanha o zoom e o arrasto do canvas. Pensando, ele passeia um
 * pouco; lendo, desce e sobe pela seção; editando, fica parado onde mexe, com
 * o quadro da seção na cor dele; ao gravar, "clica".
 */

interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface CanvasInsets {
  left: number
  right: number
}

/** Barra de cima e caixa do chat: o cursor não fica embaixo delas. */
const TOP_CLEAR = 64
const BOTTOM_CLEAR = 110
const EDGE = 16

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const intersect = (a: Box, b: Box): Box | null => {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const w = Math.min(a.x + a.w, b.x + b.w) - x
  const h = Math.min(a.y + a.h, b.y + b.h) - y
  return w > 8 && h > 8 ? { x, y, w, h } : null
}

/** Onde está o alvo agora, em px dentro do Space. */
function targetBox(target: CursorTarget, root: DOMRect): { box: Box; element: boolean } | null {
  const rel = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { x: r.left - root.left, y: r.top - root.top, w: r.width, h: r.height }
  }
  if (target.sectionId) {
    const id = CSS.escape(target.sectionId)
    // A camada só tem caixa medida enquanto está selecionada no canvas
    if (target.elementId) {
      const box = document.querySelector(`[data-se-selected-box="${id}"][data-se-element="${CSS.escape(target.elementId)}"]`)
      if (box) return { box: rel(box), element: true }
    }
    const preview = document.querySelector(`[data-section-preview="${id}"]`)
    if (preview) return { box: rel(preview), element: false }
    // Seção sem prévia (JSON aberto): o cartão, pela posição no mundo
    const { nodes, canvasTransform: t } = useSpaceStore.getState()
    const node = nodes.find((n) => n.id === target.sectionId)
    const canvas = document.querySelector('[data-space-canvas]')
    if (node && canvas) {
      const c = rel(canvas)
      return { box: { x: c.x + node.x * t.zoom + t.x, y: c.y + node.y * t.zoom + t.y, w: node.width * t.zoom, h: node.height * t.zoom }, element: false }
    }
  }
  if (target.pageId) {
    const page = document.querySelector(`[data-page-id="${CSS.escape(target.pageId)}"]`)
    if (page) return { box: rel(page), element: false }
  }
  return null
}

const ARROW = 'M3 2.2 L3 20.5 L8.1 15.7 L11.6 23.4 L15 21.9 L11.6 14.4 L18.4 14.4 Z'

const Cursor: React.FC<{ cursor: AgentCursor; rootRef: React.RefObject<HTMLDivElement>; insets: CanvasInsets }> = ({ cursor, rootRef, insets }) => {
  const live = useRef({ cursor, insets })
  live.current = { cursor, insets }
  const group = useRef<HTMLDivElement>(null)
  const pointer = useRef<SVGSVGElement>(null)
  const frame = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const s = { x: NaN, y: NaN, vx: 0, wander: { x: 0, y: 0 }, nextWander: 0 }
    let last = performance.now()
    let raf = 0

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const root = rootRef.current
      if (!root || !group.current) return
      const bounds = root.getBoundingClientRect()
      const { cursor: c, insets: inset } = live.current
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const view: Box = { x: inset.left + EDGE, y: TOP_CLEAR, w: Math.max(40, bounds.width - inset.left - inset.right - EDGE * 2), h: Math.max(40, bounds.height - TOP_CLEAR - BOTTOM_CLEAR) }

      // Entra pela caixa do chat, embaixo no meio
      if (Number.isNaN(s.x)) {
        const origin = c.origin ?? { x: view.x + view.w / 2, y: bounds.height - 70 }
        s.x = origin.x
        s.y = origin.y
      }
      if (now > s.nextWander) {
        s.wander = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }
        s.nextWander = now + 1100 + Math.random() * 1000
      }

      const found = targetBox(c.target, bounds)
      let want = { x: s.x, y: s.y }
      if (found) {
        const b = found.box
        // Do alvo, a parte que está na tela; fora dela, o cursor espera na borda
        const seen = intersect(b, view) ?? b
        const t = now / 1000
        if (c.mode === 'read' && !still) {
          const sweep = 0.5 - 0.5 * Math.cos((t * 2 * Math.PI) / 4.6)
          want = { x: seen.x + seen.w * (0.24 + 0.08 * Math.sin(t * 1.7)), y: seen.y + 18 + Math.max(0, seen.h - 36) * sweep }
        } else if (c.mode === 'edit' || c.mode === 'write') {
          const jitter = still ? 0 : 3
          want = found.element
            ? { x: b.x + Math.min(b.w * 0.5, 48) + s.wander.x * jitter * 2, y: b.y + b.h * 0.6 + s.wander.y * jitter }
            : { x: seen.x + seen.w * 0.42 + s.wander.x * jitter * 3, y: seen.y + Math.min(seen.h * 0.35, 150) + s.wander.y * jitter * 2 }
        } else {
          const rx = still ? 0 : Math.min(60, seen.w * 0.18)
          const ry = still ? 0 : Math.min(40, seen.h * 0.18)
          want = { x: seen.x + seen.w * 0.36 + s.wander.x * rx, y: seen.y + Math.min(seen.h * 0.3, 120) + s.wander.y * ry }
        }
      }
      want.x = clamp(want.x, view.x, view.x + view.w)
      want.y = clamp(want.y, view.y, view.y + view.h)

      const k = still ? 1 : 1 - Math.exp(-dt * (c.mode === 'read' ? 6 : 4))
      const nx = s.x + (want.x - s.x) * k
      const ny = s.y + (want.y - s.y) * k
      s.vx = s.vx * 0.82 + ((nx - s.x) / Math.max(dt, 0.001)) * 0.18
      s.x = nx
      s.y = ny
      group.current.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`
      // Inclina um pouco para o lado em que anda, como uma mão
      if (pointer.current) pointer.current.style.transform = `rotate(${still ? 0 : clamp(s.vx / 70, -14, 14)}deg)`

      if (frame.current) {
        const show = !!found && (c.mode === 'read' || c.mode === 'edit' || c.mode === 'write')
        frame.current.style.opacity = show ? '1' : '0'
        if (found) {
          const b = found.box
          frame.current.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`
          frame.current.style.width = `${b.w}px`
          frame.current.style.height = `${b.h}px`
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rootRef])

  const info = agentInfoByName(cursor.agent)
  const gone = cursor.mode === 'gone'
  const clicked = cursor.clickAt && Date.now() - cursor.clickAt < 1500
  const busy = cursor.mode !== 'done' && cursor.mode !== 'gone'
  const handle = (place: string) => (
    <span className={`absolute h-[7px] w-[7px] border bg-white ${place}`} style={{ borderColor: cursor.color }} />
  )

  return (
    <>
      <div
        ref={frame}
        aria-hidden
        className="absolute left-0 top-0 rounded-[3px] transition-opacity duration-300"
        style={{ opacity: 0, boxShadow: `0 0 0 1.5px ${cursor.color}`, background: `${cursor.color}0d` }}
      >
        {handle('-left-[4px] -top-[4px]')}
        {handle('-right-[4px] -top-[4px]')}
        {handle('-bottom-[4px] -left-[4px]')}
        {handle('-bottom-[4px] -right-[4px]')}
      </div>
      <div
        ref={group}
        className={`absolute left-0 top-0 transition-opacity duration-700 ${gone ? 'opacity-0' : 'opacity-100'}`}
        style={{ willChange: 'transform' }}
      >
        {clicked && <span key={cursor.clickAt} aria-hidden className="se-cursor-click absolute -left-[11px] -top-[11px] h-[26px] w-[26px] rounded-full border-2" style={{ borderColor: cursor.color }} />}
        <svg ref={pointer} width="22" height="26" viewBox="0 0 22 26" className="absolute -left-[3px] -top-[2px] origin-[3px_2px] drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)]">
          <path d={ARROW} fill={cursor.color} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <div className="absolute left-[15px] top-[21px] flex flex-col items-start gap-1">
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-[3px] pl-[3px] pr-2.5 text-[12px] font-semibold leading-none shadow-[0_2px_8px_-2px_rgb(0_0_0/0.35)]"
            style={{ background: cursor.color, color: cursor.ink }}
          >
            <AgentMark agent={info?.id} size={17} />
            {cursor.agent}
          </span>
          {cursor.text && busy && (
            <span className="max-w-[260px] truncate rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-[0_2px_8px_-2px_rgb(0_0_0/0.2)] ring-1 ring-black/5">
              {cursor.text}
              <span aria-hidden className="se-agent-dots" />
            </span>
          )}
        </div>
      </div>
    </>
  )
}

export const AgentCursors: React.FC<{ insets: CanvasInsets }> = ({ insets }) => {
  const cursors = useAgentCursors((s) => s.cursors)
  const rootRef = useRef<HTMLDivElement>(null)
  const list = Object.values(cursors)
  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {list.map((cursor) => (
        <Cursor key={cursor.key} cursor={cursor} rootRef={rootRef} insets={insets} />
      ))}
    </div>
  )
}
