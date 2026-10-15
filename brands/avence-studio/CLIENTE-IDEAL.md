# Avence Studio — o cliente ideal e o diagnóstico de captação

Escrito em 2026-10-14, a pedido do usuário: "escrevesse um pouco melhor sobre o CP que vai comprar esse produto da gente", e "o cara tem um site para gerar demanda, não para ser bonito". Vale para a Prospecção, o funil, o Diagnóstico de site (`/crm/diagnostico`), os roteiros de venda (`draftOffer`) e a futura página pública de diagnóstico.

O que tem fonte está marcado. O resto é **hipótese**, para confirmar nas primeiras conversas (seção 6).

## 1. Quem compra

**O dono de um negócio local de serviço que já paga para levar gente ao site, e o site não devolve conversa no WhatsApp.**

| Traço | O que sabemos | Fonte |
|---|---|---|
| Negócio | Serviço profissional ou de saúde, com hora marcada e valor alto por cliente: advocacia, odontologia, clínicas, estética, fisioterapia, nutrição, contabilidade, arquitetura, imobiliária. Um cliente novo paga o site. | nichos da Prospecção; o "um cliente paga" é hipótese |
| Quem decide | O dono, o sócio ou o doutor. Sem equipe de marketing. | hipótese (todos os prospectos até aqui) |
| Site | Já tem, feito anos atrás por uma agência ou freelancer, e ninguém cuida. Entre os advogados de São Leopoldo que anunciam, 7 de 10 estão em WordPress, 5 com Elementor. | busca de 2026-10-03 (86 sites lidos) |
| **Anuncia** | Tem a tag do Google Ads ou o pixel da Meta no site. É o sinal mais forte: ele já gasta todo mês para levar gente a uma página que não foi feita para virar contato. 12% dos advogados de São Leopoldo; 16% da amostra de nutricionistas. | busca de 2026-10-03; tese do usuário: "só tem site quem faz anúncio e por isso compram" |
| Contato | Acontece no WhatsApp. Para ele, "lead" é mensagem no WhatsApp, não formulário. | sites lidos (botões `wa.me`, Joinchat); o formulário da Avence pergunta "principal ação do site: gerar leads" |
| Profissão regulada | OAB, CFM, CFO: tem medo de errar na publicidade. Nós já escrevemos dentro das regras. | os 9 escritórios trabalhados |

**O que ele diz** (hipóteses de linguagem):
- "O site não traz cliente."
- "O anúncio gasta e não vem contato." / "Vem gente perguntando preço, gente que não é meu cliente."
- "Tenho vergonha de mandar o link do site."
- "Para mudar uma vírgula preciso pedir para a agência."
- "Não sei se o site funciona."

**Com o que ele não se importa:** versão do WordPress, PHP, plugins, H1, texto alternativo, "SEO técnico". Se o site da versão 3 traz cliente, ele não troca. Ninguém paga R$ 1.000 para atualizar o WordPress. (O usuário, 2026-10-14.)

**O que faz ele comprar** (hipóteses, do jeito que já trabalhamos):
1. Ver o próprio site pelos olhos de quem chega do anúncio, no celular, e perceber onde o contato se perde.
2. Ver a versão nova pronta, não um orçamento.
3. Saber quantos contatos o site traz. Hoje ele não sabe.
4. Risco baixo: preço fechado, mesmo WordPress, mesmo endereço, o anúncio continua medindo, a versão atual fica guardada.

**Quando ele está pronto** (hipóteses): começou ou aumentou o anúncio; o resultado do anúncio caiu; um concorrente fez site novo; entrou um sócio ou mudou a marca; a agência sumiu.

**Quem não é, por agora:**
- Quem não anuncia e vive de indicação. Não sente a dor: o site é um cartão de visita. Pode comprar, mas a venda é lenta.
- Quem só tem Instagram e não quer site.
- Empresa com equipe de marketing ou agência de performance que já faz landing pages.
- Loja virtual: a conta é outra (catálogo, carrinho, frete).
- Quem quer "atualizar o WordPress": é manutenção, não esta venda.

## 2. O que vendemos para ele

Nada de "redesign" ou "atualização": **uma página que transforma quem chega (do anúncio ou do Google) em conversa no WhatsApp**, entregue pronta no WordPress que ele já tem.

- O preço (padrão do funil, R$ 1.000) se explica com contato: um cliente novo paga a página. Nunca com tecnologia.
- A atualização do WordPress e dos plugins vai junto como cuidado da entrega, com cópia de segurança antes. Nunca é argumento.
- O plano mensal só se sustenta se mostrar resultado: quantos contatos o site trouxe no mês e um ajuste no que não funcionou. (Hipótese de oferta; o que entra no plano está em aberto no COPY.md.)

## 3. O diagnóstico de captação

Uma pergunta só: **quem chega pelo celular entende, confia e chama no WhatsApp?** Sete perguntas que o dono entende sem explicação. Desde 2026-10-14 a tela `/crm/diagnostico` responde as sete no app local (servidor de dev): a foto do celular vem do Edge desta máquina e a leitura do texto, do Claude Code desta máquina. No app publicado, só a leitura rápida (seção 4, "O que falta").

