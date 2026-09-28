-- Projetos do Space na conta de quem cria: a lista e a conexão com o WordPress
-- ficam em tabelas; o conteúdo (canvas com as páginas, marca, kit do site e as
-- versões anteriores das páginas publicadas) fica no bucket privado
-- `space-projects`, em `<dono>/<projeto>/...`, porque passa fácil de 1 MB.

create table public.space_projects (
  -- Gerado no navegador: os projetos que já existiam só no navegador sobem com o mesmo id
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  context text not null default '',
  -- O que o card mostra sem abrir o projeto (seções, páginas, cores, logo pequeno)
  summary jsonb not null default '{}'::jsonb,
  -- Arquivo do conteúdo no bucket; cada salvamento grava um arquivo novo e troca o caminho aqui
  doc_path text,
  -- Sobe a cada salvamento; quem salva manda a revisão que abriu, e perde se outro salvou antes
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  -- Última mudança no conteúdo, no nome ou no contexto (mexer só no zoom não conta)
  updated_at timestamptz not null default now()
);

create index space_projects_owner_idx on public.space_projects (owner_id, updated_at desc);

alter table public.space_projects enable row level security;

create policy "Dono lê os seus projetos" on public.space_projects
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Dono cria projetos" on public.space_projects
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Dono edita os seus projetos" on public.space_projects
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Dono apaga os seus projetos" on public.space_projects
  for delete to authenticated using (owner_id = (select auth.uid()));

-- O WordPress do cliente ligado ao projeto. A senha de aplicação fica numa coluna
-- à parte e só o dono lê; desconectar revoga no site e apaga a linha.
create table public.space_wordpress_connections (
  project_id uuid primary key references public.space_projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Site, usuário, permissões e datas (tudo menos a senha)
  connection jsonb not null,
  password text not null,
  updated_at timestamptz not null default now()
);

create index space_wordpress_connections_owner_idx on public.space_wordpress_connections (owner_id);

alter table public.space_wordpress_connections enable row level security;

create policy "Dono lê as suas conexões" on public.space_wordpress_connections
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Dono conecta os seus projetos" on public.space_wordpress_connections
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.space_projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );
create policy "Dono atualiza as suas conexões" on public.space_wordpress_connections
  for update to authenticated using (owner_id = (select auth.uid())) with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.space_projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );
create policy "Dono desconecta os seus projetos" on public.space_wordpress_connections
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Conteúdo dos projetos: cada conta só enxerga a própria pasta
insert into storage.buckets (id, name, public)
values ('space-projects', 'space-projects', false)
on conflict (id) do nothing;

create policy "Dono lê os arquivos dos seus projetos" on storage.objects
  for select to authenticated
  using (bucket_id = 'space-projects' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Dono envia arquivos dos seus projetos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'space-projects' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Dono troca arquivos dos seus projetos" on storage.objects
  for update to authenticated
  using (bucket_id = 'space-projects' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'space-projects' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Dono apaga arquivos dos seus projetos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'space-projects' and (storage.foldername(name))[1] = (select auth.uid())::text);
