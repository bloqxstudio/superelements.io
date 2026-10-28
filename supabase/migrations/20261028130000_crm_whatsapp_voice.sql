-- WhatsApp da equipe: gravar e enviar mensagem de voz pela plataforma (2026-10-28)
--
-- `voice` é o áudio gravado no navegador: o serviço converte para OGG/Opus e envia como
-- mensagem de voz (a bolinha de microfone), não como arquivo de áudio.

create or replace function public.crm_whatsapp_send_media(
  p_team uuid, p_jid text, p_caption text, p_path text, p_mime text, p_name text, p_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  label text;
begin
  if not public.is_crm_member(p_team) then
    raise exception 'Só quem está na equipe envia mensagens.' using errcode = '42501';
  end if;
  if p_kind not in ('image', 'video', 'audio', 'voice', 'document') then
    raise exception 'Tipo de arquivo inválido.' using errcode = '22023';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_team::text or split_part(p_path, '/', 2) <> 'saida' then
    raise exception 'Arquivo fora da pasta da equipe.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.crm_whatsapp_chats where team_id = p_team and jid = p_jid) then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  label := case p_kind when 'image' then '[Foto]' when 'video' then '[Vídeo]' when 'audio' then '[Áudio]' when 'voice' then '[Áudio]' else '[Documento]' end;
  insert into public.crm_whatsapp_messages (team_id, chat_jid, from_me, body, kind, status, sent_by, media_path, media_mime, media_name)
  values (p_team, p_jid, true, btrim(label || ' ' || coalesce(p_caption, '')), p_kind, 'queued', auth.uid(), p_path, p_mime, p_name)
  returning id into new_id;
  update public.crm_whatsapp_chats set last_text = btrim(label || ' ' || coalesce(p_caption, '')), last_from_me = true, last_at = now()
  where team_id = p_team and jid = p_jid;
  return new_id;
end
$$;

revoke all on function public.crm_whatsapp_send_media(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.crm_whatsapp_send_media(uuid, text, text, text, text, text, text) to authenticated;
