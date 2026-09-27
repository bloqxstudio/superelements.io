import { responsive } from '../context';
import {
  background,
  border,
  boxShadow,
  color,
  cssFilters,
  dims,
  escapeAttr,
  escapeHtml,
  isEmpty,
  rv,
  slider,
  textShadow,
  typography,
} from '../css';
import { hasIcon, renderIcon } from '../icons';
import { autop, PLACEHOLDER_IMAGE, richText, safeTag, wrapLink, type WidgetRenderer } from './shared';

const heading: WidgetRenderer = ({ s, sel, ctx }) => {
  const tag = safeTag(s.header_size, 'h2');
  const title = `${sel} .elementor-heading-title`;

  responsive(ctx, sel, (d) => {
    const align = rv(s, 'align', d);
    return align && `text-align:${align}`;
  });
  ctx.sheet.add(title, [color(s, 'title_color') && `color:${color(s, 'title_color')}`, textShadow(s, 'text_shadow'), s.blend_mode && `mix-blend-mode:${s.blend_mode}`]);
  responsive(ctx, title, (d) => typography(s, 'typography', d, ctx.fonts));
  if (color(s, 'title_hover_color')) ctx.sheet.add(`${title}:hover`, `color:${color(s, 'title_hover_color')}`);

  const content = wrapLink(s.link, richText(s.title));
  return `<${tag} class="elementor-heading-title elementor-size-${escapeAttr(s.size || 'default')}">${content}</${tag}>`;
};

const textEditor: WidgetRenderer = ({ s, sel, ctx }) => {
  responsive(ctx, sel, (d) => {
    const align = rv(s, 'align', d);
    return [align && `text-align:${align}`, ...typography(s, 'typography', d, ctx.fonts)];
  });
  ctx.sheet.add(sel, [color(s, 'text_color') && `color:${color(s, 'text_color')}`, textShadow(s, 'text_shadow')]);
  responsive(ctx, `${sel} p`, (d) => {
    const spacing = slider(rv(s, 'paragraph_spacing', d));
    return spacing && `margin-block-end:${spacing}`;
  });
  responsive(ctx, `${sel} .elementor-widget-container`, (d) => {
    const columns = rv(s, 'text_columns', d);
    return !isEmpty(columns) && [`columns:${columns}`, slider(rv(s, 'column_gap', d)) && `column-gap:${slider(rv(s, 'column_gap', d))}`];
  });
  if (color(s, 'link_color')) ctx.sheet.add(`${sel} a`, `color:${color(s, 'link_color')}`);

  return autop(richText(s.editor));
};

// Tamanhos de imagem do WordPress com corte fixo (os outros só limitam a caixa).
const CROPPED_SIZES: Record<string, [number, number]> = { thumbnail: [150, 150] };

const image: WidgetRenderer = ({ s, sel, ctx }) => {
  const img = s.image || {};
  const src = img.url || PLACEHOLDER_IMAGE;
  const imgSel = `${sel} img`;

  responsive(ctx, sel, (d) => {
    const align = rv(s, 'align', d);
    return align && `text-align:${align}`;
  });
  responsive(ctx, imgSel, (d) => [
    slider(rv(s, 'width', d)) && `width:${slider(rv(s, 'width', d))}`,
    slider(rv(s, 'space', d)) && `max-width:${slider(rv(s, 'space', d))}`,
    slider(rv(s, 'height', d)) && `height:${slider(rv(s, 'height', d))}`,
    rv(s, 'object-fit', d) && `object-fit:${rv(s, 'object-fit', d)}`,
    rv(s, 'object-position', d) && `object-position:${rv(s, 'object-position', d)}`,
    dims(rv(s, 'image_border_radius', d)) && `border-radius:${dims(rv(s, 'image_border_radius', d))}`,
    ...border(s, 'image_border', d),
  ]);
  ctx.sheet.add(imgSel, [
    boxShadow(s, 'image_box_shadow'),
    !isEmpty(s.opacity?.size) && `opacity:${s.opacity.size}`,
    cssFilters(s, 'css_filters'),
  ]);
  ctx.sheet.add(`${sel}:hover img`, [
    cssFilters(s, 'css_filters_hover'),
    !isEmpty(s.opacity_hover?.size) && `opacity:${s.opacity_hover.size}`,
  ]);

  let width: number | undefined;
  let height: number | undefined;
  if (s.image_size === 'custom') {
    width = Number(s.image_custom_dimension?.width) || undefined;
    height = Number(s.image_custom_dimension?.height) || undefined;
  } else if (CROPPED_SIZES[s.image_size]) {
    [width, height] = CROPPED_SIZES[s.image_size];
  }
  // O Elementor gera um recorte nessas dimensões; aqui simulamos com aspect-ratio.
  if (width && height) ctx.sheet.add(imgSel, [`aspect-ratio:${width}/${height}`, 'object-fit:cover']);

  const attrs = [
    `src="${escapeAttr(src)}"`,
    `alt="${escapeAttr(img.alt || '')}"`,
    width && `width="${width}"`,
    height && `height="${height}"`,
    'loading="lazy"',
    'decoding="async"',
  ].filter(Boolean);
  let html = `<img ${attrs.join(' ')}>`;

  const link = s.link_to === 'custom' ? s.link : s.link_to === 'file' ? { url: img.url } : undefined;
  html = wrapLink(link, html);

  if (s.caption_source === 'custom' && s.caption) {
    ctx.sheet.add(`${sel} .widget-image-caption`, [color(s, 'caption_color') && `color:${color(s, 'caption_color')}`]);
    html = `<figure class="wp-caption">${html}<figcaption class="widget-image-caption wp-caption-text">${escapeHtml(s.caption)}</figcaption></figure>`;
  }
  return html;
};

