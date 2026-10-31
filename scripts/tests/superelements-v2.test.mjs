import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  STATUS_LABEL,
  approvalIsCurrent,
  briefOf,
  briefText,
  canApprove,
  checkLink,
  checkTransition,
  classifyError,
  hashOf,
  joinParagraphs,
  missingContext,
  pendingActions,
  sameScript,
  scriptParagraphs,
  validateContentDraft,
  validateContextDraft,
} from '../../src/features/conteudos/rules.ts'

const sql = readFileSync(new URL('../../supabase/migrations/20261031041728_superelements_v2_plano_conteudos.sql', import.meta.url), 'utf8')
const fn = (name) => {
  const start = sql.indexOf(`function public.${name}(`)
  assert.ok(start > 0, `função ${name} não encontrada`)
  const end = sql.indexOf('\n$$;', sql.indexOf('as $$', start))
  return sql.slice(start, end)
}

const ctx = { teamId: 't', offer: 'Sites que geram conversa', audience: 'Clínicas locais', tone: 'Direto', goal: 'Mais contatos', restrictions: 'Sem promessas', pillars: ['Casos', 'Bastidores'], version: 3, updatedAt: 1 }
const content = (over = {}) => ({ id: 'c1', title: 'Post', status: 'producao', script: 'Texto', goal: '', idea: '', format: 'post-instagram', ...over })

// ---------- transições e aprovação ----------

test('transições: só os caminhos previstos', () => {
  const ok = (from, to, role = 'admin', script = 'x') => checkTransition({ status: from, script }, to, role).ok
  assert.ok(ok('ideia', 'producao'))
  assert.ok(ok('producao', 'revisao'))
  assert.ok(ok('revisao', 'aprovado'))
  assert.ok(ok('revisao', 'producao'))
  assert.ok(ok('aprovado', 'producao'))
  assert.ok(!ok('ideia', 'aprovado'))
  assert.ok(!ok('ideia', 'revisao'))
  assert.ok(!ok('producao', 'aprovado'))
  assert.ok(!ok('aprovado', 'revisao'))
  assert.ok(!ok('aprovado', 'ideia'))
  assert.deepEqual(Object.keys(STATUS_LABEL), ['ideia', 'producao', 'revisao', 'aprovado'])
})

test('aprovar é só de dono e gestor; vendedor não aprova', () => {
  const c = { status: 'revisao', script: 'x' }
  assert.ok(checkTransition(c, 'aprovado', 'owner').ok)
  assert.ok(checkTransition(c, 'aprovado', 'admin').ok)
  assert.equal(checkTransition(c, 'aprovado', 'seller').ok, false)
  assert.equal(checkTransition(c, 'aprovado', undefined).ok, false)
  // pedir ajustes e submeter não exigem gestor
  assert.ok(checkTransition(c, 'producao', 'seller').ok)
  assert.ok(checkTransition({ status: 'producao', script: 'x' }, 'revisao', 'seller').ok)
})

test('revisão exige roteiro', () => {
  assert.equal(checkTransition({ status: 'producao', script: '   \n' }, 'revisao', 'admin').ok, false)
})

test('aprovação só vale com o hash atual (edição posterior derruba)', () => {
  assert.ok(approvalIsCurrent({ status: 'aprovado', approvedHash: 'h1', contentHash: 'h1' }))
  assert.equal(approvalIsCurrent({ status: 'aprovado', approvedHash: 'h1', contentHash: 'h2' }), false)
  assert.equal(approvalIsCurrent({ status: 'producao', approvedHash: 'h1', contentHash: 'h1' }), false)
  assert.equal(approvalIsCurrent({ status: 'aprovado', approvedHash: undefined, contentHash: 'h1' }), false)
})

test('aprovar bloqueia com mudanças não salvas ou Copy diferente do roteiro', () => {
  const c = { status: 'revisao', script: 'Olá\n\nmundo' }
  const same = checkLink('copy', { script: c.script, docScript: 'Olá\n\n\nmundo ', available: true })
  const other = checkLink('copy', { script: c.script, docScript: 'Outro texto', available: true })
  assert.equal(same.state, 'igual')
  assert.equal(other.state, 'diferente')
  assert.ok(canApprove(c, 'admin', [same], false).ok)
  assert.match(canApprove(c, 'admin', [same], true).reason, /Salve/)
  assert.equal(canApprove(c, 'admin', [other], false).ok, false)
  assert.equal(canApprove(c, 'seller', [same], false).ok, false)
})

