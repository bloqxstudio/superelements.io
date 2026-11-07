import React, { useEffect, useMemo, useRef, useState } from 'react'
import { areaId, dirOf, folderNote, isLog, titleOf, type Area, type Graph, type Vault } from './vault'

/**
 * O grafo do cérebro, como no Obsidian: uma bolinha por nota, maior quanto mais ligada, na cor da
 * área. Linhas cheias são links escritos nas notas; linhas claras ligam cada nota ao README da pasta
 * dela, o que agrupa as áreas. Arrastar move o grafo (ou a bolinha), a roda aproxima, passar o
 * mouse acende os vizinhos e o clique abre a nota. Simulação de forças própria, sem biblioteca.
 */

interface Node { id: string; label: string; area: string; r: number; x: number; y: number; vx: number; vy: number; fixed?: boolean }
interface Edge { a: number; b: number; soft: boolean }

export const GraphView: React.FC<{
  vault: Vault
  graph: Graph
  areas: Area[]
  current?: string | null
  hidden: Set<string>
  onOpen: (path: string) => void
}> = ({ vault, graph, areas, current, hidden, onOpen }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const colors = useMemo(() => new Map(areas.map((a) => [a.id, a.color])), [areas])

  const { nodes, edges } = useMemo(() => {
    const notes = vault.notes.filter((n) => !hidden.has(areaId(n.path)))
    const index = new Map(notes.map((n, i) => [n.path, i]))
    const degree = new Map<string, number>()
    const edges: Edge[] = []
    const seen = new Set<string>()
    const add = (from: string, to: string, soft: boolean) => {
      const a = index.get(from), b = index.get(to)
      if (a === undefined || b === undefined || a === b) return
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      if (seen.has(key)) return
      seen.add(key)
      edges.push({ a, b, soft })
      degree.set(from, (degree.get(from) ?? 0) + 1)
      degree.set(to, (degree.get(to) ?? 0) + 1)
    }
    for (const n of notes) for (const t of graph.links.get(n.path) ?? []) add(n.path, t, false)
    for (const n of notes) {
      // A nota pertence à pasta dela: o README da pasta (ou da pasta acima, para os logs)
      let dir = dirOf(n.path)
      if (isLog(n.path)) dir = dirOf(dir)
      const readme = folderNote(vault, dir)
      if (readme && readme !== n.path) add(n.path, readme, true)
      else if (!readme && dir) { const up = folderNote(vault, dirOf(dir)); if (up && up !== n.path) add(n.path, up, true) }
    }
    const rootAngle = new Map(areas.map((a, i) => [a.id, (i / areas.length) * Math.PI * 2]))
    const nodes: Node[] = notes.map((n) => {
      const area = areaId(n.path)
      const ang = (rootAngle.get(area) ?? 0) + (Math.random() - 0.5) * 0.8
      const dist = area === 'raiz' ? 20 : 180 + Math.random() * 80
      return { id: n.path, label: titleOf(n), area, r: 4 + Math.sqrt(degree.get(n.path) ?? 0) * 2.2, x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, vx: 0, vy: 0 }
    })
    return { nodes, edges }
  }, [vault, graph, areas, hidden])

  const view = useRef({ x: 0, y: 0, k: 1 })
  const alpha = useRef(1)
  const hoverRef = useRef<string | null>(null)
  hoverRef.current = hover

  useEffect(() => {
    alpha.current = 1
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let w = 0, h = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      w = wrap.clientWidth; h = wrap.clientHeight
      canvas.width = w * dpr; canvas.height = h * dpr
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const neighbors = new Map<string, Set<string>>()
    for (const e of edges) {
      const a = nodes[e.a].id, b = nodes[e.b].id
      if (!neighbors.has(a)) neighbors.set(a, new Set())
      if (!neighbors.has(b)) neighbors.set(b, new Set())
      neighbors.get(a)!.add(b); neighbors.get(b)!.add(a)
    }
    const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.classList.contains('dark')

    const step = () => {
      const a = alpha.current
      if (a > 0.005) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i]
          for (let j = i + 1; j < nodes.length; j++) {
            const m = nodes[j]
            let dx = n.x - m.x, dy = n.y - m.y
            let d2 = dx * dx + dy * dy
            if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1 }
            if (d2 > 160000) continue
            const f = (1500 / d2) * a
            const d = Math.sqrt(d2)
            n.vx += (dx / d) * f; n.vy += (dy / d) * f
            m.vx -= (dx / d) * f; m.vy -= (dy / d) * f
          }
        }
        for (const e of edges) {
          const n = nodes[e.a], m = nodes[e.b]
          const dx = m.x - n.x, dy = m.y - n.y
          const d = Math.sqrt(dx * dx + dy * dy) || 1
          const rest = e.soft ? 70 : 110
          const f = ((d - rest) / d) * (e.soft ? 0.05 : 0.03) * a
          n.vx += dx * f; n.vy += dy * f
          m.vx -= dx * f; m.vy -= dy * f
        }
        for (const n of nodes) {
          n.vx -= n.x * 0.004 * a; n.vy -= n.y * 0.004 * a
          if (n.fixed) { n.vx = 0; n.vy = 0; continue }
          n.vx *= 0.6; n.vy *= 0.6
          n.x += n.vx; n.y += n.vy
        }
        alpha.current *= 0.985
      }

      const { x: vx, y: vy, k } = view.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.translate(w / 2 + vx, h / 2 + vy)
      ctx.scale(k, k)
      const hv = hoverRef.current
      const lit = hv ? neighbors.get(hv) ?? new Set<string>() : null
      for (const e of edges) {
        const n = nodes[e.a], m = nodes[e.b]
        const on = hv && (n.id === hv || m.id === hv)
        ctx.strokeStyle = on ? '#7c3aed' : e.soft ? 'rgba(148,163,184,.25)' : 'rgba(100,116,139,.45)'
        ctx.lineWidth = (on ? 1.6 : e.soft ? 0.7 : 1) / k
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke()
      }
      for (const n of nodes) {
        const dim = lit && n.id !== hv && !lit.has(n.id)
        ctx.globalAlpha = dim ? 0.18 : 1
        ctx.fillStyle = colors.get(n.area) ?? '#6b7280'
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
        if (n.id === current) {
          ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 2.5 / k
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4 / k, 0, Math.PI * 2); ctx.stroke()
        }
        const showLabel = k > 0.9 || n.r > 8 || n.id === hv || n.id === current || (lit?.has(n.id) ?? false)
        if (showLabel) {
          ctx.font = `${(n.id === hv ? 600 : 500)} ${12 / k}px Inter, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.fillStyle = dark ? '#e5e7eb' : '#374151'
          const label = n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label
          ctx.fillText(label, n.x, n.y + n.r + 13 / k)
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    // Mouse: arrastar o fundo move a vista; arrastar uma nota move a nota; clique abre
    const toWorld = (ev: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect()
      const { x, y, k } = view.current
      return { x: (ev.clientX - rect.left - w / 2 - x) / k, y: (ev.clientY - rect.top - h / 2 - y) / k }
    }
    const hit = (p: { x: number; y: number }) => {
      let best: Node | null = null, bd = Infinity
      for (const n of nodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y)
        if (d < n.r + 6 / view.current.k && d < bd) { best = n; bd = d }
      }
      return best
    }
    let drag: { node: Node | null; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null = null
    const down = (ev: PointerEvent) => {
      canvas.setPointerCapture(ev.pointerId)
      const node = hit(toWorld(ev))
      drag = { node, sx: ev.clientX, sy: ev.clientY, vx: view.current.x, vy: view.current.y, moved: false }
      if (node) { node.fixed = true; alpha.current = Math.max(alpha.current, 0.3) }
    }
    const move = (ev: PointerEvent) => {
      if (!drag) {
        const n = hit(toWorld(ev))
        setHover(n?.id ?? null)
        canvas.style.cursor = n ? 'pointer' : 'grab'
        return
      }
      if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 4) drag.moved = true
      if (drag.node) {
        const p = toWorld(ev)
        drag.node.x = p.x; drag.node.y = p.y
        alpha.current = Math.max(alpha.current, 0.3)
      } else {
        view.current.x = drag.vx + ev.clientX - drag.sx
        view.current.y = drag.vy + ev.clientY - drag.sy
        canvas.style.cursor = 'grabbing'
      }
    }
    const up = () => {
      if (drag?.node) { drag.node.fixed = false; if (!drag.moved) onOpen(drag.node.id) }
      drag = null
      canvas.style.cursor = 'grab'
    }
    const wheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const before = toWorld(ev)
      const k = Math.min(3, Math.max(0.25, view.current.k * Math.exp(-ev.deltaY * 0.0015)))
      view.current.k = k
      const rect = canvas.getBoundingClientRect()
      view.current.x = ev.clientX - rect.left - w / 2 - before.x * k
      view.current.y = ev.clientY - rect.top - h / 2 - before.y * k
    }
    const leave = () => setHover(null)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [nodes, edges, colors, current, onOpen])

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-gray-50/60">
      <canvas ref={canvasRef} className="block touch-none" style={{ cursor: 'grab' }} aria-label="Grafo das notas do cérebro" />
      <div className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-gray-400">
        {nodes.length} notas · {edges.filter((e) => !e.soft).length} links · arraste, use a roda para aproximar
      </div>
    </div>
  )
}
