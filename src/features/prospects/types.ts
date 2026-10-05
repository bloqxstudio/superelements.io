/**
 * Prospecção: empresas de uma região e de um nicho, com o que o site delas
 * usa (WordPress, Elementor, outro construtor ou nada) e a nota de
 * oportunidade para o Superelements. Estes tipos valem para o motor
 * (`scripts/prospects/engine.ts`, Node) e para a tela (`/prospeccao`).
 */

/**
 * De onde vêm as empresas: o Google Maps lido como o navegador lê (`maps`, grátis),
 * o mapa aberto (`osm`, grátis, cobre pouco) ou a API do Google (`google`, chave paga).
 */
export type ProspectSource = 'maps' | 'osm' | 'google'

/** `centro`: uma busca funda no centro da cidade (ou em cada bairro); `cidade`: varre a cidade em pontos. */
export type Coverage = 'centro' | 'cidade'

/** O que o site da empresa é, do melhor encaixe para o Superelements ao pior. */
export type Platform =
  | 'wp-elementor'
  | 'wordpress'
  | 'construtor'
  | 'outro'
  | 'sem-site'
  | 'fora-do-ar'
  | 'indefinido'

export type Temperature = 'quente' | 'morna' | 'fria'

/** O serviço que faz sentido oferecer: vendemos como agência, não os planos do produto. */
export type SuggestedPlan = 'Redesign' | 'Site novo'

export interface SearchInput {
  /** Cidade, com ou sem UF: "São Paulo, SP". */
  region: string
  /** Bairros da cidade, um por busca (mais resultados no Google, que para em 60 por busca). */
  areas?: string[]
  /** Ids de `NICHES` ou um nicho escrito à mão ("clínica de fertilidade"). */
  niches: string[]
  source: ProspectSource
  /** Só no Google Maps grátis; sem bairros. Padrão: `centro`. */
  coverage?: Coverage
}

/** A empresa como a fonte entrega, antes de ler o site. */
export interface Business {
  id: string
  /** `manual`: um site indicado à mão, fora das buscas. */
  source: ProspectSource | 'manual'
  name: string
  /** Rótulo do nicho pesquisado ("Advogados"). */
  niche: string
  /** Categoria que a fonte deu ("Advogado", "Clínica odontológica"). */
  category?: string
  address?: string
  neighborhood?: string
  city?: string
  phone?: string
  email?: string
  website?: string
  rating?: number
  reviews?: number
  mapsUrl?: string
}

/** O que a primeira página do site mostrou. */
export interface SiteScan {
  /** Endereço final, depois dos redirecionamentos. */
  url: string
  status: number | null
  error?: string
  https: boolean
  ms: number
  platform: Platform
  /** Elementor, WPBakery, Divi, Wix, Instagram, Doctoralia… */
  builder?: string
  wpVersion?: string
  elementorVersion?: string
  elementorPro?: boolean
  theme?: string
  title?: string
  emails: string[]
  phones: string[]
  whatsapp?: string
  instagram?: string
  facebook?: string
  linkedin?: string
  /** Crédito do rodapé ("Desenvolvido por …"): a agência que fez o site. */
  agency?: { name: string; url?: string }
  copyrightYear?: number
  viewport: boolean
  /** Rastros de anúncio pago na página: tag de conversão do Google Ads, pixel da Meta… (sinal de que investe em trazer gente). */
  ads?: string[]
  /** Ferramentas de venda no site: agenda online, checkout de programa ou curso, loja. */
  sales?: string[]
}

export interface Lead extends Business {
  domain?: string
  scan?: SiteScan
  /** Outras unidades da mesma empresa na busca (mesmo site). */
  units?: number
  score: number
  temperature: Temperature
  plan: SuggestedPlan
  /** Por que a nota é essa, em frases curtas para quem vai ligar. */
  reasons: string[]
}

export interface SearchStats {
  businesses: number
  withSite: number
  wordpress: number
  elementor: number
  hot: number
  /** Empresas com rastro de anúncio pago no site. */
  ads?: number
}

export interface SearchRecord {
  id: string
  createdAt: string
  /** Nome de uma lista montada a partir de outra busca ("Advogados com Elementor"). */
  label?: string
  input: SearchInput
  /** Nome da região como o mapa entendeu ("São Paulo, Região Sudeste, Brasil"). */
  regionLabel?: string
  leads: Lead[]
  stats: SearchStats
  /** Avisos da busca (bairro não encontrado, mapa lento…). */
  notes: string[]
}

/** Resumo de uma busca salva, para a lista. */
export type SearchSummary = Pick<SearchRecord, 'id' | 'createdAt' | 'label' | 'input' | 'regionLabel' | 'stats'>

/** O que a busca conta enquanto roda (uma linha de JSON por evento). */
export type SearchEvent =
  | { type: 'stage'; text: string }
  | { type: 'businesses'; count: number }
  | { type: 'lead'; lead: Lead; done: number; total: number }
  | { type: 'done'; record: SearchRecord }
  | { type: 'error'; message: string }