const button: WidgetRenderer = ({ s, sel, ctx }) => {
  const btn = `${sel} .elementor-button`;
  const hover = `${btn}:hover, ${btn}:focus`;

  responsive(ctx, `${sel} .elementor-button-wrapper`, (d) => {
    const align = rv(s, 'align', d);
    return align && align !== 'justify' && `text-align:${align}`;
  });
  responsive(ctx, btn, (d) => {
    const align = rv(s, 'align', d);
    return [
      align && `width:${align === 'justify' ? '100%' : 'auto'}`,
      ...typography(s, 'typography', d, ctx.fonts),
      ...(s.button_background_background ? background(s, 'button_background', d) : s.background_background ? background(s, 'background', d) : []),
      ...border(s, 'border', d),
      dims(rv(s, 'border_radius', d)) && `border-radius:${dims(rv(s, 'border_radius', d))}`,
      dims(rv(s, 'text_padding', d)) && `padding:${dims(rv(s, 'text_padding', d))}`,
    ];
  });

  const textColor = color(s, 'button_text_color');
  const bgColor = !s.button_background_background && !s.background_background ? color(s, 'background_color') : undefined;
  ctx.sheet.add(btn, [
    textColor && `fill:${textColor}`,
    textColor && `color:${textColor}`,
    bgColor && `background-color:${bgColor}`,
    boxShadow(s, 'button_box_shadow'),
    textShadow(s, 'text_shadow'),
  ]);

  const hoverColor = color(s, 'hover_color');
  const hoverBg = color(s, 'button_background_hover_color');
  ctx.sheet.add(hover, [
    hoverColor && `color:${hoverColor}`,
    hoverBg && `background-color:${hoverBg}`,
    color(s, 'button_hover_border_color') && `border-color:${color(s, 'button_hover_border_color')}`,
  ]);
  if (hoverColor) ctx.sheet.add(`${btn}:hover svg, ${btn}:focus svg`, `fill:${hoverColor}`);
  if (s.button_background_hover_background) {
    responsive(ctx, hover, (d) => background(s, 'button_background_hover', d));
  }

  responsive(ctx, `${sel} .elementor-button-content-wrapper`, (d) => {
    const align = rv(s, 'content_align', d);
    return align && `justify-content:${align}`;
  });

  const iconAfter = s.icon_align === 'right' || s.icon_align === 'row-reverse';
  const indent = slider(s.icon_indent);
  ctx.sheet.add(`${sel} .elementor-button-content-wrapper`, [iconAfter && 'flex-direction:row-reverse', indent && `gap:${indent}`]);

  const icon = hasIcon(s.selected_icon) ? `<span class="elementor-button-icon">${renderIcon(s.selected_icon, ctx)}</span>` : '';
  const text = isEmpty(s.text) ? '' : `<span class="elementor-button-text">${richText(s.text)}</span>`;
  const size = escapeAttr(s.size || 'sm');
  const link = s.link?.url ? s.link : { url: '#' };
  const hoverAnimation = s.hover_animation ? ` elementor-animation-${escapeAttr(s.hover_animation)}` : '';

  return `<div class="elementor-button-wrapper">${wrapLink(link, `<span class="elementor-button-content-wrapper">${icon}${text}</span>`, `elementor-button elementor-button-link elementor-size-${size}${hoverAnimation}`)}</div>`;
};

