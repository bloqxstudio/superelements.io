import { SX_HERO } from './content'

/**
 * Movimento da página modelo (o do jota.ai), num widget HTML que só tem
 * comportamento, o primeiro filho do cabeçalho. Sem biblioteca:
 *
 * 1. Modo agência: a chave do cabeçalho troca o texto e os chips do hero
 *    (guardada no navegador; ?modo=agencia liga por link). Funciona sempre.
 * 2. Cabeçalho: passou de 24px de rolagem, ganha `sx-small` e encolhe pela
 *    metade (o CSS anima; sem movimento, só troca).
 * 3. Setas dos carrosséis andam um card. Funcionam sempre.
 *
 * O resto só arma numa página que rola, sem movimento reduzido e fora do
 * editor do Elementor (as miniaturas do Space não rolam): `html.sx-live`.
 *
 * 4. Painel do hero: o líquido amarelo em WebGL (meia resolução, para fora
 *    da tela ou com a aba escondida); sem WebGL fica o fundo do CSS.
 * 5. Chips: a cada 5 s saem para cima com desfoque e entram outros de baixo,
 *    um de cada vez; todo conjunto mantém um dos três primeiros, em outro
 *    lugar. Param com o mouse, o foco ou o dedo no painel e fora da tela.
 * 6. Retrato que abre: a seção tem 2,8 telas e o palco fica preso; o recorte
 *    sai do retrato e vai até a tela inteira em 70% do caminho, os títulos
 *    saem para os lados e as peças do produto entram uma a uma. Reversível.
 * 7. Conversas dos cards: tocam quando 25% do card aparece e recomeçam em
 *    volta; fora da tela pausam, e depois de 2,5 s fora voltam ao começo.
 * 8. Celular: as pílulas dos planos dão uma puxadinha para mostrar que rolam.
 */
const POOL = JSON.stringify({ empresa: SX_HERO.chips, agencia: SX_HERO.chipsAgency, pool: SX_HERO.chipPool })

