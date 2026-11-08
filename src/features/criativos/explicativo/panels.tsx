import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Copy, ImagePlus, Loader2, Music, Scissors, Send, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { crmContext, useCrm } from '@/features/crm/crmStore'
import { moduleOn } from '@/features/crm/modules'
import { loadAccounts, prepareImage, prepareVideo, publishPost, type IgAccount, type PublishStep } from '@/features/crm/instagram'
import { accountBrand } from '@/features/conteudos/carousel'
import { useEditor } from '../store'
import { useAiAvailable } from '../link'
import { uploadAsset } from '../storage'
import { videoSupported } from '../video'
import type { CodeScene, CreativeSet } from '../types'
import { ICON_NAMES } from './icons'
import { brandOfExplainer, brandTokens, coverJpeg, explainerToMp4, iconOfBeat } from './media'
import { ReferencePicker, type Reference } from './Reference'
import { ResearchCard } from './ResearchCard'
import { autoScript, writeBriefing, writeScript } from './roteiro'
import { cleanCuts, fillerCuts, outBeats, pauseCuts, segments, toSrc, toggleWordCut, videoLength } from './timeline'
import { commitToSet } from './pipeline'
import { retime } from './transcribe'
import { narrate, spokenText, type VoiceAI } from './narracao'
import { DEFAULT_VOICE, VoicePicker } from './VoicePicker'
import { CAPTIONS, LAYOUTS, LOOKS, PATTERNS, SFX, THEMES, TRANSITIONS, TREATMENTS, type ExplainerBeat, type ExplainerData, type PatternId } from './types'
import { Label, PATTERN_COLOR, editExplainer, field, fmt, isBriefing, slug, uid } from './shared'

// ——— Roteiro ———

