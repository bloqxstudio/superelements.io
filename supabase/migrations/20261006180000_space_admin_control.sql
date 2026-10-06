-- Admin da plataforma: vê e edita qualquer projeto, sem publicar (2026-10-06)
--
-- Quem tem o papel 'admin' em user_roles acompanha os projetos de todas as
-- contas: lista, abre o canvas, salva (conteúdo, nome e contexto) e vê quem
-- tem acesso. Não publica: o WordPress do projeto (conexão e senha), os links
-- de aprovação e os convites continuam só com o dono e os convidados, porque
-- as políticas deles usam space_project_role, que este arquivo não muda.
-- Excluir o projeto continua só do dono.

create or replace function public.is_space_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role((select auth.uid()), 'admin'), false)
$$;

revoke all on function public.is_space_admin() from public;
grant execute on function public.is_space_admin() to authenticated;

-- Pasta `<dono>/<projeto>/` de um projeto que existe
create or replace function public.is_space_project_folder(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_projects p
    where p.owner_id::text = (storage.foldername(p_name))[1]
      and p.id::text = (storage.foldername(p_name))[2]
  )
$$;

revoke all on function public.is_space_project_folder(text) from public;
grant execute on function public.is_space_project_folder(text) to authenticated;

-- Projetos: o admin lê e salva todos; excluir não
create policy "Admin vê todos os projetos" on public.space_projects
  for select to authenticated using (public.is_space_admin());
create policy "Admin salva qualquer projeto" on public.space_projects
  for update to authenticated using (public.is_space_admin()) with check (public.is_space_admin());

-- Quem tem acesso a cada projeto
create policy "Admin vê quem tem acesso" on public.space_project_members
  for select to authenticated using (public.is_space_admin());

-- Arquivos do conteúdo: lê os do projeto; grava e apaga só as versões do
-- conteúdo (doc-*.json), que é o que salvar faz. Backups de publicação e
-- outros arquivos ficam só com o dono e os convidados.
create policy "Admin lê os arquivos dos projetos" on storage.objects
  for select to authenticated
  using (bucket_id = 'space-projects' and public.is_space_admin() and public.is_space_project_folder(name));
create policy "Admin grava o conteúdo dos projetos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'space-projects' and public.is_space_admin() and public.is_space_project_folder(name)
    and storage.filename(name) like 'doc-%.json'
  );
create policy "Admin apaga versões antigas do conteúdo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'space-projects' and public.is_space_admin() and public.is_space_project_folder(name)
    and storage.filename(name) like 'doc-%.json'
  );

-- Pessoas com acesso, com o e-mail: também para o admin
create or replace function public.space_project_people(p_project uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select people.user_id, people.email, people.role, people.joined_at
  from (
    select p.owner_id as user_id, coalesce(u.email, '')::text as email, 'owner'::text as role, p.created_at as joined_at
    from public.space_projects p
    left join auth.users u on u.id = p.owner_id
    where p.id = p_project
    union all
    select m.user_id, coalesce(u.email, '')::text, m.role, m.created_at
    from public.space_project_members m
    left join auth.users u on u.id = m.user_id
    where m.project_id = p_project
  ) people
  where public.space_project_role(p_project) is not null or public.is_space_admin()
  order by (people.role = 'owner') desc, people.joined_at
$$;

revoke all on function public.space_project_people(uuid) from public;
grant execute on function public.space_project_people(uuid) to authenticated;

-- Canal ao vivo: o admin entra (quem está no projeto o vê online, e os
-- salvamentos de um e de outro não entram em conflito)
create or replace function public.can_join_space_project_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_topic !~ '^space-project:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.space_project_role(substring(p_topic from 15)::uuid) is not null
    or (public.is_space_admin() and exists (select 1 from public.space_projects p where p.id = substring(p_topic from 15)::uuid));
end
$$;

revoke all on function public.can_join_space_project_topic(text) from public;
grant execute on function public.can_join_space_project_topic(text) to authenticated;
