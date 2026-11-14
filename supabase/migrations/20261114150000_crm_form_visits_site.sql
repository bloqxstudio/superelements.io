-- Formulário dentro do site × visitas do site, sem duplicidade (2026-11-14)
--
-- O usuário: "pode ter clientes que nem tenham site, por isso eu colocaria em ambos; se entender que os 2
-- têm, grava somente o do site". O `forms.js` (v26) passa a mandar, quando está dentro de um site:
--   * `tracked`: a página tem o `visitas.js` (o código de visitas da Sinfy);
--   * `ss`: o id da visita do site que o `visitas.js` abriu (localStorage `visitas_s`, mesmo domínio).
-- Regra (em `src/features/crm/siteFunnel.ts`): pelo link do formulário, ou num site SEM o código de
-- visitas, a visita ao formulário conta como visita; num site COM o código, a visita é a do site e o
-- formulário vira um trecho da jornada dela (`site_session_id`). Linhas antigas ficam com
-- `site_tracked` nulo e seguem a regra de antes (dentro do site não conta).

alter table public.crm_form_visits
  add column if not exists site_session_id text check (site_session_id is null or char_length(site_session_id) <= 40),
  add column if not exists site_tracked boolean;

create index if not exists crm_form_visits_site_session_idx on public.crm_form_visits (site_session_id) where site_session_id is not null;

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
  v_ss text := left(nullif(p_hit ->> 'ss', ''), 40);
begin
  if v_screen is not null and v_screen not in ('welcome', 'steps', 'booking', 'booked', 'result') then v_screen := null; end if;

  select f.team_id into v_team
  from public.crm_forms f
  join public.crm_teams t on t.id = f.team_id
  where f.id = p_form and f.status = 'published' and t.status = 'ativa'
    and coalesce((t.modules ->> 'formularios')::boolean, true);
  if v_team is null then return false; end if;

  -- A visita do site só vale se for da mesma conta (o id vem do navegador)
  if v_ss is not null and not exists (select 1 from public.site_sessions s where s.id = v_ss and s.team_id = v_team) then
    v_ss := null;
  end if;

  insert into public.crm_form_visits as v (
    id, form_id, team_id, visitor, screen, step_id, step_index, steps_total, steps_seen, started, schedule_view, active_ms,
    left_at, page, embed, channel, source, medium, campaign, content, term, click_id, referrer_host,
    device, browser, os, country, region, region_name, city, site_session_id, site_tracked
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
    left(p_first ->> 'country', 2), left(p_first ->> 'region', 10), left(p_first ->> 'region_name', 80), left(p_first ->> 'city', 80),
    v_ss, case when p_first ? 'tracked' then (p_first ->> 'tracked')::boolean end
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
    schedule_view = v.schedule_view or v_screen = 'booking',
    -- O visitas.js pode abrir a visita do site depois da primeira batida do formulário
    site_session_id = coalesce(v.site_session_id, v_ss),
    site_tracked = case when v_ss is not null then true else v.site_tracked end
  where v.form_id = p_form;
  return true;
end
$$;

revoke all on function public.crm_form_track(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.crm_form_track(uuid, uuid, jsonb, jsonb) to service_role;
