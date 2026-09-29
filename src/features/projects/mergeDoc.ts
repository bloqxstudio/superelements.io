import type { SpaceConnection, SpaceNode, SpacePage } from '@/types/space'
import { withoutAppOrigin } from './localAssets'
import type { ProjectDoc } from './types'

/**
 * Junta duas versões do projeto feitas a partir da mesma (`base`): a desta aba
 * (`mine`) e a que outra pessoa ou aba salvou antes (`theirs`). Cada peça
 * (seção, texto, paleta, conexão, página) fica com o lado que mexeu nela, e a
 * ordem das seções de uma página junta o que cada lado pôs e tirou. Se os dois
 * mexeram na mesma peça de jeitos diferentes, devolve null e a pessoa escolhe
 * a versão, como antes.
 *
 * Posição e altura de seção não contam como mudança: a coluna da página
 * recalcula. Imagens do app gravadas de outro endereço também não.
 */

const CLASH = Symbol('clash')
type Clash = typeof CLASH

/** Texto estável de um valor, com as chaves em ordem: o mesmo conteúdo dá o mesmo texto. */
const sign = (value: unknown): string =>
  withoutAppOrigin(
    JSON.stringify(value ?? null, (_key, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
        : v
    )
  )

const same = (a: unknown, b: unknown) => a === b || sign(a) === sign(b)

type Pick3<T> = (base: T, mine: T, theirs: T) => T | Clash

interface ByIdOptions<T> {
  /** O que conta como mudança na peça. */
  signOf?: (item: T) => string
  /** Nenhum lado mudou a peça (pelo `signOf`): qual fica. Sem ele, a de `theirs`. */
  unchanged?: Pick3<T>
  /** Os dois lados mudaram a peça: junta ou desiste. Sem ele, desiste. */
  resolve?: Pick3<T>
}

/** Onde entra o que só esta aba criou: logo depois do vizinho de cima dele aqui. */
function insertAfterNeighbor<T>(out: T[], mine: T[], index: number, item: T, key: (x: T) => string) {
  let at = 0
  for (let j = index - 1; j >= 0; j--) {
    const k = out.findIndex((o) => key(o) === key(mine[j]))
    if (k >= 0) {
      at = k + 1
      break
    }
  }
  out.splice(at, 0, item)
}

/** 3 vias por id; a ordem é a de `theirs`, com o que só esta aba criou no lugar dela. */
function mergeById<T extends { id: string }>(base: T[], mine: T[], theirs: T[], options: ByIdOptions<T> = {}): T[] | Clash {
  const { signOf = sign, unchanged, resolve } = options
  const byId = (list: T[]) => new Map(list.map((item) => [item.id, item]))
  const [b, m, t] = [byId(base), byId(mine), byId(theirs)]
  const picked = new Map<string, T | undefined>()

  for (const id of new Set([...b.keys(), ...m.keys(), ...t.keys()])) {
    const [bi, mi, ti] = [b.get(id), m.get(id), t.get(id)]
    const [sb, sm, st] = [bi && signOf(bi), mi && signOf(mi), ti && signOf(ti)]
    let result: T | undefined | Clash
    if (sm === sb && st === sb) result = unchanged && bi && mi && ti ? unchanged(bi, mi, ti) : ti
    // Só o outro lado mudou (ou apagou)
    else if (sm === sb) result = ti
    // Só esta aba mudou (ou apagou), ou as duas mudaram igual
    else if (st === sb || sm === st) result = mi
    else result = resolve && bi && mi && ti ? resolve(bi, mi, ti) : CLASH
    if (result === CLASH) return CLASH
    picked.set(id, result)
  }

  const out = theirs.map((item) => picked.get(item.id)).filter((item): item is T => !!item)
  mine.forEach((item, index) => {
    const chosen = picked.get(item.id)
    if (chosen && !t.has(item.id)) insertAfterNeighbor(out, mine, index, chosen, (x) => x.id)
  })
  return out
}

/** Ordem das seções de uma página que as duas versões mudaram: tira o que esta aba tirou e põe o que ela pôs. */
function mergeOrder(base: string[], mine: string[], theirs: string[]) {
  if (same(mine, base)) return theirs
  if (same(theirs, base)) return mine
  const [inBase, inMine] = [new Set(base), new Set(mine)]
  const out = theirs.filter((id) => !(inBase.has(id) && !inMine.has(id)))
  mine.forEach((id, index) => {
    if (!inBase.has(id) && !out.includes(id)) insertAfterNeighbor(out, mine, index, id, (x) => x)
  })
  return out
}

/** Página mudada dos dois lados: campo por campo, e a ordem das seções junta. */
const mergePage: Pick3<SpacePage> = (base, mine, theirs) => {
  const keys = new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)] as Array<keyof SpacePage>)
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key === 'sectionIds') continue
    const [b, m, t] = [base[key], mine[key], theirs[key]]
    if (same(m, b)) out[key] = t
    else if (same(t, b) || same(m, t)) out[key] = m
    else return CLASH
  }
  out.sectionIds = mergeOrder(base.sectionIds, mine.sectionIds, theirs.sectionIds)
  return out as unknown as SpacePage
}

const nodeSign = ({ x: _x, y: _y, height: _height, ...rest }: SpaceNode) => sign(rest)

/** Ninguém mudou o conteúdo: fica a posição de quem arrastou (texto e paleta soltos). */
const pickNode: Pick3<SpaceNode> = (base, mine, theirs) => (mine.x !== base.x || mine.y !== base.y ? mine : theirs)

/** Um valor inteiro (marca, kit do site): fica o lado que mudou; os dois mudaram diferente, desiste. */
function mergeWhole<T>(base: T, mine: T, theirs: T): T | Clash {
  if (same(mine, base)) return theirs
  if (same(theirs, base) || same(theirs, mine)) return mine
  return CLASH
}

export function mergeDocs(base: ProjectDoc, mine: ProjectDoc, theirs: ProjectDoc): ProjectDoc | null {
  const nodes = mergeById<SpaceNode>(base.canvas.nodes, mine.canvas.nodes, theirs.canvas.nodes, { signOf: nodeSign, unchanged: pickNode })
  if (nodes === CLASH) return null
  const pages = mergeById<SpacePage>(base.canvas.pages ?? [], mine.canvas.pages ?? [], theirs.canvas.pages ?? [], { resolve: mergePage })
  if (pages === CLASH) return null
  const connections = mergeById<SpaceConnection>(base.canvas.connections, mine.canvas.connections, theirs.canvas.connections)
  if (connections === CLASH) return null

  const brandOf = (doc: ProjectDoc) => ({ source: doc.brand.source, enabled: doc.brand.enabled })
  const brand = mergeWhole(brandOf(base), brandOf(mine), brandOf(theirs))
  if (brand === CLASH) return null
  const site = mergeWhole(base.site ?? null, mine.site ?? null, theirs.site ?? null)
  if (site === CLASH) return null

  const ids = new Set(nodes.map((n) => n.id))
  return {
    canvas: {
      nodes,
      pages,
      // Conexão para uma peça que o outro lado apagou sai junto
      connections: connections.filter((c) => ids.has(c.sourceId) && ids.has(c.targetId)),
      canvasTransform: mine.canvas.canvasTransform,
    },
    brand: { ...brand, logoRatios: { ...theirs.brand.logoRatios, ...mine.brand.logoRatios } },
    site,
  }
}
