# Stemmer Advogados Associados — COPY.md

**Prospecto, não é cliente.** Este arquivo junta o que é público sobre o escritório (cada fato com a fonte), a análise do site atual pelas regras de publicidade da OAB, a medição dos anúncios que o site tem hoje e os textos da Home nova montada no Space para mostrar e vender o redesign. Nada aqui foi confirmado pelo escritório. Lido em 2026-10-03.

Regra: fato só entra na página se estiver aqui com fonte. Interpretação e proposta ficam marcadas como tal. O que falta está em §10.

## 1. Identificação

| Item | Valor | Fonte |
|---|---|---|
| Nome | Stemmer Advogados Associados | site (`<title>`, rodapé) e Receita Federal |
| Razão social | STEMMER ADVOGADOS ASSOCIADOS | https://brasilapi.com.br/api/cnpj/v1/04641011000101 |
| CNPJ | 04.641.011/0001-01 | idem |
| Natureza | Sociedade Simples Limitada; início em 30/11/1998; situação ativa | idem |
| Sócios administradores | Carlos Alberto Stemmer (desde 1998) e Gabriel Lazzaretti Pacheco (desde 2013) | idem (quadro de sócios) |
| Endereço | Rua São José, 195, Bairro São José, São Leopoldo (RS), CEP 93040-000 | site (cabeçalho e rodapé), Receita e ficha do Google Maps |
| Desde | "atuando desde 1996 em São Leopoldo e região" | rodapé e "Quem Somos" de https://stemmeradvogados.com.br/ |
| Google | nota 4,9 com 48 avaliações, categoria "Advogado" | ficha do Google Maps (leitura do usuário, 2026-10-03; id `ChIJXUM0IVNoGZURfRqCs_Cuu94`) |

O CNPJ é de 1998 e o site diz "desde 1996": o escritório pode ser anterior ao CNPJ. A Home nova usa "desde 1996", que é a frase do próprio escritório (pendência §10).

## 2. Contatos (site atual)

- WhatsApp: (51) 98108-2503 (`api.whatsapp.com/send?phone=5551981082503` nos botões; plugin Joinchat no canto).
- Telefone: (51) 3572-0891. **O link do telefone em todas as páginas está errado**: `tel:51935720891` (um 9 a mais), então quem toca no número pelo celular liga para outro número. A Home nova usa `tel:+555135720891`.
- E-mail: contato@stemmeradvogados.com.br.
- Telefone na Receita: (51) 3568-6270 (não usado).
- Horário: **não é público** no site.
- Redes: Facebook "Stemmer Advogados" (facebook.com/stemmeradv, resultado de busca; não aberto). O site não tem links de redes.

## 3. Equipe (página "Quem Somos" e páginas de área)

| Nome | OAB | Fonte |
|---|---|---|
| Carlos Alberto Stemmer | OAB/RS 31.069 | https://stemmeradvogados.com.br/quem-somos/ (sócio administrador na Receita) |
| Gabriel Lazzaretti Pacheco | OAB/RS 73.619 | idem (sócio administrador na Receita) |
| Gelvani Deuschle | OAB/RS 70.258 | idem |
| Martiela A. Tavares da Silva | OAB/RS 74.190 | idem |

Formação, especializações e tempo de cada um não aparecem no site: não entram. Fotos reais do site (retratos de 2025/03 e a equipe na fachada, hero da home): direito de uso é pendência.

## 4. O que o escritório faz (site atual)

- Áreas: **Direito do Trabalho** e **Direito Previdenciário**. "Atuação em todas as fases do processo", "acordos extrajudiciais ou ações judiciais", "atendimento presencial e de forma virtual" / "atendimento 100% online".
- Trabalho (lista do site): demissão sem aviso prévio, assédio no trabalho, desvio de função, atraso no pagamento (e horas extras), danos morais, periculosidade, acidente de trabalho, doença profissional; e reconhecimento de vínculo (página de anúncio de 2026-08).
- Previdenciário (lista do site): revisão de benefícios, aposentadoria negada, pensão por morte, auxílios não concedidos, planejamento previdenciário, problemas com o INSS, auxílio-acidente.
- Blog: seis artigos (horas extras, auxílio-acidente, acidente de trabalho, reconhecimento de vínculo, gestante no trabalho, estabilidade da gestante), de 2025-02 a 2025-04.

### Os anúncios

O site tem páginas feitas para o Google Ads (título "#01 – LANDING PAGE – GOOGLE ADS – …"): advogado trabalhista (2025-03), auxílio-acidente (2025-03), advogado previdenciário (2025-05) e reconhecimento de vínculo (`/reconhecimento-de-vinculo-2/`, 2026-08, a mais nova e a mais cuidadosa: explica os quatro requisitos do vínculo e traz o aviso de que o conteúdo não garante resultado). Cada uma tem a sua página de "obrigado". Essas são, provavelmente, as áreas dos anúncios: as situações da Home nova começam por elas.

