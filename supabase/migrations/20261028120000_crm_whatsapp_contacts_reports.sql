-- WhatsApp da equipe: números cadastrados entram nos relatórios agendados e valem para a conta da casa (2026-10-28)
--
-- `reports`: o telefone recebe o resumo agendado (`crm_whatsapp_reports`) com os dados da conta dele,
-- nos assuntos liberados. Segue sem iniciar contato: só sai para quem já escreveu ao número da equipe.
-- A conta da casa também pode ser cadastrada (uma pessoa da equipe sem ser comandante, por exemplo).

alter table public.crm_whatsapp_client_contacts
  add column reports boolean not null default false;

alter table public.crm_whatsapp_client_contacts
  drop constraint crm_whatsapp_client_contacts_check;
