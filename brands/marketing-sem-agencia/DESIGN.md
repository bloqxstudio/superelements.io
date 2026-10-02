---
name: MSA — Marketing sem Agência
description: Programa de Henrique Zanotti que constrói, opera e transfere o marketing para dentro da empresa do cliente. Design system tirado das páginas do projeto MSA no Space (Homepage V4 e Página de vendas) em 2026-10-02; paleta e fontes medidas em marketingsemagencia.com.br.
colors:
  primary: "#2F2317"
  on-primary: "#F3EFE4"
  accent: "#BED499"
  on-accent: "#2F2317"
  background: "#F3EFE4"
  surface: "#E6E1D2"
  text-body: "#61695B"
  white: "#FFFFFF"
fonts:
  heading:
    family: Syne
  body:
    family: Urbanist
radius:
  button: 2px
logo:
  on-light: /brands/marketing-sem-agencia/logo/msa-logo.svg
  on-dark: /brands/marketing-sem-agencia/logo/msa-logo-on-dark.svg
  symbol: /brands/marketing-sem-agencia/logo/msa-simbolo.svg
  symbol-on-dark: /brands/marketing-sem-agencia/logo/msa-simbolo-on-dark.svg
  alt: MSA — Marketing sem Agência
photos:
  - url: /brands/marketing-sem-agencia/assets/henrique-retrato.jpg
    alt: Henrique Zanotti sentado numa poltrona de madeira, de terno azul
  - url: /brands/marketing-sem-agencia/assets/henrique-palco.jpg
    alt: Henrique Zanotti no palco, de camiseta verde, com um passador de slides na mão
  - url: /brands/marketing-sem-agencia/assets/henrique-microfone.jpg
    alt: Henrique Zanotti falando ao microfone num evento
  - url: /brands/marketing-sem-agencia/assets/henrique-evento.jpg
    alt: Palco de evento com o nome Henrique Zanotti no telão
---

# MSA — design system

A MSA deve parecer um sistema de operação sendo montado: não um portfólio de agência nem um produto de IA. A linguagem é editorial e de obra: papel quente, tinta espresso, um verde-sálvia seco, réguas retas, etapas numeradas e bastante espaço vazio. Tudo aqui foi tirado das páginas que já estão no projeto (Homepage V4 e Página de vendas), que seguem valendo como referência.

O front matter guarda só o que o Space aplica sozinho em toda seção (cores, fontes, canto do botão, logo e banco de fotos). Ele não tem papel de rótulo, peso ou entrelinha de título, cards, divisores, sombra nem movimento, de propósito: cada um desses reescreveria as páginas da MSA, que já trazem tudo isso pronto. O resto do sistema está descrito abaixo.

## 1. Logo

Wordmark tipográfico: **MSA** em Syne 800, com o descritor MARKETING SEM AGÊNCIA em Urbanist 600, caixa alta e espaçado (0,16em), alinhado pela base. O descritor tem 45% da altura do MSA e fica a uma distância de meio MSA.

| Arquivo | Uso |
|---|---|
| `logo/msa-logo.svg` | MSA em tinta e descritor em cinza-oliva, sobre papel ou areia |
| `logo/msa-logo-on-dark.svg` | MSA em papel e descritor em papel a 74%, sobre espresso |
| `logo/msa-simbolo.svg` | Só o MSA, em tinta: espaços pequenos e celular |
| `logo/msa-simbolo-on-dark.svg` | Só o MSA, em papel |
| `logo/msa-icone.svg` | Quadrado espresso com o MSA e a linha sálvia (o preloader): favicon e avatar |

Os arquivos estão em `public/brands/marketing-sem-agencia/logo/` e são contornos vetoriais: não dependem da fonte instalada. Nas páginas, o logo do cabeçalho e do rodapé é texto nativo do Elementor (o mesmo desenho), e no rodapé o MSA aparece gigante a 8% de opacidade. No celular o descritor sai e fica só o MSA.

## 2. Cores

| Papel | Cor | Uso |
|---|---|---|
| Papel | `#F3EFE4` | Fundo principal, texto sobre o espresso |
| Areia | `#E6E1D2` | Faixas alternadas, fundo dos cards de lista |
| Tinta (espresso) | `#2F2317` | Títulos, faixas escuras, botão principal, card de destaque |
| Cinza-oliva | `#61695B` | Texto de apoio, rótulos e números pequenos no claro |
| Sálvia | `#BED499` | Um destino por bloco: a última etapa, o preço de fundador, os vistos das listas, o botão nas faixas escuras |
| Branco | `#FFFFFF` | Só onde precisar de contraste máximo |

Derivadas (só em CSS, nunca como cor de marca): filete no claro tinta a 20% (estrutura) e 14% (entre linhas); filete no escuro papel a 18%; texto de apoio no escuro papel a 74%; card no escuro papel a 4%.

Contraste: tinta sobre papel 13,3:1; cinza-oliva sobre papel 5,0:1 (sobre a areia cai para 4,4:1, um pouco abaixo do AA para texto comum: é o caso dos textos de apoio direto na faixa de areia, ponto a rever); papel sobre tinta 13,3:1; tinta sobre sálvia 9,5:1. Sálvia nunca vira texto sobre o papel (1,4:1) e nunca pinta uma faixa inteira.

## 3. Tipografia

Syne nos títulos e nos números de destaque; Urbanist no texto, nos rótulos (inclusive os números pequenos e espaçados das etapas, 01, 02…), no menu e nos botões. Os títulos vão em caixa alta, com uma frase por linha.

