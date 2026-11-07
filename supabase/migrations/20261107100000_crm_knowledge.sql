-- Cérebro da conta (2026-11-07). O usuário: "não precisa vincular ao github, podemos apenas mostrar
-- aqui os arquivos da conta, como se fosse uma base de conhecimento interna do app… marca, quem é, o
-- que vende, qual produto, as fotos dos produtos, fotos que criamos na plataforma… somente daquela
-- empresa". Cada conta tem as notas dela (Markdown, por caminho) nesta tabela; os arquivos (fotos,
-- vídeos, PDFs) ficam no bucket space-projects em crm/<conta>/cerebro/<caminho>, que já é da equipe
-- pelas políticas de can_use_crm_file. Membros leem e escrevem; só gestor apaga nota.

create table if not exists public.crm_knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams(id) on delete cascade,
  path text not null,
  content text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_knowledge_notes_path check (
    path ~ '^[A-Za-z0-9À-ÿ _().,&+-]+(/[A-Za-z0-9À-ÿ _().,&+-]+)*\.md$'
    and path !~ '(^|/)\.' and length(path) <= 300
  ),
  constraint crm_knowledge_notes_size check (length(content) <= 400000),
  unique (team_id, path)
);

create index if not exists crm_knowledge_notes_team_idx on public.crm_knowledge_notes (team_id, updated_at desc);

alter table public.crm_knowledge_notes enable row level security;

drop policy if exists "Equipe lê o cérebro" on public.crm_knowledge_notes;
create policy "Equipe lê o cérebro" on public.crm_knowledge_notes
  for select to authenticated using (public.is_crm_member(team_id));

drop policy if exists "Equipe escreve no cérebro" on public.crm_knowledge_notes;
create policy "Equipe escreve no cérebro" on public.crm_knowledge_notes
  for insert to authenticated with check (public.is_crm_member(team_id));

drop policy if exists "Equipe edita o cérebro" on public.crm_knowledge_notes;
create policy "Equipe edita o cérebro" on public.crm_knowledge_notes
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));

drop policy if exists "Gestor apaga nota do cérebro" on public.crm_knowledge_notes;
create policy "Gestor apaga nota do cérebro" on public.crm_knowledge_notes
  for delete to authenticated using (public.is_crm_manager(team_id));

-- Quem gravou e quando: sempre do servidor
create or replace function public.crm_knowledge_touch()
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
  end if;
  return new;
end;
$$;

drop trigger if exists crm_knowledge_touch on public.crm_knowledge_notes;
create trigger crm_knowledge_touch before insert or update on public.crm_knowledge_notes
  for each row execute function public.crm_knowledge_touch();

grant select, insert, update, delete on public.crm_knowledge_notes to authenticated;

alter table public.crm_knowledge_notes replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'crm_knowledge_notes') then
    alter publication supabase_realtime add table public.crm_knowledge_notes;
  end if;
end $$;
