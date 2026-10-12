import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import type { Opportunity, FunnelSettings } from '../../src/features/prospects/funnel.ts'
import type { SearchRecord } from '../../src/features/prospects/types.ts'
import { DEFAULT_DIR } from './engine.ts'

/** Envia os dados locais sem colocar contatos no Git. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = { ...loadEnv('', root, ''), ...loadEnv('development', root, '') }
const url = env.VITE_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const email = env.DEV_AUTH_EMAIL
if (!url || !key || !email) throw new Error('Faltam VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou DEV_AUTH_EMAIL')

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (usersError) throw usersError
const configured = users.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
const { data: roles, error: rolesError } = await supabase.from('user_roles').select('user_id').eq('role', 'admin')
if (rolesError) throw rolesError
const admins = users.users.filter((candidate) => roles.some((role) => role.user_id === candidate.id))
const user = configured && admins.some((admin) => admin.id === configured.id) ? configured : admins.length === 1 ? admins[0] : undefined
if (!user) throw new Error('Não foi possível escolher uma única conta administradora para receber os dados')

const names = await readdir(DEFAULT_DIR)
const records: SearchRecord[] = []
for (const name of names.filter((name) => name.endsWith('.json') && !name.startsWith('funil'))) {
  records.push(JSON.parse(await readFile(path.join(DEFAULT_DIR, name), 'utf8')) as SearchRecord)
}

const bucket = supabase.storage.from('space-projects')
const put = async (name: string, value: unknown) => {
  const { error } = await bucket.upload(`${user.id}/prospeccao/${name}`, new Blob([JSON.stringify(value)], { type: 'application/json' }), {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw error
}

await Promise.all(records.map((record) => put(`searches/${record.id}.json`, record)))

const opportunities = JSON.parse(await readFile(path.join(DEFAULT_DIR, 'funil.json'), 'utf8').catch(() => '[]')) as Opportunity[]
await put('funnel.json', opportunities)

const settings = JSON.parse(await readFile(path.join(DEFAULT_DIR, 'funil-config.json'), 'utf8').catch(() => '{}')) as Partial<FunnelSettings>
await put('settings.json', settings)

console.log(`Prospecção enviada: ${records.length} buscas e ${opportunities.length} oportunidades.`)
