-- Contas (empresas-cliente) e módulos por conta (2026-10-27)
--
-- A equipe do CRM passa a ser a CONTA do produto: uma empresa com as suas pessoas,
-- os seus dados e os módulos que a Avence, como admin da plataforma, deixa ligados.
-- Quem tem mais de uma conta troca de ambiente por um seletor no menu lateral.
--
--   * cadastro básico da conta (segmento, site, contato) em `crm_teams`;
--   * `modules`: {"instagram": false} desliga; o que não está na lista fica ligado;
--   * `status`: uma conta pausada fica com todos os módulos desligados (a Equipe segue);
--   * só o admin da plataforma (user_roles) cria conta, liga e desliga módulos e pausa;
--   * o admin da plataforma entra numa conta para dar suporte (`crm_support_access`);
--   * os módulos com dados próprios (instagram, whatsapp, site) também são barrados no
--     banco: uma política restritiva nega leitura e escrita da equipe quando o módulo
--     está desligado (as funções do servidor, com a chave de serviço, não passam por RLS).

-- ---------- cadastro e módulos ----------

alter table public.crm_teams
  add column if not exists segment text not null default '' check (char_length(segment) <= 120),
  add column if not exists website text not null default '' check (char_length(website) <= 200),
  add column if not exists contact_name text not null default '' check (char_length(contact_name) <= 120),
  add column if not exists contact_email text not null default '' check (char_length(contact_email) <= 160),
  add column if not exists contact_phone text not null default '' check (char_length(contact_phone) <= 40),
  add column if not exists notes text not null default '' check (char_length(notes) <= 2000),
  add column if not exists status text not null default 'ativa' check (status in ('ativa', 'pausada')),
  add column if not exists modules jsonb not null default '{}'::jsonb check (jsonb_typeof(modules) = 'object'),
  add column if not exists is_home boolean not null default false;

-- A conta da própria Avence (a mais antiga) é a "casa": os projetos antigos e o que não
-- tem dono de conta ficam com ela. Só pode haver uma.
update public.crm_teams set is_home = true
where id = (select id from public.crm_teams order by created_at asc limit 1)
  and not exists (select 1 from public.crm_teams where is_home);
create unique index if not exists crm_teams_one_home on public.crm_teams ((true)) where is_home;

-- Os módulos que existem (a Equipe e a Conta ficam sempre ligadas)
create or replace function public.crm_known_modules()
returns text[]
language sql
immutable
as $$
  select array['projetos', 'agentes', 'copy', 'criativos', 'skills', 'crm', 'whatsapp', 'instagram', 'site']
$$;

create or replace function public.crm_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role((select auth.uid()), 'admin'), false)
$$;

revoke all on function public.crm_is_platform_admin() from public;
grant execute on function public.crm_is_platform_admin() to authenticated;

-- O módulo está ligado para a conta? Conta pausada: tudo desligado.
create or replace function public.crm_module_on(p_team uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select t.status = 'ativa' and coalesce((t.modules ->> p_module)::boolean, true)
       from public.crm_teams t where t.id = p_team),
    false)
$$;

revoke all on function public.crm_module_on(uuid, text) from public;
grant execute on function public.crm_module_on(uuid, text) to authenticated;

-- Quem não é admin da plataforma não mexe em módulos, status nem na conta-casa,
-- nem direto na tabela (o gestor da conta renomeia e atualiza o cadastro, só isso).
-- Sem security definer de propósito: `current_user` precisa ser quem chamou (authenticated,
-- service_role ou postgres no editor de SQL) e não o dono da função.
create or replace function public.crm_teams_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.modules is distinct from old.modules or new.status is distinct from old.status or new.is_home is distinct from old.is_home)
     and not public.crm_is_platform_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'so_admin_da_plataforma';
  end if;
  return new;
end
$$;

drop trigger if exists crm_teams_guard on public.crm_teams;
create trigger crm_teams_guard before update on public.crm_teams
  for each row execute function public.crm_teams_guard();

-- O admin da plataforma enxerga todas as contas, mesmo as que não são dele
drop policy if exists "Admin da plataforma vê as contas" on public.crm_teams;
create policy "Admin da plataforma vê as contas" on public.crm_teams
  for select to authenticated using (public.crm_is_platform_admin());

-- ---------- criar, ligar e desligar ----------

