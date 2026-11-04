import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Clapperboard, Download, Maximize2, Pause, Play, Sparkles, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { currentLayer, currentPost, currentSlide, useEditor } from './store'
import { MOTION_FX, MOTION_TRANSITIONS, MotionRenderer, autoPostMotion, autoSlideMotion, clearPostMotion, hasMotion, numberIn, postMotionOf, slideDuration, timeline } from './motion'
import { postToMp4, videoSupported } from './video'
import type { ImageMap } from './render'
import { sizeOf, type Layer, type LayerMotion, type MotionFx, type MotionTransition, type Post } from './types'

/**
 * Aba Motion do editor: prévia do vídeo do post, a coreografia automática, a
 * linha do tempo do slide aberto, a entrada de cada camada e o MP4.
 */

const editPost = (fn: (p: Post) => Post) => {
  const { postId } = useEditor.getState()
  useEditor.getState().edit((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? fn(p) : p)) }))
}

const editMotion = (layerId: string, motion: LayerMotion | undefined) => {
  const { postId, slideId } = useEditor.getState()
  useEditor.getState().edit((s) => ({
    ...s,
    posts: s.posts.map((p) =>
      p.id !== postId
        ? p
        : {
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
          }
    ),
  }))
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'post'

// Prévia

export const MotionPlayer: React.FC<{ post: Post; images: ImageMap; startAt?: number; big?: boolean; autoPlay?: boolean }> = ({ post, images, startAt, big, autoPlay }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new MotionRenderer(post, images), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [time, setTime] = useState(startAt ?? 0)
  const [playing, setPlaying] = useState(!!autoPlay)
  const timeRef = useRef(time)
  timeRef.current = time
  const total = timeline(post).total
  const { width, height } = sizeOf(post.format)

  useEffect(() => {
    if (startAt !== undefined) setTime(startAt)
  }, [startAt])

  const paint = (t: number) => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
    renderer.draw(ctx, t)
    ctx.restore()
  }

  useEffect(() => {
    renderer.update(post, images)
    paint(timeRef.current)
  }, [post, images]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) {
      paint(time)
      return
    }
    let raf = 0
    let last = performance.now()
    let t = timeRef.current >= total - 0.05 ? 0 : timeRef.current
    const tick = (now: number) => {
      t += (now - last) / 1000
      last = now
      if (t >= total) t = 0
      paint(t)
      setTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, total]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) paint(time)
  }, [time]) // eslint-disable-line react-hooks/exhaustive-deps

  const scale = big ? Math.min(1, 560 / height, 760 / width) : 288 / width
  return (
    <div className="space-y-2">
      <canvas ref={ref} width={Math.round(width * scale * 2)} height={Math.round(height * scale * 2)} className={cn('mx-auto block rounded-md bg-gray-100 shadow-[0_0_0_1px_rgb(0_0_0/0.1)]', big ? '' : 'w-full')} style={big ? { width: width * scale, height: height * scale } : { aspectRatio: `${width} / ${height}` }} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0 bg-white" aria-label={playing ? 'Pausar' : 'Tocar'} onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <input type="range" aria-label="Tempo" min={0} max={total} step={1 / 30} value={Math.min(time, total)} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)) }} className="min-w-0 flex-1" />
        <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-gray-500">{fmt(time)} / {fmt(total)}</span>
      </div>
    </div>
  )
}

// MP4

