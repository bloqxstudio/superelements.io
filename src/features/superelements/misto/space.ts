import { gap, px } from '../elementor'
import { type, type Spec } from '../modelo/elementor'
import { C, asset, canvasShot, createBuilder, ui, type B } from './builder'
import { MS_MOTION_SCRIPT } from './motion'
import { AGENT_ARROW, msIconCss } from './icons'

/**
 * "Tela do produto no scroll" da página Modelo · misto: o Space como ele é
 * hoje (2026-10-08, desenho do Framer: barra em cima, Páginas/Camadas/
 * Biblioteca à esquerda, a página como folha no canvas, Agente/Estilo à
 * direita) e um agente trabalhando nele, como no produto: o pedido vai pelo
 * chat com a seção selecionada, o cursor do Claude Code lê e mexe, a seção
 * fica borrada com a varredura e volta nítida com "Claude Code mudou", a seção
 * nova entra em esqueleto e revela, e no fim ele publica a página no WordPress.
 *
 * Tudo é nativo (containers e títulos); o desenho fica no CSS da seção, em
 * classes `ms-*`, com as medidas do app (src/features/space/*). Os ícones são
 * máscaras CSS no traço do lucide. O projeto mostrado é o exemplo fictício
 * Caramelo Pet. O CSS sozinho mostra o fim da história (a conversa inteira,
 * as duas mudanças e a página no site); o motion.ts arma o começo e o scroll
 * conduz.
 */

// ---------- conteúdo ----------

export const MS_DEMO = {
  project: 'Caramelo Pet',
  page: 'Home',
  site: 'caramelopet.exemplo',
  /** Nome do site no WordPress (o diálogo diz "em Caramelo Pet"). */
  siteName: 'Caramelo Pet',
  pages: [
    { name: 'Home', path: '/', count: ['9', '10'], icon: 'home' },
    { name: 'Serviços', path: '/servicos', count: ['6'], icon: 'file' },
    { name: 'Clube do Banho', path: '/clube-do-banho', count: ['4'], icon: 'file' },
    { name: 'Contato', path: '/contato', count: ['3'], icon: 'file' },
  ],
  /** Altura da Home a 1440px, antes e depois do Clube do Banho (as fotos do canvas têm 960px). */
  dims: ['Desktop 1440 × 5.544', 'Desktop 1440 × 6.465'],
  ask: 'Deixa o título da abertura mais direto e põe o Clube do Banho logo depois dos serviços.',
  approve: 'Ficou ótimo. Pode publicar.',
  titleOld: 'Seu pet volta <br>cheiroso, feliz <br>e <span class="ms-hl">sem estresse.</span>',
  titleNew: 'Banho e tosa <br>com hora marcada <br>e <span class="ms-hl">sem fila.</span>',
  steps: [
    { icon: 'eye', text: 'Lendo a página Home' },
    { icon: 'pen', text: 'Reescrevendo o título da Abertura' },
    { icon: 'pointer', text: 'Criando a seção Clube do Banho' },
    { icon: 'eye', text: 'Conferindo no desktop e no celular' },
  ],
  reply: 'Pronto. O título da Abertura agora diz <strong>Banho e tosa com hora marcada e sem fila.</strong> O Clube do Banho entrou depois de Serviços, com os três planos.',
  publishStep: { icon: 'pointer', text: 'Atualizando a Home em caramelopet.exemplo' },
  published: 'Publicado. A Home está no ar em <strong>caramelopet.exemplo</strong>, com o título novo e o Clube do Banho.',
  usage: ['41 s · 23,8 mil tokens', '18 s · 6,2 mil tokens'],
  summary: ['Sem pedidos ainda', 'Claude Code trabalhando', '1 pedido · 23,8 mil tokens', '2 pedidos · 30 mil tokens'],
  /** O que o cursor do agente diz em cada momento (AgentCursors). */
  tips: ['Lendo a página', 'Reescrevendo o título', 'Montando: Clube do Banho', 'Conferindo a página', 'Publicando a Home'],
  /** Etapas reais de atualizar uma página ligada (src/features/wordpress/publish.ts). */
  publishing: [
    'Conferindo o site…',
    'Conferindo a página no site…',
    'Enviando imagens para o site (1 de 1)…',
    'Gravando a página no WordPress…',
    'Limpando o cache de CSS do Elementor…',
  ],
  /** Régua embaixo da janela: as quatro partes da história. */
  hud: ['Você pede', 'O agente muda a página', 'Você confere', 'Publicado no site'],
}

/** O título e o texto que o usuário escreveu para esta seção (mantidos como estão). */
const HEAD = {
  title: 'Conecte seu agente. <br>Construa qualquer coisa.',
  lede: '<p>Em poucos cliques, conecte o Codex ou o Claude Code que você já usa. Faça um pedido e acompanhe o agente construir páginas, seções ou experiências completas no canvas — tudo continua editável no Elementor.</p>',
}



// ---------- a janela do Space ----------

/** Botão quadrado da barra: só o ícone. */
const barButton = (b: B, name: string, cls = '') => b.row(`ms-bb ${cls}`.trim(), [b.icon(name)])

const topBar = (b: B) => {
  const left = b.row('ms-tl', [
    b.row('ms-logo-btn', [b.row('ms-logo', [b.icon('se')]), b.icon('chevDown', 'ms-ic14 ms-ic-g400')]),
    b.container({ css_classes: 'ms-vr ms-hide-m' }),
    barButton(b, 'plus', 'ms-hide-m'),
    barButton(b, 'undo', 'ms-hide-m'),
    barButton(b, 'redo', 'is-off ms-hide-m'),
  ])
  const center = b.row('ms-tc', [
    b.heading(MS_DEMO.project, ui(13, 600), C.g900, 'ms-nowrap'),
    b.heading('·', ui(13, 400), C.g300, 'ms-hide-s'),
    b.heading(MS_DEMO.page, ui(13, 400), C.g500, 'ms-nowrap ms-hide-s'),
    b.icon('cloud', 'ms-ic14 ms-ic-g400 ms-hide-s'),
  ])
  const right = b.row('ms-tr', [
    barButton(b, 'play', 'ms-play ms-hide-m'),
    b.row('ms-share ms-hide-t', [b.heading('Compartilhar', ui(13, 500), C.g700)]),
    b.row('ms-pub', [
      b.row('ms-pub-a', [
        b.icon('cloudUp', 'ms-ic14'),
        b.heading('Atualizar', ui(13, 600), C.ink),
        b.container({ css_classes: 'ms-ring' }),
        b.container({ css_classes: 'ms-ring2' }),
      ]),
      b.row('ms-pub-b', [b.icon('chevDown', 'ms-ic14')]),
    ]),
    b.row('ms-ava', [b.heading('S', ui(14, 500), C.muted)]),
  ])
  return b.container({ css_classes: 'ms-top', flex_direction: 'row' }, [left, center, right])
}

const tabs = (b: B, labels: string[]) =>
  b.row('ms-tabs', labels.map((label, i) => b.row(`ms-tab${i === 0 ? ' is-on' : ''}`, [b.heading(label, ui(13, 500), i === 0 ? C.g900 : C.g500)])))

