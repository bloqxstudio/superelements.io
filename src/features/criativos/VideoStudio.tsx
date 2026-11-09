import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Clapperboard, Code2, Loader2, MessageSquareText, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { accountContext } from '@/features/cerebro/accountContext'
import { listReferences, referenceShotUrl, type Reference as SavedReference } from '@/features/referencias/api'
import { KIND_LABEL } from '@/features/referencias/rules'
import { cn } from '@/lib/utils'
import { ExplainerStudio } from './explicativo/ExplainerStudio'
import { ReferencePicker, type Reference as PickedReference } from './explicativo/Reference'
import { coverJpeg } from './explicativo/media'
import { SceneRunner, sceneBitmaps } from './scene'
import { SceneStudio } from './SceneStudio'
import { saveVideoCover } from './storage'
import { useEditor } from './store'
import type { CodeScene, CreativeSet } from './types'
import { createVideoFromReference } from './videoFromReference'

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

const dataUrlOf = async (url: string) => {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** A capa: um quadro do vídeo, reduzido a 360 × 640 (como as capas dos posts). */
async function renderCover(scene: CodeScene, set: CreativeSet, images: Map<string, CanvasImageSource & { width: number; height: number }>): Promise<Blob> {
  let full: Blob
  if (scene.explainer) full = await coverJpeg(scene, set, images as never)
  else {
    const parts = (scene.data as { parts?: { start: number; end: number }[] } | undefined)?.parts
    // O meio da segunda parte (a animação já montada), ou pouco depois da metade
    const t = parts?.[1] ? Math.min(scene.duration - 0.2, (parts[1].start + parts[1].end) / 2) : scene.duration * 0.55
    const r = new SceneRunner({ code: scene.code, width: 1080, height: 1920, duration: scene.duration, images: await sceneBitmaps(scene, images), beats: scene.beats, bpm: scene.bpm, brand: { name: set.brand.name, colors: set.brand.colors.map((c) => c.hex), font: set.brand.headingFont }, data: scene.data })
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
    { id: 'referencia', icon: Sparkles, title: 'A partir de uma referência', text: 'A IA recria a animação de um vídeo que você gostou, desenhada do zero na sua marca, com narração.', tag: 'Recomendado' },
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

/** Criar a partir de uma referência: as salvas em Referências (com capa e quadros) ou um vídeo/link na hora. */
const FromReference: React.FC<{ set: CreativeSet; refId?: string; how?: 'igual' | 'novo'; topic?: string; onCreated: (id: string) => void; onCancel: () => void }> = ({ set, refId, how: how0, topic: topic0, onCreated, onCancel }) => {
  const team = useCrm((s) => s.team)
  const [saved, setSaved] = useState<SavedReference[]>()
  const [chosen, setChosen] = useState<string | undefined>(refId)
  const [picked, setPicked] = useState<PickedReference | null>(null)
  const [how, setHow] = useState<'igual' | 'novo'>(how0 ?? 'igual')
  const [topic, setTopic] = useState(topic0 ?? '')
  const [steps, setSteps] = useState<{ label: string; detail?: string }[]>([])
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!team) return
    void listReferences(team.id).then((l) => setSaved(l.filter((r) => r.mediaPath)), () => setSaved([]))
  }, [team])

  const ref = saved?.find((r) => r.id === chosen)
  const ready = !!(ref || picked?.frames.length) && (how === 'igual' || topic.trim().length > 3)

  const run = async () => {
    if (!team || busy) return
    setBusy(true)
    setSteps([])
    const step = (label: string, detail?: string) => setSteps((s) => [...s.filter((x) => x.label !== label), { label, detail }])
    try {
      let frames: string[] = picked?.frames ?? []
      if (ref) {
        step('Referência', 'Lendo os quadros guardados no Cérebro…')
        frames = []
        for (const p of [ref.mediaPath, ...ref.frames].filter((x): x is string => !!x).slice(0, 8)) {
          try { frames.push(await dataUrlOf(await referenceShotUrl(team.id, p))) } catch { /* segue com os outros */ }
        }
        step('Referência', `${frames.length} quadros de "${ref.title || KIND_LABEL[ref.kind]}"`)
      }
      const brief = (await accountContext('9x16').catch(() => undefined))?.context
      const scene = await createVideoFromReference(set, { frames, how, topic, notes: ref?.notes || undefined, title: ref?.title || picked?.name }, { brief, onStep: step })
      toast.success('Vídeo criado', { description: scene.name })
      onCreated(scene.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui criar o vídeo.')
    } finally {
      setBusy(false)
    }
  }

  // Vindo de Referências › Recriar com tudo escolhido: começa sozinho
  useEffect(() => {
    if (started.current || !refId || !saved || !ref) return
    if (how === 'novo' && topic.trim().length <= 3) return
    started.current = true
    void run()
  }, [saved]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-gray-900">Vídeo a partir de uma referência</h1>
      <p className="mt-1 text-sm text-gray-500">A IA olha a referência, escreve a narração, a voz da OpenAI narra e a animação é desenhada do zero no motor, na linguagem da referência e na marca de {set.brand.name}. Nada de texto, logo ou personagem de quem fez.</p>

      {!busy && (
        <>
          <p className="mt-5 text-xs font-medium text-gray-700">Referência salva</p>
          {!saved ? <p className="mt-2 flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Abrindo as referências</p> : saved.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">Nenhuma referência com imagem ainda. Salve em <Link to="/referencias" className="underline">Referências</Link> ou mande o vídeo abaixo.</p>
          ) : (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {saved.slice(0, 40).map((r) => <SavedThumb key={r.id} r={r} teamId={team!.id} active={chosen === r.id} onPick={() => { setChosen(r.id); setPicked(null) }} />)}
            </div>
          )}
          <p className="mt-4 text-xs font-medium text-gray-700">Ou um vídeo, imagem ou link</p>
          <div className="mt-2"><ReferencePicker value={picked} onChange={(p) => { setPicked(p); if (p) setChosen(undefined) }} compact /></div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {([['igual', 'Recriar como está', 'A mesma estrutura, sequência e ideia, na sua marca'], ['novo', 'Com um conteúdo novo', 'O estilo da referência sobre outro assunto']] as const).map(([id, title, text]) => (
              <button key={id} type="button" onClick={() => setHow(id)} className={cn('rounded-lg border p-3 text-left text-sm', how === id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300')}>
                <b className="block">{title}</b><span className="text-xs text-gray-500">{text}</span>
              </button>
            ))}
          </div>
          {how === 'novo' && <textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Sobre o quê? Ex.: por que o site do escritório precisa mostrar as obras entregues." className="mt-3 w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-gray-400" />}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void run()} disabled={!ready} className="gap-1.5"><Sparkles className="h-4 w-4" /> Criar o vídeo</Button>
            <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </>
      )}

      {(busy || steps.length > 0) && (
        <ol className="mt-6 grid gap-2 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-2 text-sm">
              {busy && i === steps.length - 1 ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-violet-700" /> : <Check className="mt-0.5 h-4 w-4 text-emerald-600" />}
              <span><b className="text-gray-900">{s.label}</b>{s.detail ? <span className="text-gray-600"> · {s.detail}</span> : null}</span>
            </li>
          ))}
          {busy && <li className="text-xs text-gray-500">Leva de 2 a 5 minutos. Pode deixar a aba aberta.</li>}
        </ol>
      )}
    </div>
  )
}

const SavedThumb: React.FC<{ r: SavedReference; teamId: string; active: boolean; onPick: () => void }> = ({ r, teamId, active, onPick }) => {
  const [url, setUrl] = useState<string>()
  useEffect(() => { if (r.mediaPath) void referenceShotUrl(teamId, r.mediaPath).then(setUrl, () => undefined) }, [teamId, r.mediaPath])
  return (
    <button type="button" onClick={onPick} title={r.title} className={cn('w-24 shrink-0 overflow-hidden rounded-lg border-2 text-left', active ? 'border-violet-600' : 'border-transparent')}>
      <div className="aspect-[9/14] bg-gray-100">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>
      <p className="truncate px-1 py-0.5 text-[10px] text-gray-600">{r.title || KIND_LABEL[r.kind]}</p>
    </button>
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
    </header>
  )

  if (novo === 'referencia')
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col bg-gray-50 md:h-screen">
        {header('a partir de uma referência')}
        <FromReference set={set} refId={query.get('ref') ?? undefined} how={(query.get('modo') as 'igual' | 'novo' | null) ?? undefined} topic={query.get('tema') ?? undefined} onCreated={(id) => go({ id, novo: null, ref: null, modo: null, tema: null })} onCancel={() => go({ novo: scenes.length ? null : 'escolher', ref: null })} />
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
