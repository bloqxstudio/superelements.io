-- WhatsApp da equipe: etiquetas nas conversas (2026-10-27)
--
-- Quem é da equipe marca cada conversa com etiquetas (Quente, Morno, Frio,
-- Cliente, Perdido ou uma própria). Todos veem as mesmas etiquetas, ao vivo.

alter table public.crm_whatsapp_chats
  add column if not exists tags text[] not null default '{}';

create or replace function public.crm_whatsapp_set_tags(p_team uuid, p_jid text, p_tags text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text[];
begin
  if not public.is_crm_member(p_team) then
    raise exception 'Só quem está na equipe marca as conversas.' using errcode = '42501';
  end if;
  select coalesce(array_agg(t order by first_pos), '{}') into clean
  from (
    select left(btrim(x), 24) as t, min(ord) as first_pos
    from unnest(coalesce(p_tags, '{}')) with ordinality as u(x, ord)
    where btrim(x) <> ''
    group by left(btrim(x), 24)
    order by min(ord)
    limit 8
  ) s;
  update public.crm_whatsapp_chats set tags = clean where team_id = p_team and jid = p_jid;
end
$$;

revoke all on function public.crm_whatsapp_set_tags(uuid, text, text[]) from public, anon;
grant execute on function public.crm_whatsapp_set_tags(uuid, text, text[]) to authenticated;
