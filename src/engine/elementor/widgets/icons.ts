import { responsive, type RenderContext } from '../context';
import { border, color, dims, escapeAttr, isEmpty, logicalAlign, rv, slider, sliderNumber, typography } from '../css';
import { hasIcon, renderIcon, socialName } from '../icons';
import { linkAttrs, richText, safeTag, wrapLink, type WidgetRenderer } from './shared';

/** Cores primária/secundária de ícone conforme a "view" (default, stacked, framed). */
const iconColors = (ctx: RenderContext, iconSel: string, view: string, primary?: string, secondary?: string) => {
  if (view === 'stacked') {
    ctx.sheet.add(iconSel, [primary && `background-color:${primary}`, secondary && `color:${secondary};fill:${secondary}`]);
  } else {
    ctx.sheet.add(iconSel, [
      primary && `color:${primary};border-color:${primary};fill:${primary}`,
      view === 'framed' && secondary && `background-color:${secondary}`,
    ]);
  }
};

/** Tamanho, padding, rotação e borda do círculo/quadrado do ícone. */
const iconBoxModel = (ctx: RenderContext, s: Record<string, any>, iconSel: string, view: string) => {
  responsive(ctx, iconSel, (d) => [
    slider(rv(s, 'size', d)) && `font-size:${slider(rv(s, 'size', d))}`,
    view !== 'default' && slider(rv(s, 'icon_padding', d)) && `padding:${slider(rv(s, 'icon_padding', d))}`,
    view === 'framed' && dims(rv(s, 'border_width', d)) && `border-width:${dims(rv(s, 'border_width', d))}`,
    view !== 'default' && dims(rv(s, 'border_radius', d)) && `border-radius:${dims(rv(s, 'border_radius', d))}`,
  ]);
  const rotate = sliderNumber(s.rotate);
  if (rotate) ctx.sheet.add(`${iconSel} i, ${iconSel} .e-svg-icon`, `transform:rotate(${rotate}deg)`);
};

const icon: WidgetRenderer = ({ s, sel, ctx, classes }) => {
  const view = s.view || 'default';
  classes.push(`elementor-view-${view}`);
  if (view !== 'default') classes.push(`elementor-shape-${s.shape || 'circle'}`);

  const iconSel = `${sel} .elementor-icon`;
  iconColors(ctx, iconSel, view, color(s, 'primary_color'), color(s, 'secondary_color'));
  iconColors(ctx, `${iconSel}:hover`, view, color(s, 'hover_primary_color'), color(s, 'hover_secondary_color'));
  iconBoxModel(ctx, s, iconSel, view);
  responsive(ctx, `${sel} .elementor-icon-wrapper`, (d) => {
    const align = rv(s, 'align', d);
    return align && `text-align:${align}`;
  });

  const inner = renderIcon(s.selected_icon, ctx);
  const body = s.link?.url ? `<a class="elementor-icon"${linkAttrs(s.link)}>${inner}</a>` : `<div class="elementor-icon">${inner}</div>`;
  return `<div class="elementor-icon-wrapper">${body}</div>`;
};

const POSITION_MAP: Record<string, string> = {
  top: 'block-start',
  bottom: 'block-end',
  left: 'inline-start',
  right: 'inline-end',
};

