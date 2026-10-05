/**
 * Tokens da Macarthy Scherer (`brands/macarthy-scherer/DESIGN.md`). A paleta
 * saiu do logo vetorial (azul-tinta e azul) e do bronze do site atual. Toda cor
 * usada nos settings das seções está aqui e no front matter da marca: assim a
 * marca aplicada por cima não muda nada.
 */
export const MS = {
  /** tinta do logo: títulos, botão principal, faixa do primeiro contato e rodapé */
  ink: '#0a243b',
  /** azul do logo: faixa da chamada final e troca de cor dos botões */
  blue: '#074468',
  /** bronze do site atual: filetes, numerais e marcas pequenas (5:1 no azul-tinta) */
  bronze: '#bb8553',
  /** bronze escuro para rótulos pequenos no claro (5,3:1 no papel) */
  bronzeInk: '#8a5a2c',
  /** papel: fundo da página */
  paper: '#f6f4f0',
  white: '#ffffff',
  /** o azul do logo bem claro: faixa das dúvidas */
  mist: '#e8eef2',
  /** texto (8,2:1 no papel) e apoio (5:1 no papel) */
  body: '#3e4a56',
  muted: '#5e6a75',
  line: '#dce1e5',
  /** texto no azul-tinta (10:1) e no azul (6,6:1) */
  onDark: '#c3d0db',
  /** filete no escuro: branco a 14% (no formato que a marca escreve) */
  lineDark: 'rgba(255, 255, 255, 0.14)',
  /** transparente com a base branca da paleta */
  clear: 'rgba(255, 255, 255, 0)',
  /** só no CSS do botão flutuante */
  whatsapp: '#25d366',
} as const

export const MS_FONTS = { title: 'Newsreader', text: 'Instrument Sans' } as const

export const MS_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 120, tablet: 88, mobile: 64 },
  radius: { button: 999, card: 16, photo: 12 },
} as const

export const MS_EASE = 'cubic-bezier(.2,0,0,1)'

/** Arquivos em public/. */
export const msAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

export const MS_LOGO = '/brands/macarthy-scherer/logo/macarthy-scherer.svg'
export const MS_LOGO_ON_DARK = '/brands/macarthy-scherer/logo/macarthy-scherer-branco.svg'
/** Proporção do logo vetorial (viewBox 503,4 × 83,17). */
export const MS_LOGO_RATIO = 503.4 / 83.17
export const MS_BRAND = 'Macarthy Scherer Advogados'

/** Contato público (`brands/macarthy-scherer/COPY.md` §1 e §4). Os números por área são os do rodapé do site atual. */
export const MS_CONTACT = {
  /** WhatsApp da ficha do Google e da Receita; no site atual, marcado "Criminal" */
  whatsappMain: '5551998474555',
  whatsappCriminal: '5551998474555',
  whatsappCriminalLabel: '(51) 99847-4555',
  /** WhatsApp marcado "Familiar" no site atual */
  whatsappFamily: '5551996924566',
  whatsappFamilyLabel: '(51) 99692-4566',
  phone: '555130994566',
  phoneLabel: '(51) 3099-4566',
  street: 'Rua Bento Gonçalves, 673, sala 701',
  district: 'Centro',
  city: 'São Leopoldo (RS)',
  maps: 'Rua Bento Gonçalves, 673 - Centro, São Leopoldo - RS',
  cnpj: '35.426.893/0001-16',
  instagramGlaucia: 'advglauciamacarthy',
  instagramMarcelo: 'marceloschereradv',
  youtube: 'https://www.youtube.com/@macarthyscherer160',
  lattesGlaucia: 'http://buscatextual.cnpq.br/buscatextual/visualizacv.do?metodo=apresentar&id=K4310683T6',
  lattesMarcelo: 'http://buscatextual.cnpq.br/buscatextual/visualizacv.do?metodo=apresentar&id=K4327175H1',
} as const

export const MS_PEOPLE = {
  glaucia: { name: 'Gláucia Macarthy', oab: 'OAB/RS 82.685', area: 'Família e sucessões', photo: '/brands/macarthy-scherer/fotos/glaucia-macarthy.jpg', alt: 'Gláucia Macarthy, advogada, sorrindo, diante de uma estante de livros' },
  marcelo: { name: 'Marcelo Scherer', oab: 'OAB/RS 96.494', area: 'Criminal', photo: '/brands/macarthy-scherer/fotos/marcelo-scherer.jpg', alt: 'Marcelo Scherer, advogado, sentado à mesa do escritório' },
} as const

const wa = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`

/** Mensagens neutras: sem pedir detalhes do caso na primeira linha. */
export const msWhatsApp = (text = 'Olá! Vim pelo site da Macarthy Scherer e gostaria de conversar.') => wa(MS_CONTACT.whatsappMain, text)
export const msWhatsAppFamily = () => wa(MS_CONTACT.whatsappFamily, 'Olá! Vim pelo site da Macarthy Scherer e gostaria de conversar sobre uma questão de família.')
export const msWhatsAppCriminal = () => wa(MS_CONTACT.whatsappCriminal, 'Olá! Vim pelo site da Macarthy Scherer e gostaria de conversar sobre uma questão criminal.')
export const msPhone = `tel:+${MS_CONTACT.phone}`
export const msDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MS_CONTACT.maps)}`
export const msInstagram = (user: string) => `https://www.instagram.com/${user}/`
