/**
 * Movimento da página "Modelo · clinipago", num widget HTML que só tem
 * comportamento (primeiro filho do cabeçalho). Sem biblioteca:
 *
 * 1. Abas do produto: clique (ou setas do teclado) troca o painel. Sempre.
 * 2. Cabeçalho: claro, com vidro, depois do hero. Sempre.
 *
 * O resto só arma numa página que rola, sem movimento reduzido e fora do
 * editor do Elementor (`html.sc-live`); o CSS sozinho já é a composição final.
 *
 * 3. Hero: as palavras do título acendem uma a uma, a foto acende devagar,
 *    o rótulo, o texto e o botão sobem 16px e o card flutuante cresce.
 * 4. Barra fixa embaixo: sobe quando o hero sai da tela.
 * 5. Blocos `.sc-rise` sobem 16px uma vez, ao entrar.
 * 6. Etapas: os nós se marcam um a um e a linha entre eles enche, em volta,
 *    enquanto estão na tela.
 * 7. Régua do agente: a linha enche com a rolagem e os passos ganham o check.
 * 8. Títulos `.sc-reveal`: as palavras escurecem conforme a rolagem.
 */
export const SC_MOTION_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-sc')) return;
  root.setAttribute('data-sc', '1');
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function $$(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function editor() { return !!(document.body && document.body.classList.contains('elementor-editor-active')); }
  function hero() { return document.querySelector('.sc-hero'); }

  /* 1. abas */
  function tabs() {
    $$('.sc-tabbox').forEach(function (box) {
      var list = $$('.sc-tab', box), panels = $$('.sc-panel', box);
      function show(i, focus) {
        list.forEach(function (t, j) { t.classList.toggle('is-on', i === j); t.setAttribute('aria-selected', i === j ? 'true' : 'false'); t.setAttribute('tabindex', i === j ? '0' : '-1'); });
        panels.forEach(function (p, j) { p.classList.toggle('is-on', i === j); });
        if (focus) list[i].focus();
      }
      list.forEach(function (t, i) {
        t.setAttribute('role', 'tab');
        t.addEventListener('click', function () { show(i); });
        t.addEventListener('keydown', function (e) {
          var k = e.key;
          if (k === 'Enter' || k === ' ') { e.preventDefault(); show(i); }
          if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); show((i + 1) % list.length, true); }
          if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); show((i - 1 + list.length) % list.length, true); }
        });
      });
      var wrap = box.querySelector('.sc-tabs');
      if (wrap) wrap.setAttribute('role', 'tablist');
      show(Math.max(0, list.findIndex(function (t) { return t.classList.contains('is-on'); })));
    });
  }

  /* 2. cabeçalho claro depois do hero (e 4. a barra fixa) */
  var headRaf = 0;
  function head() {
    headRaf = 0;
    var h = hero(), y = window.scrollY || 0;
    var edge = h ? h.offsetTop + h.offsetHeight - 72 : 600;
    root.classList.toggle('sc-solid', y > edge);
    if (root.classList.contains('sc-live')) root.classList.toggle('sc-bar-on', y > edge * 0.85);
  }
  addEventListener('scroll', function () { if (!headRaf) headRaf = requestAnimationFrame(head); }, { passive: true });

  /* palavras em spans, sem perder o que já é tag (as quebras e os ícones) */
  function words(el, cls) {
    var out = [];
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\\s+)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var s = document.createElement('span'); s.className = cls; s.textContent = p; frag.appendChild(s); out.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !/sc-ii|sx-i/.test(n.className || '')) walk(n);
        else if (n.nodeType === 1) { n.classList.add(cls); out.push(n); }
      });
    })(el);
    return out;
  }

  /* 3. entrada do hero */
  function intro() {
    var h = hero();
    if (!h) return;
    var title = h.querySelector('.sc-words .elementor-heading-title');
    var list = title ? words(title, 'sc-w') : [];
    function play() {
      h.classList.add('is-play');
      list.forEach(function (w, i) { setTimeout(function () { w.classList.add('is-on'); }, 120 + i * 70); });
    }
    Promise.race([document.fonts && document.fonts.ready, new Promise(function (r) { setTimeout(r, 900); })]).then(function () { requestAnimationFrame(play); });
  }

  /* 5. blocos que sobem */
  function rise() {
    var items = $$('.sc-rise, .sc-band-chip, .sc-big');
    if (!window.IntersectionObserver) { items.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (e) { io.observe(e); });
  }

  /* 6. etapas que avançam sozinhas */
  function steps() {
    $$('.sc-steps').forEach(function (box) {
      var list = $$('.sc-step', box), at = 0, timer = 0, seen = false, STEP = 2400;
      box.style.setProperty('--sc-step', STEP / 1000 + 's');
      function reset() { list.forEach(function (s) { s.classList.remove('is-done', 'is-fill'); }); at = 0; }
      function tick() {
        clearTimeout(timer);
        if (!seen) return;
        if (at >= list.length) { timer = setTimeout(function () { reset(); tick(); }, 1600); return; }
        list[at].classList.add('is-done');
        if (at < list.length - 1) list[at].classList.add('is-fill');
        at++;
        timer = setTimeout(tick, STEP);
      }
      reset();
      new IntersectionObserver(function (es) {
        seen = es[0].isIntersecting;
        if (seen && !timer) tick();
        if (!seen) { clearTimeout(timer); timer = 0; }
      }, { threshold: 0.4 }).observe(box);
    });
  }

  /* 7 e 8. o que acompanha a rolagem */
  var rails = [], reveals = [], raf = 0;
  function scrolled() {
    raf = 0;
    var vh = window.innerHeight;
    rails.forEach(function (r) {
      var b = r.box.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (vh * 0.62 - b.top - 80) / Math.max(1, b.height - 140)));
      r.box.style.setProperty('--sc-rail', p.toFixed(3));
      r.steps.forEach(function (s) { var sb = s.getBoundingClientRect(); s.classList.toggle('is-done', sb.top + 20 < vh * 0.62); });
    });
    reveals.forEach(function (r) {
      var b = r.el.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (vh * 0.85 - b.top) / (vh * 0.45)));
      var n = Math.round(p * r.words.length);
      r.words.forEach(function (w, i) { w.classList.toggle('is-on', i < n); });
    });
  }
  function follow() {
    $$('.sc-timeline').forEach(function (box) { rails.push({ box: box, steps: $$('.sc-st', box) }); });
    $$('.sc-reveal .elementor-heading-title').forEach(function (el) { reveals.push({ el: el, words: words(el, 'sc-rw') }); });
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(scrolled); }, { passive: true });
    addEventListener('resize', scrolled);
    scrolled();
  }

  ready(function () {
    tabs();
    head();
    if (reduce || editor()) return;
    if (document.documentElement.scrollHeight - window.innerHeight < 80) return;
    root.classList.add('sc-live');
    // a faixa corre: as fotos precisam estar prontas antes de entrar na tela
    $$('.sc-marquee img').forEach(function (img) { img.loading = 'eager'; });
    intro();
    rise();
    steps();
    follow();
    head();
  });
})();
`
