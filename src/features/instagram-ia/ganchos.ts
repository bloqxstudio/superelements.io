/**
 * Ganchos de Reels: as 26 fórmulas e a nota do gancho (5 propriedades).
 *
 * Trazido do instagram-agent-skill (Jake Schincariol, MIT, `skills/ig-reel/hooks.json` e
 * `hookscore.py`) e reescrito para o português do Brasil: fórmulas, exemplos, palavras de tensão,
 * aberturas fracas e os `match` que reconhecem a fórmula num gancho real.
 *
 * O que a nota mede bem: gancho ruim (saudação, preâmbulo, nada concreto, longo demais). O que NÃO
 * mede: qual de dois ganchos bons vai viralizar (no teste do autor, 0,56 de AUC, quase cara ou
 * coroa). Use para descartar os fracos antes de gravar; a retenção do vídeo publicado manda.
 */
import { clamp, fold, mean, MONEY_WORDS, NUMBER, PROPER, round1, rx, SPOKEN_NUMBERS, words, EMOJI, HASHTAG } from './texto.ts'

export interface HookFormula {
  id: number
  nome: string
  modelo: string
  exemplo: string
  /** O texto na tela: mais curto e mais seco, até 6 palavras. */
  tela: string
  serve: string
  armadilha: string
  match: RegExp
}

const F = (id: number, nome: string, modelo: string, exemplo: string, tela: string, serve: string, armadilha: string, match: string): HookFormula => ({ id, nome, modelo, exemplo, tela, serve, armadilha, match: rx(match, 'imu') })

export const HOOK_RULES = [
  'Escreva a fala e o texto da tela separados. Na tela vai a versão mais curta e seca, até 6 palavras.',
  'Sem preparação. O vídeo começa na frase que você normalmente diria no segundo 6.',
  'Diga o número. "Muito" não é número, "um tempão" também não.',
  'O primeiro quadro também é gancho: rosto parado sem movimento e sem texto em 0:00 desperdiça os três ganchos.',
  'Se o gancho serve para qualquer um do seu nicho, não é seu. Ponha nele o que só você pode dizer.',
  'Gancho promete algo. Entregue antes da metade, ou a retenção que você ganhou vai embora.',
]

