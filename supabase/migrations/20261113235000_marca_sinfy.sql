-- A marca SuperElements virou Sinfy (2026-11-13, pedido do usuário: "troca qualquer marca... para sinfy").
-- Só os nomes que aparecem nas telas; ids e conteúdo das páginas não mudam.
update public.space_projects set name = 'Sinfy Construtor' where id = 'c3dc8b02-1fda-40ba-b94f-b4d20e461667' and name = 'Superelements';
update public.crm_teams set name = 'Sinfy — Meta Review' where id = '22dcb048-78c7-413f-bdc4-af2cd42c3476' and name = 'SuperElements — Meta Review';
