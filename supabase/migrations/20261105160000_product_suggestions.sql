-- Sugestões de melhoria para o time de produto (2026-11-05). O usuário: "um fluxo de enviar uma
-- sugestão de melhoria para o time via Iara… falar algo no campo que queremos melhorar e isso ir
-- para o time de produto, talvez numa planilha". Quem usa fala com a Iara; ela escreve a sugestão
-- com a tela e a conta de onde veio, a pessoa confirma e a linha cai aqui. O time de produto
-- (admin da plataforma) vê tudo em /sugestoes, como planilha, muda o status e exporta CSV.

create table public.product_suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Quem e de onde (cópias: a planilha não depende de a conta ou a pessoa ainda existirem)
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  user_name text not null default '' check (length(user_name) <= 160),
  team_id uuid references public.crm_teams (id) on delete set null,
  team_name text not null default '' check (length(team_name) <= 160),
  screen_path text not null default '' check (length(screen_path) <= 300),
  screen_title text not null default '' check (length(screen_title) <= 200),
  -- O que melhorar
  area text not null default '' check (length(area) <= 120),
  kind text not null default 'melhoria' check (kind in ('melhoria', 'problema', 'ideia')),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 4000),
  impact text not null default '' check (length(impact) <= 1000),
  -- O que a pessoa disse, como disse (a Iara reescreve o título e a descrição)
  original text not null default '' check (length(original) <= 4000),
  via text not null default 'iara' check (via in ('iara', 'tela')),
  -- Do time de produto
  status text not null default 'nova' check (status in ('nova', 'avaliando', 'planejada', 'feita', 'descartada')),
  priority text check (priority is null or priority in ('baixa', 'media', 'alta')),
  product_note text not null default '' check (length(product_note) <= 2000),
  updated_at timestamptz not null default now()
);

create index product_suggestions_created_idx on public.product_suggestions (created_at desc);
create index product_suggestions_user_idx on public.product_suggestions (user_id, created_at desc);

alter table public.product_suggestions enable row level security;

-- Quem enviou vê as suas (e o status); o time de produto vê todas
create policy "Autor lê as suas sugestões" on public.product_suggestions
  for select to authenticated using (user_id = (select auth.uid()) or public.crm_is_platform_admin());

revoke all on public.product_suggestions from anon, authenticated;
grant select on public.product_suggestions to authenticated;

-- Enviar: qualquer pessoa logada; a conta só entra se a pessoa for dela
create or replace function public.product_suggestion_create(p_data jsonb)
returns public.product_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_team uuid;
  v_team_name text := '';
  v_name text;
  v_kind text := coalesce(nullif(p_data ->> 'kind', ''), 'melhoria');
  n integer;
  res public.product_suggestions;
begin
  if me is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object' or coalesce(length(btrim(p_data ->> 'title')), 0) = 0 then
    raise exception 'campo_invalido:titulo';
  end if;
  if v_kind not in ('melhoria', 'problema', 'ideia') then
    v_kind := 'melhoria';
  end if;
  -- Freio: 30 por pessoa por dia
  select count(*) into n from public.product_suggestions where user_id = me and created_at > now() - interval '1 day';
  if n >= 30 then
    raise exception 'limite_sugestoes';
  end if;
  if (p_data ->> 'teamId') ~ '^[0-9a-f-]{36}$' and public.is_crm_member((p_data ->> 'teamId')::uuid) then
    v_team := (p_data ->> 'teamId')::uuid;
    select name into v_team_name from public.crm_teams where id = v_team;
  end if;
  v_name := public.crm_person_name(me);

  insert into public.product_suggestions (user_id, user_name, team_id, team_name, screen_path, screen_title, area, kind, title, description, impact, original, via)
  values (
    me, left(coalesce(v_name, ''), 160), v_team, left(coalesce(v_team_name, ''), 160),
    left(coalesce(p_data ->> 'screenPath', ''), 300), left(coalesce(p_data ->> 'screenTitle', ''), 200),
    left(coalesce(p_data ->> 'area', ''), 120), v_kind, left(btrim(p_data ->> 'title'), 160),
    left(coalesce(p_data ->> 'description', ''), 4000), left(coalesce(p_data ->> 'impact', ''), 1000),
    left(coalesce(p_data ->> 'original', ''), 4000), case when p_data ->> 'via' = 'tela' then 'tela' else 'iara' end
  )
  returning * into res;
  return res;
end
$$;

revoke all on function public.product_suggestion_create(jsonb) from public, anon;
grant execute on function public.product_suggestion_create(jsonb) to authenticated;

-- O time de produto muda status, prioridade e a nota
create or replace function public.product_suggestion_update(p_id uuid, p_status text, p_priority text, p_note text)
returns public.product_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  res public.product_suggestions;
begin
  if not public.crm_is_platform_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('nova', 'avaliando', 'planejada', 'feita', 'descartada') then
    raise exception 'campo_invalido:status';
  end if;
  if p_priority is not null and p_priority not in ('baixa', 'media', 'alta', '') then
    raise exception 'campo_invalido:prioridade';
  end if;
  update public.product_suggestions
     set status = coalesce(p_status, status),
         priority = case when p_priority is null then priority else nullif(p_priority, '') end,
         product_note = coalesce(left(p_note, 2000), product_note),
         updated_at = now()
   where id = p_id
   returning * into res;
  if res.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0002';
  end if;
  return res;
end
$$;

revoke all on function public.product_suggestion_update(uuid, text, text, text) from public, anon;
grant execute on function public.product_suggestion_update(uuid, text, text, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'product_suggestions') then
    alter publication supabase_realtime add table public.product_suggestions;
  end if;
end
$$;
