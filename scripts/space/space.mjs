#!/usr/bin/env node
/**
 * Claude ou Codex no Space: lê e muda as páginas do projeto aberto no canvas, pela
 * ponte do servidor de dev (scripts/space/vitePlugin.ts). Quem salva na conta
 * é a aba do Space, com o login de quem está nela; cada gravação daqui é um
 * passo do Ctrl+Z no canvas.
 *
 *   node scripts/space/space.mjs status
 *   node scripts/space/space.mjs pull --page Home
 *   node scripts/space/space.mjs push .space/msa/home/03-sobre.json --label "Sobre mais curto"
 *
 * Rode sem argumentos para ver todos os comandos.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WORK = path.join(ROOT, '.space')
const STATE_FILE = path.join(WORK, 'bridge.json')

const HELP = `Agente no Space (Claude ou Codex) — trabalhar na página do cliente direto no canvas

  status                          projeto aberto, páginas, seções e o que está selecionado
  projects                        projetos da conta
  open <nome|id>                  abre o projeto na aba do Space e espera ficar pronto
  pull [--page <nome>]...         baixa as páginas para .space/<projeto>/<página>/ (uma seção por arquivo)
  push <arquivo|pasta>... --label "<o que mudou>" [--force] [--no-focus]
                                  grava no canvas as seções alteradas e as novas (um passo do Ctrl+Z)
  remove <seção>... --label "..." tira seções da página
  move <seção> (--after <seção> | --before <seção> | --index <n>) [--page <nome>] --label "..."
  page-add <nome> [--label "..."] cria uma página no canvas
  page-remove <nome> --label "…"  tira uma página (com as seções dela) do canvas
  plan "<seção>" "<seção>"… (--new <nome da página> | --page <nome> [--after <seção>])
                                  põe o plano no canvas: seções em esqueleto borrado, que ficam nítidas ao gravar
  work "<o que estou fazendo>" [--section <seção>]… [--page <nome>] | work --done
                                  mostra no canvas onde o agente está mexendo (borrado com varredura)
  build <arquivo.ts> [--out <arquivo.json>] [--page <nome>] [--after <seção>]
                                  gera uma seção com os builders do repo (export default: elemento, lista ou {title, elements})
  say "<texto>" [--kind note|question|done] [--section <seção>]
                                  escreve no painel do agente no canvas (nome: SPACE_AGENT, ou detectado)
  focus <seção> | --page <nome>   leva o canvas até a seção ou a página
  shot [--page <nome>] [--section <seção>]... [--device desktop|tablet|mobile|all]
                                  fotos da página (ou das seções) como o player mostra, em .space/<projeto>/fotos/

  <seção> é o id (ou o começo dele), o número na página ("3", com --page) ou parte do título.
  Opções gerais: --tab <id> escolhe a aba; --json mostra a resposta crua.`

// ---------- argumentos ----------

const argv = process.argv.slice(2)
const command = argv.shift()
const flags = {}
const positional = []
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (!arg.startsWith('--')) {
    positional.push(arg)
    continue
  }
  const [key, inline] = arg.slice(2).split(/=(.*)/s)
  const value = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true)
  if (flags[key] === undefined) flags[key] = value
  else flags[key] = [].concat(flags[key], value)
}
const list = (value) => (value === undefined ? [] : [].concat(value).filter((v) => v !== true))
const one = (value) => list(value)[0]

const fail = (message) => {
  console.error(`✖ ${message}`)
  process.exit(1)
}

// ---------- ponte ----------

function bridge() {
  if (!existsSync(STATE_FILE)) fail('A ponte não está no ar: o servidor de dev (npm run dev / preview do Ship Studio) precisa estar rodando com o plugin space-bridge.')
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}

async function request(pathname, init = {}) {
  const { url, token } = bridge()
  let response
  try {
    response = await fetch(`${url}/__space${pathname}`, { ...init, headers: { 'x-space-token': token, 'content-type': 'application/json', ...init.headers } })
  } catch {
    fail(`Não consegui falar com o servidor de dev em ${url}. Ele está rodando?`)
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) fail(body.error ?? `HTTP ${response.status}`)
  return body
}

/**
 * Quem está usando a ponte, para o painel do canvas: SPACE_AGENT decide; sem
 * ela, o Claude Code se identifica por CLAUDECODE e o Codex pelas variáveis CODEX_.
 */
