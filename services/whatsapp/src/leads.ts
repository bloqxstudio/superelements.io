import type { SupabaseClient } from '@supabase/supabase-js'
import { chatJidsOf } from './comandos.ts'

/**
 * Avisos de lead novo: a função `lead-webhook` grava o cartão do contato em `crm_lead_alerts`; aqui ele sai
 * para quem está marcado com "Recebe leads" no cadastro de números (`crm_whatsapp_client_contacts.leads`).
 * Guard-rails: só para números cadastrados da própria equipe, só numa conversa que a pessoa já abriu com o
 * número da equipe (nunca inicia contato, nunca escreve para cliente final) e um aviso nunca sai duas vezes
 * (`crm_lead_alert_lock` reserva a tentativa).
 *
 * Revisão de 2026-11-13: o aviso era marcado como enviado antes de saber se alguém tinha a conversa aberta
 * (sem conversa, sumia com um console.error) e os de mais de 24 h ficavam na fila para sempre. Agora só conta
 * como enviado com ao menos uma entrega (`crm_lead_alert_done`); sem nenhuma, fica `failed` com o motivo em
 * `error` (para a tela mostrar e o gestor pedir de novo; o serviço tenta a cada 10 minutos enquanto vale); depois de
 * 24 h sem entrega vira `expired` (`crm_expire_lead_alerts`). Migração 20261114000000_revisao_crm_whatsapp.sql.
 */

type Db = SupabaseClient

export type DeliverText = (teamId: string, jid: string, text: string) => Promise<boolean>
/** Envio direto a um grupo (o grupo não é uma conversa da caixa de entrada) */
export type DeliverGroup = (teamId: string, jid: string, text: string) => Promise<boolean>

const DAY = 86_400_000
let warned = false
let warnedGroups = false
let lastExpire = 0

const missing = (code?: string) => code === '42P01' || code === 'PGRST205' || code === '42703' || code === 'PGRST204' || code === '42883' || code === 'PGRST202'

/** Uma passada (chame a cada poucos segundos). `openTeams`: os números de WhatsApp ligados agora. */
export async function runLeadAlerts(db: Db, openTeams: string[], deliver: DeliverText, deliverGroup: DeliverGroup) {
  // Os que passaram de 24 h sem entrega saem da fila como vencidos (mesmo com o número desligado). Uma vez
  // a cada 10 minutos basta (cuidado com o egress do Supabase).
  if (Date.now() - lastExpire > 10 * 60_000) {
    const { error: expireError } = await db.rpc('crm_expire_lead_alerts')
    if (expireError) {
      if (!warned) console.error(missing(expireError.code) ? 'Falta a migração 20261114000000_revisao_crm_whatsapp.sql: os avisos de lead estão parados.' : `Avisos de lead: ${expireError.message}`)
      warned = true
      if (missing(expireError.code)) return
    } else lastExpire = Date.now()
  }
  if (!openTeams.length) return
  const retryBefore = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data: alerts, error } = await db
    .from('crm_lead_alerts')
    .select('id, team_id, text, created_at')
    .is('sent_at', null)
    .gt('queued_at', new Date(Date.now() - DAY).toISOString())
    .or(`status.eq.pending,and(status.eq.failed,last_attempt_at.lt.${retryBefore})`)
    .order('queued_at')
    .limit(20)
  if (error) {
    if (!warned) console.error(missing(error.code) ? 'Falta a migração 20261114000000_revisao_crm_whatsapp.sql: os avisos de lead estão parados.' : `Avisos de lead: ${error.message}`)
    warned = true
    return
  }
  for (const alert of alerts ?? []) {
    const accountId = alert.team_id as string
    const { data: people } = await db.from('crm_whatsapp_client_contacts').select('team_id, phone').eq('account_id', accountId).eq('leads', true).eq('enabled', true)
    const recipients = (people ?? []).filter((p) => openTeams.includes(p.team_id as string))
    const { data: groupRows, error: groupError } = await db.from('crm_whatsapp_groups').select('team_id, jid, name').eq('leads_account_id', accountId)
    if (groupError && !warnedGroups) {
      console.error(groupError.code === '42P01' || groupError.code === 'PGRST205' ? 'Falta a migração 20261031180000_crm_whatsapp_groups.sql: os avisos em grupo estão desligados.' : `Grupos de leads: ${groupError.message}`)
      warnedGroups = true
    }
    const groups = (groupRows ?? []).filter((g) => openTeams.includes(g.team_id as string))
    // Há quem deva receber (pessoa ou grupo), mas o número está desligado: espera o serviço voltar (até um dia)
    if ((people ?? []).length + (groupRows ?? []).length && !recipients.length && !groups.length) continue
    const { data: locked, error: lockError } = await db.rpc('crm_lead_alert_lock', { p_id: alert.id })
    if (lockError) {
      console.error(`Aviso de lead: ${lockError.message}`)
      continue
    }
    if (!locked) continue

    let delivered = 0
    const problems: string[] = []
    for (const person of recipients) {
      const phone = String(person.phone)
      const teamId = person.team_id as string
      const { data: chats } = await db.from('crm_whatsapp_chats').select('jid').eq('team_id', teamId).in('jid', chatJidsOf(phone)).limit(1)
      const jid = chats?.[0]?.jid as string | undefined
      if (!jid) {
        problems.push(`…${phone.slice(-4)} ainda não escreveu para o número da equipe (peça um "oi" uma vez)`)
        continue
      }
      if (await deliver(teamId, jid, String(alert.text))) delivered++
      else problems.push(`…${phone.slice(-4)}: o envio não entrou na fila`)
    }
    for (const group of groups) {
      const teamId = group.team_id as string
      if (await deliverGroup(teamId, String(group.jid), String(alert.text))) delivered++
      else problems.push(`grupo "${group.name}": o envio não saiu`)
    }
    if (!recipients.length && !groups.length) problems.push('ninguém marcado para receber os leads desta conta')
    const reason = problems.length ? problems.join('; ') : null
    if (!delivered) console.error(`[${accountId.slice(0, 8)}] aviso de lead sem entrega: ${reason}`)
    const { error: doneError } = await db.rpc('crm_lead_alert_done', { p_id: alert.id, p_delivered: delivered, p_error: reason })
    if (doneError) console.error(`Aviso de lead ${String(alert.id).slice(0, 8)}: ${doneError.message}`)
  }
}
