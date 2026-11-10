-- Admins da plataforma (acesso a todas as contas), pedido do usuário em 2026-11-10:
-- pedro.h.kunz@gmail.com e contatoigorpinheiro+2@gmail.com.
-- O app lê user_roles com .single(): cada usuário fica com uma só linha (o papel vira admin).
update public.user_roles r
   set role = 'admin'
  from auth.users u
 where u.id = r.user_id
   and u.email in ('pedro.h.kunz@gmail.com', 'contatoigorpinheiro+2@gmail.com')
   and not exists (select 1 from public.user_roles x where x.user_id = r.user_id and x.role = 'admin');

delete from public.user_roles r
 using auth.users u
 where u.id = r.user_id
   and u.email in ('pedro.h.kunz@gmail.com', 'contatoigorpinheiro+2@gmail.com')
   and r.role <> 'admin';

insert into public.user_roles (user_id, role)
select u.id, 'admin'
  from auth.users u
 where u.email in ('pedro.h.kunz@gmail.com', 'contatoigorpinheiro+2@gmail.com')
on conflict (user_id, role) do nothing;