export const ScriptPanel: React.FC<{ set: CreativeSet; scene: CodeScene; current: number; time: number; onSeek: (t: number) => void }> = ({ set, scene, current, time, onSeek }) => {
  const data = scene.explainer!
  const briefing = isBriefing(data)
  const beats = outBeats(data, scene.duration)
  const items = useRef<(HTMLDivElement | null)[]>([])
  // Em chaves: no Chrome novo scrollIntoView devolve uma Promise, que o React tomaria pela limpeza do efeito
  useEffect(() => {
    void items.current[current]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [current])
  const patch = (id: string, p: Partial<ExplainerBeat>) => editExplainer(scene.id, (d) => ({ beats: d.beats.map((b) => (b.id === id ? { ...b, ...p } : b)) }))
  /** Tempo do vídeo → tempo guardado no roteiro (a fala original, no modo narração). */
  const stored = (d: ExplainerData, t: number) => (isBriefing(d) ? t : toSrc(segments(d), t))
  /** No briefing os momentos andam juntos: cada um mantém a duração. */
  const resequence = (list: ExplainerBeat[]) => {
    let at = 0
    return list.map((b) => {
      const dur = b.end - b.start
      const out = { ...b, start: Math.round(at * 100) / 100, end: Math.round((at + dur) * 100) / 100 }
      at += dur
      return out
    })
  }

  const split = () => {
    const b = beats[current]
    if (!b || time - b.start < 0.6 || b.end - time < 0.6) return toast.error('Ponha a agulha no meio de um momento (a pelo menos 0,6 s das pontas).')
    editExplainer(scene.id, (d) => {
      let at = stored(d, time)
      if (!briefing) {
        const word = d.words.find((w) => w.s >= at - 0.05)
        if (word) at = word.s
      }
      return { beats: d.beats.flatMap((x) => (x.id === b.id ? [{ ...x, end: at }, { ...x, id: uid(), start: at, pattern: 'titulo' as PatternId, transition: 'chicote' as const, sfx: 'swish' as const, headline: briefing ? 'Nova cena' : spokenIn(d, at, x.end) }] : [x])) }
    })
  }
  const remove = (id: string) =>
    editExplainer(scene.id, (d) => {
      const i = d.beats.findIndex((b) => b.id === id)
      if (d.beats.length < 2 || i < 0) return {}
      if (briefing) return { beats: resequence(d.beats.filter((b) => b.id !== id)) }
      const next = d.beats.filter((b) => b.id !== id)
      if (i === 0) next[0] = { ...next[0], start: 0 }
      else next[i - 1] = { ...next[i - 1], end: d.beats[i].end }
      return { beats: next }
    })
  const moveStart = (id: string, v: number) =>
    editExplainer(scene.id, (d) => {
      const i = d.beats.findIndex((b) => b.id === id)
      if (i <= 0) return {}
      const s = stored(d, v)
      const lo = d.beats[i - 1].start + 0.4
      const hi = d.beats[i].end - 0.4
      const at = Math.round(Math.min(hi, Math.max(lo, s)) * 100) / 100
      return { beats: d.beats.map((b, j) => (j === i ? { ...b, start: at } : j === i - 1 ? { ...b, end: at } : b)) }
    })
  const setDuration = (id: string, v: number) =>
    editExplainer(scene.id, (d) => ({ beats: resequence(d.beats.map((b) => (b.id === id ? { ...b, end: b.start + Math.min(8, Math.max(1, v)) } : b))) }))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{beats.length} momentos · clique para ir até ele</p>
        <Button size="sm" variant="outline" className="h-7 gap-1 bg-white text-xs" onClick={split} title="Divide o momento atual onde está a agulha"><Scissors className="h-3.5 w-3.5" /> Dividir aqui</Button>
      </div>
      {beats.map((b, i) => {
        const on = i === current
        const ic = iconOfBeat(b)
        return (
          <div key={b.id} ref={(el) => { items.current[i] = el }} className={cn('rounded-lg border p-2.5', on ? 'border-violet-400 bg-violet-50/40' : 'border-gray-200')}>
            <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => onSeek(b.start + 0.01)}>
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', PATTERN_COLOR[b.pattern])} />
              <span className="text-[11px] tabular-nums text-gray-500">{fmt(b.start)}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{b.headline.replace(/\*/g, '')}</span>
            </button>
            {on && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-gray-500">Animação
                  <select className={field} value={b.pattern} onChange={(e) => patch(b.id, { pattern: e.target.value as PatternId })}>
                    {(Object.keys(PATTERNS) as PatternId[]).map((p) => (<option key={p} value={p}>{PATTERNS[p].label}</option>))}
                  </select>
                </label>
                {briefing ? (
                  <label className="text-[11px] text-gray-500">Duração (s)<input type="number" step={0.1} min={1} max={8} className={field} value={Math.round((b.end - b.start) * 10) / 10} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setDuration(b.id, e.target.valueAsNumber)} /></label>
                ) : (
                  <label className="text-[11px] text-gray-500">Começa em (s)<input type="number" step={0.05} disabled={i === 0} className={field} value={b.start} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && moveStart(b.id, e.target.valueAsNumber)} /></label>
                )}
                <p className="col-span-2 -mt-1 text-[11px] leading-snug text-gray-500">{PATTERNS[b.pattern].hint}</p>
                <label className="col-span-2 text-[11px] text-gray-500">Texto na tela<input className={field} value={b.headline} onChange={(e) => patch(b.id, { headline: e.target.value })} /></label>
                {(briefing || data.voiceAI) && (
                  <label className="col-span-2 text-[11px] text-gray-500">Fala da narração{data.voiceAI ? ' (depois, "Refazer a narração" em Estilo)' : ''}
                    <textarea className="min-h-[52px] w-full rounded-md border border-gray-200 p-2 text-sm" placeholder={spokenText({ ...b, fala: undefined })} value={b.fala ?? ''} onChange={(e) => patch(b.id, { fala: e.target.value || undefined })} />
                  </label>
                )}
                <label className="text-[11px] text-gray-500">Destaque (fonte e cor da marca)<input className={field} placeholder="palavra" value={(b.highlight ?? []).join(', ')} onChange={(e) => patch(b.id, { highlight: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></label>
                <label className="text-[11px] text-gray-500">Ícone
                  <select className={field} value={ic ?? ''} onChange={(e) => patch(b.id, { icon: e.target.value || undefined, emoji: undefined })}>
                    <option value="">Sem ícone</option>
                    {ICON_NAMES.map((n) => (<option key={n} value={n}>{n.replace(/_/g, ' ')}</option>))}
                  </select>
                </label>
                {(b.pattern === 'titulo' || b.pattern === 'gancho' || b.pattern === 'cta' || b.pattern === 'citacao') && (
                  <label className="col-span-2 text-[11px] text-gray-500">{b.pattern === 'cta' ? 'Texto do botão' : b.pattern === 'citacao' ? 'Quem disse' : 'Linha de apoio'}<input className={field} value={b.sub ?? ''} onChange={(e) => patch(b.id, { sub: e.target.value || undefined })} /></label>
                )}
                {(b.pattern === 'lista' || b.pattern === 'processo' || b.pattern === 'comparar') && (
                  <label className="col-span-2 text-[11px] text-gray-500">{b.pattern === 'comparar' ? 'Errado e certo (uma linha cada)' : 'Itens (um por linha)'}
                    <textarea className="min-h-[70px] w-full rounded-md border border-gray-200 p-2 text-sm" value={(b.items ?? []).join('\n')} onChange={(e) => patch(b.id, { items: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
                  </label>
                )}
                {b.pattern === 'numero' && (
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <label className="text-[11px] text-gray-500">Antes<input className={field} placeholder="R$" value={b.number?.prefix ?? ''} onChange={(e) => patch(b.id, { number: { value: b.number?.value ?? 0, ...b.number, prefix: e.target.value || undefined } })} /></label>
                    <label className="text-[11px] text-gray-500">Número<input type="number" className={field} value={b.number?.value ?? 0} onChange={(e) => patch(b.id, { number: { ...b.number, value: e.target.valueAsNumber || 0 } })} /></label>
                    <label className="text-[11px] text-gray-500">Depois<input className={field} placeholder="%" value={b.number?.suffix ?? ''} onChange={(e) => patch(b.id, { number: { value: b.number?.value ?? 0, ...b.number, suffix: e.target.value || undefined } })} /></label>
                  </div>
                )}
                {data.look && data.look !== 'editorial' && (
                  <>
                    <label className="col-span-2 text-[11px] text-gray-500">Rótulo do cartão (palavra de destaque entre *asteriscos*)<input className={field} placeholder="preparando os *slides*" value={b.kicker ?? ''} onChange={(e) => patch(b.id, { kicker: e.target.value || undefined })} /></label>
                    {b.pattern !== 'foto' && (
                      <label className="col-span-2 text-[11px] text-gray-500">Print no cartão
                        <select className={field} value={b.photo ?? ''} onChange={(e) => patch(b.id, { photo: e.target.value || undefined })}>
                          <option value="">{data.photos.length ? 'A animação da cena' : 'A animação da cena (ponha prints em Estilo › Fotos)'}</option>
                          {data.photos.map((p) => (<option key={p.src} value={p.name}>{p.name}</option>))}
                        </select>
                      </label>
                    )}
                  </>
                )}
                {b.pattern === 'foto' && (
                  <label className="col-span-2 text-[11px] text-gray-500">Foto
                    <select className={field} value={b.photo ?? ''} onChange={(e) => patch(b.id, { photo: e.target.value || undefined })}>
                      <option value="">{data.photos.length ? 'Escolha' : 'Ponha fotos em Estilo'}</option>
                      {data.photos.map((p) => (<option key={p.src} value={p.name}>{p.name}</option>))}
                    </select>
                  </label>
                )}
                <label className="text-[11px] text-gray-500">Transição
                  <select className={field} value={b.transition} onChange={(e) => patch(b.id, { transition: e.target.value as ExplainerBeat['transition'] })}>
                    {Object.entries(TRANSITIONS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </label>
                <label className="text-[11px] text-gray-500">Som
                  <select className={field} value={b.sfx} onChange={(e) => patch(b.id, { sfx: e.target.value as ExplainerBeat['sfx'] })}>
                    {Object.entries(SFX).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </label>
                {!briefing && <p className="col-span-2 text-[11px] italic leading-snug text-gray-500">“{spokenIn(data, data.beats.find((x) => x.id === b.id)?.start ?? 0, data.beats.find((x) => x.id === b.id)?.end ?? 0, false)}”</p>}
                {beats.length > 1 && <button type="button" className="col-span-2 flex items-center gap-1 justify-self-start text-[11px] text-gray-500 hover:text-red-600" onClick={() => remove(b.id)}><Trash2 className="h-3 w-3" /> {briefing ? 'Tirar esta cena' : 'Juntar com o anterior'}</button>}
              </div>
            )}
          </div>
        )
      })}
      <RewriteBox set={set} scene={scene} />
    </div>
  )
}

/** O que foi falado num trecho (em tempo da fala original). */
function spokenIn(d: ExplainerData, a: number, b: number, title = true) {
  const text = d.words.filter((w) => w.s >= a - 0.05 && w.s < b).map((w) => w.w).join(' ')
  if (!title) return text
  const t = text.split(/\s+/).slice(0, 5).join(' ').toLowerCase()
  return t ? t[0].toUpperCase() + t.slice(1) : 'Nova cena'
}

const RewriteBox: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const data = scene.explainer!
  const briefing = isBriefing(data)
  const ai = useAiAvailable()
  const [brief, setBrief] = useState(data.brief ?? '')
  const [reference, setReference] = useState<Reference | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const run = async () => {
    setBusy('Pedindo à IA…')
    setReply(null)
    try {
      const brand = brandOfExplainer(set, data)
      const d = { ...data, brief }
      if (briefing) {
        const r = await writeBriefing(set, d, { brand, reference: reference?.frames, onStep: setBusy })
        editExplainer(scene.id, () => ({ beats: r.beats, brief: brief.trim() || undefined, ...(r.caption ? { caption: r.caption } : {}) }))
        setReply(r.reply ?? null)
      } else {
        const r = await writeScript(set, d, data.media?.duration ?? scene.duration, { brand, reference: reference?.frames, onStep: setBusy })
        editExplainer(scene.id, (cur) => ({ beats: r.beats, brief: brief.trim() || undefined, ...(r.caption ? { caption: r.caption } : {}), ...(r.cuts.length ? { cuts: cleanCuts([...(cur.cuts ?? []), ...r.cuts], cur.media?.duration ?? 0) } : {}) }))
        setReply([r.reply, r.cuts.length ? `${r.cuts.length} cortes sugeridos (aba Fala para ver e desfazer).` : ''].filter(Boolean).join(' ') || null)
      }
      toast.success('Roteiro novo.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'A IA não respondeu.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="mt-4 border-t border-gray-100 pt-4">
      <Label>{briefing ? 'Refazer roteiro e vídeo' : 'Refazer o roteiro'}</Label>
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="O que mudar. Ex.: mais cenas com números, menos texto, gancho mais forte, tom mais divertido." className="min-h-[64px] w-full rounded-md border border-gray-200 p-2 text-sm" />
      <div className="mt-2"><ReferencePicker value={reference} onChange={setReference} compact /></div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button size="sm" className="gap-1.5" disabled={!ai || !!busy} onClick={() => void run()}><Sparkles className="h-3.5 w-3.5" /> Roteiro com IA</Button>
        {!briefing && <Button size="sm" variant="outline" className="bg-white" disabled={!!busy} onClick={() => editExplainer(scene.id, (d) => ({ beats: autoScript(d.words, d.media?.duration ?? scene.duration, d.photos.map((p) => p.name)) }))}>Automático</Button>}
      </div>
      {busy && <p className="mt-1.5 text-[11px] text-violet-700">{busy}</p>}
      {reply && <p className="mt-2 rounded-md bg-violet-50 p-2 text-xs leading-snug text-violet-900">{reply}</p>}
      {!ai && <p className="mt-1.5 text-[11px] text-gray-500">Conecte a IA desta máquina (o conector dos Criativos) para o roteiro com IA.</p>}
    </section>
  )
}

// ——— Estilo: marca, formato, legenda, fotos, som ———

function Chips<T extends string>({ value, options, onPick, disabled }: { value: T; options: Record<T, { label: string } | string>; onPick: (v: T) => void; disabled?: (v: T) => boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(options) as T[]).map((k) => {
        const o = options[k]
        return (
          <button key={k} type="button" disabled={disabled?.(k)} onClick={() => onPick(k)} className={cn('rounded-full border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40', value === k ? 'border-violet-500 bg-violet-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300')}>{typeof o === 'string' ? o : o.label}</button>
        )
      })}
    </div>
  )
}

const BrandBox: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const data = scene.explainer!
  const brand = brandOfExplainer(set, data)
  const t = brandTokens(brand)
  const [busy, setBusy] = useState(false)
  const fromAccount = async () => {
    setBusy(true)
    try {
      const b = await accountBrand()
      if (!b) throw new Error('A conta não tem marca no Cérebro (marca/DESIGN.md com cores). Escreva ou traga de um projeto no /cerebro.')
      editExplainer(scene.id, () => ({ brand: b }))
      toast.success(`Usando a marca ${b.name} do Cérebro.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui ler a marca da conta.')
    } finally {
      setBusy(false)
    }
  }
  const sw = (hex: string, label: string) => (
    <span className="flex items-center gap-1 text-[11px] text-gray-600" title={hex}><span className="h-4 w-4 rounded border border-black/10" style={{ background: hex }} />{label}</span>
  )
  return (
    <section>
      <Label>Design system da marca</Label>
      <div className="rounded-lg border border-gray-200 p-2.5">
        <p className="text-sm font-semibold text-gray-900">{brand.name || 'Sem nome'} <span className="font-normal text-gray-500">· {data.brand ? 'da conta (Cérebro)' : 'do conjunto'}</span></p>
        <div className="mt-2 flex flex-wrap gap-2">{sw(t.ink, 'tinta')}{sw(t.paper, 'papel')}{sw(t.accent, 'destaque')}{sw(t.muted, 'apagado')}</div>
        <p className="mt-2 text-[11px] text-gray-600">Títulos em <b>{t.heading}</b>, texto em <b>{t.body}</b>{t.emphasis !== t.heading ? <>, destaque em <b>{t.emphasis}</b>{t.emphasisItalic ? ' itálico' : ''}</> : ''}; botão {t.radius >= 999 ? 'em pílula' : t.radius ? `com canto de ${t.radius} px` : 'quadrado'}; {brand.logoOnLight || brand.logoOnDark ? 'com logo' : 'sem logo (escreve o nome)'}.</p>
        {!brand.colors.length && <p className="mt-1 text-[11px] text-amber-700">Sem cores na marca: o vídeo sai em cinza neutro. Use a marca da conta.</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs" disabled={busy} onClick={() => void fromAccount()}>{busy ? 'Lendo…' : 'Usar a marca da conta (DESIGN.md)'}</Button>
        {data.brand && <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => editExplainer(scene.id, () => ({ brand: undefined }))}>Voltar à marca do conjunto</button>}
      </div>
    </section>
  )
}

/** Narração por voz de IA: gerar (vídeo sem voz) ou refazer (com outra voz, ou depois de mudar as falas). */
const NarrationBox: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const data = scene.explainer!
  const [cfg, setCfg] = useState<VoiceAI>({ ...DEFAULT_VOICE, ...(data.voiceAI as VoiceAI | undefined) })
  const [busy, setBusy] = useState<string | null>(null)
  const run = async () => {
    setBusy('Começando…')
    try {
      const out = await narrate(set, data, { ...cfg, brand: brandOfExplainer(set, data), onStep: setBusy })
      // Grava e confere (a pessoa pode ter saído da tela durante a narração)
      await commitToSet(set, (cur) => ({
        ...cur,
        assets: cur.assets.some((x) => x.id === out.asset.id) ? cur.assets : [...cur.assets, out.asset],
        scenes: (cur.scenes ?? []).map((s) => (s.id === scene.id && s.explainer ? { ...s, explainer: { ...s.explainer, ...out.patch }, duration: videoLength({ ...s.explainer, ...out.patch }), updatedAt: Date.now() } : s)),
      }))
      toast.success('Narração pronta. Dê play.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui gerar a narração.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-2.5">
      <p className="mb-1.5 text-xs font-medium text-gray-800">Narração por voz de IA</p>
      <VoicePicker value={cfg} onChange={setCfg} brand={brandOfExplainer(set, data).name} />
      <Button type="button" size="sm" className="mt-2 w-full gap-1.5" disabled={!!busy} onClick={() => void run()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {busy ?? (data.voiceAI ? 'Refazer a narração' : 'Gerar narração')}</Button>
      <p className="mt-1 text-[11px] leading-snug text-gray-500">A voz lê a fala de cada cena (aba Roteiro) e as cenas passam a seguir a voz, com legenda. {data.voiceAI ? 'Refazer troca a voz e o tempo das cenas.' : ''}</p>
    </div>
  )
}

const MusicBox: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const data = scene.explainer!
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const tracks = set.assets.filter((a) => a.kind === 'audio' && `asset:${a.id}` !== data.media?.src)
  const choose = (src: string, name: string) => editExplainer(scene.id, (d) => ({ music: { src, name, volume: d.music?.volume ?? (isBriefing(d) ? 0.8 : 0.5) } }))
  const send = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      const a = await uploadAsset(set, file, file.name)
      useEditor.getState().edit((cur) => ({ ...cur, assets: [...cur.assets, a] }))
      choose(`asset:${a.id}`, file.name)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar a trilha.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-700">Trilha de fundo</p>
      <select className={field} value={data.music?.src ?? ''} onChange={(e) => { const a = tracks.find((x) => `asset:${x.id}` === e.target.value); if (a) choose(e.target.value, a.name); else editExplainer(scene.id, () => ({ music: undefined })) }}>
        <option value="">Sem trilha</option>
        {tracks.map((a) => (<option key={a.id} value={`asset:${a.id}`}>{a.name}</option>))}
      </select>
      <input ref={input} type="file" accept="audio/*" className="hidden" onChange={(e) => void send(e.target.files?.[0])} />
      <div className="mt-1.5 flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 bg-white text-xs" disabled={busy} onClick={() => input.current?.click()}><Music className="h-3.5 w-3.5" /> {busy ? 'Enviando…' : 'Enviar trilha'}</Button>
        {data.music && <input type="range" aria-label="Volume da trilha" min={0} max={1} step={0.05} value={data.music.volume} onChange={(e) => editExplainer(scene.id, (d) => ({ music: d.music ? { ...d.music, volume: Number(e.target.value) } : undefined }))} className="min-w-0 flex-1 accent-violet-600" />}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{isBriefing(data) ? 'Sem narração, a trilha carrega o ritmo: vale muito pôr uma.' : 'Ela abaixa sozinha enquanto você fala e volta nas pausas.'} Só música com licença para uso comercial.</p>
    </div>
  )
}

export const StylePanel: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const data = scene.explainer!
  const briefing = isBriefing(data)
  const hasVideo = data.media?.kind === 'video' && !briefing
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const set1 = (p: Partial<ExplainerData>) => editExplainer(scene.id, () => p)
  const send = async (files: File[]) => {
    setBusy(true)
    try {
      for (const f of files) {
        const a = await uploadAsset(set, f, f.name)
        const video = f.type.startsWith('video/')
        const name = slug(f.name) || `${video ? 'video' : 'foto'}${data.photos.length + 1}`
        useEditor.getState().edit((cur) => ({ ...cur, assets: [...cur.assets, a] }))
        // Vídeo curto (já cortado): toca em loop, sem som, no cartão ou na cena Foto/vídeo
        editExplainer(scene.id, (d) => ({ photos: [...d.photos, { src: `asset:${a.id}`, name, ...(video ? { kind: 'video' as const } : {}), origin: 'enviado' as const }] }))
        if (!video) await useEditor.getState().ensureImage(`asset:${a.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar a foto.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const theme = data.theme === 'marca' ? 'alternado' : data.theme
  return (
    <div className="space-y-5">
      <section>
        <Label>Estilo do vídeo</Label>
        <Chips value={data.look ?? 'editorial'} options={LOOKS} onPick={(v) => set1({ look: v })} />
        <p className="mt-1 text-[11px] text-gray-500">{LOOKS[data.look ?? 'editorial'].hint}{data.look && data.look !== 'editorial' ? ' Ponha um print em cada cena (aba Roteiro, "Print no cartão"); sem print, o cartão mostra a animação da cena.' : ''}</p>
      </section>
      <BrandBox set={set} scene={scene} />
      <section>
        <Label>Fundo</Label>
        <Chips value={theme} options={THEMES} onPick={(v) => set1({ theme: v })} />
      </section>
      {!briefing && (data.look ?? 'editorial') === 'editorial' && (
        <section>
          <Label>Formato</Label>
          <Chips value={data.layout} options={LAYOUTS} onPick={(v) => set1({ layout: v })} disabled={(v) => v !== 'animacao' && !hasVideo} />
          <p className="mt-1 text-[11px] text-gray-500">{LAYOUTS[data.layout].hint}</p>
          {hasVideo && data.layout !== 'animacao' && <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={!!data.mirror} onChange={(e) => set1({ mirror: e.target.checked })} /> Espelhar a câmera</label>}
        </section>
      )}
      {!briefing && (
        <section>
          <Label>Legenda animada</Label>
          <Chips value={data.captions} options={CAPTIONS} onPick={(v) => set1({ captions: v })} />
          <p className="mt-1 text-[11px] text-gray-500">{CAPTIONS[data.captions].hint}</p>
        </section>
      )}
      <section>
        <Label>Fotos</Label>
        <Chips value={data.treatment} options={TREATMENTS} onPick={(v) => set1({ treatment: v })} />
        <div className="mt-2 space-y-1">
          {data.photos.map((p) => (
            <div key={p.src} className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1">
              {p.kind === 'video' && <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-600">vídeo</span>}
              <input className="h-6 min-w-0 flex-1 rounded border border-gray-200 px-1 font-mono text-[11px]" value={p.name} aria-label="Nome da foto no roteiro" onChange={(e) => { const name = e.target.value.replace(/[^\w-]/g, '').slice(0, 24); editExplainer(scene.id, (d) => ({ photos: d.photos.map((x) => (x.src === p.src ? { ...x, name } : x)), beats: d.beats.map((b) => (b.photo === p.name ? { ...b, photo: name } : b)) })) }} />
              <button type="button" aria-label="Tirar a foto" onClick={() => editExplainer(scene.id, (d) => ({ photos: d.photos.filter((x) => x.src !== p.src) }))}><Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-600" /></button>
            </div>
          ))}
        </div>
        <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => void send(Array.from(e.target.files ?? []))} />
        <Button type="button" variant="outline" size="sm" className="mt-2 w-full gap-1.5 bg-white" disabled={busy} onClick={() => input.current?.click()}><ImagePlus className="h-4 w-4" /> {busy ? 'Enviando…' : 'Pôr fotos ou vídeos'}</Button>
      </section>
      <section className="space-y-3">
        <Label>Som</Label>
        {!briefing && data.media && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-700">Voz</p>
            <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={data.enhanceVoice !== false} onChange={(e) => set1({ enhanceVoice: e.target.checked })} /> Tratar a voz (som de estúdio, volume de redes)</label>
            <label className="mt-1 flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={data.gateVoice !== false} onChange={(e) => set1({ gateVoice: e.target.checked })} /> Abaixar o ruído entre as frases</label>
            <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-700"><span className="w-14">Volume</span><input type="range" min={0} max={1.5} step={0.05} value={data.voiceVolume} onChange={(e) => set1({ voiceVolume: Number(e.target.value) })} className="flex-1 accent-violet-600" /></label>
          </div>
        )}
        {(!data.media || data.voiceAI) && <NarrationBox set={set} scene={scene} />}
        <MusicBox set={set} scene={scene} />
        <div>
          <p className="mb-1 text-xs font-medium text-gray-700">Efeitos</p>
          <input type="range" aria-label="Volume dos efeitos" min={0} max={1} step={0.05} value={data.sfxVolume} onChange={(e) => set1({ sfxVolume: Number(e.target.value) })} className="w-full accent-violet-600" />
          <p className="text-[11px] text-gray-500">Whoosh, swish, pop, impacto, clique, digitação, ding e subida, gerados aqui (sem direitos de terceiros). Troque o som de cada momento no roteiro.</p>
        </div>
      </section>
      <section>
        <Label>Nome</Label>
        <input className={field} value={scene.name} onChange={(e) => editExplainer(scene.id, () => ({}), { name: e.target.value })} />
        <button type="button" className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-red-600" onClick={() => useEditor.getState().edit((cur) => ({ ...cur, scenes: (cur.scenes ?? []).filter((s) => s.id !== scene.id) }))}><Trash2 className="h-3.5 w-3.5" /> Apagar este vídeo</button>
      </section>
    </div>
  )
}

// ——— Fala: cortes (narração) ou briefing ———

export const SpeechPanel: React.FC<{ scene: CodeScene; onSeek: (t: number) => void }> = ({ scene }) => {
  const data = scene.explainer!
  const original = useMemo(() => data.words.map((w) => w.w).join(' '), [data.words])
  const [text, setText] = useState(original)
  useEffect(() => {
    setText(original)
  }, [original])
  const [briefText, setBriefText] = useState(data.briefText ?? '')

  if (isBriefing(data))
    return (
      <div className="space-y-3">
        {data.research && <ResearchCard research={data.research} />}
        <Label>O briefing</Label>
        <p className="text-[11px] leading-snug text-gray-500">No modo briefing a fala não vai para o vídeo: ela e este texto só dizem à IA o que comunicar. Mude e peça "Roteiro com IA" na aba Roteiro.</p>
        <textarea value={briefText} onChange={(e) => setBriefText(e.target.value)} onBlur={() => briefText !== (data.briefText ?? '') && editExplainer(scene.id, () => ({ briefText: briefText.trim() || undefined }))} placeholder="O que o vídeo precisa comunicar." className="min-h-[140px] w-full rounded-md border border-gray-200 p-2.5 text-sm" />
        {original && (<><p className="text-xs font-medium text-gray-700">Fala transcrita</p><p className="rounded-md bg-gray-50 p-2.5 text-sm leading-relaxed text-gray-700">{original}</p></>)}
      </div>
    )

  const total = data.media?.duration ?? 0
  const cuts = cleanCuts(data.cuts, total)
  const removed = cuts.reduce((a, c) => a + (c.e - c.s), 0)
  const cutWord = (s: number, e: number) => cuts.some((c) => (s + e) / 2 >= c.s && (s + e) / 2 < c.e)
  const addCuts = (more: { s: number; e: number }[]) => editExplainer(scene.id, (d) => ({ cuts: cleanCuts([...(d.cuts ?? []), ...more], total) }))
  return (
    <div className="space-y-4">
      <section>
        <Label>Cortes na fala</Label>
        <p className="text-[11px] leading-snug text-gray-500">Clique numa palavra para cortar ou devolver. No vídeo da pessoa o corte vira corte seco, como nos reels. {cuts.length ? `${cuts.length} cortes, ${removed.toFixed(1)} s a menos (${fmt(total)} → ${fmt(scene.duration)}).` : 'Sem cortes.'}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 bg-white text-xs" onClick={() => addCuts(pauseCuts(data.words, total))}><Scissors className="h-3.5 w-3.5" /> Cortar pausas</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 bg-white text-xs" onClick={() => addCuts(fillerCuts(data.words))}><Scissors className="h-3.5 w-3.5" /> Tirar vícios</Button>
          {cuts.length > 0 && <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => editExplainer(scene.id, () => ({ cuts: [] }))}><Undo2 className="h-3.5 w-3.5" /> Desfazer todos</Button>}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1.5 rounded-md border border-gray-200 p-2.5 text-sm leading-relaxed">
          {data.words.map((w, i) => {
            const off = cutWord(w.s, w.e)
            return (
              <button key={i} type="button" onClick={() => editExplainer(scene.id, (d) => ({ cuts: toggleWordCut(d, w) }))} title={`${w.s.toFixed(2)} s`} className={cn('rounded px-0.5', off ? 'bg-red-50 text-red-400 line-through' : 'text-gray-800 hover:bg-violet-50')}>{w.w}</button>
            )
          })}
        </div>
      </section>
      <section>
        <Label>Corrigir a transcrição</Label>
        <p className="mb-2 text-[11px] leading-snug text-gray-500">É daqui que sai a legenda. Corrija nomes e termos; os tempos de cada palavra se mantêm.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[160px] w-full rounded-md border border-gray-200 p-2.5 text-sm leading-relaxed" />
        <div className="mt-1.5 flex items-center gap-2">
          <Button size="sm" variant="outline" className="bg-white" disabled={text === original} onClick={() => editExplainer(scene.id, (d) => ({ words: retime(d.words, text) }))}>Aplicar a correção</Button>
          {text !== original && <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setText(original)}>Descartar</button>}
        </div>
        {text !== original && text.split(/\s+/).filter(Boolean).length !== data.words.length && <p className="mt-1 text-[11px] text-amber-700">O número de palavras mudou: os tempos serão redistribuídos no trecho.</p>}
      </section>
      <p className="text-[11px] text-gray-500">{data.media ? `Fala: ${data.media.name} (${data.media.kind === 'video' ? 'vídeo' : 'áudio'}, ${fmt(data.media.duration)})` : ''}</p>
    </div>
  )
}

// ——— Publicar ———

const STEP_LABEL: Record<PublishStep | 'gerando', string> = { gerando: 'Gerando o vídeo', enviando: 'Enviando o vídeo', preparando: 'O Instagram prepara o post', processando: 'Processando o vídeo', publicado: 'Publicado' }

export const PublishPanel: React.FC<{ set: CreativeSet; scene: CodeScene }> = ({ set, scene }) => {
  const data = scene.explainer!
  const [caption, setCaption] = useState(data.caption ?? '')
  useEffect(() => {
    setCaption(data.caption ?? '')
  }, [data.caption])
  const [accounts, setAccounts] = useState<IgAccount[] | null>(null)
  const [teamId, setTeamId] = useState<string>()
  const [accountId, setAccountId] = useState('')
  const [problem, setProblem] = useState<string>()
  const [step, setStep] = useState<PublishStep | 'gerando' | null>(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<{ permalink?: string } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const team = useCrm.getState().team ?? (await crmContext()).team
        if (!moduleOn(team, 'instagram')) throw new Error('O módulo Instagram está desligado nesta conta.')
        const list = await loadAccounts(team.id)
        if (!alive) return
        setTeamId(team.id)
        setAccounts(list)
        setAccountId(list[0]?.id ?? '')
        if (!list.length) setProblem('Nenhuma conta do Instagram conectada nesta conta.')
      } catch (err) {
        if (alive) {
          setProblem(err instanceof Error ? err.message : 'Não consegui ler as contas do Instagram.')
          setAccounts([])
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const saveCaption = () => caption !== (data.caption ?? '') && editExplainer(scene.id, () => ({ caption }))

  const publish = async () => {
    const account = accounts?.find((a) => a.id === accountId)
    if (!teamId || !account) return
    saveCaption()
    setDone(null)
    try {
      setStep('gerando')
      setProgress(0)
      await useEditor.getState().ensureAssets()
      const images = useEditor.getState().images
      const blob = await explainerToMp4(scene, set, images, { onProgress: setProgress })
      const file = await prepareVideo(new File([blob], 'video-explicativo.mp4', { type: 'video/mp4' }))
      const cover = await prepareImage(await coverJpeg(scene, set, images), 'capa.jpg')
      const published = await publishPost({ teamId, accountId: account.id, kind: 'reel', caption, files: [file], shareToFeed: true, cover, onStep: setStep })
      URL.revokeObjectURL(file.url)
      URL.revokeObjectURL(cover.url)
      setDone({ permalink: published.permalink })
      toast.success('Reels publicado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui publicar.')
    } finally {
      setStep(null)
    }
  }

  return (
    <div className="space-y-4">
      <section>
        <Label>Legenda do post</Label>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} onBlur={saveCaption} placeholder="A legenda que vai no reels. A IA escreve uma junto com o roteiro." className="min-h-[150px] w-full rounded-md border border-gray-200 p-2.5 text-sm" />
        <button type="button" className="mt-1 flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline" onClick={() => void navigator.clipboard.writeText(caption).then(() => toast.success('Legenda copiada.'))}><Copy className="h-3.5 w-3.5" /> Copiar a legenda</button>
      </section>
      <section className="border-t border-gray-100 pt-4">
        <Label>Publicar como reels</Label>
        {accounts === null ? <p className="text-xs text-gray-500">Lendo as contas do Instagram…</p> : problem ? <p className="text-xs text-gray-600">{problem}{/[.!?]$/.test(problem) ? '' : '.'} Você ainda pode baixar o MP4 e postar pelo celular.</p> : (
          <>
            <select className={field} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (<option key={a.id} value={a.id}>@{a.username}</option>))}
            </select>
            <p className="mt-1.5 text-[11px] text-gray-500">Sai como reels, também no feed, com a capa no gancho. Publica só quando você clicar.</p>
            <Button className="mt-2 w-full gap-1.5" disabled={!!step || !videoSupported()} onClick={() => void publish()}>
              {step ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {step ? `${STEP_LABEL[step]}${step === 'gerando' ? ` ${Math.round(progress * 100)}%` : '…'}` : 'Publicar agora'}
            </Button>
            {done && <p className="mt-2 text-xs text-emerald-700">Publicado. {done.permalink && <a href={done.permalink} target="_blank" rel="noreferrer" className="underline">Ver no Instagram</a>}</p>}
          </>
        )}
      </section>
    </div>
  )
}
