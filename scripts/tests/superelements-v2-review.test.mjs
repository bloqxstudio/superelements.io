import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { editorialDay, editorialLate, pendingActions, unwrapRow } from '../../src/features/conteudos/rules.ts'
import { createOnce, isAlreadyExists } from '../../src/features/conteudos/exclusive.ts'

// Segunda passagem de revisão da v2: fuso da data editorial, criação exclusiva, resposta das funções,
// logs imutáveis, briefing em Criativos e proteção do detalhe do conteúdo.

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const sql = read('../../supabase/migrations/20261031041728_superelements_v2_plano_conteudos.sql')
const ctx = { teamId: 't', offer: 'x', audience: 'y', tone: '', goal: '', restrictions: '', pillars: [], version: 1, updatedAt: 1 }

// ---------- data editorial ----------

test('dia editorial é o de São Paulo, não o de UTC (fronteira da noite)', () => {
  // 22h30 em São Paulo (UTC-3) já é 01h30 do dia seguinte em UTC
  assert.equal(editorialDay(Date.parse('2026-11-01T01:30:00Z')), '2026-10-31')
  assert.equal(editorialDay(Date.parse('2026-11-01T02:59:59Z')), '2026-10-31')
  assert.equal(editorialDay(Date.parse('2026-11-01T03:00:00Z')), '2026-11-01')
  assert.equal(editorialDay(Date.parse('2026-10-31T02:59:59Z')), '2026-10-30')
})

test('data editorial de hoje não está vencida às 22h em São Paulo; a de ontem está', () => {
  const night = Date.parse('2026-11-01T01:30:00Z')
  assert.equal(editorialLate({ editorialDate: '2026-10-31', status: 'producao' }, night), false)
  assert.equal(editorialLate({ editorialDate: '2026-10-30', status: 'producao' }, night), true)
  assert.equal(editorialLate({ editorialDate: '2026-10-30', status: 'aprovado' }, night), false)
  assert.equal(editorialLate({ status: 'ideia' }, night), false)
  const out = pendingActions({ role: 'admin', context: ctx, contents: [{ id: 'a', title: 'Hoje', status: 'producao', editorialDate: '2026-10-31' }], now: night })
  assert.equal(out.find((a) => a.id === 'data-vencida'), undefined)
  const late = pendingActions({ role: 'admin', context: ctx, contents: [{ id: 'a', title: 'Ontem', status: 'producao', editorialDate: '2026-10-30' }], now: night })
  assert.ok(late.find((a) => a.id === 'data-vencida'))
})

test('fonte única: nenhuma comparação de data editorial usa UTC', () => {
  for (const file of ['../../src/features/conteudos/rules.ts', '../../src/pages/crm/Contents.tsx', '../../src/pages/crm/ContentDetail.tsx', '../../src/features/conteudos/PlanBlock.tsx']) {
    assert.doesNotMatch(read(file), /toISOString\(\)\.slice/, file)
  }
  assert.match(read('../../src/pages/crm/Contents.tsx'), /editorialLate\(c, Date\.now\(\)\)/)
})

// ---------- criação exclusiva ----------

const fakeStore = (initial, opts = {}) => {
  const state = { file: initial, writes: [], indexed: [] }
  return {
    state,
    adapter: {
      load: async () => {
        if (opts.loadFails) throw new Error('rede')
        return state.file
      },
      create: async (value) => {
        if (opts.createFails) throw new Error('403')
        // outra aba criou entre a nossa leitura e a nossa escrita
        if (opts.raceWith && state.file === undefined) state.file = opts.raceWith
        if (state.file !== undefined) return 'exists'
        state.file = value
        state.writes.push(value)
        return 'created'
      },
      index: async (value) => void state.indexed.push(value),
    },
  }
}

test('criação exclusiva: cria e indexa quando não existe', async () => {
  const s = fakeStore(undefined)
  const r = await createOnce(s.adapter, { v: 'novo' })
  assert.deepEqual(r, { value: { v: 'novo' }, created: true })
  assert.equal(s.state.writes.length, 1)
  assert.equal(s.state.indexed.length, 1)
})

