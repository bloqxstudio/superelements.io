import { supabase } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadContext } from '@/features/conteudos/api'
import { coverUrls, listSets, loadSet, rememberOwners } from '@/features/criativos/storage'
import type { CreativeSet, SetSummary } from '@/features/criativos/types'
import { AUTO_FOLDER, type Vault, type VaultMedia, type VaultNote } from './vault'
import { DESIGN_PATH, forgetStandard, saveBrand } from './standard'

/**
 * O cérebro de uma conta (2026-11-07, o usuário: "não precisa vincular ao github… uma base de
 * conhecimento interna do app… somente daquela empresa"). Tudo no app, nada no repositório:
 *   - notas: `crm_knowledge_notes` (migração 20261107100000), uma linha por caminho, só da equipe;
 *   - arquivos: bucket `space-projects` em `crm/<conta>/cerebro/<caminho>` (políticas `can_use_crm_file`);
 *   - pasta `plataforma/`: notas montadas na hora com o que a conta já tem no produto (cadastro,
 *     Plano, marca, criativos e projetos), só leitura; mudam na tela de origem.
 */

const db = supabase as unknown as SupabaseClient
const BUCKET = 'space-projects'
const bucket = () => supabase.storage.from(BUCKET)
const root = (teamId: string) => `crm/${teamId}/cerebro`

export interface BrainTeam {
  id: string
  name: string
  isHome?: boolean
  profile?: { segment?: string; website?: string; contactName?: string; contactEmail?: string; contactPhone?: string; notes?: string }
}

export interface LoadedVault extends Vault { teamId: string; /** Os Criativos (capas) ainda estão chegando. */ partial?: boolean }

// ———————————————————————————————————— notas

interface NoteRow { path: string; content: string; updated_at: string }

async function loadNotes(teamId: string): Promise<VaultNote[]> {
  const { data, error } = await db.from('crm_knowledge_notes').select('path, content, updated_at').eq('team_id', teamId).order('path')
  if (error) {
    if (/crm_knowledge_notes/.test(error.message)) throw new Error('Falta a migração do cérebro no Supabase.')
    throw new Error(error.message)
  }
  return ((data ?? []) as NoteRow[]).map((r) => ({ path: r.path, content: r.content, mtime: Date.parse(r.updated_at) }))
}

export const isAutoPath = (path: string) => path === AUTO_FOLDER || path.startsWith(AUTO_FOLDER + '/')

const cleanPath = (path: string) => path.trim().replace(/^\/+/, '').replace(/\/{2,}/g, '/')

export async function saveNote(teamId: string, path: string, content: string, create = false): Promise<void> {
  const p = cleanPath(path)
  if (!p.endsWith('.md') || p.split('/').some((s) => !s || s === '..' || s.startsWith('.'))) throw new Error('Caminho de nota inválido.')
  if (isAutoPath(p)) throw new Error('A pasta "Da plataforma" é montada sozinha; mude na tela de origem.')
  // O DESIGN.md é a marca da conta (a mesma que os Criativos usam)
  if (p === DESIGN_PATH) { baseCache = null; return saveBrand(teamId, content) }
  if (create) {
    const { error } = await db.from('crm_knowledge_notes').insert({ team_id: teamId, path: p, content })
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Já existe uma nota com esse nome.' : error.message)
    return
  }
  const { error } = await db.from('crm_knowledge_notes').upsert({ team_id: teamId, path: p, content }, { onConflict: 'team_id,path' })
  if (error) throw new Error(error.message)
  if (p.startsWith('marca/')) forgetStandard()
}

export async function deleteNote(teamId: string, path: string): Promise<void> {
  if (path === DESIGN_PATH) throw new Error('A marca não é apagada: edite o texto.')
  forgetStandard()
  const { error, count } = await db.from('crm_knowledge_notes').delete({ count: 'exact' }).eq('team_id', teamId).eq('path', path)
  if (error) throw new Error(error.message)
  if (!count) throw new Error('Só gestor da conta apaga notas.')
}

