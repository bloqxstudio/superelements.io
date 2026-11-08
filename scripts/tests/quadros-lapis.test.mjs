import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pencil, funnel, readSketch } from '../../src/features/quadros/sketch.ts'

test('pencil: passa perto dos pontos com tremor pequeno e fecha passando do começo', () => {
  const p = pencil([[0, 0], [300, 0], [300, 100]], true, 3)
  assert.ok(p.length > 60)
  assert.ok(p.every(([x, y]) => x >= -3 && x <= 303 && y >= -3 && y <= 103))
  const top = p.filter(([x]) => x > 10 && x < 290).slice(0, 20)
  assert.ok(top.some(([, y]) => Math.abs(y) > 0.2), 'tem tremor de mão')
  assert.ok(top.every(([, y]) => Math.abs(y) < 2.5), 'tremor pequeno')
})

test('funnel: uma faixa por etapa, cada vez mais estreita, com fundo, contorno e nome', () => {
  const etapas = ['Campanha 24/7', 'Página de venda', 'Marca, modelo e ano', 'Contato', 'WhatsApp', 'Atendimento e venda', 'Entrega']
  const items = funnel({ etapas, titulo: 'Funil' })
  const strokes = items.filter((i) => i.tipo === 'traco')
  assert.equal(strokes.length, 7)
  const widths = strokes.map((s) => s.pontos[1][0] - s.pontos[0][0])
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i] < widths[i - 1])
  assert.equal(items.filter((i) => i.tipo === 'linha').length, 7)
  const texts = items.filter((i) => i.tipo === 'texto').map((t) => t.texto)
  assert.deepEqual(texts, ['Funil', ...etapas.map((e, i) => `${i + 1}. ${e}`)])
})

test('readSketch: aceita o atalho funil com deslocamento e ignora itens inválidos', () => {
  const items = readSketch([
    { tipo: 'funil', etapas: ['A', 'B'], x: 100, y: 50 },
    { tipo: 'traco', pontos: [[0, 0]] },
    { tipo: 'forma', forma: 'elipse', x: 0, y: 0, largura: 100, altura: 50, cor: 'vermelho' },
    { tipo: 'texto', x: 1, y: 2, texto: '   ' },
    { tipo: 'nada' },
  ])
  const first = items.find((i) => i.tipo === 'traco')
  assert.ok(first.pontos.every(([x, y]) => x >= 100 && y >= 50))
  const forma = items.find((i) => i.tipo === 'forma')
  assert.equal(forma.cor, undefined)
  assert.equal(items.filter((i) => i.tipo === 'texto').length, 2)
})

import { placeDoodle, placeScene, comparison, list, wrap } from '../../src/features/quadros/sketch.ts'
import { DOODLE_NAMES, doodle, SCENES } from '../../src/features/quadros/doodles.ts'

test('biblioteca: todo desenho tem traços dentro da própria caixa', () => {
  for (const n of DOODLE_NAMES) {
    const d = doodle(n)
    assert.ok(d.strokes.length > 0, n)
    for (const st of d.strokes) for (const [x, y] of st.pontos) assert.ok(x >= -4 && x <= d.w + 4 && y >= -4 && y <= d.h + 4, `${n}: ${x},${y}`)
  }
})

test('desenho posto: um grupo só, na escala e espelhado', () => {
  const a = placeDoodle('pessoa_sentada', 100, 50, { escala: 2 })
  assert.ok(a.length > 3 && new Set(a.map((i) => i.grupo)).size === 1)
  const b = placeDoodle('pessoa_sentada', 0, 0, { espelhar: true })
  const xs = (items) => items.flatMap((i) => i.pontos.map((p) => p[0]))
  assert.ok(Math.max(...xs(b)) <= doodle('pessoa_sentada').w + 2)
  assert.deepEqual(placeDoodle('nao-existe', 0, 0), [])
  // a cena junta vários desenhos, cada um no seu grupo
  assert.ok(new Set(placeScene('reuniao', 0, 0).map((i) => i.grupo)).size >= 5)
  assert.ok(Object.keys(SCENES).includes('live'))
})

test('lista e quebra de linha', () => {
  assert.deepEqual(wrap('Alta conversão, esforço alavancado.', 23), ['Alta conversão, esforço', 'alavancado.'])
  const l = list(['curto', 'um item bem mais comprido que precisa quebrar a linha'], 0, 0, { largura: 260, tamanho: 22 })
  assert.equal(l.items.length, 2)
  assert.match(l.items[1].texto, /\n/)
})

test('comparação: fundo, divisória, marcas, títulos e as listas na mesma altura', () => {
  const c = comparison(
    { marca: 'x', titulo: 'Sessão Estratégica', cena: 'reuniao', itens: ['CPL R$ 50 - R$ 70', '1 pessoa por hora'] },
    { marca: 'certo', titulo: 'Live Semanal', cena: 'live', itens: ['CPL R$ 2 - R$ 6', '30+ pessoas por hora'] },
  )
  assert.equal(c[0].tipo, 'forma')
  assert.equal(c[0].solido, true)
  const texts = c.filter((i) => i.tipo === 'texto')
  assert.ok(texts.some((t) => t.texto === 'Sessão Estratégica') && texts.some((t) => t.texto === 'Live Semanal'))
  const first = (s) => texts.find((t) => t.texto.includes(s)).y
  assert.equal(first('CPL R$ 50'), first('CPL R$ 2'))
  // tudo dentro do painel
  const W = c[0].largura, H = c[0].altura
  for (const it of c.filter((i) => i.tipo === 'traco')) for (const [x, y] of it.pontos) assert.ok(x >= 0 && x <= W && y >= 0 && y <= H)
})