test('criação exclusiva: o que já existe é reaproveitado sem escrever', async () => {
  const s = fakeStore({ v: 'editado' })
  const r = await createOnce(s.adapter, { v: 'novo' })
  assert.deepEqual(r, { value: { v: 'editado' }, created: false })
  assert.equal(s.state.writes.length, 0)
  assert.equal(s.state.indexed.length, 0)
})

test('criação exclusiva: duas abas, a que perde reaproveita o vencedor e não sobrescreve', async () => {
  const s = fakeStore(undefined, { raceWith: { v: 'da outra aba, já editado' } })
  const r = await createOnce(s.adapter, { v: 'minha' })
  assert.equal(r.created, false)
  assert.deepEqual(r.value, { v: 'da outra aba, já editado' })
  assert.equal(s.state.writes.length, 0)
  assert.equal(s.state.indexed.length, 0)
})

test('criação exclusiva: falha de rede ou permissão sobe, nunca vira "não existe"', async () => {
  const a = fakeStore({ v: 'existente' }, { loadFails: true })
  await assert.rejects(createOnce(a.adapter, { v: 'novo' }), /rede/)
  assert.deepEqual(a.state.file, { v: 'existente' })
  assert.equal(a.state.writes.length, 0)
  const b = fakeStore(undefined, { createFails: true })
  await assert.rejects(createOnce(b.adapter, { v: 'novo' }), /403/)
  assert.equal(b.state.indexed.length, 0)
})

test('criação exclusiva: conflito sem conseguir ler o vencedor é erro, não sucesso', async () => {
  const adapter = { load: async () => undefined, create: async () => 'exists', index: async () => {} }
  await assert.rejects(createOnce(adapter, { v: 1 }), /não consegui lê-lo/)
})

test('conflito do Storage é reconhecido; outros erros não', () => {
  assert.ok(isAlreadyExists({ statusCode: '409', message: 'The resource already exists' }))
  assert.ok(isAlreadyExists({ status: 409 }))
  assert.ok(isAlreadyExists({ message: 'Duplicate' }))
  assert.equal(isAlreadyExists({ statusCode: '403', message: 'new row violates row-level security policy' }), false)
  assert.equal(isAlreadyExists(null), false)
})

test('os armazenamentos usam a criação exclusiva (upsert: false) e forward não engole erro de leitura', () => {
  for (const [file, fnName] of [['../../src/features/copy/storage.ts', 'createDocOnce'], ['../../src/features/criativos/storage.ts', 'createSetOnce']]) {
    const src = read(file)
    const body = src.slice(src.indexOf(`export async function ${fnName}`), src.indexOf(`export async function ${fnName}`) + 1500)
    assert.match(body, /upsert: false/, fnName)
    assert.match(body, /isAlreadyExists/, fnName)
    // as gravações normais seguem com upsert
    assert.match(src, /upsert: true/)
  }
  const forward = read('../../src/features/conteudos/forward.ts')
  assert.doesNotMatch(forward, /\.catch\(\s*\(\)\s*=>\s*undefined\s*\)/)
  assert.match(forward, /createDocOnce\(doc\)/)
  assert.match(forward, /createSetOnce\(set\)/)
})

// ---------- resposta das funções ----------

test('resposta das funções: objeto, lista de uma linha, e rejeita o resto', () => {
  const row = { team_id: 't', version: 2 }
  assert.deepEqual(unwrapRow(row, ['team_id', 'version']), row)
  assert.deepEqual(unwrapRow([row], ['team_id', 'version']), row)
  assert.throws(() => unwrapRow([], ['team_id']), /inesperada/)
  assert.throws(() => unwrapRow([row, row], ['team_id']), /inesperada/)
  assert.throws(() => unwrapRow(null, ['team_id']), /inesperada/)
  assert.throws(() => unwrapRow('x', ['team_id']), /inesperada/)
  assert.throws(() => unwrapRow([[row]], ['team_id']), /inesperada/)
  assert.throws(() => unwrapRow({ team_id: 't' }, ['team_id', 'version']), /version/)
  assert.throws(() => unwrapRow({ team_id: 't', version: null }, ['team_id', 'version']), /version/)
})

