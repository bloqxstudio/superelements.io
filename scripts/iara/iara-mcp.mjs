#!/usr/bin/env node
// Servidor MCP (stdio) das ações da Iara: o Claude Code chama cada ação como ferramenta nativa e
// este servidor repassa à aba do app pela ponte do Space (método `iara`). Sem shell no meio: o JSON
// vai inteiro (acentos, apóstrofos) e as imagens dos slides voltam como imagem para o agente ver.
// Sem dependências: o conector grava este arquivo na pasta dele (scripts/connector/build.mjs).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

function bridge() {
  if (process.env.SPACE_BRIDGE_URL && process.env.SPACE_BRIDGE_TOKEN) return { url: process.env.SPACE_BRIDGE_URL, token: process.env.SPACE_BRIDGE_TOKEN }
  const file = path.resolve('.space/bridge.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  throw new Error('A ponte com o app não está no ar: abra o app no navegador com o conector ligado.')
}

async function call(action, args = {}) {
  const { url, token } = bridge()
  const response = await fetch(`${url}/__space/call`, {
    method: 'POST',
    headers: { 'x-space-token': token, 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'iara', params: { action, args }, agent: 'Iara', session: process.env.SPACE_SESSION ?? 'iara' }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
  return body.result ?? {}
}

/** Campos que chegam como texto JSON (listas, objetos) voltam a ser JSON: o esquema das ferramentas é livre. */
function normalize(args) {
  if (!args || typeof args !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && /^\s*[[{]/.test(v)) {
      try {
        out[k] = JSON.parse(v)
        continue
      } catch {
        // texto comum que começa com colchete
      }
    }
    out[k] = v
  }
  return out
}

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`)
const reply = (id, result) => send({ jsonrpc: '2.0', id, result })
const error = (id, message) => send({ jsonrpc: '2.0', id, error: { code: -32000, message } })

async function handle(msg) {
  const { id, method, params } = msg
  if (id === undefined) return // notificações
  try {
    if (method === 'initialize') {
      return reply(id, { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'iara', version: '1' } })
    }
    if (method === 'ping') return reply(id, {})
    if (method === 'tools/list') {
      const { lista = [] } = await call('__lista')
      return reply(id, {
        tools: lista.map((a) => ({
          name: a.name,
          description: `${a.doc}${a.risky ? ' (A pessoa confirma no chat: vira um botão.)' : ''}`,
          inputSchema: { type: 'object', additionalProperties: true },
        })),
      })
    }
    if (method === 'tools/call') {
      const name = String(params?.name ?? '')
      try {
        const result = await call(name, normalize(params?.arguments))
        const images = Array.isArray(result.imagens) ? result.imagens : []
        delete result.imagens
        const content = [{ type: 'text', text: JSON.stringify(result, null, 1).slice(0, 40_000) }]
        for (const img of images.slice(0, 10)) {
          const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(img?.data ?? ''))
          if (m) content.push({ type: 'image', data: m[2], mimeType: m[1] })
        }
        return reply(id, { content })
      } catch (e) {
        return reply(id, { content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true })
      }
    }
    return error(id, `Método desconhecido: ${method}`)
  } catch (e) {
    return error(id, e instanceof Error ? e.message : String(e))
  }
}

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (line) => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  void handle(msg)
})
