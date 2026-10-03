/**
 * Camada de movimento do Superelements: GSAP e ScrollTrigger do jsDelivr, num
 * único widget HTML (o primeiro filho do hero) que só tem comportamento. Todo
 * o conteúdo é nativo, e o CSS sem script já é a composição final: o canvas
 * do projeto com o botão Publicar no site. O que só a história mostra (cursor,
 * anel do clique, diálogo, aviso de publicada) fica escondido no CSS.
 *
 * 1. Hero: rótulo, manchete, texto e botões sobem 14px e aparecem.
 * 2. Publicar (desktop, a partir de 1025px): a janela chega inclinada e
 *    assenta; presa, ela deixa o scroll conduzir a publicação. A câmera dá
 *    zoom no botão Publicar no site com um holofote em volta, o cursor chega
 *    em arco, o botão acende e o clique solta dois anéis lima. O diálogo sai
 *    do botão, as etapas reais do envio se marcam com a barra enchendo, a
 *    página é publicada, o quadro acende e ganha o selo No site. A régua
 *    embaixo da janela acompanha as quatro etapas. Tudo reversível.
 *    No celular e no tablet não há pin: a sequência curta toca uma vez quando
 *    a janela entra na tela.
 * 3. Ao rolar: blocos .se-rise sobem 18px uma vez, em lote; as linhas das
 *    camadas (.se-link) se desenham; as mensagens do agente (.se-msg) entram
 *    em sequência; a marca grande do rodapé sobe devagar.
 *
 * Com movimento reduzido, sem GSAP, no editor do Elementor ou numa página que
 * não rola (as miniaturas do canvas do Space), nada é armado.
 */
