/**
 * Tokens da Caramelo Pet, o petshop de exemplo do Space
 * (`brands/caramelo-pet/DESIGN.md`). A marca é fictícia: a paleta saiu da
 * foto da creche que já está no repo (pelo caramelo, camiseta azul-marinho,
 * piscina azul).
 */
export const PET = {
  /** azul-marinho: títulos, texto forte, faixa escura e rodapé */
  ink: '#1F2A44',
  /** faixa escura um tom acima, para os cartões dentro dela */
  inkRaised: '#2A3656',
  /** caramelo: botões, ícones e marcas pequenas; o texto em cima é azul-marinho (6,4:1) */
  caramel: '#F2994A',
  caramelHover: '#E5832C',
  /** caramelo escuro para rótulos pequenos no creme (5,9:1) */
  caramelInk: '#9A4A0B',
  /** azul-piscina: faixa da loja e selos */
  sky: '#9ED8F7',
  cream: '#FFF7EC',
  white: '#FFFFFF',
  /** caramelo claro: faixa dos planos e fundo dos ícones */
  warm: '#FDE9D3',
  body: '#4B5468',
  /** 4,5:1 no creme: só a partir de 14px */
  muted: '#6B7285',
  onInk: '#C9D1E3',
  line: '#EEDFCB',
  /** borda dos campos: 3,3:1 no branco, para o campo não sumir */
  field: '#9A8F80',
  whatsapp: '#25D366',
} as const

export const PET_FONTS = { title: 'Fredoka', text: 'Nunito' } as const

export const PET_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 96, tablet: 72, mobile: 56 },
  radius: { field: 14, card: 24, surface: 32, pill: 999 },
} as const

export const PET_EASE = 'cubic-bezier(.2,0,0,1)'
export const PET_SHADOW = '0 18px 40px -24px rgba(31,42,68,.35)'

/** Arquivos em public/. */
export const petAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/**
 * Dados de exemplo: o número, o endereço e os horários não existem. Troque
 * pelos do cliente antes de publicar.
 */
export const PET_CONTACT = {
  whatsapp: '5511900000000',
  whatsappLabel: '(11) 90000-0000',
  address: 'Rua das Acácias, 120 · Vila Mariana, São Paulo',
  hours: ['Segunda a sexta, 8h às 19h', 'Sábado, 8h às 17h'],
} as const

export const petWhatsApp = (text = 'Olá! Vim pelo site da Caramelo Pet e quero agendar um horário.') =>
  `https://wa.me/${PET_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
