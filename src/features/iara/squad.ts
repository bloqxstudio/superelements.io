import { callAiQuiet, imageProviderChoice, useCreativeLink } from '@/features/criativos/link'
import { useAgent } from '@/features/criativos/agentStore'
import { uploadAsset } from '@/features/criativos/storage'
import { FORM_ICONS, iconPng } from '@/features/criativos/icons'
import { sizeOf, uid as layerUid, type CreativeSet, type ImageLayer, type Layer, type Post } from '@/features/criativos/types'
import { isStopped, runWork, useWork, workSignal } from '@/features/ia/work'
import { useChat } from '@/features/space/chat/chatStore'
import { useProjectStore } from '@/features/projects/projectStore'
import { useProjectSync } from '@/features/projects/useProjectSession'
import { agentName, chatAgent, squadDesignEdit, squadFollow, squadPersist, squadPickPost, squadPreviews, squadTarget, type SquadTarget } from './actions'
import { addCard, sendWhenFree } from './feed'
import { liveSet } from './follow'
import { patchMessage, type LaneKind, type Squad, type SquadLane } from './store'

/**
 * A equipe rápida (2026-11-05, o usuário: "gosto de pequenas tarefas, um agente abre na tela e faz uma parte, um
 * seleciona um texto, um seleciona uma imagem, um coloca ícones… ver os 3 trabalhando ao mesmo tempo, talvez abrir 3
 * pequenos chats… entregas menores"; "mostrando mesmo na tela + de 1 agente"; "pode servir pra fazer um site, um
 * criativo, qualquer coisa no projeto").
 *
 * A Iara divide o pedido em 2 a 4 faixas pequenas, que rodam AO MESMO TEMPO:
 * - criativo: cada faixa é um trabalho da aba (textos, foto, ícones, layout ou livre). Cada uma entrega só a parte
 *   dela, e a entrega se junta ao post campo a campo (`mergeLayers`): a faixa de textos muda o `text`, a de layout
 *   muda `x`/`y`, e uma não desfaz a outra. Cada faixa tem cursor e cor próprios no canvas (`useAgent.crew`).
 * - site (projeto do Space): cada faixa é uma conversa `<projeto>#faixa-N` do chat, com a sua sessão da ponte, então
 *   o canvas mostra um cursor por faixa; o agente da faixa faz só a parte dele (`chatPlugin.ts`).
 * O cartão mostra um minichat por faixa (o pedido, os passos, a resposta), com campo para pedir mais só àquela faixa.
 * Pausar e parar valem para todas (`ia/work.ts`).
 */

export interface SquadTask {
  papel: LaneKind
  pedido: string
  slide?: number
}

export interface SquadArgs {
  conjunto?: string
  id?: string
  post?: number
  projeto?: string
  tarefas: SquadTask[]
}

export const LANE_COLOR: Record<LaneKind, string> = { texto: '#7C3AED', imagem: '#D97706', icones: '#0284C7', layout: '#059669', livre: '#DB2777' }
export const LANE_LABEL: Record<LaneKind, string> = { texto: 'Textos', imagem: 'Foto', icones: 'Ícones', layout: 'Layout', livre: 'Tarefa' }
const KINDS = Object.keys(LANE_LABEL) as LaneKind[]
const MAX_LANES = 4

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// ---------- o cartão ----------

const patchSquad = (msgId: string, fn: (s: Squad) => Squad) => patchMessage(msgId, (m) => (m.squad ? { ...m, squad: fn(m.squad) } : m))
const patchLane = (msgId: string, laneId: string, fn: (l: SquadLane) => SquadLane) => patchSquad(msgId, (s) => ({ ...s, lanes: s.lanes.map((l) => (l.id === laneId ? fn(l) : l)) }))
const step = (msgId: string, laneId: string, text: string) => patchLane(msgId, laneId, (l) => ({ ...l, steps: [...l.steps, text].slice(-6) }))

// ---------- juntar as entregas ----------

