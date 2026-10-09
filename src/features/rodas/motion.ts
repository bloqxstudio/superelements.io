/**
 * Movimento do experimento "Rodas", num widget HTML só de comportamento, o
 * primeiro filho do cabeçalho. Escrito para este projeto (o original não foi
 * copiado): o que segue o site de referência é o desenho e o jeito de mexer.
 *
 * Sempre (fora do editor do Elementor):
 * 1. Tema: escuro por padrão; a chave do cabeçalho troca e guarda no navegador.
 * 2. Faixa de leitura: hora de São Leopoldo e quadros por segundo, ao vivo.
 * 3. Menu: o texto rola no hover, os outros links apagam e uma pílula corre
 *    por baixo do link; ⌘K (ou Ctrl+K, ou a lupa no celular) abre a busca de
 *    cases e páginas; no celular o botão abre a gaveta com os links.
 *
 * Só numa página que rola, sem movimento reduzido e com WebGL (as miniaturas
 * do Space não rolam): `html.ro-wheels`.
 * 4. Entrada: papel por cima com a assinatura e um contador de 000 a 100 que
 *    acompanha o carregamento das capas e do three.js (uma vez por sessão;
 *    depois só um fade curto). O contador desce, o papel some e as rodas
 *    entram girando.
 * 5. Rodas: as capas dos cases numa roda grande à esquerda (o centro fora da
 *    tela) e um dado por case numa roda menor à direita, ligadas como
 *    engrenagens: o mesmo arco por passo, sentidos opostos. Roda do mouse,
 *    arrasto (com impulso), setas e clique numa capa vizinha giram; sempre
 *    para num case. Em movimento as capas curvam, separam as cores na direção
 *    do giro e ganham grão; as que não estão no meio ficam um pouco apagadas.
 *    No celular as rodas ficam em cima (capas) e embaixo (dados) e o arrasto é
 *    de lado.
 * 6. Tambor: o texto do meio (número, nome, chips e botão) troca rolando letra
 *    a letra, para cima ao avançar e para baixo ao voltar.
 *
 * Sem o script fica a composição do CSS: o primeiro case no meio, a capa
 * inclinada, as vizinhas cortadas nos cantos, os dados parados e a lista.
 */
