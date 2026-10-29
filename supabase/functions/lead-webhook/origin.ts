import type { ParsedLead } from './parse.ts'

/** A origem guardada na oportunidade (`crm_opportunities.origin`) e o texto do aviso no WhatsApp. */

export type AdReports = { preset: string; data: any; fetched_at: string }[]

export interface CampaignSnapshot {
  /** `meta` quando achamos a campanha nos relatórios da Meta; `utm` quando só temos o nome do link */
  from: 'meta' | 'utm'
  id?: string
  name: string
  status?: string
  objective?: string
  /** Período do relatório de onde saíram os números */
  preset?: string
  since?: string | null
  until?: string | null
  currency?: string
  spend?: number
  impressions?: number
  linkClicks?: number
  leads?: number
  conversations?: number
  result?: { type: string; value: number; cost?: number }
  adset?: string
  ad?: string
  fetchedAt?: string
}

const PRESET_ORDER = ['last_30d', 'this_month', 'last_90d', 'last_7d']
const same = (a: unknown, b: string) => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase()

/** Acha a campanha do lead (pelo id ou pelo nome do link) no relatório mais útil da conta */
export function campaignSnapshot(reports: AdReports, lead: ParsedLead): CampaignSnapshot | undefined {
  const label = lead.utm.campaign
  const ids = [lead.ids.campaignId, lead.utm.id].filter(Boolean) as string[]
  if (!label && !ids.length) return undefined
  const sorted = [...reports].sort((a, b) => PRESET_ORDER.indexOf(a.preset) - PRESET_ORDER.indexOf(b.preset))
  for (const report of sorted) {
    const campaigns: any[] = Array.isArray(report.data?.campaigns) ? report.data.campaigns : []
    const hit =
      campaigns.find((c) => ids.some((id) => c.id === id)) ??
      (label ? campaigns.find((c) => c.id === label || same(c.name, label)) : undefined) ??
      (label && label.length >= 5 ? campaigns.find((c) => typeof c.name === 'string' && c.name.toLowerCase().includes(label.toLowerCase())) : undefined)
    if (!hit) continue
    const m = hit.metrics ?? {}
    const ads: any[] = Array.isArray(report.data?.ads) ? report.data.ads : []
    const ad = lead.utm.content ? ads.find((a) => same(a.name, lead.utm.content!) || a.id === lead.ids.adId) : undefined
    return {
      from: 'meta',
      id: hit.id,
      name: hit.name,
      status: hit.status,
      objective: hit.objective,
      preset: report.preset,
      since: report.data?.since ?? null,
      until: report.data?.until ?? null,
      currency: report.data?.currency ?? 'BRL',
      spend: m.spend,
      impressions: m.impressions,
      linkClicks: m.linkClicks,
      leads: m.leads,
      conversations: m.conversations,
      result: hit.result,
      adset: lead.utm.term,
      ad: ad?.name ?? lead.utm.content,
      fetchedAt: report.fetched_at,
    }
  }
  return label ? { from: 'utm', name: label, adset: lead.utm.term, ad: lead.utm.content } : undefined
}

export function leadOrigin(lead: ParsedLead, campaign: CampaignSnapshot | undefined, hash: string) {
  const strip = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v))
  return {
    channel: lead.channel,
    paid: lead.paid,
    receivedAt: new Date().toISOString(),
    hash,
    page: lead.page,
    referrer: lead.referrer,
    form: lead.form,
    utm: strip(lead.utm),
    clickIds: strip(lead.clickIds),
    ids: strip(lead.ids),
    campaign,
    fields: lead.fields,
  }
}

const PRESET_LABEL: Record<string, string> = { last_7d: 'últimos 7 dias', last_30d: 'últimos 30 dias', last_90d: 'últimos 90 dias', this_month: 'este mês' }
const STATUS: Record<string, string> = { ACTIVE: 'ativa', PAUSED: 'pausada', ARCHIVED: 'arquivada', DELETED: 'apagada' }

export const presetLabel = (preset?: string) => (preset ? PRESET_LABEL[preset] ?? preset : '')

const money = (value: number, currency = 'BRL') => {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency })
  } catch {
    return `R$ ${value.toFixed(2)}`
  }
}

/** O cartão do novo contato, como chega no WhatsApp (`{id}` vira o id da oportunidade na hora de gravar) */
export function alertText(lead: ParsedLead, campaign: CampaignSnapshot | undefined, link: string): string {
  const lines = ['*🔔 Novo lead*', '']
  lines.push(`*${lead.name ?? 'Sem nome'}*`)
  if (lead.phone) lines.push(`📱 ${lead.phone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')}`)
  if (lead.email) lines.push(`✉️ ${lead.email}`)
  if (lead.message) lines.push('', `💬 "${lead.message.slice(0, 400)}"`)
  lines.push('', `📍 Origem: ${lead.channel}${lead.utm.medium ? ` · ${lead.utm.medium}` : ''}`)
  if (campaign) {
    const status = campaign.status ? ` (${STATUS[campaign.status] ?? campaign.status.toLowerCase()})` : ''
    lines.push(`📣 Campanha: ${campaign.name}${status}`)
    if (campaign.adset) lines.push(`   Conjunto: ${campaign.adset}`)
    if (campaign.ad) lines.push(`   Anúncio: ${campaign.ad}`)
    if (campaign.from === 'meta' && campaign.spend !== undefined) {
      const bits = [`Gasto ${money(campaign.spend, campaign.currency)} (${presetLabel(campaign.preset)})`]
      if (campaign.result?.value) bits.push(`${campaign.result.value} resultados${campaign.result.cost ? ` a ${money(campaign.result.cost, campaign.currency)}` : ''}`)
      else if (campaign.leads) bits.push(`${campaign.leads} leads`)
      lines.push(`   ${bits.join(' · ')}`)
    }
  }
  if (lead.page) lines.push(`🔗 Página: ${lead.page.replace(/^https?:\/\/(www\.)?/, '').slice(0, 120)}`)
  lines.push('', `Abrir no CRM: ${link}`)
  return lines.join('\n')
}
