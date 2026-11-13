/**
 * A história da tela do produto (página Modelo · misto), num widget HTML que
 * só tem comportamento. GSAP e ScrollTrigger vêm do jsDelivr.
 *
 * O que acontece, como no produto (src/features/space/chat, AgentCursors,
 * SectionNode, WordPressPublishDialog):
 *   01 Você pede: a Abertura está selecionada, o pedido é digitado na aba
 *      Agente e enviado com a seleção junto.
 *   02 O agente muda a página: o cursor do Claude Code lê a página, a
 *      Abertura fica borrada com a varredura enquanto ele reescreve o título
 *      e volta nítida com "Claude Code mudou"; o Clube do Banho entra depois
 *      de Serviços em esqueleto borrado e revela com "Claude Code criou". Cada
 *      ação vira um passo na conversa, e a resposta chega digitando.
 *   03 Você confere e pede para publicar.
 *   04 Publicado no site: o cursor vai até Atualizar (a câmera chega perto),
 *      clica, o diálogo de publicar sai do botão, roda as etapas reais e
 *      fecha; a página acende e a conversa confirma.
 *
 * No desktop (1025px ou mais) a janela fixa na tela e o scroll conduz, para
 * frente e para trás. Abaixo disso a história toca uma vez quando a janela
 * aparece. O CSS sozinho já é o fim da história: com movimento reduzido, no
 * editor do Elementor e nas miniaturas do Space (página que não rola) nada roda.
 */
