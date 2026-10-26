-- WhatsApp da equipe: caixa de entrada (2026-10-26)
--
-- O serviço (`services/whatsapp`) passa a guardar as conversas e mensagens do
-- número conectado e a enviar o que a equipe escreve na tela. O navegador só
-- lê as tabelas; escrever mensagem e marcar como lida passam pelas funções
-- abaixo (qualquer pessoa da equipe, não só gestor). O serviço (chave de
-- serviço) grava as recebidas e envia as da fila.

create table public.crm_whatsapp_chats (
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  -- O número da pessoa no formato do WhatsApp (5551999999999@s.whatsapp.net)
  jid text not null,
  phone text,
  name text,
  last_text text,
  last_from_me boolean not null default false,
  last_at timestamptz not null default now(),
  unread integer not null default 0,
  primary key (team_id, jid)
);

create table public.crm_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  chat_jid text not null,
  -- O id da mensagem no WhatsApp (vazio enquanto está na fila de envio)
  wa_id text,
  from_me boolean not null default false,
  body text not null default '',
  -- text, image, audio, video, document, sticker, other
  kind text not null default 'text',
  -- Das enviadas: queued (na fila), sent, failed
  status text not null default 'sent' check (status in ('queued', 'sent', 'failed')),
  error text,
  sent_by uuid references auth.users (id) on delete set null,
  ts timestamptz not null default now(),
  unique (team_id, wa_id),
  foreign key (team_id, chat_jid) references public.crm_whatsapp_chats (team_id, jid) on delete cascade
);

create index crm_whatsapp_messages_chat on public.crm_whatsapp_messages (team_id, chat_jid, ts);
create index crm_whatsapp_messages_queue on public.crm_whatsapp_messages (team_id) where status = 'queued';
create index crm_whatsapp_chats_last on public.crm_whatsapp_chats (team_id, last_at desc);

alter table public.crm_whatsapp_chats enable row level security;
alter table public.crm_whatsapp_messages enable row level security;

create policy "Equipe vê as conversas" on public.crm_whatsapp_chats
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Equipe vê as mensagens" on public.crm_whatsapp_messages
  for select to authenticated using (public.is_crm_member(team_id));

-- O serviço guarda uma mensagem (recebida ou enviada pelo celular) e atualiza a conversa.
-- Repetida (mesmo wa_id) não faz nada.
create or replace function public.crm_whatsapp_store(
  p_team uuid, p_jid text, p_name text, p_wa_id text, p_from_me boolean,
  p_body text, p_kind text, p_ts timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.crm_whatsapp_chats as c (team_id, jid, phone, name, last_text, last_from_me, last_at, unread)
  values (p_team, p_jid, split_part(p_jid, '@', 1), case when p_from_me then null else p_name end, '', p_from_me, p_ts, 0)
  on conflict (team_id, jid) do nothing;

  insert into public.crm_whatsapp_messages (team_id, chat_jid, wa_id, from_me, body, kind, status, ts)
  values (p_team, p_jid, p_wa_id, p_from_me, p_body, p_kind, 'sent', p_ts)
  on conflict (team_id, wa_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;

  update public.crm_whatsapp_chats set
    name = coalesce(case when p_from_me then null else nullif(p_name, '') end, name),
    last_text = p_body,
    last_from_me = p_from_me,
    last_at = greatest(last_at, p_ts),
    unread = case when p_from_me then unread else unread + 1 end
  where team_id = p_team and jid = p_jid and p_ts >= last_at - interval '1 second';
end
$$;

-- A equipe escreve: entra na fila e o serviço envia em até 2 s
create or replace function public.crm_whatsapp_send(p_team uuid, p_jid text, p_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_crm_member(p_team) then
    raise exception 'Só quem está na equipe envia mensagens.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'Mensagem vazia.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.crm_whatsapp_chats where team_id = p_team and jid = p_jid) then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  insert into public.crm_whatsapp_messages (team_id, chat_jid, from_me, body, kind, status, sent_by)
  values (p_team, p_jid, true, btrim(p_text), 'text', 'queued', auth.uid())
  returning id into new_id;
  update public.crm_whatsapp_chats set last_text = btrim(p_text), last_from_me = true, last_at = now()
  where team_id = p_team and jid = p_jid;
  return new_id;
end
$$;

-- Abrir a conversa zera o contador de não lidas
create or replace function public.crm_whatsapp_read(p_team uuid, p_jid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_crm_member(p_team) then
    raise exception 'Só quem está na equipe lê as conversas.' using errcode = '42501';
  end if;
  update public.crm_whatsapp_chats set unread = 0 where team_id = p_team and jid = p_jid and unread <> 0;
end
$$;

revoke all on function public.crm_whatsapp_store(uuid, text, text, text, boolean, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.crm_whatsapp_send(uuid, text, text) from public, anon;
revoke all on function public.crm_whatsapp_read(uuid, text) from public, anon;
grant execute on function public.crm_whatsapp_store(uuid, text, text, text, boolean, text, text, timestamptz) to service_role;
grant execute on function public.crm_whatsapp_send(uuid, text, text) to authenticated;
grant execute on function public.crm_whatsapp_read(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.crm_whatsapp_chats;
  alter publication supabase_realtime add table public.crm_whatsapp_messages;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'Sem a publicação supabase_realtime: a tela relê sozinha de tempos em tempos';
end
$$;
