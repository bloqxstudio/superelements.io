import { resolveIa } from '@/features/ia/porTarefa'
import { callAiQuiet } from './link'
import { SCENE_CONTRACT } from './scene'
import { describeFields, parseFields, sceneDataOf, type SceneField } from './sceneEdit'
import { sizeOf, type CodeScene, type CreativeSet } from './types'

/**
 * A IA desta máquina escreve (ou ajusta) a cena de motion em código. Recebe o
 * contrato da cena, a marca do conjunto, as imagens disponíveis pelo nome, as
 * batidas da trilha e, se houver, quadros de um vídeo de referência para seguir
 * o estilo (nunca a marca de outra empresa).
 */

const SYSTEM = [
  'Você é um motion designer sênior de publicidade (After Effects) que escreve animações em código para canvas 2D. Entrega comerciais de Instagram no nível de agência: ritmo na batida, nada parado mais de 1 s, entradas com overshoot, rastro de velocidade nos movimentos rápidos, transições que empurram a cena, tipografia gigante, squash and stretch, impactos com tremida e clarão.',
  'Você escreve UMA cena: um código JavaScript que segue exatamente o contrato abaixo. Desenhe tudo com o ctx e a lib; quando houver imagens no material, use-as pelo nome em env.images e tenha um desenho de reserva quando faltarem. O código precisa rodar sem erro na primeira vez: declare tudo que usar, não use import, DOM, rede, setTimeout nem estado entre quadros.',
  'Use as cores e o nome da marca do material (env.brand); quando vierem quadros de um vídeo de referência, siga o estilo de movimento, o ritmo e a estrutura de cenas, mas nunca copie a marca, o logo ou os textos de outra empresa.',
  'Textos em português do Brasil, curtos e de anúncio. Nenhum preço, número ou promessa que não esteja no pedido; se o pedido não der preços, use preços de exemplo e diga isso no `reply`.',
  'A cena é editável sem a IA: tudo o que a pessoa pode querer trocar vira um campo, e o código lê o valor em env.data.params (sempre com reserva: `const P = env.data?.params || {}` e `P.titulo1 ?? "TEXTO"`). Exponha todo texto que aparece na tela, as cores principais (fundo, destaque) e de 2 a 4 escolhas de efeito que mudem de verdade o visual (tipo de transição, partículas ligadas, intensidade da câmera, velocidade das entradas). Não desenhe legenda da fala: o motor desenha a legenda por cima quando a pessoa liga.',
  'Responda pelo esquema: `reply` com 2 ou 3 frases dizendo o roteiro (as cenas e os tempos) e o que trocar; `items` com um item {"ref": "cena", "text": o código inteiro}, um item {"ref": "campos", "text": JSON da lista de campos} e, opcional, {"ref": "duracao", "text": segundos}.',
  'Cada campo: {"key": nome-de-variável (letras, números, _), "label": nome curto em português, "type": "texto" | "cor" | "numero" | "opcao" | "liga", "value": o valor padrão, "group": "Parte 1" | "Cores" | "Efeitos" | …} e, conforme o tipo, "options": [lista de textos] (opcao), "min", "max", "step" (numero). Cor em #RRGGBB. Até 30 campos. Ao ajustar uma cena que já tem campos, mantenha as chaves e os valores escolhidos pela pessoa, a menos que o pedido mude isso.',
  '',
  'Contrato da cena:',
  SCENE_CONTRACT,
].join('\n')

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
  signal?: AbortSignal
  onStep?: (step: string) => void
}

