import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planDraft, readDraft, stickyColor, estimate, arrowEnds, arrowRoute } from '../../src/features/quadros/layout.ts'
import { organize } from '../../src/features/quadros/organize.ts'
import { boardOutline } from '../../src/features/quadros/outline.ts'
import { TEMPLATES } from '../../src/features/quadros/templates.ts'

const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
const mains = (s, ids) => s.filter((e) => ids.includes(e.id))
const LONG = 'Instalação · 27/08/2026 — 393 visualizações e 260 contas alcançadas; o melhor post do mês, com o encaixe da película visto de perto e a pergunta no fim.'

test('stickyColor aceita nome, feminino, hex e cai no amarelo', () => {
  assert.equal(stickyColor('Azul'), '#c5e4ff')
  assert.equal(stickyColor('amarela'), '#fff1a8')
  assert.equal(stickyColor('#123abc'), '#123abc')
  assert.equal(stickyColor('turquesa'), '#fff1a8')
})

test('estimate: texto longo ocupa mais linhas', () => {
  assert.ok(estimate(LONG, 200, 18) > estimate('curto', 200, 18) * 3)
})

test('colunas: itens com texto longo nunca se sobrepõem e o frame cobre todos', () => {
  const d = readDraft({ colunas: [{ nome: 'Ideias', notas: Array(6).fill(LONG) }, { nome: 'Feito', cartoes: [{ titulo: 'Post', texto: LONG, icone: 'camera', tag: 'Reels' }] }] })
  const p = planDraft(d, 0, 0)
  const boxes = mains(p.skeleton, p.mainIds)
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]), `${i} x ${j}`)
  const frames = p.skeleton.filter((e) => e.type === 'frame')
  assert.equal(frames.length, 2)
  for (const b of boxes) {
    const f = frames.find((fr) => fr.children.includes(b.id))
    assert.ok(f && b.y + b.height <= f.y + f.height && b.x + b.width <= f.x + f.width)
  }
  assert.ok(!overlap(frames[0], frames[1]))
  assert.deepEqual(p.icons.map((i) => i.name), ['camera'])
})

test('fluxo e ligações viram setas presas aos itens', () => {
  const p = planDraft(readDraft({ fluxo: true, cartoes: [{ titulo: 'A' }, { titulo: 'B' }, { titulo: 'C', id: 'c' }], ligacoes: [{ de: 'c', para: 1, texto: 'volta' }] }), 0, 0)
  const arrows = p.skeleton.filter((e) => e.type === 'arrow')
  assert.equal(arrows.length, 3)
  assert.equal(arrows[2].start.id, p.mainIds[2])
  assert.equal(arrows[2].end.id, p.mainIds[0])
  assert.equal(arrows[2].label.text, 'volta')
})

test('mapa: centro ligado a cada item', () => {
  const p = planDraft(readDraft({ centro: 'Tema', notas: ['a', 'b', 'c'] }), 0, 0)
  assert.equal(p.skeleton.filter((e) => e.type === 'arrow').length, 3)
})

test('modelos desenham sem sobreposição', () => {
  for (const t of TEMPLATES) {
    const p = planDraft(t.draft(), 0, 0)
    const boxes = mains(p.skeleton, p.mainIds)
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]), `${t.id}: ${i} x ${j}`)
  }
})

test('organize: desembola notas esticadas dentro de um frame e cresce o frame', () => {
  const els = [{ id: 'f', type: 'frame', x: 0, y: 0, width: 420, height: 640 }]
  for (let i = 0; i < 4; i++) {
    els.push({ id: `n${i}`, type: 'rectangle', x: 20 + (i % 2) * 200, y: 30 + Math.floor(i / 2) * 200, width: 180, height: 400, frameId: 'f', customData: { sticky: true }, boundElements: [{ id: `t${i}`, type: 'text' }] })
    els.push({ id: `t${i}`, type: 'text', x: 25 + (i % 2) * 200, y: 35 + Math.floor(i / 2) * 200, width: 170, height: 390, containerId: `n${i}`, frameId: 'f', verticalAlign: 'top' })
  }
  els.push({ id: 'g', type: 'frame', x: 440, y: 0, width: 420, height: 300 })
  const patch = organize(els)
  const at = (id) => ({ ...els.find((e) => e.id === id), ...patch.get(id) })
  const notes = [0, 1, 2, 3].map((i) => at(`n${i}`))
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.ok(!overlap(notes[i], notes[j]))
  const f = at('f')
  for (const n of notes) assert.ok(n.y + n.height <= f.y + f.height)
  assert.ok(!overlap(f, at('g')))
  // o texto anda junto com a nota
  for (let i = 0; i < 4; i++) assert.equal(at(`t${i}`).y - at(`n${i}`).y, 5)
})

