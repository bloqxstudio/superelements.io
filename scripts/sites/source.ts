import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { CodeSite, ElementInfo, PickedElement, SitePage, TextHit } from '../../src/features/sites/protocol.ts'
import { UPLOAD_DIR } from './git.ts'
import { inside } from './registry.ts'

/**
 * O código por trás do que a pessoa clica na prévia. No `astro dev` cada elemento
 * vem marcado com o arquivo e a posição logo depois da tag de abertura
 * (`data-astro-source-file`/`-loc`); o compilador do próprio site
 * (`@astrojs/compiler`, já instalado com o Astro) lê o arquivo e acha o elemento.
 * Os textos são trocados no lugar exato (posições em bytes, como o compilador dá),
 * sem mexer no resto do arquivo. Texto que vem de dados ({titulo}) é procurado
 * no código e trocado onde está escrito, se aparecer uma vez só.
 */

// ---------- o compilador do site ----------

interface Pos { line: number; column: number; offset: number }
export interface AstNode {
  type: string
  name?: string
  value?: string
  position?: { start: Pos; end?: Pos }
  attributes?: Array<{ type: string; kind: string; name: string; value: string }>
  children?: AstNode[]
}
type Parse = (source: string, options: { position: boolean }) => Promise<{ ast: AstNode }>

const compilers = new Map<string, Promise<Parse>>()

function loadParse(dir: string): Promise<Parse> {
  let found = compilers.get(dir)
  if (!found) {
    found = (async () => {
      const fromSite = createRequire(path.join(dir, 'package.json'))
      let entry: string
      try {
        entry = fromSite.resolve('@astrojs/compiler')
      } catch {
        // O compilador fica dentro do astro quando o gerenciador não o sobe para a raiz
        entry = createRequire(fromSite.resolve('astro/package.json')).resolve('@astrojs/compiler')
      }
      const mod = await import(pathToFileURL(entry).href)
      return mod.parse as Parse
    })()
    compilers.set(dir, found)
    found.catch(() => compilers.delete(dir))
  }
  return found
}

/** Para os testes: um parser já carregado. */
export const setParser = (dir: string, parse: Parse) => compilers.set(dir, Promise.resolve(parse))

// ---------- texto ----------

const NAMED: Record<string, string> = {
  nbsp: '\u00a0', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®', trade: '™',
  laquo: '«', raquo: '»', middot: '·', bull: '•', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', deg: '°', ordm: 'º', ordf: 'ª',
}

export const decodeEntities = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : all
    }
    return NAMED[code.toLowerCase()] ?? all
  })

/** Como o navegador mostra: espaços e quebras viram um espaço só (o espaço fixo, não). */
export const normalize = (s: string) => s.replace(/[ \t\n\r\f]+/g, ' ').trim()

/** Texto escrito no HTML do .astro: sem abrir tag nem expressão. */
export const encodeTemplate = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;').replace(/\u00a0/g, '&nbsp;')

// ---------- achar o elemento ----------

function lineStarts(buf: Buffer) {
  const starts = [0]
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) starts.push(i + 1)
  return starts
}

export function locOffset(buf: Buffer, loc: string) {
  const [line, col] = loc.split(':').map(Number)
  const starts = lineStarts(buf)
  if (!line || !col || line > starts.length) throw new Error('Posição inválida no código.')
  return starts[line - 1] + col - 1
}

/** Onde a tag de abertura que começa em `start` termina (depois do `>`), pulando aspas e expressões. */
export function openTagEnd(buf: Buffer, start: number) {
  let quote = 0
  let depth = 0
  for (let i = start + 1; i < buf.length; i++) {
    const c = buf[i]
    if (quote) {
      if (c === quote) quote = 0
      continue
    }
    if (depth) {
      if (c === 123) depth++
      else if (c === 125) depth--
      else if (c === 34 || c === 39 || c === 96) quote = c
      continue
    }
    if (c === 34 || c === 39) quote = c
    else if (c === 123) depth = 1
    else if (c === 62) return i + 1
  }
  return buf.length
}

interface Found { node: AstNode; inExpression: boolean }

