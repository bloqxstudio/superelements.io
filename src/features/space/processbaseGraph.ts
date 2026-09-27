import { EMBLEM_UNIT, EMBLEM_VIEW_JS } from '@/features/processbase/emblem'

/**
 * Fundo animado do hero da ProcessBase: um grafo de conexões, como o do
 * Obsidian, em ardósia sobre o navy. Um único sinal laranja (a "faísca" da
 * marca) percorre ciclos de quatro nós, os quatro pilares, e acelera a cada
 * volta: "+ ciclos = + velocidade". Depois de cinco voltas, respira e recomeça.
 *
 * Com o scroll, as ideias viram o logo: `host.pbForm` (0 a 1, escrito pelo
 * script da história com GSAP) leva cada nó por uma curva até um ponto do
 * contorno das quatro peças do emblema, reto como a marca, no lugar do
 * `.pb-emblem-canvas`, e a poeira preenche as peças. O bloco só gira depois.
 *
 * Roda dentro de um widget HTML do Elementor, sem dependências. Procura os
 * `canvas.pb-graph` da página; a história é o `.pb-story` mais próximo e o
 * bloco `.pb-hero-content` define a área que fica mais limpa atrás do texto.
 * O canvas tem a altura da tela (CSS) e fica preso no topo enquanto a
 * história passa. `data-line` e `data-accent` no canvas trocam as cores.
 * Com movimento reduzido, desenha um quadro parado com um ciclo aceso.
 */
