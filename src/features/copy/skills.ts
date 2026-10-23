import type { ChatSkill } from '@/features/space/chat/skills'

/**
 * Skills de copy: jeitos de escrever que a pessoa escolhe para o pedido
 * (gancho, landing page, carrossel, LinkedIn, roteiro, campanha, revisão,
 * regras da profissão, pesquisa). Entram no menu junto com as skills da conta
 * (tela Skills). As instruções vão no pedido ao agente.
 */

const lines = (...text: string[]) => text.join('\n')

const skill = (s: Omit<ChatSkill, 'source' | 'starters'> & { starters?: string[] }): ChatSkill => ({ source: 'builtin', starters: [], ...s })

export const COPY_SKILLS: ChatSkill[] = [
  skill({
    id: 'co-gancho',
    name: 'Ganchos e headlines',
    hint: 'Várias opções de abertura, testadas pelo 4U',
    starters: ['Dê 10 ganchos para este assunto', 'Reescreva o título em 5 versões'],
    instructions: lines(
      'Gere ganchos e títulos. Entregue de 8 a 12 opções, cada uma num bloco "hook" com rótulo da fórmula (A dor em voz alta, O erro comum, Pergunta que dói, Contraste, Cena, O que ninguém conta, Aposta ousada, Número concreto).',
      'Teste cada uma pelo 4U (útil, urgente, único, ultraespecífico), sem urgência falsa. Até 10 palavras na capa, 60 caracteres em título de página. Nunca invente número.',
      'Em `reply`, diga quais 2 você escolheria e por quê.'
    ),
  }),
  skill({
    id: 'co-lp',
    name: 'Landing page (PAS e AIDA)',
    hint: 'Página que converte: hero, dor, solução, benefícios, prova, perguntas',
    starters: ['Escreva a landing page completa', 'Reescreva só o hero'],
    instructions: lines(
      'Escreva uma landing page de uma ação só (a principal que o briefing indicar: WhatsApp, agendamento, orçamento).',
      '1. Hero: o título diz o que é, para quem e onde, na linguagem do cliente; o subtítulo explica em uma frase; o botão diz a ação e o que vem depois.',
      '2. Problema (PAS): a dor como o cliente a descreve, sem dramatizar; depois a consequência de deixar como está.',
      '3. Solução e benefícios: cada benefício com título curto e uma frase, do mais importante ao menos.',
      '4. Prova: só o que o briefing trouxe. Sem depoimento, número ou selo inventado: deixe [a confirmar].',
      '5. Como funciona em 3 a 5 passos; perguntas frequentes que removem objeções reais do nicho; chamada final repetindo a ação.'
    ),
  }),
  skill({
    id: 'co-carrossel',
    name: 'Carrossel viral',
    hint: 'Tese, pontos, dado, insight e fecho; legenda no fim',
    starters: ['Escreva um carrossel de 8 slides sobre este assunto'],
    instructions: lines(
      'Escreva um carrossel que se lê de lado: slide 1 prende (afirmação que surpreende ou pergunta que a pessoa quer ver respondida), os do meio desenvolvem uma ideia cada, o último fecha com salvar, enviar e seguir.',
      'Cada slide: título de até 12 palavras e uma frase. Um slide de dado só com número que o briefing trouxe; um de insight. Termine com a legenda (primeira linha forte, tese em duas frases, convite, até 4 hashtags).'
    ),
  }),
  skill({
    id: 'co-reels',
    name: 'Roteiro de vídeo curto',
    hint: 'Gancho em 3 segundos, cenas e chamada',
    starters: ['Escreva um roteiro de 30 segundos sobre este assunto'],
    instructions: lines(
      'Escreva um roteiro de 20 a 45 segundos. Gancho (0–3 s) com fala e imagem; uma cena por bloco com o que aparece e a fala; chamada no fim. Frases que cabem em um fôlego, linguagem de conversa, sem jargão.',
      'Indique entre colchetes cortes, texto na tela e o que filmar. Legenda curta com até 3 hashtags.'
    ),
  }),
  skill({
    id: 'co-linkedin',
    name: 'Post de LinkedIn',
    hint: 'Gancho antes do "ver mais", história e convite',
    starters: ['Escreva um post de LinkedIn sobre este assunto'],
    instructions: lines(
      'Escreva para o LinkedIn: gancho de até 210 caracteres, parágrafos de 1 a 3 linhas com respiro, uma ideia central com exemplo concreto, aprendizado e uma pergunta de fechamento. Entre 900 e 1.500 caracteres. Tom de pessoa, não de empresa.',
      'No máximo 3 hashtags. Sem emoji, sem frases de efeito vazias ("o futuro é agora").'
    ),
  }),
  skill({
    id: 'co-story',
    name: 'Sequência de stories',
    hint: '5 a 7 telas até a conversa',
    starters: ['Escreva uma sequência de 6 stories sobre este assunto'],
    instructions: lines(
      'Escreva de 5 a 7 telas, uma por bloco, até 20 palavras cada, em linguagem de conversa. Tela 1 prende; as do meio, uma ideia por tela; a última convida a responder ou chamar no WhatsApp. Indique a figura entre colchetes (enquete, caixa de perguntas, link).'
    ),
  }),
  skill({
    id: 'co-campanha',
    name: 'Campanha completa',
    hint: 'Conceito, funil, peças e calendário',
    starters: ['Monte a campanha de um mês para este nicho'],
    instructions: lines(
      'Monte a campanha: objetivo em termos que o negócio entende, público, conceito central (uma frase e o porquê), mensagens por etapa do funil, peças por canal (uma frase cada), calendário semana a semana e como medir (mensagens no WhatsApp, agendamentos). Marque [hipótese] no que não tem base e proponha o teste.'
    ),
  }),
  skill({
    id: 'co-revisao',
    name: 'Revisão e corte',
    hint: 'Corta, clareia e comenta o que está fraco',
    starters: ['Revise o documento inteiro', 'Corte 30% sem perder a ideia'],
    instructions: lines(
      'Revise como editor. Corte o que não muda a decisão do leitor, troque adjetivo por fato, desfaça frase longa, tire palavra solta no fim de linha, troque chamada genérica por ação com o que vem depois.',
      'Deixe comentários nos blocos que precisam de decisão da pessoa e corrija direto os que são claros.'
    ),
  }),
  skill({
    id: 'co-regras',
    name: 'Regras da profissão',
    hint: 'Confere o texto contra as regras do conselho do nicho',
    starters: ['Confira o texto contra as regras da profissão'],
    instructions: lines(
      'Confira cada bloco contra as regras do nicho recebidas: promessa de resultado, preço como isca, depoimento ou caso, "antes e depois", superlativos, comparação, "especialista" sem título, captação. Para cada violação, comente o bloco com o motivo e corrija com um texto seguro, que mantenha a ideia.',
      'Lembre na resposta que as regras são um guia e que a norma vigente do conselho deve ser conferida antes de publicar.'
    ),
  }),
  skill({
    id: 'co-pesquisa',
    name: 'Pesquisa de dores e jornada',
    hint: 'Mapeia clientes, dores, objeções, jornada e referências',
    starters: ['Pesquise as dores deste público e a jornada de decisão'],
    instructions: lines(
      'Pesquise e mapeie: perfis de cliente, dores e desejos nas palavras dele, objeções, jornada (descoberta, consideração, decisão, pós-compra) com o que ele pensa, faz e onde procura, e as campanhas e posts de referência com ângulo, formato e fonte. Finalize com 10 ângulos de conteúdo.',
      'Cite a fonte de cada achado; marque [hipótese] no que deduziu.'
    ),
  }),
  skill({
    id: 'co-voz',
    name: 'Tom de voz Avence',
    hint: 'Direto, concreto e humano, falando de contato e WhatsApp',
    starters: ['Reescreva neste tom de voz'],
    instructions: lines(
      'Reescreva na voz da Avence Studio: direta, concreta e humana, em frases curtas e voz ativa, falando do que a página faz por quem chega e do contato no WhatsApp, nunca de tecnologia. Sem jargão, sem adjetivo vazio, sem emoji, sem promessa de resultado.'
    ),
  }),
]
