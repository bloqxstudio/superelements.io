-- Módulos no servidor (2026-10-27)
--
-- A barreira das tabelas (20261027160000) cobre quem usa o app. Aqui entram as peças que
-- rodam sem uma pessoa na tela e usam a chave de serviço, e por isso não passam por RLS:
--   * a coleta do site (`site_collect`) ignora visitas de uma conta com o módulo desligado;
--   * o cron dos stories não reserva stories de uma conta sem o módulo do Instagram;
--   * desligar o módulo do WhatsApp (ou pausar a conta) pede ao serviço para desconectar o
--     número (`wanted = false`, o mesmo de "Desconectar" na tela).
-- As funções `instagram` e `meta-ads` conferem o módulo no próprio código.

-- ---------- coleta do site ----------

do $$
begin
  if to_regprocedure('public.site_collect_core(uuid, text, jsonb, jsonb)') is null
     and to_regprocedure('public.site_collect(uuid, text, jsonb, jsonb)') is not null then
    alter function public.site_collect(uuid, text, jsonb, jsonb) rename to site_collect_core;
  end if;
end
$$;

create or replace function public.site_collect(p_site uuid, p_host text, p_session jsonb, p_hits jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  select t.team_id into v_team from public.site_trackers t where t.id = p_site;
  -- Conta sem o módulo (ou pausada): a visita não é guardada, e o site do cliente não sente nada
  if v_team is not null and not public.crm_module_on(v_team, 'site') then
    return 0;
  end if;
  return public.site_collect_core(p_site, p_host, p_session, p_hits);
end
$$;

revoke all on function public.site_collect(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.site_collect(uuid, text, jsonb, jsonb) to service_role;
revoke all on function public.site_collect_core(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.site_collect_core(uuid, text, jsonb, jsonb) to service_role;

-- ---------- stories agendados ----------

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
        and public.crm_module_on(c.team_id, 'instagram')
      order by c.publish_at
      limit greatest(1, least(coalesce(p_max, 2), 10))
      for update skip locked
   )
  returning s.*;
end
$$;

revoke all on function public.crm_claim_stories(integer) from public, anon, authenticated;
grant execute on function public.crm_claim_stories(integer) to service_role;

-- ---------- número de WhatsApp ----------

create or replace function public.crm_modules_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.crm_whatsapp_numbers') is not null and not public.crm_module_on(new.id, 'whatsapp') then
    execute 'update public.crm_whatsapp_numbers set wanted = false where team_id = $1 and wanted' using new.id;
  end if;
  return null;
end
$$;

drop trigger if exists crm_teams_modules_sync on public.crm_teams;
create trigger crm_teams_modules_sync
  after update of modules, status on public.crm_teams
  for each row
  when (old.modules is distinct from new.modules or old.status is distinct from new.status)
  execute function public.crm_modules_sync();
