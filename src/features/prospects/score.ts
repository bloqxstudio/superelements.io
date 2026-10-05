import type { Lead, Platform, SearchStats, SuggestedPlan, Temperature } from './types.ts'

export const PLATFORM_LABEL: Record<Platform, string> = {
  'wp-elementor': 'WordPress + Elementor',
  wordpress: 'WordPress',
  construtor: 'Outro construtor',
  outro: 'Site próprio',
  'sem-site': 'Sem site',
  'fora-do-ar': 'Fora do ar',
  indefinido: 'Não deu para ler',
}

export const TEMPERATURE_LABEL: Record<Temperature, string> = { quente: 'Quente', morna: 'Morna', fria: 'Fria' }

/**
 * Versões a partir das quais o site não conta como desatualizado
 * (outubro de 2026: WordPress 7.1 e Elementor 4.3 são as atuais).
 */
const RECENT = { wordpress: [6, 8], elementor: [3, 25] }

const older = (version: string | undefined, [major, minor]: number[]) => {
  if (!version) return false
  const [a = 0, b = 0] = version.split('.').map(Number)
  return a < major || (a === major && b < minor)
}

/** Peso de cada plataforma: quanto mais perto do que o Superelements conecta hoje, mais. */
const PLATFORM_POINTS: Record<Platform, number> = {
  'wp-elementor': 50,
  wordpress: 35,
  construtor: 20,
  'sem-site': 20,
  'fora-do-ar': 15,
  outro: 10,
  indefinido: 10,
}

type Scored = Pick<Lead, 'score' | 'temperature' | 'plan' | 'reasons'>

/**
 * Nota de 0 a 100 da oportunidade: a plataforma pesa mais (WordPress com
 * Elementor recebe o site novo no mesmo WordPress), depois os sinais de que o site
 * precisa de cuidado e, por fim, se dá para falar com a empresa.
 */
export const scoreLead = (lead: Omit<Lead, keyof Scored>, now = new Date()): Scored => {
  const scan = lead.scan
  const platform: Platform = scan?.platform ?? 'sem-site'
  let score = PLATFORM_POINTS[platform]
  const reasons: string[] = []

  if (platform === 'wp-elementor') {
    reasons.push(`Já usa WordPress + Elementor${scan?.elementorPro ? ' Pro' : ''}: o site novo entra no mesmo WordPress`)
  } else if (platform === 'wordpress') {
    reasons.push(`WordPress${scan?.builder ? ` com ${scan.builder}` : ''}, sem Elementor: o site novo entra no mesmo WordPress, em Elementor`)
  } else if (platform === 'construtor') {
    reasons.push(`Site em ${scan?.builder ?? 'construtor fechado'}: migrar para WordPress`)
  } else if (platform === 'sem-site') {
    reasons.push(scan?.builder ? `Sem site próprio, só ${scan.builder}` : 'Sem site')
  } else if (platform === 'fora-do-ar') {
    reasons.push(`Site fora do ar${scan?.error ? ` (${scan.error})` : ''}`)
  } else if (platform === 'outro') {
    reasons.push(`Site próprio${scan?.builder ? ` em ${scan.builder}` : ''}, fora do WordPress`)
  } else {
    reasons.push('O site bloqueou a leitura: conferir à mão')
  }

  if (scan && scan.status && scan.status < 400) {
    if (scan.error) {
      score += 5
      reasons.push(scan.error.charAt(0).toUpperCase() + scan.error.slice(1))
    }
    if (older(scan.wpVersion, RECENT.wordpress)) {
      score += 10
      reasons.push(`WordPress ${scan.wpVersion} desatualizado`)
    }
    if (older(scan.elementorVersion, RECENT.elementor)) {
      score += 10
      reasons.push(`Elementor ${scan.elementorVersion} desatualizado`)
    }
    if (!scan.https) {
      score += 10
      reasons.push('Sem HTTPS (navegador avisa "não seguro")')
    }
    if (!scan.viewport && platform !== 'sem-site') {
      score += 10
      reasons.push('Não se adapta ao celular')
    }
    if (scan.copyrightYear && scan.copyrightYear <= now.getFullYear() - 2) {
      score += 5
      reasons.push(`Rodapé parado em ${scan.copyrightYear}`)
    }
    if (scan.ms > 4000) {
      score += 5
      reasons.push(`Lento: ${(scan.ms / 1000).toFixed(1).replace('.', ',')} s para abrir`)
    }
  }

  // Quem paga anúncio já investe para trazer gente ao site: é o sinal mais forte de compra
  const ads = scan?.ads ?? []
  if (ads.length) {
    let adPoints = 0
    for (const ad of ads) {
      if (ad === 'Google Ads') {
        adPoints += 15
        reasons.push('Anuncia no Google: o site tem a tag de conversão do Google Ads')
      } else if (ad === 'Pixel da Meta') {
        adPoints += 10
        reasons.push('Tem o pixel da Meta: anuncia ou já anunciou no Instagram e no Facebook')
      } else if (ad === 'Tag Manager') {
        adPoints += 3
        reasons.push('Usa o Tag Manager, que pode carregar tags de anúncio')
      } else {
        adPoints += 5
        reasons.push(`Tem o ${ad}`)
      }
    }
    score += Math.min(20, adPoints)
  }
  const sales = scan?.sales ?? []
  if (sales.length) {
    score += 5
    reasons.push(`Vende pelo site: ${sales.join(', ').replace(/^./, (c) => c.toLowerCase())}`)
  }

  const email = lead.email || scan?.emails[0]
  if (email) {
    score += 10
    reasons.push('Tem e-mail para contato')
  }
  if (scan?.whatsapp) score += 5
  if (lead.phone || scan?.phones.length || scan?.whatsapp) score += 5
  if (lead.reviews && lead.reviews >= 50) {
    score += 5
    reasons.push(`Negócio movimentado: ${lead.reviews} avaliações no Google`)
  }
  if (scan?.agency) reasons.push(`Feito por ${scan.agency.name}`)

  score = Math.max(0, Math.min(100, score))
  const temperature: Temperature = score >= 70 ? 'quente' : score >= 45 ? 'morna' : 'fria'
  const plan: SuggestedPlan = platform === 'wp-elementor' || platform === 'wordpress' ? 'Redesign' : 'Site novo'
  return { score, temperature, plan, reasons }
}

