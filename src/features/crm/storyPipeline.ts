import { toast } from 'sonner'
import { create } from 'zustand'
import { AV_CASES } from '@/features/avence/cases'
import { docText } from '@/features/copy/send'
import { listDocs, loadDoc } from '@/features/copy/storage'
import { fillSetImages, type MissingImage } from '@/features/criativos/generate'
import { callAiQuiet, useCreativeLink, type CreativeStep } from '@/features/criativos/link'
import type { PlanResponse, PostPlan, SlideSpec } from '@/features/criativos/plan'
import { loadSet, saveSet } from '@/features/criativos/storage'
import { buildPost, buildSlide } from '@/features/criativos/templates'
import { sizeOf, type CreativeSet, type ImageLayer, type Post, type SetAsset } from '@/features/criativos/types'
import { personaFor, profileNow } from '@/features/ia/perfis'
import { resolveIa } from '@/features/ia/porTarefa'
import { announce, finishJob, noteJob, patchJob, recordDelivery, startJob, type Area } from '@/features/operations/jobs'
import { CHAT_AGENTS, type ChatAgentId } from '@/features/space/chat/protocol'
import { supabase } from '@/integrations/supabase/client'
import { prepareImage, renderCreative } from './instagram'
import {
  addWeeks,
  getStory,
  insertStories,
  listPublished,
  listStories,
  loadStorySettings,
  numbersText,
  sameSlot,
  storyNumbers,
  updateStory,
  weekLabel,
  weekSlots,
  whenText,
  type NewStory,
  type Story,
  type StorySettings,
} from './stories'
import type { StoryIdea, StoryPlanRequest, StoryPlanResponse } from './storyPlan'

/**
 * A esteira dos stories: um agente por etapa, cada um com o seu perfil e o
 * Codex (ou a IA escolhida em Agentes › IA por tarefa) como motor.
 *
 *   1. Nina (Estrategista) escreve a pauta dos horários livres da semana, lendo
 *      os números dos stories que já saíram e a pesquisa de tendências da Copy.
 *   2. Teo (Editor) revisa as regras e marca o que precisa de atenção.
 *   3. Dani (Designer) monta cada sequência em 9:16 no conjunto de criativos.
 *   4. Lia (Ilustradora) gera as fotos; a que falha vira uma tela sem foto.
 *
 * Cada etapa grava o que fez antes da próxima (`crm_stories`), então parar e
 * rodar de novo continua de onde parou, sem duplicar. Roda neste navegador,
 * com a IA conectada (servidor de dev ou conector). Ninguém publica aqui:
 * aprovar gera as imagens e agenda; quem publica é o servidor, na hora.
 */

const DAY = 86_400_000
export const STORIES_HREF = '/crm/instagram?aba=stories'
const STEP_TEXT: Record<CreativeStep, string> = { start: 'Lendo o pedido', thinking: 'Pensando', reading: 'Pesquisando na web', writing: 'Escrevendo' }
const KNOWN_CASES = new Set(AV_CASES.map((c) => c.slug))
const BUCKET = 'space-projects'

const abortError = () => new DOMException('Parou', 'AbortError')
const isAbort = (error: unknown) => (error as Error | undefined)?.name === 'AbortError'

/** Um trabalho de um agente no Escritório: o cargo abre o nome (é por ele que a mesa certa acende). */
function agentJob(profileId: string, area: Area, kind: string, label: string, engine: ChatAgentId, parent: AbortSignal) {
  const p = profileNow(profileId)
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  parent.addEventListener('abort', onAbort, { once: true })
  if (parent.aborted) controller.abort()
  const id = startJob({ area, kind, label: label.slice(0, 100), agent: `${p.base} · ${CHAT_AGENTS[engine].name}`, color: CHAT_AGENTS[engine].color, step: 'Começando', href: STORIES_HREF, silent: true }, controller)
  return {
    signal: controller.signal,
    step: (step: CreativeStep, detail?: string) => {
      patchJob(id, { step: detail ?? STEP_TEXT[step] })
      noteJob(id, detail ?? STEP_TEXT[step])
    },
    done: (error?: unknown) => {
      parent.removeEventListener('abort', onAbort)
      finishJob(id, error)
    },
  }
}

