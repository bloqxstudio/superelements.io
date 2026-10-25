/*!
 * Visitas: o script do painel Site do CRM (/crm/site).
 *
 * Vai uma vez no site (WordPress › Elementor › Código personalizado, no fim
 * do <body>):
 *   <script defer src="https://app.avencestudio.com/visitas.js" data-site="<chave>" data-endpoint="<função site-visitas>"></script>
 *
 * Manda para a função `site-visitas` cada página vista (com o tempo em uso e
 * até onde a pessoa rolou), os cliques em WhatsApp, telefone, e-mail, botões
 * e links, o começo e o envio de formulários e os eventos do dataLayer, com o
 * que o navegador diz do aparelho (tela, modelo, conexão) e os identificadores
 * do anúncio que vierem no link. A pessoa é um número aleatório guardado no
 * navegador dela; a função acha a cidade pelo IP sem guardá-lo; nada de cookie
 * de terceiros ou do que se digita nos formulários.
 *
 * `?visitas=off` no endereço do site deixa de contar este navegador (a
 * equipe); `?visitas=on` volta a contar; `?visitas=debug` mostra no console o
 * que seria mandado. Logado no WordPress, no editor do Elementor ou dentro de
 * um quadro, não conta. Eventos próprios: visitas('nome', { chave: 'valor' }).
 */
