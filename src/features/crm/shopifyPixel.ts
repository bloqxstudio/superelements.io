/**
 * O pixel da Shopify (Configurações › Eventos do cliente › Adicionar pixel
 * personalizado). O checkout da Shopify não roda os scripts do tema, então é
 * por aqui que chegam produto visto, carrinho, checkout, pagamento e a compra
 * (com valor, moeda, itens e o pedido). Ele lê e continua a mesma visita do
 * `visitas.js` do tema (`visitas_v`/`visitas_s` no localStorage da loja); sem o
 * tema, abre a visita sozinho com a origem do link. No checkout manda também as
 * páginas vistas; na loja, quem as manda é o script do tema.
 *
 * Sem imports: o teste `scripts/tests/visitas-loja.test.mjs` o roda no Node.
 */
export const shopifyPixelCode = (siteId: string, endpoint: string) => `// Visitas (CRM › Site): compras, carrinho e checkout da loja
const SITE = '${siteId}'
const ENDPOINT = '${endpoint}'
const SESSION_MS = 30 * 60 * 1000
const CHECKOUT = /\\/(checkouts?|orders)\\//
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'campaign_id', 'adset_id', 'ad_id', 'placement', 'site_source']
const CLICKS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id']

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}
const money = (m) => (m && isFinite(Number(m.amount)) ? Math.round(Number(m.amount) * 100) / 100 : undefined)
const clean = (o) => {
  const out = {}
  for (const k in o) if (o[k] !== undefined && o[k] !== null && o[k] !== '') out[k] = typeof o[k] === 'string' ? o[k].slice(0, 120) : o[k]
  return out
}

let chain = Promise.resolve()
function visit(ctx) {
  const step = chain.then(async () => {
    if ((await browser.localStorage.getItem('visitas_off')) === '1') return null
    let v = await browser.localStorage.getItem('visitas_v')
    if (!v || !/^[A-Za-z0-9-]{8,40}$/.test(v)) {
      v = uid()
      await browser.localStorage.setItem('visitas_v', v)
    }
    let s = null
    try {
      s = JSON.parse((await browser.localStorage.getItem('visitas_s')) || 'null')
    } catch (e) {}
    const now = Date.now()
    let start = false
    if (!s || !s.id || now - s.last >= SESSION_MS) {
      const n = (parseInt((await browser.localStorage.getItem('visitas_n')) || '0', 10) || 0) + 1
      await browser.localStorage.setItem('visitas_n', String(n))
      s = { id: uid(), n: n, ck: '' }
      start = true
    }
    s.last = now
    await browser.localStorage.setItem('visitas_s', JSON.stringify(s))
    return { v: v, s: s, start: start }
  })
  chain = step.catch(() => null)
  return step
}

function campaign(search) {
  const q = {}
  let any = false
  let params
  try {
    params = new URLSearchParams(search || '')
  } catch (e) {
    return null
  }
  for (const k of PARAMS) if (params.get(k)) { q[k] = params.get(k).slice(0, 200); any = true }
  for (const k of CLICKS) if (params.get(k)) { q.click = k; any = true; break }
  return any ? q : null
}

async function send(event, hit) {
  const ctx = event.context || {}
  const doc = ctx.document || {}
  const loc = doc.location || {}
  const win = ctx.window || {}
  const ids = await visit(ctx)
  if (!ids) return
  const hits = []
  const path = loc.pathname || '/'
  const pv = event.id ? String(event.id).replace(/[^A-Za-z0-9-]/g, '').slice(0, 40) : uid().slice(0, 12)
  if (ids.start || hit === 'page') {
    const page = { t: 'p', pv: pv, path: path, title: (doc.title || '').slice(0, 200) }
    if (ids.start) {
      page.start = 1
      page.r = (doc.referrer || '').slice(0, 500)
      const q = campaign(loc.search)
      if (q) page.q = q
    }
    hits.push(page)
  }
  if (hit && hit !== 'page') hits.push(Object.assign({ t: 'e', pv: pv, path: path }, hit))
  if (!hits.length) return
  let tz
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch (e) {}
  const screen = win.screen || {}
  const body = JSON.stringify({
    s: SITE,
    v: ids.v,
    sid: ids.s.id,
    n: ids.s.n,
    h: loc.hostname,
    c: { tz: tz, lang: (ctx.navigator && ctx.navigator.language) || undefined, sw: screen.width, sh: screen.height, vw: win.innerWidth, vh: win.innerHeight, dpr: win.devicePixelRatio },
    e: hits,
  })
  try {
    await fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } })
  } catch (e) {}
}

function checkoutData(c) {
  const lines = (c && c.lineItems) || []
  let items = 0
  for (const l of lines) items += Number(l.quantity) || 1
  const total = c && (c.totalPrice || (c.subtotalPrice))
  return {
    valor: money(total),
    moeda: (total && total.currencyCode) || (c && c.currencyCode),
    itens: items || undefined,
    produto: lines[0] && (lines[0].title || (lines[0].variant && lines[0].variant.product && lines[0].variant.product.title)),
  }
}

analytics.subscribe('page_viewed', (event) => {
  const loc = (event.context && event.context.document && event.context.document.location) || {}
  if (CHECKOUT.test(loc.pathname || '')) send(event, 'page')
})
analytics.subscribe('product_viewed', (event) => {
  const v = (event.data && event.data.productVariant) || {}
  send(event, { name: 'produto', data: clean({ produto: v.product && v.product.title, valor: money(v.price), moeda: v.price && v.price.currencyCode }) })
})
analytics.subscribe('product_added_to_cart', (event) => {
  const line = (event.data && event.data.cartLine) || {}
  const m = line.merchandise || {}
  const total = line.cost && line.cost.totalAmount
  send(event, { name: 'carrinho', data: clean({ produto: m.product && m.product.title, valor: money(total || m.price), moeda: (total || m.price || {}).currencyCode, itens: line.quantity }) })
})
analytics.subscribe('checkout_started', (event) => {
  send(event, { name: 'checkout', data: clean(checkoutData(event.data && event.data.checkout)) })
})
analytics.subscribe('payment_info_submitted', (event) => {
  send(event, { name: 'pagamento', data: clean(checkoutData(event.data && event.data.checkout)) })
})
analytics.subscribe('checkout_completed', (event) => {
  const c = (event.data && event.data.checkout) || {}
  const order = (c.order && c.order.id) || c.token
  send(event, { name: 'compra', data: clean(Object.assign(checkoutData(c), { pedido: order ? String(order).slice(0, 80) : undefined })) })
})
`