| # | Pergunta para o dono | Como medir | Como a tela mede (app local) |
|---|---|---|---|
| 1 | Em 5 segundos, quem chega entende o que vocês fazem, para quem e onde? | O texto da primeira tela (título, subtítulo, botões), lido por IA. Sem título, ou título genérico ("Bem-vindo", só o nome, um slogan), já conta. | O Claude Code lê a foto da primeira tela e os textos (`clear`, `understood`); sem título na primeira tela já é "não". |
| 2 | Dá para chamar no WhatsApp sem procurar? | Botão do WhatsApp na primeira tela ou flutuante; mensagem já escrita no link; quantas rolagens até o primeiro botão. | Os links `wa.me` e os botões flutuantes de plugin, com a posição no celular: à vista, ou depois de N rolagens. |
| 3 | A página aparece rápido no celular? | Tempo até a primeira tela aparecer num celular (PageSpeed do Google, perfil de celular). | O LCP no Edge com 4G lento e processador 4× mais lento (as condições do teste de celular do Google). Varia entre leituras, conforme o servidor do site responde na hora: 2,3 a 4,1 s no mesmo site. |
| 4 | O texto fala do cliente ou da empresa? | IA: frases sobre o problema de quem chega contra "nós, somos, excelência, tradição, soluções"; frases que serviriam para qualquer empresa. | O Claude Code (`focus`, trechos citados). |
| 5 | Mostra por que confiar? | Fotos reais ou de banco de imagem (IA), endereço ou mapa, nota do Google, quem atende, registro (OAB, CRM…). | Regras na página (avaliações, mapa, endereço, registro, depoimentos, tempo de atuação, CNPJ) e, com a leitura do texto, os sinais que o Claude Code achou. Foto real ou de banco ainda não. |
| 6 | Você sabe quantos contatos o site traz? | Tag do Google Ads, pixel ou Analytics, e se o clique no WhatsApp é medido. Quando o Tag Manager esconde, fica "a confirmar". | As tags carregadas de verdade, inclusive as que vêm pelo Tag Manager (`google_tag_manager`, `fbq`). Se o clique no WhatsApp conta fica "a conferir". |
| 7 | O site parece de hoje? | Ano no rodapé, celular, cadeado, sinais de site antigo (slider, construtor antigo). | Celular, cadeado, ano no rodapé, construtor antigo, ícone da aba e aviso de cookies cobrindo a tela. |

**Só para a equipe**, nunca no relatório do dono: versões do WordPress, do Elementor e do PHP, tema, plugins e número de páginas. Servem para estimar o trabalho e o risco da troca. (A tela já separa esse bloco desde 2026-10-14.)

## 4. A visualização que vende

O relatório, de cima para baixo (no `/crm/diagnostico` desde 2026-10-14, menos o passo 4, que é da página pública):

1. **A primeira tela dele, no celular**, numa moldura de telefone, com marcas numeradas em cima do que perde contato: "1. O que vocês fazem?", "2. O WhatsApp só aparece depois de 4 rolagens", "3. A página leva 6,8 s para aparecer".
2. **As sete perguntas**, uma linha cada, com ✓ ou ✗, nas palavras dele.
3. **Como a primeira tela poderia ser**: o mesmo celular com um título e um subtítulo reescritos pela IA a partir do texto do próprio site, e o botão "Falar no WhatsApp". Sem inventar fato: só o que o site já diz.
4. **O próximo passo**: "Quer ver a página inteira nova? Mandamos no seu WhatsApp, sem custo." O contato vira uma oportunidade na Fila da página, e o ▶ do cartão monta a página.

A primeira mensagem do roteiro abre com o pior ponto achado (`pitchOf`, na ordem WhatsApp, entender, velocidade, medição, foco, confiança, site parado), e a nota no CRM guarda as sete respostas e a reescrita.

Para quem anuncia, uma frase no topo da página pública: "Você paga pelo clique. É o site que decide se ele vira conversa." Nenhum número de mercado inventado: só o que medimos no site dele.

**O que falta para o app publicado e a página pública:**
- **Foto da página no celular.** O PageSpeed do Google entrega a foto e o tempo, e é grátis com chave (a cota sem chave esgota: deu 429 em 2026-10-14). A posição do botão do WhatsApp precisa de um navegador de verdade, como o Edge do app local, ou de um serviço de captura (decisão de custo).
- **Leitura do texto por IA.** A chave `ANTHROPIC_API_KEY` no Supabase, a mesma pendente do "Escrever textos". O custo é de centavos por diagnóstico. No app local, o Claude Code da máquina faz a leitura sem chave.
- **Página pública.** A função `site-diagnostico` passa a aceitar visitante sem conta, com limite de uso por endereço e por dia, e grava o contato como cliente no CRM.

## 5. O que falar, e o que não falar

**Falar:** contatos, WhatsApp, celular, anúncio, "quem chega", "em 5 segundos", "hoje você não sabe quantos contatos o site traz". Mostrar mais do que explicar.

**Não falar:** WordPress, Elementor, PHP, plugin, SEO, H1, responsivo, "moderno", "bonito". Não dizer que o site é feio: dizer o que ele faz perder.

**Nunca:** prometer número de contatos ou de clientes; falar mal da agência atual (é uma versão nova da página, e quem cuida pode continuar cuidando); usar as regras do conselho como acusação.

Primeira mensagem, para quem anuncia (o roteiro do funil já segue esta linha):

> Olá! Aqui é [seu nome], da Avence Studio. Vi que vocês anunciam no Google, e é para o site que o anúncio leva as pessoas. Reparei que quem chega pelo celular não acha um botão de WhatsApp na página inicial. Fizemos uma versão nova da página de vocês, já pronta. Posso te mandar o link para ver no celular?

## 6. Para confirmar nas primeiras conversas

1. O dono sabe quantos contatos o site traz por mês? E quanto investe em anúncio?
2. A frase que ele usa para o problema: "não traz cliente", "traz gente errada", "tenho vergonha do site"?
3. Quem decide e quem paga: o dono sozinho, os sócios, a agência que cuida do anúncio?
4. O preço que fecha sem negociar: R$ 1.000? R$ 350 (o outro valor que o usuário citou)?
5. O plano mensal com relatório de contatos interessa?
6. A versão nova pronta foi o que fez ele responder?
