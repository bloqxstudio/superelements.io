import type { SectionNodeData } from '@/types/space'
import type { LandingTemplate } from './landingTemplates'
import {
  BUTTON_CSS, createBuilder, DOT_CSS, FILL, FIXED, fluid, gap, link, media, pct, px, sides, T, tweak, typography,
  type ElementorNode, type TypeSpec, type ZeloBuilder,
} from '@/features/zelo/elementor'
import { ZELO as C, ZELO_CONTACT, ZELO_FONTS as F, ZELO_SHADOW, zeloAsset, zeloWhatsApp } from '@/features/zelo/tokens'

/**
 * Zelo (zelosistemas.com.br) em containers e widgets nativos do Elementor:
 * home, contato e privacidade. Cada seção do site é um SectionNodeData próprio.
 */

type JsonRecord = Record<string, unknown>

const round = { unit: '%', top: '50', right: '50', bottom: '50', left: '50', isLinked: true }
/** Medida de leitura: nunca passa da coluna (`min(100%, …)`), como o max-width em ch do site. */
const maxw = (width: number) => ({ _element_width: 'initial', _element_custom_width: fluid(`min(100%, ${width}px)`) })
const WA_SITE = zeloWhatsApp('Oi! Vim pelo site da Zelo.')
const MAILTO = `mailto:${ZELO_CONTACT.email}`

const border = (color: string = C.line, width = sides(1)) => ({ border_border: 'solid', border_width: width, border_color: color })
const card = (radius: number, color: string = C.lineStrong) => ({ background_background: 'classic', background_color: C.raised, ...border(color), border_radius: sides(radius) })
const bg = (color: string) => ({ background_background: 'classic', background_color: color })
const bgImage = (file: string) => ({
  background_background: 'classic', background_color: C.paper,
  background_image: media(zeloAsset(file)), background_position: 'center center', background_repeat: 'no-repeat', background_size: 'cover',
})
const gaps = (desktop: number, tablet: number, mobile: number) => ({ grid_gaps: gap(desktop), grid_gaps_tablet: gap(tablet), grid_gaps_mobile: gap(mobile) })
const flexGaps = (desktop: number, tablet: number, mobile: number) => ({ flex_gap: gap(desktop), flex_gap_tablet: gap(tablet), flex_gap_mobile: gap(mobile) })

const LABEL: TypeSpec = { family: F.ui, size: 11.01, weight: 700, line: 1.3 }
const SMALL_UI: TypeSpec = { family: F.ui, size: 10.24, weight: 700, line: 1.3 }
const MONO_SM: TypeSpec = { family: F.mono, size: 10.24, weight: 500, line: 1.3 }
const SHADOW_CSS = (cls: string) => `selector .${cls}{box-shadow:${ZELO_SHADOW}}`
const MONO_CSS = `selector .zl-mono{font-family:"${F.mono}",ui-monospace,monospace;font-weight:500;font-variant-numeric:tabular-nums}`

/** Título de seção (h2 da .t-secao), com a palavra pintada em `<span class="zl-verde">`. */
const title = (b: ZeloBuilder, html: string, tag = 'h2', options: JsonRecord = {}) => b.heading(html, T.h2, C.ink, { header_size: tag, ...options })
const lede = (b: ZeloBuilder, copy: string, options: JsonRecord = {}) => b.text(copy, T.lede, C.soft, { ...maxw(575), _margin: sides(14.08, 0, 0, 0), ...options })

/** Cartão de "vazamento": ícone, título e frase curta sobre fundo preto. */
const leak = (b: ZeloBuilder, icon: string, heading: string, copy: string) => b.col([
  b.icon(icon, 21, { _margin: sides(0, 0, 10.88, 0) }),
  b.heading(heading, T.card, C.ink, { header_size: 'h3', _margin: sides(0, 0, 6.4, 0) }),
  b.text(copy, T.small, C.soft),
], 0, {
  padding: sides(17.92, 17.92, 20.48, 17.92), ...bg(C.paper),
  background_hover_background: 'classic', background_hover_color: C.raised, css_classes: 'zl-leak',
})
/** Grade de cartões com a linha de 1px entre eles (o fundo verde aparece no gap). */
const leakGrid = (b: ZeloBuilder, cards: ElementorNode[], columns: string, options: JsonRecord = {}, mobile = '1fr') => b.grid(cards, columns, 1, {
  ...bg(C.line), ...border(C.line, sides(1, 0, 1, 0)), ...options,
}, { tablet: columns, mobile })

// ── navegação ───────────────────────────────────────────────────────────────

type Page = 'home' | 'contato' | 'legal'

const NAV_LINKS: Record<Page, Array<[string, string]>> = {
  home: [['O que fazemos', '#servicos'], ['Agente de IA', '#agente'], ['Site', '#site'], ['Como funciona', '#processo'], ['Dúvidas', '#duvidas'], ['Contato', '/contato']],
  contato: [['O que fazemos', '/#servicos'], ['Agente de IA', '/#agente'], ['Site', '/#site'], ['Como funciona', '/#processo'], ['Dúvidas', '/#duvidas']],
  legal: [],
}

const makeNav = (page: Page, prefix: string): SectionNodeData => {
  const b = createBuilder(prefix)
  const logo = b.image('zelo-wordmark.png', 'Zelo, início', {
    width: px(71), _element_width: 'auto', ...FIXED, link_to: 'custom', link: link(page === 'home' ? '#topo' : '/'), _css_classes: 'zl-logo',
  })
  const links = NAV_LINKS[page].map(([label, url]) => b.heading(label, { family: F.ui, size: 12, weight: 500, line: 1.62 }, C.soft, {
    link: link(url), title_hover_color: C.green, ...FIXED, _css_classes: 'zl-nav-link',
  }))
  const cta = page === 'home'
    ? b.button('Agendar conversa', '/contato', 'fill', 'sm', FIXED)
    : page === 'contato'
      ? b.button('Voltar ao site', '/', 'ghost', 'sm', FIXED)
      : b.button('Voltar ao site', '/#contato', 'fill', 'sm', FIXED)
  const bar = b.row([
    logo,
    ...(links.length ? [b.row(links, 25.6, {
      flex_gap_tablet: gap(14), width: fluid('auto'), width_tablet: fluid('auto'), ...FIXED, hide_mobile: 'hidden-mobile', css_classes: 'zl-nav-links',
    })] : []),
    cta,
  ], 19.2, { flex_justify_content: 'space-between', min_height: px(57) })
  const root = b.root([bar], {
    tag: 'header', pad: false,
    settings: { ...bg('#000000E0'), ...border(C.line, sides(0, 0, 1, 0)) },
    css: [
      'selector{position:sticky;top:0;z-index:40;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}',
      'selector .zl-logo{transition:opacity .18s ease}selector .zl-logo:hover{opacity:.72}',
      `selector .zl-nav-link .elementor-heading-title a{position:relative;white-space:nowrap;transition:color .18s ease}selector .zl-nav-link .elementor-heading-title a::after{content:"";position:absolute;left:0;right:0;bottom:-5px;height:1px;background:${C.green};transform:scaleX(0);transform-origin:0 50%;transition:transform .3s cubic-bezier(.4,0,.2,1)}selector .zl-nav-link .elementor-heading-title a:hover::after{transform:scaleX(1)}`,
      BUTTON_CSS,
    ].join(''),
  })
  return b.section(`Zelo · Navegação${page === 'home' ? '' : page === 'contato' ? ' (contato)' : ' (privacidade)'}`, `zelo-nav-${page}-native`, root)
}

// ── hero ────────────────────────────────────────────────────────────────────

const makeHero = (): SectionNodeData => {
  const b = createBuilder('zhe')
  const headline = 'Seu negócio perde <span class="zl-troca"><span class="zl-troca__p zl-verde">dinheiro</span><span class="zl-troca__p zl-verde" aria-hidden="true">tempo</span></span> em tarefa que a <span class="zl-verde">IA</span> já faz sozinha.'
  const axis = b.col([
    b.heading(headline, T.hero, C.ink, { header_size: 'h1', align: 'center', _css_classes: 'zl-hero-title' }),
    b.text('Você vê a automação funcionando numa demo e usa 15 dias de graça antes de decidir qualquer coisa.', T.lede, C.soft, {
      align: 'center', ...maxw(427), _margin: sides(17.28, 0, 0, 0),
    }),
    b.row([
      b.button('Agendar uma conversa', '/contato', 'fill', 'md', FIXED),
      b.button('Fazer a conta do meu tempo', '#conta', 'ghost', 'md', FIXED),
    ], 8.96, { flex_justify_content: 'center', flex_wrap: 'wrap', margin: sides(24.32, 0, 0, 0) }),
    b.heading('Sem instalar nada e sem trocar seus sistemas.', tweak(T.body, { size: 11.39 }), C.soft, { align: 'center', _margin: sides(14.72, 0, 0, 0) }),
  ], 0, { flex_align_items: 'center', width: px(691), width_tablet: px(691), css_classes: 'zl-hero-eixo' })

  const root = b.root([axis], {
    id: 'topo',
    settings: {
      ...bgImage('hero-campo.svg'),
      min_height: fluid('calc(100svh - 57px)'),
      flex_justify_content: 'center', flex_align_items: 'center',
      padding: sides(57.6, 38, 60.8, 38), padding_tablet: sides(43.2, 29, 43.2, 29), padding_mobile: sides(35.84, 15, 38.4, 15),
    },
    css: [
      // A palavra que se troca: "dinheiro" fica de pé sem movimento; com movimento, reveza com "tempo".
      'selector .zl-troca{display:inline-grid;vertical-align:bottom;width:3.79em;text-align:left}',
      'selector .zl-troca__p{grid-area:1/1;justify-self:start;white-space:nowrap}',
      'selector .zl-troca__p+.zl-troca__p{opacity:0}',
      '@media (prefers-reduced-motion:no-preference){selector .zl-troca{animation:zl-troca-w 9.2s cubic-bezier(.2,.7,.2,1) infinite}selector .zl-troca__p{animation:zl-troca-a 9.2s ease infinite, zl-brilho 2.8s ease-in-out infinite alternate}selector .zl-troca__p+.zl-troca__p{animation-name:zl-troca-b, zl-brilho}}',
      '@keyframes zl-troca-w{0%,46%{width:3.79em}54%,96%{width:3.13em}100%{width:3.79em}}',
      '@keyframes zl-troca-a{0%,46%{opacity:1;transform:none}50%,96%{opacity:0;transform:translateY(-.3em)}100%{opacity:1;transform:none}}',
      '@keyframes zl-troca-b{0%,46%{opacity:0;transform:translateY(.3em)}50%,96%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-.3em)}}',
      'selector .zl-hero-title .elementor-heading-title{overflow-wrap:break-word}',
      BUTTON_CSS,
    ].join(''),
  })
  return b.section('Zelo · Hero', 'zelo-hero-native', root)
}

