import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import type { Plugin, WebSocketClient } from 'vite'

/**
 * Ponte dos agentes (Claude, Codex) com o Space (só no servidor de dev). O Space aberto no
 * navegador se apresenta pelo websocket do Vite; o `scripts/space/space.mjs`
 * chama o Space por HTTP aqui, e a aba responde. Quem lê e grava na conta é
 * sempre a aba, com o login de quem está nela: a ponte não guarda nada.
 *
 * Vários agentes ao mesmo tempo: cada sessão de agente diz em que projeto
 * trabalha, e o pedido vai para quem tem aquele projeto aberto. De preferência
 * a tela de uma pessoa (ela vê o agente no canvas); senão, o projeto aberto em
 * segundo plano, num iframe escondido dentro de uma aba do app (`/agente/:id`),
 * que abre sozinho quando o agente chama e fecha quando ele para. A ponte
 * também guarda o diário de cada agente em cada projeto, para a tela Agentes.
 *
 * O endereço e a chave ficam em `.space/bridge.json`. Sem a chave no
 * cabeçalho (ou em `?token=` na foto da página), a ponte recusa: outro site
 * aberto no navegador não consegue chamar o localhost por ela.
 */

/** Como a aba se descreve; vem do `src/features/space/bridge/client.ts`. */
interface TabInfo {
  tabId: string
  url: string
  /** `worker`: projeto aberto em segundo plano para um agente, dentro da aba `host`. */
  role?: 'tab' | 'worker'
  host?: string
  projectId?: string
  projectName?: string
  /** O canvas do projeto já abriu com o conteúdo da conta. */
  ready: boolean
  /** O projeto não abre (saiu da conta, sem acesso): não adianta esperar. */
  failed?: string
  /** Salvamento na conta: saved, saving, offline ou conflict. */
  sync?: string
  visible: boolean
  focused: boolean
  /** Última vez que a pessoa mexeu nesta aba. */
  activeAt: number
}

interface Tab {
  client: WebSocketClient
  info: TabInfo
  seenAt: number
}

interface Reply {
  result?: unknown
  /** O que a aba escreveu no diário durante o pedido. */
  steps?: AgentStep[]
}

interface Pending {
  tabId: string
  resolve: (reply: Reply) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type StepKind = 'note' | 'change' | 'question' | 'done' | 'error'

interface AgentStep {
  id: string
  at: number
  kind: StepKind
  text: string
  sectionIds?: string[]
}

/** Um agente (uma sessão do Claude ou do Codex) num projeto. */
interface AgentEntry {
  key: string
  session: string
  agent: string
  projectId: string
  projectName?: string
  startedAt: number
  lastAt: number
  /** Trabalhando, esperando uma resposta de quem acompanha, ou terminou. */
  state: 'working' | 'question' | 'done'
  /** O que ele disse que está fazendo agora (`work`). */
  now?: string
  /** Página e seção em que ele mexeu por último, para a prévia. */
  pageId?: string
  sectionId?: string
  /** Sobe a cada mudança no canvas: a prévia da tela Agentes se atualiza. */
  rev: number
  steps: AgentStep[]
}

/** A aba manda sinal de vida a cada 10 s; sem sinal por mais que isso, saiu. */
const STALE_AFTER = 25_000
const CALL_TIMEOUT = 30_000
/** Pedidos que falam com o WordPress ou sobem arquivos: imagens enviadas uma a uma podem levar minutos. */
const LONG_CALLS = new Set(['publish', 'restore', 'wordpress', 'approval', 'invite', 'create'])
const LONG_TIMEOUT = 280_000
/** Abrir um projeto em segundo plano: carregar o app e o conteúdo da conta. */
const OPEN_TIMEOUT = 45_000
/** Projeto em segundo plano sem pedido de agente nem prévia por esse tempo: fecha. */
const IDLE_CLOSE = 6 * 60_000
/** Pedidos que não são sobre um projeto: vão para a tela de uma pessoa. */
const ACCOUNT_CALLS = new Set(['projects', 'create', 'open'])
/** Pedidos que só leem: podem ser repetidos se a aba sumiu no meio. */
const READS = new Set(['status', 'pull', 'render', 'view', 'say', 'work', 'focus'])
/** Falha destes vai para o diário do agente: quem acompanha precisa saber. */
const WRITES = new Set(['apply', 'plan', 'publish', 'restore', 'approval', 'invite', 'wordpress', 'brand', 'brief', 'details'])
const MAX_STEPS = 40
/** O diário guarda agentes de até um dia atrás. */
const KEEP_FOR = 24 * 60 * 60_000
const STATE_FILE = '.space/bridge.json'
const AGENTS_FILE = '.space/agentes.json'

const isOpen = (client: WebSocketClient) => (client.socket as { readyState?: number }).readyState === 1
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

class BridgeError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** O pedido nem chegou a ser feito: dá para mandar de novo. */
    readonly retry = false
  ) {
    super(message)
  }
}

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

