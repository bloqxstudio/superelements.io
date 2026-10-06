import { createContext, responsive, type RenderContext } from './context';
import {
  background,
  border,
  boxShadow,
  DEVICES,
  deviceMedia,
  dims,
  escapeAttr,
  escapeHtml,
  gaps,
  inherited,
  isEmpty,
  rv,
  slider,
  sliderNumber,
  transform,
  widthMedia,
  type Device,
} from './css';
import { motionAttrs } from './motion';
import { normalizeElementorInput } from './normalize';
import type { ElementorElement, RenderOptions, RenderResult } from './types';
import { widgetSummary } from './widgetInfo';
import { basicWidgets } from './widgets/basic';
import { extraWidgets } from './widgets/extras';
import { iconWidgets } from './widgets/icons';
import { proWidgets } from './widgets/pro';
import { safeTag, type WidgetRenderer } from './widgets/shared';

export const WIDGETS: Record<string, WidgetRenderer> = {
  ...basicWidgets,
  ...iconWidgets,
  ...proWidgets,
  ...extraWidgets,
};

export const isWidgetSupported = (widgetType: string) => widgetType in WIDGETS;

const selectorFor = (el: ElementorElement) => `.elementor .elementor-element.elementor-element-${el.id}`;

/**
 * Renderiza um JSON do Elementor em HTML + CSS.
 * Não depende de WordPress: tudo que o PHP do Elementor faria no servidor
 * (markup dos widgets e o CSS por elemento) é reproduzido aqui.
 */
export const renderElementor = (input: unknown, options: RenderOptions = {}): RenderResult => {
  const doc = normalizeElementorInput(input);
  const ctx = createContext(options, (elements, parent) => elements.map((el) => renderElement(el, ctx, parent)).join(''));
  const body = doc.elements.map((el) => renderElement(el, ctx, null)).join('');

  return {
    html: `<div class="elementor" data-elementor-type="${escapeAttr(doc.type || 'container')}">${body}</div>`,
    css: ctx.sheet.toString(),
    fonts: [...ctx.fonts],
    usesFontAwesome: ctx.flags.fontAwesome,
    usesCarousel: ctx.flags.carousel,
    animations: [...ctx.animations],
    unsupported: ctx.unsupported,
    widgets: ctx.widgets,
    warnings: [...new Set(ctx.warnings)],
  };
};

const renderElement = (el: ElementorElement, ctx: RenderContext, parent: ElementorElement | null): string => {
  switch (el.elType) {
    case 'container':
      return renderContainer(el, ctx, parent);
    case 'section':
      return renderSection(el, ctx, parent);
    case 'column':
      return renderColumn(el, ctx);
    case 'widget':
      return renderWidget(el, ctx);
    default:
      ctx.warnings.push(`Tipo de elemento desconhecido: ${el.elType}`);
      return '';
  }
};

// ---------------------------------------------------------------------------
// Aba Avançado: comum a widgets e containers

/** Classes de visibilidade (hide_desktop / hide_tablet / hide_mobile). */
const visibilityClasses = (s: Record<string, any>) =>
  ['hide_desktop', 'hide_tablet', 'hide_mobile'].map((k) => (s[k] ? `elementor-${s[k]}` : '')).filter(Boolean);

// vh do CSS personalizado segue a mesma variável dos controles (ver withUnit em css.ts).
const VH = /(?<![\w-])(-?\d*\.?\d+)vh(?![\w-])/g;

const customCss = (ctx: RenderContext, s: Record<string, any>, sel: string) => {
  if (typeof s.custom_css === 'string' && s.custom_css.trim()) {
    ctx.sheet.addRaw(s.custom_css.replace(/selector/g, sel).replace(VH, 'calc($1 * var(--se-vh, 1vh))'));
  }
};

/** Posição absoluta/fixa e deslocamentos. `positionKey` é '_position' em widgets e 'position' em containers. */
const positioning = (ctx: RenderContext, s: Record<string, any>, sel: string, positionKey: string, classes: string[]) => {
  const position = s[positionKey];
  if (position !== 'absolute' && position !== 'fixed') return;
  classes.push(`elementor-${position}`);
  ctx.sheet.add(sel, `position:${position}`);
  DEVICES.forEach((d) => {
    const h = s._offset_orientation_h || 'start';
    const v = s._offset_orientation_v || 'start';
    const x = slider(rv(s, h === 'end' ? '_offset_x_end' : '_offset_x', d)) || (d === 'desktop' ? '0px' : undefined);
    const y = slider(rv(s, v === 'end' ? '_offset_y_end' : '_offset_y', d)) || (d === 'desktop' ? '0px' : undefined);
    ctx.sheet.add(
      sel,
      [x && (h === 'end' ? `right:${x};left:auto` : `left:${x};right:auto`), y && (v === 'end' ? `bottom:${y};top:auto` : `top:${y};bottom:auto`)],
      deviceMedia(d),
    );
  });
};

