/**
 * Tokens da Cerveira Braggio Advocacia (`brands/cerveira-braggio/DESIGN.md`).
 * O dourado é o do logo e do site atual; o nanquim, o grafite do site levado
 * ao preto quente de um desenho técnico; o resto é papel branco e concreto.
 * Toda cor usada nos settings das seções está aqui e no front matter da marca
 * (hex em minúsculas, como a marca escreve): assim a marca aplicada por cima
 * não muda nada.
 */
export const CB = {
  /** nanquim: títulos, botão principal, faixa do primeiro contato e rodapé (17:1 no branco) */
  ink: '#1d1b18',
  /** nanquim levantado: cartões e filetes fortes no escuro */
  inkRaised: '#2a2723',
  /** dourado do logo: cotas, filetes, números e marcas; texto só no nanquim (7,4:1) */
  gold: '#cfa354',
  /** dourado claro: troca de cor do botão dourado */
  goldLight: '#ddb866',
  /** dourado escuro para rótulos pequenos no claro (6,2:1 no branco, 5,4:1 no concreto) */
  goldInk: '#7a5c1e',
  /** papel da planta: fundo da página */
  paper: '#ffffff',
  /** concreto: faixas alternadas */
  stone: '#f0efeb',
  /** texto (10:1 no branco) e apoio (5,6:1 no branco, 4,9:1 no concreto) */
  body: '#45423d',
  muted: '#6b675f',
  /** filete claro e parede da planta */
  line: '#dad7d0',
  /** texto no nanquim (11:1) e apoio no nanquim (6,9:1) */
  onDark: '#d3cec4',
  onDarkMuted: '#a9a397',
  /** filete no escuro: branco a 14% (no formato que a marca escreve) */
  lineDark: 'rgba(255, 255, 255, 0.14)',
  /** transparente com a base branca da paleta */
  clear: 'rgba(255, 255, 255, 0)',
  /** só no CSS do botão flutuante */
  whatsapp: '#25d366',
} as const

export const CB_FONTS = { title: 'Marcellus', text: 'IBM Plex Sans' } as const

export const CB_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 120, tablet: 88, mobile: 64 },
  /** cantos retos: a planta não tem arredondado (só o círculo do WhatsApp) */
  radius: { button: 0, card: 0, photo: 0 },
} as const

export const CB_EASE = 'cubic-bezier(.2,0,0,1)'

/** Arquivos em public/. */
export const cbAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/** Monograma "CB" dourado com a coluna, fundo transparente (serve no claro e no escuro). */
export const CB_MONOGRAM = '/brands/cerveira-braggio/logo/cerveira-braggio-monograma-dourado.png'
export const CB_NAME = 'Cerveira Braggio Advocacia'

export const CB_PHOTOS = {
  portrait: { path: '/brands/cerveira-braggio/fotos/andreza-retrato.webp', alt: 'Andreza Cerveira Braggio, advogada, de camisa rosé, sorrindo, com as mãos juntas', ratio: 860 / 1280 },
  office: { path: '/brands/cerveira-braggio/fotos/andreza-escritorio.webp', alt: 'Andreza Cerveira Braggio no escritório, trabalhando no notebook', ratio: 1456 / 986 },
} as const

/** Contato e registro públicos (`brands/cerveira-braggio/COPY.md` §1 e §2). */
export const CB_CONTACT = {
  whatsapp: '5551995852531',
  whatsappLabel: '(51) 99585-2531',
  phone: '555121604282',
  phoneLabel: '(51) 2160-4282',
  email: 'andrezaadv@hotmail.com',
  /** sala 602 no mapa do site, 603 na Receita: pendência */
  street: 'Rua São Caetano, 410, sala 602',
  district: 'Centro',
  city: 'São Leopoldo (RS)',
  cep: '93010-090',
  maps: 'Rua São Caetano, 410 - Centro, São Leopoldo - RS, 93010-090',
  legalName: 'Cerveira Braggio – Sociedade Individual de Advocacia',
  cnpj: '48.925.125/0001-59',
  lawyer: 'Andreza Cerveira Braggio',
  oab: 'OAB/RS 129.181',
  instagram: 'cerveirabraggioadvocacia',
  facebook: 'https://www.facebook.com/p/Cerveira-Braggio-Advogados-Associados-100091973582357/',
  linkedin: 'https://www.linkedin.com/in/andreza-cerveira-braggio-40b703176',
} as const

const wa = (text: string) => `https://wa.me/${CB_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

/** Mensagens neutras: o assunto na primeira linha, sem pedir detalhes do caso. */
export const cbWhatsApp = (subject?: string) =>
  wa(subject ? `Olá! Vim pelo site da Cerveira Braggio e gostaria de conversar sobre ${subject}.` : 'Olá! Vim pelo site da Cerveira Braggio e gostaria de conversar.')
export const cbPhone = `tel:+${CB_CONTACT.phone}`
export const cbEmail = `mailto:${CB_CONTACT.email}`
export const cbDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CB_CONTACT.maps)}`
export const cbInstagram = `https://www.instagram.com/${CB_CONTACT.instagram}/`
