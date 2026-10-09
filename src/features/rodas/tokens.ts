/**
 * Experimento "Rodas": o desenho e o movimento do portfólio de
 * https://carterogunsola.com/ (pedido do usuário em 2026-10-09, "faça exatamente
 * como está no site"), com o conteúdo do Avence Studio. Medidas tiradas do
 * site ao vivo: papel com grão, cromo de 40px, rótulos em mono de 10px, cantos
 * de 2 a 8px. A fonte do original é comercial (Oracle); aqui é a Geist, que o
 * próprio site usa de reserva.
 */

/** Tema escuro, o padrão da página. */
export const RO = {
  paper: '#1e1e1e',
  surface: '#262626',
  ink: '#f7f7f7',
  muted: 'rgba(247, 247, 247, 0.5)',
  hudKey: 'rgba(247, 247, 247, 0.32)',
  hudValue: 'rgba(247, 247, 247, 0.66)',
  fill: 'rgba(247, 247, 247, 0.08)',
  line: 'rgba(247, 247, 247, 0.06)',
  divider: 'rgba(247, 247, 247, 0.2)',
  spot: '#e06a4a',
} as const

/** Tema claro (a chave do cabeçalho). Só o CSS usa: as cores dos settings são as do escuro. */
export const RO_LIGHT = {
  paper: '#d6d6d5',
  surface: '#fdfcfb',
  ink: '#1e1e1e',
  muted: 'rgba(30, 30, 30, 0.7)',
  hudKey: 'rgba(30, 30, 30, 0.32)',
  hudValue: 'rgba(30, 30, 30, 0.66)',
  fill: 'rgba(30, 30, 30, 0.08)',
  line: 'rgba(30, 30, 30, 0.06)',
  divider: 'rgba(30, 30, 30, 0.2)',
  spot: '#b03a1e',
} as const

export const RO_FONT = 'Geist'
export const RO_MONO = 'Geist Mono'

/** ease-out-expo, a curva de quase tudo no original */
export const RO_EASE = 'cubic-bezier(.16,1,.3,1)'

/** margem lateral: 16px no celular até 30px no desktop */
export const RO_MARGIN = 'clamp(16px, calc(11.07px + 1.3146vw), 30px)'
