-- Funis: a conta da etapa vem do funil em TODO insert e update (2026-10-30)
--
-- A migração 20261030120000 só disparava o gatilho em "insert or update of funnel_id": um update
-- direto de team_id deixava a etapa numa conta diferente da do funil. Agora a coluna é sempre
-- recalculada a partir do funil, qualquer que seja o comando.

create or replace function public.crm_funnel_step_team()
returns trigger
language plpgsql
as $$
begin
  select f.team_id into new.team_id from public.crm_funnels f where f.id = new.funnel_id;
  if new.team_id is null then
    raise exception 'Funil não encontrado.' using errcode = '23503';
  end if;
  return new;
end
$$;

drop trigger if exists crm_funnel_steps_team on public.crm_funnel_steps;

create trigger crm_funnel_steps_team before insert or update on public.crm_funnel_steps
  for each row execute function public.crm_funnel_step_team();