// ── movimento ───────────────────────────────────────────────────────────────

const makeMovimento = (): SectionNodeData => {
  const b = createBuilder('zmv')
  const axisLabel = (label: string) => b.heading(label, { family: F.ui, size: 9.98, weight: 600, line: 1.62, letter: 0.05 }, C.faint, FIXED)
  const curve = b.col([
    b.heading('Empresas usando IA e automação', T.rot, C.green, { _margin: sides(0, 0, 10.24, 0) }),
    b.col([
      b.image('curva.svg', 'Ilustração do movimento: a adoção de IA e automação pelas empresas cresce ano após ano e segue subindo daqui para a frente.', { width: pct(100) }),
      b.heading('estamos aqui', T.mono, C.green, {
        _position: 'absolute', _offset_x: pct(55.4), _offset_y: pct(24.4), _element_width: 'auto', _css_classes: 'zl-hoje',
      }),
    ], 0, { css_classes: 'zl-curva' }),
    b.row([axisLabel('ontem'), axisLabel('amanhã')], 0, { flex_justify_content: 'space-between', padding: sides(4, 0, 0, 0) }),
  ], 0)
  const copy = b.col([
    b.rail('O movimento já começou'),
    title(b, 'Automatizar com IA parou de ser <span class="zl-verde">vantagem</span>. Virou o normal.'),
    lede(b, 'Não é promessa de futuro: já está na conta de quem atende mais rápido com o mesmo time. Ficar de fora não é perder uma moda, é perder hora de trabalho todo mês.'),
  ], 0)
  const grid = b.grid([curve, copy], 'minmax(0,1.27fr) minmax(0,1fr)', 51.2, { ...gaps(51.2, 36, 23.04), grid_align_items: 'center' })
  const root = b.root([grid], {
    id: 'movimento',
    pad: [76.8, 54, 43.52],
    settings: bgImage('movimento-campo.svg'),
    css: 'selector .zl-hoje{pointer-events:none;white-space:nowrap}',
  })
  return b.section('Zelo · O movimento', 'zelo-movimento-native', root)
}

// ── o problema ──────────────────────────────────────────────────────────────

const makeProblema = (): SectionNodeData => {
  const b = createBuilder('zpr')
  const alert = b.row([
    b.icon('alerta', 21, { _margin: sides(1.92, 0, 0, 0) }),
    b.text('Sua empresa <b>já tem</b> WhatsApp, agenda, planilha e sistema. Falta ligar um no outro, e isso é o nosso trabalho.', tweak(T.body, { size: 12.29 }), C.soft, { ...FILL, ...maxw(457) }),
  ], 12.8, {
    flex_align_items: 'flex-start', padding: sides(14.72, 16.64), margin: sides(20.48, 0, 0, 0),
    ...card(11), border_width: sides(1, 1, 1, 3), width: px(607), width_tablet: px(607), css_classes: 'zl-alerta',
  })
  const leaks = leakGrid(b, [
    leak(b, 'chat', 'A pergunta se repete', 'A mesma resposta todo dia, digitada por quem podia estar vendendo.'),
    leak(b, 'espalhado', 'O dado mora em quatro lugares', 'Cliente no WhatsApp, horário na agenda, valor na planilha.'),
    leak(b, 'sino', 'O retorno depende de lembrar', 'Só volta quem alguém lembrar de chamar. E na correria ninguém lembra.'),
  ], 'repeat(3,minmax(0,1fr))', { margin: sides(28.16, 0, 0, 0) })
  const root = b.root([
    b.rail('O problema'),
    title(b, 'O problema quase nunca é falta de <span class="zl-verde">ferramenta</span>.'),
    alert,
    leaks,
  ], {
    id: 'vazamento',
    css: `selector .zl-alerta{border-left-color:${C.green}}selector .zl-alerta b{color:${C.ink};font-weight:600}selector .zl-leak{transition:background-color .3s ease}`,
  })
  return b.section('Zelo · O problema', 'zelo-problema-native', root)
}

// ── a conta ─────────────────────────────────────────────────────────────────

const LEDGER: Array<[string, number, boolean]> = [
  ['Responder as mesmas perguntas no WhatsApp', 18, true],
  ['Marcar, confirmar e remarcar horário na mão', 12, true],
  ['Passar informação de um lugar pro outro', 9, false],
  ['Dar retorno pro cliente que sumiu', 8, true],
  ['Montar o mesmo orçamento ou documento repetido', 7, false],
  ['Fechar relatório no fim do mês', 6, false],
  ['Cobrar, conferir pagamento e emitir recibo', 5, false],
]

/** Comportamento da conta: o conteúdo é todo nativo, o script só liga as linhas ao total. */
const LEDGER_SCRIPT = `<script>
(function () {
  var WA = '${ZELO_CONTACT.whatsapp}';
  var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.zl-conta').forEach(function (box) {
    if (box.getAttribute('data-zl-conta')) return;
    box.setAttribute('data-zl-conta', '1');
    var rows = [].slice.call(box.querySelectorAll('.zl-row'));
    var sum = box.querySelector('.zl-sum .elementor-heading-title');
    var days = box.querySelector('.zl-days b');
    var btn = box.querySelector('.zl-recuperar a');
    var label = btn && btn.querySelector('.elementor-button-text');
    var horas = function (r) { var h = r.querySelector('.zl-hrs'); return parseInt(h ? h.textContent : '0', 10) || 0; };
    var nome = function (r) { var t = r.querySelector('.zl-row-label'); return t ? t.textContent.trim() : ''; };
    var atual = null, quadro;
    var escrever = function (h) {
      if (sum) sum.innerHTML = h + '<small>h</small>';
      if (days) days.textContent = (h / 8).toFixed(1).replace('.', ',');
    };
    var contar = function (de, ate) {
      cancelAnimationFrame(quadro);
      if (reduz || de === null) { escrever(ate); return; }
      var t0 = performance.now();
      (function passo(t) {
        var p = Math.min((t - t0) / 620, 1), e = 1 - Math.pow(1 - p, 3);
        escrever(Math.round(de + (ate - de) * e));
        if (p < 1) quadro = requestAnimationFrame(passo);
      })(t0);
    };
    var atualizar = function () {
      var on = rows.filter(function (r) { return r.classList.contains('is-on'); });
      var h = on.reduce(function (t, r) { return t + horas(r); }, 0);
      contar(atual, h); atual = h;
      rows.forEach(function (r) { r.setAttribute('aria-checked', r.classList.contains('is-on') ? 'true' : 'false'); });
      if (!btn) return;
      var texto = on.length
        ? 'Oi! Fiz a conta no site e marquei:\\n' + on.map(function (r) { return '• ' + nome(r); }).join('\\n') + '\\n\\nDá umas ' + h + ' horas por mês. Quero conversar sobre automatizar isso.'
        : 'Oi! Vim pelo site e quero agendar uma conversa sobre o meu processo.';
      btn.setAttribute('href', 'https://wa.me/' + WA + '?text=' + encodeURIComponent(texto));
      btn.setAttribute('target', '_blank');
      btn.setAttribute('rel', 'noopener');
      if (label) label.textContent = on.length ? 'Recuperar essas ' + h + ' horas' : 'Agendar uma conversa';
    };
    rows.forEach(function (r) {
      r.setAttribute('role', 'checkbox');
      r.setAttribute('tabindex', '0');
      r.setAttribute('aria-label', nome(r) + ', ' + horas(r) + ' horas por mês');
      var alternar = function () { r.classList.toggle('is-on'); atualizar(); };
      r.addEventListener('click', alternar);
      r.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternar(); } });
    });
    atualizar();
  });
})();
</script>`

