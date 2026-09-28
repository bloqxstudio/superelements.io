import { buildBaseCss } from './baseCss';
import { DEFAULT_KIT } from './context';
import { escapeHtml } from './css';
import { MOTION_SCRIPT, motionCss } from './motion';
import { renderElementor } from './render';
import type { ElementorKit, RenderOptions, RenderResult } from './types';

const FONT_AWESOME = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';

// Fontes do sistema não vão para o Google Fonts.
const SYSTEM_FONTS = new Set(['arial', 'helvetica', 'verdana', 'georgia', 'times new roman', 'tahoma', 'trebuchet ms', 'courier new', 'sans-serif', 'serif', 'monospace', 'system-ui']);

/** URL do Google Fonts no formato antigo (tolera pesos que a fonte não tem, como o Elementor). */
export const googleFontsUrl = (families: string[]) => {
  const list = [...new Set(families)].filter((f) => f && !SYSTEM_FONTS.has(f.toLowerCase()));
  if (!list.length) return null;
  const weights = '100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic';
  return `https://fonts.googleapis.com/css?family=${list.map((f) => `${encodeURIComponent(f).replace(/%20/g, '+')}:${weights}`).join('%7C')}&display=swap`;
};

/** Script mínimo para as setas e os pontos do carrossel (o Elementor usa Swiper). */
const CAROUSEL_SCRIPT = `
document.querySelectorAll('[data-se-carousel]').forEach(function (track) {
  var widget = track.closest('.elementor-widget');
  var group = function () { var g = (track.dataset.seScroll || '1,1,1').split(','); return Number(innerWidth <= 767 ? g[2] : innerWidth <= 1024 ? g[1] : g[0]) || 1; };
  var slide = function () { var s = track.querySelector('.swiper-slide'); return s ? s.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth; };
  var step = function () { return slide() * group(); };
  var prev = widget.querySelector('.elementor-swiper-button-prev');
  var next = widget.querySelector('.elementor-swiper-button-next');
  if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step() }); });
  if (next) next.addEventListener('click', function () { track.scrollBy({ left: step() }); });
  var bullets = widget.querySelectorAll('.swiper-pagination-bullet');
  bullets.forEach(function (b, i) { b.addEventListener('click', function () { track.scrollTo({ left: i * step() }); }); });
  track.addEventListener('scroll', function () {
    var i = Math.round(track.scrollLeft / step());
    bullets.forEach(function (b, j) { b.classList.toggle('swiper-pagination-bullet-active', i === j); });
  }, { passive: true });
});`;

export interface DocumentOptions extends RenderOptions {
  title?: string;
  /** Cor de fundo do <body> (o Hello usa branco). */
  background?: string;
}

export interface ElementorDocumentResult extends RenderResult {
  /** Documento HTML completo, pronto para iframe srcdoc ou para exportar. */
  document: string;
}

/** Monta o HTML final a partir de um resultado já renderizado. */
export const buildDocument = (result: RenderResult, kit: ElementorKit, options: DocumentOptions = {}) => {
  const kitFonts = Object.values(kit.typography).map((t) => t.family).filter(Boolean) as string[];
  const fontsUrl = googleFontsUrl([...result.fonts, ...kitFonts]);
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(options.title || 'Componente Elementor')}</title>`,
    fontsUrl && '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    fontsUrl && `<link rel="stylesheet" href="${fontsUrl}">`,
    result.usesFontAwesome && `<link rel="stylesheet" href="${FONT_AWESOME}">`,
    `<style id="se-base">${buildBaseCss(kit)}</style>`,
    `<style id="se-elements">${result.css}</style>`,
    result.animations.length > 0 && `<style id="se-motion">${motionCss(result.animations)}</style>`,
    options.background && `<style>body{background:${options.background}}</style>`,
  ].filter(Boolean);

  const scripts = [result.usesCarousel && `<script>${CAROUSEL_SCRIPT}</script>`, result.animations.length > 0 && `<script>${MOTION_SCRIPT}</script>`]
    .filter(Boolean)
    .join('\n');
  return `<!doctype html>\n<html lang="pt-BR">\n<head>\n${head.join('\n')}\n</head>\n<body>\n${result.html}\n${scripts}\n</body>\n</html>`;
};

/** Atalho: JSON do Elementor → documento HTML completo. */
export const renderElementorDocument = (input: unknown, options: DocumentOptions = {}): ElementorDocumentResult => {
  const kit: ElementorKit = {
    ...DEFAULT_KIT,
    ...options.kit,
    colors: { ...DEFAULT_KIT.colors, ...options.kit?.colors },
    typography: { ...DEFAULT_KIT.typography, ...options.kit?.typography },
  };
  const result = renderElementor(input, { ...options, kit });
  return { ...result, document: buildDocument(result, kit, options) };
};