export const HOOKS: HookFormula[] = [
  F(1, 'Confissão de custo', '{Valor} foi o que {um erro} me custou.', 'R$ 18 mil foi o que uma cláusula esquecida me custou.', 'ERRO DE R$ 18 MIL', 'Confiança rápida. As pessoas terminam os vídeos em que quem se dá mal é você.', 'Custo de mentira. "Me custou a paz" não é número, e todo mundo percebe.', String.raw`R\$\s?\d[\d.,]*(?:\s?mil)?\s+(?:foi|é|era) o que\b|\b(?:me|nos|lhe) custou\b|\bperdi\b[^.!?]{0,25}R\$\s?\d|\bjoguei fora\b[^.!?]{0,25}(?:R\$|\d)`),
  F(2, 'Ordem negativa', 'Pare de {ação comum}. Faça {alternativa}.', 'Pare de postar três vezes por dia. Poste duas e responda cada comentário por uma hora.', 'PARE DE POSTAR TODO DIA', 'Salvamentos e discussão. O imperativo prende mais que uma afirmação.', 'Mandar parar algo que ninguém faz. O hábito tem que ser um que a pessoa reconhece em si.', String.raw`^\s*(?:pare|parem|chega de|nunca|esquece|esqueça|larga|largue)\b|\b(?:pare|para|parem) de \p{L}+|^\s*não (?:faça|faz|poste|posta|compre|use|usa|comece|diga|mande|cobre|cometa)\b|\bnunca mais\b`),
  F(3, 'Ninguém te conta', 'Ninguém te conta que {verdade incômoda sobre o que a pessoa quer}.', 'Ninguém te conta que seus primeiros 30 reels vão flopar.', 'OS 30 PRIMEIROS VÃO FLOPAR', 'Público novo. Posiciona você como quem diz a parte que ninguém diz.', 'Escolher uma "verdade" que todo mundo já fala. Se os comentários concordam antes do fim, não era segredo.', String.raw`\b(?:ninguém|ninguem)\s+(?:nunca\s+)?(?:te |lhe |nos |me )?(?:conta|contou|fala|falou|diz|disse|ensina|ensinou|avisa|avisou|comenta|explica)\b|\bo que (?:ninguém|ninguem) (?:te )?(?:conta|fala|diz)\b`),
  F(4, 'A troca', '{Isto} substituiu {coisa cara} por {preço}.', 'Essa ferramenta de R$ 60 substituiu o editor que me custava R$ 2 mil por mês.', 'R$ 2 MIL OU R$ 60', 'Demonstração de ferramenta e produto. A diferença de preço faz o trabalho.', 'Exagerar a troca. Se substituiu 60% do trabalho, diga 60%, ou os comentários dizem por você.', String.raw`\bsubstitu\p{L}*\b[^.!?]*R\$\s?\d|R\$\s?\d[^.!?]*\bsubstitu\p{L}*|\b(?:em vez|no lugar) de (?:pagar|contratar)\b`),
  F(5, 'Tempo encurtado', 'Isso me levava {muito tempo}. Hoje leva {pouco}.', 'Proposta me tomava cinco horas. Hoje são vinte minutos.', '5 HORAS. AGORA 20 MIN', 'Processo em que o ganho é velocidade. Lê-se na hora, na tela.', 'Uma proporção que ninguém acredita. 40 horas para 4 segundos parece mentira mesmo sendo verdade.', String.raw`\b(?:me |nos )?(?:levava|tomava|demorava|gastava)\b|\b(?:hoje|agora) (?:leva|levo|demora|são|faço em|resolvo em)\b|\bem \d+\s*(?:seg|segundos|min|minutos|h|horas)\b`),
  F(6, 'O recibo', 'Fiz {coisa} por {N dias}. Esses são os números de verdade.', 'Postei um reel por dia durante 60 dias. Olha o que aconteceu com meu direct.', '60 DIAS. NÚMEROS REAIS.', 'Experimentos. Combina com a gravação de tela do painel de verdade, que é todo o valor.', 'Não mostrar a tela. Vídeo de números sem a gravação da tela é só uma alegação.', String.raw`\b(?:fiz|postei|testei|gravei|publiquei|usei|passei|tentei)\b[^.!?]{0,40}\b(?:por|durante)\s+(?:\d+|\p{L}+)\s+(?:dias?|semanas?|meses|mês|anos?)\b|\b(?:esses|estes|olha|aqui) (?:são |estão )?(?:os )?(?:meus )?números\b`),
  F(7, 'Jeito errado, jeito certo', 'Você está fazendo {coisa} errado, e a culpa não é sua. {A correção}.', 'Você está escrevendo legenda errado, e a culpa não é sua. O Instagram esconde tudo depois da primeira linha.', 'SUA LEGENDA ESTÁ CORTADA', 'Ensinar. O "a culpa não é sua" impede que soe como ofensa, que é o que mata essa fórmula.', 'Pular o perdão. "Você está fazendo errado" sozinho faz a pessoa sair em vez de aprender.', String.raw`\b(?:você|vc|voce) (?:está|esta|tá|ta) (?:fazendo|usando|escrevendo|postando|cobrando|gravando)\b[^.!?]{0,30}\berrad[oa]\b|\ba culpa não é sua\b|\bjeito (?:errado|certo)\b`),
  F(8, 'Visão de dentro', 'Passei {N anos} {dentro da coisa}. Isto aqui a gente nunca falava em voz alta.', 'Trabalhei seis anos vendendo contrato de agência. Isto aqui nunca ia na proposta.', '6 ANOS LÁ DENTRO', 'Autoridade sem slide de currículo. Só funciona se os anos forem reais.', 'Prometer segredo e entregar o folheto. Os comentários não perdoam.', String.raw`\b(?:passei|trabalhei|fiquei|atuei)\s+(?:\d+|\p{L}+)\s+anos?\b|\bo que (?:a gente|nós) nunca (?:falava|dizia|contava|mostrava)\b|\bbastidores?\b`),
  F(9, 'Pode copiar', 'Copia esse {material}. Levei {tempo} para acertar.', 'Copia essa mensagem de follow-up de quatro linhas. Levei dois anos e muito cliente perdido para acertar.', 'PODE COPIAR', 'Salvamentos e envios, as duas métricas que mais aumentam o alcance.', 'O material não aparecer na tela. Se não dá para tirar print, não há o que copiar.', String.raw`^\s*(?:copia|copie|rouba|roube|pega|salva|salve|anota|anote)\s+(?:esse|essa|este|esta|isso|meu|minha|o|a)\b|\bpode copiar\b|\bmodelo pronto\b|\btemplate\b`),
  F(10, 'Se isso, assista', 'Se você {situação específica}, esses {segundos} resolvem.', 'Se seus reels têm view e não trazem seguidor, os próximos 40 segundos resolvem.', 'VIEW SEM SEGUIDOR?', 'Qualificar forte. Fica menos gente, e quem fica é quem compra.', 'Situação tão ampla que não qualifica ninguém. "Se você quer crescer" não é situação.', String.raw`^\s*se (?:você|vc|voce|seu|sua|seus|suas|o seu|a sua)\b|\bos próximos \d+ segundos\b`),
  F(11, 'Lista com favorito', '{N} {coisas} que {resultado}. A {k} é a que ninguém usa.', 'Cinco ajustes de legenda que dobram os salvamentos. O quarto é o que ninguém faz.', '5 AJUSTES. O 4º É O BOM.', 'Retenção no meio: ter um favorito dá motivo para ficar depois do terceiro.', 'N acima de sete. Ninguém acredita que você tem nove bons, e você não tem.', String.raw`^\s*(?:\d+|dois|duas|três|tres|quatro|cinco|seis|sete)\s+\p{L}+[^.!?]{0,40}\b(?:que|pra|para)\b|\b(?:o|a|número)\s+(?:\d+º?|primeir\p{L}*|segund\p{L}*|terceir\p{L}*|quart\p{L}*|quint\p{L}*)\s+(?:é|e)\s+(?:o|a)\s+(?:que|única)\b`),
  F(12, 'A objeção', '"{Objeção que a pessoa diz}." Tudo bem. Esta é a versão que funciona mesmo assim.', '"Não quero aparecer no vídeo." Tudo bem. Esta é a versão sem rosto que ainda vende.', '"ODEIO APARECER"', 'Vender para quem já disse não uma vez.', 'Inventar a objeção. Copie de um direct ou comentário, com os erros de português e tudo.', String.raw`^\s*["“'][^"”?]{4,80}[."”']+\s*(?:tudo bem|ok|beleza|entendo)\b|\btudo bem\.?\s+(?:aqui|essa|esta|então)\b|\bfunciona mesmo assim\b`),
  F(13, 'Antes e depois na tela', '{Mostra o antigo}. {Mostra o novo}. {Uma frase sobre a alavanca}.', 'Esse era meu perfil em março. Esse é ele hoje. Só mudei o nome, nada mais.', 'MARÇO / HOJE', 'Tudo que é visual. O corte entre os dois quadros é o gancho; as palavras vêm depois.', 'Três alavancas. Diga uma coisa que mudou, ou a transformação deixa de ser crível.', String.raw`\b(?:esse|este|essa|esta|isso) era\b[^.!?]*[.!]\s*(?:esse|este|essa|esta|isso) é\b|\bantes e depois\b|\bantes\s*(?:x|vs|/)\s*depois\b`),
  F(14, 'O chamado', '{Grupo específico}, este é o que você está evitando.', 'Fotógrafo que cobra menos de R$ 2 mil: essa é a página de preço que você está evitando.', 'FOTÓGRAFO ABAIXO DE R$ 2 MIL', 'Cortar um público amplo até o que converte. Aumenta os envios, porque as pessoas marcam umas às outras.', 'Grupo tão grande que não é chamado. "Empreendedores" não é grupo.', String.raw`^\s*[\p{L} ]{3,40}\s+(?:que|com)\s+[^,:]{3,40}[,:]\s+(?:esse|este|essa|esta|isso)\b|^\s*(?:se você é|você que|pra você que|para você que)\b`),
  F(15, 'O histórico de flops', 'Meus primeiros {N} {tentativas} não deram em nada. Isso mudou no {N+1}.', 'Meus primeiros 47 reels tiveram média de 300 views. O 48º fez 400 mil. Uma coisa foi diferente.', '47 FLOPS, DEPOIS ISSO', 'Quem está começando, que é a maior parte do público. Muito comentário.', 'Fazer a mudança parecer sorte. Se a resposta é "dei sorte", não tem vídeo.', String.raw`\b(?:meus|minhas) primeir[oa]s\s+(?:\d+|\p{L}+)\b|\b(?:flopei|floparam|flopou|não deu em nada|não deram em nada)\b`),
  F(16, 'A pergunta literal', '"{Pergunta do jeito que veio}" Recebo essa toda semana.', '"Como eu posto todo dia sem odiar?" Recebo essa pergunta toda semana.', 'PERGUNTAM TODA SEMANA', 'Busca. A pergunta escrita como as pessoas escrevem é o que a busca do Instagram encontra.', 'Arrumar a pergunta. O valor é estar nas palavras delas, com erro e tudo.', String.raw`^\s*["“'][^"”]{4,120}\?["”']|\b(?:recebo|me perguntam|me fazem|perguntam) (?:essa|esta|isso)\b|\btoda semana alguém\b`),
  F(17, 'Frente a frente', '{A} ou {B}? Testei os dois por {tempo} e não foi nem perto.', 'Carrossel ou reels? Testei os dois por 90 dias e não foi nem perto.', 'CARROSSEL vs REELS', 'Comentários. As pessoas chegam com opinião formada, que é a ideia.', 'Não escolher. Comparação com final diplomático é vídeo sem final.', String.raw`\b(?:vs\.?|versus)\b|\btestei (?:os|as) (?:dois|duas)\b|^\s*[\p{L} ]{2,25}\s+ou\s+[\p{L} ]{2,25}\?`),
  F(18, 'Já começa fazendo', '{Começa no meio da ação.} Olha o que isso faz.', 'Olha o que acontece quando eu colo a legenda do concorrente aqui.', 'OLHA ISSO', 'Gravação de tela e tudo que tem resultado visível. Zero preparação: a mão já está se mexendo.', 'Um resultado que leva doze segundos para chegar. Se a entrega é lenta, corte para ela e mostre a espera depois.', String.raw`^\s*(?:olha|veja|vê|assiste|assista)\s+(?:o que|isso|só|esse|essa|eu|como)\b|^\s*(?:deixa eu|me deixa) te mostrar\b`),
  F(19, 'O prazo', '{Coisa} muda em {data}. Faça {ação} antes.', 'A grade do seu perfil muda no segundo em que você posta um reel. Arruma as capas antes.', 'ANTES DE POSTAR DE NOVO', 'Urgência verdadeira: mudança de plataforma, data sazonal, regra nova.', 'Urgência fabricada. Um prazo falso e todos os próximos perdem valor.', String.raw`\bantes (?:de|que)\b[^.!?]*\b(?:mud|acab|fech|venç|venc|expir|sai)\p{L}*|\bmuda (?:em|no|na|a partir)\b|\b(?:muda|acaba|fecha|vence)\b[^.!?]*[.!]\s*[^.!?]*\bantes[.!]?\s*$|\baté (?:o )?dia \d+|\bem 20\d\d\b`),
  F(20, 'Permissão', 'Você não precisa de {coisa que todo mundo diz que precisa}.', 'Você não precisa de um nicho. Precisa de uma pessoa que você consegue nomear.', 'VOCÊ NÃO PRECISA DE NICHO', 'Alívio. Muito salvamento, porque tira um obstáculo em vez de dar tarefa.', 'Tirar o obstáculo e não pôr nada no lugar. A segunda metade é o vídeo inteiro.', String.raw`\b(?:você|vc|voce) não precisa\b|\bpare de (?:tentar|se preocupar)\b|^\s*não precisa (?:de|ter|ser)\b`),
  F(21, 'Começo no meio', '{...e foi aí que {a virada}.}', '...e foi aí que o cliente pediu o dinheiro de volta. Três dias depois de aprovar.', 'ELE PEDIU REEMBOLSO', 'Histórias. Começar no meio da cena faz a pessoa sentir que chegou atrasada, e isso é motivo para ficar.', 'Nunca voltar para explicar. Entregue o começo até o segundo 8 ou parece erro.', String.raw`^\s*(?:\.\.\.|…)|^\s*(?:e foi (?:aí|ai|quando)|e aí (?:ele|ela|eles)|e então)\b|^\s*(?:aí|ai) (?:ele|ela|eles) (?:falou|disse|pediu|perguntou)\b`),
  F(22, 'Ditado ao contrário', '{Ditado conhecido, invertido.}', 'Quem espera nunca alcança.', 'QUEM ESPERA NUNCA ALCANÇA', 'Comentários. A pessoa precisa parar e conferir se ouviu direito.', 'Inverter um ditado que ninguém diz. O original tem que ser reflexo, senão a inversão é só uma frase.', String.raw`^\s*quem\s+[\p{L} ]{2,25}\s+(?:nunca|não)\s+\p{L}+|\b(?:é|são)\s+(?:superestimad|subestimad|mito|balela)\p{L}*`),
  F(23, 'A estatística', '{N}% de {grupo} {fato surpreendente}.', '70% dos nossos clientes chegam pelo direct, não pelo site.', '70% VÊM PELO DIRECT', 'Envios. Um número que a pessoa repete no jantar é mandado para alguém.', 'Estatística sem fonte. Diga de onde veio no vídeo, ou não use.', String.raw`^\s*\d[\d.,]*\s?%|\b\d[\d.,]*\s?%\s+d[aeo]s?\b|\b\d+ (?:em|de) cada \d+\b`),
  F(24, 'A revelação', 'Esse é o novo {coisa}.', 'Esse é o novo cardápio, e ele resolve a única coisa que eu odiava.', 'O NOVO', 'Tudo que é físico ou visual. O objeto é o gancho; as palavras são legenda dele.', 'Mostrar a coisa sem dizer o que ela muda. Revelação sem o que está em jogo é anúncio.', String.raw`^\s*(?:esse|este|essa|esta|aqui está|chegou)\s+(?:é\s+)?(?:o\s+|a\s+)?(?:nov[oa]|meu nov|minha nov)|^\s*(?:olha|conheça) (?:o|a) nov[oa]\b`),
  F(25, 'Resultado de outra pessoa', 'Teve um {pessoa} que {resultado} em {tempo}.', 'Teve uma cliente que saiu de zero a 200 encomendas em um mês.', '0 A 200 EM 1 MÊS', 'Prova quando você ainda não tem o seu número. Terceira pessoa vale, se for verdade.', 'Sem nome e sem prova. Milagre anônimo é boato.', String.raw`\b(?:teve|tem|conheço|conheci) (?:um|uma|esse|essa)\s+(?:cara|moça|mulher|homem|cliente|aluno|aluna|criador|criadora|empresa|loja|amigo|amiga|dono|dona)\b|\b(?:um|uma) (?:cliente|aluno|aluna|amigo|amiga) (?:meu |minha )?(?:que|saiu|fez|cresceu|vendeu|faturou)\b`),
  F(26, 'O superlativo', 'O jeito mais {rápido} de {coisa} é {resposta}.', 'O jeito mais rápido de ganhar confiança é juntar provas que ninguém discute.', 'O JEITO MAIS RÁPIDO', 'Vídeo de uma afirmação, sem história. É o formato mais comum e o mais fácil de errar.', 'Superlativo com resposta mole. Se a segunda metade é "constância", você não disse nada.', String.raw`^\s*(?:o|a)\s+(?:jeito|forma|maneira|melhor|pior|maior|única|único|unico)\b|\b(?:o|a) (?:jeito|forma|maneira) mais \p{L}+ de\b|^\s*(?:a|o) (?:coisa|dica|erro) mais (?:importante|subestimad\p{L}*|comum)\b`),
]

