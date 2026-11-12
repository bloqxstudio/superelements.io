-- Publicar e agendar posts do feed pelo MCP (2026-11-12, o usuário: "quero que consiga fazer postagens com
-- facilidade"; escolheu publicar e agendar com confirmação). A fila dos stories (`crm_stories`, publicada pelo
-- cron em nome de quem aprovou) passa a aceitar `kind = 'feed'`: as telas (1 a 10 imagens JPEG já desenhadas)
-- saem juntas como foto ou carrossel, com a legenda. Story e reels continuam como antes.

alter table public.crm_stories drop constraint if exists crm_stories_kind_check;
alter table public.crm_stories add constraint crm_stories_kind_check check (kind in ('story', 'reel', 'feed'));

create or replace function public.crm_stories_guard_media()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- O servidor (chave de serviço, cron) pode tudo
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' or new.frames is distinct from old.frames then
    if exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(new.frames) = 'array' then new.frames else '[]'::jsonb end) f
      where f ? 'containerId' or f ? 'processingSince' or coalesce(f ->> 'type', 'image') not in ('image', 'video')
    ) then
      raise exception 'Tela com dados que só o servidor grava.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'agendado' and new.kind = 'reel' then
    if jsonb_array_length(new.frames) <> 1 or coalesce(new.frames -> 0 ->> 'type', 'image') <> 'video' then
      raise exception 'O reels é um vídeo só.' using errcode = '23514';
    end if;
  end if;

  -- Post do feed: imagens (foto ou carrossel); vídeo no feed sai como reels
  if new.status = 'agendado' and new.kind = 'feed' then
    if exists (select 1 from jsonb_array_elements(new.frames) f where coalesce(f ->> 'type', 'image') <> 'image') then
      raise exception 'O post do feed pela fila é só de imagens.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
