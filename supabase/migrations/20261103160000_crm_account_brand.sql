-- Marca da conta (DESIGN.md) para os Criativos de uma conta de cliente sem projeto no Space.
-- O usuário, 2026-11-03: "pode usar a marca da vizor nos criativos". A Vizor (Sinfy) não tem projeto
-- nem conjunto ainda; `accountBrand` lê este texto depois dos projetos da conta.
-- A equipe lê pela política existente ("Membros leem o contexto"); só o servidor e o admin gravam
-- (crm_context_save não toca nesta coluna).
alter table public.crm_account_context
  add column if not exists brand_md text not null default '' check (length(brand_md) <= 20000);
