---
name: Superelements
description: O nosso próprio produto, um espaço visual para criar, organizar e publicar sites WordPress + Elementor. Linguagem tech tirada do app (lima #D2F525 do logo, tinta, grade de pontos do canvas) e das páginas do projeto Superelements no Space, em 2026-10-02.
colors:
  primary: "#D2F525"
  on-primary: "#09090B"
  background: "#09090B"
  surface: "#111114"
  text: "#F4F4F5"
  text-muted: "#A1A1AA"
  canvas: "#F4F4F5"
  white: "#FFFFFF"
radius:
  button: 8px
logo:
  symbol: /brands/superelements/logo/se-simbolo.svg
  symbol-on-dark: /brands/superelements/logo/se-simbolo.svg
  alt: Superelements
---

# Superelements — design system

O Superelements fala de dentro do produto. A página é escura, técnica e precisa: tinta quase preta, a lima do logo só no que se clica e nas marcas pequenas, rótulos em Space Mono como numa interface, e as telas do app mostradas de verdade, em containers nativos. Nada de gradiente genérico de IA, vidro em toda parte ou mockup de celular flutuando: o que convence é o canvas real, com um projeto real dentro.

O front matter guarda só as cores, o canto do botão e o logo. No projeto do Space a marca fica gravada mas **desligada**: o passe da marca troca as cores e as fontes de toda seção pela paleta mais próxima, e as telas do produto precisam manter os cinzas, o violeta e a Inter do app (o diff do `applyBrand` deu 804 mudanças em 11 seções, em 2026-10-02). As páginas já são construídas na marca pelos builders (`src/features/superelements/`).

## 1. Logo

Símbolo: quadrado lima (`#D2F525`) com os dois traços em grafite (`#282828`), o mesmo do app (`src/components/Logo.tsx`), em `public/brands/superelements/logo/se-simbolo.svg`. Ao lado, a palavra **superelements** em Space Grotesk 700, minúscula, tracking −0,035em, como texto nativo. O logo nunca usa a fonte mono (decisão do usuário em 2026-10-02); a palavra grande do rodapé também é Space Grotesk. O símbolo 3D holográfico (o vídeo da tela de login, `public/sp3.mp4`) foi recortado em `public/brands/superelements/simbolo-3d.mp4` (720px, 8 s, sem som) com o pôster `simbolo-3d.webp`, e só aparece sobre preto puro.

## 2. Cores

| Papel | Cor | Uso |
|---|---|---|
| Tinta | `#09090B` | Fundo das faixas escuras; texto sobre lima |
| Tinta elevada | `#111114` | Cards e faixas escuras secundárias |
| Painel | `#17171B` | Superfícies dentro de cards escuros |
| Filete no escuro | branco a 9% / 18% | Bordas estruturais e filetes |
| Texto no escuro | `#F4F4F5` / `#A1A1AA` | Títulos / texto de apoio (7,8:1 sobre tinta) |
| Canvas | `#F4F4F5` | Faixas claras, o cinza do canvas do Space |
| Papel | `#FFFFFF` | Cards claros e a faixa do agente |
| Filete no claro | `#E4E4E7` | Bordas dos cards claros |
| Texto no claro | `#09090B` / `#52525B` / `#71717A` | Título / corpo / rótulo |
| Lima | `#D2F525` (no hover do botão sobe o branco) | Botões, check, índice, palavra de destaque no escuro |

- **Lima nunca é texto sobre fundo claro** (não tem contraste). No claro, a lima vira fundo (o índice `01`, o botão) com texto em tinta.
- **Uma lima por bloco.** Ela não pinta áreas grandes.
- **Dentro das telas do produto valem as cores do app**: violeta `#8B5CF6` na seleção, `#D97757` no que o Claude mexeu, verde `#10B981` no publicado, cinzas do Tailwind. Essas cores não saem das telas.

## 3. Tipografia

| Papel | Fonte | Peso | Medida |
|---|---|---|---|
| Hero | Space Grotesk | 600 | 78 / 60 / 42px, entrelinha 0,98, −0,04em |
| Título de seção | Space Grotesk | 600 | 56 / 44 / 34px, entrelinha 1,02, −0,035em |
| Título de card | Space Grotesk | 600 | 30–21px |
| Texto | Space Grotesk | 400 | 20px de apoio, 16px de corpo, 14px pequeno |
| Rótulo | Space Mono | 400 | 12px, caixa alta, +0,08em: `[ 02 ] Como funciona` |
| Logo | Space Grotesk | 700 | 18px no cabeçalho; a palavra grande do rodapé até 186px |
| Botões | Space Grotesk | 600 | 15px, 14px no cabeçalho, −0,01em; nunca mono (pedido do usuário em 2026-10-03) |
| Interface, índices | Space Mono | 400 e 700 | 11–15px |
| Telas do produto | Inter | 400 a 600 | 10–18px, como no app |

Títulos com uma frase por linha (`<br>`), na largura da seção. No celular, os `<br>` dos títulos de seção saem e o texto corre.

## 4. Espaço e forma

- Conteúdo de 1240px, margens laterais de 32 / 24 / 16px. Seções de 128 / 96 / 72px.
- Botões com canto de 8px (o do app), cards de 12–16px, janelas de 16px, pílulas de 999px.
- Sem sombra fora das telas do produto. A janela do Space tem a sombra longa e escura que a separa do fundo.
- Textura única: a grade de pontos do canvas (24px). Branca a 11% no hero escuro, cinza nas faixas claras. Marcas de canto lima, como a régua de um canvas, só na janela do hero.

## 5. Telas do produto

As telas são copiadas do app (`src/pages/ProjectSpace.tsx`, `SpaceToolbar`, `PageFrame`, `SectionNode`, `ClaudePanel`, `WordPressPublishDialog`), com os mesmos rótulos, ícones e medidas, em containers e widgets nativos (`src/features/superelements/screens.ts`). O projeto mostrado é o Caramelo Pet, o exemplo fictício, com as fotos reais das seções dele tiradas do canvas. O domínio é `caramelopet.exemplo`, para nunca parecer um negócio de verdade.

## 6. Movimento

GSAP e ScrollTrigger num único widget HTML de comportamento, o primeiro filho do hero (`src/features/superelements/story.ts`). O scroll conduz a publicação: a janela do Space fica presa, a câmera dá zoom no botão Publicar no site, o cursor clica com um anel lima, o diálogo real de publicar abre, as etapas de envio se marcam e a página ganha o selo No site. Tudo reversível. No celular e no tablet, sem pin, a sequência curta toca uma vez. Os blocos sobem um pouco ao entrar; as linhas entre os Navigators se desenham; as mensagens do agente entram uma a uma. Com movimento reduzido, sem script, no editor do Elementor e nas miniaturas do Space, a página aparece pronta.

Botões (pedido do usuário em 2026-10-03): no hover o preenchimento sobe pela borda de baixo e sai por cima, o texto rola junto e a seta dá a volta. O botão lima se enche de branco e o de contorno de lima, os dois com texto em tinta. Sem mouse ou com movimento reduzido, só a cor muda.
