/**
 * Tipos do motor de renderização de JSON do Elementor.
 * O motor é TypeScript puro (sem React/DOM) para rodar no browser,
 * em Node ou numa Edge Function do Supabase.
 */

export interface ElementorElement {
  id: string;
  elType: string; // 'container' | 'widget' | 'section' | 'column'
  widgetType?: string;
  isInner?: boolean;
  settings: Record<string, any>;
  elements: ElementorElement[];
}

/** Resultado da normalização: qualquer formato de entrada vira isto. */
export interface ElementorDocument {
  title?: string;
  type?: string;
  version?: string;
  source: 'template' | 'clipboard' | 'elements';
  pageSettings: Record<string, any>;
  elements: ElementorElement[];
}

export interface KitTypography {
  family?: string;
  weight?: string | number;
}

/**
 * Configurações globais do site (o "Kit" do Elementor).
 * Os JSONs referenciam cores/fontes globais via `__globals__`; sem o kit
 * o motor usa os valores padrão de uma instalação limpa do Elementor.
 */
export interface ElementorKit {
  colors: Record<string, string>;
  typography: Record<string, KitTypography>;
  /** Largura máxima padrão de containers boxed (px). */
  containerWidth: number;
}

export interface RenderOptions {
  kit?: Partial<ElementorKit>;
  /** Mostra um placeholder para widgets que o motor ainda não conhece. */
  showUnsupported?: boolean;
  /**
   * Animações de entrada: 'static' (padrão) mostra tudo parado, como numa
   * miniatura; 'play' anima como o Elementor faz ao rolar a página.
   */
  motion?: 'static' | 'play';
}

export interface RenderResult {
  /** Marcação do conteúdo (sem <html>/<head>). */
  html: string;
  /** CSS gerado para os elementos (sem o CSS base). */
  css: string;
  /** Famílias do Google Fonts usadas. */
  fonts: string[];
  usesFontAwesome: boolean;
  /** Precisa do script do carrossel (setas e pontos). */
  usesCarousel: boolean;
  /** Animações de entrada usadas (só com motion 'play'). */
  animations: string[];
  /** widgetType -> quantidade de ocorrências não suportadas. */
  unsupported: Record<string, number>;
  /** widgetType -> quantidade de ocorrências renderizadas. */
  widgets: Record<string, number>;
  warnings: string[];
}
