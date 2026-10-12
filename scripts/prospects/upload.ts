import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import type { Opportunity, FunnelSettings } from '../../src/features/prospects/funnel.ts'
import type { SearchRecord } from '../../src/features/prospects/types.ts'
import { DEFAULT_DIR } from './engine.ts'

/**
 * Envia os dados locais sem colocar contatos no Git. Vão para a pasta
 * `prospeccao/` do bucket, que todo admin lê e grava no app publicado
 * (migração 20261012200000).
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = { ...loadEnv('', root, ''), ...loadEnv('development', root, '') }
const url = env.VITE_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: roles, error: rolesError } = await supabase.from('user_roles').select('user_id').eq('role', 'admin')
if (rolesError) throw rolesError

const names = await readdir(DEFAULT_DIR)
const records: SearchRecord[] = []
for (const name of names.filter((name) => name.endsWith('.json') && !name.startsWith('funil'))) {
  records.push(JSON.parse(await readFile(path.join(DEFAULT_DIR, name), 'utf8')) as SearchRecord)
}

const bucket = supabase.storage.from('space-projects')
const put = async (name: string, value: unknown) => {
  const { error } = await bucket.upload(name, new Blob([JSON.stringify(value)], { type: 'application/json' }), {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw error
}
const get = async <T,>(name: string): Promise<T | undefined> => {
  const { data, error } = await bucket.download(name)
  if (error) return undefined
  return JSON.parse(await data.text()) as T
}
const shared = (name: string) => `prospeccao/${name}`
// Antes de 2026-10-12 cada admin tinha a própria pasta: o que estiver lá entra na compartilhada
const legacy = [...new Set(roles.map((role) => role.user_id))].map((id) => (name: string) => `${id}/prospeccao/${name}`)

await Promise.all(records.map((record) => put(shared(`searches/${record.id}.json`), record)))

const merged = new Map<string, Opportunity>()
const keepNewest = (list: Opportunity[] = []) => {
  for (const opportunity of list) {
    const current = merged.get(opportunity.id)
    if (!current || opportunity.updatedAt >= current.updatedAt) merged.set(opportunity.id, opportunity)
  }
}
for (const folder of legacy) keepNewest(await get<Opportunity[]>(folder('funnel.json')))
keepNewest(await get<Opportunity[]>(shared('funnel.json')))
keepNewest(JSON.parse(await readFile(path.join(DEFAULT_DIR, 'funil.json'), 'utf8').catch(() => '[]')) as Opportunity[])
await put(shared('funnel.json'), [...merged.values()])

if (!(await get(shared('settings.json')))) {
  let settings: Partial<FunnelSettings> | undefined
  for (const folder of legacy) settings ??= await get<Partial<FunnelSettings>>(folder('settings.json'))
  settings ??= JSON.parse(await readFile(path.join(DEFAULT_DIR, 'funil-config.json'), 'utf8').catch(() => '{}')) as Partial<FunnelSettings>
  await put(shared('settings.json'), settings)
}

console.log(`Prospecção enviada para todos os admins: ${records.length} buscas e ${merged.size} oportunidades.`)
