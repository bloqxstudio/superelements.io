-- Acesso compartilhado a um projeto do Space: o dono convida o cliente por um
-- link, o cliente entra com a conta dele e passa a editar as páginas, a marca
-- e a publicar no WordPress conectado, junto com o dono.
--
-- Papéis: `owner` é quem criou o projeto (space_projects.owner_id); `editor`
-- é quem entrou por convite. O editor faz tudo no canvas e no WordPress, mas
-- não exclui o projeto nem convida ou tira pessoas; pode sair quando quiser.
--
-- O conteúdo continua na pasta do dono (`<dono>/<projeto>/` no bucket
-- `space-projects`), e as linhas da conexão e dos links de aprovação ficam
-- sempre com o dono do projeto, mesmo quando o editor cria.

-- Quem tem acesso a um projeto, além do dono
create table public.space_project_members (
  project_id uuid not null references public.space_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('editor')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index space_project_members_user_idx on public.space_project_members (user_id);

-- Convite por link: o id é o segredo; vale uma vez e expira em 7 dias
create table public.space_project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.space_projects (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Para quem é (nome ou e-mail), só para o dono se lembrar
  label text not null default '' check (char_length(label) <= 120),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

create index space_project_invites_project_idx on public.space_project_invites (project_id, created_at desc);

-- Papel de quem chama no projeto: 'owner', 'editor' ou null (sem acesso).
-- Security definer para as políticas poderem perguntar sem cair em recursão.
create or replace function public.space_project_role(p_project uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.space_projects p where p.id = p_project and p.owner_id = (select auth.uid())) then 'owner'
    else (select m.role from public.space_project_members m where m.project_id = p_project and m.user_id = (select auth.uid()))
  end
$$;

revoke all on function public.space_project_role(uuid) from public;
grant execute on function public.space_project_role(uuid) to authenticated;

-- Arquivo `<dono>/<projeto>/...` do bucket de conteúdo de um projeto a que quem chama tem acesso
create or replace function public.can_use_space_project_file(p_name text)
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
      and public.space_project_role(p.id) is not null
  )
$$;

revoke all on function public.can_use_space_project_file(text) from public;
grant execute on function public.can_use_space_project_file(text) to authenticated;

-- Foto `<link>/...` de um link de aprovação de um projeto a que quem chama tem acesso
create or replace function public.can_use_page_share_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_page_shares s
    where s.id::text = (storage.foldername(p_name))[1]
      and public.space_project_role(s.project_id) is not null
  )
$$;

revoke all on function public.can_use_page_share_file(text) from public;
grant execute on function public.can_use_page_share_file(text) to authenticated;

-- O dono de um projeto não muda (nem o id), mesmo quando o editor salva
create or replace function public.keep_space_project_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
    raise exception 'dono_fixo';
  end if;
  return new;
end
$$;

create trigger space_projects_keep_owner
  before update on public.space_projects
  for each row execute function public.keep_space_project_owner();

-- Conexão e links de aprovação ficam com o dono do projeto, seja quem for que grave
create or replace function public.set_space_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.owner_id into new.owner_id from public.space_projects p where p.id = new.project_id;
  return new;
end
$$;

create trigger space_wordpress_connections_owner
  before insert or update on public.space_wordpress_connections
  for each row execute function public.set_space_project_owner();

create trigger space_page_shares_owner
  before insert or update on public.space_page_shares
  for each row execute function public.set_space_project_owner();

-- Pessoas do projeto: quem tem acesso vê a lista; o dono tira alguém; cada um pode sair.
-- Ninguém grava direto: entrar é pelo convite (accept_space_invite).
alter table public.space_project_members enable row level security;

create policy "Equipe vê quem tem acesso" on public.space_project_members
  for select to authenticated using (public.space_project_role(project_id) is not null);
create policy "Dono tira pessoas e cada um sai" on public.space_project_members
  for delete to authenticated using (public.space_project_role(project_id) = 'owner' or user_id = (select auth.uid()));

-- Convites: só o dono cria, vê e cancela; quem recebe lê pelo get_space_invite
alter table public.space_project_invites enable row level security;

create policy "Dono vê os convites" on public.space_project_invites
  for select to authenticated using (public.space_project_role(project_id) = 'owner');
create policy "Dono convida" on public.space_project_invites
  for insert to authenticated with check (public.space_project_role(project_id) = 'owner' and created_by = (select auth.uid()));
create policy "Dono cancela convites" on public.space_project_invites
  for delete to authenticated using (public.space_project_role(project_id) = 'owner');

-- Projeto: o editor lê e salva (conteúdo, nome, contexto); excluir continua só do dono
create policy "Equipe lê os projetos compartilhados" on public.space_projects
  for select to authenticated using (public.space_project_role(id) = 'editor');
create policy "Equipe salva os projetos compartilhados" on public.space_projects
  for update to authenticated using (public.space_project_role(id) = 'editor') with check (public.space_project_role(id) = 'editor');

-- WordPress: quem tem acesso conecta, publica e desconecta
create policy "Equipe lê a conexão" on public.space_wordpress_connections
  for select to authenticated using (public.space_project_role(project_id) is not null);
create policy "Equipe conecta" on public.space_wordpress_connections
  for insert to authenticated with check (public.space_project_role(project_id) is not null);
create policy "Equipe atualiza a conexão" on public.space_wordpress_connections
  for update to authenticated using (public.space_project_role(project_id) is not null) with check (public.space_project_role(project_id) is not null);
create policy "Equipe desconecta" on public.space_wordpress_connections
  for delete to authenticated using (public.space_project_role(project_id) is not null);

