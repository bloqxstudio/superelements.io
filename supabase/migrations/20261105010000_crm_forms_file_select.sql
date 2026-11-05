-- O arquivo público da configuração (`crm-forms/<conta>/<formulário>.json`) nunca era regravado: o upload
-- com upsert do Storage precisa também de SELECT no objeto, e o bucket só tinha INSERT, UPDATE e DELETE.
-- O site seguia mostrando a versão antiga enquanto a função `form-submit` conferia a nova, e o envio não
-- passava (erro num campo que a tela nem tinha). A equipe agora lê os arquivos da própria conta.
drop policy if exists "Equipe lê a configuração dos formulários" on storage.objects;
create policy "Equipe lê a configuração dos formulários" on storage.objects
  for select to authenticated
  using (bucket_id = 'crm-forms' and public.can_write_crm_form_file(name));
