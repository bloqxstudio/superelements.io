import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ChildProcess } from 'node:child_process'
import type { Plugin, ViteDevServer } from 'vite'
import { findBin, kill, launch } from '../space/chatPlugin'
import { bridgeAddress } from '../space/vitePlugin'
import { ACTION_LABEL } from './labels'

/**
 * A Iara agente (2026-11-05). O usuário: "a ia está limitada, não conseguimos gerar criativos,
 * fazer coisas avançadas". A aba manda o pedido; aqui o Claude Code desta máquina trabalha em
 * várias etapas: as ações da Iara são ferramentas de um servidor MCP local (`scripts/iara/iara-mcp.mjs`,
 * que fala com a aba pela ponte do Space; as imagens dos slides voltam como imagem), e ele pesquisa
 * na web. Cada passo e o texto final voltam como `iara:event`. Funciona no `npm run dev` e no
 * conector (montado lá também).
 *
 * Sem terminal: a trava de segurança do Claude Code barrava JSON em português passado pelo shell
 * (teste de 2026-11-05). Ferramentas: só as da Iara, WebFetch e WebSearch. A conversa continua pela
 * sessão do Claude Code (`--resume`), guardada pela aba por conta.
 */

const EVENTS = { hello: 'iara:hello', status: 'iara:status', send: 'iara:send', stop: 'iara:stop', event: 'iara:event' } as const
const VERSION = '1'
const TIMEOUT = 20 * 60_000
const MAX_TEXT = 60_000

interface SendPayload {
  id?: string
  text?: string
  system?: string
  resume?: string
  /** `rapida` (padrão): modelo rápido e pouco esforço; `caprichada`: o modelo mais forte, mais esforço. */
  mode?: 'rapida' | 'caprichada'
  /** Imagens que a pessoa anexou nesta mensagem (data URL JPEG/PNG/WebP). */
  images?: string[]
}

const MAX_IMAGES = 6
const IMAGE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/

/**
 * Velocidade (2026-11-05, o usuário: "o agente demora muito pra responder"). A Iara conduz a
 * conversa e chama ações; o trabalho pesado (criativos) vai ao Codex. Então, por padrão, o modelo
 * rápido com pouco esforço (`IARA_MODEL`/`IARA_EFFORT` mudam). Desde 2026-11-10 as ações vêm pelo
 * ToolSearch (uma volta a mais, ~11 mil tokens a menos por chamada): pedido do usuário para cortar tokens.
 */
const MODES = {
  rapida: { model: process.env.IARA_MODEL ?? 'sonnet', effort: process.env.IARA_EFFORT ?? 'low' },
  caprichada: { model: process.env.IARA_MODEL_CAPRICHADA ?? 'opus', effort: 'high' },
} as const


