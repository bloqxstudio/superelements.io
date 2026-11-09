import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, AudioLines, Download, Pause, Play, Plus, SkipBack } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEditor } from '../store'
import { SceneError, type SceneRunner } from '../scene'
import { videoSupported } from '../video'
import type { CodeScene, CreativeSet } from '../types'
import { brandOfExplainer, clipFrame, clipVideos, explainerToMp4, grab, iconOfBeat, loadVoice, mixOptions, openVideo, runnerFor, sceneImages, seek, usesVideo, usesVoice, type Voice } from './media'
import { NewExplainer } from './NewExplainer'
import { PublishPanel, ScriptPanel, SpeechPanel, StylePanel } from './panels'
import { mixExplainer } from './sfx'
import { outBeats, outWords, segments, toSrc } from './timeline'
import { MODES } from './types'
import { PATTERN_COLOR, fmt, isBriefing } from './shared'

/**
 * Estúdio do vídeo explicativo (`/motion/:setId/explica`). Dois modos (`MODES`): a fala é a
 * narração (a animação acompanha a voz, com cortes) ou é só o briefing (a IA escreve o roteiro e
 * monta o vídeo inteiro). Tudo no design system da marca. A prévia toca com a voz tratada, a trilha
 * e os efeitos; o MP4 sai no navegador, pronto para baixar ou publicar como reels. Cada vídeo é uma
 * cena do conjunto (`CodeScene.explainer`). Criação em `NewExplainer.tsx`, painéis em `panels.tsx`.
 */

export const ExplainerStudio: React.FC = () => {
  const { setId = '' } = useParams()
  const [query, setQuery] = useSearchParams()
  const projectParam = query.get('projeto') ?? undefined
  const status = useEditor((s) => s.status)
  const set = useEditor((s) => s.set)
  const saving = useEditor((s) => s.saving)
  const list = (set?.scenes ?? []).filter((s) => s.explainer)
  const allScenes = set?.scenes ?? []
  // "Novo vídeo com roteiro e voz" no estúdio único (`?novo=roteiro`); `novo=1` dos links antigos
  const fresh = query.get('novo') === '1' || query.get('novo') === 'roteiro'
  const scene = fresh ? undefined : list.find((s) => s.id === query.get('id')) ?? list.at(-1)

  void setId; void projectParam
  const go = (patch: Record<string, string | null>) =>
    setQuery((q) => {
      const n = new URLSearchParams(q)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) n.delete(k)
        else n.set(k, v)
      }
      return n
    }, { replace: true })

  if (status === 'loading') return <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500">Abrindo o conjunto…</div>
  if (status !== 'ready' || !set)
    return (
      <div className="mx-auto max-w-md py-20 text-center text-sm text-gray-600">
        <p>{status === 'missing' ? 'Este conjunto não está na sua conta.' : 'Não consegui abrir o conjunto.'}</p>
        <Link to="/motion" className="mt-3 inline-block font-medium text-gray-900 underline">Voltar ao Motion</Link>
      </div>
    )

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-[640px] flex-col bg-gray-50 md:h-screen">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3">
        <Link to="/motion" aria-label="Voltar ao Motion" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></Link>
        <AudioLines className="h-4 w-4 text-violet-700" />
        <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-gray-900 sm:inline">{set.name}</span>
        {allScenes.length > 0 && (
          <select aria-label="Vídeo" value={fresh ? '' : scene?.id} onChange={(e) => go({ id: e.target.value, novo: null })} className="h-8 max-w-[14rem] rounded-md border border-gray-200 bg-white px-2 text-sm">
            {fresh && <option value="">Novo vídeo</option>}
            {allScenes.map((s) => (<option key={s.id} value={s.id}>{s.explainer ? 'Roteiro · ' : 'Animação · '}{s.name}</option>))}
          </select>
        )}
        {scene?.explainer && <span className="hidden rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 md:inline">{isBriefing(scene.explainer) ? 'Briefing · roteiro da IA' : 'Narração'}</span>}
        <span className="text-xs text-gray-500">{({ saved: 'Salvo', dirty: 'Alterações…', saving: 'Salvando…', error: 'Erro ao salvar' } as const)[saving]}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {!fresh && <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-white" onClick={() => go({ novo: 'escolher', id: null })}><Plus className="h-4 w-4" /> Novo vídeo</Button>}
        </div>
      </header>
      {!scene ? <NewExplainer set={set} onCreated={(id) => go({ id, novo: null })} onCancel={list.length ? () => go({ novo: null }) : undefined} /> : <Editor key={scene.id} set={set} scene={scene} />}
    </div>
  )
}

