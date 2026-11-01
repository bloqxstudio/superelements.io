import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { shopifyPixelCode } from '../../src/features/crm/shopifyPixel.ts'

// Compras no painel Site: o pixel da Shopify e os eventos de comércio do GA4 no `visitas.js`.

const SITE = '11111111-2222-3333-4444-555555555555'
const tick = () => new Promise((resolve) => setTimeout(resolve, 20))

function runPixel(storage) {
  const subs = {}
  const sent = []
  const browser = {
    localStorage: { getItem: async (k) => storage.get(k) ?? null, setItem: async (k, v) => void storage.set(k, v) },
  }
  const analytics = { subscribe: (name, fn) => (subs[name] = fn) }
  const fetch = async (_url, opts) => void sent.push(JSON.parse(opts.body))
  new Function('browser', 'analytics', 'fetch', shopifyPixelCode(SITE, 'https://x.test/functions/v1/site-visitas'))(browser, analytics, fetch)
  return { subs, sent }
}

const context = (path, search = '') => ({
  document: { location: { hostname: 'loja.com.br', pathname: path, search }, referrer: 'https://l.instagram.com/', title: 'Loja' },
  window: { innerWidth: 390, innerHeight: 800, screen: { width: 390, height: 844 } },
  navigator: { language: 'pt-BR' },
})
const checkout = { totalPrice: { amount: 199.8, currencyCode: 'BRL' }, lineItems: [{ title: 'Camiseta', quantity: 2 }], order: { id: 'gid://shopify/OrderIdentity/99' } }

test('pixel: continua a visita do tema e manda a compra com valor e pedido', async () => {
  const storage = new Map([
    ['visitas_v', 'visitor-abc-123'],
    ['visitas_s', JSON.stringify({ id: 'sess-abc-12345', n: 3, last: Date.now() - 60_000 })],
  ])
  const { subs, sent } = runPixel(storage)
  subs.page_viewed({ id: 'sh-1', context: context('/products/camiseta') })
  subs.product_added_to_cart({
    id: 'sh-2',
    context: context('/products/camiseta'),
    data: { cartLine: { quantity: 2, cost: { totalAmount: { amount: 179.8, currencyCode: 'BRL' } }, merchandise: { product: { title: 'Camiseta' } } } },
  })
  subs.checkout_completed({ id: 'sh-3', context: context('/checkouts/cn/abc/thank-you'), data: { checkout } })
  await tick()

  // Página da loja: quem manda é o script do tema
  assert.equal(sent.length, 2)
  assert.ok(sent.every((b) => b.sid === 'sess-abc-12345' && b.v === 'visitor-abc-123' && b.s === SITE && b.h === 'loja.com.br'))
  assert.deepEqual(sent[0].e[0].data, { produto: 'Camiseta', valor: 179.8, moeda: 'BRL', itens: 2 })
  assert.equal(sent[1].e[0].name, 'compra')
  assert.deepEqual(sent[1].e[0].data, { valor: 199.8, moeda: 'BRL', itens: 2, produto: 'Camiseta', pedido: 'gid://shopify/OrderIdentity/99' })
})

test('pixel: sem visita aberta, abre outra com a origem do link', async () => {
  const storage = new Map([['visitas_s', JSON.stringify({ id: 'old-session-1', n: 4, last: 0 })], ['visitas_n', '4']])
  const { subs, sent } = runPixel(storage)
  subs.checkout_completed({ id: 'sh-9', context: context('/checkouts/cn/z/thank-you', '?utm_source=ig&fbclid=x'), data: { checkout } })
  await tick()
  const [body] = sent
  assert.notEqual(body.sid, 'old-session-1')
  assert.equal(body.n, 5)
  assert.match(storage.get('visitas_v'), /^[A-Za-z0-9-]{8,40}$/)
  assert.deepEqual(body.e[0], { t: 'p', pv: 'sh-9', path: '/checkouts/cn/z/thank-you', title: 'Loja', start: 1, r: 'https://l.instagram.com/', q: { utm_source: 'ig', click: 'fbclid' } })
  assert.equal(body.e[1].name, 'compra')
})

