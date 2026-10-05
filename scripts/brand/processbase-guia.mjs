#!/usr/bin/env node
/**
 * Guia de marca da ProcessBase num SVG só, para baixar e mandar ao cliente:
 * logo e versões, construção do emblema, usos errados, cores com contraste,
 * tipografia, forma (com o emblema em bloco isométrico), texturas e efeitos,
 * componentes, movimento e voz.
 *
 * Fontes: brands/processbase/DESIGN.md, src/features/processbase/tokens.ts e
 * elementor.ts (texturas, moldura dupla, botões), emblem3d.ts (o bloco) e os
 * vetores do logo em public/brands/processbase/logo. Os textos do logo vêm dos
 * arquivos, já em contornos; o resto do texto usa Inter, embutida no SVG.
 *
 *   node scripts/brand/processbase-guia.mjs [--pages <pasta>]
 *
 * Saída: public/brands/processbase/kit/guia/processbase-guia-de-marca.svg
 * (o kit de marca, processbase-kit.mjs, roda este script antes). Com
 * `--pages`, grava também cada página num SVG solto (para conferir).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BRAND = path.join(ROOT, 'public/brands/processbase')
const OUT = path.join(BRAND, 'kit/guia/processbase-guia-de-marca.svg')
const pagesArg = process.argv.indexOf('--pages')
const PAGES_DIR = pagesArg > -1 ? path.resolve(process.argv[pagesArg + 1]) : null

const W = 1600
const H = 1000
const M = 96
const PAGES = 10

const C = {
  navy: '#171A2C',
  raised: '#1E2237',
  orange: '#FF5900',
  orangeHover: '#E24E00',
  slate: '#829AAF',
  slateInk: '#5F7A91',
  white: '#FFFFFF',
  mist: '#F2F3F5',
  body: '#5E6472',
  border: '#C9CCD3',
  shell: '#E6E8EC',
  shellLine: '#DADDE3',
  coreLine: '#DDE0E5',
}
const ON_NAVY = { color: C.white, opacity: 0.72 }

// ── utilidades ──────────────────────────────────────────────────────────────

const r2 = (n) => Math.round(n * 100) / 100
const pad = (n) => String(n).padStart(2, '0')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const pts = (list) => list.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ')

let DEFS = []
let seq = 0
const uid = (prefix) => `${prefix}${++seq}`

/** Largura aproximada de um texto em Inter, para botões, etiquetas e linhas. */
const NARROW = { i: 0.24, l: 0.24, j: 0.26, "'": 0.2, '.': 0.27, ',': 0.27, ':': 0.27, ';': 0.27, '!': 0.28, I: 0.28, ' ': 0.27, f: 0.35, t: 0.35, r: 0.37, '-': 0.4, '·': 0.28, '/': 0.36, '(': 0.33, ')': 0.33 }
const WIDE = { m: 0.86, w: 0.78, M: 0.87, W: 0.95, '%': 0.8, '@': 0.95 }
const charWidth = (ch) => {
  const base = ch.normalize('NFD')[0]
  if (base in NARROW) return NARROW[base]
  if (base in WIDE) return WIDE[base]
  if (/[0-9]/.test(base)) return 0.6
  if (/[A-Z]/.test(base)) return 0.68
  return 0.55
}
const measure = (s, size, weight = 400, track = 0) =>
  [...s].reduce((sum, ch) => sum + charWidth(ch), 0) * size * (weight >= 600 ? 1.08 : weight >= 500 ? 1.03 : 1) + track * size * [...s].length

const FONT = "Inter, 'Inter Variable', 'Helvetica Neue', Arial, sans-serif"

/**
 * Texto em uma ou mais linhas. `{{trecho}}` vira o destaque dos títulos
 * (semibold em ardósia), como o `hl()` do site.
 */
function text(x, y, lines, o = {}) {
  const { size = 15, weight = 400, color = C.body, opacity, track = 0, lh = 1.45, anchor, hl = {} } = o
  const list = Array.isArray(lines) ? lines : [lines]
  const attrs = [`x="${r2(x)}"`, `y="${r2(y)}"`, `font-family="${FONT}"`, `font-size="${size}"`, `fill="${color}"`]
  if (weight !== 400) attrs.push(`font-weight="${weight}"`)
  if (opacity !== undefined) attrs.push(`fill-opacity="${opacity}"`)
  if (track) attrs.push(`letter-spacing="${r2(track * size)}"`)
  if (anchor) attrs.push(`text-anchor="${anchor}"`)
  const hlWeight = hl.weight ?? 600
  const hlColor = hl.color ?? C.slate
  const hlTrack = hl.track ?? -0.035
  const rich = (s) => esc(s).replace(/\{\{(.+?)\}\}/g, (_, t) => `<tspan font-weight="${hlWeight}" fill="${hlColor}" fill-opacity="1" letter-spacing="${r2(hlTrack * size)}">${t}</tspan>`)
  const body = list.length === 1
    ? rich(list[0])
    : list.map((line, i) => `<tspan x="${r2(x)}"${i ? ` dy="${r2(size * lh)}"` : ''}>${rich(line)}</tspan>`).join('')
  return `<text ${attrs.join(' ')}>${body}</text>`
}

const rect = (x, y, w, h, o = {}) => {
  const a = [`x="${r2(x)}"`, `y="${r2(y)}"`, `width="${r2(w)}"`, `height="${r2(h)}"`]
  if (o.rx) a.push(`rx="${o.rx}"`)
  a.push(`fill="${o.fill ?? 'none'}"`)
  if (o.fillOpacity !== undefined) a.push(`fill-opacity="${o.fillOpacity}"`)
  if (o.stroke) a.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw ?? 1}"`)
  if (o.strokeOpacity !== undefined) a.push(`stroke-opacity="${o.strokeOpacity}"`)
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`)
  if (o.extra) a.push(o.extra)
  return `<rect ${a.join(' ')}/>`
}
const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${o.stroke ?? C.border}" stroke-width="${o.sw ?? 1}"${o.opacity !== undefined ? ` stroke-opacity="${o.opacity}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.cap ? ` stroke-linecap="${o.cap}"` : ''}/>`

/** Rótulo em caixa alta com o filete laranja à frente (DESIGN.md §4). */
const eyebrow = (x, y, label, color) =>
  rect(x, y - 5.4, 20, 2, { fill: C.orange }) + text(x + 32, y, label.toUpperCase(), { size: 12, weight: 700, track: 0.15, color })
const micro = (x, y, label, color = C.body, o = {}) =>
  text(x, y, label.toUpperCase(), { size: 11, weight: 500, track: 0.12, color, ...o })

/** Recorte com cantos arredondados, para texturas e fundos de um bloco. */
const clip = (x, y, w, h, rx = 0) => {
  const id = uid('c')
  DEFS.push(`<clipPath id="${id}">${rect(x, y, w, h, { rx, fill: '#000' })}</clipPath>`)
  return id
}

/**
 * A máscara das texturas do site: `radial-gradient(ellipse … at X, #000 5%,
 * transparent 75%)`. `at` em frações do bloco; `spread` é o raio relativo.
 */
const fadeMask = (x, y, w, h, at, spread = 0.65) => {
  const id = uid('m')
  DEFS.push(`<radialGradient id="${id}g" cx="${at[0]}" cy="${at[1]}" r="${spread}" fx="${at[0]}" fy="${at[1]}"><stop offset=".05" stop-color="#fff"/><stop offset=".75" stop-color="#000"/></radialGradient>`
    + `<mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}">${rect(x, y, w, h, { fill: `url(#${id}g)` })}</mask>`)
  return id
}

// ── logo ────────────────────────────────────────────────────────────────────

const pathsOf = (file) => [...readFileSync(path.join(BRAND, file), 'utf8').matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])
const LOGO = pathsOf('logo/processbase-logo.svg') // 4 peças (sup. dir., inf. dir., inf. esq., sup. esq.) + o nome
const SYMBOL = pathsOf('logo/processbase-symbol.svg')
const LOGO_W = 734.34
const EMB = 102.04
const LOGO_RATIO = LOGO_W / EMB

// cores das peças na ordem dos arquivos: superior direita, inferior direita, inferior esquerda, superior esquerda
const E = {
  primary: [C.orange, C.navy, C.navy, C.navy],
  reverse: [C.orange, C.white, C.white, C.white],
  navy: [C.navy, C.navy, C.navy, C.navy],
  white: [C.white, C.white, C.white, C.white],
}

/** Assinatura horizontal com `h` de altura (a do emblema). */
const logo = (x, y, h, emblem = E.primary, word = C.navy, extra = '') => {
  const s = h / EMB
  return `<g transform="translate(${r2(x)} ${r2(y - 14.65 * s)}) scale(${(+s).toFixed(5)})"${extra}>`
    + LOGO.slice(0, 4).map((d, i) => `<path d="${d}" fill="${emblem[i]}"/>`).join('')
    + `<path d="${LOGO[4]}" fill="${word}"/></g>`
}
/** Só o nome, sem o emblema (para mostrar a Lexend Deca). */
const wordmark = (x, y, h, color) => {
  const s = h / EMB
  return `<g transform="translate(${r2(x - 135.45 * s)} ${r2(y - 14.65 * s)}) scale(${(+s).toFixed(5)})"><path d="${LOGO[4]}" fill="${color}"/></g>`
}
const symbol = (x, y, size, emblem = E.primary, extra = '') => {
  const s = size / EMB
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${(+s).toFixed(5)})"${extra}>${SYMBOL.map((d, i) => `<path d="${d}" fill="${emblem[i]}"/>`).join('')}</g>`
}
/** Ícone de app (emblema a 42% do quadrado) e favicon (emblema a 64%). */
const appIcon = (x, y, size, fill, emblem, kind = 'app') => {
  const [k, off] = kind === 'app' ? [0.4157, 0.2879] : [0.6406, 0.18]
  return rect(x, y, size, size, { rx: r2(size * 0.1878), fill }) + symbol(x + size * off, y + size * off, size * k, emblem)
}