## 5. Medição dos anúncios no site atual (não perder ao publicar)

- Tag do Google Ads na página: **`AW-11404595898`** (`gtag('config', 'AW-11404595898')`).
- Google Tag Manager **`GTM-TFWRBZ5W`**: conversão do Ads `AW-11404595898` (rótulo `naCTCO75svgYELqlkb4q`) em clique de link que contém `wa.me` e no evento do Joinchat.
- Google Tag Manager **`GTM-TN9V5L8X`**: outra conta do Ads (`AW-16919576754`, várias conversões), GA4 `G-M0N209PZ8X` e o Pixel da Meta `1668545810407995`. Conta como conversão: cliques em elementos com os ids `wpp_menu`, `wpp_pagina_inicial`, `wpp_quem_somos` e outros por página; o botão do Joinchat; links que começam com `https://wa.me/5551981082503`; e as páginas de obrigado (`/obrigado-contato/`, `/advogado-trabalhista-lp-a/obrigado-trabalhista/` etc.).
- Na Home nova: todos os links do WhatsApp usam `https://wa.me/5551981082503?text=…` (os dois contêineres contam); o botão do cabeçalho leva o id `wpp_menu` e o da abertura `wpp_pagina_inicial` (`button_css_id`); o formulário redireciona para `/obrigado-contato/`. Ao publicar: manter o `gtag` do `AW-11404595898` e os dois contêineres do Tag Manager (são do tema/plugin, não da página), e conferir no Tag Manager se as conversões disparam.
- O plugin Joinchat põe o botão flutuante dele em todas as páginas: ao publicar, escolher entre ele (que o Tag Manager já conta) e o botão flutuante da Home nova. Não deixar os dois.

## 6. Identidade visual e site atual

- **Logo** (`wp-content/uploads/2025/02/Logo-Stemmer-Advogados-Associados-Branco.png`, 5042 × 1489, tinta branca): símbolo "S" de dois arcos, STEMMER em letras largas e espaçadas, "ADVOGADOS ASSOCIADOS" estreito. O mesmo letreiro está em letras de aço na fachada, com o número 195. Cópias em `public/brands/stemmer-advogados/logo/` (o preto e o símbolo são derivados nossos).
- **Cores** (`post-5.css`, kit do Elementor): primária `#00080D`, texto `#3A3E40`, destaque cinza `#BCBCBC`, branco; botões verdes do WhatsApp (`#009B15`).
- **Fonte**: Sora (enviada ao WordPress como fonte própria; o Elementor está com o Google Fonts desligado).
- **Fotos reais** em `public/brands/stemmer-advogados/fotos/`: `equipe-fachada.webp` (recorte de `2025/03/BG-Hero-PC-Stemmer-Advogados-Pagina-Inicial-4-nova.jpg`), `fachada-195.webp` (recorte de `2025/02/BG-Hero-PC-Stemmer-Advogados-Pagina-Inicial-2_11zon.jpg`) e os retratos `carlos-stemmer.webp`, `gabriel-lazzaretti-pacheco.webp`, `gelvani-deuschle.webp`, `martiela-tavares-da-silva.webp` (recortes de `2025/03/Dr.-Carlos-2.png` etc.). As fotos de banco de imagem (escritório genérico, obra, idoso, reunião, cidade) não foram usadas.
- **Técnica**: WordPress 7.1.2, Elementor 4.3.3 + Pro, tema Hello Elementor, Happy Addons (e Pro), Joinchat, reCAPTCHA no formulário. Rodapé: "Desenvolvido por Xeque Lab" (a biblioteca de mídia tem até um mapa da Ferreira & Bordinhão, outro site da agência).
- **O que tem de melhor**: a equipe real na frente da própria casa, os quatro nomes com OAB, "desde 1996", o endereço escrito no topo, a página de vínculo de 2026 (clara e com aviso de que não garante resultado).
- **O que falta**: a abertura não diz o que o escritório faz (o título é "Advogados Associados"; no celular a equipe nem aparece); as áreas são duas fotos de banco com "Saiba Mais"; os botões dizem "Fale Agora Com Um Especialista" e "Quero Garantir Meus Direitos!"; o telefone liga para o número errado; não há perguntas respondidas, mapa ou horário na home; avaliações do Google em destaque com relato de caso.

## 7. Regras de publicidade da OAB (Código de Ética arts. 39–47 e Provimento 205/2021) no site atual

