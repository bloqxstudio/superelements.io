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

Vários agentes ao mesmo tempo: cada sessão (Claude ou Codex) trabalha no seu projeto.
"open" liga a sessão a um projeto; dali em diante os comandos vão para ele, esteja ele
aberto na tela de alguém (que vê o agente no canvas) ou em segundo plano. A tela de
quem acompanha não muda. Acompanhe todos em /agentes no app.

  status                          projeto da sessão, páginas, seções, o que está selecionado e os outros agentes
  projects                        projetos da conta (e quem está trabalhando em cada um)
  agents                          agentes trabalhando agora, em todos os projetos
  open <nome|id> [--show]         liga esta sessão ao projeto e espera ele abrir (em segundo plano,
                                  se ninguém o tem aberto); --show também o mostra na tela do usuário
  new <nome> [--context "<briefing>" | --context-file <arquivo>] [--show]
                                  cria um projeto na conta e liga esta sessão a ele
  close                           terminou: o projeto em segundo plano salva e fecha agora (sozinho, fecha
                                  depois de 6 min sem pedido)
  brief [--set "<texto>" | --file <arquivo>]
                                  mostra ou troca o briefing do projeto (o campo Contexto)
  pull [--page <nome>]...         baixa as páginas para .space/<projeto>/<página>/ (uma seção por arquivo)
  push <arquivo|pasta>... --label "<o que mudou>" [--force] [--no-focus]
                                  grava no canvas as seções alteradas e as novas (um passo do Ctrl+Z)
  remove <seção>... --label "..." tira seções da página
  move <seção> (--after <seção> | --before <seção> | --index <n>) [--page <nome>] --label "..."
  page-add <nome> [--label "..."] cria uma página no canvas
  page-remove <nome> --label "…"  tira uma página (com as seções dela) do canvas
  plan "<seção>" "<seção>"… (--new <nome da página> | --page <nome> [--after <seção>])
                                  põe o plano no canvas: seções em esqueleto borrado, que ficam nítidas ao gravar
  work "<o que estou fazendo>" [--section <seção>]… [--page <nome>] [--element <id da camada>] | work --done
                                  mostra no canvas onde o agente está mexendo (borrado com varredura) e leva o
                                  cursor dele até lá (até a camada, se ela estiver selecionada no canvas)
  build <arquivo.ts> [--out <arquivo.json>] [--page <nome>] [--after <seção>]
                                  gera uma seção com os builders do repo (export default: elemento, lista ou {title, elements})
  say "<texto>" [--kind note|question|done] [--section <seção>]
                                  escreve no painel do agente no canvas (nome: SPACE_AGENT, ou detectado)
  brand [<DESIGN.md>] [--on | --off]
                                  mostra, grava (e liga) ou liga/desliga a marca do projeto; a anterior fica em .space/<projeto>/marca-anterior.md
  focus <seção> | --page <nome>   leva o canvas até a seção ou a página
  shot [--page <nome>] [--section <seção>]... [--device desktop|tablet|mobile|all]
                                  fotos da página (ou das seções) como o player mostra, em .space/<projeto>/fotos/
  video [--page <nome>] [--device desktop|mobile|all] [--pause <s>] [--speed <px/s>] [--out arquivo.mp4]
                                  vídeo da página rolando do topo ao fim, com as animações (ffmpeg), em .space/<projeto>/videos/

