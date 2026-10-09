import { AV_CASES, type AvCase } from '../avence/cases'
import { AV_CONTACT, avWhatsApp } from '../avence/tokens'

/**
 * Conteúdo do experimento: o do Avence Studio (`brands/avence-studio/COPY.md`).
 * Nome, trabalhos, fotos e logos do site de referência não entram (são de
 * terceiros). Os chips de cada case dizem só o que `AV_CASES` afirma: o
 * segmento, curto, e a plataforma que o código do site mostra.
 */

export interface RoCase {
  name: string
  /** letra do dado da roda da direita */
  letter: string
  segment: string
  stack: string
  url: string
  cover: string
}

const SHORT: Record<string, string> = {
  processbase: 'Consultoria',
  vizor: 'Películas',
  'flavia-neto': 'Yoga',
  'zena-viagens': 'Viagens',
  contplan: 'Contabilidade',
  prexparts: 'Peças para motos',
}

const stackShort = (c: AvCase) => (c.stack.includes('Elementor') ? 'Elementor' : c.stack)

export const RO_CASES: RoCase[] = AV_CASES.map((c) => ({
  name: c.name,
  letter: c.name.charAt(0).toUpperCase(),
  segment: SHORT[c.slug] ?? c.segment,
  stack: stackShort(c),
  url: c.url,
  cover: c.cover.path,
}))

export const RO_NAV = [
  { label: 'Cases', url: '#cases' },
  { label: 'Estúdio', url: `https://${AV_CONTACT.site}/` },
  { label: 'Instagram', url: AV_CONTACT.instagram },
  { label: 'Contato', url: avWhatsApp('um site novo') },
]

/** Faixa de leitura do topo (rótulo::valor); os valores com `live` o script atualiza. */
export const RO_HUD = [
  { key: 'SL::', value: '--:--', live: 'time' },
  { key: 'FPS::', value: '--', live: 'fps' },
  { key: 'CASES::', value: String(AV_CASES.length).padStart(2, '0') },
  { key: 'IG::', value: AV_CONTACT.instagramLabel.toUpperCase() },
] as const

export const RO_TEXT = {
  /** título só para leitores de tela e buscadores */
  h1: 'Avence Studio, sites com acabamento de estúdio, sem demora',
  cta: 'Ver projeto',
  list: 'Cases selecionados',
  wordmark: 'avence',
} as const
