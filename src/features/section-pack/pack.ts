import { isWidgetSupported } from '@/engine/elementor';
import { categorize, type SectionCategoryKey, type SectionFormat } from './categories';
import { applyLocalSectionCustomization } from './customizations';
import { DECORATIVE_BACKGROUND_ENTRIES, loadDecorativeBackgroundRaw } from './decorativeBackgroundPresets';

/**
 * Pack Section Express importado por `npm run sections:import` para
 * data/section-express/. A pasta fica fora do git: sem ela os globs vêm
 * vazios e a biblioteca mostra como importar.
 */

export type PackKind = 'section' | 'loop' | 'popup';

export interface PackEntry {
  id: string;
  kind: PackKind;
  /** `type` do template do Elementor: container, loop-item, single-post, product, popup. */
  type: string | null;
  title: string;
  /** Caminho relativo a data/section-express/. */
  file: string;
  bytes: number;
  /** widgetType -> ocorrências. */
  widgets: Record<string, number>;
  /** Para templates de loop: a seção que usa o template. */
  parent?: string;
  /** Caixinha da biblioteca; `categorize` preenche ao carregar o índice. */
  category?: SectionCategoryKey;
  format?: SectionFormat;
}

export interface PackIndex {
  source: string;
  importedAt: string;
  entries: PackEntry[];
}

const PACK_ROOT = '/data/section-express/';
const indexFile = import.meta.glob<string>('/data/section-express/index.json', { query: '?raw', import: 'default' });
const sectionFiles = import.meta.glob<string>('/data/section-express/{sections,loops,popups}/*.json', {
  query: '?raw',
  import: 'default',
});

/** Onde o pack hospeda as imagens; vai como `siteurl` no JSON copiado para o Elementor. */
export const PACK_SITE_URL = 'https://preview.section.express';

export const hasSectionPack = Object.keys(indexFile).length > 0;

let indexPromise: Promise<PackIndex | null> | null = null;

export const loadPackIndex = (): Promise<PackIndex | null> => {
  indexPromise ??= hasSectionPack
    ? Object.values(indexFile)[0]().then((raw) => {
        const pack = JSON.parse(raw) as PackIndex;
        return {
          ...pack,
          source: `${pack.source} + Fundos visuais`,
          entries: categorize([...DECORATIVE_BACKGROUND_ENTRIES, ...pack.entries]),
        };
      })
    : Promise.resolve({
        source: 'Fundos visuais incluídos',
        importedAt: new Date(0).toISOString(),
        entries: categorize(DECORATIVE_BACKGROUND_ENTRIES),
      });
  return indexPromise;
};

export const loadSectionRaw = (entry: PackEntry): Promise<string> => {
  const builtIn = loadDecorativeBackgroundRaw(entry.id);
  if (builtIn) return Promise.resolve(builtIn);
  const load = sectionFiles[PACK_ROOT + entry.file];
  if (!load) return Promise.reject(new Error(`Arquivo ${entry.file} não está em data/section-express`));
  return load().then((raw) => applyLocalSectionCustomization(entry.id, raw));
};

export const missingWidgets = (entry: PackEntry) => Object.keys(entry.widgets).filter((w) => !isWidgetSupported(w));

/**
 * Seção no mesmo formato de um componente da biblioteca do WordPress, com o
 * JSON em `meta._elementor_data`: miniatura e cópia usam o dado local e não
 * fazem nenhuma requisição.
 */
export const toLibraryComponent = (entry: PackEntry, raw: string) => {
  const doc = JSON.parse(raw);
  return {
    id: `section-express-${entry.id}`,
    title: { rendered: entry.title },
    site_url: PACK_SITE_URL,
    meta: { _elementor_data: Array.isArray(doc) ? doc : doc.content ?? doc.elements ?? [] },
    pack: entry,
  };
};

export type PackComponent = ReturnType<typeof toLibraryComponent>;