const makeConta = (): SectionNodeData => {
  const b = createBuilder('zct')
  const max = Math.max(...LEDGER.map(([, h]) => h))
  const rows = LEDGER.map(([label, hours, on]) => b.row([
    b.heading('<span class="zl-check-box"></span>', tweak(T.body, { size: 11.9, line: 1 }), C.ink, { ...FIXED, _css_classes: 'zl-check' }),
    b.heading(label, { family: F.text, size: 11.9, weight: 400, line: 1.35 }, C.ink, { ...FILL, _css_classes: 'zl-row-label' }),
    b.heading(`${hours} h`, { family: F.mono, size: 10.75, weight: 400, line: 1.35 }, C.soft, { ...FIXED, _css_classes: 'zl-hrs' }),
  ], 10.24, {
    padding: sides(8.7, 14.08), ...border(C.line, sides(0, 0, 1, 0)),
    css_classes: `zl-row${on ? ' is-on' : ''}`,
    custom_css: `selector{--p:${(hours / max).toFixed(3)}}`,
  }))
  const ledger = b.col([
    b.row([
      b.heading('Trabalho que se repete toda semana', tweak(T.card, { size: 11.39, line: 1.62 }), C.ink, FILL),
      b.heading('horas/mês', { family: F.mono, size: 10.5, weight: 500, line: 1.62, letter: 0.015 }, C.green, FIXED),
    ], 12.8, { flex_justify_content: 'space-between', flex_align_items: 'baseline', padding: sides(12.16, 14.08), ...border(C.lineStrong, sides(0, 0, 1, 0)) }),
    ...rows,
  ], 0, { ...card(21), overflow: 'hidden', css_classes: 'zl-ledger' })

  const total = b.col([
    b.heading('Tempo que some por mês', T.rot, C.green),
    b.heading('38<small>h</small>', { family: F.mono, size: 'clamp(28.8px, 4.8vw, 39.68px)', weight: 500, line: 1, letter: -0.04 }, C.red, {
      _margin: sides(7.04, 0, 0, 0), _css_classes: 'zl-sum',
    }),
    b.heading('o mesmo que <b>4,8</b> dias de trabalho jogados fora', { family: F.text, size: 11.65, weight: 400, line: 1.35 }, C.soft, {
      _margin: sides(6.4, 0, 0, 0), _padding: sides(0, 0, 14.72, 0),
      _border_border: 'solid', _border_width: sides(0, 0, 1, 0), _border_color: C.line, _css_classes: 'zl-days',
    }),
    b.button('Recuperar essas 38 horas', '#contato', 'fill', 'wide', { _margin: sides(14.72, 0, 0, 0), _css_classes: 'zl-btn zl-btn--fill zl-recuperar' }),
    b.text('Estimativa média para operações ainda manuais.', T.fine, C.soft, { align: 'center', _margin: sides(9.6, 0, 0, 0) }),
  ], 0, { padding: sides(21.76), padding_tablet: sides(18.72), padding_mobile: sides(16.64), ...card(16), css_classes: 'zl-total' })

  const root = b.root([
    b.rail('A conta'),
    title(b, 'Faça a <span class="zl-verde">conta</span> antes de falar com a gente.'),
    lede(b, 'Marque o que acontece na sua empresa. As horas são estimativas.'),
    b.grid([ledger, total], 'minmax(0,1.75fr) minmax(0,1fr)', 25.6, {
      ...gaps(25.6, 18.72, 14.08), grid_align_items: 'start', margin: sides(28.16, 0, 0, 0), css_classes: 'zl-conta',
    }),
    b.widget('html', { html: LEDGER_SCRIPT, _css_classes: 'zl-conta-js' }),
  ], {
    id: 'conta',
    css: [
      SHADOW_CSS('zl-ledger'), SHADOW_CSS('zl-total'), BUTTON_CSS,
      'selector .zl-conta-js{display:none}',
      'selector .zl-row{position:relative;cursor:pointer}',
      'selector .zl-row>*{position:relative}',
      'selector .zl-row::before{content:"";position:absolute;inset:0 auto 0 0;width:calc(var(--p,0) * 100%);background:linear-gradient(90deg,rgba(144,184,166,.13) 0 84%,transparent 100%);pointer-events:none;transition:width .45s cubic-bezier(.4,0,.2,1),background .25s ease}',
      'selector .zl-row.is-on::before{background:linear-gradient(90deg,rgba(224,137,123,.14) 0 84%,transparent 100%)}',
      'selector .zl-ledger>.zl-row:last-child,selector .zl-ledger .zl-row:last-child{border-bottom:0}',
      `selector .zl-row:hover .zl-row-label .elementor-heading-title{color:${C.green}}`,
      `selector .zl-check-box{display:grid;place-content:center;width:14px;height:14px;border:1px solid ${C.lineStrong};border-radius:11px;background:${C.paper};transition:background .15s ease,border-color .15s ease}`,
      'selector .zl-check-box::after{content:"";width:7px;height:4px;border-left:2px solid #000;border-bottom:2px solid #000;transform:rotate(-45deg) translate(1px,-1px) scale(.4);opacity:0;transition:opacity .15s ease,transform .15s ease}',
      `selector .zl-row.is-on .zl-check-box{background:${C.green};border-color:${C.green}}`,
      'selector .zl-row.is-on .zl-check-box::after{opacity:1;transform:rotate(-45deg) translate(1px,-1px) scale(1)}',
      'selector .zl-check{width:20px}',
      `selector .zl-row.is-on .zl-hrs .elementor-heading-title{color:${C.red}}`,
      'selector .zl-hrs .elementor-heading-title,selector .zl-sum .elementor-heading-title{font-variant-numeric:tabular-nums;white-space:nowrap}',
      'selector .zl-sum small{font-size:.34em;letter-spacing:.02em;margin-left:.1em}',
      `selector .zl-days b{color:${C.ink};font-family:"${F.mono}",ui-monospace,monospace;font-weight:500}`,
    ].join(''),
  })
  return b.section('Zelo · A conta', 'zelo-conta-native', root)
}

// ── o que fazemos ───────────────────────────────────────────────────────────

const tela = (b: ZeloBuilder, name: string, children: ElementorNode[]) => b.col(children, 9.6, {
  padding: sides(12.8, 14.72, 14.08, 14.72), ...border(C.lineStrong), border_radius: sides(16), ...bg(C.paper), overflow: 'hidden',
  css_classes: `zl-tela zl-tela--${name}`,
})
const telaRot = (b: ZeloBuilder, left: ElementorNode[], right: ElementorNode[], options: JsonRecord = {}) =>
  b.row([...left, ...right], 6.4, { flex_justify_content: 'space-between', ...options })
const telaLabel = (b: ZeloBuilder, html: string, options: JsonRecord = {}) => b.heading(html, LABEL, C.soft, { ...FIXED, ...options })
const telaPill = (b: ZeloBuilder, html: string, options: JsonRecord = {}) => b.pill(html, SMALL_UI, C.green, {
  _padding: sides(1.79, 8.32, 1.79, 7.04), _background_background: 'classic', _background_color: C.wash, _css_classes: 'zl-tela-pill', ...options,
})
const LIVE = '<span class="zl-dot zl-dot--vivo"></span>'

const opAnalise = (b: ZeloBuilder) => tela(b, 'analise', [
  telaRot(b, [telaPill(b, `${LIVE}Analisando`)], [telaLabel(b, '5 fontes', typography(MONO_SM))]),
  b.col([['chat', 'WhatsApp'], ['caixa', 'Pedido'], ['janela', 'Formulário'], ['planilha', 'Planilha'], ['equipe', 'Cliente <b class="zl-mono">#128</b>']].map(([icon, label]) => b.row([
    b.icon(icon, 16, { opacity: { unit: 'px', size: 0.75, sizes: [] } }),
    b.heading(label, T.ui, C.soft, FILL),
    b.heading('<span class="zl-dot"></span>', T.ui, C.green, FIXED),
  ], 8.32, { padding: sides(4.6, 8.32), border_radius: sides(7), css_classes: 'zl-ana-row' })), 3),
])

const opMonitor = (b: ZeloBuilder) => tela(b, 'monitor', [
  telaRot(b, [telaLabel(b, 'Status')], [telaPill(b, `${LIVE}Operacional`)]),
  b.row([
    b.heading('Eventos processados · últimas 24h', { family: F.ui, size: 10.24, weight: 600, line: 1.3 }, C.soft, FILL),
    b.heading('agora', { family: F.mono, size: 9.73, weight: 500, line: 1.3, letter: 0.03 }, C.green, FIXED),
  ], 6.4, { flex_justify_content: 'space-between', flex_align_items: 'baseline', margin: sides(-3.84, 0, 0, 0) }),
  b.image('mon-barras.svg', '', { width: pct(100), height: px(64), _css_classes: 'zl-barras' }),
  b.grid([['Disponibilidade', '99.9%'], ['Resposta média', '6s'], ['Eventos/hora', '42']].map(([dt, dd]) => b.col([
    b.heading(dt, { family: F.ui, size: 9.73, weight: 600, line: 1.3 }, C.soft, { _css_classes: 'zl-ellipsis' }),
    b.heading(dd, { family: F.mono, size: 10.24, weight: 600, line: 1.3, letter: 0.015 }, C.ink),
  ], 1.5)), 'repeat(3,minmax(0,1fr))', 7.68, { padding: sides(8.96, 0, 0, 0), ...border(C.line, sides(1, 0, 0, 0)) }, { mobile: 'repeat(3,minmax(0,1fr))' }),
])

const chip = (b: ZeloBuilder, label: string, options: JsonRecord = {}) => b.heading(label, { family: F.mono, size: 9.73, weight: 600, line: 1.3 }, '#000000', {
  align: 'center', _element_width: 'initial', _element_custom_width: px(46), ...FIXED,
  _padding: sides(4.4, 0), _background_background: 'classic', _background_color: C.green, _border_radius: sides(7), ...options,
})
const vaga = (b: ZeloBuilder) => b.image('icons/vaga.svg', '', { width: px(46), _element_width: 'auto', ...FIXED })

const opClassifica = (b: ZeloBuilder) => {
  const boxes: Array<[string, ElementorNode[]]> = [
    ['Urgente', [chip(b, '#132', { _css_classes: 'zl-chip-vaga' }), chip(b, '#128')]],
    ['Para hoje', [chip(b, '#129')]],
    ['Essa semana', [chip(b, '#131')]],
    ['Padrão', [chip(b, '#130')]],
  ]
  return tela(b, 'classifica', [
    b.row([telaLabel(b, 'Entrada'), b.heading('→', tweak(LABEL, { weight: 400 }), C.green, FIXED), telaLabel(b, 'Classificador')], 5.12),
    b.grid([
      b.col([0, 1, 2, 3, 4].map(() => vaga(b)), 2, { flex_align_items: 'flex-start' }),
      b.image('icons/no-troca.svg', '', { width: px(32), _css_classes: 'zl-cla-no' }),
      b.col(boxes.map(([label, chips]) => b.row([
        b.heading(label, SMALL_UI, C.soft, FILL),
        b.row(chips, 0, { width: fluid('auto'), width_tablet: fluid('auto'), width_mobile: fluid('auto'), ...FIXED, flex_justify_content: 'flex-end' }),
      ], 6, { min_height: px(26), flex_justify_content: 'space-between' })), 4),
    ], '48px minmax(0,1fr) 150px', 0, { min_height: px(124), grid_align_items: 'start' }, { mobile: '48px minmax(0,1fr) 150px' }),
  ])
}

