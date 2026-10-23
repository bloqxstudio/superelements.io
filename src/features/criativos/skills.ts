import type { ChatSkill } from '@/features/space/chat/skills'

/**
 * Skills dos criativos: jeitos de trabalhar para o pedido (direção de arte,
 * texto de post, recriar uma referência). Entram no menu do chat dos criativos
 * junto com as skills da conta (a tela Skills), no lugar das padrão do canvas,
 * que falam de páginas e do Elementor. As instruções vão no pedido à IA, que
 * devolve operações no editor; ela não tem ferramentas.
 */

const lines = (...text: string[]) => text.join('\n')

export const CREATIVE_SKILLS: ChatSkill[] = [
  {
    id: 'cr-referencia',
    source: 'builtin',
    name: 'Recriar referência',
    hint: 'Posts novos a partir de um print, na marca do conjunto',
    needsImage: true,
    starters: ['Faça um post nesse estilo para o ProcessBase', 'Faça 3 posts com essa estrutura e os textos que eu mandar', 'Recrie esse layout em formato story'],
    instructions: lines(
      'A pessoa mandou um print como referência de layout.',
      '1. Descreva para si a estrutura: grade e alinhamentos, o que se lê primeiro, proporção entre título, apoio e imagem, margens, elementos repetidos (cards, selos, numeração, botões).',
      '2. Monte o post com camadas (`add_post` com `slides[].layers`) no formato pedido, ou no mesmo formato do print se não pedirem outro.',
      '3. Leve a composição, não a marca de outro: cores, fontes e logo vêm da marca do conjunto; os textos vêm do pedido, nunca do print.',
      '4. Em `reply`, diga o que foi levado da referência e o que foi adaptado.'
    ),
  },
  {
    id: 'cr-arte',
    source: 'builtin',
    name: 'Direção de arte',
    hint: 'Hierarquia, respiro, contraste e ritmo entre os slides',
    starters: ['Revise a hierarquia e o espaço deste post', 'Deixe este slide mais limpo e com mais contraste', 'Alinhe os slides do post ao mesmo padrão'],
    instructions: lines(
      'Você olha o criativo como diretor de arte.',
      '1. Um foco por slide; título bem maior que o apoio; no máximo três tamanhos de letra.',
      '2. Margens iguais (cerca de 8% do lado menor), respiro entre blocos irmãos, nada colado na borda, alinhamentos repetidos entre os slides.',
      '3. Contraste legível (texto sobre fundo escuro ou claro, sem cor da marca em texto pequeno se não passar).',
      '4. Mude pouco e com motivo: ajuste posição, tamanho e cor existentes antes de recriar. Responda com cada ajuste e o porquê, uma linha cada.'
    ),
  },
  {
    id: 'cr-copy',
    source: 'builtin',
    name: 'Texto de post',
    hint: 'Gancho, apoio e chamada, curtos e sem inventar fatos',
    starters: ['Reescreva os textos deste post com um gancho mais forte', 'Escreva a legenda deste post', 'Dê duas opções de título para este slide'],
    instructions: lines(
      'Você escreve para Instagram como redator de conversão.',
      '1. Gancho no primeiro slide (até 8 palavras); um assunto por slide; apoio em uma frase; o último slide chama para uma ação clara.',
      '2. Português do Brasil, frases curtas, palavras do dia a dia. Corte adjetivo vazio.',
      '3. Nunca invente número, prazo, preço, prêmio, resultado ou depoimento; nada de promessa de resultado.',
      '4. Legenda: abre com uma frase forte, termina convidando para a conversa, até 4 hashtags. Pedido de opções: dê duas ou três em `reply` e só mude o criativo se a pessoa escolher.'
    ),
  },
  {
    id: 'cr-carrossel',
    source: 'builtin',
    name: 'Carrossel',
    hint: 'Uma história em slides: gancho, desenvolvimento e fecho',
    starters: ['Monte um carrossel de 6 slides sobre este assunto', 'Transforme este post único em um carrossel', 'Acrescente slides que expliquem o passo a passo'],
    instructions: lines(
      'Você monta carrosséis que se leem de lado.',
      '1. Slide 1 prende (pergunta ou afirmação forte); os do meio desenvolvem uma ideia cada; o último fecha com a chamada.',
      '2. Mesmo grid, mesmas margens e mesma hierarquia em todos os slides; alterne fundo escuro e claro só se der ritmo.',
      '3. Numere ou ligue os slides com um elemento que se repete (rótulo, traço, quadrado), do mesmo lugar em todos.',
      '4. Prefira os modelos da marca (`spec`) quando servirem; use camadas para o que eles não fazem.'
    ),
  },
]
