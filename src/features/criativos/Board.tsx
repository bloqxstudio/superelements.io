import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Copy, Download, Maximize2, Minus, Plus, Scan, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { agentInfo, PHASE_LABEL, useAgent } from './agentStore'
import { boundsOf, withGroups } from './layerOps'
import { useRefs } from './refStore'
import { gridOf, guidesOf, snapAxis, snapTargets, type PostGrid } from './grid'
import { rememberPointer, sendPointer, useLive } from './live'
import { drawSlide, fontCss, layerBox, type ImageMap } from './render'
import { useEditor } from './store'
import { TEMPLATES } from './templates'
import { sizeOf, type CreativeSet, type FormatId, type Layer, type Slide, type TextLayer } from './types'

/**
 * O canvas dos criativos: todos os posts do conjunto lado a lado, um post por
 * fileira, cada slide no tamanho real desenhado num canvas próprio. Arrastar o
 * fundo move a vista; Ctrl/⌘ + roda (ou pinça) dá zoom. Clicar escolhe o slide e
 * a camada, arrastar move, o canto redimensiona e dois cliques num texto edita
 * ali mesmo. O que está escolhido é o que o chat com a IA enxerga.
 */

const GAP = 96
const HEAD = 96
const ROW_GAP = 168
const MIN_K = 0.04
const MAX_K = 2

interface Placed {
  postId: string
  slideId: string
  index: number
  format: FormatId
  x: number
  y: number
  w: number
  h: number
  slide: Slide
}

interface Row {
  postId: string
  name: string
  format: FormatId
  y: number
  width: number
  slides: Placed[]
  addX: number
}

function layout(set: CreativeSet) {
  const rows: Row[] = []
  let y = 0
  for (const post of set.posts) {
    const { width, height } = sizeOf(post.format)
    const slides: Placed[] = post.slides.map((slide, index) => ({ postId: post.id, slideId: slide.id, index, format: post.format, x: index * (width + GAP), y: y + HEAD, w: width, h: height, slide }))
    const rowWidth = post.slides.length * (width + GAP) + width * 0.3
    rows.push({ postId: post.id, name: post.name, format: post.format, y, width: rowWidth, slides, addX: post.slides.length * (width + GAP) })
    y += HEAD + height + ROW_GAP
  }
  const bounds = { w: Math.max(1, ...rows.map((r) => r.width)), h: Math.max(1, y - ROW_GAP) }
  return { rows, bounds }
}

/** Quanto do tamanho real o canvas guarda: o suficiente para o zoom atual, em degraus. */
const bucket = (k: number) => {
  const want = Math.min(1, k * Math.min(2, window.devicePixelRatio || 1))
  return [0.0625, 0.125, 0.25, 0.5, 0.75, 1].find((s) => s >= want) ?? 1
}

const SlideCanvas = memo(function SlideCanvas({ slide, format, images, scale, hideLayer }: { slide: Slide; format: FormatId; images: ImageMap; scale: number; hideLayer?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { width, height } = sizeOf(format)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(scale, scale)
    drawSlide(ctx, hideLayer ? { ...slide, layers: slide.layers.map((l) => (l.id === hideLayer ? { ...l, opacity: 0 } : l)) } : slide, format, images)
  }, [slide, format, images, scale, hideLayer])
  return <canvas ref={ref} width={Math.round(width * scale)} height={Math.round(height * scale)} className="block" style={{ width, height }} />
})

const KIND_COLOR = { margin: '#f43f5e', column: '#f43f5e', third: '#0ea5e9', center: '#8b5cf6' } as const

/** As guias de um post sobre cada card (só na tela de edição: nada disto vai para a imagem exportada). */
export const GridOverlay = memo(function GridOverlay({ format, grid, snap }: { format: FormatId; grid: PostGrid; snap?: { v: number[]; h: number[] } | null }) {
  const { width: W, height: H } = sizeOf(format)
  const g = guidesOf(format, grid)
  const line = { vectorEffect: 'non-scaling-stroke' as const, strokeWidth: 1 }
  return (
    <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-hidden>
      {g.columns.map(([a, b], i) => (
        <rect key={i} x={a} y={0} width={b - a} height={H} fill="#f43f5e" fillOpacity={0.07} />
      ))}
      {g.covered.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#0b0b0f" fillOpacity={0.38} />
          {c.w > 160 && <text x={c.x + 24} y={c.y + Math.min(c.h - 14, 46)} fill="#fff" fillOpacity={0.9} fontSize={26} fontFamily="Inter, system-ui, sans-serif">{c.label}</text>}
        </g>
      ))}
      {g.h.map((l, i) => (
        <line key={`h${i}`} x1={0} x2={W} y1={l.at} y2={l.at} stroke={KIND_COLOR[l.kind]} strokeOpacity={l.kind === 'margin' ? 0.8 : 0.55} strokeDasharray={l.kind === 'margin' ? undefined : '6 6'} {...line} />
      ))}
      {g.v.map((l, i) => (
        <line key={`v${i}`} x1={l.at} x2={l.at} y1={0} y2={H} stroke={KIND_COLOR[l.kind]} strokeOpacity={l.kind === 'margin' ? 0.8 : l.kind === 'column' ? 0.4 : 0.55} strokeDasharray={l.kind === 'margin' || l.kind === 'column' ? undefined : '6 6'} {...line} />
      ))}
      {(snap?.h ?? []).map((y, i) => (
        <line key={`sh${i}`} x1={0} x2={W} y1={y} y2={y} stroke="#ff2bd6" {...line} strokeWidth={1.5} />
      ))}
      {(snap?.v ?? []).map((x, i) => (
        <line key={`sv${i}`} x1={x} x2={x} y1={0} y2={H} stroke="#ff2bd6" {...line} strokeWidth={1.5} />
      ))}
    </svg>
  )
})

