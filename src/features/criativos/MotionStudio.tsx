import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Clapperboard, Code2, Diamond, Download, Film, Instagram, Music, Trash2, Pause, PenLine, Play, Redo2, SkipBack, SlidersHorizontal, Undo2, Wand2, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { currentLayer, currentPost, currentSlide, useEditor } from './store'
import { KEY_EASES, MOTION_EASES, MOTION_EXITS, MOTION_FX, MOTION_LOOPS, MOTION_STYLES, MOTION_TRANSITIONS, MotionRenderer, SLIDE_CAMERAS, autoPostMotion, autoSlideMotion, clearPostMotion, hasMotionData, coverOnlyMotion, filledKeys, hasMotion, keysAt, keysSpan, postOutput, numberIn, postMotionOf, slideDuration, snapPostToBeats, timeline, type MotionStyle } from './motion'
import { detectBeats, gridBeats } from './beats'
import { foodAdPost } from './foodAd'
import { advancedMotionLink } from './scenePost'
import { ELEVATE_STYLES, elevatePost } from './elevate'
import { audioFor } from './video'
import { OutputPicker, downloadMp4 } from './MotionPanel'
import { MotionPublish } from './MotionPublish'
import { videoSupported } from './video'
import { assetUrl, uploadAsset } from './storage'
import { sizeOf, type CreativeSet, type KeyEase, type Layer, type LayerMotion, type MotionEase, type MotionExit, type MotionFx, type MotionAudio, type MotionKey, type MotionLoop, type MotionTransition, type Post, type Slide, type SlideCamera } from './types'

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