const AGENT =
  process.env.SPACE_AGENT?.trim() ||
  (process.env.CLAUDECODE ? 'Claude' : Object.keys(process.env).some((k) => k.startsWith('CODEX_')) ? 'Codex' : 'Agente')

const call = async (method, params = {}) =>
  (await request('/call', { method: 'POST', body: JSON.stringify({ method, params, tab: one(flags.tab), agent: AGENT }) })).result

// ---------- utilidades ----------

export const slug = (name) =>
  String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'pagina'

const pad = (n) => String(n).padStart(2, '0')
const localHash = (section) => createHash('sha1').update(JSON.stringify([section.title, section.elements, section.data ?? {}])).digest('hex').slice(0, 12)
const shortenDataUrls = (text) =>
  text.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{120,}/gi, (m) => `data:…(${Math.round(m.length / 1024)} KB, encurtado)`)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}
const rel = (file) => path.relative(ROOT, file).replaceAll('\\', '/')

/** Clientes com marca e builder no repo. O nome do projeto no Space decide qual. */
const CLIENTS = [
  { match: /process\s*base/i, brand: 'brands/processbase', builder: 'src/features/processbase/elementor.ts', scope: 'ProcessBase model' },
  { match: /\bmsa\b|marketing\s*sem\s*ag/i, brand: 'brands/marketing-sem-agencia', builder: 'src/features/msa', scope: 'MSA — Marketing sem Agência model' },
  { match: /j[uú]nior/i, brand: 'brands/junior-automaticos', builder: 'src/features/junior/elementor.ts', scope: 'Júnior Automáticos model' },
  { match: /caramelo|petshop/i, brand: 'brands/caramelo-pet', builder: 'src/features/petshop/elementor.ts', scope: 'Caramelo Pet model (petshop example)' },
  { match: /inpel/i, brand: 'brands/inpel', builder: 'src/features/inpel/elementor.ts', scope: 'Inpel model' },
  { match: /zelo/i, brand: 'public/zelo', builder: 'src/features/zelo/elementor.ts', scope: 'Zelo model' },
  { match: /leo\s*scherer/i, brand: 'public/leoscherer', builder: 'src/features/leoscherer', scope: 'Leo Scherer model' },
]
const clientOf = (name = '') => CLIENTS.find((c) => c.match.test(name))

const projectDir = (project) => path.join(WORK, slug(project?.name ?? 'projeto'))

/** Seção do status a partir do id, começo do id, número na página ou parte do título. */
function resolveSection(status, ref, pageRef) {
  if (!ref) fail('Diga qual seção')
  const pages = pageRef ? [resolvePage(status, pageRef)] : status.pages
  const all = pages.flatMap((p) => p.sections.map((s) => ({ ...s, page: p }))).concat(pageRef ? [] : status.loose.map((s) => ({ ...s, page: null })))
  const byId = all.filter((s) => s.id === ref || s.id.startsWith(ref))
  if (byId.length === 1) return byId[0]
  if (/^\d+$/.test(ref) && pages.length === 1) {
    const hit = pages[0].sections[Number(ref) - 1]
    if (hit) return { ...hit, page: pages[0] }
  }
  const lower = ref.toLowerCase()
  const byTitle = all.filter((s) => s.title.toLowerCase().includes(lower))
  if (byTitle.length === 1) return byTitle[0]
  fail(byTitle.length > 1 ? `"${ref}" serve para mais de uma seção: ${byTitle.map((s) => `${s.title} (${s.id.slice(0, 8)})`).join(', ')}` : `Seção não encontrada: ${ref}`)
}

