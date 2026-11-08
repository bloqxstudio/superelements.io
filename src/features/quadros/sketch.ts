/**
 * Desenho livre da Iara no quadro (2026-11-07, sugestão da Vizor: "use o lápis e faça uma ilustração do nosso
 * funil"). O que a Iara manda vira traços de lápis (o `freedraw` do Excalidraw, com um tremor leve de mão),
 * formas e linhas em estilo esboço e textos com a letra de mão. Sem imports: roda no navegador e nos testes.
 *
 * As coordenadas são da própria ilustração (0,0 = canto de cima à esquerda dela); o quadro põe a ilustração
 * embaixo do que já existe, ou onde a Iara disser com `absoluto`.
 */

import { DOODLE_NAMES, SCENES, doodle, type Mood, type Placed } from './doodles.ts'

export type Pt = [number, number]
/** `grupo`: traços do mesmo desenho (um boneco, uma mesa) andam juntos no quadro e são feitos pelo mesmo agente. */
export type SketchItem =
  | { tipo: 'traco'; pontos: Pt[]; fechado?: boolean; cor?: string; espessura?: number; tremor?: number; grupo?: string }
  | { tipo: 'linha'; pontos: Pt[]; seta?: boolean; cor?: string; preenchimento?: string; grupo?: string }
  | { tipo: 'forma'; forma: 'retangulo' | 'elipse' | 'losango'; x: number; y: number; largura: number; altura: number; cor?: string; preenchimento?: string; texto?: string; solido?: boolean; grupo?: string }
  | { tipo: 'texto'; x: number; y: number; texto: string; tamanho?: number; cor?: string; centro?: boolean; grupo?: string }

/** Ruído suave e repetível (a mesma ilustração sai igual com a mesma semente). */
const wobble = (seed: number) => (t: number) => Math.sin(t * 0.045 + seed) * 0.9 + Math.sin(t * 0.13 + seed * 1.7) * 0.5

/**
 * Um traço de lápis pelos pontos dados: reamostrado a cada ~6 px e com um tremor de ~1,5 px na perpendicular,
 * como mão; `fechado` volta ao começo passando um pouco do ponto inicial (o jeito de quem fecha à mão).
 */
export function pencil(points: Pt[], closed = false, seed = 1, amp = 1.5): Pt[] {
  const path = closed && points.length > 2 ? [...points, points[0]] : points
  if (path.length < 2) return path.map((p) => [p[0], p[1]] as Pt)
  const n = wobble(seed)
  const out: Pt[] = []
  let walked = 0
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1]
    const len = Math.hypot(bx - ax, by - ay)
    const steps = Math.max(1, Math.round(len / (amp < 1 ? 4 : 6)))
    const nx = len ? -(by - ay) / len : 0, ny = len ? (bx - ax) / len : 0
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
      const t = k / steps
      const d = n(walked + t * len) * amp
      out.push([ax + (bx - ax) * t + nx * d, ay + (by - ay) * t + ny * d])
    }
    walked += len
  }
  if (closed && path.length > 3) {
    // passa um pouco do começo, como quem fecha a forma à mão
    const [ax, ay] = path[0], [bx, by] = path[1]
    out.push([ax + (bx - ax) * 0.06, ay + (by - ay) * 0.06])
  }
  return out
}

export interface FunnelOpts { etapas: string[]; titulo?: string; largura?: number; alturaEtapa?: number; cores?: string[] }

const FUNNEL_COLORS = ['#7048e8', '#1c7ed6', '#0ca678', '#d9a400', '#e8590c', '#d6336c', '#5c5c58']
const FILLS: Record<string, string> = { '#7048e8': '#e0d4ff', '#1c7ed6': '#c5e4ff', '#0ca678': '#c8f0c4', '#d9a400': '#fff1a8', '#e8590c': '#ffd8a8', '#d6336c': '#ffc9de', '#5c5c58': '#e8e8e6' }

/**
 * Um funil desenhado a lápis: uma faixa por etapa, de cima (larga) para baixo (estreita), cada uma com o
 * contorno a lápis, um fundo hachurado claro e o nome no meio; o título em cima. A faixa mais estreita
 * ainda cabe o texto (no mínimo 34% da largura).
 */
