/**
 * Tokens do Avence Studio (`brands/avence-studio/DESIGN.md`), identidade de
 * 2026-10-04. O fio com a marca antiga: a tinta `#111111`, o nome em minúsculas
 * e as duas setas que se encontram (agora abertas, com o ponto azul no meio).
 * O que mudou: a Space Grotesk saiu (é a fonte do Superelements) e entraram a
 * Inter Tight em tudo e a Instrument Serif nos destaques; o verde-limão saiu
 * (também é do Superelements) e entrou o azul do ponto, sobre papel claro. O
 * logo é a palavra avence com o ponto azul, onde as duas setas antigas se
 * encontravam; na entrada do site, o ponto cresce e vira a janela dos cases.
 *
 * Toda cor usada nos settings das seções está aqui e no front matter da marca
 * (hex em minúsculas, como a marca escreve): assim a marca aplicada por cima
 * não muda nada.
 */
export const AV = {
  /** tinta do site atual: títulos, faixas escuras, rodapé (17,6:1 no papel) */
  ink: '#111111',
  /** tinta levantada: cartões e filetes no escuro */
  inkRaised: '#1b1b1b',
  /** azul-sinal: o símbolo, botões (texto branco 7:1), rótulos pequenos no papel (6,2:1) e o foco */
  blue: '#2b3cf0',
  /** azul fundo: troca de cor dos botões azuis (texto branco 9,3:1) */
  blueDeep: '#1f2cc4',
  /** azul claro: rótulos, números e marcas na tinta (7,5:1) */
  blueLight: '#8f9bff',
  /** azul-névoa: fundo de etiquetas e da faixa "este site" (o azul sobre ele dá 5,6:1) */
  blueMist: '#e4e7fd',
  /** pedra: superfícies secundárias e as molduras das telas no papel */
  stone: '#e6e2d9',
  /** papel quente: fundo da página */
  paper: '#f3f1ec',
  /** branco: cartões e a moldura da prévia */
  white: '#ffffff',
  /** filete no papel */
  line: '#dcd8cf',
  /** texto (10,3:1 no papel) e apoio (5,4:1 no papel) */
  body: '#3a3833',
  muted: '#66625a',
  /** texto na tinta (13:1) e apoio na tinta (6,6:1) */
  onDark: '#d8d5cd',
  onDarkMuted: '#9d998f',
  /** filete no escuro: branco a 14% (no formato que a marca escreve) */
  lineDark: 'rgba(255, 255, 255, 0.14)',
  /** transparente com a base branca da paleta */
  clear: 'rgba(255, 255, 255, 0)',
  /** só no CSS do botão flutuante */
  whatsapp: '#25d366',
} as const

/**
 * Inter Tight em tudo (títulos 500 bem justos, texto 400, rótulos e botões em caixa alta).
 * A Instrument Serif, em itálico azul, é só dos destaques (uma palavra por título), da
 * assinatura e dos números grandes: entra pelo CSS e o widget de comportamento a carrega.
 */
export const AV_FONTS = { title: 'Inter Tight', text: 'Inter Tight' } as const
export const AV_SERIF_CSS = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap'

export const AV_LAYOUT = {
  content: 1240,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 128, tablet: 96, mobile: 72 },
  /** cantos retos, como os botões do site atual (só o círculo do WhatsApp é redondo) */
  radius: { button: 0, card: 0, frame: 0 },
} as const

export const AV_EASE = 'cubic-bezier(.2,0,0,1)'

/** Arquivos em public/. */
export const avAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/**
 * Símbolo (setas em tinta, ponto azul) e a versão para fundo escuro, em PNG
 * porque o WordPress recusa SVG (os SVG ficam ao lado, para o resto da marca).
 * O nome do arquivo diz a cor da tinta.
 */
export const AV_LOGO = {
  symbol: '/brands/avence-studio/logo/avence-simbolo.png',
  symbolLight: '/brands/avence-studio/logo/avence-simbolo-claro.png',
  lockupDark: '/brands/avence-studio/logo/avence-studio-logo-preto.png',
  lockupLight: '/brands/avence-studio/logo/avence-studio-logo-claro.png',
  stackedDark: '/brands/avence-studio/logo/avence-studio-empilhada-preto.png',
  stackedLight: '/brands/avence-studio/logo/avence-studio-empilhada-claro.png',
  iconDark: '/brands/avence-studio/logo/avence-icone.png',
  iconBlue: '/brands/avence-studio/logo/avence-icone-azul.png',
  /** a marca anterior (verde-limão), só para o antes e depois da página Identidade */
  before: '/brands/avence-studio/logo/avence-marca-anterior.png',
  /** largura ÷ altura de cada arquivo */
  ratio: 1,
  lockupRatio: 1200 / 272,
  stackedRatio: 800 / 389,
} as const

/** Meio-tom (halftone): pontos numa grade a 45°, o raio segue um degradê. Gerados por `.space/avence-studio/build/gen-halftone.cjs`. */
export const AV_TEXTURE = {
  blue: { path: '/brands/avence-studio/texturas/meio-tom-azul.webp', w: 1600, h: 1100 },
  light: { path: '/brands/avence-studio/texturas/meio-tom-claro.webp', w: 1600, h: 900 },
  paper: { path: '/brands/avence-studio/texturas/meio-tom-papel.webp', w: 1600, h: 900 },
  ink: { path: '/brands/avence-studio/texturas/meio-tom-tinta.webp', w: 1600, h: 900 },
} as const
export const AV_NAME = 'Avence Studio'


/** Contato público (`brands/avence-studio/COPY.md` §1). */
export const AV_CONTACT = {
  /** botão da página de obrigado do site atual (avencestudio.com/obrigado.html): confirmar */
  whatsapp: '5551991798877',
  whatsappLabel: '(51) 99179-8877',
  instagram: 'https://www.instagram.com/avencestudio/',
  instagramLabel: '@avencestudio',
  city: 'São Leopoldo (RS)',
  site: 'avencestudio.com',
} as const

const wa = (text: string) => `https://wa.me/${AV_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

/** WhatsApp com o assunto na primeira linha (o mesmo jeito que o studio faz nos sites dos clientes). */
export const avWhatsApp = (subject?: string) =>
  wa(subject ? `Olá! Vim pelo site da Avence Studio e quero conversar sobre ${subject}.` : 'Olá! Vim pelo site da Avence Studio e quero conversar sobre um site.')
/** Resposta de quem recebeu a prévia por mensagem. */
export const avWhatsAppPreview = wa('Olá! Recebi a prévia do site novo e quero conversar sobre ela.')
