import type { LandingTemplate } from './landingTemplates'
import { MSA, MSA_LINKS } from '@/features/msa/tokens'
import { T, bg, createBuilder, gap, link, maxw, px, sides } from '@/features/msa/elementor'
import { MSA_STORY_SCRIPT } from '@/features/msa/story'

/**
 * Homepage MSA em Elementor nativo. Conteúdo complexo vai em cards quase
 * quadrados (borda estrutural, sem sombra); o movimento é só entrada suave
 * (`src/features/msa/story.ts`). O CSS de cada seção já é o estado final, que é
 * o que aparece sem JavaScript.
 */

const EYEBROW_SM = { ...T.eyebrow, size: 10, letter: 0.16 }

type Builder = ReturnType<typeof createBuilder>
type Links = Array<[string, string]>
type CardTone = 'light' | 'ink' | 'dark' | 'sage'
const CARD_FILL: Record<CardTone, string | undefined> = { light: MSA.paper, ink: MSA.ink, dark: undefined, sage: MSA.sage }

/** Configuração de um card; `classes` soma ganchos próprios aos da marca. */
const card = (tone: CardTone, classes = '', extra: Record<string, unknown> = {}) => {
  const fill = CARD_FILL[tone]
  return {
    css_classes: `msa-card msa-card-${tone} msa-rise ${classes}`.trim(),
    padding: sides(32, 28), padding_mobile: sides(26, 22),
    ...(fill ? bg(fill) : {}),
    ...extra,
  }
}

/**
 * Cabeçalho de seção: título na largura toda, uma frase por linha (`<br>` no
 * texto), e o texto de apoio abaixo, alinhado à direita no desktop. Na coluna
 * estreita os títulos quebravam no meio da frase.
 */
const sectionHead = (b: Builder, label: string, title: string, lede: string, dark = false) => b.col([
  b.col([
    b.eyebrow(label, dark ? 'dark' : 'light'),
    b.heading(title, T.h2, dark ? MSA.paper : MSA.ink, { header_size: 'h2', ...maxw(1180) }),
  ], 22, { css_classes: 'msa-rise' }),
  b.text(lede, T.lede, dark ? MSA.onDark : MSA.muted, { _css_classes: 'msa-rise msa-lede-offset', ...maxw(500) }),
], 28)

const list = (items: string[]) => `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`

// ── 1. abertura ─────────────────────────────────────────────────────────────

