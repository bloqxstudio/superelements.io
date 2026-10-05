/**
 * Movimento da Emmanuel Becker Advocacia: GSAP e ScrollTrigger do jsDelivr, num
 * único widget HTML que só tem comportamento (o primeiro filho da abertura).
 * Todo o conteúdo é nativo e o CSS sem script já é a composição final (a grade
 * com CASO e SOLUÇÃO achadas, as palavras circuladas, tudo visível).
 *
 * Um momento-assinatura, o caso se encontra:
 *
 * 1. Abertura: rótulo, título, texto, botões e a assinatura sobem 14px e
 *    aparecem; as letras da grade se embaralham e assentam numa onda da
 *    esquerda para a direita; depois CASO e SOLUÇÃO se acendem em vermelho,
 *    letra por letra, e o anel se fecha em volta de cada uma. No celular, onde
 *    a grade fica abaixo da dobra, isso começa quando ela aparece na tela.
 * 2. Ao rolar: a palavra circulada de cada situação (.erb-w) se embaralha e
 *    assenta uma vez, quando a linha entra na tela, e o anel se fecha; os
 *    blocos marcados com .erb-rise sobem 18px e aparecem, uma vez, em lote.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do Space), nada é armado e a página aparece pronta.
 * A monoespaçada faz o embaralhado não mexer em nada em volta: toda letra tem
 * a mesma largura.
 */
export const ERB_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-erb-motion')) return;
  root.setAttribute('data-erb-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  // erb-pending esconde a abertura até a entrada; entra antes da primeira pintura
  // (este widget vem antes do conteúdo da abertura) e sai sozinho se o CDN falhar
  root.classList.add('erb-pending');
  function release() { root.classList.remove('erb-pending'); }
  var failsafe = setTimeout(release, 2500);

  var ABC = 'ABCDEFGHIJLMNOPQRSTUVXZÇÃÉÍÓ';
  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function rnd() { return ABC.charAt(Math.floor(Math.random() * ABC.length)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-erb-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-erb-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }

  /*
   * Embaralha as letras (cada uma assenta no seu tempo) e devolve o texto final
   * exato no fim. cells: [{ el, final, at }] com at em ms desde o início.
   */
  function scramble(cells, done) {
    var start = 0, last = 0, end = 0;
    cells.forEach(function (c) { if (c.at > end) end = c.at; });
    function frame(now) {
      if (!start) start = now;
      var t = now - start, tick = now - last > 55;
      if (tick) last = now;
      cells.forEach(function (c) {
        if (c.settled) return;
        if (t >= c.at) { c.el.textContent = c.final; c.settled = true; }
        else if (tick) c.el.textContent = rnd();
      });
      if (t < end + 16) requestAnimationFrame(frame);
      else { cells.forEach(function (c) { c.el.textContent = c.final; }); if (done) done(); }
    }
    requestAnimationFrame(frame);
  }

  /* 1. Abertura: as letras se embaralham e o caso se encontra */
  function intro(gsap) {
    var hero = $('#inicio');
    if (!hero) return release();
    var items = $$('.erb-intro', hero);
    var puzzle = $('.erb-grid', hero);
    gsap.set(items, { autoAlpha: 0, y: 14 });
    if (puzzle) puzzle.classList.add('erb-armed');
    release();
    gsap.to(items, { autoAlpha: 1, y: 0, duration: .8, ease: 'power2.out', stagger: .08, delay: .05, clearProps: 'transform' });
    if (!puzzle) return;
    var rows = $$('.erb-gr', puzzle);
    var cells = [];
    rows.forEach(function (row, r) {
      $$('.erb-l', row).forEach(function (el, c) {
        cells.push({ el: el, final: el.textContent, at: 260 + c * 46 + r * 28 + Math.random() * 90 });
      });
    });
    // no celular a grade fica abaixo da dobra: o caso se encontra quando ela aparece
    function run() { scramble(cells, found); }
    var box = puzzle.getBoundingClientRect();
    if (box.top < window.innerHeight * .75 || !('IntersectionObserver' in window)) run();
    else {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        cells.forEach(function (c) { c.at -= 200; });
        run();
      }, { threshold: .45 });
      io.observe(puzzle);
    }
    function found() {
      var words = $$('.erb-gf', puzzle);
      var delay = 120;
      words.forEach(function (word) {
        var letters = $$('.erb-l', word);
        letters.forEach(function (el, i) { setTimeout(function () { el.classList.add('is-lit'); }, delay + i * 85); });
        setTimeout(function () { word.classList.add('is-found'); }, delay + letters.length * 85 + 60);
        delay += letters.length * 85 + 420;
      });
      // no fim, a grade volta a ser só o CSS (idêntico ao que está na tela)
      setTimeout(function () {
        puzzle.classList.remove('erb-armed');
        $$('.is-lit', puzzle).forEach(function (el) { el.classList.remove('is-lit'); });
        $$('.is-found', puzzle).forEach(function (el) { el.classList.remove('is-found'); });
      }, delay + 900);
    }
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
    function findWord(word) {
      if (word.getAttribute('data-erb-found')) return;
      word.setAttribute('data-erb-found', '1');
      var final = word.textContent;
      // a palavra inteira embaralha como um bloco: troca o texto todo a cada quadro
      var n = final.length, start = 0, last = 0;
      function frame(now) {
        if (!start) start = now;
        var t = now - start;
        if (t >= 420) { word.textContent = final; word.classList.remove('erb-w-armed'); return; }
        if (now - last > 55) {
          last = now;
          var keep = Math.floor((t / 420) * n), s = final.slice(0, keep);
          for (var i = keep; i < n; i++) { var ch = final.charAt(i); s += ch === ' ' ? ' ' : ch === ch.toLowerCase() ? rnd().toLowerCase() : rnd(); }
          word.textContent = s;
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    function build() {
      ctx = gsap.context(function () {
        // o que já passou pelo topo (página recarregada no meio) fica visível
        var visible = function (el) { return el.getBoundingClientRect().bottom > 0; };
        var items = $$('.erb-rise').filter(visible);
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }); },
        });
        // a palavra de cada situação se embaralha e é achada, uma vez
        var vh = window.innerHeight;
        $$('#situacoes .erb-w').filter(function (w) { return w.getBoundingClientRect().top > vh * .9; }).forEach(function (word) {
          word.classList.add('erb-w-armed');
          ST.create({ trigger: word, start: 'top 88%', once: true, onEnter: function () { findWord(word); } });
        });
      });
      ST.refresh();
    }
    function teardown() {
      if (ctx) { ctx.revert(); ctx = null; }
      $$('.erb-w-armed').forEach(function (w) { w.classList.remove('erb-w-armed'); });
    }
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
    if (!scrollable()) return release();
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

