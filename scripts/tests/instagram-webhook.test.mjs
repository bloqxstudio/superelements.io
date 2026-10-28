import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { messagesOf, webhookHandler } from '../../supabase/functions/instagram-webhook/handler.ts'

const secret = 'test-only-secret'
const timestamp = 1700000000000
const event = { object: 'instagram', entry: [{ id: '123', messaging: [{ sender: { id: '456' }, recipient: { id: '123' }, timestamp, message: { mid: 'test-mid', text: 'Mensagem de teste' } }] }] }
const signed = (body) => new Request('https://example.invalid', { method: 'POST', body, headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}` } })

test('desafio da Meta exige token de verificação e devolve texto puro', async () => {
  const handler = webhookHandler({ verifyToken: 'verify-test', secrets: [secret], store: async () => assert.fail() })
  const ok = await handler(new Request('https://example.invalid?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=12345'))
  assert.equal(ok.status, 200)
  assert.equal(await ok.text(), '12345')
  assert.equal((await handler(new Request('https://example.invalid?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345'))).status, 403)
})

test('somente eventos com assinatura válida podem gravar mensagens', async () => {
  const stored = []
  const handler = webhookHandler({ verifyToken: 'verify-test', secrets: ['', secret], store: async (m) => { stored.push(m) } })
  const body = JSON.stringify(event)
  assert.equal((await handler(new Request('https://example.invalid', { method: 'POST', body }))).status, 401)
  const tampered = signed(body)
  assert.equal((await handler(new Request(tampered, { body: body + ' ' }))).status, 401)
  assert.equal(stored.length, 0)
  assert.equal((await handler(signed(body))).status, 200)
  assert.deepEqual(stored, [{ account: '123', participant: '456', mid: 'test-mid', fromMe: false, body: 'Mensagem de teste', attachment: null, at: new Date(timestamp).toISOString() }])
})

test('ignora recibos e destinatários de outra conta; reconhece eco e anexo', () => {
  const payload = structuredClone(event)
  payload.entry[0].messaging.push({ sender: { id: '456' }, recipient: { id: '123' }, read: { watermark: timestamp } })
  payload.entry[0].messaging[0].recipient.id = '999'
  assert.deepEqual(messagesOf(payload), [])
  const echo = structuredClone(event)
  echo.entry[0].messaging[0] = { sender: { id: '123' }, recipient: { id: '456' }, timestamp, message: { mid: 'echo', is_echo: true, attachments: [{ type: 'audio' }] } }
  assert.equal(messagesOf(echo)[0].fromMe, true)
  assert.equal(messagesOf(echo)[0].attachment, 'audio')
  assert.deepEqual(messagesOf({ object: 'page', entry: event.entry }), [])
})

test('falha de persistência pede reentrega em vez de perder mensagem', async () => {
  const handler = webhookHandler({ verifyToken: 'verify-test', secrets: [secret], store: async () => { throw Error('offline') } })
  assert.equal((await handler(signed(JSON.stringify(event)))).status, 503)
})

// Envelope e timestamp em segundos aparecem no exemplo oficial do painel da Meta.
test('aceita messages em changes/value com timestamp textual em segundos', () => {
  const value = structuredClone(event.entry[0].messaging[0])
  value.timestamp = String(timestamp / 1000)
  const payload = { object: 'instagram', entry: [{ id: '123', changes: [{ field: 'messages', value }] }] }
  assert.deepEqual(messagesOf(payload), messagesOf(event))
  payload.entry[0].changes[0].field = 'comments'
  assert.deepEqual(messagesOf(payload), [])
})
