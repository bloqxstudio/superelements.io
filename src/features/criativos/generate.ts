import { toast } from 'sonner'
import type { ChatAgentId } from '@/features/space/chat/protocol'
import { useAgent } from './agentStore'
import { requestImage } from './link'
import { uploadAsset } from './storage'
import { useEditor } from './store'
import type { ImageLayer, Layer } from './types'

/**
 * Gera as imagens das camadas que têm `prompt` e ainda não têm `src`: pede à
 * API de imagens que o conector tem neste computador, guarda o arquivo no
 * conjunto e troca o bloco "Gerando imagem…" pela imagem. Cada imagem pronta é
 * um passo do desfazer.
 */

const NO_TEXT = ' No text, no letters, no captions, no logos, no watermark. Photorealistic editorial quality unless the scene asks for another style.'

const ratioOf = (w: number, h: number) => (w / h > 1.2 ? 'landscape' : w / h < 0.83 ? 'portrait' : 'square')

const findLayer = (slideId: string, layerId: string): ImageLayer | undefined => {
  const set = useEditor.getState().set
  const layer = set?.posts.flatMap((p) => p.slides).find((s) => s.id === slideId)?.layers.find((l) => l.id === layerId)
  return layer?.type === 'image' ? layer : undefined
}

const patchLayer = (slideId: string, layerId: string, fields: Partial<ImageLayer>, extra?: (set: NonNullable<ReturnType<typeof useEditor.getState>['set']>) => Partial<NonNullable<ReturnType<typeof useEditor.getState>['set']>>) =>
  useEditor.getState().edit((s) => ({
    ...s,
    ...(extra?.(s) ?? {}),
    posts: s.posts.map((p) => ({ ...p, slides: p.slides.map((sl) => (sl.id !== slideId ? sl : { ...sl, layers: sl.layers.map((l) => (l.id === layerId ? ({ ...l, ...fields } as Layer) : l)) })) })),
  }))

/** Gera a imagem de uma camada e põe nela. Devolve se deu certo. */
export async function generateLayerImage(slideId: string, layerId: string, prompt: string, agent?: ChatAgentId, signal?: AbortSignal): Promise<boolean> {
  const layer = findLayer(slideId, layerId)
  if (!layer) return false
  if (agent) useAgent.getState().point({ slideId, layerId, agent, text: 'Gerando imagem' })
  try {
    const result = await requestImage(`${prompt.trim()}${NO_TEXT}`, ratioOf(layer.w, layer.h), signal)
    const blob = await (await fetch(result.data)).blob()
    const set = useEditor.getState().set!
    const asset = await uploadAsset(set, blob, 'imagem-gerada.png')
    patchLayer(slideId, layerId, { src: `asset:${asset.id}`, prompt, genFailed: false }, (s) => ({ assets: [...s.assets, asset] }))
    await useEditor.getState().ensureImage(`asset:${asset.id}`)
    return true
  } catch (err) {
    if ((err as Error).name === 'AbortError') return false
    patchLayer(slideId, layerId, { genFailed: true })
    toast.error(err instanceof Error ? err.message : 'Não consegui gerar a imagem.')
    return false
  }
}

/** Varias imagens, duas por vez (as APIs limitam o ritmo). */
export async function generateAll(list: { slideId: string; layerId: string; prompt: string }[], agent: ChatAgentId | undefined, signal: AbortSignal) {
  let done = 0
  const queue = [...list]
  const worker = async () => {
    for (let item = queue.shift(); item && !signal.aborted; item = queue.shift()) if (await generateLayerImage(item.slideId, item.layerId, item.prompt, agent, signal)) done++
  }
  await Promise.all([worker(), worker()])
  return done
}

/** Sem chave de imagens: os blocos "Gerando…" passam a dizer que a imagem não foi gerada, em vez de esperar para sempre. */
export function markNotGenerated(list: { slideId: string; layerId: string }[]) {
  const ids = new Set(list.map((l) => l.layerId))
  useEditor.getState().draft((s) => ({
    ...s,
    posts: s.posts.map((p) => ({ ...p, slides: p.slides.map((sl) => ({ ...sl, layers: sl.layers.map((l) => (l.type === 'image' && ids.has(l.id) ? { ...l, genFailed: true } : l)) })) })),
  }))
  useEditor.getState().persist()
}
