import type { SpaceConnection, SpaceNode } from '@/types/space'

/**
 * Seções copiadas no canvas, com os textos e paletas ligados a elas: colar
 * cria tudo de novo, com ids novos, e a seção colada fica igual à original.
 */
export interface SectionSnapshot {
  /** Na ordem em que entram na página. */
  sections: SpaceNode[]
  /** Textos e paletas ligados às seções. */
  feeders: SpaceNode[]
  /** Só as ligações entre as peças copiadas. */
  connections: SpaceConnection[]
}

export function snapshotSections(ids: string[], nodes: SpaceNode[], connections: SpaceConnection[]): SectionSnapshot {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const sections = ids.map((id) => byId.get(id)).filter((n): n is SpaceNode => n?.type === 'section')
  const picked = new Set(sections.map((s) => s.id))

  const feeders: SpaceNode[] = []
  const links: SpaceConnection[] = []
  for (const conn of connections) {
    if (!picked.has(conn.targetId)) continue
    const source = byId.get(conn.sourceId)
    if (!source || (source.type === 'section' && !picked.has(source.id))) continue
    if (!picked.has(source.id)) {
      picked.add(source.id)
      feeders.push(source)
    }
    links.push(conn)
  }
  return structuredClone({ sections, feeders, connections: links })
}

/** Peças novas a partir do que foi copiado; pode ser chamado várias vezes (colar de novo). */
export function instantiateSnapshot(snapshot: SectionSnapshot): SectionSnapshot {
  const newId = new Map<string, string>()
  const fresh = (node: SpaceNode): SpaceNode => {
    const id = crypto.randomUUID()
    newId.set(node.id, id)
    return { ...structuredClone(node), id }
  }
  const sections = snapshot.sections.map(fresh)
  const feeders = snapshot.feeders.map(fresh)
  const connections = snapshot.connections.flatMap((c) => {
    const sourceId = newId.get(c.sourceId)
    const targetId = newId.get(c.targetId)
    return sourceId && targetId ? [{ ...c, id: crypto.randomUUID(), sourceId, targetId }] : []
  })
  return { sections, feeders, connections }
}

/** Ctrl no Windows, ⌘ no Mac, para os atalhos nos menus. */
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
