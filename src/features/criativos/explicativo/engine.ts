/**
 * O motor do vídeo explicativo: uma cena em código fixa (roda no worker isolado das cenas,
 * `sceneWorker.ts`) que lê o roteiro em `env.data` e desenha cada momento no ritmo da fala.
 *
 * Linguagem (2026-11-08, o usuário: "ainda está amador… utilizar o design system da marca, não
 * criar um aleatório"): tudo sai do design system da marca (`env.data.brand`, montado por
 * `brandTokens` a partir de `paletteOf` e do DESIGN.md): fontes de título, texto e destaque,
 * tinta, papel, destaque, apagado, canto do botão e o logo. Grade editorial com margens fixas,
 * texto revelado por máscara linha a linha quando a palavra é falada, a palavra de destaque na
 * fonte de destaque e na cor da marca com sublinhado que se desenha, ícones de traço (Lucide) que
 * se desenham, número que conta, cartões com o canto da marca, fundo alternando papel e tinta,
 * barra de progresso e o logo como assinatura. Transições empurrar (com rastro), painel na cor da
 * marca, zoom, piscada e corte com soco. Legenda palavra a palavra nas fontes da marca. Com vídeo,
 * a pessoa aparece embaixo ("dividido") ou em tela cheia com as animações por cima ("rosto").
 */