const opExecuta = (b: ZeloBuilder) => tela(b, 'executa', [
  telaRot(b, [telaLabel(b, 'Tarefa · <b class="zl-mono">#128</b>')], [telaPill(b, '✓ Concluído')]),
  b.heading('Confirmar agendamento', { family: F.ui, size: 13.82, weight: 700, line: 1.3, letter: -0.012 }, C.ink, { _margin: sides(-3.84, 0, 0, 0) }),
  b.col([['Validar horário disponível', '0.2s'], ['Criar evento na agenda', '0.3s'], ['Registrar na planilha', '0.4s'], ['Avisar o cliente', '0.5s']].map(([label, time]) => b.row([
    b.image('icons/caixa-check.svg', '', { width: px(18), _element_width: 'auto', ...FIXED }),
    b.heading(label, T.ui, C.ink, FILL),
    b.heading(time, { family: F.mono, size: 9.98, weight: 400, line: 1.3 }, C.soft, FIXED),
  ], 8.32, { padding: sides(3.84, 7.04), border_radius: sides(7) })), 4),
])

const opAlerta = (b: ZeloBuilder) => {
  const node = (file: string, label: string, color: string, box = 13, options: JsonRecord = {}) => b.col([
    b.image(`icons/${file}.svg`, '', { width: px(box) }),
    b.heading(label, { family: F.ui, size: 9.22, weight: 700, line: 1.3, letter: 0.01 }, color, { align: 'center' }),
  ], 5, { flex_align_items: 'center', width: fluid('auto'), width_tablet: fluid('auto'), width_mobile: fluid('auto'), ...FIXED, css_classes: 'zl-ale-no', ...options })
  return tela(b, 'alerta', [
    telaRot(b, [b.row([b.icon('sino', 16), telaLabel(b, 'Notificação')], 5.12)], [telaLabel(b, 'agora', typography(MONO_SM))]),
    b.row([
      node('no-auto', 'auto', C.soft), node('no-auto', 'auto', C.soft), node('no-auto', 'auto', C.soft),
      node('no-alerta', 'alerta', C.green),
      node('no-voce', 'você', C.ink, 24, { margin: sides(-5.5, 0, 0, 0) }),
    ], 0, { flex_justify_content: 'space-between', flex_align_items: 'flex-start', padding: sides(2.56, 18, 0, 18), min_height: px(38), css_classes: 'zl-ale-fio' }),
    b.col([
      b.heading('“Pedido <b class="zl-mono">#128</b> precisa da sua aprovação”', { family: F.ui, size: 13.06, weight: 600, line: 1.35 }, C.ink),
      b.row([
        b.pill('Aprovar', SMALL_UI, '#000000', { _padding: sides(3.33, 10.88), _background_background: 'classic', _background_color: C.green, _border_color: C.green }),
        b.pill('Ver detalhes', SMALL_UI, C.ink, { _padding: sides(3.33, 10.88) }),
      ], 5.76, { flex_wrap: 'wrap' }),
    ], 7.04, { padding: sides(9.6, 11.52, 10.24, 11.52), ...card(11), css_classes: 'zl-ale-aviso' }),
  ])
}

const OPS: Array<[string, string, string, string, (b: ZeloBuilder) => ElementorNode]> = [
  ['01', 'Análise', 'Lê o que entra na operação.', 'Mensagem, pedido, formulário, planilha e ficha de cliente lidos e entendidos antes de qualquer ação.', opAnalise],
  ['02', 'Monitoramento', 'Observa sem pausar.', 'Agenda, estoque, prazo e status acompanhados o tempo todo, sem precisar que alguém vá conferir.', opMonitor],
  ['03', 'Classificação', 'Organiza por critério.', 'Casos separados por urgência, prazo ou tipo, pra você saber o que olhar primeiro quando entrar.', opClassifica],
  ['04', 'Execução', 'Executa, registra e avança.', 'Confirma, agenda, atualiza planilha e avança pro próximo passo, com tudo registrado.', opExecuta],
  ['05', 'Alerta', 'Chama você no momento certo.', 'Você entra quando precisa decidir, aprovar ou agir. Não pra conferir tudo manualmente.', opAlerta],
]

const makeServicos = (): SectionNodeData => {
  const b = createBuilder('zsv')
  const ops = OPS.map(([num, tag, heading, copy, screen], index) => {
    const even = index % 2 === 1
    const fala = b.col([
      b.row([
        b.heading(num, { family: F.ui, size: 'clamp(28.16px, 3.2vw, 38.4px)', weight: 800, line: 1, letter: -0.05 }, C.green, FIXED),
        b.pill(tag, { family: F.ui, size: 11.26, weight: 700, line: 1.3, letter: -0.002 }, C.green),
      ], 10.24, { margin: sides(0, 0, 2.56, 0) }),
      b.heading(heading, { family: F.ui, size: 'clamp(18.56px, 2.1vw, 24.96px)', weight: 700, line: 1.16, letter: -0.028 }, C.ink, { header_size: 'h3' }),
      b.text(copy, { family: F.text, size: 12.8, weight: 400, line: 1.55 }, C.soft, maxw(328)),
    ], 7.04, { flex_justify_content: 'center', ...(even ? { _flex_order: 'end', _flex_order_mobile: 'start' } : {}) })
    return b.grid([fala, screen(b)], 'minmax(0,.785fr) minmax(0,1fr)', 46.08, {
      ...gaps(46.08, 32.4, 20.48), grid_align_items: 'center',
      padding: sides(40.96, 0), padding_tablet: sides(30.6, 0), padding_mobile: sides(23.04, 0),
      ...(index ? border(C.line, sides(1, 0, 0, 0)) : {}),
      css_classes: 'zl-op',
    })
  })
  const intro = b.grid([
    b.col([b.rail('O que fazemos'), title(b, 'Você decide, a IA <span class="zl-verde">executa</span>.')], 0),
    b.text('A Zelo cuida de cada parte da operação: lê o que chega, acompanha, organiza, executa e te avisa quando algo precisa de você.', T.lede, C.soft),
  ], 'minmax(0,1.06fr) minmax(0,.94fr)', 35.84, { ...gaps(35.84, 23.04, 9.98), grid_align_items: 'end' })
  const root = b.root([intro, b.col(ops, 0, { margin: sides(28.16, 0, 0, 0) })], {
    id: 'servicos',
    css: [
      DOT_CSS, MONO_CSS,
      `selector .zl-tela{box-shadow:inset 0 1px 0 rgba(255,255,255,.06),${ZELO_SHADOW}}`,
      'selector .zl-tela-pill .zl-dot{margin:-2px 5px 0 0;width:7px;height:7px}',
      'selector .zl-ellipsis .elementor-heading-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      'selector .zl-ana-row .elementor-heading-title,selector .zl-tela--executa .elementor-heading-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      'selector .zl-barras img{height:64px;width:100%;display:block}',
      'selector .zl-cla-no{align-self:center;justify-self:center}',
      'selector .zl-chip-vaga{margin-right:-39px;z-index:1;box-shadow:1px 0 0 #000}',
      `selector .zl-ale-fio{position:relative}selector .zl-ale-fio::before{content:"";position:absolute;left:24px;right:24px;top:8.56px;height:1px;background:${C.lineStrong}}selector .zl-ale-no{position:relative;z-index:1}`,
      'selector .zl-ale-aviso{box-shadow:' + ZELO_SHADOW + '}',
      '@media (prefers-reduced-motion:no-preference){selector .zl-ana-row{animation:zl-lendo 4.2s linear infinite both}selector .zl-ana-row:nth-child(2){animation-delay:.7s}selector .zl-ana-row:nth-child(3){animation-delay:1.4s}selector .zl-ana-row:nth-child(4){animation-delay:2.1s}selector .zl-ana-row:nth-child(5){animation-delay:2.8s}}',
      '@keyframes zl-lendo{0%,100%{background-color:transparent}4%,14%{background-color:rgba(144,184,166,.09)}20%{background-color:transparent}}',
      '@media (max-width:767px){selector .zl-op .zl-tela{min-width:0}}',
    ].join(''),
  })
  return b.section('Zelo · O que fazemos', 'zelo-servicos-native', root)
}

// ── agente de IA ────────────────────────────────────────────────────────────

