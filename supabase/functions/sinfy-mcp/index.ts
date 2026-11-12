import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as opentypeNs from 'npm:opentype.js@1.3.4'
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2'
import { adsData, funnelData, instagramData, periodOf, siteData } from './dados.ts'
import * as Criativos from './_gerado/criativos.js'
import { loadFamilies, measureContext, rasterize, rasterizeRgb, sniff, toBase64, type FontLib, type ResvgLike } from './previa.ts'
import jpeg from 'npm:jpeg-js@0.4.4'
import { asUser, fetchFile, liveSend, platformTools } from './plataforma.ts'
import { areaTools, BRAIN_BUCKET, brainRoot, cleanFolder, GUIDE, IMAGE_EXT, saveBrainImage, skillPrompts, sniffMime } from './areas.ts'

/**
 * MCP da Sinfy: qualquer IA (Claude, ChatGPT, Cursor, Claude Code…) conecta na conta da empresa.
 * Servidor MCP remoto em Streamable HTTP, sem sessão (cada POST é um JSON-RPC completo, resposta JSON).
 *
 * Endereço: https://<projeto>.supabase.co/functions/v1/sinfy-mcp/<chave>
 *   (ou `?key=<chave>`, ou `Authorization: Bearer <chave>`). A chave é pessoal e de uma conta
 *   (`crm_mcp_keys`, criada em Sinfy › Plano › Conectar sua IA). A IA age em nome da pessoa: as
 *   gravações do Plano e dos Conteúdos passam pelas mesmas funções da tela (`crm_mcp_call`), os
 *   módulos desligados fecham as ferramentas deles e a aprovação continua sendo de uma pessoa.
 *
 * Criativos: a IA escreve o roteiro de cada slide (modelo e textos) e o conjunto é gravado com
 * esses posts em `pending`; o Criativos desenha na marca da conta ao abrir (`materializePending`).
 */

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://app.avencestudio.com').replace(/\/+$/, '')
const BUCKET = 'space-projects'
const MAX_BODY = 512 * 1024
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER = { name: 'sinfy', title: 'Sinfy', version: '1.0.0' }

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id, accept, x-file-name',
  'access-control-allow-methods': 'POST, GET, OPTIONS, DELETE',
  'access-control-expose-headers': 'mcp-session-id',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })

const sha256 = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------- quem chama ----------

interface Team {
  id: string
  name: string
  segment: string | null
  website: string | null
  contact_name: string | null
  notes: string | null
  status: string
  modules: Record<string, boolean> | null
  is_home: boolean
  product: string | null
}

interface Caller {
  keyId: string
  userId: string
  role: string
  team: Team
  /** Para o aviso ao vivo nas telas: o nome da conexão (Claude, gpt…) e o da pessoa. */
  who?: { ia: string; pessoa: string }
}

const moduleOn = (team: Team, key: string) => team.status !== 'pausada' && (team.modules ?? {})[key] !== false

async function resolveCaller(token: string): Promise<Caller | null> {
  if (!/^sfy_[0-9a-f]{48}$/.test(token)) return null
  const { data, error } = await admin.rpc('crm_mcp_resolve', { p_hash: await sha256(token) })
  const row = (Array.isArray(data) ? data[0] : data) as { key_id: string; team_id: string; user_id: string; role: string } | undefined
  if (error || !row) return null
  const { data: team } = await admin.from('crm_teams').select('id, name, segment, website, contact_name, notes, status, modules, is_home, product').eq('id', row.team_id).maybeSingle()
  if (!team) return null
  const [{ data: key }, { data: person }] = await Promise.all([
    admin.from('crm_mcp_keys').select('name').eq('id', row.key_id).maybeSingle(),
    admin.from('profiles').select('full_name, email').eq('id', row.user_id).maybeSingle(),
  ])
  const pessoa = String(person?.full_name || person?.email || '').split(/[\s@]/)[0]
  return { keyId: row.key_id, userId: row.user_id, role: row.role, team: team as Team, who: { ia: String(key?.name ?? 'IA'), pessoa } }
}

class ToolError extends Error {}

const ERRORS: Record<string, string> = {
  so_gestor: 'Só dono ou gestor da conta pode fazer isso (mudar o Plano, aprovar). Peça para um gestor, ou use a chave de um gestor.',
  modulo_desligado: 'O módulo de Conteúdos (Copy) está desligado nesta conta.',
  sem_acesso: 'A pessoa da chave não tem acesso a isso nesta conta.',
  conflito_de_versao: 'Alguém mudou isso agora há pouco. Leia de novo e tente outra vez.',
  conteudo_aprovado: 'Este conteúdo já está aprovado e não muda mais. Crie outro conteúdo.',
  transicao_invalida: 'Essa mudança de status não é permitida a partir do status atual.',
  roteiro_vazio: 'Escreva o roteiro antes de mandar para revisão.',
  nao_encontrado: 'Não encontrei isso nesta conta.',
  ja_vinculado: 'Este conteúdo já tem outro criativo ligado.',
  projeto_de_outra_conta: 'Esse projeto não é desta conta.',
  campo_longo: 'Algum campo passou do tamanho máximo.',
  campo_invalido: 'Algum campo veio num formato que não serve.',
  limite_tags: 'No máximo 5 etiquetas por conteúdo (e 40 na conta).',
}

/** As funções do Plano e dos Conteúdos, como a pessoa dona da chave. */
async function callAs<T>(caller: Caller, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc('crm_mcp_call', { p_user: caller.userId, p_fn: fn, p_args: args })
  if (error) {
    const msg = error.message ?? ''
    const known = Object.entries(ERRORS).find(([k]) => msg.includes(k))
    throw new ToolError(known ? `${known[1]}${msg.includes(':') && /^campo_/.test(known[0]) ? ` (${msg.split(':').pop()})` : ''}` : 'A Sinfy recusou o pedido. Tente de novo.')
  }
  return data as T
}

const need = (caller: Caller, module: string, label: string) => {
  if (!moduleOn(caller.team, module)) throw new ToolError(`O módulo ${label} está desligado nesta conta. Quem administra a plataforma liga em Contas.`)
}

// ---------- Storage dos Criativos ----------

const personalFolder = (caller: Caller) => (caller.team.is_home ? caller.userId : `${caller.userId}/contas/${caller.team.id}`)

async function readJson<T>(path: string): Promise<T | undefined> {
  const { data, error } = await admin.storage.from(BUCKET).download(path)
  if (error || !data) return undefined
  try {
    return JSON.parse(await data.text()) as T
  } catch {
    return undefined
  }
}

async function writeJson(path: string, value: unknown, upsert = true) {
  const { error } = await admin.storage.from(BUCKET).upload(path, new Blob([JSON.stringify(value)], { type: 'application/json' }), { contentType: 'application/json', upsert, cacheControl: '0' })
  if (error) throw new ToolError(`Não consegui gravar o conjunto (${error.message}).`)
}

interface Project { id: string; name: string; owner_id: string; updated_at: string }

async function teamProjects(caller: Caller): Promise<Project[]> {
  if (!moduleOn(caller.team, 'projetos')) return []
  const { data } = await admin.from('space_projects').select('id, name, owner_id, updated_at').eq('team_id', caller.team.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(10)
  return (data ?? []) as Project[]
}

interface Summary { id: string; name: string; projectId?: string; projectName?: string; shared?: boolean; posts: number; colors: string[]; updatedAt: number }

async function listSets(caller: Caller) {
  const projects = await teamProjects(caller)
  const places = [{ folder: `${personalFolder(caller)}/criativos`, project: undefined as Project | undefined }, ...projects.map((p) => ({ folder: `${p.owner_id}/${p.id}/criativos`, project: p }))]
  const lists = await Promise.all(places.map(async (pl) => ((await readJson<Summary[]>(`${pl.folder}/index.json`)) ?? []).map((s) => ({ ...s, folder: pl.folder, projectId: pl.project?.id, projectName: pl.project?.name, shared: !!pl.project }))))
  return lists.flat().sort((a, b) => b.updatedAt - a.updatedAt)
}

const setUrl = (id: string, projectId?: string, contentId?: string) => {
  const q = new URLSearchParams()
  if (projectId) q.set('projeto', projectId)
  if (contentId) q.set('conteudo', contentId)
  const qs = q.toString()
  return `${APP_URL}/criativos/${id}${qs ? `?${qs}` : ''}`
}

/** A marca do conjunto mais recente da conta com cores ou logo (o que a IA precisa saber para escrever na identidade). */
async function latestBrand(caller: Caller) {
  for (const s of (await listSets(caller)).slice(0, 8)) {
    if (!s.colors?.length) continue
    const set = await readJson<{ brand?: Record<string, unknown> }>(`${s.folder}/${s.id}/set.json`)
    if (set?.brand) return set.brand
  }
  return undefined
}

// ---------- prévia dos criativos (imagem no chat) ----------

// deno-lint-ignore no-explicit-any
const opentype = ((opentypeNs as any).default ?? opentypeNs) as FontLib
let wasmReady: Promise<void> | undefined
const ensureWasm = () =>
  (wasmReady ??= initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm')).catch((err) => {
    wasmReady = undefined
    throw err
  }))

const EMPHASIS_FONT = 'Instrument Serif'
type Brand = { name: string; colors: { name: string; hex: string }[]; headingFont: string; bodyFont: string; emphasisFont?: string; buttonRadius?: number; logoOnLight?: string; logoOnDark?: string; look?: string }
/** A mesma marca neutra do navegador (`setBrandFrom(null, nome)`). */
const neutralBrand = (name: string): Brand => ({ name, colors: [], headingFont: 'Inter', bodyFont: 'Inter', emphasisFont: 'Inter', buttonRadius: 0, look: 'editorial' })

type Layer = { type: string; font?: string; emphasisFont?: string; src?: string; hidden?: boolean }
type BuiltPost = { id: string; name: string; format: string; caption?: string; slides: { id: string; background: string; layers: Layer[] }[] }

/** Carrega as famílias (Google Fonts, TTF) e devolve o contexto de medida e os arquivos para o resvg. */
async function fontsFor(families: string[]) {
  const loaded = await loadFamilies(opentype, [...families, 'Inter', EMPHASIS_FONT])
  const map = new Map(loaded.map((f) => [f.family, f.list]))
  return { ctx: measureContext(map), ok: families.filter(Boolean).every((f) => map.get(f.trim())?.length), bytes: loaded.flatMap((f) => f.list.map((x) => x.bytes)) }
}

const MAX_IMAGE = 8 * 1024 * 1024

