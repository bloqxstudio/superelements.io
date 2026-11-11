-- Link para o cliente ligar a conta de anúncios dele pelo celular (2026-11-11)
--
-- O usuário: "podemos ter um link publico pro cliente fazer essa conexao pelo
-- celular dele? pra mandar no wpp e ele só clicar". Alguém da conta gera o link
-- (7 dias, uso único); o cliente abre sem login, entra com o Facebook com as
-- permissões de ler e turbinar, e a conta de anúncios dele entra nesta conta do
-- app. Com uma conta de anúncios só, liga direto; com mais, ele marca qual.
-- Como no link do Instagram: só o hash do segredo; criar, ler pelo segredo e
-- usar passam pela função `meta-ads` (chave de serviço). A equipe vê os links.

create table if not exists public.crm_ad_connect_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  token_hash text not null unique,
  label text not null default '' check (char_length(label) <= 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Marcado ao voltar do Facebook (antes de trocar o código); volta a nulo se a conexão falha
  used_at timestamptz,
  -- Login com várias contas esperando o cliente marcar (`crm_ad_pending`)
  pending_id uuid,
  -- Quando ligou: as contas de anúncios (`crm_ad_accounts.id`) e o nome de quem entrou
  account_ids uuid[],
  connected_name text,
  connected_at timestamptz,
  revoked_at timestamptz
);

create index if not exists crm_ad_connect_links_team_idx on public.crm_ad_connect_links (team_id, created_at desc);

alter table public.crm_ad_connect_links enable row level security;

drop policy if exists "Equipe lê os links de anúncios" on public.crm_ad_connect_links;
create policy "Equipe lê os links de anúncios" on public.crm_ad_connect_links
  for select to authenticated using (public.is_crm_member(team_id));

revoke insert, update, delete on public.crm_ad_connect_links from authenticated, anon;
