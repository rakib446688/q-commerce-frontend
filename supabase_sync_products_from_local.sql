-- Sync local PRODUCTS from productsStore.js into Supabase (safe to rerun)

alter table public.products
  add column if not exists legacy_id text;

create unique index if not exists products_legacy_id_key on public.products (legacy_id);

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

insert into public.products (
  legacy_id,
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
    'w-top-001',
    'rib-knit-crop-top',
    'Rib Knit Crop Top',
    'Women',
    'tops',
    (select id from public.categories where slug = 'women'),
    28.00,
    4.6,
    128,
    array['cream','black','sage'],
    array['XS','S','M','L'],
    jsonb_build_object(
      'cream', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
      'black', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
      'sage', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft rib knit crop top with a clean neckline and fitted shape.',
    'Q Studio',
    true,
    25
  ),
  (
    'w-trouser-001',
    'tailored-wide-leg-trousers',
    'Tailored Wide-Leg Trousers',
    'Women',
    'trousers',
    (select id from public.categories where slug = 'women'),
    64.00,
    4.7,
    92,
    array['navy','stone'],
    array['XS','S','M','L','XL'],
    jsonb_build_object(
      'navy', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
      'stone', 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=900&q=80'
    ),
    'High-rise wide-leg trousers with pressed creases and side pockets.',
    'Atelier Q',
    true,
    25
  ),
  (
    'w-bag-001',
    'mini-shoulder-bag',
    'Mini Shoulder Bag',
    'Women',
    'handbags',
    (select id from public.categories where slug = 'women'),
    55.00,
    4.4,
    76,
    array['tan','black'],
    array[]::text[],
    jsonb_build_object(
      'tan', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=80',
      'black', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80'
    ),
    'Structured mini bag with adjustable strap and magnetic closure.',
    'Studio Line',
    true,
    25
  ),
  (
    'w-shoe-001',
    'sleek-court-sneakers',
    'Sleek Court Sneakers',
    'Women',
    'shoes',
    (select id from public.categories where slug = 'women'),
    72.00,
    4.5,
    51,
    array['white','black'],
    array['36','37','38','39','40'],
    jsonb_build_object(
      'white', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
      'black', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80'
    ),
    'Low-profile sneakers with cushioned sole and clean lines.',
    'Q Footwear',
    true,
    25
  ),
  (
    'm-shirt-001',
    'oxford-button-down-shirt',
    'Oxford Button-Down Shirt',
    'Men',
    'shirts',
    (select id from public.categories where slug = 'men'),
    48.00,
    4.6,
    140,
    array['white','sky'],
    array['S','M','L','XL'],
    jsonb_build_object(
      'white', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
      'sky', 'https://images.unsplash.com/photo-1520975682030-6c9c5f5e2a08?auto=format&fit=crop&w=900&q=80'
    ),
    'Classic oxford shirt with button-down collar and relaxed fit.',
    'Q Essentials',
    true,
    25
  ),
  (
    'm-hoodie-001',
    'fleece-pullover-hoodie',
    'Fleece Pullover Hoodie',
    'Men',
    'hoodies',
    (select id from public.categories where slug = 'men'),
    52.00,
    4.3,
    88,
    array['charcoal','forest'],
    array['S','M','L','XL','XXL'],
    jsonb_build_object(
      'charcoal', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
      'forest', 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft fleece hoodie with a structured hood and roomy pocket.',
    'Q Core',
    true,
    25
  ),
  (
    'm-tee-001',
    'everyday-crew-t-shirt',
    'Everyday Crew T-Shirt',
    'Men',
    't-shirts',
    (select id from public.categories where slug = 'men'),
    22.00,
    4.5,
    210,
    array['black','white','clay'],
    array['S','M','L','XL'],
    jsonb_build_object(
      'black', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
      'white', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
      'clay', 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80'
    ),
    'Midweight cotton tee with a clean neckline and straight hem.',
    'Daily Q',
    true,
    25
  ),
  (
    'm-trouser-001',
    'slim-chino-trousers',
    'Slim Chino Trousers',
    'Men',
    'trousers',
    (select id from public.categories where slug = 'men'),
    58.00,
    4.4,
    97,
    array['khaki','navy'],
    array['30','32','34','36'],
    jsonb_build_object(
      'khaki', 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=900&q=80',
      'navy', 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80'
    ),
    'Slim chino trousers with stretch and angled front pockets.',
    'Q Essentials',
    true,
    25
  ),
  (
    'm-shoe-001',
    'everyday-runner',
    'Everyday Runner',
    'Men',
    'shoes',
    (select id from public.categories where slug = 'men'),
    78.00,
    4.5,
    66,
    array['white','graphite'],
    array['40','41','42','43','44'],
    jsonb_build_object(
      'white', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
      'graphite', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80'
    ),
    'Lightweight runner with cushioned sole and breathable mesh.',
    'Q Footwear',
    true,
    25
  ),
  (
    'k-set-001',
    'kids-cozy-set',
    'Kids Cozy Set',
    'Kids',
    'sets',
    (select id from public.categories where slug = 'kids'),
    34.00,
    4.6,
    44,
    array['blue','rose'],
    array['2-3','3-4','4-5','5-6'],
    jsonb_build_object(
      'blue', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
      'rose', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft hoodie and jogger set for everyday play.',
    'Q Kids',
    true,
    25
  ),
  (
    'k-boys-001',
    'boys-adventure-tee',
    'Boys Adventure Tee',
    'Kids',
    'boys',
    (select id from public.categories where slug = 'kids'),
    18.00,
    4.5,
    33,
    array['navy','green'],
    array['4-5','5-6','6-7'],
    jsonb_build_object(
      'navy', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
      'green', 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=900&q=80'
    ),
    'Cotton graphic tee with soft hand feel.',
    'Q Kids',
    true,
    25
  ),
  (
    'k-girls-001',
    'girls-pleated-skirt',
    'Girls Pleated Skirt',
    'Kids',
    'girls',
    (select id from public.categories where slug = 'kids'),
    26.00,
    4.4,
    29,
    array['plum','sand'],
    array['4-5','5-6','6-7'],
    jsonb_build_object(
      'plum', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
      'sand', 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=900&q=80'
    ),
    'Pleated skirt with elastic waist and soft lining.',
    'Q Kids',
    true,
    25
  ),
  (
    'k-baby-001',
    'baby-sleep-suit',
    'Baby Sleep Suit',
    'Kids',
    'baby',
    (select id from public.categories where slug = 'kids'),
    20.00,
    4.8,
    64,
    array['cream','mint'],
    array['0-3','3-6','6-9'],
    jsonb_build_object(
      'cream', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
      'mint', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft cotton sleep suit with easy snap closure.',
    'Q Baby',
    true,
    25
  ),
  (
    'e-phone-001',
    'aero-phone-case',
    'Aero Phone Case',
    'Electronics',
    'phones-accessories',
    (select id from public.categories where slug = 'electronics'),
    18.00,
    4.3,
    120,
    array['clear','black','blue'],
    array[]::text[],
    jsonb_build_object(
      'clear', 'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?auto=format&fit=crop&w=900&q=80',
      'black', 'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?auto=format&fit=crop&w=900&q=80',
      'blue', 'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?auto=format&fit=crop&w=900&q=80'
    ),
    'Slim protective case with raised bezels and matte finish.',
    'Q Tech',
    true,
    25
  ),
  (
    'e-headphone-001',
    'noiselite-headphones',
    'NoiseLite Headphones',
    'Electronics',
    'phones-accessories',
    (select id from public.categories where slug = 'electronics'),
    96.00,
    4.6,
    58,
    array['black','silver'],
    array[]::text[],
    jsonb_build_object(
      'black', 'https://images.unsplash.com/photo-1518441988750-40ad6c6e789b?auto=format&fit=crop&w=900&q=80',
      'silver', 'https://images.unsplash.com/photo-1518441988750-40ad6c6e789b?auto=format&fit=crop&w=900&q=80'
    ),
    'Over-ear wireless headphones with active noise reduction.',
    'Q Audio',
    true,
    25
  ),
  (
    'e-laptop-001',
    'slate-14-laptop',
    'Slate 14 Laptop',
    'Electronics',
    'laptops',
    (select id from public.categories where slug = 'electronics'),
    1099.00,
    4.7,
    41,
    array['graphite','silver'],
    array[]::text[],
    jsonb_build_object(
      'graphite', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80',
      'silver', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80'
    ),
    '14-inch laptop with all-day battery and crisp display.',
    'Q Tech',
    true,
    25
  ),
  (
    'e-laptop-002',
    'studio-16-laptop',
    'Studio 16 Laptop',
    'Electronics',
    'laptops',
    (select id from public.categories where slug = 'electronics'),
    1499.00,
    4.8,
    27,
    array['silver','midnight'],
    array[]::text[],
    jsonb_build_object(
      'silver', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80',
      'midnight', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80'
    ),
    '16-inch creator laptop with fast performance and wide color gamut.',
    'Q Studio',
    true,
    25
  ),
  (
    'h-living-001',
    'minimal-table-lamp',
    'Minimal Table Lamp',
    'Home & Living',
    null,
    (select id from public.categories where slug = 'home-living'),
    42.00,
    4.5,
    74,
    array['white','black'],
    array[]::text[],
    jsonb_build_object(
      'white', 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?auto=format&fit=crop&w=900&q=80',
      'black', 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft-glow table lamp with matte finish and clean silhouette.',
    'Q Home',
    true,
    25
  ),
  (
    'h-living-002',
    'woven-throw-blanket',
    'Woven Throw Blanket',
    'Home & Living',
    null,
    (select id from public.categories where slug = 'home-living'),
    36.00,
    4.6,
    59,
    array['sand','charcoal'],
    array[]::text[],
    jsonb_build_object(
      'sand', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80',
      'charcoal', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80'
    ),
    'Soft woven throw with textured fringe edges.',
    'Q Home',
    true,
    25
  ),
  (
    'h-living-003',
    'glass-storage-set',
    'Glass Storage Set',
    'Home & Living',
    null,
    (select id from public.categories where slug = 'home-living'),
    24.00,
    4.4,
    38,
    array['clear'],
    array[]::text[],
    jsonb_build_object(
      'clear', 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80'
    ),
    'Set of three glass storage jars with wood lids.',
    'Q Home',
    true,
    25
  )
on conflict (slug) do update
set
  legacy_id = excluded.legacy_id,
  slug = excluded.slug,
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
