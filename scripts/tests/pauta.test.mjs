import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, approvalMessage, canSendToClient, channelOfFormat, monthGrid, rangeLabel, stageOf, weekDays, weekStart } from '../../src/features/pauta/rules.ts'

test('etapa: produção → gestor → cliente', () => {
  assert.equal(stageOf({ status: 'ideia' }), 'ideia')
  assert.equal(stageOf({ status: 'producao' }), 'producao')
  assert.equal(stageOf({ status: 'revisao' }), 'gestor')
  assert.equal(stageOf({ status: 'aprovado' }), 'pronto')
  assert.equal(stageOf({ status: 'aprovado', clientStatus: 'enviado' }), 'cliente')
  assert.equal(stageOf({ status: 'aprovado', clientStatus: 'aprovado' }), 'aprovado')
  assert.equal(stageOf({ status: 'aprovado', clientStatus: 'ajuste' }), 'ajuste')
})

test('só o aprovado pelo gestor vai ao cliente', () => {
  assert.equal(canSendToClient({ status: 'revisao' }), false)
  assert.equal(canSendToClient({ status: 'aprovado' }), true)
  assert.equal(canSendToClient({ status: 'aprovado', clientStatus: 'ajuste' }), true)
})

test('semanas começam na segunda e cobrem o mês', () => {
  assert.equal(weekStart('2026-11-05'), '2026-11-02')
  assert.equal(weekStart('2026-11-01'), '2026-10-26')
  const grid = monthGrid('2026-11-15')
  assert.equal(grid[0][0], '2026-10-26')
  assert.equal(grid.at(-1).at(-1), '2026-12-06')
  assert.ok(grid.every((w) => w.length === 7))
  assert.deepEqual(weekDays('2026-11-08'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
  assert.equal(addDays('2026-02-28', 1), '2026-03-01')
})

test('rótulos e canais', () => {
  assert.equal(rangeLabel('2026-11-10', '2026-11-16'), '10 a 16 de nov.')
  assert.equal(rangeLabel('2026-10-28', '2026-11-03'), '28 de out. a 3 de nov.')
  assert.equal(channelOfFormat('carrossel'), 'instagram')
  assert.equal(channelOfFormat('linkedin'), 'linkedin')
  assert.equal(channelOfFormat('livre'), undefined)
  assert.match(approvalMessage('Pauta', 'https://x/pauta/aprovar/1', 3), /as 3 peças/)
})