// ── emblema em bloco (o mesmo cálculo de emblem.ts / emblem3d.ts) ───────────

const DEPTH = 0.1
const PIECES = [
  [[0, 53.06], [0, 19.39], [19.39, 0], [39.79, 0], [53.06, 26.53], [36.22, 26.53], [26.53, 36.22], [26.53, 39.79]], // Cultura
  [[48.98, 0], [82.65, 0], [102.04, 19.39], [102.04, 39.79], [75.51, 53.06], [75.51, 36.22], [65.81, 26.53], [62.24, 26.53]], // Processos
  [[102.04, 48.98], [102.04, 82.65], [82.65, 102.04], [62.25, 102.04], [48.98, 75.51], [65.82, 75.51], [75.51, 65.81], [75.51, 62.24]], // Treinamentos
  [[53.06, 102.03], [19.39, 102.03], [0, 82.65], [0, 62.24], [26.53, 48.98], [26.53, 65.81], [36.23, 75.51], [39.8, 75.51]], // Planejamento
].map((raw) => {
  const p = raw.map(([x, y]) => [x / EMB - 0.5, y / EMB - 0.5])
  let area = 0
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; area += a[0] * b[1] - b[0] * a[1] }
  if (area < 0) p.reverse()
  return { pts: p, cu: p.reduce((s, q) => s + q[0], 0) / p.length, cv: p.reduce((s, q) => s + q[1], 0) / p.length }
})
const VIEW_POINTS = PIECES.flatMap((piece) => piece.pts)

function view(t, w, h) {
  const th = t * 0.7854, c = Math.cos(th), s = Math.sin(th), sq = 1 - 0.5 * t
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of VIEW_POINTS) {
    const r = p[0] * c - p[1] * s, q = (p[0] * s + p[1] * c) * sq
    x0 = Math.min(x0, r); x1 = Math.max(x1, r)
    y0 = Math.min(y0, q - DEPTH * t); y1 = Math.max(y1, q)
  }
  x0 -= 0.02; x1 += 0.02; y0 -= 0.02; y1 += 0.02
  const k = Math.min(w / (x1 - x0), h / (y1 - y0)), free = h - (y1 - y0) * k
  return { t, c, s, sq, k, x: (w - (x1 - x0) * k) / 2 - x0 * k, y: free * (0.5 + 0.35 * t) - y0 * k }
}
const viewAt = (v, u, q, z) => [v.x + (u * v.c - q * v.s) * v.k, v.y + ((u * v.s + q * v.c) * v.sq - z * v.t) * v.k]

const TOP = [43, 50, 70], SIDE_DARK = [29, 33, 49], SIDE_LIGHT = [38, 44, 63]
const ORANGE = [255, 89, 0], ORANGE_DARK = [150, 52, 0], ORANGE_LIGHT = [208, 72, 0]
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** O bloco num retângulo `w`×`h`; `t` 0 reto, 1 deitado; `lit` = peças laranja. */
function block(x, y, w, h, t, lit) {
  const v = view(t, w, h)
  const depth = (u, q) => u * v.s + q * v.c
  const order = PIECES.map((_, i) => i).sort((a, b) => depth(PIECES[a].cu, PIECES[a].cv) - depth(PIECES[b].cu, PIECES[b].cv))
  let out = ''
  const poly = (list, color) => `<polygon points="${pts(list)}" fill="${color}" stroke="${color}" stroke-width=".6" stroke-linejoin="round"/>`
  for (const index of order) {
    const piece = PIECES[index], on = lit[index]
    if (v.t > 0.01) {
      const faces = []
      piece.pts.forEach((a, i) => {
        const b = piece.pts[(i + 1) % piece.pts.length]
        const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey)
        const nx = ey / len, ny = -ex / len
        const toward = nx * v.s + ny * v.c, side = nx * v.c - ny * v.s
        if (toward > 0.02) faces.push({ a, b, depth: depth(a[0] + b[0], a[1] + b[1]), light: 0.5 + 0.5 * side })
      })
      faces.sort((p, q) => p.depth - q.depth)
      for (const f of faces) {
        const color = hex(on ? mix(ORANGE_DARK, ORANGE_LIGHT, f.light) : mix(SIDE_DARK, SIDE_LIGHT, f.light))
        out += poly([viewAt(v, f.a[0], f.a[1], 0), viewAt(v, f.b[0], f.b[1], 0), viewAt(v, f.b[0], f.b[1], DEPTH), viewAt(v, f.a[0], f.a[1], DEPTH)], color)
      }
    }
    out += poly(piece.pts.map((p) => viewAt(v, p[0], p[1], DEPTH)), hex(on ? ORANGE : TOP))
  }
  return `<g transform="translate(${r2(x)} ${r2(y)})">${out}</g>`
}

// ── grafo de conexões (o fundo do hero do site, parado) ─────────────────────

const rng = (seed) => () => {
  seed = seed + 0x6D2B79F5 | 0
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}