const TABS = { roteiro: 'Roteiro', estilo: 'Estilo', fala: 'Fala', publicar: 'Publicar' } as const

const Editor: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const data = scene.explainer!
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [voice, setVoice] = useState<Voice | null>(null)
  const [tab, setTab] = useState<keyof typeof TABS>('roteiro')
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void loadVoice(set, data)?.then((v) => alive && setVoice(v)).catch((err) => toast.error(err instanceof Error ? err.message : 'Não consegui abrir a fala.'))
    return () => {
      alive = false
    }
  }, [data.media?.src]) // eslint-disable-line react-hooks/exhaustive-deps

  const photoKey = data.photos.map((p) => p.src).join('|')
  useEffect(() => {
    for (const p of data.photos) void useEditor.getState().ensureImage(p.src)
  }, [photoKey]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const beats = outBeats(data, scene.duration)
  const current = beats.findIndex((b, i) => time >= b.start && (i === beats.length - 1 || time < beats[i + 1].start))
  const seekTo = (t: number) => {
    setPlaying(false)
    setTime(Math.max(0, Math.min(scene.duration, t)))
  }
  useEffect(() => {
    if (time > scene.duration) setTime(scene.duration)
  }, [scene.duration]) // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    setPlaying(false)
    setProgress(0)
    try {
      await useEditor.getState().ensureAssets()
      const blob = await explainerToMp4(scene, set, useEditor.getState().images, { onProgress: setProgress })
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${scene.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase().replace(/^-|-$/g, '') || 'video-explicativo'}.mp4` })
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      toast.success('Vídeo baixado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui gerar o vídeo.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <main className="flex min-h-[420px] min-w-0 flex-1 flex-col">
        <Preview set={set} scene={scene} voice={voice} time={time} playing={playing} onTime={setTime} onEnd={() => setPlaying(false)} />
        <Timeline scene={scene} time={time} current={current} onSeek={seekTo} />
        <div className="flex h-12 shrink-0 items-center gap-3 border-t bg-white px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Voltar ao começo" onClick={() => seekTo(0)}><SkipBack className="h-4 w-4" /></Button>
          <Button size="icon" className="h-9 w-9 rounded-full" aria-label={playing ? 'Pausar' : 'Tocar'} title="Tocar ou pausar (Espaço)" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
          </Button>
          <span className="text-xs tabular-nums text-gray-600">{fmt(time)} / {fmt(scene.duration)}</span>
          <div className="ml-auto">
            <Button size="sm" className="h-8 gap-1.5" disabled={!videoSupported() || progress !== null} onClick={() => void download()} title={videoSupported() ? undefined : 'Use o Chrome ou o Edge atualizados'}>
              <Download className="h-4 w-4" /> {progress !== null ? `Gerando… ${Math.round(progress * 100)}%` : 'Baixar MP4'}
            </Button>
          </div>
        </div>
      </main>
      <aside className="flex max-h-[60vh] w-full shrink-0 flex-col border-l bg-white lg:max-h-none lg:w-[400px]">
        <div className="flex shrink-0 gap-1 border-b px-3 pt-2" role="tablist">
          {(Object.keys(TABS) as (keyof typeof TABS)[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-t-md px-3 py-1.5 text-sm', tab === t ? '-mb-px border border-b-white bg-white font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-800')}>{t === 'fala' && isBriefing(data) ? 'Briefing' : TABS[t]}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'roteiro' && <ScriptPanel set={set} scene={scene} current={current} time={time} onSeek={seekTo} />}
          {tab === 'estilo' && <StylePanel set={set} scene={scene} />}
          {tab === 'fala' && <SpeechPanel scene={scene} onSeek={seekTo} />}
          {tab === 'publicar' && <PublishPanel set={set} scene={scene} />}
          <p className="mt-6 border-t border-gray-100 pt-3 text-[11px] text-gray-400">{MODES[data.mode ?? 'narracao'].label}.</p>
        </div>
      </aside>
    </div>
  )
}

/** Prévia: o motor no worker, o vídeo da pessoa (com os cortes) e a trilha mixada, no mesmo relógio. */
const Preview: React.FC<{ set: CreativeSet; scene: CodeScene; voice: Voice | null; time: number; playing: boolean; onTime: (t: number) => void; onEnd: () => void }> = ({ set, scene, voice, time, playing, onTime, onEnd }) => {
  const data = scene.explainer!
  const images = useEditor((s) => s.images)
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [fit, setFit] = useState({ w: 0, h: 0 })
  const [runner, setRunner] = useState<SceneRunner | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [mixed, setMixed] = useState<AudioBuffer | null>(null)
  const width = 1080
  const height = 1920

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const k = Math.min((el.clientWidth - 32) / width, (el.clientHeight - 24) / height)
      setFit({ w: Math.max(0, Math.floor(width * k)), h: Math.max(0, Math.floor(height * k)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // O motor: refeito quando o roteiro, os cortes, a marca ou o estilo mudam
  const brand = brandOfExplainer(set, data)
  const photoKey = data.photos.map((p) => `${p.src}=${p.name}:${images.has(p.src) ? 1 : 0}`).join('|')
  const dataKey = JSON.stringify([data.beats, data.endCard, data.cuts, data.mode, data.look, data.layout, data.composition, data.videoPositionY, data.captions, data.theme, data.treatment, data.mirror, data.words, scene.duration, brand, photoKey, voice?.kind])
  const drawn = useRef(-1)
  useEffect(() => {
    let alive = true
    let r: SceneRunner | null = null
    const timer = setTimeout(async () => {
      try {
        r = runnerFor(scene, set, await sceneImages(scene, set, useEditor.getState().images))
        await r.load()
        if (!alive) return r.dispose()
        setError(null)
        drawn.current = -1
        setRunner(r)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
      r?.dispose()
    }
  }, [dataKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // O vídeo da pessoa
  const wantsVideo = !!voice && usesVideo(data)
  useEffect(() => {
    if (!wantsVideo || !voice) return void setVideo(null)
    let alive = true
    void openVideo(voice.url).then((v) => alive && setVideo(v)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [wantsVideo, voice])

  // Os clipes das cenas (vídeos curtos no cartão)
  const [clips, setClips] = useState<Map<string, HTMLVideoElement>>(new Map())
  const clipKey = data.photos.filter((p) => p.kind === 'video').map((p) => p.src).join('|')
  useEffect(() => {
    let alive = true
    if (!clipKey) return void setClips(new Map())
    void clipVideos(data, set).then((m) => alive && setClips(m))
    return () => {
      alive = false
    }
  }, [clipKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // A trilha mixada (voz com cortes e tratamento, trilha de fundo, efeitos)
  const mixKey = JSON.stringify([data.beats.map((b) => [b.start, b.end, b.sfx]), data.cuts, data.mode, data.words.length, data.sfxVolume, data.voiceVolume, data.enhanceVoice, data.gateVoice, data.music, scene.duration])
  useEffect(() => {
    let alive = true
    const timer = setTimeout(async () => {
      try {
        const b = await mixExplainer(usesVoice(data) ? voice?.data : undefined, data, scene.duration, await mixOptions(set, data))
        if (alive) setMixed(b)
      } catch {
        // Sem som na prévia: o vídeo continua
      }
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [mixKey, voice]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tocar: o relógio é o do áudio; o vídeo da pessoa segue pelo tempo da fala (pula os cortes)
  const segs = segments(data)
  const segsRef = useRef(segs)
  segsRef.current = segs
  const timeRef = useRef(time)
  timeRef.current = time
  useEffect(() => {
    if (!playing) return
    const from = timeRef.current >= scene.duration - 0.05 ? 0 : timeRef.current
    const ctx = new AudioContext()
    let src: AudioBufferSourceNode | undefined
    if (mixed) {
      src = ctx.createBufferSource()
      src.buffer = mixed
      src.connect(ctx.destination)
      src.start(0, from)
    }
    // O relógio é o do sistema: em alguns navegadores embutidos (o painel do Ship Studio) o AudioContext
    // fica "running" sem avançar o currentTime, e a prévia parava em 0:00 (teste de 2026-11-08)
    void ctx.resume().catch(() => undefined)
    const p0 = performance.now()
    if (video) {
      video.currentTime = toSrc(segsRef.current, from)
      void video.play().catch(() => undefined)
    }
    let raf = 0
    const tick = () => {
      const t = from + (performance.now() - p0) / 1000
      if (t >= scene.duration) {
        onTime(scene.duration)
        onEnd()
        return
      }
      if (video) {
        const want = toSrc(segsRef.current, t)
        if (Math.abs(video.currentTime - want) > 0.12) video.currentTime = want
      }
      onTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      try {
        src?.stop()
      } catch {
        // já parou
      }
      void ctx.close()
      video?.pause()
    }
  }, [playing, mixed, video]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pede o quadro do tempo atual; com outro a caminho, o próximo pega o tempo mais novo
  const want = useRef(time)
  want.current = time
  const busy = useRef(false)
  const playingRef = useRef(playing)
  playingRef.current = playing
  useEffect(() => {
    if (!runner || busy.current || Math.abs(drawn.current - time) < 1e-4) return
    const pull = async () => {
      busy.current = true
      try {
        while (Math.abs(drawn.current - want.current) > 1e-4) {
          const t = want.current
          let frame: ImageBitmap | undefined
          if (video) {
            if (!playingRef.current) await seek(video, toSrc(segsRef.current, t))
            if (video.readyState >= 2) frame = await grab(video)
          }
          const bmp = await runner.frame(t, frame, await clipFrame(clips, data, scene.duration, t))
          const c = canvas.current
          const g = c?.getContext('2d')
          if (c && g) g.drawImage(bmp, 0, 0, c.width, c.height)
          bmp.close()
          drawn.current = t
        }
        setError(null)
      } catch (err) {
        setError(err instanceof SceneError ? err.message : String(err))
      } finally {
        busy.current = false
      }
    }
    void pull()
  }, [runner, time, fit, video, clips]) // eslint-disable-line react-hooks/exhaustive-deps

  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1)
  return (
    <div ref={box} className="relative flex min-h-0 flex-1 items-center justify-center py-3" style={{ backgroundImage: 'radial-gradient(rgb(0 0 0 / 0.07) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <canvas ref={canvas} width={Math.round(fit.w * dpr)} height={Math.round(fit.h * dpr)} style={{ width: fit.w, height: fit.h }} className="rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_32px_-12px_rgb(0_0_0/0.3)]" />
      {!runner && !error && <span className="absolute text-xs text-gray-500">Carregando a animação…</span>}
      {error && <p className="absolute bottom-4 left-4 right-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">A animação deu erro: {error}</p>}
    </div>
  )
}

const Timeline: React.FC<{ scene: CodeScene; time: number; current: number; onSeek: (t: number) => void }> = ({ scene, time, current, onSeek }) => {
  const data = scene.explainer!
  const beats = outBeats(data, scene.duration)
  const words = outWords(data)
  const bar = useRef<HTMLDivElement>(null)
  const at = (e: React.PointerEvent) => {
    const r = bar.current!.getBoundingClientRect()
    onSeek(((e.clientX - r.left) / r.width) * scene.duration)
  }
  return (
    <div className="shrink-0 border-t bg-white px-4 py-2">
      <div ref={bar} className="relative h-12 cursor-pointer select-none" onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); at(e) }} onPointerMove={(e) => e.buttons && at(e)}>
        <div className="absolute inset-x-0 top-0 flex h-7 gap-px overflow-hidden rounded-md">
          {beats.map((b, i) => (
            <div key={b.id} title={`${b.headline.replace(/\*/g, '')}${iconOfBeat(b) ? ` · ${iconOfBeat(b)}` : ''}`} className={cn('flex min-w-0 items-center px-1.5 text-[10px] font-semibold text-white', PATTERN_COLOR[b.pattern], i === current ? 'opacity-100' : 'opacity-60')} style={{ width: `${((b.end - b.start) / scene.duration) * 100}%` }}>
              <span className="truncate">{b.headline.replace(/\*/g, '')}</span>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-4">
          {words.map((w, i) => (<span key={i} className="absolute bottom-0 h-2.5 rounded-sm bg-gray-300" style={{ left: `${(w.s / scene.duration) * 100}%`, width: `${Math.max(0.15, ((w.e - w.s) / scene.duration) * 100)}%` }} />))}
        </div>
        <div className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 bg-gray-900" style={{ left: `${(time / scene.duration) * 100}%` }} />
      </div>
    </div>
  )
}
