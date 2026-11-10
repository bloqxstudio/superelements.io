import { emptyExplainer, type ExplainerBeat, type ExplainerData, type SfxId, type TransitionId } from './types'

/**
 * Comercial animado (2026-11-08, o usuário mandou o reel de uma agência, tipografia cinética em
 * amarelo, preto e branco, com moeda 3D, selo em círculo, cartões numerados, celular, ranking e
 * orçamento: "recrie exatamente como é, com esse nível de animação… dentro do app, como um novo
 * vídeo, usando o motor do vídeo explicativo").
 *
 * É um estilo do vídeo explicativo (`look: 'comercial'`): cada cena tem um plano (`shot`) com a
 * coreografia pronta, e o texto, o ícone, a foto e a superfície vêm do roteiro. Tudo sai da marca
 * da conta (fontes, tinta, papel, destaque, logo); a palavra entre *asteriscos* sai na fonte e na
 * cor de destaque. O texto entra quando a palavra é falada (narração), ou no tempo do plano.
 */
export const SHOTS = {
  abertura: { label: 'Abertura', hint: 'Palavras caindo com desfoque e um ícone que balança.' },
  objeto3d: { label: 'Objeto 3D', hint: 'Um símbolo 3D girando, uma linha pequena e a frase grande.' },
  tipo: { label: 'Palavra com ícone', hint: 'Linha pequena com uma seta que vai até o ícone; a palavra grande embaixo.' },
  digitado: { label: 'Frase digitada', hint: 'Frase pequena palavra por palavra, o destaque com marca-texto.' },
  passagem: { label: 'Passagem', hint: 'A palavra gigante atravessa a tela e pousa, com símbolos 3D atrás.' },
  selo: { label: 'Selo', hint: 'Círculo que se desenha com duas linhas dentro e um rabisco embaixo.' },
  frase: { label: 'Frase curta', hint: 'Poucas palavras no centro, com desfoque.' },
  cartao: { label: 'Cartão numerado', hint: 'Cartão com número, ícone e título sobre fundo cortado na diagonal.' },
  logo: { label: 'Logo', hint: 'O logo da marca se monta, com uma linha pequena embaixo.' },
  destaque: { label: 'Marca-texto', hint: 'A frase se abre e a palavra de destaque ganha uma faixa.' },
  celular: { label: 'Celular', hint: 'Um celular sobe com a foto rolando na tela e o título em cima.' },
  chuva3d: { label: 'Símbolos 3D', hint: 'Símbolos 3D voando em profundidade e a frase grande.' },
  escudo: { label: 'Escudo', hint: 'Círculo com um escudo e a frase.' },
  ranking: { label: 'Ranking', hint: 'Você em primeiro, os outros embaixo, um clique e confete.' },
  orcamento: { label: 'Orçamento', hint: 'Botão deslizante com cursor e um avião de papel.' },
  circulo: { label: 'Círculo', hint: 'Círculo com um ícone e a frase dentro.' },
  assinatura: { label: 'Assinatura', hint: 'O logo se monta grande sobre a textura e some.' },
} as const
export type ShotId = keyof typeof SHOTS

export const SURFACES = { tinta: 'Tinta', papel: 'Papel', branco: 'Branco', tom: 'Tom do destaque', destaque: 'Destaque' } as const
export type SurfaceId = keyof typeof SURFACES