-- Conta nova, com o cadastro básico e os módulos que já nascem ligados.
-- p_modules: {"projetos": true, "instagram": false, ...}; o que falta fica ligado.
create or replace function public.create_crm_account(
  p_name text,
  p_segment text default '',
  p_website text default '',
  p_contact_name text default '',
  p_contact_email text default '',
  p_contact_phone text default '',
  p_modules jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  team uuid;
  clean jsonb := '{}'::jsonb;
  k text;
begin
  if uid is null then
    raise exception 'login_necessario';
  end if;
  if not public.crm_is_platform_admin() then
    raise exception 'so_admin_cria_equipe';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'nome_obrigatorio';
  end if;
  for k in select jsonb_object_keys(coalesce(p_modules, '{}'::jsonb)) loop
    if k = any (public.crm_known_modules()) and jsonb_typeof(p_modules -> k) = 'boolean' then
      clean := clean || jsonb_build_object(k, p_modules -> k);
    end if;
  end loop;
  insert into public.crm_teams (name, segment, website, contact_name, contact_email, contact_phone, modules, created_by)
  values (btrim(p_name), left(btrim(coalesce(p_segment, '')), 120), left(btrim(coalesce(p_website, '')), 200),
          left(btrim(coalesce(p_contact_name, '')), 120), left(btrim(coalesce(p_contact_email, '')), 160),
          left(btrim(coalesce(p_contact_phone, '')), 40), clean, uid)
  returning id into team;
  insert into public.crm_team_members (team_id, user_id, role) values (team, uid, 'owner');
  insert into public.crm_pipelines (team_id, name) values (team, 'Prospecção');
  return team;
end
$$;

revoke all on function public.create_crm_account(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_crm_account(text, text, text, text, text, text, jsonb) to authenticated;

-- Liga e desliga módulos (só o admin da plataforma). Chaves desconhecidas são ignoradas.
create or replace function public.crm_set_modules(p_team uuid, p_modules jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  merged jsonb;
  k text;
begin
  if not public.crm_is_platform_admin() then
    raise exception 'so_admin_da_plataforma';
  end if;
  select modules into merged from public.crm_teams where id = p_team;
  if merged is null then
    raise exception 'conta_inexistente';
  end if;
  for k in select jsonb_object_keys(coalesce(p_modules, '{}'::jsonb)) loop
    if k = any (public.crm_known_modules()) and jsonb_typeof(p_modules -> k) = 'boolean' then
      merged := merged || jsonb_build_object(k, p_modules -> k);
    end if;
  end loop;
  update public.crm_teams set modules = merged where id = p_team;
  return merged;
end
$$;

revoke all on function public.crm_set_modules(uuid, jsonb) from public;
grant execute on function public.crm_set_modules(uuid, jsonb) to authenticated;

-- Pausa e reativa a conta (só o admin da plataforma); a conta-casa não pausa
create or replace function public.crm_set_account_status(p_team uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.crm_is_platform_admin() then
    raise exception 'so_admin_da_plataforma';
  end if;
  if p_status not in ('ativa', 'pausada') then
    raise exception 'status_invalido';
  end if;
  if p_status = 'pausada' and exists (select 1 from public.crm_teams where id = p_team and is_home) then
    raise exception 'conta_casa_nao_pausa';
  end if;
  update public.crm_teams set status = p_status where id = p_team;
end
$$;

revoke all on function public.crm_set_account_status(uuid, text) from public;
grant execute on function public.crm_set_account_status(uuid, text) to authenticated;

-- Todas as contas com quantas pessoas têm e se quem chama já está dentro (painel "Contas")
create or replace function public.crm_accounts_overview()
returns table (
  id uuid, name text, segment text, website text, contact_name text, contact_email text, contact_phone text,
  notes text, status text, modules jsonb, is_home boolean, created_at timestamptz, members integer, i_am_member boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.segment, t.website, t.contact_name, t.contact_email, t.contact_phone, t.notes, t.status,
         t.modules, t.is_home, t.created_at,
         (select count(*)::integer from public.crm_team_members m where m.team_id = t.id),
         exists (select 1 from public.crm_team_members m where m.team_id = t.id and m.user_id = (select auth.uid()))
  from public.crm_teams t
  where public.crm_is_platform_admin()
  order by t.is_home desc, t.created_at asc
$$;

revoke all on function public.crm_accounts_overview() from public;
grant execute on function public.crm_accounts_overview() to authenticated;

-- O admin da plataforma entra numa conta para dar suporte (papel de gestor, não de dono)
create or replace function public.crm_support_access(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not public.crm_is_platform_admin() then
    raise exception 'so_admin_da_plataforma';
  end if;
  if not exists (select 1 from public.crm_teams where id = p_team) then
    raise exception 'conta_inexistente';
  end if;
  insert into public.crm_team_members (team_id, user_id, role, invited_by)
  values (p_team, uid, 'admin', uid)
  on conflict (team_id, user_id) do nothing;
end
$$;

revoke all on function public.crm_support_access(uuid) from public;
grant execute on function public.crm_support_access(uuid) to authenticated;

-- ---------- barreira no banco para os módulos com dados próprios ----------
-- Política restritiva: soma-se às existentes (todas precisam passar). Só entra onde a
-- tabela existe e tem team_id, então a migração não quebra se algum módulo ainda não
-- estiver no banco. Quem escreve com a chave de serviço (funções, o serviço do WhatsApp)
-- não passa por RLS e precisa checar o módulo por conta própria.

do $$
declare
  spec text[];
  t text;
  m text;
  specs text[][] := array[
    ['instagram', 'crm_instagram_accounts'], ['instagram', 'crm_instagram_comments'], ['instagram', 'crm_instagram_daily'],
    ['instagram', 'crm_instagram_dms'], ['instagram', 'crm_instagram_media'], ['instagram', 'crm_instagram_threads'],
    ['instagram', 'crm_stories'], ['instagram', 'crm_ad_accounts'], ['instagram', 'crm_ad_reports'],
    ['whatsapp', 'crm_whatsapp_chats'], ['whatsapp', 'crm_whatsapp_messages'], ['whatsapp', 'crm_whatsapp_numbers'],
    ['whatsapp', 'crm_whatsapp_commanders'], ['whatsapp', 'crm_flows'], ['whatsapp', 'crm_flow_runs'],
    ['site', 'site_trackers'], ['site', 'site_sessions'], ['site', 'site_events']
  ];
begin
  foreach spec slice 1 in array specs loop
    m := spec[1];
    t := spec[2];
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'team_id') then
      execute format('drop policy if exists %I on public.%I', 'Módulo ' || m || ' ligado', t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.crm_module_on(team_id, %L)) with check (public.crm_module_on(team_id, %L))',
        'Módulo ' || m || ' ligado', t, m, m);
    end if;
  end loop;
end
$$;
