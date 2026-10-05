/**
 * Movimento da Fonseca & Lorenço (prospecto): GSAP e ScrollTrigger do
 * jsDelivr, num único widget HTML que só tem comportamento (o primeiro filho
 * da abertura). Todo o conteúdo é nativo e o CSS sem script já é a composição
 * final: marca-texto inteiro, linha do tempo cheia, tudo visível.
 *
 * Um momento-assinatura, o marca-texto passando:
 *
 * 1. Abertura: os itens sobem 14px e aparecem em sequência curta; depois o
 *    degradê do selo corre por trás de "palavras simples".
 * 2. Títulos de seção: o marca-texto corre uma vez quando o título entra.
 *    Os blocos marcados com .fl-rise sobem 16px e aparecem uma vez, em lote.
 * 3. Trajetória: a linha do tempo se preenche com o degradê conforme a
 *    rolagem e acende cada data quando o preenchimento chega nela.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou nas miniaturas
 * do Space (página que não rola), nada é armado e a página aparece pronta.
 */
export const FL_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-fl-motion')) return;
  root.setAttribute('data-fl-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  // fl-pending esconde os itens da abertura até a entrada (este widget é o
  // primeiro filho da abertura, então a classe entra antes da primeira pintura)
  root.classList.add('fl-pending');
  function release() { root.classList.remove('fl-pending'); }
  var failsafe = setTimeout(release, 2600);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-fl-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-fl-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function fonts() { return Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : null, wait(1000)]); }

  /* 1. Abertura */
  function intro(gsap) {
    var hero = $('.fl-hero');
    // a rede demorou e a abertura já apareceu sozinha: não esconde de novo
    if (!hero || !root.classList.contains('fl-pending')) return release();
    var items = $$('.fl-intro', hero);
    var marks = $$('.fl-mark', hero);
    gsap.set(items, { autoAlpha: 0, y: 14 });
    gsap.set(marks, { '--fl-mark': 0 });
    release();
    gsap.timeline({ delay: .05 })
      .to(items, { autoAlpha: 1, y: 0, duration: .75, ease: 'power2.out', stagger: .08, clearProps: 'transform,opacity,visibility' }, 0)
      .to(marks, { '--fl-mark': 1, duration: .9, ease: 'power2.inOut', stagger: .15 }, .45);
  }

  /* 2 e 3. Ao rolar */
  function scroll(gsap, ST) {
    var ctx = null;
    // Um salto (link do menu) junta num lote tudo o que passou: o que já saiu
    // da tela aparece na hora; só o que está visível anima.
    function play(batch, to, duration, ease, each) {
      var vh = window.innerHeight;
      var inView = batch.filter(function (el) { var r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      var passed = batch.filter(function (el) { return inView.indexOf(el) === -1; });
      if (passed.length) gsap.set(passed, to);
      if (inView.length) gsap.to(inView, Object.assign({ duration: duration, ease: ease, stagger: Math.min(each, .5 / inView.length), overwrite: true }, to));
    }
    function below(el) { return el.getBoundingClientRect().top > window.innerHeight * .92; }
    function build() {
      ctx = gsap.context(function () {
        var rise = $$('.fl-rise').filter(function (el) { return !el.closest('.fl-hero') && below(el); });
        gsap.set(rise, { autoAlpha: 0, y: 16 });
        ST.batch(rise, {
          start: 'top 90%', end: 'max', once: true,
          onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }, .75, 'power2.out', .07); },
        });

        var marks = $$('.fl-mark').filter(function (el) { return !el.closest('.fl-hero') && below(el); });
        gsap.set(marks, { '--fl-mark': 0 });
        marks.forEach(function (mark) {
          ST.create({
            trigger: mark, start: 'top 82%', once: true,
            onEnter: function () { gsap.to(mark, { '--fl-mark': 1, duration: .9, ease: 'power2.inOut', delay: .2 }); },
          });
        });

        $$('.fl-timeline').forEach(function (line) {
          var stops = $$('.fl-stop', line);
          var vertical = window.matchMedia('(max-width: 767px)').matches;
          var spots = [];
          function measure() {
            var box = line.getBoundingClientRect();
            spots = stops.map(function (stop) {
              var r = stop.getBoundingClientRect();
              return vertical ? (r.top + 14 - box.top) / box.height : (r.left + 8 - box.left) / box.width;
            });
          }
          function light(p) { stops.forEach(function (stop, i) { stop.classList.toggle('is-lit', p >= spots[i] - .01); }); }
          measure();
          line.classList.add('fl-armed');
          gsap.set(line, { '--fl-fill': 0 });
          light(0);
          gsap.to(line, {
            '--fl-fill': 1, ease: 'none',
            scrollTrigger: {
              trigger: line, start: vertical ? 'top 70%' : 'top 75%', end: vertical ? 'bottom 60%' : 'bottom 45%', scrub: .5,
              onRefresh: measure,
              onUpdate: function (self) { light(self.progress); },
            },
          });
        });
      });
      ST.refresh();
    }
    function teardown() {
      if (ctx) { ctx.revert(); ctx = null; }
      $$('.fl-timeline').forEach(function (line) { line.classList.remove('fl-armed'); });
    }
    function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }
    // iframe de altura automática (canvas do Space): nada escondido
    function sync() { if (scrollable()) { if (!ctx) build(); } else teardown(); }
    ST.config({ ignoreMobileResize: true });
    var timer = 0;
    var wide = window.innerWidth;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        // trocar de celular para desktop muda o sentido da linha do tempo
        if ((wide < 768) !== (window.innerWidth < 768)) { teardown(); }
        wide = window.innerWidth;
        sync();
      }, 180);
    });
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
    // miniatura do canvas do Space: nada roda (o nome é montado aqui para este
    // próprio script não casar com ele)
    if (root.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1) { clearTimeout(failsafe); return release(); }
    (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js')).then(function () {
      var st = window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js').catch(function () {});
      Promise.race([Promise.all([st, fonts()]), wait(2200)]).then(start);
    }, function () { clearTimeout(failsafe); release(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
