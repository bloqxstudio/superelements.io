import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
 * O endereço e a chave ficam em `.space/bridge.json`. Sem a chave no
 * cabeçalho (ou em `?token=` na foto da página), a ponte recusa: outro site
 * aberto no navegador não consegue chamar o localhost por ela.
 */

/** Como a aba se descreve; vem do `src/features/space/bridge/client.ts`. */
interface TabInfo {
  tabId: string
  url: string
  projectId?: string
  projectName?: string
  /** O canvas do projeto já abriu com o conteúdo da conta. */
  ready: boolean
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

interface Pending {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/** A aba manda sinal de vida a cada 10 s; sem sinal por mais que isso, saiu. */
const STALE_AFTER = 25_000
const CALL_TIMEOUT = 30_000
const STATE_FILE = '.space/bridge.json'

const isOpen = (client: WebSocketClient) => (client.socket as { readyState?: number }).readyState === 1

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

export function spaceBridge(): Plugin {
  return {
    name: 'space-bridge',
    apply: 'serve',
    configureServer(server) {
      const token = randomBytes(18).toString('hex')
      const tabs = new Map<string, Tab>()
      const pending = new Map<string, Pending>()
      const stateFile = path.resolve(server.config.root, STATE_FILE)

      const register = (info: TabInfo, client: WebSocketClient) => {
        if (info?.tabId) tabs.set(info.tabId, { client, info, seenAt: Date.now() })
      }
      server.ws.on('space-bridge:hello', register)
      server.ws.on('space-bridge:state', register)
      server.ws.on('space-bridge:bye', (data: { tabId?: string }) => {
        if (data?.tabId) tabs.delete(data.tabId)
      })
      server.ws.on('space-bridge:reply', (data: { requestId?: string; ok?: boolean; result?: unknown; error?: string }) => {
        const call = data?.requestId ? pending.get(data.requestId) : undefined
        if (!call) return
        pending.delete(data.requestId!)
        clearTimeout(call.timer)
        if (data.ok) call.resolve(data.result)
        else call.reject(new Error(data.error || 'O Space recusou o pedido'))
      })

      const liveTabs = () => {
        const now = Date.now()
        for (const [id, tab] of tabs) if (!isOpen(tab.client) || now - tab.seenAt > STALE_AFTER) tabs.delete(id)
        return [...tabs.values()]
      }

      /** A aba pedida; sem pedido, a que tem projeto aberto e foi usada por último. */
      const pickTab = (tabId?: string) => {
        const live = liveTabs()
        if (tabId) return live.find((t) => t.info.tabId === tabId || t.info.tabId.startsWith(tabId))
        const score = (t: Tab) => (t.info.ready ? 4 : 0) + (t.info.projectId ? 2 : 0) + (t.info.visible ? 1 : 0)
        return live.sort((a, b) => score(b) - score(a) || b.info.activeAt - a.info.activeAt)[0]
      }

      /** `agent`: quem pediu (Claude, Codex…), para o painel do canvas mostrar o nome certo. */
      const call = (tab: Tab, method: string, params: unknown, agent?: string) =>
        new Promise<unknown>((resolve, reject) => {
          const requestId = randomUUID()
          const timer = setTimeout(() => {
            pending.delete(requestId)
            reject(new Error(`O Space não respondeu a "${method}" em ${CALL_TIMEOUT / 1000} s`))
          }, CALL_TIMEOUT)
          pending.set(requestId, { resolve, reject, timer })
          tab.client.send('space-bridge:call', { requestId, method, params, agent })
        })

      server.middlewares.use('/__space', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const given = req.headers['x-space-token'] ?? url.searchParams.get('token')
        if (given !== token) return sendJson(res, 403, { error: 'Chave da ponte errada ou ausente (veja .space/bridge.json)' })

        try {
          if (req.method === 'GET' && url.pathname === '/status') {
            return sendJson(res, 200, { tabs: liveTabs().map((t) => t.info) })
          }

          if (req.method === 'POST' && url.pathname === '/call') {
            const { method, params, tab: tabId, agent } = JSON.parse((await readBody(req)) || '{}')
            const tab = pickTab(tabId)
            if (!tab) return sendJson(res, 409, { error: 'Nenhuma aba do Space conectada. Abra o app no preview ou no navegador.' })
            const result = await call(tab, method, params, typeof agent === 'string' ? agent.slice(0, 24) : undefined)
            return sendJson(res, 200, { tab: tab.info, result })
          }

          // A página (ou seções) montada com a marca, para a foto do Edge headless
          if (req.method === 'GET' && url.pathname === '/render') {
            const tab = pickTab(url.searchParams.get('tab') ?? undefined)
            if (!tab) return sendJson(res, 409, { error: 'Nenhuma aba do Space conectada' })
            const params = {
              page: url.searchParams.get('page') ?? undefined,
              sections: url.searchParams.get('sections')?.split(',').filter(Boolean),
              device: url.searchParams.get('device') ?? 'desktop',
              // Vídeo: com as animações de entrada e as imagens sem carregamento preguiçoso
              motion: url.searchParams.get('motion') === 'play' ? 'play' : 'static',
            }
            const html = (await call(tab, 'render', params)) as string
            res.statusCode = 200
            res.setHeader('content-type', 'text/html; charset=utf-8')
            res.setHeader('cache-control', 'no-store')
            return res.end(html)
          }

          sendJson(res, 404, { error: `Rota desconhecida: ${req.method} ${url.pathname}` })
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      })

      server.httpServer?.on('listening', () => {
        const address = server.httpServer?.address() as AddressInfo | null
        if (!address) return
        mkdirSync(path.dirname(stateFile), { recursive: true })
        const state = { url: `http://localhost:${address.port}`, token, pid: process.pid, startedAt: new Date().toISOString() }
        writeFileSync(stateFile, JSON.stringify(state, null, 2))
      })
      // Ao reiniciar, o servidor novo pode gravar antes de o velho fechar: só apaga o arquivo se ainda for deste
      server.httpServer?.on('close', () => {
        try {
          if (JSON.parse(readFileSync(stateFile, 'utf8')).token === token) rmSync(stateFile, { force: true })
        } catch {
          // Já não existe
        }
      })
    },
  }
}
