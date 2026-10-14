import { create } from 'zustand'
import { supabase } from '@/integrations/supabase/client'
import { listMyTeams } from './teams'
import type { Pipeline, Team } from './types'

/**
 * A equipe aberta no CRM e o funil dela. Quem é de mais de uma equipe escolhe
 * qual abrir (fica lembrado neste navegador); hoje há um funil por equipe.
 */

const TEAM_KEY = 'superelements-crm-equipe'

const remembered = () => {
  try {
    return localStorage.getItem(TEAM_KEY) ?? undefined
  } catch {
    return undefined
  }
}

const remember = (id: string) => {
  try {
    localStorage.setItem(TEAM_KEY, id)
  } catch {
    // Sem armazenamento: abre a primeira equipe
  }
}

export async function loadPipeline(teamId: string): Promise<Pipeline | undefined> {
  const { data, error } = await supabase
    .from('crm_pipelines')
    .select('id, team_id, name, settings')
    .eq('team_id', teamId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  const row = data?.[0]
  return row ? { id: row.id, teamId: row.team_id, name: row.name, settings: (row.settings ?? {}) as Pipeline['settings'] } : undefined
}

interface CrmState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** `sem-banco`: as tabelas do CRM ainda não existem (migração 20261013150000 não aplicada). */
  error?: 'sem-banco' | 'falha'
  userId?: string
  teams: Team[]
  team?: Team
  pipeline?: Pipeline
  /** Lê as equipes de quem entrou; `force` relê mesmo já tendo lido. */
  load: (userId: string, force?: boolean) => Promise<void>
  select: (teamId: string) => Promise<void>
  setPipeline: (pipeline: Pipeline) => void
  rename: (name: string) => void
}

let loading: Promise<void> | null = null

export const useCrm = create<CrmState>((set, get) => ({
  status: 'idle',
  teams: [],

  load: (userId, force = false) => {
    const state = get()
    if (!force && state.userId === userId && (state.status === 'ready' || state.status === 'loading') && loading) return loading
    set({ status: 'loading', userId })
    loading = (async () => {
      try {
        const teams = await listMyTeams(userId)
        const wanted = remembered()
        const team = teams.find((t) => t.id === (get().team?.id ?? wanted)) ?? teams[0]
        const pipeline = team ? await loadPipeline(team.id) : undefined
        if (get().userId !== userId) return
        set({ status: 'ready', error: undefined, teams, team, pipeline })
      } catch (error) {
        console.error('[crm] falha ao ler as equipes', error)
        const code = (error as { code?: string })?.code
        const noTables = code === '42P01' || code === 'PGRST205' || code === 'PGRST200'
        if (get().userId === userId) set({ status: 'error', error: noTables ? 'sem-banco' : 'falha', teams: [], team: undefined, pipeline: undefined })
      }
    })()
    return loading
  },

  select: async (teamId) => {
    const team = get().teams.find((t) => t.id === teamId)
    if (!team) return
    remember(teamId)
    set({ team, pipeline: await loadPipeline(teamId) })
  },

  setPipeline: (pipeline) => set({ pipeline }),

  rename: (name) =>
    set((s) => ({
      team: s.team ? { ...s.team, name } : s.team,
      teams: s.teams.map((t) => (t.id === s.team?.id ? { ...t, name } : t)),
    })),
}))

/**
 * A equipe e o funil abertos, para quem chama de fora da tela (a ponte do
 * agente, a Prospecção). Lê as equipes se ainda não leu.
 */
export async function crmContext(): Promise<{ team: Team; pipeline: Pipeline }> {
  let { team, pipeline, status } = useCrm.getState()
  if (!team || !pipeline || status !== 'ready') {
    const { data } = await supabase.auth.getUser()
    if (!data.user) throw new Error('Entre na conta para usar o CRM')
    await useCrm.getState().load(data.user.id)
    ;({ team, pipeline } = useCrm.getState())
  }
  if (!team) throw new Error('Esta conta não é de nenhuma equipe do CRM')
  if (!pipeline) throw new Error(`A equipe ${team.name} não tem funil`)
  return { team, pipeline }
}
