import type React from 'react'
import { create } from 'zustand'
import { Activity, Bookmark, Bot, Brain, Building, Building2, CalendarDays, CalendarRange, Filter, Globe, Images, Instagram, KanbanSquare, LayoutTemplate, ListChecks, Megaphone, MessageCircle, PenLine, Presentation, Radar, Radio, ScanSearch, Send, Users, Wand2 } from 'lucide-react'

/**
 * A Visão geral de cada módulo (2026-11-12, o usuário: "ao entrar em Criação abre direto o Cérebro, o
 * módulo mais pesado; não vamos influenciar as pessoas a clicarem nele… podemos ter uma aba de home
 * de cada módulo? Onde dê pra ver sobre somente aquele módulo, a página que vai cair ao abrir o
 * módulo"). O menu (`AppSidebar`) monta os módulos da conta e publica aqui um resumo sem JSX; a tela
 * `/modulo/:id` (`pages/ModuleHome.tsx`) lê daqui o que mostrar.
 */

export interface ModuleSummary {
  id: string
  title: string
  hint: string
  icon: React.ElementType
  color: string
  /** As telas do módulo que a conta tem ligadas (sem a própria Visão geral). */
  items: { to: string; label: string }[]
}

export const useMenuModules = create<{ modules: ModuleSummary[] }>(() => ({ modules: [] }))

export const moduleHomePath = (id: string) => `/modulo/${id}`

/** Ícone e para que serve cada tela, nos cartões da Visão geral. */
export const SCREEN_INFO: Record<string, { icon: React.ElementType; desc: string }> = {
  '/cerebro': { icon: Brain, desc: 'Marca, fotos, plano da empresa e padrões que a IA usa para criar.' },
  '/pauta': { icon: CalendarRange, desc: 'O calendário de conteúdo: ideias, roteiros, aprovação e agenda.' },
  '/quadros': { icon: Presentation, desc: 'Canvas livre para planejar com notas, setas e imagens, ao vivo.' },
  '/referencias': { icon: Bookmark, desc: 'Posts e links guardados como inspiração para os próximos criativos.' },
  '/copy': { icon: PenLine, desc: 'Textos e roteiros da conta.' },
  '/': { icon: LayoutTemplate, desc: 'Os sites e páginas dos clientes, montados no canvas.' },
  '/criativos': { icon: Images, desc: 'Posts, carrosséis, stories e vídeos na marca da conta.' },
  '/crm': { icon: KanbanSquare, desc: 'Os contatos que chegaram e em que etapa cada um está.' },
  '/crm/whatsapp': { icon: MessageCircle, desc: 'As conversas do WhatsApp da conta.' },
  '/crm/agenda': { icon: CalendarDays, desc: 'Suas calls do Google Agenda: ver, criar com Meet e convidar o cliente.' },
  '/crm/formularios': { icon: ListChecks, desc: 'Formulários para captar contatos, com agenda e pixel.' },
  '/crm/funis': { icon: Filter, desc: 'O caminho do anúncio à venda, com os números de cada etapa.' },
  '/crm/clientes': { icon: Building2, desc: 'As empresas e pessoas que já são clientes.' },
  '/crm/social': { icon: Send, desc: 'Quem interagiu nas redes e o que responder.' },
  '/prospeccao': { icon: Radar, desc: 'Encontrar empresas por região e segmento.' },
  '/crm/diagnostico': { icon: ScanSearch, desc: 'Analisar o site de uma empresa e apontar o que melhorar.' },
  '/crm/instagram': { icon: Instagram, desc: 'Perfil, posts, testes, caixa de mensagens e stories.' },
  '/crm/anuncios': { icon: Megaphone, desc: 'Campanhas da Meta: custo, contatos e os melhores anúncios.' },
  '/crm/ao-vivo': { icon: Radio, desc: 'Quem está agora no site e nos formulários, de onde veio e em que etapa.' },
  '/crm/site': { icon: Globe, desc: 'Os ativos da empresa (site e formulários): origem, campanhas, gasto e agendamentos.' },
  '/crm/operacao': { icon: Activity, desc: 'A operação do dia: o que entrou, o que andou e o que travou.' },
  '/agentes': { icon: Bot, desc: 'Os agentes de IA desta máquina e o que cada um está fazendo.' },
  '/skills': { icon: Wand2, desc: 'As instruções que a IA segue em cada tipo de trabalho.' },
  '/crm/equipe': { icon: Users, desc: 'Quem faz parte da conta e o papel de cada um.' },
  '/contas': { icon: Building, desc: 'Todas as contas e os módulos ligados em cada uma.' },
}

/** Pedidos de partida à Iara, por módulo. */
export const MODULE_PROMPTS: Record<string, string[]> = {
  criacao: ['Monta a pauta das próximas duas semanas', 'Me dá 6 ideias de post na linha do que mais performou', 'Produz o criativo da próxima peça aprovada'],
  vendas: ['Quais leads estão parados há mais tempo?', 'Resume as conversas de hoje no WhatsApp', 'Onde o funil está perdendo mais gente?'],
  prospeccao: ['Busca empresas do meu segmento na minha cidade', 'Faz o diagnóstico do site de uma empresa', 'Quais prospects valem um primeiro contato?'],
  instagram: ['Como o perfil foi nesta semana?', 'Quais posts mais trouxeram seguidores?', 'Analisa as campanhas e diz onde cortar'],
  resultados: ['O que mudou nas visitas do site nesta semana?', 'De onde vêm os contatos que viram venda?', 'Me dá um resumo da operação de hoje'],
  ia: ['Quais agentes estão trabalhando agora?', 'Revisa as instruções de IA de criativos', 'Quem da equipe tem tarefa parada?'],
  plataforma: ['Quais contas estão com módulos desligados?'],
}
