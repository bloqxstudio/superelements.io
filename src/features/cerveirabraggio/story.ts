/**
 * Movimento da Cerveira Braggio: GSAP e ScrollTrigger do jsDelivr, num único
 * widget HTML que só tem comportamento (o primeiro filho da abertura). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final.
 *
 * Um momento-assinatura, a planta se desenha:
 *
 * 1. Abertura: anotação, título, texto e botões sobem 14px e aparecem; ao mesmo
 *    tempo a moldura da prancha se traça (.cb-frame-*), a quadrícula entra da
 *    esquerda para a direita (.cb-sheet-grid), o retrato chega e a cota com o
 *    nome se estende do centro para as pontas (.cb-hero-cota).
 * 2. Ao rolar: a planta das situações (.cb-plan) se traça uma vez da esquerda
 *    para a direita e os cômodos aparecem em sequência; os blocos marcados com
 *    .cb-rise sobem 18px e aparecem, uma vez, em lote.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 */
export const CB_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-cb-motion')) return;
  root.setAttribute('data-cb-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  // cb-pending esconde a abertura até a entrada; entra antes da primeira pintura
  // (este widget vem antes do conteúdo da abertura) e sai sozinho se o CDN falhar
  root.classList.add('cb-pending');
  function release() { root.classList.remove('cb-pending'); }
  var failsafe = setTimeout(release, 2500);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-cb-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-cb-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }

  /* 1. Abertura: a prancha se desenha */
  function intro(gsap) {
    var hero = $('#inicio');
    if (!hero) return release();
    var items = $$('.cb-intro', hero);
    var across = $$('.cb-frame-t, .cb-frame-b', hero), down = $$('.cb-frame-l, .cb-frame-r', hero);
    var grid = $('.cb-sheet-grid', hero), portrait = $('.cb-portrait', hero);
    var cota = $('.cb-hero-cota', hero), cotaLabel = cota ? $('.cb-cota-label', cota) : null;
    var lines = cota ? $$('.cb-cota-line', cota) : [];
    gsap.set(items, { autoAlpha: 0, y: 14 });
    gsap.set(across, { scaleX: 0 });
    gsap.set(down, { scaleY: 0 });
    if (grid) gsap.set(grid, { clipPath: 'inset(0% 100% 0% 0%)' });
    if (portrait) gsap.set(portrait, { autoAlpha: 0, y: 24 });
    if (lines.length) gsap.set(lines, { scaleX: 0 });
    if (cotaLabel) gsap.set(cotaLabel, { autoAlpha: 0 });
    release();
    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.to(items, { autoAlpha: 1, y: 0, duration: .8, stagger: .08, clearProps: 'transform' }, .05);
    tl.to(across, { scaleX: 1, duration: 1, ease: 'power2.inOut', clearProps: 'transform' }, .1);
    tl.to(down, { scaleY: 1, duration: 1, ease: 'power2.inOut', clearProps: 'transform' }, .25);
    if (grid) tl.to(grid, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power1.inOut', clearProps: 'clipPath' }, .3);
    if (portrait) tl.to(portrait, { autoAlpha: 1, y: 0, duration: 1, clearProps: 'transform' }, .55);
    if (lines.length) tl.to(lines, { scaleX: 1, duration: .9, ease: 'power2.inOut', clearProps: 'transform' }, 1.05);
    if (cotaLabel) tl.to(cotaLabel, { autoAlpha: 1, duration: .5 }, 1.45);
  }

  /* 2. Ao rolar */
  function scroll(gsap, ST) {
    var ctx = null;
    function play(batch, to) {
      var vh = window.innerHeight;
      var inView = batch.filter(function (el) { var r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      var passed = batch.filter(function (el) { return inView.indexOf(el) === -1; });
      if (passed.length) gsap.set(passed, to);
      if (inView.length) gsap.to(inView, Object.assign({ duration: .8, ease: 'power2.out', stagger: Math.min(.08, .5 / inView.length), overwrite: true }, to));
    }
    function build() {
      ctx = gsap.context(function () {
        // o que já passou pelo topo (página recarregada no meio) fica visível
        var visible = function (el) { return el.getBoundingClientRect().bottom > 0; };
        var items = $$('.cb-rise').filter(visible);
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }); },
        });
        // a planta das situações se traça uma vez, e os cômodos chegam em seguida
        $$('.cb-plan').filter(visible).forEach(function (plan) {
          var rooms = $$('.cb-room-in', plan);
          gsap.set(plan, { clipPath: 'inset(0% 100% 0% 0%)' });
          gsap.set(rooms, { autoAlpha: 0, y: 12 });
          ST.create({
            trigger: plan, start: 'top 82%', once: true,
            onEnter: function () {
              gsap.timeline()
                .to(plan, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power2.inOut', clearProps: 'clipPath' })
                .to(rooms, { autoAlpha: 1, y: 0, duration: .6, ease: 'power2.out', stagger: .07, clearProps: 'transform' }, .35);
            },
          });
        });
      });
      ST.refresh();
    }
    function teardown() { if (ctx) { ctx.revert(); ctx = null; } }
    function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }
    // iframe de altura automática (canvas do Space): nada escondido
    function sync() { if (scrollable()) { if (!ctx) build(); } else teardown(); }
    ST.config({ ignoreMobileResize: true });
    var timer = 0;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(sync, 180); });
    sync();
  }

  function start() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    clearTimeout(failsafe);
    try { intro(gsap); } catch (error) { release(); }
    if (!ST) return;
    gsap.registerPlugin(ST);
    try { scroll(gsap, ST); } catch (error) {}
  }

  function boot() {
    (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js')).then(function () {
      var st = window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js').catch(function () {});
      Promise.race([Promise.all([st, fonts()]), wait(1800)]).then(start);
    }, release);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`

/** CSS da abertura enquanto o script arma a entrada (só existe com o script rodando). */
export const CB_PENDING_CSS = [
  'html.cb-pending #inicio .cb-intro,html.cb-pending #inicio .cb-portrait,html.cb-pending #inicio .cb-hero-cota .cb-cota-label{opacity:0}',
  'html.cb-pending #inicio .cb-frame-t,html.cb-pending #inicio .cb-frame-b,html.cb-pending #inicio .cb-hero-cota .cb-cota-line{transform:scaleX(0)}',
  'html.cb-pending #inicio .cb-frame-l,html.cb-pending #inicio .cb-frame-r{transform:scaleY(0)}',
  'html.cb-pending #inicio .cb-sheet-grid{clip-path:inset(0 100% 0 0)}',
].join('')
