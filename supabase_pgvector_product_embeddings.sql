-- Q-Commerce: pgvector product embeddings
-- Run this in Supabase SQL editor (once).

create extension if not exists vector;

create table if not exists public.product_embeddings (
  product_id uuid primary key references public.products(id) on delete cascade,
  embedding vector not null,
  embedding_model text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_product_embeddings_product_id on public.product_embeddings(product_id);

drop trigger if exists trg_product_embeddings_updated_at on public.product_embeddings;
create trigger trg_product_embeddings_updated_at
before update on public.product_embeddings
for each row execute function public.set_updated_at();

alter table public.product_embeddings enable row level security;

-- No public RLS policies by default (only server/service-role should write/read embeddings).

-- Vector similarity search helper (called from the Node backend via supabase.rpc)
create or replace function public.match_products(
  query_embedding vector,
  match_count integer default 10,
  match_threshold double precision default 0
)
returns table (
  product_id uuid,
  slug text,
  title text,
  category text,
  subcategory text,
  price numeric,
  similarity double precision
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.slug,
    p.title,
    p.category,
    p.subcategory,
    p.price,
    1 - (pe.embedding <=> query_embedding) as similarity
  from public.product_embeddings pe
  join public.products p on p.id = pe.product_id
  where p.is_active = true
    and (1 - (pe.embedding <=> query_embedding)) >= match_threshold
  order by pe.embedding <=> query_embedding
  limit match_count;
$$;