const sidebar = (b: B) =>
  b.col('ms-side', [
    tabs(b, ['Páginas', 'Camadas', 'Biblioteca']),
    b.row('ms-side-head', [b.heading('Páginas', ui(11, 600), C.g900), b.row('ms-mini', [b.icon('plus', 'ms-ic14 ms-ic-g500')])]),
    b.col('ms-pages', MS_DEMO.pages.map((page, i) => {
      const on = i === 0
      const count = page.count.length > 1
        ? b.stack('ms-count', page.count.map((n, j) => b.heading(n, ui(10, 400), C.g400, j ? 'ms-count-new' : 'ms-count-old')))
        : b.heading(page.count[0], ui(10, 400), C.g400)
      return b.row(`ms-pg${on ? ' is-on' : ''}`, [
        b.icon(page.icon, `ms-ic14 ${on ? 'ms-ic-g900' : 'ms-ic-g400'}`),
        b.heading(page.name, ui(12, on ? 500 : 400), on ? C.g900 : C.g600, 'ms-nowrap'),
        b.heading(page.path, ui(11, 400), C.g400, 'ms-pg-path'),
        b.row('ms-pg-end', [b.icon('globe', 'ms-ic12 ms-ic-sky'), count]),
      ])
    })),
  ])

/** Rótulo da seção no canvas (alça com o nome): violeta selecionada, laranja quando o agente mexe. */
const sectionLabel = (b: B, cls: string, number: string, title: string, suffix?: string) =>
  b.row(`ms-lab ${cls}`, [
    b.icon('grip', 'ms-ic12 ms-lab-grip'),
    b.heading(number, ui(11, 500), C.white, 'ms-lab-n'),
    b.heading(title, ui(11, 500), C.white),
    ...(suffix ? [b.heading(suffix, ui(11, 500), C.white, 'ms-lab-suffix')] : []),
  ])

/** A barrinha de ações da seção selecionada (subir, descer, menu, código, tirar). */
const sectionTools = (b: B) =>
  b.row('ms-tools', [
    b.row('ms-tool', [b.icon('chevUp', 'ms-ic14')]),
    b.row('ms-tool', [b.icon('chevDown', 'ms-ic14')]),
    b.row('ms-tool', [b.icon('more', 'ms-ic14')]),
    b.row('ms-tool', [b.icon('code', 'ms-ic14')]),
    b.row('ms-tool', [b.icon('x', 'ms-ic14')]),
  ])

/** Seção de foto (as seções do Caramelo Pet tiradas do canvas, 960px). */
const shotSection = (b: B, file: string, ratio: string, cls = '') =>
  b.col(`ms-sec ${cls}`.trim(), [b.col('ms-sec-body', [b.image(canvasShot(file), '', `ms-shot ms-r-${ratio}`)])])

/** A abertura do Caramelo Pet em nativo, na escala das fotos (960px): é nela que o agente troca o título. */
const heroSection = (b: B) => {
  const nunito = (size: number, weight: number, line = 1.4, letter?: number): Spec => ({ size, weight, line, letter, family: 'Nunito' })
  const fredoka: Spec = { size: 40, weight: 600, line: 1.08, letter: -0.4, family: 'Fredoka' }
  const fact = (name: string, label: string) => b.row('ms-fact', [b.icon(name, 'ms-fact-i'), b.heading(label, nunito(10.5, 700, 1.3), C.navy)])
  const left = b.col('ms-hero-l', [
    b.heading('BANHO, TOSA E CRECHE · VILA MARIANA', nunito(9, 800, 1.3, 1.3), C.caramelInk, 'ms-eyebrow'),
    b.stack('ms-title', [
      b.heading(MS_DEMO.titleOld, fredoka, C.navy, 'ms-title-old', { header_size: 'h1' }),
      b.heading(MS_DEMO.titleNew, fredoka, C.navy, 'ms-title-new', { header_size: 'h1' }),
    ]),
    b.text('Banho e tosa com hora marcada, creche com piscina e uma loja com tudo o que ele come e gosta. A gente busca e leva no bairro.', nunito(13.5, 400, 1.55), C.petBody, 'ms-hero-lede'),
    b.row('ms-hbtns', [
      b.row('ms-hb ms-hb-fill', [b.icon('whatsapp', 'ms-hb-i'), b.heading('Agendar pelo WhatsApp', nunito(12, 800, 1), C.navy)]),
      b.row('ms-hb ms-hb-line', [b.heading('Ver serviços', nunito(12, 800, 1), C.navy)]),
    ]),
    b.row('ms-facts', [fact('car', 'Leva e traz grátis até 3 km'), fact('camera', 'Foto do antes e depois'), fact('leaf', 'Produtos hipoalergênicos')]),
  ])
  const right = b.col('ms-hero-r', [
    b.col('ms-photo', [b.image(asset('/sections/c25/businesses/pet-daycare.webp'), 'Cachorro pulando na piscina da creche', 'ms-photo-img')]),
    b.row('ms-hchip', [
      b.row('ms-hchip-i', [b.icon('waves', 'ms-ic16 ms-ic-navy')]),
      b.col('ms-hchip-t', [b.heading('Creche com piscina', nunito(12, 800, 1.3), C.navy), b.heading('Segunda a sábado, com monitores', nunito(10, 400, 1.3), C.petBody)]),
    ]),
  ])
  return b.col('ms-sec ms-sec-hero', [
    b.row('ms-sec-body ms-hero', [left, right]),
    b.container({ css_classes: 'ms-scan' }),
    b.container({ css_classes: 'ms-out ms-out-v' }),
    b.container({ css_classes: 'ms-out ms-out-a' }),
    sectionLabel(b, 'ms-lab-v', '2', 'Abertura'),
    sectionLabel(b, 'ms-lab-a', '2', 'Abertura', '· Claude Code mudou'),
    sectionTools(b),
  ])
}

/** A seção que o agente cria: entra em esqueleto borrado e revela. */
const newSection = (b: B) =>
  b.col('ms-sec ms-sec-new', [
    b.col('ms-sec-body', [b.image(canvasShot('pet-05-clube-do-banho.webp'), '', 'ms-shot ms-r-614')]),
    b.container({ css_classes: 'ms-scan' }),
    b.container({ css_classes: 'ms-out ms-out-a' }),
    sectionLabel(b, 'ms-lab-a', '4', 'Clube do Banho', '· Claude Code criou'),
  ])

const pageBar = (b: B) =>
  b.row('ms-pbar', [
    b.icon('grip', 'ms-ic14 ms-ic-violet4'),
    b.heading(MS_DEMO.page, ui(12, 600), '#2E1065', 'ms-nowrap'),
    b.stack('ms-dims ms-hide-s', MS_DEMO.dims.map((d, i) => b.heading(d, ui(12, 400), '#7C3AED', i ? 'ms-dims-new' : 'ms-dims-old'))),
    b.row('ms-building', [b.container({ css_classes: 'ms-building-dot' }), b.heading('Claude Code construindo', ui(11, 500), C.agentInk)]),
    b.row('ms-pbar-end', [
      b.row('ms-mini ms-globe', [b.icon('globe', 'ms-ic14 ms-ic-sky')]),
      b.row('ms-mini', [b.icon('play', 'ms-ic14 ms-ic-violet7')]),
      b.row('ms-mini', [b.icon('more', 'ms-ic16 ms-ic-g500')]),
    ]),
  ])

