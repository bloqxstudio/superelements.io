import { supabase } from '@/integrations/supabase/client'
import { useCrm } from '@/features/crm/crmStore'
import { createContent, deleteContent, linkContent, listContents, listLinks, loadContent, loadContext, saveContent, transitionContent } from '@/features/conteudos/api'
import { CONTENT_FORMATS, STATUS_LABEL, type Content, type ContentFormat } from '@/features/conteudos/rules'
import { setHash, setPath } from '@/features/conteudos/forward'
import { scheduleContent } from '@/features/pauta/api'
import { CHANNELS, STAGE_LABEL, channelOfFormat, stageOf } from '@/features/pauta/rules'
import { loadSet, saveSet } from '@/features/criativos/storage'
import type { CreativeSet, Post } from '@/features/criativos/types'
import { useIara, type IaraAction, type IaraDone } from './store'

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
  if (!t) throw new Error('Abra uma conta de empresa primeiro.')
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

/** O conjunto de Criativos ligado ao conteúdo. */
async function setOf(contentId: string): Promise<{ content: Content; set: CreativeSet; projectId?: string }> {
  const content = await fresh(contentId)
  const link = (await listLinks(content.id)).find((l) => l.kind === 'criativos')
  if (!link) throw new Error(`"${content.title}" ainda não tem criativo. Use produzir_criativo primeiro.`)
  const set = await loadSet(link.artifactId, link.projectId)
  if (!set) throw new Error('Não consegui abrir o criativo deste conteúdo.')
  return { content, set, projectId: link.projectId }
}

