import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Clapperboard, Download, Pause, PenLine, Play, Redo2, SkipBack, Undo2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { currentLayer, currentPost, currentSlide, useEditor } from './store'
import { MOTION_FX, MOTION_STYLES, MOTION_TRANSITIONS, MotionRenderer, autoPostMotion, autoSlideMotion, clearPostMotion, hasMotion, numberIn, postMotionOf, slideDuration, timeline, type MotionStyle } from './motion'
import { downloadMp4 } from './MotionPanel'
import { videoSupported } from './video'
import { sizeOf, type CreativeSet, type Layer, type LayerMotion, type MotionFx, type MotionTransition, type Post } from './types'

/**
 * Estúdio de motion: tela só para animar um criativo. Palco grande no centro,
 * linha do tempo embaixo (os slides do post e uma faixa por camada, com barras
 * que se arrastam e esticam) e, à direita, os estilos automáticos, o ritmo do
 * post e a entrada da camada escolhida. Usa o mesmo conjunto e o mesmo
 * histórico do editor dos Criativos.
 */

const SNAP = 0.05
const snap = (n: number) => Math.round(n / SNAP) * SNAP
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

const mapPost = (set: CreativeSet, postId: string, fn: (p: Post) => Post): CreativeSet => ({ ...set, posts: set.posts.map((p) => (p.id === postId ? fn(p) : p)) })

const withMotion = (postId: string, slideId: string, layerId: string, motion: LayerMotion | undefined) => (set: CreativeSet) =>
  mapPost(set, postId, (p) => ({
    ...p,
    slides: p.slides.map((sl) =>
      sl.id !== slideId
        ? sl
        : {
            ...sl,
            layers: sl.layers.map((l) => {
              if (l.id !== layerId) return l
              if (motion) return { ...l, motion } as Layer
              const { motion: _drop, ...rest } = l
              return rest as Layer
            }),
          }
    ),
  }))

const editPost = (fn: (p: Post) => Post) => {
  const { postId } = useEditor.getState()
  if (postId) useEditor.getState().edit((s) => mapPost(s, postId, fn))
}

const FX_COLOR: Partial<Record<MotionFx, string>> = { ken: 'bg-sky-500', pulse: 'bg-amber-500', wipe: 'bg-emerald-500', 'wipe-up': 'bg-emerald-500', pop: 'bg-pink-500', fade: 'bg-violet-400' }
const fxLabel = (fx: MotionFx) => MOTION_FX.find((f) => f.id === fx)?.label ?? fx

// Tela