/** Baixa as imagens dos slides (logo, anexos do conjunto, endereços) como data: URL com o tamanho. */
async function imagesFor(srcs: string[], assets: { id: string; path: string }[]) {
  const out = new Map<string, { href: string; width: number; height: number }>()
  await Promise.all(
    [...new Set(srcs)].map(async (src) => {
      try {
        let bytes: Uint8Array | undefined
        if (src.startsWith('asset:')) {
          const asset = assets.find((x) => x.id === src.slice(6))
          if (!asset) return
          const { data } = await admin.storage.from(BUCKET).download(asset.path)
          if (data) bytes = new Uint8Array(await data.arrayBuffer())
        } else if (src.startsWith('data:')) {
          const m = /^data:[^;]+;base64,(.*)$/.exec(src)
          if (m) bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))
        } else {
          const url = src.startsWith('/') ? `${APP_URL}${src}` : src
          if (!/^https?:\/\//.test(url)) return
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
          if (res.ok) bytes = new Uint8Array(await res.arrayBuffer())
        }
        if (!bytes || bytes.length > MAX_IMAGE) return
        const info = sniff(bytes)
        if (info) out.set(src, { href: `data:${info.mime};base64,${toBase64(bytes)}`, width: info.width, height: info.height })
      } catch {
        // imagem que não veio: o slide mostra o bloco cinza no lugar
      }
    })
  )
  return out
}

interface Picture { data: string; mimeType: 'image/png' }

/** PNG de cada slide (até `max`), na largura pedida. */
async function renderSlides(posts: BuiltPost[], assets: { id: string; path: string }[], width: number, max: number): Promise<Picture[]> {
  const slides = posts.flatMap((p) => p.slides.map((s) => ({ s, format: p.format }))).slice(0, max)
  if (!slides.length) return []
  const families = new Set<string>()
  const srcs: string[] = []
  for (const { s } of slides)
    for (const l of s.layers) {
      if (l.font) families.add(l.font)
      if (l.emphasisFont) families.add(l.emphasisFont)
      if (l.type === 'image' && l.src && !l.hidden) srcs.push(l.src)
    }
  const [fonts, images] = await Promise.all([fontsFor([...families]), imagesFor(srcs, assets), ensureWasm()])
  return slides.map(({ s, format }) => {
    Criativos.setMeasureContext(fonts.ctx)
    const svg = (Criativos.slideToSvg as (slide: unknown, format: string, image: (src: string) => unknown) => string)(s, format, (src: string) => images.get(src))
    return { data: toBase64(rasterize(Resvg as unknown as ResvgLike, svg, fonts.bytes, width)), mimeType: 'image/png' as const }
  })
}


/** Cada slide do post em JPEG na largura pedida (o formato que o Instagram aceita). */
async function renderJpegs(post: BuiltPost, assets: { id: string; path: string }[], width: number): Promise<Uint8Array[]> {
  const families = new Set<string>()
  const srcs: string[] = []
  for (const s of post.slides)
    for (const l of s.layers) {
      if (l.font) families.add(l.font)
      if (l.emphasisFont) families.add(l.emphasisFont)
      if (l.type === 'image' && l.src && !l.hidden) srcs.push(l.src)
    }
  const [fonts, images] = await Promise.all([fontsFor([...families]), imagesFor(srcs, assets), ensureWasm()])
  return post.slides.map((s) => {
    Criativos.setMeasureContext(fonts.ctx)
    const svg = (Criativos.slideToSvg as (slide: unknown, format: string, image: (src: string) => unknown) => string)(s, post.format, (src: string) => images.get(src))
    const rgb = rasterizeRgb(Resvg as unknown as ResvgLike, svg, fonts.bytes, width)
    return new Uint8Array(jpeg.encode(rgb, 92).data)
  })
}

/** Data e hora de Brasília ("2026-11-14 18:30", ISO ou "agora") → instante. */
function whenOf(v: unknown): Date {
  const t = typeof v === 'string' ? v.trim() : ''
  if (!t || /^agora$/i.test(t)) return new Date()
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(t)
  const d = /[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? new Date(t) : m ? new Date(`${m[1]}T${m[2]}:${m[3]}:00-03:00`) : new Date(NaN)
  if (Number.isNaN(d.getTime())) throw new ToolError('Não entendi "quando": use "agora" ou "AAAA-MM-DD HH:MM" (horário de Brasília).')
  if (d.getTime() < Date.now() - 5 * 60_000) throw new ToolError('Esse horário já passou. Use "agora" ou uma data futura.')
  if (d.getTime() > Date.now() + 75 * 86_400_000) throw new ToolError('Agende no máximo 75 dias para a frente.')
  return d
}
const brt = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Resposta de ferramenta com imagens: o texto vai primeiro, as prévias depois. */
class WithImages {
  constructor(public value: unknown, public images: Picture[]) {}
}

/** O mesmo hash que o navegador grava no vínculo (`hashOf` em conteudos/rules.ts): JSON com as chaves em ordem. */
async function stableHash(value: unknown) {
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, stable(x)]))
    return v
  }
  return sha256(JSON.stringify(stable(value)))
}

// ---------- validação do roteiro dos criativos ----------

const TEMPLATES = ['manifesto', 'lista', 'cta', 'viral-frase', 'viral-dado', 'viral-capa', 'viral-foto', 'foto-manchete', 'viral-fecho'] as const
const AVENCE_TEMPLATES = ['case-janela', 'case-duo', 'case-capa', 'ilustracao'] as const
const FORMATS = ['4x5', '1x1', '9x16'] as const
const SLIDE_FIELDS = ['template', 'label', 'title', 'body', 'items', 'cta', 'dark', 'prompt', 'number', 'photo', 'case', 'view', 'illustration', 'focus'] as const

const safeSlug = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'conjunto'
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

function cleanPost(raw: unknown, caller: Caller, index: number) {
  const p = (raw ?? {}) as Record<string, unknown>
  const format = FORMATS.includes(p.format as (typeof FORMATS)[number]) ? (p.format as string) : '4x5'
  const slidesRaw = Array.isArray(p.slides) ? p.slides : []
  if (!slidesRaw.length) throw new ToolError(`O post ${index + 1} não tem slides.`)
  if (slidesRaw.length > 10) throw new ToolError(`O post ${index + 1} tem mais de 10 slides (o Instagram aceita até 10 no carrossel; story: uma tela por slide, até 10).`)
  const allowed: readonly string[] = caller.team.is_home ? [...TEMPLATES, ...AVENCE_TEMPLATES] : TEMPLATES
  const slides = slidesRaw.map((s, i) => {
    const o = (s ?? {}) as Record<string, unknown>
    const template = String(o.template ?? 'manifesto')
    if (!allowed.includes(template)) throw new ToolError(`Slide ${i + 1} do post ${index + 1}: o modelo "${template}" não existe. Use: ${allowed.join(', ')}.`)
    const out: Record<string, unknown> = { template }
    for (const key of SLIDE_FIELDS) {
      if (key === 'template' || o[key] === undefined || o[key] === null) continue
      if (key === 'items') out.items = (Array.isArray(o.items) ? o.items : []).map((x) => str(x, 90)).filter(Boolean).slice(0, 4)
      else if (key === 'dark') out.dark = !!o.dark
      else if (key === 'focus') out.focus = Math.min(1, Math.max(0, Number(o.focus) || 0))
      else if (key === 'body') out.body = str(o.body, 320)
      else if (key === 'title') out.title = str(o.title, 140)
      else if (key === 'prompt') out.prompt = str(o.prompt, 600)
      else out[key] = str(o[key], 80)
    }
    return out
  })
  return { name: str(p.name, 80) ?? `Post ${index + 1}`, format, caption: str(p.caption, 2200) ?? '', slides }
}

// ---------- as ferramentas ----------

type Args = Record<string, unknown>
interface Tool {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: Record<string, unknown>
  run: (caller: Caller, args: Args) => Promise<unknown>
}

const PERIOD = { type: 'string', description: 'Período: "hoje", "ontem", "7", "30" (padrão), "90", "mes" (este mês) ou uma data "AAAA-MM-DD" para um dia só.' }

const CONTENT_FORMATS = ['post-instagram', 'carrossel', 'story', 'reels', 'linkedin', 'lp', 'anuncio', 'email', 'whatsapp', 'artigo', 'livre']

const slimContent = (c: Record<string, unknown>) => ({
  id: c.id,
  titulo: c.title,
  formato: c.format,
  status: c.status,
  objetivo: c.goal,
  ideia: c.idea,
  roteiro: c.script,
  data_editorial: c.editorial_date,
  horario: c.scheduled_time ?? undefined,
  canal: c.channel ?? undefined,
  etiquetas: Array.isArray(c.tag_ids) && c.tag_ids.length ? c.tag_ids : undefined,
  aprovacao_cliente: c.client_status ?? undefined,
  versao: c.version,
  aprovado: c.approved_version != null && c.approved_version === c.version,
  atualizado_em: c.updated_at,
  link: `${APP_URL}/conteudos/${c.id}`,
})

async function loadContext(teamId: string) {
  const { data } = await admin.from('crm_account_context').select('offer, audience, tone, goal, restrictions, pillars, version, updated_at').eq('team_id', teamId).maybeSingle()
  return data as { offer: string; audience: string; tone: string; goal: string; restrictions: string; pillars: string[]; version: number; updated_at: string } | null
}

/**
 * O Cérebro da conta (nova jornada de criação, Fase 1, 2026-11-09: o Cérebro é a fonte única do
 * contexto): a visão geral (README.md) e a marca escrita (`brand_md`, a nota marca/DESIGN.md).
 */
async function loadBrain(teamId: string) {
  const [readme, brand] = await Promise.all([
    admin.from('crm_knowledge_notes').select('content').eq('team_id', teamId).eq('path', 'README.md').maybeSingle(),
    admin.from('crm_account_context').select('brand_md').eq('team_id', teamId).maybeSingle(),
  ])
  const clip = (v: unknown, n: number) => { const t = String(v ?? '').trim(); return t.length > n ? `${t.slice(0, n)}…` : t }
  return { visao_geral: clip((readme.data as { content?: string } | null)?.content, 3000), marca_design_md: clip((brand.data as { brand_md?: string } | null)?.brand_md, 4000) }
}

