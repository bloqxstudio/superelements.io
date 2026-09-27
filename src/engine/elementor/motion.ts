import type { RenderContext } from './context';
import { escapeAttr, isEmpty } from './css';

/**
 * Animações de entrada do Elementor (aba Avançado → Efeitos de movimento).
 * No modo 'play' o elemento nasce invisível e o script do documento adiciona
 * `animated <nome>` quando ele entra na tela, com o atraso do JSON. Keyframes
 * iguais aos do frontend do Elementor; nomes que o motor não conhece caem no
 * fadeIn.
 */

const KEYFRAMES: Record<string, string> = {
  fadeIn: 'from{opacity:0}to{opacity:1}',
  fadeInUp: 'from{opacity:0;transform:translate3d(0,100%,0)}to{opacity:1;transform:none}',
  fadeInDown: 'from{opacity:0;transform:translate3d(0,-100%,0)}to{opacity:1;transform:none}',
  fadeInLeft: 'from{opacity:0;transform:translate3d(-100%,0,0)}to{opacity:1;transform:none}',
  fadeInRight: 'from{opacity:0;transform:translate3d(100%,0,0)}to{opacity:1;transform:none}',
  zoomIn: 'from{opacity:0;transform:scale3d(.3,.3,.3)}50%{opacity:1}',
  slideInUp: 'from{transform:translate3d(0,100%,0);visibility:visible}to{transform:translate3d(0,0,0)}',
  slideInDown: 'from{transform:translate3d(0,-100%,0);visibility:visible}to{transform:translate3d(0,0,0)}',
  slideInLeft: 'from{transform:translate3d(-100%,0,0);visibility:visible}to{transform:translate3d(0,0,0)}',
  slideInRight: 'from{transform:translate3d(100%,0,0);visibility:visible}to{transform:translate3d(0,0,0)}',
};

/**
 * Classes e atributos de animação de um elemento. `key` é '_animation' em
 * widgets e 'animation' em containers.
 */
export function motionAttrs(ctx: RenderContext, s: Record<string, unknown>, key: string, classes: string[]): string {
  if (ctx.motion !== 'play') return '';
  const raw = s[key];
  if (isEmpty(raw) || raw === 'none') return '';
  const name = KEYFRAMES[String(raw)] ? String(raw) : 'fadeIn';
  ctx.animations.add(name);
  classes.push('elementor-invisible');
  if (s.animation_duration === 'fast' || s.animation_duration === 'slow') classes.push(`animated-${s.animation_duration}`);
  const delay = Number(s[`${key}_delay`]) || 0;
  return ` data-se-anim="${escapeAttr(name)}"${delay ? ` data-se-delay="${delay}"` : ''}`;
}

export function motionCss(names: string[]): string {
  const frames = names.map((n) => `@keyframes ${n}{${KEYFRAMES[n] ?? KEYFRAMES.fadeIn}}.${n}{animation-name:${n}}`).join('\n');
  return [
    '.elementor-invisible{visibility:hidden}',
    '.animated{animation-duration:1.25s;animation-fill-mode:both}',
    '.animated.animated-fast{animation-duration:.75s}',
    '.animated.animated-slow{animation-duration:2s}',
    frames,
    '@media (prefers-reduced-motion:reduce){.elementor-invisible{visibility:visible!important}.animated{animation:none!important}}',
  ].join('\n');
}

/** Revela cada elemento ao entrar na tela; sem IntersectionObserver ou com movimento reduzido, mostra tudo. */
export const MOTION_SCRIPT = `
(function () {
  var els = [].slice.call(document.querySelectorAll('[data-se-anim]'));
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(el) {
    if (!el.classList.contains('elementor-invisible')) return;
    var delay = reduce ? 0 : Number(el.getAttribute('data-se-delay')) || 0;
    setTimeout(function () {
      el.classList.remove('elementor-invisible');
      if (!reduce) el.classList.add('animated', el.getAttribute('data-se-anim'));
    }, delay);
  }
  if (reduce || !('IntersectionObserver' in window)) return els.forEach(show);
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); show(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(function (el) { io.observe(el); });
  // Nada fica escondido para sempre (elemento fora do fluxo, iframe sem rolagem)
  setTimeout(function () { els.forEach(show); }, 4000);
})();`;