test('api.ts passa a linha de cada função por unwrapRow', () => {
  const api = read('../../src/features/conteudos/api.ts')
  assert.match(api, /unwrapRow\(data, required\)/)
  for (const fn of ['crm_context_save', 'crm_content_create', 'crm_content_save', 'crm_content_transition', 'crm_content_link']) {
    assert.match(api, new RegExp(`'${fn}'[^\\n]*_KEYS\\)`), fn)
  }
})

// ---------- migração ----------

test('migração: logs imutáveis não têm chave para auth.users (excluir usuário não trava no trigger)', () => {
  const block = (name) => {
    const start = sql.indexOf(`create table public.${name} (`)
    // sem os comentários, que explicam justamente a ausência da chave
    return sql.slice(start, sql.indexOf('\n);', start)).replace(/^\s*--.*$/gm, '')
  }
  for (const t of ['crm_account_context_versions', 'crm_content_snapshots']) assert.doesNotMatch(block(t), /auth\.users/, t)
  assert.match(block('crm_account_context_versions'), /saved_by uuid,/)
  assert.match(block('crm_content_snapshots'), /created_by uuid,/)
  // as tabelas mutáveis continuam anonimizando por set null
  assert.match(block('crm_contents'), /approved_by uuid references auth\.users \(id\) on delete set null/)
  // e o trigger de imutabilidade continua barrando alteração do conteúdo registrado
  assert.match(sql, /create trigger crm_content_snapshots_immutable before update or delete/)
})

// ---------- Criativos e detalhe ----------

test('Criativos: conjunto de conteúdo herda o briefing e não usa cases alheios; os demais seguem como antes', () => {
  const fields = read('../../src/features/criativos/AiFields.tsx')
  assert.match(fields, /set\?\.source \? \{ \.\.\.EMPTY_AI, brief: set\.brief \?\? '', cases: \[\] \} : EMPTY_AI/)
  const dialog = read('../../src/features/criativos/AiDialog.tsx')
  assert.match(dialog, /aiFormFor\(/)
  assert.doesNotMatch(dialog, /EMPTY_AI/)
  const ai = read('../../src/features/criativos/ai.ts')
  assert.match(ai, /brief: set\.source \? set\.brief : undefined/)
  assert.match(ai, /cases: set\.source \? \[\]/)
  assert.match(ai, /const noCases = form\.cases\.length === 0/)
  assert.match(read('../../scripts/criativos/edit.ts'), /Briefing da empresa/)
  // o fluxo antigo (conjunto sem origem) continua com os cases da Avence
  assert.match(fields, /cases: AV_CASES\.slice\(0, 3\)/)
})

test('ContentDetail: ações que recarregam o texto exigem salvar antes e ignoram respostas de outro id', () => {
  const src = read('../../src/pages/crm/ContentDetail.tsx')
  const body = (name) => {
    const start = src.indexOf(`const ${name} = async`)
    return src.slice(start, src.indexOf('\n  }\n', start))
  }
  for (const name of ['moveTo', 'pullFromCopy', 'pushToCopy', 'forward']) assert.match(body(name), /if \(dirty\)/, name)
  assert.match(body('pullFromCopy'), /window\.confirm/)
  for (const name of ['save', 'moveTo', 'pullFromCopy', 'pushToCopy', 'unlink', 'forward']) assert.match(body(name), /stale\(content\.id\)/, name)
  assert.match(src, /const mine = \+\+seq\.current/)
  assert.ok((src.match(/mine !== seq\.current/g) ?? []).length >= 3)
  // a conferência do Copy vem da leitura real do documento, nunca fabricada
  assert.doesNotMatch(src, /docScript: content\.script/)
  // o botão de estado fica desligado com rascunho solto
  assert.match(src, /const blocked = !check\.ok \|\| dirty \|\| !!busy/)
})
