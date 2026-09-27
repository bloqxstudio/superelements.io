/**
 * Seção de amostra da tela da marca: uma peça de cada tipo que a marca muda
 * (rótulo, título, texto, botões cheio e de contorno, divisor, cards com
 * sombra, formulário, logo e uma faixa escura), com os valores genéricos que as
 * seções do pack costumam trazer. Passa pelo mesmo `applyBrand` das seções,
 * então mostra exatamente o que elas vão receber.
 */

const px = (size: number) => ({ unit: 'px', size, sizes: [] })
const em = (size: number) => ({ unit: 'em', size, sizes: [] })
const box = (top: number, right = top, bottom = top, left = right) => ({
  unit: 'px',
  top: String(top),
  right: String(right),
  bottom: String(bottom),
  left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})

const text = (family: string, size: number, weight: number, lineHeight: number, extra: Record<string, unknown> = {}) => ({
  typography_typography: 'custom',
  typography_font_family: family,
  typography_font_size: px(size),
  typography_font_weight: String(weight),
  typography_line_height: em(lineHeight),
  ...extra,
})

const heading = (id: string, title: string, tag: string, size: number, weight: number, color: string, extra: Record<string, unknown> = {}) => ({
  id,
  elType: 'widget',
  widgetType: 'heading',
  settings: { title, header_size: tag, title_color: color, ...text('Manrope', size, weight, 1.2), ...extra },
  elements: [],
})

const paragraph = (id: string, html: string, size: number, color: string, extra: Record<string, unknown> = {}) => ({
  id,
  elType: 'widget',
  widgetType: 'text-editor',
  settings: { editor: `<p>${html}</p>`, text_color: color, ...text('Manrope', size, 400, 1.6), ...extra },
  elements: [],
})

const button = (id: string, label: string, filled: boolean, delay: number) => ({
  id,
  elType: 'widget',
  widgetType: 'button',
  settings: {
    text: label,
    ...text('Manrope', 15, 600, 1),
    background_color: filled ? '#111111' : '#FFFFFF00',
    button_text_color: filled ? '#FFFFFF' : '#111111',
    border_border: 'solid',
    border_width: box(1),
    border_color: '#111111',
    border_radius: box(6),
    text_padding: box(14, 26),
    button_background_hover_color: filled ? '#333333' : '#11111110',
    button_hover_border_color: '#111111',
    _animation: 'fadeIn',
    _animation_delay: delay,
  },
  elements: [],
})

const card = (id: string, title: string, delay: number) => ({
  id,
  elType: 'container',
  settings: {
    content_width: 'full',
    flex_direction: 'column',
    flex_gap: { unit: 'px', column: '12', row: '12', size: 12 },
    padding: box(20),
    background_background: 'classic',
    background_color: '#FFFFFF',
    border_radius: box(10),
    box_shadow_box_shadow_type: 'yes',
    box_shadow_box_shadow: { horizontal: 0, vertical: 8, blur: 24, spread: 0, color: 'rgba(0,0,0,0.08)' },
    animation: 'fadeIn',
    animation_delay: delay,
  },
  elements: [
    {
      id: `${id}i`,
      elType: 'widget',
      widgetType: 'image',
      settings: { image: { url: '', alt: '' }, image_size: 'custom', image_custom_dimension: { width: '600', height: '320' }, image_border_radius: box(6) },
      elements: [],
    },
    heading(`${id}h`, title, 'h3', 20, 700, '#111111'),
    paragraph(`${id}p`, 'Texto curto de card, no tamanho que as seções usam.', 14, '#6B7280'),
  ],
})

/** Logo de site do pack, que a marca troca pelo dela. */
const siteLogo = (id: string, file: 'king-logo-dark' | 'king-logo-light') => ({
  id,
  elType: 'widget',
  widgetType: 'image',
  settings: {
    image: { url: `https://preview.section.express/wp-content/uploads/2024/05/${file}.png`, id: '', alt: '' },
    image_size: 'custom',
    image_custom_dimension: { width: '65', height: '' },
    align: 'left',
  },
  elements: [],
})

