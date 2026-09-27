import { useEffect, useRef, useState } from 'react';
import { renderElementorDocument } from '@/engine/elementor';
import type { ElementorKit } from '@/engine/elementor/types';
import { loadElementorElements, sourceKey, type ElementorSourceConfig } from './elementorSource';

export type ElementorDocumentState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; document: string; unsupported: Record<string, number> }
  | { status: 'error'; error: string };

/** Transformação aplicada antes de renderizar (ex.: a marca do Space). */
export interface ElementorCustomization {
  /** Muda quando a transformação muda, para refazer o preview. */
  key: string;
  transform: (elements: unknown[]) => unknown[];
  kit?: Partial<ElementorKit>;
}

export interface ElementorComponentSource {
  /** Site de onde buscar o JSON quando ele não veio junto com o componente. */
  baseUrl?: string;
  postType?: string;
  customize?: ElementorCustomization;
}

/**
 * Renderiza um componente da biblioteca com o motor Elementor.
 * `enabled` permite adiar a busca até o card entrar na tela.
 */
export const useElementorDocument = (
  component: any,
  { baseUrl, postType, customize }: ElementorComponentSource = {},
  enabled = true,
): ElementorDocumentState => {
  const config: ElementorSourceConfig = { baseUrl, postType };
  const key = component ? sourceKey(component, config) : '';

  // O objeto do componente muda de identidade a cada render; o efeito depende só da chave.
  const latest = useRef({ component, config, customize });
  latest.current = { component, config, customize };

  const [state, setState] = useState<ElementorDocumentState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    const { component: comp, config: cfg, customize: custom } = latest.current;
    setState({ status: 'loading' });

    loadElementorElements(comp, cfg)
      .then((elements) => {
        if (cancelled) return;
        const title = typeof comp.title === 'string' ? comp.title : comp.title?.rendered;
        const result = renderElementorDocument(custom ? custom.transform(elements) : elements, { title, kit: custom?.kit });
        setState({ status: 'ready', document: result.document, unsupported: result.unsupported });
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn(`[motor Elementor] preview indisponível para ${key}:`, error);
        setState({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, key, customize?.key]);

  return state;
};
