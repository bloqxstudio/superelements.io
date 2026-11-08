/**
 * O cofre do cérebro de uma conta: notas em Markdown, arquivos, os links entre notas (Markdown
 * relativo e [[wikilinks]] do Obsidian), quem aponta para cada nota, a árvore por pasta e a busca.
 * Sem imports `@/`: só dados.
 */

/** `auto`: nota montada pela plataforma (cadastro, plano, marca, criativos); muda na tela de origem. */
export interface VaultNote {
  path: string; content: string; mtime: number; auto?: { label: string; route?: string }
  /** `brand`: a marca da conta (DESIGN.md), editável aqui e usada pelos Criativos. */
  linked?: 'brand'
}
/** `url`: arquivo que já tem endereço (as capas dos criativos); sem ele, o arquivo é do cérebro da conta. */
export interface VaultMedia {
  path: string; size: number; mtime: number; url?: string
  /** Capa de um post dos Criativos: o nome, o formato e onde abrir. */
  label?: string; format?: string; href?: string
}
export interface Vault { notes: VaultNote[]; media: VaultMedia[] }

/** A pasta montada pela plataforma: só leitura. */
export const AUTO_FOLDER = 'plataforma'

export const fileName = (path: string) => path.split('/').pop() ?? path
export const dirOf = (path: string) => path.split('/').slice(0, -1).join('/')
const extOf = (path: string) => (path.match(/\.[^./]+$/)?.[0] ?? '').toLowerCase()
export const isImage = (path: string) => ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(extOf(path))
export const isVideo = (path: string) => ['.mp4', '.webm'].includes(extOf(path))

/** Junta e normaliza um caminho relativo. `null` quando sai da raiz do cofre. */
export function joinPath(base: string, rel: string): { path: string; outside: number } {
  const parts = base ? base.split('/') : []
  let outside = 0
  for (const seg of rel.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (parts.length) parts.pop()
      else outside++
    } else parts.push(seg)
  }
  return { path: parts.join('/'), outside }
}

/** Áreas: as pastas do primeiro nível do cérebro da conta, mais a raiz. */
export interface Area { id: string; label: string; color: string }
const AREA_LABEL: Record<string, string> = {
  plataforma: 'Da plataforma', padroes: 'Padrões de post', produtos: 'Produtos', log: 'Log', midia: 'Arquivos', fotos: 'Fotos', imagens: 'Imagens dos posts', criativos: 'Capas dos posts', 'em-varios-conjuntos': 'Em vários conjuntos', marca: 'Marca', clientes: 'Clientes',
}
export const folderLabel = (id: string) => AREA_LABEL[id] ?? id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
const PALETTE = ['#7c3aed', '#0ea5e9', '#16a34a', '#ea580c', '#db2777', '#0d9488', '#ca8a04', '#4f46e5', '#dc2626']

export function areaId(path: string): string {
  const p = path.split('/')
  return p.length > 1 ? p[0] : 'raiz'
}

export function areasOf(vault: Vault): Area[] {
  const ids = [...new Set([...vault.notes, ...vault.media].map((x) => x.path.split('/')).filter((p) => p.length > 1).map((p) => p[0]))]
    .sort((a, b) => folderRank(a) - folderRank(b) || a.localeCompare(b))
  return [
    { id: 'raiz', label: 'Início', color: '#111827' },
    ...ids.map((id, i): Area => ({ id, label: folderLabel(id), color: id === AUTO_FOLDER ? '#6b7280' : PALETTE[i % PALETTE.length] })),
  ]
}

const folderRank = (name: string) => (name === AUTO_FOLDER ? 0 : name === 'marca' ? 1 : name === 'produtos' ? 2 : name === 'log' ? 8 : name === 'midia' ? 9 : 5)

/** O título da nota: o primeiro `# `; sem ele, o nome do arquivo. Um log mostra a data antes. */
export function titleOf(note: VaultNote): string {
  const h = note.content.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const base = fileName(note.path).replace(/\.md$/, '')
  if (h) return h
  if (note.path === 'marca/DESIGN.md') return 'Marca (DESIGN.md)'
  return base === 'README' ? fileName(dirOf(note.path)) || 'Cérebro' : base
}

export const dateOf = (path: string) => fileName(path).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
export const isLog = (path: string) => /(^|\/)log\/[^/]+\.md$/.test(path)

/** Onde um link de uma nota leva. */
export type LinkTarget =
  | { kind: 'note'; path: string }
  | { kind: 'folder'; path: string }
  | { kind: 'media'; path: string }
  | { kind: 'web'; url: string }
  | { kind: 'app'; route: string }
  | { kind: 'missing'; path: string }

export function resolveLink(vault: Vault, from: string, href: string): LinkTarget {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return { kind: 'web', url: href }
  // Uma tela do app (`/criativos/…`, `/plano`)
  if (href.startsWith('/') && !href.startsWith('//')) return { kind: 'app', route: href }
  if (href.startsWith('wiki:')) {
    const name = decodeURIComponent(href.slice(5)).toLowerCase().replace(/\.md$/, '')
    const hit = vault.notes.find((n) => fileName(n.path).replace(/\.md$/, '').toLowerCase() === name)
      ?? vault.notes.find((n) => titleOf(n).toLowerCase() === name)
    return hit ? { kind: 'note', path: hit.path } : { kind: 'missing', path: name }
  }
  const clean = decodeURIComponent(href.split('#')[0].split('?')[0])
  if (!clean) return { kind: 'note', path: from }
  const { path, outside } = joinPath(dirOf(from), clean)
  if (outside > 0) return { kind: 'missing', path: clean }
  if (vault.notes.some((n) => n.path === path)) return { kind: 'note', path }
  if (vault.media.some((m) => m.path === path)) return { kind: 'media', path }
  const folder = path.replace(/\/$/, '')
  if (vault.notes.some((n) => n.path.startsWith(folder + '/')) || vault.media.some((m) => m.path.startsWith(folder + '/'))) return { kind: 'folder', path: folder }
  return { kind: 'missing', path }
}

