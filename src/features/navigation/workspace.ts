/** User-facing names only. Routes and module permissions remain unchanged. */
const AREAS: [string, string][] = [
  ['/crm/formularios', 'Formulários'], ['/crm/clientes', 'Clientes'], ['/crm/whatsapp', 'WhatsApp'],
  ['/crm/fluxos', 'Automações'], ['/crm/funis', 'Funis de venda'], ['/crm/equipe', 'Equipe'],
  ['/crm/social', 'Relacionamento nas redes'], ['/crm/instagram', 'Instagram'], ['/crm/anuncios', 'Anúncios'],
  ['/crm/site', 'Site'], ['/crm/diagnostico', 'Diagnóstico'], ['/crm', 'Oportunidades'],
  ['/conteudos', 'Conteúdos'], ['/plano', 'Plano da empresa'], ['/copy', 'Textos'], ['/criativos', 'Criativos'], ['/sites', 'Sites em código'],
  ['/agentes', 'Agentes de IA'], ['/skills', 'Instruções de IA'], ['/prospeccao', 'Prospecção'],
  ['/contas', 'Contas e módulos'], ['/cerebro', 'Cérebro'], ['/quadros', 'Quadros'], ['/inicio', 'Início'],
]
export const workspaceTitle = (pathname: string) => AREAS.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? 'Projetos'
export const normalizeNavigation = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
export const navigationMatches = (query: string, label: string, path: string) => {
  const words = normalizeNavigation(query).split(/\s+/).filter(Boolean)
  const haystack = normalizeNavigation(`${label} ${path.replace(/[-/]/g, ' ')} ${path.startsWith('/copy') ? 'copy redacao documentos' : ''} ${path.startsWith('/skills') ? 'skills receitas' : ''}`)
  return words.every((word) => haystack.includes(word))
}
