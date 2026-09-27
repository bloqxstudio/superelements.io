import { responsive } from '../context';
import { color, cssFilters, dims, escapeAttr, escapeHtml, isEmpty, rv, slider, sliderNumber, typography } from '../css';
import { hasIcon, renderIcon } from '../icons';
import { PLACEHOLDER_IMAGE, richText, safeTag, wrapLink, type WidgetRenderer } from './shared';

const priceList: WidgetRenderer = ({ s, sel, ctx }) => {
  const heading = `${sel} .elementor-price-list-title`;
  const price = `${sel} .elementor-price-list-price`;
  const description = `${sel} .elementor-price-list-description`;
  ctx.sheet.add(heading, color(s, 'heading_color') && `color:${color(s, 'heading_color')}`);
  ctx.sheet.add(price, color(s, 'price_color') && `color:${color(s, 'price_color')}`);
  ctx.sheet.add(description, color(s, 'description_color') && `color:${color(s, 'description_color')}`);
  responsive(ctx, `${sel} .elementor-price-list-header`, (d) => typography(s, 'heading_typography', d, ctx.fonts));
  responsive(ctx, price, (d) => typography(s, 'price_typography', d, ctx.fonts));
  responsive(ctx, description, (d) => typography(s, 'description_typography', d, ctx.fonts));

  ctx.sheet.add(`${sel} .elementor-price-list-separator`, [
    `border-bottom-style:${s.separator_style || 'dotted'}`,
    `border-bottom-width:${slider(s.separator_weight) || '2px'}`,
    color(s, 'separator_color') && `border-bottom-color:${color(s, 'separator_color')}`,
    `margin-left:${slider(s.separator_spacing) || '10px'};margin-right:${slider(s.separator_spacing) || '10px'}`,
  ]);
  ctx.sheet.add(`${sel} .elementor-price-list li:not(:last-child)`, slider(s.row_gap) && `margin-bottom:${slider(s.row_gap)}`);
  ctx.sheet.add(`${sel} .elementor-price-list-image`, [
    slider(s.image_spacing) && `padding-right:${slider(s.image_spacing)}`,
  ]);
  ctx.sheet.add(`${sel} .elementor-price-list-image img`, dims(s.border_radius) && `border-radius:${dims(s.border_radius)}`);
  if (s.vertical_align) ctx.sheet.add(`${sel} .elementor-price-list-item`, `align-items:${s.vertical_align === 'top' ? 'flex-start' : s.vertical_align === 'bottom' ? 'flex-end' : 'center'}`);

  const items = (Array.isArray(s.price_list) ? s.price_list : []).map((item: any) => {
    const w = s.image_size_size === 'custom' ? Number(s.image_size_custom_dimension?.width) || undefined : undefined;
    const img = item.image?.url ? `<div class="elementor-price-list-image"><img src="${escapeAttr(item.image.url)}" alt=""${w ? ` width="${w}"` : ''} loading="lazy"></div>` : '';
    const header = `<div class="elementor-price-list-header"><span class="elementor-price-list-title">${richText(item.title)}</span><span class="elementor-price-list-separator"></span><span class="elementor-price-list-price">${richText(item.price)}</span></div>`;
    const desc = isEmpty(item.item_description) ? '' : `<p class="elementor-price-list-description">${richText(item.item_description)}</p>`;
    return `<li>${wrapLink(item.link, `<div class="elementor-price-list-item">${img}<div class="elementor-price-list-text">${header}${desc}</div></div>`, 'elementor-price-list-item-link')}</li>`;
  });
  return `<ul class="elementor-price-list">${items.join('')}</ul>`;
};

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';

const rating: WidgetRenderer = ({ s, sel, ctx }) => {
  const scale = sliderNumber(s.rating_scale) ?? 5;
  const value = Math.max(0, Math.min(scale, Number(s.rating_value ?? 5)));
  const align: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };
  responsive(ctx, `${sel} .e-rating-wrapper`, (d) => {
    const a = rv(s, 'icon_alignment', d);
    const gap = slider(rv(s, 'icon_gap', d));
    return [a && `justify-content:${align[a] || a}`, gap && `gap:${gap}`];
  });
  responsive(ctx, `${sel} .e-icon`, (d) => {
    const size = slider(rv(s, 'icon_size', d));
    return size && `font-size:${size}`;
  });
  ctx.sheet.add(`${sel} .e-icon-marked`, color(s, 'icon_color') && `fill:${color(s, 'icon_color')}`);
  ctx.sheet.add(`${sel} .e-icon-unmarked`, color(s, 'icon_unmarked_color') && `fill:${color(s, 'icon_unmarked_color')}`);

  const icons = Array.from({ length: scale }, (_, i) => {
    const fill = Math.max(0, Math.min(1, value - i));
    return `<div class="e-icon"><div class="e-icon-wrapper e-icon-marked" style="--e-rating-icon-marked-width:${Math.round(fill * 100)}%">${STAR}</div><div class="e-icon-wrapper e-icon-unmarked">${STAR}</div></div>`;
  });
  return `<div class="e-rating" itemscope><div class="e-rating-wrapper" aria-label="${value}/${scale}">${icons.join('')}</div></div>`;
};

