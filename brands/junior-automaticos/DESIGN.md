---
version: alpha
name: Júnior Automáticos
description: Oficina especializada em câmbio automático e automatizado em São José dos Campos (SP), há cerca de 40 anos, de gestão familiar. Marca montada em 2026-09-28 a partir do logo do cliente.
source: logo do cliente (pasta "IDENTIDADE VISUAL" no Google Drive, arquivos em brands/junior-automaticos/reference); copy em brands/junior-automaticos/COPY.md; layout de referência socambio.com.br
colors:
  primary: "#0B0B0C"         # preto do logo: títulos, cabeçalho, hero e faixas escuras
  on-primary: "#FFFFFF"
  accent: "#CF9B3A"          # dourado do logo: botões, ícones, a palavra em destaque; texto em cima é preto (7,9:1)
  on-accent: "#0B0B0C"
  accent-hover: "#E0B24F"
  accent-ink: "#7A5818"      # dourado escuro para rótulos pequenos no claro (5,9:1)
  secondary: "#151517"       # preto um tom acima: cartões no escuro e a faixa das marcas
  background: "#F6F3EE"      # papel quente das faixas claras
  surface: "#FFFFFF"
  text-heading: "#0B0B0C"
  text-body: "#4A4A50"
  muted: "#6B6B72"           # 4,8:1 no papel, só a partir de 14px
  on-dark-soft: "#B8B8BC"
  on-dark-dim: "#8E8E94"     # apoio no preto (6:1)
  black-deep: "#060607"      # rodapé
  border: "#E4DED4"
typography:
  display-hero:
    fontFamily: Saira
    fontSize: 60px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.01em
  heading-section:
    fontFamily: Saira
    fontSize: 44px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.01em
  card-title:
    fontFamily: Saira
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: Barlow
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: Barlow
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
rounded:
  button: 6px
  card: 12px
spacing:
  container: 1200px
  gutter: 32px
  section: 96px
shadow: "0 18px 40px -22px rgba(0,0,0,.55)"   # só no menu do celular e no botão flutuante do WhatsApp
motion:
  entrance: fade-up         # sobe 14px ao entrar na tela, atrás de prefers-reduced-motion
  duration: 520ms
  easing: cubic-bezier(.2,.7,.2,1)
  hover: none               # botões só trocam de cor (180ms) e encolhem para 0,96 ao pressionar
  cardHover: none           # cartões só ganham a borda dourada com o mouse
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.button}"
    padding: 15px 26px
    typography: Barlow 15px 600
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
logo:
  on-dark: /brands/junior-automaticos/logo/junior-automaticos-logo-horizontal.png
  symbol-on-dark: /brands/junior-automaticos/logo/junior-automaticos-simbolo.png
  alt: Júnior Automáticos
---

# Júnior Automáticos — DESIGN.md

Oficina de câmbio automático e automatizado em São José dos Campos, fundada pelo Sr. Júnior há cerca de 40 anos e hoje gerida pelo Rafael. A identidade vem do logo do cliente: uma alavanca de câmbio automático com as marchas P R N D e meia engrenagem, em dourado e prata com relevo, sobre preto.

## 1. Atmosfera

Oficina técnica de confiança, com cara de peça bem acabada. Faixas pretas (cabeçalho, hero, diagnóstico, história, contato) alternam com faixas de papel quente, como no site de referência. **Um dourado só**, para chamadas, ícones e a palavra em destaque do título. O único "efeito" é o do próprio logo: o símbolo em 3D sob um foco de luz dourada no hero e uma grade técnica bem fraca ao fundo de algumas faixas.

## 2. Logo

Os arquivos do cliente são imagens 3D em fundo preto, sem versão vetorial nem versão para fundo claro. Deles saíram três PNGs com fundo transparente (o preto virou transparência), que só funcionam sobre fundo escuro:

- `junior-automaticos-logo-horizontal.png`: símbolo ao lado de JÚNIOR / AUTOMÁTICOS, no cabeçalho (46px de altura; 38px no celular) e no rodapé (56px). É o `on-dark` da marca.
- `junior-automaticos-simbolo.png`: só o símbolo, no hero. É o `symbol-on-dark`.
- `junior-automaticos-logo.png`: o logo empilhado inteiro, com a linha "Especialistas em câmbio automático", para usos fora da página (redes, assinatura). A página não usa: a marca trocaria uma terceira versão pelo logo horizontal.

No modelo, o logo e o símbolo têm largura explícita. É assim que a marca, aplicada por cima, reconhece o arquivo dela e mantém o tamanho.

