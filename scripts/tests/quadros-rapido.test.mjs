import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextSpot, withPerson, withoutPerson, MAX_PEOPLE } from '../../src/features/quadros/quick.ts'

const box = { x: 0, y: 0, width: 200, height: 100 }
const hits = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test('nextSpot: ao lado, na direção pedida, com o mesmo tamanho e espaço para a seta', () => {
  assert.deepEqual(nextSpot(box, 'right', []), { x: 280, y: 0 })
  assert.deepEqual(nextSpot(box, 'left', []), { x: -280, y: 0 })
  assert.deepEqual(nextSpot(box, 'down', []), { x: 0, y: 180 })
  assert.deepEqual(nextSpot(box, 'up', []), { x: 0, y: -180 })
})

test('nextSpot: o segundo "+" para o mesmo lado não cobre o primeiro (vira árvore)', () => {
  const others = []
  for (let i = 0; i < 5; i++) {
    const spot = nextSpot(box, 'right', others)
    const placed = { ...spot, width: 200, height: 100 }
    assert.ok(!others.some((o) => hits(placed, o)), `bloco ${i} sem sobreposição`)
    assert.equal(spot.x, 280)
    others.push(placed)
  }
  const ys = others.map((o) => o.y).sort((a, b) => a - b)
  assert.deepEqual(ys, [-280, -140, 0, 140, 280])
})

test('pessoas da nota: sem repetir, atualiza a foto e tira', () => {
  const a = { id: 'a', name: 'Ana', color: '#000' }
  const b = { id: 'b', name: 'Bia', color: '#111' }
  let list = withPerson(undefined, a)
  assert.equal(withPerson(list, a), list, 'mesma pessoa, mesma lista (não grava de novo)')
  list = withPerson(list, b)
  assert.deepEqual(list.map((p) => p.id), ['a', 'b'])
  list = withPerson(list, { ...a, avatar: 'x.png' })
  assert.equal(list[0].avatar, 'x.png')
  assert.deepEqual(withoutPerson(list, 'a').map((p) => p.id), ['b'])
  let many = []
  for (let i = 0; i < 12; i++) many = withPerson(many, { id: `p${i}`, name: `P${i}`, color: '#000' })
  assert.equal(many.length, MAX_PEOPLE)
})