const FX_COLOR: Partial<Record<MotionFx, string>> = { keys: 'bg-orange-500', ken: 'bg-sky-500', pulse: 'bg-amber-500', wipe: 'bg-emerald-500', 'wipe-up': 'bg-emerald-500', pop: 'bg-pink-500', fade: 'bg-violet-400' }
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
  const [publishing, setPublishing] = useState(false)
  /** Abaixo de lg o painel de animação é uma gaveta sobre o palco, aberta pelo botão Animação. */
  const [sheet, setSheet] = useState(false)
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
    // Já tem animação (mesmo marcada como estático): não mexe; estático continua estático até a pessoa
    // ligar "Animado" (antes, abrir o estúdio só para testar deixava o post animado de vez)
    if (hasMotionData(post)) return
    const brandMotion = useEditor.getState().set?.brand.motion
    const style = brandMotion?.style ?? 'suave'
    editPost((p) => autoPostMotion(p, style, brandMotion))
    toast.success(`Animado no estilo ${MOTION_STYLES.find((x) => x.id === style)?.label ?? 'Suave'}${brandMotion ? ' (o padrão da marca)' : ''}. Troque o estilo à direita ou ajuste na linha do tempo.`)
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

  // A trilha toca junto na prévia (com o volume e os fades do vídeo)
  const audioEl = useRef<HTMLAudioElement | null>(null)
  const audioCfg = post?.motion?.audio
  const audioAsset = audioCfg ? set?.assets.find((a) => `asset:${a.id}` === audioCfg.src) : undefined
  useEffect(() => {
    if (!audioAsset) {
      audioEl.current?.pause()
      audioEl.current = null
      return
    }
    let alive = true
    const el = new Audio()
    el.preload = 'auto'
    void assetUrl(audioAsset).then((url) => {
      if (!alive) return
      el.src = url
      audioEl.current = el
    })
    return () => {
      alive = false
      el.pause()
      if (audioEl.current === el) audioEl.current = null
    }
  }, [audioAsset?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = audioEl.current
    if (!el || !audioCfg) return
    const env = Math.min(1, audioCfg.fadeIn > 0 ? time / audioCfg.fadeIn : 1, audioCfg.fadeOut > 0 ? (total - time) / audioCfg.fadeOut : 1)
    el.volume = Math.max(0, Math.min(1, audioCfg.volume * env))
    const want = audioCfg.offset + time
    if (playing) {
      if (Math.abs(el.currentTime - want) > 0.25) el.currentTime = want
      if (el.paused) void el.play().catch(() => undefined)
    } else {
      if (!el.paused) el.pause()
      if (Math.abs(el.currentTime - want) > 0.05) el.currentTime = want
    }
  }, [time, playing, audioCfg, total])

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
    <div className="flex h-dvh min-h-[520px] flex-col bg-gray-50 md:min-h-[600px]">
      {/* No celular: nome e post em cima; as ações rolam de lado embaixo */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b bg-white px-3 py-1.5 md:h-12 md:flex-nowrap md:py-0">
        <Link to="/motion" aria-label="Voltar ao Motion" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></Link>
        <Clapperboard className="hidden h-4 w-4 shrink-0 text-violet-700 sm:block" />
        <span className="hidden max-w-[14rem] truncate text-sm font-semibold text-gray-900 sm:inline">{set.name}</span>
        <select aria-label="Post" value={post.id} onChange={(e) => { useEditor.getState().selectPost(e.target.value); seek(0) }} className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-sm sm:max-w-[14rem] sm:flex-none">
          {set.posts.map((p) => (<option key={p.id} value={p.id}>{p.name} · {sizeOf(p.format).label}</option>))}
        </select>
        <span className="shrink-0 text-xs text-gray-500">{({ saved: 'Salvo', dirty: 'Alterações…', saving: 'Salvando…', error: 'Erro ao salvar' } as const)[saving]}</span>
        <div className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] md:ml-auto md:w-auto md:overflow-visible [&>*]:shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canUndo} title="Desfazer (Ctrl+Z)" onClick={() => useEditor.getState().undo()}><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" onClick={() => useEditor.getState().redo()}><Redo2 className="h-4 w-4" /></Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 bg-white"><Link to={editorLink} aria-label="Editar o criativo"><PenLine className="h-4 w-4" /> <span className="hidden sm:inline">Editar o criativo</span><span className="sm:hidden">Editar</span></Link></Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 bg-white" title="Para ir além: a IA escreve a animação inteira em código a partir deste post"><Link to={advancedMotionLink(set, post.id)} aria-label="Cena em código (beta)"><Code2 className="h-4 w-4" /> <span className="hidden sm:inline">Cena em código (beta)</span><span className="sm:hidden">Código</span></Link></Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white" disabled={!videoSupported() || progress !== null} onClick={() => { setPlaying(false); setPublishing(true) }} aria-label="Publicar no Instagram"><Instagram className="h-4 w-4" /> <span className="hidden sm:inline">Publicar no Instagram</span><span className="sm:hidden">Publicar</span></Button>
          <Button size="sm" className="h-8 gap-1.5" disabled={!videoSupported() || progress !== null} onClick={() => void exportVideo()} title={videoSupported() ? undefined : 'Use o Chrome ou o Edge atualizados'}>
            <Download className="h-4 w-4" /> {progress !== null ? `Gerando… ${Math.round(progress * 100)}%` : postOutput(post) === 'carousel' ? 'Baixar o carrossel' : 'Baixar MP4'}
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <StagePreview post={post} images={images} time={time} playing={playing} />
          <div className="relative flex h-11 shrink-0 items-center justify-center gap-2 border-t bg-white">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Voltar ao começo (Home)" onClick={() => seek(0)}><SkipBack className="h-4 w-4" /></Button>
            <Button size="icon" className="h-9 w-9 rounded-full" aria-label={playing ? 'Pausar' : 'Tocar'} title="Tocar ou pausar (Espaço)" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
            </Button>
            <span className="w-28 text-center text-xs tabular-nums text-gray-600">{fmt(time)} / {fmt(total)}</span>
            <Button variant="outline" size="sm" className={cn('absolute right-2 h-8 gap-1.5 bg-white lg:hidden', sheet && 'bg-violet-50 text-violet-800')} aria-expanded={sheet} onClick={() => setSheet((o) => !o)}><SlidersHorizontal className="h-4 w-4" /> <span className="hidden min-[400px]:inline">Animação</span></Button>
          </div>
        </main>
        {/* Abaixo de lg: gaveta sobre o palco (de baixo no celular, à direita no tablet); no computador, a coluna de sempre */}
        <aside className={cn('absolute inset-x-0 bottom-0 z-30 h-[75%] overflow-y-auto rounded-t-2xl border-t bg-white p-4 shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.25)] md:inset-x-auto md:inset-y-0 md:right-0 md:h-auto md:w-80 md:rounded-none md:border-l md:border-t-0 lg:static lg:block lg:shrink-0 lg:shadow-none', sheet ? 'block' : 'hidden')}>
          <div className="-mx-4 -mt-4 mb-3 flex h-10 items-center justify-between border-b px-4 lg:hidden">
            <span className="text-sm font-semibold text-gray-900">Animação{layer ? ` · ${layer.name}` : ''}</span>
            <button type="button" aria-label="Fechar o painel" onClick={() => setSheet(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </div>
          <SidePanel post={post} slideId={slide.id} layer={layer} slideDur={seg.dur} local={Math.max(0, Math.min(seg.dur, time - seg.start))} onSeek={seek} />
        </aside>
      </div>

      <MotionPublish post={post} open={publishing} onClose={() => setPublishing(false)} />
      <Timeline post={post} slideId={slide.id} layerId={layer?.id} time={time} onSeek={seek} onPause={() => setPlaying(false)} />
    </div>
  )
}

// Palco

