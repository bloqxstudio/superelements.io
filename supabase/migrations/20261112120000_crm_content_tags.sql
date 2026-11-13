-- Tipos de conteúdo na Pauta (2026-11-12): tags por conta (Educativo, Família, Produto novo, Evento...),
-- com cor, visíveis nos cards do calendário. O catálogo é da conta; cada conteúdo guarda os ids.
-- Mudar as tags não mexe no texto, na versão nem nas aprovações.

create table if not exists public.crm_content_tags (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default 'violet' check (color in ('violet', 'sky', 'emerald', 'amber', 'rose', 'orange', 'teal', 'slate')),
  position integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists crm_content_tags_team_name on public.crm_content_tags (team_id, lower(btrim(name)));

alter table public.crm_content_tags enable row level security;

drop policy if exists "Membros leem os tipos de conteúdo" on public.crm_content_tags;
create policy "Membros leem os tipos de conteúdo" on public.crm_content_tags
  for select to authenticated using (public.is_crm_member(team_id) and public.crm_module_on(team_id, 'copy'));

revoke all on public.crm_content_tags from anon;
grant select on public.crm_content_tags to authenticated;

alter table public.crm_contents add column if not exists tag_ids uuid[] not null default '{}';

-- Criar ou renomear/mudar a cor de um tipo (qualquer pessoa da equipe)
create or replace function public.crm_content_tag_save(p_team uuid, p_id uuid, p_name text, p_color text)
returns public.crm_content_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.crm_v2_require(p_team, false);
  v_name text := btrim(coalesce(p_name, ''));
  v_color text := coalesce(nullif(p_color, ''), 'violet');
  res public.crm_content_tags;
begin
  if char_length(v_name) not between 1 and 40 then
    raise exception 'campo_invalido:nome';
  end if;
  if v_color not in ('violet', 'sky', 'emerald', 'amber', 'rose', 'orange', 'teal', 'slate') then
    raise exception 'campo_invalido:cor';
  end if;
  if exists (select 1 from public.crm_content_tags where team_id = p_team and lower(btrim(name)) = lower(v_name) and id is distinct from p_id) then
    raise exception 'tag_repetida';
  end if;
  if p_id is null then
    if (select count(*) from public.crm_content_tags where team_id = p_team) >= 40 then
      raise exception 'limite_tags';
    end if;
    insert into public.crm_content_tags (team_id, name, color, position, created_by)
    values (p_team, v_name, v_color, coalesce((select max(position) + 1 from public.crm_content_tags where team_id = p_team), 0), me)
    returning * into res;
  else
    update public.crm_content_tags set name = v_name, color = v_color
     where id = p_id and team_id = p_team
     returning * into res;
    if res.id is null then
      raise exception 'nao_encontrado' using errcode = 'P0002';
    end if;
  end if;
  return res;
end
$$;

-- Apagar um tipo: some também dos conteúdos
create or replace function public.crm_content_tag_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from public.crm_content_tags where id = p_id;
  if v_team is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.crm_v2_require(v_team, false);
  update public.crm_contents set tag_ids = array_remove(tag_ids, p_id), updated_at = now()
   where team_id = v_team and p_id = any(tag_ids);
  delete from public.crm_content_tags where id = p_id;
end
$$;

-- Os tipos de um conteúdo (até 5, todos da mesma conta)
create or replace function public.crm_content_set_tags(p_id uuid, p_tags uuid[])
returns public.crm_contents
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.crm_contents;
  v_tags uuid[];
  res public.crm_contents;
begin
  select * into cur from public.crm_contents where id = p_id;
  if cur.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.crm_v2_require(cur.team_id, false);
  select coalesce(array_agg(distinct t), '{}') into v_tags from unnest(coalesce(p_tags, '{}')) t;
  if cardinality(v_tags) > 5 then
    raise exception 'limite_tags';
  end if;
  if exists (select 1 from unnest(v_tags) t where not exists (select 1 from public.crm_content_tags g where g.id = t and g.team_id = cur.team_id)) then
    raise exception 'campo_invalido:tag';
  end if;
  -- mantém a ordem do catálogo
  select coalesce(array_agg(g.id order by g.position, g.created_at), '{}') into v_tags
    from public.crm_content_tags g where g.id = any(v_tags);
  update public.crm_contents set tag_ids = v_tags, updated_at = now()
   where id = p_id
   returning * into res;
  return res;
end
$$;

revoke all on function public.crm_content_tag_save(uuid, uuid, text, text) from public, anon;
revoke all on function public.crm_content_tag_delete(uuid) from public, anon;
revoke all on function public.crm_content_set_tags(uuid, uuid[]) from public, anon;
grant execute on function public.crm_content_tag_save(uuid, uuid, text, text) to authenticated;
grant execute on function public.crm_content_tag_delete(uuid) to authenticated;
grant execute on function public.crm_content_set_tags(uuid, uuid[]) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_content_tags') then
    alter publication supabase_realtime add table public.crm_content_tags;
  end if;
end
$$;
