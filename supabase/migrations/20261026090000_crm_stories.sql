-- Stories programados (2026-10-26)
--
-- A pauta de stories da equipe, da ideia à publicação: os agentes do app
-- (Estrategista, Editor, Designer, Ilustradora, pelo Codex desta máquina)
-- escrevem a semana e montam cada sequência no Criativos; a equipe aprova; o
-- servidor publica na hora marcada, mesmo com o computador desligado.
--
-- Uma linha de `crm_stories` é uma sequência (de 1 a 10 telas) num horário.
-- Aprovar gera o JPEG de cada tela no navegador e sobe para a pasta do
-- Instagram da equipe (`crm/<equipe>/instagram/stories/<id>/<n>.jpg`); daí a
-- linha fica `agendado`. A cada minuto o `pg_cron` chama a função `instagram`
-- (ação `run_scheduled`, com o segredo `x-cron-secret`) quando há story
-- vencido; ela reserva a linha (`crm_claim_stories`), publica as telas na
-- ordem e grava cada uma em `frames`. Entre 20 e 23 horas depois, a mesma
-- chamada lê os números de cada tela, antes de a Meta apagar o story.
--
-- Quem é da equipe lê, cria e muda as linhas, mas não publica: só o servidor
-- (a chave de serviço) põe `publicando` ou `publicado` e grava o id do post e
-- os números (gatilho `crm_stories_guard`).
--
-- Para o cron funcionar (uma vez, no Supabase):
--   1. Database › Extensions: pg_cron e pg_net (esta migração tenta ligar).
--   2. Vault: os segredos `stories_function_url`
--      (https://<projeto>.supabase.co/functions/v1/instagram) e
--      `stories_cron_secret` (um texto longo qualquer).
--   3. Edge Functions › Secrets: `STORIES_CRON_SECRET` com o mesmo texto.
--   4. Publicar a função `instagram` com --no-verify-jwt (o cron não tem login;
--      as outras ações continuam exigindo a pessoa logada).

-- ---------- ajustes da equipe ----------

create table public.crm_story_settings (
  team_id uuid primary key references public.crm_teams (id) on delete cascade,
  -- A conta que publica
  account_id uuid references public.crm_instagram_accounts (id) on delete set null,
  -- O conjunto de criativos que recebe as sequências (compartilhado com um projeto, para a equipe abrir)
  set_id text,
  set_project_id uuid,
  -- Dias da semana (0 = domingo) e horários (HH:MM, hora de Brasília)
  days smallint[] not null default '{1,2,3,4,5}',
  times text[] not null default '{10:00}',
  frames_max smallint not null default 4 check (frames_max between 1 and 10),
  -- [{ id, label, hint }]
  pillars jsonb not null default '[]'::jsonb,
  -- O recado do mês: o que a equipe quer dizer agora
  brief text not null default '' check (char_length(brief) <= 4000),
  photos boolean not null default true,
  web boolean not null default true,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- a pauta ----------

create table public.crm_stories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  account_id uuid references public.crm_instagram_accounts (id) on delete set null,
  publish_at timestamptz not null,
  status text not null default 'ideia' check (status in ('ideia', 'criativo', 'agendado', 'publicando', 'publicado', 'falhou', 'descartado')),
  pillar text not null default '',
  title text not null default '' check (char_length(title) <= 200),
  -- O roteiro da Estrategista: gancho, ângulo, objetivo, telas, chamada, case, porquê
  idea jsonb not null default '{}'::jsonb,
  -- O plano da Designer (PostPlan), para refazer uma tela sem foto
  plan jsonb,
  -- A nota do Editor: { ok, note }
  review jsonb,
  -- O post no Criativos
  set_id text,
  set_project_id uuid,
  post_id text,
  -- As telas na ordem: [{ path, mediaId?, permalink?, publishedAt?, insights? }]
  frames jsonb not null default '[]'::jsonb,
  attempts smallint not null default 0,
  next_try_at timestamptz,
  error text,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  insights_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_stories_team_idx on public.crm_stories (team_id, publish_at);
create index crm_stories_due_idx on public.crm_stories (publish_at) where status in ('agendado', 'publicando');
create index crm_stories_numbers_idx on public.crm_stories (publish_at) where status = 'publicado' and insights_at is null;

alter table public.crm_story_settings enable row level security;
alter table public.crm_stories enable row level security;

create policy "Equipe vê os ajustes dos stories" on public.crm_story_settings
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe cria os ajustes dos stories" on public.crm_story_settings
  for insert to authenticated with check (public.is_crm_member(team_id));
create policy "Equipe muda os ajustes dos stories" on public.crm_story_settings
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));