const casesFor = (slugs: (string | undefined)[]) => {
  const wanted = slugs.filter((s): s is string => !!s && KNOWN_CASES.has(s))
  return (wanted.length ? AV_CASES.filter((c) => wanted.includes(c.slug)) : AV_CASES).map((c) => ({ slug: c.slug, name: c.name, segment: c.segment, place: c.place, summary: c.summary, stack: c.stack }))
}

/** A pesquisa de tendências mais recente da Copy (até 45 dias), como material da pauta. */
async function latestResearch(): Promise<string | undefined> {
  const docs = await listDocs()
  const found = docs.filter((d) => d.format === 'tendencias').sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (!found || Date.now() - found.updatedAt > 45 * DAY) return undefined
  const doc = await loadDoc(found.id, found.shared ? found.projectId : undefined)
  return doc ? `${doc.title}\n\n${docText(doc)}`.slice(0, 8000) : undefined
}

// ---------- 1. a pauta ----------

async function planWeek(settings: StorySettings, start: number, free: number[], current: Story[], engine: ChatAgentId, signal: AbortSignal): Promise<Story[]> {
  const job = agentJob('nina', 'copy', 'Pauta de stories', `Semana de ${weekLabel(start)}`, engine, signal)
  try {
    job.step('start', 'Lendo os stories que já saíram')
    const [history, next, research] = await Promise.all([
      listPublished(settings.teamId, start - 28 * DAY),
      listStories(settings.teamId, addWeeks(start, 1), addWeeks(start, 2)),
      latestResearch().catch(() => undefined),
    ])
    const slots = free.map((at) => ({ ref: `s${at}`, at, when: whenText(at) }))
    const pillar = (id: string) => settings.pillars.find((p) => p.id === id)?.label ?? id
    const request: StoryPlanRequest = {
      engine,
      web: settings.web,
      slots: slots.map(({ ref, when }) => ({ ref, when })),
      framesMax: settings.framesMax,
      pillars: settings.pillars,
      brief: settings.brief,
      photos: settings.photos,
      cases: casesFor([]),
      history: history.map((s) => ({ when: whenText(s.publishAt), pillar: pillar(s.pillar), title: s.title, hook: s.idea.hook ?? '', frames: s.frames.length, numbers: numbersText(storyNumbers(s)) })),
      planned: [...current, ...next].filter((s) => s.status !== 'descartado').map((s) => ({ when: whenText(s.publishAt), pillar: pillar(s.pillar), title: s.title })),
      research,
    }
    const res = await callAiQuiet<StoryPlanResponse>('story-plan', request, job.signal, job.step)
    const bySlot = new Map(slots.map((s) => [s.ref, s.at]))
    const pillarIds = new Set(settings.pillars.map((p) => p.id))
    const rows: NewStory[] = []
    for (const idea of res.stories ?? []) {
      const at = bySlot.get(String(idea?.ref ?? ''))
      if (at === undefined || !Array.isArray(idea.frames) || !idea.frames.length) continue
      bySlot.delete(idea.ref)
      const clean: StoryIdea = {
        ref: idea.ref,
        pillar: pillarIds.has(idea.pillar) ? idea.pillar : settings.pillars[0]?.id ?? 'livre',
        title: String(idea.title || idea.hook || 'Story').slice(0, 120),
        hook: String(idea.hook ?? '').slice(0, 200),
        angle: String(idea.angle ?? '').slice(0, 400),
        objective: String(idea.objective ?? '').slice(0, 400),
        frames: idea.frames.slice(0, settings.framesMax).map((f) => ({ text: String(f?.text ?? '').slice(0, 300), visual: String(f?.visual ?? '').slice(0, 300) })),
        cta: String(idea.cta ?? '').slice(0, 200),
        case: idea.case && KNOWN_CASES.has(idea.case) ? idea.case : undefined,
        why: String(idea.why ?? '').slice(0, 400),
      }
      rows.push({ teamId: settings.teamId, accountId: settings.accountId, publishAt: at, pillar: clean.pillar, title: clean.title, idea: clean, setId: settings.setId, setProjectId: settings.setProjectId })
    }
    if (!rows.length) throw new Error('A Estrategista não devolveu nenhuma ideia para os horários livres.')
    job.step('writing', `${rows.length} stories na pauta`)
    const saved = await insertStories(rows)
    job.done()
    return saved
  } catch (error) {
    job.done(error)
    throw error
  }
}

// ---------- 2. a revisão ----------

