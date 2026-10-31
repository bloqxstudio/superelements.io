/**
 * Criação inicial exclusiva de um material (documento do Copy, conjunto de Criativos).
 * Sem imports: o Node testa este contrato com um adaptador falso.
 *
 * Garantia: a PRIMEIRA gravação só acontece se o arquivo não existe (o Storage recusa com
 * conflito quando é `upsert: false`). Quem perde a corrida lê o arquivo do vencedor e o reaproveita,
 * sem escrever por cima de edições que já aconteceram. Erros de leitura ou de permissão NUNCA
 * contam como "arquivo ausente": sobem para quem chamou.
 *
 * Limite: a lista (`index.json`) de cada pasta continua sendo lida, alterada e regravada como em
 * toda gravação normal; duas pessoas indexando ao mesmo tempo podem perder uma linha da lista
 * (o arquivo em si não se perde, e a tela do conteúdo abre o material pelo id, não pela lista).
 */

export interface ExclusiveAdapter<T> {
  /** Lê o material; `undefined` só quando ele realmente não existe. Qualquer outra falha lança. */
  load: () => Promise<T | undefined>
  /** Grava só se ainda não existe: `exists` quando já existia; qualquer outra falha lança. */
  create: (value: T) => Promise<'created' | 'exists'>
  /** Põe o material na lista da pasta. */
  index: (value: T) => Promise<void>
}

export async function createOnce<T>(adapter: ExclusiveAdapter<T>, value: T): Promise<{ value: T; created: boolean }> {
  const existing = await adapter.load()
  if (existing !== undefined) return { value: existing, created: false }
  if ((await adapter.create(value)) === 'exists') {
    const winner = await adapter.load()
    if (winner === undefined) throw new Error('O material já existia, mas não consegui lê-lo. Tente de novo.')
    return { value: winner, created: false }
  }
  await adapter.index(value)
  return { value, created: true }
}

/** O Storage respondeu "já existe" (upload sem upsert)? */
export function isAlreadyExists(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: string | number; message?: string; error?: string } | null
  const code = String(e?.statusCode ?? e?.status ?? '')
  return code === '409' || /already exists|duplicate/i.test(`${e?.message ?? ''} ${e?.error ?? ''}`)
}
