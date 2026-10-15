import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import type { Lead } from '@/features/prospects/types'
import { crmContext } from './crmStore'
import type { Activity, ActivityKind, Client, ClientPatch, ClientSource, ClientStatus, Contact, ContactDraft } from './types'

/** Clientes da equipe, com os contatos e a linha do tempo de cada um. */

const CLIENT_COLUMNS =
  'id, team_id, name, document, website, domain, segment, city, address, phone, whatsapp, email, instagram, source, status, owner_id, notes, prospect_key, lead, created_at, updated_at'

interface ClientRow {
  id: string
  team_id: string
  name: string
  document: string | null
  website: string | null
  domain: string | null
  segment: string | null
  city: string | null
  address: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  source: string
  status: string
  owner_id: string | null
  notes: string | null
  prospect_key: string | null
  lead: Json | null
  created_at: string
  updated_at: string
}

const or = (value: string | null) => value ?? undefined

const toClient = (row: ClientRow): Client => ({
  id: row.id,
  teamId: row.team_id,
  name: row.name,
  document: or(row.document),
  website: or(row.website),
  domain: or(row.domain),
  segment: or(row.segment),
  city: or(row.city),
  address: or(row.address),
  phone: or(row.phone),
  whatsapp: or(row.whatsapp),
  email: or(row.email),
  instagram: or(row.instagram),
  source: row.source as ClientSource,
  status: row.status as ClientStatus,
  ownerId: or(row.owner_id),
  notes: or(row.notes),
  prospectKey: or(row.prospect_key),
  lead: (row.lead ?? undefined) as unknown as Lead | undefined,
  createdAt: Date.parse(row.created_at),
  updatedAt: Date.parse(row.updated_at),
})

const clean = (value: string | undefined) => (typeof value === 'string' ? value.trim() || null : null)