const pickPost = (set: CreativeSet, ref: unknown): Post => {
  const n = typeof ref === 'number' ? ref : Number(ref)
  const post = Number.isFinite(n) && n >= 1 ? set.posts[n - 1] : set.posts[0]
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
    doc: '{"id":ID} — produz o criativo do conteúdo com o pipeline completo do app: escreve o roteiro se faltar, monta o post na marca da conta (designer), gera as fotos e anima. Demora 1 a 4 minutos. Depois use ver_criativo para conferir.',
    run: async () => ({ label: 'Criativo produzido.', ok: true }),
    exec: async (a) => {
      const c = await fresh(String(a.id))
      const { produceWithAi } = await import('@/features/conteudos/produce')
      const ctx = await loadContext(team().id).catch(() => null)
      const out = await produceWithAi(c, ctx, undefined, (s) => useIara.setState({ step: `Criativo: ${s}` }))
      return { done: [{ label: `Criativo pronto: ${c.title}`, ok: true, to: out.path }], data: { abrir: out.path } }
    },
  },
  {
    name: 'ver_criativo',
    doc: '{"id":ID,"post"?:number} — mostra o criativo de um conteúdo: imagem de cada slide, textos de cada slide e a legenda. Use para revisar o design antes de editar.',
    run: async () => ({ label: 'Vi o criativo.', ok: true }),
    exec: async (a) => {
      const { set } = await setOf(String(a.id))
      const post = pickPost(set, a.post)
      return {
        done: [],
        data: { conjunto: set.name, posts: set.posts.map((p, i) => ({ post: i + 1, nome: p.name, formato: p.format, slides: p.slides.length })), post: { nome: post.name, formato: post.format, legenda: post.caption ?? '', slides: slideTexts(post) } },
        images: await previews(set, post),
      }
    },
  },
  {
    name: 'editar_criativo',
    doc: '{"id":ID,"pedido":string,"post"?:number,"slide"?:number} — pede ao designer do app para mudar o design do criativo (textos, cores, layout, ordem, fotos novas por descrição). Seja específico no pedido. Devolve as imagens de como ficou.',
    run: async () => ({ label: 'Criativo editado.', ok: true }),
    exec: async (a) => {
      const { content, set, projectId } = await setOf(String(a.id))
      const post = pickPost(set, a.post)
      const n = typeof a.slide === 'number' ? a.slide : Number(a.slide)
      const slide = Number.isFinite(n) && n >= 1 ? post.slides[n - 1] : undefined
      const pedido = str(a.pedido, 3000)
      if (!pedido) throw new Error('Diga o que mudar no criativo.')
      const [{ requestEdit }, { applyOps }, { creativeImages }, { fillSetImages }, { useCreativeLink }] = await Promise.all([
        import('@/features/criativos/ai'),
        import('@/features/criativos/applyOps'),
        import('@/features/crm/instagram'),
        import('@/features/criativos/generate'),
        import('@/features/criativos/link'),
      ])
      useIara.setState({ step: 'Designer editando o criativo' })
      const images = await creativeImages(set, post.slides)
      const fonts = [...new Set([set.brand.headingFont, set.brand.bodyFont, 'Inter', 'Inter Tight', 'Geist', 'Playfair Display', 'DM Sans', 'Manrope', 'Montserrat', 'Space Grotesk', 'Fraunces', 'Archivo'])]
      const answer = await requestEdit({ message: pedido, scope: slide ? 'slide' : 'post', set, postId: post.id, slideId: slide?.id ?? post.slides[0]?.id, images, history: [], canGenerateImages: !!useCreativeLink.getState().images }, fonts)
      const result = applyOps(set, answer.ops, { postId: post.id, slideId: slide?.id ?? post.slides[0]?.id })
      let next = { ...result.set, updatedAt: Date.now() }
      if (result.toGenerate.length && useCreativeLink.getState().providers.length) {
        useIara.setState({ step: 'Gerando as fotos' })
        next = (await fillSetImages(next, [post.id], { signal: AbortSignal.timeout(300_000) }).catch(() => ({ set: next }))).set
      }
      await saveSet(next)
      await linkContent(content.id, 'criativos', next.id, projectId, await setHash(next)).catch(() => undefined)
      const after = next.posts.find((p) => p.id === post.id) ?? post
      return {
        done: [{ label: `Criativo editado: ${content.title} (${result.applied} mudanças)`, ok: true, to: setPath(content, projectId) }],
        data: { designer: answer.reply, mudancas: result.applied, ignoradas: result.skipped, slides: slideTexts(after) },
        images: await previews(next, after),
      }
    },
  },
  {
    name: 'legenda',
    doc: '{"id":ID,"post"?:number,"texto":string} — grava a legenda do post do criativo (o que vai no Instagram).',
    run: async () => ({ label: 'Legenda gravada.', ok: true }),
    exec: async (a) => {
      const { content, set, projectId } = await setOf(String(a.id))
      const post = pickPost(set, a.post)
      const text = str(a.texto, 2200)
      if (!text) throw new Error('Mande o texto da legenda.')
      const next = { ...set, posts: set.posts.map((p) => (p.id === post.id ? { ...p, caption: text } : p)), updatedAt: Date.now() }
      await saveSet(next)
      await linkContent(content.id, 'criativos', next.id, projectId, await setHash(next)).catch(() => undefined)
      return { done: [{ label: `Legenda gravada: ${content.title}`, ok: true, to: setPath(content, projectId) }] }
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

export const allActions = (): Full[] => [...CONTENT_ACTIONS, ...CREATIVE_ACTIONS, ...DATA_ACTIONS, ...NAV_ACTIONS, ...(useIara.getState().screen?.actions ?? [])]

export const isRisky = (a: IaraAction, args: Record<string, unknown>) => (typeof a.risky === 'function' ? a.risky(args) : !!a.risky)

/** Executa uma ação (sem conferir se é arriscada: quem chama decide). */
export async function execAction(name: string, args: Record<string, unknown>): Promise<IaraResult> {
  const action = allActions().find((a) => a.name === name)
  if (!action) return { done: [{ label: `Ação desconhecida: ${name}`, ok: false }] }
  try {
    if (action.exec) return await action.exec(args)
    return one(await action.run(args))
  } catch (e) {
    return { done: [{ label: e instanceof Error ? e.message : 'Não consegui.', ok: false }], data: { erro: e instanceof Error ? e.message : String(e) } }
  }
}

export const ETAPAS = 'ideia | producao | gestor | pronto | cliente | ajuste | aprovado'

/** O catálogo para a IA. */
export const catalog = () =>
  `FORMATO = ${CONTENT_FORMATS.map((f) => f.id).join(' | ')}\nCANAL = ${CHANNELS.map((c) => c.id).join(' | ')}\nETAPA = ${ETAPAS}\nID = o id de um conteúdo\n${allActions()
    .map((a) => `- ${a.name}${isRisky(a, {}) || typeof a.risky === 'function' ? ' (pede confirmação)' : ''}: ${a.doc}`)
    .join('\n')}`
