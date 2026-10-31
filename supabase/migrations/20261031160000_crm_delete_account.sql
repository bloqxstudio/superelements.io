-- Exclui uma conta-cliente por inteiro (só o admin da plataforma; nunca a conta da casa).
-- Os projetos da conta são apagados junto (com a conexão WordPress, links e acessos em
-- cascata); os dados do CRM, Instagram, WhatsApp e site saem pelas chaves da própria conta.
create or replace function public.crm_delete_account(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  home boolean;
begin
  if not public.crm_is_platform_admin() then
    raise exception 'so_admin_da_plataforma';
  end if;
  select is_home into home from public.crm_teams where id = p_team;
  if not found then
    raise exception 'conta_inexistente';
  end if;
  if home then
    raise exception 'conta_casa_nao_exclui';
  end if;
  delete from public.space_projects where team_id = p_team;
  delete from public.crm_teams where id = p_team;
end
$$;

revoke all on function public.crm_delete_account(uuid) from public;
grant execute on function public.crm_delete_account(uuid) to authenticated;
