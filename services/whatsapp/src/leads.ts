import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Avisos de lead novo: a função `lead-webhook` grava o cartão do contato em `crm_lead_alerts`; aqui ele sai
 * para quem está marcado com "Recebe leads" no cadastro de números (`crm_whatsapp_client_contacts.leads`).
 * Guard-rails: só para números cadastrados, só numa conversa que a pessoa já abriu com o número da equipe
 * (nunca inicia contato) e um aviso nunca sai duas vezes (`crm_claim_lead_alert`).
 */

type Db = SupabaseClient

export type DeliverText = (teamId: string, jid: string, text: string) => Promise<boolean>

const DAY = 86_400_000
let warned = false

/** Uma passada (chame a cada poucos segundos). `openTeams`: os números de WhatsApp ligados agora. */
export async function runLeadAlerts(db: Db, openTeams: string[], deliver: DeliverText) {
  if (!openTeams.length) return
  const { data: alerts, error } = await db.from('crm_lead_alerts').select('id, team_id, text, created_at').is('sent_at', null).gt('created_at', new Date(Date.now() - DAY).toISOString()).order('created_at').limit(20)
  if (error) {
    if (!warned) console.error(error.code === '42P01' || error.code === 'PGRST205' ? 'Falta a migração 20261029140000_crm_lead_webhook.sql: os avisos de lead estão desligados.' : `Avisos de lead: ${error.message}`)
    warned = true
    return
  }
  for (const alert of alerts ?? []) {
    const accountId = alert.team_id as string
    const { data: people } = await db.from('crm_whatsapp_client_contacts').select('team_id, phone').eq('account_id', accountId).eq('leads', true).eq('enabled', true)
    const recipients = (people ?? []).filter((p) => openTeams.includes(p.team_id as string))
    // Há quem deva receber, mas o número dessa pessoa está desligado: espera o serviço voltar (até um dia)
    if ((people ?? []).length && !recipients.length) continue
    const { data: claimed } = await db.rpc('crm_claim_lead_alert', { p_id: alert.id })
    if (!claimed) continue
    for (const person of recipients) {
      const phone = String(person.phone)
      const teamId = person.team_id as string
      const { data: chats } = await db.from('crm_whatsapp_chats').select('jid').eq('team_id', teamId).like('jid', `%${phone.slice(-8)}@s.whatsapp.net`).limit(1)
      const jid = chats?.[0]?.jid as string | undefined
      if (!jid) {
        console.error(`[${teamId.slice(0, 8)}] aviso de lead: …${phone.slice(-4)} ainda não escreveu para o número da equipe; peça um "oi" uma vez.`)
        continue
      }
      if (!(await deliver(teamId, jid, String(alert.text)))) console.error(`[${teamId.slice(0, 8)}] aviso de lead para …${phone.slice(-4)} não entrou na fila`)
    }
  }
}
