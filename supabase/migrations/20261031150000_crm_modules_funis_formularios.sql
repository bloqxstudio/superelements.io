-- Interruptores por conta para mais funcionalidades: Clientes, Funis, Formulários,
-- Relacionamento nas redes, Prospecção e Diagnóstico. O que não está em `modules` fica ligado.
create or replace function public.crm_known_modules()
returns text[]
language sql
immutable
as $$
  select array['projetos', 'agentes', 'copy', 'criativos', 'skills', 'crm', 'clientes', 'funis', 'formularios',
               'social', 'prospeccao', 'diagnostico', 'whatsapp', 'instagram', 'site']
$$;

-- O banco também barra funis e formulários quando o módulo está desligado
do $$
declare
  spec text[];
  specs text[][] := array[
    ['funis', 'crm_funnels'], ['funis', 'crm_funnel_steps'],
    ['formularios', 'crm_forms'], ['formularios', 'crm_form_submissions']
  ];
begin
  foreach spec slice 1 in array specs loop
    if to_regclass('public.' || spec[2]) is not null then
      execute format('drop policy if exists %I on public.%I', 'Módulo ' || spec[1] || ' ligado', spec[2]);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.crm_module_on(team_id, %L)) with check (public.crm_module_on(team_id, %L))',
        'Módulo ' || spec[1] || ' ligado', spec[2], spec[1], spec[1]);
    end if;
  end loop;
end
$$;
