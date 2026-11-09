-- Sincronização agendada do Instagram e dos anúncios da Meta (2026-11-09).
--
-- O usuário: "precisamos revisar a sinc de dados para funcionar sempre em tempo real e com dados reais,
-- tanto dos anúncios quanto do Instagram". Até aqui nada era lido da Meta em horário marcado: só quando
-- alguém abria a tela (que esperava a Meta) e o Início mostrava o que tinha ficado da última vez.
--
-- A cada 10 minutos este tick chama as funções para as contas que estão para vencer, uma conta (e um
-- período) por chamada, para caber no tempo de uma função:
--   - Instagram (`instagram`, ação `sync_account`): cada conta a cada ~1 hora (o limite de chamadas da
--     Meta é por conta e cada leitura completa faz dezenas de chamadas);
--   - anúncios (`meta-ads`, ação `cron_report`): o dia de hoje a cada ~15 minutos e 7 e 30 dias a cada
--     ~1 hora.
-- Usa o mesmo segredo e o mesmo endereço dos stories (Vault). O `meta-ads` continua com verify_jwt:
-- vai a chave pública (anon, a mesma do app) no Authorization, e quem decide é o segredo do cron.
-- Contas pausadas, com o módulo Instagram desligado ou com o acesso expirado ficam de fora.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'supabase_anon_key') then
    -- A chave pública do app (já está em src/integrations/supabase/client.ts); não é segredo
    perform vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mbWZjcGN3eWF2dXRudG5yeHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzNzA2MzcsImV4cCI6MjA2NTk0NjYzN30.AikXh3qHYCqwyIdy3_PUhdSduGTwL8ZyfpluygdPmtI',
      'supabase_anon_key',
      'Chave pública (anon) para o cron chamar funções com verify_jwt'
    );
  end if;
end $$;

create or replace function public.crm_social_sync_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_anon text;
  v_ads text;
  v_ig int := 0;
  v_reports int := 0;
  r record;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'stories_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'stories_cron_secret';
  select decrypted_secret into v_anon from vault.decrypted_secrets where name = 'supabase_anon_key';
  if v_url is null or v_secret is null then
    raise notice 'Sincronização: faltam os segredos stories_function_url e stories_cron_secret no Vault';
    return jsonb_build_object('instagram', 0, 'anuncios', 0, 'erro', 'segredos');
  end if;
  v_ads := regexp_replace(v_url, '/instagram$', '/meta-ads');

  -- Instagram: a conta mais antiga primeiro, até 6 por tick
  for r in
    select a.id
    from public.crm_instagram_accounts a
    join public.crm_instagram_tokens tk on tk.account_id = a.id
    join public.crm_teams t on t.id = a.team_id
    where coalesce(a.sync_error, '') <> 'token'
      and coalesce(t.status, '') <> 'pausada'
      and coalesce(t.modules ->> 'instagram', 'true') <> 'false'
      and (a.synced_at is null or a.synced_at < now() - interval '55 minutes')
    order by a.synced_at nulls first
    limit 6
  loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object('action', 'sync_account', 'accountId', r.id),
      timeout_milliseconds := 150000
    );
    v_ig := v_ig + 1;
  end loop;

  -- Anúncios: hoje a cada ~15 min, 7 e 30 dias a cada ~1 h; o relatório mais velho primeiro, até 8 por tick
  if v_anon is not null then
    for r in
      select a.id, p.preset
      from public.crm_ad_accounts a
      join public.crm_ad_tokens tk on tk.account_id = a.id
      join public.crm_teams t on t.id = a.team_id
      cross join (values ('today', interval '14 minutes'), ('last_7d', interval '55 minutes'), ('last_30d', interval '55 minutes')) as p(preset, age)
      left join public.crm_ad_reports rep on rep.account_id = a.id and rep.preset = p.preset
      where coalesce(a.sync_error, '') <> 'token'
        and coalesce(t.status, '') <> 'pausada'
        and coalesce(t.modules ->> 'instagram', 'true') <> 'false'
        and (rep.fetched_at is null or rep.fetched_at < now() - p.age)
      order by rep.fetched_at nulls first
      limit 8
    loop
      perform net.http_post(
        url := v_ads,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon, 'apikey', v_anon, 'x-cron-secret', v_secret),
        body := jsonb_build_object('action', 'cron_report', 'accountId', r.id, 'preset', r.preset),
        timeout_milliseconds := 150000
      );
      v_reports := v_reports + 1;
    end loop;
  end if;

  return jsonb_build_object('instagram', v_ig, 'anuncios', v_reports);
end;
$$;

revoke all on function public.crm_social_sync_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'crm-social-sync') then
    perform cron.unschedule('crm-social-sync');
  end if;
  perform cron.schedule('crm-social-sync', '*/10 * * * *', 'select public.crm_social_sync_tick()');
end $$;
