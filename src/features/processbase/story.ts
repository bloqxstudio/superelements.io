/**
 * A história da primeira dobra, amarrada ao scroll com GSAP ScrollTrigger:
 *
 * 1. Formação: enquanto o hero sai, `host.pbForm` vai de 0 a 1 e o grafo
 *    (processbaseGraph) leva as ideias até o contorno do logo, reto como a
 *    marca. No fim, o emblema de verdade aparece por baixo dos pontos e o céu
 *    se apaga.
 * 2. Giro: o logo gira e deita em isometria, virando um bloco (`tilt.v` de
 *    0 a 1 no emblem3d).
 * 3. Pilares: cada card sobe e prende por cima do anterior; enquanto ele
 *    chega, a peça do pilar dele no bloco 3D (emblem3d) se enche de laranja
 *    no sentido horário (`fills[k].v` de 0 a 1) e o card de baixo recua. No
 *    quarto, o logo está todo laranja.
 *
 * O logo vai e volta com o scroll (formação, giro, peças e legenda). As
 * seções não trocam de cor: cada uma fica sempre com a sua.
 *
 * Sem GSAP (bloqueado ou offline) ou numa página que não rola (a miniatura
 * do Space), nada roda e fica o estado final: emblema visível e laranja. Com
 * movimento reduzido, não há formação, giro contínuo nem varredura: o logo
 * deita de uma vez e cada peça acende quando o card chega.
 */
