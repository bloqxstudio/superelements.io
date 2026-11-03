-- Produto de cada conta (2026-11-02). A plataforma passa a ter produtos separados:
--   completo   = tudo (a Avence e as contas de antes);
--   resultados = Sinfy: anúncios, site, leads, conversas (o caminho do anúncio à venda);
--   builder    = SuperElements: sites no Space, criativos, textos e agentes.
-- O produto decide o menu e os módulos que a conta recebe ao ser criada ou trocada;
-- os módulos continuam sendo o que libera (ou barra) cada área, no banco e nas telas.

alter table public.crm_teams
  add column if not exists product text not null default 'completo';

alter table public.crm_teams drop constraint if exists crm_teams_product_check;
alter table public.crm_teams
  add constraint crm_teams_product_check check (product in ('completo', 'resultados', 'builder'));

-- Só o admin da plataforma (ou o servidor) muda o produto, como os módulos
create or replace function public.crm_teams_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if (new.modules is distinct from old.modules or new.status is distinct from old.status or new.is_home is distinct from old.is_home
      or new.archived_at is distinct from old.archived_at or new.product is distinct from old.product)
     and not public.crm_is_platform_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'so_admin_da_plataforma';
  end if;
  return new;
end
$function$;

create or replace function public.crm_set_product(p_team uuid, p_product text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  home boolean;
begin
  if not public.crm_is_platform_admin() then
    raise exception 'so_admin_da_plataforma';
  end if;
  if p_product not in ('completo', 'resultados', 'builder') then
    raise exception 'produto_invalido';
  end if;
  select is_home into home from public.crm_teams where id = p_team;
  if home is null then
    raise exception 'conta_inexistente';
  end if;
  if home and p_product <> 'completo' then
    raise exception 'conta_casa_completa';
  end if;
  update public.crm_teams set product = p_product where id = p_team;
  return p_product;
end
$function$;

revoke execute on function public.crm_set_product(uuid, text) from public, anon;
grant execute on function public.crm_set_product(uuid, text) to authenticated, service_role;

-- O painel de Contas mostra o produto de cada conta (o tipo de retorno muda: recriar)
drop function if exists public.crm_accounts_overview();
create function public.crm_accounts_overview()
returns table(id uuid, name text, segment text, website text, contact_name text, contact_email text, contact_phone text, notes text, status text, modules jsonb, is_home boolean, created_at timestamp with time zone, members integer, i_am_member boolean, archived_at timestamp with time zone, product text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select t.id, t.name, t.segment, t.website, t.contact_name, t.contact_email, t.contact_phone, t.notes, t.status,
         t.modules, t.is_home, t.created_at,
         (select count(*)::integer from public.crm_team_members m where m.team_id = t.id),
         exists (select 1 from public.crm_team_members m where m.team_id = t.id and m.user_id = (select auth.uid())),
         t.archived_at,
         t.product
  from public.crm_teams t
  where public.crm_is_platform_admin()
  order by t.is_home desc, t.created_at asc
$function$;

grant execute on function public.crm_accounts_overview() to authenticated, service_role;
