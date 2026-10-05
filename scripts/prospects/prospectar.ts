#!/usr/bin/env node
/**
 * Prospecção pelo terminal (a mesma busca da tela /prospeccao do app):
 *
 *   npm run prospectar -- --regiao "São Paulo, SP" --nichos advogados,psicologos
 *   npm run prospectar -- --regiao "Campinas, SP" --nichos dentistas --cobertura cidade
 *   npm run prospectar -- --regiao "São Paulo, SP" --bairros "Pinheiros;Moema" --nichos dentistas
 *   npm run prospectar -- --nichos-prontos
 *   npm run prospectar -- --site https://exemplo.com.br --nichos advogados --regiao "São Leopoldo, RS" [--nome "…"]
 *                                         (um site indicado: lê e põe na fila da página)
 *   npm run prospectar -- --fila          (empresas na fila da página, no funil)
 *
 * Salva a busca em data/prospeccao/<id>.json e a planilha ao lado (.csv),
 * e aparece na lista de buscas da tela. Fonte padrão: Google Maps lido de graça
 * (`--fonte maps`); `--fonte osm` usa o mapa aberto e `--fonte google`, a API
 * paga com a GOOGLE_PLACES_API_KEY do .env. `--cobertura cidade` varre a cidade
 * inteira em pontos (minutos por nicho); o padrão é uma busca funda no centro
 * ou em cada bairro.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { leadsToCsv } from '../../src/features/prospects/csv.ts'
import { NICHES } from '../../src/features/prospects/niches.ts'
import { PLATFORM_LABEL } from '../../src/features/prospects/score.ts'
import type { ProspectSource } from '../../src/features/prospects/types.ts'
import { leadFromSite, runSearch, saveSearch } from './engine.ts'
import { addToFunnel, readFunnel } from './funnelStore.ts'

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
    fonte: { type: 'string', default: 'maps' },
    cobertura: { type: 'string', default: 'centro' },
    'nichos-prontos': { type: 'boolean' },
    fila: { type: 'boolean' },
    site: { type: 'string' },
    nome: { type: 'string' },
  },
})

/**
 * Tudo numa função, saindo por return: process.exit no meio de um fetch derruba o
 * Node 24 no Windows ("UV_HANDLE_CLOSING"), como já se viu na ponte do Space.
 */
const main = async () => {
  if (values['nichos-prontos']) {
    for (const niche of NICHES) console.log(`${niche.id.padEnd(16)} ${niche.label}`)
    return
  }

  // Um site indicado, fora das buscas: lê o site e põe na fila da página
  if (values.site) {
    const lead = await leadFromSite(values.site, { niche: values.nichos?.split(',')[0] ?? 'advogados', name: values.nome, region: values.regiao })
    await addToFunnel([lead], { region: values.regiao ?? lead.city ?? '—', stage: 'selecionado' })
    console.log(`${lead.name} (${lead.domain}) está na fila da página.\n  id ${lead.id}\n  nota ${lead.score} · ${lead.scan?.platform}${lead.scan?.elementorVersion ? ` · Elementor ${lead.scan.elementorVersion}` : ''}\n  ${lead.reasons.join(' · ')}`)
    return
  }

  // A fila da página: o que foi marcado no funil para ganhar uma versão nova no Space
  if (values.fila) {
    const queue = (await readFunnel()).filter((o) => o.stage === 'selecionado')
    if (!queue.length) console.log('A fila está vazia: marque empresas numa busca e use "Pôr na fila da página".')
    for (const o of queue) {
      const l = o.lead
      console.log(`\n${l.name} · ${l.niche} · ${o.region}\n  id ${o.id}\n  site ${l.scan?.url ?? '—'} (${l.scan?.platform ?? 'sem site'})\n  contato ${[l.phone, l.scan?.whatsapp, l.email ?? l.scan?.emails[0], l.scan?.instagram].filter(Boolean).join(' · ') || '—'}\n  endereço ${l.address ?? '—'}`)
    }
    return
  }

  if (!values.regiao || !values.nichos) {
    console.error('Uso: npm run prospectar -- --regiao "São Paulo, SP" --nichos advogados,psicologos [--bairros "Pinheiros;Moema"] [--cobertura centro|cidade] [--fonte maps|osm|google]')
    process.exitCode = 1
    return
  }

  const source: ProspectSource = values.fonte === 'google' || values.fonte === 'osm' ? values.fonte : 'maps'
  const record = await runSearch(
    {
      region: values.regiao,
      areas: values.bairros?.split(/[;,]/),
      niches: values.nichos.split(','),
      source,
      coverage: values.cobertura === 'cidade' ? 'cidade' : 'centro',
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
    return null
  })
  if (!record) {
    process.exitCode = 1
    return
  }

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
}

await main()
