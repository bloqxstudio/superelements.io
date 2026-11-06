/**
 * Cenas de exemplo do estúdio de cena em código. A primeira segue o roteiro dos
 * comerciais de app de delivery (frase escrita à mão, marca, celular na mão,
 * categorias com o prato voando, moto, mapa com a rota, pedido entregue, fecho),
 * desenhada inteira em código, com as cores e o nome da marca do conjunto.
 * Imagens com os nomes "burger", "pizza", "sushi" e "logo" substituem os desenhos.
 */

export const DELIVERY_SCENE = String.raw`// Comercial de delivery · 9:16, ~22 s
const W = 1080
const H = env.height * 1080 / env.width
const C = (env.brand.colors || []).filter(Boolean)
const RED = C[0] || '#E3262F'
const ACCENT = C[1] || '#9B7BFF'
const INK = '#1B1B1F', PAPER = '#FAFAF7', GREEN = '#2BB673', CHEESE = '#FFC21A'
const BRAND = env.brand.name || 'Sua Marca'
const L = lib
const DISPLAY = { font: 'Montserrat', weight: 900 }
const HAND = { font: 'Permanent Marker', weight: 400 }

const CATS = [
  { name: 'Burger', price: 'R$ 29,90', img: 'burger', draw: drawBurger, from: -1 },
  { name: 'Pizza', price: 'R$ 44,00', img: 'pizza', draw: drawPizza, from: 1 },
  { name: 'Sushi', price: 'R$ 64,00', img: 'sushi', draw: drawSushi, from: -1 },
]

// Linha do tempo (segundos). Cenas que se empurram se sobrepõem 0,4 s.
const P = 0.4
const T = { hook: [0, 2], logo: [2, 4], phone: [4, 7], cat0: 7 - P }
const CAT = 2.4
const catA = (i) => T.cat0 + i * (CAT - P)
const RAPID = [catA(3), catA(3) + 2.9]
const MAP = [RAPID[1], RAPID[1] + 2.2]
const DONE = [MAP[1], MAP[1] + 1.8]
const CALM = [DONE[1], DONE[1] + 1.5]
const END = [CALM[1], CALM[1] + 2.2]

// Trechos com movimento rápido: o quadro inteiro ganha rastro de velocidade
const FAST = [[3.55, 4.05], [6.55, 7.05]]
for (let i = 0; i < 4; i++) { const a = catA(i); FAST.push([a - 0.05, a + 0.9]) }
FAST.push([RAPID[1] - 0.6, RAPID[1] + 0.05])
const isFast = (t) => FAST.some(([a, b]) => t >= a && t <= b)

scene({
  fonts: ['Montserrat', 'Permanent Marker'],
  duration: END[1],
  draw(ctx, t) {
    ctx.save()
    ctx.scale(env.width / W, env.width / W)
    if (isFast(t)) L.blurFrame(ctx, t, 4, 1 / 40, (c, st) => { c.save(); c.scale(env.width / W, env.width / W); frame(c, st); c.restore() })
    else frame(ctx, t)
    ctx.restore()
  },
})

function frame(ctx, t) {
  const on = ([a, b]) => t >= a && t < b
  if (t < T.hook[1]) hook(ctx, t - T.hook[0])
  if (on(T.logo)) logo(ctx, t - T.logo[0])
  if (on(T.phone)) phone(ctx, t - T.phone[0], T.phone[1] - T.phone[0])
  CATS.forEach((c, i) => { const a = catA(i); if (t >= a && t < a + CAT) category(ctx, t - a, c, i) })
  if (on(RAPID)) rapid(ctx, t - RAPID[0], RAPID[1] - RAPID[0])
  if (on(MAP)) map(ctx, t - MAP[0], MAP[1] - MAP[0])
  if (on(DONE)) done(ctx, t - DONE[0])
  if (on(CALM)) calm(ctx, t - CALM[0])
  if (t >= END[0]) end(ctx, t - END[0])
}

// Empurrão: a cena entra pela direita e sai pela esquerda
const pushX = (lt, d, inn, out) => (inn ? L.keys(lt, [[0, W], [P, 0, 'outExpo']]) : 0) + (out ? L.keys(lt, [[d - P, 0], [d, -W * 1.05, 'inExpo']]) : 0)
const bg = (ctx, color, x = 0) => { ctx.fillStyle = color; ctx.fillRect(x - 2, -2, W + 4, H + 4) }
/** Círculo que abre a partir de um ponto e cobre a tela. */
const reveal = (ctx, x, y, p, color) => { if (p <= 0) return; ctx.fillStyle = color; L.circle(ctx, x, y, Math.hypot(W, H) * L.ease.inOutCubic(L.clamp(p))); ctx.fill() }

// 1 · Frase escrita à mão, depois o vermelho abre do centro
function hook(ctx, lt) {
  bg(ctx, PAPER)
  const sh = L.shake(lt, 1.25, 0.25, 6, 3)
  L.letters(ctx, 'Tá com fome?', W / 2 + sh.x, H * 0.47 + sh.y, L.prog(lt, 0.15, 1.2), { ...HAND, size: 130, color: RED, mode: 'write', span: 0.25 })
  L.path(ctx, [[260, H * 0.47 + 90], [520, H * 0.47 + 104], [820, H * 0.47 + 86]], L.prog(lt, 1.0, 1.35, 'outCubic'), { color: RED, width: 12 })
  reveal(ctx, W / 2, H * 0.47, L.prog(lt, 1.45, 2.0), RED)
}

// 2 · A marca bate na tela e some num ponto
function logo(ctx, lt) {
  bg(ctx, RED)
  const size = Math.min(230, L.fit(ctx, BRAND, W - 140, { ...DISPLAY, size: 230 }))
  const out = L.prog(lt, 1.55, 2.0, 'inBack')
  const sh = L.shake(lt, 0.55, 0.35, 16, 1)
  L.at(ctx, W / 2 + sh.x, H / 2 + sh.y, { scale: 1 - out, rotate: sh.r }, (c) => {
    if (env.images.logo) L.image(c, env.images.logo, 0, 0, 700, 400)
    else L.letters(c, BRAND, 0, 0, L.prog(lt, 0.05, 0.6), { ...DISPLAY, size, color: '#fff', spacing: -size * 0.04 })
    // O sorriso embaixo do nome
    const p = L.prog(lt, 0.55, 0.9, 'outCubic')
    const pts = []
    for (let i = 0; i <= 20; i++) { const a = i / 20; pts.push([-180 + 360 * a, size * 0.62 + Math.sin(a * Math.PI) * 40]) }
    L.path(c, pts, p, { color: '#fff', width: 16 })
  })
  // Clarão no impacto
  ctx.fillStyle = 'rgba(255,255,255,' + 0.6 * L.pulse(lt, 0.55, 0.2) + ')'
  ctx.fillRect(0, 0, W, H)
}

// 3 · O app na palma da mão
function phone(ctx, lt, d) {
  const x = pushX(lt, d, false, true)
  bg(ctx, RED, x)
  ctx.save(); ctx.translate(x, 0)
  // Brilho que respira atrás
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  L.circle(ctx, W / 2, H * 0.55, 560 * L.keys(lt, [[0, 0], [0.5, 1, 'outBack']]) * (1 + 0.03 * Math.sin(lt * 3))); ctx.fill()
  // Mão por trás
  const hy = L.keys(lt, [[0, 900], [0.55, 0, 'outExpo']])
  ctx.save(); ctx.translate(560, H * 0.62 + hy); ctx.fillStyle = ACCENT
  ctx.beginPath(); ctx.moveTo(-200, 760); ctx.bezierCurveTo(-260, 420, -180, 200, -60, 140); ctx.lineTo(60, 40); ctx.bezierCurveTo(120, 0, 180, 40, 160, 120)
  ctx.lineTo(260, 0); ctx.bezierCurveTo(300, -40, 360, 0, 330, 80); ctx.lineTo(280, 380); ctx.bezierCurveTo(240, 600, 120, 760, -40, 780); ctx.closePath(); ctx.fill(); ctx.restore()
  // Celular
  const py = L.keys(lt, [[0.05, 1300], [0.7, 0, 'outBack']])
  const rot = L.keys(lt, [[0.05, 0.4], [0.7, -0.12, 'outBack'], [d, -0.08]])
  L.at(ctx, W / 2, H * 0.56 + py, { rotate: rot }, (c) => {
    c.fillStyle = '#16161a'; L.roundRect(c, -240, -480, 480, 960, 70); c.fill()
    c.fillStyle = '#fafafa'; L.roundRect(c, -218, -458, 436, 916, 52); c.fill()
    c.fillStyle = '#16161a'; L.roundRect(c, -70, -440, 140, 34, 17); c.fill()
    for (let i = 0; i < 6; i++) {
      const p = L.prog(lt, 0.55 + i * 0.09, 0.85 + i * 0.09, 'outExpo')
      if (p <= 0) continue
      c.save(); c.globalAlpha = p; c.translate((1 - p) * 300, -340 + i * 140)
      c.fillStyle = i % 2 ? INK : RED; L.roundRect(c, -180, 0, 96, 96, 24); c.fill()
      c.fillStyle = INK; L.roundRect(c, -64, 14, 180 - (i % 3) * 30, 20, 10); c.fill()
      c.fillStyle = '#c7c7cf'; L.roundRect(c, -64, 48, 150, 14, 7); c.fill()
      c.fillStyle = ACCENT; L.roundRect(c, -64, 72, 90, 14, 7); c.fill()
      c.restore()
    }
  })
  // Título
  const words = ['NA PALMA', 'DA SUA MÃO!']
  words.forEach((w, i) => {
    const p = L.prog(lt, 0.8 + i * 0.15, 1.2 + i * 0.15)
    L.at(ctx, W / 2, 230 + i * 110, { scale: L.ease.outBack(p), alpha: p }, (c) => L.text(c, w, 0, 0, { ...DISPLAY, italic: true, size: 104, color: '#fff' }))
  })
  ctx.restore()
}

// 4 · Categoria: título gigante atravessando, prato voando, etiqueta que salta
function category(ctx, lt, cat, i) {
  const d = CAT
  const x = pushX(lt, d, true, true)
  bg(ctx, RED, x)
  ctx.save(); ctx.translate(x, 0)
  // Título vem da direita mais rápido que a cena (paralaxe)
  const size = L.fit(ctx, cat.name, W - 100, { ...DISPLAY, size: 260 })
  const tx = L.keys(lt, [[0, 500], [0.6, 0, 'outExpo'], [d, -140, 'linear']])
  L.text(ctx, cat.name, 60 + tx, 400, { ...DISPLAY, size, color: '#fff', align: 'left', spacing: -size * 0.05 })
  // Prato: voa na diagonal girando, pousa com squash e segue derivando
  const fly = L.prog(lt, 0.3, 0.85, 'outExpo')
  const land = lt - 0.85
  const sq = land > 0 && land < 0.35 ? Math.sin((land / 0.35) * Math.PI) * 0.09 * (1 - land / 0.35) : 0
  const px = W / 2 + cat.from * 1100 * (1 - fly)
  const py = H * 0.55 + 900 * (1 - fly) - lt * 20
  L.at(ctx, px, py, { rotate: cat.from * (1 - fly) * 1.2 - 0.08 + lt * 0.03, scale: 0.75 + 0.25 * fly + lt * 0.02, sx: 1 + sq, sy: 1 - sq }, (c) => {
    // Sombra
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(20, 330, 330 * fly, 34 * fly, 0, 0, Math.PI * 2); c.fill()
    if (env.images[cat.img]) L.image(c, env.images[cat.img], 0, 0, 780, 700)
    else cat.draw(c)
  })
  // Etiqueta de preço
  const tp = L.prog(lt, 0.95, 1.35)
  const tag = L.ease.outBack(tp)
  const sh = L.shake(lt, 1.3, 0.2, 8, i)
  L.at(ctx, 690 + sh.x, H * 0.79 + sh.y, { scale: tag, rotate: (1 - tag) * -0.3 }, (c) => {
    c.fillStyle = '#fff'; L.roundRect(c, -290, -75, 580, 150, 75); c.fill()
    L.text(c, cat.price, -60, 4, { ...DISPLAY, weight: 800, size: 68, color: INK })
    c.fillStyle = RED; L.circle(c, 215, 0, 62); c.fill()
    L.path(c, [[178, -24], [192, -24], [204, 22], [244, 22], [254, -12], [198, -12]], 1, { color: '#fff', width: 8 })
    c.fillStyle = '#fff'; L.circle(c, 210, 40, 7); c.fill(); L.circle(c, 238, 40, 7); c.fill()
  })
  ctx.restore()
}

// 5 · Rapidinho: palavra esticada e a moto atravessando
function rapid(ctx, lt, d) {
  const x = pushX(lt, d, true, false)
  bg(ctx, PAPER, x)
  ctx.save(); ctx.translate(x, 0)
  const wx = L.keys(lt, [[0.15, 700], [0.6, 0, 'outExpo'], [d, -60, 'linear']])
  const stretch = L.keys(lt, [[0.15, 2.6], [0.6, 1, 'outExpo']])
  L.at(ctx, W / 2 + wx, H * 0.33, { sx: stretch }, (c) => L.text(c, 'RAPIDINHO', 0, 0, { ...DISPLAY, size: L.fit(c, 'RAPIDINHO', W - 60, { ...DISPLAY, size: 200 }), color: ACCENT, spacing: -8 }))
  // Linhas de velocidade
  ctx.strokeStyle = 'rgba(155,123,255,0.35)'; ctx.lineWidth = 10; ctx.lineCap = 'round'
  for (let i = 0; i < 7; i++) {
    const yy = H * 0.5 + i * 46, len = 160 + L.rand(i) * 220, off = ((lt * 1800 + L.rand(i + 9) * W) % (W + len)) - len
    ctx.beginPath(); ctx.moveTo(W - off, yy); ctx.lineTo(W - off - len, yy); ctx.stroke()
  }
  const mx = L.keys(lt, [[0.3, -1200], [0.85, 0, 'outExpo'], [d - 0.6, 60, 'linear'], [d, 1400, 'inExpo']])
  const bob = Math.sin(lt * 30) * 4
  L.at(ctx, W / 2 + mx, H * 0.6 + bob, { rotate: L.keys(lt, [[0.3, -0.08], [0.85, 0, 'outBack']]) }, (c) => drawMoto(c, lt))
  ctx.restore()
}

// 6 · Mapa: a rota se desenha e o pino cai
function map(ctx, lt, d) {
  bg(ctx, PAPER)
  ctx.save()
  const p = L.prog(lt, 0, 0.45, 'outExpo')
  ctx.beginPath(); L.circle(ctx, W / 2, H / 2, Math.hypot(W, H) * p); ctx.clip()
  const zoom = 1 + lt * 0.04
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2)
  bg(ctx, '#F6F2E8')
  ctx.fillStyle = '#ECE6D6'
  for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) { L.roundRect(ctx, 40 + c * 350, 60 + r * 300, 300, 250, 28); ctx.fill() }
  const route = [[215, H * 0.88], [215, 1385], [565, 1385], [565, 785], [915, 785], [915, 485], [565, 485]]
  L.path(ctx, route, 1, { color: '#ddd5c2', width: 22 })
  const rp = L.prog(lt, 0.3, 1.45, 'inOutCubic')
  L.path(ctx, route, rp, { color: RED, width: 14, dash: [2, 26] })
  // Pino cai no fim da rota
  const drop = L.prog(lt, 1.35, 1.65, 'inQuad')
  const land = lt - 1.65
  const sq = land > 0 && land < 0.3 ? Math.sin((land / 0.3) * Math.PI) * 0.25 * (1 - land / 0.3) : 0
  if (drop > 0) {
    if (land > 0) { ctx.strokeStyle = RED; ctx.lineWidth = 6; ctx.globalAlpha = L.clamp(1 - land / 0.6); L.circle(ctx, 565, 485, 40 + land * 260); ctx.stroke(); ctx.globalAlpha = 1 }
    L.at(ctx, 565, 485 - (1 - drop) * 900, { sx: 1 + sq, sy: 1 - sq }, (c) => {
      c.fillStyle = RED; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-50, -70, -72, -100, -72, -134); c.arc(0, -134, 72, Math.PI, 0); c.bezierCurveTo(72, -100, 50, -70, 0, 0); c.fill()
      c.fillStyle = '#fff'; L.circle(c, 0, -134, 28); c.fill()
    })
  }
  ctx.restore()
}

// 7 · Pedido entregue: o verde abre do pino, check se desenha, estrelas saltam
function done(ctx, lt) {
  bg(ctx, '#fff')
  const g = L.ease.outBack(L.prog(lt, 0, 0.4))
  ctx.fillStyle = GREEN; L.circle(ctx, W / 2, H * 0.4, 140 * g); ctx.fill()
  L.path(ctx, [[W / 2 - 60, H * 0.4 + 4], [W / 2 - 15, H * 0.4 + 50], [W / 2 + 70, H * 0.4 - 50]], L.prog(lt, 0.3, 0.6, 'outCubic'), { color: '#fff', width: 26 })
  const tp = L.prog(lt, 0.45, 0.8, 'outExpo')
  ctx.globalAlpha = tp
  L.text(ctx, 'Seu pedido foi entregue', W / 2, H * 0.53 + (1 - tp) * 40, { ...DISPLAY, weight: 800, size: 62, color: INK })
  ctx.globalAlpha = 1
  for (let i = 0; i < 5; i++) {
    const s = L.ease.outBack(L.prog(lt, 0.7 + i * 0.08, 1.0 + i * 0.08))
    ctx.fillStyle = CHEESE
    L.at(ctx, W / 2 + (i - 2) * 120, H * 0.6, { scale: s, rotate: (1 - s) * 1.5 }, (c) => { L.star(c, 0, 0, 5, 48, 21); c.fill() })
  }
  reveal(ctx, W / 2, H * 0.4, L.prog(lt, 1.3, 1.8), RED)
}

// 8 · Foi tranquilo
function calm(ctx, lt) {
  bg(ctx, RED)
  L.letters(ctx, 'Foi tranquilo!', W / 2, H * 0.48, L.prog(lt, 0.05, 0.9), { ...HAND, size: 130, color: '#fff', mode: 'write', span: 0.25 })
}

// 9 · Fecho: marca e botão que pulsa na batida
function end(ctx, lt) {
  bg(ctx, RED)
  const size = Math.min(210, L.fit(ctx, BRAND, W - 140, { ...DISPLAY, size: 210 }))
  const s = L.ease.outBack(L.prog(lt, 0, 0.45))
  const sh = L.shake(lt, 0.45, 0.3, 12, 7)
  L.at(ctx, W / 2 + sh.x, H * 0.44 + sh.y, { scale: s }, (c) => (env.images.logo ? L.image(c, env.images.logo, 0, 0, 700, 360) : L.text(c, BRAND, 0, 0, { ...DISPLAY, size, color: '#fff', spacing: -size * 0.04 })))
  const b = env.beat(END[0] + lt)
  const beatPulse = 1 + 0.06 * Math.pow(1 - b.phase, 3)
  const bp = L.ease.outBack(L.prog(lt, 0.5, 0.9))
  L.at(ctx, W / 2, H * 0.6, { scale: bp * beatPulse }, (c) => {
    c.fillStyle = '#fff'; L.roundRect(c, -260, -70, 520, 140, 70); c.fill()
    L.text(c, 'PEÇA AGORA', 0, 4, { ...DISPLAY, size: 54, color: RED })
  })
  ctx.fillStyle = 'rgba(255,255,255,' + 0.5 * L.pulse(lt, 0.45, 0.2) + ')'; ctx.fillRect(0, 0, W, H)
}

// Desenhos dos pratos e da moto (centrados em 0, 0)
function drawBurger(c) {
  c.fillStyle = '#d98a35'; L.roundRect(c, -300, 190, 600, 110, 50); c.fill()
  c.fillStyle = '#5a2f17'; L.roundRect(c, -320, 110, 640, 100, 50); c.fill()
  c.fillStyle = CHEESE; c.beginPath(); c.moveTo(-320, 100); c.lineTo(320, 100); c.lineTo(300, 140)
  for (let i = 0; i < 6; i++) { const x = 260 - i * 100; c.quadraticCurveTo(x, 200, x - 50, 140) } c.closePath(); c.fill()
  c.fillStyle = '#4b2512'; L.roundRect(c, -330, 30, 660, 90, 45); c.fill()
  c.fillStyle = '#4caf3b'; c.beginPath(); c.moveTo(-345, 30)
  for (let i = 0; i <= 12; i++) c.quadraticCurveTo(-345 + i * 57.5 - 28, i % 2 ? 60 : 0, -345 + i * 57.5, 25)
  c.lineTo(345, 10); c.lineTo(-345, 10); c.closePath(); c.fill()
  c.fillStyle = '#d6372b'; c.beginPath(); c.ellipse(-130, 10, 120, 24, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(140, 10, 120, 24, 0, 0, Math.PI * 2); c.fill()
  const g = c.createLinearGradient(0, -260, 0, 0); g.addColorStop(0, '#f6b453'); g.addColorStop(1, '#c9701f')
  c.fillStyle = g; c.beginPath(); c.moveTo(-320, 0); c.bezierCurveTo(-320, -300, 320, -300, 320, 0); c.closePath(); c.fill()
  c.fillStyle = '#fff4d6'
  for (let i = 0; i < 10; i++) { c.save(); c.translate(-230 + (i % 5) * 115 + (i > 4 ? 55 : 0), i > 4 ? -110 : -170); c.rotate(L.rand(i) - 0.5); c.beginPath(); c.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); c.fill(); c.restore() }
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 20; c.lineCap = 'round'; c.beginPath(); c.arc(-40, 20, 230, -2.6, -1.9); c.stroke()
}

function drawPizza(c) {
  c.fillStyle = '#c9732a'; L.circle(c, 0, 0, 340); c.fill()
  c.fillStyle = '#e8a046'; L.circle(c, 0, 0, 312); c.fill()
  c.fillStyle = '#c8402c'; L.circle(c, 0, 0, 282); c.fill()
  const g = c.createRadialGradient(-60, -60, 20, 0, 0, 280); g.addColorStop(0, '#ffd27a'); g.addColorStop(1, '#f0a03a')
  c.fillStyle = g; L.circle(c, 0, 0, 272); c.fill()
  const spots = [[0, 0], [-120, -110], [110, -130], [150, 40], [-150, 70], [20, 160], [-40, -200], [200, -40], [-210, -40], [140, 170], [-120, 190], [60, -60]]
  for (let i = 0; i < spots.length; i++) {
    const x = spots[i][0], y = spots[i][1]
    c.fillStyle = '#b3261e'; L.circle(c, x, y, 42); c.fill(); c.fillStyle = 'rgba(255,120,90,0.5)'; L.circle(c, x - 10, y - 12, 13); c.fill()
  }
}

function drawSushi(c) {
  c.save(); c.rotate(-0.08)
  c.fillStyle = 'rgba(0,0,0,0.2)'; L.roundRect(c, -360, -150, 740, 330, 30); c.fill()
  c.fillStyle = '#b9864f'; L.roundRect(c, -370, -170, 740, 330, 30); c.fill()
  for (let i = 0; i < 4; i++) {
    const x = -255 + i * 170
    c.fillStyle = '#1d2a1f'; L.circle(c, x, -70, 74); c.fill(); c.fillStyle = '#f7f3ea'; L.circle(c, x, -70, 60); c.fill()
    c.fillStyle = i % 2 ? '#f08a5d' : '#e8543f'; L.circle(c, x, -70, 32); c.fill()
  }
  for (let i = 0; i < 3; i++) { const x = -170 + i * 170; c.fillStyle = '#f7f3ea'; c.beginPath(); c.ellipse(x, 70, 70, 36, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f47a4a'; c.beginPath(); c.ellipse(x, 52, 78, 26, 0, 0, Math.PI * 2); c.fill() }
  c.restore()
}

function drawMoto(c, lt) {
  const wheel = (x) => {
    c.fillStyle = '#1f1f24'; L.circle(c, x, 150, 105); c.fill(); c.fillStyle = '#e9e9ee'; L.circle(c, x, 150, 55); c.fill()
    c.strokeStyle = '#1f1f24'; c.lineWidth = 8
    for (let k = 0; k < 4; k++) { const a = lt * 25 + (k * Math.PI) / 4; c.beginPath(); c.moveTo(x + Math.cos(a) * 50, 150 + Math.sin(a) * 50); c.lineTo(x - Math.cos(a) * 50, 150 - Math.sin(a) * 50); c.stroke() }
  }
  wheel(-260); wheel(250)
  c.strokeStyle = '#6b6b75'; c.lineWidth = 24; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-260, 150); c.lineTo(-130, 30); c.lineTo(130, 30); c.lineTo(250, 150); c.stroke()
  c.fillStyle = RED; c.beginPath(); c.moveTo(-160, -30); c.bezierCurveTo(-120, -90, 140, -100, 200, -40); c.lineTo(260, 50); c.bezierCurveTo(170, 80, -60, 80, -160, 50); c.closePath(); c.fill()
  c.strokeStyle = '#2b2b30'; c.lineWidth = 20; c.lineCap = 'round'; c.beginPath(); c.moveTo(170, -80); c.lineTo(250, -150); c.stroke()
  c.fillStyle = RED; L.roundRect(c, -310, -210, 190, 170, 18); c.fill(); c.fillStyle = 'rgba(0,0,0,0.15)'; L.roundRect(c, -310, -210, 190, 34, 12); c.fill()
  c.fillStyle = '#f2f2f5'; c.beginPath(); c.moveTo(-40, -40); c.lineTo(0, -190); c.bezierCurveTo(10, -230, 60, -240, 80, -200); c.lineTo(110, -120); c.lineTo(50, -100); c.closePath(); c.fill()
  c.fillStyle = RED; L.circle(c, 45, -250, 62); c.fill(); c.fillStyle = '#1f1f24'; L.roundRect(c, 10, -268, 80, 40, 12); c.fill()
}
`

