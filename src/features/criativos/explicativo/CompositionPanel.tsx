import React, { useRef, useState } from 'react'
import type { CodeScene } from '../types'
import { compositionPreset, fitBox, type Composition, type FrameBox, type Part } from './composition'
import { editExplainer } from './shared'

const names: Record<Part, string> = { animation: 'Animação', video: 'Vídeo', captions: 'Legenda' }
const parts: Part[] = ['animation', 'video', 'captions']

export function CompositionPanel({ scene, hasVideo }: { scene: CodeScene; hasVideo: boolean }) {
  const data = scene.explainer!
  const [selected, select] = useState<Part>('video')
  const [draft, setDraft] = useState<Composition | null>(null)
  const board = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; width: number; height: number; part: Part; resize: boolean; base: Composition; latest: Composition } | null>(null)
  const value = draft ?? data.composition ?? compositionPreset(data.layout, hasVideo)
  const save = (next: Composition) => editExplainer(scene.id, () => ({ composition: next }))
  const change = (part: Part, patch: Partial<FrameBox>) => save({ ...value, [part]: fitBox({ ...value[part], ...patch }) })
  const start = (e: React.PointerEvent, part: Part, resize = false) => {
    if (!data.composition || (part === 'video' && !hasVideo)) return
    e.preventDefault(); e.stopPropagation(); select(part)
    const rect = board.current!.getBoundingClientRect()
    gesture.current = { x: e.clientX, y: e.clientY, width: rect.width, height: rect.height, part, resize, base: value, latest: value }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dx = (e.clientX - g.x) / g.width * 100, dy = (e.clientY - g.y) / g.height * 100
    const b = g.base[g.part]
    const box = fitBox(g.resize ? { ...b, w: Math.min(100 - b.x, b.w + dx), h: Math.min(100 - b.y, b.h + dy) } : { ...b, x: b.x + dx, y: b.y + dy })
    g.latest = { ...g.base, [g.part]: box }; setDraft(g.latest)
  }
  const finish = () => {
    if (gesture.current) save(gesture.current.latest)
    gesture.current = null; setDraft(null)
  }
  const b = value[selected]
  return <section className="rounded-xl border border-violet-200 bg-violet-50/30 p-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Organizar componentes</h3>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!data.composition} onChange={e => editExplainer(scene.id, () => ({ composition: e.target.checked ? compositionPreset(data.layout, hasVideo) : undefined }))} /> Personalizar</label>
    </div>
    <p className="mt-1 text-xs text-gray-500">Arraste as caixas no mapa; use o canto para redimensionar. A prévia atualiza ao soltar. A composição personalizada usa as cenas editoriais do roteiro.</p>
    {!!data.composition && <>
      <div className="my-2 flex flex-wrap gap-1">
        {([['dividido', 'Vídeo embaixo'], ['rosto', 'Vídeo ao fundo'], ['janela', 'Vídeo no canto'], ['animacao', 'Só animação']] as const).map(([id, label]) => <button key={id} type="button" disabled={!hasVideo && id !== 'animacao'} className="rounded border bg-white px-2 py-1 text-xs disabled:opacity-40" onClick={() => save(compositionPreset(id, hasVideo))}>{label}</button>)}
      </div>
      <div ref={board} className="relative mx-auto my-3 w-40 touch-none overflow-hidden rounded border border-gray-300 bg-slate-900" style={{ aspectRatio: scene.format.replace('x', ' / ') }} aria-label="Mapa da composição">
        {parts.map(part => { const box = value[part]; if (!box.visible || (part === 'video' && !hasVideo)) return null
          return <div key={part} role="button" tabIndex={0} aria-label={`Selecionar ${names[part]}`} onClick={() => select(part)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(part) } }}
            onPointerDown={e => start(e, part)} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setDraft(null) }}
            className={`absolute flex cursor-move items-center justify-center border text-[10px] font-semibold ${part === 'video' ? 'bg-sky-400/70' : part === 'captions' ? 'bg-amber-300/90' : 'bg-violet-300/70'} ${selected === part ? 'border-white ring-2 ring-white' : 'border-black/30'}`}
            style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, zIndex: part === 'captions' ? 3 : part === 'video' ? (value.videoOnTop ? 2 : 0) : 1 }}>
            {names[part]}<span aria-label={`Redimensionar ${names[part]}`} onPointerDown={e => start(e, part, true)} className="absolute -bottom-0.5 -right-0.5 h-3 w-3 cursor-se-resize border border-slate-900 bg-white" />
          </div>
        })}
      </div>
      <div className="flex gap-1">{parts.map(part => <button type="button" key={part} disabled={part === 'video' && !hasVideo} onClick={() => select(part)} aria-pressed={selected === part} className={`rounded border px-2 py-1 text-xs disabled:opacity-40 ${selected === part ? 'bg-violet-700 text-white' : 'bg-white'}`}>{names[part]}</button>)}</div>
      <label className="my-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={b.visible} disabled={selected === 'video' && !hasVideo} onChange={e => change(selected, { visible: e.target.checked })} /> Mostrar {names[selected].toLowerCase()}</label>
      <div className="grid grid-cols-2 gap-2">{([['x', 'Horizontal'], ['y', 'Vertical'], ['w', 'Largura'], ['h', 'Altura']] as const).map(([key, label]) => <label key={key} className="text-xs">{label} (%)<input type="number" min={key === 'w' ? 8 : key === 'h' ? 4 : 0} max={100} step={1} value={Math.round(b[key] * 10) / 10} onChange={e => { if (e.target.value !== '') change(selected, { [key]: Number(e.target.value) }) }} className="mt-1 h-8 w-full rounded border bg-white px-2" /></label>)}</div>
      {selected === 'captions' && <label className="mt-3 block text-xs">Tamanho da legenda · {Math.round(value.captionScale * 100)}%<input className="mt-1 w-full" type="range" min={0.5} max={2} step={0.05} value={value.captionScale} onChange={e => save({ ...value, captionScale: Number(e.target.value) })} /><span className="text-gray-500">Ative um estilo em “Legenda animada” para exibi-la.</span></label>}
      {selected === 'video' && <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={value.videoOnTop} onChange={e => save({ ...value, videoOnTop: e.target.checked })} /> Vídeo na frente da animação</label>}
      <button type="button" className="mt-3 text-xs text-violet-700 underline" onClick={() => editExplainer(scene.id, () => ({ composition: undefined }))}>Restaurar composição do estilo</button>
    </>}
  </section>
}