export const COMMERCIAL_SCENE = String.raw`
const rgbOf = (h) => { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const rgba = (h, a) => { const [r, g, b] = rgbOf(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')' }
const lum = (h) => { const [r, g, b] = rgbOf(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const B = () => env.data.brand
const HEAD = () => B().heading, EMPH = () => B().emphasis
const P = lib.prog, E = lib.ease, C = lib.clamp

// ——— Superfícies ———
function surf(kind) {
  const b = B()
  if (kind === 'tinta') return { kind, bg: b.ink, fg: b.paper, soft: rgba(b.paper, 0.55), accent: b.accentOnDark, card: lib.mix(b.ink, '#ffffff', 0.07), dark: true }
  if (kind === 'destaque') return { kind, bg: b.accent, fg: b.onAccent, soft: rgba(b.onAccent, 0.7), accent: b.onAccent, card: lib.mix(b.accent, '#000000', 0.25), dark: lum(b.accent) < 0.4 }
  if (kind === 'tom') return { kind, bg: lib.mix(b.accent, b.paper, 0.86), fg: b.ink, soft: rgba(b.ink, 0.55), accent: b.accentOnLight, card: '#ffffff', dark: false }
  if (kind === 'branco') return { kind, bg: '#ffffff', fg: b.ink, soft: rgba(b.ink, 0.5), accent: b.accentOnLight, card: b.paper, dark: false }
  return { kind: 'papel', bg: b.paper, fg: b.ink, soft: rgba(b.ink, 0.55), accent: b.accentOnLight, card: '#ffffff', dark: false }
}
const DEF_SURF = { abertura: 'tom', objeto3d: 'branco', tipo: 'tinta', digitado: 'tinta', passagem: 'tinta', selo: 'tinta', frase: 'tinta', cartao: 'tinta', logo: 'branco', destaque: 'branco', celular: 'branco', chuva3d: 'branco', escudo: 'branco', ranking: 'branco', orcamento: 'branco', circulo: 'tom', assinatura: 'tom' }
// Cena sem plano (roteiro da IA, tela final): o plano pelo tipo da cena
const PATTERN_SHOT = { gancho: 'abertura', titulo: 'frase', icone: 'escudo', lista: 'cartao', numero: 'chuva3d', comparar: 'ranking', processo: 'cartao', foto: 'celular', pergunta: 'selo', citacao: 'digitado', cta: 'circulo' }
const shotOf = (b) => b.shot || (b.id === 'end-card' || b.fullScreen ? 'assinatura' : PATTERN_SHOT[b.pattern] || 'frase')
const surfOf = (b) => surf(b.surface || DEF_SURF[shotOf(b)] || 'papel')

// ——— Texto com destaque (*palavra*) ———
// Os asteriscos podem abraçar várias palavras: "*cara de...*"
function parse(str) {
  const out = []
  let on = false
  for (const w of String(str || '').split(/\s+/).filter(Boolean)) {
    const open = w.startsWith('*'), close = /\*[.,!?:;…]*$/.test(w) && (w.length > 1 || !open)
    if (open) on = true
    out.push({ text: w.replace(/\*/g, ''), emph: on })
    if (close) on = false
  }
  return out
}
function fontOf(tok, o) {
  if (tok.emph && o.emph !== false) {
    const serif = EMPH() !== HEAD()
    return { font: EMPH(), size: o.size * (serif ? (o.emphScale || 1.14) : 1), weight: serif ? 400 : (o.weight || 800), italic: serif && !!B().emphasisItalic, spacing: serif ? -o.size * 0.01 : (o.spacing || 0) }
  }
  return { font: o.font || HEAD(), size: o.size, weight: o.weight || 700, spacing: o.spacing === undefined ? -o.size * 0.035 : o.spacing }
}
function measureLine(ctx, toks, o) {
  const sp = lib.measure(ctx, ' ', { font: o.font || HEAD(), size: o.size, weight: o.weight || 700 }) * (o.gap || 1)
  let w = 0
  const items = toks.map((t, i) => { const f = fontOf(t, o); const tw = lib.measure(ctx, t.text, f); const it = { ...t, f, w: tw, x: w + (i ? sp : 0) }; w = it.x + tw; return it })
  return { items, width: w }
}
/** Desenha uma linha centrada em (x, y); cada palavra entra pela sua própria função (p 0..1). */
function line(ctx, str, x, y, o) {
  const toks = parse(str)
  if (!toks.length) return { width: 0, items: [] }
  let L = measureLine(ctx, toks, o)
  if (o.maxW && L.width > o.maxW) { const k = o.maxW / L.width; o = { ...o, size: o.size * k }; L = measureLine(ctx, toks, o) }
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - L.width : x - L.width / 2
  L.items.forEach((it, i) => {
    const p = o.wordP ? o.wordP(i, it) : 1
    if (p <= 0) return
    const color = it.emph && o.emph !== false ? (o.emphColor || o.accent) : (o.color || '#000')
    const cx = x0 + it.x + it.w / 2
    const mode = o.mode || 'blur'
    ctx.save()
    if (mode === 'blur') {
      const k = 1 - p
      ctx.globalAlpha *= C(p * 1.4)
      if (k > 0.02) ctx.filter = 'blur(' + (k * (o.blur || 26)).toFixed(1) + 'px)'
      ctx.translate(cx, y + k * (o.dy || 0)); ctx.scale(1 + k * (o.grow === undefined ? 0.5 : o.grow), 1 + k * (o.grow === undefined ? 0.5 : o.grow)); ctx.translate(-cx, -y)
    } else if (mode === 'up') {
      ctx.beginPath(); ctx.rect(x0 + it.x - o.size, y - o.size * 0.8, it.w + o.size * 2, o.size * 1.6); ctx.clip()
      ctx.translate(0, (1 - p) * o.size * 1.1)
    } else if (mode === 'drop') {
      const k = 1 - p
      ctx.globalAlpha *= C(p * 2)
      if (k > 0.02) ctx.filter = 'blur(' + (k * 18).toFixed(1) + 'px)'
      ctx.translate(0, -k * o.size * 1.2)
    }
    lib.text(ctx, it.text, x0 + it.x, y, { ...it.f, color, align: 'left', baseline: 'middle' })
    ctx.restore()
  })
  return { width: L.width, items: L.items, x0, size: o.size }
}

/** Quando a palavra é falada, em segundos desde o começo da cena; sem fala, o tempo do plano. */
function wordAt(b, word, fallback) {
  const n = norm(word)
  if (!n || !env.data.words || !env.data.words.length) return fallback
  const w = env.data.words.find((x) => x.s >= b.start - 0.12 && x.s < b.end && norm(x.w) === n)
  return w ? Math.max(0, w.s - b.start - 0.05) : fallback
}
/** Os tempos das palavras de um texto: falada ou o passo do plano. */
function timesOf(b, str, start, step) {
  const toks = parse(str)
  const used = new Set()
  const words = (env.data.words || []).filter((x) => x.s >= b.start - 0.12 && x.s < b.end)
  let prev = -1
  return toks.map((t, i) => {
    const n = norm(t.text)
    const j = words.findIndex((x, k) => !used.has(k) && norm(x.w) === n)
    let at = start + i * step
    if (j >= 0) { used.add(j); at = Math.max(0, words[j].s - b.start - 0.04) }
    at = Math.max(at, prev + 0.04); prev = at
    return at
  })
}
const wp = (times, lt, dur) => (i) => P(lt, times[i] || 0, (times[i] || 0) + (dur || 0.42), 'outExpo')

// ——— Ícones (Lucide, traço) ———
const iconCache = {}
function iconPaths(name) {
  if (iconCache[name]) return iconCache[name]
  const nodes = (env.data.icons || {})[name]
  if (!nodes) return null
  const list = nodes.map(([tag, a]) => {
    const p = new Path2D()
    if (tag === 'path') p.addPath(new Path2D(a.d))
    else if (tag === 'circle') p.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2)
    else if (tag === 'rect') p.roundRect(+a.x, +a.y, +a.width, +a.height, +(a.rx || 0))
    else if (tag === 'line') { p.moveTo(+a.x1, +a.y1); p.lineTo(+a.x2, +a.y2) }
    else if (tag === 'polyline' || tag === 'polygon') { const pts = a.points.trim().split(/[\s,]+/).map(Number); p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); if (tag === 'polygon') p.closePath() }
    else if (tag === 'ellipse') p.ellipse(+a.cx, +a.cy, +a.rx, +a.ry, 0, 0, Math.PI * 2)
    return p
  })
  return (iconCache[name] = list)
}
function icon(ctx, name, cx, cy, size, color, o) {
  o = o || {}
  const paths = iconPaths(name)
  if (!paths) return false
  ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 24, size / 24)
  if (o.fill) { ctx.fillStyle = o.fill; for (const p of paths) ctx.fill(p) }
  ctx.strokeStyle = color; ctx.lineWidth = o.width || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (o.p !== undefined && o.p < 1) ctx.setLineDash([90 * Math.max(0, o.p), 90])
  for (const p of paths) ctx.stroke(p)
  ctx.restore()
  return true
}
function hand(ctx, x, y, s, press, S) {
  // Cursor de mão (o dedo aponta para (x, y))
  lib.at(ctx, x, y, { scale: s * (1 - press * 0.12), rotate: -0.15 }, (c) => {
    c.translate(-11, -2)
    const paths = iconPaths('mao')
    c.save(); c.scale(2.6, 2.6); c.translate(-6, 0)
    if (paths) { c.fillStyle = '#ffffff'; for (const p of paths) c.fill(p); c.strokeStyle = B().ink; c.lineWidth = 1.5; c.lineJoin = 'round'; c.lineCap = 'round'; for (const p of paths) c.stroke(p) }
    c.restore()
  })
}

// ——— Símbolo 3D (glifo extrudado que gira) ———
function glyph3d(ctx, ch, cx, cy, size, angle, o) {
  o = o || {}
  const b = B()
  const face = o.face || b.accent
  const depth = size * 0.16
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const sx = Math.max(0.04, Math.abs(cos))
  const font = { font: HEAD(), size, weight: 900, align: 'center', baseline: 'middle' }
  ctx.save()
  ctx.translate(cx, cy)
  if (o.rot) ctx.rotate(o.rot)
  if (o.blur) ctx.filter = 'blur(' + o.blur.toFixed(1) + 'px)'
  ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha
  // sombra no chão
  if (o.shadow !== false) {
    ctx.save(); ctx.scale(1, 0.18); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.arc(0, size * 3.2, size * 0.42 * (0.6 + sx * 0.4), 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  const steps = Math.max(6, Math.round(depth / 3))
  const dark = lib.mix(face, '#000000', 0.45), mid = lib.mix(face, '#000000', 0.22)
  for (let k = steps; k >= 1; k--) {
    const d = (k / steps) * depth
    ctx.save(); ctx.translate(sin * d * (cos >= 0 ? 1 : -1), d * 0.18); ctx.scale(sx, 1)
    lib.text(ctx, ch, 0, 0, { ...font, color: lib.mix(mid, dark, k / steps) })
    ctx.restore()
  }
  ctx.save(); ctx.scale(sx, 1)
  // a face: degradê com brilho (metal) que corre com o giro
  const g = ctx.createLinearGradient(-size * 0.4, -size * 0.5, size * 0.4, size * 0.5)
  const sh = C(0.5 + sin * 0.5)
  g.addColorStop(0, lib.mix(face, '#ffffff', 0.55))
  g.addColorStop(Math.max(0.01, Math.min(0.98, sh * 0.8)), lib.mix(face, '#ffffff', 0.18))
  g.addColorStop(Math.min(0.99, sh * 0.8 + 0.12), lib.mix(face, '#ffffff', 0.7))
  g.addColorStop(1, lib.mix(face, '#000000', 0.12))
  ctx.font = '900 ' + size + 'px "' + HEAD() + '"'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = g; ctx.fillText(ch, 0, 0)
  ctx.restore()
  ctx.restore()
}

// ——— Fundos ———
function backdrop(ctx, S, W, H, t, u, b) {
  ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H)
  if (S.dark) {
    // grade fina, como papel milimetrado no escuro, com vinheta
    ctx.strokeStyle = rgba(S.fg, 0.035); ctx.lineWidth = 1.5 * u
    const step = 96 * u, off = (t * 8 * u) % step
    ctx.beginPath()
    for (let x = -step + off; x < W + step; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H) }
    for (let y = -step + off; y < H + step; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y) }
    ctx.stroke()
    const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.12, W / 2, H * 0.5, H * 0.75)
    g.addColorStop(0, rgba(S.fg, 0.018)); g.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else {
    // textura: o ponto da marca repetido em diagonal, bem apagado, andando devagar
    const step = 150 * u, off = (t * 10 * u) % step
    ctx.fillStyle = rgba(S.fg, S.kind === 'tom' ? 0.05 : 0.035)
    for (let y = -step; y < H + step; y += step) for (let x = -step; x < W + step; x += step) {
      const odd = Math.round((y + step) / step) % 2
      ctx.save(); ctx.translate(x + off + (odd ? step / 2 : 0), y + off * 0.5); ctx.rotate(Math.PI / 4)
      ctx.fillRect(-9 * u, -9 * u, 18 * u, 18 * u); ctx.restore()
    }
    const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.1, W / 2, H * 0.5, H * 0.8)
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, rgba(S.fg, 0.07))
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }
}

function logoImg(S) { return env.images[S.dark ? '__logo_dark' : '__logo_light'] || env.images[S.dark ? '__logo_light' : '__logo_dark'] || null }

/** O logo se monta: o ponto da marca aparece, cresce e o logo se abre a partir dele. */
function logoBuild(ctx, S, cx, cy, h, lt, u, o) {
  o = o || {}
  const img = logoImg(S)
  const b = B()
  const p0 = P(lt, 0, 0.35, 'outBack'), p1 = P(lt, 0.25, 0.95, 'outExpo')
  if (img) {
    const w = Math.min((o.maxW || 860 * u), (img.width / img.height) * h)
    const hh = w * img.height / img.width
    // o ponto azul que abre
    if (p1 < 1) {
      const s = 26 * u * (1 - p1 * 0.6)
      ctx.save(); ctx.globalAlpha = 1 - p1; ctx.fillStyle = b.accent
      ctx.translate(cx + (w / 2) * p1, cy); ctx.rotate((1 - p0) * Math.PI / 2); ctx.scale(p0, p0); ctx.fillRect(-s, -s, s * 2, s * 2); ctx.restore()
    }
    ctx.save()
    ctx.beginPath(); ctx.rect(cx + w / 2 - w * p1 - 4, cy - hh, w * p1 + 8, hh * 2); ctx.clip()
    if (p1 < 1) ctx.filter = 'blur(' + ((1 - p1) * 14).toFixed(1) + 'px)'
    ctx.globalAlpha *= C(p1 * 1.6)
    ctx.drawImage(img, cx - w / 2 + (1 - p1) * 60 * u, cy - hh / 2, w, hh)
    ctx.restore()
    return hh
  }
  const size = h
  ctx.save(); ctx.globalAlpha = p1
  lib.text(ctx, b.name, cx, cy, { font: HEAD(), size, weight: 700, color: S.fg, align: 'center', baseline: 'middle', spacing: -size * 0.04 })
  ctx.restore()
  return size
}

function tagline(ctx, str, cx, y, lt, at, S, u, size) {
  if (!str) return
  const p = P(lt, at, at + 0.6, 'outExpo')
  if (p <= 0) return
  const sp = (size || 22) * u
  ctx.save(); ctx.globalAlpha = p
  lib.text(ctx, String(str).toUpperCase(), cx, y, { font: HEAD(), size: sp, weight: 600, color: S.accent, align: 'center', baseline: 'middle', spacing: sp * (0.2 + 0.25 * (1 - p)) })
  ctx.restore()
}

// curva com tracejado (decoração)
function dashedCurve(ctx, pts, p, color, w, u) {
  ctx.save(); ctx.setLineDash([14 * u, 14 * u]); lib.path(ctx, pts, p, { color, width: w }); ctx.restore()
}
function curvePts(x0, y0, x1, y1, bend, n) {
  const out = []
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend
  for (let i = 0; i <= (n || 30); i++) { const s = i / (n || 30); out.push([(1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * mx + s * s * x1, (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * my + s * s * y1]) }
  return out
}
function scribble(ctx, x, y, w, p, color, u) {
  const pts = []
  const n = 7
  for (let i = 0; i <= n * 4; i++) { const s = i / (n * 4); pts.push([x + s * w, y + Math.sin(s * Math.PI * n) * 14 * u + s * 6 * u]) }
  lib.path(ctx, pts, p, { color, width: 6 * u })
}
function plane(ctx, x, y, s, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s)
  ctx.fillStyle = color
  ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(-36, -30); ctx.lineTo(-18, 0); ctx.lineTo(-36, 30); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(-18, 0); ctx.lineTo(-30, 22); ctx.closePath(); ctx.fill()
  ctx.restore()
}
function ring(ctx, cx, cy, r, p, color, w) {
  if (p <= 0) return
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p)); ctx.stroke(); ctx.restore()
}
function confetti(ctx, cx, cy, lt, at, u, colors) {
  const k = lt - at
  if (k <= 0 || k > 1.6) return
  for (let i = 0; i < 34; i++) {
    const a = lib.rand(i * 3.1) * Math.PI * 2, sp = (280 + lib.rand(i * 7.7) * 520) * u
    const x = cx + Math.cos(a) * sp * E.outCubic(C(k / 0.9)), y = cy + Math.sin(a) * sp * E.outCubic(C(k / 0.9)) + k * k * 240 * u
    ctx.save(); ctx.globalAlpha = C(1.6 - k * 1.2); ctx.translate(x, y); ctx.rotate(k * 8 + i)
    ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(-6 * u, -3 * u, 12 * u, 6 * u); ctx.restore()
  }
}

// ——— Os planos ———
const SH = {}
const CX = () => env.width / 2

SH.abertura = (ctx, b, lt, dur, S, u, W, H) => {
  const words = parse(b.headline)
  const times = timesOf(b, b.headline, 0.02, 0.16)
  const size = 92 * u
  const L = line(ctx, b.headline, W / 2 - (b.icon ? 40 * u : 0), H * 0.5, { size, weight: 800, color: S.fg, accent: S.accent, grow: 1.6, blur: 40, wordP: wp(times, lt, 0.5) })
  if (b.icon) {
    const at = (times[words.length - 1] || 0) + 0.12
    const p = P(lt, at, at + 0.4, 'outBack')
    if (p > 0) {
      const x = (L.x0 || 0) + L.width + 70 * u
      const wob = Math.sin((lt - at) * 14) * 0.25 * Math.exp(-(lt - at) * 2.5)
      lib.at(ctx, x, H * 0.5 - 6 * u, { scale: p, rotate: -0.25 + wob }, (c) => icon(c, b.icon, 0, 0, 84 * u, S.fg, { fill: S.accent, width: 1.8 }))
    }
  }
}

SH.objeto3d = (ctx, b, lt, dur, S, u, W, H) => {
  const p = P(lt, 0, 0.9, 'outCubic')
  const ang = (1 - p) * Math.PI * 2.5 + Math.sin(lt * 2.2) * 0.35 * p
  const gy = H * 0.4 + (1 - p) * -260 * u + Math.sin(lt * 2) * 10 * u
  glyph3d(ctx, b.kicker || '$', W / 2, gy, 330 * u * (0.7 + p * 0.3), ang, { blur: (1 - p) * 26, alpha: C(p * 2) })
  const t1 = timesOf(b, b.headline, 0.15, 0.12)
  line(ctx, b.headline, W / 2, H * 0.555, { size: 60 * u, weight: 600, color: S.fg, accent: S.accent, wordP: wp(t1, lt), grow: 0.8 })
  const t2 = timesOf(b, b.sub, 0.35, 0.16)
  line(ctx, b.sub, W / 2, H * 0.615, { size: 104 * u, weight: 800, color: S.accent, accent: S.accent, emphColor: S.fg, wordP: wp(t2, lt, 0.5), grow: 1.1, blur: 34 })
}

SH.tipo = (ctx, b, lt, dur, S, u, W, H) => {
  const y1 = H * 0.462, y2 = H * 0.53
  const t1 = timesOf(b, b.headline, 0.05, 0.12)
  const L1 = line(ctx, b.headline, W * 0.3, y1, { size: 48 * u, weight: 500, color: S.fg, accent: S.accent, align: 'left', mode: 'up', wordP: wp(t1, lt) })
  // a seta em degrau que vai até o ícone
  const ax = W * 0.3 + L1.width + 22 * u, bx = W * 0.6
  const pa = P(lt, 0.18, 0.55, 'outCubic')
  lib.path(ctx, [[ax, y1 + 10 * u], [ax + 40 * u, y1 + 10 * u], [ax + 40 * u, y1 - 16 * u], [bx - 46 * u, y1 - 16 * u], [bx - 46 * u, y1 + 8 * u]], pa, { color: S.fg, width: 4 * u })
  const pb = P(lt, 0.4, 0.75, 'outBack')
  if (pb > 0) lib.at(ctx, bx + 30 * u, y1 - 18 * u, { scale: pb }, (c) => {
    c.strokeStyle = S.fg; c.lineWidth = 5 * u; lib.roundRect(c, -52 * u, -42 * u, 104 * u, 84 * u, 10 * u); c.stroke()
    icon(c, b.icon || 'video', 0, 0, 52 * u, S.fg, { width: 2.2 })
  })
  const word = String(b.sub || '')
  const pw = P(lt, wordAt(b, word.replace(/\*/g, ''), 0.42), wordAt(b, word.replace(/\*/g, ''), 0.42) + 0.5, 'linear')
  const shown = word.replace(/\*/g, '').slice(0, Math.ceil(word.replace(/\*/g, '').length * E.outQuad(pw)))
  if (shown) lib.text(ctx, shown, W * 0.3 - 4 * u, y2, { font: EMPH() !== HEAD() ? EMPH() : HEAD(), italic: EMPH() !== HEAD() && !!B().emphasisItalic, size: (EMPH() !== HEAD() ? 190 : 160) * u, weight: EMPH() !== HEAD() ? 400 : 800, color: S.accent, align: 'left', baseline: 'middle', spacing: -4 * u })
  // faísca
  const ps = P(lt, 0.5, 0.8, 'outBack')
  if (ps > 0) lib.at(ctx, W * 0.3 - 34 * u, y2 - 30 * u, { scale: ps, rotate: lt * 2 }, (c) => { c.fillStyle = S.accent; c.fillRect(-10 * u, -10 * u, 20 * u, 20 * u) })
}

SH.digitado = (ctx, b, lt, dur, S, u, W, H) => {
  const toks = parse(b.headline)
  const times = timesOf(b, b.headline, 0.05, 0.2)
  const size = 58 * u
  const o = { size, weight: 600, color: S.fg, accent: S.accent }
  const L = measureLine(ctx, toks, o)
  const x0 = W / 2 - L.width / 2, y = H * 0.5
  L.items.forEach((it, i) => {
    const at = times[i]
    const p = P(lt, at, at + 0.3, 'outExpo')
    if (p <= 0) return
    if (it.emph) {
      // marca-texto que passa antes da palavra
      const pb = P(lt, at - 0.05, at + 0.22, 'outCubic')
      const pe = P(lt, at + 0.22, at + 0.45, 'inOutCubic')
      const bx = x0 + it.x - 6 * u, bw = it.w + 12 * u
      ctx.fillStyle = S.accent
      ctx.fillRect(bx + bw * pe, y - size * 0.42, bw * (pb - pe), size * 0.84)
    }
    ctx.save(); ctx.globalAlpha = P(lt, at + (it.emph ? 0.2 : 0), at + (it.emph ? 0.4 : 0.2))
    lib.text(ctx, it.text, x0 + it.x, y + (1 - p) * 20 * u, { ...it.f, color: it.emph ? S.accent : S.fg, align: 'left', baseline: 'middle' })
    ctx.restore()
  })
}

SH.passagem = (ctx, b, lt, dur, S, u, W, H) => {
  const cut = Math.min(0.62, dur * 0.42)
  const word = String(b.headline || '').replace(/\*/g, '')
  if (lt < cut) {
    // a palavra gigante atravessa a tela, com rastro
    const k = lt / cut
    const x = lib.lerp(W * 1.15, -W * 0.85, E.inOutCubic(k))
    const v = Math.abs(Math.sin(k * Math.PI))
    for (let g = 5; g >= 0; g--) {
      ctx.save(); ctx.globalAlpha = g ? 0.12 * v : 1
      lib.text(ctx, word, x + g * 46 * u * v, H * 0.5, { font: HEAD(), size: 300 * u, weight: 800, color: S.fg, align: 'left', baseline: 'middle', spacing: -12 * u })
      ctx.restore()
    }
    glyph3d(ctx, b.kicker || '$', lib.lerp(W * 1.6, -W * 0.3, E.inOutCubic(C(k * 1.1))), H * 0.3, 380 * u, k * 6, { blur: 18 * v, shadow: false })
    return
  }
  const l = lt - cut
  const p = P(l, 0, 0.55, 'outExpo')
  // símbolos 3D atrás
  glyph3d(ctx, b.kicker || '$', W / 2 - 50 * u, H * 0.415 - (1 - p) * 120 * u, 230 * u * (0.6 + 0.4 * p), (1 - p) * 4 + Math.sin(l * 2) * 0.3 + 0.35, { alpha: p, blur: (1 - p) * 20, shadow: false })
  glyph3d(ctx, b.kicker || '$', W / 2 + 70 * u, H * 0.415 - (1 - p) * 80 * u, 250 * u * (0.6 + 0.4 * p), (1 - p) * 5 + Math.sin(l * 2 + 1) * 0.3 - 0.2, { alpha: p, blur: (1 - p) * 20, shadow: false })
  line(ctx, b.headline, W / 2 + 10 * u, H * 0.47, { size: 58 * u, weight: 500, color: S.fg, accent: S.accent, wordP: () => p, grow: 2 })
  const t2 = timesOf(b, b.sub, cut + 0.1, 0.12).map((x) => x - cut)
  line(ctx, b.sub, W / 2, H * 0.525, { size: 128 * u, weight: 800, color: S.accent, accent: S.accent, wordP: wp(t2, l, 0.5), grow: 0.9, blur: 30 })
  // seta curva à esquerda
  const pa = P(l, 0.15, 0.6, 'outCubic')
  const ax = W / 2 - 230 * u
  lib.path(ctx, curvePts(ax + 60 * u, H * 0.455, ax - 10 * u, H * 0.485, 0.5, 20), pa, { color: S.fg, width: 4 * u })
}

SH.selo = (ctx, b, lt, dur, S, u, W, H) => {
  const p = P(lt, 0, 0.55, 'outExpo')
  const out = P(lt, dur - 0.35, dur, 'inCubic')
  const cx = W / 2, cy = H * 0.5, r = 300 * u
  const sc = (1.5 - 0.5 * p) * (1 - out * 0.15)
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy); ctx.globalAlpha *= 1 - out * 0.7
  if (p < 1) ctx.filter = 'blur(' + ((1 - p) * 16).toFixed(1) + 'px)'
  // brilho e anéis
  const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.25)
  g.addColorStop(0, rgba(S.accent, 0)); g.addColorStop(0.8, rgba(S.accent, 0.1)); g.addColorStop(1, rgba(S.accent, 0))
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2); ctx.fill()
  ring(ctx, cx, cy, r, P(lt, 0, 0.6, 'outCubic'), S.accent, 5 * u)
  ring(ctx, cx, cy, r * 1.16, P(lt, 0.1, 0.8, 'outCubic') * 0.999, rgba(S.accent, 0.18), 2 * u)
  ctx.filter = 'none'
  const t1 = timesOf(b, b.headline, 0.1, 0.12)
  const L1 = line(ctx, b.headline, cx - 10 * u, cy - 56 * u, { size: 70 * u, weight: 800, color: S.fg, accent: S.fg, emph: true, emphColor: S.fg, wordP: wp(t1, lt), grow: 0.7 })
  if (b.icon) {
    const pi = P(lt, 0.3, 0.6, 'outBack')
    if (pi > 0) lib.at(ctx, (L1.x0 || cx) + L1.width + 50 * u, cy - 80 * u, { scale: pi, rotate: Math.sin(lt * 3) * 0.12 }, (c) => icon(c, b.icon, 0, 0, 70 * u, S.accent, { width: 2.4 }))
  }
  const t2 = timesOf(b, b.sub, 0.25, 0.1)
  const L2 = line(ctx, b.sub, cx, cy + 40 * u, { size: 128 * u, weight: 800, color: S.accent, accent: S.accent, emphColor: S.accent, wordP: wp(t2, lt, 0.5), grow: 0.6 })
  scribble(ctx, cx - L2.width * 0.15, cy + 112 * u, L2.width * 0.62, P(lt, (t2[0] || 0.25) + 0.25, (t2[0] || 0.25) + 0.7, 'outCubic'), S.fg, u)
  ctx.restore()
}

SH.frase = (ctx, b, lt, dur, S, u, W, H) => {
  const times = timesOf(b, b.headline, 0.04, 0.16)
  const out = P(lt, dur - 0.3, dur, 'inCubic')
  ctx.save(); ctx.globalAlpha *= 1 - out
  if (out > 0) ctx.filter = 'blur(' + (out * 18).toFixed(1) + 'px)'
  line(ctx, b.headline, W / 2, H * 0.5, { size: (b.sub ? 64 : 76) * u, weight: 700, color: S.fg, accent: S.accent, wordP: wp(times, lt, 0.45), grow: 1.2 })
  if (b.sub) {
    const t2 = timesOf(b, b.sub, 0.3, 0.12)
    line(ctx, b.sub, W / 2, H * 0.56, { size: 112 * u, weight: 800, color: S.accent, accent: S.accent, wordP: wp(t2, lt, 0.5), grow: 0.8 })
  }
  if (b.icon) {
    const pi = P(lt, 0.25, 0.6, 'outBack')
    if (pi > 0) lib.at(ctx, W / 2, H * 0.43, { scale: pi }, (c) => icon(c, b.icon, 0, 0, 70 * u, S.accent, { width: 2.2 }))
  }
  ctx.restore()
}

SH.cartao = (ctx, b, lt, dur, S, u, W, H) => {
  const bb = B()
  // fundo cortado na diagonal, a cunha na cor de destaque andando
  const d = P(lt, 0, 0.6, 'outExpo')
  const drift = lt * 18 * u
  ctx.fillStyle = bb.accent
  ctx.beginPath(); ctx.moveTo(W, H * (0.2 - 0.12 * d) - drift); ctx.lineTo(W, H); ctx.lineTo(W * (0.05 + 0.25 * (1 - d)), H); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(0, H * 0.06); ctx.lineTo(W * 0.2 * d, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill()
  // o cartão
  const p = P(lt, 0, 0.5, 'outExpo')
  const cw = 660 * u, chh = 560 * u, cx = W / 2, cy = H * 0.47 + Math.sin(lt * 1.6) * 8 * u
  const rot = (1 - p) * 0.12 - 0.035 + Math.sin(lt * 1.2) * 0.008
  lib.at(ctx, cx, cy, { scale: 1.45 - 0.45 * p, rotate: rot }, (c) => {
    if (p < 1) c.filter = 'blur(' + ((1 - p) * 18).toFixed(1) + 'px)'
    c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 70 * u; c.shadowOffsetY = 30 * u
    const g = c.createLinearGradient(0, -chh / 2, 0, chh / 2)
    g.addColorStop(0, lib.mix(bb.ink, '#ffffff', 0.1)); g.addColorStop(1, lib.mix(bb.ink, '#000000', 0.2))
    c.fillStyle = g; lib.roundRect(c, -cw / 2, -chh / 2, cw, chh, 34 * u); c.fill()
    c.shadowColor = 'transparent'
    c.strokeStyle = rgba(bb.accentOnDark, 0.85); c.lineWidth = 3 * u; lib.roundRect(c, -cw / 2, -chh / 2, cw, chh, 34 * u); c.stroke()
    c.filter = 'none'
    // número
    const pn = P(lt, 0.12, 0.45, 'outBack')
    if (pn > 0 && b.number) { c.save(); c.globalAlpha = pn; lib.text(c, b.number.value + 'º', -cw / 2 - 6 * u, -chh / 2 - 30 * u, { font: HEAD(), size: 76 * u * (0.6 + 0.4 * pn), weight: 800, color: bb.accentOnDark, align: 'left', baseline: 'middle', spacing: -2 * u }); c.restore() }
    // selo no canto: o ponto da marca num disco
    const ps = P(lt, 0.2, 0.5, 'outBack')
    if (ps > 0) lib.at(c, cw / 2 - 6 * u, -chh / 2 + 6 * u, { scale: ps, rotate: (1 - ps) * 2 }, (k) => {
      k.fillStyle = '#ffffff'; k.beginPath(); k.arc(0, 0, 40 * u, 0, Math.PI * 2); k.fill()
      k.strokeStyle = bb.ink; k.lineWidth = 3 * u; k.beginPath(); k.arc(0, 0, 40 * u, 0, Math.PI * 2); k.stroke()
      k.fillStyle = bb.accent; k.rotate(lt * 1.5); k.fillRect(-11 * u, -11 * u, 22 * u, 22 * u)
    })
    // ícone
    const pi = P(lt, 0.15, 0.5, 'outBack')
    if (pi > 0 && b.icon) lib.at(c, 0, -150 * u, { scale: pi }, (k) => icon(k, b.icon, 0, 0, 92 * u, bb.accentOnDark, { width: 2.2 }))
    const t1 = timesOf(b, b.headline, 0.18, 0.1)
    line(c, b.headline, 0, -48 * u, { size: (String(b.headline).length > 14 ? 40 : 66) * u, weight: 700, color: bb.paper, accent: bb.accentOnDark, wordP: wp(t1, lt), grow: 0.6, maxW: cw - 80 * u })
    const t2 = timesOf(b, b.sub, 0.3, 0.1)
    line(c, b.sub, 0, 48 * u, { size: 104 * u, weight: 800, color: bb.paper, accent: bb.accentOnDark, wordP: wp(t2, lt, 0.5), grow: 0.5, blur: 20, maxW: cw - 70 * u })
    const pc = P(lt, 0.55, 1, 'outCubic')
    if (pc > 0 && b.items && b.items[0]) {
      c.save(); c.globalAlpha = pc * 0.75
      const txt = String(b.items[0])
      const words = txt.split(' '), half = Math.ceil(words.length / 2)
      const lines = txt.length > 30 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [txt]
      lines.forEach((ln, i) => lib.text(c, ln, 0, 140 * u + i * 40 * u, { font: B().body, size: 30 * u, weight: 500, color: bb.paper, align: 'center', baseline: 'middle', spacing: 0.5 * u }))
      c.restore()
    }
  })
}

SH.logo = (ctx, b, lt, dur, S, u, W, H) => {
  const h = logoBuild(ctx, S, W / 2, H * 0.49, 150 * u, lt, u)
  tagline(ctx, b.sub, W / 2, H * 0.49 + h / 2 + 50 * u, lt, 0.55, S, u)
}

SH.destaque = (ctx, b, lt, dur, S, u, W, H) => {
  const toks = parse(b.headline)
  const size = 64 * u
  const o = { size, weight: 700, color: S.fg, accent: S.accent }
  const L = measureLine(ctx, toks, o)
  const pin = P(lt, 0, 0.32, 'outExpo')
  const x0 = W / 2 - L.width / 2, y = H * 0.5
  const out = P(lt, dur - 0.35, dur, 'inCubic')
  ctx.save(); ctx.globalAlpha = 1 - out * 0.85
  // a frase se abre (comprimida e pesada no começo)
  ctx.translate(W / 2, y); ctx.scale(0.25 + 0.75 * pin, 1 + (1 - pin) * 0.9); ctx.translate(-W / 2, -y)
  const times = timesOf(b, b.headline, 0.05, 0.1)
  L.items.forEach((it, i) => {
    const at = times[i]
    const p = P(lt, at, at + 0.3, 'outExpo')
    if (p <= 0) return
    if (it.emph) {
      const pb = P(lt, at + 0.05, at + 0.4, 'outCubic')
      ctx.fillStyle = S.accent; ctx.fillRect(x0 + it.x - 8 * u, y - size * 0.46, (it.w + 16 * u) * pb, size * 0.92)
    }
    ctx.save(); ctx.globalAlpha *= p
    lib.text(ctx, it.text, x0 + it.x, y, { ...it.f, color: it.emph ? (S.dark ? S.bg : '#ffffff') : S.fg, align: 'left', baseline: 'middle' })
    ctx.restore()
  })
  ctx.restore()
}

function phone(ctx, img, cx, cy, w, h, scroll, u, S) {
  const r = 70 * u, bz = 16 * u
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 80 * u; ctx.shadowOffsetY = 40 * u
  ctx.fillStyle = B().ink; lib.roundRect(ctx, cx - w / 2, cy - h / 2, w, h, r); ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2 * u; lib.roundRect(ctx, cx - w / 2 + 3 * u, cy - h / 2 + 3 * u, w - 6 * u, h - 6 * u, r - 3 * u); ctx.stroke()
  const sx = cx - w / 2 + bz, sy = cy - h / 2 + bz, sw = w - bz * 2, shh = h - bz * 2
  ctx.save(); lib.roundRect(ctx, sx, sy, sw, shh, r - bz); ctx.clip()
  ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, sw, shh)
  if (img) {
    const ih = img.height * (sw / img.width)
    const max = Math.max(0, ih - shh)
    ctx.drawImage(img, sx, sy - max * scroll, sw, ih)
  }
  ctx.restore()
  ctx.fillStyle = B().ink; lib.roundRect(ctx, cx - 80 * u, sy + 18 * u, 160 * u, 40 * u, 20 * u); ctx.fill()
  ctx.restore()
}

SH.celular = (ctx, b, lt, dur, S, u, W, H) => {
  const bb = B()
  // faixas inclinadas em cima e embaixo
  const pb = P(lt, 0, 0.45, 'outExpo')
  ctx.fillStyle = bb.accent
  ctx.save(); ctx.translate(W / 2, 0); ctx.rotate(-0.035)
  ctx.fillRect(-W * 0.7 + (1 - pb) * -W, -30 * u, W * 1.4, 70 * u)
  ctx.restore()
  ctx.save(); ctx.translate(W / 2, H); ctx.rotate(-0.035)
  ctx.fillRect(-W * 0.7 + (1 - pb) * W, -50 * u, W * 1.4, 90 * u)
  ctx.restore()
  const p = P(lt, 0, 0.6, 'outExpo')
  const out = P(lt, dur - 0.25, dur, 'inCubic')
  const times = timesOf(b, b.headline, 0.1, 0.12)
  ctx.save(); ctx.globalAlpha *= 1 - out
  line(ctx, b.headline, W / 2, H * 0.155, { size: 76 * u, weight: 800, color: S.fg, accent: S.accent, wordP: wp(times, lt, 0.45), grow: 0.4 })
  const img = b.photo ? env.images[b.photo] : null
  const pw = 600 * u, ph = 1220 * u
  lib.at(ctx, W / 2, H * 0.56 + (1 - p) * 1100 * u, { rotate: (1 - p) * 0.18, scale: 1 + out * 0.08 }, (c) => {
    if (out > 0) c.filter = 'blur(' + (out * 14).toFixed(1) + 'px)'
    phone(c, img, 0, 0, pw, ph, E.inOutCubic(P(lt, 0.4, dur, 'linear')) * 0.55, u, S)
  })
  if (b.sub) {
    const ps = P(lt, 0.45, 0.8, 'outBack')
    if (ps > 0) lib.at(ctx, W / 2, H * 0.82, { scale: ps }, (c) => {
      const txt = String(b.sub).replace(/\*/g, '')
      const w = lib.measure(c, txt, { font: HEAD(), size: 40 * u, weight: 700 }) + 70 * u
      c.fillStyle = bb.accent; lib.roundRect(c, -w / 2, -40 * u, w, 80 * u, 40 * u); c.fill()
      lib.text(c, txt, 0, 2 * u, { font: HEAD(), size: 40 * u, weight: 700, color: bb.onAccent, align: 'center', baseline: 'middle' })
    })
  }
  ctx.restore()
}

SH.chuva3d = (ctx, b, lt, dur, S, u, W, H) => {
  const ch = b.kicker || '$'
  // os de longe (desfocados) e os de perto
  const far = [[0.12, 0.2, 150, 0.9], [0.82, 0.14, 120, 1.7], [0.9, 0.42, 110, 2.3], [0.15, 0.62, 130, 3.1]]
  far.forEach(([x, y, s, ph], i) => {
    const pp = P(lt, 0.05 * i, 0.6 + 0.05 * i, 'outCubic')
    glyph3d(ctx, ch, W * x, H * y + Math.sin(lt * 1.5 + ph) * 18 * u + (1 - pp) * 300 * u, s * u, lt * 1.6 + ph, { alpha: 0.35 * pp, blur: 10, shadow: false })
  })
  const pc = P(lt, 0.15, 0.85, 'outExpo')
  glyph3d(ctx, ch, W * 0.18, H * 0.28 - (1 - pc) * 500 * u, 190 * u, (1 - pc) * 7 + lt * 0.8, { alpha: pc, shadow: false })
  const t1 = timesOf(b, b.headline, 0.05, 0.12)
  const L = line(ctx, b.headline, W / 2, H * 0.45, { size: 62 * u, weight: 700, color: S.fg, accent: S.accent, wordP: wp(t1, lt), grow: 0.7 })
  const pa = P(lt, 0.25, 0.55, 'outBack')
  if (pa > 0) lib.at(ctx, (L.x0 || 0) + L.width + 46 * u, H * 0.43, { scale: pa }, (c) => {
    c.strokeStyle = S.accent; c.lineWidth = 6 * u; c.lineCap = 'round'
    c.beginPath(); c.moveTo(-22 * u, 22 * u); c.lineTo(22 * u, -22 * u); c.moveTo(-4 * u, -22 * u); c.lineTo(22 * u, -22 * u); c.lineTo(22 * u, 4 * u); c.stroke()
  })
  const word = String(b.sub || '').replace(/\*/g, '')
  const at = wordAt(b, word.split(' ')[0], 0.32)
  const pw = P(lt, at, at + 0.45, 'linear')
  const shown = word.slice(0, Math.ceil(word.length * pw))
  if (shown) {
    const serif = EMPH() !== HEAD()
    const f = { font: serif ? EMPH() : HEAD(), italic: serif && !!B().emphasisItalic, size: (serif ? 170 : 140) * u, weight: serif ? 400 : 800, spacing: -3 * u }
    const fw = lib.measure(ctx, word, f)
    lib.text(ctx, shown, W / 2 - fw / 2, H * 0.52, { ...f, color: S.accent, align: 'left', baseline: 'middle' })
  }
  const pb = P(lt, 0.35, 1.05, 'outExpo')
  glyph3d(ctx, ch, W * 0.72, H * 0.7 + (1 - pb) * 700 * u, 420 * u, (1 - pb) * 9 + Math.sin(lt * 1.4) * 0.4, { alpha: C(pb * 2) })
}

SH.escudo = (ctx, b, lt, dur, S, u, W, H) => {
  const bb = B()
  const cx = W / 2, cy = H * 0.5, r = 280 * u
  const p = P(lt, 0.1, 0.7, 'outExpo')
  const out = P(lt, dur - 0.35, dur, 'inCubic')
  ctx.save(); ctx.globalAlpha *= 1 - out * 0.8
  ring(ctx, cx, cy, r * (0.9 + 0.1 * p), p, S.accent, 5 * u)
  const ps = P(lt, 0, 0.45, 'outBack')
  if (ps > 0) lib.at(ctx, cx, cy - 120 * u, { scale: ps, rotate: (1 - ps) * -0.5 }, (c) => {
    icon(c, b.icon || 'escudo', 0, 0, 170 * u, bb.ink, { fill: bb.ink, width: 1.5 })
    c.fillStyle = bb.accent; c.save(); c.rotate(Math.PI / 4 + lt); c.fillRect(-18 * u, -18 * u, 36 * u, 36 * u); c.restore()
  })
  const t1 = timesOf(b, b.headline, 0.2, 0.1)
  line(ctx, b.headline, cx, cy + 20 * u, { size: 50 * u, weight: 700, color: S.fg, accent: S.accent, wordP: wp(t1, lt), grow: 0.5 })
  const t2 = timesOf(b, b.sub, 0.3, 0.12)
  line(ctx, b.sub, cx, cy + 100 * u, { size: 104 * u, weight: 800, color: S.accent, accent: S.accent, wordP: wp(t2, lt, 0.5), grow: 0.8, maxW: r * 1.8 })
  ctx.restore()
}

SH.ranking = (ctx, b, lt, dur, S, u, W, H) => {
  const bb = B()
  const cam = 1.25 - 0.25 * P(lt, 0, 0.8, 'outExpo') + P(lt, dur - 0.6, dur, 'inCubic') * 0.06
  const fade = P(lt, dur - 0.45, dur, 'inCubic')
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam, cam); ctx.translate(-W / 2, -H / 2)
  ctx.globalAlpha *= 1 - fade * 0.9
  if (fade > 0) ctx.filter = 'grayscale(' + fade + ')'
  const click = 0.85
  // o "1" gigante de contorno, desenhado depois do clique
  const p1 = P(lt, click, click + 0.6, 'outCubic')
  if (p1 > 0) {
    ctx.save(); ctx.globalAlpha *= p1 * 0.9
    ctx.font = '800 ' + (1100 * u) + 'px "' + HEAD() + '"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.lineWidth = 4 * u; ctx.strokeStyle = S.accent
    ctx.setLineDash([3000 * u * p1, 3000 * u]); ctx.strokeText('1', W / 2 + 30 * u, H * 0.52); ctx.restore()
  }
  const cw = 640 * u, ch = 130 * u, x0 = W / 2 - cw / 2, top = H * 0.4
  // os outros, abaixo
  const others = (b.items && b.items.length ? b.items : ['Concorrência', 'Concorrência', 'Concorrência'])
  others.forEach((name, i) => {
    const pi = P(lt, 0.1 + i * 0.08, 0.5 + i * 0.08, 'outExpo')
    const away = P(lt, click + 0.1, click + 0.6, 'inOutCubic')
    if (pi <= 0) return
    const y = top + 170 * u + i * 128 * u + (1 - pi) * 120 * u + away * 60 * u
    ctx.save(); ctx.globalAlpha *= pi * (1 - away * 0.85)
    const w2 = cw * 0.86, xx = W / 2 - w2 / 2
    ctx.fillStyle = lib.mix(bb.paper, '#000000', 0.08); lib.roundRect(ctx, xx, y, w2, 104 * u, 18 * u); ctx.fill()
    ctx.fillStyle = lib.mix(bb.paper, '#000000', 0.2); lib.roundRect(ctx, xx + 22 * u, y + 22 * u, 60 * u, 60 * u, 12 * u); ctx.fill()
    lib.text(ctx, name, xx + 106 * u, y + 44 * u, { font: HEAD(), size: 34 * u, weight: 600, color: rgba(bb.ink, 0.6), align: 'left', baseline: 'middle' })
    ctx.fillStyle = lib.mix(bb.paper, '#000000', 0.18); ctx.fillRect(xx + 106 * u, y + 70 * u, 220 * u, 8 * u)
    ctx.restore()
  })
  // você, em primeiro
  const pc = P(lt, 0, 0.45, 'outBack')
  const press = lib.pulse(lt, click, 0.3)
  const lift = P(lt, click, click + 0.4, 'outBack')
  const cy0 = top + (1 - lift) * 0 - lift * 10 * u
  lib.at(ctx, W / 2, cy0 + ch / 2, { scale: pc * (1 - press * 0.05) * (1 + lift * 0.06) }, (c) => {
    c.shadowColor = rgba(bb.accent, 0.45); c.shadowBlur = 50 * u * (0.3 + lift); c.shadowOffsetY = 16 * u
    c.fillStyle = bb.accent; lib.roundRect(c, -cw / 2, -ch / 2, cw, ch, 22 * u); c.fill()
    c.shadowColor = 'transparent'
    c.fillStyle = bb.onAccent; lib.roundRect(c, -cw / 2 + 24 * u, -38 * u, 76 * u, 76 * u, 16 * u); c.fill()
    c.fillStyle = bb.accent; c.save(); c.translate(-cw / 2 + 62 * u, 0); c.rotate(Math.PI / 4); c.fillRect(-13 * u, -13 * u, 26 * u, 26 * u); c.restore()
    lib.text(c, String(b.headline || 'Sua empresa').replace(/\*/g, ''), -cw / 2 + 126 * u, -14 * u, { font: HEAD(), size: 46 * u, weight: 800, color: bb.onAccent, align: 'left', baseline: 'middle', spacing: -1 * u })
    lib.text(c, String(b.sub || '').replace(/\*/g, ''), -cw / 2 + 128 * u, 30 * u, { font: B().body, size: 26 * u, weight: 500, color: rgba(bb.onAccent, 0.8), align: 'left', baseline: 'middle' })
  })
  // cursor
  const hp = P(lt, 0.3, click, 'outCubic')
  const hx = lib.lerp(W * 0.85, W / 2 + cw * 0.38, hp), hy = lib.lerp(H * 0.62, top + 20 * u, hp)
  const hout = P(lt, click + 0.5, click + 0.9, 'inCubic')
  if (hp > 0) { ctx.save(); ctx.globalAlpha *= 1 - hout; hand(ctx, hx + hout * 200 * u, hy - hout * 100 * u, 1.6 * u, press, S); ctx.restore() }
  confetti(ctx, W / 2 + cw * 0.38, top + 20 * u, lt, click, u, [bb.accent, bb.ink, bb.accentOnDark])
  ctx.restore()
}

SH.orcamento = (ctx, b, lt, dur, S, u, W, H) => {
  const bb = B()
  const t1 = timesOf(b, b.headline, 0.05, 0.12)
  line(ctx, b.headline, W / 2, H * 0.4, { size: 66 * u, weight: 800, color: S.fg, accent: S.accent, wordP: wp(t1, lt), grow: 0.6 })
  const word = String(b.sub || '').replace(/\*/g, '')
  const at = wordAt(b, word, 0.3)
  const pw = P(lt, at, at + 0.45, 'linear')
  const shown = word.slice(0, Math.ceil(word.length * pw))
  const serif = EMPH() !== HEAD()
  const f = { font: serif ? EMPH() : HEAD(), italic: serif && !!B().emphasisItalic, size: (serif ? 150 : 120) * u, weight: serif ? 400 : 800, spacing: -3 * u }
  const fw = lib.measure(ctx, word, f)
  if (shown) lib.text(ctx, shown, W / 2 - fw / 2, H * 0.455, { ...f, color: S.accent, align: 'left', baseline: 'middle' })
  // curvas tracejadas
  dashedCurve(ctx, curvePts(-40 * u, H * 0.3, W + 40 * u, H * 0.33, -0.25, 40), P(lt, 0, 1.2, 'outCubic'), rgba(S.accent, 0.6), 4 * u, u)
  dashedCurve(ctx, curvePts(W * 0.72, H * 0.66, W * 0.45, H * 0.86, 0.6, 30), P(lt, 0.4, 1.4, 'outCubic'), rgba(S.accent, 0.6), 4 * u, u)
  // o botão deslizante
  const pp = P(lt, 0.2, 0.55, 'outBack')
  const pwid = 420 * u, ph = 104 * u, py = H * 0.55
  if (pp > 0) lib.at(ctx, W / 2, py, { scale: pp }, (c) => {
    c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 30 * u; c.shadowOffsetY = 10 * u
    c.fillStyle = bb.accent; lib.roundRect(c, -pwid / 2, -ph / 2, pwid, ph, ph / 2); c.fill()
    c.shadowColor = 'transparent'
    const drag = P(lt, 0.75, 1.35, 'inOutCubic')
    // pontos que somem atrás do botão
    for (let i = 0; i < 6; i++) { const x = -pwid / 2 + 130 * u + i * 34 * u; if (x > -pwid / 2 + 60 * u + drag * (pwid - 124 * u)) { c.fillStyle = rgba(bb.onAccent, 0.8); c.beginPath(); c.arc(x, 0, 5 * u, 0, Math.PI * 2); c.fill() } }
    const rx = pwid / 2 - 52 * u
    c.fillStyle = bb.onAccent; c.beginPath(); c.arc(rx, 0, 40 * u, 0, Math.PI * 2); c.fill()
    lib.text(c, '$', rx, 2 * u, { font: HEAD(), size: 44 * u, weight: 800, color: bb.accent, align: 'center', baseline: 'middle' })
    const kx = -pwid / 2 + 52 * u + drag * (pwid - 104 * u - 90 * u)
    c.fillStyle = bb.ink; c.beginPath(); c.arc(kx, 0, 40 * u, 0, Math.PI * 2); c.fill()
    c.fillStyle = bb.accentOnDark; c.save(); c.translate(kx, 0); c.rotate(Math.PI / 4); c.fillRect(-11 * u, -11 * u, 22 * u, 22 * u); c.restore()
  })
  // a mão que arrasta
  const drag = P(lt, 0.75, 1.35, 'inOutCubic')
  const hin = P(lt, 0.45, 0.75, 'outCubic')
  if (hin > 0) hand(ctx, W / 2 - pwid / 2 + 70 * u + drag * (pwid - 194 * u) + (1 - hin) * 300 * u, py + 26 * u + (1 - hin) * 200 * u, 1.5 * u, lib.pulse(lt, 0.75, 0.2), S)
  // avião de papel que sai voando
  const fly = P(lt, 1.2, dur, 'inOutCubic')
  const px = lib.lerp(W * 0.62, W * 1.2, fly), py2 = lib.lerp(H * 0.68, H * 0.5, fly) - Math.sin(fly * Math.PI) * 80 * u
  const pin = P(lt, 0.3, 0.7, 'outBack')
  if (pin > 0) plane(ctx, px, py2, pin * 1.3 * u, -0.6 - fly * 0.3, bb.ink)
}

SH.circulo = (ctx, b, lt, dur, S, u, W, H) => {
  const cx = W / 2, cy = H * 0.5, r = 330 * u
  const p = P(lt, 0, 0.55, 'outExpo')
  const out = P(lt, dur - 0.3, dur, 'inCubic')
  ctx.save(); ctx.globalAlpha *= 1 - out
  const sc = 0.85 + 0.15 * p + out * 0.1
  ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy)
  ctx.strokeStyle = rgba(S.fg === '#ffffff' ? '#ffffff' : S.bg === '#ffffff' ? S.accent : '#ffffff', 0.9)
  ring(ctx, cx, cy, r, p, S.dark ? rgba(S.fg, 0.6) : (S.kind === 'tom' ? '#ffffff' : S.accent), 5 * u)
  if (b.icon) {
    const pi = P(lt, 0.15, 0.45, 'outBack')
    if (pi > 0) lib.at(ctx, cx, cy - (b.sub ? 150 : 70) * u, { scale: pi }, (c) => icon(c, b.icon, 0, 0, 64 * u, S.fg, { fill: S.accent, width: 2 }))
  }
  if (b.sub) {
    const t1 = timesOf(b, b.headline, 0.1, 0.12)
    line(ctx, b.headline, cx, cy - 40 * u, { size: 120 * u, weight: 800, color: S.fg, accent: S.accent, wordP: wp(t1, lt, 0.5), grow: 0.6, maxW: r * 1.7 })
    const t2 = timesOf(b, b.sub, 0.2, 0.1)
    line(ctx, b.sub, cx, cy + 70 * u, { size: 110 * u, weight: 800, color: S.accent, accent: S.accent, emphColor: S.accent, wordP: wp(t2, lt, 0.5), grow: 0.6, maxW: r * 1.75 })
  } else {
    const times = timesOf(b, b.headline, 0.1, 0.14)
    line(ctx, b.headline, cx, cy + 10 * u, { size: 56 * u, weight: 700, color: S.fg, accent: S.accent, wordP: wp(times, lt), grow: 0.6, maxW: r * 1.75 })
  }
  ctx.restore()
}

SH.assinatura = (ctx, b, lt, dur, S, u, W, H) => {
  const out = P(lt, dur - 0.8, dur, 'inCubic')
  ctx.save(); ctx.globalAlpha *= 1 - out
  const h = logoBuild(ctx, S, W / 2, H * 0.48, 170 * u, lt - 0.1, u)
  tagline(ctx, b.sub, W / 2, H * 0.48 + h / 2 + 56 * u, lt, 0.9, S, u, 24)
  ctx.restore()
}

// ——— Linha do tempo e transições ———
function current(t) {
  const bs = env.data.beats
  let i = 0
  for (let k = 0; k < bs.length; k++) if (t >= bs[k].start - 1e-4) i = k
  return i
}
function drawBeat(ctx, i, t, u, W, H) {
  const b = env.data.beats[i]
  if (!b) return
  const S = surfOf(b)
  const lt = t - b.start, dur = Math.max(0.3, b.end - b.start)
  backdrop(ctx, S, W, H, t, u, b)
  // câmera: aproximação lenta e contínua
  const z = 1 + 0.045 * C(lt / Math.max(1, dur))
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2)
  ;(SH[shotOf(b)] || SH.frase)(ctx, b, lt, dur, S, u, W, H)
  ctx.restore()
}

const TR = { circulo: 0.42, zoom: 0.3, chicote: 0.32, flash: 0.12, corte: 0 }

scene({
  fonts: env.data && env.data.brand ? [env.data.brand.heading, env.data.brand.body, env.data.brand.emphasis] : ['Inter'],
  setup() { return {} },
  draw(ctx, t, env) {
    const W = env.width, H = env.height, d = env.data
    if (!d || !d.brand || !d.beats || !d.beats.length) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H); return }
    const u = Math.min(W / 1080, H / 1920)
    const i = current(t)
    const b = d.beats[i]
    const lt = t - b.start
    const kind = i > 0 ? b.transition : 'corte'
    const dur = TR[kind] || 0
    if (i > 0 && dur && lt < dur) {
      const k = lt / dur
      if (kind === 'circulo') {
        // a próxima abre num círculo a partir do centro, com borda suave
        drawBeat(ctx, i - 1, t, u, W, H)
        const r = E.inOutCubic(k) * Math.hypot(W, H) * 0.56
        ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(1, r), 0, Math.PI * 2); ctx.clip()
        drawBeat(ctx, i, t, u, W, H)
        ctx.restore()
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 30 * u * (1 - k); ctx.filter = 'blur(10px)'; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(1, r), 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      } else if (kind === 'zoom') {
        ctx.save(); const z = 1 + E.inCubic(k) * 0.35; ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); ctx.filter = 'blur(' + (k * 24).toFixed(1) + 'px)'; drawBeat(ctx, i - 1, t, u, W, H); ctx.restore()
        ctx.save(); ctx.globalAlpha = E.outCubic(k); const z2 = 1.25 - 0.25 * E.outCubic(k); ctx.translate(W / 2, H / 2); ctx.scale(z2, z2); ctx.translate(-W / 2, -H / 2); ctx.filter = 'blur(' + ((1 - k) * 24).toFixed(1) + 'px)'; drawBeat(ctx, i, t, u, W, H); ctx.restore()
      } else if (kind === 'chicote') {
        const e = E.inOutCubic(k)
        ctx.save(); ctx.translate(-W * e, 0); ctx.filter = 'blur(' + (Math.sin(k * Math.PI) * 16).toFixed(1) + 'px)'; drawBeat(ctx, i - 1, t, u, W, H); ctx.restore()
        ctx.save(); ctx.translate(W * (1 - e), 0); ctx.filter = 'blur(' + (Math.sin(k * Math.PI) * 16).toFixed(1) + 'px)'; drawBeat(ctx, i, t, u, W, H); ctx.restore()
      } else {
        // flash: um quadro escuro e a próxima entra
        drawBeat(ctx, i, t, u, W, H)
        ctx.fillStyle = 'rgba(0,0,0,' + (1 - k) * 0.92 + ')'; ctx.fillRect(0, 0, W, H)
      }
    } else drawBeat(ctx, i, t, u, W, H)
  },
})
`

