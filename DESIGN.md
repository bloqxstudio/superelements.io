---
version: alpha
name: Saipos — saipos.com
description: Linguagem visual do site institucional da Saipos (home nova, prefixo `nh-`), extraída do CSS publicado.
source: https://saipos.com/ — CSS inline do build Astro, lido em 2026-09-26
colors:
  primary: "#280E59"            # --nh-primary · "Mirtilo" (DS: #280E5A)
  on-primary: "#F0EBE2"
  secondary: "#286EFF"          # --nh-secondary · "Curaçao"
  secondary-deep: "#0842BB"     # --nh-header-blue (só existe como var no header; no resto é hex solto)
  secondary-deep-hover: "#06318C" # --nh-header-blue-hover
  secondary-ring: "#C5D8FF"     # borda do CTA de demonstração
  accent: "#FF4B1E"             # --nh-accent · "Tangerina"
  background: "#F0EBE2"         # --nh-bg · "Vanilla"
  surface-cream: "#FAF5EB"      # --nh-header-cream · "Chantilly"
  surface-card-warm: "#F4EFE6"  # cards de depoimento
  surface: "#FFFFFF"
  text-heading: "#280E59"
  text-dark: "#231158"          # texto do FAQ
  text-body: "#26374C"          # subtítulos de seção
  text-gray: "#4A4A4A"
  text-gray-alt: "#414141"
  success: "#28A745"
  error: "#E53E3E"
  error-modal: "#C0392B"
typography:
  display-hero:
    fontFamily: Iquost
    fontSize: clamp(3.4rem, 5.5vw, 4.6rem)
    fontWeight: 900
    lineHeight: 1.08
    letterSpacing: -0.03em
  heading-section:
    fontFamily: Iquost
    fontSize: clamp(2rem, 5vw, 3.5rem)
    fontWeight: 800
    lineHeight: 1.1
  heading-blog:
    fontFamily: Iquost
    fontSize: clamp(1.9rem, 3.2vw, 2.8rem)
    fontWeight: 800
    lineHeight: 1.2
  metric-number:
    fontFamily: Iquost
    fontSize: clamp(1.8rem, 5vw, 2.8rem)
    fontWeight: 800
    lineHeight: 1
  card-title:
    fontFamily: Roboto
    fontSize: 1.4rem
    fontWeight: 700
  lead:
    fontFamily: Roboto
    fontSize: 1.2rem
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: Roboto
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: Roboto
    fontSize: 0.875rem
    fontWeight: 400
  eyebrow:
    fontFamily: Roboto
    fontSize: 0.875rem
    fontWeight: 700
  micro-caps:
    fontFamily: Roboto
    fontSize: 0.65rem
    fontWeight: 700
    letterSpacing: 0.05em
rounded:
  xs: 6px
  sm: 8px
  md: 12px
  card-sm: 16px
  faq: 18px
  card: 24px
  feature: 28px
  hero: 40px
  pill: 999px
spacing:
  section-gap: 80px
  container: 1200px
  container-wide: 1400px
  container-narrow: 1100px
  header-height: 5rem
  bento-gap: 16px
components:
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "#FFFFFF"
    border: 4px solid {colors.secondary-ring}
    rounded: "{rounded.pill}"
    padding: 1rem 2rem
  button-primary-hover:
    backgroundColor: "{colors.secondary-deep}"
  button-conversion:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 0.95rem 1.5rem
  button-header:
    backgroundColor: "{colors.secondary-deep}"
    textColor: "{colors.surface-cream}"
    rounded: "{rounded.pill}"
    padding: 0.6rem 1.2rem
  eyebrow-badge:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    border: 0.16rem solid {colors.secondary-deep}
    rounded: "{rounded.pill}"
    padding: 0.25rem 1.75rem
  input:
    backgroundColor: "#FFFFFF"
    border: 1.5px solid rgba(40,14,89,.15)
    rounded: "{rounded.md}"
    padding: 0.75rem 1rem
  card-form:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.card}"
    shadow: 0 8px 40px rgba(40,14,89,.10)
---

# Saipos — DESIGN.md

Documento de referência da linguagem visual do **saipos.com**, para que qualquer página ou seção nova feita neste projeto pareça parte do site. Tudo aqui foi lido do CSS publicado (e conferido nos estilos computados do navegador), não inventado. Onde o site é inconsistente, o documento registra a inconsistência em vez de "arrumar".

