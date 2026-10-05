import { strokeSvg } from './shapes'
import { SK, SK_FONTS } from './tokens'

/**
 * Movimento do laboratório Skiper UI: GSAP, ScrollTrigger e Lenis do jsDelivr,
 * num único widget HTML que só tem comportamento (o primeiro filho do
 * cabeçalho). Todo o conteúdo é nativo e o CSS sem script já é a composição
 * final (título inteiro, cartões presos sem encolher, traço inteiro, colunas
 * centradas, texto em perspectiva parado, números certos).
 *
 * Cada efeito é a tradução de um componente gratuito da Skiper UI:
 * - Lenis: a rolagem suave de todas as demos.
 * - skiper89: anel de progresso no canto (botão que volta ao topo; o número
 *   aparece com o mouse). Vale também com movimento reduzido.
 * - skiper52/53: fotos que abrem com o mouse, o toque ou o teclado (interação,
 *   vale também com movimento reduzido, só sem a transição).
 * - skiper31: as letras do título chegam espalhadas do centro, girando em X,
 *   e se juntam; quando a abertura sai da tela, elas se afastam de novo.
 * - skiper16: os cartões presos no topo encolhem enquanto o próximo cobre.
 * - skiper19: o traço lima acompanha a página: a ponta do desenho fica a 60%
 *   da altura da tela (os laços com o título, o resto junto com a rolagem).
 * - skiper37: os números rolam dígito a dígito até o valor, uma vez.
 * - skiper30: quatro colunas de fotos descem em velocidades diferentes.
 * - skiper28: o texto em perspectiva (rotateX 30°) sobe com a rolagem.
 * - skiper61: um ponto laranja segue o mouse com mola no recorte (skiper66).
 * - `.sk-rise`: blocos sobem 18px uma vez, ao entrar.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada se move e a página aparece pronta.
 */
