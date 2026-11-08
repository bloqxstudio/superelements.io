/**
 * Como a Iara (e os modelos) desenham num quadro (2026-11-07, o usuário: "os posts ficaram embolados…
 * não quero que fique um sobre o outro" e "deixe mais visuais as entradas da iara, com ícones, modelos,
 * ligações entre cards"). Antes as notas eram postas numa grade de 180 px fixos, e o Excalidraw esticava
 * cada nota até caber o texto (250–500 px), uma em cima da outra. Agora cada item é medido antes (`Measure`:
 * no navegador, o próprio Excalidraw mede; nos testes, uma estimativa) e a posição sai da altura real.
 *
 * Sem imports: roda no navegador e nos testes do Node. Os ids são nossos (sem `regenerateIds`), para
 * frames e setas apontarem para o elemento certo.
 */

export const FONT = 6
export const INK = '#1e1e1e'

/** Cores das notas (fundo claro) e o tom forte da mesma cor (ícone, barra do cartão, setas). */
export const PALETTE: { name: string; color: string; strong: string }[] = [
  { name: 'Amarelo', color: '#fff1a8', strong: '#d9a400' },
  { name: 'Laranja', color: '#ffd8a8', strong: '#e8590c' },
  { name: 'Rosa', color: '#ffc9de', strong: '#d6336c' },
  { name: 'Roxo', color: '#e0d4ff', strong: '#7048e8' },
  { name: 'Azul', color: '#c5e4ff', strong: '#1c7ed6' },
  { name: 'Verde', color: '#c8f0c4', strong: '#2b8a3e' },
  { name: 'Cinza', color: '#e8e8e6', strong: '#5c5c58' },
]

/** A cor de nota por nome ("amarelo", "azul"…) ou hex; sem nome conhecido, `fallback`. */
export const stickyColor = (name: unknown, fallback = PALETTE[0].color): string => {
  if (typeof name !== 'string') return fallback
  const n = name.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(n)) return n
  return PALETTE.find((c) => c.name.toLowerCase() === n || c.name.toLowerCase().slice(0, -1) === n.slice(0, -1))?.color ?? fallback
}
/** O tom forte de uma cor de nota (ou a própria cor, se não for da paleta). */
export const strongOf = (color: string) => PALETTE.find((c) => c.color === color)?.strong ?? color

export interface DraftItem {
  id?: string
  titulo?: string
  texto?: string
  cor?: string
  icone?: string
  tag?: string
  /** nota adesiva (texto curto) ou cartão (título, texto, ícone, etiqueta). */
  kind: 'nota' | 'cartao'
}
export interface DraftColumn { nome: string; cor?: string; itens: DraftItem[] }
export interface DraftLink { de: string | number; para: string | number; texto?: string }
export interface BoardDraft {
  titulo?: string
  subtitulo?: string
  notas?: DraftItem[]
  cartoes?: DraftItem[]
  colunas?: DraftColumn[]
  /** Mapa: o tema no centro e os itens em volta, ligados a ele. */
  centro?: string
  /** Fluxo: os cartões em sequência, com setas de um para o outro. */
  fluxo?: boolean
  ligacoes?: DraftLink[]
}

/** Altura da caixa de um texto quebrado na largura dada (inclui o respiro de 5 px do Excalidraw). */
export type Measure = (text: string, width: number, fontSize: number) => number

/** Estimativa (Nunito ≈ 0,53 em por letra, linha de 1,25): usada nos testes e quando não há medidor. */
export const estimate: Measure = (text, width, fontSize) => {
  const perLine = Math.max(4, Math.floor((width - 10) / (fontSize * 0.53)))
  let lines = 0
  for (const para of text.split('\n')) {
    let len = 0
    let l = 1
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const w = word.length
      if (len && len + 1 + w > perLine) { l += 1; len = w } else len += (len ? 1 : 0) + w
      while (len > perLine) { l += 1; len -= perLine }
    }
    lines += l
  }
  return Math.ceil(lines * fontSize * 1.25 + 10)
}

type Skel = Record<string, unknown>
export interface IconUse { fileId: string; name: string; color: string }
export interface Planned { skeleton: Skel[]; icons: IconUse[]; mainIds: string[] }

