import { createClient } from 'jsr:@supabase/supabase-js@2'
import { webhookHandler } from './handler.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
Deno.serve(webhookHandler({
  verifyToken: Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') ?? '',
  secrets: [Deno.env.get('INSTAGRAM_APP_SECRET') ?? '', Deno.env.get('META_APP_SECRET') ?? ''],
  store: async (message) => {
    const { error } = await admin.rpc('crm_instagram_receive_dm', {
      p_instagram: message.account, p_participant: message.participant, p_mid: message.mid,
      p_from_me: message.fromMe, p_body: message.body, p_attachment: message.attachment, p_ts: message.at,
    })
    if (error) throw new Error('Falha ao guardar mensagem')
  },
}))
