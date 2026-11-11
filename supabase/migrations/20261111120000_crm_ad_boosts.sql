-- Turbinar post do Instagram pela plataforma (2026-11-11)
--
-- O usuário: "login com facebook, daria pra fazer isso? e deixar atrelado a
-- essa conta do cliente?". Quem tem a conta de anúncios do cliente (a mesma
-- que o perfil usa para turbinar, sem precisar de Gerenciador de Negócios)
-- entra com o Facebook com a permissão de criar anúncios (`ads_management`),
-- e a aba Anúncios cria campanha, conjunto e anúncio de um post do perfil.
-- Tudo nasce PAUSADO; só quem gerencia a conta ativa, e só depois de confirmar
-- o valor. A função `meta-ads` fala com a Meta e grava aqui.

-- As permissões que o login aceitou (`me/permissions`), para a tela saber se dá para turbinar
alter table public.crm_ad_accounts add column if not exists scopes text[];
alter table public.crm_ad_pending add column if not exists scopes text[];

create table public.crm_ad_boosts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  account_id uuid not null references public.crm_ad_accounts (id) on delete cascade,
  -- Os ids criados na Meta
  campaign_id text not null,
  adset_id text not null,
  creative_id text not null,
  ad_id text not null,
  page_id text not null,
  ig_user_id text not null,
  ig_username text,
  ig_media_id text not null,
  permalink text,
  thumbnail text,
  caption text,
  -- `engajamento`, `alcance` ou `site`
  goal text not null check (goal in ('engajamento', 'alcance', 'site')),
  link text,
  -- Por dia, na moeda da conta (sem centavos convertidos: 25.00 = R$ 25)
  daily_budget numeric(12, 2) not null check (daily_budget > 0),
  currency text not null default 'BRL',
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- { places: [{ key, type, name, radius? }], ageMin, ageMax, genders }
  audience jsonb not null default '{}'::jsonb,
  -- `pausado` (criado, esperando quem gerencia), `ativo`, `encerrado`
  status text not null default 'pausado' check (status in ('pausado', 'ativo', 'encerrado')),
  -- O que a Meta diz do anúncio (ACTIVE, PENDING_REVIEW, DISAPPROVED, CAMPAIGN_PAUSED…)
  meta_status text,
  meta_feedback text,
  created_by uuid references auth.users (id) on delete set null,
  activated_by uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_ad_boosts_team_idx on public.crm_ad_boosts (team_id, created_at desc);
create index crm_ad_boosts_account_idx on public.crm_ad_boosts (account_id, created_at desc);

alter table public.crm_ad_boosts enable row level security;

create policy "Equipe vê os posts turbinados" on public.crm_ad_boosts
  for select to authenticated using (public.is_crm_member(team_id));

create trigger crm_ad_boosts_touch before update on public.crm_ad_boosts
  for each row execute function public.crm_touch();
