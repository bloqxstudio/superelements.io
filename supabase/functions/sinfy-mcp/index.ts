import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as opentypeNs from 'npm:opentype.js@1.3.4'
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2'
import { adsData, funnelData, instagramData, periodOf, siteData } from './dados.ts'
import * as Criativos from './_gerado/criativos.js'
import { loadFamilies, measureContext, rasterize, sniff, toBase64, type FontLib, type ResvgLike } from './previa.ts'
import { fetchFile, platformTools } from './plataforma.ts'
import { areaTools, skillPrompts } from './areas.ts'

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
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id, accept',
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
}

const moduleOn = (team: Team, key: string) => team.status !== 'pausada' && (team.modules ?? {})[key] !== false

async function resolveCaller(token: string): Promise<Caller | null> {
  if (!/^sfy_[0-9a-f]{48}$/.test(token)) return null
  const { data, error } = await admin.rpc('crm_mcp_resolve', { p_hash: await sha256(token) })
  const row = (Array.isArray(data) ? data[0] : data) as { key_id: string; team_id: string; user_id: string; role: string } | undefined
  if (error || !row) return null
  const { data: team } = await admin.from('crm_teams').select('id, name, segment, website, contact_name, notes, status, modules, is_home, product').eq('id', row.team_id).maybeSingle()
  if (!team) return null
  return { keyId: row.key_id, userId: row.user_id, role: row.role, team: team as Team }
}

class ToolError extends Error {}

