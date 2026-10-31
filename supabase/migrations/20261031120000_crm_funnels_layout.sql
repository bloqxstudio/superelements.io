-- Mapa do funil (2026-10-31): a organização dos cartões no canvas fica no funil e vale para toda a equipe.
-- Chave = índice da etapa ("0", "1"…), valor = {x, y}. Quem edita o funil (gestor) grava, pela política que já existe.
alter table public.crm_funnels
  add column if not exists layout jsonb not null default '{}'::jsonb
  check (jsonb_typeof(layout) = 'object' and length(layout::text) <= 4000);
