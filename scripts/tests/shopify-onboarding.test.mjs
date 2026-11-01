import { test } from 'node:test'
import assert from 'node:assert/strict'
import { manualStore, readShopifyStore, shopifyAdmin } from '../../src/features/onboarding/shopify.ts'

// Onboarding da loja Shopify: o `/meta.json` confirma a loja e diz o domínio que vai no Analytics.

const withMeta = async (meta, run) => {
  const original = globalThis.fetch
  const asked = []
  globalThis.fetch = async (url) => {
    asked.push(String(url))
    return meta ? new Response(JSON.stringify(meta), { status: 200 }) : new Response('<html>', { status: 404 })
  }
  try {
    return await run(asked)
  } finally {
    globalThis.fetch = original
  }
}

test('loja com tema: domínio principal sem www e o admin pelo .myshopify.com', async () => {
  await withMeta({ name: 'Allbirds', domain: 'www.allbirds.com', myshopify_domain: 'weareallbirds.myshopify.com', currency: 'USD' }, async (asked) => {
    const store = await readShopifyStore('https://Allbirds.com/products/x?y=1')
    assert.deepEqual(asked, ['https://allbirds.com/meta.json'])
    assert.equal(store.domain, 'allbirds.com')
    assert.equal(store.headless, undefined)
    assert.equal(shopifyAdmin(store, '/settings/customer_events'), 'https://weareallbirds.myshopify.com/admin/settings/customer_events')
  })
})

test('digitou o .myshopify.com: vale o domínio principal da loja', async () => {
  await withMeta({ name: 'Loja', domain: 'loja.com.br', myshopify_domain: 'loja.myshopify.com' }, async () => {
    assert.equal((await readShopifyStore('loja.myshopify.com')).domain, 'loja.com.br')
  })
})

test('headless: a Shopify diz o subdomínio do checkout, vale o domínio digitado', async () => {
  await withMeta({ name: 'Gymshark US', domain: 'us.checkout.gymshark.com', myshopify_domain: 'gymshark-us.myshopify.com' }, async () => {
    const store = await readShopifyStore('gymshark.com')
    assert.equal(store.domain, 'gymshark.com')
    assert.equal(store.headless, true)
  })
})

test('não é Shopify: nada', async () => {
  await withMeta(null, async () => assert.equal(await readShopifyStore('avencestudio.com'), null))
  await withMeta({ name: 'x', domain: 'x.com' }, async () => assert.equal(await readShopifyStore('x.com'), null))
  assert.equal(await readShopifyStore('sem-ponto'), null)
})

test('seguir com o domínio digitado (loja que não responde)', () => {
  assert.deepEqual(manualStore('https://www.Loja.com/x', ''), { name: 'loja.com', domain: 'loja.com', myshopify: undefined, headless: true })
  assert.equal(manualStore('nada', 'x'), null)
  assert.equal(shopifyAdmin({}, 'themes'), 'https://admin.shopify.com/')
})
