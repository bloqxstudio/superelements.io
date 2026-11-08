/**
 * O que está num quadro, em linhas curtas para a Iara: cada nota, cartão ou texto com o id (para editar e
 * ligar), a cor e o frame (coluna) em que está, e as setas entre eles. Funciona com a cena gravada ou com
 * os elementos do editor aberto.
 */
interface El {
  id: string
  type: string
  x?: number
  y?: number
  width?: number
  height?: number
  isDeleted?: boolean
  text?: string
  name?: string | null
  containerId?: string | null
  frameId?: string | null
  groupIds?: readonly string[]
  backgroundColor?: string
  customData?: { sticky?: boolean; card?: boolean; cardPart?: string }
  startBinding?: { elementId: string } | null
  endBinding?: { elementId: string } | null
}

const COLOR_NAME: Record<string, string> = {
  '#fff1a8': 'amarela', '#ffd8a8': 'laranja', '#ffc9de': 'rosa', '#e0d4ff': 'roxa', '#c5e4ff': 'azul', '#c8f0c4': 'verde', '#e8e8e6': 'cinza',
  '#d9a400': 'amarela', '#e8590c': 'laranja', '#d6336c': 'rosa', '#7048e8': 'roxa', '#1c7ed6': 'azul', '#2b8a3e': 'verde', '#5c5c58': 'cinza',
}
const clean = (s: string, n = 240) => s.replace(/\s+/g, ' ').trim().slice(0, n)
/** Onde o item está (canto de cima à esquerda) e o tamanho, para a Iara saber o que está ao lado do quê. */
const geo = (e: El) => (typeof e.x === 'number' && typeof e.width === 'number' ? ` @${Math.round(e.x)},${Math.round(e.y ?? 0)} ${Math.round(e.width)}x${Math.round(e.height ?? 0)}` : '')

export function boardOutline(elements: unknown[], only?: Set<string>): { count: number; lines: string[] } {
  const els = (elements as El[]).filter((e) => e && !e.isDeleted)
  const byId = new Map(els.map((e) => [e.id, e]))
  const textIn = (c: El) => els.find((t) => t.type === 'text' && t.containerId === c.id)?.text ?? ''
  const frameName = (e: El) => (e.frameId ? byId.get(e.frameId)?.name : undefined)
  const lines: string[] = []
  const label = new Map<string, string>()
  const inGroup = (e: El, g?: string) => !!g && !!e.groupIds?.includes(g)
  for (const e of els) {
    if (e.type === 'frame' && e.name && (!only || only.has(e.id))) lines.push(`[coluna/frame] ${e.name}${geo(e)}`)
    // cartão: um item só, com título, texto e etiqueta
    if (e.customData?.card) {
      const g = e.groupIds?.[0]
      const mates = els.filter((m) => inGroup(m, g))
      if (only && !mates.some((m) => only.has(m.id) || (m.containerId && only.has(m.containerId)))) continue
      const part = (n: string) => { const p = mates.find((m) => m.customData?.cardPart === n); return p ? clean(textIn(p), 200) : '' }
      const bar = mates.find((m) => m.customData?.cardPart === 'barra')
      const cor = COLOR_NAME[bar?.backgroundColor ?? ''] ?? ''
      const t = part('titulo'), body = part('texto'), tag = part('tag')
      label.set(e.id, t)
      const f = frameName(e)
      lines.push(`- #${e.id} (cartão ${cor}${f ? ` em "${f}"` : ''})${geo(e)} ${t}${body ? ` — ${body}` : ''}${tag ? ` [${tag}]` : ''}`)
      continue
    }
    if (e.type !== 'text' || !e.text?.trim()) continue
    const box = e.containerId ? byId.get(e.containerId) : undefined
    if (box?.customData?.cardPart || box?.type === 'arrow') continue
    if (only && !only.has(e.id) && !(box && only.has(box.id))) continue
    const item = box ?? e
    const f = frameName(item)
    const kind = box?.customData?.sticky ? `nota ${COLOR_NAME[box.backgroundColor ?? ''] ?? ''}`.trim() : box ? box.type : 'texto'
    label.set(item.id, clean(e.text, 40))
    lines.push(`- #${item.id} (${kind}${f ? ` em "${f}"` : ''})${geo(item)} ${clean(e.text)}`)
  }
  // notas sem texto também contam (dá para escrever nelas)
  for (const e of els) {
    if (!e.customData?.sticky || label.has(e.id) || (only && !only.has(e.id))) continue
    lines.push(`- #${e.id} (nota ${COLOR_NAME[e.backgroundColor ?? ''] ?? ''} vazia${frameName(e) ? ` em "${frameName(e)}"` : ''})${geo(e)}`)
  }
  const nameOf = (id: string) => {
    const el = byId.get(id)
    const g = el?.groupIds?.[0]
    const card = el?.customData?.card ? el : g ? els.find((m) => m.customData?.card && inGroup(m, g)) : undefined
    return label.get(card?.id ?? id) ?? `#${id}`
  }
  for (const a of els) {
    if (a.type !== 'arrow') continue
    if (only && !only.has(a.id)) continue
    const t = textIn(a)
    const from = a.startBinding && byId.has(a.startBinding.elementId) ? `"${nameOf(a.startBinding.elementId)}"` : 'nada (solta)'
    const to = a.endBinding && byId.has(a.endBinding.elementId) ? `"${nameOf(a.endBinding.elementId)}"` : 'nada (solta)'
    lines.push(`→ #${a.id} seta de ${from} para ${to}${t ? ` (rótulo: ${clean(t, 40)})` : ''}`)
  }

  return { count: els.length, lines }
}
