-- Extensão do Chrome "Salvar referência" (2026-11-09).
--
-- O usuário: "vamos fazer um motor para buscar referências do Behance para o projeto e organizar no app".
-- O Behance bloqueia leitura automatizada (403 para robôs) e a busca sozinha ficou de fora; o usuário escolheu
-- a extensão: a pessoa navega no Behance (ou Pinterest, ou num site) e, num projeto bom, clica na extensão. Ela
-- lê a página que já está aberta (título, autor, imagens, apreciações e visualizações) e manda para a função
-- `referencias-salvar`, que guarda as imagens no Cérebro da conta, a IA classifica e a referência entra como Nova.
--
--   * `crm_mcp_keys.scope`: a extensão usa uma chave pessoal da conta só para salvar referências ('referencias').
--     Ela não abre o MCP (`crm_mcp_resolve` passa a aceitar só 'mcp'), e uma chave do MCP não salva pela extensão.
--   * `crm_reference_key_create`: a pessoa gera a chave da extensão na tela Referências.
--   * `crm_reference_key_resolve` (só service_role): a função troca o hash pela conta e pela pessoa.
--   * `crm_references.via`: de onde veio ('grupo' = Mac lendo o grupo do Instagram; 'extensao'; vazio = à mão).

alter table public.crm_mcp_keys
  add column if not exists scope text not null default 'mcp' check (scope in ('mcp', 'referencias'));

grant select (scope) on public.crm_mcp_keys to authenticated;

alter table public.crm_references
  add column if not exists via text check (via is null or via in ('grupo', 'extensao'));

update public.crm_references set via = 'grupo' where via is null and source_id is not null;

-- O MCP aceita só as chaves do MCP (mesmo corpo de 20261103120000, mais o filtro de scope)
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
  select * into k from public.crm_mcp_keys where token_hash = p_hash and revoked_at is null and scope = 'mcp';
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

-- A chave da extensão: uma por pessoa e conta (gerar de novo revoga a anterior, que pode estar num Chrome antigo)
create or replace function public.crm_reference_key_create(p_team uuid)
returns table (id uuid, token text, prefix text)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_token text;
  v_id uuid;
begin
  if me is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not public.is_crm_member(p_team) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  update public.crm_mcp_keys set revoked_at = now()
  where crm_mcp_keys.team_id = p_team and crm_mcp_keys.user_id = me and crm_mcp_keys.scope = 'referencias' and crm_mcp_keys.revoked_at is null;
  v_token := 'ref_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.crm_mcp_keys (team_id, user_id, name, prefix, token_hash, scope)
  values (p_team, me, 'Extensão do Chrome', left(v_token, 12), encode(extensions.digest(v_token, 'sha256'), 'hex'), 'referencias')
  returning crm_mcp_keys.id into v_id;
  return query select v_id, v_token, left(v_token, 12);
end
$$;

revoke all on function public.crm_reference_key_create(uuid) from public, anon;
grant execute on function public.crm_reference_key_create(uuid) to authenticated;

create or replace function public.crm_reference_key_resolve(p_hash text)
returns table (key_id uuid, team_id uuid, user_id uuid, team_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.crm_mcp_keys;
begin
  select * into k from public.crm_mcp_keys where token_hash = p_hash and revoked_at is null and scope = 'referencias';
  if k.id is null then
    return;
  end if;
  if not exists (select 1 from public.crm_team_members m where m.team_id = k.team_id and m.user_id = k.user_id) then
    return;
  end if;
  if exists (select 1 from public.crm_teams t where t.id = k.team_id and (t.status = 'pausada' or t.archived_at is not null)) then
    return;
  end if;
  update public.crm_mcp_keys set last_used_at = now()
  where crm_mcp_keys.id = k.id and (last_used_at is null or last_used_at < now() - interval '1 minute');
  return query select k.id, k.team_id, k.user_id, (select t.name from public.crm_teams t where t.id = k.team_id);
end
$$;

revoke all on function public.crm_reference_key_resolve(text) from public, anon, authenticated;
grant execute on function public.crm_reference_key_resolve(text) to service_role;