Com o cliente e o site (falam com a conta e com o WordPress; cada um é um passo combinado):
  approval [--page <nome>] [--wait <min>]
                                  links de aprovação e respostas do cliente; --wait espera ele responder à versão atual
  approval send --page <nome> [--label "..."]
                                  manda a página de agora para o cliente (cria o link ou troca a foto do mesmo link)
  approval revoke --page <nome>   desativa o link
  invite | invite create [--label "<para quem>"] | invite cancel <id>
                                  pessoas e convites abertos; convite para editar o projeto junto (uma pessoa, 7 dias)
  wp                              conexão com o WordPress e as páginas já ligadas ao site
  wp connect <site> [--user <login> --password "<senha de aplicação>"]
                                  sem senha: o link para o WordPress aprovar; com ela: grava a conexão
  wp pages | wp import <id>...    páginas do site; trazer páginas do site para o canvas
  details --page <nome> [--title --slug --seo-title --description --keyword]
                                  título, endereço e SEO que vão junto ao publicar (--slug= limpa)
  publish --page <nome> [--live] [--layout canvas|tema] [--overwrite] --yes
                                  publica no WordPress (página nova vai como rascunho sem --live); sem --yes só mostra o que faria
  restore --page <nome> --yes     volta a página do site para a versão de antes da última publicação daqui

  <seção> é o id (ou o começo dele), o número na página ("3", com --page) ou parte do título.
  Opções gerais: --project <nome|id> (ou SPACE_PROJECT) usa outro projeto só neste comando;
  --tab <id> escolhe a aba; --json mostra a resposta crua.
  A sessão vem de CLAUDE_CODE_SESSION_ID, das variáveis do Codex ou de SPACE_SESSION; o nome no painel, de SPACE_AGENT.`

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

/**
 * Sair com erro sem process.exit na hora: no Windows (Node 24) ele derruba o
 * processo com "UV_HANDLE_CLOSING" quando o fetch ainda está fechando o socket.
 * O erro sobe até a entrada, que define o código de saída.
 */
class Exit extends Error {
  constructor(code) {
    super(`saída ${code}`)
    this.code = code
  }
}
const quit = (code) => {
  throw new Exit(code)
}
const fail = (message, code = 1) => {
  console.error(`✖ ${message}`)
  quit(code)
}

// ---------- ponte ----------

function bridge() {
  // O chat do canvas diz qual servidor de dev chamou o agente (pode haver mais de um rodando)
  if (process.env.SPACE_BRIDGE_URL && process.env.SPACE_BRIDGE_TOKEN) return { url: process.env.SPACE_BRIDGE_URL, token: process.env.SPACE_BRIDGE_TOKEN }
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

/**
 * Cada sessão do agente (uma conversa do Claude Code ou do Codex) trabalha no
 * seu projeto. Sem uma sessão conhecida, vale SPACE_SESSION; senão, todas as
 * chamadas sem sessão dividem uma só.
 */
const SESSION =
  [process.env.SPACE_SESSION, process.env.CLAUDE_CODE_SESSION_ID, process.env.CODEX_THREAD_ID, process.env.CODEX_SESSION_ID]
    .map((v) => v?.trim())
    .find(Boolean) ?? `${AGENT.toLowerCase()}-sem-sessao`
const SESSION_FILE = path.join(WORK, 'sessoes', `${SESSION.replace(/[^\w.-]/g, '_').slice(0, 100)}.json`)

/** O projeto em que esta sessão trabalha (gravado pelo open, pelo new ou pelo primeiro status). */
const readBinding = () => {
  try {
    return JSON.parse(readFileSync(SESSION_FILE, 'utf8'))
  } catch {
    return null
  }
}
const writeBinding = (project) => {
  mkdirSync(path.dirname(SESSION_FILE), { recursive: true })
  writeFileSync(SESSION_FILE, `${JSON.stringify({ projectId: project.id, projectName: project.name, agent: AGENT, session: SESSION, at: new Date().toISOString() }, null, 2)}\n`)
}

/** Projeto deste comando: --project, SPACE_PROJECT ou o da sessão. Sem nenhum, a tela de quem usa o app. */
let target = null

const call = async (method, params = {}) =>
  (await request('/call', { method: 'POST', body: JSON.stringify({ method, params, tab: one(flags.tab), agent: AGENT, session: SESSION, project: flags.tab ? undefined : target?.id }) })).result

/** Um projeto da conta pelo nome (ou parte dele) ou pelo id. */
async function findProject(ref) {
  const { projects } = await call('projects')
  const lower = String(ref).toLowerCase()
  const exact = projects.filter((p) => p.id === ref || p.name.toLowerCase() === lower)
  const matches = exact.length ? exact : projects.filter((p) => p.id.startsWith(ref) || p.name.toLowerCase().includes(lower) || slug(p.name) === slug(ref))
  if (matches.length !== 1) fail(matches.length ? `Mais de um projeto: ${matches.map((p) => p.name).join(', ')}` : `Projeto não encontrado: ${ref}. Projetos: ${projects.map((p) => p.name).join(', ')}`)
  return matches[0]
}

async function resolveTarget() {
  const ref = one(flags.project) ?? process.env.SPACE_PROJECT?.trim()
  if (ref) {
    const project = await findProject(ref)
    target = { id: project.id, name: project.name, from: 'flag' }
    return
  }
  const binding = readBinding()
  if (binding?.projectId) target = { id: binding.projectId, name: binding.projectName, from: 'session' }
}

/** Primeiro comando de uma sessão sem projeto: ela fica no projeto da tela de quem usa o app. */
function bindFromStatus(status) {
  if (target || flags.tab || !status.ready || !status.project) return
  writeBinding(status.project)
  target = { id: status.project.id, name: status.project.name, from: 'session' }
  console.error(`ℹ Esta sessão (${AGENT}) ficou no projeto ${status.project.name}: os próximos comandos vão para ele, mesmo que a tela mude. Para trocar: open <projeto>.`)
}

/** Outros agentes que mexeram no mesmo projeto há pouco: a proteção do push vale entre eles, mas é bom saber. */
async function othersIn(projectId) {
  const { agents } = await request('/agents').catch(() => ({ agents: [] }))
  return agents.filter((a) => a.projectId === projectId && a.session !== SESSION && a.state === 'working' && Date.now() - a.lastAt < 10 * 60_000)
}

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
  { match: /leo\s*scherer/i, brand: 'brands/leo-scherer', builder: 'src/features/leoscherer', scope: 'Leo Scherer model' },
  { match: /evermind/i, brand: 'public/brands/evermind', builder: 'src/features/evermind', scope: 'Evermind experiment (BYQ evermind-hero-2)' },
  { match: /skiper/i, brand: 'src/features/skiper', builder: 'src/features/skiper/elementor.ts', scope: 'Skiper UI experiment (effects lab)' },
  { match: /super\s*elements/i, brand: 'brands/superelements', builder: 'src/features/superelements', scope: 'Superelements model (our own product page)' },
  // Prospectos de São Leopoldo (RS), 2026-10-03: redesign para vender, ainda não são clientes
  { match: /baldez/i, brand: 'brands/baldez-moreira', builder: 'src/features/baldezmoreira/elementor.ts', scope: 'Baldez & Moreira model (prospect)' },
  { match: /fonseca/i, brand: 'brands/fonseca-lorenco', builder: 'src/features/fonsecalorenco/elementor.ts', scope: 'Fonseca & Lorenço model (prospect)' },
  { match: /macarthy/i, brand: 'brands/macarthy-scherer', builder: 'src/features/macarthyscherer/elementor.ts', scope: 'Macarthy Scherer model (prospect)' },
  { match: /braggio|cerveira/i, brand: 'brands/cerveira-braggio', builder: 'src/features/cerveirabraggio/elementor.ts', scope: 'Cerveira Braggio model (prospect)' },
  // O estúdio do usuário, que vende o serviço de sites (2026-10-04)
  { match: /avence/i, brand: 'brands/avence-studio', builder: 'src/features/avence/elementor.ts', scope: 'Avence Studio model (our studio)' },
  // Advogados de São Leopoldo que anunciam no Google (2026-10-04)
  { match: /reche\s*becker|emmanuel\s*becker/i, brand: 'brands/emmanuel-reche-becker', builder: 'src/features/rechebecker/elementor.ts', scope: 'Emmanuel Reche Becker model (prospect)' },
  { match: /depizzol|cassel\s*martins|\bdacm\b/i, brand: 'brands/dacm-advogados', builder: 'src/features/dacm/elementor.ts', scope: 'DACM Advogados model (prospect)' },
  { match: /stemmer/i, brand: 'brands/stemmer-advogados', builder: 'src/features/stemmer/elementor.ts', scope: 'Stemmer Advogados model (prospect)' },
  { match: /bordinh/i, brand: 'brands/ferreira-bordinhao', builder: 'src/features/ferreirabordinhao/elementor.ts', scope: 'Ferreira & Bordinhão model (prospect)' },
  { match: /katia\s*paix/i, brand: 'brands/katia-paixao', builder: 'src/features/katiapaixao/elementor.ts', scope: 'Katia Paixão model (prospect)' },
]
const clientOf = (name = '') => CLIENTS.find((c) => c.match.test(name))

const projectDir = (project) => path.join(WORK, slug(project?.name ?? 'projeto'))

/** Seção do status a partir do id, começo do id, número na página ou parte do título. */
function resolveSection(status, ref, pageRef) {
  if (!ref) fail('Diga qual seção')
  const pages = pageRef ? [resolvePage(status, pageRef)] : status.pages
  const all = pages.flatMap((p) => p.sections.map((s) => ({ ...s, page: p }))).concat(pageRef ? [] : status.loose.map((s) => ({ ...s, page: null })))
  // "3" com uma página só em jogo é a posição, mesmo que algum id comece com 3
  if (/^\d{1,3}$/.test(ref) && pages.length === 1) {
    const hit = pages[0].sections[Number(ref) - 1]
    if (hit) return { ...hit, page: pages[0] }
  }
  const byId = all.filter((s) => s.id === ref || s.id.startsWith(ref))
  if (byId.length === 1) return byId[0]
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
  bindFromStatus(status)
  return status
}

/** Em segundo plano não há canvas aberto, e o Ctrl+Z de quem abrir depois não alcança a mudança. */
const undoHint = (status) =>
  status.where === 'background' ? 'Feito em segundo plano: para desfazer, grave de novo a versão anterior (pull, editar, push).' : 'Ctrl+Z no Space desfaz.'

const STATE_LABEL = { working: 'trabalhando', question: 'esperando resposta', done: 'terminou' }
const agentLine = (a) => {
  const idle = a.state === 'working' && Date.now() - a.lastAt > 5 * 60_000
  const where = a.where === 'canvas' ? 'no canvas' : a.where === 'background' ? 'em segundo plano' : 'fechado'
  return `${a.agent} em ${a.projectName ?? a.projectId.slice(0, 8)} (${idle ? 'parado' : STATE_LABEL[a.state]}, ${where}, ${ago(a.lastAt)})${a.now && !idle ? `: ${a.now}` : ''}`
}
const ago = (at) => {
  const minutes = Math.round((Date.now() - at) / 60_000)
  return minutes < 1 ? 'agora' : minutes < 60 ? `há ${minutes} min` : `há ${Math.round(minutes / 60)} h`
}

// ---------- comandos ----------

async function cmdStatus() {
  const { tabs, agents = [] } = await request('/status')
  if (!tabs.length) fail('Nenhuma aba do Space conectada. Abra o app no preview do Ship Studio ou no navegador (npm run dev).')
  const status = await call('status')
  bindFromStatus(status)
  if (flags.json) return console.log(JSON.stringify({ tabs, agents, session: SESSION, target, status }, null, 2))

  const people = tabs.filter((t) => t.role !== 'worker')
  const background = tabs.filter((t) => t.role === 'worker')
  if (people.length > 1) console.log(`Telas abertas: ${people.map((t) => `${t.tabId.slice(0, 6)} ${t.projectName ?? t.url}${t.visible ? '' : ' (aba escondida)'}`).join(' · ')}`)
  if (background.length) console.log(`Em segundo plano: ${background.map((t) => `${t.projectName ?? t.projectId?.slice(0, 8)}${t.ready ? '' : ' (abrindo)'}`).join(', ')}`)
  const others = agents.filter((a) => a.session !== SESSION && Date.now() - a.lastAt < 60 * 60_000 && a.state !== 'done')
  if (others.length) console.log(`Outros agentes: ${others.map(agentLine).join(' · ')}`)
  if (!status.project) return console.log(`Aba em ${status.route}: nenhum projeto aberto. Escolha um com: open <projeto> (projetos: node scripts/space/space.mjs projects)`)
  const screen = people.find((t) => t.visible && t.projectId) ?? people.find((t) => t.projectId)
  console.log(`Sessão: ${AGENT} · ${target ? `trabalha em ${status.project.name}` : 'sem projeto'} · ${status.where === 'background' ? 'em segundo plano (ninguém está com ele aberto na tela)' : 'aberto na tela do usuário (ele vê no canvas)'}`)
  if (screen && screen.projectId !== status.project.id) console.log(`A tela do usuário está em ${screen.projectName ?? screen.url}. Se o pedido é sobre ela: open "${screen.projectName ?? screen.projectId}".`)
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
  const { agents } = await request('/agents').catch(() => ({ agents: [] }))
  const busy = (id) => agents.filter((a) => a.projectId === id && a.state !== 'done' && Date.now() - a.lastAt < 10 * 60_000)
  for (const p of projects) {
    const here = busy(p.id)
    const who = here.length ? `  ·  agora: ${here.map((a) => (a.session === SESSION ? `${a.agent} (esta sessão)` : a.agent)).join(', ')}` : ''
    console.log(`${p.name}  ·  ${p.pages} pág., ${p.sections} seções  ·  ${p.id}${p.role === 'editor' ? '  (compartilhado)' : ''}${who}`)
  }
}

async function cmdAgents() {
  const { agents } = await request('/agents')
  if (flags.json) return console.log(JSON.stringify(agents, null, 2))
  const recent = agents.filter((a) => Date.now() - a.lastAt < 3 * 60 * 60_000)
  if (!recent.length) return console.log('Nenhum agente trabalhou nas últimas 3 horas.')
  for (const a of recent) {
    const last = a.steps[a.steps.length - 1]
    console.log(`${a.session === SESSION ? '▸ ' : '  '}${agentLine(a)}${a.session === SESSION ? '  ← esta sessão' : ''}`)
    if (last) console.log(`    último: ${last.text}`)
  }
}

/**
 * Liga esta sessão ao projeto e espera ele abrir: na tela de quem já o tem
 * aberto, ou em segundo plano. A tela do usuário não muda (a não ser com --show).
 */
async function bindAndOpen(project, { show = false, created = false } = {}) {
  writeBinding(project)
  target = { id: project.id, name: project.name, from: 'session' }
  for (const other of await othersIn(project.id)) console.log(`Atenção: ${agentLine(other)}. Combine com o usuário quem mexe em quê; o push recusa mudança sobre leitura antiga.`)
  if (show) {
    const { tab } = await request('/call', { method: 'POST', body: JSON.stringify({ method: 'open', params: { projectId: project.id }, tab: one(flags.tab), agent: AGENT, session: SESSION }) })
    process.stdout.write(`${created ? `Projeto ${project.name} criado (${project.id}). ` : ''}Abrindo ${project.name} na tela do usuário…`)
    await waitOpen(tab, project.id)
  } else {
    process.stdout.write(`${created ? `Projeto ${project.name} criado (${project.id}). ` : ''}Abrindo ${project.name}…`)
    const status = await call('status')
    console.log(status.where === 'background' ? ' pronto, em segundo plano (a tela do usuário não mudou).' : ' pronto, na tela do usuário (ele acompanha no canvas).')
  }
  console.log(`Esta sessão (${AGENT}) trabalha em ${project.name}: os próximos comandos vão para ele. O usuário acompanha em /agentes.`)
}

/** Terminou: o projeto em segundo plano salva e fecha agora (sozinho, fecharia depois de alguns minutos parado). */
async function cmdClose() {
  if (!target) fail('Esta sessão não está em nenhum projeto.')
  const { released, where } = await request('/release', { method: 'POST', body: JSON.stringify({ project: target.id }) })
  if (released) console.log(`✔ ${target.name} salvou e fechou em segundo plano. A sessão continua nele: o próximo comando abre de novo.`)
  else console.log(where === 'canvas' ? `${target.name} está aberto na tela do usuário: fica como está.` : `${target.name} não estava aberto em segundo plano.`)
}

async function cmdOpen() {
  const ref = positional.join(' ')
  if (!ref) fail('Diga o nome ou o id do projeto')
  await bindAndOpen(await findProject(ref), { show: !!flags.show })
}

/** Cria o projeto na conta (nome e briefing, como o botão Novo projeto) e liga esta sessão a ele. */
async function cmdNew() {
  const name = positional.join(' ').trim()
  if (!name) fail('Diga o nome do projeto')
  const { projects } = await call('projects')
  if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) fail(`Já existe um projeto "${name}". Use: open ${name}`)
  const file = one(flags['context-file'])
  const context = file ? readFileSync(file, 'utf8') : (one(flags.context) ?? '')
  const { project } = await call('create', { name, context, open: false })
  await bindAndOpen(project, { show: !!flags.show, created: true })
}

async function waitOpen(tab, projectId) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const { tabs } = await request('/status').catch(() => ({ tabs: [] }))
    if (tabs.some((t) => t.tabId === tab.tabId && t.projectId === projectId && t.ready)) {
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
  // Arquivo de outro projeto (.space/<projeto>/…) nunca vai para este: com vários agentes, é o erro mais fácil de cometer
  const mine = slug(status.project.name)
  for (const file of files) {
    const [folder] = path.relative(WORK, file).split(path.sep)
    if (folder && folder !== '..' && folder !== mine && !path.isAbsolute(folder) && existsSync(path.join(WORK, folder, 'projeto.md'))) {
      fail(`${rel(file)} é do projeto da pasta "${folder}", mas esta sessão está em ${status.project.name}. Troque com: open <projeto>`)
    }
  }

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
  console.log(`No canvas: "${label}" — ${undoHint(status)}`)
}

async function cmdRemove() {
  const label = one(flags.label)
  if (!label) fail('Diga o porquê com --label "…"')
  const status = await readyStatus()
  const sections = positional.map((ref) => resolveSection(status, ref, one(flags.page)))
  await call('apply', { label, ops: sections.map((s) => ({ op: 'remove', id: s.id })), expect: Object.fromEntries(sections.map((s) => [s.id, s.hash])), force: !!flags.force })
  console.log(`✔ Saíram: ${sections.map((s) => s.title).join(', ')}. ${undoHint(status)}`)
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
  console.log(`✔ ${section.title} mudou de lugar. ${undoHint(status)}`)
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
  await call('work', { text, sections, page, element: one(flags.element) })
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
  console.log(`✔ Página ${page.name} saiu do canvas. ${undoHint(status)}`)
}

async function cmdPageAdd() {
  const name = positional.join(' ')
  if (!name) fail('Diga o nome da página')
  await readyStatus()
  const result = await call('apply', { label: one(flags.label) ?? `Página nova: ${name}`, ops: [{ op: 'addPage', ref: 'page', name }] })
  console.log(`✔ Página ${name} criada (${result.pages.page}).`)
}

const devOrigin = () => {
  try {
    return new URL(JSON.parse(readFileSync(STATE_FILE, 'utf8')).url).origin
  } catch {
    return 'http://localhost'
  }
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
      // Alguns módulos do app leem window.location ao carregar: a origem é a do servidor de dev,
      // para as imagens de public/ abrirem já na aba (o projeto troca a porta ao abrir)
      banner: { js: `globalThis.window ??= { location: { origin: ${JSON.stringify(devOrigin())} } }; globalThis.location ??= globalThis.window.location;` },
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

async function cmdBrand() {
  const status = await readyStatus()
  const file = positional[0]
  const params = {}
  if (file) {
    if (!existsSync(file)) fail(`Arquivo não encontrado: ${file}`)
    params.source = readFileSync(file, 'utf8')
    params.enabled = true
  }
  if (flags.on) params.enabled = true
  if (flags.off) params.enabled = false

  if (params.source !== undefined) {
    // A marca não entra no Ctrl+Z do canvas: a anterior fica guardada para voltar com "brand <arquivo>"
    const before = await call('brand', {})
    const backup = path.join(projectDir(status.project), 'marca-anterior.md')
    mkdirSync(path.dirname(backup), { recursive: true })
    writeFileSync(backup, before.source ?? '')
    console.log(`Marca anterior (${before.name ?? 'nenhuma'}) guardada em ${rel(backup)}`)
  }
  const result = await call('brand', params)
  if (flags.json) return console.log(JSON.stringify(result, null, 2))
  console.log(`${params.source !== undefined || params.enabled !== undefined ? '✔ ' : ''}Marca: ${result.name ?? 'nenhuma'} · ${result.enabled ? 'ligada' : 'desligada'}${result.format ? ` · formato ${result.format}` : ''}`)
  for (const w of result.warnings) console.log(`  aviso: ${w}`)
  for (const n of result.notes) console.log(`  nota: ${n}`)
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

// ---------- ciclo com o cliente: briefing, aprovação, convite, WordPress ----------

const when = (time) => new Date(time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const DECISION = { approved: 'aprovou', changes: 'pediu ajuste' }
const SHARE_STATE = { none: 'sem link', waiting: 'esperando a resposta do cliente', approved: 'APROVADA', changes: 'AJUSTE PEDIDO' }
const LOCAL_WARNING = 'aviso: o app está em localhost, então os links só abrem neste computador. Para o cliente abrir, o app precisa estar publicado (VITE_PUBLIC_APP_URL).'

/** Valor de uma opção que precisa de texto (`--slug=` limpa). */
const textFlag = (name) => {
  // one() descarta a opção sem valor; aqui ela é erro
  if ([].concat(flags[name] ?? []).includes(true)) fail(`Diga o valor de --${name} (ou --${name}= para deixar vazio)`)
  return one(flags[name])
}

async function cmdBrief() {
  await readyStatus()
  const file = one(flags.file)
  if (file && !existsSync(file)) fail(`Arquivo não encontrado: ${file}`)
  const context = file ? readFileSync(file, 'utf8') : textFlag('set')
  const result = await call('brief', context === undefined ? {} : { context })
  if (flags.json) return console.log(JSON.stringify(result, null, 2))
  if (context !== undefined) console.log(`✔ Briefing de ${result.name} gravado (${result.context.length} caracteres).\n`)
  console.log(result.context.trim() || `${result.name} ainda não tem briefing. Grave com: brief --set "<texto>" ou brief --file <arquivo>`)
}

function printShares(result) {
  for (const s of result.pages) {
    if (!s.link) {
      console.log(`▸ ${s.page}: sem link de aprovação (crie com: approval send --page "${s.page}")`)
      continue
    }
    console.log(`▸ ${s.page}: ${SHARE_STATE[s.state] ?? s.state} · versão ${s.version}, mandada em ${when(s.sharedAt)}`)
    console.log(`   ${s.link}`)
    if (s.outdated) console.log('   a página mudou depois dessa versão: o cliente ainda vê a anterior (approval send para mandar a de agora)')
    for (const r of s.responses) {
      const current = r.version === s.version
      console.log(`   ${current ? '•' : '◦'} v${r.version}: ${r.name?.trim() || 'Cliente'} ${DECISION[r.decision] ?? r.decision} em ${when(r.createdAt)}${r.note?.trim() ? ` — "${r.note.trim()}"` : ''}${current ? '' : ' (versão anterior)'}`)
    }
  }
  if (result.local) console.log(`\n${LOCAL_WARNING}`)
}

async function cmdApproval() {
  const status = await readyStatus()
  const action = positional[0]
  if (action && !['send', 'revoke'].includes(action)) fail(`Ação desconhecida: ${action}. Use approval, approval send ou approval revoke`)
  const pageRef = one(flags.page)
  if (action && !pageRef) fail(`Diga a página: approval ${action} --page <nome>`)
  const page = pageRef ? resolvePage(status, pageRef) : undefined

  if (action) {
    const result = await call('approval', { action, page: page.id, note: one(flags.label) })
    if (flags.json) return console.log(JSON.stringify(result, null, 2))
    const share = result.pages[0]
    console.log(action === 'send' ? `✔ ${share.page} mandada para aprovação (versão ${share.version}). Link do cliente:\n${share.link}` : `✔ Link de aprovação de ${page.name} desativado.`)
    if (result.local) console.log(`\n${LOCAL_WARNING}`)
    return
  }

  const wait = flags.wait === true ? true : one(flags.wait)
  if (wait === undefined) {
    const result = await call('approval', { page: page?.id })
    if (flags.json) return console.log(JSON.stringify(result, null, 2))
    return printShares(result)
  }

  // Espera o cliente responder à versão que está no link
  if (!page) fail('Diga a página para esperar: approval --page <nome> --wait <minutos>')
  const minutes = wait === true ? 30 : Number(wait)
  if (!(minutes > 0)) fail('--wait é em minutos, por exemplo --wait 30')
  const until = Date.now() + minutes * 60_000
  let announced = false
  for (;;) {
    const result = await call('approval', { page: page.id })
    const share = result.pages[0]
    if (!share.link) fail(`${page.name} não tem link de aprovação. Mande com: approval send --page "${page.name}"`)
    const answer = share.responses.find((r) => r.version === share.version)
    if (answer) {
      if (flags.json) return console.log(JSON.stringify(result, null, 2))
      return printShares(result)
    }
    if (Date.now() >= until) {
      console.error(`O cliente não respondeu à versão ${share.version} de ${page.name} em ${minutes} min. Link: ${share.link}`)
      quit(2)
    }
    if (!announced) {
      console.log(`Esperando o cliente responder à versão ${share.version} de ${page.name} (até ${minutes} min, conferindo a cada 20 s)…`)
      announced = true
    }
    await new Promise((r) => setTimeout(r, 20_000))
  }
}

async function cmdInvite() {
  await readyStatus()
  // Sem ação, só lista: criar um convite é sempre pedido com "create"
  const action = positional[0] ?? 'list'
  if (!['list', 'create', 'cancel'].includes(action)) fail(`Ação desconhecida: invite ${action}. Use invite, invite create ou invite cancel <id>`)
  const cancel = positional[1]
  if (action === 'cancel' && !cancel) fail('Diga o id do convite: invite cancel <id> (veja os ids com: invite)')
  const label = textFlag('label')
  const result = await call('invite', { action, label, id: cancel })
  if (flags.json) return console.log(JSON.stringify(result, null, 2))
  if (result.created) {
    console.log(`✔ Convite criado (vale para uma pessoa, até ${when(result.created.expiresAt)}). Quem abrir entra com a própria conta e passa a editar o projeto junto:\n${result.created.url}\n`)
  }
  if (action === 'cancel') console.log(`✔ Convite ${cancel} cancelado.\n`)
  console.log('Pessoas no projeto:')
  for (const p of result.people) console.log(`   ${p.email} · ${p.role === 'owner' ? 'dono' : 'edita junto'} · desde ${when(p.joinedAt)}`)
  if (result.invites.length) {
    console.log('Convites abertos:')
    for (const i of result.invites) console.log(`   ${i.label} · ${i.expiresAt < Date.now() ? 'vencido' : `vale até ${when(i.expiresAt)}`} · ${i.url} · id ${i.id}`)
  }
  if (result.local) console.log(`\n${LOCAL_WARNING}`)
}

const printConnection = (c) => {
  if (!c) return console.log('WordPress: não conectado. Conecte com: wp connect <endereço do site>')
  const can = [c.can.editPages && 'editar páginas', c.can.publishPages && 'publicar', c.can.uploadFiles && 'enviar mídia', c.can.unfilteredHtml && 'HTML sem filtro', c.can.manageOptions && 'configurações'].filter(Boolean)
  console.log(`WordPress: ${c.site} (${c.siteUrl}) · usuário ${c.user} [${c.roles.join(', ') || 'sem papel'}] · pode: ${can.join(', ') || 'nada'} · conferido em ${when(c.checkedAt)}`)
  if (c.can.unfilteredHtml === false) console.log('   aviso: sem HTML sem filtro, o WordPress tira os scripts dos widgets HTML ao gravar (o GSAP das seções não roda).')
}

async function cmdWp() {
  await readyStatus()
  const action = positional[0] ?? 'status'
  if (!['status', 'connect', 'pages', 'import'].includes(action)) fail(`Ação desconhecida: wp ${action}. Use wp, wp connect, wp pages ou wp import`)

  if (action === 'connect') {
    const site = positional[1]
    if (!site) fail('Diga o endereço do site: wp connect <site>')
    const user = textFlag('user')
    const password = textFlag('password')
    if (!!user !== !!password) fail('Para gravar a conexão, passe --user e --password juntos')
    const result = await call('wordpress', { action, site, user, password })
    if (flags.json) return console.log(JSON.stringify(result, null, 2))
    if (result.connection) {
      console.log('✔ Conectado.')
      return printConnection(result.connection)
    }
    console.log(`${result.site} (${result.siteUrl}) aceita conexão. Quem administra o site abre este link logado no WordPress e aprova:\n${result.authorize}\n`)
    console.log('O WordPress mostra uma senha de aplicação. Com ela e o usuário de quem aprovou, grave a conexão:')
    console.log(`   wp connect ${site} --user <login> --password "<senha>"`)
    console.log(`(Também dá para criar a senha à mão no perfil: ${result.profile})`)
    return
  }

  if (action === 'pages') {
    const result = await call('wordpress', { action })
    if (flags.json) return console.log(JSON.stringify(result, null, 2))
    if (result.noElementorData) console.log('aviso: o Elementor do site não mostra o conteúdo das páginas pela API (precisa da versão 3.28 ou mais nova).')
    if (!result.pages.length) return console.log('O site não tem páginas.')
    for (const p of result.pages) console.log(`   ${p.id} · ${p.title} · ${p.status}${p.elementor ? '' : ' · sem Elementor'}${p.canvasPage ? ` · no canvas: ${p.canvasPage}` : ''} · ${p.link}`)
    return
  }

  if (action === 'import') {
    const ids = positional.slice(1).map(Number)
    if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) fail('Diga os ids das páginas do site: wp import <id>… (veja os ids com: wp pages)')
    const result = await call('wordpress', { action, ids })
    if (flags.json) return console.log(JSON.stringify(result, null, 2))
    for (const p of result.imported) console.log(`✔ ${p.page} (post ${p.postId}): ${p.sections} seções no canvas`)
    for (const f of result.failed) console.log(`✖ post ${f.postId}: ${f.error}`)
    if (result.imported.length) console.log(`\nAs seções importadas ficam marcadas [do site]: não recebem a marca do Space. ${result.kit ? 'O Kit do site (cores e fontes globais) veio junto.' : 'O Kit do site não veio: as cores globais podem aparecer diferentes.'}`)
    if (result.failed.length) quit(1)
    return
  }

  const result = await call('wordpress', {})
  if (flags.json) return console.log(JSON.stringify(result, null, 2))
  printConnection(result.connection)
  for (const p of result.pages) {
    const wp = p.wordpress
    console.log(`▸ ${p.page}: ${wp ? `${wp.status === 'publish' ? 'publicada' : wp.status} em ${wp.link ?? wp.siteUrl} (post ${wp.postId}), sincronizada em ${when(wp.syncedAt)}` : 'ainda não está no site'}`)
  }
}

const DETAIL_FLAGS = { title: 'title', slug: 'slug', 'seo-title': 'seoTitle', description: 'description', keyword: 'focusKeyword' }
const DETAIL_NAMES = { title: 'Título', slug: 'Endereço', seoTitle: 'Título SEO', description: 'Meta descrição', focusKeyword: 'Palavra-chave' }

async function cmdDetails() {
  const status = await readyStatus()
  const page = resolvePage(status, one(flags.page))
  const fields = {}
  for (const [flag, key] of Object.entries(DETAIL_FLAGS)) {
    const value = textFlag(flag)
    if (value !== undefined) fields[key] = value
  }
  const result = await call('details', { page: page.id, fields })
  if (flags.json) return console.log(JSON.stringify(result, null, 2))
  if (Object.keys(fields).length) console.log(`✔ Detalhes de ${result.page} gravados.\n`)
  console.log(`▸ ${result.page}`)
  for (const [key, name] of Object.entries(DETAIL_NAMES)) console.log(`   ${name}: ${result.details[key] ?? '(padrão do WordPress)'}`)
  console.log(`   Imagem destacada: ${result.featured ?? 'nenhuma escolhida'}`)
  if (result.wordpress) console.log(`   No site: ${result.wordpress.link} (post ${result.wordpress.postId})`)
}

const LAYOUTS = { canvas: 'elementor_canvas', tema: 'elementor_header_footer' }

async function cmdPublish() {
  const status = await readyStatus()
  if (!flags.page) fail('Diga a página: publish --page <nome> --yes')
  const page = resolvePage(status, one(flags.page))
  const layout = one(flags.layout)
  if (layout !== undefined && !LAYOUTS[layout]) fail('--layout é canvas (tela cheia do Elementor) ou tema (com o cabeçalho e o rodapé do tema)')

  if (!flags.yes) {
    const [wp, approval] = await Promise.all([call('wordpress', {}), call('approval', { page: page.id })])
    if (!wp.connection) fail('O projeto não tem WordPress conectado. Conecte com: wp connect <endereço do site>')
    const linked = page.wordpress && page.wordpress.siteUrl === wp.connection.siteUrl ? page.wordpress : null
    const share = approval.pages[0]
    console.log(`Publicar ${page.name} em ${wp.connection.site} (${wp.connection.siteUrl}), como ${wp.connection.user}:`)
    console.log(`   ${linked ? `atualiza a página que já está no site, ${linked.link} (post ${linked.postId}), com backup da versão de lá` : 'cria uma página nova no site'}`)
    console.log(`   situação: ${flags.live ? 'PUBLICADA, visível para todo mundo' : linked ? `fica como está no site (${linked.status})` : 'rascunho (só quem entra no WordPress vê)'}`)
    console.log(`   layout: ${layout ?? (linked ? 'o que a página já tem no site' : 'canvas')}${flags.overwrite ? ' · passa por cima de mudanças feitas no site' : ''}`)
    console.log(`   aprovação: ${share.link ? `${SHARE_STATE[share.state] ?? share.state} (versão ${share.version}${share.outdated ? ', e a página mudou depois dela' : ''})` : 'sem link de aprovação'}`)
    console.error('\nNada foi publicado. Confirme com o usuário (ou veja o cliente aprovar a versão atual) e rode de novo com --yes.')
    quit(1)
  }

  console.log(`Publicando ${page.name}…`)
  const result = await call('publish', { page: page.id, status: flags.live ? 'publish' : undefined, template: layout && LAYOUTS[layout], overwrite: !!flags.overwrite })
  if (flags.json) return console.log(JSON.stringify(result, null, 2))
  console.log(`✔ ${result.created ? 'Criada' : 'Atualizada'} em ${result.site}: ${result.status === 'publish' ? 'publicada' : result.status === 'draft' ? 'rascunho' : result.status}`)
  console.log(`   Página: ${result.link}`)
  console.log(`   Editar no Elementor: ${result.editUrl}`)
  console.log(`   Imagens enviadas para a mídia do site: ${result.uploaded}`)
  if (result.failedImages.length) console.log(`   ${result.failedImages.length} imagens não subiram e seguem pelo endereço de origem:\n${result.failedImages.map((u) => `      ${u}`).join('\n')}`)
  console.log(`   Cache de CSS do Elementor: ${result.cacheCleared ? 'limpo' : 'não limpou (a página pode aparecer com o estilo antigo até o Elementor regenerar o CSS)'}`)
  console.log(`   Imagem destacada: ${{ saved: 'gravada', unchanged: 'sem mudança', unsupported: 'o tema não usa em páginas', failed: 'não subiu' }[result.featured] ?? result.featured}`)
  console.log(`   SEO: ${result.seo === 'saved' ? 'gravado' : result.seo === 'failed' ? `não gravou (${result.seoError})` : 'sem campos de SEO, ou o site não deixa gravar'}`)
}

async function cmdRestore() {
  const status = await readyStatus()
  if (!flags.page) fail('Diga a página: restore --page <nome> --yes')
  const page = resolvePage(status, one(flags.page))
  if (!page.wordpress) fail(`${page.name} não está ligada a uma página do WordPress`)
  if (!flags.yes) {
    console.log(`Voltar ${page.name} no site (${page.wordpress.link}, post ${page.wordpress.postId}) para o conteúdo que tinha antes da última publicação feita daqui.`)
    console.error('\nNada mudou. Confirme com o usuário e rode de novo com --yes.')
    quit(1)
  }
  const result = await call('restore', { page: page.id })
  if (flags.json) return console.log(JSON.stringify(result, null, 2))
  console.log(`✔ ${result.page} voltou à versão de ${when(result.restoredFrom)} em ${result.site}. Restam ${result.remaining} versões guardadas.${result.cacheCleared ? '' : ' O cache de CSS do Elementor não limpou.'}`)
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

/** Abre o Edge (ou o Chrome) headless, entrega a aba pelo CDP e fecha tudo no fim. */
async function withBrowser(work) {
  const browser = BROWSERS.find((b) => existsSync(b))
  if (!browser) fail('Não achei o Edge nem o Chrome para abrir a página')
  const port = 9400 + Math.floor(Math.random() * 400)
  const profile = mkdtempSync(path.join(os.tmpdir(), 'space-shot-'))
  const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', 'about:blank']
  const child = spawn(browser, args, { stdio: 'ignore' })
  try {
    let targets
    for (let i = 0; i < 50 && !targets; i++) {
      await new Promise((r) => setTimeout(r, 200))
      targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null)
    }
    const page = targets?.find((t) => t.type === 'page')
    if (!page) throw new Error('O navegador headless não abriu')
    const tab = await cdp(page.webSocketDebuggerUrl)
    try {
      return await work(tab)
    } finally {
      tab.close()
    }
  } finally {
    child.kill()
    await new Promise((r) => setTimeout(r, 300))
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
  }
}

const capture = (url, device, outBase) =>
  withBrowser(async (tab) => {
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
    return { files, total }
  })

// ---------- vídeo (relógio virtual + ffmpeg) ----------

const VIDEO = {
  desktop: { width: 1440, height: 900, scale: 1 },
  mobile: { width: 390, height: 844, scale: 2 },
}
const FPS = 30
/** Rolagem: px por segundo, em média, e as pausas no topo (abertura e entrada do hero) e no fim. */
const SCROLL_SPEED = 420
const HOLD_TOP = 2.5
const HOLD_END = 1.5
/** Momentos da folha de conferência, em fração do vídeo. */
const SHEET_AT = [0, 0.15, 0.3, 0.5, 0.75, 0.98]
const smooth = (t) => t * t * (3 - 2 * t)

/** Espera fontes e imagens carregarem (no tempo real; o relógio da página continua no 0). */
const WAIT_ASSETS = `Promise.all([document.fonts.ready, ...[...document.images].map((img) => img.complete ? 0 : new Promise((done) => { img.addEventListener('load', done); img.addEventListener('error', done) }))]).then(() => true)`

/**
 * A página rolando do topo ao fim, com as animações, gravada quadro a quadro.
 * O relógio da página (rAF, timers, animações CSS) só anda quando o gravador
 * manda: cada quadro sai no tempo certo, por mais que a captura demore.
 */
const recordVideo = (url, device, out, { holdTop = HOLD_TOP, speed = SCROLL_SPEED } = {}) =>
  withBrowser(async (tab) => {
    const { width, height, scale } = VIDEO[device]
    await tab.send('Page.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: device === 'mobile' })
    await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(path.join(ROOT, 'scripts/space/vt.js'), 'utf8') })
    const evaluate = async (expression) => (await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
    const loaded = tab.once('Page.loadEventFired')
    await tab.send('Page.navigate', { url })
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 30_000))])
    await Promise.race([evaluate(WAIT_ASSETS), new Promise((r) => setTimeout(r, 20_000))])
    await new Promise((r) => setTimeout(r, 1500))

    const scrollable = await evaluate('Math.max(0, document.documentElement.scrollHeight - innerHeight)')
    const travel = Math.max(3, scrollable / speed)
    const duration = holdTop + (scrollable ? travel : 0) + HOLD_END
    const frames = Math.round(duration * FPS)
    const ff = spawn('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', `scale=${width * scale}:${height * scale}:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-r', String(FPS), '-movflags', '+faststart', '-an', out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] })
    const closed = new Promise((resolve, reject) => {
      ff.on('error', () => reject(new Error('Não achei o ffmpeg (instale com: winget install ffmpeg)')))
      ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`O ffmpeg parou com o código ${code}`))))
    })

    const started = Date.now()
    for (let i = 0; i < frames; i++) {
      const t = i / FPS
      const progress = scrollable ? smooth(Math.min(1, Math.max(0, (t - holdTop) / travel))) : 0
      // Rola, avisa a página, anda o relógio um quadro e espera o navegador desenhar
      const top = Math.round(progress * scrollable)
      await evaluate(`scrollTo({ top: ${top}, behavior: 'instant' }); dispatchEvent(new Event('scroll')); window.__vt.advance(${(t * 1000).toFixed(2)}); window.__vt.realFrame().then(() => true)`)
      const { data } = await tab.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
      if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r))
      if (i % 90 === 0) process.stdout.write(`\r  quadro ${i}/${frames} · ${Math.round((Date.now() - started) / 1000)} s   `)
    }
    ff.stdin.end()
    await closed
    process.stdout.write('\r')
    return { duration, frames }
  })