/** Comportamento como item flex dentro do container pai. */
const flexChild = (ctx: RenderContext, s: Record<string, any>, sel: string) => {
  const sizes: Record<string, string> = {
    grow: 'flex-grow:1;flex-shrink:0',
    shrink: 'flex-grow:0;flex-shrink:1',
    none: 'flex-grow:0;flex-shrink:0',
  };
  responsive(ctx, sel, (d) => {
    const size = rv(s, '_flex_size', d);
    const order = rv(s, '_flex_order', d);
    return [
      rv(s, '_flex_align_self', d) && `align-self:${rv(s, '_flex_align_self', d)}`,
      size && size !== 'custom' && sizes[size],
      size === 'custom' && !isEmpty(rv(s, '_flex_grow', d)) && `flex-grow:${rv(s, '_flex_grow', d)}`,
      size === 'custom' && !isEmpty(rv(s, '_flex_shrink', d)) && `flex-shrink:${rv(s, '_flex_shrink', d)}`,
      order === 'start' && 'order:-99999',
      order === 'end' && 'order:99999',
      order === 'custom' && !isEmpty(rv(s, '_flex_order_custom', d)) && `order:${rv(s, '_flex_order_custom', d)}`,
    ];
  });
};

// ---------------------------------------------------------------------------
// Widgets

const renderWidget = (el: ElementorElement, ctx: RenderContext): string => {
  const s = el.settings;
  const type = el.widgetType || 'unknown';
  const sel = selectorFor(el);
  const classes = ['elementor-element', `elementor-element-${el.id}`];
  const extra: string[] = [];

  const renderer = WIDGETS[type];
  let inner: string;
  if (renderer) {
    ctx.widgets[type] = (ctx.widgets[type] || 0) + 1;
    inner = renderer({ el, s, sel, ctx, classes: extra });
  } else {
    ctx.unsupported[type] = (ctx.unsupported[type] || 0) + 1;
    inner = ctx.showUnsupported ? unsupportedCard(type, s, sel, ctx) : '';
  }

  widgetAdvanced(el, ctx, sel, classes);
  classes.push(...extra, 'elementor-widget', `elementor-widget-${type}`, ...visibilityClasses(s));
  if (s._css_classes) classes.push(String(s._css_classes));
  const anim = motionAttrs(ctx, s, '_animation', classes);

  const id = s._element_id ? ` id="${escapeAttr(s._element_id)}"` : '';
  return `<div class="${escapeAttr(classes.join(' '))}" data-id="${escapeAttr(el.id)}" data-element_type="widget" data-widget_type="${escapeAttr(type)}.default"${id}${anim}><div class="elementor-widget-container">${inner}</div></div>`;
};

/**
 * Cartão no lugar do widget que o motor não desenha: o nome, o resumo das
 * settings e, nas grades que vêm do banco do WordPress (listagens, posts,
 * produtos), um esqueleto com as colunas e a quantidade de cards, para a
 * página ocupar o espaço certo.
 */
const unsupportedCard = (type: string, s: Record<string, any>, sel: string, ctx: RenderContext) => {
  const summary = widgetSummary(type, s);
  let skeleton = '';
  if (summary.grid) {
    const [desktop, tablet, mobile] = summary.grid.columns;
    responsive(ctx, `${sel} .se-unsupported__grid`, (d) => `--se-cols:${Math.max(1, d === 'desktop' ? desktop : d === 'tablet' ? tablet : mobile)}`);
    const cells = Math.min(summary.grid.items, Math.max(1, desktop) * 2, 12);
    skeleton = `<div class="se-unsupported__grid" aria-hidden="true">${'<span class="se-unsupported__cell"><i></i><b></b><b></b></span>'.repeat(cells)}</div>`;
  }
  const details = summary.details.length ? `<span class="se-unsupported__details">${escapeHtml(summary.details.join(' · '))}</span>` : '';
  const note = summary.dynamic ? 'O conteúdo vem do WordPress e aparece no site publicado.' : 'O Space ainda não desenha este widget; no site ele aparece normalmente.';
  return `<div class="se-unsupported${summary.grid ? ' se-unsupported--grid' : ''}" data-se-widget="${escapeAttr(type)}"><div class="se-unsupported__head"><strong>${escapeHtml(summary.name)}</strong><code>${escapeHtml(type)}</code></div>${details}${skeleton}<p class="se-unsupported__note">${note}</p></div>`;
};

