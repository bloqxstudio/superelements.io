import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

/**
 * Central de relacionamento (CRM › WhatsApp): os telefones de clientes que podem
 * escrever para o número da Avence e ver os dados da própria conta. O serviço
 * (`services/whatsapp/src/clientes.ts`) lê esta tabela; a conta de cada telefone
 * vem daqui, nunca da mensagem. Só o admin da plataforma cadastra (o banco recusa
 * o resto); gestores da Avence leem.
 */

// As tabelas ainda não estão nos tipos gerados do Supabase
const db = supabase as unknown as SupabaseClient

export type AccessTopic = 'site' | 'anuncios' | 'funil' | 'instagram' | 'posts' | 'caixa' | 'projetos'
export const ACCESS_TOPICS: { id: AccessTopic; label: string }[] = [
  { id: 'site', label: 'Site' },
  { id: 'anuncios', label: 'Anúncios' },
  { id: 'funil', label: 'Funil' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'posts', label: 'Melhores posts' },
  { id: 'caixa', label: 'Comentários e DMs' },
  { id: 'projetos', label: 'Projetos' },
]

export interface ClientContact {
  phone: string
  accountId: string
  name: string
  topics: AccessTopic[]
  enabled: boolean
  /** Recebe o resumo agendado (diário e semanal) com os dados da conta */
  reports: boolean
}

export interface ClientQuestion {
  id: string
  accountId: string
  phone: string
  question: string
  topic?: string
  answered: boolean
  at: number
}

const missing = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205'
export const NO_TABLE = 'no_tables'

const fail = (error: { code?: string; message: string }) => new Error(missing(error) ? NO_TABLE : error.message)

export async function listContacts(teamId: string): Promise<ClientContact[]> {
  const { data, error } = await db.from('crm_whatsapp_client_contacts').select('phone, account_id, name, topics, enabled, reports').eq('team_id', teamId).order('created_at')
  if (error) throw fail(error)
  return (data ?? []).map((r) => ({ phone: r.phone, accountId: r.account_id, name: r.name, topics: r.topics, enabled: r.enabled, reports: r.reports ?? false }))
}

export async function listQuestions(teamId: string): Promise<ClientQuestion[]> {
  const { data, error } = await db.from('crm_whatsapp_client_log').select('id, account_id, phone, question, topic, answered, created_at').eq('team_id', teamId).order('created_at', { ascending: false }).limit(15)
  if (error) throw fail(error)
  return (data ?? []).map((r) => ({ id: r.id, accountId: r.account_id, phone: r.phone, question: r.question, topic: r.topic ?? undefined, answered: r.answered, at: Date.parse(r.created_at) }))
}

/** Telefone digitado do jeito que vier → só dígitos, com o país (sem ele, Brasil) */
export function cleanPhone(text: string): string | undefined {
  const digits = text.replace(/\D/g, '')
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
  return /^[0-9]{10,15}$/.test(full) ? full : undefined
}

export async function saveContact(teamId: string, contact: ClientContact) {
  const { error } = await db
    .from('crm_whatsapp_client_contacts')
    .upsert({ team_id: teamId, phone: contact.phone, account_id: contact.accountId, name: contact.name.trim(), topics: contact.topics, enabled: contact.enabled, reports: contact.reports }, { onConflict: 'team_id,phone' })
  if (error) throw fail(error)
}

export async function removeContact(teamId: string, phone: string) {
  const { error } = await db.from('crm_whatsapp_client_contacts').delete().eq('team_id', teamId).eq('phone', phone)
  if (error) throw fail(error)
}
