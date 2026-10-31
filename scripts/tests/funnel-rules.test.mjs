import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TEMPLATES,
  approxCampaignOnly,
  campaignMatch,
  campaignMatches,
  cleanStep,
  cohortRuleOf,
  inCohort,
  isConnected,
  matchPage,
  normalizePath,
  reachedStage,
  salesOf,
  stageCount,
  sumAds,
  transitionOf,
  validateFunnel,
} from '../../src/features/funnels/rules.ts'

const step = (kind, source = {}, name = kind) => ({ name, kind, source })
const ok = (value, extra = {}) => ({ state: 'ok', value, unit: 'x', ...extra })
const opp = (id, stage, history = [], extra = {}) => ({ id, stage, history: history.map((s) => ({ at: '2026-10-01', stage: s })), createdAt: '2026-10-01T00:00:00Z', ...extra })

test('os modelos nascem válidos, só com lacunas de fonte', () => {
  for (const t of TEMPLATES) {
    const { errors, warnings } = validateFunnel(t.name, t.steps)
    assert.deepEqual(errors, [], t.id)
    assert.ok(warnings.some((w) => w.startsWith('Sem fonte conectada')), t.id)
  }
})

test('validação: estados do CRM precisam vir depois da oportunidade e avançar', () => {
  const stageFirst = validateFunnel('F', [step('stage', { stage: 'conversa' }), step('opportunity', { cohort: 'created' })])
  assert.ok(stageFirst.errors.some((e) => e.includes('depois da etapa de oportunidade')))

  const backwards = validateFunnel('F', [step('opportunity', { cohort: 'created' }), step('stage', { stage: 'proposta' }), step('stage', { stage: 'conversa' })])
  assert.ok(backwards.errors.some((e) => e.includes('precisam avançar')))

  const lost = validateFunnel('F', [step('opportunity', { cohort: 'created' }), step('stage', { stage: 'perdido' })])
  assert.ok(lost.errors.some((e) => e.includes('não segue no caminho')))

  assert.deepEqual(validateFunnel('F', [step('opportunity', { cohort: 'created' }), step('stage', { stage: 'fechado' })]).errors, [])
})

test('validação: nome, tamanho e campanha obrigatória para filtrar por campanha', () => {
  assert.ok(validateFunnel('  ', [step('manual')]).errors.length >= 2)
  const noCampaign = validateFunnel('F', [step('opportunity', { cohort: 'created', byCampaign: true }), step('stage', { stage: 'fechado' })])
  assert.ok(noCampaign.errors.some((e) => e.includes('campanhas')))
  const two = validateFunnel('F', [step('opportunity', { cohort: 'created' }), step('opportunity', { cohort: 'created' })])
  assert.ok(two.errors.some((e) => e.includes('só uma etapa de oportunidade')))
})

test('conectada não é o mesmo que ter o campo preenchido', () => {
  assert.equal(isConnected(step('page', { trackerId: 't' })), false)
  assert.equal(isConnected(step('page', { trackerId: 't', path: '/p' })), true)
  assert.equal(isConnected(step('opportunity', { cohort: 'forms', formIds: [] })), false)
  assert.equal(isConnected(step('stage', { stage: 'perdido' })), false)
  assert.equal(isConnected(step('manual')), false)
})

test('cleanStep descarta o que o banco não deveria ter', () => {
  const s = cleanStep({ name: 'x', kind: 'page', source: { trackerId: 't', path: '/a', formIds: ['f'], extra: 1 } })
  assert.deepEqual(s.source, { trackerId: 't', path: '/a' })
  assert.equal(cleanStep({ name: 'x', kind: 'inventado', source: { a: 1 } }).kind, 'manual')
})

test('progressão histórica difere da posição atual', () => {
  const opps = [
    opp('a', 'fechado', ['novo', 'conversa', 'proposta', 'fechado']),
    opp('b', 'proposta', ['novo', 'conversa', 'proposta']),
    opp('c', 'perdido', ['novo', 'conversa', 'perdido']),
    opp('d', 'novo', ['novo']),
    opp('e', 'fechado', ['novo', 'fechado']), // salto: não passou por "conversa" no histórico
  ]
  assert.deepEqual(stageCount(opps, 'conversa'), { reached: 4, current: 0 })
  assert.deepEqual(stageCount(opps, 'proposta'), { reached: 3, current: 1 })
  assert.deepEqual(stageCount(opps, 'fechado'), { reached: 2, current: 2 })
  // perdido não conta como avanço além de onde chegou
  assert.equal(reachedStage(opps[2], 'proposta'), false)
  assert.equal(reachedStage(opp('x', 'inexistente'), 'conversa'), false)
})

