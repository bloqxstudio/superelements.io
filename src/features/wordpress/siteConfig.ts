import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { VISITAS_ENDPOINT, createTracker, loadTrackers, normalizeDomain } from '@/features/crm/site'
import { hookUrl, loadHook } from '@/features/crm/leadOrigin'
import { credentialsOf } from './connect'
import { wpRequest } from './rest'
import type { WordPressConnection } from './types'

/**
 * Configuração unificada do Connector (0.5+): ao conectar, a plataforma grava no plugin, numa chamada só,
 * a chave do painel Site (o script de visitas vai dentro do plugin) e o webhook de leads da conta.
 * Melhor esforço: sem o plugin novo, sem ser administrador do site ou sem ser gestor da conta, o que não
 * der para configurar fica de fora e a conexão segue valendo.
 */

const db = supabase as unknown as SupabaseClient

export interface SiteConfigResult {
  tracker: boolean
  leads: boolean
  /** Por que algo ficou de fora, para mostrar à pessoa. */
  notes: string[]
}

async function teamOf(projectId: string): Promise<string | undefined> {
  const { data } = await db.from('space_projects').select('team_id').eq('id', projectId).maybeSingle()
  return (data as { team_id?: string | null } | null)?.team_id ?? undefined
}

export async function syncSiteConfig(projectId: string, connection: WordPressConnection): Promise<SiteConfigResult> {
  const result: SiteConfigResult = { tracker: false, leads: false, notes: [] }
  const teamId = await teamOf(projectId)
  if (!teamId) {
    result.notes.push('O projeto não está numa conta.')
    return result
  }
  const body: Record<string, unknown> = {}

  try {
    const domain = normalizeDomain(connection.site.siteUrl)
    const known = (await loadTrackers(teamId)).find((t) => t.domain === domain)
    if (known) body.tracker = { key: known.id, endpoint: VISITAS_ENDPOINT }
    else {
      await createTracker(teamId, domain, connection.site.name)
      const created = (await loadTrackers(teamId)).find((t) => t.domain === domain)
      if (created) body.tracker = { key: created.id, endpoint: VISITAS_ENDPOINT }
    }
  } catch {
    result.notes.push('Painel Site: só gestor da conta cadastra o site.')
  }

  try {
    const hook = await loadHook(teamId)
    if (hook.enabled) body.leads = { url: hookUrl(hook.token) }
  } catch {
    result.notes.push('Leads: só gestor da conta recebe a chave do webhook.')
  }

  if (!body.tracker && !body.leads) return result
  try {
    await wpRequest(credentialsOf(connection), 'superelements/v1/config', { method: 'POST', body })
    result.tracker = Boolean(body.tracker)
    result.leads = Boolean(body.leads)
  } catch {
    result.notes.push('O plugin Connector do site precisa estar na versão 0.5 e a conexão ser de administrador.')
  }
  return result
}
