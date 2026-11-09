import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDaysKey, radarScore, radarSteps } from '../../src/features/onboarding/journey.ts'

const today = '2026-11-09'
const empty = { brain: false, plan: { offer: false, audience: false, tone: false, pillars: false }, brand: false, patterns: 0, contents: [], today }
const full = { brain: true, plan: { offer: true, audience: true, tone: true, pillars: true }, brand: true, patterns: 1, today }
const c = (o) => ({ status: 'ideia', hasCreative: false, ...o })

test('conta nova: tudo falta, o Cérebro primeiro', () => {
  const s = radarSteps(empty)
  assert.deepEqual(s.map((x) => x.id), ['cerebro', 'marca', 'pauta', 'criativo', 'aprovacao'])
  assert.ok(s.every((x) => x.state === 'falta'))
  assert.equal(s[0].to, '/cerebro')
  assert.equal(radarScore(s), 0)
})

test('Plano incompleto aponta o campo que falta', () => {
  const s = radarSteps({ ...empty, brain: true, plan: { offer: true, audience: true, tone: false, pillars: false } })[0]
  assert.equal(s.state, 'falta')
  assert.equal(s.missing, 'Falta no Plano: tom, pilares')
  assert.equal(s.to, '/plano')
})

test('operação rodando: radar mostra o que falta agora, mesmo depois do começo', () => {
  const contents = [
    c({ status: 'producao', editorialDate: '2026-11-12' }),
    c({ status: 'revisao', editorialDate: '2026-11-05', hasCreative: true }),
    c({ status: 'aprovado', clientStatus: 'ajuste', hasCreative: true }),
    c({ status: 'aprovado', clientStatus: 'aprovado', hasCreative: true }),
  ]
  const s = Object.fromEntries(radarSteps({ ...full, contents }).map((x) => [x.id, x]))
  assert.equal(s.cerebro.state, 'ok')
  assert.equal(s.pauta.state, 'atencao')
  assert.match(s.pauta.missing, /1 conteúdo com data vencida/)
  assert.equal(s.criativo.state, 'atencao')
  assert.match(s.criativo.missing, /1 conteúdo em andamento sem criativo/)
  assert.equal(s.aprovacao.state, 'atencao')
  assert.match(s.aprovacao.missing, /1 pedido de ajuste do cliente · 1 esperando o gestor/)
})

test('tudo em dia continua à vista, com os números', () => {
  const contents = [c({ status: 'aprovado', clientStatus: 'aprovado', hasCreative: true, editorialDate: '2026-11-15' })]
  const s = radarSteps({ ...full, contents })
  assert.equal(radarScore(s), 5)
  assert.ok(s.every((x) => x.missing === ''))
  assert.match(s[4].have, /1 aprovado pelo cliente/)
})

test('datas sem fuso', () => {
  assert.equal(addDaysKey('2026-11-25', 14), '2026-12-09')
})