const spacer: WidgetRenderer = ({ s, sel, ctx }) => {
  responsive(ctx, sel, (d) => {
    const size = slider(rv(s, 'space', d));
    return (size || d === 'desktop') && `--spacer-size:${size || '50px'}`;
  });
  return '<div class="elementor-spacer"><div class="elementor-spacer-inner"></div></div>';
};

const divider: WidgetRenderer = ({ s, sel, ctx, classes }) => {
  const look = s.look || 'line';
  classes.push(`elementor-widget-divider--view-${look}`);
  if (look !== 'line') {
    const align = s.text_align === 'left' ? 'start' : s.text_align === 'right' ? 'end' : 'center';
    classes.push(`elementor-widget-divider--element-align-${align}`);
  }

  // O Elementor emite os valores padrão dos controles mesmo quando não estão no JSON.
  ctx.sheet.add(sel, [
    `--divider-border-style:${s.style || 'solid'}`,
    color(s, 'color') && `--divider-color:${color(s, 'color')}`,
  ]);
  responsive(ctx, sel, (d) => {
    const weight = slider(rv(s, 'weight', d));
    const iconSize = slider(rv(s, 'icon_size', d));
    const spacing = slider(rv(s, look === 'line_icon' ? 'icon_spacing' : 'text_spacing', d));
    return [weight && `--divider-border-width:${weight}`, iconSize && `--divider-icon-size:${iconSize}`, spacing && `--divider-element-spacing:${spacing}`];
  });
  responsive(ctx, `${sel} .elementor-divider-separator`, (d) => {
    const width = slider(rv(s, 'width', d), '%');
    const align = rv(s, 'align', d);
    return [
      (width || d === 'desktop') && `width:${width || '100%'}`,
      align === 'left' && 'margin:0 auto;margin-left:0',
      align === 'right' && 'margin:0 auto;margin-right:0',
      align === 'center' && 'margin:0 auto',
    ];
  });
  responsive(ctx, `${sel} .elementor-divider`, (d) => {
    const gap = slider(rv(s, 'gap', d));
    const align = rv(s, 'align', d);
    return [
      (gap || d === 'desktop') && `padding-block-start:${gap || '15px'};padding-block-end:${gap || '15px'}`,
      align && `text-align:${align}`,
    ];
  });

  let element = '';
  if (look === 'line_text' && !isEmpty(s.text)) {
    const tag = safeTag(s.html_tag, 'span');
    const textSel = `${sel} .elementor-divider__text`;
    ctx.sheet.add(textSel, color(s, 'text_color') && `color:${color(s, 'text_color')}`);
    responsive(ctx, textSel, (d) => typography(s, 'typography', d, ctx.fonts));
    element = `<${tag} class="elementor-divider__text elementor-divider__element">${richText(s.text)}</${tag}>`;
  } else if (look === 'line_icon' && hasIcon(s.icon)) {
    const view = s.icon_view || 'default';
    classes.push(`elementor-view-${view}`);
    const iconSel = `${sel} .elementor-icon`;
    const primary = color(s, 'primary_color');
    const secondary = color(s, 'secondary_color');
    if (view === 'stacked') {
      ctx.sheet.add(iconSel, [primary && `background-color:${primary}`, secondary && `color:${secondary};fill:${secondary}`]);
    } else {
      ctx.sheet.add(iconSel, [primary && `color:${primary};border-color:${primary};fill:${primary}`, view === 'framed' && secondary && `background-color:${secondary}`]);
    }
    ctx.sheet.add(iconSel, [
      slider(s.icon_padding) && `padding:${slider(s.icon_padding)}`,
      slider(s.icon_border_width) && `border-width:${slider(s.icon_border_width)}`,
    ]);
    element = `<div class="elementor-icon elementor-divider__element">${renderIcon(s.icon, ctx)}</div>`;
  }

  return `<div class="elementor-divider"><span class="elementor-divider-separator">${element}</span></div>`;
};

// O widget HTML é código intencional do autor do componente: sai como está.
const html: WidgetRenderer = ({ s }) => String(s.html ?? '');

export const basicWidgets: Record<string, WidgetRenderer> = {
  heading,
  'text-editor': textEditor,
  image,
  button,
  spacer,
  divider,
  html,
};