export const SPECIMEN_ELEMENTS = [
  {
    id: 'spec0001',
    elType: 'container',
    settings: {
      content_width: 'boxed',
      boxed_width: px(760),
      flex_direction: 'column',
      flex_gap: { unit: 'px', column: '20', row: '20', size: 20 },
      padding: box(48, 32),
      background_background: 'classic',
      background_color: '#F4F4F5',
    },
    elements: [
      heading('spec0002', 'Rótulo da seção', 'p', 12, 600, '#6B7280', { typography_text_transform: 'uppercase', typography_letter_spacing: px(2), _animation: 'fadeIn' }),
      heading('spec0003', 'Um título que mostra a marca', 'h2', 40, 700, '#111111', { _animation: 'fadeIn', _animation_delay: 100 }),
      paragraph('spec0004', 'Parágrafo de apoio com a fonte, o peso e a entrelinha do texto corrido da marca. Os tamanhos continuam os da seção.', 16, '#4B5563', {
        _animation: 'fadeIn',
        _animation_delay: 200,
      }),
      {
        id: 'spec0005',
        elType: 'container',
        settings: { content_width: 'full', flex_direction: 'row', flex_gap: { unit: 'px', column: '12', row: '12', size: 12 }, padding: box(0) },
        elements: [button('spec0006', 'Ação principal', true, 300), button('spec0007', 'Saiba mais', false, 300)],
      },
      {
        id: 'spec0008',
        elType: 'widget',
        widgetType: 'divider',
        settings: { style: 'solid', weight: px(1), color: '#E5E7EB', gap: px(8) },
        elements: [],
      },
      {
        id: 'spec0009',
        elType: 'container',
        settings: { content_width: 'full', container_type: 'grid', grid_columns_grid: { unit: 'fr', size: 2 }, grid_rows_grid: { unit: 'fr', size: 1 }, grid_gaps: { unit: 'px', column: '16', row: '16' }, padding: box(0) },
        elements: [card('spec0010', 'Card com sombra', 400), card('spec0011', 'Outro card', 500)],
      },
      {
        id: 'spec0012',
        elType: 'widget',
        widgetType: 'form',
        settings: {
          form_fields: [
            { _id: 'f1', custom_id: 'name', field_type: 'text', placeholder: 'Nome', width: '50' },
            { _id: 'f2', custom_id: 'email', field_type: 'email', placeholder: 'E-mail', width: '50' },
          ],
          show_labels: '',
          button_text: 'Enviar',
          button_width: '100',
          column_gap: px(12),
          row_gap: px(12),
          field_text_color: '#111111',
          field_background_color: '#FFFFFF',
          field_border_color: '#D1D5DB',
          field_border_width: box(1),
          field_border_radius: box(4),
          field_typography_typography: 'custom',
          field_typography_font_family: 'Manrope',
          field_typography_font_size: px(14),
          button_typography_typography: 'custom',
          button_typography_font_family: 'Manrope',
          button_typography_font_size: px(15),
          button_typography_font_weight: '600',
          button_background_color: '#111111',
          button_text_color: '#FFFFFF',
          button_border_border: 'solid',
          button_border_width: box(1),
          button_border_color: '#111111',
          button_border_radius: box(6),
          button_background_hover_color: '#333333',
          button_hover_border_color: '#333333',
        },
        elements: [],
      },
    ],
  },
  {
    id: 'spec0013',
    elType: 'container',
    settings: {
      content_width: 'boxed',
      boxed_width: px(760),
      flex_direction: 'column',
      flex_gap: { unit: 'px', column: '16', row: '16', size: 16 },
      padding: box(40, 32),
      background_background: 'classic',
      background_color: '#111111',
      animation: 'fadeIn',
    },
    elements: [
      heading('spec0014', 'Faixa escura', 'p', 12, 600, '#A1A1AA', { typography_text_transform: 'uppercase', typography_letter_spacing: px(2) }),
      heading('spec0015', 'Título sobre fundo escuro', 'h2', 32, 700, '#FFFFFF'),
      {
        id: 'spec0016',
        elType: 'container',
        settings: { content_width: 'full', flex_direction: 'row', flex_gap: { unit: 'px', column: '12', row: '12', size: 12 }, padding: box(0) },
        elements: [
          { ...button('spec0017', 'Ação principal', true, 0), settings: { ...button('spec0017', '', true, 0).settings, text: 'Ação principal', background_color: '#FFFFFF', button_text_color: '#111111', border_color: '#FFFFFF' } },
          { ...button('spec0018', 'Saiba mais', false, 0), settings: { ...button('spec0018', '', false, 0).settings, text: 'Saiba mais', button_text_color: '#FFFFFF', border_color: '#FFFFFF' } },
        ],
      },
    ],
  },
]

/** A amostra com o logo do site no topo de cada faixa, para marcas que têm logo. */
export const SPECIMEN_WITH_LOGO = SPECIMEN_ELEMENTS.map((band, i) => ({
  ...band,
  elements: [siteLogo(`spec01${i}0`, i === 0 ? 'king-logo-dark' : 'king-logo-light'), ...band.elements],
}))
