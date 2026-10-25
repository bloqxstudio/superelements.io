-- Anúncios da Meta (2026-10-25)
--
-- As campanhas de Facebook e Instagram da equipe, lidas da conta de anúncios
-- pela API de anúncios da Meta (Marketing API), na aba Anúncios da tela do
-- Instagram (`/crm/instagram?aba=anuncios`). Só leitura: investimento,
-- alcance, cliques, contatos (leads e conversas), custo por resultado, por
-- campanha, por dia, por plataforma, por público e os melhores anúncios.
--
-- Quem conecta é quem tem acesso à conta de anúncios (o gestor de tráfego,
-- por exemplo): entra com o Facebook e escolhe só as contas desta equipe.
-- Tudo passa pela função `meta-ads`, que guarda o token e fala com a Meta.
--
-- O token nunca chega ao navegador: fica em `crm_ad_tokens`, sem nenhuma
-- política (só a função, com a chave de serviço, lê). `crm_ad_pending`
-- guarda por 30 minutos o login entre "entrou com o Facebook" e "escolheu as
-- contas", também sem política. As outras tabelas são lidas por quem é da
-- equipe e escritas só pela função.

create table public.crm_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  -- Número da conta de anúncios, sem o `act_`
  ad_account_id text not null,
  name text not null default '',
  currency text not null default 'BRL',
  timezone_name text,
  -- 1 ativa; 2 desativada; 3 pagamento pendente; 7, 8, 9 em análise ou acerto; 100, 101 fechando ou fechada
  account_status integer,
  business_name text,
  connected_by uuid references auth.users (id) on delete set null,
  -- Nome de quem autorizou no Facebook (pode não ser da equipe)
  connected_name text,
  connected_at timestamptz not null default now(),
  -- `user`: vale 60 dias; `system`: não expira
  token_kind text,
  token_expires_at timestamptz,
  synced_at timestamptz,
  -- `token`: a conexão caiu (expirou ou foi revogada) e precisa ser refeita
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, ad_account_id)
);

create index crm_ad_accounts_team_idx on public.crm_ad_accounts (team_id);

create table public.crm_ad_tokens (
  account_id uuid primary key references public.crm_ad_accounts (id) on delete cascade,
  access_token text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz
);

-- O último relatório de cada período (`last_7d`, `last_30d`, `last_90d`, `this_month`)
create table public.crm_ad_reports (
  account_id uuid not null references public.crm_ad_accounts (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  preset text not null,
  -- { totals, days, campaigns, platforms, ages, genders, regions, ads, missing }
  data jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  primary key (account_id, preset)
);

create table public.crm_ad_pending (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token text not null,
  token_kind text,
  token_expires_at timestamptz,
  connected_name text,
  -- As contas de anúncios que o login enxerga: [{ id, name, currency, ... }]
  accounts jsonb not null default '[]'::jsonb,
  valid_until timestamptz not null default now() + interval '30 minutes'
);

alter table public.crm_ad_accounts enable row level security;
alter table public.crm_ad_tokens enable row level security;
alter table public.crm_ad_reports enable row level security;
alter table public.crm_ad_pending enable row level security;

revoke all on table public.crm_ad_tokens from anon, authenticated;
revoke all on table public.crm_ad_pending from anon, authenticated;

create policy "Equipe vê as contas de anúncios" on public.crm_ad_accounts
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe vê os relatórios de anúncios" on public.crm_ad_reports
  for select to authenticated using (public.is_crm_member(team_id));

create trigger crm_ad_accounts_touch before update on public.crm_ad_accounts
  for each row execute function public.crm_touch();
