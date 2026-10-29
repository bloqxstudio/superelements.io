import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { DEFAULT_SETTINGS, type FunnelSettings, type Opportunity, type OpportunityPatch, type Stage } from '@/features/prospects/funnel'
import { draftOffer } from '@/features/prospects/offer'
import type { Lead } from '@/features/prospects/types'
import { crmContext, useCrm } from './crmStore'
import type { Client } from './types'

/**
 * Oportunidades do funil, nas tabelas do CRM: uma linha por oportunidade, com
 * o cliente junto. Cada gravação muda só a linha (e as colunas) que mudou, e o
 * banco anota a etapa no histórico e na linha do tempo do cliente.
 */

const CLIENT_COLUMNS = 'id, name, segment, city, address, phone, whatsapp, email, website, domain, instagram, lead, prospect_key, source, status'

export const OPPORTUNITY_SELECT = `id, team_id, pipeline_id, client_id, key, stage, offer, brief, build, project_id, project_name, video, next_step, next_date, notes, search_id, region, owner_id, origin, history, closed_at, created_at, updated_at, client:crm_clients(${CLIENT_COLUMNS})`

interface ClientRow {
  id: string
  name: string
  segment: string | null
  city: string | null
  address: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  domain: string | null
  instagram: string | null
  lead: Json | null
  prospect_key: string | null
  source: string
  status: string
}

interface OpportunityRow {
  id: string
  team_id: string
  pipeline_id: string
  client_id: string
  key: string | null
  stage: string
  offer: Json | null
  brief: Json | null
  build: Json | null
  project_id: string | null
  project_name: string | null
  video: string | null
  next_step: string | null
  next_date: string | null
  notes: string | null
  search_id: string | null
  region: string
  owner_id: string | null
  origin: Json | null
  history: Json
  created_at: string
  updated_at: string
  client: ClientRow | null
}

const or = <T,>(value: T | null | undefined) => value ?? undefined

/**
 * A empresa como o funil mostra: a da busca da Prospecção, com o nome que está
 * no cadastro; ou, para quem foi cadastrado à mão, montada com o cadastro.
 */
export const leadOfClient = (client: ClientRow): Lead => {
  const found = client.lead as unknown as Lead | null
  if (found) return { ...found, name: client.name }
  return {
    id: client.prospect_key ?? `cliente:${client.id}`,
    source: 'manual',
    name: client.name,
    niche: client.segment ?? '',
    city: or(client.city),
    address: or(client.address),
    phone: or(client.phone ?? client.whatsapp),
    email: or(client.email),
    website: or(client.website),
    domain: or(client.domain),
    score: 0,
    temperature: 'fria',
    plan: 'Site novo',
    reasons: [],
  }
}

/** A empresa de um cliente da ficha, como o funil a mostra. */
export const leadForClient = (client: Client): Lead =>
  leadOfClient({
    id: client.id,
    name: client.name,
    segment: client.segment ?? null,
    city: client.city ?? null,
    address: client.address ?? null,
    phone: client.phone ?? null,
    whatsapp: client.whatsapp ?? null,
    email: client.email ?? null,
    website: client.website ?? null,
    domain: client.domain ?? null,
    instagram: client.instagram ?? null,
    lead: (client.lead ?? null) as unknown as Json,
    prospect_key: client.prospectKey ?? null,
    source: client.source,
    status: client.status,
  })

