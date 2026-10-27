-- Instagram da equipe: caixa de entrada de comentários e DMs (2026-10-27)
--
-- A função `instagram` lê da API da Meta os comentários dos posts recentes e as
-- conversas do direct e grava aqui; a tela lê destas tabelas (ao vivo pela
-- Realtime) e responde pela função. Escrever nas tabelas é só da função (chave
-- de serviço); a equipe só marca como resolvido/lido pela função
-- `crm_instagram_inbox_mark`.
--
-- Mensagens diretas pedem a permissão `instagram_business_manage_messages`:
-- quem já conectou a conta precisa conectar de novo para concedê-la.

create table public.crm_instagram_comments (
  account_id uuid not null references public.crm_instagram_accounts (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  comment_id text not null,
  media_id text not null,
  -- Comentário a que este responde (vazio: comentário de primeiro nível)
  parent_id text,
  username text,
  -- Id de escopo de quem comentou (serve para responder por DM)
  from_id text,
  body text not null default '',
  ts timestamptz not null,
  like_count integer not null default 0,
  hidden boolean not null default false,
  -- Comentário da própria conta (nossas respostas)
  own boolean not null default false,
  -- A equipe já respondeu (ou a conta respondeu na thread)
  replied boolean not null default false,
  handled boolean not null default false,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  primary key (account_id, comment_id)
);

create index crm_instagram_comments_team_ts on public.crm_instagram_comments (team_id, ts desc);
create index crm_instagram_comments_open on public.crm_instagram_comments (account_id, ts desc) where not handled and not own;

create table public.crm_instagram_threads (
  account_id uuid not null references public.crm_instagram_accounts (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  -- Id de escopo da pessoa na conversa
  participant_id text not null,
  username text,
  name text,
  last_text text,
  last_from_me boolean not null default false,
  last_at timestamptz not null default now(),
  unread integer not null default 0,
  primary key (account_id, participant_id)
);

create index crm_instagram_threads_last on public.crm_instagram_threads (team_id, last_at desc);

create table public.crm_instagram_dms (
  account_id uuid not null references public.crm_instagram_accounts (id) on delete cascade,
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  mid text not null,
  participant_id text not null,
  from_me boolean not null default false,
  body text not null default '',
  -- Foto, vídeo, story respondido etc.: só o tipo, a mídia fica na Meta
  attachment text,
  ts timestamptz not null,
  sent_by uuid references auth.users (id) on delete set null,
  primary key (account_id, mid),
  foreign key (account_id, participant_id) references public.crm_instagram_threads (account_id, participant_id) on delete cascade
);

create index crm_instagram_dms_thread on public.crm_instagram_dms (account_id, participant_id, ts);

alter table public.crm_instagram_comments enable row level security;
alter table public.crm_instagram_threads enable row level security;
alter table public.crm_instagram_dms enable row level security;

create policy "Equipe vê os comentários" on public.crm_instagram_comments
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe vê as conversas do Instagram" on public.crm_instagram_threads
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe vê as DMs do Instagram" on public.crm_instagram_dms
  for select to authenticated using (public.is_crm_member(team_id));

-- Marcar um comentário como resolvido (ou voltar) e zerar o não lido de uma conversa
create or replace function public.crm_instagram_inbox_mark(p_team uuid, p_kind text, p_account uuid, p_id text, p_done boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_crm_member(p_team) then
    raise exception 'Você não é desta equipe.' using errcode = '42501';
  end if;
  if p_kind = 'comment' then
    update public.crm_instagram_comments set
      handled = p_done,
      handled_by = case when p_done then auth.uid() end,
      handled_at = case when p_done then now() end
    where team_id = p_team and account_id = p_account and comment_id = p_id;
  elsif p_kind = 'thread' then
    update public.crm_instagram_threads set unread = case when p_done then 0 else greatest(unread, 1) end
    where team_id = p_team and account_id = p_account and participant_id = p_id;
  else
    raise exception 'Tipo inválido.';
  end if;
end
$$;

revoke all on function public.crm_instagram_inbox_mark(uuid, text, uuid, text, boolean) from public, anon;
grant execute on function public.crm_instagram_inbox_mark(uuid, text, uuid, text, boolean) to authenticated;

alter publication supabase_realtime add table public.crm_instagram_comments, public.crm_instagram_threads, public.crm_instagram_dms;