export const PROCESSBASE_GRAPH_SCRIPT = `
(function () {
  var motionQuery = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = !!(motionQuery && motionQuery.matches);
  var BASE_HOP = 760, MIN_HOP = 360, CYCLES = 5;
  var PIECES = ${JSON.stringify(EMBLEM_UNIT)};
  ${EMBLEM_VIEW_JS}

  function rgb(hex, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return fallback;
    var n = parseInt(m[1], 16);
    return (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255);
  }
  function seeded(seed) {
    return function () {
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function key(a, b) { return a < b ? a + '-' + b : b + '-' + a; }

  // Contorno de uma peça com \`count\` pontos: os cantos sempre entram, o
  // resto se reparte pelos lados conforme o comprimento.
  function outline(poly, count) {
    var n = poly.length, pts = [], i, k;
    if (count <= n) {
      for (i = 0; i < count; i++) pts.push(poly[Math.floor(i * n / count)]);
      return pts;
    }
    var lens = [], total = 0, extra = count - n;
    for (i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      lens.push(l); total += l;
    }
    var share = lens.map(function (l) { return extra * l / total; });
    var given = share.map(Math.floor), rest = extra - given.reduce(function (s, v) { return s + v; }, 0);
    share.map(function (s, j) { return [s - given[j], j]; })
      .sort(function (x, y) { return y[0] - x[0]; })
      .slice(0, rest).forEach(function (r) { given[r[1]]++; });
    for (i = 0; i < n; i++) {
      var p = poly[i], q = poly[(i + 1) % n];
      pts.push(p);
      for (k = 1; k <= given[i]; k++) {
        var t = k / (given[i] + 1);
        pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    return pts;
  }
  function perimeter(poly) {
    for (var i = 0, total = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return total;
  }
  function inside(poly, x, y) {
    for (var c = false, i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  // Curva de um ponto a outro, com a barriga sempre para o mesmo lado: as
  // ideias chegam girando, como um redemoinho.
  function travel(x0, y0, x1, y1, t, bend) {
    var dx = x1 - x0, dy = y1 - y0, mx = x0 + dx / 2 - dy * bend, my = y0 + dy / 2 + dx * bend, u = 1 - t;
    return [u * u * x0 + 2 * u * t * mx + t * t * x1, u * u * y0 + 2 * u * t * my + t * t * y1];
  }

  function init(canvas) {
    if (canvas.getAttribute('data-pb-ready')) return;
    canvas.setAttribute('data-pb-ready', '1');
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var host = canvas.closest('.pb-story') || canvas.parentElement;
    var sky = canvas.closest('.pb-sky') || canvas.parentElement;
    var copy = host.querySelector('.pb-hero-content');
    var emblem = host.querySelector('.pb-emblem-canvas');
    var LINE = rgb(canvas.getAttribute('data-line'), '130,154,175');
    var ACCENT = rgb(canvas.getAttribute('data-accent'), '255,89,0');
    var WHITE = '255,255,255';

    var W = 0, H = 0, dpr = 1, rand = Math.random;
    var nodes = [], edges = [], edgeMap = {}, stars = [], clusters = [], rings = [], logoEdges = [];
    var quadFill = null, sig = null, form = 0, box = null, fit = null;
    var pointer = { x: 0, y: 0, on: false }, hovered = -1, dim = 1;
    var running = false, visible = true, raf = 0, last = 0, clock = 0;

    function addNode(x, y) {
      nodes.push({
        x0: x, y0: y, x: x, y: y,
        ax: 6 + rand() * 10, ay: 6 + rand() * 10,
        wx: 6.283 / (7000 + rand() * 7000), wy: 6.283 / (7000 + rand() * 7000),
        px: rand() * 6.283, py: rand() * 6.283,
        nb: [], fade: 1, glow: 0, hl: 0, k: 0
      });
      return nodes.length - 1;
    }
    function addEdge(a, b, bridge) {
      var k = key(a, b);
      if (a === b || edgeMap[k]) return;
      var e = { a: a, b: b, bridge: !!bridge, heat: 0, hl: 0 };
      edges.push(e); edgeMap[k] = e;
      nodes[a].nb.push(b); nodes[b].nb.push(a);
    }
    function nearest(from, list, skip) {
      var best = -1, bestD = Infinity;
      list.forEach(function (i) {
        if (i === skip || i === from) return;
        var d = Math.hypot(nodes[i].x0 - nodes[from].x0, nodes[i].y0 - nodes[from].y0);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }
    function closest(listA, listB) {
      var pair = [listA[0], listB[0]], bestD = Infinity;
      listA.forEach(function (a) {
        listB.forEach(function (b) {
          var d = Math.hypot(nodes[a].x0 - nodes[b].x0, nodes[a].y0 - nodes[b].y0);
          if (d < bestD) { bestD = d; pair = [a, b]; }
        });
      });
      return pair;
    }

    // Grupos de nós em volta de um ciclo de quatro, ligados aos grupos vizinhos
    // por pontes longas, e poeira solta. A semente fixa repete o desenho.
    function build() {
      rand = seeded(1559);
      nodes = []; edges = []; edgeMap = {}; stars = []; clusters = []; rings = [];
      quadFill = null; sig = null; hovered = -1;
      var area = W * H;
      var unit = clamp(Math.min(W, H) / 820, .55, 1.15);
      var target = clamp(Math.round(area / 62000), 6, 24);
      var minD = Math.sqrt(area / target) * .7;
      var centers = [];
      for (var tries = 0; tries < 800 && centers.length < target; tries++) {
        var cx = -20 + rand() * (W + 40), cy = -20 + rand() * (H + 40), ok = true;
        for (var i = 0; i < centers.length && ok; i++) ok = Math.hypot(cx - centers[i][0], cy - centers[i][1]) >= minD;
        if (ok) centers.push([cx, cy]);
      }
      centers.forEach(function (c) {
        var r = (46 + rand() * 40) * unit, rot = rand() * 6.283, quad = [], k;
        for (k = 0; k < 4; k++) {
          var a = rot + k * 1.5708 + (rand() - .5) * .7, d = r * (.7 + rand() * .6);
          quad.push(addNode(c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d));
        }
        for (k = 0; k < 4; k++) addEdge(quad[k], quad[(k + 1) % 4]);
        if (rand() < .45) addEdge(quad[0], quad[2]);
        var members = quad.slice(), extra = Math.floor(rand() * 5);
        for (k = 0; k < extra; k++) {
          var p = members[Math.floor(rand() * members.length)];
          var a2 = rand() * 6.283, d2 = r * (.7 + rand() * .9);
          var n = addNode(nodes[p].x0 + Math.cos(a2) * d2, nodes[p].y0 + Math.sin(a2) * d2);
          addEdge(p, n);
          if (rand() < .4) { var q = nearest(n, members, p); if (q > -1) addEdge(n, q); }
          members.push(n);
        }
        clusters.push({ x: c[0], y: c[1], quad: quad, members: members, links: [], fade: 1 });
      });
      clusters.forEach(function (c, i) {
        var others = [];
        clusters.forEach(function (o, j) { if (j !== i) others.push([j, Math.hypot(o.x - c.x, o.y - c.y)]); });
        others.sort(function (a, b) { return a[1] - b[1]; });
        var count = rand() < .5 ? 2 : 1;
        for (var k = 0; k < count && k < others.length && others[k][1] <= minD * 2.2; k++) {
          var j = others[k][0], pair = closest(c.members, clusters[j].members);
          addEdge(pair[0], pair[1], true);
          if (c.links.indexOf(j) < 0) c.links.push(j);
          if (clusters[j].links.indexOf(i) < 0) clusters[j].links.push(i);
        }
      });
      for (var s = Math.round(area / 24000); s > 0; s--) {
        var sx = rand() * W, sy = rand() * H;
        stars.push({ x0: sx, y0: sy, x: sx, y: sy, r: .5 + rand() * .7, a: .12 + rand() * .3, p: rand() * 6.283, fade: 1, k: 0 });
      }
      plan();
      shade();
    }

    // Cada ideia ganha um lugar no logo: os nós viram o contorno das quatro
    // peças e a poeira cai dentro delas. Nós e lugares são pareados pela
    // ordem do ângulo em volta do logo, para os caminhos não se cruzarem.
    function plan() {
      logoEdges = [];
      if (!emblem) return;
      var b = logoBox(), cx = b ? b.x + b.w / 2 : W * .3, cy = b ? b.y + b.h / 2 : H / 2;
      var r = seeded(77), per = PIECES.map(perimeter), total = per.reduce(function (s, v) { return s + v; }, 0);
      var counts = per.map(function (v) { return Math.floor(nodes.length * v / total); });
      for (var left = nodes.length - counts.reduce(function (s, v) { return s + v; }, 0), k = 0; left > 0; left--, k++) counts[k % 4]++;
      var spots = [], spotEdges = [];
      PIECES.forEach(function (poly, pi) {
        var pts = outline(poly, counts[pi]), first = spots.length;
        pts.forEach(function (p, i) {
          spots.push(p);
          if (pts.length > 2) spotEdges.push([first + i, first + (i + 1) % pts.length]);
        });
      });
      var byNode = nodes.map(function (n, i) { return [Math.atan2(n.y0 - cy, n.x0 - cx), i]; }).sort(function (a, b) { return a[0] - b[0]; });
      var bySpot = spots.map(function (p, i) { return [Math.atan2(p[1] - .5, p[0] - .5), i]; }).sort(function (a, b) { return a[0] - b[0]; });
      var owner = [];
      byNode.forEach(function (entry, i) {
        var n = nodes[entry[1]], spot = bySpot[i][1];
        n.u = spots[spot][0]; n.v = spots[spot][1];
        n.d = r() * .35; n.bend = .1 + r() * .22;
        owner[spot] = entry[1];
      });
      logoEdges = spotEdges.map(function (e) { return [owner[e[0]], owner[e[1]]]; });
      stars.forEach(function (st) {
        var poly = PIECES[Math.floor(r() * 4)], u = poly[0][0], v = poly[0][1];
        for (var tries = 0; tries < 60; tries++) {
          var tu = r(), tv = r();
          if (inside(poly, tu, tv)) { u = tu; v = tv; break; }
        }
        st.u = u; st.v = v; st.d = r() * .4; st.bend = .1 + r() * .22;
      });
    }

    // Onde o logo está agora, em coordenadas do canvas (que fica preso na
    // tela): as ideias seguem o logo enquanto ele sobe com a página.
    function logoBox() {
      if (!emblem) return null;
      var er = emblem.getBoundingClientRect(), kr = canvas.getBoundingClientRect();
      if (!er.width) return null;
      return { x: er.left - kr.left, y: er.top - kr.top, w: er.width, h: er.height };
    }

    // Atrás do texto do hero a rede fica quase apagada, para o texto respirar.
    // A área acompanha o texto enquanto ele sobe com o scroll.
    function shade() {
      var cx = W / 2, cy = H / 2, rx = W * .3, ry = H * .28;
      if (copy) {
        var hr = canvas.getBoundingClientRect(), br = copy.getBoundingClientRect();
        if (br.width && br.height) {
          cx = br.left - hr.left + br.width / 2; cy = br.top - hr.top + br.height / 2;
          rx = br.width * .5; ry = br.height * .62;
        }
      }
      nodes.forEach(function (n) { n.fade = .16 + .84 * smooth(.6, 1.35, Math.hypot((n.x0 - cx) / rx, (n.y0 - cy) / ry)); });
      stars.forEach(function (s) { s.fade = .3 + .7 * smooth(.5, 1.2, Math.hypot((s.x0 - cx) / rx, (s.y0 - cy) / ry)); });
      clusters.forEach(function (c) {
        c.fade = c.quad.reduce(function (sum, i) { return sum + nodes[i].fade; }, 0) / 4;
      });
    }

    function bfs(from, to, limit) {
      var prev = {}, depth = {}, queue = [from];
      prev[from] = -1; depth[from] = 0;
      while (queue.length) {
        var u = queue.shift();
        if (u === to) break;
        if (depth[u] >= limit) continue;
        nodes[u].nb.forEach(function (v) {
          if (!(v in prev)) { prev[v] = u; depth[v] = depth[u] + 1; queue.push(v); }
        });
      }
      if (!(to in prev)) return null;
      var path = [to];
      while (prev[path[0]] !== -1) path.unshift(prev[path[0]]);
      return path;
    }

    function pickCluster() {
      var cur = sig.cluster, pool = [];
      var fresh = function (j) { return j !== cur && sig.recent.indexOf(j) < 0 && clusters[j].fade > .55; };
      if (cur > -1) clusters[cur].links.forEach(function (j) { if (fresh(j)) pool.push(j); });
      if (!pool.length) clusters.forEach(function (c, j) { if (fresh(j)) pool.push(j); });
      if (!pool.length) clusters.forEach(function (c, j) { if (j !== cur) pool.push(j); });
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : -1;
    }
    function ignite(i) { nodes[i].glow = 1; rings.push({ n: i, t: 0 }); }

    // O sinal espera, viaja pelas pontes até o próximo grupo e dá uma volta
    // no ciclo de quatro. Cada volta fecha mais rápido que a anterior.
    function stepSignal(dt) {
      if (!clusters.length) return;
      if (!sig) sig = { phase: 'wait', wait: 900, hop: BASE_HOP, cycles: 0, cluster: -1, at: -1, recent: [], path: null, loop: null, seg: 0, t: 0 };
      if (sig.phase === 'wait') {
        sig.wait -= dt;
        if (sig.wait > 0) return;
        var next = pickCluster();
        if (next < 0) { sig.wait = 1000; return; }
        var quad = clusters[next].quad, start = 0, bestD = Infinity, k;
        if (sig.at > -1) {
          quad.forEach(function (q, qi) {
            var d = Math.hypot(nodes[q].x0 - nodes[sig.at].x0, nodes[q].y0 - nodes[sig.at].y0);
            if (d < bestD) { bestD = d; start = qi; }
          });
        }
        sig.loop = [];
        for (k = 0; k <= 4; k++) sig.loop.push(quad[(start + k) % 4]);
        sig.cluster = next;
        sig.recent.push(next);
        if (sig.recent.length > 3) sig.recent.shift();
        var path = sig.at > -1 ? bfs(sig.at, sig.loop[0], 6) : null;
        if (path && path.length > 1) { sig.phase = 'travel'; sig.path = path; }
        else { ignite(sig.loop[0]); sig.phase = 'loop'; sig.path = sig.loop; }
        sig.seg = 0; sig.t = 0;
        return;
      }
      sig.t += dt / (sig.phase === 'travel' ? sig.hop * .55 : sig.hop);
      while (sig.t >= 1 && sig.phase !== 'wait') {
        sig.t -= 1;
        var travelling = sig.phase === 'travel';
        var a = sig.path[sig.seg], b = sig.path[sig.seg + 1], e = edgeMap[key(a, b)];
        if (e) e.heat = travelling ? .55 : 1;
        nodes[b].glow = Math.max(nodes[b].glow, travelling ? .5 : 1);
        sig.seg++;
        if (sig.seg < sig.path.length - 1) continue;
        if (travelling) { ignite(b); sig.phase = 'loop'; sig.path = sig.loop; sig.seg = 0; continue; }
        clusters[sig.cluster].quad.forEach(function (q) { nodes[q].glow = 1; });
        quadFill = { quad: clusters[sig.cluster].quad, a: 1 };
        rings.push({ n: sig.loop[0], t: 0 });
        sig.at = sig.loop[0];
        sig.cycles++;
        if (sig.cycles >= CYCLES) { sig.cycles = 0; sig.hop = BASE_HOP; sig.wait = 2600; }
        else { sig.hop = Math.max(MIN_HOP, sig.hop * .84); sig.wait = 420; }
        sig.phase = 'wait'; sig.t = 0;
      }
    }

    // Posição de cada ponto: flutua no lugar dele e, com a formação, segue a
    // curva até o lugar no logo. Quem sai antes chega antes.
    function place(p, hx, hy) {
      p.k = box && p.u !== undefined ? ease(clamp((form - p.d) / (1 - .4), 0, 1)) : 0;
      if (p.k > 0) {
        var spot = viewAt(fit, p.u - .5, p.v - .5, 0);
        var at = travel(hx, hy, box.x + spot[0], box.y + spot[1], p.k, p.bend);
        p.x = at[0]; p.y = at[1];
      } else { p.x = hx; p.y = hy; }
    }

    function update(dt) {
      clock += dt;
      form = reduce ? 0 : clamp(+host.pbForm || 0, 0, 1);
      box = form > 0 ? logoBox() : null;
      fit = box ? view(0, box.w, box.h) : null;
      var k = 1 - Math.pow(.9, dt / 16.7), i, n, e, s;
      hovered = -1;
      if (pointer.on && form < .02) {
        var bestD = 28;
        for (i = 0; i < nodes.length; i++) {
          var d = Math.hypot(nodes[i].x - pointer.x, nodes[i].y - pointer.y);
          if (d < bestD) { bestD = d; hovered = i; }
        }
      }
      dim += ((hovered > -1 ? .5 : 1) - dim) * k;
      shade();
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        place(n, n.x0 + Math.sin(clock * n.wx + n.px) * n.ax, n.y0 + Math.cos(clock * n.wy + n.py) * n.ay);
        var on = hovered > -1 && (i === hovered || n.nb.indexOf(hovered) > -1);
        n.hl += ((on ? 1 : 0) - n.hl) * k;
        n.glow = Math.max(0, n.glow - dt / 1100);
      }
      for (i = 0; i < stars.length; i++) { s = stars[i]; place(s, s.x0, s.y0); }
      for (i = 0; i < edges.length; i++) {
        e = edges[i];
        e.hl += ((hovered > -1 && (e.a === hovered || e.b === hovered) ? 1 : 0) - e.hl) * k;
        e.heat = Math.max(0, e.heat - dt / 1700);
      }
      for (i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 1100) rings.splice(i, 1); }
      if (quadFill && (quadFill.a -= dt / 1400) <= 0) quadFill = null;
      // o sinal só corre no hero; na formação, as ideias viram o logo
      if (form < .02) stepSignal(dt);
    }

    function dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
    function line(a, bx, by) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bx, by); ctx.stroke(); }
    function octagon(x, y, r) {
      ctx.beginPath();
      for (var k = 0; k < 8; k++) {
        var a = .3927 + k * .7854;
        k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
    }
    function diamond(x, y, r) {
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
    }
    function rgba(c, a) { return 'rgba(' + c + ',' + a.toFixed(3) + ')'; }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var i, n, e, a, b;
      // as ligações do grafo se desfazem no caminho; as do logo se fecham na chegada
      var web = 1 - smooth(.35, .85, form), lift = smooth(0, .3, form);
      for (i = 0; i < stars.length; i++) {
        var s = stars[i], tw = reduce ? 1 : .75 + .25 * Math.sin(clock * .0009 + s.p);
        ctx.fillStyle = rgba(LINE, s.a * mix(s.fade, 1, lift) * mix(tw, 1, s.k) * (1 + s.k * .8) * dim);
        ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
      }
      ctx.lineWidth = 1;
      if (web > .01) {
        for (i = 0; i < edges.length; i++) {
          e = edges[i]; a = nodes[e.a]; b = nodes[e.b];
          var f = mix(Math.min(a.fade, b.fade), 1, lift) * web;
          ctx.strokeStyle = rgba(LINE, (e.bridge ? .09 : .17) * f * dim);
          line(a, b.x, b.y);
          if (e.hl > .01) { ctx.strokeStyle = rgba(WHITE, .5 * e.hl); line(a, b.x, b.y); }
          if (e.heat > .01) {
            ctx.lineWidth = 1.25;
            ctx.strokeStyle = rgba(ACCENT, .85 * e.heat * Math.max(.35, f));
            line(a, b.x, b.y);
            ctx.lineWidth = 1;
          }
        }
      }
      if (form > .5) {
        for (i = 0; i < logoEdges.length; i++) {
          a = nodes[logoEdges[i][0]]; b = nodes[logoEdges[i][1]];
          var q = smooth(.6, 1, Math.min(a.k, b.k));
          if (q > .01) { ctx.strokeStyle = rgba(LINE, .55 * q); line(a, b.x, b.y); }
        }
      }
      if (quadFill && web > .01) {
        ctx.fillStyle = rgba(ACCENT, .07 * quadFill.a * web);
        ctx.beginPath();
        quadFill.quad.forEach(function (q, k) { var p = nodes[q]; k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.closePath(); ctx.fill();
      }
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        var deg = Math.min(n.nb.length, 5), r = mix(1.2 + deg * .34, 1.7, n.k) + n.hl * 1.1 + (i === hovered ? .8 : 0);
        ctx.fillStyle = rgba(LINE, mix((.45 + deg * .07) * mix(n.fade, 1, lift), .9, n.k) * dim);
        dot(n.x, n.y, r);
        if (n.hl > .01) { ctx.fillStyle = rgba(WHITE, .9 * n.hl); dot(n.x, n.y, r); }
        if (n.glow > .01) {
          ctx.fillStyle = rgba(ACCENT, .16 * n.glow); dot(n.x, n.y, r + 6 * n.glow);
          ctx.fillStyle = rgba(ACCENT, n.glow); dot(n.x, n.y, r + .4);
        }
      }
      // O anel da ignição é o octógono do vazio central do emblema.
      for (i = 0; i < rings.length; i++) {
        var g = rings[i], p = nodes[g.n], t = g.t / 1100;
        ctx.strokeStyle = rgba(ACCENT, .7 * (1 - t) * web);
        octagon(p.x, p.y, 4 + (1 - Math.pow(1 - t, 3)) * 26);
        ctx.stroke();
      }
      if (form < .02 && sig && sig.phase !== 'wait' && sig.path) {
        var from = nodes[sig.path[sig.seg]], to = nodes[sig.path[sig.seg + 1]];
        if (from && to) {
          var tt = ease(Math.min(1, sig.t)), x = from.x + (to.x - from.x) * tt, y = from.y + (to.y - from.y) * tt;
          var grad = ctx.createLinearGradient(from.x, from.y, x, y);
          grad.addColorStop(0, rgba(ACCENT, 0)); grad.addColorStop(1, rgba(ACCENT, .9));
          ctx.strokeStyle = grad; ctx.lineWidth = 1.6; line(from, x, y); ctx.lineWidth = 1;
          ctx.fillStyle = rgba(ACCENT, .22); dot(x, y, 6);
          ctx.fillStyle = 'rgb(' + ACCENT + ')'; diamond(x, y, 2.8);
        }
      }
    }

    function frame(now) {
      if (!running) return;
      if (!canvas.isConnected) { stop(); return; }
      var dt = Math.min(50, now - (last || now));
      last = now;
      // depois que o logo assume, o céu some e não precisa ser desenhado
      if (sky.style.visibility !== 'hidden') { update(dt); draw(); }
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running || reduce || document.hidden || !visible || !W) return;
      running = true; last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    function motionChanged() {
      reduce = !!(motionQuery && motionQuery.matches);
      if (reduce) { stop(); still(); } else start();
    }
    if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });

    // Quadro parado: o grupo mais visível fica com o ciclo aceso.
    function still() {
      form = 0; shade();
      nodes.forEach(function (n) { n.x = n.x0; n.y = n.y0; n.k = 0; });
      stars.forEach(function (s) { s.x = s.x0; s.y = s.y0; s.k = 0; });
      var best = null;
      clusters.forEach(function (c) { if (!best || c.fade > best.fade) best = c; });
      if (best) {
        best.quad.forEach(function (q, k) { nodes[q].glow = .9; edgeMap[key(q, best.quad[(k + 1) % 4])].heat = .8; });
      }
      draw();
    }

    // A altura vem do CSS (100vh): lida do próprio canvas, não da janela, para
    // não crescer junto com um iframe de altura automática.
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      // a barra do celular muda a altura um pouco o tempo todo: só refaz em mudança real
      if (Math.abs(w - W) < 2 && Math.abs(h - H) < Math.max(120, H * .2)) return;
      W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      build();
      if (reduce) still(); else { draw(); start(); }
    }

    host.addEventListener('pointermove', function (ev) {
      var r = canvas.getBoundingClientRect();
      pointer.x = ev.clientX - r.left; pointer.y = ev.clientY - r.top; pointer.on = true;
    });
    host.addEventListener('pointerleave', function () { pointer.on = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(host);
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { plan(); if (reduce) still(); });
    resize();
  }

  function boot() { [].forEach.call(document.querySelectorAll('canvas.pb-graph'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
