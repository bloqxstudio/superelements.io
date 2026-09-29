/**
 * Camada de movimento do modelo MSA: GSAP e ScrollTrigger do jsDelivr, num
 * único widget HTML que só tem comportamento. Todo o conteúdo é nativo e o CSS
 * sem script já é a composição final.
 *
 * O movimento é discreto de propósito:
 *
 * 0. Entrada: painel espresso com a marca; a linha sálvia enche enquanto a
 *    página carrega e o painel sobe, revelando o hero.
 * 1. Hero: navegação, manchete, texto e o Sistema MSA sobem 14px e aparecem,
 *    em sequência curta.
 * 2. Ao rolar: blocos marcados com .msa-rise sobem 18px e aparecem, uma vez,
 *    em lote (cards vizinhos entram em sequência).
 * 3. Henrique: as molduras das fotos abrem uma vez; as duas colunas do
 *    mosaico, cada foto e as duas linhas do nome andam um pouco com o scroll.
 *    Um salto (link do menu) mostra na hora o que ficou para trás.
 * 4. Rodapé: a marca grande sobe devagar com o scroll.
 *
 * Com movimento reduzido, sem GSAP, na prévia estática, no editor do Elementor
 * ou numa página que não rola (as miniaturas do Space), nada é armado e a
 * página aparece pronta.
 */
