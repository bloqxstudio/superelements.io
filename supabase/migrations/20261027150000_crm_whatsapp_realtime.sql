-- WhatsApp da equipe: garante a Realtime nas conversas e mensagens (2026-10-27)
--
-- As migrações anteriores só avisam e seguem quando a tabela não entra na
-- publicação; sem ela a tela e o contador do menu só mudam ao recarregar.
-- Repetir esta é seguro.

do $$
declare
  t text;
begin
  foreach t in array array['crm_whatsapp_chats', 'crm_whatsapp_messages'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end
$$;
