import { callAiQuiet, requestImage, useCreativeLink } from '@/features/criativos/link'
import { useCrm } from '@/features/crm/crmStore'
import { isStopped, runWork, workSignal } from '@/features/ia/work'
import { loadContext } from '@/features/conteudos/api'
import type { CreativeSet, Post } from '@/features/criativos/types'
import { agentName, chatAgent, creativeTarget, localAgents, type CreativeTarget } from './actions'
import { agentBegin, agentEnd, agentPhase } from './follow'
import { addCard } from './feed'
import { galleryFull, patchMessage, uid, useIara, type GalleryItem, type TeamPart } from './store'

/**
 * A Iara orquestrando uma equipe de agentes para um criativo (2026-11-05, o usuário: "um
 * orquestrador de agentes… abrir mais de um agente pra uma demanda… criar layout, buscar imagem,
 * criar algum 3D… e cada pedaço passa por uma aprovação, pra não ter erros de baixa qualidade,
 * erro de recorte mal feito"). Escolha dele: um revisor de IA confere cada parte e devolve para
 * refazer até passar (no máximo 2 vezes); a pessoa aprova só o resultado montado.
 *
 *   1. Roteiro (agente de copy): textos de cada slide, descrição das fotos e legenda.
 *   2. Em paralelo: Fotos (uma por slide que pede) e Objeto 3D (quando pedido), pelo serviço de
 *      imagens desta máquina; cada imagem passa pelo revisor (nitidez, recorte, mãos, texto
 *      embutido, marca de outra empresa).
 *   3. Layout (agente de criativos): monta o post na marca do conjunto, a partir de um post de
 *      exemplo (cópia fiel) ou do zero, com as imagens aprovadas; o revisor olha os slides
 *      (texto cortado, contraste, hierarquia, recorte) e pede correções.
 *   4. A pessoa aprova o post montado, pede ajuste ou descarta.
 *
 * O quadro da equipe é uma mensagem da conversa (`team`), atualizada a cada passo.
 */

const MAX_REDO = 2

export interface OrchestraArgs {
  conjunto?: string
  id?: string
  briefing: string
  /** Post do conjunto a usar como exemplo de layout (número). */
  exemplo?: number
  slides?: number
  formato?: string
  /** Partes pedidas: roteiro e layout sempre; fotos e 3D opcionais. */
  fotos?: boolean
  objeto3d?: string
  anexos?: string[]
}

type Verdict = { ok: boolean; doubt: boolean; problems: string; fix: string }

const parse = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

/** O revisor: um agente diferente de quem fez, olhando a imagem (ou o texto) com uma lista de critérios. */
async function review(kind: 'roteiro' | 'imagem' | 'objeto' | 'layout', maker: string, brief: string, payload: { text?: string; images?: string[] }): Promise<Verdict> {
  const agents = localAgents()
  const reviewer = agents.find((a) => a !== maker) ?? maker
  const criteria: Record<typeof kind, string> = {
    roteiro: 'Textos curtos que cabem num slide (título até ~8 palavras), português correto, específico da empresa, sem promessa falsa, número inventado ou clichê; um gancho forte na capa e uma chamada clara no fim.',
    imagem: 'Foto nítida e realista, sem deformação (mãos, rostos, objetos tortos), sem texto ou logo embutido, sem marca de outra empresa, iluminação e enquadramento profissionais, combina com o briefing.',
    objeto: 'Objeto 3D bem definido, com recorte limpo (borda sem halo, sem fundo sujo, sem pedaço cortado), fundo neutro ou transparente, luz e sombra coerentes, sem texto embutido.',
    layout: 'Nenhum texto cortado ou fora da área, contraste legível, hierarquia clara (título, apoio, chamada), alinhamento e margens consistentes, fotos bem recortadas e sem distorção, nada sobreposto por engano, marca do conjunto respeitada.',
  }
  const system = `Você é o revisor de qualidade de uma agência. Seja exigente: só aprove o que poderia ir ao ar hoje. Critérios: ${criteria[kind]}\nResponda em \`items\`: {"ref":"veredito","text":"aprovado"|"refazer"|"duvida"}, {"ref":"problemas","text":"o que está ruim, curto"} e {"ref":"correcao","text":"instrução objetiva para quem vai refazer"}. Use "duvida" quando não der para julgar pela imagem.`
  const out = await callAiQuiet<{ reply: string; items: { ref: string; text: string }[] }>('agent', {
    engine: reviewer,
    system,
    prompt: `## Briefing\n${brief}\n\n## O que revisar (${kind})\n${payload.text ?? 'Veja as imagens anexadas.'}`,
    images: payload.images?.slice(0, 10),
  })
  const get = (ref: string) => out.items?.find((i) => i.ref === ref)?.text?.trim() ?? ''
  const verdict = get('veredito').toLowerCase()
  return { ok: verdict.startsWith('aprov'), doubt: verdict.startsWith('duv'), problems: get('problemas'), fix: get('correcao') }
}