function resolvePage(status, ref) {
  if (!ref) return status.pages.find((p) => p.id === status.activePageId) ?? status.pages[0]
  const lower = String(ref).toLowerCase()
  const page =
    status.pages.find((p) => p.id === ref || p.id.startsWith(ref)) ??
    status.pages.find((p) => p.name.toLowerCase() === lower) ??
    status.pages.find((p) => slug(p.name) === slug(ref))
  if (!page) fail(`Página não encontrada: ${ref}. Páginas: ${status.pages.map((p) => p.name).join(', ')}`)
  return page
}

async function readyStatus() {
  const status = await call('status')
  if (!status.ready) fail(status.project ? `O projeto ${status.project.name} ainda está abrindo; tente de novo.` : 'Nenhum projeto aberto no Space. Peça para abrir um, ou use "open <nome>".')
  return status
}

// ---------- comandos ----------

async function cmdStatus() {
  const { tabs } = await request('/status')
  if (!tabs.length) fail('Nenhuma aba do Space conectada. Abra o app no preview do Ship Studio ou no navegador (npm run dev).')
  const status = await call('status')
  if (flags.json) return console.log(JSON.stringify({ tabs, status }, null, 2))

  if (tabs.length > 1) console.log(`Abas conectadas: ${tabs.map((t) => `${t.tabId.slice(0, 6)} ${t.url}${t.visible ? '' : ' (em segundo plano)'}`).join(' · ')}`)
  if (!status.project) return console.log(`Aba em ${status.route}: nenhum projeto aberto. Projetos: node scripts/space/space.mjs projects`)
  console.log(`Projeto: ${status.project.name}  (${status.project.id})${status.ready ? '' : '  · ainda abrindo'}`)
  if (!status.ready) return
  const client = clientOf(status.project.name)
  console.log(`Marca no Space: ${status.brand.name ?? 'nenhuma'}${status.brand.enabled ? '' : ' (desligada)'}${client ? `  · no repo: ${client.brand} · builder: ${client.builder} · AGENTS.md: "${client.scope}"` : ''}`)
  if (status.project.context?.trim()) console.log(`Briefing: ${status.project.context.trim().replace(/\s+/g, ' ').slice(0, 220)}${status.project.context.length > 220 ? '…' : ''}`)
  console.log(`Tela no canvas: ${status.device} · nível: ${status.editLevel}`)
  console.log('')
  const selected = new Set(status.selection.sectionIds)
  for (const page of status.pages) {
    const active = page.id === status.activePageId ? '  ← ativa' : ''
    const wp = page.wordpress ? `  · WordPress: ${page.wordpress.link ?? page.wordpress.siteUrl}` : ''
    console.log(`▸ ${page.name}  (${page.sections.length} seções, ${page.id.slice(0, 8)})${active}${wp}`)
    for (const s of page.sections) {
      const marks = [selected.has(s.id) && 'SELECIONADA', s.fromSite && 'do site', !s.valid && 'JSON inválido', s.sourceId].filter(Boolean)
      console.log(`   ${pad(s.index + 1)}. ${s.title}  ·  ${s.id.slice(0, 8)}${marks.length ? `  [${marks.join(', ')}]` : ''}`)
    }
  }
  if (status.loose.length) console.log(`▸ Soltas no canvas: ${status.loose.map((s) => `${s.title} (${s.id.slice(0, 8)})`).join(', ')}`)
  const el = status.selection.element
  if (el) {
    const section = status.pages.flatMap((p) => p.sections).find((s) => s.id === el.sectionId)
    console.log(`\nCamada escolhida: ${el.label ?? el.widgetType ?? el.elType} (${el.elementId}) em "${section?.title ?? el.sectionId}"${el.text ? `: "${el.text}"` : ''}`)
  } else if (selected.size) console.log(`\nSelecionadas: ${status.selection.sectionIds.length}`)
}