O logo nunca vai sobre as faixas claras. Pendente: pedir ao cliente o arquivo vetorial e uma versão para fundo claro.

## 3. Cores

- Preto `#0B0B0C` no cabeçalho, no hero e nas faixas escuras; um tom acima (`#151517`) nos cartões dessas faixas e na faixa das marcas; `#060607` no rodapé.
- Dourado `#CF9B3A` só em botões, ícones, filetes e na palavra em destaque; hover `#E0B24F`. O texto sobre o dourado é sempre preto.
- No claro, rótulos pequenos usam o dourado escuro `#7A5818`: o dourado puro não passa em contraste no papel.
- Papel `#F6F3EE` de fundo claro, cartões brancos, linhas `#E4DED4`.
- Texto no preto `#B8B8BC`; apoio `#8E8E94`. Texto no claro `#4A4A50`; apoio `#6B6B72`.
- Prata `#C7C7CB` só nas marcas de carro da faixa.
- O verde do WhatsApp aparece só no botão flutuante.

## 4. Tipografia

Saira 700 nos títulos (desenho técnico e quadrado, parente do letreiro do logo), sempre com entrelinha 1,1 e espaçamento −0,01em. Barlow no texto e também nos rótulos, no menu e nos botões: rótulos e botões em caixa alta e espaçados, como a linha "Especialistas em câmbio automático" do logo e como no site de referência. Menu, preços e nomes ficam em caixa normal. Números grandes (+40, 01 a 06) em Saira 700.

A marca não tem papel `label` de propósito: sem ele, o Space trata rótulos e botões com a fonte de texto, que já é a do modelo. Um `label` em Saira ou com caixa alta reescreveria o menu e os botões da página.

| Uso | Tamanho | Peso |
|---|---|---|
| Título do hero | 60px (36px no celular) | Saira 700 |
| Título de seção | 44px (30px no celular) | Saira 700 |
| Frase de destaque | 28px | Saira 700 |
| Título de cartão | 20px | Saira 700 |
| Texto | 17px / 1,65 | Barlow 400 |
| Texto de apoio | 15px / 1,65 | Barlow 400 |
| Rótulo | 12px caixa alta, 0,16em | Barlow 700 |
| Botão | 15px caixa alta, 0,06em | Barlow 600 |

## 5. Layout e forma

Conteúdo de 1200px com margens de 32/24/16px; seções com 96/72/56px em cima e embaixo. Cabeçalho fixo no topo, 80px (64px no celular). Botões com 6px de raio; cartões, painéis e o mapa com 12px. Cartões claros levam borda `#E4DED4`; no preto, o cartão é `#151517` com filete branco a 9%, e os filetes entre faixas escuras também são brancos a 9% (por isso o front matter não tem `divider`: um divisor bege entraria nas faixas pretas). Rótulo com filete dourado de 22px na frente. Sombra só no menu do celular e no botão do WhatsApp.

## 6. Movimento

Botões trocam de cor em 180ms e encolhem para 0,96 ao pressionar. Cartões só ganham a borda dourada com o mouse. Entradas curtas ao rolar. No hero, o seletor P R N D "engata" uma vez ao abrir a página (P, R, N acendem e apagam, o D fica aceso). Tudo atrás de `prefers-reduced-motion`; sem movimento, o D já aparece aceso. Nada essencial depende de hover.

## 7. Voz

- Fala como o mecânico de confiança: direta, técnica sem jargão e sem prometer milagre.
- Primeiro o diagnóstico, depois a solução: "Antes de trocar peças, é preciso entender o problema."
- Prova é tempo de casa e especialização (40 anos, câmbio automático e automatizado), não superlativo.
- Um convite por seção, sempre para o orçamento no WhatsApp.
- Evita promessas de preço, prazo ou garantia que o cliente não passou.

## Revisão visual — 28/09/2026

Iconografia editorial em SVG local (`public/brands/junior-automaticos/icons`), com traço de 2px, preto e detalhes dourados, em quadro de 80px. Os desenhos representam os serviços, sem simular fotografias de cases. Widgets de imagem nativos e textos editáveis.

Faixa das marcas: dois grupos iguais, ciclo linear de 28s, bordas suavizadas por máscara. Sem botão de pausa, conforme solicitado; hover pausa o movimento. Com movimento reduzido, apenas o grupo original aparece, estático e com quebra de linha. Nenhum widget HTML adicionado.

Prévia de validação em `/junior-elementor-preview`, com controles de largura e movimento.
