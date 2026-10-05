import type { Lead } from './types.ts'

/**
 * Funil de oportunidades: as empresas que saíram das buscas e estão sendo
 * trabalhadas, da escolha até o fechamento. Vale para a tela (`/prospeccao`,
 * aba Funil) e para o motor no Node (`scripts/prospects/funnelStore.ts`).
 */

export type Stage = 'mapeado' | 'selecionado' | 'pagina' | 'contatado' | 'conversa' | 'proposta' | 'fechado' | 'perdido'

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'mapeado', label: 'Mapeado', hint: 'Veio da busca e ainda não foi escolhido.' },
  { id: 'selecionado', label: 'Fila da página', hint: 'Escolhido para ganhar uma versão nova no Space. Peça ao Claude para rodar a fila.' },
  { id: 'pagina', label: 'Página pronta', hint: 'Versão nova no Space e vídeo para o primeiro contato.' },
  { id: 'contatado', label: 'Contatado', hint: 'Mensagem enviada, esperando resposta.' },
  { id: 'conversa', label: 'Em conversa', hint: 'Respondeu: mandar o link da página ou marcar uma conversa.' },
  { id: 'proposta', label: 'Proposta', hint: 'Plano e valor enviados.' },
  { id: 'fechado', label: 'Fechado', hint: 'Virou cliente.' },
  { id: 'perdido', label: 'Perdido', hint: 'Não quis agora. Anote o motivo.' },
]

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<Stage, string>

/** A etapa seguinte no caminho normal (fechado e perdido não avançam). */
export const nextStage = (stage: Stage): Stage | null => {
  const order: Stage[] = ['mapeado', 'selecionado', 'pagina', 'contatado', 'conversa', 'proposta', 'fechado']
  const at = order.indexOf(stage)
  return at >= 0 && at < order.length - 1 ? order[at + 1] : null
}

export interface Opportunity {
  /** O mesmo id da empresa na busca (`google:…`, `osm:…`). */
  id: string
  /** A empresa como estava na busca (contato, site, plataforma, nota). */
  lead: Lead
  searchId?: string
  /** Cidade da busca ("São Leopoldo, RS"). */
  region: string
  stage: Stage
  /** Projeto do Space com a versão nova. */
  projectName?: string
  /** Vídeo para o primeiro contato (caminho no computador ou link). */
  video?: string
  notes?: string
  nextStep?: string
  /** AAAA-MM-DD */
  nextDate?: string
  /** O serviço que vamos vender e por quanto. */
  offer?: Offer
  /** Roteiro de venda: o que falar, como ofertar e como responder. */
  brief?: SalesBrief
  history: { at: string; stage: Stage }[]
  createdAt: string
  updatedAt: string
}

/** O que a tela pode mudar numa oportunidade. */
export type OpportunityPatch = Partial<Pick<Opportunity, 'stage' | 'projectName' | 'video' | 'notes' | 'nextStep' | 'nextDate' | 'offer' | 'brief'>>

/**
 * O que vendemos é serviço, como agência: o site novo, cobrado uma vez, e um
 * plano mensal opcional para cuidar dele. Os planos do produto Superelements
 * não entram na oferta (decisão do usuário, 2026-10-03).
 */
export interface Offer {
  /** O serviço, numa ou duas frases ("Redesign do site…"). */
  service: string
  /** Valor do serviço, cobrado uma vez. Vazio: o padrão do funil. */
  price?: number
  /** Plano mensal, se houver. Vazio: o padrão do funil (que pode ser nenhum). */
  monthly?: number
}

export interface SalesBrief {
  /** O que entregamos: o que está incluído no serviço. */
  what: string
  /** Como ofertar: canal e primeira mensagem. */
  how: string
  /** A melhor forma: a sequência do contato e o que mostrar. */
  best: string
  /** O que o site novo resolve, em frases para dizer ao dono. */
  points: string
  /** Objeções prováveis e como responder. */
  objections: string
}

export const BRIEF_FIELDS: { key: keyof SalesBrief; label: string }[] = [
  { key: 'what', label: 'O que entregamos' },
  { key: 'how', label: 'Como ofertar' },
  { key: 'best', label: 'A melhor forma' },
  { key: 'points', label: 'O que o site novo resolve' },
  { key: 'objections', label: 'Objeções e respostas' },
]

/** Ajustes do funil inteiro. */
export interface FunnelSettings {
  /** Valor padrão do serviço (o site novo), em reais. */
  price: number
  /** Plano mensal padrão; 0 quando não se oferece. */
  monthly: number
  /** Meses de plano mensal que entram no valor da oportunidade. */
  months: number
}

/** O usuário citou R$ 1.000 (ou R$ 350) pelo serviço: ajustável no topo do funil. */
export const DEFAULT_SETTINGS: FunnelSettings = { price: 1000, monthly: 0, months: 12 }

/** Etapas em que a oportunidade está viva (da fila da página até a proposta). */
export const OPEN_STAGES: Stage[] = ['selecionado', 'pagina', 'contatado', 'conversa', 'proposta']

/** Valor da oportunidade: o serviço mais o plano mensal dos primeiros meses. */
export const valueOf = (o: Pick<Opportunity, 'offer'>, settings: FunnelSettings) => {
  const price = o.offer?.price ?? settings.price
  const monthly = o.offer?.monthly ?? settings.monthly
  return { price, monthly, total: price + monthly * settings.months }
}

export const money = (value: number) => `R$ ${Math.round(value).toLocaleString('pt-BR')}`