async function cmdProjects() {
  const { projects, status } = await call('projects')
  if (flags.json) return console.log(JSON.stringify(projects, null, 2))
  if (!projects.length) return console.log(status === 'ready' ? 'A conta não tem projetos.' : 'A lista de projetos ainda não carregou nesta aba (abra a tela de Projetos).')
  for (const p of projects) console.log(`${p.name}  ·  ${p.pages} pág., ${p.sections} seções  ·  ${p.id}${p.role === 'editor' ? '  (compartilhado)' : ''}`)
}

async function cmdOpen() {
  const ref = positional.join(' ')
  if (!ref) fail('Diga o nome ou o id do projeto')
  const { projects } = await call('projects')
  const lower = ref.toLowerCase()
  const matches = projects.filter((p) => p.id === ref || p.id.startsWith(ref) || p.name.toLowerCase().includes(lower))
  if (matches.length !== 1) fail(matches.length ? `Mais de um projeto: ${matches.map((p) => p.name).join(', ')}` : `Projeto não encontrado: ${ref}`)
  const project = matches[0]
  const { tab } = await request('/call', { method: 'POST', body: JSON.stringify({ method: 'open', params: { projectId: project.id }, tab: one(flags.tab) }) })
  process.stdout.write(`Abrindo ${project.name}…`)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const { tabs } = await request('/status').catch(() => ({ tabs: [] }))
    if (tabs.some((t) => t.tabId === tab.tabId && t.projectId === project.id && t.ready)) {
      console.log(' pronto.')
      return
    }
  }
  fail('O projeto não abriu em 60 s. Confira o preview (login, internet).')
}

async function cmdPull() {
  await readyStatus()
  await pullPages(list(flags.page))
}

/** Baixa as páginas (por nome ou id; nenhuma = todas) para .space/<projeto>/. */
async function pullPages(pageRefs) {
  const data = await call('pull', { pages: pageRefs })
  const dir = projectDir(data.project)
  const client = clientOf(data.project.name)

  const lines = [
    `# ${data.project.name}`,
    '',
    `- Projeto no Space: \`${data.project.id}\` (${data.project.role === 'editor' ? 'compartilhado comigo' : 'dono'})`,
    client && `- No repo: marca \`${client.brand}\` (DESIGN.md e COPY.md), builder \`${client.builder}\`, regras em AGENTS.md › ${client.scope}`,
    `- Marca no Space: ${data.brand.name ?? 'nenhuma'}${data.brand.enabled ? '' : ' (desligada)'} — texto em \`marca.md\``,
    `- Lido em ${new Date().toLocaleString('pt-BR')}`,
    '',
    '## Páginas',
    ...data.pages.map((p) => `- ${p.name} — ${p.sections.length} seções${p.wordpress ? ` · publica em ${p.wordpress.link ?? p.wordpress.siteUrl}` : ''}`),
    '',
    '## Briefing do projeto',
    '',
    data.project.context?.trim() || '_(vazio no Space)_',
    '',
  ].filter((l) => l !== undefined && l !== null && l !== false)
  writeJson(path.join(dir, 'status.json'), { ...data, content: undefined, brandSource: undefined })
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'projeto.md'), lines.join('\n'))
  writeFileSync(path.join(dir, 'marca.md'), shortenDataUrls(data.brandSource || '(sem marca no Space)\n'))

  console.log(`Projeto ${data.project.name} → ${rel(dir)}/`)
  for (const page of data.content) {
    const pageDir = path.join(dir, slug(page.name))
    // Os arquivos de uma leitura antiga saem; seções novas ainda não gravadas (sem id) ficam
    if (existsSync(pageDir)) {
      for (const file of readdirSync(pageDir)) {
        const full = path.join(pageDir, file)
        if (file === '_base.json') rmSync(full)
        else if (file.endsWith('.json')) {
          try {
            if (readJson(full).id) rmSync(full)
          } catch {
            // Arquivo que não é seção: fica
          }
        }
      }
    }
    const base = {}
    for (const s of page.sections) {
      const { elementorJson, title, ...rest } = s.data
      let elements
      try {
        elements = JSON.parse(elementorJson)
      } catch {
        elements = elementorJson
      }
      const section = { id: s.id, page: page.name, position: s.index + 1, title, data: rest, elements }
      const file = path.join(pageDir, `${pad(s.index + 1)}-${slug(title)}.json`)
      writeJson(file, section)
      base[s.id] = { hash: s.hash, local: localHash(section), file: path.basename(file) }
    }
    writeJson(path.join(pageDir, '_base.json'), { pageId: page.id, page: page.name, pulledAt: Date.now(), sections: base })
    console.log(`  ▸ ${page.name}: ${page.sections.length} seções em ${rel(pageDir)}/`)
    for (const s of page.sections) console.log(`     ${pad(s.index + 1)}-${slug(s.data.title)}.json  ·  ${s.data.title}  (${Math.round(s.size / 1024)} KB)`)
  }
}

