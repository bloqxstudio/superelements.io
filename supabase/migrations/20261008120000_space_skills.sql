-- Skills do chat dos agentes (2026-10-08)
--
-- Uma skill é um jeito de trabalhar que a pessoa escolhe no chat do canvas
-- (Web designer, SEO, "o meu tipo de site"…): o nome, uma linha do que faz,
-- as instruções que o agente recebe com o pedido e alguns pedidos prontos.
--
-- As 7 padrão ficam no código (src/features/space/chat/skills.ts). Aqui ficam:
--   global:   da equipe, para todas as contas. Só admin cria, muda e apaga,
--             porque as instruções vão para o agente no computador de cada
--             pessoa que escolher a skill.
--   personal: de cada pessoa, só ela vê e usa.

create table public.space_skills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null default 'personal' check (scope in ('global', 'personal')),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  hint text not null default '' check (char_length(hint) <= 200),
  instructions text not null check (char_length(btrim(instructions)) between 1 and 30000),
  starters text[] not null default '{}' check (cardinality(starters) <= 6),
  needs_image boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index space_skills_owner_idx on public.space_skills (owner_id, updated_at desc);
create index space_skills_global_idx on public.space_skills (updated_at desc) where scope = 'global';

alter table public.space_skills enable row level security;

-- Cada um lê as globais e as suas
create policy "Lê as skills globais e as próprias" on public.space_skills
  for select to authenticated
  using (scope = 'global' or owner_id = (select auth.uid()));

-- Pessoal: a própria pessoa. Global: só admin
create policy "Cria skill própria, ou global sendo admin" on public.space_skills
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (scope = 'personal' or public.has_role((select auth.uid()), 'admin'))
  );

create policy "Muda a skill própria, ou global sendo admin" on public.space_skills
  for update to authenticated
  using (
    (scope = 'personal' and owner_id = (select auth.uid()))
    or (scope = 'global' and public.has_role((select auth.uid()), 'admin'))
  )
  with check (
    (scope = 'personal' and owner_id = (select auth.uid()))
    or (scope = 'global' and public.has_role((select auth.uid()), 'admin'))
  );

create policy "Apaga a skill própria, ou global sendo admin" on public.space_skills
  for delete to authenticated
  using (
    (scope = 'personal' and owner_id = (select auth.uid()))
    or (scope = 'global' and public.has_role((select auth.uid()), 'admin'))
  );

-- Quem criou não muda; a data da mudança é do banco
create or replace function public.space_skills_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger space_skills_touch
  before update on public.space_skills
  for each row execute function public.space_skills_touch();
