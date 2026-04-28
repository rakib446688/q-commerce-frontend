# Catalog Seeding (Stable Local Images)

This repo stores product images locally under `public/` so they never change unexpectedly.

## What you get
- 5 categories: Women, Men, Kids, Electronics, Home & Living
- 16 products per category (80 total)
- Product images served locally from `public/products/...`
- Category tile images served locally from `public/categories/...`

## Files
- Catalog data: `data/catalog.products.with-images.json`
- Price entry: `data/prices.json` (you fill this)
- Price checklist: `data/price-sheet.md`
- Image attribution: `public/products/ATTRIBUTION.md`
- SQL generator: `scripts/build-supabase-products-sql.mjs`

## Steps
1. Fill prices (GBP) in `data/prices.json` (all values must be numbers).
2. Generate SQL: `npm run catalog:sql`
3. Copy/paste `supabase_seed_products_catalog.sql` into Supabase SQL Editor and run it.

## Notes
- The SQL is **non-destructive**: it sets existing `public.products.is_active = false`, then upserts the new 80 products and re-activates them.
- Image paths in Supabase are **relative** (e.g. `/products/women/women-rib-top.jpg`) so they work in dev and production on your site domain.

