/**
 * Movimento do hero Evermind, num widget HTML que só tem comportamento (o
 * primeiro filho da seção). Reproduz as interações do Webflow sem biblioteca:
 *
 * 1. Entrada: rótulo, título e o bloco de texto e botões saem de um desfoque
 *    de 12px e aparecem, aos 0,1 s, 0,4 s e 0,6 s, em 0,5 s cada (o desfoque
 *    em outCirc, a opacidade linear), quando o topo entra na tela.
 * 2. Carrossel: a faixa anda a largura dela a cada 20 s, como o original, mas
 *    em volta contínua (o original voltava ao começo com um salto).
 * 3. Parallax: as fotos (120% da moldura) descem de -15% a 0% enquanto a
 *    moldura atravessa a tela, com a suavização de 50% por quadro do IX2.
 *
 * O hover dos botões é só CSS. Com movimento reduzido, no editor do Elementor
 * e nas miniaturas do canvas do Space nada é armado: o CSS já é a composição
 * final, com o carrossel parado no começo.
 */
export const EV_MOTION_SCRIPT = `
(function () {
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;
  var own = document.currentScript && document.currentScript.closest && document.currentScript.closest('.ev-hero');
  var heroes = own ? [own] : [].slice.call(document.querySelectorAll('.ev-hero'));

  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }

  function entrance(hero) {
    var head = hero.querySelector('.ev-head') || hero;
    var started = false;
    function play() {
      if (started) return;
      started = true;
      Promise.race([document.fonts && document.fonts.ready, wait(1200)]).then(function () {
        requestAnimationFrame(function () {
          hero.classList.add('ev-play');
          // terminada a entrada, sai o filtro (e a camada que ele cria)
          setTimeout(function () { hero.classList.remove('ev-armed', 'ev-play'); }, 1400);
        });
      });
    }
    if (!('IntersectionObserver' in window)) return play();
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); play(); }
    });
    io.observe(head);
  }

  function marquee(hero) {
    var track = hero.querySelector('.ev-track');
    var group = hero.querySelector('.ev-group');
    if (!track || !group) return;
    function measure() {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var speed = Math.max(track.clientWidth, 1) / 20;
      hero.style.setProperty('--ev-marquee-time', ((group.offsetWidth + gap) / speed).toFixed(2) + 's');
    }
    measure();
    hero.classList.add('ev-live');
    var timer = 0;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(measure, 150); });
  }

  function parallax(hero) {
    var tile = hero.querySelector('.ev-par');
    var imgs = [].slice.call(hero.querySelectorAll('.ev-par .ev-media img'));
    if (!tile || !imgs.length) return;
    var current = null, goal = 0, last = 0, frame = 0;
    // progresso do IX2 (SCROLLING_IN_VIEW): da moldura entrando por baixo até sair por cima
    function target() {
      var r = tile.getBoundingClientRect();
      var vh = window.innerHeight;
      var span = Math.min(vh + r.height, document.documentElement.scrollHeight);
      var p = Math.min(Math.max(0, vh - r.top), span) / span;
      return -15 + 15 * p;
    }
    function apply(value) {
      var t = 'translate3d(0,' + value.toFixed(3) + '%,0)';
      for (var i = 0; i < imgs.length; i++) imgs[i].style.transform = t;
    }
    function tick(now) {
      frame = 0;
      var k = 1 - Math.pow(0.5, (last ? now - last : 16.7) / 16.7);
      last = now;
      current += (goal - current) * k;
      if (Math.abs(goal - current) < 0.005) { current = goal; last = 0; } else frame = requestAnimationFrame(tick);
      apply(current);
    }
    function update() {
      goal = target();
      if (current === null) { current = goal; apply(current); return; }
      if (!frame) frame = requestAnimationFrame(tick);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  heroes.forEach(function (hero) {
    if (hero.getAttribute('data-ev-motion')) return;
    hero.setAttribute('data-ev-motion', '1');
    // esconde a entrada antes da primeira pintura (este widget é o primeiro da seção)
    hero.classList.add('ev-armed');
    function boot() {
      // miniatura do canvas do Space: fica parado. A marca é montada aqui para
      // este próprio script não casar com ela.
      if (document.documentElement.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1) {
        hero.classList.remove('ev-armed');
        return;
      }
      try { entrance(hero); } catch (error) { hero.classList.remove('ev-armed'); }
      try { marquee(hero); } catch (error) {}
      try { parallax(hero); } catch (error) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  });
})();
`