async function cmdVideo() {
  const status = await readyStatus()
  const { url, token } = bridge()
  const page = resolvePage(status, one(flags.page))
  const deviceFlag = one(flags.device) ?? 'desktop'
  const devices = deviceFlag === 'all' ? ['desktop', 'mobile'] : [deviceFlag]
  for (const d of devices) if (!VIDEO[d]) fail(`Tela desconhecida para vídeo: ${d} (desktop, mobile ou all)`)
  const dir = path.join(projectDir(status.project), 'videos')
  mkdirSync(dir, { recursive: true })
  for (const device of devices) {
    const query = new URLSearchParams({ token, device, motion: 'play', page: page.id })
    if (flags.tab) query.set('tab', one(flags.tab))
    else if (target) query.set('project', target.id)
    const out = path.resolve(devices.length === 1 && one(flags.out) ? one(flags.out) : path.join(dir, `${slug(page.name)}-${device}.mp4`))
    console.log(`Gravando ${page.name} (${device})…`)
    const holdTop = flags.pause !== undefined ? Number(one(flags.pause)) : undefined
    const speed = flags.speed !== undefined ? Number(one(flags.speed)) : undefined
    if ((holdTop !== undefined && !(holdTop >= 0)) || (speed !== undefined && !(speed > 0))) fail('--pause é em segundos (0 ou mais) e --speed em px por segundo')
    const { duration, frames } = await recordVideo(`${url}/__space/render?${query}`, device, out, { holdTop, speed })
    const sheet = out.replace(/\.mp4$/i, '') + '-quadros.png'
    await contactSheet(out, frames, sheet)
    const size = (statSync(out).size / 1024 / 1024).toFixed(1)
    console.log(`✔ ${device}: ${rel(out)} (${duration.toFixed(1)} s, ${size} MB) · conferência: ${rel(sheet)}`)
  }
}

