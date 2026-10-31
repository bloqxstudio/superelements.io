import type { Team } from './types'

/**
 * Os módulos do produto que a Avence, como admin da plataforma, liga e desliga por
 * conta (migração 20261027160000). `modules` da conta guarda só o que foi desligado
 * ou ligado de propósito: o que não está na lista fica ligado. A Equipe e a Conta
 * ficam sempre ligadas (sem elas ninguém entraria para ligar o resto).
 */

export type ModuleId = 'projetos' | 'agentes' | 'copy' | 'criativos' | 'skills' | 'crm' | 'whatsapp' | 'instagram' | 'site'

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
  { id: 'crm', label: 'CRM e Prospecção', hint: 'Oportunidades, clientes, social, prospecção e diagnóstico.', group: 'CRM', enforcedInDb: false },
  { id: 'whatsapp', label: 'WhatsApp e Fluxos', hint: 'Caixa de entrada da equipe e rotinas de contato.', group: 'CRM', enforcedInDb: true },
  { id: 'instagram', label: 'Instagram e Anúncios', hint: 'Perfil, posts, stories, caixa e anúncios da Meta.', group: 'CRM', enforcedInDb: true },
  { id: 'site', label: 'Analytics do site', hint: 'Visitas, eventos, mapa e anúncios x site.', group: 'CRM', enforcedInDb: true },
]

export const MODULE_IDS = MODULES.map((m) => m.id)

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
  if (p === '/' || p.startsWith('/projetos')) return 'projetos'
  if (p.startsWith('/agentes')) return 'agentes'
  // Plano e Conteúdos moram no módulo Copy: o banco usa o mesmo módulo (migração 20261031041728)
  if (p.startsWith('/copy') || p === '/plano' || p.startsWith('/conteudos')) return 'copy'
  if (p.startsWith('/criativos')) return 'criativos'
  if (p.startsWith('/skills')) return 'skills'
  if (p.startsWith('/crm/whatsapp') || p.startsWith('/crm/fluxos')) return 'whatsapp'
  if (p.startsWith('/crm/instagram') || p.startsWith('/crm/anuncios')) return 'instagram'
  if (p.startsWith('/crm/site')) return 'site'
  if (p === '/crm' || p.startsWith('/crm/clientes') || p.startsWith('/crm/social') || p.startsWith('/crm/diagnostico') || p.startsWith('/crm/funis') || p.startsWith('/prospeccao')) return 'crm'
  return undefined
}

/** A primeira tela que a conta ainda tem ligada, para a pessoa não ficar sem saída. */
export function firstOpenPath(team: Pick<Team, 'status' | 'modules'> | undefined): string {
  const order: [ModuleId, string][] = [['projetos', '/'], ['crm', '/crm'], ['whatsapp', '/crm/whatsapp'], ['instagram', '/crm/instagram'], ['site', '/crm/site'], ['criativos', '/criativos'], ['copy', '/copy'], ['agentes', '/agentes'], ['skills', '/skills']]
  return order.find(([id]) => moduleOn(team, id))?.[1] ?? '/crm/equipe'
}