const short = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}…` : s)

function stepOf(name: string, input: Record<string, unknown>): string {
  if (name.startsWith('mcp__iara__')) {
    const action = name.slice('mcp__iara__'.length)
    return ACTION_LABEL[action] ?? `Ação: ${action}`
  }
  if (name === 'Read') return /\.(jpe?g|png|webp)$/i.test(String(input.file_path ?? '')) ? 'Olhando os slides' : 'Lendo um arquivo'
  if (name === 'WebSearch') return `Pesquisando: ${short(String(input.query ?? ''))}`
  if (name === 'WebFetch') {
    try {
      return `Lendo ${new URL(String(input.url)).hostname}`
    } catch {
      return 'Lendo uma página'
    }
  }
  if (name === 'TodoWrite') return 'Planejando os passos'
  if (name === 'ToolSearch') return 'Preparando as ferramentas'
  return name
}

export function iara(): Plugin {
  return {
    name: 'iara',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const root = server.config.root
      const runs = new Map<string, { child: ChildProcess; timer: ReturnType<typeof setTimeout>; stopped: boolean }>()
      const emit = (data: Record<string, unknown>) => server.ws.send(EVENTS.event, data)

      server.ws.on(EVENTS.hello, () => server.ws.send(EVENTS.status, { ok: !!findBin('claude'), version: VERSION }))

      server.ws.on(EVENTS.stop, (data: { id?: string }) => {
        const run = data?.id ? runs.get(data.id) : undefined
        if (!run) return
        run.stopped = true
        kill(run.child)
      })

      server.ws.on(EVENTS.send, (payload: SendPayload) => {
        const id = String(payload?.id ?? '').slice(0, 64) || randomUUID()
        const text = String(payload?.text ?? '').slice(0, MAX_TEXT)
        if (!text.trim() || runs.has(id)) return
        const bin = findBin('claude')
        if (!bin) return emit({ id, type: 'error', text: 'O Claude Code não foi encontrado nesta máquina.' })

        const env: NodeJS.ProcessEnv = { ...process.env, SPACE_AGENT: 'Iara', SPACE_SESSION: `iara-${id}`, NO_COLOR: '1', FORCE_COLOR: '0' }
        const mode = MODES[payload.mode === 'caprichada' ? 'caprichada' : 'rapida']
        const bridge = bridgeAddress()
        if (bridge) Object.assign(env, { SPACE_BRIDGE_URL: bridge.url, SPACE_BRIDGE_TOKEN: bridge.token })
        for (const k of ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'SPACE_PROJECT']) delete env[k]

        const mcp = {
          mcpServers: {
            iara: { command: process.execPath, args: [path.join(root, 'scripts/iara/iara-mcp.mjs')], env: { SPACE_BRIDGE_URL: String(env.SPACE_BRIDGE_URL ?? ''), SPACE_BRIDGE_TOKEN: String(env.SPACE_BRIDGE_TOKEN ?? ''), SPACE_SESSION: String(env.SPACE_SESSION) } },
          },
        }
        // Com imagens, o pedido vai como mensagem stream-json: texto e imagens no mesmo turno
        const images = (Array.isArray(payload.images) ? payload.images : [])
          .map((d) => IMAGE.exec(String(d)))
          .filter((m): m is RegExpExecArray => !!m)
          .slice(0, MAX_IMAGES)
        const resume = typeof payload.resume === 'string' && /^[\w-]{8,80}$/.test(payload.resume) ? payload.resume : undefined
        const args = [
          '-p',
          '--output-format', 'stream-json',
          '--verbose',
          ...(images.length ? ['--input-format', 'stream-json'] : []),
          '--model', mode.model,
          '--effort', mode.effort,
          '--permission-mode', 'acceptEdits',
          '--strict-mcp-config',
          '--mcp-config', JSON.stringify(mcp),
          '--append-system-prompt', String(payload.system ?? '').slice(0, 20_000),
          // Só a web entre as ferramentas do Claude Code (2026-11-10): sem isto vinham as ~30 dele e a lista de skills da máquina.
          // ToolSearch adia as ~70 ações da Iara: entram só as que o agente buscar (antes, ~11 mil tokens em toda chamada).
          '--tools', 'WebFetch,WebSearch,ToolSearch',
          '--allowedTools', 'mcp__iara', 'WebFetch', 'WebSearch', 'TodoWrite',
          '--disallowedTools', 'Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'Task',
          ...(resume ? ['--resume', resume] : []),
        ]

        // Pasta vazia, fora do projeto: na raiz do repositório o Claude Code carregava o CLAUDE.md e o
        // AGENTS.md inteiros a cada mensagem (centenas de KB), o que fazia a Iara demorar para começar.
        const work = path.join(os.tmpdir(), 'sinfy-iara')
        mkdirSync(work, { recursive: true })
        let child: ChildProcess
        try {
          child = launch(bin, args, { cwd: work, env })
        } catch (error) {
          return emit({ id, type: 'error', text: `Não consegui abrir o Claude Code: ${error instanceof Error ? error.message : String(error)}` })
        }
        const run = {
          child,
          stopped: false,
          timer: setTimeout(() => {
            run.stopped = true
            kill(child)
          }, TIMEOUT),
        }
        runs.set(id, run)
        if (images.length) {
          const content = [{ type: 'text', text }, ...images.map((m) => ({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }))]
          child.stdin?.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`)
        } else child.stdin?.end(text)

        let buffer = ''
        let finished = false
        let stderr = ''
        let lastText = ''
        const finish = (data: Record<string, unknown>) => {
          if (finished) return
          finished = true
          clearTimeout(run.timer)
          runs.delete(id)
          emit({ id, ...data })
        }

        child.stdout?.setEncoding('utf8')
        child.stdout?.on('data', (chunk: string) => {
          buffer += chunk
          let nl: number
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line) continue
            let event: { type?: string; subtype?: string; session_id?: string; parent_tool_use_id?: string | null; result?: string; is_error?: boolean; message?: { content?: { type: string; text?: string; name?: string; input?: Record<string, unknown> }[] } }
            try {
              event = JSON.parse(line)
            } catch {
              continue
            }
            if (event.parent_tool_use_id) continue
            if (event.type === 'system' && event.subtype === 'init' && event.session_id) emit({ id, type: 'session', session: event.session_id })
            if (event.type === 'assistant') {
              for (const block of event.message?.content ?? []) {
                if (block.type === 'tool_use' && block.name) emit({ id, type: 'step', text: stepOf(block.name, block.input ?? {}) })
                if (block.type === 'text' && block.text?.trim()) {
                  lastText = block.text.trim()
                  emit({ id, type: 'text', text: lastText })
                }
              }
            }
            if (event.type === 'result') {
              const out = (event.result ?? lastText).trim()
              if (event.is_error) finish({ type: 'error', text: out || 'O Claude Code parou com erro.' })
              else finish({ type: 'done', text: out, session: event.session_id })
            }
          }
        })
        child.stderr?.setEncoding('utf8')
        child.stderr?.on('data', (chunk: string) => {
          stderr = (stderr + chunk).slice(-2000)
        })
        child.on('error', (error) => finish({ type: 'error', text: `O Claude Code falhou: ${error.message}` }))
        child.on('close', () => {
          if (run.stopped) return finish({ type: 'error', text: 'Parei.' })
          finish({ type: 'error', text: stderr.trim().split('\n').filter((l) => l.trim()).slice(-3).join(' ') || 'O Claude Code fechou sem responder.' })
        })
      })
    },
  }
}
