---
name: Ferreira & Bordinhão Advogados Associados
description: Escritório de direito do trabalho e previdenciário (também família e consumidor) dos sócios Joana Ferreira e Rodolfo Bordinhão, na Av. João Corrêa, 1000, no Centro de São Leopoldo (RS), com atendimento presencial e online. Anuncia no Google. Prospecto, não é cliente. Marca montada em 2026-10-03 a partir do logo, do selo dos anúncios e das fotos do site atual.
source: logo, ícone e fotos do site atual (ferreirabordinhao.adv.br, uploads de 2023/10 a 2024/02), selo dos anúncios Logo-da-Empresa-Google-Ads.png e cores do kit do Elementor (post-5.css); fatos e pendências em brands/ferreira-bordinhao/COPY.md
colors:
  primary: "#1F3857"
  on-primary: "#FFFFFF"
  secondary: "#152842"
  surface-raised: "#25426A"
  accent: "#1A759F"
  accent-ink: "#13658A"
  accent-light: "#7CC3E6"
  accent-pale: "#A9D8EF"
  background: "#FFFFFF"
  surface-ice: "#EAF3F8"
  text-body: "#33435A"
  muted: "#5B6B80"
  silver: "#D5D7D7"
  on-dark-muted: "#A9B6C8"
fonts:
  heading:
    family: Zilla Slab
  body:
    family: Fira Sans
radius:
  button: 6px
logo:
  on-light: /brands/ferreira-bordinhao/logo/ferreira-bordinhao-logo-azul.png
  on-dark: /brands/ferreira-bordinhao/logo/ferreira-bordinhao-logo-branco.png
  symbol: /brands/ferreira-bordinhao/logo/ferreira-bordinhao-simbolo-azul.png
  symbol-on-dark: /brands/ferreira-bordinhao/logo/ferreira-bordinhao-simbolo-branco.png
  alt: Ferreira & Bordinhão Advogados Associados
photos:
  - url: /brands/ferreira-bordinhao/fotos/socios.webp
    alt: Joana Ferreira e Rodolfo Bordinhão, sócios do escritório, de pé diante da estante
  - url: /brands/ferreira-bordinhao/fotos/papel-timbrado.webp
    alt: Xícara de café sobre a mesa ao lado de uma folha com o logo Ferreira & Bordinhão
---

# Ferreira & Bordinhão Advogados Associados — DESIGN.md

Escritório de direito do trabalho e previdenciário na Av. João Corrêa, 1000, sala 404, no Centro de São Leopoldo. Dois sócios, Joana Ferreira (OAB/RS 78.159) e Rodolfo Bordinhão (OAB/RS 85.811), os dois especialistas em direito do trabalho; a sociedade tem o registro OAB/RS 9.387. O escritório também atende direito de família e do consumidor. **Prospecto**: este sistema serve à nova versão do site que vamos mostrar ao escritório. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias, o canto do botão, o logo e as duas fotos. Não tem papel de rótulo, peso ou entrelinha de título, cartão, divisor nem efeitos, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está abaixo e nos builders (`src/features/ferreirabordinhao/`).

## 1. Conceito: está na lei

O escritório anuncia no Google para quem foi demitido, sofreu um acidente, teve o benefício negado pelo INSS ou sofre assédio no trabalho. Quem clica quer saber, em segundos, se tem direito e com quem falar. O site novo responde com o que a lei diz, em números: **10 dias** para pagar a rescisão, **5º dia útil** para o salário, **50%** a mais na hora extra, **12 meses** de estabilidade depois do acidente, **30 dias** para recorrer do INSS, **2 anos** para entrar com a ação. Cada número vem com o artigo, em letra de documento, como uma boa petição: claro, exato, sem promessa.

- **A abertura diz o que o escritório faz e onde fica**, com o WhatsApp à mão, e ao lado o quadro "Está na lei", com quatro números que valem para quem trabalha.
- **As situações são as dos anúncios**, escritas como a pessoa pensaria ("Fui demitido e não recebi a rescisão"), cada uma com o número da lei, a explicação em uma frase, a referência (CLT, art. 477) e o WhatsApp já com o assunto.
- **Os sócios aparecem com nome, OAB e formação**, na foto real do escritório, cada um com o seu WhatsApp, como no site atual.
- Fora do clichê jurídico: nada de martelo, balança, estátua, coluna, aperto de mão, cadeira de couro ou foto de banco de imagem. A única imagem decorativa é tipográfica: os números.

## 2. Logo

O logo real: o monograma "fb" (a haste e o arco do f com a bola do b, com os cortes) e o nome "Ferreira & Bordinhão advogados" ao lado de um filete vertical. Arquivos em `public/brands/ferreira-bordinhao/logo/` (fundo transparente; o nome do arquivo diz a cor da tinta):

- `ferreira-bordinhao-logo-branco.png` (376 × 139): no cabeçalho, na abertura e no rodapé, sobre o marinho.
- `ferreira-bordinhao-logo-azul.png` (374 × 138): sobre o branco.
- `ferreira-bordinhao-simbolo-branco.png` e `-azul.png` (219 × 297): só o monograma, recortado do ícone do site.
- `ferreira-bordinhao-icone.png` (512 × 512): o ícone do site, monograma prata no marinho.

