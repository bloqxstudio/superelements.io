import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SETTINGS_DEFAULT, cleanDefinition, cleanSettings, formIssues } from '../../supabase/functions/_shared/forms.ts'

const choice = (id, labels, extra = {}) => ({ id, type: 'choice', label: 'Pergunta', required: true, options: labels.map((l, i) => ({ id: `${id}o${i}`, label: l })), ...extra })
const errs = (def, settings = SETTINGS_DEFAULT) => formIssues(cleanDefinition(def), cleanSettings(settings)).filter((i) => i.level === 'error').map((i) => i.text)

test('formulário em ordem não tem erro', () => {
  assert.deepEqual(errs({ kind: 'form', results: [], steps: [{ id: 's1', title: 'Qual?', fields: [choice('f1', ['A', 'B'])] }] }), [])
})

test('etapa vazia e opções padrão impedem publicar (o caso do /f/site em 2026-11-05)', () => {
  const e = errs({
    kind: 'form',
    results: [],
    steps: [
      { id: 's1', title: 'Anúncios', fields: [choice('f1', ['A', 'B']), choice('f2', ['Opção 1', 'Opção 2'], { label: '', required: false })] },
      { id: 's2', title: 'Investimento', fields: [] },
    ],
  })
  assert.ok(e.some((t) => /sem pergunta/.test(t)))
  assert.ok(e.some((t) => /opções padrão/.test(t)))
  assert.ok(e.some((t) => /sem texto/.test(t)))
})

test('agenda filtrando por pergunta que sumiu é erro; desligada, não', () => {
  const def = { kind: 'form', results: [], steps: [{ id: 's1', title: 'Qual?', fields: [choice('f1', ['A', 'B'])] }] }
  const booking = { enabled: true, gate: { mode: 'answer', field: 'fx', values: ['o1'] } }
  assert.ok(errs(def, { ...SETTINGS_DEFAULT, booking }).some((t) => /agenda/.test(t)))
  assert.deepEqual(errs(def, { ...SETTINGS_DEFAULT, booking: { ...booking, enabled: false } }), [])
})

test('pergunta única com título pode ficar sem texto próprio', () => {
  assert.deepEqual(errs({ kind: 'form', results: [], steps: [{ id: 's1', title: 'Seu site?', fields: [{ id: 'f1', type: 'short', label: '', required: true }] }] }), [])
})
