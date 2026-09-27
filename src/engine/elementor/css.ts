/**
 * Conversão de settings do Elementor em CSS.
 *
 * O Elementor guarda valores responsivos com sufixo (`padding`, `padding_tablet`,
 * `padding_mobile`) e valores compostos como objetos ({ unit, size } para
 * sliders, { top, right, bottom, left, unit } para dimensões).
 */

export type Device = 'desktop' | 'tablet' | 'mobile';
export const DEVICES: Device[] = ['desktop', 'tablet', 'mobile'];

/**
 * Buckets de media query, na ordem em que o Elementor os emite.
 * `desktopUp`/`tabletOnly` existem porque larguras de container não podem
 * vazar para o mobile, onde o padrão do Elementor força 100%.
 */
export type Media = 'all' | 'tablet' | 'mobile' | 'desktopUp' | 'tabletOnly';

const MEDIA_QUERIES: Record<Media, string | null> = {
  all: null,
  tablet: '(max-width:1024px)',
  mobile: '(max-width:767px)',
  desktopUp: '(min-width:768px)',
  tabletOnly: '(min-width:768px) and (max-width:1024px)',
};

export const deviceMedia = (device: Device): Media => (device === 'desktop' ? 'all' : device);

/** Media para propriedades que no mobile devem cair no padrão (larguras de container). */
export const widthMedia = (device: Device): Media =>
  device === 'desktop' ? 'desktopUp' : device === 'tablet' ? 'tabletOnly' : 'mobile';

export type Decls = string | false | null | undefined | Array<string | false | null | undefined>;

export class StyleSheet {
  private buckets = new Map<Media, Map<string, string[]>>();
  private raw: string[] = [];

  add(selector: string, decls: Decls, media: Media = 'all') {
    const list = (Array.isArray(decls) ? decls : [decls]).filter(Boolean) as string[];
    if (!list.length) return;
    let bucket = this.buckets.get(media);
    if (!bucket) {
      bucket = new Map();
      this.buckets.set(media, bucket);
    }
    const existing = bucket.get(selector);
    if (existing) existing.push(...list);
    else bucket.set(selector, list);
  }

  addRaw(css: string) {
    if (css.trim()) this.raw.push(css);
  }

  toString(): string {
    const out: string[] = [];
    (Object.keys(MEDIA_QUERIES) as Media[]).forEach((media) => {
      const bucket = this.buckets.get(media);
      if (!bucket?.size) return;
      const rules = [...bucket.entries()].map(([sel, decls]) => `${sel}{${decls.join(';')}}`).join('\n');
      const query = MEDIA_QUERIES[media];
      out.push(query ? `@media${query}{\n${rules}\n}` : rules);
    });
    return [...out, ...this.raw].join('\n');
  }
}

// ---------------------------------------------------------------------------
// Leitura de valores

export const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

/** Lê a variante responsiva de um setting. */
export const rv = (s: Record<string, any>, key: string, device: Device) =>
  s[device === 'desktop' ? key : `${key}_${device}`];

/**
 * Valor efetivo de um setting responsivo num device, herdando
 * mobile → tablet → desktop como o Elementor faz.
 */
export const inherited = (s: Record<string, any>, key: string, device: Device) => {
  const order: Device[] = device === 'mobile' ? ['mobile', 'tablet', 'desktop'] : device === 'tablet' ? ['tablet', 'desktop'] : ['desktop'];
  for (const d of order) {
    const v = rv(s, key, d);
    if (!isEmpty(v)) return v;
  }
  return undefined;
};

/**
 * Número com unidade. `vh` vira uma variável: no preview o iframe cresce até
 * caber o conteúdo, e um 100vh cresceria junto sem parar. O PreviewFrame fixa
 * `--se-vh` numa altura de tela de referência; sem a variável, vale 1vh.
 */
const withUnit = (value: unknown, unit: string) =>
  unit === 'vh' ? `calc(${value} * var(--se-vh, 1vh))` : `${value}${unit}`;

/** Slider { unit, size } → "12px". Aceita número/string solta. */
export const slider = (v: any, defaultUnit = 'px'): string | undefined => {
  if (isEmpty(v)) return undefined;
  if (typeof v === 'number') return withUnit(v, defaultUnit);
  if (typeof v === 'string') return v;
  if (typeof v !== 'object' || isEmpty(v.size)) return undefined;
  const unit = v.unit || defaultUnit;
  return unit === 'custom' ? String(v.size) : withUnit(v.size, unit);
};

/** Número puro de um slider (ex.: opacidade, quantidade de colunas). */
export const sliderNumber = (v: any): number | undefined => {
  if (isEmpty(v)) return undefined;
  const n = Number(typeof v === 'object' ? v.size : v);
  return Number.isFinite(n) && !(typeof v === 'object' && isEmpty(v.size)) ? n : undefined;
};

/** Dimensões { top, right, bottom, left, unit } → "1px 2px 3px 4px". */
export const dims = (v: any): string | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const sides = ['top', 'right', 'bottom', 'left'].map((k) => v[k]);
  if (sides.every(isEmpty)) return undefined;
  const unit = v.unit === 'custom' ? '' : v.unit || 'px';
  return sides.map((x) => withUnit(isEmpty(x) ? 0 : x, unit)).join(' ');
};

