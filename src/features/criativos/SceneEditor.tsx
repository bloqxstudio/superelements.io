import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Captions, Mic, Plus, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useEditor } from './store'
import { useAiAvailable } from './link'
import { writeSceneCode } from './sceneAi'
import { CAPTION_STYLES, narrateParts, sceneDataOf, type SceneCaptions, type SceneData, type SceneField } from './sceneEdit'
import { tryScene } from './videoFromReference'
import { DEFAULT_VOICE, VoicePicker } from './explicativo/VoicePicker'
import type { VoiceAI } from './explicativo/voiceDirection'
import type { CodeScene, CreativeSet } from './types'

/**
 * "Editar" no estúdio de animação (2026-11-09; o usuário: "sinto falta de poder editar, seja motion ou vídeo…
 * trocar legenda, mudar o tipo… trocar efeitos"). Três blocos, todos sem pedir outra animação à IA:
 *   - Texto e efeitos: os campos que a IA expôs ao escrever a cena (`env.data.params`). Cena sem campos ganha
 *     um botão que pede à IA para torná-la editável sem mudar o visual.
 *   - Narração: as partes (rótulo e fala) e a voz; "Refazer a narração" narra de novo e a cena acompanha os
 *     tempos novos (ela lê `env.data.parts`).
 *   - Legenda: a legenda da fala desenhada pelo motor por cima, nos estilos do vídeo explicativo.
 */

type Edit = (fn: (s: CodeScene) => CodeScene) => void

const inputClass = 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const Label: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{icon}{children}</p>
)

export const SceneEditPanel: React.FC<{ set: CreativeSet; scene: CodeScene; edit: Edit }> = ({ set, scene, edit }) => {
  const data = sceneDataOf(scene.data)
  const setData = (fn: (d: SceneData) => SceneData) => edit((s) => ({ ...s, data: fn(sceneDataOf(s.data)) }))
  return (
    <div className="space-y-5">
      <FieldsBlock set={set} scene={scene} data={data} setData={setData} edit={edit} />
      <NarrationBlock set={set} scene={scene} data={data} edit={edit} />
      <CaptionsBlock data={data} setData={setData} hasWords={!!data.words?.length} />
    </div>
  )
}

// Texto e efeitos