const iconBox: WidgetRenderer = ({ s, sel, ctx, classes }) => {
  const view = s.view || 'default';
  classes.push(`elementor-view-${view}`);
  if (view !== 'default') classes.push(`elementor-shape-${s.shape || 'circle'}`);

  (['desktop', 'tablet', 'mobile'] as const).forEach((d) => {
    const raw = rv(s, 'position', d);
    const position = POSITION_MAP[raw] || raw || (d === 'desktop' ? 'block-start' : '');
    if (position) classes.push(d === 'desktop' ? `elementor-position-${position}` : `elementor-${d}-position-${position}`);
  });

  const wrapper = `${sel} .elementor-icon-box-wrapper`;
  const iconSel = `${sel} .elementor-icon`;
  const vertical: Record<string, string> = { top: 'start', middle: 'center', bottom: 'end' };

  responsive(ctx, wrapper, (d) => {
    const space = slider(rv(s, 'icon_space', d));
    const align = rv(s, 'text_align', d);
    const valign = rv(s, 'content_vertical_alignment', d);
    return [
      (space || d === 'desktop') && `gap:${space || '15px'}`,
      align && `text-align:${align}`,
      (valign || d === 'desktop') && `align-items:${vertical[valign] || 'start'}`,
    ];
  });

  iconColors(ctx, iconSel, view, color(s, 'primary_color'), color(s, 'secondary_color'));
  iconColors(ctx, `${sel}:hover .elementor-icon`, view, color(s, 'hover_primary_color'), color(s, 'hover_secondary_color'));
  responsive(ctx, iconSel, (d) => [
    slider(rv(s, 'icon_size', d)) && `font-size:${slider(rv(s, 'icon_size', d))}`,
    view !== 'default' && slider(rv(s, 'icon_padding', d)) && `padding:${slider(rv(s, 'icon_padding', d))}`,
    view === 'framed' && dims(rv(s, 'border_width', d)) && `border-width:${dims(rv(s, 'border_width', d))}`,
    view !== 'default' && dims(rv(s, 'border_radius', d)) && `border-radius:${dims(rv(s, 'border_radius', d))}`,
  ]);
  const rotate = sliderNumber(s.rotate);
  if (rotate) ctx.sheet.add(`${iconSel} i, ${iconSel} .e-svg-icon`, `transform:rotate(${rotate}deg)`);

  const titleSel = `${sel} .elementor-icon-box-title`;
  ctx.sheet.add(titleSel, color(s, 'title_color') && `color:${color(s, 'title_color')}`);
  responsive(ctx, `${titleSel}, ${titleSel} a`, (d) => typography(s, 'title_typography', d, ctx.fonts));
  responsive(ctx, titleSel, (d) => {
    const space = slider(rv(s, 'title_bottom_space', d));
    return space && `margin-block-end:${space}`;
  });
  if (color(s, 'hover_title_color')) ctx.sheet.add(`${sel}:hover .elementor-icon-box-title`, `color:${color(s, 'hover_title_color')}`);

  const descSel = `${sel} .elementor-icon-box-description`;
  ctx.sheet.add(descSel, color(s, 'description_color') && `color:${color(s, 'description_color')}`);
  responsive(ctx, descSel, (d) => typography(s, 'description_typography', d, ctx.fonts));

  const link = s.link?.url ? s.link : undefined;
  const iconHtml = hasIcon(s.selected_icon)
    ? `<div class="elementor-icon-box-icon">${link ? `<a class="elementor-icon"${linkAttrs(link)}>` : '<span class="elementor-icon">'}${renderIcon(s.selected_icon, ctx)}${link ? '</a>' : '</span>'}</div>`
    : '';
  const titleTag = safeTag(s.title_size, 'h3');
  const title = isEmpty(s.title_text) ? '' : `<${titleTag} class="elementor-icon-box-title">${wrapLink(link, `<span>${richText(s.title_text)}</span>`)}</${titleTag}>`;
  const description = isEmpty(s.description_text) ? '' : `<p class="elementor-icon-box-description">${richText(s.description_text)}</p>`;

  return `<div class="elementor-icon-box-wrapper">${iconHtml}${title || description ? `<div class="elementor-icon-box-content">${title}${description}</div>` : ''}</div>`;
};