/** Do mais específico ao mais geral (a primeira que bate dá o nome). */
const CLASSIFY_ORDER = [1, 23, 5, 4, 3, 15, 20, 7, 9, 26, 25, 24, 18, 17, 8, 6, 16, 12, 10, 2, 13, 19, 21, 22, 11, 14]

export const hookById = (id: number) => HOOKS.find((h) => h.id === id)

/** A fórmula que o gancho usa, ou nada (metade dos ganchos reais não tem fórmula, e tudo bem). */
export function classifyHook(text: string): HookFormula | undefined {
  for (const id of CLASSIFY_ORDER) {
    const h = hookById(id)
    if (h && h.match.test(text)) return h
  }
  return undefined
}

// ---------- a nota do gancho ----------

/** Palavras que põem algo em jogo. Sem nenhuma, é uma afirmação; com uma, é motivo para ficar. */
const STAKES = new Set(
  ['pare', 'parar', 'para', 'nunca', 'errado', 'errada', 'erro', 'erros', 'errei', 'perdi', 'perder', 'perdendo', 'perdeu', 'custou', 'custa', 'custo', 'quebrei', 'quebrou', 'faliu', 'falhei', 'falhou', 'ninguem', 'nao', 'nem', 'jamais', 'desisti', 'demitido', 'demiti', 'apaguei', 'apague', 'cortei', 'corte', 'gratis', 'paguei', 'pagar', 'cobrei', 'cobrar', 'contratei', 'economizei', 'primeiro', 'proibido', 'ilegal', 'pior', 'odeio', 'odiei', 'desperdicei', 'golpe', 'mentira', 'mentiram', 'verdade', 'segredo', 'escondido', 'roubou', 'antes', 'ate', 'mas', 'exceto', 'problema', 'risco', 'perigo', 'cuidado', 'alerta', 'arrependo', 'arrependi', 'deveria', 'ainda', 'ja', 'so', 'sem', 'contra', 'versus', 'vs', 'prejuizo', 'multa', 'caro', 'barato', 'flop', 'flopou', 'travou', 'bloqueado', 'banido', 'processado', 'reembolso', 'devolver', 'sumiu', 'fechou', 'fechar'].map(fold)
)

