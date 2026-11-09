import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Code2, Download, Film, ImagePlus, Music, Pause, Play, Plus, SkipBack, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEditor } from './store'
import { SceneRunner, newScene, sceneBitmaps, sceneToMp4, SceneError } from './scene'
import { BURGER_STORY_SCENE, DELIVERY_SCENE, POST_SCENE } from './sceneExamples'
import { describePost, fontsOf, postSceneDuration, scenePost, slideImages } from './scenePost'
import { drawSlide, type ImageMap } from './render'
import { referenceFrames, writeSceneCode } from './sceneAi'
import { useAiAvailable } from './link'
import { SceneEditPanel } from './SceneEditor'
import { sceneDataOf } from './sceneEdit'
import { detectBeats, gridBeats } from './beats'
import { audioOfSrc, videoSupported } from './video'
import { assetUrl, uploadAsset } from './storage'
import { FORMATS, sizeOf, type CodeScene, type CreativeSet, type Post } from './types'

/**
 * Estúdio de cena em código: o motion avançado do Motion. A pessoa pede à IA
 * (com um vídeo de referência, se quiser) e ela escreve a cena inteira em
 * código; a prévia roda ao vivo num worker isolado e o MP4 sai no navegador.
 * As cenas ficam no conjunto (`CreativeSet.scenes`), com as imagens e a trilha dele.
 * Aberto a partir de um criativo (`?post=`), a cena nasce dele: as camadas dos
 * slides escolhidos viram peças (`scenePost`) e o prompt avançado eleva o motion.
 */

/** O que a cena recebe do criativo de origem (as peças e as fontes delas). */
async function sourceInput(scene: CodeScene, post: Post | undefined, images: ImageMap) {
  if (!scene.source || !post) return {}
  const data = await scenePost(post, scene.source.slideIds, images)
  return { post: data, fonts: fontsOf(data) }
}

const SCENE_FORMATS = ['9x16', '4x5', '1x1'] as const
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
const inputClass = 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{children}</p>

const editScene = (id: string, fn: (s: CodeScene) => CodeScene) =>
  useEditor.getState().edit((set: CreativeSet) => ({ ...set, scenes: (set.scenes ?? []).map((s) => (s.id === id ? { ...fn(s), updatedAt: Date.now() } : s)) }))

const brandOf = (set: CreativeSet) => ({ name: set.brand.name, colors: set.brand.colors.map((c) => c.hex), font: set.brand.headingFont })

/**
 * O painel da animação em código dentro do estúdio único de vídeo (`VideoStudio.tsx`, 2026-11-09). Quem abre
 * o conjunto é o estúdio único; esta parte só desenha a cena escolhida (`?id=`).
 */