// ———————————————————————————————————— arquivos

interface StorageItem { name: string; id: string | null; updated_at?: string; metadata?: { size?: number } | null }

/** Os arquivos do cérebro da conta, percorrendo as pastas (o Storage não lista em profundidade). */
async function loadFiles(teamId: string): Promise<VaultMedia[]> {
  const out: VaultMedia[] = []
  const walk = async (rel: string, depth: number) => {
    if (depth > 6 || out.length > 2000) return
    const { data, error } = await bucket().list(rel ? `${root(teamId)}/${rel}` : root(teamId), { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
    if (error) return
    const items = (data ?? []) as StorageItem[]
    await Promise.all(items.map(async (it) => {
      const path = rel ? `${rel}/${it.name}` : it.name
      if (it.id === null) return walk(path, depth + 1)
      if (it.name === '.emptyFolderPlaceholder') return
      out.push({ path, size: it.metadata?.size ?? 0, mtime: Date.parse(it.updated_at ?? '') || 0 })
    }))
  }
  await walk('', 0)
  return out
}

const TYPES: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf' }
const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''
export const ACCEPT = Object.keys(TYPES).map((e) => '.' + e).join(',')
const MAX = 50 * 1024 * 1024

const safeName = (name: string) => {
  const ext = extOf(name)
  const base = name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'arquivo'
  return { base, ext }
}

/** Foto grande vira WebP de até 1600 px (o mesmo limite do cérebro de antes); SVG, GIF e vídeo vão como estão. */
async function shrink(file: File): Promise<{ blob: Blob; ext: string }> {
  const ext = extOf(file.name)
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { blob: file, ext }
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * k)
    canvas.height = Math.round(bmp.height * k)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.86))
    return blob && blob.size < file.size ? { blob, ext: 'webp' } : { blob: file, ext }
  } catch {
    return { blob: file, ext }
  }
}

/** Sobe arquivos para uma pasta do cérebro. Devolve os caminhos gravados. */
export async function uploadFiles(teamId: string, folder: string, files: File[], onStep?: (t: string) => void): Promise<string[]> {
  const dir = cleanPath(folder).replace(/\/$/, '')
  if (isAutoPath(dir)) throw new Error('A pasta "Da plataforma" é montada sozinha.')
  const saved: string[] = []
  for (const [i, file] of files.entries()) {
    if (!TYPES[extOf(file.name)]) throw new Error(`${file.name}: só imagens, vídeos e PDF.`)
    onStep?.(`Enviando ${i + 1} de ${files.length}: ${file.name}`)
    const { blob, ext } = await shrink(file)
    if (blob.size > MAX) throw new Error(`${file.name} passa de 50 MB.`)
    const { base } = safeName(file.name)
    const path = `${dir ? dir + '/' : ''}${base}-${Date.now().toString(36).slice(-4)}.${ext}`
    const { error } = await bucket().upload(`${root(teamId)}/${path}`, blob, { contentType: TYPES[ext], cacheControl: '31536000', upsert: false })
    if (error) throw new Error(`${file.name}: ${error.message}`)
    saved.push(path)
  }
  return saved
}

export async function deleteFile(teamId: string, path: string): Promise<void> {
  const { error } = await bucket().remove([`${root(teamId)}/${path}`])
  if (error) throw new Error(error.message)
  urls.delete(path)
}

// Endereços: as capas já vêm assinadas; os arquivos do cérebro, por link de 7 dias guardado neste
// navegador (o mesmo endereço volta e a imagem vem do cache, sem gastar o tráfego do Supabase).
const urls = new Map<string, string>()
let activeTeam = ''
const CACHE_KEY = 'cerebro-arquivos'
const TTL = 7 * 86_400_000
type UrlCache = Record<string, { url: string; until: number }>
const readCache = (): UrlCache => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as UrlCache } catch { return {} } }

