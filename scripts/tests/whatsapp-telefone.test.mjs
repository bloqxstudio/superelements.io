import test from 'node:test'
import assert from 'node:assert/strict'
import { chatJidsOf, phoneKey, samePhone } from '../../services/whatsapp/src/comandos.ts'

test('mesmo número com e sem o 9 e com e sem o 55', () => {
  assert.ok(samePhone('+55 (51) 99876-5432', '555198765432'))
  assert.ok(samePhone('51 98765-4321', '5551987654321'))
})

test('mesmo final em outro DDD não é a mesma pessoa', () => {
  assert.equal(samePhone('5551987654321', '5511987654321'), false)
  assert.equal(samePhone('5551987654321', '5521887654321'), false)
})

test('número sem DDD não casa com ninguém', () => {
  assert.equal(phoneKey('98765-4321'), '')
  assert.equal(samePhone('987654321', '5551987654321'), false)
  assert.deepEqual(chatJidsOf('87654321'), [])
})

test('conversas possíveis: com e sem o 9', () => {
  assert.deepEqual(chatJidsOf('+55 51 98765-4321'), ['555187654321@s.whatsapp.net', '5551987654321@s.whatsapp.net'])
})
