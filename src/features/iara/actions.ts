import { supabase } from '@/integrations/supabase/client'
import { useCrm } from '@/features/crm/crmStore'
import { createContent, deleteContent, linkContent, listContents, listLinks, loadContent, loadContext, saveContent, transitionContent } from '@/features/conteudos/api'
import { CONTENT_FORMATS, STATUS_LABEL, type Content, type ContentFormat } from '@/features/conteudos/rules'
import { setHash, setPath } from '@/features/conteudos/forward'
import { scheduleContent } from '@/features/pauta/api'
import { CHANNELS, STAGE_LABEL, channelOfFormat, stageOf } from '@/features/pauta/rules'
import { listSets, loadSet, saveSet, uploadAsset } from '@/features/criativos/storage'
import { uid, type CreativeSet, type ImageLayer, type Post, type SetAsset, type SetSummary } from '@/features/criativos/types'
import type { ExplainerBeat } from '@/features/criativos/explicativo/types'
import { withIa } from '@/features/ia/porTarefa'
import { useChat } from '@/features/space/chat/chatStore'
import { useCreativeLink } from '@/features/criativos/link'
import { attachmentFiles, reportStep, useIara, type IaraAction, type IaraDone } from './store'
import { useEditor } from '@/features/criativos/store'
import type { ResolvedRef } from '@/features/criativos/references'
import { TOOL_ACTIONS } from './toolActions'
import { INSTAGRAM_ACTIONS } from './instagramActions'
import { agentBegin, agentEnd, agentPhase, applyInEditor, editorHas, followOn, goTo, liveSet, openInEditor } from './follow'

/**
 * O que a Iara sabe fazer. Uma lista só, usada nos dois modos:
 *   - agente (Claude Code pelo conector, `iara.mjs <ação> '<json>'` → ponte → `runIaraAction`), que
 *     encadeia ações, lê os resultados e continua;
 *   - resposta única (conector antigo), onde a IA devolve as ações de uma vez.
 * Ações que leem devolvem `data` (e `images` para os slides): o agente vê e decide o passo seguinte.
 */

export interface IaraResult {
  done: IaraDone[]
  /** Para o agente ler (JSON). */
  data?: unknown
  /** Imagens (data URL JPEG) que o agente pode olhar. */
  images?: { name: string; data: string }[]
}

type Full = IaraAction & { exec?: (args: Record<string, unknown>) => Promise<IaraResult> }

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
const time = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : undefined)
const channel = (v: unknown) => (typeof v === 'string' && CHANNELS.some((c) => c.id === v) ? v : undefined)
const format = (v: unknown): ContentFormat | undefined => (typeof v === 'string' && CONTENT_FORMATS.some((f) => f.id === v) ? (v as ContentFormat) : undefined)
export const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 40) : typeof v === 'string' ? [v] : [])
const clip = (s: string | undefined, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

const team = () => {
  const t = useCrm.getState().team
  if (!t) throw new Error('Esta aba não tem uma conta de empresa aberta: entre na conta nela (ou recarregue a página) e peça de novo.')
  return t
}

/** Os conteúdos que a Iara viu na última leitura (para saber o que é aprovado). */
export const known = new Map<string, Content>()

const fresh = async (id: string): Promise<Content> => {
  const c = await loadContent(id)
  if (!c) throw new Error(`Conteúdo não encontrado: ${id}`)
  known.set(c.id, c)
  return c
}

export const titleOf = async (id: string) => (await loadContent(id).catch(() => null))?.title ?? id

const one = (d: IaraDone | IaraDone[]): IaraResult => ({ done: Array.isArray(d) ? d : [d] })

// ---------- agentes desta máquina (troca de bastão) ----------

/**
 * O agente escolhido no chat (Claude Code ou Codex) é quem faz tudo, sem perguntar (2026-11-05, o usuário: "se eu chamar
 * um chat com o Codex selecionado, deve apenas usar o Codex… a não ser que veja que seja uma tarefa melhor com outra LLM").
 * Só vira troca de bastão, com cartão para a pessoa decidir, quando a Iara pede outro agente de propósito (`agente` + `motivo`).
 */
export const chatAgent = (): 'claude' | 'codex' => {
  const a = useChat.getState().agent as string
  return a === 'codex' || a === 'claude' ? a : 'claude'
}
const AGENT_NAMES: Record<string, string> = { claude: 'Claude Code', codex: 'Codex' }
export const agentName = (id?: string) => (id ? (AGENT_NAMES[id] ?? id) : 'Iara')
export const AGENT_COLORS: Record<string, string> = { claude: '#D97757', codex: '#10A37F' }

/** Os agentes conectados nesta máquina agora. */
export const localAgents = () => useCreativeLink.getState().agents.filter((a) => a.available).map((a) => a.id as string)

const validAgent = (v: unknown) => (typeof v === 'string' && localAgents().includes(v) ? (v as 'claude' | 'codex') : undefined)

/** Quem faz os criativos: o agente pedido de propósito, senão o escolhido no chat. */
export const creativeAgent = (a: Record<string, unknown>) => validAgent(a.agente) ?? chatAgent()

/** Troca de bastão só quando a Iara pediu outro agente que não o do chat. */
const handoffOf = (a: Record<string, unknown>) => {
  const who = creativeAgent(a)
  return who !== chatAgent() ? who : undefined
}

/** O conjunto de Criativos ligado ao conteúdo. */
async function setOf(contentId: string): Promise<{ content: Content; set: CreativeSet; projectId?: string }> {
  const content = await fresh(contentId)
  const link = (await listLinks(content.id)).find((l) => l.kind === 'criativos')
  if (!link) throw new Error(`"${content.title}" ainda não tem criativo. Use produzir_criativo primeiro.`)
  const set = await loadSet(link.artifactId, link.projectId)
  if (!set) throw new Error('Não consegui abrir o criativo deste conteúdo.')
  return { content, set, projectId: link.projectId }
}

// ---------- conjuntos da conta (qualquer conjunto, não só os ligados a um conteúdo) ----------

let setsCache: { at: number; team: string; list: SetSummary[] } | undefined

/** Os conjuntos da conta aberta: os pessoais e os dos projetos dela. */
async function accountSets(): Promise<SetSummary[]> {
  const t = team()
  if (setsCache && setsCache.team === t.id && Date.now() - setsCache.at < 60_000) return setsCache.list
  const q = supabase.from('space_projects').select('id')
  const { data } = await (t.isHome ? q.or(`team_id.eq.${t.id},team_id.is.null`) : q.eq('team_id', t.id))
  const list = await listSets(((data ?? []) as { id: string }[]).map((p) => p.id))
  setsCache = { at: Date.now(), team: t.id, list }
  return list
}

/** Um conjunto pelo id ou pelo nome (ou parte dele). */
async function findSet(ref: string): Promise<SetSummary> {
  const list = await accountSets()
  const lower = ref.trim().toLowerCase()
  const hit = list.find((x) => x.id === ref) ?? list.find((x) => x.name.toLowerCase() === lower) ?? list.filter((x) => x.name.toLowerCase().includes(lower))[0]
  if (!hit) throw new Error(`Conjunto não encontrado: "${ref}". Use listar_conjuntos.`)
  return hit
}

interface Target {
  set: CreativeSet
  content?: Content
  projectId?: string
  title: string
  open: string
}

/** O criativo de que o pedido fala: um conjunto ({"conjunto"}) ou o de um conteúdo ({"id"}). */
async function target(a: Record<string, unknown>): Promise<Target> {
  if (typeof a.conjunto === 'string' && a.conjunto.trim()) {
    const sum = await findSet(a.conjunto)
    const loaded = await loadSet(sum.id, sum.projectId)
    if (!loaded) throw new Error('Não consegui abrir esse conjunto.')
    const set = liveSet(loaded)
    return { set, projectId: sum.projectId, title: set.name, open: `/criativos/${set.id}${sum.projectId ? `?projeto=${sum.projectId}` : ''}` }
  }
  if (a.id) {
    const { content, set, projectId } = await setOf(String(a.id))
    return { set: liveSet(set), content, projectId, title: content.title, open: setPath(content, projectId) }
  }
  // Sem conjunto nem conteúdo: o que está aberto no editor desta aba (o "este post" da pessoa)
  const ed = useEditor.getState()
  if (ed.status === 'ready' && ed.set) {
    const projectId = new URLSearchParams(window.location.search).get('projeto') ?? undefined
    return { set: ed.set, projectId, title: ed.set.name, open: `/criativos/${ed.set.id}${projectId ? `?projeto=${projectId}` : ''}` }
  }
  throw new Error('Diga o conjunto ("conjunto") ou o conteúdo ("id"): não há criativo aberto no editor.')
}

/**
 * Grava o conjunto e mantém o vínculo com o conteúdo em dia. Com o editor aberto nele (modo
 * Acompanhar), a mudança entra pelo editor: aparece na hora, desfazível e ao vivo para os outros.
 */
async function persist(t: Target, next: CreativeSet, touchedSlides: string[] = [], selectPostId?: string) {
  if (!applyInEditor(next, touchedSlides, selectPostId)) await saveSet(next)
  t.set = next
  setsCache = undefined
  if (t.content) await linkContent(t.content.id, 'criativos', next.id, t.projectId, await setHash(next)).catch(() => undefined)
}

/** Abre o conjunto no editor (modo Acompanhar) e relê o que está nele, para trabalhar sobre o mais novo. */
async function follow(t: Target, postId?: string) {
  if (await openInEditor(t.set.id, t.projectId, postId)) t.set = liveSet(t.set)
}

/** Os slides que mudaram de um post para outro (para piscar no canvas). */
const changedSlides = (before: Post | undefined, after: Post | undefined) =>
  (after?.slides ?? []).filter((sl) => JSON.stringify(sl) !== JSON.stringify(before?.slides.find((x) => x.id === sl.id))).map((sl) => sl.id)

/** O que o orquestrador precisa de um conjunto: montar, corrigir, ver e decidir um post. */
export interface CreativeTarget {
  set: CreativeSet
  open: string
  compose: (ask: string, files: { name: string; data: string }[], exemplo?: number) => Promise<Post | undefined>
  fix: (post: Post, ask: string) => Promise<Post | undefined>
  previews: (post: Post, side: number) => Promise<string[]>
}

/** Sobe imagens prontas (data URL) ao conjunto como assets, para o designer usar nos slides. */
async function uploadFiles(set: CreativeSet, files: { name: string; data: string }[]) {
  let next = set
  const list: { name: string; src: string; data: string }[] = []
  for (const f of files.slice(0, 8)) {
    const blob = await (await fetch(f.data)).blob()
    const asset = await uploadAsset(next, blob, f.name)
    next = { ...next, assets: [...next.assets, asset] }
    list.push({ name: f.name, src: `asset:${asset.id}`, data: f.data })
  }
  return { set: next, list }
}

export async function creativeTarget(a: Record<string, unknown>): Promise<CreativeTarget> {
  const t = await target(a)
  await follow(t)
  const who = chatAgent()
  const current = (id: string) => t.set.posts.find((p) => p.id === id)
  return {
    get set() {
      return t.set
    },
    open: t.open,
    compose: (ask, files, exemplo) =>
      withIa(who, async () => {
        const up = await uploadFiles(t.set, files)
        if (exemplo) {
          const example = pickPost(up.set, exemplo)
          const clone = clonePost(example, `${example.name} · ${new Date().toLocaleDateString('pt-BR')}`)
          const at = up.set.posts.findIndex((p) => p.id === example.id) + 1
          const withClone = { ...up.set, posts: [...up.set.posts.slice(0, at), clone, ...up.set.posts.slice(at)] }
          await persist(t, withClone, [], clone.id)
          const { next } = await designEdit(withClone, clone, ask, { agent: who, attachments: up.list })
          const done = next.posts.find((p) => p.id === clone.id)
          await persist(t, next, done?.slides.map((sl) => sl.id) ?? [], clone.id)
          return done
        }
        const base = up.set.posts[0]
        if (!base) throw new Error('O conjunto está vazio: crie um post nele antes.')
        const before = new Set(up.set.posts.map((p) => p.id))
        const { next } = await designEdit(up.set, base, ask, { agent: who, scope: 'set', attachments: up.list })
        const created = next.posts.find((p) => !before.has(p.id))
        await persist(t, next, created?.slides.map((sl) => sl.id) ?? [], created?.id)
        return created
      }),
    fix: (post, ask) =>
      withIa(who, async () => {
        const base = current(post.id) ?? post
        const { next } = await designEdit(t.set, base, `Corrija este post sem mudar o que já está bom: ${ask}`, { agent: who })
        const after = next.posts.find((p) => p.id === post.id)
        await persist(t, next, changedSlides(base, after), post.id)
        return after
      }),
    previews: async (post, side) => (await previews(t.set, current(post.id) ?? post, side)).map((i) => i.data),
  }
}

/** A decisão da pessoa sobre o post montado pela equipe. */
export async function decidePost(setId: string, postId: string, decision: 'aprovar' | 'descartar') {
  const t = await target({ conjunto: setId })
  const next =
    decision === 'aprovar'
      ? { ...t.set, posts: t.set.posts.map((p) => (p.id === postId ? { ...p, approved: true } : p)), updatedAt: Date.now() }
      : { ...t.set, posts: t.set.posts.filter((p) => p.id !== postId), updatedAt: Date.now() }
  await persist(t, next, [], decision === 'aprovar' ? postId : undefined)
}

/** Um post igual ao exemplo, com ids novos (post e slides; as camadas mantêm os ids dentro do slide). */
/**
 * Post novo no padrão de um exemplo, sem ser o exemplo com outro texto (2026-11-07, o usuário: "pegou o
 * modelo correto mas somente mudou o texto, queria que criasse mesmo algo legal com essa base"). O que
 * fica é a linguagem (marca, tipografia, fundo, logo, rodapé e o padrão de post do Cérebro, que já vai na
 * skill do designer); o que muda é a ideia visual, a composição e a foto. Cada post de um mesmo pedido
 * puxa uma direção diferente.
 */
const VARIATIONS = [
  'close dramático num detalhe do produto (textura, reflexo, borda), cortado pela moldura, com o título grande ocupando o espaço que sobra',
  'o produto em uso, numa cena real do dia a dia do cliente (contexto, ambiente, mãos ou pessoa), foto de ponta a ponta com véu para o texto',
  'composição tipográfica: o título domina o slide e o produto entra menor, deslocado para um canto, criando tensão',
  'antes e depois ou comparação em dois blocos lado a lado (ou em cima e embaixo), com rótulos curtos',
  'produto em ângulo diferente (de cima, de lado ou de baixo) com luz lateral forte e sombra marcada, fundo escuro com textura',
  'benefícios em destaque: produto de um lado e 3 itens curtos com ícone do outro, como uma ficha técnica bonita',
]

function variationMessage(example: string, pedido: string, direction: string, canGenerate: boolean): string {
  return `Crie um post NOVO para este tema: ${pedido}

Ele parte de uma cópia do post de exemplo "${example}", mas NÃO é para trocar só o texto. Pense como diretor de arte de agência fazendo a próxima peça da mesma campanha.

Mantenha (a linguagem da marca): as cores e fontes da marca, o tratamento do título (família, peso, caixa, a palavra de destaque na cor de acento), o tipo de fundo e textura, o logo no mesmo lugar e tamanho, o rodapé (site e WhatsApp) e as regras do padrão de post da conta.

Mude (a peça): a ideia visual e a composição. Direção para este post: ${direction}.
- Reposicione, redimensione, acrescente ou tire camadas à vontade: o título pode ir para outro lugar e ter outra quebra; pode entrar um selo, um número, uma lista curta, uma forma ou uma linha de destaque.
- A foto principal tem de ser outra e servir à direção acima. ${canGenerate ? 'Gere uma foto nova (camada de imagem com "prompt"): descreva a cena em detalhe (assunto, enquadramento, ângulo, luz, ambiente, fundo), foto realista de produto, sem texto nem logo na imagem, no mesmo clima de luz e cor do exemplo. Se o produto for uma película ou peça aplicada, ela tem de estar assentada na superfície, nunca flutuando.' : 'Não há gerador de fotos conectado: reaproveite as fotos do conjunto, mas com outro recorte, escala e posição, para a composição ficar claramente diferente.'}
- O resultado tem de parecer da mesma série e, ao mesmo tempo, uma peça diferente do exemplo à primeira vista. Se ficar igual ao exemplo com outro texto, está errado.
- Textos curtos, com hierarquia clara, dentro das margens e longe das bordas. Escreva também a legenda do post.`
}

const clonePost = (post: Post, name: string): Post => {
  const copy = JSON.parse(JSON.stringify(post)) as Post
  return { ...copy, id: uid(), name, slides: copy.slides.map((sl) => ({ ...sl, id: uid() })) }
}

/** Sobe as imagens anexadas no chat ao conjunto (viram assets) para o designer ver e poder usar num slide. */
async function attachmentsFor(set: CreativeSet, refs: unknown): Promise<{ set: CreativeSet; list: { name: string; src: string; data: string }[] }> {
  const wanted = (Array.isArray(refs) ? refs : typeof refs === 'string' ? [refs] : []).map(String).slice(0, 6)
  let next = set
  const list: { name: string; src: string; data: string }[] = []
  for (const ref of wanted) {
    const file = attachmentFiles.get(ref)
    if (!file) throw new Error(`Não achei o ${ref}: a imagem vale só nesta aba; peça para anexar de novo.`)
    const blob = await (await fetch(file.data)).blob()
    const asset = await uploadAsset(next, blob, file.name.includes('.') ? file.name : `${file.name}.jpg`)
    next = { ...next, assets: [...next.assets, asset] }
    list.push({ name: file.name, src: `asset:${asset.id}`, data: file.data })
  }
  return { set: next, list }
}

/** Uma edição pelo designer do app (a mesma IA do chat do editor), com o padrão do conjunto. */
async function designEdit(
  set: CreativeSet,
  post: Post,
  message: string,
  opts: { agent: 'claude' | 'codex'; slide?: Post['slides'][number]; scope?: 'layer' | 'slide' | 'post' | 'set'; layerIds?: string[]; attachments?: { name: string; src: string; data: string }[]; references?: ResolvedRef[] }
) {
  const [{ requestEdit }, { applyOps }, { creativeImages }, { fillSetImages }] = await Promise.all([
    import('@/features/criativos/ai'),
    import('@/features/criativos/applyOps'),
    import('@/features/crm/instagram'),
    import('@/features/criativos/generate'),
  ])
  // Referências de página sobem fotos e a captura ao conjunto aberto no editor: entram aqui também
  if (editorHas(set.id)) {
    const extra = (useEditor.getState().set?.assets ?? []).filter((x) => !set.assets.some((y) => y.id === x.id))
    if (extra.length) set = { ...set, assets: [...set.assets, ...extra] }
  }
  const images = await creativeImages(set, post.slides)
  const fonts = [...new Set([set.brand.headingFont, set.brand.bodyFont, 'Inter', 'Inter Tight', 'Geist', 'Playfair Display', 'DM Sans', 'Manrope', 'Montserrat', 'Space Grotesk', 'Fraunces', 'Archivo'])]
  const layers = opts.layerIds?.length ? opts.layerIds : undefined
  const scope = opts.scope ?? (layers ? 'layer' : opts.slide ? 'slide' : 'post')
  const layerId = scope === 'layer' ? layers?.at(-1) : undefined
  const answer = await requestEdit(
    {
      message,
      scope,
      set,
      postId: post.id,
      slideId: opts.slide?.id ?? post.slides[0]?.id,
      layerId,
      layerIds: scope === 'layer' && layers && layers.length > 1 ? layers : undefined,
      images,
      history: [],
      agent: opts.agent,
      attachments: opts.attachments,
      references: opts.references?.length ? opts.references : undefined,
      canGenerateImages: !!useCreativeLink.getState().images,
    },
    fonts
  )
  const result = applyOps(set, answer.ops, { postId: post.id, slideId: opts.slide?.id ?? post.slides[0]?.id, layerId })
  let next = { ...result.set, updatedAt: Date.now() }
  if (result.toGenerate.length && useCreativeLink.getState().providers.length) {
    reportStep('Gerando as fotos')
    const touched = [...new Set(next.posts.filter((p) => !set.posts.some((o) => o.id === p.id) || p.id === post.id).map((p) => p.id))]
    next = (await fillSetImages(next, touched, { signal: AbortSignal.timeout(300_000) }).catch(() => ({ set: next }))).set
  }
  return { next, answer, result }
}

/** O post pelo número; sem número, o escolhido no editor (quando é este conjunto), senão o primeiro. */
/**
 * As referências do pedido (o @ do editor, pela Iara): posts de qualquer conjunto da conta, com a
 * imagem de cada slide, e os cases da Avence com as capas. O designer vê tudo junto com o pedido,
 * sem abrir arquivo nem baixar nada (2026-11-05: o Codex tentava abrir as capturas e era barrado).
 */
/** Um projeto do Space da conta pelo id ou pelo nome (ou parte dele). */
async function findProject(ref: string): Promise<{ id: string; name: string }> {
  const t = team()
  const q = supabase.from('space_projects').select('id, name')
  const { data } = await (t.isHome ? q.or(`team_id.eq.${t.id},team_id.is.null`) : q.eq('team_id', t.id))
  const list = (data ?? []) as { id: string; name: string }[]
  const lower = ref.trim().toLowerCase()
  const hit = list.find((p) => p.id === ref) ?? list.find((p) => p.name.toLowerCase() === lower) ?? list.find((p) => p.name.toLowerCase().includes(lower))
  if (!hit) throw new Error(`Projeto não encontrado: "${ref}". Projetos: ${list.slice(0, 20).map((p) => p.name).join(', ')}.`)
  return hit
}

async function referencesFor(base: CreativeSet, raw: unknown): Promise<ResolvedRef[]> {
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).slice(0, 6) as Record<string, unknown>[]
  if (!list.length) return []
  const [{ resolveRefs }, { creativeImages }, { slidePreview }] = await Promise.all([import('@/features/criativos/references'), import('@/features/crm/instagram'), import('@/features/criativos/ai')])
  const out: ResolvedRef[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.case === 'string') {
      const slug = /^(todos|\*)$/i.test(item.case) ? '*' : item.case
      const { refs } = await resolveRefs([{ id: uid(), kind: 'case', label: slug === '*' ? 'Cases' : `Case ${slug}`, slug }], base, new Map(), () => undefined)
      out.push(...refs)
      continue
    }
    // Uma página (ou o projeto inteiro) do Space: textos, fotos e a captura da página, como o @ de projeto do editor
    if (typeof item.projeto === 'string' && item.projeto.trim()) {
      const project = await findProject(item.projeto)
      let pageId: string | undefined
      let label = project.name
      if (typeof item.pagina === 'string' && item.pagina.trim()) {
        const { loadProjectDoc } = await import('@/features/projects/storage')
        const pages = (await loadProjectDoc(project.id))?.doc?.canvas.pages ?? []
        const want = item.pagina.trim().toLowerCase()
        const page = pages.find((pg) => pg.name.toLowerCase() === want) ?? pages.find((pg) => pg.name.toLowerCase().includes(want))
        if (!page) throw new Error(`Página "${item.pagina}" não encontrada no projeto ${project.name}. Páginas: ${pages.map((pg) => pg.name).join(', ')}.`)
        pageId = page.id
        label = `${project.name} › ${page.name}`
        // A captura e as fotos da página entram no conjunto aberto no editor: abre o de destino antes
        if (!(await openInEditor(base.id)) && !editorHas(base.id)) throw new Error('Para trazer uma página, o conjunto de destino precisa estar aberto no editor: ligue o Acompanhar ou abra o conjunto.')
      }
      const { refs } = await resolveRefs([{ id: uid(), kind: 'project', label, projectId: project.id, pageId }], base, useEditor.getState().images, () => project.name)
      out.push(...refs)
      continue
    }
    try {
      let set = base
      if (typeof item.conjunto === 'string' && item.conjunto.trim()) {
        const sum = await findSet(item.conjunto)
        set = (await loadSet(sum.id, sum.projectId)) ?? base
      }
      const ref = item.post
      const n = typeof ref === 'number' ? ref : Number(ref)
      const post = Number.isFinite(n) && n >= 1 ? set.posts[n - 1] : set.posts.find((p) => typeof ref === 'string' && p.name.toLowerCase().includes(ref.trim().toLowerCase()))
      if (!post) continue
      const images = await creativeImages(set, post.slides.slice(0, 8))
      out.push({
        kind: 'post',
        label: `${post.name} (${set.name})`,
        text: `Referência: post "${post.name}" do conjunto "${set.name}" (formato ${post.format}), com os slides em ordem como imagem. Textos: ${JSON.stringify(slideTexts(post)).slice(0, 3000)}`,
        images: post.slides.slice(0, 8).map((sl) => slidePreview(sl, post.format, images, 420)),
      })
    } catch {
      // referência que não abriu: segue sem ela
    }
  }
  return out
}