type View = { x: number; y: number; k: number }

type Drag =
  | { kind: 'pan'; sx: number; sy: number; view: View }
  | { kind: 'move' | 'resize'; postId: string; slideId: string; origin: Layer; /** Todos os escolhidos no começo do arrasto (o próprio incluso). */ group: Layer[]; px: number; py: number; before: CreativeSet | undefined }
  | { kind: 'marquee'; postId: string; slideId: string; slide: Placed; x0: number; y0: number; moved: boolean; base: string[]; additive: boolean }

interface Props {
  onAddSlide: (postId: string, template: string) => void
  onDownloadSlide: (postId: string, slideId: string) => void
  onDuplicateSlide: (postId: string, slideId: string) => void
  onDeleteSlide: (postId: string, slideId: string) => void
}

export const Board: React.FC<Props> = ({ onAddSlide, onDownloadSlide, onDuplicateSlide, onDeleteSlide }) => {
  const set = useEditor((s) => s.set)!
  const images = useEditor((s) => s.images)
  const postId = useEditor((s) => s.postId)
  const slideId = useEditor((s) => s.slideId)
  const layerId = useEditor((s) => s.layerId)
  const rowSelected = useEditor((s) => s.row)
  const working = useAgent((s) => s.working)
  const flash = useAgent((s) => s.flash)
  const cursor = useAgent((s) => s.cursor)
  const people = useLive((s) => s.people)
  const peerCursors = useLive((s) => s.cursors)
  const peerAgents = useLive((s) => s.agents)

  const host = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const spaceDown = useRef(false)
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 0.3 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [size, setSize] = useState({ w: 1200, h: 800 })
  const [hover, setHover] = useState<{ slideId: string; layerId: string } | null>(null)
  const [editing, setEditing] = useState<{ postId: string; slideId: string; layerId: string } | null>(null)
  const [menu, setMenu] = useState<{ postId: string; x: number; y: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const [marquee, setMarquee] = useState<{ slideId: string; x: number; y: number; w: number; h: number } | null>(null)
  const layerIds = useEditor((s) => s.layerIds)
  const [snapped, setSnapped] = useState<{ slideId: string; v: number[]; h: number[] } | null>(null)
  const fitted = useRef(false)

  const { rows, bounds } = useMemo(() => layout(set), [set.posts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tamanho da área
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fit = useCallback(
    (box = { x: 0, y: 0, w: bounds.w, h: bounds.h }) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, Math.min((size.w - 96) / box.w, (size.h - 96) / box.h, 1)))
      setView({ k, x: (size.w - box.w * k) / 2 - box.x * k, y: (size.h - box.h * k) / 2 - box.y * k })
    },
    [bounds.w, bounds.h, size.w, size.h]
  )

  // Primeira vista: o primeiro post inteiro cabe, os outros ficam logo abaixo
  useEffect(() => {
    if (fitted.current || !rows.length || size.w < 200) return
    fitted.current = true
    const first = rows[0]
    fit({ x: 0, y: 0, w: Math.min(bounds.w, first.width), h: Math.min(bounds.h, (sizeOf(first.format).height + HEAD) * 1.12) })
  }, [rows, size.w, bounds.w, bounds.h, fit])

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor))
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k }
    })
  }, [])

  // Roda: pan; com Ctrl/⌘ (ou a pinça do trackpad), zoom
  useEffect(() => {
    const el = host.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-scroll]')) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01))
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  useEffect(() => {
    const down = (e: KeyboardEvent) => e.code === 'Space' && !(e.target as HTMLElement).closest('input, textarea, select') && ((spaceDown.current = true), e.preventDefault())
    const up = (e: KeyboardEvent) => e.code === 'Space' && (spaceDown.current = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const scale = bucket(view.k)

  // Só desenha o que está na tela (com folga)
  const visible = useMemo(() => {
    const margin = 600
    const x0 = (-view.x - margin) / view.k
    const x1 = (size.w - view.x + margin) / view.k
    const y0 = (-view.y - margin) / view.k
    const y1 = (size.h - view.y + margin) / view.k
    return new Set(rows.flatMap((r) => r.slides).filter((p) => p.x + p.w > x0 && p.x < x1 && p.y + p.h > y0 && p.y < y1).map((p) => p.slideId))
  }, [rows, view, size])

  const world = (e: { clientX: number; clientY: number }) => {
    const r = host.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k }
  }

  const slideAt = (wx: number, wy: number) => rows.flatMap((r) => r.slides).find((p) => wx >= p.x && wx <= p.x + p.w && wy >= p.y && wy <= p.y + p.h)

  const layerAt = (p: Placed, wx: number, wy: number) => {
    for (let i = p.slide.layers.length - 1; i >= 0; i--) {
      const l = p.slide.layers[i]
      if (l.hidden || l.locked) continue
      // Fundos de tela cheia (pontos, anéis, formas do tamanho do slide) não roubam o clique
      if ((l.type === 'dots' || l.type === 'ring') && (l.w >= p.w * 0.9 || l.type === 'ring')) continue
      const b = layerBox(l)
      if (wx - p.x >= b.x && wx - p.x <= b.x + b.w && wy - p.y >= b.y && wy - p.y <= b.y + b.h) return l
    }
  }

  const patchLayer = (pid: string, sid: string, id: string, fields: Partial<Layer>) =>
    useEditor.getState().draft((s) => ({
      ...s,
      posts: s.posts.map((p) => (p.id !== pid ? p : { ...p, slides: p.slides.map((sl) => (sl.id !== sid ? sl : { ...sl, layers: sl.layers.map((l) => (l.id === id ? ({ ...l, ...fields } as Layer) : l)) })) })),
    }))

  /** Muda vários componentes de uma vez (rascunho, sem histórico). */
  const patchLayers = (pid: string, sid: string, patches: Map<string, Partial<Layer>>) =>
    useEditor.getState().draft((s) => ({
      ...s,
      posts: s.posts.map((p) => (p.id !== pid ? p : { ...p, slides: p.slides.map((sl) => (sl.id !== sid ? sl : { ...sl, layers: sl.layers.map((l) => (patches.has(l.id) ? ({ ...l, ...patches.get(l.id) } as Layer) : l)) })) })),
    }))

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-ui]')) return
    setMenu(null)
    const state = useEditor.getState()
    const w = world(e)
    const panIt = e.button === 1 || spaceDown.current
    const hit = panIt ? undefined : slideAt(w.x, w.y)
    if (!hit) {
      if (!panIt) state.selectLayer(undefined)
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, view }
      setPanning(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (state.postId !== hit.postId) state.selectPost(hit.postId)
    if (state.slideId !== hit.slideId) state.selectSlide(hit.slideId)

    const additive = e.shiftKey || e.metaKey || e.ctrlKey

    // Alça de redimensionar: só com um componente escolhido
    const only = state.layerIds.length === 1 ? hit.slide.layers.find((l) => l.id === state.layerIds[0]) : undefined
    if (only && state.slideId === hit.slideId && !only.locked) {
      const b = layerBox(only)
      if (Math.hypot(w.x - hit.x - (b.x + b.w), w.y - hit.y - (b.y + b.h)) < 30 / view.k) {
        drag.current = { kind: 'resize', postId: hit.postId, slideId: hit.slideId, origin: only, group: [only], px: w.x, py: w.y, before: state.set }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }

    const target = layerAt(hit, w.x, w.y)
    if (!target) {
      // Fundo do card: arrastar desenha um retângulo que escolhe o que ele toca
      const base = additive && state.slideId === hit.slideId ? state.layerIds : []
      if (!additive) state.selectLayers([])
      drag.current = { kind: 'marquee', postId: hit.postId, slideId: hit.slideId, slide: hit, x0: w.x - hit.x, y0: w.y - hit.y, moved: false, base, additive }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    // Escolher um do grupo escolhe o grupo; Alt escolhe só o componente
    const members = e.altKey ? [target.id] : withGroups(hit.slide.layers, [target.id])
    if (additive) {
      const has = members.every((id) => state.layerIds.includes(id))
      state.selectLayers(has ? state.layerIds.filter((id) => !members.includes(id)) : [...new Set([...state.layerIds, ...members])])
      return
    }
    // Clicar num já escolhido mantém a seleção (arrasta todos juntos)
    const keep = state.slideId === hit.slideId && state.layerIds.includes(target.id)
    const ids = keep ? state.layerIds : members
    if (!keep) state.selectLayers(members)
    const group = hit.slide.layers.filter((l) => ids.includes(l.id) && !l.locked)
    drag.current = { kind: 'move', postId: hit.postId, slideId: hit.slideId, origin: target, group: group.length ? group : [target], px: w.x, py: w.y, before: state.set }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    {
      const w = world(e)
      rememberPointer(w.x, w.y)
      sendPointer(w)
    }
    if (!d) {
      if (e.buttons) return
      const w = world(e)
      const hit = slideAt(w.x, w.y)
      const l = hit && layerAt(hit, w.x, w.y)
      setHover((h) => (l && hit ? (h?.layerId === l.id ? h : { slideId: hit.slideId, layerId: l.id }) : h ? null : h))
      return
    }
    if (d.kind === 'pan') return setView({ ...d.view, x: d.view.x + e.clientX - d.sx, y: d.view.y + e.clientY - d.sy })
    const w = world(e)
    if (d.kind === 'marquee') {
      const x1 = Math.min(d.slide.w, Math.max(0, w.x - d.slide.x))
      const y1 = Math.min(d.slide.h, Math.max(0, w.y - d.slide.y))
      const rect = { x: Math.min(d.x0, x1), y: Math.min(d.y0, y1), w: Math.abs(x1 - d.x0), h: Math.abs(y1 - d.y0) }
      if (!d.moved && Math.hypot(rect.w, rect.h) * view.k < 5) return
      d.moved = true
      setMarquee({ slideId: d.slideId, ...rect })
      const hits = d.slide.slide.layers.filter((l) => {
        if (l.hidden || l.locked) return false
        const b = layerBox(l)
        // Fundos de tela cheia não entram numa seleção por área
        if (b.w >= d.slide.w * 0.9 && b.h >= d.slide.h * 0.9) return false
        return b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y
      })
      const ids = withGroups(d.slide.slide.layers, hits.map((l) => l.id))
      useEditor.getState().selectLayers([...new Set([...d.base, ...ids])])
      return
    }
    const dx = w.x - d.px
    const dy = w.y - d.py
    const post = set.posts.find((p) => p.id === d.postId)
    const grid = gridOf(post)
    const slide = post?.slides.find((x) => x.id === d.slideId)
    const limit = 10 / view.k
    const moving = new Set(d.group.map((l) => l.id))
    const targets = post && slide && grid.snap && !e.altKey ? snapTargets(post.format, grid, { ...slide, layers: slide.layers.filter((l) => !moving.has(l.id)) }, '', layerBox) : undefined
    if (d.kind === 'move') {
      // A caixa que todos os escolhidos formam é que encaixa nas guias
      const box = d.group.length > 1 ? boundsOf(d.group) : layerBox(d.origin)
      let mx = Math.round(dx)
      let my = Math.round(dy)
      let gv: number[] = []
      let gh: number[] = []
      if (targets) {
        const x = box.x + mx
        const y = box.y + my
        const sx = snapAxis([x, x + box.w / 2, x + box.w], targets.xs, limit)
        const sy = snapAxis([y, y + box.h / 2, y + box.h], targets.ys, limit)
        if (sx) {
          mx += Math.round(sx.delta)
          gv = [sx.at]
        }
        if (sy) {
          my += Math.round(sy.delta)
          gh = [sy.at]
        }
      }
      setSnapped(gv.length || gh.length ? { slideId: d.slideId, v: gv, h: gh } : null)
      patchLayers(d.postId, d.slideId, new Map(d.group.map((l) => [l.id, { x: l.x + mx, y: l.y + my }])))
    } else {
      const ob = layerBox(d.origin)
      let right = d.origin.x + d.origin.w + dx
      let bottom = d.origin.y + ob.h + dy
      let gv: number[] = []
      let gh: number[] = []
      if (targets) {
        const sx = snapAxis([right], targets.xs, limit)
        const sy = d.origin.type === 'text' ? undefined : snapAxis([bottom], targets.ys, limit)
        if (sx) {
          right += sx.delta
          gv = [sx.at]
        }
        if (sy) {
          bottom += sy.delta
          gh = [sy.at]
        }
      }
      setSnapped(gv.length || gh.length ? { slideId: d.slideId, v: gv, h: gh } : null)
      patchLayer(d.postId, d.slideId, d.origin.id, { w: Math.max(40, Math.round(right - d.origin.x)), h: Math.max(d.origin.type === 'text' ? 0 : 40, Math.round(bottom - d.origin.y)) })
    }
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    setPanning(false)
    setSnapped(null)
    setMarquee(null)
    if (d && d.kind !== 'pan' && d.kind !== 'marquee' && d.before && useEditor.getState().set !== d.before) useEditor.getState().checkpoint(d.before)
  }

  const onDouble = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-ui]')) return
    const w = world(e)
    const hit = slideAt(w.x, w.y)
    const l = hit && layerAt(hit, w.x, w.y)
    if (hit && l?.type === 'text') {
      useEditor.getState().selectLayer(l.id)
      setEditing({ postId: hit.postId, slideId: hit.slideId, layerId: l.id })
    } else if (hit && !l) {
      fit({ x: hit.x - 80, y: hit.y - 120, w: hit.w + 160, h: hit.h + 240 })
    }
  }

  const commitText = (value: string) => {
    if (!editing) return
    const { postId: pid, slideId: sid, layerId: id } = editing
    setEditing(null)
    useEditor.getState().edit((s) => ({
      ...s,
      posts: s.posts.map((p) => (p.id !== pid ? p : { ...p, slides: p.slides.map((sl) => (sl.id !== sid ? sl : { ...sl, layers: sl.layers.map((l) => (l.id === id && l.type === 'text' && l.text !== value ? { ...l, text: value } : l)) })) })),
    }))
  }

  const placed = rows.flatMap((r) => r.slides)

  // O cursor do agente foi para um slide fora da tela: a vista acompanha
  const cursorSlide = cursor?.slideId
  useEffect(() => {
    if (!cursorSlide) return
    const p = rows.flatMap((r) => r.slides).find((x) => x.slideId === cursorSlide)
    if (!p) return
    const v = viewRef.current
    const left = p.x * v.k + v.x
    const top = p.y * v.k + v.y
    const out = left + 40 < 0 || top + 40 < 0 || left + p.w * v.k - 40 > size.w || top + p.h * v.k - 40 > size.h
    if (out) setView({ k: v.k, x: size.w / 2 - (p.x + p.w / 2) * v.k, y: size.h / 2 - (p.y + p.h / 2) * v.k })
  }, [cursorSlide]) // eslint-disable-line react-hooks/exhaustive-deps
  const selected = placed.find((p) => p.slideId === slideId)
  const selLayer = selected?.slide.layers.find((l) => l.id === layerId)
  const selBox = selLayer && layerBox(selLayer)
  const hoverLayer = hover && hover.layerId !== layerId ? placed.find((p) => p.slideId === hover.slideId)?.slide.layers.find((l) => l.id === hover.layerId) : undefined
  const hoverPlaced = hover ? placed.find((p) => p.slideId === hover.slideId) : undefined
  const inv = 1 / view.k
  const editingLayer = editing ? (placed.find((p) => p.slideId === editing.slideId)?.slide.layers.find((l) => l.id === editing.layerId) as TextLayer | undefined) : undefined
  const editingPlaced = editing ? placed.find((p) => p.slideId === editing.slideId) : undefined

  return (
    <div
      ref={host}
      className={cn('relative min-h-0 flex-1 touch-none select-none overflow-hidden bg-zinc-100 outline-none', panning ? 'cursor-grabbing' : spaceDown.current ? 'cursor-grab' : 'cursor-default')}
      style={{ backgroundImage: 'radial-gradient(circle, rgb(0 0 0 / 0.16) 1px, transparent 1px)', backgroundSize: `${24 * view.k}px ${24 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => sendPointer(null)}
      onDoubleClick={onDouble}
      aria-label="Canvas dos criativos"
    >
      <style>{`@keyframes agentPulse{0%,100%{opacity:.45}50%{opacity:1}}@keyframes agentSweep{from{left:-35%}to{left:105%}}@keyframes agentFlash{0%{opacity:1}70%{opacity:1}100%{opacity:0}}@keyframes agentBob{0%,100%{transform:translate(0,0)}50%{transform:translate(8px,-6px)}}`}</style>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {rows.map((row) => (
          <React.Fragment key={row.postId}>
            <button
              type="button"
              data-ui
              onClick={() => useEditor.getState().selectRow(row.postId)}
              title="Escolher o post inteiro (todos os cards): o agente passa a editar a fileira toda"
              className={cn('absolute flex items-baseline gap-3 whitespace-nowrap rounded-xl text-left hover:bg-violet-100/70', rowSelected && row.postId === postId && 'bg-violet-100 ring-2 ring-violet-400')}
              style={{ left: 0, top: row.y, height: HEAD - 10, fontSize: 30, padding: '0 16px' }}
            >
              <span className={cn('font-semibold', row.postId === postId ? 'text-violet-700' : 'text-zinc-800')}>{row.name}</span>
              <span className="text-[22px] text-zinc-500">{sizeOf(row.format).label} · {row.slides.length} {row.slides.length === 1 ? 'slide' : 'slides'}{rowSelected && row.postId === postId ? ' · post inteiro' : ''}</span>
            </button>
            <button
              type="button"
              data-ui
              onClick={() => useRefs.getState().add({ id: `post:${row.postId}`, kind: 'post', label: row.name, postId: row.postId }, true)}
              title="Referenciar este post no chat (@): diga o que trazer dele"
              aria-label={`Referenciar ${row.name} no chat`}
              className="absolute flex items-center justify-center rounded-xl text-zinc-500 hover:bg-violet-100 hover:text-violet-700"
              style={{ left: Math.min(row.width - 60, 1180), top: row.y, width: 64, height: HEAD - 10 }}
            >
              <AtSign style={{ width: 34, height: 34 }} />
            </button>
            {row.slides.map((p) => (
              <div key={p.slideId} className="absolute bg-white" style={{ left: p.x, top: p.y, width: p.w, height: p.h, boxShadow: p.slideId === slideId || (rowSelected && p.postId === postId) ? `0 0 0 ${3 * inv}px #8b5cf6` : `0 0 0 ${1 * inv}px rgb(0 0 0 / 0.14), 0 ${16 * inv}px ${40 * inv}px -${12 * inv}px rgb(0 0 0 / 0.25)` }}>
                {visible.has(p.slideId) ? (
                  <SlideCanvas slide={p.slide} format={p.format} images={images} scale={scale} hideLayer={editing?.slideId === p.slideId ? editing.layerId : undefined} />
                ) : (
                  <div className="h-full w-full" style={{ background: p.slide.background }} />
                )}
                {(() => {
                  const pg = gridOf(set.posts.find((x) => x.id === p.postId))
                  const mine = snapped?.slideId === p.slideId ? snapped : null
                  return pg.show || mine ? <GridOverlay format={p.format} grid={pg.show ? pg : { ...pg, margins: false, columns: 0, thirds: false, center: false, safe: false }} snap={mine} /> : null
                })()}
                <span className="pointer-events-none absolute left-0 whitespace-nowrap font-medium text-zinc-500" style={{ top: -34 * inv * 1.4, fontSize: 22, lineHeight: 1 }}>
                  {p.index + 1}
                </span>
              </div>
            ))}
            <button
              type="button"
              data-ui
              onClick={(e) => {
                const r = host.current!.getBoundingClientRect()
                setMenu({ postId: row.postId, x: e.clientX - r.left, y: e.clientY - r.top })
              }}
              className="absolute flex items-center justify-center rounded-3xl border-2 border-dashed border-zinc-400 text-zinc-500 hover:border-violet-500 hover:text-violet-600"
              style={{ left: row.addX, top: row.y + HEAD, width: sizeOf(row.format).width * 0.3, height: sizeOf(row.format).height, fontSize: 28 }}
              aria-label={`Novo slide em ${row.name}`}
            >
              <span className="flex flex-col items-center gap-3"><Plus style={{ width: 64, height: 64 }} />Novo slide</span>
            </button>
          </React.Fragment>
        ))}

        {/* Realce ao passar o mouse e seleção */}
        {hoverLayer && hoverPlaced && (() => {
          const b = layerBox(hoverLayer)
          return <div className="pointer-events-none absolute" style={{ left: hoverPlaced.x + b.x, top: hoverPlaced.y + b.y, width: b.w, height: b.h, outline: `${2 * inv}px solid rgb(139 92 246 / 0.55)` }} />
        })()}
        {/* Um componente escolhido: contorno, alça de tamanho e nome */}
        {selected && selBox && layerIds.length <= 1 && (
          <div className="pointer-events-none absolute" style={{ left: selected.x + selBox.x, top: selected.y + selBox.y, width: selBox.w, height: selBox.h, outline: `${3 * inv}px solid #8b5cf6` }}>
            {!selLayer!.locked && <span className="absolute rounded-sm border-violet-500 bg-white" style={{ right: -9 * inv, bottom: -9 * inv, width: 18 * inv, height: 18 * inv, borderWidth: 3 * inv, borderStyle: 'solid' }} />}
            <span className="absolute left-0 whitespace-nowrap rounded bg-violet-600 px-1.5 py-0.5 font-medium text-white" style={{ bottom: '100%', marginBottom: 6 * inv, fontSize: 12 * inv * 1.6 }}>{selLayer!.name}{selLayer!.locked ? ' · travado' : ''}{selLayer!.group ? ' · grupo' : ''}</span>
          </div>
        )}
        {/* Vários escolhidos: cada um com contorno fino e uma caixa em volta de todos */}
        {selected && layerIds.length > 1 && (() => {
          const chosen = selected.slide.layers.filter((l) => layerIds.includes(l.id))
          if (!chosen.length) return null
          const all = boundsOf(chosen)
          return (
            <>
              {chosen.map((l) => {
                const b = layerBox(l)
                return <div key={l.id} className="pointer-events-none absolute" style={{ left: selected.x + b.x, top: selected.y + b.y, width: b.w, height: b.h, outline: `${2 * inv}px solid rgb(139 92 246 / 0.85)` }} />
              })}
              <div className="pointer-events-none absolute" style={{ left: selected.x + all.x, top: selected.y + all.y, width: all.w, height: all.h, outline: `${3 * inv}px dashed #7c3aed` }}>
                <span className="absolute left-0 whitespace-nowrap rounded bg-violet-600 px-1.5 py-0.5 font-medium text-white" style={{ bottom: '100%', marginBottom: 6 * inv, fontSize: 12 * inv * 1.6 }}>{chosen.length} componentes</span>
              </div>
            </>
          )
        })()}
        {marquee && (() => {
          const m = placed.find((p) => p.slideId === marquee.slideId)
          return m ? <div className="pointer-events-none absolute" style={{ left: m.x + marquee.x, top: m.y + marquee.y, width: marquee.w, height: marquee.h, background: 'rgb(139 92 246 / 0.12)', outline: `${2 * inv}px solid #8b5cf6` }} /> : null
        })()}

        {/* O agente à vista: o alvo do pedido, o cursor que passa de elemento em elemento e o que mudou */}
        {working && (() => {
          const t = working.target
          const A = agentInfo(working.agent)
          const rects: { x: number; y: number; w: number; h: number }[] = []
          const slideOf = (id?: string) => placed.find((p) => p.slideId === id)
          if (t.scope === 'layer') {
            const p = slideOf(t.slideId)
            const l = p?.slide.layers.find((x) => x.id === t.layerId)
            if (p && l) {
              const b = layerBox(l)
              rects.push({ x: p.x + b.x, y: p.y + b.y, w: b.w, h: b.h })
            }
          } else if (t.scope === 'slide') {
            const p = slideOf(t.slideId)
            if (p) rects.push({ x: p.x, y: p.y, w: p.w, h: p.h })
          } else if (t.scope === 'post') placed.filter((p) => p.postId === t.postId).forEach((p) => rects.push({ x: p.x, y: p.y, w: p.w, h: p.h }))
          else placed.forEach((p) => rects.push({ x: p.x, y: p.y, w: p.w, h: p.h }))
          return rects.map((r, i) => (
            <div key={i} className="pointer-events-none absolute overflow-hidden" style={{ left: r.x, top: r.y, width: r.w, height: r.h, outline: `${3 * inv}px dashed ${A.color}`, animation: 'agentPulse 1.4s ease-in-out infinite' }}>
              <div className="absolute inset-y-0 w-1/3" style={{ background: `linear-gradient(90deg, transparent, ${A.color}33, transparent)`, animation: 'agentSweep 1.8s linear infinite' }} />
            </div>
          ))
        })()}
        {flash.map((id) => {
          const p = placed.find((x) => x.slideId === id)
          const A = agentInfo(cursor?.agent ?? working?.agent ?? 'claude')
          return p ? <div key={id} className="pointer-events-none absolute" style={{ left: p.x, top: p.y, width: p.w, height: p.h, outline: `${5 * inv}px solid ${A.color}`, animation: 'agentFlash 3.2s ease-out forwards' }} /> : null
        })}
        {cursor && (() => {
          const p = placed.find((x) => x.slideId === cursor.slideId)
          if (!p) return null
          const A = agentInfo(cursor.agent)
          const l = cursor.layerId ? p.slide.layers.find((x) => x.id === cursor.layerId) : undefined
          const b = l && layerBox(l)
          const cx = b ? p.x + b.x + Math.min(b.w * 0.5, 420) : p.x + p.w * 0.5
          const cy = b ? p.y + b.y + Math.min(b.h * 0.5, 160) : p.y + p.h * 0.45
          const text = working ? PHASE_LABEL[working.phase] : cursor.text
          return (
            <div className="pointer-events-none absolute left-0 top-0 z-20" style={{ transform: `translate(${cx}px, ${cy}px) scale(${inv * 1.35})`, transformOrigin: '0 0', transition: 'transform .8s cubic-bezier(.22,1,.36,1)' }}>
              <div style={{ animation: working ? 'agentBob 1.6s ease-in-out infinite' : undefined }}>
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden style={{ filter: 'drop-shadow(0 2px 3px rgb(0 0 0 / 0.35))' }}>
                  <path d="M3 2l17 8.2-7.4 2.1L9.6 20z" fill={A.color} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                <span className="absolute left-5 top-5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-lg" style={{ background: A.color }}>
                  {A.name}{text ? ` · ${text}` : ''}
                </span>
              </div>
            </div>
          )
        })()}

        {/* As outras pessoas: seleção, mouse e o agente que cada uma está usando */}
        {people.map((person) => {
          const c = peerCursors[person.userId]
          if (!c) return null
          const slide = placed.find((p) => p.slideId === c.slideId)
          const layer = slide?.slide.layers.find((l) => l.id === c.layerId)
          const b = layer && layerBox(layer)
          return (
            <React.Fragment key={person.userId}>
              {slide && (
                <div className="pointer-events-none absolute" style={b ? { left: slide.x + b.x, top: slide.y + b.y, width: b.w, height: b.h, outline: `${3 * inv}px solid ${person.color}` } : { left: slide.x, top: slide.y, width: slide.w, height: slide.h, outline: `${3 * inv}px solid ${person.color}` }}>
                  <span className="absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-semibold text-white" style={{ bottom: '100%', marginBottom: 4 * inv, background: person.color, fontSize: 12 * inv * 1.5 }}>{person.name}</span>
                </div>
              )}
              <div className="pointer-events-none absolute left-0 top-0 z-20" style={{ transform: `translate(${c.x}px, ${c.y}px) scale(${inv * 1.3})`, transformOrigin: '0 0', transition: 'transform .12s linear' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ filter: 'drop-shadow(0 2px 3px rgb(0 0 0 / 0.3))' }}>
                  <path d="M3 2l17 8.2-7.4 2.1L9.6 20z" fill={person.color} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                <span className="absolute left-4 top-4 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow" style={{ background: person.color }}>{person.name}</span>
              </div>
            </React.Fragment>
          )
        })}
        {Object.values(peerAgents).map((a) => {
          const slide = placed.find((p) => p.slideId === a.slideId)
          if (!slide) return null
          const A = agentInfo(a.agent)
          const layer = slide.slide.layers.find((l) => l.id === a.layerId)
          const b = layer && layerBox(layer)
          const cx = b ? slide.x + b.x + Math.min(b.w * 0.5, 420) : slide.x + slide.w * 0.5
          const cy = b ? slide.y + b.y + Math.min(b.h * 0.5, 160) : slide.y + slide.h * 0.45
          return (
            <div key={a.key} className="pointer-events-none absolute left-0 top-0 z-20" style={{ transform: `translate(${cx}px, ${cy}px) scale(${inv * 1.35})`, transformOrigin: '0 0', transition: 'transform .8s cubic-bezier(.22,1,.36,1)' }}>
              <div style={{ animation: 'agentBob 1.6s ease-in-out infinite' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden style={{ filter: 'drop-shadow(0 2px 3px rgb(0 0 0 / 0.35))' }}>
                  <path d="M3 2l17 8.2-7.4 2.1L9.6 20z" fill={A.color} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                <span className="absolute left-5 top-5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-lg" style={{ background: A.color }}>
                  {A.name} · {a.owner}{a.text ? ` · ${a.text}` : ''}
                </span>
              </div>
            </div>
          )
        })}

        {/* Barra do slide escolhido */}
        {selected && (
          <div className="absolute" style={{ left: selected.x + selected.w, top: selected.y - 24 * inv, width: 0, height: 0 }}>
            <div data-ui className="absolute bottom-0 right-0 flex items-center gap-1 whitespace-nowrap rounded-xl border bg-white p-1 shadow-lg" style={{ height: 36, transform: `scale(${inv * 1.4})`, transformOrigin: 'right bottom' }}>
              <span className="px-2 text-xs font-semibold text-gray-700">Slide {selected.index + 1}</span>
              <BarButton label="Referenciar no chat (@): diga o que trazer daqui" onClick={() => useRefs.getState().add({ id: `slide:${selected.slideId}`, kind: 'slide', label: `${set.posts.find((x) => x.id === selected.postId)?.name ?? 'Post'} · slide ${selected.index + 1}`, postId: selected.postId, slideId: selected.slideId }, true)}><AtSign className="h-4 w-4" /></BarButton>
              <BarButton label="Ampliar" onClick={() => fit({ x: selected.x - 80, y: selected.y - 120, w: selected.w + 160, h: selected.h + 240 })}><Maximize2 className="h-4 w-4" /></BarButton>
              <BarButton label="Baixar slide" onClick={() => onDownloadSlide(selected.postId, selected.slideId)}><Download className="h-4 w-4" /></BarButton>
              <BarButton label="Duplicar slide" onClick={() => onDuplicateSlide(selected.postId, selected.slideId)}><Copy className="h-4 w-4" /></BarButton>
              <BarButton label="Excluir slide" danger onClick={() => onDeleteSlide(selected.postId, selected.slideId)}><Trash2 className="h-4 w-4" /></BarButton>
            </div>
          </div>
        )}

        {/* Edição do texto no lugar */}
        {editing && editingLayer && editingPlaced && (
          <textarea
            data-ui
            autoFocus
            defaultValue={editingLayer.text}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commitText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
                e.preventDefault()
                e.currentTarget.blur()
              }
              e.stopPropagation()
            }}
            onInput={(e) => {
              e.currentTarget.style.height = '0'
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
            }}
            ref={(el) => {
              if (el) el.style.height = `${Math.max(el.scrollHeight, layerBox(editingLayer).h)}px`
            }}
            spellCheck={false}
            className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
            style={{
              left: editingPlaced.x + editingLayer.x,
              top: editingPlaced.y + editingLayer.y,
              width: editingLayer.w,
              minHeight: layerBox(editingLayer).h,
              font: fontCss(editingLayer),
              lineHeight: editingLayer.lineHeight,
              letterSpacing: `${editingLayer.letterSpacing}em`,
              color: editingLayer.color,
              textAlign: editingLayer.align,
              textTransform: editingLayer.upper ? 'uppercase' : undefined,
              outline: `${3 * inv}px solid #8b5cf6`,
              transform: editingLayer.rotation ? `rotate(${editingLayer.rotation}deg)` : undefined,
            }}
          />
        )}
      </div>

      {menu && (
        <div data-ui className="absolute z-30 w-72 rounded-xl border bg-white p-1.5 shadow-xl" style={{ left: Math.min(menu.x, size.w - 300), top: Math.min(menu.y, size.h - 330) }}>
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => { onAddSlide(menu.postId, t.id); setMenu(null) }} className="block w-full rounded-lg px-2.5 py-2 text-left hover:bg-gray-50">
              <span className="block text-sm font-medium text-gray-900">{t.name}</span>
              <span className="block text-xs text-gray-500">{t.hint}</span>
            </button>
          ))}
        </div>
      )}

      <div data-ui className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-xl border bg-white p-1 shadow-md">
        <BarButton label="Menos zoom" onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.25)}><Minus className="h-4 w-4" /></BarButton>
        <button type="button" onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / view.k)} className="h-8 w-14 rounded-md text-xs font-semibold tabular-nums text-gray-700 hover:bg-gray-100" title="100%">{Math.round(view.k * 100)}%</button>
        <BarButton label="Mais zoom" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.25)}><Plus className="h-4 w-4" /></BarButton>
        <BarButton label="Ver tudo" onClick={() => fit()}><Scan className="h-4 w-4" /></BarButton>
      </div>
      <p className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/80 px-2 py-1 text-[11px] text-gray-500">Arraste o fundo para mover · Ctrl/⌘ + roda para zoom · dois cliques no texto para editar</p>
    </div>
  )
}

const BarButton: React.FC<{ label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }> = ({ label, onClick, danger, children }) => (
  <button type="button" title={label} aria-label={label} onClick={onClick} className={cn('flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100', danger ? 'text-red-600' : 'text-gray-700')}>
    {children}
  </button>
)