export const SX_MOTION_SCRIPT = `
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-sx')) return;
  root.setAttribute('data-sx', '1');
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function $$(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function editor() { return !!(document.body && document.body.classList.contains('elementor-editor-active')); }

  /* 1. modo agência: antes da primeira pintura do hero */
  try {
    var q = /[?&]modo=(agencia|empresa)/.exec(location.search);
    if (q) localStorage.setItem('sx-modo', q[1]);
    if (localStorage.getItem('sx-modo') === 'agencia') root.classList.add('sx-agencia');
  } catch (e) {}
  function mode() {
    $$('.sx-modo').forEach(function (m) {
      var label = m.querySelector('.elementor-heading-title');
      m.setAttribute('role', 'switch');
      m.setAttribute('tabindex', '0');
      if (label) m.setAttribute('aria-label', label.textContent.trim());
      function sync() { m.setAttribute('aria-checked', root.classList.contains('sx-agencia') ? 'true' : 'false'); }
      function flip() {
        var on = !root.classList.contains('sx-agencia');
        root.classList.toggle('sx-agencia', on);
        try { localStorage.setItem('sx-modo', on ? 'agencia' : 'empresa'); } catch (e) {}
        $$('.sx-modo').forEach(function (x) { x.setAttribute('aria-checked', on ? 'true' : 'false'); });
        window.dispatchEvent(new Event('sx:modo'));
      }
      sync();
      m.addEventListener('click', flip);
      m.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    });
  }

  /* 2. cabeçalho que encolhe */
  var navRaf = 0;
  function nav() { navRaf = 0; root.classList.toggle('sx-small', (window.scrollY || 0) > 24); }
  addEventListener('scroll', function () { if (!navRaf) navRaf = requestAnimationFrame(nav); }, { passive: true });
  nav();

  /* 3. setas dos carrosséis */
  function arrows() {
    $$('.sx-rows').forEach(function (sec) {
      var sc = sec.querySelector('.sx-scroller');
      if (!sc) return;
      [['.sx-prev', -1, 'Anterior'], ['.sx-next', 1, 'Próximo']].forEach(function (d) {
        var b = sec.querySelector(d[0]);
        if (!b) return;
        b.setAttribute('role', 'button');
        b.setAttribute('tabindex', '0');
        b.setAttribute('aria-label', d[2]);
        function go() {
          var c = sc.firstElementChild;
          var step = c ? c.getBoundingClientRect().width + (parseFloat(getComputedStyle(sc).columnGap) || 0) : sc.clientWidth;
          sc.scrollBy({ left: step * d[1], behavior: reduce ? 'auto' : 'smooth' });
        }
        b.addEventListener('click', go);
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    });
  }

  /* 4. líquido do painel */
  var FRAG = 'precision mediump float;uniform vec2 r;uniform float t;'
    + 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'
    + 'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}'
    + 'float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}'
    + 'void main(){vec2 uv=gl_FragCoord.xy/r.y*.82;float k=t*.045;'
    + 'vec2 q=vec2(fb(uv+vec2(0.,k)),fb(uv+vec2(5.2,1.3)-k));'
    + 'vec2 w=vec2(fb(uv+3.*q+vec2(1.7,9.2)+k*1.4),fb(uv+3.*q+vec2(8.3,2.8)-k));'
    + 'float f=fb(uv+3.2*w);float s=sin(f*13.+w.x*6.)*.5+.5;'
    + 'vec3 base=vec3(1.,.91,.30),light=vec3(1.,.97,.70),deep=vec3(.98,.73,.10);'
    + 'vec3 c=mix(base,deep,smoothstep(.42,.9,f));c=mix(c,light,smoothstep(.62,1.,s)*.6);c=mix(c,deep*.98,smoothstep(.86,1.,1.-s)*.3);'
    + 'gl_FragColor=vec4(c,1.);}';
  function liquid() {
    $$('.sx-liquid').forEach(function (box) {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) return;
      function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
      var pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(pr, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      var uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't');
      box.appendChild(c);
      var seen = true, raf = 0, t0 = performance.now() - 8000, shown = false;
      function size() {
        var b = box.getBoundingClientRect();
        c.width = Math.max(2, Math.round(b.width * 0.5));
        c.height = Math.max(2, Math.round(b.height * 0.5));
        gl.viewport(0, 0, c.width, c.height);
      }
      function frame(now) {
        raf = 0;
        if (!seen || document.hidden) return;
        gl.uniform2f(uR, c.width, c.height);
        gl.uniform1f(uT, (now - t0) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!shown) { shown = true; c.classList.add('is-on'); }
        raf = requestAnimationFrame(frame);
      }
      function run() { if (!raf && seen && !document.hidden) raf = requestAnimationFrame(frame); }
      size();
      if (window.ResizeObserver) new ResizeObserver(size).observe(box);
      if (window.IntersectionObserver) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; run(); }).observe(box);
      document.addEventListener('visibilitychange', run);
      run();
    });
  }

  /* 5. chips que trocam */
  var DATA = ${POOL};
  function chips() {
    var box = document.querySelector('.sx-chips');
    if (!box || !box.animate) return;
    var panel = box.closest('.sx-panel') || box;
    var EASE = 'cubic-bezier(.2,.8,.2,1)';
    var stop = {}, busy = false, timer = 0, last = 0, at = 0, sets = [], list = [];
    function agency() { return root.classList.contains('sx-agencia'); }
    function pick() { return $$('.sx-chip', box).filter(function (c) { return c.classList.contains(agency() ? 'sx-f' : 'sx-s'); }); }
    function build(first) {
      var names = first.map(function (c) { return c[0]; });
      var pool = DATA.pool.filter(function (c) { return names.indexOf(c[0]) < 0; });
      var out = [first];
      for (var i = 0; i < 12; i++) {
        var set = [pool[(2 * i) % pool.length], pool[(2 * i + 1) % pool.length]];
        set.splice((i % 3 + 1 + (i % 2)) % 3, 0, first[i % 3]);
        out.push(set);
      }
      return out;
    }
    function fill(set) {
      set.forEach(function (c, i) {
        var el = list[i];
        if (!el) return;
        var t = el.querySelector('.sx-chip-text a') || el.querySelector('.sx-chip-text .elementor-heading-title');
        var ic = el.querySelector('.sx-chip-ic');
        var gl = el.querySelector('.sx-chip-glyph');
        if (t) t.textContent = c[0];
        if (ic) ic.style.backgroundColor = c[2];
        if (gl) gl.className = gl.className.replace(/sx-i-[a-zA-Z]+/, 'sx-i-' + c[1]);
      });
    }
    function reset() { list = pick(); sets = build(agency() ? DATA.agencia : DATA.empresa); at = 0; fill(sets[0]); last = 0; tick(); }
    function tick() {
      clearTimeout(timer);
      if (busy || Object.keys(stop).length) return;
      timer = setTimeout(swap, last ? Math.max(0, 5000 - (Date.now() - last)) : 4580);
    }
    function swap() {
      var h0 = box.offsetHeight;
      busy = true; last = Date.now();
      var out = list.map(function (c, i) {
        return c.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-10px)', filter: 'blur(4px)' }],
          { duration: 300, delay: i * 60, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
      });
      out[out.length - 1].finished.then(function () {
        box.style.visibility = 'hidden';
        for (var n = 0; n < sets.length; n++) { at = (at + 1) % sets.length; fill(sets[at]); if (box.offsetHeight === h0) break; }
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          list.forEach(function (c, i) {
            c.animate([{ opacity: 0, transform: 'translateY(16px) scale(.96)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
              { duration: 560, delay: i * 90, easing: EASE, fill: 'backwards' });
          });
          out.forEach(function (a) { a.cancel(); });
          box.style.visibility = '';
          setTimeout(function () { busy = false; tick(); }, 740);
        }); });
      });
    }
    function hold(key, on) { if (on) stop[key] = 1; else delete stop[key]; last = 0; tick(); }
    var touchT = 0;
    panel.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hold('hover', 1); });
    panel.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hold('hover', 0); });
    panel.addEventListener('focusin', function () { hold('focus', 1); });
    panel.addEventListener('focusout', function () { hold('focus', 0); });
    panel.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; hold('touch', 1); clearTimeout(touchT); touchT = setTimeout(function () { hold('touch', 0); }, 8000); });
    document.addEventListener('visibilitychange', function () { hold('hidden', document.hidden); });
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { hold('off', !es[0].isIntersecting); }, { threshold: 0.5 }).observe(panel);
    window.addEventListener('sx:modo', reset);
    reset();
  }

  /* 6. retrato que abre */
  function split() {
    $$('.sx-split').forEach(function (sec) {
      var st = sec.querySelector('.sx-stage'), por = sec.querySelector('.sx-portrait');
      if (!st || !por) return;
      var phone = matchMedia('(max-width:560px)');
      var y0 = 0, run = 1, last = -1, raf = 0;
      function geo() {
        var a = st.getBoundingClientRect(), b = por.getBoundingClientRect(), s = st.style;
        s.setProperty('--ct', (b.top - a.top) + 'px');
        s.setProperty('--cl', (b.left - a.left) + 'px');
        s.setProperty('--cr', (a.right - b.right) + 'px');
        s.setProperty('--cb', (a.bottom - b.bottom) + 'px');
        s.setProperty('--r', getComputedStyle(por).borderTopLeftRadius);
        s.setProperty('--ox', (b.left - a.left + b.width / 2) + 'px');
        s.setProperty('--oy', (b.top - a.top + b.height / 2) + 'px');
        var keep = phone.matches ? 0.35 : 0.2;
        y0 = sec.getBoundingClientRect().top + (window.scrollY || 0);
        run = sec.offsetHeight - st.offsetHeight - st.offsetHeight * keep;
      }
      function tick() {
        raf = 0;
        var p = run > 0 ? Math.min(1, Math.max(0, ((window.scrollY || 0) - y0) / run)) : 1;
        p = Math.round(p * 1e4) / 1e4;
        if (p !== last) { last = p; st.style.setProperty('--p', p); }
      }
      function all() { geo(); tick(); }
      addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
      if (window.ResizeObserver) new ResizeObserver(all).observe(document.body); else addEventListener('resize', all);
      addEventListener('load', all);
      all();
    });
  }

  /* 7. conversas dos cards */
  function talks() {
    if (!window.IntersectionObserver) return;
    $$('.sx-art').forEach(function (art) {
      var on = false, loopT = 0, outT = 0;
      function play() {
        clearTimeout(loopT);
        art.classList.remove('sx-out', 'sx-on', 'sx-paused');
        void art.offsetWidth;
        art.classList.add('sx-on');
        loopT = setTimeout(fade, 9200);
      }
      function fade() { art.classList.add('sx-out'); loopT = setTimeout(play, 650); }
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          clearTimeout(outT);
          if (e.isIntersecting) {
            if (!on) { on = true; play(); }
            else if (art.classList.contains('sx-paused')) { art.classList.remove('sx-paused'); clearTimeout(loopT); loopT = setTimeout(fade, 6000); }
            return;
          }
          if (!on) return;
          art.classList.add('sx-paused');
          clearTimeout(loopT);
          outT = setTimeout(function () { on = false; art.classList.remove('sx-on', 'sx-out', 'sx-paused'); }, 2500);
        });
      }, { threshold: 0.25 }).observe(art);
    });
  }

  /* 8. pílulas no celular */
  function nudge() {
    var s = document.querySelector('.sx-feats');
    if (!s || !window.IntersectionObserver || !matchMedia('(max-width:560px)').matches) return;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      if (s.scrollWidth <= s.clientWidth + 4 || s.scrollLeft) return;
      setTimeout(function () { s.scrollTo({ left: 72, behavior: 'smooth' }); setTimeout(function () { s.scrollTo({ left: 0, behavior: 'smooth' }); }, 650); }, 250);
    }, { threshold: 0.6 });
    io.observe(s);
  }

  ready(function () {
    mode();
    arrows();
    if (reduce || editor()) return;
    // as miniaturas do Space não rolam: ali nada é armado
    if (document.documentElement.scrollHeight - window.innerHeight < 80) return;
    root.classList.add('sx-live');
    liquid();
    chips();
    split();
    talks();
    nudge();
  });
})();
`
