import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

/**
 * A pasta `prospeccao/` do bucket pelo terminal: a mesma que a tela
 * `/prospeccao` lê e grava para todos os admins (migração 20261012200000).
 * Usa a chave service_role do `.env.local`, que nunca vai para o navegador.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = { ...loadEnv('', root, ''), ...loadEnv('development', root, '') }

let client: ReturnType<typeof createClient> | undefined
export const cloudClient = () => {
  if (client) return client
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('O funil fica na nuvem: falta SUPABASE_SERVICE_ROLE_KEY no .env.local (Supabase > Project Settings > API Keys)')
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

export const hasCloud = () => Boolean(env.VITE_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)

const bucket = () => cloudClient().storage.from('space-projects')

/** Um arquivo do bucket pelo caminho inteiro; `undefined` quando não existe. */
export const getJson = async <T,>(name: string): Promise<T | undefined> => {
  const { data, error } = await bucket().download(name)
  if (error) {
    if (/not found|does not exist|404/i.test(error.message)) return undefined
    throw error
  }
  return JSON.parse(await data.text()) as T
}

/** `cacheControl` 0: arquivo regravado no mesmo caminho, o navegador não pode guardar o antigo. */
export const putJson = async (name: string, value: unknown) => {
  const { error } = await bucket().upload(name, new Blob([JSON.stringify(value)], { type: 'application/json' }), {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '0',
  })
  if (error) throw error
}

/** Caminho na pasta da equipe. */
export const shared = (name: string) => `prospeccao/${name}`
