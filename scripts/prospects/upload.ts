import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { SearchRecord } from '../../src/features/prospects/types.ts'
import { crmTarget, putJson, teamPath } from './cloud.ts'
import { DEFAULT_DIR } from './engine.ts'

/**
 * Envia as buscas deste computador para a pasta da equipe do CRM
 * (`crm/<equipe>/searches/`), sem colocar contatos no Git. A tela e o
 * terminal já enviam cada busca nova ao terminar: isto fica para as que não
 * chegaram (sem internet no fim da varredura, ou sem a chave). O funil não
 * passa por aqui: ele vive nas tabelas do CRM, e o funil antigo
 * (`prospeccao/funnel.json`) entra pela tela, em Equipe › Trazer dados de
 * antes do CRM.
 */
const { teamName } = await crmTarget()

const names = await readdir(DEFAULT_DIR)
const records: SearchRecord[] = []
for (const name of names.filter((name) => name.endsWith('.json') && !name.startsWith('funil'))) {
  records.push(JSON.parse(await readFile(path.join(DEFAULT_DIR, name), 'utf8')) as SearchRecord)
}

for (const record of records) await putJson(await teamPath(`searches/${record.id}.json`), record)

console.log(`${records.length} buscas enviadas para a equipe ${teamName}.`)