export const SE_STORY_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-se-motion')) return;
  root.setAttribute('data-se-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;
  // o hero fica escondido até a entrada (o CSS lê se-pending); sai sozinho em 2,5 s
  root.classList.add('se-pending');
  setTimeout(function () { root.classList.remove('se-pending'); }, 2500);

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      if (found && found.getAttribute('data-se-loaded')) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-se-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }
  // posição de um elemento dentro de outro, sem as transformações de agora
  function within(el, box) {
    var a = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width, h: a.height };
  }

  /* 1. Hero */
  function release() { root.classList.remove('se-pending'); }
  function intro(gsap) {
    var items = $('.se-hero .se-intro');
    if (items.length) {
      gsap.set(items, { y: 14, autoAlpha: 0 });
      release();
      gsap.to(items, { y: 0, autoAlpha: 1, duration: .8, ease: 'power2.out', stagger: .07, delay: .05, clearProps: 'transform' });
    }
    release();
  }

  /* 2. Publicar */
  function parts(app) {
    var stage = app.closest('.se-stage');
    return {
      app: app,
      stage: stage,
      zoom: $('.se-app-zoom', app),
      btn: $('.se-publish', app),
      ring: $('.se-ring', app),
      ring2: $('.se-ring2', app),
      cursor: $('.se-cursor', app),
      spot: $('.se-spot', app),
      shade: $('.se-shade', app),
      dialog: $('.se-dialog', app),
      form: $('.se-dlg-form', app),
      prog: $('.se-dlg-progress', app),
      done: $('.se-dlg-done', app),
      confirm: $('.se-dlg-confirm', app),
      fill: $('.se-dlg-fill', app),
      steps: $$('.se-step', app),
      labelA: $('.se-publish-a', app),
      labelB: $('.se-publish-b', app),
      chip: $('.se-chip-site', app),
      frame: $('.se-frame', app),
      toast: $('.se-toast', app),
      hud: stage ? $$('.se-hud-step', stage) : [],
      hudFill: stage ? $('.se-hud-fill', stage) : null,
    };
  }
  function only(list) { return list.filter(Boolean); }
  function stepTween(tl, gsap, step, at) {
    var spin = $('.se-step-spin', step), ok = $('.se-step-ok', step);
    tl.fromTo(step, { autoAlpha: .35 }, { autoAlpha: 1, duration: .15 }, at)
      .fromTo(spin, { autoAlpha: 1, rotate: 0 }, { autoAlpha: 0, rotate: 300, duration: .3, ease: 'none' }, at)
      .fromTo(ok, { autoAlpha: 0, scale: .6 }, { autoAlpha: 1, scale: 1, duration: .15, ease: 'back.out(2)' }, at + .25);
  }
  // o clique: o botão afunda e dois anéis lima saem dele
  function click(tl, p, at) {
    tl.to(p.cursor, { scale: .8, duration: .08, ease: 'power1.in' }, at)
      .to(p.cursor, { scale: 1, duration: .16, ease: 'power2.out' }, at + .08)
      .fromTo(p.btn, { scale: 1 }, { scale: .9, duration: .08, yoyo: true, repeat: 1, ease: 'power1.inOut' }, at);
    if (p.ring) tl.fromTo(p.ring, { autoAlpha: 1, scale: .85 }, { autoAlpha: 0, scale: 2.5, duration: .6, ease: 'power2.out' }, at + .04);
    if (p.ring2) tl.fromTo(p.ring2, { autoAlpha: .9, scale: .85 }, { autoAlpha: 0, scale: 1.8, duration: .45, ease: 'power2.out' }, at + .12);
  }
  function finale(tl, gsap, p, at) {
    tl.to(only([p.shade, p.dialog]), { autoAlpha: 0, duration: .3 }, at)
      .fromTo(p.labelA, { autoAlpha: 1 }, { autoAlpha: 0, duration: .2 }, at)
      .fromTo(p.labelB, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: .25 }, at + .1)
      .fromTo(p.chip, { autoAlpha: 0, scale: .6 }, { autoAlpha: 1, scale: 1, duration: .35, ease: 'back.out(2.4)' }, at + .2)
      .fromTo(p.toast, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .4, ease: 'power3.out' }, at + .25)
      .to(p.cursor, { autoAlpha: 0, duration: .3 }, at + .2);
    // o quadro da página acende em lima uma vez: ela está no site
    if (p.frame) tl.fromTo(p.frame, { boxShadow: '0 0 0 0px rgba(210,245,37,0)' }, { boxShadow: '0 0 0 4px rgba(210,245,37,.9)', duration: .25, ease: 'power2.out' }, at + .2)
      .to(p.frame, { boxShadow: '0 0 0 14px rgba(210,245,37,0)', duration: .5, ease: 'power2.out' }, at + .45);
  }

  function desktopStory(gsap, p) {
    var box = p.app.getBoundingClientRect();
    var b = within(p.btn, p.zoom);
    var b1 = within(p.btn, p.app);
    var c = { x: box.width * .5, y: box.height * .42 };
    var s = Math.min(2.4, (box.width * .32) / Math.max(b.w, 1));
    var start = { x: box.width * .4, y: box.height * .8 };
    var confirm = within(p.confirm, p.app);
    var dlg = within(p.dialog, p.app);
    gsap.set(p.zoom, { transformOrigin: '0 0', x: 0, y: 0, scale: 1 });
    gsap.set(p.cursor, { x: start.x, y: start.y, autoAlpha: 0, scale: 1 });
    gsap.set(only([p.shade, p.dialog, p.prog, p.done, p.toast, p.chip, p.labelB, p.ring, p.ring2, p.spot]), { autoAlpha: 0 });
    if (p.spot) gsap.set(p.spot, { '--sx': c.x + 'px', '--sy': c.y + 'px' });
    if (p.fill) gsap.set(p.fill, { scaleX: 0, transformOrigin: '0 50%' });

    var tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    // 01 · a câmera vai até o botão; o cursor chega em arco e o botão acende
    tl.to(p.cursor, { autoAlpha: 1, duration: .25 }, 0)
      .to(p.zoom, { x: c.x - b.x * s, y: c.y - b.y * s, scale: s, duration: 1.4 }, .1)
      .to(p.cursor, { x: (start.x + c.x) / 2 + box.width * .1, y: (start.y + c.y) / 2 + box.height * .08, duration: .7, ease: 'power1.in' }, .25)
      .to(p.cursor, { x: c.x + 8, y: c.y + 6, duration: .65, ease: 'power3.out' }, .95);
    if (p.spot) tl.to(p.spot, { autoAlpha: 1, duration: .6 }, .8);
    tl.to(p.btn, { backgroundColor: '#DDFA47', boxShadow: '0 0 0 7px rgba(210,245,37,.28)', duration: .25 }, 1.45);
    // 02 · o clique
    click(tl, p, 1.75);
    if (p.spot) tl.to(p.spot, { autoAlpha: 0, duration: .35 }, 2.05);
    tl.to(p.btn, { backgroundColor: '#D2F525', boxShadow: '0 0 0 0px rgba(210,245,37,0)', duration: .25 }, 2.05)
      // a câmera volta e o diálogo sai do próprio botão
      .to(p.zoom, { x: 0, y: 0, scale: 1, duration: .75 }, 2.1)
      .to(p.shade, { autoAlpha: 1, duration: .4 }, 2.35)
      .fromTo(p.dialog, { autoAlpha: 0, x: b1.x - dlg.x, y: b1.y - dlg.y, scale: .15 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: .6, ease: 'power3.out' }, 2.4)
      .to(p.cursor, { x: confirm.x + 6, y: confirm.y + 6, duration: .6 }, 2.6)
      .to(p.cursor, { scale: .8, duration: .08 }, 3.25)
      .to(p.cursor, { scale: 1, duration: .14 }, 3.33)
      .fromTo(p.confirm, { scale: 1 }, { scale: .93, duration: .08, yoyo: true, repeat: 1 }, 3.25)
      // 03 · as etapas do envio, com a barra enchendo
      .to(p.form, { autoAlpha: 0, duration: .2 }, 3.5)
      .to(p.prog, { autoAlpha: 1, duration: .2 }, 3.55)
      .to(p.cursor, { autoAlpha: 0, duration: .25 }, 3.55);
    var gap = .42, first = 3.65;
    p.steps.forEach(function (step, i) { stepTween(tl, gsap, step, first + i * gap); });
    var after = first + p.steps.length * gap + .15;
    if (p.fill) tl.to(p.fill, { scaleX: 1, duration: after - first, ease: 'none' }, first);
    tl.to(p.prog, { autoAlpha: 0, duration: .2 }, after)
      .fromTo(p.done, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .3 }, after + .05)
      .to({}, { duration: .6 }, after + .35);
    // 04 · no ar
    finale(tl, gsap, p, after + 1);
    tl.to({}, { duration: .6 });

    // a régua embaixo da janela acompanha as quatro etapas
    var marks = [0, 1.75, first - .1, after + 1];
    p.hud.forEach(function (step, i) {
      var lit = $('.se-hud-lit', step);
      if (!lit) return;
      tl.fromTo(lit, { autoAlpha: 0 }, { autoAlpha: 1, duration: .15, ease: 'none' }, marks[i]);
      if (i < p.hud.length - 1) tl.to(lit, { autoAlpha: 0, duration: .15, ease: 'none' }, marks[i + 1]);
    });
    if (p.hudFill) tl.fromTo(p.hudFill, { scaleX: 0 }, { scaleX: 1, duration: tl.duration(), ease: 'none', transformOrigin: '0 50%' }, 0);
    return tl;
  }

  function mobileStory(gsap, p) {
    var box = p.app.getBoundingClientRect();
    var b = within(p.btn, p.app);
    gsap.set(p.cursor, { x: box.width * .5, y: box.height * .7, autoAlpha: 0 });
    gsap.set(only([p.toast, p.chip, p.labelB, p.ring, p.ring2]), { autoAlpha: 0 });
    var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
    tl.to(p.cursor, { autoAlpha: 1, duration: .2 }, 0)
      .to(p.cursor, { x: b.x, y: b.y, duration: .8, ease: 'power3.out' }, .1);
    click(tl, p, .95);
    finale(tl, gsap, p, 1.3);
    return tl;
  }

  function publish(gsap, ST) {
    var app = $('.se-app');
    if (!app) return;
    var p = parts(app);
    if (!p.zoom || !p.btn || !p.cursor) return;
    var mm = gsap.matchMedia();
    mm.add('(min-width: 1025px)', function () {
      var tl = desktopStory(gsap, p);
      ST.create({
        // um pouco abaixo do centro: a janela inteira fica sob o cabeçalho fixo
        trigger: '.se-stage', start: 'center center+=36', end: '+=3000',
        pin: '.se-stage', pinSpacing: true, anticipatePin: 1, scrub: .6, animation: tl,
      });
      // a janela chega inclinada e assenta quando o pin começa (as medidas acima são sem a inclinação)
      gsap.fromTo(p.app, { rotateX: 14, scale: .93, y: 24, transformPerspective: 1800, transformOrigin: '50% 0%' }, {
        rotateX: 0, scale: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: '.se-stage', start: 'top bottom', end: 'center center+=36', scrub: .4 },
      });
    });
    mm.add('(max-width: 1024px)', function () {
      var tl = mobileStory(gsap, p);
      ST.create({ trigger: app, start: 'top 55%', once: true, onEnter: function () { tl.play(); } });
    });
  }

  /* 3. Ao rolar */
  function scroll(gsap, ST) {
    function play(batch, to, duration, ease, each) {
      var vh = window.innerHeight;
      var inView = batch.filter(function (el) { var r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      var passed = batch.filter(function (el) { return inView.indexOf(el) === -1; });
      if (passed.length) gsap.set(passed, to);
      if (inView.length) gsap.to(inView, Object.assign({ duration: duration, ease: ease, stagger: Math.min(each, .5 / inView.length), overwrite: true }, to));
    }
    var items = $$('.se-rise').filter(function (el) { return el.getBoundingClientRect().bottom > 0; });
    gsap.set(items, { autoAlpha: 0, y: 18 });
    ST.batch(items, {
      start: 'top 90%', end: 'max', once: true,
      onEnter: function (batch) { play(batch, { autoAlpha: 1, y: 0, clearProps: 'transform' }, .8, 'power2.out', .08); },
    });
    // camadas: os fios entre a árvore do Space e o Navigator do Elementor
    $$('.se-links').forEach(function (group) {
      var lines = $$('.se-link', group);
      gsap.fromTo(lines, { scaleX: 0 }, { scaleX: 1, transformOrigin: '0 50%', ease: 'none', stagger: .12, scrollTrigger: { trigger: group, start: 'top 75%', end: 'bottom 45%', scrub: .5 } });
    });
    // agente: as mensagens do painel entram uma a uma, uma vez
    $$('.se-agent').forEach(function (panel) {
      var msgs = $$('.se-msg', panel);
      gsap.set(msgs, { autoAlpha: 0, y: 8 });
      ST.create({ trigger: panel, start: 'top 70%', once: true, onEnter: function () { gsap.to(msgs, { autoAlpha: 1, y: 0, duration: .5, ease: 'power2.out', stagger: .45 }); } });
      var skel = $$('.se-skel', panel.closest('section') || document);
      if (skel.length) ST.create({ trigger: panel, start: 'top 70%', once: true, onEnter: function () { gsap.fromTo(skel, { filter: 'blur(6px)', autoAlpha: .45 }, { filter: 'blur(0px)', autoAlpha: 1, duration: .8, ease: 'power2.out', stagger: .5, delay: .3 }); } });
    });
    var mark = $('.se-footer-mark');
    if (mark) gsap.fromTo(mark, { yPercent: 18 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: mark, start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  function start() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    try { intro(gsap); } catch (error) {}
    if (!ST || !scrollable()) return;
    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });
    try { publish(gsap, ST); } catch (error) {}
    try { scroll(gsap, ST); } catch (error) {}
    var refresh = function () { ST.refresh(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    window.addEventListener('load', refresh);
  }

  function boot() {
    // miniatura do canvas do Space (iframe de altura automática): nada a armar
    if (!scrollable() && window.frameElement) return release();
    (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js'))
      .then(function () { return window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js').catch(function () {}); })
      .then(start, release);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`