/** Aberturas que gastam o primeiro segundo sem dizer nada. */
const WEAK_OPENERS = ['entao', 'bom', 'bem', 'ola', 'oi', 'e ai', 'eai', 'galera', 'gente', 'pessoal', 'fala', 'bem-vindo', 'bem-vindos', 'hoje', 'basicamente', 'sinceramente', 'olha so', 'escuta', 'tipo', 'deixa eu', 'vou', 'eu queria', 'eu quero', 'eu vim', 'uma das', 'voce ja', 'voces ja', 'voce sabia', 'sabia que', 'neste', 'nesse', 'no video', 'muita gente', 'existe', 'existem', 'isso e', 'e muito', 'como um', 'como uma', 'quando se trata', 'se voce ja', 'voce sabe']

/** Imperativos que merecem a primeira posição. */
const IMPERATIVES = new Set(['pare', 'parem', 'copia', 'copie', 'rouba', 'roube', 'apague', 'apaga', 'tente', 'testa', 'teste', 'veja', 'olha', 'assista', 'leia', 'salva', 'salve', 'use', 'usa', 'faca', 'faz', 'escreva', 'mande', 'manda', 'envie', 'comece', 'largue', 'larga', 'nunca', 'sempre', 'nao', 'coloque', 'confira', 'anota', 'anote', 'esquece', 'esqueca', 'troque', 'troca'].map(fold))

