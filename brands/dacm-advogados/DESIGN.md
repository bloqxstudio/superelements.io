---
name: DACM Advogados
description: Depizzol Andrade & Cassel Martins Advogados Associados, escritório no Centro de São Leopoldo (RS) com atuação trabalhista, previdenciária, cível, tributária, societária e administrativa. Prospecto, não é cliente. Marca montada em 2026-10-03 a partir do logo do site atual (o monograma 2×2 em azul-ardósia e cinza).
source: logo do site atual (dacmadvogados.com.br, wp-content/uploads/2025/09/image-4.png) e cores do post-8.css do Elementor; fatos e pendências em brands/dacm-advogados/COPY.md
colors:
  primary: "#2F3F61"
  on-primary: "#FFFFFF"
  secondary: "#34466B"
  secondary-raised: "#3C5079"
  deep: "#1C2639"
  accent-gray: "#999999"
  background: "#FFFFFF"
  surface-concrete: "#ECEEF1"
  text-body: "#3D4657"
  muted: "#5D6574"
  border: "#D5D9E0"
  on-dark-soft: "#D3DAE6"
  on-dark-muted: "#A9B4C8"
fonts:
  heading:
    family: Sofia Sans Condensed
  body:
    family: Sofia Sans
radius:
  button: 4px
logo:
  on-light: /brands/dacm-advogados/logo/dacm-advogados-logo.png
  on-dark: /brands/dacm-advogados/logo/dacm-advogados-logo.png
  alt: Depizzol Andrade & Cassel Martins Advogados Associados
---

# DACM Advogados — DESIGN.md

Depizzol Andrade & Cassel Martins Advogados Associados, na R. Marquês do Herval, 1236, sala 502, Centro de São Leopoldo. Fundado por Luiz Fernando Depizzol Andrade e Francisco Cassel Martins; Marcus Vinicius Ortácio é o terceiro sócio. A ficha do Google classifica como "Advogado trabalhista", e o escritório anuncia no Google e no Instagram (reconhecimento de vínculo). **Prospecto**: este sistema serve à nova versão do site que vamos mostrar ao escritório. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias, o canto do botão e o logo. Não tem papel de rótulo, peso ou entrelinha de título, cartão, divisor nem efeitos, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está abaixo e nos builders (`src/features/dacm/`).

## 1. Conceito: os quatro quadros

O logo do escritório é um bloco de quatro quadros com as iniciais D, A, C e M: dois cinzas (D e M) e dois azuis (A e C), em xadrez, com o canto de cima à esquerda e o de baixo à direita arredondados. As duas primeiras letras são de Depizzol Andrade, as duas últimas de Cassel Martins. O site novo usa esse bloco como sistema.

- **A abertura é o monograma.** À esquerda, o que o escritório faz e onde fica, em poucas linhas. À direita, os quatro quadros na mesma ordem e nas mesmas cores do logo, e cada quadro é um assunto (Trabalho, INSS, Contratos e dívidas, Empresas) que abre o WhatsApp com a pergunta pronta. Quem chega pelo anúncio escolhe a porta em um toque.
- **As áreas são quadros.** As seis áreas do site atual viram seis quadros em xadrez, cada um com a situação escrita como a pessoa diria ("Trabalhei sem carteira assinada"), o que o escritório faz nela e o atalho para o WhatsApp.
- **Os sócios também.** Os dois fundadores aparecem com as duas letras que levam no logo (DA e CM), e o terceiro sócio ao lado; nome, OAB e formação, só o que é público.
- **Quadro tem canto de monograma**: os dois cantos opostos arredondados (28px; 20px nos quadros pequenos), os outros retos. É a única forma da página além do retângulo.
- Fora do clichê jurídico: nada de martelo, balança, coluna, aperto de mão, livros ou foto de banco de imagem. As duas faixas de banco do site atual ("Boas parcerias podem garantir o seu sucesso", a estante de livros) não voltam.

## 2. Logo

O logo do site atual (`public/brands/dacm-advogados/logo/dacm-advogados-logo.png`, 400 × 121, fundo transparente): o monograma em cima e "DEPIZZOL ANDRADE & CASSEL MARTINS", com "ADVOGADOS ASSOCIADOS" entre dois filetes, em tinta ardósia. Funciona só sobre fundo claro, por isso o cabeçalho e o rodapé são claros. Largura explícita sempre (188px no cabeçalho, 150px no celular, 220px no rodapé), para a marca aplicada por cima reconhecer o arquivo e manter o tamanho.

