import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

/**
 * O CRM da equipe pelo terminal: as tabelas (funil, clientes) e a pasta da
 * equipe no bucket (`crm/<equipe>/`), as mesmas que a tela usa. Usa a chave
 * service_role do `.env.local`, que nunca vai para o navegador.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = { ...loadEnv('', root, ''), ...loadEnv('development', root, '') }

let client: ReturnType<typeof createClient> | undefined
export const cloudClient = () => {
  if (client) return client
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('O funil fica no CRM: falta SUPABASE_SERVICE_ROLE_KEY no .env.local (Supabase > Project Settings > API Keys)')
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

export interface CrmTarget {
  teamId: string
  teamName: string
  pipelineId: string
}

let target: Promise<CrmTarget> | undefined

/**
 * A equipe e o funil do terminal: a única equipe, ou a de nome
 * `PROSPECCAO_EQUIPE` (no `.env.local`) quando houver mais de uma.
 */
export const crmTarget = () =>
  (target ??= (async () => {
    const db = cloudClient()
    const { data: teams, error } = await db.from('crm_teams').select('id, name').order('created_at')
    if (error) throw new Error(`O CRM não está no banco (${error.message}): aplique a migração 20261013150000_crm.sql`)
    const wanted = env.PROSPECCAO_EQUIPE?.trim().toLowerCase()
    const list = (teams ?? []) as { id: string; name: string }[]
    const team = wanted ? list.find((t) => t.name.trim().toLowerCase() === wanted) : list.length === 1 ? list[0] : undefined
    if (!team) {
      throw new Error(
        list.length
          ? `Diga a equipe com PROSPECCAO_EQUIPE no .env.local: ${list.map((t) => t.name).join(', ')}`
          : 'Ainda não há equipe no CRM: crie em /crm no app'
      )
    }
    const { data: pipelines, error: pipelineError } = await db.from('crm_pipelines').select('id').eq('team_id', team.id).order('position').order('created_at').limit(1)
    if (pipelineError) throw pipelineError
    const pipeline = (pipelines ?? [])[0] as { id: string } | undefined
    if (!pipeline) throw new Error(`A equipe ${team.name} não tem funil`)
    return { teamId: team.id, teamName: team.name, pipelineId: pipeline.id }
  })())

/** Caminho na pasta da equipe. */
export const teamPath = async (name: string) => `crm/${(await crmTarget()).teamId}/${name}`
