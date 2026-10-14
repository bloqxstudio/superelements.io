-- Social selling no CRM (2026-10-14)
--
-- A tela Social (`/crm/social`) monta a fila do dia nas redes: seguir, comentar,
-- mandar a primeira mensagem e retomar, com o texto pronto e um limite diário
-- por pessoa. Quem segue e envia é sempre a pessoa, no perfil dela; o CRM só
-- organiza e anota (os termos do Instagram, do LinkedIn e do Facebook proíbem
-- seguir ou mandar mensagem por robô, e a API deles não faz isso).
--
-- Aqui: os perfis do LinkedIn e do Facebook do cliente (o Instagram já tinha
-- coluna) e o tipo `social` na linha do tempo, com
-- `data = { network: instagram | linkedin | facebook, step: seguir | comentar | mensagem | retomar | resposta | pausa }`.

alter table public.crm_clients
  add column if not exists linkedin text,
  add column if not exists facebook text;

alter table public.crm_activities drop constraint if exists crm_activities_kind_check;
alter table public.crm_activities add constraint crm_activities_kind_check
  check (kind in ('note', 'call', 'whatsapp', 'email', 'meeting', 'stage', 'created', 'social'));

drop policy if exists "Equipe anota" on public.crm_activities;
create policy "Equipe anota" on public.crm_activities
  for insert to authenticated with check (public.is_crm_member(team_id) and kind in ('note', 'call', 'whatsapp', 'email', 'meeting', 'social'));

-- A fila lê só os toques nas redes da equipe
create index if not exists crm_activities_social_idx on public.crm_activities (team_id, created_at desc) where kind = 'social';
