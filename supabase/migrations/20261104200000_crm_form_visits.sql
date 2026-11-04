-- Formulários: quem está no formulário agora e até onde cada pessoa foi (2026-11-04)
--
-- O usuário: "algo relacionado aos eventos que disparam ao acessar o link… ver pessoas em tempo
-- real nesse link de formulario… importante para o acompanhamento do funil".
-- Uma linha por visita ao formulário (no /f/ do app ou no Elementor): o `forms.js` gera o id da
-- visita e manda à função `form-submit` (`action: 'track'`) a abertura, o começo, cada etapa, a
-- agenda vista, um sinal a cada 20 s enquanto a aba está à vista e a saída. A função lê a origem
-- (UTM, clique de anúncio, site de onde veio), o aparelho e a cidade na primeira batida, e marca o
-- envio, a qualificação e a reunião pelo que ela mesma gravou. Sem IP, sem cookies e sem as
-- respostas: só em que etapa a pessoa está. Só a função grava (`crm_form_track`, service_role);
-- a equipe lê, ao vivo pela Realtime; o gestor apaga.

create table public.crm_form_visits (
  id uuid primary key,
  form_id uuid not null references public.crm_forms (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  visitor text check (visitor is null or length(visitor) <= 40),
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  left_at timestamptz,
  active_ms integer not null default 0,
  -- Onde a pessoa está: capa, perguntas, agenda, agendado ou fim
  screen text not null default 'welcome' check (screen in ('welcome', 'steps', 'booking', 'booked', 'result')),
  step_id text check (step_id is null or length(step_id) <= 60),
  step_index integer,
  steps_total integer,
  -- As etapas por onde passou (ids da definição): o funil conta por elas
  steps_seen text[] not null default '{}',
  started boolean not null default false,
  submitted boolean not null default false,
  qualified boolean,
  schedule_view boolean not null default false,
  scheduled boolean not null default false,
  submission_id uuid references public.crm_form_submissions (id) on delete set null,
  page text,
  embed text check (embed is null or embed in ('app', 'site')),
  channel text,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  click_id text,
  referrer_host text,
  device text,
  browser text,
  os text,
  country text,
  region text,
  region_name text,
  city text,
  created_at timestamptz not null default now()
);

create index crm_form_visits_form_idx on public.crm_form_visits (form_id, started_at desc);
create index crm_form_visits_live_idx on public.crm_form_visits (team_id, last_at desc);
create index crm_form_visits_submission_idx on public.crm_form_visits (submission_id) where submission_id is not null;

alter table public.crm_form_visits enable row level security;

create policy "Equipe vê as visitas dos formulários" on public.crm_form_visits
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor apaga visitas dos formulários" on public.crm_form_visits
  for delete to authenticated using (public.is_crm_manager(team_id));
create policy "Módulo formularios ligado" on public.crm_form_visits
  as restrictive for all to authenticated
  using (public.crm_module_on(team_id, 'formularios')) with check (public.crm_module_on(team_id, 'formularios'));

alter publication supabase_realtime add table public.crm_form_visits;

-- Uma batida da visita. `p_first` (origem, aparelho, lugar) só vale ao criar a linha; `p_hit` muda
-- onde a pessoa está. O que só avança (começou, etapas vistas, agenda vista) nunca volta atrás.
-- Uma visita é de um formulário só, e só formulários publicados de contas ativas contam.
create or replace function public.crm_form_track(p_form uuid, p_visit uuid, p_hit jsonb, p_first jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_screen text := nullif(p_hit ->> 'screen', '');
  v_step text := left(nullif(p_hit ->> 'step', ''), 60);
  v_kind text := coalesce(p_hit ->> 'kind', 'ping');
  v_ms integer := least(greatest(coalesce((p_hit ->> 'ms')::integer, 0), 0), 86400000);
begin
  if v_screen is not null and v_screen not in ('welcome', 'steps', 'booking', 'booked', 'result') then v_screen := null; end if;

  select f.team_id into v_team
  from public.crm_forms f
  join public.crm_teams t on t.id = f.team_id
  where f.id = p_form and f.status = 'published' and t.status = 'ativa'
    and coalesce((t.modules ->> 'formularios')::boolean, true);
  if v_team is null then return false; end if;

  insert into public.crm_form_visits as v (
    id, form_id, team_id, visitor, screen, step_id, step_index, steps_total, steps_seen, started, schedule_view, active_ms,
    left_at, page, embed, channel, source, medium, campaign, content, term, click_id, referrer_host,
    device, browser, os, country, region, region_name, city
  ) values (
    p_visit, p_form, v_team, left(p_first ->> 'visitor', 40), coalesce(v_screen, 'welcome'), v_step,
    (p_hit ->> 'index')::integer, (p_hit ->> 'total')::integer,
    case when v_step is null then '{}'::text[] else array[v_step] end,
    v_kind = 'start', v_screen = 'booking', v_ms,
    case when v_kind = 'leave' then now() end,
    left(p_first ->> 'page', 500), case when p_first ->> 'embed' in ('app', 'site') then p_first ->> 'embed' end,
    left(p_first ->> 'channel', 60), left(p_first ->> 'source', 200), left(p_first ->> 'medium', 200),
    left(p_first ->> 'campaign', 200), left(p_first ->> 'content', 200), left(p_first ->> 'term', 200),
    left(p_first ->> 'click_id', 20), left(p_first ->> 'referrer_host', 200),
    left(p_first ->> 'device', 30), left(p_first ->> 'browser', 40), left(p_first ->> 'os', 40),
    left(p_first ->> 'country', 2), left(p_first ->> 'region', 10), left(p_first ->> 'region_name', 80), left(p_first ->> 'city', 80)
  )
  on conflict (id) do update set
    last_at = now(),
    left_at = case when v_kind = 'leave' then now() else null end,
    active_ms = greatest(v.active_ms, excluded.active_ms),
    screen = coalesce(v_screen, v.screen),
    step_id = case when v_screen = 'steps' then coalesce(v_step, v.step_id) else v.step_id end,
    step_index = case when v_screen = 'steps' then coalesce((p_hit ->> 'index')::integer, v.step_index) else v.step_index end,
    steps_total = coalesce((p_hit ->> 'total')::integer, v.steps_total),
    steps_seen = case when v_step is null or v_step = any (v.steps_seen) or cardinality(v.steps_seen) >= 60 then v.steps_seen else v.steps_seen || v_step end,
    started = v.started or v_kind = 'start',
    schedule_view = v.schedule_view or v_screen = 'booking'
  where v.form_id = p_form;
  return true;
end
$$;

revoke all on function public.crm_form_track(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.crm_form_track(uuid, uuid, jsonb, jsonb) to service_role;