type Beat = Omit<ExplainerBeat, 'id'> & { shot: ShotId; surface?: SurfaceId }

/** O roteiro do comercial da Avence (recriação do reel de referência na marca da conta). */
export function commercialBeats(brandName: string): ExplainerBeat[] {
  const avence = /avence/i.test(brandName)
  const at = (s: number, e: number) => ({ start: s, end: e })
  const tr = (transition: TransitionId, sfx: SfxId) => ({ transition, sfx })
  const beats: Beat[] = [
    { ...at(0, 0.6), shot: 'abertura', pattern: 'gancho', headline: 'Se você', icon: 'mao', fala: 'Se você', ...tr('corte', 'swish') },
    { ...at(0.6, 1.62), shot: 'objeto3d', pattern: 'titulo', headline: 'Quer', sub: 'Vender *mais*', kicker: '$', fala: 'quer vender mais,', ...tr('circulo', 'whoosh') },
    { ...at(1.62, 2.62), shot: 'tipo', pattern: 'titulo', headline: 'O seu', sub: 'site', icon: 'celular', fala: 'o seu site', ...tr('zoom', 'swish') },
    { ...at(2.62, 3.76), shot: 'digitado', pattern: 'titulo', headline: 'Precisa ter *cara de...*', fala: 'precisa ter cara de', ...tr('corte', 'digitar') },
    { ...at(3.76, 5.16), shot: 'passagem', pattern: 'titulo', headline: 'Empresa', sub: '*Grande*', kicker: '$', fala: 'empresa grande.', ...tr('corte', 'whoosh') },
    { ...at(5.16, 6.28), shot: 'selo', pattern: 'titulo', headline: 'Não basta', sub: 'Aparecer', icon: 'busca', fala: 'Não basta aparecer.', ...tr('zoom', 'impacto') },
    { ...at(6.28, 6.92), shot: 'frase', pattern: 'titulo', headline: 'É *preciso*', fala: 'É preciso', ...tr('corte', 'swish') },
    { ...at(6.92, 8.26), shot: 'cartao', pattern: 'lista', headline: 'Prender', sub: 'Atenção', number: { value: 1 }, icon: 'olho', items: ['Mostre o que você faz nos primeiros segundos.'], fala: 'prender a atenção,', ...tr('zoom', 'impacto') },
    { ...at(8.26, 9.42), shot: 'cartao', pattern: 'lista', headline: 'Gerar', sub: 'Interesse', number: { value: 2 }, icon: 'alvo', items: ['Cases, prova e design trabalhando juntos.'], fala: 'gerar interesse', ...tr('flash', 'whoosh') },
    { ...at(9.42, 11.32), shot: 'cartao', pattern: 'lista', headline: 'Convencer quem está', sub: 'Visitando', number: { value: 3 }, icon: 'pessoa', items: ['Leve quem chega direto ao seu WhatsApp.'], fala: 'e convencer quem está visitando.', ...tr('flash', 'whoosh') },
    { ...at(11.32, 12.42), shot: 'logo', pattern: 'cta', headline: brandName, sub: avence ? 'Sites em WordPress e Elementor' : undefined, fala: `A ${brandName}`, ...tr('circulo', 'ding') },
    { ...at(12.42, 13.82), shot: 'destaque', pattern: 'titulo', headline: 'É *especialista* em...', fala: 'é especialista em', ...tr('corte', 'swish') },
    { ...at(13.82, 14.86), shot: 'celular', pattern: 'foto', headline: 'Sites *rápidos*', photo: avence ? 'case-processbase' : undefined, fala: 'sites rápidos', ...tr('corte', 'whoosh') },
    { ...at(14.86, 15.82), shot: 'celular', pattern: 'foto', headline: 'Feitos para o *celular*', photo: avence ? 'case-vizor' : undefined, fala: 'e feitos para o celular,', ...tr('corte', 'swish') },
    { ...at(15.82, 16.62), shot: 'frase', pattern: 'titulo', headline: 'Desenvolvidos *para*', surface: 'branco', fala: 'desenvolvidos para', ...tr('zoom', 'swish') },
    { ...at(16.62, 18.02), shot: 'chuva3d', pattern: 'numero', headline: 'Aumentar a', sub: 'conversão', kicker: '$', fala: 'aumentar a conversão,', ...tr('corte', 'subida') },
    { ...at(18.02, 19.42), shot: 'escudo', pattern: 'icone', headline: 'Fortalecer', sub: 'Sua *marca*', icon: 'escudo', fala: 'fortalecer sua marca', ...tr('zoom', 'pop') },
    { ...at(19.42, 21.92), shot: 'ranking', pattern: 'comparar', headline: 'Sua empresa', sub: 'na frente da concorrência', items: ['Concorrência', 'Concorrência', 'Concorrência'], fala: 'e colocar sua empresa na frente da concorrência.', ...tr('corte', 'clique') },
    { ...at(21.92, 23.32), shot: 'orcamento', pattern: 'cta', headline: 'Solicite um', sub: 'orçamento', fala: 'Solicite um orçamento', ...tr('zoom', 'swish') },
    { ...at(23.32, 24.76), shot: 'circulo', pattern: 'cta', headline: 'E comece a vender *mais*', icon: 'dinheiro', fala: 'e comece a vender mais', ...tr('circulo', 'whoosh') },
    { ...at(24.76, 25.92), shot: 'frase', pattern: 'titulo', headline: 'Com um site de', surface: 'tom', fala: 'com um site de', ...tr('corte', 'swish') },
    { ...at(25.92, 27.2), shot: 'circulo', pattern: 'cta', headline: 'Alta', sub: 'conversão', icon: 'grafico', fala: 'alta conversão.', ...tr('zoom', 'impacto') },
    { ...at(27.2, 31.4), shot: 'assinatura', pattern: 'cta', headline: brandName, sub: avence ? 'avencestudio.com' : undefined, fullScreen: true, ...tr('corte', 'ding') },
  ]
  return beats.map((b, i) => ({ id: `c${i}`, ...b }))
}

