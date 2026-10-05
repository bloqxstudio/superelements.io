/**
 * Tokens da Emmanuel Becker Advocacia (`brands/emmanuel-reche-becker/DESIGN.md`).
 * O vermelho e o cinza são os do logo (monograma ERB e letreiro); o grafite é o
 * fundo do caça-palavras que abre o site atual. O resto é pedra e papel quentes.
 * Toda cor usada nos settings das seções está aqui e no front matter da marca
 * (hex em minúsculas, como a marca escreve): assim a marca aplicada por cima
 * não muda nada.
 */
export const ERB = {
  /** grafite: abertura, primeiro contato, contato e textos fortes (16:1 com o papel) */
  graphite: '#29282b',
  /** grafite levantado: cartões sobre o grafite */
  graphiteRaised: '#353437',
  /** rodapé */
  footer: '#1e1d20',
  /** cinza do letreiro do logo: letras de fundo do caça-palavras no grafite (só enfeite) */
  logoGray: '#4d4c4e',
  /** vermelho do monograma: botões (branco em cima, 5:1) e marcas */
  red: '#cd3539',
  /** vermelho escuro: troca de cor do botão e texto vermelho pequeno no claro (6,5:1 no branco, 5,5:1 na pedra) */
  redInk: '#b02a2f',
  /** vermelho claro: palavras achadas e números grandes no grafite (4,1:1) */
  redLight: '#ee5054',
  /** papel, pedra e branco das faixas claras e dos cartões */
  paper: '#f8f7f5',
  stone: '#eeece8',
  white: '#ffffff',
  /** títulos (15:1), texto (9:1) e apoio (5:1 na pedra) no claro */
  ink: '#232225',
  body: '#46454a',
  muted: '#636267',
  /** filete claro */
  line: '#dcd9d3',
  /** títulos (15:1), texto (9:1) e apoio (5,5:1) no grafite */
  onDarkStrong: '#efeeeb',
  onDark: '#c6c4c0',
  onDarkMuted: '#9b9995',
  /** filete no escuro: branco a 12% (no formato que a marca escreve) */
  lineDark: 'rgba(255, 255, 255, 0.12)',
  /** transparente com a base branca da paleta */
  clear: 'rgba(255, 255, 255, 0)',
  /** só no CSS do botão flutuante */
  whatsapp: '#25d366',
} as const

export const ERB_FONTS = { title: 'IBM Plex Mono', text: 'Sora' } as const

export const ERB_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 112, tablet: 88, mobile: 64 },
  /** o arredondado do B do monograma, contido */
  radius: { button: 6, card: 10, photo: 10 },
} as const

export const ERB_EASE = 'cubic-bezier(.2,0,0,1)'

/** Arquivos em public/. */
export const erbAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/** Monograma ERB vermelho, fundo transparente (serve no claro e no grafite). */
export const ERB_MONOGRAM = '/brands/emmanuel-reche-becker/logo/erb-monograma.png'
/** Logo completo (monograma e letreiro branco), para o grafite. O nome do arquivo não diz "logo" de propósito: a marca do Space trocaria a imagem pelo monograma. */
export const ERB_LOGO_WHITE = '/brands/emmanuel-reche-becker/logo/erb-assinatura-branco.png'
export const ERB_NAME = 'Emmanuel Becker Advocacia'

export const ERB_PHOTOS = {
  portrait: { path: '/brands/emmanuel-reche-becker/fotos/emmanuel-retrato.webp', alt: 'Emmanuel Reche Becker, advogado, de terno escuro e gravata vermelha, com as mãos juntas', ratio: 640 / 1000 },
  reception: { path: '/brands/emmanuel-reche-becker/fotos/escritorio-recepcao.webp', alt: 'Recepção do escritório, com poltronas, um quadro e o balcão de madeira', ratio: 1200 / 800 },
  meeting: { path: '/brands/emmanuel-reche-becker/fotos/escritorio-reuniao.webp', alt: 'Sala de reunião com mesa de madeira, cadeiras pretas e janelas para a cidade', ratio: 1200 / 800 },
  office: { path: '/brands/emmanuel-reche-becker/fotos/escritorio-sala.webp', alt: 'Sala de atendimento com mesa de madeira, notebook e janelas amplas para São Leopoldo', ratio: 1200 / 800 },
} as const

/** Contato e registro públicos (`brands/emmanuel-reche-becker/COPY.md` §1 e §2). */
export const ERB_CONTACT = {
  whatsapp: '5551992853661',
  whatsappLabel: '(51) 99285-3661',
  phone: '5551992853661',
  phoneLabel: '(51) 99285-3661',
  email: 'contato@erbadvocacia.com.br',
  street: 'Rua São Joaquim, 611, sala 1304',
  building: 'Platinum Executive Center',
  district: 'Centro',
  city: 'São Leopoldo (RS)',
  cep: '93010-190',
  maps: 'Rua São Joaquim, 611 - Centro, São Leopoldo - RS, 93010-190',
  lawyer: 'Emmanuel Reche Becker',
  oab: 'OAB/RS 84.677',
  site: 'https://erbadvocacia.com.br',
} as const

const wa = (text: string) => `https://wa.me/${ERB_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

/** Mensagens neutras: o assunto na primeira linha, sem pedir detalhes do caso. */
export const erbWhatsApp = (subject?: string) =>
  wa(subject ? `Olá! Vim pelo site e gostaria de conversar sobre ${subject}.` : 'Olá! Vim pelo site e gostaria de conversar sobre o meu caso.')
export const erbPhone = `tel:+${ERB_CONTACT.phone}`
export const erbEmail = `mailto:${ERB_CONTACT.email}`
export const erbDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ERB_CONTACT.maps)}`
/** Páginas que já existem no site atual (continuam no mesmo WordPress). */
export const erbPage = (slug: string) => `${ERB_CONTACT.site}/${slug.replace(/^\/|\/$/g, '')}/`
