-- =============================================================
-- LeComptoir – Supabase Database Schema
-- =============================================================
-- Prerequisites: enable the PostGIS extension for geolocation support
-- Run in Supabase SQL Editor or via migration tool.
-- =============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- =============================================================
-- TABLE: profiles
-- =============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  bio         text,
  avatar      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Public user profiles, one per auth user.';

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================
-- TABLE: shops
-- =============================================================
create table if not exists public.shops (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  description     text,
  is_private      boolean not null default false,
  -- invite_code is required when is_private = true (enforced by check constraint)
  invite_code     text unique,
  location_point         geometry(Point, 4326),
  address                text,
  stripe_connect_id      text unique,
  stripe_charges_enabled boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint private_shop_requires_invite_code
    check (is_private = false or invite_code is not null)
);

comment on table public.shops is 'Shops owned by users. Private shops require an invite_code to be accessed.';
comment on column public.shops.location_point is 'Geographic point (longitude, latitude) stored as PostGIS geometry EPSG:4326.';
comment on column public.shops.invite_code            is 'Secret code required to access a private shop. Must be set when is_private = true.';
comment on column public.shops.stripe_connect_id      is 'Stripe Express account ID (acct_...) for the shop owner.';
comment on column public.shops.stripe_charges_enabled is 'True once the vendor has completed Stripe onboarding and charges are enabled.';

create index shops_owner_id_idx on public.shops(owner_id);
create index shops_location_idx on public.shops using gist(location_point);
create index shops_invite_code_idx on public.shops(invite_code) where invite_code is not null;

create trigger shops_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

-- =============================================================
-- TABLE: products
-- =============================================================
create table if not exists public.products (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null,
  description text,
  price       numeric(10, 2) not null check (price >= 0),
  image_url   text,
  stock       integer not null default 0 check (stock >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.products is 'Products listed in a shop.';

create index products_shop_id_idx on public.products(shop_id);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

alter table public.profiles enable row level security;
alter table public.shops    enable row level security;
alter table public.products enable row level security;

-- -----------------------------------------------------------
-- Helper function: check if the current user can access a shop
-- (public shop, or owner, or valid invite_code provided via JWT claim)
-- -----------------------------------------------------------
create or replace function public.is_shop_accessible(
  p_shop_id           uuid,
  p_provided_invite   text default null
)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.shops s
    where s.id = p_shop_id
      and (
        -- Public shop: visible to everyone
        s.is_private = false
        -- Owner always has access
        or s.owner_id = auth.uid()
        -- Valid invite_code supplied by the caller
        or (s.is_private = true and s.invite_code = p_provided_invite and p_provided_invite is not null)
      )
  );
$$;

-- -----------------------------------------------------------
-- PROFILES policies
-- -----------------------------------------------------------
-- Anyone (including anonymous) can read public profiles
create policy "profiles: public read"
  on public.profiles for select
  using (true);

-- Only the owner can update their own profile
create policy "profiles: owner update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Profile is created automatically via trigger; block manual inserts
-- (authenticated users only, must match their own auth id)
create policy "profiles: owner insert"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Only the owner can delete their profile (cascades to auth.users)
create policy "profiles: owner delete"
  on public.profiles for delete
  using (auth.uid() = id);

-- -----------------------------------------------------------
-- SHOPS policies
-- -----------------------------------------------------------
-- Public shops are visible to everyone
-- Private shops are visible only to their owner or via invite_code
-- NOTE: For invite_code access, the client must call:
--   supabase.rpc('is_shop_accessible', { p_shop_id: '...', p_provided_invite: '...' })
--   and then use the returned boolean to gate UI; the SELECT policy below
--   handles authenticated users. For anonymous invite access use the helper.

create policy "shops: public shops visible to all"
  on public.shops for select
  using (
    is_private = false
    or owner_id = auth.uid()
    -- Authenticated users who know the invite_code
    or (
      is_private = true
      and auth.uid() is not null
      -- Pass invite_code via a Supabase request header or session claim (see docs)
      -- Here we allow the owner check; invite-based access is handled via the RPC helper.
      and invite_code = current_setting('app.invite_code', true)
    )
  );

-- Only authenticated users can create a shop (owner_id must match their uid)
create policy "shops: authenticated users can create"
  on public.shops for insert
  with check (auth.uid() = owner_id);

-- Only the owner can update their shop
create policy "shops: owner can update"
  on public.shops for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Only the owner can delete their shop
create policy "shops: owner can delete"
  on public.shops for delete
  using (auth.uid() = owner_id);

-- -----------------------------------------------------------
-- PRODUCTS policies
-- -----------------------------------------------------------
-- Products inherit shop visibility: visible if the parent shop is accessible
create policy "products: visible if shop accessible"
  on public.products for select
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_id
        and (
          s.is_private = false
          or s.owner_id = auth.uid()
          or (
            s.is_private = true
            and auth.uid() is not null
            and s.invite_code = current_setting('app.invite_code', true)
          )
        )
    )
  );

-- Only the shop owner can add products
create policy "products: shop owner can insert"
  on public.products for insert
  with check (
    exists (
      select 1 from public.shops s
      where s.id = shop_id and s.owner_id = auth.uid()
    )
  );

-- Only the shop owner can update products
create policy "products: shop owner can update"
  on public.products for update
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shops s
      where s.id = shop_id and s.owner_id = auth.uid()
    )
  );

-- Only the shop owner can delete products
create policy "products: shop owner can delete"
  on public.products for delete
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_id and s.owner_id = auth.uid()
    )
  );

-- =============================================================
-- UTILITY: set invite_code session variable (call before querying)
-- Usage: SELECT set_invite_code('ABC123');
-- =============================================================
create or replace function public.set_invite_code(code text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('app.invite_code', code, true); -- true = transaction-scoped
end;
$$;
