import { supabase } from '@/integrations/supabase/client'
import { DEFAULT_SETTINGS, type FunnelSettings, type Opportunity, type OpportunityPatch, type Stage } from './funnel.ts'
import { draftOffer } from './offer.ts'
import { scoreLead } from './score.ts'
import type { Lead, SearchEvent, SearchInput, SearchRecord, SearchSummary } from './types.ts'

/**
 * Buscas, funil e ajustes ficam sempre na nuvem, na pasta `prospeccao/` que
 * todo admin lê e grava (migração 20261012200000), também no app aberto pelo
 * servidor de dev: antes o dev gravava em `data/prospeccao/` e a equipe via
 * outro funil. Só a varredura nova roda no servidor de dev, porque abre mapas
 * e milhares de sites, bem mais do que uma função serverless aguenta; quando
 * termina, a busca vai para a nuvem.
 */
const BASE = '/__prospeccao'
const local = Boolean(import.meta.hot)

export interface ProspectConfig {
  google: boolean
  canSearch: boolean
}

const BUCKET = 'space-projects'

/** Uma pasta só para todos os admins (migração 20261012200000), não uma por conta. */
const FOLDER = 'prospeccao'
const pathFor = (name: string) => `${FOLDER}/${name}`

const missing = (message: string) => /not found|does not exist|404/i.test(message)

/**
 * Sempre a versão de agora. Os arquivos são regravados no mesmo caminho, e o
 * download comum vinha do cache do navegador (até 1 h): a tela mostrava o funil
 * antigo e, ao salvar, gravava a lista velha por cima do que a equipe mudou. O
 * endereço assinado muda a cada leitura e não guarda cache.
 */
const readCloud = async <T,>(name: string, fallback?: T): Promise<T> => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pathFor(name), 60)
  if (error) {
    if (fallback !== undefined && missing(error.message)) return fallback
    throw new Error(error.message)
  }
  const response = await fetch(data.signedUrl, { cache: 'no-store' })
  if (!response.ok) {
    if (fallback !== undefined && response.status === 404) return fallback
    throw new Error(`Erro ${response.status} ao ler ${name}`)
  }
  return (await response.json()) as T
}

/** `cacheControl` 0: nenhum navegador pode guardar a versão que esta gravação substitui. */
const writeCloud = async (name: string, value: unknown) => {
  const body = new Blob([JSON.stringify(value)], { type: 'application/json' })
  const { error } = await supabase.storage.from(BUCKET).upload(pathFor(name), body, { contentType: 'application/json', upsert: true, cacheControl: '0' })
  if (error) throw new Error(error.message)
}

/**
 * Gravações do funil feitas por esta tela. Cada uma lê o funil de agora logo
 * antes de gravar; enquanto alguma está no meio, a atualização periódica não
 * troca a tela (a resposta da gravação é mais nova).
 */
let writes = 0
let version = 0
const writing = async <T,>(task: () => Promise<T>): Promise<T> => {
  writes++
  version++
  try {
    return await task()
  } finally {
    writes--
    version++
  }
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
  const { data, error } = await supabase.storage.from(BUCKET).list(pathFor('searches'), { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
  if (error) throw new Error(error.message)
  const files = (data ?? []).filter((file) => file.name.endsWith('.json'))
  const list = await Promise.all(
    files.map(async (file) => {
      const known = summaries.get(file.name)
      if (known && known.stamp === stamp(file)) return known.summary
      const one = summary(await readCloud<SearchRecord>(`searches/${file.name}`))
      summaries.set(file.name, { stamp: stamp(file), summary: one })
      return one
    })
  )
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const getSearch = async (id: string) => {
  let record: SearchRecord
  try {
    record = await readCloud<SearchRecord>(`searches/${id}.json`)
  } catch (error) {
    // Varredura que acabou de rodar aqui e não chegou à nuvem: ainda abre neste computador
    if (!local) throw error
    record = await json<SearchRecord>(await fetch(`${BASE}/buscas/${encodeURIComponent(id)}`))
  }
  return { ...record, leads: record.leads.map(rescore).sort(byScore) }
}

/** A varredura feita no servidor de dev vai para a nuvem, para a equipe toda. */
export const shareSearch = (record: SearchRecord) => writeCloud(`searches/${record.id}.json`, record)

export const removeSearch = async (id: string) => {
  const { error } = await supabase.storage.from(BUCKET).remove([pathFor(`searches/${id}.json`)])
  if (error) throw new Error(error.message)
  // E a cópia deste computador, para o `prospectar:subir` não mandar a busca de volta
  if (local) await fetch(`${BASE}/buscas/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  return { ok: true }
}

export const getFunnel = async (): Promise<Opportunity[]> => readCloud<Opportunity[]>('funnel.json', [])

let polled = ''

/**
 * O funil de agora, para a tela acompanhar o que a equipe muda. Pergunta antes
 * a versão do arquivo e só baixa o funil quando ela mudou. `null` quando nada
 * mudou ou quando uma gravação desta tela começou durante a leitura.
 */
export const pollFunnel = async (): Promise<Opportunity[] | null> => {
  if (writes) return null
  const at = version
  const { data, error } = await supabase.storage.from(BUCKET).list(FOLDER, { limit: 5, search: 'funnel.json' })
  if (error) throw new Error(error.message)
  const file = data?.find((item) => item.name === 'funnel.json')
  const current = file ? stamp(file) : ''
  if (current && current === polled) return null
  const list = await getFunnel()
  if (writes || at !== version) return null
  polled = current
  return list
}

export const addToFunnel = (leads: Lead[], meta: { region: string; searchId?: string; stage?: Stage }) =>
  writing(async () => {
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
  })

export const updateOpportunity = (id: string, patch: OpportunityPatch) =>
  writing(async () => {
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
  })

export const removeOpportunity = (id: string) =>
  writing(async () => {
    await writeCloud('funnel.json', (await getFunnel()).filter((item) => item.id !== id))
    return { ok: true }
  })

export const getFunnelSettings = async (): Promise<FunnelSettings> => ({ ...DEFAULT_SETTINGS, ...(await readCloud<Partial<FunnelSettings>>('settings.json', {})) })

export const saveFunnelSettings = async (settings: FunnelSettings) => {
  await writeCloud('settings.json', settings)
  return settings
}

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
