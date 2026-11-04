-- Formulários: agenda depois do envio (2026-11-03)
--
-- Quem passa no filtro do formulário (todos, os qualificados do quiz, ou quem marcou certas opções,
-- como o faturamento) escolhe um horário nos próximos dias. Os horários de cada formulário ficam na
-- configuração dele (`settings.booking`, `_shared/forms.ts`); aqui fica só o que foi reservado.
-- Só a função pública `form-submit` grava (com a chave de serviço, depois de conferir a resposta);
-- a equipe lê e o gestor cancela. Um horário de um formulário só vale para uma pessoa, e uma
-- resposta só reserva uma vez (índices únicos parciais: um cancelamento libera o horário).
--
-- O logo da tela de início vai para o mesmo bucket público `crm-forms` (`<conta>/logos/…`), que
-- passa a aceitar imagens.

create table public.crm_form_bookings (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.crm_forms (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  submission_id uuid references public.crm_form_submissions (id) on delete set null,
  client_id uuid references public.crm_clients (id) on delete set null,
  opportunity_id uuid references public.crm_opportunities (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  name text,
  phone text,
  email text,
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index crm_form_bookings_slot on public.crm_form_bookings (form_id, starts_at) where status = 'confirmado';
create unique index crm_form_bookings_once on public.crm_form_bookings (submission_id) where status = 'confirmado' and submission_id is not null;
create index crm_form_bookings_team_idx on public.crm_form_bookings (team_id, starts_at);

alter table public.crm_form_bookings enable row level security;

create policy "Equipe vê os agendamentos" on public.crm_form_bookings
  for select to authenticated using (public.is_crm_member(team_id));

-- O gestor só muda o status (cancelar ou confirmar de novo)
revoke update on table public.crm_form_bookings from authenticated;
grant update (status) on table public.crm_form_bookings to authenticated;
create policy "Gestor cancela agendamentos" on public.crm_form_bookings
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id));

-- Como os formulários: com o módulo desligado, o banco também barra
create policy "Módulo formularios ligado" on public.crm_form_bookings
  as restrictive for all to authenticated
  using (public.crm_module_on(team_id, 'formularios')) with check (public.crm_module_on(team_id, 'formularios'));

alter publication supabase_realtime add table public.crm_form_bookings;

-- Pixel da Meta do formulário, lado servidor: o token da API de Conversões e o código de teste.
-- A configuração do formulário é pública (vai para o CDN), então o token mora aqui, longe dela:
-- só o gestor da conta lê e grava; a função `form-submit` lê com a chave de serviço.
create table public.crm_form_pixel_tokens (
  form_id uuid primary key references public.crm_forms (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  access_token text not null default '' check (length(access_token) <= 600),
  test_event_code text check (test_event_code is null or test_event_code ~ '^[A-Za-z0-9]{3,40}$'),
  updated_at timestamptz not null default now()
);

alter table public.crm_form_pixel_tokens enable row level security;

create policy "Gestor lê o token do pixel" on public.crm_form_pixel_tokens
  for select to authenticated using (public.is_crm_manager(team_id));
create policy "Gestor grava o token do pixel" on public.crm_form_pixel_tokens
  for insert to authenticated with check (public.is_crm_manager(team_id) and exists (select 1 from public.crm_forms f where f.id = form_id and f.team_id = crm_form_pixel_tokens.team_id));
create policy "Gestor muda o token do pixel" on public.crm_form_pixel_tokens
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id) and exists (select 1 from public.crm_forms f where f.id = form_id and f.team_id = crm_form_pixel_tokens.team_id));
create policy "Gestor apaga o token do pixel" on public.crm_form_pixel_tokens
  for delete to authenticated using (public.is_crm_manager(team_id));

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['application/json', 'image/png', 'image/webp', 'image/jpeg', 'image/svg+xml']
where id = 'crm-forms';