export const SK_MOTION_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-sk-motion')) return;
  root.setAttribute('data-sk-motion', '1');
  if (document.body && document.body.classList.contains('elementor-editor-active')) return;
  function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover: hover) and (pointer: fine)');
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function scrollable() { return root.scrollHeight - window.innerHeight > 80; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var lenis = null;

  /* skiper52 / skiper53: fotos que abrem (interação: vale com e sem movimento) */
  function strips() {
    $$('.sk-strips').forEach(function (row) {
      if (row.classList.contains('sk-js')) return;
      row.classList.add('sk-js');
      var items = $$('.sk-strip', row);
      function pick(item) {
        items.forEach(function (it) { var on = it === item; it.classList.toggle('is-active', on); it.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      }
      items.forEach(function (it) {
        var tag = $('.sk-strip-tag', it);
        it.setAttribute('tabindex', '0');
        it.setAttribute('role', 'button');
        it.setAttribute('aria-pressed', it.classList.contains('is-active') ? 'true' : 'false');
        if (tag) it.setAttribute('aria-label', 'Abrir: ' + tag.textContent.trim());
        it.addEventListener('mouseenter', function () { if (fine) pick(it); });
        it.addEventListener('click', function () { pick(it); });
        it.addEventListener('focus', function () { pick(it); });
        it.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(it); } });
      });
    });
  }

  /* skiper89: o anel de progresso da rolagem, que volta ao topo */
  function progressRing() {
    if ($('.sk-progress') || !scrollable()) return;
    var R = 18, C = 2 * Math.PI * R;
    var css = document.createElement('style');
    css.textContent = '.sk-progress{position:fixed;right:16px;bottom:16px;z-index:1100;width:48px;height:48px;margin:0;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid rgba(10,10,10,.1);border-radius:16px;background:rgba(245,244,243,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:${SK.ink};cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.sk-progress svg{width:40px;height:40px;transform:rotate(-90deg);display:block}' +
      '.sk-progress-num{position:absolute;right:0;bottom:calc(100% + 6px);padding:4px 6px;border-radius:6px;background:rgba(245,244,243,.9);font:500 11px/1 "${SK_FONTS.mono}",ui-monospace,monospace;color:rgba(10,10,10,.55);font-variant-numeric:tabular-nums;opacity:0;pointer-events:none}' +
      '.sk-progress:hover .sk-progress-num,.sk-progress:focus-visible .sk-progress-num{opacity:1}' +
      '.sk-progress:focus-visible{outline:2px solid ${SK.orange};outline-offset:3px}' +
      '@media(prefers-reduced-motion:no-preference){.sk-progress-num{transition:opacity .2s}.sk-progress{transition:transform .2s}.sk-progress:active{transform:scale(.96)}}';
    document.head.appendChild(css);
    var ring = document.createElement('button');
    ring.type = 'button';
    ring.className = 'sk-progress';
    ring.setAttribute('aria-label', 'Voltar ao topo');
    ring.innerHTML = '<span class="sk-progress-num" aria-hidden="true">0%</span>' +
      '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="' + R + '" fill="none" stroke="currentColor" stroke-width="3" opacity=".25"/>' +
      '<circle class="sk-progress-arc" cx="24" cy="24" r="' + R + '" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '"/></svg>';
    document.body.appendChild(ring);
    var arc = $('.sk-progress-arc', ring), num = $('.sk-progress-num', ring), last = -1;
    function update() {
      var max = root.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, (window.scrollY || 0) / max)) : 0;
      var pct = Math.round(p * 100);
      arc.setAttribute('stroke-dashoffset', (C * (1 - p)).toFixed(2));
      if (pct !== last) { last = pct; num.textContent = pct + '%'; }
    }
    ring.addEventListener('click', function () {
      if (lenis) lenis.scrollTo(0); else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  ready(strips);
  ready(function () { setTimeout(progressRing, 60); });
  if (reduce) return;

  // sk-pending esconde o título e as peças da abertura até as letras estarem prontas;
  // entra antes da primeira pintura (este widget vem antes do conteúdo) e sai sozinho se o CDN falhar
  root.classList.add('sk-pending');
  var released = false;
  function release() { if (released) return; released = true; root.classList.remove('sk-pending'); }
  setTimeout(release, 2000);

  var G = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var LENIS = 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js';
  function load(src) {
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  function libs() {
    return (window.gsap ? Promise.resolve() : load(G + 'gsap.min.js')).then(function () {
      return Promise.all([window.ScrollTrigger ? 0 : load(G + 'ScrollTrigger.min.js'), window.Lenis ? 0 : load(LENIS).catch(function () {})]);
    });
  }
  function fonts() {
    return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(), new Promise(function (ok) { setTimeout(ok, 1200); })]);
  }

  Promise.all([libs(), new Promise(function (ok) { ready(ok); })]).then(fonts).then(function () {
    if (!window.gsap || !window.ScrollTrigger || !scrollable()) { release(); return; }
    start(window.gsap, window.ScrollTrigger);
  }).catch(release);

  function start(gsap, ST) {
    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });
    root.classList.add('sk-live');
    smooth(gsap, ST);
    hero(gsap);
    stack(gsap);
    stroke(gsap, ST);
    counts(gsap, ST);
    parallax(gsap);
    crawl(gsap);
    follow(gsap);
    rise(gsap, ST);
    ST.refresh();
    window.addEventListener('load', function () { ST.refresh(); });
  }

  /* Lenis: a rolagem suave das demos (a roda; o toque fica nativo) */
  function smooth(gsap, ST) {
    if (!window.Lenis) return;
    try {
      var css = document.createElement('style');
      css.textContent = 'html.lenis,html.lenis body{height:auto}.lenis.lenis-smooth{scroll-behavior:auto!important}.lenis:not(.lenis-autoToggle).lenis-stopped{overflow:clip}.lenis [data-lenis-prevent]{overscroll-behavior:contain}';
      document.head.appendChild(css);
      lenis = new window.Lenis({ lerp: 0.1, anchors: true, autoRaf: false });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } catch (e) { lenis = null; }
  }

  /* skiper31: as letras se juntam do centro; ao sair da abertura, se afastam */
  function splitTitle(h) {
    var tmp = document.createElement('div'), label = [];
    var lines = h.innerHTML.split(/<br\\s*\\/?>/i).map(function (part) {
      tmp.innerHTML = part;
      var line = tmp.textContent.replace(/\\s+/g, ' ').trim();
      label.push(line);
      var chars = Array.from(line), mid = (chars.length - 1) / 2;
      return '<span class="sk-line">' + chars.map(function (c, i) {
        return '<span class="sk-ch' + (c === ' ' ? ' sk-sp' : '') + '" data-d="' + (i - mid) + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>';
      }).join('') + '</span>';
    });
    h.innerHTML = '<span class="sk-sr">' + esc(label.join(' ')) + '</span><span class="sk-chars" aria-hidden="true">' + lines.join('') + '</span>';
    return $$('.sk-ch', h);
  }
  function hero(gsap) {
    var h = $('.sk-hero-title .elementor-heading-title');
    if (!h) { release(); return; }
    var sec = h.closest('.sk-sec') || h;
    var items = $$('.sk-hero-in', sec);
    var chars = splitTitle(h);
    function d(i, el) { return parseFloat(el.getAttribute('data-d')) || 0; }
    gsap.set(items, { y: 16, autoAlpha: 0 });
    var tl = gsap.timeline({ delay: 0.1 });
    tl.from(chars, {
      x: function (i, el) { return d(i, el) * 50; },
      rotationX: function (i, el) { return d(i, el) * 50; },
      autoAlpha: 0, duration: 1.6, ease: 'expo.out',
      stagger: { each: 0.025, from: 'center' },
    }, 0).to(items, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.5);
    release();
    tl.eventCallback('onComplete', function () {
      gsap.set(items, { clearProps: 'transform,visibility,opacity' });
      gsap.to(chars, {
        x: function (i, el) { return d(i, el) * 26; },
        rotationX: function (i, el) { return d(i, el) * 20; },
        opacity: 0.2, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
    });
  }

  /* skiper16: os cartões presos no topo encolhem enquanto o próximo cobre */
  function stack(gsap) {
    $$('.sk-stack').forEach(function (s) {
      var cards = $$('.sk-card', s), n = cards.length;
      if (n < 2) return;
      var tl = gsap.timeline({ scrollTrigger: { trigger: s, start: 'top top', end: 'bottom bottom', scrub: true } });
      cards.forEach(function (c, i) {
        if (i === n - 1) return;
        var target = Math.max(0.5, 1 - (n - i - 1) * 0.1);
        tl.fromTo(c, { scale: 1 }, { scale: target, ease: 'none', duration: 1 - i * 0.25 }, i * 0.25);
      });
    });
  }

  /* skiper19: o traço acompanha a página. A ponta do desenho fica a TIP da altura da tela:
     os laços se desenham enquanto o título passa e o resto cresce junto com a rolagem (e volta ao subir).
     O caminho sobe e desce nos laços, então a conta usa o maior y já alcançado até cada comprimento. */
  var STROKE = ${JSON.stringify(strokeSvg(SK.lime, 'class="sk-stroke-svg" aria-hidden="true" focusable="false"'))};
  var TIP = 0.6, LOOP_Y = 580;
  function stroke(gsap, ST) {
    $$('.sk-stroke').forEach(function (box) {
      box.innerHTML = STROKE;
      box.classList.add('is-live');
      var svg = $('svg', box), path = $('path', box);
      if (!svg || !path || !path.getTotalLength) return;
      var len = path.getTotalLength(), vb = svg.viewBox.baseVal, N = 800, reach = [], peak = -Infinity;
      for (var i = 0; i <= N; i++) { var y = path.getPointAtLength((len * i) / N).y; if (y > peak) peak = y; reach.push(peak); }
      // os laços ficam todos na faixa do título: eles se desenham enquanto o título atravessa a tela
      // (de 90% da tela até a ponta chegar ao fim deles); daí em diante a ponta segue a página
      var loop = 0;
      while (loop < N && reach[loop] < LOOP_Y) loop++;
      path.style.strokeDasharray = len + ' ' + len;
      path.style.strokeDashoffset = len;
      var to = gsap.quickTo(path, 'strokeDashoffset', { duration: 0.45, ease: 'power3.out' });
      function drawn() {
        var r = box.getBoundingClientRect(), vh = window.innerHeight;
        if (!r.height) return 0;
        var k = r.height / vb.height;
        var target = (vh * TIP - r.top) / k + vb.y;
        if (target < LOOP_Y) {
          var from = vh * 0.9, until = vh * TIP - (LOOP_Y - vb.y) * k;
          var p = from > until ? (from - r.top) / (from - until) : 0;
          return ((len * loop) / N) * Math.min(1, Math.max(0, p));
        }
        if (target >= reach[N]) return len;
        var lo = loop, hi = N;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (reach[mid] >= target) hi = mid; else lo = mid + 1; }
        return (len * lo) / N;
      }
      function update() { to(len - drawn()); }
      ST.create({ trigger: box.closest('.sk-sec') || box, start: 'top bottom', end: 'bottom top', onUpdate: update, onRefresh: update });
      path.style.strokeDashoffset = len - drawn();
    });
  }

  /* skiper37: os números rolam dígito a dígito, uma vez, e o texto original volta */
  function counts(gsap, ST) {
    $$('.sk-count .elementor-heading-title').forEach(function (h) {
      var text = h.textContent.trim(), html = h.innerHTML;
      if (!/\\d/.test(text)) return;
      var vals = [];
      h.setAttribute('aria-label', text);
      h.innerHTML = Array.from(text).map(function (c) {
        if (!/\\d/.test(c)) return '<span aria-hidden="true">' + esc(c) + '</span>';
        vals.push(Number(c));
        return '<span class="sk-dg" aria-hidden="true"><span class="sk-dg-s">0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9</span></span>';
      }).join('');
      var strips = $$('.sk-dg-s', h);
      strips.forEach(function (s, i) { gsap.set(s, { yPercent: vals[i] === 0 ? -90 : 0 }); });
      ST.create({
        trigger: h, start: 'top 85%', once: true,
        onEnter: function () {
          var tl = gsap.timeline({ onComplete: function () { h.innerHTML = html; h.removeAttribute('aria-label'); } });
          strips.forEach(function (s, i) { tl.to(s, { yPercent: -10 * vals[i], duration: 1.6 + i * 0.2, ease: 'expo.out' }, i * 0.06); });
        },
      });
    });
  }

  /* skiper30: as colunas descem em velocidades diferentes */
  function parallax(gsap) {
    var F = [0.35, 1, 0.15, 0.7];
    $$('.sk-gallery').forEach(function (g) {
      $$('.sk-col', g).forEach(function (c, i) {
        function amp() { return Math.max(0, (c.offsetHeight - g.clientHeight) / 2) * F[i % 4]; }
        gsap.fromTo(c, { y: function () { return -amp(); } }, {
          y: function () { return amp(); }, ease: 'none',
          scrollTrigger: { trigger: g, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
        });
      });
    });
  }

  /* skiper28: o texto em perspectiva sobe enquanto a caixa (300vh) passa */
  function crawl(gsap) {
    $$('.sk-crawl-box').forEach(function (box) {
      var t = $('.sk-crawl-text', box);
      if (!t) return;
      var p = { y: window.innerWidth < 768 ? 320 : 487 };
      function apply() { t.style.transform = 'rotateX(30deg) translateY(' + p.y.toFixed(1) + 'px) translateZ(10px)'; }
      apply();
      gsap.to(p, { y: 0, ease: 'none', onUpdate: apply, scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom bottom', scrub: true } });
    });
  }

  /* skiper61: um ponto com mola segue o mouse dentro do recorte */
  function follow(gsap) {
    if (!fine) return;
    $$('.sk-clip').forEach(function (frame) {
      var dot = $('.sk-dot', frame);
      if (!dot) return;
      var K = 131, Cd = 10, M = 0.1;
      var s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, k: 0, vk: 0, tk: 0 };
      function aim(e) { var r = frame.getBoundingClientRect(); s.tx = e.clientX - r.left; s.ty = e.clientY - r.top; }
      frame.addEventListener('pointerenter', function (e) { aim(e); if (s.k < 0.02) { s.x = s.tx; s.y = s.ty; s.vx = s.vy = 0; } s.tk = 1; });
      frame.addEventListener('pointermove', aim);
      frame.addEventListener('pointerleave', function () { s.tk = 0; });
      function spring(v, x, t, h) { return v + ((-K * (x - t) - Cd * v) / M) * h; }
      gsap.ticker.add(function (time, dt) {
        var h = Math.min(dt, 64) / 1000 / 4;
        for (var i = 0; i < 4; i++) {
          s.vx = spring(s.vx, s.x, s.tx, h); s.x += s.vx * h;
          s.vy = spring(s.vy, s.y, s.ty, h); s.y += s.vy * h;
          s.vk = spring(s.vk, s.k, s.tk, h); s.k += s.vk * h;
        }
        var k = Math.max(0, s.k);
        dot.style.opacity = Math.min(1, k).toFixed(3);
        dot.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + k.toFixed(3) + ')';
      });
    });
  }

  /* blocos que sobem 18px uma vez ao entrar */
  function rise(gsap, ST) {
    var els = $$('.sk-rise');
    if (!els.length) return;
    gsap.set(els, { y: 18, autoAlpha: 0 });
    ST.batch(els, {
      start: 'top 88%', once: true,
      onEnter: function (batch) { gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.08, overwrite: true }); },
    });
  }
})();
`