/** Campos que cada faixa nunca muda (os de outra faixa). */
const SKIP: Record<LaneKind, string[]> = {
  texto: ['src', 'prompt', 'x', 'y', 'w', 'h', 'rotation'],
  imagem: [],
  icones: [],
  layout: ['text', 'src', 'prompt'],
  livre: [],
}
const ALLOW: Record<LaneKind, (l: Layer) => boolean> = {
  texto: (l) => l.type === 'text',
  imagem: (l) => l.type === 'image',
  icones: (l) => l.type === 'image',
  layout: () => true,
  livre: () => true,
}

/**
 * Leva ao conjunto de agora (com o que as outras faixas já entregaram) só o que esta faixa mudou no post, campo a campo.
 * `base` e `after` são o post antes e depois desta faixa.
 */
export function mergeLayers(current: CreativeSet, postId: string, base: Post, after: Post, kind: LaneKind): { set: CreativeSet; slides: string[]; layers: string[] } {
  const allow = ALLOW[kind]
  const skip = new Set(['id', ...SKIP[kind]])
  const slides: string[] = []
  const layers: string[] = []
  const posts = current.posts.map((p) => {
    if (p.id !== postId) return p
    return {
      ...p,
      slides: p.slides.map((cur) => {
        const b = base.slides.find((x) => x.id === cur.id)
        const a = after.slides.find((x) => x.id === cur.id)
        if (!b || !a) return cur
        let list = cur.layers
        let touched = false
        for (const l of a.layers) {
          const old = b.layers.find((x) => x.id === l.id)
          if (!old) {
            if (allow(l) && !list.some((x) => x.id === l.id)) {
              list = [...list, l]
              touched = true
              layers.push(l.id)
            }
            continue
          }
          if (!allow(old)) continue
          const patch: Record<string, unknown> = {}
          for (const k of new Set([...Object.keys(l), ...Object.keys(old)])) {
            if (skip.has(k)) continue
            const nv = (l as unknown as Record<string, unknown>)[k]
            const ov = (old as unknown as Record<string, unknown>)[k]
            if (JSON.stringify(nv) !== JSON.stringify(ov)) patch[k] = nv
          }
          if (Object.keys(patch).length) {
            list = list.map((x) => (x.id === l.id ? ({ ...x, ...patch } as Layer) : x))
            touched = true
            layers.push(l.id)
          }
        }
        for (const old of b.layers)
          if (allow(old) && !a.layers.some((x) => x.id === old.id) && kind !== 'texto') {
            list = list.filter((x) => x.id !== old.id)
            touched = true
          }
        // Fundo do slide: só layout e livre
        let background = cur.background
        if ((kind === 'layout' || kind === 'livre') && JSON.stringify(a.background) !== JSON.stringify(b.background)) {
          background = a.background
          touched = true
        }
        if (!touched) return cur
        slides.push(cur.id)
        return { ...cur, layers: list, background }
      }),
    }
  })
  return { set: { ...current, posts, updatedAt: Date.now() }, slides, layers }
}

// ---------- faixas de criativo ----------

interface Ctx {
  msgId: string
  t: SquadTarget
  postId: string
  /** Entregas uma de cada vez (ler o conjunto de agora, juntar, gravar), mesmo com as faixas terminando juntas. */
  commit: (fn: (cur: CreativeSet) => { set: CreativeSet; slides: string[] }) => Promise<string[]>
}

const currentPost = (ctx: Ctx) => liveSet(ctx.t.set).posts.find((p) => p.id === ctx.postId)

function crew(ctx: Ctx, lane: SquadLane, slideId: string | undefined, layerIds: string[], text: string, working = true) {
  useAgent.getState().crewSet({ id: `${ctx.msgId}:${lane.id}`, label: `${lane.label} · ${agentName(lane.agent)}`, color: lane.color, slideId, layerIds, text, working })
}