const isTag = (n: AstNode) => n.type === 'element' || n.type === 'custom-element'
const SKIP = new Set(['script', 'style', 'svg', 'template', 'noscript'])

function walk(node: AstNode, fn: (n: AstNode, inExpression: boolean) => void, inExpression = false) {
  fn(node, inExpression)
  for (const child of node.children ?? []) walk(child, fn, inExpression || node.type === 'expression')
}

export function findElement(ast: AstNode, buf: Buffer, loc: string, tag: string): Found | undefined {
  const at = locOffset(buf, loc)
  const name = tag.toLowerCase()
  let best: Found | undefined
  let bestStart = -1
  walk(ast, (n, inExpression) => {
    if (!isTag(n) || n.name?.toLowerCase() !== name || !n.position) return
    const start = n.position.start.offset
    if (start > at) return
    // A marca do Astro fica logo depois da tag de abertura (às vezes um byte antes, no "/>")
    if (Math.abs(openTagEnd(buf, start) - at) > 1) return
    if (start > bestStart) {
      best = { node: n, inExpression }
      bestStart = start
    }
  })
  return best
}

// ---------- os textos de um elemento ----------

interface Segment { start: number; end: number; raw: string; text: string }

/** O `{…}` que começa perto de `from` (o compilador às vezes marca um byte antes). */
function expressionAt(buf: Buffer, from: number | undefined) {
  if (from === undefined) return '{…}'
  const open = buf.indexOf(123, Math.max(0, from - 1))
  if (open < 0) return '{…}'
  let depth = 0
  let quote = 0
  for (let i = open; i < buf.length && i < open + 2000; i++) {
    const c = buf[i]
    if (quote) {
      if (c === 92) i++
      else if (c === quote) quote = 0
    } else if (c === 34 || c === 39 || c === 96) quote = c
    else if (c === 123) depth++
    else if (c === 125 && --depth === 0) return buf.subarray(open, i + 1).toString('utf8').slice(0, 200)
  }
  return '{…}'
}

export function collect(node: AstNode, buf: Buffer) {
  const segments: Segment[] = []
  const expressions: string[] = []
  const visit = (n: AstNode) => {
    for (const child of n.children ?? []) {
      if (child.type === 'text' && child.position?.end) {
        const { start, end } = { start: child.position.start.offset, end: child.position.end.offset }
        const raw = buf.subarray(start, end).toString('utf8')
        const text = normalize(decodeEntities(raw))
        if (text) segments.push({ start, end, raw, text })
      } else if (child.type === 'expression') {
        expressions.push(expressionAt(buf, child.position?.start.offset))
      } else if (isTag(child) && !SKIP.has(child.name?.toLowerCase() ?? '')) {
        visit(child)
      }
      // Componentes (<Card />) desenham outro arquivo: os textos deles são de lá
    }
  }
  visit(node)
  return { segments, expressions }
}

const astroAttrs = (node: AstNode) =>
  (node.attributes ?? [])
    .filter((a) => a.type === 'attribute' && !a.name.startsWith('data-astro') && a.kind !== 'spread')
    .map((a) => ({ name: a.name, value: a.kind === 'quoted' || a.kind === 'empty' ? decodeEntities(a.value ?? '') : `{${a.value}}`, editable: a.kind === 'quoted' || a.kind === 'empty' }))

// ---------- arquivos ----------

async function load(site: CodeSite, file: string) {
  const { full, rel } = inside(site, file)
  if (!/\.astro$/.test(full)) throw new Error('Só dá para editar elementos de arquivos .astro.')
  const buf = readFileSync(full)
  const parse = await loadParse(site.dir)
  const { ast } = await parse(buf.toString('utf8'), { position: true })
  return { full, rel, buf, ast }
}

function locate(buf: Buffer, ast: AstNode, picked: Pick<PickedElement, 'loc' | 'tag'>) {
  const found = findElement(ast, buf, picked.loc, picked.tag)
  if (!found) throw new Error('Não achei esse elemento no código. O arquivo mudou? Recarregue a prévia.')
  return found
}