const FieldsBlock: React.FC<{ set: CreativeSet; scene: CodeScene; data: SceneData; setData: (fn: (d: SceneData) => SceneData) => void; edit: Edit }> = ({ set, scene, data, setData, edit }) => {
  const ai = useAiAvailable()
  const [busy, setBusy] = useState<string | null>(null)
  const fields = data.fields
  const groups = useMemo(() => {
    const m = new Map<string, SceneField[]>()
    for (const f of fields ?? []) m.set(f.group || 'Geral', [...(m.get(f.group || 'Geral') ?? []), f])
    return [...m.entries()]
  }, [fields])
  const change = (key: string, value: SceneField['value']) => setData((d) => ({ ...d, fields: (d.fields ?? []).map((f) => (f.key === key ? { ...f, value } : f)) }))

  // Cena antiga ou escrita sem campos: a IA reescreve lendo env.data.params, sem mudar o visual
  const makeEditable = async () => {
    setBusy('A IA está separando os textos, as cores e os efeitos…')
    try {
      const request = 'Deixe esta cena editável SEM mudar o visual, o ritmo nem os tempos: troque cada texto da tela, as cores principais e os efeitos por campos lidos em env.data.params (com o valor de hoje como padrão) e devolva a lista de campos. Inclua de 2 a 4 escolhas de efeito que mudem de verdade o visual.'
      let out = await writeSceneCode(set, scene, request, { adjust: true, onStep: (s) => setBusy(s) })
      let error = await tryScene(out.code, set, scene.duration, { ...data, fields: out.fields }, scene.format)
      if (error) {
        setBusy('Corrigindo e conferindo de novo…')
        out = await writeSceneCode(set, { ...scene, code: out.code, data: { ...data, fields: out.fields } }, `${request}\n\nO código abaixo deu este erro ao rodar: ${error}\nCorrija sem mudar a ideia.`, { adjust: true, onStep: (s) => setBusy(s) })
        error = await tryScene(out.code, set, scene.duration, { ...data, fields: out.fields }, scene.format)
      }
      if (error) throw new Error(`A versão editável não rodou: ${error}. A cena ficou como estava.`)
      if (!out.fields?.length) throw new Error('A IA não devolveu os campos. Tente de novo.')
      edit((s) => ({ ...s, code: out.code, data: { ...sceneDataOf(s.data), fields: out.fields } }))
      toast.success(`${out.fields.length} campos para editar.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'A IA não respondeu.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <Label icon={<SlidersHorizontal className="h-3.5 w-3.5" />}>Texto e efeitos</Label>
      {!fields?.length ? (
        <div className="rounded-md border border-dashed border-gray-300 p-3">
          <p className="text-xs leading-snug text-gray-600">Esta animação ainda não tem campos. A IA separa os textos da tela, as cores e os tipos de efeito em campos que você troca aqui, sem mudar o visual.</p>
          <Button type="button" size="sm" className="mt-2 w-full gap-1.5" disabled={!ai || !!busy} onClick={() => void makeEditable()}><Sparkles className="h-3.5 w-3.5" /> Deixar editável</Button>
          {busy && <p className="mt-1.5 text-[11px] text-violet-700">{busy}</p>}
          {!ai && <p className="mt-1.5 text-[11px] text-gray-500">Precisa da IA desta máquina (o conector dos Criativos).</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([group, list]) => (
            <div key={group}>
              <p className="mb-1 text-[11px] font-semibold text-gray-700">{group}</p>
              <div className="space-y-1.5">{list.map((f) => <FieldInput key={f.key} field={f} onChange={(v) => change(f.key, v)} />)}</div>
            </div>
          ))}
          <button type="button" className="text-[11px] text-gray-500 hover:underline" disabled={!!busy} onClick={() => void makeEditable()}>Refazer os campos com a IA</button>
          {busy && <p className="text-[11px] text-violet-700">{busy}</p>}
        </div>
      )}
    </section>
  )
}

const FieldInput: React.FC<{ field: SceneField; onChange: (v: SceneField['value']) => void }> = ({ field: f, onChange }) => {
  const id = `campo-${f.key}`
  if (f.type === 'liga') {
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
        {f.label}
        <Switch id={id} checked={f.value === true} onCheckedChange={(v) => onChange(v)} />
      </label>
    )
  }
  if (f.type === 'opcao' && f.options) {
    return (
      <div className="text-xs text-gray-700">
        <p className="mb-1">{f.label}</p>
        {f.options.length <= 4 ? (
          <div className="flex flex-wrap gap-1">
            {f.options.map((o) => (
              <button key={o} type="button" aria-pressed={f.value === o} onClick={() => onChange(o)} className={cn('h-7 rounded-full border px-2.5 text-[11px] font-medium', f.value === o ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>{o}</button>
            ))}
          </div>
        ) : (
          <select id={id} aria-label={f.label} className={inputClass} value={String(f.value)} onChange={(e) => onChange(e.target.value)}>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
      </div>
    )
  }
  if (f.type === 'cor') {
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
        {f.label}
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] uppercase text-gray-500">{String(f.value)}</span>
          <input id={id} type="color" value={String(f.value)} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-7 w-9 cursor-pointer rounded border border-gray-200 bg-white p-0.5" />
        </span>
      </label>
    )
  }
  if (f.type === 'numero') {
    return (
      <label htmlFor={id} className="block text-xs text-gray-700">
        <span className="flex justify-between"><span>{f.label}</span><span className="tabular-nums text-gray-500">{Number(f.value).toFixed((f.step ?? 1) < 1 ? 2 : 0)}</span></span>
        <input id={id} type="range" min={f.min} max={f.max} step={f.step} value={Number(f.value)} onChange={(e) => onChange(e.target.valueAsNumber)} className="w-full accent-gray-900" />
      </label>
    )
  }
  const long = String(f.value).length > 34
  return (
    <label htmlFor={id} className="block text-[11px] text-gray-500">
      {f.label}
      {long ? (
        <textarea id={id} rows={2} className="w-full rounded-md border border-gray-200 bg-white p-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={String(f.value)} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className={inputClass} value={String(f.value)} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

// Narração

const NarrationBlock: React.FC<{ set: CreativeSet; scene: CodeScene; data: SceneData; edit: Edit }> = ({ set, scene, data, edit }) => {
  const ai = useAiAvailable()
  const saved = useMemo(() => (data.parts ?? []).map((p) => ({ label: p.label, text: p.text })), [data.parts])
  const [draft, setDraft] = useState(saved)
  useEffect(() => setDraft(saved), [saved])
  const [voice, setVoice] = useState<VoiceAI>(data.voice ?? DEFAULT_VOICE)
  const [busy, setBusy] = useState<string | null>(null)
  const spokenChanged = draft.length !== saved.length || draft.some((p, i) => p.text.trim() !== saved[i]?.text.trim()) || JSON.stringify(voice) !== JSON.stringify(data.voice ?? DEFAULT_VOICE)
  const labelsChanged = draft.some((p, i) => p.label !== saved[i]?.label)
  const put = (i: number, patch: Partial<{ label: string; text: string }>) => setDraft((d) => d.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const apply = async () => {
    const parts = draft.map((p) => ({ label: p.label.trim(), text: p.text.trim() })).filter((p) => p.text)
    if (!spokenChanged) {
      edit((s) => ({ ...s, data: { ...sceneDataOf(s.data), parts: (sceneDataOf(s.data).parts ?? []).map((p, i) => ({ ...p, label: draft[i]?.label.trim() ?? p.label })) } }))
      return
    }
    if (!parts.length) return toast.error('Escreva a fala de pelo menos uma parte.')
    setBusy('A voz está narrando…')
    try {
      const n = await narrateParts(set, parts, voice, { onStep: setBusy })
      useEditor.getState().edit((cur) => ({
        ...cur,
        assets: cur.assets.some((a) => a.id === n.asset.id) ? cur.assets : [...cur.assets, { ...n.asset, kind: 'audio', duration: n.seconds }],
        scenes: (cur.scenes ?? []).map((s) => s.id !== scene.id ? s : {
          ...s,
          // A animação acompanha a voz: o fecho ganha 1,8 s depois da última palavra
          duration: Math.round((n.seconds + 1.8) * 10) / 10,
          audio: { src: `asset:${n.asset.id}`, name: n.name, volume: s.audio?.volume ?? 1, offset: 0, fadeIn: 0, fadeOut: 0.4 },
          data: { ...sceneDataOf(s.data), parts: n.parts, words: n.words, voice },
          updatedAt: Date.now(),
        }),
      }))
      toast.success('Narração refeita. As partes da animação seguem os tempos novos.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'A voz não respondeu.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="border-t border-gray-100 pt-4">
      <Label icon={<Mic className="h-3.5 w-3.5" />}>Narração</Label>
      {!draft.length && <p className="mb-2 text-xs leading-snug text-gray-500">Sem narração. Escreva as falas em partes (cada parte é um momento da animação) e a voz narra.</p>}
      <div className="space-y-2">
        {draft.map((p, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-white p-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold tabular-nums text-gray-400">{i + 1}</span>
              <input aria-label={`Rótulo da parte ${i + 1}`} className="h-7 min-w-0 flex-1 rounded border border-transparent px-1 text-xs font-semibold uppercase text-gray-900 hover:border-gray-200 focus-visible:border-gray-300 focus-visible:outline-none" value={p.label} placeholder="RÓTULO" onChange={(e) => put(i, { label: e.target.value })} />
              {data.parts?.[i] && <span className="text-[10px] tabular-nums text-gray-400">{data.parts[i].start.toFixed(1)}s</span>}
              <button type="button" aria-label={`Tirar a parte ${i + 1}`} className="text-gray-400 hover:text-red-600" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <textarea aria-label={`Fala da parte ${i + 1}`} rows={2} className="mt-1 w-full resize-y rounded border border-gray-100 p-1.5 text-xs leading-snug text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={p.text} onChange={(e) => put(i, { text: e.target.value })} />
          </div>
        ))}
      </div>
      <button type="button" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gray-600 hover:underline" onClick={() => setDraft((d) => [...d, { label: '', text: '' }])}><Plus className="h-3.5 w-3.5" /> Parte</button>
      <div className="mt-3"><VoicePicker value={voice} onChange={setVoice} brand={set.brand.name} /></div>
      <Button type="button" size="sm" className="mt-2 w-full gap-1.5" disabled={!!busy || (!spokenChanged && !labelsChanged) || (spokenChanged && !ai)} onClick={() => void apply()}>
        <Mic className="h-3.5 w-3.5" /> {spokenChanged ? (saved.length ? 'Refazer a narração' : 'Narrar') : 'Salvar os rótulos'}
      </Button>
      {busy && <p className="mt-1.5 text-[11px] text-violet-700">{busy}</p>}
      <p className="mt-1.5 text-[11px] leading-snug text-gray-500">Mudar a fala ou a voz narra de novo; a duração e a entrada de cada parte seguem a voz nova. Os títulos da tela ficam em Texto e efeitos.</p>
    </section>
  )
}

// Legenda

const CaptionsBlock: React.FC<{ data: SceneData; setData: (fn: (d: SceneData) => SceneData) => void; hasWords: boolean }> = ({ data, setData, hasWords }) => {
  const c: SceneCaptions = data.captions ?? { style: 'nenhuma' }
  const put = (patch: Partial<SceneCaptions>) => setData((d) => ({ ...d, captions: { ...(d.captions ?? { style: 'nenhuma' }), ...patch } }))
  return (
    <section className="border-t border-gray-100 pt-4">
      <Label icon={<Captions className="h-3.5 w-3.5" />}>Legenda</Label>
      {!hasWords ? (
        <p className="text-xs leading-snug text-gray-500">A legenda vem da narração: narre a animação para ligá-la.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {CAPTION_STYLES.map((s) => (
              <button key={s.id} type="button" aria-pressed={c.style === s.id} onClick={() => put({ style: s.id })} className={cn('h-7 rounded-full border px-2.5 text-[11px] font-medium', c.style === s.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>{s.label}</button>
            ))}
          </div>
          {c.style !== 'nenhuma' && (
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-gray-700">
                <span className="flex justify-between"><span>Altura</span><span className="tabular-nums text-gray-500">{Math.round((c.y ?? 0.78) * 100)}%</span></span>
                <input type="range" min={0.1} max={0.92} step={0.01} value={c.y ?? 0.78} onChange={(e) => put({ y: e.target.valueAsNumber })} className="w-full accent-gray-900" />
              </label>
              <label className="block text-xs text-gray-700">
                <span className="flex justify-between"><span>Tamanho</span><span className="tabular-nums text-gray-500">{Math.round((c.size ?? 1) * 100)}%</span></span>
                <input type="range" min={0.6} max={1.6} step={0.05} value={c.size ?? 1} onChange={(e) => put({ size: e.target.valueAsNumber })} className="w-full accent-gray-900" />
              </label>
              {c.style !== 'contorno' && (
                <label className="flex items-center justify-between gap-2 text-xs text-gray-700">
                  Cor do destaque
                  <span className="flex items-center gap-1.5">
                    {c.color && <button type="button" className="text-[11px] text-gray-500 hover:underline" onClick={() => put({ color: undefined })}>a da marca</button>}
                    <input type="color" aria-label="Cor do destaque da legenda" value={c.color ?? '#FFD400'} onChange={(e) => put({ color: e.target.value.toUpperCase() })} className="h-7 w-9 cursor-pointer rounded border border-gray-200 bg-white p-0.5" />
                  </span>
                </label>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
