import { AV_MARK } from './mark'

/**
 * Movimento do Avence Studio: GSAP e ScrollTrigger do jsDelivr, num único
 * widget HTML que só tem comportamento (o primeiro filho da abertura). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final (a galeria
 * parada, os cases numa faixa que rola de lado, o topo de cada site na moldura).
 * Regras de movimento (skill better-ui, pedido do usuário em 2026-10-04): um
 * gesto claro por vez, partes com ~100 ms entre si, subir 16 a 32 px com
 * opacidade, easing de saída (expo.out / power3.out, como cubic-bezier(.2,0,0,1)),
 * sem bounce, interrompível.
 *
 * 0. O grão: um ruído fino sobre a página toda, que se mexe de leve (parado com
 *    menos movimento), como papel vivo.
 * 1. A entrada (uma vez por visita, com a página no topo, 1,6 a 2 s):
 *    a. numa tela de papel, o logo "avence. STUDIO" se revela por máscara, de
 *       baixo para cima, subindo 16px (CSS, já na primeira pintura);
 *    b. o ponto azul acende: escala .25 → 1, opacidade 0 → 1, desfoque 4px → 0;
 *    c. o logo sobe e diminui até o lugar dele no cabeçalho (elemento
 *       compartilhado: pousa exatamente sobre o logo em texto, que então assume),
 *       enquanto o papel some;
 *    d. o rótulo, o título, o texto e os botões entram em partes (100 ms entre
 *       eles: sobem 20px, opacidade, desfoque 4px → 0);
 *    e. as telas da galeria sobem de leve, da esquerda para a direita, e a
 *       galeria começa a andar, acelerando devagar.
 *    Um toque, uma tecla ou a roda aceleram a entrada até o fim (sem corte).
 * 2. Abertura sem a entrada (visita seguinte): os passos d e e. A galeria corre
 *    em duas fileiras, em sentidos opostos, sem emenda (três grupos iguais), e
 *    se arrasta com o mouse ou o dedo, com inércia; com o mouse em cima,
 *    desacelera bastante. O meio-tom da
 *    abertura desce mais devagar que a página.
 * 3. Cases, no computador (1025px ou mais): a seção fica presa (pin) e cada case
 *    ocupa a tela. Para cada um, a rolagem desce a página do site dentro da
 *    janela; depois o case recua (encolhe e apaga) e o próximo entra com um giro
 *    curto. O último case fica parado um instante e o pin solta. No celular e no
 *    tablet, sem pin: a faixa desliza com o dedo (scroll-snap nativo) e a página
 *    corre sozinha dentro das janelas.
 * 4. Menu: ao rolar, o cabeçalho vira uma barra de vidro (html.av-scrolled);
 *    isso vale também para quem pediu menos movimento (só sem a transição).
 * 5. Cursor "Arraste" / "Ver site ↗" sobre as telas, só com mouse; os blocos
 *    .av-rise sobem 18px uma vez, ao entrar.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 */
