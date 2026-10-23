import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { drawSlide, layerBox } from './render'
import { currentSlide, useEditor } from './store'
import { sizeOf, type Layer } from './types'

/** A área de edição: o slide no tamanho real, escalado para caber, com seleção, arrasto e redimensionamento. */

type Drag = { kind: 'move' | 'resize'; startX: number; startY: number; origin: Layer; before: ReturnType<typeof useEditor.getState>['set'] }

export const Stage: React.FC = () => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [scale, setScale] = useState(0.4)

  const set = useEditor((s) => s.set)
  const slide = useEditor(currentSlide)
  const postId = useEditor((s) => s.postId)
  const layerId = useEditor((s) => s.layerId)
  const images = useEditor((s) => s.images)
  const format = set?.posts.find((p) => p.id === postId)?.format ?? '4x5'
  const { width, height } = sizeOf(format)

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const fit = () => setScale(Math.min((el.clientWidth - 48) / width, (el.clientHeight - 48) / height, 1))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (ctx && slide) drawSlide(ctx, slide, format, images)
  }, [slide, format, images])

  // Imagens dos slides novos
  useEffect(() => {
    if (!slide) return
    for (const l of slide.layers) if (l.type === 'image' && l.src) void useEditor.getState().ensureImage(l.src)
  }, [slide])

  if (!slide) return <div ref={wrap} className="flex flex-1 items-center justify-center text-sm text-gray-500">Este post ainda não tem slides.</div>

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  const hit = (x: number, y: number) => {
    for (let i = slide.layers.length - 1; i >= 0; i--) {
      const b = layerBox(slide.layers[i])
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return slide.layers[i]
    }
  }

  const patch = (id: string, fields: Partial<Layer>) =>
    useEditor.getState().draft((s) => ({
      ...s,
      posts: s.posts.map((p) =>
        p.id !== postId ? p : { ...p, slides: p.slides.map((sl) => (sl.id !== slide.id ? sl : { ...sl, layers: sl.layers.map((l) => (l.id === id ? ({ ...l, ...fields } as Layer) : l)) })) }
      ),
    }))

  const down = (e: React.PointerEvent) => {
    const p = point(e)
    const state = useEditor.getState()
    const selected = slide.layers.find((l) => l.id === layerId)
    if (selected) {
      const b = layerBox(selected)
      if (Math.hypot(p.x - (b.x + b.w), p.y - (b.y + b.h)) < 28 / scale) {
        drag.current = { kind: 'resize', startX: p.x, startY: p.y, origin: selected, before: state.set }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }
    const target = hit(p.x, p.y)
    state.selectLayer(target?.id)
    if (target) {
      drag.current = { kind: 'move', startX: p.x, startY: p.y, origin: target, before: state.set }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = point(e)
    const dx = p.x - d.startX
    const dy = p.y - d.startY
    if (d.kind === 'move') patch(d.origin.id, { x: Math.round(d.origin.x + dx), y: Math.round(d.origin.y + dy) })
    else patch(d.origin.id, { w: Math.max(40, Math.round(d.origin.w + dx)), h: Math.max(d.origin.type === 'text' ? 0 : 40, Math.round(d.origin.h + dy)) })
  }

  const up = () => {
    const d = drag.current
    drag.current = null
    if (d?.before && useEditor.getState().set !== d.before) useEditor.getState().checkpoint(d.before)
  }

  const selected = slide.layers.find((l) => l.id === layerId)
  const box = selected && layerBox(selected)

  return (
    <div ref={wrap} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-zinc-200/70" onPointerDown={(e) => e.target === e.currentTarget && useEditor.getState().selectLayer(undefined)}>
      <div className="relative shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_40px_-12px_rgb(0_0_0/0.3)]" style={{ width: width * scale, height: height * scale }}>
        <canvas
          ref={canvas}
          width={width}
          height={height}
          className="block touch-none"
          style={{ width: width * scale, height: height * scale }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          aria-label="Área de edição do slide"
        />
        {box && (
          <div className="pointer-events-none absolute border-2 border-violet-500" style={{ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale }}>
            <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-sm border-2 border-violet-500 bg-white" />
          </div>
        )}
      </div>
    </div>
  )
}
