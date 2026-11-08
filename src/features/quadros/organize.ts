import { arrowRoute } from './layout.ts'

/**
 * Arruma um quadro que já existe (2026-11-07, o pedido que veio pela Iara: "notas sobrepostas… quer os
 * posts separados e legíveis"). Sem imports do Excalidraw: recebe os elementos da cena e devolve o que
 * muda em cada um (posição, tamanho, pontos das setas). Passos:
 * 1. cada nota fica do tamanho do texto dela; num cartão, título, texto e etiqueta se empilham de novo;
 * 2. dentro de cada coluna (frame) os itens se empilham pela altura real (duas trilhas com mais de 6) e
 *    o frame cresce até caber tudo;
 * 3. os frames de uma mesma linha ficam lado a lado sem encostar, e as linhas uma embaixo da outra;
 * 4. o que está solto e encosta em algo desce até ficar livre;
 * 5. as setas ligadas são refeitas de borda a borda.
 */

export interface OrgEl {
  id: string
  type: string
  name?: string | null
  x: number
  y: number
  width: number
  height: number
  isDeleted?: boolean
  groupIds?: readonly string[]
  frameId?: string | null
  containerId?: string | null
  boundElements?: readonly { id: string; type: string }[] | null
  customData?: Record<string, unknown>
  verticalAlign?: string
  strokeColor?: string
  startBinding?: { elementId: string } | null
  endBinding?: { elementId: string } | null
}

type Box = { x: number; y: number; width: number; height: number }
const ARROW_COLOR = '#8a8983'
const hits = (a: Box, b: Box, gap: number) => a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap

