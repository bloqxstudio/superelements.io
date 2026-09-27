import type { ProjectDoc } from './types'

/**
 * Canvas e marca de cada projeto ficam no IndexedDB: guardam o JSON inteiro
 * das seções e logos em data URL, que estourariam os ~5 MB do localStorage.
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

export const loadProjectDoc = (id: string) => run<ProjectDoc | undefined>('readonly', (s) => s.get(id))

export const saveProjectDoc = async (id: string, doc: ProjectDoc) => {
  await run('readwrite', (s) => s.put(doc, id))
}

export const deleteProjectDoc = async (id: string) => {
  await run('readwrite', (s) => s.delete(id))
}
