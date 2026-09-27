import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'
import { PROCESSBASE_GRAPH_SCRIPT } from './processbaseGraph'

/**
 * Componentes da ProcessBase montados do zero com os tokens de
 * brands/processbase/DESIGN.md: navbar fixo no topo e hero com o grafo de
 * conexões animado ao fundo.
 */

type JsonRecord = Record<string, unknown>
type ElementorNode = { id: string; elType: 'container' | 'widget'; isInner: boolean; widgetType?: string; settings: JsonRecord; elements: ElementorNode[] }

const colors = {
  navy: '#171A2C',
  orange: '#FF5900',
  slate: '#829AAF',
  white: '#FFFFFF',
  textOnNavy: 'rgba(255,255,255,0.72)',
  line: 'rgba(130,154,175,0.18)',
}
const FONT = 'Inter'
const EASE = 'cubic-bezier(.2,.7,.2,1)'
const NAV_HEIGHT = 68

const NAV_LINKS: [string, string][] = [
  ['O que fazemos', '#o-que-fazemos'],
  ['Método', '#metodo'],
  ['Pilares', '#pilares'],
  ['Resultados', '#resultados'],
  ['Dúvidas', '#duvidas'],
  ['Contato', '#contato'],
]
const CTA = { label: 'Agendar conversa', url: '#contato' }

const px = (size: number) => ({ unit: 'px', size, sizes: [] })
const em = (size: number) => ({ unit: 'em', size, sizes: [] })
const gap = (size: number) => ({ unit: 'px', size, row: String(size), column: String(size), isLinked: true })
const sides = (top: number, right: number, bottom: number, left: number) => ({
  unit: 'px', top: String(top), right: String(right), bottom: String(bottom), left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
})
const asset = (path: string) => `${window.location.origin}/brands/processbase/${path}`

// Ids com prefixo por seção: o CSS do motor e o do Elementor são por id.
const createBuilder = (prefix: string) => {
  let sequence = 0
  const uid = () => `${prefix}${(++sequence).toString(16).padStart(7 - prefix.length, '0')}`
  const container = (settings: JsonRecord, elements: ElementorNode[] = []): ElementorNode => ({ id: uid(), elType: 'container', isInner: true, settings, elements })
  const widget = (widgetType: string, settings: JsonRecord): ElementorNode => ({ id: uid(), elType: 'widget', isInner: false, widgetType, settings, elements: [] })
  const typography = (size: number, weight: string, extra: JsonRecord = {}, prefixKey = 'typography') => ({
    [`${prefixKey}_typography`]: 'custom', [`${prefixKey}_font_family`]: FONT,
    [`${prefixKey}_font_size`]: px(size), [`${prefixKey}_font_weight`]: weight, ...extra,
  })
  const button = (label: string, url: string, variant: 'primary' | 'outline', size: 'sm' | 'md', extra: JsonRecord = {}) => widget('button', {
    text: label, link: { url }, size,
    ...typography(size === 'sm' ? 14 : 15, '500', { typography_line_height: em(1.2) }),
    text_padding: size === 'sm' ? sides(10, 18, 10, 18) : sides(14, 24, 14, 24),
    border_radius: sides(8, 8, 8, 8),
    ...(variant === 'primary'
      ? {
          background_color: colors.orange, button_text_color: colors.navy,
          button_background_hover_color: colors.white, hover_color: colors.navy,
        }
      : {
          background_color: 'rgba(255,255,255,0)', button_text_color: colors.white,
          border_border: 'solid', border_width: sides(1.5, 1.5, 1.5, 1.5), border_color: 'rgba(255,255,255,0.36)',
          button_background_hover_color: 'rgba(255,255,255,0.06)', hover_color: colors.white, button_hover_border_color: colors.white,
        }),
    ...extra,
  })
  const section = (title: string, sourceId: string, root: ElementorNode): SectionNodeData => ({ title, sourceId, elementorJson: JSON.stringify([root]) })
  return { container, widget, typography, button, section }
}

