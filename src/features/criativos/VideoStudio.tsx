import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clapperboard, Code2, Loader2, MessageSquareText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExplainerStudio } from './explicativo/ExplainerStudio'
import { coverJpeg } from './explicativo/media'
import { SceneRunner, sceneBitmaps } from './scene'
import { SceneStudio } from './SceneStudio'
import { saveVideoCover } from './storage'
import { useEditor } from './store'
import type { CodeScene, CreativeSet } from './types'
import { VideoCreator } from './VideoCreator'
import { IaSwitch } from '@/features/ia/IaSwitch'

/**
 * O estúdio único de vídeo (`/motion/:setId/video`, 2026-11-09; o usuário: "cena em código e vídeos explicativos
 * são coisas diferentes? Está estranho, podemos unificar? Deixar somente 1… deve ser a mesma ferramenta e a
 * melhor entrega possível"). Os dois tipos rodam no mesmo motor (`scene.ts`):
 *   - vídeo com roteiro e voz (o antigo vídeo explicativo): abre os painéis Roteiro, Estilo, Fala e Publicar;
 *   - animação em código (incluindo a criada a partir de uma referência): abre a animação, o pedido à IA e o
 *     código.
 * O "Novo vídeo" tem os três caminhos, e a referência é o primeiro: a IA escreve a narração, a voz da OpenAI
 * narra e a IA desenha a animação no motor na linguagem da referência (`videoFromReference.ts`).
 * A capa de cada vídeo sai da própria animação e vai para o índice (a tela /motion mostra).
 * `/motion/:setId/cena` e `/explica` continuam abrindo aqui.
 */

/** A capa: um quadro do vídeo, reduzido a 360 × 640 (como as capas dos posts). */
async function renderCover(scene: CodeScene, set: CreativeSet, images: Map<string, CanvasImageSource & { width: number; height: number }>): Promise<Blob> {
  let full: Blob
  if (scene.explainer) full = await coverJpeg(scene, set, images as never)
  else {
    const parts = (scene.data as { parts?: { start: number; end: number }[] } | undefined)?.parts
    // O meio da segunda parte (a animação já montada), ou pouco depois da metade
    const t = parts?.[1] ? Math.min(scene.duration - 0.2, (parts[1].start + parts[1].end) / 2) : scene.duration * 0.55
    const r = new SceneRunner({ code: scene.code, width: 1080, height: 1920, duration: scene.duration, images: await sceneBitmaps(scene, images, set.brand), beats: scene.beats, bpm: scene.bpm, brand: { name: set.brand.name, colors: set.brand.colors.map((c) => c.hex), font: set.brand.headingFont }, data: scene.data })
    try {
      await r.load()
      const bmp = await r.frame(t)
      const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height })
      c.getContext('2d')!.drawImage(bmp, 0, 0)
      bmp.close()
      full = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('capa'))), 'image/jpeg', 0.9))
    } finally {
      r.dispose()
    }
  }
  const bmp = await createImageBitmap(full)
  const c = Object.assign(document.createElement('canvas'), { width: 360, height: Math.round((360 * bmp.height) / bmp.width) })
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('capa'))), 'image/jpeg', 0.82))
}

/** Gera a capa do vídeo aberto quando ele muda e para de mudar (sem contar como edição do vídeo). */
function useAutoCover(set: CreativeSet | undefined, scene: CodeScene | undefined) {
  const images = useEditor((s) => s.images)
  const saving = useEditor((s) => s.saving)
  const busy = useRef(false)
  useEffect(() => {
    if (!set || !scene || busy.current || saving !== 'saved') return
    if (scene.cover && (scene.coverAt ?? 0) >= scene.updatedAt) return
    const timer = setTimeout(async () => {
      busy.current = true
      try {
        const blob = await renderCover(scene, set, images)
        const path = await saveVideoCover(set, scene.id, blob, scene.cover)
        // Grava só a capa: o updatedAt da cena fica como estava (não vira "editado")
        useEditor.getState().edit((cur) => ({ ...cur, scenes: (cur.scenes ?? []).map((s) => (s.id === scene.id ? { ...s, cover: path, coverAt: s.updatedAt } : s)) }))
      } catch {
        // sem capa desta vez: tenta de novo na próxima mudança
      } finally {
        busy.current = false
      }
    }, 6000)
    return () => clearTimeout(timer)
  }, [set?.id, scene?.id, scene?.updatedAt, scene?.cover, saving]) // eslint-disable-line react-hooks/exhaustive-deps
}

