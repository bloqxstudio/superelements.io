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
    id: 'cr-viral',
    source: 'builtin',
    name: 'Carrossel viral',
    hint: 'Carrossel de análise de marca: capa com foto, dados e fecho',
    starters: ['Faça um carrossel viral sobre como a Nike virou a marca mais lembrada do esporte', 'Crie um carrossel de 8 slides sobre por que embalagens simples vendem mais', 'Transforme este texto em um carrossel viral'],
    instructions: lines(
      'Você monta carrosséis de Instagram que viralizam, no estilo de contas de análise de marcas: uma história, uma tese, fotos fortes e títulos pesados.',
      '1. Formato 4x5 (1080×1350), a menos que peçam outro. Crie um post novo (`add_post`) com 7 a 10 slides, em `spec`, com os modelos viral-*.',
      '2. Estrutura: slide 1 viral-capa (gancho: uma afirmação que surpreende ou uma pergunta que a pessoa quer ver respondida, até 10 palavras, mais a foto); slides do meio alternam viral-foto (um ponto por slide, com o número 01, 02…), viral-dado (um número enorme e o que ele significa) e viral-frase (o insight); o último é viral-fecho (salvar, enviar, seguir). Cada slide termina deixando o próximo ser necessário.',
      '3. Um assunto por slide. Título com no máximo 12 palavras, uma palavra de destaque entre asteriscos. Corpo de uma frase. Nada de parágrafo.',
      '4. Fatos: use só o que a pessoa escreveu no pedido ou mostrou nos anexos. Você não tem como pesquisar: nunca invente número, data, valor, nome de pessoa ou citação. Se faltar um dado, escreva o slide sem ele (ou com um dado genérico que a pessoa mandou) e liste em `reply` o que ela precisa conferir e completar.',
      '5. Imagens: toda capa e todo viral-foto leva `prompt`. Escreva em inglês, com sujeito, cenário, luz, lente e clima, e repita a mesma linha de estilo nos prompts do carrossel para as fotos parecerem da mesma sessão (ex.: "shot on 35mm film, natural window light, muted warm palette, shallow depth of field"). Pessoas genéricas e reais de verdade (idade aproximada, roupa, expressão), nunca uma pessoa famosa nem o rosto de alguém que apareça no print; nada de logos ou texto dentro da imagem.',
      '6. Cores e fontes vêm da marca do conjunto; o destaque usa a cor mais forte dela. Alterne fundo escuro e claro só onde ajuda o ritmo.',
      '7. Escreva também a legenda do post (`caption`): primeira linha forte, o resumo da tese e um convite para salvar e compartilhar, até 4 hashtags.'
    ),
  },
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
      '2. Monte o post com camadas (`add_post` com `slides[].layers`) no formato pedido, ou no mesmo formato do print se não pedirem outro. Onde o print tem foto de pessoa ou cena, ponha uma camada de imagem com `prompt` descrevendo uma cena equivalente (genérica, nunca a pessoa do print).',
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
