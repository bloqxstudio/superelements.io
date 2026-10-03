import { AUTO, FILL, FIXED, ISLAND_SHADOW, border, bg, fa, gap, px, sides, type ElementorNode, type SeBuilder } from './elementor'
import { SE, seAsset } from './tokens'

/**
 * As telas do produto, em containers e widgets nativos, copiadas do app
 * (src/pages/ProjectSpace.tsx, SpaceToolbar, PageFrame, SectionNode,
 * ClaudePanel, WordPressPublishDialog): mesmos rótulos, ícones, medidas e
 * cores. O projeto mostrado é o exemplo Caramelo Pet, fictício, com as fotos
 * das seções dele tiradas do canvas (public/brands/superelements/canvas/).
 *
 * As classes `se-*` são as que o story.ts move; o que só a história mostra
 * fica escondido no APP_CSS.
 */

export const DEMO = {
  project: 'Caramelo Pet',
  site: 'caramelopet.exemplo',
  brand: ['#1F2A44', '#F2994A', '#9ED8F7', '#FFF7EC'],
  sections: [
    { file: 'pet-01-cabecalho.webp', title: 'Caramelo Pet · Cabeçalho', id: 'pet-cabecalho', h: 56 },
    { file: 'pet-02-hero.webp', title: 'Caramelo Pet · Hero', id: 'pet-hero', h: 546 },
    { file: 'pet-03-servicos.webp', title: 'Caramelo Pet · Serviços', id: 'pet-servicos', h: 650 },
    { file: 'pet-04-como-funciona.webp', title: 'Caramelo Pet · Como funciona', id: 'pet-como-funciona', h: 454 },
    { file: 'pet-05-clube-do-banho.webp', title: 'Caramelo Pet · Clube do Banho', id: 'pet-planos', h: 614 },
    { file: 'pet-06-loja.webp', title: 'Caramelo Pet · Loja', id: 'pet-loja', h: 370 },
    { file: 'pet-07-depoimentos.webp', title: 'Caramelo Pet · Depoimentos', id: 'pet-depoimentos', h: 446 },
    { file: 'pet-08-duvidas.webp', title: 'Caramelo Pet · Dúvidas', id: 'pet-duvidas', h: 464 },
    { file: 'pet-09-contato.webp', title: 'Caramelo Pet · Contato', id: 'pet-contato', h: 486 },
    { file: 'pet-10-rodape.webp', title: 'Caramelo Pet · Rodapé', id: 'pet-rodape', h: 224 },
  ],
}

/** Etapas reais do envio de uma página nova (src/features/wordpress/publish.ts). */
export const PUBLISH_STEPS = [
  'Preparando a página…',
  'Enviando imagens para o site (6 de 6)…',
  'Criando a página no WordPress…',
  'Limpando o cache de CSS do Elementor…',
]

const hide = 'visibility:hidden;opacity:0'

