/**
 * Simulador de compra da nova versão da LS: quatro telas (produto, entrada,
 * cartão, parcelas) numa seção só. Nas páginas (classe ls-sim-dock) ele abre
 * num painel lateral, vindo da direita, por qualquer link para #simulador; se o
 * link está dentro de um produto (.ls-sim-ctx, ou o .ls-sim-ctx-page da página
 * de produto), o painel abre com esse produto escolhido. Na página Simulador
 * ele fica na página.
 * Todo o conteúdo é nativo (cartões, formulário, botões e as 18 parcelas); o
 * widget HTML só tem o comportamento. Sem script, no editor do Elementor ou com
 * o CSS sozinho, as quatro telas aparecem uma embaixo da outra, com o exemplo
 * calculado na montagem.
 *
 * As taxas são as do simulador do site (leoscherer.com.br/simulate.php, lidas
 * em 2026-10-03): o total é o valor dividido por (1 − taxa), até 6x sem juros,
 * de 1x a 18x. A parcela é o total dividido pelo número de vezes.
 */

export type CardBrand = 'master' | 'elo'

/** Taxa de cada parcela (1x a 18x), em %. */
export const LS_RATES: Record<CardBrand, number[]> = {
  master: [0, 0, 0, 0, 0, 0, 7.49, 8.12, 8.75, 9.38, 10, 10.61, 12.02, 12.62, 13.22, 13.81, 14.4, 14.98],
  elo: [0, 0, 0, 0, 0, 0, 9.29, 9.92, 10.55, 11.18, 11.8, 12.41, 13.02, 13.62, 14.22, 14.81, 15.4, 15.98],
}

export const CARD_LABEL: Record<CardBrand, string> = { master: 'Visa ou Mastercard', elo: 'Elo, AMEX ou Hiper' }

/**
 * WhatsApp da LS para fechar a compra (só números, com DDI e DDD: 55 51 9…). Vazio enquanto o
 * número não for confirmado: o link abre o WhatsApp com a mensagem pronta para escolher o contato.
 */
export const LS_WHATSAPP = ''
export const whatsappUrl = (number = LS_WHATSAPP) => `https://wa.me/${number.replace(/\D/g, '')}`

/** Vezes sem juros (as mesmas nas duas bandeiras). */
export const FREE_UP_TO = 6

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

