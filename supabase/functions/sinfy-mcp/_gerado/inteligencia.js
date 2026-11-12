// Gerado por `npm run build:mcp` (scripts/mcp/build.mjs). Não edite à mão.
// @ts-nocheck

// src/features/instagram-ia/texto.ts
var UB = "(?:(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}]))";
var rx = (source, flags = "iu") => new RegExp(source.replace(/\\b/g, UB), flags.includes("u") ? flags : `${flags}u`);
var clamp = (n) => Math.max(0, Math.min(100, n));
var mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
var median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
var pstdev = (xs) => {
  if (!xs.length) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
var round1 = (n) => Math.round(n * 10) / 10;
var fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
var WORD = /[\p{L}\p{N}$%'’-]+/gu;
function words(text) {
  const t = text.replace(/(?<=\d)[.,](?=\d{3}\b)/g, "").replace(/R\$\s+(?=\d)/g, "R$");
  return t.match(WORD) ?? [];
}
var NUMBER = /R\$\s?\d[\d.]*(?:,\d+)?(?:\s?mil\b)?|US?\$\s?\d[\d.,]*|\b\d[\d.]*(?:,\d+)?\s?(?:%|mil\b|k\b|x\b|h\b|horas?\b|min\b|minutos?\b|seg\b|segundos?\b|dias?\b|semanas?\b|meses\b|mês\b|anos?\b)?/giu;
var PROPER = /(?<![.!?]\s)(?<!^)(?<![\p{L}])\p{Lu}\p{Ll}{2,}/gmu;
var SPOKEN_NUMBERS = new Set(
  ["zero", "dois", "duas", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quinze", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa", "cem", "cento", "duzentos", "trezentos", "quinhentos", "mil", "milhao", "milhoes", "bilhao", "duzia", "metade", "dobro", "triplo", "dobrou", "triplicou"].map(fold)
);
var MONEY_WORDS = new Set(["reais", "real", "conto", "contos", "pila", "dolares", "faturamento", "faturei", "lucro", "salario", "aluguel", "centavos", "porcento", "prejuizo", "multa", "boleto"].map(fold));
var EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
var HASHTAG = /(?:^|\s)(#[\p{L}\p{N}_]+)/gu;
var MENTION = /(?:^|\s)(@[\p{L}\p{N}_.]+)/gu;
var LINK = /https?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com\.br|com|br|co|io|net|org|ai|app|me|link)\/?\S*/giu;
var all = (re, text, group = 0) => [...text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))].map((m) => m[group] ?? m[0]);

// src/features/instagram-ia/ganchos.ts
var F = (id, nome, modelo, exemplo, tela, serve, armadilha, match) => ({ id, nome, modelo, exemplo, tela, serve, armadilha, match: rx(match, "imu") });
var HOOK_RULES = [
  "Escreva a fala e o texto da tela separados. Na tela vai a vers\xE3o mais curta e seca, at\xE9 6 palavras.",
  "Sem prepara\xE7\xE3o. O v\xEDdeo come\xE7a na frase que voc\xEA normalmente diria no segundo 6.",
  'Diga o n\xFAmero. "Muito" n\xE3o \xE9 n\xFAmero, "um temp\xE3o" tamb\xE9m n\xE3o.',
  "O primeiro quadro tamb\xE9m \xE9 gancho: rosto parado sem movimento e sem texto em 0:00 desperdi\xE7a os tr\xEAs ganchos.",
  "Se o gancho serve para qualquer um do seu nicho, n\xE3o \xE9 seu. Ponha nele o que s\xF3 voc\xEA pode dizer.",
  "Gancho promete algo. Entregue antes da metade, ou a reten\xE7\xE3o que voc\xEA ganhou vai embora."
];
var HOOKS = [
  F(1, "Confiss\xE3o de custo", "{Valor} foi o que {um erro} me custou.", "R$ 18 mil foi o que uma cl\xE1usula esquecida me custou.", "ERRO DE R$ 18 MIL", "Confian\xE7a r\xE1pida. As pessoas terminam os v\xEDdeos em que quem se d\xE1 mal \xE9 voc\xEA.", 'Custo de mentira. "Me custou a paz" n\xE3o \xE9 n\xFAmero, e todo mundo percebe.', String.raw`R\$\s?\d[\d.,]*(?:\s?mil)?\s+(?:foi|é|era) o que\b|\b(?:me|nos|lhe) custou\b|\bperdi\b[^.!?]{0,25}R\$\s?\d|\bjoguei fora\b[^.!?]{0,25}(?:R\$|\d)`),
  F(2, "Ordem negativa", "Pare de {a\xE7\xE3o comum}. Fa\xE7a {alternativa}.", "Pare de postar tr\xEAs vezes por dia. Poste duas e responda cada coment\xE1rio por uma hora.", "PARE DE POSTAR TODO DIA", "Salvamentos e discuss\xE3o. O imperativo prende mais que uma afirma\xE7\xE3o.", "Mandar parar algo que ningu\xE9m faz. O h\xE1bito tem que ser um que a pessoa reconhece em si.", String.raw`^\s*(?:pare|parem|chega de|nunca|esquece|esqueça|larga|largue)\b|\b(?:pare|para|parem) de \p{L}+|^\s*não (?:faça|faz|poste|posta|compre|use|usa|comece|diga|mande|cobre|cometa)\b|\bnunca mais\b`),
  F(3, "Ningu\xE9m te conta", "Ningu\xE9m te conta que {verdade inc\xF4moda sobre o que a pessoa quer}.", "Ningu\xE9m te conta que seus primeiros 30 reels v\xE3o flopar.", "OS 30 PRIMEIROS V\xC3O FLOPAR", "P\xFAblico novo. Posiciona voc\xEA como quem diz a parte que ningu\xE9m diz.", 'Escolher uma "verdade" que todo mundo j\xE1 fala. Se os coment\xE1rios concordam antes do fim, n\xE3o era segredo.', String.raw`\b(?:ninguém|ninguem)\s+(?:nunca\s+)?(?:te |lhe |nos |me )?(?:conta|contou|fala|falou|diz|disse|ensina|ensinou|avisa|avisou|comenta|explica)\b|\bo que (?:ninguém|ninguem) (?:te )?(?:conta|fala|diz)\b`),
  F(4, "A troca", "{Isto} substituiu {coisa cara} por {pre\xE7o}.", "Essa ferramenta de R$ 60 substituiu o editor que me custava R$ 2 mil por m\xEAs.", "R$ 2 MIL OU R$ 60", "Demonstra\xE7\xE3o de ferramenta e produto. A diferen\xE7a de pre\xE7o faz o trabalho.", "Exagerar a troca. Se substituiu 60% do trabalho, diga 60%, ou os coment\xE1rios dizem por voc\xEA.", String.raw`\bsubstitu\p{L}*\b[^.!?]*R\$\s?\d|R\$\s?\d[^.!?]*\bsubstitu\p{L}*|\b(?:em vez|no lugar) de (?:pagar|contratar)\b`),
  F(5, "Tempo encurtado", "Isso me levava {muito tempo}. Hoje leva {pouco}.", "Proposta me tomava cinco horas. Hoje s\xE3o vinte minutos.", "5 HORAS. AGORA 20 MIN", "Processo em que o ganho \xE9 velocidade. L\xEA-se na hora, na tela.", "Uma propor\xE7\xE3o que ningu\xE9m acredita. 40 horas para 4 segundos parece mentira mesmo sendo verdade.", String.raw`\b(?:me |nos )?(?:levava|tomava|demorava|gastava)\b|\b(?:hoje|agora) (?:leva|levo|demora|são|faço em|resolvo em)\b|\bem \d+\s*(?:seg|segundos|min|minutos|h|horas)\b`),
  F(6, "O recibo", "Fiz {coisa} por {N dias}. Esses s\xE3o os n\xFAmeros de verdade.", "Postei um reel por dia durante 60 dias. Olha o que aconteceu com meu direct.", "60 DIAS. N\xDAMEROS REAIS.", "Experimentos. Combina com a grava\xE7\xE3o de tela do painel de verdade, que \xE9 todo o valor.", "N\xE3o mostrar a tela. V\xEDdeo de n\xFAmeros sem a grava\xE7\xE3o da tela \xE9 s\xF3 uma alega\xE7\xE3o.", String.raw`\b(?:fiz|postei|testei|gravei|publiquei|usei|passei|tentei)\b[^.!?]{0,40}\b(?:por|durante)\s+(?:\d+|\p{L}+)\s+(?:dias?|semanas?|meses|mês|anos?)\b|\b(?:esses|estes|olha|aqui) (?:são |estão )?(?:os )?(?:meus )?números\b`),
  F(7, "Jeito errado, jeito certo", "Voc\xEA est\xE1 fazendo {coisa} errado, e a culpa n\xE3o \xE9 sua. {A corre\xE7\xE3o}.", "Voc\xEA est\xE1 escrevendo legenda errado, e a culpa n\xE3o \xE9 sua. O Instagram esconde tudo depois da primeira linha.", "SUA LEGENDA EST\xC1 CORTADA", 'Ensinar. O "a culpa n\xE3o \xE9 sua" impede que soe como ofensa, que \xE9 o que mata essa f\xF3rmula.', 'Pular o perd\xE3o. "Voc\xEA est\xE1 fazendo errado" sozinho faz a pessoa sair em vez de aprender.', String.raw`\b(?:você|vc|voce) (?:está|esta|tá|ta) (?:fazendo|usando|escrevendo|postando|cobrando|gravando)\b[^.!?]{0,30}\berrad[oa]\b|\ba culpa não é sua\b|\bjeito (?:errado|certo)\b`),
  F(8, "Vis\xE3o de dentro", "Passei {N anos} {dentro da coisa}. Isto aqui a gente nunca falava em voz alta.", "Trabalhei seis anos vendendo contrato de ag\xEAncia. Isto aqui nunca ia na proposta.", "6 ANOS L\xC1 DENTRO", "Autoridade sem slide de curr\xEDculo. S\xF3 funciona se os anos forem reais.", "Prometer segredo e entregar o folheto. Os coment\xE1rios n\xE3o perdoam.", String.raw`\b(?:passei|trabalhei|fiquei|atuei)\s+(?:\d+|\p{L}+)\s+anos?\b|\bo que (?:a gente|nós) nunca (?:falava|dizia|contava|mostrava)\b|\bbastidores?\b`),
  F(9, "Pode copiar", "Copia esse {material}. Levei {tempo} para acertar.", "Copia essa mensagem de follow-up de quatro linhas. Levei dois anos e muito cliente perdido para acertar.", "PODE COPIAR", "Salvamentos e envios, as duas m\xE9tricas que mais aumentam o alcance.", "O material n\xE3o aparecer na tela. Se n\xE3o d\xE1 para tirar print, n\xE3o h\xE1 o que copiar.", String.raw`^\s*(?:copia|copie|rouba|roube|pega|salva|salve|anota|anote)\s+(?:esse|essa|este|esta|isso|meu|minha|o|a)\b|\bpode copiar\b|\bmodelo pronto\b|\btemplate\b`),
  F(10, "Se isso, assista", "Se voc\xEA {situa\xE7\xE3o espec\xEDfica}, esses {segundos} resolvem.", "Se seus reels t\xEAm view e n\xE3o trazem seguidor, os pr\xF3ximos 40 segundos resolvem.", "VIEW SEM SEGUIDOR?", "Qualificar forte. Fica menos gente, e quem fica \xE9 quem compra.", 'Situa\xE7\xE3o t\xE3o ampla que n\xE3o qualifica ningu\xE9m. "Se voc\xEA quer crescer" n\xE3o \xE9 situa\xE7\xE3o.', String.raw`^\s*se (?:você|vc|voce|seu|sua|seus|suas|o seu|a sua)\b|\bos próximos \d+ segundos\b`),
  F(11, "Lista com favorito", "{N} {coisas} que {resultado}. A {k} \xE9 a que ningu\xE9m usa.", "Cinco ajustes de legenda que dobram os salvamentos. O quarto \xE9 o que ningu\xE9m faz.", "5 AJUSTES. O 4\xBA \xC9 O BOM.", "Reten\xE7\xE3o no meio: ter um favorito d\xE1 motivo para ficar depois do terceiro.", "N acima de sete. Ningu\xE9m acredita que voc\xEA tem nove bons, e voc\xEA n\xE3o tem.", String.raw`^\s*(?:\d+|dois|duas|três|tres|quatro|cinco|seis|sete)\s+\p{L}+[^.!?]{0,40}\b(?:que|pra|para)\b|\b(?:o|a|número)\s+(?:\d+º?|primeir\p{L}*|segund\p{L}*|terceir\p{L}*|quart\p{L}*|quint\p{L}*)\s+(?:é|e)\s+(?:o|a)\s+(?:que|única)\b`),
  F(12, "A obje\xE7\xE3o", '"{Obje\xE7\xE3o que a pessoa diz}." Tudo bem. Esta \xE9 a vers\xE3o que funciona mesmo assim.', '"N\xE3o quero aparecer no v\xEDdeo." Tudo bem. Esta \xE9 a vers\xE3o sem rosto que ainda vende.', '"ODEIO APARECER"', "Vender para quem j\xE1 disse n\xE3o uma vez.", "Inventar a obje\xE7\xE3o. Copie de um direct ou coment\xE1rio, com os erros de portugu\xEAs e tudo.", String.raw`^\s*["“'][^"”?]{4,80}[."”']+\s*(?:tudo bem|ok|beleza|entendo)\b|\btudo bem\.?\s+(?:aqui|essa|esta|então)\b|\bfunciona mesmo assim\b`),
  F(13, "Antes e depois na tela", "{Mostra o antigo}. {Mostra o novo}. {Uma frase sobre a alavanca}.", "Esse era meu perfil em mar\xE7o. Esse \xE9 ele hoje. S\xF3 mudei o nome, nada mais.", "MAR\xC7O / HOJE", "Tudo que \xE9 visual. O corte entre os dois quadros \xE9 o gancho; as palavras v\xEAm depois.", "Tr\xEAs alavancas. Diga uma coisa que mudou, ou a transforma\xE7\xE3o deixa de ser cr\xEDvel.", String.raw`\b(?:esse|este|essa|esta|isso) era\b[^.!?]*[.!]\s*(?:esse|este|essa|esta|isso) é\b|\bantes e depois\b|\bantes\s*(?:x|vs|/)\s*depois\b`),
  F(14, "O chamado", "{Grupo espec\xEDfico}, este \xE9 o que voc\xEA est\xE1 evitando.", "Fot\xF3grafo que cobra menos de R$ 2 mil: essa \xE9 a p\xE1gina de pre\xE7o que voc\xEA est\xE1 evitando.", "FOT\xD3GRAFO ABAIXO DE R$ 2 MIL", "Cortar um p\xFAblico amplo at\xE9 o que converte. Aumenta os envios, porque as pessoas marcam umas \xE0s outras.", 'Grupo t\xE3o grande que n\xE3o \xE9 chamado. "Empreendedores" n\xE3o \xE9 grupo.', String.raw`^\s*[\p{L} ]{3,40}\s+(?:que|com)\s+[^,:]{3,40}[,:]\s+(?:esse|este|essa|esta|isso)\b|^\s*(?:se você é|você que|pra você que|para você que)\b`),
  F(15, "O hist\xF3rico de flops", "Meus primeiros {N} {tentativas} n\xE3o deram em nada. Isso mudou no {N+1}.", "Meus primeiros 47 reels tiveram m\xE9dia de 300 views. O 48\xBA fez 400 mil. Uma coisa foi diferente.", "47 FLOPS, DEPOIS ISSO", "Quem est\xE1 come\xE7ando, que \xE9 a maior parte do p\xFAblico. Muito coment\xE1rio.", 'Fazer a mudan\xE7a parecer sorte. Se a resposta \xE9 "dei sorte", n\xE3o tem v\xEDdeo.', String.raw`\b(?:meus|minhas) primeir[oa]s\s+(?:\d+|\p{L}+)\b|\b(?:flopei|floparam|flopou|não deu em nada|não deram em nada)\b`),
  F(16, "A pergunta literal", '"{Pergunta do jeito que veio}" Recebo essa toda semana.', '"Como eu posto todo dia sem odiar?" Recebo essa pergunta toda semana.', "PERGUNTAM TODA SEMANA", "Busca. A pergunta escrita como as pessoas escrevem \xE9 o que a busca do Instagram encontra.", "Arrumar a pergunta. O valor \xE9 estar nas palavras delas, com erro e tudo.", String.raw`^\s*["“'][^"”]{4,120}\?["”']|\b(?:recebo|me perguntam|me fazem|perguntam) (?:essa|esta|isso)\b|\btoda semana alguém\b`),
  F(17, "Frente a frente", "{A} ou {B}? Testei os dois por {tempo} e n\xE3o foi nem perto.", "Carrossel ou reels? Testei os dois por 90 dias e n\xE3o foi nem perto.", "CARROSSEL vs REELS", "Coment\xE1rios. As pessoas chegam com opini\xE3o formada, que \xE9 a ideia.", "N\xE3o escolher. Compara\xE7\xE3o com final diplom\xE1tico \xE9 v\xEDdeo sem final.", String.raw`\b(?:vs\.?|versus)\b|\btestei (?:os|as) (?:dois|duas)\b|^\s*[\p{L} ]{2,25}\s+ou\s+[\p{L} ]{2,25}\?`),
  F(18, "J\xE1 come\xE7a fazendo", "{Come\xE7a no meio da a\xE7\xE3o.} Olha o que isso faz.", "Olha o que acontece quando eu colo a legenda do concorrente aqui.", "OLHA ISSO", "Grava\xE7\xE3o de tela e tudo que tem resultado vis\xEDvel. Zero prepara\xE7\xE3o: a m\xE3o j\xE1 est\xE1 se mexendo.", "Um resultado que leva doze segundos para chegar. Se a entrega \xE9 lenta, corte para ela e mostre a espera depois.", String.raw`^\s*(?:olha|veja|vê|assiste|assista)\s+(?:o que|isso|só|esse|essa|eu|como)\b|^\s*(?:deixa eu|me deixa) te mostrar\b`),
  F(19, "O prazo", "{Coisa} muda em {data}. Fa\xE7a {a\xE7\xE3o} antes.", "A grade do seu perfil muda no segundo em que voc\xEA posta um reel. Arruma as capas antes.", "ANTES DE POSTAR DE NOVO", "Urg\xEAncia verdadeira: mudan\xE7a de plataforma, data sazonal, regra nova.", "Urg\xEAncia fabricada. Um prazo falso e todos os pr\xF3ximos perdem valor.", String.raw`\bantes (?:de|que)\b[^.!?]*\b(?:mud|acab|fech|venç|venc|expir|sai)\p{L}*|\bmuda (?:em|no|na|a partir)\b|\b(?:muda|acaba|fecha|vence)\b[^.!?]*[.!]\s*[^.!?]*\bantes[.!]?\s*$|\baté (?:o )?dia \d+|\bem 20\d\d\b`),
  F(20, "Permiss\xE3o", "Voc\xEA n\xE3o precisa de {coisa que todo mundo diz que precisa}.", "Voc\xEA n\xE3o precisa de um nicho. Precisa de uma pessoa que voc\xEA consegue nomear.", "VOC\xCA N\xC3O PRECISA DE NICHO", "Al\xEDvio. Muito salvamento, porque tira um obst\xE1culo em vez de dar tarefa.", "Tirar o obst\xE1culo e n\xE3o p\xF4r nada no lugar. A segunda metade \xE9 o v\xEDdeo inteiro.", String.raw`\b(?:você|vc|voce) não precisa\b|\bpare de (?:tentar|se preocupar)\b|^\s*não precisa (?:de|ter|ser)\b`),
  F(21, "Come\xE7o no meio", "{...e foi a\xED que {a virada}.}", "...e foi a\xED que o cliente pediu o dinheiro de volta. Tr\xEAs dias depois de aprovar.", "ELE PEDIU REEMBOLSO", "Hist\xF3rias. Come\xE7ar no meio da cena faz a pessoa sentir que chegou atrasada, e isso \xE9 motivo para ficar.", "Nunca voltar para explicar. Entregue o come\xE7o at\xE9 o segundo 8 ou parece erro.", String.raw`^\s*(?:\.\.\.|…)|^\s*(?:e foi (?:aí|ai|quando)|e aí (?:ele|ela|eles)|e então)\b|^\s*(?:aí|ai) (?:ele|ela|eles) (?:falou|disse|pediu|perguntou)\b`),
  F(22, "Ditado ao contr\xE1rio", "{Ditado conhecido, invertido.}", "Quem espera nunca alcan\xE7a.", "QUEM ESPERA NUNCA ALCAN\xC7A", "Coment\xE1rios. A pessoa precisa parar e conferir se ouviu direito.", "Inverter um ditado que ningu\xE9m diz. O original tem que ser reflexo, sen\xE3o a invers\xE3o \xE9 s\xF3 uma frase.", String.raw`^\s*quem\s+[\p{L} ]{2,25}\s+(?:nunca|não)\s+\p{L}+|\b(?:é|são)\s+(?:superestimad|subestimad|mito|balela)\p{L}*`),
  F(23, "A estat\xEDstica", "{N}% de {grupo} {fato surpreendente}.", "70% dos nossos clientes chegam pelo direct, n\xE3o pelo site.", "70% V\xCAM PELO DIRECT", "Envios. Um n\xFAmero que a pessoa repete no jantar \xE9 mandado para algu\xE9m.", "Estat\xEDstica sem fonte. Diga de onde veio no v\xEDdeo, ou n\xE3o use.", String.raw`^\s*\d[\d.,]*\s?%|\b\d[\d.,]*\s?%\s+d[aeo]s?\b|\b\d+ (?:em|de) cada \d+\b`),
  F(24, "A revela\xE7\xE3o", "Esse \xE9 o novo {coisa}.", "Esse \xE9 o novo card\xE1pio, e ele resolve a \xFAnica coisa que eu odiava.", "O NOVO", "Tudo que \xE9 f\xEDsico ou visual. O objeto \xE9 o gancho; as palavras s\xE3o legenda dele.", "Mostrar a coisa sem dizer o que ela muda. Revela\xE7\xE3o sem o que est\xE1 em jogo \xE9 an\xFAncio.", String.raw`^\s*(?:esse|este|essa|esta|aqui está|chegou)\s+(?:é\s+)?(?:o\s+|a\s+)?(?:nov[oa]|meu nov|minha nov)|^\s*(?:olha|conheça) (?:o|a) nov[oa]\b`),
  F(25, "Resultado de outra pessoa", "Teve um {pessoa} que {resultado} em {tempo}.", "Teve uma cliente que saiu de zero a 200 encomendas em um m\xEAs.", "0 A 200 EM 1 M\xCAS", "Prova quando voc\xEA ainda n\xE3o tem o seu n\xFAmero. Terceira pessoa vale, se for verdade.", "Sem nome e sem prova. Milagre an\xF4nimo \xE9 boato.", String.raw`\b(?:teve|tem|conheço|conheci) (?:um|uma|esse|essa)\s+(?:cara|moça|mulher|homem|cliente|aluno|aluna|criador|criadora|empresa|loja|amigo|amiga|dono|dona)\b|\b(?:um|uma) (?:cliente|aluno|aluna|amigo|amiga) (?:meu |minha )?(?:que|saiu|fez|cresceu|vendeu|faturou)\b`),
  F(26, "O superlativo", "O jeito mais {r\xE1pido} de {coisa} \xE9 {resposta}.", "O jeito mais r\xE1pido de ganhar confian\xE7a \xE9 juntar provas que ningu\xE9m discute.", "O JEITO MAIS R\xC1PIDO", "V\xEDdeo de uma afirma\xE7\xE3o, sem hist\xF3ria. \xC9 o formato mais comum e o mais f\xE1cil de errar.", 'Superlativo com resposta mole. Se a segunda metade \xE9 "const\xE2ncia", voc\xEA n\xE3o disse nada.', String.raw`^\s*(?:o|a)\s+(?:jeito|forma|maneira|melhor|pior|maior|única|único|unico)\b|\b(?:o|a) (?:jeito|forma|maneira) mais \p{L}+ de\b|^\s*(?:a|o) (?:coisa|dica|erro) mais (?:importante|subestimad\p{L}*|comum)\b`)
];
var CLASSIFY_ORDER = [1, 23, 5, 4, 3, 15, 20, 7, 9, 26, 25, 24, 18, 17, 8, 6, 16, 12, 10, 2, 13, 19, 21, 22, 11, 14];
var hookById = (id) => HOOKS.find((h) => h.id === id);
function classifyHook(text) {
  for (const id of CLASSIFY_ORDER) {
    const h = hookById(id);
    if (h && h.match.test(text)) return h;
  }
  return void 0;
}
var STAKES = new Set(
  ["pare", "parar", "para", "nunca", "errado", "errada", "erro", "erros", "errei", "perdi", "perder", "perdendo", "perdeu", "custou", "custa", "custo", "quebrei", "quebrou", "faliu", "falhei", "falhou", "ninguem", "nao", "nem", "jamais", "desisti", "demitido", "demiti", "apaguei", "apague", "cortei", "corte", "gratis", "paguei", "pagar", "cobrei", "cobrar", "contratei", "economizei", "primeiro", "proibido", "ilegal", "pior", "odeio", "odiei", "desperdicei", "golpe", "mentira", "mentiram", "verdade", "segredo", "escondido", "roubou", "antes", "ate", "mas", "exceto", "problema", "risco", "perigo", "cuidado", "alerta", "arrependo", "arrependi", "deveria", "ainda", "ja", "so", "sem", "contra", "versus", "vs", "prejuizo", "multa", "caro", "barato", "flop", "flopou", "travou", "bloqueado", "banido", "processado", "reembolso", "devolver", "sumiu", "fechou", "fechar"].map(fold)
);
var WEAK_OPENERS = ["entao", "bom", "bem", "ola", "oi", "e ai", "eai", "galera", "gente", "pessoal", "fala", "bem-vindo", "bem-vindos", "hoje", "basicamente", "sinceramente", "olha so", "escuta", "tipo", "deixa eu", "vou", "eu queria", "eu quero", "eu vim", "uma das", "voce ja", "voces ja", "voce sabia", "sabia que", "neste", "nesse", "no video", "muita gente", "existe", "existem", "isso e", "e muito", "como um", "como uma", "quando se trata", "se voce ja", "voce sabe"];
var IMPERATIVES = new Set(["pare", "parem", "copia", "copie", "rouba", "roube", "apague", "apaga", "tente", "testa", "teste", "veja", "olha", "assista", "leia", "salva", "salve", "use", "usa", "faca", "faz", "escreva", "mande", "manda", "envie", "comece", "largue", "larga", "nunca", "sempre", "nao", "coloque", "confira", "anota", "anote", "esquece", "esqueca", "troque", "troca"].map(fold));
var DEALBREAKERS = [
  [rx(String.raw`^\s*(?:para de rolar|pare de rolar|não (?:pula|pule|passa|passe|role)|espera,? não)`), 'Abre com "pare de rolar". Pedir aten\xE7\xE3o prova que voc\xEA n\xE3o conquistou.'],
  [rx(String.raw`\b(?:no vídeo de hoje|neste vídeo|nesse vídeo|nesse reels|neste reels|hoje eu vou te mostrar|hoje vou te mostrar|vou te mostrar como|vou te ensinar)\b`), "Pre\xE2mbulo de v\xEDdeo. Apague e comece pela entrega."],
  [rx(String.raw`^\s*(?:oi|olá|ola|e aí|eai|fala,? galera|fala,? pessoal|bom dia|boa tarde|boa noite|seja bem-vind)`), "Sauda\xE7\xE3o. Ningu\xE9m veio ao feed para ser cumprimentado."],
  [HASHTAG, "Hashtag no gancho. Hashtag fica no fim da legenda, se ficar."],
  [EMOJI, "Emoji no gancho. Texto em tamanho de gancho tem espa\xE7o para palavras ou para emoji, n\xE3o os dois."]
];
var HOOK_CHECKS = ["TAMANHO", "CONCRETO", "TENSAO", "FRENTE", "PUBLICO"];
var PER_SECOND = 2.7;
function checkLength(text) {
  const n = words(text).length;
  const chars = text.trim().length;
  let score = n >= 5 && n <= 12 ? 100 : n < 5 ? 100 - (5 - n) * 20 : 100 - (n - 12) * 11;
  if (chars > 60) score -= 12;
  return [clamp(score), `${n} palavras, ${chars} caracteres, ~${(n / PER_SECOND).toFixed(1).replace(".", ",")} s falado (ideal: 5 a 12 palavras)`];
}
function checkConcrete(text) {
  const nums = (text.match(NUMBER) ?? []).map((s) => s.trim()).filter(Boolean);
  const propers = [...new Set(text.match(PROPER) ?? [])];
  const spoken = words(text).map(fold).filter((w) => SPOKEN_NUMBERS.has(w) || MONEY_WORDS.has(w));
  const hits = nums.length + propers.length + spoken.length;
  const found = [...nums.slice(0, 2), ...propers.slice(0, 2), ...spoken.slice(0, 2)].join(", ");
  return [hits ? clamp(45 + hits * 30) : 15, hits ? `${hits} marca(s) concreta(s): ${found}` : "nenhum n\xFAmero, nome ou coisa que d\xEA para conferir"];
}
function checkStakes(text) {
  const low = words(text).map(fold);
  const markers = [...new Set(low.filter((w) => STAKES.has(w)))].sort();
  if (/R\$\s?\d/.test(text)) markers.push("um pre\xE7o");
  if (/\bem vez de\b/i.test(fold(text))) markers.push("em vez de");
  const n = markers.length;
  return [n === 0 ? 20 : n === 1 ? 70 : 100, n ? `${n} marca(s) de tens\xE3o: ${markers.slice(0, 4).join(", ")}` : "nada est\xE1 em jogo nesta frase"];
}
function checkFront(text) {
  const w = words(text);
  if (!w.length) return [0, "vazio"];
  const low = w.map(fold);
  const opener = low.slice(0, 3).join(" ");
  const weak = WEAK_OPENERS.find((o) => opener === o || opener.startsWith(`${o} `) || low[0] === o);
  const penalty = weak ? 30 : 0;
  let payload = -1;
  for (let i = 0; i < low.length; i++) {
    const t = low[i];
    if (STAKES.has(t) || SPOKEN_NUMBERS.has(t) || MONEY_WORDS.has(t) || /^(?:R\$|US\$|\$)?\d/.test(w[i]) || i > 0 && /^\p{Lu}\p{Ll}{2,}/u.test(w[i])) {
      payload = i;
      break;
    }
  }
  const [base, where] = payload < 0 ? [30, "nenhuma palavra forte na frase"] : payload <= 3 ? [100, `palavra forte na posi\xE7\xE3o ${payload + 1}`] : payload <= 6 ? [70, `palavra forte na posi\xE7\xE3o ${payload + 1}, d\xE1 para trazer \xE0 frente`] : [40, `palavra forte na posi\xE7\xE3o ${payload + 1}, tarde demais`];
  return [clamp(base - penalty), where + (weak ? `; abertura fraca "${weak}"` : "")];
}
function checkAddress(text) {
  const f = fold(text);
  const low = words(text).map(fold);
  if (/(?<![\p{L}])(voce|voces|vc|vcs|seu|sua|seus|suas|te|contigo)(?![\p{L}])/u.test(f)) return [100, "fala com quem est\xE1 vendo"];
  if (low[0] && IMPERATIVES.has(low[0])) return [90, `come\xE7a com uma ordem ("${w0(text)}")`];
  if (/(?<![\p{L}])(eu|meu|minha|meus|minhas|me|nos|nosso|nossa|a gente)(?![\p{L}])/u.test(f)) return [70, "primeira pessoa, sem falar com ningu\xE9m"];
  return [35, "terceira pessoa, ningu\xE9m na sala"];
}
var w0 = (text) => words(text)[0] ?? "";
function scoreHook(text) {
  const r = { TAMANHO: checkLength(text), CONCRETO: checkConcrete(text), TENSAO: checkStakes(text), FRENTE: checkFront(text), PUBLICO: checkAddress(text) };
  const problemas = DEALBREAKERS.filter(([re]) => new RegExp(re.source, re.flags.replace("g", "")).test(text)).map(([, msg]) => msg);
  const scores = HOOK_CHECKS.map((c) => r[c][0]);
  const nota = clamp(mean(scores) * 0.6 + Math.min(...scores) * 0.4 - problemas.length * 15);
  const veredito = nota >= 70 && Math.min(...scores) >= 55 && !problemas.length ? "FORTE" : nota >= 50 ? "OK" : "FRACO";
  const pior = HOOK_CHECKS.reduce((a, b) => r[b][0] < r[a][0] ? b : a);
  const f = classifyHook(text);
  return {
    gancho: text.trim(),
    nota: round1(nota),
    veredito,
    checks: Object.fromEntries(HOOK_CHECKS.map((c) => [c, { nota: round1(r[c][0]), detalhe: r[c][1] }])),
    pior,
    problemas,
    ...f ? { formula: { id: f.id, nome: f.nome } } : {}
  };
}
var rankHooks = (hooks) => hooks.map((h) => h.trim()).filter(Boolean).map(scoreHook).sort((a, b) => b.nota - a.nota);
var hooksForPrompt = () => HOOKS.map((h) => ({ id: h.id, nome: h.nome, modelo: h.modelo, exemplo: h.exemplo, tela: h.tela, serve: h.serve, armadilha: h.armadilha }));

