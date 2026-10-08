/**
 * Página modelo do Superelements no desenho do jota.ai (pedido do usuário em
 * 2026-10-08: "recrie esse site… exatamente como ele está", no projeto
 * Superelements, para depois virar a página do produto).
 *
 * O desenho é o do jota.ai, medido no CSS dele (frame de 1440px do Figma e o de
 * 393px no celular): fundo cinza-claro, tinta, o amarelo do painel, os cantos
 * de 56/40/32px e o rodapé grafite. A fonte do Jota (Aeonik) é comercial; aqui
 * fica a Geist, do Google Fonts, a mais próxima. Textos, ícones e imagens são
 * do Superelements: nada do texto, do logo, das fotos ou dos vídeos do Jota.
 */
export const SX = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  card2: '#FCFCFC',
  card3: '#FEFEFD',
  chip: '#F0F0F0',
  ink: '#222222',
  black: '#000000',
  soft: '#666666',
  faint: '#AAAAAA',
  lede: '#5A656D',
  title: '#1C2327',
  placeholder: '#737373',
  yellow: '#FFE84C',
  dark: '#242D32',
  line: '#3B454B',
  faqLine: '#E4E3E5',
  faqAnswer: '#727077',
  onDark: '#F2F5F6',
  button: '#EEEEEE',
  // só nas peças de interface do produto (as cores do app)
  lime: '#D2F525',
  violet: '#8B5CF6',
  agent: '#D97757',
  emerald: '#10B981',
  sky: '#3B82F6',
  graphite: '#282828',
} as const

export const SX_FONT = 'Geist'
/** O logo segue a regra da marca: Space Grotesk 700, nunca mono. */
export const SX_LOGO_FONT = 'Space Grotesk'

export const SX_EASE = 'cubic-bezier(.2,.8,.2,1)'

/** Coluna de 1126px; abaixo de 1200px, 24px de cada lado (como o .wrap do original). */
export const SX_LAYOUT = { content: 1126, pad: 24 } as const
