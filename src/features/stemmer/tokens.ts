/**
 * Tokens da Stemmer Advogados Associados (`brands/stemmer-advogados/DESIGN.md`).
 * O preto e o branco são os do logo e do site atual; o verde é o dos botões do
 * site atual (o verde do WhatsApp) levado a um tom sóbrio, a cor de um cartão
 * de ponto impresso. Toda cor usada nos settings das seções está aqui e no
 * front matter da marca (hex em minúsculas, como a marca escreve): assim a
 * marca aplicada por cima não muda nada.
 */
export const ST = {
  /** preto do logo: títulos, cabeçalho, faixas escuras e rodapé (18:1 no branco) */
  ink: '#0d1114',
  /** preto levantado: cartões e filetes fortes no escuro */
  inkRaised: '#171d21',
  /** verde-registro: botões, quadros marcados e rótulos pequenos (6,5:1 no branco, com texto branco também 6,5:1) */
  green: '#146c43',
  /** verde mais fundo: troca de cor dos botões verdes */
  greenDeep: '#0e5233',
  /** verde claro: rótulos e marcas no preto (10,4:1 no preto) */
  greenLight: '#86cfa6',
  /** papel: fundo da página */
  paper: '#ffffff',
  /** cartão de ponto: o verde bem claro do papel do cartão */
  card: '#f1f7f3',
  /** pauta impressa do cartão */
  cardRule: '#c9dfd1',
  /** texto (o do site atual, 10,8:1 no branco) e apoio (6,1:1 no branco, 5,6:1 no cartão) */
  body: '#3a3e40',
  muted: '#5c6367',
  /** filete claro */
  line: '#dde0e1',
  /** texto no preto (11,8:1) e apoio no preto (6,7:1) */
  onDark: '#c8cdd0',
  onDarkMuted: '#949b9f',
  /** filete no escuro: branco a 14% (no formato que a marca escreve) */
  lineDark: 'rgba(255, 255, 255, 0.14)',
  /** transparente com a base branca da paleta */
  clear: 'rgba(255, 255, 255, 0)',
  /** só no CSS do botão flutuante */
  whatsapp: '#25d366',
} as const

export const ST_FONTS = { title: 'Encode Sans Expanded', text: 'Sora' } as const

export const ST_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 120, tablet: 88, mobile: 64 },
  /** cantos quase retos, como um cartão de ponto (só o círculo do WhatsApp é redondo) */
  radius: { button: 4, card: 6, photo: 4 },
} as const

export const ST_EASE = 'cubic-bezier(.2,0,0,1)'

/** Arquivos em public/. */
export const stAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/** Logo original (tinta branca, do site atual) e a versão com tinta preta (derivada, até chegar o arquivo oficial). */
export const ST_LOGO = {
  white: '/brands/stemmer-advogados/logo/stemmer-logo-branco.png',
  black: '/brands/stemmer-advogados/logo/stemmer-logo-preto.png',
  symbolWhite: '/brands/stemmer-advogados/logo/stemmer-simbolo-branco.png',
  symbolBlack: '/brands/stemmer-advogados/logo/stemmer-simbolo-preto.png',
  /** largura ÷ altura do logo completo */
  ratio: 1200 / 354,
} as const
export const ST_NAME = 'Stemmer Advogados Associados'

export interface StPerson { name: string; oab: string; role: string; photo: string; alt: string }