// src/features/instagram-ia/tempos.ts
var HOOK_WINDOW = 3;
var MAX_BEAT = 4;
var ABSTRACT_RUN = 3;
var DEFAULT_WPM = 160;
var STOP = new Set(
  ["o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou", "mas", "se", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "por", "pra", "pro", "para", "com", "que", "isso", "isto", "esse", "essa", "este", "esta", "\xE9", "s\xE3o", "foi", "era", "ser", "ter", "tem", "tinha", "voc\xEA", "voce", "vc", "seu", "sua", "eu", "meu", "minha", "me", "n\xF3s", "nosso", "nossa", "a gente", "eles", "elas", "ele", "ela", "ent\xE3o", "s\xF3", "n\xE3o", "nao", "j\xE1", "vai", "vou", "faz", "fiz", "ao", "aos", "\xE0", "\xE0s", "l\xE1", "aqui", "tudo", "todo", "toda", "mais", "muito", "como", "quando", "at\xE9"].map(fold)
);
var concreteCount = (t) => (t.match(NUMBER) ?? []).filter((s) => s.trim()).length + (t.match(PROPER) ?? []).length;
function splitBeats(raw, wps) {
  const beats = [];
  for (const line of raw.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (words(line).length / wps <= MAX_BEAT * 1.5) {
      beats.push(line);
      continue;
    }
    let buf = "";
    for (const part of (line.match(/[^.!?]+[.!?]*/g) ?? []).map((p) => p.trim()).filter(Boolean)) {
      const candidate = `${buf} ${part}`.trim();
      if (buf && words(candidate).length / wps > MAX_BEAT) {
        beats.push(buf);
        buf = part;
      } else buf = candidate;
    }
    if (buf) beats.push(buf);
  }
  return beats;
}
var sec = (s) => `${s.toFixed(1).replace(".", ",")} s`;
function beatSheet(raw, opts = {}) {
  const ppm = opts.ppm && opts.ppm > 60 ? opts.ppm : DEFAULT_WPM;
  const wps = ppm / 60;
  const texts = splitBeats(raw, wps);
  if (!texts.length) return null;
  let clock = 0;
  const rows = texts.map((texto, i) => {
    const n = words(texto).length;
    const duracao = n / wps;
    const row = { n: i + 1, inicio: Math.round(clock * 100) / 100, duracao: Math.round(duracao * 100) / 100, palavras: n, texto, concreto: concreteCount(texto), marca: "", alertas: [] };
    clock += duracao;
    return row;
  });
  const total = clock;
  for (const r of rows) if (r.n === 1 || r.inicio + r.duracao <= HOOK_WINDOW) r.marca = "GANCHO";
  const last = rows[rows.length - 1];
  last.marca = last.marca === "GANCHO" ? "GANCHO/CHAMADA" : "CHAMADA";
  const half = total / 2;
  for (const r of rows) if (!r.marca && r.inicio <= half && half < r.inicio + r.duracao) r.marca = "MEIO";
  const notas = [];
  const first = rows[0];
  if (first.duracao > HOOK_WINDOW) {
    first.alertas.push(`o gancho leva ${sec(first.duracao)}, passa dos ${HOOK_WINDOW} s`);
    notas.push(`A batida 1 leva ${sec(first.duracao)} para ser dita. Corte para ${Math.floor(HOOK_WINDOW * wps)} palavras ou menos, ou o gancho chega depois que a pessoa j\xE1 decidiu.`);
  }
  if (!first.concreto) notas.push("A batida 1 n\xE3o tem n\xFAmero nem nome. Gancho sem nada que d\xEA para conferir \xE9 o que a pessoa passa.");
  const longs = rows.filter((r) => r.duracao > MAX_BEAT);
  for (const r of longs) r.alertas.push(`${sec(r.duracao)} numa batida s\xF3`);
  if (longs.length) notas.push(`Batida(s) ${longs.map((r) => r.n).join(", ")} passam de ${MAX_BEAT} s. Divida a linha ou mude o que est\xE1 na tela no meio dela: quadro parado \xE9 onde as pessoas saem.`);
  let run = 0;
  let start = 0;
  for (const r of rows) {
    if (!r.concreto) {
      if (!run) start = r.n;
      run++;
      if (run === ABSTRACT_RUN) notas.push(`As batidas ${start} a ${r.n} n\xE3o t\xEAm nada concreto. Ponha um n\xFAmero, um nome ou um pre\xE7o em uma delas.`);
    } else run = 0;
  }
  const key = (t) => new Set(words(t).map(fold).filter((w) => !STOP.has(w) && w.length > 2));
  const a = key(first.texto);
  const shared = [...key(last.texto)].filter((w) => a.has(w)).sort();
  const loop = shared.length > 0 && rows.length > 1;
  notas.push(loop ? `Tem loop: a \xFAltima batida repete "${shared.slice(0, 3).join(", ")}" do gancho. Segunda visualiza\xE7\xE3o \xE9 alcance de gra\xE7a.` : "Sem loop. A \xFAltima batida n\xE3o repete nenhuma palavra do gancho, ent\xE3o o v\xEDdeo termina reto. Repetir uma palavra da batida 1 \xE9 o replay mais barato que existe.");
  if (opts.alvo) {
    const delta = total - opts.alvo;
    if (Math.abs(delta) <= opts.alvo * 0.1) notas.push(`Dura\xE7\xE3o no alvo (${sec(total)} para ${opts.alvo} s).`);
    else if (delta > 0) notas.push(`${sec(delta)} acima do alvo. Corte umas ${Math.round(delta * wps)} palavras.`);
    else notas.push(`${sec(-delta)} abaixo do alvo. Acrescente umas ${Math.round(-delta * wps)} palavras ou grave curto. Curto costuma ser o certo.`);
  }
  return { ppm, ...opts.alvo ? { alvo: opts.alvo } : {}, segundos: Math.round(total * 10) / 10, palavras: rows.reduce((s, r) => s + r.palavras, 0), batidas: rows, notas, loop };
}

