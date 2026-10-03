/**
 * Movimento da nova versão da LS: GSAP e ScrollTrigger do jsDelivr, num único
 * widget HTML que só tem comportamento (o primeiro filho do hero). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final.
 *
 * 1. Abertura: os textos sobem 28px e aparecem em sequência; o iPhone 18 Pro
 *    chega de baixo, um pouco menor, e assenta. Ao rolar, ele sobe devagar e
 *    cresce um pouco enquanto o hero sai (sem pin).
 * 2. Blocos marcados com .ls-rise sobem 24px e aparecem uma vez, em lote.
 * 3. Fotos marcadas com .ls-zoom chegam com um zoom curto (1,1 → 1), uma vez.
 * 4. Imagens .ls-drift andam um pouco com o scroll; o LS grande do rodapé
 *    (.ls-mark) sobe devagar.
 *
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

  /* 1. Abertura */
  function intro(gsap) {
    var hero = $('.ls-hero');
    if (!hero) return;
    var items = $$('.ls-intro', hero), device = $('.ls-device', hero);
    gsap.fromTo(items, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out', stagger: .08, delay: .05, clearProps: 'transform' });
    if (device) gsap.fromTo(device, { y: 70, scale: .9, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 1.6, ease: 'expo.out', delay: .15 });
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
        var hero = $('.ls-hero'), device = hero && $('.ls-device img', hero), copy = hero && $('.ls-hero-copy', hero);
        if (device) gsap.fromTo(device, { yPercent: 0, scale: 1 }, { yPercent: -8, scale: 1.06, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
        if (copy) gsap.fromTo(copy, { y: 0 }, { y: -48, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

        var rise = below($$('.ls-rise'));
        gsap.set(rise, { autoAlpha: 0, y: 24 });
        ST.batch(rise, { start: 'top 90%', end: 'max', once: true, onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }, .9, 'power3.out', .08); } });

        var zoom = below($$('.ls-zoom img'));
        gsap.set(zoom, { scale: 1.1 });
        ST.batch(zoom, { start: 'top 92%', end: 'max', once: true, onEnter: function (batch) { play(batch, { scale: 1 }, 1.6, 'expo.out', .1); } });

        $$('.ls-drift').forEach(function (el) {
          gsap.fromTo(el, { yPercent: 8 }, { yPercent: -8, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
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
      release();
      return load(CDN + 'ScrollTrigger.min.js').then(function () {
        gsap.registerPlugin(window.ScrollTrigger);
        try { scroll(gsap, window.ScrollTrigger); } catch (error) {}
      });
    }).catch(release);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