const makeAgente = (): SectionNodeData => {
  const b = createBuilder('zag')
  const doc = b.col([
    b.row([
      b.heading('Protocolo da sua empresa', tweak(T.card, { size: 11.39, line: 1.62 }), C.ink, FILL),
      b.heading('documento vivo', T.rot, C.green, FIXED),
    ], 12.8, { flex_justify_content: 'space-between', flex_align_items: 'baseline', padding: sides(12.16, 14.08), ...border(C.lineStrong, sides(0, 0, 1, 0)) }),
    ...['Processos', 'Regras da casa', 'Preço e prazo', 'Respostas oficiais', 'Limites do agente'].map((label, index) => b.grid([
      b.heading(String(index + 1).padStart(2, '0'), { family: F.mono, size: 10.5, weight: 400, line: 1.62 }, C.green, { _padding: sides(2.05, 0, 0, 0) }),
      b.heading(label, tweak(T.card, { size: 11.65, line: 1.62 }), C.ink),
    ], '24.32px minmax(0,1fr)', 10.88, {
      padding: sides(10.88, 14.08), ...(index < 4 ? border(C.line, sides(0, 0, 1, 0)) : {}),
      ...(index % 2 === 1 ? bg(C.band) : {}), css_classes: 'zl-doc-row',
    }, { mobile: '24.32px minmax(0,1fr)' })),
  ], 0, { ...card(21), overflow: 'hidden', css_classes: 'zl-doc' })

  const fone = b.col([
    b.image('whatsapp-agente.webp', 'Conversa no WhatsApp da empresa, 21h47. Cliente: “Boa noite! Vocês atendem sábado? Quanto fica a limpeza de pele?”. Agente: “Boa noite! Sábado das 9h às 14h. A limpeza de pele fica R$ 180 e leva 1 hora. Quer que eu veja um horário?”. Cliente: “Quero, de manhã se der”. Agente: “Agendado: sábado, 9h30, com a Camila. Te lembro na sexta à tarde.”', {
      width: px(290), align: 'center',
    }),
    b.col([
      b.heading('WhatsApp da sua empresa', tweak(T.rot, { line: 1.5, letter: -0.005 }), C.green, { align: 'center' }),
      b.text('Aconteceu enquanto você dormia. O horário já entrou na agenda.', { family: F.text, size: 11.14, weight: 400, line: 1.5 }, C.soft, { align: 'center' }),
      b.heading('Conversa e perfil meramente ilustrativos.', { family: F.text, size: 10.24, weight: 400, line: 1.5 }, C.faint, { align: 'center', _margin: sides(4.48, 0, 0, 0) }),
    ], 0, { flex_align_items: 'center', width: px(214), width_tablet: px(214), width_mobile: px(214) }),
  ], 14.08, { flex_align_items: 'center', css_classes: 'zl-fone' })

  const pair = leakGrid(b, [
    leak(b, 'escudo', 'Não inventa resposta', 'Se não está no documento, ele avisa que vai confirmar e chama você.'),
    leak(b, 'relogio', 'Trabalha de madrugada e no domingo', 'Quem responde primeiro fica com o cliente.'),
    leak(b, 'troca', 'Sabe a hora de sair de cena', 'Caso delicado ou negociação, ele chama uma pessoa e manda o resumo da conversa.'),
    leak(b, 'equipe', 'Sua equipe também pergunta', 'Preço, prazo, regra e exceção. A resposta é a mesma pra todo mundo.'),
  ], 'repeat(2,minmax(0,1fr))', { css_classes: 'zl-pair' })

  const root = b.root([
    b.rail('Agente de IA', [b.image('bot.svg', '', { width: px(48), width_mobile: px(38), _element_width: 'auto', ...FIXED, _css_classes: 'zl-bot' })]),
    title(b, 'Um <span class="zl-verde">agente de IA</span> que só sabe da sua empresa.'),
    lede(b, 'A gente escreve como o seu negócio funciona, e o agente responde por esse documento.'),
    b.grid([doc, fone, pair], 'minmax(0,.887fr) minmax(0,1fr)', 33.28, { ...gaps(33.28, 21.6, 17.92), grid_align_items: 'start', margin: sides(28.16, 0, 0, 0), css_classes: 'zl-ia' }),
  ], {
    id: 'agente',
    css: [
      SHADOW_CSS('zl-doc'),
      '@media (min-width:768px){selector .zl-ia>.zl-fone,selector .zl-ia>.e-con-inner>.zl-fone{grid-column:1;grid-row:1 / span 2}selector .zl-ia>.zl-doc,selector .zl-ia>.e-con-inner>.zl-doc{grid-column:2;grid-row:1}selector .zl-ia>.zl-pair,selector .zl-ia>.e-con-inner>.zl-pair{grid-column:2;grid-row:2}}',
      'selector .zl-fone{isolation:isolate}selector .zl-fone::before{content:"";position:absolute;z-index:-1;inset:-4% -14% 12%;background:radial-gradient(46% 44% at 50% 50%,rgba(144,184,166,.22),transparent 72%);pointer-events:none}',
      '@media (prefers-reduced-motion:no-preference){selector .zl-bot{animation:zl-flutua 4.5s ease-in-out infinite}}',
      '@keyframes zl-flutua{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}',
      'selector .zl-leak{transition:background-color .3s ease}',
    ].join(''),
  })
  return b.section('Zelo · Agente de IA', 'zelo-agente-native', root)
}

// ── site ────────────────────────────────────────────────────────────────────

const makeSite = (): SectionNodeData => {
  const b = createBuilder('zsi')
  const points: Array<[string, string, string]> = [
    ['mira', 'Uma página, sem labirinto', 'Serviço, preço e contato sem procurar.'],
    ['relogio', 'No ar assim que aprovar', 'Você lê, ajusta e a gente publica.'],
    ['lupa', 'Encontrável no Google', 'Serviço, bairro e o que as pessoas pesquisam.'],
    ['celular', 'Feito pro celular', 'Carrega rápido, com o WhatsApp sempre à mão.'],
    ['faisca', 'Com a IA embutida', 'Ela atende na própria página e já agenda.'],
    ['cadeado', 'Seu, não alugado', 'Domínio e conteúdo no seu nome.'],
  ]
  const list = b.col(points.map(([icon, strong, copy], index) => b.grid([
    b.icon(icon, 14, { _margin: sides(2.3, 0, 0, 0) }),
    b.col([
      b.heading(strong, tweak(T.card, { size: 11.65, line: 1.45 }), C.ink),
      b.text(copy, { family: F.text, size: 11.39, weight: 400, line: 1.45 }, C.soft),
    ], 1.54),
  ], '14px minmax(0,1fr)', 9.6, {
    padding: sides(10.88, 2.56), grid_align_items: 'start',
    ...border(C.line, sides(index ? 0 : 1, 0, 1, 0)),
  }, { mobile: '14px minmax(0,1fr)' })), 1.28)
  const root = b.root([
    b.rail('Site'),
    title(b, 'Seu site devia <span class="zl-verde">responder</span> cliente, não só existir.'),
    lede(b, 'Site parado é só cartão de visita caro. O nosso responde as dúvidas de sempre e leva o cliente pro WhatsApp.'),
    b.grid([
      b.image('site-responsivo.webp', 'A mesma página aberta no notebook e no celular, com o botão de WhatsApp à mão.', { width: pct(100), space: px(500), align: 'center', _css_classes: 'zl-telas' }),
      list,
    ], 'repeat(2,minmax(0,1fr))', 30.72, { ...gaps(30.72, 21.6, 17.92), grid_align_items: 'center', margin: sides(29.44, 0, 0, 0) }),
  ], {
    id: 'site',
    css: 'selector .zl-telas{isolation:isolate}selector .zl-telas::before{content:"";position:absolute;z-index:-1;inset:-6% -8%;background:radial-gradient(52% 48% at 50% 56%,rgba(144,184,166,.22),transparent 72%);pointer-events:none}',
  })
  return b.section('Zelo · Site', 'zelo-site-native', root)
}

// ── como funciona ───────────────────────────────────────────────────────────

const PHASES: Array<[string, string, string, string, string, boolean]> = [
  ['chat', 'Fase 01', 'Conversa', '1 hora', 'Entendemos sua operação, onde o tempo está sendo perdido e o que vale automatizar primeiro. Sem custo, sem compromisso.', false],
  ['janela', 'Fase 02', 'Demo', '2 a 5 dias', 'Construímos uma demonstração real, mostrando a automação funcionando antes de você decidir qualquer coisa.', false],
  ['relogio', 'Fase 03', 'Teste', '15 dias, grátis', 'Você usa de verdade, no seu dia a dia, sem pagar nada. A gente acompanha de perto e ajusta o que precisar.', true],
  ['infinito', 'Fase 04', 'Continuidade', 'recorrente', 'Se fizer sentido pra você, seguimos juntos. Só aí entra qualquer valor: projeto fechado e manutenção mensal, tudo combinado com transparência.', false],
]

const makeProcesso = (): SectionNodeData => {
  const b = createBuilder('zfl')
  const MONO_CAPS: TypeSpec = { family: F.mono, size: 9.22, weight: 400, line: 1.62, letter: 0.15, transform: 'uppercase' }
  const phases = PHASES.map(([icon, n, name, term, copy, strong], index) => {
    const even = index % 2 === 1
    const last = index === PHASES.length - 1
    const align = even ? { align: 'right', align_mobile: 'left' } : {}
    const seal = b.col([b.icon(icon, 35, { width_tablet: px(27), width_mobile: px(19), _css_classes: 'zl-selo-ico' })], 0, {
      flex_justify_content: 'center', flex_align_items: 'center',
      min_height: px(104), min_height_tablet: px(80), min_height_mobile: px(56),
      ...border(strong ? C.lineStrong : C.line), border_radius: round,
      background_background: 'classic', background_color: C.paper,
      background_image: media(zeloAsset('selo.svg')), background_position: 'center center', background_repeat: 'no-repeat', background_size: 'cover',
      css_classes: 'zl-selo',
      ...(even ? { _flex_order: 'end', _flex_order_mobile: 'start' } : {}),
    })
    const txt = b.col([
      b.heading(n, MONO_CAPS, C.green, align),
      b.heading(name, { family: F.ui, size: 24.32, tablet: 21.76, mobile: 19.2, weight: 700, line: 1.08, letter: -0.03 }, strong ? C.green : C.ink, { header_size: 'h3', _margin: sides(3.84, 0, 0, 0), ...align }),
      b.heading(term, tweak(MONO_CAPS, { size: 9.34, letter: 0.12 }), C.faint, { _margin: sides(4.35, 0, 0, 0), ...align }),
      b.text(copy, { family: F.text, size: 12.16, weight: 400, line: 1.62 }, C.soft, { ...maxw(343), _margin: sides(9.6, 0, 0, 0), ...align }),
    ], 0, { padding: sides(1.92, 0, 0, 0), css_classes: 'zl-fase-txt', ...(even ? { flex_align_items: 'flex-end', flex_align_items_mobile: 'flex-start' } : {}) })
    const wire = last ? [] : [b.image('fio.svg', '', { width: pct(100), _css_classes: 'zl-fio' })]
    return b.grid([seal, txt, ...wire], even ? 'minmax(0,1fr) 104px' : '104px minmax(0,1fr)', 25.6, {
      ...gaps(25.6, 21.6, 14.08), grid_align_items: 'start',
      css_classes: `zl-fase zl-fase--${even ? 'par' : 'impar'}${strong ? ' zl-fase--forte' : ''}`,
    }, { tablet: even ? 'minmax(0,1fr) 80px' : '80px minmax(0,1fr)', mobile: '56px minmax(0,1fr)' })
  })
  const root = b.root([
    b.rail('Como funciona'),
    title(b, 'Da conversa à primeira <span class="zl-verde">automação</span> rodando.'),
    lede(b, 'Quinze dias usando de graça antes de pagar qualquer coisa. Valor só entra na quarta fase, quando você já viu funcionando na sua empresa.'),
    b.col(phases, 56.32, { ...flexGaps(56.32, 44.8, 24.32), margin: sides(33.28, 0, 0, 0), css_classes: 'zl-fluxo' }),
  ], {
    id: 'processo',
    css: [
      'selector .zl-fase{position:relative}',
      `selector .zl-selo{position:relative;z-index:1;aspect-ratio:1;box-shadow:0 0 36px -16px ${C.green}}`,
      'selector .zl-selo-ico img{display:block}',
      'selector .zl-fase-txt{position:relative;z-index:1}',
      'selector .zl-fio{position:absolute!important;left:52px;right:52px;top:52px;bottom:-108.3px;width:auto!important;max-width:none!important;pointer-events:none;z-index:0}',
      'selector .zl-fio img{display:block;width:100%!important;height:100%!important;max-width:none}',
      'selector .zl-fase--par .zl-fio{transform:scaleX(-1)}',
      '@media (max-width:1024px){selector .zl-fio{left:40px;right:40px;top:40px;bottom:-84.8px}}',
      '@media (max-width:767px){selector .zl-fio{left:27px;right:auto;width:2px!important;top:28px;bottom:-52.3px}selector .zl-fase--par .zl-fio{transform:none}}',
      '@media (prefers-reduced-motion:no-preference){selector .zl-fase--forte .zl-selo{animation:zl-respira 3.6s ease-in-out infinite alternate}}',
      `@keyframes zl-respira{from{box-shadow:0 0 36px -16px ${C.green}}to{box-shadow:0 0 46px -10px ${C.green}}}`,
    ].join(''),
  })
  return b.section('Zelo · Como funciona', 'zelo-processo-native', root)
}