/** As fotos públicas do comercial da Avence (as telas de celular dos cases). */
export const COMMERCIAL_PHOTOS = [
  { src: '/brands/avence-studio/cases/processbase-celular.webp', name: 'case-processbase', desc: 'Página do case ProcessBase no celular', origin: 'marca' as const },
  { src: '/brands/avence-studio/cases/vizor-celular.webp', name: 'case-vizor', desc: 'Página do case Vizor Películas no celular', origin: 'marca' as const },
]

/**
 * O mesmo comercial (os 23 planos e o ritmo do reel de referência) contando o Marketing 360 (2026-11-09, o
 * usuário: "quero criar o mesmo vídeo, exatamente como é… mas com a marca da Avence… que fale de marketing 360,
 * a proposta de serviço que vamos rodar, focada em vender vários serviços ao cliente: criativo, conteúdo, vídeos,
 * anúncios, site, acompanhamento, comercial, CRM").
 */
export function commercial360Beats(brandName: string): ExplainerBeat[] {
  const avence = /avence/i.test(brandName)
  const at = (s: number, e: number) => ({ start: s, end: e })
  const tr = (transition: TransitionId, sfx: SfxId) => ({ transition, sfx })
  const beats: Beat[] = [
    { ...at(0, 0.6), shot: 'abertura', pattern: 'gancho', headline: 'Se você', icon: 'mao', fala: 'Se você', ...tr('corte', 'swish') },
    { ...at(0.6, 1.62), shot: 'objeto3d', pattern: 'titulo', headline: 'Quer', sub: 'Vender *mais*', kicker: '$', fala: 'quer vender mais,', ...tr('circulo', 'whoosh') },
    { ...at(1.62, 2.62), shot: 'tipo', pattern: 'titulo', headline: 'O seu', sub: 'marketing', icon: 'grafico', fala: 'o seu marketing', ...tr('zoom', 'swish') },
    { ...at(2.62, 3.76), shot: 'digitado', pattern: 'titulo', headline: 'Precisa funcionar *como um...*', fala: 'precisa funcionar como um', ...tr('corte', 'digitar') },
    { ...at(3.76, 5.16), shot: 'passagem', pattern: 'titulo', headline: 'Time', sub: '*Completo*', kicker: '+', fala: 'time completo.', ...tr('corte', 'whoosh') },
    { ...at(5.16, 6.28), shot: 'selo', pattern: 'titulo', headline: 'Não basta', sub: 'Postar', icon: 'celular', fala: 'Não basta postar.', ...tr('zoom', 'impacto') },
    { ...at(6.28, 6.92), shot: 'frase', pattern: 'titulo', headline: 'É *preciso*', fala: 'É preciso', ...tr('corte', 'swish') },
    { ...at(6.92, 8.26), shot: 'cartao', pattern: 'lista', headline: 'Atrair', sub: 'Atenção', number: { value: 1 }, icon: 'olho', items: ['Criativos, conteúdo e vídeos que param o dedo.'], fala: 'atrair atenção,', ...tr('zoom', 'impacto') },
    { ...at(8.26, 9.42), shot: 'cartao', pattern: 'lista', headline: 'Gerar', sub: 'Demanda', number: { value: 2 }, icon: 'alvo', items: ['Anúncios e um site feitos para converter.'], fala: 'gerar demanda', ...tr('flash', 'whoosh') },
    { ...at(9.42, 11.32), shot: 'cartao', pattern: 'lista', headline: 'E transformar contatos em', sub: 'Vendas', number: { value: 3 }, icon: 'pessoa', items: ['Comercial com CRM e acompanhamento de perto.'], fala: 'e transformar contatos em vendas.', ...tr('flash', 'whoosh') },
    { ...at(11.32, 12.42), shot: 'logo', pattern: 'cta', headline: brandName, sub: 'Marketing 360', fala: `A ${brandName}`, ...tr('circulo', 'ding') },
    { ...at(12.42, 13.82), shot: 'destaque', pattern: 'titulo', headline: 'Cuida do *marketing inteiro*', fala: 'cuida do marketing inteiro:', ...tr('corte', 'swish') },
    { ...at(13.82, 14.86), shot: 'celular', pattern: 'foto', headline: 'Criativos e *conteúdo*', sub: 'Vídeos', photo: avence ? 'criacao-avence' : undefined, fala: 'criativos, conteúdo e vídeos,', ...tr('corte', 'whoosh') },
    { ...at(14.86, 15.82), shot: 'celular', pattern: 'foto', headline: 'Anúncios e *site*', sub: 'CRM e comercial', photo: avence ? 'case-processbase' : undefined, fala: 'anúncios, site, CRM e comercial,', ...tr('corte', 'swish') },
    { ...at(15.82, 16.62), shot: 'frase', pattern: 'titulo', headline: 'Tudo *integrado* para', surface: 'branco', fala: 'tudo integrado para', ...tr('zoom', 'swish') },
    { ...at(16.62, 18.02), shot: 'chuva3d', pattern: 'numero', headline: 'Gerar mais', sub: 'vendas', kicker: '$', fala: 'gerar mais vendas,', ...tr('corte', 'subida') },
    { ...at(18.02, 19.42), shot: 'escudo', pattern: 'icone', headline: 'Fortalecer', sub: 'Sua *marca*', icon: 'escudo', fala: 'fortalecer sua marca', ...tr('zoom', 'pop') },
    { ...at(19.42, 21.92), shot: 'ranking', pattern: 'comparar', headline: 'Sua empresa', sub: 'na frente da concorrência', items: ['Concorrência', 'Concorrência', 'Concorrência'], fala: 'e colocar sua empresa na frente da concorrência.', ...tr('corte', 'clique') },
    { ...at(21.92, 23.32), shot: 'orcamento', pattern: 'cta', headline: 'Solicite um', sub: 'orçamento', fala: 'Solicite um orçamento', ...tr('zoom', 'swish') },
    { ...at(23.32, 24.76), shot: 'circulo', pattern: 'cta', headline: 'E comece a vender *mais*', icon: 'dinheiro', fala: 'e comece a vender mais', ...tr('circulo', 'whoosh') },
    { ...at(24.76, 25.92), shot: 'frase', pattern: 'titulo', headline: 'Com um marketing', surface: 'tom', fala: 'com um marketing', ...tr('corte', 'swish') },
    { ...at(25.92, 27.2), shot: 'circulo', pattern: 'cta', headline: '360', sub: 'de verdade', icon: 'mundo', fala: 'trezentos e sessenta de verdade.', ...tr('zoom', 'impacto') },
    { ...at(27.2, 31.4), shot: 'assinatura', pattern: 'cta', headline: brandName, sub: avence ? 'avencestudio.com' : undefined, fullScreen: true, ...tr('corte', 'ding') },
  ]
  return beats.map((b, i) => ({ id: `m${i}`, ...b }))
}

