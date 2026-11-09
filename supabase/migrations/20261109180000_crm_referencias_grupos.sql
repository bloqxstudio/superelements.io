-- Referências que chegam sozinhas de um grupo do Instagram (2026-11-09).
--
-- O usuário: "temos um grupo no Instagram, enviamos lá as referências. Poderia ter um grupo pra cada projeto
-- e enviar nesse grupo e aí já criar tudo? Já deixar identificar, entender o que é cada criativo e tabular
-- ele… pode ser direto, enviando o link, abrindo um navegador, abrindo Instagram e salvando os dados, com
-- comandos de ver novos, rotinas… pode usar a conta pessoal… pode usar o Mac conectado"; e, perguntado
-- sobre os riscos (termos da Meta, bloqueio da conta pessoal, a regra de não raspar), escolheu este caminho:
-- "vamos na linha de usar o Mac pra isso, porque não temos hoje a API oficial e as referências estão no
-- Instagram mesmo". Decisão registrada em AGENTS.md e cerebro/iniciativas/superelements/decisoes.md.
--
-- Cada conta cadastra os grupos (o endereço instagram.com/direct/t/<id>). O serviço do Mac
-- (`services/referencias`), logado na conta pessoal num Chrome próprio, lê só esses grupos, abre cada post
-- novo, guarda a capa e alguns quadros no Cérebro da conta, a IA classifica e a referência é criada.

create table if not exists public.crm_reference_sources (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  thread_url text not null check (thread_url ~ '^https://www\.instagram\.com/direct/t/[0-9]{5,40}/$'),
  enabled boolean not null default true,
  -- A rotina: de quanto em quanto tempo o Mac olha o grupo (30 min a 24 h)
  every_minutes integer not null default 60 check (every_minutes between 30 and 1440),
  -- "Ver novas agora": a tela pede, o Mac atende na próxima volta
  run_requested_at timestamptz,
  last_run_at timestamptz,
  last_found integer,
  last_error text check (last_error is null or length(last_error) <= 300),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (team_id, thread_url)
);

create index if not exists crm_reference_sources_team_idx on public.crm_reference_sources (team_id);

alter table public.crm_reference_sources enable row level security;
drop policy if exists "Equipe lê os grupos de referência" on public.crm_reference_sources;
create policy "Equipe lê os grupos de referência" on public.crm_reference_sources
  for select to authenticated using (public.is_crm_member(team_id));
drop policy if exists "Equipe cadastra grupos de referência" on public.crm_reference_sources;
create policy "Equipe cadastra grupos de referência" on public.crm_reference_sources
  for insert to authenticated with check (public.is_crm_member(team_id));
drop policy if exists "Equipe muda grupos de referência" on public.crm_reference_sources;
create policy "Equipe muda grupos de referência" on public.crm_reference_sources
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
drop policy if exists "Equipe tira grupos de referência" on public.crm_reference_sources;
create policy "Equipe tira grupos de referência" on public.crm_reference_sources
  for delete to authenticated using (public.is_crm_member(team_id));

-- O que o Mac leu de cada post
alter table public.crm_references add column if not exists source_id uuid references public.crm_reference_sources (id) on delete set null;
alter table public.crm_references add column if not exists author text check (author is null or author ~ '^[A-Za-z0-9._]{1,30}$');
alter table public.crm_references add column if not exists caption text check (caption is null or length(caption) <= 2200);
-- Quadros e slides guardados no Cérebro (`referencias/…`), além da capa em media_path
alter table public.crm_references add column if not exists frames text[] not null default '{}' check (cardinality(frames) <= 12);
-- Lida e classificada pelo Mac (sem revisão da equipe ainda)
alter table public.crm_references add column if not exists auto boolean not null default false;
alter table public.crm_references add column if not exists reviewed boolean not null default true;
