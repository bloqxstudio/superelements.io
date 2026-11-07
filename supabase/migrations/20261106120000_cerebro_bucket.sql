-- Segundo cérebro (cerebro/ no repositório) visto no app publicado: uma cópia privada no bucket
-- `cerebro`, enviada pela tela /cerebro no npm run dev. Só o admin da plataforma lê e grava.
insert into storage.buckets (id, name, public, file_size_limit)
values ('cerebro', 'cerebro', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Admin lê o cérebro" on storage.objects;
create policy "Admin lê o cérebro" on storage.objects for select to authenticated
  using (bucket_id = 'cerebro' and public.crm_is_platform_admin());

drop policy if exists "Admin grava o cérebro" on storage.objects;
create policy "Admin grava o cérebro" on storage.objects for insert to authenticated
  with check (bucket_id = 'cerebro' and public.crm_is_platform_admin());

drop policy if exists "Admin troca o cérebro" on storage.objects;
create policy "Admin troca o cérebro" on storage.objects for update to authenticated
  using (bucket_id = 'cerebro' and public.crm_is_platform_admin())
  with check (bucket_id = 'cerebro' and public.crm_is_platform_admin());

drop policy if exists "Admin apaga do cérebro" on storage.objects;
create policy "Admin apaga do cérebro" on storage.objects for delete to authenticated
  using (bucket_id = 'cerebro' and public.crm_is_platform_admin());