const DEALBREAKERS: Array<[RegExp, string]> = [
  [rx(String.raw`^\s*(?:para de rolar|pare de rolar|não (?:pula|pule|passa|passe|role)|espera,? não)`), 'Abre com "pare de rolar". Pedir atenção prova que você não conquistou.'],
  [rx(String.raw`\b(?:no vídeo de hoje|neste vídeo|nesse vídeo|nesse reels|neste reels|hoje eu vou te mostrar|hoje vou te mostrar|vou te mostrar como|vou te ensinar)\b`), 'Preâmbulo de vídeo. Apague e comece pela entrega.'],
  [rx(String.raw`^\s*(?:oi|olá|ola|e aí|eai|fala,? galera|fala,? pessoal|bom dia|boa tarde|boa noite|seja bem-vind)`), 'Saudação. Ninguém veio ao feed para ser cumprimentado.'],
  [HASHTAG, 'Hashtag no gancho. Hashtag fica no fim da legenda, se ficar.'],
  [EMOJI, 'Emoji no gancho. Texto em tamanho de gancho tem espaço para palavras ou para emoji, não os dois.'],
]

export const HOOK_CHECKS = ['TAMANHO', 'CONCRETO', 'TENSAO', 'FRENTE', 'PUBLICO'] as const
export type HookCheck = (typeof HOOK_CHECKS)[number]