create policy "Equipe vê os stories" on public.crm_stories
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe cria stories" on public.crm_stories
  for insert to authenticated with check (public.is_crm_member(team_id) and created_by = (select auth.uid()));
create policy "Equipe muda stories" on public.crm_stories
  for update to authenticated using (public.is_crm_member(team_id)) with check (public.is_crm_member(team_id));
create policy "Gestor apaga stories" on public.crm_stories
  for delete to authenticated using (public.is_crm_manager(team_id));

create trigger crm_story_settings_touch before update on public.crm_story_settings
  for each row execute function public.crm_touch();
create trigger crm_stories_touch before update on public.crm_stories
  for each row execute function public.crm_touch();

-- ---------- a trava: quem é da equipe não publica ----------

create or replace function public.crm_stories_guard()
returns trigger
language plpgsql
as $$
declare
  frame jsonb;
  prefix text;
begin
  -- A conta é sempre da mesma equipe da linha (vale para todos)
  if new.account_id is not null and not exists (
    select 1 from public.crm_instagram_accounts a where a.id = new.account_id and a.team_id = new.team_id
  ) then
    raise exception 'A conta do Instagram não é desta equipe.' using errcode = '42501';
  end if;

  -- O servidor (chave de serviço, cron, funções security definer) pode tudo
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('ideia', 'criativo') then
      raise exception 'Um story novo começa como ideia ou criativo.' using errcode = '42501';
    end if;
    if jsonb_array_length(new.frames) > 0 or new.published_at is not null or new.insights_at is not null or new.approved_by is not null then
      raise exception 'Só a aprovação e a publicação gravam as telas.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Daqui para baixo, só UPDATE
  if new.team_id is distinct from old.team_id then
    raise exception 'O story não muda de equipe.' using errcode = '42501';
  end if;
  -- Publicando: só o servidor mexe até terminar
  if old.status = 'publicando' then
    raise exception 'Este story está sendo publicado agora.' using errcode = '42501';
  end if;
  -- Publicado não volta
  if old.status = 'publicado' and new.status is distinct from old.status then
    raise exception 'Este story já foi publicado.' using errcode = '42501';
  end if;
  if new.status in ('publicando', 'publicado') and new.status is distinct from old.status then
    raise exception 'Só a publicação do servidor muda o story para %.', new.status using errcode = '42501';
  end if;
  if new.published_at is distinct from old.published_at or new.insights_at is distinct from old.insights_at then
    raise exception 'Só a publicação do servidor grava a hora publicada e os números.' using errcode = '42501';
  end if;
  if new.frames is distinct from old.frames then
    -- O que a publicação gravou (id do post, link, números) não se reescreve nem se inventa
    if exists (select 1 from jsonb_array_elements(old.frames) f where f ? 'mediaId') then
      raise exception 'As telas já publicadas não mudam.' using errcode = '42501';
    end if;
    if exists (
      select 1 from jsonb_array_elements(new.frames) f
      where f ? 'mediaId' or f ? 'permalink' or f ? 'publishedAt' or f ? 'insights'
    ) then
      raise exception 'Só a publicação do servidor grava o post e os números.' using errcode = '42501';
    end if;
  end if;

  -- Aprovar: de 1 a 10 telas, todas na pasta do Instagram da equipe; quem aprova é quem chamou
  if new.status = 'agendado' then
    if jsonb_typeof(new.frames) <> 'array' or jsonb_array_length(new.frames) not between 1 and 10 then
      raise exception 'Um story agendado tem de 1 a 10 telas.' using errcode = '23514';
    end if;
    prefix := 'crm/' || new.team_id::text || '/instagram/';
    for frame in select f from jsonb_array_elements(new.frames) f loop
      if coalesce(frame ->> 'path', '') not like prefix || '%' or frame ->> 'path' like '%..%' then
        raise exception 'Tela fora da pasta do Instagram da equipe.' using errcode = '23514';
      end if;
    end loop;
    if new.account_id is null then
      raise exception 'Escolha a conta do Instagram antes de aprovar.' using errcode = '23514';
    end if;
    if old.status is distinct from 'agendado' then
      new.approved_by := (select auth.uid());
      new.approved_at := now();
    else
      new.approved_by := old.approved_by;
      new.approved_at := old.approved_at;
    end if;
  elsif new.status in ('ideia', 'criativo') then
    new.approved_by := null;
    new.approved_at := null;
  else
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  end if;

  return new;
