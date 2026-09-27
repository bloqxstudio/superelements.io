import type { ElementorDocument, ElementorElement } from './types';

/**
 * Aceita os formatos em que um JSON do Elementor costuma aparecer e devolve
 * sempre a mesma estrutura:
 *  - export de template: { content: [...], page_settings, version, title, type }
 *  - clipboard do editor: { type: "elementor", siteurl, elements: [...] }
 *  - `_elementor_data` cru: [...] (array ou string JSON)
 */
export const normalizeElementorInput = (input: unknown): ElementorDocument => {
  let data: any = input;

  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  if (Array.isArray(data)) {
    return { source: 'elements', pageSettings: {}, elements: normalizeElements(data) };
  }

  if (data && typeof data === 'object') {
    if (Array.isArray(data.content)) {
      return {
        source: 'template',
        title: data.title,
        type: data.type,
        version: data.version,
        pageSettings: asObject(data.page_settings),
        elements: normalizeElements(data.content),
      };
    }

    if (Array.isArray(data.elements)) {
      return { source: 'clipboard', pageSettings: {}, elements: normalizeElements(data.elements) };
    }

    const raw = data._elementor_data ?? data.meta?._elementor_data;
    if (raw) {
      return normalizeElementorInput(raw);
    }
  }

  throw new Error('Formato não reconhecido: esperado um template exportado, um clipboard do Elementor ou um array de elementos.');
};

// O PHP do Elementor exporta objetos vazios como [], então settings pode vir como array.
const asObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

let generatedIds = 0;

const normalizeElements = (elements: unknown[]): ElementorElement[] =>
  elements
    .filter((el): el is Record<string, any> => !!el && typeof el === 'object')
    .map((el) => ({
      id: String(el.id || `se${(generatedIds++).toString(36)}`),
      elType: String(el.elType || 'widget'),
      widgetType: el.widgetType,
      isInner: Boolean(el.isInner),
      settings: asObject(el.settings),
      elements: Array.isArray(el.elements) ? normalizeElements(el.elements) : [],
    }));
