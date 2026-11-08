import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { compositionPreset, fitBox } from '../../src/features/criativos/explicativo/composition.ts'
import { EXPLAINER_SCENE } from '../../src/features/criativos/explicativo/engine.ts'

test('caixas permanecem no quadro ao arrastar e redimensionar', () => {
  for (const x of [-30, 0, 60, 130]) for (const y of [-40, 50, 150]) {
    const b = fitBox({ x, y, w: 75, h: 55, visible: true })
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 100 && b.y + b.h <= 100)
  }
  const b = fitBox({ x: 80, y: 90, w: -2, h: 500, visible: true })
  assert.equal(b.w, 8); assert.equal(b.h, 100); assert.equal(b.y, 0)
})

function render(width, height, composition, beats = []) {
  const events = []
  const ctx = new Proxy({}, { get: (_, name) => (...args) => events.push([name, ...args]) })
  let renderer
  const env = { width, height, duration: 30, video: { width: 1080, height: 1920 }, data: {
    composition, theme: 'escuro', videoPositionY: 0, beats,
    brand: { ink: '#2E3092', paper: '#FAFAF8', accent: '#D2AC67', accentOnDark: '#D2AC67' },
  } }
  const code = EXPLAINER_SCENE.replace('const BRAND0 =', `
    animation = (ctx,t,box) => { events.push(['animation', box]); return surface('ink') };
    captions = (ctx,t,y,S,u,W) => events.push(['captions',y,u,W]);
    signature = () => {};
    const BRAND0 =`)
  vm.runInNewContext(code, { env, events, lib: {}, scene: r => { renderer = r } })
  renderer.draw(ctx, 0, env)
  return events
}

test('motor usa coordenadas proporcionais, vídeo pelo topo e legenda na caixa', () => {
  for (const [w,h] of [[1080,1920],[1080,1080],[1920,1080]]) {
    const c = compositionPreset('dividido')
    const events = render(w,h,c)
    const a = events.find(e => e[0] === 'animation')[1]
    assert.ok(Math.abs(a.h - h * 0.56) < 0.001)
    const v = events.find(e => e[0] === 'drawImage')
    const translation = events.find(e => e[0] === 'translate')
    // Topo da imagem original exatamente na borda superior da caixa de vídeo.
    assert.ok(Math.abs(translation[2] + v[3] - h * 0.56) < 0.001)
    const cap = events.find(e => e[0] === 'captions')
    assert.ok(Math.abs(cap[1] - h * 0.12 / 2) < 0.001)
    assert.ok(Math.abs(cap[3] - w * 0.9) < 0.001)
  }
})

test('sobreposição e visibilidade respeitadas na renderização', () => {
  const c = compositionPreset('janela')
  let events = render(1080,1920,c)
  assert.ok(events.findIndex(e => e[0] === 'animation') < events.findIndex(e => e[0] === 'drawImage'))
  c.video.visible = false; c.captions.visible = false
  events = render(1080,1920,c)
  assert.ok(!events.some(e => ['drawImage','captions'].includes(e[0])))
  assert.equal(compositionPreset('dividido', false).video.visible, false)
})

test('CTA em tela cheia substitui composição, vídeo e legenda', () => {
  const events = render(1080, 1920, compositionPreset('dividido'), [{ start: 0, end: 4, pattern: 'cta', fullScreen: true }])
  const box = events.find(e => e[0] === 'animation')[1]
  assert.equal(box.w, 1080); assert.equal(box.h, 1920)
  assert.ok(!events.some(e => ['drawImage', 'captions'].includes(e[0])))
})
