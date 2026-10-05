# Baldez & Moreira Advogados Associados — fatos, textos e pendências

**Prospecto, não é cliente.** Pesquisa da fase 1 (2026-10-03) para montar no Space uma nova versão do site e oferecer o redesign. É um escritório real: nada de número, prêmio, depoimento, tempo de casa ou nome que não esteja aqui com a fonte. Este arquivo resume com palavras próprias; as aspas ficam só para títulos e chamadas curtas do próprio site.

Legenda: **Fato** (com a URL de onde saiu) · *Interpretação* (leitura nossa, sem prova) · **Pendência** (confirmar com o escritório; lista numerada no fim).

## Fontes consultadas

- Site atual, home (página única): http://baldezmoreira.adv.br/ e https://baldezmoreira.adv.br/ (as duas respondem; lido em 2026-10-03).
- API pública do WordPress: páginas `https://baldezmoreira.adv.br/index.php?rest_route=/wp/v2/pages`, posts `…/wp/v2/posts`, mídia `…/wp/v2/media`, raiz `…/index.php?rest_route=/`.
- Mapa do site: https://baldezmoreira.adv.br/?sitemap=index
- CSS do kit do Elementor: https://baldezmoreira.adv.br/wp-content/uploads/elementor/css/post-6.css; da home: `…/css/post-14.css`; `…/css/global.css`.
- Cadastro do CNPJ (dados da Receita Federal via BrasilAPI): https://brasilapi.com.br/api/cnpj/v1/50962293000166 e https://brasilapi.com.br/api/cnpj/v1/32592872000182
- Ficha do Google: nota e número de avaliações informados pelo usuário a partir do Google Maps em 2026-10-03 (não conferido daqui).
- Regras: Provimento 205/2021 do CFOAB (https://eticaedisciplina.oab.org.br/assets/docs/Provimento%20n.%20205.2021%20-%20Publicidade.pdf), Código de Ética e Disciplina da OAB, Resolução 02/2015 (https://eticaedisciplina.oab.org.br/assets/docs/3.codigodeeticanovo.pdf), Estatuto da Advocacia, Lei 8.906/1994 (https://www.planalto.gov.br/ccivil_03/leis/l8906.htm).
- Fotos do site atual (desktop 1440 px e celular 390 px): `.space/baldez-moreira/referencia/desktop/` e `mobile/` (pasta fora do git).

## 1. Quem é

- **Nome no site**: "Baldez & Moreira Advogados Associados" (título da página e da API). No rodapé e na ficha do Google aparece sem o "&": "Baldez Moreira Advogados Associados"; no texto, "a Baldez Moreira". Fonte: home e `rest_route=/`.
- **Cadastro (CNPJ 50.962.293/0001-66)**: razão social **Baldez Moreira Sociedade Individual de Advocacia**, natureza "Sociedade Unipessoal de Advocacia", aberta em 2023-06-06, ativa, atividade "Serviços advocatícios", titular **Tiago Baldez Moreira**. Endereço do cadastro: R. São Joaquim, 792, sala 802, Centro, São Leopoldo/RS. Fonte: BrasilAPI (link acima).
  - *Interpretação*: o "&" e o "Advogados Associados" sugerem dois sócios, mas o cadastro mostra um titular só, e "Baldez Moreira" é o sobrenome dele. O Estatuto (art. 16, § 4º) manda a sociedade unipessoal usar o nome do titular com a expressão "Sociedade Individual de Advocacia". **Pendência 1.**
- **Nome do titular em processos**: o nome aparece como advogado em processos públicos listados pelo Jusbrasil, a maioria no TRF4, com o INSS como parte mais frequente (https://www.jusbrasil.com.br/processos/nome/45336027/tiago-baldez-moreira). *Interpretação*: confirma o peso do previdenciário. Não usar esse dado na página.
- **Endereço no site**: Galeria Basile, R. Independência, 945, salas 102 e 103, Centro, São Leopoldo/RS, 93010-001. Fonte: home, bloco "Contato". O endereço do Google Maps informado pelo usuário é o mesmo.
- **Endereços antigos**: prints da ficha do Google guardados na biblioteca de mídia do site (2023-11 e 2024-01) mostram R. São Joaquim, 867, "Scherer Center". O print de 2025-02 (o que está na home) já mostra a Galeria Basile, mas ainda diz "Localizado em: Scherer Center". Fonte: mídia ids 152, 154 e 192 em `…/wp/v2/media`.
- **Região**: o site diz que o escritório fica "no Vale dos Sinos". Fonte: home, bloco "O que dizem nossos clientes?".
- **Público** (*interpretação*, pelo conjunto de áreas e pela palavra "segurado" no bloco de transparência): segurados do INSS, aposentados e pensionistas, trabalhadores acidentados e pessoas endividadas, com atenção declarada a idosos, pessoas com deficiência e pessoas com doenças graves.

## 2. Contatos

| Canal | Valor | Onde aparece |
|---|---|---|
| Telefone fixo | (51) 3589-3302 | Home, bloco "Contato" (texto, sem link para ligar); Google Maps (usuário). |
| WhatsApp 1 | (51) 3037-3302 | Botões "Entrar em contato" do topo e do bloco "Contato" (`api.whatsapp.com/send?phone=555130373302`). |
| WhatsApp 2 | (51) 3199-4456 | Botão "Começar análise gratuita" (`phone=555131994456`). |
| E-mail | contato.baldezmoreira@gmail.com | Home, bloco "Contato" (texto, sem link). |
| Mensagem pronta dos botões | "Olá. Estava no site e quero fazer uma análise." | Nos três botões. |

- **Horário**: o site não informa. Os prints antigos do Google sugerem 8h às 17h30 (fecha 17h30, abre 8h). **Pendência 4.**
- **Redes sociais**: o site não tem nenhum link (nem Instagram, nem Facebook, nem LinkedIn), e a busca não achou perfil do escritório. Há uma "Baldez & Morais Advogados" em outro estado (https://baldezmorais.adv.br/, WhatsApp com DDD 98) que **não** tem relação aparente: só o nome parecido, o que confunde a busca. **Pendência 3.**

## 3. Empresa ligada: Asseprevi

- **Fato**: a biblioteca de mídia do site guarda um print da ficha do Google da **Asseprevi Assessoria Previdenciária** com o mesmo telefone do escritório, (51) 3589-3302, e o mesmo "Scherer Center" (mídia id 152, 2024-01; id 74 é um print da busca do Google com as avaliações dela).
- **Fato**: o CNPJ da Asseprevi (32.592.872/0001-82, "Asseprevi Despachante Documentário Ltda", serviços de escritório e apoio administrativo, aberto em 2019) tem o mesmo endereço de cadastro do CNPJ do escritório: R. São Joaquim, 792, sala 802. Fonte: BrasilAPI.
- **Fato**: das sete avaliações em print no carrossel "O que dizem nossos clientes?", duas agradecem à "Asseprev". Fonte: imagens `Captura-de-Tela-2023-11-16-às-13.50.55.png` e `…13.52.04.png` na home.
- *Interpretação*: parte das avaliações mostradas como do escritório parece vir da ficha da Asseprevi. E o Provimento 205 (art. 8º) e o Código de Ética (art. 40, IV) proíbem divulgar a advocacia junto com outra atividade ou indicar vínculo entre elas. O redesign não cita, não linka e não mistura a Asseprevi. **Pendência 2.**

## 4. O site atual, bloco por bloco

Página única (`page_id=14`, modelo Elementor Canvas, criada em 2023-11-13, alterada pela última vez em 2025-02-17), sem cabeçalho, sem menu e sem rodapé de verdade. Ordem:

1. **Abertura** (fundo de estante de livros com filtro azul): título "Somos especialistas em defender os seus direitos e garantir sua justiça" (em caixa alta); um parágrafo diz que o escritório ajuda a acessar os benefícios a que a pessoa tem direito, com tranquilidade; botão verde **"Entrar em contato"** (WhatsApp 1); à direita, o selo do logo.
2. **"Trabalhamos com:"**: 12 cartões com ícone, título e uma frase (lista na seção 5).
3. **"Entre outras áreas do direito"** + botão amarelo **"Começar análise gratuita"** (WhatsApp 2).
4. **"Diferenciais que nos destacam:"**: cinco cartões com ✅ (seção 6).
5. **"O que dizem nossos clientes?"**: o texto fala em mais de 10 anos de atuação no Vale dos Sinos e em "centenas de clientes satisfeitos"; imagem da ficha do Google (print de 2025-02: nota 5,0 com 131 avaliações, "Escritório de advocacia"); carrossel com sete avaliações em print e a dica "Toque para ampliar".
6. **"Transparência e responsabilidade"**: o escritório diz que tira as dúvidas do segurado com palavras simples, para ele entender o serviço contratado, e resume: "Falamos a língua do nosso cliente". *Interpretação*: é o melhor princípio do site, e pode guiar o tom do redesign.
7. **"Contato"** (fundo de colunas brancas): uma frase de atendimento, endereço, e-mail e telefone em texto, botão **"Entrar em contato"** (WhatsApp 1).
8. **Rodapé**: uma linha com copyright e "Desenvolvimento: Agência Costa" (link para agenciacosta.com).

Outras páginas públicas, todas restos da instalação e listadas no mapa do site: "Página de exemplo" (`?page_id=2`, texto padrão do WordPress), "Elementor #8" (`?page_id=8`, vazia) e o post "Olá, mundo!" (`?p=1`, com o comentário de exemplo e o formulário de comentários aberto). Não há blog, equipe, "sobre" nem página por área.

## 5. Áreas de atuação (os 12 cartões)

Títulos como estão no site; a frase de cada cartão foi resumida.

| Cartão | O que o site diz, em resumo | Grupo (*interpretação*) |
|---|---|---|
| Auxílio Acidente | ajuda para quem ficou com sequelas de acidente | Previdenciário |
| Benefício Assistencial (LOAS) | acesso ao benefício assistencial | Previdenciário / assistencial |
| Causas Trabalhistas | disputas e direitos no trabalho | Trabalhista |
| RMC Cobrança Indevida | cobrança de cartão consignado (RMC) que a pessoa não pediu | Bancário / consumidor |
| Auxílio Doença | incapacidade temporária para o trabalho | Previdenciário |
| Pensão por Morte | cuidado com a burocracia no luto | Previdenciário |
| Acidentes em Geral | indenização por acidentes (cita carro e queda na calçada) | Cível / responsabilidade civil |
| Juros Abusivos | revisão de juros abusivos | Bancário / consumidor |
| Aposentadorias | planejamento e pedido de aposentadoria | Previdenciário |
| Revisão de aposentadoria | revisão do valor do benefício | Previdenciário |
| Inventário | processo de inventário e herança | Família e sucessões |
| Superendividamento | saída do superendividamento | Bancário / consumidor |

- Depois dos cartões: "Entre outras áreas do direito".
- *Interpretação*: seis dos doze cartões são previdenciários, e o foco aparece também no "segurado" e no carrossel. No redesign, as áreas podem ser agrupadas em quatro frentes (previdenciário; bancário e consumidor; trabalhista; cível e sucessões). "Auxílio-doença" hoje se chama, no INSS, benefício por incapacidade temporária; vale usar os dois nomes, porque o público procura pelo antigo.
- **Pendência 5**: confirmar a lista, a ordem e se o escritório tem título de especialista em alguma área.

## 6. Diferenciais declarados (nenhum comprovado)

O site afirma, em cinco cartões:

1. **Experiência e resultados**: mais de 3.000 processos concluídos com êxito, na via administrativa e na judicial.
2. **Equipe multidisciplinar**: mais de 25 profissionais, entre advogados, peritos, engenheiros, médicos e contadores.
3. **Atendimento personalizado**: presencial e a distância, com visitas técnicas.
4. **Tecnologia**: ferramentas digitais para agilizar os processos.
5. **Prioridade a grupos vulneráveis**: atendimento prioritário a pessoas com deficiência, idosos e pessoas com doenças graves.

Mais duas afirmações no bloco de avaliações: mais de 10 anos de atuação e centenas de clientes satisfeitos.

- *Interpretação*: o CNPJ é de 2023-06 e o site de 2023-11; os "mais de 10 anos" podem contar a carreira do titular antes da sociedade. Nada disso entra no redesign sem prova, e mesmo com prova os números 1 e 2 batem em regras da OAB (seção 9). Os itens 3 e 5 podem virar informação neutra ("atendimento presencial e on-line", "atendimento prioritário a idosos e pessoas com deficiência"), se confirmados. **Pendência 6.**

## 7. Equipe e história

- **Fato**: o site não dá nenhum nome de advogado, nenhum número de OAB, nenhuma foto de pessoa e nenhuma história. O único nome público é o do titular no cadastro do CNPJ (seção 1).
- **Fato**: a biblioteca de mídia tem uma foto de grupo recortada, sem uso na home (`IMG_0384-copiar-2.png`, id 18, 2023-11): oito pessoas comemorando, com balões que dizem frases como "Sentença procedente" e "Parabéns, concedido".
  - *Interpretação*: não dá para usar como está. Os balões celebram resultado de processo (o Provimento 205, art. 6º, proíbe), e não sabemos quem são as pessoas nem se a foto é do escritório ou da Asseprevi. **Pendência 7.**

## 8. Identidade visual atual (referência para o DESIGN.md da fase 2)

- **Cores do kit do Elementor** (`post-6.css`): primária azul-marinho `#031F47`; secundária `#54595F`; texto `#7A7A7A`; destaque amarelo-ouro `#DDB73B`.
- **Outras cores em uso** (`post-14.css` e estilos medidos na página): verde dos botões de WhatsApp `#1CA02E`; ouro escuro `#A78929`; texto dos cartões `#9C9C9C` (itálico); texto sobre o azul `#C0C0C0` e `#DFDFDF`; fundo claro `#FDFDFD`; sombras `rgba(0,0,0,.5)` e `rgba(0,0,0,.23)`.
- **Dourado do logo** (medido no PNG): degradê metálico de `#785B2A` (sombra) por `#A07935` (meio) e `#CEA564` até `#F1C788` (brilho). O `#DDB73B` do site é mais amarelo e mais chapado que o logo.
- **Fontes**: Roboto em tudo (títulos 900 em caixa alta de 33–39 px; títulos de cartão 600 de 24–32 px; texto 400 de 16 px; botões 500 de 18 px). O kit declara Roboto Slab como secundária, mas ela não aparece na página. O texto em círculo do logo usa uma sans geométrica não identificada (**pendência 8**).
- **Formas**: botões com 5 px de raio, cartões com 10 px e sombra.
- **Logo**: monograma "BM" (a perna do B forma um M), dourado metálico, dentro de um anel de texto "advogados associados" repetido. Há uma versão para fundo escuro (anel branco, 840 px), uma metálica pequena (359 px, bordas serrilhadas) e uma montagem com balança e martelo (não serve). Não há vetor público.
- **Imagens de fundo**: fotos de banco de imagem (estante de livros, colunas, mármore, padrão de hexágonos), com filtro azul nas faixas escuras. Nenhuma foto real do escritório, da equipe ou da cidade.

## 9. Publicidade da advocacia: regras, o que o site atual fere e o que o redesign evita

### Regras que valem para o site (resumo)

- **Código de Ética, art. 39**: a publicidade é só informativa, discreta e sóbria; não pode captar clientela nem mercantilizar a profissão. **Art. 7º**: proíbe oferecer serviços de forma a captar clientela.
- **Código de Ética, art. 40, IV**: proíbe divulgar a advocacia junto com outra atividade ou indicar vínculo entre elas. **Art. 42, IV**: proíbe divulgar listas de clientes e de demandas.
- **Código de Ética, art. 44**: a publicidade traz o nome do advogado ou da sociedade e o número de inscrição na OAB. Pode citar títulos acadêmicos, especialidades a que se dedica, endereço, e-mail, site, QR code, logotipo, foto do escritório, horário e idiomas.
- **Provimento 205/2021, art. 3º**: proíbe (I) falar de honorários, forma de pagamento, **gratuidade** ou desconto para captar cliente; (II) informação que induza a erro; (III) anunciar **especialidade sem título** certificado ou notória especialização; (IV) **frases persuasivas, de autoengrandecimento ou de comparação**. O § 1º pede divulgação sem ostentação e **sem incitar ao litígio** ou à contratação.
- **Provimento 205, art. 4º, § 2º**, e **art. 5º, § 3º**: vedada a menção a decisões e resultados obtidos. **Art. 5º, § 2º**: permite logomarca, fotos dos advogados e do escritório e identidade visual (proíbe os símbolos oficiais da OAB).
- **Provimento 205, art. 6º**: proíbe, na publicidade ativa, falar das dimensões, qualidades ou estrutura do escritório, e, em qualquer publicidade, **prometer resultado** ou usar **casos concretos** para oferecer serviço.
- **Provimento 205, art. 8º**: proíbe vincular a advocacia a outras atividades ou divulgá-las juntas.
- **Anexo do Provimento 205**: conteúdo sem resultados, clientes, valores ou gratuidade; chatbot só para primeiras dúvidas e encaminhamento, sem tirar a pessoalidade; anúncio por palavra-chave (Google Ads) só em resposta a uma busca e com palavras éticas.
- **Estatuto, art. 16, § 4º**: o nome da sociedade unipessoal é o do titular mais "Sociedade Individual de Advocacia".

### O que o site atual fere ou chega perto

| Onde | O que está lá | Regra | Peso |
|---|---|---|---|
| Abertura | "Somos especialistas" e "garantir sua justiça" | Prov. 205, art. 3º, III (especialista sem título comprovado) e art. 6º (promessa de resultado) | Fere |
| Cartões de área | "nossos especialistas", "equipe especializada" em vários cartões | Prov. 205, art. 3º, III | Fere, salvo título |
| Cartões de área | frases que garantem o direito, a indenização "que merece", recuperar "o que é seu" | Prov. 205, art. 6º | Fere |
| Cartões de área | ganchos que incitam ao litígio: perguntas como "Se acidentou?", "Dívidas te sufocando?", e o exemplo da queda na calçada | Prov. 205, art. 3º, § 1º; CED art. 7º | Chega perto |
| Botão do meio | "Começar análise gratuita" | Prov. 205, art. 3º, I (gratuidade para captar) | Fere |
| Diferenciais | o título "Diferenciais que nos destacam" e "alta performance", "altamente qualificados", "soluções eficazes e seguras" | Prov. 205, art. 3º, IV (autoengrandecimento e comparação implícita) | Fere |
| Diferenciais | "mais de 3.000 processos concluídos com êxito" | Prov. 205, art. 6º (resultado) e art. 3º, II (não comprovado) | Fere |
| Diferenciais | "mais de 25 profissionais", peritos, engenheiros, médicos e contadores | Prov. 205, art. 6º (estrutura do escritório) e art. 8º (outras atividades) | Chega perto |
| Avaliações | prints de avaliações com nome e foto de clientes, algumas contando o resultado do caso (benefício saiu em 30 dias, valor a receber) | Prov. 205, art. 6º e anexo (casos concretos e resultados); CED art. 42, IV; LGPD (dados de terceiros) | Fere |
| Avaliações | duas avaliações agradecem à Asseprevi | Prov. 205, art. 3º, II (induz a erro) e art. 8º; CED art. 40, IV | Fere |
| Ficha do Google | print de 2025 com 131 avaliações e "Scherer Center" | Prov. 205, art. 3º, II (dado desatualizado) | Chega perto |
| Página inteira | nenhum nome de advogado, nenhum número de OAB, e o nome público difere da razão social | CED art. 44; Estatuto art. 16, § 4º | Falta |

### O que o redesign precisa fazer

- Trazer no rodapé (e no "Quem somos") o nome do advogado responsável, o número da OAB/RS e o nome registrado da sociedade, com CNPJ se o escritório quiser.
- Trocar "especialistas" por "atuação em" ou "áreas de atuação", salvo título comprovado e informado pelo escritório.
- Descrever cada área pelo que ela é e pelos documentos e etapas, sem garantir resultado, sem pergunta-gancho, sem "o que é seu por direito".
- Chamadas neutras: "Falar com o escritório", "Agendar atendimento", "Enviar mensagem pelo WhatsApp". Nada de "grátis", "gratuito", "sem custo", preço ou desconto.
- Sem números de processos, clientes, anos ou equipe até haver prova; mesmo com prova, evitar números de resultado e de estrutura.
- Sem depoimentos nem prints de avaliações. No máximo um link discreto para a ficha do Google, como dado de localização ("Ver no Google Maps"), sem estrelas nem contagem como argumento. **Pendência 9.**
- Nada da Asseprevi nem de outra atividade.
- Fotos: só do escritório e dos advogados, com autorização; nada de ostentação, nada de comemoração de resultado.
- Tom: sóbrio, informativo e simples. O próprio princípio do escritório, falar a língua do cliente, cabe bem: frases curtas, sem juridiquês, sem exclamação e sem emoji.
- Conteúdo útil e permitido: "como funciona o atendimento" (o que levar, como é o primeiro contato), dúvidas frequentes informativas sobre cada benefício, endereço com mapa, horário, acessibilidade (há um ícone de acessibilidade na ficha do Google; confirmar).

## 10. Diagnóstico técnico do site atual (argumentos para o redesign)

- **Endereço seguro**: o certificado HTTPS existe e é válido (Let's Encrypt, emitido em 2026-10-02, vence em 2026-12-31), mas `http://baldezmoreira.adv.br/` abre sem redirecionar para o `https` (só o `www` redireciona). Quem chega pelo endereço sem "s" vê "Não seguro" no navegador.
- **Celular**: a página tem cerca de 8.400 px no celular (uns 10 telas de altura); os 12 cartões ficam um por linha; as avaliações são prints de texto miúdo que pedem "Toque para ampliar"; o logo vem antes da mensagem no topo.
- **Navegação**: não há cabeçalho, menu, âncoras nem rodapé com informações; telefone e e-mail não são clicáveis; dois números de WhatsApp diferentes; sem mapa interativo (a ficha do Google é uma imagem) e sem horário.
- **Busca no Google**: nenhum H1 (a página tem 19 H2, inclusive cada título de cartão); sem meta description; sem Open Graph (o link compartilhado no WhatsApp sai sem imagem nem resumo); sem dados estruturados de escritório (LegalService/LocalBusiness); 14 de 45 imagens sem texto alternativo; endereços no formato `?page_id=`; sem `robots.txt`; o mapa do site expõe a página de exemplo, a página vazia e o "Olá, mundo!" com formulário de comentários aberto (porta para spam).
- **Leitura e contraste**: o texto dos cartões em cinza `#9C9C9C`, itálico, com entrelinha de 17 px, fica em 2,5:1 sobre o cartão; os títulos amarelos `#DDB73B` sobre branco ficam em 1,9:1, e o texto branco no botão amarelo também; o botão verde fica em 3,4:1. Todos abaixo do mínimo de 4,5:1 (WCAG AA).
- **Peso e velocidade**: 60 requisições e cerca de 1,75 MB na home (1440 px); Roboto e Roboto Slab pedidas em 36 estilos; fundos de banco de imagem de 180 a 330 KB; dois contêineres do Google Tag Manager. Num celular simulado em 4G lento, com o processador 4 vezes mais lento: o primeiro conteúdo aparece em ~2,0 s, o maior em ~2,5 s e a carga termina em ~9,9 s. É uma medição nossa, não do PageSpeed (a cota da API acabou no dia); a velocidade não é o pior problema do site.
- **Manutenção**: WordPress 7.1.2, mas Elementor 3.18.2 (versão do fim de 2023, sem atualização desde então) e o plugin "pro-elements" 3.14.0 (redistribuição do Elementor Pro fora da licença oficial, atualização manual). A API pública lista os usuários do WordPress.
- *Interpretação*: o maior argumento de venda não é a velocidade. São três: (1) um site que respeita as regras da OAB, sem o risco de representação na seccional; (2) clareza: quem é o advogado, o que o escritório faz, como é o atendimento e onde fica; (3) celular e contato: menu, WhatsApp único, telefone que liga com um toque, mapa, horário e `https` forçado.

## 11. Arquivos baixados

Todos vieram da biblioteca de mídia pública do site (`https://baldezmoreira.adv.br/wp-content/uploads/…`, lista em `…/wp/v2/media`). Uso só na proposta até o escritório autorizar.

| Arquivo no repo | Origem | Observação |
|---|---|---|
| `public/brands/baldez-moreira/logo/baldez-moreira-selo-fundo-escuro.png` | `/2023/11/LOGO-FUNDOS-ESCUROS.png` (id 116, 840×840) | Monograma dourado + anel "advogados associados" em branco. Só funciona no escuro; é o que está na home. |
| `public/brands/baldez-moreira/logo/baldez-moreira-monograma.png` | recorte do mesmo arquivo (314×348) | Só o monograma "BM", sem o anel. Feito aqui; funciona no claro e no escuro. |
| `public/brands/baldez-moreira/logo/baldez-moreira-anel.png` | o mesmo arquivo, sem o monograma (840×840) | Só o anel de texto, branco. Feito aqui, para a camada que gira na abertura. |
| `public/brands/baldez-moreira/logo/baldez-moreira-selo-centro.png` | o mesmo arquivo, sem o anel (840×840) | Só o monograma, no mesmo quadro do anel, para empilhar os dois sem desalinhar. Feito aqui. |
| `public/brands/baldez-moreira/logo/baldez-moreira-selo-metalico-359.png` | `/2023/11/logo-pequeno.png` (id 92, 359×359; igual a `Sem-Título-1.png`, id 86) | Anel metálico com bordas serrilhadas, baixa resolução. Só referência. |
| `public/brands/baldez-moreira/fotos/equipe-recorte-2023.png` | `/2023/11/IMG_0384-copiar-2.png` (id 18, 1017×602) | Foto de grupo recortada, com balões que celebram resultado. Não usar como está (seção 7). |

Ficaram só em `.space/baldez-moreira/referencia/media/` (fora do git): os 12 ícones das áreas (512 px, de banco de ícones), os fundos de banco de imagem (estante, colunas, mármore, hexágonos), os prints das avaliações e das fichas do Google (Baldez Moreira e Asseprevi), um print de quadro do Miro com uma referência de layout, a montagem do logo com balança e o ícone do site (`cropped-LOGO-FUNDOS-ESCUROS.png`, que corta o anel pela metade).

## Pendências

1. **Nome e registro**: qual nome usar na página e no rodapé? O site diz "Baldez & Moreira Advogados Associados", o CNPJ diz "Baldez Moreira Sociedade Individual de Advocacia" com um titular só. Confirmar se existe outra sociedade registrada na OAB/RS com o nome do site, o número de registro da sociedade e o nome e a OAB de cada advogado que vai aparecer.
2. **Asseprevi**: qual é a relação com o escritório (mesmo telefone e mesmo endereço de cadastro)? O redesign deixa a Asseprevi de fora e não usa avaliações que falam dela.
3. **Redes sociais**: o escritório tem Instagram, Facebook ou LinkedIn? O site não linka nenhum e a busca não achou.
4. **Horário**: confirmar dias e horas (os prints antigos do Google sugerem 8h às 17h30) e se atende on-line.
5. **Áreas**: confirmar a lista, a ordem, o que entra em "entre outras áreas" e se há título de especialista (pós-graduação) em alguma área.
6. **Afirmações do site**: anos de atuação, número de profissionais e de processos, visitas técnicas, ferramentas digitais. Sem prova não entram; com prova, só as que não ferem as regras (seção 9).
7. **Fotos**: pedir fotos reais do escritório (fachada da Galeria Basile, recepção, salas) e dos advogados, com autorização de uso. A foto de grupo de 2023 não serve.
8. **Logo**: pedir o arquivo vetorial (SVG, AI ou PDF), a fonte do anel de texto e uma versão para fundo claro. Confirmar com o escritório (e com a Agência Costa, se foi ela que fez) o direito de uso da marca no redesign.
9. **Google**: nota 5,0 com 237 avaliações e categoria "Serviços jurídicos", segundo o usuário (Google Maps, 2026-10-03). Conferir o link exato da ficha e decidir com o escritório se ela aparece só como link de localização.
10. **WhatsApp**: qual número fica? Hoje há dois, (51) 3037-3302 e (51) 3199-4456, e o fixo (51) 3589-3302.
11. **Endereço do CNPJ**: o cadastro ainda aponta a R. São Joaquim, 792, sala 802. Não é tarefa nossa, mas vale avisar o escritório para manter os dados iguais em todo lugar.
12. **Hospedagem e acesso**: quem administra o WordPress hoje (a Agência Costa?) e se o escritório tem o acesso de administrador, para conectar o Space e publicar.

## 12. Textos da Home nova no Space (2026-10-03)

Página "Home" do projeto "Baldez & Moreira" no Space. Fatos vêm das seções acima; o que é **proposta de texto** (escrita por nós, a confirmar com o escritório) está marcado.

1. **Cabeçalho**: monograma + "Baldez & Moreira / Advogados Associados" em texto. Menu: Áreas · Como funciona · O escritório · Perguntas · Contato. Botão "WhatsApp".
2. **Abertura**: rótulo "Advocacia em São Leopoldo". Título: "Advocacia que fala *a sua língua*." (vem do princípio do próprio escritório, "Falamos a língua do nosso cliente"). Texto: as frentes de atuação e a promessa de explicar cada etapa com palavras simples (resumo do bloco "Transparência e responsabilidade"). Botões "Falar no WhatsApp" e "Ver as áreas". Faixa de fatos: Galeria Basile, Centro · Google Maps 5,0 · 237 avaliações (pendência 9) · WhatsApp (51) 3037-3302.
3. **Áreas** — "Em que momento da vida você está?": as 12 áreas do site atual como situações da vida (*proposta de texto*), em quatro grupos: INSS e previdência (6), Bancos e dívidas (3), Trabalho (1), Acidentes e família (2). Cada situação abre o WhatsApp com o assunto. Fecho: "Outro assunto? O escritório atua em outras áreas do direito." (do "Entre outras áreas do direito" do site).
4. **Como funciona**: a frase do escritório em destaque, "Falamos a língua do nosso cliente." Quatro etapas do primeiro atendimento (*proposta de texto*): você conta o que aconteceu; o escritório pede os documentos; você entende os caminhos; você decide se segue. Lista "se tiver, leve" (*proposta*: documento com foto e CPF, comprovante de residência, carteira de trabalho, CNIS e cartas do INSS, laudos, contratos e extratos do banco). Linha de atendimento prioritário a idosos, pessoas com deficiência e com doenças graves (afirmação do site atual, pendência 6).
5. **O escritório** — "Um escritório no Centro de São Leopoldo.": atendimento no escritório e a distância (o site atual fala em atendimento presencial e remoto). "Ficha do escritório": nome do site, razão social, CNPJ, advogado responsável (titular no cadastro), "Inscrição na OAB/RS: número a confirmar", endereço. Nota: publicidade informativa, conforme o CED e o Provimento 205/2021.
6. **Perguntas** — "Dúvidas comuns, em palavras simples." (*proposta de texto*, respostas gerais e informativas): começar sem ir ao escritório; o que levar; o novo nome do auxílio-doença (auxílio por incapacidade temporária, desde a EC 103/2019); o que é o BPC/LOAS (Lei 8.742/1993); o que é a RMC no cartão consignado; o que é superendividamento (Lei 14.181/2021). Nenhuma fala de preço, prazo ou resultado.
7. **Contato** — "Conte o que *aconteceu*.": endereço completo, WhatsApp, telefone, e-mail, Google Maps, "Como chegar" e mapa nativo do Google. Sem horário (pendência 4).
8. **Rodapé**: marca, navegação, atendimento e a coluna "Escritório" (nome, razão social, CNPJ, responsável, "OAB/RS a confirmar"); "© 2026 … Publicidade informativa, conforme o Provimento 205/2021 da OAB."
9. **WhatsApp flutuante** no canto, para (51) 3037-3302.

O que saiu do site atual de propósito: "especialistas", "garantir sua justiça", "análise gratuita", os números (3.000 processos, 25 profissionais, 10 anos, centenas de clientes), os prints de avaliações, a foto de grupo com balões, as fotos de banco de imagem e os ganchos de captação.

### Pendências novas da Home

13. **Número da OAB/RS** do advogado responsável (aparece "a confirmar" na ficha e no rodapé) e se outros advogados devem aparecer.
14. **Etapas do primeiro atendimento, lista de documentos e respostas das perguntas**: são propostas nossas; o escritório confirma ou corrige.
15. **Atendimento a distância e prioridade a grupos vulneráveis**: confirmar que valem do jeito escrito.
