import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import type { PlanRequest } from '../../src/features/criativos/plan.ts'
import { planPosts } from './plan.ts'

/**
 * Só no servidor de desenvolvimento, na mesma origem do app:
 *   POST /__criativos/plano   PlanRequest → { posts } (Claude Code desta máquina, `plan.ts`)
 *   GET  /__criativos/status  → { ia: true }; o app usa para saber se a IA está disponível
 */

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

const readJson = (req: IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > 200_000) reject(new Error('Pedido grande demais'))
      else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Pedido inválido'))
      }
    })
    req.on('error', reject)
  })

const sameOrigin = (req: IncomingMessage) => {
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return false
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

const FORMATS = ['4x5', '1x1', '9x16']

export const criativos = (): Plugin => ({
  name: 'superelements-criativos',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__criativos', (req, res) => {
      const route = new URL(req.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/'
      void (async () => {
        if (!sameOrigin(req)) return send(res, 403, { error: 'Só o app pode pedir isto' })
        if (route === '/status' && req.method === 'GET') return send(res, 200, { ia: true })
        if (route === '/plano' && req.method === 'POST') {
          const body = (await readJson(req)) as Partial<PlanRequest>
          const input: PlanRequest = {
            brief: String(body.brief ?? '').slice(0, 3000),
            format: FORMATS.includes(String(body.format)) ? (body.format as PlanRequest['format']) : '4x5',
            slides: Math.min(10, Math.max(1, Number(body.slides) || 5)),
            posts: Math.min(4, Math.max(1, Number(body.posts) || 1)),
            cases: Array.isArray(body.cases) ? body.cases.slice(0, 12) : [],
          }
          const controller = new AbortController()
          res.on('close', () => {
            if (!res.writableFinished) controller.abort()
          })
          try {
            return send(res, 200, await planPosts(input, controller.signal))
          } catch (error) {
            if (controller.signal.aborted) return res.end()
            return send(res, 422, { error: error instanceof Error ? error.message : String(error) })
          }
        }
        return send(res, 404, { error: 'Não existe' })
      })().catch((error) => send(res, 500, { error: error instanceof Error ? error.message : String(error) }))
    })
  },
})
