import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { EXPLAINER_SCENE } from '../../src/features/criativos/explicativo/engine.ts'

// Os efeitos que vieram das skills de vídeo (carrossel, órbita de cartões, tela dividida, gráfico) no motor do explicativo.
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const ease = new Proxy({}, { get: () => (x) => x })
const lib = {
  clamp, ease, lerp: (a, b, k) => a + (b - a) * k, prog: (t, a, b) => clamp((t - a) / (b - a)), pulse: () => 0, mix: (a) => a,
  measure: (c, s, o) => String(s).length * (o.size || 10) * 0.5, fit: (c, s, w, o) => Math.min(o.size, w / Math.max(1, String(s).length * 0.5)),
  text: (c, s, x, y, o) => c.fillText(s, x, y, o), roundRect: (c, x, y, w, h) => c.rect(x, y, w, h), circle() {}, path() {}, at: (c, x, y, o, fn) => fn(c),
  image: (c, img, cx, cy, w, h) => c.drawImage(img, cx - w / 2, cy - h / 2, w, h),
}
function fakeCtx(events) {
  const grad = { addColorStop() {} }
  return new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : k.startsWith('create') ? () => grad : (...a) => events.push([k, ...a])),
    set: (o, k, v) => { o[k] = v; return true },
  })
}
function render(beat, t = 1.5, extra = {}) {
  const events = []
  class OffscreenCanvas { constructor(w, h) { this.width = w; this.height = h } getContext() { return fakeCtx([]) } }
  let renderer
  const env = { width: 1080, height: 1920, duration: 10, video: { width: 1080, height: 1920 }, mask: null, images: { foto1: { width: 600, height: 800 } }, state: {}, data: {
    look: 'recorte', theme: 'escuro', beats: [{ start: 0, end: 10, headline: 'Teste', ...beat }], words: [], photos: ['foto1'], icons: {}, ...extra,
    brand: { ink: '#111111', paper: '#FAFAF8', accent: '#2B3CF0', accentOnDark: '#8F9BFF', accentOnLight: '#2B3CF0', onAccent: '#FFFFFF', muted: '#66625A', heading: 'Inter', body: 'Inter', emphasis: 'Inter', radius: 8 },
  } }
  const code = EXPLAINER_SCENE.replace('const BRAND0 =', `
    animation = (ctx,t,box) => { events.push(['animation', box]); return surface('ink') };
    captions = (ctx,t,y) => events.push(['captions', y]);
    signature = () => {};
    const BRAND0 =`)
  vm.runInNewContext(code, { env, events, lib, OffscreenCanvas, scene: (r) => { renderer = r } })
  renderer.draw(fakeCtx(events), t, env)
  return events
}

test('gráfico: barras só com números escritos nos itens, legenda sobre o painel da pessoa', () => {
  let ev = render({ effect: 'grafico', items: ['Instagram 42%', 'Google 31%', 'Site 9%'] })
  const texts = ev.filter((e) => e[0] === 'fillText').map((e) => e[1])
  assert.ok(texts.includes('42%') && texts.includes('9%'), 'valores das barras')
  assert.ok(texts.includes('Instagram'), 'rótulo sem o número')
  assert.equal(ev.find((e) => e[0] === 'captions')[1], 1920 * 0.86)
  // sem número nos itens: lista, nunca barras inventadas
  ev = render({ effect: 'grafico', items: ['Prova social', 'Caminho claro'] })
  assert.ok(!ev.some((e) => e[0] === 'fillText' && /%/.test(String(e[1]))))
  assert.ok(ev.some((e) => e[0] === 'fillText' && e[1] === 'Prova social'))
})

test('tela dividida: animação em cima, a pessoa embaixo e a legenda na emenda', () => {
  const ev = render({ effect: 'tela-dividida' })
  const box = ev.find((e) => e[0] === 'animation')[1]
  assert.equal(box.y, 0); assert.equal(box.h, Math.round(1920 * 0.47))
  const cap = ev.find((e) => e[0] === 'captions')[1]
  assert.ok(Math.abs(cap - (box.h + 30)) < 1)
})

test('carrossel e órbita sem o recorte não passam sobre o rosto', () => {
  for (const effect of ['carrossel', 'orbita-cartoes']) {
    const ev = render({ effect }, 2)
    const cards = ev.filter((e) => e[0] === 'drawImage' && e[1] && e[1].width === 600)
    assert.ok(cards.length > 0, effect + ' desenha as fotos')
  }
  const rows = render({ effect: 'carrossel' }, 2).filter((e) => e[0] === 'drawImage' && e[1] && e[1].width === 600)
  assert.ok(rows.every((e) => e[3] > 1920 * 0.6), 'sem recorte, o carrossel fica na faixa de baixo')
})
