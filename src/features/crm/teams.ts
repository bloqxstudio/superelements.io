import { supabase } from '@/integrations/supabase/client'
import { publicAppUrl } from '@/features/approval/shares'
import type { Team, TeamInvite, TeamPerson, TeamRole } from './types'

/**
 * A equipe do CRM e o acesso a ela pela plataforma: quem gerencia cria um
 * convite (um link que vale para uma pessoa, por 7 dias, já com o papel), a
 * pessoa abre, entra com a conta dela e passa a ver o CRM e a Prospecção da
 * equipe. O id do convite é o segredo.
 */

const role = (value: string): TeamRole => (value === 'owner' || value === 'admin' ? value : 'seller')

/** As equipes de quem está logado, a mais antiga primeiro. */
export async function listMyTeams(userId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('crm_team_members')
    .select('role, created_at, team:crm_teams(id, name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .map((row) => {
      const team = row.team as unknown as { id: string; name: string } | null
      return team ? { id: team.id, name: team.name, role: role(row.role) } : null
    })
    .filter((team): team is Team => team !== null)
}

/** Só o admin da plataforma cria uma equipe; ela já nasce com o funil "Prospecção". */
export async function createTeam(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_crm_team', { p_name: name.trim() })
  if (error) throw new Error(error.message.includes('so_admin_cria_equipe') ? 'Só o admin da plataforma cria uma equipe.' : error.message)
  return String(data)
}

export async function renameTeam(id: string, name: string) {
  const { error } = await supabase.from('crm_teams').update({ name: name.trim() }).eq('id', id)
  if (error) throw error
}

/** O dono primeiro, depois os gestores e os vendedores, na ordem em que entraram. */
export async function listPeople(teamId: string): Promise<TeamPerson[]> {
  const { data, error } = await supabase.rpc('crm_team_people', { p_team: teamId })
  if (error) throw error
  return (data ?? []).map((row) => ({ userId: row.user_id, email: row.email, role: role(row.role), joinedAt: Date.parse(row.joined_at) }))
}

export async function setPersonRole(teamId: string, userId: string, next: Exclude<TeamRole, 'owner'>) {
  const { error } = await supabase.from('crm_team_members').update({ role: next }).eq('team_id', teamId).eq('user_id', userId)
  if (error) throw error
}

/** Quem gerencia tira alguém, ou a pessoa sai da equipe. O dono não sai. */
export async function removePerson(teamId: string, userId: string) {
  const { error } = await supabase.from('crm_team_members').delete().eq('team_id', teamId).eq('user_id', userId)
  if (error) throw new Error(error.message.includes('dono_fixo') ? 'O dono não sai da equipe.' : error.message)
}

const toInvite = (row: { id: string; role: string; label: string; created_at: string; expires_at: string }): TeamInvite => ({
  id: row.id,
  role: row.role === 'admin' ? 'admin' : 'seller',
  label: row.label,
  createdAt: Date.parse(row.created_at),
  expiresAt: Date.parse(row.expires_at),
})

/** Convites ainda não usados, o mais novo primeiro (os vencidos também, para cancelar). */
export async function listInvites(teamId: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from('crm_team_invites')
    .select('id, role, label, created_at, expires_at')
    .eq('team_id', teamId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toInvite)
}

export async function createInvite(teamId: string, label: string, inviteRole: Exclude<TeamRole, 'owner'>): Promise<TeamInvite> {
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('crm_team_invites')
    .insert({ team_id: teamId, label: label.trim().slice(0, 120), role: inviteRole, created_by: auth.user?.id })
    .select('id, role, label, created_at, expires_at')
    .single()
  if (error) throw error
  return toInvite(data)
}

export async function cancelInvite(id: string) {
  const { error } = await supabase.from('crm_team_invites').delete().eq('id', id)
  if (error) throw error
}

export const teamInviteUrl = (id: string) => `${publicAppUrl()}/equipe/convite/${id}`

// Quem abriu o link do convite

export type TeamInviteStatus = 'valid' | 'member' | 'used' | 'expired'

export interface PublicTeamInvite {
  teamName: string
  role: Exclude<TeamRole, 'owner'>
  invitedBy: string
  expiresAt: number
  status: TeamInviteStatus
  /** Só vem quando quem abriu já é da equipe. */
  teamId?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** O convite aberto; undefined se ele não existe (ou foi cancelado). */
export async function getTeamInvite(id: string): Promise<PublicTeamInvite | undefined> {
  if (!UUID.test(id)) return undefined
  const { data, error } = await supabase.rpc('get_crm_invite', { p_id: id })
  if (error) throw error
  if (!data) return undefined
  const row = data as { team_id: string | null; team_name: string; role: string; invited_by: string; expires_at: string; status: TeamInviteStatus }
  return {
    teamName: row.team_name,
    role: row.role === 'admin' ? 'admin' : 'seller',
    invitedBy: row.invited_by,
    expiresAt: Date.parse(row.expires_at),
    status: row.status,
    teamId: row.team_id ?? undefined,
  }
}

export type TeamAcceptError = 'convite_inativo' | 'convite_usado' | 'convite_expirado' | 'login_necessario' | 'erro'

export async function acceptTeamInvite(id: string): Promise<{ teamId: string } | { error: TeamAcceptError }> {
  const { data, error } = await supabase.rpc('accept_crm_invite', { p_id: id })
  if (error) {
    const known = (['convite_inativo', 'convite_usado', 'convite_expirado', 'login_necessario'] as const).find((code) => error.message.includes(code))
    return { error: known ?? 'erro' }
  }
  return { teamId: String(data) }
}

// Convite guardado enquanto a pessoa entra ou cria a conta (o Google e a
// confirmação por e-mail voltam para a raiz do app, sem o endereço do convite)

const PENDING_KEY = 'superelements-convite-equipe'

export function rememberTeamInvite(id: string) {
  try {
    localStorage.setItem(PENDING_KEY, id)
  } catch {
    // Sem armazenamento: depois de entrar, a pessoa abre o link de novo
  }
}

export function pendingTeamInvite() {
  try {
    return localStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

export function forgetTeamInvite() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // Nada guardado
  }
}