const progress: WidgetRenderer = ({ s, sel, ctx }) => {
  const percent = Math.max(0, Math.min(100, sliderNumber(s.percent) ?? 50));
  ctx.sheet.add(`${sel} .elementor-progress-wrapper`, [
    color(s, 'bar_bg_color') && `background-color:${color(s, 'bar_bg_color')}`,
    dims(s.bar_border_radius) && `border-radius:${dims(s.bar_border_radius)}`,
  ]);
  ctx.sheet.add(`${sel} .elementor-progress-bar`, [
    color(s, 'bar_color') && `background-color:${color(s, 'bar_color')}`,
    slider(s.bar_height) && `height:${slider(s.bar_height)};line-height:${slider(s.bar_height)}`,
    color(s, 'bar_inline_color') && `color:${color(s, 'bar_inline_color')}`,
  ]);
  const titleSel = `${sel} .elementor-title`;
  ctx.sheet.add(titleSel, color(s, 'title_color') && `color:${color(s, 'title_color')}`);
  responsive(ctx, titleSel, (d) => typography(s, 'typography', d, ctx.fonts));

  const tag = safeTag(s.title_tag, 'span');
  const title = isEmpty(s.title) ? '' : `<${tag} class="elementor-title">${richText(s.title)}</${tag}>`;
  const showPercent = s.display_percentage !== '' ? `<span class="elementor-progress-percentage">${percent}%</span>` : '';
  return `${title}<div class="elementor-progress-wrapper" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="elementor-progress-bar" style="width:${percent}%"><span class="elementor-progress-text">${escapeHtml(s.inner_text || '')}</span>${showPercent}</div></div>`;
};

const googleMaps: WidgetRenderer = ({ s, sel, ctx }) => {
  responsive(ctx, `${sel} iframe`, (d) => {
    const h = slider(rv(s, 'height', d));
    return (h || d === 'desktop') && `height:${h || '300px'}`;
  });
  ctx.sheet.add(`${sel} iframe`, cssFilters(s, 'css_filters'));
  const address = encodeURIComponent(s.address || 'London Eye, London, United Kingdom');
  const zoom = sliderNumber(s.zoom) ?? 10;
  return `<div class="elementor-custom-embed"><iframe loading="lazy" src="https://maps.google.com/maps?q=${address}&amp;t=m&amp;z=${zoom}&amp;output=embed&amp;iwloc=near" title="${escapeAttr(s.address || 'Mapa')}" aria-label="${escapeAttr(s.address || 'Mapa')}"></iframe></div>`;
};

const youtubeId = (url: string) => url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1];
const vimeoId = (url: string) => url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];