const widgetAdvanced = (el: ElementorElement, ctx: RenderContext, sel: string, classes: string[]) => {
  const s = el.settings;
  const box = `${sel} > .elementor-widget-container`;

  responsive(ctx, box, (d) => [
    dims(rv(s, '_margin', d)) && `margin:${dims(rv(s, '_margin', d))}`,
    dims(rv(s, '_padding', d)) && `padding:${dims(rv(s, '_padding', d))}`,
    dims(rv(s, '_border_radius', d)) && `border-radius:${dims(rv(s, '_border_radius', d))}`,
    ...background(s, '_background', d),
    ...border(s, '_border', d),
    transform(s, d),
  ]);
  ctx.sheet.add(box, boxShadow(s, '_box_shadow'));
  if (s._background_hover_background) responsive(ctx, `${sel}:hover > .elementor-widget-container`, (d) => background(s, '_background_hover', d));

  // Largura: inherit = 100%, auto = inline, initial = largura customizada.
  DEVICES.forEach((d) => {
    const mode = rv(s, '_element_width', d);
    if (mode) classes.push(d === 'desktop' ? `elementor-widget__width-${mode}` : `elementor-widget-${d}__width-${mode}`);
    const media = deviceMedia(d);
    if (mode === 'inherit') ctx.sheet.add(sel, ['width:100%', 'max-width:100%'], media);
    if (mode === 'auto') ctx.sheet.add(sel, ['width:auto', 'max-width:100%'], media);
    const custom = slider(rv(s, '_element_custom_width', d), '%');
    if (custom && inherited(s, '_element_width', d) === 'initial') {
      ctx.sheet.add(sel, [`width:var(--container-widget-width, ${custom})`, `max-width:${custom}`, `--container-widget-width:${custom}`, '--container-widget-flex-grow:0'], media);
    }
  });

  responsive(ctx, sel, (d) => !isEmpty(rv(s, '_z_index', d)) && `z-index:${rv(s, '_z_index', d)}`);
  flexChild(ctx, s, sel);
  positioning(ctx, s, sel, '_position', classes);
  customCss(ctx, s, sel);
};

// ---------------------------------------------------------------------------
// Containers (Flexbox / Grid)

const DIRECTION_VARS: Record<string, string[]> = {
  row: ['--container-widget-width:initial', '--container-widget-height:100%', '--container-widget-flex-grow:1', '--container-widget-align-self:stretch'],
  column: ['--container-widget-width:100%', '--container-widget-height:initial', '--container-widget-flex-grow:0', '--container-widget-align-self:initial'],
};

const gridTemplate = (v: any, fallback?: string) => {
  if (isEmpty(v) || (typeof v === 'object' && isEmpty(v.size))) return fallback;
  if (typeof v !== 'object') return `repeat(${v}, 1fr)`;
  return v.unit === 'custom' ? String(v.size) : `repeat(${v.size}, 1fr)`;
};