// Hover só troca cor (DESIGN.md §5); foco visível em laranja.
const interactionCss = `
selector .elementor-button,selector a{transition-property:color,background-color,border-color;transition-duration:200ms;transition-timing-function:${EASE}}
selector a:focus-visible,selector summary:focus-visible,selector .elementor-button:focus-visible{outline:2px solid ${colors.orange};outline-offset:3px}
`

const menuCss = `
selector .pb-menu{position:relative}
selector .pb-menu summary{list-style:none;display:flex;flex-direction:column;justify-content:center;gap:6px;width:40px;height:40px;padding:0 11px;box-sizing:border-box;border:1px solid rgba(130,154,175,.32);border-radius:8px;cursor:pointer;transition:border-color 200ms ${EASE}}
selector .pb-menu summary::-webkit-details-marker{display:none}
selector .pb-menu summary span{display:block;height:1.5px;border-radius:1px;background:${colors.white};transition:transform 240ms ${EASE}}
selector .pb-menu[open] summary{border-color:rgba(255,255,255,.6)}
selector .pb-menu[open] summary span:first-child{transform:translateY(3.75px) rotate(45deg)}
selector .pb-menu[open] summary span:last-child{transform:translateY(-3.75px) rotate(-45deg)}
selector .pb-menu-panel{position:absolute;top:calc(100% + 22px);right:0;width:min(300px,calc(100vw - 40px));display:flex;flex-direction:column;padding:8px;box-sizing:border-box;background:${colors.navy};border:1px solid rgba(130,154,175,.22);border-radius:16px;font-family:${FONT},sans-serif}
selector .pb-menu-panel a{padding:12px 14px;border-radius:8px;color:rgba(255,255,255,.78);font-size:15px;line-height:1.3;text-decoration:none}
selector .pb-menu-panel a:hover{color:${colors.white};background:rgba(255,255,255,.06)}
selector .pb-menu-panel .pb-menu-cta{margin-top:8px;text-align:center;font-weight:500;color:${colors.navy};background:${colors.orange}}
selector .pb-menu-panel .pb-menu-cta:hover{color:${colors.navy};background:${colors.white}}
@keyframes pbMenuIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
selector .pb-menu[open] .pb-menu-panel{animation:pbMenuIn 220ms ${EASE}}
@media(prefers-reduced-motion:reduce){selector .pb-menu[open] .pb-menu-panel{animation:none}selector .pb-menu summary span{transition:none}}
`

// O menu do celular copia os links e o botão do menu principal, então basta
// editar os itens da lista e o botão no Elementor.
const MENU_SCRIPT = `
(function () {
  [].forEach.call(document.querySelectorAll('.pb-menu:not([data-pb-ready])'), function (menu) {
    menu.setAttribute('data-pb-ready', '1');
    var panel = menu.querySelector('.pb-menu-panel'), cta = panel.querySelector('.pb-menu-cta');
    var nav = menu.closest('.pb-nav');
    var links = nav ? nav.querySelectorAll('.pb-nav-links a') : [];
    if (links.length) {
      [].forEach.call(panel.querySelectorAll('a:not(.pb-menu-cta)'), function (a) { a.remove(); });
      [].forEach.call(links, function (link) {
        var a = document.createElement('a');
        a.href = link.getAttribute('href');
        a.textContent = link.textContent.trim();
        panel.insertBefore(a, cta);
      });
    }
    var button = nav && nav.querySelector('.pb-nav-cta a.elementor-button');
    if (button && cta) {
      cta.href = button.getAttribute('href') || cta.href;
      cta.textContent = button.textContent.trim() || cta.textContent;
    }
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) menu.open = false; });
    document.addEventListener('click', function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !menu.open) return;
      menu.open = false;
      menu.querySelector('summary').focus();
    });
  });
})();
`