/** "R$ 1.234,56", sem depender do Intl de quem monta. */
export const brl = (value: number) => {
  const [int, cents] = round(value).toFixed(2).split('.')
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents}`
}

export const installments = (value: number, card: CardBrand) =>
  LS_RATES[card].map((rate, i) => {
    const total = value / (1 - rate / 100)
    return { times: i + 1, total: round(total), parcel: round(total / (i + 1)), free: rate === 0 }
  })

/** CSS da seção (vai no custom_css da raiz, depois do BASE_CSS). */
export const SIMULATOR_CSS = (c: { white: string; black: string; line: string; lineStrong: string; gray: string; soft: string; mist: string }) => [
  // sem script: as telas em sequência, sem a navegação
  'selector .ls-sim-nav{display:none!important}',
  'selector .ls-sim-stage{scroll-margin-top:88px}',
  // o widget do script não ocupa lugar no fluxo (nem o gap da raiz)
  'selector>.e-con-inner>.ls-behavior,selector>.ls-behavior{position:absolute!important;width:0;height:0;overflow:hidden}',
  'selector .ls-sim-panel+.ls-sim-panel{margin-top:56px;padding-top:56px;border-top:1px solid ' + c.line + '}',
  'selector.ls-sim-on .ls-sim-panel+.ls-sim-panel{margin-top:0;padding-top:0;border-top:0}',
  'selector.ls-sim-on .ls-sim-panel:not(.is-active){display:none!important}',
  'selector.ls-sim-on .ls-sim-nav{display:flex!important}',
  'selector.ls-sim-on .ls-sim-entry.is-off{display:none!important}',
  'selector .ls-sim-hint{display:none}selector .ls-sim-hint.is-on{display:block}',
  'selector .ls-sim-r-big .ls-sim-lines{margin-top:10px;border-top:1px solid ' + c.line + '}',
  'selector .ls-sim-wa .elementor-button{background-color:#25D366!important;border-color:#25D366!important;color:#04170B!important;font-weight:700!important}',
  'selector .ls-sim-wa .elementor-button:hover,selector .ls-sim-wa .elementor-button:focus-visible{background-color:#1FBF5B!important;border-color:#1FBF5B!important;color:#04170B!important}',
  'selector .ls-sim-wa .elementor-button .elementor-button-icon i{font-size:1.15em}',
  // na última tela o rodapé troca o Continuar pelo Fechar no WhatsApp
  'selector .ls-sim-nav .ls-sim-wa{display:none!important}selector.ls-sim-on.ls-sim-last .ls-sim-nav .ls-sim-wa{display:block!important}selector.ls-sim-on.ls-sim-last .ls-sim-next{display:none!important}',
  'selector.ls-sim-on.ls-sim-first .ls-sim-back{visibility:hidden}',
  // passos no alto: o ativo em branco, os feitos com o traço cheio
  `selector .ls-sim-tab{position:relative;padding-top:16px;border-top:2px solid ${c.line};transition:border-color .3s}`,
  `selector .ls-sim-tab .elementor-heading-title{transition:color .3s}`,
  `selector.ls-sim-on .ls-sim-tab:not(.is-active):not(.is-done) .elementor-heading-title{color:${c.gray}!important;opacity:.6}`,
  `selector .ls-sim-tab.is-active,selector .ls-sim-tab.is-done{border-top-color:${c.white}}`,
  'selector .ls-sim-tab.is-done{cursor:pointer}',
  `@media(hover:hover){selector .ls-sim-tab.is-done:hover .elementor-heading-title{color:${c.soft}!important}}`,
  // cartões de escolha
  `selector .ls-sim-opt{position:relative;cursor:pointer;border:1px solid ${c.line};transition:border-color .18s,background-color .18s,box-shadow .18s;-webkit-tap-highlight-color:transparent}`,
  `@media(hover:hover){selector .ls-sim-opt:hover{border-color:${c.lineStrong}}}`,
  `selector .ls-sim-opt[aria-checked="true"]{border-color:${c.white};background-color:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px ${c.white}}`,
  `selector .ls-sim-opt::after{content:"";position:absolute;top:14px;right:14px;width:20px;height:20px;border-radius:50%;border:1.5px solid ${c.lineStrong};transition:background-color .18s,border-color .18s}`,
  `selector .ls-sim-opt[aria-checked="true"]::after{border-color:${c.white};background:${c.white} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5.5 10.5l3 3 6-7' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/100% no-repeat}`,
  `selector .ls-sim-opt:focus-visible{outline:2px solid ${c.white};outline-offset:3px}`,
  `selector .ls-sim-thumb{background:${c.mist};flex:none}selector .ls-sim-thumb img{mix-blend-mode:multiply;width:100%;aspect-ratio:1/1;object-fit:contain}`,
  // parcelas: a escolhida inverte (branco com texto preto)
  `selector .ls-sim-x{cursor:pointer;border:1px solid ${c.line};transition:border-color .18s,background-color .18s;-webkit-tap-highlight-color:transparent}`,
  `@media(hover:hover){selector .ls-sim-x:hover{border-color:${c.lineStrong}}}`,
  `selector .ls-sim-x[aria-checked="true"]{background-color:${c.white};border-color:${c.white}}`,
  `selector .ls-sim-x[aria-checked="true"] .elementor-heading-title{color:${c.black}!important}`,
  `selector .ls-sim-x:focus-visible{outline:2px solid ${c.white};outline-offset:3px}`,
  `selector .ls-sim-free{padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.1);align-self:flex-start}`,
  `selector .ls-sim-x[aria-checked="true"] .ls-sim-free{background:rgba(0,0,0,.08)}`,
  // campos do formulário nativo (valor e entrada)
  'selector .ls-sim-form .e-form__buttons,selector .ls-sim-form .elementor-field-type-submit{display:none!important}',
  'selector .ls-sim-form .elementor-form-fields-wrapper{margin:0!important}selector .ls-sim-form .elementor-field-group{margin:0!important;padding:0!important}',
  `selector .ls-sim-form input.elementor-field{height:56px;padding:0 18px;border-radius:14px!important;background:rgba(255,255,255,.06)!important;border:1px solid ${c.lineStrong}!important;color:${c.white}!important;font:600 20px/1 Helvetica,Arial,sans-serif;letter-spacing:-.01em;width:100%}`,
  `selector .ls-sim-form input.elementor-field::placeholder{color:${c.gray};opacity:1}`,
  `selector .ls-sim-form input.elementor-field:focus{outline:2px solid ${c.white};outline-offset:2px;border-color:${c.white}!important}`,
  `selector .ls-sim-form label.elementor-field-label{color:${c.gray};font:600 12px/1.3 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;padding-bottom:10px}`,
  // a troca é um interruptor
  `selector .ls-sim-switch{width:44px;height:26px;border-radius:999px;background:rgba(255,255,255,.16);position:relative;flex:none;transition:background-color .2s}`,
  `selector .ls-sim-switch::before{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:${c.white};transition:transform .25s cubic-bezier(.2,.7,.2,1)}`,
  'selector .ls-sim-troca[aria-checked="true"] .ls-sim-switch{background:#34C759}selector .ls-sim-troca[aria-checked="true"] .ls-sim-switch::before{transform:translateX(18px)}',
  'selector .ls-sim-troca::after{display:none}',
  // entrada das telas: curta, no sentido do passo (troca de tela é frequente: pouco movimento)
  '@keyframes ls-sim-in{from{opacity:0;transform:translate3d(var(--ls-sim-from,12px),0,0)}to{opacity:1;transform:none}}',
  '@media(prefers-reduced-motion:no-preference){selector.ls-sim-on .ls-sim-panel.is-active{animation:ls-sim-in .32s cubic-bezier(.2,.7,.2,1) both}}',
  'selector.ls-sim-back-dir{--ls-sim-from:-12px}',
  '@media(max-width:767px){selector .ls-sim-outro{grid-column:1/-1}selector .ls-sim-opt::after{top:10px;right:10px;width:18px;height:18px}}',
  // painel lateral (o script põe ls-sim-drawer; sem ele a seção fica na página, antes do rodapé).
  // Compacto: cabeçalho de uma linha, passos sem número, produtos em lista, Continuar na largura do rodapé.
  'selector .ls-sim-close{display:none!important}',
  `selector.ls-sim-drawer{--ls-sim-pad:24px;position:fixed!important;top:0;right:0;bottom:0;left:auto;width:min(480px,100vw)!important;max-width:none!important;height:100vh;height:100dvh;margin:0!important;padding:0 var(--ls-sim-pad)!important;z-index:2147483000;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain;background:#0A0A0B!important;border-left:1px solid ${c.line};box-shadow:-24px 0 80px rgba(0,0,0,.5);transform:translate3d(104%,0,0);visibility:hidden;transition:transform .5s cubic-bezier(.2,.7,.2,1),visibility 0s linear .5s}`,
  'selector.ls-sim-drawer.is-open{transform:none;visibility:visible;transition:transform .5s cubic-bezier(.2,.7,.2,1),visibility 0s}',
  '@media(max-width:600px){selector.ls-sim-drawer{--ls-sim-pad:16px;border-left:0}}',
  '@media(prefers-reduced-motion:reduce){selector.ls-sim-drawer{transition:none!important}}',
  // no celular o Elementor deixa o container quebrar linha: com a altura do painel, as partes iriam para o lado
  'selector.ls-sim-drawer,selector.ls-sim-drawer>.e-con-inner,selector.ls-sim-drawer .ls-sim-stage{flex-wrap:nowrap!important}',
  'selector.ls-sim-drawer>.e-con-inner{max-width:none!important;padding:0!important;gap:0!important;height:auto!important;min-height:100%;flex-shrink:0}',
  'selector.ls-sim-drawer .ls-bg,selector.ls-sim-drawer .ls-sim-stats,selector.ls-sim-drawer .ls-sim-lede,selector.ls-sim-drawer .ls-sim-eyebrow,selector.ls-sim-drawer .ls-sim-step{display:none!important}',
  // cabeçalho: título e o × redondo numa linha (o !important vence o position:relative do BASE_CSS nos filhos da raiz)
  `selector.ls-sim-drawer .ls-sim-head{position:sticky!important;top:0;z-index:6!important;align-items:center!important;width:calc(100% + 2 * var(--ls-sim-pad))!important;max-width:none;margin:0 calc(-1 * var(--ls-sim-pad));padding:14px 14px 14px var(--ls-sim-pad)!important;gap:12px!important;background:rgba(10,10,11,.94);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:1px solid ${c.line}}`,
  'selector.ls-sim-drawer .ls-sim-head>.e-con:first-child{gap:0!important}',
  'selector.ls-sim-drawer .ls-sim-heading .elementor-heading-title{font-size:19px!important;font-weight:600!important;line-height:1.2!important;letter-spacing:-.02em!important}',
  'selector.ls-sim-drawer .ls-sim-close{display:block!important;flex:none}',
  'selector.ls-sim-drawer .ls-sim-close .elementor-button{width:36px;height:36px;min-height:36px!important;padding:0!important;border-radius:50%!important}',
  'selector.ls-sim-drawer .ls-sim-close .elementor-button-text{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
  'selector.ls-sim-drawer .ls-sim-close .elementor-button-icon{margin:0!important}',
  // palco sem moldura; passos finos, só o nome
  'selector.ls-sim-drawer .ls-sim-stage{flex:1 0 auto!important;border:0!important;background:none!important;padding:18px 0 0!important;border-radius:0!important;box-shadow:none!important;gap:22px!important}',
  'selector.ls-sim-drawer .ls-sim-tabs{gap:6px!important}selector.ls-sim-drawer .ls-sim-tab{padding-top:9px;gap:0!important}',
  'selector.ls-sim-drawer .ls-sim-tab .elementor-widget-heading:first-child{display:none}',
  'selector.ls-sim-drawer .ls-sim-tab .elementor-heading-title{font-size:12px!important;font-weight:500!important}',
  'selector.ls-sim-drawer .ls-sim-panel{gap:16px!important}selector.ls-sim-drawer .ls-sim-panel>.e-con:first-child{gap:4px!important}',
  'selector.ls-sim-drawer .ls-sim-title .elementor-heading-title{font-size:22px!important;line-height:1.15!important;letter-spacing:-.025em!important}',
  'selector.ls-sim-drawer .ls-sim-panel>.e-con:first-child .elementor-widget-text-editor{font-size:14px!important;line-height:1.45!important}',
  // produtos em lista: foto, nome e capacidade à esquerda, preço e condição à direita
  'selector.ls-sim-drawer .ls-sim-g-produto{grid-template-columns:1fr!important;gap:8px!important}selector.ls-sim-drawer .ls-sim-outro{grid-column:auto}',
  'selector.ls-sim-drawer .ls-sim-prod{flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;gap:12px!important;padding:10px 44px 10px 10px!important;border-radius:18px!important}',
  'selector.ls-sim-drawer .ls-sim-thumb{flex:none!important;width:44px!important;height:44px!important;padding:4px!important;border-radius:8px!important}',
  'selector.ls-sim-drawer .ls-sim-prod>.e-con:last-child{display:grid!important;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name price" "spec tag";column-gap:12px;row-gap:1px;align-items:baseline;flex:1 1 auto;width:auto!important;min-width:0}',
  'selector.ls-sim-drawer .ls-sim-prod .ls-sim-name{grid-area:name}selector.ls-sim-drawer .ls-sim-prod .ls-sim-spec{grid-area:spec}',
  'selector.ls-sim-drawer .ls-sim-prod .ls-sim-price{grid-area:price;text-align:right}selector.ls-sim-drawer .ls-sim-prod .ls-sim-tag{grid-area:tag;text-align:right}',
  'selector.ls-sim-drawer .ls-sim-prod .ls-sim-name .elementor-heading-title{font-size:15px!important;font-weight:600!important}',
  'selector.ls-sim-drawer .ls-sim-prod .ls-sim-spec .elementor-heading-title,selector.ls-sim-drawer .ls-sim-prod .ls-sim-tag .elementor-heading-title{font-size:12px!important}',
  'selector.ls-sim-drawer .ls-sim-prod .ls-sim-price .elementor-heading-title{font-size:15px!important;font-variant-numeric:tabular-nums}',
  'selector.ls-sim-drawer .ls-sim-opt::after{top:50%;margin-top:-10px;right:14px}',
  'selector.ls-sim-drawer .ls-sim-outro{padding:14px 44px 14px 14px!important;border-radius:18px!important;gap:6px!important}selector.ls-sim-drawer .ls-sim-outro::after{top:16px;margin-top:0}',
  'selector.ls-sim-drawer .ls-sim-form input.elementor-field{height:48px;font-size:18px}',
  // entrada, troca e cartão: cartões baixos
  'selector.ls-sim-drawer .ls-sim-g-entrada,selector.ls-sim-drawer .ls-sim-g-cartao{gap:8px!important}',
  'selector.ls-sim-drawer .ls-sim-sem,selector.ls-sim-drawer .ls-sim-com,selector.ls-sim-drawer .ls-sim-master,selector.ls-sim-drawer .ls-sim-elo{padding:14px 40px 14px 14px!important;border-radius:16px!important;gap:3px!important}',
  'selector.ls-sim-drawer .ls-sim-g-entrada .ls-sim-name .elementor-heading-title,selector.ls-sim-drawer .ls-sim-g-cartao .ls-sim-name .elementor-heading-title{font-size:16px!important}',
  'selector.ls-sim-drawer .ls-sim-g-cartao .ls-sim-opt>.e-con:first-child{display:none!important}',
  'selector.ls-sim-drawer .ls-sim-entry{max-width:none}',
  'selector.ls-sim-drawer .ls-sim-troca{padding:14px!important;border-radius:16px!important;gap:16px!important}selector.ls-sim-drawer .ls-sim-troca .ls-sim-name .elementor-heading-title{font-size:15px!important}',
  'selector.ls-sim-drawer .ls-sim-g-entrada .elementor-heading-title,selector.ls-sim-drawer .ls-sim-g-cartao .elementor-heading-title,selector.ls-sim-drawer .ls-sim-troca .elementor-heading-title{line-height:1.35}',
  // parcelas: resumo, grade de 3 e detalhes, tudo mais baixo
  'selector.ls-sim-drawer .ls-sim-result{grid-template-columns:1fr!important;grid-template-rows:auto!important;grid-template-areas:"big" "tiles" "info"!important;gap:16px!important}',
  'selector.ls-sim-drawer .ls-sim-r-big{position:sticky;top:65px;z-index:4;padding:14px 16px 6px!important;border-radius:18px!important;gap:2px!important;background:#161618!important;box-shadow:0 14px 24px -14px rgba(0,0,0,.9)}',
  'selector.ls-sim-drawer .ls-sim-r-big .ls-sim-lines{margin-top:8px}selector.ls-sim-drawer .ls-sim-r-big .ls-sim-line{padding:6px 0!important}',
  'selector.ls-sim-drawer .ls-sim-r-big .ls-sim-line .elementor-heading-title{font-size:12.5px!important}',
  'selector.ls-sim-drawer .ls-sim-big .elementor-heading-title{font-size:28px!important;font-variant-numeric:tabular-nums}selector.ls-sim-drawer .ls-sim-sub .elementor-heading-title{font-size:14px!important}',
  'selector.ls-sim-drawer .ls-sim-r-tiles{gap:10px!important}selector.ls-sim-drawer .ls-sim-g-parcelas{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}',
  'selector.ls-sim-drawer .ls-sim-x{padding:10px!important;border-radius:12px!important;gap:2px!important}',
  'selector.ls-sim-drawer .ls-sim-x-n .elementor-heading-title{font-size:16px!important}selector.ls-sim-drawer .ls-sim-x-p .elementor-heading-title{font-size:14px!important;font-variant-numeric:tabular-nums}selector.ls-sim-drawer .ls-sim-x-t .elementor-heading-title{font-size:11px!important}',
  'selector.ls-sim-drawer .ls-sim-r-info{gap:14px!important}selector.ls-sim-drawer .ls-sim-line{padding:9px 0!important}',
  'selector.ls-sim-drawer .ls-sim-line .elementor-heading-title{font-size:13px!important}',
  'selector.ls-sim-drawer .ls-sim-r-info .elementor-button{min-height:44px;padding:12px 18px}',
  // rodapé: Voltar pequeno, Continuar na largura que sobra
  `selector.ls-sim-drawer.ls-sim-on .ls-sim-nav{position:sticky;bottom:0;z-index:5;width:calc(100% + 2 * var(--ls-sim-pad))!important;max-width:none;margin:auto calc(-1 * var(--ls-sim-pad)) 0;padding:12px var(--ls-sim-pad) 16px!important;gap:10px!important;background:rgba(10,10,11,.92);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid ${c.line};border-radius:0}`,
  'selector.ls-sim-drawer .ls-sim-nav>.e-con:last-child{flex:1 1 auto!important;width:auto!important}',
  'selector.ls-sim-drawer .ls-sim-nav .ls-sim-next,selector.ls-sim-drawer .ls-sim-nav .ls-sim-wa{flex:1 1 auto}',
  'selector.ls-sim-drawer .ls-sim-nav .ls-sim-next .elementor-button,selector.ls-sim-drawer .ls-sim-nav .ls-sim-wa .elementor-button{width:100%}',
  'selector.ls-sim-drawer .ls-sim-nav .ls-sim-wa .elementor-button{min-height:52px;font-size:15px!important}',
  // na última tela o Voltar vira só a seta, para o Fechar ganhar o rodapé
  'selector.ls-sim-drawer.ls-sim-last .ls-sim-back .elementor-button{width:52px;height:52px;min-height:52px!important;padding:0!important;border-radius:50%!important}',
  'selector.ls-sim-drawer.ls-sim-last .ls-sim-back .elementor-button-text{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
  'selector.ls-sim-drawer.ls-sim-last .ls-sim-back .elementor-button-icon{margin:0!important}',
  'selector.ls-sim-drawer .ls-sim-nav .elementor-button{min-height:44px;padding:12px 18px}',
  'selector.ls-sim-drawer.ls-sim-first .ls-sim-back{display:none!important}',
  'selector.ls-sim-drawer .ls-sim-note{display:none!important}selector:not(.ls-sim-drawer) .ls-sim-note-in{display:none!important}',
].join('')