/** As fotos do comercial Marketing 360 da Avence: a mesa de criação (story da marca) e a tela de um site no celular. */
export const COMMERCIAL_360_PHOTOS = [
  { src: '/brands/avence-studio/stories/antes-de-ir-ao-ar.png', name: 'criacao-avence', desc: 'Mesa de criação da Avence Studio: paleta, rascunhos e o post no celular', origin: 'marca' as const },
  COMMERCIAL_PHOTOS[0],
]

export const COMMERCIAL_THEMES = {
  site: { label: 'Comercial animado: site', text: 'Anúncio de 31 s com tipografia cinética, objeto 3D, cartões numerados, celular, ranking e orçamento, já na marca. Depois é só trocar os textos e narrar.' },
  marketing360: { label: 'Comercial animado: Marketing 360', text: 'O mesmo comercial contando o Marketing 360: criativos, conteúdo, vídeos, anúncios, site, CRM, comercial e acompanhamento.' },
} as const
export type CommercialTheme = keyof typeof COMMERCIAL_THEMES

/** O vídeo explicativo do comercial, pronto para o estúdio (briefing: sem fala; a narração vem de Estilo › Som). */
export function commercialData(brandName: string, theme: CommercialTheme = 'site'): ExplainerData {
  const avence = /avence/i.test(brandName)
  const m360 = theme === 'marketing360'
  return {
    ...emptyExplainer(),
    mode: 'briefing',
    look: 'comercial',
    captions: 'nenhuma',
    beats: m360 ? commercial360Beats(brandName) : commercialBeats(brandName),
    photos: avence ? (m360 ? COMMERCIAL_360_PHOTOS : COMMERCIAL_PHOTOS).map((p) => ({ ...p })) : [],
    sfxVolume: 0.55,
    caption: !avence
      ? undefined
      : m360
        ? 'Marketing que funciona como um time completo: criativos, conteúdo e vídeos, anúncios, site, CRM e comercial, com acompanhamento de perto. Tudo integrado para atrair atenção, gerar demanda e transformar contatos em vendas. Conheça o Marketing 360 da Avence Studio e peça um orçamento.'
        : 'Não basta aparecer: o seu site precisa prender a atenção, gerar interesse e convencer quem está visitando. A Avence Studio faz sites em WordPress e Elementor, rápidos e feitos para o celular. Peça um orçamento.',
  }
}
