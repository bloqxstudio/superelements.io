import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, Maximize2, Minus, Plus, Scan, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { drawSlide, fontCss, layerBox, type ImageMap } from './render'
import { useEditor } from './store'
import { TEMPLATES } from './templates'
import { FORMATS, type CreativeSet, type FormatId, type Layer, type Slide, type TextLayer } from './types'

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
    const { width, height } = FORMATS[post.format]
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
  const { width, height } = FORMATS[format]
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(scale, scale)
    drawSlide(ctx, hideLayer ? { ...slide, layers: slide.layers.map((l) => (l.id === hideLayer ? { ...l, opacity: 0 } : l)) } : slide, format, images)
  }, [slide, format, images, scale, hideLayer])
  return <canvas ref={ref} width={Math.round(width * scale)} height={Math.round(height * scale)} className="block" style={{ width, height }} />
})

type View = { x: number; y: number; k: number }

type Drag =
  | { kind: 'pan'; sx: number; sy: number; view: View }
  | { kind: 'move' | 'resize'; postId: string; slideId: string; origin: Layer; px: number; py: number; before: CreativeSet | undefined }

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
    fit({ x: 0, y: 0, w: Math.min(bounds.w, first.width), h: Math.min(bounds.h, (FORMATS[first.format].height + HEAD) * 1.12) })
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

    // Alça de redimensionar da camada já selecionada
    const sel = hit.slide.layers.find((l) => l.id === state.layerId)
    if (sel && state.slideId === hit.slideId) {
      const b = layerBox(sel)
      if (Math.hypot(w.x - hit.x - (b.x + b.w), w.y - hit.y - (b.y + b.h)) < 30 / view.k) {
        drag.current = { kind: 'resize', postId: hit.postId, slideId: hit.slideId, origin: sel, px: w.x, py: w.y, before: state.set }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }
    const target = layerAt(hit, w.x, w.y)
    state.selectLayer(target?.id)
    if (target) {
      drag.current = { kind: 'move', postId: hit.postId, slideId: hit.slideId, origin: target, px: w.x, py: w.y, before: state.set }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
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
    const dx = w.x - d.px
    const dy = w.y - d.py
    if (d.kind === 'move') patchLayer(d.postId, d.slideId, d.origin.id, { x: Math.round(d.origin.x + dx), y: Math.round(d.origin.y + dy) })
    else patchLayer(d.postId, d.slideId, d.origin.id, { w: Math.max(40, Math.round(d.origin.w + dx)), h: Math.max(d.origin.type === 'text' ? 0 : 40, Math.round(d.origin.h + dy)) })
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    setPanning(false)
    if (d && d.kind !== 'pan' && d.before && useEditor.getState().set !== d.before) useEditor.getState().checkpoint(d.before)
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
      onDoubleClick={onDouble}
      aria-label="Canvas dos criativos"
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {rows.map((row) => (
          <React.Fragment key={row.postId}>
            <div className="absolute flex items-baseline gap-3 whitespace-nowrap" style={{ left: 0, top: row.y, height: HEAD, fontSize: 30 }}>
              <span className={cn('font-semibold', row.postId === postId ? 'text-violet-700' : 'text-zinc-800')}>{row.name}</span>
              <span className="text-[22px] text-zinc-500">{FORMATS[row.format].label} · {row.slides.length} {row.slides.length === 1 ? 'slide' : 'slides'}</span>
            </div>
            {row.slides.map((p) => (
              <div key={p.slideId} className="absolute bg-white" style={{ left: p.x, top: p.y, width: p.w, height: p.h, boxShadow: p.slideId === slideId ? `0 0 0 ${3 * inv}px #8b5cf6` : `0 0 0 ${1 * inv}px rgb(0 0 0 / 0.14), 0 ${16 * inv}px ${40 * inv}px -${12 * inv}px rgb(0 0 0 / 0.25)` }}>
                {visible.has(p.slideId) ? (
                  <SlideCanvas slide={p.slide} format={p.format} images={images} scale={scale} hideLayer={editing?.slideId === p.slideId ? editing.layerId : undefined} />
                ) : (
                  <div className="h-full w-full" style={{ background: p.slide.background }} />
                )}
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
              style={{ left: row.addX, top: row.y + HEAD, width: FORMATS[row.format].width * 0.3, height: FORMATS[row.format].height, fontSize: 28 }}
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
        {selected && selBox && (
          <div className="pointer-events-none absolute" style={{ left: selected.x + selBox.x, top: selected.y + selBox.y, width: selBox.w, height: selBox.h, outline: `${3 * inv}px solid #8b5cf6` }}>
            <span className="absolute rounded-sm border-violet-500 bg-white" style={{ right: -9 * inv, bottom: -9 * inv, width: 18 * inv, height: 18 * inv, borderWidth: 3 * inv, borderStyle: 'solid' }} />
            <span className="absolute left-0 whitespace-nowrap rounded bg-violet-600 px-1.5 py-0.5 font-medium text-white" style={{ bottom: '100%', marginBottom: 6 * inv, fontSize: 12 * inv * 1.6 }}>{selLayer!.name}</span>
          </div>
        )}

        {/* Barra do slide escolhido */}
        {selected && (
          <div className="absolute" style={{ left: selected.x + selected.w, top: selected.y - 24 * inv, width: 0, height: 0 }}>
            <div data-ui className="absolute bottom-0 right-0 flex items-center gap-1 whitespace-nowrap rounded-xl border bg-white p-1 shadow-lg" style={{ height: 36, transform: `scale(${inv * 1.4})`, transformOrigin: 'right bottom' }}>
              <span className="px-2 text-xs font-semibold text-gray-700">Slide {selected.index + 1}</span>
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