const TOOLS: Tool[] = [
  {
    name: 'sinfy_conta',
    title: 'Quem somos',
    description: 'A empresa da chave: Plano (oferta, público, tom, restrições), marca e módulos ligados. Comece por aqui.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (caller) => {
      const t = caller.team
      const [ctx, brain, brand, projects, sites, ads, ig] = await Promise.all([
        loadContext(t.id),
        loadBrain(t.id).catch(() => ({ visao_geral: '', marca_design_md: '' })),
        moduleOn(t, 'criativos') ? latestBrand(caller) : Promise.resolve(undefined),
        teamProjects(caller),
        admin.from('site_trackers').select('domain').eq('team_id', t.id),
        admin.from('crm_ad_accounts').select('name').eq('team_id', t.id),
        admin.from('crm_instagram_accounts').select('username, followers_count').eq('team_id', t.id),
      ])
      const modules = ['copy', 'criativos', 'crm', 'site', 'instagram', 'whatsapp', 'projetos'].filter((m) => moduleOn(t, m))
      return {
        empresa: { nome: t.name, segmento: t.segment, site: t.website, contato: t.contact_name, observacoes: t.notes, produto: t.product },
        cerebro: brain.visao_geral || brain.marca_design_md
          ? { visao_geral: brain.visao_geral || undefined, marca_design_md: brain.marca_design_md || undefined }
          : { aviso: 'O Cérebro da conta ainda está vazio. Pergunte à pessoa quem é a empresa e o que vende antes de criar muito.' },
        voce: { papel: caller.role === 'owner' ? 'dono' : caller.role === 'admin' ? 'gestor' : 'vendedor', pode_mudar_o_plano: caller.role !== 'seller' },
        plano: ctx
          ? { oferta: ctx.offer, publico: ctx.audience, tom: ctx.tone, objetivo: ctx.goal, restricoes: ctx.restrictions, pilares: ctx.pillars, versao: ctx.version, atualizado_em: ctx.updated_at }
          : { aviso: 'O Plano da empresa ainda não foi preenchido. Pergunte à pessoa sobre oferta, público, tom e pilares e grave com sinfy_plano_salvar.' },
        marca: brand ? { nome: brand.name, cores: brand.colors, fonte_titulos: brand.headingFont, fonte_texto: brand.bodyFont, botao_arredondado: brand.buttonRadius } : { aviso: 'Sem marca salva nos Criativos ainda: os criativos saem na marca do projeto da conta ou neutros.' },
        projetos: projects.map((p) => ({ id: p.id, nome: p.name })),
        modulos_ligados: modules,
        canais: { sites: (sites.data ?? []).map((s) => s.domain), anuncios: (ads.data ?? []).map((a) => a.name), instagram: (ig.data ?? []).map((a) => `@${a.username} (${a.followers_count ?? '?'} seguidores)`) },
        app: APP_URL,
      }
    },
  },
  {
    name: 'sinfy_plano_salvar',
    title: 'Salvar o Plano da empresa',
    description: 'Grava campos do Plano da empresa (só dono ou gestor). Mande só o que muda e confirme antes com a pessoa.',
    inputSchema: {
      type: 'object',
      properties: {
        oferta: { type: 'string', description: 'O que a empresa vende e como (até 2000 letras).' },
        publico: { type: 'string', description: 'Para quem (até 2000).' },
        tom: { type: 'string', description: 'Tom de voz (até 1000).' },
        objetivo: { type: 'string', description: 'Objetivo da comunicação agora (até 1000).' },
        restricoes: { type: 'string', description: 'O que nunca dizer ou prometer (até 2000).' },
        pilares: { type: 'array', items: { type: 'string' }, maxItems: 8, description: 'Pilares de conteúdo (até 8).' },
      },
      additionalProperties: false,
    },
    run: async (caller, a) => {
      need(caller, 'copy', 'Conteúdos (Copy)')
      const ctx = await loadContext(caller.team.id)
      const draft = {
        offer: str(a.oferta, 2000) ?? ctx?.offer ?? '',
        audience: str(a.publico, 2000) ?? ctx?.audience ?? '',
        tone: str(a.tom, 1000) ?? ctx?.tone ?? '',
        goal: str(a.objetivo, 1000) ?? ctx?.goal ?? '',
        restrictions: str(a.restricoes, 2000) ?? ctx?.restrictions ?? '',
        pillars: Array.isArray(a.pilares) ? a.pilares.map((p) => str(p, 60)).filter(Boolean).slice(0, 8) : ctx?.pillars ?? [],
      }
      const saved = await callAs<{ version: number }>(caller, 'crm_context_save', { p_team: caller.team.id, p_expected: ctx?.version ?? 0, p_data: draft })
      return { ok: true, versao: saved?.version, link: `${APP_URL}/plano` }
    },
  },
  {
    name: 'sinfy_conteudos',
    title: 'Listar conteúdos',
    description: 'Lista os conteúdos da Pauta (status, formato, data, horário, canal, roteiro).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ideia', 'producao', 'revisao', 'aprovado'], description: 'Filtra por status.' },
        limite: { type: 'integer', minimum: 1, maximum: 100, description: 'Quantos (padrão 15).' },
        detalhe: { type: 'boolean', description: 'Roteiro e ideia inteiros.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'copy', 'Conteúdos (Copy)')
      let q = admin.from('crm_contents').select('*').eq('team_id', caller.team.id).order('updated_at', { ascending: false }).limit(Math.min(100, Math.max(1, Number(a.limite) || 15)))
      if (typeof a.status === 'string') q = q.eq('status', a.status)
      const { data, error } = await q
      if (error) throw new ToolError('Não consegui ler os conteúdos.')
      const ids = (data ?? []).map((c) => c.id)
      const { data: links } = ids.length ? await admin.from('crm_content_links').select('content_id, kind, artifact_id, project_id').in('content_id', ids) : { data: [] }
      return (data ?? []).map((c) => {
        const own = (links ?? []).filter((l) => l.content_id === c.id)
        const set = own.find((l) => l.kind === 'criativos')
        const cut = (t: unknown, n: number) => { const x = String(t ?? ''); return a.detalhe === true || x.length <= n ? x : `${x.slice(0, n)}… (+${x.length - n}; leia com detalhe)` }
        return { ...slimContent(c), ideia: cut(c.idea, 240), objetivo: cut(c.goal, 160), roteiro: cut(c.script, a.detalhe === true ? 20000 : 300), criativo: set ? setUrl(set.artifact_id, set.project_id ?? undefined, c.id) : null, tem_texto_no_copy: own.some((l) => l.kind === 'copy') }
      })
    },
  },
  {
    name: 'sinfy_conteudo_criar',
    title: 'Criar conteúdo no Plano',
    description: 'Cria um conteúdo na Pauta (nasce como ideia), no tom do Plano. Depois, sinfy_criativo_criar com o id gera o criativo ligado.',
    inputSchema: {
      type: 'object',
      required: ['titulo'],
      properties: {
        titulo: { type: 'string', maxLength: 160 },
        formato: { type: 'string', enum: CONTENT_FORMATS, description: 'Padrão post-instagram.' },
        objetivo: { type: 'string', maxLength: 600, description: 'O que o conteúdo deve causar.' },
        ideia: { type: 'string', maxLength: 4000, description: 'A ideia e o ângulo.' },
        roteiro: { type: 'string', maxLength: 20000, description: 'O texto: um parágrafo por slide/tela, separados por linha em branco.' },
        data_editorial: { type: 'string', description: 'AAAA-MM-DD, quando vai ao ar.' },
      },
      additionalProperties: false,
    },
    run: async (caller, a) => {
      need(caller, 'copy', 'Conteúdos (Copy)')
      const title = str(a.titulo, 160)
      if (!title) throw new ToolError('Dê um título ao conteúdo.')
      const date = typeof a.data_editorial === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.data_editorial) ? a.data_editorial : null
      const row = await callAs<Record<string, unknown>>(caller, 'crm_content_create', {
        p_team: caller.team.id,
        p_data: { title, idea: str(a.ideia, 4000) ?? '', goal: str(a.objetivo, 600) ?? '', format: CONTENT_FORMATS.includes(a.formato as string) ? a.formato : 'post-instagram', script: str(a.roteiro, 20000) ?? '', editorialDate: date },
      })
      return { ok: true, conteudo: slimContent(row) }
    },
  },
  {
    name: 'sinfy_conteudo_atualizar',
    title: 'Atualizar conteúdo',
    description: 'Edita um cartão da Pauta: textos, data, horário, canal, etiquetas (por nome) e status. Aprovar: só gestor, com "confirmar": true depois do "aprovo" da pessoa. Mande só o que muda.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        titulo: { type: 'string', maxLength: 160 },
        formato: { type: 'string', enum: CONTENT_FORMATS },
        objetivo: { type: 'string', maxLength: 600 },
        ideia: { type: 'string', maxLength: 4000 },
        roteiro: { type: 'string', maxLength: 20000 },
        data_editorial: { type: 'string', description: 'AAAA-MM-DD, ou vazio para tirar.' },
        horario: { type: 'string', description: 'HH:MM (precisa de data), ou vazio para tirar.' },
        canal: { type: 'string', enum: ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'site', 'email', 'whatsapp', 'anuncio', 'outro', ''] },
        etiquetas: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Nomes das etiquetas (substitui as atuais; [] tira todas).' },
        status: { type: 'string', enum: ['ideia', 'producao', 'revisao', 'aprovado'] },
        confirmar: { type: 'boolean', description: 'Obrigatório para aprovar.' },
      },
      additionalProperties: false,
    },
    run: async (caller, a) => {
      need(caller, 'copy', 'Conteúdos (Copy)')
      const { data: cur } = await admin.from('crm_contents').select('*').eq('id', String(a.id)).eq('team_id', caller.team.id).maybeSingle()
      if (!cur) throw new ToolError('Conteúdo não encontrado nesta conta.')
      const patch: Record<string, unknown> = {}
      if (a.titulo !== undefined) patch.title = str(a.titulo, 160)
      if (a.formato !== undefined && CONTENT_FORMATS.includes(a.formato as string)) patch.format = a.formato
      if (a.objetivo !== undefined) patch.goal = String(a.objetivo).slice(0, 600)
      if (a.ideia !== undefined) patch.idea = String(a.ideia).slice(0, 4000)
      if (a.roteiro !== undefined) patch.script = String(a.roteiro).slice(0, 20000)
      const dateArg = a.data_editorial !== undefined ? (typeof a.data_editorial === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.data_editorial) ? a.data_editorial : null) : undefined
      let row = cur as Record<string, unknown>
      if (Object.keys(patch).length) row = await callAs(caller, 'crm_content_save', { p_id: cur.id, p_expected: row.version, p_data: patch })
      const reload = async () => {
        const { data } = await admin.from('crm_contents').select('*').eq('id', cur.id).maybeSingle()
        if (data) row = data
      }
      const sqlErr = (err: unknown): never => {
        const m = err instanceof Error ? err.message : String(err)
        const known = Object.entries(ERRORS).find(([k]) => m.includes(k))
        throw new ToolError(known ? known[1] : `A Pauta recusou: ${m}`)
      }
      // Data, horário e canal: a mesma função do calendário da Pauta
      if (dateArg !== undefined || a.horario !== undefined || a.canal !== undefined) {
        const date = dateArg !== undefined ? dateArg : (row.editorial_date as string | null)
        const time = a.horario !== undefined ? (typeof a.horario === 'string' && /^\d{2}:\d{2}$/.test(a.horario) ? a.horario : null) : (row.scheduled_time as string | null)
        const channel = a.canal !== undefined ? (a.canal ? String(a.canal) : null) : (row.channel as string | null)
        await asUser(caller, (tx) => tx`select crm_content_schedule(${cur.id}::uuid, ${row.version as number}::int, ${date}::date, ${date ? time : null}::time, ${channel}::text)`).catch(sqlErr)
        await reload()
      }
      if (Array.isArray(a.etiquetas)) {
        const names = (a.etiquetas as unknown[]).map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
        const ids: string[] = []
        for (const name of names) {
          const [hit] = await asUser(caller, (tx) => tx`select id from crm_content_tags where team_id = ${caller.team.id}::uuid and lower(name) = lower(${name}) limit 1`)
          if (hit) ids.push(hit.id)
          else {
            const [made] = await asUser(caller, (tx) => tx`select (crm_content_tag_save(${caller.team.id}::uuid, null, ${name.slice(0, 40)}, 'violet')).id as id`).catch(sqlErr)
            if (made?.id) ids.push(made.id as string)
          }
        }
        await asUser(caller, (tx) => tx`select crm_content_set_tags(${cur.id}::uuid, ${ids}::uuid[])`).catch(sqlErr)
        await reload()
      }
      if (typeof a.status === 'string' && a.status !== row.status) {
        if (a.status === 'aprovado') {
          if (a.confirmar !== true) throw new ToolError('Para aprovar, mostre o conteúdo à pessoa e, com o "aprovo" dela, chame de novo com "confirmar": true.')
          await asUser(caller, (tx) => tx`select crm_content_transition(${cur.id}::uuid, ${row.version as number}::int, 'aprovado')`).catch(sqlErr)
          await reload()
        } else row = await callAs(caller, 'crm_content_transition', { p_id: cur.id, p_expected: row.version, p_to: a.status })
      }
      return { ok: true, conteudo: slimContent(row) }
    },
  },
  {
    name: 'sinfy_criativo_criar',
    title: 'Criar criativos na marca',
    description: 'Cria um conjunto NOVO de posts (feed, carrossel ou story) na marca da conta e devolve a prévia. Antes, leia sinfy_ajuda("modelos") para os modelos de slide e as regras de texto. Para ajustar um que existe, use sinfy_criativo_editar.',
    inputSchema: {
      type: 'object',
      required: ['posts'],
      properties: {
        nome: { type: 'string', description: 'Nome do conjunto (padrão: título do conteúdo ou do primeiro post).' },
        conteudo_id: { type: 'string', description: 'Id de um conteúdo do Plano: o conjunto fica ligado a ele.' },
        projeto_id: { type: 'string', description: 'Projeto da conta onde guardar (a equipe dele abre junto). Padrão: o projeto mais recente da conta; sem projeto, a pasta pessoal da pessoa da chave.' },
        posts: {
          type: 'array',
          minItems: 1,
          maxItems: 6,
          items: {
            type: 'object',
            required: ['slides'],
            properties: {
              name: { type: 'string' },
              format: { type: 'string', enum: [...FORMATS], description: '4x5 feed (padrão), 1x1 quadrado, 9x16 story.' },
              caption: { type: 'string' },
              slides: {
                type: 'array',
                minItems: 1,
                maxItems: 10,
                items: {
                  type: 'object',
                  required: ['template'],
                  properties: {
                    template: { type: 'string', enum: [...TEMPLATES] },
                    label: { type: 'string' },
                    title: { type: 'string' },
                    body: { type: 'string' },
                    items: { type: 'array', items: { type: 'string' }, maxItems: 4 },
                    cta: { type: 'string' },
                    number: { type: 'string' },
                    prompt: { type: 'string' },
                    dark: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      additionalProperties: false,
    },
    run: async (caller, a) => {
      need(caller, 'criativos', 'Criativos')
      const postsRaw = Array.isArray(a.posts) ? a.posts : []
      if (!postsRaw.length) throw new ToolError('Mande ao menos um post com slides.')
      if (postsRaw.length > 6) throw new ToolError('Até 6 posts por pedido.')
      const posts = postsRaw.map((p, i) => cleanPost(p, caller, i))

      let content: Record<string, unknown> | null = null
      if (typeof a.conteudo_id === 'string' && a.conteudo_id) {
        const { data } = await admin.from('crm_contents').select('id, title, version').eq('id', a.conteudo_id).eq('team_id', caller.team.id).maybeSingle()
        if (!data) throw new ToolError('Conteúdo não encontrado nesta conta.')
        content = data
      }
      const projects = await teamProjects(caller)
      const project = typeof a.projeto_id === 'string' && a.projeto_id ? projects.find((p) => p.id === a.projeto_id) : caller.team.is_home ? undefined : projects[0]
      if (typeof a.projeto_id === 'string' && a.projeto_id && !project) throw new ToolError('Projeto não encontrado nesta conta.')

      const folder = project ? `${project.owner_id}/${project.id}/criativos` : `${personalFolder(caller)}/criativos`
      const id = `ia-${crypto.randomUUID().slice(0, 8)}`
      const now = Date.now()
      const ctx = await loadContext(caller.team.id)
      const name = str(a.nome, 80) ?? (content?.title as string | undefined) ?? posts[0].name

      // A marca da conta (conjunto mais recente com cores ou logo). Com ela e as fontes carregadas, os
      // posts saem montados daqui, iguais ao que o editor monta; sem ela, o Criativos monta ao abrir
      // (DESIGN.md do projeto) e a prévia vai na marca neutra.
      const brand = (await latestBrand(caller)) as Brand | undefined
      const useBrand = brand ?? neutralBrand(project?.name ?? caller.team.name)
      let built: BuiltPost[] = []
      let ready = false
      try {
        const fonts = await fontsFor([useBrand.headingFont, useBrand.bodyFont, useBrand.emphasisFont ?? ''])
        Criativos.setMeasureContext(fonts.ctx)
        built = posts.map((p) => Criativos.buildPost(p, useBrand) as BuiltPost)
        ready = !!brand && fonts.ok
      } catch (err) {
        console.error('[sinfy-mcp] montar', err)
      }
      const set = {
        id,
        name,
        projectId: project?.id,
        projectName: project?.name,
        shared: !!project,
        brand: useBrand,
        ...(ready ? {} : { pending: posts, pendingBrand: !brand }),
        origin: 'mcp',
        source: content ? { contentId: content.id, contextVersion: ctx?.version } : undefined,
        brief: ctx ? [ctx.offer && `Oferta: ${ctx.offer}`, ctx.audience && `Público: ${ctx.audience}`, ctx.tone && `Tom: ${ctx.tone}`, ctx.restrictions && `Restrições: ${ctx.restrictions}`].filter(Boolean).join('\n') : undefined,
        posts: ready ? built : [],
        assets: [],
        createdAt: now,
        updatedAt: now,
      }
      await writeJson(`${folder}/${id}/set.json`, set, false)
      const index = (await readJson<Summary[]>(`${folder}/index.json`)) ?? []
      const summary: Summary = { id, name, projectId: project?.id, projectName: project?.name, shared: !!project, posts: posts.length, colors: useBrand.colors.slice(0, 5).map((c) => c.hex), updatedAt: now }
      await writeJson(`${folder}/index.json`, [summary, ...index.filter((s) => s.id !== id)])

      let ligado: string | undefined
      if (content) {
        // Liga já ao conteúdo (o hash muda quando o Criativos desenhar; ele religa)
        try {
          await callAs(caller, 'crm_content_link', { p_content: content.id, p_kind: 'criativos', p_artifact: id, p_project: project?.id ?? '', p_hash: ready ? await stableHash({ posts: built }) : await sha256(JSON.stringify(posts)) })
          ligado = 'ligado ao conteúdo'
        } catch (err) {
          ligado = `não ficou ligado ao conteúdo: ${err instanceof Error ? err.message : 'erro'}`
        }
      }
      let images: Picture[] = []
      let previewError: string | undefined
      try {
        images = await renderSlides(built, [], 540, 10)
      } catch (err) {
        console.error('[sinfy-mcp] prévia', err)
        previewError = 'Não consegui desenhar a prévia agora; o conjunto foi salvo e abre pelo link.'
      }
      const total = built.reduce((n, p) => n + p.slides.length, 0)
      return new WithImages(
        {
          ok: true,
          conjunto: id,
          link: setUrl(id, project?.id, content?.id as string | undefined),
          onde: project ? `projeto ${project.name} (a equipe dele abre)` : 'pasta pessoal da pessoa da chave',
          conteudo: ligado,
          marca: brand ? `marca da conta (${useBrand.name})` : 'sem marca salva na conta: prévia neutra; ao abrir, a Sinfy aplica a marca do projeto',
          posts: posts.map((p) => ({ nome: p.name, formato: p.format, slides: p.slides.length, legenda: p.caption })),
          previa: previewError ?? (images.length ? `${images.length} de ${total} slides abaixo, na ordem. Mostre as imagens à pessoa.${total > images.length ? ' Para ver os outros, use sinfy_criativo_ver com o número do post.' : ''}` : undefined),
          proximo_passo: 'Mostre a prévia à pessoa e pergunte o que ajustar. Para ajustar, use sinfy_criativo_editar neste conjunto (nunca crie outro). Fotos: sinfy_criativo_foto ou gere no editor pelo link. Para publicar ou agendar: sinfy_publicar.',
        },
        images
      )
    },
  },
  {
    name: 'sinfy_criativos',
    title: 'Listar criativos',
    description: 'Lista os conjuntos de Criativos da conta, com id e link.',
    inputSchema: { type: 'object', properties: { limite: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'criativos', 'Criativos')
      return (await listSets(caller)).slice(0, Math.min(50, Number(a.limite) || 20)).map((s) => ({ id: s.id, nome: s.name, posts: s.posts, projeto: s.projectName ?? null, projeto_id: s.projectId ?? null, atualizado_em: new Date(s.updatedAt).toISOString(), link: setUrl(s.id, s.projectId) }))
    },
  },
  {
    name: 'sinfy_criativo',
    title: 'Ler um criativo',
    description: 'Lê os textos de cada slide e a legenda de cada post de um conjunto.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, projeto_id: { type: 'string' } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'criativos', 'Criativos')
      const found = (await listSets(caller)).find((s) => s.id === a.id && (!a.projeto_id || s.projectId === a.projeto_id))
      if (!found) throw new ToolError('Conjunto não encontrado nesta conta.')
      const set = await readJson<{ name: string; posts: { name: string; format: string; caption?: string; slides: { layers: { type: string; text?: string; hidden?: boolean }[] }[] }[]; pending?: unknown[] }>(`${found.folder}/${found.id}/set.json`)
      if (!set) throw new ToolError('Não consegui abrir o conjunto.')
      return {
        nome: set.name,
        link: setUrl(found.id, found.projectId),
        posts: set.posts.map((p) => ({ nome: p.name, formato: p.format, legenda: p.caption, slides: p.slides.map((s) => s.layers.filter((l) => l.type === 'text' && !l.hidden && l.text).map((l) => l.text)) })),
        ainda_nao_desenhados: set.pending ?? [],
      }
    },
  },
  {
    name: 'sinfy_criativo_ver',
    title: 'Ver o criativo',
    description: 'Mostra as imagens de um post de um conjunto (padrão: o primeiro).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Id do conjunto (sinfy_criativos ou o retorno de sinfy_criativo_criar).' },
        projeto_id: { type: 'string' },
        post: { type: 'integer', minimum: 1, description: 'Qual post do conjunto (1 = o primeiro). Padrão 1.' },
        largura: { type: 'integer', minimum: 320, maximum: 1080, description: 'Largura da imagem em px (padrão 540).' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'criativos', 'Criativos')
      const found = (await listSets(caller)).find((s) => s.id === a.id && (!a.projeto_id || s.projectId === a.projeto_id))
      if (!found) throw new ToolError('Conjunto não encontrado nesta conta.')
      const set = await readJson<{ name: string; brand?: Brand; posts: BuiltPost[]; pending?: { name: string; format: string; caption?: string; slides: unknown[] }[]; assets?: { id: string; path: string }[] }>(`${found.folder}/${found.id}/set.json`)
      if (!set) throw new ToolError('Não consegui abrir o conjunto.')
      let posts = set.posts ?? []
      if (set.pending?.length) {
        // Ainda não aberto no editor: monta aqui só para a prévia
        const brand = set.brand ?? neutralBrand(set.name)
        const fonts = await fontsFor([brand.headingFont, brand.bodyFont, brand.emphasisFont ?? ''])
        Criativos.setMeasureContext(fonts.ctx)
        posts = [...posts, ...set.pending.map((p) => Criativos.buildPost(p, brand) as BuiltPost)]
      }
      if (!posts.length) throw new ToolError('Este conjunto não tem posts.')
      const index = Math.min(posts.length, Math.max(1, Number(a.post) || 1)) - 1
      const post = posts[index]
      const width = Math.min(1080, Math.max(320, Number(a.largura) || 540))
      const images = await renderSlides([post], set.assets ?? [], width, 10)
      return new WithImages(
        { conjunto: set.name, post: `${index + 1} de ${posts.length}`, nome: post.name, formato: post.format, slides: post.slides.length, legenda: post.caption, link: setUrl(found.id, found.projectId), nota: 'Mostre as imagens à pessoa, na ordem.' },
        images
      )
    },
  },
  {
    name: 'sinfy_criativo_foto',
    title: 'Pôr uma foto no criativo',
    description: 'Põe uma foto num slide de um conjunto (no lugar da foto pedida ou trocando a imagem): "arquivo" do Cérebro, "url" pública ou "base64". A foto anexada no chat não chega aqui: use sinfy_link_envio. Slide só de texto: a foto vira fundo, com véu para ler ("como": "fundo" força isso). A foto também fica guardada no Cérebro.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Id do conjunto.' },
        projeto_id: { type: 'string' },
        post: { type: 'integer', minimum: 1, description: 'Post do conjunto (padrão 1).' },
        slide: { type: 'integer', minimum: 1, description: 'Slide do post (padrão 1).' },
        como: { type: 'string', enum: ['auto', 'trocar', 'fundo'], description: 'auto (padrão): troca a foto do slide; sem lugar de foto, vira fundo. fundo: a foto cobre o slide atrás dos textos, com véu para ler.' },
        arquivo: { type: 'string', description: 'Caminho de uma imagem do Cérebro (sinfy_cerebro_arquivos), ex.: fotos/enviadas/x.jpg.' },
        url: { type: 'string', description: 'Endereço https da foto.' },
        base64: { type: 'string', description: 'Ou a foto em base64 (data URL).' },
        nome_arquivo: { type: 'string' },
      },
      additionalProperties: false,
    },
    run: async (caller, a) => {
      need(caller, 'criativos', 'Criativos')
      const found = (await listSets(caller)).find((s) => s.id === a.id && (!a.projeto_id || s.projectId === a.projeto_id))
      if (!found) throw new ToolError('Conjunto não encontrado nesta conta.')
      const path = `${found.folder}/${found.id}/set.json`
      const set = await readJson<Record<string, unknown> & { name: string; brand?: Brand; posts: BuiltPost[]; pending?: { name: string; format: string; caption?: string; slides: unknown[] }[]; pendingBrand?: boolean; assets?: { id: string; name: string; path: string; width: number; height: number }[] }>(path)
      if (!set) throw new ToolError('Não consegui abrir o conjunto.')
      if (set.pending?.length) {
        if (set.pendingBrand) throw new ToolError('Este conjunto ainda espera a marca do projeto: abra o link uma vez na Sinfy e tente de novo.')
        const brand = set.brand ?? neutralBrand(set.name)
        const fonts = await fontsFor([brand.headingFont, brand.bodyFont, brand.emphasisFont ?? ''])
        Criativos.setMeasureContext(fonts.ctx)
        set.posts = [...(set.posts ?? []), ...set.pending.map((p) => Criativos.buildPost(p, brand) as BuiltPost)]
        delete set.pending
      }
      const post = set.posts[Math.max(1, Number(a.post) || 1) - 1]
      if (!post) throw new ToolError('Esse post não existe no conjunto.')
      const slide = post.slides[Math.max(1, Number(a.slide) || 1) - 1]
      if (!slide) throw new ToolError('Esse slide não existe no post.')
      const images = slide.layers.filter((l) => l.type === 'image' && !l.hidden) as (Layer & { prompt?: string; genFailed?: boolean; name?: string })[]
      const como = a.como === 'fundo' || a.como === 'trocar' ? a.como : 'auto'
      const slot = images.find((l) => !l.src && l.prompt) ?? images.find((l) => !(l.name ?? '').toLowerCase().includes('logo') && !(l.src ?? '').includes('/logo')) ?? undefined
      if (como === 'trocar' && !slot) throw new ToolError('Este slide não tem foto para trocar. Use "como": "fundo" para pôr a foto atrás dos textos.')
      // Sem lugar de foto (slides só de texto) ou pedido de fundo: a foto cobre o slide, atrás de tudo, com um véu na cor do fundo
      const asBackground = como === 'fundo' || !slot
      // A foto vem do Cérebro (o que a pessoa mandou pelo link de envio) ou de um endereço/base64, que também fica guardado no Cérebro
      let file: { bytes: Uint8Array; mime: string; name: string }
      let noCerebro: string | undefined
      if (typeof a.arquivo === 'string' && a.arquivo.trim()) {
        const rel = a.arquivo.trim().replace(/^\/+/, '').replace(/^cerebro\//, '')
        if (rel.includes('..')) throw new ToolError('Caminho inválido.')
        const { data } = await admin.storage.from(BRAIN_BUCKET).download(`${brainRoot(caller.team.id)}/${rel}`)
        if (!data) throw new ToolError(`Não achei "${rel}" no Cérebro. Veja os caminhos com sinfy_cerebro_arquivos.`)
        file = { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type, name: rel.split('/').pop() ?? 'foto' }
        noCerebro = rel
      } else {
        if (!a.url && !a.base64) throw new ToolError('Mande "arquivo" (do Cérebro), "url" ou "base64". Foto anexada no chat não chega aqui: gere um link com sinfy_link_envio.')
        file = await fetchFile({ admin, appUrl: APP_URL, fail: (m) => { throw new ToolError(m) } }, a, 15 * 1024 * 1024)
      }
      const info = sniff(file.bytes)
      if (!info || !info.mime.startsWith('image/')) throw new ToolError('O arquivo não é uma imagem que eu reconheça (PNG, JPEG, WebP ou GIF).')
      if (!noCerebro && IMAGE_EXT[info.mime]) {
        const folder = cleanFolder(`fotos/criativos/${safeSlug(set.name)}`, 'fotos/criativos') ?? 'fotos/criativos'
        noCerebro = await saveBrainImage(admin, caller.team.id, folder, file.name, file.bytes, info.mime).catch((err) => {
          console.error('[sinfy-mcp] cérebro', err)
          return undefined
        })
      }
      const assetId = crypto.randomUUID().slice(0, 8)
      const assetPath = `${found.folder}/${found.id}/${assetId}.${info.mime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`
      const { error } = await admin.storage.from(BUCKET).upload(assetPath, file.bytes, { contentType: info.mime, upsert: false })
      if (error) throw new ToolError(`Não consegui subir a foto (${error.message}).`)
      set.assets = [...(set.assets ?? []), { id: assetId, name: file.name, path: assetPath, width: info.width, height: info.height }]
      if (asBackground) {
        const size = (Criativos.sizeOf as (f: string) => { width: number; height: number })(post.format)
        const bg = /^#[0-9a-f]{6}$/i.test(slide.background) ? slide.background : '#000000'
        const photo = { id: crypto.randomUUID().slice(0, 8), type: 'image', name: 'Foto de fundo', src: `asset:${assetId}`, fit: 'cover', radius: 0, frame: 'none', x: 0, y: 0, w: size.width, h: size.height }
        const veil = { id: crypto.randomUUID().slice(0, 8), type: 'rect', name: 'Véu da foto', fill: bg, radius: 0, opacity: bg === '#000000' ? 0.5 : 0.68, x: 0, y: 0, w: size.width, h: size.height }
        slide.layers.unshift(photo as unknown as Layer, veil as unknown as Layer)
      } else {
        const target = slot!
        target.src = `asset:${assetId}`
        delete target.prompt
        delete target.genFailed
      }
      set.updatedAt = Date.now()
      await writeJson(path, set)
      const index = (await readJson<Summary[]>(`${found.folder}/index.json`)) ?? []
      await writeJson(`${found.folder}/index.json`, index.map((s) => (s.id === found.id ? { ...s, posts: set.posts.length, updatedAt: set.updatedAt as number } : s)))
      const preview = await renderSlides([{ ...post, slides: [slide] }], set.assets, 540, 1)
      return new WithImages({ ok: true, conjunto: found.id, post: Number(a.post) || 1, slide: Number(a.slide) || 1, no_cerebro: noCerebro, como: asBackground ? 'foto de fundo com véu (ajuste a opacidade do véu no editor, se quiser)' : 'foto do slide trocada', link: setUrl(found.id, found.projectId), aviso: 'Se o conjunto estiver aberto no editor agora, recarregue a página para não gravar por cima.' }, preview)
    },
  },
  {
    name: 'sinfy_criativo_editar',
    title: 'Editar um criativo',
    description: 'Ajusta um conjunto que já existe, sem criar outro: texto de slide, legenda, refazer, acrescentar, apagar, duplicar ou mover slides e posts. As mudanças possíveis estão em sinfy_ajuda("editar_criativo").',
    inputSchema: {
      type: 'object',
      required: ['id', 'mudancas'],
      properties: {
        id: { type: 'string', description: 'Id do conjunto.' },
        projeto_id: { type: 'string' },
        mudancas: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'object' } },
      },
      additionalProperties: false,
    },
    run: async (caller, a) => {
      need(caller, 'criativos', 'Criativos')
      const found = (await listSets(caller)).find((s) => s.id === a.id && (!a.projeto_id || s.projectId === a.projeto_id))
      if (!found) throw new ToolError('Conjunto não encontrado nesta conta (veja os ids em sinfy_criativos).')
      const path = `${found.folder}/${found.id}/set.json`
      type TextL = Layer & { text?: string; name?: string }
      const set = await readJson<Record<string, unknown> & { name: string; brand?: Brand; posts: BuiltPost[]; pending?: unknown[]; pendingBrand?: boolean; assets?: { id: string; path: string }[]; updatedAt?: number }>(path)
      if (!set) throw new ToolError('Não consegui abrir o conjunto.')
      const brand = set.brand ?? neutralBrand(set.name)
      const fonts = await fontsFor([brand.headingFont, brand.bodyFont, brand.emphasisFont ?? ''])
      Criativos.setMeasureContext(fonts.ctx)
      if (set.pending?.length) {
        if (set.pendingBrand) throw new ToolError('Este conjunto ainda espera a marca do projeto: abra o link uma vez na Sinfy e tente de novo.')
        set.posts = [...(set.posts ?? []), ...set.pending.map((p) => Criativos.buildPost(p, brand) as BuiltPost)]
        delete set.pending
      }
      const build = (raw: unknown, i: number) => Criativos.buildPost(cleanPost(raw, caller, i), brand) as BuiltPost
      const postAt = (n: unknown) => {
        const post = set.posts[Math.max(1, Number(n) || 1) - 1]
        if (!post) throw new ToolError(`O post ${String(n ?? 1)} não existe (o conjunto tem ${set.posts.length}).`)
        return post
      }
      const slideIndex = (post: BuiltPost, n: unknown) => {
        const i = Math.max(1, Number(n) || 1) - 1
        if (!post.slides[i]) throw new ToolError(`O slide ${String(n)} não existe no post "${post.name}" (tem ${post.slides.length}).`)
        return i
      }
      const oneSlide = (post: BuiltPost, spec: unknown) => build({ name: post.name, format: post.format, slides: [spec] }, 0).slides[0]
      const changed = new Set<string>()
      const done: string[] = []
      const changes = (Array.isArray(a.mudancas) ? a.mudancas : []).slice(0, 40) as Record<string, unknown>[]
      if (!changes.length) throw new ToolError('Mande "mudancas".')
      for (const [k, c] of changes.entries()) {
        const tag = `mudança ${k + 1}`
        if (typeof c.nome_conjunto === 'string') { set.name = str(c.nome_conjunto, 80) ?? set.name; done.push(`${tag}: nome do conjunto`); continue }
        if (c.apagar_post !== undefined) {
          const post = postAt(c.apagar_post)
          if (set.posts.length === 1) throw new ToolError('É o único post do conjunto: refaça os slides em vez de apagar.')
          set.posts = set.posts.filter((p) => p !== post)
          done.push(`${tag}: post "${post.name}" apagado`)
          continue
        }
        if (c.novo_post !== undefined) {
          if (set.posts.length >= 20) throw new ToolError('Conjunto com 20 posts: crie outro conjunto.')
          const post = build(c.novo_post, set.posts.length)
          set.posts.push(post)
          changed.add(post.id)
          done.push(`${tag}: post novo "${post.name}"`)
          continue
        }
        const post = postAt(c.post)
        if (typeof c.legenda === 'string') { post.caption = c.legenda.trim().slice(0, 2200); done.push(`${tag}: legenda do post "${post.name}"`) }
        if (typeof c.nome === 'string') { post.name = str(c.nome, 80) ?? post.name; done.push(`${tag}: nome do post`) }
        if (c.texto && typeof c.texto === 'object') {
          const t = c.texto as { de?: unknown; para?: unknown }
          const from = String(t.de ?? '').trim().toLowerCase()
          const to = typeof t.para === 'string' ? t.para.trim().slice(0, 600) : ''
          if (!from || !to) throw new ToolError(`${tag}: "texto" precisa de "de" e "para".`)
          const slides = c.slide !== undefined ? [post.slides[slideIndex(post, c.slide)]] : post.slides
          const plain = (x: string) => x.replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
          const layer = slides.flatMap((s) => s.layers as TextL[]).find((l) => l.type === 'text' && typeof l.text === 'string' && (plain(l.text).includes(plain(from)) || l.text.toLowerCase().includes(from)))
          if (!layer) throw new ToolError(`${tag}: não achei "${String(t.de)}" ${c.slide !== undefined ? `no slide ${String(c.slide)}` : 'no post'}. Leia os textos com sinfy_criativo.`)
          const whole = plain(layer.text!) === plain(from)
          layer.text = whole ? to : layer.text!.replace(new RegExp(String(t.de).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), to)
          done.push(`${tag}: texto trocado no post "${post.name}"`)
        }
        if (c.refazer !== undefined) {
          const i = slideIndex(post, c.slide)
          post.slides[i] = oneSlide(post, c.refazer)
          done.push(`${tag}: slide ${i + 1} refeito`)
        }
        if (c.novo_slide !== undefined) {
          if (post.slides.length >= 10) throw new ToolError(`${tag}: o post já tem 10 slides (o máximo do Instagram).`)
          const at = Math.min(post.slides.length, Math.max(0, (Number(c.posicao) || post.slides.length + 1) - 1))
          post.slides.splice(at, 0, oneSlide(post, c.novo_slide))
          done.push(`${tag}: slide novo na posição ${at + 1}`)
        }
        if (c.apagar_slide !== undefined) {
          const i = slideIndex(post, c.apagar_slide)
          if (post.slides.length === 1) throw new ToolError(`${tag}: é o único slide do post; use apagar_post ou refazer.`)
          post.slides.splice(i, 1)
          done.push(`${tag}: slide ${i + 1} apagado`)
        }
        if (c.duplicar_slide !== undefined) {
          const i = slideIndex(post, c.duplicar_slide)
          if (post.slides.length >= 10) throw new ToolError(`${tag}: o post já tem 10 slides.`)
          const copy = JSON.parse(JSON.stringify(post.slides[i]))
          copy.id = crypto.randomUUID().slice(0, 8)
          post.slides.splice(i + 1, 0, copy)
          done.push(`${tag}: slide ${i + 1} duplicado`)
        }
        if (c.mover_slide && typeof c.mover_slide === 'object') {
          const m = c.mover_slide as { de?: unknown; para?: unknown }
          const i = slideIndex(post, m.de)
          const j = Math.min(post.slides.length - 1, Math.max(0, (Number(m.para) || 1) - 1))
          const [s] = post.slides.splice(i, 1)
          post.slides.splice(j, 0, s)
          done.push(`${tag}: slide ${i + 1} → ${j + 1}`)
        }
        changed.add(post.id)
      }
      set.updatedAt = Date.now()
      await writeJson(path, set)
      const index = (await readJson<Summary[]>(`${found.folder}/index.json`)) ?? []
      await writeJson(`${found.folder}/index.json`, index.map((x) => (x.id === found.id ? { ...x, name: set.name, posts: set.posts.length, updatedAt: set.updatedAt as number } : x)))
      const posts = set.posts.filter((p) => changed.has(p.id))
      let images: Picture[] = []
      try {
        images = await renderSlides(posts, set.assets ?? [], 540, 10)
      } catch (err) {
        console.error('[sinfy-mcp] prévia da edição', err)
      }
      return new WithImages(
        {
          ok: true,
          conjunto: found.id,
          feito: done,
          posts: set.posts.map((p, i) => ({ post: i + 1, nome: p.name, slides: p.slides.length, legenda: p.caption })),
          previa: images.length ? `${images.length} slide(s) dos posts mudados abaixo. Mostre à pessoa.` : undefined,
          link: setUrl(found.id, found.projectId),
          aviso: 'Se o conjunto estiver aberto no editor agora, recarregue a página antes de mexer lá, para não gravar por cima.',
        },
        images
      )
    },
  },
  {
    name: 'sinfy_publicar',
    title: 'Publicar ou agendar no Instagram',
    description: 'Publica ou agenda um post no Instagram (feed ou story). Sempre em 2 passos: sem "confirmar" mostra a prévia e o resumo; só depois do "pode" da pessoa, de novo com "confirmar": true. "quando": "agora" ou "AAAA-MM-DD HH:MM" (Brasília).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Id do conjunto de Criativos.' },
        projeto_id: { type: 'string' },
        post: { type: 'integer', minimum: 1, description: 'Qual post do conjunto (padrão 1).' },
        como: { type: 'string', enum: ['feed', 'story'], description: 'Padrão: story se o post é 9x16, feed nos outros.' },
        quando: { type: 'string', description: '"agora" ou "AAAA-MM-DD HH:MM" (Brasília).' },
        legenda: { type: 'string', description: 'Troca a legenda do post só nesta publicação (feed).' },
        confirmar: { type: 'boolean', description: 'true só depois de a pessoa ver e dizer que pode.' },
      },
      additionalProperties: false,
    },
    run: async (caller, a) => {
      need(caller, 'instagram', 'Instagram')
      need(caller, 'criativos', 'Criativos')
      const [acc] = await asUser(caller, (tx) => tx`select id, username, sync_error from crm_instagram_accounts where team_id = ${caller.team.id} order by connected_at limit 1`)
      if (!acc) throw new ToolError('A conta não tem Instagram conectado. Conecte em CRM › Instagram.')
      if (acc.sync_error === 'token') throw new ToolError(`A conexão do @${acc.username} caiu: reconecte em CRM › Instagram antes de publicar.`)
      const found = (await listSets(caller)).find((s) => s.id === a.id && (!a.projeto_id || s.projectId === a.projeto_id))
      if (!found) throw new ToolError('Conjunto não encontrado nesta conta.')
      const set = await readJson<{ name: string; brand?: Brand; posts: BuiltPost[]; pending?: unknown[]; pendingBrand?: boolean; assets?: { id: string; path: string }[] }>(`${found.folder}/${found.id}/set.json`)
      if (!set) throw new ToolError('Não consegui abrir o conjunto.')
      let posts = set.posts ?? []
      if (set.pending?.length) {
        if (set.pendingBrand) throw new ToolError('Este conjunto ainda espera a marca do projeto: abra o link uma vez na Sinfy antes de publicar.')
        const brand = set.brand ?? neutralBrand(set.name)
        const fonts = await fontsFor([brand.headingFont, brand.bodyFont, brand.emphasisFont ?? ''])
        Criativos.setMeasureContext(fonts.ctx)
        posts = [...posts, ...set.pending.map((p) => Criativos.buildPost(p, brand) as BuiltPost)]
      }
      const index = Math.max(1, Number(a.post) || 1) - 1
      const post = posts[index]
      if (!post) throw new ToolError(`O post ${index + 1} não existe (o conjunto tem ${posts.length}).`)
      const kind = a.como === 'feed' || a.como === 'story' ? a.como : post.format === '9x16' ? 'story' : 'feed'
      if (kind === 'feed' && post.format === '9x16') throw new ToolError('Post 9x16 não vai ao feed (o Instagram corta). Publique como story ou faça a versão 4x5.')
      if (post.slides.length > 10) throw new ToolError('No máximo 10 slides por post.')
      const missing = post.slides.findIndex((s) => s.layers.some((l) => l.type === 'image' && !l.hidden && !l.src))
      if (missing >= 0) throw new ToolError(`O slide ${missing + 1} ainda espera a foto: ponha com sinfy_criativo_foto ou gere no editor (${setUrl(found.id, found.projectId)}).`)
      const caption = typeof a.legenda === 'string' ? a.legenda.trim().slice(0, 2200) : (post.caption ?? '').slice(0, 2200)
      const at = whenOf(a.quando)
      const now = at.getTime() <= Date.now() + 60_000
      const summary = {
        conta: `@${acc.username}`,
        como: kind === 'feed' ? (post.slides.length > 1 ? `carrossel no feed (${post.slides.length} imagens)` : 'foto no feed') : `${post.slides.length} story(s)`,
        quando: now ? 'agora (sai em 1 a 2 minutos)' : `${brt(at)} (Brasília)`,
        legenda: kind === 'feed' ? caption || '(sem legenda)' : undefined,
      }
      if (a.confirmar !== true) {
        const images = await renderSlides([post], set.assets ?? [], 540, 10)
        return new WithImages({ ...summary, pronto: true, proximo_passo: 'Mostre as imagens e o resumo à pessoa e pergunte se pode publicar. Só com o "pode" dela, chame de novo com "confirmar": true.' }, images)
      }
      const storyId = crypto.randomUUID()
      const jpgs = await renderJpegs(post, set.assets ?? [], 1080)
      const stamp = Date.now().toString(36)
      const frames: { path: string; type: 'image' }[] = []
      for (const [i, bytes] of jpgs.entries()) {
        const path = `crm/${caller.team.id}/instagram/stories/${storyId}/${i + 1}-${stamp}.jpg`
        const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
        if (error) throw new ToolError(`Não consegui preparar a imagem ${i + 1} (${error.message}).`)
        frames.push({ path, type: 'image' })
      }
      const title = `${set.name} · ${post.name}`.slice(0, 200)
      try {
        // Como na tela: entra como criativo e a aprovação (quem chamou) põe as telas e agenda
        await asUser(caller, async (tx) => {
          await tx`insert into crm_stories (id, team_id, account_id, publish_at, status, kind, title, caption, set_id, post_id, created_by)
            values (${storyId}::uuid, ${caller.team.id}::uuid, ${acc.id}::uuid, ${at.toISOString()}::timestamptz, 'criativo', ${kind}, ${title}, ${kind === 'feed' ? caption : ''}, ${found.id}, ${post.id}, ${caller.userId}::uuid)`
          await tx`update crm_stories set status = 'agendado', frames = ${JSON.stringify(frames)}::text::jsonb where id = ${storyId}::uuid`
        })
      } catch (err) {
        await admin.storage.from(BUCKET).remove(frames.map((f) => f.path))
        console.error('[sinfy-mcp] fila', err)
        throw new ToolError(`A fila de publicação recusou: ${err instanceof Error ? err.message : 'erro'}.`)
      }
      return { ok: true, publicacao: storyId, ...summary, acompanhar: 'sinfy_publicacoes mostra quando sair, com o link do post, ou o erro. Para desistir antes da hora: sinfy_publicacoes com "cancelar".' }
    },
  },
  {
    name: 'sinfy_publicacoes',
    title: 'Publicações agendadas',
    description: 'A fila de publicação do Instagram (agendado, publicado, falhou, com link). "cancelar": id de uma ainda agendada.',
    inputSchema: { type: 'object', properties: { cancelar: { type: 'string' }, limite: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false },
    run: async (caller, a) => {
      need(caller, 'instagram', 'Instagram')
      if (typeof a.cancelar === 'string' && a.cancelar) {
        const rows = await asUser(caller, (tx) => tx`update crm_stories set status = 'descartado' where id = ${a.cancelar as string}::uuid and team_id = ${caller.team.id}::uuid and status = 'agendado' returning id`)
        if (!rows.length) throw new ToolError('Não achei essa publicação agendada (pode já ter saído ou estar saindo agora).')
        return { ok: true, cancelada: a.cancelar }
      }
      const rows = await asUser(caller, (tx) => tx`select id, kind, title, status, publish_at, published_at, error, frames from crm_stories where team_id = ${caller.team.id}::uuid and status in ('agendado', 'publicando', 'publicado', 'falhou') order by publish_at desc limit ${Math.min(50, Number(a.limite) || 15)}`)
      return rows.map((r) => ({
        publicacao: r.id,
        tipo: r.kind === 'feed' ? 'post do feed' : r.kind === 'reel' ? 'reels' : 'story',
        titulo: r.title,
        status: r.status,
        quando: brt(new Date(r.publish_at)),
        erro: r.error ?? undefined,
        link: (Array.isArray(r.frames) ? r.frames : []).map((f: { permalink?: string }) => f.permalink).find(Boolean),
      }))
    },
  },
  {
    name: 'sinfy_site',
    title: 'Métricas do site',
    description: 'Visitas do site no período: totais, origem, campanhas, páginas, contatos, aparelhos, cidades e vendas.',
    inputSchema: { type: 'object', properties: { periodo: PERIOD }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'site', 'Site')
      return siteData(admin, caller.team.id, periodOf(a.periodo))
    },
  },
  {
    name: 'sinfy_anuncios',
    title: 'Anúncios da Meta',
    description: 'Campanhas e anúncios da Meta no período: gasto, alcance, cliques, leads, conversas, por campanha e anúncio. Só leitura.',
    inputSchema: { type: 'object', properties: { periodo: PERIOD }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'instagram', 'Instagram e Anúncios')
      return adsData(admin, caller.team.id, periodOf(a.periodo))
    },
  },
  {
    name: 'sinfy_instagram',
    title: 'Instagram',
    description: 'O Instagram da conta: perfil, seguidores, totais do período, público e os posts ordenados por alcance.',
    inputSchema: { type: 'object', properties: { periodo: PERIOD }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'instagram', 'Instagram')
      return instagramData(admin, caller.team.id, periodOf(a.periodo))
    },
  },
  {
    name: 'sinfy_funil',
    title: 'Funil de vendas',
    description: 'O funil de vendas: cartões e valor por etapa, leads novos por canal, vendas e leads recentes.',
    inputSchema: { type: 'object', properties: { periodo: PERIOD }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'crm', 'CRM')
      return funnelData(admin, caller.team.id, periodOf(a.periodo))
    },
  },
]