const iconList: WidgetRenderer = ({ s, sel, ctx, classes }) => {
  const inline = s.view === 'inline';
  classes.push(`elementor-icon-list--layout-${inline ? 'inline' : 'traditional'}`, `elementor-list-item-link-${s.link_click || 'full_width'}`);

  const items = `${sel} .elementor-icon-list-items`;
  const item = `${sel} .elementor-icon-list-item`;

  responsive(ctx, sel, (d) => {
    const size = slider(rv(s, 'icon_size', d));
    return size && `--e-icon-list-icon-size:${size}`;
  });
  ctx.sheet.add(sel, [
    s.icon_self_align && `--e-icon-list-icon-align:${s.icon_self_align}`,
    s.icon_self_vertical_align && `--icon-vertical-align:${s.icon_self_vertical_align}`,
  ]);

  responsive(ctx, `${item}, ${item} a`, (d) => {
    const align = logicalAlign(rv(s, 'icon_align', d));
    return align && [`justify-content:${align}`, `text-align:${align}`];
  });
  if (inline) {
    responsive(ctx, `${items}.elementor-inline-items`, (d) => {
      const align = logicalAlign(rv(s, 'icon_align', d));
      return align && `justify-content:${align}`;
    });
  }

  (['desktop', 'tablet', 'mobile'] as const).forEach((d) => {
    const space = slider(rv(s, 'space_between', d));
    if (!space) return;
    const half = `calc(${space}/2)`;
    const media = d === 'desktop' ? 'all' : d;
    if (inline) {
      ctx.sheet.add(`${items}.elementor-inline-items .elementor-icon-list-item`, `margin-inline:${half}`, media);
      ctx.sheet.add(`${items}.elementor-inline-items`, `margin-inline:calc(-${space}/2)`, media);
      ctx.sheet.add(`${items}.elementor-inline-items .elementor-icon-list-item:after`, `inset-inline-end:calc(-${space}/2)`, media);
    } else {
      ctx.sheet.add(`${items}:not(.elementor-inline-items) .elementor-icon-list-item:not(:last-child)`, `padding-block-end:${half}`, media);
      ctx.sheet.add(`${items}:not(.elementor-inline-items) .elementor-icon-list-item:not(:first-child)`, `margin-block-start:${half}`, media);
    }
  });

  const iconColor = color(s, 'icon_color');
  if (iconColor) ctx.sheet.add(`${sel} .elementor-icon-list-icon i, ${sel} .elementor-icon-list-icon .e-svg-icon`, `color:${iconColor}`);
  const iconHover = color(s, 'icon_color_hover');
  if (iconHover) ctx.sheet.add(`${item}:hover .elementor-icon-list-icon i, ${item}:hover .elementor-icon-list-icon .e-svg-icon`, `color:${iconHover}`);

  const textSel = `${sel} .elementor-icon-list-text`;
  ctx.sheet.add(textSel, color(s, 'text_color') && `color:${color(s, 'text_color')}`);
  if (color(s, 'text_color_hover')) ctx.sheet.add(`${item}:hover .elementor-icon-list-text`, `color:${color(s, 'text_color_hover')}`);
  responsive(ctx, textSel, (d) => {
    const indent = slider(rv(s, 'text_indent', d));
    return indent && `padding-inline-start:${indent}`;
  });
  responsive(ctx, `${item} > .elementor-icon-list-text, ${item} > a`, (d) => typography(s, 'icon_typography', d, ctx.fonts));

  if (s.divider === 'yes') {
    const after = `${item}:not(:last-child):after`;
    const style = s.divider_style || 'solid';
    ctx.sheet.add(after, ['content:""', `border-color:${color(s, 'divider_color') || '#ddd'}`]);
    if (inline) {
      ctx.sheet.add(after, [`border-inline-start-style:${style}`, `border-inline-start-width:${slider(s.divider_weight) || '1px'}`, `height:${slider(s.divider_height, '%') || '100%'}`]);
    } else {
      ctx.sheet.add(after, [`border-block-start-style:${style}`, `border-block-start-width:${slider(s.divider_weight) || '1px'}`, `width:${slider(s.divider_width, '%') || '100%'}`]);
    }
  }

  const list = (Array.isArray(s.icon_list) ? s.icon_list : []).map((entry: any) => {
    const iconHtml = hasIcon(entry.selected_icon) ? `<span class="elementor-icon-list-icon">${renderIcon(entry.selected_icon, ctx)}</span>` : '';
    const body = `${iconHtml}<span class="elementor-icon-list-text">${richText(entry.text)}</span>`;
    return `<li class="elementor-icon-list-item${inline ? ' elementor-inline-item' : ''}">${wrapLink(entry.link, body)}</li>`;
  });

  return `<ul class="elementor-icon-list-items${inline ? ' elementor-inline-items' : ''}">${list.join('')}</ul>`;
};