;(function () {
  'use strict'
  var script = document.currentScript
  var SITE = script && script.getAttribute('data-site')
  var ENDPOINT = (script && script.getAttribute('data-endpoint')) || 'https://nfmfcpcwyavutntnrxqq.supabase.co/functions/v1/site-visitas'
  if (!SITE || window.__visitas) return
  window.__visitas = 1

  var SESSION_MS = 30 * 60 * 1000
  var IDLE_MS = 60 * 1000
  var PING_MS = 20 * 1000
  var CONTACT_HOSTS = /^(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com|(www\.)?whatsapp\.com)$/i

  var params
  try {
    params = new URLSearchParams(location.search)
  } catch (e) {
    return
  }

  function read(store, key) {
    try {
      return window[store].getItem(key)
    } catch (e) {
      return null
    }
  }
  function write(store, key, value) {
    try {
      if (value === null) window[store].removeItem(key)
      else window[store].setItem(key, value)
    } catch (e) {}
  }

  var flag = params.get('visitas')
  if (flag === 'off') write('localStorage', 'visitas_off', '1')
  if (flag === 'on') write('localStorage', 'visitas_off', null)
  if (flag === 'debug') write('sessionStorage', 'visitas_debug', '1')
  var debug = read('sessionStorage', 'visitas_debug') === '1'
  var log = function () {
    if (debug && window.console) console.log.apply(console, ['[visitas]'].concat([].slice.call(arguments)))
  }
  if (read('localStorage', 'visitas_off') === '1') {
    if (window.console) console.info('[visitas] este navegador não é contado (?visitas=on volta a contar)')
    return
  }
  var body = document.body
  var skip =
    navigator.webdriver ||
    /HeadlessChrome|Lighthouse|PageSpeed/i.test(navigator.userAgent) ||
    params.has('elementor-preview') ||
    params.has('preview_id') ||
    params.has('customize_changeset_uuid') ||
    params.get('preview') === 'true' ||
    (body && /(^|\s)(logged-in|elementor-editor-active|elementor-editor-preview)(\s|$)/.test(body.className))
  try {
    if (window.top !== window.self) skip = true
  } catch (e) {
    skip = true
  }
  if (skip) {
    log('não conta aqui (logado no WordPress, editor, quadro ou robô)')
    return
  }

  function uid() {
    var c = window.crypto
    if (c && c.randomUUID) return c.randomUUID()
    var bytes = new Uint8Array(16)
    if (c && c.getRandomValues) c.getRandomValues(bytes)
    else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
    var hex = ''
    for (var j = 0; j < 16; j++) hex += (bytes[j] < 16 ? '0' : '') + bytes[j].toString(16)
    return hex
  }

  // ---------- quem e qual visita ----------

  var visitor = read('localStorage', 'visitas_v')
  if (!visitor || !/^[A-Za-z0-9-]{8,40}$/.test(visitor)) {
    visitor = uid()
    write('localStorage', 'visitas_v', visitor)
  }

  var CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id']
  function campaign() {
    var q = {}
    var any = false
    // utm_* e os identificadores que o link do anúncio pode trazer ({{campaign.id}}, {{ad.id}}, {{placement}} na Meta)
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'campaign_id', 'adset_id', 'ad_id', 'placement', 'site_source'].forEach(function (key) {
      var value = params.get(key)
      if (value) {
        q[key] = value.slice(0, 200)
        any = true
      }
    })
    for (var i = 0; i < CLICK_IDS.length; i++) {
      if (params.get(CLICK_IDS[i])) {
        q.click = CLICK_IDS[i]
        any = true
        break
      }
    }
    return any ? q : null
  }
  var landingCampaign = campaign()
  var campaignKey = landingCampaign ? [landingCampaign.utm_source, landingCampaign.utm_medium, landingCampaign.utm_campaign, landingCampaign.click].join('|') : ''

  var session = null
  var fresh = false
  /** A visita continua com menos de 30 minutos parada; uma campanha nova abre outra (como no Google Analytics). */
  function openSession(newCampaign) {
    var now = Date.now()
    var saved = null
    try {
      saved = JSON.parse(read('localStorage', 'visitas_s') || 'null')
    } catch (e) {}
    if (saved && saved.id && now - saved.last < SESSION_MS && !(newCampaign && campaignKey && saved.ck !== campaignKey)) {
      session = saved
      fresh = false
    } else {
      var n = (parseInt(read('localStorage', 'visitas_n') || '0', 10) || 0) + 1
      write('localStorage', 'visitas_n', String(n))
      session = { id: uid(), n: n, ck: newCampaign ? campaignKey : '' }
      fresh = true
    }
    session.last = now
    write('localStorage', 'visitas_s', JSON.stringify(session))
  }
  var lastTouch = 0
  function touchSession() {
    var now = Date.now()
    if (now - lastTouch < 5000) return
    lastTouch = now
    session.last = now
    write('localStorage', 'visitas_s', JSON.stringify(session))
  }

  // ---------- envio ----------

  var queue = []
  var timer = 0
  var context = {
    tz: (function () {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch (e) {
        return undefined
      }
    })(),
    lang: navigator.language,
    sw: screen.width,
    sh: screen.height,
    tp: navigator.maxTouchPoints || 0,
    vw: window.innerWidth,
    vh: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  }
  try {
    var connection = navigator.connection
    if (connection && connection.effectiveType) context.ct = connection.effectiveType
    if (window.matchMedia) context.cs = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    // O modelo do celular (Android no Chrome) e a versão do sistema chegam depois, junto dos próximos envios
    var hints = navigator.userAgentData
    if (hints && hints.getHighEntropyValues) {
      hints
        .getHighEntropyValues(['model', 'platformVersion'])
        .then(function (values) {
          if (values.model) context.model = String(values.model).slice(0, 60)
          if (values.platformVersion) context.pfv = String(values.platformVersion).slice(0, 20)
        })
        .catch(function () {})
    }
  } catch (e) {}

  function flush() {
    clearTimeout(timer)
    timer = 0
    while (queue.length) {
      var payload = JSON.stringify({ s: SITE, v: visitor, sid: session.id, n: session.n, h: location.hostname, c: context, e: queue.splice(0, 30) })
      var sent = false
      try {
        sent = !!(navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, payload))
      } catch (e) {}
      if (!sent && window.fetch) {
        try {
          fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(function () {})
        } catch (e) {}
      }
    }
    touchSession()
  }

  function send(hit, now) {
    log(hit.t === 'p' ? 'página' : hit.t === 'g' ? 'tempo' : 'evento', hit)
    queue.push(hit)
    if (now) flush()
    else if (!timer) timer = setTimeout(flush, 1500)
  }

  // ---------- página vista, tempo em uso e rolagem ----------

  var pv = ''
  var active = 0
  var lastTick = 0
  var lastInput = 0
  var visible = document.visibilityState !== 'hidden'
  var maxScroll = 0
  var sentMs = 0
  var sentScroll = 0
  var formsStarted = {}

  function tick() {
    var now = Date.now()
    if (visible) active += Math.max(0, Math.min(now, lastInput + IDLE_MS) - lastTick)
    lastTick = now
  }

  function depth() {
    var doc = document.documentElement
    var height = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0)
    var seen = (window.pageYOffset || doc.scrollTop || 0) + window.innerHeight
    var percent = height > 0 ? Math.min(100, Math.round((seen / height) * 100)) : 100
    if (percent > maxScroll) maxScroll = percent
  }

  function pageview(start) {
    pv = uid().replace(/-/g, '').slice(0, 12)
    active = 0
    sentMs = 0
    sentScroll = 0
    maxScroll = 0
    formsStarted = {}
    lastTick = lastInput = Date.now()
    var hit = { t: 'p', pv: pv, path: location.pathname, title: (document.title || '').slice(0, 200) }
    if (document.body && /(^|\s)error404(\s|$)/.test(document.body.className)) hit.data = { nf: 1 }
    if (start) {
      hit.start = 1
      hit.r = (document.referrer || '').slice(0, 500)
      if (landingCampaign) hit.q = landingCampaign
    }
    send(hit, true)
    depth()
  }

  function engagement(now) {
    tick()
    depth()
    if (active - sentMs < 1000 && maxScroll === sentScroll) return
    sentMs = active
    sentScroll = maxScroll
    send({ t: 'g', pv: pv, ms: Math.round(active), scroll: maxScroll }, now)
  }

  openSession(true)
  pageview(fresh)

  var lastMove = 0
  function onInput(e) {
    var now = Date.now()
    if (e.type === 'mousemove' && now - lastMove < 500) return
    lastMove = now
    tick()
    lastInput = now
    if (e.type === 'scroll') depth()
  }
  ;['scroll', 'mousemove', 'keydown', 'pointerdown', 'touchstart', 'wheel'].forEach(function (type) {
    window.addEventListener(type, onInput, { passive: true, capture: true })
  })

  setInterval(function () {
    if (!visible) return
    tick()
    if (active - sentMs >= 5000) engagement(true)
  }, PING_MS)

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      tick()
      visible = false
      engagement(true)
      flush()
    } else {
      visible = true
      lastTick = lastInput = Date.now()
      // Voltou depois de 30 minutos: é outra visita, que começa nesta página
      var saved = null
      try {
        saved = JSON.parse(read('localStorage', 'visitas_s') || 'null')
      } catch (e) {}
      if (!saved || Date.now() - saved.last >= SESSION_MS) {
        openSession(false)
        pageview(true)
      }
    }
  })
  window.addEventListener('pagehide', function () {
    engagement(true)
    flush()
  })
  // Voltou pelo botão de voltar (a página veio da memória do navegador): conta como página vista
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return
    openSession(false)
    pageview(fresh)
  })

  // ---------- eventos ----------

  function clean(value) {
    return (value || '').replace(/\s+/g, ' ').trim()
  }

  function labelOf(el) {
    var text = clean(el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || '')
    if (!text) {
      var img = el.querySelector && el.querySelector('img[alt]')
      if (img) text = clean(img.getAttribute('alt'))
    }
    return text.slice(0, 80)
  }

  /** Onde fica o clique: Cabeçalho, Rodapé, botão flutuante, `#id` da seção ou o título dela. */
  function sectionOf(el) {
    if (el.closest('.elementor-location-header, header')) return 'Cabeçalho'
    if (el.closest('.elementor-location-footer, footer')) return 'Rodapé'
    var top = el.closest('.e-con.e-parent, .elementor-top-section, section')
    var node = el
    for (var i = 0; node && node !== document.body && i < 25; i++, node = node.parentElement) {
      var position = getComputedStyle(node).position
      if (position === 'fixed' || position === 'sticky') {
        var rect = node.getBoundingClientRect()
        return rect.width > window.innerWidth * 0.6 && rect.top < 40 ? 'Cabeçalho' : 'Botão flutuante'
      }
      if (node === top) break
    }
    if (!top) return ''
    if (top.id) return '#' + top.id
    var heading = top.querySelector('h1, h2, h3, .elementor-heading-title')
    return heading ? clean(heading.textContent).slice(0, 60) : ''
  }

  function track(name, data, now) {
    send({ t: 'e', pv: pv, name: name, path: location.pathname, data: data || {} }, now)
  }

  document.addEventListener(
    'click',
    function (e) {
      var target = e.target
      if (!target || !target.closest) return
      var el = target.closest('a[href], button, [role="button"], input[type="submit"], input[type="button"]')
      if (!el) {
        // Pergunta aberta no acordeão (as dúvidas de quem visita)
        var summary = target.closest('summary')
        var details = summary && summary.parentElement
        if (details && details.tagName === 'DETAILS' && !details.open) track('pergunta', { texto: labelOf(summary), secao: sectionOf(summary) }, false)
        return
      }
      var href = el.getAttribute('href') || ''
      var url = null
      try {
        url = href ? new URL(href, location.href) : null
      } catch (x) {}
      var data = { texto: labelOf(el), secao: sectionOf(el) }
      var name = 'clique'
      if (url && (url.protocol === 'whatsapp:' || CONTACT_HOSTS.test(url.hostname))) name = 'whatsapp'
      else if (url && url.protocol === 'tel:') name = 'telefone'
      else if (url && url.protocol === 'mailto:') name = 'email'
      else if (url && /^https?:$/.test(url.protocol) && url.hostname.replace(/^www\./, '') !== location.hostname.replace(/^www\./, '')) {
        name = 'link_externo'
        data.destino = url.hostname.replace(/^www\./, '')
      } else if (url && /^https?:$/.test(url.protocol)) data.destino = url.pathname + url.hash
      track(name, data, true)
    },
    true
  )

  function formName(form) {
    return clean(form.getAttribute('name') || form.getAttribute('aria-label') || form.id || sectionOf(form) || 'Formulário').slice(0, 80)
  }

  // Começou a preencher (uma vez por formulário em cada página)
  document.addEventListener(
    'focusin',
    function (e) {
      var form = e.target && e.target.form
      if (!form || !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || /^(submit|button|hidden)$/.test(e.target.type)) return
      var key = formName(form)
      if (formsStarted[key]) return
      formsStarted[key] = 1
      track('formulario_inicio', { formulario: key, secao: sectionOf(form) })
    },
    true
  )

  // Enviado: o formulário do Elementor confirma pelo `submit_success`; os outros, pelo envio
  document.addEventListener(
    'submit',
    function (e) {
      var form = e.target
      if (!form || !form.tagName || (form.classList && form.classList.contains('elementor-form'))) return
      track('formulario', { formulario: formName(form), secao: sectionOf(form) }, true)
    },
    true
  )
  var hooked = false
  function hookElementor() {
    var $ = window.jQuery
    if (hooked || !$ || !$.fn) return
    hooked = true
    $(document).on('submit_success', function (e) {
      var form = e.target && e.target.tagName === 'FORM' ? e.target : null
      track('formulario', form ? { formulario: formName(form), secao: sectionOf(form) } : {}, true)
    })
  }
  hookElementor()
  window.addEventListener('load', hookElementor)

  // dataLayer (lead_qualificado, eventos do Tag Manager): o que for empurrado daqui em diante
  function simple(source, skip) {
    var data = {}
    var count = 0
    if (!source || typeof source !== 'object') return data
    for (var key in source) {
      if (count >= 10 || key === skip || !Object.prototype.hasOwnProperty.call(source, key)) continue
      var value = source[key]
      if (typeof value === 'string') data[key] = value.slice(0, 200)
      else if (typeof value === 'number' || typeof value === 'boolean') data[key] = value
      else continue
      count++
    }
    return data
  }
  function fromDataLayer(item) {
    if (!item || typeof item !== 'object') return
    // gtag('event', 'nome', { … }) empurra os argumentos
    if (item[0] === 'event' && typeof item[1] === 'string') return track(item[1], simple(item[2]), true)
    if (typeof item.event !== 'string' || /^(gtm|gtag|optimize)\./.test(item.event)) return
    track(item.event, simple(item, 'event'), true)
  }
  var layer = (window.dataLayer = window.dataLayer || [])
  var push = layer.push
  layer.push = function () {
    for (var i = 0; i < arguments.length; i++) {
      try {
        fromDataLayer(arguments[i])
      } catch (e) {}
    }
    return push.apply(layer, arguments)
  }

  // Eventos próprios: visitas('nome', { chave: 'valor' })
  var queued = window.visitas && window.visitas.q
  window.visitas = function (name, data) {
    if (typeof name === 'string' && name) track(name, simple(data), true)
  }
  if (queued && queued.length) for (var q = 0; q < queued.length; q++) window.visitas.apply(null, queued[q])
})()