// src/features/instagram-ia/legenda.ts
var CAPTION_LIMIT = 2200;
var CAPTION_CUT = 125;
var HASHTAG_LIMIT = 5;
var ASKS = [
  // sem `i`: a palavra pedida vem em maiúsculas ("Comenta CONTRATO")
  [rx(String.raw`\b(?:[cC]omenta|[cC]omente|[cC]omentem|[eE]screve|[eE]screva|[dD]igita|[dD]igite)\s+(?:a palavra\s+|aqui\s+)?["“']?\p{Lu}{2,}\b`, "u"), "comentar uma palavra"],
  [rx(String.raw`\b(?:me chama|chama|me manda|manda|envia|mande)\s+(?:uma\s+)?(?:no |na |um |uma )?(?:direct|dm|inbox|mensagem|whats|whatsapp|zap)\b`), "chamar no direct"],
  [rx(String.raw`\b(?:salva|salve|salvem|guarda|guarde)\s+(?:esse|este|essa|esta|o|pra|para)\b`), "salvar"],
  [rx(String.raw`\b(?:compartilha|compartilhe|manda (?:pra|para) (?:alguém|quem|aquele|aquela|sua|seu)|envia (?:pra|para))\b`), "compartilhar"],
  [rx(String.raw`\b(?:me segue|me siga|siga o perfil|segue o perfil|segue a gente|siga a gente|ativa o sininho)\b`), "seguir"],
  [rx(String.raw`\b(?:link na bio|link no perfil|link da bio|clica no link|clique no link)\b`), "link na bio"],
  [rx(String.raw`\b(?:arrasta|arraste|desliza|deslize|passa pro lado|passe para o lado)\b`), "arrastar"],
  [rx(String.raw`\b(?:me conta|me fala|me diz|qual (?:você|vc) (?:prefere|escolhe|usaria)|qual delas|qual deles|você prefere|vc prefere)\b`), "responder uma pergunta"],
  [rx(String.raw`\b(?:agende|agenda|reserve|reserva|garanta|compre|peça|encomende|faça seu pedido)\s+(?:já|agora|o seu|a sua|seu|sua|pelo|pela|no|na)\b`), "comprar ou agendar"]
];
var FILLER_TAGS = new Set(["#viral", "#fyp", "#explore", "#explorar", "#explorepage", "#foryou", "#foryoupage", "#paravoce", "#pravoce", "#trending", "#trend", "#instagood", "#love", "#amor", "#follow", "#sigam", "#sdv", "#like4like", "#curtir", "#reels", "#reelsinstagram", "#reelsbrasil", "#viralreels", "#instadaily", "#brasil", "#tbt", "#fy"].map(fold));
var CONCRETE = new RegExp(`${NUMBER.source}|${PROPER.source}`, "gmu");
function lintCaption(raw, opts = {}) {
  const cut = opts.corte ?? CAPTION_CUT;
  const text = raw.trim();
  const chars = [...text].length;
  const firstLine3 = (text.split("\n")[0] ?? "").trim();
  const tags = all(HASHTAG, text, 1);
  const mentions = all(MENTION, text, 1);
  const links = all(LINK, text);
  const emoji = all(EMOJI, text);
  const visible = [...text].slice(0, cut).join("");
  const asks = ASKS.filter(([re]) => re.test(text)).map(([, n]) => n);
  const filler = tags.filter((t) => FILLER_TAGS.has(fold(t)));
  const keywords = (opts.palavras ?? []).map((k) => k.trim()).filter(Boolean);
  const checks = [];
  const add = (id, nome, status, detalhe) => checks.push({ id, nome, status, detalhe });
  add("tamanho", "Tamanho", chars > CAPTION_LIMIT ? "CORRIGIR" : "OK", `${chars} de ${CAPTION_LIMIT} caracteres${chars > CAPTION_LIMIT ? `, ${chars - CAPTION_LIMIT} acima do limite` : ""}`);
  if (!firstLine3) add("primeira", "Primeira linha", "CORRIGIR", "a legenda come\xE7a com uma linha em branco");
  else if (/^[#@]/.test(firstLine3)) add("primeira", "Primeira linha", "CORRIGIR", "come\xE7a com hashtag ou men\xE7\xE3o, no \xFAnico lugar que vale uma frase");
  else if (/^\p{Extended_Pictographic}/u.test(firstLine3)) add("primeira", "Primeira linha", "ATENCAO", "come\xE7a com emoji: a primeira coisa lida devia ser palavra");
  else if (/^(?:oi|olá|ola|bom dia|boa tarde|boa noite|e aí|fala galera)\b/i.test(firstLine3)) add("primeira", "Primeira linha", "CORRIGIR", "come\xE7a com sauda\xE7\xE3o: ningu\xE9m abre o post para ser cumprimentado");
  else if ([...firstLine3].length > cut) add("primeira", "Primeira linha", "ATENCAO", `${[...firstLine3].length} caracteres: o feed corta em ${cut} no meio da ideia. Tudo bem se o corte for suspense; ruim se for no meio de uma ora\xE7\xE3o`);
  else add("primeira", "Primeira linha", "OK", `${[...firstLine3].length} caracteres, aparece inteira`);
  const concrete = visible.match(CONCRETE) ?? [];
  add("concreto", "Gancho concreto", concrete.length ? "OK" : "ATENCAO", concrete.length ? `${concrete.length} n\xFAmero(s) ou nome(s) antes do "mais"` : 'nada que d\xEA para conferir antes do "mais"');
  if (tags.length > HASHTAG_LIMIT) add("hashtags", "Hashtags", "CORRIGIR", `${tags.length} hashtags, acima do limite de ${HASHTAG_LIMIT} do Instagram (desde dez/2025). As que passam da quinta n\xE3o contam e o bloco parece antigo`);
  else if (filler.length) add("hashtags", "Hashtags", "ATENCAO", `${tags.length} hashtag(s), ${filler.length} gen\xE9rica(s) (${filler.slice(0, 3).join(", ")}): n\xE3o descrevem nada. Use tema, n\xE3o "viral"`);
  else add("hashtags", "Hashtags", "OK", tags.length ? `${tags.length}: ${tags.join(" ")}` : "nenhuma (tudo bem: hashtag virou etiqueta, n\xE3o alcance)");
  const tagInWindow = tags.some((t) => visible.includes(t));
  add("lugar-hashtags", "Lugar das hashtags", tagInWindow ? "ATENCAO" : "OK", !tags.length ? "sem hashtags" : tagInWindow ? "tem hashtag na parte vis\xEDvel, gastando o espa\xE7o do feed com etiqueta" : 'hashtags depois do "mais"');
  add("links", "Links", links.length ? "ATENCAO" : "OK", links.length ? `${links.length} link(s) na legenda, e legenda n\xE3o \xE9 clic\xE1vel. Mande para a bio ou para o direct` : "nenhum link morto no texto");
  if (asks.length === 1) add("chamada", "Uma chamada", "OK", `uma chamada: ${asks[0]}`);
  else if (!asks.length) add("chamada", "Uma chamada", "ATENCAO", "sem chamada. Decida para que serve este post");
  else add("chamada", "Uma chamada", "ATENCAO", `${asks.length} chamadas (${asks.join(", ")}). Duas chamadas valem o mesmo que nenhuma`);
  const density = emoji.length * 100 / Math.max(chars, 1);
  add("emoji", "Emoji", density > 4 ? "ATENCAO" : "OK", `${emoji.length} emoji(s), ${density.toFixed(1).replace(".", ",")} a cada 100 caracteres${density > 4 ? ": vira enfeite" : ""}`);
  if (keywords.length) {
    const low = fold(text);
    const found = keywords.filter((k) => low.includes(fold(k)));
    const missing = keywords.filter((k) => !low.includes(fold(k)));
    const inWindow = found.filter((k) => fold(visible).includes(fold(k)));
    add("busca", "Termos de busca", !missing.length ? "OK" : found.length ? "ATENCAO" : "CORRIGIR", `${found.length} de ${keywords.length} no texto${found.length ? `, ${inWindow.length} na parte vis\xEDvel` : ""}${missing.length ? `. Faltam: ${missing.join(", ")}` : ""}`);
  }
  const fails = checks.filter((c) => c.status === "CORRIGIR").length;
  const warns = checks.filter((c) => c.status === "ATENCAO").length;
  return {
    caracteres: chars,
    limite: CAPTION_LIMIT,
    corte: cut,
    visivel: visible,
    cortada: chars > cut,
    primeira_linha: [...firstLine3].length,
    hashtags: tags,
    mencoes: mentions,
    links,
    emojis: emoji.length,
    chamadas: asks,
    checks,
    veredito: fails ? "CORRIGIR" : warns ? "REVISAR" : "PRONTA"
  };
}

// src/features/instagram-ia/humanizar.ts
var E = (family, pairs) => pairs.map(([find, replace]) => ({ find, replace, family }));
var LEXICON = [
  ...E("abertura", [
    ["no mundo acelerado de hoje", "hoje"],
    ["no mundo de hoje", "hoje"],
    ["nos dias de hoje", "hoje"],
    ["na era digital", "hoje"],
    ["no cen\xE1rio atual", "hoje"],
    ["em um mundo cada vez mais", "num mundo mais"],
    ["num mundo cada vez mais", "num mundo mais"],
    ["em um cen\xE1rio cada vez mais", "num cen\xE1rio mais"],
    ["vamos combinar", ""],
    ["sejamos sinceros", ""],
    ["vamos ser sinceros", ""],
    ["pensa comigo", ""],
    ["imagine um mundo onde", "imagine se"],
    ["n\xE3o \xE9 segredo que", ""],
    ["todos n\xF3s j\xE1 passamos por isso", ""],
    ["quem nunca", ""],
    ["a verdade \xE9 que", ""],
    ["a dura verdade \xE9 que", ""],
    ["sem mais delongas", ""],
    ["apertem os cintos", ""],
    ["\xE9 com muita alegria que", ""],
    ["tenho o prazer de anunciar", ""],
    ["estou muito feliz em compartilhar", ""],
    ["\xE9 com grande satisfa\xE7\xE3o que", ""]
  ]),
  ...E("fechamento", [
    ["reflita sobre isso", ""],
    ["fica a reflex\xE3o", ""],
    ["a escolha \xE9 sua", ""],
    ["o futuro \xE9 agora", ""],
    ["o futuro j\xE1 chegou", ""],
    ["no fim das contas", ""],
    ["no final do dia", ""],
    ["ao fim e ao cabo", ""],
    ["leia de novo", ""],
    ["leia novamente", ""],
    ["e o resto \xE9 hist\xF3ria", ""],
    ["simples assim", ""],
    ["pura e simplesmente", ""]
  ]),
  ...E("conector", [
    ["al\xE9m disso", "e"],
    ["ademais", "e"],
    ["outrossim", "e"],
    ["adicionalmente", "e"],
    ["dessa forma", "assim"],
    ["desta forma", "assim"],
    ["dessa maneira", "assim"],
    ["nesse sentido", ""],
    ["neste sentido", ""],
    ["vale ressaltar que", ""],
    ["vale destacar que", ""],
    ["vale lembrar que", "lembre que"],
    ["\xE9 importante destacar que", ""],
    ["\xE9 importante ressaltar que", ""],
    ["\xE9 importante lembrar que", "lembre que"],
    ["cabe destacar que", ""],
    ["em suma", "enfim"],
    ["em resumo", "enfim"],
    ["em s\xEDntese", "enfim"],
    ["com isso em mente", ""],
    ["quando se trata de", "em"],
    ["no que diz respeito a", "sobre"],
    ["no que tange a", "sobre"],
    ["a fim de", "para"],
    ["com o objetivo de", "para"],
    ["uma ampla gama de", "v\xE1rios"],
    ["uma variedade de", "v\xE1rios"],
    ["mais do que nunca", "agora"],
    ["sem sombra de d\xFAvidas", ""],
    ["sem d\xFAvida alguma", ""],
    ["de forma eficiente", "bem"],
    ["de maneira eficaz", "bem"],
    ["de forma estrat\xE9gica", ""],
    ["de forma consistente", "sempre"],
    ["tive a oportunidade de", "pude"],
    ["avan\xE7ando para hoje", "hoje"]
  ]),
  ...E("verbo", [
    ["mergulhar fundo", "entrar"],
    ["mergulhe nesse", "entre nesse"],
    ["mergulhe neste", "entre neste"],
    ["elevar o n\xEDvel", "melhorar"],
    ["vamos mergulhar", "vamos ver"],
    ["alavancar", "usar"],
    ["alavancando", "usando"],
    ["potencializar", "aumentar"],
    ["potencialize", "aumente"],
    ["impulsionar", "aumentar"],
    ["impulsione", "aumente"],
    ["desbloquear", "conseguir"],
    ["desbloqueie", "consiga"],
    ["destravar", "conseguir"],
    ["elevar ao pr\xF3ximo n\xEDvel", "melhorar"],
    ["levar ao pr\xF3ximo n\xEDvel", "melhorar"],
    ["otimizar", "melhorar"],
    ["maximizar", "aumentar"],
    ["agregar valor", "ajudar"],
    ["fomentar", "criar"],
    ["catalisar", "acelerar"],
    ["revolucionar", "mudar"],
    ["transformar sua vida", "mudar sua rotina"],
    ["ressignificar", "mudar"],
    ["empoderar", "ajudar"],
    ["viabilizar", "permitir"],
    ["proporcionar", "dar"],
    ["proporciona", "d\xE1"],
    ["explorar o potencial", "usar"]
  ]),
  ...E("adjetivo", [
    ["robusto", "s\xF3lido"],
    ["robusta", "s\xF3lida"],
    ["transformador", "grande"],
    ["transformadora", "grande"],
    ["revolucion\xE1rio", "novo"],
    ["revolucion\xE1ria", "nova"],
    ["inovador", "novo"],
    ["inovadora", "nova"],
    ["de ponta", "novo"],
    ["disruptivo", "novo"],
    ["disruptiva", "nova"],
    ["crucial", "importante"],
    ["primordial", "importante"],
    ["imprescind\xEDvel", "necess\xE1rio"],
    ["abrangente", "completo"],
    ["hol\xEDstico", "completo"],
    ["hol\xEDstica", "completa"],
    ["inigual\xE1vel", "raro"],
    ["incompar\xE1vel", "raro"],
    ["inestim\xE1vel", "\xFAtil"],
    ["meticuloso", "cuidadoso"],
    ["meticulosamente", "com cuidado"],
    ["minucioso", "cuidadoso"],
    ["not\xE1vel", "bom"],
    ["extraordin\xE1rio", "muito bom"],
    ["extraordin\xE1ria", "muito boa"],
    ["excepcional", "muito bom"],
    ["\xFAnico no mercado", "diferente"],
    ["experi\xEAncia \xFAnica", "experi\xEAncia"],
    ["sem esfor\xE7o", "f\xE1cil"],
    ["sem complica\xE7\xE3o", "simples"],
    ["cativante", "interessante"],
    ["deslumbrante", "bonito"],
    ["de tirar o f\xF4lego", "bonito"],
    ["ic\xF4nico", "conhecido"],
    ["ic\xF4nica", "conhecida"],
    ["imperd\xEDvel", "bom"],
    ["indispens\xE1vel", "\xFAtil"],
    ["personalizado sob medida", "sob medida"],
    ["eficaz", "que funciona"]
  ]),
  ...E("substantivo", [
    ["sua jornada", "seu caminho"],
    ["nessa jornada", "nesse caminho"],
    ["jornada de transforma\xE7\xE3o", "mudan\xE7a"],
    ["ecossistema", "sistema"],
    ["tape\xE7aria", "mistura"],
    ["alicerce", "base"],
    ["divisor de \xE1guas", "grande mudan\xE7a"],
    ["virada de chave", "mudan\xE7a"],
    ["game changer", "grande mudan\xE7a"],
    ["mindset", "cabe\xE7a"],
    ["sinergia", "parceria"],
    ["paradigma", "modelo"],
    ["um verdadeiro testemunho de", "uma prova de"],
    ["prova viva de", "prova de"],
    ["arsenal", "conjunto"],
    ["o pulo do gato", "o m\xE9todo"],
    ["o segredo do sucesso", "o que funciona"],
    ["molho secreto", "o m\xE9todo"],
    ["guia definitivo", "guia"],
    ["guia completo", "guia"],
    ["hack", "truque"],
    ["pr\xF3ximo n\xEDvel", "outro patamar"],
    ["excel\xEAncia", "qualidade"],
    ["solu\xE7\xF5es completas", "servi\xE7o"],
    ["solu\xE7\xF5es inovadoras", "servi\xE7o"]
  ]),
  ...E("instagram", [
    ["pare de rolar", ""],
    ["para de rolar", ""],
    ["n\xE3o pule esse v\xEDdeo", ""],
    ["n\xE3o passa esse v\xEDdeo", ""],
    ["assista at\xE9 o final", ""],
    ["assista at\xE9 o fim", ""],
    ["fica at\xE9 o final", ""],
    ["no v\xEDdeo de hoje", ""],
    ["neste v\xEDdeo eu vou te mostrar", ""],
    ["neste v\xEDdeo vou te mostrar", ""],
    ["hoje eu vou te mostrar", ""],
    ["voc\xEA n\xE3o vai acreditar", ""],
    ["ningu\xE9m est\xE1 falando sobre isso", "pouca gente faz isso"],
    ["ningu\xE9m fala sobre isso", "pouca gente faz isso"],
    ["isso mudou tudo", "isso funcionou"],
    ["isso muda tudo", "isso funciona"],
    ["esse \xE9 o seu sinal para", ""],
    ["este \xE9 o seu sinal para", ""],
    ["segue para mais", ""],
    ["siga para mais conte\xFAdos", ""],
    ["siga para mais dicas", ""],
    ["me segue para mais", ""],
    ["marque algu\xE9m que precisa ver isso", ""],
    ["marca algu\xE9m que precisa ver isso", ""],
    ["marque aquele amigo que", ""],
    ["marca aquele amigo que", ""],
    ["comenta aqui embaixo", ""],
    ["comente aqui embaixo", ""],
    ["me conta nos coment\xE1rios", ""],
    ["deixe nos coment\xE1rios", ""],
    ["deixa nos coment\xE1rios", ""],
    ["compartilhe com quem precisa", ""],
    ["compartilha com quem precisa", ""],
    ["d\xE1 dois toques se", ""],
    ["d\xEA dois toques se", ""],
    ["o algoritmo ama", "o Instagram entrega"],
    ["o algoritmo adora", "o Instagram entrega"],
    ["hackear o algoritmo", "ter alcance"],
    ["vencer o algoritmo", "ter alcance"],
    ["viralizar da noite pro dia", "ter alcance"],
    ["viralizar da noite para o dia", "ter alcance"],
    ["corre que", ""],
    ["corre pra", ""],
    ["salva esse post para depois", ""],
    ["salve esse post para depois", ""],
    ["salva pra n\xE3o esquecer", ""],
    ["quem concorda", ""],
    ["concorda?", ""],
    ["faz sentido?", ""],
    ["bora pra cima", ""],
    ["conte\xFAdo de valor", "conte\xFAdo"],
    ["entregar valor", "ajudar"],
    ["gerar valor", "ajudar"]
  ])
];
var INVISIBLE = [
  [/\u200D|[\u200B\u200C\u2060\uFEFF\u00AD\u180E\u061C\u200E\u200F\u2063]/g, "", "caractere invis\xEDvel (largura zero, marca de dire\xE7\xE3o, h\xEDfen suave)"],
  [/[\u{E0000}-\u{E007F}]/gu, "", "caractere de etiqueta Unicode (texto escondido)"],
  [/[\u00A0\u202F\u2009\u2007\u2003\u2002]/g, " ", "espa\xE7o especial (n\xE3o separ\xE1vel, fino)"]
];
var TYPO = [
  ["\u2014", ", ", "travess\xE3o"],
  ["\u2013", "-", "meia-risca"],
  ["\u2018", "'", "aspas curvas"],
  ["\u2019", "'", "aspas curvas"],
  ["\u201C", '"', "aspas curvas"],
  ["\u201D", '"', "aspas curvas"],
  ["\u2026", "...", "retic\xEAncias de um caractere"],
  ["\u2022", "-", "marcador de lista"],
  ["\u2192", "->", "seta"]
];
var S = (id, source, nome, correcao, flags = "imu") => ({ id, re: rx(source, flags.includes("g") ? flags : `${flags}g`), nome, correcao });
var STRUCTURES = [
  S("nao-e-so", String.raw`\bnão (?:é|foi|são) (?:só|apenas|somente) [^.!?\n]{2,60}[,.;—-]\s*(?:é|foi|são|mas)\b`, '"N\xE3o \xE9 s\xF3 X, \xE9 Y"', "Diga a \xFAnica coisa que voc\xEA quer dizer. Apague a metade que prepara."),
  S("nao-so-mas", String.raw`\bnão (?:só|somente|apenas)\b[^.!?\n]{2,80}\bmas (?:também|tambem)\b`, '"N\xE3o s\xF3 X, mas tamb\xE9m Y"', "Quebre em duas frases ou corte a metade mais fraca."),
  S("nao-e-sobre", String.raw`\bnão é sobre [^.!?\n]{2,60}[.!]\s*é sobre\b`, '"N\xE3o \xE9 sobre X. \xC9 sobre Y."', "Comece pelo Y. A invers\xE3o \xE9 o que entrega."),
  S("o-resultado", String.raw`^\s*(?:o resultado|a melhor parte|o detalhe|o problema|a pegadinha|o segredo|a resposta|o motivo)\?\s*$`, 'Pergunta ret\xF3rica de uma linha ("O resultado?")', "Responda na mesma frase em vez de encenar a revela\xE7\xE3o."),
  S("aprendi", String.raw`\b(?:aqui está|eis|esse é|isso é) o que (?:eu )?aprendi\b|\b(?:o que|tudo que) (?:eu )?aprendi:`, '"Aqui est\xE1 o que aprendi"', "Diga a li\xE7\xE3o. Pule o an\xFAncio."),
  S("trio", String.raw`\b\p{L}+, \p{L}+ e \p{L}+[.!]`, 'Trio de tr\xEAs ("r\xE1pido, simples e eficaz.")', "Dois itens ou quatro. Tr\xEAs \xE9 o ritmo padr\xE3o da m\xE1quina."),
  S("emoji-ia", String.raw`[\u{1F680}\u{1F525}\u{1F4A1}\u{2728}\u{1F3AF}\u{1F4AA}]`, "Foguete, fogo, l\xE2mpada, brilho, alvo, bra\xE7o", "No m\xE1ximo um emoji, e n\xE3o um desses.", "gu"),
  S("parede-hashtag", String.raw`(?:#[\p{L}\p{N}_]+[ \t]*){6,}`, "Parede de hashtags (6 ou mais)", "No m\xE1ximo cinco, de tema. O Instagram limitou a cinco."),
  S("como-ia", String.raw`\bcomo (?:uma )?(?:ia|inteligência artificial|modelo de linguagem)\b`, "A IA falando de si", "Apague a frase."),
  S("em-resumo", String.raw`^\s*(?:em resumo|em suma|resumindo|concluindo|em conclusão|para concluir)\b`, "Abertura de conclus\xE3o de reda\xE7\xE3o", "Post n\xE3o precisa de par\xE1grafo de conclus\xE3o."),
  S("isca", String.raw`(?:\bconcorda\?|\be (?:você|vc)\?|\bfaz sentido\?|\bquem mais\b|\bestou errado\?|\btô errado\?)\s*$`, "Isca de engajamento no fim", "Fa\xE7a uma pergunta que s\xF3 voc\xEA faria, sobre o assunto do post."),
  S("pare-rolar", String.raw`^\s*(?:pare de rolar|para de rolar|não (?:pule|pula|passe|passa)|espera,? não)\b`, 'Abertura "pare de rolar"', "O que faz parar tem que ser a pr\xF3pria afirma\xE7\xE3o. Pedir aten\xE7\xE3o mostra que voc\xEA n\xE3o conquistou."),
  S("neste-video", String.raw`\b(?:no vídeo de hoje|neste vídeo|nesse vídeo|hoje (?:eu )?vou te mostrar|vou te (?:mostrar|ensinar) como)\b`, 'Pre\xE2mbulo ("neste v\xEDdeo vou te mostrar")', "Apague e comece na entrega. Os dois primeiros segundos decidem o reels."),
  S("lista-emoji", String.raw`^\s*[\u{1F300}-\u{1FAFF}✅➡⬅✔✨\u{1F449}]\s*\S`, "Lista com emoji no lugar de marcador", 'Use h\xEDfen ou quebra de linha. Lista de emoji \xE9 a coisa mais "modelo pronto" de uma legenda.', "gmu"),
  S("caixa-alta", String.raw`\b[A-ZÀ-Ý]{3,}\b(?:\s+\b[A-ZÀ-Ý]{3,}\b){2,}`, "Tr\xEAs ou mais palavras gritadas seguidas", "Caixa alta \xE9 volume, n\xE3o marca-texto. Uma palavra, no m\xE1ximo.", "gu"),
  S("isca-seguir", String.raw`\b(?:segue para mais|siga para mais|me segue para|marque alguém|marca alguém|marque aquele|marca aquele|dois toques se|compartilhe se|compartilha se|comenta aqui se)\b`, "Isca de seguir ou marcar", "Pe\xE7a a \xFAnica a\xE7\xE3o que este post merece. O pedido gen\xE9rico ensina o p\xFAblico a ignorar todos.")
];
var URL = /https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g;
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var lexRe = (find) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(find).replace(/\s+/g, "\\s+")}(?![\\p{L}\\p{N}])`, "giu");
var ORDERED = [...LEXICON].sort((a, b) => b.find.length - a.find.length);
var matchCase = (src, repl) => {
  if (!repl) return repl;
  if (src.length > 1 && src === src.toUpperCase() && /\p{L}/u.test(src)) return repl.toUpperCase();
  if (/^\p{Lu}/u.test(src)) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
};
function scanStructures(text) {
  const flags = [];
  for (const s of STRUCTURES) {
    const n = (text.match(s.re) ?? []).length;
    if (n) flags.push({ id: s.id, nome: s.nome, vezes: n, correcao: s.correcao });
  }
  const lens = (text.match(/[^.!?\n]+[.!?]*/g) ?? []).map((s) => s.trim().split(/\s+/).length).filter((n) => n > 2);
  if (lens.length >= 4) {
    const cv = mean(lens) ? pstdev(lens) / mean(lens) : 0;
    if (cv < 0.35) flags.push({ id: "frases-iguais", nome: `Frases do mesmo tamanho (varia\xE7\xE3o ${cv.toFixed(2).replace(".", ",")})`, vezes: lens.length, correcao: "Quebre uma frase no meio. Deixe outra correr longa. M\xE1quina escreve tudo igual." });
  }
  return flags;
}
function humanize(input) {
  const mudancas = [];
  const urls = [];
  let text = input.replace(URL, (m) => `\uE000${urls.push(m) - 1}\uE000`);
  for (const [re, to, name] of INVISIBLE) {
    const n = (text.match(re) ?? []).length;
    if (n) {
      mudancas.push({ tipo: "invisivel", de: name, para: to ? "espa\xE7o" : "apagado", vezes: n });
      text = text.replace(re, to);
    }
  }
  const stray = text.match(/[^\P{Cf}\uE000]/gu) ?? [];
  if (stray.length) {
    mudancas.push({ tipo: "invisivel", de: "outro caractere de formata\xE7\xE3o invis\xEDvel", para: "apagado", vezes: stray.length });
    text = text.replace(/[^\P{Cf}\uE000]/gu, "");
  }
  for (const [ch, to, name] of TYPO) {
    const n = text.split(ch).length - 1;
    if (!n) continue;
    mudancas.push({ tipo: "tipografia", de: `${ch} ${name}`, para: to.trim() || "espa\xE7o", vezes: n });
    if (ch === "\u2014") text = text.replace(/\s*—\s*/g, ", ");
    else if (ch === "\u2013") text = text.replace(/\s*–\s*(?=\d)/g, "-").replace(/\s+–\s+/g, ", ").replace(/–/g, "-");
    else text = text.split(ch).join(to);
  }
  text = text.replace(/,\s*([,.;:!?])/g, "$1").replace(/,\s*\n/g, "\n");
  for (const e of ORDERED) {
    const re = lexRe(e.find);
    const found = text.match(re);
    if (!found) continue;
    mudancas.push({ tipo: "lexico", de: e.find, para: e.replace || "(apagado)", vezes: found.length });
    text = text.replace(re, (m) => matchCase(m, e.replace));
  }
  text = text.replace(/[ \t]{2,}/g, " ").replace(/^[ \t]*(?:[,.;:!?]+[ \t]*)+/gm, "").replace(/^[ \t](?=\S)/gm, "").replace(/[ \t]+([,.;:!?])/g, "$1").replace(/,\s*([,.;:!?])/g, "$1").replace(/\.\.\./g, "\uE001").replace(/\.\s*\.+/g, ".").replace(/([!?])\s*\./g, "$1").replace(/\uE001/g, "...").replace(/^[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/(^|[.!?][ \t]+|\n)([Ee]), /gu, "$1$2 ");
  const starts = input.match(/(?:^|[.!?]\s+|\n)\s*(\p{L})/gu) ?? [];
  const upper = starts.filter((s) => /\p{Lu}/u.test(s.slice(-1))).length;
  if (starts.length && upper * 2 >= starts.length) text = text.replace(/(^|[.!?] |[.!?]\n|\n)(\s*)(\p{Ll})/gu, (_m, a, b, c) => a + b + c.toUpperCase());
  text = text.replace(/\uE000(\d+)\uE000/g, (_m, i) => urls[Number(i)] ?? "").trim();
  return { texto: text, mudancas, estruturas: scanStructures(text), total: mudancas.reduce((s, m) => s + m.vezes, 0) };
}
var WORDS = /[\p{L}']+/gu;
var scale = (value, human, machine) => human === machine ? 50 : clamp((value - machine) / (human - machine) * 100);
var SPOKEN = /(?<![\p{L}])(?:pra|pro|pros|pras|tá|tô|tava|né|cê|num|numa|dum|duma|vamo|bora|tipo|aí|daí|a gente|tão|tamo|ó)(?![\p{L}])/giu;
var PERSON = /(?<![\p{L}])(?:eu|me|meu|minha|meus|minhas|nós|nosso|nossa|a gente|você|vocês|vc|seu|sua|seus|suas|te)(?![\p{L}])/giu;
var HUMAN_CHECKS = ["RITMO", "CONCRETO", "CLICHES", "DIGITAL", "VOZ"];
function detect(text) {
  const w = text.match(WORDS) ?? [];
  const lens = (text.match(/[^.!?\n]+[.!?]*/g) ?? []).map((s) => s.trim().split(/\s+/).length).filter((n) => n > 2);
  const r = {};
  if (lens.length < 4) r.RITMO = [50, "curto demais para julgar"];
  else {
    const cv = mean(lens) ? pstdev(lens) / mean(lens) : 0;
    r.RITMO = [scale(cv, 0.7, 0.22), `varia\xE7\xE3o ${cv.toFixed(2).replace(".", ",")} em ${lens.length} frases (bom: 0,55 ou mais)`];
  }
  if (w.length < 25) r.CONCRETO = [50, "curto demais para julgar"];
  else {
    const hits = (text.match(NUMBER) ?? []).filter((s) => s.trim()).length + new Set(text.match(PROPER) ?? []).size;
    const d = hits * 100 / w.length;
    r.CONCRETO = [scale(d, 6, 0.5), `${hits} marcas concretas, ${d.toFixed(1).replace(".", ",")} a cada 100 palavras (bom: 4 ou mais)`];
  }
  if (!w.length) r.CLICHES = [50, "vazio"];
  else {
    let hits = 0;
    const found = [];
    for (const e of LEXICON) {
      const n = (text.match(lexRe(e.find)) ?? []).length;
      if (n) {
        hits += n;
        found.push(e.find);
      }
    }
    const d = hits * 100 / w.length;
    r.CLICHES = [scale(d, 0, 4), `${hits} clich\xEA(s), ${d.toFixed(1).replace(".", ",")} a cada 100 palavras${found.length ? ` (${found.slice(0, 4).join(", ")}${found.length > 4 ? ", \u2026" : ""})` : ""}`];
  }
  {
    const invisible = (text.match(/\p{Cf}/gu) ?? []).length;
    const em = text.split("\u2014").length - 1;
    const curly = (text.match(/[‘’“”]/g) ?? []).length;
    const ellip = text.split("\u2026").length - 1;
    const hard = (text.match(/[\u00A0\u202F\u2009]/g) ?? []).length;
    const per1k2 = (invisible * 4 + em * 2 + curly + ellip + hard) * 1e3 / Math.max(text.length, 1);
    r.DIGITAL = [scale(per1k2, 0, 12), `${invisible} invis\xEDvel, ${em} travess\xE3o, ${curly} aspas curvas, ${ellip} retic\xEAncias, ${hard} espa\xE7o especial`];
  }
  if (w.length < 25) r.VOZ = [50, "curto demais para julgar"];
  else {
    const per = 100 / w.length;
    const spoken = (text.match(SPOKEN) ?? []).length * per;
    const person = (text.match(PERSON) ?? []).length * per;
    const flags = scanStructures(text).filter((f) => f.id !== "frases-iguais");
    const tells = flags.reduce((s, f) => s + f.vezes, 0);
    const bullets = (text.match(/^\s*[-*•]\s+(.+)$/gm) ?? []).map((b) => b.trim().split(/\s+/).length);
    const uniform = bullets.length >= 3 && pstdev(bullets) < 1.6;
    let score = scale(spoken, 2, 0) * 0.3 + scale(person, 8, 1) * 0.4 + clamp(100 - tells * 22) * 0.3;
    if (uniform) score -= 12;
    r.VOZ = [clamp(score), `${spoken.toFixed(1).replace(".", ",")} marcas de fala ("pra", "t\xE1", "a gente") e ${person.toFixed(1).replace(".", ",")} pronomes pessoais a cada 100 palavras, ${tells} estrutura(s) de m\xE1quina${flags.length ? ` [${flags.slice(0, 4).map((f) => f.id).join(", ")}]` : ""}${uniform ? ", lista com itens do mesmo tamanho" : ""}`];
  }
  const scores = HUMAN_CHECKS.map((c) => r[c][0]);
  const nota = mean(scores) * 0.6 + Math.min(...scores) * 0.4;
  const pior = HUMAN_CHECKS.reduce((a, b) => r[b][0] < r[a][0] ? b : a);
  return {
    nota: round1(nota),
    veredito: nota >= 70 && Math.min(...scores) >= 55 ? "PASSA" : nota >= 50 ? "REVISAR" : "SINALIZADO",
    checks: Object.fromEntries(HUMAN_CHECKS.map((c) => [c, { nota: round1(r[c][0]), detalhe: r[c][1] }])),
    pior
  };
}
function humanizeReport(text) {
  const antes = detect(text);
  const h = humanize(text);
  const depois = detect(h.texto);
  return { ...h, antes, depois };
}

// src/features/instagram-ia/virais.ts
var num = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return void 0;
  const t = v.trim().toLowerCase().replace(/\s/g, "");
  const m = /^([\d.,]+)(mil|k|mi|m)?$/.exec(t);
  if (!m) return void 0;
  const n = Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return void 0;
  return m[2] === "mil" || m[2] === "k" ? n * 1e3 : m[2] === "mi" || m[2] === "m" ? n * 1e6 : n;
};
function normalizeSwipe(rows) {
  return rows.map((r) => ({
    perfil: typeof r.perfil === "string" ? r.perfil : void 0,
    seguidores: num(r.seguidores),
    mediana: num(r.mediana),
    views: num(r.views) ?? 0,
    gancho: typeof r.gancho === "string" ? r.gancho.trim() : "",
    tela: typeof r.tela === "string" ? r.tela : void 0,
    segundos: num(r.segundos),
    chamada: typeof r.chamada === "string" ? r.chamada : void 0,
    link: typeof r.link === "string" ? r.link : void 0
  })).filter((r) => r.views > 0 && r.gancho);
}
function rankSwipe(input) {
  const rows = input.map((r) => {
    const base = r.mediana || r.seguidores || 0;
    const s = scoreHook(r.gancho);
    const f = classifyHook(r.gancho);
    return { ...r, base, ...base ? { multiplo: round1(r.views / base) } : {}, ...f ? { formula: { id: f.id, nome: f.nome } } : {}, palavras: words(r.gancho).length, nota_gancho: s.nota, veredito_gancho: s.veredito };
  });
  const ranked = [...rows].sort((a, b) => (b.multiplo ?? 0) - (a.multiplo ?? 0));
  const third = Math.max(1, Math.floor(ranked.length / 3));
  const top = ranked.slice(0, third);
  const bottom = ranked.slice(-third);
  const counts = /* @__PURE__ */ new Map();
  for (const r of top) {
    const k = r.formula?.nome ?? "sem f\xF3rmula";
    counts.set(k, { vezes: (counts.get(k)?.vezes ?? 0) + 1, embaixo: 0 });
  }
  for (const r of bottom) {
    const k = r.formula?.nome ?? "sem f\xF3rmula";
    if (counts.has(k)) counts.get(k).embaixo++;
  }
  const withMedian = rows.filter((r) => r.mediana).length;
  const perfis = new Set(rows.map((r) => r.perfil ?? "")).size;
  const n = rows.length;
  return {
    base: withMedian === n ? "mediana do perfil" : withMedian ? "mistura" : "seguidores",
    n,
    perfis,
    reels: ranked,
    fora_da_curva: ranked.filter((r) => (r.multiplo ?? 0) >= 3),
    formulas_no_topo: [...counts].map(([nome, c]) => ({ nome, ...c })).sort((a, b) => b.vezes - a.vezes),
    nota_gancho: { topo: round1(median(top.map((r) => r.nota_gancho))), baixo: round1(median(bottom.map((r) => r.nota_gancho))) },
    palavras_gancho: { topo: median(top.map((r) => r.palavras)), baixo: median(bottom.map((r) => r.palavras)) },
    sem_formula: rows.filter((r) => !r.formula).length,
    confianca: n >= 40 && perfis >= 6 ? `${n} reels de ${perfis} perfis: j\xE1 sustenta uma conclus\xE3o.` : `${n} reels de ${perfis} perfil(is): \xE9 pista, n\xE3o prova. Com 40 reels de 6 perfis d\xE1 para afirmar alguma coisa.`
  };
}
function swipeMarkdown(s, titulo = "Arquivo de virais", data = /* @__PURE__ */ new Date()) {
  const br = (n) => String(n).replace(".", ",");
  const mult = (r) => r.multiplo !== void 0 ? `${String(r.multiplo).replace(".", ",")}x` : "?";
  const lines2 = [
    `# ${titulo}`,
    "",
    `**Atualizado:** ${data.toLocaleDateString("pt-BR")} \xB7 ${s.n} reels de ${s.perfis} perfis \xB7 base: ${s.base}`,
    "",
    `> ${s.confianca}`,
    "",
    "## O que est\xE1 acima da curva",
    "",
    ...s.formulas_no_topo.slice(0, 5).map((f) => `- **${f.nome}**: ${f.vezes}x no ter\xE7o de cima${f.embaixo ? `, ${f.embaixo}x no de baixo` : ", 0 no de baixo"}`),
    `- Nota mediana do gancho: ${br(s.nota_gancho.topo)} em cima, ${br(s.nota_gancho.baixo)} embaixo`,
    `- Palavras no gancho (mediana): ${br(s.palavras_gancho.topo)} em cima, ${br(s.palavras_gancho.baixo)} embaixo`,
    `- Sem f\xF3rmula: ${s.sem_formula} de ${s.n}. Leia esses \xE0 m\xE3o: \xE9 onde mora uma f\xF3rmula que ainda n\xE3o est\xE1 na lista.`,
    "",
    "## Os reels",
    "",
    ...s.reels.map((r) => `- **${mult(r)}** \xB7 ${r.formula ? `#${r.formula.id} ${r.formula.nome}` : "sem f\xF3rmula"} \xB7 ${r.perfil ?? ""} \xB7 ${r.views.toLocaleString("pt-BR")} views (base ${r.base ? r.base.toLocaleString("pt-BR") : "?"}) \xB7 gancho ${br(r.nota_gancho)}
  "${r.gancho}"${r.link ? `
  ${r.link}` : ""}`),
    "",
    "Copie a f\xF3rmula, nunca o v\xEDdeo: o formato do gancho, a estrutura, a dura\xE7\xE3o, o ritmo dos cortes. Nunca o roteiro, a voz ou a edi\xE7\xE3o de quem fez.",
    ""
  ];
  return lines2.join("\n");
}

// src/features/instagram-ia/auditoria.ts
var formatOf = (p) => p.product === "STORY" ? "story" : p.product === "REELS" || p.type === "VIDEO" ? "reels" : p.type === "CAROUSEL_ALBUM" ? "carrossel" : "foto";
var FORMAT_LABEL = { reels: "Reels", carrossel: "Carrossel", foto: "Foto" };
var per1k = (x, reach) => reach && x !== void 0 ? round1(x * 1e3 / reach) : void 0;
var day = (ms) => new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
var firstLine = (c) => (c ?? "").split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 140) ?? "";
var confidence = (n) => n >= 8 ? "alta" : n >= 4 ? "m\xE9dia" : "baixa";
function auditPosts(all2, opts = {}) {
  const now = opts.agora ?? Date.now();
  const since = opts.dias ? now - opts.dias * 864e5 : 0;
  const posts = all2.filter((p) => formatOf(p) !== "story" && p.postedAt >= since && (p.insights.views ?? p.insights.reach));
  if (!posts.length) return null;
  const viewsOf = (p) => p.insights.views ?? p.insights.reach ?? 0;
  const overall = median(posts.map(viewsOf));
  const byFormat = /* @__PURE__ */ new Map();
  for (const p of posts) {
    const f = formatOf(p);
    byFormat.set(f, [...byFormat.get(f) ?? [], p]);
  }
  const formatMedian = new Map([...byFormat].map(([f, list]) => [f, list.length >= 5 ? median(list.map(viewsOf)) : overall]));
  const rows = posts.map((p) => {
    const f = formatOf(p);
    const views = viewsOf(p);
    const reach = p.insights.reach;
    const line = firstLine(p.caption);
    const formula = line ? classifyHook(line) : void 0;
    return {
      id: p.id,
      formato: f,
      data: day(p.postedAt),
      ...p.permalink ? { link: p.permalink } : {},
      primeira_linha: line,
      ...formula ? { formula: { id: formula.id, nome: formula.nome } } : {},
      views,
      ...reach ? { alcance: reach } : {},
      multiplo: round1(views / (formatMedian.get(f) || overall || 1)),
      envios: p.insights.shares ?? 0,
      salvos: p.insights.saved ?? 0,
      ...per1k(p.insights.shares, reach) !== void 0 ? { envios_mil: per1k(p.insights.shares, reach) } : {},
      ...per1k(p.insights.saved, reach) !== void 0 ? { salvos_mil: per1k(p.insights.saved, reach) } : {},
      ...p.insights.follows !== void 0 && reach ? { seguidores_mil: per1k(p.insights.follows, reach) } : {},
      ...p.insights.ig_reels_avg_watch_time ? { assistido_s: round1(p.insights.ig_reels_avg_watch_time / 1e3) } : {}
    };
  });
  const ranked = [...rows].sort((a, b) => b.multiplo - a.multiplo || (b.envios_mil ?? 0) - (a.envios_mil ?? 0));
  const k = Math.min(5, Math.max(1, Math.floor(ranked.length / 3)));
  const topo = ranked.slice(0, k);
  const baixo = ranked.slice(-k).reverse();
  const por_formato = [...byFormat.keys()].map((f) => {
    const list = rows.filter((r) => r.formato === f);
    const env = list.map((r) => r.envios_mil).filter((x) => x !== void 0);
    const sav = list.map((r) => r.salvos_mil).filter((x) => x !== void 0);
    return { formato: FORMAT_LABEL[f], posts: list.length, multiplo_medio: round1(mean(list.map((r) => r.multiplo))), ...env.length ? { envios_mil: round1(mean(env)) } : {}, ...sav.length ? { salvos_mil: round1(mean(sav)) } : {} };
  });
  const formulaMap = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const key = r.formula ? `#${r.formula.id} ${r.formula.nome}` : "sem f\xF3rmula na 1\xAA linha";
    formulaMap.set(key, [...formulaMap.get(key) ?? [], r]);
  }
  const por_formula = [...formulaMap].map(([nome, list]) => ({ nome, posts: list.length, multiplo_medio: round1(mean(list.map((r) => r.multiplo))) })).sort((a, b) => b.multiplo_medio - a.multiplo_medio);
  const achados = [];
  const rest = (pred) => {
    const a = rows.filter(pred);
    const b = rows.filter((r) => !pred(r));
    return { a, b, ma: mean(a.map((r) => r.multiplo)), mb: mean(b.map((r) => r.multiplo)) };
  };
  if (por_formato.length > 1) {
    const best = [...por_formato].sort((a, b) => b.multiplo_medio - a.multiplo_medio);
    if (best[0].multiplo_medio >= best[best.length - 1].multiplo_medio * 1.5)
      achados.push({ texto: `${best[0].formato} rende ${String(best[0].multiplo_medio).replace(".", ",")}x a mediana; ${best[best.length - 1].formato}, ${String(best[best.length - 1].multiplo_medio).replace(".", ",")}x (n=${best[0].posts} e ${best[best.length - 1].posts}).`, confianca: confidence(Math.min(best[0].posts, best[best.length - 1].posts)) });
  }
  const named = por_formula.filter((f) => !f.nome.startsWith("sem") && f.posts >= 2);
  if (named.length) {
    const f = named[0];
    const { mb } = rest((r) => (r.formula ? `#${r.formula.id} ${r.formula.nome}` : "") === f.nome);
    if (f.multiplo_medio > mb * 1.3) achados.push({ texto: `Posts que abrem com a f\xF3rmula ${f.nome}: ${String(f.multiplo_medio).replace(".", ",")}x contra ${String(round1(mb)).replace(".", ",")}x do resto (n=${f.posts}).`, confianca: confidence(f.posts) });
  }
  {
    const { a, b, ma, mb } = rest((r) => /\d/.test(r.primeira_linha));
    if (a.length >= 2 && b.length >= 2 && Math.abs(ma - mb) >= 0.3) achados.push({ texto: `Primeira linha com n\xFAmero: ${String(round1(ma)).replace(".", ",")}x; sem n\xFAmero: ${String(round1(mb)).replace(".", ",")}x (n=${a.length} e ${b.length}).`, confianca: confidence(Math.min(a.length, b.length)) });
  }
  const viewsNoSends = topo.filter((r) => (r.envios_mil ?? 0) < 1 && r.multiplo >= 1.5);
  if (viewsNoSends.length >= 2) achados.push({ texto: `${viewsNoSends.length} dos melhores em views quase n\xE3o foram enviados (menos de 1 envio a cada mil de alcance): alcance que n\xE3o vira recomenda\xE7\xE3o.`, confianca: "m\xE9dia" });
  const follows = rows.filter((r) => r.seguidores_mil !== void 0);
  if (follows.length >= 4) {
    const hi = follows.filter((r) => r.multiplo >= 1.5);
    if (hi.length >= 2 && mean(hi.map((r) => r.seguidores_mil ?? 0)) < 1)
      achados.push({ texto: "Os posts que mais rodam quase n\xE3o trazem seguidor (menos de 1 a cada mil de alcance). Isso \xE9 problema de perfil, n\xE3o de gancho: rode a an\xE1lise de perfil antes de reescrever ganchos.", confianca: confidence(hi.length) });
  }
  if (!achados.length) achados.push({ texto: "Nada separa claramente os melhores dos piores nesta amostra. Dia e hor\xE1rio quase nunca s\xE3o a causa: olhe primeiro o gancho e o formato.", confianca: "baixa" });
  const worstFormat = [...por_formato].sort((a, b) => a.multiplo_medio - b.multiplo_medio)[0];
  const bestFormula = named[0];
  const dates = posts.map((p) => p.postedAt);
  return {
    n: rows.length,
    periodo: `${day(Math.min(...dates))} a ${day(Math.max(...dates))}`,
    mediana_views: Math.round(overall),
    base: [...byFormat].some(([, l]) => l.length >= 5) ? "mediana do mesmo formato (quando tem 5 posts ou mais), sen\xE3o da conta" : "mediana da conta",
    topo,
    baixo,
    por_formato,
    por_formula,
    achados,
    ...por_formato.length > 1 && worstFormat.multiplo_medio < 0.8 ? { parar: `${worstFormat.formato} (${String(worstFormat.multiplo_medio).replace(".", ",")}x a mediana)` } : {},
    ...bestFormula && bestFormula.multiplo_medio >= 1.3 ? { fazer_mais: `${bestFormula.nome} (${String(bestFormula.multiplo_medio).replace(".", ",")}x)` } : {},
    aviso: (rows.length < 12 ? `S\xF3 ${rows.length} posts: d\xE1 para ver pista, n\xE3o padr\xE3o. ` : "") + "A f\xF3rmula \xE9 lida na primeira linha da legenda (a Meta n\xE3o entrega o gancho falado nem a reten\xE7\xE3o aos 3 s por post; a reten\xE7\xE3o fica no app do Instagram)."
  };
}

