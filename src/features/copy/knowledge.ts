import type { BlockType, FormatId } from './types.ts'

/**
 * A inteligência de copy da empresa: os formatos de conteúdo (como cada um se
 * estrutura), os frameworks de escrita, as fórmulas de gancho, os nichos que
 * atendemos (dores, desejos, objeções, linguagem e regras do conselho de cada
 * profissão) e a voz da Avence. Os agentes recebem só o que o pedido usa. Sem
 * imports de `@/`: o servidor lê este arquivo.
 */

export type FormatGroup = 'Redes sociais' | 'Site e páginas' | 'Campanhas' | 'Mensagens' | 'Conteúdo longo' | 'Pesquisa' | 'Livre'

export interface FormatSpec {
  id: FormatId
  label: string
  group: FormatGroup
  /** Uma linha: para que serve. */
  hint: string
  /** Para onde o texto pode seguir. */
  sendTo?: 'criativos' | 'projetos'
  /** Como estruturar em blocos (o que o agente recebe). */
  structure: string
  /** Os blocos de um documento novo (o esqueleto), por tipo e rótulo. */
  skeleton: { type: BlockType; label?: string; text?: string }[]
  /** Pesquisa na web por padrão. */
  web?: boolean
}

export const FORMATS: FormatSpec[] = [
  {
    id: 'post-instagram',
    label: 'Post de feed',
    group: 'Redes sociais',
    hint: 'Uma imagem ou um carrossel curto, com legenda.',
    sendTo: 'criativos',
    structure:
      'Rótulo "Gancho": a frase da capa (até 10 palavras). Depois um bloco por slide (rótulo "Slide 2", "Slide 3"…): título curto (até 8 palavras) e uma frase de apoio. Último slide: chamada para uma ação. Por fim, rótulo "Legenda": primeira linha forte, o desenvolvimento em frases curtas e o convite final, com até 4 hashtags.',
    skeleton: [
      { type: 'hook', label: 'Gancho' },
      { type: 'p', label: 'Slide 2' },
      { type: 'p', label: 'Slide 3' },
      { type: 'cta', label: 'Último slide' },
      { type: 'p', label: 'Legenda' },
    ],
  },
  {
    id: 'carrossel',
    label: 'Carrossel viral',
    group: 'Redes sociais',
    hint: 'Análise em 7 a 10 slides: tese, pontos, dado e fecho.',
    sendTo: 'criativos',
    structure:
      'Slide 1 (rótulo "Capa"): gancho que surpreende ou faz uma pergunta que a pessoa quer ver respondida, até 10 palavras. Slides do meio (um por bloco, rótulo "Ponto 1", "Ponto 2"…): um assunto por slide, título de até 12 palavras e uma frase. Inclua um slide de dado ("Dado") só com número que o briefing trouxe, um de insight ("Insight") e o fecho ("Fecho": salvar, enviar, seguir). Termine com a legenda ("Legenda").',
    skeleton: [
      { type: 'hook', label: 'Capa' },
      { type: 'h2', label: 'Ponto 1' },
      { type: 'h2', label: 'Ponto 2' },
      { type: 'h2', label: 'Ponto 3' },
      { type: 'quote', label: 'Insight' },
      { type: 'cta', label: 'Fecho' },
      { type: 'p', label: 'Legenda' },
    ],
  },
  {
    id: 'story',
    label: 'Sequência de stories',
    group: 'Redes sociais',
    hint: '5 a 7 telas que conduzem a uma conversa.',
    sendTo: 'criativos',
    structure:
      'Uma tela por bloco (rótulo "Tela 1"…"Tela 7"), cada uma com no máximo 20 palavras, em linguagem de conversa. Tela 1 prende (pergunta ou afirmação); as do meio desenvolvem uma ideia cada; a última convida a responder, clicar no link ou chamar no WhatsApp. Indique entre colchetes a figura (enquete, caixa de perguntas, link) quando fizer sentido.',
    skeleton: [
      { type: 'hook', label: 'Tela 1' },
      { type: 'p', label: 'Tela 2' },
      { type: 'p', label: 'Tela 3' },
      { type: 'p', label: 'Tela 4' },
      { type: 'cta', label: 'Última tela' },
    ],
  },
  {
    id: 'reels',
    label: 'Roteiro de vídeo curto',
    group: 'Redes sociais',
    hint: 'Reels, TikTok ou Shorts: gancho nos 3 primeiros segundos.',
    structure:
      'Rótulo "Gancho (0–3 s)": a fala e o que aparece. Depois uma cena por bloco (rótulos "Cena 2"…): o que se vê e a fala, em frases que cabem em um fôlego. Rótulo "Chamada": o que a pessoa faz depois. Rótulo "Legenda": curta, com até 3 hashtags. Duração total entre 20 e 45 segundos.',
    skeleton: [
      { type: 'hook', label: 'Gancho (0–3 s)' },
      { type: 'p', label: 'Cena 2' },
      { type: 'p', label: 'Cena 3' },
      { type: 'cta', label: 'Chamada' },
      { type: 'p', label: 'Legenda' },
    ],
  },
  {
    id: 'linkedin',
    label: 'Post de LinkedIn',
    group: 'Redes sociais',
    hint: 'Gancho, desenvolvimento e convite à conversa.',
    structure:
      'Rótulo "Gancho": uma ou duas linhas que aparecem antes do "ver mais" (até 210 caracteres). Corpo: parágrafos de uma a três linhas, com respiro; uma ideia central, uma história ou um exemplo concreto, e o aprendizado. Rótulo "Fechamento": uma pergunta ou convite para comentar. No máximo 3 hashtags no fim. Entre 900 e 1.500 caracteres.',
    skeleton: [
      { type: 'hook', label: 'Gancho' },
      { type: 'p', label: 'Corpo' },
      { type: 'p', label: 'Corpo' },
      { type: 'cta', label: 'Fechamento' },
    ],
  },
  {
    id: 'lp',
    label: 'Landing page',
    group: 'Site e páginas',
    hint: 'Uma página que leva a uma ação: contato, WhatsApp, compra.',
    sendTo: 'projetos',
    structure:
      'Uma seção por grupo de blocos, cada uma começando com um título (h2) com rótulo da seção. Ordem: "Hero" (título que diz o que é, para quem e onde; subtítulo; botão), "Problema" (a dor nas palavras do cliente), "Solução", "Benefícios" (3 a 6, cada um com título e uma frase), "Como funciona" (3 a 5 passos), "Prova" (só o que existir de verdade: números e depoimentos que o briefing trouxe; senão deixe o espaço marcado como [a confirmar]), "Oferta", "Perguntas" (4 a 6 com resposta) e "Chamada final" (botão). O texto do botão diz a ação e o que vem depois.',
    skeleton: [
      { type: 'h2', label: 'Hero' },
      { type: 'p', label: 'Hero' },
      { type: 'cta', label: 'Hero' },
      { type: 'h2', label: 'Problema' },
      { type: 'h2', label: 'Solução' },
      { type: 'h2', label: 'Benefícios' },
      { type: 'h2', label: 'Como funciona' },
      { type: 'h2', label: 'Perguntas' },
      { type: 'cta', label: 'Chamada final' },
    ],
  },
  {
    id: 'site',
    label: 'Site institucional',
    group: 'Site e páginas',
    hint: 'Home, sobre, serviços e contato, página por página.',
    sendTo: 'projetos',
    structure:
      'Uma página por h1 (rótulo com o nome da página: "Home", "Sobre", "Serviços", "Contato"), e dentro de cada uma as seções em h2 com os textos. Home: promessa, o que fazemos, por que nós, chamada. Sobre: quem somos, como trabalhamos (sem inventar história, anos ou prêmios). Serviços: um bloco por serviço com título e duas frases. Contato: texto curto e os meios de contato que o briefing trouxe.',
    skeleton: [
      { type: 'h1', label: 'Home' },
      { type: 'h2', label: 'Home' },
      { type: 'h1', label: 'Sobre' },
      { type: 'h1', label: 'Serviços' },
      { type: 'h1', label: 'Contato' },
    ],
  },
  {
    id: 'anuncio',
    label: 'Anúncios (Google e Meta)',
    group: 'Campanhas',
    hint: 'Variações de título, texto e chamada para testar.',
    structure:
      'Para o Google: 8 a 10 títulos de até 30 caracteres e 3 a 4 descrições de até 90 caracteres (rótulo "Google", conte os caracteres entre colchetes). Para a Meta: 3 variações de texto principal (até 125 caracteres antes do corte), título (até 40) e chamada, cada uma com um ângulo diferente (rótulos "Meta · dor", "Meta · prova", "Meta · oferta"). Respeite as regras da profissão do nicho.',
    skeleton: [
      { type: 'h2', label: 'Google' },
      { type: 'h2', label: 'Meta · dor' },
      { type: 'h2', label: 'Meta · prova' },
      { type: 'h2', label: 'Meta · oferta' },
    ],
  },
  {
    id: 'campanha',
    label: 'Campanha',
    group: 'Campanhas',
    hint: 'Conceito, públicos, mensagens por etapa e peças.',
    structure:
      'Seções em h2: "Objetivo", "Público" (quem é e o que sente), "Conceito" (a ideia central em uma frase e o porquê), "Mensagens por etapa" (Descoberta, Consideração, Decisão: a mensagem e o ângulo de cada uma), "Peças" (lista de peças por canal com uma frase de cada), "Calendário" (semana a semana) e "Como medir" (indicadores que o negócio entende, como mensagens no WhatsApp).',
    skeleton: [
      { type: 'h2', label: 'Objetivo' },
      { type: 'h2', label: 'Público' },
      { type: 'h2', label: 'Conceito' },
      { type: 'h2', label: 'Mensagens por etapa' },
      { type: 'h2', label: 'Peças' },
      { type: 'h2', label: 'Calendário' },
      { type: 'h2', label: 'Como medir' },
    ],
  },
  {
    id: 'email',
    label: 'Sequência de e-mails',
    group: 'Mensagens',
    hint: '3 a 5 e-mails com assunto, abertura e chamada.',
    structure:
      'Um e-mail por grupo de blocos, com h2 "E-mail 1"…: linha de assunto (até 50 caracteres), pré-cabeçalho (até 90), o corpo em parágrafos curtos e uma única chamada. A sequência tem uma progressão: o primeiro apresenta o problema, os do meio dão valor e prova, o último convida à ação com um motivo.',
    skeleton: [
      { type: 'h2', label: 'E-mail 1' },
      { type: 'h2', label: 'E-mail 2' },
      { type: 'h2', label: 'E-mail 3' },
    ],
  },
  {
    id: 'whatsapp',
    label: 'Mensagens de WhatsApp',
    group: 'Mensagens',
    hint: 'Abordagem, follow-up e resposta a objeção.',
    structure:
      'Cada mensagem num bloco com rótulo ("Primeira mensagem", "Follow-up 1 (2 dias depois)", "Follow-up 2", "Objeção: preço"…). Texto curto, de pessoa para pessoa, sem parecer robô: uma pergunta ou um oferecimento por mensagem, sem pressão e sem promessa. Máximo de 60 palavras cada.',
    skeleton: [
      { type: 'p', label: 'Primeira mensagem' },
      { type: 'p', label: 'Follow-up 1' },
      { type: 'p', label: 'Follow-up 2' },
    ],
  },
  {
    id: 'artigo',
    label: 'Artigo de blog',
    group: 'Conteúdo longo',
    hint: 'Texto para o site e para o Google, com estrutura de SEO.',
    structure:
      'h1 com o título (até 60 caracteres, com a palavra principal). Rótulo "Descrição": meta descrição de 140 a 160 caracteres. Introdução em até 4 linhas que diz o que a pessoa vai levar. Seções em h2 (cada uma responde uma pergunta real do leitor), parágrafos curtos, listas quando ajudarem. Fecho com a ação. Entre 800 e 1.400 palavras. Sem encher de palavra-chave.',
    skeleton: [
      { type: 'h1', label: 'Título' },
      { type: 'p', label: 'Descrição' },
      { type: 'p', label: 'Introdução' },
      { type: 'h2' },
      { type: 'h2' },
      { type: 'cta', label: 'Fecho' },
    ],
  },
  {
    id: 'pesquisa',
    label: 'Pesquisa',
    group: 'Pesquisa',
    hint: 'Pega um assunto e mapeia dores, jornada, clientes, campanhas e ângulos.',
    web: true,
    structure:
      'Seções em h2: "Resumo" (3 a 5 linhas do que importa), "Quem é o cliente" (perfis: quem decide, o que faz, o que sente), "Dores" (cada dor num bloco, na linguagem do cliente, com a fonte quando houver), "Desejos", "Objeções", "Jornada" (Descoberta, Consideração, Decisão, Pós-compra: o que a pessoa pensa, faz, onde procura e o que a faz avançar), "Campanhas e posts que existem" (o que concorrentes e referências publicam: o ângulo, o formato e o link, descrevendo com suas palavras), "Ângulos de conteúdo" (10 ideias de gancho com o formato de cada uma) e "Próximos passos". Só afirme o que leu; marque como [hipótese] o que for dedução.',
    skeleton: [
      { type: 'h2', label: 'Resumo' },
      { type: 'h2', label: 'Quem é o cliente' },
      { type: 'h2', label: 'Dores' },
      { type: 'h2', label: 'Desejos' },
      { type: 'h2', label: 'Objeções' },
      { type: 'h2', label: 'Jornada' },
      { type: 'h2', label: 'Campanhas e posts que existem' },
      { type: 'h2', label: 'Ângulos de conteúdo' },
      { type: 'h2', label: 'Próximos passos' },
    ],
  },
  {
    id: 'livre',
    label: 'Documento em branco',
    group: 'Livre',
    hint: 'Escreva do zero, com a ajuda dos agentes quando quiser.',
    structure: 'Sem estrutura fixa: siga o pedido.',
    skeleton: [{ type: 'h1', label: 'Título' }, { type: 'p' }],
  },
]

