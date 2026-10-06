/**
 * O que o motor sabe dizer de um widget mesmo sem desenhá-lo: o nome legível,
 * se o conteúdo vem do banco do WordPress (posts, produtos, listagens) e um
 * resumo das settings. O canvas usa no cartão do widget que não desenha; as
 * camadas e o painel usam o nome.
 */

const NAMES: Record<string, string> = {
  // Elementor e Elementor Pro
  slides: 'Slides',
  'image-carousel': 'Carrossel de imagens',
  'media-carousel': 'Carrossel de mídia',
  'testimonial-carousel': 'Carrossel de depoimentos',
  reviews: 'Avaliações',
  testimonial: 'Depoimento',
  tabs: 'Abas',
  'nested-tabs': 'Abas',
  accordion: 'Sanfona',
  toggle: 'Alternador',
  'call-to-action': 'Chamada para ação',
  'flip-box': 'Caixa que vira',
  'animated-headline': 'Título animado',
  gallery: 'Galeria',
  'image-gallery': 'Galeria de imagens',
  'price-table': 'Tabela de preço',
  countdown: 'Contagem regressiva',
  'share-buttons': 'Botões de compartilhar',
  'table-of-contents': 'Sumário',
  blockquote: 'Citação',
  alert: 'Alerta',
  'star-rating': 'Estrelas',
  lottie: 'Animação Lottie',
  hotspot: 'Pontos na imagem',
  'text-path': 'Texto em curva',
  'nav-menu': 'Menu',
  'mega-menu': 'Menu',
  login: 'Login',
  posts: 'Posts',
  'archive-posts': 'Posts do arquivo',
  portfolio: 'Portfólio',
  'loop-grid': 'Grade de posts (loop)',
  'loop-carousel': 'Carrossel de posts (loop)',
  shortcode: 'Shortcode',
  template: 'Modelo salvo',
  global: 'Widget global',
  sidebar: 'Barra lateral',
  'theme-site-logo': 'Logo do site',
  'theme-site-title': 'Nome do site',
  'theme-post-title': 'Título do post',
  'theme-post-content': 'Conteúdo do post',
  'theme-post-excerpt': 'Resumo do post',
  'theme-post-featured-image': 'Imagem destacada',
  'theme-archive-title': 'Título do arquivo',
  'post-info': 'Dados do post',
  'post-navigation': 'Navegação de posts',
  'author-box': 'Autor',
  breadcrumbs: 'Trilha de navegação',
  'woocommerce-products': 'Produtos',
  'wc-products': 'Produtos',
  // JetEngine e outros da Crocoblock
  'jet-listing-grid': 'Listagem JetEngine',
  'jet-listing-calendar': 'Calendário JetEngine',
  'jet-listing-dynamic-field': 'Campo dinâmico (JetEngine)',
  'jet-listing-dynamic-image': 'Imagem dinâmica (JetEngine)',
  'jet-listing-dynamic-link': 'Link dinâmico (JetEngine)',
  'jet-listing-dynamic-meta': 'Metadados (JetEngine)',
  'jet-listing-dynamic-terms': 'Termos (JetEngine)',
  'jet-listing-dynamic-repeater': 'Repetidor (JetEngine)',
};

/** Prefixos de pacotes de widgets conhecidos, para dizer de onde o widget vem. */
const VENDORS: [RegExp, string][] = [
  [/^jet-smart-filters-|^jet-sf-/, 'JetSmartFilters'],
  [/^jet-woo-/, 'JetWooBuilder'],
  [/^jet-(tabs|accordion|switcher|image-accordion)/, 'JetTabs'],
  [/^jet-/, 'Crocoblock'],
  [/^eael-/, 'Essential Addons'],
  [/^premium-/, 'Premium Addons'],
  [/^ha-/, 'Happy Addons'],
  [/^(uael|ua)-/, 'Ultimate Addons'],
  [/^wpr-/, 'Royal Addons'],
  [/^(elementskit|ekit)-/, 'ElementsKit'],
  [/^pp-/, 'PowerPack'],
  [/^(woocommerce|wc)-/, 'WooCommerce'],
  [/^wp-widget-/, 'WordPress'],
];

/** Widgets cujo conteúdo sai do banco do WordPress, e não do JSON. */
const DYNAMIC = new Set([
  'posts',
  'archive-posts',
  'portfolio',
  'loop-grid',
  'loop-carousel',
  'shortcode',
  'template',
  'global',
  'sidebar',
  'post-info',
  'post-navigation',
  'author-box',
  'breadcrumbs',
]);
const DYNAMIC_PREFIX = /^(woocommerce-|wc-|theme-|wp-widget-|jet-listing|jet-smart-filters|jet-sf-|jet-woo-|jet-engine)/;
// Widgets de terceiros com cara de consulta (grade de posts, listagem de produtos…)
const DYNAMIC_WORDS = /(^|-)(posts?|post-grid|listing|products?|query|loop|archive)(-|$)/;

export const isDynamicWidget = (type: string) => DYNAMIC.has(type) || DYNAMIC_PREFIX.test(type) || (!(type in NAMES) && DYNAMIC_WORDS.test(type));

const vendorOf = (type: string) => VENDORS.find(([pattern]) => pattern.test(type));

