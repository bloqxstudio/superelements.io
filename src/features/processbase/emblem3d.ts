import { EMBLEM_PIECES, EMBLEM_VIEW_JS, EMBLEM_VIEWBOX } from './emblem'

const PIECES_JSON = JSON.stringify(EMBLEM_PIECES.map((piece) => ({
  start: piece.start,
  pts: piece.points.map(([x, y]) => [+(x / EMBLEM_VIEWBOX - 0.5).toFixed(4), +(y / EMBLEM_VIEWBOX - 0.5).toFixed(4)]),
})))

/**
 * O emblema como bloco, desenhado num canvas. Começa reto, como a marca, e
 * gira até deitar em isometria 2:1; cada peça é um prisma, com a tampa mais
 * clara e as laterais mais escuras conforme o lado. O laranja varre cada peça
 * a partir do centro no sentido horário e desce pelas laterais junto com a
 * tampa.
 *
 * O canvas `.pb-emblem-canvas` ganha `pbEmblem = { tilt, fills, draw }`:
 * `tilt.v` (0 reto, 1 deitado) e `fills[k].v` (0 a 1, quanto da peça k está
 * laranja). O script da história (GSAP) muda esses valores e chama `draw`.
 * Sem ninguém mexer, o bloco fica deitado e cheio: é o estado final, o mesmo
 * de quando o GSAP não carrega.
 */
export const PROCESSBASE_EMBLEM_SCRIPT = `
(function () {
  ${EMBLEM_VIEW_JS}
  var PIECES = ${PIECES_JSON};
  var TOP = [43, 50, 70], SIDE_DARK = [29, 33, 49], SIDE_LIGHT = [38, 44, 63];
  var ORANGE = [255, 89, 0], ORANGE_DARK = [150, 52, 0], ORANGE_LIGHT = [208, 72, 0];

  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  // ângulo à moda do conic-gradient: 0° no alto, sentido horário
  function angle(u, v) { var a = Math.atan2(u, -v) * 57.2958; return a < 0 ? a + 360 : a; }
  function inside(u, v, start, sweep) { return sweep > 0 && ((angle(u, v) - start) % 360 + 360) % 360 <= sweep; }

  // sentido fixo para as normais apontarem para fora
  PIECES.forEach(function (piece) {
    var pts = piece.pts, area = 0;
    for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) pts.reverse();
    piece.cu = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length;
    piece.cv = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
  });

  // Trechos de um lado (de a até b) que caem dentro da varredura, em t de 0 a 1.
  function runs(a, b, start, sweep) {
    if (sweep <= 0) return [];
    var N = 48, out = [], open = -1, prev = false;
    var at = function (t) { return inside(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, start, sweep); };
    var edge = function (lo, hi, from) {
      for (var k = 0; k < 12; k++) { var mid = (lo + hi) / 2; if (at(mid) === from) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    };
    for (var i = 0; i <= N; i++) {
      var t = i / N, now = at(t);
      if (i === 0) { if (now) open = 0; }
      else if (now !== prev) {
        var cut = edge((i - 1) / N, t, prev);
        if (now) open = cut; else { out.push([open, cut]); open = -1; }
      }
      prev = now;
    }
    if (open > -1) out.push([open, 1]);
    return out;
  }

  function init(canvas) {
    if (canvas.pbEmblem) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var tilt = { v: 1 }, fills = PIECES.map(function () { return { v: 1 }; });
    var W = 0, H = 0, dpr = 1;

    function quad(v, a, b, t0, t1) {
      var p = function (t, z) { return viewAt(v, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z); };
      var q0 = p(t0, 0), q1 = p(t1, 0), q2 = p(t1, DEPTH), q3 = p(t0, DEPTH);
      ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q3[0], q3[1]); ctx.closePath(); ctx.fill();
    }

    function draw() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      var ratio = Math.min(2, window.devicePixelRatio || 1);
      if (w !== W || h !== H || ratio !== dpr) {
        W = w; H = h; dpr = ratio;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var v = view(clamp(tilt.v), W, H);
      // profundidade na tela: quanto mais para baixo, mais perto de quem olha
      var depth = function (u, q) { return u * v.s + q * v.c; };
      var order = PIECES.map(function (p, i) { return i; }).sort(function (a, b) { return depth(PIECES[a].cu, PIECES[a].cv) - depth(PIECES[b].cu, PIECES[b].cv); });
      order.forEach(function (index) {
        var piece = PIECES[index], pts = piece.pts, sweep = clamp(fills[index].v) * 100, faces = [];
        // reto, a espessura não aparece: só a tampa
        if (v.t > .01) {
          for (var i = 0; i < pts.length; i++) {
            var a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey);
            var nx = ey / len, ny = -ex / len, toward = nx * v.s + ny * v.c, side = nx * v.c - ny * v.s;
            // só os lados virados para quem olha (para baixo na tela)
            if (toward > .02) faces.push({ a: a, b: b, depth: depth(a[0] + b[0], a[1] + b[1]), light: .5 + .5 * side });
          }
        }
        faces.sort(function (x, y) { return x.depth - y.depth; });
        faces.forEach(function (face) {
          ctx.fillStyle = css(mix(SIDE_DARK, SIDE_LIGHT, face.light));
          quad(v, face.a, face.b, 0, 1);
          var lit = runs(face.a, face.b, piece.start, sweep);
          if (lit.length) {
            ctx.fillStyle = css(mix(ORANGE_DARK, ORANGE_LIGHT, face.light));
            lit.forEach(function (r) { quad(v, face.a, face.b, r[0], r[1]); });
          }
        });
        var top = new Path2D();
        pts.forEach(function (q, i) { var s = viewAt(v, q[0], q[1], DEPTH); i ? top.lineTo(s[0], s[1]) : top.moveTo(s[0], s[1]); });
        top.closePath();
        ctx.fillStyle = css(TOP); ctx.fill(top);
        if (sweep > 0) {
          ctx.save(); ctx.clip(top);
          var c = viewAt(v, 0, 0, DEPTH), wedge = new Path2D();
          wedge.moveTo(c[0], c[1]);
          for (var d = 0; ; d = Math.min(sweep, d + 4)) {
            var rad = (piece.start + d) / 57.2958, e = viewAt(v, Math.sin(rad) * 2, -Math.cos(rad) * 2, DEPTH);
            wedge.lineTo(e[0], e[1]);
            if (d >= sweep) break;
          }
          wedge.closePath();
          ctx.fillStyle = css(ORANGE); ctx.fill(wedge);
          ctx.restore();
        }
      });
    }

    canvas.pbEmblem = { tilt: tilt, fills: fills, draw: draw };
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(canvas);
    else window.addEventListener('resize', draw);
    draw();
  }

  // já na leitura do script (o canvas vem antes dele), para a história achar o pbEmblem pronto
  function boot() { [].forEach.call(document.querySelectorAll('canvas.pb-emblem-canvas'), init); }
  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
})();
`
