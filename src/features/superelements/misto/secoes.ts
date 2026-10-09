import { px, sides } from '../elementor'
import { type, type Spec } from '../modelo/elementor'
import { SC_FAQ } from '../clini/content'
import { buildFaq } from '../clini/elementor'
import { C, canvasShot, createBuilder, ui, type B, type ElementorNode } from './builder'
import { AGENT_ARROW, msIconCss } from './icons'

/**
 * Seções novas da página Modelo · misto (pedido do usuário em 2026-10-08):
 * "Com agente ou na mão" (o produto não é só para agente: o editor visual faz
 * tudo à mão, com vantagens próprias), "Componentes" (a biblioteca com os
 * números reais, exemplos e os componentes ligados, deixando claro que é
 * Elementor) e as Perguntas do modelo clinipago, com duas perguntas a mais.
 *
 * Desenho da página modelo (jota): fundo #F5F5F5, Geist, cartões brancos de
 * cantos largos e o amarelo #FFE84C só nas marcas pequenas. As peças do
 * produto dentro dos cartões usam Inter e as cores do app, como na tela do
 * produto (space.ts). Os números da biblioteca foram contados no índice do
 * pack (data/section-express/index.json, categorize() de section-pack) em
 * 2026-10-08: 3.503 seções em 17 caixinhas; os elementos são os do painel
 * Inserir (ElementsLibrary.tsx). Atualize se a biblioteca mudar.
 */

const INK = '#222222'
const LEDE = '#5A656D'
const YELLOW = '#FFE84C'
const CYAN = '#0891B2'

const geist = (size: number, line: number, weight = 400, letter?: number, mobile?: Spec['mobile'], tablet?: Spec['tablet']): Spec =>
  ({ size, line, weight, letter, family: 'Geist', ...(mobile ? { mobile } : {}), ...(tablet ? { tablet } : {}) })

const H2 = geist(80, 0.9, 400, -2.4, { size: 40, line: 0.95, letter: -1.2 }, { size: 57 })
const LEDE_SPEC = geist(20, 1.4, 400, -0.6, { size: 16, line: 1.35, letter: -0.32 })
const CARD_H = geist(32, 1.05, 400, -0.96, { size: 26, line: 1.05, letter: -0.78 })
const BODY = geist(16, 1.4, 400, -0.16, { size: 15, line: 1.4 })

// ---------- conteúdo ----------

export const MS_MANUAL = {
  title: 'Com agente <br>ou na mão.',
  lede: 'O agente é opcional. Tudo o que ele faz, você também faz no editor visual: clicando, arrastando e ajustando cada detalhe.',
  hand: {
    pill: 'Editor visual',
    title: 'Na mão, do seu jeito',
    items: [
      'Sem assinatura de agente e sem gastar tokens',
      'Arraste seções da biblioteca e troque textos e imagens pelo painel',
      'Cada aparelho com o seu ajuste: desktop, tablet e celular',
      'O que você ajusta à mão fica, mesmo quando a marca muda',
      'O cliente pode editar junto, com a conta dele',
    ],
  },
  agent: {
    pill: 'Claude Code ou Codex',
    title: 'Com o agente que você já usa',
    items: [
      'Usa a conta do Claude Code ou do Codex que você já tem',
      'Trabalha só na seção ou na camada que você selecionou',
      'Você vê o cursor dele e cada passo na conversa',
      'Cada mudança se desfaz com Ctrl+Z',
      'Publicar continua sendo decisão sua',
    ],
  },
  note: 'Os dois no mesmo canvas: o agente monta, você ajusta o detalhe.',
}

