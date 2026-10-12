-- Prospecção compartilhada (2026-10-12)
--
-- O funil e as buscas saem da pasta de cada conta (`<uid>/prospeccao/`) para
-- uma pasta só, `prospeccao/`, que todo admin lê e grava: a tela /prospeccao
-- já é só de admin, e o pedido foi que todos vissem as mesmas oportunidades.
-- Os arquivos têm contatos de pessoas, por isso a pasta não abre para as
-- outras contas.

create policy "Admin lê a prospecção" on storage.objects
  for select to authenticated
  using (bucket_id = 'space-projects' and (storage.foldername(name))[1] = 'prospeccao'
    and coalesce(public.has_role((select auth.uid()), 'admin'), false));
create policy "Admin envia a prospecção" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'space-projects' and (storage.foldername(name))[1] = 'prospeccao'
    and coalesce(public.has_role((select auth.uid()), 'admin'), false));
create policy "Admin troca a prospecção" on storage.objects
  for update to authenticated
  using (bucket_id = 'space-projects' and (storage.foldername(name))[1] = 'prospeccao'
    and coalesce(public.has_role((select auth.uid()), 'admin'), false))
  with check (bucket_id = 'space-projects' and (storage.foldername(name))[1] = 'prospeccao'
    and coalesce(public.has_role((select auth.uid()), 'admin'), false));
create policy "Admin apaga a prospecção" on storage.objects
  for delete to authenticated
  using (bucket_id = 'space-projects' and (storage.foldername(name))[1] = 'prospeccao'
    and coalesce(public.has_role((select auth.uid()), 'admin'), false));