export async function inspect(site: CodeSite, picked: PickedElement): Promise<ElementInfo> {
  const { rel, buf, ast } = await load(site, picked.file)
  const { node, inExpression } = locate(buf, ast, picked)
  const { segments, expressions } = collect(node, buf)
  const start = node.position!.start.offset
  const snippet = buf.subarray(start, Math.min(openTagEnd(buf, start), start + 400)).toString('utf8')
  return {
    file: rel,
    tag: picked.tag,
    kind: expressions.length ? 'dinamico' : segments.length ? 'texto' : 'sem-texto',
    segments: segments.map((s) => s.text),
    expressions,
    attrs: astroAttrs(node),
    snippet,
    line: node.position!.start.line,
    repeated: inExpression,
  }
}

const splice = (buf: Buffer, edits: Array<{ start: number; end: number; text: string }>) => {
  const parts: Buffer[] = []
  let at = 0
  for (const e of [...edits].sort((a, b) => a.start - b.start)) {
    parts.push(buf.subarray(at, e.start), Buffer.from(e.text, 'utf8'))
    at = e.end
  }
  parts.push(buf.subarray(at))
  return Buffer.concat(parts)
}

const keepSpace = (raw: string, text: string) => {
  const lead = /^[ \t\n\r\f]*/.exec(raw)![0]
  const trail = /[ \t\n\r\f]*$/.exec(raw)![0]
  return lead + encodeTemplate(text) + trail
}

export interface TextChange { file: string; via: 'codigo' | 'busca'; changed: number }

/**
 * Troca os textos do elemento: `before` é o que a prévia mostrava, `after` o que a pessoa escreveu
 * (mesma ordem). Primeiro no próprio elemento; se o texto vem de dados, procura onde está escrito.
 */
export async function setText(site: CodeSite, picked: PickedElement, after: string[]): Promise<TextChange[]> {
  const before = picked.segments.map(normalize)
  const next = after.map((s) => s.replace(/[ \t\n\r\f]+/g, ' ').trim())
  if (before.length !== next.length) throw new Error('A estrutura do texto mudou na edição. Edite pelo painel ou peça ao agente.')
  const changes = before.map((b, i) => ({ i, from: b, to: next[i] })).filter((c) => c.from !== c.to)
  if (!changes.length) return []
  if (changes.some((c) => !c.to)) throw new Error('Um trecho ficou vazio. Para tirar um texto inteiro, peça ao agente.')

  const { full, rel, buf, ast } = await load(site, picked.file)
  const { node } = locate(buf, ast, picked)
  const { segments, expressions } = collect(node, buf)
  const same = !expressions.length && segments.length === before.length && segments.every((s, i) => s.text === before[i])
  if (same) {
    writeFileSync(full, splice(buf, changes.map((c) => ({ start: segments[c.i].start, end: segments[c.i].end, text: keepSpace(segments[c.i].raw, c.to) }))))
    return [{ file: rel, via: 'codigo', changed: changes.length }]
  }
  // O texto vem de dados (props, listas, arquivos de conteúdo): troca onde está escrito
  const done: TextChange[] = []
  for (const c of changes) {
    const hits = findText(site, c.from)
    if (hits.length !== 1)
      throw new Error(
        hits.length
          ? `"${c.from.slice(0, 60)}" aparece em ${hits.length} lugares do código. Escolha qual no painel ou peça ao agente.`
          : `Não achei "${c.from.slice(0, 60)}" escrito no código: ele é montado por uma conta. Peça ao agente.`
      )
    done.push(replaceText(site, { text: c.from, next: c.to, file: hits[0].file, line: hits[0].line }))
  }
  return done
}

