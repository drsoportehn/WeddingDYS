-- =====================================================================
-- Boda Darwin & Sofía · Esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Administradores (por correo) ----------
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Parámetros del evento (una sola fila) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  couple_names text not null default 'Darwin & Sofía',
  monogram text not null default 'D & S',
  event_date timestamptz not null default '2027-10-30 16:00:00-06',
  event_end  timestamptz not null default '2027-10-31 00:00:00-06',
  rsvp_deadline date default '2027-06-30',
  venue_name text default 'Villa Shalom',
  venue_city text default 'Santa Rosa de Copán, Honduras',
  venue_address text default '',
  maps_url text default '',
  dress_code text default 'Formal',
  welcome_message text default 'Queremos celebrar este día con las personas que más queremos. Nos encantaría que nos acompañen.',
  program jsonb not null default '[
    {"hora":"3:00 p. m.","actividad":"Bienvenida"},
    {"hora":"4:00 p. m.","actividad":"Ceremonia"},
    {"hora":"5:00 p. m.","actividad":"Cóctel"},
    {"hora":"6:30 p. m.","actividad":"Cena"},
    {"hora":"8:00 p. m.","actividad":"Fiesta"}
  ]'::jsonb,
  hero_photo_path text,
  updated_at timestamptz not null default now()
);
-- OWE · campos nuevos editables desde el panel
alter table public.settings add column if not exists hero_kicker text default 'Con la bendición de Dios y de nuestras familias';
alter table public.settings add column if not exists band_quote_1 text default 'Dos caminos que se encontraron para seguir siendo uno solo.';
alter table public.settings add column if not exists band_quote_2 text default 'Para siempre';
alter table public.settings add column if not exists dress_note text default 'Nos encantaría verlos en los tonos de nuestra boda';
alter table public.settings add column if not exists dress_palette jsonb not null default '[
  {"nombre":"Arena","detalle":"Champagne","color":"#D7C2A5"},
  {"nombre":"Blush","detalle":"Rosa suave","color":"#E7CAC4"},
  {"nombre":"Moca","detalle":"Café cálido","color":"#80635B"},
  {"nombre":"Negro","detalle":"Clásico","color":"#1E1B1C"}
]'::jsonb;
alter table public.settings add column if not exists dress_avoid jsonb not null default '[
  {"nombre":"Blanco","color":"#FFFFFF"},
  {"nombre":"Rojo vino","color":"#722F40"}
]'::jsonb;
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------- Galería ----------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  caption text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Invitaciones (una por familia o persona) ----------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  family_name text not null,
  side text,                       -- Novio / Novia / Ambos
  phone text,
  email text,
  max_guests int not null default 1 check (max_guests between 1 and 20),
  status text not null default 'pendiente' check (status in ('pendiente','confirmado','no_asiste')),
  confirmed_guests int not null default 0,
  guest_names text,
  message text,
  responded_at timestamptz,
  calendar_sent_at timestamptz,
  checked_in_guests int not null default 0 check (checked_in_guests >= 0),
  checked_in_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (confirmed_guests between 0 and max_guests)
);

-- ---------- Seguridad (RLS) ----------
alter table public.admins      enable row level security;
alter table public.settings    enable row level security;
alter table public.photos      enable row level security;
alter table public.invitations enable row level security;

drop policy if exists "admins_select" on public.admins;
create policy "admins_select" on public.admins for select to authenticated using (public.is_admin());

drop policy if exists "settings_read" on public.settings;
create policy "settings_read" on public.settings for select to anon, authenticated using (true);
drop policy if exists "settings_write" on public.settings;
create policy "settings_write" on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "photos_read" on public.photos;
create policy "photos_read" on public.photos for select to anon, authenticated using (true);
drop policy if exists "photos_write" on public.photos;
create policy "photos_write" on public.photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Los invitados NO leen la tabla directamente: solo por las funciones de abajo.
drop policy if exists "invitations_admin" on public.invitations;
create policy "invitations_admin" on public.invitations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Funciones públicas para invitados ----------
create or replace function public.get_invitation(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'code', code, 'family_name', family_name, 'max_guests', max_guests,
    'status', status, 'confirmed_guests', confirmed_guests,
    'guest_names', guest_names, 'email', email, 'message', message,
    'responded_at', responded_at
  )
  from public.invitations where code = upper(trim(p_code));
$$;
grant execute on function public.get_invitation(text) to anon, authenticated;

create or replace function public.submit_rsvp(
  p_code text, p_attending boolean, p_guests int,
  p_names text, p_email text, p_message text
) returns json language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations;
  deadline date;
begin
  select * into inv from public.invitations where code = upper(trim(p_code));
  if not found then raise exception 'Código de invitación no válido'; end if;

  select rsvp_deadline into deadline from public.settings where id = 1;
  if deadline is not null and (now() at time zone 'America/Tegucigalpa')::date > deadline then
    raise exception 'La fecha límite para confirmar ya pasó. Escríbenos directamente.';
  end if;

  if p_attending and (p_guests is null or p_guests < 1 or p_guests > inv.max_guests) then
    raise exception 'El número de asistentes debe estar entre 1 y %', inv.max_guests;
  end if;

  update public.invitations set
    status = case when p_attending then 'confirmado' else 'no_asiste' end,
    confirmed_guests = case when p_attending then p_guests else 0 end,
    guest_names = left(nullif(trim(p_names), ''), 500),
    email = coalesce(nullif(lower(trim(p_email)), ''), email),
    message = left(nullif(trim(p_message), ''), 1000),
    responded_at = now()
  where id = inv.id;

  return public.get_invitation(p_code);
end;
$$;
grant execute on function public.submit_rsvp(text, boolean, int, text, text, text) to anon, authenticated;

-- ---------- Almacenamiento de fotos ----------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
on conflict (id) do nothing;

-- Storage necesita poder "ver" el archivo para borrarlo o reemplazarlo
drop policy if exists "fotos_admin_select" on storage.objects;
create policy "fotos_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos_admin_insert" on storage.objects;
create policy "fotos_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos_admin_update" on storage.objects;
create policy "fotos_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos_admin_delete" on storage.objects;
create policy "fotos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());

-- =====================================================================
-- CONFIGURACIÓN INICIAL: cambia el correo por el del administrador.
-- Debe ser el mismo con el que crees el usuario en Authentication > Users.
-- =====================================================================
insert into public.admins (email) values ('drsoportehn@gmail.com') on conflict do nothing;