`dacm-monograma.png` (63 × 63) é só o monograma recortado, pequeno demais para destaque: fica guardado. O arquivo vetorial do logo é pendência.

## 3. Cores

- **Tinta** `#2F3F61` (a cor do nome no logo): títulos, botão principal e as faixas escuras (como começa, chamada final). Branco nela dá 10,5:1.
- **Ardósia** `#34466B` (os quadros A e C do logo): os quadros azuis, com título branco (9,6:1) e texto `#D3DAE6`. Sobre a tinta, o quadro azul é `#3C5079`.
- **Cinza do logo** `#999999` (os quadros D e M e o "&"): os quadros cinzas, sempre com texto `#1C2639` (5,3:1). Nunca texto cinza.
- **Papel** `#FFFFFF` e **concreto** `#ECEEF1` nas faixas claras, alternadas. Texto `#3D4657`, apoio `#5D6574`, filete `#D5D9E0`.
- Na faixa escura: texto `#D3DAE6`, apoio `#A9B4C8`, filete branco a 16%.
- Um só destaque: o azul do logo. Sem dourado, bronze ou degradê. O verde do WhatsApp aparece só no botão flutuante.

## 4. Tipografia

Duas famílias do mesmo desenho, no Google Fonts:

- **Sofia Sans Condensed** (grotesca condensada, firme como uma placa de porta) nos títulos, nos assuntos dos quadros, nos números e nas perguntas: peso 700 nos títulos, 600 nos quadros, entrelinha curta, sempre em caixa normal.
- **Sofia Sans** no texto, nos rótulos, no menu e nos botões. Rótulos em caixa alta espaçada, com o quadradinho do monograma na frente.

A marca não tem papel `label` de propósito: sem ele, o Space trata rótulos e botões com a fonte de texto, que já é a do modelo.

| Uso | Tamanho | Fonte |
|---|---|---|
| Título da abertura | 78px (46px no celular) | Sofia Sans Condensed 700 |
| Título de seção | 54px (36px no celular) | Sofia Sans Condensed 700 |
| Assunto do quadro | 27px (23px no celular) | Sofia Sans Condensed 600 |
| Texto de abertura | 20px | Sofia Sans 400 |
| Texto | 18px | Sofia Sans 400 |
| Rótulo | 13px, caixa alta | Sofia Sans 700 |
| Botão | 16px | Sofia Sans 700 |

## 5. Medidas

Conteúdo de 1240px com margens de 32/24/16px; seções com 120/88/64px em cima e embaixo. Cabeçalho de 80px (66px no celular), preso no topo. Botões com 4px de canto; quadros com o canto do monograma; mapa e campos retos. Quadros em xadrez separados por 6px. Nenhum efeito de profundidade fora do menu do celular e do botão flutuante.

## 6. O momento-assinatura

Um só: **os quatro quadros se encaixam**. Ao abrir a página, os quadros dos assuntos chegam cada um do seu canto e fecham o bloco do monograma, os cinzas primeiro e os azuis depois. Ao rolar, os quadros das áreas chegam na ordem do xadrez, uma vez, e os blocos marcados chegam uma vez. Botões e links só trocam de cor. Tudo é comportamento de um único widget HTML (GSAP e ScrollTrigger do jsDelivr), atrás de `prefers-reduced-motion`; sem ele, no editor do Elementor e nas miniaturas do Space, a página está pronta e o monograma já montado.

## 7. Voz

- Direta e calma, para quem chegou pelo anúncio com um problema: o assunto primeiro, a explicação depois, frases curtas.
- Informa, não promete. Sem "garantir o seu sucesso", "a defesa dos seus direitos é a nossa especialidade", "foco no resultado", "ágil e eficaz", "o melhor"; sem depoimento, caso, resultado ou preço (Código de Ética da OAB e Provimento 205/2021; ver `COPY.md` §7).
- "Pós-graduado em…" é o fato do site; "especialista" só com o título confirmado pelo escritório.
- As chamadas são neutras: "Conversar pelo WhatsApp", "Ligar", "Ver os assuntos", "Como chegar".
