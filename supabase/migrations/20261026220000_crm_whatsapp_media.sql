-- WhatsApp da equipe: fotos de perfil e mídias das conversas (2026-10-26)
--
-- O serviço baixa a foto de perfil de cada conversa e as fotos, vídeos,
-- áudios e documentos das mensagens, e guarda tudo no bucket privado
-- `crm-whatsapp` (`<equipe>/…`). Só o serviço grava (chave de serviço); quem
-- é da equipe lê, por link temporário.

alter table public.crm_whatsapp_chats
  add column if not exists photo_path text,
  add column if not exists photo_checked_at timestamptz;

alter table public.crm_whatsapp_messages
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_name text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-whatsapp', 'crm-whatsapp', false, 26214400)
on conflict (id) do nothing;

create or replace function public.can_read_crm_whatsapp_file(p_name text)
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
  return public.is_crm_member(team::uuid);
end
$fn$;

revoke all on function public.can_read_crm_whatsapp_file(text) from public;
grant execute on function public.can_read_crm_whatsapp_file(text) to authenticated;

create policy "Equipe lê as mídias do WhatsApp" on storage.objects
  for select to authenticated
  using (bucket_id = 'crm-whatsapp' and public.can_read_crm_whatsapp_file(name));