function network(x, y, w, h, { seed = 7, count = 24, focus = [0.62, 0.45], lines = 0.22, nodes = 0.6 } = {}) {
  const rand = rng(seed)
  const minD = Math.sqrt((w * h) / count) * 0.55
  const list = []
  for (let tries = 0; list.length < count && tries < 5000; tries++) {
    const p = [x - 12 + rand() * (w + 24), y - 12 + rand() * (h + 24)]
    if (list.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > minD)) list.push(p)
  }
  const edges = new Set()
  list.forEach((p, i) => {
    list.map((q, j) => [j, Math.hypot(q[0] - p[0], q[1] - p[1])]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 2)
      .forEach(([j]) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`))
  })
  let out = `<g stroke="${C.slate}" stroke-opacity="${lines}" stroke-width="1">`
  for (const e of edges) { const [a, b] = e.split('-').map(Number); out += line(list[a][0], list[a][1], list[b][0], list[b][1], { stroke: C.slate }).replace(` stroke="${C.slate}" stroke-width="1"`, '') }
  out += `</g><g fill="${C.slate}" fill-opacity="${nodes}">${list.map(([px, py]) => `<circle cx="${r2(px)}" cy="${r2(py)}" r="1.8"/>`).join('')}</g>`
  // o ciclo de quatro nós aceso: a faísca laranja percorrendo os pilares
  const fx = x + w * focus[0], fy = y + h * focus[1]
  const near = list.map((p) => [p, Math.hypot(p[0] - fx, p[1] - fy)]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([p]) => p)
  const cx = near.reduce((s, p) => s + p[0], 0) / 4, cy = near.reduce((s, p) => s + p[1], 0) / 4
  near.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
  out += `<polygon points="${pts(near)}" fill="none" stroke="${C.orange}" stroke-opacity=".85" stroke-width="1.3" stroke-linejoin="round"/>`
  out += `<circle cx="${r2(near[0][0])}" cy="${r2(near[0][1])}" r="8" fill="${C.orange}" fill-opacity=".16"/>`
  out += near.map(([px, py]) => `<circle cx="${r2(px)}" cy="${r2(py)}" r="2.6" fill="${C.orange}"/>`).join('')
  return out
}

// ── texturas (as de elementor.ts, desenhadas em elementos) ──────────────────

/** Só desenha onde a máscara ainda mostra alguma coisa. */
const visible = (px, py, x, y, w, h, at, spread) => Math.hypot((px - x - at[0] * w) / (spread * w), (py - y - at[1] * h) / (spread * h)) < 0.78

function dots(x, y, w, h, step, r, color, opacity, at, spread) {
  let s = ''
  for (let py = y + step / 2; py < y + h; py += step)
    for (let px = x + step / 2; px < x + w; px += step)
      if (visible(px, py, x, y, w, h, at, spread)) s += `<circle cx="${r2(px)}" cy="${r2(py)}" r="${r}"/>`
  return `<g fill="${color}" fill-opacity="${opacity}" mask="url(#${fadeMask(x, y, w, h, at, spread)})">${s}</g>`
}
function grid(x, y, w, h, step, color, opacity, at, spread) {
  let s = ''
  const x0 = x + ((w / 2) % step)
  for (let px = x0; px <= x + w; px += step) s += line(px, y, px, y + h, { stroke: color })
  for (let py = y; py <= y + h; py += step) s += line(x, py, x + w, py, { stroke: color })
  return `<g stroke-opacity="${opacity}" mask="url(#${fadeMask(x, y, w, h, at, spread)})">${s}</g>`
}
/** Hachura na inclinação 2:1 dos cortes: linhas que sobem 2 para cada 1. */
function hatch(x, y, w, h, gap, color, opacity, at, spread) {
  let s = ''
  const stepX = gap / Math.sin(Math.atan(2))
  for (let x0 = x - h / 2; x0 <= x + w; x0 += stepX) s += line(x0, y + h, x0 + h / 2, y, { stroke: color })
  return `<g stroke-opacity="${opacity}" mask="url(#${fadeMask(x, y, w, h, at, spread)})">${s}</g>`
}
/** Grade isométrica 2:1 (as duas famílias de linhas do bloco deitado). */
function isoGrid(x, y, w, h, gap, color, opacity, at, spread) {
  let s = ''
  for (let c = -w; c <= h + w / 2; c += gap) {
    s += line(x, y + c, x + w, y + c - w / 2, { stroke: color })
    s += line(x, y + c - w / 2, x + w, y + c, { stroke: color })
  }
  return `<g stroke-opacity="${opacity}" mask="url(#${fadeMask(x, y, w, h, at, spread)})">${s}</g>`
}
function glow(x, y, w, h, color, opacity, at, spread = 0.58) {
  const id = uid('g')
  DEFS.push(`<radialGradient id="${id}" cx="${at[0]}" cy="${at[1]}" r="${spread}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset=".7" stop-color="${color}" stop-opacity="0"/></radialGradient>`)
  return rect(x, y, w, h, { fill: `url(#${id})` })
}

// ── componentes ─────────────────────────────────────────────────────────────

const arrow = (x, cy, size, color) => {
  const head = size * 0.42
  return `<path d="M${r2(x)} ${r2(cy)}H${r2(x + size)}M${r2(x + size - head)} ${r2(cy - head)}L${r2(x + size)} ${r2(cy)}L${r2(x + size - head)} ${r2(cy + head)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
}

const BUTTONS = {
  primary: { fill: C.orange, stroke: C.orange, text: C.white, weight: 600, arrow: true },
  hover: { fill: C.orangeHover, stroke: C.orangeHover, text: C.white, weight: 600, arrow: true },
  outline: { fill: 'none', stroke: C.white, strokeOpacity: 0.36, text: C.white, weight: 500 },
  outlineLight: { fill: 'none', stroke: C.navy, text: C.navy, weight: 500 },
  navy: { fill: C.navy, stroke: C.navy, text: C.white, weight: 500 },
}
/** Botão do site: raio 8, contorno de 1,5 px, 15 px (14 no pequeno). */
function button(x, y, label, variant = 'primary', size = 'md') {
  const b = BUTTONS[variant]
  const fs = size === 'sm' ? 14 : 15
  const padX = size === 'sm' ? 18 : 24
  const h = size === 'sm' ? 42 : 48
  const iconW = b.arrow ? 10 + fs * 0.85 : 0
  const tw = measure(label, fs, b.weight)
  const w = Math.round(tw + iconW + padX * 2)
  let s = rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, { rx: 8, fill: b.fill, stroke: b.stroke, sw: 1.5, strokeOpacity: b.strokeOpacity })
  s += text(x + padX, y + h / 2 + fs * 0.36, label, { size: fs, weight: b.weight, color: b.text })
  if (b.arrow) s += arrow(x + padX + tw + 10, y + h / 2, fs * 0.8, b.text)
  return { svg: s, w, h }
}

/** Etiqueta em pílula (Início, 6 a 12 meses, Depois). */
function pill(x, y, label, color = C.navy, stroke = C.border) {
  const w = Math.round(measure(label, 10, 700, 0.16) + 22)
  return { svg: rect(x + 0.5, y + 0.5, w - 1, 25, { rx: 12.5, fill: C.white, stroke }) + text(x + 11, y + 17, label, { size: 10, weight: 700, track: 0.16, color }), w }
}

/** Moldura dupla no navy: casca de 6 px e miolo com raio de 16 px. */
function frameDark(x, y, w) {
  const cx = x + 6, cy = y + 6, cw = w - 12
  const tagLabel = '01 / 04'
  const tw = Math.round(measure(tagLabel, 10, 700, 0.16) + 18)
  const b = cy + 56
  let s = ''
  s += text(cx + 24, cy + 33, 'Pilar 01', { size: 13, ...ON_NAVY })
  s += rect(cx + cw - 24 - tw + 0.5, cy + 16.5, tw - 1, 23, { rx: 4, stroke: C.slate, strokeOpacity: 0.32 })
  s += text(cx + cw - 24 - tw + 9, cy + 32, tagLabel, { size: 10, weight: 700, track: 0.16, color: C.orange })
  s += line(cx, b, cx + cw, b, { stroke: C.slate, opacity: 0.18 })
  s += text(cx + 24, b + 44, 'Cultura e pessoas', { size: 22, color: C.white, track: -0.025 })
  s += text(cx + 24, b + 72, ['A estrutura começa sabendo quem faz', 'o quê, e por quê.'], { size: 14, lh: 1.55, ...ON_NAVY })
  const items = ['Perfil comportamental da equipe', 'Missão, visão e valores']
  items.forEach((item, i) => {
    const ly = b + 116 + i * 36
    s += line(cx + 24, ly, cx + cw - 24, ly, { stroke: C.slate, opacity: 0.18 })
    s += rect(cx + 24, ly + 18, 8, 1.6, { fill: C.orange })
    s += text(cx + 42, ly + 23, item, { size: 13.5, color: C.white, opacity: 0.86 })
  })
  s += line(cx + 24, b + 188, cx + cw - 24, b + 188, { stroke: C.slate, opacity: 0.18 })
  s += text(cx + 24, b + 216, 'FICA NA EMPRESA', { size: 10, weight: 700, track: 0.14, color: C.slate })
  s += text(cx + 24, b + 238, 'Organograma, cargos e responsabilidades', { size: 13.5, weight: 600, color: C.white })
  const coreH = 56 + 262
  return rect(x + 0.5, y + 0.5, w - 1, coreH + 11, { rx: 22, fill: C.slate, fillOpacity: 0.07, stroke: C.slate, strokeOpacity: 0.16 })
    + rect(cx + 0.5, cy + 0.5, cw - 1, coreH - 1, { rx: 16, fill: C.raised, stroke: C.white, strokeOpacity: 0.06 })
    + s
}

/** Moldura dupla no claro: casca cinza e miolo branco. */
function frameLight(x, y, w) {
  const cx = x + 6, cy = y + 6, cw = w - 12
  let s = ''
  s += text(cx + 28, cy + 70, '01', { size: 44, color: C.navy, track: -0.04 })
  const tag = pill(0, 0, 'INÍCIO')
  s += pill(cx + cw - 28 - tag.w, cy + 30, 'INÍCIO').svg
  s += text(cx + 28, cy + 124, 'Conversa de diagnóstico', { size: 22, color: C.navy, track: -0.025 })
  s += text(cx + 28, cy + 152, ['Entendemos o momento da empresa, o que', 'trava o crescimento e quais etapas do', 'método entram no projeto.'], { size: 14, lh: 1.55 })
  s += button(cx + 28, cy + 222, 'Agendar diagnóstico', 'primary', 'sm').svg
  const coreH = 292
  return rect(x + 0.5, y + 0.5, w - 1, coreH + 11, { rx: 22, fill: C.shell, stroke: C.shellLine })
    + rect(cx + 0.5, cy + 0.5, cw - 1, coreH - 1, { rx: 16, fill: C.white, stroke: C.coreLine })
    + s
}

/** Anel de progresso (RING_CSS do site). */
function ring(cx, cy, r, stroke, value, label, track, hole) {
  const len = 2 * Math.PI * r
  return `<circle cx="${cx}" cy="${cy}" r="${r + stroke / 2}" fill="${hole}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-opacity=".18" stroke-width="${stroke}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.orange}" stroke-width="${stroke}" stroke-dasharray="${r2(len * value)} ${r2(len)}" transform="rotate(-90 ${cx} ${cy})"/>`
    + text(cx - 8, cy + 11, label[0], { size: 32, color: C.white, anchor: 'middle', track: -0.03 })
    + text(cx + 8, cy + 11, label[1], { size: 14, ...ON_NAVY, opacity: 0.6 })
}

/** Gráficos da marca (public/brands/processbase/graphics), dentro de um quadro. */
const graphic = (file, x, y, w, h) => {
  const src = readFileSync(path.join(BRAND, 'graphics', file), 'utf8')
  const open = src.match(/<svg[^>]*>/)[0]
  const viewBox = open.match(/viewBox="([^"]+)"/)[1]
  const keep = open.includes('preserveAspectRatio') ? ' preserveAspectRatio="none"' : ''
  const id = uid('x')
  const inner = src.slice(src.indexOf(open) + open.length, src.lastIndexOf('</svg>')).replace(/pb-area/g, `${id}-area`)
  return `<svg x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" viewBox="${viewBox}"${keep} fill="none">${inner}</svg>`
}

/** Marca de "não fazer". */
const cross = (cx, cy) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="14" fill="${C.navy}"/><path d="M${r2(cx - 5)} ${r2(cy - 5)}L${r2(cx + 5)} ${r2(cy + 5)}M${r2(cx + 5)} ${r2(cy - 5)}L${r2(cx - 5)} ${r2(cy + 5)}" stroke="${C.white}" stroke-width="2" stroke-linecap="round"/>`

// ── contraste (WCAG) ────────────────────────────────────────────────────────

const lum = (h) => {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const verdict = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA grande' : 'Só marcas')
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return `${n >> 16} · ${(n >> 8) & 255} · ${n & 255}` }

// ── página ──────────────────────────────────────────────────────────────────

function header(n, label, title, lede, dark = false) {
  return eyebrow(M, 112, `${pad(n - 1)} · ${label}`, dark ? C.slate : C.navy)
    + text(M, 172, title, { size: 48, color: dark ? C.white : C.navy, track: -0.042 })
    + text(1000, 116, lede, { size: 16, lh: 1.55, ...(dark ? ON_NAVY : { color: C.body }) })
}
function footer(n, dark = false) {
  return line(M, 944, W - M, 944, dark ? { stroke: C.slate, opacity: 0.18 } : {})
    + symbol(M, 960, 14, dark ? E.reverse : E.primary)
    + text(M + 24, 972, 'ProcessBase · Guia de marca', { size: 12, color: dark ? C.slate : C.body })
    + text(W - M, 972, `${pad(n)} / ${pad(PAGES)}`, { size: 12, color: dark ? C.slate : C.body, anchor: 'end' })
}
const pages = []
function page(n, id, bg, body) {
  const defs = DEFS.length ? `<defs>${DEFS.join('')}</defs>` : ''
  DEFS = []
  pages.push({ n, id, svg: `<svg id="pagina-${pad(n)}-${id}" x="0" y="${(n - 1) * H}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="hidden">${defs}${rect(0, 0, W, H, { fill: bg })}${body}</svg>` })
}

