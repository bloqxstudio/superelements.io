import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { DEFAULT_SETTINGS, type FunnelSettings, type Opportunity, type Stage } from '@/features/prospects/funnel'
import { loadPipeline, useCrm } from './crmStore'
import { clientFromLead } from './opportunities'
import type { ClientSource } from './types'

/**
 * Traz para a equipe o que existia antes do CRM, com a conta de quem cria a
 * equipe (admin da plataforma): o funil da Prospecção (`prospeccao/funnel.json`
 * no bucket, com os ajustes de valor), as buscas salvas (copiadas para a pasta
 * da equipe) e o Comercial antigo (tabelas `leads` e `lead_interactions`).
 * Pode rodar de novo: o que já entrou é reconhecido e fica como está. Os
 * arquivos antigos continuam no bucket, como cópia.
 */

const BUCKET = 'space-projects'

const readOld = async <T,>(path: string): Promise<T | undefined> => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error) return undefined
  const response = await fetch(data.signedUrl, { cache: 'no-store' })
  return response.ok ? ((await response.json()) as T) : undefined
}

/** O que existe para trazer, sem trazer: para a tela mostrar antes. */
export async function legacyCounts() {
  const [funnel, leads, searches] = await Promise.all([
    readOld<Opportunity[]>('prospeccao/funnel.json').catch(() => undefined),
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.storage.from(BUCKET).list('prospeccao/searches', { limit: 1000 }),
  ])
  return {
    funnel: funnel?.length ?? 0,
    leads: leads.error ? 0 : leads.count ?? 0,
    searches: searches.error ? 0 : (searches.data ?? []).filter((f) => f.name.endsWith('.json')).length,
  }
}

export interface ImportResult {
  clients: number
  opportunities: number
  searches: number
  notes: number
}

const chunks = <T,>(list: T[], size = 80) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

/** Clientes da equipe por chave (`google:…` ou `legado:<id>`). */
async function clientsByKey(teamId: string, keys: string[]) {
  const found = new Map<string, string>()
  for (const part of chunks(keys)) {
    const { data, error } = await supabase.from('crm_clients').select('id, prospect_key').eq('team_id', teamId).in('prospect_key', part)
    if (error) throw error
    for (const row of data ?? []) if (row.prospect_key) found.set(row.prospect_key, row.id)
  }
  return found
}

async function opportunityKeys(pipelineId: string, keys: string[]) {
  const found = new Set<string>()
  for (const part of chunks(keys)) {
    const { data, error } = await supabase.from('crm_opportunities').select('key').eq('pipeline_id', pipelineId).in('key', part)
    if (error) throw error
    for (const row of data ?? []) if (row.key) found.add(row.key)
  }
  return found
}

/** Os projetos que existem e esta conta vê: o vínculo só entra para eles. */
async function visibleProjects(ids: string[]) {
  const found = new Set<string>()
  for (const part of chunks(ids)) {
    const { data } = await supabase.from('space_projects').select('id').in('id', part)
    for (const row of data ?? []) found.add(row.id)
  }
  return found
}

async function importFunnel(teamId: string, pipelineId: string, result: ImportResult) {
  const funnel = (await readOld<Opportunity[]>('prospeccao/funnel.json')) ?? []
  if (!funnel.length) return
  // No funil antigo o id do cartão era o id da empresa na busca
  const keyOf = (o: Opportunity) => o.key ?? o.lead.id ?? o.id
  const keys = [...new Set(funnel.map(keyOf))]
  const clients = await clientsByKey(teamId, keys)

  const fresh = funnel.filter((o) => !clients.has(keyOf(o)))
  for (const part of chunks(fresh)) {
    const rows = part.map((o) => ({ ...clientFromLead({ ...o.lead, id: keyOf(o) }, teamId), created_at: o.createdAt }))
    const { data, error } = await supabase.from('crm_clients').insert(rows).select('id, prospect_key')
    if (error) throw error
    for (const row of data ?? []) if (row.prospect_key) clients.set(row.prospect_key, row.id)
    result.clients += data?.length ?? 0
  }

  const already = await opportunityKeys(pipelineId, keys)
  const projects = await visibleProjects([...new Set(funnel.flatMap((o) => (o.build?.projectId ? [o.build.projectId] : [])))])
  const missing = funnel.filter((o) => !already.has(keyOf(o)))
  for (const part of chunks(missing)) {
    const { error } = await supabase.from('crm_opportunities').insert(
      part.map((o) => ({
        pipeline_id: pipelineId,
        client_id: clients.get(keyOf(o))!,
        key: keyOf(o),
        stage: o.stage,
        offer: (o.offer ?? null) as unknown as Json,
        brief: (o.brief ?? null) as unknown as Json,
        build: (o.build ?? null) as unknown as Json,
        project_id: o.build?.projectId && projects.has(o.build.projectId) ? o.build.projectId : null,
        project_name: o.projectName ?? null,
        video: o.video ?? null,
        next_step: o.nextStep ?? null,
        next_date: o.nextDate ?? null,
        notes: o.notes ?? null,
        search_id: o.searchId ?? null,
        region: o.region ?? '',
        history: (o.history ?? []) as unknown as Json,
        created_at: o.createdAt,
        updated_at: o.updatedAt,
      }))
    )
    if (error) throw error
    result.opportunities += part.length
  }

  const settings = await readOld<Partial<FunnelSettings>>('prospeccao/settings.json')
  if (settings && Object.keys(settings).length) {
    const pipeline = await loadPipeline(teamId)
    if (pipeline && !Object.keys(pipeline.settings).length) {
      const merged = { ...DEFAULT_SETTINGS, ...settings }
      await supabase.from('crm_pipelines').update({ settings: merged as unknown as Json }).eq('id', pipelineId)
      if (useCrm.getState().pipeline?.id === pipelineId) useCrm.getState().setPipeline({ ...pipeline, settings: merged })
    }
  }
}

