-- Visitas do site: compras de lojas (Shopify e quem manda o `purchase` do GA4).
--
-- O evento `compra` (do pixel da Shopify ou do dataLayer, pelo `visitas.js`)
-- passa a ser conversão e soma `orders`, `revenue` e `currency` na visita.
-- Um pedido (`data.pedido`) conta uma vez só: a página de obrigado recarregada
-- ou o mesmo pedido vindo do pixel e do dataLayer não somam de novo.
-- `site_report` ganha vendas e faturamento nos totais, por dia, por origem,
-- por campanha e por anúncio, e os produtos (vistos, no carrinho, comprados).

alter table public.site_sessions
  add column if not exists orders integer not null default 0,
  add column if not exists revenue numeric(14, 2) not null default 0,
  add column if not exists currency text;

create index if not exists site_events_pedido_idx
  on public.site_events (site_id, (data ->> 'pedido'))
  where name = 'compra';

CREATE OR REPLACE FUNCTION public.site_collect_core(p_site uuid, p_host text, p_session jsonb, p_hits jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_order text;
  v_value numeric;
  v_orders integer := 0;
  v_revenue numeric := 0;
  v_currency text;
  v_lat double precision := case when jsonb_typeof(p_session -> 'lat') = 'number' then (p_session ->> 'lat')::double precision end;
  v_lon double precision := case when jsonb_typeof(p_session -> 'lon') = 'number' then (p_session ->> 'lon')::double precision end;
  v_radius integer := case when jsonb_typeof(p_session -> 'geoRadius') = 'number' then least(greatest(round((p_session ->> 'geoRadius')::numeric), 0), 20000)::integer end;
  v_details jsonb := case when jsonb_typeof(p_session -> 'details') = 'object' then p_session -> 'details' else '{}'::jsonb end;
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
  if v_lat is not null and (v_lat < -90 or v_lat > 90 or v_lon is null or v_lon < -180 or v_lon > 180) then
    v_lat := null;
    v_lon := null;
  end if;
  if pg_column_size(v_details) > 4000 then
    v_details := '{}'::jsonb;
  end if;

  insert into public.site_sessions (
    id, site_id, team_id, visitor_id, visit_number, landing_path, exit_path, referrer, referrer_host,
    channel, source, medium, campaign, term, content, click_id, device, browser, os, country, tz, lang, screen,
    city, region, region_name, lat, lon, geo_radius, network, details
  ) values (
    v_sid, p_site, v_team, v_vid,
    greatest(1, least(coalesce((p_session ->> 'visit')::integer, 1), 100000)),
    left(p_session ->> 'landing', 500), left(p_session ->> 'landing', 500),
    left(p_session ->> 'referrer', 500), left(p_session ->> 'referrerHost', 200),
    coalesce(left(p_session ->> 'channel', 60), 'Direto'),
    left(p_session ->> 'source', 200), left(p_session ->> 'medium', 200), left(p_session ->> 'campaign', 200),
    left(p_session ->> 'term', 200), left(p_session ->> 'content', 200), left(p_session ->> 'clickId', 20),
    left(p_session ->> 'device', 20), left(p_session ->> 'browser', 40), left(p_session ->> 'os', 40),
    left(p_session ->> 'country', 2), left(p_session ->> 'tz', 60), left(p_session ->> 'lang', 20), left(p_session ->> 'screen', 20),
    left(p_session ->> 'city', 120), left(p_session ->> 'region', 10), left(p_session ->> 'regionName', 120),
    v_lat, v_lon, v_radius, left(p_session ->> 'network', 120), v_details
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
      -- Compra: o mesmo pedido conta uma vez; o valor soma na visita
      if v_name = 'compra' then
        v_order := nullif(left(v_hit -> 'data' ->> 'pedido', 80), '');
        if v_order is not null then
          perform pg_advisory_xact_lock(hashtext('site_compra:' || p_site::text || ':' || v_order));
          continue when exists (
            select 1 from public.site_events e
            where e.site_id = p_site and e.name = 'compra' and e.data ->> 'pedido' = v_order
          );
        end if;
        v_value := case when jsonb_typeof(v_hit -> 'data' -> 'valor') = 'number' then (v_hit -> 'data' ->> 'valor')::numeric end;
        if v_value is not null and v_value >= 0 and v_value < 1000000000 then
          v_revenue := v_revenue + round(v_value, 2);
        end if;
        v_orders := v_orders + 1;
        v_currency := coalesce(upper(nullif(left(v_hit -> 'data' ->> 'moeda', 3), '')), v_currency);
      end if;
      insert into public.site_events (session_id, site_id, team_id, visitor_id, at, type, pv, name, path, data)
      values (v_sid, p_site, v_team, v_vid, clock_timestamp(), 'event', left(v_hit ->> 'pv', 40), v_name, v_path,
        coalesce(v_hit -> 'data', '{}'::jsonb));
      v_events := v_events + 1;
      if v_name in ('whatsapp', 'telefone', 'email', 'formulario', 'compra') and not v_name = any (v_conv) then
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
    orders = s.orders + v_orders,
    revenue = s.revenue + v_revenue,
    currency = coalesce(v_currency, s.currency),
    exit_path = coalesce(v_exit, s.exit_path),
    landing_path = coalesce(s.landing_path, v_exit),
    converted = s.converted or cardinality(v_conv) > 0,
    conversions = case when cardinality(v_conv) > 0
      then array(select distinct c from unnest(s.conversions || v_conv) as c order by c)
      else s.conversions end,
    active_ms = case when v_engaged
      then (select least(coalesce(sum(e.active_ms), 0), 2147483647)::integer from public.site_events e where e.session_id = v_sid and e.type = 'pageview')
      else s.active_ms end,
    city = coalesce(s.city, left(p_session ->> 'city', 120)),
    region = coalesce(s.region, left(p_session ->> 'region', 10)),
    region_name = coalesce(s.region_name, left(p_session ->> 'regionName', 120)),
    lat = coalesce(s.lat, v_lat),
    lon = case when s.lat is null then v_lon else s.lon end,
    geo_radius = coalesce(s.geo_radius, v_radius),
    network = coalesce(s.network, left(p_session ->> 'network', 120)),
    details = case when v_details = '{}'::jsonb or pg_column_size(s.details) > 4000 then s.details else s.details || v_details end
  where s.id = v_sid and s.site_id = p_site;
  if not found then
    raise exception 'visita de outro site' using errcode = '42501';
  end if;

  update public.site_trackers set last_seen_at = now()
  where id = p_site and (last_seen_at is null or last_seen_at < now() - interval '1 minute');

  return v_count;
end
$function$
;

CREATE OR REPLACE FUNCTION public.site_report(p_site uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_tz text DEFAULT 'America/Sao_Paulo'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
  ),
  flags as (
    select session_id,
      bool_or(name = 'formulario') as form,
      bool_or(name = 'lead_qualificado') as qualified,
      bool_or(name = 'lead_nao_qualificado') as unqualified
    from ev where name in ('formulario', 'lead_qualificado', 'lead_nao_qualificado') group by session_id
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
        'converted', count(*) filter (where converted),
        'orders', coalesce(sum(orders), 0),
        'revenue', coalesce(sum(revenue), 0),
        'buyers', count(distinct visitor_id) filter (where orders > 0)
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
        'converted', count(*) filter (where converted),
        'orders', coalesce(sum(orders), 0),
        'revenue', coalesce(sum(revenue), 0),
        'buyers', count(distinct visitor_id) filter (where orders > 0)
      ) from sp
    ),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'sessions', sessions, 'visitors', visitors, 'pageviews', pageviews, 'converted', converted, 'orders', orders, 'revenue', revenue) order by day)
      from (
        select to_char(started_at at time zone p_tz, 'YYYY-MM-DD') as day, count(*) as sessions, count(distinct visitor_id) as visitors,
          coalesce(sum(pageviews), 0) as pageviews, count(*) filter (where converted) as converted,
          coalesce(sum(orders), 0) as orders, coalesce(sum(revenue), 0) as revenue
        from s group by 1
      ) d
    ), '[]'::jsonb),
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'sessions', sessions, 'visitors', visitors, 'converted', converted, 'activeMs', active, 'orders', orders, 'revenue', revenue) order by sessions desc)
      from (
        select channel, count(*) as sessions, count(distinct visitor_id) as visitors, count(*) filter (where converted) as converted, round(avg(active_ms)) as active,
          coalesce(sum(orders), 0) as orders, coalesce(sum(revenue), 0) as revenue
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
      select jsonb_agg(jsonb_build_object('channel', channel, 'source', source, 'medium', medium, 'campaign', campaign, 'sessions', sessions, 'converted', converted, 'orders', orders, 'revenue', revenue) order by sessions desc)
      from (
        select channel, source, medium, campaign, count(*) as sessions, count(*) filter (where converted) as converted,
          coalesce(sum(orders), 0) as orders, coalesce(sum(revenue), 0) as revenue
        from s where campaign is not null group by channel, source, medium, campaign order by count(*) desc limit 30
      ) c
    ), '[]'::jsonb),
    'ads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'channel', channel, 'source', source, 'medium', medium, 'campaign', campaign, 'adset', term, 'ad', content,
        'campaignId', campaign_id, 'adId', ad_id,
        'sessions', sessions, 'visitors', visitors, 'converted', converted, 'activeMs', active, 'bounces', bounces,
        'forms', forms, 'qualified', qualified, 'unqualified', unqualified, 'orders', orders, 'revenue', revenue
      ) order by sessions desc)
      from (
        select s.channel, s.source, s.medium, s.campaign, s.term, s.content,
          max(s.details ->> 'campaignId') as campaign_id, max(s.details ->> 'adId') as ad_id,
          count(*) as sessions, count(distinct s.visitor_id) as visitors, count(*) filter (where s.converted) as converted,
          round(avg(s.active_ms)) as active,
          count(*) filter (where s.pageviews <= 1 and not s.converted and s.active_ms < 10000) as bounces,
          count(*) filter (where f.form) as forms,
          count(*) filter (where f.qualified) as qualified,
          count(*) filter (where f.unqualified) as unqualified,
          coalesce(sum(s.orders), 0) as orders, coalesce(sum(s.revenue), 0) as revenue
        from s left join flags f on f.session_id = s.id
        where s.campaign is not null or s.content is not null or s.details ? 'campaignId'
        group by 1, 2, 3, 4, 5, 6 order by count(*) desc limit 200
      ) a
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
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'region', region, 'name', name, 'sessions', sessions, 'visitors', visitors, 'converted', converted, 'meta', meta) order by sessions desc)
      from (
        select coalesce(country, '') as country, region, max(region_name) as name, count(*) as sessions, count(distinct visitor_id) as visitors,
          count(*) filter (where converted) as converted, count(*) filter (where channel = 'Meta Ads') as meta
        from s where region is not null group by 1, 2
      ) r
    ), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'region', region, 'city', city, 'lat', lat, 'lon', lon, 'sessions', sessions, 'visitors', visitors, 'converted', converted) order by sessions desc)
      from (
        select coalesce(country, '') as country, region, city, round(avg(lat)::numeric, 2) as lat, round(avg(lon)::numeric, 2) as lon,
          count(*) as sessions, count(distinct visitor_id) as visitors, count(*) filter (where converted) as converted
        from s where city is not null and lat is not null group by 1, 2, 3 order by count(*) desc limit 300
      ) c
    ), '[]'::jsonb),
    'tzs', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n) order by n desc) from (select coalesce(tz, '') as k, count(*) as n from s group by 1 order by 2 desc limit 20) x), '[]'::jsonb),
    'langs', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n) order by n desc) from (select coalesce(lang, '') as k, count(*) as n from s group by 1 order by 2 desc limit 20) x), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'sessions', n))
      from (
        select extract(isodow from started_at at time zone p_tz)::integer as dow, extract(hour from started_at at time zone p_tz)::integer as hour, count(*) as n
        from s group by 1, 2
      ) h
    ), '[]'::jsonb),
    'currency', (select max(currency) from s where orders > 0),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('name', product, 'views', views, 'carts', carts, 'orders', orders) order by orders desc, carts desc, views desc)
      from (
        select left(data ->> 'produto', 120) as product,
          count(distinct session_id) filter (where name = 'produto') as views,
          count(distinct session_id) filter (where name = 'carrinho') as carts,
          count(*) filter (where name = 'compra') as orders
        from ev where name in ('produto', 'carrinho', 'compra') and coalesce(data ->> 'produto', '') <> ''
        group by 1 order by 4 desc, 3 desc, 2 desc limit 30
      ) x
    ), '[]'::jsonb),
    'notFound', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'views', views) order by views desc)
      from (select path, count(*) as views from pv where data ->> 'nf' = '1' group by path order by count(*) desc limit 20) n
    ), '[]'::jsonb)
  )
$function$
;