async function runCreativeLane(ctx: Ctx, lane: SquadLane, ask: string, slideN?: number): Promise<string> {
  const post = currentPost(ctx)
  if (!post) throw new Error('O post sumiu do conjunto.')
  const slide = slideN && slideN >= 1 ? post.slides[slideN - 1] : undefined
  const agent = chatAgent()
  const kind = lane.kind
  const others = KINDS.filter((k) => k !== kind).map((k) => LANE_LABEL[k].toLowerCase()).join(', ')

  if (kind === 'imagem') return imageLane(ctx, lane, post, slide, ask)
  if (kind === 'icones') return iconLane(ctx, lane, post, slide ?? post.slides[0], ask)

  const scopeLayers = (slide ? [slide] : post.slides).flatMap((s) => s.layers.filter(ALLOW[kind]).map((l) => l.id))
  crew(ctx, lane, (slide ?? post.slides[0])?.id, kind === 'texto' ? scopeLayers.slice(0, 6) : [], 'Pensando')
  const rule =
    kind === 'texto'
      ? 'Sua parte é SÓ os textos: reescreva e ajuste o estilo das camadas de texto existentes. Não mova nem redimensione nada, não crie nem apague camadas de outro tipo.'
      : kind === 'layout'
        ? 'Sua parte é SÓ o layout: posição, tamanho, alinhamento, cores das formas e do fundo, hierarquia. Não reescreva textos e não troque fotos.'
        : 'Faça só esta parte, pequena.'
  const message = `Você é uma faixa de uma equipe: outros agentes cuidam de ${others} AO MESMO TEMPO neste post. ${rule}\nPedido: ${ask}`
  step(ctx.msgId, lane.id, `${agentName(agent)} pensando`)
  const { next, answer } = await squadDesignEdit(liveSet(ctx.t.set), post, message, { agent, slide, scope: slide ? 'slide' : 'post' })
  const after = next.posts.find((p) => p.id === post.id)
  if (!after) throw new Error('O designer não devolveu o post.')
  // Assets novos (fotos que o designer gerou) vão junto
  const newAssets = next.assets.filter((a) => !ctx.t.set.assets.some((b) => b.id === a.id))
  step(ctx.msgId, lane.id, 'Juntando ao post')
  const changed = await ctx.commit((cur) => {
    const merged = mergeLayers({ ...cur, assets: [...cur.assets, ...newAssets.filter((a) => !cur.assets.some((b) => b.id === a.id))] }, post.id, post, after, kind)
    crew(ctx, lane, merged.slides[0] ?? slide?.id ?? post.slides[0]?.id, merged.layers.slice(0, 8), 'Entregue', false)
    return merged
  })
  return changed.length ? answer.reply || 'Pronto.' : `${answer.reply || ''} (nada mudou na minha parte)`.trim()
}

