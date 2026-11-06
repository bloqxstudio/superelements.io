/**
 * O worker que roda o código de uma cena (`scene.ts`). Vai como texto e vira um
 * Blob: assim não depende de configuração de worker do Vite e o código da IA
 * roda fora da página, sem DOM, sem a sessão e sem rede (o worker guarda o
 * `fetch` só para baixar as fontes do Google Fonts e apaga os acessos de rede
 * do escopo global antes de avaliar a cena). Cada quadro é desenhado num
 * OffscreenCanvas e volta como ImageBitmap.
 */

export const SCENE_WORKER_SOURCE = String.raw`
'use strict'
const netFetch = self.fetch.bind(self)
const FontFaceCtor = self.FontFace
const fontSet = self.fonts
// Sem rede: some do objeto global e de toda a cadeia de protótipos (WorkerGlobalScope, EventTarget…)
for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker', 'SharedWorker', 'WebTransport', 'RTCPeerConnection', 'Request', 'FileReaderSync']) {
  for (let o = self; o; o = Object.getPrototypeOf(o)) {
    try { if (Object.prototype.hasOwnProperty.call(o, k)) delete o[k] } catch (e) {}
  }
  try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }) } catch (e) { try { self[k] = undefined } catch (e2) {} }
}

// Aleatório com semente: o mesmo quadro sempre sai igual
let seedState = 1
const seeded = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296 }
Math.random = seeded

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const PI = Math.PI
const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75
    if (t < 1 / d) return n * t * t
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
    return n * (t -= 2.625 / d) * t + 0.984375
  },
}
const easeOf = (e) => (typeof e === 'function' ? e : ease[e] || ease.outCubic)

/** Progresso 0→1 de t entre a e b, com curva. */
const prog = (t, a, b, e = 'linear') => easeOf(e)(clamp((t - a) / Math.max(1e-6, b - a)))
/** Valor de 'from' até 'to' entre os segundos a e b. */
const tween = (t, a, b, from, to, e = 'outCubic') => lerp(from, to, prog(t, a, b, e))
/** Keyframes: [[t, valor], [t, valor, curva], ...]; valor pode ser número ou lista de números. */
const keys = (t, list) => {
  if (!list.length) return 0
  if (t <= list[0][0]) return list[0][1]
  for (let i = 1; i < list.length; i++) {
    const [tb, vb, e] = list[i]
    const [ta, va] = list[i - 1]
    if (t <= tb) {
      const p = easeOf(e || 'outCubic')(clamp((t - ta) / Math.max(1e-6, tb - ta)))
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], p)) : lerp(va, vb, p)
    }
  }
  return list[list.length - 1][1]
}
/** 1 no instante 'at' caindo a 0 em 'dur' segundos (impacto, clarão). */
const pulse = (t, at, dur = 0.3) => (t < at || t > at + dur ? 0 : Math.pow(1 - (t - at) / dur, 2))
const rand = (seed) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const noise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rand(i) * 2 - 1, rand(i + 1) * 2 - 1, u) }
/** Tremida que cai a zero: {x, y, r}. */
const shake = (t, at, dur = 0.35, amp = 18, seed = 1) => {
  const k = pulse(t, at, dur) * amp
  return { x: noise((t - at) * 40 + seed) * k, y: noise((t - at) * 40 + seed + 50) * k, r: noise((t - at) * 30 + seed + 99) * k * 0.004 }
}

const hexToRgb = (h) => { const n = parseInt(h.replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mix = (a, b, t) => { const x = hexToRgb(a), y = hexToRgb(b); return 'rgb(' + x.map((v, i) => Math.round(lerp(v, y[i], clamp(t)))).join(',') + ')' }

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)) }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, PI * 2) }
function star(ctx, x, y, points, outer, inner, rot = -PI / 2) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) { const r = i % 2 ? inner : outer, a = rot + (i * PI) / points; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r) }
  ctx.closePath()
}
/** Desenha 'draw' com o contexto movido para (x, y), girado e em escala, em volta desse ponto. */
function at(ctx, x, y, opts, draw) {
  ctx.save(); ctx.translate(x, y)
  if (opts.rotate) ctx.rotate(opts.rotate)
  const s = opts.scale === undefined ? 1 : opts.scale
  ctx.scale(s * (opts.sx === undefined ? 1 : opts.sx), s * (opts.sy === undefined ? 1 : opts.sy))
  if (opts.alpha !== undefined) ctx.globalAlpha *= clamp(opts.alpha)
  draw(ctx); ctx.restore()
}
const fontOf = (o) => (o.italic ? 'italic ' : '') + (o.weight || 800) + ' ' + o.size + 'px "' + (o.font || 'Montserrat') + '", system-ui, sans-serif'
/** Texto de uma linha. opts: font, size, weight, italic, color, align ('center'), baseline ('middle'), spacing (px), stroke, strokeWidth. */
function text(ctx, str, x, y, o) {
  ctx.save(); ctx.font = fontOf(o); ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.baseline || 'middle'
  ctx.letterSpacing = (o.spacing || 0) + 'px'
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeWidth || 8; ctx.strokeText(str, x, y) }
  if (o.color !== 'none') { ctx.fillStyle = o.color || '#fff'; ctx.fillText(str, x, y) }
  ctx.restore()
}
/** Largura do texto com essas opções. */
function measure(ctx, str, o) { ctx.save(); ctx.font = fontOf(o); ctx.letterSpacing = (o.spacing || 0) + 'px'; const w = ctx.measureText(str).width; ctx.restore(); return w }
/** O maior tamanho (até o.size) em que o texto cabe em 'maxWidth'. */
function fit(ctx, str, maxWidth, o) { const w = measure(ctx, str, { ...o }); return w <= maxWidth ? o.size : Math.floor((o.size * maxWidth) / w) }
/**
 * Texto que entra letra a letra ('p' de 0 a 1): cada letra salta da escala 0 com a curva outBack,
 * ou 'mode: "write"' para aparecer como escrita à mão (sem salto, com leve subida).
 */
function letters(ctx, str, x, y, p, o) {
  ctx.save(); ctx.font = fontOf(o); ctx.letterSpacing = (o.spacing || 0) + 'px'
  const chars = [...str], total = ctx.measureText(str).width
  let cx = (o.align || 'center') === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x
  const n = chars.length, span = o.span || 0.35, step = n > 1 ? (1 - span) / (n - 1) : 0
  chars.forEach((ch, i) => {
    const w = ctx.measureText(ch).width
    const lp = clamp((p - i * step) / span)
    if (lp > 0) {
      const e = o.mode === 'write' ? ease.outCubic(lp) : ease.outBack(lp)
      ctx.save(); ctx.translate(cx + w / 2, y)
      if (o.mode === 'write') { ctx.globalAlpha *= clamp(lp * 2); ctx.translate(0, (1 - e) * o.size * 0.2) } else ctx.scale(e, e)
      ctx.textAlign = 'center'; ctx.textBaseline = o.baseline || 'middle'
      if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeWidth || 8; ctx.strokeText(ch, 0, 0) }
      ctx.fillStyle = o.color || '#fff'; ctx.fillText(ch, 0, 0); ctx.restore()
    }
    cx += w + (o.spacing || 0)
  })
  ctx.restore()
}
/** Imagem dentro de uma caixa: fit 'contain' (padrão) ou 'cover'. Centralizada em (cx, cy). */
function image(ctx, img, cx, cy, w, h, fitMode = 'contain') {
  if (!img) return
  const k = fitMode === 'cover' ? Math.max(w / img.width, h / img.height) : Math.min(w / img.width, h / img.height)
  const iw = img.width * k, ih = img.height * k
  if (fitMode === 'cover') { ctx.save(); ctx.beginPath(); ctx.rect(cx - w / 2, cy - h / 2, w, h); ctx.clip() }
  ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih)
  if (fitMode === 'cover') ctx.restore()
}
/** Linha (lista de [x, y]) desenhada até a fração 'p' do comprimento: rotas, sublinhados, checks. */
function path(ctx, pts, p, o = {}) {
  if (pts.length < 2 || p <= 0) return
  let len = 0; const seg = []
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); len += d }
  let left = len * clamp(p)
  ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length && left > 0; i++) {
    const k = Math.min(1, left / seg[i - 1]); left -= seg[i - 1]
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k))
  }
  ctx.strokeStyle = o.color || '#fff'; ctx.lineWidth = o.width || 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (o.dash) ctx.setLineDash(o.dash)
  ctx.stroke(); ctx.restore()
}

// Motion blur do quadro inteiro: média de várias amostras de tempo (como o After Effects)
let blurCanvas = null
function blurFrame(ctx, t, samples, span, draw) {
  const W = ctx.canvas.width, H = ctx.canvas.height
  if (!blurCanvas || blurCanvas.width !== W || blurCanvas.height !== H) blurCanvas = new OffscreenCanvas(W, H)
  const b = blurCanvas.getContext('2d')
  for (let i = 0; i < samples; i++) {
    const st = t - span * (i / Math.max(1, samples - 1))
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.clearRect(0, 0, W, H)
    seedState = (Math.floor(st * 1000) + 1) >>> 0
    draw(b, st)
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(blurCanvas, 0, 0); ctx.restore()
  }
}

/** Desenha uma peça do criativo (env.post) no lugar dela, com transformações em volta do centro. */
function layer(ctx, l, o = {}) {
  if (!l || !l.sprite) return
  const alpha = o.alpha === undefined ? 1 : clamp(o.alpha)
  if (alpha <= 0.001) return
  ctx.save()
  ctx.translate(l.cx + (o.x || 0), l.cy + (o.y || 0))
  if (o.rotate) ctx.rotate(o.rotate)
  const s = o.scale === undefined ? 1 : o.scale
  ctx.scale(Math.max(0.0001, s * (o.sx === undefined ? 1 : o.sx)), Math.max(0.0001, s * (o.sy === undefined ? 1 : o.sy)))
  ctx.globalAlpha *= alpha
  if (o.blur) ctx.filter = 'blur(' + Math.max(0, o.blur) + 'px)'
  const w = l.spriteW, h = l.spriteH
  if (o.reveal !== undefined && o.reveal < 1) {
    const p = clamp(o.reveal), dir = o.from || 'up'
    ctx.beginPath()
    if (dir === 'left') ctx.rect(-w / 2, -h / 2, w * p, h)
    else if (dir === 'right') ctx.rect(w / 2 - w * p, -h / 2, w * p, h)
    else if (dir === 'down') ctx.rect(-w / 2, -h / 2, w, h * p)
    else ctx.rect(-w / 2, h / 2 - h * p, w, h * p)
    ctx.clip()
  }
  ctx.drawImage(l.sprite, -w / 2, -h / 2, w, h)
  ctx.restore()
}

let env = null, def = null, canvas = null, ctx = null

async function loadFonts(list) {
  const done = []
  for (const raw of list || []) {
    const fam = String(raw).split(':')[0].trim()
    if (!fam) continue
    const q = encodeURIComponent(fam).replace(/%20/g, '+')
    let css = ''
    for (const spec of [':ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700;1,800;1,900', ':wght@400;700;800;900', '']) {
      try { const r = await netFetch('https://fonts.googleapis.com/css2?family=' + q + spec + '&display=block'); if (r.ok) { css = await r.text(); break } } catch (e) {}
    }
    const blocks = css.match(/@font-face\s*{[^}]*}/g) || []
    for (const b of blocks) {
      const range = (b.match(/unicode-range:\s*([^;]+);/) || [])[1]
      if (range && !/U\+0000-00FF/i.test(range)) continue
      const url = (b.match(/url\(([^)]+)\)/) || [])[1]
      if (!url) continue
      const face = new FontFaceCtor(fam, 'url(' + url + ')', { style: (b.match(/font-style:\s*(\w+)/) || [])[1] || 'normal', weight: (b.match(/font-weight:\s*([\d ]+)/) || [])[1] || '400', unicodeRange: range || undefined })
      try { await face.load(); fontSet.add(face) } catch (e) {}
    }
    done.push(fam)
  }
  return done
}

const lib = { layer, clamp, lerp, ease, prog, tween, keys, pulse, rand, noise, shake, mix, roundRect, circle, star, at, text, measure, fit, letters, image, path, blurFrame, PI }

self.onmessage = async (ev) => {
  const m = ev.data
  if (m.type === 'init') {
    try {
      canvas = new OffscreenCanvas(m.width, m.height)
      ctx = canvas.getContext('2d')
      env = { width: m.width, height: m.height, duration: m.duration, fps: m.fps, images: m.images || {}, beats: m.beats || [], bpm: m.bpm || 120, brand: m.brand || {}, post: m.post || null, lib }
      env.beat = (t) => {
        const bs = env.beats.length ? env.beats : null
        if (!bs) { const step = 60 / env.bpm, i = Math.floor(t / step); return { index: i, at: i * step, phase: (t % step) / step, step } }
        let i = 0; while (i + 1 < bs.length && bs[i + 1] <= t) i++
        const step = bs[i + 1] !== undefined ? bs[i + 1] - bs[i] : 60 / env.bpm
        return { index: i, at: bs[i], phase: clamp((t - bs[i]) / step), step }
      }
      def = null
      const scene = (d) => { def = d }
      new Function('scene', 'env', 'lib', '"use strict";\n' + m.code)(scene, env, lib)
      if (!def || typeof def.draw !== 'function') throw new Error('O código não chamou scene({ draw(ctx, t, env) { ... } }).')
      await loadFonts([...(def.fonts || []), ...(m.fonts || [])])
      env.state = def.setup ? def.setup(env) : undefined
      self.postMessage({ type: 'ready', name: def.name || '', duration: def.duration })
    } catch (err) {
      self.postMessage({ type: 'error', message: String((err && err.message) || err), stack: String((err && err.stack) || '').split('\n').slice(0, 4).join('\n') })
    }
    return
  }
  if (m.type === 'frame') {
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      seedState = (Math.floor(m.t * 1000) + 1) >>> 0
      def.draw(ctx, m.t, env)
      const bitmap = canvas.transferToImageBitmap()
      self.postMessage({ type: 'frame', id: m.id, bitmap }, [bitmap])
    } catch (err) {
      self.postMessage({ type: 'frame-error', id: m.id, message: String((err && err.message) || err), stack: String((err && err.stack) || '').split('\n').slice(0, 4).join('\n') })
    }
  }
}
`
