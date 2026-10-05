---
name: Kátia Paixão Advocacia
description: Escritório da advogada Kátia Paixão (OAB/RS 81.632) no Centro de São Leopoldo (RS), em direito previdenciário, do trabalho, de família e sucessões, com atendimento presencial e online, inclusive para quem mora no exterior. Prospecto, não é cliente. Marca montada em 2026-10-03 a partir do monograma K|P e das cores do site atual.
source: logo, fotos e cores do site atual (katiapaixaoadv.com.br, uploads de 2025 e kit global post-6.css do Elementor); fatos e pendências em brands/katia-paixao/COPY.md
colors:
  primary: "#7E1A26"
  on-primary: "#F6F1EA"
  secondary: "#5C1420"
  accent: "#DDC68D"
  accent-light: "#E8D6A8"
  background: "#F6F1EA"
  surface-sand: "#E3DAD6"
  text-heading: "#2E2022"
  text-body: "#4A3A3C"
  muted: "#6B5A5B"
  border: "#DDD2C8"
  on-dark-soft: "#DCC0BF"
fonts:
  heading:
    family: Italiana
  body:
    family: Manrope
radius:
  button: 3px
logo:
  on-light: /brands/katia-paixao/logo/katia-paixao-logo.png
  on-dark: /brands/katia-paixao/logo/katia-paixao-logo-claro.png
  symbol: /brands/katia-paixao/logo/katia-paixao-monograma.png
  symbol-on-dark: /brands/katia-paixao/logo/katia-paixao-monograma-claro.png
  alt: Kátia Paixão Advocacia
photos:
  - url: /brands/katia-paixao/fotos/katia-retrato-barra.webp
    alt: Kátia Paixão, advogada, de blazer preto, com a mão junto ao queixo
  - url: /brands/katia-paixao/fotos/katia-retrato-sorriso.webp
    alt: Kátia Paixão, advogada, sorrindo, de braços cruzados
---

# Kátia Paixão Advocacia — DESIGN.md

Escritório de advocacia na Rua Marquês do Herval, 784, sala 405, no Centro de São Leopoldo. Fundado pela advogada Kátia Paixão (OAB/RS 81.632), atende em direito previdenciário (INSS), do trabalho, de família e sucessões, no escritório e online, para todo o Brasil e para brasileiros que moram fora. **Prospecto**: este sistema serve à nova versão do site que vamos mostrar ao escritório. Fatos, fontes e pendências ficam no `COPY.md`.

O front matter guarda só o que o Space aplica sozinho em toda seção: cores, as duas famílias, o canto do botão, o logo e os dois retratos. Não tem papel de rótulo, peso ou entrelinha de título, cartão, divisor nem efeitos, de propósito: cada um desses reescreveria a página, que já traz tudo pronto. O resto está abaixo e nos builders (`src/features/katiapaixao/`).

## 1. Conceito: a barra do K|P

O logo do escritório são duas letras, K e P, separadas por um traço vertical fino. As fotos da Kátia repetem a mesma ideia: metade vinho, metade creme, e ela de pé na divisa. O site novo é construído com essa barra.

- **A abertura é o monograma.** Um campo vinho à esquerda, com o que o escritório faz e onde fica; um campo claro à direita; e, na divisa, o retrato da Kátia, cuja própria divisa vinho e creme continua a do site. A barra fina passa por cima e por baixo da foto.
- **As áreas são fases da vida.** O site atual termina com "Proteja seus direitos em qualquer fase da vida"; o novo se organiza assim: enquanto você trabalha, quando a saúde pede uma pausa, perto da aposentadoria, quando a família muda. Cada fase fica à esquerda da barra, as situações à direita, escritas como a pessoa pensaria ("O INSS negou o meu benefício.", "Fui demitida grávida."), e cada uma abre o WhatsApp já com o assunto.
- **Quem chega pelo anúncio resolve em segundos**: o que o escritório faz e onde fica estão na primeira tela, com o WhatsApp no topo, os assuntos mais procurados logo abaixo do título e o botão do WhatsApp sempre à mão.
- **Longe do Brasil** é uma faixa própria, em vinho fundo: o atendimento a brasileiros no exterior, todo online, é o que mais distingue o escritório.
- Fora do clichê jurídico: nada de martelo, balança, estátua, coluna, aperto de mão ou foto de banco de imagem. As fotos de banco do site atual (mãos dadas, bandeiras, idosos com papéis) não voltam.

## 2. Logo

O monograma K|P, de traço fino com contraste, e a assinatura horizontal "KATIA PAIXÃO · ADVOCACIA - OAB/RS81632", ambos do site atual, refeitos em duas tintas a partir do contorno dos arquivos públicos, em `public/brands/katia-paixao/logo/`:

- `katia-paixao-logo.png` (vinho) e `katia-paixao-logo-claro.png` (linho): a assinatura horizontal, 1096 × 174. A clara fecha o rodapé.
- `katia-paixao-monograma.png` (vinho) e `katia-paixao-monograma-claro.png` (linho): só o K|P, 640 × 483. No cabeçalho, ao lado do nome em texto nativo ("Kátia Paixão" em Italiana e "Advocacia · OAB/RS 81.632" em rótulo).

