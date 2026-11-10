import { iaFor } from '@/features/ia/porTarefa'
import { callAiQuiet } from './link'
import { SCENE_CONTRACT, SCENE_CONTRACT_3D } from './scene'
import { describeFields, parseFields, sceneDataOf, type SceneField } from './sceneEdit'
import { sizeOf, type CodeScene, type CreativeSet } from './types'
import { SCENE_SYSTEM_BASE, VIDEO_STYLES, wants3d, type StyleId } from './videoDirection'

/**
 * A IA desta máquina escreve (ou ajusta) a cena de motion em código. Recebe o
 * contrato da cena, a marca do conjunto, as imagens disponíveis pelo nome, as
 * batidas da trilha e, se houver, quadros de um vídeo de referência para seguir
 * o estilo (nunca a marca de outra empresa).
 */

/** O sistema: o papel e as regras de execução, o pacote de estilo (só quando escolhido) e o contrato técnico. */
const systemFor = (style: StyleId | undefined, with3d: boolean) =>
  [
    ...SCENE_SYSTEM_BASE,
    style && VIDEO_STYLES[style].rules ? `\nEstilo escolhido (${VIDEO_STYLES[style].label}): ${VIDEO_STYLES[style].rules}` : '',
    '',
    'Contrato da cena:',
    SCENE_CONTRACT,
    with3d ? `\nContrato 3D:\n${SCENE_CONTRACT_3D}` : '',
  ].filter((l, i) => l !== '' || i > 0).join('\n')

const STEP: Record<string, string> = { start: 'Começando…', thinking: 'Pensando no roteiro…', reading: 'Lendo o material…', writing: 'Escrevendo o código…' }

export interface SceneAiResult {
  code: string
  /** Os campos editáveis que a cena lê em env.data.params. */
  fields?: SceneField[]
  duration?: number
  reply?: string
}

export interface SceneAiOptions {
  adjust: boolean
  reference?: string[]
  /** O criativo de origem: a descrição das peças (env.post) e a imagem de cada slide. */
  post?: { description: string; images: string[] }
  /** O pacote de estilo (`VIDEO_STYLES`); sem ele, a cena não recebe estética pronta (um criativo elevado usa o comercial). */
  style?: StyleId
  signal?: AbortSignal
  onStep?: (step: string) => void
}

