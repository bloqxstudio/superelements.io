import type { PackEntry } from './pack';

type ElementorNode = {
  id: string;
  elType: 'container' | 'widget';
  settings: Record<string, unknown>;
  elements: ElementorNode[];
  widgetType?: string;
  isInner?: boolean;
};

type Preset = {
  entry: PackEntry;
  raw: string;
};

const spacing = (top: number, right = top, bottom = top, left = right) => ({
  unit: 'px',
  top: String(top),
  right: String(right),
  bottom: String(bottom),
  left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
});

const heading = (
  id: string,
  title: string,
  size: number,
  color: string,
  weight = '700',
  tag = 'h2',
  extra: Record<string, unknown> = {},
): ElementorNode => ({
  id,
  elType: 'widget',
  widgetType: 'heading',
  isInner: false,
  elements: [],
  settings: {
    title,
    header_size: tag,
    title_color: color,
    typography_typography: 'custom',
    typography_font_family: 'Inter',
    typography_font_size: { unit: 'px', size, sizes: [] },
    typography_font_size_tablet: { unit: 'px', size: Math.round(size * 0.84), sizes: [] },
    typography_font_size_mobile: { unit: 'px', size: Math.max(15, Math.round(size * 0.62)), sizes: [] },
    typography_font_weight: weight,
    typography_line_height: { unit: 'em', size: size > 24 ? 1.04 : 1.35, sizes: [] },
    typography_letter_spacing: { unit: 'px', size: size > 24 ? -1.8 : 0, sizes: [] },
    _margin: spacing(0),
    ...extra,
  },
});

const text = (id: string, content: string, color: string, extra: Record<string, unknown> = {}): ElementorNode => ({
  id,
  elType: 'widget',
  widgetType: 'text-editor',
  isInner: false,
  elements: [],
  settings: {
    editor: `<p>${content}</p>`,
    text_color: color,
    typography_typography: 'custom',
    typography_font_family: 'Inter',
    typography_font_size: { unit: 'px', size: 17, sizes: [] },
    typography_font_size_mobile: { unit: 'px', size: 15, sizes: [] },
    typography_line_height: { unit: 'em', size: 1.6, sizes: [] },
    _margin: spacing(0),
    ...extra,
  },
});

const button = (id: string, label: string, background: string, color: string): ElementorNode => ({
  id,
  elType: 'widget',
  widgetType: 'button',
  isInner: false,
  elements: [],
  settings: {
    text: label,
    typography_typography: 'custom',
    typography_font_family: 'Inter',
    typography_font_size: { unit: 'px', size: 14, sizes: [] },
    typography_font_weight: '700',
    button_text_color: color,
    background_color: background,
    button_background_hover_color: background,
    border_radius: spacing(999),
    text_padding: spacing(15, 24),
  },
});

const container = (
  id: string,
  settings: Record<string, unknown>,
  elements: ElementorNode[],
): ElementorNode => ({ id, elType: 'container', isInner: true, settings, elements });

const document = (title: string, root: ElementorNode) => JSON.stringify({
  content: [root],
  page_settings: [],
  version: '0.4',
  title,
  type: 'container',
});

const ROOT_BASE = {
  content_width: 'full',
  flex_direction: 'column',
  flex_justify_content: 'center',
  overflow: 'hidden',
  min_height: { unit: 'px', size: 600, sizes: [] },
  min_height_tablet: { unit: 'px', size: 560, sizes: [] },
  min_height_mobile: { unit: 'px', size: 620, sizes: [] },
  padding: spacing(72, 40),
  padding_tablet: spacing(56, 32),
  padding_mobile: spacing(42, 20),
};

const CONTENT_BASE = {
  content_width: 'full',
  flex_direction: 'column',
  flex_gap: { column: '22', row: '22', isLinked: true, unit: 'px', size: 22 },
  width: { unit: '%', size: 100, sizes: [] },
  z_index: 2,
};

