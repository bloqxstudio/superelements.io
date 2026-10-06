import { randomInt, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { Plugin } from 'vite'
import { CHAT_AGENTS } from '../../src/features/space/chat/protocol'
import { checkAgents, spaceChat } from '../space/chatPlugin'
import { spaceBridge } from '../space/vitePlugin'

/**
 * Conector dos agentes: o Superelements aberto no navegador usa o Claude Code
 * e o Codex instalados no computador de quem está nele. Um arquivo só, sem
 * dependências (gerado por `scripts/connector/build.mjs` em
 * `public/conector/conector.mjs`); quem usa baixa pelo chat do canvas e roda
 * `node conector.mjs`.
 *
 * Ele faz o papel do servidor de dev: a mesma ponte (`vitePlugin.ts`) e o
 * mesmo chat (`chatPlugin.ts`), montados num servidor HTTP no 127.0.0.1. O
 * navegador fala com ele por uma conexão de eventos (SSE) e por POST; o
 * agente, pelo `space.mjs`, que vai dentro do conector e é gravado na pasta
 * de trabalho. Só aceita quem tem o código de pareamento que ele mostra no
 * terminal.
 */

declare const __SPACE_CLI__: string
declare const __CONECTOR_VERSION__: string

const DEFAULT_PORT = 47823
const PORT_TRIES = 5
/** Tentativas com código errado antes de parar de aceitar por um tempo. */
const MAX_WRONG = 20
const LOCK_FOR = 10 * 60_000
const MAX_BODY = 60 * 1024 * 1024
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const AGENTS_MD = `# Agentes do Superelements

Pasta do conector do Superelements (ele reescreve este arquivo ao abrir). Aqui o Claude Code ou o Codex trabalham nas páginas de um projeto do Space, o canvas do Superelements, aberto no navegador de quem pediu pelo chat.

## Como trabalhar

- Tudo passa por \`node scripts/space/space.mjs <comando>\`, rodado desta pasta. A sessão já vem ligada ao projeto.
- \`status\`: páginas, seções (com id) e o que está selecionado no canvas.
- \`pull --page <id>\`: grava uma seção por arquivo em \`.space/<projeto>/<página>/\`. Cada arquivo tem \`title\`, \`data\` e \`elements\` (o JSON nativo do Elementor).
- \`work "<o que está fazendo>" --section <id> [--element <id>]\`: mostra no canvas onde você está. \`work --done\` ao terminar.
- Mudar: edite \`elements\` no arquivo (textos e settings), mantendo os ids dos elementos, e grave com \`push <arquivo> --label "<o que mudou>"\`. Cada push é um passo do Ctrl+Z de quem está no canvas.
- Seção nova: um arquivo sem \`id\`, com \`title\`, \`place\` (\`{ "after": "<id da seção>" }\`) e \`elements\`. Parta de uma seção da mesma página, para manter o padrão.
- \`shot --section <id>\`: foto da seção, para conferir antes de entregar.

## Regras

- Mexa só no que foi pedido e selecionado. Não varra o site.
- Nada sai do canvas: não use \`publish\`, \`restore\`, \`approval\`, \`invite\` nem \`wp\`.
- Não invente fatos: preços, números, prêmios e depoimentos só se já estiverem na página.
- Responda em português, curto: o que mudou e onde (página › seção).
`

const GUIDE = '- Siga o `AGENTS.md` desta pasta: como as páginas são feitas e como gravar.'

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

const major = Number(process.versions.node.split('.')[0])
if (major < 18) {
  console.error(`O conector precisa do Node 18 ou mais novo (este é o ${process.versions.node}). Baixe em https://nodejs.org`)
  process.exit(1)
}

// ---------- pasta de trabalho ----------

const folder = path.resolve(arg('pasta') ?? path.join(os.homedir(), 'superelements-agentes'))
const write = (file: string, content: string) => {
  const full = path.join(folder, file)
  mkdirSync(path.dirname(full), { recursive: true })
  writeFileSync(full, content)
}
write('scripts/space/space.mjs', __SPACE_CLI__)
write('AGENTS.md', AGENTS_MD)
// O Claude Code lê o CLAUDE.md; o Codex, o AGENTS.md
write('CLAUDE.md', '@AGENTS.md\n')

/**
 * O código de pareamento. O arquivo baixado pelo app traz o código que a aba
 * criou (`--codigo`): a aba fica esperando e liga sozinha. Sem ele, vale o da
 * última vez, ou um novo para colar no chat.
 */
const stateFile = path.join(folder, '.space', 'conector.json')
const VALID = /^[A-Z2-9]{6}$/
const given = (arg('codigo') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
let code = VALID.test(given) ? given : ''
if (!code) {
  try {
    code = JSON.parse(readFileSync(stateFile, 'utf8')).code ?? ''
  } catch {
    // Primeira vez
  }
}
if (!VALID.test(code)) code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
write('.space/conector.json', `${JSON.stringify({ code, savedAt: new Date().toISOString() }, null, 2)}\n`)

let wrong = 0
let lockedUntil = 0
const normalize = (value: string | null) => (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
function checkCode(given: string | null): 'ok' | 'wrong' | 'locked' {
  if (Date.now() < lockedUntil) return 'locked'
  if (normalize(given) === code) return 'ok'
  // Sem código nenhum (alguém abriu o endereço no navegador) não conta como tentativa
  if (!given) return 'wrong'
  if (++wrong >= MAX_WRONG) {
    wrong = 0
    lockedUntil = Date.now() + LOCK_FOR
    console.warn(`\n  ⚠ ${MAX_WRONG} tentativas com código errado. Parei de aceitar por ${LOCK_FOR / 60_000} minutos.\n`)
  }
  return 'wrong'
}

// ---------- o "servidor de dev" que a ponte e o chat esperam ----------

interface LinkClient {
  id: string
  open: boolean
  socket: { readonly readyState: number }
  send: (event: string, data?: unknown) => void
}
type Handler = (data: unknown, client: LinkClient) => void
type Route = (req: IncomingMessage, res: ServerResponse) => unknown

const handlers = new Map<string, Handler[]>()
const clients = new Map<string, LinkClient>()
const routes: Array<[string, Route]> = []
const httpServer = http.createServer((req, res) => void handle(req, res))

const fakeServer = {
  config: { root: folder },
  ws: {
    on: (event: string, fn: Handler) => handlers.set(event, [...(handlers.get(event) ?? []), fn]),
    send: (event: string, data?: unknown) => {
      for (const client of clients.values()) client.send(event, data)
    },
  },
  middlewares: { use: (prefix: string, fn: Route) => routes.push([prefix, fn]) },
  httpServer,
}
const mount = (plugin: Plugin) => (plugin.configureServer as (server: unknown) => void)(fakeServer)
mount(spaceBridge())
mount(spaceChat({ guide: GUIDE }))

// ---------- HTTP ----------

const cors = (req: IncomingMessage) => ({
  'access-control-allow-origin': req.headers.origin ?? '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  // O navegador pede licença para um site falar com o próprio computador
  'access-control-allow-private-network': 'true',
  vary: 'Origin',
})

const json = (req: IncomingMessage, res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { ...cors(req), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) reject(new Error('Mensagem grande demais'))
      else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  // A ponte do agente (space.mjs): chave própria, e sem CORS, para nenhum site chamar
  for (const [prefix, route] of routes) {
    if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
      req.url = (req.url ?? '/').slice(prefix.length) || '/'
      return route(req, res)
    }
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(req))
    return res.end()
  }

  const access = checkCode(url.searchParams.get('code'))
  if (access !== 'ok') return json(req, res, access === 'locked' ? 429 : 403, { error: access === 'locked' ? 'Muitas tentativas: espere uns minutos' : 'Código errado' })

  if (req.method === 'GET' && url.pathname === '/ping') return json(req, res, 200, { ok: true, version: __CONECTOR_VERSION__, agents: await checkAgents() })

  // O navegador recebe os eventos por aqui (como o websocket do Vite)
  if (req.method === 'GET' && url.pathname === '/link') {
    res.writeHead(200, { ...cors(req), 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' })
    const client: LinkClient = {
      id: randomUUID(),
      open: true,
      socket: {
        get readyState() {
          return client.open ? 1 : 3
        },
      },
      send: (event, data) => client.open && res.write(`data: ${JSON.stringify({ event, data })}\n\n`),
    }
    clients.set(client.id, client)
    if (clients.size === 1) console.log('  ✔ Navegador conectado. Pode usar o chat no canvas.')
    res.write(`data: ${JSON.stringify({ type: 'connected', client: client.id, version: __CONECTOR_VERSION__ })}\n\n`)
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000)
    req.on('close', () => {
      client.open = false
      clearInterval(keepAlive)
      clients.delete(client.id)
      if (!clients.size) console.log('  · O navegador saiu (aba fechada ou recarregando).')
    })
    return
  }

  // ...e manda por aqui
  if (req.method === 'POST' && url.pathname === '/link/send') {
    const client = clients.get(url.searchParams.get('client') ?? '')
    if (!client) return json(req, res, 410, { error: 'Conexão fechada: reconecte' })
    try {
      const { event, data } = JSON.parse(await readBody(req))
      for (const fn of handlers.get(event) ?? []) fn(data, client)
      res.writeHead(204, cors(req))
      return res.end()
    } catch (error) {
      return json(req, res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  json(req, res, 404, { error: 'Rota desconhecida' })
}

// ---------- abrir ----------

const wanted = Number(arg('porta')) || DEFAULT_PORT

function listen(port: number, tries: number) {
  httpServer.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && tries > 1) return listen(port + 1, tries - 1)
    console.error(`Não consegui abrir o conector: ${error.message}`)
    process.exit(1)
  })
  httpServer.listen(port, '127.0.0.1', () => void ready(port))
}

async function ready(port: number) {
  const pairing = port === DEFAULT_PORT ? code : `${code}:${port}`
  const agents = await checkAgents()
  const lines = agents.map((a) => `    ${a.available ? '✔' : '✖'} ${CHAT_AGENTS[a.id].name}${a.available ? ` ${a.version ?? ''}` : ` (${a.reason ?? 'não encontrado'})`}`)
  console.log(
    [
      '',
      '  Superelements · conector dos agentes',
      '',
      `  Código:  ${pairing.slice(0, 3)}-${pairing.slice(3)}`,
      given
        ? '  A aba do Superelements que baixou este arquivo liga sozinha em alguns segundos.'
        : '  Cole no chat do canvas, no navegador. Ele fica guardado: da próxima vez, é só abrir o conector.',
      '',
      '  Agentes nesta máquina:',
      ...lines,
      '',
      `  Pasta de trabalho: ${folder}`,
      '  Deixe esta janela aberta enquanto usa o chat. Ctrl+C fecha.',
      '',
    ].join('\n')
  )
  if (!agents.some((a) => a.available)) console.log('  Nenhum agente encontrado: instale o Claude Code (https://claude.com/claude-code) ou o Codex e abra o conector de novo.\n')
}

const close = () => {
  httpServer.close()
  httpServer.closeAllConnections?.()
  setTimeout(() => process.exit(0), 300)
}
process.on('SIGINT', close)
process.on('SIGTERM', close)

if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
listen(wanted, PORT_TRIES)
