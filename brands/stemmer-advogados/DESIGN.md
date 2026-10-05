---
name: Stemmer Advogados Associados
description: Escritório de advocacia trabalhista e previdenciária na Rua São José, 195, bairro São José, São Leopoldo (RS), desde 1996, com quatro advogados. Prospecto, não é cliente. Marca montada em 2026-10-03 a partir do logo, das fotos e das cores do site atual.
source: logo, fotos e cores do site atual (stemmeradvogados.com.br, uploads de 2025/02 e 2025/03, post-5.css do Elementor); fatos e pendências em brands/stemmer-advogados/COPY.md
colors:
  primary: "#0D1114"
  on-primary: "#FFFFFF"
  secondary: "#171D21"
  accent: "#146C43"
  accent-deep: "#0E5233"
  accent-light: "#86CFA6"
  background: "#FFFFFF"
  surface-record: "#F1F7F3"
  record-rule: "#C9DFD1"
  text-body: "#3A3E40"
  muted: "#5C6367"
  border: "#DDE0E1"
  on-dark-soft: "#C8CDD0"
  on-dark-muted: "#949B9F"
fonts:
  heading:
    family: Encode Sans Expanded
  body:
    family: Sora
radius:
  button: 4px
logo:
  on-light: /brands/stemmer-advogados/logo/stemmer-logo-preto.png
  on-dark: /brands/stemmer-advogados/logo/stemmer-logo-branco.png
  alt: Stemmer Advogados Associados
photos:
  - url: /brands/stemmer-advogados/fotos/equipe-fachada.webp
    alt: Os quatro advogados do escritório em frente à fachada branca com o nome Stemmer e o número 195
  - url: /brands/stemmer-advogados/fotos/fachada-195.webp
    alt: Fachada do escritório na Rua São José, 195
  - url: /brands/stemmer-advogados/fotos/carlos-stemmer.webp
    alt: Carlos Alberto Stemmer, advogado
  - url: /brands/stemmer-advogados/fotos/gabriel-lazzaretti-pacheco.webp
    alt: Gabriel Lazzaretti Pacheco, advogado
  - url: /brands/stemmer-advogados/fotos/gelvani-deuschle.webp
    alt: Gelvani Deuschle, advogada
  - url: /brands/stemmer-advogados/fotos/martiela-tavares-da-silva.webp
    alt: Martiela A. Tavares da Silva, advogada
---

# Stemmer Advogados Associados — DESIGN.md

Escritório de direito do trabalho e previdenciário (INSS) com casa própria na Rua São José, 195, no bairro São José, em São Leopoldo. Quatro advogados na equipe do site atual, atuação desde 1996. Anuncia no Google: a Home é o destino de quem clicou num anúncio porque tem um problema no trabalho ou com o INSS. **Prospecto**: este sistema serve à nova versão do site que vamos mostrar ao escritório. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias, o canto do botão, o logo e as fotos. Não tem papel de rótulo, peso ou entrelinha de título, componentes, divisores nem regras de efeito, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está abaixo e nos builders (`src/features/stemmer/`).

## 1. Conceito: o cartão-ponto

O escritório cuida do tempo de trabalho das pessoas: o tempo com carteira assinada ou sem ela, as horas extras, o tempo de contribuição que conta para o INSS. O site novo usa a forma mais conhecida de registrar esse tempo: **o cartão de ponto**.

- **A abertura diz em segundos o que é e onde fica.** Advocacia trabalhista e previdenciária em São Leopoldo, o WhatsApp à mão e uma ficha do escritório (desde 1996, Rua São José, 195, trabalho e INSS, presencial e online) com os quadros numerados marcados de verde. Ao lado, a foto real dos quatro advogados na frente da fachada com o nome Stemmer e o número 195.
- **As situações são linhas de dois cartões.** Um cartão "No trabalho" (sem carteira assinada, demissão, horas extras, assédio, acidente) e outro "No INSS" (auxílio-acidente, benefício negado, aposentadoria, pensão por morte). Cada linha é uma situação na primeira pessoa, com o nome da área embaixo e o WhatsApp já com o assunto.
- **A equipe aparece com nome e OAB**, como no site atual, em retratos reais.
- **Onde fica** mostra a fachada, porque quem vem do anúncio precisa reconhecer a casa ao chegar.
- Fora do clichê jurídico: nada de martelo, balança, estátua, aperto de mão ou foto de banco de imagem. As fotos de banco do site atual (escritório genérico, obra, idoso, reunião) não voltam.

## 2. Logo

