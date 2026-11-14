import type { SiteSeo, SpaceComponent, SpaceConnection, SpaceNode, SpacePage } from '@/types/space'

/**
 * Desfazer com outra pessoa (ou aba) editando o mesmo projeto (revisão de 2026-11-13).
 *
 * Antes, cada salvamento de fora zerava o desfazer: com duas pessoas, o Ctrl+Z
 * parava de funcionar a cada ~1,5 s. Agora o histórico local continua, e cada
 * passo guarda a "época" de quando foi tirado. A sincronização sobe a época e
 * marca o que a outra pessoa mexeu (nó, página, conexão, componente, SEO),
 * criou ou apagou. Ao desfazer/refazer, o passo é aplicado só ao que não foi
 * mexido de fora depois dele; o que foi mexido de fora fica como está agora:
 *
 * - criado de fora depois do passo: continua (o desfazer não apaga);
 * - apagado de fora depois do passo: não volta;
 * - mudado de fora depois do passo: fica a versão de fora (ela vence o conflito).
 *
 * Nada da outra pessoa se perde; o custo é que desfazer a própria mudança numa
 * peça que a outra pessoa mexeu depois não faz nada nessa peça. As páginas
 * ainda passam por uma limpeza (seção em uma página só, sem id que não existe),
 * e as conexões sem as duas pontas saem.
 */

export interface HistoryEntities {
  nodes: SpaceNode[]
  pages: SpacePage[]
  connections: SpaceConnection[]
  components: SpaceComponent[]
  siteSeo?: SiteSeo
}

type Kind = 'node' | 'page' | 'connection' | 'component'
const LISTS: Array<[Kind, 'nodes' | 'pages' | 'connections' | 'components']> = [
  ['node', 'nodes'],
  ['page', 'pages'],
  ['connection', 'connections'],
  ['component', 'components'],
]
const SEO_KEY = 'seo'

/** Chave de uma peça no mapa do que foi mexido de fora. */
const keyOf = (kind: Kind, id: string) => `${kind}:${id}`

const json = (value: unknown) => JSON.stringify(value ?? null)

/** O que importa do nó para saber se mudou: a posição só vale para o que não está numa página (a coluna é derivada). */
const nodeShape = (node: SpaceNode, placed: Set<string>) =>
  json(placed.has(node.id) ? [node.type, node.data] : [node.type, node.data, node.x, node.y])

function shapes(entities: HistoryEntities) {
  const placed = new Set(entities.pages.flatMap((p) => p.sectionIds))
  const out = new Map<string, string>()
  for (const n of entities.nodes) out.set(keyOf('node', n.id), nodeShape(n, placed))
  for (const p of entities.pages) out.set(keyOf('page', p.id), json(p))
  for (const c of entities.connections) out.set(keyOf('connection', c.id), json(c))
  for (const c of entities.components) out.set(keyOf('component', c.id), json(c))
  return out
}

/**
 * Compara o canvas daqui com o que chegou de fora. Devolve as chaves das peças
 * criadas, apagadas ou mudadas, e a versão de fora com os objetos daqui onde
 * nada mudou (os previews e o `syncComponents` não refazem o que é igual).
 */
export function diffRemote(local: HistoryEntities, remote: HistoryEntities) {
  const before = shapes(local)
  const after = shapes(remote)
  const changed = new Set<string>()
  for (const [key, shape] of after) if (before.get(key) !== shape) changed.add(key)
  for (const key of before.keys()) if (!after.has(key)) changed.add(key)
  if (json(local.siteSeo) !== json(remote.siteSeo)) changed.add(SEO_KEY)

  const reuse = <T extends { id: string }>(kind: Kind, list: T[], mine: T[]) => {
    const byId = new Map(mine.map((x) => [x.id, x]))
    return list.map((x) => (!changed.has(keyOf(kind, x.id)) && byId.has(x.id) ? byId.get(x.id)! : x))
  }
  const shared: HistoryEntities = {
    nodes: reuse('node', remote.nodes, local.nodes),
    pages: reuse('page', remote.pages, local.pages),
    connections: reuse('connection', remote.connections, local.connections),
    components: reuse('component', remote.components, local.components),
    siteSeo: changed.has(SEO_KEY) ? remote.siteSeo : local.siteSeo,
  }
  return { changed, shared }
}

/** Época em que cada peça foi mexida de fora pela última vez. */
export type RemoteTouches = Map<string, number>

export const markRemote = (touches: RemoteTouches, changed: Iterable<string>, epoch: number) => {
  for (const key of changed) touches.set(key, epoch)
}

/**
 * O canvas do passo `snapshot` (tirado na época `epoch`) aplicado sobre o de
 * agora, sem desfazer o que veio de fora depois dele. Sem nada de fora depois
 * do passo, devolve o próprio passo.
 */
export function rebaseSnapshot<T extends HistoryEntities>(snapshot: T, epoch: number, current: HistoryEntities, touches: RemoteTouches): T {
  const later = (key: string) => (touches.get(key) ?? -1) > epoch
  if (![...touches.values()].some((at) => at > epoch)) return snapshot

  const merge = <X extends { id: string }>(kind: Kind, mine: X[], now: X[]) => {
    const nowById = new Map(now.map((x) => [x.id, x]))
    const out: X[] = []
    const seen = new Set<string>()
    for (const x of mine) {
      seen.add(x.id)
      if (!later(keyOf(kind, x.id))) out.push(x)
      else if (nowById.has(x.id)) out.push(nowById.get(x.id)!)
      // mexida de fora e que não existe agora: foi apagada de fora, não volta
    }
    // Criada de fora depois do passo: continua
    for (const x of now) if (!seen.has(x.id) && later(keyOf(kind, x.id))) out.push(x)
    return out
  }

  const result = { ...snapshot }
  for (const [kind, field] of LISTS) (result as HistoryEntities)[field] = merge(kind, snapshot[field] as Array<{ id: string }>, current[field] as Array<{ id: string }>) as never
  if (later(SEO_KEY)) result.siteSeo = current.siteSeo

  // Limpeza das páginas e conexões que a mistura pode ter deixado inconsistentes
  const sections = new Set(result.nodes.filter((n) => n.type === 'section').map((n) => n.id))
  const claimed = new Set<string>()
  result.pages = result.pages.map((page) => {
    const ids = page.sectionIds.filter((id) => {
      if (!sections.has(id) || claimed.has(id)) return false
      claimed.add(id)
      return true
    })
    return ids.length === page.sectionIds.length ? page : { ...page, sectionIds: ids }
  })
  const nodeIds = new Set(result.nodes.map((n) => n.id))
  result.connections = result.connections.filter((c) => nodeIds.has(c.sourceId) && nodeIds.has(c.targetId))
  if (!result.pages.length && current.pages.length) result.pages = current.pages
  return result
}

/** Mesmo conteúdo, peça por peça (as listas mudam de referência a cada mistura). */
export function sameEntities(a: HistoryEntities, b: HistoryEntities) {
  const sameList = <X>(x: X[], y: X[]) => x === y || (x.length === y.length && x.every((item, i) => item === y[i]))
  return sameList(a.nodes, b.nodes) && sameList(a.pages, b.pages) && sameList(a.connections, b.connections) && sameList(a.components, b.components) && a.siteSeo === b.siteSeo
}
