-- Padrão de design pelo Cérebro (2026-11-07). O usuário: "como podemos ter um padrão de design via
-- cérebro? reaproveitar o design.md, trazer pra cá". O DESIGN.md da conta (crm_account_context.brand_md)
-- passa a ser editado na tela /cerebro (nota marca/DESIGN.md). Só gestor da conta ou o admin da
-- plataforma grava; a equipe continua lendo pela política existente. Não mexe na versão do Plano.

create or replace function public.crm_brand_save(p_team uuid, p_md text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_crm_manager(p_team) or public.crm_is_platform_admin()) then
    raise exception 'Só gestor da conta grava a marca.' using errcode = '42501';
  end if;
  if length(coalesce(p_md, '')) > 20000 then
    raise exception 'O DESIGN.md passa de 20 mil caracteres.' using errcode = '22001';
  end if;
  insert into public.crm_account_context (team_id, brand_md, updated_by, updated_at)
  values (p_team, coalesce(p_md, ''), auth.uid(), now())
  on conflict (team_id) do update set brand_md = excluded.brand_md, updated_at = now();
end;
$$;

revoke all on function public.crm_brand_save(uuid, text) from public;
grant execute on function public.crm_brand_save(uuid, text) to authenticated;