/** O que está escolhido no editor, em palavras ("Título · slide 2 · post Capa"). */
export function selectionLabel(): string {
  const ed = useEditor.getState()
  if (ed.status !== 'ready' || !ed.set) return ''
  const post = ed.set.posts.find((p) => p.id === ed.postId)
  if (!post) return ''
  const i = post.slides.findIndex((s) => s.id === ed.slideId)
  const slide = post.slides[i]
  const layers = slide && !ed.row ? slide.layers.filter((l) => ed.layerIds.includes(l.id)) : []
  const where = `${i >= 0 && !ed.row ? `slide ${i + 1} · ` : ''}post "${post.name}"`
  if (layers.length > 1) return `${layers.length} componentes · ${where}`
  if (layers.length === 1) return `${layers[0].name || 'componente'} · ${where}`
  return where
}

/** O que está escolhido no editor, quando ele está com este conjunto e este post. */
function editorSelection(setId: string, postId: string): { slide?: Post['slides'][number]; layerIds?: string[] } {
  const ed = useEditor.getState()
  if (ed.set?.id !== setId || ed.postId !== postId || ed.row) return {}
  const post = ed.set.posts.find((p) => p.id === postId)
  const slide = post?.slides.find((s) => s.id === ed.slideId)
  const layerIds = slide ? ed.layerIds.filter((id) => slide.layers.some((l) => l.id === id)) : []
  return { slide, layerIds: layerIds.length ? layerIds : undefined }
}

const pickPost = (set: CreativeSet, ref: unknown): Post => {
  const n = typeof ref === 'number' ? ref : Number(ref)
  const ed = useEditor.getState()
  const selected = ed.set?.id === set.id ? set.posts.find((p) => p.id === ed.postId) : undefined
  const post = Number.isFinite(n) && n >= 1 ? set.posts[n - 1] : (selected ?? set.posts[0])
  if (!post) throw new Error('Esse post não existe no criativo.')
  return post
}

/** Lista do que tem em cada slide (texto das camadas), para o agente saber o que está escrito. */
const slideTexts = (post: Post) =>
  post.slides.map((s, i) => ({
    slide: i + 1,
    textos: s.layers.filter((l) => l.type === 'text').map((l) => clip((l as { text?: string }).text, 200)).filter(Boolean),
    fotos: s.layers.filter((l) => l.type === 'image').length,
  }))

async function previews(set: CreativeSet, post: Post, side = 540): Promise<{ name: string; data: string }[]> {
  const { creativeImages } = await import('@/features/crm/instagram')
  const { slidePreview } = await import('@/features/criativos/ai')
  const images = await creativeImages(set, post.slides)
  return post.slides.slice(0, 10).map((s, i) => ({ name: `slide-${i + 1}.jpg`, data: slidePreview(s, post.format, images, side) }))
}