const REVIEW_RULES = [
  'Nunca promessa de resultado nem número, prazo, preço, depoimento ou cliente que não esteja no material.',
  'Nada de WordPress, Elementor, PHP, plugin ou SEO para o dono do negócio; nunca citar o Superelements.',
  'Story pela API não tem figurinha: nada de "vote", "enquete", "caixa de perguntas", "toque no link" ou "link na bio". O convite é responder o story ou chamar no Direct.',
  'Cada tela se lê em 3 segundos: frase curta, uma ideia por tela; o gancho prende sem exagero nem urgência falsa.',
  'Português do Brasil, sem emoji e sem jargão de marketing.',
]

async function reviewIdeas(ideas: Story[], engine: ChatAgentId, signal: AbortSignal): Promise<Story[]> {
  const job = agentJob('teo', 'copy', 'Revisão dos stories', `${ideas.length} ${ideas.length === 1 ? 'story' : 'stories'}`, engine, signal)
  try {
    const material = ideas.map((s) => ({ ref: s.id, quando: whenText(s.publishAt), gancho: s.idea.hook, telas: s.idea.frames?.map((f) => f.text) ?? [], convite: s.idea.cta, case: s.idea.case ?? null }))
    const out = await callAiQuiet<{ reply: string; items: { ref: string; text: string }[] }>(
      'agent',
      {
        engine,
        system: personaFor('teo'),
        prompt: `## Stories da semana, antes da aprovação (JSON)\n${JSON.stringify(material)}\n\n## Regras\n${REVIEW_RULES.map((r) => `- ${r}`).join('\n')}\n\n## Tarefa\nLeia cada story como o dono do negócio leria no celular. Não reescreva o que está bom. Em \`items\`, só os stories que quebram uma regra ou estão fracos: ref = o ref do story, text = o problema e a correção, em uma ou duas frases. \`reply\`: uma frase de resumo.`,
        web: false,
      },
      job.signal,
      job.step
    )
    const notes = new Map((out.items ?? []).filter((i) => i?.ref && i.text?.trim()).map((i) => [i.ref, i.text.trim().slice(0, 600)]))
    const next: Story[] = []
    for (const s of ideas) next.push(await updateStory(s.id, { review: notes.has(s.id) ? { ok: false, note: notes.get(s.id) } : { ok: true } }))
    job.done()
    return next
  } catch (error) {
    job.done(error)
    if (isAbort(error)) throw error
    // Sem revisão a esteira segue: a tela mostra "sem revisão" e a equipe confere
    return ideas
  }
}

// ---------- 3 e 4. o criativo e as fotos ----------

/** Foto que não saiu: a tela vira uma sem foto, com o mesmo texto (capa vira manifesto; foto vira frase). */
const noPhoto = (s: SlideSpec): SlideSpec => ({ ...s, prompt: undefined, template: s.template === 'viral-capa' || s.template === 'foto-manchete' ? 'manifesto' : s.template === 'viral-foto' ? 'viral-frase' : s.template })

