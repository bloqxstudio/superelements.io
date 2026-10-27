-- WhatsApp da equipe: enviar vídeo, foto, áudio e documento (2026-10-27)
--
-- A pessoa escolhe o arquivo na conversa: o navegador sobe para o bucket
-- `crm-whatsapp` em `<equipe>/saida/…` (só a equipe grava ali) e a função
-- abaixo põe a mensagem na fila com o arquivo ligado. O serviço baixa o
-- arquivo e envia pelo número conectado, com a legenda como texto.

create or replace function public.can_write_crm_whatsapp_out(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  team text := (storage.foldername(p_name))[1];
begin
  if coalesce(team, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if coalesce((storage.foldername(p_name))[2], '') <> 'saida' then
    return false;
  end if;
  return public.is_crm_member(team::uuid);
end
$fn$;

revoke all on function public.can_write_crm_whatsapp_out(text) from public;
grant execute on function public.can_write_crm_whatsapp_out(text) to authenticated;

drop policy if exists "Equipe sobe arquivos para enviar no WhatsApp" on storage.objects;
create policy "Equipe sobe arquivos para enviar no WhatsApp" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'crm-whatsapp' and public.can_write_crm_whatsapp_out(name));

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
  if p_kind not in ('image', 'video', 'audio', 'document') then
    raise exception 'Tipo de arquivo inválido.' using errcode = '22023';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_team::text or split_part(p_path, '/', 2) <> 'saida' then
    raise exception 'Arquivo fora da pasta da equipe.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.crm_whatsapp_chats where team_id = p_team and jid = p_jid) then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  label := case p_kind when 'image' then '[Foto]' when 'video' then '[Vídeo]' when 'audio' then '[Áudio]' else '[Documento]' end;
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