const StagePreview: React.FC<{ post: Post; images: Map<string, CanvasImageSource & { width: number; height: number }>; time: number; playing: boolean }> = ({ post, images, time, playing }) => {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new MotionRenderer(post, images), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [fit, setFit] = useState({ w: 0, h: 0 })
  const { width, height } = sizeOf(post.format)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const pad = el.clientWidth < 640 ? 16 : 48
      const k = Math.min((el.clientWidth - pad) / width, (el.clientHeight - pad) / height)
      setFit({ w: Math.max(0, Math.floor(width * k)), h: Math.max(0, Math.floor(height * k)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])

  useEffect(() => {
    renderer.update(post, images)
    renderer.sync(time, playing)
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !fit.w) return
    ctx.save()
    ctx.setTransform(c.width / width, 0, 0, c.height / height, 0, 0)
    renderer.draw(ctx, time)
    ctx.restore()
  }, [post, images, time, playing, fit, renderer, width, height])

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

const SidePanel: React.FC<{ post: Post; slideId: string; layer?: Layer; slideDur: number; local: number; onSeek: (t: number) => void }> = ({ post, slideId, layer, slideDur, local, onSeek }) => {
  const pm = postMotionOf(post)
  const slideIndex = post.slides.findIndex((s) => s.id === slideId)
  const slide = post.slides[slideIndex]
  const brandMotion = useEditor((s) => s.set?.brand.motion)
  const [style, setStyle] = useState<MotionStyle>(brandMotion?.style ?? 'suave')
  const saveBrand = () => {
    useEditor.getState().edit((s) => ({ ...s, brand: { ...s.brand, motion: { style, transition: pm.transition, transitionDur: pm.transitionDur } } }))
    toast.success('Padrão de motion guardado na marca. Os próximos posts animados (e a produção com IA) saem assim.')
  }
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
        <p className="text-sm font-semibold text-violet-900">Elevar o motion</p>
        <p className="mt-0.5 text-[11px] leading-snug text-violet-900/70">Pega a animação que o post já tem e transforma numa peça avançada, para qualquer negócio: cada camada vira keyframes (veja os losangos na linha do tempo), com rastro, impactos e loops.</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {ELEVATE_STYLES.map((st) => (
            <button key={st.id} type="button" title={st.hint} onClick={() => { editPost((p) => elevatePost(p, st.id)); onSeek(0); toast.success(`Motion elevado (${st.label}). Ctrl+Z desfaz; clique numa faixa para ajustar os keyframes.`) }} className="rounded-lg border border-violet-200 bg-white px-2 py-2 text-left hover:border-violet-500">
              <Zap className="mb-1 h-3.5 w-3.5 text-violet-700" />
              <span className="block text-xs font-semibold text-gray-900">{st.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <Label>Animação simples (só entradas)</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {MOTION_STYLES.map((st) => (
            <button key={st.id} type="button" title={st.hint} onClick={() => { setStyle(st.id); editPost((p) => autoPostMotion(p, st.id, brandMotion?.style === st.id ? brandMotion : undefined)); toast.success(`Post animado no estilo ${st.label}.`) }} className={cn('rounded-lg border px-2 py-2 text-left hover:border-violet-400 hover:bg-violet-50', style === st.id ? 'border-violet-500 bg-violet-50' : 'border-gray-200')}>
              <Wand2 className="mb-1 h-3.5 w-3.5 text-violet-700" />
              <span className="block text-xs font-semibold text-gray-900">{st.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500">Vale para o post todo. Suave = fade in de cada camada na ordem de leitura.</p>
        <div className="mt-2 flex gap-3 text-xs">
          <button type="button" className="text-gray-600 underline-offset-2 hover:underline" onClick={() => editPost((p) => ({ ...p, slides: p.slides.map((s) => (s.id === slideId ? autoSlideMotion(s, p.format, style) : s)) }))}>Refazer só o slide {slideIndex + 1}</button>
          {post.slides.length > 1 && <button type="button" className="text-gray-600 underline-offset-2 hover:underline" title="A capa em vídeo e os slides de dentro como fotos, num carrossel" onClick={() => { editPost((p) => coverOnlyMotion(p, style, brandMotion?.style === style ? brandMotion : undefined)); toast.success('Só a capa anima: o post vira carrossel com a capa em vídeo e o resto em foto.') }}>Só a capa</button>}
          <button type="button" className="text-gray-500 underline-offset-2 hover:text-red-600 hover:underline" onClick={() => editPost(clearPostMotion)}>Tirar tudo</button>
        </div>
      </section>

      {post.slides.length > 1 && (
        <section className="border-t border-gray-100 pt-4">
          <Label>O post vira</Label>
          <OutputPicker post={post} currentSlideId={slideId} />
        </section>
      )}

      <AdTemplate post={post} />

      <section className="border-t border-gray-100 pt-4">
        {layer ? <LayerFx key={layer.id} post={post} slideId={slideId} layer={layer} slideDur={slideDur} local={local} /> : <p className="text-xs text-gray-500">Clique numa faixa da linha do tempo para escolher a entrada da camada. Arraste a barra para mudar quando entra; puxe as pontas para mudar a duração. Duplo clique numa faixa parada anima a camada ali.</p>}
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

      <AudioSection post={post} />
      <BeatSection post={post} />
      {slide && <SlideFx post={post} slide={slide} slideIndex={slideIndex} local={local} slideDur={slideDur} onSeek={onSeek} />}
      <VideoSection post={post} slideId={slideId} />

      <section className="border-t border-gray-100 pt-4">
        <Label>Câmera do slide {slideIndex + 1}</Label>
        <select aria-label="Câmera do slide" className={inputClass} value={slide?.camera ?? ''} onChange={(e) => editPost((p) => ({ ...p, slides: p.slides.map((s) => (s.id === slideId ? { ...s, camera: (e.target.value || undefined) as SlideCamera | undefined } : s)) }))}>
          <option value="">Parada</option>
          {SLIDE_CAMERAS.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
        </select>
        <p className="mt-1 text-[11px] text-gray-500">Mexe o slide inteiro devagar; o fundo continua cobrindo a tela.</p>
      </section>

      <section className="border-t border-gray-100 pt-4">
        <Label>Padrão da marca</Label>
        <p className="text-[11px] leading-snug text-gray-500">{brandMotion ? `Hoje: ${MOTION_STYLES.find((x) => x.id === brandMotion.style)?.label}, ${MOTION_TRANSITIONS.find((x) => x.id === brandMotion.transition)?.label?.toLowerCase() ?? 'transição do estilo'}.` : 'A marca ainda não tem um padrão de motion.'} Guardar faz os próximos posts (e a produção com IA) saírem com este estilo e esta transição.</p>
        <Button type="button" variant="outline" size="sm" className="mt-2 w-full bg-white" onClick={saveBrand}>Guardar {MOTION_STYLES.find((x) => x.id === style)?.label} como padrão da marca</Button>
      </section>

    </div>
  )
}

const LayerFx: React.FC<{ post: Post; slideId: string; layer: Layer; slideDur: number; local: number }> = ({ post, slideId, layer, slideDur, local }) => {
  const m = layer.motion
  const apply = (motion: LayerMotion | undefined) => useEditor.getState().edit(withMotion(post.id, slideId, layer.id, motion))
  const patch = (fields: Partial<LayerMotion>) => {
    const next: LayerMotion = { fx: 'fade', start: 0.3, dur: 0.6, ...m, ...fields }
    // Keyframes: a barra da linha do tempo segue os pontos
    if (next.fx === 'keys') {
      if (!next.keys?.length) next.keys = [{ t: next.start, y: 260, scale: 0.6, opacity: 0 }, { t: next.start + Math.max(0.3, next.dur), y: 0, scale: 1, opacity: 1, ease: 'salto' }]
      Object.assign(next, keysSpan(next.keys))
    }
    apply(next)
  }
  const canCount = layer.type === 'text' && !!numberIn(layer.text)
  return (
    <div className="space-y-3">
      <div>
        <Label>Entrada da camada</Label>
        <p className="truncate text-sm font-semibold text-gray-900">{layer.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => apply(undefined)} className={cn('rounded-md border px-2 py-1.5 text-left text-xs', !m ? 'border-violet-500 bg-violet-50 font-semibold text-violet-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>Parada</button>
        {MOTION_FX.filter((f) => layer.type === 'text' || (f.id !== 'words' && f.id !== 'letters')).map((f) => (
          <button key={f.id} type="button" onClick={() => patch({ fx: f.id, ...(f.id === 'move' && !m?.from ? { from: { dx: -Math.round(sizeOf(post.format).width * 0.3), dy: 0, scale: 1, rotate: 0 } } : {}) })} className={cn('rounded-md border px-2 py-1.5 text-left text-xs', m?.fx === f.id ? 'border-violet-500 bg-violet-50 font-semibold text-violet-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>{f.label}</button>
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
          <label className="col-span-2 text-[11px] text-gray-500">Curva
            <select className={inputClass} value={m.ease ?? 'suave'} onChange={(e) => patch({ ease: e.target.value === 'suave' ? undefined : (e.target.value as MotionEase) })}>
              {MOTION_EASES.map((x) => (<option key={x.id} value={x.id}>{x.label}</option>))}
            </select>
          </label>
          {m.fx === 'move' && (
            <>
              <p className="col-span-2 text-[11px] font-medium text-gray-600">Vem de (a partir do lugar dela)</p>
              <label className="text-[11px] text-gray-500">Lado (px)<input type="number" className={inputClass} step={10} value={m.from?.dx ?? 0} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ from: { ...m.from, dx: e.target.valueAsNumber } })} /></label>
              <label className="text-[11px] text-gray-500">Altura (px)<input type="number" className={inputClass} step={10} value={m.from?.dy ?? 0} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ from: { ...m.from, dy: e.target.valueAsNumber } })} /></label>
              <label className="text-[11px] text-gray-500">Escala<input type="number" className={inputClass} step={0.05} min={0.1} max={4} value={m.from?.scale ?? 1} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ from: { ...m.from, scale: e.target.valueAsNumber } })} /></label>
              <label className="text-[11px] text-gray-500">Giro (°)<input type="number" className={inputClass} step={5} value={m.from?.rotate ?? 0} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ from: { ...m.from, rotate: e.target.valueAsNumber } })} /></label>
            </>
          )}
          {canCount && (
            <label className="col-span-2 flex items-center justify-between gap-2 text-sm text-gray-700">Contar o número de 0 até ele<input type="checkbox" checked={!!m.count} onChange={(e) => patch({ count: e.target.checked || undefined })} /></label>
          )}
          <label className="text-[11px] text-gray-500">Saída
            <select className={inputClass} value={m.exit ?? ''} onChange={(e) => patch({ exit: (e.target.value || undefined) as MotionExit | undefined })}>
              <option value="">Fica até o fim</option>
              {MOTION_EXITS.map((x) => (<option key={x.id} value={x.id}>{x.label}</option>))}
            </select>
          </label>
          {m.exit && (
            <label className="text-[11px] text-gray-500">Saída (s)<input type="number" className={inputClass} step={SNAP} min={0.1} max={2} value={m.exitDur ?? 0.4} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ exitDur: Math.min(2, Math.max(0.1, e.target.valueAsNumber)) })} /></label>
          )}
        </div>
      )}
      {m && <AdvancedFx m={m} patch={patch} local={local} />}
    </div>
  )
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Keyframes, loop, rastro e tremidas da camada. */
const AdvancedFx: React.FC<{ m: LayerMotion; patch: (f: Partial<LayerMotion>) => void; local: number }> = ({ m, patch, local }) => {
  const keys = m.fx === 'keys' ? filledKeys(m.keys ?? []) : []
  const setKeys = (next: MotionKey[]) => patch({ keys: next })
  const editKey = (i: number, fields: Partial<MotionKey>) => setKeys(keys.map((k, j) => (j === i ? { ...k, ...fields } : k)))
  const addHere = () => {
    const now = keysAt(m.keys ?? [], local)
    const t = r2(local)
    setKeys([...keys.filter((k) => Math.abs(k.t - t) > 0.01), { t, ...now, ease: 'suave' as KeyEase }].sort((a, b) => a.t - b.t))
  }
  const num = (label: string, value: number, on: (n: number) => void, step: number) => (
    <label className="text-[10px] text-gray-500">{label}<input type="number" className={cn(inputClass, 'h-7 px-1 text-xs')} step={step} value={r2(value)} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && on(e.target.valueAsNumber)} /></label>
  )
  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      {m.fx === 'keys' && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Keyframes</p>
            <button type="button" className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline" onClick={addHere}><Diamond className="h-3 w-3" /> Ponto em {local.toFixed(2)} s</button>
          </div>
          <p className="mb-2 text-[11px] leading-snug text-gray-500">Cada ponto diz onde a camada está naquele segundo (px a partir do lugar dela). A curva vale do ponto anterior até este: Salto passa e volta, Acelera cai, Segura corta seco.</p>
          <div className="space-y-2">
            {keys.map((k, i) => (
              <div key={i} className="rounded-md border border-gray-200 p-2">
                <div className="grid grid-cols-4 gap-1">
                  {num('Seg.', k.t, (n) => editKey(i, { t: Math.max(0, n) }), 0.05)}
                  {num('X', k.x, (n) => editKey(i, { x: n }), 10)}
                  {num('Y', k.y, (n) => editKey(i, { y: n }), 10)}
                  {num('Escala', k.scale, (n) => editKey(i, { scale: n }), 0.05)}
                  {num('Giro °', k.rotate, (n) => editKey(i, { rotate: n }), 5)}
                  {num('Larg.', k.sx, (n) => editKey(i, { sx: n }), 0.05)}
                  {num('Alt.', k.sy, (n) => editKey(i, { sy: n }), 0.05)}
                  {num('Opac.', k.opacity, (n) => editKey(i, { opacity: Math.min(1, Math.max(0, n)) }), 0.1)}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <select className={cn(inputClass, 'h-7 text-xs')} value={k.ease ?? 'suave'} disabled={i === 0} onChange={(e) => editKey(i, { ease: e.target.value as KeyEase })}>
                    {KEY_EASES.map((x) => (<option key={x.id} value={x.id}>{i === 0 ? 'Primeiro ponto' : x.label}</option>))}
                  </select>
                  <button type="button" aria-label="Tirar o ponto" disabled={keys.length <= 1} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" onClick={() => setKeys(keys.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-gray-500">Depois da entrada
          <select className={inputClass} value={m.loop ?? ''} onChange={(e) => patch({ loop: (e.target.value || undefined) as MotionLoop | undefined })}>
            <option value="">Fica parada</option>
            {MOTION_LOOPS.map((x) => (<option key={x.id} value={x.id}>{x.label}</option>))}
          </select>
        </label>
        <label className="text-[11px] text-gray-500">Velocidade
          <input type="number" className={inputClass} step={0.1} min={0.1} max={5} value={m.loopSpeed ?? 1} disabled={!m.loop} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ loopSpeed: e.target.valueAsNumber })} />
        </label>
      </div>
      <label className="flex items-center justify-between gap-2 text-sm text-gray-700">Rastro de velocidade (motion blur)<input type="checkbox" checked={!!m.blur} onChange={(e) => patch({ blur: e.target.checked || undefined })} /></label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-700">Tremidas: {m.shakes?.length ?? 0}</span>
        <div className="flex gap-2 text-xs">
          <button type="button" className="font-medium text-violet-700 hover:underline" onClick={() => patch({ shakes: [...(m.shakes ?? []), { t: r2(local), amp: 14, dur: 0.3 }] })}>Tremer em {local.toFixed(2)} s</button>
          {!!m.shakes?.length && <button type="button" className="text-gray-500 hover:text-red-600" onClick={() => patch({ shakes: undefined })}>Tirar</button>}
        </div>
      </div>
    </div>
  )
}

