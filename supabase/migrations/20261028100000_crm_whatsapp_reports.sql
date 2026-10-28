-- WhatsApp da equipe: relatórios internos agendados (2026-10-28)
--
-- O serviço (`services/whatsapp`, `relatorios.ts`) manda um resumo (site, anúncios, funil)
-- só para quem está em `crm_whatsapp_commanders`, no horário combinado. Nunca para cliente,
-- nunca em massa: sem lista de comandantes não sai nada. Cada relatório sai uma vez por dia.

create table public.crm_whatsapp_reports (
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  -- diario: todo dia; semanal: só no dia da semana escolhido
  kind text not null check (kind in ('diario', 'semanal')),
  enabled boolean not null default false,
  -- Hora cheia em São Paulo (0 a 23)
  hour smallint not null default 8 check (hour between 0 and 23),
  -- Só no semanal: 0 domingo … 6 sábado
  weekday smallint not null default 1 check (weekday between 0 and 6),
  last_sent_on date,
  primary key (team_id, kind)
);

alter table public.crm_whatsapp_reports enable row level security;

create policy "Equipe vê os relatórios" on public.crm_whatsapp_reports
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor inclui relatório" on public.crm_whatsapp_reports
  for insert to authenticated with check (public.is_crm_manager(team_id));
create policy "Gestor muda relatório" on public.crm_whatsapp_reports
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id));
create policy "Gestor tira relatório" on public.crm_whatsapp_reports
  for delete to authenticated using (public.is_crm_manager(team_id));

-- O serviço reserva o relatório do dia antes de mandar: duas cópias ou uma nova tentativa não repetem
create or replace function public.crm_whatsapp_claim_report(p_team uuid, p_kind text, p_today date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed int;
begin
  update public.crm_whatsapp_reports
  set last_sent_on = p_today
  where team_id = p_team and kind = p_kind and enabled and (last_sent_on is null or last_sent_on < p_today);
  get diagnostics claimed = row_count;
  return claimed > 0;
end
$$;

revoke all on function public.crm_whatsapp_claim_report(uuid, text, date) from public, anon, authenticated;
grant execute on function public.crm_whatsapp_claim_report(uuid, text, date) to service_role;
