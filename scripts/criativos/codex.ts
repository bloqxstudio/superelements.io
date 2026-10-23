import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findBin, kill, launch } from '../space/chatPlugin.ts'

/**
 * Uma pergunta ao Codex desta máquina (`codex exec`), numa pasta vazia e só com
 * leitura. O Codex não tem o esquema JSON do Claude Code: o pedido manda o
 * formato por escrito e a resposta é lida como JSON (primeiro objeto completo).
 * As imagens vão em arquivos temporários (`--image`).
 */

interface Ask {
  /** Instruções e pedido, num texto só. */
  prompt: string
  /** Imagens (data URL), na ordem. */
  images?: string[]
  timeoutMs?: number
  idleMs?: number
  /** Pesquisa na web (ferramenta de busca do Codex), para pedidos com link. */
  web?: boolean
  signal?: AbortSignal
  onStep?: (step: 'start' | 'thinking' | 'reading' | 'writing') => void
}

/** O primeiro objeto JSON completo de um texto (a resposta pode vir com ``` ou uma frase antes). */
export function extractJson<T>(text: string): T | undefined {
  const start = text.indexOf('{')
  for (let from = start; from >= 0; from = text.indexOf('{', from + 1)) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = from; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
      } else if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) {
        try {
          return JSON.parse(text.slice(from, i + 1)) as T
        } catch {
          break
        }
      }
    }
  }
  return undefined
}

export const askCodex = <T>({ prompt, images = [], timeoutMs = 360_000, idleMs = 90_000, web = false, signal, onStep }: Ask): Promise<T> =>
  new Promise((resolve, reject) => {
    const bin = findBin('codex')
    if (!bin) return reject(new Error('O Codex não foi encontrado nesta máquina (ou diga onde está em SPACE_CODEX_BIN).'))
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'se-criativos-codex-'))
    const files = images.flatMap((data, i) => {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data)
      if (!match) return []
      const file = path.join(cwd, `imagem-${i + 1}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`)
      writeFileSync(file, Buffer.from(match[2], 'base64'))
      return [file]
    })
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
    for (const key of ['CODEX_THREAD_ID', 'CODEX_SESSION_ID']) delete env[key]
    const args = ['exec', '--json', '-s', 'read-only', '--skip-git-repo-check', ...(web ? ['-c', 'web_search="live"'] : []), ...files.map((f) => `--image=${f}`), '-']
    let child: ChildProcess
    try {
      child = launch(bin, args, { cwd, env })
    } catch (error) {
      rmSync(cwd, { recursive: true, force: true })
      return reject(new Error(`Não consegui abrir o Codex: ${error instanceof Error ? error.message : String(error)}`))
    }
    let settled = false
    let buffer = ''
    let stderr = ''
    let message = ''
    let failure: string | undefined
    let lastOutput = Date.now()
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
      if (error) return reject(error)
      const parsed = extractJson<T>(message)
      if (parsed) resolve(parsed)
      else {
        const reason = stderr.split('\n').filter((l) => l.trim() && !/rmcp::|failed to load skill|AuthRequired/.test(l)).slice(-4).join(' ')
        reject(new Error(failure ?? (message ? 'O Codex não devolveu a resposta no formato pedido.' : `O Codex não respondeu.${reason ? ` ${reason.slice(0, 300)}` : ''}`)))
      }
    }
    const abort = () => finish(new DOMException('Parou', 'AbortError'))
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => finish(new Error(`A IA passou de ${Math.round(timeoutMs / 60000)} minutos sem responder.`)), timeoutMs)
    const idle = setInterval(() => {
      if (Date.now() - lastOutput > idleMs) finish(new Error('O Codex parou de responder (sem sinal há mais de 90 s). Tente de novo.'))
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
          const item = event.item ?? {}
          if (event.type === 'thread.started') onStep?.('start')
          else if (event.type === 'turn.started' || (event.type === 'item.started' && item.type === 'reasoning')) onStep?.('thinking')
          else if (item.type === 'web_search') onStep?.('reading')
          else if (event.type === 'item.completed' && item.type === 'agent_message') {
            onStep?.('writing')
            message = String(item.text ?? '')
          } else if (event.type === 'turn.failed') failure = String(event.error?.message ?? 'O Codex parou com erro.').slice(0, 400)
          else if (event.type === 'error') failure = String(event.message ?? 'O Codex parou com erro.').slice(0, 400)
        } catch {
          // linha que não é evento
        }
      }
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000)
    })
    child.on('error', (error) => finish(new Error(`Não consegui abrir o Codex: ${error.message}`)))
    child.on('close', () => finish())
    child.stdin?.on('error', () => {})
    child.stdin?.end(prompt)
  })