/** Gaps { row, column, unit } → "row column". Aceita o formato antigo { size }. */
export const gaps = (v: any): string | undefined => {
  if (!v || typeof v !== 'object') return slider(v);
  const unit = v.unit === 'custom' ? '' : v.unit || 'px';
  const row = isEmpty(v.row) ? v.size : v.row;
  const column = isEmpty(v.column) ? v.size : v.column;
  if (isEmpty(row) && isEmpty(column)) return undefined;
  return `${withUnit(isEmpty(row) ? 0 : row, unit)} ${withUnit(isEmpty(column) ? 0 : column, unit)}`;
};

/** Cor, resolvendo referências a cores globais do kit (`__globals__`). */
export const color = (s: Record<string, any>, key: string): string | undefined => {
  const global = s.__globals__?.[key];
  if (typeof global === 'string' && global) {
    const id = global.match(/id=([\w-]+)/)?.[1];
    if (id) return `var(--e-global-color-${id})`;
  }
  const v = s[key];
  return isEmpty(v) ? undefined : String(v);
};

// ---------------------------------------------------------------------------
// Grupos de controles

const cssFontFamily = (family: string) => `"${family.replace(/"/g, '')}", Sans-serif`;

/**
 * Tipografia. `group` é o prefixo do grupo: 'typography', 'title_typography',
 * 'typography_number'... O grupo só vale quando `<group>_typography === 'custom'`
 * ou quando aponta para uma tipografia global.
 */
export const typography = (s: Record<string, any>, group: string, device: Device, fonts: Set<string>): string[] => {
  const out: string[] = [];
  const global = s.__globals__?.[`${group}_typography`];
  const globalId = typeof global === 'string' ? global.match(/id=([\w-]+)/)?.[1] : undefined;

  if (globalId && device === 'desktop') {
    const base = `--e-global-typography-${globalId}`;
    out.push(
      `font-family:var(${base}-font-family), Sans-serif`,
      `font-weight:var(${base}-font-weight)`,
    );
  }

  if (s[`${group}_typography`] !== 'custom') return out;

  if (device === 'desktop') {
    const family = s[`${group}_font_family`];
    if (!isEmpty(family)) {
      fonts.add(String(family));
      out.push(`font-family:${cssFontFamily(String(family))}`);
    }
    const weight = s[`${group}_font_weight`];
    if (!isEmpty(weight)) out.push(`font-weight:${weight}`);
    const transform = s[`${group}_text_transform`];
    if (!isEmpty(transform)) out.push(`text-transform:${transform}`);
    const style = s[`${group}_font_style`];
    if (!isEmpty(style)) out.push(`font-style:${style}`);
    const decoration = s[`${group}_text_decoration`];
    if (!isEmpty(decoration)) out.push(`text-decoration:${decoration}`);
  }

  const size = slider(rv(s, `${group}_font_size`, device));
  if (size) out.push(`font-size:${size}`);
  const lineHeight = slider(rv(s, `${group}_line_height`, device), '');
  if (lineHeight) out.push(`line-height:${lineHeight}`);
  const letter = slider(rv(s, `${group}_letter_spacing`, device));
  if (letter) out.push(`letter-spacing:${letter}`);
  const word = slider(rv(s, `${group}_word_spacing`, device));
  if (word) out.push(`word-spacing:${word}`);

  return out;
};

/**
 * Fundo (classic/gradient). `group`: 'background', '_background',
 * 'background_overlay', 'button_background'...
 */
export const background = (s: Record<string, any>, group: string, device: Device): string[] => {
  const type = s[`${group}_background`];
  const out: string[] = [];

  if (type === 'classic') {
    if (device === 'desktop') {
      const c = color(s, `${group}_color`);
      if (c) out.push(`background-color:${c}`);
    }
    const image = rv(s, `${group}_image`, device);
    if (image?.url) {
      out.push(`background-image:url("${String(image.url).replace(/"/g, '%22')}")`);
      const position = rv(s, `${group}_position`, device);
      if (!isEmpty(position) && position !== 'initial') out.push(`background-position:${position}`);
      const repeat = rv(s, `${group}_repeat`, device);
      if (!isEmpty(repeat)) out.push(`background-repeat:${repeat}`);
      const size = rv(s, `${group}_size`, device);
      if (size === 'initial') {
        const w = slider(rv(s, `${group}_bg_width`, device));
        if (w) out.push(`background-size:${w} auto`);
      } else if (!isEmpty(size)) out.push(`background-size:${size}`);
      const attachment = rv(s, `${group}_attachment`, device);
      if (!isEmpty(attachment)) out.push(`background-attachment:${attachment}`);
    } else if (device !== 'desktop') {
      // Só a variante responsiva de posição/tamanho sem imagem nova.
      const position = rv(s, `${group}_position`, device);
      if (!isEmpty(position) && position !== 'initial') out.push(`background-position:${position}`);
      const size = rv(s, `${group}_size`, device);
      if (!isEmpty(size) && size !== 'initial') out.push(`background-size:${size}`);
    }
  }

  if (type === 'gradient' && device === 'desktop') {
    const a = color(s, `${group}_color`) || 'transparent';
    const b = color(s, `${group}_color_b`) || '#f2295b';
    const aStop = slider(s[`${group}_color_stop`], '%') || '0%';
    const bStop = slider(s[`${group}_color_b_stop`], '%') || '100%';
    const stops = `${a} ${aStop}, ${b} ${bStop}`;
    const gradient =
      s[`${group}_gradient_type`] === 'radial'
        ? `radial-gradient(at ${s[`${group}_gradient_position`] || 'center center'}, ${stops})`
        : `linear-gradient(${slider(s[`${group}_gradient_angle`], 'deg') || '180deg'}, ${stops})`;
    out.push('background-color:transparent', `background-image:${gradient}`);
  }

  return out;
};

