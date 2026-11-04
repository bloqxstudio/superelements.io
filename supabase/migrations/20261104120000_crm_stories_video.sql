-- Motion na fila de publicação: além das imagens, o story pode ser um vídeo
-- (o MP4 que o estúdio de motion gera no navegador) e a fila passa a
-- programar reels, com legenda. As telas ganham `type` ('image' ou 'video');
-- só o servidor grava `containerId`/`processingSince` (o vídeo que a Meta
-- ainda processa, retomado no minuto seguinte sem criar outro contêiner).

alter table public.crm_stories
  add column if not exists kind text not null default 'story',
  add column if not exists caption text not null default '',
  add column if not exists share_to_feed boolean not null default true;

alter table public.crm_stories drop constraint if exists crm_stories_kind_check;
alter table public.crm_stories add constraint crm_stories_kind_check check (kind in ('story', 'reel'));
alter table public.crm_stories drop constraint if exists crm_stories_caption_check;
alter table public.crm_stories add constraint crm_stories_caption_check check (char_length(caption) <= 2200);

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
  return new;
end;
$$;

drop trigger if exists crm_stories_guard_media on public.crm_stories;
create trigger crm_stories_guard_media
  before insert or update on public.crm_stories
  for each row execute function public.crm_stories_guard_media();
