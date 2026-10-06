import { responsive } from '../context';
import { border, color, dims, escapeAttr, escapeHtml, isEmpty, rv, slider, sliderNumber, textShadow, typography } from '../css';
import { hasIcon, renderIcon } from '../icons';
import { linkAttrs, richText, safeTag, type WidgetRenderer } from './shared';

const formatNumber = (value: unknown, separator: string | false) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return escapeHtml(value);
  const [int, dec] = String(n).split('.');
  const grouped = separator ? int.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : int;
  return dec ? `${grouped}.${dec}` : grouped;
};

// number_position → quanto cada pedaço (prefixo, número, sufixo) cresce na linha.
const NUMBER_POSITION: Record<string, [number, number, number]> = {
  start: [0, 0, 1],
  center: [1, 0, 1],
  end: [1, 0, 0],
  stretch: [0, 1, 0],
};

const TITLE_POSITION: Record<string, string> = {
  before: 'column',
  after: 'column-reverse',
  start: 'row',
  end: 'row-reverse',
};

const counter: WidgetRenderer = ({ s, sel, ctx }) => {
  const separator = s.thousand_separator === '' ? false : s.thousand_separator_char || ',';
  const number = formatNumber(s.ending_number ?? 100, separator);

  const grow = NUMBER_POSITION[s.number_position];
  if (grow) ctx.sheet.add(sel, [`--counter-prefix-grow:${grow[0]}`, `--counter-number-grow:${grow[1]}`, `--counter-suffix-grow:${grow[2]}`]);

  responsive(ctx, `${sel} .elementor-counter`, (d) => {
    const gap = slider(rv(s, 'title_gap', d));
    const position = TITLE_POSITION[rv(s, 'title_position', d)];
    return [gap && `gap:${gap}`, position && `flex-direction:${position}`];
  });
  responsive(ctx, `${sel} .elementor-counter-number-wrapper`, (d) => {
    const gap = slider(rv(s, 'number_gap', d));
    return [gap && `gap:${gap}`, ...typography(s, 'typography_number', d, ctx.fonts)];
  });
  ctx.sheet.add(`${sel} .elementor-counter-number-wrapper`, color(s, 'number_color') && `color:${color(s, 'number_color')}`);

  const titleSel = `${sel} .elementor-counter-title`;
  ctx.sheet.add(titleSel, [
    color(s, 'title_color') && `color:${color(s, 'title_color')}`,
    s.title_horizontal_alignment && `justify-content:${s.title_horizontal_alignment}`,
    s.title_vertical_alignment && `align-items:${s.title_vertical_alignment}`,
  ]);
  responsive(ctx, titleSel, (d) => typography(s, 'typography_title', d, ctx.fonts));

  const tag = safeTag(s.title_tag, 'div');
  const title = isEmpty(s.title) ? '' : `<${tag} class="elementor-counter-title">${richText(s.title)}</${tag}>`;
  return `<div class="elementor-counter">${title}<div class="elementor-counter-number-wrapper"><span class="elementor-counter-number-prefix">${escapeHtml(s.prefix || '')}</span><span class="elementor-counter-number" data-from-value="${escapeAttr(s.starting_number ?? 0)}" data-to-value="${escapeAttr(s.ending_number ?? 100)}">${number}</span><span class="elementor-counter-number-suffix">${escapeHtml(s.suffix || '')}</span></div></div>`;
};

const CHEVRON = (dir: 'left' | 'right') =>
  `<svg aria-hidden="true" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"><path d="${dir === 'left' ? 'M646 125C629 125 613 133 604 142L308 442C296 454 292 471 292 487 292 504 296 521 308 533L604 854C617 867 629 875 646 875 663 875 679 871 692 858 704 846 713 829 713 812 713 796 708 779 692 767L438 487 692 225C700 217 708 204 708 187 708 171 704 154 692 142 675 129 663 125 646 125Z' : 'M696 533C708 521 713 504 713 487 713 471 708 454 696 446L400 146C388 133 375 125 354 125 338 125 325 129 313 142 300 154 292 171 292 187 292 204 296 221 308 233L563 492 304 771C292 783 288 800 288 817 288 833 296 850 308 863 321 871 338 875 354 875 371 875 388 867 400 854L696 533Z'}"/></svg>`;

