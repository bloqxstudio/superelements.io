---
version: alpha
name: ProcessBase
description: Identidade visual da ProcessBase (sistemas de crescimento operacional), extraída do arquivo Figma processbase.fig.
source: processbase.fig (exportado em 2026-09-20), decodificado nó a nó em 2026-09-26
colors:
  primary: "#171A2C"        # Navy: fundo institucional, títulos, emblema sobre fundo claro
  on-primary: "#FFFFFF"
  accent: "#FF5900"         # Laranja ignição: o módulo laranja do emblema, destaque e CTA
  on-accent: "#171A2C"      # texto sobre laranja é navy; branco sobre laranja não passa em contraste
  secondary: "#829AAF"      # Ardósia: rótulos e texto de apoio sobre o navy
  background: "#FFFFFF"
  surface-muted: "#F2F3F5"  # faixa cinza-fria que separa seções claras
  text-heading: "#171A2C"
  text-body: "#5E6472"
  border: "#C9CCD3"
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: -0.05em
  heading-section:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: -0.042em
  heading-sub:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -0.033em
  card-title:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1.1
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  eyebrow:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 700
    letterSpacing: 0.15em
    textTransform: uppercase
  micro-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: 400
    letterSpacing: 0.12em
    textTransform: uppercase
rounded:
  block: 0px                # blocos institucionais de cor chapada (capa, cartão laranja)
  card: 16px
  button: 8px               # proposta: o Figma não desenha botões
  app-icon: 18.8%
spacing:
  artboard: 1680px
  margin: 72px
  gutter: 20px
  container: 1536px
shadow: none                # o Figma não usa sombra: a profundidade vem do contraste navy/branco
divider: "1px solid #C9CCD3"
motion:                     # proposta: o Figma é estático
  entrance: fade-up
  duration: 500ms
  easing: "cubic-bezier(0.2, 0.7, 0.2, 1)"
  stagger: 80ms
  hover: none
components:
  eyebrow-on-dark:
    textColor: "{colors.secondary}"
    typography: "{typography.eyebrow}"
  eyebrow-on-light:
    textColor: "{colors.accent}"
    typography: "{typography.eyebrow}"
  hero-dark:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.block}"
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.card}"
  card-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.block}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.button}"
    padding: 14px 24px
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    border: 1.5px solid {colors.primary}
    rounded: "{rounded.button}"
    padding: 14px 24px
logo:                       # vetores do Figma; entram no lugar do logo do site nas seções
  on-light: /brands/processbase/logo/processbase-logo.svg
  on-dark: /brands/processbase/logo/processbase-logo-reverse.svg
  symbol: /brands/processbase/logo/processbase-symbol.svg
  symbol-on-dark: /brands/processbase/logo/processbase-symbol-reverse.svg
  alt: ProcessBase
# photos: o Figma não traz fotos da marca (só referências de terceiros e o mockup do hero)
---

# ProcessBase — DESIGN.md

Referência da identidade visual da **ProcessBase** para montar o site e qualquer peça nova nesta marca. Cores, fontes, medidas e textos foram lidos direto do arquivo `processbase.fig`, nó por nó. Onde o arquivo é inconsistente, o documento registra a inconsistência em vez de "arrumar". O que não está no Figma e foi proposto aqui aparece marcado como **proposta**.

> **Qual rota é a final.** O arquivo guarda três gerações de estudo. A direção adotada é o **emblema facetado** (quatro módulos, um laranja) com o logotipo em Lexend Deca, sobre navy. É o que aparece nas peças mais recentes do arquivo: a capa institucional, a capa com mensagem, os avatares e o mockup do site. Ficaram para trás a rota em azul `#1559C7` ("Quadrante", "Acelerador", "Bloco") e a rota de módulos em "L" (estudo de emblema 03). Não use essas duas como referência.

---

## 1. Atmosfera

Engenharia calma. A marca é **navy quase preto** com **um único ponto laranja**, e muito respiro. O laranja nunca é fundo de página: é a faísca. No emblema, um de quatro módulos é laranja, e essa proporção vale para a página toda: cada tela tem um destaque laranja, não vários.

Títulos grandes em **Inter Regular** com entrelinha justa e espaçamento negativo, sem negrito. O peso vem do tamanho e do contraste, não da espessura. Rótulos pequenos em caixa alta, espaçados, em ardósia sobre o navy ou em laranja sobre o branco.

A forma vem do emblema: **chanfros a 45°** e **cortes oblíquos na inclinação 2:1** (cerca de 63°). Linhas finas laranja nessa inclinação cortam as fotos do hero no mockup do site.

Referências renderizadas do Figma: `reference/capa-institucional.png`, `reference/capa-mensagem.png` e `reference/mockup-hero-site.png`.

---

## 2. Logo

### Arquivos

Todos em `public/brands/processbase/`, gerados a partir dos vetores do Figma. O texto do logotipo está em contornos, então não depende de fonte instalada.