/** Uma pasta abre o README dela quando existe. */
export function folderNote(vault: Vault, folder: string): string | null {
  const readme = (folder ? folder + '/' : '') + 'README.md'
  return vault.notes.some((n) => n.path === readme) ? readme : null
}

/** `[[Nome]]` e `[[Nome|texto]]` viram links Markdown com `wiki:`. Fora de blocos de código. */
export function expandWikilinks(md: string): string {
  return md.split(/(```[\s\S]*?```|`[^`\n]*`)/).map((part, i) => i % 2 ? part
    : part.replace(/(!?)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, bang, target, label) => `${bang}[${label ?? target}](wiki:${encodeURIComponent(target.trim())})`)).join('')
}

const LINK_RE = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

/** As notas para onde esta aponta (pastas contam pelo README). */
export function outgoing(vault: Vault, note: VaultNote): string[] {
  const md = expandWikilinks(note.content).replace(/```[\s\S]*?```/g, '')
  const out = new Set<string>()
  for (const m of md.matchAll(LINK_RE)) {
    const t = resolveLink(vault, note.path, m[2])
    if (t.kind === 'note' && t.path !== note.path) out.add(t.path)
    if (t.kind === 'folder') { const r = folderNote(vault, t.path); if (r && r !== note.path) out.add(r) }
  }
  return [...out]
}

export interface Graph { links: Map<string, string[]>; backlinks: Map<string, string[]> }
export function buildGraph(vault: Vault): Graph {
  const links = new Map<string, string[]>()
  const backlinks = new Map<string, string[]>()
  for (const n of vault.notes) {
    const out = outgoing(vault, n)
    links.set(n.path, out)
    for (const t of out) backlinks.set(t, [...(backlinks.get(t) ?? []), n.path])
  }
  return { links, backlinks }
}

export interface Heading { level: number; text: string; slug: string }
export const slugify = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export function headingsOf(note: VaultNote): Heading[] {
  return note.content.replace(/```[\s\S]*?```/g, '').split('\n').flatMap((line) => {
    const m = line.match(/^(#{1,4})\s+(.+?)\s*#*$/)
    return m ? [{ level: m[1].length, text: m[2].replace(/[*_`]/g, ''), slug: slugify(m[2]) }] : []
  })
}

/** Linhas de status do README: **Estado:** e **Atualizado em:**. */
export function metaOf(note: VaultNote): Record<string, string> {
  const meta: Record<string, string> = {}
  for (const m of note.content.matchAll(/^\*\*([^*:]+):\*\*\s*(.+)$/gm)) meta[m[1].trim().toLowerCase()] = m[2].trim()
  return meta
}

export interface SearchHit { path: string; title: string; snippet: string; score: number }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export function search(vault: Vault, query: string): SearchHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return vault.notes.flatMap((n) => {
    const title = titleOf(n)
    const t = fold(title + ' ' + n.path)
    const body = fold(n.content)
    if (!words.every((w) => t.includes(w) || body.includes(w))) return []
    const score = words.reduce((s, w) => s + (t.includes(w) ? 10 : 0) + Math.min(5, body.split(w).length - 1), 0)
    const at = body.indexOf(words[0])
    const raw = at < 0 ? n.content.slice(0, 120) : n.content.slice(Math.max(0, at - 50), at + 90)
    const snippet = raw.replace(/[#*`>|_\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    return [{ path: n.path, title, snippet, score }]
  }).sort((a, b) => b.score - a.score).slice(0, 40)
}

/** A árvore de pastas, com as notas e a mídia de cada uma. */
export interface TreeFolder { path: string; name: string; folders: TreeFolder[]; notes: VaultNote[]; media: VaultMedia[] }
export function buildTree(vault: Vault): TreeFolder {
  const root: TreeFolder = { path: '', name: '', folders: [], notes: [], media: [] }
  const folderAt = (path: string): TreeFolder => {
    let cur = root
    for (const seg of path ? path.split('/') : []) {
      const p = cur.path ? `${cur.path}/${seg}` : seg
      let next = cur.folders.find((f) => f.path === p)
      if (!next) { next = { path: p, name: seg, folders: [], notes: [], media: [] }; cur.folders.push(next) }
      cur = next
    }
    return cur
  }
  for (const n of vault.notes) folderAt(dirOf(n.path)).notes.push(n)
  for (const m of vault.media) folderAt(dirOf(m.path)).media.push(m)
  const sort = (f: TreeFolder) => {
    const rank = (n: VaultNote) => (fileName(n.path) === 'README.md' ? 0 : 2)
    // Logs mais novos primeiro; o resto por nome
    f.notes.sort((a, b) => rank(a) - rank(b) || (isLog(a.path) && isLog(b.path) ? b.path.localeCompare(a.path) : a.path.localeCompare(b.path)))
    f.media.sort((a, b) => b.path.localeCompare(a.path))
    f.folders.sort((a, b) => folderRank(a.name) - folderRank(b.name) || a.name.localeCompare(b.name))
    f.folders.forEach(sort)
  }
  sort(root)
  return root
}

export const countMedia = (f: TreeFolder): number => f.media.length + f.folders.reduce((s, x) => s + countMedia(x), 0)