const arrowPosition = (s: Record<string, any>, prefix: 'previous' | 'next') => {
  const hOrientation = s[`navigation_${prefix}_icon_horizontal_orientation`] || (prefix === 'previous' ? 'start' : 'end');
  const vOrientation = s[`navigation_${prefix}_icon_vertical_orientation`] || 'center';
  const h = slider(s[`navigation_${prefix}_icon_horizontal_position`]) || '0px';
  const v = slider(s[`navigation_${prefix}_icon_vertical_position`]) || '0px';
  const decls: string[] = [];
  if (hOrientation === 'start') decls.push(`left:${h}`, 'right:auto');
  else if (hOrientation === 'end') decls.push(`right:${h}`, 'left:auto');
  else decls.push(`left:calc(50% + ${h})`);
  if (vOrientation === 'start') decls.push(`top:${v}`);
  else if (vOrientation === 'end') decls.push(`bottom:${v}`, 'top:auto');
  else decls.push(`top:calc(50% + ${v})`, 'transform:translateY(-50%)');
  return decls;
};

/**
 * Carrossel aninhado (Pro). O Elementor usa Swiper; aqui é um carrossel
 * com scroll-snap e um script pequeno para as setas e os pontos.
 */
const nestedCarousel: WidgetRenderer = ({ el, s, sel, ctx }) => {
  ctx.flags.carousel = true;
  const defaults: Record<string, number> = { desktop: 3, tablet: 2, mobile: 1 };

  responsive(ctx, sel, (d) => {
    const slides = sliderNumber(rv(s, 'slides_to_show', d)) ?? defaults[d];
    const gap = slider(rv(s, 'image_spacing_custom', d));
    return [`--e-n-carousel-slides:${slides}`, (gap || d === 'desktop') && `--e-n-carousel-gap:${gap || '10px'}`];
  });
  responsive(ctx, `${sel} .swiper-slide`, (d) => [
    dims(rv(s, 'content_padding', d)) && `padding:${dims(rv(s, 'content_padding', d))}`,
    dims(rv(s, 'border_radius', d)) && `border-radius:${dims(rv(s, 'border_radius', d))}`,
    ...border(s, 'content_border', d),
  ]);

  const arrowsOn = s.arrows !== '';
  const dotsOn = s.pagination !== '';

  ctx.sheet.add(`${sel} .elementor-swiper-button`, [
    slider(s.arrows_size) && `font-size:${slider(s.arrows_size)}`,
    color(s, 'arrow_normal_color') && `color:${color(s, 'arrow_normal_color')};fill:${color(s, 'arrow_normal_color')}`,
    dims(s.arrows_padding) && `padding:${dims(s.arrows_padding)}`,
  ]);
  if (color(s, 'arrow_hover_color')) ctx.sheet.add(`${sel} .elementor-swiper-button:hover`, `color:${color(s, 'arrow_hover_color')};fill:${color(s, 'arrow_hover_color')}`);
  ctx.sheet.add(`${sel} .elementor-swiper-button-prev`, arrowPosition(s, 'previous'));
  ctx.sheet.add(`${sel} .elementor-swiper-button-next`, arrowPosition(s, 'next'));

  const dotSize = slider(s.dots_size);
  ctx.sheet.add(`${sel} .swiper-pagination-bullet`, [
    dotSize && `width:${dotSize};height:${dotSize}`,
    color(s, 'dots_normal_color') && `background:${color(s, 'dots_normal_color')}`,
  ]);
  if (color(s, 'dots_hover_color')) ctx.sheet.add(`${sel} .swiper-pagination-bullet-active, ${sel} .swiper-pagination-bullet:hover`, `background:${color(s, 'dots_hover_color')}`);
  const dotsSel = `${sel} .swiper-pagination`;
  if (s.dots_custom_position === 'yes' || s.dots_position === 'inside') {
    // Posição customizada: os pontos flutuam sobre o carrossel, deslocados pelos offsets.
    const vertical = s.dots_vertical_position || 'bottom';
    const horizontal = s.dots_horizontal_position || 'center';
    const justify: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };
    ctx.sheet.add(dotsSel, ['position:absolute', 'left:0', 'right:0', `justify-content:${justify[horizontal] || 'center'}`]);
    responsive(ctx, dotsSel, (d) => {
      const v = slider(rv(s, 'dots_vertical_offset', d)) || (d === 'desktop' ? '0px' : undefined);
      const h = slider(rv(s, 'dots_horizontal_offset', d));
      return [
        v && vertical === 'top' && `top:${v}`,
        v && vertical === 'bottom' && `bottom:calc(-1 * ${v})`,
        v && vertical === 'middle' && `top:calc(50% + ${v})`,
        h && `transform:translateX(${h})`,
      ];
    });
  } else {
    ctx.sheet.add(dotsSel, `margin-top:${slider(s.dots_pagination_spacing) || '10px'}`);
  }

  const slides = el.elements.map(
    (child, i) => `<div class="swiper-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${el.elements.length}">${ctx.renderChildren([child], el)}</div>`,
  );

  const perView = sliderNumber(s.slides_to_show) ?? 3;
  // Um ponto por grupo, como o Swiper com slidesPerGroup = slides_to_scroll.
  const perScroll = Math.max(1, sliderNumber(s.slides_to_scroll) ?? 1);
  const pages = Math.max(1, Math.ceil((slides.length - perView) / perScroll) + 1);
  const dots = dotsOn && slides.length > perView
    ? `<div class="swiper-pagination">${Array.from({ length: pages }, (_, i) => `<span class="swiper-pagination-bullet${i === 0 ? ' swiper-pagination-bullet-active' : ''}" data-index="${i}"></span>`).join('')}</div>`
    : '';
  const arrows = arrowsOn
    ? `<div class="elementor-swiper-button elementor-swiper-button-prev" role="button" tabindex="0" aria-label="Anterior">${CHEVRON('left')}</div><div class="elementor-swiper-button elementor-swiper-button-next" role="button" tabindex="0" aria-label="Próximo">${CHEVRON('right')}</div>`
    : '';

  const scroll = ['', '_tablet', '_mobile'].map((suffix) => Math.max(1, sliderNumber(s[`slides_to_scroll${suffix}`]) ?? perScroll)).join(',');
  return `<div class="e-n-carousel"><div class="swiper-wrapper" data-se-carousel data-se-scroll="${scroll}">${slides.join('')}</div>${arrows}</div>${dots}`;
};

