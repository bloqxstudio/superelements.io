import { DC_ADS } from './tokens'

/**
 * Comportamento da DACM: GSAP e ScrollTrigger do jsDelivr, num único widget
 * HTML que só tem comportamento (o primeiro filho da abertura). Todo o
 * conteúdo é nativo e o CSS sem script já é a composição final.
 *
 * Um momento-assinatura, os quatro quadros se encaixam:
 *
 * 1. Abertura: o título já está na tela desde a primeira pintura (é o que quem
 *    chega pelo anúncio lê primeiro); o texto, os botões e os advogados sobem
 *    14px e aparecem, e ao mesmo tempo os quatro quadros dos assuntos chegam cada um do seu canto
 *    (.dc-q-tl, -tr, -bl, -br) e se encaixam no bloco 2×2 do monograma, os
 *    cinzas primeiro e os azuis depois, como o xadrez do logo.
 * 2. Ao rolar: os quadros das áreas (.dc-q fora da abertura) sobem 18px e
 *    aparecem uma vez, na ordem do xadrez (.dc-q-a antes de .dc-q-b); os
 *    blocos marcados com .dc-rise sobem 18px e aparecem, uma vez, em lote.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 *
 * Medição (vale com ou sem movimento): o clique em qualquer link do WhatsApp
 * entra no dataLayer como `whatsapp_click` e, quando o rótulo da conversão
 * existir no Google Ads (`DC_ADS.whatsappConversion`), dispara a conversão na
 * tag que o site já tem (AW-374493462). A tag em si fica no <head> do site.
 */
export const DC_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-dc-motion')) return;
  root.setAttribute('data-dc-motion', '1');

  /* Medição dos cliques no WhatsApp: os anúncios continuam contando */
  var WA_CONVERSION = ${JSON.stringify(DC_ADS.whatsappConversion)};
  document.addEventListener('click', function (event) {
    var a = event.target && event.target.closest ? event.target.closest('a[href*="wa.me/"], a[href*="api.whatsapp.com"]') : null;
    if (!a) return;
    var where = a.closest('[id]');
    try {
      if (window.dataLayer && window.dataLayer.push) window.dataLayer.push({ event: 'whatsapp_click', whatsapp_section: where ? where.id : '' });
      if (WA_CONVERSION && typeof window.gtag === 'function') window.gtag('event', 'conversion', { send_to: WA_CONVERSION });
    } catch (error) {}
  }, true);

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }

  // dc-pending esconde a abertura até a entrada; entra antes da primeira pintura
  // (este widget vem antes do conteúdo da abertura) e sai sozinho se o CDN falhar
  root.classList.add('dc-pending');
  function release() { root.classList.remove('dc-pending'); }
  var failsafe = setTimeout(release, 1500);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-dc-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-dc-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }

  var FROM = { 'dc-q-tl': [-1, -1], 'dc-q-tr': [1, -1], 'dc-q-bl': [-1, 1], 'dc-q-br': [1, 1] };
  function corner(el) { for (var k in FROM) if (el.classList.contains(k)) return FROM[k]; return [0, 1]; }

  /* 1. Abertura: os quatro quadros se encaixam */
  function intro(gsap) {
    var hero = $('#inicio');
    if (!hero || !scrollable()) return release();
    var items = $$('.dc-intro', hero);
    var quads = $$('.dc-q', hero);
    var gray = quads.filter(function (q) { return q.classList.contains('dc-q-a'); });
    var slate = quads.filter(function (q) { return !q.classList.contains('dc-q-a'); });
    var d = window.innerWidth < 768 ? 16 : 30;
    gsap.set(items, { autoAlpha: 0, y: 14 });
    quads.forEach(function (q) { var c = corner(q); gsap.set(q, { autoAlpha: 0, x: c[0] * d, y: c[1] * d }); });
    release();
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(items, { autoAlpha: 1, y: 0, duration: .8, stagger: .07, ease: 'power2.out', clearProps: 'transform' }, .05);
    tl.to(gray, { autoAlpha: 1, x: 0, y: 0, duration: .9, stagger: .06, clearProps: 'transform' }, .25);
    tl.to(slate, { autoAlpha: 1, x: 0, y: 0, duration: .9, stagger: .06, clearProps: 'transform' }, .45);
  }

  /* 2. Ao rolar */
  function scroll(gsap, ST) {
    var ctx = null;
    function play(batch, to) {
      var vh = window.innerHeight;
      var inView = batch.filter(function (el) { var r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      var passed = batch.filter(function (el) { return inView.indexOf(el) === -1; });
      if (passed.length) gsap.set(passed, to);
      // xadrez: os quadros "a" chegam antes dos "b"
      inView.sort(function (x, y) { return (x.classList.contains('dc-q-b') ? 1 : 0) - (y.classList.contains('dc-q-b') ? 1 : 0); });
      if (inView.length) gsap.to(inView, Object.assign({ duration: .8, ease: 'power2.out', stagger: Math.min(.09, .6 / inView.length), overwrite: true }, to));
    }
    function build() {
      ctx = gsap.context(function () {
        // o que já passou pelo topo (página recarregada no meio) fica visível
        var visible = function (el) { return el.getBoundingClientRect().bottom > 0 && !el.closest('#inicio'); };
        var items = $$('.dc-rise, .dc-q').filter(visible);
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }); },
        });
      });
      ST.refresh();
    }
    function teardown() { if (ctx) { ctx.revert(); ctx = null; } }
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
      Promise.race([Promise.all([st, fonts()]), wait(1000)]).then(start);
    }, release);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`

/** CSS da abertura enquanto o script arma a entrada (só existe com o script rodando). */
export const DC_PENDING_CSS = 'html.dc-pending #inicio .dc-intro,html.dc-pending #inicio .dc-q{opacity:0}'
