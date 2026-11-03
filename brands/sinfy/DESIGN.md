---
name: Sinfy
description: A Sinfy, o produto de resultados (do anúncio à venda) para agências e negócios locais. Linguagem tirada da landing /lp (src/pages/ProductLanding.css) em 2026-11-02, para levar a mesma marca aos posts, stories e à LP no Space.
source: src/pages/ProductLanding.css e src/features/sinfy/SinfyBrand.tsx (2026-11-02); pedido do usuário "criar conteudos pro instagram… com base no nosso design"
colors:
  primary: "#171B19"
  on-primary: "#F4F5EF"
  secondary: "#242A26"
  accent: "#D2F525"
  on-accent: "#1C241F"
  accent-ink: "#526B28"
  background: "#F1F2ED"
  surface: "#FFFFFF"
  panel: "#E4E8DC"
  text: "#1C241F"
  muted: "#61695F"
  border: "#D9DDD4"
  on-dark-muted: "#B8BFB5"
  title-soft: "#70786C"
  title-soft-dark: "#98A590"
  on-lime-soft: "#54651F"
  accent-hover: "#BDDB2E"
  light-hover: "#DFE5D8"
fonts:
  heading:
    family: Inter
  body:
    family: Inter
radius:
  button: 999px
logo:
  on-light: /brands/sinfy/logo/sinfy-logo-tinta.png
  on-dark: /brands/sinfy/logo/sinfy-logo-claro.png
  symbol: /brands/sinfy/logo/sinfy-simbolo.svg
  symbol-on-dark: /brands/sinfy/logo/sinfy-simbolo.svg
  alt: Sinfy
---

# Sinfy — DESIGN.md

A Sinfy mostra o caminho do dinheiro: anúncio, site, conversa, venda. A marca é sóbria e operacional, como um painel bem feito: grafite esverdeado, papel claro levemente quente e uma lima só onde a pessoa age ou onde está a palavra que importa. Nada de gradiente de IA, vidro, neon ou mockup flutuando: o que convence é a tela do produto e a frase curta.

O front matter guarda só cores, a família, o canto do botão e o logo, para o Space e os Criativos aplicarem sozinhos. O resto está abaixo.

## 1. Logo

Símbolo: quadrado lima `#D2F525` com cantos de 8/28 e o "S" em dois traços grafite `#263126` (`public/brands/sinfy/logo/sinfy-simbolo.svg`, o mesmo de `SinfyBrand.tsx`). Ao lado, **sinfy** em Inter 650, minúsculo, tracking −0,055em, com o ponto final colorido: lima no escuro, verde `#526B28` no claro (a lima some sobre o papel).

- `sinfy-logo-claro.png`: texto papel, para fundo escuro.
- `sinfy-logo-tinta.png`: texto grafite, para fundo claro.
- `social/sinfy-avatar-1080.png`: o símbolo sobre grafite, foto de perfil.

O nome do arquivo diz a cor da tinta do logo, não a do fundo.

## 2. Cores

| Papel | Cor | Uso |
|---|---|---|
| Grafite | `#171B19` | Faixas escuras, hero, rodapé |
| Grafite elevado | `#242A26` | Cards e molduras no escuro |
| Papel | `#F1F2ED` | Fundo claro padrão |
| Painel | `#E4E8DC` | Faixa clara secundária (abas, soluções) |
| Branco | `#FFFFFF` | Cards claros, card de preço |
| Texto | `#1C241F` / `#61695F` | Título / apoio no claro |
| Texto no escuro | `#F4F5EF` / `#B8BFB5` | Título / apoio no escuro |
| Filete | `#D9DDD4` (claro), branco a 14% (escuro) | Bordas estruturais |
| Lima | `#D2F525` | Botão principal, palavra de destaque no escuro, a faixa de declaração |
| Verde-tinta | `#526B28` | Check e ponto do logo no claro; texto sobre a faixa lima em `#54651F` |

- **Lima nunca é texto sobre fundo claro.** No claro, ela vira fundo (botão, faixa) com texto grafite.
- **Uma lima por tela.** Ela marca a ação ou a palavra-chave, não pinta tudo (exceção: a faixa de declaração inteira em lima, uma por página).
- A segunda linha de um título vem num cinza esverdeado (`#70786C` no claro, `#98A590` no escuro): "Do lead que chegou / *ao negócio fechado.*"

## 3. Tipografia

Uma família só: **Inter**.

| Papel | Peso | Medida |
|---|---|---|
| Hero | 550 | 84 / 66 / 40px, entrelinha 1,04, −0,06em |
| Título de seção | 550 | 64 / 48 / 36px, entrelinha 1,07, −0,055em |
| Título de card | 550 | 42–21px, −0,035em |
| Texto | 400 | 17px de apoio, 15–14px de corpo |
| Rótulo | 500 | 12px, com um círculo de 7px em contorno antes |
| Botão | 550 | 14px, −0,015em |

Títulos em duas linhas curtas, a segunda em cinza ou em lima. Frases de três palavras no topo dos blocos: "Responda primeiro.", "Ninguém fica para trás.", "Invista no que vende."

## 4. Forma

- Conteúdo de 1240px, margens de 40/24/20px; seções de 128/96/72px.
- Botões em pílula (999px), 56px de altura, seta no fim. Cards de 20–24px; faixas com cantos de 40px no topo quando sobem sobre a anterior.
- Sombra só no card de preço e nas telas do produto.
- Ícones de linha (Lucide, traço 1,6).

## 5. Voz

Direta, operacional, sem promessa de resultado. Fala de contato, atendimento, próximo passo e venda; nunca de "IA mágica". Dados de exemplo sempre ditos como fictícios (a empresa de demonstração é a Caramelo Pet).

## 6. Posts e stories

- Fundo grafite ou papel; lima só na palavra-chave, no botão ou num bloco pequeno.
- Título grande em Inter 550, apertado, no máximo três linhas; a segunda linha em cinza.
- Rótulo pequeno no topo (círculo + texto), logo pequeno embaixo.
- Telas do produto (o tour da /lp) como imagem, dentro de moldura grafite com 20px de canto.
- Stories: texto fora das faixas que o Instagram cobre (250px em cima, 300px embaixo).
