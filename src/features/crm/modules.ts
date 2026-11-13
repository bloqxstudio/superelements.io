import type { Team } from './types'

/**
 * Os módulos do produto que a Avence, como admin da plataforma, liga e desliga por
 * conta (migração 20261027160000). `modules` da conta guarda só o que foi desligado
 * ou ligado de propósito: o que não está na lista fica ligado. A Equipe e a Conta
 * ficam sempre ligadas (sem elas ninguém entraria para ligar o resto).
 */

export type ModuleId = 'projetos' | 'agentes' | 'copy' | 'criativos' | 'skills' | 'crm' | 'clientes' | 'funis' | 'formularios' | 'social' | 'prospeccao' | 'diagnostico' | 'whatsapp' | 'instagram' | 'site'

export interface ModuleInfo {
  id: ModuleId
  label: string
  /** O que a pessoa perde quando está desligado, em uma frase. */
  hint: string
  group: 'Produção' | 'CRM'
  /** O banco também barra o módulo (política restritiva); os outros só somem das telas. */
  enforcedInDb: boolean
}

export const MODULES: ModuleInfo[] = [
  { id: 'projetos', label: 'Projetos', hint: 'Os sites de cliente no Space.', group: 'Produção', enforcedInDb: false },
  { id: 'agentes', label: 'Agentes', hint: 'O escritório de agentes de IA.', group: 'Produção', enforcedInDb: false },
  { id: 'copy', label: 'Copy', hint: 'Documentos de texto e tendências.', group: 'Produção', enforcedInDb: false },
  { id: 'criativos', label: 'Criativos', hint: 'Posts e stories no canvas.', group: 'Produção', enforcedInDb: false },
  { id: 'skills', label: 'Skills', hint: 'As receitas dos agentes.', group: 'Produção', enforcedInDb: false },
  { id: 'crm', label: 'Oportunidades', hint: 'O quadro de oportunidades do CRM e o recebimento de leads.', group: 'CRM', enforcedInDb: false },
  { id: 'clientes', label: 'Clientes', hint: 'Cadastro e linha do tempo dos clientes.', group: 'CRM', enforcedInDb: false },
  { id: 'funis', label: 'Funis de venda', hint: 'O mapa de funis com a jornada por etapas.', group: 'CRM', enforcedInDb: true },
  { id: 'formularios', label: 'Formulários e quizzes', hint: 'Criar, publicar e receber respostas (a página pública também para).', group: 'CRM', enforcedInDb: true },
  { id: 'social', label: 'Relacionamento nas redes', hint: 'A fila diária de social selling.', group: 'CRM', enforcedInDb: false },
  { id: 'prospeccao', label: 'Prospecção', hint: 'Busca de empresas e o funil de prospecção.', group: 'CRM', enforcedInDb: false },
  { id: 'diagnostico', label: 'Diagnóstico de site', hint: 'A leitura de um site com oferta de atualização.', group: 'CRM', enforcedInDb: false },
  { id: 'whatsapp', label: 'WhatsApp e Fluxos', hint: 'Caixa de entrada da equipe e rotinas de contato.', group: 'CRM', enforcedInDb: true },
  { id: 'instagram', label: 'Instagram e Anúncios', hint: 'Perfil, posts, stories, caixa e anúncios da Meta.', group: 'CRM', enforcedInDb: true },
  { id: 'site', label: 'Analytics do site', hint: 'Visitas, eventos, mapa e anúncios x site.', group: 'CRM', enforcedInDb: true },
]

export const MODULE_IDS = MODULES.map((m) => m.id)

/**
 * Os produtos da plataforma (migração 20261102100000). Cada conta tem um: ele decide o
 * menu e os módulos que a conta recebe ao nascer ou ao trocar de produto. Os módulos
 * continuam sendo o que libera cada área; um módulo fora do produto que o admin ligue
 * à mão aparece em "Mais", para nada ficar sem caminho.
 */
export type ProductId = 'completo' | 'resultados' | 'builder'

export interface ProductInfo {
  id: ProductId
  /** O nome que aparece para quem administra as contas. */
  label: string
  hint: string
  /** Os módulos do produto; os outros nascem desligados. */
  modules: ModuleId[]
}