Para o texto novo evitar e, na conversa, ser dito como cuidado, nunca como acusação:

1. **Depoimentos de clientes** (widget Trustindex com dez avaliações em quase todas as páginas), um deles com **caso concreto e resultado** (pensão por morte revertida, "saímos vitoriosos"), e o selo "apenas as melhores empresas". A publicidade da advocacia deve ser informativa; depoimento, caso e comparação são o ponto mais sensível. A Home nova não usa avaliações; a nota do Google aparece só como fato discreto em "Onde fica" (pendência).
2. **"Especialista" / "especializado"** em botões e títulos ("Fale agora com um Especialista", "Advogados especializados"): só com título de especialização comprovado de quem atende.
3. **Promessa de resultado**: "resolve seu caso com eficiência", "Quero Garantir Meus Direitos!", "garantir que você receba o valor correto", "cobrar o que é seu", "foco em resultados".
4. **Autoelogio**: "advogados altamente qualificados", "excelência jurídica", "a melhor solução para o seu caso".
5. **Chamada de urgência**: "Atendimento Imediato", "Fale Agora", e o balão do Joinchat ("precisa falar agora com um advogado especialista? Nossos profissionais estão online e prontos para lhe atender!").
6. O que está certo: OAB de cada advogado visível, sem preço, sem "consulta grátis"; a página de vínculo de 2026 tem o aviso de que o conteúdo é informativo e não garante resultado.

## 8. Textos da Home nova (Space, projeto "Stemmer Advogados", página Home)

Tudo informativo. Situações escritas como a pessoa pensaria; o nome da área vem embaixo. Etapas, lista de documentos e respostas das dúvidas são **propostas** para o escritório confirmar.

- **Cabeçalho.** Logo branco no preto; menu (Situações, Primeiro contato, Equipe, Onde fica, Dúvidas); "Conversar pelo WhatsApp" (id `wpp_menu`).
- **Abertura.** Rótulo: "Direito do trabalho e INSS". Título: "Advocacia trabalhista e previdenciária em São Leopoldo." Texto: "Demissão, trabalho sem carteira assinada, horas extras, acidente, benefício negado pelo INSS, aposentadoria. Conte a sua situação pelo WhatsApp: o atendimento é no escritório ou online." Ações: "Conversar pelo WhatsApp" (id `wpp_pagina_inicial`) e "Ver as situações". A ficha (cartão de ponto): 01 Desde · 1996; 02 Endereço · Rua São José, 195 · Bairro São José; 03 Áreas · Trabalho e INSS; 04 Atendimento · Presencial e online. Ao lado, a foto da equipe na fachada.
- **Situações** ("Em que ponto você está?"): dois registros. **No trabalho**: 01 "Trabalhei sem carteira assinada." (reconhecimento de vínculo), 02 "Fui demitido e não sei se recebi tudo." (rescisão e aviso prévio), 03 "O salário atrasa ou as horas extras não são pagas." (horas extras e atraso de salário), 04 "Sofro assédio ou trabalho fora da minha função." (assédio, danos morais e desvio de função), 05 "Me acidentei ou adoeci por causa do trabalho." (acidente, doença profissional e periculosidade). **No INSS**: 06 "Fiquei com sequela de um acidente." (auxílio-acidente), 07 "O INSS negou o meu benefício." (auxílios e aposentadoria negados), 08 "Quero saber quando e como me aposentar." (planejamento previdenciário), 09 "Acho que o meu benefício foi calculado errado." (revisão de benefício), 10 "Perdi quem sustentava a casa." (pensão por morte). A linha inteira abre o WhatsApp com o assunto ("Conversar"). Texto de apoio: "Encontre a sua situação e mande uma mensagem com o assunto já escrito. Cada caso depende da análise dos documentos." Embaixo: "Não encontrou a sua situação? Escreva em poucas linhas: o escritório diz se é um assunto que atende." + "Mandar uma mensagem".
- **Primeiro contato** ("Como começa o atendimento."): "O que você contar fica em sigilo profissional, um dever do advogado previsto no Estatuto da Advocacia e no Código de Ética da OAB."; três passos (01 Uma mensagem, pelo WhatsApp ou por telefone · 02 A conversa, com um advogado do escritório, na Rua São José, 195, ou online, por vídeo · 03 O caminho, possibilidades e honorários antes de qualquer decisão) e "O que separar" (carteira de trabalho, contracheques e termo de rescisão, extrato do FGTS, extrato do INSS (CNIS) e cartas do INSS, atestados, laudos e exames, mensagens, fotos e nomes de testemunhas; "Não tem tudo? Comece assim mesmo: a conversa mostra o que falta."). **Proposta.**
- **Equipe** ("Quem atende você."): "A Stemmer Advogados Associados atua em direito do trabalho e previdenciário em São Leopoldo e região desde 1996. O atendimento é na Rua São José, 195, e online." Os quatro com foto, nome e OAB; Carlos e Gabriel como "Advogado · sócio" (Receita), Gelvani e Martiela como "Advogada".
- **Onde fica** ("A casa do 195, no bairro São José."): endereço com CEP, WhatsApp, telefone (com o link certo), e-mail, "Atendimento presencial e online. Combine o horário pelo WhatsApp ou por telefone.", "4,9 no Google · 48 avaliações" (link para a ficha), "Como chegar", a foto da fachada ("A casa branca com o nome Stemmer e o número 195 na fachada.") e o mapa nativo.
- **Dúvidas** ("Perguntas de quem trabalha e de quem depende do INSS."): prazo da ação trabalhista (dois anos depois do fim do contrato, alcançando os últimos cinco anos; CF art. 7º, XXIX), vínculo sem carteira (os quatro requisitos, CLT art. 3º, como na página de anúncio do escritório), o que conferir na rescisão, auxílio-acidente (Lei 8.213/1991, art. 86), benefício negado (recurso ao INSS em 30 dias ou ação judicial), atendimento online, sigilo, honorários (depois da primeira conversa). **Respostas gerais, para o escritório revisar.**
- **Chamada final** (faixa verde): "Conte em que ponto você está." + "Uma mensagem curta com o assunto basta para começar a conversa. Se preferir, deixe o seu contato no formulário e o escritório retorna." + WhatsApp e "Ligar (51) 3572-0891"; formulário "Prefere que o escritório chame você?" (nome, WhatsApp, assunto: direito do trabalho / INSS e aposentadoria / outro, mensagem opcional), com envio para contato@stemmeradvogados.com.br, redirecionamento para `/obrigado-contato/` e o aviso "Não mande documentos nem detalhes do caso por aqui".
- **Rodapé.** Logo, "Advocacia trabalhista e previdenciária em São Leopoldo, desde 1996.", endereço, contatos, a equipe com OAB, "Stemmer Advogados Associados · CNPJ 04.641.011/0001-01 · Sociedade de advogados", "Conteúdo informativo, conforme o Código de Ética e Disciplina da OAB e o Provimento 205/2021." e a política de privacidade.
- **Detalhes da página** (`space details`): título "Início", endereço `inicio` (o mesmo da home atual), título SEO "Advocacia trabalhista e previdenciária em São Leopoldo | Stemmer Advogados", palavra-chave "advogado trabalhista São Leopoldo".

