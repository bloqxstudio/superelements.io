/** User-facing names only. Routes and module permissions remain unchanged. */
const AREAS: [string, string][] = [
  ['/crm/formularios', 'Formulários'], ['/crm/clientes', 'Clientes'], ['/crm/whatsapp', 'Conversas'],
  ['/crm/fluxos', 'Automações'], ['/crm/funis', 'Funis de venda'], ['/crm/equipe', 'Equipe'],
  ['/crm/social', 'Relacionamento nas redes'], ['/crm/instagram', 'Instagram'], ['/crm/anuncios', 'Anúncios'],
  ['/crm/site', 'Visitas do site'], ['/crm/diagnostico', 'Diagnóstico'], ['/crm', 'Leads'],
  ['/conteudos', 'Pauta'], ['/pauta', 'Pauta'], ['/plano', 'Cérebro · Plano da empresa'], ['/copy', 'Pauta · Textos'], ['/criativos', 'Criativos'], ['/motion', 'Criativos · Motion'], ['/sites', 'Sites'],
  ['/agentes', 'Agentes de IA'], ['/skills', 'Instruções de IA'], ['/prospeccao', 'Prospecção'],
  ['/contas', 'Contas e módulos'], ['/cerebro', 'Cérebro'], ['/quadros', 'Quadros'], ['/referencias', 'Referências'], ['/inicio', 'Início'],
]
export const workspaceTitle = (pathname: string) => AREAS.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? 'Sites'
export const normalizeNavigation = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
/** Nomes antigos e sinônimos: quem procura pelo nome de antes ainda encontra a área (2026-11-09). */
const ALIASES: [string, string][] = [
  ['/copy', 'textos copy redacao documentos conteudos'], ['/conteudos', 'conteudos lista textos copy'],
  ['/pauta', 'calendario editorial'], ['/plano', 'plano da empresa negocio briefing marca'],
  ['/cerebro', 'contexto marca notas plano'], ['/sites', 'sites em codigo astro'],
  ['/criativos', 'posts carrossel stories'], ['/referencias', 'referencias inspiracao links posts reels'], ['/motion', 'motion video animacao explicativo'],
  ['/skills', 'skills receitas'], ['/crm/whatsapp', 'whatsapp'], ['/crm/site', 'site visitas'],
]
export const navigationMatches = (query: string, label: string, path: string) => {
  const words = normalizeNavigation(query).split(/\s+/).filter(Boolean)
  const paths = path.split(' ')
  const extra = ALIASES.filter(([p]) => paths.includes(p)).map(([, a]) => a).join(' ')
  const projetos = paths.includes('/') ? 'projetos canvas' : ''
  const crm = paths.includes('/crm') ? 'oportunidades funil' : ''
  const haystack = normalizeNavigation(`${label} ${path.replace(/[-/]/g, ' ')} ${extra} ${projetos} ${crm}`)
  return words.every((word) => haystack.includes(word))
}
