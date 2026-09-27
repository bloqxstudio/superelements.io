import type { RenderContext } from '../context';
import { escapeAttr } from '../css';
import type { ElementorElement } from '../types';

export interface WidgetArgs {
  el: ElementorElement;
  s: Record<string, any>;
  /** Seletor CSS do elemento (".elementor .elementor-element.elementor-element-<id>"). */
  sel: string;
  ctx: RenderContext;
  /** Classes extras do wrapper do widget (ex.: "elementor-view-stacked"). */
  classes: string[];
}

export type WidgetRenderer = (args: WidgetArgs) => string;

const SAFE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p', 'section', 'header', 'footer', 'article', 'aside', 'main', 'nav']);

export const safeTag = (tag: unknown, fallback: string) => {
  const t = String(tag || '').toLowerCase();
  return SAFE_TAGS.has(t) ? t : fallback;
};

export interface ElementorLink {
  url?: string;
  is_external?: string | boolean;
  nofollow?: string | boolean;
}

export const hasLink = (link: ElementorLink | undefined) => !!link?.url;

export const linkAttrs = (link: ElementorLink | undefined) => {
  if (!link?.url) return '';
  const rel = link.nofollow ? ' rel="nofollow"' : '';
  const target = link.is_external ? ' target="_blank"' : '';
  return ` href="${escapeAttr(link.url)}"${target}${rel}`;
};

export const wrapLink = (link: ElementorLink | undefined, inner: string, className = '') =>
  hasLink(link) ? `<a${className ? ` class="${className}"` : ''}${linkAttrs(link)}>${inner}</a>` : inner;

/**
 * Conteúdo rico vindo do editor. O preview roda num iframe isolado, mas o HTML
 * exportado não; por isso tiramos scripts e handlers inline de campos de texto.
 * (O widget "HTML" é a exceção: ali o código é intencional.)
 */
export const richText = (html: unknown) =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

/** Equivalente simples do wpautop: parágrafos para texto sem blocos HTML. */
export const autop = (html: string) => {
  const text = html.trim();
  if (!text || /<(p|div|ul|ol|h[1-6]|table|blockquote|figure|pre)[\s>]/i.test(text)) return text;
  return text
    .split(/\n\s*\n/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>\n')}</p>`)
    .join('\n');
};

/** Imagem cinza usada quando o JSON não traz URL (como o placeholder do Elementor). */
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#e5e7eb"/><path d="M520 470l60-80 50 60 40-40 70 60z" fill="#c4c8cf"/><circle cx="545" cy="345" r="22" fill="#c4c8cf"/></svg>',
  );
