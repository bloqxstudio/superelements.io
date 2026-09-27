import { extractComponentRobust, extractLocalElementorData } from '@/utils/enhancedElementorExtractor';

/** Onde buscar o `_elementor_data` quando ele não veio junto com a listagem. */
export interface ElementorSourceConfig {
  baseUrl?: string;
  postType?: string;
  username?: string;
  applicationPassword?: string;
}

// Uma grade tem dezenas de cards: limita as requisições simultâneas ao WordPress.
const MAX_CONCURRENT = 4;
let active = 0;
const queue: Array<() => void> = [];

const limit = async <T>(task: () => Promise<T>): Promise<T> => {
  if (active < MAX_CONCURRENT) active++;
  else await new Promise<void>((resolve) => queue.push(resolve)); // herda o slot de quem terminou
  try {
    return await task();
  } finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
};

const cache = new Map<string, Promise<unknown[]>>();

export const componentId = (component: any) => String(component?.originalId ?? component?.id ?? '');

export const sourceKey = (component: any, config: ElementorSourceConfig) =>
  `${(config.baseUrl || '').replace(/\/$/, '')}|${config.postType || 'posts'}|${componentId(component)}`;

const fetchElements = async (component: any, config: ElementorSourceConfig): Promise<unknown[]> => {
  // A listagem pede `meta`; quando o site expõe o _elementor_data ali, não há requisição extra.
  const local = extractLocalElementorData(component);
  if (local?.length) return local;

  if (!config.baseUrl) throw new Error('Componente sem conexão com o WordPress');
  const id = parseInt(componentId(component), 10);
  if (!Number.isFinite(id)) throw new Error('Componente sem ID do WordPress');

  const result = await limit(() =>
    extractComponentRobust(id, {
      baseUrl: config.baseUrl!,
      postType: config.postType || 'posts',
      username: config.username,
      applicationPassword: config.applicationPassword,
    }),
  );
  if (!result.success || !result.data?.length) throw new Error(result.error || 'Componente sem dados do Elementor');
  return result.data;
};

/**
 * Elementos do Elementor de um componente da biblioteca, com cache por
 * componente: card, modal e carrinho compartilham a mesma busca.
 */
export const loadElementorElements = (component: any, config: ElementorSourceConfig): Promise<unknown[]> => {
  const key = sourceKey(component, config);
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchElements(component, config);
    cache.set(key, pending);
    // Falhas não ficam no cache, para a próxima montagem tentar de novo.
    pending.catch(() => cache.delete(key));
  }
  return pending;
};
