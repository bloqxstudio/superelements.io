import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Modelo por tarefa e no chat (2026-11-10): "seletor de qual modelo e agente vai executar qual ação"

const home = mkdtempSync(path.join(os.tmpdir(), 'codex-home-'))
writeFileSync(path.join(home, 'models_cache.json'), JSON.stringify({ models: [
  { slug: 'gpt-a', visibility: 'list', display_name: 'GPT A' },
  { slug: 'gpt-escondido', visibility: 'hide' },
  { slug: 'gpt-b', visibility: 'list', display_name: 'GPT B', description: 'Rápido' },
] }))
writeFileSync(path.join(home, 'config.toml'), 'model = "gpt-b"\n')
process.env.CODEX_HOME = home
delete process.env.CODEX_MODEL

const { claudeModel, codexModelArgs, codexModels, cleanModel, withModel } = await import('../criativos/modelos.ts')

test('lista só os modelos visíveis do Codex', () => {
  assert.deepEqual(codexModels().map((m) => m.id), ['gpt-a', 'gpt-b'])
  assert.equal(codexModels()[1].hint, 'Rápido')
})

test('Codex: sem escolha usa o config.toml; com escolha, a escolhida', async () => {
  assert.deepEqual(codexModelArgs(), [])
  assert.deepEqual(codexModelArgs('gpt-a'), ['-c', 'model="gpt-a"'])
  await withModel('gpt-a', async () => assert.deepEqual(codexModelArgs(), ['-c', 'model="gpt-a"']))
  // Modelo do Claude ou fora da lista não vai ao Codex
  await withModel('opus', async () => assert.deepEqual(codexModelArgs(), []))
  assert.deepEqual(codexModelArgs('gpt-sumiu'), [])
})

test('Claude: o do pedido em andamento, só se for do Claude', async () => {
  assert.equal(claudeModel(), 'sonnet')
  await withModel('opus', async () => assert.equal(claudeModel(), 'opus'))
  await withModel('gpt-a', async () => assert.equal(claudeModel(), 'sonnet'))
  assert.equal(claudeModel('haiku'), 'haiku')
})

test('modelo com aspas ou espaço é recusado', () => {
  assert.equal(cleanModel('gpt"; rm'), undefined)
  assert.equal(cleanModel('claude-opus-5-5'), 'claude-opus-5-5')
})