const CONTENT_ACTIONS: Full[] = [
  {
    name: 'listar_conteudos',
    doc: '{"etapa"?:ETAPA,"busca"?:string} — lista os conteúdos (id, título, etapa, data, roteiro resumido).',
    run: async () => ({ label: 'Li os conteúdos.', ok: true }),
    exec: async (a) => {
      const list = await listContents(team().id)
      known.clear()
      for (const c of list) known.set(c.id, c)
      const q = str(a.busca, 80)?.toLowerCase()
      const rows = list
        .filter((c) => (!a.etapa || stageOf(c) === a.etapa) && (!q || c.title.toLowerCase().includes(q) || c.idea.toLowerCase().includes(q)))
        .slice(0, 120)
        .map((c) => ({ id: c.id, titulo: c.title, etapa: STAGE_LABEL[stageOf(c)], formato: c.format, data: c.editorialDate, hora: c.scheduledTime, canal: c.channel, ideia: clip(c.idea, 200), roteiro: clip(c.script, 300) }))
      return { done: [], data: rows }
    },
  },
  {
    name: 'ler_conteudo',
    doc: '{"id":ID} — o conteúdo inteiro (ideia, objetivo, roteiro completo, etapa, agenda, criativo ligado).',
    run: async () => ({ label: 'Li o conteúdo.', ok: true }),
    exec: async (a) => {
      const c = await fresh(String(a.id))
      const link = (await listLinks(c.id)).find((l) => l.kind === 'criativos')
      return { done: [], data: { ...c, etapa: STAGE_LABEL[stageOf(c)], criativo: link ? { conjunto: link.artifactId, abrir: setPath(c, link.projectId) } : null } }
    },
  },
  {
    name: 'criar_ideias',
    doc: '{"ideias":[{"titulo":string,"ideia":string,"objetivo"?:string,"formato"?:FORMATO,"roteiro"?:string,"data"?:"AAAA-MM-DD","hora"?:"HH:MM","canal"?:CANAL}]} — cria ideias novas (até 20). Com data, já entram na pauta.',
    run: async (a) => {
      const t = team()
      const list = Array.isArray(a.ideias) ? (a.ideias as Record<string, unknown>[]).slice(0, 20) : []
      const out: IaraDone[] = []
      for (const i of list) {
        const title = str(i.titulo, 160)
        if (!title) continue
        try {
          const fmt = format(i.formato) ?? 'post-instagram'
          let c = await createContent(t.id, { title, idea: str(i.ideia) ?? '', goal: str(i.objetivo, 600) ?? '', format: fmt, script: str(i.roteiro, 20000) ?? '', editorialDate: null })
          const d = date(i.data)
          const ch = channel(i.canal) ?? channelOfFormat(fmt) ?? null
          if (d || ch) c = await scheduleContent(c, d ?? null, d ? (time(i.hora) ?? null) : null, ch)
          known.set(c.id, c)
          out.push({ label: `Ideia criada: ${title}`, ok: true, to: `/pauta?peca=${c.id}${c.editorialDate ? `&dia=${c.editorialDate}` : ''}`, ref: c.id })
        } catch (e) {
          out.push({ label: `Não criei "${title}": ${e instanceof Error ? e.message : 'erro'}`, ok: false })
        }
      }
      // Acompanhar: a Pauta mostra as ideias chegando (ao vivo pela Realtime)
      if (out.some((d) => d.ok) && followOn() && !window.location.pathname.startsWith('/pauta')) goTo('/pauta')
      return out.length ? out : { label: 'Nenhuma ideia válida veio na resposta.', ok: false }
    },
  },
  {
    name: 'editar_conteudo',
    doc: '{"id":ID,"titulo"?:string,"ideia"?:string,"objetivo"?:string,"roteiro"?:string,"formato"?:FORMATO} — muda o texto de um conteúdo (o que não vier fica igual). Em conteúdo aprovado pede confirmação (a aprovação cai).',
    risky: (a) => known.get(String(a.id))?.status === 'aprovado',
    label: (a) => `Mudar o texto aprovado de "${known.get(String(a.id))?.title ?? 'um conteúdo'}" (a aprovação cai)`,
    run: async (a) => {
      const c = await fresh(String(a.id))
      const patch: Record<string, unknown> = {}
      if (str(a.titulo, 160)) patch.title = str(a.titulo, 160)
      if (typeof a.ideia === 'string') patch.idea = str(a.ideia)
      if (typeof a.objetivo === 'string') patch.goal = str(a.objetivo, 600)
      if (typeof a.roteiro === 'string') patch.script = str(a.roteiro, 20000)
      if (format(a.formato)) patch.format = format(a.formato)
      const next = await saveContent(c.id, c.version, patch)
      known.set(next.id, next)
      return { label: `${'script' in patch ? 'Roteiro escrito' : 'Texto atualizado'}: ${next.title}${c.status === 'aprovado' && next.status !== 'aprovado' ? ' (a aprovação caiu)' : ''}`, ok: true, to: `/pauta?peca=${c.id}` }
    },
  },
  {
    name: 'agendar',
    doc: '{"id":ID,"data":"AAAA-MM-DD"|null,"hora"?:"HH:MM","canal"?:CANAL} — põe (ou tira, com data null) um conteúdo num dia da pauta.',
    run: async (a) => {
      const c = await fresh(String(a.id))
      const d = a.data === null ? null : (date(a.data) ?? c.editorialDate ?? null)
      const next = await scheduleContent(c, d, d ? (time(a.hora) ?? c.scheduledTime ?? null) : null, channel(a.canal) ?? c.channel ?? null)
      known.set(next.id, next)
      return { label: `${next.title}: ${next.editorialDate ? `${next.editorialDate.split('-').reverse().join('/')}${next.scheduledTime ? ` às ${next.scheduledTime}` : ''}` : 'sem data'}`, ok: true, to: `/pauta?peca=${c.id}${next.editorialDate ? `&dia=${next.editorialDate}` : ''}` }
    },
  },
  {
    name: 'aprovar_ideias',
    doc: '{"ids":[ID]} — aprova ideias (viram conteúdo em produção). Só gestor. Pede confirmação da pessoa.',
    risky: true,
    label: (a) => `Aprovar ${ids(a.ids).length === 1 ? 'a ideia' : `${ids(a.ids).length} ideias`}`,
    run: async (a) => {
      const out: IaraDone[] = []
      for (const id of ids(a.ids)) {
        try {
          const c = await fresh(id)
          if (c.status !== 'ideia') out.push({ label: `${c.title} já não é ideia (${STATUS_LABEL[c.status]}).`, ok: false })
          else out.push({ label: `Ideia aprovada: ${(await transitionContent(c.id, c.version, 'producao')).title}`, ok: true, to: `/pauta?peca=${c.id}` })
        } catch (e) {
          out.push({ label: `${await titleOf(id)}: ${e instanceof Error ? e.message : 'erro'}`, ok: false })
        }
      }
      return out
    },
  },
  {
    name: 'aprovar_conteudos',
    doc: '{"ids":[ID]} — o gestor aprova conteúdos com roteiro (de ideia, produção ou revisão). Só gestor. Pede confirmação da pessoa.',
    risky: true,
    label: (a) => `Aprovar ${ids(a.ids).length === 1 ? 'o conteúdo' : `${ids(a.ids).length} conteúdos`}`,
    run: async (a) => {
      const out: IaraDone[] = []
      for (const id of ids(a.ids)) {
        try {
          let c = await fresh(id)
          if (c.status === 'aprovado') {
            out.push({ label: `${c.title} já estava aprovado.`, ok: true })
            continue
          }
          if (!c.script.trim()) {
            out.push({ label: `${c.title} não tem roteiro: escreva antes de aprovar.`, ok: false })
            continue
          }
          if (c.status === 'ideia') c = await transitionContent(c.id, c.version, 'producao')
          c = await transitionContent(c.id, c.version, 'aprovado')
          out.push({ label: `Aprovado: ${c.title}`, ok: true, to: `/pauta?peca=${c.id}` })
        } catch (e) {
          out.push({ label: `${await titleOf(id)}: ${e instanceof Error ? e.message : 'erro'}`, ok: false })
        }
      }
      return out
    },
  },
  {
    name: 'descartar',
    doc: '{"ids":[ID]} — apaga ideias ou conteúdos não aprovados. Só gestor. Pede confirmação da pessoa.',
    risky: true,
    label: (a) => `Descartar ${ids(a.ids).length === 1 ? '1 conteúdo' : `${ids(a.ids).length} conteúdos`}`,
    run: async (a) => {
      const out: IaraDone[] = []
      for (const id of ids(a.ids)) {
        const title = await titleOf(id)
        try {
          await deleteContent(id)
          out.push({ label: `Descartado: ${title}`, ok: true })
        } catch (e) {
          out.push({ label: `${title}: ${e instanceof Error ? e.message : 'erro'}`, ok: false })
        }
      }
      return out
    },
  },
]

// ---------- criativos ----------

