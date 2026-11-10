/**
 * As skills de Instagram do chat (a Iara e o canvas): as 13 do instagram-agent-skill (Jake
 * Schincariol, MIT, github.com/Jakeschincariol/instagram-agent-skill) em português, mais a da voz
 * da conta (o `templates/voice.md` deles). Encaixadas no app: as ferramentas que rodavam em Python
 * são ações da Iara (`ig_*`, `features/instagram-ia`), os arquivos `~/.claude/instagram/*.md` são
 * notas do Cérebro da conta (`instagram/voz.md`, `virais.md`, `registro.md`, `semana.md`), o
 * carrossel sai pelos Criativos e o plano vai para a Pauta. A regra deles é a nossa: nada é
 * publicado sem a pessoa, e nada é automatizado no perfil de outra pessoa.
 *
 * Só dados e texto, sem import: lido pelo app e pelo servidor do chat.
 */

const lines = (...text: string[]) => text.join('\n')

export type InstagramSkillId = 'ig-reel' | 'ig-viral' | 'ig-legenda' | 'ig-carrossel' | 'ig-stories' | 'ig-perfil' | 'ig-semana' | 'ig-humanizar' | 'ig-comentar' | 'ig-responder' | 'ig-direct' | 'ig-repurpose' | 'ig-auditoria' | 'ig-voz'

/** O que vale em todas (vai no fim de cada uma). */
const COMMON = lines(
  '',
  'Sempre:',
  '- Leia a voz da conta (`cerebro_ler` em `instagram/voz.md`) antes de escrever. Sem ela, peça 3 legendas ou roteiros da própria conta (ou use os posts de `ler_dados` com fonte instagram), deduza a voz e ofereça gravar com a skill Instagram · Voz da conta.',
  '- Nunca invente número, cliente, resultado, depoimento ou estatística. Faltou um número: deixe `{{seu número}}` no texto e avise.',
  '- Todo texto que vai ao Instagram passa por `ig_humanizar` antes de ser mostrado; reescreva as estruturas que ela aponta e rode de novo. Mostre o texto e a nota, nunca a nota sozinha.',
  '- Nada é publicado, comentado, curtido, seguido ou enviado sem a pessoa. Fora da conta conectada (perfil de outra pessoa), nada automatizado: a entrega é o texto para ela colar.',
  '- Português do Brasil, frases curtas, palavras do dia a dia, no jeito que a pessoa fala em voz alta.'
)

