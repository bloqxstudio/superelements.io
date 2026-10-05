/**
 * Peças gráficas do Avence Studio (identidade de 2026-10-04), em SVG para o CSS:
 * as marcas de corte (┐ e └) que emolduram a galeria dos cases e as setas dos
 * botões e ligações ("→" e "↗"). O logo é a palavra "avence" com o ponto azul
 * (`.space/avence-studio/build/gen-identidade.cjs`); a ponta com o quadrado
 * abaixo (`symbol`) foi um estudo da mesma tarde e só sobrevive nas marcas de corte.
 */
export const SYMBOL_BOX = '0 0 36 36'
export const FRAME_PATH = 'M0 0H36V36H28V8H0Z'
export const POINT_PATH = 'M0 14H22V36H0Z'
/** o canto de baixo (└), a ponta virada: as duas pontas juntas emolduram o que está entre elas */
export const CORNER_BL_PATH = 'M0 0H8V28H36V36H0Z'

const svg = (box: string, paths: Array<[string, string]>) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box}'>${paths.map(([d, c]) => `<path fill='${c}' d='${d}'/>`).join('')}</svg>`
const stroke = (d: string, width: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${d}' fill='none' stroke='#000' stroke-width='${width}' stroke-linecap='square' stroke-linejoin='miter'/></svg>`

/** SVG em data URI para `background-image` ou `mask` no CSS (decoração, nunca conteúdo). */
export const svgUri = (markup: string) => `url("data:image/svg+xml,${encodeURIComponent(markup)}")`

/** O símbolo inteiro: a ponta numa cor, o ponto em outra. */
export const symbol = (ink: string, point = ink) => svgUri(svg(SYMBOL_BOX, [[FRAME_PATH, ink], [POINT_PATH, point]]))
/** Os dois cantos sozinhos (┐ em cima à direita, └ embaixo à esquerda), para emoldurar. */
export const cornerTR = (color: string) => svgUri(svg(SYMBOL_BOX, [[FRAME_PATH, color]]))
export const cornerBL = (color: string) => svgUri(svg(SYMBOL_BOX, [[CORNER_BL_PATH, color]]))
/** Máscaras das setas dos botões: "→" e, para fora, "↗" (a ponta do símbolo com a cauda). */
export const arrowRightMask = svgUri(stroke('M3.5 12H19M13 6L19 12L13 18', 2.4))
export const arrowOutMask = svgUri(stroke('M9 5H19V15M18.5 5.5L5 19', 2.4))
