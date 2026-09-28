import type { WordPressConnection } from '@/features/wordpress/types'
import type { ProjectDoc, ProjectSummary, PublishBackup } from './types'

/**
 * IndexedDB deste navegador. Os projetos ficam na conta; aqui fica só o
 * rascunho do que ainda não chegou lá (a aba fechou, a internet caiu) e,
 * intactos como cópia, os projetos de antes da conta.
 */
const DB_NAME = 'superelements'
const STORE = 'project-docs'

let opening: Promise<IDBDatabase> | null = null

const openDb = () =>
  (opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      opening = null
      reject(request.error)
    }
  }))

const run = async <T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = op(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
}

/** Mudanças do projeto que ainda não chegaram à conta. */
export interface ProjectDraft {
  doc: ProjectDoc
  summary: ProjectSummary
  /** Revisão da conta sobre a qual as mudanças foram feitas. */
  base: number
  /** Mudou o conteúdo, não só o zoom e a posição do canvas. */
  edited: boolean
  savedAt: number
}

const draftKey = (id: string) => `draft:${id}`

export const loadDraft = (id: string) => run<ProjectDraft | undefined>('readonly', (s) => s.get(draftKey(id)))

export const saveDraft = async (id: string, draft: ProjectDraft) => {
  await run('readwrite', (s) => s.put(draft, draftKey(id)))
}

export const deleteDraft = async (id: string) => {
  await run('readwrite', (s) => s.delete(draftKey(id)))
}

// Chaves de antes da conta: `<projeto>`, `wordpress:<projeto>` e `wordpress-backup:<projeto>:<página>`
const backupRange = (id: string) => {
  const prefix = `wordpress-backup:${id}:`
  return { prefix, range: IDBKeyRange.bound(prefix, `${prefix}￿`) }
}

export const readBrowserDoc = (id: string) => run<ProjectDoc | undefined>('readonly', (s) => s.get(id))

export const readBrowserConnection = (id: string) =>
  run<WordPressConnection | undefined>('readonly', (s) => s.get(`wordpress:${id}`))

/** As versões anteriores guardadas de cada página publicada do projeto. */
export async function readBrowserBackups(id: string): Promise<Array<{ postId: number; backups: PublishBackup[] }>> {
  const { prefix, range } = backupRange(id)
  const [keys, values] = await Promise.all([
    run<IDBValidKey[]>('readonly', (s) => s.getAllKeys(range)),
    run<PublishBackup[][]>('readonly', (s) => s.getAll(range)),
  ])
  return keys.map((key, i) => ({ postId: Number(String(key).slice(prefix.length)), backups: values[i] ?? [] }))
}

/** Apaga daqui o rascunho e a cópia de antes da conta de um projeto excluído. */
export async function forgetBrowserProject(id: string) {
  await run('readwrite', (s) => s.delete(id))
  await run('readwrite', (s) => s.delete(`wordpress:${id}`))
  await run('readwrite', (s) => s.delete(backupRange(id).range))
  await deleteDraft(id)
}
