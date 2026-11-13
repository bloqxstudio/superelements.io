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