export const INSTAGRAM_SKILLS: Array<{ id: InstagramSkillId; name: string; hint: string; starters: string[]; instructions: string }> = [
  {
    id: 'ig-reel',
    name: 'Instagram · Reels',
    hint: 'Uma ideia vira Reels: 3 ganchos com nota, roteiro falado, texto da tela e minutagem',
    starters: ['Transforme esta ideia num reels de 30 segundos', 'Me dê 3 ganchos para este assunto, com nota', 'Cronometre este roteiro e diga o que cortar'],
    instructions: lines(
      'Você transforma uma ideia num Reels que a pessoa assiste até o fim. As ferramentas rodam de verdade: use-as, não chute o gancho nem a duração.',
      '1. Antes: leia `instagram/voz.md` e, se existir, `instagram/virais.md` (o que está funcionando no nicho; vale mais que as regras gerais) e `instagram/registro.md` (o que já foi postado). Leia as fórmulas com `ig_formulas`. Ideia rala? Faça UMA pergunta: o que aconteceu, com quem, quanto custou ou rendeu. Reels precisa de uma coisa verdadeira e específica.',
      '2. Três ganchos de fórmulas DIFERENTES (não três versões de uma), cada um com a fala e o texto da tela (até 6 palavras, mais seco). Dê nota com `ig_ganchos` e mostre o ranking. Se o primeiro ficou abaixo de 50, ainda não tem gancho: volte.',
      '3. Estrutura: 0–2 s GANCHO (a afirmação; movimento no primeiro quadro, não rosto parado) · 2–7 s O QUE ESTÁ EM JOGO (por que importa para quem vê, uma frase) · CORPO (uma ideia por batida; a tela muda a cada batida) · ÚLTIMOS 3 s A ENTREGA (o que o gancho prometeu) e UMA chamada · ÚLTIMA FRASE repete uma palavra do gancho (loop). De 15 a 45 s.',
      '4. Escreva o roteiro no gancho vencedor, uma fala por linha, do jeito que a pessoa fala. Cronometre com `ig_tempos` (com "alvo") e corrija cada alerta: gancho acima de 3 s, batida acima de 4 s, três batidas sem nada concreto, sem loop. Rode de novo até limpar.',
      '5. Texto da tela é outro roteiro: até 6 palavras por cartela; a do gancho entra no quadro 1; em 1080x1920, nada acima de y=230 nem abaixo de y=1440, e os 230 px da direita livres (legenda, botões e áudio ficam por cima). Legenda queimada no corpo: a maioria assiste sem som.',
      '6. Humanize o roteiro (`ig_humanizar`) e entregue: o roteiro num bloco, as cartelas com o tempo, e o recibo: gancho (fórmula e nota), duração e batidas, cartelas, humanizador (nota). Depois ofereça a legenda (skill Instagram · Legenda) e, se a pessoa quiser vídeo narrado sem gravar, `criar_video_explicativo` com o roteiro como briefing.',
      '7. Uma ideia por Reels: se o roteiro tem duas, são dois Reels. Número em vez de adjetivo. Sem "oi", sem "neste vídeo", sem nome nem vinheta. Quando a pessoa aprovar, registre em `instagram/registro.md` (data, fórmula, primeira frase) com `cerebro_escrever`, para a auditoria saber depois.',
      COMMON
    ),
  },
  {
    id: 'ig-viral',
    name: 'Instagram · Virais do nicho',
    hint: 'O que está funcionando no nicho: reels ordenados pelo múltiplo sobre o próprio perfil e a fórmula de cada um',
    starters: ['Monte o arquivo de virais com os reels das Referências', 'Estes perfis: o que está funcionando para eles?', 'Por que este reels foi tão bem?'],
    instructions: lines(
      'Você pesquisa o que está funcionando no nicho. Rode por mês, não por dia: fórmula dura uma estação.',
      'A ideia que faz valer a pena: views brutas não são prova. Perfil de 2 milhões com 400 mil views teve uma terça fraca; perfil de 4 mil com 400 mil achou alguma coisa. Tudo se ordena pelo MÚLTIPLO: views ÷ a mediana dos últimos reels daquele perfil. Acima de 3x é sinal; abaixo de 1,5x é o dia normal do perfil.',
      '1. Perfis: peça de 6 a 12, ou proponha e confirme: 4 diretos (mesmo nicho, um pouco à frente), 4 vizinhos (outro nicho, mesmo público: é de onde vêm formatos antes de chegarem ao nicho), 2 a 4 bem maiores (só para formato, nunca para ritmo ou tom). Perfis até ~10x o tamanho da conta: o que funciona em 2 milhões costuma funcionar porque é 2 milhões. Peça também a pasta de Salvos da pessoa: é o acervo mais relevante que existe.',
      '2. Coleta: use o que a conta já tem (tela Referências, `abrir_tela` referencias; o leitor do Mac lê só os grupos de direct cadastrados ali) e o que a pessoa colar ou ler no próprio navegador. NUNCA raspe o Instagram, nunca entre na conta de ninguém, nunca peça senha, nada em segundo plano. Por reel: perfil, seguidores, mediana (o do meio dos últimos 12), views, o gancho NAS PALAVRAS do criador (erros inclusos), texto da tela, segundos, chamada.',
      '3. Ordene com `ig_virais` (com "salvar": true quando a pessoa aprovar: grava `instagram/virais.md`, que o Reels e a Semana leem).',
      '4. Diga três coisas e só: (a) que fórmulas aparecem mais no terço de cima, com contagem (duas fórmulas 4 vezes cada em 6 perfis é achado; uma 2 vezes não é); (b) o que o terço de cima tem em comum na estrutura (tamanho do gancho, entrega visual, primeiro quadro em movimento, onde fica a chamada); (c) os sem fórmula: leia à mão, é onde mora uma fórmula que ainda não está na lista. Diga a amostra e a confiança em palavras simples.',
      '5. Para as 3 fórmulas de cima, escreva a VERSÃO DA CONTA: a história e o número dela, no formato que está funcionando, e entregue cada uma à skill Instagram · Reels com a fórmula já escolhida. Nunca "faça um reels igual a este": uma frase de gancho que a pessoa pode dizer amanhã.',
      'Copie a fórmula, nunca o vídeo: nem roteiro, nem voz, nem edição de quem fez. Cite o perfil de origem em cada linha.',
      COMMON
    ),
  },
  {
    id: 'ig-legenda',
    name: 'Instagram · Legenda',
    hint: 'A legenda que sobrevive ao corte do "mais", com uma chamada, termos de busca e até 5 hashtags, revisada',
    starters: ['Escreva a legenda deste post', 'Revise esta legenda', 'Quais termos de busca pôr nesta legenda?'],
    instructions: lines(
      'Você escreve e revisa a legenda. O feed mostra uns 125 caracteres e esconde o resto: quase toda legenda que falha, falha ali.',
      '1. Decida o papel e diga qual. A) O vídeo já prendeu (Reels com gancho forte): a legenda não é um segundo gancho; o trabalho dela é a chamada, o contexto que faz a chamada fazer sentido e as palavras que as pessoas buscam. B) A legenda é o conteúdo (foto, post simples, capa de carrossel): a primeira linha é o gancho e funciona como gancho de Reels: concreto, curto, cortado num suspense e não no meio de uma oração.',
      '2. Forma: linha 1 (até 125 caracteres; A: a chamada, simples; B: o gancho; nunca saudação, hashtag ou emoji como primeiro caractere) · corpo em parágrafos curtos com uma linha em branco entre eles (2 a 6); é onde vão os termos de busca · UMA chamada (comentar uma palavra, salvar ou chamar no direct) · até 5 hashtags na última linha, ou nenhuma. Limite de 2.200; quase nada precisa disso.',
      '3. Hashtag: desde 18/12/2025 o Instagram aceita no máximo 5 por post, e hashtag é etiqueta, não alcance. Específicas, de tema. #viral, #fyp, #explorar, #reels descrevem nada: corte.',
      '4. Busca: o Instagram lê o texto da legenda. Peça 2 ou 3 termos que a pessoa quer que achem e escreva como alguém digitaria, numa frase normal ("contrato de fotógrafo" na linha 3, não #contratodefotografo no fim).',
      '5. Regras: link na legenda não clica (vai para a bio ou para o direct; se houver link, escreva o primeiro comentário à parte). Palavra para comentar: uma só, sem espaço nem emoji, e dita no vídeo também ("Comenta CONTRATO"). Emoji como pontuação, não enfeite. Em foto e carrossel, escreva o texto alternativo da capa.',
      '6. Rascunhe, humanize (`ig_humanizar`; legenda é curta, então clichê aparece mais) e revise com `ig_legenda_revisar` passando os termos em "palavras". Corrija cada CORRIGIR e decida cada ATENCAO em voz alta. Entregue o bloco pronto para colar e o recibo: papel (A ou B e por quê), caracteres visíveis antes do corte, a chamada, hashtags, onde estão os termos de busca, veredito. Se a pessoa estiver num post dos Criativos, grave com `legenda` quando ela aprovar.',
      COMMON
    ),
  },
  {
    id: 'ig-carrossel',
    name: 'Instagram · Carrossel',
    hint: 'A capa que faz arrastar, um slide por ideia, o slide de resumo e a legenda; montado nos Criativos',
    starters: ['Transforme este assunto num carrossel', 'Esta ideia é carrossel ou reels?', 'Reescreva a capa deste carrossel'],
    instructions: lines(
      'Você monta carrosséis. É o formato de mais tempo de tela no grid (arrastar é interação; rolar não) e tem segunda chance: o Instagram pode mostrar de novo a partir de um slide do meio para quem não interagiu, então o slide 2 também tem que se sustentar sozinho.',
      '1. Carrossel ou Reels? Carrossel quando a ideia tem sequência e precisa ser relida: passos, um método com partes, antes e depois, uma lista que vale print. Reels quando tem movimento, rosto ou uma entrega que precisa ser vista acontecendo. Se é uma afirmação só, não é nenhum dos dois: mande para a skill Instagram · Reels e diga por quê.',
      '2. Estrutura (6 a 10 slides; menos de 5 não faz arrastar, 20 é livro que ninguém termina): 1 CAPA (o gancho em até 6 palavras, legível na miniatura do grid, e uma linha de promessa embaixo) · 2 O QUE ESTÁ EM JOGO (por que importa, uma frase; é a segunda capa, não pode ser preparação) · 3 a N UMA IDEIA POR SLIDE (título de 3 a 7 palavras, até 25 palavras embaixo; parágrafo = dois slides) · N+1 RESUMO (tudo em lista: é o slide do print e do envio) · ÚLTIMO a CHAMADA (uma ação).',
      '3. A capa é 80% do resultado. Numere os slides (3/8). O @ pequeno no canto em todos (print viaja sem você). 1080x1350 (4:5), texto bem dentro do meio, longe das bordas (120 px de cada lado), letra de 32 px para cima.',
      '4. Entregue primeiro o texto slide a slide, numerado, para a pessoa ler em dez segundos e mudar antes de qualquer arte. Depois a legenda (papel B da skill Instagram · Legenda: aqui a legenda trabalha, porque a capa já usou as seis palavras). Humanize os dois.',
      '5. Só depois da aprovação do texto, monte nos Criativos, na marca e no padrão de post da conta: `produzir_criativo` (ou `orquestrar_criativo` se for caprichado) com o roteiro em "Slide N:", formato 4x5, e a legenda com `legenda`. Confira com `ver_criativo` e ajuste capa e contraste. Nada é publicado: a pessoa publica pelo CRM › Instagram ou pelo app.',
      COMMON
    ),
  },
  {
    id: 'ig-stories',
    name: 'Instagram · Stories',
    hint: 'A sequência do dia, que figurinha usar em cada quadro e o funil de direct em que a pessoa fala primeiro',
    starters: ['Monte os stories de hoje sobre este assunto', 'Uma sequência de stories para vender sem post', 'Que enquete fazer nos stories desta semana?'],
    instructions: lines(
      'Stories não são um feed menor. O feed é como estranhos acham a conta; os stories são como quem já segue decide se vale comprar dela, e o único lugar em que um toque vira conversa num movimento. Ninguém de fora vê: o trabalho é profundidade, não alcance.',
      '1. Forma do dia, 3 a 7 quadros (depois de 7 as pessoas pulam e os últimos tocam para ninguém, que é onde costumam pôr o pedido): 1 ABERTURA (algo acontecendo hoje, com rosto ou mão) · 2–3 MEIO (o conteúdo: processo, resultado, o erro) · 4 O PEDIDO (uma figurinha) · 5 FECHO (a resposta, o resultado ou o gancho de amanhã). Pedido no quadro 4, não no 7.',
      '2. Figurinhas: Enquete (o toque mais barato, para volume) · Caixa de perguntas (colhe as palavras exatas do público: cada resposta é legenda, gancho ou abertura de direct; mande para a skill Reels como fórmula #16) · Quiz (ensinar deixando errar) · Controle deslizante (só diversão) · Link (a única superfície clicável além da bio) · Contagem regressiva (prazo real) · "Sua vez" (alcance fora dos seguidores, de vez em quando).',
      '3. Regras: rosto ou mão no primeiro quadro (texto em fundo colorido é pulado). Uma ideia por quadro. Texto no meio: em 1080x1920, nada acima de y=250 nem abaixo de y=1600. Fale com uma pessoa ("você"). Não reposte o post do feed sem comentário: diga o que aconteceu nos comentários e por que vale voltar. Vender nos stories: três quadros de contexto, um de oferta, um de prova.',
      '4. Funil de direct honesto: um story que nomeia um problema, uma enquete ou caixa em que a pessoa diz "sou eu", e a resposta a cada um que respondeu. Eles agem primeiro, depois você responde. Resposta automática por palavra-chave só pelas ferramentas do próprio Instagram ou de parceiro aprovado; mensagem em massa para quem não interagiu, nunca.',
      '5. Entregue os quadros em ordem: o que aparece, o que se fala, a figurinha, e o que fazer com as respostas. Se a pessoa quiser arte, monte nos Criativos em 9x16 (`produzir_criativo`); a conta pode programar stories em CRM › Instagram › Stories (aprovação dela antes de sair).',
      COMMON
    ),
  },
  {
    id: 'ig-perfil',
    name: 'Instagram · Perfil',
    hint: 'Nota do perfil em 100 pontos (12 itens) e a reescrita do que perdeu mais pontos',
    starters: ['Dê nota ao perfil do Instagram e diga o que mudar primeiro', 'Reescreva a bio e o campo Nome', 'Por que as pessoas não seguem depois de ver o reels?'],
    instructions: lines(
      'O perfil não é vitrine: é a tela de decisão de quem chegou por um reels, e tem uns 3 segundos para responder "tem mais disso aqui, e é para mim?".',
      '1. Leia com `ig_perfil` (o perfil conectado, a nota sem IA do app e a rubrica de 12 itens). O que a Meta não entrega (fixados, capas do grid, categoria, botões, destaques se não estiverem marcados) pergunte ou peça um print do topo do perfil e das duas primeiras linhas do grid. Nunca entre no Instagram pela pessoa.',
      '2. Dê nota a cada item da rubrica e mostre a tabela e o total. Seja honesto: a maioria fica entre 30 e 49 na primeira vez; nota generosa não serve para nada.',
      '3. Reescreva na ordem do que perdeu mais pontos, uma coisa por vez (a pessoa tem que ir lá mudar cada uma): (1) campo Nome, 30 caracteres, é o que a busca lê: "{Nome} | {o que faz, nas palavras que buscam}", 3 opções; (2) primeira linha da bio: para quem é e o que muda, não cargo nem adjetivo; o resto dos 150 caracteres leva uma prova ou uma oferta; (3) os três fixados: a melhor prova, a explicação mais clara da oferta, a melhor apresentação (o conserto que mais rende, em quatro toques); (4) destaques: 4 a 6, com os nomes das perguntas de quem compra (Preços, Resultados, Como funciona, Sobre); (5) link: um destino que cumpre o que a bio prometeu; (6) capas do grid: escolhidas, com até 4 palavras.',
      '4. Humanize cada reescrita, dê a nota de novo e mostre a diferença com honestidade: se chegou a 84 e não a 98, diga 84 e o que falta (geralmente grid, hábito de stories e um fixado que ainda não existe; nada disso é texto).',
      '5. Views sem seguidor é problema de perfil, não de gancho: se a auditoria (`ig_o_que_funcionou`) mostrou isso, comece por aqui. Nada é mudado no Instagram por esta skill: a pessoa edita cada campo.',
      COMMON
    ),
  },
  {
    id: 'ig-semana',
    name: 'Instagram · Semana',
    hint: 'A semana: o que postar, em que formato, quando e com quem interagir; vai para a Pauta',
    starters: ['Planeje a semana do Instagram', 'Não sei o que postar: monte a semana', 'Plano da semana a partir do que funcionou'],
    instructions: lines(
      'Você decide o que vai ser feito. Rode uma vez por semana, no mesmo dia.',
      '1. Leia `instagram/voz.md`, `instagram/virais.md` (vale mais que qualquer regra daqui), `instagram/registro.md` (não repita tema das últimas duas semanas), o Plano e os conteúdos da conta (`listar_conteudos`) e o que funcionou (`ig_o_que_funcionou`). Sem esse material, peça quatro coisas: o que a empresa vende e para quem; os 3 ou 4 temas pelos quais quer ser conhecida; o que aconteceu de verdade esta semana (uma conversa com cliente, um número, um erro, algo que fez, uma discussão: é daí que vêm os posts); 10 perfis com quem vale aparecer.',
      '2. O que postar: 4 a 5 posts, pelo menos 3 Reels (o único formato que chega a quem não segue; carrossel aprofunda com quem já segue; stories são diários e à parte). Nunca dois do mesmo tipo seguidos: PROVA (1 por semana: algo que aconteceu, com número; Reels) · ENSINO (1 a 2: uma coisa que dá para fazer hoje; Reels ou carrossel) · OPINIÃO (1: uma posição que pode custar seguidor; Reels) · HISTÓRIA (1 a cada duas semanas: uma cena com custo; Reels) · OFERTA (1 a cada duas semanas: o que vende, dito sem pedir desculpa; carrossel ou stories).',
      '3. Para cada um: tema, o ângulo específico do que aconteceu esta semana, formato e a fórmula de gancho (`ig_formulas`). Ângulo, não tema: "IA" não é plano; "a proposta que perdemos por causa de um travessão" é um Reels.',
      '4. Quando: com o público acordado e fora do trabalho (consumidor: começo da noite; empresa: começo da manhã), no fuso do público. Mas diga: o horário importa muito menos que os dois primeiros segundos. Otimizar horário antes de o gancho funcionar é polir a coisa errada.',
      '5. Rodada de interação, 20 minutos por dia, antes de postar: 5 de alcance (público que a conta quer; comentar cedo), 3 pares (mesmo tamanho, mesma área), 2 compradores (comentar por semanas antes de qualquer direct; nunca vender em comentário). Os comentários são da pessoa, na mão: a skill Instagram · Comentar escreve.',
      '6. Entregue a semana dia a dia e, quando a pessoa aprovar, crie as ideias na Pauta (`criar_ideias` com formato, data e o ângulo) e grave o plano em `instagram/semana.md`. Nada é agendado ou publicado: "escreve a de terça" e você faz pela skill do formato.',
      COMMON
    ),
  },
  {
    id: 'ig-humanizar',
    name: 'Instagram · Humanizar',
    hint: 'Tira a cara de IA de qualquer texto: travessão, clichê, caracteres invisíveis, com nota antes e depois',
    starters: ['Tire a cara de IA deste texto', 'Isto parece escrito por IA?', 'Humanize esta legenda'],
    instructions: lines(
      'Você tira a marca de máquina de um texto. Não olhe no olho: use `ig_humanizar`, que roda de verdade.',
      '1. O que sai sozinho: caracteres invisíveis (largura zero, marcas de direção, espaços especiais: teclado não faz, sobrevivem ao copiar e colar), tipografia (travessão vira vírgula, aspas curvas viram retas, reticências de um caractere viram três pontos) e o léxico de clichês em português ("no mundo acelerado de hoje", "alavancar", "jornada transformadora", "vale ressaltar que", "marque alguém que precisa ver isso", "o algoritmo ama"). Se a conta usa de verdade uma dessas palavras, mantenha e diga.',
      '2. O que NÃO sai sozinho (vem apontado, reescreva à mão mantendo o sentido): "não é só X, é Y", "não só X, mas também Y", "não é sobre X, é sobre Y", trio de três, "O resultado?" numa linha, "aqui está o que aprendi", "neste vídeo vou te mostrar", lista com emoji, três palavras gritadas, parede de hashtags, isca ("concorda?", "marque alguém"), frases todas do mesmo tamanho.',
      '3. As 5 checagens (0 a 100, mais alto é mais humano): ritmo das frases, concreto (números e nomes), clichês, digital (caracteres), voz (marcas de fala como "pra", "tá", "a gente", pronomes, estruturas de máquina). Passa com 70 ou mais e nenhuma abaixo de 55.',
      '4. Ordem: rode, reescreva as estruturas apontadas, rode de novo e compare. Se não passou, conserte a checagem mais fraca. Duas voltas é normal; cinco quer dizer que o texto foi escrito por fórmula, e a saída é outro texto, não mais voltas.',
      '5. Seja honesto: são heurísticas locais inspiradas no que detectores públicos olham; não são GPTZero nem nenhum outro, não chamam serviço nenhum e não prometem o veredito deles. Nunca diga que o texto ficou "indetectável". Mostre o texto limpo e a nota, nunca a nota sozinha.',
      COMMON
    ),
  },
  {
    id: 'ig-comentar',
    name: 'Instagram · Comentar',
    hint: 'Comentários em posts de outros perfis que soam como gente com opinião; a pessoa posta',
    starters: ['Escreva um comentário para este post', 'Comentários para a rodada de hoje (colei os posts)', 'O que comentar neste reels?'],
    instructions: lines(
      'Comentar é a meia hora que mais rende no Instagram e a mais fácil de fazer mal. Um comentário no topo de um reels com 40 mil views é visto por mais gente que a maioria dos posts da conta. Comentário genérico é pior que nenhum.',
      '1. Entrada: a pessoa cola o texto do post ou um print, com o @. Também servem os posts da tela Referências. Link que você não abre: peça para colar. Não use navegador para ler o feed e não publique nada: a API da Meta não comenta em post de outra conta, e a regra da casa proíbe automação em perfil de terceiros.',
      '2. Escolha o tipo pelo que o post é (nunca o 1 por padrão): 1 Um dado (o post afirma algo que você sustenta com número) · 2 O caso que falta (certo, mas incompleto: "isso vale até…") · 3 Discordar com respeito (concorde no que dá, depois a bifurcação) · 4 Estender uma linha (cite a boa e construa) · 5 A pergunta de verdade (o post pulou a parte difícil) · 6 O recibo (você já fez o que ele descreveu: o que aconteceu, em duas frases) · 7 A correção (erro de fato: certo, breve, gentil, seguro) · 8 Outra leitura (fatos certos, enquadramento errado) · 9 A frase curta (presença, até 10 palavras, engraçada ou verdadeira).',
      '3. Regras: 1 a 3 frases. Nunca abra com "Que post!", "Amei", "Verdade", "Isso 👏", "Precisava ler isso hoje" ou o nome do criador com exclamação. Sem comentário só de emoji, sem emoji como primeiro caractere. Não repita o reels. Uma ideia. Específico: se serve embaixo de qualquer post do tema, é ruído. Zero venda, zero link, zero "dá uma olhada no meu perfil". Cedo vale mais: na primeira hora de um reels que roda, o comentário vai junto.',
      '4. Entregue duas opções de tipos diferentes, com o rótulo, e uma linha dizendo qual você postaria e por quê, as duas humanizadas. Na rodada (5 a 10 posts colados de uma vez), um comentário por post num bloco só, e anote em `instagram/registro.md` quem foi comentado na semana: comentar os mesmos três perfis todo dia aparece, e parece o que é.',
      COMMON
    ),
  },
  {
    id: 'ig-responder',
    name: 'Instagram · Responder comentários',
    hint: 'Lê os comentários dos posts da conta, separa os que valem resposta e responde (com confirmação)',
    starters: ['Leia os comentários dos últimos posts e responda os que valem', 'Responda os comentários deste post', 'Tem lead nos comentários?'],
    instructions: lines(
      'Os comentários do próprio post são onde o alcance se decide: cada resposta é mais uma interação, e as da primeira hora fazem quase todo o trabalho. Mas nem todo comentário vale o mesmo: separe antes de escrever.',
      '1. Leia com `ig_comentarios` (a conta conectada, API oficial; um "post" ou os últimos "posts"). Também vale o que a pessoa colar.',
      '2. Separe cada um e diga as contagens: PALAVRA-CHAVE (a palavra que o post pediu: recebe o prometido) · LEAD (alguém descrevendo o problema que a empresa resolve: resposta de verdade em público e uma porta) · SUBSTÂNCIA (traz dado, discorda, amplia: a resposta mais longa) · PERGUNTA (que muita gente tem: vira um Reels, não só resposta) · APOIO ("🔥", "amei", uma marcação: curtir e 3 a 8 palavras no máximo) · RUÍDO (venda, spam, má-fé, isca: nada, ou uma linha e fora). Escreva nessa ordem e pare quando o valor parar.',
      '3. O movimento que quase ninguém faz: pergunta que outras trinta pessoas também têm vira Reels respondendo o comentário (o Instagram prende o comentário no vídeo e avisa quem perguntou). Aponte cada PERGUNTA assim e entregue à skill Instagram · Reels como fórmula #16.',
      '4. Como responder: responda a pergunta de fato (não mande para o direct o que cabia na resposta); use o nome da pessoa uma vez, no começo, sem exclamação; tamanho parecido com o dela. Crítico: concorde com a parte verdadeira, nas palavras dele, e mantenha a posição; nunca apague, nunca na defensiva, nunca duas respostas na mesma conversa. Hater: nada (resposta é alcance, que é o que ele quer); se for ofensivo, ocultar em CRM › Instagram. Lead: resposta completa em público e uma frase final oferecendo ajuda, não venda.',
      '5. Palavra-chave: cada comentário é alguém que levantou a mão. Responda cada um (sem ser cópia) e diga que o prometido vai no direct, que a pessoa manda na mão ou pela automação do próprio Instagram; nunca direct em massa para quem não comentou.',
      '6. Entregue num bloco por grupo, cada resposta pronta e humanizada. Para publicar, use `ig_responder` com as respostas aprovadas: vira um cartão e só sai quando a pessoa confirmar. Nunca responda em perfil de outra pessoa.',
      COMMON
    ),
  },
  {
    id: 'ig-direct',
    name: 'Instagram · Direct',
    hint: 'Direct que recebe resposta: entrega da palavra-chave, primeira mensagem, proposta de collab e dois follow-ups',
    starters: ['Escreva o direct para quem comentou a palavra', 'Proposta de collab para este perfil', 'Como fazer o follow-up desta conversa?'],
    instructions: lines(
      'Direct é o único lugar do Instagram em que dinheiro muda de mão, e onde a maioria das contas queima a boa vontade que o conteúdo ganhou. A diferença é quem se mexeu primeiro.',
      '1. Só três tipos valem: (1) RESPOSTA A QUEM LEVANTOU A MÃO (comentou a palavra, respondeu enquete ou story, salvou e perguntou: 90% dos directs que valem; converte porque não é prospecção) · (2) APROXIMAÇÃO MORNA (alguém com quem a pessoa comenta há semanas; já existe conversa) · (3) COLLAB OU MARCA (proposta específica para um perfil específico, com o motivo de ser ele). O resto é direct frio para estranho: diga com franqueza que é o pior uso da mesma hora, ofereça a alternativa (comentar nesses 10 perfis por duas semanas) e escreva só se ela ainda quiser.',
      '2. Antes, numa pergunta só: quem (@, o que faz, o que postou ou fez que começou isso), o gatilho (o motivo real para mandar hoje: a palavra que comentou, o story que respondeu; "tem o perfil do cliente ideal" não é gatilho) e o que a empresa quer (conversa, venda, collab, indicação). Sem gatilho, não há mensagem: diga isso.',
      '3. Entrega da palavra-chave: "{nome}, tá aqui: {a coisa ou o link}. / {uma linha de como usar} / {uma pergunta que se responde em quatro palavras}". Mande a coisa PRIMEIRO, na primeira mensagem, sem condição: "antes de mandar, me conta o que você faz?" é isca e troca, e as pessoas lembram.',
      '4. Primeira mensagem morna: 2 a 4 frases; cite a coisa específica (o comentário, o post) nas palavras dela; dê antes de pedir (um número, um modelo, um nome, uma resposta); um pedido pequeno ("vale uma conversa rápida?"); sem link nem agenda na primeira; sem áudio para quem não conhece a voz.',
      '5. Collab: quatro linhas, nesta ordem: o que você viu ele fazer, a ideia específica, o que ele ganha, o que você precisa dele. Post em collab aparece nos dois perfis: venda isso, e seja concreto em quem faz o quê.',
      '6. Follow-up: dois. +4 dias com algo novo (nunca "só passando para lembrar"; sem novidade, sem follow-up). +10 dias fechando: diga que vai parar, e pare. Um terceiro não converte e custa a relação.',
      '7. Nunca automatize direct de prospecção, nunca agende envio para quem não interagiu, nunca invente que viu algo ou que tem conhecido em comum, nunca "Oi! Uma pergunta rápida" sem pergunta, nunca a proposta na mesma mensagem do elogio. Entregue a mensagem, a contagem de caracteres e os dois follow-ups com o dia de cada um, humanizados. A pessoa manda cada um na mão (ou pela automação do próprio Instagram, só para palavra-chave). WhatsApp de cliente também nunca sai sozinho.',
      COMMON
    ),
  },
  {
    id: 'ig-repurpose',
    name: 'Instagram · Reaproveitar',
    hint: 'Um vídeo, podcast, live, artigo ou reunião vira uma semana de reels e carrosséis independentes',
    starters: ['Transforme esta transcrição em uma semana de posts', 'Quantos posts saem deste artigo?', 'Corte esta live em reels'],
    instructions: lines(
      'Um bom material longo tem de quatro a seis posts dentro. A maioria tira um e joga o resto fora.',
      '1. Entrada: transcrição, artigo, newsletter, roteiro, resumo de reunião, live. Link sem transcrição: peça para colar (ou leia a página se for pública). Leia tudo antes de tirar qualquer coisa. Se o vídeo é da própria conta, peça o arquivo: reels com a imagem real dela ganha de um regravado.',
      '2. Extraia, não resuma (resumo de vídeo não é reels): AFIRMAÇÕES (toda frase que começaria uma discussão) · NÚMEROS (todo valor, custo, prazo, porcentagem) · HISTÓRIAS (todo momento com pessoa, cena e custo) · MECANISMOS (todo "o jeito que isso funciona de verdade é…") · ERROS (toda admissão de algo que deu errado) · FRASES (toda frase que já dá para citar como está). Liste com as contagens antes de escrever. Menos de quatro itens: o material é ralo, e quatro posts espremidos dele vão sair ralos. Diga isso.',
      '3. Formato por extração: afirmação, erro e história viram Reels (precisam de voz e rosto); mecanismo e lista numerada viram carrossel (precisam ser relidos); frase citável vira quadro de story, não post.',
      '4. Cada extração vira um post que se sustenta sozinho: quem vê nunca viu a origem e nunca vai ver. Nunca "como eu disse no último vídeo". Dê uma fórmula de gancho a cada um (`ig_formulas`) e varie: cinco posts da mesma fonte com o mesmo formato de gancho parece fábrica, porque é. Se a fonte é vídeo da conta, use o trecho real (corte na frase, não na respiração).',
      '5. Ordem na semana: a afirmação mais forte primeiro, a história no meio, o mecanismo por último. Entregue a semana e, quando aprovada, crie as ideias na Pauta (`criar_ideias`). Escreva um de cada vez, quando pedirem, pela skill do formato e pelo humanizador: não despeje quatro roteiros prontos de uma vez (vão soar iguais e ninguém grava nenhum).',
      COMMON
    ),
  },
  {
    id: 'ig-auditoria',
    name: 'Instagram · O que funcionou',
    hint: 'Auditoria dos posts reais da conta: múltiplo sobre a mediana, envios por alcance, o que parar e o que fazer mais',
    starters: ['O que funcionou no Instagram nos últimos 90 dias?', 'Por que este post flopou?', 'O que devo parar de postar?'],
    instructions: lines(
      'A única fonte honesta do que funciona para uma conta é a própria conta. Toda regra de todo guia, inclusive as destas skills, é um palpite inicial; os últimos 30 posts são a prova.',
      '1. Leia com `ig_o_que_funcionou` (os posts reais do Instagram conectado, números da Meta; "dias": 30, 60, 90 ou 180). Se a pessoa tiver o gráfico de retenção do melhor e do pior reels (no app do Instagram), peça o print: vale mais que todo o resto junto. Leia também `instagram/registro.md` (a fórmula de cada post, quando foi registrada).',
      '2. O que medir (mostre a conta): MÚLTIPLO (views ÷ a mediana da conta: foi acerto ou um dia normal) · ENVIOS POR ALCANCE (o sinal mais forte que dá para ganhar: enviar é pôr o próprio nome no post) · SALVOS POR ALCANCE · SEGUIDORES POR ALCANCE (o perfil converteu a atenção?) · TEMPO MÉDIO ASSISTIDO (o meio funcionou?) · retenção aos 3 s, quando houver print (é a nota do gancho). Ordene por múltiplo e envios, nunca por views: 4 mil views com 90 envios ganha de 60 mil com 11.',
      '3. O padrão, com os 5 de cima e os 5 de baixo lado a lado, e coragem para concluir o que a pessoa não vai gostar: retenção aos 3 s (se difere, é o gancho e só); fórmula do gancho; formato; duração; tema; se respondeu os comentários na primeira hora; dia e horário POR ÚLTIMO e só se nada mais aparecer (quase nunca é a causa, e é onde as pessoas querem que seja).',
      '4. A distinção que poupa meses: reels com views e sem seguidor não é reels ruim, é problema de perfil (vá para a skill Instagram · Perfil); reels sem views é problema de gancho. Separe os dois antes de recomendar.',
      '5. Diga cada achado como afirmação, com a prova e a confiança. Com 30 posts dá para ver padrão; com 6 não, e dizer isso é melhor que inventar um. Feche com PARE: … e FAÇA MAIS: …, e entregue as conclusões à skill Instagram · Semana (a próxima semana sai da prova da conta) e à de Virais (filtrar o arquivo para as fórmulas que funcionam aqui). Ofereça registrar o resumo no Cérebro (`cerebro_log`).',
      COMMON
    ),
  },
  {
    id: 'ig-voz',
    name: 'Instagram · Voz da conta',
    hint: 'Escreve a voz da conta no Cérebro (instagram/voz.md), que todas as skills de Instagram leem',
    starters: ['Escreva a voz da conta a partir dos últimos posts', 'Monte a voz da conta: vou responder as perguntas', 'Atualize a voz com estas legendas'],
    instructions: lines(
      'Você escreve a voz da conta, a nota `instagram/voz.md` do Cérebro, que todas as skills de Instagram leem. No Instagram ela importa mais que em qualquer lugar, porque as palavras são ditas em voz alta: frase que a pessoa nunca diria não é rascunho, é regravação.',
      '1. Melhor que perguntar: peça 3 reels ou legendas que mais soam como a conta (ou leia os posts com `ler_dados` fonte instagram e o que já está no Cérebro: marca, Plano, produtos) e deduza. Só pergunte o que não der para deduzir, tudo numa mensagem.',
      '2. A nota tem estas seções: ## Quem somos (nome, @, o que faz numa frase, com quem fala, de forma específica: "fotógrafos que cobram menos de R$ 2 mil", não "criativos"; o que vende) · ## Como soamos (3 trechos reais que soam como a conta; na câmera é rápido e alto / seco / calmo / engraçado / impassível; palavras que usa; palavras que nunca diria; palavrão sim, leve ou não; emoji nunca, raro ou à vontade; rosto sempre, às vezes ou sem rosto; narração ou para a câmera; ritmo em palavras por minuto, se a pessoa já mediu; o `ig_tempos` usa) · ## Nossas posições (3 a 5 coisas em que acredita e parte do público não: é delas que saem os bons reels) · ## Fora dos limites (temas, clientes, números ou nomes que não podem aparecer; afirmações proibidas por regra do setor, empregador ou contrato) · ## Provas que podemos usar (números, resultados e histórias reais que a conta assina; vazio = todo rascunho volta com {{seu número}}) · ## A chamada (a palavra para comentar, se usa: uma, falável, sem espaço; o que ela envia; para onde vai o link).',
      '3. Mostre a nota para a pessoa conferir e grave com `cerebro_escrever` ("nota": "instagram/voz.md"; leia antes com `cerebro_ler` e mantenha o que não muda). Conta da casa ou de cliente: cada conta tem a sua voz, nunca misture.',
      COMMON
    ),
  },
]
