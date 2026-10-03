#!/usr/bin/env node
/**
 * Prospecção pelo terminal (a mesma busca da tela /prospeccao do app):
 *
 *   npm run prospectar -- --regiao "São Paulo, SP" --nichos advogados,psicologos
 *   npm run prospectar -- --regiao "São Paulo, SP" --bairros "Pinheiros;Moema" --nichos dentistas --fonte google
 *   npm run prospectar -- --nichos-prontos
 *
 * Salva a busca em data/prospeccao/<id>.json e a planilha ao lado (.csv),
 * e aparece na lista de buscas da tela. Fonte padrão: OpenStreetMap (grátis);
 * `--fonte google` usa a GOOGLE_PLACES_API_KEY do .env.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { leadsToCsv } from '../../src/features/prospects/csv.ts'
import { NICHES } from '../../src/features/prospects/niches.ts'
import { PLATFORM_LABEL } from '../../src/features/prospects/score.ts'
import type { ProspectSource } from '../../src/features/prospects/types.ts'
import { runSearch, saveSearch } from './engine.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // Sem .env: só o mapa aberto
}

const { values } = parseArgs({
  options: {
    regiao: { type: 'string' },
    bairros: { type: 'string' },
    nichos: { type: 'string' },
    fonte: { type: 'string', default: 'osm' },
    'nichos-prontos': { type: 'boolean' },
  },
})

if (values['nichos-prontos']) {
  for (const niche of NICHES) console.log(`${niche.id.padEnd(16)} ${niche.label}`)
  process.exit(0)
}

if (!values.regiao || !values.nichos) {
  console.error('Uso: npm run prospectar -- --regiao "São Paulo, SP" --nichos advogados,psicologos [--bairros "Pinheiros;Moema"] [--fonte osm|google]')
  process.exit(1)
}

const source: ProspectSource = values.fonte === 'google' ? 'google' : 'osm'
const record = await runSearch(
  {
    region: values.regiao,
    areas: values.bairros?.split(/[;,]/),
    niches: values.nichos.split(','),
    source,
  },
  {
    googleKey: process.env.GOOGLE_PLACES_API_KEY,
    onEvent: (event) => {
      if (event.type === 'stage') console.error(`· ${event.text}`)
      if (event.type === 'businesses') console.error(`· ${event.count} empresas encontradas`)
      if (event.type === 'lead' && (event.done % 10 === 0 || event.done === event.total)) console.error(`· ${event.done}/${event.total} lidas`)
    },
  }
).catch((error) => {
  console.error(`Erro: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})

const file = await saveSearch(record)
const csv = file.replace(/\.json$/, '.csv')
await writeFile(csv, leadsToCsv(record.leads))

const { stats } = record
console.log(`\n${record.regionLabel}`)
console.log(`${stats.businesses} empresas · ${stats.withSite} com site · ${stats.wordpress} WordPress · ${stats.elementor} com Elementor · ${stats.hot} quentes\n`)
for (const lead of record.leads.slice(0, 20)) {
  const platform = PLATFORM_LABEL[lead.scan?.platform ?? 'sem-site']
  const version = lead.scan?.elementorVersion ? ` ${lead.scan.elementorVersion}` : ''
  console.log(`${String(lead.score).padStart(3)}  ${lead.name.slice(0, 38).padEnd(38)}  ${(platform + version).padEnd(30)}  ${lead.domain ?? ''}`)
}
for (const note of record.notes) console.log(`\nAviso: ${note}`)
console.log(`\nBusca salva: ${path.relative(root, file)}\nPlanilha: ${path.relative(root, csv)}`)
