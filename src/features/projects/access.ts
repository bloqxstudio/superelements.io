import { supabase } from '@/integrations/supabase/client'
import { publicAppUrl } from '@/features/approval/shares'
import type { ProjectRole } from './types'

/**
 * Acesso compartilhado a um projeto. O dono cria um convite (um link que vale
 * para uma pessoa, por 7 dias); quem abre entra com a própria conta e passa a
 * editar o projeto junto, WordPress incluído. O id do convite é o segredo.
 */

export interface ProjectPerson {
  userId: string
  email: string
  role: ProjectRole
  joinedAt: number
}

export interface ProjectInvite {
  id: string
  /** Para quem é, só para o dono se lembrar. */
  label: string
  createdAt: number
  expiresAt: number
}

export const inviteUrl = (id: string) => `${publicAppUrl()}/convite/${id}`

/** Nome curto a partir do e-mail: "rafael.silva@x.com" vira "rafael.silva". */
export const personName = (email: string) => email.split('@')[0] || email

/** O dono primeiro, depois quem entrou, na ordem em que entrou. */
export async function listPeople(projectId: string): Promise<ProjectPerson[]> {
  const { data, error } = await supabase.rpc('space_project_people', { p_project: projectId })
  if (error) throw error
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role === 'owner' ? 'owner' : 'editor',
    joinedAt: Date.parse(row.joined_at),
  }))
}

/** Convites ainda não usados, o mais novo primeiro (os vencidos também, para o dono cancelar). */
export async function listInvites(projectId: string): Promise<ProjectInvite[]> {
  const { data, error } = await supabase
    .from('space_project_invites')
    .select('id, label, created_at, expires_at')
    .eq('project_id', projectId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((row) => ({ id: row.id, label: row.label, createdAt: Date.parse(row.created_at), expiresAt: Date.parse(row.expires_at) }))
}

export async function createInvite(projectId: string, label: string): Promise<ProjectInvite> {
  const { data, error } = await supabase
    .from('space_project_invites')
    .insert({ project_id: projectId, label: label.trim().slice(0, 120) })
    .select('id, label, created_at, expires_at')
    .single()
  if (error) throw error
  return { id: data.id, label: data.label, createdAt: Date.parse(data.created_at), expiresAt: Date.parse(data.expires_at) }
}

export async function cancelInvite(id: string) {
  const { error } = await supabase.from('space_project_invites').delete().eq('id', id)
  if (error) throw error
}

/** O dono tira alguém, ou a pessoa sai do projeto. */
export async function removePerson(projectId: string, userId: string) {
  const { error } = await supabase.from('space_project_members').delete().eq('project_id', projectId).eq('user_id', userId)
  if (error) throw error
}

// Quem abriu o link do convite

export type InviteStatus = 'valid' | 'member' | 'used' | 'expired'

export interface PublicInvite {
  projectName: string
  invitedBy: string
  expiresAt: number
  status: InviteStatus
  /** Só vem quando quem abriu já tem acesso. */
  projectId?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** O convite aberto; undefined se ele não existe (ou foi cancelado). */
export async function getInvite(id: string): Promise<PublicInvite | undefined> {
  if (!UUID.test(id)) return undefined
  const { data, error } = await supabase.rpc('get_space_invite', { p_id: id })
  if (error) throw error
  if (!data) return undefined
  const row = data as { project_id: string | null; project_name: string; invited_by: string; expires_at: string; status: InviteStatus }
  return {
    projectName: row.project_name,
    invitedBy: row.invited_by,
    expiresAt: Date.parse(row.expires_at),
    status: row.status,
    projectId: row.project_id ?? undefined,
  }
}

export type AcceptError = 'convite_inativo' | 'convite_usado' | 'convite_expirado' | 'login_necessario' | 'erro'

export async function acceptInvite(id: string): Promise<{ projectId: string } | { error: AcceptError }> {
  const { data, error } = await supabase.rpc('accept_space_invite', { p_id: id })
  if (error) {
    const known = (['convite_inativo', 'convite_usado', 'convite_expirado', 'login_necessario'] as const).find((code) => error.message.includes(code))
    return { error: known ?? 'erro' }
  }
  return { projectId: String(data) }
}

// Convite guardado enquanto a pessoa entra ou cria a conta (o Google e a
// confirmação por e-mail voltam para a raiz do app, sem o endereço do convite)

const PENDING_KEY = 'superelements-convite'

export function rememberInvite(id: string) {
  try {
    localStorage.setItem(PENDING_KEY, id)
  } catch {
    // Sem armazenamento: depois de entrar, a pessoa abre o link de novo
  }
}

export function pendingInvite() {
  try {
    return localStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

export function forgetInvite() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // Nada guardado
  }
}
