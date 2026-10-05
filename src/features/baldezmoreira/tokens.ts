/**
 * Tokens do Baldez & Moreira (`brands/baldez-moreira/DESIGN.md`). Prospecto:
 * a paleta saiu do logo do escritório (monograma BM em ouro metálico, anel
 * "advogados associados") e do azul-marinho do kit do site atual (#031F47).
 */
export const BM = {
  /** noite: fundo das faixas escuras (cabeçalho, abertura, etapas, contato) */
  ink: '#07101F',
  /** um tom acima, para painéis no escuro */
  raised: '#0D1A2E',
  /** azul-marinho do site atual: a faixa do escritório */
  navy: '#031F47',
  /** rodapé */
  deep: '#040A15',
  /** ouro do logo (o tom claro do degradê): botões, números, filetes e a palavra em destaque; texto em cima é a noite (8,5:1) */
  gold: '#CDA766',
  goldHover: '#E0C185',
  /** ouro escuro para rótulos pequenos no papel (5,6:1) */
  goldInk: '#7A5A22',
  /** texto no escuro (15,4:1) e apoio no escuro (9,3:1; 8:1 no azul) */
  white: '#ECE7DD',
  soft: '#AEB6C4',
  /** apoio mais fraco no escuro, só a partir de 14px (6,1:1) */
  dim: '#8A93A3',
  lineDark: 'rgba(205,167,102,0.22)',
  hairDark: 'rgba(236,231,221,0.12)',
  /** papel das faixas claras */
  paper: '#F4F0E8',
  surface: '#FFFFFF',
  /** títulos no papel: o azul-marinho (14,3:1) */
  heading: '#031F47',
  body: '#3A4253',
  /** 5,1:1 no papel */
  muted: '#5E6677',
  line: '#DDD5C6',
  whatsapp: '#25D366',
} as const

export const BM_FONTS = { title: 'Jost', text: 'Albert Sans' } as const

export const BM_LAYOUT = {
  content: 1240,
  gutter: { desktop: 40, tablet: 28, mobile: 18 },
  section: { desktop: 128, tablet: 96, mobile: 64 },
  radius: { button: 2, card: 4 },
} as const

export const BM_EASE = 'cubic-bezier(.2,0,0,1)'
export const BM_SHADOW = '0 22px 48px -24px rgba(0,0,0,.6)'

/** Arquivos em public/. */
export const bmAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/**
 * Contato público (site atual e Google Maps, `brands/baldez-moreira/COPY.md`).
 * O WhatsApp é o dos botões principais do site atual; há um segundo número
 * (pendência 10 do COPY.md).
 */
export const BM_CONTACT = {
  whatsapp: '555130373302',
  whatsappLabel: '(51) 3037-3302',
  phone: '555135893302',
  phoneLabel: '(51) 3589-3302',
  email: 'contato.baldezmoreira@gmail.com',
  building: 'Galeria Basile',
  street: 'R. Independência, 945',
  rooms: 'salas 102 e 103',
  district: 'Centro',
  city: 'São Leopoldo/RS',
  cep: '93010-001',
  maps: 'Galeria Basile, R. Independência, 945 - Centro, São Leopoldo - RS, 93010-001',
  /** razão social e CNPJ do cadastro público (BrasilAPI / Receita Federal) */
  legalName: 'Baldez Moreira Sociedade Individual de Advocacia',
  cnpj: '50.962.293/0001-66',
  /** titular da sociedade no cadastro público; o número da OAB/RS ainda falta (pendência 1) */
  lawyer: 'Tiago Baldez Moreira',
  /** nota pública no Google Maps, informada pelo usuário em 2026-10-03 (pendência 9) */
  googleRating: '5,0',
  googleReviews: '237',
} as const

export const bmWhatsApp = (text = 'Olá. Vim pelo site do Baldez & Moreira e gostaria de falar com o escritório.') =>
  `https://wa.me/${BM_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

export const bmPhone = `tel:+${BM_CONTACT.phone}`
export const bmMail = `mailto:${BM_CONTACT.email}`
export const bmDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BM_CONTACT.maps)}`
/** a ficha no Google, pela busca do nome (o link exato da ficha é a pendência 9) */
export const bmGoogle = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Baldez Moreira Advogados Associados, São Leopoldo')}`
