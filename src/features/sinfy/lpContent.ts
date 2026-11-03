import { AGENCY_OFFER, monthlyBrl } from '@/features/superelements/agencyOffer';

/**
 * Os textos da landing da Sinfy (/lp). A página React e a LP remontada no Space
 * (projeto "Sinfy", construtor em ./elementor.ts) leem daqui, para não divergirem.
 */

export const SOLUTIONS = [
  { id: 'resultados', label: 'Anúncios e site', overline: 'Invista no que vende', title: 'Veja qual campanha\nvira conversa.', description: 'O gasto na Meta ao lado das visitas, dos contatos e das etapas do funil. A verba vai para o que traz cliente, não só clique.', items: ['Gastos e métricas das campanhas Meta', 'Visitas e contatos gerados no site', 'Funis com leitura das etapas da jornada'] },
  { id: 'leads', label: 'Formulários e origem', overline: 'Atenda os melhores primeiro', title: 'Saiba quem chegou\nantes de responder.', description: 'Formulários e quizzes qualificam o contato e trazem as respostas e a origem para o lead. O vendedor começa a conversa sabendo o que a pessoa quer.', items: ['Formulários e quizzes de qualificação', 'Origem e campanha quando identificadas', 'Respostas vinculadas à oportunidade'] },
  { id: 'crm', label: 'Leads e vendas', overline: 'Ninguém fica para trás', title: 'Cada lead tem dono\ne próximo passo.', description: 'Cada oportunidade tem um responsável, a próxima ação e o histórico. O que está parado aparece, e a proposta não morre esquecida.', items: ['Contatos e histórico reunidos', 'Responsáveis e próximas ações', 'Propostas e vendas registradas'] },
  { id: 'whatsapp', label: 'Conversas', overline: 'Responda primeiro', title: 'O lead chega.\nO aviso chega junto.', description: 'Quem precisa agir recebe o novo lead no WhatsApp, com origem e respostas. A equipe atende pela mesma caixa e segue as rotinas de follow-up do dia.', items: ['Caixa de entrada da equipe', 'Histórico de mensagens e arquivos', 'Avisos de novos leads e rotinas de contato'] },
  { id: 'relatorios', label: 'Relatórios', overline: 'O dono vê o que vende', title: 'O resultado chega\nno WhatsApp do dono.', description: 'Resumos agendados e perguntas sobre a própria conta, pelo WhatsApp. O dono acompanha contatos e vendas sem abrir painel nenhum.', items: ['Resumos periódicos pelo WhatsApp', 'Consultas sobre os dados da empresa', 'Acesso por conta e assuntos autorizados'] },
] as const;

export const PILLARS = [
  ['Veja na hora.', 'Visitas, leads, pedidos e mensagens chegando juntos, sem abrir seis ferramentas.'],
  ['Pense com a IA.', 'Pergunte pelo WhatsApp como foi a semana. A IA lê os dados da sua conta e responde.'],
  ['Responda primeiro.', 'O lead chega com origem e respostas, e quem precisa agir é avisado na hora.'],
  ['Invista no que vende.', 'Veja quais campanhas viram conversa e venda, não só clique.'],
] as const;

export const BENEFITS = [
  { label: 'Para sua agência', title: 'Entregue venda,\nnão só lead.', text: 'Seu trabalho deixa de terminar no formulário. Você vê o que aconteceu com cada contato e mostra ao cliente quais campanhas viraram negócio.', items: ['Cada lead com a campanha de origem', 'Onde o atendimento do cliente trava', 'Argumento para manter e ampliar a verba'], quote: '“A campanha trouxe contatos. Vamos olhar juntos o que aconteceu com eles?”', signature: 'Uma conversa melhor entre agência e cliente.' },
  { label: 'Para o negócio', title: 'Feche mais com os\ncontatos que já chegam.', text: 'Você já paga para receber contatos. A Sinfy ajuda a equipe a responder rápido, seguir cada um até a decisão e saber o que dá retorno.', items: ['Aviso de lead novo no WhatsApp', 'Responsável e próximo passo em cada contato', 'Follow-up do dia pronto para enviar'], quote: '“Quem chegou, quem está atendendo e quais oportunidades precisam de mim?”', signature: 'Respostas para a rotina de quem empreende.' },
] as const;

export const FAQ = [
  ['A Sinfy aumenta minhas vendas?', 'A Sinfy não vende pela sua equipe. Ela ataca onde as vendas costumam se perder: lead respondido tarde, contato sem responsável, follow-up esquecido e verba na campanha que não traz cliente. Os números de cada conta mostram a evolução: contatos, etapas e vendas registradas.'],
  ['Para quem é a Sinfy?', 'Para agências de tráfego e de sites que atendem negócios locais e querem mostrar o que acontece depois do anúncio. O dono do negócio e a equipe dele usam o ambiente para receber os contatos, atender e acompanhar os leads.'],
  ['O cliente contrata a agência ou a plataforma?', 'A proposta é combinar os dois. A agência define o escopo do serviço e a implantação da plataforma com o cliente. O produto conecta as informações e apoia o trabalho diário das equipes.'],
  ['O produto substitui o trabalho da agência?', 'A agência continua responsável pela estratégia, execução e orientação. A plataforma aproxima esse trabalho da rotina comercial do cliente, com contatos, conversas e oportunidades organizados.'],
  ['Preciso entregar todas as funcionalidades?', 'Os módulos podem ser habilitados por conta. A implantação deve partir do que faz sentido para o negócio e para o serviço contratado com a agência.'],
  ['Consigo saber a origem de todos os contatos?', 'A origem depende dos dados recebidos em cada canal, como os parâmetros do link e do formulário. Quando não há informação suficiente, a origem fica sem identificação.'],
  ['Tudo atualiza em tempo real?', 'As áreas têm ritmos diferentes. Os leads e as visitas usam atualizações próprias, enquanto anúncios dependem da sincronização com a Meta. Acompanhar a data de atualização de cada fonte ajuda a interpretar os dados.'],
  ['A Sinfy cria sites, páginas ou criativos?', 'Não. A Sinfy acompanha o que a agência já produz: lê as campanhas da Meta e as visitas do site, recebe os formulários e leva cada contato ao atendimento no WhatsApp. Os formulários e quizzes de captação estão incluídos; o site e as peças continuam com a agência, na ferramenta que ela já usa.'],
  ['Funciona com qualquer site?', 'Sim. Um código instalado uma vez no site (WordPress, Shopify ou HTML) registra as visitas, a origem e os cliques no WhatsApp. Os formulários enviam os leads por webhook, inclusive os do Elementor.'],
  ['Quanto custa o plano Agência?', `O plano custa ${monthlyBrl(AGENCY_OFFER.monthlyPerCompany)} por empresa ativa/mês, pago pela agência à plataforma, sem mensalidade adicional de parceiro nesta oferta inicial. A agência define como combina o acesso com seu serviço. Equipe, conexões, implantação e eventuais custos externos são combinados na proposta.`],
] as const;