const dock = (b: B) =>
  b.row('ms-dock', [
    b.row('ms-db is-dark', [b.icon('pointer', 'ms-ic16')]),
    b.row('ms-db', [b.icon('hand', 'ms-ic16')]),
    b.container({ css_classes: 'ms-dvr' }),
    b.row('ms-db is-soft', [b.icon('monitor', 'ms-ic16')]),
    b.row('ms-db', [b.icon('tablet', 'ms-ic16')]),
    b.row('ms-db', [b.icon('phone', 'ms-ic16')]),
    b.container({ css_classes: 'ms-dvr ms-hide-s' }),
    b.row('ms-zoomsel ms-hide-s', [
      ...[['d', '39%'], ['l', '33%'], ['t', '28%']].map(([k, v]) => b.heading(v, ui(12, 500), C.g700, `ms-zv ms-zv-${k}`)),
      b.icon('chevDown', 'ms-ic14 ms-ic-g400'),
    ]),
  ])

const canvas = (b: B) =>
  b.col('ms-canvas', [
    b.col('ms-world', [
      pageBar(b),
      b.col('ms-sheet', [
        shotSection(b, 'pet-01-cabecalho.webp', '56'),
        heroSection(b),
        shotSection(b, 'pet-03-servicos.webp', '650'),
        newSection(b),
        shotSection(b, 'pet-04-como-funciona.webp', '454'),
        shotSection(b, 'pet-06-loja.webp', '370'),
        shotSection(b, 'pet-07-depoimentos.webp', '446'),
      ]),
    ]),
    dock(b),
  ])

// ---------- a aba Agente ----------

/** Um passo do agente: ícone, texto e o estado (girando ou feito). */
const step = (b: B, s: { icon: string; text: string }) =>
  b.row('ms-st', [
    b.icon(s.icon, 'ms-ic12 ms-ic-g400'),
    b.heading(s.text, ui(12, 400, 1.83), C.g600, 'ms-st-t'),
    b.stack('ms-st-state', [b.icon('loader', 'ms-ic12 ms-ic-g400 ms-spin'), b.icon('check', 'ms-ic12 ms-ic-ok ms-st-ok')]),
  ])

const agentMessage = (b: B, cls: string, time: string, steps: Array<{ icon: string; text: string }>, reply: string, usage: string) =>
  b.col(`ms-a ${cls}`, [
    b.row('ms-a-head', [
      b.container({ css_classes: 'ms-a-dot' }),
      b.heading('Claude Code', ui(12, 600), C.g900),
      b.heading(time, ui(10, 400), C.g400, 'ms-tnum'),
    ]),
    b.col('ms-steps', steps.map((s) => step(b, s))),
    b.heading('Pensando', ui(12, 500), C.g400, 'ms-think ms-think-a ms-shimmer'),
    b.heading('Trabalhando', ui(12, 500), C.g400, 'ms-think ms-think-b ms-shimmer'),
    b.text(reply, ui(13, 400, 1.625), C.g800, 'ms-reply'),
    b.heading(usage, ui(10, 400), C.g400, 'ms-usage ms-tnum'),
  ])

const userMessage = (b: B, cls: string, ctx: { icon: string; text: string; sub: string }, message: string) =>
  b.col(`ms-u ${cls}`, [
    b.row('ms-u-ctx', [
      b.icon(ctx.icon, 'ms-ic12 ms-ic-g500'),
      b.heading(ctx.text, ui(11, 400), C.g500, 'ms-nowrap'),
      ...(ctx.sub ? [b.heading(ctx.sub, ui(11, 400), C.g400, 'ms-nowrap')] : []),
      b.heading('→ Claude Code', ui(11, 400), C.g400, 'ms-nowrap'),
    ]),
    b.row('ms-bubble', [b.heading(message, ui(13, 400, 1.625), C.g900, 'ms-wrap')]),
  ])

const emptyState = (b: B) =>
  b.col('ms-empty', [
    b.text('Peça ao <strong>Claude Code</strong> ou ao <strong>Codex</strong>. Selecione uma seção ou uma camada no canvas: o agente trabalha só ali, e você vê o cursor dele.', ui(13, 400, 1.625), C.g600, 'ms-empty-p'),
    b.heading('SKILLS', ui(10, 600, 1.4), C.g400, 'ms-empty-k'),
    b.container({ css_classes: 'ms-skills' }, [
      ['palette', 'Web designer'], ['type', 'Copywriter'], ['search', 'SEO'], ['target', 'Conversão'],
    ].map(([name, label]) => b.row('ms-skill', [b.icon(name, 'ms-ic14 ms-ic-g500'), b.heading(label, ui(12, 400), C.g700, 'ms-nowrap')]))),
  ])

const composer = (b: B) =>
  b.col('ms-comp', [
    b.row('ms-comp-top', [
      b.stack('ms-ctx', [
        b.row('ms-chip ms-chip-page', [b.icon('file', 'ms-ic12'), b.heading('Página Home', ui(11, 500), C.g600, 'ms-nowrap')]),
        b.row('ms-chip ms-chip-sec', [
          b.icon('section', 'ms-ic12'),
          b.heading('Abertura', ui(11, 500), '#5B21B6', 'ms-nowrap'),
          b.heading('· Home', ui(11, 400), '#5B21B6', 'ms-nowrap ms-o6'),
          b.icon('x', 'ms-ic12 ms-o6'),
        ]),
      ]),
    ]),
    b.stack('ms-field', [
      b.heading('Peça ao Claude Code…', ui(13, 400, 1.625), C.g400, 'ms-ph ms-ph-page'),
      b.heading('O que mudar aqui?', ui(13, 400, 1.625), C.g400, 'ms-ph ms-ph-sec'),
      b.heading('Claude Code está trabalhando…', ui(13, 400, 1.625), C.g400, 'ms-ph ms-ph-busy'),
      b.heading(MS_DEMO.ask, ui(13, 400, 1.625), C.g900, 'ms-draft ms-draft-1'),
      b.heading(MS_DEMO.approve, ui(13, 400, 1.625), C.g900, 'ms-draft ms-draft-2'),
    ]),
    b.row('ms-comp-row', [
      b.row('ms-agents', [
        b.row('ms-agent is-on', [b.container({ css_classes: 'ms-adot ms-adot-claude' }), b.heading('Claude Code', ui(11, 500), C.g900, 'ms-nowrap')]),
        b.row('ms-agent', [b.container({ css_classes: 'ms-adot ms-adot-codex' }), b.heading('Codex', ui(11, 500), C.g500, 'ms-nowrap')]),
      ]),
      b.container({ css_classes: 'ms-fill' }),
      b.row('ms-cb', [b.icon('imagePlus', 'ms-ic16')]),
      b.row('ms-cb', [b.icon('wand', 'ms-ic16')]),
      b.stack('ms-send', [
        b.row('ms-send-off', [b.icon('arrowUp', 'ms-ic16')]),
        b.row('ms-send-on', [b.icon('arrowUp', 'ms-ic16')]),
        b.row('ms-send-stop', [b.icon('square', 'ms-ic12')]),
      ]),
    ]),
  ])

