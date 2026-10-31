-- Formulários: a configuração publicada vai para um arquivo público (2026-10-31)
--
-- Para o formulário abrir rápido no site, o app grava a definição de cada formulário publicado em
-- `crm-forms/<conta>/<formulário>.json`, servido pelo CDN do Storage (sem acordar função nem consultar
-- o banco). O arquivo só tem o que o visitante já vê (campos, textos, tema). Quem escreve é a equipe da
-- conta; a leitura é pública. O envio das respostas continua passando pela função `form-submit`, que
-- valida contra o banco e recusa formulário em rascunho.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-forms', 'crm-forms', true, 262144, array['application/json'])
on conflict (id) do update set public = true, file_size_limit = 262144, allowed_mime_types = array['application/json'];

create or replace function public.can_write_crm_form_file(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  team text := (storage.foldername(p_name))[1];
begin
  if coalesce(team, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_crm_member(team::uuid);
end
$fn$;

revoke all on function public.can_write_crm_form_file(text) from public;
grant execute on function public.can_write_crm_form_file(text) to authenticated;

create policy "Equipe grava a configuração dos formulários" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'crm-forms' and public.can_write_crm_form_file(name));
create policy "Equipe atualiza a configuração dos formulários" on storage.objects
  for update to authenticated
  using (bucket_id = 'crm-forms' and public.can_write_crm_form_file(name))
  with check (bucket_id = 'crm-forms' and public.can_write_crm_form_file(name));
create policy "Equipe apaga a configuração dos formulários" on storage.objects
  for delete to authenticated
  using (bucket_id = 'crm-forms' and public.can_write_crm_form_file(name));
