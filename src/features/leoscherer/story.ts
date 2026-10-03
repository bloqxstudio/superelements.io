/**
 * Movimento da nova versão da LS: GSAP e ScrollTrigger do jsDelivr, num único
 * widget HTML que só tem comportamento (o primeiro filho do hero). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final.
 *
 * 1. Abertura (o telefone): os textos sobem e aparecem em sequência; o par de
 *    iPhone 18 Pro chega de baixo, inclinado em 3D, desfocado e menor, e
 *    assenta; um reflexo de luz atravessa o aparelho e ele flutua de leve.
 *    No desktop (a partir de 1025px) o hero fica preso por um trecho curto do
 *    scroll: o texto sobe e some, o telefone sobe até o centro e cresce, o
 *    reflexo passa de novo e a luz bordô por trás acende. Reversível. Abaixo
 *    de 1025px não há pin: o telefone só sobe um pouco enquanto o hero sai.
 * 2. Blocos marcados com .ls-rise sobem 24px e aparecem uma vez, em lote.
 * 3. Fotos marcadas com .ls-zoom chegam com um zoom curto (1,1 → 1), uma vez.
 * 4. Imagens .ls-drift andam um pouco com o scroll; o LS grande do rodapé
 *    (.ls-mark) sobe devagar.
 *
 * As luzes do fundo derivam só com CSS (keyframes atrás de prefers-reduced-motion).
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 */
export const LS_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-ls-motion')) return;
  root.setAttribute('data-ls-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  // miniatura do canvas do Space: a marca é montada aqui para o script não casar com ela
  var thumb = root.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1;
  if (reduce || editor || thumb) return;

  // ls-pending esconde a abertura até a entrada (este widget é o primeiro do hero)
  root.classList.add('ls-pending');
  function release() { root.classList.remove('ls-pending'); }
  var failsafe = setTimeout(release, 2500);

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

  /* 1. Abertura: entrada */
  function intro(gsap) {
    var hero = $('.ls-hero');
    if (!hero) return;
    var items = $$('.ls-intro', hero), device = $('.ls-device', hero), glint = $('.ls-glint', hero), img = $('.ls-device img', hero);
    // o reflexo é recortado pelo desenho do próprio aparelho (a máscara é a imagem publicada)
    if (glint && img) {
      var mask = 'url("' + (img.currentSrc || img.src) + '")';
      glint.style.webkitMaskImage = mask; glint.style.maskImage = mask;
      glint.style.webkitMaskSize = '100% 100%'; glint.style.maskSize = '100% 100%';
      glint.style.webkitMaskRepeat = 'no-repeat'; glint.style.maskRepeat = 'no-repeat';
    }
    var tl = gsap.timeline();
    tl.fromTo(items, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out', stagger: .08, clearProps: 'transform' }, .05);
    if (device) {
      gsap.set(device, { transformPerspective: 1400, transformOrigin: '50% 80%' });
      tl.fromTo(device, { y: 160, rotateX: 26, rotateZ: -3, scale: .84, autoAlpha: 0, filter: 'blur(12px)' },
        { y: 0, rotateX: 0, rotateZ: 0, scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 2, ease: 'expo.out', clearProps: 'filter' }, .2);
    }
    // só a faixa de luz corre (background-position); a camada fica parada, alinhada à máscara
    if (glint) tl.fromTo(glint, { backgroundPosition: '100% 0%' }, { backgroundPosition: '0% 0%', duration: 1.5, ease: 'power2.inOut' }, 1.15);
    // a flutuação move o palco inteiro (aparelho e reflexo juntos); no desktop o scroll anima o .ls-stage, por isso aqui é o .ls-float
    var float = $('.ls-float', hero);
    if (float) tl.to(float, { y: -8, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 2.2);
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
    function below(list) { return list.filter(function (el) { return el.getBoundingClientRect().bottom > 0; }); }
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
            if (wine) tl.fromTo(wine, { opacity: .55 }, { opacity: 1, ease: 'none', duration: 1 }, 0);
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
        var mark = $('.ls-mark');
        if (mark) gsap.fromTo(mark, { yPercent: 24 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: mark, start: 'top bottom', end: 'bottom bottom', scrub: true } });
      });
      ST.refresh();
    }
    function teardown() { if (ctx) { ctx.revert(); ctx = null; } }
    function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }
    function sync() { if (scrollable()) { if (!ctx) build(); } else teardown(); }
    ST.config({ ignoreMobileResize: true });
    var timer = 0;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(sync, 180); });
    sync();
  }

  function boot() {
    load(CDN + 'gsap.min.js').then(function () {
      clearTimeout(failsafe);
      var gsap = window.gsap;
      try { intro(gsap); } catch (error) {}
      // o reflexo só existe com o GSAP armado; sem ele a página não mostra a faixa de luz parada
      root.classList.add('ls-armed');
      release();
      return load(CDN + 'ScrollTrigger.min.js').then(function () {
        gsap.registerPlugin(window.ScrollTrigger);
        // espera as imagens do hero para medir o pin certo
        var imgs = $$('.ls-hero img').filter(function (i) { return !i.complete; });
        return Promise.race([Promise.all(imgs.map(function (i) { return new Promise(function (r) { i.addEventListener('load', r); i.addEventListener('error', r); }); })), new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
          try { scroll(gsap, window.ScrollTrigger); } catch (error) {}
        });
      });
    }).catch(release);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
