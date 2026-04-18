-- ============================================================
-- Ascensus DaaS — Setup Supabase
-- Rodar no SQL Editor do painel Supabase (uma vez)
-- ============================================================

-- 1. Tabela de armazenamento por app/usuário
--    Substitui o localStorage de cada site
create table if not exists app_storage (
  user_id    uuid references auth.users(id) on delete cascade,
  app_name   text not null,
  key        text not null,
  value      jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, app_name, key)
);

-- 2. Permissões por app
--    Define quem pode acessar qual site
create table if not exists app_permissions (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  app_name   text not null,
  unique (user_id, app_name)
);

-- 3. RLS — segurança linha a linha
alter table app_storage     enable row level security;
alter table app_permissions enable row level security;

-- Políticas: usuário só acessa os próprios dados
create policy "storage_own"
  on app_storage for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "permissions_read_own"
  on app_permissions for select
  using (auth.uid() = user_id);

-- 4. Função para admin conceder acesso
--    Uso: select grant_app('email@exemplo.com', 'pfl');
create or replace function grant_app(p_email text, p_app text)
returns text
language plpgsql security definer as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = p_email;

  if v_user_id is null then
    return 'Usuário não encontrado: ' || p_email;
  end if;

  insert into app_permissions (user_id, app_name)
  values (v_user_id, p_app)
  on conflict do nothing;

  return 'Acesso concedido: ' || p_email || ' → ' || p_app;
end;
$$;

-- 5. Função para revogar acesso
create or replace function revoke_app(p_email text, p_app text)
returns text
language plpgsql security definer as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = p_email;

  if v_user_id is null then
    return 'Usuário não encontrado: ' || p_email;
  end if;

  delete from app_permissions
  where user_id = v_user_id and app_name = p_app;

  return 'Acesso revogado: ' || p_email || ' → ' || p_app;
end;
$$;

-- ============================================================
-- COMO USAR DEPOIS QUE USUÁRIOS SE CADASTRAREM:
--
-- Criar usuário: Authentication → Users → Add user
--
-- Conceder acesso ao PFL:
--   select grant_app('email@usuario.com', 'pfl');
--
-- Conceder acesso ao DRE:
--   select grant_app('email@usuario.com', 'dre');
--
-- Nomes dos apps: pfl | dre | fluxocaixa | cartaocredito | organograma
--
-- Revogar acesso:
--   select revoke_app('email@usuario.com', 'pfl');
-- ============================================================