O logo tem sempre largura explícita no modelo (160px no cabeçalho, 132px no celular), para a marca aplicada por cima reconhecer o arquivo e manter o tamanho.

## 3. Cores

- **Azul-marinho** `#1F3857` (o do ícone do logo) no cabeçalho, na abertura, no primeiro contato e na chamada final, e nos títulos sobre o branco; **marinho profundo** `#152842` no rodapé; **marinho levantado** `#25426A` nos quadros sobre o marinho.
- **Branco** `#FFFFFF` e **azul-gelo** `#EAF3F8` nas faixas claras. Texto `#33435A`; apoio `#5B6B80`.
- **Prata** `#D5D7D7` (a do monograma) nos filetes do claro e no texto sobre o marinho (8,2:1); apoio no marinho `#A9B6C8`.
- **Azul-petróleo** `#1A759F`, o anel do selo que o escritório usa nos anúncios, é o único destaque: botões no claro (branco por cima, 5,1:1), números da lei e marcas. Rótulos pequenos no claro usam o **petróleo escuro** `#13658A` (6,4:1 no branco, 5,7:1 no gelo), que também é a troca de cor do botão. Sobre o marinho, o **petróleo claro** `#7CC3E6` (números, rótulos e o botão, com texto marinho, 6,1:1) e o `#A9D8EF` na troca de cor.
- O verde do WhatsApp aparece só no botão flutuante. O verde dos botões do site atual não volta.

## 4. Tipografia

Duas famílias do Google Fonts:

- **Zilla Slab** (serifa egípcia, a letra de documento) nos títulos, nas situações, nos números da lei e nas perguntas, em caixa normal, peso 600 nos títulos e 500 nas situações.
- **Fira Sans** no texto, nos rótulos, nas referências da lei, no menu e nos botões. Rótulos e referências em caixa alta espaçada, com algarismos tabulares.

A marca não tem papel `label` de propósito: sem ele, o Space trata rótulos e botões com a fonte de texto, que já é a do modelo.

| Uso | Tamanho | Fonte |
|---|---|---|
| Título da abertura | 62px (38px no celular) | Zilla Slab 600 |
| Título de seção | 46px (31px no celular) | Zilla Slab 600 |
| Número da lei | 54px (44px no celular) | Zilla Slab 600 |
| Situação | 23px | Zilla Slab 500 |
| Texto de abertura | 19px / 1,6 | Fira Sans 400 |
| Texto | 17px / 1,65 | Fira Sans 400 |
| Rótulo | 13px, 0,14em de espaçamento | Fira Sans 600 |
| Referência da lei | 12px, 0,1em de espaçamento | Fira Sans 600 |
| Botão | 16px | Fira Sans 600 |

## 5. Medidas

Conteúdo de 1200px com margens de 32/24/16px; seções com 112/88/64px em cima e embaixo. Cabeçalho de 72px (64px no celular), preso no topo. Botões com 6px de canto; cartões, foto e mapa com 8px. Cartões brancos com filete prata de 1px (no marinho, branco a 14%). Nenhum efeito de profundidade fora do botão flutuante e do painel do menu no celular.

## 6. Fotos

Duas fotos reais do site atual: os dois sócios de pé diante da estante (recorte de `bg-secao-biografia-pc.jpg`, 720 × 845), na seção dos advogados, e o café com a folha timbrada do escritório (recorte de `bg-quem-somos-hero-nova-foto-v.02.jpg`). Sem legenda. Direito de uso e fotos novas são pendência.

## 7. O momento-assinatura

Um só: **os números da lei rolam até o valor**, como as bandas de um carimbo datador. Ao abrir a página, os quatro números do quadro "Está na lei" giram e param em "10 dias", "5º dia útil", "50%" e "2 anos"; ao rolar, o número de cada situação faz o mesmo uma vez. Botões e links só trocam de cor. Tudo é comportamento de um único widget HTML (GSAP e ScrollTrigger do jsDelivr), atrás de `prefers-reduced-motion`; sem ele, no editor do Elementor e nas miniaturas do Space, os números já estão no lugar.

## 8. Voz

- Clara e exata, como uma boa petição: frases curtas, sem jargão, com a referência da lei entre parênteses.
- Informa, não promete. Sem "a melhor solução", "altamente qualificados", "excelência", "garantir seus direitos", "atendimento imediato", "já ajudamos dezenas"; sem depoimento, caso, resultado ou preço (Código de Ética da OAB e Provimento 205/2021; ver `COPY.md` §7). Toda explicação da lei leva o aviso "informação geral: cada caso tem detalhes que mudam a resposta".
- "Especialista em direito do trabalho" é título dos dois sócios (pós-graduação citada no site); aparece junto da instituição e do ano.
- As chamadas são neutras: "Falar no WhatsApp", "Conversar sobre isso", "Ver as situações", "Como chegar".