export const RO_MOTION_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-ro')) return;
  root.setAttribute('data-ro', '1');
  try { if (localStorage.getItem('ro-theme') === 'light') root.setAttribute('data-ro-theme', 'light'); } catch (e) {}
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var fine = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
  function $$(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function $(s, c) { return (c || document).querySelector(s); }
  function editor() { return !!(document.body && document.body.classList.contains('elementor-editor-active')); }
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function txt(el) { return el ? el.textContent.replace(/\\s+/g, ' ').trim() : ''; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var EASE = 'cubic-bezier(.16,1,.3,1)';

  /* 4. entrada: o papel já na primeira pintura (sai sozinho se não houver rodas) */
  var veil = null, first = true;
  try { first = !sessionStorage.getItem('ro-veil'); } catch (e) {}
  if (!reduce && !editor() && document.body && window.WebGLRenderingContext) {
    veil = document.createElement('div');
    veil.className = 'ro-veil' + (first ? '' : ' is-fast');
    veil.setAttribute('aria-hidden', 'true');
    var strip = '';
    for (var k = 0; k <= 10; k++) strip += '<span>' + (k % 10) + '</span>';
    veil.innerHTML = '<div class="ro-veil-word">avence<i></i></div><div class="ro-veil-count"><span class="ro-veil-d"><span class="ro-veil-s">' + strip + '</span></span><span class="ro-veil-d"><span class="ro-veil-s">' + strip + '</span></span><span class="ro-veil-d"><span class="ro-veil-s">' + strip + '</span></span></div>';
    document.body.appendChild(veil);
  }
  var shown = 0;
  function count(p) {
    if (!veil) return;
    var n = Math.min(100, Math.floor(p));
    if (n === shown && p < 100) return;
    shown = n;
    var digits = [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
    $$('.ro-veil-s', veil).forEach(function (s, i) {
      var d = n === 100 && i > 0 ? 10 : digits[i];
      s.style.transform = 'translateY(' + (-d * 100 / 11) + '%)';
      s.parentNode.classList.toggle('is-off', (i === 0 && n < 100) || (i === 1 && n < 10));
    });
  }
  function dropVeil(after) {
    if (!veil) { if (after) after(); return; }
    var v = veil; veil = null;
    try { sessionStorage.setItem('ro-veil', '1'); } catch (e) {}
    v.classList.add('is-leaving');
    setTimeout(function () { if (after) after(); }, first ? 260 : 0);
    setTimeout(function () { v.remove(); }, 1100);
  }

  /* 1. tema */
  function setTheme(t) {
    if (t === 'light') root.setAttribute('data-ro-theme', 'light'); else root.removeAttribute('data-ro-theme');
    try { localStorage.setItem('ro-theme', t); } catch (e) {}
    window.dispatchEvent(new Event('ro:theme'));
  }

  /* texto que rola: a palavra em letras, cada uma com a cópia embaixo (sombra) */
  function roll(el) {
    if (!el || el.getAttribute('data-roll')) return;
    var t = txt(el);
    if (!t) return;
    el.setAttribute('data-roll', '1');
    if (el.tagName === 'A' && !el.getAttribute('aria-label')) el.setAttribute('aria-label', t);
    var i = 0;
    el.innerHTML = '<span class="ro-roll" aria-hidden="true">' + t.split('').map(function (c) { return '<span style="--i:' + (i++) + '">' + esc(c) + '</span>'; }).join('') + '</span>';
  }

  ready(function () {
    if (editor()) { if (veil) { veil.remove(); veil = null; } return; }
    var header = $('.ro-header');

    /* 1. tema */
    $$('.ro-seg-light').forEach(function (b) { b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0'); b.setAttribute('aria-label', 'Tema claro'); b.addEventListener('click', function () { setTheme('light'); }); });
    $$('.ro-seg-dark').forEach(function (b) { b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0'); b.setAttribute('aria-label', 'Tema escuro'); b.addEventListener('click', function () { setTheme('dark'); }); });
    $$('.ro-seg').forEach(function (b) { b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } }); });

    /* 2. faixa de leitura */
    var clock = $('.ro-hud-time .elementor-heading-title'), fpsEl = $('.ro-hud-fps .elementor-heading-title');
    var fmt = null;
    try { fmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch (e) {}
    function tick() { if (clock && fmt) clock.textContent = fmt.format(new Date()); }
    tick(); setInterval(tick, 5000);
    var frames = 0, since = performance.now();
    function frame(now) {
      frames++;
      if (now - since > 500) { if (fpsEl) fpsEl.textContent = String(Math.round(frames * 1000 / (now - since))); frames = 0; since = now; }
    }
    window.__roFrame = frame;
    var ownLoop = true;
    (function loop(now) { if (ownLoop && !document.hidden) frame(now); if (ownLoop) requestAnimationFrame(loop); })(performance.now());

    /* 3. menu, pílula e texto que rola */
    $$('.ro-nav-link a, .ro-btn-label a').forEach(roll);
    $$('.ro-cmdk-label .elementor-heading-title').forEach(roll);
    $$('.ro-navpill').forEach(function (nav) {
      var pill = document.createElement('span');
      pill.className = 'ro-pill'; pill.setAttribute('aria-hidden', 'true');
      nav.appendChild(pill);
      $$('.ro-nav-link a', nav).forEach(function (a) {
        a.addEventListener('mouseenter', function () {
          var r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
          var on = pill.style.opacity === '1';
          pill.style.transition = on ? '' : 'opacity .25s ease-out';
          pill.style.width = r.width + 'px'; pill.style.height = r.height + 'px';
          pill.style.transform = 'translate(' + (r.left - n.left - 1) + 'px,' + (r.top - n.top - 1) + 'px)';
          pill.style.opacity = '1';
          if (!on) requestAnimationFrame(function () { pill.style.transition = ''; });
        });
      });
      nav.addEventListener('mouseleave', function () { pill.style.opacity = '0'; });
    });
    $$('a[href^="http"]', header).forEach(function (a) { if (a.host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; } });

    /* gaveta do celular */
    var menu = $('.ro-menu');
    function drawer(open) { root.classList.toggle('ro-drawer-open', open); if (menu) menu.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    if (menu) {
      menu.setAttribute('role', 'button'); menu.setAttribute('tabindex', '0'); menu.setAttribute('aria-label', 'Menu'); menu.setAttribute('aria-expanded', 'false');
      menu.addEventListener('click', function () { drawer(!root.classList.contains('ro-drawer-open')); });
      menu.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); menu.click(); } });
    }
    $$('.ro-drawer a').forEach(function (a) { a.addEventListener('click', function () { drawer(false); }); });

    /* busca ⌘K: cases do palco e links do menu */
    var stage = $('.ro-stage');
    var cases = stage ? $$('.ro-case', stage).map(function (el, i) {
      var a = $('.ro-btn-label a', el);
      return { el: el, i: i, name: txt($('.ro-title', el)), meta: $$('.ro-chip', el).map(txt).join(' · '), url: a ? a.href : '', img: $('.ro-card img', el), letter: txt($('.ro-die-letter', el)), info: $('.ro-info', el) };
    }) : [];
    var cmd = null, items = [], hl = 0, wheel = null;
    function buildCmd() {
      cmd = document.createElement('div');
      cmd.className = 'ro-cmd';
      cmd.innerHTML = '<div class="ro-cmd-scrim"></div><div class="ro-cmd-panel" role="dialog" aria-modal="true" aria-label="Buscar"><div class="ro-cmd-search"><i class="ro-cmd-ic"></i><input class="ro-cmd-input" type="text" placeholder="Buscar cases e páginas" aria-label="Buscar" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div><div class="ro-cmd-list" role="listbox"></div></div>';
      document.body.appendChild(cmd);
      var list = $('.ro-cmd-list', cmd), input = $('.ro-cmd-input', cmd);
      var all = cases.map(function (c) { return { group: 'Cases', label: c.name, hint: c.meta, run: function () { if (wheel) wheel.go(c.i); else if (c.url) window.open(c.url, '_blank', 'noopener'); } }; })
        .concat($$('.ro-nav-link a', header).map(function (a) { var t = a.getAttribute('aria-label') || txt(a); return { group: 'Páginas', label: t, hint: a.host === location.host ? '' : a.host.replace(/^www\\./, ''), run: function () { if (a.target === '_blank') window.open(a.href, '_blank', 'noopener'); else location.href = a.href; } }; }));
      function render() {
        var q = input.value.trim().toLowerCase();
        items = all.filter(function (it) { return !q || (it.label + ' ' + it.hint).toLowerCase().indexOf(q) >= 0; });
        hl = Math.min(hl, Math.max(0, items.length - 1));
        var html = '', group = '';
        items.forEach(function (it, i) {
          if (it.group !== group) { group = it.group; html += '<p class="ro-cmd-h">' + group + '</p>'; }
          html += '<button type="button" role="option" class="ro-cmd-item' + (i === hl ? ' is-on' : '') + '" data-i="' + i + '"><span class="ro-cmd-arrow"></span><span class="ro-cmd-label">' + esc(it.label) + '</span><span class="ro-cmd-hint">' + esc(it.hint) + '</span></button>';
        });
        list.innerHTML = html || '<p class="ro-cmd-empty">Nada com esse nome.</p>';
      }
      function pick(i) { var it = items[i]; closeCmd(); if (it) it.run(); }
      input.addEventListener('input', function () { hl = 0; render(); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); render(); var on = $('.is-on', list); if (on) on.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(hl); }
      });
      list.addEventListener('mousemove', function (e) { var b = e.target.closest('.ro-cmd-item'); if (b && +b.dataset.i !== hl) { hl = +b.dataset.i; $$('.ro-cmd-item', list).forEach(function (x) { x.classList.toggle('is-on', +x.dataset.i === hl); }); } });
      list.addEventListener('click', function (e) { var b = e.target.closest('.ro-cmd-item'); if (b) pick(+b.dataset.i); });
      $('.ro-cmd-scrim', cmd).addEventListener('click', closeCmd);
      cmd.render = render; cmd.input = input;
    }
    var lastFocus = null;
    function openCmd() { if (!cmd) buildCmd(); lastFocus = document.activeElement; drawer(false); cmd.input.value = ''; hl = 0; cmd.render(); root.classList.add('ro-cmd-open'); setTimeout(function () { cmd.input.focus(); }, 30); }
    function closeCmd() { if (!root.classList.contains('ro-cmd-open')) return; root.classList.remove('ro-cmd-open'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
    $$('.ro-cmdk, .ro-search').forEach(function (b) {
      b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0'); b.setAttribute('aria-label', 'Buscar (⌘K)');
      b.addEventListener('click', openCmd);
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCmd(); } });
    });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (root.classList.contains('ro-cmd-open')) closeCmd(); else openCmd(); }
      else if (e.key === 'Escape') { closeCmd(); drawer(false); }
    });

    /* daqui em diante, só com as rodas */
    var scrolls = root.scrollHeight - window.innerHeight > 80;
    if (!stage || !cases.length || reduce || !scrolls) { if (veil) { veil.remove(); veil = null; } return; }
    var gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) { if (veil) { veil.remove(); veil = null; } return; }

    /* 6. tambor: palavras inteiras, letras soltas dentro */
    function letters(h) {
      if (!h || h.getAttribute('data-drum')) return;
      var t = txt(h);
      h.setAttribute('data-drum', '1'); h.setAttribute('aria-label', t);
      h.innerHTML = t.split(' ').map(function (w) { return '<span class="ro-w" aria-hidden="true">' + w.split('').map(function (c) { return '<span class="ro-ch">' + esc(c) + '</span>'; }).join('') + '</span>'; }).join(' ');
    }
    cases.forEach(function (c) { $$('.ro-eyebrow .elementor-heading-title, .ro-title .elementor-heading-title', c.el).forEach(letters); });
    function parts(info) {
      return $$('.ro-line', info).map(function (line) {
        var chars = $$('.ro-ch', line);
        return chars.length ? chars : $$(':scope > .elementor-element', line).concat($$(':scope > .e-con-inner > .elementor-element', line));
      });
    }
    var running = [], activeInfo = -1;
    function showInfo(i, dir, instant) {
      if (i === activeInfo) return;
      running.forEach(function (a) { try { a.finish(); } catch (e) {} });
      running = [];
      var prev = activeInfo >= 0 ? cases[activeInfo] : null, next = cases[i];
      activeInfo = i;
      cases.forEach(function (c) { if (c !== prev && c !== next) c.el.classList.remove('is-active', 'is-leaving'); });
      next.el.classList.add('is-active'); next.el.classList.remove('is-leaving');
      if (!prev || instant) { if (prev) prev.el.classList.remove('is-active', 'is-leaving'); return; }
      prev.el.classList.remove('is-active'); prev.el.classList.add('is-leaving');
      var d = dir >= 0 ? 1 : -1, outs = parts(prev.info), ins = parts(next.info), last = null;
      ins.forEach(function (group, line) {
        group.forEach(function (el, j) {
          var o = { duration: 720, delay: line * 45 + j * 14, easing: EASE, fill: 'both' };
          running.push(el.animate([{ transform: 'translateY(' + (d * 118) + '%)' }, { transform: 'none' }], o));
        });
      });
      outs.forEach(function (group, line) {
        group.forEach(function (el, j) {
          last = el.animate([{ transform: 'none' }, { transform: 'translateY(' + (-d * 118) + '%)' }], { duration: 560, delay: line * 45 + j * 10, easing: EASE, fill: 'both' });
          running.push(last);
        });
      });
      var mine = running;
      Promise.all(mine.map(function (a) { return a.finished.catch(function () {}); })).then(function () {
        if (mine !== running) return;
        prev.el.classList.remove('is-leaving');
        mine.forEach(function (a) { a.cancel(); });
        running = [];
      });
    }

    stage.setAttribute('tabindex', '0');
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-roledescription', 'carrossel');
    stage.setAttribute('aria-label', 'Cases em duas rodas ligadas. Arraste ou role para girar; as setas trocam de case.');
    var live = document.createElement('p');
    live.className = 'ro-live'; live.setAttribute('aria-live', 'polite');
    stage.appendChild(live);

    /* carregamento: capas + three.js */
    var progress = 0, want = 0, loaded = 0, total = cases.length + 1, t0 = performance.now();
    function bump() { loaded++; want = loaded / total; }
    (function counter() {
      if (!veil) return;
      var minT = first ? 1500 : 0, el = performance.now() - t0;
      var target = Math.min(want, el / Math.max(1, minT)) * 100;
      progress += (target - progress) * 0.12;
      if (target >= 99.5 && progress > 99) progress = 100;
      count(progress);
      if (progress < 100) requestAnimationFrame(counter);
    })();
    setTimeout(function () { want = 1; }, 5000);
    window.__roState = function () { return { progress: progress, want: want, loaded: loaded, total: total }; };

    var V = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';
    import(V).then(function (THREE) { bump(); start(THREE); }).catch(function () { if (veil) { veil.remove(); veil = null; } });

    function start(THREE) {
      var renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
      catch (e) { if (veil) { veil.remove(); veil = null; } return; }
      var canvas = renderer.domElement;
      canvas.className = 'ro-gl';
      canvas.setAttribute('aria-hidden', 'true');
      stage.insertBefore(canvas, stage.firstChild);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);

      /* estúdio para os reflexos dos dados: sala escura com quatro painéis de luz */
      var envScene = new THREE.Scene();
      var room = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.BackSide }));
      envScene.add(room);
      [[0, 4.6, 0, 6, 1.2, 0, -Math.PI / 2, 3.2], [-4.6, 1, 1, 1.2, 4, Math.PI / 2, 0, 2.4], [4.6, -0.5, -1, 1.6, 3, -Math.PI / 2, 0, 1.6], [0, -1, 4.6, 5, 0.6, 0, 0, 1.2]].forEach(function (p) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(p[3], p[4]), new THREE.MeshBasicMaterial({ color: new THREE.Color(p[7], p[7], p[7]), side: THREE.DoubleSide }));
        m.position.set(p[0], p[1], p[2]); m.rotation.set(p[6], p[5], 0);
        envScene.add(m);
      });
      var pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      var key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(-300, 600, 900);
      scene.add(key);
      scene.add(new THREE.AmbientLight(0xffffff, 0.25));

      var paperCol = new THREE.Color();
      function readTheme() {
        var light = root.getAttribute('data-ro-theme') === 'light';
        paperCol.set(light ? 0xd6d6d5 : 0x1e1e1e);
        return light;
      }
      var lightTheme = readTheme();

      /* 5a. capas: plano dividido, curva de fita no vértice, cor separada no fragmento */
      var CARD_V = [
        'uniform vec2 uSize; uniform float uArc; uniform float uBend; uniform float uTime; uniform float uSeed; uniform float uFocus;',
        'varying vec2 vUv; varying float vBow;',
        'void main(){',
        '  vUv = uv;',
        '  vec3 p = vec3(position.xy * uSize, 0.0);',
        '  float bow = sin(uv.x * 3.14159265);',
        '  p.z += uArc * uSize.x * bow;',
        '  float s = (uv.x - 0.5) * 2.0;',
        '  p.y -= uBend * uSize.y * s * s;',
        '  p.z += uBend * uSize.y * 0.35 * s;',
        '  p.z += sin(uv.y * 2.4 + uTime * 0.9 + uSeed) * 1.6 * uFocus;',
        '  vBow = bow;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
        '}'
      ].join('\\n');
      var CARD_F = [
        'uniform sampler2D uTex; uniform vec2 uTexSize; uniform vec2 uSize; uniform float uRadius; uniform float uChroma; uniform vec2 uDir;',
        'uniform float uDim; uniform vec3 uPaper; uniform float uReveal; uniform float uTime; uniform float uGrain; uniform float uLoaded;',
        'varying vec2 vUv; varying float vBow;',
        'float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
        'float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
        'vec2 fit(vec2 uv){ float a = uSize.x / uSize.y, t = uTexSize.x / uTexSize.y; vec2 s = a > t ? vec2(1.0, t / a) : vec2(a / t, 1.0); return vec2((uv.x - 0.5) * s.x + 0.5, 1.0 - (1.0 - uv.y) * s.y); }',
        'void main(){',
        '  vec2 p = (vUv - 0.5) * uSize;',
        '  float d = box(p, uSize * 0.5, uRadius);',
        '  float aa = max(fwidth(d), 0.5);',
        '  float mask = 1.0 - smoothstep(-aa, aa, d);',
        '  mask *= smoothstep(vUv.y - 0.2, vUv.y + 0.02, uReveal * 1.25 - 0.05);',
        '  if (mask < 0.002) discard;',
        '  vec2 uv = fit(vUv);',
        '  vec2 o = uDir * uChroma;',
        '  vec3 c = vec3(texture2D(uTex, uv + o).r, texture2D(uTex, uv).g, texture2D(uTex, uv - o * 1.4).b);',
        '  c = mix(vec3(0.16), c, uLoaded);',
        '  float n = rnd(floor(vUv * uSize * 0.75) + floor(uTime * 12.0) * vec2(7.13, 3.71)) - 0.5;',
        '  c += n * (uGrain + uChroma * 9.0);',
        '  c *= 0.92 + 0.08 * vBow;',
        '  float rim = 1.0 - smoothstep(0.0, 1.25, -d);',
        '  c = mix(c, vec3(1.0), rim * 0.14);',
        '  c = mix(c, uPaper, uDim);',
        '  gl_FragColor = vec4(c, mask);',
        '}'
      ].join('\\n');
      var cardGeo = new THREE.PlaneGeometry(1, 1, 48, 20);
      var loader = new THREE.TextureLoader();
      var cardMats = cases.map(function (c, i) {
        var mat = new THREE.ShaderMaterial({
          vertexShader: CARD_V, fragmentShader: CARD_F, transparent: true, depthWrite: false,
          uniforms: {
            uTex: { value: null }, uTexSize: { value: new THREE.Vector2(16, 10) }, uSize: { value: new THREE.Vector2(400, 250) },
            uRadius: { value: 8 }, uArc: { value: 0.022 }, uBend: { value: 0 }, uTime: { value: 0 }, uSeed: { value: i * 1.7 },
            uFocus: { value: 0 }, uChroma: { value: 0 }, uDir: { value: new THREE.Vector2(0, 1) }, uDim: { value: 0 },
            uPaper: { value: paperCol }, uReveal: { value: 0 }, uGrain: { value: 0.035 }, uLoaded: { value: 0 }
          }
        });
        var src = c.img ? (c.img.currentSrc || c.img.src) : '';
        if (src) loader.load(src, function (tex) {
          tex.colorSpace = THREE.NoColorSpace;
          tex.anisotropy = 4;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          mat.uniforms.uTex.value = tex;
          mat.uniforms.uTexSize.value.set(tex.image.width, tex.image.height);
          mat.uniforms.uLoaded.value = 1;
          bump();
        }, undefined, bump); else bump();
        return mat;
      });

      /* 5b. dados: caixa com bisel (extrusão de um quadrado arredondado) e a letra em cromo na face */
      function rounded(s, r) {
        var h = s / 2, sh = new THREE.Shape();
        sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r);
        sh.quadraticCurveTo(h, h, h - r, h); sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r);
        sh.quadraticCurveTo(-h, -h, -h + r, -h);
        return sh;
      }
      var dieGeo = new THREE.ExtrudeGeometry(rounded(0.9, 0.1), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 5, curveSegments: 10 });
      dieGeo.translate(0, 0, -0.06);
      var dieMat = new THREE.MeshPhysicalMaterial({ color: 0x151515, roughness: 0.42, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 0.9 });
      var FACE_V = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
      var FACE_F = [
        'uniform sampler2D uGlyph; uniform sampler2D uHeight; uniform float uTime; uniform float uSpin; uniform float uLight;',
        'varying vec2 vUv; varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  float a = texture2D(uGlyph, vUv).a;',
        '  if (a < 0.01) discard;',
        '  float e = 2.0 / 512.0;',
        '  float hx = texture2D(uHeight, vUv + vec2(e, 0.0)).r - texture2D(uHeight, vUv - vec2(e, 0.0)).r;',
        '  float hy = texture2D(uHeight, vUv + vec2(0.0, e)).r - texture2D(uHeight, vUv - vec2(0.0, e)).r;',
        '  vec3 n = normalize(vec3(-hx * 5.0, -hy * 5.0, 1.0));',
        '  float tilt = dot(vN.xy, vec2(0.7, 0.5)) + dot(vV.xy, vec2(-0.4, 0.6));',
        '  float band = n.x * 0.55 + n.y * 0.8 + vUv.y * 0.9 + tilt * 1.4 + uSpin * 0.45 + sin(uTime * 0.4) * 0.12;',
        '  float steel = 0.5 + 0.5 * sin(band * 7.0);',
        '  vec3 metal = mix(vec3(0.16), vec3(0.97), smoothstep(0.15, 0.95, steel));',
        '  vec3 film = 0.55 + 0.45 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + band * 0.55));',
        '  vec3 c = mix(metal, metal * film * 1.25, 0.42);',
        '  c += pow(1.0 - n.z, 1.5) * 0.9;',
        '  c = mix(c, c * vec3(0.85), uLight * 0.3);',
        '  gl_FragColor = vec4(c, a);',
        '}'
      ].join('\\n');
      function glyph(letter) {
        var S = 512, a = document.createElement('canvas'), b = document.createElement('canvas');
        a.width = a.height = b.width = b.height = S;
        var ca = a.getContext('2d'), cb = b.getContext('2d');
        var font = '600 330px Geist, "Geist Variable", system-ui, sans-serif';
        ca.font = font; ca.textAlign = 'center'; ca.textBaseline = 'middle'; ca.fillStyle = '#fff';
        var m = ca.measureText(letter), dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
        ca.fillText(letter, S / 2, S / 2 + dy);
        cb.fillStyle = '#000'; cb.fillRect(0, 0, S, S);
        cb.filter = 'blur(9px)'; cb.drawImage(a, 0, 0);
        var ta = new THREE.CanvasTexture(a), tb = new THREE.CanvasTexture(b);
        ta.colorSpace = tb.colorSpace = THREE.NoColorSpace;
        return [ta, tb];
      }
      var faceGeo = new THREE.PlaneGeometry(0.78, 0.78);
      var dies = [], cards = [];
      var fontsReady = (document.fonts && document.fonts.load) ? document.fonts.load('600 64px Geist').catch(function () {}) : Promise.resolve();
      fontsReady.then(function () {
        cases.forEach(function (c, i) {
          var g = glyph(c.letter || String(i + 1));
          dies.forEach(function (d) { if (d.i === i) { d.face.material.uniforms.uGlyph.value = g[0]; d.face.material.uniforms.uHeight.value = g[1]; } });
          glyphs[i] = g;
        });
      });
      var glyphs = [];

      /* camada de objetos: uma capa e um dado por posição visível (os casos se repetem em volta) */
      var SPAN = 3;
      for (var s = -SPAN; s <= SPAN; s++) {
        var card = new THREE.Mesh(cardGeo, null);
        card.frustumCulled = false;
        scene.add(card); cards.push(card);
        var body = new THREE.Mesh(dieGeo, dieMat);
        var face = new THREE.Mesh(faceGeo, new THREE.ShaderMaterial({
          vertexShader: FACE_V, fragmentShader: FACE_F, transparent: true, depthWrite: false,
          uniforms: { uGlyph: { value: null }, uHeight: { value: null }, uTime: { value: 0 }, uSpin: { value: 0 }, uLight: { value: 0 } }
        }));
        face.position.z = 0.111;
        var die = new THREE.Group();
        die.add(body); die.add(face);
        die.rotation.order = 'ZXY';
        scene.add(die);
        dies.push({ g: die, face: face, i: -1 });
      }
      function themeColors() {
        lightTheme = readTheme();
        dieMat.color.set(lightTheme ? 0xefeeec : 0x151515);
        dieMat.roughness = lightTheme ? 0.5 : 0.42;
        dies.forEach(function (d) { d.face.material.uniforms.uLight.value = lightTheme ? 1 : 0; });
      }
      themeColors();
      window.addEventListener('ro:theme', themeColors);

      /* medidas da tela */
      var W = 1, H = 1, L = {};
      function size() {
        var r = stage.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.position.set(0, 0, (H / 2) / Math.tan(15 * Math.PI / 180));
        camera.near = 10; camera.far = camera.position.z * 4;
        camera.updateProjectionMatrix();
        var stack = W < 768 || W / H < 0.9;
        if (!stack) {
          var S = Math.min(H, W * 0.52);
          var cw = clamp(W * 0.303, 260, 640), R1 = S * 0.45, x1 = -W * 0.5 + W * 0.204, yc = -H * 0.03;
          var d = clamp(W * 0.096, 96, 184), R2 = S * 0.39, x2 = -W * 0.5 + W * 0.725;
          var p1 = 1.3;
          L = { stack: false, cw: cw, ch: cw / 1.75, R1: R1, c1: [x1 - R1, yc], a1: 0, s1: -1, p1: p1, d: d, R2: R2, c2: [x2 + R2, yc], a2: Math.PI, s2: 1, p2: p1 * R1 / R2, card0: 0, die0: Math.PI };
        } else {
          var cwm = Math.min(W * 0.88, 460), chm = cwm / 1.75, headh = W < 768 ? 72 : 96;
          var y1 = H / 2 - headh - 28 - chm / 2, R1m = Math.max(W * 1.25, 520);
          var dm = clamp(W * 0.22, 72, 104), y2 = -H / 2 + dm * 0.62, R2m = Math.max(W * 0.62, 260);
          var p1m = (cwm * 1.12) / R1m;
          L = { stack: true, cw: cwm, ch: chm, R1: R1m, c1: [0, y1 - R1m], a1: Math.PI / 2, s1: -1, p1: p1m, d: dm, R2: R2m, c2: [0, y2 - R2m], a2: Math.PI / 2, s2: 1, p2: p1m * R1m / R2m, card0: -Math.PI / 2, die0: -Math.PI / 2 };
        }
        L.step = L.R1 * L.p1;
      }
      size();
      var ro = new ResizeObserver(function () { size(); });
      ro.observe(stage);

      /* estado das rodas */
      var N = cases.length, pos = 0, target = 0, vel = 0, sv = 0, drag = null, reveal = 0, spin = 0, lastT = performance.now(), time = 0;
      function wrap(i) { return ((i % N) + N) % N; }
      var current = 0;
      showInfo(0, 1, true);
      var anchor = null;
      function settle() {
        if (drag) return;
        if (anchor === null) { target = Math.round(target); return; }
        var d = target - anchor;
        target = Math.abs(d) < 0.12 ? anchor : anchor + (d > 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(d)));
        anchor = null;
      }
      function go(i) {
        var now = wrap(Math.round(target)), diff = i - now;
        if (diff > N / 2) diff -= N; if (diff < -N / 2) diff += N;
        target = Math.round(target) + diff;
      }
      wheel = { go: go };

      /* roda do mouse: soma e assenta num case 160 ms depois */
      var wt = 0;
      stage.addEventListener('wheel', function (e) {
        e.preventDefault();
        var unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? H : 1;
        var dlt = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
        if (anchor === null) anchor = Math.round(target);
        target += clamp(dlt, -240, 240) * 0.0042;
        target = clamp(target, anchor - 4, anchor + 4);
        clearTimeout(wt); wt = setTimeout(settle, 160);
      }, { passive: false });

      /* arrasto com impulso; toque curto numa capa vizinha vai até ela */
      var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      function hit(x, y) {
        var r = canvas.getBoundingClientRect();
        ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        var hits = ray.intersectObjects(cards.concat(dies.map(function (d) { return d.g; })), true);
        if (!hits.length) return null;
        var o = hits[0].object;
        while (o && o.userData.slot === undefined) o = o.parent;
        return o ? o.userData.slot : null;
      }
      canvas.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        canvas.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, p: pos, t: performance.now(), hist: [[performance.now(), 0]], moved: false };
        canvas.classList.add('is-grabbing');
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        var along = L.stack ? -dx : -dy;
        if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
        target = pos = drag.p + along / L.step;
        var now = performance.now();
        drag.hist.push([now, along]);
        while (drag.hist.length > 2 && now - drag.hist[0][0] > 90) drag.hist.shift();
      });
      function release(e) {
        if (!drag) return;
        var d = drag; drag = null;
        canvas.classList.remove('is-grabbing');
        if (!d.moved && performance.now() - d.t < 400) {
          var slot = hit(e.clientX, e.clientY);
          if (slot !== null && slot !== undefined) {
            var idx = Math.round(pos) + slot;
            if (slot === 0) { var c = cases[wrap(idx)]; if (c.url) window.open(c.url, '_blank', 'noopener'); }
            else target = idx;
          } else target = Math.round(pos);
          return;
        }
        var h = d.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b[0] - a[0]);
        var v = (b[1] - a[1]) / dt;
        var fling = Math.abs(v) > 0.35 ? clamp(v * 140 / L.step, -3, 3) : 0;
        target = Math.round(pos + fling);
      }
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); target = Math.round(target) + 1; }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); target = Math.round(target) - 1; }
        else if (e.key === 'Enter' && e.target === stage) { var c = cases[current]; if (c.url) window.open(c.url, '_blank', 'noopener'); }
      });

      /* posição de cada peça */
      var tmp = new THREE.Vector3();
      function place(time, dt) {
        var base = Math.floor(pos);
        var speed = clamp(sv, -14, 14);
        for (var s = -SPAN; s <= SPAN; s++) {
          var k = s + SPAN, idx = base + s, ci = wrap(idx), off = idx - pos;
          var focus = Math.max(0, 1 - Math.abs(off));
          var near = clamp(1.75 - Math.abs(off), 0, 1);
          var card = cards[k];
          card.visible = near > 0;
          dies[k].g.visible = near > 0;
          card.userData.slot = idx - Math.round(pos);
          card.material = cardMats[ci];
          var mat = cardMats[ci];
          var a1 = L.a1 + L.s1 * off * L.p1;
          var x = L.c1[0] + Math.cos(a1) * L.R1, y = L.c1[1] + Math.sin(a1) * L.R1;
          card.position.set(x, y, -Math.abs(off) * 40);
          card.rotation.set(0, 0, 0);
          card.rotateZ(L.a1 + L.card0 - (a1 - L.a1) * 0.4);
          card.renderOrder = Math.round(100 - Math.abs(off) * 10);
          if (!L.stack) { card.rotateY(0.24 * (1 - Math.min(1, Math.abs(off)) * 0.5)); card.rotateX(-0.05); }
          else card.rotateX(0.12);
          card.scale.set(1, 1, 1);
          var u = mat.uniforms;
          u.uSize.value.set(L.cw, L.ch);
          u.uRadius.value = Math.max(6, L.cw * 0.016);
          u.uFocus.value = focus;
          u.uDim.value = (1 - focus) * (lightTheme ? 0.16 : 0.22);
          u.uChroma.value = reduce ? 0 : clamp(Math.abs(speed) * 0.0016, 0, 0.014);
          u.uDir.value.set(L.stack ? Math.sign(speed || 1) : 0, L.stack ? 0 : Math.sign(speed || 1));
          u.uBend.value = reduce ? 0 : clamp(speed * 0.012, -0.14, 0.14);
          u.uTime.value = time;
          u.uReveal.value = clamp(reveal * 1.6 - Math.abs(off) * 0.25, 0, 1);
          u.uGrain.value = lightTheme ? 0.03 : 0.04;

          var die = dies[k];
          die.g.userData.slot = idx - Math.round(pos);
          if (die.i !== ci) {
            die.i = ci;
            if (glyphs[ci]) { die.face.material.uniforms.uGlyph.value = glyphs[ci][0]; die.face.material.uniforms.uHeight.value = glyphs[ci][1]; }
          }
          var a2 = L.a2 + L.s2 * off * L.p2;
          var dx = L.c2[0] + Math.cos(a2) * L.R2, dy = L.c2[1] + Math.sin(a2) * L.R2;
          var rv = clamp(reveal * 1.5 - Math.abs(off) * 0.2, 0, 1);
          die.g.position.set(dx, dy, -Math.abs(off) * 30 + Math.sin(time * 0.8 + ci) * 4 * focus);
          die.g.scale.setScalar(L.d * (0.6 + 0.4 * rv));
          die.g.visible = die.g.visible && rv > 0.01;
          var twist = (a2 - L.a2) * 0.42;
          die.g.rotation.set((L.stack ? 0.3 : -0.09) + speed * 0.02, (L.stack ? 0 : -0.24) + speed * 0.05 + Math.sin(time * 0.6 + ci) * 0.04, twist);
          die.face.material.uniforms.uTime.value = time;
          die.face.material.uniforms.uSpin.value = a2 + spin;
        }
      }

      var visible = true;
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(stage);
      ownLoop = false;
      function loop(now) {
        requestAnimationFrame(loop);
        if (document.hidden) { lastT = now; return; }
        window.__roFrame(now);
        var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
        time += dt;
        if (!drag) pos += (target - pos) * (1 - Math.exp(-dt * 7.5));
        if (Math.abs(target - pos) < 0.0005 && !drag) pos = target;
        var v = (pos - (loop.prev === undefined ? pos : loop.prev)) / Math.max(dt, 0.001);
        loop.prev = pos;
        vel = v; sv += (v - sv) * (1 - Math.exp(-dt * 10));
        spin += sv * dt * 0.2;
        var c = wrap(Math.round(pos));
        if (c !== current) {
          var dir = Math.round(pos) > (loop.lastRound === undefined ? 0 : loop.lastRound) ? 1 : -1;
          current = c; showInfo(c, dir, false);
          live.textContent = cases[c].name;
        }
        loop.lastRound = Math.round(pos);
        if (!visible) return;
        place(time, dt);
        renderer.render(scene, camera);
      }

      /* tudo carregado: o contador fecha, o papel some e as rodas entram girando */
      root.classList.add('ro-wheels');
      size();
      function enter() {
        var from = performance.now(), dur = first ? 1700 : 1100;
        pos = target = -1.6;
        (function grow(now) {
          var t = clamp((now - from) / dur, 0, 1), e = 1 - Math.pow(1 - t, 4);
          reveal = e;
          if (t < 1) requestAnimationFrame(grow);
        })(from);
        target = 0;
      }
      requestAnimationFrame(loop);
      (function wait() {
        if (veil && progress < 100) return requestAnimationFrame(wait);
        dropVeil(enter);
      })();
    }
  });
})();
`