export async function mediaUrl(path: string, mtime?: number): Promise<string> {
  const known = urls.get(path)
  if (known) return known
  const key = `${activeTeam}/${path}@${Math.round(mtime ?? 0)}`
  const cache = readCache()
  const hit = cache[key]
  if (hit && hit.until > Date.now() + 3_600_000) return hit.url
  const { data, error } = await bucket().createSignedUrl(`${root(activeTeam)}/${path}`, TTL / 1000)
  if (error) throw error
  cache[key] = { url: data.signedUrl, until: Date.now() + TTL }
  try {
    const now = Date.now()
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([, v]) => v.until > now).slice(-500))))
  } catch { /* sem localStorage: só não guarda */ }
  return data.signedUrl
}

// ———————————————————————————————————— pasta "Da plataforma"

const line = (label: string, value?: string) => (value?.trim() ? `- **${label}:** ${value.trim()}\n` : '')
const block = (title: string, value?: string) => `## ${title}\n\n${value?.trim() || '_Ainda não preenchido._'}\n\n`
const slugOf = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'conjunto'
const dateBr = (ms: number) => new Date(ms).toLocaleDateString('pt-BR')

/**
 * De onde vem a imagem de uma camada: `asset:<id>` (arquivo do conjunto no Storage), caminho público do
 * app (`/brands/…`) ou link. Links do próprio app (inclusive os gravados com localhost) viram o caminho
 * público servido aqui, para abrir em qualquer máquina.
 */
function imageOf(set: CreativeSet, src: string): { key: string; name: string; storage?: string; url?: string } | null {
  const base = (p: string) => decodeURIComponent(p.split('?')[0].split('/').pop() || 'imagem')
  if (src.startsWith('asset:')) {
    const a = set.assets.find((x) => x.id === src.slice(6))
    if (!a || a.kind) return null
    const ext = a.path.split('.').pop()
    const name = /\.[a-z0-9]{2,4}$/i.test(a.name) ? a.name : `${a.name || a.id}.${ext}`
    return { key: a.path, name: name.replace(/[\/]/g, '-'), storage: a.path }
  }
  if (src.startsWith('data:')) return null
  if (src.startsWith('/')) return { key: src.split('?')[0], name: base(src), url: `${location.origin}${src}` }
  try {
    const u = new URL(src)
    if (/^(localhost|127\.0\.0\.1)$/.test(u.hostname) || /avencestudio\.com$/.test(u.hostname) && u.pathname.startsWith('/brands/')) return { key: u.pathname, name: base(u.pathname), url: `${location.origin}${u.pathname}` }
    return { key: src, name: base(u.pathname), url: src }
  } catch { return null }
}

type Project = { id: string; name: string; updated_at: string; owner_id?: string }

/**
 * A pasta "Da plataforma" em duas partes (2026-11-07, o usuário: "fica muito tempo em loading"): o
 * cadastro, o Plano, a marca e os projetos saem em 3 consultas; os Criativos leem o index.json de cada
 * projeto da conta (38 na casa) e assinam as capas, o que levava segundos. A tela abre com a primeira
 * parte e os Criativos entram depois; os dois ficam guardados por conta para os recarregamentos
 * depois de salvar uma nota não refazerem tudo.
 */
let baseCache: { team: string; at: number; vault: Vault; projects: Project[] } | null = null
let creativesCache: { team: string; at: number; vault: Vault } | null = null
const BASE_TTL = 60_000
const CREATIVES_TTL = 180_000
export const forgetPlatform = () => { baseCache = null; creativesCache = null }

