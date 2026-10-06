import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Plugin, ViteDevServer, WebSocketClient } from 'vite'
import {
  CHAT_AGENTS,
  CHAT_AGENT_IDS,
  CHAT_EVENTS,
  chatSession,
  type ChatAgentAvailability,
  type ChatAgentId,
  type ChatContext,
  type ChatConversation,
  type ChatCursorHint,
  type ChatMessage,
  type ChatPart,
  type ChatSendPayload,
  type ChatStep,
  type ChatStepKind,
  type CursorMode,
} from '../../src/features/space/chat/protocol'
import { bridgeAddress } from './vitePlugin'

/**
 * Chat do projeto com os agentes, dentro do canvas (só no servidor de dev).
 * A aba manda a mensagem e o que está selecionado; aqui o agente escolhido
 * (Claude Code ou Codex, os dois instalados nesta máquina) roda sem terminal,
 * na raiz do repositório, com a sessão da ponte já ligada ao projeto. Cada
 * linha que ele solta vira texto ou passo no chat, e as ações dele viram o
 * cursor no canvas. As mudanças continuam indo pela ponte
 * (`scripts/space/space.mjs` → `vitePlugin.ts` → a aba), como as de qualquer
 * agente: um passo do Ctrl+Z, salvas pela aba com o login de quem está nela.
 *
 * Este chat só muda o canvas: publicar, voltar versão do site, link de
 * aprovação, convite e conexão do WordPress ficam fora (o Claude Code nem
 * tem permissão para esses comandos; o Codex recebe a regra no pedido).
 */

const CHAT_FILE = '.space/chat.json'
const SESSIONS_DIR = '.space/sessoes'
/** Mensagens guardadas por projeto. */
const KEEP_MESSAGES = 80
const MAX_TEXT = 8000
/** Uma resposta parada há tanto tempo sem sinal do agente é encerrada. */
const RUN_TIMEOUT = 20 * 60_000

/** Comandos da ponte que mexem fora do canvas: o agente do chat não roda. */
const OUTSIDE = ['publish', 'restore', 'approval', 'invite', 'wp', 'new', 'open', 'close']

interface Stored {
  projectId: string
  projectName?: string
  messages: ChatMessage[]
  /** Sobe a cada conversa nova: a sessão da ponte e a do agente recomeçam. */
  epoch: number
  /** Id da conversa do próprio agente (Claude: session_id; Codex: thread_id), para continuar. */
  resume: Partial<Record<ChatAgentId, string>>
  updatedAt: number
}

interface Run {
  projectId: string
  agent: ChatAgentId
  child: ChildProcess
  message: ChatMessage
  session: string
  startedAt: number
  stopped: boolean
  finished: boolean
  stderr: string
  timer: ReturnType<typeof setTimeout>
  /** Claude: o texto da mensagem atual já veio aos pedaços (a mensagem inteira não repete). */
  streamed: Set<string>
  /** Próximo texto começa outro bloco. */
  newBlock: boolean
  /** Passos por id da ferramenta (Claude) ou do item (Codex). */
  steps: Map<string, ChatStep>
}

/** Evento JSON do agente: o formato é dele, então cada campo é lido com cuidado. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentEvent = Record<string, any>

const runKey = (projectId: string, agent: ChatAgentId) => `${projectId}:${agent}`
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const short = (value: string, max = 90) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value)

// ---------- os agentes instalados ----------

const isWindows = process.platform === 'win32'

/** O executável do agente: variável de ambiente, PATH, ou onde o instalador costuma pôr. */
function findBin(id: ChatAgentId): string | undefined {
  const fromEnv = process.env[id === 'claude' ? 'SPACE_CLAUDE_BIN' : 'SPACE_CODEX_BIN']?.trim()
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : undefined
  const names = isWindows ? [`${id}.exe`, `${id}.cmd`] : [id]
  for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const full = path.join(dir, name)
      if (existsSync(full)) return full
    }
  }
  const home = os.homedir()
  const local = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local')
  const roaming = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
  const known =
    id === 'claude'
      ? [path.join(home, '.local', 'bin', isWindows ? 'claude.exe' : 'claude'), path.join(roaming, 'npm', 'claude.cmd')]
      : [path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'), path.join(roaming, 'npm', 'codex.cmd'), '/usr/local/bin/codex', '/opt/homebrew/bin/codex']
  return known.find((file) => existsSync(file))
}