O arquivo vetorial oficial é pendência: o monograma público é pequeno, e o contorno foi suavizado. Logo e monograma têm largura explícita no modelo (monograma de 44px no cabeçalho, 38px no celular; assinatura de 300px no rodapé), para a marca aplicada por cima reconhecer o arquivo e manter o tamanho.

## 3. Cores

- **Vinho** `#7E1A26` (o do site e do logo) é a cor do escritório: o campo da abertura, os botões no claro, os rótulos pequenos e uma linha de cada título. **Vinho fundo** `#5C1420` no rodapé, na faixa do exterior e na troca de cor do botão vinho.
- **Linho** `#F6F1EA` é o fundo da página; **areia** `#E3DAD6` (o creme das fotos) é o campo claro da abertura e as faixas alternadas.
- **Champanhe** `#DDC68D` (o dourado do site atual) é o único destaque, e só sobre o vinho: a barra, os números, os rótulos e o botão principal da abertura, sempre com texto em vinho fundo (7,9:1). `#E8D6A8` é a troca de cor desse botão. No claro, o champanhe não aparece.
- Títulos em **tinta** `#2E2022`; texto `#4A3A3C`; apoio `#6B5A5B`; filetes `#DDD2C8`. No vinho, texto `#F6F1EA` e apoio `#DCC0BF`.
- O verde do WhatsApp aparece só no botão flutuante. Os botões verdes em degradê do site atual não voltam.

## 4. Tipografia

Duas famílias do Google Fonts:

- **Italiana** (contraste alto, sem serifa, fina como o K|P) nos títulos, no nome, nas fases, nos números e na frase da Kátia. Sempre grande: nunca abaixo de 28px.
- **Manrope** no texto, nas situações (semibold), nos rótulos, no menu, nas perguntas e nos botões. Rótulos em caixa alta espaçada, com a barra vertical na frente.

A marca não tem papel `label` de propósito: sem ele, o Space trata rótulos e botões com a fonte de texto, que já é a do modelo. Texto em Manrope acima de 16px fica em widgets de texto, não de título.

| Uso | Tamanho | Fonte |
|---|---|---|
| Título da abertura | 78px (46px no celular) | Italiana 400 |
| Título de seção | 54px (38px no celular) | Italiana 400 |
| Fase e nome | 32px (28px no celular) | Italiana 400 |
| Situação | 19px / 1,4 | Manrope 600 |
| Texto de abertura | 19px / 1,6 | Manrope 400 |
| Texto | 17px / 1,65 | Manrope 400 |
| Rótulo | 12px, 0,16em de espaçamento | Manrope 700 |
| Botão | 15px | Manrope 700 |

## 5. Medidas

Conteúdo de 1200px com margens de 32/24/16px; seções com 120/88/64px em cima e embaixo. Cabeçalho de 72px (64px no celular), preso no topo. Botões quase retos, como os traços do monograma; retratos com moldura reta. A barra é sempre um filete de 1px: champanhe no vinho, vinho no claro. Nenhum efeito de profundidade fora do botão flutuante, e nenhuma textura: o contraste entre o vinho e o claro já faz o desenho.

## 6. Retratos

Duas fotos reais do site atual, recortadas em retrato 4:5: a Kátia de blazer preto com a mão junto ao queixo, sobre a divisa vinho e creme (abertura), e a Kátia sorrindo de braços cruzados (seção da advogada). Sem legenda. Os arquivos públicos têm 1600px de largura no máximo, então os retratos ficam pequenos (até 440px); fotos originais e direito de uso são pendência.

## 7. O momento-assinatura

Um só: **o vinho se abre a partir da barra**. Ao abrir a página, a barra se traça de cima para baixo na divisa, o campo vinho se abre dela para a esquerda, o retrato chega e os textos entram em sequência. Ao rolar, a barra de cada fase se traça uma vez e os blocos marcados chegam uma vez. Botões e links só trocam de cor. Tudo é comportamento de um único widget HTML (GSAP e ScrollTrigger do jsDelivr), atrás de `prefers-reduced-motion`; sem ele, no editor do Elementor e nas miniaturas do Space, a página está pronta, com o vinho aberto e as barras inteiras.

## 8. Voz

- Próxima e clara, como a Kátia fala no Instagram: frases curtas, "você", sem juridiquês e sem drama.
- Informa, não promete. Sem "garanta", "recupere o que é seu", "resultados", "sem compromisso", "imediatamente", "a melhor tese", "o melhor", "excelência"; sem depoimento, caso, resultado, número de clientes ou preço (Código de Ética da OAB e Provimento 205/2021; ver `COPY.md` §7).
- "Especialista" só depois de o escritório confirmar o título; até lá, "atua em".
- As chamadas são neutras e falam da advogada no feminino: "Conversar pelo WhatsApp", "Falar com a Dra. Kátia", "Ver as situações", "Como chegar".
