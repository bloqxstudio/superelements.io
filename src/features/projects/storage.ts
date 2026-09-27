import type { WordPressConnection } from '@/features/wordpress/types'
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

// A conexão com o WordPress fica fora do documento do projeto, que o canvas regrava a cada edição
const connectionKey = (id: string) => `wordpress:${id}`

export const loadWordPressConnection = (id: string) =>
  run<WordPressConnection | undefined>('readonly', (s) => s.get(connectionKey(id)))

export const saveWordPressConnection = async (id: string, connection: WordPressConnection) => {
  await run('readwrite', (s) => s.put(connection, connectionKey(id)))
}

export const deleteWordPressConnection = async (id: string) => {
  await run('readwrite', (s) => s.delete(connectionKey(id)))
}

/** O conteúdo que uma página do site tinha antes de cada atualização feita daqui, o mais novo primeiro. */
export interface PublishBackup {
  elementorData: string
  modifiedGmt: string
  savedAt: number
}

const backupKey = (id: string, postId: number) => `wordpress-backup:${id}:${postId}`

export const loadPublishBackups = async (id: string, postId: number) =>
  (await run<PublishBackup[] | undefined>('readonly', (s) => s.get(backupKey(id, postId)))) ?? []

export const savePublishBackups = async (id: string, postId: number, backups: PublishBackup[]) => {
  await run('readwrite', (s) => s.put(backups, backupKey(id, postId)))
}

/** Apaga as cópias de segurança de todas as páginas do projeto. */
export const deletePublishBackups = async (id: string) => {
  const prefix = `wordpress-backup:${id}:`
  await run('readwrite', (s) => s.delete(IDBKeyRange.bound(prefix, `${prefix}\uffff`)))
}
