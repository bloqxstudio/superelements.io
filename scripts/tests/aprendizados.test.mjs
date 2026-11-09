import { test } from 'node:test'
import assert from 'node:assert/strict'
import { engagement, learningsForContext, learningsNote, learningsPath } from '../../src/features/cerebro/learnings.ts'
import { contextText } from '../../src/features/cerebro/contextText.ts'

const post = (o) => ({ caption: 'Post', postedAt: '2026-11-01', kind: 'IMAGE', likes: 0, comments: 0, saved: 0, shares: 0, reach: 0, ...o })

test('salvar e compartilhar pesam mais que curtir', () => {
  assert.ok(engagement(post({ saved: 10 })) > engagement(post({ likes: 20 })))
})

test('nota do mês: top posts, formato que mais engaja, ajustes e aprovação', () => {
  const md = learningsNote({
    month: '2026-11',
    posts: [post({ caption: 'Reels da obra\nlinha 2', kind: 'REELS', likes: 50, saved: 20 }), post({ caption: 'Post simples', likes: 5 }), post({ caption: 'Sem nada' })],
    clientComments: [{ title: 'Carrossel de outubro', body: 'Trocar a foto da capa', at: '2026-11-03' }],
    approved: 3,
    adjusted: 1,
  })
  assert.equal(learningsPath('2026-11'), 'aprendizados/2026-11.md')
  assert.match(md, /^# Aprendizados de 2026-11/)
  assert.match(md, /1\. Reels de 2026-11-01: "Reels da obra"/)
  assert.doesNotMatch(md, /Sem nada/)
  assert.match(md, /Formato com mais engajamento por post: Reels/)
  assert.match(md, /Carrossel de outubro: Trocar a foto da capa/)
  assert.match(md, /3 de 4 peças aprovadas pelo cliente de primeira \(75%\)/)
})

test('sem dados, a nota diz que não há (nada inventado)', () => {
  const md = learningsNote({ month: '2026-11', posts: [], clientComments: [], approved: 0, adjusted: 0 })
  assert.match(md, /Sem posts com números/)
  assert.match(md, /Nenhum pedido de ajuste/)
  assert.match(md, /Nenhuma peça decidida/)
})

test('os aprendizados entram no contexto de criação', () => {
  const md = learningsNote({ month: '2026-11', posts: [post({ likes: 9 })], clientComments: [], approved: 1, adjusted: 0 })
  const t = contextText({ name: 'X', learnings: learningsForContext(md) })
  assert.match(t, /O que a operação já ensinou/)
  assert.doesNotMatch(t, /Montado sozinho/)
})
