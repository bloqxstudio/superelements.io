/**
 * Movimento da Kátia Paixão: GSAP e ScrollTrigger do jsDelivr, num único
 * widget HTML que só tem comportamento (o primeiro filho da abertura). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final.
 *
 * Um momento-assinatura, o vinho se abre a partir da barra:
 *
 * 1. Abertura: a barra (.kp-seam) se traça de cima para baixo na divisa; o
 *    campo vinho (.kp-field) se abre dela para a esquerda (clip-path); o
 *    retrato (.kp-portrait) chega; rótulo, título, texto, botões e assuntos
 *    (.kp-intro) sobem 14px e aparecem em sequência.
 * 2. Ao rolar: a barra de cada fase (.kp-phase-bar) se traça uma vez, de cima
 *    para baixo; os blocos marcados com .kp-rise sobem 18px e aparecem, uma
 *    vez, em lote.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 */
export const KP_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-kp-motion')) return;
  root.setAttribute('data-kp-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;
  // miniatura do Space: iframe da altura do conteúdo, a página não rola; nada é escondido
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }

  // kp-pending esconde a abertura até a entrada; entra antes da primeira pintura
  // (este widget vem antes do conteúdo da abertura) e sai sozinho se o CDN falhar
  root.classList.add('kp-pending');
  function release() { root.classList.remove('kp-pending'); }
  var failsafe = setTimeout(release, 2500);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-kp-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-kp-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }

  /* 1. Abertura: a barra se traça e o vinho se abre dela */
  function intro(gsap) {
    var hero = $('#inicio');
    if (!hero || !scrollable()) return release();
    var items = $$('.kp-intro', hero);
    var seam = $('.kp-seam', hero), field = $('.kp-field', hero), portrait = $('.kp-portrait', hero);
    gsap.set(items, { autoAlpha: 0, y: 14 });
    if (seam) gsap.set(seam, { scaleY: 0, transformOrigin: '50% 0%' });
    if (field) gsap.set(field, { clipPath: 'inset(0% 0% 0% 100%)' });
    if (portrait) gsap.set(portrait, { autoAlpha: 0, y: 20 });
    release();
    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    if (seam) tl.to(seam, { scaleY: 1, duration: .8, ease: 'power2.inOut', clearProps: 'transform' }, 0);
    if (field) tl.to(field, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut', clearProps: 'clipPath' }, .3);
    if (portrait) tl.to(portrait, { autoAlpha: 1, y: 0, duration: 1, clearProps: 'transform' }, .55);
    tl.to(items, { autoAlpha: 1, y: 0, duration: .8, stagger: .08, clearProps: 'transform' }, .75);
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
        var items = $$('.kp-rise').filter(visible);
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }); },
        });
        // a barra de cada fase se traça uma vez, de cima para baixo
        $$('.kp-phase-bar').filter(visible).forEach(function (bar) {
          gsap.set(bar, { scaleY: 0, transformOrigin: '50% 0%' });
          ST.create({
            trigger: bar, start: 'top 85%', once: true,
            onEnter: function () { gsap.to(bar, { scaleY: 1, duration: 1, ease: 'power2.inOut', clearProps: 'transform' }); },
          });
        });
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
export const KP_PENDING_CSS = [
  'html.kp-pending #inicio .kp-intro,html.kp-pending #inicio .kp-portrait{opacity:0}',
  'html.kp-pending #inicio .kp-seam{transform:scaleY(0);transform-origin:50% 0}',
  'html.kp-pending #inicio .kp-field{clip-path:inset(0 0 0 100%)}',
].join('')
