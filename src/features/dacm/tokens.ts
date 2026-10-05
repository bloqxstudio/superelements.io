/**
 * Tokens da DACM Advogados (Depizzol Andrade & Cassel Martins Advogados
 * Associados), de `brands/dacm-advogados/DESIGN.md`. As cores saem do logo:
 * a tinta azul-ardósia do nome, o azul dos quadros do monograma e o cinza dos
 * outros dois quadros. Toda cor usada nos settings das seções está aqui e no
 * front matter da marca (hex em minúsculas, como a marca escreve): assim a
 * marca aplicada por cima não muda nada.
 */
export const DC = {
  /** tinta do nome no logo: títulos, botão principal, faixas escuras (10,5:1 no branco) */
  ink: '#2f3f61',
  /** azul dos quadros "A" e "C" do monograma: os quadros azuis (texto branco 9,6:1) */
  slate: '#34466b',
  /** quadro azul levantado sobre a faixa escura */
  slateRaised: '#3c5079',
  /** azul quase preto: texto sobre o cinza do logo (5,3:1) e títulos no concreto */
  deep: '#1c2639',
  /** cinza dos quadros "D" e "M" do monograma e do "&" do nome: só quadros e marcas, texto nele é `deep` */
  gray: '#999999',
  /** papel da página */
  paper: '#ffffff',
  /** concreto frio: faixas alternadas */
  concrete: '#eceef1',
  /** texto (9,5:1 no branco) e apoio (5,9:1 no branco, 5,0:1 no concreto) */
  body: '#3d4657',
  muted: '#5d6574',
  /** filete claro */
  line: '#d5d9e0',
  /** texto na faixa escura (8,6:1) e apoio (5,0:1) */
  onDark: '#d3dae6',
  onDarkMuted: '#a9b4c8',
  /** filete no escuro: branco a 16% (no formato que a marca escreve) */
  lineDark: 'rgba(255, 255, 255, 0.16)',
  /** transparente com a base branca da paleta */
  clear: 'rgba(255, 255, 255, 0)',
  /** só no CSS do botão flutuante */
  whatsapp: '#25d366',
} as const

export const DC_FONTS = { title: 'Sofia Sans Condensed', text: 'Sofia Sans' } as const

export const DC_LAYOUT = {
  content: 1240,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 120, tablet: 88, mobile: 64 },
  /** botão de canto quase reto; os quadros têm os dois cantos opostos arredondados, como o monograma */
  radius: { button: 4, tile: 28, tileSmall: 20 },
} as const

export const DC_EASE = 'cubic-bezier(.2,0,0,1)'

/** Arquivos em public/. */
export const dcAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/** Logo do site atual (400 × 121, tinta ardósia em fundo transparente): só sobre fundo claro. */
export const DC_LOGO = { path: '/brands/dacm-advogados/logo/dacm-advogados-logo.png', ratio: 400 / 121 }
export const DC_MONOGRAM = '/brands/dacm-advogados/logo/dacm-monograma.png'
export const DC_NAME = 'Depizzol Andrade & Cassel Martins Advogados Associados'

/** Contato, registro e sócios públicos (`brands/dacm-advogados/COPY.md` §1 a §3). */
export const DC_CONTACT = {
  /** o WhatsApp do botão do site atual e da ficha do Google; a página de anúncio usa outro (pendência) */
  whatsapp: '5551993659237',
  whatsappLabel: '(51) 99365-9237',
  phone: '555130372286',
  phoneLabel: '(51) 3037-2286',
  email: 'advocacia@dacmadvogados.com.br',
  street: 'R. Marquês do Herval, 1236, sala 502',
  district: 'Centro',
  city: 'São Leopoldo (RS)',
  cep: '93010-200',
  maps: 'R. Marquês do Herval, 1236 - Centro, São Leopoldo - RS, 93010-200',
  legalName: 'Depizzol Andrade e Cassel Martins Advogados Associados',
  cnpj: '10.986.564/0001-07',
  /** registro da sociedade no rodapé do site de 2017 (Wayback): a confirmar */
  oabSociety: 'OAB/RS 3.735',
  since: '2009',
  instagram: 'dacmadvogados',
  rating: '4,9',
} as const

export const DC_PARTNERS = [
  { name: 'Luiz Fernando Depizzol Andrade', short: 'Luiz Fernando', initials: 'DA', oab: 'OAB/RS 72.438', email: 'luiz@dacmadvogados.com.br', education: 'Graduado pela Unisinos. Pós-graduado em Direito do Trabalho e Previdenciário pelo Centro Universitário Ritter dos Reis (UniRitter).', founder: true },
  { name: 'Francisco Cassel Martins', short: 'Francisco', initials: 'CM', oab: 'OAB/RS 64.232', email: 'francisco@dacmadvogados.com.br', education: 'Graduado pela Unisinos. Pós-graduado em Direito Empresarial pela Universidade Federal do Rio Grande do Sul (UFRGS).', founder: true },
  { name: 'Marcus Vinicius Ortácio', short: 'Marcus Vinicius', initials: 'MO', oab: 'OAB/RS 84.915', email: '', education: 'Graduado pela Unisinos.', founder: false },
] as const

const wa = (text: string) => `https://wa.me/${DC_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

/** Mensagens neutras: o assunto na primeira linha, sem pedir detalhes do caso. */
export const dcWhatsApp = (subject?: string) =>
  wa(subject ? `Olá! Vim pelo site da DACM Advogados e gostaria de conversar sobre ${subject}.` : 'Olá! Vim pelo site da DACM Advogados e gostaria de conversar.')
export const dcPhone = `tel:+${DC_CONTACT.phone}`
export const dcEmail = `mailto:${DC_CONTACT.email}`
export const dcDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(DC_CONTACT.maps)}`
export const dcInstagram = `https://www.instagram.com/${DC_CONTACT.instagram}/`

/**
 * Medição dos anúncios (COPY.md §6): a tag do Google Ads do site atual e a
 * conversão do formulário, que hoje dispara na página /obrigado.
 */
export const DC_ADS = {
  tag: 'AW-374493462',
  formConversion: 'AW-374493462/fT3KCKq4jIscEJaiybIB',
  thanksPage: 'https://dacmadvogados.com.br/obrigado/',
  /** rótulo da conversão "clique no WhatsApp": criar no Google Ads e preencher ao publicar */
  whatsappConversion: '',
} as const