export const formatById = (id: string | undefined) => FORMATS.find((f) => f.id === id) ?? FORMATS[FORMATS.length - 1]

/** Frameworks de escrita: a estrutura por trás de um texto que convence. */
export const FRAMEWORKS: { id: string; name: string; steps: string; use: string }[] = [
  { id: 'aida', name: 'AIDA', steps: 'Atenção → Interesse → Desejo → Ação', use: 'Posts, anúncios e páginas curtas: prende, dá motivo, faz querer, pede.' },
  { id: 'pas', name: 'PAS', steps: 'Problema → Agitação → Solução', use: 'Quando a dor é forte e o público já a sente: landing pages, e-mails, anúncios de dor.' },
  { id: 'bab', name: 'BAB', steps: 'Antes → Depois → Ponte', use: 'Mostra a transformação: como é hoje, como poderia ser, e como chegar lá.' },
  { id: 'pastor', name: 'PASTOR', steps: 'Problema, Amplificar, História, Transformação, Oferta, Resposta', use: 'Páginas longas e cartas de venda.' },
  { id: 'quest', name: 'QUEST', steps: 'Qualifica → Entende → Educa → Estimula → Transiciona', use: 'Artigos e e-mails que conduzem do interesse à decisão.' },
  { id: '4u', name: '4U (headline)', steps: 'Útil, Urgente, Único, Ultraespecífico', use: 'Para testar títulos: quanto mais "U" tem, mais forte; sem urgência falsa.' },
  { id: 'hso', name: 'Gancho, História, Oferta', steps: 'Gancho → História → Oferta', use: 'Vídeos curtos e stories: a história faz a oferta caber.' },
  { id: 'fab', name: 'FAB', steps: 'Característica → Vantagem → Benefício', use: 'Transforma o que o serviço tem no que o cliente ganha.' },
]

