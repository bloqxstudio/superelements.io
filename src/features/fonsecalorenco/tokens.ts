/**
 * Tokens da Fonseca & Lorenço Advogados Associados (`brands/fonseca-lorenco/DESIGN.md`).
 * Prospecto de São Leopoldo (RS): a paleta saiu do selo do logo de 2019, grafite
 * com o degradê amarelo-esverdeado → âmbar, e do âmbar das artes do Instagram.
 * O conceito é o marca-texto: papel claro, texto grafite e o degradê do selo
 * marcando a frase que importa.
 */
export const FL = {
  /** grafite do selo: títulos, cabeçalho escuro, faixas escuras */
  graphite: '#282828',
  /** um tom abaixo, rodapé */
  deep: '#1E1E1E',
  /** cartão sobre o grafite */
  raised: '#323230',
  /** âmbar das artes: botões e marcas pequenas; o texto em cima é grafite (8,3:1) */
  amber: '#FFB404',
  amberHover: '#FFC53A',
  /** âmbar escuro para rótulos pequenos no papel (5,4:1) */
  amberInk: '#8A5A00',
  /** degradê do selo, da esquerda para a direita: o marca-texto */
  markA: '#E5F064',
  markB: '#F2DD53',
  markC: '#FFCA6A',
  white: '#FFFFFF',
  /** papel quente das faixas claras */
  paper: '#F7F5EF',
  ink: '#282828',
  /** texto no papel (8,3:1) e apoio (5:1) */
  body: '#4A4944',
  muted: '#6B6962',
  line: '#E6E1D6',
  /** texto no grafite (8,7:1) e apoio (5,2:1) */
  onDark: '#C9C7C0',
  mutedDark: '#A8A69F',
  lineDark: 'rgba(255,255,255,0.1)',
  whatsapp: '#25D366',
} as const

export const FL_MARK = `linear-gradient(90deg,${FL.markA},${FL.markB} 55%,${FL.markC})`

export const FL_FONTS = { title: 'Archivo', text: 'Public Sans' } as const

export const FL_LAYOUT = {
  content: 1160,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 112, tablet: 88, mobile: 64 },
  radius: { button: 4, card: 8 },
} as const

export const FL_EASE = 'cubic-bezier(.2,0,0,1)'
export const FL_SHADOW = '0 18px 40px -22px rgba(0,0,0,.45)'

/** Arquivos em public/. */
export const flAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/**
 * Contato público (`brands/fonseca-lorenco/COPY.md` §6). O WhatsApp oficial
 * ainda é pendência: este é o que aparece no site, no cartão e nas artes.
 */
export const FL_CONTACT = {
  whatsapp: '5551981683468',
  whatsappLabel: '(51) 98168-3468',
  phone: '555135922400',
  phoneLabel: '(51) 3592-2400',
  email: 'contato@escritoriofonseca.com.br',
  instagram: 'escritoriofonseca',
  facebook: 'https://www.facebook.com/escritoriofonsecaelorenco/',
  street: 'Rua Bento Gonçalves, 1487',
  district: 'Centro',
  city: 'São Leopoldo – RS',
  cep: '93010-220',
  maps: 'R. Bento Gonçalves, 1487 - Centro, São Leopoldo - RS, 93010-220',
  oab: 'OAB/RS 4689',
  hoursWeek: 'Segunda a sexta, das 8h30 às 18h, sem fechar ao meio-dia',
  hoursSat: 'Sábado, das 8h30 às 12h30',
} as const

export const FL_NAME = 'Fonseca & Lorenço Advogados Associados'

export const flWhatsApp = (text = 'Olá! Vim pelo site do escritório e gostaria de conversar sobre uma situação.') =>
  `https://wa.me/${FL_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

export const flPhone = `tel:+${FL_CONTACT.phone}`
export const flInstagram = `https://www.instagram.com/${FL_CONTACT.instagram}/`
export const flDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FL_CONTACT.maps)}`
