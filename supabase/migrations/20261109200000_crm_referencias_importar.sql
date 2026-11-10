-- Importar do grupo pela tela, com o andamento (2026-11-09).
--
-- O usuário: "temos novas referências no grupo, importe para o app na aba referências, podemos ter um fluxo
-- por tela pra isso? Pra clicar e fazer?". A tela pede quantos posts recentes ler (`run_limit`) e o Mac
-- (`services/referencias`) escreve o andamento: a etapa, quantos posts novos achou e quantos já importou.

alter table public.crm_reference_sources
  add column if not exists run_limit integer check (run_limit is null or run_limit between 1 and 60),
  add column if not exists run_stage text check (run_stage is null or run_stage in ('lendo', 'importando', 'pronto', 'erro')),
  add column if not exists run_started_at timestamptz,
  add column if not exists run_total integer,
  add column if not exists run_done integer,
  add column if not exists run_note text check (run_note is null or length(run_note) <= 200);