// ── dúvidas ─────────────────────────────────────────────────────────────────

const FAQ: Array<[string, string]> = [
  ['Isso serve pro meu tipo de negócio?', 'Se boa parte do seu dia vai embora respondendo a mesma pergunta, serve. Vale para clínica, escritório, loja ou prestador.'],
  ['Isso substitui meu funcionário?', 'Não é sobre demitir. É tirar a tarefa repetida da mão de quem podia estar atendendo ou vendendo. A equipe continua, fazendo o que exige julgamento.'],
  ['Vou ter que trocar os sistemas que já uso?', 'Não. A gente trabalha em cima do que já existe. Só sugerimos trocar se o sistema for mesmo o gargalo.'],
  ['E a informação da minha empresa, fica segura?', 'A automação usa só o que precisa, combinado por escrito. Sua informação não é vendida nem usada com outro cliente.'],
  ['Quanto custa?', 'Nada até o fim do teste. A conversa, a demo e os 15 dias de uso são grátis. Se fizer sentido seguir, aí vem a proposta: um valor fechado pelo projeto e uma mensalidade de manutenção, que mantém a automação rodando, ajustada quando algo muda no seu negócio e monitorada pra você. Tudo combinado antes, com transparência.'],
  ['Quanto tempo até eu ver diferença?', 'A demo fica pronta de 2 a 5 dias depois da conversa, e no teste de 15 dias você já usa de verdade. Começamos pelo gargalo que devolve mais tempo, não pelo mais bonito de mostrar.'],
]

const makeDuvidas = (): SectionNodeData => {
  const b = createBuilder('zfq')
  const accordion = b.widget('nested-accordion', {
    items: FAQ.map(([question], index) => ({ item_title: question, _id: `zfqi${index + 1}00`.slice(0, 7) })),
    default_state: 'all_collapsed',
    max_items_expended: 'multiple',
    n_accordion_animation_duration: { unit: 'ms', size: 350, sizes: [] },
    accordion_item_title_icon: { value: 'fas fa-plus', library: 'fa-solid' },
    accordion_item_title_icon_active: { value: 'fas fa-minus', library: 'fa-solid' },
    accordion_item_title_icon_position: 'start',
    accordion_item_title_position_horizontal: 'start',
    ...typography({ family: F.ui, size: 12.29, weight: 500, line: 1.62, letter: -0.012 }, 'title_typography'),
    normal_title_color: C.ink, hover_title_color: C.green, active_title_color: C.ink,
    normal_icon_color: C.green, hover_icon_color: C.green, active_icon_color: C.green,
    _css_classes: 'zl-faq',
  })
  accordion.elements = FAQ.map(([, answer]) => b.col([
    b.text(answer, T.body, C.soft, maxw(509)),
  ], 0, { padding: sides(0, 18.56, 15.36, 44.16), padding_mobile: sides(0, 13.44, 15.36, 39.04) }))
  const root = b.root([
    b.rail('Dúvidas'),
    b.grid([
      b.col([
        title(b, 'O que perguntam antes de começar.'),
        lede(b, 'As que mais aparecem na primeira conversa. Se a sua não estiver aqui, é só perguntar na conversa.'),
      ], 0),
      accordion,
    ], 'minmax(0,.95fr) minmax(0,1fr)', 43.52, { ...gaps(43.52, 28.8, 19.2), grid_align_items: 'start' }),
  ], {
    id: 'duvidas',
    css: [
      `selector .zl-faq .e-n-accordion{border:1px solid ${C.line};border-radius:16px;overflow:hidden;gap:0}`,
      `selector .zl-faq .e-n-accordion-item+.e-n-accordion-item{border-top:1px solid ${C.line}}`,
      'selector .zl-faq .e-n-accordion-item-title{border:0;border-radius:0;padding:16.64px 18.56px;gap:12.16px;justify-content:flex-start;background:transparent;cursor:pointer;transition:color .2s ease}',
      `selector .zl-faq .e-n-accordion-item-title:hover,selector .zl-faq .e-n-accordion-item-title:hover .e-n-accordion-item-title-text{color:${C.green}}`,
      `selector .zl-faq .e-n-accordion-item-title-icon{order:-1;flex:none;width:13.44px;justify-content:center;color:${C.green};font-family:"${F.mono}",ui-monospace,monospace;font-size:13.82px;line-height:1}`,
      'selector .zl-faq .e-n-accordion-item-title-icon i{font-size:10px}',
      'selector .zl-faq .e-n-accordion-item>.e-con{border:0}',
      '@media (max-width:767px){selector .zl-faq .e-n-accordion-item-title{padding:16.64px 13.44px}}',
    ].join(''),
  })
  return b.section('Zelo · Dúvidas', 'zelo-duvidas-native', root)
}

// ── contato (home e página) ─────────────────────────────────────────────────

interface FormSize { input: number; pad: [number, number]; textarea: number; button: 'wide' | 'form' }

const contactForm = (b: ZeloBuilder, label: string, size: FormSize) => {
  const fields: Array<[string, string, string, string, boolean]> = [
    ['nome', 'text', 'Seu nome', 'Como podemos te chamar', true],
    ['telefone', 'tel', 'WhatsApp', '(00) 00000-0000', true],
    ['empresa', 'text', 'Empresa', 'Nome da sua empresa', true],
    ['ramo', 'text', 'Ramo', 'Ex.: clínica de estética, contabilidade, loja', true],
    ['desafio', 'textarea', 'O que mais consome seu tempo hoje (opcional)', 'Ex.: passo o dia respondendo as mesmas coisas no WhatsApp e ainda tenho que confirmar os horários de amanhã', false],
  ]
  const button = size.button === 'form' ? { font: 12.8, pad: [13.44, 14.72] } : { font: 12.03, pad: [12.16, 14.72] }
  return b.widget('form', {
    form_name: 'Contato Zelo',
    form_fields: fields.map(([id, type, fieldLabel, placeholder, required]) => ({
      _id: id, custom_id: id, field_type: type, field_label: fieldLabel, placeholder, required: required ? 'true' : '', width: '100',
      ...(type === 'textarea' ? { rows: '4' } : {}),
    })),
    input_size: 'sm', show_labels: 'true', button_size: 'sm', button_width: '100', button_align: 'stretch', button_text: label,
    submit_actions: ['email'],
    email_subject: 'Novo contato pelo site da Zelo',
    success_message: 'Recebemos. A gente responde e marca a conversa.',
    error_message: 'Não foi possível enviar agora. Tente de novo ou fale pelo WhatsApp.',
    required_field_message: 'Este campo é obrigatório.',
    column_gap: px(0), row_gap: px(12.8), label_spacing: px(4.48),
    label_color: C.green, ...typography({ family: F.ui, size: size.input === 12.03 ? 10.5 : 11.39, weight: 700, line: 1.62, letter: -0.002 }, 'label_typography'),
    field_text_color: C.ink, ...typography({ family: F.text, size: size.input, weight: 400, line: 1.5 }, 'field_typography'),
    field_background_color: C.paper, field_border_color: C.lineStrong, field_border_width: sides(1), field_border_radius: sides(11),
    button_background_color: C.green, button_text_color: '#000000', button_background_hover_color: C.green2, button_hover_color: '#000000',
    ...typography({ family: F.ui, size: button.font, weight: 600, line: 1.62, letter: -0.005 }, 'button_typography'),
    button_border_radius: sides(999), button_text_padding: sides(button.pad[0], button.pad[1]),
    custom_css: [
      `selector .elementor-field-group .elementor-field-textual{padding:${size.pad[0]}px ${size.pad[1]}px;min-height:0;line-height:1.5;border-style:solid}`,
      `selector .elementor-field-group textarea.elementor-field-textual{min-height:${size.textarea}px;resize:vertical}`,
      'selector .elementor-field-textual::placeholder{color:rgba(168,168,168,.65)}',
      `selector .elementor-field-textual:focus{border-color:${C.green};outline:none;box-shadow:0 0 0 3px rgba(144,184,166,.22)}`,
      `selector .elementor-button{border:1px solid ${C.green};transition:background-color .16s ease,border-color .16s ease,transform .16s ease}`,
      `selector .elementor-button:hover{border-color:${C.green2};transform:translateY(-1px)}`,
      '@media (prefers-reduced-motion:reduce){selector .elementor-button:hover{transform:none}}',
    ].join(''),
  })
}

