import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HOOKS, classifyHook, rankHooks, scoreHook } from '../../src/features/instagram-ia/ganchos.ts'
import { beatSheet } from '../../src/features/instagram-ia/tempos.ts'
import { lintCaption, HASHTAG_LIMIT } from '../../src/features/instagram-ia/legenda.ts'
import { detect, humanize, humanizeReport } from '../../src/features/instagram-ia/humanizar.ts'
import { normalizeSwipe, rankSwipe, swipeMarkdown } from '../../src/features/instagram-ia/virais.ts'
import { auditPosts } from '../../src/features/instagram-ia/auditoria.ts'
import { PROFILE_RUBRIC } from '../../src/features/instagram-ia/perfil.ts'
import { INSTAGRAM_SKILLS } from '../../src/features/space/chat/instagramSkills.ts'
import { CHAT_SKILLS } from '../../src/features/space/chat/skills.ts'

// Inteligência de Instagram (instagram-agent-skill em português): ganchos, tempos, legenda,
// humanizador, virais, o que funcionou e as skills do chat.

test('as 26 fórmulas existem e cada exemplo é reconhecido como a própria fórmula', () => {
  assert.equal(HOOKS.length, 26)
  assert.deepEqual(HOOKS.map((h) => h.id), Array.from({ length: 26 }, (_, i) => i + 1))
  for (const h of HOOKS) assert.equal(classifyHook(h.exemplo)?.id, h.id, `${h.id} ${h.nome}: "${h.exemplo}"`)
})

test('gancho concreto ganha de saudação e preâmbulo', () => {
  const [best, ...rest] = rankHooks([
    'Oi gente, hoje eu queria falar um pouco sobre estratégia de conteúdo',
    'Ninguém te conta que seus primeiros 30 reels vão flopar.',
    'Neste vídeo vou te mostrar como crescer no Instagram',
  ])
  assert.match(best.gancho, /Ninguém te conta/)
  assert.equal(best.veredito, 'FORTE')
  assert.equal(best.formula?.nome, 'Ninguém te conta')
  for (const r of rest) assert.equal(r.veredito, 'FRACO')
  const hi = scoreHook('Oi gente, hoje eu queria falar um pouco sobre estratégia de conteúdo')
  assert.ok(hi.problemas.some((p) => /Saudação/.test(p)))
  assert.ok(scoreHook('Pare de rolar se você quer crescer 🔥').problemas.length >= 2)
})

test('dinheiro em real e número falado contam como concreto', () => {
  assert.ok(scoreHook('Perdi R$ 18.000 por causa de uma cláusula.').checks.CONCRETO.nota >= 75)
  assert.ok(scoreHook('Perdi vinte mil reais por causa de uma cláusula.').checks.CONCRETO.nota >= 75)
  assert.equal(scoreHook('A gente acredita em fazer as coisas direito.').checks.CONCRETO.nota, 15)
})

test('roteiro: gancho longo, batida longa, loop e alvo', () => {
  const s = beatSheet(
    [
      'Perdi R$ 18 mil por causa de uma cláusula.',
      'Essa é a cláusula exata que agora eu coloco em todo contrato que eu assino com cliente novo, sem exceção nenhuma, mesmo quando o cliente é amigo e mesmo quando o projeto é pequeno.',
      'Seção 4. Pagamento na entrega, não na aprovação.',
      'Essa troca de uma palavra vale R$ 18 mil pra mim.',
    ].join('\n'),
    { alvo: 30 }
  )
  assert.equal(s.batidas[0].marca, 'GANCHO')
  assert.equal(s.batidas.at(-1).marca, 'CHAMADA')
  assert.ok(s.batidas[1].alertas.length, 'batida 2 passa de 4 s')
  assert.ok(s.loop, 'o fim repete "R$ 18 mil" do gancho')
  assert.ok(s.notas.some((n) => /abaixo do alvo/.test(n)))
  const sem = beatSheet('Você está postando errado.\nO motivo é simples.\nTente outra coisa.')
  assert.equal(sem.loop, false)
  assert.equal(beatSheet('   \n '), null)
})