export const AV_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-av-motion')) return;
  root.setAttribute('data-av-motion', '1');
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (editor) return;

  /* 0. O grão: um ruído fino sobre a página toda, que se mexe de leve (parado para quem pede menos movimento) */
  function grain(animated) {
    if (document.querySelector('.av-grain')) return;
    var noise = "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";
    var css = document.createElement('style');
    css.textContent = '.av-grain{position:fixed;left:-50%;top:-50%;width:200%;height:200%;z-index:3500;pointer-events:none;opacity:.065;background:url("data:image/svg+xml,' + noise.replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E') + '") 0 0/220px 220px repeat}' +
      '@keyframes avGrain{0%,100%{transform:translate3d(0,0,0)}10%{transform:translate3d(-4%,-6%,0)}20%{transform:translate3d(-9%,3%,0)}30%{transform:translate3d(5%,-11%,0)}40%{transform:translate3d(-3%,12%,0)}50%{transform:translate3d(-10%,6%,0)}60%{transform:translate3d(9%,0,0)}70%{transform:translate3d(0,9%,0)}80%{transform:translate3d(2%,14%,0)}90%{transform:translate3d(-6%,5%,0)}}' +
      '.av-grain.is-live{animation:avGrain 1s steps(10) infinite;will-change:transform}';
    document.head.appendChild(css);
    var el = document.createElement('div');
    el.className = 'av-grain' + (animated ? ' is-live' : '');
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }

  /* 4. O menu de vidro ao rolar (vale com e sem movimento) */
  (function () {
    var on = false;
    function check() { var s = (window.scrollY || 0) > 24; if (s !== on) { on = s; root.classList.toggle('av-scrolled', s); } }
    window.addEventListener('scroll', check, { passive: true });
    check();
  })();

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* 4b. As telas com o efeito do case em vídeo (vale com e sem movimento): com movimento
     reduzido e nas miniaturas do canvas ficam paradas na capa. Com movimento, quem anda o
     vídeo é o scroll da página (cases(), mais abaixo) */
  (function () {
    function videos() {
      if (!reduce && document.documentElement.scrollHeight - window.innerHeight > 80) return;
      [].slice.call(document.querySelectorAll('.av-screen-video video')).forEach(function (v) { v.autoplay = false; v.removeAttribute('autoplay'); v.pause(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', videos); else videos();
  })();

  if (reduce) {
    var still = function () { if (document.documentElement.scrollHeight - window.innerHeight > 80) grain(false); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', still); else still();
    return;
  }

  var MARK = ${JSON.stringify(AV_MARK)};
  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }
  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function shown(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight; }
  var fine = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  function seen() { try { return sessionStorage.getItem('av-intro') === '1'; } catch (e) { return false; } }
  function remember() { try { sessionStorage.setItem('av-intro', '1'); } catch (e) {} }

  // av-pending esconde as peças da abertura até a entrada; entra antes da primeira
  // pintura (este widget vem antes do conteúdo) e sai sozinho se o CDN falhar
  root.classList.add('av-pending');
  function release() { root.classList.remove('av-pending'); }

  /* 1a. A tela da entrada, montada já na primeira pintura: papel e o logo, que se revela por CSS */
  var ov = null, ovLogo = null, introT0 = 0, introTl = null, skipAsked = false;
  var hb = MARK.header.box, u0 = 1, start0 = { x: 0, y: 0 };
  if (!seen() && (window.scrollY || 0) < 80 && !location.hash) {
    root.classList.add('av-intro-run');
    ov = document.createElement('div');
    ov.setAttribute('aria-hidden', 'true');
    ov.className = 'av-intro-screen';
    ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background-color:#f3f1ec;cursor:pointer';
    var vw0 = window.innerWidth, vh0 = window.innerHeight;
    u0 = Math.min(vw0 * (vw0 < 768 ? .78 : .42), 560) / hb[2];
    var lw = hb[2] * u0, lh = hb[3] * u0, hp = MARK.header.point;
    start0 = { x: (vw0 - lw) / 2, y: (vh0 - lh) / 2 - vh0 * .02 };
    ovLogo = document.createElement('div');
    ovLogo.style.cssText = 'position:fixed;left:0;top:0;width:' + lw + 'px;height:' + lh + 'px;transform-origin:0 0;transform:translate(' + start0.x + 'px,' + start0.y + 'px)';
    ovLogo.innerHTML = '<svg class="av-intro-mask" xmlns="http://www.w3.org/2000/svg" viewBox="' + hb.join(' ') + '" width="' + lw + '" height="' + lh + '" style="display:block;overflow:visible"><path fill="#111111" d="' + MARK.wordPath + '"/><path fill="#111111" d="' + MARK.header.studioPath + '"/></svg>' +
      '<i class="av-intro-pt" style="position:absolute;display:block;background:#2b3cf0;left:' + (hp.x - hb[0]) * u0 + 'px;top:' + (-hp.side - hb[1]) * u0 + 'px;width:' + hp.side * u0 + 'px;height:' + hp.side * u0 + 'px"></i>';
    ov.appendChild(ovLogo);
    var introCss = document.createElement('style');
    introCss.textContent = '@keyframes avMask{from{clip-path:inset(100% 0 0 0);transform:translateY(16px)}to{clip-path:inset(0 0 0 0);transform:none}}' +
      '@keyframes avPt{from{opacity:0;transform:scale(.25);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}' +
      '.av-intro-mask{animation:avMask .6s cubic-bezier(.2,0,0,1) .05s both}.av-intro-pt{animation:avPt .35s cubic-bezier(.2,0,0,1) .5s both}';
    document.head.appendChild(introCss);
    document.body.appendChild(ov);
    introT0 = performance.now();
    // pular: a entrada acelera até o fim (o estado final é o mesmo do CSS)
    var askSkip = function () { skipAsked = true; if (introTl) introTl.timeScale(4); };
    ov.addEventListener('click', askSkip);
    window.addEventListener('keydown', askSkip, { once: true });
    window.addEventListener('wheel', askSkip, { once: true, passive: true });
    window.addEventListener('touchstart', askSkip, { once: true, passive: true });
  }
  function dropOverlay() {
    root.classList.remove('av-intro-run');
    if (!ov) return;
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
  }
  var failsafe = setTimeout(function () { release(); dropOverlay(); }, 3200);

  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-av-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-av-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }

  /* 2a. A galeria: corre, arrasta, tem inércia, desacelera com o mouse em cima */
  var galleryStart = function () {};
  function gallery(gsap) {
    var hero = $('#inicio');
    var mq = hero && $('.av-marquee', hero);
    if (!mq) return;
    var rows = $$('.av-track', mq).map(function (el, i) {
      return { el: el, x: 0, w: 1, dir: i ? 1 : -1, group: $('.av-group', el) };
    });
    $$('img', mq).forEach(function (img) { img.loading = 'eager'; img.draggable = false; });
    function measure() {
      rows.forEach(function (r, i) {
        var gap = parseFloat(getComputedStyle(r.el).columnGap) || 0;
        r.w = r.group ? r.group.offsetWidth + gap : r.el.offsetWidth / 3;
        if (!r.ready) { r.x = i ? -r.w * .42 : 0; r.ready = true; }
      });
    }
    measure();
    var drift = window.innerWidth < 768 ? 40 : 56, vel = 0, hover = false, dragging = false, live = false, moved = 0;
    var startX = 0, lastX = 0, lastT = 0, dragV = 0;
    function wrap(r) { r.x = ((r.x % r.w) + r.w) % r.w - r.w; }
    function apply() { rows.forEach(function (r) { wrap(r); r.el.style.transform = 'translate3d(' + r.x.toFixed(2) + 'px,0,0)'; }); }
    apply();
    gsap.ticker.add(function (time, delta) {
      if (!live || dragging) return;
      var dt = Math.min(delta, 64) / 1000;
      var target = hover ? .18 : 1;
      // a velocidade chega devagar ao alvo (acelera ao começar, desacelera com o mouse)
      vel += (target - vel) * (1 - Math.exp(-dt * 1.8));
      // inércia: o empurrão do arraste se desfaz devagar
      dragV *= Math.exp(-dt * 2.6);
      rows.forEach(function (r) { r.x += (r.dir * drift * vel + dragV) * dt; });
      apply();
    });
    mq.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
    mq.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover = false; });
    mq.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true; moved = 0; startX = lastX = e.clientX; lastT = performance.now(); dragV = 0;
      mq.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, now = performance.now();
      moved = Math.max(moved, Math.abs(e.clientX - startX));
      rows.forEach(function (r) { r.x += dx; });
      apply();
      var v = dx / Math.max(1, now - lastT) * 1000;
      dragV = dragV * .6 + v * .4;
      lastX = e.clientX; lastT = now;
    }, { passive: true });
    function end() {
      if (!dragging) return;
      dragging = false; mq.classList.remove('is-dragging');
      if (performance.now() - lastT > 90) dragV = 0;
      dragV = Math.max(-2600, Math.min(2600, dragV));
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    // um arraste não vira clique na tela
    mq.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    window.addEventListener('resize', function () { measure(); apply(); });
    galleryStart = function () { live = true; };
  }

  /* 2b. A abertura entra em partes: rótulo, título (com a entrada), texto, botões; depois as telas */
  function enter(gsap, ST, withTitle, tl, at) {
    var hero = $('#inicio');
    if (!hero) return release();
    var parts = $$('.av-intro, .av-h1', hero).filter(function (el) { return withTitle || !el.classList.contains('av-h1'); });
    var tiles = $$('.av-tile', hero);
    var first = tiles.filter(shown).sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
    gsap.set(parts, { autoAlpha: 0, y: 20, filter: 'blur(4px)' });
    gsap.set(first, { autoAlpha: 0, y: 32, filter: 'blur(4px)' });
    gsap.set(tiles.filter(function (t) { return first.indexOf(t) === -1; }), { autoAlpha: 1 });
    release();
    var t = tl || gsap.timeline(), base = at || 0;
    t.to(parts, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .5, stagger: .08, ease: 'power3.out', clearProps: 'transform,filter' }, base);
    // as telas sobem da esquerda para a direita e só então a galeria começa a andar (a velocidade sobe de 0)
    t.to(first, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .55, stagger: Math.min(.06, .3 / Math.max(1, first.length - 1)), ease: 'power3.out', clearProps: 'transform,filter' }, base + .24);
    t.add(function () { galleryStart(); }, base + .6);
    var ht = $('.av-ht-hero', hero);
    if (ht && ST) gsap.to(ht, { yPercent: 16, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    return t;
  }

  /* 1b. A entrada: o logo pousa no cabeçalho e a abertura entra por baixo do papel que some */
  function intro(gsap, ST) {
    remember();
    var target = $$('#topo .av-wm').filter(function (el) { return el.getBoundingClientRect().width > 0; })[0];
    // onde o logo em texto do cabeçalho começa: o começo do "a" e a linha de base (o pé do ponto)
    function geo() {
      var title = target && ($('.elementor-heading-title', target) || target);
      if (!title) return null;
      var walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT), tn = walker.nextNode();
      var pt = $('.av-pt', title);
      if (!tn || !pt) return null;
      var rg = document.createRange(); rg.setStart(tn, 0); rg.setEnd(tn, 1);
      var k = (parseFloat(getComputedStyle(title).fontSize) / 100) / u0;
      return { k: k, x: rg.getBoundingClientRect().left - (0 - hb[0]) * u0 * k, y: pt.getBoundingClientRect().bottom - (0 - hb[1]) * u0 * k };
    }
    var g = null;
    function landing() { if (!g) g = geo(); return g; }
    var tl = gsap.timeline({ onComplete: function () { dropOverlay(); if (target) gsap.set(target, { clearProps: 'opacity' }); } });
    introTl = tl;
    if (skipAsked) tl.timeScale(4);
    gsap.set(ovLogo, { x: start0.x, y: start0.y, scale: 1, transformOrigin: '0 0' });
    // espera a revelação do logo (CSS) terminar, se o GSAP chegou cedo
    var t0 = Math.max(0, .85 - (performance.now() - introT0) / 1000);
    if (landing()) {
      tl.to(ovLogo, { x: function () { return landing().x; }, y: function () { return landing().y; }, scale: function () { return landing().k; }, duration: .9, ease: 'power3.out' }, t0);
      // o voo é visível (power3, não expo: o expo fazia quase todo o caminho em 0,1 s e parecia um pulo)
      tl.to(target, { opacity: 1, duration: .18, ease: 'power1.out' }, t0 + .7);
      tl.to(ovLogo, { opacity: 0, duration: .18, ease: 'power1.out' }, t0 + .74);
    } else {
      tl.to(ovLogo, { opacity: 0, y: '-=16', duration: .4, ease: 'power3.out' }, t0);
    }
    tl.to(ov, { backgroundColor: 'rgba(243,241,236,0)', duration: .5, ease: 'power2.out' }, t0 + .1);
    enter(gsap, ST, true, tl, t0 + .25);
    return tl;
  }

  /* 3. Cases */
  function cases(gsap, ST) {
    var sec = $('#cases');
    if (!sec) return;
    var track = $('.av-cases-track', sec);
    var panels = $$('.av-case', sec);
    if (!track || !panels.length) return;
    var now = $('.av-count-now .elementor-heading-title', sec);
    var bar = $('.av-progress-bar', sec);
    var items = $$('.av-index .elementor-icon-list-item', sec);
    var tl = null;
    function show(index, p) {
      index = Math.max(0, Math.min(panels.length - 1, index));
      if (now) now.textContent = (index < 9 ? '0' : '') + (index + 1);
      if (bar) gsap.set(bar, { scaleX: Math.max(.03, Math.min(1, p)) });
      items.forEach(function (li, i) { li.classList.toggle('is-active', i === index); });
    }

    // loop lento da página dentro de uma tela (o celular sempre; a janela só sem o pin)
    function autoplay(box) {
      var img = $('img', box);
      if (!img) return null;
      img.loading = 'eager';
      var tween = null, seen = false, hover = false;
      function make() {
        if (tween) tween.kill();
        var dist = Math.max(0, img.offsetHeight - box.clientHeight);
        if (dist < 40) return;
        gsap.set(img, { y: 0 });
        tween = gsap.to(img, { y: -dist, duration: Math.max(14, dist / 46), ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: 1.4, delay: .6, paused: true });
        if (seen && !hover) tween.play();
      }
      if (img.complete && img.naturalHeight) make(); else img.addEventListener('load', make, { once: true });
      var stage = box.closest('.av-device') || box;
      stage.addEventListener('pointerenter', function () { hover = true; if (tween) tween.pause(); });
      stage.addEventListener('pointerleave', function () { hover = false; if (tween && seen) tween.play(); });
      return {
        box: box,
        set: function (v) { seen = v; if (tween) { if (v && !hover) tween.play(); else tween.pause(); } },
        kill: function () { if (tween) tween.kill(); tween = null; gsap.set(img, { clearProps: 'transform' }); },
        make: make,
      };
    }
    function watch(list) {
      if (!('IntersectionObserver' in window)) { list.forEach(function (s) { s.set(true); }); return function () {}; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { list.forEach(function (s) { if (s.box === e.target) s.set(e.intersectionRatio > .3); }); });
      }, { threshold: [0, .3, .6] });
      list.forEach(function (s) { io.observe(s.box); });
      return function () { io.disconnect(); };
    }
    var phones = $$('.av-phone-screen', sec).map(autoplay).filter(Boolean);
    watch(phones);

    // o efeito do case em vídeo: o scroll da página escolhe o quadro, então o site rola junto
    // com a página. O vídeo vem inteiro para a memória (blob) para avançar e voltar sem esperar a rede.
    function scrubber(v) {
      var want = 0, busy = false, ready = false, loading = false;
      v.pause();
      function go() {
        var d = v.duration || 0;
        if (!ready || !d) return;
        var t = Math.min(d - .05, want * d);
        if (Math.abs(v.currentTime - t) < .02) return;
        busy = true;
        v.currentTime = t;
      }
      v.addEventListener('seeked', function () { busy = false; go(); });
      function arm() { ready = true; go(); }
      function load() {
        if (loading || !v.offsetWidth) return;
        loading = true;
        var src = v.currentSrc || v.getAttribute('src');
        function direct() { v.preload = 'auto'; v.addEventListener('loadeddata', arm, { once: true }); v.load(); }
        if (!src || !window.fetch || !window.URL) return direct();
        fetch(src).then(function (r) { return r.ok ? r.blob() : Promise.reject(r.status); }).then(function (blob) {
          v.addEventListener('loadeddata', arm, { once: true });
          v.src = URL.createObjectURL(blob);
          v.load();
        }).catch(direct);
      }
      return { video: v, load: load, set: function (p) { want = Math.max(0, Math.min(1, p)); load(); if (!busy) go(); } };
    }
    var films = $$('.av-screen-video video', sec).map(scrubber);
    function filmsOf(p) { return films.filter(function (f) { return p.contains(f.video) && f.video.offsetWidth; }); }
    // carrega um pouco antes de a seção chegar (no celular só o que aparece: o da janela fica escondido)
    if (films.length) ST.create({
      trigger: sec, start: function () { return 'top bottom+=' + Math.round(window.innerHeight); }, end: 'max',
      onToggle: function (self) { if (self.isActive) films.forEach(function (f) { f.load(); }); },
    });

    var mm = gsap.matchMedia();
    mm.add('(min-width: 1025px)', function () {
      sec.classList.add('av-pin');
      function step() { return panels.length > 1 ? panels[1].offsetLeft - panels[0].offsetLeft : track.clientWidth; }
      function unit() { return Math.max(520, window.innerHeight * .78); }
      // cada case: a página desce (1) e a passagem para o próximo (1); no fim, uma pausa (.4) antes de soltar.
      // Case com o efeito em vídeo tem o dobro de scroll para a história do site (FILM)
      var FILM = 2;
      var length = panels.length * 2 - 1 + .4 + panels.filter(function (p) { return filmsOf(p).length; }).length * (FILM - 1);
      tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sec, start: 'top top', end: function () { return '+=' + Math.round(unit() * length); },
          pin: true, pinSpacing: true, scrub: .6, invalidateOnRefresh: true, anticipatePin: 1,
        },
        // o contador acompanha o que está na tela (a faixa anda atrasada pelo scrub)
        onUpdate: function () {
          var x = -(gsap.getProperty(track, 'x') || 0);
          show(Math.round(x / Math.max(1, step())), tl ? tl.progress() : 0);
        },
      });
      panels.forEach(function (p, i) {
        var box = $('.av-screen', p), shot = box && $('img', box), own = filmsOf(p);
        if (own.length) {
          var at = { p: 0 };
          tl.to(at, { p: 1, duration: FILM, ease: 'none', onUpdate: function () { own.forEach(function (f) { f.set(at.p); }); } }, 'p' + i);
        } else if (shot) {
          shot.loading = 'eager';
          tl.to(shot, { y: function () { return -Math.min(Math.max(0, shot.offsetHeight - box.clientHeight), box.clientHeight * 2.4); }, duration: 1, ease: 'power1.inOut' }, 'p' + i);
        } else tl.to({}, { duration: 1 }, 'p' + i);
        if (i === panels.length - 1) return;
        var next = panels[i + 1];
        tl.to(track, { x: function () { return -step() * (i + 1); }, duration: 1, ease: 'power2.inOut' }, 'm' + i);
        // a saída é mais suave que a entrada: o case recua e apaga, sem desfoque
        tl.to($('.av-stage', p), { scale: .96, autoAlpha: .3, duration: .8, ease: 'power2.out' }, 'm' + i);
        tl.to($('.av-info', p), { autoAlpha: 0, x: -24, duration: .5, ease: 'power2.out' }, 'm' + i);
        tl.fromTo($('.av-browser', next), { rotationY: -8, scale: .94, xPercent: 6, transformPerspective: 1600 }, { rotationY: 0, scale: 1, xPercent: 0, duration: 1, ease: 'power3.out' }, 'm' + i);
        tl.fromTo($('.av-phone', next), { y: 48 }, { y: 0, duration: .9, ease: 'power3.out' }, 'm' + i + '+=0.12');
        tl.fromTo($('.av-case-name .elementor-heading-title', next), { yPercent: 105 }, { yPercent: 0, duration: .55, ease: 'power3.out' }, 'm' + i + '+=0.42');
        tl.fromTo($$('.av-info > *', next).filter(function (el) { return !el.classList.contains('av-case-name'); }), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: .08, duration: .45, ease: 'power3.out' }, 'm' + i + '+=0.4');
      });
      // o último case fica: uma pausa calma antes de o pin soltar
      tl.to({}, { duration: .4 });
      show(0, 0);
      return function () {
        sec.classList.remove('av-pin');
        tl = null;
        gsap.set(track, { clearProps: 'transform' });
      };
    });
    mm.add('(max-width: 1024px)', function () {
      var screens = $$('.av-screen', sec).map(autoplay).filter(Boolean);
      var stop = watch(screens);
      // sem o pin, o vídeo do case anda enquanto o case atravessa a tela, de baixo para cima
      var rolls = panels.map(function (p) {
        var own = filmsOf(p);
        if (!own.length) return null;
        return ST.create({
          trigger: $('.av-stage', p) || p, start: 'top 75%', end: 'bottom 25%',
          onUpdate: function (self) { own.forEach(function (f) { f.set(self.progress); }); },
          onRefresh: function (self) { own.forEach(function (f) { f.set(self.progress); }); },
        });
      }).filter(Boolean);
      function onScroll() {
        var max = track.scrollWidth - track.clientWidth;
        var p = max > 0 ? track.scrollLeft / max : 0;
        show(Math.round(p * (panels.length - 1)), p);
      }
      track.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return function () { stop(); screens.forEach(function (s) { s.kill(); }); rolls.forEach(function (r) { r.kill(); }); track.removeEventListener('scroll', onScroll); };
    });

    // a galeria e o índice levam ao case certo (no computador, ao ponto dele no pin)
    $$('a[href^="#case-"]').forEach(function (a) {
      a.addEventListener('click', function (event) {
        if (event.defaultPrevented) return;
        var panel = document.getElementById(a.getAttribute('href').slice(1));
        var index = panels.indexOf(panel);
        if (index < 0) return;
        event.preventDefault();
        var st = tl && tl.scrollTrigger;
        if (st) {
          var at = tl.labels['p' + index] || 0;
          window.scrollTo({ top: st.start + (at / tl.duration()) * (st.end - st.start) + 2, behavior: 'smooth' });
        } else {
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          track.scrollTo({ left: panel.offsetLeft - panels[0].offsetLeft, behavior: 'smooth' });
        }
      });
    });
  }

  /* 5a. Cursor sobre as telas (só com mouse) */
  function cursor(gsap) {
    if (!fine) return;
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:0;top:0;z-index:1000;pointer-events:none;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:50%;background:rgba(43,60,240,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#fff;display:flex;align-items:center;justify-content:center;font:600 11px/1.2 "Inter Tight",sans-serif;letter-spacing:.1em;text-transform:uppercase;text-align:center;transform:scale(0);opacity:0';
    document.body.appendChild(el);
    var x = gsap.quickTo(el, 'x', { duration: .45, ease: 'power3' }), y = gsap.quickTo(el, 'y', { duration: .45, ease: 'power3' });
    window.addEventListener('pointermove', function (e) { x(e.clientX); y(e.clientY); }, { passive: true });
    function bind(sel, label) {
      $$(sel).forEach(function (t) {
        t.addEventListener('pointerenter', function (e) { el.textContent = label; x(e.clientX); y(e.clientY); gsap.to(el, { scale: 1, opacity: 1, duration: .35, ease: 'power3.out', overwrite: 'auto' }); });
        t.addEventListener('pointerleave', function () { gsap.to(el, { scale: .6, opacity: 0, duration: .2, ease: 'power2.out', overwrite: 'auto' }); });
      });
    }
    bind('.av-marquee', 'Arraste');
    bind('.av-cursor-site', 'Ver site ↗');
  }

  /* 5b. Blocos que sobem ao entrar */
  function rise(gsap, ST) {
    function play(batch, to) {
      var vh = window.innerHeight;
      var inView = batch.filter(function (el) { var r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      var passed = batch.filter(function (el) { return inView.indexOf(el) === -1; });
      if (passed.length) gsap.set(passed, to);
      if (inView.length) gsap.to(inView, Object.assign({ duration: .7, ease: 'power3.out', stagger: Math.min(.1, .5 / inView.length), overwrite: true }, to));
    }
    var items = $$('.av-rise').filter(function (el) { return el.getBoundingClientRect().bottom > 0; });
    gsap.set(items, { autoAlpha: 0, y: 18 });
    ST.batch(items, {
      start: 'top 90%', end: 'max', once: true,
      onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }); },
    });
  }

  function start() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    clearTimeout(failsafe);
    if (ST) { gsap.registerPlugin(ST); ST.config({ ignoreMobileResize: true }); }
    try { gallery(gsap); } catch (error) {}
    try { cursor(gsap); } catch (error) {}
    if (ST) {
      try { cases(gsap, ST); } catch (error) {}
      try { rise(gsap, ST); } catch (error) {}
    }
    var played = false;
    if (ov) {
      try { intro(gsap, ST); played = true; } catch (error) { if (window.console) console.warn('avence: entrada', error); dropOverlay(); }
    }
    if (!played) { try { enter(gsap, ST, false); } catch (error) { release(); } }
    if (ST) {
      ST.refresh();
      // as alturas das imagens estão reservadas (aspect-ratio), mas as fontes e o carregamento ainda podem mexer na página
      if (document.readyState !== 'complete') window.addEventListener('load', function () { ST.refresh(); }, { once: true });
    }
  }

  function boot() {
    // miniatura do canvas do Space (iframe da altura da página): tudo parado
    if (!scrollable()) { release(); dropOverlay(); return; }
    grain(true);
    (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js')).then(function () {
      var st = window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js').catch(function () {});
      Promise.race([Promise.all([st, fonts()]), wait(1800)]).then(start);
    }, function () { release(); dropOverlay(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`

/** CSS da abertura enquanto o script arma a entrada (só existe com o script rodando). */
export const AV_PENDING_CSS = [
  'html.av-pending #inicio .av-intro,html.av-pending #inicio .av-tile{opacity:0}',
  // durante a entrada, o título e o logo do cabeçalho esperam (o logo da entrada pousa no lugar do de texto)
  'html.av-intro-run #inicio .av-h1,html.av-intro-run #topo .av-wm{opacity:0}',
].join('')