test('material de Criativos nunca bloqueia, mas avisa que o design mudou e que a aprovação não o cobre', () => {
  const same = checkLink('criativos', { script: 'x', linkedHash: 'a', currentHash: 'a', available: true })
  const changed = checkLink('criativos', { script: 'x', linkedHash: 'a', currentHash: 'b', available: true })
  assert.equal(same.blocksApproval, false)
  assert.equal(changed.blocksApproval, false)
  assert.equal(changed.state, 'diferente')
  assert.match(changed.note, /cobre só o texto, não os criativos/)
  assert.match(same.note, /só o texto/)
})

test('material indisponível não bloqueia a aprovação do texto e diz por quê', () => {
  const gone = checkLink('copy', { script: 'x', available: false })
  assert.equal(gone.state, 'indisponivel')
  assert.equal(gone.blocksApproval, false)
})

// ---------- texto do roteiro ----------

test('roteiro ↔ parágrafos é estável', () => {
  const script = 'Gancho\n\nCorpo linha 1\nlinha 2\n\nChamada'
  assert.deepEqual(scriptParagraphs(script), ['Gancho', 'Corpo linha 1\nlinha 2', 'Chamada'])
  assert.equal(joinParagraphs(scriptParagraphs(script)), script)
  assert.ok(sameScript('a\r\n\r\nb', 'a\n\n\n\nb\n'))
  assert.equal(sameScript('a', 'b'), false)
})

// ---------- briefing ----------

test('briefing: objetivo do conteúdo vence o do plano; sem plano nada é inventado', () => {
  const b = briefOf(ctx, { goal: 'Vender a oferta de março', idea: 'Bastidores', format: 'carrossel' })
  assert.equal(b.objective, 'Vender a oferta de março')
  assert.equal(b.audience, 'Clínicas locais')
  assert.equal(b.channel, 'Carrossel')
  assert.match(b.notes, /Pilares da empresa: Casos, Bastidores/)
  assert.match(b.notes, /Restrições \(não fazer\): Sem promessas/)
  assert.match(b.notes, /Ideia: Bastidores/)
  assert.equal(briefOf(ctx, { goal: '', idea: '', format: 'livre' }).objective, 'Mais contatos')

  const none = briefOf(null, { goal: '', idea: '', format: 'livre' })
  assert.deepEqual({ ...none, channel: '' }, { objective: '', audience: '', tone: '', offer: '', channel: '', notes: '' })
  assert.match(briefText(b), /Público: Clínicas locais/)
})

test('plano incompleto: oferta e público são o mínimo', () => {
  assert.deepEqual(missingContext(null), ['oferta', 'público'])
  assert.deepEqual(missingContext({ offer: 'x', audience: ' ' }), ['público'])
  assert.deepEqual(missingContext(ctx), [])
})

// ---------- validações ----------

test('validações espelham os limites do banco', () => {
  assert.ok(validateContentDraft({ title: ' ', idea: '', goal: '', script: '' }))
  assert.ok(validateContentDraft({ title: 'a'.repeat(161), idea: '', goal: '', script: '' }))
  assert.ok(validateContentDraft({ title: 'ok', idea: '', goal: '', script: 'a'.repeat(20001) }))
  assert.equal(validateContentDraft({ title: 'ok', idea: '', goal: '', script: '' }), undefined)
  const base = { offer: '', audience: '', tone: '', goal: '', restrictions: '', pillars: [] }
  assert.equal(validateContextDraft(base), undefined)
  assert.ok(validateContextDraft({ ...base, offer: 'a'.repeat(2001) }))
  assert.ok(validateContextDraft({ ...base, pillars: Array.from({ length: 9 }, (_, i) => `p${i}`) }))
  assert.ok(validateContextDraft({ ...base, pillars: ['a'.repeat(61)] }))
})

test('erros do servidor viram categorias', () => {
  assert.equal(classifyError('conflito_de_versao'), 'conflito')
  assert.equal(classifyError('modulo_desligado'), 'modulo')
  assert.equal(classifyError('so_gestor'), 'so-gestor')
  assert.equal(classifyError('sem_acesso'), 'sem-acesso')
  assert.equal(classifyError('transicao_invalida'), 'transicao')
  assert.equal(classifyError('projeto_de_outra_conta'), 'projeto')
  assert.equal(classifyError('algo novo'), 'desconhecido')
})

test('hash estável: mesma coisa com chaves em outra ordem dá o mesmo hash', async () => {
  assert.equal(await hashOf({ a: 1, b: [1, { y: 1, x: 2 }] }), await hashOf({ b: [1, { x: 2, y: 1 }], a: 1 }))
  assert.notEqual(await hashOf({ a: 1 }), await hashOf({ a: 2 }))
  assert.match(await hashOf('x'), /^[0-9a-f]{64}$/)
})

