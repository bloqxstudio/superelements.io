import { isWidgetSupported } from '@/engine/elementor';
import { FORMAT_LABELS, SECTION_CATEGORIES, countBy, type SectionCategoryKey, type SectionFormat } from './categories';
import { missingWidgets, type PackEntry } from './pack';

export type PackFilter =
  | { group: 'category'; value: SectionCategoryKey }
  | { group: 'format'; value: SectionFormat }
  | { group: 'type'; value: string }
  | { group: 'engine'; value: 'complete' | 'incomplete' }
  | { group: 'widget'; value: string };

export const TYPE_LABELS: Record<string, string> = {
  container: 'Seções',
  'loop-item': 'Cards de loop',
  'single-post': 'Posts',
  product: 'Produtos',
  popup: 'Popups',
};

export const typeLabel = (type: string | null) => (type && TYPE_LABELS[type]) || type || 'Sem tipo';

export interface FilterOption {
  filter: PackFilter;
  label: string;
  count: number;
  /** Widget que o motor ainda não renderiza. */
  unsupported?: boolean;
}

export interface FilterGroup {
  key: PackFilter['group'];
  label: string;
  options: FilterOption[];
}

export const isComplete = (entry: PackEntry) => missingWidgets(entry).length === 0;

export const matchesFilter = (entry: PackEntry, filter: PackFilter | null) => {
  if (!filter) return true;
  if (filter.group === 'category') return entry.category === filter.value;
  if (filter.group === 'format') return entry.format === filter.value;
  if (filter.group === 'type') return (entry.type ?? '') === filter.value;
  if (filter.group === 'engine') return isComplete(entry) === (filter.value === 'complete');
  return filter.value in entry.widgets;
};

export const sameFilter = (a: PackFilter | null, b: PackFilter | null) =>
  a?.group === b?.group && a?.value === b?.value;

const tally = (keys: string[]) =>
  keys.reduce<Map<string, number>>((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());

export const buildFilterGroups = (entries: PackEntry[]): FilterGroup[] => {
  const types = tally(entries.map((e) => e.type ?? ''));
  const widgets = tally(entries.flatMap((e) => Object.keys(e.widgets)));
  const complete = entries.filter(isComplete).length;
  const categories = countBy(entries, (e) => e.category);
  const formats = countBy(entries, (e) => e.format);

  return [
    {
      key: 'category',
      label: 'Categoria',
      options: SECTION_CATEGORIES.filter((c) => categories.has(c.key)).map((c) => ({
        filter: { group: 'category', value: c.key },
        label: c.label,
        count: categories.get(c.key)!,
      })),
    },
    {
      key: 'format',
      label: 'Formato',
      options: (Object.keys(FORMAT_LABELS) as SectionFormat[])
        .filter((f) => formats.has(f))
        .map((f) => ({ filter: { group: 'format', value: f }, label: FORMAT_LABELS[f], count: formats.get(f)! })),
    },
    {
      key: 'type',
      label: 'Tipo',
      options: [...types.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ filter: { group: 'type', value }, label: typeLabel(value), count })),
    },
    {
      key: 'engine',
      label: 'Motor Elementor',
      options: [
        { filter: { group: 'engine', value: 'complete' }, label: 'Completas', count: complete },
        { filter: { group: 'engine', value: 'incomplete' }, label: 'Com widget faltando', count: entries.length - complete },
      ],
    },
    {
      key: 'widget',
      label: 'Contém widget',
      options: [...widgets.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({
          filter: { group: 'widget', value },
          label: value,
          count,
          unsupported: !isWidgetSupported(value),
        })),
    },
  ];
};
