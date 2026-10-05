---
name: Avence Studio
description: O nosso estúdio de sites, em São Leopoldo (RS). Identidade evoluída em 2026-10-04 para um portfólio de estúdio com foco em velocidade, a partir da marca antiga (o nome em minúsculas, a tinta, as duas setas que se encontram) e longe do Superelements.
source: marca antiga do site atual (avencestudio.com, faviconv3.svg) e pedidos do usuário de 2026-10-04 ("Podemos evoluir a identidade", "use uma fonte serifada para os destaques"); fatos e pendências em brands/avence-studio/COPY.md
colors:
  primary: "#111111"
  on-primary: "#F3F1EC"
  secondary: "#1B1B1B"
  accent: "#2B3CF0"
  accent-deep: "#1F2CC4"
  accent-light: "#8F9BFF"
  accent-mist: "#E4E7FD"
  background: "#F3F1EC"
  surface: "#FFFFFF"
  stone: "#E6E2D9"
  text-body: "#3A3833"
  muted: "#66625A"
  border: "#DCD8CF"
  on-dark-soft: "#D8D5CD"
  on-dark-muted: "#9D998F"
fonts:
  heading:
    family: Inter Tight
  body:
    family: Inter Tight
radius:
  button: 0px
logo:
  on-light: /brands/avence-studio/logo/avence-studio-logo-preto.png
  on-dark: /brands/avence-studio/logo/avence-studio-logo-claro.png
  symbol: /brands/avence-studio/logo/avence-simbolo.png
  symbol-on-dark: /brands/avence-studio/logo/avence-simbolo-claro.png
  alt: Avence Studio
---

# Avence Studio — DESIGN.md

O Avence Studio faz sites para profissionais e empresas: o site novo entregue pronto, cobrado uma vez, e um plano mensal opcional para cuidar dele. O site do studio é um portfólio, e o posicionamento é de estúdio com foco em velocidade: os cases vêm primeiro, o acabamento aparece em cada detalhe e o processo mostra como o trabalho anda sem meses de espera. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, a família, o canto do botão e o logo. Não tem papel de rótulo, peso ou entrelinha de título, componentes, divisores nem regras de efeito, de propósito: cada um desses reescreveria as páginas. O resto está abaixo e nos builders (`src/features/avence/`). A página "Identidade" do projeto no Space mostra tudo isto aplicado, com o antes e depois e os caminhos que ficaram de fora.

## 1. A evolução (decisão de 2026-10-04)

A marca antiga era a palavra "avence studio" em Space Grotesk verde-limão sobre `#111111`, com o favicon das duas setas que se encontram. Duas coisas dela batiam com o Superelements (a Space Grotesk e o verde-limão), e as setas pareciam o ícone de "reduzir tela" de um aplicativo.

- **Fica** o fio: o nome em minúsculas, a tinta `#111111` e o encontro. O ponto azul depois de "avence" é o lugar onde as duas setas da marca antiga se encontravam; no movimento do site, as duas marcas de corte ainda chegam de lados opostos até os cases.
- **O "a" com a barriga em quadrado azul** foi testado na mesma tarde e recusado pelo usuário ("a evolução do logo também não é boa, podemos manter como estava antes"): o logo continua sendo a palavra com o ponto.
- **Muda** o logo. Testamos as setas refinadas com um ponto no meio, o "v" de avence apontando para um ponto e uma ponta de seta segurando um quadrado; o usuário pediu mais. Ficou **a palavra**: "avence" na Instrument Serif, com o ponto azul, e "studio" pequeno em caixa alta. Um estúdio que vende acabamento assina com a letra, como um ateliê; o ponto final diz "pronto", e é o detalhe que se repete na página (rótulos, marcadores, contador). O símbolo, para favicon e avatar, é o "a" com o ponto.
- **Muda** a letra. Sai a Space Grotesk (é a do Superelements). Entra a **Inter Tight** em tudo, com os títulos justos, e a **Instrument Serif** em itálico azul só nos destaques (uma palavra por título), como o usuário pediu: "use uma fonte serifada para os destaques".
- **Muda** a cor. Sai o verde-limão (também do Superelements) e entra o **azul do ponto** `#2B3CF0`, sobre papel claro. Nada do desenho do Superelements: nenhuma fonte mono, nenhuma grade de pontos, nenhuma tela de aplicativo.

## 2. Logo