export const SceneStudio: React.FC = () => {
  const { setId = '' } = useParams()
  const [query, setQuery] = useSearchParams()
  const projectParam = query.get('projeto') ?? undefined
  const status = useEditor((s) => s.status)
  const set = useEditor((s) => s.set)
  const images = useEditor((s) => s.images)
  const saving = useEditor((s) => s.saving)
  // Esta parte desenha as animações; os vídeos de roteiro e voz abrem no painel deles (o estúdio único escolhe)
  const scenes = (set?.scenes ?? []).filter((s) => !s.explainer)
  const allScenes = set?.scenes ?? []
  const postParam = query.get('post') ?? undefined
  const forPost = postParam ? scenes.filter((s) => s.source?.postId === postParam) : scenes
  const scene = scenes.find((s) => s.id === query.get('id')) ?? (postParam ? forPost.at(-1) : scenes[0])
  const sourcePost = set?.posts.find((p) => p.id === (scene?.source?.postId ?? postParam))
  const [autoAsk, setAutoAsk] = useState<{ id: string; request: string; reference?: string[] } | null>(null)
  const [fresh, setFresh] = useState(query.get('novo') === 'codigo')
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<SceneError | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  // As imagens da cena entram no mapa do editor (as das camadas já entram sozinhas)
  const sceneImageKey = scene?.images.map((i) => i.src).join('|') ?? ''
  useEffect(() => {
    if (status === 'ready') for (const i of scene?.images ?? []) void useEditor.getState().ensureImage(i.src)
  }, [status, sceneImageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id: string) => setQuery((q) => {
    const next = new URLSearchParams(q)
    next.set('id', id)
    return next
  }, { replace: true })

  const create = (code: string, name: string, duration = 20, source?: CodeScene['source'], format?: string) => {
    const s = { ...newScene(code, name), duration, ...(source ? { source } : {}), ...(format ? { format } : {}) }
    setFresh(false)
    useEditor.getState().edit((cur) => ({ ...cur, scenes: [...(cur.scenes ?? []), s] }))
    select(s.id)
    setTime(0)
    setPlaying(true)
    return s.id
  }

  // Tocar
  const timeRef = useRef(0)
  timeRef.current = time
  useEffect(() => {
    if (!playing || !scene) return
    let raf = 0
    let last = performance.now()
    let t = timeRef.current >= scene.duration - 0.05 ? 0 : timeRef.current
    const tick = (now: number) => {
      t += (now - last) / 1000
      last = now
      if (t >= scene.duration) t = 0
      setTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, scene?.duration]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trilha junto na prévia
  const audioAsset = scene?.audio ? set?.assets.find((a) => `asset:${a.id}` === scene.audio!.src) : undefined
  const audioEl = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (!audioAsset) return
    const el = new Audio()
    let alive = true
    void assetUrl(audioAsset).then((url) => alive && ((el.src = url), (audioEl.current = el)))
    return () => {
      alive = false
      el.pause()
      audioEl.current = null
    }
  }, [audioAsset?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = audioEl.current
    if (!el || !scene?.audio) return
    el.volume = scene.audio.volume
    const want = scene.audio.offset + time
    if (playing) {
      if (Math.abs(el.currentTime - want) > 0.25) el.currentTime = want
      if (el.paused) void el.play().catch(() => undefined)
    } else if (!el.paused) el.pause()
  }, [time, playing, scene?.audio])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (status === 'loading') return <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500">Abrindo o conjunto…</div>
  if (status !== 'ready' || !set)
    return (
      <div className="mx-auto max-w-md py-20 text-center text-sm text-gray-600">
        <p>{status === 'missing' ? 'Este conjunto não está na sua conta.' : 'Não consegui abrir o conjunto.'}</p>
        <Link to="/motion" className="mt-3 inline-block font-medium text-gray-900 underline">Voltar ao Motion</Link>
      </div>
    )

  const exportVideo = async () => {
    if (!scene) return
    setPlaying(false)
    setProgress(0)
    try {
      const audio = scene.audio ? await audioOfSrc(scene.audio.src, set.assets) : undefined
      const blob = await sceneToMp4(scene, { images: await sceneBitmaps(scene, images), beats: scene.beats, bpm: scene.bpm, brand: brandOf(set), data: scene.data, ...(await sourceInput(scene, sourcePost, images)) }, { audio: audio && scene.audio ? { data: audio, cfg: scene.audio } : undefined, onProgress: setProgress })
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${scene.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'cena'}.mp4` })
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      toast.success('Vídeo baixado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui gerar o vídeo.')
    } finally {
      setProgress(null)
    }
  }

  const back = '/motion'

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-[600px] flex-col bg-gray-50 md:h-screen">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3">
        <Link to={back} aria-label="Voltar ao estúdio de motion" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></Link>
        <Code2 className="h-4 w-4 text-violet-700" />
        <span className="max-w-[12rem] truncate text-sm font-semibold text-gray-900">{set.name}</span>
        {allScenes.length > 0 && (
          <select aria-label="Vídeo" value={scene?.id} onChange={(e) => { select(e.target.value); setTime(0) }} className="h-8 max-w-[14rem] rounded-md border border-gray-200 bg-white px-2 text-sm">
            {allScenes.map((s) => (<option key={s.id} value={s.id}>{s.explainer ? 'Roteiro · ' : 'Animação · '}{s.name}</option>))}
          </select>
        )}
        <span className="text-xs text-gray-500">{({ saved: 'Salvo', dirty: 'Alterações…', saving: 'Salvando…', error: 'Erro ao salvar' } as const)[saving]}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-white" onClick={() => setQuery((q) => { const n = new URLSearchParams(q); n.set('novo', 'escolher'); n.delete('id'); return n }, { replace: true })}><Plus className="h-4 w-4" /> Novo vídeo</Button>
          <NewSceneMenu onCreate={create} />
          {scene && (
            <Button size="sm" className="h-8 gap-1.5" disabled={!videoSupported() || progress !== null || !!error} onClick={() => void exportVideo()} title={videoSupported() ? undefined : 'Use o Chrome ou o Edge atualizados'}>
              <Download className="h-4 w-4" /> {progress !== null ? `Gerando… ${Math.round(progress * 100)}%` : 'Baixar MP4'}
            </Button>
          )}
        </div>
      </header>

      {!scene || fresh ? (
        postParam && set.posts.some((p) => p.id === postParam) ? (
          <FromCreative set={set} post={set.posts.find((p) => p.id === postParam)!} images={images} onCancel={scene ? () => setFresh(false) : undefined} onCreate={(src, request, reference) => {
            const p = set.posts.find((x) => x.id === postParam)!
            const id = create(POST_SCENE, `${p.name} · motion avançado`, postSceneDuration(p, src.slideIds), src, p.format)
            if (request !== null) setAutoAsk({ id, request, reference })
          }} />
        ) : (
          <Empty onCreate={create} />
        )
      ) : (
        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            <Stage key={scene.id} scene={scene} set={set} post={sourcePost} images={images} time={time} onError={setError} />
            {error && (
              <div className="mx-4 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <p className="font-semibold">A cena tem um erro: {error.message}</p>
                {error.stack2 && <pre className="mt-1 whitespace-pre-wrap text-[11px] text-red-700/80">{error.stack2}</pre>}
                <p className="mt-1 text-red-700">Peça à IA para corrigir (o erro vai junto) ou ajuste o código.</p>
              </div>
            )}
            <div className="flex h-12 shrink-0 items-center gap-3 border-t bg-white px-4">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Voltar ao começo" onClick={() => { setPlaying(false); setTime(0) }}><SkipBack className="h-4 w-4" /></Button>
              <Button size="icon" className="h-9 w-9 rounded-full" aria-label={playing ? 'Pausar' : 'Tocar'} title="Tocar ou pausar (Espaço)" onClick={() => setPlaying((p) => !p)}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
              </Button>
              <input type="range" aria-label="Tempo" className="min-w-0 flex-1 accent-violet-600" min={0} max={scene.duration} step={1 / 30} value={time} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)) }} />
              <span className="w-24 text-right text-xs tabular-nums text-gray-600">{fmt(time)} / {fmt(scene.duration)}</span>
            </div>
          </main>
          <aside className="hidden w-96 shrink-0 overflow-y-auto border-l bg-white p-4 lg:block">
            <ScenePanel key={scene.id} set={set} scene={scene} post={sourcePost} images={images} error={error} autoAsk={autoAsk?.id === scene.id ? autoAsk : null} onAutoAsked={() => setAutoAsk(null)} onNewFromCreative={postParam || scene.source ? () => { if (!postParam && scene.source) setQuery((q) => { const n = new URLSearchParams(q); n.set('post', scene.source!.postId); return n }); setFresh(true) } : undefined} />
          </aside>
        </div>
      )}
    </div>
  )
}

// Palco: um worker por versão da cena; um quadro por vez, sempre o mais recente

const Stage: React.FC<{ scene: CodeScene; set: CreativeSet; post?: Post; images: ImageMap; time: number; onError: (e: SceneError | null) => void }> = ({ scene, set, post, images, time, onError }) => {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [fit, setFit] = useState({ w: 0, h: 0 })
  const [runner, setRunner] = useState<SceneRunner | null>(null)
  const { width, height } = sizeOf(scene.format)
  const want = useRef(time)
  want.current = time
  const busy = useRef(false)
  const drawn = useRef(-1)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const k = Math.min((el.clientWidth - 48) / width, (el.clientHeight - 32) / height)
      setFit({ w: Math.max(0, Math.floor(width * k)), h: Math.max(0, Math.floor(height * k)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])

  const imageKey = scene.images.map((i) => `${i.src}=${i.name}:${images.has(i.src) ? 1 : 0}`).join('|')
  const brand = useMemo(() => brandOf(set), [set.brand]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true
    let r: SceneRunner | null = null
    const timer = setTimeout(async () => {
      try {
        r = new SceneRunner({ code: scene.code, width, height, duration: scene.duration, images: await sceneBitmaps(scene, images), beats: scene.beats, bpm: scene.bpm, brand, data: scene.data, ...(await sourceInput(scene, post, images)) })
        await r.load()
        if (!alive) return r.dispose()
        onError(null)
        drawn.current = -1
        setRunner(r)
      } catch (err) {
        if (alive) onError(err instanceof SceneError ? err : new SceneError(String(err)))
      }
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
      r?.dispose()
    }
  }, [scene.code, scene.format, scene.duration, scene.beats, scene.bpm, imageKey, brand, post, scene.source?.slideIds.join(','), images.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // Campos, legenda e narração: o mesmo worker recebe o env.data novo e redesenha, sem recarregar a cena
  const [dataTick, setDataTick] = useState(0)
  useEffect(() => {
    if (!runner) return
    let alive = true
    runner.setData(scene.data).then(() => {
      if (!alive) return
      drawn.current = -1
      setDataTick((n) => n + 1)
    }, (err) => alive && onError(err instanceof SceneError ? err : new SceneError(String(err))))
    return () => { alive = false }
  }, [runner, scene.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pede o quadro do tempo atual; se outro está a caminho, o próximo pega o tempo mais novo
  useEffect(() => {
    if (!runner || busy.current || Math.abs(drawn.current - time) < 1e-4) return
    const pull = async () => {
      busy.current = true
      try {
        while (Math.abs(drawn.current - want.current) > 1e-4) {
          const t = want.current
          const bmp = await runner.frame(t)
          const c = canvas.current
          const ctx = c?.getContext('2d')
          if (c && ctx) ctx.drawImage(bmp, 0, 0, c.width, c.height)
          bmp.close()
          drawn.current = t
          onError(null)
        }
      } catch (err) {
        onError(err instanceof SceneError ? err : new SceneError(String(err)))
      } finally {
        busy.current = false
      }
    }
    void pull()
  }, [runner, time, fit, dataTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1)
  return (
    <div ref={box} className="relative flex min-h-0 flex-1 items-center justify-center" style={{ backgroundImage: 'radial-gradient(rgb(0 0 0 / 0.07) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <canvas ref={canvas} width={Math.round(fit.w * dpr)} height={Math.round(fit.h * dpr)} style={{ width: fit.w, height: fit.h }} className="rounded-md bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_32px_-12px_rgb(0_0_0/0.3)]" />
      {!runner && <span className="absolute text-xs text-gray-500">Carregando a cena…</span>}
    </div>
  )
}

// Painel

const ScenePanel: React.FC<{ set: CreativeSet; scene: CodeScene; post?: Post; images: ImageMap; error: SceneError | null; autoAsk: { request: string; reference?: string[] } | null; onAutoAsked: () => void; onNewFromCreative?: () => void }> = ({ set, scene, post, images, error, autoAsk, onAutoAsked, onNewFromCreative }) => {
  const ai = useAiAvailable()
  const [request, setRequest] = useState(scene.prompt ?? '')
  const [reference, setReference] = useState<{ name: string; frames: string[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const [code, setCode] = useState(scene.code)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => setCode(scene.code), [scene.code])
  const refInput = useRef<HTMLInputElement>(null)

  const askAi = async (adjust: boolean, override?: { request: string; reference?: string[] }) => {
    const ctrl = new AbortController()
    abort.current = ctrl
    setBusy('Pedindo à IA…')
    setReply(null)
    const text = override?.request ?? request
    try {
      const fixing = adjust && error ? `\n\nA cena atual dá este erro; corrija: ${error.message}\n${error.stack2 ?? ''}` : ''
      // A cena nasceu de um criativo: a IA recebe as peças e vê cada slide
      let postCtx: { description: string; images: string[] } | undefined
      if (scene.source && post) {
        setBusy('Lendo o criativo…')
        postCtx = { description: describePost(await scenePost(post, scene.source.slideIds, images)), images: await slideImages(post, scene.source.slideIds, images) }
        setBusy('Pedindo à IA…')
      }
      const out = await writeSceneCode(set, scene, text + fixing, { adjust, reference: override?.reference ?? reference?.frames, post: postCtx, signal: ctrl.signal, onStep: (s) => setBusy(s) })
      editScene(scene.id, (s) => ({ ...s, code: out.code, prompt: text, duration: out.duration ?? s.duration, data: out.fields ? { ...sceneDataOf(s.data), fields: out.fields } : s.data }))
      setReply(out.reply ?? null)
      toast.success(adjust ? 'Cena ajustada.' : 'Cena escrita. Dê play.')
    } catch (err) {
      if (!ctrl.signal.aborted) toast.error(err instanceof Error ? err.message : 'A IA não respondeu.')
    } finally {
      setBusy(null)
      abort.current = null
    }
  }

  // Vindo de "Gerar com IA" no criativo: pede assim que a cena abre
  const asked = useRef(false)
  useEffect(() => {
    if (!autoAsk || asked.current || !ai) return
    asked.current = true
    onAutoAsked()
    void askAi(false, autoAsk)
  }, [autoAsk, ai]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickReference = async (file?: File) => {
    if (!file) return
    setBusy('Lendo a referência…')
    try {
      setReference({ name: file.name, frames: await referenceFrames(file) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui ler a referência.')
    } finally {
      setBusy(null)
      if (refInput.current) refInput.current.value = ''
    }
  }

  const [tab, setTab] = useState<'editar' | 'avancado'>(autoAsk ? 'avancado' : 'editar')
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Painel da animação" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
        {([['editar', 'Editar'], ['avancado', 'IA e código']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('h-7 rounded-md text-xs font-medium transition-colors', tab === id ? 'bg-white text-gray-900 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.08)]' : 'text-gray-600 hover:text-gray-900')}>{label}</button>
        ))}
      </div>
      {tab === 'editar' ? (
        <SceneEditPanel set={set} scene={scene} edit={(fn) => editScene(scene.id, fn)} />
      ) : (<>
      {scene.source && post && <SourceSlides scene={scene} post={post} images={images} onNew={onNewFromCreative} />}
      <section className={cn(scene.source && post && 'border-t border-gray-100 pt-4')}>
        <Label>Prompt avançado</Label>
        <PromptChips onPick={(t) => setRequest((r) => (r.trim() ? `${r.trim()}\n${t}` : t))} />
        <textarea className="mt-2 min-h-[140px] w-full rounded-md border border-gray-200 p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={scene.source ? 'Ex.: transforme num comercial de 15 s no estilo de app de comida: abra com o título batendo na tela, a foto do produto entrando girando com rastro, o preço carimbando na batida e a passagem entre slides contínua, com a câmera atravessando.' : "Ex.: comercial da hamburgueria, 15 s: abre com o burger explodindo em ingredientes, depois o combo com preço R$ 39,90, termina com 'Peça no app'."} value={request} onChange={(e) => setRequest(e.target.value)} />
        <input ref={refInput} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => void pickReference(e.target.files?.[0])} />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <button type="button" className="flex items-center gap-1 font-medium text-violet-700 hover:underline" onClick={() => refInput.current?.click()}><Film className="h-3.5 w-3.5" /> {reference ? 'Trocar a referência' : 'Vídeo de referência'}</button>
          {reference && <span className="flex min-w-0 items-center gap-1 text-gray-500"><span className="truncate">{reference.name} · {reference.frames.length} quadros</span><button type="button" aria-label="Tirar a referência" className="hover:text-red-600" onClick={() => setReference(null)}><Trash2 className="h-3 w-3" /></button></span>}
        </div>
        {reference && <div className="mt-2 flex gap-1 overflow-x-auto">{reference.frames.map((f, i) => (<img key={i} src={f} alt="" className="h-16 rounded border border-gray-200" />))}</div>}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button type="button" size="sm" className="gap-1.5" disabled={!ai || !!busy} onClick={() => void askAi(false)}><Sparkles className="h-3.5 w-3.5" /> {scene.source ? 'Gerar do criativo' : 'Escrever do zero'}</Button>
          <Button type="button" variant="outline" size="sm" className="bg-white" disabled={!ai || !!busy} onClick={() => void askAi(true)}>{error ? 'Corrigir o erro' : 'Ajustar esta'}</Button>
        </div>
        {busy && (
          <p className="mt-1.5 flex items-center justify-between text-[11px] text-violet-700">{busy}{abort.current && <button type="button" className="text-gray-500 hover:underline" onClick={() => abort.current?.abort()}>Parar</button>}</p>
        )}
        {!ai && <p className="mt-1.5 text-[11px] text-gray-500">Conecte a IA desta máquina (o conector dos Criativos) para pedir cenas. O exemplo e o código funcionam sem ela.</p>}
        {reply && <p className="mt-2 rounded-md bg-violet-50 p-2 text-xs leading-snug text-violet-900">{reply}</p>}
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500">{scene.source ? 'A IA vê cada slide e recebe todas as camadas do criativo (textos, fotos, a animação de antes); ' : ''}A referência serve para o estilo e o ritmo; a cena sai na marca deste conjunto. Leva de 1 a 4 minutos.</p>
      </section>

      <section className="border-t border-gray-100 pt-4">
        <Label>Cena</Label>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-3 text-[11px] text-gray-500">Nome<input className={inputClass} value={scene.name} onChange={(e) => editScene(scene.id, (s) => ({ ...s, name: e.target.value }))} /></label>
          <label className="col-span-2 text-[11px] text-gray-500">Formato
            <select className={inputClass} value={scene.format} onChange={(e) => editScene(scene.id, (s) => ({ ...s, format: e.target.value }))}>
              {SCENE_FORMATS.map((f) => (<option key={f} value={f}>{FORMATS[f].label}</option>))}
            </select>
          </label>
          <label className="text-[11px] text-gray-500">Segundos<input type="number" className={inputClass} min={1} max={90} step={0.5} value={scene.duration} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && editScene(scene.id, (s) => ({ ...s, duration: Math.min(90, Math.max(1, e.target.valueAsNumber)) }))} /></label>
        </div>
      </section>

      <SceneImages set={set} scene={scene} />
      <SceneAudio set={set} scene={scene} />

      <section className="border-t border-gray-100 pt-4">
        <Label>Código</Label>
        <textarea spellCheck={false} className="h-72 w-full rounded-md border border-gray-200 bg-gray-950 p-2 font-mono text-[11px] leading-relaxed text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={code} onChange={(e) => setCode(e.target.value)} />
        <div className="mt-1.5 flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="bg-white" disabled={code === scene.code} onClick={() => editScene(scene.id, (s) => ({ ...s, code }))}>Aplicar o código</Button>
          {code !== scene.code && <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setCode(scene.code)}>Descartar</button>}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500">Roda isolado do app, sem rede e sem acesso à sua conta. Um quadro que passa de 8 s para a cena.</p>
      </section>

      <section className="border-t border-gray-100 pt-4">
        <button type="button" className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600" onClick={() => useEditor.getState().edit((cur) => ({ ...cur, scenes: (cur.scenes ?? []).filter((s) => s.id !== scene.id) }))}><Trash2 className="h-3.5 w-3.5" /> Apagar esta cena</button>
      </section>
      </>)}
    </div>
  )
}

const SceneImages: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pictures = set.assets.filter((a) => !a.kind)
  const used = new Map(scene.images.map((i) => [i.src, i.name]))
  const toggle = (src: string, name: string) =>
    editScene(scene.id, (s) => ({ ...s, images: used.has(src) ? s.images.filter((i) => i.src !== src) : [...s.images, { src, name }] }))
  const rename = (src: string, name: string) => editScene(scene.id, (s) => ({ ...s, images: s.images.map((i) => (i.src === src ? { ...i, name: name.replace(/[^\w-]/g, '').slice(0, 24) } : i)) }))
  const send = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      const asset = await uploadAsset(set, file, file.name)
      const name = file.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[^\w]/g, '').toLowerCase().slice(0, 24) || `img${scene.images.length + 1}`
      useEditor.getState().edit((cur) => ({ ...cur, assets: [...cur.assets, asset], scenes: (cur.scenes ?? []).map((s) => (s.id === scene.id ? { ...s, images: [...s.images, { src: `asset:${asset.id}`, name }] } : s)) }))
      await useEditor.getState().ensureImage(`asset:${asset.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar a imagem.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <section className="border-t border-gray-100 pt-4">
      <Label>Imagens da cena</Label>
      <p className="mb-2 text-[11px] leading-snug text-gray-500">O código chama cada uma pelo nome (env.images.nome). Fotos de produto recortadas (PNG sem fundo) ficam melhores. No exemplo: burger, pizza, sushi, logo.</p>
      <div className="space-y-1.5">
        {pictures.map((a) => {
          const src = `asset:${a.id}`
          const on = used.has(src)
          return (
            <div key={a.id} className={cn('flex items-center gap-2 rounded-md border px-2 py-1', on ? 'border-violet-300 bg-violet-50/50' : 'border-gray-200')}>
              <input type="checkbox" checked={on} onChange={() => toggle(src, a.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[^\w]/g, '').toLowerCase().slice(0, 24) || a.id)} aria-label={`Usar ${a.name}`} />
              <span className="min-w-0 flex-1 truncate text-xs text-gray-700" title={a.name}>{a.name}</span>
              {on && <input className="h-6 w-24 rounded border border-gray-200 px-1 font-mono text-[11px]" value={used.get(src)} onChange={(e) => rename(src, e.target.value)} aria-label="Nome no código" />}
            </div>
          )
        })}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void send(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" className="mt-2 w-full gap-1.5 bg-white" disabled={busy} onClick={() => input.current?.click()}><ImagePlus className="h-4 w-4" /> {busy ? 'Enviando…' : 'Enviar imagem'}</Button>
    </section>
  )
}

const SceneAudio: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [bpm, setBpm] = useState(scene.bpm ?? 120)
  const tracks = set.assets.filter((a) => a.kind === 'audio')
  const choose = (src: string, name: string) => editScene(scene.id, (s) => ({ ...s, audio: { src, name, volume: 0.9, offset: 0, fadeIn: 0.1, fadeOut: 0.8 } }))
  const send = async (file?: File) => {
    if (!file) return
    setBusy('Enviando…')
    try {
      const asset = await uploadAsset(set, file, file.name)
      useEditor.getState().edit((cur) => ({ ...cur, assets: [...cur.assets, asset] }))
      choose(`asset:${asset.id}`, file.name)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar o áudio.')
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }
  const read = async () => {
    if (!scene.audio) return
    setBusy('Lendo as batidas…')
    try {
      const data = await audioOfSrc(scene.audio.src, set.assets)
      if (!data) throw new Error('Não achei o arquivo da trilha.')
      const map = await detectBeats(data, scene.audio.offset, scene.duration + 1)
      editScene(scene.id, (s) => ({ ...s, beats: map.beats, bpm: map.bpm }))
      setBpm(map.bpm)
      toast.success(`${map.beats.length} batidas, ${Math.round(map.bpm)} BPM. Peça à IA para "ajustar" e ela corta nelas.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui ler as batidas.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="border-t border-gray-100 pt-4">
      <Label>Trilha e batidas</Label>
      <select className={inputClass} value={scene.audio?.src ?? ''} onChange={(e) => { const a = tracks.find((x) => `asset:${x.id}` === e.target.value); if (a) choose(e.target.value, a.name); else editScene(scene.id, (s) => ({ ...s, audio: undefined })) }}>
        <option value="">Sem trilha</option>
        {tracks.map((a) => (<option key={a.id} value={`asset:${a.id}`}>{a.name}</option>))}
      </select>
      <input ref={input} type="file" accept="audio/*" className="hidden" onChange={(e) => void send(e.target.files?.[0])} />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button type="button" variant="outline" size="sm" className="gap-1 bg-white text-xs" disabled={!!busy} onClick={() => input.current?.click()}><Music className="h-3.5 w-3.5" /> Enviar trilha</Button>
        <Button type="button" variant="outline" size="sm" className="bg-white text-xs" disabled={!!busy || !scene.audio} onClick={() => void read()}>Ler as batidas</Button>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input type="number" aria-label="BPM" className={inputClass} min={40} max={240} value={bpm} onChange={(e) => setBpm(e.target.valueAsNumber || 120)} />
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 bg-white text-xs" onClick={() => editScene(scene.id, (s) => ({ ...s, bpm, beats: gridBeats(bpm, s.duration) }))}>Usar BPM</Button>
      </div>
      {busy && <p className="mt-1 text-[11px] text-violet-700">{busy}</p>}
      <p className="mt-1.5 text-[11px] leading-snug text-gray-500">{scene.beats?.length ? `${scene.beats.length} batidas, ${Math.round(scene.bpm ?? 0)} BPM: a cena lê em env.beats.` : 'Sem batidas lidas: a cena usa o BPM.'} Só áudio com licença para uso comercial.</p>
    </section>
  )
}

const SUGGESTIONS = [
  'Mais impacto: entradas com overshoot, tremida e clarão na batida',
  'Passagem contínua entre slides, a câmera atravessando de um para o outro',
  'Texto cinético: o título entra palavra por palavra, com peso',
  'Profundidade: paralaxe entre fundo, foto e texto, leve câmera 3D',
  'Estilo comercial de food: produto voando com rastro e preço carimbando',
  'Mais elegante: movimentos lentos, desfoque que abre, sem exagero',
]

const PromptChips: React.FC<{ onPick: (text: string) => void }> = ({ onPick }) => (
  <div className="flex flex-wrap gap-1">
    {SUGGESTIONS.map((t) => (
      <button key={t} type="button" onClick={() => onPick(t)} className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-800">{t.split(':')[0]}</button>
    ))}
  </div>
)

/** Miniatura de um slide do criativo. */
const SlideThumb: React.FC<{ post: Post; slideIndex: number; images: ImageMap; width?: number }> = ({ post, slideIndex, images, width = 72 }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const { width: w, height: h } = sizeOf(post.format)
  const height = Math.round((width * h) / w)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    const slide = post.slides[slideIndex]
    if (!c || !ctx || !slide) return
    ctx.save()
    ctx.scale(c.width / w, c.height / h)
    drawSlide(ctx, slide, post.format, images)
    ctx.restore()
  }, [post, slideIndex, images, w, h])
  return <canvas ref={ref} width={width * 2} height={height * 2} style={{ width, height }} className="rounded border border-gray-200 bg-white" />
}

/** Escolher os slides do criativo que entram (um, alguns ou todos). */
const SlidePicker: React.FC<{ post: Post; images: ImageMap; value: string[]; onChange: (ids: string[]) => void; size?: number }> = ({ post, images, value, onChange, size }) => (
  <div className="flex flex-wrap gap-2">
    {post.slides.map((s, i) => {
      const on = value.includes(s.id)
      return (
        <button key={s.id} type="button" aria-pressed={on} title={on ? 'Tirar este slide' : 'Pôr este slide'} onClick={() => {
          const next = on ? value.filter((id) => id !== s.id) : post.slides.filter((x) => x.id === s.id || value.includes(x.id)).map((x) => x.id)
          if (next.length) onChange(next)
        }} className={cn('relative rounded-md p-0.5 transition', on ? 'ring-2 ring-violet-500' : 'opacity-50 hover:opacity-90')}>
          <SlideThumb post={post} slideIndex={i} images={images} width={size} />
          <span className={cn('absolute left-1 top-1 rounded px-1 text-[10px] font-semibold', on ? 'bg-violet-600 text-white' : 'bg-white/90 text-gray-700')}>{i + 1}</span>
        </button>
      )
    })}
  </div>
)

const SourceSlides: React.FC<{ scene: CodeScene; post: Post; images: ImageMap; onNew?: () => void }> = ({ scene, post, images, onNew }) => (
  <section>
    <Label>Do criativo · {post.name}</Label>
    <SlidePicker post={post} images={images} value={scene.source!.slideIds} size={48} onChange={(ids) => editScene(scene.id, (s) => ({ ...s, source: { postId: post.id, slideIds: ids } }))} />
    <p className="mt-1.5 text-[11px] leading-snug text-gray-500">Mexer no criativo (texto, foto, cor) muda a cena junto. Mudar os slides aqui pode pedir um ajuste à IA.</p>
    {onNew && <button type="button" className="mt-1 text-xs font-medium text-violet-700 hover:underline" onClick={onNew}>Nova versão a partir do criativo</button>}
  </section>
)

/** Começar o motion avançado de um criativo: slides, prompt e referência. */
const FromCreative: React.FC<{ set: CreativeSet; post: Post; images: ImageMap; onCreate: (source: { postId: string; slideIds: string[] }, request: string | null, reference?: string[]) => void; onCancel?: () => void }> = ({ set, post, images, onCreate, onCancel }) => {
  const ai = useAiAvailable()
  const [slideIds, setSlideIds] = useState(post.slides.map((s) => s.id))
  const [request, setRequest] = useState('')
  const [reference, setReference] = useState<{ name: string; frames: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const animated = post.slides.some((s) => s.layers.some((l) => l.motion))
  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      setReference({ name: file.name, frames: await referenceFrames(file) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui ler a referência.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const source = { postId: post.id, slideIds }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-700"><Wand2 className="h-4 w-4" /> Motion avançado</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">{post.name}</h1>
        <p className="mt-1 text-sm text-gray-600">As camadas do criativo (textos, fotos, formas, logo){animated ? ' e a animação que ele já tem' : ''} viram peças de uma cena em código. Escreva o que quer no prompt avançado: a IA vê cada slide e eleva o motion, sem trocar o conteúdo. {set.brand.name ? `Tudo na marca ${set.brand.name}.` : ''}</p>

        <div className="mt-6">
          <Label>Slides que entram ({slideIds.length} de {post.slides.length})</Label>
          <SlidePicker post={post} images={images} value={slideIds} onChange={setSlideIds} size={84} />
        </div>

        <div className="mt-6">
          <Label>Prompt avançado</Label>
          <PromptChips onPick={(t) => setRequest((r) => (r.trim() ? `${r.trim()}\n${t}` : t))} />
          <textarea autoFocus className="mt-2 min-h-[150px] w-full rounded-md border border-gray-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={request} onChange={(e) => setRequest(e.target.value)} placeholder="Descreva o motion que você quer. Ex.: um reels de 12 s no estilo de comercial de food: o título bate na tela com tremida, a foto do lanche entra girando com rastro e pousa amassando, o preço carimba na batida, e de um slide para o outro a câmera atravessa sem corte. Fechar com o botão pulsando." />
          <input ref={input} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          <div className="mt-1.5 flex items-center gap-3 text-xs">
            <button type="button" className="flex items-center gap-1 font-medium text-violet-700 hover:underline" disabled={busy} onClick={() => input.current?.click()}><Film className="h-3.5 w-3.5" /> {busy ? 'Lendo…' : reference ? 'Trocar o vídeo de referência' : 'Vídeo de referência (opcional)'}</button>
            {reference && <span className="flex items-center gap-1 text-gray-500">{reference.name} · {reference.frames.length} quadros <button type="button" aria-label="Tirar a referência" className="hover:text-red-600" onClick={() => setReference(null)}><Trash2 className="h-3 w-3" /></button></span>}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button disabled={!ai || busy || !request.trim()} className="gap-1.5" onClick={() => onCreate(source, request, reference?.frames)}><Sparkles className="h-4 w-4" /> Gerar motion avançado com IA</Button>
          <Button variant="outline" className="bg-white" disabled={busy} onClick={() => onCreate(source, null)}>Começar pela coreografia automática</Button>
          {onCancel && <button type="button" className="text-sm text-gray-500 hover:underline" onClick={onCancel}>Voltar à cena</button>}
        </div>
        <p className="mt-2 text-xs text-gray-500">{ai ? 'A IA leva de 1 a 4 minutos. Enquanto isso a coreografia automática já toca na prévia.' : 'Conecte a IA desta máquina (o conector dos Criativos) para gerar com o prompt. A coreografia automática funciona sem ela e você ajusta o código depois.'}</p>
      </div>
    </div>
  )
}

const EXAMPLES = [
  { id: 'burger', name: 'Hamburgueria · Bateu a fome', code: BURGER_STORY_SCENE, duration: 24, hint: 'Com história: a fome às 22h47, o miojo riscado, a chapa, a mordida e o combo.' },
  { id: 'delivery', name: 'Delivery · cardápio', code: DELIVERY_SCENE, duration: 22.4, hint: 'Estilo app de comida: categorias, preço, moto, pedido entregue.' },
]

const NewSceneMenu: React.FC<{ onCreate: (code: string, name: string, duration?: number) => void }> = ({ onCreate }) => (
  <select aria-label="Nova cena" value="" className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm" onChange={(e) => { const ex = EXAMPLES.find((x) => x.id === e.target.value); if (ex) onCreate(ex.code, ex.name, ex.duration) }}>
    <option value="">+ Nova cena…</option>
    {EXAMPLES.map((ex) => (<option key={ex.id} value={ex.id}>{ex.name}</option>))}
  </select>
)

const Empty: React.FC<{ onCreate: (code: string, name: string, duration?: number) => void }> = ({ onCreate }) => (
  <div className="mx-auto max-w-lg px-6 py-16 text-center">
    <Code2 className="mx-auto h-8 w-8 text-violet-700" />
    <h1 className="mt-3 text-lg font-semibold text-gray-900">Motion avançado em código</h1>
    <p className="mt-1 text-sm text-gray-600">A IA escreve a animação inteira, quadro a quadro, como um motion designer no After Effects: câmera contínua, rastro de velocidade, texto escrito à mão, rotas que se desenham, tudo na batida. A prévia roda aqui e o MP4 sai no navegador.</p>
    <div className="mt-5 flex flex-col items-center gap-2">
      {EXAMPLES.map((ex, i) => (
        <Button key={ex.id} variant={i ? 'outline' : 'default'} onClick={() => onCreate(ex.code, ex.name, ex.duration)} className="gap-1.5" title={ex.hint}><Sparkles className="h-4 w-4" /> {ex.name}</Button>
      ))}
      <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => onCreate("// Peça à IA à direita, ou escreva aqui\nscene({\n  fonts: ['Montserrat'],\n  draw(ctx, t, env) {\n    ctx.fillStyle = (env.brand.colors[0]) || '#111'\n    ctx.fillRect(0, 0, env.width, env.height)\n    const p = lib.prog(t, 0.2, 0.8, 'outBack')\n    lib.at(ctx, env.width / 2, env.height / 2, { scale: p }, (c) => lib.text(c, env.brand.name || 'Sua marca', 0, 0, { size: 140, color: '#fff' }))\n  },\n})\n", 'Cena em branco', 5)}>Ou uma cena em branco</button>
    </div>
  </div>
)
