---
name: Fonseca & Lorenço Advogados Associados
description: Escritório de advocacia no Centro de São Leopoldo (RS), com foco no direito do trabalho, mais Previdenciário, Cível e assessoria a empresas. Prospecto (ainda não é cliente); marca montada em 2026-10-03 a partir do selo do logo de 2019 e das artes do Instagram.
source: logo do site atual (wp-content/uploads/2019/09/logo-png-02-oficial.png), artes do blog e do Instagram, CSS do tema; fatos e pendências em brands/fonseca-lorenco/COPY.md
colors:
  primary: "#282828"
  on-primary: "#FFFFFF"
  accent: "#FFB404"
  on-accent: "#282828"
  accent-hover: "#FFC53A"
  accent-ink: "#8A5A00"
  background: "#F7F5EF"
  surface: "#FFFFFF"
  text-heading: "#282828"
  text-body: "#4A4944"
  muted: "#6B6962"
  on-dark-soft: "#C9C7C0"
  on-dark-dim: "#A8A69F"
  black-deep: "#1E1E1E"
  raised-dark: "#323230"
  border: "#E6E1D6"
fonts:
  heading:
    family: Archivo
  body:
    family: Public Sans
radius:
  button: 4px
logo:
  on-light: /brands/fonseca-lorenco/logo/fonseca-lorenco-logo-preto.png
  on-dark: /brands/fonseca-lorenco/logo/fonseca-lorenco-logo-branco.png
  symbol: /brands/fonseca-lorenco/logo/fonseca-lorenco-selo.png
  alt: Fonseca & Lorenço Advogados Associados
photos:
  - url: /brands/fonseca-lorenco/fotos/fachada-escritorio.png
    alt: Fachada do escritório, prédio claro de dois andares com vidros e a placa Fonseca
---

# Fonseca & Lorenço — DESIGN.md

Escritório de advocacia de São Leopoldo com foco no direito do trabalho. A identidade vem do selo do logo de 2019 (disco grafite com um degradê amarelo-esverdeado → âmbar e "Desde 1992") e das artes que o escritório publica no Instagram (painel grafite, títulos em âmbar). **Prospecto**: a proposta é um redesign para vender; nada aqui foi aprovado pelo escritório.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias de fonte, o canto do botão, o logo e a foto da fachada. Ele não tem papel de rótulo, peso, entrelinha, card, divisor nem movimento, de propósito: cada uma dessas chaves reescreve a página. Antes de mudar o front matter, compare `applyBrand` com as seções cruas de todas as páginas.

## 1. Conceito: o marca-texto

Advocacia trabalhista explicada em linguagem de quem trabalha. A página parece um documento claro em que alguém passou o marca-texto no que importa: papel quente, texto grafite e **o degradê do selo como marca-texto** atrás de uma ou duas palavras por título. O que o escritório faz aparece como situações da vida da pessoa ("Fui demitido e quero conferir a rescisão"), não como lista de ramos do direito. A trajetória (1990, 1992, hoje) vira uma linha do tempo que o marca-texto atravessa.

Nada de martelo, balança, coluna grega extra, aperto de mão ou foto de banco de imagem. O templo do selo é do logo real e fica só no logo.

## 2. Logo

| Arquivo | Uso |
|---|---|
| `logo/fonseca-lorenco-logo-branco.png` (1309×662) | Logo original (nome em branco): rodapé |
| `logo/fonseca-lorenco-logo-preto.png` (1309×662) | **Derivado nosso** (branco → grafite) para fundo claro; pedir o oficial |
| `logo/fonseca-lorenco-selo.png` (438×437) | Só o selo: cabeçalho, ao lado do nome em texto nativo |

No cabeçalho, o selo (44px; 38px no celular) vem ao lado do nome em texto nativo, Archivo 800 "Fonseca & Lorenço" e "Advogados Associados" em Public Sans caixa alta: o logo empilhado fica pequeno demais numa barra horizontal. Toda imagem de logo tem largura explícita, para a marca reconhecer o arquivo e manter o tamanho. O nome do arquivo diz a cor do texto do logo (`branco`, `preto`): é por ele que a marca do Space escolhe a versão quando não reconhece o endereço, então não use "fundo-escuro" ou "fundo-claro" no nome (as palavras escuro/claro são lidas como a cor do logo, ao contrário). Pendente: vetor oficial e versão para fundo claro.

## 3. Cores