export async function downloadMp4(post: Post, onProgress?: (p: number) => void): Promise<void> {
  await useEditor.getState().ensureAssets()
  const { set, images } = useEditor.getState()
  const fresh = set?.posts.find((p) => p.id === post.id) ?? post
  const blob = await postToMp4(fresh, images, { onProgress })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(set?.name ?? 'criativo')}-${slug(fresh.name)}.mp4`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const inputClass = 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <label className={cn('block', className)}>
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
    {children}
  </label>
)

const Seconds: React.FC<{ label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }> = ({ label, value, onChange, min = 0, max = 20, step = 0.05 }) => (
  <Field label={label}>
    <input type="number" className={inputClass} value={Math.round(value * 100) / 100} step={step} min={min} max={max} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange(Math.min(max, Math.max(min, e.target.valueAsNumber)))} />
  </Field>
)

// Painel

export const MotionPanel: React.FC = () => {
  const post = useEditor(currentPost)
  const slide = useEditor(currentSlide)
  const layer = useEditor(currentLayer)
  const images = useEditor((s) => s.images)
  const [big, setBig] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const supported = videoSupported()
  const setInfo = useEditor((s) => s.set)
  const studioLink = setInfo ? `/motion/${setInfo.id}?${new URLSearchParams({ ...(setInfo.shared && setInfo.projectId ? { projeto: setInfo.projectId } : {}), ...(post ? { post: post.id } : {}) }).toString()}` : '/motion'

  if (!post || !slide) return <p className="p-3 text-sm text-gray-500">Abra um post para animar.</p>

  const { segments } = timeline(post)
  const seg = segments.find((s) => s.slide.id === slide.id)
  const dur = slideDuration(post, slide)
  const pm = postMotionOf(post)
  const animated = hasMotion(post)
  const ordered = [...slide.layers].reverse().filter((l) => !l.hidden)

  const exportVideo = async () => {
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

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Prévia do vídeo</p>
          <Link to={studioLink} className="ml-auto mr-1 text-xs font-medium text-violet-700 hover:underline">Abrir o estúdio</Link>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Ampliar" onClick={() => setBig(true)}><Maximize2 className="h-3.5 w-3.5" /></Button>
        </div>
        <MotionPlayer post={post} images={images} startAt={seg?.start} />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => { editPost(autoPostMotion); toast.success('Post animado. Ajuste o que quiser na linha do tempo.') }}><Wand2 className="h-4 w-4" /> Animar o post</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 bg-white" onClick={() => editPost((p) => ({ ...p, slides: p.slides.map((s) => (s.id === slide.id ? autoSlideMotion(s, p.format) : s)) }))}><Sparkles className="h-4 w-4" /> Só este slide</Button>
      </div>
      {animated && (
        <button type="button" className="-mt-2 text-xs text-gray-500 underline-offset-2 hover:text-red-600 hover:underline" onClick={() => editPost(clearPostMotion)}>Tirar a animação do post</button>
      )}

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Post</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Transição" className="col-span-2">
            <select className={inputClass} value={pm.transition} onChange={(e) => editPost((p) => ({ ...p, motion: { ...p.motion, transition: e.target.value as MotionTransition } }))}>
              {MOTION_TRANSITIONS.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
            </select>
          </Field>
          <Seconds label="Transição (s)" value={pm.transitionDur} min={0.1} max={1.2} onChange={(n) => editPost((p) => ({ ...p, motion: { ...p.motion, transitionDur: n } }))} />
          <Field label="Cada slide">
            <select className={inputClass} value={pm.slideDur > 0 ? String(pm.slideDur) : '0'} onChange={(e) => editPost((p) => ({ ...p, motion: { ...p.motion, slideDur: Number(e.target.value) || undefined } }))}>
              <option value="0">Automático</option>
              {[2, 3, 4, 5, 6, 8, 10, 15].map((n) => (<option key={n} value={n}>{n} s</option>))}
            </select>
          </Field>
        </div>
        <p className="text-[11px] leading-snug text-gray-500">{post.slides.length > 1 ? `${post.slides.length} slides, ${Math.round(timeline(post).total * 10) / 10} s no total.` : `${Math.round(dur * 10) / 10} s.`} Reels e stories: o formato 9:16 aproveita a tela toda.</p>
      </div>

      <div className="space-y-1.5 border-t border-gray-100 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Linha do tempo · slide {post.slides.findIndex((s) => s.id === slide.id) + 1} ({Math.round(dur * 10) / 10} s)</p>
        <div className="space-y-0.5">
          {ordered.map((l) => {
            const m = l.motion
            const end = m?.fx === 'ken' ? dur : m ? m.start + m.dur : 0
            return (
              <button key={l.id} type="button" onClick={() => useEditor.getState().selectLayer(l.id)} className={cn('flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-gray-50', layer?.id === l.id && 'bg-violet-50')}>
                <span className="w-20 shrink-0 truncate text-[11px] text-gray-700">{l.name}</span>
                <span className="relative h-3 min-w-0 flex-1 rounded-sm bg-gray-100">
                  {m && <span className={cn('absolute inset-y-0 rounded-sm', layer?.id === l.id ? 'bg-violet-600' : 'bg-violet-400')} style={{ left: `${(m.start / dur) * 100}%`, width: `${Math.max(2, ((end - m.start) / dur) * 100)}%` }} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {layer ? (
        <LayerMotionEditor key={layer.id} layer={layer} slideDur={dur} />
      ) : (
        <p className="text-xs text-gray-500">Escolha uma camada (no card ou na linha do tempo) para mudar a entrada dela.</p>
      )}

      <div className="space-y-1.5 border-t border-gray-100 pt-3">
        <Button type="button" className="w-full gap-1.5" disabled={!supported || progress !== null} onClick={() => void exportVideo()}>
          <Download className="h-4 w-4" /> {progress !== null ? `Gerando… ${Math.round(progress * 100)}%` : 'Baixar MP4'}
        </Button>
        <p className="text-[11px] leading-snug text-gray-500">{supported ? `${sizeOf(post.format).width}×${sizeOf(post.format).height}, 30 quadros por segundo, gerado neste navegador.` : 'Este navegador não gera vídeo: use o Chrome ou o Edge atualizados.'}</p>
      </div>

      {big && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setBig(false)}>
          <div className="w-fit space-y-2 rounded-xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-6">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Clapperboard className="h-4 w-4" /> {post.name}</p>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Fechar" onClick={() => setBig(false)}><X className="h-4 w-4" /></Button>
            </div>
            <MotionPlayer post={post} images={images} big autoPlay />
          </div>
        </div>
      )}
    </div>
  )
}

const LayerMotionEditor: React.FC<{ layer: Layer; slideDur: number }> = ({ layer, slideDur }) => {
  const m = layer.motion
  const set = (patch: Partial<LayerMotion>) => editMotion(layer.id, { fx: 'rise', start: 0.3, dur: 0.6, ...m, ...patch })
  const canCount = layer.type === 'text' && !!numberIn(layer.text)
  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <p className="truncate text-sm font-semibold text-gray-900">{layer.name}</p>
      <Field label="Entrada">
        <select className={inputClass} value={m?.fx ?? ''} onChange={(e) => (e.target.value ? set({ fx: e.target.value as MotionFx }) : editMotion(layer.id, undefined))}>
          <option value="">Sem animação (já na tela)</option>
          {MOTION_FX.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
        </select>
      </Field>
      {m && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Seconds label="Começa em (s)" value={m.start} max={Math.max(1, slideDur)} onChange={(n) => set({ start: n })} />
            <Seconds label="Duração (s)" value={m.dur} min={0.1} max={5} onChange={(n) => set({ dur: n })} />
          </div>
          {canCount && (
            <label className="flex items-center justify-between gap-2 text-sm text-gray-700">
              Contar o número de 0 até ele
              <input type="checkbox" checked={!!m.count} onChange={(e) => set({ count: e.target.checked || undefined })} />
            </label>
          )}
        </>
      )}
    </div>
  )
}
