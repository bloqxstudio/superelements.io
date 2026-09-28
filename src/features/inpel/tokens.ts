/**
 * Tokens da Inpel (inpel.com.br), lidos dos estilos calculados do site em
 * 2026-09-27. O site é um app Vue sobre o tema "Electro" (Bootstrap 3):
 * container de 1170px com 15px de cada lado, Montserrat 400/500/700.
 */
export const INPEL = {
  /** vermelho da marca: botão de busca, ícones, faixa diagonal dos destaques */
  red: '#D10024',
  /** hover dos botões vermelhos (o tema escurece o vermelho) */
  redDeep: '#A8001D',
  /** títulos, nomes de produto, menu */
  ink: '#2B2D42',
  /** texto corrido */
  body: '#333333',
  /** categoria do card e trilha do breadcrumb */
  muted: '#8D99AE',
  line: '#E4E7ED',
  /** faixa do breadcrumb */
  mist: '#FBFBFC',
  paper: '#FFFFFF',
  /** barra de contato do topo e barra do crédito */
  bar: '#1E1F29',
  /** rodapé */
  footer: '#15161D',
  footerText: '#B9BABC',
  /** links das hashtags e menções dos posts */
  link: '#4150F7',
} as const

export const INPEL_FONT = 'Montserrat'

export const INPEL_LAYOUT = {
  /** .container de 1170px menos as colunas de 15px: 1140px de conteúdo. */
  content: 1140,
  gutter: { desktop: 15, tablet: 15, mobile: 15 },
  /** .section { padding: 30px 0 } */
  section: 30,
  /** topo desktop: faixa de 3px + barra de 40px + marca de 105px */
  topBar: 40,
  radius: { pill: 40 },
} as const

/** Arquivos em public/inpel/assets. */
export const inpelAsset = (path: string) => `${window.location.origin}/inpel/assets/${path}`

/** Contato publicado no cabeçalho e no rodapé do site (API `telas/cabeçalho`, `telas/rodapé`). */
export const INPEL_CONTACT = {
  phone: '(51) 3034-3000',
  phoneHref: 'tel:+555130343000',
  whatsapp: '5551998314010',
  whatsappLabel: '(51) 99831-4010',
  email: 'vendas@inpel.com.br',
  address: 'Rua Impel, 29 - Bairro Colonial - Sapucaia do Sul/RS',
  addressLines: ['Rua Impel, 29 Bairro Colonial', 'Sapucaia do Sul/RS'],
  maps: 'Indústria de Peças Inpel S/A, R. Impel, 29 - Colonial, Sapucaia do Sul - RS, 93212-280',
  careers: 'https://industriadepecasinpelsa.pandape.infojobs.com.br/',
  manual: 'https://inpelcombr-my.sharepoint.com/:b:/g/personal/elis_inpel_com_br/EY9HndV5BSJOiHFTNl35_EUBNqK37TLVM_qzODHLxomgKA?e=bDGeeK',
  social: {
    facebook: 'https://www.facebook.com/inpeltransmissoes',
    linkedin: 'https://www.linkedin.com/company/inpeltransmissoesmecanicas',
    instagram: 'https://www.instagram.com/inpel_transmissoesmecanicas/',
    youtube: 'https://www.youtube.com/channel/UCgvEVybHpiV9LYJB5QKIx1A',
  },
  agency: 'https://avancedigital.com.br/',
} as const

export const inpelWhatsApp = `https://wa.me/${INPEL_CONTACT.whatsapp}`
