---
name: Cerveira Braggio Advocacia
description: Escritório de direito imobiliário da advogada Andreza Cerveira Braggio, no Centro de São Leopoldo (RS), com atendimento presencial e online. Prospecto, não é cliente. Marca montada em 2026-10-03 a partir do monograma dourado do logo e das cores do site atual.
source: logo e fotos do site atual (braggio-lawyer.com, uploads de 2025/07) e cores do post-7.css do Elementor; fatos e pendências em brands/cerveira-braggio/COPY.md
colors:
  primary: "#1D1B18"
  on-primary: "#FFFFFF"
  secondary: "#2A2723"
  accent: "#CFA354"
  accent-light: "#DDB866"
  accent-ink: "#7A5C1E"
  background: "#FFFFFF"
  surface-stone: "#F0EFEB"
  text-body: "#45423D"
  muted: "#6B675F"
  border: "#DAD7D0"
  on-dark-soft: "#D3CEC4"
  on-dark-muted: "#A9A397"
fonts:
  heading:
    family: Marcellus
  body:
    family: IBM Plex Sans
radius:
  button: 0px
logo:
  on-light: /brands/cerveira-braggio/logo/cerveira-braggio-monograma-dourado.png
  on-dark: /brands/cerveira-braggio/logo/cerveira-braggio-monograma-dourado.png
  alt: Cerveira Braggio Advocacia
photos:
  - url: /brands/cerveira-braggio/fotos/andreza-retrato.webp
    alt: Andreza Cerveira Braggio, advogada, de camisa rosé, sorrindo, com as mãos juntas
  - url: /brands/cerveira-braggio/fotos/andreza-escritorio.webp
    alt: Andreza Cerveira Braggio no escritório, trabalhando no notebook
---

# Cerveira Braggio Advocacia — DESIGN.md

Escritório de direito imobiliário na Rua São Caetano, 410, no Centro de São Leopoldo. Uma advogada, Andreza Cerveira Braggio (OAB/RS 129.181), que atende quem aluga, mora de aluguel, compra, vive em condomínio, regulariza ou investe em imóveis. **Prospecto**: este sistema serve à nova versão do site que vamos mostrar ao escritório. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias, o canto do botão, o logo e as duas fotos. Não tem papel de rótulo, peso ou entrelinha de título, cartão, divisor nem efeitos, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está abaixo e nos builders (`src/features/cerveirabraggio/`).

## 1. Conceito: a planta

O escritório só trata de imóveis. O site novo fala a língua de quem desenha imóveis: **a planta**. Papel branco, nanquim, uma quadrícula fraca de papel milimetrado e o dourado do logo nas cotas, como num desenho técnico bem feito: preciso, claro, sem enfeite.

- **A abertura é uma prancha.** O retrato recortado da Andreza fica dentro de uma moldura de desenho, sobre a quadrícula, com uma cota embaixo com o nome e a OAB, como a medida de uma planta. Quem chega vê a pessoa que atende antes de qualquer lista.
- **As áreas são cômodos.** Seis situações da vida de quem tem um imóvel ("Meu inquilino parou de pagar o aluguel", "Vou comprar e quero conferir tudo antes de assinar"), desenhadas como os cômodos de uma planta baixa: paredes de nanquim, uma porta aberta em cada uma, o nome técnico da área em anotação e o WhatsApp com o assunto.
- **A advogada tem o carimbo.** A legenda técnica que fica no canto de toda planta (responsável, registro, escala) vira a ficha da Andreza: nome, OAB, formação, perícia judicial e como atende.
- **O primeiro contato é uma cota** com três marcas: mensagem, conversa com os documentos, caminho e honorários antes de começar.
- Fora do clichê jurídico: nada de martelo, balança, estátua, aperto de mão ou foto de banco de imagem. A coluna existe só dentro do monograma, que é o logo real. Os prédios de banco de imagem do site atual não voltam.

## 2. Logo

O monograma "CB" em dourado, com uma coluna no meio do B, é o logo usado no site novo, em `public/brands/cerveira-braggio/logo/cerveira-braggio-monograma-dourado.png` (512 × 512, fundo transparente; o mesmo arquivo serve no branco e no nanquim). Ao lado dele, o nome "Cerveira Braggio" em texto nativo, em Marcellus, e "Advocacia" em anotação.

O logo completo (`cerveira-braggio-logo-dourado.png`) traz "Advogados Associados", que não bate com o registro de sociedade individual (`COPY.md` §7): fica guardado até o escritório decidir o nome. O monograma tem largura explícita no modelo (40px no cabeçalho, 34px no celular), para a marca aplicada por cima reconhecer o arquivo e manter o tamanho.