| Arquivo | Uso |
|---|---|
| `logo/processbase-logo.svg` / `.png` | Assinatura horizontal sobre fundo claro (navy + laranja) |
| `logo/processbase-logo-reverse.svg` / `.png` | Assinatura horizontal sobre navy ou foto escura (branco + laranja) |
| `logo/processbase-logo-mono-dark.svg` | Uma cor, navy (impressão, carimbo, fundos coloridos claros) |
| `logo/processbase-logo-mono-white.svg` | Uma cor, branco (sobre laranja ou foto) |
| `logo/processbase-symbol*.svg` / `.png` | Só o emblema, nas mesmas quatro versões |
| `icons/favicon.svg`, `favicon-32.png`, `favicon-48.png` | Favicon (emblema maior dentro do quadrado navy, para ler a 16–32px) |
| `icons/apple-touch-icon.png` | Ícone de 180px para iOS |
| `icons/app-icon.svg`, `app-icon-512.png` | Ícone de app: quadrado laranja, emblema branco (como no Figma) |
| `icons/app-icon-navy.svg` | Ícone alternativo: quadrado navy, emblema branco e laranja |

O WordPress bloqueia upload de SVG por padrão. No Elementor, use os `.png` (1200px de largura para a assinatura) ou instale um plugin de SVG seguro.

No Space, o bloco `logo:` do front matter aponta para esses arquivos. A marca troca o logo do site das seções (cabeçalho, rodapé, login, página "em breve") pela assinatura, na versão do fundo em que ela fica. Na cópia para o Elementor, se o site recusar o SVG, vai o `.png` de mesmo nome.

### Construção

- **Emblema:** quatro módulos idênticos girados a 90° em torno de um vazio central octogonal. Cada módulo tem chanfro externo a 45° e é separado do vizinho por um corte oblíquo 2:1. O módulo laranja fica **no canto superior direito**.
- **Significado** (textos do próprio Figma): os quatro módulos são cultura, processos, treinamentos e estratégia; "encaixes oblíquos conectam o ciclo; o vazio central mantém a marca aberta e legível". O laranja é o ponto de ignição do ciclo.
- **Logotipo:** "ProcessBase" numa palavra só, em **Lexend Deca**: "Process" em Medium (500) e "Base" em ExtraLight (200). Altura do emblema igual à altura total do logotipo com ascendentes.
- **Redução:** o Figma testa o emblema a 16, 24 e 32px e ele se mantém legível. Abaixo de 24px de altura, use só o emblema.

### Não fazer

- Não trocar a posição do módulo laranja nem pintar mais de um módulo de laranja na assinatura. (Os avatares do Figma testam variações com três ou quatro módulos laranja sobre navy; são peças de rede social, não a assinatura.)
- Não escrever "Process Base" separado nem em caixa baixa: o nome da marca é **ProcessBase**.
- Não recompor o logotipo com a fonte: use os arquivos.
- Não colocar camadas, degraus ou setas dentro do emblema. No Figma: "camadas aparecem apenas como linguagem secundária, nunca dentro do emblema"; o emblema expressa continuidade "sem desenhar uma seta".
- **Área de proteção:** não definida no Figma. **Proposta:** manter livre em volta da assinatura a largura de um módulo do emblema (metade da altura do emblema).

---

## 3. Cores

| Papel | Hex | Onde aparece no Figma |
|---|---|---|
| Navy (primária) | `#171A2C` | Fundo das capas, títulos sobre claro, emblema sobre claro |
| Laranja ignição (acento) | `#FF5900` | Módulo laranja do emblema, cartão laranja, rótulos de destaque sobre branco |
| Ardósia (secundária) | `#829AAF` | Rótulos em caixa alta sobre navy ("Sistemas de crescimento operacional") |
| Branco | `#FFFFFF` | Fundo das páginas claras e cards; texto e emblema sobre navy |
| Cinza-frio | `#F2F3F5` | Faixa que separa seções claras; fundo sob os cards brancos |
| Texto corrido | `#5E6472` | Descrições e parágrafos sobre branco |
| Borda | `#C9CCD3` | Linhas finas e divisores |

### Regras

- **Contraste do laranja:** texto sobre laranja é navy (`#171A2C`), como no cartão laranja do Figma. Branco sobre `#FF5900` fica perto de 3:1 e só vale para o emblema e para texto muito grande.
- **Supergráfico:** o emblema em branco a **6% de opacidade**, grande, à direita da capa navy, quase tocando a borda. É o único uso de transparência do Figma.
- O laranja nunca é fundo de seção inteira no site. Pode ser fundo de um card ou bloco de destaque por página.

### Inconsistências registradas

O arquivo tem mais de um tom para cada cor. Os valores canônicos acima são os das aplicações finais (capa, emblema, mockup).

- **Cinco laranjas:** `#FF5900` (emblema e capas), `#F26A21` (avatares e rota azul antiga), `#F8540A` (ícone de app), `#F7540A` e `#F46123` (amostras da paleta). Os arquivos de logo gerados aqui usam `#FF5900`, inclusive o ícone de app.
- **Dois navies:** `#171A2C` nas aplicações e `#15192A` na amostra da paleta.
- **Duas ardósias:** `#829AAF` nas aplicações e `#7990AA` na amostra da paleta.
- **Pretos do emblema monocromático:** `#111111` num estudo, `#000000` noutro. Os arquivos mono gerados aqui usam o navy, não preto.

