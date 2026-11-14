-- Revisão de 2026-11-13 (CRM, WhatsApp e formulários). Aplicar antes de reiniciar o serviço do WhatsApp
-- (`services/whatsapp/src/leads.ts` passa a ler as colunas novas de `crm_lead_alerts`) e antes de publicar
-- `form-submit` (que usa `crm_rate_hit`; sem a migração, cai num limite só da memória da instância).

-- 1. Avisos de lead que não chegaram a ninguém ficavam marcados como enviados (`sent_at` era gravado antes de
--    saber se alguém tinha a conversa aberta) e os com mais de um dia ficavam pendentes para sempre. Agora o
--    aviso tem situação: `pending` (na fila), `sent` (ao menos uma entrega), `failed` (ninguém recebeu; tenta
--    de novo a cada 10 minutos enquanto vale), `expired` (passou de 24 h sem entrega). `error` diz o motivo,
--    para a tela mostrar e o gestor pedir de novo (`crm_lead_alert_retry`).
alter table public.crm_lead_alerts
  add column status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'expired')),
  add column error text check (error is null or char_length(error) <= 1000),
  add column attempts integer not null default 0,
  add column last_attempt_at timestamptz,
  add column claimed_at timestamptz,
  -- Desde quando o aviso vale (a validade de 24 h conta daqui; pedir de novo renova)
  add column queued_at timestamptz;

update public.crm_lead_alerts set queued_at = created_at where queued_at is null;
alter table public.crm_lead_alerts alter column queued_at set default now(), alter column queued_at set not null;

update public.crm_lead_alerts set status = 'sent' where sent_at is not null;
update public.crm_lead_alerts
set status = 'expired', error = 'Venceu sem entrega (aviso anterior à revisão de 2026-11-13).'
where sent_at is null and created_at < now() - interval '24 hours';

create index crm_lead_alerts_queue on public.crm_lead_alerts (queued_at) where sent_at is null and status in ('pending', 'failed');

-- O gestor da conta vê os avisos (e o motivo da falha); a fila continua escrita só pelo serviço e pelas funções
grant select on public.crm_lead_alerts to authenticated;
create policy "Gestor vê os avisos de lead" on public.crm_lead_alerts
  for select to authenticated using (public.is_crm_manager(team_id));

