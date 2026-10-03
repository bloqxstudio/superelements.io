/**
 * Tokens do experimento Evermind (seção evermind-hero-2 da BYQ, template
 * Evermind™ em Webflow). Valores medidos no CSS e nos SVGs do original.
 */
export const EV = {
  paper: '#F4F3EA',
  ink: '#1A1A17',
  lime: '#B6E400',
  pill: '#E6E8DD',
  /** Rótulo "CLIENT STORY" do widget de vidro. */
  label: '#3F403C',
  /** Seta do rótulo do topo: #181E25 a 48%. */
  chevron: 'rgba(24, 30, 37, 0.48)',
  inkSoft: 'rgba(26, 26, 23, 0.64)',
  paper48: 'rgba(244, 243, 234, 0.48)',
  paper64: 'rgba(244, 243, 234, 0.64)',
  paper0: 'rgba(244, 243, 234, 0)',
  bar: 'rgba(26, 26, 23, 0.64)',
} as const

export const EV_FONTS = {
  serif: 'Merriweather',
  sans: '42dot Sans',
} as const

/** Curvas do Webflow IX2 usadas na seção. */
export const EV_EASE = {
  outCirc: 'cubic-bezier(.075,.82,.165,1)',
  outQuint: 'cubic-bezier(.23,1,.32,1)',
  easeOut: 'cubic-bezier(0,0,.58,1)',
} as const

const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'

export const evAsset = (file: string) => `${ORIGIN}/brands/evermind/${file.replace(/^\/+/, '')}`
