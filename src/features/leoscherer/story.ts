/**
 * Carregamento das páginas novas da LS (Home, Categoria, Produto), num widget
 * HTML só de comportamento, o primeiro filho do cabeçalho: roda antes de
 * qualquer foto da página.
 *
 * - Cada foto fica escondida até chegar inteira e decodificada, e então surge
 *   devagar (CSS em redesign.ts › BASE_CSS). Nunca aparece desenhando aos
 *   pedaços; a que falha não mostra o ícone de imagem quebrada. A proporção já
 *   está reservada pelo construtor, então nada pula quando ela chega.
 * - As fotos do cabeçalho e da primeira seção não esperam o carregamento
 *   preguiçoso e pedem prioridade.
 * - `ls-enter` liga a entrada da abertura (`.ls-intro`, só CSS): os textos sobem
 *   desde a primeira pintura, sem esperar script de fora.
 *
 * No editor do Elementor e nas miniaturas do canvas do Space nada fica armado.
 */
export const LS_LOAD_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-ls-load')) return;
  root.setAttribute('data-ls-load', '1');
  if (document.body && document.body.classList.contains('elementor-editor-active')) return;
  root.classList.add('ls-img', 'ls-enter');

  function ready(img, now) {
    if (img.classList.contains('ls-ready')) return;
    if (now) img.classList.add('ls-now');
    img.classList.add('ls-ready');
  }
  // decodifica antes de mostrar: a foto entra inteira, num quadro só
  function loaded(img) {
    img.classList.remove('ls-broken');
    if (img.decode) img.decode().then(function () { ready(img); }, function () { ready(img); });
    else ready(img);
  }
  function settle(img, now) {
    if (!img.complete || img.classList.contains('ls-ready') || !img.getAttribute('src')) return;
    if (img.naturalWidth || /\\.svg([?#]|$)/i.test(img.currentSrc || img.src)) return now ? ready(img, true) : loaded(img);
    img.classList.add('ls-broken');
  }
  document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') loaded(e.target); }, true);
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ls-broken'); }, true);
  // entrada que terminou não roda de novo, nem quando o elemento muda de lugar (o pin do hero o embrulha)
  document.addEventListener('animationend', function (e) {
    if (e.target && e.target.classList && /^ls-(img-in|intro)$/.test(e.animationName)) e.target.classList.add('ls-done');
  }, true);
  // o que já veio do cache aparece na hora, sem a transição
  [].forEach.call(document.images, function (img) { settle(img, true); });

  function start() {
    // miniatura do canvas do Space (a marca só existe no fim do documento): tudo como está
    if (root.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1) { root.classList.remove('ls-img', 'ls-enter'); return; }
    var head = document.getElementById('topo');
    [head, head && head.nextElementSibling].forEach(function (part) {
      if (!part) return;
      [].forEach.call(part.querySelectorAll('img'), function (img) {
        if (img.loading === 'lazy') img.loading = 'eager';
        try { img.fetchPriority = 'high'; } catch (error) {}
      });
    });
    [].forEach.call(document.images, function (img) { settle(img); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  // rede: alguma foto que terminou sem o evento chegar até aqui
  window.addEventListener('load', function () { [].forEach.call(document.images, function (img) { settle(img); }); });
})();
`

/**
 * Movimento da nova versão da LS: GSAP e ScrollTrigger do jsDelivr, num único
 * widget HTML que só tem comportamento (o primeiro filho do hero). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final.
 *
 * 1. Abertura (o telefone): os textos sobem e aparecem em sequência, só com
 *    CSS, desde a primeira pintura (`ls-enter`, ligado também pelo
 *    LS_LOAD_SCRIPT). O par de iPhone 18 Pro espera a própria foto e o GSAP
 *    (no máximo 2,6 s) e chega de baixo, inclinado em 3D, desfocado e menor, e
 *    assenta, com a luz bordô acendendo por trás; depois que ele assentou, um
 *    reflexo de luz o atravessa uma vez e ele flutua de leve. Se
 *    o GSAP não chegou a tempo, o telefone só aparece devagar (`ls-soft`).
 *    No desktop (a partir de 1025px) o hero fica preso por um trecho curto do
 *    scroll: o texto sobe e some, o telefone sobe até o centro e cresce, o
 *    reflexo passa de novo e a luz bordô por trás acende. Reversível. Abaixo
 *    de 1025px não há pin: o telefone só sobe um pouco enquanto o hero sai.
 * 2. Blocos marcados com .ls-rise sobem 24px e aparecem uma vez, em lote.
 * 3. Fotos marcadas com .ls-zoom chegam com um zoom curto (1,1 → 1), uma vez.
 * 4. Imagens .ls-drift andam um pouco com o scroll.
 *
 * As luzes do fundo derivam só com CSS (keyframes atrás de prefers-reduced-motion).
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 * O que já está na tela quando o ScrollTrigger chega fica como está: esconder
 * para mostrar de novo piscaria.
 */
export const LS_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-ls-motion')) return;
  root.setAttribute('data-ls-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  // os textos sobem com CSS desde já (ls-enter); ls-pending esconde só o telefone até a entrada dele
  // (este widget é o primeiro do hero). Sem GSAP a tempo, ele aparece devagar (ls-soft).
  root.classList.add('ls-enter', 'ls-pending');
  var started = Date.now(), released = false;
  function release(soft) {
    if (released) return;
    released = true;
    if (soft) root.classList.add('ls-soft');
    root.classList.remove('ls-pending');
  }
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-ls-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-ls-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  // a foto do telefone inteira e decodificada (ou com erro): o aparelho nunca entra vazio
  function photo(img) {
    return new Promise(function (resolve) {
      if (!img) return resolve();
      if (img.loading === 'lazy') img.loading = 'eager';
      function done() { if (img.decode) img.decode().then(resolve, resolve); else resolve(); }
      if (img.complete) done();
      else { img.addEventListener('load', done); img.addEventListener('error', resolve); }
    });
  }

  /* 1. Abertura: entrada do telefone (os textos já subiram com CSS) */
  function intro(gsap) {
    var hero = $('.ls-hero');
    if (!hero) return;
    var device = $('.ls-device', hero), glint = $('.ls-glint', hero), img = $('.ls-device img', hero), wine = $('.ls-wine', hero);
    // o reflexo é recortado pelo desenho do próprio aparelho (a máscara é a imagem publicada)
    if (glint && img) {
      var mask = 'url("' + (img.currentSrc || img.src) + '")';
      glint.style.webkitMaskImage = mask; glint.style.maskImage = mask;
      glint.style.webkitMaskSize = '100% 100%'; glint.style.maskSize = '100% 100%';
      glint.style.webkitMaskRepeat = 'no-repeat'; glint.style.maskRepeat = 'no-repeat';
    }
    // o telefone vem logo depois do título, nunca antes, por mais rápido que a foto chegue
    var tl = gsap.timeline({ delay: Math.max(0, .25 - (Date.now() - started) / 1000) });
    if (device) {
      gsap.set(device, { transformPerspective: 1400, transformOrigin: '50% 80%' });
      tl.fromTo(device, { y: 160, rotateX: 26, rotateZ: -3, scale: .84, autoAlpha: 0, filter: 'blur(12px)' },
        { y: 0, rotateX: 0, rotateZ: 0, scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 2, ease: 'expo.out', clearProps: 'filter' }, 0);
    }
    // a luz bordô acende por trás do aparelho enquanto ele chega (até .55, o começo do scroll)
    if (wine) tl.fromTo(wine, { opacity: 0 }, { opacity: .55, duration: 1.8, ease: 'power2.out' }, 0);
    // só a faixa de luz corre (background-position); a camada fica parada, alinhada à máscara.
    // Uma passada só, depois que o aparelho assentou (a máscara é o desenho dele já no lugar)
    if (glint) tl.fromTo(glint, { backgroundPosition: '100% 0%' }, { backgroundPosition: '0% 0%', duration: 1.6, ease: 'power2.inOut' }, 1.15);
    // a flutuação move o palco inteiro (aparelho e reflexo juntos); no desktop o scroll anima o .ls-stage, por isso aqui é o .ls-float
    var float = $('.ls-float', hero);
    if (float) tl.to(float, { y: -8, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 2);
  }

  /* 1 a 4. Ao rolar */
  function scroll(gsap, ST) {
    var ctx = null;
    // Um salto (link, rolagem rápida) junta num lote tudo o que passou: o que já
    // saiu da tela aparece na hora; só o visível anima, em no máximo meio segundo.
    function play(batch, to, duration, ease, each) {
      var vh = window.innerHeight;
      var inView = batch.filter(function (el) { var r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      var passed = batch.filter(function (el) { return inView.indexOf(el) === -1; });
      if (passed.length) gsap.set(passed, to);
      if (inView.length) gsap.to(inView, Object.assign({ duration: duration, ease: ease, stagger: Math.min(each, .5 / inView.length), overwrite: true }, to));
    }
    // só o que ainda está abaixo da tela: o que já foi visto não some para aparecer de novo
    function below(list) { var vh = window.innerHeight; return list.filter(function (el) { return el.getBoundingClientRect().top > vh; }); }
    function build() {
      ctx = gsap.context(function () {
        var hero = $('.ls-hero');
        if (hero) {
          var copy = $('.ls-hero-copy', hero), stage = $('.ls-stage', hero), glint = $('.ls-glint', hero), wine = $('.ls-wine', hero);
          var mm = gsap.matchMedia();
          mm.add('(min-width: 1025px)', function () {
            // quanto o telefone sobe para ficar no meio do hero
            function shift() {
              if (!stage) return 0;
              var h = hero.getBoundingClientRect(), s = stage.getBoundingClientRect();
              var target = h.top + Math.max(24, (h.height - s.height) / 2);
              return Math.max(0, s.top - target);
            }
            var tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: '+=80%', pin: true, pinSpacing: true, scrub: .6, anticipatePin: 1, invalidateOnRefresh: true } });
            if (copy) tl.to(copy, { y: -110, autoAlpha: 0, ease: 'none', duration: .45 }, 0);
            if (stage) tl.to(stage, { y: function () { return -shift(); }, scale: 1.08, ease: 'none', duration: 1 }, 0);
            if (glint) tl.fromTo(glint, { backgroundPosition: '100% 0%' }, { backgroundPosition: '0% 0%', ease: 'none', duration: .55, immediateRender: false }, .4);
            // sem pintar ao armar: a entrada ainda pode estar acendendo a luz
            if (wine) tl.fromTo(wine, { opacity: .55 }, { opacity: 1, ease: 'none', duration: 1, immediateRender: false }, 0);
          });
          mm.add('(max-width: 1024px)', function () {
            if (stage) gsap.to(stage, { y: -40, scale: 1.04, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
          });
        }

        var rise = below($$('.ls-rise'));
        gsap.set(rise, { autoAlpha: 0, y: 24 });
        ST.batch(rise, { start: 'top 90%', end: 'max', once: true, onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }, .9, 'power3.out', .08); } });

        var zoom = below($$('.ls-zoom img'));
        gsap.set(zoom, { scale: 1.1 });
        ST.batch(zoom, { start: 'top 92%', end: 'max', once: true, onEnter: function (batch) { play(batch, { scale: 1 }, 1.6, 'expo.out', .1); } });

        $$('.ls-drift').forEach(function (el) {
          var depth = el.classList.contains('ls-deep') ? 12 : 7;
          gsap.fromTo(el, { yPercent: depth }, { yPercent: -depth, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
      });
      ST.refresh();
    }
    function teardown() { if (ctx) { ctx.revert(); ctx = null; } }
    function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }
    function sync() { if (scrollable()) { if (!ctx) build(); } else teardown(); }
    ST.config({ ignoreMobileResize: true });
    var timer = 0;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(sync, 180); });
    // uma foto sem proporção reservada muda a altura da página ao chegar: mede tudo de novo
    var height = document.documentElement.scrollHeight, again = 0;
    document.addEventListener('load', function (e) {
      if (!ctx || !e.target || e.target.tagName !== 'IMG') return;
      clearTimeout(again);
      again = setTimeout(function () {
        var now = document.documentElement.scrollHeight;
        if (Math.abs(now - height) > 2) { height = now; ST.refresh(); }
      }, 200);
    }, true);
    sync();
  }

  function boot() {
    // miniatura do canvas do Space (a marca só existe no fim do documento): nada a armar
    if (root.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1) { root.classList.remove('ls-enter'); return release(); }
    var hero = $('.ls-hero');
    var gsapReady = load(CDN + 'gsap.min.js');
    Promise.race([Promise.all([gsapReady, photo(hero && $('.ls-device img', hero))]), wait(2600)]).then(function () {
      var gsap = window.gsap;
      if (!gsap) return release(true);
      try { intro(gsap); } catch (error) {}
      // o reflexo só existe com o GSAP armado; sem ele a página não mostra a faixa de luz parada
      root.classList.add('ls-armed');
      release();
    }, function () { release(true); });
    gsapReady.then(function () {
      return load(CDN + 'ScrollTrigger.min.js').then(function () {
        var gsap = window.gsap;
        gsap.registerPlugin(window.ScrollTrigger);
        // espera as imagens do hero para medir o pin certo
        var imgs = $$('.ls-hero img').filter(function (i) { return !i.complete; });
        return Promise.race([Promise.all(imgs.map(function (i) { return new Promise(function (r) { i.addEventListener('load', r); i.addEventListener('error', r); }); })), wait(1500)]).then(function () {
          // o pin embrulha o hero (muda o lugar no DOM): antes, a entrada em CSS dos textos e da foto termina
          var running = hero && hero.getAnimations ? hero.getAnimations({ subtree: true }).filter(function (a) { return /^ls-(intro|img-in)$/.test(a.animationName); }) : [];
          return Promise.race([Promise.all(running.map(function (a) { return a.finished.catch(function () {}); })), wait(2500)]);
        }).then(function () {
          try { scroll(gsap, window.ScrollTrigger); } catch (error) {}
        });
      });
    }).catch(function () { release(true); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
