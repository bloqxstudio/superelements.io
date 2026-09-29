-- Pack Section Express para o app publicado. O repositório é público e o pack
-- é licenciado, então ele não vai no git nem nos arquivos do site: fica neste
-- bucket privado, que só contas logadas leem. O envio
-- (npm run sections:upload) usa a chave service_role, que ignora o RLS, por
-- isso não há política de escrita.
insert into storage.buckets (id, name, public)
values ('section-pack', 'section-pack', false)
on conflict (id) do nothing;

create policy "Contas logadas leem o pack de seções" on storage.objects
  for select to authenticated
  using (bucket_id = 'section-pack');
