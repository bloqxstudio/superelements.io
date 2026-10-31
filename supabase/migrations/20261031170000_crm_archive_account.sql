-- Excluir conta passa a ARQUIVAR: nada é apagado, a conta sai da lista e dos menus e fica
-- pausada (módulos, formulários públicos, tracker e webhooks param). Restaurar é um clique.
-- A exclusão definitiva só vale para conta arquivada há 30 dias ou mais.
alter table public.crm_teams add column if not exists archived_at timestamptz;

create or replace function public.crm_teams_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.modules is distinct from old.modules or new.status is distinct from old.status or new.is_home is distinct from old.is_home
      or new.archived_at is distinct from old.archived_at)
     and not public.crm_is_platform_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'so_admin_da_plataforma';
  end if;
  return new;
end
$$;

drop function if exists public.crm_delete_account(uuid);

create or replace function public.crm_archive_account(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.crm_is_platform_admin() then raise exception 'so_admin_da_plataforma'; end if;
  if not exists (select 1 from public.crm_teams where id = p_team) then raise exception 'conta_inexistente'; end if;
  if exists (select 1 from public.crm_teams where id = p_team and is_home) then raise exception 'conta_casa_nao_exclui'; end if;
  update public.crm_teams set status = 'pausada', archived_at = coalesce(archived_at, now()) where id = p_team;
end
$$;

create or replace function public.crm_restore_account(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.crm_is_platform_admin() then raise exception 'so_admin_da_plataforma'; end if;
  if not exists (select 1 from public.crm_teams where id = p_team) then raise exception 'conta_inexistente'; end if;
  -- Volta pausada: quem restaura reativa de propósito depois de conferir
  update public.crm_teams set archived_at = null where id = p_team;
end
$$;

create or replace function public.crm_purge_account(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  since timestamptz;
begin
  if not public.crm_is_platform_admin() then raise exception 'so_admin_da_plataforma'; end if;
  select archived_at into since from public.crm_teams where id = p_team and not is_home;
  if since is null then raise exception 'conta_nao_arquivada'; end if;
  if since > now() - interval '30 days' then raise exception 'arquivo_recente'; end if;
  delete from public.space_projects where team_id = p_team;
  delete from public.crm_teams where id = p_team;
end
$$;

-- Conta arquivada não se reativa sem restaurar antes
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
  if p_status = 'ativa' and exists (select 1 from public.crm_teams where id = p_team and archived_at is not null) then
    raise exception 'conta_arquivada';
  end if;
  update public.crm_teams set status = p_status where id = p_team;
end
$$;

drop function if exists public.crm_accounts_overview();
create function public.crm_accounts_overview()
returns table (
  id uuid, name text, segment text, website text, contact_name text, contact_email text, contact_phone text,
  notes text, status text, modules jsonb, is_home boolean, created_at timestamptz, members integer, i_am_member boolean,
  archived_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.segment, t.website, t.contact_name, t.contact_email, t.contact_phone, t.notes, t.status,
         t.modules, t.is_home, t.created_at,
         (select count(*)::integer from public.crm_team_members m where m.team_id = t.id),
         exists (select 1 from public.crm_team_members m where m.team_id = t.id and m.user_id = (select auth.uid())),
         t.archived_at
  from public.crm_teams t
  where public.crm_is_platform_admin()
  order by t.is_home desc, t.created_at asc
$$;

revoke all on function public.crm_archive_account(uuid), public.crm_restore_account(uuid), public.crm_purge_account(uuid), public.crm_accounts_overview() from public;
grant execute on function public.crm_archive_account(uuid), public.crm_restore_account(uuid), public.crm_purge_account(uuid), public.crm_accounts_overview() to authenticated;
