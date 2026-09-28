---
version: alpha
name: Inpel
description: Identidade visual do site da Inpel Transmissões Mecânicas (inpel.com.br), lida dos estilos calculados do site em 2026-09-27.
source: https://www.inpel.com.br/ (app Vue sobre o tema Electro, Bootstrap 3)
colors:
  primary: "#D10024"        # vermelho Inpel: botão de busca, ícones, faixas diagonais dos destaques
  on-primary: "#FFFFFF"
  primary-hover: "#A8001D"
  text-heading: "#2B2D42"   # títulos, nomes de produto, menu
  text-body: "#333333"
  muted: "#8D99AE"          # categoria do cartão e trilha; 2,9:1 no branco, só em texto grande
  background: "#FFFFFF"
  surface-muted: "#FBFBFC"  # faixa do breadcrumb
  border: "#E4E7ED"
  dark-bar: "#1E1F29"       # barra de contato do topo e barra do crédito
  footer: "#15161D"
  footer-text: "#B9BABC"
typography:
  heading-section:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.1
  product-name:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.1
    textTransform: uppercase
  body:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  small:
    fontFamily: Montserrat
    fontSize: 12px
    fontWeight: 500
    lineHeight: 17px
  label:
    fontFamily: Montserrat
    fontSize: 18px
    fontWeight: 700
    textTransform: uppercase
rounded:
  block: 0px                # cartões, imagens e campos são retos
  pill: 40px                # busca e botões vermelhos
  button-mobile: 4px        # botão "Menu" do celular
spacing:
  container: 1140px
  gutter: 30px
  section: 30px
shadow: "0 0 0 1px #E4E7ED"   # contorno dos cartões; no hover vira "0 0 6px #E4E7ED, 0 0 0 2px #D10024"
divider: "1px solid #E4E7ED"
motion:
  hover: "0.2s: cor dos links, sublinhado vermelho do menu, zoom 1.1 nas fotos dos destaques"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: 12px 30px
    typography: 14px 700 uppercase
  card-product:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.block}"
    border: "1px solid {colors.border}"
  highlight:
    note: "foto 360x253 com duas faixas #D10024 a 90% inclinadas -45 graus, título 24px branco"
logo:
  on-light: /inpel/assets/brand/inpel-70-anos.jpg
  alt: Inpel Transmissões Mecânicas, 70 anos
photos:
  - url: /inpel/assets/sobre/fachada-inpel.jpg
    alt: Fachada da fábrica da Inpel em Sapucaia do Sul
  - url: /inpel/assets/destaques/sobre-a-inpel.jpg
    alt: Vista aérea da fábrica da Inpel
  - url: /inpel/assets/destaques/caixas-de-transmissao.jpg
    alt: Caixa de transmissão Inpel
  - url: /inpel/assets/produtos/ct-145/ct-145-2.png
    alt: Roçadeira com caixa de transmissão Inpel CT-145
  - url: /inpel/assets/blog/treinamento-de-engrenagens-cilindricas.png
    alt: Equipe da Inpel no treinamento de engrenagens cilíndricas
---

# Inpel — DESIGN.md

Referência da identidade visual da **Inpel Transmissões Mecânicas** como ela está publicada em inpel.com.br. Os valores foram lidos dos estilos calculados do site, não estimados de captura. O conteúdo do site (textos, produtos, posts) vem da API pública e está em `src/features/inpel/content.ts`; a migração está registrada em `migrations/inpel/`.

## 1. Atmosfera

Indústria de peças agrícolas, 70 anos. Página branca, títulos em grafite (`#2B2D42`) e **um vermelho só**, o da marca (`#D10024`), usado em chamadas, ícones e nas faixas inclinadas dos destaques. O topo e o rodapé são quase pretos. Fotos de produto em fundo cinza-claro, recortadas, e fotos reais de fábrica e de campo.

## 2. Logo

Emblema losangular vermelho com o logotipo "INPEL / Transmissões Mecânicas" e, ao lado, o selo dos **70 anos** com a engrenagem cônica. O arquivo do site é um JPG em fundo branco (500×222): não existe versão para fundo escuro nem símbolo isolado. Para o rodapé escuro, peça à Inpel o vetor do logo.

## 3. Cores

- Vermelho `#D10024` para chamadas e destaques; hover `#A8001D`.
- Grafite `#2B2D42` nos títulos e no menu; texto corrido `#333333`.
- Cinza `#8D99AE` só em rótulos grandes: em 12px sobre o branco ele fica em 2,9:1, abaixo do AA.
- Linhas e contornos `#E4E7ED`; faixa do breadcrumb `#FBFBFC`.
- Topo e crédito `#1E1F29`, rodapé `#15161D` com texto `#B9BABC`.

## 4. Tipografia

Montserrat 400, 500 e 700 (Google Fonts). O site pede 800 em alguns títulos, mas não carrega esse peso: o que aparece é 700.

| Uso | Tamanho | Peso |
|---|---|---|
| Título de seção | 24px (25px em caixa alta na home) | 700 |
| Título dos destaques | 24px branco | 700 |
| Texto | 14px / 20px | 400 |
| Barra do topo, trilha | 12px | 500 |
| Nome no cartão de produto | 14px caixa alta | 500 |
| Categoria no cartão | 12px caixa alta, cinza | 400 |
| Título de post | 18px | 500 |
| Colunas do rodapé | 18px caixa alta branco | 700 |

## 5. Layout

Container de 1140px (a `.container` de 1170px do Bootstrap com colunas de 15px), gutter de 30px, seções com 30px em cima e embaixo. Grades de 3 colunas (destaques, posts, catálogo) e rodapé em 4. Abaixo de 992px o topo vira o botão "Menu" e a marca; abaixo de 481px as grades ficam em 1 coluna.

## 6. Componentes

- **Destaque**: foto 360×253 com duas faixas vermelhas a 90% inclinadas −45°, título e "SAIBA MAIS" com seta. A foto aproxima 1,1× no hover.
- **Cartão de produto**: imagem, categoria em cinza e nome em caixa alta, contorno de 1px `#E4E7ED` que vira 2px vermelho no hover. Etiqueta vermelha no canto ("LANÇAMENTO", "3 ANOS DE GARANTIA").
- **Busca**: pílula com o campo branco e o botão vermelho "Pesquisar" colado à direita.
- **Botão**: pílula vermelha de raio 40px, texto branco 14px/700 em caixa alta.
- **Menu**: links de 14px/500 com um sublinhado vermelho de 2px que cresce no hover.

## 7. Voz

Direta e técnica, em português. Fala de caixa de transmissão, engrenagem cônica, aplicação (roçadeira, graneleiro, plataforma de milho) e das montadoras que usam o produto. Selo de confiança: ISO 9001:2015 desde 1997, quase 70 anos de mercado, fabricação 100% nacional. Frase-assinatura: "Inpel, a melhor solução em Transmissões Mecânicas".