export const toOpportunity = (row: OpportunityRow): Opportunity => ({
  id: row.id,
  clientId: row.client_id,
  pipelineId: row.pipeline_id,
  key: or(row.key),
  lead: row.client ? leadOfClient(row.client) : { id: row.key ?? row.id, source: 'manual', name: '—', niche: '', score: 0, temperature: 'fria', plan: 'Site novo', reasons: [] },
  searchId: or(row.search_id),
  region: row.region,
  stage: row.stage as Stage,
  projectId: or(row.project_id),
  projectName: or(row.project_name),
  video: or(row.video),
  notes: or(row.notes),
  nextStep: or(row.next_step),
  nextDate: or(row.next_date),
  offer: or(row.offer) as unknown as Opportunity['offer'],
  brief: or(row.brief) as unknown as Opportunity['brief'],
  build: or(row.build) as unknown as Opportunity['build'],
  ownerId: or(row.owner_id),
  origin: or(row.origin) as unknown as Opportunity['origin'],
  history: (Array.isArray(row.history) ? row.history : []) as unknown as Opportunity['history'],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const select = () => supabase.from('crm_opportunities').select(OPPORTUNITY_SELECT)

/** As oportunidades do funil aberto (ou do funil dado). */
export async function listOpportunities(pipelineId?: string): Promise<Opportunity[]> {
  const pipeline = pipelineId ?? (await crmContext()).pipeline.id
  const { data, error } = await select().eq('pipeline_id', pipeline).order('created_at', { ascending: true })
  if (error) throw error
  return (data as unknown as OpportunityRow[]).map(toOpportunity)
}

export async function listClientOpportunities(clientId: string): Promise<Opportunity[]> {
  const { data, error } = await select().eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as OpportunityRow[]).map(toOpportunity)
}

export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  const { data, error } = await select().eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toOpportunity(data as unknown as OpportunityRow) : undefined
}

/**
 * Pelo id da oportunidade ou pelo id da empresa na busca (`google:…`): os
 * pedidos ao agente feitos antes do CRM levam o id antigo.
 */
export async function findOpportunity(idOrKey: string): Promise<Opportunity | undefined> {
  if (UUID.test(idOrKey)) return getOpportunity(idOrKey)
  const { pipeline } = await crmContext()
  const { data, error } = await select().eq('pipeline_id', pipeline.id).eq('key', idOrKey).maybeSingle()
  if (error) throw error
  return data ? toOpportunity(data as unknown as OpportunityRow) : undefined
}

const text = (value: string | undefined) => (typeof value === 'string' ? value.trim() || null : value ?? null)

/** As colunas que um pedaço de mudança da tela toca (e só elas). */
const columnsOf = (patch: OpportunityPatch) => {
  const row: Record<string, unknown> = {}
  if ('stage' in patch && patch.stage) row.stage = patch.stage
  if ('projectName' in patch) row.project_name = text(patch.projectName)
  if ('projectId' in patch) row.project_id = patch.projectId ?? null
  if ('video' in patch) row.video = text(patch.video)
  if ('notes' in patch) row.notes = text(patch.notes)
  if ('nextStep' in patch) row.next_step = text(patch.nextStep)
  if ('nextDate' in patch) row.next_date = text(patch.nextDate)
  if ('offer' in patch) row.offer = patch.offer ?? null
  if ('brief' in patch) row.brief = patch.brief ?? null
  if ('build' in patch) row.build = patch.build ?? null
  if ('ownerId' in patch) row.owner_id = patch.ownerId ?? null
  return row
}

export async function updateOpportunity(id: string, patch: OpportunityPatch): Promise<Opportunity> {
  const target = UUID.test(id) ? id : (await findOpportunity(id))?.id
  if (!target) throw new Error('Oportunidade não encontrada')
  const { data, error } = await supabase.from('crm_opportunities').update(columnsOf(patch)).eq('id', target).select(OPPORTUNITY_SELECT).single()
  if (error) throw error
  return toOpportunity(data as unknown as OpportunityRow)
}

export async function removeOpportunity(id: string) {
  const { error } = await supabase.from('crm_opportunities').delete().eq('id', id)
  if (error) throw error
  return { ok: true }
}

/** Uma oportunidade nova para um cliente que já está no CRM. */
export async function createOpportunity(clientId: string, fields: { stage?: Stage; lead: Lead; region?: string; pipelineId?: string }): Promise<Opportunity> {
  const pipeline = fields.pipelineId ?? (await crmContext()).pipeline.id
  const { offer, brief } = draftOffer(fields.lead)
  const { data, error } = await supabase
    .from('crm_opportunities')
    .insert({
      pipeline_id: pipeline,
      client_id: clientId,
      stage: fields.stage ?? 'mapeado',
      offer: offer as unknown as Json,
      brief: brief as unknown as Json,
      region: fields.region ?? fields.lead.city ?? '',
    })
    .select(OPPORTUNITY_SELECT)
    .single()
  if (error) throw error
  return toOpportunity(data as unknown as OpportunityRow)
}

