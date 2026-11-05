-- Pauta: comentário da equipe "com o cliente" feito antes de qualquer envio fica sem envio
-- (`item_id` nulo) e não aparecia no link. Ao enviar o conteúdo, esses comentários passam a
-- pertencer ao novo envio, e o cliente os vê junto da peça.

create or replace function public.crm_approval_items_adopt_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crm_content_comments
     set item_id = new.id
   where content_id = new.content_id and item_id is null and not internal;
  return new;
end
$$;

revoke all on function public.crm_approval_items_adopt_comments() from public, anon, authenticated;

drop trigger if exists crm_approval_items_adopt_comments on public.crm_approval_items;
create trigger crm_approval_items_adopt_comments after insert on public.crm_approval_items
  for each row execute function public.crm_approval_items_adopt_comments();
