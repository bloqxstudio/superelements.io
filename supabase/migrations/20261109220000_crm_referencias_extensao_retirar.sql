-- Retira a extensão do Chrome "Salvar referência" (2026-11-09).
--
-- O usuário, depois de testar: "retire a feature, não ficou legal, não vamos usar". Desfaz
-- 20261109210000_crm_referencias_extensao.sql (que fica no histórico): as funções da chave da extensão, as chaves
-- 'referencias', a coluna `scope` (com `crm_mcp_resolve` de volta ao corpo de 20261103120000) e `crm_references.via`.
-- As referências que já foram salvas pela extensão ficam, como referências comuns.

drop function if exists public.crm_reference_key_create(uuid);
drop function if exists public.crm_reference_key_resolve(text);

delete from public.crm_mcp_keys where scope = 'referencias';

create or replace function public.crm_mcp_resolve(p_hash text)
returns table (key_id uuid, team_id uuid, user_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.crm_mcp_keys;
  v_role text;
begin
  select * into k from public.crm_mcp_keys where token_hash = p_hash and revoked_at is null;
  if k.id is null then
    return;
  end if;
  select m.role into v_role from public.crm_team_members m where m.team_id = k.team_id and m.user_id = k.user_id;
  if v_role is null then
    return;
  end if;
  if exists (select 1 from public.crm_teams t where t.id = k.team_id and (t.status = 'pausada' or t.archived_at is not null)) then
    return;
  end if;
  -- Último uso com folga de um minuto (cada pedido da IA não regrava a linha)
  update public.crm_mcp_keys set last_used_at = now()
  where crm_mcp_keys.id = k.id and (last_used_at is null or last_used_at < now() - interval '1 minute');
  return query select k.id, k.team_id, k.user_id, v_role;
end
$$;

revoke all on function public.crm_mcp_resolve(text) from public, anon, authenticated;
grant execute on function public.crm_mcp_resolve(text) to service_role;

alter table public.crm_mcp_keys drop column if exists scope;
alter table public.crm_references drop column if exists via;
