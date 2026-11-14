-- Resultado de cada campanha só para ver na Sinfy (2026-11-14): a equipe escolhe qual ação da Meta conta como
-- "Resultado" (ex.: Leads no site ou a conversão "Agendou reunião" numa campanha otimizada para compra),
-- sem mudar nada na campanha. `{ "<id da campanha>": "<tipo da ação>" }`; a função `meta-ads` aplica ao gravar.

alter table public.crm_ad_accounts add column if not exists result_types jsonb not null default '{}'::jsonb;

create or replace function public.crm_ad_result_type(p_account uuid, p_campaign text, p_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_types jsonb;
begin
  select team_id into v_team from public.crm_ad_accounts where id = p_account;
  if v_team is null or not public.is_crm_member(v_team) then
    raise exception 'Sem acesso a esta conta de anúncios.' using errcode = '42501';
  end if;
  if p_campaign is null or p_campaign !~ '^\d{1,40}$' then
    raise exception 'Campanha inválida.' using errcode = '22023';
  end if;
  if p_type is not null and (length(p_type) > 120 or p_type !~ '^[a-z0-9_.]+$') then
    raise exception 'Tipo de resultado inválido.' using errcode = '22023';
  end if;

  update public.crm_ad_accounts
     set result_types = case when p_type is null then result_types - p_campaign else result_types || jsonb_build_object(p_campaign, p_type) end
   where id = p_account
   returning result_types into v_types;
  return v_types;
end;
$$;

revoke all on function public.crm_ad_result_type(uuid, text, text) from public, anon;
grant execute on function public.crm_ad_result_type(uuid, text, text) to authenticated;
