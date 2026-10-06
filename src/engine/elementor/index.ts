/**
 * Motor de renderização de JSON do Elementor, sem WordPress.
 *
 *   const { document } = renderElementorDocument(json);   // HTML completo
 *   const { html, css } = renderElementor(json);           // só o conteúdo
 */
export { renderElementor, isWidgetSupported, WIDGETS } from './render';
export { renderElementorDocument, buildDocument, googleFontsUrl } from './document';
export { normalizeElementorInput } from './normalize';
export { DEFAULT_KIT } from './context';
export { isDynamicWidget, widgetName, widgetSummary } from './widgetInfo';
export type { WidgetSummary } from './widgetInfo';
export type { ElementorElement, ElementorDocument, ElementorKit, RenderOptions, RenderResult } from './types';
export type { DocumentOptions, ElementorDocumentResult } from './document';
