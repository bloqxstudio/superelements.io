/**
 * Textos da página "Modelo · clinipago": o desenho da landing clinipago.com.br/lp/tp
 * com o conteúdo do Superelements, escrito a partir de brands/superelements/COPY.md.
 * Nada de depoimento, número de cliente ou resultado como fato: o carrossel de
 * depoimentos do original virou a biblioteca de seções. Caramelo Pet é o
 * exemplo fictício do COPY.md.
 */

export const SC_BRAND = { word: 'superelements', by: 'Espaço visual para sites WordPress' }

export const SC_CTA = { text: 'Criar meu primeiro projeto', url: '/auth' }

export const SC_HERO = {
  pill: 'Funciona com o WordPress que você já tem',
  /** Três linhas; a primeira em cinza, como no original. */
  title: ['Seu site WordPress,', 'montado e publicado', 'num espaço só'],
  lede: ['Canvas, marca, aprovação e publicação no Elementor.', 'Tudo num lugar, com um agente que monta seção por seção.'],
  note: ['Conecta ao WordPress que você já tem.', 'Nada vai ao ar sem o seu sim.'],
  photo: '/sections/c25/businesses/laboratorio-materiais.webp',
  features: [['layers', 'Elementor nativo'], ['history', 'Backup a cada publicação'], ['link', 'Aprovação pelo link']] as Array<[string, string]>,
  card: { title: 'Página publicada', when: 'agora', sub: 'Caramelo Pet · Home', value: '11 seções', status: 'No site' },
}

export const SC_BAR = { title: 'Seu site WordPress, montado num espaço só', sub: 'Conecta ao WordPress que você já tem', cta: 'Criar projeto' }

export interface ScTab { icon: string; name: string; sub: string; title: string; text: string; pill: string; badge?: string }

export const SC_TABS = {
  pill: 'Tudo num espaço só',
  title: ['Tudo o que o seu site precisa,', 'sem pular de ferramenta.'],
  lede: 'Canvas, marca, biblioteca, aprovação e publicação no mesmo projeto, um por cliente.',
  promo: {
    pill: 'Para agências',
    title: ['Todos os clientes numa conta,', 'cada um no seu projeto.'],
    text: 'Marca, páginas e WordPress de cada cliente separados, com convite para editar junto e link de aprovação.',
    cta: 'Ver o plano Agência', url: '/agencias',
  },
  tabs: [
    { icon: 'grid', name: 'Canvas', sub: 'Páginas e seções', title: 'Todas as páginas <br>numa tela só', text: 'Monte, reordene e copie seções entre páginas, e veja cada uma no computador e no celular.', pill: 'Ctrl+Z desfaz tudo' },
    { icon: 'palette', name: 'Marca', sub: 'DESIGN.md do projeto', title: 'Uma marca para <br>o site inteiro', text: 'Cores, fontes, logo e fotos num arquivo que vale para todas as seções, inclusive as novas.', pill: 'DESIGN.md' },
    { icon: 'stack', name: 'Biblioteca', sub: 'Seções prontas', title: 'Comece de uma <br>seção pronta', text: 'Seções para cada tipo de negócio, que já chegam com o estilo de título e de texto do projeto.', pill: 'Arraste para o canvas' },
    { icon: 'diamond', name: 'Componentes', sub: 'Muda em todas as páginas', title: 'Mude uma vez, <br>vale em todas', text: 'Qualquer seção ou camada vira componente. O cabeçalho e o rodapé viram os do site inteiro.', pill: 'Theme Builder', badge: 'NOVO' },
    { icon: 'link', name: 'Aprovação', sub: 'Link sem login', title: 'O cliente aprova <br>pelo link', text: 'Ele abre sem login, vê a página com as animações e responde Aprovar ou Pedir ajuste.', pill: 'Sem login' },
    { icon: 'upload', name: 'Publicar', sub: 'Com backup', title: 'Publique com <br>backup', text: 'Cada publicação guarda a versão anterior e avisa se alguém mudou a página no WordPress.', pill: 'Restaurar' },
  ] as ScTab[],
  steps: [['grid', 'Montar no canvas'], ['link', 'Aprovar pelo link'], ['upload', 'Publicar com backup']] as Array<[string, string]>,
}

export const SC_AGENT = {
  pill: 'Agente no canvas',
  title: ['Um agente que', 'trabalha em etapas'],
  text: 'Claude ou Codex montam o plano no canvas, constroem uma seção por vez e deixam cada passo no histórico. Você confere, pede ajuste e decide quando publicar.',
  head: { name: 'Agente do projeto', sub: 'Claude · Superelements', status: 'Ativo' },
  steps: [
    { tag: 'Passo 1', title: 'Plano no canvas com 10 seções', chips: [['grid', 'Canvas']] },
    { tag: 'Passo 2', title: 'Abertura e serviços montados', chips: [['grid', 'Canvas'], ['palette', 'Marca']] },
    { tag: 'Passo 3', title: 'Marca aplicada em todas as seções', chips: [['page', 'DESIGN.md']] },
    { tag: 'Passo 4', title: 'Link de aprovação pronto para o cliente', chips: [['link', 'Link'], ['phone', 'Celular']] },
    { tag: 'Com você', title: 'Publicação, depois do seu sim', chips: [['globe', 'WordPress'], ['history', 'Backup']] },
  ] as Array<{ tag: string; title: string; chips: Array<[string, string]> }>,
}

