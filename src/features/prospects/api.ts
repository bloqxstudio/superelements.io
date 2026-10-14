import { supabase } from '@/integrations/supabase/client'
import { crmContext } from '@/features/crm/crmStore'
import {
  addLeads,
  getPipelineSettings,
  listOpportunities,
  removeOpportunity as removeCrmOpportunity,
  savePipelineSettings,
  updateOpportunity as updateCrmOpportunity,
} from '@/features/crm/opportunities'
import type { FunnelSettings, Opportunity, OpportunityPatch, Stage } from './funnel.ts'
import { scoreLead } from './score.ts'
import type { Lead, SearchEvent, SearchInput, SearchRecord, SearchSummary } from './types.ts'

/**
 * A Prospecção da equipe do CRM. O funil são as oportunidades do CRM
 * (tabelas, `src/features/crm/opportunities.ts`): cada mudança grava só a
 * linha que mudou. As buscas ficam em arquivo, na pasta da equipe no bucket
 * (`crm/<equipe>/searches/`), igual para todos, também no app aberto pelo
 * servidor de dev. Só a varredura nova roda no servidor de dev, porque abre
 * mapas e milhares de sites; quando termina, a busca vai para a pasta.
 */
const BASE = '/__prospeccao'
const local = Boolean(import.meta.hot)

export interface ProspectConfig {
  google: boolean
  canSearch: boolean
}

const BUCKET = 'space-projects'

/** A pasta da equipe aberta no CRM (migração 20261013150000). */
const folder = async () => `crm/${(await crmContext()).team.id}`

const missing = (message: string) => /not found|does not exist|404/i.test(message)

/**
 * Sempre a versão de agora: o endereço assinado muda a cada leitura e não
 * guarda cache (o download comum podia vir do cache do navegador).
 */
const readCloud = async <T,>(path: string, fallback?: T): Promise<T> => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error) {
    if (fallback !== undefined && missing(error.message)) return fallback
    throw new Error(error.message)
  }
  const response = await fetch(data.signedUrl, { cache: 'no-store' })
  if (!response.ok) {
    if (fallback !== undefined && response.status === 404) return fallback
    throw new Error(`Erro ${response.status} ao ler ${path}`)
  }
  return (await response.json()) as T
}

/** `cacheControl` 0: nenhum navegador pode guardar a versão que esta gravação substitui. */
const writeCloud = async (path: string, value: unknown) => {
  const body = new Blob([JSON.stringify(value)], { type: 'application/json' })
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'application/json', upsert: true, cacheControl: '0' })
  if (error) throw new Error(error.message)
}

const json = async <T,>(response: Response): Promise<T> => {
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('json')) throw new Error('A prospecção local não está no ar')
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error ?? `Erro ${response.status}`)
  return body as T
}

/**
 * A nota sempre pela regra atual, mesmo numa busca salva antes de a regra
 * mudar. Quem foi cadastrado à mão no CRM, sem leitura do site, fica sem nota.
 */
export const rescore = (lead: Lead): Lead => (lead.source === 'manual' && !lead.scan ? lead : { ...lead, ...scoreLead(lead) })

export const byScore = (a: Lead, b: Lead) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR')

export const getConfig = async (): Promise<ProspectConfig | null> => {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  if (!local) return { google: false, canSearch: false }
  try {
    const engine = await json<{ google: boolean }>(await fetch(`${BASE}/config`))
    return { ...engine, canSearch: true }
  } catch {
    return { google: false, canSearch: false }
  }
}

const summary = ({ id, createdAt, label, input, regionLabel, stats }: SearchRecord): SearchSummary => ({ id, createdAt, label, input, regionLabel, stats })

/** A versão de um arquivo no bucket: muda a cada gravação. */
const stamp = (file: { updated_at?: string | null; metadata?: Record<string, unknown> | null }) => String(file.metadata?.eTag ?? file.updated_at ?? '')

/** O resumo de cada busca já lida, pela versão: a lista não baixa de novo a busca inteira que não mudou. */
const summaries = new Map<string, { stamp: string; summary: SearchSummary }>()

export const listSearches = async (): Promise<SearchSummary[]> => {
  const base = await folder()
  const { data, error } = await supabase.storage.from(BUCKET).list(`${base}/searches`, { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
  if (error) throw new Error(error.message)
  const files = (data ?? []).filter((file) => file.name.endsWith('.json'))
  const list = await Promise.all(
    files.map(async (file) => {
      const path = `${base}/searches/${file.name}`
      const known = summaries.get(path)
      if (known && known.stamp === stamp(file)) return known.summary
      const one = summary(await readCloud<SearchRecord>(path))
      summaries.set(path, { stamp: stamp(file), summary: one })
      return one
    })
  )
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const getSearch = async (id: string) => {
  let record: SearchRecord
  try {
    record = await readCloud<SearchRecord>(`${await folder()}/searches/${id}.json`)
  } catch (error) {
    // Varredura que acabou de rodar aqui e não chegou à nuvem: ainda abre neste computador
    if (!local) throw error
    record = await json<SearchRecord>(await fetch(`${BASE}/buscas/${encodeURIComponent(id)}`))
  }
  return { ...record, leads: record.leads.map(rescore).sort(byScore) }
}

/** A varredura feita no servidor de dev vai para a pasta da equipe. */
export const shareSearch = async (record: SearchRecord) => writeCloud(`${await folder()}/searches/${record.id}.json`, record)

export const removeSearch = async (id: string) => {
  const { error } = await supabase.storage.from(BUCKET).remove([`${await folder()}/searches/${id}.json`])
  if (error) throw new Error(error.message)
  // E a cópia deste computador, para o `prospectar:subir` não mandar a busca de volta
  if (local) await fetch(`${BASE}/buscas/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  return { ok: true }
}

// ---------- o funil: as oportunidades do CRM ----------

export const getFunnel = (): Promise<Opportunity[]> => listOpportunities()

export const addToFunnel = (leads: Lead[], meta: { region: string; searchId?: string; stage?: Stage }) => addLeads(leads, meta)

export const updateOpportunity = (id: string, patch: OpportunityPatch) => updateCrmOpportunity(id, patch)

export const removeOpportunity = (id: string) => removeCrmOpportunity(id)

export const getFunnelSettings = (): Promise<FunnelSettings> => getPipelineSettings()

export const saveFunnelSettings = (settings: FunnelSettings) => savePipelineSettings(settings)

/** Roda a busca local e entrega cada evento assim que chega (uma linha de JSON por evento). */
export const startSearch = async (input: SearchInput, onEvent: (event: SearchEvent) => void, signal?: AbortSignal) => {
  if (!local) throw new Error('Novas varreduras ainda rodam no app local')
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
