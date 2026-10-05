import type { FunnelSettings, Opportunity, OpportunityPatch, Stage } from './funnel.ts'
import { scoreLead } from './score.ts'
import type { Lead, SearchEvent, SearchInput, SearchRecord, SearchSummary } from './types.ts'

/** O motor roda no servidor de dev (`scripts/prospects/vitePlugin.ts`). */
const BASE = '/__prospeccao'

const json = async <T,>(response: Response): Promise<T> => {
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('json')) throw new Error('A prospecção só roda no app aberto neste computador')
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error ?? `Erro ${response.status}`)
  return body as T
}

/** A nota sempre pela regra atual, mesmo numa busca salva antes de a regra mudar. */
export const rescore = (lead: Lead): Lead => ({ ...lead, ...scoreLead(lead) })

export const byScore = (a: Lead, b: Lead) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR')

/** `null` quando o motor não está no ar (app publicado, sem o servidor de dev). */
export const getConfig = async (): Promise<{ google: boolean } | null> => {
  try {
    return await json<{ google: boolean }>(await fetch(`${BASE}/config`))
  } catch {
    return null
  }
}

export const listSearches = async () => json<SearchSummary[]>(await fetch(`${BASE}/buscas`))

export const getSearch = async (id: string) => {
  const record = await json<SearchRecord>(await fetch(`${BASE}/buscas/${encodeURIComponent(id)}`))
  return { ...record, leads: record.leads.map(rescore).sort(byScore) }
}

export const removeSearch = async (id: string) => json(await fetch(`${BASE}/buscas/${encodeURIComponent(id)}`, { method: 'DELETE' }))

export const getFunnel = async () => json<Opportunity[]>(await fetch(`${BASE}/funil`))

export const addToFunnel = async (leads: Lead[], meta: { region: string; searchId?: string; stage?: Stage }) =>
  json<Opportunity[]>(
    await fetch(`${BASE}/funil`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leads, ...meta }) })
  )

export const updateOpportunity = async (id: string, patch: OpportunityPatch) =>
  json<Opportunity>(
    await fetch(`${BASE}/funil/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
  )

export const removeOpportunity = async (id: string) => json(await fetch(`${BASE}/funil/${encodeURIComponent(id)}`, { method: 'DELETE' }))

export const getFunnelSettings = async () => json<FunnelSettings>(await fetch(`${BASE}/funil-config`))

export const saveFunnelSettings = async (settings: FunnelSettings) =>
  json<FunnelSettings>(
    await fetch(`${BASE}/funil-config`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(settings) })
  )

/** Roda a busca e entrega cada evento assim que chega (uma linha de JSON por evento). */
export const startSearch = async (input: SearchInput, onEvent: (event: SearchEvent) => void, signal?: AbortSignal) => {
  const response = await fetch(`${BASE}/buscar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  if (!response.ok || !response.body) await json(response)
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += value
    let end: number
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).trim()
      buffer = buffer.slice(end + 1)
      if (line) onEvent(JSON.parse(line) as SearchEvent)
    }
  }
}