/** "https://www.exemplo.com.br/x" → "exemplo.com.br" */
export const domainOf = (website: string | undefined) => {
  if (!website?.trim()) return null
  try {
    return new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

const columnsOf = (patch: ClientPatch) => {
  const row: Record<string, unknown> = {}
  for (const [key, column] of [
    ['name', 'name'],
    ['document', 'document'],
    ['website', 'website'],
    ['segment', 'segment'],
    ['city', 'city'],
    ['address', 'address'],
    ['phone', 'phone'],
    ['whatsapp', 'whatsapp'],
    ['email', 'email'],
    ['instagram', 'instagram'],
    ['notes', 'notes'],
  ] as const) {
    if (key in patch) row[column] = clean(patch[key])
  }
  if ('website' in patch) row.domain = domainOf(patch.website)
  if (patch.source) row.source = patch.source
  if (patch.status) row.status = patch.status
  if ('ownerId' in patch) row.owner_id = patch.ownerId ?? null
  return row
}

export async function listClients(): Promise<Client[]> {
  const { team } = await crmContext()
  const { data, error } = await supabase.from('crm_clients').select(CLIENT_COLUMNS).eq('team_id', team.id).order('updated_at', { ascending: false }).limit(5000)
  if (error) throw error
  return (data as ClientRow[]).map(toClient)
}

export async function getClient(id: string): Promise<Client | undefined> {
  const { data, error } = await supabase.from('crm_clients').select(CLIENT_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toClient(data as ClientRow) : undefined
}

/** O cliente da equipe com esse domínio ("exemplo.com.br"), se houver: o Diagnóstico de site não cria outro. */
export async function findClientByDomain(domain: string): Promise<Client | undefined> {
  const { team } = await crmContext()
  const { data, error } = await supabase.from('crm_clients').select(CLIENT_COLUMNS).eq('team_id', team.id).ilike('domain', domain).order('updated_at', { ascending: false }).limit(1)
  if (error) throw error
  return data?.[0] ? toClient(data[0] as ClientRow) : undefined
}

export async function createClient(fields: ClientPatch & { name: string }): Promise<Client> {
  const { team } = await crmContext()
  const { data, error } = await supabase
    .from('crm_clients')
    .insert({ team_id: team.id, ...columnsOf(fields), name: fields.name.trim() } as never)
    .select(CLIENT_COLUMNS)
    .single()
  if (error) throw error
  return toClient(data as ClientRow)
}

export async function updateClient(id: string, patch: ClientPatch): Promise<Client> {
  const { data, error } = await supabase.from('crm_clients').update(columnsOf(patch)).eq('id', id).select(CLIENT_COLUMNS).single()
  if (error) throw error
  return toClient(data as ClientRow)
}

/** Apaga o cliente com os contatos, as oportunidades e a linha do tempo (só quem gerencia). */
export async function deleteClient(id: string) {
  const { data, error } = await supabase.from('crm_clients').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Só o dono e os gestores da equipe apagam um cliente.')
}

// ---------- contatos ----------

interface ContactRow {
  id: string
  client_id: string
  name: string
  role: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  notes: string | null
  is_primary: boolean
}

const toContact = (row: ContactRow): Contact => ({
  id: row.id,
  clientId: row.client_id,
  name: row.name,
  role: or(row.role),
  phone: or(row.phone),
  whatsapp: or(row.whatsapp),
  email: or(row.email),
  notes: or(row.notes),
  primary: row.is_primary,
})

const contactColumns = (draft: Partial<ContactDraft>) => {
  const row: Record<string, unknown> = {}
  if ('name' in draft) row.name = draft.name?.trim()
  for (const key of ['role', 'phone', 'whatsapp', 'email', 'notes'] as const) if (key in draft) row[key] = clean(draft[key])
  if ('primary' in draft) row.is_primary = Boolean(draft.primary)
  return row
}

const CONTACT_COLUMNS = 'id, client_id, name, role, phone, whatsapp, email, notes, is_primary'

export async function listContacts(clientId: string): Promise<Contact[]> {
  const { data, error } = await supabase.from('crm_contacts').select(CONTACT_COLUMNS).eq('client_id', clientId).order('is_primary', { ascending: false }).order('created_at')
  if (error) throw error
  return (data as ContactRow[]).map(toContact)
}

export async function saveContact(clientId: string, draft: ContactDraft, id?: string): Promise<Contact> {
  const row = contactColumns(draft)
  const query = id
    ? supabase.from('crm_contacts').update(row).eq('id', id)
    : supabase.from('crm_contacts').insert({ client_id: clientId, ...row } as never)
  const { data, error } = await query.select(CONTACT_COLUMNS).single()
  if (error) throw error
  return toContact(data as ContactRow)
}

export async function deleteContact(id: string) {
  const { error } = await supabase.from('crm_contacts').delete().eq('id', id)
  if (error) throw error
}

// ---------- linha do tempo ----------

interface ActivityRow {
  id: string
  client_id: string
  opportunity_id: string | null
  kind: string
  body: string
  data: Json
  created_by: string | null
  created_at: string
}

const toActivity = (row: ActivityRow): Activity => ({
  id: row.id,
  clientId: row.client_id,
  opportunityId: row.opportunity_id ?? undefined,
  kind: row.kind as ActivityKind,
  body: row.body,
  data: (row.data ?? {}) as Activity['data'],
  createdBy: row.created_by ?? undefined,
  createdAt: Date.parse(row.created_at),
})

const ACTIVITY_COLUMNS = 'id, client_id, opportunity_id, kind, body, data, created_by, created_at'

export async function listActivities(clientId: string): Promise<Activity[]> {
  const { data, error } = await supabase.from('crm_activities').select(ACTIVITY_COLUMNS).eq('client_id', clientId).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data as ActivityRow[]).map(toActivity)
}

export async function addActivity(clientId: string, kind: Activity['kind'], body: string, opportunityId?: string): Promise<Activity> {
  const { data, error } = await supabase
    .from('crm_activities')
    .insert({ client_id: clientId, kind, body: body.trim(), opportunity_id: opportunityId ?? null } as never)
    .select(ACTIVITY_COLUMNS)
    .single()
  if (error) throw error
  return toActivity(data as ActivityRow)
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from('crm_activities').delete().eq('id', id)
  if (error) throw error
}