export function organize(input: OrgEl[], opts: { espaco?: number; linhas?: boolean } = {}): Map<string, Record<string, unknown>> {
  const GAP = Math.max(8, Math.min(120, opts.espaco ?? 24))
  const all = input.filter((e) => !e.isDeleted)
  const ids = new Set(all.map((e) => e.id))
  // 0. lixo das ligações: seta presa a algo que não existe mais e rótulo de seta que já foi apagada
  const dead = new Set<string>()
  for (const a of all) if (a.type === 'arrow' && [a.startBinding?.elementId, a.endBinding?.elementId].some((id) => id && !ids.has(id))) dead.add(a.id)
  // Só some o texto que era rótulo de uma seta apagada. Texto preso a outra coisa que não existe mais continua
  // visível (o Excalidraw desenha), e pode ser um título: fica, solto (2026-11-07: dois títulos de seção da
  // Vizor estavam assim e foram apagados por engano; voltaram).
  const arrowIds = new Set(input.filter((e) => e.type === 'arrow').map((e) => e.id))
  const unbind = new Set<string>()
  for (const t of all) {
    if (t.type !== 'text' || !t.containerId) continue
    if (dead.has(t.containerId) || (!ids.has(t.containerId) && arrowIds.has(t.containerId))) dead.add(t.id)
    else if (!ids.has(t.containerId)) unbind.add(t.id)
  }
  const live = all.filter((e) => !dead.has(e.id))
  const cur = new Map(live.map((e) => [e.id, { x: e.x, y: e.y, width: e.width, height: e.height }]))
  const byId = new Map(live.map((e) => [e.id, e]))
  const textOf = (c: OrgEl) => live.find((t) => t.type === 'text' && t.containerId === c.id)
  const move = (id: string, dx: number, dy: number) => { const b = cur.get(id)!; b.x += dx; b.y += dy }

  // 1. caixas do tamanho do texto
  for (const c of live) {
    if (c.type === 'text' || c.type === 'arrow' || c.type === 'line' || c.type === 'frame') continue
    const t = textOf(c)
    if (!t) continue
    const sticky = !!c.customData?.sticky
    const need = t.height + (sticky && t.verticalAlign === 'top' ? 26 : 10)
    const b = cur.get(c.id)!
    if (need > b.height) {
      b.height = need
      const tb = cur.get(t.id)!
      tb.y = t.verticalAlign === 'middle' ? b.y + (b.height - t.height) / 2 : b.y + 5
    }
  }
  // cartões: título, texto e etiqueta empilhados de novo; o fundo e a barra acompanham
  for (const card of live.filter((e) => e.customData?.card)) {
    const g = card.groupIds?.[0]
    if (!g) continue
    const mates = live.filter((e) => e.groupIds?.includes(g) && e.id !== card.id)
    const order = ['titulo', 'texto', 'tag']
    const parts = mates.filter((e) => order.includes(String(e.customData?.cardPart))).sort((a, b) => order.indexOf(String(a.customData?.cardPart)) - order.indexOf(String(b.customData?.cardPart)))
    if (!parts.length) continue
    let y = cur.get(card.id)!.y + 12
    for (const p of parts) {
      const pb = cur.get(p.id)!
      const dy = y + (p.customData?.cardPart === 'tag' ? 4 : 0) - pb.y
      move(p.id, 0, dy)
      const t = textOf(p)
      if (t) move(t.id, 0, dy)
      if (p.customData?.cardPart === 'titulo') {
        for (const img of mates.filter((m) => m.type === 'image')) cur.get(img.id)!.y = pb.y + (pb.height - cur.get(img.id)!.height) / 2
      }
      y = pb.y + pb.height + (p.customData?.cardPart === 'tag' ? 8 : 4)
    }
    const cb = cur.get(card.id)!
    cb.height = Math.max(cb.height, y - cb.y + 12)
    const bar = mates.find((m) => m.customData?.cardPart === 'barra')
    if (bar) cur.get(bar.id)!.height = Math.max(8, cb.height - 28)
  }

  // unidades que se movem juntas: um grupo, ou um elemento com o texto dentro dele
  const units: { ids: string[]; frameId?: string | null; order: number }[] = []
  const seen = new Set<string>()
  live.forEach((e, i) => {
    if (seen.has(e.id) || e.type === 'frame' || e.type === 'arrow' || e.containerId) return
    const g = e.groupIds?.[0]
    const members = g ? live.filter((m) => m.groupIds?.includes(g)) : [e]
    const ids = new Set<string>()
    for (const m of members) {
      ids.add(m.id)
      for (const t of live) if (t.containerId === m.id && t.type === 'text') ids.add(t.id)
    }
    // setas dentro de um grupo não contam como peça
    for (const id of ids) seen.add(id)
    const list = [...ids].filter((id) => byId.get(id)?.type !== 'arrow')
    if (!list.length) return
    const frameId = members.map((m) => m.frameId).find(Boolean) ?? null
    units.push({ ids: list, frameId, order: i })
  })
  const boxOf = (u: { ids: string[] }): Box => {
    const bs = u.ids.map((id) => cur.get(id)!)
    const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y))
    return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y }
  }
  const shift = (u: { ids: string[] }, dx: number, dy: number) => { for (const id of u.ids) move(id, dx, dy) }

  // 2. dentro de cada frame
  const frames = live.filter((e) => e.type === 'frame')
  for (const f of frames) {
    const inside = units.filter((u) => u.frameId === f.id)
    if (!inside.length) continue
    const sorted = inside.map((u) => ({ u, b: boxOf(u) })).sort((a, b) => a.b.y - b.b.y || a.b.x - b.b.x)
    const w = Math.max(...sorted.map((s) => s.b.width))
    const fb = cur.get(f.id)!
    // mantém o arranjo da pessoa: quantas trilhas cabiam na largura que o frame tinha
    const fit = Math.max(1, Math.floor((f.width - 20 + GAP) / (w + GAP)))
    const tracks = Math.min(sorted.length, Math.max(fit, sorted.length > 6 ? 2 : 1))
    const heights = new Array(tracks).fill(fb.y + 30)
    for (const { u, b } of sorted) {
      const t = heights.indexOf(Math.min(...heights))
      shift(u, fb.x + 20 + t * (w + GAP) - b.x, heights[t] - b.y)
      heights[t] += b.height + GAP
    }
    fb.width = Math.max(tracks * w + (tracks - 1) * GAP + 40, (f.name?.length ?? 0) * 12 + 24)
    fb.height = Math.max(200, Math.max(...heights) - GAP - fb.y + 24)
  }

  // 3. frames: os que começam perto da mesma altura formam uma linha, lado a lado
  const unitsOf = (fid: string) => units.filter((u) => u.frameId === fid)
  const moveFrame = (fid: string, dx: number, dy: number) => { move(fid, dx, dy); for (const u of unitsOf(fid)) shift(u, dx, dy) }
  const rows: OrgEl[][] = []
  for (const f of [...frames].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0].y - f.y) < 200)
    if (row) row.push(f)
    else rows.push([f])
  }
  let floor = -Infinity
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x)
    const top = Math.max(Math.min(...row.map((f) => cur.get(f.id)!.y)), floor)
    let x = Math.min(...row.map((f) => cur.get(f.id)!.x))
    for (const f of row) {
      const b = cur.get(f.id)!
      moveFrame(f.id, x - b.x, top - b.y)
      x += b.width + Math.max(GAP, 48)
    }
    floor = Math.max(...row.map((f) => cur.get(f.id)!.y + cur.get(f.id)!.height)) + 80
  }

  // 3b. linhas de cartões soltos (os de um fluxo): o meio de todos na mesma altura, para a seta sair reta, e
  // entre dois ligados a distância certa (90 px, ou o rótulo da seta com folga), sem espalhar o que é compacto
  const arrows = live.filter((e) => e.type === 'arrow' && e.startBinding && e.endBinding)
  const labelOf = (a: OrgEl) => live.find((t) => t.type === 'text' && t.containerId === a.id)
  if (opts.linhas !== false) {
    const loose = units.filter((u) => !u.frameId && u.ids.some((id) => arrows.some((a) => a.startBinding!.elementId === id || a.endBinding!.elementId === id)))
    const lines: { units: typeof loose; top: number; bottom: number }[] = []
    for (const u of [...loose].sort((a, b) => boxOf(a).y - boxOf(b).y)) {
      const b = boxOf(u)
      const line = lines.find((l) => Math.min(l.bottom, b.y + b.height) - Math.max(l.top, b.y) > Math.min(b.height, l.bottom - l.top) * 0.4)
      if (line) { line.units.push(u); line.top = Math.min(line.top, b.y); line.bottom = Math.max(line.bottom, b.y + b.height) }
      else lines.push({ units: [u], top: b.y, bottom: b.y + b.height })
    }
    for (const line of lines.filter((l) => l.units.length > 1)) {
      const sorted = line.units.map((u) => ({ u, b: boxOf(u) })).sort((a, b) => a.b.x - b.b.x)
      const centers = sorted.map((s) => s.b.y + s.b.height / 2).sort((a, b) => a - b)
      const mid = centers[Math.floor(centers.length / 2)]
      let right = -Infinity
      sorted.forEach(({ u, b }, i) => {
        let dx = 0
        if (i > 0) {
          const prev = sorted[i - 1].u
          const link = arrows.find((a) => (prev.ids.includes(a.startBinding!.elementId) && u.ids.includes(a.endBinding!.elementId)) || (u.ids.includes(a.startBinding!.elementId) && prev.ids.includes(a.endBinding!.elementId)))
          const label = link ? labelOf(link) : undefined
          const want = link ? Math.max(90, label ? label.width + 56 : 0) : Math.max(GAP, b.x - right)
          dx = right + want - b.x
        }
        shift(u, dx, mid - (b.y + b.height / 2))
        right = b.x + dx + b.width
      })
    }
  }

  // 4. o que está solto desce até não encostar em nada
  const placed: Box[] = frames.map((f) => ({ ...cur.get(f.id)! }))
  for (const u of units.filter((x) => !x.frameId).sort((a, b) => boxOf(a).y - boxOf(b).y || boxOf(a).x - boxOf(b).x)) {
    let b = boxOf(u)
    for (let guard = 0; guard < 200; guard++) {
      const hit = placed.find((p) => hits(b, p, GAP / 2))
      if (!hit) break
      shift(u, 0, hit.y + hit.height + GAP - b.y)
      b = boxOf(u)
    }
    placed.push(b)
  }

  // 5. setas ligadas: retas quando os dois lados estão alinhados, de borda a borda; o rótulo vai junto, no meio
  for (const a of arrows) {
    const s = cur.get(a.startBinding!.elementId), t = cur.get(a.endBinding!.elementId)
    if (!s || !t) continue
    const { start: p, points } = arrowRoute(s, t)
    const b = cur.get(a.id)!
    Object.assign(b, { x: p.x, y: p.y, width: Math.max(...points.map((pt) => Math.abs(pt[0]))), height: Math.max(...points.map((pt) => Math.abs(pt[1]))), points })
    const label = labelOf(a)
    // o rótulo fica no meio do trecho do meio (na reta, o meio da seta)
    const [m0, m1] = points.length > 2 ? [points[1], points[2]] : [points[0], points[1]]
    if (label) { const lb = cur.get(label.id)!; lb.x = p.x + (m0[0] + m1[0]) / 2 - label.width / 2; lb.y = p.y + (m0[1] + m1[1]) / 2 - label.height / 2 }
  }

  const out = new Map<string, Record<string, unknown>>()
  for (const id of dead) out.set(id, { isDeleted: true })
  for (const id of unbind) out.set(id, { containerId: null })
  for (const e of live) {
    const b = cur.get(e.id)! as Box & { points?: number[][] }
    const p: Record<string, unknown> = {}
    if (Math.abs(b.x - e.x) > 0.5) p.x = b.x
    if (Math.abs(b.y - e.y) > 0.5) p.y = b.y
    if (Math.abs(b.width - e.width) > 0.5) p.width = b.width
    if (Math.abs(b.height - e.height) > 0.5) p.height = b.height
    if (b.points) { p.points = b.points; p.width = Math.abs(b.width); p.height = Math.abs(b.height) }
    // As setas que a Iara desenhou antes puxavam a cor do cartão de origem: ficam todas na mesma cor
    if (e.type === 'arrow' && e.id.startsWith('ia') && e.strokeColor && e.strokeColor !== ARROW_COLOR) p.strokeColor = ARROW_COLOR
    if (Object.keys(p).length) out.set(e.id, { ...out.get(e.id), ...p })
  }
  return out
}