const video: WidgetRenderer = ({ s, sel, ctx }) => {
  const type = s.video_type || 'youtube';
  const ratio = String(s.aspect_ratio || '169');
  const ratios: Record<string, string> = { '169': '16/9', '219': '21/9', '43': '4/3', '32': '3/2', '11': '1/1', '916': '9/16' };
  ctx.sheet.add(`${sel} .elementor-wrapper`, `aspect-ratio:${ratios[ratio] || '16/9'}`);

  let embed = '';
  if (type === 'youtube') {
    const id = youtubeId(s.youtube_url || 'https://www.youtube.com/watch?v=XHOmBV4js_E');
    if (id) embed = `<iframe class="elementor-video" src="https://www.youtube.com/embed/${id}" title="YouTube" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  } else if (type === 'vimeo') {
    const id = vimeoId(s.vimeo_url || '');
    if (id) embed = `<iframe class="elementor-video" src="https://player.vimeo.com/video/${id}" title="Vimeo" allowfullscreen loading="lazy"></iframe>`;
  } else if (type === 'hosted') {
    const url = s.insert_url === 'yes' ? s.external_url?.url : s.hosted_url?.url;
    if (url) embed = `<video class="elementor-video" src="${escapeAttr(url)}" controls playsinline></video>`;
  }

  let overlay = '';
  if (s.show_image_overlay === 'yes' && s.image_overlay?.url) {
    ctx.sheet.add(`${sel} .elementor-custom-embed-play i`, [
      color(s, 'play_icon_color') && `color:${color(s, 'play_icon_color')}`,
      slider(s.play_icon_size) && `font-size:${slider(s.play_icon_size)}`,
    ]);
    const play = s.show_play_icon !== '' ? `<div class="elementor-custom-embed-play" role="button">${hasIcon(s.play_icon) ? renderIcon(s.play_icon, ctx) : renderIcon({ value: 'fas fa-play', library: 'fa-solid' }, ctx)}</div>` : '';
    overlay = `<div class="elementor-custom-embed-image-overlay" style="background-image:url(&quot;${escapeAttr(s.image_overlay.url)}&quot;)">${play}</div>`;
  }

  return `<div class="elementor-wrapper elementor-open-inline">${embed}${overlay}</div>`;
};

const imageBox: WidgetRenderer = ({ s, sel, ctx, classes }) => {
  const position = { top: 'block-start', left: 'inline-start', right: 'inline-end' }[s.position as string] || 'block-start';
  classes.push(`elementor-position-${position}`);
  const vertical: Record<string, string> = { top: 'start', middle: 'center', bottom: 'end' };

  responsive(ctx, `${sel} .elementor-image-box-wrapper`, (d) => {
    const align = rv(s, 'text_align', d);
    const space = slider(rv(s, 'image_space', d));
    const valign = rv(s, 'content_vertical_alignment', d);
    return [align && `text-align:${align}`, (space || d === 'desktop') && `gap:${space || '15px'}`, valign && `align-items:${vertical[valign]}`];
  });
  responsive(ctx, `${sel} .elementor-image-box-img`, (d) => {
    const w = slider(rv(s, 'image_size', d), '%');
    return w && `width:${w}`;
  });
  ctx.sheet.add(`${sel} .elementor-image-box-img img`, dims(s.image_border_radius) && `border-radius:${dims(s.image_border_radius)}`);

  const titleSel = `${sel} .elementor-image-box-title`;
  ctx.sheet.add(titleSel, color(s, 'title_color') && `color:${color(s, 'title_color')}`);
  responsive(ctx, titleSel, (d) => [
    ...typography(s, 'title_typography', d, ctx.fonts),
    slider(rv(s, 'title_bottom_space', d)) && `margin-block-end:${slider(rv(s, 'title_bottom_space', d))}`,
  ]);
  const descSel = `${sel} .elementor-image-box-description`;
  ctx.sheet.add(descSel, color(s, 'description_color') && `color:${color(s, 'description_color')}`);
  responsive(ctx, descSel, (d) => typography(s, 'description_typography', d, ctx.fonts));

  let w: number | undefined;
  let h: number | undefined;
  if (s.thumbnail_size === 'custom') {
    w = Number(s.thumbnail_custom_dimension?.width) || undefined;
    h = Number(s.thumbnail_custom_dimension?.height) || undefined;
  }
  if (w && h) ctx.sheet.add(`${sel} .elementor-image-box-img img`, [`aspect-ratio:${w}/${h}`, 'object-fit:cover']);

  const link = s.link?.url ? s.link : undefined;
  const img = `<figure class="elementor-image-box-img">${wrapLink(link, `<img src="${escapeAttr(s.image?.url || PLACEHOLDER_IMAGE)}" alt=""${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''} loading="lazy">`)}</figure>`;
  const tag = safeTag(s.title_size, 'h3');
  const title = isEmpty(s.title_text) ? '' : `<${tag} class="elementor-image-box-title">${wrapLink(link, richText(s.title_text))}</${tag}>`;
  const desc = isEmpty(s.description_text) ? '' : `<p class="elementor-image-box-description">${richText(s.description_text)}</p>`;
  return `<div class="elementor-image-box-wrapper">${img}<div class="elementor-image-box-content">${title}${desc}</div></div>`;
};

/** Accordion aninhado: cada item é um <details> com o container filho dentro. */
const nestedAccordion: WidgetRenderer = ({ el, s, sel, ctx }) => {
  const titleText = `${sel} .e-n-accordion-item-title-text`;
  responsive(ctx, titleText, (d) => typography(s, 'title_typography', d, ctx.fonts));
  ctx.sheet.add(`${sel} .e-n-accordion-item-title`, color(s, 'normal_title_color') && `color:${color(s, 'normal_title_color')}`);
  ctx.sheet.add(`${sel} .e-n-accordion-item-title-icon`, color(s, 'normal_title_color') && `color:${color(s, 'normal_title_color')}`);

  const items = Array.isArray(s.items) ? s.items : [];
  const openFirst = (s.default_state || 'expanded') === 'expanded';
  const html = items.map((item: any, i: number) => {
    const child = el.elements[i] ? ctx.renderChildren([el.elements[i]], el) : '';
    return `<details class="e-n-accordion-item"${openFirst && i === 0 ? ' open' : ''}><summary class="e-n-accordion-item-title"><span class="e-n-accordion-item-title-header"><div class="e-n-accordion-item-title-text">${richText(item.item_title)}</div></span><span class="e-n-accordion-item-title-icon" aria-hidden="true"><span class="e-opened">&minus;</span><span class="e-closed">+</span></span></summary>${child}</details>`;
  });
  return `<div class="e-n-accordion">${html.join('')}</div>`;
};

export const extraWidgets: Record<string, WidgetRenderer> = {
  'price-list': priceList,
  rating,
  progress,
  google_maps: googleMaps,
  video,
  'image-box': imageBox,
  'nested-accordion': nestedAccordion,
};
