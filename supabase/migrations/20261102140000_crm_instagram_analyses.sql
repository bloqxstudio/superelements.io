-- Análise de perfil do Instagram (2026-11-02)
--
-- CRM › Instagram › Análise: um retrato do perfil conectado (bio, foto, destaques,
-- ritmo, formatos, legendas, desempenho e horários), com a nota de cada parte e o
-- que fazer, mais a leitura da IA quando ela está conectada. Cada análise salva
-- fica aqui, para comparar com as anteriores.
--
-- Os destaques não vêm pela API da Meta: a pessoa escreve os nomes como aparecem
-- no perfil, e eles ficam guardados com a análise.

create table public.crm_instagram_analyses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  account_id uuid not null references public.crm_instagram_accounts (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Nota geral, de 0 a 100
  score integer not null check (score between 0 and 100),
  -- As partes com nota e achados (o formato de `profileAudit.ts`)
  report jsonb not null default '{}'::jsonb,
  -- A leitura da IA: resumo, notas por área, bio sugerida, próximos passos; null sem IA
  ai jsonb,
  -- Nomes dos destaques escritos pela pessoa; null quando não informou
  highlights jsonb,
  -- O perfil no momento da análise (foto, nome, bio, link, seguidores)
  profile jsonb not null default '{}'::jsonb
);

create index crm_instagram_analyses_account_idx on public.crm_instagram_analyses (account_id, created_at desc);

alter table public.crm_instagram_analyses enable row level security;

create policy "Equipe vê as análises do Instagram" on public.crm_instagram_analyses
  for select to authenticated using (public.is_crm_member(team_id));

-- A conta tem de ser da mesma equipe: ninguém grava análise de um perfil de outra conta
create policy "Equipe salva análises do Instagram" on public.crm_instagram_analyses
  for insert to authenticated with check (
    public.is_crm_member(team_id)
    and created_by = auth.uid()
    and exists (select 1 from public.crm_instagram_accounts a where a.id = account_id and a.team_id = crm_instagram_analyses.team_id)
  );

create policy "Quem fez ou gestor apaga a análise" on public.crm_instagram_analyses
  for delete to authenticated using (created_by = auth.uid() or public.is_crm_manager(team_id));

create policy "Módulo instagram ligado" on public.crm_instagram_analyses
  as restrictive for all to authenticated
  using (public.crm_module_on(team_id, 'instagram'))
  with check (public.crm_module_on(team_id, 'instagram'));

grant select, insert, delete on public.crm_instagram_analyses to authenticated;
