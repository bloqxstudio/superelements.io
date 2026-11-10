-- Trial reels (2026-11-09)
--
-- O usuário: "crie o motor para trial reel pela plataforma, quero postar esse formato de conteúdo e
-- validar vídeos antes de levar para conta real". O teste sai pela API oficial (`trial_params` no
-- contêiner de REELS): o Instagram mostra o vídeo só a quem não segue a conta. Cada teste fica aqui,
-- com os números lidos a cada hora pela função `instagram` e os retratos de 24 h e 72 h, para o motor
-- (`src/features/crm/trialReels.ts`) dizer se vale levar aos seguidores.
--
-- A Meta não entrega pela API se o teste já foi levado aos seguidores, nem permite levar por ela:
-- com MANUAL, quem leva é a pessoa, no app do Instagram; com SS_PERFORMANCE, o Instagram leva sozinho
-- se o vídeo for bem. A decisão registrada aqui (`decision`) é a da equipe.

create table public.crm_instagram_trials (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  account_id uuid not null references public.crm_instagram_accounts (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- O contêiner da Meta enquanto o vídeo processa; o post depois de publicado
  container_id text not null,
  media_id text,
  strategy text not null check (strategy in ('MANUAL', 'SS_PERFORMANCE')),
  title text not null default '',
  caption text,
  -- Duração do vídeo em segundos, para a retenção (tempo médio assistido ÷ duração)
  duration_s numeric,
  status text not null default 'processando' check (status in ('processando', 'no_ar', 'falhou')),
  published_at timestamptz,
  permalink text,
  thumbnail_url text,
  -- Os números da última leitura e os retratos de 24 h e 72 h ({"24": {...}, "72": {...}})
  insights jsonb not null default '{}'::jsonb,
  checkpoints jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  -- O que a equipe decidiu: levar aos seguidores, refazer o vídeo ou deixar como está
  decision text check (decision in ('levar', 'refazer', 'arquivar')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  note text,
  updated_at timestamptz not null default now(),
  unique (account_id, container_id)
);

create index crm_instagram_trials_account_idx on public.crm_instagram_trials (account_id, created_at desc);
create unique index crm_instagram_trials_media_idx on public.crm_instagram_trials (account_id, media_id) where media_id is not null;

alter table public.crm_instagram_trials enable row level security;

create policy "Equipe vê os testes de reels" on public.crm_instagram_trials
  for select to authenticated using (public.is_crm_member(team_id));

-- Quem cria e lê os números é a função (chave de serviço). A equipe só registra a decisão e a nota.
create policy "Equipe decide os testes de reels" on public.crm_instagram_trials
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));

create policy "Quem publicou ou gestor apaga o teste" on public.crm_instagram_trials
  for delete to authenticated using (created_by = auth.uid() or public.is_crm_manager(team_id));

create policy "Módulo instagram ligado" on public.crm_instagram_trials
  as restrictive for all to authenticated
  using (public.crm_module_on(team_id, 'instagram'))
  with check (public.crm_module_on(team_id, 'instagram'));

grant select, delete on public.crm_instagram_trials to authenticated;
grant update (decision, decided_by, decided_at, note, updated_at) on public.crm_instagram_trials to authenticated;