## 3. Cores

- **Papel** `#FFFFFF` é o fundo da página; **concreto** `#F0EFEB` nas faixas alternadas (situações, dúvidas).
- **Nanquim** `#1D1B18` nos títulos, no botão principal, nas paredes da planta, na faixa do primeiro contato e no rodapé; **nanquim levantado** `#2A2723` nos cartões sobre o nanquim. Texto `#45423D`; apoio `#6B675F`; filetes `#DAD7D0`.
- **Dourado** `#CFA354` (o do logo e do site atual) é o único destaque: cotas, quadradinhos das anotações, números e o botão nas faixas escuras, sempre com texto em nanquim (7,4:1). Texto dourado só sobre o nanquim. No claro, anotações pequenas usam o **dourado escuro** `#7A5C1E` (6,2:1 no branco). `#DDB866` é a troca de cor do botão dourado.
- No nanquim, texto `#D3CEC4` e apoio `#A9A397`.
- O verde do WhatsApp aparece só no botão flutuante. O degradê verde dos botões do site atual não volta.

## 4. Tipografia

Duas famílias do Google Fonts:

- **Marcellus** (capitulares romanas, como o letreiro do logo) nos títulos, nas situações, nos números e nas perguntas, sempre em caixa normal, peso 400, entrelinha curta.
- **IBM Plex Sans** (a letra técnica) no texto, nas anotações, no menu e nos botões. Anotações em caixa alta espaçada, com números tabulares, como as legendas de uma planta.

A marca não tem papel `label` de propósito: sem ele, o Space trata anotações e botões com a fonte de texto, que já é a do modelo.

| Uso | Tamanho | Fonte |
|---|---|---|
| Título da abertura | 70px (40px no celular) | Marcellus 400 |
| Título de seção | 48px (32px no celular) | Marcellus 400 |
| Situação e título de cartão | 23–26px | Marcellus 400 |
| Texto de abertura | 19px / 1,6 | IBM Plex Sans 400 |
| Texto | 17px / 1,65 | IBM Plex Sans 400 |
| Anotação | 12px, 0,16em de espaçamento | IBM Plex Sans 500 |
| Botão | 15px | IBM Plex Sans 600 |

## 5. Medidas

Conteúdo de 1200px com margens de 32/24/16px; seções com 120/88/64px em cima e embaixo. Cabeçalho de 76px (64px no celular), preso no topo. Tudo em ângulo reto, como num desenho: botões, cartões, fotos e o mapa. Paredes da planta em nanquim de 2px; filetes de 1px. Nenhum efeito de profundidade fora do botão flutuante. A quadrícula (24px, com linha mais forte a cada 96px) é a única textura, fraca e com máscara, na abertura e na chamada final.

## 6. Retratos

Duas fotos reais do site atual: o retrato recortado (camisa rosé, fundo transparente), que fica sobre a quadrícula da abertura, e a foto no escritório (notebook, painel de madeira e o biombo vazado preto), na seção da advogada. Sem legenda. Direito de uso e fotos novas são pendência.

## 7. O momento-assinatura

Um só: **a planta se desenha**. Ao abrir a página, a moldura da prancha se traça, a quadrícula entra da esquerda para a direita como uma impressora de planta, o retrato chega e a cota com o nome se estende do centro para as pontas. Ao rolar, a planta das situações se traça do mesmo jeito uma vez, e os blocos marcados chegam uma vez. Botões e links só trocam de cor. Tudo é comportamento de um único widget HTML (GSAP e ScrollTrigger do jsDelivr), atrás de `prefers-reduced-motion`; sem ele, no editor do Elementor e nas miniaturas do Space, a página está pronta e a planta já desenhada.

## 8. Voz

- Clara e objetiva, como uma boa leitura de contrato: frases curtas, sem jargão, sem drama.
- Informa, não promete. Sem "evite prejuízos", "resolução ágil", "atendimento imediato", "altamente capacitados", "o melhor", "excelência"; sem depoimento, caso, resultado ou preço (Código de Ética da OAB e Provimento 205/2021; ver `COPY.md` §7).
- "Pós-graduada em Direito Imobiliário" é o fato do site; "especialista" só depois de o escritório confirmar o título.
- As chamadas são neutras e no feminino quando falam da advogada: "Conversar pelo WhatsApp", "Ver as situações", "Como chegar".
