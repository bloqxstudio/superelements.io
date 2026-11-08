-- Quadros (2026-11-07). O usuário: "quero ter uma ferramenta estilo miro dentro do produto, uma aba
-- aonde vamos ter um canva livre exatamente como miro / figjam. Vamos conseguir planejar, criar ideias
-- rápidas e visuais". Cada conta tem os seus quadros; a cena (elementos do Excalidraw, sem as imagens)
-- fica em `scene`; as imagens e a miniatura ficam no bucket space-projects em crm/<conta>/quadros/<id>/,
-- que já é da equipe pelas políticas de can_use_crm_file. `rev` sobe a cada gravação da cena: quem grava
-- manda a rev que leu e, se outra pessoa gravou antes, junta as duas versões e grava de novo.
-- Membros leem, criam e editam; apaga quem criou ou o gestor.

create table if not exists public.crm_boards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams(id) on delete cascade,
  title text not null default 'Quadro sem título',
  scene jsonb not null default '{"elements": []}'::jsonb,
  rev integer not null default 0,
  thumb_path text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_boards_title check (length(btrim(title)) between 1 and 120),
  constraint crm_boards_scene_size check (pg_column_size(scene) <= 8000000)
);

create index if not exists crm_boards_team_idx on public.crm_boards (team_id, updated_at desc);

alter table public.crm_boards enable row level security;

drop policy if exists "Equipe lê os quadros" on public.crm_boards;
create policy "Equipe lê os quadros" on public.crm_boards
  for select to authenticated using (public.is_crm_member(team_id));

drop policy if exists "Equipe cria quadros" on public.crm_boards;
create policy "Equipe cria quadros" on public.crm_boards
  for insert to authenticated with check (public.is_crm_member(team_id));

drop policy if exists "Equipe edita os quadros" on public.crm_boards;
create policy "Equipe edita os quadros" on public.crm_boards
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));

drop policy if exists "Quem criou ou o gestor apaga o quadro" on public.crm_boards;
create policy "Quem criou ou o gestor apaga o quadro" on public.crm_boards
  for delete to authenticated using (created_by = auth.uid() or public.is_crm_manager(team_id));

-- Quem gravou, quando e a revisão: sempre do servidor
create or replace function public.crm_boards_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    new.team_id := old.team_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.rev := case when new.scene is distinct from old.scene then old.rev + 1 else old.rev end;
  else
    new.rev := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_boards_touch on public.crm_boards;
create trigger crm_boards_touch before insert or update on public.crm_boards
  for each row execute function public.crm_boards_touch();

grant select, insert, update, delete on public.crm_boards to authenticated;

-- Ao vivo: quem é da conta entra no canal privado `crm-board:<id>` do quadro (cursores, quem está
-- junto e as mudanças dos elementos enquanto se desenha). As gravações continuam na tabela.
create or replace function public.can_join_crm_board_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  if p_topic !~ '^crm-board:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  select team_id into v_team from public.crm_boards where id = substring(p_topic from 11)::uuid;
  return v_team is not null and public.is_crm_member(v_team);
end
$$;

revoke all on function public.can_join_crm_board_topic(text) from public;
grant execute on function public.can_join_crm_board_topic(text) to authenticated;

do $$
begin
  drop policy if exists "Equipe ouve o canal do quadro" on realtime.messages;
  create policy "Equipe ouve o canal do quadro" on realtime.messages
    for select to authenticated
    using (realtime.messages.extension in ('broadcast', 'presence') and public.can_join_crm_board_topic((select realtime.topic())));
  drop policy if exists "Equipe fala no canal do quadro" on realtime.messages;
  create policy "Equipe fala no canal do quadro" on realtime.messages
    for insert to authenticated
    with check (realtime.messages.extension in ('broadcast', 'presence') and public.can_join_crm_board_topic((select realtime.topic())));
exception
  when undefined_table or undefined_function or invalid_schema_name then
    raise notice 'Realtime sem autorização neste projeto: quadro sem o ao vivo';
end
$$;
