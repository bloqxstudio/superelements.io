function case2Process() {
  const boot = () => {
    const section = document.querySelector('.tq-proc');
    const track = section?.querySelector('.tq-steps');
    const controls = section?.querySelector('.tq-process-controls');
    if (!track || !controls || controls.dataset.ready) return;
    controls.dataset.ready = 'true';
    const steps = [...track.querySelectorAll('.tq-step')];
    const choices = [...controls.querySelectorAll('[data-step]')];
    const previous = controls.querySelector('[data-prev]');
    const next = controls.querySelector('[data-next]');
    const counter = controls.querySelector('[data-counter]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    track.id = 'case2-etapas';
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', 'As quatro etapas do nosso processo. Use as setas para navegar.');
    track.setAttribute('data-lenis-prevent', '');
    const position = step => step.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    const current = () => steps.reduce((best, step, index) => Math.abs(position(step) - track.scrollLeft) < Math.abs(position(steps[best]) - track.scrollLeft) ? index : best, 0);
    const go = index => track.scrollTo({ left: position(steps[Math.max(0, Math.min(steps.length - 1, index))]), behavior: reduced.matches ? 'instant' : 'smooth' });
    const update = () => {
      const index = current();
      const end = Math.max(0, track.scrollWidth - track.clientWidth);
      previous.disabled = index === 0 || track.scrollLeft < 2;
      next.disabled = index === steps.length - 1 || track.scrollLeft >= end - 2;
      counter.textContent = `${String(index + 1).padStart(2, '0')} / 04`;
      choices.forEach((button, i) => {
        button.classList.toggle('is-active', i === index);
        if (i === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    };
    choices.forEach((button, index) => button.addEventListener('click', () => go(index)));
    previous.addEventListener('click', () => go(current() - 1));
    next.addEventListener('click', () => go(current() + 1));
    track.addEventListener('keydown', event => {
      const keys = { ArrowRight: current() + 1, ArrowLeft: current() - 1, Home: 0, End: steps.length - 1 };
      if (!(event.key in keys) || event.target !== track) return;
      event.preventDefault();
      go(keys[event.key]);
    });
    let frame;
    track.addEventListener('scroll', () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    }, { passive: true });
    let drag;
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('a,button')) return;
      drag = { x: event.clientX, left: track.scrollLeft, moved: false };
    });
    track.addEventListener('pointermove', event => {
      if (!drag) return;
      const distance = event.clientX - drag.x;
      if (!drag.moved && Math.abs(distance) > 6) {
        drag.moved = true;
        track.setPointerCapture(event.pointerId);
        track.classList.add('is-dragging');
      }
      if (drag.moved) { event.preventDefault(); track.scrollLeft = drag.left - distance; }
    });
    const finish = () => { drag = undefined; track.classList.remove('is-dragging'); };
    track.addEventListener('pointerup', finish);
    track.addEventListener('pointercancel', finish);
    track.addEventListener('pointerleave', () => { if (!drag?.moved) finish(); });
    track.addEventListener('dragstart', event => event.preventDefault());
    const observer = new ResizeObserver(update);
    observer.observe(track);
    addEventListener('pagehide', () => { observer.disconnect(); cancelAnimationFrame(frame); }, { once: true });
    update();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}

export const processControls = `<div class="tq-process-controls">
  <div class="tq-process-overview" aria-label="Todas as etapas do processo">
    <button type="button" data-step="0" aria-controls="case2-etapas"><span>01</span> Projeto arquitetônico</button>
    <button type="button" data-step="1" aria-controls="case2-etapas"><span>02</span> Interiores</button>
    <button type="button" data-step="2" aria-controls="case2-etapas"><span>03</span> Renderização</button>
    <button type="button" data-step="3" aria-controls="case2-etapas"><span>04</span> Definição técnica</button>
  </div>
  <div class="tq-process-toolbar"><p>Explore as quatro etapas <span>· arraste para o lado</span></p><div class="tq-process-arrows">
    <span data-counter aria-live="polite" aria-atomic="true">01 / 04</span>
    <button type="button" data-prev aria-label="Etapa anterior" aria-controls="case2-etapas" disabled><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" stroke-width="1.4"/></svg></button>
    <button type="button" data-next aria-label="Próxima etapa" aria-controls="case2-etapas"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.4"/></svg></button>
  </div></div>
</div><script>(${case2Process.toString()})();</script>`;

export const processCSS = `
selector .tq-proc-in{min-height:0;padding-bottom:70px}
selector .tq-process-controls{margin-top:42px}
selector .tq-process-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--line);gap:24px}
selector .tq-process-overview button{position:relative;display:flex;gap:12px;align-items:baseline;min-height:62px;padding:12px 0 18px;background:transparent;color:var(--ink);font:400 16px/1.35 var(--lt);text-align:left;border:0;cursor:pointer;transition:color .2s,opacity .2s}
selector .tq-process-overview button span{font:italic 24px/1 var(--sf);opacity:.6}
selector .tq-process-overview button:after{content:'';position:absolute;bottom:-1px;left:0;width:100%;height:2px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .3s cubic-bezier(.22,1,.36,1)}
selector .tq-process-overview button.is-active:after,selector .tq-process-overview button:hover:after{transform:scaleX(1)}
selector .tq-process-overview button.is-active span{opacity:1}
selector .tq-process-toolbar{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 0}
selector .tq-process-toolbar p{font:400 14px/1.4 var(--lt)}selector .tq-process-toolbar p span{opacity:.55}
selector .tq-process-arrows{display:flex;gap:10px;align-items:center}selector [data-counter]{margin-right:14px;font:400 13px/1 var(--lt);font-variant-numeric:tabular-nums;white-space:nowrap}
selector .tq-process-arrows button{width:46px;height:46px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer;transition:background .2s,color .2s,border-color .2s}
selector .tq-process-arrows button:disabled{opacity:.28;cursor:default}selector .tq-process-arrows button:not(:disabled):hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}
selector button:focus-visible,selector .tq-steps:focus-visible{outline:2px solid var(--ink);outline-offset:5px}
selector .tq-steps,html:not(.tq-pin) selector .tq-steps{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;width:100%!important;max-width:100%;margin-top:12px;gap:32px;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x mandatory;scroll-padding-inline:0;scrollbar-width:thin;scrollbar-color:#17171770 transparent;padding:8px 0 24px;transform:none!important;will-change:auto;cursor:grab;overscroll-behavior-x:contain}
selector .tq-steps::-webkit-scrollbar{display:block!important;height:4px}selector .tq-steps::-webkit-scrollbar-thumb{background:#17171770}selector .tq-steps.is-dragging{cursor:grabbing;scroll-snap-type:none;user-select:none}
selector .tq-step{flex:0 0 min(620px,44vw);width:min(620px,44vw);min-width:0;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always}
selector .tq-steps:after{content:'';flex:0 0 max(0px,calc(100% - min(620px,44vw) - 32px))}
selector .tq-step-h{min-height:68px;padding-right:0;margin-bottom:22px}selector .tq-step-t .elementor-heading-title{line-height:1.05}
selector .tq-step-b{flex-direction:column;gap:24px;padding:0;width:100%;min-width:0}selector .tq-step-img{position:relative;width:100%;max-width:100%;min-width:0;height:auto;aspect-ratio:4/3;overflow:hidden}selector .tq-step-img .elementor-widget-image,selector .tq-step-img .elementor-widget-container{width:100%;height:100%}selector .tq-step-img img{width:100%;height:100%;object-fit:cover}selector .tq-step-d{width:100%;max-width:44ch}selector .tq-step-d p{text-align:left;font-size:17px;line-height:1.45}
selector .tq-step-img .elementor-widget-image{height:100%;overflow:hidden;transition:transform .55s cubic-bezier(.22,1,.36,1)}
@media(hover:hover) and (prefers-reduced-motion:no-preference){selector .tq-step:hover .tq-step-img .elementor-widget-image{transform:scale(1.035)}}
@media(max-width:1024px){selector .tq-step{flex-basis:76vw;width:76vw}selector .tq-steps:after{flex-basis:max(0px,calc(100% - 76vw - 22px))}selector .tq-process-overview{grid-template-columns:1fr 1fr;gap:0 24px}selector .tq-process-overview button{min-height:56px;font-size:15px}selector .tq-process-toolbar p span{display:block}selector .tq-steps{gap:22px!important}}
@media(max-width:767px){selector .tq-process-controls{margin-top:26px}selector .tq-step{flex-basis:84vw;width:84vw}selector .tq-steps:after{flex-basis:max(0px,calc(100% - 84vw - 18px))}selector .tq-steps{gap:18px!important}selector .tq-process-toolbar{gap:10px}selector .tq-process-toolbar p{font-size:12px}selector .tq-process-arrows{gap:7px}selector [data-counter]{margin-right:3px;font-size:12px}selector .tq-process-arrows button{width:42px;height:42px}selector .tq-step-h{min-height:62px}selector .tq-step-d p{font-size:16px}}
@media(prefers-reduced-motion:reduce){selector .tq-steps{scroll-behavior:auto}selector *{transition:none!important}}
`;

export const hoverCSS = `
selector a:focus-visible{outline:2px solid currentColor;outline-offset:6px}
selector .tq-btn svg{transition:transform .25s cubic-bezier(.22,1,.36,1)}
selector .tq-btn a{position:relative}selector .tq-btn a:after{content:'';position:absolute;bottom:-4px;left:0;width:100%;height:1px;background:currentColor;transform:scaleX(.16);transform-origin:left;transition:transform .32s cubic-bezier(.22,1,.36,1)}
selector .tq-nav a .tq-rl-in,selector .tq-fl a .tq-rl-in{transition:transform .32s cubic-bezier(.22,1,.36,1)}
selector .tq-pj-img,selector .tq-pr-ph,selector .tq-st-img{overflow:hidden}
selector .tq-pj-img .elementor-widget-image,selector .tq-pr-ph .elementor-widget-image,selector .tq-st-img .elementor-widget-image{height:100%;transition:transform .65s cubic-bezier(.22,1,.36,1),filter .4s}
@media(hover:hover) and (prefers-reduced-motion:no-preference){selector .tq-btn a:hover:after,selector .tq-btn a:focus-visible:after{transform:scaleX(1)}selector .tq-btn a:hover svg{transform:translateX(4px)}selector .tq-pj:hover .tq-pj-img .elementor-widget-image,selector .tq-pr-card:hover .tq-pr-ph .elementor-widget-image,selector .tq-st-img:hover .elementor-widget-image{transform:scale(1.035);filter:brightness(1.025)}}
@media(prefers-reduced-motion:reduce){selector *{transition:none!important}}
`;
