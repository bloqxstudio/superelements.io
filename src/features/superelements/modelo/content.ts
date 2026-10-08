import { PLANS } from '../plans'

/**
 * Textos da página modelo: só o Superelements, escritos a partir de
 * brands/superelements/COPY.md e do que o app faz hoje. Nada de número,
 * cliente ou depoimento como fato; Caramelo Pet, Café Aurora e Estúdio Norte
 * são os exemplos fictícios do COPY.md.
 */

export const SX_NAV = {
  mode: 'Modo agência',
  cta: { text: 'Criar projeto', url: '/auth' },
}

/** Ícone + texto de um chip do painel; `key` é o ícone (icons.ts). */
export type Chip = [label: string, icon: string, tint: string]

export const SX_HERO = {
  title: 'O WordPress ficou simples',
  lede: 'Um espaço visual com agente que cria, organiza e publica seus sites Elementor.',
  ledeAgency: 'Todos os clientes da sua agência num espaço visual, do rascunho ao site no ar.',
  prompt: 'Descreva a página que você quer',
  promptUrl: '/auth',
  /** Os três que aparecem primeiro (empresa / agência) e os que entram na roda. */
  chips: [['Montar a Home', 'grid', '#8B5CF6'], ['Aplicar a marca', 'palette', '#D97757'], ['Publicar no site', 'upload', '#10B981']] as Chip[],
  chipsAgency: [['Novo cliente', 'users', '#3B82F6'], ['Mandar para aprovar', 'link', '#8B5CF6'], ['Publicar no site', 'upload', '#10B981']] as Chip[],
  chipPool: [
    ['Importar do site', 'download', '#3B82F6'], ['Trocar o título', 'type', '#222222'], ['Mandar para aprovar', 'link', '#8B5CF6'],
    ['Criar um componente', 'diamond', '#06B6D4'], ['Ver no celular', 'phone', '#F59E0B'], ['Gravar o vídeo', 'play', '#EF4444'],
  ] as Chip[],
  proof: {
    title: 'Elementor nativo, do começo ao fim',
    text: 'Containers e widgets de verdade, que continuam editáveis no Elementor.',
  },
  /** Com o que o Superelements trabalha (texto, não logo). */
  works: ['WordPress', 'Elementor', 'Claude', 'Codex'],
}

export const SX_SIMPLE = {
  title: 'Você pede. <br>A página fica pronta.',
  lede: 'O Superelements conecta o WordPress que você já tem, aplica a marca em todas as seções, monta páginas em Elementor nativo e publica com backup. Um agente cuida do site com você, uma seção por vez.',
}

export const SX_SPLIT = {
  left: 'Peça, o agente monta',
  right: 'você só aprova e publica',
  photo: '/sections/c25/businesses/nexo-estudio-criativo.webp',
  projects: [['Caramelo Pet', 'No site', '#10B981', '#ECFDF5'], ['Café Aurora', 'Rascunho', '#6B7280', '#F3F4F6'], ['Estúdio Norte', 'Aprovado', '#7C3AED', '#EDE9FE']] as Array<[string, string, string, string]>,
}

export interface Feature {
  id: string
  icon: string
  tint: string
  title: string
  text: string
  chips: Array<[string, string]>
  palette: number
  ask: string
  answer: string
}

