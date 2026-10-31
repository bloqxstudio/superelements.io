-- Formulários e quizzes (2026-10-30)
--
-- A equipe monta o formulário (ou quiz) em CRM › Formulários e embeda no Elementor com um
-- script. O visitante responde na página do site; a função pública `form-submit` valida tudo
-- no servidor, guarda a resposta em `crm_form_submissions` e entrega o lead pelo mesmo caminho
-- do webhook (`crm_receive_lead`: cliente, oportunidade "Novo lead", origem e aviso no WhatsApp).
-- Só a função grava respostas; a equipe lê (e o gestor apaga).

create table public.crm_forms (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  kind text not null default 'form' check (kind in ('form', 'quiz')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- Etapas, campos, lógica e faixas de resultado (`_shared/forms.ts`)
  definition jsonb not null,
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  views bigint not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_forms_team_idx on public.crm_forms (team_id, created_at desc);

alter table public.crm_forms enable row level security;

create policy "Equipe vê os formulários" on public.crm_forms
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe cria formulários" on public.crm_forms
  for insert to authenticated with check (public.is_crm_member(team_id));
create policy "Equipe edita formulários" on public.crm_forms
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
create policy "Gestor apaga formulários" on public.crm_forms
  for delete to authenticated using (public.is_crm_manager(team_id));

create table public.crm_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.crm_forms (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  -- id do campo → texto ou lista de ids de opção, mais `summary`: pergunta e resposta como a equipe lê
  answers jsonb not null,
  summary jsonb not null default '[]'::jsonb,
  name text,
  email text,
  phone text,
  score integer,
  result text,
  qualified boolean,
  client_id uuid references public.crm_clients (id) on delete set null,
  opportunity_id uuid references public.crm_opportunities (id) on delete set null,
  origin jsonb,
  created_at timestamptz not null default now()
);

create index crm_form_submissions_form_idx on public.crm_form_submissions (form_id, created_at desc);
create index crm_form_submissions_team_idx on public.crm_form_submissions (team_id, created_at desc);

alter table public.crm_form_submissions enable row level security;

create policy "Equipe vê as respostas" on public.crm_form_submissions
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor apaga respostas" on public.crm_form_submissions
  for delete to authenticated using (public.is_crm_manager(team_id));

-- O time do formulário vem dele, nunca do corpo da requisição
create or replace function public.crm_form_team_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.team_id is distinct from old.team_id then
    raise exception 'O formulário não muda de conta.' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger crm_forms_team_guard before update on public.crm_forms
  for each row execute function public.crm_form_team_guard();

-- Conta uma visualização (só a função pública chama)
create or replace function public.crm_form_view(p_form uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.crm_forms set views = views + 1 where id = p_form and status = 'published'
$$;

revoke all on function public.crm_form_view(uuid) from public, anon, authenticated;
grant execute on function public.crm_form_view(uuid) to service_role;

alter publication supabase_realtime add table public.crm_form_submissions;