export const MS_MOTION_SCRIPT = `<script>
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-ms-motion')) return;
  root.setAttribute('data-ms-motion', '1');

  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var editor = !!(document.body && document.body.classList.contains('elementor-editor-active'));
  if (reduce || editor) return;

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); }
  function load(src) {
    return new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"]');
      var ready = src.indexOf('ScrollTrigger') > -1 ? window.ScrollTrigger : window.gsap;
      if (ready || (found && found.getAttribute('data-ms-loaded'))) return resolve();
      var el = found || document.createElement('script');
      el.addEventListener('load', function () { el.setAttribute('data-ms-loaded', '1'); resolve(); });
      el.addEventListener('error', reject);
      if (!found) { el.src = src; el.async = true; document.head.appendChild(el); }
    });
  }
  function scrollable() { return document.documentElement.scrollHeight - window.innerHeight > 80; }

  /* o texto chega letra por letra; as letras escondidas já ocupam o lugar, então nada pula */
  var CARET_CSS = 'display:inline-block;width:7px;height:1em;margin-left:2px;vertical-align:-0.15em;border-radius:1px;background:currentColor;opacity:.55';
  function typer(widget) {
    var host = $('.elementor-heading-title', widget) || $('.elementor-widget-container', widget) || widget;
    var original = host.innerHTML;
    var chars = [];
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.nodeValue.split('').forEach(function (c) {
            var s = document.createElement('span');
            s.textContent = c;
            frag.appendChild(s);
            chars.push(s);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
      });
    })(host);
    var caret = document.createElement('span');
    caret.setAttribute('aria-hidden', 'true');
    caret.style.cssText = CARET_CSS;
    var shown = -1;
    return {
      n: chars.length,
      show: function (k, withCaret) {
        k = Math.max(0, Math.min(chars.length, Math.round(k)));
        if (k !== shown) {
          for (var i = 0; i < chars.length; i++) chars[i].style.visibility = i < k ? '' : 'hidden';
          shown = k;
        }
        if (withCaret && k > 0 && k < chars.length) chars[k - 1].after(caret);
        else if (caret.parentNode) caret.parentNode.removeChild(caret);
      },
      restore: function () { host.innerHTML = original; },
    };
  }

  function parts(app) {
    var q = function (s) { return $(s, app); };
    var qa = function (s) { return $$(s, app); };
    function agent(m) {
      return { el: m, list: $('.ms-steps', m), steps: $$('.ms-st', m), thinkA: $('.ms-think-a', m), thinkB: $('.ms-think-b', m), reply: $('.ms-reply', m), usage: $('.ms-usage', m) };
    }
    return {
      app: app, stage: app.closest('.ms-stage'), cam: q('.ms-cam'), canvas: q('.ms-canvas'), world: q('.ms-world'), sheet: q('.ms-sheet'),
      hero: q('.ms-sec-hero'), heroBody: q('.ms-sec-hero .ms-sec-body'), titleOld: q('.ms-title-old'), titleNew: q('.ms-title-new'),
      heroV: qa('.ms-sec-hero .ms-out-v, .ms-sec-hero .ms-lab-v, .ms-sec-hero .ms-tools'),
      heroA: qa('.ms-sec-hero .ms-out-a, .ms-sec-hero .ms-lab-a'), heroSuffix: q('.ms-sec-hero .ms-lab-suffix'), heroScan: q('.ms-sec-hero .ms-scan'),
      neu: q('.ms-sec-new'), neuBody: q('.ms-sec-new .ms-sec-body'), neuA: qa('.ms-sec-new .ms-out-a, .ms-sec-new .ms-lab-a'), neuSuffix: q('.ms-sec-new .ms-lab-suffix'), neuScan: q('.ms-sec-new .ms-scan'),
      building: q('.ms-building'), dims: [q('.ms-dims-old'), q('.ms-dims-new')], count: [q('.ms-count-old'), q('.ms-count-new')], globe: q('.ms-globe'),
      chip: { page: q('.ms-chip-page'), sec: q('.ms-chip-sec') },
      ph: { page: q('.ms-ph-page'), sec: q('.ms-ph-sec'), busy: q('.ms-ph-busy') },
      draft1: q('.ms-draft-1'), draft2: q('.ms-draft-2'),
      send: { off: q('.ms-send-off'), on: q('.ms-send-on'), stop: q('.ms-send-stop') },
      title: [q('.ms-ct-0'), q('.ms-ct-1')], sum: [0, 1, 2, 3].map(function (i) { return q('.ms-cs-' + i); }),
      empty: q('.ms-empty'), u1: q('.ms-u1'), u2: q('.ms-u2'), a1: agent(q('.ms-a1')), a2: agent(q('.ms-a2')),
      cur: q('.ms-cur'), arrow: q('.ms-cur-arrow'), click: q('.ms-click'), tips: qa('.ms-tip'),
      pub: q('.ms-pub'), pubA: q('.ms-pub-a'), ring: q('.ms-ring'), ring2: q('.ms-ring2'),
      shade: q('.ms-shade'), dlg: q('.ms-dlg'), form: q('.ms-dlg-form'), work: q('.ms-dlg-work'), done: q('.ms-dlg-done'),
      dt: [q('.ms-dt-0'), q('.ms-dt-1')], dd: [q('.ms-dd-0'), q('.ms-dd-1')], foot: [q('.ms-foot-form'), q('.ms-foot-done')],
      confirm: q('.ms-confirm'), close: q('.ms-close'), ws: qa('.ms-ws'),
      hud: p_hud(app),
    };
  }
  function p_hud(app) {
    var stage = app.closest('.ms-stage');
    return stage ? { steps: $$('.ms-hud-step', stage), fill: $('.ms-hud-fill', stage) } : { steps: [], fill: null };
  }

  /* medidas sem nenhuma transformação: centro e caixa de cada peça dentro da janela */
  function measure(gsap, p) {
    gsap.set([p.cam, p.world, p.app, p.dlg], { clearProps: 'transform' });
    gsap.set(p.neu, { clearProps: 'height' });
    var a = p.app.getBoundingClientRect();
    function rel(el) {
      var r = el.getBoundingClientRect();
      return { l: r.left - a.left, t: r.top - a.top, w: r.width, h: r.height, x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
    }
    var neuH = parseFloat(getComputedStyle(p.neu).height);
    var confirm = rel(p.confirm), dlg = rel(p.dlg);
    gsap.set([p.form, p.foot[0]], { display: 'none' });
    gsap.set([p.done, p.foot[1]], { display: 'flex' });
    var close = rel(p.close);
    gsap.set([p.form, p.done, p.foot[0], p.foot[1]], { clearProps: 'display' });
    var canvas = rel(p.canvas), neu = rel(p.neu);
    // a seção nova no meio do canvas (sem passar do começo da página)
    var pan = Math.min(0, Math.round(canvas.t + canvas.h * 0.5 - neu.y));
    return {
      w: a.width, h: a.height, canvas: canvas, hero: rel(p.hero), title: rel(p.titleOld), neu: neu, pan: pan,
      neuH: neuH > 50 ? neuH : 614, pub: rel(p.pubA), dlg: dlg, confirm: confirm, close: close,
    };
  }

  /* estado do começo: a Abertura selecionada, a conversa vazia, a página antes das mudanças */
  function begin(gsap, p) {
    gsap.set(p.titleNew, { autoAlpha: 0 });
    gsap.set(p.titleOld, { autoAlpha: 1 });
    gsap.set(p.heroV, { autoAlpha: 1 });
    gsap.set(p.heroA.concat(p.neuA, [p.heroScan, p.neuScan]), { autoAlpha: 0 });
    gsap.set([p.heroSuffix, p.neuSuffix], { display: 'none' });
    gsap.set(p.heroBody, { filter: 'blur(0px) saturate(1)', opacity: 1 });
    gsap.set(p.neu, { height: 0 });
    gsap.set(p.neuBody, { filter: 'blur(6px) saturate(0.5)', opacity: 0.7 });
    gsap.set(p.building, { display: 'none' });
    gsap.set([p.dims[1], p.count[1]], { autoAlpha: 0 });
    gsap.set([p.dims[0], p.count[0]], { autoAlpha: 1 });
    gsap.set(p.chip.page, { autoAlpha: 0 });
    gsap.set(p.chip.sec, { autoAlpha: 1 });
    gsap.set([p.ph.page, p.ph.busy, p.send.on, p.send.stop], { autoAlpha: 0 });
    gsap.set([p.ph.sec, p.draft1, p.draft2, p.send.off], { autoAlpha: 1 });
    gsap.set([p.title[1], p.sum[1], p.sum[2], p.sum[3]], { autoAlpha: 0 });
    gsap.set([p.title[0], p.sum[0]], { autoAlpha: 1 });
    gsap.set(p.empty, { display: 'flex', autoAlpha: 1 });
    gsap.set([p.u1, p.u2, p.a1.el, p.a2.el], { display: 'none' });
    [p.a1, p.a2].forEach(function (m) {
      gsap.set([m.list, m.thinkA, m.thinkB, m.reply, m.usage].concat(m.steps), { display: 'none' });
      m.steps.forEach(function (s) {
        gsap.set($('.ms-spin', s), { autoAlpha: 1 });
        gsap.set($('.ms-st-ok', s), { autoAlpha: 0 });
      });
    });
    gsap.set(p.cur, { autoAlpha: 0, x: 0, y: 0 });
    gsap.set(p.tips, { autoAlpha: 0 });
    gsap.set(p.click, { opacity: 0 });
    gsap.set([p.ring, p.ring2, p.shade, p.dlg, p.dt[1], p.dd[1]], { autoAlpha: 0 });
    gsap.set([p.dt[0], p.dd[0]], { autoAlpha: 1 });
    gsap.set([p.form, p.foot[0]], { display: 'flex' });
    gsap.set([p.work, p.done, p.foot[1]], { display: 'none' });
    gsap.set(p.ws, { autoAlpha: 0 });
    gsap.set(p.ws[0], { autoAlpha: 1 });
  }

  function story(gsap, p, M, opts) {
    var typers = [];
    var tl = gsap.timeline({ paused: !!opts.paused, defaults: { ease: 'power2.inOut' } });

    function type(el, at, dur, caret) {
      var t = typer(el);
      typers.push(t);
      t.show(0);
      var o = { k: 0 };
      tl.fromTo(o, { k: 0 }, { k: t.n, duration: dur, ease: 'none', immediateRender: false, onUpdate: function () { t.show(o.k, caret); } }, at);
    }
    function fade(out, inn, at, d) {
      d = d == null ? 0.15 : d;
      if (out) tl.to(out, { autoAlpha: 0, duration: d }, at);
      if (inn) tl.to(inn, { autoAlpha: 1, duration: d }, at);
    }
    function appear(el, at, display) {
      tl.set(el, { display: display || 'flex' }, at)
        .fromTo(el, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', immediateRender: false }, at);
    }
    function on(el, at, display) { tl.set(el, { display: display || 'block' }, at); }
    function off(el, at) { tl.set(el, { display: 'none' }, at); }
    var tipNow = -1;
    function tip(i, at) {
      if (tipNow > -1) tl.to(p.tips[tipNow], { autoAlpha: 0, duration: 0.12 }, at);
      if (i > -1) tl.to(p.tips[i], { autoAlpha: 1, duration: 0.18 }, at + 0.05);
      tipNow = i;
    }
    function move(x, y, at, dur, ease) { tl.to(p.cur, { x: x, y: y, duration: dur, ease: ease || 'power3.inOut' }, at); }
    function click(at) {
      tl.to(p.arrow, { scale: 0.82, duration: 0.07, ease: 'power1.in' }, at)
        .to(p.arrow, { scale: 1, duration: 0.16, ease: 'power2.out' }, at + 0.07)
        .fromTo(p.click, { scale: 0.3, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 0.55, ease: 'power2.out', immediateRender: false }, at);
    }
    function stepOn(m, i, at) {
      if (i === 0) on(m.list, at, 'flex');
      tl.set(m.steps[i], { display: 'flex' }, at)
        .fromTo(m.steps[i], { autoAlpha: 0, x: -4 }, { autoAlpha: 1, x: 0, duration: 0.2, ease: 'power2.out', immediateRender: false }, at);
    }
    function stepDone(m, i, at) {
      var s = m.steps[i];
      tl.to($('.ms-spin', s), { autoAlpha: 0, duration: 0.1 }, at)
        .fromTo($('.ms-st-ok', s), { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: 'back.out(2.2)', immediateRender: false }, at);
    }
    function press(el, at) { tl.fromTo(el, { scale: 1 }, { scale: 0.9, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut', immediateRender: false }, at); }

    var C = M.canvas;
    var start = { x: C.l + C.w - 28, y: C.t + C.h * 0.62 };
    gsap.set(p.cur, { x: start.x, y: start.y });

    /* 01 · você pede */
    var t = 0.1;
    fade(p.ph.sec, null, t + 0.02, 0.05);
    fade(p.send.off, p.send.on, t + 0.05);
    type(p.draft1, t, 1.6, true);
    t = 1.85;
    press(p.send.on, t);
    t += 0.12;
    fade(p.draft1, null, t, 0.08);
    fade(p.send.on, p.send.stop, t);
    fade(null, p.ph.busy, t + 0.05);
    off(p.empty, t);
    appear(p.u1, t);
    fade(p.title[0], p.title[1], t);
    fade(p.sum[0], p.sum[1], t);
    var ask = t;

    /* 02 · o agente muda a página */
    t = ask + 0.2;
    appear(p.a1.el, t);
    on(p.a1.thinkA, t);
    tl.to(p.cur, { autoAlpha: 1, duration: 0.25 }, t);
    tip(0, t);
    // a pessoa tira a seleção: a seção volta ao normal e o pedido segue para a página
    fade(p.heroV, null, t + 0.1, 0.2);
    fade(p.chip.sec, p.chip.page, t + 0.1);
    on(p.building, t + 0.15, 'flex');
    // lê a página: o cursor desce pela Abertura e volta
    var H = M.hero;
    move(H.l + H.w * 0.3, H.t + 26, t + 0.1, 0.6);
    t += 0.35;
    off(p.a1.thinkA, t);
    stepOn(p.a1, 0, t);
    on(p.a1.thinkB, t);
    move(H.l + H.w * 0.34, H.t + H.h - 30, t + 0.4, 0.75, 'sine.inOut');
    move(H.l + H.w * 0.28, H.t + H.h * 0.4, t + 1.15, 0.5, 'sine.inOut');
    t += 1.6;
    stepDone(p.a1, 0, t);
    // reescreve o título: a seção fica borrada, com a varredura e o contorno laranja
    stepOn(p.a1, 1, t + 0.1);
    tip(1, t + 0.1);
    var T = M.title;
    move(T.l + Math.min(T.w * 0.5, 60), T.t + T.h * 0.6, t + 0.1, 0.5);
    fade(null, p.heroA.concat([p.heroScan]), t + 0.25, 0.2);
    tl.to(p.heroBody, { filter: 'blur(1.5px) saturate(1)', duration: 0.4 }, t + 0.25);
    t += 1.1;
    // grava: o título novo aparece e a seção sai do borrado
    click(t);
    tl.set(p.titleOld, { autoAlpha: 0 }, t).set(p.titleNew, { autoAlpha: 1 }, t);
    tl.fromTo(p.heroBody, { filter: 'blur(12px) saturate(0.5)', opacity: 0.5 }, { filter: 'blur(0px) saturate(1)', opacity: 1, duration: 0.7, ease: 'power2.out', immediateRender: false }, t);
    fade(p.heroScan, null, t, 0.2);
    on(p.heroSuffix, t);
    stepDone(p.a1, 1, t + 0.15);
    // cria o Clube do Banho depois de Serviços: a câmera desce, a seção entra em esqueleto
    t += 0.35;
    stepOn(p.a1, 2, t);
    tip(2, t);
    tl.to(p.world, { y: M.pan, duration: 1, ease: 'power2.inOut' }, t);
    var N = M.neu;
    move(N.l + N.w * 0.42, N.y + M.pan - N.h * 0.08, t + 0.3, 0.9);
    fade(null, p.neuA.concat([p.neuScan]), t + 0.35, 0.15);
    tl.fromTo(p.neu, { height: 0 }, { height: M.neuH, duration: 0.75, ease: 'power2.inOut', immediateRender: false }, t + 0.35);
    fade(p.dims[0], p.dims[1], t + 0.4);
    fade(p.count[0], p.count[1], t + 0.4);
    t += 1.25;
    click(t);
    tl.fromTo(p.neuBody, { filter: 'blur(6px) saturate(0.5)', opacity: 0.7 }, { filter: 'blur(0px) saturate(1)', opacity: 1, duration: 0.8, ease: 'power2.out', immediateRender: false }, t);
    fade(p.neuScan, null, t, 0.2);
    on(p.neuSuffix, t);
    stepDone(p.a1, 2, t + 0.15);
    // confere: volta ao começo da página e passa os olhos
    t += 0.35;
    stepOn(p.a1, 3, t);
    tip(3, t);
    tl.to(p.world, { y: 0, duration: 0.9, ease: 'power2.inOut' }, t);
    move(H.l + H.w * 0.62, H.t + H.h * 0.3, t + 0.1, 0.8);
    move(H.l + H.w * 0.66, H.t + H.h * 0.72, t + 0.9, 0.5, 'sine.inOut');
    t += 1.4;
    stepDone(p.a1, 3, t);
    off(p.a1.thinkB, t);
    tip(-1, t);
    tl.set(p.building, { display: 'none' }, t);
    on(p.a1.reply, t + 0.1);
    type(p.a1.reply, t + 0.1, 1.3, true);
    t += 1.5;
    on(p.a1.usage, t);
    fade(p.sum[1], p.sum[2], t);
    fade(p.send.stop, p.send.off, t);
    fade(p.ph.busy, p.ph.page, t);
    var answered = t;

    /* 03 · você confere e pede para publicar */
    t = answered + 0.3;
    fade(p.ph.page, null, t + 0.02, 0.05);
    fade(p.send.off, p.send.on, t + 0.05);
    type(p.draft2, t, 0.8, true);
    t += 0.95;
    press(p.send.on, t);
    t += 0.12;
    fade(p.draft2, null, t, 0.08);
    fade(p.send.on, p.send.stop, t);
    fade(null, p.ph.busy, t + 0.05);
    appear(p.u2, t);
    fade(p.sum[2], p.sum[1], t);
    var approved = t;

    /* 04 · publicado no site */
    t = approved + 0.2;
    appear(p.a2.el, t);
    stepOn(p.a2, 0, t + 0.15);
    on(p.a2.thinkB, t + 0.15);
    tip(4, t + 0.15);
    // a câmera chega perto do Atualizar, sem mostrar nada fora da janela
    var B = M.pub;
    var s = opts.zoom ? 1.75 : 1;
    var cam = { x: M.w * 0.6 - B.x * s, y: M.h * 0.42 - B.y * s };
    cam.x = Math.min(0, Math.max(M.w - M.w * s, cam.x));
    cam.y = Math.min(0, Math.max(M.h - M.h * s, cam.y));
    var hit = { x: B.l + Math.min(B.w * 0.3, 26), y: B.y };
    var near = { x: hit.x * s + cam.x, y: hit.y * s + cam.y };
    if (s > 1) tl.to(p.cam, { x: cam.x, y: cam.y, scale: s, duration: 1.2, ease: 'power2.inOut' }, t + 0.2);
    move((start.x + near.x) / 2 + M.w * 0.04, (start.y + near.y) / 2 + M.h * 0.06, t + 0.25, 0.7, 'power1.in');
    move(near.x, near.y + 4, t + 0.95, 0.6, 'power3.out');
    t += 1.7;
    click(t);
    press(p.pub, t);
    tl.fromTo(p.ring, { autoAlpha: 1, scale: 0.92 }, { autoAlpha: 0, scale: 1.35, duration: 0.6, ease: 'power2.out', immediateRender: false }, t + 0.04)
      .fromTo(p.ring2, { autoAlpha: 0.9, scale: 0.95 }, { autoAlpha: 0, scale: 1.2, duration: 0.45, ease: 'power2.out', immediateRender: false }, t + 0.12);
    // a câmera volta e o diálogo sai do próprio botão
    if (s > 1) tl.to(p.cam, { x: 0, y: 0, scale: 1, duration: 0.7, ease: 'power2.inOut' }, t + 0.25);
    move(hit.x, hit.y + 4, t + 0.25, 0.7);
    tl.to(p.shade, { autoAlpha: 1, duration: 0.3 }, t + 0.45);
    var D = M.dlg;
    tl.fromTo(p.dlg, { autoAlpha: 0, x: B.x - D.x, y: B.y - D.y, scale: 0.15 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.6, ease: 'power3.out', immediateRender: false }, t + 0.45);
    // confirma
    var K = M.confirm;
    move(K.x + 4, K.y + 6, t + 1.0, 0.6);
    t += 1.75;
    click(t);
    press(p.confirm, t);
    off(p.form, t + 0.15);
    tl.set(p.work, { display: 'flex' }, t + 0.15);
    off(p.foot[0], t + 0.15);
    var w0 = t + 0.3;
    for (var i = 1; i < p.ws.length; i++) {
      fade(p.ws[i - 1], null, w0 + i * 0.42, 0.08);
      fade(null, p.ws[i], w0 + i * 0.42 + 0.08, 0.1);
    }
    t = w0 + p.ws.length * 0.42;
    off(p.work, t);
    tl.set(p.done, { display: 'flex' }, t).fromTo(p.done, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, t);
    fade([p.dt[0], p.dd[0]], null, t, 0.1);
    fade(null, [p.dt[1], p.dd[1]], t + 0.1, 0.15);
    tl.set(p.foot[1], { display: 'flex' }, t).fromTo(p.foot[1], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, t);
    // fecha
    var X = M.close;
    move(X.x + 4, X.y + 6, t + 0.35, 0.6);
    t += 1.25;
    click(t);
    press(p.close, t);
    tl.to(p.dlg, { autoAlpha: 0, scale: 0.97, duration: 0.25, ease: 'power2.in' }, t + 0.12)
      .to(p.shade, { autoAlpha: 0, duration: 0.3 }, t + 0.12);
    // a página está no site: o globo da barra pula e a folha acende em lima uma vez
    t += 0.4;
    tl.fromTo(p.globe, { scale: 1 }, { scale: 1.4, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, t);
    tl.fromTo(p.sheet, { boxShadow: '0 0 0 0px rgba(202,242,38,0)' }, { boxShadow: '0 0 0 12px rgba(202,242,38,0.95)', duration: 0.25, ease: 'power2.out', immediateRender: false }, t)
      .to(p.sheet, { boxShadow: '0 0 0 34px rgba(202,242,38,0)', duration: 0.6, ease: 'power2.out' }, t + 0.25)
      .set(p.sheet, { boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }, t + 0.9);
    stepDone(p.a2, 0, t);
    off(p.a2.thinkB, t);
    tip(-1, t);
    on(p.a2.reply, t + 0.1);
    type(p.a2.reply, t + 0.1, 1.0, true);
    move(C.l + C.w * 0.7, C.t + C.h * 0.45, t + 0.1, 0.9);
    t += 1.2;
    on(p.a2.usage, t);
    fade(p.sum[1], p.sum[3], t);
    fade(p.send.stop, p.send.off, t);
    fade(p.ph.busy, p.ph.page, t);
    tl.to(p.cur, { autoAlpha: 0, duration: 0.5 }, t + 0.3);
    tl.to({}, { duration: 0.8 }, t + 0.3);

    // a régua embaixo da janela acompanha as quatro partes
    var marks = [0, ask + 0.2, answered + 0.3, approved + 0.2];
    p.hud.steps.forEach(function (step, i) {
      var lit = $('.ms-hud-lit', step);
      if (!lit) return;
      tl.fromTo(lit, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, ease: 'none', immediateRender: i === 0 }, marks[i]);
      if (i < p.hud.steps.length - 1) tl.to(lit, { autoAlpha: 0, duration: 0.15, ease: 'none' }, marks[i + 1]);
    });
    if (p.hud.fill) tl.fromTo(p.hud.fill, { scaleX: 0 }, { scaleX: 1, duration: tl.duration(), ease: 'none', transformOrigin: '0 50%' }, 0);

    return { tl: tl, restore: function () { typers.forEach(function (t) { t.restore(); }); } };
  }

  function setup(gsap, ST, app) {
    var p = parts(app);
    if (!p.cam || !p.cur || !p.dlg || !p.neu) return;
    var mm = gsap.matchMedia();
    function arm(desktop) {
      var M = measure(gsap, p);
      begin(gsap, p);
      var s = story(gsap, p, M, { paused: !desktop, zoom: desktop });
      if (desktop) {
        ST.create({
          trigger: p.stage, start: 'center center+=36', end: '+=' + Math.round(s.tl.duration() * 250),
          pin: p.stage, pinSpacing: true, anticipatePin: 1, scrub: 0.6, animation: s.tl,
        });
        // a janela chega inclinada e assenta quando o pin começa (as medidas acima são sem a inclinação)
        gsap.fromTo(p.app, { rotateX: 12, scale: 0.94, y: 24, transformPerspective: 1800, transformOrigin: '50% 0%' }, {
          rotateX: 0, scale: 1, y: 0, ease: 'none',
          scrollTrigger: { trigger: p.stage, start: 'top bottom', end: 'center center+=36', scrub: 0.4 },
        });
      } else {
        s.tl.timeScale(1.1);
        ST.create({ trigger: p.app, start: 'center 58%', once: true, onEnter: function () { s.tl.play(0); } });
      }
      return function () { s.restore(); };
    }
    mm.add('(min-width: 1025px)', function () { return arm(true); });
    mm.add('(max-width: 1024px)', function () { return arm(false); });
    // largura mudou dentro do mesmo aparelho: medir de novo
    var width = window.innerWidth, timer = 0;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - width) < 4) return;
      width = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(function () {
        mm.revert();
        mm = gsap.matchMedia();
        mm.add('(min-width: 1025px)', function () { return arm(true); });
        mm.add('(max-width: 1024px)', function () { return arm(false); });
        ST.refresh();
      }, 250);
    });
  }

  function rise(gsap, ST) {
    var items = $$('.ms-produto .ms-rise').filter(function (el) { return el.getBoundingClientRect().top > window.innerHeight * 0.9; });
    if (!items.length) return;
    gsap.set(items, { autoAlpha: 0, y: 18 });
    ST.batch(items, { start: 'top 90%', once: true, onEnter: function (batch) { gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.08, clearProps: 'transform' }); } });
  }

  function start() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST || !scrollable()) return;
    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });
    try { rise(gsap, ST); } catch (error) {}
    $$('.ms-produto .ms-app').forEach(function (app) { try { setup(gsap, ST, app); } catch (error) {} });
    var refresh = function () { ST.refresh(); };
    window.addEventListener('load', refresh);
  }

  function boot() {
    // miniatura do canvas do Space (iframe de altura automática): fica o fim da história, do CSS
    if (!scrollable() && window.frameElement) return;
    var fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
    (window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js'))
      .then(function () { return window.ScrollTrigger ? null : load(CDN + 'ScrollTrigger.min.js'); })
      .then(function () { return fonts; })
      .then(start, function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`