test('boardOutline: ids, nota com cor e coluna, cartão e setas', () => {
  const els = [
    { id: 'f', type: 'frame', name: 'Ideias' },
    { id: 'r', type: 'rectangle', backgroundColor: '#c5e4ff', customData: { sticky: true }, frameId: 'f' },
    { id: 't', type: 'text', text: 'Post de bastidores', containerId: 'r' },
    { id: 'c', type: 'rectangle', customData: { card: true }, groupIds: ['g'] },
    { id: 'b', type: 'rectangle', customData: { cardPart: 'barra' }, backgroundColor: '#2b8a3e', groupIds: ['g'] },
    { id: 'ct', type: 'rectangle', customData: { cardPart: 'titulo' }, groupIds: ['g'] },
    { id: 'ctt', type: 'text', text: 'Reels de instalação', containerId: 'ct', groupIds: ['g'] },
    { id: 'a', type: 'arrow', startBinding: { elementId: 'r' }, endBinding: { elementId: 'c' } },
    { id: 'd', type: 'text', text: 'apagado', isDeleted: true },
  ]
  const out = boardOutline(els)
  assert.deepEqual(out.lines, [
    '[coluna/frame] Ideias',
    '- #r (nota azul em "Ideias") Post de bastidores',
    '- #c (cartão verde) Reels de instalação',
    '→ #a seta de "Post de bastidores" para "Reels de instalação"',
  ])
  assert.deepEqual(boardOutline(els, new Set(['r'])).lines, ['- #r (nota azul em "Ideias") Post de bastidores'])
})

test('arrowEnds: cartões lado a lado com alturas diferentes dão seta reta', () => {
  const { p, q } = arrowEnds({ x: 0, y: 0, width: 280, height: 260 }, { x: 400, y: 30, width: 280, height: 180 })
  assert.equal(p.y, q.y)
  assert.equal(p.x, 288)
  assert.equal(q.x, 392)
  const v = arrowEnds({ x: 0, y: 0, width: 200, height: 100 }, { x: 20, y: 300, width: 200, height: 100 })
  assert.equal(v.p.x, v.q.x)
})

test('organize: fluxo em linha alinhado pelo meio, setas retas, rótulo com espaço, lixo de ligações apagado', () => {
  const card = (id, x, y, h) => ({ id, type: 'rectangle', x, y, width: 280, height: h, customData: { card: true }, groupIds: ['g' + id] })
  const els = [
    card('a', 0, 153, 262), card('b', 400, 130, 180), card('c', 800, 140, 238),
    { id: 'ab', type: 'arrow', x: 288, y: 284, width: 104, height: 20, startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' }, strokeColor: '#d9a400' },
    { id: 'bc', type: 'arrow', x: 688, y: 220, width: 104, height: 0, startBinding: { elementId: 'b' }, endBinding: { elementId: 'c' } },
    { id: 'bcl', type: 'text', x: 700, y: 210, width: 150, height: 40, containerId: 'bc' },
    { id: 'velha', type: 'arrow', x: 0, y: 0, width: 10, height: 0, startBinding: { elementId: 'a' }, endBinding: { elementId: 'sumiu' } },
    { id: 'orfao', type: 'text', x: 0, y: 0, width: 50, height: 20, containerId: 'apagada' },
    { id: 'apagada', type: 'arrow', x: 0, y: 0, width: 10, height: 0, isDeleted: true },
    { id: 'titulo', type: 'text', x: 0, y: 40, width: 300, height: 20, containerId: 'caixa-que-sumiu', text: 'Venda direta' },
  ]
  const patch = organize(els)
  const at = (id) => ({ ...els.find((e) => e.id === id), ...patch.get(id) })
  const mid = (e) => e.y + e.height / 2
  assert.equal(mid(at('a')), mid(at('b')))
  assert.equal(mid(at('b')), mid(at('c')))
  assert.equal(at('ab').points[1][1], 0)
  assert.equal(at('bc').points[1][1], 0)
  assert.equal(at('b').x - (at('a').x + 280), 90)
  assert.ok(at('c').x - (at('b').x + 280) >= 150 + 56)
  assert.equal(patch.get('velha').isDeleted, true)
  assert.equal(patch.get('orfao').isDeleted, true)
  // texto preso a algo que não existe (e não era seta) é um título visível: fica, solto
  assert.equal(patch.get('titulo').isDeleted, undefined)
  assert.equal(patch.get('titulo').containerId, null)
})

test('arrowRoute: volta de linha do fluxo faz um L (desce, atravessa, desce)', () => {
  const r = arrowRoute({ x: 1480, y: 0, width: 280, height: 100 }, { x: 0, y: 190, width: 280, height: 100 })
  assert.equal(r.points.length, 4)
  assert.equal(r.points[1][0], 0)
  assert.equal(r.points[1][1], r.points[2][1])
  assert.equal(r.points[3][0], r.points[2][0])
  // fluxo de até 7 cartões fica numa linha só
  const p = planDraft(readDraft({ fluxo: true, cartoes: Array.from({ length: 7 }, (_, i) => ({ titulo: 'E' + i })) }), 0, 0)
  const ys = new Set(p.skeleton.filter((e) => p.mainIds.includes(e.id)).map((e) => e.y))
  assert.equal(ys.size, 1)
})
