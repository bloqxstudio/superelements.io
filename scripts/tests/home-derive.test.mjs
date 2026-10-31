import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activityEvents, attentionOf, campaignChain, delta, freshnessOf, spendByCurrency, summarizeOpportunities, windowOf, wonAt } from '../../src/features/home/derive.ts'

const NOW = Date.parse('2026-10-30T15:00:00')
const w = windowOf(7, NOW)
const day = (n) => new Date(NOW - n * 86_400_000).toISOString()

const opp = (id, extra = {}) => ({
  id, clientId: `c${id}`, pipelineId: 'p', lead: { name: `Lead ${id}` }, region: '', stage: 'novo',
  history: [], createdAt: day(1), updatedAt: day(1), ...extra,
})
const settings = { price: 1000, monthly: 0, months: 12 }

test('período de 7 dias começa à meia-noite e o anterior tem o mesmo tamanho', () => {
  assert.equal(new Date(w.from).getHours(), 0)
  assert.equal(w.to - w.from, w.from - w.prevFrom)
  assert.equal(w.prevTo, w.from)
})

test('variação sem base anterior não inventa percentual', () => {
  assert.deepEqual(delta(5, 0), { diff: 5, pct: undefined })
  assert.equal(delta(5, undefined), undefined)
  assert.equal(delta(6, 3).pct, 1)
})

test('ganha só vale fechada agora, com a data da última entrada em Fechado', () => {
  assert.equal(wonAt(opp('1', { stage: 'proposta', history: [{ at: day(1), stage: 'fechado' }] })), undefined)
  assert.equal(wonAt(opp('2', { stage: 'fechado', history: [{ at: day(2), stage: 'fechado' }] })), Date.parse(day(2)))
})

test('resumo separa entradas com origem das da prospecção e compara com o período anterior', () => {
  const list = [
    opp('a', { origin: { channel: 'Meta Ads', paid: true } }),
    opp('b'),
    opp('c', { createdAt: day(10) }),
    opp('d', { stage: 'fechado', history: [{ at: day(2), stage: 'fechado' }], offer: { service: 's', price: 2000 } }),
  ]
  const s = summarizeOpportunities(list, w, settings)
  assert.equal(s.created, 3)
  assert.equal(s.createdBefore, 1)
  assert.equal(s.inbound, 1)
  assert.equal(s.prospected, 2)
  assert.equal(s.won, 1)
  assert.equal(s.wonOfferValue, 2000)
  assert.equal(s.byOrigin[0].count, 2)
})

test('atenção: lead sem responsável, parado, sem próximo passo e passo atrasado; mapeado fica de fora', () => {
  const list = [
    opp('1'),
    opp('2', { ownerId: 'u', updatedAt: day(3) }),
    opp('3', { stage: 'conversa' }),
    opp('4', { stage: 'proposta', nextStep: 'Ligar', nextDate: '2026-10-01' }),
    opp('5', { stage: 'mapeado' }),
    opp('6', { stage: 'contatado', nextStep: 'Ligar', nextDate: '2026-12-01' }),
  ]
  const kinds = attentionOf(list, NOW).map((a) => `${a.kind}:${a.oppId}`)
  assert.deepEqual(kinds, ['lead:1', 'atrasado:4', 'parado:2', 'passo:3'])
})

test('campanha liga Meta, visitas e leads pelo id ou pelo nome; sem gasto fica indefinido', () => {
  const meta = [{ id: '10', name: 'Leads Julho', currency: 'BRL', spend: 300, impressions: 9000, linkClicks: 120 }]
  const rows = [
    { channel: 'Meta Ads', campaign: 'leads julho', campaignId: null, sessions: 80, converted: 6, forms: 2, qualified: 0 },
    { channel: 'Google Ads', campaign: 'Busca marca', campaignId: null, sessions: 30, converted: 3, forms: 1, qualified: 0 },
    { channel: 'Direto', campaign: null, campaignId: null, sessions: 500, converted: 9, forms: 0, qualified: 0 },
  ]
  const opps = [
    opp('1', { origin: { channel: 'Meta Ads', paid: true, campaign: { from: 'meta', id: '10', name: 'Leads Julho' } } }),
    opp('2', { stage: 'fechado', origin: { channel: 'Google Ads', paid: true, utm: { utm_campaign: 'Busca marca' } } }),
  ]
  const chain = campaignChain(meta, rows, opps, w)
  assert.equal(chain.length, 2)
  const m = chain[0]
  assert.equal(m.spend, 300)
  assert.equal(m.sessions, 80)
  assert.equal(m.leads.length, 1)
  assert.equal(m.matchedBy, 'id')
  const g = chain[1]
  assert.equal(g.spend, undefined)
  assert.equal(g.sessions, 30)
  assert.equal(g.won, 1)
  assert.deepEqual(g.from, { meta: false, site: true, funnel: true })
})

test('gasto não soma moedas diferentes e o frescor separa atualizado de atrasado', () => {
  assert.equal(spendByCurrency([{ currency: 'BRL', spend: 1 }, { currency: 'USD', spend: 2 }, { currency: 'BRL', spend: 3 }]).length, 2)
  assert.equal(freshnessOf(NOW - 1000, 60_000, NOW), 'atualizado')
  assert.equal(freshnessOf(NOW - 120_000, 60_000, NOW), 'atrasado')
  assert.equal(freshnessOf(undefined, 60_000, NOW), undefined)
})

test('eventos do funil trazem o contexto e ignoram cartões de outro funil', () => {
  const list = [opp('1', { origin: { channel: 'Meta Ads', paid: true, form: 'Contato' } })]
  const ev = activityEvents(
    [
      { id: 'a', oppId: '1', kind: 'created', at: 1 },
      { id: 'b', oppId: '1', kind: 'stage', at: 2, from: 'novo', to: 'contatado' },
      { id: 'c', oppId: '1', kind: 'stage', at: 3, from: 'contatado', to: 'novo' },
      { id: 'd', oppId: 'x', kind: 'created', at: 4 },
    ],
    list
  )
  assert.equal(ev.length, 3)
  assert.match(ev[0].detail, /Meta Ads · Contato/)
  assert.match(ev[1].title, /avançou para Contatado/)
  assert.match(ev[2].title, /voltou para Novo lead/)
})
