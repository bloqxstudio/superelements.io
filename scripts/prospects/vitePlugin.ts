import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'
import { STAGES, type FunnelSettings, type OpportunityPatch, type Stage } from '../../src/features/prospects/funnel.ts'
import type { Lead, SearchEvent, SearchInput } from '../../src/features/prospects/types.ts'
import { deleteSearch, listSearches, readSearch, runSearch, saveSearch } from './engine.ts'
import { addToFunnel, readFunnel, readSettings, removeOpportunity, updateOpportunity, writeSettings } from './funnelStore.ts'

/**
 * Prospecção no servidor de dev: a tela `/prospeccao` pede a busca aqui,
 * porque abrir o site de outras empresas não dá do navegador (CORS). Só
 * atende o próprio app: outro site aberto no navegador não usa este
 * computador para abrir endereços. As buscas ficam em `data/prospeccao`.
 *
 *   GET    /__prospeccao/config       { google }  (tem GOOGLE_PLACES_API_KEY?)
 *   GET    /__prospeccao/buscas       buscas salvas (resumo)
 *   GET    /__prospeccao/buscas/:id   uma busca inteira
 *   DELETE /__prospeccao/buscas/:id
 *   POST   /__prospeccao/buscar       SearchInput → uma linha de JSON por SearchEvent
 *   GET    /__prospeccao/funil        oportunidades do funil
 *   POST   /__prospeccao/funil        { leads, region, searchId?, stage? } põe empresas no funil
 *   PATCH  /__prospeccao/funil/:id    muda etapa, projeto, vídeo, notas e próximo passo
 *   DELETE /__prospeccao/funil/:id
 *   GET|PUT /__prospeccao/funil-config  valor padrão do serviço, do plano mensal e meses no valor
 */

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

const readJson = (req: IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 4_000_000) reject(new Error('Pedido grande demais'))
      else chunks.push(chunk)
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

/** O pedido veio do próprio app (ou de um terminal), não de outro site. */
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

export const prospecting = (): Plugin => {
  let googleKey: string | undefined
  return {
    name: 'superelements-prospeccao',
    apply: 'serve',
    configResolved(config) {
      googleKey = loadEnv(config.mode, config.root, 'GOOGLE_PLACES_').GOOGLE_PLACES_API_KEY || undefined
    },
    configureServer(server) {
      server.middlewares.use('/__prospeccao', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const route = url.pathname.replace(/\/+$/, '') || '/'

        const handle = async () => {
          if (!sameOrigin(req)) return send(res, 403, { error: 'Só o app pode pedir buscas' })

          if (route === '/config' && req.method === 'GET') return send(res, 200, { google: Boolean(googleKey) })
          if (route === '/buscas' && req.method === 'GET') return send(res, 200, await listSearches())

          const one = /^\/buscas\/([\w-]+)$/.exec(route)
          if (one && req.method === 'GET') {
            const record = await readSearch(one[1])
            return record ? send(res, 200, record) : send(res, 404, { error: 'Busca não encontrada' })
          }
          if (one && req.method === 'DELETE') {
            await deleteSearch(one[1])
            return send(res, 200, { ok: true })
          }

          if (route === '/funil' && req.method === 'GET') return send(res, 200, await readFunnel())
          if (route === '/funil-config' && req.method === 'GET') return send(res, 200, await readSettings())
          if (route === '/funil-config' && req.method === 'PUT') {
            const body = (await readJson(req)) as Record<string, unknown>
            const ok = (v: unknown, min: number) => typeof v === 'number' && Number.isFinite(v) && v >= min
            const patch: Partial<FunnelSettings> = {}
            if (ok(body.price, 0)) patch.price = body.price as number
            if (ok(body.monthly, 0)) patch.monthly = body.monthly as number
            if (ok(body.months, 1)) patch.months = Math.round(body.months as number)
            return send(res, 200, await writeSettings(patch))
          }
          if (route === '/funil' && req.method === 'POST') {
            const body = (await readJson(req)) as { leads?: Lead[]; region?: string; searchId?: string; stage?: Stage }
            if (!Array.isArray(body.leads) || !body.region) return send(res, 400, { error: 'Faltam as empresas ou a região' })
            if (body.stage && !STAGES.some((s) => s.id === body.stage)) return send(res, 400, { error: 'Etapa desconhecida' })
            return send(res, 200, await addToFunnel(body.leads.slice(0, 500), { region: body.region, searchId: body.searchId, stage: body.stage }))
          }
          const opportunity = /^\/funil\/(.+)$/.exec(route)
          if (opportunity && req.method === 'PATCH') {
            const patch = (await readJson(req)) as OpportunityPatch
            if (patch.stage && !STAGES.some((s) => s.id === patch.stage)) return send(res, 400, { error: 'Etapa desconhecida' })
            const allowed = ['stage', 'projectName', 'video', 'notes', 'nextStep', 'nextDate', 'offer', 'brief'] as const
            const clean = Object.fromEntries(allowed.filter((k) => k in patch).map((k) => [k, patch[k]])) as OpportunityPatch
            const updated = await updateOpportunity(decodeURIComponent(opportunity[1]), clean)
            return updated ? send(res, 200, updated) : send(res, 404, { error: 'Oportunidade não encontrada' })
          }
          if (opportunity && req.method === 'DELETE') {
            await removeOpportunity(decodeURIComponent(opportunity[1]))
            return send(res, 200, { ok: true })
          }

          if (route === '/buscar' && req.method === 'POST') {
            const input = (await readJson(req)) as SearchInput
            const controller = new AbortController()
            // Fechou a tela no meio: para de abrir sites
            res.on('close', () => {
              if (!res.writableFinished) controller.abort()
            })
            res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' })
            const write = (event: SearchEvent) => {
              if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`)
            }
            try {
              const record = await runSearch(input, {
                googleKey,
                signal: controller.signal,
                onEvent: (event) => {
                  // O "done" sai depois de salvar, para a tela já poder reabrir a busca
                  if (event.type !== 'done') write(event)
                },
              })
              await saveSearch(record)
              write({ type: 'done', record })
            } catch (error) {
              write({ type: 'error', message: error instanceof Error ? error.message : String(error) })
            }
            return res.end()
          }

          send(res, 404, { error: 'Caminho desconhecido' })
        }

        handle().catch((error) => {
          if (res.headersSent) res.end()
          else send(res, 500, { error: error instanceof Error ? error.message : String(error) })
        })
      })
    },
  }
}