async function autoVault(team: BrainTeam): Promise<Vault & { projects: Project[] }> {
  const notes: VaultNote[] = []
  const media: VaultMedia[] = []
  const now = Date.now()
  const p = team.profile ?? {}

  notes.push({
    path: `${AUTO_FOLDER}/empresa.md`, mtime: now, auto: { label: 'o cadastro da conta (Equipe › Cadastro da conta)', route: '/crm/equipe' },
    content: `# Cadastro\n\n${line('Empresa', team.name)}${line('Segmento', p.segment)}${line('Site', p.website)}${line('Contato', [p.contactName, p.contactEmail, p.contactPhone].filter(Boolean).join(' · '))}\n${p.notes?.trim() ? `## Observações\n\n${p.notes.trim()}\n` : ''}`,
  })

  const [ctx, brand, projects] = await Promise.all([
    loadContext(team.id).catch(() => null),
    db.from('crm_account_context').select('brand_md').eq('team_id', team.id).maybeSingle()
      .then(({ data }) => ((data as { brand_md?: string | null } | null)?.brand_md ?? '').trim(), () => ''),
    (async () => {
      const q = db.from('space_projects').select('id, name, updated_at, owner_id')
      const { data } = await (team.isHome ? q.or(`team_id.eq.${team.id},team_id.is.null`) : q.eq('team_id', team.id)).order('updated_at', { ascending: false }).limit(40)
      const rows = (data ?? []) as Project[]
      rememberOwners(rows)
      return rows
    })().catch(() => []),
  ])

  notes.push({
    path: `${AUTO_FOLDER}/plano.md`, mtime: ctx ? ctx.updatedAt ?? now : now, auto: { label: 'o Plano da empresa', route: '/plano' },
    content: `# Plano da empresa\n\n${block('O que vende (oferta)', ctx?.offer)}${block('Para quem (público)', ctx?.audience)}${block('Tom de voz', ctx?.tone)}${block('Objetivo', ctx?.goal)}${block('Restrições', ctx?.restrictions)}## Pilares\n\n${ctx?.pillars.length ? ctx.pillars.map((x) => `- ${x}`).join('\n') : '_Ainda não preenchido._'}\n`,
  })

  // A marca (DESIGN.md) não é mais montada aqui: é a nota editável marca/DESIGN.md (standard.ts)
  notes.push({
    path: DESIGN_PATH, mtime: now, linked: 'brand',
    content: brand,
  })

  if (projects.length) {
    notes.push({
      path: `${AUTO_FOLDER}/projetos.md`, mtime: now, auto: { label: 'os projetos da conta', route: '/' },
      content: `# Projetos e páginas\n\n${projects.map((x) => `- [${x.name}](/projetos/${x.id}) · ${dateBr(Date.parse(x.updated_at))}`).join('\n')}\n`,
    })
  }

  return { notes, media, projects }
}

