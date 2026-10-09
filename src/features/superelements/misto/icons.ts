/**
 * Ícones da tela do produto na página "Modelo · misto", no traço do lucide
 * (o que o app usa): 24×24, traço 2, pontas redondas. Entram como máscara CSS
 * num container vazio (`.ms-i.ms-i-<nome>`), que pinta com a cor de `--ic`.
 * O WordPress recusa SVG na biblioteca de mídia; a máscara fica no CSS da seção.
 */
const stroke = (body: string, width = 2) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='${width}' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`
const filled = (body: string, box = '0 0 24 24') => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box}' fill='black'>${body}</svg>`

export const MS_ICONS: Record<string, string> = {
  /** Os dois traços do símbolo do Superelements (sobre o quadrado lima). */
  se: filled("<path d='M14.77 14.56c-.41.4-1.22.73-1.8.73H7.12c-.58 0-.72-.33-.31-.73l6.41-6.28c.41-.4 1.22-.73 1.8-.73h5.85c.58 0 .72.33.31.73z'/><path d='M14.76 20.09c-.41.4-1.22.73-1.8.73H7.11c-.58 0-.72-.33-.31-.73l6.41-6.28c.41-.4 1.22-.73 1.8-.73h5.85c.58 0 .72.33.31.73z'/>", '0 0 28 28'),
  chevDown: stroke("<path d='m6 9 6 6 6-6'/>"),
  chevUp: stroke("<path d='m18 15-6-6-6 6'/>"),
  plus: stroke("<path d='M5 12h14M12 5v14'/>"),
  undo: stroke("<path d='M9 14 4 9l5-5'/><path d='M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11'/>"),
  redo: stroke("<path d='m15 14 5-5-5-5'/><path d='M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13'/>"),
  cloud: stroke("<path d='M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'/>"),
  cloudUp: stroke("<path d='M12 13v8'/><path d='M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24'/><path d='m8 17 4-4 4 4'/>"),
  play: filled("<path d='M7 4.6v14.8a1 1 0 0 0 1.5.86l12.3-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z'/>"),
  home: stroke("<path d='M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8'/><path d='M3 10a2 2 0 0 1 .7-1.53l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/>", 1.75),
  file: stroke("<path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'/><path d='M14 2v4a2 2 0 0 0 2 2h4'/><path d='M10 9H8M16 13H8M16 17H8'/>", 1.75),
  globe: stroke("<circle cx='12' cy='12' r='10'/><path d='M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'/><path d='M2 12h20'/>"),
  grip: filled("<circle cx='9' cy='5' r='1.6'/><circle cx='9' cy='12' r='1.6'/><circle cx='9' cy='19' r='1.6'/><circle cx='15' cy='5' r='1.6'/><circle cx='15' cy='12' r='1.6'/><circle cx='15' cy='19' r='1.6'/>"),
  more: filled("<circle cx='5' cy='12' r='1.7'/><circle cx='12' cy='12' r='1.7'/><circle cx='19' cy='12' r='1.7'/>"),
  pointer: stroke("<path d='M4.04 4.04a.5.5 0 0 1 .65-.65l15.9 6.5a.5.5 0 0 1-.07.95l-6.08 1.57a2 2 0 0 0-1.44 1.44l-1.57 6.08a.5.5 0 0 1-.95.07z'/>"),
  hand: stroke("<path d='M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/>"),
  monitor: stroke("<rect width='20' height='14' x='2' y='3' rx='2'/><path d='M8 21h8M12 17v4'/>"),
  tablet: stroke("<rect width='16' height='20' x='4' y='2' rx='2'/><path d='M12 18h.01'/>"),
  phone: stroke("<rect width='14' height='20' x='5' y='2' rx='2'/><path d='M12 18h.01'/>"),
  history: stroke("<path d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'/><path d='M3 3v5h5'/><path d='M12 7v5l4 2'/>"),
  /** Componente: o losango do canvas (o app usa o mesmo marcador em ciano). */
  diamond: stroke("<path d='M12 2.5l9.5 9.5-9.5 9.5L2.5 12z'/>"),
  section: stroke("<rect width='20' height='12' x='2' y='6' rx='2'/>"),
  x: stroke("<path d='M18 6 6 18M6 6l12 12'/>"),
  code: stroke("<path d='m16 18 6-6-6-6M8 6l-6 6 6 6'/>"),
  imagePlus: stroke("<path d='M16 5h6M19 2v6'/><path d='M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5'/><path d='m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21'/><circle cx='9' cy='9' r='2'/>"),
  wand: stroke("<path d='m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72'/><path d='m14 7 3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9'/>"),
  arrowUp: stroke("<path d='m5 12 7-7 7 7M12 19V5'/>"),
  square: filled("<rect x='5' y='5' width='14' height='14' rx='2'/>"),
  eye: stroke("<path d='M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0'/><circle cx='12' cy='12' r='3'/>"),
  pen: stroke("<path d='M12 20h9'/><path d='M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z'/>"),
  check: stroke("<path d='M20 6 9 17l-5-5'/>"),
  checkCircle: stroke("<circle cx='12' cy='12' r='10'/><path d='m9 12 2 2 4-4'/>"),
  loader: stroke("<path d='M21 12a9 9 0 1 1-6.22-8.56'/>"),
  ext: stroke("<path d='M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/>"),
  palette: stroke("<circle cx='13.5' cy='6.5' r='.5' fill='black'/><circle cx='17.5' cy='10.5' r='.5' fill='black'/><circle cx='8.5' cy='7.5' r='.5' fill='black'/><circle cx='6.5' cy='12.5' r='.5' fill='black'/><path d='M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z'/>"),
  type: stroke("<path d='M4 7V4h16v3M9 20h6M12 4v16'/>"),
  search: stroke("<circle cx='11' cy='11' r='8'/><path d='m21 21-4.3-4.3'/>"),
  target: stroke("<circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/>"),
  users: stroke("<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'/>"),
  chat: stroke("<path d='M7.9 20A9 9 0 1 0 4 16.1L2 22Z'/>"),
  car: stroke("<path d='M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2'/><circle cx='7' cy='17' r='2'/><path d='M9 17h6'/><circle cx='17' cy='17' r='2'/>"),
  camera: stroke("<path d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'/><circle cx='12' cy='13' r='3'/>"),
  leaf: stroke("<path d='M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'/><path d='M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'/>"),
  waves: stroke("<path d='M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'/>"),
  whatsapp: filled("<path d='M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.3 1 2.5.1.1 1.7 2.7 4.2 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.5z'/>"),
}

const uri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

/** Só o CSS dos ícones usados na seção. */
export const msIconCss = (names: Iterable<string>) =>
  [
    'selector .ms-i{flex:none!important;padding:0!important;min-height:0!important;background-color:var(--ic,currentColor);-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat}',
    ...[...new Set(names)].sort().map((name) => `selector .ms-i-${name}{--m:${uri(MS_ICONS[name])}}`),
  ].join('')

/** A seta do cursor do agente (AgentCursors.tsx): laranja do Claude Code com borda branca. */
export const AGENT_ARROW = uri(
  "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='26' viewBox='0 0 22 26'><path d='M3 2.2 L3 20.5 L8.1 15.7 L11.6 23.4 L15 21.9 L11.6 14.4 L18.4 14.4 Z' fill='#D97757' stroke='white' stroke-width='1.6' stroke-linejoin='round'/></svg>"
)
