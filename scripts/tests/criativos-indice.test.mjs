import test from 'node:test'
import assert from 'node:assert/strict'
import { indexChanges, indexHolds, upsertRow, writeIndexSafely } from '../../src/features/criativos/indexMerge.ts'

// Revisão de 2026-11-13: o MCP e o navegador gravam o mesmo index.json; nenhum lado pode apagar a linha do outro.

test('índice: a gravação de um lado não apaga a linha que o outro gravou no meio', async () => {
  let stored = [{ id: 'a', updatedAt: 1 }]
  let raced = false
  const read = async () => structuredClone(stored)
  const write = async (list) => {
    // O navegador grava "b" com a lista que leu antes, por cima da gravação do MCP
    if (!raced) {
      raced = true
      stored = [{ id: 'b', updatedAt: 5 }, { id: 'a', updatedAt: 1 }]
      return
    }
    stored = structuredClone(list)
  }
  await writeIndexSafely(read, write, (list) => upsertRow(list, 'ia-1', () => ({ id: 'ia-1', updatedAt: 9 })))
  assert.deepEqual(stored.map((r) => r.id).sort(), ['a', 'b', 'ia-1'])
})

test('índice: mudar uma linha mantém as outras e a posição; tirar some com ela', () => {
  const list = [{ id: 'x', updatedAt: 1 }, { id: 'y', updatedAt: 2 }]
  const next = upsertRow(list, 'y', (old) => ({ ...old, updatedAt: 3 }))
  assert.deepEqual(next.map((r) => r.id), ['x', 'y'])
  const { upserts, removed } = indexChanges(list, next)
  assert.deepEqual(upserts, [{ id: 'y', updatedAt: 3 }])
  assert.deepEqual(removed, [])
  assert.ok(indexHolds(next, upserts, removed))
  assert.ok(!indexHolds(list, upserts, removed))
  // Uma linha mais nova do mesmo conjunto também vale
  assert.ok(indexHolds([{ id: 'y', updatedAt: 7 }], upserts, []))
  assert.ok(!indexHolds(list, [], ['x']))
})

test('índice: sem mudança, não grava', async () => {
  let writes = 0
  await writeIndexSafely(async () => [{ id: 'a', updatedAt: 1 }], async () => { writes++ }, (list) => list)
  assert.equal(writes, 0)
})