/** Foto: trata a que existe (recorte, cor, luz…) ou gera uma nova para a camada de imagem. */
async function imageLane(ctx: Ctx, lane: SquadLane, post: Post, slide: Post['slides'][number] | undefined, ask: string): Promise<string> {
  const slides = slide ? [slide] : post.slides
  const photos = slides.flatMap((s) => s.layers.filter((l): l is ImageLayer => l.type === 'image' && !/^ícone/i.test(l.name ?? '')).map((l) => ({ s, l })))
  const pick = [...photos].sort((a, b) => b.l.w * b.l.h - a.l.w * a.l.h)[0]
  if (!pick) throw new Error('O post não tem uma camada de foto. Peça à faixa de layout para criar uma.')
  const { s, l } = pick
  crew(ctx, lane, s.id, [l.id], 'Gerando a foto')
  const providers = useCreativeLink.getState().providers
  if (!providers.length) throw new Error('Nenhum serviço de imagem pronto neste computador.')
  const treat = !!l.src && /recort|fundo|cor\b|cores|luz|retoc|nitid|tirar|remov|clare|escure|trat|melhor/i.test(ask)
  const r = l.w / l.h
  const ratio = r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square'
  let references: string[] = []
  if (treat) {
    step(ctx.msgId, lane.id, 'Lendo a foto atual')
    const { creativeImages } = await import('@/features/crm/instagram')
    const img = (await creativeImages(liveSet(ctx.t.set), [{ ...s, layers: [l] }])).get(l.src)
    if (img) {
      const k = Math.min(1, 1536 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * k))
      c.height = Math.max(1, Math.round(img.height * k))
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      references = [c.toDataURL('image/png')]
    }
  }
  const recorte = treat && /recort|fundo|transparen/i.test(ask)
  step(ctx.msgId, lane.id, treat ? 'Tratando a foto' : 'Gerando a foto')
  const out = await callAiQuiet<{ data: string }>(
    'image',
    {
      prompt: treat ? ask : `${ask}. No text, no letters, no logos, no watermark. Photorealistic editorial quality.`,
      ratio,
      provider: recorte && providers.includes('openai') ? 'openai' : imageProviderChoice(),
      ...(references.length ? { references, edit: true, transparent: recorte } : {}),
    },
    workSignal()
  )
  const blob = await (await fetch(out.data)).blob()
  const asset = await uploadAsset(ctx.t.set, blob, 'foto-equipe.png')
  step(ctx.msgId, lane.id, 'Pondo no post')
  await ctx.commit((cur) => {
    const posts = cur.posts.map((p) => (p.id !== post.id ? p : { ...p, slides: p.slides.map((x) => (x.id !== s.id ? x : { ...x, layers: x.layers.map((y) => (y.id === l.id ? ({ ...y, src: `asset:${asset.id}`, genFailed: false } as Layer) : y)) })) }))
    return { set: { ...cur, assets: [...cur.assets, asset], posts, updatedAt: Date.now() }, slides: [s.id] }
  })
  crew(ctx, lane, s.id, [l.id], 'Entregue', false)
  return treat ? 'Foto tratada e trocada no post (a original continua no conjunto).' : 'Foto nova no post.'
}

/** Ícones que cabem num post; a IA escolhe entre eles (nomes do lucide). Os dos formulários vêm primeiro. */
const ICONS = [...new Set([...FORM_ICONS, ...'check, circle-check, x, circle-x, star, heart, thumbs-up, sparkles, zap, flame, award, trophy, crown, gift, shopping-bag, shopping-cart, tag, percent, badge-percent, credit-card, wallet, banknote, truck, package, clock, timer, calendar, map-pin, phone, message-circle, mail, send, instagram, globe, house, building, store, utensils, coffee, pizza, sandwich, car, plane, bike, wrench, settings, shield, shield-check, lock, key, user, users, smile, sun, moon, leaf, droplet, recycle, camera, image, video, music, play, mic, book, graduation-cap, briefcase, lightbulb, target, trending-up, chart-bar, chart-pie, rocket, arrow-right, arrow-up-right, chevron-right, plus, minus, info, circle-alert, circle-help, search, filter, layers, layout-grid, scissors, paintbrush, palette, gem, dumbbell, stethoscope, pill, baby, dog, cat, paw-print'.split(', ')])].join(', ')