test('pixel: ?visitas=off (a equipe) não conta', async () => {
  const { subs, sent } = runPixel(new Map([['visitas_off', '1']]))
  subs.checkout_completed({ id: 'sh-1', context: context('/checkouts/cn/z/thank-you'), data: { checkout } })
  await tick()
  assert.equal(sent.length, 0)
})

/** O `visitas.js` num navegador de mentira: só o que ele usa. */
function runScript({ dataLayer = [], shopify } = {}) {
  const sent = []
  const store = () => {
    const m = new Map()
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
  }
  const noop = () => {}
  const win = {
    URLSearchParams,
    Intl,
    JSON,
    Math,
    Date,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    console,
    localStorage: store(),
    sessionStorage: store(),
    location: { search: '', hostname: 'loja.com.br', pathname: '/obrigado', href: 'https://loja.com.br/obrigado' },
    navigator: { userAgent: 'Mozilla/5.0 (iPhone)', language: 'pt-BR', maxTouchPoints: 5, sendBeacon: (_url, body) => (sent.push(JSON.parse(body)), true) },
    screen: { width: 390, height: 844 },
    innerWidth: 390,
    innerHeight: 800,
    devicePixelRatio: 3,
    addEventListener: noop,
    dataLayer,
    Shopify: shopify,
  }
  win.window = win
  win.self = win
  win.top = win
  win.document = {
    currentScript: { getAttribute: (k) => (k === 'data-site' ? SITE : null) },
    body: { className: '', scrollHeight: 1000 },
    documentElement: { scrollHeight: 1000, scrollTop: 0 },
    visibilityState: 'visible',
    title: 'Obrigado',
    referrer: '',
    addEventListener: noop,
  }
  vm.runInNewContext(fs.readFileSync(new URL('../../public/visitas.js', import.meta.url), 'utf8'), win)
  const events = () => sent.flatMap((b) => b.e).filter((h) => h.t === 'e')
  return { win, events }
}

const purchase = { event: 'purchase', ecommerce: { transaction_id: 'T-1', value: '249.90', currency: 'brl', items: [{ item_name: 'Tênis', quantity: 1 }, { item_name: 'Meia', quantity: 2 }] } }

test('visitas.js: purchase do GA4 empurrado antes do script vira compra com valor', async () => {
  const { events } = runScript({ dataLayer: [{ event: 'gtm.js' }, { ecommerce: null }, purchase] })
  await tick()
  const [compra] = events()
  assert.equal(compra.name, 'compra')
  assert.deepEqual(compra.data, { valor: 249.9, moeda: 'BRL', pedido: 'T-1', itens: 3, produto: 'Tênis' })
})

test('visitas.js: gtag add_to_cart e eventos comuns continuam chegando', async () => {
  const { win, events } = runScript()
  win.dataLayer.push(['event', 'add_to_cart', { value: 50, currency: 'BRL', items: [{ item_name: 'Boné' }] }])
  win.dataLayer.push({ event: 'lead_qualificado', plano: 'site' })
  win.visitas('compra', { valor: 10, pedido: 'X' })
  await tick()
  assert.deepEqual(
    events().map((e) => [e.name, e.data]),
    [
      ['carrinho', { valor: 50, moeda: 'BRL', itens: 1, produto: 'Boné' }],
      ['lead_qualificado', { plano: 'site' }],
      ['compra', { valor: 10, pedido: 'X' }],
    ]
  )
})

test('visitas.js: na Shopify, a loja fica com o pixel (sem compra duplicada pelo dataLayer)', async () => {
  const { events } = runScript({ dataLayer: [purchase], shopify: { shop: 'loja.myshopify.com' } })
  await tick()
  assert.equal(events().length, 0)
})

test('visitas.js: o editor de tema da Shopify não conta', async () => {
  const { events, win } = runScript({ shopify: { shop: 'loja.myshopify.com', designMode: true } })
  await tick()
  assert.equal(events().length, 0)
  assert.equal(win.visitas, undefined)
})