const ERRORS: Record<string, string> = {
  so_gestor: 'Só dono ou gestor da conta muda o Plano. Peça para um gestor, ou use a chave de um gestor.',
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
    description:
      'Comece por aqui. Devolve quem é a empresa desta conta (nome, segmento, site, observações), o Cérebro da conta (visão geral e a marca escrita, a fonte de verdade sobre a empresa), o Plano da empresa (oferta, público, tom de voz, objetivo, restrições e pilares de conteúdo), a marca usada nos criativos (cores e fontes), os projetos, os módulos ligados e os canais conectados. Use isso como contexto de tudo que escrever ou criar para a empresa: escreva no tom dela, para o público dela e respeite as restrições.',
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
    description: 'Grava o Plano da empresa (o contexto que todo conteúdo e criativo reaproveita). Só dono ou gestor. Mande só os campos que mudam; os outros ficam como estão. Confirme com a pessoa antes de gravar.',
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
    description: 'Lista os conteúdos do Plano editorial da conta (ideia → produção → revisão → aprovado), do mais recente ao mais antigo, com título, formato, status, data editorial e roteiro.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ideia', 'producao', 'revisao', 'aprovado'], description: 'Filtra por status.' },
        limite: { type: 'integer', minimum: 1, maximum: 100, description: 'Quantos (padrão 30).' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: async (caller, a) => {
      need(caller, 'copy', 'Conteúdos (Copy)')
      let q = admin.from('crm_contents').select('*').eq('team_id', caller.team.id).order('updated_at', { ascending: false }).limit(Math.min(100, Math.max(1, Number(a.limite) || 30)))
      if (typeof a.status === 'string') q = q.eq('status', a.status)
      const { data, error } = await q
      if (error) throw new ToolError('Não consegui ler os conteúdos.')
      const ids = (data ?? []).map((c) => c.id)
      const { data: links } = ids.length ? await admin.from('crm_content_links').select('content_id, kind, artifact_id, project_id').in('content_id', ids) : { data: [] }
      return (data ?? []).map((c) => {
        const own = (links ?? []).filter((l) => l.content_id === c.id)
        const set = own.find((l) => l.kind === 'criativos')
        return { ...slimContent(c), roteiro: String(c.script ?? '').slice(0, 1200), criativo: set ? setUrl(set.artifact_id, set.project_id ?? undefined, c.id) : null, tem_texto_no_copy: own.some((l) => l.kind === 'copy') }
      })
    },
  },
  {
    name: 'sinfy_conteudo_criar',
    title: 'Criar conteúdo no Plano',
    description: 'Cria um conteúdo no Plano editorial da conta (nasce como "ideia"). Escreva no tom e para o público do Plano (leia sinfy_conta antes). Para vários, chame uma vez por conteúdo. Depois, sinfy_criativo_criar com o id deste conteúdo gera o criativo ligado a ele.',
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
    description: 'Muda título, ideia, objetivo, formato, roteiro ou data de um conteúdo, e pode mandá-lo para "producao" ou "revisao". Aprovar não é possível por aqui: aprovação é sempre de uma pessoa, na tela.',
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
        status: { type: 'string', enum: ['ideia', 'producao', 'revisao'] },
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
      if (a.data_editorial !== undefined) patch.editorialDate = typeof a.data_editorial === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.data_editorial) ? a.data_editorial : null
      let row = cur as Record<string, unknown>
      if (Object.keys(patch).length) row = await callAs(caller, 'crm_content_save', { p_id: cur.id, p_expected: row.version, p_data: patch })
      if (typeof a.status === 'string' && a.status !== row.status) row = await callAs(caller, 'crm_content_transition', { p_id: cur.id, p_expected: row.version, p_to: a.status })
      return { ok: true, conteudo: slimContent(row) }
    },
  },
  {
    name: 'sinfy_criativo_criar',
    title: 'Criar criativos na marca',
    description: [
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
    ].join('\n'),
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
          proximo_passo: 'Mostre a prévia à pessoa e pergunte o que ajustar. Para mudar, crie de novo com os textos ajustados; para editar à mão, gerar as fotos pedidas e publicar, abra o link.',
        },
        images
      )
    },
  },
  {
    name: 'sinfy_criativos',
    title: 'Listar criativos',
    description: 'Lista os conjuntos de Criativos da conta (os da pessoa da chave e os dos projetos da conta), com link para abrir.',
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
    description: 'Lê um conjunto de Criativos: os textos de cada slide e a legenda de cada post (para revisar, reaproveitar ou criar variações).',
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
    description: 'Mostra a imagem de cada slide de um post de um conjunto de Criativos, como vai ficar (marca, textos e fotos já geradas). Use para mostrar à pessoa o que está sendo entregue. Fotos ainda não geradas aparecem como um bloco listrado.',
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
    description: 'Sobe uma foto (url https ou base64) para um conjunto de Criativos e põe num slide: no lugar da foto pedida ainda não gerada, ou trocando a imagem do slide. Devolve a prévia do slide com a foto.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Id do conjunto.' },
        projeto_id: { type: 'string' },
        post: { type: 'integer', minimum: 1, description: 'Post do conjunto (padrão 1).' },
        slide: { type: 'integer', minimum: 1, description: 'Slide do post (padrão 1).' },
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
      const target = images.find((l) => !l.src && l.prompt) ?? images.find((l) => !(l.name ?? '').toLowerCase().includes('logo') && !(l.src ?? '').includes('/logo')) ?? undefined
      if (!target) throw new ToolError('Este slide não tem lugar de foto. Use um modelo com foto (viral-capa, foto-manchete, viral-foto) ou ponha a foto noutro slide.')
      const file = await fetchFile({ admin, appUrl: APP_URL, fail: (m) => { throw new ToolError(m) } }, a, 15 * 1024 * 1024)
      const info = sniff(file.bytes)
      if (!info || !info.mime.startsWith('image/')) throw new ToolError('O arquivo não é uma imagem que eu reconheça (PNG, JPEG, WebP ou GIF).')
      const assetId = crypto.randomUUID().slice(0, 8)
      const assetPath = `${found.folder}/${found.id}/${assetId}.${info.mime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`
      const { error } = await admin.storage.from(BUCKET).upload(assetPath, file.bytes, { contentType: info.mime, upsert: false })
      if (error) throw new ToolError(`Não consegui subir a foto (${error.message}).`)
      set.assets = [...(set.assets ?? []), { id: assetId, name: file.name, path: assetPath, width: info.width, height: info.height }]
      target.src = `asset:${assetId}`
      delete target.prompt
      delete target.genFailed
      set.updatedAt = Date.now()
      await writeJson(path, set)
      const index = (await readJson<Summary[]>(`${found.folder}/index.json`)) ?? []
      await writeJson(`${found.folder}/index.json`, index.map((s) => (s.id === found.id ? { ...s, posts: set.posts.length, updatedAt: set.updatedAt as number } : s)))
      const preview = await renderSlides([{ ...post, slides: [slide] }], set.assets, 540, 1)
      return new WithImages({ ok: true, conjunto: found.id, post: Number(a.post) || 1, slide: Number(a.slide) || 1, link: setUrl(found.id, found.projectId), aviso: 'Se o conjunto estiver aberto no editor agora, recarregue a página para não gravar por cima.' }, preview)
    },
  },
  {
    name: 'sinfy_site',
    title: 'Métricas do site',
    description: 'Visitas do site da conta no período: totais e período anterior, por dia, canais de origem, campanhas e anúncios que trouxeram visitas, páginas, entradas, cliques, eventos, contatos (WhatsApp, telefone, formulário), aparelhos, estados, cidades, horários e loja (vendas e faturamento, quando há). Use para analisar o que funciona e sugerir conteúdos e ajustes.',
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
    description: 'Campanhas e anúncios da Meta (Facebook e Instagram) da conta no período, do relatório que a Sinfy guarda: valor usado, alcance, impressões, cliques no link, leads, conversas, por dia, por campanha, por anúncio, por estado, idade e gênero e plataforma. Só leitura: nada muda campanha ou orçamento.',
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
    description: 'O Instagram da conta: perfil e bio, seguidores, totais de 7 ou 30 dias (alcance, visualizações, interações, toques no link), público, alcance e seguidores por dia e os posts do período ordenados por alcance, com legenda e números. Use para ver o que o público responde e planejar os próximos criativos.',
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
    description: 'O funil da conta: cartões e valor por etapa, leads novos no período e por canal (Google Ads, Meta Ads, orgânico…), vendas fechadas e os leads recentes com empresa, etapa, canal e campanha. Sem telefone nem e-mail dos clientes.',
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

// As skills de Instagram, como prompts (no Claude: menu + › Sinfy)
PROMPTS.push(...skillPrompts())

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
        instructions: `Você está conectado à conta "${caller.team.name}" na Sinfy. Comece por sinfy_conta para saber quem é a empresa, o Plano (oferta, público, tom, restrições) e a marca. Escreva sempre em nome desta empresa, no tom do Plano, sem inventar números, preços, depoimentos ou resultados. Você opera a plataforma como a pessoa da chave: leia e grave dados (sinfy_dados_*), veja e responda o WhatsApp, crie páginas de oferta (sinfy_formulario_salvar) e criativos. Antes de enviar mensagem a um cliente, apagar ou mudar muitas linhas, mostre o que vai fazer e confirme com a pessoa. Criativos ficam como rascunho na Sinfy; nada é publicado nem aprovado por aqui. Quando uma ferramenta devolver imagens dos slides, mostre-as à pessoa.`,
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
      let payload: { content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[]; structuredContent?: unknown; isError?: boolean }
      try {
        const value = await tool.run(caller, (p.arguments ?? {}) as Args)
        if (value instanceof WithImages) payload = { content: [{ type: 'text', text: JSON.stringify(value.value) }, ...value.images.map((img) => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType }))] }
        else {
          payload = { content: [{ type: 'text', text: JSON.stringify(value) }] }
          if (value && typeof value === 'object' && !Array.isArray(value)) payload.structuredContent = value
        }
      } catch (err) {
        ok = false
        const text = err instanceof ToolError ? err.message : 'Algo deu errado do lado da Sinfy. Tente de novo em instantes.'
        if (!(err instanceof ToolError)) console.error('[sinfy-mcp]', tool.name, err)
        payload = { content: [{ type: 'text', text }], isError: true }
      }
      await admin.from('crm_mcp_log').insert({ key_id: caller.keyId, team_id: caller.team.id, tool: tool.name, ok })
      return result(msg.id, payload)
    }
    default:
      if (msg.id === undefined || msg.id === null) return null // notificação (initialized, cancelled…)
      return failure(msg.id, -32601, `Método não suportado: ${msg.method}`)
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
  // Sem sessão e sem fluxo do servidor: GET (SSE) e DELETE não se aplicam
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST, OPTIONS', ...cors } })

  const url = new URL(request.url)
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