async function copySearches(teamId: string, result: ImportResult) {
  const [{ data: old }, { data: here }] = await Promise.all([
    supabase.storage.from(BUCKET).list('prospeccao/searches', { limit: 1000 }),
    supabase.storage.from(BUCKET).list(`crm/${teamId}/searches`, { limit: 1000 }),
  ])
  const copied = new Set((here ?? []).map((f) => f.name))
  for (const file of (old ?? []).filter((f) => f.name.endsWith('.json') && !copied.has(f.name))) {
    const record = await readOld<unknown>(`prospeccao/searches/${file.name}`)
    if (!record) continue
    const body = new Blob([JSON.stringify(record)], { type: 'application/json' })
    const { error } = await supabase.storage.from(BUCKET).upload(`crm/${teamId}/searches/${file.name}`, body, { contentType: 'application/json', upsert: true, cacheControl: '0' })
    if (error) throw new Error(error.message)
    result.searches++
  }
}

// O Comercial antigo (fevereiro de 2026): etapas e origens no vocabulário de hoje
const OLD_STAGE: Record<string, Stage> = { new_lead: 'mapeado', contacted: 'contatado', proposal: 'proposta', negotiation: 'conversa', won: 'fechado', lost: 'perdido' }
const OLD_SOURCE: Record<string, ClientSource> = { indication: 'indicacao', instagram: 'instagram', website: 'site', cold_outreach: 'prospeccao', linkedin: 'outro', other: 'outro' }

async function importOldLeads(teamId: string, pipelineId: string, result: ImportResult) {
  const { data: leads, error } = await supabase.from('leads').select('id, name, company, email, phone, source, estimated_value, kanban_status, notes, created_at, updated_at')
  if (error || !leads?.length) return
  const keyOf = (id: string) => `legado:${id}`
  const clients = await clientsByKey(teamId, leads.map((l) => keyOf(l.id)))

  for (const lead of leads.filter((l) => !clients.has(keyOf(l.id)))) {
    const company = lead.company?.trim()
    const person = lead.name?.trim()
    const { data, error: insertError } = await supabase
      .from('crm_clients')
      .insert({
        team_id: teamId,
        name: company || person || 'Sem nome',
        email: lead.email,
        phone: lead.phone,
        source: OLD_SOURCE[lead.source] ?? 'outro',
        status: lead.kanban_status === 'won' ? 'cliente' : 'lead',
        prospect_key: keyOf(lead.id),
        created_at: lead.created_at,
      })
      .select('id')
      .single()
    if (insertError) throw insertError
    clients.set(keyOf(lead.id), data.id)
    result.clients++
    // A pessoa do lead vira o contato principal quando o nome é de gente, não da empresa
    if (company && person && person.toLowerCase() !== company.toLowerCase()) {
      await supabase.from('crm_contacts').insert({ client_id: data.id, name: person, email: lead.email, phone: lead.phone, is_primary: true } as never)
    }
  }

  const already = await opportunityKeys(pipelineId, leads.map((l) => keyOf(l.id)))
  const missing = leads.filter((l) => !already.has(keyOf(l.id)))
  if (missing.length) {
    const { error: oppError } = await supabase.from('crm_opportunities').insert(
      missing.map((l) => ({
        pipeline_id: pipelineId,
        client_id: clients.get(keyOf(l.id))!,
        key: keyOf(l.id),
        stage: OLD_STAGE[l.kanban_status] ?? 'mapeado',
        offer: (l.estimated_value ? { service: 'Site', price: Number(l.estimated_value) } : null) as unknown as Json,
        notes: l.notes,
        region: '',
        created_at: l.created_at,
        updated_at: l.updated_at,
      }))
    )
    if (oppError) throw oppError
    result.opportunities += missing.length
  }

  // As anotações do lead antigo entram na linha do tempo do cliente (uma vez só)
  const { data: notes } = await supabase.from('lead_interactions').select('lead_id, content, created_at')
  for (const note of notes ?? []) {
    const clientId = clients.get(keyOf(note.lead_id))
    if (!clientId) continue
    const { count } = await supabase.from('crm_activities').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('kind', 'note').eq('created_at', note.created_at)
    if (count) continue
    const { error: noteError } = await supabase.from('crm_activities').insert({ client_id: clientId, kind: 'note', body: note.content, created_at: note.created_at } as never)
    if (!noteError) result.notes++
  }
}

export async function importLegacy(teamId: string): Promise<ImportResult> {
  const pipeline = await loadPipeline(teamId)
  if (!pipeline) throw new Error('A equipe não tem funil')
  const result: ImportResult = { clients: 0, opportunities: 0, searches: 0, notes: 0 }
  await importFunnel(teamId, pipeline.id, result)
  await copySearches(teamId, result)
  await importOldLeads(teamId, pipeline.id, result)
  return result
}
