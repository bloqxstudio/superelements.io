-- Fluxos de atendimento e prospecção (2026-10-26)
--
-- Um fluxo é uma sequência de mensagens de WhatsApp com a espera entre elas
-- (dias). A equipe põe clientes do funil num fluxo e a "Rotina de hoje" mostra
-- quem está na vez, com o texto pronto: a pessoa confere e envia (um clique).
-- Nada sai sozinho: o WhatsApp restringe número que dispara mensagens sem
-- ninguém olhando. O estado de cada cliente num fluxo é uma linha em
-- `crm_flow_runs`.

create table public.crm_flows (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  name text not null,
  kind text not null default 'prospeccao' check (kind in ('prospeccao', 'atendimento')),
  -- [{ id, wait, text }]: wait = dias desde o passo anterior (no primeiro, 0 = já)
  steps jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_flow_runs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  flow_id uuid not null references public.crm_flows (id) on delete cascade,
  client_id uuid not null references public.crm_clients (id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities (id) on delete set null,
  -- O próximo passo a enviar (índice em steps)
  step integer not null default 0,
  status text not null default 'running' check (status in ('running', 'replied', 'done', 'paused')),
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  last_sent_at timestamptz,
  -- Quando o próximo passo fica na vez
  next_at timestamptz not null default now()
);

-- Um cliente não entra duas vezes no mesmo fluxo enquanto ele está rodando
create unique index crm_flow_runs_one_running on public.crm_flow_runs (flow_id, client_id) where status = 'running';
create index crm_flow_runs_team on public.crm_flow_runs (team_id, status, next_at);

alter table public.crm_flows enable row level security;
alter table public.crm_flow_runs enable row level security;

create policy "Equipe vê os fluxos" on public.crm_flows for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor cria fluxos" on public.crm_flows for insert to authenticated with check (public.is_crm_manager(team_id));
create policy "Gestor muda fluxos" on public.crm_flows for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id));
create policy "Gestor apaga fluxos" on public.crm_flows for delete to authenticated using (public.is_crm_manager(team_id));

create policy "Equipe vê a rotina" on public.crm_flow_runs for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe põe no fluxo" on public.crm_flow_runs for insert to authenticated with check (public.is_crm_member(team_id));
create policy "Equipe anda no fluxo" on public.crm_flow_runs for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
create policy "Equipe tira do fluxo" on public.crm_flow_runs for delete to authenticated using (public.is_crm_member(team_id));