-- Links de aprovação: quem tem acesso cria, atualiza, desativa e lê as respostas
create policy "Equipe lê os links" on public.space_page_shares
  for select to authenticated using (public.space_project_role(project_id) is not null);
create policy "Equipe cria links" on public.space_page_shares
  for insert to authenticated with check (public.space_project_role(project_id) is not null);
create policy "Equipe atualiza links" on public.space_page_shares
  for update to authenticated using (public.space_project_role(project_id) is not null) with check (public.space_project_role(project_id) is not null);
create policy "Equipe apaga links" on public.space_page_shares
  for delete to authenticated using (public.space_project_role(project_id) is not null);

create policy "Equipe lê as respostas" on public.space_page_share_responses
  for select to authenticated using (
    exists (select 1 from public.space_page_shares s where s.id = share_id and public.space_project_role(s.project_id) is not null)
  );

-- Arquivos do conteúdo, na pasta do dono
create policy "Equipe lê os arquivos do projeto" on storage.objects
  for select to authenticated
  using (bucket_id = 'space-projects' and public.can_use_space_project_file(name));
create policy "Equipe envia arquivos do projeto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'space-projects' and public.can_use_space_project_file(name));
create policy "Equipe troca arquivos do projeto" on storage.objects
  for update to authenticated
  using (bucket_id = 'space-projects' and public.can_use_space_project_file(name))
  with check (bucket_id = 'space-projects' and public.can_use_space_project_file(name));
create policy "Equipe apaga arquivos do projeto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'space-projects' and public.can_use_space_project_file(name));

-- Fotos dos links de aprovação
create policy "Equipe lê as fotos dos links" on storage.objects
  for select to authenticated
  using (bucket_id = 'space-page-shares' and public.can_use_page_share_file(name));
create policy "Equipe envia fotos dos links" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'space-page-shares' and public.can_use_page_share_file(name));
create policy "Equipe troca fotos dos links" on storage.objects
  for update to authenticated
  using (bucket_id = 'space-page-shares' and public.can_use_page_share_file(name));
create policy "Equipe apaga fotos dos links" on storage.objects
  for delete to authenticated
  using (bucket_id = 'space-page-shares' and public.can_use_page_share_file(name));

-- Página do convite: o que quem abriu o link pode saber antes de entrar
create or replace function public.get_space_invite(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'project_id', case when public.space_project_role(i.project_id) is not null then i.project_id end,
    'project_name', p.name,
    'invited_by', coalesce(u.email, ''),
    'expires_at', i.expires_at,
    'status', case
      when public.space_project_role(i.project_id) is not null then 'member'
      when i.accepted_at is not null then 'used'
      when i.expires_at < now() then 'expired'
      else 'valid'
    end
  )
  from public.space_project_invites i
  join public.space_projects p on p.id = i.project_id
  left join auth.users u on u.id = i.created_by
  where i.id = p_id
$$;

-- Entrar no projeto pelo convite; devolve o id do projeto
create or replace function public.accept_space_invite(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite record;
begin
  if uid is null then
    raise exception 'login_necessario';
  end if;
  select i.id, i.project_id, i.created_by, i.expires_at, i.accepted_at into invite
  from public.space_project_invites i
  where i.id = p_id
  for update;
  if not found then
    raise exception 'convite_inativo';
  end if;
  -- Quem já tem acesso (o dono testando o link, ou quem já entrou) não gasta o convite
  if public.space_project_role(invite.project_id) is not null then
    return invite.project_id;
  end if;
  if invite.accepted_at is not null then
    raise exception 'convite_usado';
  end if;
  if invite.expires_at < now() then
    raise exception 'convite_expirado';
  end if;

  insert into public.space_project_members (project_id, user_id, invited_by)
  values (invite.project_id, uid, invite.created_by);
  update public.space_project_invites set accepted_by = uid, accepted_at = now() where id = p_id;
  return invite.project_id;
end
$$;

-- Pessoas com acesso (o dono primeiro), com o e-mail da conta; só para quem tem acesso
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
  where public.space_project_role(p_project) is not null
  order by (people.role = 'owner') desc, people.joined_at
$$;

revoke all on function public.space_project_people(uuid) from public;
grant execute on function public.space_project_people(uuid) to authenticated;

revoke all on function public.get_space_invite(uuid) from public;
revoke all on function public.accept_space_invite(uuid) from public;
grant execute on function public.get_space_invite(uuid) to anon, authenticated;
grant execute on function public.accept_space_invite(uuid) to authenticated;

-- Canal ao vivo do projeto (`space-project:<id>`, privado): quem está aberto
-- agora e o aviso de que alguém salvou. Só quem tem acesso entra e fala.
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
  return public.space_project_role(substring(p_topic from 15)::uuid) is not null;
end
$$;

revoke all on function public.can_join_space_project_topic(text) from public;
grant execute on function public.can_join_space_project_topic(text) to authenticated;

-- Sem o Realtime com autorização, o projeto funciona igual: só não mostra quem está junto
do $$
begin
  create policy "Equipe ouve o canal do projeto" on realtime.messages
    for select to authenticated
    using (realtime.messages.extension in ('broadcast', 'presence') and public.can_join_space_project_topic((select realtime.topic())));
  create policy "Equipe fala no canal do projeto" on realtime.messages
    for insert to authenticated
    with check (realtime.messages.extension in ('broadcast', 'presence') and public.can_join_space_project_topic((select realtime.topic())));
exception
  when undefined_table or undefined_function or invalid_schema_name then
    raise notice 'Realtime sem autorização neste projeto: canal ao vivo desligado';
end
$$;
