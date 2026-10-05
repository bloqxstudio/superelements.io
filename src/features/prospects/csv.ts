import { PLATFORM_LABEL, TEMPERATURE_LABEL } from './score.ts'
import type { Lead } from './types.ts'

const COLUMNS: [string, (lead: Lead) => string | number | undefined][] = [
  ['Nota', (l) => l.score],
  ['Temperatura', (l) => TEMPERATURE_LABEL[l.temperature]],
  ['Empresa', (l) => l.name],
  ['Nicho', (l) => l.niche],
  ['Categoria', (l) => l.category],
  ['Bairro', (l) => l.neighborhood],
  ['Cidade', (l) => l.city],
  ['Endereço', (l) => l.address],
  ['Telefone', (l) => l.phone || l.scan?.phones[0]],
  ['WhatsApp', (l) => l.scan?.whatsapp],
  ['E-mail', (l) => l.email || l.scan?.emails.join(', ')],
  ['Instagram', (l) => l.scan?.instagram],
  ['Site', (l) => l.scan?.url || l.website],
  ['Plataforma', (l) => PLATFORM_LABEL[l.scan?.platform ?? 'sem-site']],
  ['Construtor', (l) => l.scan?.builder],
  ['Versão do WordPress', (l) => l.scan?.wpVersion],
  ['Versão do Elementor', (l) => l.scan?.elementorVersion],
  ['Elementor Pro', (l) => (l.scan?.elementorPro ? 'sim' : '')],
  ['Tema', (l) => l.scan?.theme],
  ['Feito por', (l) => l.scan?.agency?.name],
  ['Site da agência', (l) => l.scan?.agency?.url],
  ['Anúncios', (l) => l.scan?.ads?.join(', ')],
  ['Vende pelo site', (l) => l.scan?.sales?.join(', ')],
  ['Serviço sugerido', (l) => l.plan],
  ['Motivos', (l) => l.reasons.join(' · ')],
  ['Nota no Google', (l) => (l.rating ? String(l.rating).replace('.', ',') : '')],
  ['Avaliações', (l) => l.reviews],
  ['Google Maps', (l) => l.mapsUrl],
  ['Fonte', (l) => (l.source === 'osm' ? 'OpenStreetMap' : l.source === 'manual' ? 'Site indicado' : 'Google Maps')],
]

const cell = (value: string | number | undefined) => {
  const text = value === undefined || value === null ? '' : String(value)
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Planilha da busca: ponto e vírgula e BOM, para o Excel em português abrir com acentos e colunas certas. */
export const leadsToCsv = (leads: Lead[]) =>
  '﻿' + [COLUMNS.map(([title]) => title), ...leads.map((lead) => COLUMNS.map(([, get]) => get(lead)))].map((row) => row.map(cell).join(';')).join('\r\n')
