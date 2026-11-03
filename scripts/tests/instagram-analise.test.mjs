import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditProfile, HIGHLIGHT_MAX } from '../../src/features/crm/profileAudit.ts'

// Análise de perfil do Instagram (CRM › Instagram › Análise): as checagens sem IA.

const NOW = Date.parse('2026-11-02T15:00:00Z')
const DAY = 86_400_000

const post = (daysAgo, over = {}) => ({
  id: `m${daysAgo}-${Math.random()}`,
  type: 'IMAGE',
  product: 'FEED',
  caption: 'Uma legenda com contexto suficiente. Chame no Direct.',
  postedAt: NOW - daysAgo * DAY,
  insights: { reach: 400, total_interactions: 20, saved: 3, shares: 2 },
  ...over,
})

const pillar = (audit, id) => audit.pillars.find((p) => p.id === id)
const ids = (audit, id) => pillar(audit, id).findings.map((f) => f.id)

const goodProfile = {
  username: 'loja',
  name: 'Loja · Doces finos',
  biography: 'Doces finos para festas em São Leopoldo/RS\nEncomendas com 5 dias de antecedência\nPeça pelo WhatsApp 👇',
  website: 'https://wa.me/5551999999999',
  picture: 'https://cdn/foto.jpg',
  followers: 2000,
  follows: 300,
  mediaCount: 120,
  totals: { 30: { reach: 10000, reach_non_followers: 4000, follows: 80, unfollows: 20 } },
}

test('perfil vazio e parado tem nota baixa e achados críticos', () => {
  const audit = auditProfile({ profile: { username: 'x', totals: {} }, media: [post(60)], highlights: [], now: NOW })
  assert.ok(audit.score < 40, `nota ${audit.score}`)
  assert.ok(ids(audit, 'bio').includes('bio-vazia'))
  assert.ok(ids(audit, 'foto').includes('foto-vazia'))
  assert.ok(ids(audit, 'destaques').includes('destaques-nenhum'))
  assert.ok(ids(audit, 'ritmo').includes('ritmo-parado'))
})

test('perfil bem cuidado passa sem críticos', () => {
  const media = []
  for (let i = 0; i < 24; i++) media.push(post(i * 3 + 1, { type: i % 3 === 0 ? 'VIDEO' : i % 3 === 1 ? 'CAROUSEL_ALBUM' : 'IMAGE', product: i % 3 === 0 ? 'REELS' : 'FEED', insights: { reach: i % 3 === 0 ? 900 : 500, total_interactions: 40, saved: 8, shares: 4 } }))
  const audit = auditProfile({ profile: goodProfile, media, highlights: ['Sobre', 'Cardápio', 'Clientes', 'Como pedir'], now: NOW })
  const bad = audit.pillars.flatMap((p) => p.findings).filter((f) => f.level === 'critico')
  assert.deepEqual(bad, [])
  assert.ok(audit.score >= 80, `nota ${audit.score}`)
  assert.equal(pillar(audit, 'foto').score, null)
  assert.equal(audit.facts.bestFormat, 'reels')
})

test('destaques: não informados não dão nota; nomes longos e grupos faltando aparecem', () => {
  const none = auditProfile({ profile: goodProfile, media: [], highlights: null, now: NOW })
  assert.equal(pillar(none, 'destaques').score, null)
  const long = 'x'.repeat(HIGHLIGHT_MAX + 1)
  const some = auditProfile({ profile: goodProfile, media: [], highlights: [long, 'Viagem'], now: NOW })
  assert.ok(ids(some, 'destaques').includes('destaques-cortados'))
  assert.ok(ids(some, 'destaques').includes('destaques-faltam'))
})

test('bio sem chamada, sem link e nome só com a marca', () => {
  const audit = auditProfile({ profile: { ...goodProfile, biography: 'Doces finos e bolos para festas e eventos especiais', website: undefined, name: 'Loja' }, media: [], highlights: null, now: NOW })
  const found = ids(audit, 'bio')
  assert.ok(found.includes('bio-sem-chamada'))
  assert.ok(found.includes('sem-link'))
  assert.ok(found.includes('nome-so-marca'))
})

test('formato que alcança mais mas aparece pouco vira atenção', () => {
  const media = []
  for (let i = 0; i < 10; i++) media.push(post(i * 5 + 1, { insights: { reach: 300, total_interactions: 15 } }))
  media.push(post(2, { type: 'VIDEO', product: 'REELS', insights: { reach: 1500, total_interactions: 60 } }))
  media.push(post(7, { type: 'VIDEO', product: 'REELS', insights: { reach: 1300, total_interactions: 50 } }))
  const audit = auditProfile({ profile: goodProfile, media, highlights: null, now: NOW })
  assert.ok(ids(audit, 'formatos').includes('formatos-melhor-pouco'))
})

test('stories não contam no ritmo do feed', () => {
  const audit = auditProfile({ profile: goodProfile, media: [post(1, { product: 'STORY' }), post(40)], highlights: null, now: NOW })
  assert.equal(audit.facts.posts30, 0)
  assert.ok(ids(audit, 'ritmo').includes('ritmo-parado'))
})