/** Troca (ou põe) um atributo escrito à mão na tag de abertura: href, src, alt, title… */
export async function setAttr(site: CodeSite, picked: PickedElement, name: string, value: string) {
  if (!/^[a-zA-Z_:][\w:.-]*$/.test(name) || /^on/i.test(name)) throw new Error('Atributo não permitido.')
  const { full, rel, buf, ast } = await load(site, picked.file)
  const { node } = locate(buf, ast, picked)
  const start = node.position!.start.offset
  const end = openTagEnd(buf, start)
  const tag = buf.subarray(start, end).toString('utf8')
  const attr = (node.attributes ?? []).find((a) => a.name === name)
  if (attr && attr.kind !== 'quoted' && attr.kind !== 'empty')
    throw new Error(`O ${name} deste elemento vem do código ({${attr.value}}). Peça ao agente para trocar.`)
  const escaped = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const re = new RegExp(`(\\s${name.replace(/[.:]/g, '\\$&')})(\\s*=\\s*("[^"]*"|'[^']*'))?(?=[\\s/>])`)
  const m = re.exec(tag)
  let next: string
  if (m) next = tag.slice(0, m.index) + `${m[1]}="${escaped}"` + tag.slice(m.index + m[0].length)
  else {
    const close = tag.endsWith('/>') ? tag.length - 2 : tag.length - 1
    next = `${tag.slice(0, close).replace(/\s*$/, '')} ${name}="${escaped}"${tag.endsWith('/>') ? ' ' : ''}${tag.slice(close)}`
  }
  writeFileSync(full, splice(buf, [{ start, end, text: next }]))
  return { file: rel }
}

// ---------- procurar texto no código ----------

const SEARCH_EXT = /\.(astro|md|mdx|json|ts|tsx|js|jsx|mjs|cjs|ya?ml|html|vue|svelte)$/i
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '.vercel', '.netlify', '.output', 'public', '.vscode', '.idea'])

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* files(full)
    } else if (SEARCH_EXT.test(entry.name) && !/astro\.config|package(-lock)?\.json|tsconfig/.test(entry.name)) {
      if (statSync(full).size < 2_000_000) yield full
    }
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SPACE = '(?:[ \\t\\n\\r]|&nbsp;|\\u00a0|\\\\n)+'

