import { isDecorativeBackground } from './decorativeBackgroundPresets';
import type { PackEntry } from './pack';
import { SOURCE_CATEGORY_RANGES } from './sourceCategories';

/**
 * Caixinhas da biblioteca: juntam as 59 categorias originais do Section Express
 * (sourceCategories.ts) em grupos que a gente reconhece de cara, e separam o
 * formato (fixa ou carrossel), que no site original era outra categoria.
 */

export type SectionFormat = 'fixed' | 'carousel';

export type SectionCategoryKey =
  | 'headers'
  | 'hero'
  | 'content'
  | 'features'
  | 'steps'
  | 'numbers'
  | 'media'
  | 'logos'
  | 'team'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'cta'
  | 'contact'
  | 'footers'
  | 'listings'
  | 'special'
  | 'backgrounds'
  | 'other';

export interface SectionCategory {
  key: SectionCategoryKey;
  label: string;
  /** Nome de cada seção, seguido do número: "Herói 12". */
  item: string;
  /** Termos que também encontram a caixinha na busca, em português e inglês. */
  aliases: string[];
  /** Slugs de SOURCE_CATEGORY_RANGES que caem nesta caixinha. */
  sources: string[];
}

/** Na ordem em que aparecem numa página, do topo ao rodapé. */
export const SECTION_CATEGORIES: SectionCategory[] = [
  {
    key: 'headers',
    label: 'Cabeçalhos',
    item: 'Cabeçalho',
    aliases: ['header', 'menu', 'navbar', 'mega menu', 'navegação'],
    sources: ['navbar-sections', 'mega-menu-templates'],
  },
  {
    key: 'hero',
    label: 'Heróis',
    item: 'Herói',
    aliases: ['hero', 'kickstart', 'abertura', 'banner', 'topo'],
    sources: ['hero-sections', 'hero-sliders', 'kickstart-sections', 'kickstart-sliders'],
  },
  {
    key: 'content',
    label: 'Conteúdo',
    item: 'Conteúdo',
    aliases: ['content', 'texto', 'text box', 'heading', 'título', 'full width duo', 'lista', 'list'],
    sources: [
      'content-sections',
      'content-sliders',
      'text-box-sections',
      'text-box-carousels',
      'text-sliders',
      'heading-sections',
      'full-width-duo-sections',
      'full-width-duo-sliders',
      'list-sections',
      'list-sliders',
    ],
  },
  {
    key: 'features',
    label: 'Recursos e cards',
    item: 'Cards',
    aliases: ['features', 'benefícios', 'icon box', 'image box', 'cards'],
    sources: ['features-sections', 'icon-box-sections', 'icon-box-carousels', 'image-box-sections', 'image-box-carousels'],
  },
  {
    key: 'steps',
    label: 'Etapas e linha do tempo',
    item: 'Etapas',
    aliases: ['step box', 'passos', 'timeline', 'processo'],
    sources: ['step-box-sections', 'step-box-carousels', 'timeline-sections', 'timeline-sliders'],
  },
  {
    key: 'numbers',
    label: 'Números',
    item: 'Números',
    aliases: ['counter', 'contador', 'estatísticas', 'métricas'],
    sources: ['counter-sections', 'counter-carousels'],
  },
  {
    key: 'media',
    label: 'Galeria e vídeo',
    item: 'Galeria',
    aliases: ['gallery', 'imagens', 'fotos', 'video'],
    sources: ['gallery-sections', 'gallery-carousels', 'video-sections', 'video-carousels'],
  },
  {
    key: 'logos',
    label: 'Logos e redes sociais',
    item: 'Logos',
    aliases: ['logo grid', 'clientes', 'parceiros', 'social', 'redes'],
    sources: ['logo-grid-sections', 'logo-grid-carousels', 'social-sections', 'social-carousels'],
  },
  {
    key: 'team',
    label: 'Equipe',
    item: 'Equipe',
    aliases: ['team', 'time', 'pessoas'],
    sources: ['team-grid-sections', 'team-grid-carousels'],
  },
  {
    key: 'testimonials',
    label: 'Depoimentos',
    item: 'Depoimento',
    aliases: ['testimonial', 'avaliações', 'reviews', 'prova social'],
    sources: ['testimonial-sections', 'testimonial-carousels'],
  },
  {
    key: 'pricing',
    label: 'Preços',
    item: 'Preços',
    aliases: ['pricing', 'planos', 'price list', 'cardápio', 'tabela de preços'],
    sources: ['pricing-table-sections', 'price-list-sections', 'price-list-carousels'],
  },
  {
    key: 'faq',
    label: 'FAQ',
    item: 'FAQ',
    aliases: ['perguntas', 'dúvidas', 'accordion'],
    sources: ['faq-sections', 'faq-sliders'],
  },
  {
    key: 'cta',
    label: 'Chamada para ação',
    item: 'CTA',
    aliases: ['call to action', 'cta', 'email', 'newsletter', 'opt-in', 'captura'],
    sources: ['call-to-action-sections', 'call-to-action-sliders', 'email-opt-in-sections'],
  },
  {
    key: 'contact',
    label: 'Contato',
    item: 'Contato',
    aliases: ['contact', 'formulário', 'form', 'mapa', 'horário', 'working hours'],
    sources: ['contact-sections', 'working-hours-sections'],
  },
  {
    key: 'footers',
    label: 'Rodapés',
    item: 'Rodapé',
    aliases: ['footer'],
    sources: ['footer-sections'],
  },
  {
    key: 'listings',
    label: 'Blog, loja e portfólio',
    item: 'Listagem',
    aliases: ['blog', 'posts', 'loja', 'shop', 'produtos', 'products', 'portfolio', 'grid'],
    sources: [
      'blog-grid-sections',
      'blog-carousel-sections',
      'product-grid-sections',
      'product-carousel-sections',
      'portfolio-grid-sections',
      'portfolio-carousel-sections',
    ],
  },
  {
    key: 'special',
    label: 'Páginas especiais',
    item: 'Página',
    aliases: ['404', 'em breve', 'coming soon', 'login', 'carrinho', 'cart', 'checkout', 'post', 'produto'],
    sources: ['404-page-sections', 'coming-soon-page-sections', 'login-page-sections'],
  },
  {
    key: 'backgrounds',
    label: 'Fundos visuais',
    item: 'Fundo',
    aliases: ['fundo', 'background', 'decorativo'],
    sources: [],
  },
  { key: 'other', label: 'Outros', item: 'Seção', aliases: [], sources: [] },
];