/**
 * Comercial de hamburgueria com história: 22h47 e a fome, a geladeira só com
 * miojo (riscado), a marca, o processo na chapa (pão na manteiga, blend
 * prensado, cheddar derretendo, montagem), o saco que sai para entrega, a
 * mordida e o combo. Preços e textos são exemplo: trocar pelos do cliente.
 * Imagem opcional "burger" (foto recortada) substitui o lanche montado.
 */
export const BURGER_STORY_SCENE = String.raw`// Hamburgueria · "Bateu a fome" · 9:16, 24 s
const W = 1080
const H = env.height * 1080 / env.width
const C = (env.brand.colors || []).filter(Boolean)
const RED = C[0] || '#E3262F'
const CHEESE = '#FFC21A', NIGHT = '#120E0B', GRILL = '#1E1916', CREAM = '#FFF1DC', INK = '#1B1714'
const BRAND = env.brand.name || 'Sua Hamburgueria'
const L = lib
const BIG = { font: 'Montserrat', weight: 900 }
const HAND = { font: 'Permanent Marker', weight: 400 }

// Roteiro (segundos)
const S1 = [0, 2.4], S2 = [2.4, 4.6], S3 = [4.6, 6.4]
const P = 0.4, STEP = 2.4
const craftA = (i) => 6.4 + i * (STEP - P)
const S5 = [craftA(4), craftA(4) + 2.8]
const S6 = [S5[1], S5[1] + 3]
const S7 = [S6[1], S6[1] + 3.8]
const FAST = [[4.55, 4.95], [5.0, 5.3], [S5[0] + 1.55, S5[0] + 2.05]]
for (let i = 1; i <= 4; i++) FAST.push([craftA(i) - 0.05, craftA(i) + 0.45])
FAST.push([craftA(1) + 0.75, craftA(1) + 1.15])

scene({
  fonts: ['Montserrat', 'Permanent Marker', 'Space Mono'],
  duration: S7[1],
  draw(ctx, t) {
    ctx.save(); ctx.scale(env.width / W, env.width / W)
    if (FAST.some(([a, b]) => t >= a && t <= b)) L.blurFrame(ctx, t, 4, 1 / 40, (c, st) => { c.save(); c.scale(env.width / W, env.width / W); frame(c, st); c.restore() })
    else frame(ctx, t)
    ctx.restore()
  },
})

function frame(ctx, t) {
  const on = ([a, b]) => t >= a && t < b
  if (on(S1)) night(ctx, t - S1[0])
  if (on(S2)) fridge(ctx, t - S2[0], S2[1] - S2[0])
  if (on(S3)) brand(ctx, t - S3[0])
  for (let i = 0; i < 4; i++) { const a = craftA(i); if (t >= a && t < a + STEP) craft(ctx, t - a, i) }
  if (on(S5)) bag(ctx, t - S5[0], S5[1] - S5[0])
  if (on(S6)) bite(ctx, t - S6[0])
  if (t >= S7[0]) combo(ctx, t - S7[0])
}

const pushX = (lt, d, inn, out) => (inn ? L.keys(lt, [[0, W], [P, 0, 'outExpo']]) : 0) + (out ? L.keys(lt, [[d - P, 0], [d, -W * 1.05, 'inExpo']]) : 0)
const bg = (ctx, color, x = 0) => { ctx.fillStyle = color; ctx.fillRect(x - 2, -2, W + 4, H + 4) }
const reveal = (ctx, x, y, p, color) => { if (p <= 0) return; ctx.fillStyle = color; L.circle(ctx, x, y, Math.hypot(W, H) * L.ease.inOutCubic(L.clamp(p))); ctx.fill() }
const flash = (ctx, k) => { if (k <= 0) return; ctx.fillStyle = 'rgba(255,255,255,' + 0.7 * k + ')'; ctx.fillRect(0, 0, W, H) }
/** Legenda escrita à mão com o número da etapa; '|' quebra a linha. */
function caption(ctx, n, text, lt, y = 300) {
  const p = L.prog(lt, 0.15, 0.5, 'outExpo')
  ctx.globalAlpha = p
  L.text(ctx, n, W / 2, y - 110, { ...BIG, weight: 800, size: 34, color: CHEESE, spacing: 6 })
  ctx.globalAlpha = 1
  const lines = text.split('|')
  lines.forEach((line, i) => {
    const size = Math.min(92, L.fit(ctx, line, W - 120, { ...HAND, size: 92 }))
    L.letters(ctx, line, W / 2, y + i * 100, L.prog(lt, 0.2 + i * 0.3, 0.75 + i * 0.3), { ...HAND, size, color: '#fff', mode: 'write', span: 0.2 })
  })
}

// 1 · 22h47, bateu a fome
function night(ctx, lt) {
  bg(ctx, NIGHT)
  // Luz azul do celular que pisca
  const glow = 0.18 + 0.06 * Math.sin(lt * 9) * L.noise(lt * 3)
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 700)
  g.addColorStop(0, 'rgba(120,160,255,' + glow + ')'); g.addColorStop(1, 'rgba(120,160,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const sh = L.shake(lt, 1.75, 0.45, 22, 2)
  ctx.save(); ctx.translate(sh.x, sh.y)
  const ck = L.ease.outBack(L.prog(lt, 0, 0.45))
  L.at(ctx, W / 2, H * 0.36, { scale: ck }, (c) => {
    const colon = Math.floor(lt * 2) % 2 ? ':' : ' '
    L.text(c, '22' + colon + '47', 0, 0, { font: 'Space Mono', weight: 700, size: 230, color: '#fff' })
  })
  L.letters(ctx, 'Bateu a fome.', W / 2, H * 0.5, L.prog(lt, 0.55, 1.4), { ...HAND, size: 96, color: '#fff', mode: 'write', span: 0.22 })
  const r = L.ease.outBack(L.prog(lt, 1.75, 2.0))
  L.at(ctx, W / 2, H * 0.62, { scale: r, rotate: -0.08 }, (c) => L.text(c, 'RONC', 0, 0, { ...BIG, italic: true, size: 170, color: RED, stroke: '#fff', strokeWidth: 10 }))
  ctx.restore()
}

// 2 · A geladeira só tem miojo
function fridge(ctx, lt, d) {
  bg(ctx, NIGHT)
  const fx = W / 2, fy = H * 0.5, fw = 640, fh = 980
  // Interior com luz
  ctx.fillStyle = '#EAF1F4'; L.roundRect(ctx, fx - fw / 2, fy - fh / 2, fw, fh, 30); ctx.fill()
  const lg = ctx.createLinearGradient(0, fy - fh / 2, 0, fy + fh / 2); lg.addColorStop(0, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(180,200,210,0.6)')
  ctx.fillStyle = lg; L.roundRect(ctx, fx - fw / 2 + 20, fy - fh / 2 + 20, fw - 40, fh - 40, 20); ctx.fill()
  ctx.fillStyle = '#C9D6DC'; for (const yy of [-160, 160]) ctx.fillRect(fx - fw / 2 + 20, fy + yy, fw - 40, 12)
  // O miojo, sozinho na prateleira
  const cup = L.ease.outBack(L.prog(lt, 0.4, 0.75))
  L.at(ctx, fx, fy + 70, { scale: cup, rotate: Math.sin(lt * 6) * 0.03 }, (c) => {
    c.fillStyle = '#F4F0E6'; c.beginPath(); c.moveTo(-90, -110); c.lineTo(90, -110); c.lineTo(70, 90); c.lineTo(-70, 90); c.closePath(); c.fill()
    c.fillStyle = RED; c.fillRect(-84, -50, 168, 60)
    L.text(c, 'MIOJO', 0, -18, { ...BIG, size: 34, color: '#fff' })
    c.fillStyle = '#DCD3BF'; L.roundRect(c, -100, -130, 200, 26, 8); c.fill()
  })
  // Porta abre girando na dobradiça
  const open = L.prog(lt, 0.05, 0.5, 'outCubic')
  ctx.save(); ctx.translate(fx - fw / 2, fy - fh / 2); ctx.scale(1 - 0.92 * open, 1)
  ctx.fillStyle = '#D9DEE2'; L.roundRect(ctx, 0, 0, fw, fh, 30); ctx.fill()
  ctx.fillStyle = '#AEB6BC'; L.roundRect(ctx, fw - 70, fh * 0.3, 22, 200, 11); ctx.fill()
  ctx.restore()
  L.letters(ctx, 'Só tem isso?', W / 2, fy - fh / 2 - 90, L.prog(lt, 0.7, 1.3), { ...HAND, size: 84, color: '#fff', mode: 'write', span: 0.22 })
  // Risco de caneta e o NÃO
  L.path(ctx, [[fx - 170, fy - 60], [fx + 170, fy + 180]], L.prog(lt, 1.45, 1.65, 'outCubic'), { color: RED, width: 26 })
  L.path(ctx, [[fx + 170, fy - 60], [fx - 170, fy + 180]], L.prog(lt, 1.6, 1.8, 'outCubic'), { color: RED, width: 26 })
  const no = L.ease.outBack(L.prog(lt, 1.8, 2.0))
  const sh = L.shake(lt, 1.85, 0.3, 14, 4)
  L.at(ctx, W / 2 + sh.x, fy + fh / 2 + 120 + sh.y, { scale: no }, (c) => L.text(c, 'NÃO.', 0, 0, { ...BIG, size: 150, color: RED }))
}

// 3 · A marca, saindo do X vermelho
function brand(ctx, lt) {
  bg(ctx, NIGHT)
  reveal(ctx, W / 2, H * 0.55, L.prog(lt, 0, 0.35), RED)
  if (lt < 0.25) return
  const size = Math.min(200, L.fit(ctx, BRAND, W - 140, { ...BIG, size: 200 }))
  const s = L.ease.outBack(L.prog(lt, 0.35, 0.65))
  const sh = L.shake(lt, 0.65, 0.35, 16, 5)
  L.at(ctx, W / 2 + sh.x, H * 0.46 + sh.y, { scale: s, rotate: (1 - s) * -0.3 }, (c) => L.text(c, BRAND, 0, 0, { ...BIG, size, color: '#fff', spacing: -size * 0.04 }))
  L.letters(ctx, 'smash burger de verdade', W / 2, H * 0.55, L.prog(lt, 0.8, 1.4), { ...HAND, size: 62, color: CHEESE, mode: 'write', span: 0.2 })
  flash(ctx, L.pulse(lt, 0.65, 0.2))
}

// 4 · O processo na chapa
const GY = H * 0.68
function griddle(ctx) {
  bg(ctx, GRILL)
  const g = ctx.createLinearGradient(0, GY - 60, 0, H); g.addColorStop(0, '#3A322D'); g.addColorStop(0.08, '#2A2421'); g.addColorStop(1, '#141110')
  ctx.fillStyle = g; ctx.fillRect(-2, GY - 60, W + 4, H)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-2, GY - 60, W + 4, 6)
  const heat = ctx.createRadialGradient(W / 2, GY + 40, 20, W / 2, GY + 40, 520)
  heat.addColorStop(0, 'rgba(255,120,40,0.22)'); heat.addColorStop(1, 'rgba(255,120,40,0)')
  ctx.fillStyle = heat; ctx.fillRect(0, GY - 300, W, 800)
}
function smoke(ctx, x, y, lt, n, spread = 260, strength = 1) {
  for (let i = 0; i < n; i++) {
    const life = 1.6, ph = ((lt + L.rand(i) * life) % life) / life
    const px = x + (L.rand(i + 30) - 0.5) * spread + Math.sin(lt * 2 + i) * 30 * ph
    const py = y - ph * 520
    const r = 60 + ph * 140, a = 0.13 * strength * Math.sin(ph * Math.PI)
    const g = ctx.createRadialGradient(px, py, 0, px, py, r)
    g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g; L.circle(ctx, px, py, r); ctx.fill()
  }
}
function sparks(ctx, x, y, lt, at, n = 26) {
  const k = lt - at
  if (k < 0 || k > 0.9) return
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.1 + 0.8 * L.rand(i)), v = 500 + L.rand(i + 9) * 900
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 1400 * k * k
    ctx.fillStyle = 'rgba(255,' + Math.round(160 + 90 * L.rand(i + 3)) + ',60,' + (1 - k / 0.9) + ')'
    L.circle(ctx, px, py, 7 * (1 - k)); ctx.fill()
  }
}

function craft(ctx, lt, i) {
  const x = pushX(lt, STEP, true, i < 4)
  ctx.save(); ctx.translate(x, 0)
  if (i === 3) assembly(ctx, lt)
  else {
    griddle(ctx)
    if (i === 0) buns(ctx, lt)
    if (i === 1) smash(ctx, lt)
    if (i === 2) melt(ctx, lt)
  }
  ctx.restore()
}

function buns(ctx, lt) {
  smoke(ctx, W / 2, GY - 40, lt, 10, 500, 0.8)
  const butter = L.prog(lt, 0.2, 1.6)
  ctx.fillStyle = '#FFE38A'; L.at(ctx, W / 2, GY - 12, { sx: 1 + butter * 1.5, sy: 1 - butter * 0.8, alpha: 1 - butter * 0.6 }, (c) => { L.roundRect(c, -40, -26, 80, 52, 10); c.fill() })
  ;[-1, 1].forEach((side, k) => {
    const drop = L.prog(lt, 0.35 + k * 0.12, 0.7 + k * 0.12, 'inQuad')
    const land = lt - (0.7 + k * 0.12)
    const sq = land > 0 && land < 0.3 ? Math.sin((land / 0.3) * Math.PI) * 0.12 : 0
    const sear = L.prog(lt, 0.8, 2.0)
    L.at(ctx, W / 2 + side * 230, GY - 60 - (1 - drop) * 900, { sx: 1 + sq, sy: 1 - sq }, (c) => {
      c.fillStyle = L.mix('#F2B25A', '#B8641E', sear); L.roundRect(c, -190, -50, 380, 100, 50); c.fill()
      c.fillStyle = L.mix('#FFE0A8', '#C9772B', sear); L.roundRect(c, -170, 10, 340, 30, 15); c.fill()
    })
  })
  caption(ctx, '01', 'Pão brioche|selado na manteiga', lt)
}

function smash(ctx, lt) {
  const HIT = 1.0
  smoke(ctx, W / 2, GY - 40, lt, lt > HIT ? 16 : 6, 600, lt > HIT ? 1.3 : 0.6)
  const drop = L.prog(lt, 0.25, 0.6, 'inQuad')
  const press = L.prog(lt, HIT - 0.05, HIT + 0.1, 'outExpo')
  const rx = L.lerp(105, 270, press), ry = L.lerp(100, 40, press)
  const py = GY - ry - (1 - drop) * 900
  ctx.fillStyle = '#8A4A2B'; ctx.beginPath(); ctx.ellipse(W / 2, py, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(60,25,10,0.7)'
  for (let k = 0; k < 14; k++) { L.circle(ctx, W / 2 + (L.rand(k) - 0.5) * rx * 1.6, py + (L.rand(k + 5) - 0.5) * ry * 1.2, 9); ctx.fill() }
  // A espátula desce e prensa
  const sy = L.keys(lt, [[0.55, -700], [HIT, 0, 'inExpo'], [HIT + 0.45, 0], [HIT + 0.8, -900, 'inExpo']])
  ctx.save(); ctx.translate(W / 2, py - ry + sy)
  ctx.fillStyle = '#C9CED3'; L.roundRect(ctx, -300, -26, 600, 26, 6); ctx.fill()
  ctx.fillStyle = '#8D949A'; ctx.fillRect(-300, -6, 600, 6)
  ctx.fillStyle = '#2B2B2E'; L.roundRect(ctx, 150, -360, 70, 340, 30); ctx.fill()
  ctx.restore()
  sparks(ctx, W / 2, GY - 30, lt, HIT)
  const sh = L.shake(lt, HIT, 0.3, 18, 9)
  ctx.translate(sh.x, sh.y)
  caption(ctx, '02', 'Blend de 160 g|prensado na chapa', lt)
  flash(ctx, L.pulse(lt, HIT, 0.15) * 0.6)
}

function melt(ctx, lt) {
  smoke(ctx, W / 2, GY - 40, lt, 10, 500)
  ctx.fillStyle = '#5A2F17'; L.roundRect(ctx, W / 2 - 280, GY - 110, 560, 100, 50); ctx.fill()
  ctx.fillStyle = 'rgba(30,12,4,0.5)'; for (let k = 0; k < 10; k++) { L.circle(ctx, W / 2 - 230 + k * 51, GY - 50 + (k % 3 - 1) * 12, 8); ctx.fill() }
  const drop = L.prog(lt, 0.25, 0.55, 'inQuad')
  const m = L.prog(lt, 0.65, 1.9, 'outCubic')
  const cy = GY - 130 - (1 - drop) * 900 + m * 14
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(0.06 * (1 - m))
  ctx.fillStyle = CHEESE
  ctx.beginPath(); ctx.moveTo(-250 - m * 30, -20 + m * 10); ctx.lineTo(250 + m * 30, -20 + m * 10); ctx.lineTo(260 + m * 30, 30); ctx.lineTo(-260 - m * 30, 30); ctx.closePath(); ctx.fill()
  const drips = [-210, -120, -30, 70, 160, 235]
  drips.forEach((dx, k) => { const w = 30 + L.rand(k + 2) * 26, len = (20 + L.rand(k) * 80) * m; L.roundRect(ctx, dx - w / 2, 10, w, 30 + len, w / 2); ctx.fill() })
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; L.roundRect(ctx, -180, -10, 200, 10, 5); ctx.fill()
  ctx.restore()
  caption(ctx, '03', 'Cheddar|derretendo por cima', lt)
}

// O lanche em camadas (0, 0 = centro do lanche montado)
const PARTS = [
  { y: 170, draw: (c) => { c.fillStyle = '#D98A35'; L.roundRect(c, -290, -45, 580, 90, 45); c.fill() } },
  { y: 95, draw: (c) => { c.fillStyle = '#5A2F17'; L.roundRect(c, -315, -42, 630, 84, 42); c.fill(); c.fillStyle = 'rgba(30,12,4,0.5)'; for (let k = 0; k < 12; k++) { L.circle(c, -260 + k * 47, (k % 3 - 1) * 14, 8); c.fill() } } },
  { y: 52, draw: (c) => { c.fillStyle = CHEESE; c.beginPath(); c.moveTo(-325, -18); c.lineTo(325, -18); c.lineTo(310, 18); for (let k = 0; k < 6; k++) { const x0 = 270 - k * 108; c.quadraticCurveTo(x0, 80, x0 - 54, 18) } c.closePath(); c.fill() } },
  { y: 18, draw: (c) => { c.fillStyle = '#D6372B'; c.beginPath(); c.ellipse(-140, 0, 130, 26, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(140, 0, 130, 26, 0, 0, Math.PI * 2); c.fill() } },
  { y: -8, draw: (c) => { c.fillStyle = '#4CAF3B'; c.beginPath(); c.moveTo(-340, 0); for (let k = 0; k <= 12; k++) c.quadraticCurveTo(-340 + k * 56.6 - 28, k % 2 ? 34 : -6, -340 + k * 56.6, 4); c.lineTo(340, -16); c.lineTo(-340, -16); c.closePath(); c.fill() } },
  { y: -30, draw: (c) => {
      const g = c.createLinearGradient(0, -280, 0, 0); g.addColorStop(0, '#F6B453'); g.addColorStop(1, '#C9701F')
      c.fillStyle = g; c.beginPath(); c.moveTo(-320, 0); c.bezierCurveTo(-320, -300, 320, -300, 320, 0); c.closePath(); c.fill()
      c.fillStyle = '#FFF4D6'; for (let k = 0; k < 10; k++) { c.save(); c.translate(-230 + (k % 5) * 115 + (k > 4 ? 55 : 0), k > 4 ? -110 : -170); c.rotate(L.rand(k) - 0.5); c.beginPath(); c.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); c.fill(); c.restore() }
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 20; c.lineCap = 'round'; c.beginPath(); c.arc(-40, 20, 230, -2.6, -1.9); c.stroke()
    } },
]
/** O lanche montado; 'p' por camada (0 = acima da tela, 1 = no lugar) com squash no pouso. */
function burger(ctx, x, y, scale, at) {
  if (env.images.burger && !at) { L.image(ctx, env.images.burger, x, y, 760 * scale, 700 * scale); return }
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale)
  PARTS.forEach((part, k) => {
    const p = at ? at(k) : { fall: 1, land: 1 }
    if (p.fall <= 0) return
    const sq = p.land > 0 && p.land < 1 ? Math.sin(p.land * Math.PI) * 0.1 : 0
    L.at(ctx, 0, part.y - (1 - p.fall) * 1400, { sx: 1 + sq, sy: 1 - sq }, part.draw)
  })
  ctx.restore()
}

function assembly(ctx, lt) {
  bg(ctx, NIGHT)
  // Raios girando atrás
  ctx.save(); ctx.translate(W / 2, H * 0.56); ctx.rotate(lt * 0.4)
  for (let k = 0; k < 12; k++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = 'rgba(255,194,26,' + (0.07 * L.prog(lt, 0, 0.6)) + ')'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-90, -1400); ctx.lineTo(90, -1400); ctx.closePath(); ctx.fill() }
  ctx.restore()
  const zoom = 1 + L.prog(lt, 1.6, 2.4, 'inOutCubic') * 0.12
  burger(ctx, W / 2, H * 0.58 + Math.sin(lt * 3) * 6, 1.1 * zoom, (k) => {
    const a = 0.15 + k * 0.17
    return { fall: L.prog(lt, a, a + 0.22, 'inQuad'), land: L.clamp((lt - a - 0.22) / 0.25) }
  })
  caption(ctx, '04', 'Montado na hora.', lt)
}

// 5 · No saco e saindo
function bag(ctx, lt, d) {
  const x = pushX(lt, d, true, false)
  bg(ctx, '#2A211B', x)
  ctx.save(); ctx.translate(x, 0)
  const out = L.prog(lt, 1.6, 2.0, 'inExpo')
  const bx = W / 2 + out * 1500, by = H * 0.58
  // Linhas de velocidade quando sai
  if (lt > 1.5) {
    ctx.strokeStyle = 'rgba(255,241,220,0.35)'; ctx.lineWidth = 10; ctx.lineCap = 'round'
    for (let k = 0; k < 8; k++) { const yy = H * 0.42 + k * 60, len = 200 + L.rand(k) * 300, off = ((lt * 2200 + L.rand(k + 9) * W) % (W + len)) - len; ctx.beginPath(); ctx.moveTo(W - off, yy); ctx.lineTo(W - off - len, yy); ctx.stroke() }
  }
  L.at(ctx, bx, by, { rotate: out * 0.2 }, (c) => {
    // Fundo do saco, o lanche caindo dentro, depois a frente
    c.fillStyle = '#A8723F'; L.roundRect(c, -260, -330, 520, 620, 18); c.fill()
    const fall = L.prog(lt, 0.2, 0.55, 'inQuad')
    if (fall < 1 || lt < 0.9) burger(c, 0, -120 - (1 - fall) * 900 + fall * 160, 0.55)
    c.fillStyle = '#C8955C'; L.roundRect(c, -260, -100, 520, 390, 18); c.fill()
    // Aba que fecha
    const fold = L.prog(lt, 0.75, 1.05, 'outBack')
    c.save(); c.translate(0, -330); c.scale(1, 1 - 2 * fold * 0.5)
    c.fillStyle = '#B98249'; L.roundRect(c, -260, 0, 520, 230, 18); c.fill(); c.restore()
    // Selo da marca
    const st = L.ease.outBack(L.prog(lt, 1.05, 1.35))
    L.at(c, 0, 80, { scale: st, rotate: -0.12 }, (s) => { s.fillStyle = RED; L.circle(s, 0, 0, 110); s.fill(); L.text(s, BRAND.slice(0, 1).toUpperCase(), 0, 6, { ...BIG, size: 120, color: '#fff' }) })
  })
  L.letters(ctx, lt < 1.6 ? 'Saiu quentinho.' : 'A caminho…', W / 2, H * 0.26, lt < 1.6 ? L.prog(lt, 0.3, 1.0) : L.prog(lt, 1.85, 2.5), { ...HAND, size: 90, color: CREAM, mode: 'write', span: 0.22 })
  ctx.restore()
}

// 6 · A mordida
let off = null
function bite(ctx, lt) {
  bg(ctx, CREAM)
  reveal(ctx, W / 2, H * 0.5, 1 - L.prog(lt, 0, 0.35), '#2A211B')
  if (!off) off = new OffscreenCanvas(W, Math.ceil(H))
  const o = off.getContext('2d')
  o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, H); o.globalCompositeOperation = 'source-over'
  const s = L.ease.outBack(L.prog(lt, 0.1, 0.5))
  burger(o, W / 2, H * 0.52 + Math.sin(lt * 2.5) * 8, 1.25 * s)
  // Três dentadas no canto de cima à direita
  const B = 0.95
  if (lt > B) {
    o.globalCompositeOperation = 'destination-out'
    const k = L.ease.outExpo(L.prog(lt, B, B + 0.12))
    for (const [dx, dy, r] of [[300, -170, 120], [380, -40, 110], [240, -260, 90]]) { o.beginPath(); o.arc(W / 2 + dx, H * 0.52 + dy, r * k, 0, Math.PI * 2); o.fill() }
    o.globalCompositeOperation = 'source-over'
  }
  const sh = L.shake(lt, B, 0.25, 12, 11)
  ctx.drawImage(off, sh.x, sh.y)
  // Migalhas
  const k = lt - B
  if (k > 0 && k < 1.2) for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 3 ? '#D98A35' : '#F6B453'
    L.circle(ctx, W / 2 + 330 + (L.rand(i) - 0.3) * 260 * k, H * 0.42 + 900 * k * k - 200 * k * L.rand(i + 4), 9 * (1 - k / 1.2)); ctx.fill()
  }
  L.letters(ctx, 'Valeu a espera.', W / 2, H * 0.22, L.prog(lt, 1.3, 2.0), { ...HAND, size: 100, color: INK, mode: 'write', span: 0.22 })
  for (let i = 0; i < 5; i++) {
    const st = L.ease.outBack(L.prog(lt, 2.1 + i * 0.08, 2.4 + i * 0.08))
    ctx.fillStyle = CHEESE
    L.at(ctx, W / 2 + (i - 2) * 110, H * 0.82, { scale: st, rotate: (1 - st) * 1.5 }, (c) => { L.star(c, 0, 0, 5, 44, 19); c.fill() })
  }
}

// 7 · O combo
function combo(ctx, lt) {
  bg(ctx, RED)
  reveal(ctx, W / 2, H * 0.5, 1, RED)
  const beat = env.beat(S7[0] + lt)
  const bp = 1 + 0.05 * Math.pow(1 - beat.phase, 3)
  ;['COMBO', 'SMASH'].forEach((w, i) => {
    const s = L.ease.outBack(L.prog(lt, 0.05 + i * 0.25, 0.35 + i * 0.25))
    const sh = L.shake(lt, 0.35 + i * 0.25, 0.25, 12, 20 + i)
    L.at(ctx, W / 2 + sh.x, H * 0.14 + i * 175 + sh.y, { scale: s }, (c) => L.text(c, w, 0, 0, { ...BIG, italic: true, size: 190, color: i ? CHEESE : '#fff', spacing: -6 }))
  })
  burger(ctx, W / 2, H * 0.53 + Math.sin(lt * 3) * 8, 0.95 * L.ease.outBack(L.prog(lt, 0.4, 0.8)))
  // Etiqueta de preço com estrela girando
  const tp = L.ease.outBack(L.prog(lt, 1.0, 1.3))
  const sh = L.shake(lt, 1.3, 0.25, 14, 31)
  L.at(ctx, W * 0.74 + sh.x, H * 0.66 + sh.y, { scale: tp * bp, rotate: -0.12 }, (c) => {
    c.save(); c.rotate(lt * 0.6); c.fillStyle = CHEESE; L.star(c, 0, 0, 14, 200, 165); c.fill(); c.restore()
    L.text(c, 'R$', 0, -70, { ...BIG, size: 46, color: INK })
    L.text(c, '39,90', 0, 6, { ...BIG, size: 104, color: INK, spacing: -4 })
  })
  const lp = L.prog(lt, 1.4, 1.8, 'outExpo')
  ctx.globalAlpha = lp
  L.text(ctx, '+ batata + refri', W / 2, H * 0.79 + (1 - lp) * 30, { ...HAND, size: 70, color: '#fff' })
  ctx.globalAlpha = 1
  const b = L.ease.outBack(L.prog(lt, 1.7, 2.0)) * bp
  L.at(ctx, W / 2, H * 0.87, { scale: b }, (c) => {
    c.fillStyle = '#fff'; L.roundRect(c, -300, -72, 600, 144, 72); c.fill()
    L.text(c, 'PEÇA AGORA', 0, 4, { ...BIG, size: 60, color: RED })
  })
  ctx.globalAlpha = L.prog(lt, 2.0, 2.4)
  L.text(ctx, BRAND + ' · link na bio', W / 2, H * 0.95, { ...BIG, weight: 800, size: 40, color: '#fff' })
  ctx.globalAlpha = 1
  flash(ctx, L.pulse(lt, 0.35, 0.18) * 0.7)
}
`