const inspector = (b: B) =>
  b.col('ms-insp', [
    tabs(b, ['Agente', 'Estilo']),
    b.col('ms-chat', [
      b.row('ms-cbar', [
        b.row('ms-hist', [b.icon('history', 'ms-ic14'), b.heading('3', ui(11, 500), C.g500)]),
        b.col('ms-cbar-mid', [
          b.stack('ms-cbar-t', [b.heading('Conversa nova', ui(12, 500), C.g900, 'ms-ell ms-ct-0'), b.heading(MS_DEMO.ask, ui(12, 500), C.g900, 'ms-ell ms-ct-1')]),
          b.stack('ms-cbar-s', MS_DEMO.summary.map((s, i) => b.heading(s, ui(10, 400), C.g400, `ms-ell ms-cs-${i}${i === 1 ? ' ms-dots' : ''}`))),
        ]),
        b.row('ms-new', [b.icon('plus', 'ms-ic14'), b.heading('Nova', ui(11, 500), C.g600)]),
      ]),
      b.col('ms-msgs', [
        b.col('ms-msgs-in', [
          emptyState(b),
          userMessage(b, 'ms-u1', { icon: 'section', text: 'Abertura', sub: '· Home', }, MS_DEMO.ask),
          agentMessage(b, 'ms-a1', '14:32', MS_DEMO.steps, MS_DEMO.reply, MS_DEMO.usage[0]),
          userMessage(b, 'ms-u2', { icon: 'file', text: 'Página Home', sub: '' }, MS_DEMO.approve),
          agentMessage(b, 'ms-a2', '14:34', [MS_DEMO.publishStep], MS_DEMO.published, MS_DEMO.usage[1]),
        ]),
      ]),
      composer(b),
    ]),
  ])

// ---------- publicar no WordPress (WordPressPublishDialog) ----------

const dlgButton = (b: B, label: string, tone: 'ghost' | 'outline' | 'primary', cls = '', ext = false) =>
  b.row(`ms-btn ms-btn-${tone} ${cls}`.trim(), [b.heading(label, ui(14, 500, 1.43), C.ink), ...(ext ? [b.icon('ext', 'ms-ic16')] : [])])

const dialog = (b: B) => {
  const form = b.col('ms-dlg-form', [
    b.col('ms-linked', [
      b.row('ms-linked-top', [b.heading(MS_DEMO.page, ui(14, 500, 1.43), C.g900), b.row('ms-pill', [b.heading('Publicada', ui(11, 500, 1.4), C.g700)])]),
      b.heading('Sincronizada em 06/10/2026, 18:40', ui(12, 400, 1.33), C.muted),
    ]),
    b.row('ms-details', [
      b.col('ms-details-thumb', [b.image(canvasShot('pet-02-hero.webp'), '', 'ms-details-img')]),
      b.col('ms-details-t', [
        b.heading(MS_DEMO.page, ui(14, 500, 1.43), C.g900, 'ms-ell'),
        b.heading(`${MS_DEMO.site}/home`, ui(12, 400, 1.33), C.muted, 'ms-ell'),
        b.heading('SEO: Banho e tosa na Vila Mariana', ui(12, 400, 1.33), C.muted, 'ms-ell'),
      ]),
      b.row('ms-btn ms-btn-outline ms-btn-sm', [b.heading('Editar detalhes', ui(12, 500, 1.33), C.ink)]),
    ]),
    b.heading('10 seções vão substituir o conteúdo da página no site. 1 imagem nova vai para a biblioteca de mídia do site.', ui(12, 400, 1.33), C.muted, 'ms-wrap'),
    b.row('ms-links', [b.heading('Desfazer a última atualização', ui(12, 400, 1.33), C.muted, 'ms-u-line'), b.heading('Desligar do WordPress', ui(12, 400, 1.33), C.muted, 'ms-u-line')]),
  ])
  const work = b.row('ms-dlg-work', [
    b.icon('loader', 'ms-ic16 ms-ic-g700 ms-spin'),
    b.stack('ms-work-steps', MS_DEMO.publishing.map((s, i) => b.heading(s, ui(14, 400, 1.43), C.g700, `ms-ws ms-ws-${i}`))),
  ])
  const done = b.col('ms-dlg-done', [
    b.row('ms-done-line', [b.icon('checkCircle', 'ms-ic16 ms-ic-ok'), b.heading('Página atualizada no site, publicada. 1 imagem foi para a biblioteca de mídia.', ui(14, 400, 1.43), C.g900, 'ms-wrap')]),
    b.heading('Layout: Tela do Elementor, sem o cabeçalho, o título e o rodapé do tema.', ui(12, 400, 1.33), C.muted, 'ms-wrap'),
  ])
  return b.col('ms-dlg', [
    b.row('ms-dlg-x', [b.icon('x', 'ms-ic16')]),
    b.col('ms-dlg-head', [
      b.stack('ms-dlg-title', [
        b.heading('Atualizar no WordPress', ui(18, 600, 1), C.ink, 'ms-dt-0'),
        b.heading('Página atualizada no WordPress', ui(18, 600, 1), C.ink, 'ms-dt-1'),
      ]),
      b.stack('ms-dlg-desc', [
        b.heading(`A página ${MS_DEMO.page} do canvas vai para ${MS_DEMO.siteName}, no mesmo endereço.`, ui(14, 400, 1.43), C.muted, 'ms-wrap ms-dd-0'),
        b.heading(`${MS_DEMO.page} em ${MS_DEMO.siteName}.`, ui(14, 400, 1.43), C.muted, 'ms-wrap ms-dd-1'),
      ]),
    ]),
    b.col('ms-dlg-body', [form, work, done]),
    b.col('ms-dlg-foot', [
      b.row('ms-foot ms-foot-form', [dlgButton(b, 'Cancelar', 'ghost'), dlgButton(b, 'Atualizar no site', 'primary', 'ms-confirm')]),
      b.row('ms-foot ms-foot-done', [
        dlgButton(b, 'Fechar', 'ghost', 'ms-close'),
        dlgButton(b, 'Editar no Elementor', 'outline', 'ms-hide-s', true),
        dlgButton(b, 'Ver no site', 'primary', '', true),
      ]),
    ]),
  ])
}

/** O cursor do agente (AgentCursors): a seta laranja, o nome e o que ele está fazendo. */
const agentCursor = (b: B) =>
  b.container({ css_classes: 'ms-cur' }, [
    b.container({ css_classes: 'ms-click' }),
    b.container({ css_classes: 'ms-cur-arrow' }),
    b.col('ms-cur-tag', [
      b.row('ms-cur-name', [b.heading('Claude Code', ui(12, 600, 1), C.white)]),
      b.stack('ms-cur-tips', MS_DEMO.tips.map((tip, i) => b.row(`ms-tip ms-tip-${i}`, [b.heading(tip, ui(11, 500, 1.2), C.g700, 'ms-dots ms-nowrap')]))),
    ]),
  ])

// ---------- CSS ----------

const hidden = 'visibility:hidden;opacity:0'

const BASE_CSS = [
  'selector{overflow:clip;scroll-margin-top:72px}',
  'selector,selector *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
  'selector ::selection{background:#FFE84C;color:#222222}',
  'selector .elementor-heading-title{margin:0;padding:0}',
  'selector .elementor-widget-text-editor p{margin:0}',
  'selector .elementor-widget-image{line-height:0}selector .elementor-widget-image img{display:block}',
  // o Elementor anima o transform dos containers (0,4s): aqui quem move é o script
  'selector,selector .e-con{transition-property:background,border,box-shadow}',
  '@media(prefers-reduced-motion:reduce){selector *{transition:none!important;animation:none!important}}',
  'selector .ms-behavior{position:absolute;width:0;height:0;overflow:hidden}',
  // o título e o texto da seção (desenho da página modelo)
  'selector .sx-simple-h{width:100%}selector .sx-simple-h .elementor-heading-title{margin:0;font-size:clamp(40px,6.25vw,90px)}',
  'selector .sx-simple-lede{width:100%;max-width:780px;margin-top:24px}selector .sx-simple-lede p{margin:0;font-size:clamp(17px,1.66vw,24px)}',
  '@media(max-width:767px){selector h2.elementor-heading-title br{display:none}}',
  'selector>.e-con-inner{position:relative;z-index:1}',
].join('')