export const MS_LIBRARY = {
  title: 'Mais de 3.500 seções. <br>Todas em Elementor.',
  lede: 'Cabeçalhos, heróis, preços, depoimentos, perguntas e rodapés prontos para arrastar até a página. Chegam com a marca do projeto e continuam editáveis no Elementor.',
  stats: [
    ['+3.500', 'seções prontas na biblioteca'],
    ['17', 'categorias, do cabeçalho ao rodapé'],
    ['11', 'elementos para montar do zero'],
  ] as Array<[string, string]>,
  /** Exemplos montados no projeto Caramelo Pet; o número é o da categoria na biblioteca. */
  examples: [
    ['pet-02-hero.webp', 'Heróis', '414', '#FFF7EC'],
    ['pet-03-servicos.webp', 'Recursos e cards', '494', '#FFFFFF'],
    ['pet-05-clube-do-banho.webp', 'Preços', '114', '#FEE9D2'],
    ['pet-07-depoimentos.webp', 'Depoimentos', '159', '#FEF6F0'],
    ['pet-06-loja.webp', 'Blog, loja e portfólio', '380', '#A0D8F9'],
    ['pet-08-duvidas.webp', 'Perguntas', '30', '#FFFFFF'],
    ['pet-09-contato.webp', 'Contato', '213', '#FEF7EC'],
    ['pet-10-rodape.webp', 'Rodapés', '90', '#202A44'],
  ] as Array<[string, string, string, string]>,
  more: [
    ['Cabeçalhos', '143'], ['Conteúdo', '379'], ['Equipe', '250'], ['Números', '187'], ['Chamada para ação', '154'],
    ['Etapas e linha do tempo', '144'], ['Galeria e vídeo', '127'], ['Logos e redes sociais', '117'], ['Páginas especiais', '108'],
  ] as Array<[string, string]>,
  exampleNote: 'Exemplos montados no projeto Caramelo Pet, um petshop fictício.',
  components: {
    pill: 'Componentes',
    title: 'Mude uma vez. <br>Vale em todas.',
    text: 'Qualquer seção ou camada vira componente: o cabeçalho, um card, um botão. O estilo fica ligado em todas as páginas, e o texto pode ser de cada uma.',
    items: [
      'O cabeçalho e o rodapé do site entram em toda página nova',
      'No WordPress, viram modelos do Theme Builder do Elementor Pro',
      'Uma seção vira modelo salvo, e as páginas usam o mesmo',
    ],
    pages: ['Home', 'Serviços', 'Contato'],
  },
  elementor: ['Containers', 'Widgets nativos', 'Navigator', 'Theme Builder', 'Modelos salvos'],
}

/** As perguntas do modelo clinipago, mais as duas que o pedido trouxe. */
export const MS_FAQ: typeof SC_FAQ = {
  ...SC_FAQ,
  items: [
    ...SC_FAQ.items.slice(0, 3),
    ['Preciso usar um agente?', 'Não. Dá para fazer tudo à mão no editor visual: arrastar seções da biblioteca, trocar textos e imagens e ajustar cada aparelho. O agente é opcional e usa o Claude Code ou o Codex que você já tem.'],
    ['Dá para cuidar de vários clientes?', 'Sim. Cada cliente é um projeto, com a marca, as páginas e o WordPress dele, e todos ficam na mesma conta. Depois de conectar cada site uma vez, você importa, publica e volta versões daqui, sem abrir o painel de cada WordPress.'],
    ...SC_FAQ.items.slice(3),
  ],
}

// ---------- peças comuns ----------

const SECTION_CSS = [
  'selector{overflow:clip;position:relative}',
  'selector,selector *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
  'selector ::selection{background:#FFE84C;color:#222222}',
  'selector .elementor-heading-title{margin:0;padding:0}selector .elementor-widget-text-editor p{margin:0}',
  'selector .elementor-widget-image{line-height:0}selector .elementor-widget-image img{display:block}',
  'selector,selector .e-con{transition-property:background,border,box-shadow}',
  'selector .e-con{flex-wrap:nowrap;min-width:0}',
  'selector .ms-stack{display:grid!important;grid-template-columns:minmax(0,1fr)}selector .ms-stack>*{grid-area:1/1;min-width:0}',
  'selector .ms-i{width:16px!important;height:16px}selector .ms-ic12{width:12px!important;height:12px}selector .ms-ic14{width:14px!important;height:14px}selector .ms-ic16{width:16px!important;height:16px}',
  // cabeça centrada, no desenho da página modelo
  'selector .ms-head{align-items:center;text-align:center}',
  'selector .ms-h2{width:100%}selector .ms-h2 .elementor-heading-title{font-size:clamp(40px,5.55vw,80px)}',
  'selector .ms-lede{width:100%;max-width:660px;margin-top:24px}',
  `selector .ms-pill{height:32px;gap:8px;padding:0 14px;border-radius:999px;background:#F0F0F0;width:auto!important;flex:none;align-self:flex-start;--ic:${INK}}`,
  // lista com o check amarelo
  'selector .ms-checks{gap:12px}',
  'selector .ms-check{gap:12px;align-items:flex-start!important}',
  `selector .ms-check-dot{width:22px!important;height:22px;flex:none;border-radius:999px;background:${YELLOW};justify-content:center;--ic:${INK};margin-top:-1px}`,
  'selector .ms-check .elementor-widget-heading{flex:1 1 auto;min-width:0}',
  // blocos sobem ao entrar (o script do clinipago, na seção "Um projeto por cliente", liga o html.sc-live)
  'html.sc-live selector .sc-rise{opacity:0;transform:translateY(16px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}html.sc-live selector .sc-rise.is-in{opacity:1;transform:none}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important;animation:none!important}}',
  '@media(max-width:767px){selector h2.elementor-heading-title br{display:none}}',
].join('')