const uid = () => {
  const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = 'ia'
  for (let i = 0; i < 18; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}
export const iconFileId = (name: string, color: string) => `icone-${name.replace(/[^a-z0-9-]/g, '')}-${color.replace('#', '')}`

const box = (id: string, x: number, y: number, w: number, h: number, extra: Skel = {}): Skel => ({
  type: 'rectangle', id, x, y, width: w, height: h, strokeColor: 'transparent', backgroundColor: 'transparent',
  fillStyle: 'solid', strokeWidth: 1, roughness: 0, roundness: null, ...extra,
})
const label = (text: string, fontSize: number, color = INK, align: 'left' | 'center' = 'left', valign: 'top' | 'middle' = 'top') =>
  ({ text, fontSize, fontFamily: FONT, strokeColor: color, textAlign: align, verticalAlign: valign })

export const NOTE_W = (text: string) => (text.length <= 60 ? 200 : text.length <= 160 ? 240 : 280)
export const CARD_W = 280
const GAP = 24

/** Um item desenhado a partir de (x, y) na largura `w`: os elementos, a altura e o id principal. */
export function itemSkeleton(it: DraftItem, x: number, y: number, w: number, measure: Measure, fallbackColor = PALETTE[0].color, icons: IconUse[] = [], minH = 0):
  { els: Skel[]; h: number; mainId: string } {
  const color = stickyColor(it.cor, fallbackColor)
  const strong = strongOf(color)
  const mainId = uid()
  const els: Skel[] = []
  const group = uid()
  const icon = it.icone ? { fileId: iconFileId(it.icone, strong), name: it.icone, color: strong } : undefined
  if (icon && !icons.some((i) => i.fileId === icon.fileId)) icons.push(icon)

  if (it.kind === 'nota') {
    const text = [it.titulo, it.texto].filter(Boolean).join('\n')
    const long = text.length > 70 || text.includes('\n')
    const fs = text.length > 180 ? 16 : 18
    const h = Math.max(minH, Math.min(150, Math.round(w * 0.72)), measure(text, w, fs) + (long ? 16 : 24))
    els.push(box(mainId, x, y, w, h, {
      backgroundColor: color, customData: { sticky: true },
      ...(text ? { label: label(text, fs, INK, long ? 'left' : 'center', long ? 'top' : 'middle') } : {}),
    }))
    if (icon) {
      els.push({ type: 'ellipse', id: uid(), x: x + w - 30, y: y - 12, width: 38, height: 38, backgroundColor: '#ffffff', fillStyle: 'solid', strokeColor: strong, strokeWidth: 1, roughness: 0 })
      els.push({ type: 'image', id: uid(), x: x + w - 30 + 9, y: y - 12 + 9, width: 20, height: 20, fileId: icon.fileId, status: 'saved' })
      for (const e of els) e.groupIds = [group]
    }
    return { els, h, mainId }
  }

  // cartão: fundo branco, barra de cor à esquerda, ícone, título, texto e etiqueta
  const pad = 16
  const iconSize = 22
  const titleX = x + pad + (icon ? iconSize + 10 : 0)
  const titleW = x + w - pad - titleX
  const title = it.titulo || it.texto || ''
  const body = it.titulo ? it.texto : undefined
  const th = Math.max(30, measure(title, titleW, 18))
  const parts: Skel[] = []
  let by = y + pad - 4
  parts.push(box(uid(), titleX, by, titleW, th, { customData: { cardPart: 'titulo' }, label: label(title, 18, INK, 'left', 'middle') }))
  if (icon) parts.push({ type: 'image', id: uid(), x: x + pad, y: by + (th - iconSize) / 2, width: iconSize, height: iconSize, fileId: icon.fileId, status: 'saved' })
  by += th + 4
  if (body) {
    const bh = measure(body, w - 2 * pad, 15)
    parts.push(box(uid(), x + pad, by, w - 2 * pad, bh, { customData: { cardPart: 'texto' }, label: label(body, 15, '#55534e') }))
    by += bh + 4
  }
  if (it.tag) {
    const tw = Math.min(w - 2 * pad, Math.round(it.tag.length * 7.4 + 24))
    parts.push(box(uid(), x + pad, by + 4, tw, 24, { backgroundColor: color, roundness: { type: 3, value: 8 }, customData: { cardPart: 'tag' }, label: label(it.tag, 12, INK, 'center', 'middle') }))
    by += 32
  }
  const h = Math.max(84, minH, by - y + pad - 4)
  els.push(box(mainId, x, y, w, h, { backgroundColor: '#ffffff', strokeColor: '#dddbd4', roundness: { type: 3, value: 12 }, customData: { card: true } }))
  els.push(box(uid(), x + 1, y + 14, 4, Math.max(8, h - 28), { backgroundColor: strong, customData: { cardPart: 'barra' } }))
  els.push(...parts)
  for (const e of els) e.groupIds = [group]
  return { els, h, mainId }
}

/** O ponto na borda de `a` na direção do centro de `b`, afastado `gap`. */
export function edgePoint(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, gap = 8) {
  const ax = a.x + a.width / 2, ay = a.y + a.height / 2
  const dx = b.x + b.width / 2 - ax, dy = b.y + b.height / 2 - ay
  if (!dx && !dy) return { x: ax, y: ay }
  const sx = dx ? (a.width / 2 + gap) / Math.abs(dx) : Infinity
  const sy = dy ? (a.height / 2 + gap) / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: ax + dx * s, y: ay + dy * s }
}

