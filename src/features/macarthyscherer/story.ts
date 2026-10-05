/**
 * Movimento da Macarthy Scherer: GSAP e ScrollTrigger do jsDelivr, num único
 * widget HTML que só tem comportamento (o primeiro filho da abertura). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final.
 *
 * Um momento-assinatura, o traço do logo:
 *
 * 1. Abertura: rótulo, título, texto, botões e o quadro dos sócios sobem 14px e
 *    aparecem em sequência curta; depois o traço em bronze se desenha do centro
 *    para as pontas, embaixo dos dois nomes, e "Advogados" aparece.
 * 2. Ao rolar: o fio vertical que liga os passos do primeiro contato se desenha
 *    junto com a rolagem (.ms-thread); os blocos marcados com .ms-rise sobem
 *    18px e aparecem, uma vez, em lote.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 */
export const MS_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-ms-motion')) return;
  root.setAttribute('data-ms-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  // ms-pending esconde a abertura até a entrada; entra antes da primeira pintura
  // (este widget vem antes do conteúdo da abertura) e sai sozinho se o CDN falhar
  root.classList.add('ms-pending');
  function release() { root.classList.remove('ms-pending'); }
  var failsafe = setTimeout(release, 2500);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-ms-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-ms-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }

  /* 1. Abertura e o traço */
  function intro(gsap) {
    var items = $$('#inicio .ms-intro');
    var trace = $('#inicio .ms-trace'), label = $('#inicio .ms-trace-label');
    gsap.set(items, { autoAlpha: 0, y: 14 });
    if (trace) gsap.set(trace, { scaleX: 0 });
    if (label) gsap.set(label, { autoAlpha: 0 });
    release();
    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.to(items, { autoAlpha: 1, y: 0, duration: .8, stagger: .08, clearProps: 'transform' }, .05);
    if (trace) tl.to(trace, { scaleX: 1, duration: 1.3, ease: 'power2.inOut', clearProps: 'transform' }, '-=.35');
    if (label) tl.to(label, { autoAlpha: 1, duration: .6 }, '-=.5');
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
        var items = $$('.ms-rise').filter(function (el) { return el.getBoundingClientRect().bottom > 0; });
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }); },
        });
        $$('.ms-thread').forEach(function (thread) {
          var box = thread.closest('.ms-steps') || thread.parentNode;
          gsap.fromTo(thread, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: box, start: 'top 72%', end: 'bottom 62%', scrub: .6 } });
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
export const MS_PENDING_CSS = 'html.ms-pending #inicio .ms-intro,html.ms-pending #inicio .ms-trace-label{opacity:0}html.ms-pending #inicio .ms-trace{transform:scaleX(0)}'