const renderContainer = (el: ElementorElement, ctx: RenderContext, parent: ElementorElement | null): string => {
  const s = el.settings;
  const sel = selectorFor(el);
  const boxed = (s.content_width || 'boxed') === 'boxed';
  const grid = s.container_type === 'grid';
  const layout = boxed ? `${sel} > .e-con-inner` : sel;
  const classes = [
    'elementor-element',
    `elementor-element-${el.id}`,
    grid ? 'e-grid' : 'e-flex',
    boxed ? 'e-con-boxed' : 'e-con-full',
    'e-con',
    parent ? 'e-child' : 'e-parent',
    ...visibilityClasses(s),
  ];
  if (s.css_classes) classes.push(String(s.css_classes));

  DEVICES.forEach((d: Device) => {
    const media = deviceMedia(d);

    if (grid) {
      const columns = gridTemplate(rv(s, 'grid_columns_grid', d), d === 'desktop' ? 'repeat(3, 1fr)' : d === 'mobile' && isEmpty(s.grid_columns_grid_mobile) ? 'repeat(1, 1fr)' : undefined);
      const rows = gridTemplate(rv(s, 'grid_rows_grid', d), d === 'desktop' ? 'repeat(2, 1fr)' : undefined);
      ctx.sheet.add(layout, [
        d === 'desktop' && 'display:grid',
        columns && `grid-template-columns:${columns}`,
        rows && `grid-template-rows:${rows}`,
        gaps(rv(s, 'grid_gaps', d)) && `gap:${gaps(rv(s, 'grid_gaps', d))}`,
        rv(s, 'grid_align_items', d) && `align-items:${rv(s, 'grid_align_items', d)}`,
        rv(s, 'grid_justify_items', d) && `justify-items:${rv(s, 'grid_justify_items', d)}`,
        rv(s, 'grid_justify_content', d) && `justify-content:${rv(s, 'grid_justify_content', d)}`,
        rv(s, 'grid_align_content', d) && `align-content:${rv(s, 'grid_align_content', d)}`,
        rv(s, 'grid_auto_flow', d) && `grid-auto-flow:${rv(s, 'grid_auto_flow', d)}`,
      ], media);
    } else {
      const direction = rv(s, 'flex_direction', d);
      const alignItems = rv(s, 'flex_align_items', d);
      ctx.sheet.add(layout, [
        direction && `flex-direction:${direction}`,
        rv(s, 'flex_justify_content', d) && `justify-content:${rv(s, 'flex_justify_content', d)}`,
        alignItems && `align-items:${alignItems}`,
        rv(s, 'flex_align_content', d) && `align-content:${rv(s, 'flex_align_content', d)}`,
        rv(s, 'flex_wrap', d) && `flex-wrap:${rv(s, 'flex_wrap', d)}`,
        gaps(rv(s, 'flex_gap', d)) && `gap:${gaps(rv(s, 'flex_gap', d))}`,
      ], media);
      const base = direction?.startsWith('row') ? 'row' : direction ? 'column' : undefined;
      ctx.sheet.add(sel, [
        ...(base ? DIRECTION_VARS[base] : []),
        alignItems && '--container-widget-width:calc( ( 1 - var( --container-widget-flex-grow ) ) * 100% )',
      ], media);
    }

    ctx.sheet.add(sel, [
      dims(rv(s, 'padding', d)) && `padding:${dims(rv(s, 'padding', d))}`,
      dims(rv(s, 'margin', d)) && `margin:${dims(rv(s, 'margin', d))}`,
      slider(rv(s, 'min_height', d)) && `min-height:${slider(rv(s, 'min_height', d))}`,
      dims(rv(s, 'border_radius', d)) && `border-radius:${dims(rv(s, 'border_radius', d))}`,
      !isEmpty(rv(s, 'z_index', d)) && `z-index:${rv(s, 'z_index', d)}`,
      ...background(s, 'background', d),
      ...border(s, 'border', d),
      transform(s, d),
    ], media);

    // Larguras não valem no mobile por padrão (lá o Elementor força 100%).
    const width = !boxed && slider(rv(s, 'width', d), '%');
    if (width) ctx.sheet.add(sel, [`width:${width}`, !parent && 'max-width:100%'], widthMedia(d));
    const contentWidth = boxed && slider(rv(s, 'boxed_width', d));
    if (contentWidth) ctx.sheet.add(`${sel} > .e-con-inner`, `max-width:${contentWidth}`, widthMedia(d));
  });

  if (s.overflow) ctx.sheet.add(sel, `overflow:${s.overflow}`);
  ctx.sheet.add(sel, boxShadow(s, 'box_shadow'));
  if (s.background_hover_background) responsive(ctx, `${sel}:hover`, (d) => background(s, 'background_hover', d));
  if (s.box_shadow_hover_box_shadow_type === 'yes') ctx.sheet.add(`${sel}:hover`, boxShadow(s, 'box_shadow_hover'));

  if (s.background_overlay_background) {
    const opacity = sliderNumber(s.background_overlay_opacity);
    ctx.sheet.add(`${sel}::before`, [
      'content:""',
      'position:absolute',
      'inset:0',
      'border-radius:inherit',
      'pointer-events:none',
      opacity !== undefined && `opacity:${opacity}`,
    ]);
    responsive(ctx, `${sel}::before`, (d) => background(s, 'background_overlay', d));
  }

  flexChild(ctx, s, sel);
  positioning(ctx, s, sel, 'position', classes);
  customCss(ctx, s, sel);
  const anim = motionAttrs(ctx, s, 'animation', classes);

  const children = el.elements.map((child) => renderElement(child, ctx, el)).join('');
  const tag = safeTag(s.html_tag, 'div');
  const id = s._element_id ? ` id="${escapeAttr(s._element_id)}"` : '';
  return `<${tag} class="${escapeAttr(classes.join(' '))}" data-id="${escapeAttr(el.id)}" data-element_type="container"${id}${anim}>${boxed ? `<div class="e-con-inner">${children}</div>` : children}</${tag}>`;
};

