/**
 * Tokens da Ferreira & Bordinhão Advogados Associados
 * (`brands/ferreira-bordinhao/DESIGN.md`). O azul-marinho e a prata são os do
 * logo (`#1F3857` no ícone, `#D5D7D7` no monograma); o azul-petróleo é o anel
 * do selo que o escritório usa nos anúncios do Google (`Logo-da-Empresa-Google-Ads.png`).
 * Toda cor usada nos settings das seções está aqui e no front matter da marca
 * (hex em minúsculas, como a marca escreve): assim a marca aplicada por cima
 * não muda nada.
 */
export const FB = {
  /** azul-marinho do logo: cabeçalho, abertura, primeiro contato, chamada final; títulos no claro (11,9:1 no branco) */
  navy: '#1f3857',
  /** marinho profundo: rodapé */
  deep: '#152842',
  /** marinho levantado: cartões e quadros sobre o marinho */
  raised: '#25426a',
  /** azul-petróleo do selo dos anúncios: botão no claro (5,1:1 com branco), números e marcas */
  accent: '#1a759f',
  /** petróleo escuro: rótulos pequenos no claro e troca de cor do botão (6,4:1 no branco, 5,7:1 no gelo) */
  accentInk: '#13658a',
  /** petróleo claro: números, marcas e botão sobre o marinho, sempre com texto marinho (6,1:1) */
  accentLight: '#7cc3e6',
  /** petróleo mais claro: troca de cor do botão claro */
  accentPale: '#a9d8ef',
  /** branco: fundo das faixas claras */
  paper: '#ffffff',
  /** azul-gelo: faixas alternadas (onde fica, cartões das situações) */
  ice: '#eaf3f8',
  /** texto (10:1 no branco) e apoio (5,4:1 no branco, 4,8:1 no gelo) */
  body: '#33435a',
  muted: '#5b6b80',
  /** prata do logo: filetes no claro e texto no marinho (8,2:1) */
  silver: '#d5d7d7',
  /** apoio no marinho (5,8:1) */
  onDarkMuted: '#a9b6c8',
  /** filete no escuro: branco a 14% (no formato que a marca escreve) */
  lineDark: 'rgba(255, 255, 255, 0.14)',
  /** transparente com a base branca da paleta */
  clear: 'rgba(255, 255, 255, 0)',
  /** só no CSS do botão flutuante */
  whatsapp: '#25d366',
} as const

export const FB_FONTS = { title: 'Zilla Slab', text: 'Fira Sans' } as const

export const FB_LAYOUT = {
  content: 1200,
  gutter: { desktop: 32, tablet: 24, mobile: 16 },
  section: { desktop: 112, tablet: 88, mobile: 64 },
  /** cantos discretos de documento: botão 6px, cartão, foto e mapa 8px */
  radius: { button: 6, card: 8, photo: 8 },
} as const

export const FB_EASE = 'cubic-bezier(.2,0,0,1)'

/** Arquivos em public/. */
export const fbAsset = (path: string) => `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/** Logo completo (monograma "fb" + nome), fundo transparente; o nome do arquivo diz a cor da tinta. */
export const FB_LOGO = {
  onDark: { path: '/brands/ferreira-bordinhao/logo/ferreira-bordinhao-logo-branco.png', ratio: 376 / 139 },
  onLight: { path: '/brands/ferreira-bordinhao/logo/ferreira-bordinhao-logo-azul.png', ratio: 374 / 138 },
  symbolOnDark: { path: '/brands/ferreira-bordinhao/logo/ferreira-bordinhao-simbolo-branco.png', ratio: 219 / 297 },
  symbol: { path: '/brands/ferreira-bordinhao/logo/ferreira-bordinhao-simbolo-azul.png', ratio: 219 / 297 },
} as const
export const FB_NAME = 'Ferreira & Bordinhão Advogados Associados'

export const FB_PHOTOS = {
  partners: { path: '/brands/ferreira-bordinhao/fotos/socios.webp', alt: 'Joana Ferreira e Rodolfo Bordinhão, sócios do escritório, de pé diante da estante', ratio: 720 / 845 },
  letterhead: { path: '/brands/ferreira-bordinhao/fotos/papel-timbrado.webp', alt: 'Xícara de café sobre a mesa ao lado de uma folha com o logo Ferreira & Bordinhão', ratio: 956 / 790 },
} as const

/** Contato e registro públicos (`brands/ferreira-bordinhao/COPY.md` §1 e §2). */
export const FB_CONTACT = {
  /** WhatsApp principal do site (topo, cabeçalho, blog: "Olá, Dra. Joana") */
  whatsapp: '5551999748700',
  whatsappLabel: '(51) 99974-8700',
  /** WhatsApp das páginas de anúncio ("Olá, Dr. Rodolfo"); também o telefone da ficha do Google */
  whatsapp2: '5551995496114',
  whatsapp2Label: '(51) 99549-6114',
  phone: '555137863957',
  phoneLabel: '(51) 3786-3957',
  email: 'contato@ferreirabordinhao.adv.br',
  street: 'Av. João Corrêa, 1000, sala 404',
  district: 'Centro',
  city: 'São Leopoldo (RS)',
  cep: '93020-668',
  maps: 'Av. João Corrêa, 1000 - Centro, São Leopoldo - RS, 93020-668',
  firm: 'Ferreira & Bordinhão Advogados Associados',
  firmOab: 'OAB/RS 9.387',
  since: '2019',
  joana: { name: 'Joana Ferreira', oab: 'OAB/RS 78.159' },
  rodolfo: { name: 'Rodolfo Bordinhão', oab: 'OAB/RS 85.811' },
  googleRating: '4,8',
} as const

/**
 * Links do WhatsApp no mesmo formato do site atual (`api.whatsapp.com/send`),
 * para os gatilhos de conversão que já existem no Tag Manager continuarem
 * pegando o clique; cada botão leva a sua etiqueta `utm_campaign`, como hoje.
 */
const wa = (phone: string, text: string, place: string) =>
  `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}&utm_source=site&utm_medium=home&utm_campaign=whatsapp_${place}`

/** Mensagem neutra: o assunto na primeira linha, sem pedir detalhes do caso. */
export const fbWhatsApp = (place: string, subject?: string, phone: string = FB_CONTACT.whatsapp) =>
  wa(phone, subject ? `Olá! Vim pelo site do Ferreira & Bordinhão e gostaria de conversar sobre ${subject}.` : 'Olá! Vim pelo site do Ferreira & Bordinhão e gostaria de falar com um advogado.', place)
export const fbWhatsAppJoana = (place: string) => wa(FB_CONTACT.whatsapp, 'Olá, Dra. Joana! Vim pelo site do escritório e gostaria de conversar.', place)
export const fbWhatsAppRodolfo = (place: string) => wa(FB_CONTACT.whatsapp2, 'Olá, Dr. Rodolfo! Vim pelo site do escritório e gostaria de conversar.', place)
export const fbPhone = `tel:+${FB_CONTACT.phone}`
export const fbEmail = `mailto:${FB_CONTACT.email}`
export const fbDirections = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FB_CONTACT.maps)}`