/** Arquivos de seção pedidos: arquivos soltos ou todos os .json de uma pasta. */
function sectionFiles(refs) {
  const files = []
  for (const ref of refs) {
    const full = path.resolve(ref)
    if (!existsSync(full)) fail(`Arquivo não encontrado: ${ref}`)
    if (statSync(full).isDirectory()) {
      for (const f of readdirSync(full).sort()) if (f.endsWith('.json') && !f.startsWith('_')) files.push(path.join(full, f))
    } else files.push(full)
  }
  return files
}

const baseFor = (file) => {
  const baseFile = path.join(path.dirname(file), '_base.json')
  return existsSync(baseFile) ? { baseFile, base: readJson(baseFile) } : { baseFile, base: null }
}

const elementorJsonOf = (section, file) => {
  const elements = typeof section.elements === 'string' ? JSON.parse(section.elements) : section.elements
  const list = Array.isArray(elements) ? elements : elements?.content ?? elements?.elements ?? [elements]
  if (!Array.isArray(list) || !list.length || typeof list[0] !== 'object') fail(`${rel(file)}: "elements" precisa ser a lista de elementos do Elementor`)
  return JSON.stringify(list)
}

async function cmdPush() {
  const label = one(flags.label)
  if (!label) fail('Diga o que mudou com --label "…" (aparece no painel do agente no canvas)')
  const files = sectionFiles(positional)
  if (!files.length) fail('Diga quais arquivos de seção gravar')
  const status = await readyStatus()

  const ops = []
  const expect = {}
  const plan = []
  // Várias novas "depois da mesma seção" entram em fila, na ordem dos arquivos
  const lastAfter = new Map()
  for (const file of files) {
    const section = readJson(file)
    if (!section.title) fail(`${rel(file)}: falta "title"`)
    const elementorJson = elementorJsonOf(section, file)
    const { base } = baseFor(file)
    if (section.id) {
      const known = base?.sections?.[section.id]
      if (known && known.local === localHash(section) && !flags.all) continue
      if (known) expect[section.id] = known.hash
      else if (!flags.force) fail(`${rel(file)}: seção ${section.id.slice(0, 8)} sem leitura registrada em _base.json; faça pull antes (ou --force)`)
      ops.push({ op: 'update', id: section.id, title: section.title, elementorJson, data: section.data })
      plan.push({ file, section, kind: 'muda' })
    } else {
      const place = section.place ?? {}
      const page = resolvePage(status, place.page ?? section.page ?? base?.pageId)
      const anchor = (ref) => (ref ? resolveSection(status, ref, page.id).id : undefined)
      const ref = `new:${plan.length}`
      const afterId = anchor(place.after)
      const after = afterId && lastAfter.get(afterId)
      if (afterId) lastAfter.set(afterId, ref)
      ops.push({ op: 'insert', ref, page: page.id, index: place.index, after: after ?? afterId, before: anchor(place.before), data: { ...(section.data ?? {}), title: section.title, elementorJson } })
      plan.push({ file, section, kind: 'nova', ref, pageId: page.id })
    }
  }
  if (!ops.length) return console.log('Nada mudou nos arquivos desde a leitura. (Use --all para gravar mesmo assim.)')

  const result = await call('apply', { label, ops, expect, force: !!flags.force, focus: !flags['no-focus'] })

  // Os arquivos passam a valer como a versão do canvas: novas ganham id, todas ganham o hash novo
  for (const item of plan) {
    const id = item.kind === 'nova' ? result.created[item.ref] : item.section.id
    const section = { ...item.section, id }
    delete section.place
    writeJson(item.file, section)
    const { baseFile, base } = baseFor(item.file)
    const next = base ?? { pageId: item.pageId, sections: {} }
    next.sections[id] = { hash: result.hashes[id], local: localHash(section), file: path.basename(item.file) }
    writeJson(baseFile, next)
    console.log(`✔ ${item.kind === 'nova' ? 'nova' : 'alterada'}: ${section.title}  (${id.slice(0, 8)})`)
  }
  console.log(`No canvas: "${label}" — Ctrl+Z no Space desfaz.`)
}

