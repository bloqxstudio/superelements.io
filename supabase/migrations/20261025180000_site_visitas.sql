-- Visitas do site (2026-10-25)
--
-- O painel Site do CRM (`/crm/site`): quem visita o site da equipe, de onde
-- veio, o que viu e o que fez (WhatsApp, formulário, telefone, cliques). Um
-- script próprio (`public/visitas.js`, colado uma vez no WordPress) manda cada
-- página vista, o tempo, a rolagem e cada evento para a função `site-visitas`,
-- que grava aqui pela `site_collect`. Sem Google Analytics, sem cookie de
-- terceiros, sem IP e sem o conteúdo dos formulários: o visitante é um número
-- aleatório guardado no navegador dele.
--
-- `site_trackers`: um site por linha; o `id` é a chave que vai no código do
-- site (pública, como a de qualquer ferramenta de métricas: a função só aceita
-- eventos vindos do domínio cadastrado). `site_sessions`: uma visita (30
-- minutos parado fecham a visita), com a origem, o aparelho e o resumo do que
-- aconteceu. `site_events`: as páginas vistas e os eventos, em ordem.
-- A equipe lê; o gestor cadastra o site e apaga visitas (as de teste); só a
-- função escreve visitas.

create table public.site_trackers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  -- Sem protocolo nem www: `avencestudio.com` (vale também para os subdomínios)
  domain text not null check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- O último evento recebido (para a tela dizer se o código está no site)
  last_seen_at timestamptz,
  unique (team_id, domain)
);

create index site_trackers_team_idx on public.site_trackers (team_id);

create table public.site_sessions (
  -- Gerado pelo script
  id text primary key check (char_length(id) between 8 and 40),
  site_id uuid not null references public.site_trackers (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 8 and 40),
  -- 1 na primeira visita deste navegador, 2 na segunda...
  visit_number integer not null default 1,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  landing_path text,
  -- A última página vista (a de agora, para quem está no site)
  exit_path text,
  referrer text,
  referrer_host text,
  -- `Google Ads`, `Google (busca)`, `Instagram`, `Meta Ads`, `Direto`… (a função classifica)
  channel text not null default 'Direto',
  -- utm_source ou o site de onde veio
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  -- Que identificador de clique veio no endereço (`gclid`, `fbclid`…), sem o valor
  click_id text,
  -- `Celular`, `Tablet`, `Computador`
  device text,
  browser text,
  os text,
  -- Código de duas letras (`BR`)
  country text,
  tz text,
  lang text,
  screen text,
  pageviews integer not null default 0,
  events integer not null default 0,
  -- Tempo com a página à vista e em uso (aba esquecida não conta)
  active_ms integer not null default 0,
  -- Fez contato: WhatsApp, telefone, e-mail ou formulário enviado
  converted boolean not null default false,
  conversions text[] not null default '{}'
);

create index site_sessions_site_idx on public.site_sessions (site_id, started_at desc);
create index site_sessions_live_idx on public.site_sessions (site_id, last_at desc);
create index site_sessions_visitor_idx on public.site_sessions (site_id, visitor_id, started_at desc);

create table public.site_events (
  id bigint generated always as identity primary key,
  session_id text not null references public.site_sessions (id) on delete cascade,
  site_id uuid not null references public.site_trackers (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  visitor_id text not null,
  at timestamptz not null default now(),
  type text not null check (type in ('pageview', 'event')),
  -- Página vista: o id que o script dá a ela (o tempo e a rolagem chegam depois por ele)
  pv text,
  -- Evento: `whatsapp`, `telefone`, `email`, `formulario`, `formulario_inicio`,
  -- `clique`, `link_externo` ou o nome que veio do dataLayer
  name text,
  path text,
  title text,
  -- Evento: { texto, secao, destino, formulario… }; página vista: { nf: 1 } quando é a página de erro 404
  data jsonb not null default '{}'::jsonb,
  active_ms integer,
  scroll smallint
);

create index site_events_session_idx on public.site_events (session_id, at, id);
create index site_events_site_idx on public.site_events (site_id, at desc);

alter table public.site_trackers enable row level security;
alter table public.site_sessions enable row level security;
alter table public.site_events enable row level security;

create policy "Equipe vê os sites" on public.site_trackers
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor cadastra o site" on public.site_trackers
  for insert to authenticated with check (public.is_crm_manager(team_id));
create policy "Gestor muda o site" on public.site_trackers
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id));
create policy "Gestor apaga o site" on public.site_trackers
  for delete to authenticated using (public.is_crm_manager(team_id));

