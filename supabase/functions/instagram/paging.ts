/** Never fetch paging.next: it may contain credentials. Reuse the original endpoint and only its cursor. */
export interface GraphPage<T> {
  data?: T[]
  paging?: { cursors?: { after?: string }; next?: string }
}

export async function readPages<T extends { id: string }>(
  read: (after?: string) => Promise<GraphPage<T>>,
  maxPages = 4,
) {
  const rows = new Map<string, T>()
  const cursors = new Set<string>()
  let after: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const result = await read(after)
    for (const row of result.data ?? []) rows.set(row.id, row)
    if (!result.paging?.next) return { data: [...rows.values()], hasMore: false }
    let next = result.paging.cursors?.after
    if (!next) {
      try { next = new URL(result.paging.next).searchParams.get('after') ?? undefined } catch { /* incomplete pagination */ }
    }
    if (!next || cursors.has(next)) return { data: [...rows.values()], hasMore: true }
    cursors.add(next)
    after = next
  }
  return { data: [...rows.values()], hasMore: true }
}