const PRESETS: Preset[] = [
  {
    entry: {
      id: 'fundo-pontilhado-glow',
      kind: 'section',
      type: 'container',
      title: 'Fundo 01 · Pontilhado + glow',
      file: 'builtins/fundo-pontilhado-glow.json',
      bytes: 0,
      widgets: { heading: 2, 'text-editor': 1, button: 1 },
    },
    raw: document('Fundo 01 · Pontilhado + glow', container('f101a001', {
      ...ROOT_BASE,
      background_background: 'classic',
      background_color: '#F5F7F2',
      custom_css: `
selector { position: relative; isolation: isolate; background-image: radial-gradient(circle at center, rgba(27,56,43,.15) 1.1px, transparent 1.1px); background-size: 18px 18px; }
selector::before { content:""; position:absolute; width:520px; height:520px; right:-120px; top:-210px; border-radius:50%; background:#C8FF62; filter:blur(90px); opacity:.5; pointer-events:none; }
selector::after { content:""; position:absolute; width:380px; height:380px; left:-160px; bottom:-220px; border-radius:50%; background:#8EC5FF; filter:blur(100px); opacity:.42; pointer-events:none; }
selector > .elementor-element { position:relative; z-index:1; }
@media (max-width:767px) { selector::before { width:340px; height:340px; right:-180px; top:-80px; } selector::after { opacity:.26; } }
`,
    }, [container('f101a002', {
      ...CONTENT_BASE,
      boxed_width: { unit: 'px', size: 1120, sizes: [] },
      flex_align_items: 'flex-start',
      custom_css: 'selector { max-width:1120px; margin-inline:auto; } selector .elementor-widget-heading:first-child { padding:9px 14px; border:1px solid rgba(27,56,43,.14); border-radius:999px; background:rgba(255,255,255,.62); backdrop-filter:blur(10px); }',
    }, [
      heading('f101a003', 'CAMADA VISUAL · SUAVE', 12, '#315444', '700', 'p', { typography_letter_spacing: { unit: 'px', size: 1.4, sizes: [] }, _element_width: 'auto' }),
      heading('f101a004', 'Mais profundidade sem disputar atenção com o conteúdo.', 66, '#173328', '750', 'h2', { _element_width: 'initial', _element_custom_width: { unit: 'px', size: 820, sizes: [] } }),
      text('f101a005', 'Pontilhado fino, dois focos de luz e transparência controlada para compor heroes, chamadas e aberturas editoriais.', '#50645B', { _element_width: 'initial', _element_custom_width: { unit: 'px', size: 600, sizes: [] } }),
      button('f101a006', 'Explorar composição', '#173328', '#FFFFFF'),
    ])])),
  },
  {
    entry: {
      id: 'fundo-aurora-editorial',
      kind: 'section',
      type: 'container',
      title: 'Fundo 02 · Aurora editorial',
      file: 'builtins/fundo-aurora-editorial.json',
      bytes: 0,
      widgets: { heading: 3, 'text-editor': 1 },
    },
    raw: document('Fundo 02 · Aurora editorial', container('f202a001', {
      ...ROOT_BASE,
      background_background: 'classic',
      background_color: '#0C1017',
      custom_css: `
selector { position:relative; isolation:isolate; background-image:radial-gradient(circle at 74% 14%, rgba(158,255,97,.2), transparent 28%), radial-gradient(circle at 15% 86%, rgba(90,91,255,.28), transparent 34%), linear-gradient(135deg,#0c1017 0%,#11172a 58%,#0b1210 100%); }
selector::before { content:""; position:absolute; inset:-25%; background:conic-gradient(from 220deg at 58% 48%, transparent 0 18%, rgba(112,229,255,.2) 27%, rgba(195,107,255,.26) 38%, transparent 52%); filter:blur(54px); transform:rotate(-8deg); pointer-events:none; }
selector::after { content:""; position:absolute; inset:0; opacity:.17; background-image:radial-gradient(rgba(255,255,255,.7) .7px,transparent .7px); background-size:5px 5px; pointer-events:none; mask-image:linear-gradient(to bottom,black,transparent 72%); }
selector > .elementor-element { position:relative; z-index:1; }
`,
    }, [container('f202a002', {
      ...CONTENT_BASE,
      flex_align_items: 'center',
      custom_css: 'selector { max-width:940px; margin-inline:auto; text-align:center; } selector::before { content:""; width:72px; height:1px; background:linear-gradient(90deg,transparent,#b9ff8b,transparent); margin-bottom:8px; }',
    }, [
      heading('f202a003', 'AURORA / 02', 12, '#B9FF8B', '700', 'p', { typography_letter_spacing: { unit: 'px', size: 2, sizes: [] } }),
      heading('f202a004', 'Uma atmosfera digital com presença editorial.', 68, '#F6F7F4', '700'),
      text('f202a005', 'Blurs coloridos criam movimento visual sem animação. O grão discreto reduz o aspecto excessivamente liso dos gradientes.', '#BBC3D1', { _element_width: 'initial', _element_custom_width: { unit: 'px', size: 650, sizes: [] } }),
      heading('f202a006', 'IDEAL PARA LANÇAMENTOS · PRODUTOS · EVENTOS', 11, '#7F8999', '600', 'p', { typography_letter_spacing: { unit: 'px', size: 1.3, sizes: [] } }),
    ])])),
  },
  {
    entry: {
      id: 'fundo-grid-spotlight',
      kind: 'section',
      type: 'container',
      title: 'Fundo 03 · Grid + spotlight',
      file: 'builtins/fundo-grid-spotlight.json',
      bytes: 0,
      widgets: { heading: 5, 'text-editor': 1 },
    },
    raw: document('Fundo 03 · Grid + spotlight', container('f303a001', {
      ...ROOT_BASE,
      background_background: 'classic',
      background_color: '#07120F',
      custom_css: `
selector { position:relative; isolation:isolate; background-image:linear-gradient(rgba(130,255,193,.075) 1px,transparent 1px),linear-gradient(90deg,rgba(130,255,193,.075) 1px,transparent 1px),radial-gradient(circle at 50% 12%,rgba(75,255,167,.2),transparent 38%); background-size:38px 38px,38px 38px,100% 100%; }
selector::before { content:""; position:absolute; inset:0; background:linear-gradient(to bottom,transparent 44%,#07120f 96%); pointer-events:none; }
selector > .elementor-element { position:relative; z-index:1; }
selector .fx-metric { border:1px solid rgba(163,255,208,.13); border-radius:20px; background:rgba(8,30,23,.66); box-shadow:inset 0 1px rgba(255,255,255,.04),0 18px 60px rgba(0,0,0,.18); backdrop-filter:blur(12px); }
@media(max-width:767px){ selector { background-size:28px 28px,28px 28px,100% 100%; } }
`,
    }, [container('f303a002', {
      ...CONTENT_BASE,
      custom_css: 'selector { max-width:1120px; margin-inline:auto; }',
    }, [
      heading('f303a003', 'VISÃO OPERACIONAL', 12, '#7EF5B8', '700', 'p', { typography_letter_spacing: { unit: 'px', size: 1.5, sizes: [] } }),
      heading('f303a004', 'O cenário inteiro, sem perder o detalhe.', 58, '#F1FFF7', '700', 'h2', { _element_width: 'initial', _element_custom_width: { unit: 'px', size: 720, sizes: [] } }),
      text('f303a005', 'Grid técnico e foco de luz ajudam a organizar interfaces orientadas a dados, operações e tecnologia.', '#9CB8AA', { _element_width: 'initial', _element_custom_width: { unit: 'px', size: 570, sizes: [] } }),
      container('f303a006', {
        content_width: 'full', flex_direction: 'row', flex_direction_mobile: 'column', flex_gap: { column: '16', row: '16', isLinked: true, unit: 'px', size: 16 },
      }, [
        container('f303a007', { ...CONTENT_BASE, css_classes: 'fx-metric', width: { unit: '%', size: 33.33, sizes: [] }, padding: spacing(24), flex_gap: { column: '5', row: '5', isLinked: true, unit: 'px', size: 5 } }, [heading('f303a008', '98,4%', 36, '#F4FFF8', '700'), heading('f303a009', 'pedidos processados', 13, '#83A393', '500', 'p')]),
        container('f303a010', { ...CONTENT_BASE, css_classes: 'fx-metric', width: { unit: '%', size: 33.33, sizes: [] }, padding: spacing(24), flex_gap: { column: '5', row: '5', isLinked: true, unit: 'px', size: 5 } }, [heading('f303a011', '12 min', 36, '#F4FFF8', '700'), heading('f303a012', 'tempo médio', 13, '#83A393', '500', 'p')]),
        container('f303a013', { ...CONTENT_BASE, css_classes: 'fx-metric', width: { unit: '%', size: 33.33, sizes: [] }, padding: spacing(24), flex_gap: { column: '5', row: '5', isLinked: true, unit: 'px', size: 5 } }, [heading('f303a014', '+18%', 36, '#7EF5B8', '700'), heading('f303a015', 'eficiência no turno', 13, '#83A393', '500', 'p')]),
      ]),
    ])])),
  },
  {
    entry: {
      id: 'fundo-orbital-cards',
      kind: 'section',
      type: 'container',
      title: 'Fundo 04 · Orbital + cards',
      file: 'builtins/fundo-orbital-cards.json',
      bytes: 0,
      widgets: { heading: 4, 'text-editor': 1, button: 1 },
    },
    raw: document('Fundo 04 · Orbital + cards', container('f404a001', {
      ...ROOT_BASE,
      background_background: 'classic',
      background_color: '#FFF8EF',
      custom_css: `
selector { position:relative; isolation:isolate; background-image:radial-gradient(circle at 86% 88%,rgba(255,125,69,.16),transparent 30%); }
selector::before,selector::after { content:""; position:absolute; border-radius:50%; pointer-events:none; }
selector::before { width:620px; height:620px; right:-120px; top:-120px; border:1px solid rgba(65,41,28,.11); box-shadow:0 0 0 54px rgba(65,41,28,.025),0 0 0 108px rgba(65,41,28,.02); }
selector::after { width:18px; height:18px; right:27%; top:16%; background:#ff7043; box-shadow:0 0 0 10px rgba(255,112,67,.12); }
selector > .elementor-element { position:relative; z-index:1; }
selector .fx-note { border:1px solid rgba(61,42,31,.1); border-radius:22px; background:rgba(255,255,255,.72); box-shadow:0 20px 60px rgba(72,48,31,.08); backdrop-filter:blur(10px); transform:rotate(2deg); }
@media(max-width:767px){ selector::before { width:360px; height:360px; right:-210px; top:30px; } selector .fx-note { transform:none; } }
`,
    }, [container('f404a002', {
      content_width: 'full', flex_direction: 'row', flex_direction_tablet: 'column', flex_direction_mobile: 'column', flex_align_items: 'center', flex_gap: { column: '54', row: '54', isLinked: true, unit: 'px', size: 54 },
      custom_css: 'selector { max-width:1120px; margin-inline:auto; }',
    }, [
      container('f404a003', { ...CONTENT_BASE, width: { unit: '%', size: 62, sizes: [] }, flex_align_items: 'flex-start' }, [
        heading('f404a004', 'COMPOSIÇÃO ORBITAL', 12, '#A54E31', '700', 'p', { typography_letter_spacing: { unit: 'px', size: 1.4, sizes: [] } }),
        heading('f404a005', 'Elementos que conduzem o olhar pela página.', 60, '#35251D', '750'),
        text('f404a006', 'Círculos, órbitas e cards translúcidos funcionam como uma moldura para o conteúdo — com personalidade, mas sem ruído.', '#745F53'),
        button('f404a007', 'Usar este bloco', '#FF7043', '#FFFFFF'),
      ]),
      container('f404a008', { ...CONTENT_BASE, css_classes: 'fx-note', width: { unit: '%', size: 38, sizes: [] }, padding: spacing(30), flex_gap: { column: '14', row: '14', isLinked: true, unit: 'px', size: 14 } }, [
        heading('f404a009', '04', 13, '#FF7043', '700', 'p'),
        heading('f404a010', 'Mais visual.<br>Mais memorável.', 34, '#35251D', '700'),
        heading('f404a011', 'Funciona especialmente bem em CTAs, manifestos e encerramentos de página.', 14, '#806C60', '500', 'p'),
      ]),
    ])])),
  },
];

export const DECORATIVE_BACKGROUND_ENTRIES = PRESETS.map(({ entry, raw }) => ({
  ...entry,
  bytes: new Blob([raw]).size,
}));

const RAW_BY_ID = new Map(PRESETS.map(({ entry, raw }) => [entry.id, raw]));

export const loadDecorativeBackgroundRaw = (id: string) => RAW_BY_ID.get(id);

export const isDecorativeBackground = (id: string) => RAW_BY_ID.has(id);