// ---------- pendências do Início ----------

test('Início: gestor sem plano é mandado ao plano; vendedor só é avisado', () => {
  const manager = pendingActions({ role: 'owner', context: null, contents: [], now: Date.parse('2026-10-31') })
  assert.equal(manager[0].id, 'plano-vazio')
  assert.equal(manager[0].to, '/plano')
  assert.match(manager[0].action, /Preencher/)
  const seller = pendingActions({ role: 'seller', context: null, contents: [], now: Date.parse('2026-10-31') })
  assert.match(seller[0].title, /ainda não foi definido/)
})

test('Início: aprovações pendentes abrem o conteúdo (um) ou a lista filtrada (vários)', () => {
  const now = Date.parse('2026-10-31T12:00:00Z')
  const one = pendingActions({ role: 'admin', context: ctx, contents: [{ id: 'a', title: 'Reels', status: 'revisao' }], now })
  assert.equal(one[0].to, '/conteudos/a')
  assert.match(one[0].title, /Aprovar: Reels/)
  const many = pendingActions({ role: 'admin', context: ctx, contents: [{ id: 'a', title: 'A', status: 'revisao' }, { id: 'b', title: 'B', status: 'revisao' }], now })
  assert.equal(many[0].to, '/conteudos?estado=revisao')
  const seller = pendingActions({ role: 'seller', context: ctx, contents: [{ id: 'a', title: 'A', status: 'revisao' }], now })
  assert.match(seller[0].reason, /Esperando um gestor/)
})

test('Início: data editorial vencida só conta o que não foi aprovado', () => {
  const now = Date.parse('2026-10-31T12:00:00Z')
  const list = [
    { id: '1', title: 'Atrasado', status: 'producao', editorialDate: '2026-10-20' },
    { id: '2', title: 'Aprovado antigo', status: 'aprovado', editorialDate: '2026-10-01' },
    { id: '3', title: 'Futuro', status: 'ideia', editorialDate: '2026-11-20' },
  ]
  const out = pendingActions({ role: 'admin', context: ctx, contents: list, now })
  const late = out.find((a) => a.id === 'data-vencida')
  assert.ok(late)
  assert.equal(late.to, '/conteudos/1')
})

test('Início: sem conteúdo e plano pronto, convida a criar; tudo em dia não inventa pendência', () => {
  const now = Date.parse('2026-10-31')
  assert.equal(pendingActions({ role: 'admin', context: ctx, contents: [], now })[0].id, 'sem-conteudo')
  assert.deepEqual(pendingActions({ role: 'admin', context: ctx, contents: [{ id: 'a', title: 'A', status: 'aprovado' }], now }), [])
})

// ---------- migração: o que o servidor garante (análise do SQL; o SQL não foi executado aqui) ----------

const TABLES = ['crm_account_context', 'crm_account_context_versions', 'crm_contents', 'crm_content_snapshots', 'crm_content_links']
const RPCS = ['crm_context_save', 'crm_content_create', 'crm_content_save', 'crm_content_transition', 'crm_content_delete', 'crm_content_link', 'crm_content_unlink']

test('migração: RLS ligada e só leitura para quem está logado (nenhum caminho de escrita direto)', () => {
  for (const t of TABLES) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), t)
    assert.match(sql, new RegExp(`create policy "[^"]+" on public\\.${t}\\s+for select to authenticated`), t)
  }
  assert.doesNotMatch(sql, /create policy[^;]*\bfor (insert|update|delete|all)\b/i)
  assert.match(sql, /revoke all on public\.crm_account_context[\s\S]*?from anon, authenticated;/)
  assert.match(sql, /grant select on public\.crm_account_context[\s\S]*?to authenticated;/)
  assert.doesNotMatch(sql, /grant (insert|update|delete)/i)
})

test('migração: leitura exige membro da conta e módulo copy ligado (conta pausada some junto)', () => {
  const policies = sql.match(/create policy[\s\S]*?;\n/g) ?? []
  assert.equal(policies.length, TABLES.length)
  for (const p of policies) {
    assert.match(p, /public\.is_crm_member\(team_id\)/)
    assert.match(p, /public\.crm_module_on\(team_id, 'copy'\)/)
  }
})