/** O cadastro de uma empresa que veio da busca da Prospecção. */
export const clientFromLead = (lead: Lead, teamId: string) => ({
  team_id: teamId,
  name: lead.name,
  segment: lead.niche || null,
  city: lead.city ?? null,
  address: lead.address ?? null,
  phone: lead.phone ?? null,
  whatsapp: lead.scan?.whatsapp ?? null,
  email: lead.email ?? lead.scan?.emails[0] ?? null,
  website: lead.scan?.url ?? lead.website ?? null,
  domain: lead.domain ?? null,
  instagram: lead.scan?.instagram ?? null,
  source: 'prospeccao',
  status: 'lead',
  prospect_key: lead.id,
  lead: lead as unknown as Json,
})

const chunks = <T,>(list: T[], size = 80) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

/**
 * Empresas da busca no funil. Cada uma vira (ou reaproveita) um cliente, com a
 * leitura do site atualizada; as que já estão no funil mantêm a etapa, a não
 * ser que `stage` seja dada.
 */
export async function addLeads(leads: Lead[], meta: { region: string; searchId?: string; stage?: Stage }): Promise<Opportunity[]> {
  const { team, pipeline } = await crmContext()
  const unique = [...new Map(leads.map((lead) => [lead.id, lead])).values()]
  const clientIds = new Map<string, string>()

  for (const part of chunks(unique)) {
    const { data, error } = await supabase.from('crm_clients').select('id, prospect_key').eq('team_id', team.id).in('prospect_key', part.map((l) => l.id))
    if (error) throw error
    for (const row of data ?? []) if (row.prospect_key) clientIds.set(row.prospect_key, row.id)
  }
  // Quem já é cliente fica com o cadastro como está; só a leitura do site se atualiza
  await Promise.all(
    unique.filter((lead) => clientIds.has(lead.id)).map(async (lead) => {
      const { error } = await supabase.from('crm_clients').update({ lead: lead as unknown as Json }).eq('id', clientIds.get(lead.id)!)
      if (error) throw error
    })
  )
  const fresh = unique.filter((lead) => !clientIds.has(lead.id))
  for (const part of chunks(fresh)) {
    const { data, error } = await supabase.from('crm_clients').insert(part.map((lead) => clientFromLead(lead, team.id))).select('id, prospect_key')
    if (error) throw error
    for (const row of data ?? []) if (row.prospect_key) clientIds.set(row.prospect_key, row.id)
  }

  const current = new Map<string, { id: string; stage: string }>()
  for (const part of chunks(unique)) {
    const { data, error } = await supabase.from('crm_opportunities').select('id, key, stage').eq('pipeline_id', pipeline.id).in('key', part.map((l) => l.id))
    if (error) throw error
    for (const row of data ?? []) if (row.key) current.set(row.key, row)
  }
  if (meta.stage) {
    const moving = [...current.values()].filter((row) => row.stage !== meta.stage)
    await Promise.all(
      moving.map(async (row) => {
        const { error } = await supabase.from('crm_opportunities').update({ stage: meta.stage }).eq('id', row.id)
        if (error) throw error
      })
    )
  }
  const created = unique.filter((lead) => !current.has(lead.id))
  for (const part of chunks(created)) {
    const { error } = await supabase.from('crm_opportunities').insert(
      part.map((lead) => {
        const { offer, brief } = draftOffer(lead)
        return {
          pipeline_id: pipeline.id,
          client_id: clientIds.get(lead.id)!,
          key: lead.id,
          stage: meta.stage ?? 'mapeado',
          offer: offer as unknown as Json,
          brief: brief as unknown as Json,
          search_id: meta.searchId ?? null,
          region: meta.region,
        }
      })
    )
    if (error) throw error
  }
  return listOpportunities(pipeline.id)
}

/** Valor padrão do serviço, do plano mensal e meses no valor: do funil aberto. */
export async function getPipelineSettings(): Promise<FunnelSettings> {
  const { pipeline } = await crmContext()
  return { ...DEFAULT_SETTINGS, ...pipeline.settings }
}

export async function savePipelineSettings(settings: FunnelSettings): Promise<FunnelSettings> {
  const { pipeline } = await crmContext()
  const { error } = await supabase.from('crm_pipelines').update({ settings: settings as unknown as Json }).eq('id', pipeline.id)
  if (error) throw error
  useCrm.getState().setPipeline({ ...pipeline, settings })
  return settings
}
