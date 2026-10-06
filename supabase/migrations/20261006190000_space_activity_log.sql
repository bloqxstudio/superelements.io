-- Registro de atividades, lixeira e versões dos projetos do Space (2026-10-06)
--
-- 1. space_project_events: quem fez o quê em cada projeto. Só cresce: ninguém
--    edita nem apaga uma linha. O banco grava sozinho o que passa por ele
--    (projeto excluído, renomeado, contexto, pessoas, convites, WordPress,
--    links de aprovação); o app grava o que acontece no canvas pela função
--    space_log_event (página e seção excluídas, com a cópia inteira para a
--    lixeira; restaurações; publicação no site). Quem fez vem da sessão,
--    nunca do pedido.
-- 2. space_project_versions: versões guardadas do conteúdo. O arquivo de cada
--    versão fica na pasta do projeto, no bucket space-projects.

create table public.space_project_events (
  id uuid primary key default gen_random_uuid(),
  -- Sem chave estrangeira: o registro de um projeto excluído continua
  project_id uuid not null,
  project_name text not null default '',
  -- Dono na hora do registro: ele lê o histórico mesmo depois de excluir o projeto
  owner_id uuid,
  actor_id uuid,
  actor_email text not null default '',
  action text not null check (char_length(action) between 1 and 60),
  target text not null default '' check (char_length(target) <= 200),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index space_project_events_project_idx on public.space_project_events (project_id, created_at desc);
create index space_project_events_owner_idx on public.space_project_events (owner_id, created_at desc);

alter table public.space_project_events enable row level security;

-- Lê quem tem acesso ao projeto, e o dono mesmo depois de excluí-lo. Ninguém grava direto.
create policy "Equipe lê a atividade do projeto" on public.space_project_events
  for select to authenticated using (public.space_project_role(project_id) is not null or owner_id = (select auth.uid()));

-- Grava uma linha com quem está na sessão
create or replace function public.space_log(p_project uuid, p_action text, p_target text, p_details jsonb, p_name text default null, p_owner uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_owner uuid := p_owner;
  v_name text := p_name;
  v_email text;
begin
  if v_owner is null or v_name is null then
    select coalesce(v_owner, p.owner_id), coalesce(v_name, p.name) into v_owner, v_name from public.space_projects p where p.id = p_project;
    -- Projeto já excluído: o que sai junto com ele (pessoas, WordPress, links) não vira linha à parte
    if not found and p_owner is null then
      return null;
    end if;
  end if;
  select u.email into v_email from auth.users u where u.id = (select auth.uid());
  insert into public.space_project_events (project_id, project_name, owner_id, actor_id, actor_email, action, target, details)
  values (p_project, coalesce(v_name, ''), v_owner, (select auth.uid()), coalesce(v_email, ''), p_action, left(coalesce(p_target, ''), 200), coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end
$$;

revoke all on function public.space_log(uuid, text, text, jsonb, text, uuid) from public;

-- O que o app registra (canvas, restaurações, publicação), só em projeto a que quem chama tem acesso
create or replace function public.space_log_event(p_project uuid, p_action text, p_target text default '', p_details jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.space_project_role(p_project) is null then
    raise exception 'sem_acesso';
  end if;
  if p_action !~ '^(page|section|canvas|version|publish|restore)\.[a-z_]{1,40}$' then
    raise exception 'acao_invalida';
  end if;
  return public.space_log(p_project, p_action, p_target, p_details);
end
$$;

revoke all on function public.space_log_event(uuid, text, text, jsonb) from public;
grant execute on function public.space_log_event(uuid, text, text, jsonb) to authenticated;

-- ---------- o que o banco registra sozinho ----------

-- Projeto excluído (antes, para ler o nome e o dono)
create or replace function public.space_log_project_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.space_log(old.id, 'project.deleted', old.name, jsonb_build_object('created_at', old.created_at, 'revision', old.revision), old.name, old.owner_id);
  return old;
end $$;

create trigger space_projects_log_delete
  before delete on public.space_projects
  for each row execute function public.space_log_project_delete();

-- Nome e contexto alterados (salvar o conteúdo não entra: isso vira versão)
create or replace function public.space_log_project_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    perform public.space_log(new.id, 'project.renamed', new.name, jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  if new.context is distinct from old.context then
    perform public.space_log(new.id, 'project.context', new.name, jsonb_build_object('from', left(old.context, 2000), 'to', left(new.context, 2000)));
  end if;
  return new;
end $$;

create trigger space_projects_log_update
  after update of name, context on public.space_projects
  for each row execute function public.space_log_project_update();

-- Pessoas: entrou pelo convite, saiu, foi tirada pelo dono
create or replace function public.space_log_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text;
begin
  if tg_op = 'INSERT' then
    select u.email into v_email from auth.users u where u.id = new.user_id;
    perform public.space_log(new.project_id, 'member.joined', coalesce(v_email, ''), jsonb_build_object('user_id', new.user_id));
    return new;
  end if;
  select u.email into v_email from auth.users u where u.id = old.user_id;
  perform public.space_log(old.project_id, case when old.user_id = (select auth.uid()) then 'member.left' else 'member.removed' end, coalesce(v_email, ''), jsonb_build_object('user_id', old.user_id));
  return old;
end $$;

create trigger space_project_members_log
  after insert or delete on public.space_project_members
  for each row execute function public.space_log_member();

-- Convites criados e cancelados
create or replace function public.space_log_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.space_log(new.project_id, 'invite.created', new.label, jsonb_build_object('expires_at', new.expires_at));
    return new;
  end if;
  -- O convite usado não é cancelamento
  if old.accepted_at is null then
    perform public.space_log(old.project_id, 'invite.canceled', old.label, '{}'::jsonb);
  end if;
  return old;
end $$;

create trigger space_project_invites_log
  after insert or delete on public.space_project_invites
  for each row execute function public.space_log_invite();

-- WordPress conectado, trocado e desconectado (sem a senha)
create or replace function public.space_log_wordpress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.space_log(old.project_id, 'wordpress.disconnected', coalesce(old.connection #>> '{site,siteUrl}', ''), '{}'::jsonb);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.connection #>> '{site,siteUrl}' is not distinct from old.connection #>> '{site,siteUrl}' and new.password = old.password then
    return new;
  end if;
  perform public.space_log(new.project_id, case when tg_op = 'INSERT' then 'wordpress.connected' else 'wordpress.updated' end, coalesce(new.connection #>> '{site,siteUrl}', ''), jsonb_build_object('user', new.connection #>> '{user,name}'));
  return new;
end $$;

create trigger space_wordpress_connections_log
  after insert or update or delete on public.space_wordpress_connections
  for each row execute function public.space_log_wordpress();

-- Links de aprovação criados e apagados
create or replace function public.space_log_share()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.space_log(new.project_id, 'approval.created', new.page_name, jsonb_build_object('page_id', new.page_id));
    return new;
  end if;
  perform public.space_log(old.project_id, 'approval.deleted', old.page_name, jsonb_build_object('page_id', old.page_id));
  return old;
end $$;

create trigger space_page_shares_log
  after insert or delete on public.space_page_shares
  for each row execute function public.space_log_share();

-- ---------- versões do conteúdo ----------

create table public.space_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.space_projects (id) on delete cascade,
  revision integer not null,
  doc_path text not null,
  saved_by uuid default auth.uid(),
  saved_by_email text not null default '',
  saved_at timestamptz not null default now(),
  -- Páginas e seções na versão, para a lista
  summary jsonb not null default '{}'::jsonb,
  -- Por que foi guardada: 'auto' (de tempos em tempos), 'delete' (antes de algo sair), 'restore'
  reason text not null default 'auto' check (reason in ('auto', 'delete', 'restore'))
);

create index space_project_versions_project_idx on public.space_project_versions (project_id, saved_at desc);
create unique index space_project_versions_path_idx on public.space_project_versions (doc_path);

alter table public.space_project_versions enable row level security;

create policy "Equipe vê as versões" on public.space_project_versions
  for select to authenticated using (public.space_project_role(project_id) is not null);
create policy "Equipe guarda versões" on public.space_project_versions
  for insert to authenticated with check (public.space_project_role(project_id) is not null and saved_by = (select auth.uid()));
-- Só o dono descarta versões antigas (o app guarda as 60 mais novas)
create policy "Dono descarta versões antigas" on public.space_project_versions
  for delete to authenticated using (public.space_project_role(project_id) = 'owner');

-- O e-mail de quem guardou vem da sessão
create or replace function public.space_version_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.saved_by := (select auth.uid());
  select u.email into new.saved_by_email from auth.users u where u.id = new.saved_by;
  new.saved_by_email := coalesce(new.saved_by_email, '');
  return new;
end $$;

create trigger space_project_versions_author
  before insert on public.space_project_versions
  for each row execute function public.space_version_author();
