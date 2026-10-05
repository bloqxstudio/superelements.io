---
name: Macarthy Scherer Advogados
description: Escritório de dois sócios no Centro de São Leopoldo (RS), em família, sucessões e criminal. Prospecto, não é cliente. Marca montada em 2026-10-03 a partir do logo público (letreiro fino azul com um traço afinado) e do bronze do site atual.
source: logo vetorial e cores do site atual (macarthyscherer.com.br, mídia 88 e 89 e post-2051.css do Elementor); fatos e pendências em brands/macarthy-scherer/COPY.md
colors:
  primary: "#0A243B"
  on-primary: "#FFFFFF"
  secondary: "#074468"
  accent: "#BB8553"
  accent-ink: "#8A5A2C"
  background: "#F6F4F0"
  surface: "#FFFFFF"
  surface-mist: "#E8EEF2"
  text-body: "#3E4A56"
  muted: "#5E6A75"
  border: "#DCE1E5"
  on-dark-soft: "#C3D0DB"
fonts:
  heading:
    family: Newsreader
  body:
    family: Instrument Sans
radius:
  button: 999px
logo:
  on-light: /brands/macarthy-scherer/logo/macarthy-scherer.svg
  on-dark: /brands/macarthy-scherer/logo/macarthy-scherer-branco.svg
  alt: Macarthy Scherer Advogados
photos:
  - url: /brands/macarthy-scherer/fotos/glaucia-macarthy.jpg
    alt: Gláucia Macarthy, advogada, sorrindo, diante de uma estante de livros
  - url: /brands/macarthy-scherer/fotos/marcelo-scherer.jpg
    alt: Marcelo Scherer, advogado, sentado à mesa do escritório
---

# Macarthy Scherer — DESIGN.md

Escritório de advocacia na Rua Bento Gonçalves, 673, sala 701, no Centro de São Leopoldo. Dois sócios: Gláucia Macarthy (família e sucessões) e Marcelo Scherer (criminal). **Prospecto**: este sistema serve à nova versão do site que o Superelements vai mostrar ao escritório. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias, o canto do botão, o logo e os retratos. Não tem papel de rótulo, peso ou entrelinha de título, cartão, divisor nem efeitos, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está abaixo e nos builders (`src/features/macarthyscherer/`).

## 1. Conceito: a conversa reservada

Família e criminal são os momentos mais delicados da vida de alguém. O site novo é **calmo, claro e pessoal**, como uma sala de conversa: papel claro, texto em azul-tinta, títulos com serifa, muito espaço e nenhum ornamento além do traço do logo.

- **O nome do escritório são duas pessoas.** "Macarthy Scherer" é Gláucia Macarthy e Marcelo Scherer. Os dois aparecem logo na abertura, lado a lado, cada um com a sua área e o seu número de OAB: quem chega já sabe com quem vai falar.
- **As áreas são situações**, escritas como a pessoa pensaria ("Vou me separar…", "Alguém próximo foi preso…"), cada coluna com o sócio daquela área e o WhatsApp dela.
- **O primeiro contato é explicado** em três passos, com o sigilo profissional dito com todas as letras: privacidade e clareza antes de qualquer chamada.
- **O traço do logo** (a linha fina e afinada entre "MACARTHY SCHERER" e "ADVOGADOS") é o único ornamento: filetes finos em bronze, a linha que liga os dois sócios na abertura e o fio que costura os passos do primeiro contato.
- Fora do clichê jurídico: nada de balança, estátua, martelo, coluna ou aperto de mão; nada de degradê azul com dourado. O azul e o bronze são os do escritório, usados com calma: muito papel, pouco bronze.

## 2. Logo

Letreiro geométrico fino em caixa alta, "MACARTHY SCHERER", com "ADVOGADOS" espaçado embaixo e um traço afinado entre as linhas. Dois arquivos vetoriais do site atual, em `public/brands/macarthy-scherer/logo/`:

- `macarthy-scherer.svg`: azul (`#0A243B`, `#074468`, `#005383`), para fundo claro. É o `on-light`, usado no cabeçalho.
- `macarthy-scherer-branco.svg`: branco, para fundo escuro. É o `on-dark`, usado no rodapé.

