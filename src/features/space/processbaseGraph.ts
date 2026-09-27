/**
 * Fundo animado do hero da ProcessBase: um grafo de conexões, como o do
 * Obsidian, em ardósia sobre o navy. Um único sinal laranja (a "faísca" da
 * marca) percorre ciclos de quatro nós, os quatro pilares, e acelera a cada
 * volta: "+ ciclos = + velocidade". Depois de cinco voltas, respira e recomeça.
 *
 * Roda dentro de um widget HTML do Elementor, sem dependências. Procura os
 * `canvas.pb-graph` da página; o hero é o `.pb-hero` mais próximo e o bloco
 * `.pb-hero-content` define a área que fica mais limpa atrás do texto.
 * `data-line` e `data-accent` no canvas trocam as cores.
 * Com movimento reduzido, desenha um quadro parado com um ciclo aceso.
 */
export const PROCESSBASE_GRAPH_SCRIPT = `
(function () {
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var BASE_HOP = 760, MIN_HOP = 360, CYCLES = 5;

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
  function key(a, b) { return a < b ? a + '-' + b : b + '-' + a; }

  function init(canvas) {
    if (canvas.getAttribute('data-pb-ready')) return;
    canvas.setAttribute('data-pb-ready', '1');
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var host = canvas.closest('.pb-hero') || canvas.parentElement;
    var LINE = rgb(canvas.getAttribute('data-line'), '130,154,175');
    var ACCENT = rgb(canvas.getAttribute('data-accent'), '255,89,0');
    var WHITE = '255,255,255';

    var W = 0, H = 0, dpr = 1, rand = Math.random;
    var nodes = [], edges = [], edgeMap = {}, stars = [], clusters = [], rings = [];
    var quadFill = null, sig = null;
    var pointer = { x: 0, y: 0, on: false }, hovered = -1, dim = 1;
    var running = false, visible = true, raf = 0, last = 0, clock = 0;

    function addNode(x, y) {
      nodes.push({
        x0: x, y0: y, x: x, y: y,
        ax: 3 + rand() * 6, ay: 3 + rand() * 6,
        wx: 6.283 / (9000 + rand() * 9000), wy: 6.283 / (9000 + rand() * 9000),
        px: rand() * 6.283, py: rand() * 6.283,
        nb: [], fade: 1, glow: 0, hl: 0
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
        stars.push({ x: rand() * W, y: rand() * H, r: .5 + rand() * .7, a: .12 + rand() * .3, p: rand() * 6.283, fade: 1 });
      }
      measureFade();
    }

    // Atrás do título a rede fica quase apagada, para o texto respirar.
    function measureFade() {
      var cx = W / 2, cy = H / 2, rx = W * .3, ry = H * .28;
      var box = host.querySelector('.pb-hero-content');
      if (box) {
        var hr = canvas.getBoundingClientRect(), br = box.getBoundingClientRect();
        if (br.width && br.height) {
          cx = br.left - hr.left + br.width / 2; cy = br.top - hr.top + br.height / 2;
          rx = br.width * .62; ry = br.height * .75;
        }
      }
      nodes.forEach(function (n) { n.fade = .16 + .84 * smooth(.6, 1.35, Math.hypot((n.x0 - cx) / rx, (n.y0 - cy) / ry)); });
      stars.forEach(function (s) { s.fade = .3 + .7 * smooth(.5, 1.2, Math.hypot((s.x - cx) / rx, (s.y - cy) / ry)); });
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
        var travel = sig.phase === 'travel';
        var a = sig.path[sig.seg], b = sig.path[sig.seg + 1], e = edgeMap[key(a, b)];
        if (e) e.heat = travel ? .55 : 1;
        nodes[b].glow = Math.max(nodes[b].glow, travel ? .5 : 1);
        sig.seg++;
        if (sig.seg < sig.path.length - 1) continue;
        if (travel) { ignite(b); sig.phase = 'loop'; sig.path = sig.loop; sig.seg = 0; continue; }
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

    function update(dt) {
      clock += dt;
      var k = 1 - Math.pow(.9, dt / 16.7), i, n, e;
      hovered = -1;
      if (pointer.on) {
        var bestD = 28;
        for (i = 0; i < nodes.length; i++) {
          var d = Math.hypot(nodes[i].x - pointer.x, nodes[i].y - pointer.y);
          if (d < bestD) { bestD = d; hovered = i; }
        }
      }
      dim += ((hovered > -1 ? .5 : 1) - dim) * k;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        n.x = n.x0 + Math.sin(clock * n.wx + n.px) * n.ax;
        n.y = n.y0 + Math.cos(clock * n.wy + n.py) * n.ay;
        var on = hovered > -1 && (i === hovered || n.nb.indexOf(hovered) > -1);
        n.hl += ((on ? 1 : 0) - n.hl) * k;
        n.glow = Math.max(0, n.glow - dt / 1100);
      }
      for (i = 0; i < edges.length; i++) {
        e = edges[i];
        e.hl += ((hovered > -1 && (e.a === hovered || e.b === hovered) ? 1 : 0) - e.hl) * k;
        e.heat = Math.max(0, e.heat - dt / 1700);
      }
      for (i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 1100) rings.splice(i, 1); }
      if (quadFill && (quadFill.a -= dt / 1400) <= 0) quadFill = null;
      stepSignal(dt);
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
      for (i = 0; i < stars.length; i++) {
        var s = stars[i], tw = reduce ? 1 : .75 + .25 * Math.sin(clock * .0009 + s.p);
        ctx.fillStyle = rgba(LINE, s.a * s.fade * tw * dim);
        ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
      }
      ctx.lineWidth = 1;
      for (i = 0; i < edges.length; i++) {
        e = edges[i]; a = nodes[e.a]; b = nodes[e.b];
        var f = Math.min(a.fade, b.fade);
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
      if (quadFill) {
        ctx.fillStyle = rgba(ACCENT, .07 * quadFill.a);
        ctx.beginPath();
        quadFill.quad.forEach(function (q, k) { var p = nodes[q]; k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.closePath(); ctx.fill();
      }
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        var deg = Math.min(n.nb.length, 5), r = 1.2 + deg * .34 + n.hl * 1.1 + (i === hovered ? .8 : 0);
        ctx.fillStyle = rgba(LINE, (.45 + deg * .07) * n.fade * dim);
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
        ctx.strokeStyle = rgba(ACCENT, .7 * (1 - t));
        octagon(p.x, p.y, 4 + (1 - Math.pow(1 - t, 3)) * 26);
        ctx.stroke();
      }
      if (sig && sig.phase !== 'wait' && sig.path) {
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
      update(dt); draw();
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running || reduce || !visible || !W) return;
      running = true; last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    // Quadro parado: o grupo mais visível fica com o ciclo aceso.
    function still() {
      var best = null;
      clusters.forEach(function (c) { if (!best || c.fade > best.fade) best = c; });
      if (best) {
        best.quad.forEach(function (q, k) { nodes[q].glow = .9; edgeMap[key(q, best.quad[(k + 1) % 4])].heat = .8; });
      }
      draw();
    }

    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h || (Math.abs(w - W) < 2 && Math.abs(h - H) < 2)) return;
      W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
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
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
    else window.addEventListener('resize', resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureFade(); if (reduce) still(); });
    resize();
  }

  function boot() { [].forEach.call(document.querySelectorAll('canvas.pb-graph'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