/**
 * A escolha da pessoa entre as tentativas de imagem (2026-11-05, o usuário: "ficou gerando 3
 * tentativas de imagens, poderia me mostrar e eu dizer o que gostei e o que não gostei"). O
 * revisor de IA ainda refaz o que reprovar, mas cada tentativa fica no quadro, e no fim de cada
 * foto a equipe espera: usar uma, pedir outra dizendo o que não gostou, ou seguir sem ela.
 */
export type ImageChoice = { kind: 'usar'; item: string } | { kind: 'outra'; feedback: string } | { kind: 'pular' }
const waiting = new Map<string, (choice: ImageChoice) => void>()
const waitKey = (msgId: string, key: string) => `${msgId}:${key}`
export const isWaitingChoice = (msgId: string, key: string) => waiting.has(waitKey(msgId, key))
export function answerChoice(msgId: string, key: string, choice: ImageChoice) {
  const resolve = waiting.get(waitKey(msgId, key))
  if (!resolve) return false
  waiting.delete(waitKey(msgId, key))
  resolve(choice)
  return true
}
const waitChoice = (msgId: string, key: string) =>
  new Promise<ImageChoice>((resolve, reject) => {
    waiting.set(waitKey(msgId, key), resolve)
    // Parar o trabalho também encerra a espera pela escolha
    const signal = workSignal()
    signal?.addEventListener('abort', () => {
      waiting.delete(waitKey(msgId, key))
      reject(new DOMException('Parou', 'AbortError'))
    }, { once: true })
  })

/** Miniatura JPEG da imagem (vai no quadro e fica guardada; a inteira fica na memória da aba). */
async function thumbOf(data: string, side = 360): Promise<string> {
  try {
    const img = new Image()
    img.src = data
    await img.decode()
    const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.78)
  } catch {
    return data
  }
}

const addGallery = (msgId: string, key: string, item: GalleryItem) =>
  patchMessage(msgId, (m) => (m.team ? { ...m, team: { ...m.team, parts: m.team.parts.map((p) => (p.key === key ? { ...p, preview: item.thumb, gallery: [...(p.gallery ?? []), item] } : p)) } } : m))
const markGallery = (msgId: string, key: string, ids: string[], patch: Partial<GalleryItem>) =>
  patchMessage(msgId, (m) => (m.team ? { ...m, team: { ...m.team, parts: m.team.parts.map((p) => (p.key === key ? { ...p, gallery: p.gallery?.map((g) => (ids.includes(g.id) ? { ...g, ...patch } : g)) } : p)) } } : m))

/** Atualiza uma parte no quadro da equipe. */
const setPart = (msgId: string, key: string, patch: Partial<TeamPart>) =>
  patchMessage(msgId, (m) => (m.team ? { ...m, team: { ...m.team, parts: m.team.parts.map((p) => (p.key === key ? { ...p, ...patch } : p)) } } : m))

interface Script {
  slides: { titulo: string; texto: string; foto?: string }[]
  legenda: string
}