const socialIcons: WidgetRenderer = ({ s, sel, ctx, classes }) => {
  classes.push(`elementor-shape-${s.shape || 'rounded'}`);
  const iconSel = `${sel} .elementor-social-icon`;

  const justify: Record<string, string> = { left: 'flex-start', right: 'flex-end', center: 'center', start: 'flex-start', end: 'flex-end' };
  responsive(ctx, sel, (d) => {
    const align = rv(s, 'align', d);
    return [
      align && `--justify-content:${justify[align] || 'center'}`,
      slider(rv(s, 'icon_size', d)) && `--icon-size:${slider(rv(s, 'icon_size', d))}`,
      slider(rv(s, 'icon_padding', d), 'em') && `--icon-padding:${slider(rv(s, 'icon_padding', d), 'em')}`,
      slider(rv(s, 'icon_spacing', d)) && `--grid-column-gap:${slider(rv(s, 'icon_spacing', d))}`,
      slider(rv(s, 'row_gap', d)) && `--grid-row-gap:${slider(rv(s, 'row_gap', d))}`,
    ];
  });
  responsive(ctx, `${sel} .elementor-social-icons-wrapper`, (d) => {
    const columns = rv(s, 'columns', d);
    if (isEmpty(columns)) return null;
    return String(columns) === '0' ? ['display:flex', 'grid-template-columns:none'] : ['display:inline-grid', `grid-template-columns:repeat(${columns}, auto)`];
  });
  responsive(ctx, `${sel} .elementor-widget-container`, (d) => {
    const align = rv(s, 'align', d);
    return align && `text-align:${align}`;
  });

  if (s.icon_color === 'custom') {
    ctx.sheet.add(iconSel, [
      color(s, 'icon_primary_color') && `background-color:${color(s, 'icon_primary_color')}`,
      color(s, 'icon_secondary_color') && `--e-social-icon-icon-color:${color(s, 'icon_secondary_color')}`,
    ]);
  }
  responsive(ctx, iconSel, (d) => border(s, 'image_border', d));
  responsive(ctx, `${sel} .elementor-icon`, (d) => {
    const radius = dims(rv(s, 'border_radius', d));
    return radius && `border-radius:${radius}`;
  });
  ctx.sheet.add(`${iconSel}:hover`, [
    color(s, 'hover_primary_color') && `background-color:${color(s, 'hover_primary_color')}`,
    color(s, 'hover_secondary_color') && `--e-social-icon-icon-color:${color(s, 'hover_secondary_color')}`,
    color(s, 'hover_border_color') && `border-color:${color(s, 'hover_border_color')}`,
  ]);

  const items = (Array.isArray(s.social_icon_list) ? s.social_icon_list : []).map((entry: any) => {
    const name = socialName(entry.social_icon);
    const itemClass = `elementor-repeater-item-${escapeAttr(entry._id || '')}`;
    if (entry.item_icon_color === 'custom') {
      ctx.sheet.add(`${sel} .${itemClass}.elementor-social-icon`, [
        color(entry, 'item_icon_primary_color') && `background-color:${color(entry, 'item_icon_primary_color')}`,
        color(entry, 'item_icon_secondary_color') && `--e-social-icon-icon-color:${color(entry, 'item_icon_secondary_color')}`,
      ]);
    }
    const link = entry.link?.url ? entry.link : { url: '#' };
    return `<span class="elementor-grid-item" role="listitem"><a class="elementor-icon elementor-social-icon elementor-social-icon-${escapeAttr(name)} ${itemClass}"${linkAttrs(link)}><span class="elementor-screen-only">${escapeAttr(name)}</span>${renderIcon(entry.social_icon, ctx)}</a></span>`;
  });

  return `<div class="elementor-social-icons-wrapper elementor-grid" role="list">${items.join('')}</div>`;
};

export const iconWidgets: Record<string, WidgetRenderer> = {
  icon,
  'icon-box': iconBox,
  'icon-list': iconList,
  'social-icons': socialIcons,
};
