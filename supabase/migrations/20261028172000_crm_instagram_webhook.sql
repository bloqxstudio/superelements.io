-- Entrega de DMs pela Meta: atômica, idempotente e isolada pela conta conectada.
create or replace function public.crm_instagram_receive_dm(
  p_instagram text, p_participant text, p_mid text, p_from_me boolean,
  p_body text, p_attachment text, p_ts timestamptz
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  a record;
  inserted integer;
  total integer := 0;
begin
  if p_instagram !~ '^[0-9]{1,40}$' or p_participant !~ '^[0-9]{1,40}$'
     or coalesce(p_mid, '') = '' or p_ts is null then
    raise exception 'Evento inválido';
  end if;
  for a in select id, team_id from public.crm_instagram_accounts where ig_user_id = p_instagram loop
    if not public.crm_module_on(a.team_id, 'instagram') then continue; end if;
    -- Serializa inclusive a primeira entrega para a mesma conversa.
    perform pg_advisory_xact_lock(hashtextextended(a.id::text || ':' || p_participant, 0));
    insert into public.crm_instagram_threads(account_id, team_id, participant_id, last_at)
      values(a.id, a.team_id, p_participant, p_ts)
      on conflict (account_id, participant_id) do nothing;
    insert into public.crm_instagram_dms(account_id, team_id, mid, participant_id, from_me, body, attachment, ts)
      values(a.id, a.team_id, p_mid, p_participant, p_from_me, coalesce(p_body, ''), p_attachment, p_ts)
      on conflict(account_id, mid) do nothing;
    get diagnostics inserted = row_count;
    if inserted = 0 then continue; end if;
    update public.crm_instagram_threads set
      last_text = case when p_ts >= last_at then coalesce(nullif(p_body, ''), case when p_attachment is not null then 'Anexo' else '' end) else last_text end,
      last_from_me = case when p_ts >= last_at then p_from_me else last_from_me end,
      unread = case when p_ts >= last_at and p_from_me then 0 when not p_from_me then unread + 1 else unread end,
      last_at = greatest(last_at, p_ts)
      where account_id = a.id and participant_id = p_participant;
    total := total + 1;
  end loop;
  return total;
end $$;
revoke all on function public.crm_instagram_receive_dm(text,text,text,boolean,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.crm_instagram_receive_dm(text,text,text,boolean,text,text,timestamptz) to service_role;