test('a coleção do funil vem da etapa de oportunidade e das campanhas escolhidas', () => {
  const campaigns = [{ id: 'c1', name: 'Site Novo' }]
  const steps = [step('campaign', { accountId: 'a', campaigns }), step('opportunity', { cohort: 'forms', formIds: ['f1'], byCampaign: true })]
  const rule = cohortRuleOf(steps)
  assert.deepEqual(rule.campaigns, campaigns)
  // coleção de formulários: quem escolhe as oportunidades é o vínculo da resposta (feito no carregamento);
  // a campanha é filtrada nas respostas, não no `origin` da oportunidade
  assert.ok(inCohort(opp('1', 'novo', [], { campaignId: 'outra' }), rule))

  const created = cohortRuleOf([step('campaign', { accountId: 'a', campaigns }), step('opportunity', { cohort: 'created', byCampaign: true })])
  assert.ok(inCohort(opp('c1', 'novo', [], { campaignId: 'c1' }), created))
  assert.ok(!inCohort(opp('c2', 'novo', [], { campaignId: 'c9', campaignName: 'Site Novo' }), created), 'id diferente nunca casa por nome igual')
  assert.ok(!inCohort(opp('c3', 'novo', [], { campaignName: 'Site Novo' }), created), 'só o nome: aproximação, fora da contagem')
  assert.ok(approxCampaignOnly(opp('c3', 'novo', [], { campaignName: ' site novo ' }), created))
  assert.ok(!approxCampaignOnly(opp('c2', 'novo', [], { campaignId: 'c9', campaignName: 'Site Novo' }), created))
  assert.ok(!inCohort(opp('c4', 'novo'), created))
  assert.equal(campaignMatches({ campaignName: 'x' }, []), false)

  const src = cohortRuleOf([step('opportunity', { cohort: 'created', clientSource: 'prospeccao' })])
  assert.ok(inCohort(opp('6', 'novo', [], { clientSource: 'prospeccao' }), src))
  assert.ok(!inCohort(opp('7', 'novo', [], { clientSource: 'site' }), src))
  assert.equal(cohortRuleOf([step('opportunity', { cohort: 'forms', formIds: [] })]), undefined)
})

test('nome de campanha repetido entre as escolhidas é ambíguo e não vincula', () => {
  const twin = [{ id: 'a', name: 'Site' }, { id: 'b', name: ' site ' }]
  assert.equal(campaignMatch({ campaignName: 'Site' }, twin), undefined)
  assert.equal(campaignMatch({ campaignName: 'Site' }, [twin[0]]), 'name')
  assert.equal(campaignMatch({ campaignId: 'b', campaignName: 'Outro' }, twin), 'id')
  assert.equal(campaignMatch({ campaignId: 'zzz', campaignName: 'Site' }, twin), undefined)
})

test('a página é achada com a caixa original e variantes equivalentes não são escolhidas', () => {
  assert.equal(normalizePath('/Proposta/?x=1#a'), '/Proposta')
  const pages = [{ path: '/Proposta', visitors: 3 }, { path: '/proposta', visitors: 9 }]
  assert.equal(matchPage(pages, '/proposta').page.visitors, 9)
  assert.equal(matchPage(pages, 'Proposta').page.visitors, 3, 'sem a barra inicial é o mesmo caminho, com a caixa digitada')
  assert.equal(matchPage(pages, '/PROPOSTA').state, 'none')
  assert.equal(matchPage(pages, '/outra').state, 'none')
  const dup = matchPage([{ path: '/p', visitors: 1 }, { path: '/p/', visitors: 2 }, { path: '/p?utm=1', visitors: 4 }], '/p')
  assert.equal(dup.state, 'ambiguous')
  assert.equal(dup.paths.length, 3)
})

test('respostas → oportunidades usa o vínculo das respostas, nunca a razão de agregados', () => {
  const form = step('form', { formIds: ['f1'] })
  const oppStep = step('opportunity', { cohort: 'forms', formIds: ['f1'] })
  // 40 respostas, 30 ligadas a oportunidades, 25 oportunidades distintas (reenvios apontam para a mesma)
  assert.deepEqual(transitionOf(form, oppStep, ok(40), ok(25, { linked: 30 })), { rate: 75, basis: 'respostas' })
  // sem o vínculo (leitura sem `linked`), não divide
  const none = transitionOf(form, oppStep, ok(40), ok(25))
  assert.equal(none.rate, undefined)
  assert.match(none.reason, /vínculo/)
  // oportunidades criadas no período não são as respostas
  assert.equal(transitionOf(form, step('opportunity', { cohort: 'created' }), ok(40), ok(30, { linked: 30 })).rate, undefined)
  assert.match(transitionOf(form, oppStep, ok(0), ok(0, { linked: 0 })).reason, /Sem base/)
})

