import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { SCENE3D_SOURCE } from '../../src/features/criativos/scene3d.ts'
import { readFileSync } from 'node:fs'

// scene.ts tem sintaxe que o Node não remove sozinho: o contrato é lido como texto
const SCENE_CONTRACT = readFileSync(new URL('../../src/features/criativos/scene.ts', import.meta.url), 'utf8')

// Um contexto 2D falso que conta o que foi pintado (o worker real usa OffscreenCanvas).
function fakeCtx(log) {
  const grad = { addColorStop() {} }
  return new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => grad : (...a) => { log.push(k) }),
    set: (o, k, v) => { o[k] = v; return true },
  })
}
function loadD3() {
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
  const ease = { outCubic: (t) => 1 - (1 - t) ** 3, outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2, inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) }
  const rand = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
  class OffscreenCanvas { constructor(w, h) { this.width = w; this.height = h } getContext() { return fakeCtx([]) } }
  const sandbox = { clamp, ease, rand, OffscreenCanvas, image() {}, roundRect() {}, blurFrame: (ctx, t, n, s, draw) => { for (let i = 0; i < n; i++) draw(ctx, t - s * i / (n - 1)) } }
  vm.createContext(sandbox)
  vm.runInContext(SCENE3D_SOURCE + '\nthis.d3 = d3', sandbox)
  return sandbox.d3
}

const env = { width: 1080, height: 1920, images: {}, brand: { name: 'Marca', colors: ['#111111', '#ffffff', '#222222', '#2B3CF0'] }, data: { words: [{ w: 'Botão', s: 22.36, e: 22.6 }] } }
const CAM = [[0, { at: [0, 0.5, 0], yaw: -40, pitch: 70, dist: 24, fov: 50 }], [4, { at: [-3, 1.6, -2], yaw: -128, pitch: 17, dist: 9 }], [9, { yaw: -210, dist: 12 }]]

test('lib.d3 monta e desenha um mundo completo sem erro', () => {
  const d3 = loadD3()
  const log = []
  const ctx = fakeCtx(log)
  for (const t of [0, 1.3, 4, 8.7]) {
    d3.run(ctx, t, env, CAM, (c, time) => {
      const w = d3.world(c, time, env, { camera: CAM })
      w.plate({ open: 0.6, layers: [{ kind: 'texto', lit: 1, at: 1 }, { kind: 'grade', lit: 0.5 }, { kind: 'botao', lit: 1, at: 2 }] })
      w.city({ rise: 0, avoid: [[0, 0, 2]] })
      const hub = w.node({ x: 0, z: 0, h: 1.2, shape: 'nucleo', icon: 'logo' })
      const site = w.node({ x: 3, z: 2.3, h: 1.9, shape: 'largo', icon: 'site' })
      for (const [i, icon] of d3.icons.entries()) w.node({ x: Math.cos(i) * 4, z: Math.sin(i) * 4, h: 1, shape: ['torre', 'recuo', 'estudio', 'cilindro', 'caixa'][i % 5], icon })
      const l = w.link(hub.top, site.top, { grow: 1, focus: 1 })
      w.comet(l, 0.5); w.panel({ id: 's', corners: site.screen, draw: (g, W, H) => d3.browser(g, W, H, 0.9, '#2B3CF0', time) })
      w.people({ from: [-5, -2], to: [-3, -2] }); w.ripple({ at: [0, 0, 0], phase: 0.4, ground: true }); w.floaters({ at: [0, 3, 0] })
      w.tile({ at: [0, 3, 0], icon: 'msg_in', w: 1.35 })
      w.render()
    })
  }
  assert.ok(log.filter((k) => k === 'fill').length > 500, 'pintou as faces')
  assert.ok(d3.icons.includes('instagram') && d3.icons.includes('whatsapp') && d3.icons.includes('logo'))
})

test('a câmera anda sem saltos entre quadros (sem micro-tremida)', () => {
  const d3 = loadD3()
  let prev, prevStep
  for (let f = 0; f <= 9 * 30; f++) {
    const c = d3.camera(CAM, f / 30, 1080, 1920)
    if (prev) {
      const step = Math.hypot(c.pos[0] - prev[0], c.pos[1] - prev[1], c.pos[2] - prev[2])
      if (prevStep !== undefined) assert.ok(Math.abs(step - prevStep) < 0.05, 'aceleração suave no quadro ' + f)
      prevStep = step
    }
    prev = c.pos
  }
})

test('wordAt acha a palavra falada sem acento e o contrato descreve lib.d3', () => {
  const d3 = loadD3()
  assert.equal(d3.wordAt(env, 'botao', 20, 99), 22.36)
  assert.equal(d3.wordAt(env, 'nada', 0, 7), 7)
  assert.match(SCENE_CONTRACT, /lib\.d3\.run\(ctx, t, env, CAM/)
})