/** Criativos: a capa de cada post (as imagens que a conta já criou na plataforma). */
async function creativesVault(projects: Project[]): Promise<Vault> {
  const notes: VaultNote[] = []
  const media: VaultMedia[] = []
  const now = Date.now()
  const sets = await listSets(projects.map((x) => x.id)).catch(() => [])
  const shown = sets.slice(0, 24)
  const coverPaths = shown.flatMap((s) => (s.postsInfo ?? []).slice(0, 12).flatMap((x) => (x.cover ? [x.cover] : [])))
  const signed = coverPaths.length ? await coverUrls(coverPaths).catch(() => ({}) as Record<string, string>) : {}
  const parts: string[] = []
  for (const s of shown) {
    const href = `/criativos/${s.id}${s.shared && s.projectId ? `?projeto=${s.projectId}` : ''}`
    const imgs: string[] = []
    for (const post of (s.postsInfo ?? []).slice(0, 12)) {
      const url = post.cover && signed[post.cover]
      if (!url) continue
      const path = `${AUTO_FOLDER}/criativos/${s.id}/${post.id}.jpg`
      media.push({ path, size: 0, mtime: s.updatedAt, url, label: `${s.name} · ${post.name}`, format: post.format, href: `${href}${href.includes('?') ? '&' : '?'}post=${post.id}` })
      urls.set(path, url)
      imgs.push(`![${post.name.replace(/[[\]]/g, '')}](criativos/${s.id}/${post.id}.jpg)`)
    }
    parts.push(`## ${s.name}\n\n${s.posts} post(s)${s.projectName ? ` · ${s.projectName}` : ''} · atualizado em ${dateBr(s.updatedAt)} · [Abrir no Criativos](${href})\n\n${imgs.join(' ')}\n`)
  }
  // As imagens que os posts usam de verdade (a pessoa, o navio, o mundo, as fotos dos cases…), lidas das
  // camadas de cada post: arquivos do conjunto, arquivos públicos da marca (/brands/…) e links do app.
  // Uma pasta por conjunto; o que aparece em vários conjuntos (logo, cases) vai para "em vários conjuntos".
  const scan = sets.slice(0, 40)
  const loaded = await Promise.all(scan.map((s) => loadSet(s.id, s.shared ? s.projectId : undefined).catch(() => undefined)))
  type Found = { key: string; name: string; storage?: string; url?: string; set: SetSummary; post: string }
  const bySet: Found[][] = scan.map(() => [])
  const usedIn = new Map<string, Set<string>>()
  loaded.forEach((set, i) => {
    if (!set) return
    const seen = new Set<string>()
    for (const post of set.posts) for (const slide of post.slides) for (const l of slide.layers) {
      if (l.type !== 'image' || !l.src || l.hidden || /^[íi]cone\b/i.test(l.name)) continue
      const f = imageOf(set, l.src)
      if (!f || seen.has(f.key)) continue
      seen.add(f.key)
      bySet[i].push({ ...f, set: scan[i], post: post.id })
      usedIn.set(f.key, (usedIn.get(f.key) ?? new Set()).add(scan[i].id))
    }
  })
  const storagePaths = [...new Set(bySet.flat().flatMap((f) => (f.storage ? [f.storage] : [])))]
  const signedFiles = storagePaths.length ? await coverUrls(storagePaths).catch(() => ({}) as Record<string, string>) : {}
  const placed = new Set<string>()
  bySet.forEach((list, i) => {
    const s = scan[i]
    const base = `/criativos/${s.id}${s.shared && s.projectId ? `?projeto=${s.projectId}` : ''}`
    for (const f of list) {
      const url = f.storage ? signedFiles[f.storage] : f.url
      if (!url) continue
      const shared = (usedIn.get(f.key)?.size ?? 0) > 1
      if (shared && placed.has(f.key)) continue
      placed.add(f.key)
      const folder = `${AUTO_FOLDER}/imagens/${shared ? 'em-varios-conjuntos' : `${slugOf(s.name)}-${s.id.slice(-4)}`}`
      let path = `${folder}/${f.name}`
      for (let n = 2; media.some((m) => m.path === path); n++) path = `${folder}/${f.name.replace(/(\.[a-z0-9]+)?$/i, `-${n}$1`)}`
      const label = shared ? `Em ${usedIn.get(f.key)!.size} conjuntos` : s.name
      media.push({ path, size: 0, mtime: s.updatedAt, url, label, href: `${base}${base.includes('?') ? '&' : '?'}post=${f.post}` })
      urls.set(path, url)
    }
  })
  notes.push({
    path: `${AUTO_FOLDER}/criativos.md`, mtime: shown[0]?.updatedAt ?? now, auto: { label: 'os conjuntos dos Criativos', route: '/criativos' },
    content: `# Criativos\n\n${sets.length ? `${sets.length} conjunto(s) criados na plataforma${sets.length > shown.length ? ` (os ${shown.length} mais recentes aqui)` : ''}.\n\n${parts.join('\n')}` : '_A conta ainda não tem criativos._\n'}`,
  })

  return { notes, media }
}