const PER_SECOND = 2.7 // ~160 palavras por minuto, falado

function checkLength(text: string): [number, string] {
  const n = words(text).length
  const chars = text.trim().length
  let score = n >= 5 && n <= 12 ? 100 : n < 5 ? 100 - (5 - n) * 20 : 100 - (n - 12) * 11
  if (chars > 60) score -= 12 // duas linhas de texto grande na tela
  return [clamp(score), `${n} palavras, ${chars} caracteres, ~${(n / PER_SECOND).toFixed(1).replace('.', ',')} s falado (ideal: 5 a 12 palavras)`]
}

function checkConcrete(text: string): [number, string] {
  const nums = (text.match(NUMBER) ?? []).map((s) => s.trim()).filter(Boolean)
  const propers = [...new Set(text.match(PROPER) ?? [])]
  const spoken = words(text).map(fold).filter((w) => SPOKEN_NUMBERS.has(w) || MONEY_WORDS.has(w))
  const hits = nums.length + propers.length + spoken.length
  const found = [...nums.slice(0, 2), ...propers.slice(0, 2), ...spoken.slice(0, 2)].join(', ')
  return [hits ? clamp(45 + hits * 30) : 15, hits ? `${hits} marca(s) concreta(s): ${found}` : 'nenhum número, nome ou coisa que dê para conferir']
}