// A plataforma inteira (dados, WhatsApp, formulários), como a pessoa da chave
TOOLS.push(...(platformTools({ admin, appUrl: APP_URL, fail: (m) => { throw new ToolError(m) } }) as unknown as Tool[]))
// Cérebro, quadros, referências e a inteligência de Instagram (o que antes só a Iara fazia)
TOOLS.push(...(areaTools({ admin, appUrl: APP_URL, fail: (m) => { throw new ToolError(m) } }) as unknown as Tool[]))

const PROMPTS = [
  {
    name: 'criar_criativos_do_plano',
    title: 'Criar criativos do Plano',
    description: 'Lê a conta e o Plano, escolhe os conteúdos sem criativo e cria os posts na marca.',
    arguments: [{ name: 'quantos', description: 'Quantos conteúdos (padrão 3).', required: false }],
    text: (args: Record<string, string>) =>
      `Use as ferramentas da Sinfy. 1) sinfy_conta para entender a empresa, o Plano e a marca. 2) sinfy_conteudos para achar até ${args.quantos || 3} conteúdos sem criativo (prefira os em produção ou revisão). 3) Para cada um, sinfy_criativo_criar com conteudo_id, seguindo o roteiro, no tom e para o público do Plano. 4) Me mostre os links e um resumo de cada post.`,
  },
  {
    name: 'analisar_resultados',
    title: 'Analisar resultados',
    description: 'Cruza site, anúncios, Instagram e funil e propõe o que fazer.',
    arguments: [{ name: 'periodo', description: 'hoje, 7, 30, 90 ou mes (padrão 30).', required: false }],
    text: (args: Record<string, string>) =>
      `Use as ferramentas da Sinfy com o período "${args.periodo || '30'}". Leia sinfy_conta, sinfy_anuncios, sinfy_site, sinfy_instagram e sinfy_funil. Diga em poucos pontos: de onde vêm os contatos e as vendas, quanto custa cada um, o que melhorou ou piorou contra o período anterior, quais posts e anúncios funcionaram e por quê. Termine com 3 a 5 ações para a próxima semana, incluindo ideias de conteúdo que eu possa criar com sinfy_conteudo_criar e sinfy_criativo_criar.`,
  },
]

