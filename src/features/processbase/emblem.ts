/**
 * Emblema da ProcessBase (logo/processbase-symbol.svg, viewBox 102.04): quatro
 * peças em volta do octógono vazio. A ordem é a dos pilares, no sentido
 * horário a partir do alto à esquerda. `start` é o ângulo (0° no alto, sentido
 * horário) em que a peça começa, visto do centro: o preenchimento varre 100°
 * dali, e cada peça ocupa cerca de 97°.
 */
export const EMBLEM_VIEWBOX = 102.04

export interface EmblemPiece { pillar: string; start: number; points: Array<[number, number]> }

export const EMBLEM_PIECES: EmblemPiece[] = [
  { pillar: 'Cultura', start: 266, points: [[0, 53.06], [0, 19.39], [19.39, 0], [39.79, 0], [53.06, 26.53], [36.22, 26.53], [26.53, 36.22], [26.53, 39.79]] },
  { pillar: 'Processos', start: -4, points: [[48.98, 0], [82.65, 0], [102.04, 19.39], [102.04, 39.79], [75.51, 53.06], [75.51, 36.22], [65.81, 26.53], [62.24, 26.53]] },
  { pillar: 'Treinamentos', start: 86, points: [[102.04, 48.98], [102.04, 82.65], [82.65, 102.04], [62.25, 102.04], [48.98, 75.51], [65.82, 75.51], [75.51, 65.81], [75.51, 62.24]] },
  { pillar: 'Planejamento', start: 176, points: [[53.06, 102.03], [19.39, 102.03], [0, 82.65], [0, 62.24], [26.53, 48.98], [26.53, 65.81], [36.23, 75.51], [39.8, 75.51]] },
]

/** Peças em coordenadas de 0 a 1, para o grafo desenhar o logo com pontos. */
export const EMBLEM_UNIT = EMBLEM_PIECES.map((piece) => piece.points.map(([x, y]) => [+(x / EMBLEM_VIEWBOX).toFixed(4), +(y / EMBLEM_VIEWBOX).toFixed(4)]))

/**
 * O emblema em 3D: um bloco com espessura que começa reto, visto de cima como
 * a marca, e com o scroll gira 45° e deita em isometria 2:1 (a mesma razão
 * dos cortes do emblema). `t` vai de 0 (reto) a 1 (deitado): o plano gira,
 * a vertical achata pela metade e a espessura aparece. Coordenadas
 * centradas: o emblema vai de -0,5 a 0,5.
 */
export const EMBLEM_DEPTH = 0.1

const VIEW_POINTS = EMBLEM_UNIT.flat().map(([x, y]) => [+(x - 0.5).toFixed(4), +(y - 0.5).toFixed(4)])

/**
 * A projeção em JS, para os scripts do canvas: `view(t, w, h)` encaixa o
 * bloco daquele giro num retângulo e `viewAt` projeta um ponto (u, v
 * centrados; z em unidades do emblema).
 */
export const EMBLEM_VIEW_JS = `
  var DEPTH = ${EMBLEM_DEPTH}, VIEW_POINTS = ${JSON.stringify(VIEW_POINTS)};
  function view(t, w, h) {
    var th = t * .7854, c = Math.cos(th), s = Math.sin(th), sq = 1 - .5 * t;
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    VIEW_POINTS.forEach(function (p) {
      var r = p[0] * c - p[1] * s, q = (p[0] * s + p[1] * c) * sq;
      if (r < x0) x0 = r; if (r > x1) x1 = r;
      if (q - DEPTH * t < y0) y0 = q - DEPTH * t; if (q > y1) y1 = q;
    });
    x0 -= .02; x1 += .02; y0 -= .02; y1 += .02;
    var k = Math.min(w / (x1 - x0), h / (y1 - y0)), free = h - (y1 - y0) * k;
    // deitando, o bloco assenta: desce da metade para perto da base do quadro
    return { t: t, c: c, s: s, sq: sq, k: k, x: (w - (x1 - x0) * k) / 2 - x0 * k, y: free * (.5 + .35 * t) - y0 * k };
  }
  function viewAt(v, u, q, z) { return [v.x + (u * v.c - q * v.s) * v.k, v.y + ((u * v.s + q * v.c) * v.sq - z * v.t) * v.k]; }
`
