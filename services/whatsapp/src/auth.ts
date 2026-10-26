import { BufferJSON, initAuthCreds, proto, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from 'baileys'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * As chaves da sessão de um número (o aparelho conectado) na tabela
 * `crm_whatsapp_auth`, em vez de arquivos: o serviço não guarda nada no disco
 * e volta conectado depois de reiniciar em qualquer servidor. Uma linha por
 * chave (`creds`, `pre-key-1`, `session-…`), com os bytes em base64 pelo
 * `BufferJSON` da biblioteca.
 */

const TABLE = 'crm_whatsapp_auth'
const CHUNK = 200

const encode = (value: unknown): unknown => JSON.parse(JSON.stringify(value, BufferJSON.replacer))
const decode = <T>(value: unknown): T => JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T

const chunks = <T>(list: T[]) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK))

export interface DbAuth {
  state: AuthenticationState
  saveCreds: () => Promise<void>
  /** Apaga a sessão (o número foi desconectado) */
  clear: () => Promise<void>
}

export async function dbAuthState(db: SupabaseClient, teamId: string): Promise<DbAuth> {
  const { data, error } = await db.from(TABLE).select('value').eq('team_id', teamId).eq('key', 'creds').maybeSingle()
  if (error) throw error
  const creds: AuthenticationCreds = data ? decode(data.value) : initAuthCreds()

  const write = async (rows: { key: string; value: unknown }[]) => {
    const at = new Date().toISOString()
    for (const part of chunks(rows)) {
      const { error: writeError } = await db.from(TABLE).upsert(
        part.map((r) => ({ team_id: teamId, key: r.key, value: encode(r.value), updated_at: at })),
        { onConflict: 'team_id,key' }
      )
      if (writeError) throw writeError
    }
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const out: { [id: string]: SignalDataTypeMap[T] } = {}
        for (const part of chunks(ids)) {
          const { data: rows, error: readError } = await db
            .from(TABLE)
            .select('key, value')
            .eq('team_id', teamId)
            .in('key', part.map((id) => `${type}-${id}`))
          if (readError) throw readError
          for (const row of rows ?? []) {
            const id = (row.key as string).slice(type.length + 1)
            const value = decode<SignalDataTypeMap[T]>(row.value)
            out[id] = type === 'app-state-sync-key' && value ? (proto.Message.AppStateSyncKeyData.fromObject(value as object) as unknown as SignalDataTypeMap[T]) : value
          }
        }
        return out
      },
      set: async (data) => {
        const upserts: { key: string; value: unknown }[] = []
        const deletes: string[] = []
        for (const category in data) {
          const entries = data[category as keyof SignalDataTypeMap] ?? {}
          for (const id in entries) {
            const value = entries[id]
            if (value) upserts.push({ key: `${category}-${id}`, value })
            else deletes.push(`${category}-${id}`)
          }
        }
        if (upserts.length) await write(upserts)
        for (const part of chunks(deletes)) {
          const { error: deleteError } = await db.from(TABLE).delete().eq('team_id', teamId).in('key', part)
          if (deleteError) throw deleteError
        }
      },
    },
  }

  return {
    state,
    saveCreds: () => write([{ key: 'creds', value: state.creds }]),
    clear: async () => {
      const { error: clearError } = await db.from(TABLE).delete().eq('team_id', teamId)
      if (clearError) throw clearError
    },
  }
}
