import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, Pause, Play, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useCrm } from '@/features/crm/crmStore'
import { accountContext } from '@/features/cerebro/accountContext'
import { listReferences, referenceShotUrl, type Reference as SavedReference } from '@/features/referencias/api'
import { KIND_LABEL } from '@/features/referencias/rules'
import { cn } from '@/lib/utils'
import { ReferencePicker, type Reference as PickedReference } from './explicativo/Reference'
import { VoicePicker } from './explicativo/VoicePicker'
import { useAiAvailable } from './link'
import { SceneRunner, sceneBitmaps } from './scene'
import { CAPTION_STYLES, type SceneCaptions } from './sceneEdit'
import { useEditor } from './store'
import type { CodeScene, CreativeSet } from './types'
import { createVideoFromReference } from './videoFromReference'
import {
  BG_LABEL, DEFAULT_PLAN, ENERGY_LABEL, LOGO_LABEL, LOGO_PLACE_LABEL, PREVIEW_SCENE, TITLE_LABEL, TRANSITION_LABEL,
  previewData, suggestPlan, type VideoPlan,
} from './videoPlan'

/**
 * O criador de vídeo (2026-11-09; o usuário: "precisamos de um fluxo melhor pra criação… versão do logo, copy,
 * assunto… fazer tudo com IA sem precisar selecionar nada nem preencher… escolher efeito da legenda, se tem ou
 * não legenda, configuração de motions… um pequeno modelo de exemplo… ver em tempo real antes de gerar… ao gerar,
 * deve fazer conforme o plano"). Ao abrir, escolhe sozinho a referência (a com estrela, senão a mais recente do
 * grupo) e a IA preenche o plano lendo a referência e o Cérebro; a prévia (`PREVIEW_SCENE`) roda no motor e muda
 * na hora a cada escolha. "Gerar o vídeo" manda o plano inteiro para `createVideoFromReference`.
 */

const dataUrlOf = async (url: string) => {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** A referência que o criador escolhe sozinho: com estrela, depois a mandada por último ao grupo, depois a mais nova. */
const autoReference = (list: SavedReference[]) =>
  [...list].sort((a, b) => Number(b.starred) - Number(a.starred) || (b.groupOrder ?? 0) - (a.groupOrder ?? 0) || b.createdAt - a.createdAt)[0]

const Section: React.FC<{ title: string; children: React.ReactNode; hint?: string }> = ({ title, children, hint }) => (
  <section className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.06)]">
    <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
    {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    <div className="mt-3 space-y-3">{children}</div>
  </section>
)

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs text-gray-600">{label}</p>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(options) as T[]).map((id) => (
          <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={cn('h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors', value === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>{options[id]}</button>
        ))}
      </div>
    </div>
  )
}

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-2 text-xs text-gray-700">{label}<Switch checked={checked} onCheckedChange={onChange} /></label>
)

