import type { Stage } from '../../src/features/prospects/funnel.ts'
import { draftOffer } from '../../src/features/prospects/offer.ts'
import type { Lead } from '../../src/features/prospects/types.ts'
import { cloudClient, crmTarget } from './cloud.ts'

/**
 * O funil da equipe pelo terminal (`--site`, `--fila`): as oportunidades do
 * CRM (tabelas `crm_clients` e `crm_opportunities`), as mesmas da tela
 * `/crm`. Cada empresa vira um cliente (pelo id dela na busca) e uma
 * oportunidade no funil da equipe.
 */

export interface QueueItem {
  /** Id da oportunidade: é o que o agente usa em `space prospect <id>`. */
  id: string
  stage: Stage
  region: string
  lead: Lead
}

interface ClientRow {
  id: string
  name: string
  segment: string | null
  lead: unknown
  prospect_key: string | null
  phone: string | null
  email: string | null
  address: string | null
}

const leadOf = (client: ClientRow): Lead => {
  const found = client.lead as Lead | null
  if (found) return { ...found, name: client.name }
  return {
    id: client.prospect_key ?? `cliente:${client.id}`,
    source: 'manual',
    name: client.name,
    niche: client.segment ?? '',
    phone: client.phone ?? undefined,
    email: client.email ?? undefined,
    address: client.address ?? undefined,
    score: 0,
    temperature: 'fria',
    plan: 'Site novo',
    reasons: [],
  }
}

/** As oportunidades do funil numa etapa (ou todas). */
export const readFunnel = async (stage?: Stage): Promise<QueueItem[]> => {
  const { pipelineId } = await crmTarget()
  let query = cloudClient()
    .from('crm_opportunities')
    .select('id, stage, region, client:crm_clients(id, name, segment, lead, prospect_key, phone, email, address)')
    .eq('pipeline_id', pipelineId)
    .order('created_at')
  if (stage) query = query.eq('stage', stage)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as { id: string; stage: Stage; region: string; client: ClientRow | null }[])
    .filter((row) => row.client)
    .map((row) => ({ id: row.id, stage: row.stage, region: row.region, lead: leadOf(row.client!) }))
}

/** Põe empresas no funil. As que já estão mantêm a etapa, a não ser que `stage` seja dada. Devolve os ids das oportunidades. */
export const addToFunnel = async (leads: Lead[], meta: { region: string; searchId?: string; stage?: Stage }) => {
  const db = cloudClient()
  const { teamId, pipelineId } = await crmTarget()
  const ids: string[] = []
  for (const lead of leads) {
    const { data: found, error: findError } = await db.from('crm_clients').select('id').eq('team_id', teamId).eq('prospect_key', lead.id).maybeSingle()
    if (findError) throw findError
    let clientId = (found as { id: string } | null)?.id
    if (clientId) {
      // Quem já é cliente fica com o cadastro como está; só a leitura do site se atualiza
      const { error } = await db.from('crm_clients').update({ lead }).eq('id', clientId)
      if (error) throw error
    } else {
      const { data, error } = await db
        .from('crm_clients')
        .insert({
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
          lead,
        })
        .select('id')
        .single()
      if (error) throw error
      clientId = (data as { id: string }).id
    }

    const { data: current, error: oppError } = await db.from('crm_opportunities').select('id, stage').eq('pipeline_id', pipelineId).eq('key', lead.id).maybeSingle()
    if (oppError) throw oppError
    const existing = current as { id: string; stage: string } | null
    if (existing) {
      if (meta.stage && meta.stage !== existing.stage) {
        const { error } = await db.from('crm_opportunities').update({ stage: meta.stage }).eq('id', existing.id)
        if (error) throw error
      }
      ids.push(existing.id)
      continue
    }
    // Toda oportunidade nasce com a oferta e o roteiro de venda padrão, para ajustar depois
    const { offer, brief } = draftOffer(lead)
    const { data, error } = await db
      .from('crm_opportunities')
      .insert({ pipeline_id: pipelineId, client_id: clientId, key: lead.id, stage: meta.stage ?? 'mapeado', offer, brief, search_id: meta.searchId ?? null, region: meta.region })
      .select('id')
      .single()
    if (error) throw error
    ids.push((data as { id: string }).id)
  }
  return ids
}
