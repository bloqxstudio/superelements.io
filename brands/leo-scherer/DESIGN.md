---
name: LS · Produtos Apple e importados
description: Loja de Leonardo Scherer (leoscherer.com.br), produtos Apple novos e seminovos, JBL e Tua Case. Design system da nova versão do site, feita no Space em 2026-10-02 a partir do site atual (mesma marca e mesmo logo).
colors:
  primary: "#FFFFFF"
  on-primary: "#000000"
  accent: "#FF0000"
  background: "#000000"
  surface: "#101010"
  text-body: "#B6B6B6"
  white: "#FFFFFF"
fonts:
  heading:
    family: Helvetica
  body:
    family: Helvetica
radius:
  button: 999px
logo:
  on-dark: /brands/leo-scherer/logo/ls-logo-on-dark.png
  on-light: /brands/leo-scherer/logo/ls-logo.png
  symbol: /brands/leo-scherer/logo/ls-simbolo.png
  symbol-on-dark: /brands/leo-scherer/logo/ls-simbolo-on-dark.png
  alt: LS · Produtos Apple e importados
photos:
  - url: /brands/leo-scherer/assets/iphone-18-pro-par.png
    alt: iPhone 18 Pro bordô, de frente e de costas (imagem oficial, recortada)
  - url: /brands/leo-scherer/assets/iphone-18-pro-cores.png
    alt: iPhone 18 Pro nas quatro cores (imagem oficial, recortada)
  - url: /brands/leo-scherer/instagram/loja-reinauguracao.jpg
    alt: Interior da loja LS na reinauguração
  - url: /brands/leo-scherer/instagram/loja-jbl.jpg
    alt: Parede de caixas de som JBL na loja LS
  - url: /brands/leo-scherer/instagram/lancamento-eua.jpg
    alt: Leonardo Scherer numa Apple Store nos Estados Unidos, no lançamento
  - url: /brands/leo-scherer/instagram/caixa-lancamento.jpg
    alt: Leonardo Scherer com a caixa de lançamento da Tua Case
---

# LS · Produtos Apple e importados — design system

A LS é um palco preto onde o produto Apple é a estrela: tipografia Helvetica fechada e grande, muito espaço negro, renders isolados e uma luz azul-marinho vinda do alto, como no site atual. A nova versão mantém a marca e o logo e organiza o site como uma vitrine editorial no padrão de elegância da Apple.

O front matter guarda só o que o Space aplica sozinho (cores, famílias, canto do botão, logo e fotos). Ele não tem papel de rótulo, peso, entrelinha, cards, divisores nem movimento, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está descrito abaixo.

## 1. Logo

O L com o celular e o S, seguido de PRODUTOS APPLE E IMPORTADOS em letras condensadas. Branco sobre preto, sempre.

| Arquivo | Uso |
|---|---|
| `logo/ls-logo-on-dark.png` | Logo horizontal branco (cabeçalho e rodapé) |
| `logo/ls-logo.png` | O mesmo em preto, para fundo claro |
| `logo/ls-simbolo-on-dark.png` | Símbolo branco com o descritor (história e marca d'água do rodapé) |
| `logo/ls-simbolo.png` | Símbolo preto (favicon do site atual) |
| `logo/tua-case-on-dark.png` | Logo da Tua Case, a marca de capas do Leonardo |

Os arquivos vieram do site atual (`wp-content/uploads`). Não há vetor: pedir o SVG ao cliente.

## 2. Cores

| Papel | Cor | Uso |
|---|---|---|
| Palco | `#000000` | Fundo de quase todas as seções e do corpo da página |
| Elevado | `#101010` | Cartões escuros, com filete branco a 10% e um filete de luz no alto |
| Marinho | `#151C25` | A luz do palco (o radial do site atual), canto dos cartões |
| Azul fundo | `#0B1B33` | A luz da simulação no site atual |
| Branco | `#FFFFFF` | Títulos, botão principal, a faixa clara "Em destaque" |
| Névoa | `#F5F5F7` | Moldura das fotos de produto (as fotos têm fundo branco e são multiplicadas) |
| Cinza claro | `#B6B6B6` | Texto de apoio no escuro (10,6:1) |
| Cinza | `#8E8E93` | Rótulos e legendas no escuro (6,0:1) |
| Cinza texto | `#6D6D6D` | Texto de apoio no claro (5,3:1) |
| Vermelho | `#FF0000` | Só o ponto antes do "Simule" e rótulos pequenos no escuro. Nunca texto no claro (4,0:1) |

## 3. Tipografia

Helvetica em tudo, como no site atual (no Windows cai em Arial). Títulos fechados, entrelinha curta e espaçamento negativo.

| Papel | Desktop / tablet / celular |
|---|---|
| Título do hero | 112 / 84 / 56px, peso 700, entrelinha 0,92, −0,045em |
| Subtítulo do hero | 44 / 36 / 28px, peso 500 |
| Título de seção | 64 / 50 / 38px, peso 700, entrelinha 1, −0,04em |
| Título de cartão | 34 / 30 / 28px, peso 700 |
| Texto de abertura | 20 / 19 / 17px, entrelinha 1,5 |
| Texto | 16px, entrelinha 1,6 |
| Rótulo | 12px, peso 600, caixa alta, 0,14em |
| Botão | 14px, peso 600 |

Uma frase por linha nos títulos de seção (`<br>`); no celular a quebra sai.

## 4. Espaço e formas

Conteúdo em 1200px, margens de 32/24/16px. Seções com 120/88/64px. Botões em pílula (999px), cartões com 20–24px de canto, molduras de produto com 16px. Sem sombras, exceto a sombra projetada do aparelho nos cartões de novos e seminovos.

## 5. Fundos

Cada seção tem uma camada de fundo nativa (`.ls-bg`): uma malha de pontos de 24px recortada por uma máscara radial e duas ou três luzes muito desfocadas (azul acinzentado, marinho, bordô do iPhone 18 Pro, branco quase apagado), que derivam devagar. As luzes são leves: o usuário pediu menos azul. O preto das imagens oficiais da Apple foi convertido em transparência (PNG): nada de `mix-blend-mode` em palcos que o GSAP move.

## 6. Movimento

GSAP e ScrollTrigger num único widget HTML no hero. A abertura traz o par de iPhone 18 Pro subindo inclinado em 3D, desfocado, até assentar, com um reflexo de luz recortado pelo desenho do aparelho; no desktop o hero fica preso por um trecho curto do scroll enquanto o texto sobe e o telefone cresce até o centro. Ao rolar, blocos sobem e aparecem uma vez. O hover fica só nos produtos em destaque: a foto amplia dentro da moldura e aparece "Ver produto". Tudo atrás de `prefers-reduced-motion`; sem script, a página já é a composição final.
