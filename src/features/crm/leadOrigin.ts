import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

/**
 * Leads que entram por webhook (`supabase/functions/lead-webhook`): a origem que a função grava em
 * `crm_opportunities.origin` e a chave do webhook de cada conta (só gestor vê).
 */

const db = supabase as unknown as SupabaseClient

export interface LeadCampaign {
  /** `meta`: achada nos relatórios da Meta (com gasto); `utm`: só o nome que veio no link */
  from: 'meta' | 'utm'
  id?: string
  name: string
  status?: string
  objective?: string
  preset?: string
  since?: string | null
  until?: string | null
  currency?: string
  spend?: number
  impressions?: number
  linkClicks?: number
  leads?: number
  conversations?: number
  result?: { type: string; value: number; cost?: number }
  adset?: string
  ad?: string
  fetchedAt?: string
}

export interface LeadOrigin {
  channel: string
  paid: boolean
  receivedAt: string
  page?: string
  referrer?: string
  form?: string
  utm?: Record<string, string>
  clickIds?: Record<string, string>
  ids?: Record<string, string>
  campaign?: LeadCampaign
  /** Os outros campos do formulário */
  fields?: Record<string, string>
}

export const PRESET_LABEL: Record<string, string> = { last_7d: 'últimos 7 dias', last_30d: 'últimos 30 dias', last_90d: 'últimos 90 dias', this_month: 'este mês' }
export const CAMPAIGN_STATUS: Record<string, string> = { ACTIVE: 'Ativa', PAUSED: 'Pausada', ARCHIVED: 'Arquivada', DELETED: 'Apagada' }

export const hookUrl = (token: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-webhook?key=${token}`

export async function loadHook(teamId: string, rotate = false): Promise<{ token: string; enabled: boolean }> {
  const { data, error } = await db.rpc('crm_lead_hook', { p_team: teamId, p_rotate: rotate })
  if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883' ? 'no_tables' : error.message)
  const row = (Array.isArray(data) ? data[0] : data) as { token: string; enabled: boolean }
  return row
}

export async function setHookEnabled(teamId: string, enabled: boolean) {
  const { error } = await db.from('crm_lead_hooks').update({ enabled }).eq('team_id', teamId)
  if (error) throw new Error(error.message)
}