function checkStakes(text: string): [number, string] {
  const low = words(text).map(fold)
  const markers = [...new Set(low.filter((w) => STAKES.has(w)))].sort()
  if (/R\$\s?\d/.test(text)) markers.push('um preço')
  if (/\bem vez de\b/i.test(fold(text))) markers.push('em vez de')
  const n = markers.length
  return [n === 0 ? 20 : n === 1 ? 70 : 100, n ? `${n} marca(s) de tensão: ${markers.slice(0, 4).join(', ')}` : 'nada está em jogo nesta frase']
}

function checkFront(text: string): [number, string] {
  const w = words(text)
  if (!w.length) return [0, 'vazio']
  const low = w.map(fold)
  const opener = low.slice(0, 3).join(' ')
  const weak = WEAK_OPENERS.find((o) => opener === o || opener.startsWith(`${o} `) || low[0] === o)
  const penalty = weak ? 30 : 0
  let payload = -1
  for (let i = 0; i < low.length; i++) {
    const t = low[i]
    if (STAKES.has(t) || SPOKEN_NUMBERS.has(t) || MONEY_WORDS.has(t) || /^(?:R\$|US\$|\$)?\d/.test(w[i]) || (i > 0 && /^\p{Lu}\p{Ll}{2,}/u.test(w[i]))) {
      payload = i
      break
    }
  }
  const [base, where] = payload < 0 ? [30, 'nenhuma palavra forte na frase'] : payload <= 3 ? [100, `palavra forte na posição ${payload + 1}`] : payload <= 6 ? [70, `palavra forte na posição ${payload + 1}, dá para trazer à frente`] : [40, `palavra forte na posição ${payload + 1}, tarde demais`]
  return [clamp(base - penalty), where + (weak ? `; abertura fraca "${weak}"` : '')]
}

