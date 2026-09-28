---
version: alpha
name: Caramelo Pet
description: Marca de exemplo de um petshop de bairro (banho e tosa, creche, hotel e loja), criada em 2026-09-28 para o projeto de exemplo do Space. Não é um cliente real.
source: marca fictícia; a paleta saiu da foto /sections/c25/businesses/pet-daycare.webp (pelo caramelo, camiseta azul-marinho, piscina azul)
colors:
  primary: "#1F2A44"         # azul-marinho: títulos, texto forte, faixas escuras e rodapé
  on-primary: "#FFFFFF"
  accent: "#F2994A"          # caramelo: botões, ícones, marcas pequenas; texto em cima é azul-marinho (6,4:1)
  on-accent: "#1F2A44"
  accent-hover: "#E5832C"
  accent-ink: "#9A4A0B"      # caramelo escuro para rótulos pequenos no creme (5,9:1)
  secondary: "#9ED8F7"       # azul-piscina: a faixa da loja e os selos
  background: "#FFF7EC"      # creme
  surface: "#FFFFFF"
  surface-warm: "#FDE9D3"    # caramelo claro: faixa dos planos e fundo dos ícones
  text-heading: "#1F2A44"
  text-body: "#4B5468"
  muted: "#6B7285"           # 4,5:1 no creme, só a partir de 14px
  on-dark-soft: "#C9D1E3"
  border: "#EEDFCB"
typography:
  display-hero:
    fontFamily: Fredoka
    fontSize: 64px
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.02em
  heading-section:
    fontFamily: Fredoka
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: -0.015em
  card-title:
    fontFamily: Fredoka
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: Nunito
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: Nunito
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
rounded:
  button: 999px
  field: 14px
  card: 24px
  surface: 32px
spacing:
  container: 1200px
  gutter: 32px
  section: 96px
shadow: "0 18px 40px -24px rgba(31,42,68,.35)"   # só no plano em destaque e no selo sobre a foto
divider: "1px solid #EEDFCB"
motion:
  entrance: fade-up         # sobe 14px ao entrar na tela, atrás de prefers-reduced-motion
  duration: 520ms
  easing: cubic-bezier(.2,.7,.2,1)
  hover: none               # botões só trocam de cor (180ms) e encolhem para 0,96 ao pressionar
  cardHover: lift           # cartões sobem 4px com o mouse
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.button}"
    padding: 16px 28px
    typography: Nunito 16px 800
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    border: "2px solid {colors.primary}"
    rounded: "{rounded.button}"
logo:
  symbol: /brands/caramelo-pet/logo/caramelo-pet-symbol.svg
  symbol-on-dark: /brands/caramelo-pet/logo/caramelo-pet-symbol-reverse.svg
  alt: Caramelo Pet
photos:
  - url: /sections/c25/businesses/pet-daycare.webp
    alt: Cachorro caramelo saltando na piscina da creche, com a monitora ao fundo
---

# Caramelo Pet — DESIGN.md

Marca de exemplo para testar o Space com um negócio de bairro. O nome homenageia o vira-lata caramelo. Tudo aqui é fictício: endereço, telefone, preços e depoimentos do modelo são de exemplo e devem ser trocados pelos do cliente.

## 1. Atmosfera

Petshop de bairro, alegre e cuidadoso. Página em creme com títulos em azul-marinho, **um caramelo só** para chamadas e ícones, e o azul-piscina numa faixa (a loja). A foto é de ação, com água e cor; o resto da página respira em blocos lisos e cartões brancos.

## 2. Logo

Símbolo: pata azul-marinho num quadrado caramelo de cantos redondos (`caramelo-pet-symbol.svg`); no fundo escuro, o inverso. O nome "Caramelo" é escrito em Fredoka 600 ao lado do símbolo, como texto do site, e não como imagem.

## 3. Cores

- Azul-marinho `#1F2A44` em títulos, texto forte, na faixa "Como funciona" e no rodapé.
- Caramelo `#F2994A` só em botões, ícones e pequenas marcas; hover `#E5832C`. O texto sobre o caramelo é sempre azul-marinho: branco não passa em contraste.
- Rótulos pequenos no creme usam o caramelo escuro `#9A4A0B`.
- Azul-piscina `#9ED8F7` na faixa da loja e nos selos.
- Creme `#FFF7EC` de fundo, cartões brancos, caramelo claro `#FDE9D3` na faixa dos planos e no fundo dos ícones, linhas `#EEDFCB`.

## 4. Tipografia

Fredoka 600 nos títulos (arredondada, amigável, sem ficar infantil) e Nunito no texto. O rótulo acima de cada título (eyebrow) é Nunito 800, caixa alta, 12px, espaçado 0,12em; os outros textos pequenos (menu, preço, nome) ficam em caixa normal.

| Uso | Tamanho | Peso |
|---|---|---|
| Título do hero | 64px (40px no celular) | Fredoka 600 |
| Título de seção | 44px (32px no celular) | Fredoka 600 |
| Título de cartão | 22px | Fredoka 600 |
| Texto | 17px / 1,6 | Nunito 400 |
| Texto de apoio | 15px | Nunito 400 |
| Rótulo | 12px caixa alta | Nunito 800 |
| Botão | 16px | Nunito 800 |

## 5. Layout e forma

Conteúdo de 1200px com margens de 32/24/16px; seções com 96/72/56px em cima e embaixo. Botões em pílula, campos com 14px de raio, cartões com 24px e superfícies grandes (foto do hero, faixas) com 32px. Cartões brancos no claro levam borda fina `#EEDFCB`; na faixa azul-marinho, o cartão é um tom acima (`#2A3656`) com filete branco a 8%. A sombra só aparece no plano em destaque e no selo sobre a foto.

## 6. Movimento

Hover troca cor em 180ms e o cartão sobe 4px (só com mouse). Botões encolhem para 0,96 ao pressionar. Entradas curtas ao rolar. Tudo atrás de `prefers-reduced-motion`; nada essencial depende de hover.

## 7. Voz

- Fala com o tutor como vizinho: próxima, clara e sem exagero.
- Chama o bicho pelo que ele é ("seu pet", "seu cão", "sua gata"), nunca "cliente".
- Mostra o cuidado com fatos concretos: foto do antes e depois, secagem sem susto, produtos hipoalergênicos, hora marcada.
- Um convite por seção, quase sempre para o WhatsApp.
- Evita diminutivo em excesso e piada forçada.
