/**
 * Tokens da ProcessBase, lidos de brands/processbase/DESIGN.md (processbase.fig).
 * Navy quase preto com um único ponto laranja; títulos em Inter Regular com
 * entrelinha justa; cards sem sombra, a profundidade vem do contraste.
 */
export const PB = {
  navy: '#171A2C',
  /** miolo dos cards sobre o navy: um degrau acima do fundo */
  navyRaised: '#1E2237',
  orange: '#FF5900',
  /** hover do botão laranja: um passo mais fechado, com o texto branco */
  orangeHover: '#E24E00',
  slate: '#829AAF',
  /** ardósia para texto grande sobre o claro: a #829AAF não passa contraste no branco */
  slateInk: '#5F7A91',
  white: '#FFFFFF',
  /** surface-muted: faixa cinza-fria que separa seções claras */
  mist: '#F2F3F5',
  ink: '#171A2C',
  body: '#5E6472',
  border: '#C9CCD3',
  /** texto corrido sobre o navy */
  onNavy: 'rgba(255,255,255,0.72)',
  /** filetes sobre o navy (ardósia a 18%) */
  line: 'rgba(130,154,175,0.18)',
  lineStrong: 'rgba(130,154,175,0.32)',
  /** casca da moldura dupla: ardósia a 7% sobre o navy, cinza sobre o claro */
  shellDark: 'rgba(130,154,175,0.07)',
  shellLight: '#E6E8EC',
} as const

export const PB_FONT = 'Inter'
export const PB_EASE = 'cubic-bezier(.2,.7,.2,1)'

export const PB_LAYOUT = {
  content: 1280,
  gutter: { desktop: 32, tablet: 24, mobile: 20 },
  section: { desktop: 112, tablet: 88, mobile: 64 },
  nav: 68,
  radius: { button: 8, card: 16, shell: 22, pill: 999 },
} as const

/** Arquivos em public/brands/processbase. */
export const pbAsset = (path: string) => `${window.location.origin}/brands/processbase/${path}`
