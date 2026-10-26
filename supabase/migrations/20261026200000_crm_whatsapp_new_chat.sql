-- WhatsApp da equipe: começar uma conversa com um número novo (2026-10-26)
--
-- A equipe digita o número e a mensagem; a conversa é criada e a mensagem
-- entra na fila de envio. O serviço confere se o número tem WhatsApp (e
-- corrige o formato, como o 9 dos celulares do Brasil) antes de enviar.

create or replace function public.crm_whatsapp_new_chat(p_team uuid, p_phone text, p_text text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  chat_jid text;
begin
  if not public.is_crm_member(p_team) then
    raise exception 'Só quem está na equipe envia mensagens.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'Mensagem vazia.' using errcode = '22023';
  end if;
  -- Sem o código do país, é um número do Brasil (DDD + número)
  digits := regexp_replace(digits, '^0+', '');
  if length(digits) in (10, 11) then
    digits := '55' || digits;
  end if;
  if length(digits) < 11 or length(digits) > 15 then
    raise exception 'Número inválido. Use o DDD e o número, por exemplo 51 99999-9999.' using errcode = '22023';
  end if;
  chat_jid := digits || '@s.whatsapp.net';

  insert into public.crm_whatsapp_chats (team_id, jid, phone, last_text, last_from_me, last_at)
  values (p_team, chat_jid, digits, btrim(p_text), true, now())
  on conflict (team_id, jid) do update set last_text = btrim(p_text), last_from_me = true, last_at = now();

  insert into public.crm_whatsapp_messages (team_id, chat_jid, from_me, body, kind, status, sent_by)
  values (p_team, chat_jid, true, btrim(p_text), 'text', 'queued', auth.uid());
  return chat_jid;
end
$fn$;

revoke all on function public.crm_whatsapp_new_chat(uuid, text, text) from public, anon;
grant execute on function public.crm_whatsapp_new_chat(uuid, text, text) to authenticated;