const APP_CSS = [
  // janela
  'selector .ms-stage{position:relative}',
  'selector .ms-app{--z:.5833;--sw:560px;--ms-h:clamp(500px,calc(100vh - 230px),620px);position:relative;overflow:hidden;border-radius:20px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 40px 100px -40px rgba(0,0,0,.28);isolation:isolate;text-align:left;font-family:Inter,sans-serif}',
  'selector .ms-app .e-con{flex-wrap:nowrap;min-width:0}',
  'selector .ms-app .elementor-widget-heading,selector .ms-app .elementor-widget-text-editor{flex:none;width:auto;max-width:100%}',
  'selector .ms-app .elementor-heading-title{white-space:nowrap}',
  'selector .ms-app .ms-wrap{flex:0 1 auto!important;min-width:0}selector .ms-app .ms-wrap .elementor-heading-title{white-space:normal}',
  'selector .ms-ell{min-width:0;flex:1 1 auto!important}selector .ms-ell .elementor-heading-title{overflow:hidden;text-overflow:ellipsis}',
  'selector .ms-tnum .elementor-heading-title{font-variant-numeric:tabular-nums}',
  'selector .ms-o6{opacity:.6}',
  'selector .ms-stack{display:grid!important;grid-template-columns:minmax(0,1fr)}selector .ms-stack>*{grid-area:1/1;min-width:0}',
  'selector .ms-cam{position:relative;transform-origin:0 0}',
  // ícones
  'selector .ms-i{width:16px!important;height:16px}',
  'selector .ms-ic12{width:12px!important;height:12px}selector .ms-ic14{width:14px!important;height:14px}selector .ms-ic16{width:16px!important;height:16px}',
  `selector .ms-ic-g400{--ic:${C.g400}}selector .ms-ic-g500{--ic:${C.g500}}selector .ms-ic-g700{--ic:${C.g700}}selector .ms-ic-g900{--ic:${C.g900}}selector .ms-ic-sky{--ic:${C.sky}}selector .ms-ic-ok{--ic:${C.emerald}}selector .ms-ic-navy{--ic:${C.navy}}selector .ms-ic-violet4{--ic:#A78BFA}selector .ms-ic-violet7{--ic:#6D28D9}`,
  '@keyframes ms-spin{to{transform:rotate(360deg)}}selector .ms-spin{animation:ms-spin 1s linear infinite}',
  // barra de cima
  `selector .ms-top{display:grid!important;grid-template-columns:1fr auto 1fr;align-items:center;column-gap:12px;height:48px;padding:0 8px;background:#fff;border-bottom:1px solid ${C.g200};position:relative;z-index:3}`,
  'selector .ms-tl{gap:2px;width:auto!important}',
  'selector .ms-logo-btn{height:32px;gap:4px;padding:0 6px 0 4px;border-radius:8px;width:auto!important}',
  `selector .ms-logo{width:28px!important;height:28px;flex:none;border-radius:3.6px;background:${'#D2F525'};justify-content:center}selector .ms-logo .ms-i{width:28px!important;height:28px;--ic:#282828}`,
  `selector .ms-vr{width:1px!important;height:20px;flex:none;background:${C.g200};margin:0 4px}`,
  `selector .ms-bb{width:32px!important;height:32px;flex:none;border-radius:8px;justify-content:center;--ic:${C.g600}}selector .ms-bb.is-off{opacity:.35}`,
  'selector .ms-tc{gap:8px;justify-content:center;width:auto!important}',
  'selector .ms-tr{gap:6px;justify-content:flex-end;width:auto!important;justify-self:end}',
  'selector .ms-share{height:32px;padding:0 10px;border-radius:8px;width:auto!important}',
  'selector .ms-pub{width:auto!important;flex:none}',
  `selector .ms-pub-a{position:relative;overflow:visible;height:32px;gap:6px;padding:0 10px 0 12px;border-radius:8px 0 0 8px;background:${C.primary};--ic:${C.ink};width:auto!important}`,
  `selector .ms-pub-b{width:28px!important;height:32px;justify-content:center;border-radius:0 8px 8px 0;border-left:1px solid rgba(0,0,0,.1);background:${C.primary};--ic:${C.ink}}`,
  `selector .ms-ring,selector .ms-ring2{position:absolute!important;pointer-events:none;border:2px solid ${C.primary};${hidden}}selector .ms-ring{inset:-6px -34px -6px -6px;border-radius:13px}selector .ms-ring2{inset:-3px -31px -3px -3px;border-radius:11px}`,
  `selector .ms-ava{width:32px!important;height:32px;flex:none;margin-left:4px;border-radius:999px;justify-content:center;background:#F4F4F5}`,
  // corpo
  'selector .ms-body{display:flex!important;flex-direction:row;height:var(--ms-h)}',
  `selector .ms-side{width:264px!important;flex:none!important;background:#fff;border-right:1px solid ${C.g200};position:relative;z-index:2}`,
  'selector .ms-tabs{gap:2px;padding:8px 8px 4px;flex:none}',
  'selector .ms-tab{height:32px;padding:0 10px;border-radius:8px;width:auto!important}selector .ms-tab.is-on{background:#F3F4F6}',
  'selector .ms-side-head{justify-content:space-between;padding:4px 12px}',
  'selector .ms-mini{width:24px!important;height:24px;flex:none;border-radius:6px;justify-content:center}',
  'selector .ms-pages{gap:2px;padding:0 8px 12px}',
  'selector .ms-pg{height:32px;gap:8px;padding:0 8px;border-radius:8px}selector .ms-pg.is-on{background:#F3F4F6}',
  'selector .ms-pg-path{flex:0 1 auto!important;min-width:0}selector .ms-pg-path .elementor-heading-title{overflow:hidden;text-overflow:ellipsis}',
  'selector .ms-pg-end{margin-left:auto;gap:6px;width:auto!important;flex:none}',
  'selector .ms-count{justify-items:end}',
  // canvas
  `selector .ms-canvas{position:relative;flex:1 1 auto!important;overflow:hidden;background-color:#F4F4F5;background-image:radial-gradient(circle,#D4D4D8 1px,transparent 1.4px);background-size:20px 20px;background-position:10px 10px}`,
  'selector .ms-world{position:absolute!important;left:0;right:0;top:0;align-items:center;gap:8px;padding-top:44px}',
  `selector .ms-pbar{width:var(--sw)!important;height:34px;flex:none;gap:6px;padding:0 4px;border-radius:8px;background:${C.violet50};box-shadow:0 0 0 1px rgba(139,92,246,.45)}`,
  'selector .ms-dims{min-width:0;flex:0 1 auto!important}',
  'selector .ms-building{display:none;gap:4px;height:20px;padding:0 6px;border-radius:999px;background:rgba(217,119,87,.1);width:auto!important;flex:none}',
  `selector .ms-building-dot{width:6px!important;height:6px;flex:none;border-radius:999px;background:${C.agent}}`,
  '@keyframes ms-pulse{50%{opacity:.35}}@media(prefers-reduced-motion:no-preference){selector .ms-building-dot{animation:ms-pulse 1.4s ease-in-out infinite}}',
  'selector .ms-pbar-end{margin-left:auto;gap:4px;width:auto!important;flex:none}',
  'selector .ms-sheet{width:960px!important;flex:none;zoom:var(--z);background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.05)}',
  'selector .ms-sec{position:relative;flex:none}selector .ms-sec-body{position:relative}',
  'selector .ms-shot img{width:960px!important;max-width:none!important;height:auto}',
  ...['56', '650', '614', '454', '370', '446'].map((h) => `selector .ms-r-${h} img{aspect-ratio:960/${h}}`),
  'selector .ms-sec-new{overflow:hidden}',
  `selector .ms-out{position:absolute!important;inset:0;pointer-events:none;z-index:5}selector .ms-out-v{box-shadow:inset 0 0 0 calc(2px / var(--z)) ${C.violet}}selector .ms-out-a{box-shadow:inset 0 0 0 calc(1.5px / var(--z)) ${C.agent}}`,
  'selector .ms-lab{position:absolute!important;left:0;top:0;z-index:6;zoom:calc(1 / var(--z));width:auto!important;gap:4px;padding:2px 8px 2px 4px;border-radius:0 0 6px 0;--ic:#fff}',
  `selector .ms-lab-v{background:${C.violet}}selector .ms-lab-a{background:${C.agent}}selector .ms-lab-grip,selector .ms-lab-n{opacity:.7}selector .ms-lab-suffix{opacity:.85}`,
  `selector .ms-tools{position:absolute!important;right:0;top:0;z-index:6;zoom:calc(1 / var(--z));width:auto!important;gap:2px;padding:2px;border-radius:0 0 0 6px;background:rgba(255,255,255,.95);box-shadow:0 1px 2px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.05);--ic:${C.g500}}`,
  'selector .ms-tool{width:24px!important;height:24px;justify-content:center;border-radius:4px}',
  'selector .ms-scan{position:absolute!important;inset:0;overflow:hidden;pointer-events:none;z-index:4}',
  'selector .ms-scan::after{content:"";position:absolute;left:0;right:0;top:-35%;height:35%;background:linear-gradient(180deg,transparent,rgba(217,119,87,.18),transparent);animation:ms-scan 1.8s ease-in-out infinite}',
  '@keyframes ms-scan{to{transform:translateY(400%)}}',
  // fim da história no CSS: o agente mudou a abertura e criou o clube; a seleção e a varredura somem
  `selector .ms-out-v,selector .ms-lab-v,selector .ms-tools,selector .ms-scan,selector .ms-dims-old,selector .ms-count-old{${hidden}}`,
  // a abertura do Caramelo Pet (escala 960)
  `selector .ms-hero{height:546px;padding:0 80px;background:${C.cream};justify-content:space-between;gap:40px;overflow:hidden}`,
  'selector .ms-hero-l{width:380px!important;flex:none!important}',
  'selector .ms-eyebrow{margin-bottom:14px}',
  'selector .ms-title{margin-bottom:16px}selector .ms-title .elementor-heading-title{white-space:normal}',
  'selector .ms-title-old{' + hidden + '}',
  'selector .ms-hl{background:linear-gradient(transparent 58%,rgba(242,153,74,.42) 58%,rgba(242,153,74,.42) 94%,transparent 94%);padding:0 .04em}',
  'selector .ms-hero-lede{width:360px!important;margin-bottom:22px}',
  'selector .ms-hbtns{gap:8px}',
  'selector .ms-hb{height:34px;gap:6px;padding:0 20px;border-radius:999px;width:auto!important;flex:none}',
  `selector .ms-hb-fill{background:${C.caramel}}selector .ms-hb-line{box-shadow:inset 0 0 0 1.5px ${C.navy}}selector .ms-hb-i{width:13px!important;height:13px;--ic:${C.navy}}`,
  'selector .ms-facts{flex-wrap:wrap!important;gap:6px 14px;margin-top:18px}',
  `selector .ms-fact{gap:5px;width:auto!important}selector .ms-fact-i{width:11px!important;height:11px;--ic:#E5832C}`,
  'selector .ms-hero-r{width:360px!important;height:450px;flex:none!important;position:relative}',
  'selector .ms-photo{width:100%!important;height:100%;border-radius:18px;overflow:hidden}',
  'selector .ms-photo-img,selector .ms-photo-img .elementor-widget-container{width:100%!important;height:100%}selector .ms-photo-img img{width:100%;height:100%;object-fit:cover}',
  'selector .ms-hchip{position:absolute!important;left:-16px;bottom:22px;width:auto!important;gap:10px;padding:8px 14px 8px 8px;border-radius:10px;background:#fff;box-shadow:0 8px 24px -10px rgba(31,42,68,.35)}',
  `selector .ms-hchip-i{width:30px!important;height:30px;flex:none;border-radius:8px;justify-content:center;background:${C.pool}}`,
  'selector .ms-hchip-t{gap:1px;width:auto!important}',
  // doca do canvas
  `selector .ms-dock{position:absolute!important;left:50%;bottom:12px;transform:translateX(-50%);width:auto!important;gap:2px;padding:4px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px rgb(0 0 0/.06),0 1px 2px -1px rgb(0 0 0/.08),0 4px 12px -2px rgb(0 0 0/.08);z-index:7;--ic:${C.g600}}`,
  `selector .ms-db{width:32px!important;height:32px;flex:none;border-radius:8px;justify-content:center}selector .ms-db.is-dark{background:${C.g900};--ic:#fff}selector .ms-db.is-soft{background:${C.g100};--ic:${C.g900}}`,
  `selector .ms-dvr{width:1px!important;height:20px;flex:none;background:${C.g200};margin:0 4px}`,
  'selector .ms-zoomsel{height:32px;gap:4px;padding:0 8px;width:auto!important}selector .ms-zv-l,selector .ms-zv-t{display:none}',
  '@media(max-width:1304px) and (min-width:1181px){selector .ms-zv-d{display:none}selector .ms-zv-l{display:block}}',
  '@media(max-width:1024px){selector .ms-zv-d{display:none}selector .ms-zv-t{display:block}}',
  // aba Agente
  `selector .ms-insp{width:320px!important;flex:none!important;background:#fff;border-left:1px solid ${C.g200};position:relative;z-index:2}`,
  `selector .ms-chat{flex:1 1 auto!important;min-height:0;border-top:1px solid ${C.g100}}`,
  `selector .ms-cbar{height:40px;flex:none;gap:4px;padding:0 6px;border-bottom:1px solid ${C.g100}}`,
  `selector .ms-hist{height:28px;gap:4px;padding:0 6px;border-radius:8px;width:auto!important;flex:none;--ic:${C.g500}}`,
  'selector .ms-cbar-mid{flex:1 1 auto!important;min-width:0;padding:0 4px}selector .ms-cbar-mid .ms-stack{width:100%}',
  `selector .ms-new{height:28px;gap:4px;padding:0 8px;border-radius:8px;width:auto!important;flex:none;--ic:${C.g600}}`,
  'selector .ms-msgs{flex:1 1 auto!important;min-height:0;overflow:hidden;justify-content:flex-end}',
  'selector .ms-msgs-in{min-height:100%;flex:none;gap:16px;padding:12px}',
  'selector .ms-empty{gap:10px}selector .ms-empty-p strong{font-weight:600;color:#111827}selector .ms-empty-k{margin-top:2px}selector .ms-empty-k .elementor-heading-title{letter-spacing:.05em}',
  'selector .ms-skills{display:grid!important;grid-template-columns:1fr 1fr;gap:4px}',
  `selector .ms-skill{gap:6px;padding:6px 8px;border:1px solid ${C.g200};border-radius:8px}`,
  'selector .ms-u{align-items:flex-end;gap:4px;padding-left:24px}',
  'selector .ms-u-ctx{gap:4px;width:auto!important;max-width:100%}',
  `selector .ms-bubble{width:auto!important;max-width:100%;padding:8px 12px;border-radius:16px 16px 6px 16px;background:${C.g100}}`,
  'selector .ms-a{gap:8px}',
  'selector .ms-a-head{gap:6px;width:auto!important}',
  `selector .ms-a-dot{width:6px!important;height:6px;flex:none;border-radius:999px;background:${C.agent}}`,
  'selector .ms-steps{padding-left:6px;border-left:2px solid rgba(217,119,87,.25)}',
  'selector .ms-st{height:22px;gap:6px;padding:0 4px}selector .ms-st-t{flex:1 1 auto!important;min-width:0}selector .ms-st-t .elementor-heading-title{overflow:hidden;text-overflow:ellipsis}',
  'selector .ms-st-state{width:12px!important;flex:none}selector .ms-st-state .ms-spin{' + hidden + '}',
  'selector .ms-reply strong{font-weight:600;color:#111827}',
  'selector .ms-think,selector .ms-empty{display:none}',
  'selector .ms-shimmer .elementor-heading-title{color:transparent!important;background:linear-gradient(90deg,#9CA3AF 0%,#9CA3AF 35%,#111827 50%,#9CA3AF 65%,#9CA3AF 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;animation:ms-shimmer 1.8s linear infinite}',
  '@keyframes ms-shimmer{from{background-position:100% 0}to{background-position:-50% 0}}',
  // o caixa de mensagem
  `selector .ms-comp{flex:none;margin:8px;border:1px solid ${C.g200};border-radius:12px;background:#fff;width:auto!important}`,
  'selector .ms-comp-top{gap:6px;padding:8px 8px 0}',
  'selector .ms-ctx{width:auto!important;max-width:100%;justify-items:start}',
  `selector .ms-chip{gap:6px;padding:4px 8px;border-radius:8px;width:auto!important;border:1px solid ${C.g200};background:${C.g50};--ic:${C.g600}}`,
  'selector .ms-chip-sec{border-color:#DDD6FE;background:#F5F3FF;--ic:#5B21B6}',
  `selector .ms-chip-sec,selector .ms-ph-sec,selector .ms-ph-busy,selector .ms-draft,selector .ms-send-on,selector .ms-send-stop,selector .ms-ct-0,selector .ms-cs-0,selector .ms-cs-1,selector .ms-cs-2{${hidden}}`,
  'selector .ms-field{padding:8px 12px 4px;min-height:54px;align-content:start}selector .ms-field .elementor-heading-title{white-space:normal}',
  'selector .ms-comp-row{gap:4px;padding:0 8px 8px}',
  `selector .ms-agents{gap:2px;padding:2px;border-radius:8px;background:${C.g100};width:auto!important;flex:none}`,
  'selector .ms-agent{height:24px;gap:6px;padding:0 8px;border-radius:6px;width:auto!important}',
  'selector .ms-agent.is-on{background:#fff;box-shadow:0 0 0 1px rgb(0 0 0/.06),0 1px 2px rgb(0 0 0/.08)}',
  `selector .ms-adot{width:6px!important;height:6px;flex:none;border-radius:999px}selector .ms-adot-claude{background:${C.agent}}selector .ms-adot-codex{background:#0A0A0A}`,
  'selector .ms-fill{flex:1 1 auto!important;min-width:0}',
  `selector .ms-cb{width:28px!important;height:28px;flex:none;border-radius:8px;justify-content:center;--ic:${C.g500}}`,
  'selector .ms-send{width:28px!important;flex:none}',
  `selector .ms-send>*{width:28px!important;height:28px;border-radius:999px;justify-content:center}selector .ms-send-off{background:${C.g200};--ic:${C.g400}}selector .ms-send-on{background:${C.agent};--ic:#fff}selector .ms-send-stop{background:${C.g900};--ic:#fff}`,
  // diálogo de publicar (por cima da janela inteira, como o Dialog do app)
  `selector .ms-shade{position:absolute!important;inset:0;z-index:20;background:rgba(0,0,0,.72);${hidden}}`,
  `selector .ms-dlg{position:absolute!important;inset:0;margin:auto;height:max-content;width:min(512px,calc(100% - 32px))!important;z-index:21;gap:16px;padding:24px;border:1px solid #E4E4E7;border-radius:8px;background:#fff;box-shadow:0 10px 15px -3px rgb(0 0 0/.1),0 4px 6px -4px rgb(0 0 0/.1);${hidden}}`,
  `selector .ms-dlg-x{position:absolute!important;right:16px;top:16px;width:16px!important;opacity:.7;--ic:${C.ink}}`,
  'selector .ms-dlg-head{gap:6px;padding-right:20px}selector .ms-dlg-title .elementor-heading-title{letter-spacing:-.025em}',
  'selector .ms-dlg-form{gap:20px}selector .ms-dlg-work,selector .ms-dlg-done{display:none}',
  `selector .ms-linked{gap:2px;padding:12px 16px;border:1px solid #E4E4E7;border-radius:8px}selector .ms-linked-top{gap:8px}`,
  `selector .ms-pill{padding:2px 8px;border-radius:999px;background:${C.g100};width:auto!important}`,
  'selector .ms-details{gap:12px;padding:12px;border:1px solid #E4E4E7;border-radius:8px}',
  'selector .ms-details-thumb{width:110px!important;height:58px;flex:none;overflow:hidden;border:1px solid #E4E4E7;border-radius:6px}selector .ms-details-img img{width:110px;height:58px;object-fit:cover;object-position:top left}',
  'selector .ms-details-t{flex:1 1 auto!important;min-width:0}selector .ms-details-t .ms-ell{width:100%}',
  'selector .ms-links{gap:12px;flex-wrap:wrap!important}selector .ms-u-line .elementor-heading-title{text-decoration:underline;text-underline-offset:2px}',
  `selector .ms-dlg-work{gap:8px;padding:24px 0;--ic:${C.g700}}`,
  'selector .ms-done-line{gap:8px;align-items:flex-start!important}selector .ms-done-line .ms-i{margin-top:2px}selector .ms-dlg-done{gap:12px}',
  'selector .ms-foot{justify-content:flex-end;gap:8px}selector .ms-foot-done{display:none}',
  `selector .ms-btn{height:40px;gap:8px;padding:0 16px;border-radius:6px;width:auto!important;flex:none;justify-content:center;--ic:${C.ink}}`,
  `selector .ms-btn-sm{height:32px;padding:0 12px;align-self:center}selector .ms-btn-outline{border:1px solid #E4E4E7;background:#fff}selector .ms-btn-primary{background:${C.primary}}`,
  `selector .ms-dt-1,selector .ms-dd-1,selector .ms-ws{${hidden}}selector .ms-ws-0{visibility:visible;opacity:1}`,
  // cursor do agente
  'selector .ms-cur{position:absolute!important;left:0;top:0;width:0!important;height:0;z-index:30;pointer-events:none;overflow:visible;' + hidden + '}',
  `selector .ms-cur-arrow{position:absolute!important;left:-3px;top:-2px;width:22px!important;height:26px;background:${AGENT_ARROW} center/contain no-repeat;filter:drop-shadow(0 1px 2px rgb(0 0 0/.3));transform-origin:3px 2px}`,
  'selector .ms-cur-tips{justify-items:start}selector .ms-cur-tag{position:absolute!important;left:15px;top:21px;width:max-content!important;align-items:flex-start;gap:4px}',
  `selector .ms-cur-name{width:auto!important;padding:5px 10px;border-radius:999px;background:${C.agent};box-shadow:0 2px 8px -2px rgb(0 0 0/.35)}`,
  'selector .ms-tip{width:auto!important;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.95);box-shadow:0 2px 8px -2px rgb(0 0 0/.2),0 0 0 1px rgb(0 0 0/.05);' + hidden + '}',
  '@keyframes ms-dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}',
  'selector .ms-dots .elementor-heading-title::after{content:"…";display:inline-block;width:1.2em;text-align:left}',
  '@media(prefers-reduced-motion:no-preference){selector .ms-dots .elementor-heading-title::after{content:"";animation:ms-dots 1.2s steps(4,end) infinite}}',
  `selector .ms-click{position:absolute!important;left:-13px;top:-13px;width:26px!important;height:26px;border:2px solid ${C.agent};border-radius:999px;opacity:0}`,
  // régua embaixo da janela (só no desktop) e a legenda do celular
  'selector .ms-hud{gap:12px}',
  'selector .ms-hud-track{position:relative;height:2px;background:rgba(0,0,0,.09)}selector .ms-hud-fill{position:absolute!important;inset:0;background:#222;transform-origin:0 50%;transform:scaleX(0)}',
  'selector .ms-hud-row{display:grid!important;grid-template-columns:repeat(4,1fr)}',
  'selector .ms-hud-step{position:relative}selector .ms-hud-lit{position:absolute!important;inset:0;' + hidden + '}',
  // aparelhos
  '@media(max-width:1304px){selector .ms-app{--z:.5;--sw:480px}}',
  '@media(max-width:1180px){selector .ms-side{display:none!important}selector .ms-app{--z:.5833;--sw:560px}}',
  '@media(max-width:1024px){selector .ms-app{--z:.42;--sw:403px}selector .ms-insp{width:290px!important}selector .ms-hide-t,selector .ms-hud{display:none!important}}',
  '@media(min-width:1025px){selector .ms-cap-m{display:none!important}}',
  '@media(max-width:767px){selector .ms-app{--z:.3;--sw:288px;border-radius:16px}selector .ms-top{grid-template-columns:auto 1fr auto}selector .ms-hide-m{display:none!important}selector .ms-body{flex-direction:column!important;height:auto}selector .ms-canvas{flex:none!important;height:320px}selector .ms-insp{width:100%!important;height:400px;border-left:0;border-top:1px solid #E5E7EB}selector .ms-dlg{padding:20px;width:calc(100% - 24px)!important}selector .ms-details-thumb{display:none!important}}',
  '@media(max-width:420px){selector .ms-app{--z:.28;--sw:269px}selector .ms-hide-s{display:none!important}}',
].join('')