Arquivos em `public/brands/avence-studio/logo/` (gerados por `.space/avence-studio/build/gen-identidade.cjs`; as letras estão em contornos, sem fonte embutida):

- `avence-studio-logo-preto.svg` / `.png`: assinatura horizontal para fundo claro ("avence" e "STUDIO" em tinta, ponto azul). `avence-studio-logo-claro.svg` / `.png`: para fundo escuro (papel, ponto azul claro).
- `avence-studio-empilhada-preto.svg` / `.png` e `avence-studio-empilhada-claro.svg` / `.png`: "STUDIO" embaixo de "avence", para espaços estreitos e perfis.
- `avence-simbolo.svg` / `.png` e `avence-simbolo-claro.svg` / `.png`: o "a" com o ponto.
- `avence-icone.svg` / `.png` (o quadrado de tinta do favicon antigo, "a" em papel, ponto azul claro: favicon) e `avence-icone-azul.svg` / `.png` (fundo azul, ponto em tinta: avatar das redes).
- `avence-marca-anterior.png`: a marca antiga, só para o antes e depois.

Construção: "avence" em Instrument Serif Regular, espaçamento −0,015em; o ponto é um quadrado de 0,12 da altura da letra, a 0,025 do "e", sobre a linha de base; "STUDIO" em Inter Tight Medium com 0,19 da altura da letra e +0,26em, na mesma linha de base (horizontal) ou embaixo, alinhado ao "a" (empilhada). Na página, o cabeçalho e o rodapé escrevem a assinatura em texto nativo, com o mesmo desenho. Tamanho mínimo: assinatura com 96px de largura, símbolo com 16px. Área livre: a altura do "a" em volta de tudo.

## 3. Cores

| Papel | Cor | Uso |
|---|---|---|
| Tinta | `#111111` | Títulos, faixas escuras, rodapé |
| Tinta levantada | `#1B1B1B` | Cartões e molduras sobre a tinta |
| Papel | `#F3F1EC` | Fundo da página |
| Pedra | `#E6E2D9` | Superfícies secundárias |
| Branco | `#FFFFFF` | Cartões, a linha de serviço em foco, o formulário |
| Azul do ponto | `#2B3CF0` | O ponto, botões (texto branco, 7:1), o destaque em itálico, rótulos pequenos no papel, a faixa de quem recebeu a prévia |
| Azul fundo | `#1F2CC4` | Troca de cor dos botões azuis |
| Azul claro | `#8F9BFF` | O ponto, os destaques, rótulos e números na tinta (7,5:1) |
| Névoa | `#E4E7FD` | Etiquetas e destaques suaves |
| Texto / apoio / filete | `#3A3833` / `#66625A` / `#DCD8CF` | No papel |
| Na tinta | `#D8D5CD` / `#9D998F` | Texto e apoio |

Um azul só. O verde do WhatsApp fica no botão flutuante.

## 4. Tipografia

**Inter Tight** (Google Fonts) em tudo e **Instrument Serif** (Google Fonts, itálico) nos destaques.

| Uso | Tamanho | Fonte |
|---|---|---|
| Título da abertura | 100px (68px tablet, 46px celular), entrelinha 0,96, −0,045em | Inter Tight 500 |
| Título de seção | 60px (46 / 36px), entrelinha 1, −0,035em | Inter Tight 500 |
| Destaque | uma palavra por título, 1,1 vez o tamanho, azul | Instrument Serif itálico |
| Nome do case | 64px (50 / 40px), −0,04em | Inter Tight 500 |
| Números grandes (contador) | 56px | Instrument Serif |
| Texto de abertura | 19px / 1,55 | Inter Tight 400 |
| Texto | 16px / 1,7 | Inter Tight 400 |
| Rótulo | 12px, caixa alta, 0,14em, com o ponto azul na frente | Inter Tight 500 |
| Botão | 12,5px, caixa alta, 0,1em, com a seta | Inter Tight 600 |

A Instrument Serif não aparece em nenhum ajuste de fonte das seções (o Space trocaria pela família da marca): ela entra pelo CSS das próprias seções e é carregada pelo widget de comportamento da abertura.

## 5. Linguagem

