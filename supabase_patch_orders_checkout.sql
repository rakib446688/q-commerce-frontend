-- supabase_patch_orders_checkout_v1.sql
-- Safe incremental patch for Q-Commerce (orders/checkout improvements)

-- ------------------------------------------------------------
-- Orders: store checkout/customer snapshot fields
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists currency_code text not null default 'GBP';

alter table public.orders
  add column if not exists customer_name text;

alter table public.orders
  add column if not exists customer_email text;

alter table public.orders
  add column if not exists delivery_address text;

alter table public.orders
  add column if not exists payment_status text not null default 'paid';

alter table public.orders
  add column if not exists payment_method text;

alter table public.orders
  add column if not exists notes text;

-- Optional sanity cleanup for existing rows (if any)
update public.orders
set currency_code = 'GBP'
where currency_code is null;

update public.orders
set payment_status = 'paid'
where payment_status is null;

-- ------------------------------------------------------------
-- Order items: add extra snapshot fields (optional but useful)
-- ------------------------------------------------------------
alter table public.order_items
  add column if not exists product_slug text;

alter table public.order_items
  add column if not exists image_url text;

alter table public.order_items
  add column if not exists line_total numeric(10,2);

-- Backfill line_total for existing rows
update public.order_items
set line_total = round((price * quantity)::numeric, 2)
where line_total is null;

-- ------------------------------------------------------------
-- Helpful indexes (safe)
-- ------------------------------------------------------------
create index if not exists idx_orders_customer_email on public.orders(customer_email);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);

-- ------------------------------------------------------------
-- NOTE:
-- RLS policies usually do not need changes for these added columns,
-- because inserts/selects are already controlled at the row level.
-- ------------------------------------------------------------