export const MSA_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-msa-motion')) return;
  root.setAttribute('data-msa-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function previewAllowsMotion() {
    try {
      var loc = window.frameElement ? window.parent.location : window.location;
      if (loc.pathname.indexOf('msa-elementor-preview') === -1) return true;
      return new URLSearchParams(loc.search).get('motion') === 'play';
    } catch (error) { return true; }
  }
  // no editor do Elementor a página fica parada
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor || !previewAllowsMotion()) return;

  // msa-loading mostra o preloader, msa-pending esconde o hero até a entrada;
  // as duas entram antes da primeira pintura (este widget é o primeiro do hero)
  root.classList.add('msa-pending', 'msa-loading');
  function reveal() { root.classList.remove('msa-pending'); }
  function release() { root.classList.remove('msa-pending', 'msa-loading'); }
  var failsafe = setTimeout(release, 3000);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-msa-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-msa-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1200)]); }

  /* 0. Entrada */
  function preloader(gsap) {
    var el = $('.msa-preloader');
    if (!el || !root.classList.contains('msa-loading')) return { ready: Promise.resolve(), exit: function (open) { open(); release(); } };
    var mark = $('.msa-pre-mark', el), name = $('.msa-pre-name', el), bar = $('.msa-pre-bar', el);
    var intro = gsap.timeline({ defaults: { ease: 'power2.out' } })
      .fromTo([mark, name], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .7, stagger: .12 }, 0)
      .fromTo(bar, { '--msa-bar': 0 }, { '--msa-bar': .8, duration: .85, ease: 'power1.inOut' }, .15);
    var ready = new Promise(function (done) { intro.eventCallback('onComplete', done); });
    function exit(open) {
      gsap.timeline({ onComplete: function () { root.classList.remove('msa-loading'); gsap.set(el, { display: 'none' }); } })
        .to(bar, { '--msa-bar': 1, duration: .3, ease: 'power1.out' }, 0)
        .to([mark, name, bar], { opacity: 0, duration: .3, ease: 'power1.in' }, .25)
        .add(open, .4)
        .to(el, { yPercent: -100, duration: .8, ease: 'power3.inOut' }, .4);
    }
    return { ready: ready, exit: exit };
  }

  /* 1. Hero */
  function intro(gsap) {
    var hero = $('.msa-hero');
    if (!hero) return;
    var items = $$('.msa-intro', hero);
    gsap.from(items, { y: 14, autoAlpha: 0, duration: .8, ease: 'power2.out', stagger: .07, delay: .1, clearProps: 'transform' });
  }

  /* 2 e 3. Ao rolar */
  function scroll(gsap, ST) {
    var ctx = null;
    // Um salto (link do menu, rolagem rápida) junta num lote tudo o que passou.
    // O que já saiu da tela aparece na hora; só o que está visível anima, e a
    // sequência inteira cabe em meio segundo.
    function play(batch, to, duration, ease, each) {
      var vh = window.innerHeight;
      var inView = batch.filter(function (el) { var r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      var passed = batch.filter(function (el) { return inView.indexOf(el) === -1; });
      if (passed.length) gsap.set(passed, to);
      if (inView.length) gsap.to(inView, Object.assign({ duration: duration, ease: ease, stagger: Math.min(each, .5 / inView.length), overwrite: true }, to));
    }
    function build() {
      ctx = gsap.context(function () {
        // o que já passou pelo topo (página recarregada no meio) fica visível
        var items = $$('.msa-rise').filter(function (el) { return el.getBoundingClientRect().bottom > 0; });
        gsap.set(items, { autoAlpha: 0, y: 18 });
        ST.batch(items, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }, .8, 'power2.out', .08); },
        });
        // fotos do Henrique: a moldura abre de baixo para cima (uma vez) e a foto
        // anda devagar dentro dela, cada uma numa profundidade
        var frames = $$('.msa-photo').filter(function (el) { return el.getBoundingClientRect().bottom > 0; });
        gsap.set(frames, { clipPath: 'inset(100% 0% 0% 0%)' });
        ST.batch(frames, {
          start: 'top 88%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { clipPath: 'inset(0% 0% 0% 0%)' }, 1.1, 'power3.out', .12); },
        });
        $$('.msa-photo').forEach(function (frame) {
          var img = frame.querySelector('img');
          if (!img) return;
          var depth = frame.classList.contains('msa-depth-3') ? 7 : frame.classList.contains('msa-depth-2') ? 5 : 3.5;
          gsap.fromTo(img, { yPercent: -depth, scale: 1.14 }, { yPercent: depth, scale: 1.14, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
        // mosaico: as duas colunas de fotos andam em sentidos opostos
        var colA = $('.msa-mosaic-a'), colB = $('.msa-mosaic-b');
        if (colA && colB) {
          var across = function () { return { trigger: '.msa-mosaic', start: 'top bottom', end: 'bottom top', scrub: true }; };
          gsap.fromTo(colA, { y: 32 }, { y: -32, ease: 'none', scrollTrigger: across() });
          gsap.fromTo(colB, { y: -24 }, { y: 40, ease: 'none', scrollTrigger: across() });
        }
        // nome: as duas linhas se afastam um pouco enquanto a seção passa
        var first = $('.msa-name-a'), last = $('.msa-name-b');
        if (first && last) {
          var pass = function () { return { trigger: '.msa-name', start: 'top bottom', end: 'bottom top', scrub: true }; };
          gsap.fromTo(first, { x: 28 }, { x: -28, ease: 'none', scrollTrigger: pass() });
          gsap.fromTo(last, { x: -28 }, { x: 28, ease: 'none', scrollTrigger: pass() });
        }
        var mark = $('.msa-footer-mark');
        if (mark) gsap.fromTo(mark, { yPercent: 16 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.msa-footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
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
    try { intro(gsap); } catch (error) {}
    reveal();
    if (!ST) return;
    gsap.registerPlugin(ST);
    try { scroll(gsap, ST); } catch (error) {}
  }

  function boot() {
    // miniatura do canvas do Space: sem preloader. A marca é montada aqui para
    // este próprio script não casar com ela.
    if (root.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1) {
      var cover = $('.msa-preloader');
      if (cover) cover.style.display = 'none';
      root.classList.remove('msa-loading');
    }
    (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js')).then(function () {
      clearTimeout(failsafe);
      var loader = preloader(window.gsap);
      var st = window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js').catch(function () {});
      Promise.race([Promise.all([st, fonts(), loader.ready]), wait(3500)]).then(function () { loader.exit(start); });
    }, release);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
