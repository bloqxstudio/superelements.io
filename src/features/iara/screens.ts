import { matchPath } from 'react-router-dom'

/**
 * A Iara sabe onde a pessoa está (2026-11-05, o usuário: "quero que a Iara saiba em qual tela estamos
 * e o que queremos fazer, me dê contexto daquela tela, veja o que eu estou procurando"). Cada tela
 * do produto tem aqui o nome, para que serve e o que as pessoas costumam querer fazer nela; e
 * `readScreen` lê, da própria página, o que está à vista agora: o título, a aba e o período
 * escolhidos, filtros ligados, o que foi digitado nas buscas, um diálogo aberto e o começo do
 * texto. Também guarda as últimas telas por onde a pessoa passou (o caminho até aqui).
 */

export interface ScreenInfo {
  name: string
  /** Para que serve, numa frase (vai para a Iara e para a tela vazia da conversa). */
  purpose: string
  /** O que costumam querer fazer aqui: viram sugestões na conversa vazia. */
  suggestions: string[]
}

const SCREENS: Array<[string, ScreenInfo]> = [
  ['/inicio', { name: 'Início', purpose: 'o resumo do caminho anúncio → site → contato → venda da conta', suggestions: ['Me explica o que mudou nos números desta semana', 'Onde estamos perdendo mais gente no caminho?', 'Que três coisas eu faço hoje para vender mais?'] }],
  ['/projetos/:projectId', { name: 'Projeto no Space', purpose: 'o canvas com as páginas do site do cliente, para criar e ajustar seções', suggestions: ['Revise os títulos desta página e diga o que melhorar', 'Crie uma seção de perguntas frequentes no fim da página', 'Deixe a primeira dobra mais clara no celular'] }],
  ['/sites/:siteId', { name: 'Editor de site em código', purpose: 'o editor visual de um site Astro: prévia do astro dev, o elemento escolhido com arquivo e linha, e a publicação pelo GitHub', suggestions: ['Deixa o elemento escolhido mais destacado no celular', 'Cria uma seção de perguntas frequentes antes do rodapé', 'Revisa os textos desta página e melhora os títulos'] }],
  ['/sites', { name: 'Sites (em código)', purpose: 'os sites em Astro ligados por repositório do GitHub, para editar e publicar', suggestions: ['Liga o repositório do site da Vizor', 'Qual site tem edição sem publicar?'] }],
  ['/', { name: 'Sites', purpose: 'os sites da conta montados no canvas (um projeto por cliente); a aba Em código tem os sites em Astro', suggestions: ['Qual projeto está mais atrasado?', 'Abre o projeto do site principal', 'Cria um projeto novo para um cliente'] }],
  ['/plano', { name: 'Cérebro · Plano da empresa', purpose: 'a aba de negócio do Cérebro, o plano de conteúdo da empresa: oferta, público, tom, pilares e restrições', suggestions: ['Revise o Plano e diga o que está fraco', 'Sugira pilares de conteúdo a partir da oferta', 'Escreve o público ideal com base no que já postamos'] }],
  ['/pauta', { name: 'Pauta', purpose: 'o calendário editorial: ideias, peças com data e horário, aprovação do gestor e do cliente', suggestions: ['Gera 6 ideias para as próximas duas semanas', 'Monta a pauta das próximas duas semanas, terças e quintas às 18h', 'O que está parado esperando aprovação?'] }],
  ['/conteudos/:id', { name: 'Conteúdo', purpose: 'um conteúdo do plano: ideia, roteiro, legenda e o criativo ligado', suggestions: ['Escreve o roteiro deste conteúdo', 'Produz o criativo deste conteúdo', 'Melhora o gancho da primeira frase'] }],
  ['/conteudos', { name: 'Pauta (lista)', purpose: 'a Pauta em lista: os conteúdos da conta, por etapa', suggestions: ['Escreve o roteiro das ideias que estão sem roteiro', 'Quais conteúdos estão parados há mais tempo?', 'Cria 5 ideias novas na linha dos que mais performaram'] }],
  ['/criativos/:setId', { name: 'Editor de criativos', purpose: 'o editor de um conjunto de posts: slides, camadas, marca e motion', suggestions: ['Critique o design deste post e ajuste o que estiver fraco', 'Cria 3 posts parecidos com este, sobre outros temas', 'Aprende o padrão visual deste conjunto'] }],
  ['/criativos', { name: 'Criativos', purpose: 'os conjuntos de posts, carrosséis e stories da conta', suggestions: ['Mostra os conjuntos mais recentes', 'Cria um carrossel novo sobre a oferta principal', 'Qual conjunto ainda tem posts sem aprovação?'] }],
  ['/motion/:setId/video', { name: 'Estúdio de vídeo', purpose: 'um vídeo da conta (animação em código ou roteiro e voz): prévia, campos de texto, cor e efeito, narração em partes e legenda', suggestions: ['Olha este vídeo e diz o que está fraco', 'Liga a legenda karaokê', 'Usa o nosso logo de verdade na abertura e no fecho', 'Narra de novo com a voz cedar'] }],
  ['/motion/:setId/cena', { name: 'Motion avançado', purpose: 'a cena em código de um criativo animado', suggestions: ['Deixa o motion mais dinâmico', 'Sugere uma coreografia para este post'] }],
  ['/motion/:setId', { name: 'Estúdio de motion', purpose: 'a linha do tempo de animação de um post', suggestions: ['Anima este post no estilo Dinâmico', 'Deixa a entrada do título mais forte'] }],
  ['/motion', { name: 'Vídeos', purpose: 'todos os vídeos da conta, com capa: animações a partir de referência e vídeos com roteiro e voz', suggestions: ['Cria um vídeo a partir da última referência com estrela', 'Quais vídeos estão sem narração?'] }],
  ['/copy/:docId', { name: 'Documento de texto', purpose: 'um documento de copy (textos de página, anúncio ou e-mail)', suggestions: ['Revise este texto e deixe mais direto', 'Escreve 3 versões do título'] }],
  ['/copy', { name: 'Pauta · Textos', purpose: 'os documentos de copy da conta (aba Textos da Pauta)', suggestions: ['Escreve um anúncio para a oferta principal', 'Cria um e-mail de reengajamento'] }],
  ['/crm/clientes/:clientId', { name: 'Cliente', purpose: 'a ficha de um cliente: contatos, oportunidades e a linha do tempo', suggestions: ['Resume a história deste cliente', 'Qual o próximo passo com ele?', 'Escreve uma mensagem de retomada para ele'] }],
  ['/crm/clientes', { name: 'Clientes', purpose: 'a lista de clientes e leads', suggestions: ['Quais clientes estão sem contato há mais tempo?', 'Quem são os leads mais quentes?'] }],
  ['/crm/equipe', { name: 'Equipe', purpose: 'as pessoas da conta, papéis e convites', suggestions: ['Como convido alguém para a equipe?'] }],
  ['/crm/social', { name: 'Social', purpose: 'a fila do dia de social selling (seguir, comentar, primeira mensagem)', suggestions: ['O que tem na minha fila de hoje?', 'Escreve um comentário para a próxima empresa da fila'] }],
  ['/crm/diagnostico', { name: 'Diagnóstico de site', purpose: 'a leitura de um site (plataforma, contato, o que o Google vê) e a oferta', suggestions: ['Diagnostica o site que eu colar', 'Escreve a primeira mensagem para este site'] }],
  ['/crm/instagram', { name: 'Instagram', purpose: 'o perfil da conta: números, posts, stories, caixa de comentários e DMs, análise e anúncios', suggestions: ['O que mais performou nos últimos 30 dias e por quê?', 'Me dá 6 ideias na linha do que mais performou', 'Quais comentários estão sem resposta?'] }],
  ['/crm/anuncios', { name: 'Anúncios', purpose: 'as campanhas da Meta: gasto, resultados e anúncios', suggestions: ['Quais campanhas eu pauso ou escalo?', 'Qual anúncio tem o melhor custo por resultado?', 'Cria variações do anúncio que mais funciona'] }],
  ['/crm/operacao', { name: 'Operação', purpose: 'o caminho ao vivo: quem está no site, as etapas e as vendas', suggestions: ['Onde as pessoas estão travando agora?', 'Resume o dia de hoje'] }],
  ['/crm/site', { name: 'Visitas do site', purpose: 'as visitas do site: origens, páginas, cliques, contatos, mapa e anúncios × site', suggestions: ['De onde vêm as visitas que viram contato?', 'Quais páginas mais perdem gente?', 'Como foi hoje comparado a ontem?'] }],
  ['/crm/whatsapp', { name: 'Conversas (WhatsApp)', purpose: 'as conversas do número da equipe, etiquetas e envio', suggestions: ['Quais conversas estão esperando resposta?', 'Resume as conversas quentes de hoje'] }],
  ['/crm/fluxos', { name: 'Fluxos', purpose: 'os fluxos de mensagens de prospecção e atendimento e a rotina do dia', suggestions: ['Quem está na rotina de hoje?', 'Melhora as mensagens do fluxo de prospecção'] }],
  ['/crm/formularios/:id', { name: 'Formulário', purpose: 'o editor de um formulário ou quiz: perguntas, agenda, pixel e o funil ao vivo', suggestions: ['Onde mais gente desiste deste formulário?', 'Melhora as perguntas para qualificar melhor'] }],
  ['/crm/formularios', { name: 'Formulários', purpose: 'os formulários e quizzes de captação', suggestions: ['Qual formulário converte melhor?', 'Cria um quiz de qualificação para a oferta'] }],
  ['/crm/funis/:id', { name: 'Funil', purpose: 'um funil de vendas com as etapas e os números', suggestions: ['Onde este funil mais perde?', 'O que eu mudo para melhorar a etapa mais fraca?'] }],
  ['/crm/funis', { name: 'Funis', purpose: 'os funis da conta', suggestions: ['Compara os funis do mês', 'Cria um funil anúncio → formulário → oportunidade → venda', 'Onde o funil principal mais perde?'] }],
  ['/crm', { name: 'Leads', purpose: 'o quadro das oportunidades de venda por etapa', suggestions: ['Quais oportunidades estão paradas há mais tempo?', 'Qual o valor em aberto e onde ele está?', 'Escreve o próximo passo das que estão sem'] }],
  ['/prospeccao', { name: 'Prospecção', purpose: 'as buscas de empresas por cidade e nicho, com nota de oportunidade', suggestions: ['Quais empresas da última busca anunciam?', 'Põe as melhores no funil'] }],
  ['/agentes', { name: 'Agentes', purpose: 'os agentes da máquina e as rotinas', suggestions: ['Quais rotinas estão ligadas?'] }],
  ['/skills', { name: 'Skills', purpose: 'as skills (instruções) que os agentes seguem', suggestions: ['Cria uma skill com o tom da nossa marca'] }],
  ['/sugestoes', { name: 'Sugestões do produto', purpose: 'as sugestões de melhoria enviadas ao time de produto', suggestions: ['Quais sugestões chegaram esta semana?'] }],
  ['/cerebro', { name: 'Cérebro', purpose: 'a base de conhecimento da empresa aberta: quem é, o que vende, produtos com fotos, decisões e logs, mais o cadastro, o Plano, a marca e os criativos da conta (pasta Da plataforma)', suggestions: ['Preencha a visão geral da empresa com o que você já sabe', 'Monte a nota de produtos e serviços', 'O que ainda falta saber sobre esta empresa?'] }],
  ['/quadros/:boardId', { name: 'Quadro', purpose: 'um quadro livre estilo Miro/FigJam (notas adesivas, colunas, formas, setas, imagens) para planejar e ter ideias rápidas, ao vivo com a equipe', suggestions: ['Organiza estas notas em colunas por tema', 'Faz um brainstorm de 12 ideias de post aqui', 'Transforma este quadro em ideias na Pauta'] }],
  ['/referencias', { name: 'Referências', purpose: 'as referências visuais da conta (links de posts, carrosséis, vídeos e motion do Instagram e de outras redes), com o que aproveitar de cada uma; as com estrela vão no contexto de criação', suggestions: ['Cria 3 criativos na linha das referências com estrela', 'Quais padrões se repetem nas melhores referências?', 'Transforma as melhores referências em ideias na Pauta'] }],
  ['/quadros', { name: 'Quadros', purpose: 'os quadros livres da conta (estilo Miro/FigJam), em branco ou por modelo', suggestions: ['Cria um quadro de plano de campanha para a oferta principal', 'Monta um brainstorm de conteúdos do mês', 'Resume o que está no último quadro'] }],
  ['/contas', { name: 'Contas', purpose: 'as contas de clientes da plataforma e os módulos de cada uma', suggestions: ['Quais contas estão com módulos desligados?'] }],
  ['/perfil', { name: 'Meu perfil', purpose: 'nome, foto, e-mail, senha e sessões da pessoa', suggestions: [] }],
]

