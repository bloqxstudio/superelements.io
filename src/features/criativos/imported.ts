import { caseBySlug } from './library'
import type { SlideSpec } from './plan'
import { buildPost } from './templates'
import { uid, type CreativeSet, type FormatId, type SetBrand } from './types'

/**
 * Os criativos que o estúdio já tinha feito (`artifacts/criativos-arquitetos/`,
 * em HTML e PNG), refeitos nos modelos do editor: os textos são os mesmos e
 * cada post vira slides com camadas que se editam, no canvas ou pela IA. Os
 * vídeos continuam arquivos; aqui entram só os posts de imagem.
 */

const AVENCE_BRAND: SetBrand = {
  name: 'Avence Studio',
  colors: [
    { name: 'Tinta', hex: '#111111' },
    { name: 'Papel', hex: '#f3f1ec' },
    { name: 'Azul do ponto', hex: '#2b3cf0' },
    { name: 'Azul claro', hex: '#8f9bff' },
    { name: 'Pedra', hex: '#e6e2d9' },
  ],
  headingFont: 'Inter Tight',
  bodyFont: 'Inter Tight',
  logoOnLight: '/brands/avence-studio/logo/avence-wordmark-preto.png',
  logoOnDark: '/brands/avence-studio/logo/avence-wordmark-claro.png',
}

/** Qual trecho (0 a 1) da página inteira do case fica na janela, a partir da posição que o post original recortava. */
const focusAt = (slug: string, top: number, visible = 700) => {
  const page = caseBySlug(slug)?.page
  if (!page) return 0
  const total = (page.h * 1200) / page.w
  return Math.round(Math.min(1, Math.max(0, top / Math.max(1, total - visible))) * 100) / 100
}

const janela = (slug: string, title: string, label: string, top: number, dark: boolean): SlideSpec => ({ template: 'case-janela', case: slug, view: 'pagina', title, label, focus: focusAt(slug, top), dark })

const CHECK = ['Primeira tela com promessa e próximo passo', 'Cases e serviços em seções claras', 'WhatsApp e formulário em toda a página', 'Movimento no scroll, responsivo e editável em Elementor']

const COPYS = [
  { id: 'v1', kick: 'Escritórios de arquitetura', title: 'Seu portfólio *vende ou só enfeita?*', lede: 'Transformamos seu portfólio em um site que mostra cada projeto em tela cheia e leva o cliente direto ao seu WhatsApp.' },
  { id: 'v2', kick: 'Para escritórios de arquitetura', title: 'Projeto bom *chama cliente.*', lede: 'Cases em tela cheia e um caminho direto até o seu WhatsApp. Mostre o trabalho e receba mais conversas.' },
  { id: 'v3', kick: 'Para escritórios de arquitetura', title: 'Mais orçamento. *Menos explicação.*', lede: 'O site apresenta o escritório e os cases por você. O cliente chega ao WhatsApp já sabendo quem você é.' },
  { id: 'v4', kick: 'Para escritórios de arquitetura', title: 'Seu escritório *pronto para vender.*', lede: 'Site com acabamento de estúdio para apresentar seus projetos. Chame no Direct e veja a prévia antes de fechar.' },
]

const variants = (): SlideSpec[] => COPYS.flatMap((c) => [true, false].map((dark): SlideSpec => ({ template: 'manifesto', label: c.kick, title: c.title, body: c.lede, dark })))

interface Model {
  name: string
  format: FormatId
  caption?: string
  slides: SlideSpec[]
}

