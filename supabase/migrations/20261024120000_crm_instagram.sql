-- Instagram da equipe (2026-10-24)
--
-- A conta de Instagram da equipe (hoje @avencestudio) ligada pela API oficial
-- da Meta (Instagram API com login pelo Instagram): seguidores, alcance,
-- desempenho de cada post, o público, publicar e responder comentários sem
-- abrir o app. Tudo passa pela função `instagram` do Supabase, que guarda o
-- token e fala com a Meta; o navegador só lê o que ela gravou aqui.
--
-- O token nunca chega ao navegador: fica em `crm_instagram_tokens`, sem
-- nenhuma política (só a função, com a chave de serviço, lê). As outras
-- tabelas são lidas por quem é da equipe e escritas só pela função.
--
-- A Meta só devolve 30 dias de alcance por dia e não guarda o histórico de
-- seguidores: cada leitura grava o dia em `crm_instagram_daily`, e o
-- histórico cresce a partir da conexão. Os stories somem da API em 24 horas;
-- os que estavam no ar numa leitura ficam guardados com os números daquela hora.

create table public.crm_instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  -- Id da conta na API do Instagram (o `user_id` do login)
  ig_user_id text not null,
  username text not null default '',
  name text,
  -- BUSINESS ou MEDIA_CREATOR
  account_type text,
  profile_picture_url text,
  biography text,
  website text,
  followers_count integer,
  follows_count integer,
  media_count integer,
  -- Totais da Meta nos últimos 7 e 30 dias: { "7": { reach, views, ... }, "30": { ... } }
  totals jsonb not null default '{}'::jsonb,
  -- Seguidores por idade, gênero, cidade e país (só com 100 seguidores ou mais)
  audience jsonb not null default '{}'::jsonb,
  -- Posts publicados pela API nas últimas 24 horas e o limite
  publish_quota jsonb,
  -- Métricas que a Meta não devolveu na última leitura
  missing text[] not null default '{}',
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  token_expires_at timestamptz,
  synced_at timestamptz,
  -- `token`: a conexão caiu (expirou ou foi revogada) e precisa ser refeita
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, ig_user_id)
);

create index crm_instagram_accounts_team_idx on public.crm_instagram_accounts (team_id);

create table public.crm_instagram_tokens (
  account_id uuid primary key references public.crm_instagram_accounts (id) on delete cascade,
  access_token text not null,
  permissions text[] not null default '{}',
  issued_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Um dia da conta: o alcance que a Meta deu e os seguidores lidos naquele dia
create table public.crm_instagram_daily (
  account_id uuid not null references public.crm_instagram_accounts (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  day date not null,
  reach integer,
  followers integer,
  primary key (account_id, day)
);

create table public.crm_instagram_media (
  account_id uuid not null references public.crm_instagram_accounts (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  media_id text not null,
  -- IMAGE, VIDEO ou CAROUSEL_ALBUM
  media_type text not null,
  -- FEED, REELS ou STORY
  product_type text,
  caption text,
  permalink text,
  thumbnail_url text,
  media_url text,
  posted_at timestamptz not null,
  like_count integer,
  comments_count integer,
  -- { reach, views, likes, comments, shares, saved, total_interactions, ... }
  insights jsonb not null default '{}'::jsonb,
  -- Quem publicou pela plataforma (vazio: publicado no app do Instagram)
  published_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (account_id, media_id)
);

create index crm_instagram_media_posted_idx on public.crm_instagram_media (account_id, posted_at desc);

alter table public.crm_instagram_accounts enable row level security;
alter table public.crm_instagram_tokens enable row level security;
alter table public.crm_instagram_daily enable row level security;
alter table public.crm_instagram_media enable row level security;

revoke all on table public.crm_instagram_tokens from anon, authenticated;

create policy "Equipe vê o Instagram" on public.crm_instagram_accounts
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe vê os dias do Instagram" on public.crm_instagram_daily
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe vê os posts do Instagram" on public.crm_instagram_media
  for select to authenticated using (public.is_crm_member(team_id));

create trigger crm_instagram_accounts_touch before update on public.crm_instagram_accounts
  for each row execute function public.crm_touch();
