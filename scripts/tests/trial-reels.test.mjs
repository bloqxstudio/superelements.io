import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baselineOf, readTrial, EARLY_HOURS, SETTLED_HOURS } from '../../src/features/crm/trialReels.ts'

// Motor dos testes de reels (CRM › Instagram › Testes): o veredito de cada teste.

const NOW = Date.parse('2026-11-09T15:00:00Z')
const HOUR = 3_600_000
const at = (hours) => NOW - hours * HOUR

const reel = (views, reach, interactions, shares, saved) => ({ insights: { views, reach, total_interactions: interactions, shares, saved } })
const base = baselineOf([reel(2000, 1500, 60, 5, 8), reel(3000, 2200, 90, 10, 12), reel(1000, 800, 30, 2, 3), reel(2500, 1800, 70, 6, 9)])

const strong = { views: 2400, reach: 2000, total_interactions: 90, shares: 25, saved: 30, ig_reels_avg_watch_time: 9000 }
const weak = { views: 600, reach: 550, total_interactions: 4, shares: 0, saved: 1, ig_reels_avg_watch_time: 2000 }

test('baseline: medianas dos reels normais', () => {
  assert.equal(base.reels, 4)
  assert.equal(base.views, 2250)
  assert.ok(base.interactionRate > 0.03 && base.interactionRate < 0.045)
})

test('processando e falhou', () => {
  assert.equal(readTrial({ status: 'processando', insights: {} }, base, NOW).verdict, 'processando')
  assert.equal(readTrial({ status: 'falhou', insights: {} }, base, NOW).verdict, 'refazer')
})

test('antes de 24 h a leitura é provisória, mesmo forte', () => {
  const r = readTrial({ status: 'no_ar', publishedAt: at(EARLY_HOURS - 2), durationS: 15, insights: strong }, base, NOW)
  assert.equal(r.verdict, 'cedo')
  assert.ok(r.score >= 70)
})

test('teste forte depois de 24 h: levar', () => {
  const r = readTrial({ status: 'no_ar', publishedAt: at(30), durationS: 15, insights: strong }, base, NOW)
  assert.equal(r.verdict, 'levar')
  assert.equal(r.signals.find((s) => s.id === 'retencao').value.startsWith('60%'), true)
})

test('teste fraco: esperar antes de 72 h, refazer depois, com o ponto fraco', () => {
  const input = { status: 'no_ar', durationS: 20, insights: weak }
  assert.equal(readTrial({ ...input, publishedAt: at(30) }, base, NOW).verdict, 'esperar')
  const late = readTrial({ ...input, publishedAt: at(SETTLED_HOURS + 5) }, base, NOW)
  assert.equal(late.verdict, 'refazer')
  assert.match(late.detail, /saem cedo/)
})

test('poucas visualizações: cedo e depois refazer', () => {
  const few = { views: 40, reach: 35, total_interactions: 5, shares: 2, saved: 2 }
  assert.equal(readTrial({ status: 'no_ar', publishedAt: at(30), insights: few }, base, NOW).verdict, 'cedo')
  assert.equal(readTrial({ status: 'no_ar', publishedAt: at(SETTLED_HOURS + 1), insights: few }, base, NOW).verdict, 'refazer')
})

test('sem reels para comparar usa referências fixas e ignora visualizações', () => {
  const r = readTrial({ status: 'no_ar', publishedAt: at(30), durationS: 15, insights: strong }, baselineOf([]), NOW)
  assert.equal(r.signals.find((s) => s.id === 'visualizacoes').score, null)
  assert.equal(r.verdict, 'levar')
})

test('sem duração do vídeo a retenção fica sem nota e o resto decide', () => {
  const r = readTrial({ status: 'no_ar', publishedAt: at(30), insights: strong }, base, NOW)
  assert.equal(r.signals.find((s) => s.id === 'retencao').score, null)
  assert.ok(r.score !== null)
})