test('legenda: janela do feed, limite de 5 hashtags, uma chamada, termos de busca', () => {
  const good = lintCaption('Perdi R$ 18 mil por causa de uma cláusula que faltou no contrato.\n\nHoje coloco essa cláusula em todo contrato de fotógrafo.\n\nComenta CONTRATO que eu te mando o modelo.\n\n#contratos #fotografia', { palavras: ['contrato de fotógrafo'] })
  assert.equal(good.veredito, 'PRONTA', JSON.stringify(good.checks))
  assert.deepEqual(good.chamadas, ['comentar uma palavra'])
  const tags = Array.from({ length: HASHTAG_LIMIT + 2 }, (_, i) => `#tag${i}`).join(' ')
  const bad = lintCaption(`#promo Oi! Confira nosso site www.loja.com.br\nSalva esse post e me segue!\n${tags} #viral`)
  assert.equal(bad.veredito, 'CORRIGIR')
  const byId = Object.fromEntries(bad.checks.map((c) => [c.id, c.status]))
  assert.equal(byId.hashtags, 'CORRIGIR')
  assert.equal(byId.primeira, 'CORRIGIR')
  assert.equal(byId.links, 'ATENCAO')
  assert.equal(byId.chamada, 'ATENCAO')
  assert.ok(lintCaption('x'.repeat(300)).cortada)
})

test('humanizador: invisíveis, travessão, clichês e estruturas', () => {
  const raw = 'No mundo acelerado de hoje, é crucial alavancar sua marca — e não é apenas sobre postar, é sobre conectar.\u200B\n\nO resultado?\n\nAlém disso, vale ressaltar que o algoritmo ama constância.\nMarque alguém que precisa ver isso! Veja https://loja.com.br/no-mundo-acelerado-de-hoje'
  const h = humanize(raw)
  assert.ok(!/[\u200B—]/.test(h.texto))
  assert.ok(!/mundo acelerado de hoje,|alavancar|vale ressaltar|Marque alguém/i.test(h.texto.split('https://')[0]))
  assert.ok(h.texto.includes('https://loja.com.br/no-mundo-acelerado-de-hoje'), 'link fica intacto')
  assert.ok(/E o Instagram entrega constância\./.test(h.texto), h.texto)
  assert.ok(h.estruturas.some((e) => e.id === 'nao-e-so'))
  assert.ok(h.estruturas.some((e) => e.id === 'o-resultado'))
  // Palavras comuns que não são clichê ficam
  assert.equal(humanize('Mergulho no Rio Grande do Norte, jornada de trabalho de 6 horas.').texto, 'Mergulho no Rio Grande do Norte, jornada de trabalho de 6 horas.')
  const r = humanizeReport(raw)
  assert.ok(r.depois.nota > r.antes.nota)
})

test('detector: texto com cara de máquina fica abaixo do texto falado', () => {
  const machine = 'Em um mundo cada vez mais conectado, é fundamental potencializar resultados. Além disso, é crucial otimizar processos de forma estratégica. Dessa forma, a jornada se torna transformadora e robusta. Vale ressaltar que a inovação é essencial para o sucesso. Em suma, o futuro é agora.'
  const human = 'A gente perdeu R$ 18 mil em março porque o contrato não dizia quando pagar. Doeu. Desde então coloco uma linha na seção 4: pagamento na entrega, não na aprovação. Foram 37 contratos assim e nenhum atraso. Se você é fotógrafo, copia essa linha hoje, tá?'
  assert.ok(detect(human).nota > detect(machine).nota + 15, `${detect(human).nota} vs ${detect(machine).nota}`)
  assert.equal(detect(machine).veredito === 'PASSA', false)
})