/** `.cmd` no Windows só roda por um shell; os argumentos vão entre aspas. */
function launch(bin: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) {
  if (isWindows && bin.toLowerCase().endsWith('.cmd')) {
    const quoted = [bin, ...args].map((a) => `"${a.replaceAll('"', '\\"')}"`).join(' ')
    return spawn(quoted, { ...options, shell: true, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  }
  return spawn(bin, args, { ...options, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
}

const versionOf = (bin: string) =>
  new Promise<string | undefined>((resolve) => {
    execFile(bin, ['--version'], { timeout: 8000, windowsHide: true, shell: isWindows && bin.toLowerCase().endsWith('.cmd') }, (error, stdout) =>
      resolve(error ? undefined : stdout.toString().trim().split('\n')[0])
    )
  })

/** Encerra o agente e o que ele abriu (no Windows, a árvore inteira). */
function kill(child: ChildProcess) {
  if (child.exitCode !== null || !child.pid) return
  if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  else child.kill('SIGTERM')
}

let checking: Promise<ChatAgentAvailability[]> | null = null

/** Quais agentes estão instalados e respondem (vale para o servidor todo; o conector mostra no terminal). */
export const checkAgents = () =>
  (checking ??= Promise.all(
    CHAT_AGENT_IDS.map(async (id): Promise<ChatAgentAvailability> => {
      const bin = findBin(id)
      if (!bin) return { id, available: false, reason: `${CHAT_AGENTS[id].name} não foi encontrado nesta máquina` }
      const version = await versionOf(bin)
      return version ? { id, available: true, version } : { id, available: false, reason: `${CHAT_AGENTS[id].name} não respondeu (${bin})` }
    })
  ))

// ---------- o pedido ----------

const ordinal = (n: number) => `${n}ª`

function contextLines(context: ChatContext) {
  const lines: string[] = []
  if (context.pageName) lines.push(`- Página: ${context.pageName}${context.pageId ? ` (id ${context.pageId})` : ''}`)
  for (const s of context.sections) lines.push(`- Seção: "${s.title}" (id ${s.id}${s.index !== undefined ? `, ${ordinal(s.index + 1)} da página` : ''})`)
  const el = context.element
  if (el) {
    const owner = context.sections.find((s) => s.id === el.sectionId)
    lines.push(`- Camada: ${el.kind}${el.text ? ` "${short(el.text, 120)}"` : ''} (elemento ${el.elementId}, na seção ${owner ? `"${owner.title}"` : el.sectionId})`)
  }
  if (!context.sections.length && !el) lines.push('- Nada selecionado: vale a página acima.')
  return lines
}

/** Primeira mensagem de uma conversa: quem ele é, onde está e como trabalhar. */
/** Onde o agente acha as regras do projeto: no repo, a skill e o AGENTS.md; no conector, o AGENTS.md da pasta dele. */
const REPO_GUIDE =
  '- Siga a skill do cliente (`.claude/skills/cliente/SKILL.md`) e as regras do projeto na seção dele no `AGENTS.md` (procure pelo nome do projeto; o arquivo é grande, leia só a seção).'

function preamble(projectId: string, projectName: string | undefined, agent: ChatAgentId, guide: string) {
  const name = CHAT_AGENTS[agent].name
  return [
    `Você é o ${name}, trabalhando no projeto "${projectName ?? projectId}" do Space (id ${projectId}) pelo chat que fica dentro do canvas. Quem pediu está olhando o canvas agora: vê o seu cursor e cada mudança na hora.`,
    '',
    'Como trabalhar:',
    '- Tudo passa pela ponte: `node scripts/space/space.mjs <comando>`, rodado da raiz do repositório, sempre nessa forma. Esta sessão já está ligada ao projeto: não use `open`, `new` nem `close`.',
    guide,
    '- Trabalhe só no que está selecionado (abaixo). Não varra o site: leia só a página da seleção (`pull --page <id da página>`) e mude só as seções e camadas citadas, a não ser que o pedido diga outra coisa.',
    '- Mostre onde está: antes de mexer, `node scripts/space/space.mjs work "<o que está fazendo>" --section <id da seção>` (com `--element <id>` quando for uma camada). Grave cada mudança com `push <arquivo> --label "<o que mudou>"`. Ao terminar, `work --done`.',
    '- Fora deste chat: publicar, voltar versão do site, link de aprovação, convite e WordPress (`publish`, `restore`, `approval`, `invite`, `wp`). Se o pedido precisar disso, diga e pare.',
    '- Não use `say`: a resposta vai aqui. Responda em português, curto: o que mudou e onde (página › seção). Se a decisão for de quem pediu (texto que muda o posicionamento, tirar conteúdo, duas direções), pergunte antes de mudar.',
  ].join('\n')
}

function promptFor(payload: ChatSendPayload, first: boolean, projectName: string | undefined, guide: string) {
  const parts = [
    first ? preamble(payload.projectId, projectName, payload.agent, guide) : '',
    'Selecionado no canvas agora:',
    ...contextLines(payload.context),
    '',
    `Pedido: ${payload.text}`,
  ]
  return parts.filter((p, i) => p || i > 0).join('\n').trim()
}

// ---------- o que o agente fez, em português ----------

const quoted = (args: string) => args.match(/"([^"]+)"|'([^']+)'/)?.slice(1).find(Boolean)
const flagValue = (args: string, flag: string) => args.match(new RegExp(`--${flag}[ =](?:"([^"]+)"|'([^']+)'|(\\S+))`))?.slice(1).find(Boolean)

/** O comando da ponte dentro do que rodou (o Codex embrulha num `powershell -Command '…'`). */
function bridgeCommand(command: string) {
  const inner = command.match(/-Command\s+(['"])([\s\S]*)\1\s*$/)?.[2] ?? command
  const m = inner.match(/space\.mjs["']?\s+([a-z][\w-]*)([\s\S]*)$/)
  return m ? { name: m[1], args: m[2].trim(), inner } : { name: null, args: '', inner }
}

function stepFromCommand(command: string): Pick<ChatStep, 'kind' | 'text' | 'detail'> {
  const { name, args, inner } = bridgeCommand(command)
  const detail = short(inner.replace(/\s+/g, ' '), 160)
  if (!name) {
    if (/space\.mjs["']?\s*$/.test(inner)) return { kind: 'read', text: 'Vendo os comandos da ponte', detail }
    // O comando em si diz mais que a descrição, que o agente escreve em inglês
    return { kind: 'run', text: short(inner.replace(/\s+/g, ' '), 80), detail }
  }
  const label = flagValue(args, 'label')
  const map: Record<string, [ChatStepKind, string]> = {
    status: ['canvas', 'Olhando o projeto e a seleção'],
    pull: ['read', 'Lendo a página'],
    push: ['canvas', label ? `Gravando no canvas: ${label}` : 'Gravando no canvas'],
    work: ['canvas', /--done/.test(args) ? 'Terminando' : quoted(args) ?? 'Marcando onde está mexendo'],
    plan: ['canvas', 'Pondo o plano da página no canvas'],
    build: ['run', 'Montando a seção com o builder'],
    shot: ['read', 'Tirando foto para conferir'],
    video: ['read', 'Gravando o vídeo da página'],
    remove: ['canvas', label ?? 'Tirando uma seção'],
    move: ['canvas', label ?? 'Mudando a ordem das seções'],
    'page-add': ['canvas', 'Criando uma página'],
    'page-remove': ['canvas', label ?? 'Tirando uma página'],
    focus: ['canvas', 'Levando o canvas até a seção'],
    brand: ['canvas', 'Olhando a marca do projeto'],
    brief: ['read', 'Lendo o briefing'],
    say: ['note', quoted(args) ?? 'Escrevendo no painel'],
  }
  const [kind, text] = map[name] ?? ['run', `space ${name}`]
  return { kind, text: short(text, 110), detail }
}

/** Seção de um arquivo baixado pelo `pull` (`.space/<projeto>/<página>/03-hero.json`). */
function sectionOfFile(root: string, file: unknown): { id: string; title: string } | null {
  if (typeof file !== 'string' || !/\.space[\\/]/.test(file) || !file.endsWith('.json') || /[\\/]_[^\\/]*$/.test(file)) return null
  try {
    const data = JSON.parse(readFileSync(path.resolve(root, file), 'utf8'))
    return typeof data?.id === 'string' && typeof data.title === 'string' ? { id: data.id, title: data.title } : null
  } catch {
    return null
  }
}

const baseName = (file: unknown) => (typeof file === 'string' ? path.basename(file) : 'arquivo')

function stepFromTool(root: string, name: string, input: Record<string, unknown>): Pick<ChatStep, 'kind' | 'text' | 'detail' | 'sectionId'> {
  if (name === 'Bash' || name === 'PowerShell') return stepFromCommand(String(input.command ?? ''))
  const file = input.file_path ?? input.notebook_path
  const section = sectionOfFile(root, file)
  const detail = typeof file === 'string' ? path.relative(root, path.resolve(root, file)).replaceAll('\\', '/') : undefined
  switch (name) {
    case 'Read':
      return { kind: 'read', text: section ? `Lendo a seção "${section.title}"` : `Lendo ${baseName(file)}`, detail, sectionId: section?.id }
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return { kind: 'edit', text: section ? `Editando a seção "${section.title}"` : `${name === 'Write' ? 'Escrevendo' : 'Editando'} ${baseName(file)}`, detail, sectionId: section?.id }
    case 'Glob':
    case 'Grep':
      return { kind: 'search', text: `Procurando ${short(String(input.pattern ?? ''), 60)}` }
    case 'Skill':
      return { kind: 'note', text: `Seguindo a skill ${String(input.skill ?? input.name ?? '')}`.trim() }
    case 'TodoWrite':
      return { kind: 'note', text: 'Organizando os passos' }
    case 'Task':
    case 'Agent':
      return { kind: 'note', text: clip(input.description, 80) || 'Chamando um ajudante' }
    default:
      return { kind: 'run', text: name }
  }
}

/** O cursor: o que cada passo diz sobre onde o agente está. */
function cursorOf(step: Pick<ChatStep, 'kind' | 'text' | 'sectionId' | 'detail'>): { mode: CursorMode; text: string; sectionId?: string } | null {
  if (step.sectionId) return { mode: step.kind === 'edit' ? 'edit' : 'read', text: step.kind === 'edit' ? 'Editando' : 'Lendo', sectionId: step.sectionId }
  if (step.kind === 'read') return { mode: 'read', text: step.text }
  if (step.kind === 'search') return { mode: 'think', text: 'Procurando' }
  return null
}

// ---------- o plugin ----------

/** `guide`: a linha do pedido que diz onde estão as regras (o conector troca pela pasta dele). */
export function spaceChat({ guide = REPO_GUIDE }: { guide?: string } = {}): Plugin {
  return {
    name: 'space-chat',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const root = server.config.root
      const chatFile = path.resolve(root, CHAT_FILE)
      const conversations = new Map<string, Stored>()
      const runs = new Map<string, Run>()

      try {
        const saved = JSON.parse(readFileSync(chatFile, 'utf8')) as Stored[]
        for (const item of saved) {
          // Resposta que estava chegando quando o servidor caiu não vai terminar
          for (const message of item.messages) if (message.streaming) Object.assign(message, { streaming: false, thinking: false, stopped: true })
          conversations.set(item.projectId, item)
        }
      } catch {
        // Primeira vez
      }


      const stored = (projectId: string, projectName?: string) => {
        let item = conversations.get(projectId)
        if (!item) {
          item = { projectId, projectName, messages: [], epoch: Date.now(), resume: {}, updatedAt: Date.now() }
          conversations.set(projectId, item)
        }
        if (projectName) item.projectName = projectName
        return item
      }

      const running = (projectId: string) => CHAT_AGENT_IDS.filter((id) => runs.has(runKey(projectId, id)))

      const view = (item: Stored): ChatConversation => ({
        projectId: item.projectId,
        projectName: item.projectName,
        messages: item.messages,
        running: running(item.projectId),
        updatedAt: item.updatedAt,
        epoch: item.epoch,
      })

      let saveTimer: ReturnType<typeof setTimeout> | undefined
      const save = () => {
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          try {
            mkdirSync(path.dirname(chatFile), { recursive: true })
            writeFileSync(chatFile, JSON.stringify([...conversations.values()], null, 2))
          } catch {
            // Perder uma gravação do histórico não atrapalha a conversa
          }
        }, 800)
      }

      const broadcast = (item: Stored) => {
        item.updatedAt = Date.now()
        server.ws.send(CHAT_EVENTS.state, { projectId: item.projectId, conversation: view(item) })
        save()
      }

      /** Mensagem que mudou: só ela vai para as abas, no máximo umas 15 vezes por segundo. */
      const pendingMessages = new Map<string, { item: Stored; message: ChatMessage }>()
      let flushTimer: ReturnType<typeof setTimeout> | undefined
      const touch = (item: Stored, message: ChatMessage) => {
        pendingMessages.set(message.id, { item, message })
        flushTimer ??= setTimeout(() => {
          flushTimer = undefined
          for (const { item: owner, message: changed } of pendingMessages.values()) {
            owner.updatedAt = Date.now()
            server.ws.send(CHAT_EVENTS.state, { projectId: owner.projectId, message: changed, running: running(owner.projectId), epoch: owner.epoch })
          }
          pendingMessages.clear()
          save()
        }, 70)
      }

      const cursor = (run: Run, hint: Omit<ChatCursorHint, 'projectId' | 'session' | 'agent'>) =>
        server.ws.send(CHAT_EVENTS.cursor, { projectId: run.projectId, session: run.session, agent: CHAT_AGENTS[run.agent].name, ...hint } satisfies ChatCursorHint)

      // ---------- montar a resposta ----------

      const appendText = (run: Run, text: string) => {
        if (!text) return
        const parts = (run.message.parts ??= [])
        const last = parts[parts.length - 1]
        if (last?.type === 'text') last.text += run.newBlock && last.text ? `\n\n${text}` : text
        else parts.push({ type: 'text', text })
        run.newBlock = false
        run.message.thinking = false
      }

      const addStep = (run: Run, key: string, step: Pick<ChatStep, 'kind' | 'text' | 'detail' | 'sectionId'>, state: ChatStep['state'] = 'running') => {
        const existing = run.steps.get(key)
        if (existing) return existing
        const full: ChatStep = { id: key, at: Date.now(), state, ...step }
        run.steps.set(key, full)
        ;(run.message.parts ??= []).push({ type: 'step', step: full } satisfies ChatPart)
        run.newBlock = true
        run.message.thinking = false
        const hint = cursorOf(full)
        if (hint) cursor(run, hint)
        return full
      }

      const finishStep = (run: Run, key: string, ok: boolean) => {
        const step = run.steps.get(key)
        if (step && step.state === 'running') step.state = ok ? 'ok' : 'error'
        run.message.thinking = true
      }

      const item = (run: Run) => conversations.get(run.projectId)!

      // Claude Code: --output-format stream-json --include-partial-messages
      const onClaude = (run: Run, event: AgentEvent) => {
        if (event.parent_tool_use_id) return
        switch (event.type) {
          case 'system':
            if (event.subtype === 'init' && event.session_id) item(run).resume.claude = event.session_id
            return
          case 'stream_event': {
            const e = event.event ?? {}
            if (e.type === 'message_start') run.message.thinking = true
            if (e.type === 'content_block_start') {
              if (e.content_block?.type === 'text') run.newBlock = true
              if (e.content_block?.type === 'thinking') run.message.thinking = true
            }
            if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
              // O texto já veio aos pedaços: a mensagem inteira que vem depois não repete
              run.streamed.add('text')
              appendText(run, e.delta.text)
            }
            return
          }
          case 'assistant': {
            const content = (event.message?.content ?? []) as Array<AgentEvent>
            const sawDeltas = run.streamed.delete('text')
            for (const block of content) {
              if (block.type === 'tool_use') addStep(run, block.id, stepFromTool(root, block.name, block.input ?? {}))
              else if (block.type === 'text' && !sawDeltas) {
                run.newBlock = true
                appendText(run, block.text)
              }
            }
            return
          }
          case 'user':
            for (const block of (event.message?.content ?? []) as Array<AgentEvent>) {
              if (block.type === 'tool_result') finishStep(run, block.tool_use_id, !block.is_error)
            }
            return
          case 'result':
            run.finished = true
            run.message.durationMs = event.duration_ms
            run.message.costUsd = event.total_cost_usd
            if (event.session_id) item(run).resume.claude = event.session_id
            if (event.is_error || (event.subtype && event.subtype !== 'success')) run.message.error = clip(event.result, 600) || `O ${CHAT_AGENTS.claude.name} parou (${event.subtype})`
            return
        }
      }

      // Codex: exec --json
      const onCodex = (run: Run, event: AgentEvent) => {
        const it = event.item ?? {}
        switch (event.type) {
          case 'thread.started':
            if (event.thread_id) item(run).resume.codex = event.thread_id
            return
          case 'turn.started':
            run.message.thinking = true
            return
          case 'item.started':
            if (it.type === 'command_execution') addStep(run, it.id, stepFromCommand(String(it.command ?? '')))
            else if (it.type === 'reasoning') run.message.thinking = true
            return
          case 'item.completed':
            if (it.type === 'agent_message') {
              run.newBlock = true
              appendText(run, String(it.text ?? ''))
            } else if (it.type === 'command_execution') {
              addStep(run, it.id, stepFromCommand(String(it.command ?? '')))
              finishStep(run, it.id, it.exit_code === 0 || (it.exit_code == null && it.status === 'completed'))
            } else if (it.type === 'file_change') {
              const changes = (it.changes ?? []) as Array<{ path?: string }>
              const sections = changes.map((c) => sectionOfFile(root, c.path)).filter(Boolean) as Array<{ id: string; title: string }>
              const text = sections.length ? `Editando a seção "${sections[0].title}"` : `Editando ${changes.map((c) => baseName(c.path)).join(', ') || 'arquivos'}`
              addStep(run, it.id, { kind: 'edit', text: short(text, 110), detail: changes.map((c) => c.path).join(', '), sectionId: sections[0]?.id }, it.status === 'failed' ? 'error' : 'ok')
            } else if (it.type === 'mcp_tool_call' || it.type === 'web_search') {
              addStep(run, it.id, { kind: 'run', text: it.type === 'web_search' ? `Pesquisando ${clip(it.query, 60)}` : `${it.server ?? ''} ${it.tool ?? ''}`.trim() }, 'ok')
            } else if (it.type === 'error') run.message.error = clip(it.message, 600)
            return
          case 'turn.completed':
            run.finished = true
            return
          case 'turn.failed':
            run.finished = true
            run.message.error = clip(event.error?.message, 600) || 'O Codex parou com erro'
            return
          case 'error':
            run.message.error = clip(event.message, 600)
            return
        }
      }

      // ---------- rodar ----------

      const start = async (payload: ChatSendPayload) => {
        const text = clip(payload.text, MAX_TEXT)
        if (!payload.projectId || !text || !CHAT_AGENTS[payload.agent]) return
        const conversation = stored(payload.projectId, payload.projectName)
        const key = runKey(payload.projectId, payload.agent)
        const info = CHAT_AGENTS[payload.agent]
        const context: ChatContext = { ...payload.context, sections: payload.context?.sections ?? [] }

        conversation.messages.push({ id: randomUUID(), at: Date.now(), role: 'user', agent: payload.agent, text, context })
        const answer: ChatMessage = { id: randomUUID(), at: Date.now(), role: 'agent', agent: payload.agent, parts: [], streaming: true, thinking: true }
        conversation.messages.push(answer)
        if (conversation.messages.length > KEEP_MESSAGES) conversation.messages = conversation.messages.slice(-KEEP_MESSAGES)

        const fail = (error: string) => {
          Object.assign(answer, { streaming: false, thinking: false, error })
          broadcast(conversation)
        }
        // Login em andamento: o que a pessoa escreve vai para ele (o código que a página de login mostra)
        const pendingLogin = logins.get(key)
        if (pendingLogin && !/^\/login\b/i.test(text)) {
          pendingLogin.stdin?.write(`${text}\n`)
          Object.assign(answer, { streaming: false, thinking: false, parts: [{ type: 'text', text: `Mandei para o login do ${info.name}. Espere a confirmação aqui.` }] })
          return broadcast(conversation)
        }
        if (runs.has(key)) return fail(`O ${info.name} ainda está trabalhando no pedido anterior. Espere ou pare antes.`)
        const bin = findBin(payload.agent)
        if (!bin) return fail(`${info.name} não foi encontrado nesta máquina. Instale, ou diga onde está em ${payload.agent === 'claude' ? 'SPACE_CLAUDE_BIN' : 'SPACE_CODEX_BIN'}.`)
        // "/login" no chat: entra na conta do agente nesta máquina, pelo navegador dela
        if (/^\/login\b/i.test(text)) return login(conversation, answer, key, payload.agent, bin)

        // A sessão da ponte já nasce ligada ao projeto: o agente não precisa de `open`
        const session = chatSession(payload.projectId, payload.agent, conversation.epoch)
        try {
          const sessionsDir = path.resolve(root, SESSIONS_DIR)
          mkdirSync(sessionsDir, { recursive: true })
          const binding = { projectId: payload.projectId, projectName: conversation.projectName, agent: info.name, session, at: new Date().toISOString() }
          writeFileSync(path.join(sessionsDir, `${session.replace(/[^\w.-]/g, '_').slice(0, 100)}.json`), `${JSON.stringify(binding, null, 2)}\n`)
        } catch (error) {
          return fail(`Não consegui ligar a sessão ao projeto: ${error instanceof Error ? error.message : String(error)}`)
        }

        const resume = conversation.resume[payload.agent]
        const prompt = promptFor({ ...payload, text, context }, !resume, conversation.projectName, guide)
        const env: NodeJS.ProcessEnv = { ...process.env, SPACE_SESSION: session, SPACE_AGENT: info.name, NO_COLOR: '1', FORCE_COLOR: '0' }
        // A ponte deste servidor (a da aba que pediu), mesmo que outro servidor de dev tenha gravado o .space/bridge.json
        const bridge = bridgeAddress()
        if (bridge) Object.assign(env, { SPACE_BRIDGE_URL: bridge.url, SPACE_BRIDGE_TOKEN: bridge.token })
        // Sem herdar a sessão de quem iniciou o servidor de dev
        for (const k of ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'SPACE_PROJECT']) delete env[k]

        const space = 'node scripts/space/space.mjs'
        const args =
          payload.agent === 'claude'
            ? [
                '-p',
                '--output-format', 'stream-json',
                '--verbose',
                '--include-partial-messages',
                '--permission-mode', 'acceptEdits',
                '--strict-mcp-config',
                '--allowedTools', `Bash(${space}:*)`, `PowerShell(${space}:*)`, 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Skill', 'TodoWrite',
                '--disallowedTools', ...OUTSIDE.flatMap((cmd) => [`Bash(${space} ${cmd}:*)`, `PowerShell(${space} ${cmd}:*)`]),
                ...(resume ? ['--resume', resume] : []),
              ]
            : [
                // A ponte é um servidor no localhost: o sandbox precisa deixar a rede aberta
                'exec', '--json', '-s', 'workspace-write', '-c', 'sandbox_workspace_write.network_access=true', '--skip-git-repo-check',
                ...(resume ? ['resume', resume, '-'] : ['-']),
              ]

        let child: ChildProcess
        try {
          child = launch(bin, args, { cwd: root, env })
        } catch (error) {
          return fail(`Não consegui abrir o ${info.name}: ${error instanceof Error ? error.message : String(error)}`)
        }

        const run: Run = {
          projectId: payload.projectId,
          agent: payload.agent,
          child,
          message: answer,
          session,
          startedAt: Date.now(),
          stopped: false,
          finished: false,
          stderr: '',
          timer: setTimeout(() => stop(payload.projectId, payload.agent, 'Passou de 20 minutos sem terminar: parei.'), RUN_TIMEOUT),
          streamed: new Set(),
          newBlock: false,
          steps: new Map(),
        }
        runs.set(key, run)
        broadcast(conversation)
        const first = context.element?.sectionId ?? context.sections[0]?.id
        cursor(run, { mode: 'arrive', text: 'Lendo o pedido', sectionId: first, pageId: context.pageId, elementId: context.element?.elementId })

        child.stdin?.on('error', () => {})
        child.stdin?.end(prompt)

        let buffer = ''
        child.stdout?.setEncoding('utf8')
        child.stdout?.on('data', (chunk: string) => {
          buffer += chunk
          let nl: number
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line.startsWith('{')) continue
            try {
              const event = JSON.parse(line)
              if (payload.agent === 'claude') onClaude(run, event)
              else onCodex(run, event)
              touch(conversation, answer)
            } catch {
              // Linha que não é evento
            }
          }
        })
        child.stderr?.setEncoding('utf8')
        child.stderr?.on('data', (chunk: string) => {
          run.stderr = (run.stderr + chunk).slice(-6000)
        })

        const done = (code: number | null, spawnError?: Error) => {
          if (runs.get(key) !== run) return
          runs.delete(key)
          clearTimeout(run.timer)
          for (const step of run.steps.values()) if (step.state === 'running') step.state = run.stopped || code ? 'error' : 'ok'
          answer.streaming = false
          answer.thinking = false
          answer.durationMs ??= Date.now() - run.startedAt
          if (run.stopped) answer.stopped = true
          else if (spawnError) answer.error = `Não consegui abrir o ${info.name}: ${spawnError.message}`
          else if (!run.finished && code) {
            // O Codex enche o stderr com avisos dos servidores MCP; fica a parte que explica
            const reason = run.stderr
              .split('\n')
              .filter((l) => l.trim() && !/rmcp::|failed to load skill|AuthRequired/.test(l))
              .slice(-6)
              .join('\n')
            answer.error ??= reason ? short(reason, 600) : `O ${info.name} saiu com o código ${code}`
          }
          if (!answer.parts?.length && !answer.error && !answer.stopped) answer.error = `O ${info.name} terminou sem resposta`
          broadcast(conversation)
          cursor(run, { mode: 'done', text: answer.error ? 'Parou com erro' : answer.stopped ? 'Parado' : 'Pronto' })
        }
        child.on('error', (error) => done(1, error))
        child.on('close', (code) => done(code))
      }

      /**
       * O login do agente nesta máquina (`claude auth login`, `codex login`): abre o
       * navegador de quem roda o conector para entrar na conta. O que o comando
       * imprime (o endereço, se o navegador não abrir sozinho) aparece na conversa.
       */
      const logins = new Map<string, ChildProcess>()
      const login = (conversation: Stored, answer: ChatMessage, key: string, agent: ChatAgentId, bin: string) => {
        const info = CHAT_AGENTS[agent]
        if (logins.has(key)) {
          Object.assign(answer, { streaming: false, thinking: false, parts: [{ type: 'text', text: `O login do ${info.name} já está aberto: termine no navegador.` }] })
          return broadcast(conversation)
        }
        const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
        for (const k of ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID']) delete env[k]
        let child: ChildProcess
        try {
          child = launch(bin, agent === 'claude' ? ['auth', 'login'] : ['login'], { cwd: root, env })
        } catch (error) {
          Object.assign(answer, { streaming: false, thinking: false, error: `Não consegui abrir o login do ${info.name}: ${error instanceof Error ? error.message : String(error)}` })
          return broadcast(conversation)
        }
        logins.set(key, child)
        const intro = `Abri o login do ${info.name} neste computador: o navegador vai abrir para você entrar na conta.`
        Object.assign(answer, { thinking: false, parts: [{ type: 'text', text: intro }] })
        broadcast(conversation)

        // O que o comando diz, sem as cores do terminal; um endereço vira link na conversa
        let output = ''
        const show = (chunk: string) => {
          output = (output + chunk.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')).slice(-3000)
          const said = output.split('\n').map((l) => l.trim()).filter(Boolean).slice(-8).join('\n')
          answer.parts = [{ type: 'text', text: said ? `${intro}\n\n${said}` : intro }]
          broadcast(conversation)
        }
        child.stdout?.setEncoding('utf8')
        child.stderr?.setEncoding('utf8')
        child.stdout?.on('data', show)
        child.stderr?.on('data', show)
        child.stdin?.on('error', () => {})
        const timer = setTimeout(() => kill(child), 5 * 60_000)
        const finish = (code: number | null, spawnError?: Error) => {
          if (logins.get(key) !== child) return
          logins.delete(key)
          clearTimeout(timer)
          answer.streaming = false
          if (!spawnError && code === 0) {
            answer.parts = [{ type: 'text', text: `Pronto: o ${info.name} entrou na conta neste computador. Pode mandar o pedido de novo.` }]
          } else {
            const tail = output.split('\n').map((l) => l.trim()).filter(Boolean).slice(-4).join('\n')
            answer.error = spawnError ? `Não consegui abrir o login: ${spawnError.message}` : `O login não terminou${code === null ? ' (passou de 5 minutos)' : ` (código ${code})`}.${tail ? ` ${short(tail, 400)}` : ''}`
          }
          broadcast(conversation)
        }
        child.on('error', (error) => finish(1, error))
        child.on('close', (code) => finish(code))
      }

      const stop = (projectId: string, agent: ChatAgentId, note?: string) => {
        const pendingLogin = logins.get(runKey(projectId, agent))
        if (pendingLogin) kill(pendingLogin)
        const run = runs.get(runKey(projectId, agent))
        if (!run) return
        run.stopped = true
        if (note) run.message.error = note
        kill(run.child)
      }

      // ---------- websocket ----------

      server.ws.on(CHAT_EVENTS.hello, async (data: { projectId?: string }, client: WebSocketClient) => {
        const list = await checkAgents()
        const item = data?.projectId ? conversations.get(data.projectId) : undefined
        client.send(CHAT_EVENTS.state, { projectId: data?.projectId, agents: list, conversation: item ? view(item) : null })
      })
      server.ws.on(CHAT_EVENTS.send, (payload: ChatSendPayload) => void start(payload))
      server.ws.on(CHAT_EVENTS.stop, (data: { projectId?: string; agent?: ChatAgentId }) => {
        if (data?.projectId && data.agent) stop(data.projectId, data.agent)
      })
      server.ws.on(CHAT_EVENTS.reset, (data: { projectId?: string }) => {
        const item = data?.projectId ? conversations.get(data.projectId) : undefined
        if (!item) return
        for (const id of CHAT_AGENT_IDS) stop(item.projectId, id)
        // Conversa nova: outra sessão na ponte e no agente
        Object.assign(item, { messages: [], resume: {}, epoch: Date.now() })
        broadcast(item)
      })

      server.httpServer?.on('close', () => {
        for (const run of runs.values()) kill(run.child)
      })
    },
  }
}
