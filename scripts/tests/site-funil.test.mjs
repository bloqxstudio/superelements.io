import { test } from 'node:test'
import assert from 'node:assert/strict'
import { channelRows, countsAsVisit, formWhere, funnelTotals, splitByPeriod } from '../../src/features/crm/siteFunnel.ts'

// Visitas do site × formulários (2026-11-14): o formulário pelo link conta como visita; dentro do site, não duplica.

const v = (over = {}) => ({ embed: 'app', channel: 'Meta Ads', submitted: false, scheduleView: false, scheduled: false, startedAt: Date.now(), ...over })

test('pelo link ou num site sem o código conta como visita; com o código, grava só a do site', () => {
  assert.equal(countsAsVisit(v()), true)
  assert.equal(countsAsVisit(v({ embed: undefined })), true)
  assert.equal(countsAsVisit(v({ embed: 'site', siteTracked: false })), true)
  assert.equal(countsAsVisit(v({ embed: 'site', siteTracked: true })), false)
  assert.equal(countsAsVisit(v({ embed: 'site', siteSessionId: 'abc12345' })), false)
  // Visitas antigas, de antes do forms.js v26: dentro do site não contam (como antes)
  assert.equal(countsAsVisit(v({ embed: 'site' })), false)
  assert.equal(formWhere(v()), 'pelo link')
  assert.equal(formWhere(v({ embed: 'site', siteTracked: false })), 'num site sem o código de visitas')
  assert.equal(formWhere(v({ embed: 'site', siteTracked: true })), 'dentro do site')
})

test('funil soma site e link, e conta enviou e agendou de todos os formulários', () => {
  const t = funnelTotals(10, [v({ submitted: true, scheduled: true, scheduleView: true }), v({ embed: 'site', submitted: true }), v()])
  assert.deepEqual(t, { site: 10, formLink: 2, visits: 12, formOpened: 3, submitted: 2, scheduleView: 1, scheduled: 1 })
})

test('por canal: o formulário dentro do site não soma visita, mas soma envio', () => {
  const rows = channelRows(
    [{ channel: 'Meta Ads', sessions: 4 }, { channel: 'Direto', sessions: 2 }],
    [v({ submitted: true, scheduled: true }), v({ embed: 'site', submitted: true }), v({ channel: undefined })]
  )
  const meta = rows.find((r) => r.channel === 'Meta Ads')
  assert.deepEqual(meta, { channel: 'Meta Ads', site: 4, form: 1, visits: 5, submitted: 2, scheduled: 1 })
  assert.deepEqual(rows.find((r) => r.channel === 'Direto'), { channel: 'Direto', site: 2, form: 1, visits: 3, submitted: 0, scheduled: 0 })
  assert.equal(rows[0].channel, 'Meta Ads')
})

test('período e anterior do mesmo tamanho; período aberto pega quem entrou depois da leitura', () => {
  const from = 1000, to = 2000
  const list = [v({ startedAt: 500 }), v({ startedAt: 1500 }), v({ startedAt: 2500 }), v({ startedAt: 100 })]
  assert.equal(splitByPeriod(list, from, to).current.length, 1)
  assert.equal(splitByPeriod(list, from, to, true).current.length, 2)
  assert.equal(splitByPeriod(list, from, to).previous.length, 2)
})
