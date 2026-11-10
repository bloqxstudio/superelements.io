import { supabase } from '@/integrations/supabase/client'
import { listSets } from './storage'
import type { SetSummary } from './types'

/** Os conjuntos de criativos da conta (os dos projetos dela; na conta principal, também os sem conta). */
export async function accountSets(teamId: string, isHome: boolean): Promise<SetSummary[]> {
  const q = supabase.from('space_projects').select('id')
  const { data } = await (isHome ? q.or(`team_id.eq.${teamId},team_id.is.null`) : q.eq('team_id', teamId))
  return listSets(((data ?? []) as { id: string }[]).map((p) => p.id))
}