export async function writeSceneCode(set: CreativeSet, scene: CodeScene, request: string, opts: SceneAiOptions): Promise<SceneAiResult> {
  const { width, height } = sizeOf(scene.format)
  const brand = [`Nome: ${set.brand.name}`, `Cores (em ordem de importância): ${set.brand.colors.map((c) => `${c.name} ${c.hex}`).join(', ') || '(sem cores)'}`, `Fonte de títulos: ${set.brand.headingFont}`, `Fonte de texto: ${set.brand.bodyFont}`].join('\n')
  const prompt = [
    `## O pedido (prompt avançado)\n${request.trim() || (opts.post ? 'Eleve o motion deste criativo ao nível de um comercial de agência, mantendo todo o conteúdo.' : 'Um comercial no estilo publicitário de app de comida.')}`,
    opts.post ? `## O criativo (env.post)\nA cena é este criativo animado em nível avançado. As imagens anexadas ${opts.reference?.length ? 'primeiro' : ''} são os slides, em ordem. Use as peças pelo índice (env.post.slides[i].layers[j]) com lib.layer; para texto cinético, redesenhe com os dados da peça. Não invente texto, número ou foto que não esteja aqui.\n\n${opts.post.description}` : '',
    `## Formato\n${width} × ${height} px, ${scene.duration} s, 30 fps.`,
    `## Marca (env.brand)\n${brand}`,
    scene.images.length ? `## Imagens disponíveis (env.images)\n${scene.images.map((i) => `- "${i.name}"`).join('\n')}` : '## Imagens\nNenhuma: desenhe tudo em código.',
    scene.beats?.length ? `## Trilha\n${Math.round(scene.bpm ?? 120)} BPM; batidas em ${scene.beats.slice(0, 40).map((b) => b.toFixed(2)).join(', ')}${scene.beats.length > 40 ? '…' : ''} (env.beats). Corte e bata nelas.` : `## Trilha\nSem trilha lida: use ${scene.bpm ?? 120} BPM (env.beat).`,
    opts.reference?.length ? `## Referência\n${opts.reference.length} quadros de um vídeo de referência vão anexados${opts.post ? ' depois dos slides' : ''}, em ordem. Siga o estilo de movimento e o tipo de cena, na marca acima.` : '',
    sceneDataOf(scene.data).parts?.length ? `## A narração (env.data.parts)\n${sceneDataOf(scene.data).parts!.map((p, i) => `${i + 1}. ${p.start.toFixed(1)}s–${p.end.toFixed(1)}s · "${p.label}" · ${p.text}`).join('\n')}` : '',
    opts.adjust && sceneDataOf(scene.data).fields?.length ? `## Os campos atuais (env.data.params; mantenha as chaves)\n${describeFields(sceneDataOf(scene.data).fields)}` : '',
    opts.adjust ? `## O código atual (ajuste-o; devolva o código inteiro e os campos)\n${scene.code}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const out = await callAiQuiet<{ reply: string; items: { ref: string; text: string }[] }>('agent', { engine: resolveIa('criativos'), system: SYSTEM, prompt, images: [...(opts.post?.images ?? []), ...(opts.reference ?? [])].slice(0, 12) }, opts.signal, (step, detail) => opts.onStep?.(detail || STEP[step] || 'Trabalhando…'))
  let code = (out.items ?? []).find((i) => i?.ref === 'cena')?.text?.trim() ?? ''
  code = code.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim()
  if (!code.includes('scene(')) throw new Error('A IA não devolveu o código da cena. Tente de novo.')
  const dur = Number((out.items ?? []).find((i) => i?.ref === 'duracao')?.text)
  const fields = parseFields((out.items ?? []).find((i) => i?.ref === 'campos')?.text)
  return { code, fields, duration: Number.isFinite(dur) && dur > 1 && dur <= 90 ? dur : undefined, reply: out.reply?.trim() || undefined }
}

/** Quadros de um vídeo (ou imagens) de referência, reduzidos, como data URLs para a IA. */
export async function referenceFrames(file: File, count = 10): Promise<string[]> {
  const toData = (src: CanvasImageSource, w: number, h: number) => {
    const k = Math.min(1, 480 / Math.max(w, h))
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(w * k), height: Math.round(h * k) })
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.7)
  }
  const url = URL.createObjectURL(file)
  try {
    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.src = url
      await img.decode()
      return [toData(img, img.naturalWidth, img.naturalHeight)]
    }
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'auto'
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Não consegui abrir o vídeo de referência.'))
    })
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      const t = ((i + 0.5) / count) * video.duration
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve()
        video.currentTime = t
      })
      out.push(toData(video, video.videoWidth, video.videoHeight))
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