/** Nome legível: "Listagem JetEngine", "Post grid (Essential Addons)". */
export const widgetName = (type: string) => {
  if (NAMES[type]) return NAMES[type];
  const vendor = vendorOf(type);
  const bare = (vendor ? type.replace(vendor[0], '') : type).replace(/[-_]+/g, ' ').trim() || type;
  const name = bare.charAt(0).toUpperCase() + bare.slice(1);
  return vendor ? `${name} (${vendor[1]})` : name;
};

export interface WidgetSummary {
  name: string;
  /** Pedaços do resumo: "6 itens", "3 colunas", "Modelo do card #812". */
  details: string[];
  dynamic: boolean;
  /** Para desenhar o esqueleto de uma grade: colunas por tamanho de tela e quantos cards. */
  grid?: { columns: [number, number, number]; items: number };
}

const num = (value: unknown): number | undefined => {
  const n = Number(value && typeof value === 'object' ? (value as { size?: unknown }).size : value);
  return value === '' || value === null || value === undefined || !Number.isFinite(n) ? undefined : n;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const excerpt = (value: unknown, max = 60) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** Colunas nos três tamanhos de tela: sem valor próprio, herda o padrão do widget ou o tamanho acima, como o Elementor. */
const columnsOf = (s: Record<string, any>, key: string, defaults: [number, number?, number?]): [number, number, number] => {
  const desktop = num(s[key]) ?? defaults[0];
  const tablet = num(s[`${key}_tablet`]) ?? defaults[1] ?? desktop;
  const mobile = num(s[`${key}_mobile`]) ?? defaults[2] ?? tablet;
  return [desktop, tablet, mobile];
};

/** Primeira lista de itens (repeater) das settings: slides, abas, depoimentos… */
const firstRepeater = (s: Record<string, any>) =>
  Object.entries(s).find(([key, value]) => !key.startsWith('_') && Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item === 'object' && '_id' in item));

/** Resumo das settings de um widget, para o cartão no canvas e o painel. */
export const widgetSummary = (type: string, s: Record<string, any> = {}): WidgetSummary => {
  const dynamic = isDynamicWidget(type);
  const details: string[] = [];
  let grid: WidgetSummary['grid'];

  if (type === 'jet-listing-grid') {
    const items = num(s.posts_num) ?? 6;
    const columns = columnsOf(s, 'columns', [3]);
    details.push(plural(items, 'item', 'itens'), plural(columns[0], 'coluna', 'colunas'));
    // "lisitng_id": o JetEngine grava com esse erro de grafia
    const listing = s.lisitng_id ?? s.listing_id;
    if (listing) details.push(`modelo do card #${listing}`);
    if (s.custom_query === 'yes' && s.custom_query_id) details.push(`consulta #${s.custom_query_id}`);
    if (s.carousel_enabled === 'yes') details.push('em carrossel');
    if (s.is_masonry === 'yes') details.push('mosaico');
    if (s.use_load_more === 'yes') details.push('botão carregar mais');
    grid = { columns, items };
  } else if (type === 'posts' || type === 'archive-posts' || type === 'portfolio') {
    const skin = String(s._skin || 'classic');
    const items = num(s[`${skin}_posts_per_page`]) ?? num(s.posts_per_page) ?? 6;
    const columns = columnsOf(s, `${skin}_columns`, [3, 2, 1]);
    details.push(plural(items, 'post', 'posts'), plural(columns[0], 'coluna', 'colunas'));
    if (s.posts_post_type && s.posts_post_type !== 'post') details.push(`tipo ${s.posts_post_type}`);
    grid = { columns, items };
  } else if (type === 'loop-grid' || type === 'loop-carousel') {
    const items = num(s.posts_per_page) ?? 6;
    const columns = type === 'loop-grid' ? columnsOf(s, 'columns', [3, 2, 1]) : columnsOf(s, 'slides_to_show', [3, 2, 1]);
    details.push(plural(items, 'post', 'posts'), plural(columns[0], 'coluna', 'colunas'));
    if (s.template_id) details.push(`modelo do card #${s.template_id}`);
    if (s.post_query_post_type && s.post_query_post_type !== 'post') details.push(`tipo ${s.post_query_post_type}`);
    grid = { columns, items };
  } else if (type === 'woocommerce-products' || type === 'wc-products') {
    const columns = columnsOf(s, 'columns', [4, 3, 2]);
    const rows = num(s.rows) ?? 4;
    details.push(plural(columns[0] * rows, 'produto', 'produtos'), plural(columns[0], 'coluna', 'colunas'));
    grid = { columns, items: columns[0] * rows };
  } else if (type === 'shortcode') {
    if (s.shortcode) details.push(excerpt(s.shortcode));
  } else if (type === 'template') {
    if (s.template_id) details.push(`modelo #${s.template_id}`);
  } else if (type === 'slides') {
    const n = Array.isArray(s.slides) ? s.slides.length : 0;
    details.push(plural(n, 'slide', 'slides'));
  } else {
    const list = firstRepeater(s);
    if (list) details.push(plural((list[1] as unknown[]).length, 'item', 'itens'));
    const gallery = Object.entries(s).find(([key, value]) => !key.startsWith('_') && Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item === 'object' && 'url' in item && !('_id' in item)));
    if (gallery) details.push(plural((gallery[1] as unknown[]).length, 'imagem', 'imagens'));
  }

  return { name: widgetName(type), details, dynamic, grid };
};