async function cmdRemove() {
  const label = one(flags.label)
  if (!label) fail('Diga o porquê com --label "…"')
  const status = await readyStatus()
  const sections = positional.map((ref) => resolveSection(status, ref, one(flags.page)))
  await call('apply', { label, ops: sections.map((s) => ({ op: 'remove', id: s.id })), expect: Object.fromEntries(sections.map((s) => [s.id, s.hash])), force: !!flags.force })
  console.log(`✔ Saíram: ${sections.map((s) => s.title).join(', ')}. Ctrl+Z no Space desfaz.`)
}

async function cmdMove() {
  const label = one(flags.label)
  if (!label) fail('Diga o porquê com --label "…"')
  const status = await readyStatus()
  const section = resolveSection(status, positional[0])
  const page = flags.page ? resolvePage(status, one(flags.page)) : section.page
  const anchor = (ref) => (ref ? resolveSection(status, ref, page.id).id : undefined)
  await call('apply', {
    label,
    ops: [{ op: 'move', id: section.id, page: page?.id, index: flags.index !== undefined ? Number(one(flags.index)) - 1 : undefined, after: anchor(one(flags.after)), before: anchor(one(flags.before)) }],
  })
  console.log(`✔ ${section.title} mudou de lugar. Ctrl+Z no Space desfaz.`)
}

async function cmdWork() {
  if (flags.done) {
    await call('work', { done: true })
    return console.log('✔ O canvas parou de mostrar onde estou mexendo.')
  }
  const text = positional.join(' ')
  let sections
  let page
  if (flags.section || flags.page) {
    const status = await readyStatus()
    sections = list(flags.section).map((ref) => resolveSection(status, ref, one(flags.page)).id)
    if (!sections.length) page = resolvePage(status, one(flags.page)).id
  }
  await call('work', { text, sections, page })
  console.log(`✔ No canvas: ${text || 'Trabalhando'}`)
}

async function cmdPlan() {
  if (!positional.length) fail('Diga as seções do plano: space plan "Hero" "Serviços" "Contato" --new "Sobre"')
  const status = await readyStatus()
  const newPage = one(flags.new)
  const page = newPage ? undefined : resolvePage(status, one(flags.page))
  const after = flags.after && page ? resolveSection(status, one(flags.after), page.id).id : undefined
  const result = await call('plan', { titles: positional, newPage, page: page?.id, after, label: one(flags.label) })
  console.log(`✔ Plano no canvas (${result.sections.length} seções em esqueleto). Arquivos para construir:`)
  await pullPages([result.pageId])
  console.log('Construa uma seção por vez: troque "elements" no arquivo e grave com push. Cada uma sai do borrado ao gravar.')
}

