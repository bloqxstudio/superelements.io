import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findBin, kill, launch } from '../space/chatPlugin.ts'

/**
 * Uma pergunta ao Claude Code desta máquina (o mesmo do chat, sem chave de
 * API): sem ferramentas, numa pasta vazia, respondendo só pelo esquema JSON.
 * O que vem do pedido é material, nunca ordem para quem roda.
 */

export const claudeAvailable = () => !!findBin('claude')

interface Ask {
  system: string
  schema: object
  /** Conteúdo da mensagem: texto e, se houver, imagens (base64). */
  content: unknown[]
  model?: string
  timeoutMs?: number
  maxTurns?: number
  signal?: AbortSignal
}

export const askClaude = <T>({ system, schema, content, model = 'sonnet', timeoutMs = 180_000, maxTurns = 2, signal }: Ask): Promise<T> =>
  new Promise((resolve, reject) => {
    const bin = findBin('claude')
    if (!bin) return reject(new Error('O Claude Code não foi encontrado nesta máquina (ou diga onde está em SPACE_CLAUDE_BIN).'))
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'se-criativos-'))
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
    for (const key of ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT']) delete env[key]
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', model, '--strict-mcp-config', '--tools', '', '--max-turns', String(maxTurns), '--system-prompt', system, '--json-schema', JSON.stringify(schema)]
    let child: ChildProcess
    try {
      child = launch(bin, args, { cwd, env })
    } catch (error) {
      rmSync(cwd, { recursive: true, force: true })
      return reject(new Error(`Não consegui abrir o Claude Code: ${error instanceof Error ? error.message : String(error)}`))
    }
    let settled = false
    let buffer = ''
    let stderr = ''
    let answer: T | undefined
    let failure: string | undefined
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
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
          if (event.type !== 'result') continue
          if (event.structured_output) answer = event.structured_output as T
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
    child.stdin?.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`)
  })

/** Bloco de imagem para a mensagem, a partir de uma data URL. */
export const imageBlock = (dataUrl: string | undefined) => {
  const match = dataUrl && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  return match ? [{ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }] : []
}