type Box = { x: number; y: number; width: number; height: number }
/**
 * Os dois pontos da seta de `a` para `b`. Lado a lado (as alturas se cruzam), a seta é reta na horizontal,
 * na altura do meio da faixa em comum; um sobre o outro, reta na vertical; senão, de borda a borda na
 * direção dos centros. Cartões vizinhos com alturas diferentes não ganham mais seta torta.
 */
export function arrowEnds(a: Box, b: Box, gap = 8): { p: { x: number; y: number }; q: { x: number; y: number } } {
  const top = Math.max(a.y, b.y), bottom = Math.min(a.y + a.height, b.y + b.height)
  const left = Math.max(a.x, b.x), right = Math.min(a.x + a.width, b.x + b.width)
  if (bottom - top > 12 && (b.x >= a.x + a.width || a.x >= b.x + b.width)) {
    const y = (top + bottom) / 2
    const toRight = b.x >= a.x + a.width
    return { p: { x: toRight ? a.x + a.width + gap : a.x - gap, y }, q: { x: toRight ? b.x - gap : b.x + b.width + gap, y } }
  }
  if (right - left > 12 && (b.y >= a.y + a.height || a.y >= b.y + b.height)) {
    const x = (left + right) / 2
    const down = b.y >= a.y + a.height
    return { p: { x, y: down ? a.y + a.height + gap : a.y - gap }, q: { x, y: down ? b.y - gap : b.y + b.height + gap } }
  }
  return { p: edgePoint(a, b, gap), q: edgePoint(b, a, gap) }
}

/**
 * O caminho da seta de `a` para `b` (pontos relativos ao primeiro). Lado a lado ou um sobre o outro: reta.
 * `b` numa linha abaixo e fora da coluna de `a` (a volta de um fluxo que quebrou a linha): desce, atravessa
 * no meio do vão e desce de novo, em vez de cortar o quadro na diagonal.
 */
export function arrowRoute(a: Box, b: Box, gap = 8): { start: { x: number; y: number }; points: [number, number][] } {
  const below = b.y >= a.y + a.height + 24
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  if (below && overlapX <= 12) {
    const p = { x: a.x + a.width / 2, y: a.y + a.height + gap }
    const q = { x: b.x + b.width / 2, y: b.y - gap }
    const mid = (a.y + a.height + b.y) / 2 - p.y
    return { start: p, points: [[0, 0], [0, mid], [q.x - p.x, mid], [q.x - p.x, q.y - p.y]] }
  }
  const { p, q } = arrowEnds(a, b, gap)
  return { start: p, points: [[0, 0], [q.x - p.x, q.y - p.y]] }
}

type Rect = { x: number; y: number; width: number; height: number }
/** Uma seta ligando dois elementos (o Excalidraw grava a ligação e a seta acompanha quando eles mudam). */
export function arrowSkeleton(from: Rect & { id: string }, to: Rect & { id: string }, opts: { text?: string; color?: string; head?: boolean } = {}): Skel {
  const { start: p, points } = arrowRoute(from, to)
  const last = points[points.length - 1]
  return {
    type: 'arrow', id: uid(), x: p.x, y: p.y, width: Math.max(...points.map((pt) => Math.abs(pt[0]))), height: Math.max(...points.map((pt) => Math.abs(pt[1]))),
    points,
    strokeColor: opts.color ?? '#8a8983', strokeWidth: 2, roughness: 0, roundness: points.length > 2 ? null : { type: 2 },
    endArrowhead: opts.head === false ? null : 'arrow', startArrowhead: null,
    start: { id: from.id }, end: { id: to.id },
    ...(opts.text ? { label: { text: opts.text, fontSize: 14, fontFamily: FONT, strokeColor: '#55534e' } } : {}),
  }
}

