/**
 * A rubrica de 100 pontos do perfil (o `rubric.json` do instagram-agent-skill, MIT, em português).
 * Complementa a análise sem IA do CRM (`crm/profileAudit.ts`): aquela mede com os números da Meta;
 * esta dá ao agente os 12 itens que a Meta não entrega (nome pesquisável, fixados, destaques,
 * capas legíveis) e o peso de cada um. O perfil não é vitrine: é a tela de decisão de quem chegou
 * por um reels, e tem uns 3 segundos para responder "tem mais disso aqui, e é para mim?".
 */
export interface RubricItem {
  id: string
  item: string
  pontos: number
  nota_cheia: string
  falha_comum: string
}

export const PROFILE_RUBRIC: RubricItem[] = [
  { id: 'nome', item: 'Campo Nome', pontos: 12, nota_cheia: 'O campo Nome (30 caracteres, a linha em negrito, não o @) traz o nome e o que faz, em palavras que as pessoas buscam: "Dana Ruiz | Contratos para fotógrafos". A busca do Instagram lê esse campo, e a maioria gasta só com o nome.', falha_comum: 'Só o nome, ou o nome com emoji.' },
  { id: 'bio-linha1', item: 'Primeira linha da bio', pontos: 12, nota_cheia: 'Diz para quem é e o que muda para essa pessoa, nas palavras dela. Não é cargo, nem lista de adjetivos, nem três emojis separados por barra.', falha_comum: '"Empreendedora | Apaixonada por café | Mãe de pet".' },
  { id: 'bio-resto', item: 'Resto da bio', pontos: 8, nota_cheia: 'O resto dos 150 caracteres traz uma prova ou uma oferta específica, em frases, não em lista com barras.', falha_comum: 'Sopa de palavras-chave, ou espaço vazio.' },
  { id: 'fixados', item: 'Os três fixados', pontos: 10, nota_cheia: 'Três posts fixados no topo com três papéis: a melhor prova, a explicação mais clara da oferta, a melhor apresentação de quem está por trás. Não os três com mais views por acaso.', falha_comum: 'Nada fixado: o topo do grid é o que foi postado por último.' },
  { id: 'link', item: 'Link', pontos: 8, nota_cheia: 'Um destino que cumpre o que a bio prometeu. Cabem cinco links; mais de dois vira menu, e menu converte pior que porta.', falha_comum: 'Árvore de links com onze opções, ou nenhum link.' },
  { id: 'destaques', item: 'Destaques', pontos: 8, nota_cheia: 'De quatro a seis, com os nomes das perguntas que quem compra faz: Preços, Resultados, Como funciona, Sobre. Capas iguais. Nada com mais de um ano na frente.', falha_comum: '"Aleatório", "Vida", "Favoritos", ou 14 destaques sem ordem.' },
  { id: 'grid', item: 'Grid legível', pontos: 8, nota_cheia: 'As nove primeiras capas se leem em miniatura e dizem do que é o perfil sem nenhum toque. Capa de reels escolhida, não o primeiro quadro.', falha_comum: 'Nove capas de rosto no meio da fala, sem texto.' },
  { id: 'foto', item: 'Foto', pontos: 6, nota_cheia: 'Rosto ocupando uns 60% de um círculo que aparece com ~40 px. Olhos visíveis, foto dos últimos dois anos, fundo que não compete. (Marca: logo legível nesse tamanho.)', falha_comum: 'Corpo inteiro, logo numa marca pessoal, ou foto escura de braço esticado.' },
  { id: 'arroba', item: '@ (usuário)', pontos: 6, nota_cheia: 'Legível, fácil de falar em voz alta e igual nas outras redes. Sem underline empilhado nem número no lugar de letra.', falha_comum: 'Um @ que ninguém consegue escrever depois de ouvir uma vez.' },
  { id: 'categoria', item: 'Categoria e contato', pontos: 6, nota_cheia: 'Conta profissional com categoria que bate com a oferta e botões de contato que funcionam (WhatsApp, e-mail que alguém lê).', falha_comum: 'Conta pessoal: sem números e sem botão de contato.' },
  { id: 'atividade', item: 'Atividade recente', pontos: 10, nota_cheia: 'Postou nos últimos sete dias e respondeu os comentários do post mais recente. Perfil que postou pela última vez em março parece fechado.', falha_comum: 'Cinco semanas sem post, ou uma parede de comentários sem resposta.' },
  { id: 'stories', item: 'Stories', pontos: 6, nota_cheia: 'Story no ar agora, ou na maioria dos dias. É a diferença entre um perfil e uma pessoa.', falha_comum: 'Nunca tem o anel.' },
]

export const RUBRIC_NOTE = 'Dê nota honesta a cada item: nota generosa não ajuda ninguém. A maioria dos perfis fica entre 30 e 49 na primeira passada. O campo Nome, a primeira linha da bio e os fixados pesam mais que a foto, porque é o que quem chegou por um reels processa antes de decidir seguir.'