export const SC_BAND = {
  pill: 'Para empresas e agências',
  title: ['Seu próximo site', 'pode começar', 'mais organizado'],
  text: 'Crie o projeto, conecte o WordPress e monte a primeira página no canvas.',
  photo: '/sections/c25/businesses/oficina-bicicletas.webp',
  chip: 'WordPress conectado',
}

export const SC_MODULES = {
  pill: 'Um projeto por cliente',
  /** As palavras escurecem com a rolagem. */
  title: 'Marca, páginas, cliente e WordPress no mesmo projeto.',
  text: 'Um espaço visual que junta o que um site WordPress precisa, do primeiro rascunho à publicação.',
  cards: [
    ['grid', 'Monte visualmente', 'Seções da biblioteca no canvas, na ordem que quiser, com a página inteira à vista.'],
    ['palette', 'Trabalhe com a marca', 'Cores, fontes, logo e fotos valendo em todas as seções do projeto.'],
    ['layers', 'Edite de verdade', 'Containers e widgets do Elementor, com as camadas organizadas no Navigator.'],
    ['plug', 'Conecte o WordPress', 'Importe páginas, marca e imagens do site e publique de volta no mesmo endereço.'],
    ['users', 'Entregue em equipe', 'Convide o cliente para editar junto e mande o link de aprovação de cada versão.'],
    ['shield', 'Publique com segurança', 'Nada vai ao ar sem o seu sim, e cada publicação guarda a versão anterior.'],
  ] as Array<[string, string, string]>,
  more: { title: '+ o que mais vem no projeto', chips: ['Componentes', 'Histórico', 'Lixeira', 'Título e SEO', 'Player por aparelho', 'Vídeo da página'] },
  orbit: ['calendar', 'chat', 'cube', 'page', 'link', 'image', 'globe', 'palette'],
}

export const SC_LIBRARY = {
  pill: 'Biblioteca de seções',
  title: ['Seções prontas para', 'qualquer tipo de negócio.'],
  cards: [
    ['pausa-padaria-cafe', 'Padaria e café', 'Cardápio e pedidos'],
    ['pet-daycare', 'Petshop e creche', 'Serviços e agenda'],
    ['barbearia', 'Barbearia', 'Preços e horários'],
    ['estudio-moda', 'Estúdio de moda', 'Coleção e contato'],
    ['casa-serena-wellness', 'Bem-estar e spa', 'Tratamentos e reservas'],
    ['atelie-ceramica', 'Ateliê', 'Loja e oficinas'],
    ['restaurante-orla', 'Restaurante', 'Cardápio e reservas'],
    ['hotel-vereda', 'Hotel e pousada', 'Quartos e reservas'],
  ] as Array<[string, string, string]>,
}

export const SC_FAQ = {
  pill: 'Perguntas',
  title: ['Antes de', 'conectar o seu site.'],
  note: 'Ficou alguma dúvida? Escreva para contato@superelements.io.',
  items: [
    ['Preciso trocar minha hospedagem?', 'Não. O Superelements se conecta ao WordPress que já está na sua hospedagem, com uma senha de aplicação que quem administra o site aprova lá dentro.'],
    ['Consigo editar depois no Elementor?', 'Sim. Tudo é feito com containers e widgets nativos, e os nomes das camadas chegam organizados ao Navigator do Elementor.'],
    ['Posso trazer um site que já existe?', 'Sim. Com o WordPress conectado, você importa páginas, marca e imagens do site, trabalha nelas no canvas e publica de volta no mesmo endereço.'],
    ['O agente publica sozinho?', 'Não. Claude ou Codex montam e ajustam a página no canvas, e cada passo se desfaz com Ctrl+Z. Publicar só acontece depois que o cliente aprova a versão no link ou que você confirma.'],
    ['E se a publicação sair errada?', 'Cada atualização guarda a versão que estava no site, e dá para voltar para ela. O Superelements também avisa se alguém mudou a página no WordPress antes de você.'],
  ] as Array<[string, string]>,
}

export const SC_FINAL = {
  pill: 'Comece agora',
  /** Duas linhas com um ícone no meio de cada uma (marcado por {i:nome}). */
  lines: ['Crie aqui. {i:grid} Publique', 'no seu {i:globe} WordPress.'],
  text: 'Crie o projeto, conecte o site e monte a primeira página no canvas, seção por seção.',
  trust: [
    ['layers', 'Elementor', 'As páginas chegam em containers e widgets nativos, editáveis depois no Elementor.'],
    ['key', 'Senha de aplicação', 'A conexão usa uma senha de aplicação aprovada por quem administra o site.'],
    ['history', 'Backup', 'Cada publicação guarda a versão que estava no site, e dá para voltar a ela.'],
  ] as Array<[string, string, string]>,
}

export const SC_FOOTER = {
  line: 'é um espaço visual para criar, organizar e publicar sites WordPress + Elementor.',
  links: [['Produto', '/produto'], ['Preços', '/precos'], ['Contato', '/contato']] as Array<[string, string]>,
}