> **Escopo.** O site tem duas gerações de CSS convivendo:
>
> 1. **Home nova** (`/`), com classes `nh-*` e a marca 2026. **É o padrão descrito neste documento.**
> 2. **Páginas internas legadas** (`/cardapio-digital`, `/planos-e-precos` etc.), com classes `section-*`, `menu_item`, `text-container`: fundo branco, coral `#F46F60`, cinza `#646772`, raio 4–6px. Veja [Legado](#legado-páginas-internas). Não use como referência para peças novas.

---

## 1. Atmosfera

Quente, confiante e comercial. A página é um **fundo areia (Vanilla `#F0EBE2`)** sobre o qual flutuam **blocos arredondados** e grandes: o hero é um cartão roxo-mirtilo com raio de 40px, recuado das bordas da tela; os demais blocos (bento, carrossel, formulário) usam raio de 24px. O roxo profundo carrega autoridade; o azul Curaçao e o azul profundo `#0842BB` fazem a ação e o destaque; a Tangerina aparece pouco e sempre para converter (botão do formulário, selos).

Títulos em **Iquost muito pesado** (800–900), curtos, quebrados em duas ou três linhas, com a frase-chave pintada de azul. O corpo usa Roboto em tamanho confortável. Quase tudo que é clicável tem formato **pílula**.

Há ilustrações decorativas soltas (bicicleta de entrega, moedas, garfo, mão, traço) que flutuam devagar em loop, e fotos reais de restaurantes e produtos em cards.

---

## 2. Cores

### Variáveis que existem no CSS

Use estes nomes ao escrever CSS novo, não os hex:

| Custom property | Hex | Nome na marca (DS Saipos) | Papel no site |
|---|---|---|---|
| `--nh-primary` | `#280E59` | Mirtilo | Títulos, texto de navegação, fundo do hero, rodapé, painel do carrossel |
| `--nh-secondary` | `#286EFF` | Curaçao | CTA principal de demonstração, anel de foco, borda do selo do hero, selos azuis |
| `--nh-accent` | `#FF4B1E` | Tangerina | Botão de envio do formulário, selo "Sistema"/"Soluções" no menu, tint de cards do bento |
| `--nh-bg` | `#F0EBE2` | Vanilla | Fundo da página e do header |
| `--nh-header-blue` | `#0842BB` | (sem equivalente no DS) | CTA do header, **destaque de palavras nos títulos**, números das métricas, bordas dos selos de seção, hover de links |
| `--nh-header-blue-hover` | `#06318C` | — | Hover do CTA do header |
| `--nh-header-cream` | `#FAF5EB` | Chantilly | Texto do CTA do header, fundo dos itens do FAQ, modal, tags |
| `--card-tint` | = primary / secondary / accent | — | Cor do degradê no rodapé de cada card do bento |

`--nh-header-*` só são declaradas dentro de `.nh-header`. No resto da página, `#0842BB` e `#FAF5EB` aparecem como hex solto. `#0842BB` é a cor com mais ocorrências no CSS da home (18).

### Cores usadas sem variável

| Hex | Onde |
|---|---|
| `#FFFFFF` | Cartão do formulário, texto sobre fundos escuros e fotos |
| `#F4EFE6` | Fundo dos cards de depoimento |
| `#F7F4EE` | Fallback de `--nh-bg` no bloco do blog |
| `#231158` | Texto do FAQ (quase-mirtilo) |
| `#26374C` | Subtítulos e descrições de seção (azul-ardósia) |
| `#4A4A4A`, `#414141` | Corpo do accordion e resumo dos posts |
| `#C5D8FF` | Anel de 4px em volta do CTA de demonstração |
| `#263C85` | Título de agradecimento do modal de saída |
| `#FF1212` | Filete de 2px sob os títulos de coluna do rodapé |
| `#28A745` | Estado de sucesso do formulário |
| `#E53E3E` / `#C0392B` | Erro: formulário do hero / modal de saída |

### Transparências recorrentes

O site deriva estados e divisores do Mirtilo com alfa, em vez de usar cinzas:

- **Hover de fundo:** `#280E590D` a `#280E5912` (5–7%)
- **Divisores e bordas:** `rgba(40,14,89,.08)` a `.15`
- **Texto secundário:** Mirtilo com `opacity` de .45 a .75, ou `#280E59A6`/`#280E59B3`
- **Sombras:** tingidas de Mirtilo (`#280E591A`, `#280E591F`)
- **Sobre o roxo:** branco a 12% (botões), 60% (texto do rodapé), 72% (links do rodapé)

### Inconsistências registradas

- **Quatro cremes quase iguais:** `#F0EBE2`, `#F4EFE6`, `#F7F4EE` e `#FAF5EB`. Só o primeiro e o último estão na marca.
- **Mirtilo com um dígito de diferença:** a home usa `#280E59`; as páginas internas e o DS usam `#280E5A`.
- **Dois azuis de ação:** `#286EFF` (Curaçao) no CTA principal e `#0842BB` no CTA do header e nos destaques. O DS não tem `#0842BB`; o tom mais próximo é `curacao-700 #1148C2`.
- **Dois vermelhos de erro:** `#E53E3E` e `#C0392B`.
- **Quatro cores de texto escuro** além do Mirtilo: `#231158`, `#26374C`, `#4A4A4A` e `#414141`.

---

## 3. Tipografia

### Famílias

| Família | Uso | Arquivos servidos |
|---|---|---|
| **Iquost** | `h1`, `h2`, `h3`: títulos, números de métricas, títulos de coluna do rodapé | `/fonts/iquost/iquost-regular.woff2` (**só o peso 400**) |
| **Roboto** | `body`: todo o resto, incluindo UI, formulários e navegação | `/fonts/roboto/roboto-regular.woff2` (400) e `roboto-bold.woff2` (700) |
| Georgia | Somente as aspas decorativas dos depoimentos | sistema |

Regras base: `body{font-family:Roboto,sans-serif;line-height:1.5}` e `h1,h2,h3{font-family:Iquost,sans-serif}`.

### Pesos: o que está no CSS e o que renderiza

- **Iquost 800/900** nos títulos é **negrito sintético**, gerado pelo navegador a partir do único arquivo, que é 400. É isso que dá o aspecto "gordo" dos títulos atuais.
- **Roboto 500** (navegação) renderiza como 400, e **Roboto 600** (selos, labels) renderiza como 700, porque só os pesos 400 e 700 são servidos.
- **`<button>` renderiza em Arial.** O reset aplica `font:inherit` em vários elementos, mas não em `button`, `input` e `select`. Por isso o CTA de demonstração, o botão do formulário e as perguntas do FAQ aparecem em Arial (conferido em `getComputedStyle`). Para uma peça nova ficar igual à intenção do design, declare `font-family: inherit` nos controles.

### Escala usada na home

| Papel | Família / peso | Tamanho | Line-height / tracking | Cor |
|---|---|---|---|---|
| Hero `h1` | Iquost 900 | `clamp(3.4rem, 5.5vw, 4.6rem)`, ~74px no desktop | 1.08 / `-0.03em` | `#F0EBE2` sobre Mirtilo |
| Título de seção `h2` | Iquost 800 | `clamp(2rem, 5vw, 3.5rem)`, 56px | 1.1–1.15 | Mirtilo; palavra-chave em `<span>` `#0842BB` |
| Título do blog `h2` | Iquost 800 | `clamp(1.9rem, 3.2vw, 2.8rem)` | 1.2 | Mirtilo e `#0842BB` |
| Número de métrica | Iquost 800 | `clamp(1.8rem, 5vw, 2.8rem)` | 1 | `#0842BB` |
| Label de métrica | Iquost 700, CAIXA ALTA | `clamp(1rem, 4vw, 1.4rem)` | — | `#0842BB` |
| Título do formulário | Iquost 700 | 1.35rem | — | Mirtilo |
| Título de card do bento | Roboto 700 | 1.4rem | — | Branco |
| Título de coluna do rodapé `h3` | Iquost 700 | 1.15rem | — | Branco |
| Lead / subtítulo de seção | Roboto 400 | 1.1–1.2rem | 1.6 | `#26374C` |
| Subtítulo do hero | Roboto 400 | `clamp(.9rem, 1.8vw, 1.125rem)` | 1.3 / `-0.02em` | Vanilla a 85% |
| Corpo | Roboto 400 | 1rem | 1.5 | varia |
| Link de navegação | Roboto 500 | 1rem | — | Mirtilo |
| Selo de seção (eyebrow) | Roboto 700 | .85–.875rem | — | Mirtilo |
| Texto pequeno / links do rodapé | Roboto 400–600 | .875rem | 1.4–1.6 | — |
| Microtexto em caixa alta (selos, labels de coluna) | Roboto 700 | .6–.75rem | `.05em`–`.08em` | — |

**Não há escala tipográfica em tokens.** Cada componente declara o próprio `clamp()` ou `rem`. As constantes são: títulos grandes em Iquost 800 com `clamp(2rem, 5vw, 3.5rem)`, e texto de apoio em Roboto de 1 a 1.2rem.

### Padrão de título

```html
<h2 class="nh-tools__title">Uma operação completa <span>de ponta a ponta</span></h2>
<h2 class="content__title">Mais controle, mais lucro,<br><span>negócio saudável.</span></h2>
```

Primeira parte em Mirtilo, parte final em `#0842BB`, quebra manual com `<br>`. O hero é a exceção: é monocromático (Vanilla) e quebrado em três linhas: "Gestão no / ritmo do seu / crescimento".

---

## 4. Layout e espaçamento

- **Não há escala de espaçamento em tokens.** Os valores são `rem`, `px` e `clamp()` declarados por componente, a maioria em múltiplos de 4px, com exceções (`.15rem`, `.35rem`, `.65rem`, `.7rem`, `.85rem`).
- **Ritmo vertical entre seções:** `margin-bottom: 80px`, somado a um `padding` próprio de cada seção (`4rem 0`, ou `clamp(2rem, 6vw, 3rem)` a `clamp(3rem, 6vw, 6rem)`).
- **Larguras de conteúdo:** `max-width: 1200px` na maioria das seções, `1400px` no blog e nos depoimentos, `1100px` no FAQ (lista com `1024px`) e `800px` nos cabeçalhos centralizados.
- **Header fixo** com `height: 5rem` (4rem abaixo de 600px) e fundo Vanilla. O conteúdo começa com `margin-top: 5.5rem`.
- **Hero recuado:** `margin: 5.5rem 1.75rem 0`, raio de 40px e `padding: clamp(3rem,6vw,5rem) clamp(1.5rem,5vw,4rem)`. Grid `1fr 1fr` (texto à esquerda, formulário à direita) com `max-width: 1200px`.
- **Grids recorrentes:** texto + visual em `1fr 1fr` ou `1.1fr .9fr`; blog em `1.7fr 1fr`; depoimentos em `1fr 2fr`; bento com 4 colunas e 3 linhas de 180px (`grid-template-areas`, `gap: 16px`); rodapé em `390px 1fr 1fr 1fr`.
- **Gaps comuns:** 12px, 16px, `.75rem`, `1.25rem`, `1.5rem`, `2rem`, `clamp(2rem, 4vw, 4rem)`.
- **Cabeçalho de seção:** centralizado. Selo pílula, depois título, depois subtítulo, com `margin-bottom` entre 3 e 4rem até o conteúdo.
- Coexiste um grid legado em floats (`.container` com 90%/80%, `.row`, `.col-1` a `.col-12`), usado pelas páginas internas.

---

## 5. Formas (raios)

Conjunto observado na home, do mais usado ao menos usado:

| Raio | Onde |
|---|---|
| `999px` / `8.6rem` (pílula) | **Todos os botões**, selos, tags, badges, barra de progresso |
| `50%` | Setas do carrossel, ícone de login, ícones sociais |
| `40px` | Cartão do hero (24px no mobile) |
| `28px` | Post em destaque do blog |
| `24px` | Cards do bento, cartão do formulário, painel do carrossel |
| `18px` | Itens do FAQ |
| `16px` | Cards de depoimento, miniaturas do blog |
| `15px` | Modal de saída e seus campos e botão (exceção à pílula) |
| `12px` | Inputs, selects, accordion |
| `10px` | Cards do mega menu |
| `8px` | Links de navegação, imagens do mega menu |
| `6px` | Links das colunas do mega menu |

Resumo: **controles são pílula e superfícies ficam entre 16 e 40px**, aumentando com o tamanho do bloco. Não há cantos retos em nada que seja interativo.

---

## 6. Elevação e bordas

Sombras são **raras e tingidas de Mirtilo**. A maioria dos blocos não tem sombra e se separa do fundo apenas pela cor (roxo, branco ou creme sobre Vanilla).

| Sombra | Onde |
|---|---|
| `0 8px 40px #280E591A` | Cartão do formulário do hero |
| `0 20px 40px #280E591F` | Painel do mega menu |
| `0 8px 24px #280E591A` | Sugestões de e-mail |
| `0 20px 60px #00000040` | Modal de saída |
| `0 4px 28px #FF4B1EBF`, pulsando em 2.5s | **Brilho do botão Tangerina** do formulário |
| `0 0 8px #0842BBB3` | Barra de progresso do carrossel |
| `drop-shadow(0 20px 40px rgba(0,0,0,.12))` | Imagem de produto (notebook) |
| `0 0 0 3px #286EFF1F` | **Anel de foco** dos inputs |

**Bordas:**

- Divisores: 1px `rgba(40,14,89,.08–.12)`.
- Inputs: 1.5px `rgba(40,14,89,.15)`.
- Selo de seção: `.16rem` (cerca de 2.5px) ou 2px `#0842BB`.
- Anel do CTA de demonstração: 4px `#C5D8FF` (3px na versão compacta).

**Vidro:** há um único uso de glassmorphism, na legenda do post em destaque do blog (`rgba(255,255,255,.1)`, `backdrop-filter: blur(19px)`, borda branca a 30% e brilhos internos). Não é um padrão do site.

**Degradês:** só funcionais. São véus de legibilidade sobre fotos (`transparent 35%` até `--card-tint` nos cards do bento; `transparent 55%` até `rgba(0,0,0,.18)` nos depoimentos) e os filetes de brilho do vidro. **Não há fundo em degradê** na home.

---

## 7. Movimento

- **Durações:** .15s, .18s, .2s, .25s, .3s, .35s e .5s (zoom de imagem).
- **Curvas:** `ease` e `ease-in-out` na maioria; `cubic-bezier(.16,1,.3,1)` no mega menu; `cubic-bezier(.22,1,.36,1)` no zoom do post; `cubic-bezier(.2,.8,.2,1)` na entrada do modal.
- **Hover de botão:** sobe `translateY(-1px)` (header) ou `-2px` (CTAs) e escurece o fundo. Em `:active`, volta a 0.
- **Hover de card:** o card do bento cresce para `scale(1.02)`; a imagem dos depoimentos para `scale(1.06)`; o post em destaque para `scale(1.04)`.
- **Hover de item de menu:** `translate(3px)` para a direita, com fundo Mirtilo a 5–6%.
- **Mega menu:** `opacity` e `translateY(-10px → 0)` em .25s.
- **Accordion:** `grid-template-rows: 0fr → 1fr` em .3s. O FAQ usa `max-height` em .35s. O chevron gira 180°.
- **Decorações flutuantes:** bicicleta, moedas e garfo oscilam de 10 a 14px em loops de 5 a 7s, com atrasos diferentes.
- **Pulso:** o brilho do botão Tangerina alterna opacidade de .45 a 1 em 2.5s e para no hover.
- **Não há `prefers-reduced-motion` na home.** O bundle das páginas internas tem uma regra.

---

## 8. Componentes

### Header
Fixo, fundo Vanilla, 5rem de altura. Logo à esquerda (mascote laranja e wordmark "saipos" em minúsculas, roxo), com 40px de altura (32px no mobile) e `scale(1.05)` no hover. Links "Sistemas", "Soluções", "Planos e preços" e "Seja um revendedor" em Roboto 500, 1rem, Mirtilo, com `padding: .5rem .75rem`, raio 8px e fundo Mirtilo a 7% no hover.

À direita ficam o **"Entrar"**, um link-pílula fantasma em `#0842BB` 700 com ícone num círculo azul de 32px (borda aparece no hover), e o **"Ver demonstração"**, uma pílula `#0842BB` com texto Chantilly, .85rem 700, `padding: .6rem 1.2rem`, que vai para `#06318C` no hover. Abaixo de 1024px, a navegação vira hambúrguer.

### Mega menu
Painel de largura total abaixo do header, fundo Vanilla, `border-top` Mirtilo a 8% e sombra `0 20px 40px #280E591F`.

- **Esquerda:** coluna de 280px com cards "Em Destaque": imagem de 86px com raio 8px, selo Tangerina em caixa alta .65rem, título .88rem 700 e descrição .78rem a 60%. O card em destaque tem borda Curaçao de 1.5px sobre Curaçao a 4%.
- **Direita:** colunas de links separadas por filete. O label fica em caixa alta .75rem, `letter-spacing: .08em`, 45% de opacidade; os links em .9rem 500 a 75%.

### Selo de seção (eyebrow)
```css
display:inline-flex; padding:.25rem 1.75rem; background:var(--nh-bg);
border:.16rem solid #0842bb; border-radius:8.6rem;
color:var(--nh-primary); font-weight:700; font-size:.875rem; margin-bottom:1.25rem;
```
Textos observados: "FAQ", "Só a Saipos tem". **No hero** a variante é transparente, com borda de 2px Curaçao, texto Vanilla .8rem 600 e `padding: .4rem 1rem`.

### Botões

| Variante | Classe | Estilo | Uso |
|---|---|---|---|
| **CTA de demonstração** | `.nh-demo-cta` | Fundo `#286EFF`, **borda de 4px `#C5D8FF`**, pílula, branco 600, `1rem 2rem` / 1.2rem. Hover: `#0842BB` e `translateY(-2px)`. Compacto: `1rem 1.5rem`, borda 3px, .9rem | Fim de cada seção, centralizado ou alinhado ao texto |
| **Conversão** | `.nh-demo-form__submit` | Fundo `#FF4B1E`, branco 700 1rem, pílula, largura total, `.95rem 1.5rem`, brilho Tangerina pulsando. Sucesso: `#28A745` | Envio do formulário |
| **Header** | `.nh-header__cta-btn` | Fundo `#0842BB`, texto Chantilly, .85rem 700, pílula | Header |
| **Fantasma** | `.nh-header__cta-login` | Transparente, texto `#0842BB` 700, borda aparece no hover, fundo `#0842BB0D` | "Entrar" |
| **Modal** | `.hb-cta` | Fundo Mirtilo, texto Chantilly, 48px de altura, **raio 15px**, Roboto 600 16px. Hover: Curaçao | Modal de saída |

Textos dos CTAs: "Ver demonstração", "Agende a sua demonstração", "Quero otimizar meus lucros", "Conheça nossas funcionalidades", "Centralize a gestão do seu restaurante" e "Solicitar Demonstração Gratuita". **Toda seção termina num CTA de demonstração.**

### Formulário de demonstração (hero)
Cartão branco com raio 24px, `padding: 2.25rem 2rem`, `max-width: 480px` e sombra `0 8px 40px #280E591A`. Título "Veja a Saipos em ação" (Iquost 700, 1.35rem, centralizado) e subtítulo .88rem Mirtilo a 79%.

- **Campos:** label .85rem 600 Mirtilo. Input com `padding: .75rem 1rem`, borda 1.5px Mirtilo a 15%, raio 12px, .9rem e placeholder Mirtilo a 50%.
- **Foco:** borda Curaçao mais anel de 3px Curaçao a 12%.
- **Erro:** `#E53E3E`, com mensagem .78rem 600 precedida de "⚠".
- **Telefone:** select de DDD de 90px ao lado do campo.
- **Rodapé do formulário:** "Seus dados estão seguros. Não enviamos spam.", em .78rem, com ícone de cadeado.

### Métricas
Três números centralizados em linha ("25.000+ Restaurantes", "11M+ Pedidos/mês", "+100 integrações"): número em Iquost 800 `#0842BB` e label em caixa alta. O `gap` chega a 10rem no desktop.

### Accordion de benefícios
Item com fundo Chantilly a 40% e raio 12px. Cabeçalho em 700 1rem Mirtilo com `padding: 1.2rem`; corpo em .95rem `#4A4A4A`. O primeiro item vem aberto.

### Bento de produtos
Grid de 6 cards com fotos reais (App de Gestão, SmartPOS, Garçom, Kanban, App Entregador, PDV). Cada card tem raio 24px, imagem em `object-fit: cover` e um véu que vai de `transparent 35%` até `--card-tint` (Mirtilo, Curaçao ou Tangerina, alternados). Texto branco na base com `padding: 24px`: nome em 1.4rem 700 e descrição em .9rem a 90%. Hover: `scale(1.02)`. O grid passa a 2 colunas abaixo de 1024px e a 1 coluna abaixo de 600px.

### Diferenciais
Imagem de produto à esquerda (com `drop-shadow`) e lista de checks à direita. Cada item tem ícone `check-blue.svg`, título .95rem 700 e descrição .85rem, ambos em Mirtilo. Uma ilustração de mão decora o canto inferior direito.

### Depoimentos (carrossel)
Painel Mirtilo com raio 24px contendo um trilho com `scroll-snap` e 2 cards visíveis (78–85% da largura no mobile).

- **Card:** fundo `#F4EFE6`, raio 16px, foto 4:3.
- **Conteúdo:** tag em pílula .6rem caixa alta `#0842BB` sobre `#0842BB1A`; aspas em Georgia; citação em .76rem 600 `#0842BB`; autor em .7rem 700, separado por filete.
- **Controles:** barra de progresso de 3px (trilho Vanilla, preenchimento `#0842BB` com brilho) e setas em círculos de 32px brancos a 12%.

### Blog
Grid `1.7fr 1fr`. Post em destaque com raio 28px, `min-height: 420px` e legenda em vidro (tag Chantilly/`#0842BB`, título branco 400 em `clamp(1.3rem, 2vw, 1.7rem)`, "Ler artigo completo" sublinhado). Lista lateral com miniaturas de 88px e raio 16px, título 1.05rem 600 Mirtilo (`#0842BB` no hover) e resumo .88rem `#414141` cortado em 2 linhas.

### FAQ
Lista de itens com fundo Chantilly, raio 18px e `gap: .75rem`. Pergunta em 700 1rem `#231158`, às vezes com badge pílula .72rem (azul Curaçao, Tangerina ou Mirtilo). O chevron é desenhado com bordas CSS de 2px. Resposta em .95rem `#231158` a 75%, com `line-height: 1.7`. Garfo e moedas decorativos flutuam à esquerda.

### Rodapé
Fundo Mirtilo com `padding: 3.5rem 0 2.5rem`. A primeira coluna traz logo horizontal, endereço (branco a 60%), redes sociais em ícones de 36px e selos (GPTW, Site Protegido, RA1000 ReclameAQUI, Stone Official Partner) em grid de 4. As três colunas seguintes são "Sistema", "Saipos" e "Soluções": título em Iquost 700 1.15rem branco com **filete de 2px `#FF1212`** embaixo, e links .875rem 600 a 72% (brancos no hover).

### Modal de saída (exit-intent)
Subsistema à parte, escrito em `px` e com Roboto declarado. Overlay preto a 55%. Modal Chantilly com raio 15px, `max-width: 620px` e sombra `0 20px 60px #00000040`. Título em Roboto 500 26px Mirtilo com destaque em Curaçao 700 ("demonstração gratuita"). Campos com 48px de altura, fundo Vanilla, borda 1px Mirtilo e raio 15px. Botão Mirtilo com raio 15px e link "Não, obrigado" sublinhado.

---

## 9. Imagem e ilustração

- **Logo:** mascote laranja (`#E96312` e `#A44526`) ao lado do wordmark "saipos" em minúsculas, roxo (`#280E59`/`#2C0C5E`). Arquivos em `/assets/`: `logo-full-color.svg`, `logo.svg` e `logo_horizontal.svg`, que é a versão branca do rodapé.
- **Fotografia:** restaurantes, pratos, pessoas e equipamentos reais (notebook, maquininha, celular), sempre recortados em cards arredondados. No bento, a foto recebe véu na cor da marca.
- **Ilustrações decorativas:** objetos soltos com leve volume (`Bike.png`, `Moedas.png`, `garfo.svg`, `mao.svg`, `stroke.svg`) e uma marca-d'água no fundo do hero (`hero-bg-watermark.svg`). Ficam posicionados em `absolute`, flutuando, com `pointer-events: none`, e somem abaixo de 520–720px.
- **Ícones:** SVG simples; checks azuis (`check-blue.svg`); chevrons feitos em CSS.

---

## 10. Voz e texto

- **PT-BR**, trata o leitor por "você" e fala diretamente com o dono do restaurante.
- **Títulos curtos e rítmicos**, frequentemente em tríade ou contraste: "Gestão no ritmo do seu crescimento", "Mais controle, mais lucro, negócio saudável.", "Uma operação completa de ponta a ponta", "Diferenciais que nenhum outro sistema oferece".
- **Benefício concreto antes de funcionalidade:** "Saiba o lucro de cada prato", "Decisões com dados, sem achismo", "Trabalhar no escuro custa caro."
- **Prova social com números:** "25.000+ restaurantes", "11M+ pedidos/mês", "+100 integrações", "mais de 2 mil conteúdos".
- **Sem emoji no texto.**
- **Microtexto de confiança** junto de formulários: "Demonstração gratuita e sem compromisso", "Seus dados estão seguros. Não enviamos spam."

---

## 11. Responsivo

- **Breakpoint principal: 1024px.** Abaixo dele, a navegação vira hambúrguer e os grids de 2 colunas empilham.
- **Outros cortes usados:** 900, 768, 720, 700, 640, 600, 520, 480 e 360px. Cada componente escolhe os seus; não há um conjunto fixo.
- **Tipografia fluida** com `clamp()` em quase todos os títulos e paddings.
- **Hero no mobile (≤720px):** raio de 24px, margem lateral de .3rem, texto centralizado, formulário embaixo e decorações ocultas.

---

## 12. O que não existe (e uma peça nova não deve introduzir)

- **Modo escuro:** não há `prefers-color-scheme` nem tema escuro. O "escuro" do site é o bloco roxo Mirtilo.
- **Fundos em degradê:** degradê só aparece como véu de legibilidade sobre foto.
- **Sombras em cards comuns:** sombra só no formulário, em overlays (menu, modal) e no brilho do botão de conversão.
- **Botões retangulares ou com cantos pequenos:** botão é pílula (a única exceção é o modal de saída, com 15px).
- **Cinzas neutros como cor de UI:** os tons de apoio são derivados do Mirtilo com transparência.
- **Tokens de espaçamento e escala tipográfica:** tudo é declarado por componente.
- **`prefers-reduced-motion` na home.**

---

## 13. Divergências em relação ao Design System Saipos

Comparação com `saipos-design-system/tokens/tokens.json` (Guia de marca 2026). O DS é a fonte oficial; o site publicado diverge assim:

| Tema | DS | Site (home) |
|---|---|---|
| Mirtilo | `#280E5A` | `#280E59` |
| Azul escuro de ação | `curacao-600 #1C5CE6`, `curacao-700 #1148C2` | `#0842BB` e `#06318C` (fora do DS) |
| Texto de corpo | `ink-700 #3B2E55` | `#26374C`, `#231158`, `#4A4A4A`, `#414141` |
| Raios | 8 / 14 / 20 / 28 / pill | 6 / 8 / 10 / 12 / 15 / 16 / 18 / 24 / 28 / 40 / pill |
| Espaçamento | Escala de 4px (tokens) | Valores soltos por componente |
| Pesos de Iquost | display em bold | 800/900 sintéticos (só o arquivo 400 é servido) |
| Nomes de variável | `--color-mirtilo`, `--color-curacao`... (existem nas páginas internas) | `--nh-primary`, `--nh-secondary`, `--nh-accent`, `--nh-bg` |

Cores do DS que não aparecem na home: Açafrão `#FFB81C`, Avelã `#DC6B2F` e Marsala `#5A190F`. Açafrão e Avelã aparecem nas páginas internas e num tema de campanha (`.nh-copa`, que troca `--nh-primary` por Tangerina e `--nh-accent` por Açafrão).

---

## Legado (páginas internas)

As páginas de produto e segmento ainda usam o bundle antigo, com alguns blocos novos misturados (o formulário `nh-demo-form` e `.section-form` com raio de 40px). Os traços do legado são:

- **Cores:** coral `#F46F60` em links, hover e botões, e em heros "Laranja"; cinza `#646772` no texto; `#292D34` nos títulos; azul `#3767B1` em heros "Azul".
- **Fundos:** brancos e `#F8F8F8`.
- **Header:** branco com sombra `1px 1px 8px #00000029`; links em 14px 700 `#646772`, que ficam coral no hover.
- **Raios:** botões com 4px, cards com 6px e submenus com 10px.
- **Cards de link:** 150×150 com borda `#EAEAEA` e sombra `1px 1px 70px #0000000F`.

Isso é a identidade anterior à marca 2026. **Não sirva de referência para peças novas**; está aqui para que ninguém copie esses valores achando que são atuais.

---

## Guia rápido para agentes

Para gerar uma seção nova "no padrão saipos.com":

1. **Fundo e títulos:** fundo `var(--nh-bg)`; título em Iquost 800, `clamp(2rem,5vw,3.5rem)`, `var(--nh-primary)`, com a frase final em `<span>` `#0842BB`.
2. **Cabeçalho da seção:** selo pílula com contorno `#0842BB` acima do título; subtítulo em Roboto 1.1–1.2rem `#26374C`.
3. **Superfícies:** blocos com raio de 24px, em Mirtilo (fundo escuro), branco ou Chantilly `#FAF5EB`. Sem sombra, a não ser que seja um formulário ou overlay.
4. **Fechamento:** um `.nh-demo-cta` (pílula Curaçao com anel `#C5D8FF` de 4px, hover `#0842BB` subindo 2px). Tangerina fica reservada ao botão de envio de formulário.
5. **Controles:** declarar `font-family: inherit` em `button`, `input` e `select`.
6. **Largura e respiro:** `max-width: 1200px`; 80px entre seções; empilhar abaixo de 1024px.
7. **Texto:** PT-BR, "você", benefício concreto, números reais e nenhum emoji.