export const PRODUCTS: ProductInfo[] = [
  // Conteúdo entrou na Sinfy em 2026-11-02 (o usuário: criar posts e stories para o Instagram com a ferramenta)
  { id: 'resultados', label: 'Sinfy · Resultados', hint: 'Anúncios, site, leads, conversas e conteúdo para o Instagram.', modules: ['crm', 'clientes', 'formularios', 'whatsapp', 'instagram', 'site', 'copy', 'criativos'] },
  { id: 'builder', label: 'Sinfy · Sites', hint: 'Sites no Space, criativos, textos e agentes.', modules: ['projetos', 'agentes', 'copy', 'criativos', 'skills'] },
  { id: 'completo', label: 'Completo', hint: 'Tudo, como a Avence usa.', modules: [...MODULE_IDS] },
]

export const productOf = (id: string | null | undefined): ProductId =>
  id === 'resultados' || id === 'builder' ? id : 'completo'

export const productInfo = (id: ProductId): ProductInfo => PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[PRODUCTS.length - 1]

/** Todos os módulos, ligados os do produto e desligados os outros. */
export function productModules(id: ProductId): Record<ModuleId, boolean> {
  const keep = new Set(productInfo(id).modules)
  return Object.fromEntries(MODULE_IDS.map((m) => [m, keep.has(m)])) as Record<ModuleId, boolean>
}

/** Só as chaves conhecidas, só valores verdadeiro ou falso (o que vier do banco ou de fora). */
export function cleanModules(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const id of MODULE_IDS) {
      const value = (raw as Record<string, unknown>)[id]
      if (typeof value === 'boolean') out[id] = value
    }
  }
  return out
}

/** O módulo está ligado para a conta? Sem conta aberta não há o que restringir. */
export function moduleOn(team: Pick<Team, 'status' | 'modules'> | undefined, id: ModuleId): boolean {
  if (!team) return true
  if (team.status === 'pausada') return false
  return team.modules[id] !== false
}

/** A tela de uma rota, para saber qual módulo a guarda. */
export function moduleOfPath(pathname: string): ModuleId | undefined {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/' || p.startsWith('/projetos') || p.startsWith('/sites')) return 'projetos'
  if (p.startsWith('/agentes')) return 'agentes'
  // Plano e Conteúdos moram no módulo Copy: o banco usa o mesmo módulo (migração 20261031041728)
  if (p.startsWith('/copy') || p === '/plano' || p === '/pauta' || p.startsWith('/conteudos')) return 'copy'
  if (p.startsWith('/criativos') || p.startsWith('/motion')) return 'criativos'
  if (p.startsWith('/skills')) return 'skills'
  if (p.startsWith('/crm/whatsapp') || p.startsWith('/crm/fluxos')) return 'whatsapp'
  if (p.startsWith('/crm/instagram') || p.startsWith('/crm/anuncios')) return 'instagram'
  if (p.startsWith('/crm/site')) return 'site'
  if (p.startsWith('/crm/clientes')) return 'clientes'
  if (p.startsWith('/crm/funis')) return 'funis'
  if (p.startsWith('/crm/formularios')) return 'formularios'
  if (p.startsWith('/crm/social')) return 'social'
  if (p.startsWith('/crm/diagnostico')) return 'diagnostico'
  if (p.startsWith('/prospeccao')) return 'prospeccao'
  if (p === '/crm') return 'crm'
  return undefined
}

/** A primeira tela que a conta ainda tem ligada, para a pessoa não ficar sem saída. */
export function firstOpenPath(team: (Pick<Team, 'status' | 'modules'> & Partial<Pick<Team, 'product'>>) | undefined): string {
  // A Sinfy abre pela Visão geral (o caminho do anúncio à venda), que não depende de um módulo
  if (team?.product === 'resultados' && team.status !== 'pausada') return '/inicio'
  const order: [ModuleId, string][] = [['projetos', '/'], ['crm', '/crm'], ['clientes', '/crm/clientes'], ['funis', '/crm/funis'], ['formularios', '/crm/formularios'], ['whatsapp', '/crm/whatsapp'], ['instagram', '/crm/instagram'], ['site', '/crm/site'], ['criativos', '/criativos'], ['copy', '/copy'], ['agentes', '/agentes'], ['skills', '/skills']]
  return order.find(([id]) => moduleOn(team, id))?.[1] ?? '/crm/equipe'
}