// 01 · Capa ───────────────────────────────────────────────────────────────────
{
  let s = ''
  s += glow(0, 0, W, H, C.slate, 0.14, [0.12, 0], 0.6)
  // supergráfico: o emblema em branco a 6%, grande, à direita, quase na borda
  s += symbol(700, 70, 860, E.white, ' opacity=".06"')
  // linhas finas laranja na inclinação 2:1, como no mockup do site
  s += line(1210, 1000, 1710, 0, { stroke: C.orange, opacity: 0.7 })
  s += line(1290, 1000, 1790, 0, { stroke: C.orange, opacity: 0.32 })
  s += logo(M, 96, 40, E.reverse, C.white)
  s += eyebrow(M, 470, 'Sistemas de crescimento operacional', C.slate)
  s += text(M - 6, 604, 'Guia de marca', { size: 124, color: C.white, track: -0.05 })
  s += text(M, 690, ['Estrutura para melhorar.', '{{Ritmo para crescer.}}'], { size: 40, color: C.white, track: -0.033, lh: 1.12 })
  s += line(M, 864, W - M, 864, { stroke: C.slate, opacity: 0.18 })
  s += micro(M, 900, 'Logo · Construção · Cores · Tipografia · Forma · Texturas · Componentes · Movimento · Voz', C.slate)
  s += text(W - M, 900, 'Versão 1 · outubro de 2026', { size: 13, anchor: 'end', ...ON_NAVY })
  page(1, 'capa', C.navy, s)
}

// 02 · Logo ────────────────────────────────────────────────────────────────────
{
  let s = header(2, 'Logo', 'Assinatura e versões', [
    'O emblema de quatro módulos ao lado do nome em',
    'Lexend Deca. Use sempre os arquivos da marca: o',
    'nome já está em contornos e não se redigita.',
  ])
  const tiles = [
    { bg: C.white, line: true, emblem: E.primary, word: C.navy, cap: 'Principal · sobre fundo claro', capColor: C.body },
    { bg: C.navy, emblem: E.reverse, word: C.white, cap: 'Negativa · sobre navy ou foto escura', capColor: C.slate },
    { bg: C.mist, emblem: E.navy, word: C.navy, cap: 'Uma cor · navy', capColor: C.body },
    { bg: C.orange, emblem: E.white, word: C.white, cap: 'Uma cor · branco, sobre laranja ou foto', capColor: C.white },
  ]
  const tw = (W - 2 * M - 24) / 2, th = 196, lh = 52, lw = lh * LOGO_RATIO
  tiles.forEach((t, i) => {
    const x = M + (i % 2) * (tw + 24), y = 256 + Math.floor(i / 2) * (th + 24)
    s += rect(x + 0.5, y + 0.5, tw - 1, th - 1, { rx: 16, fill: t.bg, stroke: t.line ? C.border : undefined })
    s += logo(x + (tw - lw) / 2, y + (th - lh) / 2 - 10, lh, t.emblem, t.word)
    s += micro(x + 24, y + th - 22, t.cap, t.capColor)
  })
  s += micro(M, 712, 'Emblema e ícones', C.navy)
  const n = 7, gap = 20, sw = (W - 2 * M - gap * (n - 1)) / n, sh = 140, sy = 728
  const cells = [
    { bg: C.white, line: true, draw: (x, y) => symbol(x - 32, y - 32, 64, E.primary), cap: 'Emblema' },
    { bg: C.navy, draw: (x, y) => symbol(x - 32, y - 32, 64, E.reverse), cap: 'Emblema negativo' },
    { bg: C.mist, draw: (x, y) => symbol(x - 32, y - 32, 64, E.navy), cap: 'Uma cor · navy' },
    { bg: C.orange, draw: (x, y) => symbol(x - 32, y - 32, 64, E.white), cap: 'Uma cor · branco' },
    { bg: C.mist, draw: (x, y) => appIcon(x - 44, y - 44, 88, C.orange, E.white), cap: 'Ícone de app' },
    { bg: C.mist, draw: (x, y) => appIcon(x - 44, y - 44, 88, C.navy, E.reverse), cap: 'Ícone de app · navy' },
    {
      bg: C.mist,
      draw: (x, y) => appIcon(x - 60, y - 24, 48, C.navy, E.reverse, 'fav') + appIcon(x + 2, y - 8, 32, C.navy, E.reverse, 'fav') + appIcon(x + 48, y + 8, 16, C.navy, E.reverse, 'fav'),
      cap: 'Favicon · 48, 32 e 16 px',
    },
  ]
  cells.forEach((c, i) => {
    const x = M + i * (sw + gap)
    s += rect(x + 0.5, sy + 0.5, sw - 1, sh - 1, { rx: 16, fill: c.bg, stroke: c.line ? C.border : undefined })
    s += c.draw(x + sw / 2, sy + sh / 2)
    s += text(x, sy + sh + 26, c.cap, { size: 13 })
  })
  s += footer(2)
  page(2, 'logo', C.white, s)
}

// 03 · Construção ───────────────────────────────────────────────────────────────
{
  let s = header(3, 'Construção', 'Emblema e proporções', [
    'Quatro módulos idênticos, girados a 90° em volta de',
    'um vazio octogonal. Cada um tem chanfro externo a',
    '45° e encaixa no vizinho por um corte oblíquo 2:1.',
  ])
  const px = M, py = 256, pw = 640, ph = 640
  s += rect(px, py, pw, ph, { rx: 16, fill: C.mist })
  const S = 380, k = S / EMB, ox = px + (pw - S) / 2 + 10, oy = py + (ph - S) / 2 + 6
  const P = (x, y) => [ox + x * k, oy + y * k]
  s += symbol(ox, oy, S, E.primary)
  // caixa do emblema
  s += rect(ox, oy, S, S, { stroke: C.slate, dash: '4 4' })
  // vazio central
  const oct = [[26.53, 36.22], [36.22, 26.53], [65.81, 26.53], [75.51, 36.22], [75.51, 65.81], [65.81, 75.51], [36.23, 75.51], [26.53, 65.81]].map(([x, y]) => P(x, y))
  s += `<polygon points="${pts(oct)}" fill="${C.white}" fill-opacity=".7" stroke="${C.orange}" stroke-width="1.5" stroke-dasharray="5 4"/>`
  s += micro(ox + S / 2, oy + S / 2 + 4, 'Vazio central', C.slateInk, { anchor: 'middle' })
  // chanfro 45°
  const [ax, ay] = P(82.65, 0)
  s += `<path d="M${r2(ax + 30)} ${r2(ay)}A30 30 0 0 1 ${r2(ax + 21.21)} ${r2(ay + 21.21)}" fill="none" stroke="${C.orange}" stroke-width="1.5"/>`
  const [cx1, cy1] = P(92.35, 9.7)
  s += line(cx1, cy1, cx1 + 46, cy1 - 46, { stroke: C.navy })
  s += text(cx1 + 52, cy1 - 50, 'Chanfro 45°', { size: 13, weight: 600, color: C.navy })
  // corte 2:1, prolongado
  const [c0x, c0y] = P(48.98 - 13.26 * 0.9, -26.53 * 0.9)
  const [c1x, c1y] = P(62.24 + 13.26 * 0.2, 26.53 * 1.2)
  s += line(c0x, c0y, c1x, c1y, { stroke: C.orange, sw: 1.5, dash: '6 4' })
  s += text(c0x - 8, c0y - 6, 'Corte 2:1 · 63,4°', { size: 13, weight: 600, color: C.navy, anchor: 'end' })
  // cotas: x (altura do emblema) e x/2 (um módulo)
  const dimX = ox - 36
  s += line(dimX, oy, dimX, oy + S, { stroke: C.slateInk }) + line(dimX - 6, oy, dimX + 6, oy, { stroke: C.slateInk }) + line(dimX - 6, oy + S, dimX + 6, oy + S, { stroke: C.slateInk })
  s += text(dimX - 12, oy + S / 2 + 5, 'x', { size: 15, weight: 600, color: C.slateInk, anchor: 'end' })
  const dimY = oy + S + 34
  const [mx] = P(53.06, 0)
  s += line(ox, dimY, mx, dimY, { stroke: C.slateInk }) + line(ox, dimY - 6, ox, dimY + 6, { stroke: C.slateInk }) + line(mx, dimY - 6, mx, dimY + 6, { stroke: C.slateInk })
  s += text((ox + mx) / 2, dimY + 22, 'x/2 · um módulo', { size: 13, weight: 600, color: C.slateInk, anchor: 'middle' })

  // significado
  const rx = 800
  s += micro(rx, 268, 'Significado', C.navy)
  s += text(rx, 306, 'Quatro módulos, quatro pilares.', { size: 24, color: C.navy, track: -0.025 })
  s += text(rx, 338, [
    'Os módulos são os pilares do método, em ciclo no sentido',
    'horário. O laranja é o ponto de ignição; o vazio central',
    'mantém a marca aberta e legível.',
  ], { size: 15, lh: 1.55 })
  const ms = 136, mxs = rx + 34, mys = 426
  s += symbol(mxs, mys, ms, E.primary)
  s += text(mxs - 10, mys + 10, '01', { size: 12, weight: 600, color: C.navy, anchor: 'end' })
  s += text(mxs + ms + 10, mys + 10, '02', { size: 12, weight: 600, color: C.orange })
  s += text(mxs + ms + 10, mys + ms, '03', { size: 12, weight: 600, color: C.navy })
  s += text(mxs - 10, mys + ms, '04', { size: 12, weight: 600, color: C.navy, anchor: 'end' })
  const pillars = ['Cultura e pessoas', 'Processos', 'Treinamentos', 'Planejamento estratégico']
  pillars.forEach((name, i) => {
    const y = 448 + i * 34
    s += text(1040, y, pad(i + 1), { size: 12, weight: 600, color: i === 1 ? C.orange : C.navy })
    s += text(1072, y, name, { size: 17, color: C.navy, track: -0.01 })
  })
  s += line(rx, 600, W - M, 600)

  // área de proteção
  s += micro(rx, 638, 'Área de proteção', C.navy)
  const ah = 40, aw = ah * LOGO_RATIO, cl = ah / 2, ax0 = rx, ay0 = 660
  s += rect(ax0, ay0, aw + 2 * cl, ah + 2 * cl, { fill: C.orange, fillOpacity: 0.08, stroke: C.orange, dash: '4 3' })
  s += rect(ax0 + cl, ay0 + cl, aw, ah, { fill: C.white })
  s += logo(ax0 + cl, ay0 + cl, ah, E.primary, C.navy)
  s += text(ax0 + cl / 2, ay0 + ah + 2 * cl + 18, 'x/2', { size: 11, weight: 600, color: C.orange, anchor: 'middle' })
  s += text(rx, 800, ['Em volta da assinatura, deixe livre', 'metade da altura do emblema (x/2).'], { size: 14, lh: 1.55 })

  // tamanho mínimo
  const mnx = 1180
  s += micro(mnx, 638, 'Tamanho mínimo', C.navy)
  s += logo(mnx, 672, 24, E.primary, C.navy)
  s += text(mnx + 24 * LOGO_RATIO + 14, 690, '24 px', { size: 12, weight: 600, color: C.slateInk })
  s += symbol(mnx, 718, 16, E.primary)
  s += text(mnx + 30, 731, '16 px', { size: 12, weight: 600, color: C.slateInk })
  s += text(mnx, 800, ['Abaixo de 24 px de altura, use', 'só o emblema. Ele lê bem a', 'partir de 16 px.'], { size: 14, lh: 1.55 })
  s += footer(3)
  page(3, 'construcao', C.white, s)
}