/** Fórmulas de gancho: o jeito de começar. */
export const HOOKS: { id: string; name: string; example: string }[] = [
  { id: 'dor', name: 'A dor em voz alta', example: 'Seu anúncio gasta todo mês e o WhatsApp não toca.' },
  { id: 'erro', name: 'O erro comum', example: 'O erro que faz a maioria dos sites perder o contato na primeira tela.' },
  { id: 'pergunta', name: 'Pergunta que dói', example: 'Se um cliente entrasse hoje no seu site, ele saberia como chamar?' },
  { id: 'contraste', name: 'Contraste', example: 'Site bonito não é site que vende.' },
  { id: 'segredo', name: 'O que ninguém conta', example: 'O que ninguém conta sobre sites de escritório de advocacia.' },
  { id: 'numero', name: 'Número concreto (só se existir)', example: '3 coisas que o visitante procura nos primeiros 5 segundos.' },
  { id: 'cena', name: 'Cena', example: 'Terça, 9h. Ele abre o seu site no celular, não acha o botão e fecha.' },
  { id: 'aposta', name: 'Aposta ousada', example: 'Seu site precisa de menos páginas, não de mais.' },
]

export interface NicheSpec {
  id: string
  label: string
  /** O conselho que regula a publicidade, e o que ele pede. */
  rules: string
  pains: string[]
  desires: string[]
  objections: string[]
  /** Como esse público fala. */
  language: string[]
  angles: string[]
}

