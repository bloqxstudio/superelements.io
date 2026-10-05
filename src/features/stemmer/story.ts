/**
 * Movimento da Stemmer Advogados: GSAP e ScrollTrigger do jsDelivr, num único
 * widget HTML que só tem comportamento (o primeiro filho da abertura). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final (os quadros dos
 * cartões já marcados de verde, tudo visível).
 *
 * Um momento-assinatura, o ponto é marcado:
 *
 * 1. Abertura: o título, o texto e os botões já estão na tela desde a primeira
 *    pintura (quem vem do anúncio lê na hora, e o carregamento não espera o
 *    CDN); a ficha (.st-intro) sobe 14px, a foto da equipe na fachada chega
 *    (.st-photo) e a ficha é marcada linha a linha: cada quadro numerado se
 *    preenche de verde (.st-row ganha is-punched), como um cartão de ponto batido.
 * 2. Ao rolar: as linhas dos cartões das situações (.st-row) são marcadas uma
 *    a uma quando entram na tela; os blocos .st-rise sobem 18px uma vez.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 */
export const ST_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-st-motion')) return;
  root.setAttribute('data-st-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  // st-pending esconde a abertura até a entrada; entra antes da primeira pintura
  // (este widget vem antes do conteúdo da abertura) e sai sozinho se o CDN falhar
  root.classList.add('st-pending');
  function release() { root.classList.remove('st-pending'); }
  function disarm() { root.classList.remove('st-armed'); }
  var failsafe = setTimeout(function () { release(); disarm(); }, 2500);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-st-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-st-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }
  function punch(rows, gap, first) {
    rows.forEach(function (row, i) { setTimeout(function () { row.classList.add('is-punched'); }, (first || 0) + i * gap); });
  }
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }

  /* 1. Abertura: o escritório bate o ponto */
  function intro(gsap) {
    var hero = $('#inicio');
    if (!hero) return release();
    var items = $$('.st-intro', hero);
    var photo = $('.st-photo', hero);
    var rows = $$('.st-row', hero);
    gsap.set(items, { autoAlpha: 0, y: 14 });
    if (photo) gsap.set(photo, { autoAlpha: 0, y: 20 });
    release();
    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.to(items, { autoAlpha: 1, y: 0, duration: .8, stagger: .08, clearProps: 'transform' }, .05);
    if (photo) tl.to(photo, { autoAlpha: 1, y: 0, duration: 1, clearProps: 'transform' }, .3);
    // a ficha: cada linha marcada em sequência depois que a foto chega
    punch(rows, 180, 900);
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
        // o que já passou pelo topo (página recarregada no meio) fica pronto
        var visible = function (el) { return el.getBoundingClientRect().bottom > 0; };
        var items = $$('.st-rise').filter(visible);
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }); },
        });
        // linhas dos cartões: marcadas uma a uma ao entrar
        var hero = $('#inicio');
        var rows = $$('.st-row').filter(function (el) { return !(hero && hero.contains(el)); });
        rows.filter(function (el) { return !visible(el); }).forEach(function (el) { el.classList.add('is-punched'); });
        ST.batch(rows.filter(visible), {
          start: 'top 85%', end: 'max', once: true,
          onEnter: function (batch) { punch(batch, 140, 120); },
        });
      });
      ST.refresh();
    }
    function teardown() {
      if (ctx) { ctx.revert(); ctx = null; }
      $$('.st-row').forEach(function (el) { el.classList.add('is-punched'); });
      disarm();
    }
    // iframe de altura automática (canvas do Space): nada escondido, tudo marcado
    function sync() { if (scrollable()) { if (!ctx && root.classList.contains('st-armed')) build(); } else teardown(); }
    ST.config({ ignoreMobileResize: true });
    var timer = 0;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(sync, 180); });
    sync();
  }

  function start() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    clearTimeout(failsafe);
    if (!ST || !scrollable()) disarm();
    try { intro(gsap); } catch (error) { release(); disarm(); }
    if (!ST) return;
    gsap.registerPlugin(ST);
    try { scroll(gsap, ST); } catch (error) { disarm(); }
  }

  function boot() {
    // os quadros ficam vazios até serem marcados (só com o script rodando numa página que rola)
    if (scrollable()) root.classList.add('st-armed');
    (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js')).then(function () {
      var st = window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js').catch(function () {});
      Promise.race([Promise.all([st, fonts()]), wait(1800)]).then(start);
    }, function () { release(); disarm(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`

/** CSS da abertura enquanto o script arma a entrada (só existe com o script rodando). */
export const ST_PENDING_CSS = [
  'html.st-pending #inicio .st-intro,html.st-pending #inicio .st-photo{opacity:0}',
].join('')
