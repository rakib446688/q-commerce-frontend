-- Q-Commerce sample seed data (v2.1)
-- Safe to rerun because categories/products use unique slugs + upsert.
-- Assumes schema v2.1 has already been run.

-- ------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------
insert into public.categories (name, slug)
values
  ('Women', 'women'),
  ('Men', 'men'),
  ('Kids', 'kids'),
  ('Electronics', 'electronics'),
  ('Home & Living', 'home-living')
on conflict (slug) do update
set
  name = excluded.name,
  updated_at = now();

-- ------------------------------------------------------------
-- Products
-- Notes:
-- - Uses slug for conflict-safe upserts
-- - Fills both category text and category_id for compatibility + normalization
-- ------------------------------------------------------------
insert into public.products (
  slug,
  title,
  category,
  subcategory,
  category_id,
  price,
  rating_avg,
  rating_count,
  colors,
  sizes,
  color_images,
  description,
  brand,
  is_active,
  stock_qty
)
values
  (
    'rib-knit-crop-top',
    'Rib Knit Crop Top',
    'Women',
    'tops',
    (select id from public.categories where slug = 'women'),
    28.00,
    4.60,
    128,
    array['cream','black','sage'],
    array['XS','S','M','L'],
    jsonb_build_object(
      'cream', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft rib knit crop top with a clean neckline.',
    'Q Studio',
    true,
    35
  ),
  (
    'oxford-button-down-shirt',
    'Oxford Button-Down Shirt',
    'Men',
    'shirts',
    (select id from public.categories where slug = 'men'),
    22.99,
    4.60,
    140,
    array['white','sky'],
    array['S','M','L','XL'],
    jsonb_build_object(
      'white', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'
    ),
    'Classic oxford shirt with button-down collar.',
    'Q Essentials',
    true,
    22
  ),
  (
    'kids-cozy-set',
    'Kids Cozy Set',
    'Kids',
    'sets',
    (select id from public.categories where slug = 'kids'),
    16.99,
    4.60,
    44,
    array['blue','rose'],
    array['2-3','3-4','4-5'],
    jsonb_build_object(
      'blue', 'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft hoodie and jogger set for everyday play.',
    'Q Kids',
    true,
    18
  ),
  (
    'wireless-earbuds-lite',
    'Wireless Earbuds Lite',
    'Electronics',
    'audio',
    (select id from public.categories where slug = 'electronics'),
    24.99,
    4.40,
    89,
    array['black','white'],
    array[]::text[],
    jsonb_build_object(
      'black', 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?auto=format&fit=crop&w=900&q=80'
    ),
    'Compact everyday earbuds with charging case.',
    'Q Tech',
    true,
    50
  ),
  (
    'textured-throw-cushion',
    'Textured Throw Cushion',
    'Home & Living',
    'decor',
    (select id from public.categories where slug = 'home-living'),
    22.00,
    4.70,
    61,
    array['ivory','charcoal'],
    array[]::text[],
    jsonb_build_object(
      'ivory', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft textured cushion cover and insert for modern interiors.',
    'Q Haus',
    true,
    27
  )
on conflict (slug) do update
set
  title = excluded.title,
  category = excluded.category,
  subcategory = excluded.subcategory,
  category_id = excluded.category_id,
  price = excluded.price,
  rating_avg = excluded.rating_avg,
  rating_count = excluded.rating_count,
  colors = excluded.colors,
  sizes = excluded.sizes,
  color_images = excluded.color_images,
  description = excluded.description,
  brand = excluded.brand,
  is_active = excluded.is_active,
  stock_qty = excluded.stock_qty,
  updated_at = now();