/**
 * Os nichos que atendemos (os da Prospecção). Fatos de mercado ficam de fora:
 * aqui só o que se sabe da rotina e da regra de cada profissão. As regras são
 * um guia de cuidado, não parecer jurídico: a norma vigente de cada conselho é
 * a que vale e deve ser conferida antes de publicar.
 */
export const NICHES: NicheSpec[] = [
  {
    id: 'advogados',
    label: 'Advogados',
    rules: 'Publicidade da advocacia (Código de Ética e Provimento 205/2021 da OAB): informativa e discreta. Sem promessa de resultado, sem "garantimos", sem captação de clientela, sem preço nem "consulta grátis" como isca, sem depoimento nem caso concreto, sem "especialista" sem título. Nada de comparar com outros escritórios.',
    pains: ['O site é de anos atrás e ninguém cuida', 'Quem chega pelo anúncio não entende em que área o escritório atua', 'Vem contato fora da área ou só perguntando preço', 'Dependência de indicação'],
    desires: ['Ser lembrado como referência na área, com sobriedade', 'Contatos que já chegam entendendo o serviço', 'Um site que dá confiança sem parecer propaganda'],
    objections: ['"Tenho receio de infringir a OAB"', '"Meus clientes vêm por indicação"', '"Já tenho site"'],
    language: ['atuação', 'área', 'orientação', 'primeiro atendimento', 'seu caso'],
    angles: ['Como explicar a área de atuação em cinco segundos', 'O que um site de advocacia pode e não pode dizer', 'Como o cliente decide chamar um escritório'],
  },
  {
    id: 'medicos',
    label: 'Médicos',
    rules: 'Publicidade médica (CFM, Resolução 2.336/2023): sem promessa de cura ou resultado, sem "antes e depois" com fins de promoção, sem sensacionalismo, sem divulgar equipamento como diferencial de superioridade, com nome, CRM e RQE quando houver. Nunca divulgar dado de paciente.',
    pains: ['Agenda com buracos e dependência de convênio', 'Paciente não encontra o consultório certo no Google', 'Site sem o que o paciente pergunta: onde fica, como agenda, quais convênios'],
    desires: ['Agenda organizada com pacientes que entendem o atendimento', 'Presença profissional, sem parecer anúncio', 'Facilidade para o paciente marcar'],
    objections: ['"Posso ter problema com o CFM"', '"Meus pacientes vêm por indicação"', '"Não tenho tempo para redes"'],
    language: ['consulta', 'atendimento', 'paciente', 'agendar', 'cuidado'],
    angles: ['Como o paciente escolhe um consultório', 'Perguntas que o paciente faz antes de agendar', 'O que um site de consultório precisa mostrar na primeira tela'],
  },
  {
    id: 'psicologos',
    label: 'Psicólogos',
    rules: 'Publicidade em Psicologia (Código de Ética do CFP e normas do conselho): informar sobre o trabalho, sem promessa de resultado, sem comparação, sem divulgar casos nem depoimentos de pacientes, sem fotos "antes e depois", sem pressionar. Nome e CRP à vista.',
    pains: ['Pessoas têm medo ou vergonha de dar o primeiro passo', 'O site não passa acolhimento e parece genérico', 'Dificuldade de explicar a abordagem'],
    desires: ['Receber pessoas que se sentiram acolhidas já no site', 'Explicar a abordagem em linguagem simples', 'Agenda estável'],
    objections: ['"Não quero parecer que estou vendendo"', '"O sigilo me preocupa"', '"Atendo por indicação"'],
    language: ['acolhimento', 'escuta', 'primeiro encontro', 'no seu tempo', 'sigilo'],
    angles: ['Como falar de terapia sem prometer resultado', 'O que passa pela cabeça de quem procura um psicólogo', 'Primeira sessão: o que acontece'],
  },
  {
    id: 'dentistas',
    label: 'Dentistas',
    rules: 'Publicidade em Odontologia (Código de Ética e normas do CFO): sem promessa de resultado, sem preço de tratamento como chamada, sem "antes e depois" de pacientes sem os cuidados exigidos, sem sorteios ou brindes, com nome, CRO e especialidade registrada.',
    pains: ['Cadeira vazia em certos horários', 'Quem pesquisa só compara preço', 'Medo de dentista: o site não ajuda a quebrar a barreira'],
    desires: ['Pacientes que valorizam o tratamento e voltam', 'Agenda cheia de avaliações marcadas', 'Mostrar estrutura e cuidado sem exagero'],
    objections: ['"Meu paciente quer preço"', '"Posso infringir regra do CFO"', '"Já tenho Instagram"'],
    language: ['avaliação', 'tratamento', 'sorriso', 'cuidado', 'agendar'],
    angles: ['O que o paciente quer saber antes de marcar a primeira avaliação', 'Como mostrar o consultório sem parecer propaganda', 'Medo de dentista: como a página pode acolher'],
  },
  {
    id: 'engenheiros',
    label: 'Engenheiros',
    rules: 'Publicidade de engenharia (normas do CONFEA e do CREA): citar o registro e a área de atuação, sem prometer prazo, custo ou resultado que dependa de terceiros, e sem expor obra ou cliente sem autorização.',
    pains: ['Empresa B2B que depende de relacionamento e não aparece na busca', 'Site que não explica serviços técnicos de forma clara', 'Orçamentos que chegam sem informação'],
    desires: ['Orçamentos mais qualificados', 'Mostrar competência técnica com clareza', 'Ser lembrado por incorporadoras e empresas'],
    objections: ['"Meu negócio é indicação"', '"Serviço técnico não se explica em site"'],
    language: ['projeto', 'obra', 'laudo', 'execução', 'orçamento'],
    angles: ['Como pedir orçamento de um serviço de engenharia', 'Perguntas que o cliente deveria fazer antes de contratar', 'Como explicar um serviço técnico em linguagem simples'],
  },
  {
    id: 'arquitetos',
    label: 'Arquitetos',
    rules: 'Publicidade de arquitetura (Código de Ética e normas do CAU): sem promessa de resultado ou prazo, sem uso de imagem de projeto de terceiros, crédito de autoria e de fotógrafo, e registro do profissional (CAU) à vista.',
    pains: ['O portfólio está no Instagram e em PDF, o site não mostra os projetos', 'Quem chega não sabe o que o escritório faz nem como contratar', 'Dificuldade de mostrar processo, não só fotos'],
    desires: ['Projetos apresentados em tela cheia', 'Clientes que já entendem o jeito de trabalhar', 'Conversas que viram orçamentos'],
    objections: ['"Meu trabalho aparece no Instagram"', '"Site bonito demora e custa"'],
    language: ['projeto', 'obra', 'ambiente', 'processo', 'conceito'],
    angles: ['Portfólio que vende: por que Instagram e PDF não bastam', 'Como mostrar o processo de um projeto', 'O que o cliente precisa ver antes de pedir orçamento'],
  },
  {
    id: 'contadores',
    label: 'Contadores',
    rules: 'Publicidade contábil (Código de Ética e normas do CFC): sem promessa de resultado fiscal, sem prometer redução de imposto, sem preço como isca e sem comparar com colegas. Registro CRC à vista.',
    pains: ['Clientes comparam só por mensalidade', 'O escritório parece igual a todos os outros', 'Site sem explicar os planos nem o caminho para virar cliente'],
    desires: ['Clientes que valorizam o acompanhamento', 'Explicar o serviço sem jargão', 'Processo claro de entrada'],
    objections: ['"Meus clientes vêm por indicação"', '"Contabilidade é tudo igual"'],
    language: ['abertura de empresa', 'regime tributário', 'obrigações', 'acompanhamento', 'planos'],
    angles: ['O que muda quando a contabilidade é acompanhada', 'Perguntas que o empresário faz antes de trocar de contador', 'Como funciona a entrada de um novo cliente'],
  },
  {
    id: 'imobiliarias',
    label: 'Imobiliárias',
    rules: 'Publicidade imobiliária (normas do COFECI e do CRECI e Código de Defesa do Consumidor): anúncio com o número do CRECI, descrição fiel do imóvel, preço quando divulgado deve ser verdadeiro e completo, sem promessa de valorização.',
    pains: ['Portais cobram e mandam contato frio', 'O site da imobiliária parece catálogo genérico', 'Dificuldade de gerar contato direto no WhatsApp'],
    desires: ['Contato direto com quem quer comprar ou alugar', 'Imóveis em destaque com boa apresentação', 'Menos dependência de portais'],
    objections: ['"Os portais já trazem cliente"', '"Meu corretor cuida disso"'],
    language: ['imóvel', 'visita', 'proposta', 'bairro', 'condições'],
    angles: ['Contato direto vs portal: o que muda', 'Como apresentar um imóvel para quem decide pelo celular', 'O que o comprador procura na primeira tela'],
  },
  {
    id: 'nutricionistas',
    label: 'Nutricionistas',
    rules: 'Publicidade em Nutrição (Código de Ética e normas do CFN): sem promessa de resultado, sem "antes e depois", sem sensacionalismo, sem divulgar produtos como milagrosos, com nome e CRN à vista.',
    pains: ['Muita concorrência e conteúdo de qualidade duvidosa', 'Paciente espera resultado rápido', 'Agenda irregular'],
    desires: ['Pacientes que entendem o acompanhamento', 'Autoridade com conteúdo sério', 'Agenda estável'],
    objections: ['"Posso errar na publicidade"', '"O resultado depende do paciente"'],
    language: ['acompanhamento', 'consulta', 'plano alimentar', 'rotina', 'hábitos'],
    angles: ['Como funciona a primeira consulta de nutrição', 'O que a dieta da moda não conta', 'Como o paciente escolhe um nutricionista'],
  },
  {
    id: 'fisioterapeutas',
    label: 'Fisioterapeutas',
    rules: 'Publicidade em Fisioterapia (Código de Ética e normas do COFFITO): sem promessa de cura, sem divulgar casos de pacientes, sem comparação e sem preço como isca, com CREFITO à vista.',
    pains: ['Paciente só procura quando já tem dor forte', 'Dificuldade de mostrar o valor do tratamento contínuo', 'Concorrência de clínicas maiores'],
    desires: ['Pacientes que concluem o tratamento', 'Indicação de médicos', 'Agenda cheia de avaliações'],
    objections: ['"Meu paciente vem por indicação"', '"Não posso prometer resultado"'],
    language: ['avaliação', 'tratamento', 'reabilitação', 'sessão', 'retorno'],
    angles: ['Quando procurar um fisioterapeuta', 'Como é a primeira avaliação', 'Dor recorrente: o que a página pode explicar'],
  },
  {
    id: 'veterinarios',
    label: 'Veterinários',
    rules: 'Publicidade veterinária (normas do CFMV): sem promessa de cura, sem sensacionalismo, sem preço como isca, com CRMV à vista e dados do responsável técnico.',
    pains: ['O tutor decide pelo preço', 'Horário de urgência e disponibilidade confusos no site', 'Concorrência de clínicas grandes'],
    desires: ['Tutores fiéis', 'Urgência bem comunicada', 'Confiança e acolhimento'],
    objections: ['"Meus clientes são do bairro"', '"Já tenho Instagram"'],
    language: ['tutor', 'pet', 'consulta', 'emergência', 'vacinas'],
    angles: ['O que o tutor quer saber antes de levar o pet', 'Como mostrar a clínica com acolhimento', 'Urgência: o que o site precisa dizer'],
  },
  {
    id: 'estetica',
    label: 'Estética',
    rules: 'Atenção à publicidade de procedimentos estéticos (conselhos de cada profissão e ANVISA): sem promessa de resultado, sem "antes e depois" que induza, sem preço como isca para procedimentos invasivos, com responsável técnico à vista.',
    pains: ['Concorrência pelo preço e por promoções', 'Cliente quer ver resultado antes de decidir', 'Agenda irregular'],
    desires: ['Clientes que valorizam o profissional', 'Avaliações marcadas', 'Imagem de cuidado e segurança'],
    objections: ['"Meu Instagram já mostra tudo"', '"Cliente só quer promoção"'],
    language: ['avaliação', 'procedimento', 'cuidado', 'agenda', 'autoestima'],
    angles: ['Como escolher uma clínica com segurança', 'O que perguntar antes de um procedimento', 'Avaliação: o primeiro passo'],
  },
  {
    id: 'academias',
    label: 'Academias',
    rules: 'Sem promessa de resultado físico, sem "antes e depois" com promessa e sem preço enganoso. Condições da oferta devem estar claras (CDC).',
    pains: ['Alta desistência nos primeiros meses', 'Concorrência por preço', 'Site não mostra estrutura, horários e planos'],
    desires: ['Alunos que ficam', 'Aula experimental agendada', 'Comunidade e engajamento'],
    objections: ['"Aluno só compara mensalidade"', '"O Instagram resolve"'],
    language: ['treino', 'aula experimental', 'plano', 'rotina', 'turma'],
    angles: ['Como não desistir da academia nos primeiros 30 dias', 'O que perguntar numa visita à academia', 'Aula experimental: como funciona'],
  },
  {
    id: 'escolas',
    label: 'Escolas de idiomas',
    rules: 'Sem promessa de fluência em prazo fixo, sem comparação enganosa e com condições de matrícula e valores claros (CDC).',
    pains: ['Alta rotatividade de alunos', 'Concorrência de aplicativos e cursos online', 'Site genérico que não mostra o método'],
    desires: ['Alunos que concluem', 'Matrículas por indicação e busca', 'Explicar o método com clareza'],
    objections: ['"Hoje todo mundo aprende por app"', '"Aluno quer preço"'],
    language: ['aula', 'turma', 'conversação', 'nível', 'método'],
    angles: ['App ou escola: o que cada um entrega', 'Como escolher uma escola de idiomas', 'A primeira aula: o que esperar'],
  },
]

