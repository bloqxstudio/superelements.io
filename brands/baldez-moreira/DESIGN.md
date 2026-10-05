---
name: Baldez & Moreira Advogados Associados
description: Escritório de advocacia no Centro de São Leopoldo (RS), com foco em INSS e previdência, bancos e dívidas, trabalho, acidentes e família. Prospecto, não é cliente. Marca montada em 2026-10-03 a partir do logo público (monograma BM em ouro metálico com o anel "advogados associados") e do azul-marinho do site atual.
source: logo e cores do site atual (baldezmoreira.adv.br, biblioteca de mídia pública e post-6.css do Elementor); fatos e pendências em brands/baldez-moreira/COPY.md
colors:
  primary: "#07101F"
  on-primary: "#ECE7DD"
  accent: "#CDA766"
  on-accent: "#07101F"
  accent-hover: "#E0C185"
  accent-ink: "#7A5A22"
  secondary: "#031F47"
  surface-raised: "#0D1A2E"
  black-deep: "#040A15"
  background: "#F4F0E8"
  surface: "#FFFFFF"
  text-heading: "#031F47"
  text-body: "#3A4253"
  muted: "#5E6677"
  on-dark-soft: "#AEB6C4"
  on-dark-dim: "#8A93A3"
  border: "#DDD5C6"
fonts:
  heading:
    family: Jost
  body:
    family: Albert Sans
radius:
  button: 2px
logo:
  on-light: /brands/baldez-moreira/logo/baldez-moreira-monograma.png
  on-dark: /brands/baldez-moreira/logo/baldez-moreira-selo-fundo-escuro.png
  symbol: /brands/baldez-moreira/logo/baldez-moreira-monograma.png
  symbol-on-dark: /brands/baldez-moreira/logo/baldez-moreira-monograma.png
  alt: Baldez & Moreira Advogados Associados
---

# Baldez & Moreira — DESIGN.md

Escritório de advocacia na Galeria Basile, no Centro de São Leopoldo. **Prospecto**: este sistema serve à nova versão do site que o Superelements vai mostrar ao escritório. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias, o canto do botão e o logo. Não tem papel de rótulo, peso ou entrelinha de título, cartão, divisor, sombra nem movimento, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está abaixo.

## 1. Conceito: o selo

O logo do escritório é um selo: o monograma **BM** (a perna do B desenha o M) em ouro metálico, dentro de um anel de texto "advogados associados". O site novo é **editorial, escuro e tipográfico**, montado a partir desse selo:

- Fundo noite (`#07101F`), quase preto, com o azul-marinho do site atual (`#031F47`) numa faixa só. Navy e ouro são a marca real do escritório; o que tira o clichê é a composição: tipo grande e leve, muito espaço, filetes retos e o selo como único ornamento.
- **O selo é o momento-assinatura.** Na abertura, o anel de texto (recortado do logo) fica separado do monograma: ao abrir a página ele chega girando um pouco, e depois gira devagar com a rolagem, enquanto o monograma fica parado no centro.
- Nada de martelo, balança, coluna, estante de livros, aperto de mão ou foto de banco de imagem (o site atual usa estante e colunas; o novo não). Sem foto real autorizada, a página é composição tipográfica.
- Diferente dos outros escritórios mostrados lado a lado: este é o escuro, de presença, com tipo geométrico enorme.

## 2. Logo

Arquivos em `public/brands/baldez-moreira/logo/` (origem de cada um no `COPY.md` § 11):

| Arquivo | Uso |
|---|---|
| `baldez-moreira-selo-fundo-escuro.png` (840 px) | O selo inteiro, como no site atual: monograma ouro e anel branco. Só no escuro. É o `on-dark` da marca. |
| `baldez-moreira-monograma.png` (314 × 348) | Só o monograma, recortado do selo. Funciona no claro e no escuro. Cabeçalho (34 px de largura), rodapé (44 px). |
| `baldez-moreira-anel.png` (840 px) | Só o anel de texto, em branco, transparente no meio. Camada que gira na abertura. |
| `baldez-moreira-selo-centro.png` (840 px) | Só o monograma, no mesmo quadro de 840 px do anel, para empilhar os dois sem desalinhar. |
| `baldez-moreira-selo-metalico-359.png` | Versão metálica pequena e serrilhada. Só referência. |

O nome do escritório no cabeçalho e no rodapé é **texto nativo**: "Baldez & Moreira" em Jost 500 e "Advogados Associados" em Albert Sans caixa alta espaçada. O logo e o monograma têm largura explícita, para a marca aplicada por cima reconhecer o arquivo e manter o tamanho. Pendente: o vetor do logo e a fonte do anel.

## 3. Cores