const privacyNote = (b: ZeloBuilder, fontSize = 10.75) => b.text(
  'Usamos estes dados só para responder você. <a href="/privacidade">Como tratamos seus dados</a>.',
  { family: F.text, size: fontSize, weight: 400, line: 1.45 }, C.soft, { align: 'center', link_color: C.green, _css_classes: 'zl-privacidade' },
)
const PRIVACY_CSS = 'selector .zl-privacidade a{text-decoration:underline;text-underline-offset:.2em}'

const makeContato = (): SectionNodeData => {
  const b = createBuilder('zco')
  const line = (label: string, value: string, url: string) => b.col([
    b.heading(label, T.rot, C.green),
    b.heading(value, { family: F.text, size: 12.29, weight: 400, line: 1.62 }, C.ink, { link: link(url, url.startsWith('http')), title_hover_color: C.green, _css_classes: 'zl-tabular' }),
  ], 1.5)
  const formCard = b.col([
    contactForm(b, 'Enviar e agendar a conversa', { input: 12.03, pad: [8.7, 10.24], textarea: 86, button: 'wide' }),
    b.text('A gente responde e marca a conversa.', { family: F.text, size: 10.88, weight: 400, line: 1.62 }, C.soft, { align: 'center' }),
    privacyNote(b),
  ], 12.8, { padding: sides(23.04), padding_tablet: sides(21.6), padding_mobile: sides(16.64), ...card(21), css_classes: 'zl-ficha' })
  const root = b.root([
    b.rail('Contato'),
    title(b, 'Comece contando o que mais te consome <span class="zl-verde">tempo</span>.'),
    b.grid([
      b.col([
        b.text('Não precisa preparar nada. Conte como é o seu dia que a gente acha o gargalo.', T.lede, C.soft, maxw(575)),
        b.col([line('WhatsApp', ZELO_CONTACT.whatsappLabel, WA_SITE), line('E-mail', ZELO_CONTACT.email, MAILTO)], 11.52, { margin: sides(20.48, 0, 0, 0) }),
      ], 0),
      formCard,
    ], 'minmax(0,.85fr) minmax(0,1fr)', 38.4, { ...gaps(38.4, 28.8, 19.2), grid_align_items: 'start', margin: sides(28.16, 0, 0, 0) }),
  ], {
    id: 'contato',
    css: [SHADOW_CSS('zl-ficha'), PRIVACY_CSS, 'selector .zl-tabular .elementor-heading-title{font-variant-numeric:tabular-nums}'].join(''),
  })
  return b.section('Zelo · Contato', 'zelo-contato-native', root)
}

// ── rodapés ─────────────────────────────────────────────────────────────────

const footLink = (b: ZeloBuilder, label: string, url: string) => b.heading(label, { family: F.text, size: 10.88, weight: 400, line: 1.62 }, C.soft, {
  link: link(url, url.startsWith('http')), title_hover_color: C.green,
})

const makeFooter = (): SectionNodeData => {
  const b = createBuilder('zft')
  const column = (heading: string, links: Array<[string, string]>) => b.col([
    b.heading(heading, SMALL_UI, C.ink, { _margin: sides(0, 0, 2.56, 0) }),
    ...links.map(([label, url]) => footLink(b, label, url)),
  ], 7.04)
  const main = b.grid([
    b.col([
      b.image('zelo-wordmark.png', 'Zelo, início', { width: px(83), _element_width: 'auto', link_to: 'custom', link: link('#topo'), _css_classes: 'zl-logo' }),
      b.text('Consultoria de automação e IA em Novo Hamburgo, no Rio Grande do Sul. Atendemos a região presencialmente e o resto do Brasil de forma remota.', { family: F.text, size: 10.88, weight: 400, line: 1.55 }, C.soft, {
        ...maxw(293), _margin: sides(12.8, 0, 0, 0),
      }),
      b.row(['Conversa e demo grátis', '15 dias de teste grátis', 'Valor só depois do teste'].map((label) => b.pill(label, { family: F.ui, size: 9.98, weight: 700, line: 1.62, letter: -0.002 }, C.green, {
        _padding: sides(3.58, 6.4), _border_color: C.line,
      })), 5.12, { flex_wrap: 'wrap', margin: sides(15.36, 0, 0, 0) }),
    ], 0, { flex_align_items: 'flex-start' }),
    b.grid([
      column('O que fazemos', [['Automação de processos', '#servicos'], ['Agente de IA', '#agente'], ['Site para o seu negócio', '#site'], ['Agendar uma conversa', '/contato']]),
      column('Entender antes', [['A conta do seu tempo', '#conta'], ['Como funciona', '#processo']]),
      column('Falar com a gente', [[ZELO_CONTACT.whatsappLabel, WA_SITE], [ZELO_CONTACT.email, MAILTO], ['Privacidade e dados', '/privacidade']]),
    ], 'repeat(3,minmax(0,1fr))', 25.6, { ...gaps(25.6, 21.6, 15.36) }, { mobile: 'repeat(2,minmax(0,1fr))' }),
  ], 'minmax(0,2fr) minmax(0,3fr)', 51.2, {
    ...gaps(51.2, 36, 23.04), padding: sides(43.52, 0), padding_tablet: sides(36, 0), padding_mobile: sides(30.72, 0),
  }, { tablet: 'minmax(0,2fr) minmax(0,3fr)', mobile: '1fr' })
  const base = b.row([
    b.heading('© 2026 Zelo. Automação e IA sob medida.', { family: F.text, size: 10.5, weight: 400, line: 1.62 }, C.soft, FIXED),
    b.heading('Novo Hamburgo, RS', SMALL_UI, C.green, FIXED),
  ], 10.24, { flex_justify_content: 'space-between', flex_wrap: 'wrap', padding: sides(14.08, 0, 17.92, 0), ...border(C.line, sides(1, 0, 0, 0)) })
  const root = b.root([main, base], {
    tag: 'footer', pad: false,
    settings: {
      ...bg(C.raised), ...border(C.line, sides(1, 0, 0, 0)),
      padding: sides(0, 38, 58.88, 38), padding_tablet: sides(0, 29, 43.2, 29), padding_mobile: sides(0, 15, 40.96, 15),
    },
    css: 'selector .zl-logo{transition:opacity .18s ease}selector .zl-logo:hover{opacity:.72}',
  })
  return b.section('Zelo · Rodapé', 'zelo-rodape-native', root)
}

const makeFooterShort = (page: 'contato' | 'legal', prefix: string): SectionNodeData => {
  const b = createBuilder(prefix)
  const links: Array<[string, string]> = page === 'contato'
    ? [['Serviços', '/#servicos'], ['Agente de IA', '/#agente'], ['Privacidade e dados', '/privacidade']]
    : [['Serviços', '/#servicos'], ['Agente de IA', '/#agente'], ['Contato', '/#contato']]
  const root = b.root([
    b.image('zelo-wordmark.png', 'Zelo, início', { width: px(83), align: 'center', link_to: 'custom', link: link('/'), _css_classes: 'zl-logo' }),
    b.row(links.map(([label, url]) => footLink(b, label, url)), 21.76, { flex_justify_content: 'center', flex_wrap: 'wrap', flex_gap: gap(7.04, 21.76) }),
    b.heading('© 2026 Zelo. Automação e IA sob medida.', { family: F.text, size: 10.88, weight: 400, line: 1.62 }, C.soft, { align: 'center' }),
  ], {
    tag: 'footer', pad: [43.52, 36, 30.72], space: 19.2,
    settings: { ...bg(C.raised), ...border(C.line, sides(1, 0, 0, 0)), flex_align_items: 'center' },
    css: 'selector .zl-logo{transition:opacity .18s ease}selector .zl-logo:hover{opacity:.72}',
  })
  return b.section(`Zelo · Rodapé (${page === 'contato' ? 'contato' : 'privacidade'})`, `zelo-rodape-${page}-native`, root)
}

// ── página de contato ───────────────────────────────────────────────────────

const makeAgenda = (): SectionNodeData => {
  const b = createBuilder('kag')
  const promise = (icon: string, copy: string) => b.grid([
    b.icon(icon, 14, { _margin: sides(2.82, 0, 0, 0) }),
    b.text(copy, { family: F.text, size: 11.78, weight: 400, line: 1.45 }, C.soft),
  ], '15px minmax(0,1fr)', 9.6, { grid_align_items: 'start' }, { mobile: '15px minmax(0,1fr)' })
  const invite = b.col([
    b.rail('Contato'),
    title(b, 'Agende uma reunião para a gente entender como o seu <span class="zl-verde">negócio</span> funciona.', 'h1', { _margin: sides(3.84, 0, 0, 0) }),
    lede(b, 'É a primeira das quatro fases: uma hora de conversa, sem slide e sem compromisso. Você conta como é o seu dia, e a gente entende onde o tempo está indo e o que vale automatizar primeiro.', maxw(408)),
    b.row([
      b.button('Falar pelo WhatsApp', WA_SITE, 'fill', 'md', FIXED),
      b.button('Enviar e-mail', MAILTO, 'ghost', 'md', FIXED),
    ], 8.96, { flex_wrap: 'wrap', margin: sides(24.32, 0, 0, 0) }),
    b.col([
      promise('relogio', 'A gente responde no mesmo dia útil e marca no horário que servir para você.'),
      promise('check', 'Conversa, demo e 15 dias de teste, tudo grátis. Proposta só depois do teste, se fizer sentido pra você.'),
      promise('cadeado', 'Seus dados servem só para esta conversa. Sem lista de e-mail e sem repasse.'),
    ], 10.24, { padding: sides(17.28, 0, 0, 0), margin: sides(28.16, 0, 0, 0), ...border(C.line, sides(1, 0, 0, 0)) }),
  ], 0)
  const form = b.col([
    b.row([
      b.heading('Conte sobre a sua operação', { family: F.ui, size: 13.57, weight: 600, line: 1.62, letter: -0.015 }, C.ink, FILL),
      b.heading('Grátis', T.rot, C.green, FIXED),
    ], 12.8, { flex_justify_content: 'space-between', flex_align_items: 'baseline', padding: sides(14.72, 17.28), ...border(C.lineStrong, sides(0, 0, 1, 0)) }),
    b.col([
      contactForm(b, 'Agendar minha conversa', { input: 13.06, pad: [10.5, 12.16], textarea: 108, button: 'form' }),
      privacyNote(b, 11.14),
    ], 13.44, { padding: sides(19.2, 17.28, 21.12, 17.28) }),
  ], 0, { ...card(21), overflow: 'hidden', _element_id: 'formulario', css_classes: 'zl-ficha' })
  const root = b.root([
    b.grid([invite, form], 'minmax(0,.92fr) minmax(0,1fr)', 48.64, { ...gaps(48.64, 32, 23.04), grid_align_items: 'start' }),
  ], {
    pad: false,
    settings: {
      padding: sides(37.12, 38, 71.68, 38), padding_tablet: sides(32, 29, 56, 29), padding_mobile: sides(20.48, 15, 38.4, 15),
    },
    css: [SHADOW_CSS('zl-ficha'), PRIVACY_CSS, BUTTON_CSS].join(''),
  })
  return b.section('Zelo · Agende uma reunião', 'zelo-agenda-native', root)
}