const makeNavbar = (): SectionNodeData => {
  const b = createBuilder('pbn')
  const menuHtml = `<details class="pb-menu"><summary aria-label="Abrir menu"><span></span><span></span></summary><nav class="pb-menu-panel" aria-label="Menu">${
    NAV_LINKS.map(([label, url]) => `<a href="${url}">${label}</a>`).join('')
  }<a class="pb-menu-cta" href="${CTA.url}">${CTA.label}</a></nav></details><script>${MENU_SCRIPT}</script>`

  const logo = b.widget('image', {
    image: { id: 0, url: asset('logo/processbase-logo-reverse.svg'), alt: 'ProcessBase', source: 'url', size: '' },
    image_size: 'full', align: 'left', link_to: 'custom', link: { url: '#inicio' },
    _css_classes: 'pb-nav-logo',
    custom_css: 'selector{justify-self:start}selector a{display:inline-block}selector img{display:block;height:26px;width:auto}@media(max-width:767px){selector img{height:22px}}',
  })
  const links = b.widget('icon-list', {
    view: 'inline', link_click: 'inline',
    icon_list: NAV_LINKS.map(([text, url], index) => ({ _id: `pbl${index}`, text, link: { url }, selected_icon: { value: '', library: '' } })),
    space_between: px(32), space_between_tablet: px(24),
    text_color: colors.textOnNavy, text_color_hover: colors.white,
    ...b.typography(14, '400', {}, 'icon_typography'),
    hide_tablet: 'hidden-tablet', hide_mobile: 'hidden-mobile',
    _css_classes: 'pb-nav-links',
  })
  const actions = b.container({
    content_width: 'full', flex_direction: 'row', flex_justify_content: 'flex-end', flex_align_items: 'center', flex_wrap: 'nowrap',
    flex_gap: gap(12), padding: sides(0, 0, 0, 0), css_classes: 'pb-nav-actions',
  }, [
    b.button(CTA.label, CTA.url, 'primary', 'sm', { hide_mobile: 'hidden-mobile', _css_classes: 'pb-nav-cta' }),
    b.widget('html', { html: menuHtml, hide_desktop: 'hidden-desktop', _css_classes: 'pb-nav-menu' }),
  ])

  const root = b.container({
    content_width: 'boxed', boxed_width: px(1280),
    container_type: 'grid',
    grid_columns_grid: { unit: 'custom', size: '1fr auto 1fr', sizes: [] },
    grid_columns_grid_tablet: { unit: 'custom', size: '1fr auto', sizes: [] },
    grid_columns_grid_mobile: { unit: 'custom', size: '1fr auto', sizes: [] },
    grid_rows_grid: { unit: 'fr', size: 1, sizes: [] },
    grid_gaps: gap(24), grid_align_items: 'center',
    padding: sides(14, 32, 14, 32), padding_mobile: sides(14, 20, 14, 20),
    // Navy chapado: a marca só usa transparência no supergráfico.
    background_background: 'classic', background_color: colors.navy,
    border_border: 'solid', border_width: sides(0, 0, 1, 0), border_color: colors.line,
    z_index: 100,
    css_classes: 'pb-nav',
    // Pro: fixa com o JS do Elementor; o position:sticky abaixo cobre o motor e o Free.
    sticky: 'top', sticky_on: ['desktop', 'tablet', 'mobile'], sticky_offset: 0,
    custom_css: `
selector{position:sticky;top:0;min-height:${NAV_HEIGHT}px}
selector .pb-nav-links .elementor-icon-list-items{flex-wrap:nowrap;white-space:nowrap}
${interactionCss}${menuCss}`,
  }, [logo, links, actions])

  return b.section('Navbar fixo · ProcessBase', 'processbase-navbar', root)
}

