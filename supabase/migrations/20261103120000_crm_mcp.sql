-- MCP da Sinfy (2026-11-03): qualquer IA (Claude, ChatGPT, Cursor…) conecta na conta pela função
-- `sinfy-mcp` com uma chave pessoal. A chave é de UMA pessoa em UMA conta: a IA age em nome dela,
-- com os mesmos limites (membro, gestor, módulos, conta pausada). O servidor guarda só o hash.
--
--   * `crm_mcp_keys`: as chaves (nome, prefixo visível, hash, último uso, revogação).
--   * `crm_mcp_key_create` / `crm_mcp_key_revoke`: a pessoa cria e revoga as suas; gestor revoga qualquer uma da conta.
--   * `crm_mcp_resolve` (só service_role): a função troca o hash pela conta e pela pessoa.
--   * `crm_mcp_call` (só service_role): chama as funções do Plano e dos Conteúdos como aquela pessoa,
--     para que `auth.uid()`, o papel e o módulo sejam conferidos pelas mesmas regras da tela.
--     A IA nunca aprova um conteúdo: aprovar continua sendo de uma pessoa, na tela.
--   * `crm_mcp_log`: cada ferramenta chamada (nome, ok/erro, quando), para a conta ver o uso.

create table public.crm_mcp_keys (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  prefix text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index crm_mcp_keys_team on public.crm_mcp_keys (team_id, user_id);

alter table public.crm_mcp_keys enable row level security;
revoke all on table public.crm_mcp_keys from anon, authenticated;
grant select (id, team_id, user_id, name, prefix, created_at, last_used_at, revoked_at) on public.crm_mcp_keys to authenticated;

create policy "Ver as próprias chaves ou as da conta (gestor)" on public.crm_mcp_keys
  for select to authenticated
  using (user_id = auth.uid() or public.is_crm_manager(team_id));

create table public.crm_mcp_log (
  id bigint generated always as identity primary key,
  key_id uuid references public.crm_mcp_keys (id) on delete set null,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  tool text not null,
  ok boolean not null,
  at timestamptz not null default now()
);

create index crm_mcp_log_team on public.crm_mcp_log (team_id, at desc);

alter table public.crm_mcp_log enable row level security;
revoke all on table public.crm_mcp_log from anon, authenticated;
grant select on public.crm_mcp_log to authenticated;

create policy "Gestor vê o uso do MCP da conta" on public.crm_mcp_log
  for select to authenticated
  using (public.is_crm_manager(team_id));

-- ---------- criar e revogar ----------

create or replace function public.crm_mcp_key_create(p_team uuid, p_name text)
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
  if length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Dê um nome de até 60 letras à conexão.' using errcode = '22023';
  end if;
  if (select count(*) from public.crm_mcp_keys k where k.team_id = p_team and k.user_id = me and k.revoked_at is null) >= 10 then
    raise exception 'Limite de 10 conexões ativas por pessoa: revogue uma antes.' using errcode = '54000';
  end if;
  v_token := 'sfy_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.crm_mcp_keys (team_id, user_id, name, prefix, token_hash)
  values (p_team, me, btrim(p_name), left(v_token, 12), encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning crm_mcp_keys.id into v_id;
  return query select v_id, v_token, left(v_token, 12);
end
$$;

revoke all on function public.crm_mcp_key_create(uuid, text) from public, anon;
grant execute on function public.crm_mcp_key_create(uuid, text) to authenticated;

create or replace function public.crm_mcp_key_revoke(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.crm_mcp_keys;
begin
  select * into k from public.crm_mcp_keys where crm_mcp_keys.id = p_id;
  if k.id is null then
    raise exception 'Conexão não encontrada.' using errcode = 'P0002';
  end if;
  if k.user_id is distinct from auth.uid() and not public.is_crm_manager(k.team_id) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  update public.crm_mcp_keys set revoked_at = coalesce(revoked_at, now()) where crm_mcp_keys.id = p_id;
end
$$;

revoke all on function public.crm_mcp_key_revoke(uuid) from public, anon;
grant execute on function public.crm_mcp_key_revoke(uuid) to authenticated;

-- ---------- uso pela função (service_role) ----------

-- A chave vale enquanto não foi revogada, a pessoa segue na conta e a conta não está pausada.
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

-- As funções do Plano e dos Conteúdos, como a pessoa dona da chave. Lista fechada; sem aprovação.
create or replace function public.crm_mcp_call(p_user uuid, p_fn text, p_args jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);

  case p_fn
    when 'crm_context_save' then
      select to_jsonb(r) into v_result from public.crm_context_save((p_args->>'p_team')::uuid, (p_args->>'p_expected')::integer, p_args->'p_data') r;
    when 'crm_content_create' then
      select to_jsonb(r) into v_result from public.crm_content_create((p_args->>'p_team')::uuid, p_args->'p_data') r;
    when 'crm_content_save' then
      select to_jsonb(r) into v_result from public.crm_content_save((p_args->>'p_id')::uuid, (p_args->>'p_expected')::integer, p_args->'p_data') r;
    when 'crm_content_transition' then
      if p_args->>'p_to' = 'aprovado' then
        raise exception 'A aprovação é feita por uma pessoa, na tela de Conteúdos.' using errcode = '42501';
      end if;
      select to_jsonb(r) into v_result from public.crm_content_transition((p_args->>'p_id')::uuid, (p_args->>'p_expected')::integer, p_args->>'p_to') r;
    when 'crm_content_link' then
      select to_jsonb(r) into v_result from public.crm_content_link((p_args->>'p_content')::uuid, p_args->>'p_kind', p_args->>'p_artifact', nullif(p_args->>'p_project', '')::uuid, p_args->>'p_hash') r;
    else
      raise exception 'Função fora da lista do MCP: %', p_fn using errcode = '42501';
  end case;

  return v_result;
end
$$;

revoke all on function public.crm_mcp_call(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.crm_mcp_call(uuid, text, jsonb) to service_role;