## 9. Para a conversa de venda (o que achamos)

- O título da abertura hoje é "Advogados Associados": quem chega pelo anúncio não lê "trabalho" nem "INSS" na primeira tela, e no celular a foto da equipe nem aparece.
- O telefone (51) 3572-0891 liga para `51935720891` em todas as páginas.
- Duas contas do Google Ads e dois contêineres do Tag Manager: a página nova mantém os mesmos links e ids que eles contam.
- A melhor peça do site é a foto real da equipe na fachada do 195: a Home nova abre com ela.

## 10. Pendências (confirmar com o escritório)

1. "Desde 1996" (site) e o CNPJ de 1998: qual data usar.
2. A equipe de hoje: os quatro do site continuam? Papéis (sócios, associados) e se Gelvani e Martiela querem o cargo escrito.
3. Horário de atendimento (não é público no site).
4. Direito de uso das fotos (equipe na fachada, fachada, retratos) e, se houver, o arquivo original da foto da equipe sem o degradê escuro.
5. Arquivo oficial do logo (vetor) e a versão em tinta preta.
6. Nota do Google (4,9 · 48): manter como fato discreto?
7. Etapas do primeiro contato, lista de documentos e respostas das dúvidas: propostas, para o escritório ajustar.
8. Medição ao publicar: manter `AW-11404595898`, `GTM-TFWRBZ5W` e `GTM-TN9V5L8X`; conferir as conversões (ids `wpp_menu` e `wpp_pagina_inicial`, links `wa.me`, página `/obrigado-contato/`); decidir entre o botão do Joinchat e o flutuante da página.
9. Fontes ao publicar: o Elementor do site está com o Google Fonts desligado; instalar a Encode Sans Expanded como fonte própria (a Sora já está) ou ligar o Google Fonts.
10. Formulário: e-mail de destino e o reCAPTCHA (o site atual usa); texto da política de privacidade (o endereço da página tem um erro de digitação: `/politica-de-privacideade/`).
11. Quem cuida do site e dos anúncios hoje (o rodapé credita a Xeque Lab): a proposta é a página, não tirar a agência.