async function cmdPageRemove() {
  const label = one(flags.label)
  if (!label) fail('Diga o porquê com --label "…"')
  const status = await readyStatus()
  const page = resolvePage(status, positional.join(' '))
  await call('apply', { label, ops: [{ op: 'removePage', page: page.id }] })
  console.log(`✔ Página ${page.name} saiu do canvas. Ctrl+Z no Space desfaz.`)
}

async function cmdPageAdd() {
  const name = positional.join(' ')
  if (!name) fail('Diga o nome da página')
  await readyStatus()
  const result = await call('apply', { label: one(flags.label) ?? `Página nova: ${name}`, ops: [{ op: 'addPage', ref: 'page', name }] })
  console.log(`✔ Página ${name} criada (${result.pages.page}).`)
}

async function cmdBuild() {
  const entry = positional[0]
  if (!entry) fail('Diga o arquivo .ts que monta a seção')
  const { build } = await import(pathToFileURL(path.join(ROOT, 'node_modules/esbuild/lib/main.js')).href)
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'space-build-'))
  const bundle = path.join(outDir, 'section.mjs')
  try {
    await build({
      entryPoints: [path.resolve(entry)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: bundle,
      alias: { '@': path.join(ROOT, 'src') },
      loader: { '.svg': 'text', '.css': 'text', '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl' },
      // Alguns módulos do app leem window.location ao carregar
      banner: { js: "globalThis.window ??= { location: { origin: 'http://localhost' } }; globalThis.location ??= globalThis.window.location;" },
      logLevel: 'error',
    })
    const mod = await import(pathToFileURL(bundle).href)
    let value = mod.default ?? mod.section
    if (typeof value === 'function') value = await value()
    if (!value) fail(`${entry} não exporta nada (use export default)`)
    const section = Array.isArray(value) || value.elType ? { elements: [].concat(value) } : value
    const out = path.resolve(one(flags.out) ?? entry.replace(/\.[tj]sx?$/, '.json'))
    const place = section.place ?? (flags.after || flags.before || flags.index ? { after: one(flags.after), before: one(flags.before), index: flags.index ? Number(one(flags.index)) - 1 : undefined } : undefined)
    const file = {
      title: section.title ?? path.basename(entry).replace(/\.[tj]sx?$/, ''),
      page: section.page ?? one(flags.page),
      ...(place ? { place } : {}),
      data: section.data ?? {},
      elements: section.elements,
    }
    writeJson(out, file)
    console.log(`✔ Seção "${file.title}" montada em ${rel(out)}. Grave com: node scripts/space/space.mjs push ${rel(out)} --label "…"`)
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
}

async function cmdSay() {
  const text = positional.join(' ')
  if (!text) fail('Diga o texto')
  let sections
  if (flags.section) {
    const status = await readyStatus()
    sections = list(flags.section).map((ref) => resolveSection(status, ref, one(flags.page)).id)
  }
  await call('say', { text, kind: one(flags.kind), sections })
  console.log(`✔ No painel, como ${AGENT}.`)
}

async function cmdFocus() {
  const status = await readyStatus()
  if (flags.page && !positional.length) await call('focus', { page: resolvePage(status, one(flags.page)).id })
  else await call('focus', { id: resolveSection(status, positional[0], one(flags.page)).id })
  console.log('✔ Canvas no lugar.')
}

// ---------- fotos (Edge headless pelo CDP) ----------

const DEVICES = { desktop: { width: 1440, height: 900, slice: 1800 }, tablet: { width: 768, height: 1024, slice: 2048 }, mobile: { width: 375, height: 812, slice: 1624 } }
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
]

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('CDP não abriu'))
  })
  let next = 0
  const waiting = new Map()
  const listeners = new Map()
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id)
      waiting.delete(message.id)
      message.error ? reject(new Error(message.error.message)) : resolve(message.result)
    } else if (message.method) listeners.get(message.method)?.forEach((fn) => fn(message.params))
  }
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++next
        waiting.set(id, { resolve, reject })
        ws.send(JSON.stringify({ id, method, params }))
      }),
    once: (method) => new Promise((resolve) => listeners.set(method, [...(listeners.get(method) ?? []), resolve])),
    close: () => ws.close(),
  }
}

