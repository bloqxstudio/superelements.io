import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Blend, Grid3x3, Group, Layers as LayersIcon, Lock, Ungroup, Users, Sparkles, LayoutGrid, SquareDashed, SlidersHorizontal, ArrowDown, ArrowLeft, ArrowUp, Copy, Download, ImagePlus, Plus, Redo2, Square, Trash2, Type, Undo2 } from 'lucide-react'
import { LayersPanel } from './LayersPanel'
import { spreadSelected, unspreadSelected, alignLayers, currentLayers, distributeLayers, duplicateLayers, groupLayers, moveLayers, patchLayerFields, removeLayers, stackLayers, ungroupLayers, type AlignHow } from './layerOps'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { drawSlide, layerBox, slideToBlob, type ExportType } from './render'
import { Stage } from './Stage'
import { currentLayer, currentPost, currentSlide, reformat, useEditor } from './store'
import { uploadAsset } from './storage'
import { TEMPLATES, buildSlide } from './templates'
import type { TemplateId } from './plan'
import { FORMAT_LIST, sizeOf, uid, type CreativeSet, type FormatId, type ImageLayer, type Layer, type Post, type Slide, type TextLayer } from './types'
import { zipFiles } from './zip'
import { useAiAvailable } from './link'
import { AiDialog } from './AiDialog'
import { LIBRARY } from './library'
import { AiChat } from './AiChat'
import { Board } from './Board'
import { joinSetLive, useLive } from './live'
import { shareSet } from './storage'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { alpha } from './color'
import { gridOf, marginOf, type PostGrid } from './grid'
import { useRefs } from './refStore'
import { FormatField } from './FormatField'
import { generateLayerImage } from './generate'
import { useCreativeLink } from './link'

const FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Serif', 'Playfair Display', 'DM Sans', 'Manrope', 'Poppins', 'Montserrat', 'Space Grotesk', 'Fraunces', 'Archivo', 'Bebas Neue']

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'post'

// Edição

/** Aplica uma mudança no slide aberto. */
const editSlide = (fn: (slide: Slide, post: Post) => Slide) => {
  const { postId, slideId } = useEditor.getState()
  useEditor.getState().edit((s) => ({
    ...s,
    posts: s.posts.map((p) => (p.id !== postId ? p : { ...p, slides: p.slides.map((sl) => (sl.id === slideId ? fn(sl, p) : sl)) })),
  }))
}

const editLayer = (id: string, fields: Partial<Layer>) =>
  editSlide((sl) => ({ ...sl, layers: sl.layers.map((l) => (l.id === id ? ({ ...l, ...fields } as Layer) : l)) }))

const addLayer = (layer: Layer) => {
  editSlide((sl) => ({ ...sl, layers: [...sl.layers, layer] }))
  useEditor.getState().selectLayer(layer.id)
}

const editPost = (fn: (p: Post) => Post) => {
  const { postId } = useEditor.getState()
  useEditor.getState().edit((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? fn(p) : p)) }))
}

// Miniatura de um slide

const Thumb: React.FC<{ slide: Slide; format: FormatId; active: boolean; index: number; onClick: () => void }> = ({ slide, format, active, index, onClick }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const images = useEditor((s) => s.images)
  const { width, height } = sizeOf(format)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.scale(0.14, 0.14)
    drawSlide(ctx, slide, format, images)
    ctx.restore()
  }, [slide, format, images])
  return (
    <button type="button" onClick={onClick} aria-label={`Slide ${index + 1}`} className={cn('relative block w-full rounded-md p-1 text-left', active ? 'bg-violet-100 ring-2 ring-violet-500' : 'hover:bg-gray-100')}>
      <canvas ref={ref} width={Math.round(width * 0.14)} height={Math.round(height * 0.14)} className="block w-full rounded-sm bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.1)]" />
      <span className="absolute left-2 top-2 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">{index + 1}</span>
    </button>
  )
}

// Campos

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <label className={cn('block', className)}>
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
    {children}
  </label>
)

const inputClass = 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const Num: React.FC<{ label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number }> = ({ label, value, onChange, step = 1, min, max }) => (
  <Field label={label}>
    <input type="number" className={inputClass} value={Math.round(value * 100) / 100} step={step} min={min} max={max} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange(e.target.valueAsNumber)} />
  </Field>
)

const Colors: React.FC<{ set: CreativeSet; value: string; onChange: (hex: string) => void }> = ({ set, value, onChange }) => {
  const swatches = [...new Set([...set.brand.colors.map((c) => c.hex), '#ffffff', '#000000'])]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {swatches.map((hex) => (
        <button key={hex} type="button" title={hex} aria-label={`Cor ${hex}`} onClick={() => onChange(hex)} className={cn('h-6 w-6 rounded-md ring-1 ring-black/15', value.toLowerCase() === hex.toLowerCase() && 'ring-2 ring-violet-500')} style={{ background: hex }} />
      ))}
      <input type="color" aria-label="Outra cor" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-gray-200 bg-white p-0.5" />
    </div>
  )
}

// Painel da camada

