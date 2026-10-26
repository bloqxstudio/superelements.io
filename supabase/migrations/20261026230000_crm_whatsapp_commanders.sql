-- WhatsApp da equipe: quem pode mandar comandos (2026-10-26)
--
-- Uma mensagem que chega ao número da equipe vindo de um destes telefones deixa
-- de ser só conversa: o serviço (`services/whatsapp`, `comandos.ts`) entende como
-- pergunta (funil, anúncios, site, projetos) e responde na mesma conversa. Qualquer
-- outro número continua sendo cliente e nunca dispara comando. Só gestores mexem na lista.

create table public.crm_whatsapp_commanders (
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  -- Só os dígitos, com o país: 5551999999999
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  name text not null default '' check (char_length(name) <= 80),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (team_id, phone)
);

alter table public.crm_whatsapp_commanders enable row level security;

create policy "Equipe vê quem manda comandos" on public.crm_whatsapp_commanders
  for select to authenticated using (public.is_crm_member(team_id));
create policy "Gestor inclui quem manda comandos" on public.crm_whatsapp_commanders
  for insert to authenticated with check (public.is_crm_manager(team_id));
create policy "Gestor muda quem manda comandos" on public.crm_whatsapp_commanders
  for update to authenticated using (public.is_crm_manager(team_id)) with check (public.is_crm_manager(team_id));
create policy "Gestor tira quem manda comandos" on public.crm_whatsapp_commanders
  for delete to authenticated using (public.is_crm_manager(team_id));

-- O serviço responde um comando: entra na fila de envio como qualquer mensagem da equipe, sem usuário (sent_by vazio)
create or replace function public.crm_whatsapp_enqueue_reply(p_team uuid, p_jid text, p_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'Mensagem vazia.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.crm_whatsapp_chats where team_id = p_team and jid = p_jid) then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  insert into public.crm_whatsapp_messages (team_id, chat_jid, from_me, body, kind, status)
  values (p_team, p_jid, true, btrim(p_text), 'text', 'queued')
  returning id into new_id;
  update public.crm_whatsapp_chats set last_text = btrim(p_text), last_from_me = true, last_at = now()
  where team_id = p_team and jid = p_jid;
  return new_id;
end
$$;

revoke all on function public.crm_whatsapp_enqueue_reply(uuid, text, text) from public, anon, authenticated;
grant execute on function public.crm_whatsapp_enqueue_reply(uuid, text, text) to service_role;