-- O serviço antigo ainda chama esta: continua marcando como enviado, agora com a situação certa
create or replace function public.crm_claim_lead_alert(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with c as (update public.crm_lead_alerts set sent_at = now(), status = 'sent' where id = p_id and sent_at is null returning 1)
  select exists (select 1 from c)
$$;

-- Reserva o aviso para uma tentativa (uma cópia só envia). Uma reserva de mais de 5 minutos é de um serviço
-- que caiu no meio e pode ser retomada; um aviso que falhou espera 10 minutos entre as tentativas.
create or replace function public.crm_lead_alert_lock(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with c as (
    update public.crm_lead_alerts
    set claimed_at = now(), last_attempt_at = now(), attempts = attempts + 1
    where id = p_id
      and sent_at is null
      and (status = 'pending' or (status = 'failed' and (last_attempt_at is null or last_attempt_at < now() - interval '10 minutes')))
      and (claimed_at is null or claimed_at < now() - interval '5 minutes')
      and queued_at > now() - interval '24 hours'
    returning 1
  )
  select exists (select 1 from c)
$$;

-- Fecha a tentativa: com ao menos uma entrega, enviado; sem nenhuma, falhou com o motivo
create or replace function public.crm_lead_alert_done(p_id uuid, p_delivered integer, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.crm_lead_alerts
  set claimed_at = null,
      sent_at = case when p_delivered > 0 then now() else null end,
      status = case when p_delivered > 0 then 'sent' else 'failed' end,
      error = case when p_delivered > 0 then nullif(left(coalesce(p_error, ''), 1000), '') else left(coalesce(nullif(p_error, ''), 'Ninguém recebeu o aviso.'), 1000) end
  where id = p_id and sent_at is null
$$;

-- Avisos sem entrega há mais de 24 h viram `expired` (antes ficavam na fila para sempre)
create or replace function public.crm_expire_lead_alerts()
returns integer
language sql
security definer
set search_path = public
as $$
  with e as (
    update public.crm_lead_alerts
    set status = 'expired', claimed_at = null,
        error = coalesce(error, 'Venceu sem entrega: o número da equipe ficou desligado por mais de 24 h.')
    where sent_at is null and status in ('pending', 'failed') and queued_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer from e
$$;

revoke all on function public.crm_lead_alert_lock(uuid) from public, anon, authenticated;
revoke all on function public.crm_lead_alert_done(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.crm_expire_lead_alerts() from public, anon, authenticated;
grant execute on function public.crm_lead_alert_lock(uuid) to service_role;
grant execute on function public.crm_lead_alert_done(uuid, integer, text) to service_role;
grant execute on function public.crm_expire_lead_alerts() to service_role;

-- O gestor pede de novo um aviso que falhou ou venceu (volta para a fila com mais 24 h)
create or replace function public.crm_lead_alert_retry(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  select a.team_id into v_team from public.crm_lead_alerts a where a.id = p_id;
  if v_team is null or not public.is_crm_manager(v_team) then
    raise exception 'Só o gestor da conta pede o aviso de novo.' using errcode = '42501';
  end if;
  update public.crm_lead_alerts
  set status = 'pending', error = null, queued_at = now(), last_attempt_at = null, claimed_at = null
  where id = p_id and sent_at is null and status in ('failed', 'expired');
  return found;
end
$$;

revoke all on function public.crm_lead_alert_retry(uuid) from public, anon;
grant execute on function public.crm_lead_alert_retry(uuid) to authenticated;

-- 2. Limite de batidas por chave entre as instâncias das funções públicas (`_shared/rateLimit.ts`): envio de
--    formulário por visitante (hash do IP com o formulário, sem guardar o IP) e regravação do arquivo público
--    do formulário (uma a cada 10 minutos). Janela fixa; linhas de mais de um dia saem aos poucos.
create table public.crm_rate_hits (
  key text primary key check (char_length(key) <= 200),
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

alter table public.crm_rate_hits enable row level security;
revoke all on table public.crm_rate_hits from anon, authenticated;

create or replace function public.crm_rate_hit(p_key text, p_max integer, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if p_key is null or char_length(p_key) > 200 or p_max < 1 or p_seconds < 1 then
    return false;
  end if;
  insert into public.crm_rate_hits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_seconds) then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_seconds) then 1 else r.hits + 1 end
  returning hits into v_hits;
  if random() < 0.01 then
    delete from public.crm_rate_hits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end
$$;

revoke all on function public.crm_rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.crm_rate_hit(text, integer, integer) to service_role;

-- 3. Linha do tempo: o autor editava a própria anotação mesmo depois de sair da equipe (a regra só olhava
--    `created_by`). Agora precisa continuar sendo da equipe, e a anotação não vira etapa nem "criado".
drop policy if exists "Autor edita a anotação" on public.crm_activities;
create policy "Autor edita a anotação" on public.crm_activities
  for update to authenticated
  using (created_by = (select auth.uid()) and public.is_crm_member(team_id) and kind <> all (array['stage', 'created']))
  with check (created_by = (select auth.uid()) and public.is_crm_member(team_id) and kind <> all (array['stage', 'created']));

-- 4. Papéis da plataforma: o anon (e qualquer um, pelo PUBLIC) chamava `has_role` e `get_user_role` pela API e
--    descobria quem é admin. Nenhuma regra avaliada para anon/public usa as duas (conferido em pg_policies em
--    2026-11-13: todas as que usam são de `authenticated`), e as funções que as chamam são SECURITY DEFINER do
--    postgres (crm_is_platform_admin, create_crm_team, profiles_guard), que seguem podendo.
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.get_user_role(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.get_user_role(uuid) to authenticated, service_role;

-- (Mantido: `image/svg+xml` no bucket `crm-forms`. O logo da capa do formulário aceita SVG no app
--  — src/features/crm/forms.ts e FormFlowEditors.tsx —, então tirar o tipo aqui quebraria o envio.)