- **Grade**: conteúdo de 1240px com margens de 32/24/16px; seções com 128/96/72px. Filetes de 1px organizam a página; números em algarismos tabulares.
- **Cantos**: retos nos botões, cartões, campos e telas. A exceção é o menu de vidro (abaixo) e o celular das telas.
- **O ponto** azul marca os rótulos, os itens das listas, a etapa da prévia e o contador dos cases. Na entrada do site, ele é o último a chegar: cresce, aparece e entra em foco depois que o nome se revela.
- **Grão**: um ruído fino e cinza sobre a página toda, a 6,5%, que se mexe de leve (dez passos por segundo), como papel vivo. Parado para quem pede menos movimento. Ele é comportamento do widget da abertura, não fica nos ajustes das seções.
- **Meio-tom**: pontos azuis (ou papel, no azul) numa grade fina a 45°, bem suaves (12 a 24% de opacidade, com degradê nas bordas), só em alguns cantos: abertura, a faixa azul e o contato. Os cases ficam sem pontos (pedido de 2026-10-04): o fundo escuro é liso, para as telas falarem. Arquivos em `public/brands/avence-studio/texturas/`, gerados por `.space/avence-studio/build/gen-halftone.cjs`. O usuário pediu "muito mais suave" depois da primeira versão.
- **Menu de vidro**: no topo, o cabeçalho é a faixa de papel. Ao rolar, ele se solta e vira uma barra de vidro de cantos arredondados (20px; 18px no celular), com respiro nas laterais (36px antes da assinatura, 14px depois do botão; 24px e 10px no celular), papel a 62% com desfoque e saturação, filete branco por dentro e uma sombra em camadas, com transições de mola (cubic-bezier(.22,1,.36,1)). O botão de dentro arredonda junto (10px, concêntrico); o espaço entre os itens não muda. O cabeçalho tem altura fixa no fluxo (73px; 65px no celular) e a barra cresce por cima: se ele empurrasse a página, tudo abaixo descia 37px ao rolar e os cases soltavam fora do lugar.
- **Setas**: "→" nos botões, com a ponta em ângulo reto; "↗" para ver um site ao vivo. Nada de ícones genéricos de foguete, lâmpada ou alvo.
- **Telas**: na galeria da abertura, só as telas, soltas, sem nome nem endereço (o usuário pediu foco no visual); nos cases, a tela do computador sem barra de endereço e o celular ao lado, com a página real dentro.

## 6. O momento-assinatura

A entrada, uma vez por visita, em cerca de 2 s, só com desaceleração (nada de quique), e pode ser interrompida (um toque, uma tecla ou a roda a aceleram quatro vezes):

1. **0 a 0,65 s** — numa tela de papel, o logo inteiro ("avence" e "STUDIO") se revela de baixo para cima, por uma máscara, subindo 16px.
2. **0,5 a 0,85 s** — o ponto azul chega por último: escala de 0,25 a 1, opacidade de 0 a 1, desfoque de 4px a 0.
3. **0,85 a 1,75 s** — o logo voa e encolhe até o seu lugar no cabeçalho, como um elemento compartilhado (o caminho é medido pela linha de base do logo de verdade), e troca com ele quando chega; o papel some por baixo.
4. **1,1 a 1,9 s** — a abertura entra em partes, a 80 ms uma da outra: rótulo, título, texto, botões (sobem 20px, de 0 a 1 de opacidade, desfoque de 4px a 0).
5. **1,35 a 2 s** — as telas da galeria sobem 32px, da esquerda para a direita; então a galeria começa a andar, com a velocidade subindo de zero.

A galeria corre em duas fileiras e se arrasta com o mouse ou o dedo, com inércia (com o mouse em cima, desacelera bastante). Nos cases, a seção fica presa e a página de cada site desce dentro da janela; o último case fica parado um instante e a seção solta exatamente onde estava, sem pulo, com a seção seguinte colada embaixo. Tudo é comportamento de um único widget HTML (GSAP e ScrollTrigger do jsDelivr), respeitando quem pede menos movimento; sem ele, no editor do Elementor e nas miniaturas do Space, a página já está pronta, parada.

## 7. Voz

- Direta, calma e concreta. Mostra o trabalho em vez de prometer; a velocidade aparece no processo (um link do começo ao fim), não num prazo inventado.
- Os cases dizem só o que dá para ver no site: nome, segmento, cidade quando o site diz, o que a página tem e a plataforma. Sem números, resultados, depoimentos ou "o cliente aumentou".
- Chamadas: "Conversar no WhatsApp", "Ver os cases", "Ver o site ao vivo", "Começar uma conversa".