// ---------- seção ----------

export const MS_SOURCE_ID = 'superelements-misto-produto'

export const buildProduto = () => {
  const b = createBuilder('ms')

  const head = b.col('ms-head ms-rise', [
    b.widget('heading', {
      title: HEAD.title, header_size: 'h2', title_color: '#000000',
      ...type({ size: 90, line: 0.9, weight: 400, letter: -2.7, family: 'Geist', tablet: { size: 64 }, mobile: { size: 40, line: 0.9, letter: -1.2 } }),
      align: 'center', _css_classes: 'sx-simple-h',
    }),
    b.widget('text-editor', {
      editor: HEAD.lede, text_color: '#5A656D',
      ...type({ size: 24, line: 1.3, weight: 400, letter: 0, family: 'Geist', tablet: { size: 17 }, mobile: { size: 16, line: 1.3, letter: -0.48 } }),
      align: 'center', _css_classes: 'sx-simple-lede',
    }),
  ], { flex_align_items: 'center' })

  const app = b.container({ css_classes: 'ms-app' }, [
    b.col('ms-cam', [topBar(b), b.row('ms-body', [sidebar(b), canvas(b), inspector(b)], { flex_align_items: 'stretch' })]),
    b.container({ css_classes: 'ms-shade' }),
    dialog(b),
    agentCursor(b),
  ])

  const hud = b.col('ms-hud', [
    b.container({ css_classes: 'ms-hud-track' }, [b.container({ css_classes: 'ms-hud-fill' })]),
    b.container({ css_classes: 'ms-hud-row' }, MS_DEMO.hud.map((label, i) => {
      const text = `[0${i + 1}] ${label}`
      const mono = (color: string, cls: string) => b.heading(text, { size: 12, line: 1.4, letter: 0.4, family: 'Space Mono' }, color, cls)
      return b.container({ css_classes: 'ms-hud-step' }, [mono('#8A8F98', 'ms-hud-base'), mono('#111111', 'ms-hud-lit')])
    })),
  ])

  const caption = b.row('ms-cap-m', [
    b.heading('O agente no seu canvas', { size: 11, line: 1.4, letter: 0.44, family: 'Space Mono' }, '#111111'),
    b.heading('pedido, mudança e publicação', { size: 11, line: 1.4, letter: 0.44, family: 'Space Mono' }, '#71717A'),
  ], { flex_wrap: 'wrap', flex_justify_content: 'center', flex_gap: gap(6, 12) })

  const stage = b.col('ms-stage', [app, hud, caption], {
    flex_gap: gap(18), _element_id: 'publicar',
    margin: { unit: 'px', top: '80', right: '0', bottom: '0', left: '0', isLinked: false },
    margin_mobile: { unit: 'px', top: '56', right: '0', bottom: '0', left: '0', isLinked: false },
  })

  const root = b.container({
    content_width: 'boxed', boxed_width: px(1240),
    flex_direction: 'column', flex_wrap: '',
    padding: { unit: 'px', top: '200', right: '32', bottom: '120', left: '32', isLinked: false },
    padding_tablet: { unit: 'px', top: '160', right: '24', bottom: '96', left: '24', isLinked: false },
    padding_mobile: { unit: 'px', top: '96', right: '16', bottom: '72', left: '16', isLinked: false },
    background_background: 'classic', background_color: '#F5F5F5',
    html_tag: 'section', _element_id: 'produto', css_classes: 'se-produto ms-produto',
  }, [b.widget('html', { html: MS_MOTION_SCRIPT, _css_classes: 'ms-behavior' }), head, stage])
  root.isInner = false
  root.settings.custom_css = BASE_CSS + msIconCss(b.icons) + APP_CSS
  return root
}