/** Layout da janela do Space. Posições como no app; no celular, só o quadro da página. */
export const APP_CSS = [
  `selector .se-app{position:relative;overflow:hidden;border-radius:16px;background:${SE.white};box-shadow:0 0 0 1px rgba(255,255,255,.14),0 50px 120px -50px rgba(0,0,0,.9);isolation:isolate}`,
  'selector .se-app-zoom{position:relative;will-change:transform}',
  `selector .se-canvas{position:relative;height:clamp(440px,calc(100vh - 230px),640px);overflow:hidden;background-color:#F4F4F5;background-image:radial-gradient(circle at center,rgba(209,213,219,.85) 1.5px,transparent 1.7px);background-size:24px 24px;background-position:0 0}`,
  `selector .se-island{box-shadow:${ISLAND_SHADOW}}`,
  'selector .se-toolbar{position:absolute!important;top:12px;left:12px;right:12px;width:auto!important;z-index:5}',
  'selector .se-isl-left{justify-self:start}selector .se-isl-center{justify-self:center}selector .se-isl-right{justify-self:end}',
  'selector .se-lib{position:absolute;left:12px;top:64px;bottom:12px;width:264px;z-index:4}',
  'selector .se-frame{position:absolute;left:316px;top:72px;width:512px;z-index:2}',
  'selector .se-newpage{position:absolute;left:1148px;top:72px;width:512px;height:120px}',
  'selector .se-bar{position:absolute;left:288px;bottom:12px;z-index:5}',
  'selector .se-claude{position:absolute;right:12px;bottom:12px;width:300px;z-index:6}',
  `selector .se-sel{border-color:${SE.violet}!important;box-shadow:0 0 0 2px #F4F4F5,0 0 0 4px rgba(139,92,246,.7),0 4px 6px -1px rgb(0 0 0/.1)!important}`,
  `selector .se-changed{border-color:${SE.agent}!important;box-shadow:0 0 0 2px #F4F4F5,0 0 0 4px rgba(217,119,87,.4),0 4px 6px -1px rgb(0 0 0/.1)!important}`,
  'selector .se-card{box-shadow:0 4px 6px -1px rgb(0 0 0/.1),0 2px 4px -2px rgb(0 0 0/.1)}',
  'selector .se-thumb img{width:100%;height:auto}',
  'selector .se-publish{position:relative;overflow:visible!important}',
  `selector .se-ring{position:absolute!important;inset:-6px;border:2px solid ${SE.lime};border-radius:13px;pointer-events:none;${hide}}`,
  'selector .se-stack{display:grid!important}selector .se-stack>*{grid-area:1/1}',
  'selector .se-dlg-track{overflow:hidden}selector .se-dlg-fill{transform-origin:0 50%}selector .se-details-thumb{overflow:hidden}selector .se-dialog .se-stack>*{align-self:start}',
  `selector .se-publish-b,selector .se-chip-site,selector .se-dlg-progress,selector .se-dlg-done,selector .se-step-ok{${hide}}`,
  `selector .se-shade{position:absolute!important;inset:0;background:rgba(9,9,11,.45);z-index:10;${hide}}`,
  `selector .se-dialog{position:absolute!important;inset:0;margin:auto;height:max-content;width:min(460px,calc(100% - 32px))!important;z-index:11;${hide}}`,
  `selector .se-toast{position:absolute!important;left:0;right:0;bottom:72px;margin:0 auto;width:max-content!important;max-width:calc(100% - 32px);z-index:9;${hide}}`,
  `selector .se-cursor{position:absolute!important;left:0;top:0;width:38px!important;z-index:20;pointer-events:none;${hide}}`,
  'selector .se-cursor img{width:38px;height:38px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}',
  `selector .se-spot{position:absolute!important;inset:0;z-index:8;pointer-events:none;background:radial-gradient(circle at var(--sx,50%) var(--sy,40%),rgba(9,9,11,0) 0,rgba(9,9,11,0) 90px,rgba(9,9,11,.58) 220px);${hide}}`,
  `selector .se-ring2{position:absolute!important;inset:-3px;border:2px solid ${SE.lime};border-radius:11px;pointer-events:none;${hide}}`,
  'selector .se-hud{position:relative}selector .se-hud-step{position:relative}selector .se-hud-lit{position:absolute!important;inset:12px 0 0 0;' + hide + '}',
  `selector .se-hud-track{position:relative;height:2px!important;min-height:2px;background:${SE.line}}selector .se-hud-fill{position:absolute!important;inset:0;background:${SE.lime};transform-origin:0 50%;transform:scaleX(0)}`,
  '@media(max-width:1024px){selector .se-hud{display:none!important}}@media(min-width:1025px){selector .se-cap-m{display:none!important}}',
  'selector .se-app .elementor-widget-heading{flex-shrink:0}selector .se-app .elementor-heading-title{white-space:nowrap}',
  'selector .se-app .se-wrap{flex-shrink:1}selector .se-app .se-wrap .elementor-heading-title{white-space:normal}',
  '@media(max-width:1180px){selector .se-isl-center .se-hide-l{display:none!important}selector .se-claude{width:260px}}',
  '@media(max-width:1024px){selector .se-lib,selector .se-isl-center,selector .se-newpage,selector .se-hide-t{display:none!important}selector .se-frame{left:24px}selector .se-bar{left:12px}selector .se-toolbar{grid-template-columns:1fr auto!important}}',
  '@media(max-width:767px){selector .se-canvas{height:520px}selector .se-frame{left:12px;right:12px;width:auto!important;top:64px}selector .se-claude,selector .se-bar,selector .se-hide-m{display:none!important}selector .se-toast{bottom:20px}}',
].join('')

