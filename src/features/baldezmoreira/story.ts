/**
 * Camada de movimento do Baldez & Moreira (prospecto): GSAP e ScrollTrigger
 * do jsDelivr, num único widget HTML que só tem comportamento e é o primeiro
 * filho da abertura. Todo o conteúdo é nativo e o CSS sem script já é a
 * composição final.
 *
 * Um momento-assinatura, o selo do logo:
 *
 * 1. Ao abrir: o anel "advogados associados" chega girando (−50° → 0°) e o
 *    monograma aparece no centro; os textos da abertura sobem 14px em
 *    sequência curta.
 * 2. Ao rolar: o anel gira devagar até 100° enquanto a abertura sai da tela
 *    (scrub, sem pin). Blocos marcados com .bm-rise sobem 18px uma vez, em
 *    lote; um salto pelo menu mostra na hora o que ficou para trás.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou nas miniaturas
 * do Space (página que não rola), nada é armado e a página aparece pronta.
 */
export const BM_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-bm-motion')) return;
  root.setAttribute('data-bm-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  // bm-pending esconde o selo e os textos da abertura até a entrada; entra
  // antes da primeira pintura (este widget é o primeiro da abertura)
  root.classList.add('bm-pending');
  function release() { root.classList.remove('bm-pending'); }
  var failsafe = setTimeout(release, 2600);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-bm-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-bm-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1200)]); }
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }

  /* 1. Abertura */
  function intro(gsap) {
    var hero = $('.bm-hero');
    if (!hero) return;
    var ring = $('.bm-ring', hero), core = $('.bm-core', hero);
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    if (ring) tl.fromTo(ring, { rotation: -50, autoAlpha: 0 }, { rotation: 0, autoAlpha: 1, duration: 1.8, clearProps: 'transform' }, 0);
    if (core) tl.fromTo(core, { autoAlpha: 0, scale: .94 }, { autoAlpha: 1, scale: 1, duration: 1.1, clearProps: 'transform' }, .35);
    tl.from($$('.bm-intro', hero), { y: 14, autoAlpha: 0, duration: .8, ease: 'power2.out', stagger: .08, clearProps: 'transform' }, .1);
  }

  /* 2. Ao rolar */
  function scroll(gsap, ST) {
    var ctx = null;
    function play(batch, to, duration, ease, each) {
      var vh = window.innerHeight;
      var inView = batch.filter(function (el) { var r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      var passed = batch.filter(function (el) { return inView.indexOf(el) === -1; });
      if (passed.length) gsap.set(passed, to);
      if (inView.length) gsap.to(inView, Object.assign({ duration: duration, ease: ease, stagger: Math.min(each, .5 / inView.length), overwrite: true }, to));
    }
    function build() {
      ctx = gsap.context(function () {
        var items = $$('.bm-rise').filter(function (el) { return el.getBoundingClientRect().top > window.innerHeight * .9; });
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }, .8, 'power2.out', .08); },
        });
        // o anel gira devagar enquanto a abertura sai da tela; o monograma fica parado
        var hero = $('.bm-hero'), turn = $('.bm-ring img');
        if (hero && turn) gsap.to(turn, { rotation: 100, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: .8 } });
      });
      ST.refresh();
    }
    function teardown() { if (ctx) { ctx.revert(); ctx = null; } }
    function sync() { if (scrollable()) { if (!ctx) build(); } else teardown(); }
    ST.config({ ignoreMobileResize: true });
    var timer = 0;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(sync, 180); });
    sync();
  }

  function start() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    try { intro(gsap); } catch (error) {}
    release();
    if (!ST) return;
    gsap.registerPlugin(ST);
    try { scroll(gsap, ST); } catch (error) {}
  }

  function boot() {
    // miniatura do canvas do Space (iframe de altura automática): nada se mexe.
    // A marca é montada aqui para este próprio script não casar com ela.
    if (root.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1 || !scrollable()) { clearTimeout(failsafe); release(); return; }
    (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js')).then(function () {
      clearTimeout(failsafe);
      var st = window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js').catch(function () {});
      Promise.race([Promise.all([st, fonts()]), wait(1800)]).then(start);
    }, release);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
