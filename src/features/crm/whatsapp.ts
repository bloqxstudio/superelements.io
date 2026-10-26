import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

/**
 * O WhatsApp da equipe (CRM › WhatsApp), por enquanto só a conexão: o gestor
 * pede, o nosso serviço (`services/whatsapp`) põe o QR code na linha da
 * equipe em `crm_whatsapp_numbers`, o celular lê e o número fica conectado
 * como aparelho (WhatsApp › Aparelhos conectados). A tela só lê essa linha
 * (ao vivo pela Realtime) e pede conectar ou desconectar pelas funções do
 * banco.
 */

type NumberRow = Database['public']['Tables']['crm_whatsapp_numbers']['Row']

export type WaStatus = 'disconnected' | 'connecting' | 'connected'

export interface WaNumber {
  /** O gestor pediu o número conectado */
  wanted: boolean
  status: WaStatus
  /** O QR code da vez (imagem), enquanto o celular não lê */
  qr?: string
  phone?: string
  profileName?: string
  /** Por que caiu (o código venceu, o celular desconectou…) */
  error?: string
  requestedAt?: number
  /** A última vez que o serviço passou pela linha */
  seenAt?: number
  connectedAt?: number
}

const time = (value: string | null) => (value ? Date.parse(value) : undefined)

const toNumber = (row: NumberRow): WaNumber => ({
  wanted: row.wanted,
  status: row.status as WaStatus,
  qr: row.qr ?? undefined,
  phone: row.phone ?? undefined,
  profileName: row.profile_name ?? undefined,
  error: row.error ?? undefined,
  requestedAt: time(row.requested_at),
  seenAt: time(row.seen_at),
  connectedAt: time(row.connected_at),
})

/** Erro com o código: `no_tables` quando falta a migração. */
export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly code = 'error'
  ) {
    super(message)
  }
}

const missingTable = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205'
const missingFunction = (error: { code?: string }) => error.code === '42883' || error.code === 'PGRST202'

/** A conexão da equipe; sem linha, o número nunca foi conectado. */
export async function loadNumber(teamId: string): Promise<WaNumber | undefined> {
  const { data, error } = await supabase.from('crm_whatsapp_numbers').select('*').eq('team_id', teamId).maybeSingle()
  if (error) throw missingTable(error) ? new WhatsAppError('Aplique a migração 20261026150000_crm_whatsapp.sql no Supabase.', 'no_tables') : new WhatsAppError(error.message)
  return data ? toNumber(data) : undefined
}

async function call(fn: 'crm_whatsapp_connect' | 'crm_whatsapp_disconnect', teamId: string) {
  const { error } = await supabase.rpc(fn, { p_team: teamId })
  if (error) throw missingFunction(error) ? new WhatsAppError('Aplique a migração 20261026150000_crm_whatsapp.sql no Supabase.', 'no_tables') : new WhatsAppError(error.message)
}

/** Pede a conexão (gestor): o serviço gera o QR code em seguida. */
export const connectWhatsApp = (teamId: string) => call('crm_whatsapp_connect', teamId)

/** Desconecta (gestor): o serviço tira o aparelho do celular. */
export const disconnectWhatsApp = (teamId: string) => call('crm_whatsapp_disconnect', teamId)

/** O serviço dá sinal de vida a cada 15 s com o número ligado. */
export const SERVICE_SILENT_MS = 60_000

/** Pediu a conexão e o serviço não apareceu: ele não está rodando. */
export const serviceMissed = (n: WaNumber, now = Date.now()) => n.wanted && !!n.requestedAt && now - n.requestedAt > 25_000 && (!n.seenAt || n.seenAt < n.requestedAt)

/** +55 51 98108-2503 */
export function formatPhone(digits: string | undefined) {
  if (!digits) return undefined
  const br = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  if (br) return `+55 ${br[1]} ${br[2]}-${br[3]}`
  return `+${digits}`
}

/** A linha da equipe ao vivo (QR code novo, conectado, desconectado). */
export function useNumberFeed(teamId: string | undefined, onNumber: (number: WaNumber) => void) {
  const latest = useRef(onNumber)
  latest.current = onNumber

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`crm-whatsapp-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_whatsapp_numbers', filter: `team_id=eq.${teamId}` }, (payload) => {
        if (payload.new && 'team_id' in payload.new) latest.current(toNumber(payload.new as NumberRow))
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [teamId])
}