export const EXPLAINER_SCENE = String.raw`
const TIN = 0.42

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const rgbOf = (h) => { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const lum = (h) => { const [r, g, b] = rgbOf(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const rgba = (h, a) => { const [r, g, b] = rgbOf(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')' }
const B = () => env.data.brand

// ——— Superfícies: papel, tinta ou destaque da marca, com as cores certas para cada uma ———
function surface(kind) {
  const b = B()
  if (kind === 'ink') return { kind, bg: b.ink, fg: b.paper, muted: b.mutedOnDark, accent: b.accentOnDark, line: rgba(b.paper, 0.14), dark: true }
  if (kind === 'accent') return { kind, bg: b.accent, fg: b.onAccent, muted: rgba(b.onAccent, 0.72), accent: b.onAccent, line: rgba(b.onAccent, 0.22), dark: lum(b.accent) < 0.4 }
  return { kind: 'paper', bg: b.paper, fg: b.ink, muted: b.muted, accent: b.accentOnLight, line: rgba(b.ink, 0.12), dark: false }
}
function surfaceOf(beat, i) {
  const t = env.data.theme
  if (t === 'claro') return surface(beat.pattern === 'cta' ? 'ink' : 'paper')
  if (t === 'escuro') return surface('ink')
  if (beat.pattern === 'gancho') return surface('ink')
  if (beat.pattern === 'cta') return surface('accent')
  return surface(i % 2 ? 'ink' : 'paper')
}

// ——— Tipografia ———
const HEAD = () => B().heading, BODY = () => B().body, EMPH = () => B().emphasis
const emphItalic = () => !!B().emphasisItalic
function tokens(beat, str) {
  const hl = new Set((beat.highlight || []).map(norm))
  return String(str || '').split(/\s+/).filter(Boolean).map((w) => {
    const star = /^\*.*\*[.,!?:;]*$/.test(w)
    const text = w.replace(/\*/g, '')
    return { text, emph: star || hl.has(norm(text)) }
  })
}
function fontFor(tok, o) {
  if (tok.emph && o.emph !== false) {
    const same = EMPH() === (o.font || HEAD())
    return { font: EMPH(), size: o.size * (same ? 1 : 1.08), weight: same ? o.weight : 400, italic: emphItalic(), spacing: same ? o.spacing : 0 }
  }
  return { font: o.font, size: o.size, weight: o.weight, spacing: o.spacing || 0 }
}
function layout(ctx, toks, maxW, o) {
  const lines = []
  let cur = [], w = 0
  const space = lib.measure(ctx, ' ', { font: o.font, size: o.size, weight: o.weight })
  for (const t of toks) {
    const f = fontFor(t, o), tw = lib.measure(ctx, t.text, f)
    if (cur.length && w + space + tw > maxW) { lines.push({ toks: cur, width: w }); cur = []; w = 0 }
    cur.push({ ...t, f, w: tw }); w += (cur.length > 1 ? space : 0) + tw
  }
  if (cur.length) lines.push({ toks: cur, width: w })
  return { lines, space }
}

/** Quando cada palavra do texto é falada (para o texto entrar junto com a voz). */
function spokenTimes(beat, list, step) {
  const spoken = env.data.words.filter((w) => w.s >= beat.start - 0.05 && w.s < beat.end)
  const used = new Set()
  return list.map((tok, i) => {
    const n = norm(tok.text)
    const j = n ? spoken.findIndex((w, k) => !used.has(k) && norm(w.w) === n) : -1
    if (j >= 0) { used.add(j); return Math.max(0, Math.min(spoken[j].s - beat.start - 0.08, beat.end - beat.start - 0.6)) }
    return 0.08 + i * (step || 0.07)
  })
}

/**
 * Bloco de texto revelado por máscara: cada linha sobe de trás de uma linha de corte quando a
 * primeira palavra dela é falada. As palavras de destaque saem na fonte de destaque, na cor da
 * marca, com um sublinhado que se desenha. Devolve a altura usada.
 */
function textBlock(ctx, beat, lt, S, o) {
  const toks = tokens(beat, o.text)
  if (!toks.length) return 0
  let size = o.size
  const sp = (s) => (o.spacing === undefined ? -s * 0.025 : o.spacing)
  const base = { font: o.font || HEAD(), size, weight: o.weight || 700, spacing: sp(size), emph: o.emph }
  let L = layout(ctx, toks, o.maxW, base)
  while ((L.lines.length > (o.maxLines || 4) || L.lines.some((l) => l.width > o.maxW * 1.001)) && size > o.size * 0.5) { size *= 0.92; base.size = size; base.spacing = sp(size); L = layout(ctx, toks, o.maxW, base) }
  const lh = size * (o.leading || 1.06)
  const times = spokenTimes(beat, toks, o.step)
  let k = 0
  const h = L.lines.length * lh
  const top = o.valign === 'center' ? o.y - h / 2 : o.y
  let prevAt = -1
  L.lines.forEach((line, li) => {
    // As linhas entram sempre de cima para baixo, mesmo quando a fala diz as palavras em outra ordem
    const at = Math.max(o.at !== undefined ? o.at + li * 0.09 : times[k], prevAt + 0.1)
    prevAt = at
    const p = lib.prog(lt, at, at + 0.62, 'outExpo')
    const x0 = o.align === 'center' ? o.x - line.width / 2 : o.x
    const yb = top + li * lh
    if (p <= 0) { k += line.toks.length; return }
    ctx.save()
    // A máscara da linha: o texto sobe de baixo dela, sem invadir a linha de cima nem a de baixo
    ctx.beginPath(); ctx.rect(x0 - size * 0.3, yb - size * 0.04, line.width + size * 0.8, lh + size * 0.1); ctx.clip()
    const dy = (1 - p) * lh * 1.05
    let x = x0
    line.toks.forEach((t) => {
      const color = t.emph && o.emph !== false ? (o.emphColor || S.accent) : (o.color || S.fg)
      if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = size * 0.18 }
      lib.text(ctx, t.text, x, yb + dy + lh * 0.5, { ...t.f, color, align: 'left', baseline: 'middle' })
      ctx.shadowBlur = 0
      if (t.emph && o.emph !== false && o.underline !== false) {
        const up = lib.prog(lt, at + 0.35, at + 0.85, 'inOutCubic')
        const uy = yb + dy + lh * 0.5 + size * 0.48
        if (up > 0) lib.path(ctx, [[x, uy], [x + t.w * up, uy - size * 0.025 * up]], 1, { color: o.emphColor || S.accent, width: Math.max(3, size * 0.05) })
      }
      x += t.w + L.space
      k++
    })
    ctx.restore()
  })
  return h
}

/** Rótulo pequeno em maiúsculas espaçadas, com um fio na cor de destaque. */
function kicker(ctx, str, lt, S, x, y, u, at) {
  const p = lib.prog(lt, at || 0, (at || 0) + 0.5, 'outExpo')
  if (p <= 0) return
  ctx.save(); ctx.globalAlpha = p
  ctx.fillStyle = S.accent; ctx.fillRect(x, y - 2 * u, 56 * u * p, 4 * u)
  lib.text(ctx, String(str).toUpperCase(), x + 76 * u, y, { font: BODY(), size: 26 * u, weight: 600, color: S.muted, align: 'left', spacing: 3 * u })
  ctx.restore()
}

// ——— Ícones de traço (Lucide, grade 24) que se desenham ———
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
function icon(ctx, name, cx, cy, size, color, p, width) {
  const paths = iconPaths(name)
  if (!paths || p <= 0) return false
  ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color; ctx.lineWidth = width || 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (p < 1) ctx.setLineDash([80 * p, 80])
  for (const path of paths) ctx.stroke(path)
  ctx.restore()
  return true
}
const iconOf = (beat) => (beat.icon && (env.data.icons || {})[beat.icon] ? beat.icon : null)

/** O ícone num disco da cor de destaque, que abre com uma onda. */
function iconBadge(ctx, name, cx, cy, r, lt, at, S) {
  const p = lib.prog(lt, at, at + 0.55, 'outBack')
  if (p <= 0) return
  const fillC = S.kind === 'accent' ? S.fg : B().accent
  const onC = S.kind === 'accent' ? S.bg : B().onAccent
  const ring = lib.prog(lt, at + 0.15, at + 0.95, 'outCubic')
  if (ring > 0 && ring < 1) { ctx.save(); ctx.strokeStyle = rgba(fillC, (1 - ring) * 0.8); ctx.lineWidth = r * 0.04; lib.circle(ctx, cx, cy, r * (1 + ring * 0.55)); ctx.stroke(); ctx.restore() }
  lib.at(ctx, cx, cy, { scale: p }, (c) => { c.fillStyle = fillC; lib.circle(c, 0, 0, r); c.fill() })
  icon(ctx, name, cx, cy + Math.sin((lt - at) * 2.2) * r * 0.03, r * 1.05, onC, lib.prog(lt, at + 0.15, at + 0.85, 'inOutCubic'), 1.7)
}

// ——— Fotos com o canto da marca e tratamento ———
let duoCanvas = null
function photoCard(ctx, img, cx, cy, w, h, lt, S, u) {
  const tr = env.data.treatment || 'limpa'
  const rad = Math.min(B().radius * 2, 40) * u
  const k = Math.max(w / img.width, h / img.height) * (1.06 + Math.min(lt, 6) * 0.012)
  const iw = img.width * k, ih = img.height * k
  const pad = tr === 'polaroid' ? 22 * u : tr === 'adesivo' ? 14 * u : 0
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 24 * u
  ctx.fillStyle = pad ? '#FFFFFF' : S.bg
  lib.roundRect(ctx, cx - w / 2 - pad, cy - h / 2 - pad, w + pad * 2, h + pad * (tr === 'polaroid' ? 5 : 2), pad ? rad + pad * 0.5 : rad); ctx.fill(); ctx.restore()
  ctx.save(); ctx.beginPath(); lib.roundRect(ctx, cx - w / 2, cy - h / 2, w, h, rad); ctx.clip()
  if (tr === 'duotone') {
    if (!duoCanvas || duoCanvas.width !== Math.ceil(w) || duoCanvas.height !== Math.ceil(h)) duoCanvas = new OffscreenCanvas(Math.ceil(w), Math.ceil(h))
    const d = duoCanvas.getContext('2d')
    d.globalCompositeOperation = 'source-over'; d.filter = 'grayscale(1) contrast(1.15)'; d.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih); d.filter = 'none'
    d.globalCompositeOperation = 'multiply'; d.fillStyle = B().accent; d.fillRect(0, 0, w, h)
    d.globalCompositeOperation = 'screen'; d.fillStyle = B().ink; d.fillRect(0, 0, w, h)
    d.globalCompositeOperation = 'source-over'
    ctx.drawImage(duoCanvas, cx - w / 2, cy - h / 2, w, h)
  } else ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih)
  ctx.restore()
}

// ——— Padrões: cada um recebe a caixa, a unidade u e a superfície S (as cores da marca desse fundo) ———
const PAT = {}
const M = (box, u) => Math.max(72 * u, box.w * 0.085)
/** Onde começa o conteúdo que cresce para baixo: sem legenda embaixo, desce para o meio da tela (não sobra metade vazia). */
const TOP = (box, o, base) => box.y + box.h * (o.free ? base + 0.12 : base)

PAT.gancho = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u)
  const ic = iconOf(b)
  if (ic) iconBadge(ctx, ic, box.x + box.w - m - 70 * u, box.y + box.h * 0.22, 70 * u, lt, 0.05, S)
  const cy = box.y + box.h * 0.52
  const h = textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y: cy, valign: 'center', maxW: box.w - m * 2, size: 150 * u, maxLines: 4, step: 0.12, shadow: o.over })
  if (b.sub) textBlock(ctx, b, lt, S, { text: b.sub, x: box.x + m, y: cy + h / 2 + 40 * u, maxW: box.w - m * 2, size: 42 * u, font: BODY(), weight: 500, color: S.muted, emph: false, at: 0.9, spacing: 0, leading: 1.3, shadow: o.over })
}

PAT.titulo = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u)
  const ic = iconOf(b)
  let y = TOP(box, o, 0.32) - (o.free ? box.h * 0.04 : 0)
  if (ic) { iconBadge(ctx, ic, box.x + m + 56 * u, y, 56 * u, lt, 0, S); y += 110 * u }
  else { kicker(ctx, b.kicker || ('0' + (o.index + 1)).slice(-2), lt, S, box.x + m, y, u, 0); y += 60 * u }
  const h = textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y, maxW: box.w - m * 2, size: 116 * u, maxLines: 4, shadow: o.over })
  if (b.sub) textBlock(ctx, b, lt, S, { text: b.sub, x: box.x + m, y: y + h + 40 * u, maxW: box.w - m * 2.4, size: 42 * u, font: BODY(), weight: 500, color: S.muted, emph: false, at: 0.7, spacing: 0, leading: 1.3, shadow: o.over })
}

PAT.icone = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u), cx = box.x + box.w / 2, cy = box.y + box.h * 0.36
  const r = Math.min(box.w, box.h) * 0.18
  iconBadge(ctx, iconOf(b) || 'brilho', cx, cy, r, lt, 0.05, S)
  textBlock(ctx, b, lt, S, { text: b.headline, x: cx, align: 'center', y: cy + r + 90 * u, maxW: box.w - m * 2, size: 96 * u, maxLines: 3, shadow: o.over })
}

PAT.lista = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u)
  const items = (b.items && b.items.length ? b.items : [b.sub || '']).filter(Boolean).slice(0, 5)
  const top = TOP(box, o, 0.16)
  const hh = textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y: top, maxW: box.w - m * 2, size: 84 * u, maxLines: 2, shadow: o.over })
  const rowH = Math.min(140 * u, (box.h * 0.6) / Math.max(1, items.length))
  const y0 = top + hh + 60 * u
  const gap = Math.min(0.55, Math.max(0.25, (dur - 0.8) / Math.max(1, items.length)))
  items.forEach((it, i) => {
    // Cada item entra quando a primeira palavra dele é falada (senão, um depois do outro)
    const first = tokens(b, it)[0]
    const said = first ? spokenTimes(b, [first], 0)[0] : 0
    const at = said > 0.25 ? Math.max(said, 0.3 + i * 0.15) : 0.4 + i * gap
    const y = y0 + i * rowH
    const lp = lib.prog(lt, at - 0.1, at + 0.5, 'inOutCubic')
    if (lp > 0) { ctx.fillStyle = S.line; ctx.fillRect(box.x + m, y + rowH - 1, (box.w - m * 2) * lp, Math.max(1, 2 * u)) }
    const p = lib.prog(lt, at, at + 0.55, 'outExpo')
    if (p <= 0) return
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, y, box.w, rowH - 2); ctx.clip()
    const dy = (1 - p) * rowH * 0.7
    lib.text(ctx, ('0' + (i + 1)).slice(-2), box.x + m, y + rowH / 2 + dy, { font: HEAD(), size: 40 * u, weight: 700, color: S.accent, align: 'left' })
    const size = Math.min(52 * u, lib.fit(ctx, String(it), box.w - m * 2 - 110 * u, { font: BODY(), size: 52 * u, weight: 600 }))
    if (o.over) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14 * u }
    lib.text(ctx, String(it), box.x + m + 100 * u, y + rowH / 2 + dy, { font: BODY(), size, weight: 600, color: S.fg, align: 'left' })
    ctx.restore()
  })
}

const fmtNum = (v, dec) => v.toFixed(dec).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
PAT.numero = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u)
  const n = b.number || { value: Number(String(b.headline).replace(/[^\d.,]/g, '').replace(',', '.')) || 0 }
  const end = Math.max(0.6, Math.min(1.4, dur - 0.4))
  const p = lib.prog(lt, 0.1, end, 'outExpo')
  const dec = Math.abs(n.value % 1) > 0 ? 1 : 0
  const str = (n.prefix ? n.prefix + ' ' : '') + fmtNum(n.value * p, dec) + (n.suffix || '')
  const full = (n.prefix ? n.prefix + ' ' : '') + fmtNum(n.value, dec) + (n.suffix || '')
  const size = Math.min(300 * u, lib.fit(ctx, full, box.w - m * 2, { font: HEAD(), size: 300 * u, weight: 700, spacing: -9 * u }))
  const y = box.y + box.h * 0.38
  const ap = lib.prog(lt, 0, 0.5, 'outExpo')
  ctx.save(); ctx.beginPath(); ctx.rect(box.x, y - size * 0.62, box.w, size * 1.24); ctx.clip()
  if (o.over) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30 * u }
  lib.text(ctx, str, box.x + m, y + (1 - ap) * size, { font: HEAD(), size, weight: 700, color: S.accent, align: 'left', spacing: -size * 0.03 })
  ctx.restore()
  ctx.fillStyle = S.line; ctx.fillRect(box.x + m, y + size * 0.6, box.w - m * 2, 4 * u)
  ctx.fillStyle = S.accent; ctx.fillRect(box.x + m, y + size * 0.6, (box.w - m * 2) * p, 4 * u)
  textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y: y + size * 0.6 + 50 * u, maxW: box.w - m * 2, size: 72 * u, maxLines: 3, shadow: o.over })
}

function card(ctx, x, y, w, h, fill, u) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.16)'; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 16 * u
  ctx.fillStyle = fill; lib.roundRect(ctx, x, y, w, h, Math.min(B().radius * 2, 36) * u + 2 * u); ctx.fill(); ctx.restore()
}

PAT.comparar = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u)
  const items = b.items && b.items.length >= 2 ? b.items : ['Antes', b.headline]
  const top0 = TOP(box, o, 0.12)
  const hh = textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y: top0, maxW: box.w - m * 2, size: 80 * u, maxLines: 2, shadow: o.over })
  const cw = box.w - m * 2, ch = Math.min(220 * u, box.h * 0.2)
  const second = Math.min(1.1, dur * 0.45)
  const y1 = top0 + hh + 70 * u
  const rows = [
    { y: y1, fill: S.dark ? rgba(B().paper, 0.08) : rgba(B().ink, 0.05), mark: 'erro', markC: S.muted, label: b.labels && b.labels[0] || 'Antes', str: items[0], at: 0.3, fg: S.fg, lab: S.muted },
    { y: y1 + ch + 30 * u, fill: S.kind === 'accent' ? S.fg : B().accent, mark: 'check', markC: S.kind === 'accent' ? S.bg : B().onAccent, label: b.labels && b.labels[1] || 'Depois', str: items[1], at: second, fg: S.kind === 'accent' ? S.bg : B().onAccent, lab: rgba(S.kind === 'accent' ? S.bg : B().onAccent, 0.72) },
  ]
  rows.forEach((r, i) => {
    const p = lib.prog(lt, r.at, r.at + 0.6, 'outExpo')
    if (p <= 0) return
    ctx.save(); ctx.globalAlpha = lib.clamp(p * 1.5); ctx.translate(0, (1 - p) * 60 * u)
    card(ctx, box.x + m, r.y, cw, ch, r.fill, u)
    icon(ctx, r.mark, box.x + m + 76 * u, r.y + ch / 2, 64 * u, r.markC, lib.prog(lt, r.at + 0.2, r.at + 0.7), 2)
    lib.text(ctx, String(r.label).toUpperCase(), box.x + m + 150 * u, r.y + ch * 0.32, { font: BODY(), size: 24 * u, weight: 600, color: r.lab, align: 'left', spacing: 3 * u })
    const str = String(r.str)
    const size = Math.min(52 * u, lib.fit(ctx, str, cw - 190 * u, { font: BODY(), size: 52 * u, weight: 700 }))
    lib.text(ctx, str, box.x + m + 150 * u, r.y + ch * 0.62, { font: BODY(), size, weight: 700, color: r.fg, align: 'left' })
    if (i === 0) { const sp = lib.prog(lt, second + 0.25, second + 0.6, 'inOutCubic'); if (sp > 0) { ctx.fillStyle = S.muted; ctx.fillRect(box.x + m + 150 * u, r.y + ch * 0.62, Math.min(cw - 190 * u, lib.measure(ctx, str, { font: BODY(), size, weight: 700 })) * sp, 4 * u) } }
    ctx.restore()
  })
}

PAT.processo = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u)
  const items = (b.items && b.items.length ? b.items : [b.headline]).slice(0, 4)
  const top0 = TOP(box, o, 0.12)
  const hh = textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y: top0, maxW: box.w - m * 2, size: 80 * u, maxLines: 2, shadow: o.over })
  const top = top0 + hh + 110 * u
  const step = items.length > 1 ? Math.min(190 * u, (box.y + box.h * 0.84 - top) / (items.length - 1)) : 0
  const x = box.x + m + 36 * u
  const gap = Math.min(0.7, Math.max(0.3, (dur - 0.7) / items.length))
  if (items.length > 1) {
    const lp = lib.prog(lt, 0.3, 0.3 + gap * (items.length - 1), 'inOutCubic')
    ctx.fillStyle = S.line; ctx.fillRect(x - 2 * u, top, 4 * u, step * (items.length - 1))
    ctx.fillStyle = S.accent; ctx.fillRect(x - 2 * u, top, 4 * u, step * (items.length - 1) * lp)
  }
  items.forEach((it, i) => {
    const at = 0.3 + i * gap
    const p = lib.prog(lt, at, at + 0.5, 'outExpo')
    if (p <= 0) return
    const y = top + i * step
    const on = S.kind === 'accent' ? S.bg : B().onAccent
    lib.at(ctx, x, y, { scale: lib.ease.outBack(lib.clamp((lt - at) / 0.4)) }, (c) => { c.fillStyle = S.kind === 'accent' ? S.fg : B().accent; lib.circle(c, 0, 0, 36 * u); c.fill(); lib.text(c, String(i + 1), 0, 2 * u, { font: HEAD(), size: 36 * u, weight: 700, color: on }) })
    const str = String(it)
    const size = Math.min(52 * u, lib.fit(ctx, str, box.w - m * 2 - 120 * u, { font: BODY(), size: 52 * u, weight: 600 }))
    ctx.save(); ctx.beginPath(); ctx.rect(x + 70 * u, y - 50 * u, box.w, 100 * u); ctx.clip()
    if (o.over) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14 * u }
    lib.text(ctx, str, x + 80 * u, y + (1 - p) * 70 * u, { font: BODY(), size, weight: 600, color: S.fg, align: 'left' })
    ctx.restore()
  })
}

PAT.foto = (ctx, b, lt, dur, box, S, u, o) => {
  const img = (b.clip && env.broll) || (b.photo && env.images[b.photo])
  if (!img) return PAT.titulo(ctx, b, lt, dur, box, S, u, o)
  const m = M(box, u)
  const ar = img.width / img.height
  let w = box.w - m * 2, h = w / ar
  if (h > box.h * 0.5) { h = box.h * 0.5; w = h * ar }
  const cx = box.x + box.w / 2, cy = box.y + box.h * 0.36
  const p = lib.prog(lt, 0, 0.8, 'outExpo')
  ctx.save()
  ctx.beginPath(); ctx.rect(box.x, cy - h / 2 - 80 * u, box.w, (h + 220 * u) * p + 1); ctx.clip()
  photoCard(ctx, img, cx, cy + (1 - p) * 80 * u, w, h, lt, S, u)
  ctx.restore()
  textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y: cy + h / 2 + 90 * u, maxW: box.w - m * 2, size: 84 * u, maxLines: 3, shadow: o.over })
}

PAT.pergunta = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u)
  const qp = lib.prog(lt, 0, 0.7, 'outExpo')
  ctx.save(); ctx.globalAlpha = 0.95 * qp
  lib.text(ctx, '?', box.x + box.w - m, box.y + box.h * 0.28 + (1 - qp) * 120 * u, { font: EMPH(), size: 480 * u, weight: EMPH() === HEAD() ? 700 : 400, italic: emphItalic(), color: S.accent, align: 'right' })
  ctx.restore()
  textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y: box.y + box.h * 0.58, valign: 'center', maxW: box.w - m * 2.2, size: 112 * u, maxLines: 4, shadow: o.over })
}

PAT.citacao = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u)
  const qp = lib.prog(lt, 0, 0.6, 'outExpo')
  lib.text(ctx, '“', box.x + m - 10 * u, box.y + box.h * 0.28 + (1 - qp) * 60 * u, { font: EMPH(), size: 280 * u, weight: 400, italic: emphItalic(), color: rgba(S.accent, qp), align: 'left' })
  textBlock(ctx, b, lt, S, { text: b.headline, x: box.x + m, y: box.y + box.h * 0.36, maxW: box.w - m * 2, size: 100 * u, font: EMPH(), weight: EMPH() === HEAD() ? 600 : 400, spacing: 0, maxLines: 5, leading: 1.12, step: 0.1, shadow: o.over })
  if (b.sub) textBlock(ctx, b, lt, S, { text: '— ' + b.sub, x: box.x + m, y: box.y + box.h * 0.8, maxW: box.w - m * 2, size: 36 * u, font: BODY(), weight: 600, color: S.muted, emph: false, at: 1, spacing: 0, shadow: o.over })
}

function logoFor(S) {
  return env.images[S.dark ? '__logo_dark' : '__logo_light'] || env.images[S.dark ? '__logo_light' : '__logo_dark'] || null
}

PAT.cta = (ctx, b, lt, dur, box, S, u, o) => {
  const m = M(box, u), cx = box.x + box.w / 2
  const logo = logoFor(S)
  let y = box.y + box.h * (o.free ? 0.34 : 0.3)
  if (logo) {
    const lp = lib.prog(lt, 0, 0.6, 'outExpo')
    const lh = (b.fullScreen ? 155 : 84) * u, lw = Math.min(box.w * (b.fullScreen ? 0.72 : 0.5), (logo.width / logo.height) * lh)
    ctx.save(); ctx.globalAlpha = lp; lib.image(ctx, logo, cx, y + (1 - lp) * 30 * u, lw, lh, 'contain'); ctx.restore()
    y += (b.fullScreen ? 205 : 130) * u
  }
  const h = textBlock(ctx, b, lt, S, { text: b.headline, x: cx, align: 'center', y, maxW: box.w - m * 2, size: 104 * u, maxLines: 3, at: 0.15, shadow: o.over })
  // Frase longa no sub vira texto de apoio; o botão só aparece com rótulo curto (ou "Seguir")
  const longSub = b.sub && (b.sub.length > 22 || b.sub.split(/\s+/).length > 3)
  let extra = 0
  if (longSub) extra = textBlock(ctx, b, lt, S, { text: b.sub, x: cx, align: 'center', y: y + h + 36 * u, maxW: box.w - m * 2, size: 40 * u, font: BODY(), weight: 500, color: S.muted, emph: false, at: 0.45, spacing: 0, leading: 1.3, shadow: o.over }) + 20 * u
  const bp = lib.prog(lt, 0.55, 1.1, 'outExpo')
  if (bp > 0 && !longSub) {
    const caps = B().radius < 4
    const label = caps ? String(b.sub || 'Seguir').toUpperCase() : String(b.sub || 'Seguir')
    const opts = { font: BODY(), size: 44 * u, weight: 700, spacing: caps ? 3 * u : 0 }
    const w = lib.measure(ctx, label, opts) + 120 * u, bh = 108 * u
    const by = y + h + extra + 110 * u
    const beat = lt > 1.1 ? 1 + lib.pulse((lt - 1.1) % 1.2, 0, 0.35) * 0.04 : 1
    const fill = S.kind === 'accent' ? S.fg : B().accent, on = S.kind === 'accent' ? S.bg : B().onAccent
    lib.at(ctx, cx, by + (1 - bp) * 40 * u, { scale: beat, alpha: bp }, (c) => {
      c.fillStyle = fill; lib.roundRect(c, -w / 2, -bh / 2, w, bh, Math.min(B().radius * 2, bh / 2)); c.fill()
      lib.text(c, label, 0, 2 * u, { ...opts, color: on })
    })
  }
}

PAT.default = PAT.titulo

// ——— Fundo, transições, legenda ———
function background(ctx, b, i, lt, box, S, u, o) {
  if (o.over) return
  ctx.fillStyle = S.bg; ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4)
  // O número grande e apagado do momento: estrutura editorial, não enfeite
  if (b.pattern !== 'numero' && b.pattern !== 'cta' && b.pattern !== 'pergunta') {
    const p = lib.prog(lt, 0, 1.2, 'outExpo')
    lib.text(ctx, ('0' + (i + 1)).slice(-2), box.x + box.w - M(box, u) + 20 * u, box.y + box.h * 0.88 + (1 - p) * 60 * u, { font: HEAD(), size: 280 * u, weight: 700, color: rgba(S.fg, 0.05 * p), align: 'right', spacing: -12 * u })
  }
}

function drawBeat(ctx, i, t, box, o) {
  const b = env.data.beats[i]
  const lt = t - b.start, dur = b.end - b.start
  const S = o.over ? surface('ink') : surfaceOf(b, i)
  const u = o.u
  background(ctx, b, i, lt, box, S, u, o)
  const cam = 1 + Math.min(lt, 8) * 0.006
  ctx.save()
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2); ctx.scale(cam, cam); ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2))
  const free = !env.data.words.length || env.data.captions === 'nenhuma'
  ;(PAT[b.pattern] || PAT.default)(ctx, b, lt, dur, box, S, u, { ...o, index: i, free: free && !o.over && box.h > 1500 })
  ctx.restore()
  return S
}

function withClip(ctx, box, fn) { ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip(); fn(); ctx.restore() }

function current(t) {
  const beats = env.data.beats
  let i = 0
  while (i + 1 < beats.length && beats[i + 1].start <= t) i++
  return i
}

function animation(ctx, t, box, o) {
  const beats = env.data.beats
  if (!beats.length) return surface('paper')
  const i = current(t)
  const b = beats[i]
  const into = t - b.start
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  let S = null
  withClip(ctx, box, () => {
    const tr = b.transition
    if (i === 0 || into >= TIN || tr === 'corte' || tr === 'flash') {
      if (tr === 'corte' && i > 0 && into < 0.3) {
        const k = 1 + lib.pulse(into, 0, 0.3) * 0.05
        ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); S = drawBeat(ctx, i, t, box, o); ctx.restore()
      } else S = drawBeat(ctx, i, t, box, o)
      if (tr === 'flash' && i > 0 && into < 0.12) { ctx.fillStyle = B().accent; ctx.globalAlpha = 1 - into / 0.12; ctx.fillRect(box.x, box.y, box.w, box.h); ctx.globalAlpha = 1 }
      return
    }
    const p = lib.clamp(into / TIN)
    if (tr === 'chicote') {
      const e = lib.ease.inOutExpo(p), dx = box.w
      const speed = Math.sin(p * Math.PI)
      ctx.save(); ctx.translate(-e * dx, 0); drawBeat(ctx, i - 1, b.start - 0.001, box, o); ctx.restore()
      for (let g = 2; g >= 1; g--) { ctx.save(); ctx.globalAlpha = 0.1 * speed; ctx.translate((1 - e) * dx + g * 36 * o.u * speed, 0); drawBeat(ctx, i, t, box, o); ctx.restore() }
      ctx.save(); ctx.translate((1 - e) * dx, 0); S = drawBeat(ctx, i, t, box, o); ctx.restore()
    } else if (tr === 'zoom') {
      const e = lib.ease.inExpo(lib.clamp(p * 1.3))
      ctx.save(); ctx.globalAlpha = 1 - e; ctx.translate(cx, cy); ctx.scale(1 + e * 0.6, 1 + e * 0.6); ctx.translate(-cx, -cy); drawBeat(ctx, i - 1, b.start - 0.001, box, o); ctx.restore()
      const k = lib.ease.outExpo(p)
      ctx.save(); ctx.globalAlpha = k; ctx.translate(cx, cy); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); ctx.translate(-cx, -cy); S = drawBeat(ctx, i, t, box, o); ctx.restore()
    } else {
      // Painel na cor da marca: cobre da esquerda e descobre o momento novo
      const cover = lib.ease.inOutExpo(lib.clamp(p * 2)), reveal = lib.ease.inOutExpo(lib.clamp(p * 2 - 1))
      if (p < 0.5) drawBeat(ctx, i - 1, b.start - 0.001, box, o)
      else S = drawBeat(ctx, i, t, box, o)
      ctx.fillStyle = B().accent
      const x0 = box.x + box.w * reveal, x1 = box.x + box.w * cover
      ctx.fillRect(x0, box.y, Math.max(0, x1 - x0), box.h)
    }
  })
  return S || (o.over ? surface('ink') : surfaceOf(b, i))
}

function groups(words, max) {
  const out = []
  let cur = []
  words.forEach((w, i) => {
    cur.push(w)
    const n = words[i + 1]
    if (!n || cur.length >= max || n.s - w.e > 0.35 || /[.!?,]$/.test(w.w)) { out.push(cur); cur = [] }
  })
  return out
}

function captions(ctx, t, y, S, u, W, over) {
  const d = env.data, style = d.captions
  if (!style || style === 'nenhuma' || !d.words.length) return
  const G = env.state.groups[style] || (env.state.groups[style] = groups(d.words, style === 'karaoke' ? 6 : style === 'contorno' ? 1 : 3))
  let g = null
  for (let i = 0; i < G.length; i++) {
    const a = G[i][0].s - 0.05, n = G[i + 1], z = n ? Math.min(n[0].s - 0.05, G[i][G[i].length - 1].e + 0.6) : G[i][G[i].length - 1].e + 0.6
    if (t >= a && t < z) { g = G[i]; break }
  }
  if (!g) return
  const clean = (w) => w.w.replace(/[.,!?;:]+$/, '')
  const cur = g.findIndex((w, i) => t >= w.s - 0.03 && (i === g.length - 1 || t < g[i + 1].s - 0.03))
  const b = B()
  // Sobre vídeo: texto claro com contorno; sobre a marca: as cores do fundo da vez
  const fg = over ? '#FFFFFF' : S.fg
  const hi = over ? b.accentOnDark : S.kind === 'accent' ? S.fg : S.accent
  const stroke = over ? 'rgba(0,0,0,0.85)' : undefined
  if (style === 'contorno') {
    const w = g[0], p = lib.clamp((t - w.s + 0.03) / 0.16)
    const str = clean(w).toUpperCase(), size = Math.min(132 * u, lib.fit(ctx, str, W * 0.84, { font: HEAD(), size: 132 * u, weight: 800 }))
    lib.at(ctx, W / 2, y, { scale: 0.85 + 0.15 * lib.ease.outBack(p), alpha: lib.clamp(p * 3) }, (c) => lib.text(c, str, 0, 0, { font: HEAD(), size, weight: 800, color: '#FFFFFF', stroke: '#000000', strokeWidth: 18 * u }))
    return
  }
  const size = (style === 'karaoke' ? 52 : 60) * u
  const font = { font: BODY(), size, weight: 700 }
  const words = g.map(clean)
  const space = lib.measure(ctx, ' ', font)
  const ws = words.map((w) => lib.measure(ctx, w, font))
  const lines = []
  let line = [], lw = 0
  ws.forEach((w, i) => { if (line.length && lw + space + w > W * 0.84) { lines.push({ idx: line, w: lw }); line = []; lw = 0 } line.push(i); lw += (line.length > 1 ? space : 0) + w })
  if (line.length) lines.push({ idx: line, w: lw })
  const lh = size * 1.3
  const top = y - ((lines.length - 1) * lh) / 2
  if (style === 'caixa') {
    const p = lib.clamp((t - g[0].s + 0.05) / 0.18)
    const bw = Math.max(...lines.map((l) => l.w)) + 56 * u, bh = lines.length * lh + 28 * u
    const fill = over ? '#FFFFFF' : S.dark ? b.paper : b.ink
    lib.at(ctx, W / 2, y, { scale: 0.9 + 0.1 * lib.ease.outBack(p), alpha: lib.clamp(p * 3) }, (c) => { c.fillStyle = fill; lib.roundRect(c, -bw / 2, -bh / 2, bw, bh, Math.min(b.radius * 2, 24) * u + 6 * u); c.fill() })
  }
  lines.forEach((l, li) => {
    let x = W / 2 - l.w / 2
    const ly = top + li * lh
    l.idx.forEach((i) => {
      const w = g[i], on = i === cur, said = t >= w.s - 0.03
      const p = lib.clamp((t - w.s + 0.05) / 0.14)
      const cx = x + ws[i] / 2
      if (style === 'karaoke') {
        if (on) { ctx.fillStyle = b.accent; lib.roundRect(ctx, x - 12 * u, ly - size * 0.66, ws[i] + 24 * u, size * 1.32, Math.min(b.radius * 2, 18) * u + 4 * u); ctx.fill() }
        lib.text(ctx, words[i], cx, ly, { ...font, color: on ? b.onAccent : said ? fg : rgba(over ? '#FFFFFF' : S.fg, 0.45), stroke: on ? undefined : stroke, strokeWidth: 10 * u })
      } else if (style === 'caixa') {
        if (p > 0) lib.text(ctx, words[i], cx, ly, { ...font, color: on ? (over || !S.dark ? b.accentOnDark : b.accentOnLight) : (over ? '#111111' : S.dark ? b.ink : b.paper) })
      } else if (p > 0) {
        lib.at(ctx, cx, ly + (1 - lib.ease.outExpo(p)) * 18 * u, { alpha: lib.clamp(p * 2) }, (c) => lib.text(c, words[i], 0, 0, { ...font, color: on ? hi : fg, stroke, strokeWidth: 12 * u }))
      }
      x += ws[i] + space
    })
  })
}

/** Onde e em que escala o vídeo da pessoa entra na caixa (o mesmo para o quadro e para a máscara do recorte). */
function videoXf(x, y, w, h, t) {
  const v = env.video
  const beats = env.data.beats
  const i = current(t)
  // Zoom de corte nos momentos ímpares (o "punch in" dos vídeos falados)
  const punch = beats.length && i % 2 === 1 ? 1.1 : 1
  const kick = beats.length ? lib.pulse(t - beats[i].start, 0, 0.2) * 0.02 : 0
  const k = Math.max(w / v.width, h / v.height) * (punch + kick)
  const positionY = Math.max(0, Math.min(1, env.data.videoPositionY ?? 0.5))
  const cropOffset = (0.5 - positionY) * Math.max(0, v.height * k - h)
  return { x, y, w, h, k, vw: v.width, vh: v.height, cx: x + w / 2, cy: y + h / 2 + cropOffset + (env.data.videoPositionY == null && punch > 1 ? h * 0.03 : 0) }
}
/** Desenha o quadro (ou a máscara, que tem o mesmo formato em outro tamanho) com a posição de videoXf. */
function drawSrc(ctx, src, P) {
  ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip()
  ctx.translate(P.cx, P.cy)
  if (env.data.mirror) ctx.scale(-1, 1)
  ctx.drawImage(src, -P.vw * P.k / 2, -P.vh * P.k / 2, P.vw * P.k, P.vh * P.k)
  ctx.restore()
}
function drawVideo(ctx, x, y, w, h, t) {
  if (!env.video) {
    ctx.fillStyle = '#1b1b1f'; ctx.fillRect(x, y, w, h)
    lib.text(ctx, 'você aqui', x + w / 2, y + h / 2, { font: BODY(), size: 40, weight: 600, color: 'rgba(255,255,255,0.4)' })
    return
  }
  drawSrc(ctx, env.video, videoXf(x, y, w, h, t))
}

// ——— Efeitos com recorte (2026-11-09; o reel "20 video effects in 20 seconds") ———
// env.mask é o recorte da pessoa no quadro (recorte.ts): alfa = pessoa. Cada quadro sai em camadas:
// o fundo (o próprio vídeo, escurecido ou desfocado), o efeito, a pessoa recortada e o que vai na frente.

/** A pessoa recortada, numa tela do tamanho do vídeo (borda levemente suavizada). */
function personLayer(P) {
  if (!env.mask || !env.video) return null
  const st = env.state
  if (!st.person || st.person.width !== env.width || st.person.height !== env.height) { st.person = new OffscreenCanvas(env.width, env.height); st.pctx = st.person.getContext('2d') }
  const c = st.pctx
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.filter = 'none'
  c.clearRect(0, 0, env.width, env.height)
  drawSrc(c, env.video, P)
  c.globalCompositeOperation = 'destination-in'
  c.filter = 'blur(' + Math.max(1, Math.round(env.width / 720)) + 'px)'
  drawSrc(c, env.mask, P)
  // As bordas do quadro somem em degradê: com a pessoa diminuída, o corte do vídeo viraria uma linha reta
  c.filter = 'none'
  const W = env.width, H = env.height, e = W * 0.16
  const gx = c.createLinearGradient(0, 0, W, 0)
  gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(e / W, '#000'); gx.addColorStop(1 - e / W, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = gx; c.fillRect(0, 0, W, H)
  const gy = c.createLinearGradient(0, 0, 0, H * 0.1)
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, '#000')
  // destination-in apaga o que fica fora do que se pinta: o degradê cobre a tela toda (abaixo do topo é preto)
  c.fillStyle = gy; c.fillRect(0, 0, W, H)
  c.globalCompositeOperation = 'source-over'
  return st.person
}

/** A cabeça, achada na máscara em miniatura: o topo, o centro e a largura (suavizados entre quadros). */
function headOf(person) {
  const W = env.width, H = env.height, st = env.state
  const fallback = { top: H * 0.3, cx: W / 2, w: W * 0.28, cy: H * 0.36 }
  if (!person) return st.head || fallback
  const qw = 54, qh = 96
  if (!st.probe) { st.probe = new OffscreenCanvas(qw, qh); st.qctx = st.probe.getContext('2d', { willReadFrequently: true }) }
  const q = st.qctx
  q.clearRect(0, 0, qw, qh); q.drawImage(person, 0, 0, qw, qh)
  const a = q.getImageData(0, 0, qw, qh).data
  let top = -1
  for (let y = 0; y < qh && top < 0; y++) { let n = 0; for (let x = 0; x < qw; x++) if (a[(y * qw + x) * 4 + 3] > 128) n++; if (n >= 2) top = y }
  if (top < 0) return st.head || fallback
  let sx = 0, n = 0, minX = qw, maxX = 0
  for (let y = top; y < Math.min(qh, top + 9); y++) for (let x = 0; x < qw; x++) if (a[(y * qw + x) * 4 + 3] > 128) { sx += x; n++; if (x < minX) minX = x; if (x > maxX) maxX = x }
  const w = Math.max(W * 0.14, (maxX - minX + 1) * (W / qw))
  const now = { top: top * (H / qh), cx: (sx / n + 0.5) * (W / qw), w, cy: top * (H / qh) + w * 0.62 }
  const prev = st.head
  st.head = prev ? { top: lib.lerp(prev.top, now.top, 0.45), cx: lib.lerp(prev.cx, now.cx, 0.45), w: lib.lerp(prev.w, now.w, 0.45), cy: lib.lerp(prev.cy, now.cy, 0.45) } : now
  return st.head
}

const FX_ORDER = ['texto-fundo', 'orbita', 'texto-fundo', 'parede', 'clones', 'texto-fundo', 'foco']
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
/** A palavra de destaque do momento (o *destaque*, o highlight ou a mais longa). */
function keyWord(b) {
  return ((b.highlight && b.highlight[0]) || ((b.headline || '').match(/\*([^*]+)\*/) || [])[1] || tokens(b, b.headline).map((x) => x.text).sort((a, z) => z.length - a.length)[0] || '').replace(/[.,!?;:]+$/, '')
}
/** Some no fim do momento (os últimos 0,22 s). */
const outOf = (lt, dur) => 1 - lib.prog(lt, dur - 0.22, dur, 'inCubic')

/**
 * Texto cinético atrás da pessoa: cada linha (uma ou duas palavras) ocupa a largura e sobe de trás de um
 * corte esticada na vertical, quando a primeira palavra dela é falada. O destaque sai na cor da marca.
 */
function backText(ctx, b, lt, dur, W, H, u, head, only) {
  const all = only ? [{ text: only, emph: true }] : tokens(b, b.headline).slice(0, 6)
  if (!all.length) return
  const lines = []
  for (const tk of all) { const last = lines[lines.length - 1]; if (last && last.length < 2 && (last[0].text + tk.text).length <= 9) last.push(tk); else lines.push([tk]) }
  const italic = emphItalic()
  const fontOf = (tk) => (tk.emph && italic ? { font: EMPH(), weight: 400, italic: true } : { font: HEAD(), weight: 900 })
  const maxW = W * 0.92
  const sized = lines.map((ln) => {
    const strs = ln.map((tk) => tk.text.toUpperCase())
    const at = 400 * u
    const width = strs.reduce((s2, str, k) => s2 + lib.measure(ctx, str, { ...fontOf(ln[k]), size: at }), 0) + (ln.length - 1) * at * 0.22
    const size = Math.min(at * 1.25, at * maxW / width)
    return { ln, strs, size, width: width * size / at }
  })
  const lh = (x) => x.size * 0.86
  const total = sized.reduce((s2, x) => s2 + lh(x), 0)
  // A cabeça cobre a parte de baixo do bloco: o texto fica "na parede", atrás dela
  let y = Math.max(190 * u, Math.min(head.top + head.w * 0.35 - total, H * 0.5 - total))
  const out = outOf(lt, dur)
  const times = spokenTimes(b, all, 0.12)
  let wi = 0
  const b2 = B()
  for (const L of sized) {
    const at = times[wi] || 0
    wi += L.ln.length
    const p = lib.prog(lt, at, at + 0.42, 'outExpo')
    if (p > 0) {
      const top = y, h = lh(L)
      // O corte de baixo faz a linha subir de trás dele; em cima sobra espaço para os acentos (Ã, Ó)
      ctx.save(); ctx.beginPath(); ctx.rect(0, top - h * 0.34, W, h * 1.42); ctx.clip()
      ctx.globalAlpha = out
      ctx.translate(W / 2, top + h / 2 + (1 - p) * h * 1.1 - (1 - out) * h * 0.6)
      ctx.scale(1, 1 + (1 - p) * 0.55)
      let x = -L.width / 2
      L.ln.forEach((tk, k) => {
        const f = fontOf(tk), w = lib.measure(ctx, L.strs[k], { ...f, size: L.size })
        lib.text(ctx, L.strs[k], x + w / 2, 0, { ...f, size: L.size, color: tk.emph ? b2.accentOnDark : b2.paper })
        x += w + L.size * 0.22
      })
      ctx.restore()
    }
    y += lh(L)
  }
}

/** A palavra de destaque em anel em volta da cabeça. front: só as letras da frente (depois da pessoa). */
function orbit(ctx, b, lt, dur, u, head, front) {
  const word = keyWord(b).toUpperCase()
  if (!word) return
  const grow = lib.prog(lt, 0, 0.5, 'outBack'), out = outOf(lt, dur)
  const rx = Math.max(head.w * 0.95, 230 * u) * (0.6 + 0.4 * grow), ry = rx * 0.26
  const cx = head.cx, cy = head.top + head.w * 0.42
  const size = Math.max(46 * u, Math.min(86 * u, rx * 0.2))
  const chunk = word + ' • '
  const n = Math.max(chunk.length, Math.round((2 * Math.PI * rx) / (size * 0.78) / chunk.length) * chunk.length)
  const str = chunk.repeat(Math.ceil(n / chunk.length)).slice(0, n)
  const tilt = -0.1, spin = lt * 1.5
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt)
  for (let k = 0; k < n; k++) {
    // O ângulo diminui com k: na frente do anel (seno positivo) as letras ficam da esquerda para a direita
    const th = -(k / n) * Math.PI * 2 - spin, sn = Math.sin(th)
    if ((sn >= 0) !== front) continue
    const x = Math.cos(th) * rx, y2 = sn * ry
    const depth = (sn + 1) / 2
    lib.at(ctx, x, y2, { scale: 0.78 + 0.34 * depth, alpha: (0.55 + 0.45 * depth) * out * lib.clamp(grow * 1.5) }, (c) => {
      c.scale(0.3 + 0.7 * Math.abs(sn), 1)
      lib.text(c, str[k], 0, 0, { font: HEAD(), size, weight: 800, color: B().paper, stroke: 'rgba(0,0,0,0.35)', strokeWidth: size * 0.08 })
    })
  }
  ctx.restore()
}

/** A grade que acende quadrado a quadrado atrás da pessoa, com um contador. */
function postWall(ctx, b, lt, dur, W, H, u, head) {
  const b2 = B()
  const cols = 16, rows = 6, gap = 5 * u
  const cell = (W * 0.9 - gap * (cols - 1)) / cols
  const gh = rows * (cell + gap)
  const x0 = W * 0.05, y0 = Math.max(260 * u, Math.min(head.top + head.w * 0.25 - gh, H * 0.42 - gh))
  const out = outOf(lt, dur)
  const colors = [b2.paper, lib.mix(b2.paper, b2.ink, 0.35), b2.accent, lib.mix(b2.accent, b2.paper, 0.45), lib.mix(b2.paper, b2.ink, 0.6)]
  const span = Math.max(0.6, dur * 0.7)
  let lit = 0
  ctx.save(); ctx.globalAlpha = out
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c
    const on = 0.12 + hash(i) * span
    const p = lib.prog(lt, on, on + 0.18, 'outCubic')
    const x = x0 + c * (cell + gap), y = y0 + r * (cell + gap)
    ctx.fillStyle = rgba(b2.paper, 0.07); ctx.fillRect(x, y, cell, cell)
    if (p > 0) {
      lit++
      const sc = 0.6 + 0.4 * lib.ease.outBack(p)
      ctx.fillStyle = colors[Math.floor(hash(i + 99) * colors.length)]
      ctx.fillRect(x + cell * (1 - sc) / 2, y + cell * (1 - sc) / 2, cell * sc, cell * sc)
    }
  }
  const nb = b.number
  const value = nb ? Math.round(nb.value * lib.prog(lt, 0.1, span + 0.2, 'outCubic')) : lit
  const label = nb ? (nb.prefix || '') + value.toLocaleString('pt-BR') + (nb.suffix || '') : value.toLocaleString('pt-BR')
  lib.text(ctx, label, x0 + W * 0.9, y0 - 70 * u, { font: HEAD(), size: 120 * u, weight: 800, color: b2.paper, align: 'right' })
  const kw = keyWord(b)
  if (kw) lib.text(ctx, kw.toUpperCase(), x0, y0 - 40 * u, { font: BODY(), size: 34 * u, weight: 700, color: b2.accentOnDark, align: 'left', spacing: 6 * u })
  ctx.restore()
}

/** Cópias da pessoa em fileira, menores e mais escuras, abrindo do centro para os lados. */
function clones(ctx, lt, dur, W, H, drawPerson, head) {
  const out = outOf(lt, dur)
  for (let k = 3; k >= 1; k--) {
    const p = lib.prog(lt, 0.05 + k * 0.07, 0.45 + k * 0.07, 'outCubic')
    if (p <= 0) continue
    const s = 0.86 - k * 0.13
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.globalAlpha = out * lib.clamp(p * 1.4)
      ctx.filter = 'brightness(' + (0.72 - k * 0.1) + ')'
      ctx.translate(head.cx + side * W * 0.21 * k * p, H * 0.97)
      ctx.scale(s, s)
      ctx.translate(-head.cx, -H * 0.97)
      drawPerson(ctx)
      ctx.restore()
    }
  }
}

/**
 * O fundo de estúdio na cor da marca: quando a pessoa é diminuída para caber o efeito, o fundo original
 * (com ela grande) não serve mais.
 */
function studio(ctx, W, H, head) {
  const b = B()
  ctx.fillStyle = b.ink; ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(head.cx, head.top + head.w * 0.6, 0, head.cx, head.top + head.w * 0.6, H * 0.7)
  g.addColorStop(0, rgba(b.accent, 0.42)); g.addColorStop(0.45, rgba(b.accent, 0.14)); g.addColorStop(1, rgba(b.accent, 0))
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}

// ——— Efeitos das skills de vídeo (2026-11-09: effects-carousel, effects-orbit, effects-split, effects-chart) ———

/**
 * Os cartões do carrossel e da órbita: as fotos do vídeo; com menos de 4, completa com cartões da marca
 * (o ícone e a palavra de destaque de cada momento), para o efeito nunca sair vazio.
 */
function mediaCards() {
  const st = env.state
  if (st.cards) return st.cards
  const d = env.data, b = B(), out = []
  for (const name of d.photos || []) if (env.images[name]) out.push(env.images[name])
  const kinds = [[b.accent, lib.mix(b.accent, '#000000', 0.35), b.onAccent], [b.ink, lib.mix(b.ink, b.accent, 0.3), b.paper], [b.paper, lib.mix(b.paper, b.accent, 0.14), b.ink]]
  for (let i = 0; out.length < 8 && i < Math.max(8, d.beats.length); i++) {
    if (out.length >= 4 && i >= d.beats.length) break
    const bt = d.beats[i % Math.max(1, d.beats.length)] || {}
    const k = kinds[i % 3], c = new OffscreenCanvas(300, 533), g = c.getContext('2d')
    const gr = g.createLinearGradient(0, 0, 300, 533); gr.addColorStop(0, k[0]); gr.addColorStop(1, k[1]); g.fillStyle = gr; g.fillRect(0, 0, 300, 533)
    g.fillStyle = rgba(k[2], 0.12); for (let y = 30; y < 533; y += 34) g.fillRect(24, y, 252, 1)
    const name = iconOf(bt) || ((d.icons || {}).brilho ? 'brilho' : null)
    if (name) icon(g, name, 150, 210, 120, k[2], 1, 1.4)
    else { g.fillStyle = rgba(k[2], 0.9); lib.circle(g, 150, 210, 54); g.fill() }
    const kw = keyWord(bt).toUpperCase() || String(i + 1).padStart(2, '0')
    lib.text(g, kw, 150, 400, { font: HEAD(), size: Math.min(54, lib.fit(g, kw, 250, { font: HEAD(), size: 54, weight: 800 })), weight: 800, color: k[2] })
    lib.text(g, String(i + 1).padStart(2, '0'), 30, 40, { font: BODY(), size: 22, weight: 700, color: rgba(k[2], 0.7), align: 'left' })
    out.push(c)
  }
  return (st.cards = out)
}
/** Um cartão 9:16 com canto arredondado, sombra e a imagem cobrindo. */
function mediaCard(ctx, img, x, y, w, h, r, u) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 20 * u
  ctx.fillStyle = B().ink; lib.roundRect(ctx, x, y, w, h, r); ctx.fill(); ctx.restore()
  ctx.save(); lib.roundRect(ctx, x, y, w, h, r); ctx.clip(); lib.image(ctx, img, x + w / 2, y + h / 2, w, h, 'cover'); ctx.restore()
}

/** Duas fileiras infinitas de cartões passando atrás da pessoa, em sentidos opostos, com as bordas sumindo. */
function carousel(ctx, lt, dur, W, H, u, cut) {
  const cards = mediaCards()
  if (!cards.length) return
  const out = outOf(lt, dur), inn = lib.prog(lt, 0, 0.4, 'outCubic')
  const cw = 300 * u, ch = 533 * u, step = cw + 28 * u
  const n = Math.max(cards.length, Math.ceil((W + cw) / step) + 1), total = n * step
  ;(cut ? [{ y: H * 0.3, speed: 66 * u, dir: -1, seed: 0 }, { y: H * 0.62, speed: 45 * u, dir: 1, seed: 3 }] : [{ y: H * 0.8, speed: 52 * u, dir: -1, seed: 0 }]).forEach((row) => {
    const shift = lt * row.speed + (1 - inn) * W * 0.35
    for (let k = 0; k < n; k++) {
      const x = ((k * step + row.dir * shift) % total + total) % total - step
      if (x > W || x + cw < 0) continue
      const edge = lib.clamp(Math.min(x + cw, W - x) / (W * 0.16))
      ctx.save(); ctx.globalAlpha = out * inn * edge
      mediaCard(ctx, cards[(k + row.seed) % cards.length], x, row.y - ch / 2, cw, ch, 24 * u, u)
      ctx.restore()
    }
  })
}

/**
 * Cartões girando em órbita inclinada em volta da pessoa: os de trás passam mais alto (atrás da cabeça) e
 * menores; os da frente, mais baixo, na frente do tronco. front: só os da frente (desenhados depois da pessoa).
 */
function orbitCards(ctx, lt, dur, W, H, u, head, front) {
  const all = mediaCards()
  if (!all.length) return
  const N = Math.min(7, Math.max(5, all.length))
  const grow = lib.prog(lt, 0, 0.6, 'outBack'), out = outOf(lt, dur)
  const RX = Math.min(W * 0.42, 470 * u), TILT = Math.max(150 * u, head.w * 0.75)
  const CX = head.cx, CY = Math.min(H * 0.7, head.cy + head.w * 0.85)
  const list = []
  for (let i = 0; i < N; i++) {
    const th = (i * 2 * Math.PI) / N + (2 * Math.PI * lt) / 8
    const depth = Math.cos(th)
    if ((depth >= 0) !== front) continue
    const born = lib.prog(lt, i * 0.1, i * 0.1 + 0.6, 'outBack')
    list.push({ img: all[i % all.length], depth, x: CX + Math.sin(th) * RX * grow * born, y: CY + depth * TILT, s: (0.62 + 0.46 * (depth + 1) / 2) * born, sx: Math.max(0.35, Math.cos(Math.sin(th) * 0.5)), o: (0.7 + 0.3 * (depth + 1) / 2) * out })
  }
  list.sort((a, z) => a.depth - z.depth)
  const cw = 250 * u, ch = 444 * u
  for (const c of list) {
    if (c.s <= 0.01) continue
    ctx.save(); ctx.globalAlpha = lib.clamp(c.o)
    if (c.depth < 0) ctx.filter = 'blur(' + (2.5 * -c.depth * u).toFixed(1) + 'px)'
    ctx.translate(c.x, c.y); ctx.scale(c.s * c.sx, c.s)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 6 * u
    mediaCard(ctx, c.img, -cw / 2, -ch / 2, cw, ch, 20 * u, u)
    lib.roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 20 * u); ctx.stroke()
    ctx.restore()
  }
}

/** Tela dividida: o motion do momento em cima (os padrões do roteiro), a pessoa embaixo e a legenda na emenda. */
function splitFx(ctx, t, W, H, u) {
  const split = Math.round(H * 0.47)
  const S = animation(ctx, t, { x: 0, y: 0, w: W, h: split }, { u: Math.min(W / 1080, split / 1150) })
  drawVideo(ctx, 0, split, W, H - split, t)
  const g = ctx.createLinearGradient(0, split, 0, split + 220 * u); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, split, W, 220 * u)
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = B().accent; ctx.fillRect(0, split - 2 * u, W, 4 * u); ctx.restore()
  env.state.capY = split + 30 * u
  return S
}

/** Números do roteiro que dão um gráfico: "Instagram 40%", "Site: 1.200" (só os escritos, nunca inventados). */
function chartData(b) {
  const rows = []
  for (const it of b.items || []) {
    const m = String(it).match(/(-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:[.,]\d+)?)\s*(%|x|mil|k)?/i)
    if (!m) return null
    const value = parseFloat(m[1].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
    const label = String(it).replace(m[0], '').replace(/[:–—-]\s*$|^\s*[:–—-]/g, '').trim()
    rows.push({ value, text: m[0].trim(), label })
  }
  return rows.length >= 2 ? rows.slice(0, 6) : null
}

/**
 * Gráfico: fundo de papel quadriculado, a pessoa num painel com topo em arco embaixo e, em cima, o que a
 * fala pede: barras (itens com número), número gigante que conta (o número do momento), lista ou título
 * com a palavra de destaque sublinhada.
 */
function chartFx(ctx, t, b, lt, dur, W, H, u) {
  const br = B(), S = surface('paper')
  ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = rgba(br.ink, 0.06)
  for (let x = 0; x < W; x += 44 * u) ctx.fillRect(x, 0, Math.max(1, u), H)
  for (let y = 0; y < H; y += 44 * u) ctx.fillRect(0, y, W, Math.max(1, u))
  const top = Math.round(H * 0.5), m = 24 * u, arc = 150 * u
  ctx.save(); ctx.beginPath()
  ctx.moveTo(m, H); ctx.lineTo(m, top + arc); ctx.ellipse(W / 2, top + arc, (W - 2 * m) / 2, arc, 0, Math.PI, Math.PI * 2); ctx.lineTo(W - m, H); ctx.closePath()
  ctx.clip()
  if (env.video) drawSrc(ctx, env.video, videoXf(m, top, W - 2 * m, H - top, t))
  else { ctx.fillStyle = br.ink; ctx.fillRect(0, top, W, H - top) }
  ctx.restore()
  const out = outOf(lt, dur), inn = lib.prog(lt, 0, 0.3, 'outCubic')
  ctx.save(); ctx.globalAlpha = out; ctx.translate(0, (1 - inn) * 30 * u)
  const x0 = 72 * u, x1 = W - 72 * u, y0 = 170 * u, y1 = top - 50 * u
  const rows = chartData(b)
  const title = String(b.headline || '').replace(/\*/g, '')
  if (rows) {
    lib.text(ctx, title, W / 2, y0 + 30 * u, { font: HEAD(), size: Math.min(64 * u, lib.fit(ctx, title, x1 - x0, { font: HEAD(), size: 64 * u, weight: 800 })), weight: 800, color: br.ink })
    const max = Math.max(...rows.map((r) => r.value), 1), top0 = y0 + 150 * u, base = y1 - 70 * u
    const bw = (x1 - x0) / rows.length, mean = rows.reduce((s2, r) => s2 + r.value, 0) / rows.length
    rows.forEach((r, k) => {
      const at = 0.15 + k * 0.13, p = lib.prog(lt, at, at + 0.7, 'outBack')
      const h = Math.max(0, (base - top0) * (r.value / max) * p), cx = x0 + bw * (k + 0.5), w = bw * 0.62
      ctx.fillStyle = r.value === max ? br.accent : lib.mix(br.accent, br.paper, 0.45)
      lib.roundRect(ctx, cx - w / 2, base - h, w, h, Math.min(12 * u, w / 4)); ctx.fill()
      if (p > 0.05) lib.text(ctx, r.text, cx, base - h - 34 * u, { font: HEAD(), size: Math.min(52 * u, w * 0.5), weight: 800, color: rgba(br.ink, lib.clamp(p)) })
      lib.text(ctx, r.label.slice(0, 16), cx, base + 38 * u, { font: BODY(), size: Math.min(30 * u, w * 0.26), weight: 700, color: br.muted })
    })
    const lp = lib.prog(lt, 0.9, 1.5, 'inOutCubic'), my = base - (base - top0) * (mean / max)
    if (lp > 0) { ctx.save(); ctx.setLineDash([14 * u, 10 * u]); lib.path(ctx, [[x0, my], [x0 + (x1 - x0) * lp, my]], 1, { color: lib.mix(br.accent, '#D2453A', 0.6), width: 4 * u }); ctx.restore() }
  } else if (b.number && typeof b.number.value === 'number') {
    const nb = b.number, p = lib.prog(lt, 0.1, 1.2, 'outCubic')
    const dec = nb.value % 1 ? 1 : 0, v = nb.value * p
    const str = (nb.prefix || '') + (dec ? v.toFixed(1).replace('.', ',') : Math.round(v).toLocaleString('pt-BR')) + (nb.suffix || '')
    lib.text(ctx, str, W / 2, (y0 + y1) / 2 - 40 * u, { font: HEAD(), size: Math.min(260 * u, lib.fit(ctx, str, x1 - x0, { font: HEAD(), size: 260 * u, weight: 900 })), weight: 900, color: br.accentOnLight })
    textBlock(ctx, b, lt, S, { text: b.headline, x: W / 2, y: (y0 + y1) / 2 + 120 * u, size: 54 * u, maxW: x1 - x0, align: 'center', maxLines: 2 })
  } else if ((b.items || []).length >= 2) {
    const h1 = textBlock(ctx, b, lt, S, { text: b.headline, x: x0, y: y0, size: 66 * u, maxW: x1 - x0, maxLines: 2 })
    const items = b.items.slice(0, 5), times = spokenTimes(b, items.map((x) => ({ text: String(x).split(/\s+/)[0] })), 0.35)
    items.forEach((it, k) => {
      const at = Math.max(0.3 + k * 0.25, times[k]), p = lib.prog(lt, at, at + 0.5, 'outExpo'), y = y0 + h1 + 70 * u + k * 92 * u
      if (p <= 0) return
      ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - p) * 40 * u, 0)
      ctx.fillStyle = br.accent; lib.roundRect(ctx, x0, y - 22 * u, 44 * u, 44 * u, 12 * u); ctx.fill()
      lib.text(ctx, String(k + 1), x0 + 22 * u, y, { font: HEAD(), size: 26 * u, weight: 800, color: br.onAccent })
      lib.text(ctx, String(it), x0 + 72 * u, y, { font: BODY(), size: Math.min(44 * u, lib.fit(ctx, String(it), x1 - x0 - 72 * u, { font: BODY(), size: 44 * u, weight: 700 })), weight: 700, color: br.ink, align: 'left' })
      ctx.restore()
    })
  } else {
    const name = iconOf(b)
    if (name) iconBadge(ctx, name, W / 2, y0 + 90 * u, 80 * u, lt, 0.1, S)
    textBlock(ctx, b, lt, S, { text: b.headline, x: W / 2, y: (name ? y0 + 230 * u : y0 + 60 * u), size: 104 * u, maxW: x1 - x0, align: 'center', maxLines: 4 })
  }
  ctx.restore()
  env.state.capY = H * 0.86
  return S
}

function cutout(ctx, t, W, H, u) {
  const d = env.data, beats = d.beats, b2 = B(), st = env.state
  if (!beats.length || !env.video) { drawVideo(ctx, 0, 0, W, H, t); return surface('ink') }
  const i = current(t), b = beats[i], lt = t - b.start, dur = Math.max(0.4, (beats[i + 1] ? beats[i + 1].start : env.duration) - b.start)
  let fx = b.effect || FX_ORDER[i % FX_ORDER.length]
  st.capY = H * 0.8
  // Estes dois trocam o quadro inteiro (não precisam do recorte)
  if (fx === 'tela-dividida') return splitFx(ctx, t, W, H, u)
  if (fx === 'grafico') return chartFx(ctx, t, b, lt, dur, W, H, u)
  const P = videoXf(0, 0, W, H, t)
  const person = personLayer(P)
  if (fx === 'clones' && !person) fx = 'texto-fundo'
  // Espaço para o efeito: se a cabeça está alta demais (vídeo de webcam cortado para vertical), a pessoa
  // diminui ancorada embaixo até a cabeça ficar a ~36% da altura, sobre o fundo de estúdio da marca
  const raw = headOf(person)
  const want = person ? Math.max(0.55, Math.min(1, (H * 0.64) / Math.max(1, H - raw.top))) : 1
  st.fit = st.fit == null ? want : lib.lerp(st.fit, want, 0.12)
  if (st.studio == null && person) st.studio = st.fit < 0.92
  const k = st.studio ? Math.min(1, st.fit) : 1
  const head = { top: H - (H - raw.top) * k, cx: W / 2 + (raw.cx - W / 2) * k, w: raw.w * k, cy: H - (H - raw.cy) * k }
  const drawPerson = (c) => { c.save(); c.translate(W / 2, H); c.scale(k, k); c.translate(-W / 2, -H); c.drawImage(person, 0, 0); c.restore() }
  if (st.studio) studio(ctx, W, H, head)
  else {
    // O fundo: o próprio vídeo, desfocado no foco; escurecido para o efeito aparecer (a pessoa volta nítida por cima)
    if (fx === 'foco') { ctx.save(); ctx.filter = 'blur(' + (lib.prog(lt, 0, 0.45, 'outCubic') * 22 * u).toFixed(1) + 'px)'; drawSrc(ctx, env.video, P); ctx.restore() }
    else drawSrc(ctx, env.video, P)
    ctx.fillStyle = rgba(b2.ink, person ? (fx === 'foco' ? 0.3 : 0.45) : 0.18); ctx.fillRect(0, 0, W, H)
  }
  if (fx === 'texto-fundo') backText(ctx, b, lt, dur, W, H, u, head)
  else if (fx === 'foco') backText(ctx, b, lt, dur, W, H, u, head, keyWord(b))
  else if (fx === 'parede') postWall(ctx, b, lt, dur, W, H, u, head)
  else if (fx === 'orbita') orbit(ctx, b, lt, dur, u, head, false)
  else if (fx === 'clones') clones(ctx, lt, dur, W, H, drawPerson, head)
  else if (fx === 'carrossel') carousel(ctx, lt, dur, W, H, u, !!person)
  else if (fx === 'orbita-cartoes' && person) orbitCards(ctx, lt, dur, W, H, u, head, false)
  if (person) drawPerson(ctx)
  if (fx === 'orbita') orbit(ctx, b, lt, dur, u, head, true)
  // Sem o recorte, a órbita não tem como passar atrás: só a metade da frente, baixa, no tronco
  if (fx === 'orbita-cartoes') orbitCards(ctx, lt, dur, W, H, u, person ? head : { ...head, cy: Math.max(head.cy, H * 0.5) }, true)
  return surface('ink')
}

/** A barra de progresso e o logo pequeno: a assinatura da marca em todo o vídeo. */
function signature(ctx, W, t, S, u) {
  const b = B()
  ctx.fillStyle = rgba(S.fg, 0.12); ctx.fillRect(0, 0, W, 6 * u)
  ctx.fillStyle = b.accent; ctx.fillRect(0, 0, W * lib.clamp(t / env.duration), 6 * u)
  const logo = logoFor(S)
  if (logo) { const lh = 38 * u, lw = Math.min(240 * u, (logo.width / logo.height) * lh); ctx.save(); ctx.globalAlpha = 0.92; lib.image(ctx, logo, 72 * u + lw / 2, 72 * u, lw, lh, 'contain'); ctx.restore() }
  else if (b.name) lib.text(ctx, b.name, 72 * u, 72 * u, { font: HEAD(), size: 30 * u, weight: 700, color: rgba(S.fg, 0.85), align: 'left', spacing: -0.5 * u })
}

// ——— Estilos virais: a cena num cartão flutuante, com rótulo, legenda e a pessoa ———

/** Cor de destaque que aparece bem sobre vídeo e fundos escuros (a da marca, ou o amarelo de legenda). */
function popColor() { const b = B(); return lum(b.accentOnDark) > 0.35 ? b.accentOnDark : '#FFD60A' }

/**
 * O cartão: o print da cena (foto do roteiro) ou a própria cena animada em miniatura. Entra subindo
 * com um leve salto a cada momento; o brilho da borda é a cor de destaque da marca.
 */
function cardOf(ctx, i, t, r, u, o) {
  const b = env.data.beats[i]
  const lt = t - b.start
  const p = lib.prog(lt, 0, 0.55, 'outBack'), a = lib.clamp(lt / 0.12)
  const rad = o.flat ? 0 : Math.min(B().radius * 2, 28) * u + 14 * u
  ctx.save()
  ctx.globalAlpha *= a
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + (1 - p) * 90 * u)
  const sc = o.flat ? 1 : 0.86 + 0.14 * p
  ctx.scale(sc, sc); ctx.rotate(o.flat ? 0 : (1 - p) * 0.035)
  ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2))
  if (!o.flat) {
    ctx.save(); ctx.shadowColor = o.glow ? rgba(B().accent, 0.75) : 'rgba(0,0,0,0.35)'; ctx.shadowBlur = (o.glow ? 70 : 50) * u; ctx.shadowOffsetY = o.glow ? 0 : 20 * u
    ctx.fillStyle = B().paper; lib.roundRect(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.restore()
  }
  ctx.save(); ctx.beginPath(); lib.roundRect(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip()
  // O clipe da cena (vídeo curto, quadro a quadro) ou a foto
  const img = (b.clip && env.broll) || (b.photo && env.images[b.photo])
  if (img) {
    const k = Math.max(r.w / img.width, r.h / img.height) * (b.clip ? 1 : 1.03 + Math.min(lt, 6) * 0.01)
    ctx.fillStyle = '#000'; ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.drawImage(img, r.x + r.w / 2 - img.width * k / 2, r.y + r.h / 2 - img.height * k / 2, img.width * k, img.height * k)
  } else {
    // A cena em miniatura: o mesmo desenho da tela cheia, numa caixa do tamanho do cartão
    // Escala de leitura no celular: a largura do cartão manda, limitada pela altura (o cartão é deitado)
    drawBeat(ctx, i, t, r, { u: Math.min((r.w / 1080) * 1.1, r.h / 700), mini: true })
  }
  ctx.restore()
  if (!o.flat && o.glow) { ctx.strokeStyle = B().accent; ctx.lineWidth = 4 * u; lib.roundRect(ctx, r.x, r.y, r.w, r.h, rad); ctx.stroke() }
  ctx.restore()
}

/** Rótulo com ícone e uma palavra de destaque: "preparando os *slides*". */
function chipLabel(ctx, i, t, cx, y, u, color, emphColor) {
  const b = env.data.beats[i]
  const lt = t - b.start
  const text = b.kicker || b.headline
  const ic = iconOf(b) || 'brilho'
  const p = lib.prog(lt, 0.05, 0.5, 'outExpo')
  if (p <= 0) return
  const size = 50 * u
  const toks = tokens(b, text)
  const L = layout(ctx, toks, 760 * u, { font: HEAD(), size, weight: 700, spacing: -size * 0.02 })
  const line = L.lines[0] || { width: 0, toks: [] }
  const iconW = 64 * u, gap = 18 * u
  const total = iconW + gap + line.width
  let x = cx - total / 2
  ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 24 * u)
  ctx.fillStyle = B().accent; lib.roundRect(ctx, x, y - iconW / 2, iconW, iconW, 14 * u); ctx.fill()
  icon(ctx, ic, x + iconW / 2, y, iconW * 0.62, B().onAccent, lib.prog(lt, 0.1, 0.6), 2)
  x += iconW + gap
  line.toks.forEach((tk) => { lib.text(ctx, tk.text, x, y, { ...tk.f, color: tk.emph ? emphColor : color, align: 'left' }); x += tk.w + L.space })
  ctx.restore()
}

function wordNow(t) {
  const w = env.data.words
  for (let i = 0; i < w.length; i++) if (t >= w[i].s - 0.03 && (i === w.length - 1 || t < w[i + 1].s - 0.03)) return t <= w[i].e + 0.5 ? w[i] : null
  return null
}

/** A frase da vez numa caixinha (uma tela por frase). */
function phraseChip(ctx, t, cx, y, u, maxW) {
  const d = env.data
  if (!d.words.length) return
  const G = env.state.groups.chip || (env.state.groups.chip = groups(d.words, 4))
  const g = G.find((g, i) => t >= g[0].s - 0.05 && t < (G[i + 1] ? G[i + 1][0].s - 0.05 : g[g.length - 1].e + 0.6))
  if (!g) return
  const str = g.map((w) => w.w.replace(/[.,!?;:]+$/, '')).join(' ').toLowerCase()
  const font = { font: BODY(), size: 60 * u, weight: 700 }
  const size = Math.min(60 * u, lib.fit(ctx, str, maxW, font))
  const w = lib.measure(ctx, str, { ...font, size }) + 40 * u
  const p = lib.clamp((t - g[0].s + 0.05) / 0.16)
  lib.at(ctx, cx, y, { scale: 0.92 + 0.08 * lib.ease.outBack(p), alpha: lib.clamp(p * 3) }, (c) => {
    c.fillStyle = 'rgba(40,40,40,0.62)'; lib.roundRect(c, -w / 2, -size * 0.75, w, size * 1.5, 10 * u); c.fill()
    lib.text(c, str, 0, 2 * u, { ...font, size, color: '#FFFFFF' })
  })
}

/** Uma palavra por vez, gigante, com contorno (legenda forte) ou pequena (contraste). */
function bigWord(ctx, t, cx, y, u, size, color) {
  const w = wordNow(t)
  if (!w) return
  const str = w.w.replace(/[.,!?;:]+$/, '').toUpperCase()
  const p = lib.clamp((t - w.s + 0.04) / 0.14)
  const s2 = Math.min(size, lib.fit(ctx, str, 940 * u, { font: HEAD(), size, weight: 800 }))
  lib.at(ctx, cx, y, { scale: 0.8 + 0.2 * lib.ease.outBack(p), alpha: lib.clamp(p * 3) }, (c) => lib.text(c, str, 0, 0, { font: HEAD(), size: s2, weight: 800, color, stroke: '#000000', strokeWidth: s2 * 0.16 }))
}

/** A palavra-herói do momento: o destaque do roteiro, entrando quando é falado, na fonte de destaque. */
function heroWord(ctx, i, t, cx, y, u, color) {
  const b = env.data.beats[i]
  const lt = t - b.start
  const hl = (b.highlight && b.highlight[0]) || ((b.kicker || b.headline).match(/\*([^*]+)\*/) || [])[1] || tokens(b, b.headline).map((x) => x.text).sort((a, z) => z.length - a.length)[0] || ''
  if (!hl) return
  const at = spokenTimes(b, [{ text: hl }], 0.3)[0]
  const p = lib.prog(lt, at, at + 0.5, 'outExpo')
  if (p <= 0) return
  const italic = emphItalic()
  const size = Math.min(170 * u, lib.fit(ctx, hl, 920 * u, { font: EMPH(), size: 170 * u, weight: italic ? 400 : 800, italic }))
  ctx.save(); ctx.beginPath(); ctx.rect(0, y - size * 0.75, env.width, size * 1.5); ctx.clip()
  lib.text(ctx, hl, cx, y + (1 - p) * size, { font: EMPH(), size, weight: italic ? 400 : 800, italic, color })
  ctx.restore()
  const w = lib.measure(ctx, hl, { font: EMPH(), size, weight: italic ? 400 : 800, italic })
  const up = lib.prog(lt, at + 0.3, at + 0.8, 'inOutCubic')
  if (up > 0) lib.path(ctx, [[cx - w / 2, y + size * 0.52], [cx - w / 2 + w * up, y + size * 0.5]], 1, { color, width: Math.max(4, size * 0.05) })
}

function pip(ctx, t, x, y, r) {
  if (!env.video) return
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = r * 0.3
  ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2); ctx.fillStyle = B().accent; ctx.fill(); ctx.restore()
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip(); drawVideo(ctx, x - r, y - r, r * 2, r * 2, t); ctx.restore()
}

function viral(ctx, t, W, H, u, look) {
  const beats = env.data.beats
  if (!beats.length) { ctx.fillStyle = B().ink; ctx.fillRect(0, 0, W, H); return }
  const i = current(t)
  const b = B()
  const cardW = W * 0.8, cardH = cardW / 1.3
  if (look === 'tela-frase') {
    const split = Math.round(H * 0.58)
    // Embaixo: a pessoa (clara, como no estúdio) ou o papel da marca
    if (env.video) { drawVideo(ctx, 0, split, W, H - split, t); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, split, W, H - split) }
    else { const g = ctx.createLinearGradient(0, split, 0, H); g.addColorStop(0, b.paper); g.addColorStop(1, lib.mix(b.paper, '#FFFFFF', 0.6)); ctx.fillStyle = g; ctx.fillRect(0, split, W, H - split) }
    cardOf(ctx, i, t, { x: 0, y: 0, w: W, h: split }, u, { flat: true })
    ctx.fillStyle = b.accent; ctx.fillRect(0, split - 3 * u, W, 6 * u)
    phraseChip(ctx, t, W / 2, split + (H - split) * 0.42, u, W * 0.84)
  } else if (look === 'palavra-heroi') {
    ctx.fillStyle = b.ink; ctx.fillRect(0, 0, W, H)
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, H * 0.75)
    g.addColorStop(0, rgba(b.accent, 0.95)); g.addColorStop(0.55, rgba(lib.mix(b.accent, b.ink, 0.55), 0.9)); g.addColorStop(1, rgba(b.ink, 1))
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    chipLabel(ctx, i, t, W / 2, H * 0.27, u, '#FFFFFF', '#FFFFFF')
    cardOf(ctx, i, t, { x: (W - cardW) / 2, y: H * 0.31, w: cardW, h: cardH }, u, { glow: true })
    heroWord(ctx, i, t, W / 2, H * 0.31 + cardH + 190 * u, u, '#FFFFFF')
    pip(ctx, t, W - 170 * u, H - 230 * u, 120 * u)
  } else if (look === 'legenda-forte') {
    if (env.video) drawVideo(ctx, 0, 0, W, H, t)
    else { ctx.fillStyle = b.ink; ctx.fillRect(0, 0, W, H) }
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55)
    bigWord(ctx, t, W / 2, H * 0.56, u, 150 * u, popColor())
    cardOf(ctx, i, t, { x: (W - cardW * 0.92) / 2, y: H * 0.62, w: cardW * 0.92, h: cardH * 0.92 }, u, {})
  } else {
    // contraste: metade de cima na cor da marca, a pessoa embaixo
    const split = Math.round(H * 0.5)
    if (env.video) drawVideo(ctx, 0, split, W, H - split, t)
    else { ctx.fillStyle = b.ink; ctx.fillRect(0, split, W, H - split) }
    const g = ctx.createLinearGradient(0, 0, 0, split); g.addColorStop(0, lib.mix(b.accent, '#000000', 0.25)); g.addColorStop(1, b.accent)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, split)
    cardOf(ctx, i, t, { x: (W - cardW) / 2, y: split * 0.17, w: cardW, h: cardH }, u, {})
    chipLabel(ctx, i, t, W / 2, split * 0.17 + cardH + 80 * u, u, b.onAccent, b.onAccent)
    bigWord(ctx, t, W / 2, split + 90 * u, u, 84 * u, '#FFFFFF')
  }
}

const BRAND0 = env.data && env.data.brand
scene({
  fonts: BRAND0 ? [BRAND0.heading, BRAND0.body, BRAND0.emphasis] : ['Inter'],
  setup() { return { groups: {} } },
  draw(ctx, t, env) {
    const W = env.width, H = env.height, d = env.data
    if (!d || !d.brand) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H); return }
    const u = Math.min(W / 1080, H / 1920)
    const activeBeat = d.beats[current(t)]
    if (activeBeat && activeBeat.fullScreen) {
      animation(ctx, t, { x: 0, y: 0, w: W, h: H }, { u })
      return
    }
    if (d.look === 'recorte') {
      const S = cutout(ctx, t, W, H, u)
      signature(ctx, W, t, S, u)
      captions(ctx, t, env.state.capY || H * 0.8, S, u, W, true)
      return
    }
    if (d.composition) {
      const c = d.composition
      const rect = (b) => ({ x: b.x * W / 100, y: b.y * H / 100, w: b.w * W / 100, h: b.h * H / 100 })
      const base = surface(d.theme === 'claro' ? 'paper' : 'ink')
      ctx.fillStyle = base.bg; ctx.fillRect(0, 0, W, H)
      let S = base
      const video = () => { if (c.video.visible && env.video) { const r = rect(c.video); drawVideo(ctx, r.x, r.y, r.w, r.h, t) } }
      if (!c.videoOnTop) video()
      if (c.animation.visible) {
        const r = rect(c.animation)
        ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip()
        S = animation(ctx, t, r, { u: Math.min(r.w / 1080, r.h / 1200) })
        ctx.restore()
      }
      if (c.videoOnTop) video()
      signature(ctx, W, t, base, u)
      if (c.captions.visible) {
        const r = rect(c.captions)
        ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.translate(r.x, r.y)
        captions(ctx, t, r.h / 2, S, u * Math.max(0.5, Math.min(2, c.captionScale || 1)), r.w, true)
        ctx.restore()
      }
      return
    }
    if (d.look && d.look !== 'editorial') {
      viral(ctx, t, W, H, u, d.look)
      signature(ctx, W, t, surface(d.look === 'tela-frase' ? 'paper' : 'ink'), u)
      return
    }
    if (d.layout === 'dividido') {
      const split = Math.round(H * 0.56)
      const S = animation(ctx, t, { x: 0, y: 0, w: W, h: split }, { u: Math.min(W / 1080, split / 1200) })
      drawVideo(ctx, 0, split, W, H - split, t)
      ctx.fillStyle = B().accent; ctx.fillRect(0, split - 3 * u, W, 6 * u)
      signature(ctx, W, t, S, u)
      captions(ctx, t, split + 120 * u, S, u, W, true)
    } else if (d.layout === 'rosto') {
      drawVideo(ctx, 0, 0, W, H, t)
      const gr = ctx.createLinearGradient(0, 0, 0, H * 0.66)
      gr.addColorStop(0, rgba(B().ink, 0.8)); gr.addColorStop(0.7, rgba(B().ink, 0.35)); gr.addColorStop(1, rgba(B().ink, 0))
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H * 0.66)
      animation(ctx, t, { x: 0, y: H * 0.05, w: W, h: H * 0.5 }, { u: Math.min(W / 1080, (H * 0.5) / 1200) * 0.95, over: true })
      signature(ctx, W, t, surface('ink'), u)
      captions(ctx, t, H * 0.76, surface('ink'), u, W, true)
    } else {
      const S = animation(ctx, t, { x: 0, y: 0, w: W, h: H }, { u })
      signature(ctx, W, t, S, u)
      captions(ctx, t, H * 0.84, S, u, W, false)
    }
  },
})
`