// As regras longas saíram das descrições (custo fixo de tokens em toda conversa) e ficam no guia
GUIDE.modelos = [
      'Cria posts de Instagram (feed, carrossel ou story) na marca da empresa, dentro dos Criativos da Sinfy. Você escreve o roteiro de cada slide (o modelo e os textos); a Sinfy monta na identidade da conta (cores, fontes, logo) e devolve a IMAGEM de cada slide para você mostrar à pessoa no chat, mais o link para editar, gerar as fotos e publicar.',
      'Antes: leia sinfy_conta (Plano e marca). Se houver um conteúdo do Plano, passe o id em conteudo_id e siga o roteiro dele.',
      'Modelos de slide (campos entre parênteses):',
      '- manifesto: título grande e uma frase; abre ou fecha uma ideia (label, title, body, dark).',
      '- lista: pergunta e 3 a 4 linhas curtas que o público reconhece (label, title, items).',
      '- cta: chamada final com botão (label, title, cta = texto do botão, body = contato).',
      '- viral-frase: uma ideia em letras grandes com rótulo e frase de apoio (label, title, body, dark).',
      '- viral-dado: número enorme até 4 caracteres ("73%", "5 s") e o que quer dizer (number, title, body = de onde vem o número). Só números verdadeiros.',
      '- viral-capa: foto gerada em tela cheia com título pesado embaixo (prompt, title, body, label). Boa para abrir.',
      '- foto-manchete: foto gerada em tela cheia com manchete no alto (prompt, title, body).',
      '- viral-foto: foto gerada em cima, número da tela e título embaixo (prompt, number "02", title, body, dark).',
      '- viral-fecho: fechamento do carrossel com chamada (title, body, cta).',
      'Regras: title com até ~70 caracteres; marque UMA palavra de destaque por título com *asteriscos*; label curto (até 4 palavras). prompt descreve a cena da foto EM INGLÊS, concreta, sem texto, logotipo ou rosto conhecido (a foto é gerada depois, no editor). Use foto em no máximo 2 ou 3 slides. Carrossel: capa com gancho, um slide por ideia, último slide cta. Story (9x16): uma tela por slide, sem "arraste", "link na bio" nem viral-fecho; o último convida a responder ou mandar DM. caption: a legenda, até ~900 caracteres, no máximo 4 hashtags no fim. Nunca invente números, depoimentos, preços ou resultados.',
    ].join('\n')