end
$$;

create trigger crm_stories_guard before insert or update on public.crm_stories
  for each row execute function public.crm_stories_guard();

-- ---------- a reserva (só o servidor) ----------

-- Pega até `p_max` stories vencidos e marca como `publicando`. Uma reserva
-- presa há mais de 10 minutos (a função caiu no meio) volta para a fila: as
-- telas já publicadas estão em `frames` e não se repetem.
create or replace function public.crm_claim_stories(p_max integer default 2)
returns setof public.crm_stories
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crm_stories
     set status = 'agendado'
   where status = 'publicando' and updated_at < now() - interval '10 minutes';

  return query
  update public.crm_stories s
     set status = 'publicando', attempts = s.attempts + 1
   where s.id in (
     select c.id from public.crm_stories c
      where c.status = 'agendado'
        and c.publish_at <= now()
        and (c.next_try_at is null or c.next_try_at <= now())
      order by c.publish_at
      limit greatest(1, least(coalesce(p_max, 2), 10))
      for update skip locked
   )
  returning s.*;
end
$$;

revoke all on function public.crm_claim_stories(integer) from public, anon, authenticated;
grant execute on function public.crm_claim_stories(integer) to service_role;

-- ---------- o relógio ----------

-- Chamada do cron: só acorda a função quando há trabalho (story vencido,
-- reserva presa ou números a ler), para não gastar chamadas à toa.
create or replace function public.crm_stories_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.crm_stories
     where (status = 'agendado' and publish_at <= now() and (next_try_at is null or next_try_at <= now()))
        or (status = 'publicando' and updated_at < now() - interval '10 minutes')
        or (status = 'publicado' and insights_at is null and publish_at < now() - interval '20 hours' and publish_at > now() - interval '23 hours 30 minutes')
  ) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'stories_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'stories_cron_secret';
  if v_url is null or v_secret is null then
    raise notice 'Stories: faltam os segredos stories_function_url e stories_cron_secret no Vault';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('action', 'run_scheduled'),
    timeout_milliseconds := 150000
  );
end
$$;

revoke all on function public.crm_stories_tick() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  create extension if not exists pg_net with schema extensions;
exception
  when others then raise notice 'Stories: não consegui ligar pg_cron e pg_net (%). Ligue em Database › Extensions e rode o bloco do cron desta migração de novo.', sqlerrm;
end
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('crm-stories', '* * * * *', 'select public.crm_stories_tick()');
  else
    raise notice 'Stories: sem pg_cron e pg_net, nada é publicado na hora marcada.';
  end if;
end
$$;

-- ---------- ao vivo ----------

do $$
begin
  alter publication supabase_realtime add table public.crm_stories;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'Sem a publicação supabase_realtime: a aba Stories funciona, só não se atualiza sozinha';
end
$$;
