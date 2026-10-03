/**
 * Tokens da marca Superelements (brands/superelements/DESIGN.md). O nosso
 * próprio produto: linguagem tech, lima sobre tinta, Space Grotesk nos títulos
 * e Space Mono nos rótulos, números e interface. As telas do produto, dentro
 * da página, usam Inter, a fonte do app, para ficarem fiéis ao que existe.
 */
export const SE = {
  ink: '#09090B',
  raised: '#111114',
  panel: '#17171B',
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.18)',
  onInk: '#F4F4F5',
  onInkSoft: '#A1A1AA',
  paper: '#FFFFFF',
  canvas: '#F4F4F5',
  lineLight: '#E4E4E7',
  text: '#09090B',
  body: '#52525B',
  muted: '#71717A',
  lime: '#D2F525',
  limeHover: '#DDFA47',
  /** Logo: os dois traços do símbolo. */
  graphite: '#282828',
  // Só dentro das telas do produto, como no app
  violet: '#8B5CF6',
  violetSoft: '#EDE9FE',
  violetInk: '#6D28D9',
  agent: '#D97757',
  agentInk: '#A94E2F',
  agentSoft: '#FBF1EE',
  emerald: '#10B981',
  emeraldInk: '#047857',
  emeraldSoft: '#ECFDF5',
  sky: '#F0F9FF',
  skyInk: '#0369A1',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray900: '#111827',
  white: '#FFFFFF',
} as const

export const SE_FONTS = {
  display: 'Space Grotesk',
  mono: 'Space Mono',
  ui: 'Inter',
} as const

export const SE_LAYOUT = {
  content: 1240,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 128, tablet: 96, mobile: 72 },
  radius: { button: 8, card: 12, surface: 20, window: 16 },
} as const

export const SE_EASE = 'cubic-bezier(.2,.7,.2,1)'

const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'

export const seAsset = (path: string) => (path.startsWith('http') ? path : `${ORIGIN}/brands/superelements/${path.replace(/^\/+/, '')}`)

export const SE_CONTACT = {
  email: 'contato@superelements.io',
  app: '/auth',
} as const