/** Borda. `group`: 'border', '_border', 'image_border', 'button_border'... */
export const border = (s: Record<string, any>, group: string, device: Device): string[] => {
  const style = s[`${group}_border`];
  if (isEmpty(style)) return [];
  const out: string[] = [];
  if (device === 'desktop') out.push(`border-style:${style}`);
  if (style === 'none') return out;
  const width = dims(rv(s, `${group}_width`, device));
  if (width) out.push(`border-width:${width}`);
  if (device === 'desktop') {
    const c = color(s, `${group}_color`);
    if (c) out.push(`border-color:${c}`);
  }
  return out;
};

/** Sombra. `group`: 'box_shadow', '_box_shadow', 'image_box_shadow'... */
export const boxShadow = (s: Record<string, any>, group: string): string | undefined => {
  if (s[`${group}_box_shadow_type`] !== 'yes') return undefined;
  const v = s[`${group}_box_shadow`] || {};
  const n = (x: any, d: number) => (isEmpty(x) ? d : Number(x));
  const inset = s[`${group}_box_shadow_position`] === 'inset' ? ' inset' : '';
  return `box-shadow:${n(v.horizontal, 0)}px ${n(v.vertical, 0)}px ${n(v.blur, 10)}px ${n(v.spread, 0)}px ${v.color || 'rgba(0,0,0,0.5)'}${inset}`;
};

/** Sombra de texto. `group`: 'text_shadow', 'title_shadow'... */
export const textShadow = (s: Record<string, any>, group: string): string | undefined => {
  if (s[`${group}_text_shadow_type`] !== 'yes') return undefined;
  const v = s[`${group}_text_shadow`] || {};
  const n = (x: any, d: number) => (isEmpty(x) ? d : Number(x));
  return `text-shadow:${n(v.horizontal, 0)}px ${n(v.vertical, 0)}px ${n(v.blur, 10)}px ${v.color || 'rgba(0,0,0,0.3)'}`;
};

/** Filtros CSS (brilho, contraste, saturação, desfoque, matiz). `group`: 'css_filters', 'css_filters_hover'. */
export const cssFilters = (s: Record<string, any>, group: string): string | undefined => {
  if (s[`${group}_css_filter`] !== 'custom') return undefined;
  const v = (key: string, d: number) => sliderNumber(s[`${group}_${key}`]) ?? d;
  return `filter:brightness(${v('brightness', 100)}%) contrast(${v('contrast', 100)}%) saturate(${v('saturate', 100)}%) blur(${v('blur', 0)}px) hue-rotate(${v('hue', 0)}deg)`;
};

/** Transformações da aba Avançado (rotacionar, deslocar, escalar, espelhar). */
export const transform = (s: Record<string, any>, device: Device): string | undefined => {
  const parts: string[] = [];
  if (s._transform_translate_popover === 'transform') {
    const x = slider(rv(s, '_transform_translateX_effect', device));
    const y = slider(rv(s, '_transform_translateY_effect', device));
    if (x || y) parts.push(`translate(${x || '0px'}, ${y || '0px'})`);
  }
  if (s._transform_rotate_popover === 'transform') {
    const z = sliderNumber(rv(s, '_transform_rotateZ_effect', device));
    if (z !== undefined) parts.push(`rotate(${z}deg)`);
  }
  if (s._transform_scale_popover === 'transform') {
    const scale = sliderNumber(rv(s, '_transform_scale_effect', device));
    if (scale !== undefined) parts.push(`scale(${scale})`);
  }
  if (device === 'desktop') {
    if (s._transform_flipX_effect === 'transform') parts.push('scaleX(-1)');
    if (s._transform_flipY_effect === 'transform') parts.push('scaleY(-1)');
  }
  return parts.length ? `transform:${parts.join(' ')}` : undefined;
};

// ---------------------------------------------------------------------------
// Escape de HTML

export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const escapeAttr = escapeHtml;

/** Converte "left/right" (formato antigo) em "start/end" (Elementor 3.2x+). */
export const logicalAlign = (v: string | undefined) =>
  v === 'left' ? 'start' : v === 'right' ? 'end' : v;
