-- Link para o cliente conectar o Instagram dele sem entrar na plataforma.
-- Um gestor da conta cria o link (7 dias, uso único); quem abre autoriza na
-- tela do Instagram e a conta entra na equipe do link. O link guarda só o
-- hash do segredo; criar, ler pelo segredo e usar passa pela função
-- `instagram` (chave de serviço). A equipe vê os links dela.

create table if not exists public.crm_instagram_connect_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams (id) on delete cascade,
  token_hash text not null unique,
  label text not null default '' check (char_length(label) <= 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  account_id uuid references public.crm_instagram_accounts (id) on delete set null,
  revoked_at timestamptz
);

create index if not exists crm_instagram_connect_links_team_idx on public.crm_instagram_connect_links (team_id, created_at desc);

alter table public.crm_instagram_connect_links enable row level security;

drop policy if exists "Equipe lê os links de conexão" on public.crm_instagram_connect_links;
create policy "Equipe lê os links de conexão" on public.crm_instagram_connect_links
  for select to authenticated using (public.is_crm_member(team_id));

revoke insert, update, delete on public.crm_instagram_connect_links from authenticated, anon;