// ── política de privacidade ─────────────────────────────────────────────────

const LEGAL: Array<[string, string]> = [
  ['Quem é o controlador', `<p>A Zelo, de Novo Hamburgo, no Rio Grande do Sul, é quem decide o que é feito com os dados descritos nesta página.</p><p>Para qualquer assunto de privacidade, incluindo os pedidos descritos abaixo, escreva para <a href="${MAILTO}">${ZELO_CONTACT.email}</a>. Respondemos pelo mesmo e-mail.</p>`],
  ['O que coletamos', '<p>Só o que o formulário pede, e nada além:</p><ul><li><strong>Nome</strong>, para saber como chamar você.</li><li><strong>WhatsApp</strong>, porque é por onde respondemos.</li><li><strong>Empresa e ramo</strong>, para entender o contexto antes da conversa.</li><li><strong>Descrição do seu desafio</strong>, quando você escolhe escrever. É opcional.</li></ul><p>Junto com o envio, o servidor guarda a <strong>data e hora</strong> e um <strong>código derivado do seu endereço de IP</strong>. Esse código é um hash com segredo: serve para limitar abuso e registrar auditoria, e não permite recuperar o IP original.</p><p>Se você conversar com a Zelo IA, a mensagem é enviada ao provedor do modelo para gerar a resposta. <strong>Não guardamos o teor da conversa.</strong> O registro do servidor anota apenas quantos turnos houve e o consumo, nunca o que foi dito.</p>'],
  ['Para que usamos', '<ul><li>Responder seu pedido de conversa e conduzir a relação comercial que vem dele.</li><li>Proteger o site contra envio automatizado e abuso.</li><li>Cumprir obrigações legais quando existirem.</li></ul><p>A base legal é o <strong>procedimento preliminar de contrato a seu pedido</strong> (art. 7º, V da LGPD) e, para as medidas de segurança, o <strong>legítimo interesse</strong> (art. 7º, IX).</p>'],
  ['O que não fazemos', '<ul><li><strong>Não vendemos nem alugamos</strong> seus dados para ninguém.</li><li><strong>Não te colocamos em lista de e-mail</strong> nem disparamos marketing.</li><li><strong>Não usamos cookie de rastreamento</strong>, pixel de rede social ou analytics de terceiros. A única coisa guardada no seu navegador é a sua escolha de tema claro ou escuro.</li></ul>'],
  ['Com quem compartilhamos', '<p>Apenas com os serviços necessários para o site funcionar, e cada um recebe só o que precisa:</p><ul><li><strong>Cloudflare</strong>, que entrega o site, filtra abuso e faz a verificação anti-robô do formulário.</li><li><strong>Provedor do servidor</strong>, onde a aplicação e o banco de dados rodam.</li><li><strong>Groq</strong>, que processa as mensagens da Zelo IA para gerar a resposta.</li><li><strong>O canal por onde somos avisados de um contato novo</strong>, que recebe os dados do formulário assim que você envia.</li></ul><p>Alguns desses serviços operam fora do Brasil, o que implica transferência internacional de dados nos termos do art. 33 da LGPD.</p>'],
  ['Por quanto tempo guardamos', '<ul><li><strong>Contatos:</strong> até 12 meses após o último retorno seu, quando a conversa não vira contratação. Se virar, o prazo passa a ser o da relação contratual e o das obrigações legais que ela cria.</li><li><strong>Registros de acesso do servidor:</strong> de 14 a 30 dias.</li><li><strong>Registros de auditoria do painel interno:</strong> pelo prazo legal aplicável.</li></ul>'],
  ['Seus direitos', `<p>A LGPD garante que você peça, a qualquer momento e sem custo: confirmação de que tratamos seus dados, acesso a eles, correção do que estiver errado, anonimização ou <strong>eliminação</strong>, portabilidade, e informação sobre com quem compartilhamos.</p><p>Para exercer qualquer um deles, escreva para <a href="${MAILTO}">${ZELO_CONTACT.email}</a>. Respondemos em até 15 dias. Podemos pedir uma confirmação de identidade antes de agir, justamente para não entregar seus dados a outra pessoa.</p>`],
  ['Segurança', '<p>A conexão com o site é sempre criptografada. O banco de dados não é acessível pela internet. O painel onde os contatos aparecem exige autenticação e fica registrado em auditoria: toda leitura de lista, mudança de status e exportação é anotada com o responsável.</p><p>Nenhuma medida elimina o risco por completo. Se acontecer um incidente com risco relevante a você, comunicamos você e a ANPD, como manda o art. 48 da LGPD.</p>'],
  ['Mudanças nesta política', '<p>Se algo mudar, atualizamos esta página e a data no topo. Vale sempre a versão publicada aqui.</p>'],
]

const makeLegal = (): SectionNodeData => {
  const b = createBuilder('plg')
  const blocks = LEGAL.flatMap(([heading, html]) => [
    b.heading(heading, { family: F.ui, size: 14.46, weight: 800, line: 1.16, letter: -0.032 }, C.ink, {
      header_size: 'h2', _margin: sides(33.28, 0, 0, 0), _padding: sides(17.92, 0, 0, 0),
      _border_border: 'solid', _border_width: sides(1, 0, 0, 0), _border_color: C.line,
    }),
    b.text(html, T.body, C.soft, { link_color: C.green, _margin: sides(14.08, 0, 0, 0), _css_classes: 'zl-legal-texto' }),
  ])
  const article = b.col([
    b.heading('Atualizada em 8 de setembro de 2026', T.rot, C.green),
    b.heading('Política de Privacidade', { family: F.ui, size: 'clamp(20.48px, 2.48vw, 28.8px)', weight: 800, line: 1.16, letter: -0.032 }, C.ink, { header_size: 'h1', _margin: sides(14.08, 0, 0, 0) }),
    b.text('<p>Esta página explica o que a Zelo faz com os dados pessoais que você nos entrega pelo site, em linguagem direta e sem letra miúda. Ela vale para <strong>zelosistemas.com.br</strong> e para o formulário de contato.</p>', T.body, C.soft, { _margin: sides(14.08, 0, 0, 0), _css_classes: 'zl-legal-texto' }),
    ...blocks,
  ], 0, { width: px(509), width_tablet: px(509) })
  const root = b.root([article], {
    pad: false,
    settings: {
      flex_align_items: 'center',
      padding: sides(64, 38, 76.8, 38), padding_tablet: sides(48, 29, 57.6, 29), padding_mobile: sides(32, 15, 38.4, 15),
    },
    css: [
      'selector .zl-legal-texto p,selector .zl-legal-texto ul{margin:0}',
      'selector .zl-legal-texto p+p,selector .zl-legal-texto p+ul,selector .zl-legal-texto ul+p,selector .zl-legal-texto ul+ul{margin-top:14.08px}',
      'selector .zl-legal-texto ul{padding-left:14.72px}',
      'selector .zl-legal-texto li+li{margin-top:4.48px}',
      `selector .zl-legal-texto strong{color:${C.ink};font-weight:600}`,
      'selector .zl-legal-texto a{text-decoration:underline;text-underline-offset:.2em;overflow-wrap:anywhere}',
    ].join(''),
  })
  return b.section('Zelo · Política de privacidade', 'zelo-privacidade-native', root)
}

// ── registro ────────────────────────────────────────────────────────────────

const template = (id: string, name: string, description: string, sections: SectionNodeData[]): LandingTemplate => ({
  id, name, description, audience: 'Consultoria de automação e IA', componentIds: sections.map((section) => section.sourceId!), sections,
})

export const createZeloHomeTemplate = () => template('zelo-home', 'Zelo · página inicial',
  'Site escuro de consultoria de IA: hero, calculadora de horas, cinco operações, agente, processo, FAQ e formulário, em containers e widgets nativos.',
  [makeNav('home', 'zna'), makeHero(), makeMovimento(), makeProblema(), makeConta(), makeServicos(), makeAgente(), makeSite(), makeProcesso(), makeDuvidas(), makeContato(), makeFooter()])

export const createZeloContatoTemplate = () => template('zelo-contato', 'Zelo · contato',
  'Página de agendamento com convite, compromissos e formulário nativo do Elementor.',
  [makeNav('contato', 'kna'), makeAgenda(), makeFooterShort('contato', 'kft')])

export const createZeloPrivacidadeTemplate = () => template('zelo-privacidade', 'Zelo · privacidade',
  'Política de privacidade em uma coluna de leitura, com títulos e listas editáveis.',
  [makeNav('legal', 'pna'), makeLegal(), makeFooterShort('legal', 'pft')])

export const createZeloTemplates = (): LandingTemplate[] => [createZeloHomeTemplate(), createZeloContatoTemplate(), createZeloPrivacidadeTemplate()]