export const PROCESSBASE_STORY_SCRIPT = `
(function () {
  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-pb-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-pb-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function gsapReady() {
    return (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js'))
      .then(function () { return window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js'); });
  }
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }

  function story(host) {
    if (host.getAttribute('data-pb-story')) return;
    host.setAttribute('data-pb-story', '1');
    var gsap = window.gsap, ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);
    var sky = host.querySelector('.pb-sky'), emblem = host.querySelector('.pb-emblem'), column = host.querySelector('.pb-story-logo');
    var canvas = host.querySelector('.pb-emblem-canvas'), api = canvas && canvas.pbEmblem;
    var cards = [].slice.call(host.querySelectorAll('.pb-stack-card')), labels = [];
    for (var i = 1; i <= 4; i++) labels.push(host.querySelector('.pb-pillar-label--' + i));
    if (!sky || !emblem || !column || !api || cards.length !== 4) return;
    var fills = api.fills, tilt = api.tilt, paint = function () { api.draw(); };
    var fill = function (k, v) { fills[k].v = v; paint(); };
    var sticky = [column].concat(cards), pos = null, ctx = null;
    var at = function (key) { return function () { return pos[key]; }; };

    // Mede com tudo solto (position: static): preso, o sticky mudaria a conta.
    // Card que não prende (tela baixa) "chega" logo abaixo do logo.
    function measure() {
      var band = (parseFloat(getComputedStyle(column).top) || 0) + column.getBoundingClientRect().height;
      var tops = sticky.map(function (el) {
        var css = getComputedStyle(el);
        return css.position === 'sticky' ? parseFloat(css.top) || 0 : band;
      });
      sticky.forEach(function (el) { el.style.position = 'static'; });
      var y = window.pageYOffset, vh = window.innerHeight;
      var top = function (el) { return el.getBoundingClientRect().top + y; };
      // o logo fica pronto quando o centro dele passa de 70% da tela: logo na entrada da seção
      var formEnd = top(canvas) + canvas.getBoundingClientRect().height / 2 - vh * .7;
      var arrive = cards.map(function (card, k) { return top(card) - tops[k + 1]; });
      // os pontos somem antes do giro pegar, para não descolarem do logo que vira
      var run = Math.min(vh * .28, 260), turn = vh * .28, turnStart = formEnd + vh * .05, turnEnd = turnStart + turn;
      pos = { formStart: Math.max(0, formEnd - vh * .8), formEnd: formEnd, skyEnd: formEnd + vh * .06, turnStart: turnStart, turnEnd: turnEnd };
      // o primeiro card já está ao lado do logo: a Cultura começa no fim do giro;
      // os outros enchem enquanto sobem, sem atropelar o anterior
      var done = turnEnd;
      arrive.forEach(function (end, k) {
        var begin = k ? Math.max(end - run, done) : turnStart + turn * .7;
        var finish = k ? Math.max(end, begin + 1) : Math.max(end, begin + run);
        pos['fill' + k] = begin;
        pos['fill' + k + 'End'] = finish;
        done = finish;
      });
      sticky.forEach(function (el) { el.style.position = ''; });
    }

    function light(k, on) { if (labels[k]) labels[k].classList.toggle('is-on', on); }

    function build() {
      measure();
      ctx = gsap.context(function () {
        // O logo vai e volta com o scroll: formação, giro, peças e legenda.
        if (reduce) {
          gsap.set(emblem, { autoAlpha: 1 });
          tilt.v = 0;
          ST.create({
            start: function () { return (pos.turnStart + pos.turnEnd) / 2; }, end: 'max',
            onToggle: function (self) { tilt.v = self.isActive ? 1 : 0; paint(); },
          });
          ST.create({ start: at('formEnd'), end: 'max', onToggle: function (self) { gsap.set(sky, { autoAlpha: self.isActive ? 0 : 1 }); } });
          cards.forEach(function (card, k) {
            fill(k, 0);
            ST.create({
              start: function () { return (pos['fill' + k] + pos['fill' + k + 'End']) / 2; }, end: 'max',
              onToggle: function (self) {
                fill(k, self.isActive ? 1 : 0);
                if (k) gsap.set(cards[k - 1], { '--pb-dim': self.isActive ? .55 : 0 });
                light(k, self.isActive);
              },
            });
          });
          return;
        }
        var state = { form: 0 };
        host.pbForm = 0;
        gsap.timeline({ scrollTrigger: { start: at('formStart'), end: at('formEnd'), scrub: .6 } })
          .to(state, { form: 1, duration: 1, ease: 'none', onUpdate: function () { host.pbForm = state.form; } }, 0)
          .fromTo(emblem, { autoAlpha: 0 }, { autoAlpha: 1, duration: .15, ease: 'none' }, .85);
        gsap.fromTo(sky, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', scrollTrigger: { start: at('formEnd'), end: at('skyEnd'), scrub: .6 } });
        gsap.fromTo(tilt, { v: 0 }, { v: 1, ease: 'power1.inOut', onUpdate: paint, scrollTrigger: { start: at('turnStart'), end: at('turnEnd'), scrub: .6 } });
        cards.forEach(function (card, k) {
          var tl = gsap.timeline({
            scrollTrigger: {
              start: at('fill' + k), end: at('fill' + k + 'End'), scrub: .5,
              onUpdate: function (self) { light(k, self.progress > .5); },
            },
          });
          tl.fromTo(fills[k], { v: 0 }, { v: 1, ease: 'none', onUpdate: paint }, 0);
          if (k) tl.fromTo(cards[k - 1], { '--pb-dim': 0, scale: 1 }, { '--pb-dim': .55, scale: .95, ease: 'none' }, 0);
        });
      }, host);
      paint();
    }
    function teardown() {
      if (!ctx) return;
      ctx.revert(); ctx = null;
      host.pbForm = 0;
      fills.forEach(function (item) { item.v = 1; });
      tilt.v = 1;
      paint();
      labels.forEach(function (label, k) { light(k, false); });
    }
    // Página que não rola (iframe de altura automática): fica o estado final do CSS.
    function sync() {
      if (scrollable()) { if (!ctx) { build(); ST.refresh(); } }
      else teardown();
    }

    ST.addEventListener('refreshInit', function () { if (ctx) measure(); });
    var wait = 0;
    window.addEventListener('resize', function () { clearTimeout(wait); wait = setTimeout(sync, 150); });
    sync();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (ctx) ST.refresh(); });
  }

  function boot() {
    var hosts = document.querySelectorAll('.pb-story');
    if (!hosts.length) return;
    gsapReady().then(function () { [].forEach.call(hosts, story); }, function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
