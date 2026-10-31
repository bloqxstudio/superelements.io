-- Funis (2026-10-30)
--
-- Um funil liga o caminho da campanha à oportunidade ganha: uma lista ordenada de etapas, cada
-- uma com a fonte que a mede (campanha da Meta, página ou evento do site, formulário, oportunidades
-- do CRM). Aqui só fica a configuração; os números vêm das tabelas de cada fonte, lidas pelo
-- app com o RLS delas. Nada é copiado nem inventado.
-- A equipe lê; gestor e dono criam, editam e apagam.
-- Não depende de crm_forms: a fonte de formulário é só um id guardado em `source`.

create table public.crm_funnels (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  objective text not null default '' check (length(objective) <= 500),
  template text not null default 'custom' check (template in ('captacao', 'prospeccao', 'custom')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_funnels_team_idx on public.crm_funnels (team_id, created_at desc);

create table public.crm_funnel_steps (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.crm_funnels (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  position integer not null check (position >= 0),
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('campaign', 'page', 'event', 'form', 'opportunity', 'stage', 'manual')),
  -- Referência da fonte (conta de anúncios e campanhas, rastreador e caminho, formulários, estado do CRM…)
  source jsonb not null default '{}'::jsonb check (jsonb_typeof(source) = 'object'),
  unique (funnel_id, position)
);

create index crm_funnel_steps_funnel_idx on public.crm_funnel_steps (funnel_id, position);

alter table public.crm_funnels enable row level security;
alter table public.crm_funnel_steps enable row level security;

create policy "Equipe vê os funis" on public.crm_funnels
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor cria funis" on public.crm_funnels
  for insert to authenticated with check (public.is_crm_manager(team_id));
create policy "Gestor edita funis" on public.crm_funnels
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id));
create policy "Gestor apaga funis" on public.crm_funnels
  for delete to authenticated using (public.is_crm_manager(team_id));

create policy "Equipe vê as etapas dos funis" on public.crm_funnel_steps
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor cria etapas" on public.crm_funnel_steps
  for insert to authenticated with check (public.is_crm_manager(team_id));
create policy "Gestor edita etapas" on public.crm_funnel_steps
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id));
create policy "Gestor apaga etapas" on public.crm_funnel_steps
  for delete to authenticated using (public.is_crm_manager(team_id));

-- A conta do funil não muda; a da etapa vem sempre do funil, nunca do corpo da requisição
create or replace function public.crm_funnel_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.team_id is distinct from old.team_id then
    raise exception 'O funil não muda de conta.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end
$$;

create trigger crm_funnels_guard before update on public.crm_funnels
  for each row execute function public.crm_funnel_guard();

create or replace function public.crm_funnel_step_team()
returns trigger
language plpgsql
as $$
begin
  select f.team_id into new.team_id from public.crm_funnels f where f.id = new.funnel_id;
  if new.team_id is null then
    raise exception 'Funil não encontrado.' using errcode = '23503';
  end if;
  return new;
end
$$;

create trigger crm_funnel_steps_team before insert or update of funnel_id on public.crm_funnel_steps
  for each row execute function public.crm_funnel_step_team();

-- Grava o funil e troca a lista de etapas de uma vez (tudo ou nada). Roda com o RLS de quem chama:
-- quem não é gestor da conta não cria nem altera.
create or replace function public.crm_save_funnel(p_id uuid, p_team uuid, p_name text, p_objective text, p_template text, p_steps jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  fid uuid := p_id;
  n integer;
begin
  if jsonb_typeof(p_steps) is distinct from 'array' then
    raise exception 'As etapas precisam ser uma lista.' using errcode = '22023';
  end if;
  n := jsonb_array_length(p_steps);
  if n < 2 or n > 12 then
    raise exception 'Um funil tem de 2 a 12 etapas.' using errcode = '22023';
  end if;

  if fid is null then
    insert into public.crm_funnels (team_id, name, objective, template)
    values (p_team, p_name, coalesce(p_objective, ''), coalesce(p_template, 'custom'))
    returning id into fid;
  else
    update public.crm_funnels set name = p_name, objective = coalesce(p_objective, ''), template = coalesce(p_template, template)
    where id = fid and team_id = p_team;
    if not found then
      raise exception 'Funil não encontrado ou sem permissão.' using errcode = '42501';
    end if;
    delete from public.crm_funnel_steps where funnel_id = fid;
  end if;

  insert into public.crm_funnel_steps (funnel_id, team_id, position, name, kind, source)
  select fid, p_team, (e.ord - 1)::integer, e.value ->> 'name', e.value ->> 'kind', coalesce(e.value -> 'source', '{}'::jsonb)
  from jsonb_array_elements(p_steps) with ordinality as e(value, ord);

  return fid;
end
$$;

revoke all on function public.crm_save_funnel(uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.crm_save_funnel(uuid, uuid, text, text, text, jsonb) to authenticated;
