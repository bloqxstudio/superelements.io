/**
 * Tokens da Zelo (zelosistemas.com.br), lidos dos estilos calculados do site.
 * O site mede tudo em rem com `html { font-size: 80% }`: os valores abaixo já
 * estão em px (1rem = 12,8px). Tema escuro, que é o padrão do site.
 */
export const ZELO = {
  paper: '#000000',
  raised: '#13201C',
  band: '#283933',
  ink: '#FFFFFF',
  soft: '#A8A8A8',
  /** --ink-soft a 72%: notas miúdas e eixos. */
  faint: '#A8A8A8B8',
  green: '#90B8A6',
  green2: '#BAD5C8',
  /** --line: verde a 20%. */
  line: '#90B8A633',
  /** --line-strong: verde a 38%. */
  lineStrong: '#90B8A661',
  /** fundo das pastilhas: verde a 9%. */
  wash: '#90B8A617',
  red: '#E0897B',
  online: '#3DD68C',
  /** as três alturas do gradiente da palavra pintada do título */
  titleDeep: '#51675D',
  titleGreen: '#5F796E',
  titleShine: '#CFE2D9',
} as const

export const ZELO_FONTS = {
  title: 'Plus Jakarta Sans',
  ui: 'Nunito',
  text: 'Figtree',
  mono: 'Spline Sans Mono',
} as const

export const ZELO_LAYOUT = {
  /** .wrap tem 1120px com o gutter dentro: sobram 1044px de conteúdo. */
  content: 1044,
  gutter: { desktop: 38, tablet: 29, mobile: 15 },
  section: { desktop: 97, tablet: 72, mobile: 55 },
  nav: 57,
  radius: { xs: 7, sm: 11, md: 16, lg: 21, pill: 999 },
} as const

export const ZELO_SHADOW = '0 1px 0 rgba(0,0,0,.25),0 12px 32px -22px rgba(0,0,0,.85)'

/** Arquivos em public/zelo/assets. */
export const zeloAsset = (name: string) => `${window.location.origin}/zelo/assets/${name}`

export const ZELO_CONTACT = {
  whatsapp: '5551999894892',
  whatsappLabel: '(51) 99989-4892',
  email: 'infoo.zelo@gmail.com',
} as const

export const zeloWhatsApp = (text: string) => `https://wa.me/${ZELO_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
