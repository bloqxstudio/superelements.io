import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
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
import { downloadReelViaLink, useAiAvailable, useCreativeLink } from './link'
import { referenceShots, type DenseReference } from './sceneAi'
import { useIa } from '@/features/ia/porTarefa'
import { useCreatorIara } from './creatorIara'
import { CAPTION_STYLES, type SceneCaptions } from './sceneEdit'
import type { CreativeSet } from './types'
import { createVideoFromReference } from './videoFromReference'
import {
  BG_LABEL, DEFAULT_PLAN, LOGO_LABEL, LOGO_PLACE_LABEL, RHYTHM_LABEL, SHOT_TRANSITION_LABEL, TEXT_LABEL, VIDEO_STYLES,
  buildChecklist, planCopy, recentDirections, spokenSeconds, suggestPlan, type RefReading, type Shot, type StyleId, type VideoPlan,
} from './videoPlan'

/**
 * O criador de vídeo (2026-11-09; refeito em 2026-11-10, ver `videoDirection.ts`: "tá viciada num modelo, sempre
 * gerando o mesmo formato e não seguindo as regras do que mandamos"). A referência não é mais escolhida sozinha:
 * ou a pessoa escolhe, ou o vídeo sai sem referência. "Preencher com IA" lê a referência (ficha), sugere o estilo
 * e monta a decupagem cena a cena; tudo editável, com as regras obrigatórias da pessoa. Ao lado, o resumo e a
 * lista que a IA vai conferir nos quadros do vídeo pronto.
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

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }> = ({ label, value, onChange, placeholder, rows }) => (
  <label className="block text-xs text-gray-600">{label}
    {rows ? (
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-gray-400" />
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm text-gray-900 outline-none focus:border-gray-400" />
    )}
  </label>
)

export const VideoCreator: React.FC<{ set: CreativeSet; refId?: string; how?: 'igual' | 'novo'; topic?: string; onCreated: (id: string) => void; onCancel: () => void }> = ({ set, refId, how: how0, topic: topic0, onCreated, onCancel }) => {
  const team = useCrm((s) => s.team)
  const ai = useAiAvailable()
  const [saved, setSaved] = useState<SavedReference[]>()
  // Nada é escolhido sozinho: só a referência que veio pelo link (Referências → Recriar) ou a que a pessoa clicar
  const [chosen, setChosen] = useState<string | undefined>(refId)
  const [picked, setPicked] = useState<PickedReference | null>(null)
  const [plan, setPlan] = useState<VideoPlan>(() => ({ ...DEFAULT_PLAN, how: how0 ?? 'igual', topic: topic0 ?? '', logo: set.brand.logoOnDark ? 'escuro' : set.brand.logoOnLight ? 'claro' : 'nenhum' }))
  const put = (patch: Partial<VideoPlan>) => setPlan((p) => ({ ...p, ...patch }))
  const putCaptions = (patch: Partial<SceneCaptions>) => setPlan((p) => ({ ...p, captions: { ...p.captions, ...patch } }))
  const putReading = (patch: Partial<RefReading>) => setPlan((p) => (p.reading ? { ...p, reading: { ...p.reading, ...patch } } : p))
  const putShot = (i: number, patch: Partial<Shot>) => setPlan((p) => ({ ...p, shots: p.shots.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const [filling, setFilling] = useState<string | null>(null)
  const [filledFor, setFilledFor] = useState<string | null>(null)
  const [steps, setSteps] = useState<{ label: string; detail?: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [frames, setFrames] = useState<string[]>([])
  const frameCache = useRef(new Map<string, string[]>())
  const history = useMemo(() => recentDirections(set), [set])

  useEffect(() => {
    if (!team) return
    void listReferences(team.id).then((l) => setSaved(l.filter((r) => r.mediaPath)), () => setSaved([]))
  }, [team])

  const ref = picked ? undefined : saved?.find((r) => r.id === chosen)
  const refKey = picked ? `arquivo:${picked.name}` : ref ? ref.id : 'nenhuma'
  // O movimento de uma referência salva: o reel lido pelo link só agora, a pedido da pessoa (o vídeo não fica)
  const [motion, setMotion] = useState<{ id: string; frames: string[]; times: number[]; dense?: DenseReference } | null>(null)
  const [reading, setReading] = useState(false)
  const refMotion = ref && motion?.id === ref.id ? motion : null
  const dense = picked?.dense ?? refMotion?.dense
  const times = picked?.times ?? refMotion?.times
  const agentMode = useCreativeLink((s) => !!s.videoAgent)
  const { ia: videoIa } = useIa('video')
  const canReadMotion = !!ref && /instagram\.com\/(?:[\w.]+\/)?(reel|reels|p|tv)\//i.test(ref.url) && !refMotion

  const readMotion = async () => {
    if (!ref || reading) return
    setReading(true)
    try {
      const out = await downloadReelViaLink(ref.url)
      const blob = await (await fetch(out.data)).blob()
      const shots = await referenceShots(new File([blob], out.name, { type: out.type }), 12)
      setMotion({ id: ref.id, ...shots })
      setFrames(shots.frames)
      toast.success('Movimento lido', { description: `${shots.dense?.frames.length ?? shots.frames.length} quadros${shots.dense?.cuts.length ? `, ${shots.dense.cuts.length} cortes` : ''}. O vídeo não foi guardado.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não consegui ler o vídeo pelo link.'
      toast.error(/desconhecido/i.test(msg) ? 'O conector desta máquina é antigo: baixe o conector de novo para ler o vídeo pelo link.' : msg)
    } finally {
      setReading(false)
    }
  }

  const framesOf = async (): Promise<string[]> => {
    if (picked?.frames.length) return picked.frames
    if (refMotion) return refMotion.frames
    if (!ref || !team) return []
    const hit = frameCache.current.get(ref.id)
    if (hit) return hit
    const out: string[] = []
    for (const p of [ref.mediaPath, ...ref.frames].filter((x): x is string => !!x).slice(0, 12)) {
      try { out.push(await dataUrlOf(await referenceShotUrl(team.id, p))) } catch { /* segue com os outros */ }
    }
    frameCache.current.set(ref.id, out)
    return out
  }
  useEffect(() => {
    let alive = true
    void framesOf().then((f) => alive && setFrames(f), () => alive && setFrames([]))
    return () => { alive = false }
  }, [refKey, team]) // eslint-disable-line react-hooks/exhaustive-deps

  const fill = async () => {
    if (filling) return
    setFilling(frames.length || ref || picked ? 'Lendo a referência e o Cérebro…' : 'Lendo o Cérebro…')
    try {
      const [f, ctx] = await Promise.all([framesOf(), accountContext('9x16').catch(() => undefined)])
      const s = await suggestPlan(set, { frames: f, notes: ref?.notes, title: ref?.title || picked?.name, brief: ctx?.context, plan, history }, setFilling)
      setPlan((p) => ({ ...p, ...s, how: p.how, voice: p.voice, narrate: p.narrate, rules: p.rules, topic: p.how === 'novo' && p.topic.trim() ? p.topic : s.topic ?? p.topic, captions: { ...p.captions, ...s.captions } }))
      setFilledFor(refKey)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'A IA não montou o plano.')
    } finally {
      setFilling(null)
    }
  }

  // Veio de Referências → Recriar: a IA lê aquela referência e preenche, uma vez
  const autoFilled = useRef(false)
  useEffect(() => {
    if (autoFilled.current || !ai || !refId || !ref) return
    autoFilled.current = true
    void fill()
  }, [ai, ref?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fromChat = false): Promise<{ id: string; name: string; report?: string } | undefined> => {
    if (busy) return
    setBusy(true)
    setSteps([])
    const step = (label: string, detail?: string) => setSteps((s) => [...s.filter((x) => x.label !== label), { label, detail }])
    try {
      step('Referência', 'Lendo os quadros…')
      const f = await framesOf()
      step('Referência', f.length ? `${f.length} quadros de "${ref?.title || picked?.name || (ref ? KIND_LABEL[ref.kind] : '')}"` : 'Sem referência: pela decupagem e pelo estilo')
      const brief = (await accountContext('9x16').catch(() => undefined))?.context
      const scene = await createVideoFromReference(set, { frames: f, times, dense, how: plan.how, topic: plan.topic, notes: ref?.notes || undefined, title: ref?.title || picked?.name, plan }, { brief, onStep: step, history })
      toast.success('Vídeo criado', { description: scene.name })
      onCreated(scene.id)
      return { id: scene.id, name: scene.name, report: (scene.data as { direction?: { agentReport?: string } } | undefined)?.direction?.agentReport }
    } catch (e) {
      if (fromChat) throw e
      toast.error(e instanceof Error ? e.message : 'Não consegui criar o vídeo.')
    } finally {
      setBusy(false)
    }
  }

  // O chat da Iara vê a referência escolhida e o plano, muda o plano e manda gerar (2026-11-10)
  useCreatorIara(set, {
    reference: picked ? `arquivo "${picked.name}"${picked.dense ? ' (com movimento)' : ''}` : ref ? `"${ref.title || KIND_LABEL[ref.kind]}" (${ref.id}, ${ref.url})${dense ? ' (movimento lido)' : ''}` : undefined,
    saved: saved ?? [],
    plan,
    busy,
    setPlan,
    pick: (id) => { setPicked(null); setChosen(id) },
    readMotion: canReadMotion ? readMotion : undefined,
    fill,
    run: () => run(true),
  })

  const hasLight = !!set.brand.logoOnLight, hasDark = !!set.brand.logoOnDark
  const logoOptions = useMemo(() => {
    const o: Partial<Record<VideoPlan['logo'], string>> = {}
    if (hasDark) o.escuro = LOGO_LABEL.escuro
    if (hasLight) o.claro = LOGO_LABEL.claro
    o.nenhum = LOGO_LABEL.nenhum
    return o as Record<VideoPlan['logo'], string>
  }, [hasDark, hasLight])
  const bgOptions = useMemo(() => {
    const { referencia, ...rest } = BG_LABEL
    return (frames.length ? BG_LABEL : { referencia: 'A IA escolhe', ...rest }) as Record<VideoPlan['background'], string>
  }, [frames.length])

  // O resumo e a lista que será conferida (com os tempos estimados pela fala)
  const copy = planCopy(plan)
  const checklist = useMemo(() => {
    let at = 0
    const timed = plan.shots.map((x) => {
      const len = Math.max(1.5, spokenSeconds(x.fala))
      const t = { ...x, start: at, end: at + len }
      at += len
      return t
    })
    return buildChecklist(plan, timed, set.brand.colors[0]?.hex ?? '')
  }, [plan, set.brand.colors])
  const stale = !!filledFor && filledFor !== refKey && plan.shots.some((x) => x.ref)

  if (busy || steps.length) {
    return (
      <div className="mx-auto w-full max-w-2xl overflow-y-auto px-4 py-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Gerando o vídeo pelo plano</h1>
        <ol className="mt-5 grid gap-2 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-2 text-sm">
              {busy && i === steps.length - 1 ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-700" /> : <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              <span><b className="text-gray-900">{s.label}</b>{s.detail ? <span className="text-gray-600"> · {s.detail}</span> : null}</span>
            </li>
          ))}
          {busy && <li className="text-xs text-gray-500">{agentMode ? "No modo agente leva até ~20 minutos (a IA renderiza, compara e corrige em voltas)." : "Leva de 3 a 7 minutos."} Pode deixar a aba aberta.</li>}
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
              <p className="mt-1 max-w-xl text-sm text-gray-500">Escolha uma referência (ou nenhuma), escreva as regras que não podem faltar e deixe a IA montar a direção cena a cena. O vídeo é conferido contra o plano antes de ficar pronto, na marca de {set.brand.name}.</p>
            </div>
            <Button variant="outline" className="gap-1.5 bg-white" disabled={!ai || !!filling} onClick={() => void fill()}>
              {filling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {filledFor ? 'Preencher de novo com IA' : 'Preencher com IA'}
            </Button>
          </div>
          {filling && <p className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {filling}</p>}
          {!ai && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">A IA desta máquina não está conectada: abra o conector dos Criativos para a IA preencher o plano e gerar o vídeo.</p>}

          <Section title="Referência visual" hint="A linguagem, o ritmo e a estrutura vêm daqui. Nada é escolhido sozinho.">
            {!saved ? <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Abrindo as referências</p> : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button type="button" onClick={() => { setChosen(undefined); setPicked(null) }} className={cn('flex w-20 shrink-0 flex-col items-center justify-center rounded-lg border-2 bg-gray-50 text-[10px] text-gray-600', !ref && !picked ? 'border-violet-600' : 'border-transparent')}>Sem referência</button>
                {saved.slice(0, 40).map((r) => <SavedThumb key={r.id} r={r} teamId={team!.id} active={!picked && chosen === r.id} onPick={() => { setChosen(r.id); setPicked(null) }} />)}
              </div>
            )}
            {saved?.length === 0 && <p className="text-xs text-gray-500">Nenhuma referência com imagem ainda. Salve em <Link to="/referencias" className="underline">Referências</Link> ou mande abaixo.</p>}
            <ReferencePicker value={picked} onChange={setPicked} compact />
            {(ref || picked) && (
              dense ? (
                <p className="rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900">Movimento lido: {dense.frames.length} quadros ({dense.duration.toFixed(1)} s{dense.cuts.length ? `, ${dense.cuts.length} cortes` : ''}). A IA compara o vídeo com eles lado a lado, no mesmo momento.</p>
              ) : canReadMotion ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                  <span className="min-w-0 flex-1">Esta referência tem só {frames.length} fotos paradas: a IA não vê o movimento. Para copiar de verdade, leia o vídeo pelo link (só agora, não fica guardado).</span>
                  <Button size="sm" variant="outline" className="h-7 bg-white" disabled={reading} onClick={() => void readMotion()}>{reading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}Ler o movimento</Button>
                </div>
              ) : ref ? <p className="text-xs text-gray-500">Só {frames.length} fotos paradas desta referência: para copiar o movimento, mande o vídeo ou cole o link do reel abaixo.</p> : null
            )}
            {stale && <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900">A referência mudou depois do preenchimento: preencha de novo para a ficha e a decupagem seguirem a nova.</p>}
            {plan.reading && (frames.length > 0) && (
              <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-900">Ficha da referência <span className="font-normal text-gray-500">(o que a IA leu; corrija se errou)</span></p>
                <Field label="Linguagem visual" rows={2} value={plan.reading.resumo} onChange={(resumo) => putReading({ resumo })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Chips label="Texto na tela" value={plan.reading.texto} options={TEXT_LABEL} onChange={(texto) => putReading({ texto })} />
                  <Chips label="Ritmo" value={plan.reading.ritmo} options={RHYTHM_LABEL} onChange={(ritmo) => putReading({ ritmo })} />
                  <Field label="Fundo e luz" value={plan.reading.fundo} onChange={(fundo) => putReading({ fundo })} />
                  <Field label="Elementos" value={plan.reading.elementos} onChange={(elementos) => putReading({ elementos })} />
                  <Field label="Câmera" value={plan.reading.camera} onChange={(camera) => putReading({ camera })} />
                  <Field label="Transições" value={plan.reading.transicoes} onChange={(transicoes) => putReading({ transicoes })} />
                </div>
              </div>
            )}
          </Section>

          <Section title="Regras obrigatórias" hint="Uma por linha. Mandam sobre a referência e o estilo, e a IA confere cada uma nos quadros do vídeo pronto.">
            <Field label="" rows={3} value={plan.rules} onChange={(rules) => put({ rules })} placeholder={'Ex.: sem título em caixa alta\nmostrar o celular com o WhatsApp na cena 3\nfundo branco o vídeo todo'} />
          </Section>

          <Section title="Estilo" hint="Um pacote de linguagem pronto, só se fizer sentido. Livre: a referência e a decupagem decidem.">
            <div className="grid gap-1.5 sm:grid-cols-2">
              {(Object.keys(VIDEO_STYLES) as StyleId[]).map((id) => (
                <button key={id} type="button" aria-pressed={plan.style === id} onClick={() => put({ style: id })} className={cn('rounded-lg border px-3 py-2 text-left transition-colors', plan.style === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white hover:border-gray-300')}>
                  <span className="block text-xs font-semibold">{VIDEO_STYLES[id].label}</span>
                  <span className={cn('block text-[11px] leading-snug', plan.style === id ? 'text-white/75' : 'text-gray-500')}>{VIDEO_STYLES[id].hint}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Conteúdo">
            <Chips label="Como" value={plan.how} options={{ igual: 'Recriar como está', novo: 'Conteúdo novo' }} onChange={(how) => put({ how })} />
            <Field label="Assunto" value={plan.topic} onChange={(topic) => put({ topic })} placeholder="A IA escolhe pelo Cérebro" />
            {!plan.shots.length && <Field label="Copy da narração" rows={4} value={plan.copy} onChange={(c) => put({ copy: c })} placeholder="Vazia: a IA escreve. Com texto: a voz fala exatamente isto. Preencha com IA para dividir em cenas." />}
          </Section>

          <Section title="Decupagem" hint={plan.shots.length ? 'Cena a cena: o que aparece, o texto escrito (vazio = sem texto) e a fala. A narração é a fala de cada cena, em ordem.' : 'Ainda sem cenas: preencha com IA, adicione à mão, ou gere direto (a IA escreve o roteiro na hora).'}>
            {plan.shots.map((x, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[64px_minmax(0,1fr)]">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold text-gray-900">Cena {i + 1}</span>
                  {x.ref && frames[x.ref - 1] ? <img src={frames[x.ref - 1]} alt={`Quadro ${x.ref} da referência`} className="w-14 rounded border border-gray-200 object-cover" /> : null}
                  {frames.length > 0 && (
                    <select aria-label="Quadro da referência" value={x.ref ?? ''} onChange={(e) => putShot(i, { ref: e.target.value ? Number(e.target.value) : undefined })} className="h-6 w-14 rounded border border-gray-200 text-[10px]">
                      <option value="">—</option>
                      {frames.map((_, k) => <option key={k} value={k + 1}>Q{k + 1}</option>)}
                    </select>
                  )}
                </div>
                <div className="space-y-2">
                  <Field label="Na tela" rows={2} value={x.tela} onChange={(tela) => putShot(i, { tela })} placeholder="Elementos, composição, movimento" />
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <Field label="Texto escrito" value={x.texto} onChange={(texto) => putShot(i, { texto })} placeholder="Vazio = sem texto" />
                    <label className="block text-xs text-gray-600">Transição
                      <select value={x.transicao} onChange={(e) => putShot(i, { transicao: e.target.value as Shot['transicao'] })} className="mt-1 h-9 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900">
                        {Object.entries(SHOT_TRANSITION_LABEL).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                      </select>
                    </label>
                  </div>
                  <Field label="Fala" rows={2} value={x.fala} onChange={(fala) => putShot(i, { fala })} />
                  <button type="button" onClick={() => put({ shots: plan.shots.filter((_, j) => j !== i) })} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600"><Trash2 className="h-3 w-3" /> Tirar a cena</button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => put({ shots: [...plan.shots, { fala: '', tela: '', texto: '', transicao: 'continua' }] })}><Plus className="h-3.5 w-3.5" /> Cena</Button>
              {plan.shots.length > 0 && <Button variant="ghost" size="sm" onClick={() => put({ copy: planCopy(plan), shots: [] })}>Voltar para a copy corrida</Button>}
            </div>
          </Section>

          <Section title="Marca">
            <Chips label="Fundo" value={plan.background} options={bgOptions} onChange={(background) => put({ background })} />
            <Chips label="Versão do logo" value={plan.logo} options={logoOptions} onChange={(logo) => put({ logo })} />
            {plan.logo !== 'nenhum' && <Chips label="Onde o logo aparece" value={plan.logoPlace} options={LOGO_PLACE_LABEL} onChange={(logoPlace) => put({ logoPlace })} />}
          </Section>

          <Section title="Narração e legenda">
            <Toggle label="Narrar com voz de IA" checked={plan.narrate} onChange={(narrate) => put({ narrate })} />
            {plan.narrate ? (
              <>
                <VoicePicker value={plan.voice} onChange={(voice) => put({ voice })} brand={set.brand.name} />
                {plan.style === 'cinetico' ? <p className="text-xs text-gray-500">No texto cinético a própria animação escreve a fala: sem legenda do motor.</p> : (
                  <Chips label="Legenda" value={plan.captions.style} options={Object.fromEntries(CAPTION_STYLES.map((c) => [c.id, c.label])) as Record<SceneCaptions['style'], string>} onChange={(style) => putCaptions({ style })} />
                )}
                {plan.style !== 'cinetico' && plan.captions.style !== 'nenhuma' && (
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
            ) : <p className="text-xs text-gray-500">Sem narração, o vídeo fica sem legenda e cada cena dura o tempo de leitura.</p>}
          </Section>
        </div>

        <aside className="space-y-3 md:sticky md:top-4 md:self-start">
          <div className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
            <h2 className="text-sm font-semibold text-gray-900">O que vai sair</h2>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <dt className="text-gray-500">Referência</dt><dd className="truncate text-gray-900">{picked?.name || ref?.title || (ref ? KIND_LABEL[ref.kind] : 'Nenhuma')}{frames.length ? ` · ${frames.length} quadros` : ''}</dd>
              <dt className="text-gray-500">Estilo</dt><dd className="text-gray-900">{VIDEO_STYLES[plan.style].label}</dd>
              <dt className="text-gray-500">Cenas</dt><dd className="text-gray-900">{plan.shots.length || 'a IA decide'}</dd>
              <dt className="text-gray-500">Quem faz</dt><dd className="text-gray-900">{agentMode ? `${videoIa === 'codex' ? 'Codex' : 'Claude Code'} em modo agente (vê e corrige, ~15 min)` : 'IA de uma vez (atualize o conector para o modo agente)'}</dd>
              <dt className="text-gray-500">Fala</dt><dd className="text-gray-900">{copy ? `~${Math.round(spokenSeconds(copy))} s` : 'a IA escreve'}</dd>
            </dl>
            <p className="mt-3 text-xs font-semibold text-gray-900">A IA confere nos quadros</p>
            <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto text-[11px] leading-snug text-gray-600">
              {checklist.map((c, i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />{c}</li>)}
            </ul>
          </div>
          <Button className="w-full gap-1.5" disabled={!ai || !!filling || plan.shots.some((x) => !x.fala.trim()) || (plan.how === 'novo' && plan.topic.trim().length < 3 && !copy)} onClick={() => void run()}><Sparkles className="h-4 w-4" /> Gerar o vídeo</Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>Cancelar</Button>
        </aside>
      </div>
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