const root = (b: B, elements: ElementorNode[], options: { classes: string; id: string; css: string; pad?: [number, number, number, number, number, number] }) => {
  const [dt, db, tt, tb, mt, mb] = options.pad ?? [140, 120, 110, 96, 80, 72]
  const node = b.container({
    content_width: 'boxed', boxed_width: px(1126), flex_direction: 'column', flex_wrap: '',
    padding: sides(dt, 24, db, 24), padding_tablet: sides(tt, 24, tb, 24), padding_mobile: sides(mt, 16, mb, 16),
    background_background: 'classic', background_color: '#F5F5F5',
    html_tag: 'section', _element_id: options.id, css_classes: options.classes,
  }, elements)
  node.isInner = false
  node.settings.custom_css = SECTION_CSS + msIconCss(b.icons) + options.css
  return node
}

const head = (b: B, title: string, lede: string) =>
  b.col('ms-head sc-rise', [
    b.heading(title.replace(/\s*<br>/g, ' <br>'), H2, '#000000', 'ms-h2', { header_size: 'h2', align: 'center' }),
    b.text(lede, LEDE_SPEC, LEDE, 'ms-lede'),
  ])

const pill = (b: B, label: string, icon?: string, cls = '') =>
  b.row(`ms-pill ${cls}`.trim(), [...(icon ? [b.icon(icon, 'ms-ic14')] : []), b.heading(label, geist(14, 1, 500, -0.14), INK)])

const checks = (b: B, items: string[]) =>
  b.col('ms-checks', items.map((item) => b.row('ms-check', [b.row('ms-check-dot', [b.icon('check', 'ms-ic12')]), b.heading(item, BODY, INK, 'ms-wrap')])))

// =====================================================================
// Com agente ou na mão
// =====================================================================

/** Um pedaço da Abertura do Caramelo Pet selecionado à mão, com o painel Estilo ao lado. */
const handMock = (b: B) => {
  const field = (label: string, value: ElementorNode[], cls = '') =>
    b.row(`ms-f ${cls}`.trim(), [b.heading(label, ui(10.5, 400), C.g500, 'ms-f-l'), b.row('ms-f-v', value)])
  const page = b.col('ms-mk-page', [
    b.col('ms-mk-sel', [
      b.heading('Banho e tosa <br>com hora marcada <br>e <span class="ms-hl">sem fila.</span>', { size: 22, line: 1.08, weight: 600, letter: -0.2, family: 'Fredoka' }, C.navy, 'ms-mk-title'),
      b.row('ms-mk-badge', [b.icon('type', 'ms-ic12'), b.heading('Título · 212 × 72', ui(10, 500), C.white)]),
      ...['tl', 'tr', 'bl', 'br'].map((k) => b.container({ css_classes: `ms-handle ms-h-${k}` })),
    ]),
    b.row('ms-mk-btns', [
      b.row('ms-mk-btn ms-mk-btn-fill', [b.heading('Agendar pelo WhatsApp', { size: 8, line: 1, weight: 800, family: 'Nunito' }, C.navy)]),
      b.row('ms-mk-btn ms-mk-btn-line', [b.heading('Ver serviços', { size: 8, line: 1, weight: 800, family: 'Nunito' }, C.navy)]),
    ]),
  ])
  const panel = b.col('ms-mk-panel', [
    b.row('ms-mk-tabs', [b.row('ms-mk-tab', [b.heading('Agente', ui(11, 500), C.g500)]), b.row('ms-mk-tab is-on', [b.heading('Estilo', ui(11, 500), C.g900)])]),
    b.row('ms-mk-devs', [b.row('ms-mk-dev', [b.icon('monitor', 'ms-ic12')]), b.row('ms-mk-dev is-on', [b.icon('tablet', 'ms-ic12')]), b.row('ms-mk-dev', [b.icon('phone', 'ms-ic12')])]),
    b.heading('Texto', ui(10.5, 600), C.g900, 'ms-mk-group'),
    field('Fonte', [b.heading('Fredoka', ui(10.5, 500), C.g900)]),
    field('Tamanho', [b.heading('32', ui(10.5, 500), C.g900), b.heading('px', ui(10, 400), C.g400), b.container({ css_classes: 'ms-own' })], 'is-active'),
    field('Peso', [b.heading('600', ui(10.5, 500), C.g900)]),
    field('Cor', [b.container({ css_classes: 'ms-swatch' }), b.heading('1F2A44', ui(10.5, 500), C.g900)]),
    b.heading('Ajustando para Tablet: vale desta tela para baixo.', ui(9.5, 400, 1.35), '#6D28D9', 'ms-mk-note ms-wrap'),
  ])
  return b.container({ css_classes: 'ms-mock' }, [b.container({ css_classes: 'ms-mock-in' }, [page, panel, b.icon('pointer', 'ms-mk-mouse')])])
}