const MODELS: Model[] = [
  {
    name: 'Arquitetos · seu projeto é exclusivo',
    format: '4x5',
    caption: 'Você pensa na luz, nos materiais e em como cada espaço vai ser vivido. Na hora de apresentar seu escritório, esse cuidado também pode aparecer. A gente cria design e sites para dar aos seus projetos espaço, clareza e uma presença à altura do seu trabalho. Hoje, seu site transmite o que você gostaria que alguém sentisse ao conhecer seu escritório? Se quiser conversar sobre isso, me chama no direct.',
    slides: [
      { template: 'foto-manchete', title: 'Seu projeto é exclusivo, seu site também deveria ser.', body: 'Design e sites para arquitetos.', photo: '/criativos/arquitetura/base-limpa.jpg' },
    ],
  },
  {
    name: 'ProcessBase · carrossel',
    format: '4x5',
    caption: 'Um método, um site que explica. A ProcessBase precisava mostrar o Método Base com clareza e levar a conversa ao diagnóstico. A Avence fez o site, em WordPress e Elementor. Quer um site assim para o seu negócio? Chame no Direct @avencestudio.',
    slides: [
      { template: 'case-capa', case: 'processbase', label: 'Case · Consultoria de gestão', title: 'Um método, *um site que explica.*', body: 'A ProcessBase precisava mostrar o Método Base com clareza e levar a conversa ao diagnóstico. A Avence fez o site.', dark: true },
      janela('processbase', 'O logo se forma *enquanto você rola.*', 'Detalhe 01', 0, true),
      janela('processbase', 'Antes e depois, *em uma tela.*', 'Detalhe 02', 2500, false),
      janela('processbase', 'O caminho do cliente *em três passos.*', 'Detalhe 03', 3200, true),
      janela('processbase', 'Primeira tela: *promessa e próximo passo.*', 'Detalhe 04', 60, false),
      { template: 'cta', title: 'Quer um site assim *para o seu negócio?*', cta: 'Peça uma prévia', body: '@avencestudio', dark: true },
    ],
  },
  {
    name: 'Seis cases, um por vez',
    format: '4x5',
    caption: 'Seis sites no ar, seis segmentos. Cada um pensado para o cliente entender, confiar e chamar. Peça uma prévia do seu no Direct @avencestudio.',
    slides: [
      { template: 'manifesto', label: 'Sites no ar', title: 'Seis sites, *seis segmentos.*', body: 'ProcessBase, Vizor Películas, Flávia Neto, Zena Viagens, Contplan e PrexParts.', dark: false },
      janela('vizor', 'Catálogo que *ajuda a achar.*', 'Vizor Películas', 940, true),
      janela('flavia-neto', 'Um site de yoga *com cara de estúdio.*', 'Flávia Neto', 40, false),
      janela('zena-viagens', 'Viagem sob medida, *site sob medida.*', 'Zena Viagens', 40, true),
      janela('contplan', 'Contabilidade *com planos claros.*', 'Contplan', 3060, false),
      janela('prexparts', 'Catálogo por modelo, *fácil de percorrer.*', 'PrexParts', 1040, true),
      { template: 'lista', label: 'O que tem num site Avence', title: 'Feito para *o cliente chamar.*', items: CHECK, dark: false },
    ],
  },
  {
    name: 'Comercial · seu site traz cliente?',
    format: '4x5',
    caption: 'Seu site traz cliente ou só existe? Prévia antes de fechar, pagamento único pelo site e plano mensal opcional. Peça sua prévia no Direct @avencestudio.',
    slides: [
      { template: 'manifesto', label: 'Sites no ar', title: 'Seis sites no ar. *O próximo é o seu?*', body: 'Cada site pensado para o cliente entender, confiar e chamar no WhatsApp.', dark: false },
      janela('vizor', 'Cliente acha o produto, *você fecha a venda.*', 'Para quem vende produto', 940, true),
      janela('flavia-neto', 'Quem pesquisa aula *marca aula com você.*', 'Para estúdios e professores', 40, false),
      janela('zena-viagens', 'Seu site tem que *vender o seu serviço.*', 'Para quem vende serviço sob medida', 40, true),
      janela('contplan', 'Planos claros, *decisão mais rápida.*', 'Para empresas de serviço B2B', 3060, false),
      janela('prexparts', 'Catálogo organizado, *lojista que volta.*', 'Para fabricantes e lojas', 1040, true),
      { template: 'lista', label: 'Seu site hoje', title: 'Seu site traz *cliente* ou só *existe?*', items: ['O visitante entende o que você faz em 5 segundos?', 'O botão de WhatsApp aparece sem ele procurar?', 'No celular, ele chega até o orçamento?'], dark: false },
      { template: 'lista', label: 'Site novo', title: 'Seu site novo, *pago uma vez.*', items: ['Prévia do seu site antes de fechar', 'Pagamento único pelo site', 'Plano mensal opcional para cuidar dele', 'Feito em WordPress e Elementor'], dark: true },
      { template: 'lista', label: 'O que tem num site Avence', title: 'Feito para *o cliente chamar.*', items: CHECK, dark: false },
      { template: 'cta', title: 'Peça sua *prévia.*', cta: 'Peça sua prévia', body: 'Chame no Direct · @avencestudio', dark: true },
    ],
  },
  {
    name: 'Arquitetos · feed',
    format: '4x5',
    caption: 'Site de arquiteto tem que parecer projeto. Foto grande, texto curto e movimento que conduz o olhar até o contato. Quer ver uma prévia do site do seu escritório? Chama no Direct @avencestudio.',
    slides: [
      { template: 'manifesto', label: 'Site de arquiteto', title: 'Seu site tem que *fechar projeto.*', body: 'Presença digital moderna para valorizar seus projetos: cases bem apresentados, mais conversas e mais orçamentos.', dark: true },
      { template: 'manifesto', label: 'Seu portfólio hoje', title: 'Seu portfólio cabe *num PDF?*', body: 'Visita que não vira conversa é projeto que fica com outro escritório.', dark: false },
      { template: 'manifesto', label: 'Cases que vendem', title: 'Cada projeto *em tela cheia.*', body: 'O cliente entende o projeto antes de falar com você.', dark: true },
      { template: 'manifesto', label: 'Autoridade antes da conversa', title: 'Quem você é, *em uma tela.*', body: 'Quem é o escritório, o que projeta e como trabalha: claro no primeiro scroll, sem o cliente ter que adivinhar.', dark: false },
      { template: 'lista', label: 'Mais fechamentos', title: 'Mais conversa. *Mais orçamento.* Mais projeto.', items: ['WhatsApp em toda a página', 'Formulário curto', 'Cada seção leva ao contato'], dark: true },
      { template: 'cta', title: 'Veja o site do seu escritório *antes de fechar.*', cta: 'Peça uma prévia', body: '@avencestudio', dark: true },
    ],
  },
  { name: 'Arquitetos · variações de copy (feed)', format: '4x5', slides: variants() },
  { name: 'Arquitetos · variações de copy (stories)', format: '9x16', slides: variants() },
]

export const IMPORTED_NAME = 'Avence · criativos prontos'

/** Conjunto novo com todos os posts já feitos, nos modelos do editor. */
export function importedSet(): CreativeSet {
  const now = Date.now()
  return {
    id: uid(),
    name: IMPORTED_NAME,
    projectName: 'Avence Studio',
    brand: AVENCE_BRAND,
    posts: MODELS.map((m) => buildPost(m, AVENCE_BRAND)),
    assets: [],
    createdAt: now,
    updatedAt: now,
  }
}