/** Endereço e chave da ponte deste servidor (o chat passa para o agente que ele roda). */
let current: { url: string; token: string } | null = null
export const bridgeAddress = () => current

export function spaceBridge(): Plugin {
  return {
    name: 'space-bridge',
    apply: 'serve',
    configureServer(server) {
      const token = randomBytes(18).toString('hex')
      const tabs = new Map<string, Tab>()
      const pending = new Map<string, Pending>()
      const stateFile = path.resolve(server.config.root, STATE_FILE)
      const agentsFile = path.resolve(server.config.root, AGENTS_FILE)
      /** Último pedido de agente (ou prévia) por projeto: o segundo plano fecha quando para. */
      const lastUse = new Map<string, number>()
      /** Projetos em segundo plano que já mandamos fechar. */
      const releasing = new Set<string>()

      // ---------- diário dos agentes ----------

      const agents = new Map<string, AgentEntry>()
      try {
        const saved = JSON.parse(readFileSync(agentsFile, 'utf8')) as AgentEntry[]
        for (const entry of saved) if (Date.now() - entry.lastAt < KEEP_FOR) agents.set(entry.key, entry)
      } catch {
        // Primeira vez, ou arquivo ilegível: começa vazio
      }

      // ---------- abas ----------

      const liveTabs = () => {
        const now = Date.now()
        for (const [id, tab] of tabs) if (!isOpen(tab.client) || now - tab.seenAt > STALE_AFTER) dropTab(id)
        return [...tabs.values()]
      }
      /** Telas de pessoas (não o segundo plano). */
      const people = () => liveTabs().filter((t) => t.info.role !== 'worker')
      const byUse = (a: Tab, b: Tab) => Number(b.info.visible) - Number(a.info.visible) || b.info.activeAt - a.info.activeAt
      const holders = (projectId: string) => liveTabs().filter((t) => t.info.projectId === projectId)

      /** Onde o projeto está aberto agora, para a tela Agentes. */
      const placeOf = (projectId: string) => {
        const open = holders(projectId).filter((t) => t.info.ready)
        const person = open.find((t) => t.info.role !== 'worker')
        const tab = person ?? open[0]
        return { where: tab ? (person ? 'canvas' : 'background') : null, sync: tab?.info.sync ?? null }
      }

      const payload = () => {
        const list = [...agents.values()].sort((a, b) => b.lastAt - a.lastAt)
        return { at: Date.now(), agents: list.map((entry) => ({ ...entry, ...placeOf(entry.projectId) })) }
      }

      let broadcastTimer: ReturnType<typeof setTimeout> | undefined
      let saveTimer: ReturnType<typeof setTimeout> | undefined
      const changed = () => {
        broadcastTimer ??= setTimeout(() => {
          broadcastTimer = undefined
          server.ws.send('space-bridge:agents', payload())
        }, 120)
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          try {
            mkdirSync(path.dirname(agentsFile), { recursive: true })
            writeFileSync(agentsFile, JSON.stringify([...agents.values()], null, 2))
          } catch {
            // O diário é só para acompanhar: perder uma gravação não atrapalha o trabalho
          }
        }, 1000)
      }

      const dropTab = (tabId: string) => {
        const tab = tabs.get(tabId)
        if (!tab) return
        tabs.delete(tabId)
        if (tab.info.role === 'worker' && tab.info.projectId) releasing.delete(tab.info.projectId)
        // Pedido para quem saiu não vai ter resposta
        for (const [requestId, call] of pending) {
          if (call.tabId !== tabId) continue
          pending.delete(requestId)
          clearTimeout(call.timer)
          call.reject(new BridgeError(503, 'A aba que tinha o projeto aberto fechou no meio do pedido', true))
        }
        changed()
      }

      /** Manda a aba que hospeda o projeto em segundo plano fechá-lo (ela salva antes). */
      const release = (projectId: string) => {
        const worker = holders(projectId).find((t) => t.info.role === 'worker')
        if (!worker || releasing.has(projectId)) return
        const host = worker.info.host && tabs.get(worker.info.host)
        if (!host) return
        releasing.add(projectId)
        host.client.send('space-bridge:release', { projectId })
      }

      const register = (info: TabInfo, client: WebSocketClient) => {
        if (!info?.tabId) return
        // Dois servidores de dev no mesmo repo gravam o mesmo arquivo: vale o que tem a tela de uma pessoa
        if (info.role !== 'worker') claim()
        const before = tabs.get(info.tabId)?.info
        tabs.set(info.tabId, { client, info, seenAt: Date.now() })
        if (info.role === 'worker' && info.projectId && !lastUse.has(info.projectId)) lastUse.set(info.projectId, Date.now())
        // Uma pessoa abriu o projeto: o segundo plano dele sai, e os agentes passam a trabalhar na tela dela
        if (info.role !== 'worker' && info.projectId) release(info.projectId)
        if (!before || before.ready !== info.ready || before.projectId !== info.projectId || before.sync !== info.sync) changed()
      }
      server.ws.on('space-bridge:hello', (info: TabInfo, client: WebSocketClient) => {
        register(info, client)
        client.send('space-bridge:agents', payload())
      })
      server.ws.on('space-bridge:state', register)
      server.ws.on('space-bridge:bye', (data: { tabId?: string }) => {
        if (data?.tabId) dropTab(data.tabId)
      })
      server.ws.on('space-bridge:reply', (data: { requestId?: string; ok?: boolean; result?: unknown; steps?: AgentStep[]; error?: string; retry?: boolean }) => {
        const call = data?.requestId ? pending.get(data.requestId) : undefined
        if (!call) return
        pending.delete(data.requestId!)
        clearTimeout(call.timer)
        if (data.ok) call.resolve({ result: data.result, steps: data.steps })
        else call.reject(Object.assign(new BridgeError(500, data.error || 'O Space recusou o pedido', !!data.retry), { steps: data.steps }))
      })
      server.ws.on('space-bridge:dismiss', (data: { key?: string; projectId?: string }) => {
        for (const [key, entry] of agents) if (key === data?.key || (data?.projectId && entry.projectId === data.projectId)) agents.delete(key)
        changed()
      })

      /** A tela pedida (por id); sem pedido, a tela de uma pessoa com projeto aberto, usada por último. */
      const pickTab = (tabId?: string) => {
        if (tabId) return liveTabs().find((t) => t.info.tabId === tabId || t.info.tabId.startsWith(tabId))
        const score = (t: Tab) => (t.info.ready ? 4 : 0) + (t.info.projectId ? 2 : 0) + (t.info.visible ? 1 : 0)
        return people().sort((a, b) => score(b) - score(a) || b.info.activeAt - a.info.activeAt)[0]
      }

      /**
       * Quem atende os pedidos de um projeto: a tela de uma pessoa com ele
       * aberto, senão o segundo plano. Sem nenhum dos dois, pede a uma aba do
       * app para abrir o projeto em segundo plano e espera ficar pronto.
       */
      const executorFor = async (projectId: string, { open = true } = {}) => {
        const deadline = Date.now() + OPEN_TIMEOUT
        let asked = false
        for (;;) {
          const all = holders(projectId)
          const ready = all.filter((t) => t.info.ready && !(t.info.role === 'worker' && releasing.has(projectId)))
          const tab = ready.find((t) => t.info.role !== 'worker') ?? ready[0]
          if (tab) return tab
          const failed = all.find((t) => t.info.failed)
          if (failed && all.every((t) => t.info.failed)) throw new BridgeError(404, failed.info.failed!)
          if (!all.length) {
            if (!open) return undefined
            if (!asked) {
              const host = people().sort(byUse)[0]
              if (!host) throw new BridgeError(409, 'Nenhuma aba do Space conectada. Abra o app no preview ou no navegador.')
              host.client.send('space-bridge:spawn', { projectId })
              asked = true
            }
          }
          if (Date.now() > deadline) throw new BridgeError(504, `O projeto não abriu em ${OPEN_TIMEOUT / 1000} s. Confira o app aberto (login, internet).`)
          await sleep(250)
        }
      }

      /**
       * `agent`: quem pediu (Claude, Codex…), para o painel do canvas mostrar o nome certo;
       * `session`: a sessão dele, para o canvas mostrar um cursor por agente.
       */
      const call = (tab: Tab, method: string, params: unknown, agent?: string, session?: string) =>
        new Promise<Reply>((resolve, reject) => {
          const requestId = randomUUID()
          const timeout = LONG_CALLS.has(method) ? LONG_TIMEOUT : CALL_TIMEOUT
          const timer = setTimeout(() => {
            pending.delete(requestId)
            reject(new BridgeError(504, `O Space não respondeu a "${method}" em ${timeout / 1000} s`))
          }, timeout)
          pending.set(requestId, { tabId: tab.info.tabId, resolve, reject, timer })
          tab.client.send('space-bridge:call', { requestId, method, params, agent, session })
        })

      /** Pedido de um projeto: acha quem atende e, se a aba sumiu antes de fazer, tenta de novo uma vez. */
      const callProject = async (projectId: string, method: string, params: unknown, agent?: string, session?: string) => {
        for (let attempt = 0; ; attempt++) {
          const tab = (await executorFor(projectId))!
          lastUse.set(projectId, Date.now())
          try {
            return { tab, reply: await call(tab, method, params, agent, session) }
          } catch (error) {
            const again = error instanceof BridgeError && error.retry && (READS.has(method) || error.status !== 503)
            if (!again || attempt > 0) throw error
            await sleep(400)
          }
        }
      }

      /** O diário de quem pediu, no projeto em que o pedido rodou. */
      const track = (who: { agent: string; session: string }, tab: Tab, method: string, params: unknown, reply: Reply | undefined, error?: string) => {
        const projectId = tab.info.projectId
        if (!who.session || !projectId || method === 'view' || method === 'render' || ACCOUNT_CALLS.has(method)) return
        const key = `${who.session}:${projectId}`
        const now = Date.now()
        let entry = agents.get(key)
        if (!entry) {
          entry = { key, session: who.session, agent: who.agent, projectId, startedAt: now, lastAt: now, state: 'working', rev: 0, steps: [] }
          agents.set(key, entry)
        }
        entry.agent = who.agent
        entry.projectName = tab.info.projectName ?? entry.projectName
        entry.lastAt = now
        for (const step of reply?.steps ?? []) if (!entry.steps.some((s) => s.id === step.id)) entry.steps.push(step)
        if (error && WRITES.has(method)) entry.steps.push({ id: randomUUID(), at: now, kind: 'error', text: error })

        const p = (params ?? {}) as Record<string, unknown>
        const r = (reply?.result ?? {}) as Record<string, unknown>
        const first = (value: unknown) => (Array.isArray(value) && typeof value[0] === 'string' ? (value[0] as string) : undefined)
        if (!error) {
          switch (method) {
            case 'work':
              if (p.done) entry.now = undefined
              else {
                entry.state = 'working'
                entry.now = text(p.text, 120) || 'Trabalhando'
                entry.pageId = (r.pageId as string) ?? entry.pageId
                entry.sectionId = first(r.sectionIds) ?? entry.sectionId
              }
              break
            case 'say':
              if (p.kind === 'done' || p.kind === 'question') {
                entry.state = p.kind
                entry.now = undefined
              } else entry.state = 'working'
              entry.sectionId = first(r.sectionIds) ?? entry.sectionId
              break
            case 'apply':
              entry.state = 'working'
              entry.rev++
              entry.pageId = first(r.pageIds) ?? entry.pageId
              entry.sectionId = Object.keys((r.touched as object) ?? {})[0] ?? entry.sectionId
              break
            case 'plan':
              entry.state = 'working'
              entry.rev++
              entry.now = 'Construindo a página'
              entry.pageId = (r.pageId as string) ?? entry.pageId
              entry.sectionId = (r.sections as Array<{ id: string }> | undefined)?.[0]?.id ?? entry.sectionId
              break
            case 'pull': {
              const content = r.content as Array<{ id: string }> | undefined
              if (content?.length === 1) entry.pageId = content[0].id
              break
            }
          }
        }
        if (entry.steps.length > MAX_STEPS) entry.steps = entry.steps.slice(-MAX_STEPS)
        changed()
      }

      // Prévia da tela Agentes: a página como o player mostra, pedida pelo navegador
      server.ws.on(
        'space-bridge:view',
        async (data: { requestId?: string; projectId?: string; page?: string; section?: string; open?: boolean }, client: WebSocketClient) => {
          if (!data?.requestId || !data.projectId) return
          try {
            const tab = await executorFor(data.projectId, { open: !!data.open })
            if (!tab) throw new BridgeError(404, 'fechado')
            lastUse.set(data.projectId, Date.now())
            const { result } = await call(tab, 'view', { page: data.page, section: data.section })
            client.send('space-bridge:view-reply', { requestId: data.requestId, ok: true, result })
          } catch (error) {
            client.send('space-bridge:view-reply', { requestId: data.requestId, ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        }
      )

      // Segundo plano sem uso fecha; aba que parou de dar sinal sai da lista
      const sweep = setInterval(() => {
        const now = Date.now()
        for (const tab of liveTabs()) {
          const id = tab.info.projectId
          if (tab.info.role === 'worker' && id && now - (lastUse.get(id) ?? now) > IDLE_CLOSE) release(id)
        }
        for (const [key, entry] of agents) if (now - entry.lastAt > KEEP_FOR) agents.delete(key)
      }, 30_000)
      server.httpServer?.on('close', () => clearInterval(sweep))

      server.middlewares.use('/__space', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const given = req.headers['x-space-token'] ?? url.searchParams.get('token')
        if (given !== token) return sendJson(res, 403, { error: 'Chave da ponte errada ou ausente (veja .space/bridge.json)' })

        try {
          if (req.method === 'GET' && url.pathname === '/status') {
            return sendJson(res, 200, { tabs: liveTabs().map((t) => t.info), agents: payload().agents })
          }

          if (req.method === 'GET' && url.pathname === '/agents') {
            return sendJson(res, 200, payload())
          }

          // O agente terminou: fecha o projeto em segundo plano (salva antes) sem esperar ficar parado
          if (req.method === 'POST' && url.pathname === '/release') {
            const { project } = JSON.parse((await readBody(req)) || '{}')
            const id = String(project ?? '')
            const worker = holders(id).find((t) => t.info.role === 'worker')
            if (!worker) return sendJson(res, 200, { released: false, where: placeOf(id).where })
            release(id)
            const deadline = Date.now() + 25_000
            while (Date.now() < deadline && holders(id).some((t) => t.info.role === 'worker')) await sleep(250)
            return sendJson(res, 200, { released: !holders(id).some((t) => t.info.role === 'worker') })
          }

          if (req.method === 'POST' && url.pathname === '/call') {
            const body = JSON.parse((await readBody(req)) || '{}')
            const { method, params, tab: tabId, project } = body
            const agent = text(body.agent, 24) || undefined
            const who = { agent: agent ?? 'Agente', session: text(body.session, 120) }
            let tab: Tab | undefined
            let reply: Reply
            try {
              if (tabId || !project || ACCOUNT_CALLS.has(method)) {
                // Pedido da conta, ou sem projeto dito: a tela de uma pessoa, como antes
                tab = pickTab(tabId)
                if (!tab) return sendJson(res, 409, { error: 'Nenhuma aba do Space conectada. Abra o app no preview ou no navegador.' })
                if (tab.info.projectId) lastUse.set(tab.info.projectId, Date.now())
                reply = await call(tab, method, params, agent, who.session || undefined)
              } else {
                ;({ tab, reply } = await callProject(String(project), method, params, agent, who.session || undefined))
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              if (tab) track(who, tab, method, params, { steps: (error as { steps?: AgentStep[] }).steps }, message)
              return sendJson(res, error instanceof BridgeError ? error.status : 500, { error: message })
            }
            track(who, tab, method, params, reply)
            return sendJson(res, 200, { tab: tab.info, result: reply.result })
          }

          // A página (ou seções) montada com a marca, para a foto do Edge headless
          if (req.method === 'GET' && url.pathname === '/render') {
            const project = url.searchParams.get('project')
            const params = {
              page: url.searchParams.get('page') ?? undefined,
              sections: url.searchParams.get('sections')?.split(',').filter(Boolean),
              device: url.searchParams.get('device') ?? 'desktop',
              // Vídeo: com as animações de entrada e as imagens sem carregamento preguiçoso
              motion: url.searchParams.get('motion') === 'play' ? 'play' : 'static',
            }
            let html: string
            if (project && !url.searchParams.get('tab')) {
              html = (await callProject(project, 'render', params)).reply.result as string
            } else {
              const tab = pickTab(url.searchParams.get('tab') ?? undefined)
              if (!tab) return sendJson(res, 409, { error: 'Nenhuma aba do Space conectada' })
              html = (await call(tab, 'render', params)).result as string
            }
            res.statusCode = 200
            res.setHeader('content-type', 'text/html; charset=utf-8')
            res.setHeader('cache-control', 'no-store')
            return res.end(html)
          }

          sendJson(res, 404, { error: `Rota desconhecida: ${req.method} ${url.pathname}` })
        } catch (error) {
          sendJson(res, error instanceof BridgeError ? error.status : 500, { error: error instanceof Error ? error.message : String(error) })
        }
      })

      let state: { url: string; token: string; pid: number; startedAt: string } | null = null
      /** Grava o endereço desta ponte em `.space/bridge.json`, se ainda não for ele. */
      function claim() {
        if (!state) return
        try {
          if (JSON.parse(readFileSync(stateFile, 'utf8')).token === token) return
        } catch {
          // Sem arquivo ainda
        }
        mkdirSync(path.dirname(stateFile), { recursive: true })
        writeFileSync(stateFile, JSON.stringify(state, null, 2))
      }
      server.httpServer?.on('listening', () => {
        const address = server.httpServer?.address() as AddressInfo | null
        if (!address) return
        state = { url: `http://localhost:${address.port}`, token, pid: process.pid, startedAt: new Date().toISOString() }
        current = { url: state.url, token }
        claim()
      })
      // Ao reiniciar, o servidor novo pode gravar antes de o velho fechar: só apaga o arquivo se ainda for deste
      server.httpServer?.on('close', () => {
        try {
          if (existsSync(stateFile) && JSON.parse(readFileSync(stateFile, 'utf8')).token === token) rmSync(stateFile, { force: true })
        } catch {
          // Já não existe
        }
      })
    },
  }
}
