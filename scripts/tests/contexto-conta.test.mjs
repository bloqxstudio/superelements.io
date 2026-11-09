import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanOverview, contextText, planText, usesHouseVoice } from '../../src/features/cerebro/contextText.ts'

const plan = { offer: 'Películas automotivas', audience: 'Donos de carro em Porto Alegre', tone: 'Direto', goal: '', restrictions: 'Sem preço', pillars: ['Conforto', 'Proteção'] }

test('contexto da conta: Cérebro, Plano e marca, nesta ordem', () => {
  const t = contextText({ name: 'Vizor', overview: '# Vizor\n\nLoja de películas em Porto Alegre.', plan, standard: 'Regras de posts da marca: fundo escuro.' })
  assert.match(t, /^# Contexto da empresa: Vizor/)
  assert.ok(t.indexOf('Loja de películas') < t.indexOf('Oferta: Películas'))
  assert.ok(t.indexOf('Oferta: Películas') < t.indexOf('fundo escuro'))
  assert.match(t, /Restrições \(não fazer\): Sem preço/)
  assert.match(t, /Pilares: Conforto · Proteção/)
  assert.doesNotMatch(t, /Objetivo:/)
})

test('contexto vazio quando a conta não tem nada; esqueleto do README não conta', () => {
  assert.equal(contextText({ name: 'X' }), '')
  assert.equal(cleanOverview('# Quem somos\n\n## O que vendemos\n<!-- preencha -->\n'), '')
  assert.equal(contextText({ name: 'X', overview: '# Quem somos\n\n## Produtos\n' }), '')
  assert.equal(planText(null), '')
})

test('voz da Avence só na conta da casa (ou sem conta)', () => {
  assert.equal(usesHouseVoice(undefined), true)
  assert.equal(usesHouseVoice({ isHome: true }), true)
  assert.equal(usesHouseVoice({ isHome: false }), false)
})
