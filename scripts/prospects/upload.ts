import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { Opportunity, FunnelSettings } from '../../src/features/prospects/funnel.ts'
import type { SearchRecord } from '../../src/features/prospects/types.ts'
import { cloudClient, getJson, putJson, shared } from './cloud.ts'
import { DEFAULT_DIR } from './engine.ts'

/**
 * Envia os dados locais sem colocar contatos no Git. Vão para a pasta
 * `prospeccao/` do bucket, que todo admin lê e grava no app publicado
 * (migração 20261012200000). Desde 2026-10-13 a tela e o terminal já gravam o
 * funil na nuvem e a tela envia cada busca ao terminar: isto fica para buscas
 * feitas pelo terminal e para cópias antigas de antes dessa data.
 */
const { data: roles, error: rolesError } = await cloudClient().from('user_roles').select('user_id').eq('role', 'admin')
if (rolesError) throw rolesError

const names = await readdir(DEFAULT_DIR)
const records: SearchRecord[] = []
for (const name of names.filter((name) => name.endsWith('.json') && !name.startsWith('funil'))) {
  records.push(JSON.parse(await readFile(path.join(DEFAULT_DIR, name), 'utf8')) as SearchRecord)
}

// Antes de 2026-10-12 cada admin tinha a própria pasta: o que estiver lá entra na compartilhada
const legacy = [...new Set(roles.map((role) => role.user_id))].map((id) => (name: string) => `${id}/prospeccao/${name}`)

await Promise.all(records.map((record) => putJson(shared(`searches/${record.id}.json`), record)))

// O funil já vive na nuvem: só nasce das cópias antigas quando ainda não existe lá. Juntar
// de novo a cada envio traria de volta os cartões que a equipe tirou do funil no site.
let seeded = 0
if (!(await getJson<Opportunity[]>(shared('funnel.json')))) {
  const merged = new Map<string, Opportunity>()
  const keepNewest = (list: Opportunity[] = []) => {
    for (const opportunity of list) {
      const current = merged.get(opportunity.id)
      if (!current || opportunity.updatedAt >= current.updatedAt) merged.set(opportunity.id, opportunity)
    }
  }
  for (const folder of legacy) keepNewest(await getJson<Opportunity[]>(folder('funnel.json')))
  keepNewest(JSON.parse(await readFile(path.join(DEFAULT_DIR, 'funil.json'), 'utf8').catch(() => '[]')) as Opportunity[])
  await putJson(shared('funnel.json'), [...merged.values()])
  seeded = merged.size
}

if (!(await getJson<Partial<FunnelSettings>>(shared('settings.json')))) {
  let seed: Partial<FunnelSettings> | undefined
  for (const folder of legacy) seed ??= await getJson<Partial<FunnelSettings>>(folder('settings.json'))
  seed ??= JSON.parse(await readFile(path.join(DEFAULT_DIR, 'funil-config.json'), 'utf8').catch(() => '{}')) as Partial<FunnelSettings>
  await putJson(shared('settings.json'), seed)
}

console.log(`Prospecção enviada para todos os admins: ${records.length} buscas${seeded ? ` e o funil, com ${seeded} oportunidades` : ' (o funil já estava na nuvem e não mudou)'}.`)