/** A conversa com o agente e a seção que ele criou, com o cursor dele. */
const agentMock = (b: B) => {
  const step = (text: string) => b.row('ms-ms-st', [b.icon('check', 'ms-ic12 ms-ok'), b.heading(text, ui(10.5, 400), C.g600, 'ms-wrap')])
  const chat = b.col('ms-mk-chat', [
    b.row('ms-mk-bubble', [b.heading('Cria uma seção de planos depois dos serviços.', ui(11, 400, 1.45), C.g900, 'ms-wrap')]),
    b.row('ms-mk-ahead', [b.container({ css_classes: 'ms-mk-adot' }), b.heading('Claude Code', ui(11, 600), C.g900)]),
    b.col('ms-mk-steps', [step('Lendo a página Home'), step('Criando a seção Clube do Banho')]),
    b.heading('Pronto. O Clube do Banho entrou depois de Serviços.', ui(11, 400, 1.45), C.g800, 'ms-wrap'),
  ])
  const shot = b.col('ms-mk-shot', [
    b.image(canvasShot('pet-05-clube-do-banho.webp'), '', 'ms-mk-shot-img'),
    b.row('ms-mk-lab', [b.heading('4 Clube do Banho · Claude Code criou', ui(9.5, 500), C.white)]),
  ])
  const cursor = b.container({ css_classes: 'ms-mk-cur' }, [
    b.container({ css_classes: 'ms-mk-arrow' }),
    b.row('ms-mk-name', [b.heading('Claude Code', ui(10.5, 600, 1), C.white)]),
  ])
  return b.container({ css_classes: 'ms-mock' }, [b.container({ css_classes: 'ms-mock-in' }, [shot, chat, cursor])])
}