export const SX_FEATURES: Feature[] = [
  {
    id: 'montar', icon: 'grid', tint: '#8B5CF6', palette: 1,
    title: 'Monte a página <br>no canvas',
    text: 'Arraste seções da biblioteca, mude a ordem e veja a página inteira de uma vez, no computador e no celular. Cada passo se desfaz com Ctrl+Z.',
    chips: [['Canvas', 'grid'], ['Biblioteca', 'stack']],
    ask: 'Monta a Home do Caramelo Pet com abertura, serviços e contato.',
    answer: 'Plano no canvas. Montando uma seção por vez.',
  },
  {
    id: 'marca', icon: 'palette', tint: '#D97757', palette: 2,
    title: 'Uma marca para <br>o site inteiro',
    text: 'Cores, fontes, logo e fotos ficam no DESIGN.md do projeto e valem para todas as seções, inclusive as que você ainda vai criar.',
    chips: [['DESIGN.md', 'page'], ['Fotos', 'image']],
    ask: 'Aplica a marca do Caramelo Pet.',
    answer: 'Pronto: cores, fontes e logo em todas as seções.',
  },
  {
    id: 'editar', icon: 'layers', tint: '#3B82F6', palette: 3,
    title: 'Edição nativa, <br>sem imagem',
    text: 'Cada seção é feita de containers e widgets do Elementor. O que sai daqui continua editável no Elementor, com as camadas organizadas no Navigator.',
    chips: [['Elementor', 'layers'], ['Navigator', 'stack']],
    ask: 'Troca o título da abertura.',
    answer: 'Feito. O resto da seção ficou como estava.',
  },
  {
    id: 'importar', icon: 'plug', tint: '#10B981', palette: 4,
    title: 'Traga o site <br>que já existe',
    text: 'Conecte o WordPress com uma senha de aplicação e importe páginas, marca e imagens. Depois, publique de volta no mesmo endereço.',
    chips: [['WordPress', 'globe'], ['Importar', 'download']],
    ask: 'Traz a página Serviços do site.',
    answer: 'Importada. As seções chegaram marcadas [do site].',
  },
  {
    id: 'aprovar', icon: 'checkCircle', tint: '#06B6D4', palette: 5,
    title: 'O cliente aprova <br>pelo link',
    text: 'O cliente abre o link sem login, vê a página com as animações e responde Aprovar ou Pedir ajuste. Cada ajuste vira uma versão nova no mesmo link.',
    chips: [['Link', 'link'], ['Sem login', 'users']],
    ask: 'Prepara a Home para o cliente aprovar.',
    answer: 'O link está pronto para você mandar.',
  },
  {
    id: 'publicar', icon: 'upload', tint: '#F59E0B', palette: 6,
    title: 'Publique sem <br>medo de errar',
    text: 'Nada vai ao ar sem o seu sim. Cada publicação guarda a versão que estava no site e avisa se alguém mudou a página no WordPress antes de você.',
    chips: [['Backup', 'history'], ['Restaurar', 'undo']],
    ask: 'Publica a Home.',
    answer: 'Publicada. A versão anterior ficou guardada.',
  },
]

export interface LibraryCard { photo: string; name: string; role: string; text: string }

export const SX_LIBRARY = {
  title: 'Seções para <br>cada negócio',
  cards: [
    { photo: 'pausa-padaria-cafe', name: 'Padaria e café', role: 'Cardápio e pedidos', text: 'Abertura com a foto do balcão, cardápio por categoria, horários e o pedido pelo WhatsApp.' },
    { photo: 'pet-daycare', name: 'Petshop e creche', role: 'Serviços e agenda', text: 'Banho, tosa e creche em cards, planos do mês e um formulário para marcar o horário.' },
    { photo: 'nexo-estudio-criativo', name: 'Estúdio criativo', role: 'Portfólio e contato', text: 'Projetos em grade, o processo em etapas e uma chamada para mandar o briefing.' },
    { photo: 'casa-serena-wellness', name: 'Bem-estar e spa', role: 'Tratamentos e reservas', text: 'Tratamentos com duração, um passo a passo da primeira visita e a reserva no fim.' },
    { photo: 'barbearia', name: 'Barbearia', role: 'Preços e horários', text: 'Tabela de cortes, a equipe, os horários da semana e o botão para agendar.' },
    { photo: 'restaurante-orla', name: 'Restaurante', role: 'Cardápio e reservas', text: 'Pratos da casa, o salão em fotos, o mapa e a reserva de mesa.' },
    { photo: 'hotel-vereda', name: 'Hotel e pousada', role: 'Quartos e reservas', text: 'Quartos lado a lado, o que está incluído, como chegar e as perguntas de quem vai reservar.' },
    { photo: 'atelie-ceramica', name: 'Ateliê', role: 'Loja e oficinas', text: 'Peças em destaque, a agenda das oficinas e a história de quem faz.' },
  ] as LibraryCard[],
}

export const SX_PLANS = {
  title: 'Escolha o seu plano',
  lede: 'O mesmo espaço em todos. Muda o número de sites, de pessoas e a hospedagem.',
  /** Funções do produto, em linhas (no celular as linhas rolam juntas). */
  features: [
    ['Canvas de páginas', 'Editor visual', 'Navigator', 'Biblioteca de seções', 'Marca do projeto', 'Banco de fotos'],
    ['Componentes', 'Importar do WordPress', 'Publicar no WordPress', 'Backup a cada publicação', 'Aviso de conflito'],
    ['Player por aparelho', 'Título e SEO da página', 'Histórico e lixeira', 'Desfazer com Ctrl+Z'],
  ],
  icons: { produto: 'page', completo: 'cloud', agencia: 'users' } as Record<string, string>,
  plans: PLANS,
  cta: 'Começar agora',
  perMonth: 'Por mês',
}

