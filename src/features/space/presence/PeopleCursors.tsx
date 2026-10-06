import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sendCursor, useLiveCursors, useLiveProject } from '@/features/projects/liveProject'
import { pageAt } from '@/features/space/pages/pages'
import { useSpaceStore } from '@/store/spaceStore'
import { displayName, personColor } from './presence'

/** Um envio a cada tanto: o bastante para o cursor andar liso do outro lado. */
const SEND_EVERY = 50
/** Parado por esse tempo, o cursor some até a pessoa mexer de novo. */
const IDLE_FOR = 30_000

/**
 * Manda o meu mouse no canvas para quem mais está no projeto, em coordenadas
 * do mundo (cada um vê no próprio zoom). Dentro das seções o iframe repassa o
 * movimento (`se-preview-pointer`).
 */
export function useBroadcastCursor(viewportRef: React.RefObject<HTMLElement>) {
  const last = useRef(0)
  const timer = useRef<number>()
  const pending = useRef<{ x: number; y: number } | null>(null)

  const flush = useCallback(() => {
    timer.current = undefined
    const point = pending.current
    if (!point) return
    last.current = Date.now()
    const { pages, nodes } = useSpaceStore.getState()
    sendCursor({ ...point, pageId: pageAt(pages, nodes, point.x, point.y)?.id })
  }, [])

  const move = useCallback(
    (e: React.PointerEvent) => {
      if (!useLiveProject.getState().people.length) return
      const box = viewportRef.current?.getBoundingClientRect()
      if (!box) return
      const t = useSpaceStore.getState().canvasTransform
      pending.current = { x: (e.clientX - box.left - t.x) / t.zoom, y: (e.clientY - box.top - t.y) / t.zoom }
      const wait = SEND_EVERY - (Date.now() - last.current)
      if (wait <= 0) flush()
      else if (!timer.current) timer.current = window.setTimeout(flush, wait)
    },
    [viewportRef, flush]
  )

  const leave = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    pending.current = null
    sendCursor(null)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { move, leave }
}

/** Os cursores das outras pessoas, no mundo do canvas: andam com o zoom e o arrasto da tela. */
export const PeopleCursors: React.FC = () => {
  const cursors = useLiveCursors((s) => s.cursors)
  // Tique a cada poucos segundos para esconder quem parou
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(id)
  }, [])
  const fresh = useMemo(() => Object.values(cursors).filter((c) => now - c.at < IDLE_FOR), [cursors, now])
  if (!fresh.length) return null

  return (
    <>
      {fresh.map((cursor) => {
        const color = personColor(cursor.userId)
        return (
          <div
            key={cursor.userId}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-40 motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-linear"
            style={{ transform: `translate(${cursor.x}px, ${cursor.y}px) scale(calc(1 / var(--z, 1)))`, transformOrigin: '0 0' }}
          >
            <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow-[0_1px_2px_rgb(0_0_0/0.25)]">
              <path d="M1.5 1.5 16 9.2l-6.6 1.7-3.1 6.6z" fill={color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span
              className="absolute left-3.5 top-4 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm"
              style={{ background: color, color: '#fff' }}
            >
              {displayName(cursor.email)}
            </span>
          </div>
        )
      })}
    </>
  )
}
