/*
 * Formulários e quizzes da Avence (CRM › Formulários). Vai uma vez no WordPress (Elementor ›
 * Código personalizado, fim do <body>) e desenha o formulário em cada <div data-avence-form="ID">.
 *
 *   <div data-avence-form="ID" data-endpoint="https://….supabase.co/functions/v1/form-submit"></div>
 *   <script defer src="https://app.avencestudio.com/forms.js"></script>
 *
 * Desenha dentro de um Shadow DOM (o CSS do tema não entra e o nosso não vaza), herda a fonte do
 * site e respeita prefers-reduced-motion. Busca a definição publicada, valida no navegador para
 * ajudar quem responde e manda tudo à função `form-submit`, que valida de novo, pontua e entrega o
 * lead ao CRM. Eventos no dataLayer: form_view, form_start, form_step, form_submit, lead_qualificado,
 * lead_nao_qualificado, schedule_view e schedule_confirmed (o visitas.js do Site também os recebe).
 * Sem cookies próprios; a origem (UTM, gclid, fbclid) fica na sessionStorage.
 *
 * Telas: capa (definition.welcome) → perguntas → fim, ou → agenda (settings.booking, para quem passa
 * no filtro; os horários e a reserva vêm da função) → agradecimento.
 * Pixel da Meta do formulário (settings.pixel): só os eventos dele, com trackSingle (num site com outro
 * pixel, nada se mistura): <prefixo>View, <prefixo>FirstInteraction, <prefixo>Submit (ou um padrão),
 * Lead (quem passou no filtro), <prefixo>ViewScheduled, <prefixo>Scheduled e Schedule. Envio e agenda
 * levam event_id iguais aos que a função manda pela API de Conversões.
 * Também serve de prévia no construtor: window.AvenceForms.mount(el, config, { preview: true }).
 * A lógica de visibilidade e pontuação espelha supabase/functions/_shared/forms.ts.
 */
