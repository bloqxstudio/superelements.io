import { escapeAttr } from './css';
import type { RenderContext } from './context';

export interface ElementorIcon {
  value?: string | { url?: string; id?: number | string };
  library?: string;
}

export const hasIcon = (icon: ElementorIcon | undefined) =>
  !!icon && !!icon.library && (typeof icon.value === 'string' ? !!icon.value : !!icon.value?.url);

/**
 * Ícones do Elementor:
 *  - Font Awesome (`fa-solid`, `fa-regular`, `fa-brands`) viram <i class="fas fa-...">.
 *  - SVG enviado para a biblioteca de mídia vira uma máscara CSS, para herdar
 *    a cor do texto como o SVG inline do Elementor herda `fill`.
 */
export const renderIcon = (icon: ElementorIcon | undefined, ctx: RenderContext): string => {
  if (!hasIcon(icon)) return '';

  if (icon!.library === 'svg' && typeof icon!.value === 'object') {
    const url = icon!.value.url!;
    return `<span class="e-svg-icon" style="--e-svg:url(&quot;${escapeAttr(url)}&quot;)" aria-hidden="true"></span>`;
  }

  if (typeof icon!.value === 'string') {
    if (icon!.library?.startsWith('fa-') || /^fa[srbl]? /.test(icon!.value)) {
      ctx.flags.fontAwesome = true;
    } else {
      ctx.warnings.push(`Biblioteca de ícones "${icon!.library}" não carregada (${icon!.value}).`);
    }
    return `<i aria-hidden="true" class="${escapeAttr(icon!.value)}"></i>`;
  }

  return '';
};

/** Nome da rede social a partir da classe do ícone ("fab fa-facebook-f" → "facebook-f"). */
export const socialName = (icon: ElementorIcon | undefined) => {
  if (!icon || typeof icon.value !== 'string') return 'svg';
  return icon.value.replace(/^fa[a-z]* fa-/, '').trim() || 'svg';
};
