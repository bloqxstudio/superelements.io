---
name: Emmanuel Becker Advocacia
description: Escritório do advogado Emmanuel Reche Becker (OAB/RS 84.677), na sala 1304 do Platinum Executive Center, no Centro de São Leopoldo (RS), com atendimento presencial e online. Prospecto, não é cliente. Marca montada em 2026-10-03 a partir do monograma ERB, do letreiro do logo e do caça-palavras que abre o site atual.
source: logo, fotos e fontes do site atual (erbadvocacia.com.br, uploads de 2025/02 e 2025/03), retrato do site da Becker & Becker Advogados (2022); fatos e pendências em brands/emmanuel-reche-becker/COPY.md
colors:
  primary: "#29282B"
  on-primary: "#FFFFFF"
  secondary: "#353437"
  footer: "#1E1D20"
  logo-gray: "#4D4C4E"
  accent: "#CD3539"
  accent-ink: "#B02A2F"
  accent-light: "#EE5054"
  background: "#F8F7F5"
  surface-stone: "#EEECE8"
  text-strong: "#232225"
  text-body: "#46454A"
  muted: "#636267"
  border: "#DCD9D3"
  on-dark-strong: "#EFEEEB"
  on-dark-soft: "#C6C4C0"
  on-dark-muted: "#9B9995"
fonts:
  heading:
    family: IBM Plex Mono
  body:
    family: Sora
radius:
  button: 6px
logo:
  on-light: /brands/emmanuel-reche-becker/logo/erb-monograma.png
  on-dark: /brands/emmanuel-reche-becker/logo/erb-monograma.png
  alt: Emmanuel Becker Advocacia
photos:
  - url: /brands/emmanuel-reche-becker/fotos/emmanuel-retrato.webp
    alt: Emmanuel Reche Becker, advogado, de terno escuro e gravata vermelha, com as mãos juntas
  - url: /brands/emmanuel-reche-becker/fotos/escritorio-sala.webp
    alt: Sala de atendimento com mesa de madeira, notebook e janelas amplas para São Leopoldo
  - url: /brands/emmanuel-reche-becker/fotos/escritorio-reuniao.webp
    alt: Sala de reunião com mesa de madeira, cadeiras pretas e janelas para a cidade
  - url: /brands/emmanuel-reche-becker/fotos/escritorio-recepcao.webp
    alt: Recepção do escritório, com poltronas, um quadro e o balcão de madeira
---

# Emmanuel Becker Advocacia — DESIGN.md

Escritório do advogado Emmanuel Reche Becker (OAB/RS 84.677), na Rua São Joaquim, 611, sala 1304 (Platinum Executive Center), no Centro de São Leopoldo. Atende pessoas e empresas em trânsito e CNH, bancos e dívidas, consumo, saúde, viagens, seguros, família, herança e imóveis. Anuncia no Google. **Prospecto**: este sistema serve à nova versão do site que vamos mostrar ao escritório. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias, o canto do botão, o logo e as fotos. Não tem papel de rótulo, peso ou entrelinha de título, cartão, divisor nem efeitos, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está abaixo e nos builders (`src/features/rechebecker/`).

## 1. Conceito: o caça-palavras

O site atual abre com uma grade de letras cinza em que duas palavras estão em vermelho: CASO e SOLUÇÃO. É a melhor ideia do site, e o site novo parte dela. Quem chega por um anúncio tem um problema e procura a palavra dele: CNH, dívida, nome, voo, plano, herança. O site novo é **o caça-palavras resolvido**.

- **A abertura é a grade, viva.** Um título curto diz o que o escritório faz e onde fica; ao lado, a grade de letras do site atual, com as áreas escondidas em cinza e CASO e SOLUÇÃO achadas, em vermelho e circuladas, como se faz no jogo. Embaixo, o rosto e a OAB de quem atende.
- **As áreas são a lista de palavras.** Treze situações em primeira pessoa ("Minha CNH foi suspensa."), com a palavra-chave circulada em vermelho, agrupadas em trânsito, bancos, consumo e família. Cada uma abre o WhatsApp com o assunto escrito.
- **O primeiro contato** são os quatro passos do método que o próprio site descreve: mensagem, consulta, proposta, procuração.
- O vermelho do monograma é a palavra achada: aparece pouco, e sempre no que importa.
- Fora do clichê jurídico: nada de martelo, balança, estátua, aperto de mão, estante de livros ou foto de banco de imagem. A foto de escritório com balanças do site atual não volta.

## 2. Logo

O monograma ERB (três letras traçadas em linhas paralelas vermelhas) é o logo usado no site novo, em `public/brands/emmanuel-reche-becker/logo/erb-monograma.png` (512 × 512, fundo transparente; serve no claro e no grafite). Ao lado dele, o nome "Emmanuel Becker" em texto nativo, na monoespaçada, e "Advocacia" em rótulo.