/** A tela do endereço (a mais específica que casa). */
export function screenOf(pathname: string): ScreenInfo | undefined {
  for (const [pattern, info] of SCREENS) if (matchPath({ path: pattern, end: true }, pathname)) return info
  return undefined
}

const PARAM_LABEL: Record<string, string> = {
  aba: 'Aba',
  periodo: 'Período',
  oportunidade: 'Oportunidade aberta',
  projeto: 'Projeto',
  numero: 'Número',
  busca: 'Busca',
  q: 'Busca',
  post: 'Post',
  motion: 'Motion',
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const textOf = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** O que está à vista na página agora (fora a própria Iara). */
export interface ScreenSnapshot {
  path: string
  info?: ScreenInfo
  heading?: string
  /** Aba, período, filtros, buscas, diálogo aberto: o que a pessoa escolheu ou procurou. */
  looking: string[]
  /** O começo do texto da página, para a Iara saber o que está aparecendo. */
  text: string
}

const outsideIara = (el: Element) => !el.closest('[data-iara-panel]')

export function readScreen(): ScreenSnapshot {
  const { pathname, search } = window.location
  const info = screenOf(pathname)
  const looking: string[] = []
  const root = document.querySelector('main') ?? document.body

  // O endereço: aba, período, o que veio aberto
  new URLSearchParams(search).forEach((value, key) => {
    const label = PARAM_LABEL[key]
    if (label && value) looking.push(`${label}: ${clip(value, 60)}`)
  })

  // Abas e botões escolhidos
  const picked = [...root.querySelectorAll('[role="tab"][aria-selected="true"], [aria-current="page"], [role="radio"][aria-checked="true"], [aria-pressed="true"]')]
    .filter(outsideIara)
    .map((el) => textOf(el))
    .filter((t) => t && t.length <= 40)
  const uniquePicked = [...new Set(picked)].slice(0, 8)
  if (uniquePicked.length) looking.push(`Escolhido na tela: ${uniquePicked.join(' · ')}`)

  // O que foi digitado em buscas e filtros
  const typed = [...root.querySelectorAll<HTMLInputElement>('input[type="search"], input[type="text"], input:not([type])')]
    .filter((el) => outsideIara(el) && el.value.trim() && (el.type === 'search' || /busc|procur|filtr|pesquis|search/i.test(`${el.placeholder} ${el.getAttribute('aria-label') ?? ''} ${el.name}`)))
    .map((el) => `"${clip(el.value.trim(), 60)}"`)
  if (typed.length) looking.push(`Procurando: ${[...new Set(typed)].slice(0, 3).join(', ')}`)

  // Selects com valor (período, ordem)
  const selects = [...root.querySelectorAll<HTMLSelectElement>('select')]
    .filter(outsideIara)
    .map((el) => textOf(el.selectedOptions[0]))
    .filter(Boolean)
  if (selects.length) looking.push(`Seleções: ${[...new Set(selects)].slice(0, 4).join(' · ')}`)

  // Um diálogo ou painel aberto por cima
  const dialog = [...document.querySelectorAll('[role="dialog"]')].filter(outsideIara).at(-1)
  const dialogTitle = dialog ? textOf(dialog.querySelector('h1, h2, h3, [data-dialog-title]')) : ''
  if (dialogTitle) looking.push(`Aberto por cima: ${clip(dialogTitle, 80)}`)

  const heading = textOf([...root.querySelectorAll('h1, h2')].find(outsideIara)) || undefined

  // O começo do texto da página, sem a Iara
  const clone = root.cloneNode(true) as Element
  clone.querySelectorAll('[data-iara-panel], script, style, svg, nav').forEach((n) => n.remove())
  const text = clip(textOf(clone), 1500)

  return { path: pathname + search, info, heading: heading ? clip(heading, 100) : undefined, looking, text }
}

/**
 * O texto que a pessoa selecionou na página (fora da Iara). Clicar na caixa da Iara desfaz a
 * seleção do navegador, então guardamos a última por 2 minutos, na mesma tela.
 */
let picked: { text: string; path: string; at: number } | undefined
if (typeof document !== 'undefined') {
  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection()
    const text = sel?.toString().replace(/\s+/g, ' ').trim() ?? ''
    const node = sel?.anchorNode
    const el = node instanceof Element ? node : node?.parentElement
    if (!text || !el || el.closest('[data-iara-panel]') || el.closest('input, textarea')) return
    picked = { text: text.slice(0, 600), path: window.location.pathname, at: Date.now() }
  })
}
export function pickedText(): string {
  if (!picked || picked.path !== window.location.pathname || Date.now() - picked.at > 120_000) return ''
  return picked.text
}
export const clearPickedText = () => {
  picked = undefined
}

/** O caminho até aqui: as últimas telas por onde a pessoa passou (só nesta aba). */
const trail: string[] = []
export function rememberScreen(pathname: string) {
  const name = screenOf(pathname)?.name ?? pathname
  if (trail.at(-1) !== name) trail.push(name)
  if (trail.length > 6) trail.shift()
}
export const screenTrail = () => [...trail]

/** O texto que vai para a Iara a cada mensagem. */
export function describeScreen(snapshot = readScreen()): string {
  const lines = [
    `Endereço: ${snapshot.path}`,
    snapshot.info ? `Tela: ${snapshot.info.name}, ${snapshot.info.purpose}.` : 'Tela sem descrição no catálogo.',
    snapshot.heading ? `Título na página: ${snapshot.heading}` : '',
    ...snapshot.looking,
    pickedText() ? `Texto que a pessoa selecionou na página: "${pickedText()}"` : '',
    trail.length > 1 ? `Caminho até aqui: ${trail.join(' → ')}` : '',
    snapshot.text ? `O que aparece na página (começo): ${snapshot.text}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}