// ---------------------------------------------------------------------------
// Layout antigo: seção + colunas (Elementor < 3.6 e bibliotecas antigas)

const renderSection = (el: ElementorElement, ctx: RenderContext, parent: ElementorElement | null): string => {
  const s = el.settings;
  const sel = selectorFor(el);
  const boxed = (s.layout || 'boxed') === 'boxed';
  const gapMap: Record<string, string> = { no: '0px', narrow: '5px', default: '10px', extended: '15px', wide: '20px', wider: '30px' };
  const gap = s.gap === 'custom' ? slider(s.gap_columns_custom) || '10px' : gapMap[s.gap || 'default'];

  responsive(ctx, sel, (d) => [
    dims(rv(s, 'padding', d)) && `padding:${dims(rv(s, 'padding', d))}`,
    dims(rv(s, 'margin', d)) && `margin:${dims(rv(s, 'margin', d))}`,
    dims(rv(s, 'border_radius', d)) && `border-radius:${dims(rv(s, 'border_radius', d))}`,
    ...background(s, 'background', d),
    ...border(s, 'border', d),
  ]);
  ctx.sheet.add(sel, boxShadow(s, 'box_shadow'));
  ctx.sheet.add(`${sel} > .elementor-container`, [
    `--se-column-gap:${gap}`,
    boxed && `max-width:${slider(s.content_width) || `${ctx.kit.containerWidth}px`}`,
    s.height === 'min-height' && slider(s.custom_height) && `min-height:${slider(s.custom_height)}`,
    s.content_position && `align-items:${s.content_position === 'middle' ? 'center' : s.content_position === 'bottom' ? 'flex-end' : 'flex-start'}`,
  ]);
  customCss(ctx, s, sel);

  const classes = ['elementor-element', `elementor-element-${el.id}`, 'elementor-section', parent ? 'elementor-inner-section' : 'elementor-top-section', boxed ? 'elementor-section-boxed' : 'elementor-section-full_width', ...visibilityClasses(s)];
  if (s.css_classes) classes.push(String(s.css_classes));
  const columns = el.elements.map((child) => renderElement(child, ctx, el)).join('');
  return `<section class="${escapeAttr(classes.join(' '))}" data-id="${escapeAttr(el.id)}" data-element_type="section"><div class="elementor-container">${columns}</div></section>`;
};

const renderColumn = (el: ElementorElement, ctx: RenderContext): string => {
  const s = el.settings;
  const sel = selectorFor(el);
  const width = s._inline_size ?? s._column_size ?? 100;

  ctx.sheet.add(sel, `width:${width}%`, 'desktopUp');
  if (!isEmpty(s._inline_size_tablet)) ctx.sheet.add(sel, `width:${s._inline_size_tablet}%`, 'tabletOnly');
  if (!isEmpty(s._inline_size_mobile)) ctx.sheet.add(sel, `width:${s._inline_size_mobile}%`, 'mobile');
  responsive(ctx, `${sel} > .elementor-widget-wrap`, (d) => [
    dims(rv(s, 'padding', d)) && `padding:${dims(rv(s, 'padding', d))}`,
    ...background(s, 'background', d),
    ...border(s, 'border', d),
  ]);
  responsive(ctx, sel, (d) => dims(rv(s, 'margin', d)) && `margin:${dims(rv(s, 'margin', d))}`);
  if (s.content_position) {
    ctx.sheet.add(`${sel} > .elementor-widget-wrap`, `align-content:${s.content_position === 'center' ? 'center' : s.content_position === 'bottom' ? 'flex-end' : 'flex-start'}`);
  }
  customCss(ctx, s, sel);

  const widgets = el.elements.map((child) => renderElement(child, ctx, el)).join('');
  const classes = ['elementor-element', `elementor-element-${el.id}`, 'elementor-column', ...visibilityClasses(s)];
  if (s.css_classes) classes.push(String(s.css_classes));
  return `<div class="${escapeAttr(classes.join(' '))}" data-id="${escapeAttr(el.id)}" data-element_type="column"><div class="elementor-widget-wrap elementor-element-populated">${widgets}</div></div>`;
};