create policy "Equipe vê as visitas" on public.site_sessions
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor apaga visitas" on public.site_sessions
  for delete to authenticated using (public.is_crm_manager(team_id));

create policy "Equipe vê os eventos das visitas" on public.site_events
  for select to authenticated using (public.is_crm_member(team_id));

-- ---------- gravar (só a função `site-visitas`, com a chave de serviço) ----------

-- `p_session`: { id, visitor, visit, landing, referrer, referrerHost, channel,
-- source, medium, campaign, term, content, clickId, device, browser, os,
-- country, tz, lang, screen }, já limpo pela função; os dados de origem só
-- valem na primeira vez (a visita nasce com eles).
-- `p_hits`: [{ t: 'p', pv, path, title, data }] página vista,
-- [{ t: 'e', name, path, data }] evento, [{ t: 'g', pv, ms, scroll }] tempo e
-- rolagem da página vista (o maior valor recebido vale).
create or replace function public.site_collect(p_site uuid, p_host text, p_session jsonb, p_hits jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_domain text;
  v_sid text := p_session ->> 'id';
  v_vid text := p_session ->> 'visitor';
  v_hit jsonb;
  v_name text;
  v_path text;
  v_exit text;
  v_pageviews integer := 0;
  v_events integer := 0;
  v_engaged boolean := false;
  v_conv text[] := '{}';
  v_count integer := 0;
begin
  select t.team_id, t.domain into v_team, v_domain from public.site_trackers t where t.id = p_site;
  if v_team is null then
    raise exception 'site desconhecido' using errcode = 'P0002';
  end if;
  if p_host is null or not (lower(p_host) = v_domain or lower(p_host) like '%.' || v_domain) then
    raise exception 'o endereço % não é do site', p_host using errcode = '42501';
  end if;
  if coalesce(v_sid, '') !~ '^[A-Za-z0-9-]{8,40}$' or coalesce(v_vid, '') !~ '^[A-Za-z0-9-]{8,40}$' then
    raise exception 'visita sem id' using errcode = '22023';
  end if;

  insert into public.site_sessions (
    id, site_id, team_id, visitor_id, visit_number, landing_path, exit_path, referrer, referrer_host,
    channel, source, medium, campaign, term, content, click_id, device, browser, os, country, tz, lang, screen
  ) values (
    v_sid, p_site, v_team, v_vid,
    greatest(1, least(coalesce((p_session ->> 'visit')::integer, 1), 100000)),
    left(p_session ->> 'landing', 500), left(p_session ->> 'landing', 500),
    left(p_session ->> 'referrer', 500), left(p_session ->> 'referrerHost', 200),
    coalesce(left(p_session ->> 'channel', 60), 'Direto'),
    left(p_session ->> 'source', 200), left(p_session ->> 'medium', 200), left(p_session ->> 'campaign', 200),
    left(p_session ->> 'term', 200), left(p_session ->> 'content', 200), left(p_session ->> 'clickId', 20),
    left(p_session ->> 'device', 20), left(p_session ->> 'browser', 40), left(p_session ->> 'os', 40),
    left(p_session ->> 'country', 2), left(p_session ->> 'tz', 60), left(p_session ->> 'lang', 20), left(p_session ->> 'screen', 20)
  )
  on conflict (id) do nothing;

  for v_hit in select value from jsonb_array_elements(coalesce(p_hits, '[]'::jsonb)) limit 50
  loop
    v_count := v_count + 1;
    v_path := left(coalesce(v_hit ->> 'path', '/'), 500);
    if v_hit ->> 't' = 'p' then
      insert into public.site_events (session_id, site_id, team_id, visitor_id, at, type, pv, path, title, data)
      values (v_sid, p_site, v_team, v_vid, clock_timestamp(), 'pageview', left(v_hit ->> 'pv', 40), v_path,
        left(v_hit ->> 'title', 200), coalesce(v_hit -> 'data', '{}'::jsonb));
      v_pageviews := v_pageviews + 1;
      v_exit := v_path;
    elsif v_hit ->> 't' = 'e' then
      v_name := left(v_hit ->> 'name', 60);
      continue when coalesce(v_name, '') = '';
      insert into public.site_events (session_id, site_id, team_id, visitor_id, at, type, pv, name, path, data)
      values (v_sid, p_site, v_team, v_vid, clock_timestamp(), 'event', left(v_hit ->> 'pv', 40), v_name, v_path,
        coalesce(v_hit -> 'data', '{}'::jsonb));
      v_events := v_events + 1;
      if v_name in ('whatsapp', 'telefone', 'email', 'formulario') and not v_name = any (v_conv) then
        v_conv := array_append(v_conv, v_name);
      end if;
    elsif v_hit ->> 't' = 'g' then
      update public.site_events e set
        active_ms = greatest(coalesce(e.active_ms, 0), least(greatest(coalesce((v_hit ->> 'ms')::integer, 0), 0), 86400000)),
        scroll = greatest(coalesce(e.scroll, 0), least(greatest(coalesce((v_hit ->> 'scroll')::integer, 0), 0), 100))
      where e.session_id = v_sid and e.pv = v_hit ->> 'pv' and e.type = 'pageview';
      v_engaged := true;
    end if;
  end loop;

  update public.site_sessions s set
    last_at = greatest(s.last_at, now()),
    pageviews = s.pageviews + v_pageviews,
    events = s.events + v_events,
    exit_path = coalesce(v_exit, s.exit_path),
    landing_path = coalesce(s.landing_path, v_exit),
    converted = s.converted or cardinality(v_conv) > 0,
    conversions = case when cardinality(v_conv) > 0
      then array(select distinct c from unnest(s.conversions || v_conv) as c order by c)
      else s.conversions end,
    active_ms = case when v_engaged
      then (select least(coalesce(sum(e.active_ms), 0), 2147483647)::integer from public.site_events e where e.session_id = v_sid and e.type = 'pageview')
      else s.active_ms end
  where s.id = v_sid and s.site_id = p_site;
  if not found then
    raise exception 'visita de outro site' using errcode = '42501';
  end if;

  update public.site_trackers set last_seen_at = now()
  where id = p_site and (last_seen_at is null or last_seen_at < now() - interval '1 minute');

  return v_count;
end
$$;

revoke all on function public.site_collect(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.site_collect(uuid, text, jsonb, jsonb) to service_role;

-- ---------- ler (a tela, com o acesso de quem está logado) ----------

-- O relatório de um período: totais (e os do período anterior, do mesmo
-- tamanho), dias, origens, campanhas, páginas, entradas, eventos, botões,
-- aparelhos, navegadores, sistemas, países, fusos, idiomas, horários e as
-- páginas de erro. Roda com o acesso de quem chama (as políticas valem).
create or replace function public.site_report(p_site uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'America/Sao_Paulo')
returns jsonb
language sql
stable
set search_path = public
as $$
  with
  s as (
    select * from public.site_sessions where site_id = p_site and started_at >= p_from and started_at < p_to
  ),
  sp as (
    select * from public.site_sessions where site_id = p_site and started_at >= p_from - (p_to - p_from) and started_at < p_from
  ),
  pv as (
    select * from public.site_events where site_id = p_site and type = 'pageview' and at >= p_from and at < p_to
  ),
  ev as (
    select * from public.site_events where site_id = p_site and type = 'event' and at >= p_from and at < p_to
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'sessions', count(*),
        'visitors', count(distinct visitor_id),
        'newVisitors', count(distinct visitor_id) filter (where visit_number = 1),
        'pageviews', coalesce(sum(pageviews), 0),
        'activeMs', coalesce(round(avg(active_ms)), 0),
        'bounces', count(*) filter (where pageviews <= 1 and not converted and active_ms < 10000),
        'converted', count(*) filter (where converted)
      ) from s
    ),
    'previous', (
      select jsonb_build_object(
        'sessions', count(*),
        'visitors', count(distinct visitor_id),
        'newVisitors', count(distinct visitor_id) filter (where visit_number = 1),
        'pageviews', coalesce(sum(pageviews), 0),
        'activeMs', coalesce(round(avg(active_ms)), 0),
        'bounces', count(*) filter (where pageviews <= 1 and not converted and active_ms < 10000),
        'converted', count(*) filter (where converted)
      ) from sp
    ),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'sessions', sessions, 'visitors', visitors, 'pageviews', pageviews, 'converted', converted) order by day)
      from (
        select to_char(started_at at time zone p_tz, 'YYYY-MM-DD') as day, count(*) as sessions, count(distinct visitor_id) as visitors,
          coalesce(sum(pageviews), 0) as pageviews, count(*) filter (where converted) as converted
        from s group by 1
      ) d
    ), '[]'::jsonb),
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'sessions', sessions, 'visitors', visitors, 'converted', converted, 'activeMs', active) order by sessions desc)
      from (
        select channel, count(*) as sessions, count(distinct visitor_id) as visitors, count(*) filter (where converted) as converted, round(avg(active_ms)) as active
        from s group by channel
      ) c
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'source', source, 'sessions', sessions, 'converted', converted) order by sessions desc)
      from (
        select channel, source, count(*) as sessions, count(*) filter (where converted) as converted
        from s where source is not null group by channel, source order by count(*) desc limit 30
      ) c
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'source', source, 'medium', medium, 'campaign', campaign, 'sessions', sessions, 'converted', converted) order by sessions desc)
      from (
        select channel, source, medium, campaign, count(*) as sessions, count(*) filter (where converted) as converted
        from s where campaign is not null group by channel, source, medium, campaign order by count(*) desc limit 30
      ) c
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'title', title, 'views', views, 'visitors', visitors, 'activeMs', active, 'scroll', scroll) order by views desc)
      from (
        select path, max(title) as title, count(*) as views, count(distinct visitor_id) as visitors,
          round(avg(active_ms) filter (where active_ms > 0)) as active, round(avg(scroll) filter (where scroll > 0)) as scroll
        from pv group by path order by count(*) desc limit 50
      ) p
    ), '[]'::jsonb),
    'landings', coalesce((
      select jsonb_agg(jsonb_build_object('path', landing_path, 'sessions', sessions, 'converted', converted, 'bounces', bounces) order by sessions desc)
      from (
        select landing_path, count(*) as sessions, count(*) filter (where converted) as converted,
          count(*) filter (where pageviews <= 1 and not converted and active_ms < 10000) as bounces
        from s where landing_path is not null group by landing_path order by count(*) desc limit 30
      ) l
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'total', total, 'sessions', sessions) order by total desc)
      from (
        select name, count(*) as total, count(distinct session_id) as sessions from ev group by name order by count(*) desc limit 40
      ) e
    ), '[]'::jsonb),
    'clicks', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'label', label, 'section', section, 'total', total, 'sessions', sessions) order by total desc)
      from (
        select name, coalesce(data ->> 'texto', data ->> 'formulario', '') as label, coalesce(data ->> 'secao', '') as section,
          count(*) as total, count(distinct session_id) as sessions
        from ev where name in ('whatsapp', 'telefone', 'email', 'clique', 'link_externo', 'formulario', 'formulario_inicio')
        group by 1, 2, 3 order by count(*) desc limit 60
      ) c
    ), '[]'::jsonb),
    'conversionPages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'total', total, 'sessions', sessions) order by total desc)
      from (
        select path, count(*) as total, count(distinct session_id) as sessions
        from ev where name in ('whatsapp', 'telefone', 'email', 'formulario') group by path order by count(*) desc limit 30
      ) c
    ), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n) order by n desc) from (select coalesce(device, '') as k, count(*) as n from s group by 1) x), '[]'::jsonb),
    'browsers', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n) order by n desc) from (select coalesce(browser, '') as k, count(*) as n from s group by 1) x), '[]'::jsonb),
    'os', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n) order by n desc) from (select coalesce(os, '') as k, count(*) as n from s group by 1) x), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n) order by n desc) from (select coalesce(country, '') as k, count(*) as n from s group by 1) x), '[]'::jsonb),
    'tzs', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n) order by n desc) from (select coalesce(tz, '') as k, count(*) as n from s group by 1 order by 2 desc limit 20) x), '[]'::jsonb),
    'langs', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n) order by n desc) from (select coalesce(lang, '') as k, count(*) as n from s group by 1 order by 2 desc limit 20) x), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'sessions', n))
      from (
        select extract(isodow from started_at at time zone p_tz)::integer as dow, extract(hour from started_at at time zone p_tz)::integer as hour, count(*) as n
        from s group by 1, 2
      ) h
    ), '[]'::jsonb),
    'notFound', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'views', views) order by views desc)
      from (select path, count(*) as views from pv where data ->> 'nf' = '1' group by path order by count(*) desc limit 20) n
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.site_report(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.site_report(uuid, timestamptz, timestamptz, text) to authenticated;
