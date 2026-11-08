import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, FileText, ImagePlus, Loader2, Mic, Search, Sparkles, Trash2, Upload, Video, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { accountBrand } from '@/features/conteudos/carousel'
import { useEditor } from '../store'
import { useAiAvailable, useCreativeLink } from '../link'
import { newScene } from '../scene'
import { assetUrl, uploadAsset } from '../storage'
import type { CodeScene, CreativeSet, SetAsset } from '../types'
import { EXPLAINER_SCENE } from './engine'
import { COMMERCIAL_SCENE, commercialData } from './comercial'
import { rememberVoice } from './media'
import { Recorder } from './Recorder'
import { narrate, type VoiceAI } from './narracao'
import { DEFAULT_VOICE, VoicePicker, useVoiceReady } from './VoicePicker'
import { createBriefingVideo, brandForSet } from './pipeline'
import { researchCuriosity, type Research } from './pesquisa'
import { ResearchCard } from './ResearchCard'
import { ReferencePicker, type Reference } from './Reference'
import { autoScript, writeBriefing, writeScript } from './roteiro'
import { cleanCuts, fillerCuts, pauseCuts, videoLength } from './timeline'
import { MODELS, transcribe, type ModelId, type TranscribeStep } from './transcribe'
import { CAPTIONS, LAYOUTS, LOOKS, MODES, emptyExplainer, type CaptionId, type ExplainerBeat, type ExplainerData, type ExplainerWord, type LayoutId, type LookId, type ModeId } from './types'
import { Label, fmt, slug } from './shared'

/**
 * Começar um vídeo explicativo: o modo (a fala é a narração, ou é só o briefing), a fala (gravar
 * aqui, enviar, ou reaproveitar uma já enviada) ou o briefing escrito, e os opcionais (formato,
 * legenda, fotos, referência, pedido). No modo narração as pausas e os vícios já saem cortados.
 */

type Source = { blob: Blob; name: string; kind: 'audio' | 'video'; url: string; src?: string }