export const VideoCreator: React.FC<{ set: CreativeSet; refId?: string; how?: 'igual' | 'novo'; topic?: string; onCreated: (id: string) => void; onCancel: () => void }> = ({ set, refId, how: how0, topic: topic0, onCreated, onCancel }) => {
  const team = useCrm((s) => s.team)
  const ai = useAiAvailable()
  const [saved, setSaved] = useState<SavedReference[]>()
  const [chosen, setChosen] = useState<string | undefined>(refId)
  const [picked, setPicked] = useState<PickedReference | null>(null)
  const [noRef, setNoRef] = useState(false)
  const [plan, setPlan] = useState<VideoPlan>(() => ({ ...DEFAULT_PLAN, how: how0 ?? 'igual', topic: topic0 ?? '', logo: set.brand.logoOnDark ? 'escuro' : set.brand.logoOnLight ? 'claro' : 'nenhum' }))
  const put = (patch: Partial<VideoPlan>) => setPlan((p) => ({ ...p, ...patch }))
  const putCaptions = (patch: Partial<SceneCaptions>) => setPlan((p) => ({ ...p, captions: { ...p.captions, ...patch } }))
  const [filling, setFilling] = useState<string | null>(null)
  const [filled, setFilled] = useState(false)
  const [steps, setSteps] = useState<{ label: string; detail?: string }[]>([])
  const [busy, setBusy] = useState(false)
  const frameCache = useRef(new Map<string, string[]>())

  useEffect(() => {
    if (!team) return
    void listReferences(team.id).then((l) => {
      const withMedia = l.filter((r) => r.mediaPath)
      setSaved(withMedia)
      setChosen((c) => c ?? autoReference(withMedia)?.id)
    }, () => setSaved([]))
  }, [team])

  const ref = noRef ? undefined : saved?.find((r) => r.id === chosen)

  const framesOf = async (): Promise<string[]> => {
    if (noRef) return []
    if (picked?.frames.length) return picked.frames
    if (!ref || !team) return []
    const hit = frameCache.current.get(ref.id)
    if (hit) return hit
    const out: string[] = []
    for (const p of [ref.mediaPath, ...ref.frames].filter((x): x is string => !!x).slice(0, 8)) {
      try { out.push(await dataUrlOf(await referenceShotUrl(team.id, p))) } catch { /* segue com os outros */ }
    }
    frameCache.current.set(ref.id, out)
    return out
  }

  const fill = async () => {
    if (filling) return
    setFilling('Lendo a referência e o Cérebro…')
    try {
      const [frames, ctx] = await Promise.all([framesOf(), accountContext('9x16').catch(() => undefined)])
      const s = await suggestPlan(set, { frames, notes: ref?.notes, title: ref?.title || picked?.name, brief: ctx?.context, how: plan.how, topic: plan.how === 'novo' ? plan.topic : undefined }, setFilling)
      setPlan((p) => ({ ...p, ...s, how: p.how, voice: p.voice, narrate: p.narrate, topic: p.how === 'novo' && p.topic.trim() ? p.topic : s.topic ?? p.topic, captions: { ...p.captions, ...s.captions } }))
      setFilled(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'A IA não montou o plano.')
    } finally {
      setFilling(null)
    }
  }

  // Abriu com a IA ligada e a referência escolhida: a IA preenche o plano sozinha, uma vez
  const autoFilled = useRef(false)
  useEffect(() => {
    if (autoFilled.current || !ai || !saved || (!ref && !noRef && !picked)) return
    autoFilled.current = true
    void fill()
  }, [ai, saved, ref?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    if (busy) return
    setBusy(true)
    setSteps([])
    const step = (label: string, detail?: string) => setSteps((s) => [...s.filter((x) => x.label !== label), { label, detail }])
    try {
      step('Referência', 'Lendo os quadros…')
      const frames = await framesOf()
      step('Referência', frames.length ? `${frames.length} quadros de "${ref?.title || picked?.name || (ref ? KIND_LABEL[ref.kind] : '')}"` : 'Sem referência: estilo pelo plano')
      const brief = (await accountContext('9x16').catch(() => undefined))?.context
      const scene = await createVideoFromReference(set, { frames, how: plan.how, topic: plan.topic, notes: ref?.notes || undefined, title: ref?.title || picked?.name, plan }, { brief, onStep: step })
      toast.success('Vídeo criado', { description: scene.name })
      onCreated(scene.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui criar o vídeo.')
    } finally {
      setBusy(false)
    }
  }

  const hasLight = !!set.brand.logoOnLight, hasDark = !!set.brand.logoOnDark
  const logoOptions = useMemo(() => {
    const o: Partial<Record<VideoPlan['logo'], string>> = {}
    if (hasDark) o.escuro = LOGO_LABEL.escuro
    if (hasLight) o.claro = LOGO_LABEL.claro
    o.nenhum = LOGO_LABEL.nenhum
    return o as Record<VideoPlan['logo'], string>
  }, [hasDark, hasLight])

  if (busy || steps.length) {
    return (
      <div className="mx-auto w-full max-w-2xl overflow-y-auto px-4 py-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Gerando o vídeo pelo plano</h1>
        <ol className="mt-5 grid gap-2 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-2 text-sm">
              {busy && i === steps.length - 1 ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-violet-700" /> : <Check className="mt-0.5 h-4 w-4 text-emerald-600" />}
              <span><b className="text-gray-900">{s.label}</b>{s.detail ? <span className="text-gray-600"> · {s.detail}</span> : null}</span>
            </li>
          ))}
          {busy && <li className="text-xs text-gray-500">Leva de 2 a 5 minutos. Pode deixar a aba aberta.</li>}
        </ol>
        {!busy && <Button variant="outline" className="mt-4" onClick={() => setSteps([])}>Voltar ao plano</Button>}
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">Novo vídeo</h1>
              <p className="mt-1 max-w-xl text-sm text-gray-500">A IA monta o plano sozinha a partir da referência e do Cérebro. Mude o que quiser e veja ao lado como fica; o vídeo sai conforme o plano, na marca de {set.brand.name}.</p>
            </div>
            <Button variant="outline" className="gap-1.5 bg-white" disabled={!ai || !!filling} onClick={() => void fill()}>
              {filling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {filled ? 'Preencher de novo com IA' : 'Preencher tudo com IA'}
            </Button>
          </div>
          {filling && <p className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {filling}</p>}
          {!ai && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">A IA desta máquina não está conectada: abra o conector dos Criativos para a IA preencher o plano e gerar o vídeo.</p>}

          <Section title="Referência visual" hint="O estilo, o ritmo e a estrutura vêm daqui. Escolhida sozinha: a com estrela ou a última do grupo.">
            {!saved ? <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Abrindo as referências</p> : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button type="button" onClick={() => { setNoRef(true); setPicked(null) }} className={cn('flex w-20 shrink-0 flex-col items-center justify-center rounded-lg border-2 bg-gray-50 text-[10px] text-gray-600', noRef ? 'border-violet-600' : 'border-transparent')}>Sem referência</button>
                {saved.slice(0, 40).map((r) => <SavedThumb key={r.id} r={r} teamId={team!.id} active={!noRef && !picked && chosen === r.id} onPick={() => { setChosen(r.id); setPicked(null); setNoRef(false) }} />)}
              </div>
            )}
            {saved?.length === 0 && <p className="text-xs text-gray-500">Nenhuma referência com imagem ainda. Salve em <Link to="/referencias" className="underline">Referências</Link> ou mande abaixo.</p>}
            <ReferencePicker value={picked} onChange={(p) => { setPicked(p); if (p) setNoRef(false) }} compact />
            {plan.style && <p className="rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-700"><b>Estilo lido:</b> {plan.style}</p>}
          </Section>

          <Section title="Conteúdo">
            <Chips label="Como" value={plan.how} options={{ igual: 'Recriar como está', novo: 'Conteúdo novo' }} onChange={(how) => put({ how })} />
            <label className="block text-xs text-gray-600">Assunto
              <input value={plan.topic} onChange={(e) => put({ topic: e.target.value })} placeholder="A IA escolhe pelo Cérebro" className="mt-1 h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm text-gray-900 outline-none focus:border-gray-400" />
            </label>
            <label className="block text-xs text-gray-600">Copy da narração
              <textarea rows={4} value={plan.copy} onChange={(e) => put({ copy: e.target.value })} placeholder="Vazia: a IA escreve. Com texto: a voz fala exatamente isto." className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-gray-400" />
            </label>
          </Section>

          <Section title="Marca">
            <Chips label="Fundo" value={plan.background} options={BG_LABEL} onChange={(background) => put({ background })} />
            <Chips label="Versão do logo" value={plan.logo} options={logoOptions} onChange={(logo) => put({ logo })} />
            {plan.logo !== 'nenhum' && <Chips label="Onde o logo aparece" value={plan.logoPlace} options={LOGO_PLACE_LABEL} onChange={(logoPlace) => put({ logoPlace })} />}
          </Section>

          <Section title="Motion">
            <Chips label="Título de cada parte" value={plan.titlePlace} options={TITLE_LABEL} onChange={(titlePlace) => put({ titlePlace })} />
            <Chips label="Energia" value={plan.energy} options={ENERGY_LABEL} onChange={(energy) => put({ energy })} />
            <Chips label="Transição entre as partes" value={plan.transition} options={TRANSITION_LABEL} onChange={(transition) => put({ transition })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle label="Câmera em movimento" checked={plan.camera} onChange={(camera) => put({ camera })} />
              <Toggle label="Partículas" checked={plan.particles} onChange={(particles) => put({ particles })} />
            </div>
          </Section>

          <Section title="Narração e legenda">
            <Toggle label="Narrar com voz de IA" checked={plan.narrate} onChange={(narrate) => put({ narrate })} />
            {plan.narrate ? (
              <>
                <VoicePicker value={plan.voice} onChange={(voice) => put({ voice })} brand={set.brand.name} />
                <Chips label="Legenda" value={plan.captions.style} options={Object.fromEntries(CAPTION_STYLES.map((c) => [c.id, c.label])) as Record<SceneCaptions['style'], string>} onChange={(style) => putCaptions({ style })} />
                {plan.captions.style !== 'nenhuma' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs text-gray-700"><span className="flex justify-between">Altura <span className="tabular-nums text-gray-500">{Math.round((plan.captions.y ?? 0.8) * 100)}%</span></span>
                      <input type="range" min={0.1} max={0.92} step={0.01} value={plan.captions.y ?? 0.8} onChange={(e) => putCaptions({ y: e.target.valueAsNumber })} className="w-full accent-gray-900" />
                    </label>
                    <label className="block text-xs text-gray-700"><span className="flex justify-between">Tamanho <span className="tabular-nums text-gray-500">{Math.round((plan.captions.size ?? 1) * 100)}%</span></span>
                      <input type="range" min={0.6} max={1.6} step={0.05} value={plan.captions.size ?? 1} onChange={(e) => putCaptions({ size: e.target.valueAsNumber })} className="w-full accent-gray-900" />
                    </label>
                  </div>
                )}
              </>
            ) : <p className="text-xs text-gray-500">Sem narração, o vídeo fica sem legenda e cada parte dura o tempo de leitura.</p>}
          </Section>
        </div>

        <aside className="md:sticky md:top-4 md:self-start">
          <PlanPreview set={set} plan={plan} />
          <Button className="mt-3 w-full gap-1.5" disabled={!ai || !!filling || (plan.how === 'novo' && plan.topic.trim().length < 3 && !plan.copy.trim())} onClick={() => void run()}><Sparkles className="h-4 w-4" /> Gerar o vídeo</Button>
          <Button variant="ghost" className="mt-1 w-full" onClick={onCancel}>Cancelar</Button>
          <p className="mt-1 text-[11px] leading-snug text-gray-500">A prévia é um modelo de exemplo: mostra fundo, logo, posição do título, movimento, transição e legenda. A animação de verdade é desenhada pela IA na linguagem da referência, seguindo estas escolhas.</p>
        </aside>
      </div>
    </div>
  )
}

/** O modelo de exemplo, rodando no motor em loop; cada escolha do plano chega pelo setData (sem recarregar). */
const PlanPreview: React.FC<{ set: CreativeSet; plan: VideoPlan }> = ({ set, plan }) => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const images = useEditor((s) => s.images)
  const [runner, setRunner] = useState<SceneRunner | null>(null)
  const [playing, setPlaying] = useState(true)
  const lastT = useRef(1.2)
  const logos = `${set.brand.logoOnLight ?? ''}|${set.brand.logoOnDark ?? ''}`
  useEffect(() => {
    for (const src of logos.split('|')) if (src) void useEditor.getState().ensureImage(src)
  }, [logos])
  const logoReady = logos.split('|').filter(Boolean).every((src) => images.has(src))
  const titles = useMemo<[string, string]>(() => {
    const words = (plan.topic || '').toUpperCase().split(/\s+/).filter(Boolean)
    return [words.slice(0, 4).join(' ') || 'O TÍTULO DA PARTE', words.length > 4 ? words.slice(4, 8).join(' ') : 'A VIRADA']
  }, [plan.topic])
  const data = useMemo(() => previewData(plan, titles), [plan, titles])
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    let alive = true
    let r: SceneRunner | null = null
    void (async () => {
      const bitmaps = await sceneBitmaps({ images: [] } as unknown as CodeScene, useEditor.getState().images, set.brand)
      r = new SceneRunner({ code: PREVIEW_SCENE, width: 1080, height: 1920, duration: 6, images: bitmaps, brand: { name: set.brand.name, colors: set.brand.colors.map((c) => c.hex), font: set.brand.headingFont }, data: dataRef.current })
      try {
        await r.load()
        if (alive) setRunner(r)
        else r.dispose()
      } catch {
        r.dispose()
      }
    })()
    return () => { alive = false; r?.dispose() }
  }, [set.brand, logoReady])

  useEffect(() => { void runner?.setData(data).catch(() => undefined) }, [runner, data])

  useEffect(() => {
    if (!runner) return
    let raf = 0, busy = false, stop = false
    const t0 = performance.now() - lastT.current * 1000
    const tick = async () => {
      if (stop) return
      if (!busy) {
        busy = true
        const t = playing ? ((performance.now() - t0) / 1000) % 6 : lastT.current
        lastT.current = t
        try {
          const bmp = await runner.frame(t)
          const c = canvas.current
          c?.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height)
          bmp.close()
        } catch { /* a prévia se refaz */ }
        busy = false
      }
      raf = requestAnimationFrame(() => void tick())
    }
    void tick()
    return () => { stop = true; cancelAnimationFrame(raf) }
  }, [runner, playing])

  return (
    <div className="relative mx-auto w-[270px] overflow-hidden rounded-2xl bg-gray-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_16px_40px_-16px_rgb(0_0_0/0.45)]">
      <canvas ref={canvas} width={540} height={960} className="block h-[480px] w-[270px]" />
      {!runner && <span className="absolute inset-0 flex items-center justify-center text-xs text-white/70"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Montando a prévia</span>}
      <button type="button" aria-label={playing ? 'Pausar a prévia' : 'Tocar a prévia'} onClick={() => setPlaying((p) => !p)} className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75">
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
      </button>
      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-900">Prévia do plano</span>
    </div>
  )
}

const SavedThumb: React.FC<{ r: SavedReference; teamId: string; active: boolean; onPick: () => void }> = ({ r, teamId, active, onPick }) => {
  const [url, setUrl] = useState<string>()
  useEffect(() => { if (r.mediaPath) void referenceShotUrl(teamId, r.mediaPath).then(setUrl, () => undefined) }, [teamId, r.mediaPath])
  return (
    <button type="button" onClick={onPick} title={r.title} className={cn('w-20 shrink-0 overflow-hidden rounded-lg border-2 text-left', active ? 'border-violet-600' : 'border-transparent')}>
      <div className="relative aspect-[9/14] bg-gray-100">
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
        {r.starred && <span className="absolute right-1 top-1 rounded-full bg-amber-400 px-1 text-[9px] font-bold text-gray-900">★</span>}
      </div>
      <p className="truncate px-1 py-0.5 text-[10px] text-gray-600">{r.title || KIND_LABEL[r.kind]}</p>
    </button>
  )
}