// 04 · Não fazer ────────────────────────────────────────────────────────────────
{
  let s = header(4, 'Uso incorreto', 'O que não fazer', [
    'A assinatura funciona porque é sempre a mesma.',
    'Estes desvios enfraquecem a marca. Na dúvida, use',
    'os arquivos originais, sem alteração.',
  ])
  const tw = (W - 2 * M - 3 * 24) / 4, th = 196
  const lh = 36, lw = lh * LOGO_RATIO
  const centered = (cx, cy, emblem = E.primary, word = C.navy, extra = '') => logo(cx - lw / 2, cy - lh / 2, lh, emblem, word, extra)
  const shadow = uid('f')
  const grad = uid('l')
  DEFS.push(`<filter id="${shadow}" x="-20%" y="-60%" width="140%" height="220%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="${C.navy}" flood-opacity=".45"/></filter>`
    + `<linearGradient id="${grad}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.orange}"/><stop offset="1" stop-color="${C.slate}"/></linearGradient>`)
  const items = [
    { title: 'Mudar o laranja de lugar', text: 'O módulo laranja fica no canto superior direito.', draw: (cx, cy) => centered(cx, cy, [C.navy, C.navy, C.orange, C.navy]) },
    { title: 'Pintar mais de um módulo', text: 'Na assinatura, só um módulo é laranja.', draw: (cx, cy) => centered(cx, cy, [C.orange, C.navy, C.orange, C.navy]) },
    {
      title: 'Redigitar o nome',
      text: 'Use o arquivo. O nome é ProcessBase, junto.',
      draw: (cx, cy) => { const tw2 = measure('Process Base', 30, 500); const x0 = cx - (40 + 14 + tw2) / 2; return symbol(x0, cy - 20, 40) + text(x0 + 54, cy + 11, 'Process Base', { size: 30, weight: 500, color: C.navy }) },
    },
    { title: 'Distorcer a proporção', text: 'Mude o tamanho só na proporção original.', draw: (cx, cy) => `<g transform="translate(${r2(cx)} ${r2(cy)}) scale(1.1 .6) translate(${r2(-cx)} ${r2(-cy)})">${centered(cx, cy)}</g>` },
    { title: 'Aplicar sombra ou degradê', text: 'A marca é chapada: sem sombra, brilho ou degradê.', draw: (cx, cy) => `<g filter="url(#${shadow})">${centered(cx, cy, E.primary, `url(#${grad})`)}</g>` },
    { title: 'Girar a assinatura', text: 'A assinatura fica sempre na horizontal.', draw: (cx, cy) => `<g transform="rotate(-12 ${r2(cx)} ${r2(cy)})">${centered(cx, cy)}</g>` },
    { title: 'Usar sem contraste', bg: C.orange, text: 'Sobre laranja, use a versão branca de uma cor.', draw: (cx, cy) => centered(cx, cy) },
    {
      title: 'Pôr setas ou camadas no emblema',
      text: 'O ciclo se lê sem desenhar uma seta.',
      draw: (cx, cy) => symbol(cx - 56, cy - 56, 112) + `<path d="M${r2(cx - 16)} ${r2(cy + 8)}A17 17 0 1 1 ${r2(cx + 15)} ${r2(cy + 9)}" fill="none" stroke="${C.orange}" stroke-width="3" stroke-linecap="round"/><path d="M${r2(cx + 7)} ${r2(cy + 5)}L${r2(cx + 15)} ${r2(cy + 10)}L${r2(cx + 19)} ${r2(cy + 1)}" fill="none" stroke="${C.orange}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
  ]
  items.forEach((it, i) => {
    const x = M + (i % 4) * (tw + 24), y = 256 + Math.floor(i / 4) * 316
    const id = clip(x, y, tw, th, 16)
    s += `<g clip-path="url(#${id})">${rect(x, y, tw, th, { fill: it.bg ?? C.mist })}${it.draw(x + tw / 2, y + th / 2)}</g>`
    s += cross(x + tw - 30, y + 30)
    s += text(x, y + th + 32, it.title, { size: 16, weight: 600, color: C.navy })
    s += text(x, y + th + 56, it.text, { size: 13.5 })
  })
  s += footer(4)
  page(4, 'nao-fazer', C.white, s)
}

// 05 · Cores ─────────────────────────────────────────────────────────────────────
{
  let s = header(5, 'Cores', 'Navy com um ponto laranja', [
    'Muito navy, muito branco e um único destaque laranja',
    'por tela, como o módulo laranja do emblema. A',
    'ardósia é a voz secundária.',
  ])
  const main = [
    { name: 'Navy', hex: C.navy, role: ['Primária. Fundos institucionais,', 'títulos e o emblema no claro.'], ink: C.white, sub: ON_NAVY },
    { name: 'Laranja ignição', hex: C.orange, role: ['Acento. O módulo do emblema,', 'botões e pequenos destaques.'], ink: C.navy, sub: { color: C.navy, opacity: 0.8 } },
    { name: 'Ardósia', hex: C.slate, role: ['Secundária. Rótulos e destaques', 'de título sobre o navy.'], ink: C.navy, sub: { color: C.navy, opacity: 0.8 } },
    { name: 'Branco', hex: C.white, role: ['Páginas claras, cards e texto', 'sobre o navy.'], ink: C.navy, sub: { color: C.body }, line: true },
  ]
  const mw = (W - 2 * M - 3 * 24) / 4, mh = 300
  main.forEach((c, i) => {
    const x = M + i * (mw + 24), y = 256
    s += rect(x + 0.5, y + 0.5, mw - 1, mh - 1, { rx: 16, fill: c.hex, stroke: c.line ? C.border : undefined })
    s += text(x + 28, y + 52, c.name, { size: 26, color: c.ink, track: -0.025 })
    s += text(x + 28, y + 82, c.role, { size: 13.5, lh: 1.5, ...c.sub })
    s += text(x + 28, y + mh - 58, c.hex, { size: 20, weight: 600, color: c.ink, track: 0.02 })
    s += text(x + 28, y + mh - 30, `RGB ${rgb(c.hex)}`, { size: 13, ...c.sub })
  })
  const support = [
    { name: 'Navy elevado', hex: C.raised, role: 'Miolo dos cards no navy' },
    { name: 'Laranja hover', hex: C.orangeHover, role: 'Botão laranja sob o mouse' },
    { name: 'Ardósia escura', hex: C.slateInk, role: 'Destaque de título no claro' },
    { name: 'Cinza-frio', hex: C.mist, role: 'Faixas entre seções claras' },
    { name: 'Texto corrido', hex: C.body, role: 'Parágrafos sobre o branco' },
    { name: 'Filete', hex: C.border, role: 'Bordas e divisores de 1 px' },
  ]
  const sw = (W - 2 * M - 5 * 16) / 6
  support.forEach((c, i) => {
    const x = M + i * (sw + 16), y = 588
    s += rect(x + 0.5, y + 0.5, sw - 1, 56, { rx: 10, fill: c.hex, stroke: c.hex === C.mist ? C.border : undefined })
    s += text(x, y + 82, c.name, { size: 14, weight: 600, color: C.navy })
    s += text(x, y + 102, `${c.hex}  ·  ${rgb(c.hex)}`, { size: 12.5 })
    s += text(x, y + 122, c.role, { size: 12.5 })
  })
  // proporção de uso
  s += micro(M, 782, 'Proporção de uso', C.navy)
  const bw = 648, segs = [[C.navy, 0.42, 'Navy'], [C.white, 0.26, 'Branco'], [C.mist, 0.16, 'Cinza-frio'], [C.slate, 0.1, 'Ardósia'], [C.orange, 0.06, 'Laranja']]
  let bx = M
  const barId = clip(M, 800, bw, 56, 10)
  s += `<g clip-path="url(#${barId})">`
  const labels = []
  segs.forEach(([color, share, label], i) => {
    s += rect(bx, 800, bw * share, 56, { fill: color })
    labels.push(text(i === segs.length - 1 ? M + bw : bx, 880, label, { size: 12, anchor: i === segs.length - 1 ? 'end' : undefined }))
    bx += bw * share
  })
  s += `</g>${rect(M + 0.5, 800.5, bw - 1, 55, { rx: 10, stroke: C.border })}${labels.join('')}`
  s += text(M, 906, 'Uma orientação, não uma regra fixa: o laranja é sempre a faísca, nunca o fundo de uma seção.', { size: 12.5 })
  // contraste
  const cx0 = 800
  s += micro(cx0, 782, 'Contraste (WCAG)', C.navy)
  const pairs = [
    [C.white, C.navy], [C.slate, C.navy], [C.navy, C.orange], [C.white, C.orange],
    [C.navy, C.white], [C.body, C.white], [C.slateInk, C.white], [C.orange, C.white],
  ]
  const pw = (W - M - cx0 - 3 * 12) / 4
  pairs.forEach(([fg, bg], i) => {
    const x = cx0 + (i % 4) * (pw + 12), y = 800 + Math.floor(i / 4) * 58
    const r = contrast(fg, bg)
    s += rect(x + 0.5, y + 0.5, pw - 1, 47, { rx: 8, fill: bg, stroke: bg === C.white ? C.border : undefined })
    s += text(x + 14, y + 32, 'Aa', { size: 20, weight: 600, color: fg })
    s += text(x + 52, y + 21, `${(Math.floor(r * 10) / 10).toFixed(1).replace('.', ',')}:1`, { size: 13, weight: 600, color: fg })
    s += text(x + 52, y + 37, verdict(r).toUpperCase(), { size: 9.5, weight: 600, track: 0.1, color: fg, opacity: 0.8 })
  })
  s += footer(5)
  page(5, 'cores', C.white, s)
}

// 06 · Tipografia ─────────────────────────────────────────────────────────────────
{
  let s = header(6, 'Tipografia', 'Inter, regular e justa', [
    'Títulos grandes em Inter 400, entrelinha curta e',
    'espaçamento negativo: o peso vem do tamanho, nunca',
    'do negrito. A Lexend Deca vive só no logotipo.',
  ])
  s += text(M - 10, 470, 'Aa', { size: 250, color: C.navy, track: -0.05 })
  s += text(M, 530, 'Inter', { size: 30, color: C.navy, track: -0.033 })
  s += text(M, 556, 'Google Fonts · títulos, textos, rótulos e interface', { size: 13 })
  s += text(M, 610, ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789  ãáâçéêíóõú  .,;:?!→'], { size: 18, color: C.navy, lh: 1.55, track: 0.02 })
  const weights = [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold']]
  weights.forEach(([w, name], i) => {
    s += text(M + i * 128, 740, name, { size: 18, weight: w, color: C.navy })
    s += text(M + i * 128, 762, String(w), { size: 12 })
  })
  s += line(M, 800, 600, 800)
  s += micro(M, 836, 'Só no logotipo', C.navy)
  s += wordmark(M, 852, 34, C.navy)
  s += text(M, 912, 'Lexend Deca Medium + ExtraLight, já em contornos nos arquivos.', { size: 12.5 })

  const x = 680
  const rows = [
    { label: 'Título hero · 64 px · entrelinha 1,02 · −0,05 em', y: 268, sample: 'Estrutura para melhorar.', o: { size: 64, track: -0.05 }, base: 334 },
    { label: 'Título de seção · 48 · 1,05 · −0,042 em', y: 378, sample: 'Uma sequência. Quatro pilares.', o: { size: 48, track: -0.042 }, base: 430 },
    { label: 'Subtítulo · 30 · 1,08 · −0,033 em', y: 470, sample: 'Conversa de diagnóstico', o: { size: 30, track: -0.033 }, base: 506 },
    { label: 'Título de card · 24 · 1,12 · −0,025 em', y: 546, sample: 'Cultura e pessoas', o: { size: 24, track: -0.025 }, base: 578 },
    { label: 'Texto de apoio · 18 · 1,55', y: 616, sample: 'Cada projeto é desenhado para a necessidade da empresa.', o: { size: 18, color: C.body }, base: 644 },
    { label: 'Texto · 15 · 1,55', y: 680, sample: 'Entendemos o momento da empresa e o que trava o crescimento.', o: { size: 15, color: C.body }, base: 704 },
    { label: 'Legenda · 13 · 1,45', y: 738, sample: 'Ilustrativo. O diagnóstico real é feito com a sua equipe.', o: { size: 13, color: C.body }, base: 760 },
  ]
  rows.forEach((r) => {
    s += line(x, r.y - 18, W - M, r.y - 18)
    s += micro(x, r.y, r.label, C.slateInk)
    s += text(x, r.base, r.sample, { color: C.navy, ...r.o })
  })
  s += line(x, 778, W - M, 778)
  s += micro(x, 796, 'Rótulo · 12 · bold · caixa alta · 0,15 em, com filete laranja', C.slateInk)
  s += eyebrow(x, 826, 'Como funciona', C.navy)
  s += line(x, 848, W - M, 848)
  s += micro(x, 866, 'Micro · 11 · medium · caixa alta · 0,12 em', C.slateInk)
  s += micro(x, 892, 'Fica na empresa', C.navy)
  s += footer(6)
  page(6, 'tipografia', C.white, s)
}

// 07 · Forma ─────────────────────────────────────────────────────────────────────
{
  let s = header(7, 'Forma', 'Chanfros, cortes e blocos', [
    'Toda forma nasce do emblema: chanfro a 45° e corte',
    'oblíquo 2:1 (cerca de 63°). Nada de curvas ou ondas',
    'como decoração. A profundidade vem do contraste.',
  ])
  const px = M, py = 256, pw = 620, ph = 640
  const pid = clip(px, py, pw, ph, 16)
  s += `<g clip-path="url(#${pid})">${rect(px, py, pw, ph, { fill: C.navy })}`
  s += glow(px, py, pw, ph, C.slate, 0.16, [0.5, 0.3], 0.6)
  s += isoGrid(px, py, pw, ph, 32, C.slate, 0.14, [0.5, 0.42], 0.62)
  s += block(px + 50, py + 40, pw - 100, 440, 1, [0, 1, 0, 0])
  s += '</g>'
  s += micro(px + 40, py + ph - 84, 'Emblema em bloco · isometria 2:1', C.slate)
  s += text(px + 40, py + ph - 56, ['O emblema ganha espessura e deita na mesma razão dos', 'seus cortes. No site, ele se forma e gira com o scroll.'], { size: 14, lh: 1.55, ...ON_NAVY })

  const gx = 740, tw = (W - M - gx - 24) / 2, th = 196
  const tiles = [
    {
      title: 'Chanfro a 45°', text: ['O canto externo de cada módulo. Linhas', 'decorativas seguem este ângulo ou o 2:1.'],
      draw: (dx, dy) => `<polygon points="${pts([[dx, dy + 12], [dx + 110, dy + 12], [dx + 150, dy + 52], [dx + 150, dy + 92], [dx, dy + 92]])}" fill="${C.navy}"/>`
        + `<path d="M${dx + 110} ${dy + 12}H${dx + 150}V${dy + 52}" fill="none" stroke="${C.slate}" stroke-dasharray="3 3"/>`
        + `<path d="M${dx + 134} ${dy + 12}A24 24 0 0 1 ${r2(dx + 110 + 16.97)} ${r2(dy + 12 + 16.97)}" fill="none" stroke="${C.orange}" stroke-width="1.5"/>`
        + text(dx + 168, dy + 40, '45°', { size: 16, weight: 600, color: C.orange }),
    },
    {
      title: 'Corte oblíquo 2:1', text: ['Sobe 2 para cada 1 (63,4°). É o encaixe dos', 'módulos e a inclinação das hachuras.'],
      draw: (dx, dy) => `<polygon points="${pts([[dx, dy + 92], [dx, dy + 12], [dx + 70, dy + 12], [dx + 110, dy + 92]])}" fill="${C.navy}"/>`
        + `<polygon points="${pts([[dx + 84, dy + 12], [dx + 190, dy + 12], [dx + 190, dy + 92], [dx + 124, dy + 92]])}" fill="${C.navy}"/>`
        + line(dx + 220, dy + 92, dx + 260, dy + 92, { stroke: C.slate, dash: '3 3' }) + line(dx + 260, dy + 92, dx + 260, dy + 12, { stroke: C.slate, dash: '3 3' })
        + line(dx + 220, dy + 92, dx + 260, dy + 12, { stroke: C.orange, sw: 1.5 })
        + text(dx + 240, dy + 110, '1', { size: 12, weight: 600, color: C.slateInk, anchor: 'middle' })
        + text(dx + 268, dy + 57, '2', { size: 12, weight: 600, color: C.slateInk }),
    },
    {
      title: 'Diagonais', text: ['Linhas finas laranja na inclinação do corte', 'atravessam fotos e fundos escuros.'],
      draw: (dx, dy) => { const id = clip(dx, dy + 4, 322, 88, 8); return `<g clip-path="url(#${id})">${rect(dx, dy + 4, 322, 88, { fill: C.navy })}${[[150, 0.9], [196, 0.5], [250, 0.25]].map(([o, a]) => line(dx + o, dy + 92, dx + o + 44, dy + 4, { stroke: C.orange, opacity: a })).join('')}${logo(dx + 18, dy + 36, 20, E.reverse, C.white)}</g>` },
    },
    {
      title: 'Cantos', text: ['Blocos de cor 0 · botões 8 · cards 16 ·', 'moldura 22 · etiquetas em pílula.'],
      draw: (dx, dy) => [0, 8, 16, 22].map((r, i) => rect(dx + i * 62 + 0.75, dy + 14.75, 46.5, 46.5, { rx: r, fill: C.white, stroke: C.navy, sw: 1.5 }) + text(dx + i * 62 + 24, dy + 84, String(r), { size: 11, weight: 600, color: C.slateInk, anchor: 'middle' })).join('')
        + rect(dx + 250.75, dy + 24.75, 70.5, 26.5, { rx: 13.25, fill: C.white, stroke: C.navy, sw: 1.5 }) + text(dx + 286, dy + 84, 'pílula', { size: 11, weight: 600, color: C.slateInk, anchor: 'middle' }),
    },
    {
      title: 'Filetes', text: ['1 px em #C9CCD3 no claro; ardósia a 18%', 'no navy. Separam sem pesar.'],
      draw: (dx, dy) => rect(dx, dy + 4, 150, 88, { rx: 8, fill: C.white }) + [30, 52, 74].map((o) => line(dx + 16, dy + o, dx + 134, dy + o)).join('')
        + rect(dx + 172, dy + 4, 150, 88, { rx: 8, fill: C.navy }) + [30, 52, 74].map((o) => line(dx + 188, dy + o, dx + 306, dy + o, { stroke: C.slate, opacity: 0.18 })).join(''),
    },
    {
      title: 'Sem sombra', text: ['O card se destaca pelo contraste: branco no', 'cinza-frio, navy elevado sobre o navy.'],
      draw: (dx, dy) => rect(dx + 0.5, dy + 4.5, 149, 87, { rx: 12, fill: C.white, stroke: C.coreLine })
        + rect(dx + 172, dy + 4, 150, 88, { rx: 12, fill: C.navy }) + rect(dx + 184.5, dy + 16.5, 125, 63, { rx: 8, fill: C.raised, stroke: C.white, strokeOpacity: 0.06 }),
    },
  ]
  tiles.forEach((t, i) => {
    const x = gx + (i % 2) * (tw + 24), y = 256 + Math.floor(i / 2) * (th + 26)
    s += rect(x, y, tw, th, { rx: 16, fill: C.mist })
    s += t.draw(x + 24, y + 22)
    s += text(x + 24, y + 148, t.title, { size: 15, weight: 600, color: C.navy })
    s += text(x + 24, y + 170, t.text, { size: 13, lh: 1.4 })
  })
  s += footer(7)
  page(7, 'forma', C.white, s)
}

// 08 · Texturas e efeitos ─────────────────────────────────────────────────────────
{
  let s = header(8, 'Texturas e efeitos', 'Texturas discretas', [
    'As texturas ficam atrás do conteúdo e somem por',
    'máscara radial, para nunca disputar com o texto.',
    'Sempre fracas, nunca atrás do logo, sem órbitas.',
  ])
  const tw = (W - 2 * M - 3 * 24) / 4, th = 226
  const glassBg = (x, y) => rect(x, y, tw, th, { fill: C.navy }) + network(x, y, tw, th, { seed: 11, count: 18, focus: [0.72, 0.14] })
    + text(x + 20, y + 104, ['Sua empresa pode', 'dar certo com ou', 'sem você por perto.'], { size: 28, color: C.white, track: -0.045, lh: 1.15 })
  const blur = uid('b')
  DEFS.push(`<filter id="${blur}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="10"/></filter>`)
  const tiles = [
    { title: 'Pontilhado', text: ['Pontos de 1 px numa grade de 20 px, navy', 'a 16% sobre o claro.'], bg: C.white, line: true, draw: (x, y) => dots(x, y, tw, th, 20, 1, C.navy, 0.32, [0.96, 0], 1.05) },
    { title: 'Grade', text: ['Linhas de 1 px a cada 44 px, navy a 6%,', 'no fundo das seções claras.'], bg: C.mist, draw: (x, y) => grid(x, y, tw, th, 44, C.navy, 0.12, [0.5, 0], 1.05) },
    { title: 'Grão', text: ['Pontos de 0,7 px a cada 5 px, branco a', '12–14%, para o navy não ficar liso.'], bg: C.navy, draw: (x, y) => dots(x, y, tw, th, 5, 0.7, C.white, 0.28, [0.2, 0], 1) },
    { title: 'Hachura 2:1', text: ['Linhas de 1 px a cada 12 px na inclinação', 'dos cortes do emblema, navy a 8%.'], bg: C.white, line: true, draw: (x, y) => hatch(x, y, tw, th, 12, C.navy, 0.16, [0, 1], 1.05) },
    { title: 'Luz difusa', text: ['Brilho elíptico em ardósia a 14%, no alto', 'das seções escuras.'], bg: C.navy, draw: (x, y) => glow(x, y, tw, th, C.slate, 0.3, [0.12, 0], 0.95) },
    {
      title: 'Supergráfico', text: ['O emblema em branco a 6%, grande e', 'cortado pela borda, à direita.'], bg: C.navy,
      draw: (x, y) => symbol(x + tw - 230, y - 30, 280, E.white, ' opacity=".06"') + text(x + 22, y + th - 30, ['Estrutura para melhorar.', 'Ritmo para crescer.'], { size: 17, color: C.white, track: -0.03, lh: 1.2 }).replace('<text ', `<text transform="translate(0 -20)" `),
    },
    { title: 'Grafo de conexões', text: ['Nós e linhas em ardósia; um ciclo de quatro', 'nós aceso em laranja. Fundo do hero.'], bg: C.navy, draw: (x, y) => network(x, y, tw, th, { seed: 5, count: 22 }) },
    {
      title: 'Vidro', text: ['Só na barra de navegação: navy a 82% com', 'desfoque de 16 px sobre o conteúdo.'], bg: C.navy,
      draw: (x, y) => {
        const bar = clip(x, y, tw, 54)
        return glassBg(x, y)
          + `<g clip-path="url(#${bar})"><g filter="url(#${blur})">${glassBg(x, y)}</g>${rect(x, y, tw, 54, { fill: C.navy, fillOpacity: 0.82 })}</g>`
          + line(x, y + 54, x + tw, y + 54, { stroke: C.white, opacity: 0.08 })
          + logo(x + 16, y + 20, 14, E.reverse, C.white)
          + text(x + 142, y + 31, 'Método', { size: 11, color: C.white, opacity: 0.8 }) + text(x + 192, y + 31, 'Dúvidas', { size: 11, color: C.white, opacity: 0.8 })
          + rect(x + tw - 84.5, y + 14.5, 69, 25, { rx: 6, stroke: C.white, strokeOpacity: 0.36 }) + text(x + tw - 50, y + 31, 'Agendar', { size: 10.5, weight: 500, color: C.white, anchor: 'middle' })
      },
    },
  ]
  tiles.forEach((t, i) => {
    const x = M + (i % 4) * (tw + 24), y = 256 + Math.floor(i / 4) * 328
    const id = clip(x, y, tw, th, 16)
    s += `<g clip-path="url(#${id})">${rect(x, y, tw, th, { fill: t.bg })}${t.draw(x, y)}</g>`
    if (t.line) s += rect(x + 0.5, y + 0.5, tw - 1, th - 1, { rx: 16, stroke: C.border })
    s += text(x, y + th + 30, t.title, { size: 15, weight: 600, color: C.navy })
    s += text(x, y + th + 52, t.text, { size: 13, lh: 1.4 })
  })
  s += text(M, 916, 'Amostras com o dobro da intensidade de uso, para leitura nesta página. Os valores reais estão nas legendas.', { size: 12.5 })
  s += footer(8)
  page(8, 'texturas-e-efeitos', C.white, s)
}

// 09 · Componentes ──────────────────────────────────────────────────────────────
{
  let s = header(9, 'Componentes', 'Botões, rótulos e cards', [
    'A moldura dupla (casca de 6 px e miolo com raio de',
    '16 px) organiza o conteúdo. O botão principal é',
    'laranja, com seta; os demais têm contorno.',
  ])
  const pw = (W - 2 * M - 24) / 2, ph = 640, py = 256
  // tom escuro
  {
    const px = M
    const id = clip(px, py, pw, ph, 16)
    s += `<g clip-path="url(#${id})">${rect(px, py, pw, ph, { fill: C.navy })}${glow(px, py, pw, ph, C.slate, 0.14, [0.12, 0])}</g>`
    s += eyebrow(px + 40, 304, 'Método Base', C.slate)
    s += micro(px + pw - 40, 304, 'Tom escuro', C.slate, { anchor: 'end' })
    s += text(px + 40, 352, ['Uma sequência. Quatro pilares.', 'Uma empresa {{mais capaz de funcionar.}}'], { size: 30, color: C.white, track: -0.033, lh: 1.12 })
    const b1 = button(px + 40, 416, 'Agendar diagnóstico')
    s += b1.svg + button(px + 40 + b1.w + 12, 416, 'Conhecer o Método Base', 'outline').svg
    s += frameDark(px + 40, 496, 388)
    const cx = px + 40 + 388 + (pw - 80 - 388) / 2
    s += ring(cx, 566, 60, 10, 0.75, ['3', '/4'], C.slate, C.navy)
    s += micro(cx, 662, 'Anel de progresso', C.slate, { anchor: 'middle' })
    s += graphic('radar-diagnostico.svg', cx - 80, 680, 160, 160)
    s += micro(cx, 864, 'Radar de diagnóstico', C.slate, { anchor: 'middle' })
  }
  // tom claro
  {
    const px = M + pw + 24
    const id = clip(px, py, pw, ph, 16)
    s += `<g clip-path="url(#${id})">${rect(px, py, pw, ph, { fill: C.mist })}${grid(px, py, pw, ph, 44, C.navy, 0.06, [0.5, 0], 0.75)}</g>`
    s += eyebrow(px + 40, 304, 'Como funciona', C.navy)
    s += micro(px + pw - 40, 304, 'Tom claro', C.body, { anchor: 'end' })
    s += text(px + 40, 352, ['Do diagnóstico {{à rotina}},', 'reunião a reunião.'], { size: 30, color: C.navy, track: -0.033, lh: 1.12, hl: { color: C.slateInk } })
    const b1 = button(px + 40, 416, 'Agendar diagnóstico')
    s += b1.svg + button(px + 40 + b1.w + 12, 416, 'Conhecer o método', 'outlineLight').svg
    s += frameLight(px + 40, 496, 388)
    const rx = px + 40 + 388 + 24, rw = pw - 80 - 388 - 24
    s += rect(rx + 0.5, 496.5, rw - 1, 175, { rx: 12, fill: C.white, stroke: C.coreLine })
    s += text(rx + 18, 524, 'ESTRUTURA', { size: 10, weight: 700, track: 0.14, color: C.slateInk })
    s += text(rx + 18, 556, '4/4 pilares', { size: 22, color: C.navy, track: -0.025 })
    s += graphic('curva-ciclos.svg', rx + 18, 574, rw - 36, 70)
    s += text(rx + 18, 662, 'Mais ciclos, mais velocidade', { size: 11, color: C.body })
    s += micro(rx, 712, 'Etiquetas', C.body)
    ;['INÍCIO', '6 A 12 MESES', 'DEPOIS'].forEach((label, i) => { s += pill(rx, 728 + i * 36, label).svg })
    s += micro(rx, 864, 'Hover', C.body)
    s += button(rx + 56, 838, 'Agendar', 'hover', 'sm').svg
  }
  s += footer(9)
  page(9, 'componentes', C.white, s)
}

// 10 · Movimento e voz ─────────────────────────────────────────────────────────────
{
  let s = header(10, 'Movimento e voz', 'Ritmo calmo, frases curtas', [
    'O movimento é curto e acompanha a leitura. O texto',
    'fala de operação com palavras concretas, em pares',
    'paralelos.',
  ])
  s += micro(M, 268, 'A história do emblema no site', C.navy)
  const fs = 152, fg = 24
  const frames = [
    { cap: 'Grafo de ideias', draw: (x, y) => network(x, y, fs, fs, { seed: 3, count: 14, focus: [0.5, 0.5] }) },
    { cap: 'Vira o emblema', draw: (x, y) => symbol(x + 36, y + 36, 80, E.reverse) },
    { cap: 'Gira e deita', draw: (x, y) => block(x + 14, y + 14, fs - 28, fs - 28, 0.5, [0, 1, 0, 0]) },
    { cap: 'Cada pilar acende', draw: (x, y) => block(x + 14, y + 14, fs - 28, fs - 28, 1, [1, 1, 1, 1]) },
  ]
  frames.forEach((f, i) => {
    const x = M + i * (fs + fg), y = 284
    const id = clip(x, y, fs, fs, 12)
    s += `<g clip-path="url(#${id})">${rect(x, y, fs, fs, { fill: C.navy })}${f.draw(x, y)}</g>`
    s += text(x, y + fs + 26, pad(i + 1), { size: 12, weight: 600, color: C.orange })
    s += text(x + 26, y + fs + 26, f.cap, { size: 13.5, color: C.navy })
  })
  s += text(M, 496, ['O scroll conduz a história: o grafo forma o emblema, que gira, deita em', 'isometria e acende cada pilar. Com movimento reduzido, a página já', 'mostra o estado final.'], { size: 14, lh: 1.55 })

  s += micro(M, 600, 'Ritmo', C.navy)
  const ex = M, ey = 616, es = 200, ip = 26, iw = es - 2 * ip
  s += rect(ex, ey, es, es, { rx: 12, fill: C.mist })
  const Q = (u, v) => [ex + ip + u * iw, ey + ip + iw - v * iw]
  s += line(...Q(0, 0), ...Q(1, 0), { stroke: C.border }) + line(...Q(0, 0), ...Q(0, 1), { stroke: C.border })
  s += line(...Q(0, 0), ...Q(0.2, 0.7), { stroke: C.slate, dash: '3 3' }) + line(...Q(1, 1), ...Q(0.2, 1), { stroke: C.slate, dash: '3 3' })
  s += `<circle cx="${r2(Q(0.2, 0.7)[0])}" cy="${r2(Q(0.2, 0.7)[1])}" r="3.5" fill="${C.slate}"/><circle cx="${r2(Q(0.2, 1)[0])}" cy="${r2(Q(0.2, 1)[1])}" r="3.5" fill="${C.slate}"/>`
  s += `<path d="M${pts([Q(0, 0)])}C${pts([Q(0.2, 0.7), Q(0.2, 1), Q(1, 1)])}" fill="none" stroke="${C.orange}" stroke-width="2.5" stroke-linecap="round"/>`
  s += text(ex, ey + es + 24, 'cubic-bezier(.2, .7, .2, 1)', { size: 12.5, weight: 500, color: C.slateInk })
  const specs = [
    ['Entrada', ['Sobe 12 px e aparece em 480 ms, desacelerando.', 'Itens de um bloco entram a cada 80 ms.']],
    ['Hover', ['Só troca a cor, em 200 ms. A seta do botão', 'desliza 3 px.']],
    ['Clique', ['O botão afunda levemente, para 96%.']],
    ['Foco', ['Contorno laranja de 2 px, afastado 3 px.']],
  ]
  let sy = 632
  specs.forEach(([title, body]) => {
    s += text(M + es + 32, sy, title, { size: 15, weight: 600, color: C.navy })
    s += text(M + es + 32, sy + 22, body, { size: 14, lh: 1.5 })
    sy += 22 + body.length * 21 + 22
  })

  const vx = 860
  s += micro(vx, 268, 'Assinatura', C.navy)
  s += text(vx, 318, ['Estrutura para melhorar.', '{{Ritmo para crescer.}}'], { size: 38, color: C.navy, track: -0.04, lh: 1.08, hl: { color: C.slateInk } })
  s += micro(vx, 428, 'Categoria', C.navy)
  s += text(vx, 460, 'Sistemas de crescimento operacional', { size: 21, color: C.navy, track: -0.02 })
  s += micro(vx, 516, 'Os quatro pilares, nesta ordem', C.navy)
  ;['Cultura', 'Processos', 'Treinamentos', 'Planejamento'].forEach((name, i) => {
    const x = vx + (i % 2) * 300, y = 550 + Math.floor(i / 2) * 34
    s += text(x, y, pad(i + 1), { size: 12, weight: 600, color: C.orange })
    s += text(x + 28, y, name, { size: 18, color: C.navy, track: -0.015 })
  })
  s += micro(vx, 640, 'A ideia central', C.navy)
  s += text(vx, 680, '+ ciclos = + velocidade', { size: 32, color: C.navy, track: -0.035 })
  s += micro(vx, 730, 'Como escrever', C.navy)
  ;[
    'Frases curtas, em pares paralelos.',
    'Palavras de operação: estrutura, processo, ciclo, ritmo, padrão.',
    'Resultado de negócio mensurável, não “transformação”.',
    'Títulos em frase comum, com ponto final quando afirmam.',
    'Sem exclamação, superlativo vazio ou emoji.',
  ].forEach((item, i) => {
    const y = 762 + i * 30
    s += rect(vx, y - 5, 10, 1.6, { fill: C.orange })
    s += text(vx + 22, y, item, { size: 15 })
  })
  s += footer(10)
  page(10, 'movimento-e-voz', C.white, s)
}

// ── arquivo ─────────────────────────────────────────────────────────────────

const font = readFileSync(path.join(ROOT, 'public/menuzito/assets/fonts/inter-latin.woff2')).toString('base64')
const style = `<style>@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${font}) format('woff2')}</style>`
const head = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="titulo descricao">`
  + '<title id="titulo">ProcessBase · Guia de marca</title>'
  + '<desc id="descricao">Logo e versões, construção do emblema, usos incorretos, cores, tipografia, forma, texturas e efeitos, componentes, movimento e voz da ProcessBase. Versão 1, outubro de 2026.</desc>'
  + `<defs>${style}</defs>`

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, `${head(W, H * PAGES)}\n${pages.map((p) => p.svg).join('\n')}\n</svg>\n`)
console.log(`${path.relative(ROOT, OUT)} · ${PAGES} páginas · ${(readFileSync(OUT).length / 1024).toFixed(0)} KB`)

if (PAGES_DIR) {
  mkdirSync(PAGES_DIR, { recursive: true })
  for (const p of pages) {
    const file = path.join(PAGES_DIR, `${pad(p.n)}-${p.id}.svg`)
    writeFileSync(file, `${head(W, H)}${p.svg.replace(/ y="\d+" width="1600" height="1000" viewBox/, ' y="0" width="1600" height="1000" viewBox')}</svg>\n`)
  }
  console.log(`${pages.length} páginas soltas em ${PAGES_DIR}`)
}
