/**
 * Tokens da Júnior Automáticos (`brands/junior-automaticos/DESIGN.md`). A
 * paleta saiu do logo do cliente: dourado e prata em relevo sobre preto.
 */
export const JA = {
  /** preto do logo: cabeçalho, hero e faixas escuras */
  black: '#0B0B0C',
  /** um tom acima, para cartões e a faixa das marcas */
  raised: '#151517',
  /** rodapé */
  deep: '#060607',
  /** dourado do logo: botões, ícones, a palavra em destaque; o texto em cima é preto (7,9:1) */
  gold: '#CF9B3A',
  goldHover: '#E0B24F',
  /** dourado escuro para rótulos pequenos no claro (5,9:1) */
  goldInk: '#7A5818',
  /** prata do logo: as marcas de carro na faixa */
  silver: '#C7C7CB',
  white: '#FFFFFF',
  /** texto no preto (9,9:1) e texto de apoio no preto (6:1) */
  onDark: '#B8B8BC',
  mutedDark: '#8E8E94',
  lineDark: 'rgba(255,255,255,0.09)',
  /** papel quente das faixas claras */
  paper: '#F6F3EE',
  ink: '#0B0B0C',
  body: '#4A4A50',
  /** 4,8:1 no papel: só a partir de 14px */
  muted: '#6B6B72',
  line: '#E4DED4',
  whatsapp: '#25D366',
} as const

export const JA_FONTS = { title: 'Saira', text: 'Barlow' } as const

export const JA_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 96, tablet: 72, mobile: 56 },
  radius: { button: 6, card: 12 },
} as const

export const JA_EASE = 'cubic-bezier(.2,0,0,1)'
export const JA_SHADOW = '0 18px 40px -22px rgba(0,0,0,.55)'

/** Arquivos em public/. */
export const jaAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/** Contato real, da copy do cliente (`brands/junior-automaticos/COPY.md`). */
export const JA_CONTACT = {
  whatsapp: '5512982180739',
  whatsappLabel: '(12) 98218-0739',
  email: 'juniorcambiosautomaticos@gmail.com',
  instagram: 'juniorautomaticos.sjc',
  street: 'Av. Ouro Fino, 2140',
  district: 'Bosque dos Eucaliptos',
  city: 'São José dos Campos/SP',
  maps: 'Av. Ouro Fino, 2140 - Bosque dos Eucaliptos, São José dos Campos - SP',
} as const

export const jaWhatsApp = (text = 'Olá! Vim pelo site da Júnior Automáticos e quero solicitar um orçamento.') =>
  `https://wa.me/${JA_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

export const jaInstagram = `https://www.instagram.com/${JA_CONTACT.instagram}/`
export const jaDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(JA_CONTACT.maps)}`
