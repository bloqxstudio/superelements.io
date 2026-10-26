-- Projetos arquivados (2026-10-27)
--
-- Arquivar tira o projeto da lista principal sem apagar nada: o canvas, a marca,
-- o WordPress e os acessos continuam como estão, e o projeto volta ao desarquivar.
-- Vale para o projeto todo (quem o vê, vê arquivado); arquivar não conta como edição
-- e por isso não mexe em `updated_at`.

alter table public.space_projects add column archived_at timestamptz;
