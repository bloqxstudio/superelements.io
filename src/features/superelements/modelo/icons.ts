/**
 * Ícones de traço da página modelo, desenhados aqui (24×24, traço 2). Entram
 * como máscara CSS num container vazio (`.sx-i.sx-i-<nome>`), que pinta com a
 * própria cor de fundo: o WordPress recusa SVG na biblioteca de mídia, e a
 * máscara troca de ícone só com uma classe (os chips que giram no hero).
 */
const stroke = (body: string) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`
const filled = (body: string, box = '0 0 24 24') => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box}' fill='black'>${body}</svg>`

export const SX_ICONS: Record<string, string> = {
  plus: stroke("<path d='M12 5v14M5 12h14'/>"),
  mic: stroke("<rect x='9' y='3' width='6' height='11' rx='3'/><path d='M5 11a7 7 0 0 0 14 0M12 18v3'/>"),
  up: stroke("<path d='M12 19V5M5.5 11.5L12 5l6.5 6.5'/>"),
  trend: stroke("<path d='M3 17l6-6 4 4 8-8M14 7h7v7'/>"),
  grid: stroke("<rect x='3.5' y='3.5' width='7' height='7' rx='1.5'/><rect x='13.5' y='3.5' width='7' height='7' rx='1.5'/><rect x='3.5' y='13.5' width='7' height='7' rx='1.5'/><rect x='13.5' y='13.5' width='7' height='7' rx='1.5'/>"),
  palette: stroke("<path d='M12 3a9 9 0 1 0 0 18c1.2 0 1.7-1 1.3-1.9-.5-1.1.3-2.4 1.5-2.4H17a4 4 0 0 0 4-4C21 7 17 3 12 3z'/><circle cx='7.5' cy='11' r='.6'/><circle cx='10' cy='7' r='.6'/><circle cx='14.5' cy='7' r='.6'/>"),
  globe: stroke("<circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'/>"),
  download: stroke("<path d='M12 3v12M7 10l5 5 5-5M5 21h14'/>"),
  upload: stroke("<path d='M12 21V9M7 14l5-5 5 5M5 3h14'/>"),
  type: stroke("<path d='M5 7V4h14v3M12 4v16M9 20h6'/>"),
  link: stroke("<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'/><path d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>"),
  diamond: stroke("<path d='M12 3l9 9-9 9-9-9z'/>"),
  phone: stroke("<rect x='7' y='2.5' width='10' height='19' rx='2.5'/><path d='M11 18h2'/>"),
  desktop: stroke("<rect x='3' y='4' width='18' height='12' rx='2'/><path d='M8 20h8M12 16v4'/>"),
  tablet: stroke("<rect x='5' y='3' width='14' height='18' rx='2.5'/><path d='M11 17.5h2'/>"),
  check: stroke("<path d='M5 12.5l4.5 4.5L19 7.5'/>"),
  checkCircle: stroke("<circle cx='12' cy='12' r='9'/><path d='M8 12.5l2.8 2.8L16 10'/>"),
  sparkle: filled("<path d='M12 2.5l2 6.1 6.5 2.4-6.5 2.4-2 6.1-2-6.1-6.5-2.4 6.5-2.4z'/>"),
  play: filled("<path d='M7 4.5v15l12.5-7.5z'/>"),
  layers: stroke("<path d='M12 3l9 5-9 5-9-5z'/><path d='M3 13l9 5 9-5'/>"),
  undo: stroke("<path d='M9 14L4 9l5-5'/><path d='M4 9h10.5a5.5 5.5 0 0 1 0 11H12'/>"),
  prev: stroke("<path d='M14.5 6l-6 6 6 6'/>"),
  next: stroke("<path d='M9.5 6l6 6-6 6'/>"),
  ext: stroke("<path d='M7 17L17 7M8.5 7H17v8.5'/>"),
  plug: stroke("<path d='M9 2.5v5M15 2.5v5M6 7.5h12V11a6 6 0 0 1-12 0zM12 17v4.5'/>"),
  key: stroke("<circle cx='7.5' cy='15.5' r='4.5'/><path d='M10.7 12.3L20 3M16 7l3 3'/>"),
  shield: stroke("<path d='M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z'/><path d='M8.5 12l2.5 2.5 4.5-5'/>"),
  history: stroke("<path d='M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5'/><path d='M3.5 3.5v5h5M12 7.5V12l3 2'/>"),
  page: stroke("<path d='M6 3h8l4 4v14H6z'/><path d='M14 3v4h4M9 12h6M9 16h4'/>"),
  cloud: stroke("<path d='M7 18.5a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.4 11 3.8 3.8 0 0 1 18 18.5z'/>"),
  users: stroke("<circle cx='9' cy='8' r='3.5'/><path d='M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6 6 0 0 1 3.5 6'/>"),
  star: filled("<path d='M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'/>"),
  chat: stroke("<path d='M4 5h16v11H9l-5 4z'/>"),
  wand: stroke("<path d='M4 20L15 9M14 4v3M19 9h3M17.5 5.5l2-2M12.5 7.5l4 4'/>"),
  image: stroke("<rect x='3' y='4' width='18' height='16' rx='2'/><circle cx='9' cy='10' r='2'/><path d='M21 16l-5-5-9 9'/>"),
  stack: stroke("<rect x='4' y='4' width='16' height='5' rx='1.5'/><rect x='4' y='11' width='16' height='4' rx='1.5'/><rect x='4' y='17' width='16' height='3' rx='1.5'/>"),
  bolt: filled("<path d='M13 2L4.5 13.5H11L10 22l8.5-11.5H12z'/>"),
  /** Os dois traços do símbolo do Superelements (logo/se-simbolo.svg), sobre o quadrado lima do container. */
  se: filled("<path d='M14.77 14.56c-.41.4-1.22.73-1.8.73H7.12c-.58 0-.72-.33-.31-.73l6.41-6.28c.41-.4 1.22-.73 1.8-.73h5.85c.58 0 .72.33.31.73z'/><path d='M14.76 20.09c-.41.4-1.22.73-1.8.73H7.11c-.58 0-.72-.33-.31-.73l6.41-6.28c.41-.4 1.22-.73 1.8-.73h5.85c.58 0 .72.33.31.73z'/>", '0 0 28 28'),
  eye: stroke("<path d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'/><circle cx='12' cy='12' r='3'/>"),
  clock: stroke("<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>"),
  chart: stroke("<path d='M4 20V10M10 20V4M16 20v-7M21 20H3'/>"),
  calendar: stroke("<rect x='3.5' y='5' width='17' height='15.5' rx='2.5'/><path d='M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4'/>"),
  mail: stroke("<rect x='3' y='5' width='18' height='14' rx='2.5'/><path d='M3.5 6.5L12 13l8.5-6.5'/>"),
  cube: stroke("<path d='M12 3l8 4.5v9L12 21l-8-4.5v-9z'/><path d='M4 7.5l8 4.5 8-4.5M12 12v9'/>"),
  close: stroke("<path d='M6 6l12 12M18 6L6 18'/>"),
  /** Barras de um áudio: 80×24. */
  wave: filled("<rect x='0' y='9' width='3' height='6' rx='1.5'/><rect x='7' y='6' width='3' height='12' rx='1.5'/><rect x='14' y='2' width='3' height='20' rx='1.5'/><rect x='21' y='7' width='3' height='10' rx='1.5'/><rect x='28' y='4' width='3' height='16' rx='1.5'/><rect x='35' y='9' width='3' height='6' rx='1.5'/><rect x='42' y='3' width='3' height='18' rx='1.5'/><rect x='49' y='7' width='3' height='10' rx='1.5'/><rect x='56' y='5' width='3' height='14' rx='1.5'/><rect x='63' y='9' width='3' height='6' rx='1.5'/><rect x='70' y='10' width='3' height='4' rx='1.5'/><rect x='77' y='11' width='3' height='2' rx='1'/>", '0 0 80 24'),
}

const uri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

/** CSS de todos os ícones: `.sx-i` pinta a cor, `.sx-i-<nome>` escolhe o desenho. */
export const SX_ICON_CSS = [
  'selector .sx-i{flex:none!important;padding:0!important;min-height:0;background-color:var(--sx-ic,currentColor);-webkit-mask:var(--sx-mask) center/contain no-repeat;mask:var(--sx-mask) center/contain no-repeat}',
  ...Object.entries(SX_ICONS).map(([name, svg]) => `selector .sx-i-${name}{--sx-mask:${uri(svg)}}`),
].join('')
