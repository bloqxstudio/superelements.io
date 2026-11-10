import { callAiQuiet, useCreativeLink } from './link'
import { SCENE_CONTRACT, SCENE_CONTRACT_3D } from './scene'
import { parseFields, type SceneField } from './sceneEdit'
import { SCENE_WORKER_SOURCE } from './sceneWorker'
import { useEditor } from './store'
import { sizeOf, type CodeScene, type CreativeSet } from './types'
import { AGENT_FIELDS_NOTE, SCENE_AGENT_SYSTEM, VIDEO_STYLES, wants3d, type StyleId } from './videoDirection'
import type { DenseReference } from './sceneAi'

/**
 * O vídeo em modo agente, do lado da tela (2026-11-10; ver `scripts/criativos/videoAgent.ts`). Manda ao conector o
 * motor (o mesmo worker da prévia e do MP4), o contrato, o pedido, a lista de conferência, os logos e a referência
 * quadro a quadro; o Claude Code ou o Codex escreve, renderiza, compara lado a lado e corrige, e devolve o código e
 * os campos. Só quadros saem da aba, nunca o vídeo da referência.
 */

export const videoAgentReady = () => !!useCreativeLink.getState().videoAgent

const toDataUrl = async (src: string) => {
  const st = useEditor.getState()
  await st.ensureImage(src).catch(() => undefined)
  const img = useEditor.getState().images.get(src)
  if (!img || img instanceof HTMLVideoElement) return undefined
  const k = Math.min(1, 1200 / Math.max(img.width, img.height))
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) })
  c.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

export interface AgentReference {
  frames: string[]
  times?: number[]
  cuts?: number[]
  duration?: number
  map?: { start: number; end: number; refStart: number }[]
}

export const agentReference = (frames: string[], times: number[] | undefined, dense: DenseReference | undefined, map?: AgentReference['map']): AgentReference | undefined =>
  dense ? { frames: dense.frames, times: dense.times, cuts: dense.cuts, duration: dense.duration, map } : frames.length ? { frames, times, map: times ? map : undefined } : undefined

export async function videoByAgent(
  set: CreativeSet,
  base: CodeScene,
  o: { engine: 'claude' | 'codex'; model?: string; minutes?: number; style: StyleId; request: string; checklist: string[]; reference?: AgentReference; onStep?: (detail: string) => void; signal?: AbortSignal },
): Promise<{ code: string; fields?: SceneField[]; reply: string; rounds: number; minutes: number; partial?: boolean }> {
  const { width, height } = sizeOf(base.format)
  const images: Record<string, string> = {}
  for (const [name, src] of [['logo', set.brand.logoOnLight ?? set.brand.logoOnDark], ['logo_escuro', set.brand.logoOnDark ?? set.brand.logoOnLight]] as const) {
    const url = src ? await toDataUrl(src) : undefined
    if (url) images[name] = url
  }
  const style = VIDEO_STYLES[o.style]
  const system = [SCENE_AGENT_SYSTEM, style.rules ? `\nEstilo escolhido (${style.label}): ${style.rules}` : ''].join('')
  const contract = ['# Contrato do motor', SCENE_CONTRACT, wants3d({ style: o.style, request: o.request }) ? `\n## Contrato 3D\n${SCENE_CONTRACT_3D}` : '', '', AGENT_FIELDS_NOTE].join('\n')
  const out = await callAiQuiet<{ code: string; fields?: string; reply: string; rounds: number; minutes: number; partial?: boolean }>(
    'video-agent',
    {
      engine: o.engine,
      ...(o.model ? { model: o.model } : o.engine === 'claude' ? { model: 'opus' } : {}),
      minutes: o.minutes ?? 15,
      workerSource: SCENE_WORKER_SOURCE,
      system,
      contract,
      brief: o.request,
      checklist: o.checklist,
      scene: { width, height, duration: base.duration, data: base.data ?? {} },
      brand: { name: set.brand.name, colors: set.brand.colors.map((c) => c.hex), font: set.brand.headingFont },
      images,
      reference: o.reference,
    },
    o.signal,
    (_s, d) => d && o.onStep?.(d),
  )
  if (!out?.code?.includes('scene(')) throw new Error('O agente não devolveu a animação.')
  return { code: out.code, fields: parseFields(out.fields), reply: out.reply, rounds: out.rounds, minutes: out.minutes, partial: out.partial }
}