/** Roda a equipe inteira. Devolve um resumo para a Iara e o post montado (ou nada, se falhou). */
export const runOrchestra = (args: OrchestraArgs) => runWork(`Equipe: ${args.briefing.slice(0, 60)}`, () => orchestra(args))

async function orchestra(args: OrchestraArgs): Promise<{ summary: string; post?: Post; target?: CreativeTarget }> {
  const brief = args.briefing.trim()
  const copyAgent = chatAgent()
  const designAgent = chatAgent()
  const canImage = useCreativeLink.getState().providers.length > 0 || !!useCreativeLink.getState().images
  const wantPhotos = args.fotos !== false && canImage
  const want3d = !!args.objeto3d && canImage

  const parts: TeamPart[] = [
    { key: 'roteiro', label: 'Roteiro e legenda', agent: copyAgent, status: 'fila', attempt: 0 },
    ...(wantPhotos ? [{ key: 'fotos', label: 'Fotos', agent: 'imagens', status: 'fila' as const, attempt: 0 }] : []),
    ...(want3d ? [{ key: '3d', label: `Objeto 3D: ${args.objeto3d}`, agent: 'imagens', status: 'fila' as const, attempt: 0 }] : []),
    { key: 'layout', label: 'Layout na marca', agent: designAgent, status: 'fila', attempt: 0 },
  ]
  // O quadro da equipe é um cartão no chat da Iara
  const id = addCard({ role: 'iara', text: '', team: { title: brief.slice(0, 120), parts, final: 'trabalhando' } })
  useIara.setState({ busy: true, liveId: id })

  const notes: string[] = []
  try {
    const ctx = await loadContext(useCrm.getState().team?.id ?? '').catch(() => null)
    const company = `${useCrm.getState().team?.name ?? ''}${ctx ? `\nOferta: ${ctx.offer.slice(0, 600)}\nPúblico: ${ctx.audience.slice(0, 400)}\nTom: ${ctx.tone.slice(0, 200)}\nRestrições: ${ctx.restrictions.slice(0, 300)}` : ''}`
    const fullBrief = `${brief}\n\n## Empresa\n${company}`

    // 1. Roteiro
    let script: Script | undefined
    let fix = ''
    for (let attempt = 1; attempt <= MAX_REDO + 1 && !script; attempt++) {
      setPart(id, 'roteiro', { status: attempt > 1 ? 'refazendo' : 'trabalhando', attempt })
      const out = await callAiQuiet<{ reply: string; items: { ref: string; text: string }[] }>('agent', {
        engine: copyAgent,
        system: `Você é o redator da equipe. Escreva o roteiro de um post de Instagram com ${args.slides ?? 'de 3 a 6'} slides. Responda em \`items\` com UM item {"ref":"roteiro","text":"<JSON>"} onde o JSON é {"slides":[{"titulo":string,"texto":string,"foto"?:string}],"legenda":string}. "foto" (opcional) é a descrição, em inglês, de uma foto realista para o slide, sem pessoas reconhecíveis nem texto.`,
        prompt: `## Briefing\n${fullBrief}${fix ? `\n\n## O revisor pediu\n${fix}` : ''}`,
      })
      const draft = parse<Script | undefined>(out.items?.find((i) => i.ref === 'roteiro')?.text ?? '', undefined)
      if (!draft?.slides?.length) {
        fix = 'Responda no formato pedido.'
        continue
      }
      setPart(id, 'roteiro', { status: 'revisao', note: `${draft.slides.length} slides` })
      const v = await review('roteiro', copyAgent, fullBrief, { text: JSON.stringify(draft, null, 1) })
      if (v.ok || v.doubt || attempt > MAX_REDO) {
        script = draft
        setPart(id, 'roteiro', { status: v.ok ? 'aprovado' : 'duvida', note: v.ok ? `${draft.slides.length} slides · aprovado pelo revisor` : `Passou com ressalva: ${v.problems}` })
        if (!v.ok) notes.push(`Roteiro: ${v.problems}`)
      } else {
        fix = v.fix || v.problems
        setPart(id, 'roteiro', { note: `Revisor: ${v.problems}` })
      }
    }
    if (!script) throw new Error('O roteiro não saiu.')

    // 2. Fotos e 3D, em paralelo, cada imagem revisada
    const makeImage = async (key: string, group: string, prompt: string, kind: 'imagem' | 'objeto', ratio: 'square' | 'portrait' | 'landscape') => {
      let ask = prompt
      let auto = MAX_REDO
      let attempt = 0
      const tries: { id: string; data: string; ok: boolean; problems: string }[] = []
      for (let round = 0; round < 12; round++) {
        attempt++
        setPart(id, key, { status: attempt > 1 ? 'refazendo' : 'trabalhando', attempt, waiting: undefined })
        const img = await requestImage(ask, ratio).catch(() => undefined)
        if (img?.data) {
          setPart(id, key, { status: 'revisao' })
          const v = await review(kind, 'imagens', fullBrief, { text: `Pedido da imagem: ${prompt}`, images: [img.data] })
          const item: GalleryItem = { id: uid(), thumb: await thumbOf(img.data), group, attempt, verdict: v.ok ? 'aprovado' : v.doubt ? 'duvida' : 'refazer', note: v.problems || undefined }
          galleryFull.set(item.id, img.data)
          addGallery(id, key, item)
          tries.push({ id: item.id, data: img.data, ok: v.ok, problems: v.problems })
          // O revisor reprovou: tenta de novo sozinho (até o limite), e a tentativa fica no quadro
          if (!v.ok && !v.doubt && auto-- > 0) {
            setPart(id, key, { note: `Revisor: ${v.problems}` })
            ask = `${prompt}. Fix: ${v.fix || v.problems}`
            continue
          }
        } else if (auto-- > 0) continue
        if (!tries.length) return undefined
        // A vez da pessoa: vê todas as tentativas desta foto e decide
        setPart(id, key, { status: 'escolha', waiting: group, note: `Escolha a ${group.toLowerCase()}, ou diga o que não gostou` })
        const choice = await waitChoice(id, key)
        if (choice.kind === 'pular') {
          markGallery(id, key, tries.map((t) => t.id), { pick: 'nao' })
          setPart(id, key, { waiting: undefined })
          return undefined
        }
        if (choice.kind === 'usar') {
          const chosen = tries.find((t) => t.id === choice.item) ?? tries.at(-1)!
          markGallery(id, key, [chosen.id], { pick: 'usar' })
          setPart(id, key, { waiting: undefined, preview: undefined })
          return { data: chosen.data, ok: true, problems: '' }
        }
        // Outra: o que a pessoa disse vai no pedido da próxima imagem
        markGallery(id, key, [tries.at(-1)!.id], { pick: 'nao', feedback: choice.feedback })
        ask = `${prompt}. The client reviewed the previous attempts and asked: ${choice.feedback}`
        auto = 0
      }
      return tries.at(-1) ? { data: tries.at(-1)!.data, ok: tries.at(-1)!.ok, problems: tries.at(-1)!.problems } : undefined
    }
    const photoPrompts = script.slides.map((sl) => sl.foto).filter((f): f is string => !!f).slice(0, 4)
    const [photos, object] = await Promise.all([
      wantPhotos && photoPrompts.length
        ? (async () => {
            const list: { name: string; data: string }[] = []
            for (const [i, p] of photoPrompts.entries()) {
              const got = await makeImage('fotos', `Foto ${i + 1}`, `${p}. Realistic editorial photograph, natural light, no text, no logos.`, 'imagem', 'portrait')
              if (got) list.push({ name: `foto-${i + 1}.jpg`, data: got.data })
            }
            setPart(id, 'fotos', { status: list.length ? 'aprovado' : 'falhou', note: list.length ? `${list.length} foto(s) escolhida(s)` : 'Nenhuma foto escolhida' })
            return list
          })()
        : Promise.resolve([] as { name: string; data: string }[]),
      want3d
        ? (async () => {
            const got = await makeImage('3d', 'Objeto 3D', `3D render of ${args.objeto3d}, isolated object, clean cutout, plain light background, soft studio lighting, high detail, no text.`, 'objeto', 'square')
            setPart(id, '3d', { status: got ? 'aprovado' : 'falhou', note: got ? 'Escolhido por você' : 'Não saiu' })
            return got ? { name: 'objeto-3d.png', data: got.data } : undefined
          })()
        : Promise.resolve(undefined),
    ])
    if (wantPhotos && !photoPrompts.length) setPart(id, 'fotos', { status: 'aprovado', note: 'O roteiro não pediu fotos' })

    // 3. Layout, revisado slide a slide
    setPart(id, 'layout', { status: 'trabalhando', attempt: 1 })
    const target = await creativeTarget({ conjunto: args.conjunto, id: args.id })
    const files = [...photos, ...(object ? [object] : [])]
    const textBlock = script.slides.map((sl, i) => `Slide ${i + 1}: título "${sl.titulo}"${sl.texto ? `; texto "${sl.texto}"` : ''}`).join('\n')
    const firstAsk = `${args.exemplo ? `Monte o post copiando fielmente o layout do post de exemplo e troque os textos por estes` : `Crie UM post novo (add_post), formato ${args.formato ?? '4x5'}, na marca deste conjunto, com estes textos`}:\n${textBlock}\nLegenda: ${script.legenda}\n${files.length ? `Use as imagens anexadas (${files.map((f) => f.name).join(', ')}) nos slides em que fazem sentido; o objeto 3D é o destaque visual.` : ''}`
    agentBegin(target.set.posts[(args.exemplo ?? 1) - 1] ?? target.set.posts[0], `${agentName(designAgent)}: layout`, designAgent as 'claude' | 'codex')
    agentPhase('thinking')
    let post = await target.compose(firstAsk, files, args.exemplo)
    for (let attempt = 1; attempt <= MAX_REDO + 1 && post; attempt++) {
      setPart(id, 'layout', { status: 'revisao', preview: (await target.previews(post, 360))[0] })
      const v = await review('layout', designAgent, fullBrief, { text: textBlock, images: await target.previews(post, 720) })
      if (v.ok || v.doubt || attempt > MAX_REDO) {
        setPart(id, 'layout', { status: v.ok ? 'aprovado' : 'duvida', note: v.ok ? 'Aprovado pelo revisor' : `Passou com ressalva: ${v.problems}` })
        if (!v.ok) notes.push(`Layout: ${v.problems}`)
        break
      }
      setPart(id, 'layout', { status: 'refazendo', attempt: attempt + 1, note: `Revisor: ${v.problems}` })
      agentPhase('applying')
      post = await target.fix(post, v.fix || v.problems)
    }
    agentEnd()
    if (!post) throw new Error('O layout não saiu.')

    const images = await target.previews(post, 360)
    patchMessage(id, (m) => ({ ...m, images: images.slice(0, 6), team: m.team ? { ...m.team, final: 'aguardando', setId: target.set.id, postId: post!.id, open: target.open } : m.team }))
    return { summary: `Post "${post.name}" montado e revisado (${post.slides.length} slides). ${notes.length ? `Ressalvas do revisor: ${notes.join(' · ')}` : 'Sem ressalvas.'} Esperando a aprovação da pessoa.`, post, target }
  } catch (e) {
    agentEnd()
    if (isStopped(e)) {
      patchMessage(id, (m) => ({ ...m, text: 'Você parou a equipe. O que já ficou pronto continua no conjunto.', team: m.team ? { ...m.team, final: 'falhou' } : m.team }))
      return { summary: 'A pessoa parou a equipe no meio. O que já ficou pronto continua no conjunto.' }
    }
    const msg = e instanceof Error ? e.message : String(e)
    patchMessage(id, (m) => ({ ...m, text: `A equipe parou: ${msg}`, error: true, team: m.team ? { ...m.team, final: 'falhou' } : m.team }))
    return { summary: `A equipe parou: ${msg}` }
  } finally {
    useIara.setState({ busy: false, liveId: undefined, step: undefined })
  }
}

export type { CreativeSet }