const makeHero = () => {
  const b = createBuilder('mh')
  // primeiro filho: o script marca a página antes do hero ser pintado
  const motion = b.widget('html', {
    html: `<script>${MSA_STORY_SCRIPT}</script>`,
    _css_classes: 'msa-motion-controller',
    custom_css: 'selector{display:none!important}',
  })
  // entrada: a marca aparece, a linha enche e o painel sobe
  const preloader = b.container({ css_classes: 'msa-preloader', flex_direction: 'column', ...bg(MSA.ink) }, [
    b.col([
      b.heading('MSA', { font: 'display', size: 112, tablet: 96, mobile: 72, weight: 800, line: 0.9, letter: -0.04 }, MSA.paper, { _css_classes: 'msa-pre-mark' }),
      b.mark('msa-pre-bar', { min_height: px(2) }),
      b.heading('MARKETING SEM AGÊNCIA', { ...T.eyebrow, letter: 0.24 }, MSA.onDark, { _css_classes: 'msa-pre-name' }),
    ], 22, { css_classes: 'msa-pre-center', flex_align_items: 'center' }),
  ])
  const navLink = (label: string, url: string) => b.heading(label, T.nav, MSA.ink, { link: link(url), _css_classes: 'msa-link' })
  const header = b.row([
    b.row([
      b.heading('MSA', { ...T.h3, size: 22, mobile: 20, weight: 800 }, MSA.ink, { link: link('#topo') }),
      b.heading('MARKETING SEM AGÊNCIA', EYEBROW_SM, MSA.muted, { _css_classes: 'msa-wordmark-sub' }),
    ], 10, { flex_align_items: 'baseline' }),
    b.row([
      navLink('Método', '#metodo'),
      navLink('Programa', '#programa'),
      navLink('Henrique', '#henrique'),
      b.button('Conhecer o programa', '#proximo-passo', 'dark', { text_padding: sides(13, 20) }, false),
    ], 28, { flex_justify_content: 'flex-end' }),
  ], 24, { flex_justify_content: 'space-between', padding: sides(14, 0), css_classes: 'msa-nav msa-intro' })

  const headline = b.col([
    b.eyebrow('PROGRAMA DE IMPLEMENTAÇÃO · 6 MESES', 'light', { _css_classes: 'msa-eyebrow msa-intro' }),
    b.heading('MARKETING QUE FICA DENTRO DA SUA EMPRESA.', T.hero, MSA.ink, { header_size: 'h1', _css_classes: 'msa-hero-title msa-intro', ...maxw(1120) }),
  ], 24, { padding: sides(64, 0, 0, 0), padding_tablet: sides(52, 0, 0, 0), padding_mobile: sides(40, 0, 0, 0) })
  const copy = b.col([
    b.text('A MSA constrói com você a direção, o time e o sistema de gestão para o marketing operar por dentro — e continuar funcionando sem dependência permanente.', T.lede, MSA.muted, { _css_classes: 'msa-intro', ...maxw(500) }),
    b.col([
      b.button('Quero conhecer o programa', '#proximo-passo', 'dark'),
      b.text('Aplicação por análise de perfil.', T.small, MSA.muted),
    ], 14, { flex_align_items: 'flex-start', css_classes: 'msa-intro' }),
  ], 32)

  // o Sistema MSA lido de cima para baixo, de 01 a 04; a camada final em sálvia
  const layers = [
    ['01', 'DIREÇÃO', 'Negócio e prioridade'],
    ['02', 'PESSOAS', 'Papéis e contratação'],
    ['03', 'PROCESSO', 'Rotina e tecnologia'],
    ['04', 'AUTONOMIA', 'Gestão dentro de casa'],
  ].map(([number, title, note], index) => {
    const last = index === 3
    return b.grid([
      b.heading(number, T.eyebrow, last ? MSA.ink : MSA.muted),
      b.heading(title, { ...T.h3, size: 18, mobile: 16 }, MSA.ink),
      b.text(note, T.small, last ? MSA.ink : MSA.muted),
    ], '44px 1fr auto', 16, {
      css_classes: 'msa-layer', grid_align_items: 'center',
      padding: sides(18, 24), padding_mobile: sides(15, 18),
      border_border: 'solid', border_width: sides(1, 0, 0, 0), border_color: MSA.lineSoft,
      ...(last ? bg(MSA.sage) : {}),
    }, { tablet: '44px 1fr auto', mobile: '36px 1fr' })
  })
  const plan = b.col([
    b.row([
      b.eyebrow('SISTEMA MSA'),
      b.heading('4 CAMADAS', EYEBROW_SM, MSA.muted),
    ], 16, { flex_justify_content: 'space-between', padding: sides(20, 24), padding_mobile: sides(16, 18) }),
    ...layers,
    b.col([b.text('A estrutura acumula. A dependência diminui.', T.small, MSA.muted)], 0, {
      padding: sides(16, 24), padding_mobile: sides(14, 18),
      border_border: 'solid', border_width: sides(1, 0, 0, 0), border_color: MSA.lineSoft,
    }),
  ], 0, { css_classes: 'msa-plan msa-card msa-card-light msa-intro', ...bg(MSA.paper) })

  return b.section('MSA · Abertura', 'msa-v4-hero', b.root([
    motion,
    preloader,
    header,
    b.rule(MSA.line, { css_classes: 'msa-intro' }),
    headline,
    b.grid([copy, plan], 'minmax(0,.86fr) minmax(0,1.14fr)', [40, 72], {
      grid_align_items: 'start',
      padding: sides(44, 0, 0, 0), padding_tablet: sides(36, 0, 0, 0), padding_mobile: sides(28, 0, 0, 0),
    }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: MSA.paper, id: 'topo', pad: false,
    settings: {
      css_classes: 'msa-motion-root msa-hero msa-grid-bg',
      padding: sides(0, 32, 104, 32), padding_tablet: sides(0, 24, 84, 24), padding_mobile: sides(0, 20, 64, 20),
    },
    css: [
      // preloader: invisível sem script; o script liga html.msa-loading antes da primeira pintura
      'selector{z-index:999}',
      'html.msa-loading{overflow:hidden;scrollbar-gutter:stable}',
      'selector .msa-preloader{position:fixed;inset:0;z-index:9999;width:auto;display:flex;align-items:center;justify-content:center;visibility:hidden;opacity:0;pointer-events:none}',
      'html.msa-loading selector .msa-preloader{visibility:visible;opacity:1;pointer-events:auto}',
      '@media(prefers-reduced-motion:no-preference){html:not(.msa-loading) selector .msa-preloader{transition:opacity 360ms ease,visibility 0s linear 360ms}}',
      `selector .msa-pre-bar{position:relative;width:180px;background-color:${MSA.lineDark};--msa-bar:1}`,
      `selector .msa-pre-bar:after{content:"";position:absolute;inset:0;background:${MSA.sage};transform:scaleX(var(--msa-bar));transform-origin:0 50%}`,
      'html.msa-loading selector .msa-pre-bar{--msa-bar:0}',
      'html.msa-loading selector .msa-pre-mark,html.msa-loading selector .msa-pre-name{opacity:0}',
      'selector .msa-nav{min-height:76px}selector .msa-nav>.e-con:first-child{flex:0 0 auto;width:auto}selector .msa-nav .elementor-button{white-space:nowrap}',
      // no desktop a manchete quebra onde o sentido pede: "que fica / dentro da sua / empresa"
      '@media(min-width:1025px){selector .msa-hero-title .elementor-heading-title{text-wrap:wrap}}',
      'selector .msa-plan{overflow:hidden}',
      'selector .msa-layer .elementor-widget-text-editor{text-align:right}',
      '@media(max-width:767px){selector .msa-nav .elementor-button{padding:12px 16px;min-height:44px}selector .msa-nav .msa-link,selector .msa-wordmark-sub{display:none}selector .msa-layer .elementor-widget-text-editor{grid-column:2;text-align:left}}',
    ].join(''),
  }))
}

// ── 2. o que muda: dependência × capacidade ────────────────────────────────

const makeContrast = () => {
  const b = createBuilder('mc')
  // a tag diz de que lado cada card está: sem a MSA (borda) e com a MSA (sálvia)
  const side = (tone: 'light' | 'ink', tag: string, number: string, label: string, title: string, items: string[]) => {
    const dark = tone === 'ink'
    return b.col([
      b.row([
        b.heading(tag, { ...T.eyebrow, size: 11, letter: 0.16 }, MSA.ink, { _css_classes: `msa-tag ${dark ? 'msa-tag-sage' : 'msa-tag-line'}`, _element_width: 'auto' }),
        b.heading(`${number} · ${label}`, T.eyebrow, dark ? MSA.sage : MSA.muted, { _element_width: 'auto' }),
      ], 12, { flex_justify_content: 'space-between', flex_wrap: 'wrap' }),
      b.heading(title, { ...T.statement, size: 28, tablet: 26, mobile: 23 }, dark ? MSA.paper : MSA.ink, { header_size: 'h3', ...maxw(440) }),
      b.text(list(items), { ...T.body, size: 16, line: 1.55 }, dark ? MSA.paper : MSA.muted, { _css_classes: `msa-list ${dark ? 'msa-list-check' : 'msa-list-dash'}` }),
    ], 24, card(tone, '', { padding: sides(36, 32), padding_mobile: sides(28, 22) }))
  }

  return b.section('MSA · O que muda', 'msa-v4-contrast', b.root([
    sectionHead(b, 'O QUE MUDA', 'MARKETING NÃO SE ALUGA.<br>SE CONSTRÓI.', 'O problema não é trabalhar com especialistas externos. É passar anos investindo sem transformar esse trabalho em repertório, processo e capacidade dentro da empresa.'),
    b.grid([
      side('light', 'SEM A MSA', '01', 'DEPENDÊNCIA', 'A entrega termina. O aprendizado vai embora.', [
        'Estratégia dispersa entre fornecedores e campanhas',
        'Pessoas sem uma rotina de gestão compartilhada',
        'O que foi aprendido sai junto com cada entrega',
      ]),
      side('ink', 'COM A MSA', '02', 'CAPACIDADE', 'Cada ciclo deixa a empresa mais preparada.', [
        'Papéis claros dentro do time',
        'Critérios e documentação próprios',
        'Leitura de resultado dentro da operação',
      ]),
    ], 'minmax(0,1fr) minmax(0,1fr)', 20, {}, { tablet: 'minmax(0,1fr) minmax(0,1fr)', mobile: '1fr' }),
  ], {
    background: MSA.soft, space: 56,
    css: [
      'selector .msa-tag .elementor-heading-title{display:inline-block;padding:8px 12px 7px;border:1px solid transparent;border-radius:2px}',
      `selector .msa-tag-line .elementor-heading-title{border-color:${MSA.line};color:${MSA.muted}}`,
      `selector .msa-tag-sage .elementor-heading-title{background-color:${MSA.sage};border-color:${MSA.sage}}`,
    ].join(''),
  }))
}

// ── 3. método ───────────────────────────────────────────────────────────────

const makeMethod = () => {
  const b = createBuilder('mm')
  const stages = [
    ['01', 'FUNDAÇÃO', 'Diagnóstico e direção', 'O negócio, as vendas e a operação definem o que o marketing precisa sustentar.'],
    ['02', 'ESTRUTURA', 'Pessoas e processos', 'Papéis, contratação, onboarding, rotinas, ferramentas e documentação entram no lugar.'],
    ['03', 'ENTREGA', 'Operação assistida', 'A gestão acontece com acompanhamento, leitura de resultados e ajustes no trabalho real.'],
    ['04', 'PERMANÊNCIA', 'Autonomia', 'O time e o sistema ficam dentro da empresa. A consultoria deixa de ser uma dependência.'],
  ].map(([number, label, title, copy], index) => {
    const last = index === 3
    return b.col([
      // quatro traços no topo: cada etapa acende os seus
      b.mark('msa-ticks', { min_height: px(3) }),
      b.heading(number, { font: 'display', size: 40, mobile: 34, weight: 700, line: 1 }, last ? MSA.ink : MSA.sage),
      b.col([
        b.heading(label, T.eyebrow, last ? MSA.ink : MSA.sage),
        b.heading(title, { ...T.h3, size: 20, mobile: 19 }, last ? MSA.ink : MSA.paper, { header_size: 'h3' }),
      ], 8),
      b.text(copy, { ...T.body, size: 15, line: 1.6 }, last ? MSA.ink : MSA.onDark),
    ], 22, card(last ? 'sage' : 'dark', `msa-stage msa-stage-${index + 1}`))
  })

  return b.section('MSA · Método', 'msa-v4-method', b.root([
    sectionHead(b, 'MARKETING CONSTRUTIVO', 'NÃO É TERCEIRIZAR TAREFAS.<br>É CONSTRUIR CAPACIDADE.', 'A proposta do MSA é instalar uma estrutura que acumula repertório, histórico e gestão dentro do negócio.', true),
    b.grid(stages, 'repeat(4,minmax(0,1fr))', 16, {}, { tablet: 'repeat(2,minmax(0,1fr))', mobile: '1fr' }),
  ], {
    background: MSA.ink, id: 'metodo', space: 56,
    css: [
      `selector .msa-ticks{position:relative;width:100%;--k:1;--tick-track:${MSA.lineDark};--tick-fill:${MSA.sage};background:repeating-linear-gradient(90deg,var(--tick-track) 0,var(--tick-track) calc(25% - 4px),transparent calc(25% - 4px),transparent 25%)}`,
      'selector .msa-ticks:after{content:"";position:absolute;left:0;top:0;bottom:0;width:calc(var(--k) * 25%);background:repeating-linear-gradient(90deg,var(--tick-fill) 0,var(--tick-fill) calc(100% / var(--k) - 4px),transparent calc(100% / var(--k) - 4px),transparent calc(100% / var(--k)))}',
      'selector .msa-stage-2 .msa-ticks{--k:2}selector .msa-stage-3 .msa-ticks{--k:3}',
      `selector .msa-stage-4 .msa-ticks{--k:4;--tick-track:rgba(47,35,23,.2);--tick-fill:${MSA.ink}}`,
    ].join(''),
  }))
}

// ── 4. programa ─────────────────────────────────────────────────────────────

const makeProgram = () => {
  const b = createBuilder('mg')
  const phases = [
    ['MESES 01–02', 'DIAGNÓSTICO E DIREÇÃO'],
    ['MESES 03–06', 'CONSTRUÇÃO E OPERAÇÃO ASSISTIDA'],
    ['MESES 07–09', 'ACOMPANHAMENTO'],
  ].map(([period, title], index) => b.col([
    b.heading(period, T.eyebrow, index === 2 ? MSA.ink : MSA.muted),
    b.heading(title, { ...T.h3, size: 18, mobile: 17 }, MSA.ink, { header_size: 'h3' }),
  ], 10, card(index === 2 ? 'sage' : 'light', '', { padding: sides(24) })))
  const tiles = [
    ['01', 'DIREÇÃO', 'Prioridades conectadas ao negócio e às vendas.'],
    ['02', 'DESENHO DO TIME', 'Papéis, perfis e apoio à contratação.'],
    ['03', 'ONBOARDING', 'Entrada estruturada para reduzir improviso.'],
    ['04', 'SISTEMA DE TRABALHO', 'Agenda, tarefas, documentação e ferramentas.'],
    ['05', 'GESTÃO', 'Rituais, critérios e acompanhamento de resultado.'],
    ['06', 'TRANSFERÊNCIA', 'Decisões e repertório ficam com a empresa.'],
  ].map(([number, title, copy]) => b.col([
    b.heading(number, { ...T.h3, size: 16 }, MSA.muted),
    b.heading(title, { ...T.h3, size: 20, mobile: 18 }, MSA.ink, { header_size: 'h3' }),
    b.text(copy, { ...T.small, size: 15 }, MSA.muted),
  ], 12, card('light')))

  return b.section('MSA · O programa', 'msa-v4-program', b.root([
    sectionHead(b, 'O PROGRAMA', 'SEIS MESES PARA CONSTRUIR.<br>TRÊS PARA CONSOLIDAR.', 'Uma implementação acompanhada no trabalho real. A MSA ajuda a desenhar a estrutura, colocar as pessoas para operar e transformar a rotina em um sistema que não dependa permanentemente da consultoria.'),
    b.grid(phases, '2fr 4fr 3fr', 12, {}, { tablet: '2fr 4fr 3fr', mobile: '1fr' }),
    b.col([
      b.eyebrow('O QUE É CONSTRUÍDO', 'light', { _css_classes: 'msa-eyebrow msa-rise' }),
      b.grid(tiles, 'repeat(3,minmax(0,1fr))', 16, {}, { tablet: 'repeat(2,minmax(0,1fr))', mobile: '1fr' }),
    ], 22, { padding: sides(16, 0, 0, 0) }),
  ], { background: MSA.soft, id: 'programa', space: 40 }))
}

// ── 5. Henrique ─────────────────────────────────────────────────────────────

/**
 * Editorial sobre fundo espresso: quatro fotos (o retrato e três de palco
 * enviadas pelo usuário em 2026-09-29) em duas colunas defasadas, sem legenda.
 * O script abre as molduras, move as colunas em sentidos opostos e cada foto
 * um pouco por dentro; o texto fica preso ao lado enquanto elas passam.
 */
const makeFounder = () => {
  const b = createBuilder('mf')
  const photo = (file: string, alt: string, classes: string, position = '50% 50%') => b.col([
    b.image(`/brands/marketing-sem-agencia/assets/${file}`, alt, {
      image_border_radius: sides(0),
      custom_css: `selector img{object-position:${position}}`,
    }),
  ], 0, { css_classes: `msa-photo ${classes}` })
  const mosaic = b.grid([
    b.col([
      photo('henrique-palco.jpg', 'Henrique Zanotti no palco, de camiseta verde, com um passador de slides na mão', 'msa-ratio-34 msa-depth-2', '40% 50%'),
      photo('henrique-evento.jpg', 'Palco de evento com o nome Henrique Zanotti no telão', 'msa-ratio-45 msa-depth-1'),
    ], 14, { css_classes: 'msa-mosaic-col msa-mosaic-a' }),
    b.col([
      photo('henrique-retrato.jpg', 'Henrique Zanotti sentado numa poltrona de madeira, de terno azul', 'msa-ratio-34 msa-depth-1', '50% 30%'),
      photo('henrique-microfone.jpg', 'Henrique Zanotti falando ao microfone num evento', 'msa-ratio-34 msa-depth-2', '50% 35%'),
    ], 14, { css_classes: 'msa-mosaic-col msa-mosaic-b' }),
  ], 'minmax(0,1fr) minmax(0,1fr)', 14, { css_classes: 'msa-mosaic' }, { tablet: 'minmax(0,1fr) minmax(0,1fr)', mobile: 'minmax(0,1fr) minmax(0,1fr)' })

  const spec = (label: string, value: ReturnType<Builder['text']>, first = false) => b.grid([
    b.heading(label, EYEBROW_SM, MSA.sage),
    value,
  ], '104px 1fr', 16, {
    padding: sides(16, 0),
    ...(first ? {} : { border_border: 'solid', border_width: sides(1, 0, 0, 0), border_color: MSA.lineDark }),
  }, { tablet: '104px 1fr', mobile: '1fr' })
  const copy = b.col([
    b.heading('“Eu saio.<br>A máquina fica.”', { ...T.statement, size: 36, tablet: 36, mobile: 25, line: 1.1 }, MSA.paper, { _css_classes: 'msa-rise msa-quote' }),
    b.text('A trajetória pública de Henrique reúne estratégia, liderança de equipes e atuação em operações de marketing e vendas.', T.body, MSA.onDark, { _css_classes: 'msa-rise', ...maxw(480) }),
    b.col([
      spec('ATUAÇÃO', b.text('Estratégia, liderança de equipes e operações de marketing e vendas.', T.small, MSA.paper), true),
      spec('NA BIO', b.text('“Construo operações próprias de marketing.”', T.small, MSA.paper)),
      spec('INSTAGRAM', b.heading('@hzanotti', T.nav, MSA.paper, { link: link(MSA_LINKS.instagram), _css_classes: 'msa-link', _element_width: 'auto' })),
    ], 0, { css_classes: 'msa-card msa-card-dark msa-rise', padding: sides(6, 22), padding_mobile: sides(4, 18) }),
    b.button('Ver perfil do Henrique', MSA_LINKS.instagram, 'outlineLight', { _css_classes: 'msa-rise' }),
  ], 28, { css_classes: 'msa-founder-copy' })

  return b.section('MSA · Henrique Zanotti', 'msa-v4-founder', b.root([
    b.col([
      b.eyebrow('QUEM CONDUZ', 'dark'),
      b.heading('<span class="msa-name-a">HENRIQUE</span><br><span class="msa-name-b msa-outline">ZANOTTI</span>', {
        font: 'display', size: 132, tablet: 96, mobile: 50, weight: 700, line: 0.92, letter: -0.02, transform: 'uppercase',
      }, MSA.paper, { header_size: 'h2', _css_classes: 'msa-name msa-rise' }),
    ], 24),
    b.grid([mosaic, copy], 'minmax(0,1.1fr) minmax(0,.9fr)', [48, 64], { grid_align_items: 'start' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: MSA.ink, id: 'henrique', space: 48,
    css: [
      'selector .msa-name .elementor-heading-title{overflow:visible}',
      'selector .msa-name-a,selector .msa-name-b{display:inline-block}',
      'selector .msa-name-b{margin-left:.9em}',
      // eco esmaecido, não contorno: a Syne é variável e o text-stroke mostra as sobreposições das letras
      'selector .msa-outline{color:rgba(243,239,228,.28)}',
      // mosaico: duas colunas, a da direita começa mais baixo
      'selector .msa-mosaic-b{padding-top:88px}',
      `selector .msa-photo{position:relative;overflow:hidden;border-radius:2px;background-color:${MSA.muted}}`,
      'selector .msa-photo .elementor-widget-image{position:absolute;inset:0}',
      'selector .msa-photo img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;outline:1px solid rgba(255,255,255,.1);outline-offset:-1px}',
      'selector .msa-ratio-34{aspect-ratio:3/4}selector .msa-ratio-45{aspect-ratio:4/5}',
      // o texto fica ao lado enquanto as fotos passam
      '@media(min-width:1025px){selector .msa-founder-copy{position:sticky;top:14vh}}',
      '@media(max-width:1024px){selector .msa-name-b{margin-left:.6em}}',
      '@media(max-width:767px){selector .msa-name-b{margin-left:0}selector .msa-mosaic-b{padding-top:40px}}',
    ].join(''),
  }))
}

// ── 6. para quem faz sentido ────────────────────────────────────────────────

const makeFit = () => {
  const b = createBuilder('mi')
  const signals = [
    ['01', 'OPERAÇÃO DE INSIDE SALES', 'A empresa vende por um time comercial que precisa de demanda gerada e maturada pelo marketing.'],
    ['02', 'DECISÃO INTERNA', 'Sócio, direção ou liderança participa da construção e sustenta as mudanças necessárias.'],
    ['03', 'DISPOSIÇÃO PARA CONSTRUIR', 'Existe abertura para contratar, organizar papéis e transformar a rotina — não apenas pedir campanhas.'],
  ].map(([number, title, copy]) => b.col([
    b.row([
      b.mark('msa-check', { min_height: px(28) }),
      b.heading(number, T.eyebrow, MSA.muted),
    ], 14),
    b.heading(title, { ...T.h3, size: 20, mobile: 18 }, MSA.ink, { header_size: 'h3' }),
    b.text(copy, { ...T.body, size: 16 }, MSA.muted),
  ], 16, card('light')))

  return b.section('MSA · Para quem faz sentido', 'msa-v4-fit', b.root([
    sectionHead(b, 'PARA QUEM FAZ SENTIDO', 'NÃO É UMA TROCA DE FORNECEDOR.<br>É UMA DECISÃO DE ESTRUTURA.', 'A aderência é avaliada antes da proposta, numa conversa de diagnóstico. Estes são os sinais de que construir faz sentido agora.'),
    b.grid(signals, 'repeat(3,minmax(0,1fr))', 16, {}, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: MSA.soft, space: 56,
    css: [
      `selector .msa-check{position:relative;flex:none;width:28px;height:28px;border-radius:2px;background-color:${MSA.sage}}`,
      `selector .msa-check:after{content:"";position:absolute;left:10px;top:5px;width:7px;height:13px;border:solid ${MSA.ink};border-width:0 2px 2px 0;transform:rotate(45deg)}`,
    ].join(''),
  }))
}

// ── 7. perguntas ────────────────────────────────────────────────────────────

const FAQ: Array<[string, string]> = [
  ['A MSA substitui qualquer agência?', 'Não necessariamente. O foco é construir direção, gestão e capacidade interna. Especialistas externos podem continuar fazendo sentido quando têm um papel claro dentro do sistema.'],
  ['É um curso ou uma mentoria?', 'Não. É uma implementação acompanhada dentro da operação, com decisões sobre pessoas, processos, ferramentas e gestão.'],
  ['A empresa precisa já ter um time de marketing?', 'Não há uma regra única. O diagnóstico identifica o que deve ser reorganizado, desenvolvido ou contratado para a estrutura funcionar.'],
  ['Quanto tempo dura?', 'Seis meses de implementação e três meses de acompanhamento.'],
  ['Como começa?', 'Com uma aplicação e uma conversa de diagnóstico. A proposta é construída a partir do contexto e da aderência ao modelo.'],
]

const makeFaq = () => {
  const b = createBuilder('mq')
  const accordion = b.widget('nested-accordion', {
    items: FAQ.map(([question], index) => ({ item_title: question, _id: `mqfq${index + 1}` })),
    default_state: 'all_collapsed',
    max_items_expended: 'multiple',
    n_accordion_animation_duration: { unit: 'ms', size: 260, sizes: [] },
    accordion_item_title_icon: { value: 'fas fa-plus', library: 'fa-solid' },
    accordion_item_title_icon_active: { value: 'fas fa-minus', library: 'fa-solid' },
    accordion_item_title_position_horizontal: 'stretch',
    title_typography_typography: 'custom', title_typography_font_family: 'Syne',
    title_typography_font_size: px(19), title_typography_font_size_mobile: px(17),
    title_typography_font_weight: '600', title_typography_line_height: { unit: 'em', size: 1.3, sizes: [] },
    normal_title_color: MSA.ink, hover_title_color: MSA.ink, active_title_color: MSA.ink,
    normal_icon_color: MSA.ink, hover_icon_color: MSA.ink, active_icon_color: MSA.ink,
    _css_classes: 'msa-faq msa-rise',
  })
  accordion.elements = FAQ.map(([, answer]) => b.col([
    b.text(answer, T.body, MSA.muted, maxw(600)),
  ], 0, { padding: sides(0, 56, 26, 52), padding_mobile: sides(0, 8, 22, 40) }))

  const icon = 'selector .msa-faq .e-n-accordion-item-title-icon'
  return b.section('MSA · Perguntas frequentes', 'msa-v4-faq', b.root([
    b.grid([
      b.col([
        b.eyebrow('PERGUNTAS FREQUENTES'),
        b.heading('O QUE PRECISA ESTAR CLARO ANTES DE CONSTRUIR.', { ...T.h2, size: 40, tablet: 36, mobile: 30 }, MSA.ink, { header_size: 'h2', ...maxw(460) }),
      ], 22, { css_classes: 'msa-sticky msa-rise' }),
      accordion,
    ], 'minmax(0,.8fr) minmax(0,1.2fr)', [40, 72], { grid_align_items: 'start' }, { tablet: '1fr', mobile: '1fr' }),
  ], {
    background: MSA.paper, id: 'faq',
    css: [
      `selector .msa-faq .e-n-accordion{counter-reset:msaq;border-top:1px solid ${MSA.line}}`,
      `selector .msa-faq .e-n-accordion-item{border-bottom:1px solid ${MSA.line}}`,
      'selector .msa-faq .e-n-accordion-item>.e-con{border:0}',
      'selector .msa-faq .e-n-accordion-item-title{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px 0;border:0;border-radius:0;background:transparent;cursor:pointer;list-style:none}',
      'selector .msa-faq .e-n-accordion-item-title::-webkit-details-marker{display:none}',
      'selector .msa-faq .e-n-accordion-item-title-text{display:grid;grid-template-columns:52px 1fr;align-items:baseline}',
      `selector .msa-faq .e-n-accordion-item-title-text:before{counter-increment:msaq;content:counter(msaq,decimal-leading-zero);font:600 11px/1 Urbanist,sans-serif;letter-spacing:.18em;color:${MSA.muted}}`,
      `${icon}{position:relative;flex:none;width:34px;height:34px;border:1px solid ${MSA.line};border-radius:2px;background-color:transparent}`,
      `${icon}>*{display:none}`,
      `${icon}:before,${icon}:after{content:"";position:absolute;left:50%;top:50%;width:12px;height:2px;margin:-1px 0 0 -6px;background:${MSA.ink}}`,
      `${icon}:after{transform:rotate(90deg)}`,
      `selector .msa-faq .e-n-accordion-item[open] .e-n-accordion-item-title-icon{background-color:${MSA.sage};border-color:${MSA.sage}}`,
      'selector .msa-faq .e-n-accordion-item[open] .e-n-accordion-item-title-icon:after{transform:rotate(90deg) scaleX(0)}',
      `@media(hover:hover) and (pointer:fine){selector .msa-faq .e-n-accordion-item-title:hover .e-n-accordion-item-title-icon{border-color:${MSA.ink}}}`,
      `@media(prefers-reduced-motion:no-preference){${icon}{transition:background-color 180ms ease,border-color 180ms ease}${icon}:after{transition:transform 220ms cubic-bezier(.2,0,0,1)}selector .msa-faq .e-n-accordion-item[open]>.e-con{animation:msaAnswer 240ms ease-out}@keyframes msaAnswer{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}}`,
      '@media(min-width:1025px){selector .msa-sticky{position:sticky;top:48px}}',
      '@media(max-width:767px){selector .msa-faq .e-n-accordion-item-title-text{grid-template-columns:40px 1fr}}',
    ].join(''),
  }))
}

// ── 8. próximo passo ────────────────────────────────────────────────────────

const makeNextStep = () => {
  const b = createBuilder('mn')
  const steps = [
    ['01', 'APLICAÇÃO', 'A entrada começa pela análise de perfil.'],
    ['02', 'DIAGNÓSTICO', 'A conversa verifica contexto e aderência.'],
    ['03', 'PROPOSTA', 'O escopo nasce do momento real da operação.'],
  ].map(([number, title, copy]) => b.grid([
    b.heading(number, { ...T.h3, size: 16 }, MSA.sage),
    b.col([
      b.heading(title, { ...T.h3, size: 18 }, MSA.paper, { header_size: 'h3' }),
      b.text(copy, T.small, MSA.onDark),
    ], 6),
  ], '40px 1fr', 12, { css_classes: 'msa-card msa-card-dark', padding: sides(20, 22) }, { tablet: '40px 1fr', mobile: '36px 1fr' }))

  return b.section('MSA · Próximo passo', 'msa-v4-next-step', b.root([
    b.grid([
      b.col([
        b.eyebrow('PRÓXIMO PASSO', 'dark'),
        b.heading('SE A ESTRUTURA PRECISA FICAR, A&nbsp;CONVERSA COMEÇA POR&nbsp;DENTRO.', { ...T.h2, size: 46, tablet: 40, mobile: 30 }, MSA.paper, { header_size: 'h2', ...maxw(640) }),
        b.text('A entrada começa por uma aplicação curta. Se houver aderência, a conversa de diagnóstico define o escopo.', T.body, MSA.onDark, maxw(520)),
        b.button('Quero conhecer o programa', MSA_LINKS.apply, 'sage'),
      ], 24),
      b.col(steps, 10),
    ], 'minmax(0,1.2fr) minmax(0,.8fr)', [40, 64], card('ink', '', {
      grid_align_items: 'center',
      padding: sides(56, 52), padding_tablet: sides(44, 36), padding_mobile: sides(32, 22),
    }), { tablet: '1fr', mobile: '1fr' }),
  ], { background: MSA.soft, id: 'proximo-passo' }))
}

// ── 9. rodapé ───────────────────────────────────────────────────────────────

const makeFooter = () => {
  const b = createBuilder('mt')
  const footerLink = (label: string, url: string) => b.heading(label, T.nav, MSA.paper, { link: link(url), _css_classes: 'msa-link' })
  const column = (label: string, links: Links) => b.col([
    b.eyebrow(label, 'dark'),
    b.col(links.map(([text, url]) => footerLink(text, url)), 12),
  ], 18)
  return b.section('MSA · Rodapé', 'msa-v4-footer', b.root([
    b.grid([
      b.col([
        b.row([
          b.heading('MSA', { ...T.h3, size: 26, weight: 800 }, MSA.paper),
          b.heading('MARKETING SEM AGÊNCIA', EYEBROW_SM, MSA.onDark),
        ], 10, { flex_align_items: 'baseline' }),
        b.text('Marketing que fica dentro da empresa: direção, time e gestão que continuam depois da consultoria.', T.small, MSA.onDark, maxw(340)),
      ], 18),
      column('NAVEGAÇÃO', [['Método', '#metodo'], ['Programa', '#programa'], ['Henrique', '#henrique'], ['Perguntas', '#faq']]),
      column('CONTATO', [['Instagram', MSA_LINKS.instagram], ['Aplicação', MSA_LINKS.apply], ['Voltar ao topo', '#topo']]),
      b.col([b.button('Quero conhecer o programa', MSA_LINKS.apply, 'sage')], 0, { flex_align_items: 'flex-start' }),
    ], 'minmax(0,1.5fr) minmax(0,.7fr) minmax(0,.7fr) auto', [36, 40], {}, { tablet: 'minmax(0,1fr) minmax(0,1fr)', mobile: '1fr' }),
    b.heading('MSA', { font: 'display', size: 320, tablet: 220, mobile: 84, weight: 800, line: 0.8, letter: -0.05 }, MSA.paper, { _css_classes: 'msa-footer-mark' }),
    b.col([
      b.rule(MSA.lineDark),
      b.row([
        b.text('© 2026 Marketing Sem Agência', T.small, MSA.onDark),
        b.text('Prévia de projeto · dados legais e política de privacidade pendentes.', T.small, MSA.onDark),
      ], 24, { flex_justify_content: 'space-between', flex_wrap: 'wrap', flex_gap_mobile: gap(8, 24) }),
    ], 20),
  ], {
    background: MSA.ink, pad: false, space: 56,
    settings: {
      css_classes: 'msa-footer',
      padding: sides(96, 32, 32, 32), padding_tablet: sides(72, 24, 28, 24), padding_mobile: sides(56, 20, 26, 20),
    },
    css: [
      'selector .msa-footer-mark{opacity:.08;width:100%}',
      'selector .msa-footer-mark .elementor-heading-title{display:flex;justify-content:center;overflow:hidden;padding:.08em .06em 0;white-space:nowrap}',
    ].join(''),
  }))
}

export const createMsaTemplate = (): LandingTemplate => ({
  id: 'msa-homepage-v4',
  name: 'MSA · Homepage V4',
  description: 'Homepage nativa em cards: planta do Sistema MSA, dependência × capacidade, quatro etapas do método, programa, critérios e rodapé estruturado. Entrada suave com GSAP e estado final sem script.',
  audience: 'Empresas B2B com operação de Inside Sales',
  componentIds: ['msa-v4-hero', 'msa-v4-contrast', 'msa-v4-method', 'msa-v4-program', 'msa-v4-founder', 'msa-v4-fit', 'msa-v4-faq', 'msa-v4-next-step', 'msa-v4-footer'],
  sections: [makeHero(), makeContrast(), makeMethod(), makeProgram(), makeFounder(), makeFit(), makeFaq(), makeNextStep(), makeFooter()],
})