const editSlide = (postId: string, slideId: string, fn: (s: Slide) => Slide) => useEditor.getState().edit((set) => mapPost(set, postId, (p) => ({ ...p, slides: p.slides.map((s) => (s.id === slideId ? fn(s) : s)) })))

/** Clarões, tremidas da tela e a duração do slide. */
const SlideFx: React.FC<{ post: Post; slide: Slide; slideIndex: number; local: number; slideDur: number; onSeek: (t: number) => void }> = ({ post, slide, slideIndex, local, slideDur }) => {
  const at = r2(local)
  return (
    <section className="border-t border-gray-100 pt-4">
      <Label>Impactos no slide {slideIndex + 1}</Label>
      <div className="grid grid-cols-2 gap-1.5">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 bg-white text-xs" onClick={() => editSlide(post.id, slide.id, (s) => ({ ...s, flashes: [...(s.flashes ?? []), { t: at, dur: 0.2 }] }))}><Zap className="h-3.5 w-3.5" /> Clarão em {at.toFixed(2)} s</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 bg-white text-xs" onClick={() => editSlide(post.id, slide.id, (s) => ({ ...s, shakes: [...(s.shakes ?? []), { t: at, amp: 16, dur: 0.3 }] }))}>Tremer a tela</Button>
      </div>
      {(!!slide.flashes?.length || !!slide.shakes?.length) && (
        <ul className="mt-2 space-y-1 text-xs text-gray-600">
          {(slide.flashes ?? []).map((f, i) => (<li key={`f${i}`} className="flex items-center justify-between">Clarão em {f.t.toFixed(2)} s<button type="button" className="text-gray-400 hover:text-red-600" onClick={() => editSlide(post.id, slide.id, (s) => ({ ...s, flashes: s.flashes?.filter((_, j) => j !== i) }))}><Trash2 className="h-3.5 w-3.5" /></button></li>))}
          {(slide.shakes ?? []).map((f, i) => (<li key={`s${i}`} className="flex items-center justify-between">Tela treme em {f.t.toFixed(2)} s<button type="button" className="text-gray-400 hover:text-red-600" onClick={() => editSlide(post.id, slide.id, (s) => ({ ...s, shakes: s.shakes?.filter((_, j) => j !== i) }))}><Trash2 className="h-3.5 w-3.5" /></button></li>))}
        </ul>
      )}
      <label className="mt-3 block text-[11px] text-gray-500">Duração deste slide (s)
        <input type="number" className={inputClass} step={0.25} min={0.3} max={20} value={slide.dur ?? ''} placeholder={`Automática (${slideDur.toFixed(1)} s)`} onChange={(e) => editSlide(post.id, slide.id, (s) => ({ ...s, dur: Number.isFinite(e.target.valueAsNumber) && e.target.valueAsNumber > 0 ? e.target.valueAsNumber : undefined }))} />
      </label>
    </section>
  )
}