async function iconLane(ctx: Ctx, lane: SquadLane, post: Post, slide: Post['slides'][number] | undefined, ask: string): Promise<string> {
  if (!slide) throw new Error('O post não tem slides.')
  const size = sizeOf(post.format)
  crew(ctx, lane, slide.id, [], 'Escolhendo os ícones')
  const set = liveSet(ctx.t.set)
  const layers = slide.layers
    .filter((l) => !l.hidden)
    .map((l) => `- ${l.type} "${clip(l.name ?? '', 30)}" x=${Math.round(l.x)} y=${Math.round(l.y)} w=${Math.round(l.w)} h=${Math.round(l.h)}${l.type === 'text' ? ` texto="${clip((l as { text?: string }).text ?? '', 80)}"` : ''}`)
    .join('\n')
  step(ctx.msgId, lane.id, `${agentName(lane.agent)} escolhendo os ícones`)
  const out = await callAiQuiet<{ reply: string }>(
    'agent',
    {
      engine: chatAgent(),
      system: 'Você posiciona ícones num slide de post de Instagram. Responda SOMENTE com JSON, sem texto antes ou depois: {"icones":[{"nome":string,"x":number,"y":number,"tamanho":number,"cor":"#rrggbb"}],"resumo":string}. Prefira os nomes da lista (os primeiros são os da casa, os mesmos dos formulários); outro nome do Lucide também vale. No máximo 8 ícones. Não cubra textos nem fotos: ponha ao lado de títulos ou itens de lista, alinhados a eles. Cor da marca ou de texto do slide.',
      prompt: `Slide ${size.width}×${size.height} px. Cores da marca: ${set.brand.colors.map((c) => `${c.name} ${c.hex}`).join(', ') || 'neutras'}.\nCamadas do slide:\n${layers}\n\nÍcones disponíveis: ${ICONS}\n\nPedido: ${ask}`,
    },
    workSignal(),
    () => step(ctx.msgId, lane.id, 'Pensando')
  )
  const json = /\{[\s\S]*\}/.exec(out.reply)?.[0]
  const parsed = json ? (JSON.parse(json) as { icones?: { nome: string; x: number; y: number; tamanho: number; cor?: string }[]; resumo?: string }) : {}
  const list = (parsed.icones ?? []).slice(0, 8)
  if (!list.length) throw new Error('A IA não escolheu nenhum ícone.')
  step(ctx.msgId, lane.id, `Desenhando ${list.length} ícone(s)`)
  const added: ImageLayer[] = []
  const assets = []
  for (const ic of list) {
    const s = Math.max(24, Math.min(400, Number(ic.tamanho) || 64))
    const color = /^#[0-9a-f]{6}$/i.test(ic.cor ?? '') ? ic.cor! : set.brand.colors[0]?.hex || '#111111'
    const blob = await iconPng(String(ic.nome).trim(), color, s).catch(() => undefined)
    if (!blob) continue
    const asset = await uploadAsset(ctx.t.set, blob, `icone-${ic.nome}.png`)
    assets.push(asset)
    added.push({ id: layerUid(), type: 'image', name: `Ícone ${ic.nome}`, x: Math.round(Number(ic.x) || 0), y: Math.round(Number(ic.y) || 0), w: s, h: s, src: `asset:${asset.id}`, fit: 'contain', radius: 0, frame: 'none' })
    crew(ctx, lane, slide.id, added.map((a) => a.id), `Ícone ${added.length}`)
  }
  if (!added.length) throw new Error('Nenhum dos ícones escolhidos existe na biblioteca.')
  await ctx.commit((cur) => {
    const posts = cur.posts.map((p) => (p.id !== post.id ? p : { ...p, slides: p.slides.map((x) => (x.id !== slide.id ? x : { ...x, layers: [...x.layers, ...added] })) }))
    return { set: { ...cur, assets: [...cur.assets, ...assets], posts, updatedAt: Date.now() }, slides: [slide.id] }
  })
  crew(ctx, lane, slide.id, added.map((a) => a.id), 'Entregue', false)
  return `${added.length} ícone(s) no slide.${parsed.resumo ? ` ${parsed.resumo}` : ''}`
}

// ---------- faixas de site ----------