function checkAddress(text: string): [number, string] {
  const f = fold(text)
  const low = words(text).map(fold)
  if (/(?<![\p{L}])(voce|voces|vc|vcs|seu|sua|seus|suas|te|contigo)(?![\p{L}])/u.test(f)) return [100, 'fala com quem está vendo']
  if (low[0] && IMPERATIVES.has(low[0])) return [90, `começa com uma ordem ("${w0(text)}")`]
  if (/(?<![\p{L}])(eu|meu|minha|meus|minhas|me|nos|nosso|nossa|a gente)(?![\p{L}])/u.test(f)) return [70, 'primeira pessoa, sem falar com ninguém']
  return [35, 'terceira pessoa, ninguém na sala']
}
const w0 = (text: string) => words(text)[0] ?? ''

export interface HookScore {
  gancho: string
  nota: number
  veredito: 'FORTE' | 'OK' | 'FRACO'
  checks: Record<HookCheck, { nota: number; detalhe: string }>
  pior: HookCheck
  problemas: string[]
  formula?: { id: number; nome: string }
}

/** A nota do gancho: média das 5 (60%) mais a pior (40%), menos 15 por problema grave. */
export function scoreHook(text: string): HookScore {
  const r: Record<HookCheck, [number, string]> = { TAMANHO: checkLength(text), CONCRETO: checkConcrete(text), TENSAO: checkStakes(text), FRENTE: checkFront(text), PUBLICO: checkAddress(text) }
  const problemas = DEALBREAKERS.filter(([re]) => new RegExp(re.source, re.flags.replace('g', '')).test(text)).map(([, msg]) => msg)
  const scores = HOOK_CHECKS.map((c) => r[c][0])
  const nota = clamp(mean(scores) * 0.6 + Math.min(...scores) * 0.4 - problemas.length * 15)
  const veredito = nota >= 70 && Math.min(...scores) >= 55 && !problemas.length ? 'FORTE' : nota >= 50 ? 'OK' : 'FRACO'
  const pior = HOOK_CHECKS.reduce((a, b) => (r[b][0] < r[a][0] ? b : a))
  const f = classifyHook(text)
  return {
    gancho: text.trim(),
    nota: round1(nota),
    veredito,
    checks: Object.fromEntries(HOOK_CHECKS.map((c) => [c, { nota: round1(r[c][0]), detalhe: r[c][1] }])) as HookScore['checks'],
    pior,
    problemas,
    ...(f ? { formula: { id: f.id, nome: f.nome } } : {}),
  }
}

/** Vários ganchos, do melhor ao pior. Se o primeiro está abaixo de 50, nenhum é o gancho. */
export const rankHooks = (hooks: string[]) => hooks.map((h) => h.trim()).filter(Boolean).map(scoreHook).sort((a, b) => b.nota - a.nota)

/** As fórmulas como texto, para o agente escolher (sem os regex). */
export const hooksForPrompt = () => HOOKS.map((h) => ({ id: h.id, nome: h.nome, modelo: h.modelo, exemplo: h.exemplo, tela: h.tela, serve: h.serve, armadilha: h.armadilha }))
