import { supabase } from '@/integrations/supabase/client'
import { DEFAULT_SETTINGS, type FunnelSettings, type Opportunity, type OpportunityPatch, type Stage } from './funnel.ts'
import { draftOffer } from './offer.ts'
import { scoreLead } from './score.ts'
import type { Lead, SearchEvent, SearchInput, SearchRecord, SearchSummary } from './types.ts'

/**
 * No dev, o motor Node continua abrindo mapas e sites pelo middleware do Vite.
 * No app publicado, histórico e funil ficam no Supabase; varreduras novas
 * continuam locais porque podem abrir milhares de endereços e durar bem mais
 * do que o limite de uma função serverless.
 */
const BASE = '/__prospeccao'
const remote = !import.meta.hot

export interface ProspectConfig {
  google: boolean
  canSearch: boolean
  remote: boolean
}

const BUCKET = 'space-projects'

const owner = async () => {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Sessão encerrada')
  return data.user.id
}

const pathFor = async (name: string) => `${await owner()}/prospeccao/${name}`

const readCloud = async <T,>(name: string, fallback?: T): Promise<T> => {
  const { data, error } = await supabase.storage.from(BUCKET).download(await pathFor(name))
  if (error) {
    if (fallback !== undefined && /not found|does not exist|404/i.test(error.message)) return fallback
    throw new Error(error.message)
  }
  return JSON.parse(await data.text()) as T
}

const writeCloud = async (name: string, value: unknown) => {
  const body = new Blob([JSON.stringify(value)], { type: 'application/json' })
  const { error } = await supabase.storage.from(BUCKET).upload(await pathFor(name), body, { contentType: 'application/json', upsert: true })
  if (error) throw new Error(error.message)
}

const json = async <T,>(response: Response): Promise<T> => {
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('json')) throw new Error('A prospecção local não está no ar')
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error ?? `Erro ${response.status}`)
  return body as T
}

/** A nota sempre pela regra atual, mesmo numa busca salva antes de a regra mudar. */
export const rescore = (lead: Lead): Lead => ({ ...lead, ...scoreLead(lead) })

export const byScore = (a: Lead, b: Lead) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR')

export const getConfig = async (): Promise<ProspectConfig | null> => {
  if (remote) {
    const { data } = await supabase.auth.getUser()
    return data.user ? { google: false, canSearch: false, remote: true } : null
  }
  try {
    const local = await json<{ google: boolean }>(await fetch(`${BASE}/config`))
    return { ...local, canSearch: true, remote: false }
  } catch {
    return null
  }
}

const summary = ({ id, createdAt, label, input, regionLabel, stats }: SearchRecord): SearchSummary => ({ id, createdAt, label, input, regionLabel, stats })

export const listSearches = async (): Promise<SearchSummary[]> => {
  if (!remote) return json<SearchSummary[]>(await fetch(`${BASE}/buscas`))
  const prefix = await pathFor('searches')
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
  if (error) throw new Error(error.message)
  const records = await Promise.all((data ?? []).filter((file) => file.name.endsWith('.json')).map((file) => readCloud<SearchRecord>(`searches/${file.name}`)))
  return records.map(summary).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const getSearch = async (id: string) => {
  if (!remote) {
    const record = await json<SearchRecord>(await fetch(`${BASE}/buscas/${encodeURIComponent(id)}`))
    return { ...record, leads: record.leads.map(rescore).sort(byScore) }
  }
  const record = await readCloud<SearchRecord>(`searches/${id}.json`)
  return { ...record, leads: record.leads.map(rescore).sort(byScore) }
}

export const removeSearch = async (id: string) => {
  if (!remote) return json(await fetch(`${BASE}/buscas/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  const { error } = await supabase.storage.from(BUCKET).remove([await pathFor(`searches/${id}.json`)])
  if (error) throw new Error(error.message)
  return { ok: true }
}

export const getFunnel = async (): Promise<Opportunity[]> => {
  if (!remote) return json<Opportunity[]>(await fetch(`${BASE}/funil`))
  return readCloud<Opportunity[]>('funnel.json', [])
}

export const addToFunnel = async (leads: Lead[], meta: { region: string; searchId?: string; stage?: Stage }) => {
  if (!remote) {
    return json<Opportunity[]>(await fetch(`${BASE}/funil`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leads, ...meta }),
    }))
  }
  const list = await getFunnel()
  const byId = new Map(list.map((item) => [item.id, item]))
  const now = new Date().toISOString()
  for (const lead of leads) {
    const current = byId.get(lead.id)
    if (current) {
      const moved = Boolean(meta.stage && meta.stage !== current.stage)
      byId.set(lead.id, {
        ...current,
        lead,
        stage: meta.stage ?? current.stage,
        history: moved ? [...current.history, { at: now, stage: meta.stage! }] : current.history,
        updatedAt: now,
      })
    } else {
      const stage = meta.stage ?? 'mapeado'
      const { offer, brief } = draftOffer(lead)
      byId.set(lead.id, {
        id: lead.id,
        lead,
        offer,
        brief,
        searchId: meta.searchId,
        region: meta.region,
        stage,
        history: [{ at: now, stage }],
        createdAt: now,
        updatedAt: now,
      })
    }
  }
  const next = [...byId.values()]
  await writeCloud('funnel.json', next)
  return next
}

export const updateOpportunity = async (id: string, patch: OpportunityPatch) => {
  if (!remote) {
    return json<Opportunity>(await fetch(`${BASE}/funil/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }))
  }
  const list = await getFunnel()
  const current = list.find((item) => item.id === id)
  if (!current) throw new Error('Oportunidade não encontrada')
  const now = new Date().toISOString()
  const moved = Boolean(patch.stage && patch.stage !== current.stage)
  const clean = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || undefined : value])) as OpportunityPatch
  const opportunity: Opportunity = {
    ...current,
    ...clean,
    history: moved ? [...current.history, { at: now, stage: patch.stage! }] : current.history,
    updatedAt: now,
  }
  await writeCloud('funnel.json', list.map((item) => item.id === id ? opportunity : item))
  return opportunity
}

export const removeOpportunity = async (id: string) => {
  if (!remote) return json(await fetch(`${BASE}/funil/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  await writeCloud('funnel.json', (await getFunnel()).filter((item) => item.id !== id))
  return { ok: true }
}

export const getFunnelSettings = async (): Promise<FunnelSettings> => {
  if (!remote) return json<FunnelSettings>(await fetch(`${BASE}/funil-config`))
  return { ...DEFAULT_SETTINGS, ...(await readCloud<Partial<FunnelSettings>>('settings.json', {})) }
}

export const saveFunnelSettings = async (settings: FunnelSettings) => {
  if (!remote) {
    return json<FunnelSettings>(await fetch(`${BASE}/funil-config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    }))
  }
  await writeCloud('settings.json', settings)
  return settings
}

/** Roda a busca local e entrega cada evento assim que chega (uma linha de JSON por evento). */
export const startSearch = async (input: SearchInput, onEvent: (event: SearchEvent) => void, signal?: AbortSignal) => {
  if (remote) throw new Error('Novas varreduras ainda rodam no app local')
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