// ———————————————————————————————————— o cofre da conta

const fresh = (c: { team: string; at: number } | null, team: string, ttl: number) => !!c && c.team === team && Date.now() - c.at < ttl

async function platformBase(team: BrainTeam) {
  if (fresh(baseCache, team.id, BASE_TTL)) return baseCache!
  const v = await autoVault(team).catch(() => ({ notes: [], media: [], projects: [] as Project[] }))
  baseCache = { team: team.id, at: Date.now(), vault: { notes: v.notes, media: v.media }, projects: v.projects }
  return baseCache
}

/** Os Criativos da pasta "Da plataforma" (o que demora). */
export async function loadPlatformCreatives(team: BrainTeam): Promise<Vault> {
  if (fresh(creativesCache, team.id, CREATIVES_TTL)) return creativesCache!.vault
  const base = await platformBase(team)
  const vault = await creativesVault(base.projects).catch(() => ({ notes: [], media: [] }) as Vault)
  creativesCache = { team: team.id, at: Date.now(), vault }
  return vault
}

/**
 * As notas e os arquivos da conta, mais a pasta "Da plataforma". Com `creatives: 'later'` não espera os
 * Criativos quando eles não estão guardados: volta `partial` e a tela chama `loadPlatformCreatives`.
 */
export async function loadAccountVault(team: BrainTeam, opts: { creatives?: 'wait' | 'later' } = {}): Promise<LoadedVault> {
  activeTeam = team.id
  const later = opts.creatives === 'later' && !fresh(creativesCache, team.id, CREATIVES_TTL)
  const [notes, files, base, creatives] = await Promise.all([
    loadNotes(team.id),
    loadFiles(team.id).catch(() => [] as VaultMedia[]),
    platformBase(team),
    later ? Promise.resolve<Vault>({ notes: [], media: [] }) : loadPlatformCreatives(team),
  ])
  return {
    teamId: team.id,
    notes: [...notes.filter((n) => !isAutoPath(n.path) && n.path !== DESIGN_PATH), ...base.vault.notes, ...creatives.notes],
    media: [...files.filter((m) => !isAutoPath(m.path)), ...base.vault.media, ...creatives.media],
    partial: later,
  }
}

/** A estrutura inicial de uma conta sem notas: o essencial para a Iara e a equipe preencherem. */
export function starterNotes(name: string, day: string): { path: string; content: string }[] {
  return [
    {
      path: 'README.md',
      content: `# ${name}\n\n**Atualizado em:** ${day}\n\n## Quem somos\n\nO que a empresa faz, onde está, há quanto tempo, o que a torna diferente.\n\n## O que vendemos\n\nO resumo dos produtos e serviços. O detalhe de cada um fica em [Produtos e serviços](produtos/README.md).\n\n## Para quem\n\nQuem compra, por que compra, o que pesa na decisão.\n\n## Onde estamos agora\n\nO que está rodando (site, anúncios, conteúdo) e como vai.\n\n## Próximos passos\n\n1. \n\n## Da plataforma\n\n[Cadastro](plataforma/empresa.md) · [Plano](plataforma/plano.md) · [Marca](marca/DESIGN.md) · [Criativos](plataforma/criativos.md)\n`,
    },
    {
      path: 'produtos/README.md',
      content: `# Produtos e serviços\n\nUma seção por produto ou serviço. As fotos sobem com **Adicionar arquivos** nesta pasta e entram na nota com \`![nome](arquivo.webp)\`.\n\n## Nome do produto\n\n- **Para quem:** \n- **Preço:** (se pode ser dito)\n- **Diferenciais:** \n- **Perguntas comuns:** \n`,
    },
    { path: 'decisoes.md', content: `# Decisões\n\nO que foi decidido, quando e por quê. Só acrescentar, nunca apagar.\n\n| Data | Decisão | Por quê |\n| --- | --- | --- |\n` },
  ]
}