export function funnel(o: FunnelOpts): SketchItem[] {
  const W = Math.max(360, Math.min(1400, o.largura ?? 760))
  const H = Math.max(56, Math.min(160, o.alturaEtapa ?? 84))
  const steps = o.etapas.slice(0, 12)
  const n = steps.length
  const items: SketchItem[] = []
  let top = 0
  if (o.titulo) { items.push({ tipo: 'texto', x: W / 2, y: 0, texto: o.titulo, tamanho: 32, centro: true }); top = 64 }
  const widthAt = (i: number) => W - (W - Math.max(W * 0.34, 260)) * (i / Math.max(1, n))
  steps.forEach((name, i) => {
    const wt = widthAt(i), wb = widthAt(i + 1)
    const y0 = top + i * (H + 10), y1 = y0 + H
    const pts: Pt[] = [[(W - wt) / 2, y0], [(W + wt) / 2, y0], [(W + wb) / 2, y1], [(W - wb) / 2, y1]]
    const color = o.cores?.[i] ?? FUNNEL_COLORS[i % FUNNEL_COLORS.length]
    items.push({ tipo: 'linha', pontos: [...pts, pts[0]], cor: 'transparent', preenchimento: FILLS[color] ?? '#e8e8e6' })
    items.push({ tipo: 'traco', pontos: pts, fechado: true, cor: color, espessura: 1 })
    // o mesmo tamanho em todas as faixas; só diminui quando o nome não cabe na faixa
    const label = `${i + 1}. ${name}`
    const size = Math.max(14, Math.min(22, Math.floor((wb * 0.82) / (label.length * 0.56))))
    items.push({ tipo: 'texto', x: W / 2, y: y0 + H / 2 - size * 0.62, texto: label, tamanho: size, centro: true })
  })
  return items
}

let gid = 0
const group = () => `d${Date.now().toString(36)}${(gid++).toString(36)}`

/** Um desenho da biblioteca posto em (x, y) na escala dada, como traços de lápis de um grupo só. */
export function placeDoodle(name: string, x: number, y: number, o: { escala?: number; largura?: number; cor?: string; espelhar?: boolean; humor?: Mood } = {}): SketchItem[] {
  const d = doodle(name, { humor: o.humor })
  if (!d) return []
  const k = o.largura ? o.largura / d.w : Math.max(0.2, Math.min(6, o.escala ?? 1))
  const g = group()
  return d.strokes.map((st) => ({
    tipo: 'traco' as const, grupo: g, fechado: st.fechado, cor: o.cor, espessura: st.peso ?? 1, tremor: Math.min(1.2, 0.55 * k),
    pontos: st.pontos.map(([px, py]) => [x + (o.espelhar ? d.w - px : px) * k, y + py * k] as Pt),
  }))
}

/** Uma cena pronta (reunião, live, apresentação, atendimento) posta em (x, y), cabendo na largura dada. */
export function placeScene(name: string, x: number, y: number, o: { escala?: number; largura?: number; cor?: string } = {}): SketchItem[] {
  const sc = SCENES[name]
  if (!sc) return []
  const k = o.largura ? o.largura / sc.w : Math.max(0.2, Math.min(4, o.escala ?? 1))
  return sc.parts.flatMap((p: Placed) => placeDoodle(p.nome, x + p.x * k, y + p.y * k, { escala: (p.escala ?? 1) * k, espelhar: p.espelhar, humor: p.humor, cor: o.cor }))
}
export const sceneSize = (name: string) => SCENES[name] && { w: SCENES[name].w, h: SCENES[name].h }

/** Quebra o texto em linhas de até `chars` caracteres, sem cortar palavras. */
export function wrap(text: string, chars: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + w).length > chars) { out.push(line); line = w } else line = line ? `${line} ${w}` : w
  }
  if (line) out.push(line)
  return out
}

/** Lista com travessão, em letra de mão: cada item quebra na largura e as linhas seguintes ficam alinhadas. */
export function list(itens: string[], x: number, y: number, o: { largura?: number; tamanho?: number; cor?: string } = {}): { items: SketchItem[]; bottom: number } {
  const size = Math.max(14, Math.min(40, o.tamanho ?? 22))
  const chars = Math.max(12, Math.floor((o.largura ?? 400) / (size * 0.5)))
  const lh = Math.round(size * 1.45)
  const out: SketchItem[] = []
  let top = y
  for (const it of itens.slice(0, 12)) {
    const lines = wrap(it, chars - 2)
    out.push({ tipo: 'texto', x, y: top, texto: `– ${lines.join('\n  ')}`, tamanho: size, cor: o.cor })
    top += lines.length * lh + size * 0.35
  }
  return { items: out, bottom: top }
}

