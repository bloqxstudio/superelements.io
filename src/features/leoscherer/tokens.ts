/** Valores calculados em leoscherer.com.br em 2026-09-28. */
export const LS = {
  black: '#000000', raised: '#101010', hero: '#151C25', paper: '#FFFFFF',
  ink: '#FFFFFF', body: '#6D6D6D', soft: '#B6B6B6', purple: '#7F54B3',
  blue: '#6EC1E4', red: '#FF0000', line: 'rgba(255,255,255,0.16)',
} as const

export const LS_FONTS = { display: 'Helvetica', body: 'Source Sans Pro' } as const
export const LS_LAYOUT = {
  content: 1120,
  gutter: { desktop: 20, tablet: 20, mobile: 16 },
  breakpoint: { tablet: 1024, mobile: 767 },
} as const

export const lsAsset = (file: string) => `${window.location.origin}/leoscherer/assets/${file}`

