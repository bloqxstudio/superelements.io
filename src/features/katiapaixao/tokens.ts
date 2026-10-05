/**
 * Tokens da Kátia Paixão Advocacia (`brands/katia-paixao/DESIGN.md`).
 * O vinho e o vinho fundo são os do site atual (kit do Elementor); a areia é o
 * creme das fotos dela (o lado claro do retrato dividido); o champanhe é o
 * dourado do site, usado só sobre o vinho. Toda cor usada nos settings das
 * seções está aqui e no front matter da marca (hex em minúsculas, como a
 * marca escreve): assim a marca aplicada por cima não muda nada.
 */
export const KP = {
  /** vinho do logo: campo da abertura, botões no claro, rótulos pequenos no claro (9:1 no linho) */
  wine: '#7e1a26',
  /** vinho fundo: rodapé, troca de cor do botão vinho, faixa do exterior */
  wineDeep: '#5c1420',
  /** champanhe: só sobre o vinho (barra, números, rótulos, botão com texto vinho fundo, 7,9:1) */
  champagne: '#ddc68d',
  /** champanhe claro: troca de cor do botão champanhe */
  champagneLight: '#e8d6a8',
  /** linho: fundo da página */
  linen: '#f6f1ea',
  /** areia: o creme das fotos (lado claro da abertura, faixas alternadas) */
  sand: '#e3dad6',
  /** tinta: títulos no claro (12:1 no linho) */
  ink: '#2e2022',
  /** texto (11:1 no linho, 9,1:1 na areia) e apoio (5,8:1 no linho, 4,7:1 na areia) */
  body: '#4a3a3c',
  muted: '#6b5a5b',
  /** filete claro */
  line: '#ddd2c8',
  /** texto no vinho (9:1) e apoio no vinho (6:1) */
  onWine: '#f6f1ea',
  onWineMuted: '#dcc0bf',
  /** filete no vinho: branco a 18% (no formato que a marca escreve) */
  lineWine: 'rgba(255, 255, 255, 0.18)',
  /** transparente com a base do linho (a paleta não tem branco) */
  clear: 'rgba(246, 241, 234, 0)',
  /** só no CSS do botão flutuante */
  whatsapp: '#25d366',
} as const

export const KP_FONTS = { title: 'Italiana', text: 'Manrope' } as const

export const KP_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 120, tablet: 88, mobile: 64 },
  /** cantos quase retos, como os traços do monograma */
  radius: { button: 3, card: 4, photo: 2 },
} as const

export const KP_EASE = 'cubic-bezier(.2,0,0,1)'

/** Arquivos em public/. */
export const kpAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/** Monograma K|P: vinho no claro, linho no vinho (o arquivo diz a cor da tinta). */
export const KP_MONOGRAM = '/brands/katia-paixao/logo/katia-paixao-monograma.png'
export const KP_MONOGRAM_LIGHT = '/brands/katia-paixao/logo/katia-paixao-monograma-claro.png'
/** Logo horizontal (K|P, KATIA PAIXÃO, ADVOCACIA - OAB/RS81632). */
export const KP_LOGO = '/brands/katia-paixao/logo/katia-paixao-logo.png'
export const KP_LOGO_LIGHT = '/brands/katia-paixao/logo/katia-paixao-logo-claro.png'
/** Proporções dos arquivos (largura / altura). */
export const KP_RATIO = { monogram: 640 / 483, logo: 1096 / 174 } as const
export const KP_NAME = 'Kátia Paixão Advocacia'

export const KP_PHOTOS = {
  /** o retrato dividido: vinho à esquerda, creme à direita; a divisa fica a 53,9% da largura */
  seam: { path: '/brands/katia-paixao/fotos/katia-retrato-barra.webp', alt: 'Kátia Paixão, advogada, de blazer preto, com a mão junto ao queixo', ratio: 466 / 582, split: 0.539 },
  smile: { path: '/brands/katia-paixao/fotos/katia-retrato-sorriso.webp', alt: 'Kátia Paixão, advogada, sorrindo, de braços cruzados', ratio: 466 / 582 },
} as const

/** Contato e registro públicos (`brands/katia-paixao/COPY.md` §1 e §2). */
export const KP_CONTACT = {
  whatsapp: '5551991209364',
  whatsappLabel: '(51) 99120-9364',
  phone: '555137831574',
  phoneLabel: '(51) 3783-1574',
  email: 'katiapaixao@gmail.com',
  street: 'Rua Marquês do Herval, 784, sala 405',
  district: 'Centro',
  city: 'São Leopoldo (RS)',
  cep: '93010-200',
  maps: 'Rua Marquês do Herval, 784 - Centro, São Leopoldo - RS, 93010-200',
  lawyer: 'Kátia Paixão',
  oab: 'OAB/RS 81.632',
  instagram: 'katiapaixao.advogada',
} as const

const wa = (text: string) => `https://wa.me/${KP_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

/** Mensagens neutras: o assunto na primeira linha, sem pedir detalhes do caso. */
export const kpWhatsApp = (subject?: string) =>
  wa(subject ? `Olá, Dra. Kátia! Vim pelo site e gostaria de conversar sobre ${subject}.` : 'Olá, Dra. Kátia! Vim pelo site e gostaria de conversar.')
export const kpPhone = `tel:+${KP_CONTACT.phone}`
export const kpEmail = `mailto:${KP_CONTACT.email}`
export const kpDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(KP_CONTACT.maps)}`
export const kpInstagram = `https://www.instagram.com/${KP_CONTACT.instagram}/`