/** O texto como pode estar escrito: espaços e quebras à vontade, & ou &amp;. */
export function textPattern(text: string) {
  const words = normalize(text).split(/[ \u00a0]+/).filter(Boolean)
  return new RegExp(words.map((w) => escapeRe(w).replace(/&/g, '(?:&|&amp;)').replace(/'/g, "(?:'|\\\\'|&#39;|&apos;)").replace(/"/g, '(?:"|\\\\"|&quot;)')).join(SPACE), 'g')
}

export function findText(site: CodeSite, text: string): TextHit[] {
  if (normalize(text).length < 2) return []
  const pattern = textPattern(text)
  const hits: TextHit[] = []
  // Só o código do site: os .md de documentação na raiz do repositório não são o site
  const roots = ['src', 'content', 'data'].map((d) => path.join(site.dir, d)).filter((d) => existsSync(d))
  for (const full of roots.flatMap((root) => [...files(root)])) {
    const content = readFileSync(full, 'utf8')
    pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pattern.exec(content))) {
      const line = content.slice(0, m.index).split('\n').length
      hits.push({ file: path.relative(site.dir, full), line, snippet: content.split('\n')[line - 1].trim().slice(0, 200) })
      if (hits.length > 40) return hits
    }
  }
  return hits
}

/** Onde no arquivo o trecho está: no HTML do .astro, no frontmatter (JS), num .md, num JSON… */
function encodeFor(file: string, content: string, index: number, text: string) {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.json') return JSON.stringify(text).slice(1, -1)
  if (ext === '.md' || ext === '.mdx') return text
  if (ext === '.astro') {
    const fm = /^---\r?\n[\s\S]*?\r?\n---/.exec(content)
    const inFrontmatter = !!fm && index < fm[0].length
    const before = content.slice(0, index)
    // Valor de atributo escrito à mão (title="…" ou prop="…")
    const attr = /=\s*(["'])[^"'<>{}]*$/.exec(before.slice(-300))
    if (!inFrontmatter && attr) return text.replace(/&/g, '&amp;').replace(new RegExp(attr[1], 'g'), attr[1] === '"' ? '&quot;' : '&#39;')
    if (!inFrontmatter) {
      // Dentro de uma expressão ({…}) é JS; fora, é texto do HTML
      let depth = 0
      for (let i = fm ? fm[0].length : 0; i < index; i++) {
        const c = content[i]
        if (c === '{') depth++
        else if (c === '}') depth = Math.max(0, depth - 1)
      }
      if (!depth) return encodeTemplate(text)
    }
  }
  if (ext === '.yaml' || ext === '.yml') {
    const quote = /(["'])[^"'\n]*$/.exec(content.slice(Math.max(0, content.lastIndexOf('\n', index - 1)), index))?.[1]
    return quote === '"' ? text.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : quote === "'" ? text.replace(/'/g, "''") : text
  }
  // JS/TS: escapa as aspas da string em que o trecho está
  const lineStart = content.lastIndexOf('\n', index - 1) + 1
  const quote = /(["'`])(?:\\.|(?!\1)[^\\])*$/.exec(content.slice(lineStart, index))?.[1] ?? '"'
  let out = text.replace(/\\/g, '\\\\').replace(new RegExp(quote, 'g'), `\\${quote}`)
  if (quote === '`') out = out.replace(/\$\{/g, '\\${')
  return out
}

export function replaceText(site: CodeSite, input: { text: string; next: string; file?: string; line?: number }): TextChange {
  const next = input.next.replace(/[ \t\n\r\f]+/g, ' ').trim()
  if (!next) throw new Error('O texto novo está vazio.')
  const hits = findText(site, input.text).filter((h) => (!input.file || h.file === input.file) && (!input.line || h.line === input.line))
  if (hits.length !== 1) throw new Error(hits.length ? 'O texto aparece mais de uma vez nesse lugar. Peça ao agente.' : 'Não achei mais esse texto no código (ele mudou?).')
  const { full, rel } = inside(site, hits[0].file)
  const content = readFileSync(full, 'utf8')
  const pattern = textPattern(input.text)
  let m: RegExpExecArray | null
  let target: RegExpExecArray | undefined
  while ((m = pattern.exec(content))) {
    if (content.slice(0, m.index).split('\n').length === hits[0].line) {
      target = m
      break
    }
  }
  if (!target) throw new Error('Não achei mais esse texto no código.')
  writeFileSync(full, content.slice(0, target.index) + encodeFor(rel, content, target.index, next) + content.slice(target.index + target[0].length))
  return { file: rel, via: 'busca', changed: 1 }
}

// ---------- imagens e páginas ----------

const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' }

/** Guarda a imagem enviada em `public/superelements/` e devolve o endereço dela no site. */
export function saveImage(site: CodeSite, input: { name?: string; data: string }) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(input.data)
  if (!m || !IMAGE_TYPES[m[1]]) throw new Error('Envie uma imagem PNG, JPG, WebP, GIF, AVIF ou SVG.')
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > 15 * 1024 * 1024) throw new Error('Imagem grande demais (máximo 15 MB).')
  const base = (input.name ?? 'imagem').replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'imagem'
  const fileName = `${base}-${Date.now().toString(36)}.${IMAGE_TYPES[m[1]]}`
  const dir = path.join(site.dir, UPLOAD_DIR)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, fileName), bytes)
  return { src: `/${UPLOAD_DIR.replace(/^public\//, '')}/${fileName}`, file: `${UPLOAD_DIR}/${fileName}` }
}

/** As páginas do site, dos arquivos em `src/pages` (as dinâmicas, [slug], ficam marcadas). */
export function listPages(site: CodeSite): SitePage[] {
  const root = path.join(site.dir, 'src', 'pages')
  if (!existsSync(root)) return []
  const pages: SitePage[] = []
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (/\.(astro|md|mdx|html)$/.test(entry.name) && !entry.name.startsWith('_')) {
        const rel = path.relative(root, full).split(path.sep).join('/')
        const route = `/${rel.replace(/\.(astro|md|mdx|html)$/, '').replace(/(^|\/)index$/, '')}`.replace(/\/$/, '') || '/'
        pages.push({ file: path.relative(site.dir, full).split(path.sep).join('/'), route })
      }
    }
  }
  visit(root)
  return pages.sort((a, b) => (a.route === '/' ? -1 : b.route === '/' ? 1 : a.route.localeCompare(b.route)))
}
