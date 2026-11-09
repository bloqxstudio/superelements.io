import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CONNECTED_AREAS } from '../../src/features/cerebro/contextText.ts'

// Garantia da Fase 4 da nova jornada de criação (2026-11-09): tudo o que cria lê o Cérebro da conta.
const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')

for (const { area, file, uses } of CONNECTED_AREAS) {
  test(`${area} cria com o Cérebro da conta`, () => {
    assert.ok(read(file).includes(uses), `${file} deixou de usar ${uses}: a área ${area} perdeu o contexto da conta`)
  })
}

test('a voz da Avence só entra pela regra da conta da casa', () => {
  const agent = read('scripts/copy/agent.ts')
  assert.match(agent, /usesHouseVoice\(r\.account\)/)
  // AVENCE_VOICE só aparece no import e no ramo da conta da casa
  assert.equal(agent.split('AVENCE_VOICE').length - 1, 2)
})

test('na conta da casa a marca da Avence não entra em projeto de cliente', () => {
  assert.match(read('src/features/iara/engine.ts'), /team\.isHome && \/\^\\\/\(projetos\|sites\)\\\/\//)
  assert.match(read('src/pages/Creatives.tsx'), /clientProjectAtHome/)
  assert.match(read('src/features/cerebro/accountBrand.ts'), /linksProjects: !team\.isHome/)
})
