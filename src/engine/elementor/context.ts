import { DEVICES, deviceMedia, StyleSheet, type Decls, type Device } from './css';
import type { ElementorElement, ElementorKit, RenderOptions } from './types';

export const DEFAULT_KIT: ElementorKit = {
  // Valores de uma instalação limpa do Elementor (Site Settings padrão).
  colors: {
    primary: '#6EC1E4',
    secondary: '#54595F',
    text: '#7A7A7A',
    accent: '#61CE70',
  },
  typography: {
    primary: { family: 'Roboto', weight: 600 },
    secondary: { family: 'Roboto Slab', weight: 400 },
    text: { family: 'Roboto', weight: 400 },
    accent: { family: 'Roboto', weight: 500 },
  },
  containerWidth: 1140,
};

export interface RenderContext {
  sheet: StyleSheet;
  kit: ElementorKit;
  fonts: Set<string>;
  flags: { fontAwesome: boolean; carousel: boolean };
  motion: 'static' | 'play';
  /** Nomes das animações de entrada usadas, para o documento incluir só esses keyframes. */
  animations: Set<string>;
  unsupported: Record<string, number>;
  widgets: Record<string, number>;
  warnings: string[];
  showUnsupported: boolean;
  renderChildren: (elements: ElementorElement[], parent: ElementorElement) => string;
}

export const createContext = (options: RenderOptions, renderChildren: RenderContext['renderChildren']): RenderContext => ({
  sheet: new StyleSheet(),
  kit: {
    ...DEFAULT_KIT,
    ...options.kit,
    colors: { ...DEFAULT_KIT.colors, ...options.kit?.colors },
    typography: { ...DEFAULT_KIT.typography, ...options.kit?.typography },
  },
  fonts: new Set(),
  flags: { fontAwesome: false, carousel: false },
  motion: options.motion ?? 'static',
  animations: new Set(),
  unsupported: {},
  widgets: {},
  warnings: [],
  showUnsupported: options.showUnsupported ?? true,
  renderChildren,
});

/**
 * Aplica `build` em cada device e registra as declarações no bucket certo.
 * É o atalho para "este seletor recebe este setting responsivo".
 */
export const responsive = (ctx: RenderContext, selector: string, build: (device: Device) => Decls) => {
  DEVICES.forEach((device) => ctx.sheet.add(selector, build(device), deviceMedia(device)));
};