GUIDE.editar_criativo = [
      'Edita um conjunto de Criativos que já existe, sem criar outro: troca o texto de um slide mantendo o desenho, muda a legenda ou o nome, refaz um slide com outro modelo, apaga, duplica ou move slides, apaga um post ou acrescenta um post novo. SEMPRE use esta ferramenta para ajustes; sinfy_criativo_criar é só para um conjunto novo.',
      'Leia antes com sinfy_criativo (os textos de cada slide) e mostre o resultado à pessoa (a resposta traz a prévia dos posts mudados).',
      'Mudanças (lista, aplicadas em ordem; post e slide contam a partir de 1):',
      '- {"post":1,"slide":2,"texto":{"de":"trecho do texto atual","para":"texto novo"}}: troca o texto da camada que contém "de" (marque o destaque com *asteriscos*).',
      '- {"post":1,"legenda":"..."} · {"post":1,"nome":"..."} · {"nome_conjunto":"..."}',
      '- {"post":1,"slide":2,"refazer":SLIDE} (o mesmo SLIDE de sinfy_criativo_criar: template, title, body…; a foto do slide se perde, peça de novo com "prompt").',
      '- {"post":1,"novo_slide":SLIDE,"posicao"?:3} · {"post":1,"apagar_slide":2} · {"post":1,"duplicar_slide":2} · {"post":1,"mover_slide":{"de":4,"para":2}}',
      '- {"apagar_post":2} · {"novo_post":POST} (o mesmo POST de sinfy_criativo_criar).',
    ].join('\n')