export const MotionStudio: React.FC = () => {
  const { setId = '' } = useParams()
  const [query] = useSearchParams()
  const projectParam = query.get('projeto') ?? undefined
  const postParam = query.get('post') ?? undefined
  const status = useEditor((s) => s.status)
  const set = useEditor((s) => s.set)
  const post = useEditor(currentPost)
  const slide = useEditor(currentSlide)
  const layer = useEditor(currentLayer)
  const images = useEditor((s) => s.images)
  const saving = useEditor((s) => s.saving)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const timeRef = useRef(0)
  timeRef.current = time
  const autoDone = useRef(new Set<string>())

  useEffect(() => {
    void useEditor.getState().open(setId, projectParam)
    return () => useEditor.getState().close()
  }, [setId, projectParam])

  useEffect(() => {
    if (status === 'ready' && postParam) useEditor.getState().selectPost(postParam)
  }, [status, postParam])

  // Post sem animação nenhuma: já entra animado no estilo Suave (fade in), num passo desfazível
  useEffect(() => {
    if (status !== 'ready' || !post || autoDone.current.has(post.id)) return
    autoDone.current.add(post.id)
    // Abre tocando: em 0 s quase tudo ainda está para entrar
    setPlaying(true)
    if (hasMotion(post)) return
    editPost((p) => autoPostMotion(p, 'suave'))
    toast.success('Animado no estilo Suave. Troque o estilo à direita ou ajuste na linha do tempo.')
  }, [status, post])

  const { segments, total } = post ? timeline(post) : { segments: [], total: 0 }
  const seg = segments.find((s) => s.slide.id === slide?.id) ?? segments[0]

  // Tocar: o tempo corre o post inteiro; o slide escolhido acompanha
  useEffect(() => {
    if (!playing || !total) return
    let raf = 0
    let last = performance.now()
    let t = timeRef.current >= total - 0.05 ? 0 : timeRef.current
    const tick = (now: number) => {
      t += (now - last) / 1000
      last = now
      if (t >= total) t = 0
      setTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, total])

  useEffect(() => {
    if (!post) return
    const at = segments.find((s) => time >= s.start && time < s.start + s.dur)
    if (at && at.slide.id !== useEditor.getState().slideId) useEditor.getState().selectSlide(at.slide.id)
  }, [time]) // eslint-disable-line react-hooks/exhaustive-deps

  const seek = useCallback((t: number) => {
    setPlaying(false)
    setTime(Math.max(0, t))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const st = useEditor.getState()
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if (e.key === 'Home') seek(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seek])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => useEditor.getState().saving !== 'saved' && e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  if (status === 'loading') return <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500">Abrindo o criativo…</div>
  if (status !== 'ready' || !set || !post || !slide || !seg)
    return (
      <div className="mx-auto max-w-md py-20 text-center text-sm text-gray-600">
        <p>{status === 'missing' ? 'Este conjunto não está na sua conta.' : 'Não consegui abrir o conjunto.'}</p>
        <Link to="/motion" className="mt-3 inline-block font-medium text-gray-900 underline">Voltar ao Motion</Link>
      </div>
    )

  const exportVideo = async () => {
    setPlaying(false)
    setProgress(0)
    try {
      await downloadMp4(post, setProgress)
      toast.success('Vídeo baixado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui gerar o vídeo.')
    } finally {
      setProgress(null)
    }
  }

  const editorLink = `/criativos/${set.id}?${new URLSearchParams({ ...(set.shared && set.projectId ? { projeto: set.projectId } : {}), post: post.id }).toString()}`

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-[600px] flex-col bg-gray-50 md:h-screen">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3">
        <Link to="/motion" aria-label="Voltar ao Motion" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></Link>
        <Clapperboard className="h-4 w-4 text-violet-700" />
        <span className="max-w-[14rem] truncate text-sm font-semibold text-gray-900">{set.name}</span>
        <select aria-label="Post" value={post.id} onChange={(e) => { useEditor.getState().selectPost(e.target.value); seek(0) }} className="h-8 max-w-[14rem] rounded-md border border-gray-200 bg-white px-2 text-sm">
          {set.posts.map((p) => (<option key={p.id} value={p.id}>{p.name} · {sizeOf(p.format).label}</option>))}
        </select>
        <span className="text-xs text-gray-500">{({ saved: 'Salvo', dirty: 'Alterações…', saving: 'Salvando…', error: 'Erro ao salvar' } as const)[saving]}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canUndo} title="Desfazer (Ctrl+Z)" onClick={() => useEditor.getState().undo()}><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" onClick={() => useEditor.getState().redo()}><Redo2 className="h-4 w-4" /></Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 bg-white"><Link to={editorLink}><PenLine className="h-4 w-4" /> Editar o criativo</Link></Button>
          <Button size="sm" className="h-8 gap-1.5" disabled={!videoSupported() || progress !== null} onClick={() => void exportVideo()} title={videoSupported() ? undefined : 'Use o Chrome ou o Edge atualizados'}>
            <Download className="h-4 w-4" /> {progress !== null ? `Gerando… ${Math.round(progress * 100)}%` : 'Baixar MP4'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <StagePreview post={post} images={images} time={time} />
          <div className="flex h-11 shrink-0 items-center justify-center gap-2 border-t bg-white">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Voltar ao começo (Home)" onClick={() => seek(0)}><SkipBack className="h-4 w-4" /></Button>
            <Button size="icon" className="h-9 w-9 rounded-full" aria-label={playing ? 'Pausar' : 'Tocar'} title="Tocar ou pausar (Espaço)" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
            </Button>
            <span className="w-28 text-center text-xs tabular-nums text-gray-600">{fmt(time)} / {fmt(total)}</span>
          </div>
        </main>
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-white p-4 lg:block">
          <SidePanel post={post} slideId={slide.id} layer={layer} slideDur={seg.dur} />
        </aside>
      </div>

      <Timeline post={post} slideId={slide.id} layerId={layer?.id} time={time} onSeek={seek} onPause={() => setPlaying(false)} />
    </div>
  )
}

// Palco

const StagePreview: React.FC<{ post: Post; images: Map<string, CanvasImageSource & { width: number; height: number }>; time: number }> = ({ post, images, time }) => {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new MotionRenderer(post, images), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [fit, setFit] = useState({ w: 0, h: 0 })
  const { width, height } = sizeOf(post.format)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const k = Math.min((el.clientWidth - 48) / width, (el.clientHeight - 48) / height)
      setFit({ w: Math.max(0, Math.floor(width * k)), h: Math.max(0, Math.floor(height * k)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])

  useEffect(() => {
    renderer.update(post, images)
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !fit.w) return
    ctx.save()
    ctx.setTransform(c.width / width, 0, 0, c.height / height, 0, 0)
    renderer.draw(ctx, time)
    ctx.restore()
  }, [post, images, time, fit, renderer, width, height])

  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1)
  return (
    <div ref={box} className="relative flex min-h-0 flex-1 items-center justify-center" style={{ backgroundImage: 'radial-gradient(rgb(0 0 0 / 0.07) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <canvas ref={canvas} width={Math.round(fit.w * dpr)} height={Math.round(fit.h * dpr)} style={{ width: fit.w, height: fit.h }} className="rounded-md bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_32px_-12px_rgb(0_0_0/0.3)]" />
    </div>
  )
}

// Painel da direita

const inputClass = 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{children}</p>

const SidePanel: React.FC<{ post: Post; slideId: string; layer?: Layer; slideDur: number }> = ({ post, slideId, layer, slideDur }) => {
  const pm = postMotionOf(post)
  const slideIndex = post.slides.findIndex((s) => s.id === slideId)
  return (
    <div className="space-y-5">
      <section>
        <Label>Animar automaticamente</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {MOTION_STYLES.map((st) => (
            <button key={st.id} type="button" title={st.hint} onClick={() => { editPost((p) => autoPostMotion(p, st.id as MotionStyle)); toast.success(`Post animado no estilo ${st.label}.`) }} className="rounded-lg border border-gray-200 px-2 py-2 text-left hover:border-violet-400 hover:bg-violet-50">
              <Wand2 className="mb-1 h-3.5 w-3.5 text-violet-700" />
              <span className="block text-xs font-semibold text-gray-900">{st.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500">Vale para o post todo. Suave = fade in de cada camada na ordem de leitura.</p>
        <div className="mt-2 flex gap-3 text-xs">
          <button type="button" className="text-gray-600 underline-offset-2 hover:underline" onClick={() => editPost((p) => ({ ...p, slides: p.slides.map((s) => (s.id === slideId ? autoSlideMotion(s, p.format, 'suave') : s)) }))}>Refazer só o slide {slideIndex + 1}</button>
          <button type="button" className="text-gray-500 underline-offset-2 hover:text-red-600 hover:underline" onClick={() => editPost(clearPostMotion)}>Tirar tudo</button>
        </div>
      </section>

      <section className="border-t border-gray-100 pt-4">
        <Label>Ritmo do post</Label>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Transição" className={cn(inputClass, 'col-span-2')} value={pm.transition} onChange={(e) => editPost((p) => ({ ...p, motion: { ...p.motion, transition: e.target.value as MotionTransition } }))}>
            {MOTION_TRANSITIONS.map((t) => (<option key={t.id} value={t.id}>Transição: {t.label}</option>))}
          </select>
          <label className="text-[11px] text-gray-500">Transição (s)
            <input type="number" className={inputClass} step={0.05} min={0.1} max={1.2} value={pm.transitionDur} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && editPost((p) => ({ ...p, motion: { ...p.motion, transitionDur: e.target.valueAsNumber } }))} />
          </label>
          <label className="text-[11px] text-gray-500">Cada slide
            <select className={inputClass} value={pm.slideDur > 0 ? String(pm.slideDur) : '0'} onChange={(e) => editPost((p) => ({ ...p, motion: { ...p.motion, slideDur: Number(e.target.value) || undefined } }))}>
              <option value="0">Automático</option>
              {[2, 3, 4, 5, 6, 8, 10, 15].map((n) => (<option key={n} value={n}>{n} s</option>))}
            </select>
          </label>
        </div>
      </section>

      <section className="border-t border-gray-100 pt-4">
        {layer ? <LayerFx key={layer.id} post={post} slideId={slideId} layer={layer} slideDur={slideDur} /> : <p className="text-xs text-gray-500">Clique numa faixa da linha do tempo para escolher a entrada da camada. Arraste a barra para mudar quando entra; puxe as pontas para mudar a duração. Duplo clique numa faixa parada anima a camada ali.</p>}
      </section>
    </div>
  )
}

const LayerFx: React.FC<{ post: Post; slideId: string; layer: Layer; slideDur: number }> = ({ post, slideId, layer, slideDur }) => {
  const m = layer.motion
  const apply = (motion: LayerMotion | undefined) => useEditor.getState().edit(withMotion(post.id, slideId, layer.id, motion))
  const patch = (fields: Partial<LayerMotion>) => apply({ fx: 'fade', start: 0.3, dur: 0.6, ...m, ...fields })
  const canCount = layer.type === 'text' && !!numberIn(layer.text)
  return (
    <div className="space-y-3">
      <div>
        <Label>Entrada da camada</Label>
        <p className="truncate text-sm font-semibold text-gray-900">{layer.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => apply(undefined)} className={cn('rounded-md border px-2 py-1.5 text-left text-xs', !m ? 'border-violet-500 bg-violet-50 font-semibold text-violet-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>Parada</button>
        {MOTION_FX.map((f) => (
          <button key={f.id} type="button" onClick={() => patch({ fx: f.id })} className={cn('rounded-md border px-2 py-1.5 text-left text-xs', m?.fx === f.id ? 'border-violet-500 bg-violet-50 font-semibold text-violet-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>{f.label}</button>
        ))}
      </div>
      {m && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-gray-500">Começa em (s)
            <input type="number" className={inputClass} step={SNAP} min={0} max={Math.max(1, slideDur)} value={Math.round(m.start * 100) / 100} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ start: Math.max(0, e.target.valueAsNumber) })} />
          </label>
          <label className="text-[11px] text-gray-500">Duração (s)
            <input type="number" className={inputClass} step={SNAP} min={0.1} max={5} value={Math.round(m.dur * 100) / 100} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ dur: Math.min(5, Math.max(0.1, e.target.valueAsNumber)) })} />
          </label>
          {canCount && (
            <label className="col-span-2 flex items-center justify-between gap-2 text-sm text-gray-700">Contar o número de 0 até ele<input type="checkbox" checked={!!m.count} onChange={(e) => patch({ count: e.target.checked || undefined })} /></label>
          )}
        </div>
      )}
    </div>
  )
}

// Linha do tempo

type Drag = { layerId: string; mode: 'move' | 'start' | 'end'; x: number; width: number; scale: number; from: LayerMotion; before: CreativeSet }

const NAME_W = 168

const Timeline: React.FC<{ post: Post; slideId: string; layerId?: string; time: number; onSeek: (t: number) => void; onPause: () => void }> = ({ post, slideId, layerId, time, onSeek, onPause }) => {
  const { segments, total } = timeline(post)
  const seg = segments.find((s) => s.slide.id === slideId) ?? segments[0]
  const slide = seg.slide
  const liveDur = slideDuration(post, slide)
  const [drag, setDrag] = useState<Drag | null>(null)
  // Durante o arrasto a escala fica parada (a duração automática do slide muda junto)
  const viewDur = drag ? drag.scale : Math.max(liveDur, 1)
  const local = time - seg.start
  const inSlide = local >= 0 && local < seg.dur
  const lane = useRef<HTMLDivElement>(null)
  const tracks = [...slide.layers].reverse().filter((l) => !l.hidden)

  const startDrag = (e: React.PointerEvent, l: Layer, mode: Drag['mode']) => {
    if (!l.motion || !lane.current) return
    e.preventDefault()
    e.stopPropagation()
    onPause()
    useEditor.getState().selectLayer(l.id)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ layerId: l.id, mode, x: e.clientX, width: lane.current.getBoundingClientRect().width, scale: viewDur, from: l.motion, before: useEditor.getState().set! })
  }

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return
    const dt = ((e.clientX - drag.x) / drag.width) * drag.scale
    const f = drag.from
    let next: LayerMotion
    if (drag.mode === 'move') next = { ...f, start: Math.max(0, snap(f.start + dt)) }
    else if (drag.mode === 'end') next = { ...f, dur: Math.min(5, Math.max(0.1, snap(f.dur + dt))) }
    else {
      const start = Math.min(f.start + f.dur - 0.1, Math.max(0, snap(f.start + dt)))
      next = { ...f, start, dur: Math.round((f.start + f.dur - start) * 100) / 100 }
    }
    useEditor.getState().draft(withMotion(post.id, slideId, drag.layerId, next))
  }

  const endDrag = () => {
    if (!drag) return
    if (useEditor.getState().set !== drag.before) useEditor.getState().checkpoint(drag.before)
    setDrag(null)
  }

  const seekFromLane = (clientX: number) => {
    const r = lane.current?.getBoundingClientRect()
    if (!r) return
    onSeek(seg.start + Math.min(seg.dur - 0.01, Math.max(0, ((clientX - r.left) / r.width) * viewDur)))
  }

  const ticks: number[] = []
  const step = viewDur > 10 ? 1 : 0.5
  for (let t = 0; t <= viewDur + 1e-6; t += step) ticks.push(Math.round(t * 10) / 10)

  return (
    <section className="flex h-64 shrink-0 flex-col border-t bg-white" aria-label="Linha do tempo">
      {/* Os slides do post, no tempo do vídeo */}
      <div className="flex h-9 shrink-0 items-center gap-2 overflow-y-hidden border-b px-3" style={{ scrollbarGutter: 'stable' }}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500" style={{ width: NAME_W - 12 }}>Post · {total.toFixed(1)} s</span>
        <div className="relative flex h-6 min-w-0 flex-1 gap-0.5">
          {segments.map((s, i) => (
            <button key={s.slide.id} type="button" onClick={() => { useEditor.getState().selectSlide(s.slide.id); onSeek(s.start) }} style={{ width: `${(s.dur / total) * 100}%` }} className={cn('truncate rounded px-1.5 text-left text-[11px] font-medium', s.slide.id === slideId ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              Slide {i + 1} · {s.dur.toFixed(1)} s
            </button>
          ))}
          <span className="pointer-events-none absolute -bottom-1.5 -top-1.5 w-0.5 bg-red-500" style={{ left: `${(time / Math.max(total, 0.01)) * 100}%` }} />
        </div>
      </div>

      {/* Régua do slide */}
      <div className="flex h-7 shrink-0 overflow-y-hidden border-b" style={{ scrollbarGutter: 'stable' }}>
        <div className="shrink-0 border-r px-3 text-[11px] leading-7 text-gray-500" style={{ width: NAME_W }}>Camadas</div>
        <div className="relative min-w-0 flex-1 cursor-col-resize select-none" onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); seekFromLane(e.clientX) }} onPointerMove={(e) => e.buttons === 1 && seekFromLane(e.clientX)}>
          {ticks.map((t) => (
            <span key={t} className="absolute top-0 h-full border-l border-gray-200 pl-1 text-[10px] leading-7 text-gray-400" style={{ left: `${(t / viewDur) * 100}%` }}>{Number.isInteger(t) ? `${t}s` : ''}</span>
          ))}
          {inSlide && <Playhead at={local / viewDur} head />}
        </div>
      </div>

      {/* Uma faixa por camada */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {tracks.map((l) => {
          const m = l.motion
          const selected = l.id === layerId
          const end = m ? (m.fx === 'ken' ? Math.max(m.start + m.dur, viewDur) : m.start + m.dur) : 0
          return (
            <div key={l.id} className={cn('flex h-8 border-b border-gray-100', selected && 'bg-violet-50/60')}>
              <button type="button" onClick={() => useEditor.getState().selectLayer(l.id)} className={cn('shrink-0 truncate border-r px-3 text-left text-xs', selected ? 'font-semibold text-violet-800' : 'text-gray-700 hover:bg-gray-50')} style={{ width: NAME_W }}>
                {l.name}
              </button>
              <div
                ref={l.id === tracks[0]?.id ? lane : undefined}
                className="relative min-w-0 flex-1"
                onPointerDown={() => useEditor.getState().selectLayer(l.id)}
                onDoubleClick={(e) => {
                  if (m) return
                  const r = e.currentTarget.getBoundingClientRect()
                  const start = Math.max(0, snap(((e.clientX - r.left) / r.width) * viewDur))
                  useEditor.getState().edit(withMotion(post.id, slideId, l.id, { fx: 'fade', start, dur: 0.6 }))
                  useEditor.getState().selectLayer(l.id)
                }}
              >
                {m ? (
                  <div
                    role="slider"
                    aria-label={`${l.name}: ${fxLabel(m.fx)} de ${m.start.toFixed(2)} s, ${m.dur.toFixed(2)} s`}
                    aria-valuenow={m.start}
                    tabIndex={0}
                    onPointerDown={(e) => startDrag(e, l, 'move')}
                    className={cn('absolute inset-y-1 flex cursor-grab items-center overflow-hidden rounded text-[10px] font-semibold text-white shadow-sm active:cursor-grabbing', FX_COLOR[m.fx] ?? 'bg-violet-600', selected && 'ring-2 ring-violet-900/40')}
                    style={{ left: `${(m.start / viewDur) * 100}%`, width: `${Math.max(1.5, ((end - m.start) / viewDur) * 100)}%` }}
                  >
                    <span onPointerDown={(e) => startDrag(e, l, 'start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/15" />
                    <span className="truncate px-2.5">{fxLabel(m.fx)}{m.count ? ' · conta' : ''}</span>
                    {m.fx !== 'ken' && <span onPointerDown={(e) => startDrag(e, l, 'end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/15" />}
                  </div>
                ) : (
                  <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-300" title="Parada desde o começo. Duplo clique para animar." />
                )}
                {inSlide && <Playhead at={local / viewDur} />}
              </div>
            </div>
          )
        })}
        {!tracks.length && <p className="p-4 text-xs text-gray-500">Este slide não tem camadas.</p>}
      </div>
    </section>
  )
}

const Playhead: React.FC<{ at: number; head?: boolean }> = ({ at, head }) => (
  <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-red-500" style={{ left: `${Math.min(1, at) * 100}%` }}>
    {head && <span className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-sm bg-red-500" />}
  </span>
)
