-- WhatsApp da equipe: números de clientes que podem perguntar sobre a própria conta (2026-10-28)
--
-- Um número só (o da conta da Avence). Quem está neste cadastro escreve para ele e o serviço
-- (`services/whatsapp`, `clientes.ts`) responde com os dados da conta-cliente ligada ao telefone:
-- só leitura, só os assuntos liberados e só os módulos ligados nessa conta. O telefone vem do
-- cadastro e a conta também: nada na mensagem escolhe de quem são os dados.
-- Como isso entrega dado de uma conta a um telefone, só o admin da plataforma cadastra.

create table public.crm_whatsapp_client_contacts (
  -- A conta dona do número do WhatsApp (a da Avence)
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  -- Só os dígitos, com o país: 5551999999999
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  -- A conta-cliente cujos dados esse telefone pode ver
  account_id uuid not null references public.crm_teams (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  -- Assuntos liberados (cada um liga ou desliga por pessoa)
  topics text[] not null default '{site,anuncios}' check (topics <@ array['site', 'anuncios', 'funil', 'instagram', 'posts', 'caixa', 'projetos']),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (team_id, phone),
  check (account_id <> team_id)
);

alter table public.crm_whatsapp_client_contacts enable row level security;

create policy "Gestor vê os números de clientes" on public.crm_whatsapp_client_contacts
  for select to authenticated using (public.is_crm_manager(team_id) or public.crm_is_platform_admin());
create policy "Admin da plataforma inclui número de cliente" on public.crm_whatsapp_client_contacts
  for insert to authenticated with check (public.crm_is_platform_admin());
create policy "Admin da plataforma muda número de cliente" on public.crm_whatsapp_client_contacts
  for update to authenticated using (public.crm_is_platform_admin()) with check (public.crm_is_platform_admin());
create policy "Admin da plataforma tira número de cliente" on public.crm_whatsapp_client_contacts
  for delete to authenticated using (public.crm_is_platform_admin());

-- O que cada cliente perguntou e o que recebeu (só o serviço escreve)
create table public.crm_whatsapp_client_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  account_id uuid not null references public.crm_teams (id) on delete cascade,
  phone text not null,
  question text not null,
  topic text,
  answered boolean not null default true,
  created_at timestamptz not null default now()
);

create index crm_whatsapp_client_log_team on public.crm_whatsapp_client_log (team_id, created_at desc);

alter table public.crm_whatsapp_client_log enable row level security;

create policy "Gestor vê as perguntas dos clientes" on public.crm_whatsapp_client_log
  for select to authenticated using (public.is_crm_manager(team_id) or public.crm_is_platform_admin());