/**
 * O comportamento: arma as telas (classe ls-sim-on na raiz), as escolhas
 * (role radio, teclado), a máscara de real nos campos e as contas. Fica parado
 * no editor do Elementor, onde as quatro telas seguem visíveis para editar.
 */
export const simulatorScript = () => `
(function boot() {
  // o widget é o último da seção, mas no Space o HTML pode chegar antes do resto
  if (document.readyState === 'loading') return document.addEventListener('DOMContentLoaded', boot);
  var sim = document.querySelector('.ls-sim');
  if (!sim || sim.getAttribute('data-ls-sim')) return;
  if (document.body && document.body.classList.contains('elementor-editor-active')) return;
  sim.setAttribute('data-ls-sim', '1');

  var RATES = ${JSON.stringify(LS_RATES)};
  var CARD = ${JSON.stringify(CARD_LABEL)};
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function $(s, scope) { return (scope || sim).querySelector(s); }
  function $$(s, scope) { return [].slice.call((scope || sim).querySelectorAll(s)); }
  function txt(el) { return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : ''; }
  function set(sel, value) { $$(sel).forEach(function (el) { var t = el.querySelector('.elementor-heading-title') || el; t.textContent = value; }); }
  function put(scope, sel, value) { var el = scope && scope.querySelector(sel); if (el) (el.querySelector('.elementor-heading-title') || el.querySelector('p') || el).textContent = value; }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function brl(v) {
    var s = (Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2).split('.');
    return 'R$ ' + s[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.') + ',' + s[1];
  }
  function money(str) { var d = String(str || '').replace(/\\D/g, ''); return d ? parseInt(d, 10) / 100 : 0; }
  // preço do cartão ("R$ 8.990" ou "R$ 8.990,00") em reais
  function price(str) { var m = String(str).match(/[\\d.]+(,\\d{2})?/); return m ? parseFloat(m[0].replace(/\\./g, '').replace(',', '.')) : 0; }

  var panels = $$('.ls-sim-panel'), tabs = $$('.ls-sim-tab');
  var valueInput = $('#form-field-valor'), entryInput = $('#form-field-entrada');
  var state = { step: 0, done: 0, product: null, custom: false, customName: '', entry: false, trade: false, card: 'master', times: ${FREE_UP_TO} };

  /* escolhas: cada grupo é um radiogroup de cartões nativos */
  function arm(opt, group, onPick) {
    opt.setAttribute('role', group ? 'radio' : 'checkbox');
    opt.setAttribute('tabindex', '0');
    opt.setAttribute('aria-checked', 'false');
    // as parcelas recebem aria-label com o valor; os cartões usam o próprio nome
    var name = opt.classList.contains('ls-sim-x') ? null : ($('.ls-sim-name', opt) || $('.elementor-heading-title', opt));
    if (name) { if (!name.id) name.id = 'ls-sim-' + Math.random().toString(36).slice(2, 8); opt.setAttribute('aria-labelledby', name.id); }
    opt.addEventListener('click', function (e) { if (e.target.closest('input')) return; e.preventDefault(); onPick(opt); });
    opt.addEventListener('keydown', function (e) {
      if (e.target.closest('input')) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(opt); }
      if (group && /Arrow(Right|Down|Left|Up)/.test(e.key)) {
        var list = $$('.ls-sim-opt, .ls-sim-x', group).filter(function (o) { return o.offsetParent; });
        var i = list.indexOf(opt) + (/Right|Down/.test(e.key) ? 1 : -1);
        var next = list[(i + list.length) % list.length];
        if (next) { e.preventDefault(); next.focus(); }
      }
    });
  }
  function check(group, opt) {
    $$('[role="radio"]', group).forEach(function (o) { o.setAttribute('aria-checked', o === opt ? 'true' : 'false'); });
  }
  function radiogroup(sel, label, onPick) {
    var group = $(sel);
    if (!group) return null;
    group.setAttribute('role', 'radiogroup');
    if (label) group.setAttribute('aria-label', label);
    // o grupo guarda a escolha, para o cartão do produto da página usar a mesma
    group.__pick = function (o) { check(group, o); onPick(o); };
    $$('.ls-sim-opt, .ls-sim-x', group).forEach(function (opt) { arm(opt, group, group.__pick); });
    return group;
  }

  // 1. produto
  var products = radiogroup('.ls-sim-g-produto', 'Produto', function (opt) {
    hint(0, false);
    if (opt.classList.contains('ls-sim-outro')) {
      state.custom = true; state.product = null;
      if (valueInput && document.activeElement !== valueInput) valueInput.focus({ preventScroll: true });
    } else {
      state.custom = false;
      var spec = txt($('.ls-sim-spec', opt)), tag = txt($('.ls-sim-tag', opt));
      state.product = { name: txt($('.ls-sim-name', opt)) + (spec ? ' ' + spec : '') + (/semi/i.test(tag) ? ' (seminovo)' : ''), value: price(txt($('.ls-sim-price', opt))) };
    }
  });
  // 2. entrada
  var entries = radiogroup('.ls-sim-g-entrada', 'Entrada', function (opt) {
    hint(1, false);
    state.entry = opt.classList.contains('ls-sim-com');
    var box = $('.ls-sim-entry');
    if (box) box.classList.toggle('is-off', !state.entry);
    if (state.entry && entryInput) setTimeout(function () { entryInput.focus(); }, 30);
  });
  var trade = $('.ls-sim-troca');
  if (trade) arm(trade, null, function () { state.trade = !state.trade; trade.setAttribute('aria-checked', state.trade ? 'true' : 'false'); });
  // 3. cartão
  var cards = radiogroup('.ls-sim-g-cartao', 'Bandeira do cartão', function (opt) { state.card = opt.classList.contains('ls-sim-elo') ? 'elo' : 'master'; });
  // 4. parcelas
  var times = radiogroup('.ls-sim-g-parcelas', 'Parcelas', function (opt) {
    state.times = $$('.ls-sim-x', times).indexOf(opt) + 1;
    summary(true);
  });

  /* campos: máscara de real (digita os números, os centavos entram pela direita) */
  function mask(input, onType) {
    if (!input) return;
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function () {
      var v = money(input.value);
      input.value = v ? brl(v) : '';
      onType(v);
    });
  }
  mask(valueInput, function (v) {
    var outro = $('.ls-sim-outro');
    if (outro && products) { check(products, outro); state.custom = true; state.product = null; }
    if (v) hint(0, false);
  });
  mask(entryInput, function (v) { if (v) hint(1, false); });
  // Enter no campo segue para o próximo passo; o envio do formulário nunca sai daqui
  window.addEventListener('submit', function (e) {
    if (!sim.contains(e.target)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    next();
  }, true);

  function hint(i, on) { var h = $('.ls-sim-hint', panels[i]); if (h) h.classList.toggle('is-on', !!on); }
  function base() { return state.custom ? money(valueInput && valueInput.value) : (state.product ? state.product.value : 0); }
  function entry() { return state.entry ? money(entryInput && entryInput.value) : 0; }
  function valid(i) {
    if (i === 0 && !(base() > 0)) { hint(0, true); if (state.custom && valueInput) valueInput.focus(); return false; }
    if (i === 1 && state.entry && !(entry() > 0 && entry() < base())) { hint(1, true); if (entryInput) entryInput.focus(); return false; }
    return true;
  }

  /* resultado: as 18 parcelas e o resumo */
  function rows() {
    var value = Math.max(base() - entry(), 0);
    return RATES[state.card].map(function (rate, i) {
      var total = value / (1 - rate / 100);
      return { times: i + 1, total: total, parcel: total / (i + 1), free: rate === 0 };
    });
  }
  function product() { return state.custom ? (state.customName || 'Outro valor') : (state.product ? state.product.name : ''); }
  function summary(pop) {
    var list = rows();
    $$('.ls-sim-x', times).forEach(function (tile, i) {
      var r = list[i];
      set('.ls-sim-x-' + (i + 1) + ' .ls-sim-x-p', brl(r.parcel));
      set('.ls-sim-x-' + (i + 1) + ' .ls-sim-x-t', 'Total ' + brl(r.total));
      tile.setAttribute('aria-label', r.times + ' vezes de ' + brl(r.parcel) + (r.free ? ', sem juros' : '') + ', total ' + brl(r.total));
    });
    var pick = list[state.times - 1];
    set('.ls-sim-big', pick.times + 'x de ' + brl(pick.parcel));
    set('.ls-sim-sub', (pick.free ? 'Sem juros · ' : '') + 'total ' + brl(pick.total));
    set('.ls-sim-v-produto', product());
    set('.ls-sim-v-valor', brl(base()));
    set('.ls-sim-v-entrada', state.entry ? brl(entry()) : 'Sem entrada');
    set('.ls-sim-v-troca', state.trade ? 'Sim, a avaliar' : 'Não');
    set('.ls-sim-v-cartao', CARD[state.card]);
    set('.ls-sim-v-parcelado', brl(Math.max(base() - entry(), 0)));
    whatsapp();
  }
  // o botão do WhatsApp leva o resumo e diz a parcela escolhida; o número vem do próprio link
  var was = $$('.ls-sim-wa').map(function (w) { return w.querySelector('a, .elementor-button'); }).filter(Boolean);
  var waBase = was.length ? (was[0].getAttribute('href') || 'https://wa.me/').split('?')[0] : '';
  function whatsapp() {
    var r = rows()[state.times - 1];
    was.forEach(function (a) {
      a.setAttribute('href', waBase + '?text=' + encodeURIComponent(text()));
      var label = a.querySelector('.elementor-button-text');
      if (label) label.textContent = 'Fechar em ' + r.times + 'x no WhatsApp';
    });
  }
  function text() {
    var r = rows()[state.times - 1];
    return ['Olá, LS! Fiz uma simulação no site:',
      '• Produto: ' + product() + ' (' + brl(base()) + ')',
      '• Entrada: ' + (state.entry ? brl(entry()) : 'sem entrada'),
      '• Usado na troca: ' + (state.trade ? 'sim, a avaliar' : 'não'),
      '• Cartão: ' + CARD[state.card],
      '• Parcelas: ' + r.times + 'x de ' + brl(r.parcel) + (r.free ? ' sem juros' : '') + ' (total ' + brl(r.total) + ')'].join('\\n');
  }

  /* navegação entre as telas */
  function go(i, focus) {
    if (i < 0 || i >= panels.length || i === state.step) return;
    var forward = i > state.step;
    if (forward) for (var k = state.step; k < i; k++) if (!valid(k)) return go(k, true);
    sim.classList.toggle('ls-sim-back-dir', !forward);
    state.step = i;
    state.done = Math.max(state.done, i);
    if (i === panels.length - 1) summary(false);
    paint();
    // no painel, volta ao alto do próprio painel
    if (sim.classList.contains('ls-sim-drawer')) sim.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else {
      var stage = $('.ls-sim-stage') || sim;
      var top = stage.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) stage.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
    if (focus !== false) {
      var title = $('.ls-sim-title', panels[i]);
      var h = title && (title.querySelector('.elementor-heading-title') || title);
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }
  function next() { if (valid(state.step)) go(state.step + 1); }
  function paint() {
    panels.forEach(function (p, i) { p.classList.toggle('is-active', i === state.step); });
    tabs.forEach(function (t, i) {
      t.classList.toggle('is-active', i === state.step);
      t.classList.toggle('is-done', i !== state.step && i <= state.done);
      if (i === state.step) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current');
      var reach = i !== state.step && i <= state.done;
      t.setAttribute('tabindex', reach ? '0' : '-1');
      t.setAttribute('aria-disabled', reach ? 'false' : 'true');
    });
    sim.classList.toggle('ls-sim-first', state.step === 0);
    sim.classList.toggle('ls-sim-last', state.step === panels.length - 1);
    var count = $('.ls-sim-count');
    if (count) set('.ls-sim-count', 'Passo ' + (state.step + 1) + ' de ' + panels.length);
  }
  tabs.forEach(function (t, i) {
    t.setAttribute('role', 'button');
    t.addEventListener('click', function () { if (i <= state.done) go(i); });
    t.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && i <= state.done) { e.preventDefault(); go(i); } });
  });
  function on(sel, fn) {
    $$(sel).forEach(function (w) {
      var a = w.querySelector('a, button') || w;
      a.setAttribute('role', 'button');
      a.addEventListener('click', function (e) { e.preventDefault(); fn(a); });
    });
  }
  on('.ls-sim-next', next);
  on('.ls-sim-back', function () { go(state.step - 1); });
  on('.ls-sim-restart', function () {
    state.done = 0; state.trade = false; state.product = null; state.custom = false; state.entry = false; state.times = ${FREE_UP_TO};
    if (trade) trade.setAttribute('aria-checked', 'false');
    if (products) $$('[role="radio"]', products).forEach(function (o) { o.setAttribute('aria-checked', 'false'); });
    if (entries) check(entries, $('.ls-sim-sem', entries));
    if (times) check(times, $$('.ls-sim-x', times)[state.times - 1]);
    var entryBox = $('.ls-sim-entry'); if (entryBox) entryBox.classList.add('is-off');
    hint(0, false); hint(1, false);
    if (valueInput) valueInput.value = '';
    if (entryInput) entryInput.value = '';
    go(0);
  });
  on('.ls-sim-copy', function (a) {
    var label = a.querySelector('.elementor-button-text') || a;
    var before = label.getAttribute('data-label') || label.textContent;
    label.setAttribute('data-label', before);
    function done(ok) { label.textContent = ok ? 'Resumo copiado' : 'Não deu para copiar'; setTimeout(function () { label.textContent = before; }, 2200); }
    var value = text();
    function fallback() {
      try {
        var area = document.createElement('textarea');
        area.value = value; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(area); area.select();
        var ok = document.execCommand('copy'); area.remove(); done(ok);
      } catch (error) { done(false); }
    }
    try { navigator.clipboard.writeText(value).then(function () { done(true); }, fallback); } catch (error) { fallback(); }
  });

  /* estado inicial: nenhum produto, sem entrada, Visa ou Mastercard, ${FREE_UP_TO}x */
  if (products) $$('[role="radio"]', products).forEach(function (o) { o.setAttribute('aria-checked', 'false'); });
  if (entries) check(entries, $('.ls-sim-sem', entries));
  if (cards) check(cards, $('.ls-sim-master', cards));
  if (times) check(times, $$('.ls-sim-x', times)[state.times - 1]);
  var box = $('.ls-sim-entry'); if (box) box.classList.add('is-off');
  $$('.ls-sim-big, .ls-sim-sub').forEach(function (el) { el.setAttribute('aria-live', 'polite'); });
  sim.classList.add('ls-sim-on');
  paint();

  /* painel lateral: nas páginas o simulador abre por cima, vindo da direita.
     Na miniatura do canvas do Space (a marca é montada aqui para não casar com ela) fica na página. */
  var thumb = document.documentElement.innerHTML.indexOf(['se', 'preview', 'height'].join('-')) !== -1;
  if (sim.classList.contains('ls-sim-dock') && !thumb) dock();

  function dock() {
    var trigger = null, moved = null, outroText = null;
    var scrim = document.createElement('div');
    scrim.className = 'ls-sim-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    scrim.style.cssText = 'position:fixed;inset:0;z-index:2147482999;background:rgba(0,0,0,.56);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;pointer-events:none;' + (reduce ? '' : 'transition:opacity .45s cubic-bezier(.2,.7,.2,1)');
    document.body.appendChild(scrim);
    var heading = $('.ls-sim-heading .elementor-heading-title');
    if (heading) { heading.id = heading.id || 'ls-sim-dialog-title'; sim.setAttribute('aria-labelledby', heading.id); }
    sim.setAttribute('role', 'dialog');
    sim.setAttribute('aria-modal', 'true');
    sim.setAttribute('aria-hidden', 'true');
    // vira painel já fora da tela: com a transição ligada ele atravessaria a página, visível, ao carregar
    sim.style.transition = 'none';
    sim.classList.add('ls-sim-drawer');
    void sim.offsetWidth;
    sim.style.transition = '';

    // o produto de onde veio o clique: o mais próximo, ou o da página de produto
    function context(from) {
      $$('.ls-sim-ctx-card').forEach(function (el) { el.remove(); });
      if (moved) { moved.el.parentNode.insertBefore(moved.el, moved.next); moved = null; }
      var outro = $('.ls-sim-outro');
      if (outro && outroText) { put(outro, '.ls-sim-name', outroText[0]); put(outro, '.ls-sim-outro-hint', outroText[1]); }
      state.product = null; state.custom = false; state.customName = '';
      if (valueInput) valueInput.value = '';
      if (!products) return;
      $$('[role="radio"]', products).forEach(function (o) { o.setAttribute('aria-checked', 'false'); });
      var ctx = from && from.closest ? (from.closest('.ls-sim-ctx') || document.querySelector('.ls-sim-ctx-page')) : null;
      if (!ctx) return;
      function q(c) { return txt(ctx.querySelector('.ls-sim-ctx-' + c)); }
      var name = q('name'), spec = q('spec'), cost = price(q('price'));
      if (!name) return;
      var full = name + (spec ? ' ' + spec : '');
      if (cost > 0) {
        // já está na lista (mesmo nome e mesmo preço)? usa o mesmo cartão; senão, um cartão igual aos outros com o produto da página
        var card = $$('.ls-sim-prod', products).filter(function (o) {
          return norm(txt($('.ls-sim-name', o))) === norm(name) && price(txt($('.ls-sim-price', o))) === cost;
        })[0];
        if (card) moved = { el: card, next: card.nextSibling };
        else {
          var model = $('.ls-sim-prod', products);
          if (!model) return;
          card = model.cloneNode(true);
          card.classList.add('ls-sim-ctx-card');
          [].forEach.call(card.querySelectorAll('[id]'), function (el) { el.removeAttribute('id'); });
          put(card, '.ls-sim-name', name);
          put(card, '.ls-sim-spec', spec);
          put(card, '.ls-sim-price', q('price'));
          put(card, '.ls-sim-tag', q('tag') || 'Este produto');
          var pic = ctx.querySelector('.ls-sim-ctx-img img'), img = card.querySelector('img');
          if (img && pic) { img.src = pic.currentSrc || pic.src; img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.alt = pic.alt || full; }
          arm(card, products, products.__pick);
        }
        products.insertBefore(card, products.firstElementChild);
        products.__pick(card);
      } else if (outro) {
        // sem preço na página (o iPhone 18 Pro): o campo de valor vira o do produto
        outroText = outroText || [txt($('.ls-sim-name', outro)), txt($('.ls-sim-outro-hint', outro))];
        put(outro, '.ls-sim-name', full);
        put(outro, '.ls-sim-outro-hint', 'Digite o valor do ' + full + '.');
        moved = { el: outro, next: outro.nextSibling };
        products.insertBefore(outro, products.firstElementChild);
        check(products, outro);
        state.custom = true; state.customName = full;
      }
    }

    function lock(on) {
      var bar = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.overflow = on ? 'hidden' : '';
      document.body.style.paddingRight = on && bar > 0 ? bar + 'px' : '';
    }
    function open(from) {
      trigger = from || null;
      context(from);
      state.step = 0; state.done = 0;
      hint(0, false); hint(1, false);
      sim.classList.remove('ls-sim-back-dir');
      paint();
      sim.scrollTop = 0;
      // o menu do celular fecha por baixo do painel
      [].forEach.call(document.querySelectorAll('.ls-menu details[open]'), function (d) { d.removeAttribute('open'); });
      sim.setAttribute('aria-hidden', 'false');
      sim.classList.add('is-open');
      scrim.style.opacity = '1';
      scrim.style.pointerEvents = 'auto';
      lock(true);
      // o foco vai para o título do painel (o leitor de tela anuncia o diálogo; o Fechar é o próximo Tab)
      var title = heading || sim;
      title.setAttribute('tabindex', '-1');
      setTimeout(function () { title.focus({ preventScroll: true }); }, 60);
    }
    function close() {
      if (!sim.classList.contains('is-open')) return;
      sim.classList.remove('is-open');
      sim.setAttribute('aria-hidden', 'true');
      scrim.style.opacity = '0';
      scrim.style.pointerEvents = 'none';
      lock(false);
      if (trigger && trigger.focus) trigger.focus({ preventScroll: true });
    }

    // qualquer link para #simulador fora do painel abre o painel
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || sim.contains(a) || (a.getAttribute('href') || '').indexOf('#simulador') === -1) return;
      e.preventDefault();
      e.stopPropagation();
      open(a);
    }, true);
    scrim.addEventListener('click', close);
    on('.ls-sim-close', close);
    document.addEventListener('keydown', function (e) {
      if (!sim.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      // o foco fica no painel enquanto ele está aberto
      var list = [].slice.call(sim.querySelectorAll('a[href], button, input, select, [tabindex="0"]')).filter(function (el) { return el.offsetParent !== null; });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1], at = document.activeElement;
      if (e.shiftKey && (at === first || !sim.contains(at))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (at === last || !sim.contains(at))) { e.preventDefault(); first.focus(); }
    });
    if (location.hash === '#simulador') open(null);
  }
})();
`