const Inspector: React.FC<{ set: CreativeSet; layer: Layer }> = ({ set, layer }) => {
  const upload = useRef<HTMLInputElement>(null)
  const hasImages = !!useCreativeLink((l) => l.images)
  const fonts = [...new Set([set.brand.headingFont, set.brand.bodyFont, ...FONTS])]
  const set_ = (fields: Partial<Layer>) => editLayer(layer.id, fields)

  const sendImage = async (file?: File) => {
    if (!file) return
    try {
      const asset = await uploadAsset(set, file, file.name)
      useEditor.getState().edit((s) => ({ ...s, assets: [...s.assets, asset] }))
      set_({ src: `asset:${asset.id}` } as Partial<ImageLayer>)
      await useEditor.getState().ensureImage(`asset:${asset.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar a imagem.')
    } finally {
      if (upload.current) upload.current.value = ''
    }
  }

  const move = (dir: 1 | -1) =>
    editSlide((sl) => {
      const i = sl.layers.findIndex((l) => l.id === layer.id)
      const j = i + dir
      if (j < 0 || j >= sl.layers.length) return sl
      const layers = [...sl.layers]
      ;[layers[i], layers[j]] = [layers[j], layers[i]]
      return { ...sl, layers }
    })

  return (
    <div className="space-y-4">
      <Field label="Nome">
        <input className={inputClass} value={layer.name} onChange={(e) => set_({ name: e.target.value })} />
      </Field>

      {layer.type === 'text' && (
        <>
          <Field label="Texto">
            <textarea className={cn(inputClass, 'h-28 py-1.5 leading-snug')} value={layer.text} onChange={(e) => set_({ text: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fonte" className="col-span-2">
              <select className={inputClass} value={layer.font} onChange={(e) => { set_({ font: e.target.value }); void useEditor.getState().ensureAssets() }}>
                {[...new Set([layer.font, ...fonts])].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Num label="Tamanho" value={layer.size} min={8} onChange={(n) => set_({ size: n })} />
            <Field label="Peso">
              <select className={inputClass} value={layer.weight} onChange={(e) => set_({ weight: Number(e.target.value) })}>
                {[400, 500, 600, 700, 800].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </Field>
            <Num label="Entrelinha" value={layer.lineHeight} step={0.05} min={0.7} onChange={(n) => set_({ lineHeight: n })} />
            <Num label="Espaço (em)" value={layer.letterSpacing} step={0.01} onChange={(n) => set_({ letterSpacing: n })} />
          </div>
          <div className="flex items-center gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} type="button" onClick={() => set_({ align: a })} className={cn('h-8 flex-1 rounded-md border text-xs font-medium', layer.align === a ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 bg-white text-gray-600')}>
                {a === 'left' ? 'Esquerda' : a === 'center' ? 'Centro' : 'Direita'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!(layer as TextLayer).upper} onChange={(e) => set_({ upper: e.target.checked })} /> Tudo em maiúsculas
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={!!layer.emphasis} onChange={(e) => set_({ emphasis: e.target.checked, emphasisColor: layer.emphasisColor ?? set.brand.colors[0]?.hex })} />
            <span>Destaque em serifa<span className="block text-xs text-gray-500">Escreva *palavra* entre asteriscos.</span></span>
          </label>
          <Field label="Cor">
            <Colors set={set} value={layer.color} onChange={(color) => set_({ color })} />
          </Field>
          {layer.emphasis && (
            <Field label="Cor do destaque">
              <Colors set={set} value={layer.emphasisColor ?? layer.color} onChange={(emphasisColor) => set_({ emphasisColor })} />
            </Field>
          )}
        </>
      )}

      {layer.type === 'image' && (
        <>
          <Field label="Imagem">
            <div className="space-y-1.5">
              <select className={inputClass} value={layer.src} onChange={(e) => { set_({ src: e.target.value }); void useEditor.getState().ensureImage(e.target.value) }}>
                <option value="">Sem imagem</option>
                {set.assets.length > 0 && (
                  <optgroup label="Enviadas">
                    {set.assets.map((a) => (
                      <option key={a.id} value={`asset:${a.id}`}>{a.name}</option>
                    ))}
                  </optgroup>
                )}
                {(set.brand.logoOnLight || set.brand.logoOnDark) && (
                  <optgroup label="Logo">
                    {set.brand.logoOnLight && <option value={set.brand.logoOnLight}>Logo (fundo claro)</option>}
                    {set.brand.logoOnDark && <option value={set.brand.logoOnDark}>Logo (fundo escuro)</option>}
                  </optgroup>
                )}
                {[...new Set(LIBRARY.map((i) => i.group))].map((g) => (
                  <optgroup key={g} label={g}>
                    {LIBRARY.filter((i) => i.group === g).map((i) => (
                      <option key={i.id} value={i.src}>{i.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 bg-white" onClick={() => upload.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Enviar imagem
              </Button>
              <input ref={upload} type="file" accept="image/*" className="hidden" onChange={(e) => void sendImage(e.target.files?.[0])} />
            </div>
          </Field>
          <Field label="Imagem gerada por IA">
            <div className="space-y-1.5">
              <textarea className={cn(inputClass, 'h-20 py-1.5 text-xs leading-snug')} value={layer.prompt ?? ''} placeholder="Descreva a cena (em inglês rende melhor): uma mulher de 30 anos, luz de janela, foto editorial…" onChange={(e) => set_({ prompt: e.target.value } as Partial<ImageLayer>)} />
              <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 bg-white" disabled={!layer.prompt?.trim() || !hasImages} title={hasImages ? undefined : 'Ligue o Codex ou uma chave de imagens na aba IA (botão Imagens)'} onClick={() => void generateLayerImage(useEditor.getState().slideId!, layer.id, layer.prompt ?? '')}>
                <Sparkles className="h-4 w-4 text-violet-600" /> {layer.src ? 'Gerar de novo' : 'Gerar imagem'}
              </Button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Moldura">
              <select className={inputClass} value={layer.frame} onChange={(e) => set_({ frame: e.target.value as ImageLayer['frame'] })}>
                <option value="none">Nenhuma</option>
                <option value="browser">Navegador</option>
                <option value="phone">Celular</option>
              </select>
            </Field>
            <Field label="Ajuste">
              <select className={inputClass} value={layer.fit} onChange={(e) => set_({ fit: e.target.value as ImageLayer['fit'] })}>
                <option value="cover">Preencher</option>
                <option value="contain">Caber</option>
              </select>
            </Field>
            <Num label="Cantos" value={layer.radius} min={0} onChange={(n) => set_({ radius: n })} />
          </div>
          <Field label="Posição na moldura (topo → fim da página)">
            <input type="range" min={0} max={1} step={0.01} value={layer.focusY ?? 0} onChange={(e) => set_({ focusY: Number(e.target.value) })} className="w-full" />
          </Field>
        </>
      )}

      {layer.type === 'rect' && (
        <>
          <Field label={layer.fill2 ? 'Cor inicial' : 'Cor'}>
            <Colors set={set} value={layer.fill} onChange={(fill) => set_({ fill })} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!layer.fill2} onChange={(e) => set_(e.target.checked ? ({ fill2: alpha(layer.fill, 0), angle: layer.angle ?? 180 } as Partial<Layer>) : ({ fill2: undefined } as Partial<Layer>))} /> Degradê
          </label>
          {layer.fill2 && (
            <>
              <Field label="Cor final (a mesma cor com alfa 0 faz sumir)">
                <Colors set={set} value={layer.fill2} onChange={(fill2) => set_({ fill2 } as Partial<Layer>)} />
              </Field>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-8 flex-1 bg-white text-xs" onClick={() => set_({ fill2: alpha(layer.fill, 0) } as Partial<Layer>)}>Sumir</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 flex-1 bg-white text-xs" onClick={() => set_({ fill: layer.fill2!, fill2: layer.fill } as Partial<Layer>)}>Inverter</Button>
              </div>
              <Num label="Direção (180 desce, 90 direita)" value={layer.angle ?? 180} step={15} onChange={(n) => set_({ angle: n } as Partial<Layer>)} />
            </>
          )}
          <Num label="Cantos" value={layer.radius} min={0} onChange={(n) => set_({ radius: n })} />
        </>
      )}

      <Field label="Faixa contínua (passa de card em card)">
        {layer.span ? (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-600">Este componente é uma faixa: as cópias nos outros cards se movem e mudam juntas, e cada card mostra a fatia dele.</p>
            <Button type="button" variant="outline" size="sm" className="w-full bg-white" onClick={() => unspreadSelected(layer.span!.id)}>Soltar da faixa</Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Button type="button" variant="outline" size="sm" className="w-full bg-white" disabled={(set.posts.find((p) => p.id === useEditor.getState().postId)?.slides.length ?? 0) < 2} onClick={() => spreadSelected(layer.id)}>Passar por todos os cards</Button>
            <p className="text-xs text-gray-500">Põe uma cópia deslocada em cada card do post: arraste o componente para fora do card e o carrossel emenda no deslizar.</p>
          </div>
        )}
      </Field>
      <Field label="Alinhar no card (margens da grade)">
        <div className="flex gap-1">
          {([['left', AlignStartVertical, 'Margem esquerda'], ['center', AlignCenterVertical, 'Centralizar na horizontal'], ['right', AlignEndVertical, 'Margem direita'], ['top', AlignStartHorizontal, 'Margem de cima'], ['middle', AlignCenterHorizontal, 'Centralizar na vertical'], ['bottom', AlignEndHorizontal, 'Margem de baixo']] as const).map(([how, Icon, title]) => (
            <Button key={how} type="button" variant="outline" size="icon" className="h-8 flex-1 bg-white" title={title} aria-label={title} onClick={() => alignLayers([layer.id], how)}>
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Num label="X" value={layer.x} onChange={(n) => set_({ x: n })} />
        <Num label="Y" value={layer.y} onChange={(n) => set_({ y: n })} />
        <Num label="Largura" value={layer.w} min={1} onChange={(n) => set_({ w: n })} />
        {layer.type !== 'text' && <Num label="Altura" value={layer.h} min={1} onChange={(n) => set_({ h: n })} />}
        <Num label="Opacidade" value={layer.opacity ?? 1} step={0.05} min={0} max={1} onChange={(n) => set_({ opacity: n })} />
        <Num label="Giro (°)" value={layer.rotation ?? 0} onChange={(n) => set_({ rotation: n })} />
      </div>

      <div className="flex gap-1.5 border-t border-gray-100 pt-3">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 bg-white" title="Trazer para a frente" onClick={() => move(1)}><ArrowUp className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 bg-white" title="Enviar para trás" onClick={() => move(-1)}><ArrowDown className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 bg-white" title="Duplicar (Ctrl+D)" onClick={() => duplicateLayers([layer.id])}><Copy className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="ml-auto h-8 w-8 bg-white text-red-600" title="Excluir (Delete)" onClick={() => removeLayers([layer.id])}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}


// Exportação

async function exportFiles(scope: 'slide' | 'post' | 'set', type: ExportType) {
  const { set, postId, slideId, images } = useEditor.getState()
  if (!set) return
  const ext = type
  const base = slug(set.name)
  const jobs: { name: string; post: Post; slide: Slide }[] = []
  const posts = scope === 'set' ? set.posts : set.posts.filter((p) => p.id === postId)
  for (const post of posts)
    post.slides.forEach((slide, i) => {
      if (scope === 'slide' && slide.id !== slideId) return
      jobs.push({ name: scope === 'set' ? `${slug(post.name)}/${String(i + 1).padStart(2, '0')}.${ext}` : `${base}-${slug(post.name)}-${String(i + 1).padStart(2, '0')}.${ext}`, post, slide })
    })
  try {
    await useEditor.getState().ensureAssets()
    const files = await Promise.all(jobs.map(async (j) => ({ name: j.name, blob: await slideToBlob(j.slide, j.post.format, useEditor.getState().images ?? images, type) })))
    if (files.length === 1) download(files[0].blob, files[0].name)
    else download(await zipFiles(files), `${base}${scope === 'post' ? `-${slug(posts[0].name)}` : ''}.zip`)
    toast.success(files.length === 1 ? 'Imagem baixada.' : `${files.length} imagens em um ZIP.`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Não consegui exportar.')
  }
}

// Vários componentes escolhidos

const ALIGN: [AlignHow, React.ComponentType<{ className?: string }>, string][] = [
  ['left', AlignStartVertical, 'Alinhar à esquerda'],
  ['center', AlignCenterVertical, 'Centralizar na horizontal'],
  ['right', AlignEndVertical, 'Alinhar à direita'],
  ['top', AlignStartHorizontal, 'Alinhar em cima'],
  ['middle', AlignCenterHorizontal, 'Centralizar na vertical'],
  ['bottom', AlignEndHorizontal, 'Alinhar embaixo'],
]

const MultiInspector: React.FC<{ ids: string[] }> = ({ ids }) => {
  const layers = currentLayers().filter((l) => ids.includes(l.id))
  const grouped = layers.some((l) => l.group)
  const locked = layers.every((l) => l.locked)
  const hidden = layers.every((l) => l.hidden)
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-900">{ids.length} componentes escolhidos</p>
      <Field label="Alinhar entre si">
        <div className="flex gap-1">
          {ALIGN.map(([how, Icon, title]) => (
            <Button key={how} type="button" variant="outline" size="icon" className="h-8 flex-1 bg-white" title={title} aria-label={title} onClick={() => alignLayers(ids, how)}>
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </Field>
      <Field label="Distribuir por igual (3 ou mais)">
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8 flex-1 bg-white text-xs" disabled={ids.length < 3} onClick={() => distributeLayers(ids, 'x')}>Na horizontal</Button>
          <Button type="button" variant="outline" size="sm" className="h-8 flex-1 bg-white text-xs" disabled={ids.length < 3} onClick={() => distributeLayers(ids, 'y')}>Na vertical</Button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-1.5">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 bg-white" onClick={() => groupLayers(ids)}><Group className="h-4 w-4" /> Agrupar</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 bg-white" disabled={!grouped} onClick={() => ungroupLayers(ids)}><Ungroup className="h-4 w-4" /> Desagrupar</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 bg-white" onClick={() => stackLayers(ids, 'front')}><ArrowUp className="h-4 w-4" /> Para a frente</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 bg-white" onClick={() => stackLayers(ids, 'back')}><ArrowDown className="h-4 w-4" /> Para trás</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 bg-white" onClick={() => patchLayerFields(ids, { locked: !locked } as Partial<Layer>)}><Lock className="h-4 w-4" /> {locked ? 'Destravar' : 'Travar'}</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 bg-white" onClick={() => patchLayerFields(ids, { hidden: !hidden } as Partial<Layer>)}>{hidden ? 'Mostrar' : 'Esconder'}</Button>
      </div>
      <Field label="Opacidade de todos">
        <input type="range" min={0} max={1} step={0.05} defaultValue={1} onChange={(e) => patchLayerFields(ids, { opacity: Number(e.target.value) } as Partial<Layer>)} className="w-full" />
      </Field>
      <div className="flex gap-1.5 border-t border-gray-100 pt-3">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 bg-white" title="Duplicar (Ctrl+D)" onClick={() => duplicateLayers(ids)}><Copy className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="ml-auto h-8 w-8 bg-white text-red-600" title="Excluir (Delete)" onClick={() => removeLayers(ids)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <p className="text-xs text-gray-500">Shift ou ⌘ + clique soma; arraste o fundo do card para escolher por área; Alt + clique escolhe um só dentro de um grupo.</p>
    </div>
  )
}

// Tela

export const CreativeEditor: React.FC = () => {
  const { setId = '' } = useParams()
  const [query, setQuery] = useSearchParams()
  const projectParam = query.get('projeto') ?? undefined
  const onlyPost = query.get('post') ?? undefined
  const status = useEditor((s) => s.status)
  const set = useEditor((s) => s.set)
  const post = useEditor(currentPost)
  const slide = useEditor(currentSlide)
  const layer = useEditor(currentLayer)
  const saving = useEditor((s) => s.saving)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const [exportType, setExportType] = useState<ExportType>('png')
  const [menu, setMenu] = useState<'add' | 'export' | 'slide' | null>(null)
  const ai = useAiAvailable()
  const [aiOpen, setAiOpen] = useState(false)
  const [view, setView] = useState<'canvas' | 'slide'>('canvas')
  const [newPost, setNewPost] = useState<{ name: string; format: FormatId } | null>(null)
  const [sharing, setSharing] = useState<{ projectId: string; busy: boolean } | null>(null)
  const navigate = useNavigate()
  useProjectList()
  const projects = useProjectStore((s) => s.projects)
  const people = useLive((s) => s.people)
  const live = useLive((s) => s.live)
  const sharedId = set?.shared ? set.id : undefined
  const sharedProject = set?.projectId
  const [panel, setPanel] = useState<'ia' | 'props' | 'layers'>('ia')
  const [gridOpen, setGridOpen] = useState(false)
  const refFocus = useRefs((r) => r.focus)
  const layerIds = useEditor((s) => s.layerIds)
  useEffect(() => {
    if (refFocus) setPanel('ia')
  }, [refFocus])
  const grid = gridOf(post)
  const setGrid = (patch: Partial<PostGrid>) => editPost((p) => ({ ...p, grid: { ...gridOf(p), ...patch } }))
  const upload = useRef<HTMLInputElement>(null)
  const pasteImage = useRef<(file: File) => void>(() => undefined)

  useEffect(() => {
    if (status === 'ready' && onlyPost) useEditor.getState().selectPost(onlyPost)
  }, [status, onlyPost])

  useEffect(() => {
    void useEditor.getState().open(setId, projectParam)
    return () => useEditor.getState().close()
  }, [setId, projectParam])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      const st = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === "'" || e.code === 'Quote')) {
        e.preventDefault()
        const p = currentPost(st)
        if (p) editPost((x) => ({ ...x, grid: { ...gridOf(x), show: !gridOf(x).show } }))
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (e.shiftKey) ungroupLayers(st.layerIds)
        else groupLayers(st.layerIds)
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        st.selectLayers(currentLayers().filter((l) => !l.locked && !l.hidden).map((l) => l.id))
      } else if (mod && e.key.toLowerCase() === 'd' && st.layerIds.length) {
        e.preventDefault()
        duplicateLayers(st.layerIds)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.layerIds.length) {
        e.preventDefault()
        removeLayers(st.layerIds)
      } else if (e.key === 'Escape' && st.layerIds.length) {
        st.selectLayers([])
      } else if (st.layerIds.length && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const n = e.shiftKey ? 10 : 1
        moveLayers(st.layerIds, e.key === 'ArrowRight' ? n : e.key === 'ArrowLeft' ? -n : 0, e.key === 'ArrowDown' ? n : e.key === 'ArrowUp' ? -n : 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Conjunto compartilhado: entra no canal ao vivo do projeto (pessoas, cursores e mudanças chegando)
  useEffect(() => {
    if (status !== 'ready' || !sharedId) return
    const current = useEditor.getState().set
    return current ? joinSetLive(current) : undefined
  }, [status, sharedId, sharedProject])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      pasteImage.current(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => useEditor.getState().saving !== 'saved' && e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const format = post?.format ?? '4x5'
  const savingLabel = useMemo(() => ({ saved: 'Salvo', dirty: 'Alterações…', saving: 'Salvando…', error: 'Erro ao salvar' })[saving], [saving])

  if (status === 'loading') return <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500">Abrindo o conjunto…</div>
  if (status !== 'ready' || !set)
    return (
      <div className="mx-auto max-w-md py-20 text-center text-sm text-gray-600">
        <p>{status === 'missing' ? 'Este conjunto não está na sua conta.' : 'Não consegui abrir o conjunto.'}</p>
        <Link to="/criativos" className="mt-3 inline-block font-medium text-gray-900 underline">Voltar aos criativos</Link>
      </div>
    )

  const addSlide = (templateId: string) => {
    const count = post?.slides.length ?? 0
    const next = buildSlide(templateId as TemplateId, set.brand, format, { index: count, total: count + 1 })
    editPost((p) => ({ ...p, slides: [...p.slides, next] }))
    useEditor.getState().selectSlide(next.id)
    setMenu(null)
    void useEditor.getState().ensureAssets()
  }

  const addSlideTo = (postId: string, templateId: string) => {
    const target = set.posts.find((p) => p.id === postId)
    if (!target) return
    const next = buildSlide(templateId as TemplateId, set.brand, target.format, { index: target.slides.length, total: target.slides.length + 1 })
    useEditor.getState().edit((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, slides: [...p.slides, next] } : p)) }))
    useEditor.getState().selectPost(postId)
    useEditor.getState().selectSlide(next.id)
    void useEditor.getState().ensureAssets()
  }

  const duplicateSlide = (postId: string, slideId: string) => {
    const copy = set.posts.find((p) => p.id === postId)?.slides.find((s) => s.id === slideId)
    if (!copy) return
    const next: Slide = { ...copy, id: uid(), layers: copy.layers.map((l) => ({ ...l, id: uid() })) }
    useEditor.getState().edit((s) => ({ ...s, posts: s.posts.map((p) => (p.id !== postId ? p : { ...p, slides: p.slides.flatMap((x) => (x.id === slideId ? [x, next] : [x])) })) }))
    useEditor.getState().selectSlide(next.id)
  }

  const deleteSlide = (postId: string, slideId: string) => {
    const target = set.posts.find((p) => p.id === postId)
    if (!target || target.slides.length < 2) return toast.error('O post precisa de pelo menos um slide.')
    const index = target.slides.findIndex((s) => s.id === slideId)
    const nextId = (target.slides[index + 1] ?? target.slides[index - 1]).id
    useEditor.getState().edit((s) => ({ ...s, posts: s.posts.map((p) => (p.id !== postId ? p : { ...p, slides: p.slides.filter((x) => x.id !== slideId) })) }))
    useEditor.getState().selectSlide(nextId)
  }

  const share = async () => {
    if (!sharing || !set) return
    const project = projects.find((p) => p.id === sharing.projectId)
    if (!project) return
    setSharing({ ...sharing, busy: true })
    try {
      await useEditor.getState().flush()
      const moved = await shareSet(useEditor.getState().set!, project.id, project.name)
      toast.success(`Compartilhado com a equipe de ${project.name}.`)
      navigate(`/criativos/${moved.id}?projeto=${project.id}`, { replace: true })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Não consegui compartilhar o conjunto.')
      setSharing({ ...sharing, busy: false })
    }
  }

  const createPost = () => {
    if (!newPost) return
    const colors = set.brand.colors.map((c) => c.hex)
    const slideNew: Slide = { id: uid(), background: colors.find((c) => /^#(f|e)[0-9a-f]{5}$/i.test(c)) ?? '#ffffff', layers: [] }
    const created: Post = { id: uid(), name: newPost.name.trim() || `Post ${set.posts.length + 1}`, format: newPost.format, slides: [slideNew] }
    useEditor.getState().edit((s) => ({ ...s, posts: [...s.posts, created] }))
    useEditor.getState().selectPost(created.id)
    setNewPost(null)
  }

  const deletePost = () => {
    if (!post || set.posts.length < 2) return toast.error('O conjunto precisa de pelo menos um post.')
    if (!window.confirm(`Excluir o post "${post.name}" com ${post.slides.length} ${post.slides.length === 1 ? 'slide' : 'slides'}?`)) return
    const rest = set.posts.filter((p) => p.id !== post.id)
    useEditor.getState().edit((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== post.id) }))
    useEditor.getState().selectPost(rest[0].id)
  }

  const sendLayerImage = async (file?: File) => {
    if (!file) return
    try {
      const asset = await uploadAsset(set, file, file.name)
      useEditor.getState().edit((s) => ({ ...s, assets: [...s.assets, asset] }))
      const { width } = sizeOf(format)
      const w = Math.min(width - 168, 760)
      addLayer({ id: uid(), type: 'image', name: file.name, src: `asset:${asset.id}`, x: 84, y: 200, w, h: Math.round((w * asset.height) / asset.width), fit: 'cover', radius: 0, frame: 'none' })
      await useEditor.getState().ensureImage(`asset:${asset.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar a imagem.')
    } finally {
      if (upload.current) upload.current.value = ''
    }
  }

  pasteImage.current = (file) => void sendLayerImage(file.name === 'image.png' ? new File([file], 'imagem colada.png', { type: file.type }) : file)

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-[560px] flex-col md:h-screen" onClick={() => menu && setMenu(null)}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3">
        <Link to="/criativos" aria-label="Voltar aos criativos" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></Link>
        <input aria-label="Nome do conjunto" value={set.name} onChange={(e) => useEditor.getState().edit((s) => ({ ...s, name: e.target.value }))} className="h-8 w-56 rounded-md border border-transparent px-2 text-sm font-semibold text-gray-900 hover:border-gray-200 focus-visible:border-gray-300 focus-visible:outline-none" />
        <span className="text-xs text-gray-500">{savingLabel}</span>
        {set.source?.contentId && (
          <Link to={`/conteudos/${set.source.contentId}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100">
            <ArrowLeft className="h-3 w-3" aria-hidden /> Voltar ao conteúdo
          </Link>
        )}
        {set.shared ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700" title={live ? 'Ao vivo com a equipe do projeto' : 'Conectando ao canal ao vivo…'}>
              <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-500' : 'bg-amber-400')} /> {set.projectName ?? 'Equipe'}
            </span>
            <div className="flex -space-x-1.5">
              {people.map((p) => (
                <span key={p.userId} title={`${p.name} está neste conjunto`} className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white" style={{ background: p.color }}>
                  {p.name.charAt(0)}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white" onClick={() => setSharing(sharing ? null : { projectId: set.projectId ?? projects[0]?.id ?? '', busy: false })} disabled={!projects.length}>
              <Users className="h-4 w-4" /> Compartilhar
            </Button>
            {sharing && (
              <div className="absolute left-0 top-10 z-40 w-72 space-y-2 rounded-xl border bg-white p-3 shadow-xl">
                <p className="text-xs text-gray-600">A equipe do projeto abre e edita este conjunto junto, ao vivo: cada um vê o mouse, a seleção e o agente do outro. Quem ainda não está no projeto entra pelo convite dele.</p>
                <select value={sharing.projectId} onChange={(e) => setSharing({ ...sharing, projectId: e.target.value })} className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => setSharing(null)} disabled={sharing.busy}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={() => void share()} disabled={sharing.busy || !sharing.projectId}>{sharing.busy ? 'Compartilhando…' : 'Compartilhar'}</Button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={() => useEditor.getState().undo()}><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Refazer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => useEditor.getState().redo()}><Redo2 className="h-4 w-4" /></Button>
          <div className="mr-1 flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="Modo de edição">
            {([['canvas', 'Canvas', LayoutGrid], ['slide', 'Slide', SquareDashed]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setView(id)} className={cn('flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium', view === id ? 'bg-violet-100 text-violet-800' : 'text-gray-600 hover:bg-gray-100')}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 bg-white" onClick={() => setAiOpen(true)} disabled={ai === false} title={ai === false ? 'A IA roda no app local (servidor de desenvolvimento com o Claude Code).' : 'Gerar posts com IA'}>
            <Sparkles className="h-4 w-4 text-violet-600" /> IA
          </Button>
          <FormatField value={format} onChange={(f) => editPost((p) => reformat(p, f))} />
          <div className="relative">
            <Button size="sm" className="gap-1.5" onClick={() => setMenu(menu === 'export' ? null : 'export')}><Download className="h-4 w-4" /> Baixar</Button>
            {menu === 'export' && (
              <div className="absolute right-0 top-10 z-30 w-64 space-y-2 rounded-xl border bg-white p-3 shadow-xl">
                <div className="flex gap-1">
                  {(['png', 'jpg'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setExportType(t)} className={cn('h-8 flex-1 rounded-md border text-xs font-semibold uppercase', exportType === t ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-600')}>{t}</button>
                  ))}
                </div>
                <Button variant="outline" className="w-full justify-start bg-white" onClick={() => void exportFiles('slide', exportType)}>Este slide</Button>
                <Button variant="outline" className="w-full justify-start bg-white" onClick={() => void exportFiles('post', exportType)} disabled={(post?.slides.length ?? 0) < 2}>Post inteiro (ZIP · {post?.slides.length} slides)</Button>
                <Button variant="outline" className="w-full justify-start bg-white" onClick={() => void exportFiles('set', exportType)}>Conjunto todo (ZIP)</Button>
                <p className="text-[11px] leading-snug text-gray-500">{sizeOf(format).width}×{sizeOf(format).height}px, no tamanho do Instagram.</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <AiDialog open={aiOpen} onClose={() => setAiOpen(false)} />
      <div className="flex min-h-0 flex-1">
        <aside className={cn('w-56 shrink-0 flex-col border-r bg-white', view === 'slide' ? 'hidden md:flex' : 'hidden')} onClick={(e) => e.stopPropagation()}>
          <div className="border-b p-2">
            <select aria-label="Post" value={post?.id} onChange={(e) => useEditor.getState().selectPost(e.target.value)} className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm font-medium">
              {set.posts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {post?.slides.map((sl, i) => (
              <Thumb key={sl.id} slide={sl} format={format} index={i} active={sl.id === slide?.id} onClick={() => useEditor.getState().selectSlide(sl.id)} />
            ))}
          </div>
          <div className="relative border-t p-2">
            <Button variant="outline" size="sm" className="w-full gap-1.5 bg-white" onClick={() => setMenu(menu === 'slide' ? null : 'slide')}><Plus className="h-4 w-4" /> Novo slide</Button>
            {menu === 'slide' && (
              <div className="absolute bottom-12 left-2 z-30 w-72 rounded-xl border bg-white p-1.5 shadow-xl">
                {TEMPLATES.map((t) => (
                  <button key={t.id} type="button" onClick={() => addSlide(t.id)} className="block w-full rounded-lg px-2.5 py-2 text-left hover:bg-gray-50">
                    <span className="block text-sm font-medium text-gray-900">{t.name}</span>
                    <span className="block text-xs text-gray-500">{t.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative flex h-10 shrink-0 items-center gap-1.5 border-b bg-white px-3" onClick={(e) => e.stopPropagation()}>
            {post && <input aria-label="Nome do post" value={post.name} onChange={(e) => editPost((p) => ({ ...p, name: e.target.value }))} className="h-8 w-40 rounded-md border border-transparent px-2 text-sm font-medium text-gray-900 hover:border-gray-200 focus-visible:border-gray-300 focus-visible:outline-none" />}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white" onClick={() => setNewPost(newPost ? null : { name: '', format: '4x5' })}><Plus className="h-4 w-4" /> Novo post</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-600" title="Excluir este post" onClick={deletePost}><Trash2 className="h-4 w-4" /></Button>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            {newPost && (
              <div className="absolute left-3 top-11 z-40 w-72 space-y-2 rounded-xl border bg-white p-3 shadow-xl">
                <label className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Nome
                  <input autoFocus value={newPost.name} onChange={(e) => setNewPost({ ...newPost, name: e.target.value })} placeholder={`Post ${set.posts.length + 1}`} className="mt-1 h-8 w-full rounded-md border border-gray-200 px-2 text-sm normal-case text-gray-900" />
                </label>
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Formato
                  <div className="mt-1"><FormatField value={newPost.format} onChange={(f) => setNewPost({ ...newPost, format: f })} className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm normal-case text-gray-900" /></div>
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => setNewPost(null)}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={createPost}>Criar em branco</Button>
                </div>
              </div>
            )}
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => addLayer({ id: uid(), type: 'text', name: 'Texto', text: 'Novo texto', x: 84, y: 200, w: 600, h: 0, font: set.brand.bodyFont, weight: 500, size: 56, color: '#111111', align: 'left', lineHeight: 1.15, letterSpacing: 0 })}><Type className="h-4 w-4" /> Texto</Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => addLayer({ id: uid(), type: 'rect', name: 'Forma', x: 84, y: 200, w: 300, h: 300, fill: set.brand.colors[0]?.hex ?? '#2b3cf0', radius: 0 })}><Square className="h-4 w-4" /> Forma</Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => addLayer({ id: uid(), type: 'rect', name: 'Degradê', x: 0, y: Math.round(sizeOf(format).height * 0.5), w: sizeOf(format).width, h: Math.round(sizeOf(format).height * 0.5), fill: alpha(set.brand.colors[0]?.hex ?? '#111111', 0), fill2: alpha(set.brand.colors[0]?.hex ?? '#111111', 0.9), angle: 180, radius: 0 })}><Blend className="h-4 w-4" /> Degradê</Button>
            <div className="relative">
              <Button variant="ghost" size="sm" className={cn('h-8 gap-1.5', grid.show && 'bg-violet-50 text-violet-800')} onClick={() => setGridOpen((o) => !o)} title="Grade de boas práticas deste post (Ctrl+')"><Grid3x3 className="h-4 w-4" /> Grade</Button>
              {gridOpen && post && (
                <div className="absolute left-0 top-10 z-40 w-72 space-y-2 rounded-xl border bg-white p-3 text-sm shadow-xl">
                  <label className="flex items-center justify-between gap-2 font-medium text-gray-900">Mostrar as guias <input type="checkbox" checked={grid.show} onChange={(e) => setGrid({ show: e.target.checked })} /></label>
                  <p className="text-xs text-gray-500">Guias só deste post, para a edição: não saem na imagem. Margem de {marginOf(post.format)} px.</p>
                  <div className="space-y-1.5 border-t border-gray-100 pt-2 text-gray-700">
                    {([['margins', 'Margens de segurança'], ['thirds', 'Terços (regra dos terços)'], ['center', 'Centro'], ['safe', sizeOf(post.format).height / sizeOf(post.format).width > 1.6 ? 'Zonas do story (perfil e botões)' : 'Recorte do perfil do Instagram (3:4)']] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center justify-between gap-2">{label}<input type="checkbox" checked={grid[key]} onChange={(e) => setGrid({ [key]: e.target.checked, show: true })} /></label>
                    ))}
                    <label className="flex items-center justify-between gap-2">Colunas
                      <select value={grid.columns} onChange={(e) => setGrid({ columns: Number(e.target.value), show: true })} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-sm">
                        {[0, 2, 3, 4, 6, 12].map((n) => (<option key={n} value={n}>{n === 0 ? 'Sem colunas' : `${n} colunas`}</option>))}
                      </select>
                    </label>
                  </div>
                  <label className="flex items-start justify-between gap-2 border-t border-gray-100 pt-2 text-gray-700"><span>Ímã: encaixar nas guias e nos outros componentes ao arrastar<span className="block text-xs text-gray-500">Segure Alt para arrastar sem encaixar.</span></span><input type="checkbox" className="mt-1" checked={grid.snap} onChange={(e) => setGrid({ snap: e.target.checked })} /></label>
                </div>
              )}
            </div>

            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => upload.current?.click()}><ImagePlus className="h-4 w-4" /> Imagem</Button>
            <input ref={upload} type="file" accept="image/*" className="hidden" onChange={(e) => void sendLayerImage(e.target.files?.[0])} />
            <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
              Fundo
              {slide && <input type="color" aria-label="Cor do fundo" value={/^#[0-9a-f]{6}$/i.test(slide.background) ? slide.background : '#ffffff'} onChange={(e) => editSlide((sl) => ({ ...sl, background: e.target.value }))} className="h-6 w-8 cursor-pointer rounded border border-gray-200 bg-white p-0.5" />}
            </label>
          </div>
          {onlyPost && set?.posts.some((p) => p.id === onlyPost) && view === 'canvas' && (
            <div className="pointer-events-none absolute left-1/2 top-14 z-20 -translate-x-1/2">
              <button type="button" onClick={() => { const next = new URLSearchParams(query); next.delete('post'); setQuery(next, { replace: true }) }} className="pointer-events-auto rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white shadow-lg hover:bg-gray-700">Mostrando só este post · Ver todos</button>
            </div>
          )}
          {view === 'canvas' ? <Board onlyPostId={onlyPost && set?.posts.some((p) => p.id === onlyPost) ? onlyPost : undefined} onAddSlide={addSlideTo} onDownloadSlide={() => void exportFiles('slide', exportType)} onDuplicateSlide={duplicateSlide} onDeleteSlide={deleteSlide} /> : <Stage />}
        </main>

        <aside className="hidden w-80 shrink-0 flex-col border-l bg-white lg:flex" onClick={(e) => e.stopPropagation()}>
          <div className="flex h-10 shrink-0 border-b" role="tablist">
            {([['ia', 'IA', Sparkles], ['layers', 'Camadas', LayersIcon], ['props', 'Propriedades', SlidersHorizontal]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={panel === id} onClick={() => setPanel(id)} className={cn('flex flex-1 items-center justify-center gap-1.5 border-b-2 text-xs font-semibold', panel === id ? 'border-violet-600 text-violet-800' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {panel === 'ia' ? <div className="min-h-0 flex-1"><AiChat available={ai} /></div> : panel === 'layers' ? <div className="min-h-0 flex-1"><LayersPanel /></div> : <div className="min-h-0 flex-1 overflow-y-auto p-3" data-scroll>
          {layerIds.length > 1 ? (
            <MultiInspector ids={layerIds} />
          ) : layer ? (
            <Inspector key={layer.id} set={set} layer={layer} />
          ) : (
            <div className="space-y-3 text-sm text-gray-600">
              <p className="font-semibold text-gray-900">Marca · {set.brand.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {set.brand.colors.map((c) => (
                  <span key={c.hex} title={`${c.name} ${c.hex}`} className="h-6 w-6 rounded-md ring-1 ring-black/15" style={{ background: c.hex }} />
                ))}
              </div>
              <p className="text-xs">Títulos em <b>{set.brand.headingFont}</b>, texto em <b>{set.brand.bodyFont}</b>.</p>
              <Field label="Linguagem dos modelos">
                <select
                  className={cn(inputClass, 'h-8 text-xs')}
                  value={set.brand.look ?? 'classica'}
                  onChange={(e) => useEditor.getState().edit((s) => ({ ...s, brand: { ...s.brand, look: e.target.value === 'editorial' ? 'editorial' : undefined } }))}
                >
                  <option value="editorial">Editorial (direção criativa)</option>
                  <option value="classica">Clássica (anéis e pontos)</option>
                </select>
              </Field>
              <p className="text-[11px] leading-snug text-gray-500">Vale para os slides e posts que os modelos e a IA montarem daqui em diante; os que já existem ficam como estão.</p>
              <Field label="Legenda do post">
                <textarea
                  className={cn(inputClass, 'h-40 py-1.5 text-xs leading-snug')}
                  value={post?.caption ?? ''}
                  placeholder="A legenda para publicar junto com as imagens."
                  onChange={(e) => editPost((p) => ({ ...p, caption: e.target.value }))}
                />
              </Field>
              <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 bg-white" disabled={!post?.caption} onClick={() => void navigator.clipboard.writeText(post?.caption ?? '').then(() => toast.success('Legenda copiada.'))}>
                <Copy className="h-4 w-4" /> Copiar legenda
              </Button>
              <p className="text-xs text-gray-500">Clique numa camada para editar. Arraste para mover, puxe o canto para redimensionar. Setas movem 1px (Shift, 10px).</p>
            </div>
          )}
                  </div>}
        </aside>
      </div>
    </div>
  )
}