export const SX_NEWS = {
  title: 'Novidades <br>do produto',
  items: [
    { icon: 'diamond', tint: '#06B6D4', title: 'Componentes: uma seção ou camada muda em todas as páginas de uma vez.', when: 'Outubro de 2026' },
    { icon: 'history', tint: '#8B5CF6', title: 'Histórico de quem fez o quê, com lixeira de páginas e seções.', when: 'Outubro de 2026' },
    { icon: 'chat', tint: '#D97757', title: 'O agente trabalha no canvas com a seção que você selecionou.', when: 'Outubro de 2026' },
    { icon: 'wand', tint: '#3B82F6', title: 'Edição visual: inserir, arrastar e ajustar por aparelho.', when: 'Setembro de 2026' },
    { icon: 'users', tint: '#10B981', title: 'Acesso compartilhado: o cliente edita junto, com a conta dele.', when: 'Setembro de 2026' },
    { icon: 'link', tint: '#F59E0B', title: 'Link de aprovação com a página e as animações.', when: 'Setembro de 2026' },
  ],
  url: '/produto',
}

/** As mesmas perguntas da Home (09-perguntas), escritas para o Superelements. */
export const SX_FAQ = {
  title: 'Antes de <br>começar',
  items: [
    ['Preciso trocar minha hospedagem?', 'Não. O Superelements se conecta ao WordPress que já está na sua hospedagem, com uma senha de aplicação que quem administra o site aprova lá dentro.'],
    ['O site deixa de ser WordPress?', 'Não. O WordPress continua sendo seu e as páginas continuam em Elementor. O Superelements é uma camada visual de criação, organização e publicação.'],
    ['Consigo editar depois no Elementor?', 'Sim. Tudo é feito com containers e widgets nativos, e os nomes das camadas chegam organizados ao Navigator do Elementor.'],
    ['Posso trazer um site que já existe?', 'Sim. Com o WordPress conectado, você importa páginas, marca e imagens do site, trabalha nelas no canvas e publica de volta no mesmo endereço.'],
    ['O agente publica sozinho?', 'Não. Claude ou Codex montam e ajustam a página no canvas, e cada passo se desfaz com Ctrl+Z. Publicar só acontece depois que o cliente aprova a versão no link ou que você confirma.'],
    ['E se a publicação sair errada?', 'Cada atualização guarda a versão que estava no site, e dá para voltar para ela. O Superelements também avisa se alguém mudou a página no WordPress antes de você.'],
  ] as Array<[string, string]>,
}

export const SX_FOOTER = {
  trust: [
    { icon: 'layers', name: 'Elementor nativo', text: 'As páginas chegam ao WordPress em containers e widgets do Elementor, editáveis depois por quem cuida do site.' },
    { icon: 'key', name: 'Senha de aplicação', text: 'A conexão com o WordPress usa uma senha de aplicação aprovada por quem administra o site.' },
    { icon: 'history', name: 'Backup a cada publicação', text: 'O Superelements guarda a versão de antes de cada publicação feita daqui, e dá para voltar a ela.' },
    { icon: 'shield', name: 'Nada vai ao ar sozinho', text: 'Publicar depende do seu sim ou da aprovação do cliente no link. O agente não publica por conta própria.' },
  ],
  columns: [
    ['Produto', [['Canvas', '/produto'], ['Marca', '/produto'], ['Player e aprovação', '/produto'], ['Publicar', '/produto']]],
    ['Para quem', [['Empresas', '/inicio'], ['Agências', '/agencias']]],
    ['Empresa', [['Preços', '/precos'], ['Contato', '/contato']]],
    ['Suporte', [['Entrar', '/auth'], ['Criar projeto', '/auth'], ['contato@superelements.io', 'mailto:contato@superelements.io']]],
  ] as Array<[string, Array<[string, string]>]>,
  note: 'Esta página foi montada no próprio Superelements, em Elementor nativo.',
  copyright: '©2026 Superelements',
}
