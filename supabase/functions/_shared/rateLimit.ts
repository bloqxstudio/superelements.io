/**
 * Limite de batidas por chave numa janela (revisão de 2026-11-13). Vale entre todas as instâncias da função
 * pelo banco (`crm_rate_hit`, migração 20261114000000_revisao_crm_whatsapp.sql); sem a migração ou com o
 * banco fora, cai no limite desta instância (memória), que ainda segura uma rajada.
 * Sem imports: roda na função (Deno) e nos testes (Node).
 */

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }

const memory = new Map<string, number[]>()

/** Conta a batida na memória; `false` quando passou de `max` em `seconds`. */
export function memoryHit(key: string, max: number, seconds: number, now = Date.now(), store = memory): boolean {
  const since = now - seconds * 1000
  const hits = (store.get(key) ?? []).filter((at) => at > since)
  const ok = hits.length < max
  if (ok) hits.push(now)
  store.set(key, hits)
  // A memória não cresce sem fim: chaves velhas saem de tempos em tempos
  if (store.size > 5000) for (const [k, v] of store) if (!v.some((at) => at > since)) store.delete(k)
  return ok
}

/** `true` se ainda cabe (e conta esta batida); `false` se passou do limite. */
export async function rateHit(db: Rpc, key: string, max: number, seconds: number): Promise<boolean> {
  try {
    const { data, error } = await db.rpc('crm_rate_hit', { p_key: key, p_max: max, p_seconds: seconds })
    if (!error && typeof data === 'boolean') return data
  } catch {
    // cai no limite da memória
  }
  return memoryHit(key, max, seconds)
}
