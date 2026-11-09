import { supabase } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useCrm } from '@/features/crm/crmStore'
import { loadContext } from '@/features/conteudos/api'
import { standardBlock } from './standard'
import { contextText } from './contextText'
import { LEARNINGS_DIR, learningsForContext } from './learnings'

/**
 * Carrega o contexto da conta aberta (Cérebro + Plano + marca) para os pedidos de IA de Textos, Pauta,
 * Criativos e vídeo. Um minuto de reaproveitamento por conta e formato; falha vira texto vazio (a
 * criação segue, como antes).
 */

const db = supabase as unknown as SupabaseClient

export interface AccountForAi { name: string; isHome: boolean; context: string }

let cache: { key: string; at: number; value: AccountForAi } | null = null
export const forgetAccountContext = () => { cache = null }

export async function accountContext(format?: string): Promise<AccountForAi | undefined> {
  const team = useCrm.getState().team
  if (!team) return undefined
  const key = `${team.id}:${format ?? ''}`
  if (cache && cache.key === key && Date.now() - cache.at < 60_000) return cache.value
  const [overview, plan, standard, learnings] = await Promise.all([
    db.from('crm_knowledge_notes').select('content').eq('team_id', team.id).eq('path', 'README.md').maybeSingle()
      .then(({ data }) => (data as { content?: string } | null)?.content ?? '', () => ''),
    loadContext(team.id).catch(() => null),
    standardBlock(team.id, format).catch(() => ''),
    // Os aprendizados do mês mais recente (o que funcionou e o que o cliente pediu), `learnings.ts`
    db.from('crm_knowledge_notes').select('content').eq('team_id', team.id).like('path', `${LEARNINGS_DIR}/%`).order('path', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => learningsForContext((data as { content?: string } | null)?.content ?? ''), () => ''),
  ])
  const value = { name: team.name, isHome: team.isHome, context: contextText({ name: team.name, overview, plan, standard, learnings }) }
  cache = { key, at: Date.now(), value }
  return value
}
