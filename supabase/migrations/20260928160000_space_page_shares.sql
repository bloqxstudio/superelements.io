-- Link de aprovação: uma foto (HTML renderizado) de uma página do projeto que
-- o cliente abre sem login, para aprovar ou pedir ajuste antes de a página ir
-- para o WordPress dele. O id do link é o próprio segredo (uuid aleatório).
--
-- Quem tem o link só enxerga aquele link: as tabelas não têm leitura pública;
-- a página pública lê e responde por duas funções (security definer). O HTML
-- fica no bucket público `space-page-shares`, em `<link>/<arquivo>.html`, que
-- ninguém consegue listar; desativar o link apaga a linha e os arquivos.

create table public.space_page_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.space_projects (id) on delete cascade,
  -- Página do canvas (id do navegador): um link por página
  page_id text not null,
  -- Nomes do momento da foto, para a página pública não depender do projeto
  project_name text not null,
  page_name text not null,
  -- Arquivo da foto atual no bucket; cada atualização grava um arquivo novo
  html_path text not null,
  -- Resumo do HTML da foto, para o app saber se a página mudou depois
  html_hash text not null,
  -- Sobe a cada atualização; a resposta vale para a versão que o cliente viu
  version integer not null default 1,
  shared_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, page_id)
);

create index space_page_shares_owner_idx on public.space_page_shares (owner_id, project_id);

alter table public.space_page_shares enable row level security;

create policy "Dono lê os seus links" on public.space_page_shares
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Dono cria links dos seus projetos" on public.space_page_shares
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.space_projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );
create policy "Dono atualiza os seus links" on public.space_page_shares
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Dono apaga os seus links" on public.space_page_shares
  for delete to authenticated using (owner_id = (select auth.uid()));

-- O que o cliente respondeu, sempre ligado à versão que ele viu
create table public.space_page_share_responses (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.space_page_shares (id) on delete cascade,
  version integer not null,
  decision text not null check (decision in ('approved', 'changes')),
  name text not null default '' check (char_length(name) <= 120),
  note text not null default '' check (char_length(note) <= 4000),
  created_at timestamptz not null default now()
);

create index space_page_share_responses_share_idx on public.space_page_share_responses (share_id, created_at desc);

alter table public.space_page_share_responses enable row level security;

-- Só o dono do link lê; ninguém grava direto (o cliente responde pela função)
create policy "Dono lê as respostas dos seus links" on public.space_page_share_responses
  for select to authenticated using (
    exists (select 1 from public.space_page_shares s where s.id = share_id and s.owner_id = (select auth.uid()))
  );

-- Página pública: o link e as respostas da versão atual
create or replace function public.get_page_share(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'project_name', s.project_name,
    'page_name', s.page_name,
    'html_path', s.html_path,
    'version', s.version,
    'shared_at', s.shared_at,
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object('decision', r.decision, 'name', r.name, 'note', r.note, 'created_at', r.created_at) order by r.created_at desc)
      from (
        select * from public.space_page_share_responses r
        where r.share_id = s.id and r.version = s.version
        order by r.created_at desc
        limit 20
      ) r
    ), '[]'::jsonb)
  )
  from public.space_page_shares s
  where s.id = p_id
$$;

-- Página pública: aprovar ou pedir ajuste na versão que o cliente está vendo
create or replace function public.respond_page_share(p_id uuid, p_version integer, p_decision text, p_name text, p_note text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version integer;
  answered integer;
  answered_at timestamptz;
begin
  select version into current_version from public.space_page_shares where id = p_id;
  if current_version is null then
    raise exception 'link_inativo';
  end if;
  if p_version is distinct from current_version then
    raise exception 'versao_antiga';
  end if;
  if p_decision is null or p_decision not in ('approved', 'changes') then
    raise exception 'decisao_invalida';
  end if;
  if p_decision = 'changes' and coalesce(btrim(p_note), '') = '' then
    raise exception 'comentario_obrigatorio';
  end if;
  -- Freio contra envio em massa: um link recebe no máximo 200 respostas
  select count(*) into answered from public.space_page_share_responses where share_id = p_id;
  if answered >= 200 then
    raise exception 'limite_respostas';
  end if;

  insert into public.space_page_share_responses (share_id, version, decision, name, note)
  values (p_id, current_version, p_decision, left(coalesce(btrim(p_name), ''), 120), left(coalesce(btrim(p_note), ''), 4000))
  returning created_at into answered_at;
  return answered_at;
end
$$;

revoke all on function public.get_page_share(uuid) from public;
revoke all on function public.respond_page_share(uuid, integer, text, text, text) from public;
grant execute on function public.get_page_share(uuid) to anon, authenticated;
grant execute on function public.respond_page_share(uuid, integer, text, text, text) to anon, authenticated;

-- Fotos das páginas: leitura pública pelo endereço, sem listagem; só o dono do link grava
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('space-page-shares', 'space-page-shares', true, 20971520, array['text/html'])
on conflict (id) do nothing;

create policy "Dono lê as fotos dos seus links" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'space-page-shares'
    and exists (select 1 from public.space_page_shares s where s.id::text = (storage.foldername(name))[1] and s.owner_id = (select auth.uid()))
  );
create policy "Dono envia fotos dos seus links" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'space-page-shares'
    and exists (select 1 from public.space_page_shares s where s.id::text = (storage.foldername(name))[1] and s.owner_id = (select auth.uid()))
  );
create policy "Dono troca fotos dos seus links" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'space-page-shares'
    and exists (select 1 from public.space_page_shares s where s.id::text = (storage.foldername(name))[1] and s.owner_id = (select auth.uid()))
  );
create policy "Dono apaga fotos dos seus links" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'space-page-shares'
    and exists (select 1 from public.space_page_shares s where s.id::text = (storage.foldername(name))[1] and s.owner_id = (select auth.uid()))
  );
