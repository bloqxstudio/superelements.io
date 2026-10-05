/**
 * Tokens do experimento Skiper UI (2026-10-05): um laboratório com os efeitos
 * dos componentes gratuitos da Skiper UI (skiper-ui.com), refeitos em árvores
 * nativas do Elementor. As cores e as fontes são as das demos da Skiper: papel
 * #f5f4f3, tinta, o laranja do skiper28, o lima e o azul-petróleo do skiper19,
 * Geist e Geist Mono.
 */
export const SK = {
  paper: '#f5f4f3',
  white: '#ffffff',
  /** faixa em volta da galeria em paralaxe (skiper30) */
  mist: '#eeeeee',
  ink: '#0a0a0a',
  body: '#3f3f3d',
  muted: '#7a7975',
  line: 'rgba(10, 10, 10, 0.1)',
  orange: '#ff5800',
  lime: '#c2f84f',
  petrol: '#1f3a4b',
  cream: '#fafdee',
  onDark: '#f5f4f3',
  onDarkMuted: 'rgba(245, 244, 243, 0.55)',
  lineDark: 'rgba(245, 244, 243, 0.14)',
  clear: 'rgba(245, 244, 243, 0)',
} as const

export const SK_FONTS = {
  sans: 'Geist',
  mono: 'Geist Mono',
} as const

/** Curvas: saída longa (expo) para entradas, ease-in-out para o hover das fotos. */
export const SK_EASE = {
  out: 'cubic-bezier(.16,1,.3,1)',
  inOut: 'cubic-bezier(.65,0,.35,1)',
} as const

export const SK_LAYOUT = {
  content: 1240,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 144, tablet: 104, mobile: 80 },
  radius: { card: 32, small: 16 },
} as const

export const skAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/** Fotos geradas para a biblioteca de seções (4:5, 1122 × 1402). */
const PHOTO = (name: string) => `/sections/c25/businesses/${name}.webp`
export const SK_PHOTOS = {
  ceramica: { path: PHOTO('atelie-ceramica'), alt: 'Ceramista modelando um vaso' },
  bar: { path: PHOTO('bar-noturno'), alt: 'Bar urbano à noite, na chuva' },
  barbearia: { path: PHOTO('barbearia'), alt: 'Barbearia' },
  wellness: { path: PHOTO('casa-serena-wellness'), alt: 'Sala de tratamento com paredes de cal' },
  cosmeticos: { path: PHOTO('cosmeticos-still-life'), alt: 'Frascos de cosmético em still life' },
  moda: { path: PHOTO('estudio-moda'), alt: 'Estúdio de moda' },
  musica: { path: PHOTO('estudio-musica'), alt: 'Estúdio de música' },
  flores: { path: PHOTO('floricultura-tropical'), alt: 'Arranjo de flores tropicais visto de cima' },
  boutique: { path: PHOTO('forma-boutique'), alt: 'Loja de moda autoral' },
  hotel: { path: PHOTO('hotel-vereda'), alt: 'Lobby de pousada aberto para um pátio' },
  materiais: { path: PHOTO('laboratorio-materiais'), alt: 'Laboratório de materiais' },
  rooftop: { path: PHOTO('movimento-rooftop'), alt: 'Aula de movimento num terraço' },
  estudio: { path: PHOTO('nexo-estudio-criativo'), alt: 'Estúdio criativo com mesa coletiva' },
  bicicletas: { path: PHOTO('oficina-bicicletas'), alt: 'Oficina de bicicletas' },
  padaria: { path: PHOTO('pausa-padaria-cafe'), alt: 'Balcão de padaria artesanal' },
  pet: { path: PHOTO('pet-daycare'), alt: 'Creche para cachorros' },
  restaurante: { path: PHOTO('restaurante-orla'), alt: 'Restaurante ao pôr do sol' },
  vinicola: { path: PHOTO('vinicola-colheita'), alt: 'Colheita numa vinícola' },
} as const

export type SkPhoto = keyof typeof SK_PHOTOS

/** Âncoras das seções (o cabeçalho liga para elas). */
export const SK_ANCHORS = {
  top: 'topo',
  stack: 'pilha',
  stroke: 'traco',
  parallax: 'paralaxe',
  expand: 'expandir',
  credits: 'creditos',
} as const

/** Componentes gratuitos da Skiper UI usados na página (o crédito do rodapé lista todos). */
export const SK_COMPONENTS = ['skiper16', 'skiper19', 'skiper28', 'skiper30', 'skiper31', 'skiper37', 'skiper41', 'skiper52', 'skiper53', 'skiper58', 'skiper61', 'skiper66', 'skiper89'] as const