test('conversão só entre etapas que contam as mesmas pessoas', () => {
  const form = step('form', { formIds: ['f1'] })
  const oppStep = step('opportunity', { cohort: 'forms', formIds: ['f1'] })
  const stage = (s) => step('stage', { stage: s })

  assert.deepEqual(transitionOf(oppStep, stage('conversa'), ok(30), ok(12)), { rate: 40, basis: 'marco' })
  assert.deepEqual(transitionOf(stage('conversa'), stage('proposta'), ok(12), ok(3)), { rate: 25, basis: 'marco' })

  // campanha → página, página → formulário e evento → oportunidade não viram divisão
  assert.equal(transitionOf(step('campaign'), step('page'), ok(500), ok(300)).rate, undefined)
  assert.match(transitionOf(step('campaign'), step('page'), ok(500), ok(300)).reason, /Meta/)
  assert.equal(transitionOf(step('page'), form, ok(300), ok(40)).rate, undefined)
  assert.equal(transitionOf(step('event'), oppStep, ok(80), ok(30)).rate, undefined)

  // formulários diferentes entre o envio e a oportunidade: sem conversão
  assert.equal(transitionOf(form, step('opportunity', { cohort: 'forms', formIds: ['f2'] }), ok(40), ok(30)).rate, undefined)
  // oportunidades de "todas as criadas" não são os envios do formulário
  assert.equal(transitionOf(form, step('opportunity', { cohort: 'created' }), ok(40), ok(30)).rate, undefined)

  // proteção: base zero, número maior, etapa indisponível ou sem fonte
  assert.match(transitionOf(oppStep, stage('conversa'), ok(0), ok(0)).reason, /Sem base/)
  assert.match(transitionOf(stage('conversa'), stage('proposta'), ok(10), ok(12)).reason, /maior/)
  assert.ok(transitionOf(form, oppStep, { state: 'unavailable', reason: 'x' }, ok(5)).reason)
  assert.ok(transitionOf(oppStep, step('manual'), ok(5), { state: 'unconnected' }).reason)
})

test('anúncios: soma só os dias do período e marca o relatório que não cobre tudo', () => {
  const m = (spend, linkClicks) => ({ spend, impressions: linkClicks * 10, linkClicks })
  const report = {
    since: '2026-10-10',
    until: '2026-10-20',
    days: [
      { day: '2026-10-09', metrics: m(5, 5) },
      { day: '2026-10-10', metrics: m(10, 20) },
      { day: '2026-10-11', metrics: m(10, 30) },
    ],
    campaignDays: [
      { campaignId: 'a', day: '2026-10-10', metrics: m(4, 8) },
      { campaignId: 'b', day: '2026-10-10', metrics: m(6, 12) },
      { campaignId: 'a', day: '2026-10-11', metrics: m(1, 2) },
    ],
  }
  const now = Date.parse('2026-10-20T12:00:00Z')
  const fresh = { ...report, fetchedAt: now - 3_600_000 }
  const all = sumAds(fresh, [], '2026-10-10', '2026-10-20', now)
  assert.equal(all.spend, 20)
  assert.equal(all.linkClicks, 50)
  assert.equal(all.partial, false)
  assert.equal(all.stale, false)
  const one = sumAds(fresh, ['a'], '2026-10-10', '2026-10-20', now)
  assert.equal(one.spend, 5)
  assert.equal(one.linkClicks, 10)
  // começa depois do início pedido
  assert.equal(sumAds(fresh, [], '2026-10-01', '2026-10-20', now).partial, true)
  // termina antes do fim pedido
  assert.equal(sumAds(fresh, [], '2026-10-10', '2026-10-31', now).partial, true)
  // sem datas no relatório: não dá para afirmar cobertura
  assert.equal(sumAds({ ...fresh, until: null }, [], '2026-10-10', '2026-10-20', now).partial, true)
  // leitura vencida
  assert.equal(sumAds({ ...report, fetchedAt: now - 25 * 3_600_000 }, [], '2026-10-10', '2026-10-20', now).stale, true)
  assert.equal(sumAds(report, [], '2026-10-10', '2026-10-20', now).stale, true, 'sem data de leitura conta como vencida')
})

test('vendas: soma só o valor informado e conta o que ficou sem valor', () => {
  const s = salesOf([
    opp('a', 'fechado', [], { offerPrice: 1000 }),
    opp('b', 'fechado', [], { offerPrice: 350 }),
    opp('c', 'fechado'),
    opp('d', 'perdido', [], { offerPrice: 999 }),
    opp('e', 'proposta', [], { offerPrice: 500 }),
  ])
  assert.deepEqual(s, { closed: 3, total: 1350, withValue: 2, lost: 1 })
})