const makeHero = (): SectionNodeData => {
  const b = createBuilder('pbh')
  const reveal = (delay: number, isWidget = true) => (isWidget
    ? { _animation: 'fadeInUp', _animation_delay: delay, animation_duration: 'fast' }
    : { animation: 'fadeInUp', animation_delay: delay, animation_duration: 'fast' })

  const graph = b.widget('html', {
    html: `<canvas class="pb-graph" aria-hidden="true" data-line="${colors.slate}" data-accent="${colors.orange}"></canvas><script>${PROCESSBASE_GRAPH_SCRIPT}</script>`,
    _css_classes: 'pb-hero-graph',
  })
  const eyebrow = b.widget('heading', {
    title: 'Sistemas de crescimento operacional', header_size: 'p', title_color: colors.slate, align: 'center',
    ...b.typography(12, '700', { typography_text_transform: 'uppercase', typography_letter_spacing: px(1.8), typography_line_height: em(1.4) }),
    ...reveal(0),
  })
  const title = b.widget('heading', {
    title: 'Estrutura para melhorar. <span>Ritmo para crescer.</span>', header_size: 'h1', title_color: colors.white, align: 'center',
    ...b.typography(64, '400', {
      typography_font_size_tablet: px(52), typography_font_size_mobile: px(40),
      typography_line_height: em(1.02),
      typography_letter_spacing: px(-3.2), typography_letter_spacing_tablet: px(-2.6), typography_letter_spacing_mobile: px(-2),
    }),
    _css_classes: 'pb-hero-title',
    ...reveal(80),
  })
  const lead = b.widget('text-editor', {
    editor: '<p>Organizamos cultura, processos, treinamentos e estratégia em ciclos curtos de melhoria. Menos desperdício, mais margem e uma operação pronta para escalar.</p>',
    text_color: colors.textOnNavy, align: 'center',
    ...b.typography(18, '400', { typography_font_size_mobile: px(16), typography_line_height: em(1.55) }),
    _css_classes: 'pb-hero-lead',
    ...reveal(160),
  })
  const actions = b.container({
    content_width: 'full', flex_direction: 'row', flex_direction_mobile: 'column',
    flex_justify_content: 'center', flex_align_items: 'center', flex_align_items_mobile: 'stretch',
    flex_gap: gap(12), padding: sides(0, 0, 0, 0), margin: sides(12, 0, 0, 0),
    css_classes: 'pb-hero-actions',
    ...reveal(240, false),
  }, [
    b.button('Agendar uma conversa', CTA.url, 'primary', 'md', { align_mobile: 'justify' }),
    b.button('Ver como funciona', '#metodo', 'outline', 'md', { align_mobile: 'justify' }),
  ])
  const pillars = b.widget('heading', {
    title: 'Cultura · Processos · Treinamentos · Estratégia', header_size: 'p', title_color: colors.slate, align: 'center',
    ...b.typography(10, '400', { typography_text_transform: 'uppercase', typography_letter_spacing: px(1.2), typography_line_height: em(1.6) }),
    _margin: sides(8, 0, 0, 0),
    ...reveal(320),
  })
  const content = b.container({
    content_width: 'full', flex_direction: 'column', flex_align_items: 'center', flex_gap: gap(24),
    padding: sides(0, 0, 0, 0), css_classes: 'pb-hero-content',
  }, [eyebrow, title, lead, actions, pillars])

  const root = b.container({
    content_width: 'full', flex_direction: 'column', flex_justify_content: 'center', flex_align_items: 'center',
    padding: sides(120, 24, 120, 24), padding_tablet: sides(96, 24, 96, 24), padding_mobile: sides(80, 20, 88, 20),
    background_background: 'classic', background_color: colors.navy,
    overflow: 'hidden',
    css_classes: 'pb-hero', _element_id: 'inicio',
    custom_css: `
selector{min-height:calc(100vh - ${NAV_HEIGHT}px);isolation:isolate}
selector > .pb-hero-graph{position:absolute!important;inset:0;width:auto!important;max-width:none!important;margin:0!important;z-index:0;pointer-events:none}
selector > .pb-hero-graph .elementor-widget-container{height:100%}
selector .pb-graph{display:block;width:100%;height:100%}
selector > .pb-hero-content{position:relative;z-index:1;width:100%;max-width:880px}
selector .pb-hero-title .elementor-heading-title span{display:block;color:${colors.slate}}
selector .pb-hero-lead{max-width:580px}
selector .pb-hero-lead p{margin:0}
@media(max-width:767px){selector .pb-hero-actions > .elementor-widget-button{width:100%}}
${interactionCss}`,
  }, [graph, content])

  return b.section('Hero com grafo · ProcessBase', 'processbase-hero', root)
}

export const createProcessBaseTemplate = (): LandingTemplate => ({
  id: 'processbase',
  name: 'ProcessBase',
  description: 'Navbar fixo no topo e hero com grafo de conexões animado: um sinal laranja percorre ciclos de quatro nós, os quatro pilares da marca.',
  audience: 'ProcessBase',
  sections: [makeNavbar(), makeHero()],
})
