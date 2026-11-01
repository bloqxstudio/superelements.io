-- Perfil da pessoa (2026-10-31): nome e foto, editados pela própria pessoa na tela /perfil,
-- e mostrados à equipe no lugar do nome tirado do e-mail.

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists avatar_path text;

alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles add constraint profiles_full_name_len check (full_name is null or char_length(full_name) <= 80);
alter table public.profiles drop constraint if exists profiles_avatar_path_own;
alter table public.profiles add constraint profiles_avatar_path_own check (avatar_path is null or avatar_path like id::text || '/%');

-- A pessoa só muda o próprio nome, foto e telefone. E-mail (vem do login), cliente da cobrança
-- e conta de demonstração ficam para o servidor e para o admin da plataforma.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.has_role(auth.uid(), 'admin') then
    if new.email is distinct from old.email
       or new.asaas_customer_id is distinct from old.asaas_customer_id
       or new.is_demo is distinct from old.is_demo
       or new.id is distinct from old.id then
      raise exception 'campo_protegido' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Depois de confirmar um novo e-mail, o perfil copia o do login.
create or replace function public.profile_sync_email()
returns text
language sql
security definer
set search_path = public
as $$
  update public.profiles p set email = u.email
  from auth.users u
  where p.id = auth.uid() and u.id = p.id and u.email is not null and p.email is distinct from u.email
  returning p.email;
$$;
revoke all on function public.profile_sync_email() from public, anon;
grant execute on function public.profile_sync_email() to authenticated;

-- Fotos de perfil: públicas para leitura (aparecem para a equipe), cada pessoa grava só a sua pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Pessoa grava a própria foto" on storage.objects;
create policy "Pessoa grava a própria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Pessoa troca a própria foto" on storage.objects;
create policy "Pessoa troca a própria foto" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Pessoa apaga a própria foto" on storage.objects;
create policy "Pessoa apaga a própria foto" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Pessoa lista a própria foto" on storage.objects;
create policy "Pessoa lista a própria foto" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- A equipe passa a ver o nome e a foto de cada pessoa.
drop function if exists public.crm_team_people(uuid);
create function public.crm_team_people(p_team uuid)
returns table(user_id uuid, email text, role text, joined_at timestamptz, full_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, coalesce(u.email, '')::text, m.role, m.created_at, p.full_name, p.avatar_path
  from public.crm_team_members m
  left join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.team_id = p_team and public.is_crm_member(p_team)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at
$$;
revoke all on function public.crm_team_people(uuid) from public, anon;
grant execute on function public.crm_team_people(uuid) to authenticated;