const MANUAL_CSS = [
  'selector .ms-ways{display:grid!important;grid-template-columns:1fr 1fr;gap:24px;margin-top:64px}',
  'selector .ms-way{gap:24px;padding:40px;border-radius:40px;background:#fff}',
  'selector .ms-way-h{margin-top:-4px}',
  'selector .ms-note{margin-top:40px;text-align:center}',
  // a moldura das peças do produto: 470×280 desenhados, encolhem inteiros no celular
  'selector .ms-mock{position:relative;height:280px;border-radius:28px;background:#F5F5F5;overflow:hidden;justify-content:center;align-items:center;font-family:Inter,sans-serif}',
  'selector .ms-mock-in{position:relative;width:470px!important;height:280px;flex:none}',
  'selector .ms-mock .elementor-heading-title{white-space:nowrap}selector .ms-mock .ms-wrap .elementor-heading-title{white-space:normal}',
  'selector .ms-mock .elementor-widget-heading{flex:none;width:auto;max-width:100%}selector .ms-mock .ms-wrap{flex:0 1 auto!important;min-width:0}',
  `selector .ms-mk-page{position:absolute!important;left:18px;top:30px;width:246px!important;padding:40px 18px 22px;border-radius:12px;background:${C.cream};box-shadow:0 1px 2px rgb(0 0 0/.06),0 8px 24px -12px rgb(0 0 0/.18)}`,
  'selector .ms-mk-sel{position:relative;width:auto!important;align-self:flex-start;padding:2px 4px;margin:0 -4px}',
  `selector .ms-mk-sel::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 2px ${C.violet};pointer-events:none}`,
  'selector .ms-mk-title .elementor-heading-title{white-space:normal!important}',
  'selector .ms-hl{background:linear-gradient(transparent 58%,rgba(242,153,74,.42) 58%,rgba(242,153,74,.42) 94%,transparent 94%)}',
  `selector .ms-mk-badge{position:absolute!important;left:-2px;top:-22px;width:auto!important;gap:4px;padding:3px 6px;border-radius:5px 5px 5px 0;background:${C.violet};--ic:#fff}`,
  `selector .ms-handle{position:absolute!important;width:7px!important;height:7px;background:#fff;box-shadow:0 0 0 1.5px ${C.violet};z-index:2}`,
  'selector .ms-h-tl{left:-3px;top:-3px}selector .ms-h-tr{right:-3px;top:-3px}selector .ms-h-bl{left:-3px;bottom:-3px}selector .ms-h-br{right:-3px;bottom:-3px}',
  'selector .ms-mk-btns{gap:5px;margin-top:14px}',
  `selector .ms-mk-btn{height:20px;padding:0 10px;border-radius:999px;width:auto!important}selector .ms-mk-btn-fill{background:${C.caramel}}selector .ms-mk-btn-line{box-shadow:inset 0 0 0 1px ${C.navy}}`,
  `selector .ms-mk-panel{position:absolute!important;right:16px;top:16px;width:180px!important;padding:6px 10px 10px;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgb(0 0 0/.06),0 10px 28px -12px rgb(0 0 0/.22);gap:6px}`,
  'selector .ms-mk-tabs{gap:2px;margin:0 -4px 2px}selector .ms-mk-tab{height:24px;padding:0 8px;border-radius:6px;width:auto!important}selector .ms-mk-tab.is-on{background:#F3F4F6}',
  `selector .ms-mk-devs{gap:2px;padding:2px;border-radius:7px;background:${C.g100};width:auto!important;align-self:flex-start;--ic:${C.g500}}`,
  `selector .ms-mk-dev{width:24px!important;height:20px;border-radius:5px;justify-content:center}selector .ms-mk-dev.is-on{background:#fff;--ic:#6D28D9;box-shadow:0 0 0 1px rgb(0 0 0/.06),0 1px 2px rgb(0 0 0/.08)}`,
  'selector .ms-mk-group{margin-top:4px}',
  'selector .ms-f{justify-content:space-between;gap:8px;height:24px}',
  `selector .ms-f-v{height:22px;gap:4px;padding:0 7px;border-radius:6px;background:${C.g50};box-shadow:inset 0 0 0 1px ${C.g200};width:84px!important;flex:none;position:relative}`,
  `selector .ms-f.is-active .ms-f-v{box-shadow:inset 0 0 0 1px ${C.violet},0 0 0 3px rgba(139,92,246,.15)}`,
  `selector .ms-own{position:absolute!important;right:-12px;top:8px;width:5px!important;height:5px;border-radius:999px;background:${C.violet}}`,
  `selector .ms-swatch{width:12px!important;height:12px;flex:none;border-radius:3px;background:${C.navy}}`,
  'selector .ms-mk-note{margin-top:2px}',
  `selector .ms-mk-mouse{position:absolute!important;left:404px;top:150px;width:18px!important;height:18px;--ic:${C.g900};filter:drop-shadow(0 1px 1px rgba(255,255,255,.9))}`,
  // agente
  `selector .ms-mk-shot{position:absolute!important;right:16px;top:30px;width:226px!important;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 0 0 1.5px ${C.agent},0 10px 28px -12px rgb(0 0 0/.22)}`,
  'selector .ms-mk-shot-img img{width:100%;height:auto}',
  `selector .ms-mk-lab{position:absolute!important;left:0;top:0;width:auto!important;padding:2px 7px;border-radius:0 0 6px 0;background:${C.agent}}`,
  'selector .ms-mk-chat{position:absolute!important;left:16px;top:16px;width:212px!important;gap:8px;padding:12px;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgb(0 0 0/.06),0 10px 28px -12px rgb(0 0 0/.22)}',
  `selector .ms-mk-bubble{align-self:flex-end;width:auto!important;max-width:88%;padding:6px 9px;border-radius:12px 12px 4px 12px;background:${C.g100}}`,
  `selector .ms-mk-ahead{gap:5px}selector .ms-mk-adot{width:5px!important;height:5px;flex:none;border-radius:999px;background:${C.agent}}`,
  'selector .ms-mk-steps{gap:2px;padding-left:6px;border-left:2px solid rgba(217,119,87,.25)}selector .ms-ms-st{gap:5px}',
  `selector .ms-ok{--ic:${C.emerald}}`,
  'selector .ms-mk-cur{position:absolute!important;left:330px;top:150px;width:0!important;height:0;overflow:visible}',
  `selector .ms-mk-arrow{position:absolute!important;left:-3px;top:-2px;width:20px!important;height:24px;background:${AGENT_ARROW} center/contain no-repeat;filter:drop-shadow(0 1px 2px rgb(0 0 0/.3))}`,
  `selector .ms-mk-name{position:absolute!important;left:13px;top:19px;width:max-content!important;padding:4px 9px;border-radius:999px;background:${C.agent};box-shadow:0 2px 8px -2px rgb(0 0 0/.35)}`,
  '@media(prefers-reduced-motion:no-preference){selector .ms-mk-cur{animation:ms-float 4s ease-in-out infinite}selector .ms-mk-mouse{animation:ms-float 5s ease-in-out infinite}}',
  '@keyframes ms-float{50%{transform:translate(6px,-5px)}}',
  '@media(max-width:1024px){selector .ms-ways{grid-template-columns:1fr;margin-top:48px}}',
  '@media(max-width:767px){selector .ms-way{padding:24px;border-radius:32px;gap:20px}selector .ms-mock{height:184px;border-radius:22px}selector .ms-mock-in{zoom:.64}selector .ms-note{margin-top:28px}}',
  '@media(max-width:360px){selector .ms-mock{height:166px}selector .ms-mock-in{zoom:.58}}',
].join('')