// src/features/instagram-ia/perfil.ts
var PROFILE_RUBRIC = [
  { id: "nome", item: "Campo Nome", pontos: 12, nota_cheia: 'O campo Nome (30 caracteres, a linha em negrito, n\xE3o o @) traz o nome e o que faz, em palavras que as pessoas buscam: "Dana Ruiz | Contratos para fot\xF3grafos". A busca do Instagram l\xEA esse campo, e a maioria gasta s\xF3 com o nome.', falha_comum: "S\xF3 o nome, ou o nome com emoji." },
  { id: "bio-linha1", item: "Primeira linha da bio", pontos: 12, nota_cheia: "Diz para quem \xE9 e o que muda para essa pessoa, nas palavras dela. N\xE3o \xE9 cargo, nem lista de adjetivos, nem tr\xEAs emojis separados por barra.", falha_comum: '"Empreendedora | Apaixonada por caf\xE9 | M\xE3e de pet".' },
  { id: "bio-resto", item: "Resto da bio", pontos: 8, nota_cheia: "O resto dos 150 caracteres traz uma prova ou uma oferta espec\xEDfica, em frases, n\xE3o em lista com barras.", falha_comum: "Sopa de palavras-chave, ou espa\xE7o vazio." },
  { id: "fixados", item: "Os tr\xEAs fixados", pontos: 10, nota_cheia: "Tr\xEAs posts fixados no topo com tr\xEAs pap\xE9is: a melhor prova, a explica\xE7\xE3o mais clara da oferta, a melhor apresenta\xE7\xE3o de quem est\xE1 por tr\xE1s. N\xE3o os tr\xEAs com mais views por acaso.", falha_comum: "Nada fixado: o topo do grid \xE9 o que foi postado por \xFAltimo." },
  { id: "link", item: "Link", pontos: 8, nota_cheia: "Um destino que cumpre o que a bio prometeu. Cabem cinco links; mais de dois vira menu, e menu converte pior que porta.", falha_comum: "\xC1rvore de links com onze op\xE7\xF5es, ou nenhum link." },
  { id: "destaques", item: "Destaques", pontos: 8, nota_cheia: "De quatro a seis, com os nomes das perguntas que quem compra faz: Pre\xE7os, Resultados, Como funciona, Sobre. Capas iguais. Nada com mais de um ano na frente.", falha_comum: '"Aleat\xF3rio", "Vida", "Favoritos", ou 14 destaques sem ordem.' },
  { id: "grid", item: "Grid leg\xEDvel", pontos: 8, nota_cheia: "As nove primeiras capas se leem em miniatura e dizem do que \xE9 o perfil sem nenhum toque. Capa de reels escolhida, n\xE3o o primeiro quadro.", falha_comum: "Nove capas de rosto no meio da fala, sem texto." },
  { id: "foto", item: "Foto", pontos: 6, nota_cheia: "Rosto ocupando uns 60% de um c\xEDrculo que aparece com ~40 px. Olhos vis\xEDveis, foto dos \xFAltimos dois anos, fundo que n\xE3o compete. (Marca: logo leg\xEDvel nesse tamanho.)", falha_comum: "Corpo inteiro, logo numa marca pessoal, ou foto escura de bra\xE7o esticado." },
  { id: "arroba", item: "@ (usu\xE1rio)", pontos: 6, nota_cheia: "Leg\xEDvel, f\xE1cil de falar em voz alta e igual nas outras redes. Sem underline empilhado nem n\xFAmero no lugar de letra.", falha_comum: "Um @ que ningu\xE9m consegue escrever depois de ouvir uma vez." },
  { id: "categoria", item: "Categoria e contato", pontos: 6, nota_cheia: "Conta profissional com categoria que bate com a oferta e bot\xF5es de contato que funcionam (WhatsApp, e-mail que algu\xE9m l\xEA).", falha_comum: "Conta pessoal: sem n\xFAmeros e sem bot\xE3o de contato." },
  { id: "atividade", item: "Atividade recente", pontos: 10, nota_cheia: "Postou nos \xFAltimos sete dias e respondeu os coment\xE1rios do post mais recente. Perfil que postou pela \xFAltima vez em mar\xE7o parece fechado.", falha_comum: "Cinco semanas sem post, ou uma parede de coment\xE1rios sem resposta." },
  { id: "stories", item: "Stories", pontos: 6, nota_cheia: "Story no ar agora, ou na maioria dos dias. \xC9 a diferen\xE7a entre um perfil e uma pessoa.", falha_comum: "Nunca tem o anel." }
];
var RUBRIC_NOTE = "D\xEA nota honesta a cada item: nota generosa n\xE3o ajuda ningu\xE9m. A maioria dos perfis fica entre 30 e 49 na primeira passada. O campo Nome, a primeira linha da bio e os fixados pesam mais que a foto, porque \xE9 o que quem chegou por um reels processa antes de decidir seguir.";