type Choice = 'referencia' | 'roteiro' | 'codigo'

const NewVideo: React.FC<{ onPick: (c: Choice) => void; onCancel?: () => void }> = ({ onPick, onCancel }) => {
  const options: { id: Choice; icon: React.ElementType; title: string; text: string; tag?: string }[] = [
    { id: 'referencia', icon: Sparkles, title: 'Criador com IA', text: 'A IA escolhe a referência, escreve a copy e monta o plano (logo, motion, legenda); você vê a prévia ao vivo e gera.', tag: 'Recomendado' },
    { id: 'roteiro', icon: MessageSquareText, title: 'Com roteiro e voz', text: 'Grave a fala ou dê o briefing: a IA escreve o roteiro e monta o vídeo com legenda, no estilo escolhido.' },
    { id: 'codigo', icon: Code2, title: 'Animação do zero', text: 'Descreva o comercial e a IA escreve a animação no motor; ajuste por pedido ou pelo código.' },
  ]
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-gray-900">Novo vídeo</h1>
      <p className="mt-1 text-sm text-gray-500">Tudo sai no mesmo motor: prévia, narração, capa e MP4.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => onPick(o.id)} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-gray-900">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><o.icon className="h-4 w-4 text-violet-700" /> {o.title}</span>
            {o.tag && <span className="mt-1 w-fit rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">{o.tag}</span>}
            <span className="mt-2 text-xs leading-relaxed text-gray-600">{o.text}</span>
          </button>
        ))}
      </div>
      {onCancel && <Button variant="ghost" className="mt-4" onClick={onCancel}>Voltar ao vídeo</Button>}
    </div>
  )
}

export const VideoStudio: React.FC = () => {
  const { setId = '' } = useParams()
  const [query, setQuery] = useSearchParams()
  const projectParam = query.get('projeto') ?? undefined
  const status = useEditor((s) => s.status)
  const set = useEditor((s) => s.set)
  const novo = query.get('novo')
  const scenes = set?.scenes ?? []
  const scene = scenes.find((s) => s.id === query.get('id')) ?? (novo ? undefined : scenes.at(-1))

  useEffect(() => {
    void useEditor.getState().open(setId, projectParam)
    return () => useEditor.getState().close()
  }, [setId, projectParam])

  useAutoCover(set, novo ? undefined : scene)

  const go = (patch: Record<string, string | null>) =>
    setQuery((q) => {
      const n = new URLSearchParams(q)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) n.delete(k)
        else n.set(k, v)
      }
      return n
    }, { replace: true })

  if (status === 'loading') return <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo os vídeos…</div>
  if (status !== 'ready' || !set)
    return (
      <div className="mx-auto max-w-md py-20 text-center text-sm text-gray-600">
        <p>{status === 'missing' ? 'Este conjunto não está na sua conta.' : 'Não consegui abrir o conjunto.'}</p>
        <Link to="/motion" className="mt-3 inline-block font-medium text-gray-900 underline">Voltar aos vídeos</Link>
      </div>
    )

  const header = (title: string) => (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3">
      <Link to="/motion" aria-label="Voltar aos vídeos" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></Link>
      <Clapperboard className="h-4 w-4 text-violet-700" />
      <span className="truncate text-sm font-semibold text-gray-900">{set.name}</span>
      <span className="text-sm text-gray-400">· {title}</span>
      <div className="ml-auto flex items-center gap-2"><span className="hidden text-xs text-gray-500 sm:inline">IA do vídeo</span><IaSwitch task="video" label="Vídeos" compact /></div>
    </header>
  )

  if (novo === 'referencia')
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col bg-gray-50 md:h-screen">
        {header('novo vídeo')}
        <VideoCreator set={set} refId={query.get('ref') ?? undefined} how={(query.get('modo') as 'igual' | 'novo' | null) ?? undefined} topic={query.get('tema') ?? undefined} onCreated={(id) => go({ id, novo: null, ref: null, modo: null, tema: null })} onCancel={() => go({ novo: scenes.length ? null : 'escolher', ref: null })} />
      </div>
    )
  if (novo === 'escolher' || (!scene && !novo))
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col bg-gray-50 md:h-screen">
        {header('novo vídeo')}
        <NewVideo onPick={(c) => go({ novo: c, id: null })} onCancel={scenes.length ? () => go({ novo: null }) : undefined} />
      </div>
    )
  if (novo === 'roteiro' || scene?.explainer) return <ExplainerStudio />
  return <SceneStudio />
}