/**
 * O bloco inteiro a partir de (x, y): título, depois colunas (frames), mapa, fluxo ou grade; por fim as
 * ligações pedidas. Nada se sobrepõe: cada coluna empilha os itens pela altura medida, a grade põe cada
 * item na coluna mais baixa, e o frame cresce até caber tudo.
 */
export function planDraft(d: BoardDraft, x: number, y: number, measure: Measure = estimate): Planned {
  const skeleton: Skel[] = []
  const icons: IconUse[] = []
  const mainIds: string[] = []
  const placed: { item: DraftItem; rect: Rect & { id: string } }[] = []
  let top = y

  if (d.titulo) {
    skeleton.push({ type: 'text', id: uid(), x, y: top, text: d.titulo, fontSize: 36, fontFamily: FONT, strokeColor: INK })
    top += 56
    if (d.subtitulo) { skeleton.push({ type: 'text', id: uid(), x, y: top, text: d.subtitulo, fontSize: 18, fontFamily: FONT, strokeColor: '#6b6a64' }); top += 34 }
    top += 30
  }

  const put = (it: DraftItem, px: number, py: number, w: number, color?: string, minH = 0) => {
    const r = itemSkeleton(it, px, py, w, measure, color, icons, minH)
    skeleton.push(...r.els)
    mainIds.push(r.mainId)
    placed.push({ item: it, rect: { id: r.mainId, x: px, y: py, width: w, height: r.h } })
    return r
  }

  if (d.colunas?.length) {
    const COL_W = 280
    const PAD = 20
    let fx = x
    d.colunas.slice(0, 10).forEach((col, ci) => {
      const fallback = stickyColor(col.cor, PALETTE[ci % PALETTE.length].color)
      const items = col.itens.slice(0, 24)
      // muitas notas numa coluna: duas trilhas lado a lado, cada item na mais baixa
      const tracks = items.length > 6 ? 2 : 1
      const heights = new Array(tracks).fill(top + PAD + 10)
      const ids: string[] = []
      for (const it of items) {
        const t = heights.indexOf(Math.min(...heights))
        const r = put(it, fx + PAD + t * (COL_W + GAP), heights[t], COL_W, fallback)
        ids.push(...r.els.map((e) => e.id as string))
        heights[t] += r.h + GAP
      }
      const fw = tracks * COL_W + (tracks - 1) * GAP + 2 * PAD
      const fh = Math.max(240, Math.max(...heights) - top + PAD - GAP + 10)
      skeleton.push({ type: 'frame', id: uid(), x: fx, y: top, width: fw, height: fh, name: col.nome, children: ids })
      fx += fw + 48
    })
  } else {
    const items = [...(d.cartoes ?? []), ...(d.notas ?? [])].slice(0, 48)
    if (d.centro) {
      // mapa: o tema no centro e os itens numa elipse em volta, cada um ligado ao centro
      const widths = items.map((it) => (it.kind === 'cartao' ? CARD_W : NOTE_W([it.titulo, it.texto].join(' '))))
      const rx = Math.max(420, (widths.reduce((s, w) => s + w + GAP * 2, 0) / (2 * Math.PI)) * 1.25)
      const ry = rx * 0.72
      const cx = x + rx + 160, cy = top + ry + 160
      const cw = 320
      const ch = Math.max(120, measure(d.centro, cw, 26) + 30)
      const center = { id: uid(), x: cx - cw / 2, y: cy - ch / 2, width: cw, height: ch }
      skeleton.push({ ...box(center.id, center.x, center.y, cw, ch), type: 'ellipse', backgroundColor: INK, strokeColor: INK, label: label(d.centro, 26, '#ffffff', 'center', 'middle') })
      items.forEach((it, i) => {
        const a = (i / Math.max(1, items.length)) * Math.PI * 2 - Math.PI / 2
        const w = widths[i]
        // a altura só se sabe depois de medir: mede antes num lugar qualquer e reposiciona pelo centro
        const h = itemSkeleton(it, 0, 0, w, measure).h
        const r = put(it, cx + Math.cos(a) * rx - w / 2, cy + Math.sin(a) * ry - h / 2, w, PALETTE[i % 6].color)
        skeleton.push(arrowSkeleton(center, placed[placed.length - 1].rect, { head: false, color: '#b8b6ae' }))
        void r
      })
    } else if (d.fluxo) {
      // até 7 numa linha só; mais que isso quebra, e a seta da volta faz o L
      const perRow = items.length <= 7 ? Math.max(1, items.length) : 5
      let rowTop = top
      for (let i = 0; i < items.length; i += perRow) {
        const row = items.slice(i, i + perRow)
        // a linha inteira com a altura do cartão mais alto: as setas saem retas
        const rowH = Math.max(...row.map((it) => itemSkeleton(it, 0, 0, CARD_W, measure).h))
        row.forEach((it, j) => put(it, x + j * (CARD_W + 90), rowTop, CARD_W, PALETTE[(i + j) % 6].color, rowH))
        rowTop += rowH + 90
      }
      for (let i = 1; i < placed.length; i++) skeleton.push(arrowSkeleton(placed[i - 1].rect, placed[i].rect))
    } else if (items.length) {
      // grade em alvenaria: cada item vai para a coluna mais baixa
      const w = Math.max(...items.map((it) => (it.kind === 'cartao' ? CARD_W : NOTE_W([it.titulo, it.texto].join(' ')))))
      const cols = items.some((it) => it.kind === 'cartao') ? 3 : 4
      const heights = new Array(Math.min(cols, items.length)).fill(top)
      items.forEach((it, i) => {
        const c = heights.indexOf(Math.min(...heights))
        const r = put(it, x + c * (w + GAP), heights[c], w, it.kind === 'nota' ? PALETTE[0].color : PALETTE[i % 6].color)
        heights[c] += r.h + GAP
      })
    }
  }

  // ligações pedidas: por id dado, posição (1, 2…) ou começo do título
  const find = (key: string | number) => {
    if (typeof key === 'number' || /^\d+$/.test(String(key))) return placed[Number(key) - 1]
    const k = String(key).trim().toLowerCase()
    return placed.find((p) => p.item.id === key) ?? placed.find((p) => (p.item.titulo ?? p.item.texto ?? '').toLowerCase().startsWith(k))
  }
  for (const l of (d.ligacoes ?? []).slice(0, 60)) {
    const a = find(l.de), b = find(l.para)
    // Uma cor só para as setas (antes cada uma puxava a cor do cartão de origem e o fluxo parecia quebrado)
    if (a && b && a !== b) skeleton.push(arrowSkeleton(a.rect, b.rect, { text: l.texto }))
  }
  return { skeleton, icons, mainIds }
}

