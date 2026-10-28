import type { SupabaseClient } from '@supabase/supabase-js'
import { clientReport, type ClientContact, type Topic } from './clientes.ts'
import { anuncios, funil, periodOf, readOnly, samePhone, site } from './comandos.ts'

/**
 * Relatórios internos: o resumo do dia ou da semana (site, anúncios, funil) vai só
 * para quem está em `crm_whatsapp_commanders`, no horário de `crm_whatsapp_reports`.
 * Guard-rails: nunca para cliente nem para número fora da lista, só para uma conversa
 * que o comandante já abriu com o número da equipe, só leitura, um por dia.
 */

type Db = SupabaseClient

// O Brasil não tem horário de verão desde 2019: São Paulo é UTC-3 o ano todo
const spNow = () => new Date(Date.now() - 3 * 3_600_000)

export interface ReportConfig {
  kind: 'diario' | 'semanal'
  hour: number
  weekday: number
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** O relatório está na hora? (hora cheia em São Paulo, e no semanal o dia da semana certo) */
export const isDue = (config: ReportConfig, now = spNow()) => now.getUTCHours() >= config.hour && (config.kind === 'diario' || now.getUTCDay() === config.weekday)

export async function buildReport(rawDb: Db, teamId: string, kind: ReportConfig['kind']): Promise<string> {
  const db = readOnly(rawDb)
  const now = spNow()
  const date = `${WEEKDAYS[now.getUTCDay()]}, ${String(now.getUTCDate()).padStart(2, '0')}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const siteDays = kind === 'diario' ? periodOf('ontem') : periodOf('7')
  const adsDays = periodOf(kind === 'diario' ? '7' : '30')
  const parts = await Promise.all([site(db, teamId, siteDays), anuncios(db, teamId, adsDays), funil(db, teamId)].map((p) => p.catch((error) => `Não consegui ler: ${error instanceof Error ? error.message : String(error)}`)))
  return [`*${kind === 'diario' ? 'Resumo do dia' : 'Resumo da semana'}* · ${date}`, ...parts, '_Digite "ajuda" para perguntar mais._'].join('\n\n')
}

let warned = false

/** Uma passada (chame a cada minuto): manda os relatórios que chegaram na hora e ainda não saíram hoje */
export async function runReports(db: Db, teamIds: string[]) {
  if (!teamIds.length) return
  const { data, error } = await db.from('crm_whatsapp_reports').select('team_id, kind, hour, weekday').in('team_id', teamIds).eq('enabled', true)
  if (error) {
    if (!warned) console.error(error.code === '42P01' || error.code === 'PGRST205' ? 'Falta a migração 20261028100000_crm_whatsapp_reports.sql: os relatórios por WhatsApp estão desligados.' : `Relatórios: ${error.message}`)
    warned = true
    return
  }
  const today = spNow().toISOString().slice(0, 10)
  for (const row of data ?? []) {
    const config = { kind: row.kind as ReportConfig['kind'], hour: row.hour as number, weekday: row.weekday as number }
    if (!isDue(config)) continue
    const teamId = row.team_id as string
    const { data: commanders } = await db.from('crm_whatsapp_commanders').select('phone').eq('team_id', teamId)
    // Números cadastrados que pediram o relatório (clientes e gente da conta da casa que não é comandante)
    const { data: registered } = await db.from('crm_whatsapp_client_contacts').select('phone, account_id, name, topics').eq('team_id', teamId).eq('enabled', true).eq('reports', true)
    const contacts = (registered ?? []).filter((c) => !commanders?.some((m) => samePhone(m.phone as string, c.phone as string)))
    if (!commanders?.length && !contacts.length) continue
    // Reserva antes de montar: uma nova tentativa ou outra cópia do serviço não repete
    const { data: claimed, error: claimError } = await db.rpc('crm_whatsapp_claim_report', { p_team: teamId, p_kind: config.kind, p_today: today })
    if (claimError || !claimed) continue
    const send = async (phone: string, text: string) => {
      // Só para uma conversa que a pessoa já abriu: o relatório nunca inicia contato com número novo
      const { data: chats } = await db.from('crm_whatsapp_chats').select('jid').eq('team_id', teamId).like('jid', `%${phone.slice(-8)}@s.whatsapp.net`).limit(1)
      const target = chats?.[0]?.jid as string | undefined
      if (!target) {
        console.error(`[${teamId.slice(0, 8)}] relatório: …${phone.slice(-4)} ainda não escreveu para o número da equipe; peça um "oi" uma vez.`)
        return
      }
      const { error: sendError } = await db.rpc('crm_whatsapp_enqueue_reply', { p_team: teamId, p_jid: target, p_text: text })
      if (sendError) console.error(`[${teamId.slice(0, 8)}] relatório não enfileirado: ${sendError.message}`)
    }
    if (commanders?.length) {
      const text = await buildReport(db, teamId, config.kind)
      for (const { phone } of commanders) await send(String(phone), text)
    }
    for (const c of contacts) {
      const contact: ClientContact = { phone: c.phone as string, accountId: c.account_id as string, name: (c.name as string) ?? '', topics: (c.topics as Topic[]) ?? [] }
      const text = await clientReport(db, contact, config.kind)
      if (text) await send(contact.phone, text.slice(0, 3500))
    }
  }
}
