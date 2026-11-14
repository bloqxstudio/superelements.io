-- Google Agenda da conta (2026-11-14)
--
-- O usuário: "marco reunião com o cliente e queria visualizar essas calls agendadas pela plataforma… integrar
-- de criar por aqui e enviar direto pro cliente", e na agenda dos formulários "opcional… podendo marcar ou
-- funcionar normal como era antes".
--
-- Uma agenda Google por conta, conectada pelo gestor (login do Google, função `google-calendar`). A tela
-- `/crm/agenda` lista os eventos e cria reuniões com Meet e convite (o Google manda o e-mail ao convidado).
-- Formulário com `settings.booking.google` ligado: os horários ocupados no Google saem da lista e cada reserva
-- vira um evento com convite. Sem conexão (ou com o Google fora), a agenda do formulário segue como antes.
--
-- O token fica em `crm_google_tokens`, sem acesso do navegador (só a função, com a chave de serviço).

create table public.crm_google_calendars (
  team_id uuid primary key references public.crm_teams (id) on delete cascade,
  email text not null check (length(email) <= 320),
  calendar_id text not null default 'primary' check (length(calendar_id) <= 320),
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  -- O último erro do Google (ex.: acesso revogado), para a tela pedir para conectar de novo
  last_error text check (last_error is null or length(last_error) <= 300),
  updated_at timestamptz not null default now()
);

create table public.crm_google_tokens (
  team_id uuid primary key references public.crm_google_calendars (team_id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}'
);

alter table public.crm_google_calendars enable row level security;
alter table public.crm_google_tokens enable row level security;

revoke all on table public.crm_google_tokens from anon, authenticated;
-- A conexão: a equipe vê qual e-mail está ligado; só a função grava
revoke insert, update, delete on table public.crm_google_calendars from anon, authenticated;

create policy "Equipe vê a agenda Google" on public.crm_google_calendars
  for select to authenticated using (public.is_crm_member(team_id));

-- Reserva do formulário ↔ evento criado no Google (para cancelar junto)
alter table public.crm_form_bookings
  add column google_event_id text check (google_event_id is null or length(google_event_id) <= 1024),
  add column meet_url text check (meet_url is null or length(meet_url) <= 300);