// src/features/crm/profileAudit.ts
var PILLAR_LABEL = {
  bio: "Bio e nome",
  foto: "Foto do perfil",
  destaques: "Destaques",
  ritmo: "Ritmo de postagem",
  formatos: "Formatos",
  legendas: "Legendas",
  desempenho: "Desempenho",
  horarios: "Dias e hor\xE1rios"
};
var WEIGHT = { bio: 20, foto: 10, destaques: 10, ritmo: 20, formatos: 15, legendas: 10, desempenho: 20, horarios: 0 };
var PENALTY = { critico: 35, atencao: 15, info: 0, ok: 0 };
var DAY = 864e5;
var WEEKDAYS = ["domingo", "segunda", "ter\xE7a", "quarta", "quinta", "sexta", "s\xE1bado"];
var FORMAT_NAME = { reels: "Reels", carrossel: "Carrossel", foto: "Foto" };
var formatOf2 = (m) => m.product === "STORY" ? "story" : m.product === "REELS" || m.type === "VIDEO" ? "reels" : m.type === "CAROUSEL_ALBUM" ? "carrossel" : "foto";
var interactionsOf = (m) => m.insights.total_interactions ?? (m.insights.likes ?? m.likes ?? 0) + (m.insights.comments ?? m.comments ?? 0) + (m.insights.shares ?? 0) + (m.insights.saved ?? 0);
var median2 = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
var avg = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
var pct = (n) => `${Math.round(n * 100)}%`;
var times = (n) => `${n.toFixed(1).replace(".", ",")}x`;
var int = (n) => Math.round(n).toLocaleString("pt-BR");
var scoreOf = (findings) => Math.max(0, Math.min(100, 100 - findings.reduce((s, f) => s + PENALTY[f.level], 0)));
var CTA = /(chame|chama|fale|fala com|agende|agendar|agendamento|marque|pe[cç]a|or[cç]amento|whats|zap|direct|\bdm\b|link|clique|toque|compre|reserve|inscreva|baixe|garanta|saiba mais|👇|⬇|↓|➡|👉)/i;
var UF = "(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)";
var PLACE = new RegExp(`(\u{1F4CD}|\\b${UF}\\b|online|todo o brasil|brasil inteiro|delivery)`, "i");
var EMOJI2 = /\p{Extended_Pictographic}/gu;
var HASHTAG2 = /(^|\s)#[\p{L}\p{N}_]+/gu;
var countMatches = (text, re) => (text.match(re) ?? []).length;
var firstLine2 = (caption) => caption.trim().split(/\n/)[0]?.trim() ?? "";
var HIGHLIGHT_GROUPS = [
  { id: "sobre", label: "quem \xE9 (Sobre, Comece aqui)", re: /(sobre|quem|conhe[cç]a|comece|in[ií]cio|n[oó]s|equipe|hist[oó]ria|bastidor)/i },
  { id: "oferta", label: "o que vende (Servi\xE7os, Produtos, Card\xE1pio)", re: /(servi[cç]|produt|card[aá]pio|menu|plano|pre[cç]o|loja|cat[aá]logo|tratament|procediment|curso|cole[cç][aã]o|novidade|lan[cç]amento)/i },
  { id: "prova", label: "prova (Clientes, Trabalhos, Avalia\xE7\xF5es)", re: /(cliente|depoiment|resultado|antes|case|portf[oó]lio|avalia|feedback|trabalho|obra|projeto|entregas)/i },
  { id: "como", label: "como comprar (Como funciona, D\xFAvidas, Contato)", re: /(como|processo|agend|funciona|passo|pedido|frete|entrega|d[uú]vida|faq|pergunta|contato|whats|endere|onde|local|hor[aá]rio)/i }
];
var HIGHLIGHT_MAX = 15;
function auditHighlights(highlights) {
  const findings = [];
  if (highlights === null) {
    findings.push({ id: "destaques-sem-dado", level: "info", title: "Destaques n\xE3o informados", detail: "A API da Meta n\xE3o entrega os destaques do perfil.", action: "Escreva os nomes dos destaques como aparecem no perfil (ou marque que n\xE3o h\xE1 nenhum)." });
    return { id: "destaques", label: PILLAR_LABEL.destaques, score: null, findings };
  }
  const names = highlights.map((h) => h.trim()).filter(Boolean);
  if (!names.length) {
    findings.push({ id: "destaques-nenhum", level: "critico", title: "Nenhum destaque no perfil", detail: "Os destaques s\xE3o a vitrine fixa de quem chega pela primeira vez: sem eles, s\xF3 o \xFAltimo story conta quem voc\xEA \xE9.", action: "Crie de 4 a 6 destaques: quem \xE9, o que vende, prova e como comprar." });
    return { id: "destaques", label: PILLAR_LABEL.destaques, score: scoreOf(findings), findings };
  }
  const long = names.filter((n) => [...n].length > HIGHLIGHT_MAX);
  if (long.length) findings.push({ id: "destaques-cortados", level: "atencao", title: `${long.length === 1 ? "Um nome \xE9 cortado" : `${long.length} nomes s\xE3o cortados`} embaixo do c\xEDrculo`, detail: long.map((n) => `\u201C${n}\u201D`).join(", "), action: `Use nomes de at\xE9 ${HIGHLIGHT_MAX} letras, de uma ou duas palavras.` });
  if (names.length > 10) findings.push({ id: "destaques-muitos", level: "info", title: `${names.length} destaques`, detail: "No celular aparecem uns 4 ou 5 sem arrastar: os primeiros s\xE3o os que contam.", action: "Deixe na frente os que ajudam a decidir e junte ou arquive o resto." });
  const missing = HIGHLIGHT_GROUPS.filter((g) => !names.some((n) => g.re.test(n)));
  if (missing.length) {
    findings.push({
      id: "destaques-faltam",
      level: missing.length >= 2 ? "atencao" : "info",
      title: missing.length === 1 ? "Falta um destaque essencial" : `Faltam ${missing.length} destaques essenciais`,
      detail: `Pelos nomes, n\xE3o h\xE1: ${missing.map((m) => m.label).join("; ")}.`,
      action: "Quem chega quer saber, nesta ordem, quem \xE9 voc\xEA, o que vende, se funciona e como comprar."
    });
  }
  if (!findings.length) findings.push({ id: "destaques-ok", level: "ok", title: `${names.length} destaques cobrindo o essencial` });
  return { id: "destaques", label: PILLAR_LABEL.destaques, score: scoreOf(findings), findings };
}
function auditBio(p) {
  const findings = [];
  const bio = (p.biography ?? "").trim();
  const name = (p.name ?? "").trim();
  if (!bio) findings.push({ id: "bio-vazia", level: "critico", title: "Bio vazia", detail: "\xC9 a primeira coisa lida por quem visita o perfil.", action: "Escreva em at\xE9 150 caracteres: o que faz, para quem, onde, e o que a pessoa deve fazer agora." });
  else {
    const length = [...bio].length;
    if (length < 50) findings.push({ id: "bio-curta", level: "atencao", title: `Bio curta (${length} caracteres)`, detail: "Cabe at\xE9 150: sobra espa\xE7o para dizer o que voc\xEA faz e para quem.", action: "Uma linha com o que faz, uma com o diferencial ou a regi\xE3o, uma com a chamada." });
    if (!CTA.test(bio)) findings.push({ id: "bio-sem-chamada", level: "atencao", title: "Bio sem chamada para a\xE7\xE3o", detail: "Nada diz o que fazer depois de ler (chamar no WhatsApp, agendar, tocar no link).", action: "Termine a bio com o pr\xF3ximo passo, por exemplo \u201CAgende pelo link \u{1F447}\u201D." });
    if (!PLACE.test(bio)) findings.push({ id: "bio-sem-lugar", level: "info", title: "A bio n\xE3o diz onde atende", action: "Se atende numa regi\xE3o, diga qual (\u{1F4CD} Cidade/UF); se \xE9 online, diga que atende todo o Brasil." });
    const tags = countMatches(bio, HASHTAG2);
    if (tags > 2) findings.push({ id: "bio-hashtags", level: "info", title: `${tags} hashtags na bio`, detail: "Hashtag na bio vira link para fora do seu perfil.", action: "Deixe no m\xE1ximo uma, a da marca." });
    const emojis = countMatches(bio, EMOJI2);
    if (emojis > 6) findings.push({ id: "bio-emojis", level: "info", title: `${emojis} emojis na bio`, action: "Use emoji s\xF3 para marcar linhas ou apontar o link: o texto l\xEA melhor." });
  }
  if (!name) findings.push({ id: "nome-vazio", level: "atencao", title: "Campo Nome vazio", detail: "O Nome entra na busca do Instagram, junto com o @.", action: "Ponha a marca e o que faz, por exemplo \u201CMarca \xB7 Sites para cl\xEDnicas\u201D." });
  else if (!/[·|•\-–—,]/.test(name) && name.split(/\s+/).length <= 2) findings.push({ id: "nome-so-marca", level: "info", title: "O Nome tem s\xF3 a marca", detail: `\u201C${name}\u201D: quem busca pelo servi\xE7o n\xE3o acha o perfil por ele.`, action: "Junte uma palavra do que voc\xEA faz (busca do Instagram l\xEA o Nome)." });
  if (!p.website) findings.push({ id: "sem-link", level: "atencao", title: "Sem link no perfil", detail: "\xC9 o \xFAnico link clic\xE1vel fora dos stories.", action: "Ponha o WhatsApp, a p\xE1gina de agendamento ou o site." });
  else if (/(wa\.me|whatsapp|api\.whatsapp)/i.test(p.website)) findings.push({ id: "link-whatsapp", level: "ok", title: "Link leva direto ao WhatsApp" });
  if (!findings.some((f) => f.level !== "ok" && f.level !== "info")) findings.unshift({ id: "bio-ok", level: "ok", title: "Bio completa: diz o que faz, tem chamada e link" });
  return { id: "bio", label: PILLAR_LABEL.bio, score: bio ? scoreOf(findings) : Math.min(20, scoreOf(findings)), findings };
}
function auditPhoto(p) {
  if (!p.picture) return { id: "foto", label: PILLAR_LABEL.foto, score: 0, findings: [{ id: "foto-vazia", level: "critico", title: "Perfil sem foto", action: "Use o logo ou o rosto de quem atende, centralizado e leg\xEDvel num c\xEDrculo pequeno." }] };
  return { id: "foto", label: PILLAR_LABEL.foto, score: null, findings: [{ id: "foto-ok", level: "info", title: "Foto presente", detail: "Se ela l\xEA bem num c\xEDrculo pequeno, a leitura da IA diz." }] };
}
var within = (media, now, days) => media.filter((m) => now - m.postedAt <= days * DAY);
function auditRhythm(feed, stories, now) {
  const findings = [];
  const posts30 = within(feed, now, 30).length;
  const posts90 = within(feed, now, 90).length;
  const last = feed[0]?.postedAt;
  const lastPostDays = last ? Math.floor((now - last) / DAY) : null;
  if (!feed.length) {
    findings.push({ id: "ritmo-sem-posts", level: "critico", title: "Nenhum post no feed", action: "Comece com 3 posts fixados: quem \xE9, o que vende, um trabalho feito." });
    return { pillar: { id: "ritmo", label: PILLAR_LABEL.ritmo, score: 0, findings }, posts30, posts90, lastPostDays };
  }
  if (posts30 === 0) findings.push({ id: "ritmo-parado", level: "critico", title: "Nenhum post nos \xFAltimos 30 dias", detail: `O \xFAltimo foi h\xE1 ${lastPostDays} dias. Perfil parado passa a impress\xE3o de neg\xF3cio fechado.`, action: "Volte com pelo menos 2 posts por semana, num dia fixo." });
  else {
    const perWeek = posts30 / (30 / 7);
    if (posts30 < 4) findings.push({ id: "ritmo-baixo", level: "atencao", title: `${posts30} ${posts30 === 1 ? "post" : "posts"} em 30 dias`, detail: "Menos de um por semana: o alcance de cada post n\xE3o tem continuidade.", action: "Mire em 2 ou 3 por semana, sempre nos mesmos dias." });
    else findings.push({ id: "ritmo-ok", level: "ok", title: `${posts30} posts em 30 dias (${perWeek.toFixed(1).replace(".", ",")} por semana)` });
    if (lastPostDays !== null && lastPostDays > 7) findings.push({ id: "ritmo-ultimo", level: "atencao", title: `\xDAltimo post h\xE1 ${lastPostDays} dias`, action: "Publique esta semana para n\xE3o quebrar o ritmo." });
  }
  const recent = within(feed, now, 90).map((m) => m.postedAt).sort((a, b) => b - a);
  if (recent.length >= 1) {
    let gap = (now - recent[0]) / DAY;
    for (let i = 1; i < recent.length; i++) gap = Math.max(gap, (recent[i - 1] - recent[i]) / DAY);
    if (gap > 21) findings.push({ id: "ritmo-buraco", level: "atencao", title: `Ficou ${Math.round(gap)} dias seguidos sem postar nos \xFAltimos 3 meses`, action: "Deixe 2 ou 3 posts prontos de reserva para semanas cheias." });
  }
  const st = within(stories, now, 30).length;
  findings.push({ id: "ritmo-stories", level: "info", title: st ? `${st} stories guardados em 30 dias` : "Nenhum story guardado em 30 dias", detail: "A Meta s\xF3 mostra os stories enquanto est\xE3o no ar: contam os que estavam no ar numa leitura, ent\xE3o o n\xFAmero real pode ser maior." });
  return { pillar: { id: "ritmo", label: PILLAR_LABEL.ritmo, score: scoreOf(findings), findings }, posts30, posts90, lastPostDays };
}
function auditFormats(feed, now) {
  const findings = [];
  const recent = within(feed, now, 90);
  const share = {};
  const reachBy = {};
  if (recent.length < 6) {
    findings.push({ id: "formatos-pouco", level: "info", title: "Poucos posts para comparar formatos", detail: `${recent.length} nos \xFAltimos 90 dias; a compara\xE7\xE3o precisa de pelo menos 6.` });
    return { pillar: { id: "formatos", label: PILLAR_LABEL.formatos, score: null, findings }, share, reachBy, best: null };
  }
  const groups = /* @__PURE__ */ new Map();
  for (const m of recent) groups.set(formatOf2(m), [...groups.get(formatOf2(m)) ?? [], m]);
  for (const [f, list] of groups) {
    share[f] = list.length / recent.length;
    const r = avg(list.map((m) => m.insights.reach).filter((v) => typeof v === "number"));
    if (r !== null && list.length >= 2) reachBy[f] = r;
  }
  const ranked = Object.entries(reachBy).sort((a, b) => b[1] - a[1]);
  const best = ranked[0]?.[0] ?? null;
  if (groups.size === 1) findings.push({ id: "formatos-um", level: "atencao", title: `S\xF3 ${FORMAT_NAME[[...groups.keys()][0]] ?? [...groups.keys()][0]} nos \xFAltimos 90 dias`, action: "Teste os outros formatos por um m\xEAs e compare o alcance aqui." });
  if (!groups.has("reels")) findings.push({ id: "formatos-sem-reels", level: "atencao", title: "Nenhum Reels nos \xFAltimos 90 dias", detail: "V\xEDdeo curto costuma ser o formato que mais chega a quem ainda n\xE3o segue.", action: "Grave um Reels por semana: bastidor, antes e depois, ou uma d\xFAvida respondida em 20 segundos." });
  if (!groups.has("carrossel")) findings.push({ id: "formatos-sem-carrossel", level: "info", title: "Nenhum carrossel nos \xFAltimos 90 dias", detail: "Carrossel \xE9 o que mais se salva: bom para explicar e ensinar." });
  if (ranked.length >= 2 && best) {
    const [, top] = ranked[0];
    const [lowF, low] = ranked[ranked.length - 1];
    const ratio = low > 0 ? top / low : 0;
    if (ratio >= 1.5 && share[best] < 0.35) findings.push({ id: "formatos-melhor-pouco", level: "atencao", title: `${FORMAT_NAME[best]} alcan\xE7a ${times(ratio)} mais que ${FORMAT_NAME[lowF]}, mas \xE9 s\xF3 ${pct(share[best])} dos posts`, action: `Fa\xE7a mais ${FORMAT_NAME[best]}: pelo menos metade dos posts no pr\xF3ximo m\xEAs.` });
    else findings.push({ id: "formatos-melhor", level: "ok", title: `${FORMAT_NAME[best]} \xE9 o formato que mais alcan\xE7a (${int(top)} em m\xE9dia)` });
  }
  return { pillar: { id: "formatos", label: PILLAR_LABEL.formatos, score: scoreOf(findings), findings }, share, reachBy, best };
}
function auditCaptions(feed, now) {
  const findings = [];
  const recent = within(feed, now, 90);
  if (recent.length < 4) return { id: "legendas", label: PILLAR_LABEL.legendas, score: null, findings: [{ id: "legendas-pouco", level: "info", title: "Poucos posts para ler as legendas" }] };
  const caps = recent.map((m) => (m.caption ?? "").trim());
  const empty = caps.filter((c) => c.length < 10).length / caps.length;
  if (empty > 0.3) findings.push({ id: "legendas-vazias", level: "atencao", title: `${pct(empty)} dos posts quase sem legenda`, detail: "A legenda \xE9 onde se explica e se chama para a a\xE7\xE3o.", action: "Cada post com pelo menos uma frase de contexto e uma chamada." });
  const withText = caps.filter((c) => c.length >= 10);
  if (withText.length) {
    const cta = withText.filter((c) => CTA.test(c)).length / withText.length;
    if (cta < 0.3) findings.push({ id: "legendas-sem-chamada", level: "atencao", title: `S\xF3 ${pct(cta)} das legendas chamam para uma a\xE7\xE3o`, action: "Feche as legendas com o pr\xF3ximo passo: \u201Cchame no Direct\u201D, \u201Csalve para depois\u201D, \u201Cagende pelo link\u201D." });
    const longFirst = withText.filter((c) => [...firstLine2(c)].length > 125).length / withText.length;
    if (longFirst > 0.5) findings.push({ id: "legendas-primeira-linha", level: "info", title: "A primeira linha costuma ser longa", detail: "O feed mostra s\xF3 o come\xE7o antes do \u201Cmais\u201D.", action: "Comece com uma frase curta que d\xEA vontade de abrir." });
    const tags = avg(withText.map((c) => countMatches(c, HASHTAG2))) ?? 0;
    if (tags > 10) findings.push({ id: "legendas-hashtags", level: "atencao", title: `${Math.round(tags)} hashtags por post em m\xE9dia`, detail: "Muitas hashtags deixam a legenda com cara de spam e pouco ajudam hoje.", action: "Use de 3 a 5, espec\xEDficas do assunto e da regi\xE3o." });
    const size = median2(withText.map((c) => [...c].length)) ?? 0;
    if (!findings.length) findings.push({ id: "legendas-ok", level: "ok", title: `Legendas com chamada e contexto (${int(size)} caracteres no meio)` });
  }
  return { id: "legendas", label: PILLAR_LABEL.legendas, score: scoreOf(findings), findings };
}
function auditPerformance(p, feed, now) {
  const findings = [];
  const recent = within(feed, now, 90).filter((m) => typeof m.insights.reach === "number" && m.insights.reach > 0);
  const medianReach = median2(recent.map((m) => m.insights.reach));
  const medianEngagement = median2(recent.map((m) => interactionsOf(m) / m.insights.reach));
  if (recent.length < 3) {
    findings.push({ id: "desempenho-pouco", level: "info", title: "Poucos posts com n\xFAmeros para avaliar", detail: "A Meta guarda os n\xFAmeros dos posts a partir da conex\xE3o com conta profissional." });
    return { pillar: { id: "desempenho", label: PILLAR_LABEL.desempenho, score: null, findings }, medianReach, medianEngagement };
  }
  if (medianEngagement !== null) {
    if (medianEngagement < 0.01) findings.push({ id: "desempenho-engajamento", level: "critico", title: `Taxa de intera\xE7\xE3o de ${pct(medianEngagement)} por alcance`, detail: "Num post t\xEDpico, menos de 1 em cada 100 pessoas que viram reagiu.", action: "Puxe conversa: pergunte algo na legenda, responda todo coment\xE1rio na primeira hora." });
    else if (medianEngagement < 0.03) findings.push({ id: "desempenho-engajamento", level: "atencao", title: `Taxa de intera\xE7\xE3o de ${(medianEngagement * 100).toFixed(1).replace(".", ",")}% por alcance`, detail: "A refer\xEAncia usada aqui \xE9 3% ou mais.", action: "Mais posts que pedem resposta ou valem salvar (dicas, listas, antes e depois)." });
    else findings.push({ id: "desempenho-engajamento", level: "ok", title: `Taxa de intera\xE7\xE3o de ${(medianEngagement * 100).toFixed(1).replace(".", ",")}% por alcance` });
  }
  if (medianReach !== null && p.followers && p.followers >= 100) {
    const ratio = medianReach / p.followers;
    if (ratio < 0.1) findings.push({ id: "desempenho-alcance", level: "atencao", title: `Um post t\xEDpico alcan\xE7a ${pct(ratio)} dos seguidores`, detail: `${int(medianReach)} de ${int(p.followers)}.`, action: "Teste outros formatos e hor\xE1rios; seguidores que n\xE3o veem h\xE1 meses podem ser contas paradas." });
    else findings.push({ id: "desempenho-alcance", level: "ok", title: `Um post t\xEDpico alcan\xE7a ${int(medianReach)} pessoas (${pct(ratio)} dos seguidores)` });
  }
  const saves = recent.reduce((s, m) => s + (m.insights.saved ?? 0) + (m.insights.shares ?? 0), 0);
  const all2 = recent.reduce((s, m) => s + interactionsOf(m), 0);
  if (all2 > 0 && saves / all2 < 0.05) findings.push({ id: "desempenho-salvos", level: "info", title: `Salvamentos e compartilhamentos s\xE3o ${pct(saves / all2)} das intera\xE7\xF5es`, detail: "S\xE3o os sinais de que o post tem valor al\xE9m da curtida.", action: "Inclua posts que valem guardar ou mandar para algu\xE9m." });
  const t = p.totals?.["30"];
  if (t?.reach && typeof t.reach_non_followers === "number") {
    const share = t.reach_non_followers / t.reach;
    if (share < 0.2) findings.push({ id: "desempenho-novos", level: "atencao", title: `S\xF3 ${pct(share)} do alcance de 30 dias foi de quem n\xE3o segue`, detail: "O perfil est\xE1 falando quase s\xF3 com quem j\xE1 conhece.", action: "Reels e colabora\xE7\xF5es (post em conjunto com parceiros) levam o perfil a gente nova." });
    else findings.push({ id: "desempenho-novos", level: "ok", title: `${pct(share)} do alcance de 30 dias foi de quem n\xE3o segue` });
  }
  if (t && typeof t.follows === "number" && typeof t.unfollows === "number" && t.unfollows > t.follows) findings.push({ id: "desempenho-saldo", level: "atencao", title: `Perdeu mais seguidores do que ganhou em 30 dias (${int(t.follows)} entraram, ${int(t.unfollows)} sa\xEDram)`, action: "Veja nos posts da \xE9poca o que destoou do que as pessoas seguiram para ver." });
  return { pillar: { id: "desempenho", label: PILLAR_LABEL.desempenho, score: scoreOf(findings), findings }, medianReach, medianEngagement };
}
var spParts = (at) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(at));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  return { weekday: wd, hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0) };
};
var BANDS = [
  { label: "de manh\xE3 (6h \xE0s 12h)", from: 6, to: 12 },
  { label: "\xE0 tarde (12h \xE0s 18h)", from: 12, to: 18 },
  { label: "\xE0 noite (18h \xE0 meia-noite)", from: 18, to: 24 },
  { label: "de madrugada", from: 0, to: 6 }
];
function auditTimes(feed, now) {
  const recent = within(feed, now, 180).filter((m) => typeof m.insights.reach === "number");
  if (recent.length < 10) return { pillar: { id: "horarios", label: PILLAR_LABEL.horarios, score: null, findings: [{ id: "horarios-pouco", level: "info", title: "Poucos posts para achar o melhor dia e hor\xE1rio", detail: "Com 10 ou mais posts com n\xFAmeros nos \xFAltimos 6 meses a compara\xE7\xE3o aparece." }] }, bestWeekday: null, bestHour: null };
  const overall = avg(recent.map((m) => m.insights.reach));
  const by = (key) => {
    const map = /* @__PURE__ */ new Map();
    for (const m of recent) map.set(key(m), [...map.get(key(m)) ?? [], m.insights.reach]);
    return [...map].filter(([, v]) => v.length >= 2).map(([k, v]) => [k, avg(v), v.length]).sort((a, b) => b[1] - a[1]);
  };
  const days = by((m) => spParts(m.postedAt).weekday);
  const bands = by((m) => BANDS.findIndex((b) => spParts(m.postedAt).hour >= b.from && spParts(m.postedAt).hour < b.to));
  const findings = [];
  const bestWeekday = days[0] ? WEEKDAYS[days[0][0]] : null;
  const bestHour = bands[0] ? BANDS[bands[0][0]].label : null;
  if (days[0] && overall > 0) findings.push({ id: "horarios-dia", level: "info", title: `Posts de ${WEEKDAYS[days[0][0]]} alcan\xE7am ${times(days[0][1] / overall)} a m\xE9dia`, detail: `${days[0][2]} posts nesse dia. ${days.length > 1 ? `O mais fraco \xE9 ${WEEKDAYS[days[days.length - 1][0]]}.` : ""}`.trim(), action: "Ponha os posts mais importantes nesse dia." });
  if (bands[0] && overall > 0) findings.push({ id: "horarios-hora", level: "info", title: `Os posts ${BANDS[bands[0][0]].label} alcan\xE7am ${times(bands[0][1] / overall)} a m\xE9dia`, detail: `${bands[0][2]} posts nessa faixa.` });
  return { pillar: { id: "horarios", label: PILLAR_LABEL.horarios, score: null, findings }, bestWeekday, bestHour };
}
function auditProfile(input) {
  const now = input.now ?? Date.now();
  const sorted = [...input.media].sort((a, b) => b.postedAt - a.postedAt);
  const feed = sorted.filter((m) => m.product !== "STORY");
  const stories = sorted.filter((m) => m.product === "STORY");
  const rhythm = auditRhythm(feed, stories, now);
  const formats = auditFormats(feed, now);
  const perf = auditPerformance(input.profile, feed, now);
  const tms = auditTimes(feed, now);
  const pillars = [auditBio(input.profile), auditPhoto(input.profile), auditHighlights(input.highlights), rhythm.pillar, formats.pillar, auditCaptions(feed, now), perf.pillar, tms.pillar];
  const scored = pillars.filter((p) => p.score !== null && WEIGHT[p.id] > 0);
  const weight = scored.reduce((s, p) => s + WEIGHT[p.id], 0);
  const score = weight ? Math.round(scored.reduce((s, p) => s + p.score * WEIGHT[p.id], 0) / weight) : 0;
  return {
    version: 1,
    at: now,
    score,
    pillars,
    facts: {
      posts30: rhythm.posts30,
      posts90: rhythm.posts90,
      lastPostDays: rhythm.lastPostDays,
      medianReach: perf.medianReach,
      medianEngagement: perf.medianEngagement,
      bestFormat: formats.best,
      formatShare: formats.share,
      formatReach: formats.reachBy,
      bestWeekday: tms.bestWeekday,
      bestHour: tms.bestHour
    }
  };
}

