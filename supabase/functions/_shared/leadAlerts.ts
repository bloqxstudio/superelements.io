import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * A conta tem quem receba o aviso de lead no WhatsApp? Ao menos um número da própria equipe marcado com
 * "Recebe leads" (`crm_whatsapp_client_contacts.leads`) ou um grupo escolhido para os leads da conta
 * (`crm_whatsapp_groups.leads_account_id`). Sem ninguém, o aviso nem entra na fila (`crm_lead_alerts`).
 * Revisão de 2026-11-13: a mesma conta estava repetida em `lead-webhook` e duas vezes em `form-submit`.
 */
export async function hasLeadRecipients(admin: SupabaseClient, teamId: string): Promise<boolean> {
  const [{ count: people }, { count: groups }] = await Promise.all([
    admin.from('crm_whatsapp_client_contacts').select('phone', { count: 'exact', head: true }).eq('account_id', teamId).eq('leads', true).eq('enabled', true),
    admin.from('crm_whatsapp_groups').select('jid', { count: 'exact', head: true }).eq('leads_account_id', teamId),
  ])
  return !!people || !!groups
}