const CREATIVE_ACTIONS: Full[] = [
  {
    name: 'produzir_criativo',
    doc: '{"id":ID,"agente"?:AGENTE} — produz o criativo do conteúdo com o pipeline completo do app: escreve o roteiro se faltar, monta o post na marca da conta, gera as fotos e anima. Feito pelo agente escolhido no chat, sem pedir confirmação. Demora 1 a 4 minutos; quando acabar você recebe o resultado com as imagens.',
    handoff: handoffOf,
    label: (a) => `Produzir o criativo de "${known.get(String(a.id))?.title ?? 'um conteúdo'}"`,
    run: async () => ({ label: 'Criativo produzido.', ok: true }),
    exec: async (a) => {
      const who = creativeAgent(a)
      return withIa(who, async () => {
        const c = await fresh(String(a.id))
        const { produceWithAi, PRODUCE_LABEL } = await import('@/features/conteudos/produce')
        const ctx = await loadContext(team().id).catch(() => null)
        const out = await produceWithAi(c, ctx, undefined, (s) => reportStep(PRODUCE_LABEL[s] ?? s))
        if (followOn()) goTo(out.path)
        const made = await setOf(c.id).catch(() => undefined)
        const post = made?.set.posts[0]
        return {
          done: [{ label: `Criativo pronto: ${c.title}`, ok: true, to: out.path }],
          data: { feito_por: agentName(who), abrir: out.path, slides: post ? slideTexts(post) : [] },
          images: made && post ? await previews(made.set, post) : undefined,
        }
      })
    },
  },
  {
    name: 'criar_video_explicativo',
    doc: '{"tema"?:string,"briefing"?:string,"conjunto"?:string,"estilo"?:"editorial"|"tela-frase"|"palavra-heroi"|"legenda-forte"|"contraste","voz"?:"openai"|"elevenlabs"|"nenhuma","pedido"?:string,"midia"?:boolean,"videos"?:number} — cria um vídeo explicativo (reels 9:16, estúdio do Motion) no design system da marca. Com "tema", pesquisa na web uma curiosidade que prende (ex.: "uma curiosidade da BMW R 1250 GS") e confirma cada fato numa fonte; com "briefing", usa o texto. Junta mídia real (a foto do produto do catálogo da conta que combina com o tema, 2 fotos reais com licença livre e "videos" clipes de 4 s gerados pela OpenAI, padrão 2; "midia": false para nenhuma). Escreve o roteiro, narra com voz de IA (ElevenLabs com voz brasileira se houver chave, a clonada primeiro; senão OpenAI; "nenhuma" para sem voz) e monta as cenas no estilo pedido (padrão: palavra-heroi). Demora 2 a 6 minutos. Nada é publicado: devolve o link do estúdio, as cenas, os fatos com as fontes e a legenda.',
    label: (a) => `Criar vídeo explicativo${a.tema ? ` sobre "${str(a.tema, 60)}"` : ''}`,
    // Leva minutos (pesquisa, roteiro, voz): roda como trabalho na tela, com passos e o botão de parar
    long: true,
    run: async () => ({ label: 'Vídeo explicativo criado.', ok: true }),
    exec: async (a) => {
      const tema = str(a.tema, 200)
      const briefing = str(a.briefing, 4000)
      if (!tema && !briefing) throw new Error('Diga o tema da pesquisa ou o briefing do vídeo.')
      const sum = typeof a.conjunto === 'string' && a.conjunto.trim() ? await findSet(a.conjunto) : (await accountSets())[0]
      if (!sum) throw new Error('A conta não tem conjunto de criativos: crie um nos Criativos (ele guarda a marca e as mídias do vídeo).')
      const base = `/motion/${sum.id}/explica${sum.shared && sum.projectId ? `?projeto=${sum.projectId}` : ''}`
      const withQ = (q: string) => `${base}${base.includes('?') ? '&' : '?'}${q}`
      // O conjunto direto do Storage: a linha de produção grava nele e confere (não depende do editor
      // desta aba, que pode fechar durante os minutos de pesquisa e voz)
      const set = await loadSet(sum.id, sum.projectId)
      if (!set) throw new Error('Não consegui abrir o conjunto do vídeo.')
      const { createBriefingVideo } = await import('@/features/criativos/explicativo/pipeline')
      const { DEFAULT_VOICE } = await import('@/features/criativos/explicativo/VoicePicker')
      const keys = useCreativeLink.getState().keys
      const wantVoice = str(a.voz, 20) ?? (keys.elevenlabs ? 'elevenlabs' : 'openai')
      let voice: import('@/features/criativos/explicativo/narracao').VoiceAI | null = null
      if (wantVoice === 'elevenlabs' && keys.elevenlabs) {
        const { elevenVoicesViaLink } = await import('@/features/criativos/link')
        const list = await elevenVoicesViaLink().catch(() => [])
        // A clonada primeiro; senão uma brasileira já na conta; senão a primeira brasileira da biblioteca
        let pick = list.find((v) => v.category === 'cloned' || v.category === 'professional') ?? list.find((v) => /\(BR\)|brazil|brasil/i.test(`${v.name} ${v.description}`))
        if (!pick) {
          const { brazilVoicesViaLink, addVoiceViaLink } = await import('@/features/criativos/link')
          const br = (await brazilVoicesViaLink().catch(() => []))[0]
          if (br) {
            const added = br.added ? { id: br.id } : await addVoiceViaLink(br.ownerId, br.id, br.name).catch(() => undefined)
            if (added) pick = { id: added.id, name: `${br.name} (BR)`, category: 'generated', description: '' }
          }
        }
        pick = pick ?? list[0]
        if (pick) voice = { ...DEFAULT_VOICE, provider: 'elevenlabs', voice: pick.id, voiceName: pick.name, model: 'eleven_multilingual_v2' }
      }
      if (!voice && wantVoice !== 'nenhuma' && keys.openai) voice = DEFAULT_VOICE
      const looks = ['editorial', 'tela-frase', 'palavra-heroi', 'legenda-forte', 'contraste'] as const
      const look = looks.find((l) => l === a.estilo) ?? 'palavra-heroi'
      const clips = Math.max(0, Math.min(3, Number(a.videos ?? 2) || 0))
      const { scene, research } = await createBriefingVideo(set, { topic: tema, briefText: briefing, brief: str(a.pedido, 600), look, voice, media: a.midia === false ? false : { free: 2, clips } }, (label, state, detail) => reportStep(`${label}${state === 'warn' ? ' (aviso)' : ''}${detail ? ` · ${detail}` : ''}`))
      const open = withQ(`id=${scene.id}`)
      if (followOn()) goTo(open)
      const d = scene.explainer!
      return {
        done: [{ label: `Vídeo pronto: ${scene.name}`, ok: true, to: open }],
        data: {
          abrir: open,
          duracao_s: Math.round(scene.duration),
          estilo: look,
          narracao: d.voiceAI ? `${d.voiceAI.provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'} (${d.voiceAI.voiceName ?? d.voiceAI.voice})` : 'sem voz (texto, trilha e efeitos)',
          cenas: d.beats.map((b) => ({ animacao: b.pattern, tela: b.headline.replace(/\*/g, ''), fala: b.fala })),
          pesquisa: research ? { curiosidade: research.title, gancho: research.hook, fatos: research.facts.map((f) => ({ fato: f.text, fonte: f.source })) } : undefined,
          legenda: d.caption,
          lembrete: 'Nada foi publicado. Confira as fontes e o vídeo no estúdio antes de postar.',
        },
      }
    },
  },
  {
    name: 'video_midias',
    doc: '{"video"?:string,"conjunto"?:string,"midias"?:[{"caminho"?:string,"anexo"?:"anexo-1","cerebro"?:string,"nome"?:string,"descricao"?:string,"cenas"?:number[],"como"?:"cartao"|"foto"}],"tirar"?:number[]} — fotos e vídeos nas cenas de um vídeo explicativo do Motion (Estilo › Fotos e o "Print no cartão" de cada cena). Sem "midias" nem "tirar": lista as cenas (número, animação, texto, mídia ligada) e as mídias do vídeo, para escolher onde vai cada uma. Cada mídia vem de um arquivo desta máquina ("caminho" absoluto: PNG, JPG, WebP, GIF, MP4, MOV ou WebM, até 40 MB; vídeo já cortado no tamanho da cena, que toca em loop e sem som), de um anexo do chat ("anexo"), de uma imagem do cérebro ("cerebro", o caminho que mostrar_imagens devolve) ou de uma mídia que o vídeo já tem ("nome" sozinho). "nome": como a mídia aparece no roteiro (padrão: o nome do arquivo). "cenas": os números das cenas (1 = a primeira) que mostram essa mídia. "como": "cartao" (o print no cartão dos estilos virais; a animação da cena continua por trás) ou "foto" (troca a animação da cena por Foto/vídeo); padrão: cartão nos estilos virais, foto no editorial. "tirar": números de cenas que voltam à animação. "video": o id do vídeo (padrão: o vídeo explicativo aberto na tela; senão o mais recente da conta). Grava no conjunto e confere; nada é publicado.',
    label: (a) => (Array.isArray(a.midias) && a.midias.length ? `Pôr ${a.midias.length} mídia(s) nas cenas do vídeo` : 'Ler as cenas do vídeo'),
    run: async () => ({ label: 'Mídias do vídeo.', ok: true }),
    exec: async (a) => {
      // O vídeo: o pedido, o aberto no estúdio (/motion/<conjunto>/explica?id=<cena>) ou o mais recente da conta
      const here = window.location.pathname.match(/^\/motion\/([^/]+)\/explica/)
      const q = new URLSearchParams(window.location.search)
      const wanted = str(a.video, 80) ?? (here ? q.get('id') ?? undefined : undefined)
      let sum: SetSummary | undefined = typeof a.conjunto === 'string' && a.conjunto.trim() ? await findSet(a.conjunto) : undefined
      const sets = sum ? [sum] : await accountSets()
      if (!sum && here) sum = sets.find((x) => x.id === here[1])
      if (!sum && wanted) sum = sets.find((x) => x.videosInfo?.some((v) => v.id === wanted))
      if (!sum) sum = [...sets].filter((x) => x.videosInfo?.length).sort((x, y) => (y.videosInfo![0].at ?? 0) - (x.videosInfo![0].at ?? 0))[0]
      if (!sum) throw new Error('A conta não tem vídeo explicativo: crie um antes (criar_video_explicativo ou o Motion).')
      const set = await loadSet(sum.id, sum.projectId)
      if (!set) throw new Error('Não consegui abrir o conjunto do vídeo.')
      const videos = (set.scenes ?? []).filter((s) => s.explainer).sort((x, y) => y.updatedAt - x.updatedAt)
      const scene = (wanted && videos.find((s) => s.id === wanted)) || videos[0]
      if (!scene?.explainer) throw new Error(`O conjunto ${set.name} não tem vídeo explicativo${wanted ? ` com o id ${wanted}` : ''}.`)
      const open = `/motion/${set.id}/explica?${set.shared && set.projectId ? `projeto=${set.projectId}&` : ''}id=${scene.id}`
      const viral = !!scene.explainer.look && scene.explainer.look !== 'editorial'
      const describe = (d: NonNullable<typeof scene.explainer>) => ({
        video: scene.id,
        nome: scene.name,
        estilo: d.look ?? 'editorial',
        abrir: open,
        cenas: d.beats.map((b, i) => ({ cena: i + 1, animacao: b.pattern, tela: b.headline.replace(/\*/g, ''), segundos: `${b.start.toFixed(1)}–${b.end.toFixed(1)}`, midia: b.photo ?? null })),
        midias: d.photos.map((p) => ({ nome: p.name, tipo: p.kind === 'video' ? 'video' : 'imagem', descricao: p.desc })),
      })

      const midias = Array.isArray(a.midias) ? (a.midias as Record<string, unknown>[]).filter((m) => m && typeof m === 'object').slice(0, 20) : []
      const tirar = Array.isArray(a.tirar) ? a.tirar.map(Number).filter((n) => Number.isInteger(n)) : []
      if (!midias.length && !tirar.length) return { done: [], data: describe(scene.explainer) }

      const total = scene.explainer.beats.length
      const sceneNums = (v: unknown) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= total)
      const slugOf = (s: string) => s.replace(/\.[a-z0-9]+$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
      const blobOf = async (dataUrl: string) => (await fetch(dataUrl)).blob()
      const newAssets: SetAsset[] = []
      const photos = [...scene.explainer.photos]
      const links: { name: string; scenes: number[]; foto: boolean }[] = []
      const done: IaraDone[] = []
      for (const m of midias) {
        let file: { blob: Blob; name: string } | undefined
        const arquivo = m.arquivo as { nome?: string; tipo?: string; data?: string } | undefined
        if (arquivo?.data) file = { blob: await blobOf(`data:${arquivo.tipo ?? 'application/octet-stream'};base64,${arquivo.data}`), name: arquivo.nome ?? 'arquivo' }
        else if (typeof m.anexo === 'string') {
          const att = attachmentFiles.get(m.anexo.trim())
          if (!att) { done.push({ label: `Não achei o ${m.anexo} nesta conversa.`, ok: false }); continue }
          file = { blob: await blobOf(att.data), name: att.name }
        } else if (typeof m.cerebro === 'string') {
          const { vault } = await brain()
          const { mediaUrl } = await import('@/features/cerebro/data')
          const p = brainPath(m.cerebro)
          const hit = vault.media.find((x) => x.path === p || x.path.endsWith('/' + p))
          if (!hit) { done.push({ label: `Não achei "${m.cerebro}" no cérebro (use mostrar_imagens).`, ok: false }); continue }
          const res = await fetch(await mediaUrl(hit.path, hit.mtime))
          if (!res.ok) { done.push({ label: `Não consegui baixar "${hit.path}" do cérebro.`, ok: false }); continue }
          file = { blob: await res.blob(), name: hit.path.split('/').pop()! }
        } else if (typeof m.caminho === 'string') {
          // O caminho só vira arquivo pelo servidor da Iara no computador (iara-mcp); aqui ele não chega lido
          done.push({ label: `Não consegui ler ${m.caminho}: mande pelo chat da Iara (o agente lê o arquivo) ou anexe.`, ok: false })
          continue
        }
        let name = str(m.nome, 24)?.replace(/[^\w-]/g, '')
        if (file) {
          const kind = file.blob.type.startsWith('video/') ? 'video' : file.blob.type.startsWith('image/') ? 'image' : undefined
          if (!kind) { done.push({ label: `${file.name} não é imagem nem vídeo.`, ok: false }); continue }
          const asset = await uploadAsset(set, file.blob, file.name)
          newAssets.push(asset)
          name = name || slugOf(file.name) || `midia${photos.length + 1}`
          // Nome livre no roteiro (dois arquivos com o mesmo nome não se confundem)
          let unique = name
          for (let i = 2; photos.some((p) => p.name === unique); i++) unique = `${name.slice(0, 21)}-${i}`
          name = unique
          photos.push({ src: `asset:${asset.id}`, name, kind, desc: str(m.descricao, 200), origin: 'enviado' })
          done.push({ label: `Enviei ${file.name} (${kind === 'video' ? `vídeo${asset.duration ? ` de ${asset.duration.toFixed(1)} s` : ''}` : 'imagem'}) como "${name}"`, ok: true })
        } else if (!name || !photos.some((p) => p.name === name)) {
          done.push({ label: `O vídeo não tem a mídia "${m.nome ?? ''}". Mídias: ${photos.map((p) => p.name).join(', ') || 'nenhuma'}.`, ok: false })
          continue
        }
        const scenesOf = sceneNums(m.cenas ?? m.cena)
        if (scenesOf.length) links.push({ name, scenes: scenesOf, foto: m.como === 'foto' || (m.como !== 'cartao' && !viral) })
      }

      const patchBeats = (beats: ExplainerBeat[]): ExplainerBeat[] =>
        beats.map((b, i) => {
          const n = i + 1
          const link = [...links].reverse().find((l) => l.scenes.includes(n))
          if (link) return { ...b, photo: link.name, ...(link.foto ? { pattern: 'foto' as const } : {}) }
          if (tirar.includes(n)) return { ...b, photo: undefined, ...(b.pattern === 'foto' ? { pattern: 'titulo' as const } : {}) }
          return b
        })
      const { commitToSet } = await import('@/features/criativos/explicativo/pipeline')
      await commitToSet(set, (cur) => ({
        ...cur,
        assets: [...cur.assets, ...newAssets.filter((x) => !cur.assets.some((y) => y.id === x.id))],
        scenes: (cur.scenes ?? []).map((s) => {
          if (s.id !== scene.id || !s.explainer) return s
          const have = new Set(s.explainer.photos.map((p) => p.src))
          return { ...s, explainer: { ...s.explainer, photos: [...s.explainer.photos, ...photos.filter((p) => !have.has(p.src))], beats: patchBeats(s.explainer.beats) }, updatedAt: Date.now() }
        }),
      }))
      for (const l of links) done.push({ label: `Cena${l.scenes.length > 1 ? 's' : ''} ${l.scenes.join(', ')}: "${l.name}" ${l.foto ? 'no lugar da animação (Foto/vídeo)' : 'no cartão'}`, ok: true, to: open })
      if (tirar.length) done.push({ label: `Cena${tirar.length > 1 ? 's' : ''} ${tirar.join(', ')} de volta à animação`, ok: true, to: open })
      const saved = await loadSet(set.id, set.shared ? set.projectId : undefined)
      const after = saved?.scenes?.find((s) => s.id === scene.id)?.explainer
      if (followOn() && !window.location.pathname.startsWith(`/motion/${set.id}/explica`)) goTo(open)
      return { done, data: after ? describe(after) : undefined }
    },
  },
  {
    name: 'listar_conjuntos',
    doc: '{"busca"?:string} — os conjuntos de criativos da conta (id, nome, projeto, quantos posts, quando mudou).',
    run: async () => ({ label: 'Li os conjuntos.', ok: true }),
    exec: async (a) => {
      const q = str(a.busca, 80)?.toLowerCase()
      const list = (await accountSets()).filter((x) => !q || x.name.toLowerCase().includes(q) || (x.projectName ?? '').toLowerCase().includes(q))
      return { done: [], data: list.slice(0, 60).map((x) => ({ conjunto: x.id, nome: x.name, projeto: x.projectName, posts: x.posts, mudou: new Date(x.updatedAt).toLocaleDateString('pt-BR') })) }
    },
  },
  {
    name: 'ver_conjunto',
    doc: '{"conjunto":string} — o conjunto inteiro: cada post (número, nome, formato, slides, textos da capa), as regras do padrão visual aprendidas e a imagem da capa de cada post. Use para entender o estilo antes de criar ou editar.',
    run: async () => ({ label: 'Vi o conjunto.', ok: true }),
    exec: async (a) => {
      const t = await target(a)
      await follow(t)
      const { creativeImages } = await import('@/features/crm/instagram')
      const { slidePreview } = await import('@/features/criativos/ai')
      const posts = t.set.posts.slice(0, 12)
      const imgs = await creativeImages(t.set, posts.map((p) => p.slides[0]).filter(Boolean))
      return {
        done: [],
        data: {
          conjunto: t.set.id,
          nome: t.set.name,
          marca: { nome: t.set.brand.name, titulos: t.set.brand.headingFont, texto: t.set.brand.bodyFont, cores: t.set.brand.colors?.map((c) => c.hex) },
          padrao_aprendido: t.set.styleRules ?? [],
          posts: t.set.posts.map((p, i) => ({ post: i + 1, nome: p.name, formato: p.format, slides: p.slides.length, capa: slideTexts(p)[0]?.textos ?? [], legenda: clip(p.caption, 160) })),
          abrir: t.open,
        },
        images: posts.map((p, i) => ({ name: `post-${i + 1}-capa.jpg`, data: slidePreview(p.slides[0], p.format, imgs, 360) })),
      }
    },
  },
  {
    name: 'ver_criativo',
    doc: '{"conjunto"?:string,"id"?:ID,"post"?:number} — um post inteiro: imagem de cada slide, textos de cada slide e a legenda. Use para revisar o design antes de editar.',
    run: async () => ({ label: 'Vi o criativo.', ok: true }),
    exec: async (a) => {
      const t = await target(a)
      await follow(t, pickPost(t.set, a.post).id)
      const post = pickPost(t.set, a.post)
      return {
        done: [],
        data: { conjunto: t.set.id, nome: t.set.name, padrao_aprendido: t.set.styleRules ?? [], posts: t.set.posts.map((p, i) => ({ post: i + 1, nome: p.name, formato: p.format, slides: p.slides.length })), post: { nome: post.name, formato: post.format, legenda: post.caption ?? '', slides: slideTexts(post) } },
        images: await previews(t.set, post),
      }
    },
  },
  {
    name: 'editar_criativo',
    doc: '{"conjunto"?:string,"id"?:ID,"pedido":string,"post"?:number,"slide"?:number,"escopo"?:"selecao"|"post"|"conjunto","anexos"?:["anexo-1"],"referencias"?:[{"conjunto"?:string,"post":number|string}|{"projeto":string,"pagina"?:string}|{"case":"slug"|"todos"}],"agente"?:AGENTE} — pede ao designer do app para mudar o design de um post. Sem conjunto/post/slide vale o que está aberto e escolhido no editor (o componente ou o slide selecionado; "escopo":"post" para o post inteiro, "conjunto" para criar ou mudar vários posts) (textos, cores, layout, ordem, fotos novas por descrição). Seja específico. Com "referencias", posts de qualquer conjunto da conta e os cases da Avence vão como imagem para o designer ver (é o @ do editor: use quando o pedido citar outro post ou os cases). Com "anexos", as imagens que a pessoa colou vão como referência e podem entrar num slide. O padrão aprendido do conjunto vai junto. Feito pelo agente escolhido no chat, sem pedir confirmação.',
    handoff: handoffOf,
    label: (a) => `Editar ${a.conjunto ? `o conjunto "${a.conjunto}"` : a.id ? `o criativo de "${known.get(String(a.id))?.title ?? 'um conteúdo'}"` : `o criativo aberto${selectionLabel() ? ` (${selectionLabel()})` : ''}`}${a.post ? `, post ${a.post}` : ''}: ${clip(String(a.pedido ?? ''), 140)}`,
    run: async () => ({ label: 'Criativo editado.', ok: true }),
    exec: async (a) =>
      withIa(creativeAgent(a), async () => {
        const t = await target(a)
        await follow(t, pickPost(t.set, a.post).id)
        const post = pickPost(t.set, a.post)
        const n = typeof a.slide === 'number' ? a.slide : Number(a.slide)
        // Sem slide: o que está escolhido no editor (o componente, o slide), a não ser que o pedido seja o post inteiro
        const sel = editorSelection(t.set.id, post.id)
        const wide = a.escopo === 'post' || a.escopo === 'conjunto'
        const slide = Number.isFinite(n) && n >= 1 ? post.slides[n - 1] : wide ? undefined : sel.slide
        const layerIds = !wide && (!Number.isFinite(n) || slide?.id === sel.slide?.id) ? sel.layerIds : undefined
        const pedido = str(a.pedido, 3000)
        if (!pedido) throw new Error('Diga o que mudar no criativo.')
        const who = creativeAgent(a)
        reportStep(`${agentName(who)} editando o criativo`)
        agentBegin(post, `${agentName(who)}: ${clip(pedido, 60)}`, who)
        try {
          agentPhase('thinking')
          const att = await attachmentsFor(t.set, a.anexos)
          const { next, answer, result } = await designEdit(att.set, post, pedido, { agent: who, slide, layerIds, scope: a.escopo === 'conjunto' ? 'set' : a.escopo === 'post' ? 'post' : undefined, attachments: att.list, references: await referencesFor(att.set, a.referencias) })
          agentPhase('applying')
          const after = next.posts.find((p) => p.id === post.id) ?? post
          await persist(t, next, changedSlides(post, after), post.id)
          return {
            done: [{ label: `Criativo editado: ${t.title} (${result.applied} mudanças)`, ok: true, to: t.open }],
            data: { feito_por: agentName(who), designer: answer.reply, mudancas: result.applied, ignoradas: result.skipped, slides: slideTexts(after) },
            images: await previews(next, after),
          }
        } finally {
          agentEnd()
        }
      }),
  },
  {
    name: 'equipe_rapida',
    doc: '{"tarefas":[{"papel":"texto"|"imagem"|"icones"|"layout"|"livre","pedido":string,"slide"?:number}],"conjunto"?:string,"id"?:ID,"post"?:number,"projeto"?:string} — divide o pedido em 2 a 4 tarefas pequenas que rodam AO MESMO TEMPO, cada uma com o seu agente, cursor e cor na tela e um minichat próprio no chat. Use para pedidos com várias partes, para entregar rápido em partes menores. Num criativo (o aberto no editor, ou "conjunto"/"id" + "post"): "texto" reescreve e ajusta os textos, "imagem" gera ou trata a foto principal, "icones" põe ícones (biblioteca de ícones, PNG na cor pedida), "layout" mexe em posição, tamanho, cores e fundo, "livre" faz outra parte. Cada faixa só muda a parte dela (o que uma muda a outra não desfaz). Num projeto de site (o aberto no Space, ou "projeto"): cada tarefa é uma faixa com o próprio agente no canvas; dê a cada uma partes diferentes da página (seções diferentes) e use "livre". Começa na hora; o resultado volta numa nova mensagem.',
    handoff: handoffOf,
    label: (a) => `Equipe rápida: ${Array.isArray(a.tarefas) ? (a.tarefas as { papel?: string }[]).map((t) => t.papel ?? 'tarefa').join(', ') : ''}`,
    run: async () => ({ label: 'Equipe montada.', ok: true }),
  },
  {
    name: 'controlar_trabalho',
    doc: '{"acao":"pausar"|"continuar"|"parar"} — pausa, continua ou para o trabalho longo em andamento na tela (criativos, equipe de agentes). Pausar: o passo que está rodando termina e o próximo espera. Parar: cancela na hora; o que já ficou pronto fica salvo. Use quando a pessoa pedir para pausar, esperar, seguir ou cancelar uma entrega.',
    label: (a) => `${String(a.acao ?? '')} o trabalho`,
    run: async (a) => {
      const { pauseWork, resumeWork, stopWork, useWork } = await import('@/features/ia/work')
      const { running, label } = useWork.getState()
      if (!running) return { label: 'Não há trabalho em andamento para controlar.', ok: false }
      const ok = a.acao === 'parar' ? stopWork() : a.acao === 'continuar' ? resumeWork() : pauseWork()
      const verb = a.acao === 'parar' ? 'Parado' : a.acao === 'continuar' ? 'Seguindo' : 'Pausado'
      return { label: ok ? `${verb}: ${label ?? 'o trabalho'}` : 'Nada mudou (o trabalho já estava assim).', ok }
    },
  },
  {
    name: 'tratar_imagem',
    doc: '{"conjunto"?:string,"id"?:ID,"post"?:number,"slide"?:number,"camada"?:number|string,"pedido":string,"recorte"?:boolean,"agente"?:AGENTE} — trata os pixels de uma foto que JÁ está no criativo, mantendo a mesma foto: recortar (tirar o fundo, "recorte":true devolve PNG transparente com bordas limpas), melhorar um recorte mal feito, trocar a cor de um objeto ou do fundo, corrigir luz, nitidez, tirar um elemento, retocar. Sem post/slide/camada vale a imagem escolhida no editor (ou a maior foto do slide escolhido). "camada" = número da imagem no slide (1 = a primeira) ou o nome. A original fica no conjunto (desfazer volta). Use esta ação, não editar_criativo, sempre que o pedido for sobre a própria foto.',
    handoff: handoffOf,
    label: (a) => `${a.recorte ? 'Recortar' : 'Tratar'} a foto${selectionLabel() && !a.post ? ` (${selectionLabel()})` : a.post ? ` do post ${a.post}` : ''}: ${clip(String(a.pedido ?? ''), 140)}`,
    run: async () => ({ label: 'Foto tratada.', ok: true }),
    exec: async (a) => {
      const t = await target(a)
      await follow(t, pickPost(t.set, a.post).id)
      const post = pickPost(t.set, a.post)
      const pedido = str(a.pedido, 2000)
      if (!pedido) throw new Error('Diga o que mudar na foto.')
      const recorte = a.recorte === true
      // Qual imagem: a camada pedida, a escolhida no editor, ou a maior foto do slide
      const n = typeof a.slide === 'number' ? a.slide : Number(a.slide)
      const sel = editorSelection(t.set.id, post.id)
      const slide = (Number.isFinite(n) && n >= 1 ? post.slides[n - 1] : sel.slide) ?? post.slides.find((sl) => sl.layers.some((l) => l.type === 'image' && l.src)) ?? post.slides[0]
      if (!slide) throw new Error('Esse post não tem slides.')
      const photos = slide.layers.filter((l): l is ImageLayer => l.type === 'image' && !!l.src)
      const byArg = typeof a.camada === 'number' || /^\d+$/.test(String(a.camada ?? '')) ? photos[Number(a.camada) - 1] : typeof a.camada === 'string' ? photos.find((l) => (l.name ?? '').toLowerCase().includes(String(a.camada).toLowerCase())) : undefined
      const picked = photos.find((l) => sel.slide?.id === slide.id && sel.layerIds?.includes(l.id))
      const layer = byArg ?? picked ?? [...photos].sort((x, y) => y.w * y.h - x.w * x.h)[0]
      if (!layer) throw new Error(`O slide ${post.slides.indexOf(slide) + 1} não tem foto para tratar.`)

      const { useCreativeLink: link, imageProviderChoice, callAiQuiet } = await import('@/features/criativos/link')
      const providers = link.getState().providers
      if (!providers.length) throw new Error('Nenhum serviço de imagem pronto neste computador: entre no Codex ou guarde uma chave do OpenAI ou do Google em Criativos.')
      // Recorte sai melhor pelo OpenAI (fundo transparente de verdade) quando houver chave
      const provider = recorte && providers.includes('openai') ? 'openai' : imageProviderChoice()

      reportStep('Lendo a foto')
      agentBegin(post, `Tratando a foto: ${clip(pedido, 50)}`, creativeAgent(a))
      try {
        agentPhase('thinking')
        const { creativeImages } = await import('@/features/crm/instagram')
        const img = (await creativeImages(t.set, [{ ...slide, layers: [layer] }])).get(layer.src)
        if (!img) throw new Error('Não consegui abrir a foto original.')
        const k = Math.min(1, 1536 / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * k))
        canvas.height = Math.max(1, Math.round(img.height * k))
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        const source = canvas.toDataURL('image/png')
        const r = canvas.width / canvas.height
        const ratio = r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square'
        reportStep(recorte ? 'Recortando a foto' : 'Tratando a foto')
        const out = await callAiQuiet<{ data: string; model?: string }>('image', { prompt: `${pedido}${recorte ? '\nRemova todo o fundo: só o assunto principal, com bordas precisas.' : ''}`, ratio, provider, references: [source], edit: true, transparent: recorte }, new AbortController().signal)

        // O fundo saiu mesmo transparente? (o serviço pode ignorar o pedido)
        let alpha = false
        if (recorte) {
          const check = new Image()
          check.src = out.data
          await check.decode()
          const c = document.createElement('canvas')
          c.width = 64
          c.height = 64
          const ctx = c.getContext('2d')!
          ctx.drawImage(check, 0, 0, 64, 64)
          const px = ctx.getImageData(0, 0, 64, 64).data
          let clear = 0
          for (let i = 3; i < px.length; i += 4) if (px[i] < 16) clear++
          alpha = clear > 64 * 64 * 0.05
        }

        agentPhase('applying')
        const blob = await (await fetch(out.data)).blob()
        const asset = await uploadAsset(t.set, blob, recorte ? 'foto-recortada.png' : 'foto-tratada.png')
        const next: CreativeSet = {
          ...t.set,
          assets: [...t.set.assets, asset],
          posts: t.set.posts.map((p) =>
            p.id !== post.id
              ? p
              : { ...p, slides: p.slides.map((sl) => (sl.id !== slide.id ? sl : { ...sl, layers: sl.layers.map((l) => (l.id === layer.id ? ({ ...l, src: `asset:${asset.id}`, ...(recorte && alpha ? { fit: 'contain' } : {}) } as ImageLayer) : l)) })) }
          ),
        }
        await persist(t, next, [slide.id], post.id)
        const after = next.posts.find((p) => p.id === post.id) ?? post
        const warn = recorte && !alpha ? ' O serviço de imagens devolveu a foto ainda com fundo (não transparente).' : ''
        return {
          done: [{ label: `Foto ${recorte ? 'recortada' : 'tratada'}: slide ${post.slides.indexOf(slide) + 1} de "${post.name}"${warn}`, ok: !warn, to: t.open }],
          data: { servico: out.model ?? provider, fundo_transparente: recorte ? alpha : undefined, aviso: warn || undefined, original_guardada: true },
          images: [{ name: 'foto-tratada.png', data: out.data }, ...(await previews(next, after)).slice(post.slides.indexOf(slide), post.slides.indexOf(slide) + 1)],
        }
      } finally {
        agentEnd()
      }
    },
  },
  {
    name: 'buscar_icones',
    doc: '{"busca"?:string} — a biblioteca de ícones dos criativos: os 30 ícones da casa (os mesmos do cadastro dos formulários) e o Lucide inteiro (~1.500 ícones de traço). Sem busca devolve os da casa; com busca ("entrega, calendário, whatsapp", português ou inglês) devolve os nomes que combinam. Use antes de inserir_icones quando não souber o nome.',
    run: async () => ({ label: 'Busquei ícones.', ok: true }),
    exec: async (a) => {
      const { FORM_ICONS, searchIcons } = await import('@/features/criativos/icons')
      const busca = str(a.busca, 200) ?? ''
      const found = await searchIcons(busca, 40)
      return { done: [], data: { da_casa: FORM_ICONS, ...(busca ? { busca, encontrados: found } : {}), observacao: 'Os da casa são os mesmos dos formulários; qualquer nome do Lucide funciona em inserir_icones.' } }
    },
  },
  {
    name: 'inserir_icones',
    doc: '{"conjunto"?:string,"id"?:ID,"post"?:number,"slide"?:number,"icones":[{"nome":string,"x":number,"y":number,"tamanho"?:number,"cor"?:"#rrggbb","traco"?:number}]} — põe ícones de traço num slide, cada um como camada de imagem "Ícone <nome>" (PNG na cor pedida; sem cor, a primeira da marca). x/y/tamanho em px do slide (veja o tamanho e as camadas em ver_criativo). Nomes de buscar_icones (os da casa = os dos formulários, ou qualquer um do Lucide). Até 12 por vez. Sem post/slide vale o slide escolhido no editor. Alinhe aos títulos e itens de lista, sem cobrir texto nem foto.',
    label: (a) => `Pôr ${Array.isArray(a.icones) ? a.icones.length : ''} ícone(s) no criativo`,
    run: async () => ({ label: 'Ícones no criativo.', ok: true }),
    exec: async (a) => {
      const { iconPng } = await import('@/features/criativos/icons')
      const t = await target(a)
      await follow(t, pickPost(t.set, a.post).id)
      const post = pickPost(t.set, a.post)
      const n = typeof a.slide === 'number' ? a.slide : Number(a.slide)
      const sel = editorSelection(t.set.id, post.id)
      const slide = (Number.isFinite(n) && n >= 1 ? post.slides[n - 1] : sel.slide) ?? post.slides[0]
      if (!slide) throw new Error('Esse post não tem slides.')
      const list = (Array.isArray(a.icones) ? a.icones : []).slice(0, 12) as { nome?: unknown; x?: unknown; y?: unknown; tamanho?: unknown; cor?: unknown; traco?: unknown }[]
      if (!list.length) throw new Error('Diga quais ícones pôr ("icones":[{"nome","x","y"}]). Os nomes estão em buscar_icones.')
      const brand = t.set.brand.colors[0]?.hex || '#111111'
      reportStep(`Desenhando ${list.length} ícone(s)`)
      const layers: ImageLayer[] = []
      const assets = []
      const missing: string[] = []
      for (const ic of list) {
        const name = String(ic.nome ?? '').trim().toLowerCase()
        const size = Math.max(16, Math.min(600, Number(ic.tamanho) || 72))
        const color = typeof ic.cor === 'string' && /^#[0-9a-f]{6}$/i.test(ic.cor) ? ic.cor : brand
        const stroke = Math.max(0.75, Math.min(3, Number(ic.traco) || 1.75))
        const blob = await iconPng(name, color, size, stroke).catch(() => undefined)
        if (!blob) {
          missing.push(name)
          continue
        }
        const asset = await uploadAsset(t.set, blob, `icone-${name}.png`)
        assets.push(asset)
        layers.push({ id: uid(), type: 'image', name: `Ícone ${name}`, x: Math.round(Number(ic.x) || 0), y: Math.round(Number(ic.y) || 0), w: size, h: size, src: `asset:${asset.id}`, fit: 'contain', radius: 0, frame: 'none' } as ImageLayer)
      }
      if (!layers.length) throw new Error(`Nenhum desses ícones existe: ${missing.join(', ')}. Use buscar_icones.`)
      const next: CreativeSet = {
        ...t.set,
        assets: [...t.set.assets, ...assets],
        posts: t.set.posts.map((p) => (p.id !== post.id ? p : { ...p, slides: p.slides.map((sl) => (sl.id !== slide.id ? sl : { ...sl, layers: [...sl.layers, ...layers] })) })),
      }
      await persist(t, next, [slide.id], post.id)
      const after = next.posts.find((p) => p.id === post.id) ?? post
      const i = post.slides.indexOf(slide)
      return {
        done: [{ label: `${layers.length} ícone(s) no slide ${i + 1} de "${post.name}"${missing.length ? ` (não existem: ${missing.join(', ')})` : ''}`, ok: true, to: t.open }],
        data: { inseridos: layers.map((l) => l.name), nao_encontrados: missing.length ? missing : undefined },
        images: (await previews(next, after)).slice(i, i + 1),
      }
    },
  },
  {
    name: 'criar_parecidos',
    doc: '{"conjunto"?:string,"id"?:ID,"post":number,"pedidos":[string],"modo"?:"variacao"|"fiel","direcoes"?:[string],"referencias"?:[{"conjunto"?:string,"post":number|string}|{"projeto":string,"pagina"?:string}|{"case":"slug"|"todos"}],"agente"?:AGENTE} — cria posts novos a partir de um post de exemplo, logo depois dele no conjunto, um por pedido (o tema do post novo). Com "modo":"variacao" (o normal) cada post é uma peça nova na mesma linguagem do exemplo e do padrão de post do Cérebro (marca, fontes, tratamento do título, fundo, logo, rodapé), mas com outra composição e uma foto nova gerada para o tema; posts do mesmo pedido saem com direções diferentes entre si. Com "modo":"fiel" é a cópia exata com só os textos trocados: use só quando a pessoa pedir para trocar o texto ou manter o layout igual. "direcoes"?:[string] dá a ideia visual de cada post (ex.: "close na tela com reflexo do sol"). Até 6 por vez. Feito pelo agente escolhido no chat.',
    handoff: handoffOf,
    label: (a) => `Criar ${Array.isArray(a.pedidos) ? a.pedidos.length : 1} post(s) ${a.modo === 'fiel' ? 'copiando' : 'novos no padrão d'}o post ${a.post ?? 1}${a.conjunto ? ` de "${a.conjunto}"` : ''}`,
    run: async () => ({ label: 'Posts criados.', ok: true }),
    exec: async (a) =>
      withIa(creativeAgent(a), async () => {
        const t = await target(a)
        const refs = await referencesFor(t.set, a.referencias)
        await follow(t, pickPost(t.set, a.post).id)
        const example = pickPost(t.set, a.post)
        const pedidos = (Array.isArray(a.pedidos) ? a.pedidos : [a.pedidos]).map((x) => str(x, 1500)).filter((x): x is string => !!x).slice(0, 6)
        if (!pedidos.length) throw new Error('Diga o tema de cada post novo em "pedidos".')
        const who = creativeAgent(a)
        const faithful = a.modo === 'fiel'
        const direcoes = (Array.isArray(a.direcoes) ? a.direcoes : []).map((x) => str(x, 400) ?? '')
        const seed = Math.floor(Math.random() * VARIATIONS.length)
        let cur = t.set
        const made: Post[] = []
        try {
          for (const [i, pedido] of pedidos.entries()) {
            reportStep(`${agentName(who)}: post ${i + 1} de ${pedidos.length}${faithful ? '' : ' (peça nova no padrão)'}`)
            const clone = clonePost(example, `${example.name} · ${pedido.split(/[.:\n]/)[0].slice(0, 40)}`)
            const at = cur.posts.findIndex((p) => p.id === example.id) + 1 + made.length
            cur = { ...cur, posts: [...cur.posts.slice(0, at), clone, ...cur.posts.slice(at)] }
            // A cópia aparece na hora no canvas; depois o agente reescreve em cima dela
            await persist(t, cur, [], clone.id)
            agentBegin(clone, `${agentName(who)}: ${clip(pedido, 60)}`, who)
            agentPhase('thinking')
            const message = faithful
              ? `Este post é uma cópia exata do post de exemplo "${example.name}". Mantenha o design igual: a mesma quantidade e ordem de slides, as mesmas camadas nas mesmas posições e tamanhos, as mesmas fontes, cores, pesos e estilo das fotos. Troque só os textos (e a descrição das fotos, quando houver) para este novo post: ${pedido}\nCada texto novo deve ter tamanho parecido com o do exemplo, para caber no mesmo layout. Escreva também a legenda do post.`
              : variationMessage(example.name, pedido, direcoes[i] ?? VARIATIONS[(i + seed) % VARIATIONS.length], !!useCreativeLink.getState().providers.length)
            const { next } = await designEdit(cur, clone, message, { agent: who, scope: 'post', references: refs })
            agentPhase('applying')
            cur = next
            const done = cur.posts.find((p) => p.id === clone.id) ?? clone
            await persist(t, cur, done.slides.map((sl) => sl.id), clone.id)
            made.push(done)
          }
        } finally {
          agentEnd()
        }
        const images = (await Promise.all(made.map((p) => previews(cur, { ...p, slides: p.slides.slice(0, 2) }, 360)))).flat().slice(0, 10)
        return {
          done: [{ label: `${made.length} post(s) ${faithful ? 'copiando' : 'novo(s) no padrão de'} "${example.name}"`, ok: true, to: t.open }],
          data: { feito_por: agentName(who), exemplo: example.name, novos: made.map((p) => ({ post: cur.posts.findIndex((x) => x.id === p.id) + 1, nome: p.name, slides: slideTexts(p) })) },
          images,
        }
      }),
  },
  {
    name: 'aplicar_design',
    doc: '{"de":{"conjunto"?:string,"post":number|string}|{"projeto":string,"pagina":string},"conjunto"?:string,"id"?:ID,"posts"?:[number],"pedido"?:string,"agente"?:AGENTE} — reaplica o design de uma referência (um post de qualquer conjunto da conta, ou uma página de um projeto do Space) em posts de outro conjunto: o designer refaz cada post no layout, na hierarquia, no ritmo e no estilo da referência, mantendo os textos, as fotos e a marca do conjunto de destino. Sem "posts", vale o post escolhido no editor (ou o primeiro). Até 6 posts. Feito pelo agente escolhido no chat.',
    handoff: handoffOf,
    label: (a) => {
      const de = (a.de ?? {}) as Record<string, unknown>
      const from = de.projeto ? `da página ${de.pagina ?? ''} de ${de.projeto}` : `do post ${de.post ?? ''}${de.conjunto ? ` de "${de.conjunto}"` : ''}`
      const n = Array.isArray(a.posts) ? a.posts.length : 1
      return `Reaplicar o design ${from} em ${n} post${n > 1 ? 's' : ''}${a.conjunto ? ` de "${a.conjunto}"` : ' do conjunto aberto'}`
    },
    run: async () => ({ label: 'Design reaplicado.', ok: true }),
    exec: async (a) =>
      withIa(creativeAgent(a), async () => {
        const t = await target(a)
        await follow(t, pickPost(t.set, Array.isArray(a.posts) ? a.posts[0] : undefined).id)
        const refs = await referencesFor(t.set, [a.de])
        if (!refs.length) throw new Error('Não achei a referência: diga {"de":{"conjunto","post"}} ou {"de":{"projeto","pagina"}}.')
        const posts = (Array.isArray(a.posts) && a.posts.length ? a.posts.map((n) => pickPost(t.set, n)) : [pickPost(t.set, undefined)]).slice(0, 6)
        const who = creativeAgent(a)
        const extra = str(a.pedido, 1500)
        let cur = t.set
        const changed: Post[] = []
        try {
          for (const [i, post] of posts.entries()) {
            reportStep(`${agentName(who)}: reaplicando o design no post ${i + 1} de ${posts.length}`)
            agentBegin(post, `${agentName(who)}: design da referência`, who)
            agentPhase('thinking')
            const live = cur.posts.find((p) => p.id === post.id) ?? post
            const message = `Refaça o design deste post inteiro (todos os slides) seguindo a referência marcada: o mesmo layout, a hierarquia, o ritmo entre os slides, o tamanho e o peso dos títulos, o uso de fotos e molduras, as margens e o estilo. Mantenha os textos, as fotos e a marca (cores, fontes e logo) deste conjunto; não copie textos, logo nem cores de outra empresa. Se a referência for uma página, traduza as seções dela para slides deste formato.${extra ? `\nPedido da pessoa: ${extra}` : ''}`
            const { next } = await designEdit(cur, live, message, { agent: who, scope: 'post', references: refs })
            agentPhase('applying')
            const after = next.posts.find((p) => p.id === post.id) ?? live
            await persist(t, next, changedSlides(live, after), post.id)
            cur = next
            changed.push(after)
          }
        } finally {
          agentEnd()
        }
        return {
          done: [{ label: `Design reaplicado em ${changed.length} post${changed.length > 1 ? 's' : ''} de ${t.title}`, ok: true, to: t.open }],
          data: { feito_por: agentName(who), referencia: refs.map((r) => r.label), posts: changed.map((p) => ({ nome: p.name, slides: slideTexts(p) })) },
          images: changed[0] ? await previews(cur, changed[0]) : [],
        }
      }),
  },
  {
    name: 'criar_de_referencia',
    doc: '{"conjunto"?:string,"id"?:ID,"anexo":"anexo-1","pedido":string,"formato"?:"4x5"|"1x1"|"9x16","referencias"?:[{"conjunto"?:string,"post":number|string}|{"projeto":string,"pagina"?:string}|{"case":"slug"|"todos"}],"agente"?:AGENTE} — cria UM post novo no conjunto reproduzindo o layout, a hierarquia e o estilo de uma imagem que a pessoa anexou (um post de outro perfil, um print), na marca do conjunto e com o conteúdo do pedido. Feito pelo agente escolhido no chat.',
    handoff: handoffOf,
    label: (a) => `Criar um post a partir do ${a.anexo ?? 'anexo'}: ${clip(String(a.pedido ?? ''), 120)}`,
    run: async () => ({ label: 'Post criado.', ok: true }),
    exec: async (a) =>
      withIa(creativeAgent(a), async () => {
        const t = await target(a)
        await follow(t)
        const pedido = str(a.pedido, 2000)
        if (!pedido) throw new Error('Diga o conteúdo do post novo.')
        const att = await attachmentsFor(t.set, a.anexo)
        const base = t.set.posts[0]
        if (!base) throw new Error('O conjunto está vazio: crie um post nele antes.')
        const before = new Set(att.set.posts.map((p) => p.id))
        agentBegin(base, `${agentName(creativeAgent(a))}: post da referência`, creativeAgent(a))
        agentPhase('thinking')
        const message = `Crie UM post novo neste conjunto (add_post), formato ${typeof a.formato === 'string' ? a.formato : base.format}, reproduzindo o layout, a hierarquia, as proporções e o estilo da imagem anexada (${att.list[0]?.name}), mas nas cores, fontes e marca deste conjunto. Não copie logos, nomes nem textos de outra empresa. Conteúdo do post: ${pedido}. Escreva a legenda.`
        let next: CreativeSet
        try {
          ;({ next } = await designEdit(att.set, base, message, { agent: creativeAgent(a), scope: 'set', attachments: att.list, references: await referencesFor(att.set, a.referencias) }))
        } finally {
          agentEnd()
        }
        const created = next.posts.filter((p) => !before.has(p.id))
        await persist(t, next, created.flatMap((p) => p.slides.map((sl) => sl.id)), created[0]?.id)
        return {
          done: [{ label: created.length ? `Post novo a partir da referência: ${created[0].name}` : 'O designer não criou o post.', ok: created.length > 0, to: t.open }],
          data: { feito_por: agentName(creativeAgent(a)), novos: created.map((p) => ({ post: next.posts.findIndex((x) => x.id === p.id) + 1, nome: p.name, slides: slideTexts(p) })) },
          images: created[0] ? await previews(next, created[0], 480) : undefined,
        }
      }),
  },
  {
    name: 'aprender_padrao',
    doc: '{"conjunto"?:string,"id"?:ID,"regras":[string],"remover"?:[string]} — grava no conjunto as regras do padrão visual que a pessoa ensinou (frases curtas e gerais, que valem para os próximos posts: "título em no máximo duas linhas", "foto sempre ocupa a metade de cima"). Elas vão em toda edição deste conjunto, no editor e por você.',
    run: async () => ({ label: 'Padrão gravado.', ok: true }),
    exec: async (a) => {
      const t = await target(a)
      const add = (Array.isArray(a.regras) ? a.regras : [a.regras]).map((x) => str(x, 200)).filter((x): x is string => !!x)
      const drop = new Set((Array.isArray(a.remover) ? a.remover : []).map((x) => String(x).trim().toLowerCase()))
      const rules = [...(t.set.styleRules ?? []).filter((r) => !drop.has(r.toLowerCase())), ...add]
      const unique = rules.filter((r, i) => rules.findIndex((x) => x.toLowerCase() === r.toLowerCase()) === i).slice(-30)
      await persist(t, { ...t.set, styleRules: unique, updatedAt: Date.now() })
      return { done: add.map((r) => ({ label: `Aprendi: ${r}`, ok: true })), data: { padrao_aprendido: unique } }
    },
  },
  {
    name: 'legenda',
    doc: '{"conjunto"?:string,"id"?:ID,"post"?:number,"texto":string} — grava a legenda do post (o que vai no Instagram).',
    run: async () => ({ label: 'Legenda gravada.', ok: true }),
    exec: async (a) => {
      const t = await target(a)
      const post = pickPost(t.set, a.post)
      const text = str(a.texto, 2200)
      if (!text) throw new Error('Mande o texto da legenda.')
      await persist(t, { ...t.set, posts: t.set.posts.map((p) => (p.id === post.id ? { ...p, caption: text } : p)), updatedAt: Date.now() })
      return { done: [{ label: `Legenda gravada: ${t.title}`, ok: true, to: t.open }] }
    },
  },
  {
    name: 'orquestrar_criativo',
    doc: '{"conjunto"?:string,"id"?:ID,"briefing":string,"exemplo"?:number,"slides"?:number,"formato"?:"4x5"|"1x1"|"9x16","fotos"?:boolean,"objeto3d"?:string} — monta uma equipe de agentes para um criativo completo: redator (roteiro e legenda), fotos e objeto 3D em paralelo (serviço de imagens), designer (layout na marca, copiando o post "exemplo" quando houver), e um revisor de IA que confere cada parte e manda refazer o que estiver fraco (recorte, nitidez, texto cortado, contraste). A pessoa aprova o post no fim. Use para pedidos de criativo novo e caprichado. A pessoa confirma o início.',
    risky: true,
    label: (a) => `Montar a equipe para: ${clip(String(a.briefing ?? ''), 140)}`,
    run: async () => ({ label: 'Equipe montada.', ok: true }),
  },
  {
    name: 'consultar_agente',
    doc: '{"agente":AGENTE,"pedido":string,"id"?:ID,"post"?:number} — passa uma tarefa de texto ou de olhar a outro agente desta máquina (por exemplo o Codex para roteiro de criativo, conceito visual ou crítica de design). Com "id", ele recebe as imagens dos slides do criativo. Só para um agente diferente do seu, quando ele for claramente melhor nisso: vira um cartão para a pessoa decidir (diga o "motivo"); quando ele responder, você recebe a resposta.',
    handoff: (a) => {
      const who = validAgent(a.agente)
      return who && who !== chatAgent() ? who : undefined
    },
    label: (a) => clip(String(a.pedido ?? ''), 160),
    run: async () => ({ label: 'Agente respondeu.', ok: true }),
    exec: async (a) => {
      const who = validAgent(a.agente)
      if (!who) throw new Error(`Esse agente não está conectado nesta máquina. Conectados: ${localAgents().map(agentName).join(', ') || 'nenhum'}.`)
      const pedido = str(a.pedido, 8000)
      if (!pedido) throw new Error('Diga o que o agente deve fazer.')
      let images: { name: string; data: string }[] = []
      if (a.id) {
        const made = await setOf(String(a.id)).catch(() => undefined)
        if (made) images = await previews(made.set, pickPost(made.set, a.post), 720)
      }
      const { callAiQuiet } = await import('@/features/criativos/link')
      const t = team()
      const ctx = await loadContext(t.id).catch(() => null)
      const system = `Você é ${agentName(who)}, chamado pela Iara (a assistente da plataforma) para uma tarefa da equipe de marketing de ${t.name}. Faça a tarefa com qualidade de agência sênior, específica da empresa, sem fatos inventados. Responda em português do Brasil: \`reply\` com o resultado completo; \`items\` pode ficar vazio.`
      const prompt = `## Empresa\n${t.name}${ctx ? `\nOferta: ${clip(ctx.offer, 700)}\nPúblico: ${clip(ctx.audience, 500)}\nTom: ${clip(ctx.tone, 300)}\nRestrições: ${clip(ctx.restrictions, 400)}` : ''}\n\n## Tarefa\n${pedido}${images.length ? '\n\nAs imagens anexadas são os slides do criativo, em ordem.' : ''}`
      reportStep(`${agentName(who)} trabalhando`)
      const out = await callAiQuiet<{ reply: string; items: { ref: string; text: string }[] }>('agent', { engine: who, system, prompt, images: images.map((i) => i.data) }, undefined, (step, detail) => reportStep(detail || (step === 'reading' ? 'Pesquisando' : step === 'writing' ? 'Escrevendo' : 'Pensando')))
      return { done: [{ label: `${agentName(who)} respondeu`, ok: true }], data: { agente: agentName(who), resposta: out.reply ?? '' } }
    },
  },
]