const H_POSITION: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
const V_POSITION: Record<string, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

/**
 * Slides (Pro): um slide por vez, cada um com fundo (cor, imagem, camada por
 * cima), título, descrição e botão. O Elementor usa Swiper; aqui é o mesmo
 * carrossel com scroll-snap do aninhado. A transição "fade" também desliza, e
 * a troca automática só roda com `motion: 'play'` (a miniatura fica parada).
 */
const slides: WidgetRenderer = ({ el, s, sel, ctx, classes }) => {
  ctx.flags.carousel = true;
  const list: Record<string, any>[] = Array.isArray(s.slides) ? s.slides.filter((item: unknown) => item && typeof item === 'object') : [];
  const navigation = s.navigation ?? 'both';
  const arrowsOn = (navigation === 'both' || navigation === 'arrows') && list.length > 1;
  const dotsOn = (navigation === 'both' || navigation === 'dots') && list.length > 1;
  const dotsOutside = s.dots_position === 'outside';

  classes.push(
    `elementor--h-position-${escapeAttr(s.slides_horizontal_position || 'center')}`,
    `elementor--v-position-${escapeAttr(s.slides_vertical_position || 'middle')}`,
    `elementor-arrows-position-${s.arrows_position === 'outside' ? 'outside' : 'inside'}`,
    `elementor-pagination-position-${dotsOutside ? 'outside' : 'inside'}`,
  );

  responsive(ctx, `${sel} .swiper-slide`, (d) => slider(rv(s, 'slides_height', d)) && `height:${slider(rv(s, 'slides_height', d))}`);
  responsive(ctx, `${sel} .swiper-slide-contents`, (d) => slider(rv(s, 'content_max_width', d), '%') && `max-width:${slider(rv(s, 'content_max_width', d), '%')}`);
  responsive(ctx, `${sel} .swiper-slide-inner`, (d) => [
    dims(rv(s, 'slides_padding', d)) && `padding:${dims(rv(s, 'slides_padding', d))}`,
    rv(s, 'slides_text_align', d) && `text-align:${rv(s, 'slides_text_align', d)}`,
  ]);
  ctx.sheet.add(`${sel} .swiper-slide-contents`, textShadow(s, 'text_shadow'));

  // Título, descrição e botão: espaço abaixo, cor e tipografia
  const heading = `${sel} .swiper-slide-inner .elementor-slide-heading`;
  const description = `${sel} .swiper-slide-inner .elementor-slide-description`;
  const button = `${sel} .swiper-slide-inner .elementor-slide-button`;
  responsive(ctx, `${heading}:not(:last-child)`, (d) => slider(rv(s, 'heading_spacing', d)) && `margin-bottom:${slider(rv(s, 'heading_spacing', d))}`);
  responsive(ctx, `${description}:not(:last-child)`, (d) => slider(rv(s, 'description_spacing', d)) && `margin-bottom:${slider(rv(s, 'description_spacing', d))}`);
  ctx.sheet.add(heading, color(s, 'heading_color') && `color:${color(s, 'heading_color')}`);
  ctx.sheet.add(description, color(s, 'description_color') && `color:${color(s, 'description_color')}`);
  responsive(ctx, heading, (d) => typography(s, 'heading_typography', d, ctx.fonts));
  responsive(ctx, description, (d) => typography(s, 'description_typography', d, ctx.fonts));
  responsive(ctx, button, (d) => typography(s, 'button_typography', d, ctx.fonts));
  const radius = slider(s.button_border_radius) || dims(s.button_border_radius);
  ctx.sheet.add(button, [
    slider(s.button_border_width) && `border-width:${slider(s.button_border_width)}`,
    radius && `border-radius:${radius}`,
    color(s, 'button_text_color') && `color:${color(s, 'button_text_color')};border-color:${color(s, 'button_text_color')}`,
    color(s, 'button_background_color') && `background-color:${color(s, 'button_background_color')}`,
    color(s, 'button_border_color') && `border-color:${color(s, 'button_border_color')}`,
  ]);
  ctx.sheet.add(`${button}:hover`, [
    color(s, 'button_hover_text_color') && `color:${color(s, 'button_hover_text_color')}`,
    color(s, 'button_hover_background_color') && `background-color:${color(s, 'button_hover_background_color')}`,
    color(s, 'button_hover_border_color') && `border-color:${color(s, 'button_hover_border_color')}`,
  ]);

  // Setas e pontos
  ctx.sheet.add(`${sel} .elementor-swiper-button`, [
    slider(s.arrows_size) && `font-size:${slider(s.arrows_size)}`,
    color(s, 'arrows_color') && `color:${color(s, 'arrows_color')};fill:${color(s, 'arrows_color')}`,
  ]);
  const dotSize = slider(s.dots_size);
  ctx.sheet.add(`${sel} .swiper-pagination-bullet`, [
    dotSize && `width:${dotSize};height:${dotSize}`,
    color(s, 'dots_color') && `background:${color(s, 'dots_color')}`,
  ]);

  const headingTag = safeTag(s.title_tag, 'div');
  const descriptionTag = safeTag(s.description_tag, 'div');
  const size = escapeAttr(s.button_size || 'sm');

  const items = list.map((slide, i) => {
    const id = String(slide._id || `${el.id}${i}`).replace(/[^\w-]/g, '');
    const item = `${sel} .elementor-repeater-item-${id}`;
    const image = slide.background_image?.url;
    ctx.sheet.add(`${item} .swiper-slide-bg`, [
      color(slide, 'background_color') && `background-color:${color(slide, 'background_color')}`,
      image && `background-image:url("${String(image).replace(/"/g, '%22')}")`,
      slide.background_size && `background-size:${slide.background_size}`,
    ]);
    const overlay = slide.background_overlay === 'yes';
    if (overlay) {
      ctx.sheet.add(`${item} .elementor-background-overlay`, [
        color(slide, 'background_overlay_color') && `background-color:${color(slide, 'background_overlay_color')}`,
        slide.background_overlay_blend_mode && `mix-blend-mode:${slide.background_overlay_blend_mode}`,
      ]);
    }
    if (slide.custom_style === 'yes') {
      ctx.sheet.add(`${item} .swiper-slide-inner`, [
        H_POSITION[slide.horizontal_position] && `justify-content:${H_POSITION[slide.horizontal_position]}`,
        V_POSITION[slide.vertical_position] && `align-items:${V_POSITION[slide.vertical_position]}`,
        slide.text_align && `text-align:${slide.text_align}`,
      ]);
      const content = color(slide, 'content_color');
      if (content) {
        ctx.sheet.add(`${item} .swiper-slide-inner .elementor-slide-heading, ${item} .swiper-slide-inner .elementor-slide-description`, `color:${content}`);
        ctx.sheet.add(`${item} .swiper-slide-inner .elementor-slide-button`, `color:${content};border-color:${content}`);
      }
      ctx.sheet.add(`${item} .swiper-slide-contents`, textShadow(slide, 'repeater_text_shadow'));
    }

    // O link vale para o slide inteiro ou só para o botão (link_click)
    const href = slide.link?.url ? linkAttrs(slide.link) : '';
    const onButton = href && slide.link_click === 'button';
    const innerTag = href && !onButton ? 'a' : 'div';
    const buttonTag = onButton ? 'a' : 'div';
    const parts = [
      !isEmpty(slide.heading) && `<${headingTag} class="elementor-slide-heading">${richText(slide.heading)}</${headingTag}>`,
      !isEmpty(slide.description) && `<${descriptionTag} class="elementor-slide-description">${richText(slide.description)}</${descriptionTag}>`,
      !isEmpty(slide.button_text) && `<${buttonTag}${onButton ? href : ''} class="elementor-button elementor-slide-button elementor-size-${size}">${escapeHtml(slide.button_text)}</${buttonTag}>`,
    ].filter(Boolean);
    return `<div class="elementor-repeater-item-${id} swiper-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${list.length}"><div class="swiper-slide-bg" role="img"></div>${overlay ? '<div class="elementor-background-overlay"></div>' : ''}<${innerTag} class="swiper-slide-inner"${innerTag === 'a' ? href : ''}><div class="swiper-slide-contents">${parts.join('')}</div></${innerTag}></div>`;
  });

  const autoplay = ctx.motion === 'play' && s.autoplay !== '' && list.length > 1 ? ` data-se-autoplay="${escapeAttr(sliderNumber(s.autoplay_speed) ?? 5000)}"` : '';
  const loop = s.infinite !== '' ? ' data-se-loop' : '';
  const dots = dotsOn
    ? `<div class="swiper-pagination">${list.map((_, i) => `<span class="swiper-pagination-bullet${i === 0 ? ' swiper-pagination-bullet-active' : ''}" data-index="${i}"></span>`).join('')}</div>`
    : '';
  const arrows = arrowsOn
    ? `<div class="elementor-swiper-button elementor-swiper-button-prev" role="button" tabindex="0" aria-label="Slide anterior">${CHEVRON('left')}</div><div class="elementor-swiper-button elementor-swiper-button-next" role="button" tabindex="0" aria-label="Próximo slide">${CHEVRON('right')}</div>`
    : '';
  return `<div class="elementor-swiper"><div class="elementor-slides-wrapper elementor-main-swiper swiper" dir="ltr"><div class="swiper-wrapper elementor-slides" data-se-carousel data-se-scroll="1,1,1"${loop}${autoplay}>${items.join('')}</div>${dotsOutside ? '' : dots}</div>${arrows}</div>${dotsOutside ? dots : ''}`;
};