export const nicheById = (id: string | undefined) => NICHES.find((n) => n.id === id)

/** A voz da Avence Studio, do jeito que escrevemos para donos de negócio (e que vale também para os conteúdos dos clientes, salvo outra indicação). */
export const AVENCE_VOICE = [
  'Quem lê é o dono de um negócio local de serviço (advocacia, saúde, contabilidade, arquitetura, imobiliária…). Ele pensa em contatos e em WhatsApp, não em tecnologia: fale do que a página faz por quem chega, nunca de versão de WordPress, PHP, plugin ou código.',
  'Direto, concreto e humano, em português do Brasil, como um estúdio fala com o dono: frases curtas, voz ativa, palavras do dia a dia. Sem jargão de marketing ("sinergia", "disruptivo", "soluções completas"), sem adjetivo vazio, sem emoji.',
  'Nunca invente número, prazo, preço, prêmio, resultado, depoimento ou cliente. Só afirme o que o briefing trouxe ou o que é verificável. Se faltar um dado, escreva o texto sem ele e marque [a confirmar].',
  'Nunca prometa resultado. Em profissão regulada, escreva dentro das regras do conselho (veja as regras do nicho). A Avence não promete clientes: mostra o caminho entre quem chega e a conversa.',
  'A marca é a Avence Studio (estúdio de sites em WordPress e Elementor, São Leopoldo, RS). Nunca cite o Superelements nem fale de "plano" de plataforma. A oferta é um site novo entregue pronto, com prévia antes de fechar, pagamento único e plano mensal opcional (sem valores, se o briefing não trouxer).',
].join('\n')

/** Regras de qualquer texto, para qualquer cliente. */
export const COPY_RULES = [
  'Clareza antes de criatividade: quem lê entende o que é, para quem é e o que fazer, em 5 segundos.',
  'Um assunto por bloco, uma ideia por frase, uma ação por peça.',
  'Especificidade vence adjetivo: troque "ótimo atendimento" por o que a pessoa vê, ouve ou recebe.',
  'Fale na linguagem do cliente (as palavras que ele usaria), não na do fornecedor.',
  'Benefício antes de característica; prova antes de promessa; ação clara no fim.',
  'Corte o que não muda a decisão do leitor. Releia em voz alta: onde o fôlego acaba, a frase está longa.',
  'Chamadas dizem a ação e o que vem depois ("Chamar no WhatsApp e ver a prévia"), nunca "Saiba mais".',
].join('\n')