export interface ScreenOptions {
  /** Seção selecionada (contorno violeta), pelo índice. */
  selected?: number
  /** Seção marcada "Claude mudou", pelo índice. */
  changed?: number
  /** Quantas seções aparecem no quadro (o resto fica abaixo da janela). */
  visible?: number
  /** Inclui o diálogo de publicar, o cursor, o anel e o aviso (a história do scroll). */
  story?: boolean
}

export function screens(b: SeBuilder) {
  const { col, row, grid, container, widget, uiText, uiChip, island, divider, pill, image, heading } = b

  const icon = (value: string, color: string, size = 14, options: Record<string, unknown> = {}) =>
    widget('icon', { selected_icon: fa(value), primary_color: color, size: px(size), ...FIXED, ...AUTO, align: 'left', ...options })
  const dot = (color: string, size = 6) => container({ box: size, min_height: px(size), ...bg(color), border_radius: sides(999) })
  const spacer = () => container({ ...FILL, min_height: px(1) })
  const mono = (value: string, size = 10, color: string = SE.gray500, options: Record<string, unknown> = {}) =>
    heading(value, { font: 'mono', size, line: 1.2 }, color, { ...AUTO, ...FIXED, ...options })

  /** Cabeçalho do app: logo, Projetos › projeto, salvo na conta; à direita, compartilhar, WordPress, contexto e avatar. */
  const appHeader = () => row([
    image('logo/se-simbolo.svg', 'Superelements', { width: px(24), ...FIXED, ...AUTO }),
    uiText('Projetos', 14, SE.gray500, 400, { _css_classes: 'se-hide-m' }),
    icon('fas fa-chevron-right', SE.gray300, 10, { _css_classes: 'se-hide-m' }),
    uiText(DEMO.project, 14, SE.gray900, 600),
    row([icon('fas fa-cloud', SE.gray400, 12), uiText('Salvo na conta', 12, SE.gray400, 400)], 6, { inline: true, css_classes: 'se-hide-m', margin: sides(0, 0, 0, 4) }),
    spacer(),
    uiChip('fas fa-user-friends', 'Compartilhar', { classes: 'se-hide-t' }),
    row([icon('fas fa-globe', SE.gray500, 13), uiText(DEMO.site, 12, SE.gray600), dot(SE.emerald)], 6, { inline: true, min_height: px(32), padding: sides(0, 10), css_classes: 'se-hide-m' }),
    uiChip('fas fa-book-open', 'Contexto', { classes: 'se-hide-t' }),
    container({ box: 30, min_height: px(30), ...bg(SE.gray100), border_radius: sides(999), flex_direction: 'row', flex_justify_content: 'center', flex_align_items: 'center' }, [uiText('S', 13, '#71717A', 500)]),
  ], 10, { min_height: px(52), padding: sides(0, 16), ...bg(SE.white), ...border(SE.lineLight, sides(0, 0, 1, 0)), css_classes: 'se-app-head' })

  /** Botão Publicar no site: lima, com o anel do clique e o rótulo que troca para Atualizar no site. */
  const publishButton = (story: boolean) => row([
    icon('fas fa-cloud-upload-alt', SE.ink, 13),
    container({ inline: true, css_classes: 'se-stack se-publish-labels' }, [
      uiText('Publicar no site', 12, SE.ink, 600, { _css_classes: 'se-publish-a' }),
      ...(story ? [uiText('Atualizar no site', 12, SE.ink, 600, { _css_classes: 'se-publish-b' })] : []),
    ]),
    ...(story ? [container({ css_classes: 'se-ring' }), container({ css_classes: 'se-ring2' })] : []),
  ], 6, { inline: true, min_height: px(32), padding: sides(0, 12), ...bg(SE.lime), border_radius: sides(8), css_classes: 'se-publish' })

  const swatch = () => grid(DEMO.brand.map((c) => container({ ...bg(c), min_height: px(6) })), '1fr 1fr', 0, {
    box: 14, border_radius: sides(4), css_classes: 'se-swatch',
    custom_css: 'selector{overflow:hidden}',
  }, { tablet: '1fr 1fr', mobile: '1fr 1fr' })

  /** As três ilhas do alto do canvas. */
  const toolbar = (story: boolean) => grid([
    island([
      uiChip('fas fa-file-alt', 'Home', { tone: 'violet' }),
      icon('fas fa-chevron-down', SE.gray400, 9, { _css_classes: 'se-hide-m', _margin: sides(0, 6, 0, -2) }),
      uiChip('fas fa-layer-group', 'Navigator', { classes: 'se-hide-m' }),
      container({ inline: true, css_classes: 'se-hide-m' }, [divider()]),
      uiChip('fas fa-book', 'Biblioteca', { tone: 'pressed', classes: 'se-hide-t' }),
    ], { css_classes: 'se-island se-isl-left' }),
    island([
      row([swatch(), uiText(DEMO.project, 12, SE.gray600)], 6, { inline: true, min_height: px(32), padding: sides(0, 10) }),
      divider(),
      uiChip('fas fa-bars', 'Estrutura', { tone: 'dark' }),
      uiChip('fas fa-wind', ''),
      uiChip('fas fa-tint', ''),
      uiChip('fas fa-font', ''),
      uiChip('fas fa-shapes', ''),
      uiChip('far fa-images', '', { classes: 'se-faded se-hide-l' }),
    ], { css_classes: 'se-island se-isl-center' }),
    island([
      uiChip('fas fa-play', 'Player', { classes: 'se-hide-m' }),
      uiChip('far fa-copy', 'Copiar', { classes: 'se-hide-m' }),
      publishButton(story),
    ], { css_classes: 'se-island se-isl-right' }),
  ], '1fr auto 1fr', 8, { css_classes: 'se-toolbar' }, { tablet: '1fr auto', mobile: '1fr auto' })

  /** Biblioteca de seções, aberta como no app. */
  const library = () => col([
    row([icon('fas fa-book', SE.gray400, 13), uiText('Biblioteca de seções', 12, SE.gray700, 600), spacer(), icon('fas fa-times', SE.gray400, 11)], 8, {
      padding: sides(10, 12), ...border(SE.gray100, sides(0, 0, 1, 0)),
    }),
    col([
      row([icon('fas fa-search', SE.gray400, 11), uiText('Buscar: rodapé, preços, c1849…', 12, SE.gray400, 400)], 8, {
        min_height: px(32), padding: sides(0, 10), ...border(SE.lineLight), border_radius: sides(6),
      }),
      grid(([
        ['fas fa-window-maximize', 'Cabeçalhos'], ['fas fa-star', 'Heróis'], ['fas fa-align-left', 'Conteúdo'], ['fas fa-th-large', 'Recursos e cards'],
        ['far fa-comment', 'Depoimentos'], ['fas fa-tag', 'Preços'], ['far fa-question-circle', 'FAQ'], ['fas fa-bullhorn', 'Chamada para ação'],
        ['far fa-envelope', 'Contato'], ['fas fa-grip-lines', 'Rodapés'],
      ] as const).map(([i, t]) => col([icon(i, SE.gray400, 14), uiText(t, 12, '#1F2937', 500, { _element_width: '', _css_classes: 'se-wrap' })], 8, {
        min_height: px(66), padding: sides(10), ...border(SE.gray200), border_radius: sides(8), flex_justify_content: 'space-between',
      })), '1fr 1fr', 8),
    ], 12, { padding: sides(12) }),
  ], 0, { ...bg(SE.white), border_radius: sides(12), css_classes: 'se-island se-lib' })

  /** Card de seção no quadro da página, com a foto da seção do Caramelo Pet. */
  const sectionCard = (index: number, opts: { selected?: boolean; changed?: boolean } = {}) => {
    const s = DEMO.sections[index]
    return col([
      row([
        icon('fas fa-grip-vertical', SE.gray400, 10),
        heading(`Seção ${index + 1}`, { font: 'ui', size: 10, weight: 600, line: 1.2, letter: 0.08, transform: 'uppercase' }, SE.gray400, AUTO),
        mono(s.id, 10, SE.gray500, { _padding: sides(2, 6), _background_background: 'classic', _background_color: 'rgba(229,231,235,.7)', _border_radius: sides(4) }),
        ...(opts.changed ? [heading('Claude mudou', { font: 'ui', size: 10, weight: 500, line: 1.2 }, SE.agentInk, { ...AUTO, _padding: sides(2, 6), _background_background: 'classic', _background_color: SE.agentSoft, _border_radius: sides(4) })] : []),
        spacer(),
        icon('fas fa-chevron-up', SE.gray300, 10),
        icon('fas fa-chevron-down', SE.gray300, 10),
        icon('fas fa-code', SE.gray300, 11),
      ], 6, { padding: sides(7, 12), ...bg(SE.gray50), ...border(SE.gray100, sides(0, 0, 1, 0)) }),
      col([
        uiText(s.title, 12, SE.gray700, 500, { _element_width: '', _padding: sides(0, 0, 4, 0), _border_border: 'solid', _border_width: sides(0, 0, 1, 0), _border_color: SE.gray100 }),
        image(`canvas/${s.file}`, s.title, { width: { unit: '%', size: 100, sizes: [] }, image_border_border: 'solid', image_border_width: sides(1), image_border_color: SE.lineLight, image_border_radius: sides(6), _css_classes: 'se-thumb' }),
      ], 8, { padding: sides(10, 12, 12, 12) }),
    ], 0, {
      ...bg(SE.white), ...border(SE.gray200), border_radius: sides(12),
      css_classes: `se-card${opts.selected ? ' se-sel' : ''}${opts.changed ? ' se-changed' : ''}`,
      custom_css: 'selector{overflow:hidden}',
    })
  }

  /** Quadro da página Home, como no canvas: cabeçalho com Player e as seções em coluna. */
  const pageFrame = (opts: ScreenOptions) => col([
    row([
      icon('fas fa-file-alt', '#7C3AED', 13),
      uiText('Home', 13, SE.gray900, 600),
      uiText(`${DEMO.sections.length} seções`, 11, SE.gray400, 400),
      ...(opts.story ? [pill('No site', { fg: SE.skyInk, bg: SE.sky }, 'fas fa-globe', { css_classes: 'se-chip-site' })] : []),
      spacer(),
      row([icon('fas fa-play', SE.white, 9), uiText('Player', 12, SE.white, 500)], 6, { inline: true, min_height: px(28), padding: sides(0, 10), ...bg(SE.gray900), border_radius: sides(8) }),
      icon('fas fa-ellipsis-h', SE.gray500, 12),
    ], 8, { min_height: px(48), padding: sides(0, 8, 0, 16) }),
    col(DEMO.sections.slice(0, opts.visible ?? 4).map((_, i) => sectionCard(i, { selected: i === opts.selected, changed: i === opts.changed })), 24, { padding: sides(0, 16, 16, 16) }),
  ], 0, { ...bg('rgba(255,255,255,.75)'), ...border('#C4B5FD'), border_radius: sides(28), css_classes: 'se-frame' })

  const newPage = () => row([icon('fas fa-plus', SE.gray600, 13), uiText('Nova página', 14, SE.gray600)], 8, {
    flex_justify_content: 'center', ...border('rgba(156,163,175,.7)', sides(1)), border_border: 'dashed', border_radius: sides(28), css_classes: 'se-newpage',
  })

  /** Barra de baixo: desfazer, aparelhos, zoom e a contagem. */
  const bottomBar = () => island([
    uiChip('fas fa-undo', '', { classes: 'se-faded' }),
    uiChip('fas fa-redo', '', { classes: 'se-faded' }),
    divider(),
    uiChip('fas fa-desktop', '', { tone: 'pressed' }),
    uiChip('fas fa-tablet-alt', ''),
    uiChip('fas fa-mobile-alt', ''),
    divider(),
    uiChip('fas fa-minus', ''),
    uiText('100%', 12, SE.gray600, 500, { _padding: sides(0, 6) }),
    uiChip('fas fa-plus', ''),
    uiChip('fas fa-expand', ''),
    divider(),
    uiText(`1 página · ${DEMO.sections.length} seções`, 11, SE.gray500, 400, { _padding: sides(0, 8) }),
  ], { css_classes: 'se-island se-bar' })

  /** Painel do agente no canto do canvas. */
  const agentPanel = (messages: Array<{ kind: 'change' | 'question' | 'done' | 'note'; text: string; time: string }>, classes = 'se-claude', msgClass = '') => col([
    row([dot(SE.agent, 8), uiText('Claude', 12, SE.gray900, 600), spacer(), icon('fas fa-chevron-down', SE.gray400, 11), icon('fas fa-times', SE.gray400, 11)], 8, { padding: sides(9, 12) }),
    col(messages.map((m) => row([
      m.kind === 'note' ? container({ box: 14, min_height: px(14), flex_direction: 'row', flex_justify_content: 'center', flex_align_items: 'center' }, [dot(SE.gray300)])
        : icon(m.kind === 'change' ? 'fas fa-pen' : m.kind === 'question' ? 'far fa-question-circle' : 'fas fa-check', m.kind === 'change' ? SE.agent : m.kind === 'question' ? '#7C3AED' : '#059669', 11, { _margin: sides(2, 0, 0, 0) }),
      uiText(m.text, 12, m.kind === 'note' ? SE.gray600 : SE.gray900, 400, { ...FILL, _element_width: '', _css_classes: 'se-wrap' }),
      uiText(m.time, 10, SE.gray400, 400),
    ], 8, { flex_align_items: 'flex-start', padding: sides(5, 6), border_radius: sides(8), ...(msgClass ? { css_classes: msgClass } : {}) })), 2, { padding: sides(6), ...border(SE.gray100, sides(1, 0, 0, 0)) }),
    uiText('Ctrl+Z desfaz a última mudança do Claude, como qualquer edição.', 10, SE.gray400, 400, { _element_width: '', _css_classes: 'se-wrap', _padding: sides(7, 12), _border_border: 'solid', _border_width: sides(1, 0, 0, 0), _border_color: SE.gray100 }),
  ], 0, { ...bg(SE.white), border_radius: sides(12), css_classes: `se-island ${classes}`, custom_css: 'selector{overflow:hidden}' })

  // ---------- diálogo de publicar (a história do scroll) ----------

  const choice = (title: string, hint: string, on: boolean) => row([
    container({ box: 16, min_height: px(16), border_radius: sides(999), ...border(on ? SE.gray900 : SE.gray300, sides(on ? 5 : 1)), ...bg(SE.white) }),
    col([uiText(title, 13, SE.gray900, 500, { _element_width: '', _css_classes: 'se-wrap' }), uiText(hint, 11, '#71717A', 400, { _element_width: '', _css_classes: 'se-wrap' })], 2, FILL),
  ], 10, { flex_align_items: 'flex-start', padding: sides(10, 12), ...border(on ? SE.gray900 : SE.lineLight), border_radius: sides(8), ...bg(on ? SE.gray50 : SE.white), ...FILL })

  const dlgTitle = (title: string, desc: string) => col([
    heading(title, { font: 'ui', size: 18, weight: 600, line: 1.1, letter: -0.015 }, SE.gray900),
    uiText(desc, 13, '#71717A', 400, { _element_width: '', _css_classes: 'se-wrap' }),
  ], 6)

  const dlgButton = (value: string, tone: 'primary' | 'ghost' | 'outline', classes = '', iconValue?: string) => row([
    uiText(value, 13, tone === 'primary' ? SE.ink : SE.gray900, 500),
    ...(iconValue ? [icon(iconValue, tone === 'primary' ? SE.ink : SE.gray600, 10)] : []),
  ], 6, {
    inline: true, min_height: px(36), padding: sides(0, 14), border_radius: sides(6),
    ...(tone === 'primary' ? bg(SE.lime) : tone === 'outline' ? { ...bg(SE.white), ...border(SE.lineLight) } : {}),
    ...(classes ? { css_classes: classes } : {}),
  })

  /** Cartão de detalhes da página no diálogo de publicar: miniatura, título, endereço e SEO. */
  const pageDetails = () => row([
    container({ box: 96, min_height: px(52), ...bg(SE.gray50), ...border(SE.lineLight), border_radius: sides(6), css_classes: 'se-details-thumb' }, [
      image('canvas/pet-02-hero.webp', 'Miniatura da Home', { width: { unit: '%', size: 100, sizes: [] }, _css_classes: 'se-thumb' }),
    ]),
    col([
      uiText('Home', 13, SE.gray900, 500),
      uiText(`${DEMO.site}/home`, 12, '#71717A', 400),
      uiText('SEO: Banho, tosa e creche na Vila Mariana', 12, '#71717A', 400, { _element_width: '', _css_classes: 'se-wrap' }),
    ], 3, FILL),
  ], 12, { flex_align_items: 'flex-start', padding: sides(10), ...border(SE.lineLight), border_radius: sides(8) })

  const dialog = () => col([
    container({ css_classes: 'se-stack' }, [
      // formulário
      col([
        dlgTitle('Publicar no WordPress', `A página Home vira uma página nova em ${DEMO.project}, feita no Elementor.`),
        col([uiText('Situação', 13, SE.gray900, 500), row([choice('Rascunho', 'Só quem está logado no site vê', false), choice('Publicada', 'No ar, no endereço da página', true)], 8, { flex_align_items: 'stretch' })], 8),
        col([uiText('Layout', 13, SE.gray900, 500), row([choice('Tela cheia', 'Só as seções da página', true), choice('Com o tema', 'Cabeçalho e rodapé do tema', false)], 8, { flex_align_items: 'stretch' })], 8),
        uiText(`${DEMO.sections.length} seções · 6 imagens novas vão para a biblioteca de mídia do site.`, 12, '#71717A', 400, { _element_width: '', _css_classes: 'se-wrap' }),
        row([spacer(), dlgButton('Cancelar', 'ghost'), dlgButton('Publicar página', 'primary', 'se-dlg-confirm')], 8),
      ], 18, { css_classes: 'se-dlg-form' }),
      // etapas
      col([
        dlgTitle('Publicando no WordPress', `Home em ${DEMO.project}.`),
        pageDetails(),
        col(PUBLISH_STEPS.map((step) => row([
          container({ box: 16, css_classes: 'se-stack se-step-icon' }, [
            icon('fas fa-circle-notch', SE.gray400, 14, { _css_classes: 'se-step-spin' }),
            icon('fas fa-check-circle', '#059669', 14, { _css_classes: 'se-step-ok' }),
          ]),
          uiText(step, 13, SE.gray700, 400, { _element_width: '', _css_classes: 'se-wrap' }),
        ], 10, { css_classes: 'se-step' })), 12),
        container({ min_height: px(4), ...bg(SE.gray100), border_radius: sides(99), css_classes: 'se-dlg-track' }, [
          container({ min_height: px(4), ...bg(SE.gray900), border_radius: sides(99), css_classes: 'se-dlg-fill' }),
        ]),
      ], 18, { css_classes: 'se-dlg-progress' }),
      // pronto
      col([
        dlgTitle('Página publicada no WordPress', `Home em ${DEMO.project}.`),
        pageDetails(),
        row([icon('fas fa-check-circle', '#059669', 15), uiText('Página criada no site, publicada. 6 imagens foram para a biblioteca de mídia.', 13, SE.gray900, 400, { ...FILL, _element_width: '', _css_classes: 'se-wrap' })], 10, { flex_align_items: 'flex-start' }),
        row([spacer(), dlgButton('Editar no Elementor', 'outline', '', 'fas fa-external-link-alt'), dlgButton('Ver no site', 'primary', '', 'fas fa-external-link-alt')], 8),
      ], 18, { css_classes: 'se-dlg-done' }),
    ]),
  ], 0, { padding: sides(24), ...bg(SE.white), ...border(SE.lineLight), border_radius: sides(10), css_classes: 'se-dialog', custom_css: 'selector{box-shadow:0 10px 15px -3px rgb(0 0 0/.1),0 4px 6px -4px rgb(0 0 0/.1)}' })

  const toast = () => row([icon('fas fa-check-circle', SE.emerald, 14), uiText(`Home publicada em ${DEMO.site}`, 13, SE.white, 500)], 8, {
    padding: sides(11, 14), ...bg(SE.gray900), border_radius: sides(10), css_classes: 'se-toast',
    custom_css: 'selector{box-shadow:0 12px 30px -8px rgba(0,0,0,.45)}',
  })

  const cursor = () => image('cursor.svg', '', { width: px(38), _css_classes: 'se-cursor' })

  /** Régua das etapas embaixo da janela: acende junto com o scroll (story.ts). */
  const hud = (steps: string[]) => col([
    container({ css_classes: 'se-hud-track' }, [container({ css_classes: 'se-hud-fill' })]),
    b.grid(steps.map((label, i) => container({ css_classes: 'se-hud-step', padding: sides(12, 0, 0, 0) }, [
      heading(`[0${i + 1}] ${label}`, { font: 'mono', size: 12, line: 1.3, letter: 0.02 }, SE.onInkSoft),
      heading(`[0${i + 1}] ${label}`, { font: 'mono', size: 12, weight: 700, line: 1.3, letter: 0.02 }, SE.lime, { _css_classes: 'se-hud-lit' }),
    ])), `repeat(${steps.length},minmax(0,1fr))`, 16),
  ], 0, { css_classes: 'se-hud' })

  /** A janela inteira do Space com o projeto aberto. */
  const appWindow = (opts: ScreenOptions = {}) => col([
    col([
      appHeader(),
      container({ css_classes: 'se-canvas' }, [
        toolbar(!!opts.story),
        library(),
        pageFrame(opts),
        newPage(),
        bottomBar(),
        agentPanel([
          { kind: 'done', text: 'Montei a Home: 10 seções, uma por vez', time: '14:02' },
          { kind: 'change', text: 'Ajustei Serviços: banho e tosa primeiro, como o cliente pediu', time: '14:09' },
          { kind: 'done', text: 'Cliente aprovou a versão 3 no link', time: '14:31' },
        ]),
        ...(opts.story ? [toast()] : []),
      ]),
    ], 0, { css_classes: 'se-app-zoom' }),
    ...(opts.story ? [container({ css_classes: 'se-spot' }), container({ css_classes: 'se-shade' }), dialog(), cursor()] : []),
  ], 0, { css_classes: 'se-app' })

  return { appWindow, hud, pageDetails, appHeader, toolbar, library, sectionCard, pageFrame, bottomBar, agentPanel, dialog, toast, cursor, icon, dot, spacer, mono, publishButton, dlgButton, dlgTitle, choice }
}

export { gap }
