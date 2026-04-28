-- Q-Commerce backend schema (v2.1)
-- Recommended: run on a fresh DB / after reset for cleanest setup.
-- IMPORTANT: `create table if not exists` will NOT modify old tables if they already exist
-- with a different structure. For a clean upgrade from older versions, reset DB or write migrations.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Utility: updated_at trigger
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Products
-- Notes:
-- - Keeping both `category` (text) and `category_id` (FK) for frontend compatibility.
-- - `slug` added for clean product routes and safe seed upserts.
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,

  -- Backward-compatible display category (used by many frontend UIs)
  category text not null,
  subcategory text,

  -- Normalized relation (recommended for long-term backend quality)
  category_id uuid references public.categories(id) on delete set null,

  price numeric(10,2) not null check (price >= 0),
  rating_avg numeric(3,2) not null default 0 check (rating_avg >= 0 and rating_avg <= 5),
  rating_count integer not null default 0 check (rating_count >= 0),

  colors text[] not null default array[]::text[],
  sizes text[] not null default array[]::text[],
  color_images jsonb not null default '{}'::jsonb,

  description text,
  brand text,

  is_active boolean not null default true,
  stock_qty integer not null default 0 check (stock_qty >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_color_images_is_object
    check (jsonb_typeof(color_images) = 'object')
);

-- ------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  subtotal numeric(10,2) not null check (subtotal >= 0),
  shipping numeric(10,2) not null check (shipping >= 0),
  total numeric(10,2) not null check (total >= 0),

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),

  currency_code text not null default 'GBP',
  customer_name text,
  customer_email text,
  delivery_address text,
  payment_status text not null default 'pending',
  payment_method text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Order Items
-- Snapshot-style line items:
-- - Keeps title/price/color/size at time of purchase
-- - product_id is optional FK for reference
-- ------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,

  title text not null,
  price numeric(10,2) not null check (price >= 0),
  quantity integer not null check (quantity > 0),
  product_slug text,
  image_url text,
  line_total numeric(10,2) not null default 0 check (line_total >= 0),

  color text,
  size text,

  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indexes (performance)
-- ------------------------------------------------------------
create index if not exists idx_categories_slug on public.categories(slug);

create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_is_active on public.products(is_active);
create index if not exists idx_products_created_at on public.products(created_at desc);

create index if not exists idx_orders_user_created on public.orders(user_id, created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Drop + recreate policies so reruns don't fail on policy name conflicts
-- Also clean up legacy policy names from older schema versions.

-- Categories
drop policy if exists "public read categories" on public.categories;
create policy "public read categories"
on public.categories
for select
to anon, authenticated
using (true);

-- Products (cleanup old and create active-only read policy)
drop policy if exists "public read products" on public.products;
drop policy if exists "public read active products" on public.products;
create policy "public read active products"
on public.products
for select
to anon, authenticated
using (is_active = true);

-- Orders
drop policy if exists "users read own orders" on public.orders;
create policy "users read own orders"
on public.orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users insert own orders" on public.orders;
create policy "users insert own orders"
on public.orders
for insert
to authenticated
with check (auth.uid() = user_id);

-- Order items
drop policy if exists "users read own order items" on public.order_items;
create policy "users read own order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

-- Cleanup both naming variants, then create one consistent policy name
drop policy if exists "users insert own order items" on public.order_items;
drop policy if exists "users insert own order_items" on public.order_items;
create policy "users insert own order items"
on public.order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

-- Optional future policies (admin product management) can be added later.