// ---------- dados ----------

const DATA_ACTIONS: Full[] = [
  {
    name: 'ler_dados',
    doc: '{"fonte":"site"|"anuncios"|"instagram","periodo"?:"hoje"|7|30|90} — números da conta: visitas e contatos do site, campanhas da Meta, perfil e posts do Instagram. Use para basear ideias no que funciona.',
    run: async () => ({ label: 'Li os dados.', ok: true }),
    exec: async (a) => {
      const t = team()
      const fonte = String(a.fonte)
      const per = a.periodo === 'hoje' ? 'hoje' : [7, 30, 90].includes(Number(a.periodo)) ? Number(a.periodo) : 30
      if (fonte === 'site') {
        const { loadTrackers, loadReport } = await import('@/features/crm/site')
        const sites = await loadTrackers(t.id)
        if (!sites.length) return { done: [], data: 'A conta não tem site ligado ao Analytics.' }
        const r = await loadReport(sites[0].id, per as never)
        return { done: [], data: JSON.stringify(r).slice(0, 9000) }
      }
      if (fonte === 'anuncios') {
        const preset = per === 'hoje' ? 'today' : per === 7 ? 'last_7d' : per === 90 ? 'last_90d' : 'last_30d'
        const { data, error } = await supabase.from('crm_ad_reports').select('preset, data, fetched_at').eq('team_id', t.id).eq('preset', preset).order('fetched_at', { ascending: false }).limit(1)
        if (error) throw error
        if (!data?.length) return { done: [], data: 'Sem relatório de anúncios salvo para esse período (abra a aba Anúncios para ler da Meta).' }
        return { done: [], data: JSON.stringify(data[0]).slice(0, 9000) }
      }
      if (fonte === 'instagram') {
        const [acc, media] = await Promise.all([
          supabase.from('crm_instagram_accounts').select('username, name, biography, followers_count, media_count, totals, synced_at').eq('team_id', t.id).limit(1),
          supabase.from('crm_instagram_media').select('media_type, product_type, caption, permalink, posted_at, like_count, comments_count, insights').eq('team_id', t.id).order('posted_at', { ascending: false }).limit(30),
        ])
        if (acc.error) throw acc.error
        if (!acc.data?.length) return { done: [], data: 'A conta não tem Instagram conectado.' }
        const posts = (media.data ?? []).map((m) => ({ ...m, caption: clip(m.caption as string, 220) }))
        return { done: [], data: JSON.stringify({ perfil: acc.data[0], posts }).slice(0, 9000) }
      }
      throw new Error('Fonte desconhecida: use site, anuncios ou instagram.')
    },
  },
]