GUIDE.formulario = [
        'Cria ou muda um formulário ou quiz da conta, que tem página pública própria (link /f/<id>) e pode ir no site. Bom para testar uma oferta: a página com a proposta, as perguntas que qualificam e o botão de WhatsApp no fim. As respostas caem em Leads (crm_form_submissions) e viram oportunidade.',
        'definicao: {"kind":"form"|"quiz","steps":[{"title","description","fields":[{"id","type","label","help","placeholder","required","options":[{"id","label","score"}],"map":"name"|"email"|"phone"|"message","width":"half"}]}],"results":[{"min","title","text","ctaLabel","ctaUrl","qualified"}]}. Tipos de campo: short, long, email, phone, number, choice, multi, select, yesno, rating. Use map para nome, e-mail e telefone. No quiz, cada opção soma score e o resultado sai pela faixa (min).',
        'tema: {"primary","background","text","field","radius","font":"inherit"|"Inter"|"system","frame":"card"|"plain"}. config: {"submitLabel","nextLabel","successTitle","successText","redirectUrl","whatsapp":{"number","text"},"autoAdvance","showProgress","footnote"}.',
        'publicar=true deixa a página no ar; sem isso fica rascunho. Para mudar, mande o id.',
      ].join('\n')

// As skills de Instagram, como prompts (no Claude: menu + › Sinfy)
PROMPTS.push(...skillPrompts())


