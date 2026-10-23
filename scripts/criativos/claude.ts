import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findBin, kill, launch } from '../space/chatPlugin.ts'
import { extractJson } from './codex.ts'

/**
 * Uma pergunta ao Claude Code desta máquina (o mesmo do chat, sem chave de
 * API): sem ferramentas, numa pasta vazia, respondendo só pelo esquema JSON.
 * O que vem do pedido é material, nunca ordem para quem roda.
 */

export const claudeAvailable = () => !!findBin('claude')

/**
 * No Windows o Claude Code costuma abrir por um `.cmd`, e a linha de comando
 * passa de 8 mil caracteres com o prompt e o esquema como argumentos: o
 * processo morre na hora. Lá (ou com `SE_PROMPT_JSON=1`, para testar em outro
 * sistema), as instruções e o esquema vão no texto da mensagem e a resposta é
 * lida como JSON, com argumentos curtos.
 */
const viaPrompt = () => process.platform === 'win32' || process.env.SE_PROMPT_JSON === '1'

interface Ask {
  system: string
  schema: object
  /** Conteúdo da mensagem: texto e, se houver, imagens (base64). */
  content: unknown[]
  model?: string
  timeoutMs?: number
  maxTurns?: number
  signal?: AbortSignal
  /** O que o Claude Code está fazendo (começou, pensando, escrevendo a resposta). */
  onStep?: (step: 'start' | 'thinking' | 'reading' | 'writing') => void
  /** Lê páginas e pesquisa na web (WebFetch e WebSearch), só leitura: para pedidos que trazem um link. */
  web?: boolean
  /** Esforço de raciocínio do Claude Code: `low` é bem mais rápido e basta para ajustes pequenos. */
  effort?: 'low' | 'medium' | 'high'
  /** Sem nenhuma saída do Claude Code por este tempo, o pedido falha em vez de ficar esperando. */
  idleMs?: number
}

export const askClaude = <T>({ system, schema, content, model = 'sonnet', timeoutMs = 180_000, maxTurns = 2, signal, onStep, effort, idleMs = 90_000, web = false }: Ask): Promise<T> =>
  new Promise((resolve, reject) => {
    const bin = findBin('claude')
    if (!bin) return reject(new Error('O Claude Code não foi encontrado nesta máquina (ou diga onde está em SPACE_CLAUDE_BIN).'))
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'se-criativos-'))
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
    for (const key of ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT']) delete env[key]
    const inPrompt = viaPrompt()
    const args = [
      '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', model, '--strict-mcp-config', '--tools', web ? 'WebFetch,WebSearch' : '', ...(web ? ['--allowedTools', 'WebFetch', 'WebSearch'] : []), '--max-turns', String(web ? Math.max(maxTurns, 10) : maxTurns),
      ...(inPrompt ? ['--system-prompt', 'Responda somente com um objeto JSON válido, sem texto antes ou depois.'] : ['--system-prompt', system, '--json-schema', JSON.stringify(schema)]),
      ...(effort ? ['--effort', effort] : []),
    ]
    let child: ChildProcess
    try {
      child = launch(bin, args, { cwd, env })
    } catch (error) {
      rmSync(cwd, { recursive: true, force: true })
      return reject(new Error(`Não consegui abrir o Claude Code: ${error instanceof Error ? error.message : String(error)}`))
    }
    let settled = false
    let lastOutput = Date.now()
    let buffer = ''
    let stderr = ''
    // Cada evento do Claude Code avisa a tela (ela usa isso como sinal de vida, também nas leituras longas da web)
    const step = (next: 'start' | 'thinking' | 'reading' | 'writing') => onStep?.(next)
    let answer: T | undefined
    let failure: string | undefined
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(idle)
      signal?.removeEventListener('abort', abort)
      kill(child)
      setTimeout(() => {
        try {
          rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
        } catch {
          // fica para a limpeza do sistema
        }
      }, 1000).unref()
      if (error) reject(error)
      else if (answer) resolve(answer)
      else reject(new Error(failure ?? `O Claude Code não respondeu.${stderr.trim() ? ` ${stderr.trim().slice(0, 300)}` : ''}`))
    }
    const abort = () => finish(new DOMException('Parou', 'AbortError'))
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => finish(new Error(`A IA passou de ${Math.round(timeoutMs / 60000)} minutos sem responder.`)), timeoutMs)

    const idle = setInterval(() => {
      if (Date.now() - lastOutput > idleMs) finish(new Error('O Claude Code parou de responder (sem sinal há mais de 90 s). Tente de novo.'))
    }, 5000)
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      lastOutput = Date.now()
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line.startsWith('{')) continue
        try {
          const event = JSON.parse(line)
          if (event.type === 'system') step('start')
          else if (event.type === 'user') step('reading')
          else if (event.type === 'assistant') {
            const blocks = Array.isArray(event.message?.content) ? event.message.content : []
            const reading = blocks.some((b: { type?: string; name?: string }) => b.type === 'tool_use' && /^Web(Fetch|Search)$/.test(b.name ?? ''))
            step(reading ? 'reading' : blocks.some((b: { type?: string }) => b.type === 'tool_use' || b.type === 'text') ? 'writing' : 'thinking')
          }
          if (event.type !== 'result') continue
          if (event.structured_output) answer = event.structured_output as T
          else if (inPrompt && !event.is_error && typeof event.result === 'string' && extractJson<T>(event.result)) answer = extractJson<T>(event.result)
          else failure = event.is_error ? String(event.result ?? 'O Claude Code parou com erro.').slice(0, 400) : 'O Claude Code não devolveu a resposta no formato pedido.'
        } catch {
          // linha que não é evento
        }
      }
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-2000)
    })
    child.on('error', (error) => finish(new Error(`Não consegui abrir o Claude Code: ${error.message}`)))
    child.on('close', () => finish())
    // O processo pode morrer antes de ler a mensagem: o erro de escrita não pode derrubar o servidor
    child.stdin?.on('error', () => {})
    const lead = inPrompt ? [{ type: 'text', text: `${system}\n\nResponda somente com um objeto JSON válido (sem texto antes ou depois, sem \`\`\`) que siga este JSON Schema:\n${JSON.stringify(schema)}\n\n---\n` }] : []
    child.stdin?.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content: [...lead, ...content] } })}\n`)
  })

/** Bloco de imagem para a mensagem, a partir de uma data URL. */
export const imageBlock = (dataUrl: string | undefined) => {
  const match = dataUrl && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  return match ? [{ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }] : []
}