async function runSiteLane(msgId: string, lane: SquadLane, ask: string, projectName?: string): Promise<string> {
  const chat = useChat.getState()
  if (!chat.send || !lane.chat) throw new Error('O chat do Space não está conectado.')
  chat.watch?.(lane.chat)
  const agent = chatAgent()
  chat.send({ projectId: lane.chat, projectName, agent, text: `Sua parte (${lane.label}): ${ask}`, context: { sections: [] } })
  step(msgId, lane.id, `${agentName(agent)} começou`)
  const signal = workSignal()
  const stopIt = () => useChat.getState().stop?.(lane.chat!, agent)
  signal?.addEventListener('abort', stopIt, { once: true })
  try {
    // Espera a conversa da faixa começar e terminar
    const started = Date.now()
    let seen = false
    for (;;) {
      if (signal?.aborted) throw new DOMException('Parou', 'AbortError')
      const conv = useChat.getState().conversations[lane.chat]
      const running = conv?.running.includes(agent) ?? false
      if (running) seen = true
      if ((seen && !running) || (!seen && Date.now() - started > 20_000 && conv?.messages.some((m) => m.role === 'agent' && !m.streaming))) break
      if (Date.now() - started > 20 * 60_000) throw new Error('Passou de 20 minutos.')
      await new Promise((r) => setTimeout(r, 1000))
    }
    const last = [...(useChat.getState().conversations[lane.chat]?.messages ?? [])].reverse().find((m) => m.role === 'agent')
    if (last?.error) throw new Error(last.error)
    return (last?.parts ?? []).filter((p) => p.type === 'text').map((p) => (p as { text: string }).text).join('').trim() || 'Pronto.'
  } finally {
    signal?.removeEventListener('abort', stopIt)
  }
}

// ---------- a equipe ----------

/** Monta a equipe e roda as faixas em paralelo. Volta na hora com o id do cartão; o resultado vai à conversa no fim. */
export async function startSquad(args: SquadArgs): Promise<string> {
  const tasks = (Array.isArray(args.tarefas) ? args.tarefas : []).filter((t) => t && String(t.pedido ?? '').trim()).slice(0, MAX_LANES)
  if (tasks.length < 1) throw new Error('Diga as tarefas da equipe ("tarefas": [{"papel","pedido"}]).')
  const openProject = useProjectSync.getState().openId
  const site = !!args.projeto || (!args.conjunto && !args.id && !!openProject && !window.location.pathname.startsWith('/criativos'))
  const agent = chatAgent()
  const stamp = Date.now().toString(36).slice(-5)
  const lanes: SquadLane[] = tasks.map((t, i) => {
    const kind = KINDS.includes(t.papel) ? t.papel : 'livre'
    return {
      id: `f${i + 1}`,
      kind,
      label: site ? `Faixa ${i + 1}` : LANE_LABEL[kind],
      agent: kind === 'imagem' && !site ? 'imagens' : agent,
      color: site ? Object.values(LANE_COLOR)[i % 5] : LANE_COLOR[kind],
      status: 'fila',
      turns: [{ role: 'pessoa', text: String(t.pedido).trim().slice(0, 2000) }],
      steps: [],
      slide: typeof t.slide === 'number' ? t.slide : undefined,
    }
  })

  if (site) {
    const projectId = args.projeto ? (useProjectStore.getState().projects.find((p) => p.id === args.projeto || p.name.toLowerCase() === String(args.projeto).toLowerCase())?.id ?? '') : openProject ?? ''
    if (!projectId) throw new Error('Abra o projeto do site (ou diga "projeto").')
    const projectName = useProjectStore.getState().projects.find((p) => p.id === projectId)?.name
    lanes.forEach((l, i) => (l.chat = `${projectId}#faixa${i + 1}-${stamp}`))
    const id = addCard({ role: 'iara', text: '', squad: { title: `${projectName ?? 'Projeto'}: ${lanes.length} faixas`, surface: 'site', projectId, lanes, final: 'trabalhando' } })
    void run(id, lanes, (lane, ask) => runSiteLane(id, lane, ask, projectName))
    return id
  }

  const t = await squadTarget(args as unknown as Record<string, unknown>)
  await squadFollow(t, squadPickPost(t.set, args.post).id)
  const post = squadPickPost(t.set, args.post)
  const id = addCard({ role: 'iara', text: '', squad: { title: `${t.title} · post "${post.name}"`, surface: 'criativo', setId: t.set.id, postId: post.id, open: t.open, lanes, final: 'trabalhando' } })
  let chain: Promise<unknown> = Promise.resolve()
  const ctx: Ctx = {
    msgId: id,
    t,
    postId: post.id,
    commit: (fn) => {
      const next = chain.then(async () => {
        const out = fn(liveSet(t.set))
        await squadPersist(t, out.set, out.slides, post.id)
        return out.slides
      })
      chain = next.catch(() => undefined)
      return next
    },
  }
  contexts.set(id, ctx)
  void run(id, lanes, (lane, ask) => runCreativeLane(ctx, lane, ask, lane.slide))
  return id
}