// src/features/space/chat/instagramSkills.ts
var lines = (...text) => text.join("\n");
var COMMON = lines(
  "",
  "Sempre:",
  "- Leia a voz da conta (`cerebro_ler` em `instagram/voz.md`) antes de escrever. Sem ela, pe\xE7a 3 legendas ou roteiros da pr\xF3pria conta (ou use os posts de `ler_dados` com fonte instagram), deduza a voz e ofere\xE7a gravar com a skill Instagram \xB7 Voz da conta.",
  "- Nunca invente n\xFAmero, cliente, resultado, depoimento ou estat\xEDstica. Faltou um n\xFAmero: deixe `{{seu n\xFAmero}}` no texto e avise.",
  "- Todo texto que vai ao Instagram passa por `ig_humanizar` antes de ser mostrado; reescreva as estruturas que ela aponta e rode de novo. Mostre o texto e a nota, nunca a nota sozinha.",
  "- Nada \xE9 publicado, comentado, curtido, seguido ou enviado sem a pessoa. Fora da conta conectada (perfil de outra pessoa), nada automatizado: a entrega \xE9 o texto para ela colar.",
  "- Portugu\xEAs do Brasil, frases curtas, palavras do dia a dia, no jeito que a pessoa fala em voz alta."
);
var INSTAGRAM_SKILLS = [
  {
    id: "ig-reel",
    name: "Instagram \xB7 Reels",
    hint: "Uma ideia vira Reels: 3 ganchos com nota, roteiro falado, texto da tela e minutagem",
    starters: ["Transforme esta ideia num reels de 30 segundos", "Me d\xEA 3 ganchos para este assunto, com nota", "Cronometre este roteiro e diga o que cortar"],
    instructions: lines(
      "Voc\xEA transforma uma ideia num Reels que a pessoa assiste at\xE9 o fim. As ferramentas rodam de verdade: use-as, n\xE3o chute o gancho nem a dura\xE7\xE3o.",
      "1. Antes: leia `instagram/voz.md` e, se existir, `instagram/virais.md` (o que est\xE1 funcionando no nicho; vale mais que as regras gerais) e `instagram/registro.md` (o que j\xE1 foi postado). Leia as f\xF3rmulas com `ig_formulas`. Ideia rala? Fa\xE7a UMA pergunta: o que aconteceu, com quem, quanto custou ou rendeu. Reels precisa de uma coisa verdadeira e espec\xEDfica.",
      "2. Tr\xEAs ganchos de f\xF3rmulas DIFERENTES (n\xE3o tr\xEAs vers\xF5es de uma), cada um com a fala e o texto da tela (at\xE9 6 palavras, mais seco). D\xEA nota com `ig_ganchos` e mostre o ranking. Se o primeiro ficou abaixo de 50, ainda n\xE3o tem gancho: volte.",
      "3. Estrutura: 0\u20132 s GANCHO (a afirma\xE7\xE3o; movimento no primeiro quadro, n\xE3o rosto parado) \xB7 2\u20137 s O QUE EST\xC1 EM JOGO (por que importa para quem v\xEA, uma frase) \xB7 CORPO (uma ideia por batida; a tela muda a cada batida) \xB7 \xDALTIMOS 3 s A ENTREGA (o que o gancho prometeu) e UMA chamada \xB7 \xDALTIMA FRASE repete uma palavra do gancho (loop). De 15 a 45 s.",
      '4. Escreva o roteiro no gancho vencedor, uma fala por linha, do jeito que a pessoa fala. Cronometre com `ig_tempos` (com "alvo") e corrija cada alerta: gancho acima de 3 s, batida acima de 4 s, tr\xEAs batidas sem nada concreto, sem loop. Rode de novo at\xE9 limpar.',
      "5. Texto da tela \xE9 outro roteiro: at\xE9 6 palavras por cartela; a do gancho entra no quadro 1; em 1080x1920, nada acima de y=230 nem abaixo de y=1440, e os 230 px da direita livres (legenda, bot\xF5es e \xE1udio ficam por cima). Legenda queimada no corpo: a maioria assiste sem som.",
      "6. Humanize o roteiro (`ig_humanizar`) e entregue: o roteiro num bloco, as cartelas com o tempo, e o recibo: gancho (f\xF3rmula e nota), dura\xE7\xE3o e batidas, cartelas, humanizador (nota). Depois ofere\xE7a a legenda (skill Instagram \xB7 Legenda) e, se a pessoa quiser v\xEDdeo narrado sem gravar, `criar_video_explicativo` com o roteiro como briefing.",
      '7. Uma ideia por Reels: se o roteiro tem duas, s\xE3o dois Reels. N\xFAmero em vez de adjetivo. Sem "oi", sem "neste v\xEDdeo", sem nome nem vinheta. Quando a pessoa aprovar, registre em `instagram/registro.md` (data, f\xF3rmula, primeira frase) com `cerebro_escrever`, para a auditoria saber depois.',
      COMMON
    )
  },
  {
    id: "ig-viral",
    name: "Instagram \xB7 Virais do nicho",
    hint: "O que est\xE1 funcionando no nicho: reels ordenados pelo m\xFAltiplo sobre o pr\xF3prio perfil e a f\xF3rmula de cada um",
    starters: ["Monte o arquivo de virais com os reels das Refer\xEAncias", "Estes perfis: o que est\xE1 funcionando para eles?", "Por que este reels foi t\xE3o bem?"],
    instructions: lines(
      "Voc\xEA pesquisa o que est\xE1 funcionando no nicho. Rode por m\xEAs, n\xE3o por dia: f\xF3rmula dura uma esta\xE7\xE3o.",
      "A ideia que faz valer a pena: views brutas n\xE3o s\xE3o prova. Perfil de 2 milh\xF5es com 400 mil views teve uma ter\xE7a fraca; perfil de 4 mil com 400 mil achou alguma coisa. Tudo se ordena pelo M\xDALTIPLO: views \xF7 a mediana dos \xFAltimos reels daquele perfil. Acima de 3x \xE9 sinal; abaixo de 1,5x \xE9 o dia normal do perfil.",
      "1. Perfis: pe\xE7a de 6 a 12, ou proponha e confirme: 4 diretos (mesmo nicho, um pouco \xE0 frente), 4 vizinhos (outro nicho, mesmo p\xFAblico: \xE9 de onde v\xEAm formatos antes de chegarem ao nicho), 2 a 4 bem maiores (s\xF3 para formato, nunca para ritmo ou tom). Perfis at\xE9 ~10x o tamanho da conta: o que funciona em 2 milh\xF5es costuma funcionar porque \xE9 2 milh\xF5es. Pe\xE7a tamb\xE9m a pasta de Salvos da pessoa: \xE9 o acervo mais relevante que existe.",
      "2. Coleta: use o que a conta j\xE1 tem (tela Refer\xEAncias, `abrir_tela` referencias; o leitor do Mac l\xEA s\xF3 os grupos de direct cadastrados ali) e o que a pessoa colar ou ler no pr\xF3prio navegador. NUNCA raspe o Instagram, nunca entre na conta de ningu\xE9m, nunca pe\xE7a senha, nada em segundo plano. Por reel: perfil, seguidores, mediana (o do meio dos \xFAltimos 12), views, o gancho NAS PALAVRAS do criador (erros inclusos), texto da tela, segundos, chamada.",
      '3. Ordene com `ig_virais` (com "salvar": true quando a pessoa aprovar: grava `instagram/virais.md`, que o Reels e a Semana leem).',
      "4. Diga tr\xEAs coisas e s\xF3: (a) que f\xF3rmulas aparecem mais no ter\xE7o de cima, com contagem (duas f\xF3rmulas 4 vezes cada em 6 perfis \xE9 achado; uma 2 vezes n\xE3o \xE9); (b) o que o ter\xE7o de cima tem em comum na estrutura (tamanho do gancho, entrega visual, primeiro quadro em movimento, onde fica a chamada); (c) os sem f\xF3rmula: leia \xE0 m\xE3o, \xE9 onde mora uma f\xF3rmula que ainda n\xE3o est\xE1 na lista. Diga a amostra e a confian\xE7a em palavras simples.",
      '5. Para as 3 f\xF3rmulas de cima, escreva a VERS\xC3O DA CONTA: a hist\xF3ria e o n\xFAmero dela, no formato que est\xE1 funcionando, e entregue cada uma \xE0 skill Instagram \xB7 Reels com a f\xF3rmula j\xE1 escolhida. Nunca "fa\xE7a um reels igual a este": uma frase de gancho que a pessoa pode dizer amanh\xE3.',
      "Copie a f\xF3rmula, nunca o v\xEDdeo: nem roteiro, nem voz, nem edi\xE7\xE3o de quem fez. Cite o perfil de origem em cada linha.",
      COMMON
    )
  },
  {
    id: "ig-legenda",
    name: "Instagram \xB7 Legenda",
    hint: 'A legenda que sobrevive ao corte do "mais", com uma chamada, termos de busca e at\xE9 5 hashtags, revisada',
    starters: ["Escreva a legenda deste post", "Revise esta legenda", "Quais termos de busca p\xF4r nesta legenda?"],
    instructions: lines(
      "Voc\xEA escreve e revisa a legenda. O feed mostra uns 125 caracteres e esconde o resto: quase toda legenda que falha, falha ali.",
      "1. Decida o papel e diga qual. A) O v\xEDdeo j\xE1 prendeu (Reels com gancho forte): a legenda n\xE3o \xE9 um segundo gancho; o trabalho dela \xE9 a chamada, o contexto que faz a chamada fazer sentido e as palavras que as pessoas buscam. B) A legenda \xE9 o conte\xFAdo (foto, post simples, capa de carrossel): a primeira linha \xE9 o gancho e funciona como gancho de Reels: concreto, curto, cortado num suspense e n\xE3o no meio de uma ora\xE7\xE3o.",
      "2. Forma: linha 1 (at\xE9 125 caracteres; A: a chamada, simples; B: o gancho; nunca sauda\xE7\xE3o, hashtag ou emoji como primeiro caractere) \xB7 corpo em par\xE1grafos curtos com uma linha em branco entre eles (2 a 6); \xE9 onde v\xE3o os termos de busca \xB7 UMA chamada (comentar uma palavra, salvar ou chamar no direct) \xB7 at\xE9 5 hashtags na \xFAltima linha, ou nenhuma. Limite de 2.200; quase nada precisa disso.",
      "3. Hashtag: desde 18/12/2025 o Instagram aceita no m\xE1ximo 5 por post, e hashtag \xE9 etiqueta, n\xE3o alcance. Espec\xEDficas, de tema. #viral, #fyp, #explorar, #reels descrevem nada: corte.",
      '4. Busca: o Instagram l\xEA o texto da legenda. Pe\xE7a 2 ou 3 termos que a pessoa quer que achem e escreva como algu\xE9m digitaria, numa frase normal ("contrato de fot\xF3grafo" na linha 3, n\xE3o #contratodefotografo no fim).',
      '5. Regras: link na legenda n\xE3o clica (vai para a bio ou para o direct; se houver link, escreva o primeiro coment\xE1rio \xE0 parte). Palavra para comentar: uma s\xF3, sem espa\xE7o nem emoji, e dita no v\xEDdeo tamb\xE9m ("Comenta CONTRATO"). Emoji como pontua\xE7\xE3o, n\xE3o enfeite. Em foto e carrossel, escreva o texto alternativo da capa.',
      '6. Rascunhe, humanize (`ig_humanizar`; legenda \xE9 curta, ent\xE3o clich\xEA aparece mais) e revise com `ig_legenda_revisar` passando os termos em "palavras". Corrija cada CORRIGIR e decida cada ATENCAO em voz alta. Entregue o bloco pronto para colar e o recibo: papel (A ou B e por qu\xEA), caracteres vis\xEDveis antes do corte, a chamada, hashtags, onde est\xE3o os termos de busca, veredito. Se a pessoa estiver num post dos Criativos, grave com `legenda` quando ela aprovar.',
      COMMON
    )
  },
  {
    id: "ig-carrossel",
    name: "Instagram \xB7 Carrossel",
    hint: "A capa que faz arrastar, um slide por ideia, o slide de resumo e a legenda; montado nos Criativos",
    starters: ["Transforme este assunto num carrossel", "Esta ideia \xE9 carrossel ou reels?", "Reescreva a capa deste carrossel"],
    instructions: lines(
      "Voc\xEA monta carross\xE9is. \xC9 o formato de mais tempo de tela no grid (arrastar \xE9 intera\xE7\xE3o; rolar n\xE3o) e tem segunda chance: o Instagram pode mostrar de novo a partir de um slide do meio para quem n\xE3o interagiu, ent\xE3o o slide 2 tamb\xE9m tem que se sustentar sozinho.",
      "1. Carrossel ou Reels? Carrossel quando a ideia tem sequ\xEAncia e precisa ser relida: passos, um m\xE9todo com partes, antes e depois, uma lista que vale print. Reels quando tem movimento, rosto ou uma entrega que precisa ser vista acontecendo. Se \xE9 uma afirma\xE7\xE3o s\xF3, n\xE3o \xE9 nenhum dos dois: mande para a skill Instagram \xB7 Reels e diga por qu\xEA.",
      "2. Estrutura (6 a 10 slides; menos de 5 n\xE3o faz arrastar, 20 \xE9 livro que ningu\xE9m termina): 1 CAPA (o gancho em at\xE9 6 palavras, leg\xEDvel na miniatura do grid, e uma linha de promessa embaixo) \xB7 2 O QUE EST\xC1 EM JOGO (por que importa, uma frase; \xE9 a segunda capa, n\xE3o pode ser prepara\xE7\xE3o) \xB7 3 a N UMA IDEIA POR SLIDE (t\xEDtulo de 3 a 7 palavras, at\xE9 25 palavras embaixo; par\xE1grafo = dois slides) \xB7 N+1 RESUMO (tudo em lista: \xE9 o slide do print e do envio) \xB7 \xDALTIMO a CHAMADA (uma a\xE7\xE3o).",
      "3. A capa \xE9 80% do resultado. Numere os slides (3/8). O @ pequeno no canto em todos (print viaja sem voc\xEA). 1080x1350 (4:5), texto bem dentro do meio, longe das bordas (120 px de cada lado), letra de 32 px para cima.",
      "4. Entregue primeiro o texto slide a slide, numerado, para a pessoa ler em dez segundos e mudar antes de qualquer arte. Depois a legenda (papel B da skill Instagram \xB7 Legenda: aqui a legenda trabalha, porque a capa j\xE1 usou as seis palavras). Humanize os dois.",
      '5. S\xF3 depois da aprova\xE7\xE3o do texto, monte nos Criativos, na marca e no padr\xE3o de post da conta: `produzir_criativo` (ou `orquestrar_criativo` se for caprichado) com o roteiro em "Slide N:", formato 4x5, e a legenda com `legenda`. Confira com `ver_criativo` e ajuste capa e contraste. Nada \xE9 publicado: a pessoa publica pelo CRM \u203A Instagram ou pelo app.',
      COMMON
    )
  },
  {
    id: "ig-stories",
    name: "Instagram \xB7 Stories",
    hint: "A sequ\xEAncia do dia, que figurinha usar em cada quadro e o funil de direct em que a pessoa fala primeiro",
    starters: ["Monte os stories de hoje sobre este assunto", "Uma sequ\xEAncia de stories para vender sem post", "Que enquete fazer nos stories desta semana?"],
    instructions: lines(
      "Stories n\xE3o s\xE3o um feed menor. O feed \xE9 como estranhos acham a conta; os stories s\xE3o como quem j\xE1 segue decide se vale comprar dela, e o \xFAnico lugar em que um toque vira conversa num movimento. Ningu\xE9m de fora v\xEA: o trabalho \xE9 profundidade, n\xE3o alcance.",
      "1. Forma do dia, 3 a 7 quadros (depois de 7 as pessoas pulam e os \xFAltimos tocam para ningu\xE9m, que \xE9 onde costumam p\xF4r o pedido): 1 ABERTURA (algo acontecendo hoje, com rosto ou m\xE3o) \xB7 2\u20133 MEIO (o conte\xFAdo: processo, resultado, o erro) \xB7 4 O PEDIDO (uma figurinha) \xB7 5 FECHO (a resposta, o resultado ou o gancho de amanh\xE3). Pedido no quadro 4, n\xE3o no 7.",
      '2. Figurinhas: Enquete (o toque mais barato, para volume) \xB7 Caixa de perguntas (colhe as palavras exatas do p\xFAblico: cada resposta \xE9 legenda, gancho ou abertura de direct; mande para a skill Reels como f\xF3rmula #16) \xB7 Quiz (ensinar deixando errar) \xB7 Controle deslizante (s\xF3 divers\xE3o) \xB7 Link (a \xFAnica superf\xEDcie clic\xE1vel al\xE9m da bio) \xB7 Contagem regressiva (prazo real) \xB7 "Sua vez" (alcance fora dos seguidores, de vez em quando).',
      '3. Regras: rosto ou m\xE3o no primeiro quadro (texto em fundo colorido \xE9 pulado). Uma ideia por quadro. Texto no meio: em 1080x1920, nada acima de y=250 nem abaixo de y=1600. Fale com uma pessoa ("voc\xEA"). N\xE3o reposte o post do feed sem coment\xE1rio: diga o que aconteceu nos coment\xE1rios e por que vale voltar. Vender nos stories: tr\xEAs quadros de contexto, um de oferta, um de prova.',
      '4. Funil de direct honesto: um story que nomeia um problema, uma enquete ou caixa em que a pessoa diz "sou eu", e a resposta a cada um que respondeu. Eles agem primeiro, depois voc\xEA responde. Resposta autom\xE1tica por palavra-chave s\xF3 pelas ferramentas do pr\xF3prio Instagram ou de parceiro aprovado; mensagem em massa para quem n\xE3o interagiu, nunca.',
      "5. Entregue os quadros em ordem: o que aparece, o que se fala, a figurinha, e o que fazer com as respostas. Se a pessoa quiser arte, monte nos Criativos em 9x16 (`produzir_criativo`); a conta pode programar stories em CRM \u203A Instagram \u203A Stories (aprova\xE7\xE3o dela antes de sair).",
      COMMON
    )
  },
  {
    id: "ig-perfil",
    name: "Instagram \xB7 Perfil",
    hint: "Nota do perfil em 100 pontos (12 itens) e a reescrita do que perdeu mais pontos",
    starters: ["D\xEA nota ao perfil do Instagram e diga o que mudar primeiro", "Reescreva a bio e o campo Nome", "Por que as pessoas n\xE3o seguem depois de ver o reels?"],
    instructions: lines(
      'O perfil n\xE3o \xE9 vitrine: \xE9 a tela de decis\xE3o de quem chegou por um reels, e tem uns 3 segundos para responder "tem mais disso aqui, e \xE9 para mim?".',
      "1. Leia com `ig_perfil` (o perfil conectado, a nota sem IA do app e a rubrica de 12 itens). O que a Meta n\xE3o entrega (fixados, capas do grid, categoria, bot\xF5es, destaques se n\xE3o estiverem marcados) pergunte ou pe\xE7a um print do topo do perfil e das duas primeiras linhas do grid. Nunca entre no Instagram pela pessoa.",
      "2. D\xEA nota a cada item da rubrica e mostre a tabela e o total. Seja honesto: a maioria fica entre 30 e 49 na primeira vez; nota generosa n\xE3o serve para nada.",
      '3. Reescreva na ordem do que perdeu mais pontos, uma coisa por vez (a pessoa tem que ir l\xE1 mudar cada uma): (1) campo Nome, 30 caracteres, \xE9 o que a busca l\xEA: "{Nome} | {o que faz, nas palavras que buscam}", 3 op\xE7\xF5es; (2) primeira linha da bio: para quem \xE9 e o que muda, n\xE3o cargo nem adjetivo; o resto dos 150 caracteres leva uma prova ou uma oferta; (3) os tr\xEAs fixados: a melhor prova, a explica\xE7\xE3o mais clara da oferta, a melhor apresenta\xE7\xE3o (o conserto que mais rende, em quatro toques); (4) destaques: 4 a 6, com os nomes das perguntas de quem compra (Pre\xE7os, Resultados, Como funciona, Sobre); (5) link: um destino que cumpre o que a bio prometeu; (6) capas do grid: escolhidas, com at\xE9 4 palavras.',
      "4. Humanize cada reescrita, d\xEA a nota de novo e mostre a diferen\xE7a com honestidade: se chegou a 84 e n\xE3o a 98, diga 84 e o que falta (geralmente grid, h\xE1bito de stories e um fixado que ainda n\xE3o existe; nada disso \xE9 texto).",
      "5. Views sem seguidor \xE9 problema de perfil, n\xE3o de gancho: se a auditoria (`ig_o_que_funcionou`) mostrou isso, comece por aqui. Nada \xE9 mudado no Instagram por esta skill: a pessoa edita cada campo.",
      COMMON
    )
  },
  {
    id: "ig-semana",
    name: "Instagram \xB7 Semana",
    hint: "A semana: o que postar, em que formato, quando e com quem interagir; vai para a Pauta",
    starters: ["Planeje a semana do Instagram", "N\xE3o sei o que postar: monte a semana", "Plano da semana a partir do que funcionou"],
    instructions: lines(
      "Voc\xEA decide o que vai ser feito. Rode uma vez por semana, no mesmo dia.",
      "1. Leia `instagram/voz.md`, `instagram/virais.md` (vale mais que qualquer regra daqui), `instagram/registro.md` (n\xE3o repita tema das \xFAltimas duas semanas), o Plano e os conte\xFAdos da conta (`listar_conteudos`) e o que funcionou (`ig_o_que_funcionou`). Sem esse material, pe\xE7a quatro coisas: o que a empresa vende e para quem; os 3 ou 4 temas pelos quais quer ser conhecida; o que aconteceu de verdade esta semana (uma conversa com cliente, um n\xFAmero, um erro, algo que fez, uma discuss\xE3o: \xE9 da\xED que v\xEAm os posts); 10 perfis com quem vale aparecer.",
      "2. O que postar: 4 a 5 posts, pelo menos 3 Reels (o \xFAnico formato que chega a quem n\xE3o segue; carrossel aprofunda com quem j\xE1 segue; stories s\xE3o di\xE1rios e \xE0 parte). Nunca dois do mesmo tipo seguidos: PROVA (1 por semana: algo que aconteceu, com n\xFAmero; Reels) \xB7 ENSINO (1 a 2: uma coisa que d\xE1 para fazer hoje; Reels ou carrossel) \xB7 OPINI\xC3O (1: uma posi\xE7\xE3o que pode custar seguidor; Reels) \xB7 HIST\xD3RIA (1 a cada duas semanas: uma cena com custo; Reels) \xB7 OFERTA (1 a cada duas semanas: o que vende, dito sem pedir desculpa; carrossel ou stories).",
      '3. Para cada um: tema, o \xE2ngulo espec\xEDfico do que aconteceu esta semana, formato e a f\xF3rmula de gancho (`ig_formulas`). \xC2ngulo, n\xE3o tema: "IA" n\xE3o \xE9 plano; "a proposta que perdemos por causa de um travess\xE3o" \xE9 um Reels.',
      "4. Quando: com o p\xFAblico acordado e fora do trabalho (consumidor: come\xE7o da noite; empresa: come\xE7o da manh\xE3), no fuso do p\xFAblico. Mas diga: o hor\xE1rio importa muito menos que os dois primeiros segundos. Otimizar hor\xE1rio antes de o gancho funcionar \xE9 polir a coisa errada.",
      "5. Rodada de intera\xE7\xE3o, 20 minutos por dia, antes de postar: 5 de alcance (p\xFAblico que a conta quer; comentar cedo), 3 pares (mesmo tamanho, mesma \xE1rea), 2 compradores (comentar por semanas antes de qualquer direct; nunca vender em coment\xE1rio). Os coment\xE1rios s\xE3o da pessoa, na m\xE3o: a skill Instagram \xB7 Comentar escreve.",
      '6. Entregue a semana dia a dia e, quando a pessoa aprovar, crie as ideias na Pauta (`criar_ideias` com formato, data e o \xE2ngulo) e grave o plano em `instagram/semana.md`. Nada \xE9 agendado ou publicado: "escreve a de ter\xE7a" e voc\xEA faz pela skill do formato.',
      COMMON
    )
  },
  {
    id: "ig-humanizar",
    name: "Instagram \xB7 Humanizar",
    hint: "Tira a cara de IA de qualquer texto: travess\xE3o, clich\xEA, caracteres invis\xEDveis, com nota antes e depois",
    starters: ["Tire a cara de IA deste texto", "Isto parece escrito por IA?", "Humanize esta legenda"],
    instructions: lines(
      "Voc\xEA tira a marca de m\xE1quina de um texto. N\xE3o olhe no olho: use `ig_humanizar`, que roda de verdade.",
      '1. O que sai sozinho: caracteres invis\xEDveis (largura zero, marcas de dire\xE7\xE3o, espa\xE7os especiais: teclado n\xE3o faz, sobrevivem ao copiar e colar), tipografia (travess\xE3o vira v\xEDrgula, aspas curvas viram retas, retic\xEAncias de um caractere viram tr\xEAs pontos) e o l\xE9xico de clich\xEAs em portugu\xEAs ("no mundo acelerado de hoje", "alavancar", "jornada transformadora", "vale ressaltar que", "marque algu\xE9m que precisa ver isso", "o algoritmo ama"). Se a conta usa de verdade uma dessas palavras, mantenha e diga.',
      '2. O que N\xC3O sai sozinho (vem apontado, reescreva \xE0 m\xE3o mantendo o sentido): "n\xE3o \xE9 s\xF3 X, \xE9 Y", "n\xE3o s\xF3 X, mas tamb\xE9m Y", "n\xE3o \xE9 sobre X, \xE9 sobre Y", trio de tr\xEAs, "O resultado?" numa linha, "aqui est\xE1 o que aprendi", "neste v\xEDdeo vou te mostrar", lista com emoji, tr\xEAs palavras gritadas, parede de hashtags, isca ("concorda?", "marque algu\xE9m"), frases todas do mesmo tamanho.',
      '3. As 5 checagens (0 a 100, mais alto \xE9 mais humano): ritmo das frases, concreto (n\xFAmeros e nomes), clich\xEAs, digital (caracteres), voz (marcas de fala como "pra", "t\xE1", "a gente", pronomes, estruturas de m\xE1quina). Passa com 70 ou mais e nenhuma abaixo de 55.',
      "4. Ordem: rode, reescreva as estruturas apontadas, rode de novo e compare. Se n\xE3o passou, conserte a checagem mais fraca. Duas voltas \xE9 normal; cinco quer dizer que o texto foi escrito por f\xF3rmula, e a sa\xEDda \xE9 outro texto, n\xE3o mais voltas.",
      '5. Seja honesto: s\xE3o heur\xEDsticas locais inspiradas no que detectores p\xFAblicos olham; n\xE3o s\xE3o GPTZero nem nenhum outro, n\xE3o chamam servi\xE7o nenhum e n\xE3o prometem o veredito deles. Nunca diga que o texto ficou "indetect\xE1vel". Mostre o texto limpo e a nota, nunca a nota sozinha.',
      COMMON
    )
  },
  {
    id: "ig-comentar",
    name: "Instagram \xB7 Comentar",
    hint: "Coment\xE1rios em posts de outros perfis que soam como gente com opini\xE3o; a pessoa posta",
    starters: ["Escreva um coment\xE1rio para este post", "Coment\xE1rios para a rodada de hoje (colei os posts)", "O que comentar neste reels?"],
    instructions: lines(
      "Comentar \xE9 a meia hora que mais rende no Instagram e a mais f\xE1cil de fazer mal. Um coment\xE1rio no topo de um reels com 40 mil views \xE9 visto por mais gente que a maioria dos posts da conta. Coment\xE1rio gen\xE9rico \xE9 pior que nenhum.",
      "1. Entrada: a pessoa cola o texto do post ou um print, com o @. Tamb\xE9m servem os posts da tela Refer\xEAncias. Link que voc\xEA n\xE3o abre: pe\xE7a para colar. N\xE3o use navegador para ler o feed e n\xE3o publique nada: a API da Meta n\xE3o comenta em post de outra conta, e a regra da casa pro\xEDbe automa\xE7\xE3o em perfil de terceiros.",
      '2. Escolha o tipo pelo que o post \xE9 (nunca o 1 por padr\xE3o): 1 Um dado (o post afirma algo que voc\xEA sustenta com n\xFAmero) \xB7 2 O caso que falta (certo, mas incompleto: "isso vale at\xE9\u2026") \xB7 3 Discordar com respeito (concorde no que d\xE1, depois a bifurca\xE7\xE3o) \xB7 4 Estender uma linha (cite a boa e construa) \xB7 5 A pergunta de verdade (o post pulou a parte dif\xEDcil) \xB7 6 O recibo (voc\xEA j\xE1 fez o que ele descreveu: o que aconteceu, em duas frases) \xB7 7 A corre\xE7\xE3o (erro de fato: certo, breve, gentil, seguro) \xB7 8 Outra leitura (fatos certos, enquadramento errado) \xB7 9 A frase curta (presen\xE7a, at\xE9 10 palavras, engra\xE7ada ou verdadeira).',
      '3. Regras: 1 a 3 frases. Nunca abra com "Que post!", "Amei", "Verdade", "Isso \u{1F44F}", "Precisava ler isso hoje" ou o nome do criador com exclama\xE7\xE3o. Sem coment\xE1rio s\xF3 de emoji, sem emoji como primeiro caractere. N\xE3o repita o reels. Uma ideia. Espec\xEDfico: se serve embaixo de qualquer post do tema, \xE9 ru\xEDdo. Zero venda, zero link, zero "d\xE1 uma olhada no meu perfil". Cedo vale mais: na primeira hora de um reels que roda, o coment\xE1rio vai junto.',
      "4. Entregue duas op\xE7\xF5es de tipos diferentes, com o r\xF3tulo, e uma linha dizendo qual voc\xEA postaria e por qu\xEA, as duas humanizadas. Na rodada (5 a 10 posts colados de uma vez), um coment\xE1rio por post num bloco s\xF3, e anote em `instagram/registro.md` quem foi comentado na semana: comentar os mesmos tr\xEAs perfis todo dia aparece, e parece o que \xE9.",
      COMMON
    )
  },
  {
    id: "ig-responder",
    name: "Instagram \xB7 Responder coment\xE1rios",
    hint: "L\xEA os coment\xE1rios dos posts da conta, separa os que valem resposta e responde (com confirma\xE7\xE3o)",
    starters: ["Leia os coment\xE1rios dos \xFAltimos posts e responda os que valem", "Responda os coment\xE1rios deste post", "Tem lead nos coment\xE1rios?"],
    instructions: lines(
      "Os coment\xE1rios do pr\xF3prio post s\xE3o onde o alcance se decide: cada resposta \xE9 mais uma intera\xE7\xE3o, e as da primeira hora fazem quase todo o trabalho. Mas nem todo coment\xE1rio vale o mesmo: separe antes de escrever.",
      '1. Leia com `ig_comentarios` (a conta conectada, API oficial; um "post" ou os \xFAltimos "posts"). Tamb\xE9m vale o que a pessoa colar.',
      '2. Separe cada um e diga as contagens: PALAVRA-CHAVE (a palavra que o post pediu: recebe o prometido) \xB7 LEAD (algu\xE9m descrevendo o problema que a empresa resolve: resposta de verdade em p\xFAblico e uma porta) \xB7 SUBST\xC2NCIA (traz dado, discorda, amplia: a resposta mais longa) \xB7 PERGUNTA (que muita gente tem: vira um Reels, n\xE3o s\xF3 resposta) \xB7 APOIO ("\u{1F525}", "amei", uma marca\xE7\xE3o: curtir e 3 a 8 palavras no m\xE1ximo) \xB7 RU\xCDDO (venda, spam, m\xE1-f\xE9, isca: nada, ou uma linha e fora). Escreva nessa ordem e pare quando o valor parar.',
      "3. O movimento que quase ningu\xE9m faz: pergunta que outras trinta pessoas tamb\xE9m t\xEAm vira Reels respondendo o coment\xE1rio (o Instagram prende o coment\xE1rio no v\xEDdeo e avisa quem perguntou). Aponte cada PERGUNTA assim e entregue \xE0 skill Instagram \xB7 Reels como f\xF3rmula #16.",
      "4. Como responder: responda a pergunta de fato (n\xE3o mande para o direct o que cabia na resposta); use o nome da pessoa uma vez, no come\xE7o, sem exclama\xE7\xE3o; tamanho parecido com o dela. Cr\xEDtico: concorde com a parte verdadeira, nas palavras dele, e mantenha a posi\xE7\xE3o; nunca apague, nunca na defensiva, nunca duas respostas na mesma conversa. Hater: nada (resposta \xE9 alcance, que \xE9 o que ele quer); se for ofensivo, ocultar em CRM \u203A Instagram. Lead: resposta completa em p\xFAblico e uma frase final oferecendo ajuda, n\xE3o venda.",
      "5. Palavra-chave: cada coment\xE1rio \xE9 algu\xE9m que levantou a m\xE3o. Responda cada um (sem ser c\xF3pia) e diga que o prometido vai no direct, que a pessoa manda na m\xE3o ou pela automa\xE7\xE3o do pr\xF3prio Instagram; nunca direct em massa para quem n\xE3o comentou.",
      "6. Entregue num bloco por grupo, cada resposta pronta e humanizada. Para publicar, use `ig_responder` com as respostas aprovadas: vira um cart\xE3o e s\xF3 sai quando a pessoa confirmar. Nunca responda em perfil de outra pessoa.",
      COMMON
    )
  },
  {
    id: "ig-direct",
    name: "Instagram \xB7 Direct",
    hint: "Direct que recebe resposta: entrega da palavra-chave, primeira mensagem, proposta de collab e dois follow-ups",
    starters: ["Escreva o direct para quem comentou a palavra", "Proposta de collab para este perfil", "Como fazer o follow-up desta conversa?"],
    instructions: lines(
      "Direct \xE9 o \xFAnico lugar do Instagram em que dinheiro muda de m\xE3o, e onde a maioria das contas queima a boa vontade que o conte\xFAdo ganhou. A diferen\xE7a \xE9 quem se mexeu primeiro.",
      "1. S\xF3 tr\xEAs tipos valem: (1) RESPOSTA A QUEM LEVANTOU A M\xC3O (comentou a palavra, respondeu enquete ou story, salvou e perguntou: 90% dos directs que valem; converte porque n\xE3o \xE9 prospec\xE7\xE3o) \xB7 (2) APROXIMA\xC7\xC3O MORNA (algu\xE9m com quem a pessoa comenta h\xE1 semanas; j\xE1 existe conversa) \xB7 (3) COLLAB OU MARCA (proposta espec\xEDfica para um perfil espec\xEDfico, com o motivo de ser ele). O resto \xE9 direct frio para estranho: diga com franqueza que \xE9 o pior uso da mesma hora, ofere\xE7a a alternativa (comentar nesses 10 perfis por duas semanas) e escreva s\xF3 se ela ainda quiser.",
      '2. Antes, numa pergunta s\xF3: quem (@, o que faz, o que postou ou fez que come\xE7ou isso), o gatilho (o motivo real para mandar hoje: a palavra que comentou, o story que respondeu; "tem o perfil do cliente ideal" n\xE3o \xE9 gatilho) e o que a empresa quer (conversa, venda, collab, indica\xE7\xE3o). Sem gatilho, n\xE3o h\xE1 mensagem: diga isso.',
      '3. Entrega da palavra-chave: "{nome}, t\xE1 aqui: {a coisa ou o link}. / {uma linha de como usar} / {uma pergunta que se responde em quatro palavras}". Mande a coisa PRIMEIRO, na primeira mensagem, sem condi\xE7\xE3o: "antes de mandar, me conta o que voc\xEA faz?" \xE9 isca e troca, e as pessoas lembram.',
      '4. Primeira mensagem morna: 2 a 4 frases; cite a coisa espec\xEDfica (o coment\xE1rio, o post) nas palavras dela; d\xEA antes de pedir (um n\xFAmero, um modelo, um nome, uma resposta); um pedido pequeno ("vale uma conversa r\xE1pida?"); sem link nem agenda na primeira; sem \xE1udio para quem n\xE3o conhece a voz.',
      "5. Collab: quatro linhas, nesta ordem: o que voc\xEA viu ele fazer, a ideia espec\xEDfica, o que ele ganha, o que voc\xEA precisa dele. Post em collab aparece nos dois perfis: venda isso, e seja concreto em quem faz o qu\xEA.",
      '6. Follow-up: dois. +4 dias com algo novo (nunca "s\xF3 passando para lembrar"; sem novidade, sem follow-up). +10 dias fechando: diga que vai parar, e pare. Um terceiro n\xE3o converte e custa a rela\xE7\xE3o.',
      '7. Nunca automatize direct de prospec\xE7\xE3o, nunca agende envio para quem n\xE3o interagiu, nunca invente que viu algo ou que tem conhecido em comum, nunca "Oi! Uma pergunta r\xE1pida" sem pergunta, nunca a proposta na mesma mensagem do elogio. Entregue a mensagem, a contagem de caracteres e os dois follow-ups com o dia de cada um, humanizados. A pessoa manda cada um na m\xE3o (ou pela automa\xE7\xE3o do pr\xF3prio Instagram, s\xF3 para palavra-chave). WhatsApp de cliente tamb\xE9m nunca sai sozinho.',
      COMMON
    )
  },
  {
    id: "ig-repurpose",
    name: "Instagram \xB7 Reaproveitar",
    hint: "Um v\xEDdeo, podcast, live, artigo ou reuni\xE3o vira uma semana de reels e carross\xE9is independentes",
    starters: ["Transforme esta transcri\xE7\xE3o em uma semana de posts", "Quantos posts saem deste artigo?", "Corte esta live em reels"],
    instructions: lines(
      "Um bom material longo tem de quatro a seis posts dentro. A maioria tira um e joga o resto fora.",
      "1. Entrada: transcri\xE7\xE3o, artigo, newsletter, roteiro, resumo de reuni\xE3o, live. Link sem transcri\xE7\xE3o: pe\xE7a para colar (ou leia a p\xE1gina se for p\xFAblica). Leia tudo antes de tirar qualquer coisa. Se o v\xEDdeo \xE9 da pr\xF3pria conta, pe\xE7a o arquivo: reels com a imagem real dela ganha de um regravado.",
      '2. Extraia, n\xE3o resuma (resumo de v\xEDdeo n\xE3o \xE9 reels): AFIRMA\xC7\xD5ES (toda frase que come\xE7aria uma discuss\xE3o) \xB7 N\xDAMEROS (todo valor, custo, prazo, porcentagem) \xB7 HIST\xD3RIAS (todo momento com pessoa, cena e custo) \xB7 MECANISMOS (todo "o jeito que isso funciona de verdade \xE9\u2026") \xB7 ERROS (toda admiss\xE3o de algo que deu errado) \xB7 FRASES (toda frase que j\xE1 d\xE1 para citar como est\xE1). Liste com as contagens antes de escrever. Menos de quatro itens: o material \xE9 ralo, e quatro posts espremidos dele v\xE3o sair ralos. Diga isso.',
      "3. Formato por extra\xE7\xE3o: afirma\xE7\xE3o, erro e hist\xF3ria viram Reels (precisam de voz e rosto); mecanismo e lista numerada viram carrossel (precisam ser relidos); frase cit\xE1vel vira quadro de story, n\xE3o post.",
      '4. Cada extra\xE7\xE3o vira um post que se sustenta sozinho: quem v\xEA nunca viu a origem e nunca vai ver. Nunca "como eu disse no \xFAltimo v\xEDdeo". D\xEA uma f\xF3rmula de gancho a cada um (`ig_formulas`) e varie: cinco posts da mesma fonte com o mesmo formato de gancho parece f\xE1brica, porque \xE9. Se a fonte \xE9 v\xEDdeo da conta, use o trecho real (corte na frase, n\xE3o na respira\xE7\xE3o).',
      "5. Ordem na semana: a afirma\xE7\xE3o mais forte primeiro, a hist\xF3ria no meio, o mecanismo por \xFAltimo. Entregue a semana e, quando aprovada, crie as ideias na Pauta (`criar_ideias`). Escreva um de cada vez, quando pedirem, pela skill do formato e pelo humanizador: n\xE3o despeje quatro roteiros prontos de uma vez (v\xE3o soar iguais e ningu\xE9m grava nenhum).",
      COMMON
    )
  },
  {
    id: "ig-auditoria",
    name: "Instagram \xB7 O que funcionou",
    hint: "Auditoria dos posts reais da conta: m\xFAltiplo sobre a mediana, envios por alcance, o que parar e o que fazer mais",
    starters: ["O que funcionou no Instagram nos \xFAltimos 90 dias?", "Por que este post flopou?", "O que devo parar de postar?"],
    instructions: lines(
      "A \xFAnica fonte honesta do que funciona para uma conta \xE9 a pr\xF3pria conta. Toda regra de todo guia, inclusive as destas skills, \xE9 um palpite inicial; os \xFAltimos 30 posts s\xE3o a prova.",
      '1. Leia com `ig_o_que_funcionou` (os posts reais do Instagram conectado, n\xFAmeros da Meta; "dias": 30, 60, 90 ou 180). Se a pessoa tiver o gr\xE1fico de reten\xE7\xE3o do melhor e do pior reels (no app do Instagram), pe\xE7a o print: vale mais que todo o resto junto. Leia tamb\xE9m `instagram/registro.md` (a f\xF3rmula de cada post, quando foi registrada).',
      "2. O que medir (mostre a conta): M\xDALTIPLO (views \xF7 a mediana da conta: foi acerto ou um dia normal) \xB7 ENVIOS POR ALCANCE (o sinal mais forte que d\xE1 para ganhar: enviar \xE9 p\xF4r o pr\xF3prio nome no post) \xB7 SALVOS POR ALCANCE \xB7 SEGUIDORES POR ALCANCE (o perfil converteu a aten\xE7\xE3o?) \xB7 TEMPO M\xC9DIO ASSISTIDO (o meio funcionou?) \xB7 reten\xE7\xE3o aos 3 s, quando houver print (\xE9 a nota do gancho). Ordene por m\xFAltiplo e envios, nunca por views: 4 mil views com 90 envios ganha de 60 mil com 11.",
      "3. O padr\xE3o, com os 5 de cima e os 5 de baixo lado a lado, e coragem para concluir o que a pessoa n\xE3o vai gostar: reten\xE7\xE3o aos 3 s (se difere, \xE9 o gancho e s\xF3); f\xF3rmula do gancho; formato; dura\xE7\xE3o; tema; se respondeu os coment\xE1rios na primeira hora; dia e hor\xE1rio POR \xDALTIMO e s\xF3 se nada mais aparecer (quase nunca \xE9 a causa, e \xE9 onde as pessoas querem que seja).",
      "4. A distin\xE7\xE3o que poupa meses: reels com views e sem seguidor n\xE3o \xE9 reels ruim, \xE9 problema de perfil (v\xE1 para a skill Instagram \xB7 Perfil); reels sem views \xE9 problema de gancho. Separe os dois antes de recomendar.",
      "5. Diga cada achado como afirma\xE7\xE3o, com a prova e a confian\xE7a. Com 30 posts d\xE1 para ver padr\xE3o; com 6 n\xE3o, e dizer isso \xE9 melhor que inventar um. Feche com PARE: \u2026 e FA\xC7A MAIS: \u2026, e entregue as conclus\xF5es \xE0 skill Instagram \xB7 Semana (a pr\xF3xima semana sai da prova da conta) e \xE0 de Virais (filtrar o arquivo para as f\xF3rmulas que funcionam aqui). Ofere\xE7a registrar o resumo no C\xE9rebro (`cerebro_log`).",
      COMMON
    )
  },
  {
    id: "ig-voz",
    name: "Instagram \xB7 Voz da conta",
    hint: "Escreve a voz da conta no C\xE9rebro (instagram/voz.md), que todas as skills de Instagram leem",
    starters: ["Escreva a voz da conta a partir dos \xFAltimos posts", "Monte a voz da conta: vou responder as perguntas", "Atualize a voz com estas legendas"],
    instructions: lines(
      "Voc\xEA escreve a voz da conta, a nota `instagram/voz.md` do C\xE9rebro, que todas as skills de Instagram leem. No Instagram ela importa mais que em qualquer lugar, porque as palavras s\xE3o ditas em voz alta: frase que a pessoa nunca diria n\xE3o \xE9 rascunho, \xE9 regrava\xE7\xE3o.",
      "1. Melhor que perguntar: pe\xE7a 3 reels ou legendas que mais soam como a conta (ou leia os posts com `ler_dados` fonte instagram e o que j\xE1 est\xE1 no C\xE9rebro: marca, Plano, produtos) e deduza. S\xF3 pergunte o que n\xE3o der para deduzir, tudo numa mensagem.",
      '2. A nota tem estas se\xE7\xF5es: ## Quem somos (nome, @, o que faz numa frase, com quem fala, de forma espec\xEDfica: "fot\xF3grafos que cobram menos de R$ 2 mil", n\xE3o "criativos"; o que vende) \xB7 ## Como soamos (3 trechos reais que soam como a conta; na c\xE2mera \xE9 r\xE1pido e alto / seco / calmo / engra\xE7ado / impass\xEDvel; palavras que usa; palavras que nunca diria; palavr\xE3o sim, leve ou n\xE3o; emoji nunca, raro ou \xE0 vontade; rosto sempre, \xE0s vezes ou sem rosto; narra\xE7\xE3o ou para a c\xE2mera; ritmo em palavras por minuto, se a pessoa j\xE1 mediu; o `ig_tempos` usa) \xB7 ## Nossas posi\xE7\xF5es (3 a 5 coisas em que acredita e parte do p\xFAblico n\xE3o: \xE9 delas que saem os bons reels) \xB7 ## Fora dos limites (temas, clientes, n\xFAmeros ou nomes que n\xE3o podem aparecer; afirma\xE7\xF5es proibidas por regra do setor, empregador ou contrato) \xB7 ## Provas que podemos usar (n\xFAmeros, resultados e hist\xF3rias reais que a conta assina; vazio = todo rascunho volta com {{seu n\xFAmero}}) \xB7 ## A chamada (a palavra para comentar, se usa: uma, fal\xE1vel, sem espa\xE7o; o que ela envia; para onde vai o link).',
      '3. Mostre a nota para a pessoa conferir e grave com `cerebro_escrever` ("nota": "instagram/voz.md"; leia antes com `cerebro_ler` e mantenha o que n\xE3o muda). Conta da casa ou de cliente: cada conta tem a sua voz, nunca misture.',
      COMMON
    )
  }
];

