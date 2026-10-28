import type { FunnelSettings } from '@/features/prospects/funnel'
import type { Lead } from '@/features/prospects/types'

/**
 * CRM da equipe (migração 20261013150000): a empresa que vende (a equipe),
 * os clientes com contatos e linha do tempo, e as oportunidades num funil.
 * As oportunidades usam o tipo `Opportunity` do funil da Prospecção.
 */

/** `owner` criou a equipe; `admin` gerencia pessoas e funis; `seller` vende. */
export type TeamRole = 'owner' | 'admin' | 'seller'

export const ROLE_LABEL: Record<TeamRole, string> = { owner: 'Dono', admin: 'Gestor', seller: 'Vendedor' }

export const ROLE_HINT: Record<TeamRole, string> = {
  owner: 'Criou a equipe. Faz tudo.',
  admin: 'Convida e tira pessoas, cuida dos funis e apaga clientes.',
  seller: 'Cadastra e trabalha clientes, contatos e oportunidades.',
}

export const canManage = (role: TeamRole | undefined) => role === 'owner' || role === 'admin'

export interface Team {
  id: string
  name: string
  role: TeamRole
  /** Ativa ou pausada pela Avence (uma conta pausada fica sem módulos, só a Equipe segue). */
  status: 'ativa' | 'pausada'
  /** `{ instagram: false }` desliga; o que não está na lista fica ligado. */
  modules: Record<string, boolean>
  /** A conta da própria Avence: dos projetos antigos e de quem ainda não tem conta. */
  isHome: boolean
  profile: AccountProfile
}

/** Cadastro básico de uma conta (empresa-cliente). */
export interface AccountProfile {
  segment: string
  website: string
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
}

/** Uma conta no painel "Contas" da plataforma. */
export interface AccountOverview extends AccountProfile {
  id: string
  name: string
  status: 'ativa' | 'pausada'
  modules: Record<string, boolean>
  isHome: boolean
  createdAt: number
  members: number
  /** Quem olha já está dentro da conta (sem isso, "Entrar" dá acesso de suporte). */
  iAmMember: boolean
}

export interface TeamPerson {
  userId: string
  email: string
  role: TeamRole
  joinedAt: number
}

export interface TeamInvite {
  id: string
  role: Exclude<TeamRole, 'owner'>
  /** Para quem é, só para quem convidou se lembrar. */
  label: string
  createdAt: number
  expiresAt: number
}

export interface Pipeline {
  id: string
  teamId: string
  name: string
  settings: Partial<FunnelSettings>
}

export type ClientSource = 'prospeccao' | 'indicacao' | 'instagram' | 'site' | 'anuncio' | 'outro'
export type ClientStatus = 'lead' | 'cliente' | 'ex-cliente'

export const SOURCES: { id: ClientSource; label: string }[] = [
  { id: 'prospeccao', label: 'Prospecção' },
  { id: 'indicacao', label: 'Indicação' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'site', label: 'Site' },
  { id: 'anuncio', label: 'Anúncio' },
  { id: 'outro', label: 'Outro' },
]

export const STATUSES: { id: ClientStatus; label: string; hint: string }[] = [
  { id: 'lead', label: 'Lead', hint: 'Ainda não comprou.' },
  { id: 'cliente', label: 'Cliente', hint: 'Comprou e está com a gente.' },
  { id: 'ex-cliente', label: 'Ex-cliente', hint: 'Já foi cliente.' },
]

export const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label])) as Record<ClientSource, string>
export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) as Record<ClientStatus, string>

export interface Client {
  id: string
  teamId: string
  name: string
  document?: string
  website?: string
  domain?: string
  segment?: string
  city?: string
  address?: string
  phone?: string
  whatsapp?: string
  email?: string
  instagram?: string
  source: ClientSource
  status: ClientStatus
  ownerId?: string
  notes?: string
  /** Id da empresa na busca da Prospecção (`google:…`). */
  prospectKey?: string
  /** A empresa como a busca a viu (site, plataforma, anúncios, nota). */
  lead?: Lead
  createdAt: number
  updatedAt: number
}

/** O que a ficha pode mudar num cliente. */
export type ClientPatch = Partial<Omit<Client, 'id' | 'teamId' | 'prospectKey' | 'lead' | 'createdAt' | 'updatedAt'>>

export interface Contact {
  id: string
  clientId: string
  name: string
  /** Cargo ou relação ("sócia", "secretária"). */
  role?: string
  phone?: string
  whatsapp?: string
  email?: string
  notes?: string
  primary: boolean
}

export type ContactDraft = Omit<Contact, 'id' | 'clientId'>

/** `social`: um toque nas redes, anotado pela tela Social (`data.network`, `data.step`). */
export type ActivityKind = 'note' | 'call' | 'whatsapp' | 'email' | 'meeting' | 'social' | 'stage' | 'created'

/** Os registros que a pessoa escreve (etapa e entrada no funil o banco grava sozinho). */
export const NOTE_KINDS: { id: Exclude<ActivityKind, 'stage' | 'created' | 'social'>; label: string }[] = [
  { id: 'note', label: 'Nota' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'call', label: 'Ligação' },
  { id: 'email', label: 'E-mail' },
  { id: 'meeting', label: 'Reunião' },
]

export interface Activity {
  id: string
  clientId: string
  opportunityId?: string
  kind: ActivityKind
  body: string
  data: { from?: string; to?: string; network?: string; step?: string }
  createdBy?: string
  createdAt: number
}