| Papel | Cor | Uso |
|---|---|---|
| Grafite | `#282828` | Títulos, texto marcado, faixas escuras, cabeçalho no celular |
| Rodapé | `#1E1E1E` | Rodapé |
| Cartão no grafite | `#323230` | Cartões das faixas escuras, filete branco a 10% |
| Âmbar | `#FFB404` (hover `#FFC53A`) | Botões e marcas pequenas; texto em cima sempre grafite (8,3:1) |
| Âmbar escuro | `#8A5A00` | Texto pequeno em âmbar sobre o papel (5,4:1) |
| Degradê do selo | `#E5F064` → `#F2DD53` → `#FFCA6A` | Marca-texto atrás das palavras; faixa da chamada final; barra dos rótulos |
| Papel | `#F7F5EF` | Fundo claro |
| Branco | `#FFFFFF` | Cartões no papel |
| Linha | `#E6E1D6` | Bordas no claro |
| Texto | `#4A4944` (8,3:1), apoio `#6B6962` (5:1) | No papel |
| Texto no grafite | `#C9C7C0` (8,7:1), apoio `#A8A69F` (6:1) | No grafite |

Um amarelo só, em duas formas: o degradê do selo para marcar, o âmbar sólido para clicar. Âmbar nunca é texto pequeno no papel (use o âmbar escuro ou grafite com a barra do degradê). O verde do WhatsApp só no botão flutuante. O dourado `#C09431` do tema antigo não volta.

## 4. Tipografia

Archivo 800 nos títulos, apertado (entrelinha 1,02 a 1,06, espaçamento −0,02em): letra de cartaz de fábrica, firme, sem ser jurídica de terno. Public Sans no texto, nos rótulos, no menu e nos botões: desenhada para serviço público, clara em qualquer tela. Rótulos em caixa alta espaçada; botões em caixa normal, peso 700, como quem fala.

| Uso | Tamanho | Peso |
|---|---|---|
| Título da abertura | 68px (54 tablet, 40 celular) | Archivo 800 |
| Título de seção | 48px (40, 32) | Archivo 800 |
| Frase de destaque | 28px (22 celular) | Archivo 700 |
| Título de cartão | 21px (19 celular) | Archivo 700 |
| Ano da linha do tempo | 40px (32 celular) | Archivo 800 |
| Texto | 17px / 1,65 | Public Sans 400 |
| Texto de apoio | 15px / 1,6 | Public Sans 400 |
| Rótulo | 13px caixa alta, 0,14em | Public Sans 700 |
| Etiqueta de cartão | 12px caixa alta, 0,12em | Public Sans 700 |
| Botão | 16px | Public Sans 700 |

## 5. Layout e forma

Conteúdo de 1160px com margens de 32/24/16px; seções com 112/88/64px. Cabeçalho fixo de 76px (64px no celular). Botões com 4px de raio; cartões, mapa e foto com 8px. Cartões claros brancos com borda `#E6E1D6`; no grafite, `#323230` com filete branco a 10%. Sem sombras, exceto o menu do celular e o botão do WhatsApp. Faixas: papel, grafite (como as artes do Instagram) e uma faixa final no degradê do selo.

## 6. O marca-texto em cena

Um momento-assinatura: **o marca-texto passa**. Na abertura, o degradê corre por trás de "palavras simples" logo depois que o título aparece; nos títulos de seção, uma vez, quando entram na tela; na trajetória, a linha do tempo se preenche com o mesmo degradê conforme a rolagem e acende cada data. Os blocos sobem um pouco, uma vez. Tudo isso mora em `src/features/fonsecalorenco/story.ts` (GSAP e ScrollTrigger pelo jsDelivr, num widget HTML só de comportamento, primeiro filho da abertura) e não neste arquivo: o leitor de marca do Space transforma tempos escritos aqui em regras de movimento. O CSS sozinho já é a composição final (marca-texto inteiro, linha cheia). Com movimento reduzido, no editor do Elementor e nas miniaturas do Space nada roda. Nenhuma animação de entrada do Elementor. Botões só trocam de cor e encolhem um pouco ao pressionar; cartões só ganham a borda âmbar com o mouse.

## 7. Voz

- Fala com quem trabalha, na primeira pessoa dele: "Fui demitido", "Faço hora extra e ela não aparece no contracheque".
- Explica antes de oferecer: o que é, quais documentos ajudam, como é a primeira conversa.
- Prova é fato com fonte: "experiência desde 1990", o selo "desde 1992", a equipe com técnico de segurança do trabalho, o Centro de São Leopoldo, "sem fechar ao meio-dia".
- Sem promessa de resultado, sem superlativo, sem comparação, sem preço, sem depoimento (Código de Ética da OAB e Provimento 205/2021; ver `COPY.md` §13).
- Chamadas neutras: "Falar no WhatsApp", "Ver as situações", "Como chegar".