const CATEGORY_BY_KEY = new Map(SECTION_CATEGORIES.map((c) => [c.key, c]));

export const getCategory = (key: SectionCategoryKey) => CATEGORY_BY_KEY.get(key)!;

export const FORMAT_LABELS: Record<SectionFormat, string> = { fixed: 'Fixa', carousel: 'Carrossel' };

const SOURCE_BY_NUMBER = new Map<number, string>();
for (const [source, ranges] of Object.entries(SOURCE_CATEGORY_RANGES)) {
  for (const range of ranges.split(',')) {
    const [from, to = from] = range.split('-').map(Number);
    for (let n = from; n <= to; n++) SOURCE_BY_NUMBER.set(n, source);
  }
}

const CATEGORY_BY_SOURCE = new Map(SECTION_CATEGORIES.flatMap((c) => c.sources.map((s) => [s, c.key] as const)));

const CAROUSEL_WIDGETS = ['loop-carousel', 'image-carousel', 'media-carousel', 'nested-carousel', 'testimonial-carousel'];

interface Classification {
  category: SectionCategoryKey;
  format: SectionFormat;
}

const classify = (entry: PackEntry): Classification => {
  if (isDecorativeBackground(entry.id)) return { category: 'backgrounds', format: 'fixed' };

  const number = /^c(\d+)$/.exec(entry.id)?.[1];
  const source = number ? SOURCE_BY_NUMBER.get(Number(number)) : undefined;
  if (source) {
    return {
      category: CATEGORY_BY_SOURCE.get(source) ?? 'other',
      format: /slider|carousel/.test(source) ? 'carousel' : 'fixed',
    };
  }

  // Fora das páginas antigas ficaram os templates de post e produto, carrinho,
  // checkout e os popups do menu.
  const has = (widget: string) => widget in entry.widgets;
  const format = CAROUSEL_WIDGETS.some(has) ? 'carousel' : 'fixed';
  if (entry.type === 'product' || entry.type === 'single-post' || has('woocommerce-cart') || has('woocommerce-checkout-page')) {
    return { category: 'special', format };
  }
  if (has('loop-carousel') || has('loop-grid')) return { category: 'listings', format };
  if (entry.kind === 'popup' && entry.id.startsWith('navbar')) return { category: 'headers', format };
  return { category: 'other', format };
};

// O importador usa o nome do arquivo como título ("C761", "C2311-single-product").
const hasOwnTitle = (entry: PackEntry) => !entry.title.toLowerCase().startsWith(entry.id);

/**
 * Preenche categoria e formato e troca o título "cN" por "Herói 12", numerando
 * cada caixinha na ordem do pack. Templates de loop herdam da seção que os usa.
 */
export const categorize = (entries: PackEntry[]): PackEntry[] => {
  const counters = new Map<SectionCategoryKey, number>();
  const sections = new Map<string, Classification & { title: string }>();

  for (const entry of entries) {
    if (entry.kind === 'loop') continue;
    const { category, format } = classify(entry);
    const n = (counters.get(category) ?? 0) + 1;
    counters.set(category, n);
    sections.set(entry.id, {
      category,
      format,
      title: hasOwnTitle(entry) ? entry.title : `${getCategory(category).item} ${n}`,
    });
  }

  return entries.map((entry) => {
    const section = sections.get(entry.id);
    if (section) return { ...entry, ...section };
    const parent = entry.parent ? sections.get(entry.parent) : undefined;
    if (parent) return { ...entry, category: parent.category, format: parent.format, title: `${parent.title} · card` };
    return { ...entry, ...classify(entry) };
  });
};

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Busca por nome, id ou caixinha: "rodapé", "footer", "herói 12", "c1849". */
export const matchesQuery = (entry: PackEntry, query: string) => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const category = entry.category ? getCategory(entry.category) : undefined;
  const haystack = fold([entry.id, entry.title, category?.label, ...(category?.aliases ?? [])].join(' '));
  const tokens = haystack.split(/[^a-z0-9]+/);
  // Número só casa inteiro: "herói 12" não traz o Herói 112
  return words.every((word) => (/^\d+$/.test(word) ? tokens.includes(word) : haystack.includes(word)));
};

export const countBy = <K extends string>(entries: PackEntry[], key: (entry: PackEntry) => K | undefined) =>
  entries.reduce<Map<K, number>>((counts, entry) => {
    const k = key(entry);
    return k ? counts.set(k, (counts.get(k) ?? 0) + 1) : counts;
  }, new Map());