test('migração: toda função de escrita é security definer, com search_path fixo e sem acesso público', () => {
  for (const name of RPCS) {
    const body = fn(name)
    assert.match(body, /security definer/, name)
    assert.match(body, /set search_path = public/, name)
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`), name)
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`), name)
    assert.ok(/crm_v2_require\(/.test(body), `${name} precisa conferir conta, módulo e papel`)
  }
})

test('migração: o ajudante de acesso valida login, conta, módulo e gestor, e não é chamável de fora', () => {
  const body = fn('crm_v2_require')
  assert.match(body, /auth\.uid\(\)/)
  assert.match(body, /is_crm_member\(p_team\)/)
  assert.match(body, /crm_module_on\(p_team, 'copy'\)/)
  assert.match(body, /is_crm_manager\(p_team\)/)
  assert.match(sql, /revoke all on function public\.crm_v2_require\(uuid, boolean\) from public, anon, authenticated;/)
  assert.match(sql, /revoke all on function public\.crm_content_hash\([^)]*\) from public, anon, authenticated;/)
})

test('migração: aprovar e gravar o contexto exigem gestor; versão esperada é obrigatória', () => {
  assert.match(fn('crm_context_save'), /crm_v2_require\(p_team, true\)/)
  assert.match(fn('crm_content_transition'), /crm_v2_require\(tid, p_to = 'aprovado'\)/)
  assert.match(fn('crm_content_delete'), /crm_v2_require\(cur\.team_id, true\)/)
  for (const name of ['crm_context_save', 'crm_content_save', 'crm_content_transition']) assert.match(fn(name), /conflito_de_versao/, name)
  for (const name of ['crm_content_save', 'crm_content_transition']) assert.match(fn(name), /for update/, `${name} serializa a linha`)
  assert.match(fn('crm_content_transition'), /cur\.version is distinct from p_expected/)
})

test('migração: a restrição do banco impede "aprovado" velho ou sem registro', () => {
  assert.match(sql, /constraint crm_contents_approval_ck check \(/)
  assert.match(sql, /\(status = 'aprovado'\) = \(approved_version is not null and approved_hash is not null\)/)
  assert.match(sql, /status <> 'aprovado' or approved_hash = content_hash/)
  // editar o texto de um aprovado volta para produção e limpa a aprovação
  const save = fn('crm_content_save')
  assert.match(save, /v_hash is distinct from cur\.content_hash and cur\.status = 'aprovado'/)
  assert.match(save, /v_status := 'producao'/)
})

test('migração: a transição sai do mesmo mapa da tela e grava snapshot ao submeter e aprovar', () => {
  const body = fn('crm_content_transition')
  for (const pair of ["('ideia', 'producao')", "('producao', 'ideia')", "('producao', 'revisao')", "('revisao', 'producao')", "('revisao', 'aprovado')", "('aprovado', 'producao')"]) {
    assert.ok(body.includes(pair), pair)
  }
  assert.match(body, /insert into public\.crm_content_snapshots/)
  assert.match(body, /roteiro_vazio/)
  assert.match(body, /approved_by = case when p_to = 'aprovado' then me end/)
})

test('migração: snapshots e versões do contexto são imutáveis (só saem em cascata)', () => {
  assert.match(sql, /create trigger crm_content_snapshots_immutable before update or delete on public\.crm_content_snapshots/)
  assert.match(sql, /create trigger crm_account_context_versions_immutable before update or delete on public\.crm_account_context_versions/)
  assert.match(sql, /tg_op = 'DELETE' and pg_trigger_depth\(\) > 1/)
})

test('migração: vínculos e snapshots só existem dentro da mesma conta (chaves compostas e projeto da conta)', () => {
  assert.match(sql, /unique \(id, team_id\)/)
  const refs = sql.match(/foreign key \(content_id, team_id\) references public\.crm_contents \(id, team_id\) on delete cascade/g) ?? []
  assert.equal(refs.length, 2)
  assert.match(sql, /unique \(content_id, kind\)/)
  assert.match(sql, /unique \(team_id, kind, artifact_id\)/)
  const link = fn('crm_content_link')
  assert.match(link, /projeto_de_outra_conta/)
  assert.match(link, /sp\.team_id = tid/)
  assert.match(link, /crm_module_on\(tid, 'criativos'\)/)
  assert.match(link, /ja_vinculado/)
})

test('migração: sem Realtime e sem alterar migrações antigas', () => {
  assert.doesNotMatch(sql, /supabase_realtime/)
  assert.doesNotMatch(sql, /alter table public\.(crm_teams|crm_opportunities|space_projects)/i)
  assert.doesNotMatch(sql, /drop (table|function|policy)/i)
})
