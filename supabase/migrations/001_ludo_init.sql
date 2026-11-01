-- ============================================================
-- 001_ludo_init.sql — Ludo — Schéma initial + RLS + Realtime
-- Projet Supabase partagé avec Cloverly : toutes les tables sont préfixées ludo_
-- À exécuter dans le SQL Editor de Supabase.
-- ============================================================

-- ---- Profils (pseudo) ----
create table if not exists public.ludo_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null unique check (pseudo ~ '^[a-z0-9_]{3,20}$'),
  games_played int not null default 0,
  games_won int not null default 0,
  created_at timestamptz not null default now()
);

-- ---- Salles ----
create table if not exists public.ludo_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[0-9]{6}$'),
  host_id uuid not null references public.ludo_profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un code n'est réservé que tant que la salle n'est pas fermée.
create unique index if not exists ludo_rooms_code_active_idx
  on public.ludo_rooms (code) where status <> 'closed';

-- ---- Joueurs d'une salle ----
create table if not exists public.ludo_room_players (
  room_id uuid not null references public.ludo_rooms(id) on delete cascade,
  user_id uuid not null references public.ludo_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- Renseigné quand un joueur quitte une partie en cours (il reste listé pour l'affichage).
  left_at timestamptz,
  primary key (room_id, user_id)
);

create index if not exists ludo_room_players_user_idx on public.ludo_room_players (user_id);

-- Garde-fou : 4 joueurs maximum par salle, même en cas d'arrivées simultanées.
create or replace function public.ludo_enforce_room_capacity()
returns trigger
language plpgsql
as $$
begin
  perform 1 from public.ludo_rooms where id = new.room_id for update;
  if (select count(*) from public.ludo_room_players where room_id = new.room_id) >= 4 then
    raise exception 'LUDO_ROOM_FULL' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists ludo_room_capacity on public.ludo_room_players;
create trigger ludo_room_capacity
  before insert on public.ludo_room_players
  for each row execute function public.ludo_enforce_room_capacity();

-- ---- Parties ----
create table if not exists public.ludo_games (
  room_id uuid primary key references public.ludo_rooms(id) on delete cascade,
  state jsonb not null,
  version int not null default 0,
  turn_deadline timestamptz,
  winner_id uuid references public.ludo_profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ---- Historique des coups ----
create table if not exists public.ludo_moves (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.ludo_rooms(id) on delete cascade,
  user_id uuid references public.ludo_profiles(id) on delete set null,
  seq int not null,
  events jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ludo_moves_room_idx on public.ludo_moves (room_id, seq);

-- ============================================================
-- RLS : lecture seule pour les membres. Toutes les écritures passent par le serveur
-- Next.js (clé service_role), qui applique les règles du jeu.
-- ============================================================

alter table public.ludo_profiles enable row level security;
alter table public.ludo_rooms enable row level security;
alter table public.ludo_room_players enable row level security;
alter table public.ludo_games enable row level security;
alter table public.ludo_moves enable row level security;

create or replace function public.ludo_is_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ludo_room_players
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

revoke all on function public.ludo_is_member(uuid) from public;
grant execute on function public.ludo_is_member(uuid) to authenticated;

drop policy if exists "ludo_profiles_read" on public.ludo_profiles;
create policy "ludo_profiles_read" on public.ludo_profiles
  for select to authenticated using (true);

drop policy if exists "ludo_rooms_read_members" on public.ludo_rooms;
create policy "ludo_rooms_read_members" on public.ludo_rooms
  for select to authenticated using (public.ludo_is_member(id));

drop policy if exists "ludo_room_players_read_members" on public.ludo_room_players;
create policy "ludo_room_players_read_members" on public.ludo_room_players
  for select to authenticated using (public.ludo_is_member(room_id));

drop policy if exists "ludo_games_read_members" on public.ludo_games;
create policy "ludo_games_read_members" on public.ludo_games
  for select to authenticated using (public.ludo_is_member(room_id));

drop policy if exists "ludo_moves_read_members" on public.ludo_moves;
create policy "ludo_moves_read_members" on public.ludo_moves
  for select to authenticated using (public.ludo_is_member(room_id));

-- ============================================================
-- Realtime
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.ludo_rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.ludo_games;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.ludo_room_players;
  exception when duplicate_object then null;
  end;
end $$;
