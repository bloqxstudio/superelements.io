-- Rascunho e versão no ar separados. Até aqui o editor salvava sozinho a cada mudança e um formulário
-- publicado ia para o ar no mesmo instante, incompleto ou com erro (2026-11-05: uma etapa vazia e uma
-- pergunta "Opção 1 / Opção 2" chegaram ao /f/site). Agora as colunas definition, theme e settings são o
-- rascunho; `live` guarda o que está no ar ({name, definition, theme, settings}) e só muda quando a
-- pessoa publica as alterações, depois da conferência do editor. A função `form-submit` lê `live`.
alter table public.crm_forms add column if not exists live jsonb;
alter table public.crm_forms add column if not exists live_at timestamptz;

update public.crm_forms
set live = jsonb_build_object('name', name, 'definition', definition, 'theme', theme, 'settings', settings),
    live_at = updated_at
where status = 'published' and live is null;

comment on column public.crm_forms.live is 'Versão no ar: {name, definition, theme, settings}. As colunas definition/theme/settings são o rascunho.';