async function capture(url, device, outBase) {
  const browser = BROWSERS.find((b) => existsSync(b))
  if (!browser) fail('Não achei o Edge nem o Chrome para tirar a foto')
  const port = 9400 + Math.floor(Math.random() * 400)
  const profile = mkdtempSync(path.join(os.tmpdir(), 'space-shot-'))
  const child = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })
  try {
    let targets
    for (let i = 0; i < 50 && !targets; i++) {
      await new Promise((r) => setTimeout(r, 200))
      targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null)
    }
    const page = targets?.find((t) => t.type === 'page')
    if (!page) throw new Error('O navegador headless não abriu')
    const tab = await cdp(page.webSocketDebuggerUrl)
    const { width, height, slice } = DEVICES[device]
    await tab.send('Page.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: device === 'mobile' })
    // Sem movimento: a foto mostra a composição final (as histórias com GSAP respeitam isso)
    await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const loaded = tab.once('Page.loadEventFired')
    await tab.send('Page.navigate', { url })
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 20_000))])
    await tab.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true })
    await new Promise((r) => setTimeout(r, 800))
    const metrics = await tab.send('Page.getLayoutMetrics')
    const total = Math.min(Math.ceil((metrics.cssContentSize ?? metrics.contentSize).height), 20_000)
    const files = []
    for (let y = 0, n = 1; y < total; y += slice, n++) {
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(slice, total - y), scale: 1 } })
      const file = total > slice ? `${outBase}-${n}.png` : `${outBase}.png`
      writeFileSync(file, Buffer.from(data, 'base64'))
      files.push(file)
    }
    tab.close()
    return { files, total }
  } finally {
    child.kill()
    await new Promise((r) => setTimeout(r, 300))
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
  }
}

async function cmdShot() {
  const status = await readyStatus()
  const { url, token } = bridge()
  const pageRef = one(flags.page)
  const sections = list(flags.section).map((ref) => resolveSection(status, ref, pageRef))
  const page = sections.length ? null : resolvePage(status, pageRef)
  const deviceFlag = one(flags.device) ?? 'desktop'
  const devices = deviceFlag === 'all' ? ['desktop', 'mobile'] : [deviceFlag]
  for (const d of devices) if (!DEVICES[d]) fail(`Tela desconhecida: ${d} (desktop, tablet, mobile ou all)`)

  const dir = path.join(projectDir(status.project), 'fotos')
  mkdirSync(dir, { recursive: true })
  const name = page ? slug(page.name) : sections.map((s) => slug(s.title)).join('+').slice(0, 60)
  for (const device of devices) {
    const query = new URLSearchParams({ token, device, ...(page ? { page: page.id } : { sections: sections.map((s) => s.id).join(',') }) })
    if (flags.tab) query.set('tab', one(flags.tab))
    const { files, total } = await capture(`${url}/__space/render?${query}`, device, path.join(dir, `${name}-${device}`))
    console.log(`✔ ${device} (${total}px de altura): ${files.map(rel).join(', ')}`)
  }
}

// ---------- entrada ----------

const COMMANDS = {
  status: cmdStatus,
  projects: cmdProjects,
  open: cmdOpen,
  pull: cmdPull,
  push: cmdPush,
  remove: cmdRemove,
  move: cmdMove,
  'page-add': cmdPageAdd,
  'page-remove': cmdPageRemove,
  work: cmdWork,
  plan: cmdPlan,
  build: cmdBuild,
  say: cmdSay,
  focus: cmdFocus,
  shot: cmdShot,
}

if (!command || command === 'help' || flags.help) {
  console.log(HELP)
} else if (!COMMANDS[command]) {
  fail(`Comando desconhecido: ${command}\n\n${HELP}`)
} else {
  COMMANDS[command]().catch((error) => fail(error?.message ?? String(error)))
}