| Papel | Desktop / tablet / celular | Fonte |
|---|---|---|
| Título do hero | 66–76 / 54–60 / 34–40px, entrelinha 1,02, −0,015em | Syne 700 |
| Título de seção | 52 / 44 / 32px, entrelinha 1,06, −0,01em | Syne 700 |
| Frase de destaque | 26–36px, entrelinha 1,1 | Syne 700 |
| Título de card | 18–24px, entrelinha 1,12 | Syne 700 |
| Número grande e preço | 34–56px, entrelinha 1 | Syne 700 |
| Nome do Henrique | 132 / 96 / 50px, entrelinha 0,92 | Syne 700 |
| Texto de abertura | 20 / 18px, entrelinha 1,6 | Urbanist 300 |
| Texto | 16–17px, entrelinha 1,65 | Urbanist 400 |
| Texto de apoio | 14px, entrelinha 1,55 | Urbanist 400 |
| Rótulo (eyebrow) | 10–11px, caixa alta, 0,16–0,18em | Urbanist 600 |
| Botão | 15px (14px no celular dentro de card), 0,03em | Urbanist 600 |
| Pergunta do FAQ | 19 / 17px, caixa normal | Syne 600 |

Os arquivos das fontes ficam em `public/brands/marketing-sem-agencia/assets/fonts/` (Syne e Urbanist, latin). No WordPress, instalar pelo Elementor Custom Fonts.

## 4. Layout

- Conteúdo de 1180px, com margens de 32 / 24 / 20px.
- Seções com 112 / 84 / 64px em cima e embaixo.
- Cabeçalho de seção: rótulo, título na largura toda (uma frase por linha) e o texto de apoio embaixo, alinhado à direita no desktop.
- Larguras de leitura sempre em `min(100%, Npx)`.
- Faixas alternam papel, areia e espresso; a página nunca tem duas faixas escuras seguidas sem um motivo.

## 5. Componentes

Tudo que é complexo vai em card: canto de 2px, borda de 1px, sem sombra.

- **Card claro**: papel sobre a faixa de areia (ou areia sobre o papel), borda tinta a 20%.
- **Card espresso**: fundo tinta, para o lado "com a MSA" de uma comparação, o preço e o CTA final.
- **Card no escuro**: papel a 4% sobre o espresso, borda papel a 18%.
- **Card sálvia**: um por bloco, o destino (Transfiro, Governança, preço de fundador).
- **Etiqueta**: rótulo em caixa com borda de 1px e canto de 2px; a etiqueta sálvia marca o lado bom ("COM A MSA", "MSA", "É PARA VOCÊ SE", "BÔNUS").
- **Lista com visto**: quadrado sálvia de 18px com visto em tinta. **Lista com traço**: quadrado de contorno com um traço. Cada item tem um filete em cima.
- **Comparação**: lado a lado, lida de cima para baixo. Quando os itens são pares, cada linha é um par alinhado; no celular, cada célula diz de que lado está.
- **Etapas numeradas**: número em Syne, traços no topo que acendem até a etapa (1/3, 2/3, 3/3), a última em sálvia.
- **Tabela de valores**: item e valor por linha, valor em Syne e alinhado à direita; total com filete em tinta.
- **Card de preço**: espresso, preço em Syne 56px, preço de fundador num card sálvia dentro dele, botão em papel ocupando a largura.
- **Botões**: retangulares, canto de 2px, Urbanist 600 com seta. Tinta com texto papel no claro; sálvia com texto tinta no escuro; contorno papel a 18% para a ação secundária no escuro. Ao passar o mouse, a seta anda 3px.
- **Perguntas**: acordeão nativo com filetes, número 01–07 à esquerda e um quadrado com + que fica sálvia aberto.
- **Ficha do Henrique**: rótulo sálvia à esquerda e o valor à direita, linha por linha, num card no escuro.

## 6. Fotos

Retrato de estúdio do Henrique e três fotos de palco (palco verde, microfone no Bazze 2025, telão com o nome), no banco de fotos da marca. Fotos sem legenda, em duas colunas defasadas. Evitar equipes genéricas em volta de notebook, dashboards falsos e escritórios gerados por IA. A publicação ainda depende da confirmação de direitos do Henrique, e a foto do telão tem só 640px: fica pequena.

## 7. Movimento

O movimento é discreto e é da própria página, não da marca. Um único script de comportamento no hero carrega o GSAP: painel espresso com o MSA e a linha sálvia enchendo, entrada suave do hero, blocos que sobem 18px uma vez ao aparecer e o MSA do rodapé subindo devagar. Sem pin, sem história presa ao scroll e sem palavra por palavra. Sem script, ou com movimento reduzido, a página já está completa. Os botões trocam de cor num instante e encolhem levemente (para 96%) ao pressionar; esses detalhes já vêm no CSS de cada seção.

## 8. Textura e forma

Só o hero tem textura: uma grade de planta fraca e parada. Linhas retas; nada de diagonais, órbitas, bolhas, degradês genéricos, vidro ou sombras grandes.

## 9. Acessibilidade

Contorno de foco visível (tinta no claro, sálvia no escuro). Nada essencial depende de hover. No celular, toda largura cabe em 375px sem rolagem lateral.

## 10. Voz

- Direta, prática e em primeira pessoa quando quem fala é o Henrique ("eu construo, opero e transfiro").
- Frases curtas e contrastes claros: alugar × ser dono, agência × time próprio.
- Prova antes de superlativo. Números só com a fonte e o aviso dele.
- O inimigo é o modelo de agência e a dependência, não as pessoas.
- O texto de cada página e o que ainda falta confirmar estão em `brands/marketing-sem-agencia/COPY.md`.
