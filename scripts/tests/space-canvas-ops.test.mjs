import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SECTION_HEIGHT, createPage, insertSections, movePageSection, removePage, removeSections } from '../../src/features/space/pages/canvasOps.ts'
import { PAGE_HEADER } from '../../src/features/space/pages/pages.ts'
import { diffRemote, markRemote, rebaseSnapshot, sameEntities } from '../../src/features/space/history/remoteHistory.ts'

// Operações do canvas usadas pelo store e pela ponte dos agentes (revisão de 2026-11-13)

const section = (id, height = 100) => ({ id, type: 'section', x: 0, y: 0, width: 480, height, data: { title: id, elementorJson: '[]' } })
const text = (id) => ({ id, type: 'text', x: -300, y: 0, width: 240, height: 160, data: { content: id } })
const page = (id, sectionIds, x = 0) => ({ id, name: id, x, y: 0, sectionIds })

const base = () => ({
  nodes: [section('a'), section('b'), section('c'), text('t1'), text('t2')],
  pages: [page('home', ['a', 'b']), page('sobre', ['c'], 1000)],
  connections: [
    { id: 'k1', sourceId: 't1', targetId: 'a', type: 'apply-copy' },
    { id: 'k2', sourceId: 't2', targetId: 'b', type: 'apply-copy' },
    { id: 'k3', sourceId: 't2', targetId: 'c', type: 'apply-copy' },
  ],
})

test('insertSections: altura padrão, posição na coluna e layout', () => {
  const { canvas, ids } = insertSections(base(), 'home', [{ title: 'Nova', elementorJson: '[]' }], 1)
  assert.equal(ids.length, 1)
  assert.deepEqual(canvas.pages[0].sectionIds, ['a', ids[0], 'b'])
  const created = canvas.nodes.find((n) => n.id === ids[0])
  assert.equal(created.height, SECTION_HEIGHT)
  // A seção b desce para depois da nova
  assert.equal(canvas.nodes.find((n) => n.id === 'b').y, PAGE_HEADER + 100 + SECTION_HEIGHT)
})

test('removeSections: a página fecha o buraco e as conexões saem', () => {
  const { canvas, sections } = removeSections(base(), ['a'])
  assert.deepEqual(canvas.pages[0].sectionIds, ['b'])
  assert.equal(canvas.nodes.find((n) => n.id === 'b').y, PAGE_HEADER)
  assert.ok(!canvas.connections.some((c) => c.targetId === 'a'))
  // Sem feeders, o texto fica solto no canvas
  assert.ok(canvas.nodes.some((n) => n.id === 't1'))
  assert.deepEqual(sections.map((s) => [s.node.id, s.pageId, s.index]), [['a', 'home', 0]])
})

test('removePage: leva os textos ligados só às seções dela', () => {
  const { canvas, sections } = removePage(base(), 'home')
  assert.deepEqual(canvas.pages.map((p) => p.id), ['sobre'])
  assert.deepEqual(sections.map((s) => s.id), ['a', 'b'])
  // t1 só alimentava a; t2 também alimenta c, que fica
  assert.ok(!canvas.nodes.some((n) => n.id === 't1'))
  assert.ok(canvas.nodes.some((n) => n.id === 't2'))
  assert.deepEqual(canvas.connections.map((c) => c.id), ['k3'])
  assert.throws(() => removePage(canvas, 'sobre'), /última página/)
})

test('movePageSection: entre páginas e dentro da mesma, contando sem a própria seção', () => {
  const moved = movePageSection(base(), 'a', 'sobre', 0)
  assert.deepEqual(moved.pages.map((p) => p.sectionIds), [['b'], ['a', 'c']])
  assert.equal(moved.nodes.find((n) => n.id === 'a').x, 1000)
  const same = movePageSection(base(), 'a', 'home', 1)
  assert.deepEqual(same.pages[0].sectionIds, ['b', 'a'])
})

test('createPage: à direita, com cabeçalho e rodapé do site', () => {
  const { canvas, page: created } = createPage(base(), { name: 'Contato', frame: [{ title: 'Cabeçalho', elementorJson: '[]' }, undefined] })
  assert.equal(created.name, 'Contato')
  assert.ok(created.x > 1000)
  assert.equal(created.sectionIds.length, 1)
  assert.equal(canvas.nodes.find((n) => n.id === created.sectionIds[0]).height, SECTION_HEIGHT)
  assert.equal(createPage(base()).page.name, 'Home')
})

// Desfazer com outra pessoa editando

const entities = (c) => ({ ...c, components: [], siteSeo: undefined })

test('diffRemote: marca o que mudou e reaproveita o que não mudou', () => {
  const local = entities(base())
  const remote = structuredClone(local)
  remote.nodes.find((n) => n.id === 'b').data = { title: 'B de fora', elementorJson: '[]' }
  const { changed, shared } = diffRemote(local, remote)
  assert.deepEqual([...changed], ['node:b'])
  assert.equal(shared.nodes[0], local.nodes[0])
  assert.notEqual(shared.nodes[1], local.nodes[1])
})

test('rebaseSnapshot: o desfazer não apaga, não ressuscita nem reverte o que veio de fora', () => {
  const touches = new Map()
  // Passo local tirado na época 0: antes de a pessoa mudar o título de a
  const snapshot = entities(base())
  const afterLocal = { ...snapshot, nodes: snapshot.nodes.map((n) => (n.id === 'a' ? { ...n, data: { ...n.data, title: 'A local' } } : n)) }
  // De fora (época 1): b mudou, c saiu (com a página Sobre) e d entrou na Home
  const remote = {
    ...afterLocal,
    nodes: [...afterLocal.nodes.filter((n) => n.id !== 'c').map((n) => (n.id === 'b' ? { ...n, data: { ...n.data, title: 'B de fora' } } : n)), section('d')],
    pages: [page('home', ['a', 'b', 'd'])],
    connections: afterLocal.connections.filter((c) => c.targetId !== 'c'),
  }
  const { changed, shared } = diffRemote(afterLocal, remote)
  markRemote(touches, changed, 1)
  const rebased = rebaseSnapshot(snapshot, 0, shared, touches)
  const byId = new Map(rebased.nodes.map((n) => [n.id, n]))
  assert.equal(byId.get('a').data.title, 'a', 'o passo local volta')
  assert.equal(byId.get('b').data.title, 'B de fora', 'a mudança de fora fica')
  assert.ok(!byId.has('c'), 'o que saiu de fora não volta')
  assert.ok(byId.has('d'), 'o que entrou de fora fica')
  assert.deepEqual(rebased.pages.map((p) => p.id), ['home'])
  assert.deepEqual(rebased.pages[0].sectionIds, ['a', 'b', 'd'])
  assert.ok(rebased.connections.every((c) => byId.has(c.sourceId) && byId.has(c.targetId)))
  // Passo tirado depois da mudança de fora: aplicado como está
  assert.equal(rebaseSnapshot(snapshot, 1, shared, touches), snapshot)
})

test('rebaseSnapshot: passo que só mexia no que a outra pessoa mudou depois não faz nada', () => {
  const touches = new Map()
  const snapshot = entities(base())
  const current = { ...snapshot, nodes: snapshot.nodes.map((n) => (n.id === 'a' ? { ...n, data: { ...n.data, title: 'de fora' } } : n)) }
  markRemote(touches, ['node:a'], 1)
  assert.ok(sameEntities(rebaseSnapshot(snapshot, 0, current, touches), current))
})