/** O roteiro da Estrategista, como a Designer recebe. */
function briefOf(s: Story, settings: StorySettings, extra?: string) {
  const idea = s.idea
  const pillar = settings.pillars.find((p) => p.id === s.pillar)?.label ?? s.pillar
  return [
    `Nome: ${s.title}`,
    `Pilar: ${pillar}`,
    idea.angle && `Ângulo: ${idea.angle}`,
    idea.objective && `Objetivo: ${idea.objective}`,
    'Telas (uma por slide, nesta ordem):',
    ...(idea.frames ?? []).map((f, i) => `${i + 1}. ${f.text}${f.visual ? ` [mostra: ${f.visual}]` : ''}`),
    idea.cta && `Convite da última tela: ${idea.cta}`,
    idea.case && `Case: ${idea.case}`,
    settings.photos && !idea.case
      ? 'Direção visual: a abertura precisa ser fotográfica, colorida e com um gesto ou objeto isolado que sustente a ideia. A imagem ocupa a maior área; use no mínimo uma e no máximo duas fotos na sequência. Evite montar todas as telas como texto sobre fundo preto ou branco.'
      : '',
    s.review?.ok === false && s.review.note ? `Nota do Editor (corrija isto): ${s.review.note}` : '',
    extra?.trim() ? `Pedido da equipe para refazer: ${extra.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * A direção criativa da Avence pede imagem em grande área e uma ideia visual
 * reconhecível em três segundos. A Designer ainda pode devolver apenas telas
 * tipográficas; nesse caso a esteira transforma a abertura em foto, sem mexer
 * na copy.
 */
const ensureVisualOpening = (slides: SlideSpec[], story: Story, settings: StorySettings): SlideSpec[] => {
  if (!settings.photos || story.idea.case || !slides.length || slides.some((s) => s.template === 'viral-capa' || s.template === 'viral-foto')) return slides
  const subject = story.idea.frames?.[0]?.visual || story.idea.angle || story.idea.hook || story.title
  const prompt = [
    'Fotografia editorial vertical 9:16 para a Avence Studio.',
    `Cena: ${subject}.`,
    `Ideia: ${story.idea.hook || story.title}.`,
    'Um gesto ou objeto principal isolado, enquadramento assimétrico, luz natural quente e espaço negativo para o título.',
    'Paleta creme com azul cobalto #2b3cf0 e um pequeno acento coral; colorida, humana e tátil.',
    "Sem texto legível, sem logo, sem marca d'água, sem rosto conhecido e sem aparência genérica de banco de imagens.",
  ].join(' ')
  return slides.map((s, i) => (i === 0 ? { ...s, template: 'viral-capa', prompt, dark: true } : s))
}

/** Relê o conjunto e grava só este post e as imagens novas (outra pessoa pode ter mexido no conjunto enquanto a IA trabalhava). */
async function mergePost(settings: Pick<StorySettings, 'setId' | 'setProjectId'>, post: Post, assets: SetAsset[] = [], replace?: string): Promise<CreativeSet> {
  const latest = await loadSet(settings.setId!, settings.setProjectId)
  if (!latest) throw new Error('Não consegui abrir o conjunto de criativos dos stories.')
  const target = replace ?? post.id
  const has = latest.posts.some((p) => p.id === target)
  const known = new Set(latest.assets.map((a) => a.id))
  const next: CreativeSet = {
    ...latest,
    assets: [...latest.assets, ...assets.filter((a) => !known.has(a.id))],
    posts: has ? latest.posts.map((p) => (p.id === target ? post : p)) : [...latest.posts, post],
    updatedAt: Date.now(),
  }
  await saveSet(next)
  return next
}

const shortDay = (at: number) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const storyPostName = (story: Story) => `Story · ${shortDay(story.publishAt)} · ${story.title}`.slice(0, 120)

/** O pilar do story: na linguagem editorial ele é o assunto da série, no canto do topo. */
const pillarOf = (story: Story, settings: StorySettings) => settings.pillars.find((p) => p.id === story.pillar)?.label ?? story.pillar

/** Dani monta a sequência no conjunto; Lia gera as fotos. O story fica "Para aprovar". */
async function buildCreative(story: Story, settings: StorySettings, engine: ChatAgentId, signal: AbortSignal, extra?: string): Promise<{ story: Story; photosFailed: number }> {
  const frames = Math.min(10, Math.max(1, story.idea.frames?.length ?? 1))
  const series = pillarOf(story, settings)
  const job = agentJob('dani', 'criativos', 'Stories', story.title, engine, signal)
  let post: Post
  let spec: PostPlan
  try {
    const plan = await callAiQuiet<PlanResponse>(
      'plan',
      { brief: briefOf(story, settings, extra), format: '9x16', slides: frames, posts: 1, engine, story: true, photos: settings.photos, cases: casesFor([story.idea.case]) },
      job.signal,
      job.step
    )
    const first = plan.posts?.find((p) => p.slides?.length)
    if (!first) throw new Error('A Designer não montou as telas.')
    const slides = ensureVisualOpening(first.slides.slice(0, 10).map((s, i): SlideSpec => {
      // O número grande cabe em poucos caracteres ("02", "5 s"): um texto ali encavala no título
      const n = s.number?.trim()
      const short = n && n.length <= 4 ? n : undefined
      const numbered: SlideSpec =
        s.template === 'viral-dado' && !short
          ? { ...s, template: 'viral-frase', number: undefined }
          : s.template === 'viral-foto'
            ? { ...s, number: short ?? String(i + 1).padStart(2, '0') }
            : { ...s, number: short }
      const fixed = { ...numbered, case: s.case && KNOWN_CASES.has(s.case) ? s.case : story.idea.case ?? AV_CASES[0].slug }
      return settings.photos ? fixed : noPhoto(fixed)
    }), story, settings)
    spec = { name: story.title, format: '9x16', caption: '', slides }
    job.step('writing', 'Montando as telas no conjunto')
    const set = await loadSet(settings.setId!, settings.setProjectId)
    if (!set) throw new Error('Não consegui abrir o conjunto de criativos dos stories.')
    post = { ...buildPost({ name: storyPostName(story), format: '9x16', slides }, set.brand, { series }), id: story.postId ?? Math.random().toString(36).slice(2, 10) }
    await mergePost(settings, post)
    job.done()
  } catch (error) {
    job.done(error)
    throw error
  }

  // As fotos (Lia): a que não sair vira uma tela sem foto, para a sequência nunca ficar com um buraco
  let photosFailed = 0
  const wantsPhotos = post.slides.some((sl) => sl.layers.some((l) => l.type === 'image' && !l.src && l.prompt?.trim()))
  if (wantsPhotos) {
    const lia = agentJob('lia', 'criativos', 'Imagem', story.title, engine, signal)
    let failed: MissingImage[] = []
    let assets: SetAsset[] = []
    try {
      const set = await loadSet(settings.setId!, settings.setProjectId)
      if (!set) throw new Error('Não consegui abrir o conjunto de criativos dos stories.')
      const before = new Set(set.assets.map((a) => a.id))
      // O post que a Dani acabou de montar entra como está, mesmo que a leitura do conjunto venha atrasada
      const current = post
      const withPost = { ...set, posts: set.posts.some((p) => p.id === current.id) ? set.posts.map((p) => (p.id === current.id ? current : p)) : [...set.posts, current] }
      const out = await fillSetImages(withPost, [post.id], { signal: lia.signal, provider: engine === 'codex' ? 'codex' : undefined, onImage: (done, total) => lia.step('writing', `Foto ${done} de ${total}`) })
      post = out.set.posts.find((p) => p.id === post.id) ?? post
      assets = out.set.assets.filter((a) => !before.has(a.id))
      failed = out.failed
      lia.done(failed.length && !assets.length ? new Error('Nenhuma foto saiu; as telas ficaram sem foto.') : undefined)
    } catch (error) {
      lia.done(error)
      if (isAbort(error)) throw error
      failed = post.slides.flatMap((sl) => sl.layers.filter((l) => l.type === 'image' && !l.src && l.prompt?.trim()).map((l) => ({ postId: post.id, slideId: sl.id, layerId: l.id })))
    }
    if (failed.length) {
      const bad = new Set(failed.map((f) => f.slideId))
      const set = await loadSet(settings.setId!, settings.setProjectId)
      post = {
        ...post,
        slides: post.slides.map((sl, i) => {
          if (!bad.has(sl.id) || !spec.slides[i] || !set) return sl
          spec.slides[i] = noPhoto(spec.slides[i])
          return { ...buildSlide(spec.slides[i], set.brand, '9x16', { index: i, total: spec.slides.length, series }), id: sl.id }
        }),
      }
      photosFailed = bad.size
    }
    await mergePost(settings, post, assets)
  }

  const saved = await updateStory(story.id, { status: 'criativo', plan: spec, setId: settings.setId, setProjectId: settings.setProjectId ?? null, postId: post.id, error: null })
  return { story: saved, photosFailed }
}

// ---------- a semana inteira ----------

export interface WeekResult {
  planned: number
  built: number
  failed: number
  photosFailed: number
  message: string
}

async function needSet(settings: StorySettings) {
  if (!settings.setId) throw new Error('Escolha o conjunto de criativos nos ajustes dos stories.')
  const set = await loadSet(settings.setId, settings.setProjectId)
  if (!set) throw new Error('Não consegui abrir o conjunto de criativos escolhido. Ele precisa estar compartilhado com um projeto seu.')
  return set
}

const needAi = () => {
  const link = useCreativeLink.getState()
  if (!link.connected) throw new Error('A IA não está conectada. Abra o app local ou o conector.')
  if (link.stale) throw new Error('O conector está desatualizado: baixe o conector.mjs de novo e abra-o.')
}

/** O horário de um story "agora": daqui a 20 minutos, no próximo múltiplo de 5 (tempo de montar e aprovar; "Publicar agora" adianta). */
export const nowSlot = (from = Date.now()) => Math.ceil((from + 20 * 60_000) / 300_000) * 300_000

/**
 * Monta a semana que começa em `start` (segunda 00:00): pauta para os
 * horários livres (a partir de 30 minutos daqui), revisão, criativos e fotos.
 * Os stories que estavam em "Ideia" (uma rodada que parou) entram junto.
 * Com `at`, monta um story só, naquele horário (o "Um story agora").
 */
export async function buildWeek(teamId: string, start: number, signal: AbortSignal, onStep?: (text: string) => void, at?: number): Promise<WeekResult> {
  needAi()
  const settings = await loadStorySettings(teamId)
  if (at === undefined && (!settings.days.length || !settings.times.length)) throw new Error('Escolha os dias e os horários nos ajustes dos stories.')
  if (!settings.accountId) throw new Error('Escolha a conta do Instagram nos ajustes dos stories.')
  await needSet(settings)
  const engine = resolveIa('stories')
  const current = (await listStories(teamId, start, addWeeks(start, 1))).filter((s) => s.status !== 'descartado')
  const soon = Date.now() + 30 * 60_000
  const slots = at !== undefined ? [at] : weekSlots(settings, start)
  const free = at !== undefined ? slots : slots.filter((s) => s > soon && !current.some((x) => sameSlot(x.publishAt, s)))

  let ideas = at !== undefined ? [] : current.filter((s) => s.status === 'ideia')
  let planned = 0
  if (free.length) {
    onStep?.(`${profileNow('nina').name} está escrevendo a pauta`)
    const fresh = await planWeek(settings, start, free, current, engine, signal)
    planned = fresh.length
    ideas = [...ideas, ...fresh].sort((a, b) => a.publishAt - b.publishAt)
  }
  if (!ideas.length) {
    const passed = !slots.some((s) => s > soon)
    return { planned: 0, built: 0, failed: 0, photosFailed: 0, message: passed ? 'Os horários desta semana já passaram. Monte a próxima semana ou use "Um story agora".' : 'Todos os horários da semana já estão na pauta.' }
  }

  if (signal.aborted) throw abortError()
  onStep?.(`${profileNow('teo').name} está revisando`)
  ideas = await reviewIdeas(ideas, engine, signal)

  let built = 0
  let failed = 0
  let photosFailed = 0
  for (const [i, story] of ideas.entries()) {
    if (signal.aborted) throw abortError()
    onStep?.(`${profileNow('dani').name} está montando o story ${i + 1} de ${ideas.length}`)
    try {
      const out = await buildCreative(story, settings, engine, signal)
      built++
      photosFailed += out.photosFailed
    } catch (error) {
      if (isAbort(error)) throw error
      failed++
      await updateStory(story.id, { error: error instanceof Error ? error.message.slice(0, 500) : String(error) }).catch(() => undefined)
    }
  }

  const message = [
    planned ? `${planned} ${planned === 1 ? 'story novo' : 'stories novos'} na pauta` : '',
    `${built} ${built === 1 ? 'pronto' : 'prontos'} para aprovar`,
    failed ? `${failed} não ${failed === 1 ? 'montou' : 'montaram'} (rode de novo)` : '',
    photosFailed ? `${photosFailed} ${photosFailed === 1 ? 'tela ficou' : 'telas ficaram'} sem foto` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  if (built) {
    announce(`Stories da semana de ${weekLabel(start)}: ${built} para aprovar`, STORIES_HREF, 'Stories')
    recordDelivery({ area: 'criativos', kind: 'Stories da semana', label: `Semana de ${weekLabel(start)} · ${built} para aprovar`, agent: `${profileNow('nina').base} · ${CHAT_AGENTS[engine].name}`, href: STORIES_HREF })
  }
  return { planned, built, failed, photosFailed, message }
}

/** Refaz só o criativo de um story (com o pedido da equipe), no lugar do post que estava no conjunto. */
export async function redoStory(story: Story, note: string, signal: AbortSignal): Promise<Story> {
  needAi()
  if (story.status !== 'ideia' && story.status !== 'criativo' && story.status !== 'falhou') throw new Error('Desaprove o story antes de refazer.')
  const settings = await loadStorySettings(story.teamId)
  await needSet({ ...settings, setId: story.setId ?? settings.setId, setProjectId: story.setProjectId ?? settings.setProjectId })
  const out = await buildCreative(story, { ...settings, setId: story.setId ?? settings.setId, setProjectId: story.setProjectId ?? settings.setProjectId }, resolveIa('stories'), signal, note)
  return out.story
}

/**
 * Remonta as telas com o roteiro que a Designer já escreveu (`plan`), na
 * linguagem que o conjunto usa agora: sem IA, na hora. Serve quando a
 * identidade muda (ou o post sumiu do conjunto). As fotos já geradas voltam
 * para as mesmas telas; a tela que pedia foto e não tem vira uma sem foto.
 */
export async function restyleStory(story: Story): Promise<Story> {
  if (story.status !== 'criativo' && !(story.status === 'falhou' && !story.frames.length)) throw new Error('Desaprove o story antes de remontar.')
  if (!story.plan?.slides?.length) throw new Error('Este story ainda não tem as telas planejadas: use Refazer.')
  const settings = await loadStorySettings(story.teamId)
  const where = { setId: story.setId ?? settings.setId, setProjectId: story.setProjectId ?? settings.setProjectId }
  const set = await needSet({ ...settings, ...where })
  const old = set.posts.find((p) => p.id === story.postId)
  const photos = story.plan.slides.map((_, i) => old?.slides[i]?.layers.find((l): l is ImageLayer => l.type === 'image' && !!l.prompt && !!l.src)?.src)
  const slides = story.plan.slides.map((s, i) => (s.template === 'viral-capa' || s.template === 'viral-foto' || s.template === 'foto-manchete') && !photos[i] ? noPhoto(s) : s)
  const built = buildPost({ name: old?.name ?? storyPostName(story), format: '9x16', slides }, set.brand, { series: pillarOf(story, settings) })
  const post: Post = {
    ...built,
    id: story.postId ?? built.id,
    slides: built.slides.map((sl, i) => (photos[i] ? { ...sl, layers: sl.layers.map((l) => (l.type === 'image' && l.prompt && !l.src ? { ...l, src: photos[i]! } : l)) } : sl)),
  }
  await mergePost(where, post)
  return updateStory(story.id, { status: 'criativo', plan: { ...story.plan, slides }, postId: post.id, setId: where.setId, setProjectId: where.setProjectId ?? null, error: null })
}

// ---------- aprovar e o resto da mão da equipe ----------

/** A pasta das telas aprovadas: dentro da pasta do Instagram da equipe, de onde a função publica. */
const framePath = (teamId: string, storyId: string, index: number) => `crm/${teamId}/instagram/stories/${storyId}/${index + 1}-${Date.now().toString(36)}.jpg`

const removeFiles = (paths: string[]) => (paths.length ? supabase.storage.from(BUCKET).remove(paths).then(() => undefined, () => undefined) : Promise.resolve())

/** Uma tela com foto ainda por gerar (a imagem sairia vazia). */
const missingPhoto = (post: Post) => post.slides.findIndex((sl) => sl.layers.some((l) => l.type === 'image' && !l.hidden && !l.src))

/**
 * Aprovar: gera o JPEG de cada tela a partir do conjunto como está agora (o
 * que foi editado no Criativos entra), sobe para a pasta do Instagram da
 * equipe e agenda. O banco grava quem aprovou.
 */
export async function approveStory(story: Story, accountId: string | undefined): Promise<Story> {
  if (!story.setId || !story.postId) throw new Error('Este story ainda não tem as telas montadas.')
  if (story.status !== 'criativo' && story.status !== 'falhou') throw new Error('Só um story montado (ou que não saiu) é aprovado.')
  if (!accountId && !story.accountId) throw new Error('Escolha a conta do Instagram nos ajustes dos stories.')
  const set = await loadSet(story.setId, story.setProjectId)
  if (!set) throw new Error('Não consegui abrir o conjunto de criativos deste story.')
  const post = set.posts.find((p) => p.id === story.postId)
  if (!post) throw new Error('O post deste story não está mais no conjunto. Refaça o criativo.')
  const { width, height } = sizeOf(post.format)
  if (height / width < 1.7) throw new Error('O post não está em 9:16. Volte o formato para Story no Criativos.')
  if (!post.slides.length || post.slides.length > 10) throw new Error('Um story vai de 1 a 10 telas.')
  const hole = missingPhoto(post)
  if (hole >= 0) throw new Error(`A tela ${hole + 1} está com a foto por gerar. Gere a foto ou troque a tela no Criativos.`)

  const blobs = await renderCreative(set, post)
  const paths: string[] = []
  try {
    for (const [i, blob] of blobs.entries()) {
      const file = await prepareImage(blob, `tela-${i + 1}.jpg`)
      URL.revokeObjectURL(file.url)
      const path = framePath(story.teamId, story.id, i)
      const { error } = await supabase.storage.from(BUCKET).upload(path, file.blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw new Error(`Não consegui enviar a tela ${i + 1}: ${error.message}`)
      paths.push(path)
    }
    const old = story.frames.filter((f) => !f.mediaId).map((f) => f.path)
    const saved = await updateStory(story.id, { status: 'agendado', frames: paths.map((path) => ({ path })), accountId: story.accountId ?? accountId ?? null, attempts: 0, nextTryAt: null, error: null })
    await removeFiles(old)
    return saved
  } catch (error) {
    await removeFiles(paths)
    throw error
  }
}

/** Desaprovar: as imagens saem da pasta e o story volta para a aprovação. */
export async function unapproveStory(story: Story): Promise<Story> {
  if (story.frames.some((f) => f.mediaId)) throw new Error('Parte deste story já está no ar.')
  const saved = await updateStory(story.id, { status: 'criativo', frames: [], nextTryAt: null, error: null })
  await removeFiles(story.frames.map((f) => f.path))
  return saved
}

export async function discardStory(story: Story): Promise<Story> {
  if (story.frames.some((f) => f.mediaId)) throw new Error('Parte deste story já está no ar.')
  const saved = await updateStory(story.id, { status: 'descartado', frames: [], nextTryAt: null })
  await removeFiles(story.frames.map((f) => f.path))
  return saved
}

/** Muda o horário; aprovado continua aprovado. */
export const rescheduleStory = (story: Story, at: number) => updateStory(story.id, { publishAt: at, nextTryAt: null, ...(story.status === 'falhou' && story.frames.length ? { status: 'agendado', attempts: 0, error: null } : {}) })

/** Publicar agora: o próximo minuto do cron leva (aprovado ou que não saiu, com as telas prontas). */
export const publishNow = (story: Story) => updateStory(story.id, { publishAt: Date.now(), nextTryAt: null, ...(story.status === 'falhou' ? { status: 'agendado', attempts: 0, error: null } : {}) })

// ---------- quem está rodando ----------

interface RunState {
  running?: { teamId: string; week: number; step: string; startedAt: number }
  /** O story que está sendo refeito. */
  redoing?: string
  last?: { week: number; message: string; at: number; error?: boolean }
}

export const useStoryRun = create<RunState>()(() => ({}))
let controller: AbortController | null = null

/** Monta a semana (ou, com `at`, um story só naquele horário) com o andamento na tela, e um só de cada vez no app. */
export async function runWeek(teamId: string, week: number, quiet = false, at?: number): Promise<WeekResult | undefined> {
  if (useStoryRun.getState().running) {
    if (!quiet) toast.info('A esteira já está montando uma semana.')
    return undefined
  }
  controller = new AbortController()
  useStoryRun.setState({ running: { teamId, week, step: 'Começando', startedAt: Date.now() } })
  try {
    const result = await buildWeek(teamId, week, controller.signal, (step) => useStoryRun.setState((s) => (s.running ? { running: { ...s.running, step } } : s)), at)
    useStoryRun.setState({ last: { week, message: result.message, at: Date.now() } })
    if (!quiet) toast.success(result.message)
    return result
  } catch (error) {
    const message = isAbort(error) ? 'Parou. O que ficou pronto está na pauta; rode de novo para continuar.' : error instanceof Error ? error.message : String(error)
    useStoryRun.setState({ last: { week, message, at: Date.now(), error: !isAbort(error) } })
    if (!quiet) (isAbort(error) ? toast.info : toast.error)(message)
    if (quiet && !isAbort(error)) throw error
    return undefined
  } finally {
    controller = null
    useStoryRun.setState({ running: undefined })
  }
}

export const stopWeek = () => controller?.abort()

/** Refaz um story com o andamento na tela. */
export async function runRedo(story: Story, note: string): Promise<void> {
  if (useStoryRun.getState().redoing) return void toast.info('Já há um story sendo refeito.')
  const local = new AbortController()
  useStoryRun.setState({ redoing: story.id })
  try {
    await redoStory((await getStory(story.id)) ?? story, note, local.signal)
    toast.success('Story refeito: confira e aprove.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    useStoryRun.setState({ redoing: undefined })
  }
}