// ---------- cérebro (base de conhecimento da conta) ----------
// Sempre fechado à empresa ativa (src/features/cerebro/scope.ts): cada conta tem o seu, guardado no app.
// A pasta plataforma/ é montada sozinha (cadastro, Plano, marca, criativos) e não é gravada.

const brain = async () => {
  const { loadScoped } = await import('@/features/cerebro/scope')
  return loadScoped(team())
}
const brainPath = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/^\/+/, '').replace(/^cerebro\//, '') : '')

const BRAIN_ACTIONS: Full[] = [
  {
    name: 'cerebro_ler',
    doc: '{"nota"?:string} — o cérebro (base de conhecimento) da empresa ativa: sem "nota", a lista das notas (caminho, título, data), os arquivos e a visão geral (README.md); com "nota" (caminho, ex. "produtos/README.md" ou "plataforma/marca.md"), o texto inteiro. Quem é a empresa, o que vende, produtos, marca (marca/DESIGN.md), padrões de post (marca/padroes/), Plano, criativos, decisões e logs.',
    run: async () => ({ label: 'Li o cérebro.', ok: true }),
    exec: async (a) => {
      const { vault, scope } = await brain()
      const { titleOf: noteTitle, dateOf } = await import('@/features/cerebro/vault')
      const path = brainPath(a.nota)
      if (path) {
        const note = vault.notes.find((n) => n.path === path) ?? vault.notes.find((n) => n.path === `${path}/README.md`)
        if (!note) return { done: [], data: `Nota não encontrada no cérebro de ${scope.label}: ${path}` }
        return { done: [], data: { nota: note.path, somente_leitura: note.auto ? `montada pela plataforma (${note.auto.label}); mude na tela de origem` : undefined, texto: note.content.slice(0, 20000) } }
      }
      const overview = vault.notes.find((n) => n.path === 'README.md')
      return {
        done: [],
        data: {
          empresa: scope.label,
          notas: vault.notes.map((n) => ({ nota: n.path, titulo: noteTitle(n), data: dateOf(n.path) ?? undefined, plataforma: n.auto ? true : undefined })),
          arquivos: vault.media.filter((m) => !m.url).map((m) => m.path).slice(0, 80),
          visao_geral: overview ? { nota: overview.path, texto: overview.content.slice(0, 6000) } : '(sem README.md: crie a visão geral da empresa com cerebro_escrever)',
        },
      }
    },
  },
  {
    name: 'mostrar_imagens',
    doc: '{"pasta"?:string,"busca"?:string,"arquivo"?:string} — abre na tela da pessoa, ampliadas e na mesma aba, imagens do cérebro da empresa: as fotos das pastas (produtos, fotos, marca/padroes…), as **imagens usadas nos posts** ("plataforma/imagens", uma subpasta por conjunto) e as capas dos posts ("plataforma/criativos"). "pasta" filtra pelo caminho, "busca" pelo nome do arquivo ou do conjunto, "arquivo" abre um só. Use sempre que a pessoa pedir para ver, mostrar ou achar uma imagem. Devolve a lista do que abriu.',
    run: async () => ({ label: 'Mostrei as imagens.', ok: true }),
    exec: async (a) => {
      const { vault } = await brain()
      const { isImage } = await import('@/features/cerebro/vault')
      const { mediaUrl } = await import('@/features/cerebro/data')
      const { openViewer } = await import('@/components/MediaViewer')
      const pasta = brainPath(a.pasta)?.replace(/\/$/, '')
      const busca = str(a.busca, 80)?.toLowerCase()
      const arquivo = brainPath(a.arquivo)
      let list = vault.media.filter((m) => isImage(m.path))
      if (arquivo) list = list.filter((m) => m.path === arquivo || m.path.endsWith('/' + arquivo))
      if (pasta) list = list.filter((m) => m.path.startsWith(pasta + '/'))
      if (busca) list = list.filter((m) => `${m.path} ${m.label ?? ''}`.toLowerCase().includes(busca))
      list = list.slice(0, 60)
      if (!list.length) return { done: [{ label: 'Não achei imagens com esse filtro no cérebro.', ok: false }], data: { pastas: [...new Set(vault.media.map((m) => m.path.split('/').slice(0, -1).join('/')))].slice(0, 60) } }
      openViewer(list.map((m) => ({ name: m.path.split('/').pop()!, src: m.url, resolve: () => mediaUrl(m.path, m.mtime), caption: m.label, href: m.href, hrefLabel: m.href?.startsWith('/criativos') ? 'Abrir no Criativos' : undefined })))
      return {
        done: [{ label: `Abri ${list.length} imagem(ns) na tela`, ok: true, to: `/cerebro?midia=${encodeURIComponent(list[0].path)}` }],
        data: list.map((m) => ({ arquivo: m.path, de: m.label })),
      }
    },
  },
  {
    name: 'cerebro_buscar',
    doc: '{"texto":string} — busca no cérebro da empresa ativa; devolve as notas que falam disso, com um trecho.',
    run: async () => ({ label: 'Busquei no cérebro.', ok: true }),
    exec: async (a) => {
      const { vault } = await brain()
      const { search } = await import('@/features/cerebro/vault')
      return { done: [], data: search(vault, String(a.texto ?? '')).slice(0, 15).map((h) => ({ nota: h.path, titulo: h.title, trecho: h.snippet })) }
    },
  },
  {
    name: 'cerebro_escrever',
    doc: '{"nota":string,"texto":string,"nova"?:boolean} — grava uma nota .md do cérebro da empresa ativa (o texto inteiro em Markdown substitui o anterior; leia antes com cerebro_ler e mantenha o que não muda). "nova": true para criar. Pastas livres (ex. "produtos/linha-x.md"); "plataforma/" é só leitura. Atualize **Atualizado em:** com a data de hoje quando a nota tiver essa linha.',
    label: (a) => `Gravar no cérebro: ${String(a.nota ?? '')}`,
    run: async (a) => {
      const { saveNote } = await import('@/features/cerebro/data')
      const { scope } = await brain()
      const path = brainPath(a.nota)
      const text = typeof a.texto === 'string' ? a.texto : ''
      if (!path.endsWith('.md') || path.includes('..')) return { label: 'Caminho de nota inválido.', ok: false }
      if (!scope.allowed(path)) return { label: `${path} é montada pela plataforma: mude na tela de origem.`, ok: false }
      if (!text.trim()) return { label: 'Faltou o texto da nota.', ok: false }
      await saveNote(team().id, path, text.endsWith('\n') ? text : text + '\n', a.nova === true)
      ;(await import('@/features/cerebro/scope')).forgetBrain()
      return { label: `${a.nova ? 'Criei' : 'Atualizei'} no cérebro: ${path}`, ok: true }
    },
  },
  {
    name: 'salvar_padrao',
    doc: '{"conjunto"?:string,"id"?:ID,"post"?:number,"nome":string,"regras"?:[string],"padrao"?:boolean} — guarda um post dos Criativos como padrão de post no Cérebro da conta (marca/padroes/): a capa vira o exemplo e as "regras" (frases curtas do que se repete: grade, títulos, fotos, cores, ritmo) entram em toda criação e edição de criativo deste formato quando ele for o padrão. "padrao": true (o normal) desmarca o padrão anterior do mesmo formato. Sem "regras", o app lê o post sozinho (as camadas e a imagem de cada slide) e escreve regras concretas; mande "regras" só quando a pessoa ditar.',
    label: (a) => `Salvar como padrão: ${String(a.nome ?? '')}`,
    run: async (a) => {
      const t = await target(a)
      const post = pickPost(t.set, a.post)
      const name = str(a.nome, 80) ?? post.name
      const rules = (Array.isArray(a.regras) ? a.regras : [a.regras]).map((x) => str(x, 200)).filter((x): x is string => !!x)
      const { saveNote, uploadFiles } = await import('@/features/cerebro/data')
      const { PATTERN_DIR, patternNote, withStatus, parsePattern, forgetStandard } = await import('@/features/cerebro/standard')
      const { readSummary } = await import('@/features/criativos/storage')
      const teamId = team().id
      const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'padrao'
      let example: string | undefined
      const cover = (await readSummary(t.set).catch(() => undefined))?.postsInfo?.find((x) => x.id === post.id)?.cover
      if (cover) {
        const { data } = await supabase.storage.from('space-projects').download(cover)
        if (data) example = (await uploadFiles(teamId, PATTERN_DIR, [new File([data], `${slug}.jpg`, { type: 'image/jpeg' })]))[0]?.slice(PATTERN_DIR.length + 1)
      }
      const isDefault = a.padrao !== false
      if (isDefault) {
        const { data } = await supabase.from('crm_knowledge_notes' as never).select('path, content').eq('team_id', teamId).like('path', `${PATTERN_DIR}/%`)
        for (const n of (data ?? []) as { path: string; content: string }[]) {
          const p = parsePattern(n)
          if (p.isDefault && p.format === post.format) await saveNote(teamId, n.path, withStatus(n.content, false))
        }
      }
      const href = `/criativos/${t.set.id}?${t.set.shared && t.set.projectId ? `projeto=${t.set.projectId}&` : ''}post=${post.id}`
      // Sem regras, o app lê o post (camadas e slides) e escreve
      let when: string[] = []
      if (!rules.length) {
        reportStep('Lendo o padrão do post')
        const d = await (await import('@/features/cerebro/patternAi')).draftPattern({ teamId, href, onStep: reportStep })
        rules.push(...d.rules)
        when = d.when
      }
      const path = `${PATTERN_DIR}/${slug}.md`
      await saveNote(teamId, path, patternNote({ name, format: post.format, isDefault, rules, when, example, source: { label: `${t.set.name} · ${post.name}`, href } }))
      forgetStandard()
      ;(await import('@/features/cerebro/scope')).forgetBrain()
      return { label: `${isDefault ? 'Padrão' : 'Padrão alternativo'} salvo no Cérebro: ${name}`, ok: true, to: `/cerebro?nota=${encodeURIComponent(path)}` }
    },
  },
  {
    name: 'cerebro_log',
    doc: '{"titulo":string,"texto":string} — registra no log do cérebro da empresa ativa o que aconteceu hoje (entrega, decisão, aprovação, resultado). "texto" em Markdown com O que aconteceu, O que entregamos, O que aprendemos e Próximo passo.',
    label: (a) => `Registrar no log: ${String(a.titulo ?? '')}`,
    run: async (a) => {
      const { saveNote } = await import('@/features/cerebro/data')
      const title = str(a.titulo, 120)
      if (!title) return { label: 'Faltou o título do log.', ok: false }
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
      const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
      const path = `log/${day}-${slug || 'log'}.md`
      const body = `# ${title}\n\n**Data:** ${day} · **Quem:** Iara\n\n${String(a.texto ?? '').trim()}\n`
      await saveNote(team().id, path, body, true)
      ;(await import('@/features/cerebro/scope')).forgetBrain()
      return { label: `Registrei no log: ${path}`, ok: true }
    },
  },
]

// ---------- sugestões para o time de produto ----------

const KINDS = ['melhoria', 'problema', 'ideia']

const PRODUCT_ACTIONS: Full[] = [
  {
    name: 'sugerir_melhoria',
    doc: '{"titulo":string,"descricao":string,"area"?:string,"tipo"?:"melhoria"|"problema"|"ideia","impacto"?:string,"original":string} — manda ao time de produto da plataforma uma sugestão de melhoria, um problema ou uma ideia de função. Título curto e claro; descrição com o que acontece hoje, o que a pessoa quer e por quê; área = a tela ou parte do produto; original = o que a pessoa disse, como disse. A tela aberta vai junto sozinha. A pessoa confere o texto e confirma.',
    risky: true,
    label: (a) => `Enviar ao time de produto: ${clip(String(a.titulo ?? ''), 120)}`,
    run: async (a) => {
      const title = str(a.titulo, 160)
      if (!title) return { label: 'Faltou o título da sugestão.', ok: false }
      const { createSuggestion } = await import('@/features/sugestoes/api')
      const screen = useIara.getState().screen
      await createSuggestion({
        title,
        description: str(a.descricao, 4000) ?? '',
        area: str(a.area, 120) ?? screen?.title ?? '',
        kind: (KINDS.includes(String(a.tipo)) ? a.tipo : 'melhoria') as 'melhoria' | 'problema' | 'ideia',
        impact: str(a.impacto, 1000) ?? '',
        original: str(a.original, 4000) ?? '',
        teamId: useCrm.getState().team?.id,
        screenPath: `${window.location.pathname}${window.location.search}`.slice(0, 300),
        screenTitle: screen?.title ?? document.title,
        via: 'iara',
      })
      return { label: `Sugestão enviada ao time de produto: ${title}`, ok: true }
    },
  },
  {
    name: 'minhas_sugestoes',
    doc: '{} — as sugestões que esta pessoa já mandou ao time de produto, com o status de cada uma (nova, avaliando, planejada, feita, descartada) e a nota do time.',
    run: async () => ({ label: 'Li as sugestões.', ok: true }),
    exec: async () => {
      const { listSuggestions, STATUS_LABEL: ST } = await import('@/features/sugestoes/api')
      const mine = (await listSuggestions()).slice(0, 40)
      return { done: [], data: mine.map((x) => ({ titulo: x.title, status: ST[x.status], nota_do_time: x.note || undefined, quando: new Date(x.createdAt).toLocaleDateString('pt-BR') })) }
    },
  },
]

// ---------- navegação ----------

const PLACES: Record<string, string> = {
  pauta: '/pauta',
  conteudos: '/conteudos',
  plano: '/plano',
  criativos: '/criativos',
  motion: '/motion',
  textos: '/copy',
  instagram: '/crm/instagram',
  anuncios: '/crm/anuncios',
  site: '/crm/site',
  leads: '/crm',
  whatsapp: '/crm/whatsapp',
  inicio: '/inicio',
  sugestoes: '/sugestoes',
  cerebro: '/cerebro',
  quadros: '/quadros',
  formularios: '/crm/formularios',
  funis: '/crm/funis',
  oportunidades: '/crm',
  clientes: '/crm/clientes',
  projetos: '/',
  sites: '/sites',
  prospeccao: '/prospeccao',
  operacao: '/crm/operacao',
}

let navigateRef: ((to: string) => void) | undefined
export const setIaraNavigate = (fn: (to: string) => void) => {
  navigateRef = fn
}

const NAV_ACTIONS: Full[] = [
  {
    name: 'abrir_tela',
    doc: `{"tela":${Object.keys(PLACES).map((k) => `"${k}"`).join('|')}} ou {"endereco":"/caminho"} — leva a pessoa a outra tela (ou ao endereço de um resultado, como o criativo).`,
    run: async (a) => {
      const to = typeof a.endereco === 'string' && a.endereco.startsWith('/') ? a.endereco : PLACES[String(a.tela)]
      if (!to) return { label: 'Tela desconhecida.', ok: false }
      navigateRef?.(to)
      return { label: `Abri ${String(a.tela ?? to)}.`, ok: true }
    },
  },
]

export const allActions = (): Full[] => [...CONTENT_ACTIONS, ...CREATIVE_ACTIONS, ...DATA_ACTIONS, ...BRAIN_ACTIONS, ...TOOL_ACTIONS, ...INSTAGRAM_ACTIONS, ...PRODUCT_ACTIONS, ...NAV_ACTIONS, ...(useIara.getState().screen?.actions ?? [])]

export const isRisky = (a: IaraAction, args: Record<string, unknown>) => !!a.handoff?.(args) || (typeof a.risky === 'function' ? a.risky(args) : !!a.risky)

/** Executa uma ação (sem conferir se é arriscada: quem chama decide). */
/**
 * A conta desta aba, lida antes de qualquer ação (2026-11-08, sugestão: com a Vizor aberta, ações davam "Abra uma
 * conta de empresa primeiro"). O quadro e outras telas cheias não têm o menu lateral, que lê as contas; se a aba
 * ainda não leu (acabou de abrir, recarregou), a ação espera a leitura em vez de falhar.
 */
async function ensureTeam() {
  const s = useCrm.getState()
  if (s.team) return
  const { data } = await supabase.auth.getUser()
  if (data.user) await s.load(data.user.id).catch(() => undefined)
}

export async function execAction(name: string, args: Record<string, unknown>): Promise<IaraResult> {
  const action = allActions().find((a) => a.name === name)
  if (!action) return { done: [{ label: `Ação desconhecida: ${name}`, ok: false }] }
  try {
    await ensureTeam()
    if (action.exec) return await action.exec(args)
    return one(await action.run(args))
  } catch (e) {
    return { done: [{ label: e instanceof Error ? e.message : 'Não consegui.', ok: false }], data: { erro: e instanceof Error ? e.message : String(e) } }
  }
}

export const ETAPAS = 'ideia | producao | gestor | pronto | cliente | ajuste | aprovado'

/** O catálogo para a IA. */
export const catalog = () =>
  `AGENTE = ${localAgents().join(' | ') || 'claude'}\nFORMATO = ${CONTENT_FORMATS.map((f) => f.id).join(' | ')}\nCANAL = ${CHANNELS.map((c) => c.id).join(' | ')}\nETAPA = ${ETAPAS}\nETAPA_CRM = novo | mapeado | selecionado | pagina | contatado | conversa | proposta | fechado | perdido\nID = o id de um conteúdo\n${allActions()
    .map((a) => `- ${a.name}${isRisky(a, {}) || typeof a.risky === 'function' ? ' (pede confirmação)' : ''}: ${a.doc}`)
    .join('\n')}`

/** O que a equipe rápida (`squad.ts`) usa daqui. */
export { target as squadTarget, follow as squadFollow, persist as squadPersist, pickPost as squadPickPost, previews as squadPreviews, designEdit as squadDesignEdit }
export type { Target as SquadTarget }