const TEXT_FIELDS = new Set(['text', 'email', 'tel', 'url', 'number', 'password', 'date', 'time', 'search']);

/** Formulário (Pro). Renderiza os campos; o envio não faz nada fora do WordPress. */
const form: WidgetRenderer = ({ s, sel, ctx, classes }) => {
  const size = escapeAttr(s.input_size || 'sm');
  const showLabels = s.show_labels !== '';
  classes.push(`elementor-button-align-${s.button_align || 'stretch'}`);

  responsive(ctx, sel, (d) => {
    const col = slider(rv(s, 'column_gap', d));
    const row = slider(rv(s, 'row_gap', d));
    return [(col || d === 'desktop') && `--e-form-column-gap:${col || '10px'}`, (row || d === 'desktop') && `--e-form-row-gap:${row || '10px'}`];
  });

  const label = `${sel} .elementor-field-group > label, ${sel} .elementor-field-subgroup label`;
  ctx.sheet.add(label, color(s, 'label_color') && `color:${color(s, 'label_color')}`);
  responsive(ctx, label, (d) => typography(s, 'label_typography', d, ctx.fonts));
  if (slider(s.label_spacing)) ctx.sheet.add(`${sel} .elementor-field-group > label`, `padding-bottom:${slider(s.label_spacing)}`);

  const field = `${sel} .elementor-field-group .elementor-field`;
  ctx.sheet.add(field, color(s, 'field_text_color') && `color:${color(s, 'field_text_color')}`);
  responsive(ctx, field, (d) => typography(s, 'field_typography', d, ctx.fonts));
  const textual = `${sel} .elementor-field-group .elementor-field-textual`;
  ctx.sheet.add(textual, [
    color(s, 'field_background_color') && `background-color:${color(s, 'field_background_color')}`,
    color(s, 'field_border_color') && `border-color:${color(s, 'field_border_color')}`,
    dims(s.field_border_width) && `border-width:${dims(s.field_border_width)}`,
    dims(s.field_border_radius) && `border-radius:${dims(s.field_border_radius)}`,
  ]);

  const btn = `${sel} .elementor-button`;
  responsive(ctx, btn, (d) => [
    ...typography(s, 'button_typography', d, ctx.fonts),
    ...border(s, 'button_border', d),
    dims(rv(s, 'button_border_radius', d)) && `border-radius:${dims(rv(s, 'button_border_radius', d))}`,
    dims(rv(s, 'button_text_padding', d)) && `padding:${dims(rv(s, 'button_text_padding', d))}`,
  ]);
  ctx.sheet.add(btn, [
    color(s, 'button_background_color') && `background-color:${color(s, 'button_background_color')}`,
    color(s, 'button_text_color') && `color:${color(s, 'button_text_color')}`,
  ]);
  ctx.sheet.add(`${btn}:hover`, [
    color(s, 'button_background_hover_color') && `background-color:${color(s, 'button_background_hover_color')}`,
    color(s, 'button_hover_color') && `color:${color(s, 'button_hover_color')}`,
    color(s, 'button_hover_border_color') && `border-color:${color(s, 'button_hover_border_color')}`,
  ]);

  const fields = (Array.isArray(s.form_fields) ? s.form_fields : []).map((f: any, i: number) => {
    const type = f.field_type || 'text';
    if (type === 'hidden') return '';
    const id = escapeAttr(f.custom_id || f._id || `field_${i}`);
    const required = f.required === 'true' || f.required === 'yes' || f.required === true;
    const width = escapeAttr(f.width || '100');
    const placeholder = f.placeholder ? ` placeholder="${escapeAttr(f.placeholder)}"` : '';
    const labelHtml = f.field_label
      ? `<label for="form-field-${id}" class="elementor-field-label${showLabels ? '' : ' elementor-screen-only'}">${escapeHtml(f.field_label)}</label>`
      : '';
    const options = String(f.field_options || '').split('\n').map((o) => o.split('|')[0].trim()).filter(Boolean);

    let control: string;
    if (type === 'textarea') {
      control = `<textarea id="form-field-${id}" class="elementor-field elementor-field-textual elementor-size-${size}" rows="${escapeAttr(f.rows || 4)}"${placeholder}></textarea>`;
    } else if (type === 'select') {
      control = `<div class="elementor-field elementor-select-wrapper"><select id="form-field-${id}" class="elementor-field-textual elementor-size-${size}">${options.map((o) => `<option>${escapeHtml(o)}</option>`).join('')}</select></div>`;
    } else if (type === 'checkbox' || type === 'radio') {
      control = `<div class="elementor-field-subgroup">${options.map((o, j) => `<span class="elementor-field-option"><input type="${type}" id="form-field-${id}-${j}" name="${id}"><label for="form-field-${id}-${j}">${escapeHtml(o)}</label></span>`).join('')}</div>`;
    } else if (type === 'acceptance') {
      control = `<div class="elementor-field-subgroup"><span class="elementor-field-option"><input type="checkbox" id="form-field-${id}"><label for="form-field-${id}">${richText(f.acceptance_text || '')}</label></span></div>`;
    } else if (type === 'html') {
      control = richText(f.field_html || '');
    } else {
      control = `<input size="1" type="${TEXT_FIELDS.has(type) ? type : 'text'}" id="form-field-${id}" class="elementor-field elementor-size-${size} elementor-field-textual"${placeholder}${required ? ' required' : ''}>`;
    }

    return `<div class="elementor-field-type-${escapeAttr(type)} elementor-field-group elementor-column elementor-field-group-${id} elementor-col-${width}${required ? ' elementor-field-required' : ''}">${labelHtml}${control}</div>`;
  });

  const buttonWidth = escapeAttr(s.button_width || '100');
  const buttonIcon = hasIcon(s.selected_button_icon) ? `<span class="elementor-button-icon">${renderIcon(s.selected_button_icon, ctx)}</span>` : '';
  const submit = `<div class="elementor-field-group elementor-column elementor-field-type-submit elementor-col-${buttonWidth} e-form__buttons"><button class="elementor-button elementor-size-${escapeAttr(s.button_size || 'sm')}" type="submit"><span class="elementor-button-content-wrapper">${buttonIcon}<span class="elementor-button-text">${escapeHtml(s.button_text ?? 'Send')}</span></span></button></div>`;

  return `<form class="elementor-form" method="post" name="${escapeAttr(s.form_name || 'form')}"><div class="elementor-form-fields-wrapper elementor-labels-above">${fields.join('')}${submit}</div></form>`;
};