/** Equipe da página "Quem Somos" do site atual, na ordem de lá (`COPY.md` §3). */
export const ST_TEAM: StPerson[] = [
  { name: 'Carlos Alberto Stemmer', oab: 'OAB/RS 31.069', role: 'Advogado · sócio', photo: '/brands/stemmer-advogados/fotos/carlos-stemmer.webp', alt: 'Carlos Alberto Stemmer, advogado, de terno cinza e gravata listrada' },
  { name: 'Gabriel Lazzaretti Pacheco', oab: 'OAB/RS 73.619', role: 'Advogado · sócio', photo: '/brands/stemmer-advogados/fotos/gabriel-lazzaretti-pacheco.webp', alt: 'Gabriel Lazzaretti Pacheco, advogado, de terno azul e óculos' },
  { name: 'Gelvani Deuschle', oab: 'OAB/RS 70.258', role: 'Advogada', photo: '/brands/stemmer-advogados/fotos/gelvani-deuschle.webp', alt: 'Gelvani Deuschle, advogada, de blazer preto e óculos' },
  { name: 'Martiela A. Tavares da Silva', oab: 'OAB/RS 74.190', role: 'Advogada', photo: '/brands/stemmer-advogados/fotos/martiela-tavares-da-silva.webp', alt: 'Martiela A. Tavares da Silva, advogada, de camisa branca, de braços cruzados' },
]

export const ST_PHOTOS = {
  team: { path: '/brands/stemmer-advogados/fotos/equipe-fachada.webp', alt: 'Os quatro advogados do escritório em frente à fachada branca com o nome Stemmer e o número 195', ratio: 1018 / 814 },
  facade: { path: '/brands/stemmer-advogados/fotos/fachada-195.webp', alt: 'Fachada do escritório na Rua São José, 195: casa branca com o nome Stemmer Advogados Associados e o número 195', ratio: 938 / 780 },
  portraitRatio: 600 / 760,
} as const

/** Contato e registro públicos (`brands/stemmer-advogados/COPY.md` §1 e §2). */
export const ST_CONTACT = {
  whatsapp: '5551981082503',
  whatsappLabel: '(51) 98108-2503',
  /** o site atual liga para tel:51935720891 (um 9 a mais): aqui vai o número certo */
  phone: '555135720891',
  phoneLabel: '(51) 3572-0891',
  email: 'contato@stemmeradvogados.com.br',
  street: 'Rua São José, 195',
  district: 'Bairro São José',
  city: 'São Leopoldo (RS)',
  cep: '93040-000',
  maps: 'Stemmer Advogados Associados, Rua São José, 195 - São José, São Leopoldo - RS, 93040-000',
  legalName: 'Stemmer Advogados Associados',
  cnpj: '04.641.011/0001-01',
  since: '1996',
  /** nota pública no Google Maps (leitura do usuário, 2026-10-03): pendência */
  rating: '4,9',
  reviews: '48',
} as const

/**
 * WhatsApp em `https://wa.me/5551981082503…`: os gatilhos do Tag Manager atual
 * contam cliques em links que começam assim (e em links que contêm "wa.me").
 */
const wa = (text: string) => `https://wa.me/${ST_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

/** Mensagens neutras: o assunto na primeira linha, sem pedir detalhes do caso. */
export const stWhatsApp = (subject?: string) =>
  wa(subject ? `Olá! Vim pelo site da Stemmer Advogados e gostaria de conversar sobre ${subject}.` : 'Olá! Vim pelo site da Stemmer Advogados e gostaria de conversar com um advogado.')
export const stPhone = `tel:+${ST_CONTACT.phone}`
export const stEmail = `mailto:${ST_CONTACT.email}`
export const stDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ST_CONTACT.maps)}`
export const stMapsListing = 'https://www.google.com/maps/place/?q=place_id:ChIJXUM0IVNoGZURfRqCs_Cuu94'
export const stPrivacy = 'https://stemmeradvogados.com.br/politica-de-privacideade/'
/** Página de obrigado que o Tag Manager atual conta como conversão do formulário. */
export const stThanks = 'https://stemmeradvogados.com.br/obrigado-contato/'

/**
 * Ids que os gatilhos do Tag Manager atual (GTM-TN9V5L8X) contam como clique no
 * WhatsApp: ficam nos botões equivalentes da Home nova (`button_css_id`).
 */
export const ST_TRACK = { header: 'wpp_menu', hero: 'wpp_pagina_inicial' } as const