export interface Side { titulo?: string; marca?: 'x' | 'certo' | 'nenhuma'; cena?: string; desenhos?: { nome: string; x: number; y: number; escala?: number; espelhar?: boolean; humor?: Mood }[]; itens?: string[] }

/**
 * O comparativo da referência do usuário: fundo escuro (ou claro), uma divisória a lápis no meio, e em cada lado
 * o ✗ ou ✓ grande, o título, a cena desenhada e a lista. Tudo centrado na coluna, com folga para ler de longe.
 */
export function comparison(esq: Side, dir: Side, o: { fundo?: 'escuro' | 'claro'; largura?: number } = {}): SketchItem[] {
  const dark = o.fundo !== 'claro'
  const ink = dark ? '#f2f2ee' : '#1e1e1e'
  const W = Math.max(720, Math.min(1600, o.largura ?? 1040))
  const colW = W / 2
  const pad = 56
  const parts: SketchItem[] = []
  let bottom = 0
  // Duas passadas: a cena de cada lado e depois as listas, as duas começando na mesma altura (lado a lado se lê)
  const heads = (sd: Side) => (sd.marca !== 'nenhuma' ? 100 : 0) + (sd.titulo ? 64 : 0)
  const headH = Math.max(heads(esq), heads(dir))
  const maxW = colW - pad * 2, maxH = 190
  const artH = (sd: Side) => {
    if (sd.cena && SCENES[sd.cena]) { const sz = SCENES[sd.cena]; return sz.h * Math.min(maxW / sz.w, maxH / sz.h, 1.25) }
    if (sd.desenhos?.length) return Math.max(...sd.desenhos.map((d) => d.y + (doodle(d.nome)?.h ?? 0) * (d.escala ?? 1)))
    return 0
  }
  const art = Math.max(artH(esq), artH(dir))
  const side = (sd: Side, x0: number) => {
    const cx = x0 + colW / 2
    let y = 44
    if (sd.marca !== 'nenhuma') {
      const mark = sd.marca === 'certo' ? 'certo' : 'x'
      const color = mark === 'certo' ? (dark ? '#ff6b57' : '#e8590c') : (dark ? '#8f8f8a' : '#868e96')
      parts.push(...placeDoodle(mark, cx - 34, y, { escala: 0.85, cor: color }))
      y += 100
    }
    if (sd.titulo) { parts.push({ tipo: 'texto', x: cx, y, texto: sd.titulo, tamanho: 32, cor: ink, centro: true }) }
    y = 44 + headH
    if (sd.cena && SCENES[sd.cena]) {
      const sz = SCENES[sd.cena]
      const k = Math.min(maxW / sz.w, maxH / sz.h, 1.25)
      // a cena fica centrada na coluna e embaixo, alinhada com a do outro lado
      parts.push(...placeScene(sd.cena, cx - (sz.w * k) / 2, y + (art - sz.h * k), { escala: k, cor: ink }))
    } else if (sd.desenhos?.length) {
      for (const d of sd.desenhos) parts.push(...placeDoodle(d.nome, x0 + pad + d.x, y + d.y, { escala: d.escala, espelhar: d.espelhar, humor: d.humor, cor: ink }))
    }
    y += art + (art ? 44 : 0)
    if (sd.itens?.length) { const l = list(sd.itens, x0 + pad + 10, y, { largura: maxW - 10, tamanho: 24, cor: ink }); parts.push(...l.items); y = l.bottom }
    bottom = Math.max(bottom, y)
  }
  side(esq, 0)
  side(dir, colW)
  const H = bottom + 50
  return [
    { tipo: 'forma', forma: 'retangulo', x: 0, y: 0, largura: W, altura: H, cor: dark ? '#2b2b2b' : '#d0cec7', preenchimento: dark ? '#1c1c1c' : '#fbfaf7', solido: true },
    { tipo: 'traco', pontos: [[colW, 28], [colW + 2, H / 2], [colW - 1, H - 28]], cor: ink, espessura: 1, tremor: 1.2 },
    ...parts,
  ]
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const pts = (v: unknown): Pt[] =>
  (Array.isArray(v) ? v : []).slice(0, 400).flatMap((p): Pt[] => (Array.isArray(p) && p.length >= 2 && p.every((x) => typeof x === 'number' && Number.isFinite(x)) ? [[p[0], p[1]]] : []))
const mood = (v: unknown): Mood | undefined => (v === 'feliz' || v === 'triste' || v === 'neutro' || v === 'cansado' || v === 'falando' ? v : undefined)
export { DOODLE_NAMES }
export const SCENE_NAMES = Object.keys(SCENES)
const color = (v: unknown) => (typeof v === 'string' && (/^#[0-9a-f]{6}$/i.test(v.trim()) || v === 'transparent') ? v.trim() : undefined)

/** O pedido da Iara como itens (o atalho "funil" vira os itens dele). */
export function readSketch(raw: unknown): SketchItem[] {
  const out: SketchItem[] = []
  for (const r of (Array.isArray(raw) ? raw : []).slice(0, 120)) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const cor = color(o.cor), preenchimento = color(o.preenchimento)
    if (o.tipo === 'funil' && Array.isArray(o.etapas)) {
      const f = funnel({ etapas: o.etapas.map(String).filter(Boolean), titulo: typeof o.titulo === 'string' ? o.titulo : undefined, largura: num(o.largura, 760), alturaEtapa: num(o.altura_etapa, 84) })
      const dx = num(o.x), dy = num(o.y)
      out.push(...f.map((it) => shift(it, dx, dy)))
    } else if (o.tipo === 'traco') { const p = pts(o.pontos); if (p.length > 1) out.push({ tipo: 'traco', pontos: p, fechado: o.fechado === true, cor, espessura: num(o.espessura, 2) }) }
    else if (o.tipo === 'linha') { const p = pts(o.pontos); if (p.length > 1) out.push({ tipo: 'linha', pontos: p, seta: o.seta === true, cor, preenchimento }) }
    else if (o.tipo === 'desenho' && typeof o.nome === 'string') out.push(...placeDoodle(o.nome, num(o.x), num(o.y), { escala: num(o.escala, 1), largura: num(o.largura) || undefined, cor, espelhar: o.espelhar === true, humor: mood(o.humor) }))
    else if (o.tipo === 'cena' && typeof o.nome === 'string') out.push(...placeScene(o.nome, num(o.x), num(o.y), { escala: num(o.escala, 1), largura: num(o.largura) || undefined, cor }))
    else if (o.tipo === 'lista' && Array.isArray(o.itens)) out.push(...list(o.itens.map(String).filter(Boolean), num(o.x), num(o.y), { largura: num(o.largura, 400), tamanho: num(o.tamanho, 22), cor }).items)
    else if (o.tipo === 'comparacao') {
      const sideOf = (v: unknown): Side => {
        const x = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
        return {
          titulo: typeof x.titulo === 'string' ? x.titulo.slice(0, 60) : undefined,
          marca: x.marca === 'certo' || x.marca === 'nenhuma' ? x.marca : x.marca === 'x' ? 'x' : undefined,
          cena: typeof x.cena === 'string' ? x.cena : undefined,
          desenhos: Array.isArray(x.desenhos) ? (x.desenhos as Record<string, unknown>[]).filter((d) => typeof d?.nome === 'string').slice(0, 12).map((d) => ({ nome: String(d.nome), x: num(d.x), y: num(d.y), escala: num(d.escala, 1), espelhar: d.espelhar === true, humor: mood(d.humor) })) : undefined,
          itens: Array.isArray(x.itens) ? x.itens.map(String).filter(Boolean).slice(0, 8) : undefined,
        }
      }
      const c = comparison(sideOf(o.esquerda), sideOf(o.direita), { fundo: o.fundo === 'claro' ? 'claro' : 'escuro', largura: num(o.largura, 1040) })
      out.push(...c.map((it) => shift(it, num(o.x), num(o.y))))
    }
    else if (o.tipo === 'forma') {
      const forma = o.forma === 'elipse' || o.forma === 'losango' ? o.forma : 'retangulo'
      out.push({ tipo: 'forma', forma, x: num(o.x), y: num(o.y), largura: Math.max(10, num(o.largura, 160)), altura: Math.max(10, num(o.altura, 90)), cor, preenchimento, texto: typeof o.texto === 'string' ? o.texto.slice(0, 300) : undefined })
    } else if (o.tipo === 'texto' && typeof o.texto === 'string' && o.texto.trim()) out.push({ tipo: 'texto', x: num(o.x), y: num(o.y), texto: o.texto.slice(0, 400), tamanho: num(o.tamanho, 20), cor, centro: o.centro === true })
  }
  return out
}

function shift(it: SketchItem, dx: number, dy: number): SketchItem {
  if (!dx && !dy) return it
  if (it.tipo === 'traco' || it.tipo === 'linha') return { ...it, pontos: it.pontos.map(([x, y]) => [x + dx, y + dy] as Pt) }
  return { ...it, x: it.x + dx, y: it.y + dy }
}