export const buildManual = () => {
  const b = createBuilder('mm')
  const M = MS_MANUAL
  const card = (data: { pill: string; title: string; items: string[] }, icon: string, mock: ElementorNode) =>
    b.col('ms-way sc-rise', [pill(b, data.pill, icon), b.heading(data.title, CARD_H, INK, 'ms-way-h', { header_size: 'h3' }), mock, checks(b, data.items)])
  return root(b, [
    head(b, M.title, M.lede),
    b.container({ css_classes: 'ms-ways' }, [card(M.hand, 'pointer', handMock(b)), card(M.agent, 'chat', agentMock(b))]),
    b.text(M.note, geist(18, 1.4, 400, -0.36, { size: 16, line: 1.4 }), LEDE, 'ms-note sc-rise'),
  ], { classes: 'ms-manual', id: 'na-mao', css: MANUAL_CSS })
}

// =====================================================================
// Componentes: a biblioteca, exemplos e os componentes ligados
// =====================================================================

const LIBRARY_CSS = [
  'selector .ms-stats{display:grid!important;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:64px}',
  'selector .ms-stat{gap:6px;padding:28px 32px;border-radius:32px;background:#fff}',
  'selector .ms-stat-n .elementor-heading-title{font-variant-numeric:tabular-nums}',
  'selector .ms-examples{display:grid!important;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px}',
  'selector .ms-ex{gap:12px;padding:10px 10px 16px;border-radius:24px;background:#fff;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s cubic-bezier(.2,.8,.2,1)}',
  '@media(hover:hover) and (prefers-reduced-motion:no-preference){selector .ms-ex:hover{transform:translateY(-4px);box-shadow:0 18px 40px -24px rgba(0,0,0,.35)}}',
  'selector .ms-ex-frame{aspect-ratio:16/10;border-radius:16px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}',
  'selector .ms-ex-frame .elementor-widget-image,selector .ms-ex-frame .elementor-widget-container{width:100%;height:100%}',
  'selector .ms-ex-frame img{width:100%!important;height:100%!important;object-fit:contain;object-position:center}',
  'selector .ms-ex-foot{justify-content:space-between;gap:8px;padding:0 6px}',
  'selector .ms-ex-n{height:24px;padding:0 9px;border-radius:999px;background:#F0F0F0;width:auto!important;flex:none}',
  'selector .ms-more{flex-wrap:wrap!important;justify-content:center;gap:8px;margin-top:24px}',
  'selector .ms-more-chip{height:32px;gap:6px;padding:0 12px;border-radius:999px;background:#fff;width:auto!important}',
  'selector .ms-ex-note{margin-top:14px;text-align:center}',
  // componentes ligados
  'selector .ms-comp{display:grid!important;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:48px;align-items:center;margin-top:96px;padding:48px;border-radius:40px;background:#fff}',
  'selector .ms-comp-l{gap:22px;align-items:flex-start}',
  `selector .ms-pill-cyan{background:#ECFEFF;--ic:${CYAN}}selector .ms-pill-cyan .elementor-heading-title{color:${CYAN}!important}`,
  'selector .ms-comp-h .elementor-heading-title{font-size:clamp(30px,3.2vw,44px)}',
  'selector .ms-pages{display:grid!important;grid-template-columns:repeat(3,1fr);gap:14px;position:relative}',
  'selector .ms-pg{gap:8px}',
  'selector .ms-pg-name{gap:6px;padding:0 2px}',
  'selector .ms-pg-sheet{border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 12px 30px -18px rgba(0,0,0,.3)}',
  'selector .ms-pg-head{position:relative;z-index:1}selector .ms-pg-head img{width:100%;height:auto}',
  `selector .ms-pg-head::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 2px ${CYAN};pointer-events:none}`,
  `selector .ms-pg-tag{position:absolute!important;left:0;top:100%;width:auto!important;gap:4px;padding:2px 7px 3px 5px;border-radius:0 0 6px 0;background:${CYAN};z-index:2;--ic:#fff}`,
  'selector .ms-pg-body{aspect-ratio:16/12;overflow:hidden}selector .ms-pg-body .elementor-widget-image,selector .ms-pg-body .elementor-widget-container{height:100%}selector .ms-pg-body img{width:100%;height:100%;object-fit:cover;object-position:top center}',
  '@media(prefers-reduced-motion:no-preference){selector .ms-pg-head::after{animation:ms-link 3.6s ease-in-out infinite}selector .ms-pg:nth-child(2) .ms-pg-head::after{animation-delay:.25s}selector .ms-pg:nth-child(3) .ms-pg-head::after{animation-delay:.5s}}',
  '@keyframes ms-link{0%,60%,100%{box-shadow:inset 0 0 0 2px #0891B2}70%{box-shadow:inset 0 0 0 2px #0891B2,0 0 0 6px rgba(8,145,178,.25)}}',
  'selector .ms-elementor{flex-wrap:wrap!important;align-items:center;gap:8px;margin-top:6px}',
  `selector .ms-el-chip{height:28px;padding:0 11px;border-radius:999px;box-shadow:inset 0 0 0 1px #E4E3E5;width:auto!important}`,
  '@media(max-width:1024px){selector .ms-examples{grid-template-columns:repeat(2,1fr)}selector .ms-comp{grid-template-columns:1fr;gap:36px;padding:36px}}',
  '@media(max-width:767px){selector .ms-stats{grid-template-columns:1fr;gap:10px;margin-top:40px}selector .ms-stat{flex-direction:row!important;align-items:baseline!important;gap:12px;padding:18px 22px;border-radius:24px}selector .ms-examples{grid-template-columns:repeat(2,1fr);gap:10px}selector .ms-ex{padding:6px 6px 12px;border-radius:18px;gap:8px}selector .ms-ex-frame{border-radius:12px}selector .ms-comp{margin-top:56px;padding:24px;border-radius:32px}selector .ms-pages{gap:8px}selector .ms-pg-tag .elementor-heading-title{font-size:9px!important}}',
].join('')