const contexts = new Map<string, Ctx>()

async function run(msgId: string, lanes: SquadLane[], work: (lane: SquadLane, ask: string) => Promise<string>) {
  const summary: string[] = []
  let stopped = false
  await runWork(`Equipe rápida (${lanes.length} faixas)`, async () => {
    await Promise.all(
      lanes.map(async (lane) => {
        patchLane(msgId, lane.id, (l) => ({ ...l, status: 'trabalhando' }))
        try {
          const reply = await work(lane, lane.turns[0].text)
          patchLane(msgId, lane.id, (l) => ({ ...l, status: 'pronto', turns: [...l.turns, { role: 'agente', text: reply }] }))
          summary.push(`${lane.label}: ${clip(reply, 400)}`)
        } catch (e) {
          if (isStopped(e)) stopped = true
          const text = isStopped(e) ? 'Parado por você.' : `Não deu: ${e instanceof Error ? e.message : String(e)}`
          patchLane(msgId, lane.id, (l) => ({ ...l, status: isStopped(e) ? 'parado' : 'erro', turns: [...l.turns, { role: 'agente', text }] }))
          summary.push(`${lane.label}: ${text}`)
        } finally {
          useAgent.getState().crewDone(`${msgId}:${lane.id}`)
        }
      })
    )
  }).catch(() => undefined)
  await refreshPreview(msgId)
  patchSquad(msgId, (s) => ({ ...s, final: stopped ? 'parado' : 'pronto' }))
  if (!stopped) void sendWhenFree(`[Equipe rápida terminou]\n${summary.join('\n')}\n\nConfira o resultado (ver_criativo, se for criativo) e diga em poucas linhas o que ficou bom e o que falta.`)
}

async function refreshPreview(msgId: string) {
  const ctx = contexts.get(msgId)
  if (!ctx) return
  const post = currentPost(ctx)
  if (!post) return
  const imgs = await squadPreviews(liveSet(ctx.t.set), post, 360).catch(() => [])
  patchMessage(msgId, (m) => ({ ...m, images: imgs.slice(0, 6).map((i) => i.data) }))
}

/** Mais um pedido a uma faixa só (o minichat dela). */
export async function askLane(msgId: string, lane: SquadLane, squad: Squad, text: string) {
  const ask = text.trim()
  if (!ask) return
  patchLane(msgId, lane.id, (l) => ({ ...l, status: 'trabalhando', steps: [], turns: [...l.turns, { role: 'pessoa', text: ask }] }))
  const go = async () => {
    try {
      const reply =
        squad.surface === 'site'
          ? await runSiteLane(msgId, lane, ask, useProjectStore.getState().projects.find((p) => p.id === squad.projectId)?.name)
          : await (async () => {
              const ctx = contexts.get(msgId)
              if (!ctx) throw new Error('Esta equipe é de antes de recarregar a página: peça de novo à Iara.')
              return runCreativeLane(ctx, lane, ask, lane.slide)
            })()
      patchLane(msgId, lane.id, (l) => ({ ...l, status: 'pronto', turns: [...l.turns, { role: 'agente', text: reply }] }))
    } catch (e) {
      patchLane(msgId, lane.id, (l) => ({ ...l, status: isStopped(e) ? 'parado' : 'erro', turns: [...l.turns, { role: 'agente', text: isStopped(e) ? 'Parado por você.' : `Não deu: ${e instanceof Error ? e.message : String(e)}` }] }))
    } finally {
      useAgent.getState().crewDone(`${msgId}:${lane.id}`)
      void refreshPreview(msgId)
    }
  }
  // Com outra faixa rodando, entra no mesmo trabalho (pausar e parar valem para ela também)
  if (useWork.getState().running) await go()
  else await runWork(`${lane.label}: ${clip(ask, 50)}`, go)
}
