import test from 'node:test'
import assert from 'node:assert/strict'
import { brandGuardOf, buildFree } from '../../supabase/functions/sinfy-mcp/livre.ts'

const brand = { colors: [{ hex: '#2B3CF0' }, { hex: '#F5F1EA' }, { hex: '#111827' }], headingFont: 'Inter Tight', bodyFont: 'Inter', emphasisFont: 'Instrument Serif' }

test('slide livre: cor fora da paleta vai para a mais próxima da marca, fonte fora vira a da marca', () => {
  const notes = []
  const slide = buildFree({ fundo: '#fafafa', camadas: [
    { tipo: 'texto', texto: 'Manchete *forte*', x: 80, y: 100, w: 900, tamanho: 96, fonte: 'Comic Neue', cor: '#ff00aa', destaque_cor: '#00ff00' },
    { tipo: 'texto', texto: 'apoio', x: 80, y: 400, w: 900, tamanho: 32, peso: 400, fonte: 'Arial' },
    { tipo: 'texto', texto: 'certo', x: 80, y: 500, w: 900, tamanho: 32, fonte: 'Instrument Serif', cor: '#2b3cf0' },
    { tipo: 'forma', x: 0, y: 0, w: 100, h: 100, cor: '#3344ee' },
  ] }, '4x5', brandGuardOf(brand), notes)
  const [title, sub, ok, shape] = slide.layers
  const palette = ['#2b3cf0', '#f5f1ea', '#111827', '#ffffff', '#000000']
  assert.ok(palette.includes(slide.background))
  assert.equal(slide.background, '#ffffff')
  assert.equal(title.font, 'Inter Tight')
  assert.equal(sub.font, 'Inter')
  assert.ok(palette.includes(title.color) && palette.includes(title.emphasisColor))
  assert.equal(ok.font, 'Instrument Serif')
  assert.equal(ok.color, '#2b3cf0')
  assert.equal(shape.fill, '#2b3cf0')
  assert.ok(notes.some((n) => n.startsWith('fonte Comic Neue')) && notes.some((n) => n.startsWith('cor #ff00aa')))
})

test('sem paleta na conta, o slide livre fica como a IA pediu', () => {
  const slide = buildFree({ fundo: '#fafafa', camadas: [{ tipo: 'texto', texto: 'x', x: 0, y: 0, w: 100, fonte: 'Arial', cor: '#ff00aa' }] }, '4x5', brandGuardOf({ colors: [], headingFont: 'Inter' }))
  assert.equal(slide.background, '#fafafa')
  assert.equal(slide.layers[0].font, 'Arial')
  assert.equal(slide.layers[0].color, '#ff00aa')
})

test('slide livre no grid: texto dentro da margem, encaixe nas colunas, fundo que sangra livre', async () => {
  const { gridLines } = await import('../../supabase/functions/sinfy-mcp/livre.ts')
  const G = gridLines('4x5')
  assert.equal(G.m, 84)
  const notes = []
  const slide = buildFree({ fundo: '#ffffff', camadas: [
    { tipo: 'texto', texto: 'colado na borda', x: 20, y: 30, w: 1060, tamanho: 60 },
    { tipo: 'forma', x: 0, y: 0, w: 1080, h: 1350, cor: '#000000' },
    { tipo: 'forma', x: 95, y: 600, w: 440, h: 300, cor: '#000000' },
    { tipo: 'texto', texto: 'no fim', x: 84, y: 1330, w: 600, tamanho: 40 },
  ] }, '4x5', undefined, notes)
  const [t1, bg, card, t2] = slide.layers
  assert.ok(t1.x >= 84 && t1.x + t1.w <= 1080 - 84 && t1.y >= 84)
  assert.deepEqual([bg.x, bg.y, bg.w, bg.h], [0, 0, 1080, 1350])
  assert.equal(card.x, 84)
  assert.ok(G.v.includes(card.x + card.w), `borda direita ${card.x + card.w} numa linha do grid`)
  assert.ok(t2.y + t2.h <= 1350 - 84)
  assert.ok(notes.some((n) => /grid/.test(n)))
})

test('story: texto fora das faixas que o Instagram cobre', () => {
  const slide = buildFree({ fundo: '#ffffff', camadas: [{ tipo: 'texto', texto: 'topo', x: 84, y: 40, w: 900, tamanho: 60 }, { tipo: 'texto', texto: 'base', x: 84, y: 1800, w: 900, tamanho: 60 }] }, '9x16')
  const [a, b] = slide.layers
  assert.ok(a.y >= 250)
  assert.ok(b.y + b.h <= 1920 - 300)
})

test('story: as faixas do MCP, das guias e dos modelos são as mesmas (250 em cima, 300 embaixo)', async () => {
  const { STORY_SAFE, gridLines } = await import('../../supabase/functions/sinfy-mcp/livre.ts')
  const app = await import('../../src/features/criativos/safeZone.ts')
  assert.deepEqual({ ...STORY_SAFE }, { ...app.STORY_SAFE })
  assert.deepEqual({ ...app.STORY_SAFE }, { top: 250, bottom: 300 })
  assert.deepEqual(app.storySafe(1920), { top: 250, bottom: 300 })
  const G = gridLines('9x16')
  assert.equal(G.top, 250)
  assert.equal(G.bottom, 1920 - 300)
})