// ---------- ao vivo nas telas ----------

/** Os campos que dizem ONDE a ferramenta mexe (nunca o conteúdo). */
const WHERE_KEYS = ['id', 'conjunto', 'projeto_id', 'post', 'slide', 'quadro', 'tabela', 'nota', 'pasta', 'conteudo_id', 'como', 'quando']

/**
 * Aviso no canal privado `mcp:<conta>` (migração 20261112160000), por `realtime.send` no banco: a tela aberta mostra o cursor da IA indo até
 * o que ela mexe e recarrega o que mudou. Sem conteúdo no aviso; falha no aviso nunca derruba a ferramenta.
 */
function liveEvent(caller: Caller, tool: Tool, phase: 'start' | 'done', args: Args, extra: Record<string, unknown> = {}) {
  const where: Record<string, unknown> = {}
  for (const k of WHERE_KEYS) if (args[k] !== undefined && (typeof args[k] !== 'string' || (args[k] as string).length <= 120)) where[k] = args[k]
  const payload = { phase, tool: tool.name, titulo: tool.title, muda: !tool.annotations?.readOnlyHint, onde: where, ia: caller.who?.ia ?? 'IA', pessoa: caller.who?.pessoa ?? '', at: Date.now(), ...extra }
  return liveSend(`mcp:${caller.team.id}`, 'ia', payload)
}

// ---------- JSON-RPC ----------

interface Rpc { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }

const result = (id: Rpc['id'], value: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result: value })
const failure = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function handle(msg: Rpc, caller: Caller) {
  const p = msg.params ?? {}
  switch (msg.method) {
    case 'initialize': {
      const asked = String(p.protocolVersion ?? '')
      return result(msg.id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER,
        instructions: `Você está conectado à conta "${caller.team.name}" na Sinfy e age como a pessoa da chave (só faz o que ela pode na tela). Comece por sinfy_conta (empresa, Plano, marca). Em dúvida sobre como fazer algo, leia sinfy_ajuda (tópicos: post, pauta, crm, quadros, cerebro, instagram, dados). Regras: escreva no tom do Plano, sem inventar números, preços, depoimentos ou resultados. Para ajustar algo que já existe, edite (sinfy_criativo_editar, sinfy_conteudo_atualizar, sinfy_oportunidade_salvar, sinfy_quadro_editar); não crie outro. Publicar (sinfy_publicar), aprovar, mandar mensagem a cliente, fechar ou perder oportunidade e apagar pedem o "pode" explícito da pessoa: mostre antes e só então chame com confirmar. Sempre mostre à pessoa as imagens que as ferramentas devolvem e passe os links.`,
      })
    }
    case 'ping':
      return result(msg.id, {})
    case 'tools/list':
      return result(msg.id, { tools: TOOLS.map(({ run: _run, ...t }) => t) })
    case 'prompts/list':
      return result(msg.id, { prompts: PROMPTS.map(({ text: _t, ...rest }) => rest) })
    case 'prompts/get': {
      const prompt = PROMPTS.find((x) => x.name === p.name)
      if (!prompt) return failure(msg.id, -32602, 'Prompt não encontrado.')
      return result(msg.id, { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: prompt.text((p.arguments ?? {}) as Record<string, string>) } }] })
    }
    case 'resources/list':
      return result(msg.id, { resources: [] })
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === p.name)
      if (!tool) return failure(msg.id, -32602, `Ferramenta desconhecida: ${String(p.name)}`)
      let ok = true
      let errorText: string | undefined
      let payload: { content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[]; structuredContent?: unknown; isError?: boolean }
      const args = (p.arguments ?? {}) as Args
      const started = liveEvent(caller, tool, 'start', args)
      const made: Record<string, unknown> = {}
      try {
        const value = await tool.run(caller, args)
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const v = (value instanceof WithImages ? value.value : value) as Record<string, unknown>
          // O que a ferramenta criou (para a tela abrir e o cursor achar)
          for (const k of ['conjunto', 'quadro', 'publicacao', 'referencia', 'nota', 'arquivo']) if (typeof v[k] === 'string') made[k] = v[k]
          if (v.conteudo && typeof v.conteudo === 'object') made.conteudo = (v.conteudo as { id?: string }).id
        }
        if (value instanceof WithImages) payload = { content: [{ type: 'text', text: JSON.stringify(value.value) }, ...value.images.map((img) => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType }))] }
        else if (value && typeof value === 'object' && Array.isArray((value as { __imagens?: unknown }).__imagens)) {
          const { __imagens, ...rest } = value as { __imagens: { data: string; mimeType: string }[] }
          payload = { content: [{ type: 'text', text: JSON.stringify(rest) }, ...__imagens.map((img) => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType }))] }
        } else {
          payload = { content: [{ type: 'text', text: JSON.stringify(value) }] }
          if (value && typeof value === 'object' && !Array.isArray(value)) payload.structuredContent = value
        }
      } catch (err) {
        ok = false
        const text = err instanceof ToolError ? err.message : 'Algo deu errado do lado da Sinfy. Tente de novo em instantes.'
        errorText = (err instanceof ToolError ? err.message : `interno: ${err instanceof Error ? err.message : String(err)}`).slice(0, 500)
        if (!(err instanceof ToolError)) console.error('[sinfy-mcp]', tool.name, err)
        payload = { content: [{ type: 'text', text }], isError: true }
      }
      await started
      await Promise.all([
        admin.from('crm_mcp_log').insert({ key_id: caller.keyId, team_id: caller.team.id, tool: tool.name, ok, error: errorText ?? null }),
        liveEvent(caller, tool, 'done', args, { ok, criado: made, erro: ok ? undefined : errorText?.slice(0, 160) }),
      ])
      return result(msg.id, payload)
    }
    default:
      if (msg.id === undefined || msg.id === null) return null // notificação (initialized, cancelled…)
      return failure(msg.id, -32601, `Método não suportado: ${msg.method}`)
  }
}


// ---------- link de envio de fotos ----------

async function handleUpload(request: Request, token: string) {
  const { data: row } = await admin.from('crm_mcp_uploads').select('id, team_id, folder, files, max_files, expires_at').eq('token_hash', await sha256(token)).maybeSingle()
  if (!row) return json({ error: 'Link de envio inválido.' }, 404)
  const expired = Date.parse(row.expires_at) < Date.now()
  const left = row.max_files - (row.files?.length ?? 0)
  if (request.method === 'GET') {
    const { data: team } = await admin.from('crm_teams').select('name').eq('id', row.team_id).maybeSingle()
    return json({ conta: team?.name ?? '', pasta: row.folder, restantes: Math.max(0, left), expirado: expired, enviados: row.files ?? [] })
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'GET, POST, OPTIONS', ...cors } })
  if (expired) return json({ error: 'Este link venceu. Peça um novo à sua IA.' }, 410)
  if (left <= 0) return json({ error: 'Este link já recebeu o máximo de fotos. Peça um novo à sua IA.' }, 409)
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (!bytes.length) return json({ error: 'Arquivo vazio.' }, 400)
  if (bytes.length > 15 * 1024 * 1024) return json({ error: 'Foto grande demais (até 15 MB).' }, 413)
  const mime = sniffMime(bytes)
  if (!mime) return json({ error: 'Só fotos JPEG, PNG, WebP ou GIF.' }, 415)
  const name = decodeURIComponent(request.headers.get('x-file-name') ?? 'foto').slice(0, 120)
  try {
    const path = await saveBrainImage(admin, row.team_id, row.folder, name, bytes, mime)
    await admin.from('crm_mcp_uploads').update({ files: [...(row.files ?? []), path] }).eq('id', row.id)
    // Ao vivo: o Cérebro aberto recarrega e o aviso mostra que a foto chegou
    const live = await liveSend(`mcp:${row.team_id}`, 'ia', { phase: 'upload', tool: 'envio', muda: true, onde: { pasta: row.folder }, ia: 'Link de envio', pessoa: '', at: Date.now(), ok: true, criado: { arquivo: path } })
    return json({ ok: true, arquivo: path, restantes: left - 1, ...(live ? { ao_vivo: live } : {}) })
  } catch (err) {
    console.error('[sinfy-mcp] envio', err)
    return json({ error: 'Não consegui guardar a foto. Tente de novo.' }, 500)
  }
}

const tokenOf = (request: Request, url: URL) => {
  const auth = request.headers.get('authorization') ?? ''
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim()
  const fromQuery = url.searchParams.get('key')
  if (fromQuery) return fromQuery.trim()
  // /functions/v1/sinfy-mcp/<chave> (o caminho chega como /sinfy-mcp/<chave>)
  const last = url.pathname.split('/').filter(Boolean).pop() ?? ''
  return last.startsWith('sfy_') ? last : ''
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const url = new URL(request.url)
  // Link de envio (/sinfy-mcp/enviar/<token>): a página /enviar do app manda as fotos para o Cérebro
  const sent = /\/enviar\/(env_[0-9a-f]{48})\/?$/.exec(url.pathname)
  if (sent) return handleUpload(request, sent[1])

  // Sem sessão e sem fluxo do servidor: GET (SSE) e DELETE não se aplicam
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST, OPTIONS', ...cors } })

  const caller = await resolveCaller(tokenOf(request, url))
  if (!caller) return json(failure(null, -32001, 'Chave da Sinfy inválida ou revogada. Gere uma em Sinfy › Plano › Conectar sua IA.'), 401)

  const text = await request.text()
  if (text.length > MAX_BODY) return json(failure(null, -32600, 'Pedido grande demais.'), 413)
  let body: Rpc | Rpc[]
  try {
    body = JSON.parse(text)
  } catch {
    return json(failure(null, -32700, 'JSON inválido.'), 400)
  }

  const list = Array.isArray(body) ? body : [body]
  const answers = (await Promise.all(list.map((m) => (m && m.method ? handle(m, caller) : Promise.resolve(failure(null, -32600, 'Pedido inválido.')))))).filter(Boolean)
  if (!answers.length) return new Response(null, { status: 202, headers: cors })
  return json(Array.isArray(body) ? answers : answers[0])
})