---

## 4. Tipografia

| Família | Papel | Origem |
|---|---|---|
| **Inter** | Títulos, texto corrido, rótulos, interface | Google Fonts |
| **Lexend Deca** | Só o logotipo (Medium 500 + ExtraLight 200) | Google Fonts |

A escala está no front matter. Resumo:

- **Títulos:** Inter **Regular (400)**, nunca negrito. 64px no hero, 48px em chamadas de seção, 30px em subtítulos, 24px em título de card. Entrelinha de 1,0 a 1,05 e espaçamento negativo (−0,05em no maior, −0,033em nos menores).
- **Texto:** Inter Regular 15px com entrelinha 1,5; 13px com 1,45 em legendas.
- **Rótulo (eyebrow):** Inter Bold 12px, caixa alta, espaçamento 0,15em. Ardósia sobre navy, laranja sobre branco, navy sobre laranja.
- **Micro-rótulo:** Inter Regular 10px, caixa alta, espaçamento 0,12em.
- **Lexend Deca fora do logotipo:** não usar em títulos. Ela é a voz do nome, não do texto.
- **Neue Machina:** aparece num estudo solto ("Empresas feitas para crescer.", em Ultrabold). É fonte paga da Pangram Pangram e não entrou nas aplicações finais. Não usar sem decidir e licenciar.

---

## 5. Forma, grid e imagem

- **Cantos:** cards com raio de **16px**. Blocos institucionais de cor chapada (capa navy, cartão laranja) com **canto reto**. Ícone de app com raio de 18,8% do lado.
- **Botões:** o Figma não desenha nenhum. **Proposta:** raio de 8px, laranja com texto navy no primário e contorno navy de 1,5px no secundário.
- **Grid** (prancha de 1680px): margem lateral de 72px, conteúdo de 1536px, três colunas de ~500px com 20px de calha. Na web, traduzir para um container de 1280–1440px com a mesma calha curta.
- **Diagonais:** qualquer linha decorativa segue a inclinação dos cortes do emblema (2:1, cerca de 63°) ou o chanfro de 45°. Nada de curvas ou ondas.
- **Hero do site** (mockup do Figma): foto real de operação (fábrica, armazém, equipe trabalhando), escura, com camada navy por cima; logotipo no canto superior esquerdo; rótulo em ardósia; título em duas linhas brancas; linhas finas laranja na diagonal atravessando a foto.
- **Seções claras:** fundo branco ou cinza-frio `#F2F3F5`, cards brancos sem sombra, muito espaço vazio.
- **Sombra:** nenhuma. Card se destaca pelo branco sobre o cinza-frio, ou pelo navy sobre o branco.
- **Filetes:** 1px sólido em `#C9CCD3`.
- **Movimento** (**proposta**, o Figma é estático): entrada curta de baixo para cima (500ms, curva que desacelera), com os elementos de um bloco entrando em sequência a cada 80ms. Sem efeito de hover que levante ou aumente peças: o hover só troca a cor. Combina com a ideia de "ritmo" sem distrair.

---

## 6. Voz

Textos tirados do Figma e dos rascunhos do cliente (`reference/rascunho-*.jpg`).

**Assinatura:** "Estrutura para melhorar. Ritmo para crescer." (Uma versão anterior dizia "Clareza para crescer"; a atual é "Ritmo".)

**Categoria:** "Sistemas de crescimento operacional".

**Os quatro pilares**, sempre nesta ordem: cultura · processos · treinamentos · estratégia.

**A ideia central:** melhoria contínua em ciclos. "+ ciclos = + velocidade". "Velocidade = crescer rápido e com clareza". O ciclo é: aprende rápido, ajusta, testa, melhora, cresce.

**O que o cliente quer** (rascunho "Objetivo"): aumentar a lucratividade, reduzir gastos, escalar, padronizar, expandir a empresa, diminuir desperdícios.

### Como escrever

- Frases curtas, em pares paralelos: "Estrutura para melhorar. Ritmo para crescer."
- Vocabulário concreto de operação: estrutura, processo, ciclo, ritmo, padrão, base, escala.
- Prometer resultado de negócio mensurável (lucro, custo, desperdício), não "transformação".
- Sem exclamações, sem superlativos vazios, sem emoji.
- Títulos em frase comum (só a primeira letra em maiúscula), com ponto final quando for afirmação.

---

## 7. Decisões em aberto

1. **Laranja canônico.** Este documento fixa `#FF5900`; o arquivo tem mais quatro tons. Confirmar com quem desenhou a marca.
2. **Botões, área de proteção e movimento** não existem no Figma; os valores acima são propostas.
3. **Foto do hero:** o mockup usa uma foto de banco de imagens que não está no arquivo em alta. É preciso escolher as fotos reais.
4. O Figma marca o estudo facetado como "proposta exploratória, não marca aprovada". As peças posteriores o adotam, mas vale confirmar que a marca está aprovada antes de publicar.
