import { test } from 'node:test'
import assert from 'node:assert/strict'
import { byOrigin, funnelOf, isLive, placeLabel, toVisit, worstDrop } from '../../src/features/crm/formFunnel.ts'
import { BOOKING_DEFAULT, SETTINGS_DEFAULT } from '../../supabase/functions/_shared/forms.ts'

// Ao vivo e funil dos formulários (CRM › Formulários › Ao vivo e funil), a partir de `crm_form_visits`.

const def = {
  kind: 'form',
  welcome: { enabled: true, title: 'Oi' },
  results: [],
  steps: [
    { id: 's1', fields: [{ id: 'nome', type: 'text', label: 'Seu nome' }] },
    { id: 's2', title: 'Faturamento', fields: [{ id: 'fat', type: 'choice', label: 'Quanto fatura?' }] },
    { id: 's3', fields: [{ id: 'tel', type: 'phone', label: 'WhatsApp' }] },
  ],
}

const row = (over = {}) => ({
  id: crypto.randomUUID(),
  form_id: 'f1',
  started_at: new Date(Date.now() - 120_000).toISOString(),
  last_at: new Date().toISOString(),
  left_at: null,
  active_ms: 30_000,
  screen: 'steps',
  steps_seen: [],
  started: false,
  submitted: false,
  schedule_view: false,
  scheduled: false,
  ...over,
})

test('toVisit lê a linha do banco e da Realtime', () => {
  const v = toVisit(row({ step_id: 's2', steps_seen: ['s1', 's2'], qualified: true, channel: 'Meta Ads', city: 'São Leopoldo', region: 'RS' }))
  assert.equal(v.stepId, 's2')
  assert.deepEqual(v.stepsSeen, ['s1', 's2'])
  assert.equal(v.qualified, true)
  assert.equal(v.leftAt, undefined)
  assert.equal(v.city, 'São Leopoldo')
  assert.ok(Number.isFinite(v.startedAt))
})

test('ao vivo: sinal recente e sem saída; quem saiu ou ficou quieto 1 min não está', () => {
  const now = Date.now()
  assert.equal(isLive({ lastAt: now - 10_000 }, now), true)
  assert.equal(isLive({ lastAt: now - 10_000, leftAt: now - 5_000 }, now), false)
  assert.equal(isLive({ lastAt: now - 61_000 }, now), false)
})

test('onde a pessoa está, em palavras', () => {
  assert.equal(placeLabel(def, toVisit(row({ screen: 'welcome' }))), 'Na capa')
  assert.equal(placeLabel(def, toVisit(row({ step_id: 's2' }))), 'Etapa 2 de 3 · Faturamento')
  assert.equal(placeLabel(def, toVisit(row({ step_id: 's3' }))), 'Etapa 3 de 3 · WhatsApp')
  assert.equal(placeLabel(def, toVisit(row({ screen: 'booking', submitted: true }))), 'Escolhendo um horário')
  assert.equal(placeLabel(def, toVisit(row({ screen: 'result', submitted: true }))), 'Enviou')
  assert.equal(placeLabel(def, toVisit(row({ screen: 'booked', scheduled: true }))), 'Agendou a reunião')
})

test('funil: abriu → começou → etapas → enviou, e a maior queda', () => {
  const visits = [
    ...Array.from({ length: 4 }, () => row({ screen: 'welcome' })),
    ...Array.from({ length: 3 }, () => row({ started: true, steps_seen: ['s1'] })),
    ...Array.from({ length: 2 }, () => row({ started: true, steps_seen: ['s1', 's2'] })),
    row({ started: true, steps_seen: ['s1', 's2', 's3'], submitted: true, screen: 'result' }),
  ].map(toVisit)
  const rows = funnelOf(def, SETTINGS_DEFAULT, visits)
  assert.deepEqual(rows.map((r) => [r.label, r.value]), [
    ['Abriu', 10],
    ['Começou', 6],
    ['Etapa 1', 6],
    ['Etapa 2', 3],
    ['Etapa 3', 1],
    ['Enviou', 1],
  ])
  assert.equal(rows[3].hint, 'Faturamento')
  const drop = worstDrop(rows)
  assert.equal(drop.from.label, 'Etapa 1')
  assert.equal(drop.to.label, 'Etapa 2')
  assert.equal(drop.lost, 3)
})

test('funil com agenda e filtro por resposta: qualificado, viu a agenda, agendou', () => {
  const settings = { ...SETTINGS_DEFAULT, booking: { ...BOOKING_DEFAULT, enabled: true, gate: { mode: 'answer', field: 'fat', values: ['alto'] } } }
  const visits = [
    row({ started: true, steps_seen: ['s1', 's2', 's3'], submitted: true, qualified: false }),
    row({ started: true, steps_seen: ['s1', 's2', 's3'], submitted: true, qualified: true, schedule_view: true }),
    row({ started: true, steps_seen: ['s1', 's2', 's3'], submitted: true, qualified: true, schedule_view: true, scheduled: true }),
  ].map(toVisit)
  const rows = funnelOf({ ...def, welcome: undefined }, settings, visits)
  assert.deepEqual(rows.map((r) => [r.id, r.value]), [
    ['open', 3],
    ['step:s1', 3],
    ['step:s2', 3],
    ['step:s3', 3],
    ['submit', 3],
    ['qualified', 2],
    ['schedule_view', 2],
    ['scheduled', 1],
  ])
})

test('por origem: canal e campanha, com quem começou, enviou e agendou', () => {
  const visits = [
    row({ channel: 'Meta Ads', campaign: 'Leads nov', started: true, submitted: true }),
    row({ channel: 'Meta Ads', campaign: 'Leads nov', started: true }),
    row({ channel: 'Meta Ads', campaign: 'Remarketing' }),
    row({ channel: 'Instagram' }),
    row({}),
  ].map(toVisit)
  assert.deepEqual(byOrigin(visits), [
    { label: 'Meta Ads', visits: 3, started: 2, submitted: 1, scheduled: 0 },
    { label: 'Instagram', visits: 1, started: 0, submitted: 0, scheduled: 0 },
    { label: 'Direto', visits: 1, started: 0, submitted: 0, scheduled: 0 },
  ])
  // Sem utm_campaign, a visita não entra na tabela por campanha
  assert.deepEqual(byOrigin(visits, 'campaign').map((r) => [r.label, r.visits]), [['Leads nov', 2], ['Remarketing', 1]])
})
