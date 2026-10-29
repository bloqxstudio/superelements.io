-- WhatsApp: cada cliente escolhe quando recebe o relatório da própria conta (2026-10-29)
--
-- Até aqui o relatório dos números de clientes seguia o horário único de `crm_whatsapp_reports`.
-- Agora cada telefone cadastrado tem o seu: diário, semanal ou mensal, com hora (São Paulo),
-- dia da semana ou dia do mês. `reports` continua ligando e desligando. O relatório só sai
-- numa conversa que a pessoa já abriu e uma vez por dia (`report_last_on`).

alter table public.crm_whatsapp_client_contacts
  add column report_kind text not null default 'semanal' check (report_kind in ('diario', 'semanal', 'mensal')),
  add column report_hour smallint not null default 9 check (report_hour between 0 and 23),
  add column report_weekday smallint not null default 1 check (report_weekday between 0 and 6),
  add column report_monthday smallint not null default 1 check (report_monthday between 1 and 28),
  add column report_last_on date;

-- O serviço reserva o relatório do dia antes de montar: duas cópias ou nova tentativa não repetem
create or replace function public.crm_whatsapp_claim_contact_report(p_team uuid, p_phone text, p_today date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed int;
begin
  update public.crm_whatsapp_client_contacts
  set report_last_on = p_today
  where team_id = p_team and phone = p_phone and enabled and reports
    and (report_last_on is null or report_last_on < p_today);
  get diagnostics claimed = row_count;
  return claimed > 0;
end
$$;

revoke all on function public.crm_whatsapp_claim_contact_report(uuid, text, date) from public, anon, authenticated;
grant execute on function public.crm_whatsapp_claim_contact_report(uuid, text, date) to service_role;