Proporção 503 × 83. No cabeçalho, 190px de largura (150px no celular); no rodapé, 220px. O logo tem largura explícita no modelo, para a marca aplicada por cima reconhecer o arquivo e manter o tamanho. O favicon atual ("SM", de Scherer Macarthy) não entra: o nome é Macarthy Scherer.

## 3. Cores

- **Papel** `#F6F4F0` é o fundo da página; **branco** nos cartões e na faixa das áreas; **névoa** `#E8EEF2` (o azul do logo bem claro) na faixa das dúvidas.
- **Azul-tinta** `#0A243B` (a tinta do logo) nos títulos, no botão principal, na faixa do primeiro contato e no rodapé. Texto `#3E4A56`; apoio `#5E6A75` (5:1 no papel); filetes `#DCE1E5`.
- **Azul do logo** `#074468` na faixa da chamada final e na troca de cor dos botões. Texto em cima: branco ou `#C3D0DB`.
- **Bronze** `#BB8553` (o do site atual) é o único destaque: filetes, numerais e marcas pequenas. No claro, rótulos pequenos usam o bronze escuro `#8A5A2C` (5,3:1); o bronze puro só vai em texto sobre o azul-tinta (5:1). Nunca bronze em texto sobre o azul do logo.
- O verde do WhatsApp aparece só no botão flutuante.

## 4. Tipografia

Duas famílias do Google Fonts, poucos pesos:

- **Newsreader** (serifa editorial, eixo óptico) nos títulos, nomes, perguntas e numerais: peso 400, entrelinha 1,08 a 1,15, espaçamento levemente negativo. Itálico só para uma palavra de ênfase, e não em toda frase.
- **Instrument Sans** no texto, nos rótulos, no menu e nos botões. Rótulos em caixa alta e bem espaçados, como o "A D V O G A D O S" do logo.

A marca não tem papel `label` de propósito: sem ele, o Space trata rótulos e botões com a fonte de texto, que já é a do modelo.

| Uso | Tamanho | Fonte |
|---|---|---|
| Título da abertura | 64px (40px no celular) | Newsreader 400 |
| Título de seção | 46px (32px no celular) | Newsreader 400 |
| Nome e título de cartão | 26px (22px no celular) | Newsreader 400 |
| Texto de abertura | 20px / 1,6 | Instrument Sans 400 |
| Texto | 17px / 1,65 | Instrument Sans 400 |
| Rótulo | 12px, 0,18em de espaçamento | Instrument Sans 600 |
| Botão | 15px | Instrument Sans 600 |

## 5. Medidas

Conteúdo de 1200px com margens de 32/24/16px; seções com 120/88/64px em cima e embaixo, porque o espaço faz parte da calma. Cabeçalho de 80px (64px no celular), preso no topo. Botões em pílula; cartões e o mapa com 16px; retratos com 12px. Cartões brancos com filete `#DCE1E5`; no azul-tinta, filetes brancos a 14%. Nenhum efeito de profundidade fora do botão flutuante.

## 6. O momento-assinatura

Um só: **o traço**. Ao abrir a página, a linha fina em bronze se desenha entre os dois retratos da abertura, como o traço do logo entre o nome e "ADVOGADOS", e os textos da abertura sobem um pouco e aparecem. Ao rolar, o fio vertical que liga os três passos do primeiro contato se desenha junto com a rolagem, e os blocos marcados sobem uma vez quando entram na tela. Botões e links só trocam de cor. Tudo é comportamento de um único widget HTML (GSAP e ScrollTrigger do jsDelivr), atrás de `prefers-reduced-motion`; sem ele, no editor do Elementor e nas miniaturas do Space, a página aparece pronta e o traço já desenhado.

## 7. Voz

- Fala baixo e claro, como numa primeira conversa: frases curtas, sem jargão, sem drama.
- Informa, não promete. Sem "garanta", "resolva", "o melhor", "referência", "excelência"; sem depoimento, caso, resultado ou preço (Código de Ética da OAB e Provimento 205/2021; ver `COPY.md` §7).
- Títulos acadêmicos com o nome exato de cada curso. "Especialista" só onde há título; nas outras áreas, "atua em".
- Cada área fala com o sócio daquela área. As chamadas são neutras: "Conversar pelo WhatsApp", "Ver as áreas", "Como chegar".