/** Seis quadros do vídeo numa imagem só, para conferir abertura, meio e fim sem assistir. */
function contactSheet(video, frames, out) {
  const picks = SHEET_AT.map((f) => `eq(n\\,${Math.min(frames - 1, Math.round(f * (frames - 1)))})`).join('+')
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', `select='${picks}',scale=480:-2,tile=3x2:padding=6:color=white`, '-frames:v', '1', '-fps_mode', 'passthrough', out], { stdio: 'inherit' })
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`A folha de quadros falhou (ffmpeg ${code})`))))
  })
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
    else if (target) query.set('project', target.id)
    const { files, total } = await capture(`${url}/__space/render?${query}`, device, path.join(dir, `${name}-${device}`))
    console.log(`✔ ${device} (${total}px de altura): ${files.map(rel).join(', ')}`)
  }
}

// ---------- entrada ----------

const COMMANDS = {
  status: cmdStatus,
  projects: cmdProjects,
  open: cmdOpen,
  new: cmdNew,
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
  brand: cmdBrand,
  focus: cmdFocus,
  brief: cmdBrief,
  approval: cmdApproval,
  invite: cmdInvite,
  wp: cmdWp,
  details: cmdDetails,
  publish: cmdPublish,
  restore: cmdRestore,
  shot: cmdShot,
  agents: cmdAgents,
  close: cmdClose,
  video: cmdVideo,
}

if (!command || command === 'help' || flags.help) {
  console.log(HELP)
} else if (!COMMANDS[command]) {
  console.error(`✖ Comando desconhecido: ${command}\n\n${HELP}`)
  process.exitCode = 1
} else {
  // Comandos da conta não precisam de projeto; os outros vão para o projeto da sessão
  const needsProject = !['projects', 'agents', 'open', 'new', 'build'].includes(command)
  ;(needsProject ? resolveTarget() : Promise.resolve()).then(() => COMMANDS[command]()).catch((error) => {
    if (!(error instanceof Exit)) console.error(`✖ ${error?.message ?? String(error)}`)
    process.exitCode = error instanceof Exit ? error.code : 1
    // Algo ainda aberto (navegador, socket) não segura o processo
    setTimeout(() => process.exit(process.exitCode), 100).unref()
  })
}