/**
 * Busca (Pro), skin clássica: campo e botão lado a lado, enviando `?s=` para
 * a busca do WordPress. `size` é a altura; `button_width` multiplica essa
 * altura para dar a largura mínima do botão, como no Elementor.
 */
const searchForm: WidgetRenderer = ({ el, s, sel, ctx }) => {
  const box = `${sel} .elementor-search-form__container`;
  const input = `${sel} .elementor-search-form__input`;
  const submit = `${sel} .elementor-search-form__submit`;
  const height = slider(s.size) || '50px';
  const multiplier = sliderNumber(s.button_width) ?? 1;

  ctx.sheet.add(box, [
    `min-height:${height}`,
    color(s, 'input_background_color') && `background-color:${color(s, 'input_background_color')}`,
    color(s, 'input_border_color') && `border-color:${color(s, 'input_border_color')}`,
    dims(s.border_width) && `border-style:solid;border-width:${dims(s.border_width)}`,
    slider(s.border_radius) && `border-radius:${slider(s.border_radius)}`,
  ]);
  ctx.sheet.add(input, color(s, 'input_text_color') && `color:${color(s, 'input_text_color')}`);
  if (color(s, 'input_placeholder_color')) ctx.sheet.add(`${input}::placeholder`, `color:${color(s, 'input_placeholder_color')};opacity:1`);
  responsive(ctx, input, (d) => typography(s, 'input_typography', d, ctx.fonts));
  ctx.sheet.add(submit, [
    `min-width:calc(${multiplier} * ${height})`,
    color(s, 'button_text_color') && `color:${color(s, 'button_text_color')}`,
    color(s, 'button_background_color') && `background-color:${color(s, 'button_background_color')}`,
  ]);
  ctx.sheet.add(`${submit}:hover, ${submit}:focus`, [
    color(s, 'button_text_color_hover') && `color:${color(s, 'button_text_color_hover')}`,
    color(s, 'button_background_color_hover') && `background-color:${color(s, 'button_background_color_hover')}`,
  ]);
  responsive(ctx, submit, (d) => typography(s, 'button_typography', d, ctx.fonts));

  const id = `elementor-search-form-${escapeAttr(el.id)}`;
  const label = escapeAttr(s.button_text || 'Pesquisar');
  const icon = hasIcon(s.selected_icon) ? renderIcon(s.selected_icon, ctx) : '';
  const content = s.button_type === 'text'
    ? `${icon ? `${icon} ` : ''}<span class="elementor-search-form__submit-text">${escapeHtml(s.button_text || 'Pesquisar')}</span>`
    : renderIcon({ value: 'fas fa-search', library: 'fa-solid' }, ctx) + '<span class="elementor-screen-only">Pesquisar</span>';
  return `<search role="search"><form class="elementor-search-form" action="/" method="get"><div class="elementor-search-form__container"><label class="elementor-screen-only" for="${id}">${label}</label><input id="${id}" placeholder="${escapeAttr(s.placeholder ?? 'Pesquisar...')}" class="elementor-search-form__input" type="search" name="s" value=""><button class="elementor-search-form__submit" type="submit" aria-label="${label}">${content}</button></div></form></search>`;
};

export const proWidgets: Record<string, WidgetRenderer> = {
  counter,
  'nested-carousel': nestedCarousel,
  slides,
  form,
  'search-form': searchForm,
};
