/**
 * Movimento da Ferreira & Bordinhão: GSAP e ScrollTrigger do jsDelivr, num
 * único widget HTML que só tem comportamento (o primeiro filho da abertura).
 * Todo o conteúdo é nativo e o CSS sem script já é a composição final.
 *
 * Um momento-assinatura, os números da lei rolam até o valor, como as bandas
 * de um carimbo datador:
 *
 * 1. Abertura: rótulo, título, texto, botões e as linhas do quadro "Está na
 *    lei" sobem 14px e aparecem; em seguida os algarismos de cada número do
 *    quadro (.fb-roll) giram e param no valor da lei ("10 dias", "2 anos").
 * 2. Ao rolar: os números das situações rolam do mesmo jeito, uma vez, quando
 *    o cartão entra; os blocos marcados com .fb-rise sobem 18px e aparecem,
 *    uma vez, em lote.
 *
 * Os algarismos são trocados por faixas só durante o giro; no fim o título
 * volta a ser exatamente o texto do widget. Com movimento reduzido, sem GSAP,
 * no editor do Elementor ou numa página que não rola (as miniaturas e as
 * fotos do Space), nada é armado e a página aparece pronta.
 */
export const FB_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-fb-motion')) return;
  root.setAttribute('data-fb-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  // fb-pending esconde a abertura até a entrada; entra antes da primeira pintura
  // (este widget vem antes do conteúdo da abertura) e sai sozinho se o CDN falhar
  root.classList.add('fb-pending');
  function release() { root.classList.remove('fb-pending'); }
  var failsafe = setTimeout(release, 2500);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-fb-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-fb-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }

  /*
   * O carimbo datador: cada algarismo do título vira uma faixa 0–9, 0–n que
   * gira para cima até parar no algarismo certo; o resto ("dias", "%") aparece
   * junto. prepare() troca o texto pelas faixas (paradas no 0) e devolve
   * play(delay); no fim do giro o título volta ao texto original.
   */
  function prepare(gsap, widget) {
    var title = widget.querySelector('.elementor-heading-title');
    if (!title || title.getAttribute('data-fb-rolled')) return null;
    title.setAttribute('data-fb-rolled', '1');
    var original = title.innerHTML, label = title.textContent;
    if (!/[0-9]/.test(label)) return null;
    var html = '', strips = [], digits = 0;
    label.split('').forEach(function (ch) {
      if (/[0-9]/.test(ch)) {
        var n = +ch, seq = [];
        for (var i = 0; i < 10; i++) seq.push(i);
        for (var j = 0; j <= n; j++) seq.push(j);
        html += '<span class="fb-slot" aria-hidden="true"><span class="fb-strip" data-steps="' + seq.length + '" data-target="' + (seq.length - 1) + '">' + seq.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</span></span>';
        digits++;
      } else {
        html += '<span class="fb-rest" aria-hidden="true">' + (ch === ' ' ? '&nbsp;' : ch.replace(/&/g, '&amp;').replace(/</g, '&lt;')) + '</span>';
      }
    });
    title.setAttribute('aria-label', label);
    title.innerHTML = html;
    var rest = $$('.fb-rest', title);
    if (rest.length) gsap.set(rest, { autoAlpha: 0 });
    function restore() { title.innerHTML = original; title.removeAttribute('aria-label'); }
    return { restore: restore, play: function (delay) {
    var tl = gsap.timeline({ delay: delay || 0, onComplete: restore });
    $$('.fb-strip', title).forEach(function (strip, index) {
      var steps = +strip.getAttribute('data-steps'), target = +strip.getAttribute('data-target');
      tl.fromTo(strip, { yPercent: 0 }, { yPercent: -100 * target / steps, duration: 1.05 + index * .12, ease: 'power3.out' }, index * .06);
    });
    if (rest.length) tl.to(rest, { autoAlpha: 1, duration: .5, ease: 'power1.out' }, .25);
    return tl;
    } };
  }

  /* 1. Abertura */
  function intro(gsap) {
    var hero = $('#inicio');
    if (!hero) return release();
    var items = $$('.fb-intro', hero);
    gsap.set(items, { autoAlpha: 0, y: 14 });
    release();
    gsap.to(items, { autoAlpha: 1, y: 0, duration: .8, ease: 'power2.out', stagger: .07, clearProps: 'transform' });
    $$('.fb-roll', hero).forEach(function (widget, index) { var r = prepare(gsap, widget); if (r) r.play(.45 + index * .14); });
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
        // o que já passou pelo topo (página recarregada no meio) fica como está
        var below = function (el) { return el.getBoundingClientRect().top > window.innerHeight * .9; };
        var items = $$('.fb-rise').filter(below);
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }); },
        });
        // os números das situações ficam parados no 0 e rolam uma vez, quando o cartão entra
        $$('.fb-roll').filter(function (el) { return !el.closest('#inicio') && below(el); }).forEach(function (widget) {
          var r = prepare(gsap, widget);
          if (!r) return;
          prepared.push(r);
          ST.create({ trigger: widget, start: 'top 88%', once: true, onEnter: function () { r.play(.1); } });
        });
      });
      ST.refresh();
    }
    var prepared = [];
    // sem rolagem (a página encolheu): os números voltam ao texto e nada fica escondido
    function teardown() { if (ctx) { ctx.revert(); ctx = null; } prepared.forEach(function (r) { r.restore(); }); prepared = []; }
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
    // miniatura ou foto do Space (a página não rola): fica pronta, sem giro
    if (!scrollable()) return release();
    try { intro(gsap); } catch (error) { release(); }
    if (!ST) return;
    gsap.registerPlugin(ST);
    try { scroll(gsap, ST); } catch (error) {}
  }

  function boot() {
    if (!scrollable() && root.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1) { clearTimeout(failsafe); return release(); }
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
export const FB_PENDING_CSS = 'html.fb-pending #inicio .fb-intro{opacity:0}'

/** Faixas dos algarismos durante o giro: uma janela de 1em por algarismo. Vai em toda seção com `.fb-roll`. */
export const FB_ROLL_CSS = [
  'selector .fb-roll .fb-slot{display:inline-block;height:1em;line-height:1em;overflow:hidden;vertical-align:top}',
  'selector .fb-roll .fb-strip{display:block;will-change:transform}selector .fb-roll .fb-strip>span{display:block;height:1em;line-height:1em}',
  'selector .fb-roll .fb-rest{display:inline-block;line-height:1em;vertical-align:top}',
].join('')