export const NewExplainer: React.FC<{ set: CreativeSet; onCreated: (id: string) => void; onCancel?: () => void }> = ({ set, onCreated, onCancel }) => {
  const ai = useAiAvailable()
  const [mode, setMode] = useState<ModeId>('narracao')
  const [screen, setScreen] = useState<'pick' | 'rec-video' | 'rec-audio'>('pick')
  const [source, setSource] = useState<Source | null>(null)
  const [briefText, setBriefText] = useState('')
  const [layout, setLayout] = useState<LayoutId | 'auto'>('auto')
  const [captions, setCaptions] = useState<CaptionId>('pop')
  const [look, setLook] = useState<LookId>('editorial')
  const [topic, setTopic] = useState('')
  const [research, setResearch] = useState<Research | null>(null)
  const [researching, setResearching] = useState<string | null>(null)
  const [autoCut, setAutoCut] = useState(true)
  const [brief, setBrief] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [reference, setReference] = useState<Reference | null>(null)
  const [model, setModel] = useState<ModelId>('rapida')
  const [steps, setSteps] = useState<{ label: string; state: 'doing' | 'done' | 'warn'; detail?: string }[]>([])
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const narration = mode === 'narracao'
  const [aiVoice, setAiVoice] = useState(true)
  // Com a chave da ElevenLabs, a voz brasileira vem primeiro (a da OpenAI tem sotaque estrangeiro)
  const [voiceCfg, setVoiceCfg] = useState<VoiceAI>(() => (useCreativeLink.getState().keys.elevenlabs ? { ...DEFAULT_VOICE, provider: 'elevenlabs', voice: '', model: 'eleven_multilingual_v2' } : DEFAULT_VOICE))
  const voiceReady = useVoiceReady(voiceCfg.provider)
  const willNarrate = !narration && aiVoice && voiceReady.connected && voiceReady.key && !!voiceCfg.voice

  const take = (blob: Blob, name: string) => {
    if (blob.size > 50 * 1024 * 1024) return toast.error('O arquivo passa de 50 MB. Grave um trecho menor ou comprima o vídeo.')
    setSource({ blob, name, kind: blob.type.startsWith('video/') ? 'video' : 'audio', url: URL.createObjectURL(blob) })
    setScreen('pick')
  }

  // Falas já enviadas ao conjunto que ainda não viraram vídeo (uma gravação que subiu e a página recarregou)
  const used = new Set((set.scenes ?? []).map((s) => s.explainer?.media?.src).filter(Boolean))
  const sent = set.assets.filter((a) => (a.kind === 'video' || a.kind === 'audio') && !used.has(`asset:${a.id}`)).reverse().slice(0, 6)
  const [loading, setLoading] = useState<string | null>(null)
  const reuse = async (a: SetAsset) => {
    setLoading(a.id)
    try {
      const res = await fetch(await assetUrl(a))
      if (!res.ok) throw new Error('Não consegui baixar esse arquivo do conjunto.')
      const blob = await res.blob()
      setSource({ blob, name: a.name, kind: a.kind === 'video' ? 'video' : 'audio', url: URL.createObjectURL(blob), src: `asset:${a.id}` })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui abrir esse arquivo.')
    } finally {
      setLoading(null)
    }
  }

  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  const step = (label: string, state: 'doing' | 'done' | 'warn' = 'doing', detail?: string) =>
    setSteps((cur) => {
      const i = cur.findIndex((s) => s.label === label)
      const item = { label, state, detail }
      return i >= 0 ? cur.map((s, j) => (j === i ? item : s)) : [...cur, item]
    })

  const ready = narration ? !!source : !!(source || briefText.trim() || research || topic.trim())

  const doResearch = async () => {
    setResearching('Começando a pesquisa…')
    try {
      const { used } = await brandForSet(set)
      setResearch(await researchCuriosity(topic, { brand: used, extra: brief, onStep: setResearching }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'A pesquisa falhou.')
    } finally {
      setResearching(null)
    }
  }

  const create = async () => {
    if (!ready) return
    if (!narration && !ai) return toast.error('O modo briefing precisa da IA desta máquina (o conector dos Criativos).')
    setBusy(true)
    setSteps([])
    try {
      // A marca: a do conjunto; conjunto sem cores usa o DESIGN.md da conta (Cérebro)
      const brand = set.brand.colors.length ? undefined : await accountBrand().catch(() => undefined)
      const uploaded: SetAsset[] = []
      let media: ExplainerData['media']
      if (source && narration) {
        step('Guardando a fala no conjunto')
        const ext = source.name.split('.').pop() || (source.kind === 'video' ? 'mp4' : 'm4a')
        const asset = source.src ? undefined : await uploadAsset(set, new File([source.blob], source.name, { type: source.blob.type }), source.name.includes('.') ? source.name : `${source.name}.${ext}`)
        if (asset) uploaded.push(asset)
        const src = source.src ?? `asset:${asset!.id}`
        rememberVoice(src, source.blob, source.kind)
        const probe = new AudioContext()
        const duration = Math.min(180, (await probe.decodeAudioData((await source.blob.arrayBuffer()).slice(0))).duration)
        void probe.close()
        media = { src, name: source.name, kind: source.kind, duration: Math.round(duration * 100) / 100 }
        step('Guardando a fala no conjunto', 'done')
      }
      const photoAssets: { src: string; name: string }[] = []
      for (const f of photos) {
        const a = await uploadAsset(set, f, f.name)
        uploaded.push(a)
        photoAssets.push({ src: `asset:${a.id}`, name: slug(f.name) || `foto${photoAssets.length + 1}` })
      }
      if (uploaded.length) useEditor.getState().edit((cur) => ({ ...cur, assets: [...cur.assets, ...uploaded] }))

      let words: ExplainerWord[] = []
      let text = ''
      if (source) {
        const label = 'Transcrevendo a fala (no seu navegador)'
        step(label)
        const out = await transcribe(await source.blob.arrayBuffer(), {
          model,
          onStep: (s: TranscribeStep) => step(label, 'doing', s.kind === 'download' ? `baixando o modelo ${s.total ? Math.round((s.loaded / s.total) * 100) : 0}% (só na primeira vez)` : s.kind === 'running' ? 'ouvindo…' : 'lendo o áudio…'),
        })
        if (!out.words.length && narration) throw new Error('Não ouvi fala nesse arquivo. Confira o volume e tente de novo.')
        words = out.words
        text = out.text
        step(label, 'done', `${words.length} palavras`)
      }

      const base: ExplainerData = {
        ...emptyExplainer(),
        mode,
        look,
        media,
        words,
        briefText: briefText.trim() || undefined,
        layout: narration ? (layout === 'auto' ? (source?.kind === 'video' ? 'dividido' : 'animacao') : layout) : 'animacao',
        captions: narration ? captions : 'nenhuma',
        photos: photoAssets,
        brief: brief.trim() || undefined,
        brand,
        mirror: !!source?.name.startsWith('fala-') && source.kind === 'video',
      }
      if (narration && media && autoCut) base.cuts = cleanCuts([...pauseCuts(words, media.duration), ...fillerCuts(words)], media.duration)

      let beats: ExplainerBeat[]
      let caption: string | undefined
      const brandUsed = brand ?? set.brand
      if (!narration) {
        // A mesma linha de produção da Iara: pesquisa (se faltar), roteiro, narração e a cena
        const { scene } = await createBriefingVideo(set, { topic: research ? undefined : topic, research: research ?? undefined, briefText, brief, look, voice: willNarrate ? voiceCfg : null, reference: reference?.frames, base: { words, photos: photoAssets } }, step)
        onCreated(scene.id)
        toast.success('Vídeo montado. Dê play.')
        return
      } else {
        const total = media!.duration
        const l = ai ? 'A IA escreve o roteiro animado e sugere cortes' : 'Montando o roteiro automático'
        step(l)
        if (ai) {
          try {
            const r = await writeScript(set, base, total, { brand: brandUsed, reference: reference?.frames, onStep: (d) => step(l, 'doing', d) })
            beats = r.beats
            caption = r.caption
            if (r.cuts.length) base.cuts = cleanCuts([...(base.cuts ?? []), ...r.cuts], total)
            step(l, 'done', `${beats.length} momentos${r.cuts.length ? `, ${r.cuts.length} cortes sugeridos` : ''}`)
          } catch (err) {
            beats = autoScript(words, total, photoAssets.map((p) => p.name))
            step(l, 'warn', `${err instanceof Error ? err.message : 'a IA falhou'} Usei o roteiro automático.`)
          }
        } else {
          beats = autoScript(words, total, photoAssets.map((p) => p.name))
          step(l, 'done', `${beats.length} momentos`)
        }
      }

      const explainer: ExplainerData = { ...base, beats, caption }
      const title = (beats[0]?.headline || text.split(/\s+/).slice(0, 6).join(' ') || 'Vídeo explicativo').replace(/\*/g, '')
      const scene: CodeScene = { ...newScene(EXPLAINER_SCENE, title.length > 48 ? `${title.slice(0, 46)}…` : title), format: '9x16', duration: videoLength(explainer), explainer }
      useEditor.getState().edit((cur) => ({ ...cur, scenes: [...(cur.scenes ?? []), scene] }))
      onCreated(scene.id)
      toast.success('Vídeo montado. Dê play.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui montar o vídeo.')
      setSteps((cur) => cur.map((s) => (s.state === 'doing' ? { ...s, state: 'warn' } : s)))
    } finally {
      setBusy(false)
    }
  }

  // Modelo pronto: o comercial animado (recriação do reel de agência), já no roteiro e na marca do conjunto
  const startCommercial = () => {
    const explainer = commercialData(set.brand.name || 'Sua marca')
    const scene: CodeScene = { ...newScene(COMMERCIAL_SCENE, `Comercial animado · ${set.brand.name || 'marca'}`), format: '9x16', duration: videoLength(explainer), explainer }
    useEditor.getState().edit((cur) => ({ ...cur, scenes: [...(cur.scenes ?? []), scene] }))
    onCreated(scene.id)
    toast.success('Comercial montado. Troque os textos na aba Roteiro e gere a narração em Estilo › Som.')
  }

  if (screen !== 'pick')
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="mb-5 text-xl font-semibold text-gray-900">{screen === 'rec-video' ? 'Gravar vídeo' : 'Gravar áudio'}</h1>
          <Recorder kind={screen === 'rec-video' ? 'video' : 'audio'} brand={set.brand.name} onDone={take} onCancel={() => setScreen('pick')} />
        </div>
      </div>
    )

  const SOURCES = [
    { id: 'rec-video', icon: Video, title: 'Gravar vídeo', text: narration ? 'Você fala para a câmera e aparece no vídeo.' : 'Explique a ideia falando; vira o briefing.', act: () => setScreen('rec-video') },
    { id: 'rec-audio', icon: Mic, title: 'Gravar áudio', text: narration ? 'Só a voz; a tela inteira vira animação.' : 'Mande um áudio explicando o que quer.', act: () => setScreen('rec-audio') },
    { id: 'upload', icon: Upload, title: 'Enviar áudio ou vídeo', text: 'MP3, M4A, WAV, MP4, MOV ou WEBM, até 50 MB.', act: () => fileInput.current?.click() },
  ] as const

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-700"><Wand2 className="h-4 w-4" /> Vídeo explicativo</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Um vídeo animado no design system da marca{set.brand.name ? ` ${set.brand.name}` : ''}</h1>

        <button type="button" disabled={busy} onClick={startCommercial} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-3 text-left transition hover:border-violet-400">
          <Sparkles className="h-5 w-5 shrink-0 text-violet-700" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-900">Modelo pronto: comercial animado</span>
            <span className="block text-xs leading-snug text-gray-600">Anúncio de 31 s com tipografia cinética, objeto 3D, cartões numerados, celular, ranking e orçamento, já na marca. Depois é só trocar os textos e narrar.</span>
          </span>
        </button>

        <div className="mt-5">
          <Label>O que você vai mandar é…</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(MODES) as ModeId[]).map((id) => (
              <button key={id} type="button" disabled={busy} onClick={() => setMode(id)} aria-pressed={mode === id} className={cn('rounded-xl border p-3 text-left transition', mode === id ? 'border-violet-500 bg-violet-50/70 ring-1 ring-violet-500' : 'border-gray-200 bg-white hover:border-violet-300')}>
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">{id === 'narracao' ? <Mic className="h-4 w-4 text-violet-700" /> : <Sparkles className="h-4 w-4 text-violet-700" />} {MODES[id].label}</span>
                <span className="mt-1 block text-xs leading-snug text-gray-600">{MODES[id].hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <Label>Estilo do vídeo</Label>
          <div className="grid gap-2 sm:grid-cols-5">
            {(Object.keys(LOOKS) as LookId[]).map((id) => (
              <button key={id} type="button" onClick={() => setLook(id)} aria-pressed={look === id} title={LOOKS[id].hint} className={cn('rounded-lg border px-2.5 py-2 text-left text-xs transition', look === id ? 'border-violet-500 bg-violet-50/70 ring-1 ring-violet-500' : 'border-gray-200 bg-white hover:border-violet-300')}>
                <span className="block font-semibold text-gray-900">{LOOKS[id].label}</span>
                <span className="mt-0.5 block leading-snug text-gray-500">{LOOKS[id].hint}</span>
              </button>
            ))}
          </div>
          {look !== 'editorial' && <p className="mt-1.5 text-[11px] text-gray-500">Ponha os prints ou fotos do que você mostra em "Fotos": a IA escolhe qual vai no cartão de cada frase. Sem print, o cartão mostra a animação da cena.</p>}
        </div>

        <input ref={fileInput} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f, f.name); e.target.value = '' }} />
        <div className="mt-6">
          <Label>{narration ? 'A fala' : 'O briefing (fala, texto ou os dois)'}</Label>
          {!source ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {SOURCES.map((s) => (
                <button key={s.id} type="button" onClick={s.act} className="flex flex-col items-start rounded-xl bg-white p-4 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.08)] transition hover:shadow-[0_0_0_2px_rgb(124_58_237)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><s.icon className="h-4 w-4" /></span>
                  <span className="mt-3 text-sm font-semibold text-gray-900">{s.title}</span>
                  <span className="mt-0.5 text-xs leading-snug text-gray-500">{s.text}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
              {source.kind === 'video' ? <video src={source.url} controls playsInline className="h-40 rounded-lg bg-black" /> : <audio src={source.url} controls className="min-w-0 flex-1" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{source.name}</p>
                <p className="text-xs text-gray-500">{source.kind === 'video' ? 'Vídeo' : 'Áudio'} · {(source.blob.size / 1024 / 1024).toFixed(1)} MB{source.src ? ' · já está no conjunto' : ''}</p>
                <button type="button" disabled={busy} className="mt-1 text-xs font-medium text-violet-700 hover:underline" onClick={() => setSource(null)}>Trocar</button>
              </div>
            </div>
          )}
          {!source && sent.length > 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
              <p className="text-xs font-medium text-gray-700">Já enviados a este conjunto, ainda sem vídeo explicativo</p>
              <div className="mt-2 space-y-1.5">
                {sent.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
                    {a.kind === 'video' ? <Video className="h-4 w-4 shrink-0 text-gray-500" /> : <Mic className="h-4 w-4 shrink-0 text-gray-500" />}
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title={a.name}>{a.name}</span>
                    {a.duration ? <span className="text-xs tabular-nums text-gray-500">{fmt(a.duration)}</span> : null}
                    <Button size="sm" variant="outline" className="h-7 bg-white text-xs" disabled={!!loading} onClick={() => void reuse(a)}>{loading === a.id ? 'Abrindo…' : 'Usar este'}</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!narration && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-700"><Search className="h-3.5 w-3.5" /> Pesquisar um tema (a IA acha uma curiosidade e confirma cada fato numa fonte)</p>
              <div className="mt-1.5 flex gap-1.5">
                <input value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && topic.trim() && !researching && void doResearch()} placeholder="Ex.: uma curiosidade da BMW R 1250 GS que quase ninguém conhece" className="h-9 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <Button type="button" variant="outline" className="h-9 shrink-0 gap-1.5 bg-white" disabled={!ai || !topic.trim() || !!researching} onClick={() => void doResearch()}>{researching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Pesquisar</Button>
              </div>
              {researching && <p className="mt-1.5 text-[11px] text-violet-700">{researching} (1 a 3 minutos)</p>}
              {research && <div className="mt-2"><ResearchCard research={research} onClear={() => setResearch(null)} /></div>}
              {!research && !researching && <p className="mt-1 text-[11px] text-gray-500">Ou clique direto em criar: a pesquisa roda antes do roteiro.</p>}
            </div>
          )}
          {!narration && (
            <label className="mt-3 block">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700"><FileText className="h-3.5 w-3.5" /> {source ? 'Quer completar com texto?' : 'Ou escreva o briefing'}</span>
              <textarea value={briefText} onChange={(e) => setBriefText(e.target.value)} placeholder="O que o vídeo precisa comunicar, para quem, a oferta, os pontos principais, a chamada no fim. Ex.: 3 erros que fazem o cliente desistir de comprar pelo direct; público: donos de loja; terminar pedindo para salvar." className="mt-1.5 min-h-[110px] w-full rounded-md border border-gray-200 bg-white p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
          )}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {narration ? (
            <div>
              <Label>Formato</Label>
              <div className="space-y-1.5">
                {(['auto', ...Object.keys(LAYOUTS)] as const).map((id) => {
                  const off = (id === 'dividido' || id === 'rosto') && source?.kind === 'audio'
                  return (
                    <label key={id} className={cn('flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm', layout === id ? 'border-violet-400 bg-violet-50/60' : 'border-gray-200 bg-white', off && 'cursor-not-allowed opacity-50')}>
                      <input type="radio" className="mt-0.5" checked={layout === id} disabled={off} onChange={() => setLayout(id as LayoutId | 'auto')} />
                      <span><span className="font-medium text-gray-900">{id === 'auto' ? 'Automático' : LAYOUTS[id as LayoutId].label}</span><span className="block text-xs text-gray-500">{id === 'auto' ? 'Com vídeo: você + animação. Com áudio: só animação.' : LAYOUTS[id as LayoutId].hint}</span></span>
                    </label>
                  )
                })}
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-gray-800"><input type="checkbox" className="mt-0.5" checked={autoCut} onChange={(e) => setAutoCut(e.target.checked)} /> <span>Cortar pausas longas e vícios ("é", "tipo", "né", "hum")<span className="block text-xs text-gray-500">A IA também sugere cortes de repetições e falsos começos. Tudo dá para desfazer na aba Fala.</span></span></label>
            </div>
          ) : (
            <div className="rounded-xl bg-violet-50/60 p-3 text-xs leading-relaxed text-violet-950">
              <p className="font-semibold">Como fica no modo briefing</p>
              <p className="mt-1">A IA lê o que você mandou, escolhe o ângulo, escreve o roteiro inteiro (gancho, ideias, prova e chamada) e o texto que a narração fala em cada cena. Depois você ajusta cada cena.</p>
              <label className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-900"><input type="checkbox" checked={aiVoice} onChange={(e) => setAiVoice(e.target.checked)} /> Narrar com voz de IA</label>
              <p className="mb-2 mt-0.5 text-[11px] text-violet-950/70">{aiVoice ? 'A voz lê o roteiro e o vídeo sincroniza com ela, com legenda.' : 'Sem voz: texto animado, trilha e efeitos.'}</p>
              {aiVoice && <VoicePicker value={voiceCfg} onChange={setVoiceCfg} brand={set.brand.name} />}
            </div>
          )}
          <div>
            {narration && (
              <>
                <Label>Legenda animada</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(CAPTIONS) as CaptionId[]).map((id) => (
                    <button key={id} type="button" title={CAPTIONS[id].hint} onClick={() => setCaptions(id)} className={cn('rounded-full border px-2.5 py-1 text-xs', captions === id ? 'border-violet-500 bg-violet-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300')}>{CAPTIONS[id].label}</button>
                  ))}
                </div>
                <p className="mb-4 mt-1 text-[11px] text-gray-500">{CAPTIONS[captions].hint}</p>
              </>
            )}
            <Label>Fotos (opcional)</Label>
            <input ref={photoInput} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 8)); e.target.value = '' }} />
            <div className="flex flex-wrap gap-1.5">
              {photos.map((f, i) => (
                <span key={i} className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-700">{f.name.slice(0, 18)}<button type="button" aria-label="Tirar" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 text-gray-400 hover:text-red-600" /></button></span>
              ))}
              <button type="button" className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline" onClick={() => photoInput.current?.click()}><ImagePlus className="h-3.5 w-3.5" /> Pôr fotos</button>
            </div>
            <div className="mt-4">
              <Label>Vídeo de referência (opcional)</Label>
              <ReferencePicker value={reference} onChange={setReference} />
              <p className="mt-1 text-[11px] text-gray-500">A IA segue o ritmo e o jeito de animar, sempre nas fontes, cores e voz da sua marca.</p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Label>Pedido para a IA (opcional)</Label>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Para quem é, o tom, o que destacar. Ex.: público de donos de restaurante, tom direto, destacar o número do meio." className="min-h-[64px] w-full rounded-md border border-gray-200 bg-white p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>

        {source && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span>Transcrição:</span>
            {(Object.keys(MODELS) as ModelId[]).map((id) => (
              <label key={id} className="flex items-center gap-1"><input type="radio" checked={model === id} onChange={() => setModel(id)} /> {MODELS[id].label} <span className="text-gray-400">({MODELS[id].size}, baixa uma vez)</span></label>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button disabled={!ready || busy || (!narration && !ai)} className="gap-1.5" onClick={() => void create()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {narration ? 'Criar o vídeo' : 'Criar roteiro e vídeo com IA'}</Button>
          {onCancel && !busy && <button type="button" className="text-sm text-gray-500 hover:underline" onClick={onCancel}>Voltar</button>}
          <span className="text-xs text-gray-500">{busy ? 'Não feche nem recarregue a página até terminar. ' : ''}{!narration && !ai ? 'Conecte a IA desta máquina para o modo briefing.' : ai ? 'A IA leva de 1 a 3 minutos.' : 'Sem a IA conectada, sai o roteiro automático; dá para ajustar tudo depois.'}</span>
        </div>
        {steps.length > 0 && (
          <ol className="mt-4 space-y-1.5 rounded-xl bg-white p-3 text-sm shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
            {steps.map((s) => (
              <li key={s.label} className="flex items-start gap-2">
                {s.state === 'doing' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-600" /> : s.state === 'done' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-amber-600">!</span>}
                <span className="text-gray-800">{s.label}{s.detail && <span className="text-gray-500"> · {s.detail}</span>}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