/**
 * Motion avançado de um criativo, sem IA: coreografia automática sobre as peças
 * do post (env.post). Mantém a ordem e o ritmo do que o post já tinha e eleva:
 * transição contínua com profundidade entre slides, entradas com desfoque,
 * título com impacto, fundos em zoom lento, botão pulsando na batida, rastro de
 * velocidade nas passagens. É o ponto de partida que o prompt avançado ajusta.
 */
export const POST_SCENE = String.raw`// Motion avançado do criativo · coreografia automática
const post = env.post
const W = env.width, H = env.height
const L = lib
const T = 0.5
const beat = 60 / (env.bpm || 120)

// Tempo de cada slide: o que o post já tinha (mínimo 2,6 s), ajustado à duração da cena
const plan = []
let total = 0
if (post) {
  post.slides.forEach((s, i) => { const d = Math.max(2.6, s.dur); plan.push({ s, a: total, d }); total += d - (i < post.slides.length - 1 ? T : 0) })
  const k = env.duration / Math.max(0.1, total)
  plan.forEach((p) => { p.a *= k; p.d *= k })
}

// Peças de cada slide: título (maior texto), botões (forma pequena com texto dentro), fundo
for (const p of plan) {
  const texts = p.s.layers.filter((l) => l.type === 'text' && !l.background)
  const biggest = Math.max(0, ...texts.map((l) => l.size || 0))
  const inside = (a, b) => b.cx > a.x && b.cx < a.x + a.w && b.cy > a.y && b.cy < a.y + a.h
  for (const l of p.s.layers) {
    l.title = l.type === 'text' && (l.size || 0) >= biggest * 0.85
    l.button = l.type === 'rect' && !l.background && l.h < H * 0.14 && l.w < W * 0.9 && texts.some((t) => inside(l, t))
  }
  for (const l of p.s.layers) l.inButton = l.type === 'text' && p.s.layers.some((b) => b.button && inside(b, l))
  // Entrada: o início que a camada já tinha, senão a ordem de leitura
  const content = p.s.layers.filter((l) => !l.background).sort((a, b) => a.order - b.order)
  content.forEach((l, i) => { l.enter = l.motion && l.motion.fx !== 'ken' ? Math.min(p.d - 1, l.motion.start) : 0.25 + i * 0.13 })
  for (const l of p.s.layers) if (l.inButton) { const b = p.s.layers.find((x) => x.button && inside(x, l)); if (b) l.enter = b.enter + 0.12 }
}

const transitions = plan.slice(1).map((p) => [p.a - 0.05, p.a + T + 0.05])

scene({
  fonts: [],
  draw(ctx, t) {
    if (!post) {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H)
      L.text(ctx, 'Abra esta cena a partir de um criativo', W / 2, H / 2, { size: 44, color: '#fff', weight: 700, font: 'Inter' })
      return
    }
    if (transitions.some(([a, b]) => t >= a && t <= b)) L.blurFrame(ctx, t, 4, 1 / 40, frame)
    else frame(ctx, t)
  },
})

function frame(ctx, t) {
  ctx.fillStyle = plan[0].s.background; ctx.fillRect(0, 0, W, H)
  plan.forEach((p, i) => {
    const lt = t - p.a
    if (lt < 0 || lt > p.d) return
    const last = i === plan.length - 1
    const pin = i > 0 ? L.prog(lt, 0, T, 'inOutCubic') : 1
    const pout = last ? 0 : L.prog(lt, p.d - T, p.d, 'inOutCubic')
    // A cena atual sai para a esquerda e a próxima entra da direita, com profundidade
    const shift = W * (1 - pin) - W * pout
    const drift = 1 + 0.035 * L.prog(lt, 0, p.d, 'linear')
    ctx.save()
    ctx.translate(W / 2 + shift, H / 2); ctx.scale(drift, drift); ctx.translate(-W / 2, -H / 2)
    ctx.fillStyle = p.s.background; ctx.fillRect(-4, -4, W + 8, H + 8)
    for (const l of p.s.layers) {
      if (l.background) { L.layer(ctx, l, { scale: 1.08 - 0.08 * L.ease.outCubic(L.prog(lt, 0, p.d)) }); continue }
      draw(ctx, l, lt, p, pin, pout)
    }
    ctx.restore()
  })
  // Clarão curto no meio de cada passagem
  for (const [a] of transitions) { const k = L.pulse(t, a + T * 0.45, 0.2); if (k > 0) { ctx.fillStyle = 'rgba(255,255,255,' + 0.25 * k + ')'; ctx.fillRect(0, 0, W, H) } }
}

function draw(ctx, l, lt, p, pin, pout) {
  const e = L.prog(lt, l.enter, l.enter + (l.title ? 0.8 : 0.65))
  if (e <= 0) return
  // Parallax: o que está na frente anda mais nas passagens
  const depth = l.title ? 0.45 : l.type === 'image' ? 0.15 : 0.3
  const px = -W * depth * (pout - (1 - pin))
  const blurOut = (pout + (1 - pin)) * 10
  let o
  if (l.title) {
    const k = L.ease.outExpo(e)
    o = { x: px, y: 40 * (1 - k), scale: 1.25 - 0.25 * k, alpha: k, blur: 16 * (1 - k) + blurOut }
  } else if (l.button || l.inButton) {
    const k = L.ease.outBack(e)
    const b = env.beat(p.a + lt)
    const pulse = e >= 1 ? 1 + 0.045 * Math.pow(1 - b.phase, 3) : 1
    o = { x: px, scale: k * pulse, alpha: L.clamp(e * 2) }
  } else if (l.type === 'text') {
    const k = L.ease.outExpo(e)
    o = { x: px, y: 50 * (1 - k), alpha: k, blur: 10 * (1 - k) + blurOut, reveal: L.ease.outCubic(L.clamp(e * 1.4)), from: 'up' }
  } else if (l.type === 'image') {
    const k = L.ease.outBack(e)
    o = { x: px, scale: 0.85 + 0.15 * k, rotate: -0.04 * (1 - k), alpha: L.clamp(e * 1.6), blur: 12 * (1 - L.ease.outCubic(e)) + blurOut }
  } else {
    o = { x: px, reveal: L.ease.outExpo(e), from: l.w > l.h ? 'left' : 'up', alpha: 1 }
  }
  L.layer(ctx, l, o)
}
`
