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
    const lh = 84 * u, lw = Math.min(box.w * 0.5, (logo.width / logo.height) * lh)
    ctx.save(); ctx.globalAlpha = lp; lib.image(ctx, logo, cx, y + (1 - lp) * 30 * u, lw, lh, 'contain'); ctx.restore()
    y += 130 * u
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

function drawVideo(ctx, x, y, w, h, t) {
  const v = env.video
  if (!v) {
    ctx.fillStyle = '#1b1b1f'; ctx.fillRect(x, y, w, h)
    lib.text(ctx, 'você aqui', x + w / 2, y + h / 2, { font: BODY(), size: 40, weight: 600, color: 'rgba(255,255,255,0.4)' })
    return
  }
  const beats = env.data.beats
  const i = current(t)
  // Zoom de corte nos momentos ímpares (o "punch in" dos vídeos falados)
  const punch = beats.length && i % 2 === 1 ? 1.1 : 1
  const kick = beats.length ? lib.pulse(t - beats[i].start, 0, 0.2) * 0.02 : 0
  const k = Math.max(w / v.width, h / v.height) * (punch + kick)
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
  ctx.translate(x + w / 2, y + h / 2 + (punch > 1 ? h * 0.03 : 0))
  if (env.data.mirror) ctx.scale(-1, 1)
  ctx.drawImage(v, -v.width * k / 2, -v.height * k / 2, v.width * k, v.height * k)
  ctx.restore()
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
