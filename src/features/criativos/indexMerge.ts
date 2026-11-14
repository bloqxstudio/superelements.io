/**
 * O `index.json` de cada pasta de Criativos é lido, mudado e regravado inteiro, por mais de um lado ao mesmo tempo:
 * o editor no navegador (`storage.ts`) e o MCP da Sinfy (`supabase/functions/sinfy-mcp`, por `_gerado/criativos.js`).
 * Se o MCP cria um conjunto enquanto o navegador salva outro na mesma pasta, quem grava por último leva a lista que
 * leu antes, sem a linha do outro, e o conjunto some para a IA, que acha tudo pelo índice (revisão de 2026-11-13).
 *
 * O Storage não tem gravação condicional; então cada lado aplica só a SUA mudança (linhas incluídas, trocadas ou
 * tiradas) sobre a lista lida na hora, grava, relê e, se a sua mudança não está lá (outro gravou por cima no meio),
 * aplica de novo sobre a versão nova. As linhas que ele não tocou ficam como estão. Sem imports: usado pelos dois lados.
 */

export interface IndexRow {
  id: string
  updatedAt?: number
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** O que mudou de `before` para `after`: as linhas novas ou diferentes e os ids que saíram. */
export function indexChanges<T extends IndexRow>(before: T[], after: T[]): { upserts: T[]; removed: string[] } {
  const old = new Map(before.map((r) => [r.id, r] as const))
  const ids = new Set(after.map((r) => r.id))
  return {
    upserts: after.filter((r) => !same(old.get(r.id), r)),
    removed: [...old.keys()].filter((id) => !ids.has(id)),
  }
}

/** A lista já tem a mudança: cada linha nossa (ou uma mais nova do mesmo conjunto) e nenhum id tirado. */
export function indexHolds<T extends IndexRow>(list: T[], upserts: T[], removed: string[]): boolean {
  const byId = new Map(list.map((r) => [r.id, r] as const))
  return upserts.every((r) => {
    const now = byId.get(r.id)
    return !!now && (same(now, r) || (now.updatedAt ?? 0) > (r.updatedAt ?? 0))
  }) && removed.every((id) => !byId.has(id))
}

/**
 * Lê, aplica `change` e grava, conferindo depois da gravação (até `tries` vezes). `change` recebe a lista lida na hora
 * e devolve a lista nova; deve mexer só nas linhas do que ela grava (trocar por id, incluir, tirar).
 */
export async function writeIndexSafely<T extends IndexRow>(
  read: () => Promise<T[] | undefined>,
  write: (list: T[]) => Promise<void>,
  change: (list: T[]) => T[],
  tries = 3
): Promise<T[]> {
  let list = (await read()) ?? []
  let next = list
  for (let i = 0; i < tries; i++) {
    next = change(list)
    const { upserts, removed } = indexChanges(list, next)
    if (!upserts.length && !removed.length) return list
    await write(next)
    const after = (await read()) ?? []
    if (indexHolds(after, upserts, removed)) return after
    // Outro lado gravou no meio: a nossa mudança vai de novo, sobre a versão dele
    list = after
  }
  return next
}

/** Troca a linha `id` no lugar (ou inclui no começo), sem mexer nas outras. */
export function upsertRow<T extends IndexRow>(list: T[], id: string, make: (old: T | undefined) => T): T[] {
  const old = list.find((r) => r.id === id)
  return old ? list.map((r) => (r.id === id ? make(r) : r)) : [make(undefined), ...list]
}