export async function writeSceneCode(set: CreativeSet, scene: CodeScene, request: string, opts: SceneAiOptions): Promise<SceneAiResult> {
  const { width, height } = sizeOf(scene.format)
  const brand = [`Nome: ${set.brand.name}`, `Cores (em ordem de importância): ${set.brand.colors.map((c) => `${c.name} ${c.hex}`).join(', ') || '(sem cores)'}`, `Fonte de títulos: ${set.brand.headingFont}`, `Fonte de texto: ${set.brand.bodyFont}`].join('\n')
  const style = opts.style ?? (opts.post ? 'comercial' : undefined)
  const direction = (sceneDataOf(scene.data) as { direction?: { summary?: string } }).direction
  const prompt = [
    `## O pedido (prompt avançado)\n${request.trim() || (opts.post ? 'Eleve o motion deste criativo ao nível de um comercial de agência, mantendo todo o conteúdo.' : 'Uma animação em código que sirva ao conteúdo e combine com a marca.')}`,
    opts.adjust && direction?.summary ? `## A direção deste vídeo (mantenha, a menos que o pedido mude)\n${direction.summary}` : '',
    opts.post ? `## O criativo (env.post)\nA cena é este criativo animado em nível avançado. As imagens anexadas ${opts.reference?.length ? 'primeiro' : ''} são os slides, em ordem. Use as peças pelo índice (env.post.slides[i].layers[j]) com lib.layer; para texto cinético, redesenhe com os dados da peça. Não invente texto, número ou foto que não esteja aqui.\n\n${opts.post.description}` : '',
    `## Formato\n${width} × ${height} px, ${scene.duration} s, 30 fps.`,
    `## Marca (env.brand)\n${brand}`,
    `## Imagens disponíveis (env.images)\n${[...(set.brand.logoOnLight || set.brand.logoOnDark ? ['- "logo" e "logo_escuro": o logo da marca (use-o, não escreva o nome)'] : []), ...scene.images.map((i) => `- "${i.name}"`)].join('\n') || 'Nenhuma: desenhe tudo em código.'}`,
    scene.beats?.length ? `## Trilha\n${Math.round(scene.bpm ?? 120)} BPM; batidas em ${scene.beats.slice(0, 40).map((b) => b.toFixed(2)).join(', ')}${scene.beats.length > 40 ? '…' : ''} (env.beats). Corte e bata nelas.` : `## Trilha\nSem trilha lida: use ${scene.bpm ?? 120} BPM (env.beat).`,
    opts.reference?.length ? `## Referência\n${opts.reference.length} quadros de um vídeo de referência vão anexados${opts.post ? ' depois dos slides' : ''}, em ordem (quadro 1, 2…). Siga a linguagem visual, o movimento e o tipo de cena, na marca acima.` : '',
    sceneDataOf(scene.data).parts?.length ? `## A narração (env.data.parts)\n${sceneDataOf(scene.data).parts!.map((p, i) => `${i + 1}. ${p.start.toFixed(1)}s–${p.end.toFixed(1)}s · "${p.label}" · ${p.text}`).join('\n')}` : '',
    opts.adjust && sceneDataOf(scene.data).fields?.length ? `## Os campos atuais (env.data.params; mantenha as chaves)\n${describeFields(sceneDataOf(scene.data).fields)}` : '',
    opts.adjust ? `## O código atual (ajuste-o; devolva o código inteiro e os campos)\n${scene.code}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const out = await callAiQuiet<{ reply: string; items: { ref: string; text: string }[] }>('agent', { ...iaFor('video'), system: systemFor(style, wants3d({ style, request, code: opts.adjust ? scene.code : '' })), prompt, images: [...(opts.post?.images ?? []), ...(opts.reference ?? [])].slice(0, 12) }, opts.signal, (step, detail) => opts.onStep?.(detail || STEP[step] || 'Trabalhando…'))
  let code = (out.items ?? []).find((i) => i?.ref === 'cena')?.text?.trim() ?? ''
  code = code.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim()
  if (!code.includes('scene(')) throw new Error('A IA não devolveu o código da cena. Tente de novo.')
  const dur = Number((out.items ?? []).find((i) => i?.ref === 'duracao')?.text)
  const fields = parseFields((out.items ?? []).find((i) => i?.ref === 'campos')?.text)
  return { code, fields, duration: Number.isFinite(dur) && dur > 1 && dur <= 90 ? dur : undefined, reply: out.reply?.trim() || undefined }
}

/** A referência quadro a quadro, para o modo agente ver o movimento (o vídeo em si não sai do navegador). */
export interface DenseReference {
  frames: string[]
  times: number[]
  /** Segundos em que a referência corta de cena. */
  cuts: number[]
  duration: number
}

/**
 * Quadros de um vídeo (ou imagem) de referência como data URLs (2026-11-10): o vídeo é lido a ~3 quadros por
 * segundo (até 100, 360 px), os cortes são achados pela diferença entre quadros seguidos, e saem dois conjuntos:
 * `dense` (todos, para o agente que compara movimento) e `frames`/`times` (até `count`, em volta dos cortes, para
 * a IA que monta o plano).
 */
export async function referenceShots(file: File, count = 12): Promise<{ frames: string[]; times: number[]; dense?: DenseReference }> {
  const toData = (src: CanvasImageSource, w: number, h: number, max: number) => {
    const k = Math.min(1, max / Math.max(w, h))
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(w * k), height: Math.round(h * k) })
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.72)
  }
  const url = URL.createObjectURL(file)
  try {
    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.src = url
      await img.decode()
      return { frames: [toData(img, img.naturalWidth, img.naturalHeight, 480)], times: [0] }
    }
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'auto'
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Não consegui abrir o vídeo de referência.'))
    })
    const seek = (t: number) => new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      video.currentTime = t
    })
    const dur = video.duration || 1
    const probe = Object.assign(document.createElement('canvas'), { width: 32, height: 32 })
    const pctx = probe.getContext('2d', { willReadFrequently: true })!
    const n = Math.min(100, Math.max(count, Math.round(dur * 3)))
    const sample: { t: number; d: number; url: string }[] = []
    let prev: Uint8ClampedArray | null = null
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * dur
      await seek(t)
      pctx.drawImage(video, 0, 0, 32, 32)
      const px = pctx.getImageData(0, 0, 32, 32).data
      let d = 0
      if (prev) for (let j = 0; j < px.length; j += 4) d += Math.abs(px[j] - prev[j]) + Math.abs(px[j + 1] - prev[j + 1]) + Math.abs(px[j + 2] - prev[j + 2])
      sample.push({ t: Math.round(t * 10) / 10, d: prev ? d / (32 * 32 * 3 * 255) : 0, url: toData(video, video.videoWidth, video.videoHeight, 360) })
      prev = px
    }
    const cuts = sample.filter((x) => x.d > 0.12).map((x) => x.t)
    // Para o plano: o primeiro quadro, os maiores cortes e quadros espaçados para completar
    const chosen = new Set<number>([0])
    const byCut = sample.map((x, i) => ({ i, d: x.d })).filter((x) => x.d > 0.12).sort((a, b) => b.d - a.d)
    const far = (i: number) => [...chosen].every((j) => Math.abs(j - i) > n / (count * 2.5))
    for (const { i } of byCut) if (chosen.size < Math.ceil(count * 0.6) && far(i)) chosen.add(i)
    for (let k = 0; chosen.size < Math.min(count, n) && k < n; k++) {
      const i = Math.round(((k % count) + 0.5) / count * (n - 1))
      if (far(i) || k >= count) chosen.add(i)
    }
    const pick = [...chosen].sort((a, b) => a - b).slice(0, count)
    return {
      frames: pick.map((i) => sample[i].url),
      times: pick.map((i) => sample[i].t),
      dense: { frames: sample.map((x) => x.url), times: sample.map((x) => x.t), cuts, duration: Math.round(dur * 10) / 10 },
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const referenceFrames = async (file: File, count = 12): Promise<string[]> => (await referenceShots(file, count)).frames