O logo do site atual: o símbolo "S" formado por dois arcos e o nome STEMMER em letras largas e espaçadas, com "Advogados Associados" estreito embaixo. Arquivos em `public/brands/stemmer-advogados/logo/`:

- `stemmer-logo-branco.png` (o original do site, tinta branca, 1200 × 354), usado no cabeçalho e no rodapé, que são pretos.
- `stemmer-logo-preto.png` (derivado do original com tinta preta, até chegar o arquivo oficial).
- `stemmer-simbolo-branco.png` e `stemmer-simbolo-preto.png` (só o "S", recortado do logo).

O nome do arquivo diz a cor da tinta do logo. O logo tem largura explícita no modelo (170px no cabeçalho, 140px no celular), para a marca aplicada por cima reconhecer o arquivo e manter o tamanho.

## 3. Cores

- **Branco** `#FFFFFF` é o fundo da página. **Preto do logo** `#0D1114` (o `#00080D` do site atual, um pouco mais aberto) nos títulos, no cabeçalho, nas faixas escuras e no rodapé; `#171D21` nas peças sobre o preto.
- **Verde-registro** `#146C43` é o único destaque: botões, quadros numerados marcados, rótulos pequenos e a faixa da chamada final. Vem do verde dos botões do site atual (o do WhatsApp), num tom sóbrio. Branco sobre ele dá 6,5:1, e ele sobre o branco também. `#0E5233` é a troca de cor dos botões verdes. Sobre o preto, rótulos e quadros usam o verde claro `#86CFA6`.
- **Papel do registro** `#F1F7F3` e a pauta `#C9DFD1` na ficha da abertura, nos registros das situações, na lista do primeiro contato e na faixa das dúvidas.
- Texto `#3A3E40` (o mesmo do site atual); apoio `#5C6367`; filetes `#DDE0E1`. No preto, texto `#C8CDD0` e apoio `#949B9F`.
- O verde vivo do WhatsApp fica só no botão flutuante.

## 4. Tipografia

Duas famílias do Google Fonts:

- **Encode Sans Expanded** (grotesca larga, como o STEMMER da fachada e do logo) nos títulos, nas situações, nos números e nas perguntas, peso 600, entrelinha curta e espaçamento levemente fechado.
- **Sora** (a fonte do site atual) no texto, nos rótulos, no menu e nos botões. Rótulos em caixa alta espaçada, como os campos impressos de um registro de ponto.

A marca não tem papel `label` de propósito: sem ele, o Space trata rótulos e botões com a fonte de texto, que já é a do modelo.

| Uso | Tamanho | Fonte |
|---|---|---|
| Título da abertura | 58px (31px no celular) | Encode Sans Expanded 600 |
| Título de seção | 40px (26px no celular) | Encode Sans Expanded 600 |
| Situação e nome | 18–22px | Encode Sans Expanded 600 |
| Texto de abertura | 18px / 1,65 | Sora 400 |
| Texto | 16px / 1,7 | Sora 400 |
| Rótulo | 12px, 0,16em de espaçamento | Sora 600 |
| Botão | 15px | Sora 600 |

## 5. Medidas

Conteúdo de 1200px com margens de 32/24/16px; seções com 120/88/64px em cima e embaixo. Cabeçalho preto de 72px (64px no celular), preso no topo. Quadros numerados de 32px. A pauta horizontal fraca do registro é a única textura.

## 6. Pessoas

As fotos são do site atual e reais: os quatro advogados na frente da fachada, a fachada sozinha e o retrato de cada um (Carlos, Gabriel, Gelvani e Martiela). Sem legenda além do nome e da OAB. Direito de uso é pendência.

## 7. O momento-assinatura

Um só: **o ponto é marcado**. Na abertura, a ficha do escritório tem cada quadro numerado preenchido de verde, linha a linha; na rolagem, as linhas das situações são marcadas uma a uma, como um cartão batido. Tudo é comportamento de um único widget HTML (GSAP e ScrollTrigger do jsDelivr), respeitando quem pede menos movimento; sem ele, no editor do Elementor e nas miniaturas do Space, a página já está pronta, com todos os quadros marcados.

## 8. Voz

- Clara e direta, para quem chega com um problema: frases curtas, sem jargão, a situação nas palavras de quem passa por ela.
- Informa, não promete. Sem "garantir seus direitos", "cobrar o que é seu", "resolve seu caso", "atendimento imediato", "altamente qualificados", "excelência", "especialista" (sem título comprovado); sem depoimento, caso, resultado ou preço (Código de Ética da OAB e Provimento 205/2021; ver `COPY.md` §7).
- As chamadas são neutras: "Conversar pelo WhatsApp", "Ver as situações", "Como chegar".
