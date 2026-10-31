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
 * lead ao CRM. Eventos no dataLayer: form_view, form_start, form_submit, lead_qualificado e
 * lead_nao_qualificado (quiz). Sem cookies; a origem (UTM, gclid, fbclid) fica na sessionStorage.
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
    if (f.type === 'yesno') return f.options && f.options.length === 2 ? f.options : [{ id: 'sim', label: 'Sim' }, { id: 'nao', label: 'Não' }]
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

  function el(tag, attrs, children) {
    var n = document.createElement(tag)
    for (var k in attrs || {}) {
      var v = attrs[k]
      if (v === undefined || v === null || v === false) continue
      if (k === 'class') n.className = v
      else if (k === 'text') n.textContent = v
      else n.setAttribute(k, v === true ? '' : v)
    }
    ;(children || []).forEach(function (c) { if (c) n.appendChild(c) })
    return n
  }

  function css(t) {
    var font = t.font === 'Inter' ? "'Inter', system-ui, sans-serif" : t.font === 'system' ? 'system-ui, -apple-system, Segoe UI, sans-serif' : 'inherit'
    return (
      ':host{display:block;--p:' + t.primary + ';--bg:' + t.background + ';--tx:' + t.text + ';--fd:' + t.field + ';--r:' + t.radius + 'px;font-family:' + font + ';color:var(--tx);line-height:1.45}' +
      '*{box-sizing:border-box}' +
      '.f{background:var(--bg);color:var(--tx);border-radius:calc(var(--r) * 1.6);padding:28px;position:relative;overflow:hidden}' +
      '.f.card{border:1px solid color-mix(in srgb,var(--tx) 14%,transparent)}' +
      '.f.plain{padding:0;background:transparent}' +
      '.bar{height:4px;border-radius:99px;background:color-mix(in srgb,var(--tx) 12%,transparent);margin-bottom:22px;overflow:hidden}' +
      '.bar i{display:block;height:100%;background:var(--p);border-radius:99px;transition:width .35s cubic-bezier(.22,1,.36,1)}' +
      'h3{font:inherit;font-size:1.5em;font-weight:650;letter-spacing:-.02em;margin:0 0 6px;line-height:1.2}' +
      '.d{margin:0 0 20px;opacity:.7}' +
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
      '.op{position:relative;display:flex;align-items:center;gap:12px;background:var(--fd);border:1.5px solid transparent;border-radius:var(--r);padding:13px 14px;cursor:pointer;transition:border-color .15s,background .15s,transform .1s}' +
      '.op:hover{border-color:color-mix(in srgb,var(--p) 45%,transparent)}.op:active{transform:scale(.985)}' +
      '.op input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}' +
      '.op i{flex:none;width:20px;height:20px;border:1.5px solid color-mix(in srgb,var(--tx) 35%,transparent);border-radius:50%;display:grid;place-items:center;transition:all .15s}' +
      '.multi .op i{border-radius:6px}' +
      '.op i::after{content:"";width:10px;height:10px;border-radius:50%;background:#fff;transform:scale(0);transition:transform .15s}' +
      '.multi .op i::after{border-radius:2px;width:9px;height:9px}' +
      '.op:has(input:checked){border-color:var(--p);background:color-mix(in srgb,var(--p) 9%,var(--fd))}' +
      '.op:has(input:checked) i{background:var(--p);border-color:var(--p)}.op:has(input:checked) i::after{transform:scale(1)}' +
      '.op:has(input:focus-visible){box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 25%,transparent)}' +
      '.stars{display:flex;gap:8px}.stars .op{padding:10px 0;justify-content:center;flex:1}.stars .op i{display:none}.stars .op b{font-weight:650}' +
      '.row{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:8px}' +
      'button{font:inherit;font-weight:650;font-size:1em;border:0;border-radius:var(--r);padding:13px 22px;cursor:pointer;transition:transform .1s,opacity .15s,background .15s}' +
      'button:active{transform:scale(.97)}button:focus-visible{outline:3px solid color-mix(in srgb,var(--p) 40%,transparent);outline-offset:2px}' +
      'button.go{background:var(--p);color:#fff;margin-left:auto}button.go:hover{filter:brightness(1.07)}button.go:disabled{opacity:.6;cursor:default}' +
      'button.bk{background:transparent;color:var(--tx);opacity:.65;padding-left:4px;padding-right:12px}button.bk:hover{opacity:1}' +
      '.sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
      '.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
      '.out{text-align:center;padding:12px 0}' +
      '.out .ok{width:52px;height:52px;border-radius:50%;background:color-mix(in srgb,var(--p) 14%,transparent);color:var(--p);display:grid;place-items:center;margin:0 auto 16px;font-size:26px}' +
      '.out a.go{display:inline-block;text-decoration:none;margin:14px 6px 0;color:#fff}' +
      '.out a.wa{background:#25d366;color:#0b2e17}' +
      '.pts{display:inline-block;font-size:.82em;font-weight:650;padding:4px 10px;border-radius:99px;background:color-mix(in srgb,var(--p) 12%,transparent);color:var(--p);margin-bottom:12px}' +
      '.pv{font-size:.78em;opacity:.55;margin-top:14px;text-align:center}' +
      '.st{animation:in .28s cubic-bezier(.22,1,.36,1)}' +
      '@keyframes in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}' +
      '@media (prefers-reduced-motion:reduce){.st{animation:none}.bar i,.op,button{transition:none}}' +
      '@media (max-width:480px){.f{padding:20px}}'
    )
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
      var box = el('div', { class: 'fl', 'data-f': f.id, hidden: !visible(f, answers) })
      var req = f.required ? el('span', { class: 'req', 'aria-hidden': 'true', text: '*' }) : null
      var help = f.help ? el('p', { class: 'h', id: id + '-h', text: f.help }) : null
      var err = el('p', { class: 'er', id: id + '-e', role: 'alert' })
      var desc = (f.help ? id + '-h ' : '') + id + '-e'
      var saved = answers[f.id]
      // Pergunta única com título na tela (o quiz): o rótulo repetiria o título, fica só para leitor de tela
      var lone = !!step.title && step.fields.length === 1 && cfg.definition.kind === 'quiz'

      if (isPick(f.type) && f.type !== 'select') {
        var opts = optionsOf(f)
        var multi = f.type === 'multi'
        var legend = el('legend', { class: lone ? 'sr' : null, text: f.label }, [req])
        var wrap = el('div', { class: 'ops' + (multi ? ' multi' : '') + (f.type === 'rating' ? ' stars' : '') })
        opts.forEach(function (o) {
          var on = multi ? asList(saved).indexOf(o.id) >= 0 : saved === o.id
          var input = el('input', { type: multi ? 'checkbox' : 'radio', name: id, value: o.id, checked: on, 'aria-describedby': desc })
          wrap.appendChild(el('label', { class: 'op' }, [input, f.type === 'rating' ? null : el('i'), f.type === 'rating' ? el('b', { text: o.label }) : el('span', { text: o.label })]))
        })
        var fs = el('fieldset', { style: 'margin:0;padding:0;border:0;min-width:0', 'aria-required': f.required ? 'true' : null }, [legend, help, wrap])
        box.appendChild(fs)
        box.appendChild(err)
        wrap.addEventListener('change', function () {
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
        if (!started) { started = true; if (!opts.preview) push('form_start', { form_id: cfg.id, form_name: cfg.name }) }
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

    function frame(children) {
      var f = el('form', { class: 'f ' + cfg.theme.frame, novalidate: true }, children)
      f.addEventListener('submit', function (e) { e.preventDefault(); next() })
      root.innerHTML = ''
      root.appendChild(el('style', { text: css(cfg.theme) }))
      root.appendChild(f)
      return f
    }

    function render(focus) {
      if (done) return
      var step = steps()[cur]
      if (!step) { frame([el('p', { text: 'Este formulário ainda não tem campos.' })]); return }
      var last = nextIndex(cur) < 0
      var s = cfg.settings
      var wrap = el('div', { class: 'st' })
      if (step.title) wrap.appendChild(el('h3', { text: step.title }))
      if (step.description) wrap.appendChild(el('p', { class: 'd', text: step.description }))
      step.fields.forEach(function (f) { wrap.appendChild(field(f, step)) })
      var go = el('button', { type: 'submit', class: 'go', text: busy ? 'Enviando…' : last ? s.submitLabel : s.nextLabel, disabled: busy })
      var back = prevIndex(cur) >= 0 ? el('button', { type: 'button', class: 'bk', text: '← Voltar' }) : null
      if (back) back.addEventListener('click', function () { read(step, wrap); cur = prevIndex(cur); render(true) })
      var children = []
      if (s.showProgress && steps().length > 1) children.push(bar())
      children.push(wrap)
      children.push(el('div', { class: 'hp', 'aria-hidden': 'true' }, [el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' })]))
      children.push(el('div', { class: 'row' }, [back, go]))
      if (opts.preview) children.push(el('p', { class: 'pv', text: 'Prévia: nada é enviado.' }))
      frame(children)
      if (focus) {
        var f = root.querySelector('.st input:not([type=hidden]),.st textarea,.st select')
        if (f && step.fields.length) f.focus({ preventScroll: true })
      }
    }

    function finish(res) {
      done = true
      var s = cfg.settings
      var out = el('div', { class: 'out', role: 'status' })
      out.appendChild(el('div', { class: 'ok', 'aria-hidden': 'true', text: '✓' }))
      if (res.score !== null && res.score !== undefined && cfg.definition.kind === 'quiz' && res.result) out.appendChild(el('div', { class: 'pts', text: res.score + ' pontos' }))
      out.appendChild(el('h3', { text: res.result ? res.result.title : s.successTitle }))
      var text = res.result ? res.result.text : s.successText
      if (text) out.appendChild(el('p', { class: 'd', text: text, style: 'margin:0' }))
      if (res.result && res.result.ctaUrl) out.appendChild(el('a', { class: 'go', href: res.result.ctaUrl, text: res.result.ctaLabel || 'Continuar' }))
      if (res.whatsappUrl) out.appendChild(el('a', { class: 'go wa', href: res.whatsappUrl, target: '_blank', rel: 'noopener', text: 'Falar no WhatsApp' }))
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
        finish({ score: def.kind === 'quiz' ? pts : null, result: r })
        return
      }
      busy = true
      render(false)
      var body = JSON.stringify({ id: cfg.id, answers: answers, hp: hp ? hp.value : '', meta: origin })
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
          var data = { form_id: cfg.id, form_name: cfg.name }
          push('form_submit', data)
          if (r.body.qualified === true) push('lead_qualificado', data)
          else if (r.body.qualified === false) push('lead_nao_qualificado', data)
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
      if (busy || done) return
      var wrap = root.querySelector('.st')
      var step = steps()[cur]
      read(step, wrap)
      if (!validate(step, wrap)) return
      var n = nextIndex(cur)
      if (n < 0) submit()
      else { cur = n; render(true) }
    }

    if (steps().length && !stepVisible(cur)) { var first = nextIndex(-1); if (first >= 0) cur = first }
    render(false)
    return {
      // Prévia ao vivo: troca a definição mantendo, se der, a etapa e as respostas
      update: function (next) {
        cfg = next
        if (cur >= steps().length) cur = Math.max(0, steps().length - 1)
        done = false
        render(false)
      },
      destroy: function () { root.innerHTML = '' },
    }
  }

  function boot(host) {
    if (host.__avence) return
    var id = host.getAttribute('data-avence-form')
    var endpoint = host.getAttribute('data-endpoint')
    if (!id || !endpoint) return
    host.__avence = true
    fetch(endpoint + '?id=' + encodeURIComponent(id) + '&view=1')
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then(function (cfg) {
        mount(host, cfg, { endpoint: endpoint })
        push('form_view', { form_id: cfg.id, form_name: cfg.name })
      })
      .catch(function () { host.__avence = false })
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
