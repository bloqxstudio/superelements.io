-- Leads que chegam por webhook (2026-10-29)
--
-- O site (formulário do Elementor, Zapier, qualquer POST) manda o lead para a função
-- `lead-webhook`; ela confere a chave da conta, junta a campanha (relatórios da Meta) e chama
-- `crm_receive_lead`, que cria (ou reaproveita) o cliente e abre a oportunidade na etapa "Novo lead",
-- com a origem guardada em `crm_opportunities.origin`. Se a conta tem alguém marcado para receber
-- (`crm_whatsapp_client_contacts.leads`), o aviso entra em `crm_lead_alerts` e o serviço do WhatsApp
-- manda o cartão do contato (só para conversas que a pessoa já abriu com o número).

alter table public.crm_opportunities add column origin jsonb;

alter table public.crm_whatsapp_client_contacts add column leads boolean not null default false;

-- A chave do webhook de cada conta (só gestor vê)
create table public.crm_lead_hooks (
  team_id uuid primary key references public.crm_teams (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table public.crm_lead_hooks enable row level security;

create policy "Gestor vê o webhook de leads" on public.crm_lead_hooks
  for select to authenticated using (public.is_crm_manager(team_id));
create policy "Gestor liga ou desliga o webhook de leads" on public.crm_lead_hooks
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id));

-- Cria a chave na primeira vez; com p_rotate gera outra (a antiga deixa de valer)
create or replace function public.crm_lead_hook(p_team uuid, p_rotate boolean default false)
returns table (token text, enabled boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_crm_manager(p_team) then
    raise exception 'Só gestor mexe no webhook de leads.' using errcode = '42501';
  end if;
  insert into public.crm_lead_hooks as h (team_id) values (p_team) on conflict (team_id) do nothing;
  if p_rotate then
    update public.crm_lead_hooks as h
    set token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), rotated_at = now()
    where h.team_id = p_team;
  end if;
  return query select h.token, h.enabled from public.crm_lead_hooks h where h.team_id = p_team;
end
$$;

revoke all on function public.crm_lead_hook(uuid, boolean) from public, anon;
grant execute on function public.crm_lead_hook(uuid, boolean) to authenticated;

-- Fila de avisos no WhatsApp (só a função e o serviço usam)
create table public.crm_lead_alerts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index crm_lead_alerts_pending on public.crm_lead_alerts (created_at) where sent_at is null;

alter table public.crm_lead_alerts enable row level security;
revoke all on table public.crm_lead_alerts from anon, authenticated;

-- O lead entra: cliente (reaproveitado pelo telefone ou e-mail) + oportunidade em "novo" + nota + aviso
create or replace function public.crm_receive_lead(p_team uuid, p_lead jsonb, p_origin jsonb, p_alert text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pipe uuid;
  cid uuid;
  oid uuid;
  digits text := regexp_replace(coalesce(p_lead->>'phone', ''), '\D', '', 'g');
  mail text := nullif(lower(btrim(coalesce(p_lead->>'email', ''))), '');
  nm text := nullif(btrim(coalesce(p_lead->>'name', '')), '');
  msg text := nullif(btrim(coalesce(p_lead->>'message', '')), '');
  paid boolean := coalesce((p_origin->>'paid')::boolean, false);
begin
  perform pg_advisory_xact_lock(hashtext('lead:' || p_team::text));
  select id into pipe from public.crm_pipelines where team_id = p_team order by position, created_at limit 1;
  if pipe is null then
    raise exception 'A conta não tem funil.' using errcode = 'P0002';
  end if;

  select c.id into cid from public.crm_clients c
  where c.team_id = p_team
    and ((length(digits) >= 10 and right(regexp_replace(coalesce(c.whatsapp, c.phone, ''), '\D', '', 'g'), 10) = right(digits, 10))
      or (mail is not null and lower(c.email) = mail))
  order by c.created_at limit 1;

  -- O mesmo envio chegando de novo (reenvio do formulário) não abre outra oportunidade
  if cid is not null and p_origin->>'hash' is not null then
    select o.id into oid from public.crm_opportunities o
    where o.client_id = cid and o.origin->>'hash' = p_origin->>'hash' and o.created_at > now() - interval '10 minutes' limit 1;
    if oid is not null then
      return jsonb_build_object('opportunityId', oid, 'clientId', cid, 'duplicate', true);
    end if;
  end if;

  if cid is null then
    insert into public.crm_clients (team_id, name, phone, whatsapp, email, source, status, notes)
    values (p_team, coalesce(nm, mail, nullif(digits, ''), 'Lead sem nome'), nullif(digits, ''), nullif(digits, ''), mail, case when paid then 'anuncio' else 'site' end, 'lead', msg)
    returning id into cid;
  end if;

  insert into public.crm_opportunities (team_id, pipeline_id, client_id, key, stage, origin, next_step)
  values (p_team, pipe, cid, 'lead:' || gen_random_uuid()::text, 'novo', p_origin, 'Responder o lead')
  returning id into oid;

  if msg is not null then
    insert into public.crm_activities (client_id, opportunity_id, kind, body, data)
    values (cid, oid, 'note', left('Mensagem do formulário: ' || msg, 8000), jsonb_build_object('lead', true));
  end if;

  if p_alert is not null then
    insert into public.crm_lead_alerts (team_id, opportunity_id, text) values (p_team, oid, replace(p_alert, '{id}', oid::text));
  end if;

  return jsonb_build_object('opportunityId', oid, 'clientId', cid, 'duplicate', false);
end
$$;

revoke all on function public.crm_receive_lead(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.crm_receive_lead(uuid, jsonb, jsonb, text) to service_role;

-- O serviço do WhatsApp reserva o aviso antes de mandar (uma cópia só envia)
create or replace function public.crm_claim_lead_alert(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with c as (update public.crm_lead_alerts set sent_at = now() where id = p_id and sent_at is null returning 1)
  select exists (select 1 from c)
$$;

revoke all on function public.crm_claim_lead_alert(uuid) from public, anon, authenticated;
grant execute on function public.crm_claim_lead_alert(uuid) to service_role;