| Papel | Cor | Uso |
|---|---|---|
| Noite | `#07101F` | Fundo do cabeçalho, da abertura, das etapas e do contato |
| Noite acima | `#0D1A2E` | Painéis no escuro |
| Azul-marinho | `#031F47` | A cor do kit do site atual: a faixa "O escritório" e os títulos no papel |
| Fundo do rodapé | `#040A15` | Rodapé |
| Ouro | `#CDA766` | O tom claro do degradê do logo. Botões, números, filetes, a palavra em destaque. Texto em cima é a noite (8,5:1) |
| Ouro, hover | `#E0C185` | |
| Ouro escuro | `#7A5A22` | Rótulos pequenos no papel (5,6:1); o ouro claro não passa no claro |
| Texto no escuro | `#ECE7DD` / `#AEB6C4` / `#8A93A3` | Branco quente (15:1), apoio (9:1), apoio fraco só a partir de 14 px (6:1) |
| Papel | `#F4F0E8` | Faixas claras (áreas, perguntas) |
| Texto no papel | `#031F47` títulos, `#3A4253` texto, `#5E6677` apoio (5:1) | |
| Linhas | `rgba(205,167,102,.22)` no escuro, `#DDD5C6` no papel | |

**Um ouro só.** O ouro nunca é fundo de faixa; vive em botões, números, filetes e numa palavra por título. O verde do WhatsApp aparece só no botão flutuante.

## 4. Tipografia

**Jost** (Google Fonts), geométrica como o monograma e o anel do logo, nos títulos: peso 300, grande, apertada (−0,02 a −0,025em), entrelinha 1,0 a 1,06. **Albert Sans** no texto, nos rótulos, no menu e nos botões. Botões em caixa normal (é advocacia, não promoção); rótulos em caixa alta espaçada (0,22em) com um filete de 28 px na frente.

| Uso | Tamanho | Peso |
|---|---|---|
| Título da abertura | 84 px (64 tablet, 44 celular) | Jost 300 |
| Frase de destaque | 64 px (52, 36) | Jost 300 |
| Título de seção | 52 px (42, 32) | Jost 300 |
| Situação / etapa | 24 px (22, 20) | Jost 400 |
| Número de etapa | 56 px (48, 40) | Jost 200, ouro |
| Texto de abertura | 19 px / 1,6 (17 no celular) | Albert Sans 400 |
| Texto | 17 px / 1,65 (16) | Albert Sans 400 |
| Rótulo | 12 px, caixa alta, 0,22em | Albert Sans 600 |
| Botão e menu | 15 px | Albert Sans 600 / 500 |

## 5. Layout e forma

Conteúdo de 1240 px com margens de 40/28/18 px; seções com 128/96/72 px em cima e embaixo. Cabeçalho fixo de 84 px (68 no celular). Botões com 2 px de canto (quase retos, como as hastes do monograma); painéis com 4 px. Linhas finas e retas separam as coisas; círculos só no selo. Sem sombra, a não ser no menu do celular e no WhatsApp flutuante.

Ordem da Home: cabeçalho, abertura com o selo, áreas como situações da vida (papel), como funciona o primeiro atendimento (noite), o escritório (azul-marinho), perguntas (papel), contato e endereço com mapa (noite), rodapé com a ficha da OAB, WhatsApp flutuante.

## 6. Movimento

Um widget HTML só de comportamento, primeiro filho da abertura (`src/features/baldezmoreira/story.ts`), carrega GSAP e ScrollTrigger do jsDelivr:

- **Selo**: o anel chega girando −50° → 0° e aparecendo; o monograma aparece. Depois, o anel gira até 90° enquanto a abertura sai da tela (scrub, sem pin).
- Textos da abertura sobem 14 px e aparecem em sequência curta.
- No celular, o selo vira uma marca-d'água fraca, cortada no canto de cima à direita, acima do título; gira do mesmo jeito.
- Blocos `.bm-rise` sobem 18 px uma vez ao entrar, em lote.

O CSS sozinho já é a composição final: o script só arma estados escondidos. Movimento reduzido, editor do Elementor (`elementor-editor-active`), miniaturas do canvas e páginas que não rolam não rodam nada. Nenhuma animação de entrada do Elementor na página (a `fill-mode: both` delas anula o transform do GSAP). Botões só trocam de cor; a seta dos links anda um pouco com o mouse.

## 7. Voz e regras da OAB

- Informativa, discreta e simples. O princípio do próprio escritório, "Falamos a língua do nosso cliente", guia o texto: frases curtas, sem juridiquês, sem exclamação, sem emoji.
- As áreas aparecem como **situações da vida** ("Fiquei sem poder trabalhar por doença"), com o nome da área embaixo.
- Nunca: "especialista" (sem título comprovado), promessa de resultado, "garantir seu direito", "o que é seu por direito", gratuidade ("análise gratuita"), preço, número de processos ou de clientes, depoimento, print de avaliação, comparação com colegas, Asseprevi ou outra atividade.
- Sempre: nome do advogado responsável e número da OAB/RS (pendente), nome registrado da sociedade, endereço, contatos. A nota do Google aparece só como dado discreto de localização, marcada como pendência.