/** Batidas da trilha: lidas do áudio ou por BPM; o post se encaixa nelas. */
const BeatSection: React.FC<{ post: Post }> = ({ post }) => {
  const [busy, setBusy] = useState(false)
  const beats = post.motion?.beats
  const [bpm, setBpm] = useState(post.motion?.bpm ?? 120)
  const read = async () => {
    const set = useEditor.getState().set
    if (!set || !post.motion?.audio) return
    setBusy(true)
    try {
      const data = await audioFor(post, set.assets)
      if (!data) throw new Error('Não achei o arquivo da trilha.')
      const map = await detectBeats(data, post.motion.audio.offset, timeline(post).total + 2)
      editPost((p) => ({ ...p, motion: { ...p.motion, beats: map.beats, bpm: map.bpm } }))
      setBpm(map.bpm)
      toast.success(`${map.beats.length} batidas, ${Math.round(map.bpm)} BPM. Agora "Encaixar na batida".`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui ler as batidas.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="border-t border-gray-100 pt-4">
      <Label>Batidas</Label>
      <div className="grid grid-cols-2 gap-1.5">
        <Button type="button" variant="outline" size="sm" className="h-8 bg-white text-xs" disabled={busy || !post.motion?.audio} title={post.motion?.audio ? undefined : 'Ponha uma trilha antes'} onClick={() => void read()}>{busy ? 'Lendo…' : 'Ler da trilha'}</Button>
        <div className="flex items-center gap-1">
          <input type="number" aria-label="BPM" className={cn(inputClass, 'h-8')} min={40} max={240} value={bpm} onChange={(e) => setBpm(e.target.valueAsNumber || 120)} />
          <Button type="button" variant="outline" size="sm" className="h-8 bg-white px-2 text-xs" onClick={() => editPost((p) => ({ ...p, motion: { ...p.motion, bpm, beats: gridBeats(bpm, timeline(p).total + 2) } }))}>BPM</Button>
        </div>
      </div>
      <Button type="button" size="sm" className="mt-2 w-full" disabled={!beats?.length} onClick={() => { editPost(snapPostToBeats); toast.success('Entradas, keyframes, clarões e tremidas encaixados na batida mais perto.') }}>Encaixar na batida</Button>
      <p className="mt-1.5 text-[11px] leading-snug text-gray-500">{beats?.length ? `${beats.length} batidas (${Math.round(post.motion?.bpm ?? 0)} BPM), marcadas na régua.` : 'Leia as batidas da trilha (ou digite o BPM) para cortar e bater no ritmo.'} "Pulsar na batida" usa o mesmo ritmo.</p>
    </section>
  )
}

/** Os modelos publicitários prontos: criam um post novo no conjunto. */
const AdTemplate: React.FC<{ post: Post }> = () => {
  const create = () => {
    const set = useEditor.getState().set
    if (!set) return
    const colors = set.brand.colors.map((c) => c.hex)
    const ad = foodAdPost({ brand: set.brand.name || 'Sua marca', color: colors[0], accent: colors[1] })
    useEditor.getState().edit((s) => ({ ...s, posts: [...s.posts, ad] }))
    useEditor.getState().selectPost(ad.id)
    void useEditor.getState().ensureAssets()
    toast.success('Comercial criado como um post novo. Troque os pratos pelas fotos do cardápio em "Editar o criativo".')
  }
  return (
    <section className="border-t border-gray-100 pt-4">
      <Label>Comercial pronto</Label>
      <button type="button" onClick={create} className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-violet-400 hover:bg-violet-50">
        <span className="block text-sm font-semibold text-gray-900">Delivery · cardápio em movimento</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">Hamburgueria, pizzaria, restaurante. 9:16, ~25 s, na batida: frase escrita à mão, marca, celular, pratos voando com preço, moto, mapa, pedido entregue.</span>
      </button>
    </section>
  )
}

// Linha do tempo

type Drag = { layerId: string; mode: 'move' | 'start' | 'end'; x: number; width: number; scale: number; from: LayerMotion; before: CreativeSet }

const NAME_W = 168
/** No celular a coluna dos nomes das camadas fica mais estreita, para sobrar faixa de tempo. */
const NAME_W_NARROW = 96
const useNameWidth = () => {
  const query = '(max-width: 639px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow ? NAME_W_NARROW : NAME_W
}

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
  const nameW = useNameWidth()

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
    if (f.fx === 'keys' && f.keys?.length) {
      // Os keyframes andam com a barra (mover) ou se esticam junto (pontas)
      const k = f.dur > 0 ? next.dur / f.dur : 1
      next = { ...next, keys: f.keys.map((key) => ({ ...key, t: Math.round((next.start + (key.t - f.start) * k) * 100) / 100 })) }
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
    <section className="flex h-52 shrink-0 flex-col border-t bg-white md:h-64" aria-label="Linha do tempo">
      {/* Os slides do post, no tempo do vídeo */}
      <div className="flex h-9 shrink-0 items-center gap-2 overflow-y-hidden border-b px-3" style={{ scrollbarGutter: 'stable' }}>
        <span className="shrink-0 truncate text-[11px] font-medium uppercase tracking-wide text-gray-500" style={{ width: nameW - 12 }}>Post · {total.toFixed(1)} s</span>
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
      <div className="flex h-7 shrink-0 overflow-hidden border-b" style={{ scrollbarGutter: 'stable' }}>
        <div className="shrink-0 border-r px-3 text-[11px] leading-7 text-gray-500" style={{ width: nameW }}>Camadas</div>
        <div className="relative min-w-0 flex-1 cursor-col-resize touch-none select-none" onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); seekFromLane(e.clientX) }} onPointerMove={(e) => e.buttons === 1 && seekFromLane(e.clientX)}>
          {ticks.map((t) => (
            <span key={t} className="absolute top-0 h-full border-l border-gray-200 pl-1 text-[10px] leading-7 text-gray-400" style={{ left: `${(t / viewDur) * 100}%` }}>{Number.isInteger(t) ? `${t}s` : ''}</span>
          ))}
          {(post.motion?.beats ?? []).map((b, i) => { const lb = b - seg.start; return lb >= 0 && lb <= viewDur ? <span key={i} className="pointer-events-none absolute bottom-0 h-2 w-px bg-orange-400" style={{ left: `${(lb / viewDur) * 100}%` }} /> : null })}
          {[...(slide.flashes ?? []), ...(slide.shakes ?? [])].map((f, i) => (<span key={`fx${i}`} title="Impacto" className="pointer-events-none absolute top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-amber-400" style={{ left: `${(f.t / viewDur) * 100}%` }} />))}
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
              <button type="button" onClick={() => useEditor.getState().selectLayer(l.id)} className={cn('shrink-0 truncate border-r px-3 text-left text-xs', selected ? 'font-semibold text-violet-800' : 'text-gray-700 hover:bg-gray-50')} style={{ width: nameW }}>
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
                    className={cn('absolute inset-y-1 flex cursor-grab touch-none items-center overflow-hidden rounded text-[10px] font-semibold text-white shadow-sm active:cursor-grabbing', FX_COLOR[m.fx] ?? 'bg-violet-600', selected && 'ring-2 ring-violet-900/40')}
                    style={{ left: `${(m.start / viewDur) * 100}%`, width: `${Math.max(1.5, ((end - m.start) / viewDur) * 100)}%` }}
                  >
                    <span onPointerDown={(e) => startDrag(e, l, 'start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/15 [@media(pointer:coarse)]:w-4" />
                    <span className="truncate px-2.5">{fxLabel(m.fx)}{m.count ? ' · conta' : ''}{m.loop ? ' · loop' : ''}</span>
                    {m.fx === 'keys' && (m.keys ?? []).map((k, i) => (<span key={i} className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white ring-1 ring-black/30" style={{ left: `${((k.t - m.start) / Math.max(0.01, end - m.start)) * 100}%` }} />))}
                    {m.fx !== 'ken' && <span onPointerDown={(e) => startDrag(e, l, 'end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/15 [@media(pointer:coarse)]:w-4" />}
                  </div>
                ) : null}
                {m?.exit ? (
                  <span title={`Saída: ${MOTION_EXITS.find((x) => x.id === m.exit)?.label}`} className="pointer-events-none absolute inset-y-1.5 rounded bg-gray-400/70" style={{ left: `${(Math.max(0, liveDur - (m.exitDur ?? 0.4) - 0.05) / viewDur) * 100}%`, width: `${(((m.exitDur ?? 0.4)) / viewDur) * 100}%` }} />
                ) : null}
                {m ? null : (
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

// Áudio e vídeo

const AudioSection: React.FC<{ post: Post }> = ({ post }) => {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const audio = post.motion?.audio
  const setAudio = (next: MotionAudio | undefined) => editPost((p) => ({ ...p, motion: { ...p.motion, audio: next } }))
  const patch = (fields: Partial<MotionAudio>) => audio && setAudio({ ...audio, ...fields })
  const send = async (file?: File) => {
    const set = useEditor.getState().set
    if (!file || !set) return
    setBusy(true)
    try {
      const asset = await uploadAsset(set, file, file.name)
      useEditor.getState().edit((s) => ({ ...s, assets: [...s.assets, asset] }))
      setAudio({ src: `asset:${asset.id}`, name: file.name, volume: 0.8, offset: 0, fadeIn: 0.3, fadeOut: 1 })
      toast.success('Trilha no post. Ela entra no MP4 e na publicação.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar o áudio.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <section className="border-t border-gray-100 pt-4">
      <Label>Áudio do vídeo</Label>
      <input ref={input} type="file" accept="audio/*" className="hidden" onChange={(e) => void send(e.target.files?.[0])} />
      {audio ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 truncate text-sm text-gray-900"><Music className="h-3.5 w-3.5 shrink-0 text-violet-700" /> {audio.name}</p>
          <label className="block text-[11px] text-gray-500">Volume ({Math.round(audio.volume * 100)}%)
            <input type="range" min={0} max={1} step={0.05} value={audio.volume} onChange={(e) => patch({ volume: Number(e.target.value) })} className="w-full" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] text-gray-500">Começa em (s)<input type="number" className={inputClass} step={0.5} min={0} value={audio.offset} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ offset: Math.max(0, e.target.valueAsNumber) })} /></label>
            <label className="text-[11px] text-gray-500">Entrada (s)<input type="number" className={inputClass} step={0.1} min={0} max={5} value={audio.fadeIn} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ fadeIn: Math.max(0, e.target.valueAsNumber) })} /></label>
            <label className="text-[11px] text-gray-500">Saída (s)<input type="number" className={inputClass} step={0.1} min={0} max={5} value={audio.fadeOut} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && patch({ fadeOut: Math.max(0, e.target.valueAsNumber) })} /></label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 flex-1 bg-white text-xs" disabled={busy} onClick={() => input.current?.click()}>Trocar</Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-red-600" onClick={() => setAudio(undefined)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Tirar</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 bg-white" disabled={busy} onClick={() => input.current?.click()}>
          <Music className="h-4 w-4" /> {busy ? 'Enviando…' : 'Pôr trilha ou narração'}
        </Button>
      )}
      <p className="mt-1.5 text-[11px] leading-snug text-gray-500">Use só áudio com licença para uso comercial (ou gravado por vocês). Música do próprio Instagram não entra pela API: ponha no app depois de publicar.</p>
    </section>
  )
}

const VideoSection: React.FC<{ post: Post; slideId: string }> = ({ post, slideId }) => {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const send = async (file?: File) => {
    const set = useEditor.getState().set
    if (!file || !set) return
    setBusy(true)
    try {
      const asset = await uploadAsset(set, file, file.name)
      const { width, height } = sizeOf(post.format)
      // O vídeo cobre o slide (como uma foto de fundo), por baixo das outras camadas
      const layer: Layer = { id: Math.random().toString(36).slice(2, 10), type: 'image', name: `Vídeo · ${file.name}`, src: `asset:${asset.id}`, x: 0, y: 0, w: width, h: height, fit: 'cover', radius: 0, frame: 'none', motion: { fx: 'fade', start: 0, dur: 0.4 } }
      useEditor.getState().edit((s) => mapPost({ ...s, assets: [...s.assets, asset] }, post.id, (p) => ({ ...p, slides: p.slides.map((sl) => (sl.id === slideId ? { ...sl, layers: [layer, ...sl.layers] } : sl)) })))
      await useEditor.getState().ensureImage(`asset:${asset.id}`)
      useEditor.getState().selectLayer(layer.id)
      toast.success('Vídeo no fundo do slide. Mude o tamanho e a posição em "Editar o criativo".')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar o vídeo.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <section className="border-t border-gray-100 pt-4">
      <Label>Vídeo no slide</Label>
      <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => void send(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 bg-white" disabled={busy} onClick={() => input.current?.click()}>
        <Film className="h-4 w-4" /> {busy ? 'Enviando…' : 'Pôr um vídeo de fundo'}
      </Button>
      <p className="mt-1.5 text-[11px] leading-snug text-gray-500">Um clipe (produto, bastidor) que anda por baixo dos textos, em loop, mudo. Até 50 MB.</p>
    </section>
  )
}
