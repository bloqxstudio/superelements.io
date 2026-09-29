export const MSA = {
  paper: '#F3EFE4',
  ink: '#2F2317',
  muted: '#61695B',
  sage: '#BED499',
  soft: '#E6E1D2',
  white: '#FFFFFF',
  line: 'rgba(47,35,23,0.20)',
  lineSoft: 'rgba(47,35,23,0.14)',
  lineDark: 'rgba(243,239,228,0.18)',
  onDark: 'rgba(243,239,228,0.74)',
} as const

export const MSA_FONTS = { display: 'Syne', body: 'Urbanist' } as const

export const MSA_LAYOUT = {
  content: 1180,
  gutter: { desktop: 32, tablet: 24, mobile: 20 },
  section: { desktop: 112, tablet: 84, mobile: 64 },
  radius: { button: 2, panel: 0 },
} as const

export const MSA_EASE = 'cubic-bezier(.22,1,.36,1)'

export const msaAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

export const MSA_LINKS = {
  apply: 'https://msaforms.netlify.app/',
  instagram: 'https://www.instagram.com/hzanotti/',
} as const