export const buildComponentes = () => {
  const b = createBuilder('mc')
  const L = MS_LIBRARY
  const stats = b.container({ css_classes: 'ms-stats' }, L.stats.map(([n, label]) =>
    b.col('ms-stat sc-rise', [
      b.heading(n, geist(64, 1, 400, -1.92, { size: 40, line: 1, letter: -1.2 }), INK, 'ms-stat-n'),
      b.heading(label, geist(16, 1.35, 400, -0.16, { size: 15, line: 1.35 }), LEDE, 'ms-wrap'),
    ])))
  const examples = b.container({ css_classes: 'ms-examples' }, L.examples.map(([file, name, count, color]) =>
    b.col('ms-ex sc-rise', [
      b.col('ms-ex-frame', [b.image(canvasShot(file), `Exemplo de seção: ${name}`)], { background_background: 'classic', background_color: color }),
      b.row('ms-ex-foot', [
        b.heading(name, geist(15, 1.25, 500, -0.3, { size: 13, line: 1.25 }), INK, 'ms-wrap'),
        b.row('ms-ex-n', [b.heading(count, geist(12, 1, 500, 0, { size: 11, line: 1 }), INK, 'ms-tnum')]),
      ]),
    ])))
  const more = b.row('ms-more sc-rise', [
    b.heading('Também:', geist(14, 1, 400, -0.14), LEDE),
    ...L.more.map(([name, count]) => b.row('ms-more-chip', [b.heading(name, geist(14, 1, 500, -0.14), INK), b.heading(count, geist(13, 1, 400), '#8A8F98')])),
  ])
  const P = L.components
  const page = (name: string, body: string, first: boolean) =>
    b.col('ms-pg', [
      b.row('ms-pg-name', [b.icon(name === 'Home' ? 'home' : 'file', 'ms-ic12'), b.heading(name, ui(11.5, 500), C.g700)]),
      b.col('ms-pg-sheet', [
        b.col('ms-pg-head', [
          b.image(canvasShot('pet-01-cabecalho.webp'), ''),
          b.row('ms-pg-tag', [b.icon('diamond', 'ms-ic12'), b.heading(first ? 'Cabeçalho do site' : 'Cabeçalho', ui(10, 500), C.white)]),
        ]),
        b.col('ms-pg-body', [b.image(canvasShot(body), '')]),
      ]),
    ])
  const components = b.container({ css_classes: 'ms-comp sc-rise' }, [
    b.col('ms-comp-l', [
      pill(b, P.pill, 'diamond', 'ms-pill-cyan'),
      b.heading(P.title.replace(/\s*<br>/g, ' <br>'), geist(48, 1, 400, -1.44, { size: 32, line: 1.05, letter: -0.96 }), INK, 'ms-comp-h', { header_size: 'h3' }),
      b.text(P.text, BODY, LEDE),
      checks(b, P.items),
      b.row('ms-elementor', [
        b.heading('Tudo em Elementor:', geist(14, 1, 400, -0.14), LEDE),
        ...L.elementor.map((name) => b.row('ms-el-chip', [b.heading(name, geist(13, 1, 500, -0.13), INK)])),
      ]),
    ]),
    b.container({ css_classes: 'ms-pages' }, [
      page(P.pages[0], 'pet-02-hero.webp', true),
      page(P.pages[1], 'pet-03-servicos.webp', false),
      page(P.pages[2], 'pet-09-contato.webp', false),
    ]),
  ])
  return root(b, [
    head(b, L.title, L.lede),
    stats,
    examples,
    more,
    b.text(L.exampleNote, geist(13, 1.4, 400, -0.13), '#8A8F98', 'ms-ex-note'),
    components,
  ], { classes: 'ms-library', id: 'componentes', css: LIBRARY_CSS, pad: [56, 140, 48, 110, 40, 80] })
}

// =====================================================================
// Perguntas: o desenho do modelo clinipago, com ids próprios desta página
// =====================================================================

export const buildPerguntas = () => buildFaq(MS_FAQ, 'msf', 'msq')

export const MS_SECTIONS = {
  manual: { title: 'Com agente ou na mão', sourceId: 'superelements-misto-na-mao' },
  library: { title: 'Componentes e biblioteca', sourceId: 'superelements-misto-componentes' },
  faq: { title: 'Perguntas', sourceId: 'superelements-misto-perguntas' },
}