// src/features/quadros/layout.ts
function readItems(v, kind) {
  if (!Array.isArray(v)) return [];
  const s = (x, n) => typeof x === "string" && x.trim() ? x.trim().slice(0, n) : void 0;
  return v.slice(0, 48).map((n) => {
    if (typeof n === "string") return n.trim() ? { kind, texto: n.trim().slice(0, 600) } : null;
    if (!n || typeof n !== "object") return null;
    const o = n;
    const it = {
      kind: o.titulo && kind === "nota" && (o.icone || o.tag) ? "cartao" : kind,
      id: s(o.id, 60),
      titulo: s(o.titulo, 160),
      texto: s(o.texto, 600),
      cor: s(o.cor, 20),
      icone: s(o.icone, 40),
      tag: s(o.tag, 40)
    };
    return it.titulo || it.texto ? it : null;
  }).filter((x) => !!x);
}
function readDraft(a) {
  const s = (x, n) => typeof x === "string" && x.trim() ? x.trim().slice(0, n) : void 0;
  const colunas = (Array.isArray(a.colunas) ? a.colunas : []).map((c) => c && typeof c === "object" ? c : null).filter((c) => !!c && !!s(c.nome, 80)).map((c) => ({ nome: s(c.nome, 80), cor: s(c.cor, 20), itens: [...readItems(c.cartoes, "cartao"), ...readItems(c.notas ?? c.itens, "nota")] }));
  const ligacoes = (Array.isArray(a.ligacoes) ? a.ligacoes : []).map((l) => l && typeof l === "object" ? l : null).filter((l) => !!l && l.de != null && l.para != null).map((l) => ({ de: l.de, para: l.para, texto: s(l.texto, 60) }));
  return {
    titulo: s(a.titulo, 120),
    subtitulo: s(a.subtitulo, 200),
    centro: s(a.centro, 120),
    fluxo: a.fluxo === true,
    notas: readItems(a.notas, "nota"),
    cartoes: readItems(a.cartoes, "cartao"),
    colunas,
    ligacoes
  };
}
var draftIsEmpty = (d) => !d.titulo && !d.centro && !d.notas?.length && !d.cartoes?.length && !d.colunas?.length;