(function () {
  'use strict'
  if (window.AvenceForms) return

  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'campaign_id', 'adset_id', 'ad_id', 'placement']

  function push(event, data) {
    try {
      window.dataLayer = window.dataLayer || []
      var o = { event: event }
      for (var k in data) o[k] = data[k]
      window.dataLayer.push(o)
    } catch (e) {}
  }

  // Aviso por DOM para quem hospeda o formulário (a página pública /f/ liga o pixel e acerta o título); não vai ao dataLayer
  function emit(host, detail) {
    try { host.dispatchEvent(new CustomEvent('avence-form', { bubbles: true, composed: true, detail: detail })) } catch (e) {}
  }
  function track(host, event, data) { push(event, data); emit(host, Object.assign({ event: event }, data)) }

  // A origem da primeira visita da sessão (os links de anúncio trazem os parâmetros só na entrada)
  function tracking() {
    var saved = {}
    try { saved = JSON.parse(sessionStorage.getItem('avence-form-origin') || '{}') } catch (e) {}
    var params = new URLSearchParams(location.search)
    var fresh = false
    UTM.forEach(function (k) { var v = params.get(k); if (v && !saved[k]) { saved[k] = v.slice(0, 300); fresh = true } })
    if (!saved.referrer && document.referrer) { saved.referrer = document.referrer.slice(0, 500); fresh = true }
    if (fresh) try { sessionStorage.setItem('avence-form-origin', JSON.stringify(saved)) } catch (e) {}
    saved.page = location.origin + location.pathname
    return saved
  }

  var asList = function (v) { return Array.isArray(v) ? v : v ? [v] : [] }
  var hasOpts = function (t) { return t === 'choice' || t === 'multi' || t === 'select' }
  var isPick = function (t) { return hasOpts(t) || t === 'yesno' || t === 'rating' }

  function optionsOf(f) {
    if (f.type === 'yesno') {
      var base = [{ id: 'sim', label: 'Sim' }, { id: 'nao', label: 'Não' }]
      if (!f.options || f.options.length !== 2) return base
      return f.options.map(function (o, i) { return { id: o.id, label: String(o.label || '').trim() || base[i].label, score: o.score } })
    }
    if (f.type === 'rating') return [1, 2, 3, 4, 5].map(function (n) { var o = (f.options || []).filter(function (x) { return x.id === String(n) })[0]; return { id: String(n), label: String(n), score: o && o.score } })
    return f.options || []
  }

  function visible(f, answers) {
    var c = f.showIf
    if (!c) return true
    var hit = asList(answers[c.field]).indexOf(c.value) >= 0
    return c.op === 'eq' ? hit : !hit
  }

  function score(def, answers) {
    var total = 0
    def.steps.forEach(function (s) {
      s.fields.forEach(function (f) {
        if (!isPick(f.type) || !visible(f, answers)) return
        var opts = optionsOf(f)
        asList(answers[f.id]).forEach(function (id) { opts.forEach(function (o) { if (o.id === id && o.score) total += o.score }) })
      })
    })
    return total
  }

  function resultFor(def, pts) {
    if (def.kind !== 'quiz' || !def.results || !def.results.length) return null
    var sorted = def.results.slice().sort(function (a, b) { return b.min - a.min })
    for (var i = 0; i < sorted.length; i++) if (pts >= sorted[i].min) return sorted[i]
    return sorted[sorted.length - 1]
  }

  function maskPhone(v) {
    var d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
    if (d.length > 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length > 10 ? 7 : 6) + '-' + d.slice(d.length > 10 ? 7 : 6)
    if (d.length > 2) return '(' + d.slice(0, 2) + ') ' + d.slice(2)
    return d
  }

  // Quebra de linha nunca separa "R$" do valor (nem "50" de "%" ou "mil"): troca o espaço por um inseparável
  function nb(t) { return String(t).replace(/R\$\s+(?=\d)/g, 'R$ ').replace(/(\d)\s+(%|mil\b|mi\b)/g, '$1 $2') }

  function el(tag, attrs, children) {
    var n = document.createElement(tag)
    for (var k in attrs || {}) {
      var v = attrs[k]
      if (v === undefined || v === null || v === false) continue
      if (k === 'class') n.className = v
      else if (k === 'text') n.textContent = nb(v)
      else n.setAttribute(k, v === true ? '' : v)
    }
    ;(children || []).forEach(function (c) { if (c) n.appendChild(c) })
    return n
  }

  function css(t) {
    var font = fontStack(t.font)
    return (
      ':host{display:block;--p:' + t.primary + ';--bg:' + t.background + ';--tx:' + t.text + ';--fd:' + t.field + ';--r:' + t.radius + 'px;font-family:' + font + ';color:var(--tx);line-height:1.45}' +
      '*{box-sizing:border-box}' +
      '.f{background:var(--bg);color:var(--tx);border-radius:calc(var(--r) * 1.6);padding:28px;position:relative;overflow:hidden}' +
      '.f.card{border:1px solid color-mix(in srgb,var(--tx) 10%,transparent);box-shadow:0 1px 2px rgba(0,0,0,.04),0 24px 48px -24px rgba(0,0,0,.22)}' +
      '.f.plain{padding:0;background:transparent}' +
      '.bar{height:6px;border-radius:99px;background:color-mix(in srgb,var(--tx) 12%,transparent);margin-bottom:22px;overflow:hidden}' +
      '.bar i{display:block;height:100%;background:linear-gradient(90deg,color-mix(in srgb,var(--p) 70%,#fff),var(--p));border-radius:99px;transition:width .35s cubic-bezier(.22,1,.36,1)}' +
      'h3{font:inherit;font-size:1.5em;font-weight:650;letter-spacing:-.02em;margin:0 0 6px;line-height:1.2;white-space:pre-line}' +
      '.d{margin:0 0 20px;opacity:.7}' +
      // Observação da etapa: leve e cinza, só um aparte entre a pergunta e as opções
      '.nt{margin:4px 0 24px;font-size:.92em;font-weight:400;line-height:1.5;color:color-mix(in srgb,var(--tx) 56%,transparent);text-wrap:pretty}' +
      'h3+.nt{margin-top:10px}.d+.nt{margin-top:-8px}' +
      '.fl{margin:0 0 18px;border:0;padding:0;min-width:0}.fl[hidden]{display:none}' +
      'label.l,legend{display:block;font-weight:600;margin:0 0 8px;padding:0;font-size:1em}' +
      '.h{font-size:.86em;opacity:.65;margin:-4px 0 8px}' +
      '.req{color:var(--p);margin-left:3px}' +
      'input.t,textarea,select{width:100%;font:inherit;font-size:16px;color:var(--tx);background:var(--fd);border:1.5px solid transparent;border-radius:var(--r);padding:13px 14px;outline:0;transition:border-color .15s,box-shadow .15s;appearance:none;-webkit-appearance:none}' +
      'textarea{min-height:110px;resize:vertical}' +
      'select{background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 20px) 55%,calc(100% - 14px) 55%;background-size:6px 6px;background-repeat:no-repeat;padding-right:38px}' +
      'input.t:focus-visible,textarea:focus-visible,select:focus-visible{border-color:var(--p);box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 25%,transparent)}' +
      '.bad input.t,.bad textarea,.bad select{border-color:#d92d20}' +
      '.er{color:#d92d20;font-size:.88em;margin:6px 0 0;min-height:0}' +
      '.ops{display:grid;gap:8px}' +
      '.op{position:relative;display:flex;align-items:center;gap:12px;background:var(--fd);border:1.5px solid transparent;border-radius:var(--r);padding:15px 16px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.05);transition:border-color .15s,background .15s,transform .1s,box-shadow .15s}' +
      '.op:hover{border-color:color-mix(in srgb,var(--p) 45%,transparent);box-shadow:0 6px 16px -8px rgba(0,0,0,.2)}.op:active{transform:scale(.985)}' +
      '.op input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}' +
      '.op i{flex:none;width:20px;height:20px;border:1.5px solid color-mix(in srgb,var(--tx) 35%,transparent);border-radius:50%;display:grid;place-items:center;transition:all .15s}' +
      '.multi .op i{border-radius:6px}' +
      '.op i::after{content:"";width:10px;height:10px;border-radius:50%;background:#fff;transform:scale(0);transition:transform .15s}' +
      '.multi .op i::after{border-radius:2px;width:9px;height:9px}' +
      '.op:has(input:checked){border-color:var(--p);background:color-mix(in srgb,var(--p) 10%,var(--fd));box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 18%,transparent)}' +
      '.op:has(input:checked) i{background:var(--p);border-color:var(--p)}.op:has(input:checked) i::after{transform:scale(1)}' +
      '.op:has(input:focus-visible){box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 25%,transparent)}' +
      '.stars{display:flex;gap:8px}.stars .op{padding:10px 0;justify-content:center;flex:1}.stars .op i{display:none}.stars .op b{font-weight:650}' +
      '.row{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:8px}' +
      'button{font:inherit;font-weight:650;font-size:1em;border:0;border-radius:var(--r);padding:13px 22px;cursor:pointer;transition:transform .1s,opacity .15s,background .15s}' +
      'button:active{transform:scale(.97)}button:focus-visible{outline:3px solid color-mix(in srgb,var(--p) 40%,transparent);outline-offset:2px}' +
      'button.go{background:var(--p);color:#fff;margin-left:auto;box-shadow:0 10px 22px -10px color-mix(in srgb,var(--p) 80%,transparent),inset 0 1px 0 rgba(255,255,255,.22)}button.go:hover{filter:brightness(1.07)}button.go:disabled{opacity:.6;cursor:default}' +
      'button.bk{background:transparent;color:var(--tx);opacity:.65;padding-left:4px;padding-right:12px}button.bk:hover{opacity:1}' +
      '.sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
      '.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
      '.out{text-align:center;padding:12px 0}' +
      '.out .ok{width:52px;height:52px;border-radius:50%;background:color-mix(in srgb,var(--p) 14%,transparent);color:var(--p);display:grid;place-items:center;margin:0 auto 16px;font-size:26px}' +
      '.out .cta{display:flex;flex-direction:column;gap:10px;margin-top:20px}' +
      '.out a.btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:56px;padding:14px 22px;border-radius:var(--r);font:inherit;font-weight:600;font-size:1em;letter-spacing:-.005em;text-decoration:none;transition:transform .12s,background-color .18s,color .18s,border-color .18s}' +
      '.out a.btn:active{transform:scale(.98)}.out a.btn:focus-visible{outline:3px solid color-mix(in srgb,var(--p) 40%,transparent);outline-offset:2px}' +
      '.out a.btn svg{flex:none;width:22px;height:22px}' +
      '.out a.wa{background:var(--tx);color:var(--bg)}.out a.wa svg{color:#25d366}.out a.wa svg.arr{color:inherit}.out a.wa .arr{flex:none;width:16px;height:16px;margin-left:2px;opacity:.7;transition:transform .2s cubic-bezier(.2,0,0,1),opacity .2s}' +
      '@media (hover:hover){.out a.wa:hover{background:color-mix(in srgb,var(--tx) 86%,var(--bg))}.out a.wa:hover .arr{transform:translateX(3px);opacity:1}}' +
      '.out a.alt{background:transparent;color:var(--p);border:1.5px solid color-mix(in srgb,var(--p) 45%,transparent)}.out a.alt:hover{border-color:var(--p)}' +
      '.out .sub{font-size:.84em;opacity:.6;margin:0}' +
      '.pts{display:inline-block;font-size:.82em;font-weight:650;padding:4px 10px;border-radius:99px;background:color-mix(in srgb,var(--p) 12%,transparent);color:var(--p);margin-bottom:12px}' +
      '.pv{font-size:.78em;opacity:.55;margin-top:14px;text-align:center}' +
      '.st{animation:in .28s cubic-bezier(.22,1,.36,1);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px}.st>*{grid-column:1/-1}.st>.fl.half{grid-column:auto}' +
      '.f.ol input.t,.f.ol textarea,.f.ol select{background:var(--bg);border-color:color-mix(in srgb,var(--tx) 38%,transparent)}.f.ol input.t:hover,.f.ol textarea:hover,.f.ol select:hover{border-color:color-mix(in srgb,var(--tx) 65%,transparent)}.f.ol label.l,.f.ol legend{font-weight:500;font-size:.9em;margin-bottom:6px}.f.ol ::placeholder{color:color-mix(in srgb,var(--tx) 52%,transparent);opacity:1}.f.ol .bad input.t,.f.ol .bad textarea,.f.ol .bad select{border-color:#d92d20}' +
      '.fn{font-size:.82em;opacity:.7;margin:14px 0 0;text-align:center}' +
      // Capa: tudo à esquerda; o ícone da headline corre com o texto (como o emoji), os dos bullets ficam numa coluna fixa
      '.wl{animation:in .28s cubic-bezier(.22,1,.36,1);text-align:left}' +
      // A capa ocupa a altura que a página der (--avence-form-min-h: o link direto e a prévia de celular dão a tela)
      '.f.wlf{display:flex;flex-direction:column;min-height:var(--avence-form-min-h,auto)}' +
      '.wlf.va-top{justify-content:flex-start}.wlf.va-center{justify-content:center}.wlf.va-bottom{justify-content:flex-end}.wlf.va-justify{justify-content:space-between}' +
      '.wlf .wl-logo{margin:0 0 28px;display:flex}.wlf.va-justify .wl-logo{margin-bottom:32px}' +
      '.wl-logo.lg-left{justify-content:flex-start}.wl-logo.lg-center{justify-content:center}.wl-logo.lg-right{justify-content:flex-end}' +
      '.wlf.va-justify .wl-end{margin-top:32px}' +
      '.wl .logo{display:block;height:32px;width:auto;max-width:180px;object-fit:contain;margin:0}' +
      '.wl h1{font:inherit;font-size:1.72em;font-weight:500;line-height:1.22;letter-spacing:-.025em;margin:0 0 24px;text-wrap:balance}' +
      // O trecho em negrito nunca quebra no meio ("faturar / mais"): a linha quebra antes dele
      '.wl h1 b{font-weight:700;white-space:nowrap}' +
      '.wl h1 svg.hi{display:inline-block;width:.92em;height:.92em;vertical-align:-.11em;margin-right:.3em;color:var(--p);stroke-width:2}' +
      '.wl ul{list-style:none;margin:0 0 26px;padding:0;display:grid;gap:13px}' +
      '.wl li{display:grid;grid-template-columns:20px minmax(0,1fr);column-gap:12px;align-items:center;font-size:1em;line-height:1.35;color:color-mix(in srgb,var(--tx) 78%,transparent)}' +
      '.wl li svg{width:20px;height:20px;color:var(--p)}' +
      '.wl li span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.wl li.noi{grid-template-columns:minmax(0,1fr)}' +
      '.wl .ft{display:grid;grid-template-columns:16px minmax(0,1fr);column-gap:9px;margin:0 0 28px;font-style:italic;font-size:.95em;line-height:1.5;color:color-mix(in srgb,var(--tx) 70%,transparent);text-wrap:pretty}' +
      '.wl .ft svg{width:16px;height:16px;margin-top:calc((1.5em - 16px) / 2);color:var(--tx);opacity:.75}' +
      'button.start{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;background:var(--p);color:#fff;font-size:.92em;font-weight:650;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 10px 22px -12px color-mix(in srgb,var(--p) 80%,transparent)}' +
      'button.start svg{flex:none;width:18px;height:18px;transition:transform .2s cubic-bezier(.2,0,0,1)}' +
      '@media (hover:hover){button.start:hover{filter:brightness(1.07)}button.start:hover svg{transform:translateX(3px)}}' +
      // Agenda
      '.ag{animation:in .28s cubic-bezier(.22,1,.36,1)}' +
      '.ag h3{margin-bottom:18px}' +
      '.meet{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:12px;align-items:center;margin:0 0 22px}' +
      '.meet .mi{width:44px;height:44px;border-radius:var(--r);background:var(--p);color:#fff;display:grid;place-items:center}.meet .mi svg{width:22px;height:22px}' +
      '.meet b{display:block;font-weight:650;line-height:1.25}' +
      '.meet small{display:flex;align-items:center;gap:6px;font-size:.86em;opacity:.65;margin-top:3px}.meet small svg{width:14px;height:14px}' +
      '.cap{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:.86em;font-weight:600;margin:0 0 10px}.cap span{font-weight:400;opacity:.6}' +
      '.days{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:8px;margin:0 0 22px}' +
      '.days button,.times button{background:var(--bg);color:var(--tx);border:1.5px solid color-mix(in srgb,var(--tx) 14%,transparent);border-radius:var(--r);box-shadow:none;transition:border-color .15s,background .15s,color .15s,transform .1s}' +
      '.days button{display:grid;gap:2px;justify-items:center;padding:11px 4px}' +
      '.days .w{font-size:.74em;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.6}.days .d{font-size:1.05em;font-weight:650;font-variant-numeric:tabular-nums}' +
      '.times{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:8px;margin:0 0 22px}' +
      '.times button{padding:12px 0;font-weight:600;font-variant-numeric:tabular-nums}' +
      '@media (hover:hover){.days button:hover,.times button:hover{border-color:color-mix(in srgb,var(--p) 55%,transparent)}}' +
      '.days button[aria-pressed=true]{border-color:var(--p);background:color-mix(in srgb,var(--p) 8%,var(--bg));color:var(--p)}.days button[aria-pressed=true] .w{opacity:.85}' +
      '.times button[aria-pressed=true]{border-color:var(--p);background:var(--p);color:#fff}' +
      'button.wide{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin:0;min-height:52px}button.wide svg{width:18px;height:18px}' +
      '.none{padding:18px;border:1.5px dashed color-mix(in srgb,var(--tx) 16%,transparent);border-radius:var(--r);text-align:center;opacity:.8;margin:0 0 18px}' +
      '.out .ok svg{width:26px;height:26px}' +
      '.when{display:inline-flex;align-items:center;gap:8px;margin:2px 0 14px;padding:8px 14px;border-radius:99px;background:color-mix(in srgb,var(--p) 10%,transparent);color:var(--p);font-weight:600;font-size:.92em;font-variant-numeric:tabular-nums}.when svg{width:16px;height:16px}' +
      '@keyframes in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}' +
      '@media (prefers-reduced-motion:reduce){.st,.wl,.ag{animation:none}.bar i,.op,button,button.start svg{transition:none}}' +
      '@media (max-width:480px){.f{padding:20px}.st>.fl.half{grid-column:1/-1}.wl h1{font-size:1.55em}.days{gap:6px}}'
    )
  }

  // O logo do WhatsApp (o glifo oficial, como no Font Awesome), herda a cor do texto
  function wa() {
    var ns = 'http://www.w3.org/2000/svg'
    var svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 448 512'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('fill', 'currentColor')
    var path = document.createElementNS(ns, 'path')
    path.setAttribute('d', 'M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z')
    svg.appendChild(path)
    return svg
  }

  // Seta do botão (traço, herda a cor do texto)
  function arrow() {
    var ns = 'http://www.w3.org/2000/svg'
    var svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'arr')
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.2'); svg.setAttribute('stroke-linecap', 'square')
    var path = document.createElementNS(ns, 'path')
    path.setAttribute('d', 'M4 12h15M13 6l6 6-6 6')
    svg.appendChild(path)
    return svg
  }


  // Fontes do Google: a fonte precisa estar no documento (o @font-face dentro do Shadow DOM não vale)
  var FONT_URL = {
    'Inter Tight': 'https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400..700;1,400..700&display=swap',
    Lato: 'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400&display=swap',
    Inter: 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400..700;1,400..700&display=swap',
  }
  function loadFont(name) {
    var href = FONT_URL[name]
    if (!href || document.querySelector('link[data-avence-font="' + name + '"]')) return
    document.head.appendChild(el('link', { rel: 'stylesheet', href: href, 'data-avence-font': name }))
  }
  function fontStack(name) {
    if (name === 'system') return 'system-ui, -apple-system, Segoe UI, sans-serif'
    if (FONT_URL[name]) return "'" + name + "', system-ui, sans-serif"
    return 'inherit'
  }

  // Pixel da Meta do formulário: só os eventos dele (trackSingle), mesmo num site que já tem outro pixel
  var STANDARD = ['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'SubmitApplication', 'Contact', 'Schedule']
  var started_ = {}
  function pixelOf(cfg, host) {
    var p = cfg.settings && cfg.settings.pixel
    if (p && p.enabled && /^\d{14,17}$/.test(p.id)) return p
    // Legado: ?px= no link direto (/f/), sem configuração no formulário
    var extra = host && host.getAttribute('data-pixel')
    if (extra && /^\d{8,20}$/.test(extra)) return { enabled: true, id: extra, prefix: 'Avence', submitEvent: 'custom', standardLead: true, standardSchedule: true }
    return null
  }
  function pixelNames(p) {
    var pre = (p && p.prefix) || 'Avence'
    return { view: pre + 'View', first: pre + 'FirstInteraction', viewScheduled: pre + 'ViewScheduled', submit: pre + 'Submit', scheduled: pre + 'Scheduled' }
  }
  function fbqBoot() {
    if (window.fbq) return
    var n = (window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) })
    if (!window._fbq) window._fbq = n
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []
    var s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(s)
  }
  function pixelStart(p) {
    if (started_[p.id]) return
    started_[p.id] = true
    fbqBoot()
    var known = false
    try { var st = window.fbq.getState && window.fbq.getState(); known = !!(st && st.pixels && st.pixels.some(function (x) { return x.id === p.id })) } catch (e) {}
    if (!known) { window.fbq('init', p.id); window.fbq('trackSingle', p.id, 'PageView') }
  }
  function fb(p, name, data, eventId) {
    if (!p || !name) return
    try {
      pixelStart(p)
      window.fbq(STANDARD.indexOf(name) >= 0 ? 'trackSingle' : 'trackSingleCustom', p.id, name, data || {}, eventId ? { eventID: eventId } : undefined)
    } catch (e) {}
  }
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
    return m ? decodeURIComponent(m[1]) : undefined
  }
  // A origem mais os cookies da Meta e a página de agora (a função manda à API de Conversões)
  function metaNow(origin) {
    var o = {}
    for (var k in origin) o[k] = origin[k]
    var fbp = cookie('_fbp'), fbc = cookie('_fbc')
    if (fbp) o.fbp = fbp
    if (fbc) o.fbc = fbc
    o.url = location.href.slice(0, 500)
    return o
  }

  // **trecho** em negrito, o resto como texto
  function rich(node, text) {
    String(text || '').split(/\*\*(.+?)\*\*/).forEach(function (part, i) {
      if (!part) return
      node.appendChild(i % 2 ? el('b', { text: part }) : document.createTextNode(nb(part)))
    })
  }

  // Agenda (espelha bookingDays/bookingEligible de _shared/forms.ts; no site quem decide é o servidor)
  var OFFSET_MIN = -180
  var WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  var WD_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  var MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n }
  function toMin(t) { var m = /^(\d{2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : NaN }
  function instant(date, hhmm) { return new Date(Date.parse(date + 'T' + hhmm + ':00Z') - OFFSET_MIN * 60000) }
  function timesOfDay(b, wd) {
    var out = []
    ;((b.week || {})[String(wd)] || []).forEach(function (r) {
      var a = toMin(r.start), z = toMin(r.end)
      if (isNaN(a) || isNaN(z)) return
      for (var t = a; t + b.durationMin <= z; t += b.durationMin) { var s = pad2(Math.floor(t / 60)) + ':' + pad2(t % 60); if (out.indexOf(s) < 0) out.push(s) }
    })
    return out.sort()
  }
  // Por prioridade: em cada turno, os `show` primeiros livres na ordem do turno (manhã: os mais tarde primeiro)
  function freeTimes(b, wd, isFree) {
    if (b.mode === 'range') return timesOfDay(b, wd).filter(isFree)
    if ((b.workdays || []).indexOf(wd) < 0) return []
    var out = []
    ;(b.shifts || []).forEach(function (s) {
      var order = (s.times || []).slice().sort()
      if (s.order !== 'early') order.reverse()
      order.filter(isFree).slice(0, s.show || 2).forEach(function (t) { if (out.indexOf(t) < 0) out.push(t) })
    })
    return out.sort()
  }
  function localDays(b, now) {
    var out = [], earliest = now.getTime() + b.noticeHours * 3600000
    var today = new Date(now.getTime() + OFFSET_MIN * 60000).toISOString().slice(0, 10)
    for (var i = 0; i < 21 && out.length < b.days; i++) {
      var date = new Date(Date.parse(today + 'T12:00:00Z') + i * 86400000).toISOString().slice(0, 10)
      var wd = new Date(date + 'T12:00:00Z').getUTCDay()
      var times = freeTimes(b, wd, function (t) { return instant(date, t).getTime() >= earliest })
      if (times.length) out.push({ date: date, weekday: wd, times: times })
    }
    return out
  }
  function slotLabel(date, hhmm) {
    var wd = new Date(date + 'T12:00:00Z').getUTCDay()
    return WD_FULL[wd] + ', ' + date.slice(8, 10) + '/' + date.slice(5, 7) + ' às ' + hhmm
  }

  // Ícones de traço (Lucide, ISC), os mesmos nomes de ICONS em _shared/forms.ts
  var ICON = {
'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    'calendar': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'dollar-sign': '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    'award': '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
    'palette': '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'briefcase': '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    'store': '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    'handshake': '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
    'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    'gem': '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    'chart-line': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
    'calendar-days': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
    'instagram': '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
  }

  function icon(name, cls) {
    var body = ICON[name]
    if (!body) return null
    var wrap = document.createElement('span')
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>'
    var svg = wrap.firstChild
    if (cls) svg.setAttribute('class', cls)
    return svg
  }

  function mount(host, config, opts) {
    opts = opts || {}
    var root = host.shadowRoot || host.attachShadow({ mode: 'open' })
    var cfg = config
    var answers = {}
    var cur = 0
    var done = false
    var started = false
    var busy = false
    var origin = opts.preview ? {} : tracking()
    var pixel = opts.preview ? null : pixelOf(cfg, host)
    // Telas: welcome (capa) → steps (perguntas) → result (fim) | booking (agenda) → booked (agradecimento)
    var screen = welcomeOn() ? 'welcome' : 'steps'
    var agenda = null // { token, submission, days }
    var picked = { day: 0, time: null }
    var lastRes = null
    var booked = null
    loadFont(cfg.theme.font)

    function welcomeOn() { var w = cfg.definition.welcome; return !!(w && w.enabled && (w.title || (w.bullets && w.bullets.length))) }
    function base() { return { form_id: cfg.id, form_name: cfg.name } }
    function names() { return pixelNames(pixel) }
    // A primeira interação: o clique em começar ou a primeira resposta (o que vier antes)
    function firstTouch() {
      if (started) return
      started = true
      if (opts.preview) return
      track(host, 'form_start', base())
      fb(pixel, names().first, base())
    }

    function steps() { return cfg.definition.steps }
    function stepVisible(i) { return steps()[i].fields.some(function (f) { return visible(f, answers) }) }
    function nextIndex(from) { for (var i = from + 1; i < steps().length; i++) if (stepVisible(i)) return i; return -1 }
    function prevIndex(from) { for (var i = from - 1; i >= 0; i--) if (stepVisible(i)) return i; return -1 }

    function read(step, wrap) {
      step.fields.forEach(function (f) {
        if (!visible(f, answers)) { delete answers[f.id]; return }
        var box = wrap.querySelector('[data-f="' + f.id + '"]')
        if (!box) return
        if (f.type === 'multi') answers[f.id] = [].map.call(box.querySelectorAll('input:checked'), function (i) { return i.value })
        else if (isPick(f.type) && f.type !== 'select') { var c = box.querySelector('input:checked'); if (c) answers[f.id] = c.value; else delete answers[f.id] }
        else { var i = box.querySelector('input,textarea,select'); if (i) answers[f.id] = i.value.trim() }
      })
    }

    function validate(step, wrap) {
      // Modo teste da prévia: avança sem conferir (só no editor; no site e no /f/ a validação vale sempre)
      if (opts.preview && opts.test) {
        ;[].forEach.call(wrap.querySelectorAll('.bad'), function (b) { b.classList.remove('bad'); var e = b.querySelector('.er'); if (e) e.textContent = '' })
        return true
      }
      var first = null
      step.fields.forEach(function (f) {
        var box = wrap.querySelector('[data-f="' + f.id + '"]')
        if (!box) return
        var msg = ''
        if (visible(f, answers)) {
          var v = asList(answers[f.id]).filter(Boolean)
          if (!v.length) { if (f.required) msg = isPick(f.type) ? 'Escolha uma opção.' : 'Preencha este campo.' }
          else if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v[0])) msg = 'Confira o e-mail.'
          else if (f.type === 'phone' && v[0].replace(/\D/g, '').length < 10) msg = 'Digite o telefone com DDD.'
          else if (f.type === 'number' && isNaN(Number(v[0].replace(',', '.')))) msg = 'Digite só números.'
        }
        var er = box.querySelector('.er')
        er.textContent = msg
        box.classList.toggle('bad', !!msg)
        var control = box.querySelector('input,textarea,select')
        if (control) control.setAttribute('aria-invalid', msg ? 'true' : 'false')
        if (msg && !first) first = control
      })
      if (first) first.focus()
      return !first
    }

    function field(f, step) {
      var id = 'q-' + f.id
      var box = el('div', { class: 'fl' + (f.width === 'half' ? ' half' : ''), 'data-f': f.id, hidden: !visible(f, answers) })
      var req = f.required ? el('span', { class: 'req', 'aria-hidden': 'true', text: '*' }) : null
      var help = f.help ? el('p', { class: 'h', id: id + '-h', text: f.help }) : null
      var err = el('p', { class: 'er', id: id + '-e', role: 'alert' })
      var desc = (f.help ? id + '-h ' : '') + id + '-e'
      var saved = answers[f.id]
      // Pergunta única com título na tela (uma por tela): o rótulo repetiria o título, fica só para leitor de tela
      var lone = !!step.title && step.fields.length === 1

      if (isPick(f.type) && f.type !== 'select') {
        var choices = optionsOf(f)
        var multi = f.type === 'multi'
        var legend = el('legend', { class: lone ? 'sr' : null, text: f.label }, [req])
        var wrap = el('div', { class: 'ops' + (multi ? ' multi' : '') + (f.type === 'rating' ? ' stars' : '') })
        choices.forEach(function (o) {
          var on = multi ? asList(saved).indexOf(o.id) >= 0 : saved === o.id
          var input = el('input', { type: multi ? 'checkbox' : 'radio', name: id, value: o.id, checked: on, 'aria-describedby': desc })
          wrap.appendChild(el('label', { class: 'op' }, [input, f.type === 'rating' ? null : el('i'), f.type === 'rating' ? el('b', { text: o.label }) : el('span', { text: o.label })]))
        })
        var fs = el('fieldset', { style: 'margin:0;padding:0;border:0;min-width:0', 'aria-required': f.required ? 'true' : null }, [legend, help, wrap])
        box.appendChild(fs)
        box.appendChild(err)
        wrap.addEventListener('change', function () {
          firstTouch()
          read(step, root.querySelector('.st'))
          refresh()
          var single = !multi && step.fields.length === 1
          // Uma pergunta de escolha única por tela avança sozinha (o jeito do quiz)
          if (single && (cfg.settings.autoAdvance || cfg.definition.kind === 'quiz')) setTimeout(function () { next() }, 220)
        })
        return box
      }

      var label = el('label', { class: 'l' + (lone ? ' sr' : ''), for: id, text: f.label }, [req])
      var control
      if (f.type === 'long') control = el('textarea', { id: id, placeholder: f.placeholder, 'aria-describedby': desc })
      else if (f.type === 'select') {
        control = el('select', { id: id, 'aria-describedby': desc }, [el('option', { value: '', text: f.placeholder || 'Selecione…' })].concat(optionsOf(f).map(function (o) { return el('option', { value: o.id, text: o.label }) })))
      } else {
        control = el('input', {
          class: 't', id: id, 'aria-describedby': desc, placeholder: f.placeholder,
          type: f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text',
          inputmode: f.type === 'number' ? 'decimal' : f.type === 'phone' ? 'numeric' : null,
          autocomplete: f.map === 'name' ? 'name' : f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'off',
        })
      }
      if (saved) control.value = saved
      control.addEventListener('input', function () {
        if (f.type === 'phone') control.value = maskPhone(control.value)
        firstTouch()
        if (box.classList.contains('bad')) { box.classList.remove('bad'); err.textContent = '' }
        answers[f.id] = control.value.trim()
        refresh()
      })
      control.addEventListener('change', function () { answers[f.id] = control.value.trim(); refresh() })
      box.appendChild(label)
      if (help) box.appendChild(help)
      box.appendChild(control)
      box.appendChild(err)
      return box
    }

    // Mostra e esconde os campos que dependem de respostas (sem redesenhar a etapa)
    function refresh() {
      var wrap = root.querySelector('.st')
      if (!wrap) return
      steps()[cur].fields.forEach(function (f) {
        var box = wrap.querySelector('[data-f="' + f.id + '"]')
        if (box) box.hidden = !visible(f, answers)
      })
    }

    function bar() {
      var idx = [], pos = 0
      steps().forEach(function (s, i) { if (stepVisible(i) || i === cur) { idx.push(i); if (i <= cur) pos = idx.length } })
      var b = el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(((pos - 1) / Math.max(idx.length, 1)) * 100)) })
      b.appendChild(el('i', { style: 'width:' + Math.round((pos / Math.max(idx.length, 1)) * 100) + '%' }))
      return b
    }

    function frame(children, extra) {
      var f = el('form', { class: 'f ' + cfg.theme.frame + (cfg.theme.fieldStyle === 'outline' ? ' ol' : '') + (extra ? ' ' + extra : ''), novalidate: true }, children)
      f.addEventListener('submit', function (e) { e.preventDefault(); next() })
      root.innerHTML = ''
      root.appendChild(el('style', { text: css(cfg.theme) }))
      root.appendChild(f)
      return f
    }

    function renderWelcome(focus) {
      var w = cfg.definition.welcome
      // Três partes (logo, texto, botão) numa coluna: o alinhamento escolhe onde elas ficam na altura da tela
      var logo = w.logoUrl ? el('div', { class: 'wl wl-logo lg-' + (w.logoAlign || 'left') }, [el('img', { class: 'logo', src: w.logoUrl, alt: cfg.name, decoding: 'async' })]) : null
      var box = el('div', { class: 'wl wl-mid' })
      var h = el('h1')
      var hi = w.icon ? icon(w.icon, 'hi') : null
      if (hi) h.appendChild(hi)
      rich(h, w.title)
      box.appendChild(h)
      var bullets = (w.bullets || []).filter(function (b) { return b.text })
      if (bullets.length) {
        box.appendChild(el('ul', null, bullets.map(function (b) {
          var i = b.icon ? icon(b.icon) : null
          return el('li', { class: i ? null : 'noi' }, [i, el('span', { text: b.text, title: b.text })])
        })))
      }
      if (w.footnote) {
        var arr = arrow()
        arr.removeAttribute('class')
        box.appendChild(el('p', { class: 'ft' }, [arr, el('span', { text: w.footnote })]))
      }
      var go = el('button', { type: 'submit', class: 'start' }, [el('span', { text: w.buttonLabel || 'Começar' }), arrow()])
      var foot = el('div', { class: 'wl wl-end' }, [go, opts.preview ? el('p', { class: 'pv', text: 'Prévia: nada é enviado.' }) : null])
      frame([logo, box, foot], 'wlf va-' + (w.valign || 'top'))
      if (focus) go.focus({ preventScroll: true })
    }

    function start() {
      firstTouch()
      screen = 'steps'
      render(true)
    }

    function bookingCfg() { return cfg.settings.booking }

    function renderBooking(message, focusSel) {
      var b = bookingCfg()
      var days = (agenda && agenda.days) || []
      var wrap = el('div', { class: 'ag' })
      wrap.appendChild(el('h3', { text: b.title }))
      wrap.appendChild(el('div', { class: 'meet' }, [
        el('span', { class: 'mi', 'aria-hidden': 'true' }, [icon('calendar')]),
        el('div', null, [el('b', { text: b.meetingName }), el('small', null, [icon('clock'), el('span', { text: b.durationMin + ' minutos' })])]),
      ]))
      if (!days.length) {
        wrap.appendChild(el('p', { class: 'none', text: 'Nenhum horário livre nos próximos dias. Nossa equipe vai falar com você para combinar.' }))
        frame([wrap])
        return
      }
      if (picked.day >= days.length) picked.day = 0
      var day = days[picked.day]
      if (picked.time && day.times.indexOf(picked.time) < 0) picked.time = null
      wrap.appendChild(el('p', { class: 'cap', text: 'Escolha o dia' }))
      var row = el('div', { class: 'days', role: 'group', 'aria-label': 'Dias disponíveis', style: '--n:' + days.length })
      days.forEach(function (d, i) {
        var btn = el('button', { type: 'button', 'aria-pressed': i === picked.day ? 'true' : 'false', 'data-k': 'd' + i, 'aria-label': WD_FULL[d.weekday] + ', ' + +d.date.slice(8, 10) + ' de ' + MONTHS[+d.date.slice(5, 7) - 1] }, [
          el('span', { class: 'w', text: WD[d.weekday] }),
          el('span', { class: 'd', text: d.date.slice(8, 10) + ' ' + MONTHS[+d.date.slice(5, 7) - 1] }),
        ])
        btn.addEventListener('click', function () { picked.day = i; picked.time = null; renderBooking(null, '[data-k="d' + i + '"]') })
        row.appendChild(btn)
      })
      wrap.appendChild(row)
      wrap.appendChild(el('p', { class: 'cap' }, [document.createTextNode('Escolha o horário'), el('span', { text: 'Horário de Brasília' })]))
      var grid = el('div', { class: 'times', role: 'group', 'aria-label': 'Horários disponíveis' })
      day.times.forEach(function (t) {
        var btn = el('button', { type: 'button', text: t, 'aria-pressed': t === picked.time ? 'true' : 'false', 'data-k': 't' + t })
        btn.addEventListener('click', function () { picked.time = t; renderBooking(null, '[data-k="t' + t + '"]') })
        grid.appendChild(btn)
      })
      wrap.appendChild(grid)
      if (message) wrap.appendChild(el('p', { class: 'er', role: 'alert', text: message, style: 'margin:0 0 12px' }))
      var go = el('button', { type: 'submit', class: 'go wide', disabled: !picked.time || busy }, [el('span', { text: busy ? 'Confirmando…' : picked.time ? b.confirmLabel + ' · ' + picked.time : b.confirmLabel }), busy ? null : icon('check')])
      var children = [wrap, go]
      if (opts.preview) children.push(el('p', { class: 'pv', text: 'Prévia: os horários seguem a configuração, sem as reservas.' }))
      frame(children)
      var f = focusSel && root.querySelector(focusSel)
      if (f) f.focus({ preventScroll: true })
    }

    function openBooking(res) {
      lastRes = res
      agenda = res.booking
      picked = { day: 0, time: null }
      screen = 'booking'
      renderBooking()
      if (!opts.preview) { track(host, 'schedule_view', base()); fb(pixel, names().viewScheduled, base()) }
      scrollIn()
    }

    function confirmBooking() {
      if (busy || !picked.time || !agenda) return
      var day = agenda.days[picked.day]
      var at = instant(day.date, picked.time)
      var b = bookingCfg()
      if (opts.preview) { booked = { label: slotLabel(day.date, picked.time) }; screen = 'booked'; renderBooked(); return }
      busy = true
      renderBooking()
      var body = JSON.stringify({ action: 'book', id: cfg.id, submission: agenda.submission, token: agenda.token, start: at.toISOString(), meta: metaNow(origin) })
      fetch(opts.endpoint, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: body, keepalive: true })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j } }) })
        .then(function (r) {
          busy = false
          if (!r.ok) {
            if (r.body && r.body.days) { agenda.days = r.body.days; picked.time = null }
            renderBooking((r.body && r.body.error) || 'Não deu para reservar. Tente de novo.')
            return
          }
          booked = { label: r.body.label || slotLabel(day.date, picked.time), id: r.body.bookingId }
          var data = Object.assign(base(), { content_name: b.meetingName, starts_at: at.toISOString() })
          track(host, 'schedule_confirmed', data)
          fb(pixel, names().scheduled, data, booked.id + ':scheduled')
          if (pixel && pixel.standardSchedule) fb(pixel, 'Schedule', data, booked.id + ':schedule')
          if (cfg.settings.redirectUrl) { location.href = cfg.settings.redirectUrl; return }
          screen = 'booked'
          renderBooked()
          scrollIn()
        })
        .catch(function () { busy = false; renderBooking('Sem conexão. Confira a internet e tente de novo.') })
    }

    function renderBooked() {
      var b = bookingCfg()
      var out = el('div', { class: 'out', role: 'status' })
      out.appendChild(el('div', { class: 'ok', 'aria-hidden': 'true' }, [icon('check')]))
      out.appendChild(el('h3', { text: b.successTitle }))
      if (booked && booked.label) out.appendChild(el('div', { class: 'when' }, [icon('calendar'), el('span', { text: booked.label + ' · ' + b.durationMin + ' min' })]))
      if (b.successText) out.appendChild(el('p', { class: 'd', text: b.successText, style: 'margin:0' }))
      if (lastRes && lastRes.whatsappUrl) {
        out.appendChild(el('div', { class: 'cta' }, [
          el('a', { class: 'btn wa', href: lastRes.whatsappUrl, target: '_blank', rel: 'noopener', 'aria-label': 'Falar no WhatsApp (abre em uma nova aba)' }, [wa(), el('span', { text: 'Falar no WhatsApp' }), arrow()]),
        ]))
      }
      if (opts.preview) out.appendChild(el('p', { class: 'pv', text: 'Prévia: nada foi reservado.' }))
      frame([out])
    }

    function scrollIn() {
      var f = root.querySelector('.f')
      if (f && f.scrollIntoView && !opts.preview) f.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }

    // Prévia: a agenda com os horários da configuração (sem reservas) para quem passaria no filtro
    function previewEligible(qualified) {
      var b = bookingCfg()
      if (!b || !b.enabled) return false
      var g = b.gate || { mode: 'all' }
      if (g.mode === 'qualified') return cfg.definition.kind === 'quiz' ? qualified === true : true
      if (g.mode === 'answer') {
        var f = null
        steps().forEach(function (s) { s.fields.forEach(function (x) { if (x.id === g.field) f = x }) })
        return !!f && visible(f, answers) && asList(answers[g.field]).some(function (v) { return (g.values || []).indexOf(v) >= 0 })
      }
      return true
    }

    function render(focus) {
      if (screen === 'welcome') return renderWelcome(focus)
      if (screen === 'booking') return renderBooking()
      if (screen === 'booked') return renderBooked()
      if (done) return
      var step = steps()[cur]
      if (!step) { frame([el('p', { text: 'Este formulário ainda não tem campos.' })]); return }
      var last = nextIndex(cur) < 0
      var s = cfg.settings
      var wrap = el('div', { class: 'st' })
      if (step.title) wrap.appendChild(el('h3', { text: step.title }))
      if (step.description) wrap.appendChild(el('p', { class: 'd', text: step.description }))
      if (step.note && step.note.trim()) wrap.appendChild(el('p', { class: 'nt', text: step.note.trim() }))
      step.fields.forEach(function (f) { wrap.appendChild(field(f, step)) })
      var go = el('button', { type: 'submit', class: 'go', text: busy ? 'Enviando…' : last ? s.submitLabel : s.nextLabel, disabled: busy })
      var toWelcome = prevIndex(cur) < 0 && welcomeOn()
      var back = prevIndex(cur) >= 0 || toWelcome ? el('button', { type: 'button', class: 'bk', text: '← Voltar' }) : null
      if (back) back.addEventListener('click', function () {
        read(step, wrap)
        if (toWelcome) screen = 'welcome'
        else cur = prevIndex(cur)
        render(true)
      })
      var children = []
      if (s.showProgress && steps().length > 1) children.push(bar())
      children.push(wrap)
      children.push(el('div', { class: 'hp', 'aria-hidden': 'true' }, [el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' })]))
      children.push(el('div', { class: 'row' }, [back, go]))
      if (s.footnote) children.push(el('p', { class: 'fn', text: s.footnote }))
      if (opts.preview) children.push(el('p', { class: 'pv', text: opts.test ? 'Modo teste: avança sem preencher. Nada é enviado.' : 'Prévia: nada é enviado.' }))
      frame(children)
      if (focus) {
        var f = root.querySelector('.st input:not([type=hidden]),.st textarea,.st select')
        if (f && step.fields.length) f.focus({ preventScroll: true })
      }
    }

    function finish(res) {
      done = true
      screen = 'result'
      lastRes = res
      var s = cfg.settings
      var out = el('div', { class: 'out', role: 'status' })
      out.appendChild(el('div', { class: 'ok', 'aria-hidden': 'true' }, [icon('check')]))
      if (cfg.settings.showScore === true && res.score !== null && res.score !== undefined && cfg.definition.kind === 'quiz' && res.result) out.appendChild(el('div', { class: 'pts', text: res.score + ' pontos' }))
      out.appendChild(el('h3', { text: res.result ? res.result.title : s.successTitle }))
      var text = res.result ? res.result.text : s.successText
      if (text) out.appendChild(el('p', { class: 'd', text: text, style: 'margin:0' }))
      var cta = el('div', { class: 'cta' })
      if (res.whatsappUrl) {
        cta.appendChild(el('a', { class: 'btn wa', href: res.whatsappUrl, target: '_blank', rel: 'noopener', 'aria-label': 'Continuar no WhatsApp (abre em uma nova aba)' }, [wa(), el('span', { text: 'Continuar no WhatsApp' }), arrow()]))
        cta.appendChild(el('p', { class: 'sub', text: 'Suas respostas já vão na mensagem.' }))
      }
      if (res.result && res.result.ctaUrl) cta.appendChild(el('a', { class: 'btn ' + (res.whatsappUrl ? 'alt' : 'wa-off'), href: res.result.ctaUrl, text: res.result.ctaLabel || 'Continuar', style: res.whatsappUrl ? null : 'background:var(--p);color:#fff' }))
      if (cta.childNodes.length) out.appendChild(cta)
      if (opts.preview) out.appendChild(el('p', { class: 'pv', text: 'Prévia: nada foi enviado.' }))
      frame([out])
      var f = root.querySelector('.out')
      if (f && f.scrollIntoView && !opts.preview) f.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }

    function submit() {
      var def = cfg.definition
      var hp = root.querySelector('input[name=website]')
      if (opts.preview) {
        var pts = score(def, answers)
        var r = resultFor(def, pts)
        var res = { score: def.kind === 'quiz' ? pts : null, result: r }
        if (previewEligible(r ? !!r.qualified : null)) openBooking(Object.assign(res, { booking: { token: '', submission: '', days: localDays(bookingCfg(), new Date()) } }))
        else finish(res)
        return
      }
      busy = true
      render(false)
      var body = JSON.stringify({ id: cfg.id, answers: answers, hp: hp ? hp.value : '', meta: metaNow(origin) })
      fetch(opts.endpoint, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: body, keepalive: true })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j } }) })
        .then(function (r) {
          busy = false
          if (!r.ok) {
            // Erro de campo no servidor: volta para a etapa e mostra
            var errs = r.body.errors || {}
            var bad = Object.keys(errs)[0]
            if (bad) {
              for (var i = 0; i < steps().length; i++) if (steps()[i].fields.some(function (f) { return f.id === bad })) { cur = i; break }
              render(false)
              var wrap = root.querySelector('.st')
              Object.keys(errs).forEach(function (k) { var b = wrap.querySelector('[data-f="' + k + '"]'); if (b) { b.classList.add('bad'); b.querySelector('.er').textContent = errs[k] } })
              return
            }
            render(false)
            var row = root.querySelector('.row')
            if (row) row.insertAdjacentElement('beforebegin', el('p', { class: 'er', role: 'alert', text: r.body.error || 'Não deu para enviar. Tente de novo.' }))
            return
          }
          var data = base()
          push('form_submit', data)
          if (r.body.qualified === true) push('lead_qualificado', data)
          else if (r.body.qualified === false) push('lead_nao_qualificado', data)
          emit(host, { event: 'form_submit', form_id: cfg.id, form_name: cfg.name, qualified: r.body.qualified })
          // Pixel: os mesmos ids que a função manda pela API de Conversões (a Meta junta os dois)
          if (pixel) {
            var sid = r.body.submissionId || String(Date.now())
            var pdata = Object.assign(base(), { content_name: cfg.name, qualified: r.body.qualified })
            fb(pixel, pixel.submitEvent === 'custom' || !pixel.submitEvent ? names().submit : pixel.submitEvent, pdata, sid + ':submit')
            if (pixel.standardLead && r.body.qualified !== false && pixel.submitEvent !== 'Lead') fb(pixel, 'Lead', pdata, sid + ':lead')
          }
          if (r.body.booking) { openBooking(r.body); return }
          if (r.body.redirectUrl) { location.href = r.body.redirectUrl; return }
          finish(r.body)
        })
        .catch(function () {
          busy = false
          render(false)
          var row = root.querySelector('.row')
          if (row) row.insertAdjacentElement('beforebegin', el('p', { class: 'er', role: 'alert', text: 'Sem conexão. Confira a internet e tente de novo.' }))
        })
    }

    function next() {
      if (screen === 'welcome') return start()
      if (screen === 'booking') return confirmBooking()
      if (busy || done) return
      var wrap = root.querySelector('.st')
      var step = steps()[cur]
      read(step, wrap)
      if (!validate(step, wrap)) return
      var n = nextIndex(cur)
      if (n < 0) submit()
      else {
        cur = n
        if (!opts.preview) push('form_step', Object.assign(base(), { step: n + 1, steps: steps().length }))
        render(true)
      }
    }

    function firstStep() { cur = 0; if (steps().length && !stepVisible(cur)) { var f = nextIndex(-1); if (f >= 0) cur = f } }

    firstStep()
    render(false)
    return {
      // Prévia ao vivo: troca a definição mantendo, se der, a tela, a etapa e as respostas
      update: function (next) {
        cfg = next
        if (!opts.preview) pixel = pixelOf(cfg, host)
        loadFont(cfg.theme.font)
        if (cur >= steps().length) cur = Math.max(0, steps().length - 1)
        if (screen === 'welcome' && !welcomeOn()) screen = 'steps'
        if (screen === 'booking') {
          if (!bookingCfg() || !bookingCfg().enabled) { screen = 'steps'; done = false }
          else if (opts.preview) agenda = { token: '', submission: '', days: localDays(bookingCfg(), new Date()) }
        }
        if (screen === 'booked' && (!bookingCfg() || !bookingCfg().enabled)) screen = 'steps'
        if (screen === 'result' && lastRes) { finish(lastRes); return }
        if (screen === 'steps') done = false
        render(false)
      },
      // Prévia: pular para uma tela (capa, perguntas, agenda, fim)
      show: function (name) {
        done = false
        busy = false
        if (name === 'welcome' && welcomeOn()) { screen = 'welcome'; render(false); return }
        if ((name === 'booking' || name === 'booked') && bookingCfg() && bookingCfg().enabled) {
          lastRes = { score: null }
          agenda = { token: '', submission: '', days: localDays(bookingCfg(), new Date()) }
          picked = { day: 0, time: name === 'booked' ? null : null }
          if (name === 'booked') {
            var d = agenda.days[0]
            booked = { label: d ? slotLabel(d.date, d.times[0]) : '' }
            screen = 'booked'
          } else screen = 'booking'
          render(false)
          return
        }
        if (name === 'done') {
          var def = cfg.definition
          var r = def.kind === 'quiz' ? def.results.filter(function (x) { return !x.qualified })[0] || def.results[0] : null
          finish({ score: null, result: r || null })
          return
        }
        screen = 'steps'
        firstStep()
        render(false)
      },
      screen: function () { return screen },
      // Prévia: liga e desliga o modo teste sem perder a tela e as respostas
      setTest: function (on) { if (opts.preview) { opts.test = !!on; if (screen === 'steps' && !done) render(false) } },
      // A pessoa já mexeu (digitou, respondeu, avançou ou enviou): nada de trocar o formulário debaixo dela
      touched: function () { return started || done || screen !== 'welcome' && screen !== 'steps' || cur > 0 || Object.keys(answers).some(function (k) { return asList(answers[k]).length }) },
      destroy: function () { root.innerHTML = '' },
    }
  }

  // Sem tela de carregamento: só guarda o lugar (invisível) para a página não pular quando o formulário entrar
  function reserve(host) {
    var root = host.shadowRoot || host.attachShadow({ mode: 'open' })
    root.innerHTML = ''
    root.appendChild(el('div', { style: 'min-height:220px', 'aria-hidden': 'true' }))
  }

  function fetchJson(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) {
      if (r.status === 404) { var e = new Error('404'); e.notFound = true; throw e }
      if (!r.ok) throw new Error(String(r.status))
      return r.json()
    })
  }

  function boot(host) {
    if (host.__avence) return
    var id = host.getAttribute('data-avence-form')
    var endpoint = host.getAttribute('data-endpoint')
    if (!id || !endpoint) return
    host.__avence = true
    var key = 'avence-form:' + id
    var cached = null
    try { cached = JSON.parse(localStorage.getItem(key) || 'null') } catch (e) {}
    // A cópia que vai junto com o código (widget do editor): abre direto, sem esperar a rede
    var snap = null
    try { var tag = host.querySelector('script[type="application/json"]'); if (tag) snap = JSON.parse(tag.textContent) } catch (e) {}
    var shown = (cached && cached.definition && cached) || (snap && snap.definition && snap) || null
    var handle = null
    // Mostra o que já tem (cópia do navegador ou do código) na hora; o servidor confirma por trás
    if (shown) { handle = mount(host, shown, { endpoint: endpoint }); emit(host, { event: 'form_config', config: shown }) }
    else reserve(host)

    // O arquivo do CDN é o caminho rápido; a função é a rede de segurança (e vale para formulários antigos)
    var url = host.getAttribute('data-config')
    var load = url ? fetchJson(url).catch(function () { return fetchJson(endpoint + '?id=' + encodeURIComponent(id)) }) : fetchJson(endpoint + '?id=' + encodeURIComponent(id))
    load
      .then(function (cfg) {
        try { localStorage.setItem(key, JSON.stringify(cfg)) } catch (e) {}
        if (!handle) handle = mount(host, cfg, { endpoint: endpoint })
        else if (JSON.stringify(cfg) !== JSON.stringify(shown) && !handle.touched()) handle.update(cfg)
        emit(host, { event: 'form_config', config: cfg })
        track(host, 'form_view', { form_id: cfg.id, form_name: cfg.name })
        var px = pixelOf(cfg, host)
        if (px) fb(px, pixelNames(px).view, { form_id: cfg.id, form_name: cfg.name })
        // Conta a visualização sem pôr a pessoa para esperar
        try { fetch(endpoint + '?id=' + encodeURIComponent(id) + '&view=1', { keepalive: true, credentials: 'omit' }).catch(function () {}) } catch (e) {}
      })
      .catch(function (err) {
        // Formulário despublicado: some da página e esquece a cópia
        if (err && err.notFound) {
          emit(host, { event: 'form_unavailable' })
          try { localStorage.removeItem(key) } catch (e) {}
          if (!handle || !handle.touched()) { if (handle) handle.destroy(); else host.shadowRoot.innerHTML = '' }
        } else if (!handle) { host.shadowRoot.innerHTML = ''; host.__avence = false }
      })
  }

  function scan() { [].forEach.call(document.querySelectorAll('[data-avence-form]'), boot) }

  window.AvenceForms = { mount: mount, scan: scan }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan)
  else scan()
  // O Elementor monta widgets depois do carregamento (editor, popups): reescaneia o que aparecer
  if (window.MutationObserver) {
    var queued = false
    new MutationObserver(function () {
      if (queued) return
      queued = true
      requestAnimationFrame(function () { queued = false; scan() })
    }).observe(document.documentElement, { childList: true, subtree: true })
  }
})()