/** Os números do resumo da busca (uma rede com várias unidades conta cada unidade como empresa). */
export const statsOf = (leads: Lead[]): SearchStats => ({
  businesses: leads.reduce((sum, lead) => sum + (lead.units ?? 1), 0),
  withSite: leads.filter((l) => l.scan && l.scan.platform !== 'sem-site').length,
  wordpress: leads.filter((l) => l.scan?.platform === 'wordpress' || l.scan?.platform === 'wp-elementor').length,
  elementor: leads.filter((l) => l.scan?.platform === 'wp-elementor').length,
  hot: leads.filter((l) => l.temperature === 'quente').length,
  ads: leads.filter((l) => advertises(l)).length,
})

/** Anuncia de verdade (Google Ads, pixel da Meta, TikTok, LinkedIn); só o Tag Manager não conta. */
export const advertises = (lead: Lead) => (lead.scan?.ads ?? []).some((ad) => ad !== 'Tag Manager')

/** Links para conferir se há anúncio no ar agora (quem confere é a pessoa, no navegador). */
export const adLibraryLinks = (lead: Lead) => ({
  google: lead.domain ? `https://adstransparency.google.com/?region=BR&domain=${encodeURIComponent(lead.domain)}` : undefined,
  meta: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(lead.name)}`,
})

/** Agências que aparecem no crédito do rodapé, com os sites que fizeram: público do plano Agência. */
export interface AgencyLead {
  name: string
  url?: string
  sites: Lead[]
  elementor: number
}

export const agenciesOf = (leads: Lead[]): AgencyLead[] => {
  const by = new Map<string, AgencyLead>()
  for (const lead of leads) {
    const agency = lead.scan?.agency
    if (!agency) continue
    let key = agency.name.toLowerCase()
    try {
      if (agency.url) key = new URL(agency.url).hostname.replace(/^www\./, '')
    } catch {
      // Crédito sem link válido: agrupa pelo nome
    }
    const entry = by.get(key) ?? { name: agency.name, url: agency.url, sites: [], elementor: 0 }
    entry.sites.push(lead)
    if (lead.scan?.platform === 'wp-elementor') entry.elementor++
    by.set(key, entry)
  }
  return [...by.values()].sort((a, b) => b.sites.length - a.sites.length || b.elementor - a.elementor)
}