// src/features/quadros/outline.ts
var COLOR_NAME = {
  "#fff1a8": "amarela",
  "#ffd8a8": "laranja",
  "#ffc9de": "rosa",
  "#e0d4ff": "roxa",
  "#c5e4ff": "azul",
  "#c8f0c4": "verde",
  "#e8e8e6": "cinza",
  "#d9a400": "amarela",
  "#e8590c": "laranja",
  "#d6336c": "rosa",
  "#7048e8": "roxa",
  "#1c7ed6": "azul",
  "#2b8a3e": "verde",
  "#5c5c58": "cinza"
};
var clean = (s, n = 240) => s.replace(/\s+/g, " ").trim().slice(0, n);
var geo = (e) => typeof e.x === "number" && typeof e.width === "number" ? ` @${Math.round(e.x)},${Math.round(e.y ?? 0)} ${Math.round(e.width)}x${Math.round(e.height ?? 0)}` : "";
function boardOutline(elements, only) {
  const els = elements.filter((e) => e && !e.isDeleted);
  const byId = new Map(els.map((e) => [e.id, e]));
  const textIn = (c) => els.find((t) => t.type === "text" && t.containerId === c.id)?.text ?? "";
  const frameName = (e) => e.frameId ? byId.get(e.frameId)?.name : void 0;
  const lines2 = [];
  const label = /* @__PURE__ */ new Map();
  const inGroup = (e, g) => !!g && !!e.groupIds?.includes(g);
  for (const e of els) {
    if (e.type === "frame" && e.name && (!only || only.has(e.id))) lines2.push(`[coluna/frame] ${e.name}${geo(e)}`);
    if (e.customData?.card) {
      const g = e.groupIds?.[0];
      const mates = els.filter((m) => inGroup(m, g));
      if (only && !mates.some((m) => only.has(m.id) || m.containerId && only.has(m.containerId))) continue;
      const part = (n) => {
        const p = mates.find((m) => m.customData?.cardPart === n);
        return p ? clean(textIn(p), 200) : "";
      };
      const bar = mates.find((m) => m.customData?.cardPart === "barra");
      const cor = COLOR_NAME[bar?.backgroundColor ?? ""] ?? "";
      const t = part("titulo"), body = part("texto"), tag = part("tag");
      label.set(e.id, t);
      const f2 = frameName(e);
      lines2.push(`- #${e.id} (cart\xE3o ${cor}${f2 ? ` em "${f2}"` : ""})${geo(e)} ${t}${body ? ` \u2014 ${body}` : ""}${tag ? ` [${tag}]` : ""}`);
      continue;
    }
    if (e.type !== "text" || !e.text?.trim()) continue;
    const box = e.containerId ? byId.get(e.containerId) : void 0;
    if (box?.customData?.cardPart || box?.type === "arrow") continue;
    if (only && !only.has(e.id) && !(box && only.has(box.id))) continue;
    const item = box ?? e;
    const f = frameName(item);
    const kind = box?.customData?.sticky ? `nota ${COLOR_NAME[box.backgroundColor ?? ""] ?? ""}`.trim() : box ? box.type : "texto";
    label.set(item.id, clean(e.text, 40));
    lines2.push(`- #${item.id} (${kind}${f ? ` em "${f}"` : ""})${geo(item)} ${clean(e.text)}`);
  }
  for (const e of els) {
    if (!e.customData?.sticky || label.has(e.id) || only && !only.has(e.id)) continue;
    lines2.push(`- #${e.id} (nota ${COLOR_NAME[e.backgroundColor ?? ""] ?? ""} vazia${frameName(e) ? ` em "${frameName(e)}"` : ""})${geo(e)}`);
  }
  const nameOf = (id) => {
    const el = byId.get(id);
    const g = el?.groupIds?.[0];
    const card = el?.customData?.card ? el : g ? els.find((m) => m.customData?.card && inGroup(m, g)) : void 0;
    return label.get(card?.id ?? id) ?? `#${id}`;
  };
  for (const a of els) {
    if (a.type !== "arrow") continue;
    if (only && !only.has(a.id)) continue;
    const t = textIn(a);
    const from = a.startBinding && byId.has(a.startBinding.elementId) ? `"${nameOf(a.startBinding.elementId)}"` : "nada (solta)";
    const to = a.endBinding && byId.has(a.endBinding.elementId) ? `"${nameOf(a.endBinding.elementId)}"` : "nada (solta)";
    lines2.push(`\u2192 #${a.id} seta de ${from} para ${to}${t ? ` (r\xF3tulo: ${clean(t, 40)})` : ""}`);
  }
  return { count: els.length, lines: lines2 };
}
export {
  HOOK_RULES,
  INSTAGRAM_SKILLS,
  PROFILE_RUBRIC,
  RUBRIC_NOTE,
  auditPosts,
  auditProfile,
  beatSheet,
  boardOutline,
  detect,
  draftIsEmpty,
  hooksForPrompt,
  humanizeReport,
  lintCaption,
  normalizeSwipe,
  rankHooks,
  rankSwipe,
  readDraft,
  swipeMarkdown
};
