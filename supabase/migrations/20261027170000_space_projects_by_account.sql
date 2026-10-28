-- Projetos por conta (2026-10-27)
--
-- Um projeto passa a poder pertencer a uma conta (empresa-cliente, `crm_teams`). Quem é
-- da conta abre e edita os projetos dela como editor, sem convite um a um; o dono
-- continua sendo quem criou. Projetos sem conta (`team_id` nulo, todos os de antes)
-- ficam como sempre: do dono e de quem ele convidou, e aparecem na conta da casa (Avence).
--
-- Todas as políticas de projeto, de arquivos do bucket, de conexão do WordPress, de
-- links de aprovação e do canal ao vivo passam por `space_project_role`, então basta
-- ensiná-la a ler a conta: com o módulo "projetos" desligado (ou a conta pausada) ninguém
-- da conta, nem o dono, abre o conteúdo do projeto.

alter table public.space_projects
  add column if not exists team_id uuid references public.crm_teams (id) on delete set null;

create index if not exists space_projects_team_idx on public.space_projects (team_id, updated_at desc);

-- Papel de quem chama no projeto: 'owner', 'editor' ou null (sem acesso)
create or replace function public.space_project_role(p_project uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.team_id is not null and not public.crm_module_on(p.team_id, 'projetos') then null
    when p.owner_id = (select auth.uid()) then 'owner'
    else coalesce(
      (select m.role from public.space_project_members m where m.project_id = p.id and m.user_id = (select auth.uid())),
      case when p.team_id is not null and public.is_crm_member(p.team_id) then 'editor' end
    )
  end
  from public.space_projects p
  where p.id = p_project
$$;

revoke all on function public.space_project_role(uuid) from public;
grant execute on function public.space_project_role(uuid) to authenticated;

-- A conta de um projeto: quem cria só escolhe uma conta onde é membro (o admin da
-- plataforma escolhe qualquer uma); depois de criado, só o admin da plataforma muda.
create or replace function public.space_projects_team_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.team_id is null then
    if tg_op = 'UPDATE' and old.team_id is not null and not public.crm_is_platform_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception 'conta_fixa';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.team_id is not distinct from old.team_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and not public.crm_is_platform_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'conta_fixa';
  end if;
  if tg_op = 'INSERT' and not public.is_crm_member(new.team_id) and not public.crm_is_platform_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'conta_alheia';
  end if;
  return new;
end
$$;

drop trigger if exists space_projects_team_guard on public.space_projects;
create trigger space_projects_team_guard
  before insert or update on public.space_projects
  for each row execute function public.space_projects_team_guard();