test('virais: ordena pelo múltiplo sobre a mediana, não por views', () => {
  const rows = normalizeSwipe([
    { perfil: '@grande', seguidores: '2 mi', mediana: '400 mil', views: '420 mil', gancho: 'Neste vídeo vou mostrar minha rotina' },
    { perfil: '@pequeno', seguidores: 4000, mediana: '3.000', views: '180 mil', gancho: 'Copia essa mensagem de follow-up. Levei dois anos para acertar.' },
    { perfil: '@medio', mediana: 10000, views: 41000, gancho: 'Ninguém te conta que os primeiros 30 vão flopar' },
    { views: 0, gancho: 'sem views' },
  ])
  assert.equal(rows.length, 3)
  const s = rankSwipe(rows)
  assert.equal(s.reels[0].perfil, '@pequeno')
  assert.equal(s.reels[0].multiplo, 60)
  assert.equal(s.reels[0].formula?.nome, 'Pode copiar')
  assert.equal(s.reels.at(-1).perfil, '@grande')
  assert.equal(s.fora_da_curva.length, 2)
  assert.match(s.confianca, /pista, não prova/)
  assert.match(swipeMarkdown(s), /\*\*60x\*\* · #9 Pode copiar/)
  assert.match(swipeMarkdown(s), /gancho 75,2/)
})

const DAY = 86_400_000
const NOW = Date.parse('2026-11-09T15:00:00Z')
const post = (i, over = {}) => ({ id: `p${i}`, type: 'VIDEO', product: 'REELS', caption: 'Um post qualquer', postedAt: NOW - i * DAY, insights: { reach: 1000, views: 1000, shares: 2, saved: 3 }, ...over })

test('o que funcionou: múltiplo, envios por alcance, formato e stories fora', () => {
  const posts = [
    ...Array.from({ length: 8 }, (_, i) => post(i + 1)),
    post(20, { caption: 'Perdi R$ 18 mil numa cláusula', insights: { reach: 9000, views: 12000, shares: 140, saved: 90, ig_reels_avg_watch_time: 9400 } }),
    post(21, { type: 'IMAGE', product: 'FEED', caption: 'Foto do dia', insights: { reach: 200, shares: 0, saved: 0 } }),
    post(22, { type: 'IMAGE', product: 'STORY', insights: { reach: 50000 } }),
    post(400, { insights: { reach: 99999, views: 99999 } }),
  ]
  const a = auditPosts(posts, { dias: 90, agora: NOW })
  assert.equal(a.n, 10, 'story e post antigo ficam de fora')
  assert.equal(a.topo[0].id, 'p20')
  assert.equal(a.topo[0].multiplo, 12)
  assert.equal(a.topo[0].envios_mil, 15.6)
  assert.equal(a.topo[0].assistido_s, 9.4)
  assert.equal(a.baixo[0].id, 'p21')
  assert.ok(a.por_formato.some((f) => f.formato === 'Reels'))
  assert.ok(a.achados.length)
  assert.match(a.aviso, /primeira linha da legenda/)
  assert.equal(auditPosts([], {}), null)
})

test('rubrica do perfil soma 100', () => {
  assert.equal(PROFILE_RUBRIC.reduce((s, i) => s + i.pontos, 0), 100)
  assert.equal(PROFILE_RUBRIC.length, 12)
})

test('as 14 skills de Instagram estão no chat e só falam de ações que existem', async () => {
  assert.equal(INSTAGRAM_SKILLS.length, 14)
  for (const s of INSTAGRAM_SKILLS) {
    const inChat = CHAT_SKILLS.find((c) => c.id === s.id)
    assert.ok(inChat, s.id)
    assert.equal(inChat.source, 'builtin')
    assert.ok(s.instructions.length < 30000)
    assert.ok(s.starters.length >= 2)
    assert.match(s.instructions, /Nunca invente número/)
  }
  // Toda ação `ig_*` citada nas skills existe no arquivo das ações da Iara
  const { readFile } = await import('node:fs/promises')
  const actions = await readFile(new URL('../../src/features/iara/instagramActions.ts', import.meta.url), 'utf8')
  const named = new Set(INSTAGRAM_SKILLS.flatMap((s) => s.instructions.match(/\big_[a-z_]+/g) ?? []))
  for (const n of named) assert.ok(actions.includes(`name: '${n}'`), `ação citada e inexistente: ${n}`)
})