/** Lê o que a Iara mandou (strings ou objetos) como itens. */
export function readItems(v: unknown, kind: 'nota' | 'cartao'): DraftItem[] {
  if (!Array.isArray(v)) return []
  const s = (x: unknown, n: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, n) : undefined)
  return v.slice(0, 48).map((n): DraftItem | null => {
    if (typeof n === 'string') return n.trim() ? { kind, texto: n.trim().slice(0, 600) } : null
    if (!n || typeof n !== 'object') return null
    const o = n as Record<string, unknown>
    const it: DraftItem = {
      kind: o.titulo && kind === 'nota' && (o.icone || o.tag) ? 'cartao' : kind,
      id: s(o.id, 60), titulo: s(o.titulo, 160), texto: s(o.texto, 600), cor: s(o.cor, 20), icone: s(o.icone, 40), tag: s(o.tag, 40),
    }
    return it.titulo || it.texto ? it : null
  }).filter((x): x is DraftItem => !!x)
}

/** O pedido da Iara (ou de um modelo) como `BoardDraft`. */
export function readDraft(a: Record<string, unknown>): BoardDraft {
  const s = (x: unknown, n: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, n) : undefined)
  const colunas = (Array.isArray(a.colunas) ? a.colunas : [])
    .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : null))
    .filter((c): c is Record<string, unknown> => !!c && !!s(c.nome, 80))
    .map((c) => ({ nome: s(c.nome, 80)!, cor: s(c.cor, 20), itens: [...readItems(c.cartoes, 'cartao'), ...readItems(c.notas ?? c.itens, 'nota')] }))
  const ligacoes = (Array.isArray(a.ligacoes) ? a.ligacoes : [])
    .map((l) => (l && typeof l === 'object' ? (l as Record<string, unknown>) : null))
    .filter((l): l is Record<string, unknown> => !!l && l.de != null && l.para != null)
    .map((l) => ({ de: l.de as string | number, para: l.para as string | number, texto: s(l.texto, 60) }))
  return {
    titulo: s(a.titulo, 120), subtitulo: s(a.subtitulo, 200), centro: s(a.centro, 120), fluxo: a.fluxo === true,
    notas: readItems(a.notas, 'nota'), cartoes: readItems(a.cartoes, 'cartao'), colunas, ligacoes,
  }
}

export const draftIsEmpty = (d: BoardDraft) => !d.titulo && !d.centro && !d.notas?.length && !d.cartoes?.length && !d.colunas?.length