/**
 * CSS da abertura enquanto o script arma a entrada (só existe com o script
 * rodando) e dos estados da grade: armada, letras acesas e palavra achada.
 */
export const ERB_PENDING_CSS = [
  'html.erb-pending #inicio .erb-intro{opacity:0}',
  'html.erb-pending #inicio .erb-gf .erb-l{color:rgba(255,255,255,.17)!important}html.erb-pending #inicio .erb-gf::before{opacity:0}',
  'selector .erb-grid.erb-armed .erb-gf .erb-l{color:rgba(255,255,255,.17);font-weight:500}',
  'selector .erb-grid.erb-armed .erb-gf .erb-l.is-lit{color:#ee5054;font-weight:600}',
  'selector .erb-grid.erb-armed .erb-gf::before{opacity:0;transform:scaleX(.6)}',
  'selector .erb-grid.erb-armed .erb-gf.is-found::before{opacity:1;transform:none}',
  '@media(prefers-reduced-motion:no-preference){selector .erb-gf::before{transition:opacity 260ms ease,transform 420ms cubic-bezier(.2,0,0,1)}selector .erb-gf .erb-l{transition:color 160ms ease}}',
].join('')

/** CSS da palavra circulada das situações enquanto espera a vez (só com o script rodando). */
export const ERB_WORD_CSS = [
  'selector .erb-w.erb-w-armed{color:inherit}',
  'selector .erb-w.erb-w-armed::before{opacity:0;transform:scaleX(.7)}',
  '@media(prefers-reduced-motion:no-preference){selector .erb-w::before{transition:opacity 240ms ease,transform 380ms cubic-bezier(.2,0,0,1)}selector .erb-w{transition:color 200ms ease}}',
].join('')