O logo completo (monograma e letreiro) existe em duas tintas: `erb-assinatura-cinza.png` (letreiro cinza, para o claro) e `erb-assinatura-branco.png` (letreiro branco, para o grafite, usado no rodapé). Os arquivos não têm "logo" no nome de propósito: o Space trocaria a imagem pelo monograma da marca. Logo e monograma têm sempre largura explícita no modelo (36px no cabeçalho, 220px no rodapé), para a marca aplicada por cima reconhecer o arquivo e manter o tamanho.

## 3. Cores

- **Grafite** `#29282B` (o fundo da grade do site atual) na abertura, no primeiro contato e no contato; **grafite levantado** `#353437` nos cartões sobre ele; **rodapé** `#1E1D20`. O **cinza do letreiro** `#4D4C4E` só nas letras de fundo da grade.
- **Papel** `#F8F7F5` e **pedra** `#EEECE8` nas faixas claras; branco nos cartões e no formulário. Títulos `#232225`; texto `#46454A`; apoio `#636267`; filetes `#DCD9D3`.
- **Vermelho** `#CD3539` (o do monograma) é o único destaque: botão principal com texto branco (5:1), o anel dos rótulos e as palavras achadas. Texto vermelho pequeno no claro usa o **vermelho escuro** `#B02A2F` (6,5:1 no branco, 5,5:1 na pedra), que também é a troca de cor do botão. No grafite, as palavras achadas e os números grandes usam o **vermelho claro** `#EE5054`.
- No grafite, títulos `#EFEEEB`, texto `#C6C4C0` e apoio `#9B9995`.
- O verde do WhatsApp aparece só no botão flutuante. Sem degradê.

## 4. Tipografia

Duas famílias do Google Fonts:

- **IBM Plex Mono** (letra por casa, como na grade do caça-palavras) nos títulos, nas situações, nos números, nas perguntas e nas letras da grade; peso 500, entrelinha curta e espaçamento levemente fechado nos títulos grandes. Na monoespaçada cada letra ocupa 0,6 do tamanho: os títulos são escritos para caber pela contagem de letras (até 18 por linha no celular).
- **Sora** (a fonte de texto do site atual) no texto, nos rótulos, no menu, nos botões e no formulário. Rótulos em caixa alta espaçada, com um pequeno anel vermelho na frente.

A marca não tem papel `label` de propósito: sem ele, o Space trata rótulos e botões com a fonte de texto, que já é a do modelo.

| Uso | Tamanho | Fonte |
|---|---|---|
| Título da abertura | 50px (30px no celular) | IBM Plex Mono 500 |
| Título de seção | 40px (26px no celular) | IBM Plex Mono 500 |
| Situação e título de cartão | 19–22px | IBM Plex Mono 500 |
| Texto de abertura | 18px / 1,65 | Sora 400 |
| Texto | 16px / 1,7 | Sora 400 |
| Rótulo | 12px, 0,16em de espaçamento | Sora 600 |
| Botão | 15px | Sora 600 |

## 5. Medidas

Conteúdo de 1200px com margens de 32/24/16px; seções com 112/88/64px em cima e embaixo. Cabeçalho de 72px (64px no celular), preso no topo, no papel. Botões com o canto levemente arredondado do B do monograma (6px); cartões, fotos e o mapa com 10px. Filetes de 1px. Nenhum efeito de profundidade fora do botão flutuante. A grade de letras da abertura é a única textura.

## 6. Retratos e escritório

O retrato recortado do Emmanuel (terno escuro, gravata vermelha), do site da Becker & Becker Advogados, onde ele também atua, e quatro fotos reais do escritório do site atual (recepção, sala de reunião, sala de atendimento com a vista da cidade e a bancada). Sem legenda. Direito de uso e fotos novas são pendência.

## 7. O momento-assinatura

Um só: **o caso se encontra**. Ao abrir a página, as letras da grade se embaralham e assentam, e as duas palavras se acendem em vermelho, letra por letra, primeiro CASO, depois SOLUÇÃO, com o anel em volta. Ao rolar, a palavra circulada de cada situação se embaralha e assenta uma vez, e os blocos marcados chegam uma vez. Botões e links só trocam de cor. Tudo é comportamento de um único widget HTML (GSAP e ScrollTrigger do jsDelivr), atrás de `prefers-reduced-motion`; sem ele, no editor do Elementor e nas miniaturas do Space, a página está pronta e as palavras já achadas.

## 8. Voz

- Direta, como uma boa primeira conversa: frases curtas, a situação nas palavras de quem vive, sem jargão.
- Informa, não promete. Sem "garantimos seus direitos", "solução rápida", "reverter", "especializada", "altamente especializados", "o melhor", "excelência"; sem depoimento, caso, resultado ou preço (Código de Ética da OAB e Provimento 205/2021; ver `COPY.md` §7).
- "Especialização em Processo Civil (UFRGS)" é o título público; "especialista" só nesse sentido, e só depois de o escritório confirmar.
- As chamadas são neutras: "Falar no WhatsApp", "Escolher a situação", "Conversar sobre isso", "Como chegar".
